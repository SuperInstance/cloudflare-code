// @ts-nocheck
import { EventEmitter } from 'events';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ServiceConfig, ServiceRegistration, HealthStatus } from '../types';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../config/config-manager';

export class ServiceDiscovery extends EventEmitter {
  private logger: Logger;
  private configManager: ConfigManager;
  private registry: Map<string, ServiceRegistration> = new Map();
  private serviceIntervals: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private discoveryInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private consulHost?: string;
  private consulPort?: number;

  constructor(configManager: ConfigManager, consulHost?: string, consulPort?: number) {
    super();
    this.configManager = configManager;
    this.logger = new Logger('ServiceDiscovery');
    this.consulHost = consulHost;
    this.consulPort = consulPort;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Service Discovery is already running');
    }

    this.logger.info('Starting Service Discovery...');

    try {
      // Start periodic discovery
      await this.startPeriodicDiscovery();

      // Start registered services heartbeat
      await this.startHeartbeats();

      this.isRunning = true;
      this.logger.info('Service Discovery started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Service Discovery', { error });
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Service Discovery...');

    try {
      // Stop discovery interval
      if (this.discoveryInterval) {
        clearInterval(this.discoveryInterval);
        this.discoveryInterval = null;
      }

      // Stop all heartbeat intervals
      this.heartbeatIntervals.forEach(interval => clearInterval(interval));
      this.heartbeatIntervals.clear();

      // Stop service intervals
      this.serviceIntervals.forEach(interval => clearInterval(interval));
      this.serviceIntervals.clear();

      // Deregister all services from Consul if available
      if (this.consulHost && this.consulPort) {
        await this.deregisterAllFromConsul();
      }

      this.isRunning = false;
      this.logger.info('Service Discovery stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Service Discovery shutdown', { error });
      throw error;
    }
  }

  async registerService(config: ServiceConfig): Promise<void> {
    try {
      // Check if service already exists
      if (this.registry.has(config.id)) {
        throw new Error(`Service with ID ${config.id} is already registered`);
      }

      // Create service registration
      const registration: ServiceRegistration = {
        id: config.id,
        name: config.name,
        version: config.version,
        host: config.host,
        port: config.port,
        metadata: {
          registeredAt: new Date().toISOString(),
          config
        },
        health: this.createInitialHealthStatus(config),
        capabilities: [],
        dependencies: []
      };

      // Register in local registry
      this.registry.set(config.id, registration);

      // Register with Consul if available
      if (this.consulHost && this.consulPort) {
        await this.registerWithConsul(registration, config);
      }

      this.logger.info(`Service registered: ${config.name} (${config.id})`);
      this.emit('serviceRegistered', registration);
    } catch (error) {
      this.logger.error(`Failed to register service: ${config.name}`, { error });
      throw error;
    }
  }

  async deregisterService(serviceId: string): Promise<void> {
    try {
      const service = this.registry.get(serviceId);
      if (!service) {
        throw new Error(`Service with ID ${serviceId} not found`);
      }

      // Stop service intervals
      if (this.serviceIntervals.has(serviceId)) {
        clearInterval(this.serviceIntervals.get(serviceId)!);
        this.serviceIntervals.delete(serviceId);
      }

      if (this.heartbeatIntervals.has(serviceId)) {
        clearInterval(this.heartbeatIntervals.get(serviceId)!);
        this.heartbeatIntervals.delete(serviceId);
      }

      // Remove from local registry
      this.registry.delete(serviceId);

      // Deregister from Consul if available
      if (this.consulHost && this.consulPort) {
        await this.deregisterFromConsul(serviceId);
      }

      this.logger.info(`Service deregistered: ${service.name} (${serviceId})`);
      this.emit('serviceDeregistered', serviceId);
    } catch (error) {
      this.logger.error(`Failed to deregister service: ${serviceId}`, { error });
      throw error;
    }
  }

  async discoverServices(): Promise<ServiceRegistration[]> {
    const services: ServiceRegistration[] = [];

    // Get services from local registry
    services.push(...Array.from(this.registry.values()));

    // Get services from Consul if available
    if (this.consulHost && this.consulPort) {
      try {
        const consulServices = await this.discoverFromConsul();
        services.push(...consulServices);
      } catch (error) {
        this.logger.warn('Failed to discover services from Consul', { error });
      }
    }

    return services;
  }

  async getService(serviceId: string): Promise<ServiceRegistration | null> {
    return this.registry.get(serviceId) || null;
  }

  async getServicesByType(serviceType: string): Promise<ServiceRegistration[]> {
    return Array.from(this.registry.values()).filter(
      service => service.metadata.config?.type === serviceType
    );
  }

  async getHealthyServices(serviceName?: string): Promise<ServiceRegistration[]> {
    const allServices = await this.discoverServices();
    return allServices.filter(service =>
      (!serviceName || service.name === serviceName) &&
      service.health.status === 'healthy'
    );
  }

