/**
 * Circuit Breaker - Fault tolerance and service protection
 */

import { GatewayRequest, GatewayError } from '../types/index.js';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfigType {
  enabled: boolean;
  defaultThreshold: number;
  defaultResetTimeout: number;
  monitoringEnabled: boolean;
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChange?: number;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfigType;
  private states: Map<string, CircuitBreakerState>;
  private stats: Map<string, CircuitBreakerStats>;

  constructor(config: CircuitBreakerConfigType) {
    this.config = config;
    this.states = new Map();
    this.stats = new Map();
  }

  async check(request: GatewayRequest): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const key = this.getServiceKey(request);
    const state = this.getState(key);

    if (state === 'open') {
      // Check if we should transition to half-open
      const stats = this.getStats(key);
      if (stats.lastFailureTime && Date.now() - stats.lastFailureTime > this.config.defaultResetTimeout) {
        this.setState(key, 'half-open');
      } else {
        throw new GatewayError(
          'Circuit breaker is open',
          'CIRCUIT_BREAKER_OPEN',
          503
        );
      }
    }
  }

  recordSuccess(serviceId: string): void {
    const stats = this.getStats(serviceId);
    stats.successCount++;

    const state = this.getState(serviceId);
    if (state === 'half-open') {
      this.setState(serviceId, 'closed');
    }
  }

  recordFailure(serviceId: string): void {
    const stats = this.getStats(serviceId);
    stats.failureCount++;
    stats.lastFailureTime = Date.now();

    const threshold = this.config.defaultThreshold;
    const totalRequests = stats.successCount + stats.failureCount;
    const failureRate = stats.failureCount / totalRequests;

    if (failureRate >= threshold) {
      this.setState(serviceId, 'open');
    }
  }

  private getServiceKey(request: GatewayRequest): string {
    return `circuit:${request.method}:${request.url}`;
  }

  private getState(key: string): CircuitBreakerState {
    return this.states.get(key) || 'closed';
  }

  private setState(key: string, state: CircuitBreakerState): void {
    this.states.set(key, state);
    const stats = this.getStats(key);
    stats.state = state;
    stats.lastStateChange = Date.now();
  }

  private getStats(key: string): CircuitBreakerStats {
    if (!this.stats.has(key)) {
      this.stats.set(key, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      });
    }
    return this.stats.get(key)!;
  }

  getStats(serviceId: string): CircuitBreakerStats {
    return this.getStats(serviceId);
  }

  reset(serviceId: string): void {
    this.states.set(serviceId, 'closed');
    this.stats.set(serviceId, {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
    });
  }
}
