/**
 * Type definitions for Cocapn Platform
 */

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
  agentState: Record<string, AgentState>;
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
  status: 'idle' | 'working' | 'waiting' | 'error' | 'completed';
  currentTask?: string;
  progress: number;
}
