/**
 * Agent Registry with Capability Discovery
 *
 * Manages agent registration, health monitoring, and discovery:
 * - Agent registration with capabilities
 * - Health monitoring with heartbeats
 * - Capability-based discovery
 * - Load balancing
 * - Agent selection
 */

import type {
  AgentInfo,
  AgentType,
  AgentCapability,
  HealthStatus,
  LoadInfo,
  RegistryState,
  DiscoveryCriteria,
} from './types';

export interface Env {
  AGENT_REGISTRY: DurableObjectNamespace;
  DIRECTOR_DO: DurableObjectNamespace;
  PLANNER_DO: DurableObjectNamespace;
  EXECUTOR_DO: DurableObjectNamespace;
  REVIEWER_DO?: DurableObjectNamespace;
  ANALYST_DO?: DurableObjectNamespace;
  DEBUGGER_DO?: DurableObjectNamespace;
  DOCUMENTER_DO?: DurableObjectNamespace;
  OPTIMIZER_DO?: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * Agent Registry - Manages agent instances with capability discovery
 *
 * Features:
 * - Automatic agent registration with capabilities
 * - Health monitoring with heartbeats
 * - Capability-based agent discovery
 * - Load balancing with smart selection
 * - Automatic failover
 */
export class AgentRegistry {
  private env: Env;
  private storage: DurableObjectStorage;
  private state: RegistryState;
  private heartbeatInterval = 30000; // 30 seconds
  private heartbeatTimeout = 60000; // 60 seconds

  constructor(env: Env, storage: DurableObjectStorage) {
    this.env = env;
    this.storage = storage;

    this.state = {
      agents: new Map(),
      loadHistory: new Map(),
      lastHealthCheck: Date.now(),
    };
  }

  /**
   * Initialize registry from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await this.storage.get<{
        agents: Array<[string, AgentInfo]>;
        loadHistory: Array<[string, number[]]>;
        lastHealthCheck: number;
      }>('registryState');

      if (stored) {
        this.state.agents = new Map(stored.agents);
        this.state.loadHistory = new Map(stored.loadHistory);
        this.state.lastHealthCheck = stored.lastHealthCheck;

        // Mark stale agents as unhealthy
        await this.markStaleAgents();
      }
    } catch (error) {
      console.error('Failed to initialize registry:', error);
    }
  }

  /**
   * Register new agent instance with capabilities
   */
  async register(agent: Omit<AgentInfo, 'createdAt'>): Promise<void> {
    const agentInfo: AgentInfo = {
      ...agent,
      createdAt: Date.now(),
    };

    // Initialize load history
    if (!this.state.loadHistory.has(agent.id)) {
      this.state.loadHistory.set(agent.id, []);
    }

    this.state.agents.set(agent.id, agentInfo);

    await this.persistState();
  }

  /**
   * Unregister agent
   */
  async unregister(agentId: string): Promise<void> {
    this.state.agents.delete(agentId);
    this.state.loadHistory.delete(agentId);

    await this.persistState();
  }

  /**
   * Update agent capabilities
   */
  async updateCapabilities(agentId: string, capabilities: AgentCapability[]): Promise<void> {
    const agent = this.state.agents.get(agentId);

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agent.capabilities = capabilities;
    await this.persistState();
  }

  /**
   * Update agent heartbeat
   */
  async updateHeartbeat(agentId: string, load: number): Promise<void> {
    const agent = this.state.agents.get(agentId);

    if (!agent) {
      // Auto-register if not exists
      await this.register({
        id: agentId,
        type: this.inferAgentType(agentId),
        status: 'idle',
        load,
        lastHeartbeat: Date.now(),
        capabilities: [],
      });
      return;
    }

    // Update heartbeat and load
    agent.lastHeartbeat = Date.now();
    agent.load = load;

    // Update status based on load
    if (load > 0.9) {
      agent.status = 'busy';
    } else if (load < 0.1) {
      agent.status = 'idle';
    } else {
      agent.status = 'idle';
    }

    // Track load history
    const history = this.state.loadHistory.get(agentId) || [];
    history.push(load);

    // Keep last 100 data points
    if (history.length > 100) {
      history.shift();
    }

    this.state.loadHistory.set(agentId, history);

    await this.persistState();
  }

