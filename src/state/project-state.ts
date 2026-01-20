/**
 * Project State Management
 * Manages project sessions, files, locks, and agents stored in Cloudflare KV
 */

import type { Bindings } from '../index';
import type { ProjectFile, ProjectSession, ProjectLock, AgentState } from '../types';

export interface ProjectFile {
  path: string;
  content: string;
  language: 'typescript' | 'javascript' | 'html' | 'css' | 'json' | 'sql' | 'markdown' | 'yaml' | 'xml';
  locked_by?: string;
  locked_at?: number;
  hash: string;
}

export interface ProjectSession {
  sessionId: string;
  userId: string;
  projectName: string;
  createdAt: number;
  updatedAt: number;
  files: Record<string, ProjectFile>;
  activeAgents: string[];
  metadata: {
    provider: 'manus' | 'zai' | 'minimax' | 'claude' | 'grok';
    enableSmartRouting: boolean;
    tier: 'free' | 'no-ads' | 'pro';
  };
}

export interface ProjectLock {
  sessionId: string;
  filePath: string;
  agentId: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface AgentState {
  agentId: string;
  sessionId: string;
  agentType: 'coordinator' | 'ui' | 'api' | 'database' | 'deploy' | 'assets' | 'mcp' | 'test';
  status: 'idle' | 'working' | 'waiting' | 'error';
  currentTask?: string;
  progress: number; // 0-100
}

export class ProjectStateManager {
  constructor(private kv: KVNamespace, private env: Bindings) {}

  /**
   * Create a new project session
   */
  async createSession(userId: string, projectName: string): Promise<ProjectSession> {
    const sessionId = `session:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;

    const session: ProjectSession = {
      sessionId,
      userId,
      projectName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files: {},
      activeAgents: ['coordinator'],
      agentState: {
        coordinator: { agentId: 'coordinator', status: 'idle', progress: 0 },
      },
      metadata: {
        provider: 'manus',
        enableSmartRouting: false,
        tier: 'free',
      },
    };

    const key = `project:${userId}:${sessionId}`;
    await this.kv.put(key, JSON.stringify(session), { expirationTtl: 604800 }); // 7 days

    return session;
  }

  /**
   * Load an existing session
   */
  async loadSession(userId: string, sessionId: string): Promise<ProjectSession | null> {
    const key = `project:${userId}:${sessionId}`;
    const session = await this.kv.get(key);
    return session ? JSON.parse(session) : null;
  }

  /**
   * Save session state
   */
  async saveSession(session: ProjectSession): Promise<void> {
    session.updatedAt = Date.now();
    const key = `project:${session.userId}:${session.sessionId}`;
    await this.kv.put(key, JSON.stringify(session), { expirationTtl: 604800 });
  }

  /**
   * Delete a session
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = `project:${userId}:${sessionId}`;
    await this.kv.delete(sessionKey);

    // Delete all files
    const files = await this.listFiles(sessionId);
    for (const filePath of files) {
      const fileKey = `project:${sessionId}:file:${filePath}`;
      await this.kv.delete(fileKey);
    }

    // Delete all agents
    const agents = await this.listAgents(sessionId);
    for (const agent of agents) {
      await this.deleteAgent(sessionId, agent.agentId);
    }
  }

  /**
   * Load a file from the session
   */
  async loadFile(sessionId: string, filePath: string): Promise<ProjectFile | null> {
    const key = `project:${sessionId}:file:${filePath}`;
    const file = await this.kv.get(key);
    return file ? JSON.parse(file) : null;
  }

  /**
   * Save a file to the session
   */
  async saveFile(sessionId: string, file: ProjectFile): Promise<void> {
    const key = `project:${sessionId}:file:${file.path}`;
    await this.kv.put(key, JSON.stringify(file), { expirationTtl: 604800 });

    // Update session timestamp
    const session = await this.loadSession(file.userId, sessionId);
    if (session) {
      session.files[file.path] = file;
      await this.saveSession(session);
    }
  }

  /**
   * Delete a file from the session
   */
  async deleteFile(sessionId: string, filePath: string): Promise<void> {
    const key = `project:${sessionId}:file:${filePath}`;
    await this.kv.delete(key);

    const session = await this.loadSession('', sessionId); // Need userId
    if (session) {
      delete session.files[filePath];
      await this.saveSession(session);
    }
  }

  /**
   * Acquire a file lock for writing
   */
  async acquireLock(sessionId: string, filePath: string, agentId: string): Promise<boolean> {
    const lock: ProjectLock = {
      sessionId,
      filePath,
      agentId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + 60000, // 1 minute timeout
    };

    const key = `lock:${sessionId}:${filePath}`;
    const existing = await this.kv.get(key);

    if (existing) {
      const currentLock = JSON.parse(existing);
      // Check if lock has expired
      if (currentLock.expiresAt < Date.now()) {
        await this.kv.delete(key); // Expired lock
      } else {
        return false; // Valid lock exists
      }
    }

    const acquired = await this.kv.put(key, JSON.stringify(lock), {
      expirationTtl: 60, // 1 minute timeout
    });

    if (!acquired) {
      return false;
    }

    // Update agent state
    const agent = await this.getAgent(sessionId, agentId);
    if (agent && agent.status === 'idle') {
      await this.updateAgent(sessionId, {
        ...agent,
        status: 'working',
        currentTask: `Editing ${filePath}`,
        progress: 0,
      });
    }

    return acquired;
  }

  /**
   * Release a file lock
   */
  async releaseLock(sessionId: string, filePath: string): Promise<void> {
    const key = `lock:${sessionId}:${filePath}`;
    await this.kv.delete(key);

    // Update agent state
    const lock = await this.getLock(sessionId, filePath);
    if (lock) {
      const agent = await this.getAgent(sessionId, lock.agentId);
      if (agent) {
        await this.updateAgent(sessionId, {
          ...agent,
          status: 'idle',
          currentTask: undefined,
        });
      }
    }
  }

  /**
   * Get lock status for a file
   */
  async getLock(sessionId: string, filePath: string): Promise<ProjectLock | null> {
    const key = `lock:${sessionId}:${filePath}`;
    const lock = await this.kv.get(key);
    return lock ? JSON.parse(lock) : null;
  }

  /**
   * List all files in a session
   */
  async listFiles(sessionId: string): Promise<string[]> {
    const list = await this.kv.list({ prefix: `project:${sessionId}:file:` });
    return list.keys.map(key => key.replace('project:', '').replace(':file:', '/'));
  }

  /**
   * Create a new agent
   */
  async createAgent(
    sessionId: string,
    agentType: AgentState['agentType'],
    options?: { name?: string; config?: Record<string, unknown> }
  ): Promise<AgentState> {
    const agentId = `${agentType}-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

    const agent: AgentState = {
      agentId,
      sessionId,
      agentType,
      status: 'idle',
      progress: 0,
      currentTask: undefined,
    };

    // Save to KV
    const key = `agent:${sessionId}:${agentId}`;
    await this.kv.put(key, JSON.stringify(agent), { expirationTtl: 86400 }); // 1 day

    // Add to session
    const session = await this.loadSession('', sessionId);
    if (session && !session.activeAgents.includes(agentId)) {
      session.activeAgents.push(agentId);
      await this.saveSession(session);
    }

    return agent;
  }

