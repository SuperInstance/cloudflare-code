/**
 * Agent Coordination Routes
 *
 * Endpoints for agent orchestration using Durable Objects
 */

import type { Context } from 'hono';
import type { Env } from '../types';
import type { ChatRequest } from '../lib/agents/types';
import { orchestrateChat } from '../do/director';

/**
 * Create chat completion using agent orchestration
 */
export async function createAgentOrchestration(c: Context<{ Bindings: Env }>) {
  try {
    const startTime = performance.now();

    // Parse request
    const body = await c.req.json();
    const request: ChatRequest = {
      sessionId: body.sessionId || crypto.randomUUID(),
      userId: body.userId || 'anonymous',
      messages: body.messages || [],
      context: body.context,
      preferences: body.preferences,
    };

    // Validate request
    if (!request.messages || request.messages.length === 0) {
      return c.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Messages array is required',
            requestId: crypto.randomUUID(),
            timestamp: Date.now(),
          },
        },
        400
      );
    }

    // Orchestrate using Director Agent
    const response = await orchestrateChat(c.env, request);

    const totalLatency = performance.now() - startTime;

    return c.json(
      {
        ...response,
        orchestrationOverhead: totalLatency - response.latency,
        totalLatency,
      },
      200
    );
  } catch (error) {
    console.error('Agent orchestration error:', error);

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      },
      500
    );
  }
}

/**
 * Get agent registry status
 */
export async function getAgentRegistryStatus(c: Context<{ Bindings: Env }>) {
  try {
    // Get registry stub
    const registryStub = c.env.AGENT_REGISTRY?.get(
      c.env.AGENT_REGISTRY.idFromName('global-registry')
    );

    if (!registryStub) {
      return c.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Agent registry not available',
            timestamp: Date.now(),
          },
        },
        503
      );
    }

    const response = await registryStub.fetch(
      new Request('https://registry/health', { method: 'GET' })
    );

    if (!response.ok) {
      throw new Error('Registry health check failed');
    }

    const health = await response.json();

    return c.json({
      status: 'healthy',
      agents: health,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Registry status error:', error);

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        },
      },
      500
    );
  }
}

/**
 * Get available agents by type
 */
export async function getAvailableAgents(c: Context<{ Bindings: Env }>) {
  try {
    const type = c.req.param('type') || 'director';

    // Get registry stub
    const registryStub = c.env.AGENT_REGISTRY?.get(
      c.env.AGENT_REGISTRY.idFromName('global-registry')
    );

    if (!registryStub) {
      return c.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Agent registry not available',
            timestamp: Date.now(),
          },
        },
        503
      );
    }

    const response = await registryStub.fetch(
      new Request(`https://registry/agents?type=${type}`, { method: 'GET' })
    );

    if (!response.ok) {
      throw new Error('Failed to get agents');
    }

    const data = await response.json() as { agents: unknown[]; count: number };

    return c.json({
      type,
      agents: data.agents,
      count: data.count,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Get agents error:', error);

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        },
      },
      500
    );
  }
}
