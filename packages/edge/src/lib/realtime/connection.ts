/**
 * Connection Manager for WebSocket Communication
 * Handles WebSocket lifecycle, state management, and reconnection
 */

import type {
  Connection,
  ConnectionState,
  ConnectMessage,
  DisconnectMessage,
  AnyMessage,
  WebSocketConfig,
  ReconnectionConfig,
  MessageType,
  WebSocketServerOptions,
} from './types';
import { MessageHandler } from './messaging';
import { generateId } from '../utils';

/**
 * Connection manager configuration
 */
interface ConnectionManagerConfig {
  maxConnections: number;
  maxConnectionsPerUser: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  enableMetrics: boolean;
}

/**
 * Connection event
 */
interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'state_changed' | 'error';
  connectionId: string;
  userId?: string;
  timestamp: number;
  data?: unknown;
}

/**
 * WebSocket connection manager
 */
export class ConnectionManager {
  private connections: Map<string, Connection>;
  private userConnections: Map<string, Set<string>>; // userId -> connectionIds
  private config: ConnectionManagerConfig;
  private messageHandler: MessageHandler;
  private eventHandlers: Set<(event: ConnectionEvent) => void>;
  private heartbeatTimers: Map<string, ReturnType<typeof setInterval>>;
  private heartbeatTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  private stats: {
    totalConnections: number;
    currentConnections: number;
    totalMessages: number;
    totalErrors: number;
  };

  constructor(
    config?: Partial<ConnectionManagerConfig>,
    messageHandler?: MessageHandler
  ) {
    this.connections = new Map();
    this.userConnections = new Map();
    this.heartbeatTimers = new Map();
    this.heartbeatTimeouts = new Map();
    this.eventHandlers = new Set();
    this.stats = {
      totalConnections: 0,
      currentConnections: 0,
      totalMessages: 0,
      totalErrors: 0,
    };

    this.config = {
      maxConnections: config?.maxConnections ?? 10000,
      maxConnectionsPerUser: config?.maxConnectionsPerUser ?? 10,
      connectionTimeout: config?.connectionTimeout ?? 30 * 1000, // 30 seconds
      heartbeatInterval: config?.heartbeatInterval ?? 30 * 1000, // 30 seconds
      heartbeatTimeout: config?.heartbeatTimeout ?? 60 * 1000, // 1 minute
      enableMetrics: config?.enableMetrics ?? true,
    };

    this.messageHandler = messageHandler ?? new MessageHandler();
  }

  /**
   * Accept WebSocket connection
   */
  async acceptConnection(
    websocket: WebSocket,
    connectMessage: ConnectMessage,
    options?: Partial<WebSocketConfig>
  ): Promise<Connection> {
    const { userId, sessionId, reconnect, lastMessageId } = connectMessage.data;
    const connectionId = generateId('conn');

    // Check connection limits
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error('Maximum connections reached');
    }

    const userConns = this.userConnections.get(userId) ?? new Set();
    if (userConns.size >= this.config.maxConnectionsPerUser) {
      throw new Error('Maximum connections per user reached');
    }

    // Accept the WebSocket
    websocket.accept();

    // Create connection object
    const connection: Connection = {
      connectionId,
      userId,
      sessionId,
      state: 'connected' as ConnectionState,
      socket: websocket,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      rooms: new Set(),
      metadata: connectMessage.metadata ?? {},
      capabilities: connectMessage.data.capabilities ?? [],
    };

    // Store connection
    this.connections.set(connectionId, connection);
    userConns.add(connectionId);
    this.userConnections.set(userId, userConns);

    // Update stats
    this.stats.totalConnections++;
    this.stats.currentConnections++;

    // Setup message handler
    websocket.addEventListener('message', async (event) => {
      await this.handleMessage(event, connection);
    });

    websocket.addEventListener('close', (event) => {
      this.handleClose(connectionId, event.code, event.reason);
    });

