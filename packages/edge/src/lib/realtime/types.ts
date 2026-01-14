/**
 * Real-time Communication Type Definitions
 * WebSocket-based messaging system using Durable Objects
 */

/**
 * WebSocket message types
 */
export enum MessageType {
  // Connection lifecycle
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  RECONNECT = 'reconnect',
  PING = 'ping',
  PONG = 'pong',

  // Room management
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  ROOM_LIST = 'room_list',
  ROOM_INFO = 'room_info',

  // Presence
  PRESENCE_UPDATE = 'presence_update',
  PRESENCE_SYNC = 'presence_sync',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',

  // Messaging
  MESSAGE = 'message',
  MESSAGE_ACK = 'message_ack',
  MESSAGE_BATCH = 'message_batch',
  DIRECT_MESSAGE = 'direct_message',

  // Streaming
  STREAM_START = 'stream_start',
  STREAM_DATA = 'stream_data',
  STREAM_END = 'stream_end',
  STREAM_ERROR = 'stream_error',

  // Events
  EVENT = 'event',
  EVENT_BROADCAST = 'event_broadcast',

  // Errors
  ERROR = 'error',
  WARNING = 'warning',
}

/**
 * WebSocket connection state
 */
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
}

/**
 * User presence status
 */
export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

/**
 * Base WebSocket message interface
 */
export interface WebSocketMessage {
  type: MessageType;
  id: string;
  timestamp: number;
  priority?: MessagePriority;
  metadata?: Record<string, unknown>;
}

/**
 * Connect message
 */
export interface ConnectMessage extends WebSocketMessage {
  type: MessageType.CONNECT;
  data: {
    userId: string;
    sessionId: string;
    token?: string;
    capabilities?: string[];
    reconnect?: boolean;
    lastMessageId?: string;
  };
}

/**
 * Disconnect message
 */
export interface DisconnectMessage extends WebSocketMessage {
  type: MessageType.DISCONNECT;
  data: {
    reason?: string;
    code?: number;
    reconnect?: boolean;
  };
}

/**
 * Room join message
 */
