/**
 * Coordinator Agent Durable Object
 *
 * Orchestrates multiple AI agents working on a project simultaneously
 * Handles task breakdown, agent assignment, and parallel execution
 */

import type { AgentState, ProjectSession, ProjectLock } from '../types';

// Cloudflare Workers types
interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };
}

interface Env {
  WebSocketPair?: {
    new (): WebSocketPair;
  };
}

interface WebSocketPair {
  0: WebSocket & { accept(): void };
  1: WebSocket & { accept(): void; send(data: string): void };
}

interface CloudflareResponseInit {
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
  webSocket?: WebSocket;
}

/**
 * Task definition for coordinator agent
 */
export interface Task {
  id: string;
  agent: 'coordinator' | 'ui' | 'api' | 'database' | 'deploy' | 'assets' | 'mcp' | 'test';
  task: string;
  dependencies: string[];
  estimatedTime: number;
  status?: 'pending' | 'in-progress' | 'completed';
  agentId?: string;
}

/**
 * Message handler for WebSocket connections
 */
class MessageHandler {
  private coordinator: CoordinatorAgent;
  private sessionId: string;

  constructor(coordinator: CoordinatorAgent, sessionId: string) {
    this.coordinator = coordinator;
    this.sessionId = sessionId;
  }

  async handleMessage(message: unknown): Promise<void> {
    const msg = message as { type: string; data: unknown; sessionId: string };
    const sessionId = msg.sessionId || this.sessionId;

    switch (msg.type) {
      case 'parse':
        await this.coordinator.handleWebSocketMessage(sessionId, 'parse', msg.data);
        break;
      case 'assign':
        await this.coordinator.handleWebSocketMessage(sessionId, 'assign', msg.data);
        break;
      case 'execute':
        await this.coordinator.handleWebSocketMessage(sessionId, 'execute', msg.data);
        break;
    }
  }
}

/**
 * Coordinator Agent
 * Main coordinator for coordinating multiple AI agents working in parallel
 */
export class CoordinatorAgent {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<string, ProjectSession>;
  private agents: Map<string, AgentState>;
  private locks: Map<string, ProjectLock>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.agents = new Map();
    this.locks = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle WebSocket connections
    if (request.headers.get('upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // REST API endpoints
    switch (pathname) {
      case '/parse':
        return this.handleParse(request);
      case '/assign':
        return this.handleAssign(request);
      case '/execute':
        return this.handleExecute(request);
      case '/status':
        return this.handleStatus(request);
      default:
        return new Response('Not Found', { status: 422 });
    }
  }

  /**
   * Parse user request into tasks
   * POST /parse
   */
  private async handleParse(request: Request): Promise<Response> {
    const { sessionId, prompt } = await request.json();

    const result = await this.parsePrompt(sessionId, prompt);

    return Response.json(result);
  }

  /**
   * Assign tasks to specialist agents
   * POST /assign
   */
  private async handleAssign(request: Request): Promise<Response> {
    const { sessionId, tasks } = await request.json();

    const assignments = await this.assignTasks(sessionId, tasks);

    return Response.json(assignments);
  }

  /**
   * Execute all assigned tasks
   * POST /execute
   */
  private async handleExecute(request: Request): Promise<Response> {
    const { sessionId, taskId } = await request.json();

    const result = await this.executeTasks(sessionId, taskId);

    return Response.json(result);
  }

  /**
   * Get current status of a session
   * GET /status?sessionId={sessionId}
   */
  private async handleStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return Response.json({ error: 'sessionId parameter required' }, { status: 400 });
    }

    const session = await this.loadSession(sessionId.toString());
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const status = await this.getSessionStatus(sessionId.toString());