  async getAvailableServices(): Promise<ServiceRegistration[]> {
    const services = await this.discoverServices();
    return services.filter(service => service.health.status === 'healthy');
  }

  async discoverFromConsul(): Promise<ServiceRegistration[]> {
    if (!this.consulHost || !this.consulPort) {
      return [];
    }

    try {
      const response = await axios.get(`http://${this.consulHost}:${this.consulPort}/v1/catalog/services`);
      const consulServices = response.data;
      const registrations: ServiceRegistration[] = [];

      for (const [serviceName, serviceData] of Object.entries(consulServices)) {
        if (typeof serviceData === 'object' && 'Service' in serviceData) {
          const serviceInfo = (serviceData as any).Service;
          const registration: ServiceRegistration = {
            id: serviceInfo.ID,
            name: serviceName,
            version: serviceInfo.ServiceTags?.find((tag: string) => tag.startsWith('version='))?.split('=')[1] || '1.0.0',
            host: serviceInfo.Address,
            port: serviceInfo.Port,
            metadata: {
              registeredAt: serviceInfo.ServiceMeta?.registeredAt || new Date().toISOString(),
              source: 'consul'
            },
            health: {
              service: serviceName,
              status: 'healthy',
              lastCheck: new Date(),
              uptime: process.uptime(),
              responseTime: 0,
              errorRate: 0,
              cpuUsage: 0,
              memoryUsage: 0
            },
            capabilities: serviceInfo.ServiceTags || [],
            dependencies: serviceInfo.ServiceMeta?.dependencies?.split(',') || []
          };
          registrations.push(registration);
        }
      }

      return registrations;
    } catch (error) {
      this.logger.error('Failed to discover services from Consul', { error });
      throw error;
    }
  }

  async registerWithConsul(registration: ServiceRegistration, config: ServiceConfig): Promise<void> {
    if (!this.consulHost || !this.consulPort) {
      return;
    }

    try {
      const tags = [
        `version=${registration.version}`,
        ...(config.security?.cors?.origins || []),
        ...(config.monitoring?.logging?.outputs || [])
      ];

      const meta = {
        registeredAt: registration.metadata.registeredAt,
        type: 'service',
        dependencies: config.name
      };

      const service = {
        ID: registration.id,
        Name: registration.name,
        Tags: tags,
        Address: registration.host,
        Port: registration.port,
        Meta: meta,
        Check: {
          HTTP: `http://${registration.host}:${registration.port}${config.healthCheck.endpoint}`,
          Interval: `${config.healthCheck.interval}ms`,
          Timeout: `${config.healthCheck.timeout}ms`,
          DeregisterCriticalServiceAfter: '30m'
        }
      };

      await axios.put(`http://${this.consulHost}:${this.consulPort}/v1/agent/service/register`, service);
      this.logger.debug(`Registered service with Consul: ${registration.name}`);
    } catch (error) {
      this.logger.error(`Failed to register service with Consul: ${registration.name}`, { error });
      throw error;
    }
  }

  async deregisterFromConsul(serviceId: string): Promise<void> {
    if (!this.consulHost || !this.consulPort) {
      return;
    }

    try {
      await axios.put(`http://${this.consulHost}:${this.consulPort}/v1/agent/service/deregister/${serviceId}`);
      this.logger.debug(`Deregistered service from Consul: ${serviceId}`);
    } catch (error) {
      this.logger.error(`Failed to deregister service from Consul: ${serviceId}`, { error });
      throw error;
    }
  }

  async deregisterAllFromConsul(): Promise<void> {
    if (!this.consulHost || !this.consulPort) {
      return;
    }

    try {
      await axios.put(`http://${this.consulHost}:${this.consulPort}/v1/agent/service/deregister`);
      this.logger.debug('Deregistered all services from Consul');
    } catch (error) {
      this.logger.error('Failed to deregister all services from Consul', { error });
      throw error;
    }
  }

  private async startPeriodicDiscovery(): Promise<void> {
    const config = this.configManager.getConfig();
    if (!config) {
      throw new Error('Configuration not loaded');
    }

    this.discoveryInterval = setInterval(async () => {
      try {
        await this.discoverAndRegisterServices();
      } catch (error) {
        this.logger.error('Periodic discovery failed', { error });
      }
    }, 30000); // 30 seconds

    // Run initial discovery
    await this.discoverAndRegisterServices();
  }

  private async discoverAndRegisterServices(): Promise<void> {
    try {
      // Get all configured services
      const configuredServices = this.configManager.getConfig()?.services || [];

      // Get current registered services
      const registeredServices = Array.from(this.registry.keys());

      // Register new services
      for (const serviceConfig of configuredServices) {
        if (!registeredServices.includes(serviceConfig.id)) {
          await this.registerService(serviceConfig);
        }
      }
    } catch (error) {
      this.logger.error('Failed to discover and register services', { error });
    }
  }