    websocket.addEventListener('error', (error) => {
      this.handleError(connectionId, error);
    });

    // Start heartbeat
    this.startHeartbeat(connection);

    // Emit connected event
    this.emitEvent({
      type: 'connected',
      connectionId,
      userId,
      timestamp: Date.now(),
    });

    // Send connection confirmation
    const confirmMessage: AnyMessage = {
      type: 'connect' as MessageType,
      id: generateId('msg'),
      timestamp: Date.now(),
      metadata: {
        connectionId,
        reconnect: reconnect ?? false,
      },
    };
    await this.messageHandler.sendMessage(confirmMessage, connection);

    return connection;
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): Connection | null {
    return this.connections.get(connectionId) ?? null;
  }

  /**
   * Get user connections
   */
  getUserConnections(userId: string): Connection[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {
      return [];
    }

    const connections: Connection[] = [];
    for (const connId of connectionIds) {
      const conn = this.connections.get(connId);
      if (conn) {
        connections.push(conn);
      }
    }

    return connections;
  }

  /**
   * Update connection state
   */
  updateConnectionState(connectionId: string, state: ConnectionState): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    const oldState = connection.state;
    connection.state = state;

    this.emitEvent({
      type: 'state_changed',
      connectionId,
      userId: connection.userId,
      timestamp: Date.now(),
      data: { oldState, newState: state },
    });

    return true;
  }

  /**
   * Update connection activity
   */
  updateActivity(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.lastActivity = Date.now();
    return true;
  }

  /**
   * Add room to connection
   */
  addRoomToConnection(connectionId: string, roomId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.rooms.add(roomId);
    return true;
  }

  /**
   * Remove room from connection
   */
  removeRoomFromConnection(connectionId: string, roomId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.rooms.delete(roomId);
    return true;
  }

  /**
   * Close connection
   */
  closeConnection(
    connectionId: string,
    code?: number,
    reason?: string
  ): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      connection.socket.close(code, reason);
      return true;
    } catch (error) {
      console.error('Error closing connection:', error);
      return false;
    }
  }

  /**
   * Disconnect connection
   */
  disconnect(
    connectionId: string,
    reason?: string,
    code: number = 1000
  ): boolean {
    return this.closeConnection(connectionId, code, reason);
  }

  /**
   * Disconnect all user connections
   */
  disconnectUser(userId: string, reason?: string): number {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {
      return 0;
    }

    let disconnected = 0;
    for (const connId of connectionIds) {
      if (this.disconnect(connId, reason)) {
        disconnected++;
      }
    }

    return disconnected;
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get user connection count
   */
  getUserConnectionCount(userId: string): number {
    const connectionIds = this.userConnections.get(userId);
    return connectionIds ? connectionIds.size : 0;
  }

  /**
   * Get all connections
   */
  getAllConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections in room
   */
  getConnectionsInRoom(roomId: string): Connection[] {
    return Array.from(this.connections.values()).filter(conn =>
      conn.rooms.has(roomId)
    );
  }

  /**
   * Subscribe to connection events
   */
  onEvent(handler: (event: ConnectionEvent) => void): () => void {
    this.eventHandlers.add(handler);

    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalConnections: number;
    currentConnections: number;
    totalMessages: number;
    totalErrors: number;
    averageConnectionDuration: number;
  } {
    const now = Date.now();
    let totalDuration = 0;

    for (const conn of this.connections.values()) {
      totalDuration += now - conn.connectedAt;
    }

    return {
      totalConnections: this.stats.totalConnections,
      currentConnections: this.stats.currentConnections,
      totalMessages: this.stats.totalMessages,
      totalErrors: this.stats.totalErrors,
      averageConnectionDuration: this.connections.size > 0
        ? totalDuration / this.connections.size
        : 0,
    };
  }

  /**
   * Cleanup idle connections
   */
  cleanupIdleConnections(idleTimeout: number): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [connId, conn] of this.connections.entries()) {
      const idleTime = now - conn.lastActivity;
      if (idleTime > idleTimeout) {
        this.disconnect(connId, 'Idle timeout');
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Destroy connection manager
   */
  destroy(): void {
    // Close all connections
    for (const [connId, conn] of this.connections.entries()) {
      try {
        conn.socket.close(1001, 'Server shutting down');
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }

    // Clear all timers
    for (const timer of this.heartbeatTimers.values()) {
      clearInterval(timer);
    }
    this.heartbeatTimers.clear();

    for (const timer of this.heartbeatTimeouts.values()) {
      clearTimeout(timer);
    }
    this.heartbeatTimeouts.clear();

    // Clear data
    this.connections.clear();
    this.userConnections.clear();
    this.eventHandlers.clear();

    // Destroy message handler
    this.messageHandler.destroy();
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(
    event: MessageEvent,
    connection: Connection
  ): Promise<void> {
    try {
      // Update activity
      connection.lastActivity = Date.now();

      // Reset heartbeat timeout
      this.resetHeartbeatTimeout(connection.connectionId);

      // Parse message
      const message = this.messageHandler.deserializeMessage(event.data);

      // Update stats
      this.stats.totalMessages++;

      // Handle message
      await this.messageHandler.handleMessage(message, connection, async (msg, conn) => {
        // Emit message event to subscribers
        this.emitEvent({
          type: 'state_changed',
          connectionId: conn.connectionId,
          userId: conn.userId,
          timestamp: Date.now(),
          data: { message: msg },
        });
      });
    } catch (error) {
      console.error('Error handling message:', error);
      this.stats.totalErrors++;

      this.emitEvent({
        type: 'error',
        connectionId: connection.connectionId,
        userId: connection.userId,
        timestamp: Date.now(),
        data: { error },
      });
    }
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Remove connection
    this.connections.delete(connectionId);

    const userConns = this.userConnections.get(connection.userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Update stats
    this.stats.currentConnections--;

    // Clear timers
    this.clearHeartbeat(connectionId);

    // Emit disconnected event
    this.emitEvent({
      type: 'disconnected',
      connectionId,
      userId: connection.userId,
      timestamp: Date.now(),
      data: { code, reason },
    });
  }

  /**
   * Handle WebSocket error
   */
  private handleError(connectionId: string, error: Event): void {
    this.stats.totalErrors++;

    this.emitEvent({
      type: 'error',
      connectionId,
      timestamp: Date.now(),
      data: { error },
    });
  }

  /**
   * Start heartbeat for connection
   */
  private startHeartbeat(connection: Connection): void {
    const { connectionId } = connection;

    // Send ping at interval
    const pingTimer = setInterval(() => {
      if (connection.socket.readyState === WebSocket.OPEN) {
        const pingMessage: AnyMessage = {
          type: 'ping' as MessageType,
          id: generateId('msg'),
          timestamp: Date.now(),
        };
        this.messageHandler.sendMessage(pingMessage, connection);
      }
    }, this.config.heartbeatInterval);

    this.heartbeatTimers.set(connectionId, pingTimer);

    // Set timeout for pong
    this.resetHeartbeatTimeout(connectionId);
  }

  /**
   * Reset heartbeat timeout
   */
  private resetHeartbeatTimeout(connectionId: string): void {
    // Clear existing timeout
    const existingTimeout = this.heartbeatTimeouts.get(connectionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      // Heartbeat timeout - close connection
      this.disconnect(connectionId, 'Heartbeat timeout', 1000);
    }, this.config.heartbeatTimeout);

    this.heartbeatTimeouts.set(connectionId, timeout);
  }

  /**
   * Clear heartbeat timers for connection
   */
  private clearHeartbeat(connectionId: string): void {
    const timer = this.heartbeatTimers.get(connectionId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(connectionId);
    }

    const timeout = this.heartbeatTimeouts.get(connectionId);
    if (timeout) {
      clearTimeout(timeout);
      this.heartbeatTimeouts.delete(connectionId);
    }
  }

  /**
   * Emit connection event
   */
  private emitEvent(event: ConnectionEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in connection event handler:', error);
      }
    }
  }
}

/**
 * Reconnection manager
 */
export class ReconnectionManager {
  private reconnectAttempts: Map<string, number>;
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  private config: ReconnectionConfig;
  private onReconnect?: (connectionId: string, attempt: number) => void;

  constructor(config: ReconnectionConfig, onReconnect?: (connectionId: string, attempt: number) => void) {
    this.reconnectAttempts = new Map();
    this.reconnectTimers = new Map();
    this.config = config;
    this.onReconnect = onReconnect;
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnection(connectionId: string): void {
    if (!this.config.enabled) {
      return;
    }

    const attempts = this.reconnectAttempts.get(connectionId) ?? 0;

    if (attempts >= this.config.maxAttempts) {
      // Max attempts reached
      this.reconnectAttempts.delete(connectionId);
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempts),
      this.config.maxDelay
    );

    // Add jitter
    const jitter = delay * 0.1 * Math.random();
    const finalDelay = delay + jitter;

    // Schedule reconnection
    const timer = setTimeout(() => {
      this.reconnectAttempts.set(connectionId, attempts + 1);

      if (this.onReconnect) {
        this.onReconnect(connectionId, attempts + 1);
      }
    }, finalDelay);

    this.reconnectTimers.set(connectionId, timer);
  }

  /**
   * Cancel reconnection
   */
  cancelReconnection(connectionId: string): void {
    const timer = this.reconnectTimers.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(connectionId);
    }

    this.reconnectAttempts.delete(connectionId);
  }

  /**
   * Reset reconnection attempts (on successful connection)
   */
  resetAttempts(connectionId: string): void {
    this.reconnectAttempts.delete(connectionId);
    this.cancelReconnection(connectionId);
  }

  /**
   * Get current attempt count
   */
  getAttemptCount(connectionId: string): number {
    return this.reconnectAttempts.get(connectionId) ?? 0;
  }

  /**
   * Clear all reconnection state
   */
  clear(): void {
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    this.reconnectAttempts.clear();
  }
}