    return Response.json(status);
  }

  /**
   * Handle WebSocket connections for real-time updates
   */
  private async handleWebSocket(request: Request): Promise<Response> {
    const { WebSocketPair } = this.env as { WebSocketPair?: { new (): WebSocketPair } };

    if (!WebSocketPair) {
      return new Response('WebSocket not supported', { status: 501 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    server.send(JSON.stringify({ type: 'connected', message: 'Coordinator Agent ready' }));

    server.addEventListener('message', async (event) => {
      const { data } = event;
      try {
        const message = JSON.parse(data as string);
        const sessionId = message.sessionId as string;

        await this.handleWebSocketMessage(sessionId, message.type, message.data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        server.send(JSON.stringify({ type: 'error', error: errorMessage }));
      }
    });

    return new Response(null, { status: 101, webSocket: client } as CloudflareResponseInit);
  }

  /**
   * Handle WebSocket messages
   */
  async handleWebSocketMessage(sessionId: string, type: string, data: unknown): Promise<void> {
    switch (type) {
      case 'parse':
        await this.handleWebSocketParse(sessionId, data);
        break;
      case 'assign':
        await this.handleWebSocketAssign(sessionId, data);
        break;
      case 'execute':
        await this.handleWebSocketExecute(sessionId, data);
        break;
    }
  }

  /**
   * Parse user message into subtasks
   */
  private async parsePrompt(sessionId: string, prompt: string): Promise<{
    sessionId: string;
    tasks: Array<{
      id: string;
      agent: string;
      task: string;
      dependencies: string[];
      estimatedTime: number;
    }>;
  }> {
    // Simple keyword-based task breakdown
    const tasks: Array<{
      id: string;
      agent: string;
      task: string;
      dependencies: string[];
      estimatedTime: number;
    }> = [];

    // Detect request type
    if (prompt.includes('landing page') || prompt.includes('home page') || prompt.includes('front page')) {
      tasks.push({
        id: 'task-1',
        agent: 'ui',
        task: 'Create landing page',
        dependencies: [],
        estimatedTime: 10
      });
    }

    if (prompt.includes('api') || prompt.includes('endpoint')) {
      tasks.push({
        id: 'task-2',
        agent: 'api',
        task: 'Create API endpoints',
        dependencies: [],
        estimatedTime: 5
      });
    }

    if (prompt.includes('database') || prompt.includes('data')) {
      tasks.push({
        id: 'task-3',
        agent: 'database',
        task: 'Create database schema',
        dependencies: [],
        estimatedTime: 10
      });
    }

    if (prompt.includes('deploy') || prompt.includes('publish')) {
      tasks.push({
        id: 'task-4',
        agent: 'deploy',
        task: 'Deploy to Cloudflare Workers',
        dependencies: ['task-1', 'task-2', 'task-3'],
        estimatedTime: 2
      });
    }

    // Default fallback
    if (tasks.length === 0) {
      tasks.push({
        id: 'task-5',
        agent: 'coordinator',
        task: 'Chat with user to understand requirements',
        dependencies: [],
        estimatedTime: 2
      });
    }

    return { sessionId, tasks };
  }

  /**
   * Assign tasks to appropriate agents
   */
  private async assignTasks(sessionId: string, tasks: Task[]): Promise<Array<{
    agentId: string;
    taskId: string;
    agentType: string;
    task: string;
    status: 'pending' | 'in-progress' | 'completed';
  }>> {
    const assignments: Array<{
      agentId: string;
      taskId: string;
      agentType: string;
      task: string;
      status: 'pending' | 'in-progress' | 'completed';
    }> = [];

    // Assign each task to an available agent
    for (const task of tasks) {
      const agentId = await this.assignTask(sessionId, task);

      assignments.push({
        agentId,
        taskId: task.id,
        agentType: task.agent,
        task: task.task,
        status: 'pending',
      });

      // Create agent if doesn't exist
      if (agentId === 'auto') {
        await this.createAgent(sessionId, task.agent);
      }
    }

    return assignments;
  }

  /**
   * Assign a task to an agent
   */
  private async assignTask(sessionId: string, task: Task): Promise<string> {
    // Check if there's already an agent of this type available
    const existingAgent = await this.findAvailableAgent(sessionId, task.agent);
    if (existingAgent) {
      return existingAgent.agentId;
    }

    // Create a new agent
    const agentId = await this.createAgent(sessionId, task.agent);
    return agentId;
  }

  /**
   * Find an available agent of a type
   */
  private async findAvailableAgent(sessionId: string, agentType: AgentState['agentType']): Promise<AgentState | null> {
    const session = await this.loadSession(sessionId);
    if (!session) return null;

    const agents = await this.getAgents(sessionId);
    const available = agents.find(a => a.type === agentType && a.status === 'idle');

    return available || null;
  }

  /**
   * Execute all assigned tasks in appropriate order (parallel vs sequential)
   */
  private async executeTasks(sessionId: string, taskId: string): Promise<{
    sessionId: string;
    taskId: string;
    results: Array<{
      taskId: string;
      agentId: string;
      success: boolean;
      error?: string;
    }>;
    logs: Array<string>;
  }> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return {
        sessionId,
        taskId,
        results: [],
        logs: ['Session not found']
      };
    }

    // Get task details
    const tasks: Task[] = Object.values(session.agentState)
      .filter(agent => agent.currentTask === taskId)
      .map(agent => ({
        id: agent.agentId,
        agent: agent.agentType,
        task: agent.currentTask || '',
        dependencies: [],
        estimatedTime: 0,
        status: 'pending' as const,
        agentId: agent.agentId
      }));

    // Separate into parallel and sequential tasks
    const parallelTasks = tasks.filter(task => task.dependencies.length === 0);
    const sequentialTasks = tasks.filter(task => task.dependencies.length > 0);

    const results: Array<{ taskId: string; agentId: string; success: boolean; error?: string; }> = [];
    const logs: string[] = [];

    // Execute parallel tasks
    if (await this.hasDependencies(sequentialTasks)) {
      // All tasks are parallelizable or can run simultaneously with coordination
      const parallelResults = await this.executeParallelTasks(sessionId, tasks);
      results.push(...parallelResults);
    } else {
      // Execute sequential tasks in dependency order
      const sequentialResults = await this.executeSequentialTasks(sessionId, sequentialTasks);
      results.push(...sequentialResults);
    }

    // Mark session as done
    await this.markSessionDone(sessionId);

    return {
      sessionId,
      taskId,
      results,
      logs
    };
  }

  /**
   * Check if sequential tasks have unmet dependencies
   */
  private async hasDependencies(tasks: Task[]): Promise<boolean> {
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const depTask = tasks.find(t => t.id === depId);
        if (depTask && depTask.status !== 'completed') {
          return true; // Has unmet dependencies
        }
      }
    }
    return false;
  }

  /**
   * Execute tasks in dependency order
   */
  private async executeSequentialTasks(sessionId: string, tasks: Task[]): Promise<Array<{
    taskId: string;
    agentId: string;
    success: boolean;
    error?: string;
  }>> {
    const results: Array<{ taskId: string; agentId: string; success: boolean; error?: string; }> = [];

    // Sort tasks by dependency order
    const sortedTasks = this.topologicalSort(tasks);

    for (const task of sortedTasks) {
      const agentState = await this.getAgent(sessionId, task.agent);

      if (!agentState || agentState.status !== 'idle') {
        await this.createAgent(sessionId, task.agent);
      }

      const updatedAgentState = await this.getAgent(sessionId, task.agent);

      // Update agent state
      await this.updateAgent(sessionId, {
        agentId: updatedAgentState?.agentId || task.agent,
        status: 'working',
        currentTask: task.id,
        progress: 10,
      });

      // Mark session as working
      await this.markSessionWorking(sessionId);

      try {
        // Execute task
        const success = await this.executeTask(sessionId, task.id);

        results.push({
          taskId: task.id,
          agentId: task.agentId || task.agent,
          success,
        });

        // Update agent state
        await this.markAgentDone(sessionId, {
          taskId: task.id,
        });

        // Mark task as completed in session
        await this.markTaskCompleted(sessionId, task.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          taskId: task.id,
          agentId: task.agentId || task.agent,
          success: false,
          error: errorMessage
        });

        // Mark task as failed in session
        await this.markTaskFailed(sessionId, task.id, errorMessage);

        return results;
      }
    }

    return results;
  }

  /**
   * Execute tasks in parallel with file locking
   */
  private async executeParallelTasks(sessionId: string, tasks: Task[]): Promise<Array<{
    taskId: string;
    agentId: string;
    success: boolean;
    error?: string;
  }>> {
    const results: Array<{ taskId: string; agentId: string; success: boolean; error?: string; }> = [];

    // Mark session as working
    await this.markSessionWorking(sessionId);

    // Create all agents
    for (const task of tasks) {
      const agent = await this.createAgent(sessionId, task.agent);
      const agentState = await this.getAgent(sessionId, task.agent);

      // Update agent state
      await this.updateAgent(sessionId, {
        agentId: agentState?.agentId || task.agent,
        status: 'working',
        currentTask: task.id,
        progress: 10,
      });
    }

    // Execute tasks that don't require file access
    for (const task of tasks) {
      const agentState = await this.getAgent(sessionId, task.agent);

      try {
        const success = await this.executeTask(sessionId, task.id);

        results.push({
          taskId: task.id,
          agentId: task.agentId || task.agent,
          success,
        });

        await this.markAgentDone(sessionId, {
          taskId: task.id
        });

        await this.markTaskCompleted(sessionId, task.id);
      } catch (error) {
        results.push({
          taskId: task.id,
          agentId: task.agentId || task.agent,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        await this.markAgentError(sessionId, {
          taskId: task.id
        });
      }
    }

    // Execute tasks that require file access with file locking
    const tasksWithFiles = tasks.filter(t => t.dependencies.length > 0);
    const sortedTasks = this.topologicalSort(tasksWithFiles);

    for (const task of sortedTasks) {
      const agentState = await this.getAgent(sessionId, task.agent);

      try {
        // Acquire locks for all files this agent needs
        const lockKeys = await this.acquireAllLocks(sessionId, task.agent, task.dependencies);

        const success = await this.executeTask(sessionId, task.id);

        // Release all locks
        for (const lock of lockKeys) {
          await this.releaseLock(lock);
        }

        results.push({
          taskId: task.id,
          agentId: task.agentId,
          success,
        });

        await this.markAgentDone(sessionId, {
          taskId: task.id
        });

        await this.markTaskCompleted(sessionId, task.id);
      } catch (error) {
        results.push({
          taskId: task.id,
          agentId: task.agentId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        await this.markAgentError(sessionId, {
          taskId: task.id
        });
      }
    }

    await this.markSessionDone(sessionId);

    return results;
  }

  /**
   * Execute a single task
   */
  private async executeTask(sessionId: string, taskId: string): Promise<boolean> {
    const session = await this.loadSession(sessionId);
    if (!session) return false;

    const agentState = session.agentState[taskId];
    if (!agentState) return false;

    // Execute the task based on agent type
    switch (agentState.agentType) {
      case 'coordinator':
        return true;
      case 'ui':
        return await this.executeUITask(sessionId, taskId);
      case 'api':
        return await this.executeAPITask(sessionId, taskId);
      case 'database':
        return await this.executeDatabaseTask(sessionId, taskId);
      case 'deploy':
        return await this.executeDeployTask(sessionId, taskId);
      default:
        return false;
    }
  }

  /**
   * Execute a UI task
   */
  private async executeUITask(sessionId: string, taskId: string): Promise<boolean> {
    const session = await this.loadSession(sessionId);
    if (!session) return false;

    const agentState = session.agentState[taskId];
    if (!agentState) return false;

    await this.updateAgent(sessionId, {
      agentId: agentState.agentId,
      status: 'working',
      progress: 20,
    });

    await this.updateAgent(sessionId, {
      agentId: agentState.agentId,
      status: 'completed',
      currentTask: undefined,
    });

    return true;
  }

  /**
   * Execute an API task
   */
  private async executeAPITask(sessionId: string, taskId: string): Promise<boolean> {
    const session = await this.loadSession(sessionId);
    if (!session) return false;

    const agentState = session.agentState[taskId];
    if (!agentState) return false;

    await this.updateAgent(sessionId, {
      agentId: agentState.agentId,
      status: 'working',
      progress: 10,
    });

    await this.updateAgent(sessionId, {
      agentId: agentState.agentId,
      status: 'completed',
      currentTask: undefined,
    });

    return true;
  }

  /**
   * Execute a database task
   */
  private async executeDatabaseTask(sessionId: string, taskId: string): Promise<boolean> {
    const session = await this.loadSession(sessionId);
    if (!session) return false;

    const agentState = session.agentState[taskId];
    if (!agentState) return false;

    await this.updateAgent(sessionId, {
      agentId: agentState.agentId,
      status: 'working',
      progress: 10,
    });

    await this.updateAgent(sessionId, {
      agentId: agentState.agentId,
      status: 'completed',
      currentTask: undefined,
    });

    return true;
  }

  /**
   * Execute a deploy task
   */
  private async executeDeployTask(sessionId: string, taskId: string): Promise<boolean> {
    const session = await this.loadSession(sessionId);
    if (!session) return false;

    const agentState = session.agentState[taskId];
    if (!agentState) return false;

    await this.updateAgent(sessionId, {
      agentId: agentState.agentId,
      status: 'working',
      progress: 10,
    });

    await this.updateAgent(sessionId, {
      agentId: agentState.agentId,
      status: 'completed',
      currentTask: undefined,
    });

    return true;
  }

  // Helper methods

  private async handleWebSocketParse(sessionId: string, data: unknown): Promise<void> {
    const { prompt } = data as { prompt: string };
    const result = await this.parsePrompt(sessionId, prompt);
    await this.state.storage.put(`parse:${sessionId}`, result);
  }

  private async handleWebSocketAssign(sessionId: string, data: unknown): Promise<void> {
    const { tasks } = data as { tasks: Task[] };
    const assignments = await this.assignTasks(sessionId, tasks);
    await this.state.storage.put(`assign:${sessionId}`, assignments);
  }

  private async handleWebSocketExecute(sessionId: string, data: unknown): Promise<void> {
    const { taskId } = data as { taskId: string };
    const result = await this.executeTasks(sessionId, taskId);
    await this.state.storage.put(`execute:${sessionId}`, result);
  }

  private async loadSession(sessionId: string): Promise<ProjectSession | null> {
    return await this.state.storage.get<ProjectSession>(`session:${sessionId}`);
  }

  private async getSessionStatus(sessionId: string): Promise<{
    sessionId: string;
    status: string;
    agents: Array<{ agentId: string; type: string; status: string }>;
  }> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return {
        sessionId,
        status: 'not-found',
        agents: []
      };
    }

    const agents = Object.values(session.agentState).map(agent => ({
      agentId: agent.agentId,
      type: agent.agentType,
      status: agent.status
    }));

    return {
      sessionId,
      status: 'active',
      agents
    };
  }

  private async getAgents(sessionId: string): Promise<Array<AgentState & { type: string }>> {
    const session = await this.loadSession(sessionId);
    if (!session) return [];

    return Object.values(session.agentState).map(agent => ({
      ...agent,
      type: agent.agentType
    }));
  }

  private async getAgent(sessionId: string, agentId: string): Promise<AgentState | null> {
    const session = await this.loadSession(sessionId);
    if (!session) return null;

    return session.agentState[agentId] || null;
  }

  private async createAgent(sessionId: string, agentType: string): Promise<string> {
    const agentId = `${agentType}-${Date.now()}`;
    const agentState: AgentState = {
      agentId,
      sessionId,
      agentType: agentType as AgentState['agentType'],
      status: 'idle',
      progress: 0
    };

    const session = await this.loadSession(sessionId);
    if (session) {
      session.agentState[agentId] = agentState;
      await this.state.storage.put(`session:${sessionId}`, session);
    }

    return agentId;
  }

  private async updateAgent(sessionId: string, updates: Partial<AgentState>): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session || !updates.agentId) return;

    const agentId = updates.agentId;
    session.agentState[agentId] = {
      ...session.agentState[agentId],
      ...updates
    } as AgentState;

    await this.state.storage.put(`session:${sessionId}`, session);
  }

  private async markSessionWorking(sessionId: string): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) return;

    session.updatedAt = Date.now();
    await this.state.storage.put(`session:${sessionId}`, session);
  }

  private async markSessionDone(sessionId: string): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) return;

    session.updatedAt = Date.now();
    await this.state.storage.put(`session:${sessionId}`, session);
  }

  private async markAgentDone(sessionId: string, data: { taskId: string }): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) return;

    const agentState = Object.values(session.agentState).find(
      agent => agent.currentTask === data.taskId
    );

    if (agentState) {
      agentState.status = 'idle';
      agentState.currentTask = undefined;
      agentState.progress = 100;
      await this.state.storage.put(`session:${sessionId}`, session);
    }
  }

  private async markAgentError(sessionId: string, data: { taskId: string }): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) return;

    const agentState = Object.values(session.agentState).find(
      agent => agent.currentTask === data.taskId
    );

    if (agentState) {
      agentState.status = 'error';
      await this.state.storage.put(`session:${sessionId}`, session);
    }
  }

  private async markTaskCompleted(sessionId: string, taskId: string): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) return;

    const agentState = session.agentState[taskId];
    if (agentState) {
      agentState.status = 'idle';
      agentState.currentTask = undefined;
      await this.state.storage.put(`session:${sessionId}`, session);
    }
  }

  private async markTaskFailed(sessionId: string, taskId: string, error: string): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) return;

    const agentState = session.agentState[taskId];
    if (agentState) {
      agentState.status = 'error';
      await this.state.storage.put(`session:${sessionId}`, session);
    }
  }

  private async acquireAllLocks(
    sessionId: string,
    agentId: string,
    dependencies: string[]
  ): Promise<string[]> {
    const lockKeys: string[] = [];

    for (const dep of dependencies) {
      const lockKey = `lock:${sessionId}:${dep}`;
      const lock: ProjectLock = {
        sessionId,
        filePath: dep,
        agentId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 300000 // 5 minutes
      };

      await this.state.storage.put(lockKey, lock);
      lockKeys.push(lockKey);
    }

    return lockKeys;
  }

  private async releaseLock(lockKey: string): Promise<void> {
    await this.state.storage.delete(lockKey);
  }

  private topologicalSort(tasks: Task[]): Task[] {
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(task: Task) {
      if (visited.has(task.id)) return;
      if (visiting.has(task.id)) throw new Error('Cycle detected in task dependencies');

      visiting.add(task.id);

      for (const depId of task.dependencies) {
        const depTask = tasks.find(t => t.id === depId);
        if (depTask) visit(depTask);
      }

      visiting.delete(task.id);
      visited.add(task.id);
      sorted.push(task);
    }

    for (const task of tasks) {
      visit(task);
    }

    return sorted;
  }
}