export interface JoinRoomMessage extends WebSocketMessage {
  type: MessageType.JOIN_ROOM;
  data: {
    roomId: string;
    password?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Room leave message
 */
export interface LeaveRoomMessage extends WebSocketMessage {
  type: MessageType.LEAVE_ROOM;
  data: {
    roomId: string;
  };
}

/**
 * Chat message
 */
export interface ChatMessage extends WebSocketMessage {
  type: MessageType.MESSAGE;
  data: {
    roomId?: string;
    content: string;
    contentType?: 'text' | 'code' | 'markdown' | 'json';
    replyTo?: string;
    mentions?: string[];
    ephemeral?: boolean;
  };
}

/**
 * Direct message
 */
export interface DirectMessage extends WebSocketMessage {
  type: MessageType.DIRECT_MESSAGE;
  data: {
    toUserId: string;
    content: string;
    contentType?: 'text' | 'code' | 'markdown' | 'json';
  };
}

/**
 * Presence update message
 */
export interface PresenceUpdateMessage extends WebSocketMessage {
  type: MessageType.PRESENCE_UPDATE;
  data: {
    status: PresenceStatus;
    customStatus?: string;
    capabilities?: string[];
  };
}

/**
 * Stream data message
 */
export interface StreamDataMessage extends WebSocketMessage {
  type: MessageType.STREAM_DATA;
  data: {
    streamId: string;
    sequence: number;
    chunk: string;
    encoding?: 'utf-8' | 'base64';
    final?: boolean;
  };
}

/**
 * Error message
 */
export interface ErrorMessage extends WebSocketMessage {
  type: MessageType.ERROR;
  data: {
    code: string;
    message: string;
    details?: unknown;
    recoverable?: boolean;
  };
}

/**
 * Union type of all message types
 */
export type AnyMessage =
  | ConnectMessage
  | DisconnectMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | ChatMessage
  | DirectMessage
  | PresenceUpdateMessage
  | StreamDataMessage
  | ErrorMessage;

/**
 * Connected user information
 */
export interface ConnectedUser {
  userId: string;
  sessionId: string;
  connectionId: string;
  status: PresenceStatus;
  customStatus?: string;
  capabilities: string[];
  connectedAt: number;
  lastSeen: number;
  metadata: Record<string, unknown>;
}

/**
 * Room information
 */
export interface Room {
  roomId: string;
  name: string;
  type: 'public' | 'private' | 'direct';
  owner: string;
  created: number;
  maxSize?: number;
  currentSize: number;
  metadata: Record<string, unknown>;
  permissions: RoomPermissions;
}

/**
 * Room permissions
 */
export interface RoomPermissions {
  canRead: boolean;
  canWrite: boolean;
  canJoin: boolean;
  canModerate: boolean;
}

/**
 * WebSocket connection state
 */
export interface Connection {
  connectionId: string;
  userId: string;
  sessionId: string;
  state: ConnectionState;
  socket: WebSocket;
  connectedAt: number;
  lastActivity: number;
  rooms: Set<string>;
  metadata: Record<string, unknown>;
  capabilities: string[];
}

/**
 * Message delivery status
 */
export interface MessageDelivery {
  messageId: string;
  status: 'pending' | 'delivered' | 'failed' | 'acknowledged';
  attempts: number;
  deliveredAt?: number;
  failedAt?: number;
  error?: string;
}

/**
 * Message queue item
 */
export interface QueuedMessage {
  message: AnyMessage;
  targetConnectionId?: string;
  targetRoomId?: string;
  expiresAt: number;
  delivery: MessageDelivery;
}

/**
 * WebSocket statistics
 */
export interface WebSocketStats {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  messagesPerSecond: number;
  averageLatency: number;
  errorRate: number;
  uptime: number;
}

/**
 * Reconnection configuration
 */
export interface ReconnectionConfig {
  enabled: boolean;
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryOn: number[];
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  // Connection limits
  maxConnections: number;
  maxConnectionsPerUser: number;
  maxRoomsPerUser: number;

  // Timeouts (in milliseconds)
  connectionTimeout: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  messageTimeout: number;

  // Message queue
  maxQueueSize: number;
  maxRetries: number;
  messageTTL: number;

  // Reconnection
  reconnection: ReconnectionConfig;

  // Performance
  enableCompression: boolean;
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;

  // Security
  enableAuthentication: boolean;
  maxMessageSize: number;
  rateLimitPerSecond: number;
}

/**
 * Presence data
 */
export interface Presence {
  userId: string;
  status: PresenceStatus;
  customStatus?: string;
  lastSeen: number;
  currentRoom?: string;
  capabilities: string[];
}

/**
 * Room event
 */
export interface RoomEvent {
  type: 'user_joined' | 'user_left' | 'message' | 'presence_change' | 'metadata_changed';
  roomId: string;
  userId: string;
  timestamp: number;
  data: unknown;
}

/**
 * Serialization format
 */
export enum SerializationFormat {
  JSON = 'json',
  MESSAGE_PACK = 'messagepack',
  CBOR = 'cbor',
}

/**
 * Message serialization options
 */
export interface SerializationOptions {
  format: SerializationFormat;
  compressed: boolean;
  binary?: boolean;
}

/**
 * Heartbeat configuration
 */
export interface HeartbeatConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  jitter: number;
}

/**
 * Room membership
 */
export interface RoomMembership {
  roomId: string;
  userId: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt: number;
  permissions: RoomPermissions;
  metadata: Record<string, unknown>;
}

/**
 * Message acknowledgement
 */
export interface MessageAck {
  messageId: string;
  timestamp: number;
  processed: boolean;
  error?: string;
}

/**
 * Stream session
 */
export interface StreamSession {
  streamId: string;
  type: 'llm_response' | 'code_generation' | 'file_transfer' | 'custom';
  sourceUserId: string;
  targetUserId?: string;
  roomId?: string;
  startedAt: number;
  bytesSent: number;
  chunksSent: number;
  status: 'active' | 'paused' | 'completed' | 'error';
  metadata: Record<string, unknown>;
}

/**
 * WebSocket event handler
 */
export type WebSocketEventHandler = (message: AnyMessage, connection: Connection) => void | Promise<void>;

/**
 * Room event handler
 */
export type RoomEventHandler = (event: RoomEvent) => void | Promise<void>;

/**
 * Presence change handler
 */
export type PresenceChangeHandler = (presence: Presence) => void | Promise<void>;

/**
 * Error handler
 */
export type ErrorHandler = (error: Error, connection?: Connection) => void | Promise<void>;

/**
 * Connection state handler
 */
export type ConnectionStateHandler = (state: ConnectionState, connection: Connection) => void | Promise<void>;

/**
 * WebSocket server options
 */
export interface WebSocketServerOptions {
  config?: Partial<WebSocketConfig>;
  onMessage?: WebSocketEventHandler;
  onRoomEvent?: RoomEventHandler;
  onPresenceChange?: PresenceChangeHandler;
  onError?: ErrorHandler;
  onConnectionStateChange?: ConnectionStateHandler;
}

/**
 * Metrics data
 */
export interface MetricsData {
  timestamp: number;
  connections: {
    total: number;
    active: number;
    connecting: number;
    disconnected: number;
  };
  messages: {
    sent: number;
    received: number;
    failed: number;
    queued: number;
  };
  rooms: {
    total: number;
    active: number;
  };
  performance: {
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
  };
  errors: {
    count: number;
    rate: number;
  };
}
