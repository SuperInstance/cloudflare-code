/**
 * CDN Load Balancer
 *
 * Advanced load balancing across multiple CDN providers.
 */

import { EventEmitter } from 'events';
import type { CDNProvider, IRequestContext } from '../types/index.js';

export interface ILoadBalancerConfig {
  strategy: 'round_robin' | 'weighted' | 'least_connections' | 'ip_hash';
  sessionAffinity?: boolean;
  weights: Map<CDNProvider, number>;
}

export interface IProviderConnections {
  provider: CDNProvider;
  activeConnections: number;
  totalRequests: number;
}

export class CDNLoadBalancer extends EventEmitter {
  private config: ILoadBalancerConfig;
  private connections: Map<CDNProvider, IProviderConnections>;
  private currentIndex: number = 0;
  private sessionMap: Map<string, CDNProvider>;

  constructor(config: ILoadBalancerConfig) {
    super();

    this.config = config;
    this.connections = new Map();
    this.sessionMap = new Map();

    // Initialize connection tracking
    for (const [provider, _weight] of config.weights.entries()) {
      this.connections.set(provider, {
        provider,
        activeConnections: 0,
        totalRequests: 0
      });
    }
  }

  /**
   * Select provider for request
   */
  public select(context: IRequestContext): CDNProvider {
    // Check session affinity
    if (this.config.sessionAffinity) {
      const sessionKey = this.getSessionKey(context);
      const cachedProvider = this.sessionMap.get(sessionKey);

      if (cachedProvider && this.isProviderHealthy(cachedProvider)) {
        return cachedProvider;
      }
    }

    // Select based on strategy
    const provider = this.selectByStrategy(context);

    // Update session map if affinity is enabled
    if (this.config.sessionAffinity) {
      const sessionKey = this.getSessionKey(context);
      this.sessionMap.set(sessionKey, provider);
    }

    // Update connection tracking
    const connections = this.connections.get(provider)!;
    connections.activeConnections++;
    connections.totalRequests++;

    return provider;
  }

  /**
   * Release connection
   */
  public release(provider: CDNProvider): void {
    const connections = this.connections.get(provider);
    if (connections) {
      connections.activeConnections = Math.max(0, connections.activeConnections - 1);
    }
  }

  /**
   * Select by strategy
   */
  private selectByStrategy(context: IRequestContext): CDNProvider {
    const providers = Array.from(this.connections.keys());

    switch (this.config.strategy) {
      case 'round_robin':
        return this.selectRoundRobin(providers);
      case 'weighted':
        return this.selectWeighted(providers);
      case 'least_connections':
        return this.selectLeastConnections(providers);
      case 'ip_hash':
        return this.selectIPHash(providers, context);
      default:
        return providers[0]!;
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(providers: CDNProvider[]): CDNProvider {
    const provider = providers[this.currentIndex % providers.length]!;
    this.currentIndex++;
    return provider;
  }

  /**
   * Weighted selection
   */
  private selectWeighted(providers: CDNProvider[]): CDNProvider {
    const totalWeight = providers.reduce(
      (sum, p) => sum + (this.config.weights.get(p) ?? 1),
      0
    );

    let random = Math.random() * totalWeight;

    for (const provider of providers) {
      random -= this.config.weights.get(provider) ?? 1;
      if (random <= 0) {
        return provider;
      }
    }

    return providers[0]!;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(providers: CDNProvider[]): CDNProvider {
    const sorted = [...providers].sort((a, b) => {
      const connA = this.connections.get(a)!;
      const connB = this.connections.get(b)!;
      return connA.activeConnections - connB.activeConnections;
    });

    return sorted[0]!;
  }

  /**
   * IP hash selection
   */
  private selectIPHash(providers: CDNProvider[], context: IRequestContext): CDNProvider {
    const ip = context.ip ?? '0.0.0.0';
    const hash = this.hashIP(ip);
    return providers[hash % providers.length]!;
  }

  /**
   * Get session key
   */
  private getSessionKey(context: IRequestContext): string {
    // Use IP and user agent for session affinity
    return `${context.ip ?? ''}-${context.userAgent ?? ''}`;
  }

  /**
   * Hash IP address
   */
  private hashIP(ip: string): number {
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      const char = ip.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Check if provider is healthy
   */
  private isProviderHealthy(_provider: CDNProvider): boolean {
    // In a real implementation, you would check actual health status
    return true;
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): Map<CDNProvider, IProviderConnections> {
    return new Map(this.connections.entries());
  }

  /**
   * Reset statistics
   */
  public resetStatistics(): void {
    for (const connections of this.connections.values()) {
      connections.activeConnections = 0;
      connections.totalRequests = 0;
    }

    this.sessionMap.clear();
    this.currentIndex = 0;
  }

  /**
   * Update weights
   */
  public updateWeights(weights: Map<CDNProvider, number>): void {
    this.config.weights = weights;
  }

  /**
   * Update strategy
   */
  public updateStrategy(strategy: ILoadBalancerConfig['strategy']): void {
    this.config.strategy = strategy;
  }

  /**
   * Clear session cache
   */
  public clearSessions(): void {
    this.sessionMap.clear();
  }

  /**
   * Get statistics
   */
  public getStatistics(): {
    totalRequests: number;
    activeConnections: number;
    providers: Array<{
      provider: CDNProvider;
      activeConnections: number;
      totalRequests: number;
      loadPercentage: number;
    }>;
  } {
    const totalRequests = Array.from(this.connections.values())
      .reduce((sum, c) => sum + c.totalRequests, 0);

    const activeConnections = Array.from(this.connections.values())
      .reduce((sum, c) => sum + c.activeConnections, 0);

    return {
      totalRequests,
      activeConnections,
      providers: Array.from(this.connections.values()).map(c => ({
        provider: c.provider,
        activeConnections: c.activeConnections,
        totalRequests: c.totalRequests,
        loadPercentage: totalRequests > 0 ? (c.totalRequests / totalRequests) * 100 : 0
      }))
    };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.connections.clear();
    this.sessionMap.clear();
    this.removeAllListeners();
  }
}

export default CDNLoadBalancer;