  /**
   * Discover agents based on criteria
   */
  async discoverAgents(criteria: DiscoveryCriteria): Promise<AgentInfo[]> {
    let agents = Array.from(this.state.agents.values());

    // Filter by agent type
    if (criteria.agentType) {
      agents = agents.filter((a) => a.type === criteria.agentType);
    }

    // Filter by expertise
    if (criteria.expertise) {
      agents = agents.filter((a) => a.expertise === criteria.expertise);
    }

    // Filter by capabilities
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      agents = agents.filter((a) =>
        a.capabilities?.some((cap) =>
          criteria.capabilities!.some((req) => cap.features?.includes(req))
        )
      );
    }

    // Filter by availability
    if (criteria.minAvailability !== undefined) {
      agents = agents.filter((a) => {
        const availability = 1 - a.load;
        return availability >= criteria.minAvailability!;
      });
    }

    // Filter by load
    if (criteria.maxLoad !== undefined) {
      agents = agents.filter((a) => a.load <= criteria.maxLoad!);
    }

    // Filter by required features
    if (criteria.requiredFeatures && criteria.requiredFeatures.length > 0) {
      agents = agents.filter((a) =>
        a.capabilities?.some((cap) =>
          criteria.requiredFeatures!.every((feat) => cap.features?.includes(feat))
        )
      );
    }

    // Filter out error agents
    agents = agents.filter((a) => a.status !== 'error');

    // Sort by load (ascending) and last heartbeat (descending)
    agents.sort((a, b) => {
      if (Math.abs(a.load - b.load) > 0.1) {
        return a.load - b.load; // Prefer lower load
      }
      return b.lastHeartbeat - a.lastHeartbeat; // Prefer more recent heartbeat
    });

    return agents;
  }

