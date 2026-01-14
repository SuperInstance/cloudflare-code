/**
 * Debug Session Durable Object
 *
 * Manages interactive debugging sessions with state persistence.
 * Features:
 * - Breakpoint management
 * - Variable inspection
 * - Step-through debugging
 * - Session persistence
 * - Collaborative debugging
 *
 * Uses Cloudflare Durable Objects for:
 * - Consistent session state
 * - Real-time collaboration
 * - Long-lived debugging sessions
 */

import type {
  DebugSession,
  DebugSessionState,
  Breakpoint,
  Variable,
  ErrorInfo,
  StackTrace,
  CorrelatedLog,
  LogTimeline,
  SessionAnalysis,
  SessionMetadata,
  CreateDebugSessionRequest,
  UpdateDebugSessionRequest,
  QueryDebugSessionsRequest,
} from './types';
import { DebugSessionState as SessionState } from './types';
import type { DurableObjectStorage } from '@cloudflare/workers-types';

// ============================================================================
// DEBUG SESSION DURABLE OBJECT
// ============================================================================

export interface DebugSessionDOState {
  session: DebugSession;
}

export class DebugSessionDO {
  private state: DurableObjectState;
  private env: any;
  private session?: DebugSession;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (true) {
        case request.method === 'GET' && path === '/':
          return this.getSession();

        case request.method === 'POST' && path === '/create':
          return this.createSession(await request.json());

        case request.method === 'PUT' && path === '/update':
          return this.updateSession(await request.json());

        case request.method === 'POST' && path === '/breakpoint':
          return this.addBreakpoint(await request.json());

        case request.method === 'DELETE' && path.startsWith('/breakpoint/'):
          const bpId = path.split('/')[2];
          return this.removeBreakpoint(bpId);

        case request.method === 'POST' && path === '/variables':
          return this.setVariables(await request.json());

        case request.method === 'POST' && path === '/pause':
          return this.pauseSession();

        case request.method === 'POST' && path === '/resume':
          return this.resumeSession();

        case request.method === 'POST' && path === '/complete':
          return this.completeSession();

        case request.method === 'POST' && path === '/analyze':
          return this.analyzeSession();

        case request.method === 'GET' && path === '/export':
          return this.exportSession();

        case request.method === 'DELETE' && path === '/':
          return this.deleteSession();

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Get current session
   */
  private async getSession(): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    return new Response(JSON.stringify(this.session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Create a new debug session
   */
  private async createSession(request: CreateDebugSessionRequest): Promise<Response> {
    const session: DebugSession = {
      sessionId: this.generateSessionId(),
      state: SessionState.INITIALIZING,
      error: request.error,
      stackTrace: request.stackTrace ? JSON.parse(request.stackTrace) : undefined,
      logs: [],
      breakpoints: [],
      variables: new Map(),
      analysis: {
        rootCause: undefined,
        similarErrors: [],
        suggestions: [],
        performance: undefined,
        anomalies: [],
        codeContext: undefined,
      },
      metadata: {
        userId: request.metadata.userId,
        environment: request.metadata.environment || 'development',
        version: request.metadata.version || '1.0.0',
        tags: request.metadata.tags || [],
        notes: request.metadata.notes || [],
        sharing: {
          shared: false,
          sharedWith: [],
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.session = session;
    await this.saveSession();

    // Transition to active state
    session.state = SessionState.ACTIVE;
    await this.saveSession();

    return new Response(JSON.stringify(session), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Update session
   */
  private async updateSession(request: UpdateDebugSessionRequest): Promise<Response> {
    await this.loadSession();

    if (!this.session || this.session.sessionId !== request.sessionId) {
      return new Response('Session not found', { status: 404 });
    }

    // Apply updates
    if (request.updates.state) {
      this.session.state = request.updates.state;
    }

    if (request.updates.stackTrace) {
      this.session.stackTrace = request.updates.stackTrace;
    }

    if (request.updates.logs) {
      this.session.logs = request.updates.logs;
    }

    if (request.updates.analysis) {
      this.session.analysis = {
        ...this.session.analysis,
        ...request.updates.analysis,
      };
    }

    if (request.updates.metadata) {
      this.session.metadata = {
        ...this.session.metadata,
        ...request.updates.metadata,
      };
    }

    this.session.updatedAt = Date.now();
    await this.saveSession();

    return new Response(JSON.stringify(this.session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Add breakpoint
   */
  private async addBreakpoint(request: {
    filePath: string;
    lineNumber: number;
    condition?: string;
  }): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    const breakpoint: Breakpoint = {
      breakpointId: this.generateBreakpointId(),
      filePath: request.filePath,
      lineNumber: request.lineNumber,
      condition: request.condition,
      enabled: true,
      hitCount: 0,
      timestamp: Date.now(),
    };

    this.session.breakpoints.push(breakpoint);
    this.session.updatedAt = Date.now();
    await this.saveSession();

    return new Response(JSON.stringify(breakpoint), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Remove breakpoint
   */
  private async removeBreakpoint(breakpointId: string): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    this.session.breakpoints = this.session.breakpoints.filter(
      bp => bp.breakpointId !== breakpointId
    );

    this.session.updatedAt = Date.now();
    await this.saveSession();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Set variables
   */
  private async setVariables(request: {
    variables: Record<string, Variable>;
  }): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    for (const [name, variable] of Object.entries(request.variables)) {
      this.session.variables.set(name, variable);
    }

    this.session.updatedAt = Date.now();
    await this.saveSession();

    return new Response(
      JSON.stringify({
        count: Object.keys(request.variables).length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Pause session
   */
  private async pauseSession(): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    this.session.state = SessionState.PAUSED;
    this.session.updatedAt = Date.now();
    await this.saveSession();

    return new Response(JSON.stringify(this.session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Resume session
   */
  private async resumeSession(): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    this.session.state = SessionState.ACTIVE;
    this.session.updatedAt = Date.now();
    await this.saveSession();

    return new Response(JSON.stringify(this.session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Complete session
   */
  private async completeSession(): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    this.session.state = SessionState.COMPLETED;
    this.session.updatedAt = Date.now();
    await this.saveSession();

    return new Response(JSON.stringify(this.session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Analyze session (trigger analysis)
   */
  private async analyzeSession(): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    this.session.state = SessionState.ANALYZING;
    await this.saveSession();

    // Trigger background analysis
    // In a real implementation, this would call the analyzer
    // For now, we'll just mark it as done

    this.session.state = SessionState.ACTIVE;
    this.session.updatedAt = Date.now();
    await this.saveSession();

    return new Response(JSON.stringify({ analyzing: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Export session
   */
  private async exportSession(): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    const exportData = {
      version: '1.0.0',
      exportedAt: Date.now(),
      session: this.session,
      related: {
        logs: this.session.logs,
      },
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="debug-session-${this.session.sessionId}.json"`,
      },
    });
  }

  /**
   * Delete session
   */
  private async deleteSession(): Promise<Response> {
    await this.loadSession();

    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }

    await this.state.storage.deleteAll();
    this.session = undefined;

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Load session from storage
   */
  private async loadSession(): Promise<void> {
    if (this.session) {
      return; // Already loaded
    }

    const data = await this.state.storage.get<DebugSession>('session');
    if (data) {
      this.session = data;
    }
  }

  /**
   * Save session to storage
   */
  private async saveSession(): Promise<void> {
    if (!this.session) {
      return;
    }

    await this.state.storage.put('session', this.session);

    // Set alarm for automatic cleanup (24 hours)
    await this.state.storage.setAlarm(
      Date.now() + 24 * 60 * 60 * 1000,
      async () => {
        await this.state.storage.deleteAll();
      }
    );
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate breakpoint ID
   */
  private generateBreakpointId(): string {
    return `bp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// SESSION MANAGER
// ============================================================================

export class DebugSessionManager {
  private env: any;

  constructor(env: any) {
    this.env = env;
  }

  /**
   * Get or create session DO
   */
  async getSessionDO(sessionId: string): Promise<DebugSessionDO> {
    const id = this.env.DEBUG_SESSION_DO.idFromName(sessionId);
    const stub = this.env.DEBUG_SESSION_DO.get(id);
    return stub as unknown as DebugSessionDO;
  }

  /**
   * Create a new session
   */
  async createSession(request: CreateDebugSessionRequest): Promise<DebugSession> {
    const sessionId = this.generateSessionId();
    const sessionDO = await this.getSessionDO(sessionId);

    const response = await sessionDO.fetch(
      new Request('https://session/create', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<DebugSession | null> {
    try {
      const sessionDO = await this.getSessionDO(sessionId);
      const response = await sessionDO.fetch(
        new Request('https://session/', { method: 'GET' })
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Query sessions
   */
  async querySessions(request: QueryDebugSessionsRequest): Promise<{
    sessions: DebugSession[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    // In a real implementation, this would query a database
    // For now, return empty result
    return {
      sessions: [],
      total: 0,
      page: request.pagination?.page || 1,
      pageSize: request.pagination?.pageSize || 10,
    };
  }

  /**
   * Update session
   */
  async updateSession(request: UpdateDebugSessionRequest): Promise<DebugSession> {
    const sessionDO = await this.getSessionDO(request.sessionId);

    const response = await sessionDO.fetch(
      new Request('https://session/update', {
        method: 'PUT',
        body: JSON.stringify(request),
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to update session: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessionDO = await this.getSessionDO(sessionId);
      const response = await sessionDO.fetch(
        new Request('https://session/', { method: 'DELETE' })
      );

      return response.ok;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a debug session manager
 */
export function createDebugSessionManager(env: any): DebugSessionManager {
  return new DebugSessionManager(env);
}
