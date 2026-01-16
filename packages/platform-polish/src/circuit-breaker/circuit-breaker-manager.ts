// @ts-nocheck
import { EventEmitter } from 'events';
import * as CircuitBreaker from 'circuit-breaker-js';
import { ServiceConfig } from '../types';
import { Logger } from '../utils/logger';

export interface CircuitBreakerState {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successCount: number;
  lastFailure: Date | null;
  resetTimeout: number;
  timeout: number;
  halfOpenMaxRequests: number;
  windowSize: number;
  windowType: 'count' | 'percentage';
}

export class CircuitBreakerManager extends EventEmitter {
  private logger: Logger;
  private breakers: Map<string, CircuitBreaker> = new Map();
  private circuitBreakerStats: Map<string, CircuitBreakerState> = new Map();
  private isRunning = false;

  constructor(private config: any) {
    super();
    this.logger = new Logger('CircuitBreakerManager');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Circuit Breaker Manager is already running');
    }

    this.logger.info('Starting Circuit Breaker Manager...');

    try {
      // Initialize circuit breakers for all services
      for (const serviceConfig of this.config.services) {
        await this.initializeCircuitBreaker(serviceConfig);
      }

      this.isRunning = true;
      this.logger.info('Circuit Breaker Manager started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Circuit Breaker Manager', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Circuit Breaker Manager...');

    try {
      // Stop all circuit breakers
      for (const [serviceName, breaker] of this.breakers) {
        breaker.forceClose();
        this.breakers.delete(serviceName);
      }

      this.circuitBreakerStats.clear();
      this.isRunning = false;
      this.logger.info('Circuit Breaker Manager stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Circuit Breaker Manager shutdown', { error });
      throw error;
    }
  }

  async execute<T>(serviceName: string, operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const breaker = this.breakers.get(serviceName);
    if (!breaker) {
      this.logger.warn(`No circuit breaker found for service: ${serviceName}`);
      if (fallback) {
        return fallback();
      }
      throw new Error(`Circuit breaker not found for service: ${serviceName}`);
    }

    try {
      const result = await breaker.execute(operation);

      // Update success stats
      this.recordSuccess(serviceName);
      this.logger.debug(`Circuit breaker success for service: ${serviceName}`);

      return result;
    } catch (error) {
      this.logger.error(`Circuit breaker failure for service: ${serviceName}`, { error });

      // Update failure stats
      this.recordFailure(serviceName);

      // Execute fallback if provided
      if (fallback) {
        try {
          return await fallback();
        } catch (fallbackError) {
          this.logger.error(`Fallback also failed for service: ${serviceName}`, { error: fallbackError });
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  async forceOpen(serviceName: string): Promise<void> {
    const breaker = this.breakers.get(serviceName);
    if (!breaker) {
      throw new Error(`Circuit breaker not found for service: ${serviceName}`);
    }

    breaker.forceOpen();
    this.logger.warn(`Forced OPEN state for service: ${serviceName}`);
    this.emit('stateChange', { service: serviceName, state: 'OPEN' });
  }

  async forceClose(serviceName: string): Promise<void> {
    const breaker = this.breakers.get(serviceName);
    if (!breaker) {
      throw new Error(`Circuit breaker not found for service: ${serviceName}`);
    }

    breaker.forceClose();
    this.logger.info(`Forced CLOSED state for service: ${serviceName}`);
    this.emit('stateChange', { service: serviceName, state: 'CLOSED' });
  }

  async setState(serviceName: string, state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): Promise<void> {
    const breaker = this.breakers.get(serviceName);
    if (!breaker) {
      throw new Error(`Circuit breaker not found for service: ${serviceName}`);
    }

    switch (state) {
      case 'CLOSED':
        breaker.forceClose();
        break;
      case 'OPEN':
        breaker.forceOpen();
        break;
      case 'HALF_OPEN':
        breaker.reset();
        break;
    }

    this.logger.info(`Set circuit breaker state for ${serviceName} to ${state}`);
    this.emit('stateChange', { service: serviceName, state });
  }

  getState(serviceName: string): CircuitBreakerState | null {
    return this.circuitBreakerStats.get(serviceName) || null;
  }

  getAllStates(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakerStats.values());
  }

  async recordSuccess(serviceName: string): Promise<void> {
    const state = this.circuitBreakerStats.get(serviceName);
    if (state) {
      state.successCount++;
      this.circuitBreakerStats.set(serviceName, state);
    }
  }

  async recordFailure(serviceName: string): Promise<void> {
    const state = this.circuitBreakerStats.get(serviceName);
    if (state) {
      state.failures++;
      state.lastFailure = new Date();

      // Check if we should open the circuit
      if (shouldOpenCircuit(state)) {
        const breaker = this.breakers.get(serviceName);
        if (breaker) {
          breaker.forceOpen();
          this.logger.warn(`Opening circuit for service: ${serviceName}`);
          this.emit('stateChange', { service: serviceName, state: 'OPEN' });
        }
      }

      this.circuitBreakerStats.set(serviceName, state);
    }
  }

  private async initializeCircuitBreaker(serviceConfig: ServiceConfig): Promise<void> {
    if (!serviceConfig.circuitBreaker?.enabled) {
      return;
    }

    const config = serviceConfig.circuitBreaker;

    // Create custom circuit breaker with sliding window
    const breaker = new CircuitBreaker({
      timeout: config.timeout,
      errorThreshold: config.threshold,
      resetTimeout: config.resetTimeout,
      name: serviceConfig.name
    });

    // Configure sliding window
    breaker.slidingWindowSize = config.slidingWindowSize;
    breaker.slidingWindowType = config.slidingWindowType;
    breaker.halfOpenMaxRequests = config.halfOpenRequests;

    // Event listeners
    breaker.on('open', () => {
      this.logger.warn(`Circuit opened for service: ${serviceConfig.name}`);
      this.emit('stateChange', {
        service: serviceConfig.name,
        state: 'OPEN'
      });
    });

    breaker.on('halfOpen', () => {
      this.logger.info(`Circuit half-open for service: ${serviceConfig.name}`);
      this.emit('stateChange', {
        service: serviceConfig.name,
        state: 'HALF_OPEN'
      });
    });

    breaker.on('close', () => {
      this.logger.info(`Circuit closed for service: ${serviceConfig.name}`);
      this.emit('stateChange', {
        service: serviceConfig.name,
        state: 'CLOSED'
      });
    });

    // Initialize state
    const initialState: CircuitBreakerState = {
      name: serviceConfig.name,
      state: 'CLOSED',
      failures: 0,
      successCount: 0,
      lastFailure: null,
      resetTimeout: config.resetTimeout,
      timeout: config.timeout,
      halfOpenMaxRequests: config.halfOpenRequests,
      windowSize: config.slidingWindowSize,
      windowType: config.slidingWindowType
    };

    this.breakers.set(serviceConfig.name, breaker);
    this.circuitBreakerStats.set(serviceConfig.name, initialState);
    this.logger.debug(`Initialized circuit breaker for service: ${serviceConfig.name}`);
  }

  async refreshConfig(serviceConfig: ServiceConfig): Promise<void> {
    const existingBreaker = this.breakers.get(serviceConfig.name);

    if (existingBreaker) {
      // Remove existing breaker
      existingBreaker.forceClose();
      this.breakers.delete(serviceConfig.name);
      this.circuitBreakerStats.delete(serviceConfig.name);
    }

    // Initialize new breaker
    await this.initializeCircuitBreaker(serviceConfig);
    this.logger.info(`Refreshed circuit breaker configuration for service: ${serviceConfig.name}`);
  }

  async getStats(): Promise<any> {
    const stats: any = {
      totalServices: this.breakers.size,
      breakdown: {
        closed: 0,
        open: 0,
        halfOpen: 0
      },
      services: {} as Record<string, any>
    };

    for (const [serviceName, state] of this.circuitBreakerStats) {
      stats.breakdown[state.state.toLowerCase() as 'closed' | 'open' | 'half-open']++;

      stats.services[serviceName] = {
        state: state.state,
        failures: state.failures,
        successes: state.successCount,
        lastFailure: state.lastFailure,
        uptime: this.calculateUptime(serviceName)
      };
    }

    return stats;
  }

  private calculateUptime(serviceName: string): number {
    const state = this.circuitBreakerStats.get(serviceName);
    if (!state || !state.lastFailure) {
      return process.uptime();
    }

    return Math.floor(process.uptime() - (Date.now() - state.lastFailure.getTime()) / 1000);
  }
}

function shouldOpenCircuit(state: CircuitBreakerState): boolean {
  if (state.windowType === 'count') {
    return state.failures >= state.windowSize;
  } else {
    // For percentage, we'd need total requests
    // For now, use a simplified approach
    return state.failures >= state.windowSize * 0.5;
  }
}

// Simple Circuit Breaker implementation
class SimpleCircuitBreaker {
  private failures = 0;
  private successCount = 0;
  private lastFailure: Date | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    public config: {
      timeout: number;
      errorThreshold: number;
      resetTimeout: number;
      slidingWindowSize: number;
      slidingWindowType: 'count' | 'percentage';
      halfOpenMaxRequests: number;
    },
    public name: string
  ) {
    this.setupTimeout();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new Error(`Circuit breaker is OPEN for service: ${this.name}`);
    }

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), this.config.timeout)
        )
      ]);

      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  forceOpen(): void {
    this.state = 'OPEN';
    this.failures = 0;
    this.setupTimeout();
  }

  forceClose(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailure = null;
  }

  reset(): void {
    this.state = 'HALF_OPEN';
    this.failures = 0;
    this.successCount = 0;
    this.setupTimeout();
  }

  private recordSuccess(): void {
    this.successCount++;

    if (this.state === 'HALF_OPEN' && this.successCount >= this.config.halfOpenMaxRequests) {
      this.forceClose();
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.failures >= this.config.errorThreshold) {
      this.forceOpen();
    }
  }

  private setupTimeout(): void {
    if (this.state === 'OPEN') {
      setTimeout(() => {
        this.reset();
      }, this.config.resetTimeout);
    }
  }
}

// Event emitter interface
export interface CircuitBreakerManagerEvents {
  stateChange: (event: { service: string; state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }) => void;
  started: () => void;
  stopped: () => void;
}

// Extend CircuitBreakerManager with EventEmitter functionality
export interface CircuitBreakerManager extends NodeJS.EventEmitter {
  on(event: 'stateChange', listener: (event: { service: string; state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'stateChange', event: { service: string; state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}