  /**
   * Get available agents by type
   */
  async getAgentsByType(type: AgentType): Promise<AgentInfo[]> {
    return this.discoverAgents({ agentType: type });
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<AgentInfo | null> {
    return this.state.agents.get(agentId) || null;
  }

  /**
   * Get agent capabilities
   */
  async getCapabilities(agentId: string): Promise<AgentCapability[] | null> {
    const agent = this.state.agents.get(agentId);
    return agent?.capabilities || null;
  }

  /**
   * Get agents by capability
   */
  async getAgentsByCapability(capability: string): Promise<AgentInfo[]> {
    const agents: AgentInfo[] = [];

    for (const agent of this.state.agents.values()) {
      if (
        agent.capabilities?.some((cap) =>
          cap.features?.includes(capability) || cap.name === capability
        )
      ) {
        agents.push(agent);
      }
    }

    return agents;
  }

  /**
   * Get agent load balancing info
   */
  async getLoad(agentId: string): Promise<number> {
    const agent = this.state.agents.get(agentId);

    if (!agent) {
      return 0;
    }

    return agent.load;
  }

  /**
   * Select best agent for request (load balancing)
   */
  async selectAgent(type: AgentType, expertise?: string): Promise<string | null> {
    const agents = await this.getAgentsByType(type);

    if (agents.length === 0) {
      return null;
    }

    // Filter by expertise if specified
    let candidates = agents;
    if (expertise) {
      candidates = agents.filter((a) => a.expertise === expertise);
    }

    // If no specialized agents, fall back to general agents
    if (candidates.length === 0) {
      candidates = agents;
    }

    // Select agent with lowest load
    candidates.sort((a, b) => a.load - b.load);

    return candidates[0]?.id || null;
  }

  /**
   * Select agents by discovery criteria
   */
  async selectByCriteria(criteria: DiscoveryCriteria): Promise<string | null> {
    const agents = await this.discoverAgents(criteria);

    if (agents.length === 0) {
      return null;
    }

    return agents[0].id;
  }

  /**
   * Health check all agents
   */
  async healthCheck(): Promise<HealthStatus> {
    const now = Date.now();
    let healthy = 0;
    let unhealthy = 0;

    for (const [id, agent] of this.state.agents.entries()) {
      const timeSinceHeartbeat = now - agent.lastHeartbeat;

      if (timeSinceHeartbeat > this.heartbeatTimeout) {
        // Agent is stale
        agent.status = 'error';
        unhealthy++;
      } else {
        healthy++;
      }
    }

    this.state.lastHealthCheck = now;

    await this.persistState();

    return {
      healthy,
      unhealthy,
      total: this.state.agents.size,
      details: this.state.agents,
    };
  }

  /**
   * Get detailed load info for agent
   */
  async getDetailedLoad(agentId: string): Promise<LoadInfo | null> {
    const agent = this.state.agents.get(agentId);

    if (!agent) {
      return null;
    }

    const history = this.state.loadHistory.get(agentId) || [];

    return {
      agentId,
      load: agent.load,
      requestCount: history.length,
      averageResponseTime: this.calculateAverageResponseTime(agentId),
      errorRate: this.calculateErrorRate(agentId),
    };
  }

  /**
   * Mark stale agents as unhealthy
   */
  private async markStaleAgents(): Promise<void> {
    const now = Date.now();

    for (const [id, agent] of this.state.agents.entries()) {
      const timeSinceHeartbeat = now - agent.lastHeartbeat;

      if (timeSinceHeartbeat > this.heartbeatTimeout) {
        agent.status = 'error';
      }
    }

    await this.persistState();
  }

  /**
   * Infer agent type from ID
   */
  private inferAgentType(agentId: string): AgentType {
    if (agentId.startsWith('director-')) {
      return 'director';
    } else if (agentId.startsWith('planner-')) {
      return 'planner';
    } else if (agentId.startsWith('executor-')) {
      return 'executor';
    } else if (agentId.startsWith('reviewer-')) {
      return 'reviewer';
    } else if (agentId.startsWith('analyst-')) {
      return 'analyst';
    } else if (agentId.startsWith('debugger-')) {
      return 'debugger';
    } else if (agentId.startsWith('documenter-')) {
      return 'documenter';
    } else if (agentId.startsWith('optimizer-')) {
      return 'optimizer';
    }

    return 'director'; // Default
  }

  /**
   * Calculate average response time from load history
   */
  private calculateAverageResponseTime(agentId: string): number {
    // Simplified: use inverse of average load as proxy for response time
    const history = this.state.loadHistory.get(agentId) || [];

    if (history.length === 0) {
      return 0;
    }

    const avgLoad = history.reduce((sum, load) => sum + load, 0) / history.length;

    // Convert load to response time (lower load = faster response)
    return Math.floor(avgLoad * 1000); // ms
  }

  /**
   * Calculate error rate for agent
   */
  private calculateErrorRate(agentId: string): number {
    const agent = this.state.agents.get(agentId);

    if (!agent) {
      return 1; // 100% error rate if not found
    }

    // If agent status is error, return 100%
    if (agent.status === 'error') {
      return 1;
    }

    // Otherwise, estimate from load (higher load = higher error rate)
    return agent.load * 0.1; // Max 10% error rate
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    try {
      await this.storage.put('registryState', {
        agents: Array.from(this.state.agents.entries()),
        loadHistory: Array.from(this.state.loadHistory.entries()),
        lastHealthCheck: this.state.lastHealthCheck,
      });
    } catch (error) {
      console.error('Failed to persist registry state:', error);
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAgents: number;
    agentsByType: Record<string, number>;
    averageLoad: number;
    lastHealthCheck: number;
  } {
    const agentsByType: Record<string, number> = {
      director: 0,
      planner: 0,
      executor: 0,
      reviewer: 0,
      analyst: 0,
      debugger: 0,
      documenter: 0,
      optimizer: 0,
    };

    let totalLoad = 0;

    for (const agent of this.state.agents.values()) {
      agentsByType[agent.type]++;
      totalLoad += agent.load;
    }

    return {
      totalAgents: this.state.agents.size,
      agentsByType,
      averageLoad: this.state.agents.size > 0 ? totalLoad / this.state.agents.size : 0,
      lastHealthCheck: this.state.lastHealthCheck,
    };
  }
}

/**
 * Standalone Registry DO for managing agents
 */
export class AgentRegistryDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private registry: AgentRegistry;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.registry = new AgentRegistry(env, state.storage);
    this.registry.initialize();
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/register') {
        return this.handleRegister(request);
      }

      if (method === 'DELETE' && path === '/unregister') {
        return this.handleUnregister(request);
      }

      if (method === 'POST' && path === '/heartbeat') {
        return this.handleHeartbeat(request);
      }

      if (method === 'POST' && path === '/capabilities') {
        return this.handleUpdateCapabilities(request);
      }

      if (method === 'POST' && path === '/discover') {
        return this.handleDiscover(request);
      }

      if (method === 'GET' && path === '/agents') {
        return this.handleGetAgents(request);
      }

      if (method === 'GET' && path === '/agent') {
        return this.handleGetAgent(request);
      }

