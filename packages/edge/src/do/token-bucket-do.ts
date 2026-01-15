/**
 * Token Bucket Durable Object
 *
 * Distributed state management for token bucket rate limiting.
 * Each DO instance manages the token bucket state for a specific identifier.
 */

import type { TokenBucketState } from '../lib/rate-limit/token-bucket';

export class TokenBucketDO implements DurableObject {
  private state: TokenBucketState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, _env: unknown) {
    this.storage = state.storage;

    // Initialize state from storage or defaults
    this.state = {
      tokens: 0,
      lastRefill: Date.now(),
      capacity: 60,
      refillRate: 1,
    };
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname;

    try {
      switch (action) {
        case '/consume':
          return this.handleConsume(request);
        case '/getState':
          return this.handleGetState();
        case '/reset':
          return this.handleReset();
        case '/getStats':
          return this.handleGetStats();
        default:
          return Response.json({ error: 'Unknown action' }, { status: 400 });
      }
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  /**
   * Initialize the bucket with capacity and refill rate
   */
  async initialize(capacity: number, refillRate: number): Promise<void> {
    // Load existing state or initialize new
    const existingState = await this.storage.get<TokenBucketState>('state');
    if (existingState) {
      this.state = existingState;
      // Update parameters if changed
      this.state.capacity = capacity;
      this.state.refillRate = refillRate;
    } else {
      this.state = {
        tokens: capacity,
        lastRefill: Date.now(),
        capacity,
        refillRate,
      };
      await this.storage.put('state', this.state);
    }
  }

  /**
   * Try to consume tokens
   */
  async consume(tokens: number = 1): Promise<boolean> {
    await this.loadState();
    this.refill();

    if (this.state.tokens >= tokens) {
      this.state.tokens -= tokens;
      await this.saveState();
      return true;
    }

    await this.saveState();
    return false;
  }

  /**
   * Get current state
   */
  async getState(): Promise<TokenBucketState> {
    await this.loadState();
    this.refill();
    await this.saveState();
    return { ...this.state };
  }

  /**
   * Reset the bucket
   */
  async reset(): Promise<void> {
    this.state.tokens = this.state.capacity;
    this.state.lastRefill = Date.now();
    await this.storage.put('state', this.state);
  }

  /**
   * Get bucket statistics
   */
  async getStats(): Promise<TokenBucketState> {
    await this.loadState();
    return { ...this.state };
  }

  /**
   * Handle consume request
   */
  private async handleConsume(request: Request): Promise<Response> {
    const body = await request.json() as { tokens?: number };
    const tokens = body.tokens ?? 1;

    const consumed = await this.consume(tokens);

    return Response.json({
      consumed,
      availableTokens: this.state.tokens,
      capacity: this.state.capacity,
    });
  }

  /**
   * Handle get state request
   */
  private async handleGetState(): Promise<Response> {
    const state = await this.getState();
    return Response.json(state);
  }

  /**
   * Handle reset request
   */
  private async handleReset(): Promise<Response> {
    await this.reset();
    return Response.json({ success: true });
  }

  /**
   * Handle get stats request
   */
  private async handleGetStats(): Promise<Response> {
    const stats = await this.getStats();
    return Response.json(stats);
  }

  /**
   * Load state from storage
   */
  private async loadState(): Promise<void> {
    const stored = await this.storage.get<TokenBucketState>('state');
    if (stored) {
      this.state = stored;
    }
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    await this.storage.put('state', this.state);
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.state.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.state.refillRate;

    this.state.tokens = Math.min(
      this.state.capacity,
      this.state.tokens + tokensToAdd
    );
    this.state.lastRefill = now;
  }

  /**
   * Alarm handler for periodic maintenance
   */
  async alarm(): Promise<void> {
    // Refill tokens and persist
    await this.loadState();
    this.refill();
    await this.saveState();
  }
}