  private async startHeartbeats(): Promise<void> {
    const services = Array.from(this.registry.values());

    for (const service of services) {
      const config = this.configManager.getServiceConfig(service.id);
      if (!config) {
        continue;
      }

      const interval = setInterval(async () => {
        try {
          await this.checkServiceHealth(service, config);
        } catch (error) {
          this.logger.error(`Health check failed for service: ${service.name}`, { error });
        }
      }, config.healthCheck.interval);

      this.heartbeatIntervals.set(service.id, interval);
    }
  }

  private async checkServiceHealth(service: ServiceRegistration, config: ServiceConfig): Promise<void> {
    try {
      const startTime = Date.now();
      const response = await axios.get(`http://${service.host}:${service.port}${config.healthCheck.endpoint}`, {
        timeout: config.healthCheck.timeout
      });
      const responseTime = Date.now() - startTime;

      const healthStatus: HealthStatus = {
        service: service.name,
        status: 'healthy',
        lastCheck: new Date(),
        uptime: response.data.uptime || 0,
        responseTime: responseTime,
        errorRate: response.data.errorRate || 0,
        cpuUsage: response.data.cpuUsage || 0,
        memoryUsage: response.data.memoryUsage || 0
      };

      // Update service registration
      service.health = healthStatus;
      this.registry.set(service.id, service);

      // Emit health update
      this.emit('healthUpdate', healthStatus);

      this.logger.debug(`Health check passed for service: ${service.name}`, {
        responseTime,
        status: healthStatus.status
      });
    } catch (error) {
      const healthStatus: HealthStatus = {
        service: service.name,
        status: 'unhealthy',
        lastCheck: new Date(),
        uptime: service.health.uptime,
        responseTime: 0,
        errorRate: 100,
        cpuUsage: 0,
        memoryUsage: 0
      };

      // Update service registration
      service.health = healthStatus;
      this.registry.set(service.id, service);

      // Emit health update
      this.emit('healthUpdate', healthStatus);

      this.logger.warn(`Health check failed for service: ${service.name}`, { error });
    }
  }

  private createInitialHealthStatus(config: ServiceConfig): HealthStatus {
    return {
      service: config.name,
      status: 'healthy',
      lastCheck: new Date(),
      uptime: 0,
      responseTime: 0,
      errorRate: 0,
      cpuUsage: 0,
      memoryUsage: 0
    };
  }

  async refreshServiceRegistry(): Promise<void> {
    try {
      // Clear local registry
      this.registry.clear();

      // Rediscover all services
      await this.discoverAndRegisterServices();

      this.logger.info('Service registry refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh service registry', { error });
      throw error;
    }
  }

  getRegistry(): Map<string, ServiceRegistration> {
    return this.registry;
  }

  getRegistrySize(): number {
    return this.registry.size;
  }

  isServiceRunning(serviceId: string): boolean {
    const service = this.registry.get(serviceId);
    return service ? service.health.status === 'healthy' : false;
  }

  async getServiceStats(): Promise<any> {
    const services = Array.from(this.registry.values());
    const healthy = services.filter(s => s.health.status === 'healthy').length;
    const unhealthy = services.filter(s => s.health.status === 'unhealthy').length;
    const degraded = services.filter(s => s.health.status === 'degraded').length;

    return {
      total: services.length,
      healthy,
      unhealthy,
      degraded,
      averageResponseTime: services.reduce((sum, s) => sum + s.health.responseTime, 0) / services.length || 0,
      averageCpuUsage: services.reduce((sum, s) => sum + s.health.cpuUsage, 0) / services.length || 0,
      averageMemoryUsage: services.reduce((sum, s) => sum + s.health.memoryUsage, 0) / services.length || 0
    };
  }
}

// Event emitter interface
export interface ServiceDiscoveryEvents {
  serviceRegistered: (service: ServiceRegistration) => void;
  serviceDeregistered: (serviceId: string) => void;
  healthUpdate: (health: HealthStatus) => void;
  started: () => void;
  stopped: () => void;
}

// Extend ServiceDiscovery with EventEmitter functionality
export interface ServiceDiscovery extends NodeJS.EventEmitter {
  on(event: 'serviceRegistered', listener: (service: ServiceRegistration) => void): this;
  on(event: 'serviceDeregistered', listener: (serviceId: string) => void): this;
  on(event: 'healthUpdate', listener: (health: HealthStatus) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'serviceRegistered', service: ServiceRegistration): boolean;
  emit(event: 'serviceDeregistered', serviceId: string): boolean;
  emit(event: 'healthUpdate', health: HealthStatus): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}