/**
 * Connection pool for managing multiple connection managers
 */
export class ConnectionPool {
  private managers: Map<string, ConnectionManager>;

  constructor() {
    this.managers = new Map();
  }

  /**
   * Get or create connection manager for instance
   */
  getManager(instanceId: string, config?: Partial<ConnectionManagerConfig>): ConnectionManager {
    let manager = this.managers.get(instanceId);

    if (!manager) {
      manager = new ConnectionManager(config);
      this.managers.set(instanceId, manager);
    }

    return manager;
  }

  /**
   * Remove connection manager
   */
  removeManager(instanceId: string): boolean {
    const manager = this.managers.get(instanceId);
    if (!manager) {
      return false;
    }

    manager.destroy();
    this.managers.delete(instanceId);
    return true;
  }

  /**
   * Get all connection managers
   */
  getAllManagers(): ConnectionManager[] {
    return Array.from(this.managers.values());
  }

  /**
   * Get aggregate statistics
   */
  getAggregateStats(): {
    totalConnections: number;
    currentConnections: number;
    totalMessages: number;
    totalErrors: number;
  } {
    let totalConnections = 0;
    let currentConnections = 0;
    let totalMessages = 0;
    let totalErrors = 0;

    for (const manager of this.managers.values()) {
      const stats = manager.getStats();
      totalConnections += stats.totalConnections;
      currentConnections += stats.currentConnections;
      totalMessages += stats.totalMessages;
      totalErrors += stats.totalErrors;
    }

    return {
      totalConnections,
      currentConnections,
      totalMessages,
      totalErrors,
    };
  }

  /**
   * Destroy all managers
   */
  destroy(): void {
    for (const manager of this.managers.values()) {
      manager.destroy();
    }
    this.managers.clear();
  }
}
