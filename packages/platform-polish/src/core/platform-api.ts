import { EventEmitter } from 'events';
import { ServiceConfig, PlatformConfig, HealthStatus, ServiceRegistration, PlatformEvent } from '../types';
import { Logger } from '../utils/logger';
import { HealthMonitor } from '../health/health-monitor';
import { ServiceDiscovery } from '../service-discovery/service-discovery';
import { LoadBalancer } from '../load-balancer/load-balancer';
import { CircuitBreakerManager } from '../circuit-breaker/circuit-breaker-manager';
import { ConfigManager } from '../config/config-manager';
import { SecurityManager } from '../security/security-manager';
import { CacheManager } from '../cache/cache-manager';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { TraceCollector } from '../monitoring/trace-collector';

export class PlatformAPI extends EventEmitter {
  private logger: Logger;
  private config: PlatformConfig;
  private services: Map<string, ServiceRegistration> = new Map();
  private healthMonitor: HealthMonitor;
  private serviceDiscovery: ServiceDiscovery;
  private loadBalancer: LoadBalancer;
  private circuitBreaker: CircuitBreakerManager;
  private securityManager: SecurityManager;
  private cacheManager: CacheManager;
  private metricsCollector: MetricsCollector;
  private traceCollector: TraceCollector;
  private isRunning = false;
  private shutdownHooks: Array<() => Promise<void>> = [];

  constructor(config: PlatformConfig) {
    super();
    this.config = config;
    this.logger = new Logger(`PlatformAPI-${config.name}`);

    // Initialize core components
    this.healthMonitor = new HealthMonitor(config.services);
    this.serviceDiscovery = new ServiceDiscovery(config);
    this.loadBalancer = new LoadBalancer(config);
    this.circuitBreaker = new CircuitBreakerManager(config);
    this.securityManager = new SecurityManager(config);
    this.cacheManager = new CacheManager(config);
    this.metricsCollector = new MetricsCollector(config);
    this.traceCollector = new TraceCollector(config);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Platform API is already running');
    }

    this.logger.info('Starting Platform API...');

    try {
      // Start all components
      await this.serviceDiscovery.start();
      await this.healthMonitor.start();
      await this.loadBalancer.start();
      await this.circuitBreaker.start();
      await this.securityManager.start();
      await this.cacheManager.start();
      await this.metricsCollector.start();
      await this.traceCollector.start();

      // Register event listeners
      this.setupEventListeners();

      this.isRunning = true;
      this.logger.info('Platform API started successfully');

      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Platform API', { error });
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Platform API...');

    try {
      // Execute shutdown hooks in reverse order
      for (let i = this.shutdownHooks.length - 1; i >= 0; i--) {
        try {
          await this.shutdownHooks[i]();
        } catch (error) {
          this.logger.error('Shutdown hook failed', { error, hookIndex: i });
        }
      }

      // Stop all components
      await this.traceCollector.stop();
      await this.metricsCollector.stop();
      await this.cacheManager.stop();
      await this.securityManager.stop();
      await this.circuitBreaker.stop();
      await this.loadBalancer.stop();
      await this.healthMonitor.stop();
      await this.serviceDiscovery.stop();

      this.isRunning = false;
      this.logger.info('Platform API stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Platform API shutdown', { error });
      throw error;
    }
  }

  private setupEventListeners(): void {
    this.healthMonitor.on('healthUpdate', (status: HealthStatus) => {
      this.handleHealthUpdate(status);
    });

    this.serviceDiscovery.on('serviceRegistered', (service: ServiceRegistration) => {
      this.handleServiceRegistered(service);
    });

    this.serviceDiscovery.on('serviceDeregistered', (serviceId: string) => {
      this.handleServiceDeregistered(serviceId);
    });

    this.loadBalancer.on('balancingEvent', (event: any) => {
      this.emit('balancingEvent', event);
    });

    this.circuitBreaker.on('stateChange', (event: any) => {
      this.emit('circuitBreakerEvent', event);
    });

    this.metricsCollector.on('metric', (metric: any) => {
      this.emit('metric', metric);
    });

    this.traceCollector.on('trace', (trace: any) => {
      this.emit('trace', trace);
    });
  }

  private handleHealthUpdate(status: HealthStatus): void {
    const service = this.services.get(status.service);
    if (service) {
      service.health = status;
      this.services.set(service.id, service);
    }

    this.emit('healthUpdate', status);

    // Emit platform event
    const event: PlatformEvent = {
      id: `health-${Date.now()}`,
      type: 'health_check',
      timestamp: new Date(),
      source: status.service,
      payload: status,
      severity: status.status === 'healthy' ? 'low' : 'high'
    };
    this.emit('event', event);
  }

