/**
 * Core types and interfaces for the Real-Time Communication Package
 */

export interface ConnectionId {
  id: string;
  namespace: string;
  userId?: string;
}

export interface Message<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  source: ConnectionId;
  target?: ConnectionId | string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface ChannelMessage<T = any> extends Message<T> {
  channel: string;
  isBroadcast?: boolean;
}

export interface SystemMessage<T = any> extends Message<T> {
  subsystem: 'websocket' | 'multiplexer' | 'presence' | 'scalability' | 'monitoring';
}

export interface Connection<T = any> {
  id: string;
  userId?: string;
  namespace: string;
  socket: WebSocket;
  metadata: Record<string, any>;
  state: ConnectionState;
  lastActivity: number;
  messages: Message<T>[];
  heartbeatInterval?: NodeJS.Timeout;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  bufferSize: number;
  queue: Message<T>[];
  heartbeatTimeout?: NodeJS.Timeout;
  closeReason?: CloseReason;
}

export interface WebSocketOptions {
  maxConnections: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  maxMessageSize: number;
  maxQueueSize: number;
  compression: boolean;
  enableBackpressure: boolean;
  enableLogging: boolean;
  enableMetrics: boolean;
}

export interface MultiplexerOptions {
  maxChannels: number;
  maxSubscribers: number;
  channelTtl: number;
  enableHistory: boolean;
  historySize: number;
  messageOrdering: boolean;
}

export interface PresenceOptions {
  heartbeatInterval: number;
  presenceTtl: number;
  enableStatusUpdates: boolean;
  enableActivityTracking: boolean;
  maxUsers: number;
}

export interface ScalabilityOptions {
  instanceId: string;
  clusterNodes: string[];
  enableLoadBalancing: boolean;
  connectionMigration: boolean;
  messageReplication: boolean;
  healthCheckInterval: number;
  maxConnectionsPerNode: number;
  sessionAffinity: boolean;
}

export interface MonitoringOptions {
  enableMetrics: boolean;
  enableTracing: boolean;
  enableLogging: boolean;
  metricsInterval: number;
  retentionPeriod: number;
  alertThresholds: AlertThresholds;
}

export interface AlertThresholds {
  highCpu: number;
  highMemory: number;
  highConnections: number;
  highLatency: number;
  highErrorRate: number;
}

export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  IDLE = 'idle',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

export enum ConnectionCloseReason {
  NORMAL = 'normal',
  TIMEOUT = 'timeout',
  ERROR = 'error',
  SHUTDOWN = 'shutdown',
  MAX_RETRIES = 'max_retries'
}

export type CloseReason = {
  code: number;
  reason: string;
  wasClean: boolean;
};

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastActivity: number;
  connectionId?: string;
  metadata?: Record<string, any>;
}

export interface ChannelSubscription {
  channel: string;
  userId: string;
  subscribedAt: number;
  metadata?: Record<string, any>;
}

export interface ChannelInfo {
  name: string;
  subscribers: Set<string>;
  metadata?: Record<string, any>;
  createdAt: number;
  messageCount: number;
}

export interface ScalingMetrics {
  connections: number;
  messagesPerSecond: number;
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
  errorRate: number;
}

export interface HealthCheck {
  healthy: boolean;
  timestamp: number;
  metrics: ScalingMetrics;
  issues: string[];
}

export interface WebSocketEvent {
  type: 'connect' | 'disconnect' | 'message' | 'error' | 'close' | 'heartbeat';
  connectionId: string;
  data?: any;
  error?: Error;
  timestamp: number;
}

export interface MultiplexEvent {
  type: 'subscribe' | 'unsubscribe' | 'publish' | 'message';
  channel: string;
  userId: string;
  message?: any;
  timestamp: number;
}

export interface PresenceEvent {
  type: 'update' | 'join' | 'leave';
  userId: string;
  presence: UserPresence;
  timestamp: number;
}

export interface ScalingEvent {
  type: 'node_join' | 'node_leave' | 'migrate' | 'replicate';
  nodeId?: string;
  connectionId?: string;
  data?: any;
  timestamp: number;
}

// Cloudflare Worker specific types
export interface CloudflareWebSocket extends WebSocket {
  accept(): void;
  close(code?: number, reason?: string): void;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
}

export interface CloudflareUpgrade {
  request: Request;
  upgradeWebSocket(): Promise<CloudflareWebSocket>;
}

export interface RealTimeConfig {
  websocket: WebSocketOptions;
  multiplexer: MultiplexerOptions;
  presence: PresenceOptions;
  scalability: ScalabilityOptions;
  monitoring: MonitoringOptions;
}

// Utility types
export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;
export type MiddlewareFunction = (event: any, next: () => void) => void;
export type EventHandler = (event: any) => void;

// Error types
export enum RealTimeError {
  CONNECTION_LIMIT_EXCEEDED = 'CONNECTION_LIMIT_EXCEEDED',
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',
  INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
  TIMEOUT = 'TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED'
}

export interface RealTimeErrorDetail {
  code: RealTimeError;
  message: string;
  timestamp: number;
  connectionId?: string;
  channel?: string;
  userId?: string;
}

// Performance monitoring types
export interface PerformanceMetrics {
  connections: {
    total: number;
    active: number;
    failed: number;
    averageLatency: number;
  };
  messages: {
    total: number;
    perSecond: number;
    averageSize: number;
    failed: number;
  };
  system: {
    uptime: number;
    memory: {
      used: number;
      total: number;
    };
    cpu: number;
  };
  channels: {
    total: number;
    active: number;
    averageSubscribers: number;
  };
  presence: {
    totalUsers: number;
    activeUsers: number;
    averageSessionTime: number;
  };
}

// Event aggregator types
export interface EventAggregator {
  addEvent(event: any): void;
  getEvents(filter?: (event: any) => boolean): any[];
  getStats(): any;
  clear(): void;
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitInfo {
  current: number;
  max: number;
  remaining: number;
  resetTime: number;
}