// @ts-nocheck
/**
 * Circuit Breaker Store Durable Object
 * Persistent storage for circuit breaker state across instances
 */

import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
  ServiceEventType
} from '../types';

interface CircuitBreakerEntry {
  serviceName: string;
  config: CircuitBreakerConfig;
  state: CircuitBreakerState;
  lastUpdated: number;
}

interface CircuitBreakerHistory {
  serviceName: string;
  stateTransitions: Array<{
    from: CircuitState;
    to: CircuitState;
    timestamp: number;
    reason?: string;
  }>;
  failureCounts: Array<{
    timestamp: number;
    count: number;
  }>;
  recoveryTimes: Array<{
    openedAt: number;
    closedAt: number;
    duration: number;
  }>;
}

export class CircuitBreakerStore {
  private state: DurableObjectStorage;
  private env: any;
  private ctx: ExecutionContext;

  constructor(state: DurableObjectStorage, env: any) {
    this.state = state;
    this.env = env;
    this.ctx = env.ctx;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (true) {
        case path === '/get' && request.method === 'GET':
          return this.handleGet(url);

        case path === '/set' && request.method === 'POST':
          return this.handleSet(request);

        case path === '/update' && request.method === 'POST':
          return this.handleUpdate(request);

        case path === '/reset' && request.method === 'POST':
          return this.handleReset(request);

        case path === '/list' && request.method === 'GET':
          return this.handleList();

        case path === '/history' && request.method === 'GET':
          return this.handleHistory(url);

        case path === '/config' && request.method === 'GET':
          return this.handleGetConfig(url);

        case path === '/config' && request.method === 'PUT':
          return this.handleSetConfig(request);

        case path === '/aggregate' && request.method === 'GET':
          return this.handleAggregate(url);

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Get circuit breaker state for a service
   */
  private async handleGet(url: URL): Promise<Response> {
    const serviceName = url.searchParams.get('serviceName');

    if (!serviceName) {
      return new Response(
        JSON.stringify({ error: 'serviceName is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entry = await this.state.get<CircuitBreakerEntry>(`circuit:${serviceName}`);

    if (!entry) {
      return new Response(
        JSON.stringify({ error: 'Circuit breaker not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(entry),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Create or update circuit breaker entry
   */
  private async handleSet(request: Request): Promise<Response> {
    const entry: CircuitBreakerEntry = await request.json();

    if (!entry.serviceName || !entry.config || !entry.state) {
      return new Response(
        JSON.stringify({ error: 'Invalid circuit breaker entry' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    entry.lastUpdated = Date.now();
    await this.state.put(`circuit:${entry.serviceName}`, entry);

    // Record state transition if this is a new entry
    const existing = await this.state.get<CircuitBreakerEntry>(`circuit:${entry.serviceName}`);
    if (!existing) {
      await this.recordStateTransition(entry.serviceName, CircuitState.CLOSED, entry.state.state, 'Initial state');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Update circuit breaker state
   */
  private async handleUpdate(request: Request): Promise<Response> {
    const { serviceName, state } = await request.json();

    if (!serviceName || !state) {
      return new Response(
        JSON.stringify({ error: 'serviceName and state are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entry = await this.state.get<CircuitBreakerEntry>(`circuit:${serviceName}`);

    if (!entry) {
      return new Response(
        JSON.stringify({ error: 'Circuit breaker not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Record state transition
    if (entry.state.state !== state.state) {
      await this.recordStateTransition(serviceName, entry.state.state, state.state);

      // Track recovery time if closing
      if (state.state === CircuitState.CLOSED && entry.state.state === CircuitState.OPEN) {
        await this.recordRecoveryTime(serviceName, entry.state.lastStateChange, Date.now());
      }
    }

    entry.state = state;
    entry.lastUpdated = Date.now();

    await this.state.put(`circuit:${serviceName}`, entry);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Reset circuit breaker state
   */
  private async handleReset(request: Request): Promise<Response> {
    const { serviceName } = await request.json();

    if (!serviceName) {
      return new Response(
        JSON.stringify({ error: 'serviceName is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entry = await this.state.get<CircuitBreakerEntry>(`circuit:${serviceName}`);

    if (!entry) {
      return new Response(
        JSON.stringify({ error: 'Circuit breaker not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const oldState = entry.state.state;

    // Reset to closed state
    entry.state = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now(),
      nextAttemptTime: 0,
      rollingStats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rejectedRequests: 0,
        timeouts: 0,
        latencies: []
      }
    };

    entry.lastUpdated = Date.now();

    await this.state.put(`circuit:${serviceName}`, entry);
    await this.recordStateTransition(serviceName, oldState, CircuitState.CLOSED, 'Manual reset');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * List all circuit breakers
   */
  private async handleList(): Promise<Response> {
    const entries = await this.state.list<CircuitBreakerEntry>({ prefix: 'circuit:' });
    const circuitBreakers: CircuitBreakerEntry[] = [];

    for (const key of entries.keys) {
      const entry = await this.state.get<CircuitBreakerEntry>(key.name);
      if (entry) {
        circuitBreakers.push(entry);
      }
    }

    // Group by state
    const summary = {
      total: circuitBreakers.length,
      closed: circuitBreakers.filter(c => c.state.state === CircuitState.CLOSED).length,
      open: circuitBreakers.filter(c => c.state.state === CircuitState.OPEN).length,
      halfOpen: circuitBreakers.filter(c => c.state.state === CircuitState.HALF_OPEN).length,
      circuitBreakers: circuitBreakers.map(c => ({
        serviceName: c.serviceName,
        state: c.state.state,
        failureCount: c.state.failureCount,
        lastUpdated: c.lastUpdated
      }))
    };

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get circuit breaker history
   */
  private async handleHistory(url: URL): Promise<Response> {
    const serviceName = url.searchParams.get('serviceName');

    if (!serviceName) {
      return new Response(
        JSON.stringify({ error: 'serviceName is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const history = await this.state.get<CircuitBreakerHistory>(`history:${serviceName}`);

    if (!history) {
      return new Response(
        JSON.stringify({ error: 'History not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(history),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get circuit breaker configuration
   */
  private async handleGetConfig(url: URL): Promise<Response> {
    const serviceName = url.searchParams.get('serviceName');

    if (!serviceName) {
      return new Response(
        JSON.stringify({ error: 'serviceName is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entry = await this.state.get<CircuitBreakerEntry>(`circuit:${serviceName}`);

    if (!entry) {
      return new Response(
        JSON.stringify({ error: 'Circuit breaker not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(entry.config),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Update circuit breaker configuration
   */
  private async handleSetConfig(request: Request): Promise<Response> {
    const { serviceName, config } = await request.json();

    if (!serviceName || !config) {
      return new Response(
        JSON.stringify({ error: 'serviceName and config are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entry = await this.state.get<CircuitBreakerEntry>(`circuit:${serviceName}`);

    if (!entry) {
      return new Response(
        JSON.stringify({ error: 'Circuit breaker not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    entry.config = { ...entry.config, ...config };
    entry.lastUpdated = Date.now();

    await this.state.put(`circuit:${serviceName}`, entry);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get aggregated statistics
   */
  private async handleAggregate(url: URL): Promise<Response> {
    const timeRange = parseInt(url.searchParams.get('timeRange') || '3600000'); // Default 1 hour

    const entries = await this.state.list<CircuitBreakerEntry>({ prefix: 'circuit:' });
    const stats = {
      totalCircuitBreakers: 0,
      currentStateDistribution: {
        closed: 0,
        open: 0,
        halfOpen: 0
      },
      totalStateTransitions: 0,
      averageRecoveryTime: 0,
      topFailingServices: [] as Array<{ serviceName: string; failureCount: number }>,
      timestamp: Date.now()
    };

    let totalRecoveryTime = 0;
    let recoveryCount = 0;
    const failures: Array<{ serviceName: string; failureCount: number }> = [];

    for (const key of entries.keys) {
      const entry = await this.state.get<CircuitBreakerEntry>(key.name);
      if (entry) {
        stats.totalCircuitBreakers++;

        // Count current states
        switch (entry.state.state) {
          case CircuitState.CLOSED:
            stats.currentStateDistribution.closed++;
            break;
          case CircuitState.OPEN:
            stats.currentStateDistribution.open++;
            break;
          case CircuitState.HALF_OPEN:
            stats.currentStateDistribution.halfOpen++;
            break;
        }

        // Collect failures
        failures.push({
          serviceName: entry.serviceName,
          failureCount: entry.state.failureCount
        });

        // Get history for transitions and recovery times
        const history = await this.state.get<CircuitBreakerHistory>(`history:${entry.serviceName}`);
        if (history) {
          stats.totalStateTransitions += history.stateTransitions.length;

          for (const recovery of history.recoveryTimes) {
            if (Date.now() - recovery.closedAt <= timeRange) {
              totalRecoveryTime += recovery.duration;
              recoveryCount++;
            }
          }
        }
      }
    }

    // Calculate average recovery time
    if (recoveryCount > 0) {
      stats.averageRecoveryTime = totalRecoveryTime / recoveryCount;
    }

    // Sort and get top failing services
    stats.topFailingServices = failures
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 10);

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private async recordStateTransition(
    serviceName: string,
    from: CircuitState,
    to: CircuitState,
    reason?: string
  ): Promise<void> {
    const history = await this.state.get<CircuitBreakerHistory>(`history:${serviceName}`);

    if (!history) {
      // Create new history
      const newHistory: CircuitBreakerHistory = {
        serviceName,
        stateTransitions: [{ from, to, timestamp: Date.now(), reason }],
        failureCounts: [],
        recoveryTimes: []
      };

      await this.state.put(`history:${serviceName}`, newHistory);
    } else {
      // Append to existing history
      history.stateTransitions.push({ from, to, timestamp: Date.now(), reason });

      // Keep only last 1000 transitions
      if (history.stateTransitions.length > 1000) {
        history.stateTransitions = history.stateTransitions.slice(-1000);
      }

      await this.state.put(`history:${serviceName}`, history);
    }
  }

  private async recordRecoveryTime(
    serviceName: string,
    openedAt: number,
    closedAt: number
  ): Promise<void> {
    const history = await this.state.get<CircuitBreakerHistory>(`history:${serviceName}`);

    if (!history) {
      return;
    }

    const duration = closedAt - openedAt;
    history.recoveryTimes.push({ openedAt, closedAt, duration });

    // Keep only last 100 recovery times
    if (history.recoveryTimes.length > 100) {
      history.recoveryTimes = history.recoveryTimes.slice(-100);
    }

    await this.state.put(`history:${serviceName}`, history);
  }

  async alarm() {
    // Periodic cleanup of old history entries
    const entries = await this.state.list({ prefix: 'history:' });
    const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days

    for (const key of entries.keys) {
      const history = await this.state.get<CircuitBreakerHistory>(key.name);

      if (history) {
        // Filter out old transitions
        history.stateTransitions = history.stateTransitions.filter(
          t => t.timestamp > cutoffTime
        );

        // Filter out old recovery times
        history.recoveryTimes = history.recoveryTimes.filter(
          r => r.closedAt > cutoffTime
        );

        await this.state.put(key.name, history);
      }
    }
  }
}
