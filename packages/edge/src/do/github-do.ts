/**
 * GitHub Durable Object
 *
 * Manages GitHub sessions, tokens, and state
 * Provides coordinated access to GitHub API with rate limiting and caching
 */

import { GitHubClient, createGitHubClient } from '../lib/github';
import type { GitHubAppConfig } from '../lib/github';
import type { Env } from '../types';

/**
 * GitHub Session State
 */
interface GitHubSessionState {
  installationId?: number;
  token?: string;
  tokenExpiresAt?: number;
  lastUsedAt?: number;
  requestCount: number;
  rateLimitInfo?: {
    core: { limit: number; remaining: number; reset: number };
    search: { limit: number; remaining: number; reset: number };
  };
}

/**
 * GitHub Durable Object
 *
 * Manages stateful GitHub operations including:
 * - Installation token lifecycle
 * - Rate limiting tracking
 * - Request caching
 * - Session coordination
 */
export class GitHubDurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<string, GitHubSessionState>;
  private client?: GitHubClient;
  private config?: GitHubAppConfig;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Get session endpoint
      if (path.startsWith('/session/') && request.method === 'GET') {
        const sessionId = path.split('/')[2];
        if (!sessionId) return new Response('Invalid session ID', { status: 400 });
        return this.getSession(sessionId);
      }

      // Create session endpoint
      if (path.startsWith('/session/') && request.method === 'POST') {
        const sessionId = path.split('/')[2];
        if (!sessionId) return new Response('Invalid session ID', { status: 400 });
        const body = await request.json() as { installationId: number };
        return this.createSession(sessionId, body.installationId);
      }

      // Delete session endpoint
      if (path.startsWith('/session/') && request.method === 'DELETE') {
        const sessionId = path.split('/')[2];
        if (!sessionId) return new Response('Invalid session ID', { status: 400 });
        return this.deleteSession(sessionId);
      }

      // Execute GitHub API call
      if (path.startsWith('/api/') && request.method === 'POST') {
        const sessionId = path.split('/')[2];
        if (!sessionId) return new Response('Invalid session ID', { status: 400 });
        const body = await request.json();
        return this.executeApiCall(sessionId, body);
      }

      // Get rate limit info
      if (path === '/rate-limit' && request.method === 'GET') {
        return this.getRateLimitInfo();
      }

      // Clear expired sessions
      if (path === '/cleanup' && request.method === 'POST') {
        return this.cleanupSessions();
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }

  /**
   * Get or create GitHub session
   */
  private async getSession(sessionId: string): Promise<Response> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      // Try to load from storage
      const stored = await this.state.storage.get<GitHubSessionState>(`session:${sessionId}`);
      if (stored) {
        this.sessions.set(sessionId, stored);
        session = stored;
      }
    }

    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    return Response.json(session);
  }

  /**
   * Create new GitHub session
   */
  private async createSession(sessionId: string, installationId: number): Promise<Response> {
    // Initialize config if not already done
    if (!this.config) {
      const config: GitHubAppConfig = {
        appId: parseInt(this.env.GITHUB_APP_ID || '0', 10),
        privateKey: this.env.GITHUB_PRIVATE_KEY || '',
      };

      if (this.env.GITHUB_WEBHOOK_SECRET !== undefined) {
        config.webhookSecret = this.env.GITHUB_WEBHOOK_SECRET;
      }

      if (!config.appId || !config.privateKey) {
        throw new Error('GitHub App credentials not configured');
      }

      this.config = config;
    }

    // Initialize client if not already done
    if (!this.client) {
      this.client = createGitHubClient(this.config);
    }

    // Set installation
    await this.client.setInstallation(installationId);

    // Create session
    const session: GitHubSessionState = {
      installationId,
      requestCount: 0,
      lastUsedAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    await this.state.storage.put(`session:${sessionId}`, session);

    return Response.json(session);
  }

  /**
   * Delete GitHub session
   */
  private async deleteSession(sessionId: string): Promise<Response> {
    this.sessions.delete(sessionId);
    await this.state.storage.delete(`session:${sessionId}`);

    return new Response('Deleted', { status: 204 });
  }

  /**
   * Execute GitHub API call
   */
  private async executeApiCall(sessionId: string, body: {
    endpoint: string;
    options?: {
      method?: string;
      body?: unknown;
      query?: Record<string, string | number>;
    };
  }): Promise<Response> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    if (!this.client) {
      return new Response('Client not initialized', { status: 500 });
    }

    // Update session
    session.requestCount++;
    session.lastUsedAt = Date.now();

    // Execute API call
    try {
      const result = await this.client.request(body.endpoint, body.options);

      // Update rate limit info from client
      const coreLimit = this.client.getCurrentRateLimit('core');
      const searchLimit = this.client.getCurrentRateLimit('search');

      session.rateLimitInfo = {
        core: {
          limit: coreLimit.limit,
          remaining: coreLimit.remaining,
          reset: coreLimit.reset,
        },
        search: {
          limit: searchLimit.limit,
          remaining: searchLimit.remaining,
          reset: searchLimit.reset,
        },
      };

      // Persist session
      await this.state.storage.put(`session:${sessionId}`, session);

      return Response.json({
        success: true,
        data: result,
        rateLimit: session.rateLimitInfo,
      });
    } catch (error) {
      return Response.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  }

  /**
   * Get rate limit info
   */
  private async getRateLimitInfo(): Promise<Response> {
    if (!this.client) {
      return new Response('Client not initialized', { status: 500 });
    }

    const core = this.client.getCurrentRateLimit('core');
    const search = this.client.getCurrentRateLimit('search');

    return Response.json({
      core: {
        limit: core.limit,
        remaining: core.remaining,
        reset: core.reset,
      },
      search: {
        limit: search.limit,
        remaining: search.remaining,
        reset: search.reset,
      },
    });
  }

  /**
   * Cleanup expired sessions
   */
  private async cleanupSessions(): Promise<Response> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      // Remove sessions not used in the last hour
      if (session.lastUsedAt && now - session.lastUsedAt > 3600000) {
        expiredSessions.push(sessionId);
        this.sessions.delete(sessionId);
        await this.state.storage.delete(`session:${sessionId}`);
      }
    }

    return Response.json({
      expired: expiredSessions.length,
      sessions: expiredSessions,
    });
  }

  /**
   * Handle alarm for periodic cleanup
   */
  async alarm(): Promise<void> {
    await this.cleanupSessions();
  }
}