  private handleServiceRegistered(service: ServiceRegistration): void {
    this.services.set(service.id, service);
    this.logger.info(`Service registered: ${service.name} (${service.id})`);
    this.emit('serviceRegistered', service);
  }

  private handleServiceDeregistered(serviceId: string): void {
    const service = this.services.get(serviceId);
    if (service) {
      this.services.delete(serviceId);
      this.logger.info(`Service deregistered: ${service.name} (${serviceId})`);
      this.emit('serviceDeregistered', serviceId);
    }
  }

  // Public API methods
  async registerService(config: ServiceConfig): Promise<void> {
    try {
      await this.serviceDiscovery.registerService(config);
      this.logger.info(`Service registered: ${config.name} (${config.id})`);
    } catch (error) {
      this.logger.error(`Failed to register service: ${config.name}`, { error });
      throw error;
    }
  }

  async deregisterService(serviceId: string): Promise<void> {
    try {
      await this.serviceDiscovery.deregisterService(serviceId);
      this.logger.info(`Service deregistered: ${serviceId}`);
    } catch (error) {
      this.logger.error(`Failed to deregister service: ${serviceId}`, { error });
      throw error;
    }
  }

  async getService(serviceId: string): Promise<ServiceRegistration | undefined> {
    return this.services.get(serviceId);
  }

  async getAllServices(): Promise<ServiceRegistration[]> {
    return Array.from(this.services.values());
  }

  async getHealthyServices(serviceName?: string): Promise<ServiceRegistration[]> {
    const allServices = await this.getAllServices();
    return allServices.filter(service =>
      (!serviceName || service.name === serviceName) &&
      service.health.status === 'healthy'
    );
  }

  async requestService(serviceName: string, endpoint: string, options?: any): Promise<any> {
    try {
      const service = await this.loadBalancer.selectService(serviceName);
      if (!service) {
        throw new Error(`No healthy services available for: ${serviceName}`);
      }

      const requestConfig = {
        service,
        endpoint,
        ...options
      };

      // Apply security checks
      await this.securityManager.authorizeRequest(requestConfig);

      // Apply circuit breaker
      return await this.circuitBreaker.execute(service.id, async () => {
        // Try cache first
        const cacheKey = `${serviceName}:${endpoint}:${JSON.stringify(options)}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for: ${cacheKey}`);
          return cached;
        }

        // Make actual request
        const response = await this.makeServiceRequest(requestConfig);

        // Cache successful responses
        if (response.status >= 200 && response.status < 400) {
          await this.cacheManager.set(cacheKey, response.data, 300); // 5 minutes
        }

        return response.data;
      });
    } catch (error) {
      this.logger.error(`Service request failed for ${serviceName}`, { error });
      throw error;
    }
  }

  private async makeServiceRequest(config: any): Promise<any> {
    // Implementation would use axios or HTTP client
    // For now, return mock response
    return {
      status: 200,
      data: {
        message: 'Service request successful',
        timestamp: new Date().toISOString(),
        service: config.service.name,
        endpoint: config.endpoint
      }
    };
  }

  async getHealthStatus(serviceId?: string): Promise<HealthStatus | HealthStatus[]> {
    if (serviceId) {
      const service = await this.getService(serviceId);
      return service?.health;
    }
    return Promise.all(this.services.values()).map(s => s.health);
  }

  async getMetrics(serviceId?: string): Promise<any> {
    if (serviceId) {
      return this.metricsCollector.getServiceMetrics(serviceId);
    }
    return this.metricsCollector.getAllMetrics();
  }

  async getTraces(options?: any): Promise<any[]> {
    return this.traceCollector.getTraces(options);
  }

  async invalidateCache(pattern?: string): Promise<void> {
    if (pattern) {
      await this.cacheManager.invalidateByPattern(pattern);
    } else {
      await this.cacheManager.invalidateAll();
    }
  }

  addShutdownHook(hook: () => Promise<void>): void {
    this.shutdownHooks.push(hook);
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  async getStats(): Promise<any> {
    return {
      services: {
        total: this.services.size,
        healthy: Array.from(this.services.values()).filter(s => s.health.status === 'healthy').length,
        unhealthy: Array.from(this.services.values()).filter(s => s.health.status === 'unhealthy').length
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      config: {
        name: this.config.name,
        version: this.config.version,
        environment: this.config.environment,
        services: this.config.services.length
      }
    };
  }
}