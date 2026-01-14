/**
 * Real-time Client and Server Factories
 * Provides easy-to-use APIs for client and server sides
 */

import type {
  AnyMessage,
  MessageType,
  Connection,
  WebSocketConfig,
  WebSocketServerOptions,
  MessageAck,
} from './types';
import {
  ConnectionManager,
  ReconnectionManager,
} from './connection';
import {
  RoomManager,
  RoomEventBroadcaster,
} from './rooms';
import {
  PresenceTracker,
} from './presence';
import {
  MessageHandler,
  MessageBatcher,
} from './messaging';
import { generateId } from '../utils';

/**
 * Real-time client options
 */
export interface RealtimeClientOptions {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  enableCompression?: boolean;
  debug?: boolean;
}

/**
 * Real-time client class
 */
export class RealtimeClient {
  private ws: WebSocket | null;
  private options: RealtimeClientOptions;
  private messageHandlers: Map<MessageType, Set<(message: AnyMessage) => void>>;
  private reconnectAttempts: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null;
  private pendingAcks: Map<string, {
    resolve: (ack: MessageAck) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>;
  private connected: boolean;
  private connectionId: string | null;

  constructor(options: RealtimeClientOptions) {
    this.options = {
      reconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      enableCompression: true,
      debug: false,
      ...options,
    };

    this.ws = null;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.pendingAcks = new Map();
    this.connected = false;
    this.connectionId = null;

    this.connect();
  }

  /**
   * Connect to server
   */
  connect(): void {
    try {
      this.ws = new WebSocket(this.options.url, this.options.protocols);

      this.ws.onopen = () => {
        this.log('Connected to server');
        this.connected = true;
        this.reconnectAttempts = 0;

        // Start heartbeat
        this.startHeartbeat();

        // Send connect message
        this.sendMessage({
          type: 'connect' as MessageType.CONNECT,
          id: generateId('msg'),
          timestamp: Date.now(),
          data: {
            userId: 'client',
            sessionId: generateId('session'),
            reconnect: this.reconnectAttempts > 0,
          },
        });
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        this.log(`Disconnected: ${event.code} ${event.reason}`);
        this.connected = false;
        this.stopHeartbeat();

        // Attempt reconnection
        if (this.options.reconnect && this.reconnectAttempts < (this.options.maxReconnectAttempts ?? 5)) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this.log('WebSocket error:', error);
      };
    } catch (error) {
      this.log('Connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.connected = false;
  }

  /**
   * Send message to server
   */
  sendMessage(message: AnyMessage): Promise<MessageAck> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      // Set up ack timeout
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(message.id);
        reject(new Error('Acknowledgement timeout'));
      }, 30000);

      this.pendingAcks.set(message.id, { resolve, reject, timeout });

      // Serialize and send
      const serialized = this.serializeMessage(message);
      this.ws.send(serialized);
    });
  }

  /**
   * Join a room
   */
  async joinRoom(roomId: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendMessage({
      type: 'join_room' as MessageType.JOIN_ROOM,
      id: generateId('msg'),
      timestamp: Date.now(),
      data: { roomId, metadata },
    });
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string): Promise<void> {
    await this.sendMessage({
      type: 'leave_room' as MessageType.LEAVE_ROOM,
      id: generateId('msg'),
      timestamp: Date.now(),
      data: { roomId },
    });
  }

  /**
   * Send chat message
   */
  async sendChatMessage(
    roomId: string,
    content: string,
    contentType?: 'text' | 'code' | 'markdown' | 'json'
  ): Promise<void> {
    await this.sendMessage({
      type: 'message' as MessageType.MESSAGE,
      id: generateId('msg'),
      timestamp: Date.now(),
      data: {
        roomId,
        content,
        contentType,
      },
    });
  }

  /**
   * Update presence
   */
  async updatePresence(
    status: 'online' | 'away' | 'busy' | 'offline',
    customStatus?: string
  ): Promise<void> {
    await this.sendMessage({
      type: 'presence_update' as MessageType.PRESENCE_UPDATE,
      id: generateId('msg'),
      timestamp: Date.now(),
      data: { status, customStatus },
    });
  }

  /**
   * Subscribe to message type
   */
  on(type: MessageType, handler: (message: AnyMessage) => void): () => void {
    let handlers = this.messageHandlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.messageHandlers.set(type, handlers);
    }

    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(type);
      }
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: ArrayBuffer | string): void {
    try {
      const message = this.deserializeMessage(data);

      // Handle acknowledgements
      if (message.type === 'message_ack') {
        const ack = message.metadata?.ack as MessageAck;
        if (ack) {
          const pending = this.pendingAcks.get(ack.messageId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingAcks.delete(ack.messageId);
            pending.resolve(ack);
          }
        }
        return;
      }

      // Route to handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch (error) {
            this.log('Error in message handler:', error);
          }
        }
      }

      // Handle pong
      if (message.type === 'pong') {
        this.log('Pong received');
      }
    } catch (error) {
      this.log('Error handling message:', error);
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const delay = (this.options.reconnectDelay ?? 1000) * Math.pow(2, this.reconnectAttempts);

    this.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({
          type: 'ping' as MessageType.PING,
          id: generateId('msg'),
          timestamp: Date.now(),
        }).catch((error) => {
          this.log('Heartbeat error:', error);
        });
      }
    }, this.options.heartbeatInterval ?? 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Serialize message
   */
  private serializeMessage(message: AnyMessage): string | ArrayBuffer {
    return JSON.stringify(message);
  }

  /**
   * Deserialize message
   */
  private deserializeMessage(data: ArrayBuffer | string): AnyMessage {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    const text = new TextDecoder().decode(data);
    return JSON.parse(text);
  }

  /**
   * Log message if debug enabled
   */
  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[RealtimeClient]', ...args);
    }
  }
}

