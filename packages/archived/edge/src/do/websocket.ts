/**
 * WebSocket Durable Object
 * Real-time communication hub using Durable Objects for WebSocket state management
 *
 * Features:
 * - 10K+ concurrent connections per DO instance
 * - Room-based messaging
 * - Presence tracking
 * - Message queuing and delivery guarantees
 * - Automatic reconnection with exponential backoff
 * - Bidirectional streaming for LLM responses
 */

import type {
  Env,
} from '../types';
import type {
  Connection,
  ConnectionState,
  AnyMessage,
  MessageType,
  ConnectMessage,
  DisconnectMessage,
  JoinRoomMessage,
  LeaveRoomMessage,
  ChatMessage,
  PresenceUpdateMessage,
  WebSocketConfig,
  WebSocketServerOptions,
  MetricsData,
  RoomEvent,
} from '../lib/realtime/types';
import {
  ConnectionManager,
  ReconnectionManager,
} from '../lib/realtime/connection';
import {
  RoomManager,
  RoomEventBroadcaster,
} from '../lib/realtime/rooms';
import {
  PresenceTracker,
} from '../lib/realtime/presence';
import {
  MessageHandler,
  MessageBatcher,
} from '../lib/realtime/messaging';
import { generateId } from '../lib/utils';

/**
 * WebSocket DO state stored in Durable Object storage
 */
interface WebSocketDOState {
  connections: Map<string, Connection>;
  rooms: Map<string, RoomEvent>;
  presence: Map<string, ConnectionState>;
  metrics: {
    totalConnections: number;
    totalMessages: number;
    totalErrors: number;
  };
}

/**
 * WebSocket Durable Object
 */
export class WebSocketDO {
  private state: DurableObjectState;
  private env: Env;
  private connectionManager: ConnectionManager;
  private roomManager: RoomManager;
  private presenceTracker: PresenceTracker;
  private messageHandler: MessageHandler;
  private messageBatcher: MessageBatcher;
  private roomEventBroadcaster: RoomEventBroadcaster;
  private reconnectionManager: ReconnectionManager;
  private config: WebSocketConfig;
  private metrics: MetricsData;
  private startTime: number;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.startTime = Date.now();

    // Initialize configuration
    this.config = {
      maxConnections: 10000,
      maxConnectionsPerUser: 10,
      maxRoomsPerUser: 100,
      connectionTimeout: 30 * 1000,
      heartbeatInterval: 30 * 1000,
      heartbeatTimeout: 60 * 1000,
      messageTimeout: 10 * 1000,
      maxQueueSize: 10000,
      maxRetries: 3,
      messageTTL: 60 * 1000,
      reconnection: {
        enabled: true,
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryOn: [1000, 1001, 1006],
      },
      enableCompression: true,
      enableBatching: true,
      batchSize: 100,
      batchTimeout: 100,
      enableAuthentication: false,
      maxMessageSize: 1024 * 1024,
      rateLimitPerSecond: 100,
    };

    // Initialize components
    this.messageHandler = new MessageHandler({
      maxQueueSize: this.config.maxQueueSize,
      maxRetries: this.config.maxRetries,
      messageTTL: this.config.messageTTL,
      enableBatching: this.config.enableBatching,
      batchSize: this.config.batchSize,
      batchTimeout: this.config.batchTimeout,
      maxMessageSize: this.config.maxMessageSize,
      rateLimitPerSecond: this.config.rateLimitPerSecond,
    });

    this.connectionManager = new ConnectionManager({
      maxConnections: this.config.maxConnections,
      maxConnectionsPerUser: this.config.maxConnectionsPerUser,
      connectionTimeout: this.config.connectionTimeout,
      heartbeatInterval: this.config.heartbeatInterval,
      heartbeatTimeout: this.config.heartbeatTimeout,
      enableMetrics: true,
    }, this.messageHandler);

    this.roomManager = new RoomManager({
      maxRooms: 1000,
      maxMembersPerRoom: 1000,
      maxRoomsPerUser: this.config.maxRoomsPerUser,
    });

    this.presenceTracker = new PresenceTracker();

    this.messageBatcher = new MessageBatcher(
      this.config.batchSize,
      this.config.batchTimeout
    );

    this.roomEventBroadcaster = new RoomEventBroadcaster();

    this.reconnectionManager = new ReconnectionManager(
      this.config.reconnection,
      (connectionId, attempt) => this.handleReconnect(connectionId, attempt)
    );