      if (method === 'GET' && path === '/capabilities') {
        return this.handleGetCapabilities(request);
      }

      if (method === 'GET' && path === '/select') {
        return this.handleSelectAgent(request);
      }

      if (method === 'GET' && path === '/health') {
        return this.handleHealthCheck();
      }

      if (method === 'GET' && path === '/load') {
        return this.handleGetLoad(request);
      }

      if (method === 'GET' && path === '/stats') {
        return this.handleGetStats();
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle register request
   */
  private async handleRegister(request: Request): Promise<Response> {
    const agent = (await request.json()) as Omit<AgentInfo, 'createdAt'>;

    await this.registry.register(agent);

    return new Response(
      JSON.stringify({ success: true, agentId: agent.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle unregister request
   */
  private async handleUnregister(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId') || '';

    await this.registry.unregister(agentId);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle heartbeat request
   */
  private async handleHeartbeat(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      agentId: string;
      load: number;
    };

    await this.registry.updateHeartbeat(body.agentId, body.load);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle update capabilities request
   */
  private async handleUpdateCapabilities(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      agentId: string;
      capabilities: AgentCapability[];
    };

    await this.registry.updateCapabilities(body.agentId, body.capabilities);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle discover request
   */
  private async handleDiscover(request: Request): Promise<Response> {
    const criteria = (await request.json()) as DiscoveryCriteria;

    const agents = await this.registry.discoverAgents(criteria);

    return new Response(
      JSON.stringify({ agents, count: agents.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get agents request
   */
  private async handleGetAgents(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || 'director') as AgentType;

    const agents = await this.registry.getAgentsByType(type);

    return new Response(
      JSON.stringify({ agents, count: agents.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get agent request
   */
  private async handleGetAgent(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId') || '';

    const agent = await this.registry.getAgent(agentId);

    if (!agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(agent),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get capabilities request
   */
  private async handleGetCapabilities(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId') || '';

    const capabilities = await this.registry.getCapabilities(agentId);

    if (!capabilities) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ capabilities, count: capabilities.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle select agent request
   */
  private async handleSelectAgent(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || 'director') as AgentType;
    const expertise = url.searchParams.get('expertise') || undefined;

    const agentId = await this.registry.selectAgent(type, expertise);

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'No available agents' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ agentId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle health check request
   */
  private async handleHealthCheck(): Promise<Response> {
    const health = await this.registry.healthCheck();

    return new Response(
      JSON.stringify(health),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get load request
   */
  private async handleGetLoad(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId') || '';

    const load = await this.registry.getDetailedLoad(agentId);

    if (!load) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(load),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get stats request
   */
  private async handleGetStats(): Promise<Response> {
    const stats = this.registry.getStats();

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Alarm handler for periodic health checks
   */
  async alarm(): Promise<void> {
    // Run health check
    await this.registry.healthCheck();
  }
}

/**
 * Helper function to create registry stub
 */
export function createRegistryStub(env: Env): DurableObjectStub {
  return env.AGENT_REGISTRY.get(env.AGENT_REGISTRY.idFromName('global-registry'));
}

/**
 * Helper function to register agent
 */
export async function registerAgent(
  env: Env,
  agent: Omit<AgentInfo, 'createdAt'>
): Promise<void> {
  const stub = createRegistryStub(env);

  await stub.fetch(
    new Request('https://registry/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    })
  );
}

/**
 * Helper function to update heartbeat
 */
export async function updateHeartbeat(
  env: Env,
  agentId: string,
  load: number
): Promise<void> {
  const stub = createRegistryStub(env);

  await stub.fetch(
    new Request('https://registry/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, load }),
    })
  );
}

/**
 * Helper function to select best agent
 */
export async function selectBestAgent(
  env: Env,
  type: AgentType,
  expertise?: string
): Promise<string | null> {
  const stub = createRegistryStub(env);

  const response = await stub.fetch(
    new Request(`https://registry/select?type=${type}${expertise ? `&expertise=${expertise}` : ''}`, {
      method: 'GET',
    })
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.agentId || null;
}

/**
 * Helper function to discover agents
 */
export async function discoverAgents(
  env: Env,
  criteria: DiscoveryCriteria
): Promise<AgentInfo[]> {
  const stub = createRegistryStub(env);

  const response = await stub.fetch(
    new Request('https://registry/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(criteria),
    })
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.agents || [];
}
