// @ts-nocheck
import { EventEmitter } from 'events';
import { ServiceRegistration, HealthStatus } from '../types';
import { Logger } from '../utils/logger';
import { sleep } from '../utils/helpers';

export interface FallbackStrategy {
  name: string;
  condition: (context: DegradationContext) => boolean;
  handler: (context: DegradationContext) => Promise<any>;
  priority: number;
  timeout: number;
}

export interface DegradationContext {
  service: string;
  request: any;
  error?: any;
  healthStatus?: HealthStatus;
  attempt: number;
  timestamp: Date;
  metadata?: any;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailure: Date;
}

export class GracefulDegradation extends EventEmitter {
  private logger: Logger;
  private fallbackStrategies: Map<string, FallbackStrategy[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private serviceStatuses: Map<string, HealthStatus> = new Map();
  private degradationThresholds: Map<string, DegradationThresholds> = new Map();
  private isRunning = false;

  constructor() {
    super();
    this.logger = new Logger('GracefulDegradation');

    // Register default fallback strategies
    this.registerDefaultStrategies();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Graceful Degradation is already running');
    }

    this.logger.info('Starting Graceful Degradation...');

    try {
      this.isRunning = true;
      this.logger.info('Graceful Degradation started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Graceful Degradation', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Graceful Degradation...');

    try {
      this.fallbackStrategies.clear();
      this.circuitBreakers.clear();
      this.serviceStatuses.clear();
      this.degradationThresholds.clear();

      this.isRunning = false;
      this.logger.info('Graceful Degradation stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Graceful Degradation shutdown', { error });
      throw error;
    }
  }

  registerFallbackStrategy(serviceName: string, strategy: FallbackStrategy): void {
    if (!this.fallbackStrategies.has(serviceName)) {
      this.fallbackStrategies.set(serviceName, []);
    }

    const strategies = this.fallbackStrategies.get(serviceName)!;
    strategies.push(strategy);

    // Sort by priority
    strategies.sort((a, b) => a.priority - b.priority);

    this.logger.debug(`Registered fallback strategy for service: ${serviceName}`, {
      strategyName: strategy.name,
      priority: strategy.priority
    });
  }

  registerDefaultStrategies(): void {
    // Cache-based fallback
    this.registerFallbackStrategy('*', {
      name: 'cache-fallback',
      condition: (context) => {
        return context.error?.status >= 500 && context.error?.code === 'ECONNREFUSED';
      },
      handler: async (context) => {
        // Implementation would use cache
        this.logger.debug('Using cache fallback for service:', context.service);
        return { message: 'Served from cache', timestamp: new Date() };
      },
      priority: 1,
      timeout: 5000
    });

    // Static response fallback
    this.registerFallbackStrategy('*', {
      name: 'static-response',
      condition: (context) => {
        return context.error?.status >= 500;
      },
      handler: async (context) => {
        this.logger.debug('Using static response fallback for service:', context.service);
        return {
          message: 'Service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE',
          timestamp: new Date()
        };
      },
      priority: 2,
      timeout: 1000
    });

    // Circuit breaker fallback
    this.registerFallbackStrategy('*', {
      name: 'circuit-breaker-fallback',
      condition: (context) => {
        const breaker = this.circuitBreakers.get(context.service);
        return breaker?.isOpen || false;
      },
      handler: async (context) => {
        this.logger.debug('Using circuit breaker fallback for service:', context.service);
        return {
          message: 'Service in maintenance mode',
          code: 'MAINTENANCE_MODE',
          timestamp: new Date()
        };
      },
      priority: 3,
      timeout: 1000
    });

    // Retry with exponential backoff
    this.registerFallbackStrategy('*', {
      name: 'retry-backoff',
      condition: (context) => {
        return context.attempt < 3 &&
               (context.error?.status >= 500 || context.error?.status === 429);
      },
      handler: async (context) => {
        const delay = Math.pow(2, context.attempt) * 1000;
        this.logger.debug(`Retrying after ${delay}ms for service:`, context.service);
        await sleep(delay);
        throw context.error; // Rethrow to trigger retry
      },
      priority: 4,
      timeout: 30000
    });

    // Queue and batch fallback
    this.registerFallbackStrategy('*', {
      name: 'queue-batch',
      condition: (context) => {
        return context.error?.status === 429 ||
               (context.healthStatus && context.healthStatus.errorRate > 20);
      },
      handler: async (context) => {
        this.logger.debug('Using queue/batch fallback for service:', context.service);
        // Implementation would use message queue
        return {
          message: 'Request queued for processing',
          code: 'QUEUED',
          estimatedWaitTime: 5000,
          timestamp: new Date()
        };
      },
      priority: 5,
      timeout: 5000
    });

    // Health check fallback
    this.registerFallbackStrategy('*', {
      name: 'health-check-fallback',
      condition: (context) => {
        const healthStatus = context.healthStatus;
        return healthStatus && healthStatus.status !== 'healthy';
      },
      handler: async (context) => {
        this.logger.debug('Using health check fallback for service:', context.service);
        return {
          message: 'Service health check failed',
          code: 'SERVICE_UNHEALTHY',
          healthStatus: context.healthStatus,
          timestamp: new Date()
        };
      },
      priority: 6,
      timeout: 1000
    });
  }

  async executeWithFallbacks<T>(
    serviceName: string,
    operation: () => Promise<T>,
    context: Partial<DegradationContext> = {}
  ): Promise<T> {
    const fullContext: DegradationContext = {
      service: serviceName,
      request: context.request || {},
      timestamp: new Date(),
      attempt: context.attempt || 0,
      metadata: context.metadata,
      ...context
    };

    try {
      // Check if service is healthy
      const healthStatus = this.serviceStatuses.get(serviceName);
      fullContext.healthStatus = healthStatus;

      // Check circuit breaker state
      const breaker = this.circuitBreaker.get(serviceName);
      if (breaker?.isOpen) {
        fullContext.error = { code: 'CIRCUIT_OPEN', status: 503 };
        return await this.executeFallback(fullContext, operation);
      }

      // Try the main operation
      const result = await operation();

      // On success, reset circuit breaker state
      this.resetCircuitBreaker(serviceName);

      return result;
    } catch (error) {
      fullContext.error = error;

      // Update circuit breaker
      this.recordFailure(serviceName);

      // Try fallback strategies
      return await this.executeFallback(fullContext, operation);
    }
  }

  private async executeFallback<T>(
    context: DegradationContext,
    originalOperation: () => Promise<T>
  ): Promise<T> {
    const strategies = this.fallbackStrategies.get(context.service) ||
                      this.fallbackStrategies.get('*') || [];

    for (const strategy of strategies) {
      try {
        if (strategy.condition(context)) {
          this.logger.debug(`Executing fallback strategy: ${strategy.name} for service: ${context.service}`);

          const result = await Promise.race([
            strategy.handler(context),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Fallback strategy timeout')), strategy.timeout)
            )
          ]);

          this.emit('fallbackUsed', {
            service: context.service,
            strategy: strategy.name,
            context,
            success: true
          });

          return result as T;
        }
      } catch (fallbackError) {
        this.logger.warn(`Fallback strategy failed: ${strategy.name}`, {
          service: context.service,
          error: fallbackError
        });

        this.emit('fallbackUsed', {
          service: context.service,
          strategy: strategy.name,
          context,
          success: false,
          error: fallbackError
        });
      }
    }

    // If no fallback succeeded, try the operation again (for retry strategies)
    if (context.attempt < 3) {
      const retryContext = {
        ...context,
        attempt: context.attempt + 1
      };

      // Find retry strategy
      const retryStrategies = strategies.filter(s => s.name === 'retry-backoff');
      if (retryStrategies.length > 0) {
        return await this.executeFallback(retryContext[0], originalOperation);
      }
    }

    // If all else fails, throw the original error
    throw context.error;
  }

  recordFailure(serviceName: string): void {
    let breaker = this.circuitBreakers.get(serviceName);

    if (!breaker) {
      breaker = {
        isOpen: false,
        failures: 0,
        lastFailure: new Date()
      };
      this.circuitBreakers.set(serviceName, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = new Date();

    // Open circuit if threshold exceeded
    if (breaker.failures >= 5) {
      breaker.isOpen = true;
      this.logger.warn(`Opening circuit breaker for service: ${serviceName}`);

      // Schedule automatic reset
      setTimeout(() => {
        this.resetCircuitBreaker(serviceName);
      }, 60000); // 1 minute timeout
    }
  }

  resetCircuitBreaker(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.isOpen = false;
      breaker.failures = 0;
      this.logger.debug(`Reset circuit breaker for service: ${serviceName}`);
    }
  }

  updateServiceHealth(serviceName: string, healthStatus: HealthStatus): void {
    this.serviceStatuses.set(serviceName, healthStatus);

    // If service recovers, reset circuit breaker
    if (healthStatus.status === 'healthy') {
      this.resetCircuitBreaker(serviceName);
    }
  }

  registerDegradationThreshold(
    serviceName: string,
    thresholds: DegradationThresholds
  ): void {
    this.degradationThresholds.set(serviceName, thresholds);
    this.logger.debug(`Registered degradation thresholds for service: ${serviceName}`, thresholds);
  }

  async degradeService(serviceName: string, reason: string): Promise<void> {
    this.logger.warn(`Degradating service: ${serviceName}`, { reason });

    // Update circuit breaker state
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.isOpen = true;
    }

    this.emit('serviceDegraded', {
      service: serviceName,
      reason,
      timestamp: new Date()
    });
  }

  async recoverService(serviceName: string, reason: string): Promise<void> {
    this.logger.info(`Recovering service: ${serviceName}`, { reason });

    // Reset circuit breaker
    this.resetCircuitBreaker(serviceName);

    this.emit('serviceRecovered', {
      service: serviceName,
      reason,
      timestamp: new Date()
    });
  }

  async getDegradationStats(): Promise<any> {
    const stats = {
      totalStrategies: 0,
      circuitBreakers: {} as Record<string, any>,
      serviceStatuses: {} as Record<string, any>,
      thresholds: {} as Record<string, any>
    };

    // Count fallback strategies
    for (const strategies of this.fallbackStrategies.values()) {
      stats.totalStrategies += strategies.length;
    }

    // Circuit breaker stats
    for (const [serviceName, breaker] of this.circuitBreakers) {
      stats.circuitBreakers[serviceName] = {
        isOpen: breaker.isOpen,
        failures: breaker.failures,
        lastFailure: breaker.lastFailure
      };
    }

    // Service status stats
    for (const [serviceName, status] of this.serviceStatuses) {
      stats.serviceStatuses[serviceName] = status;
    }

    // Degradation thresholds
    for (const [serviceName, thresholds] of this.degradationThresholds) {
      stats.thresholds[serviceName] = thresholds;
    }

    return stats;
  }

  async simulateDegradation(serviceName: string, scenario: string): Promise<void> {
    this.logger.info(`Simulating degradation scenario: ${scenario} for service: ${serviceName}`);

    switch (scenario) {
      case 'high-latency':
        await this.degradeService(serviceName, 'High latency detected');
        break;
      case 'error-spike':
        await this.degradeService(serviceName, 'Error spike detected');
        break;
      case 'service-unavailable':
        await this.degradeService(serviceName, 'Service unavailable');
        break;
      case 'resource-exhaustion':
        await this.degradeService(serviceName, 'Resource exhaustion');
        break;
      case 'network-partition':
        await this.degradeService(serviceName, 'Network partition detected');
        break;
      default:
        throw new Error(`Unknown degradation scenario: ${scenario}`);
    }
  }

  async simulateRecovery(serviceName: string, reason: string = 'Manual recovery'): Promise<void> {
    this.logger.info(`Simulating recovery for service: ${serviceName}`, { reason });
    await this.recoverService(serviceName, reason);
  }
}

export interface DegradationThresholds {
  errorRate: number;
  responseTime: number;
  failureCount: number;
  timeWindow: number; // in milliseconds
}

export class DegradationDetector {
  private logger: Logger;
  private thresholds: Map<string, DegradationThresholds> = new Map();
  private metrics: Map<string, ServiceMetrics> = new Map();
  private detectorInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.logger = new Logger('DegradationDetector');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Degradation Detector is already running');
    }