/**
 * Real-time server class
 */
export class RealtimeServer {
  private connectionManager: ConnectionManager;
  private roomManager: RoomManager;
  private presenceTracker: PresenceTracker;
  private messageHandler: MessageHandler;
  private messageBatcher: MessageBatcher;
  private roomEventBroadcaster: RoomEventBroadcaster;
  private options: WebSocketServerOptions;

  constructor(options?: WebSocketServerOptions) {
    this.options = options ?? {};

    this.messageHandler = new MessageHandler();
    this.connectionManager = new ConnectionManager(
      {
        maxConnections: 10000,
        maxConnectionsPerUser: 10,
        enableMetrics: true,
      },
      this.messageHandler
    );
    this.roomManager = new RoomManager();
    this.presenceTracker = new PresenceTracker();
    this.messageBatcher = new MessageBatcher();
    this.roomEventBroadcaster = new RoomEventBroadcaster();

    this.setupEventHandlers();
  }

  /**
   * Accept WebSocket connection
   */
  async acceptConnection(
    websocket: WebSocket,
    userId: string,
    sessionId: string,
    metadata?: Record<string, unknown>
  ): Promise<Connection> {
    const connectMessage = {
      type: 'connect' as MessageType.CONNECT,
      id: generateId('msg'),
      timestamp: Date.now(),
      data: {
        userId,
        sessionId,
        metadata,
      },
    } as AnyMessage;

    return this.connectionManager.acceptConnection(websocket, connectMessage);
  }

  /**
   * Broadcast message to room
   */
  async broadcastToRoom(
    roomId: string,
    message: AnyMessage
  ): Promise<number> {
    const connections = this.roomManager.getRoomMembers(roomId);
    let delivered = 0;

    for (const userId of connections) {
      const userConnections = this.connectionManager.getUserConnections(userId);
      for (const conn of userConnections) {
        if (conn.socket.readyState === WebSocket.OPEN) {
          await this.messageHandler.sendMessage(message, conn);
          delivered++;
        }
      }
    }

    return delivered;
  }

  /**
   * Send message to user
   */
  async sendToUser(
    userId: string,
    message: AnyMessage
  ): Promise<boolean> {
    const connections = this.connectionManager.getUserConnections(userId);

    for (const conn of connections) {
      if (conn.socket.readyState === WebSocket.OPEN) {
        await this.messageHandler.sendMessage(message, conn);
        return true;
      }
    }

    return false;
  }

  /**
   * Get room members
   */
  getRoomMembers(roomId: string): string[] {
    return this.roomManager.getRoomMembers(roomId);
  }

  /**
   * Get user presence
   */
  getUserPresence(userId: string) {
    return this.presenceTracker.getPresence(userId);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      connections: this.connectionManager.getStats(),
      rooms: this.roomManager.getStats(),
      presence: this.presenceTracker.getStats(),
      messages: this.messageHandler.getStats(),
    };
  }

  /**
   * Destroy server
   */
  destroy(): void {
    this.connectionManager.destroy();
    this.presenceTracker.destroy();
    this.messageHandler.destroy();
    this.messageBatcher.clear();
    this.roomEventBroadcaster.unsubscribeAll();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Connection events
    if (this.options.onConnectionStateChange) {
      this.connectionManager.onEvent((event) => {
        if (event.type === 'state_changed') {
          const conn = this.connectionManager.getConnection(event.connectionId);
          if (conn && event.data && typeof event.data === 'object' && 'newState' in event.data) {
            this.options.onConnectionStateChange?.(
              event.data.newState as any,
              conn
            );
          }
        }
      });
    }

    // Room events
    if (this.options.onRoomEvent) {
      // Subscribe to room events
      this.roomEventBroadcaster.subscribe('*', (event) => {
        this.options.onRoomEvent?.(event);
      });
    }

    // Presence changes
    if (this.options.onPresenceChange) {
      this.presenceTracker.subscribe((event) => {
        const presence = this.presenceTracker.getPresence(event.userId);
        if (presence) {
          this.options.onPresenceChange?.(presence);
        }
      });
    }

    // Message handler
    if (this.options.onMessage) {
      // Message handler is passed to ConnectionManager
    }

    // Error handler
    if (this.options.onError) {
      this.connectionManager.onEvent((event) => {
        if (event.type === 'error') {
          const conn = this.connectionManager.getConnection(event.connectionId);
          this.options.onError?.(new Error('Connection error'), conn);
        }
      });
    }
  }
}

/**
 * Create real-time client
 */
export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  return new RealtimeClient(options);
}

/**
 * Create real-time server
 */
export function createRealtimeServer(options?: WebSocketServerOptions): RealtimeServer {
  return new RealtimeServer(options);
}
