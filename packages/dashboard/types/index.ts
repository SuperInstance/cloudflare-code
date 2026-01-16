// @ts-nocheck
/**
 * Dashboard-specific type definitions
 */

import { Message, ChatRequest, ChatResponse, AIProvider, User } from '@claudeflare/shared';

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardStats {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  activeProjects: number;
  averageLatency: number;
  successRate: number;
  period: '24h' | '7d' | '30d' | '90d';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  ownerId: string;
  members: ProjectMember[];
  settings: ProjectSettings;
  stats: ProjectStats;
}

export interface ProjectMember {
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: number;
}

export interface ProjectSettings {
  defaultProvider: AIProvider;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  enableCache: boolean;
  enableStreaming: boolean;
}

export interface ProjectStats {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  lastActivityAt: number;
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
  size?: number;
  language?: string;
  lastModified: number;
}

export interface CodeEditorState {
  fileId: string | null;
  content: string;
  language: string;
  modified: boolean;
  cursorPosition: { line: number; column: number };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface ChatSession {
  id: string;
  projectId: string | null;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  settings: ChatSessionSettings;
}

export interface ChatMessage extends Message {
  id: string;
  sessionId: string;
  status?: 'pending' | 'streaming' | 'completed' | 'error';
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  model?: string;
  provider?: AIProvider;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  latency?: number;
  tools?: string[];
}

export interface ChatSessionSettings {
  model: string;
  provider: AIProvider;
  temperature: number;
  maxTokens: number;
  stream: boolean;
  systemPrompt?: string;
}

export interface AnalyticsMetric {
  timestamp: number;
  value: number;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsData {
  requests: AnalyticsMetric[];
  costs: AnalyticsMetric[];
  tokens: AnalyticsMetric[];
  latency: AnalyticsMetric[];
  cacheHitRate: AnalyticsMetric[];
  errors: AnalyticsMetric[];
}

export interface ProviderMetrics {
  provider: AIProvider;
  requests: number;
  cost: number;
  tokens: number;
  averageLatency: number;
  successRate: number;
  models: ModelMetrics[];
}

export interface ModelMetrics {
  model: string;
  requests: number;
  cost: number;
  tokens: number;
  averageLatency: number;
}

export interface UserSettings {
  profile: UserProfile;
  preferences: UserPreferences;
  apiKeys: APIKey[];
  notifications: NotificationSettings;
  billing: BillingInfo;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  defaultProvider: AIProvider;
  defaultModel: string;
  editorSettings: EditorSettings;
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  autoSave: boolean;
  autoSaveDelay: number;
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  provider: AIProvider;
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
  permissions: string[];
  revoked: boolean;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  alerts: NotificationAlert[];
}

export interface NotificationAlert {
  type: 'cost_limit' | 'error_rate' | 'latency' | 'quota';
  threshold: number;
  enabled: boolean;
}

export interface BillingInfo {
  plan: 'free' | 'pro' | 'enterprise';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  usage: BillingUsage;
  paymentMethods: PaymentMethod[];
}

export interface BillingUsage {
  requests: { current: number; limit: number };
  tokens: { current: number; limit: number };
  cost: { current: number; limit: number };
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last4: string;
  expiry?: string;
  brand?: string;
  isDefault: boolean;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export interface WebSocketMessage {
  type: WSMessageType;
  data: unknown;
}

export type WSMessageType =
  | 'chat.response'
  | 'chat.error'
  | 'code.update'
  | 'collab.cursor'
  | 'collab.presence'
  | 'project.update'
  | 'analytics.update'
  | 'notification';

export interface WSChatResponse {
  sessionId: string;
  messageId: string;
  delta: string;
  done: boolean;
  metadata?: ChatMessageMetadata;
}

export interface WSCodeUpdate {
  fileId: string;
  path: string;
  content: string;
  userId: string;
  timestamp: number;
}

export interface WSCollabCursor {
  userId: string;
  fileId: string;
  position: { line: number; column: number };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface WSCollabPresence {
  users: PresenceUser[];
}

export interface PresenceUser {
  userId: string;
  name: string;
  avatar?: string;
  fileId?: string;
  cursor?: { line: number; column: number };
  lastSeen: number;
}

export interface WSProjectUpdate {
  projectId: string;
  update: {
    type: 'file' | 'settings' | 'member';
    action: 'create' | 'update' | 'delete';
    data: unknown;
  };
}

export interface WSAnalyticsUpdate {
  metrics: Partial<DashboardStats>;
}

export interface WSNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    url: string;
  };
}

// ============================================================================
// Form Types
// ============================================================================

export interface CreateProjectForm {
  name: string;
  description: string;
  defaultProvider: AIProvider;
  defaultModel: string;
}

export interface UpdateProjectForm {
  name?: string;
  description?: string;
  settings?: Partial<ProjectSettings>;
}

export interface CreateAPIKeyForm {
  name: string;
  provider: AIProvider;
  expiresAt?: number;
  permissions: string[];
}

export interface UpdateUserForm {
  name?: string;
  avatar?: string;
}

export interface UpdatePreferencesForm {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  defaultProvider?: AIProvider;
  defaultModel?: string;
  editorSettings?: Partial<EditorSettings>;
}

// ============================================================================
// Store Types
// ============================================================================

export interface DashboardStore {
  user: User | null;
  projects: Project[];
  currentProject: Project | null;
  chatSessions: ChatSession[];
  currentSession: ChatSession | null;
  notifications: WSNotification[];
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setChatSessions: (sessions: ChatSession[]) => void;
  setCurrentSession: (session: ChatSession | null) => void;
  addNotification: (notification: WSNotification) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setSidebarOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export type PaginationParams = {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ApiResponse<T> = {
  data: T;
  success: boolean;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
};

export type FileUploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};