  /**
   * Update agent state
   */
  async updateAgent(sessionId: string, updates: Partial<AgentState>): Promise<void> {
    const agent = await this.getAgent(sessionId, updates.agentId!);
    if (!agent) return;

    const updatedAgent = { ...agent, ...updates };

    const key = `agent:${sessionId}:${updates.agentId}`;
    await this.kv.put(key, JSON.stringify(updatedAgent), { expirationTill: 86400 });
  }

  /**
   * Get agent state
   */
  async getAgent(sessionId: string, agentId: string): Promise<AgentState | null> {
    const key = `agent:${sessionId}:${agentId}`;
    const agent = await this.kv.get(key);
    return agent ? JSON.parse(agent) : null;
  }

  /**
   * Get all agents for a session
   */
  async getAgents(sessionId: string): Promise<AgentState[]> {
    const list = await this.kv.list({ prefix: `agent:${sessionId}:` });
    const agents: AgentState[] = [];

    for (const key of list.keys) {
      const agent = await this.kv.get(key);
      if (agent) {
        agents.push(JSON.parse(agent));
      }
    }

    return agents;
  }

  /**
   * Delete an agent
   */
  async deleteAgent(sessionId: string, agentId: string): Promise<void> {
    const key = `agent:${sessionId}:${agentId}`;
    await this.kv.delete(key);

    const session = await this.loadSession('', sessionId);
    if (session) {
      session.activeAgents = session.activeAgents.filter(id => id !== agentId);
      await this.saveSession(session);
    }
  }
}