    // Initialize metrics
    this.metrics = {
      timestamp: Date.now(),
      connections: {
        total: 0,
        active: 0,
        connecting: 0,
        disconnected: 0,
      },
      messages: {
        sent: 0,
        received: 0,
        failed: 0,
        queued: 0,
      },
      rooms: {
        total: 0,
        active: 0,
      },
      performance: {
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        throughput: 0,
      },
      errors: {
        count: 0,
        rate: 0,
      },
    };

    // Setup event handlers
    this.setupEventHandlers();

    // Initialize from storage
    this.initializeFromStorage();
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Handle WebSocket upgrade
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocketUpgrade(request);
      }

      // Handle HTTP requests
      switch (path) {
        case '/health':
          return this.handleHealthCheck();

        case '/metrics':
          return this.handleGetMetrics();

        case '/stats':
          return this.handleGetStats();

        case '/rooms':
          if (request.method === 'GET') {
            return this.handleGetRooms();
          } else if (request.method === 'POST') {
            return this.handleCreateRoom(request);
          }
          break;

        case '/broadcast':
          if (request.method === 'POST') {
            return this.handleBroadcast(request);
          }
          break;

        case '/presence':
          if (request.method === 'GET') {
            return this.handleGetPresence(url);
          }
          break;

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Error in WebSocketDO.fetch:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle WebSocket upgrade request
   */
  private handleWebSocketUpgrade(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the server socket
    server.accept();

    // Setup WebSocket event handlers
    server.addEventListener('open', async () => {
      await this.handleWebSocketOpen(server, request);
    });

    server.addEventListener('message', async (event) => {
      await this.handleWebSocketMessage(server, event);
    });

    server.addEventListener('close', (event) => {
      this.handleWebSocketClose(server, event.code, event.reason);
    });

    server.addEventListener('error', (error) => {
      this.handleWebSocketError(server, error);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket connection opened
   */
  private async handleWebSocketOpen(socket: WebSocket, request: Request): Promise<void> {
    try {
      // Parse query parameters for initial connection data
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId') ?? 'anonymous';
      const sessionId = url.searchParams.get('sessionId') ?? generateId('session');

      // Create connect message
      const connectMessage: ConnectMessage = {
        type: 'connect' as MessageType.CONNECT,
        id: generateId('msg'),
        timestamp: Date.now(),
        data: {
          userId,
          sessionId,
          reconnect: false,
        },
      };

      // Accept connection
      const connection = await this.connectionManager.acceptConnection(
        socket,
        connectMessage,
        this.config
      );

      // Update presence
      this.presenceTracker.connect(userId, connection.connectionId, {
        capabilities: connection.capabilities,
      });

      // Update metrics
      this.metrics.connections.active++;
      this.metrics.connections.total++;

      await this.persistState();
    } catch (error) {
      console.error('Error handling WebSocket open:', error);
      socket.close(1011, 'Connection failed');
    }
  }

  /**
   * Handle WebSocket message
   */
  private async handleWebSocketMessage(socket: WebSocket, event: MessageEvent): Promise<void> {
    const startTime = performance.now();

    try {
      // Deserialize message
      const message = this.messageHandler.deserializeMessage(event.data);

      // Update metrics
      this.metrics.messages.received++;

      // Route message based on type
      switch (message.type) {
        case 'ping':
          await this.handlePing(socket, message);
          break;

        case 'pong':
          await this.handlePong(socket, message);
          break;

        case 'join_room':
          await this.handleJoinRoom(socket, message as JoinRoomMessage);
          break;

        case 'leave_room':
          await this.handleLeaveRoom(socket, message as LeaveRoomMessage);
          break;

        case 'message':
          await this.handleChatMessage(socket, message as ChatMessage);
          break;

        case 'presence_update':
          await this.handlePresenceUpdate(socket, message as PresenceUpdateMessage);
          break;

        case 'disconnect':
          await this.handleDisconnect(socket, message as DisconnectMessage);
          break;

        case 'stream_start':
        case 'stream_data':
        case 'stream_end':
          await this.handleStreamMessage(socket, message);
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }

      // Update performance metrics
      const latency = performance.now() - startTime;
      this.updateLatencyMetrics(latency);

    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.metrics.errors.count++;

      // Send error message to client
      const errorMessage: AnyMessage = {
        type: 'error' as MessageType.ERROR,
        id: generateId('msg'),
        timestamp: Date.now(),
        data: {
          code: 'MESSAGE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
      };

      try {
        socket.send(this.messageHandler.serializeMessage(errorMessage));
      } catch (sendError) {
        console.error('Error sending error message:', sendError);
      }
    }
  }

  /**
   * Handle WebSocket close
   */
  private handleWebSocketClose(socket: WebSocket, code: number, reason: string): void {
    // Find and remove connection
    const connections = this.connectionManager.getAllConnections();
    const connection = connections.find(c => c.socket === socket);

    if (connection) {
      // Update presence
      this.presenceTracker.disconnect(connection.connectionId);

      // Remove from rooms
      for (const roomId of connection.rooms) {
        this.roomManager.leaveRoom(roomId, connection.userId);
      }

      // Update metrics
      this.metrics.connections.active--;
      this.metrics.connections.disconnected++;

      // Check if should reconnect
      if (this.config.reconnection.retryOn.includes(code)) {
        this.reconnectionManager.scheduleReconnection(connection.connectionId);
      }

      this.persistState();
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleWebSocketError(socket: WebSocket, error: Event): void {
    console.error('WebSocket error:', error);
    this.metrics.errors.count++;

    const connections = this.connectionManager.getAllConnections();
    const connection = connections.find(c => c.socket === socket);

    if (connection) {
      this.connectionManager.updateConnectionState(
        connection.connectionId,
        'disconnected'
      );
    }
  }

  /**
   * Handle ping message
   */
  private async handlePing(socket: WebSocket, message: AnyMessage): Promise<void> {
    const pongMessage: AnyMessage = {
      type: 'pong' as MessageType.PONG,
      id: generateId('msg'),
      timestamp: Date.now(),
      metadata: {
        pingId: message.id,
        pingTimestamp: message.timestamp,
      },
    };

    const serialized = this.messageHandler.serializeMessage(pongMessage);
    socket.send(serialized);

    this.metrics.messages.sent++;
  }

  /**
   * Handle pong message
   */
  private async handlePong(socket: WebSocket, message: AnyMessage): Promise<void> {
    // Update connection activity
    const connections = this.connectionManager.getAllConnections();
    const connection = connections.find(c => c.socket === socket);

    if (connection) {
      this.connectionManager.updateActivity(connection.connectionId);
    }
  }

  /**
   * Handle join room message
   */
  private async handleJoinRoom(socket: WebSocket, message: JoinRoomMessage): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    const connection = connections.find(c => c.socket === socket);

    if (!connection) {
      throw new Error('Connection not found');
    }

    const { roomId, metadata } = message.data;

    // Join room
    const membership = this.roomManager.joinRoom(
      roomId,
      connection.userId,
      metadata
    );

    // Add to connection
    this.connectionManager.addRoomToConnection(connection.connectionId, roomId);

    // Broadcast user joined event
    const roomEvent: RoomEvent = {
      type: 'user_joined',
      roomId,
      userId: connection.userId,
      timestamp: Date.now(),
      data: {
        userId: connection.userId,
        membership,
      },
    };

    this.roomEventBroadcaster.broadcast(roomEvent);

    // Broadcast to room members
    const roomMembers = this.roomManager.getRoomMembers(roomId);
    for (const memberUserId of roomMembers) {
      const memberConnections = this.connectionManager.getUserConnections(memberUserId);
      for (const memberConn of memberConnections) {
        if (memberConn.socket.readyState === WebSocket.OPEN) {
          const joinMessage: AnyMessage = {
            type: 'user_joined' as MessageType,
            id: generateId('msg'),
            timestamp: Date.now(),
            metadata: {
              roomId,
              userId: connection.userId,
            },
          };

          await this.messageHandler.sendMessage(joinMessage, memberConn);
        }
      }
    }

    // Update presence
    this.presenceTracker.updateActivity(connection.userId, undefined, undefined);

    this.metrics.rooms.active++;
  }

  /**
   * Handle leave room message
   */
  private async handleLeaveRoom(socket: WebSocket, message: LeaveRoomMessage): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    const connection = connections.find(c => c.socket === socket);

    if (!connection) {
      throw new Error('Connection not found');
    }

    const { roomId } = message.data;

    // Leave room
    this.roomManager.leaveRoom(roomId, connection.userId);

    // Remove from connection
    this.connectionManager.removeRoomFromConnection(connection.connectionId, roomId);

    // Broadcast user left event
    const roomEvent: RoomEvent = {
      type: 'user_left',
      roomId,
      userId: connection.userId,
      timestamp: Date.now(),
      data: {
        userId: connection.userId,
      },
    };

    this.roomEventBroadcaster.broadcast(roomEvent);

    // Broadcast to room members
    const roomMembers = this.roomManager.getRoomMembers(roomId);
    for (const memberUserId of roomMembers) {
      const memberConnections = this.connectionManager.getUserConnections(memberUserId);
      for (const memberConn of memberConnections) {
        if (memberConn.socket.readyState === WebSocket.OPEN) {
          const leaveMessage: AnyMessage = {
            type: 'user_left' as MessageType,
            id: generateId('msg'),
            timestamp: Date.now(),
            metadata: {
              roomId,
              userId: connection.userId,
            },
          };

          await this.messageHandler.sendMessage(leaveMessage, memberConn);
        }
      }
    }

    this.metrics.rooms.active--;
  }

  /**
   * Handle chat message
   */
  private async handleChatMessage(socket: WebSocket, message: ChatMessage): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    const connection = connections.find(c => c.socket === socket);

    if (!connection) {
      throw new Error('Connection not found');
    }

    const { roomId, content, contentType, replyTo, mentions, ephemeral } = message.data;

    // Add to room history if not ephemeral
    if (roomId && !ephemeral) {
      this.roomManager.addMessageToHistory(roomId, message);
    }

    // Broadcast to room members or specific connection
    if (roomId) {
      const roomMembers = this.roomManager.getRoomMembers(roomId);
      for (const memberUserId of roomMembers) {
        // Skip sender if broadcast to all
        if (memberUserId === connection.userId && !mentions?.includes(connection.userId)) {
          continue;
        }

        const memberConnections = this.connectionManager.getUserConnections(memberUserId);
        for (const memberConn of memberConnections) {
          if (memberConn.socket.readyState === WebSocket.OPEN) {
            await this.messageHandler.sendMessage(message, memberConn);
            this.metrics.messages.sent++;
          }
        }
      }
    }

    this.metrics.messages.sent++;
  }

  /**
   * Handle presence update message
   */
  private async handlePresenceUpdate(
    socket: WebSocket,
    message: PresenceUpdateMessage
  ): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    const connection = connections.find(c => c.socket === socket);

    if (!connection) {
      throw new Error('Connection not found');
    }

    const { status, customStatus } = message.data;

    // Update presence
    this.presenceTracker.updateActivity(connection.userId, status, customStatus);
  }

  /**
   * Handle disconnect message
   */
  private async handleDisconnect(socket: WebSocket, message: DisconnectMessage): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    const connection = connections.find(c => c.socket === socket);

    if (!connection) {
      return;
    }

    const { reason, code } = message.data;

    // Close connection
    socket.close(code ?? 1000, reason ?? 'Client disconnect');

    // Update presence
    this.presenceTracker.disconnect(connection.connectionId);
  }

  /**
   * Handle stream message
   */
  private async handleStreamMessage(socket: WebSocket, message: AnyMessage): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    const connection = connections.find(c => c.socket === socket);

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Route stream data to target connection or room
    const streamId = message.metadata?.streamId as string;
    const targetUserId = message.metadata?.targetUserId as string;
    const targetRoomId = message.metadata?.targetRoomId as string;

    if (targetUserId) {
      // Direct to user
      const targetConnections = this.connectionManager.getUserConnections(targetUserId);
      for (const targetConn of targetConnections) {
        if (targetConn.socket.readyState === WebSocket.OPEN) {
          await this.messageHandler.sendMessage(message, targetConn);
          this.metrics.messages.sent++;
        }
      }
    } else if (targetRoomId) {
      // Broadcast to room
      const roomMembers = this.roomManager.getRoomMembers(targetRoomId);
      for (const memberUserId of roomMembers) {
        if (memberUserId === connection.userId) continue;

        const memberConnections = this.connectionManager.getUserConnections(memberUserId);
        for (const memberConn of memberConnections) {
          if (memberConn.socket.readyState === WebSocket.OPEN) {
            await this.messageHandler.sendMessage(message, memberConn);
            this.metrics.messages.sent++;
          }
        }
      }
    }
  }

  /**
   * Handle reconnection
   */
  private async handleReconnect(connectionId: string, attempt: number): Promise<void> {
    console.log(`Reconnection attempt ${attempt} for ${connectionId}`);

    // In a real implementation, this would attempt to re-establish connection
    // For now, we just log the attempt
  }

  /**
   * Handle health check request
   */
  private handleHealthCheck(): Response {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: Date.now() - this.startTime,
        metrics: this.metrics,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get metrics request
   */
  private handleGetMetrics(): Response {
    return new Response(
      JSON.stringify(this.metrics),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get stats request
   */
  private handleGetStats(): Response {
    const connStats = this.connectionManager.getStats();
    const roomStats = this.roomManager.getStats();
    const presenceStats = this.presenceTracker.getStats();
    const msgStats = this.messageHandler.getStats();

    return new Response(
      JSON.stringify({
        connections: connStats,
        rooms: roomStats,
        presence: presenceStats,
        messages: msgStats,
        timestamp: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get rooms request
   */
  private handleGetRooms(): Response {
    const rooms = this.roomManager.getAllRooms();

    return new Response(
      JSON.stringify({
        rooms,
        count: rooms.length,
        timestamp: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle create room request
   */
  private async handleCreateRoom(request: Request): Promise<Response> {
    const data = await request.json() as {
      name: string;
      owner: string;
      type?: 'public' | 'private' | 'direct';
      metadata?: Record<string, unknown>;
    };

    const room = this.roomManager.createRoom(
      data.name,
      data.owner,
      data.type ?? 'public',
      data.metadata ?? {}
    );

    this.metrics.rooms.total++;

    return new Response(
      JSON.stringify({ room, timestamp: Date.now() }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle broadcast request
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    const data = await request.json() as {
      message: AnyMessage;
      roomId?: string;
      userIds?: string[];
    };

    let successCount = 0;

    if (data.roomId) {
      // Broadcast to room
      const roomMembers = this.roomManager.getRoomMembers(data.roomId);
      for (const memberUserId of roomMembers) {
        const connections = this.connectionManager.getUserConnections(memberUserId);
        for (const conn of connections) {
          if (conn.socket.readyState === WebSocket.OPEN) {
            await this.messageHandler.sendMessage(data.message, conn);
            successCount++;
          }
        }
      }
    } else if (data.userIds) {
      // Broadcast to specific users
      for (const userId of data.userIds) {
        const connections = this.connectionManager.getUserConnections(userId);
        for (const conn of connections) {
          if (conn.socket.readyState === WebSocket.OPEN) {
            await this.messageHandler.sendMessage(data.message, conn);
            successCount++;
          }
        }
      }
    } else {
      // Broadcast to all connections
      const connections = this.connectionManager.getAllConnections();
      for (const conn of connections) {
        if (conn.socket.readyState === WebSocket.OPEN) {
          await this.messageHandler.sendMessage(data.message, conn);
          successCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivered: successCount,
        timestamp: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get presence request
   */
  private handleGetPresence(url: URL): Response {
    const userId = url.searchParams.get('userId');
    const roomId = url.searchParams.get('roomId');

    if (userId) {
      const presence = this.presenceTracker.getPresence(userId);
      return new Response(
        JSON.stringify({ presence, timestamp: Date.now() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (roomId) {
      const roomMembers = this.roomManager.getRoomMembers(roomId);
      const summary = this.presenceTracker.getRoomPresenceSummary(roomId, roomMembers);
      return new Response(
        JSON.stringify({ summary, timestamp: Date.now() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      const stats = this.presenceTracker.getStats();
      return new Response(
        JSON.stringify({ stats, timestamp: Date.now() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Connection events
    this.connectionManager.onEvent((event) => {
      console.log('Connection event:', event);
    });

    // Presence changes
    this.presenceTracker.subscribe((event) => {
      console.log('Presence change:', event);
    });
  }

  /**
   * Initialize state from storage
   */
  private async initializeFromStorage(): Promise<void> {
    // Load state from Durable Object storage
    const stored = await this.state.storage.get<WebSocketDOState>('state');
    if (stored) {
      // Restore state
      // In a full implementation, this would restore all components
    }
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    // Persist state to Durable Object storage
    await this.state.storage.put('state', {
      timestamp: Date.now(),
      metrics: this.metrics,
    });
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    // Simple moving average
    const alpha = 0.1;
    this.metrics.performance.avgLatency =
      this.metrics.performance.avgLatency * (1 - alpha) + latency * alpha;
  }
}

/**
 * Create WebSocket DO stub
 */
export function createWebSocketDOStub(env: Env, id: string): DurableObjectStub {
  return env.WEBSOCKET_DO.get(env.WEBSOCKET_DO.idFromName(id));
}

/**
 * Helper function to broadcast message via WebSocket DO
 */
export async function broadcastMessage(
  env: Env,
  message: AnyMessage,
  roomId?: string,
  userIds?: string[]
): Promise<boolean> {
  const stub = createWebSocketDOStub(env, 'default');

  const response = await stub.fetch(
    new Request('https://do/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message, roomId, userIds }),
    })
  );

  return response.ok;
}

/**
 * Helper function to get WebSocket DO stats
 */
export async function getWebSocketStats(env: Env): Promise<Record<string, unknown>> {
  const stub = createWebSocketDOStub(env, 'default');

  const response = await stub.fetch(
    new Request('https://do/stats', { method: 'GET' })
  );

  if (response.ok) {
    return await response.json();
  }

  throw new Error('Failed to get WebSocket stats');
}
