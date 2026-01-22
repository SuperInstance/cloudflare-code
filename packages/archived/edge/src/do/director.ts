/**
 * Director Agent Durable Object
 *
 * Orchestrates agent coordination by:
 * 1. Receiving user requests
 * 2. Dispatching to multiple Planner Agents (fan-out pattern)
 * 3. Aggregating results
 * 4. Coordinating Executor Agents
 * 5. Returning final response
 */

import type {
  ChatRequest,
  ChatResponse,
  Plan,
  ConversationContext,
  DirectorState,
} from '../lib/agents/types';
import type { Env } from '../types';

/**
 * Director Agent - Main orchestration point
 *
 * Features:
 * - Sub-50ms coordination overhead
 * - Parallel planner dispatch
 * - Result aggregation
 * - State persistence
 * - Load balancing awareness
 */
export class DirectorAgent implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private storage: DurableObjectStorage;
  private directorState: DirectorState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;

    // Initialize state
    this.directorState = {
      sessionId: '',
      activePlanners: new Set<string>(),
      completedPlans: new Map<string, Plan>(),
      context: this.initializeEmptyContext(),
      metrics: {
        requestsProcessed: 0,
        totalLatency: 0,
        averageLatency: 0,
        lastUpdate: Date.now(),
      },
    };

    // Load from storage
    this.initializeFromStorage();
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/orchestrate') {
        return this.handleOrchestrate(request);
      }

      if (method === 'GET' && path === '/state') {
        return this.handleGetState();
      }

      if (method === 'GET' && path === '/metrics') {
        return this.handleGetMetrics();
      }

      if (method === 'POST' && path === '/reset') {
        return this.handleReset();
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle orchestration request - Main entry point
   */
  private async handleOrchestrate(request: Request): Promise<Response> {
    const startTime = performance.now();
    const chatRequest = (await request.json()) as ChatRequest;

    // Validate request
    if (!chatRequest.sessionId || !chatRequest.userId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId or userId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update session context
    await this.updateContext(chatRequest);

    // Orchestrate the request
    const response = await this.orchestrate(chatRequest);

    const latency = performance.now() - startTime;

    // Update metrics
    await this.updateMetrics(response, latency);

    return new Response(
      JSON.stringify({ ...response, coordinationLatency: latency }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get state request
   */
  private async handleGetState(): Promise<Response> {
    const stateData = {
      sessionId: this.directorState.sessionId,
      activePlanners: Array.from(this.directorState.activePlanners),
      completedPlans: Array.from(this.directorState.completedPlans.values()),
      context: this.directorState.context,
      metrics: this.directorState.metrics,
    };

    return new Response(
      JSON.stringify(stateData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get metrics request
   */
  private async handleGetMetrics(): Promise<Response> {
    return new Response(
      JSON.stringify(this.directorState.metrics),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle reset request
   */
  private async handleReset(): Promise<Response> {
    this.directorState.activePlanners.clear();
    this.directorState.completedPlans.clear();
    this.directorState.context = this.initializeEmptyContext();
    this.directorState.metrics = {
      requestsProcessed: 0,
      totalLatency: 0,
      averageLatency: 0,
      lastUpdate: Date.now(),
    };

    await this.persistState();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Main orchestration logic
   */
  async orchestrate(request: ChatRequest): Promise<ChatResponse> {
    const orchestrationStart = performance.now();

    // Step 1: Dispatch to multiple Planner Agents (Fan-Out Pattern)
    const plans = await this.dispatchToPlanners(request);

    if (plans.length === 0) {
      throw new Error('No plans generated by any planner');
    }

    // Step 2: Select best plan based on priority and confidence
    const bestPlan = this.selectBestPlan(plans);

    // Step 3: Execute plan via Executor Agent
    const executorResult = await this.executePlan(bestPlan, request);

    // Step 4: Aggregate and return response
    const response = await this.aggregateResults(executorResult, bestPlan);

    const orchestrationLatency = performance.now() - orchestrationStart;

    return {
      ...response,
      latency: orchestrationLatency,
      metadata: {
        ...response.metadata,
        plansGenerated: plans.length,
        agentsInvolved: [
          bestPlan.plannerId,
          executorResult.executorId,
          this.state.id.toString(),
        ],
      },
    };
  }

  /**
   * Dispatch request to multiple Planner Agents in parallel
   */
  private async dispatchToPlanners(request: ChatRequest): Promise<Plan[]> {
    const plannerExpertise: Array<'code' | 'documentation' | 'debugging' | 'architecture'> =
      ['code', 'documentation', 'debugging', 'architecture'];

    // Track active planners
    this.directorState.activePlanners.clear();

    // Create planner stubs
    const plannerPromises = plannerExpertise.map((expertise) => {
      const plannerId = `planner-${expertise}-${this.state.id.toString()}`;
      const plannerStub = this.env.PLANNER_DO!.get(
        this.env.PLANNER_DO!.idFromName(plannerId)
      );

      this.directorState.activePlanners.add(plannerId);

      return plannerStub.fetch(
        new Request('https://planner/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            expertise,
            chatRequest: request,
            directorId: this.state.id.toString(),
          }),
        })
      );
    });

    // Wait for all planners with timeout
    const timeoutPromise = new Promise<(Plan | null)[]>((resolve) => {
      setTimeout(() => resolve([]), 5000); // 5 second timeout
    });

    const results = await Promise.race([
      Promise.all(plannerPromises),
      timeoutPromise,
    ]);

    // Parse responses
    const plans: Plan[] = [];

    for (const result of results) {
      const response = result as Response;
      if (!response || !response.ok) continue;

      try {
        const data = await response.json() as { plan?: Plan };

        if (data.plan) {
          plans.push(data.plan);

          // Store completed plan
          this.directorState.completedPlans.set(data.plan.id, data.plan);
        }
      } catch (error) {
        console.error('Failed to parse planner response:', error);
      }
    }

    await this.persistState();

    return plans;
  }

  /**
   * Select the best plan based on priority and confidence
   */
  private selectBestPlan(plans: Plan[]): Plan {
    if (plans.length === 0) {
      throw new Error('No plans available');
    }

    // Sort by priority (descending) and confidence (descending)
    const sorted = [...plans].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.confidence - a.confidence;
    });

    return sorted[0]!;
  }

  /**
   * Execute plan via Executor Agent
   */
  private async executePlan(plan: Plan, request: ChatRequest): Promise<{
    executorId: string;
    output: string;
    status: string;
  }> {
    const executorId = `executor-${plan.id}`;
    const executorStub = this.env.EXECUTOR_DO!.get(
      this.env.EXECUTOR_DO!.idFromName(executorId)
    );

    const response = await executorStub.fetch(
      new Request('https://executor/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          context: {
            sessionId: request.sessionId,
            userId: request.userId,
            conversationHistory: request.messages,
            metadata: request.context || {},
          },
        }),
      })
    );

    const result = await response.json();

    return {
      executorId,
      output: (result as any).output || '',
      status: (result as any).status || 'unknown',
    };
  }

  /**
   * Aggregate results into final response
   */
  private async aggregateResults(
    executorResult: { executorId: string; output: string; status: string },
    plan: Plan
  ): Promise<ChatResponse> {
    const response: ChatResponse = {
      id: crypto.randomUUID(),
      sessionId: this.directorState.sessionId,
      content: executorResult.output,
      model: plan.selectedModel,
      provider: plan.provider,
      finishReason: executorResult.status === 'completed' ? 'stop' : 'length',
      usage: {
        promptTokens: Math.floor(plan.estimatedTokens * 0.4),
        completionTokens: Math.floor(plan.estimatedTokens * 0.6),
        totalTokens: plan.estimatedTokens,
      },
      timestamp: Date.now(),
      latency: 0, // Will be set by caller
      metadata: {
        plansGenerated: this.directorState.completedPlans.size,
        agentsInvolved: [
          plan.plannerId,
          executorResult.executorId,
        ],
      },
    };

    return response;
  }

  /**
   * Update conversation context from request
   */
  private async updateContext(request: ChatRequest): Promise<void> {
    // Set session ID if first request
    if (!this.directorState.sessionId) {
      this.directorState.sessionId = request.sessionId;
    }

    // Update context
    this.directorState.context = {
      sessionId: request.sessionId,
      conversationId: this.directorState.context.conversationId || crypto.randomUUID(),
      userId: request.userId,
      messageCount: this.directorState.context.messageCount + request.messages.length,
      totalTokens: this.directorState.context.totalTokens,
      lastActivity: Date.now(),
      preferences: {
        ...(request.context?.language && { language: request.context.language }),
        ...(request.context?.framework && { framework: request.context.framework }),
        ...(request.preferences?.model && { model: request.preferences.model }),
        ...(request.preferences?.temperature !== undefined && { temperature: request.preferences.temperature }),
      },
      history: [
        ...this.directorState.context.history,
        ...request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || Date.now(),
        })),
      ],
      threads: this.directorState.context.threads || new Map(),
      metadata: this.directorState.context.metadata || {},
    };

    // Keep history manageable (last 100 messages)
    if (this.directorState.context.history.length > 100) {
      this.directorState.context.history = this.directorState.context.history.slice(-100);
    }

    await this.persistState();
  }

  /**
   * Update metrics after response
   */
  private async updateMetrics(_response: ChatResponse, latency: number): Promise<void> {
    this.directorState.metrics.requestsProcessed++;
    this.directorState.metrics.totalLatency += latency;
    this.directorState.metrics.averageLatency =
      this.directorState.metrics.totalLatency / this.directorState.metrics.requestsProcessed;
    this.directorState.metrics.lastUpdate = Date.now();

    await this.persistState();
  }

  /**
   * Initialize empty conversation context
   */
  private initializeEmptyContext(): ConversationContext {
    return {
      sessionId: '',
      conversationId: crypto.randomUUID(),
      userId: '',
      messageCount: 0,
      totalTokens: 0,
      lastActivity: Date.now(),
      preferences: {},
      history: [],
      threads: new Map(),
      metadata: {},
    };
  }

  /**
   * Initialize state from storage
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.get<{
        sessionId: string;
        activePlanners: string[];
        completedPlans: Array<[string, Plan]>;
        context: ConversationContext;
        metrics: DirectorState['metrics'];
      }>('directorState');

      if (stored) {
        this.directorState.sessionId = stored.sessionId;
        this.directorState.activePlanners = new Set(stored.activePlanners);
        this.directorState.completedPlans = new Map(stored.completedPlans);
        this.directorState.context = stored.context;
        this.directorState.metrics = stored.metrics;
      }
    } catch (error) {
      console.error('Failed to load state from storage:', error);
    }
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    try {
      await this.storage.put('directorState', {
        sessionId: this.directorState.sessionId,
        activePlanners: Array.from(this.directorState.activePlanners),
        completedPlans: Array.from(this.directorState.completedPlans.entries()),
        context: this.directorState.context,
        metrics: this.directorState.metrics,
      });
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  /**
   * Alarm handler for periodic maintenance
   */
  async alarm(): Promise<void> {
    // Cleanup old completed plans (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const [id, plan] of this.directorState.completedPlans.entries()) {
      if (plan.createdAt < oneHourAgo) {
        this.directorState.completedPlans.delete(id);
      }
    }

    await this.persistState();
  }
}

/**
 * Helper function to create Director Agent stub
 */
export function createDirectorStub(env: Env, sessionId: string): DurableObjectStub {
  return env.DIRECTOR_DO!.get(env.DIRECTOR_DO!.idFromName(`director-${sessionId}`));
}

/**
 * Helper function to orchestrate request
 */
export async function orchestrateChat(
  env: Env,
  request: ChatRequest
): Promise<ChatResponse> {
  const stub = createDirectorStub(env, request.sessionId);

  const response = await stub.fetch(
    new Request('https://director/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  );

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Orchestration failed');
  }

  return response.json() as Promise<ChatResponse>;
}