    this.logger.info('Starting Degradation Detector...');

    try {
      this.isRunning = true;
      this.startMonitoring();

      this.logger.info('Degradation Detector started successfully');
    } catch (error) {
      this.logger.error('Failed to start Degradation Detector', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Degradation Detector...');

    try {
      if (this.detectorInterval) {
        clearInterval(this.detectorInterval);
        this.detectorInterval = null;
      }

      this.isRunning = false;
      this.logger.info('Degradation Detector stopped successfully');
    } catch (error) {
      this.logger.error('Error during Degradation Detector shutdown', { error });
      throw error;
    }
  }

  registerThresholds(serviceName: string, thresholds: DegradationThresholds): void {
    this.thresholds.set(serviceName, thresholds);
    this.logger.debug(`Registered degradation thresholds for service: ${serviceName}`, thresholds);
  }

  recordMetrics(serviceName: string, metrics: Partial<ServiceMetrics>): void {
    if (!this.metrics.has(serviceName)) {
      this.metrics.set(serviceName, {
        requests: 0,
        errors: 0,
        totalTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        lastUpdated: new Date()
      });
    }

    const serviceMetrics = this.metrics.get(serviceName)!;
    serviceMetrics.requests++;
    serviceMetrics.totalTime += metrics.responseTime || 0;

    if (metrics.responseTime) {
      serviceMetrics.minResponseTime = Math.min(serviceMetrics.minResponseTime, metrics.responseTime);
      serviceMetrics.maxResponseTime = Math.max(serviceMetrics.maxResponseTime, metrics.responseTime);
    }

    if (metrics.error) {
      serviceMetrics.errors++;
    }

    serviceMetrics.lastUpdated = new Date();
  }

  private startMonitoring(): void {
    this.detectorInterval = setInterval(() => {
      this.checkForDegradation();
    }, 10000); // Check every 10 seconds
  }

  private async checkForDegradation(): Promise<void> {
    for (const [serviceName, metrics] of this.metrics) {
      const thresholds = this.thresholds.get(serviceName);
      if (!thresholds) {
        continue;
      }

      // Calculate error rate
      const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;

      // Calculate average response time
      const avgResponseTime = metrics.requests > 0 ? metrics.totalTime / metrics.requests : 0;

      let degradationReason: string | null = null;

      if (errorRate > thresholds.errorRate) {
        degradationReason = `Error rate too high: ${errorRate.toFixed(2)}%`;
      } else if (avgResponseTime > thresholds.responseTime) {
        degradationReason = `Response time too high: ${avgResponseTime.toFixed(2)}ms`;
      }

      if (degradationReason) {
        this.emit('degradationDetected', {
          service: serviceName,
          reason: degradationReason,
          metrics: {
            errorRate,
            avgResponseTime,
            requests: metrics.requests,
            errors: metrics.errors
          },
          timestamp: new Date()
        });
      }
    }
  }
}

export interface ServiceMetrics {
  requests: number;
  errors: number;
  totalTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  lastUpdated: Date;
}

// Event emitter interface
export interface GracefulDegradationEvents {
  fallbackUsed: (event: { service: string; strategy: string; context: DegradationContext; success: boolean; error?: any }) => void;
  serviceDegraded: (event: { service: string; reason: string; timestamp: Date }) => void;
  serviceRecovered: (event: { service: string; reason: string; timestamp: Date }) => void;
  started: () => void;
  stopped: () => void;
}

export interface DegradationDetectorEvents {
  degradationDetected: (event: { service: string; reason: string; metrics: any; timestamp: Date }) => void;
  started: () => void;
  stopped: () => void;
}

// Extend GracefulDegradation with EventEmitter functionality
export interface GracefulDegradation extends NodeJS.EventEmitter {
  on(event: 'fallbackUsed', listener: (event: { service: string; strategy: string; context: DegradationContext; success: boolean; error?: any }) => void): this;
  on(event: 'serviceDegraded', listener: (event: { service: string; reason: string; timestamp: Date }) => void): this;
  on(event: 'serviceRecovered', listener: (event: { service: string; reason: string; timestamp: Date }) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'fallbackUsed', event: { service: string; strategy: string; context: DegradationContext; success: boolean; error?: any }): boolean;
  emit(event: 'serviceDegraded', event: { service: string; reason: string; timestamp: Date }): boolean;
  emit(event: 'serviceRecovered', event: { service: string; reason: string; timestamp: Date }): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}

// Extend DegradationDetector with EventEmitter functionality
export interface DegradationDetector extends NodeJS.EventEmitter {
  on(event: 'degradationDetected', listener: (event: { service: string; reason: string; metrics: any; timestamp: Date }) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'degradationDetected', event: { service: string; reason: string; metrics: any; timestamp: Date }): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}