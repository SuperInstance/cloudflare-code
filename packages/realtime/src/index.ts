/**
 * ClaudeFlare Real-Time Communication Package
 *
 * Advanced WebSocket handling with multiplexing, presence tracking, and scalability
 *
 * @package @claudeflare/realtime
 * @version 1.0.0
 */

// Export all main components
export * from './types';
export * from './utils';

// Export WebSocket Manager
export * from './websocket/manager';
import { WebSocketManager } from './websocket/manager';
export { WebSocketManager };

// Export Multiplexer
export * from './multiplexer/multiplexer';
import { Multiplexer } from './multiplexer/multiplexer';
export { Multiplexer };

// Export Presence System
export * from './presence/system';
import { PresenceSystem } from './presence/system';
export { PresenceSystem };

// Export Scalability Engine
export * from './scalability/engine';
import { ScalabilityEngine } from './scalability/engine';
export { ScalabilityEngine };

// Main RealTime class that orchestrates all components
export interface RealTimeConfig {
  websocket?: Partial<import('./websocket/manager').WebSocketManagerConfig>;
  multiplexer?: Partial<import('./multiplexer/multiplexer').MultiplexerConfig>;
  presence?: Partial<import('./presence/system').PresenceConfig>;
  scalability?: Partial<import('./scalability/engine').ScalabilityConfig>;
  enableMetrics?: boolean;
  enableLogging?: boolean;
}

export class RealTime {
  private websocketManager: WebSocketManager;
  private multiplexer: Multiplexer;
  private presenceSystem: PresenceSystem;
  private scalabilityEngine: ScalabilityEngine;
  private logger?: any;
  private config: RealTimeConfig;

  constructor(config: RealTimeConfig = {}) {
    this.config = config;

    // Initialize logger if provided or create default
    if (config.enableLogging) {
      // In a real implementation, this would use a proper logger
      this.logger = {
        info: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.debug
      };
    }

    // Initialize all components
    this.websocketManager = new WebSocketManager(config.websocket || {}, this.logger);
    this.multiplexer = new Multiplexer(config.multiplexer || {}, this.logger);
    this.presenceSystem = new PresenceSystem(config.presence || {}, this.logger);
    this.scalabilityEngine = new ScalabilityEngine(config.scalability || {}, this.logger);

    // Setup cross-component communication
    this.setupEventBridging();
  }

  /**
   * Initialize the real-time system
   */
  public async initialize(): Promise<void> {
    console.log('Initializing ClaudeFlare Real-Time Communication System...');

    // Start all components
    await Promise.all([
      this.websocketManager.getHealth(),
      this.multiplexer.getStats(),
      this.presenceSystem.getStats(),
      this.scalabilityEngine.getHealth()
    ]);

    console.log('Real-Time Communication System initialized successfully');
    console.log(`WebSocket Manager: ${this.websocketManager.getStats().connections.active} connections`);
    console.log(`Multiplexer: ${this.multiplexer.getStats().channels.total} channels`);
    console.log(`Presence System: ${this.presenceSystem.getStats().totalUsers} users`);
    console.log(`Scalability Engine: ${this.scalabilityEngine.getClusterStats().healthyNodes} healthy nodes`);
  }

  /**
   * Handle incoming WebSocket connection
   */
  public async handleConnection(socket: WebSocket, namespace: string, userId?: string, metadata: any = {}): Promise<string> {
    // Accept connection with WebSocket manager
    const connectionId = await this.websocketManager.acceptConnection(socket, namespace, userId, metadata);

    // Initialize presence for user
    if (userId) {
      await this.presenceSystem.initializePresence(userId, connectionId, {
        connectionId,
        metadata
      });
    }

    // Set up event handlers
    this.setupConnectionHandlers(connectionId, socket, userId);

    return connectionId;
  }

  /**
   * Handle incoming message
   */
  public async handleMessage(connectionId: string, data: any): Promise<void> {
    const connection = this.websocketManager.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    // Parse message
    const message = this.parseMessage(data);

    // Handle different message types
    switch (message.type) {
      case 'subscribe':
        await this.handleSubscribe(connectionId, message);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribe(connectionId, message);
        break;

      case 'publish':
        await this.handlePublish(connectionId, message);
        break;

      case 'direct':
        await this.handleDirectMessage(connectionId, message);
        break;

      case 'presence':
        await this.handlePresenceUpdate(connectionId, message);
        break;

      default:
        await this.handleCustomMessage(connectionId, message);
    }
  }

  /**
   * Parse incoming message
   */
  private parseMessage(data: any): any {
    try {
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      return data;
    } catch (error) {
      throw new Error('Invalid message format');
    }
  }

  /**
   * Handle subscription request
   */
  private async handleSubscribe(connectionId: string, message: any): Promise<void> {
    const connection = this.websocketManager.getConnection(connectionId);
    if (!connection) return;

    const { channel, userId = connection.userId } = message;

    if (!channel) {
      throw new Error('Channel is required for subscription');
    }

    // Subscribe to channel
    await this.multiplexer.subscribe(channel, userId || connectionId, {
      connectionId,
      userId: connection.userId,
      metadata: connection.metadata
    });

    // Send confirmation
    await this.websocketManager.sendMessage(connection, {
      type: 'subscription:confirmed',
      channel,
      timestamp: Date.now()
    });
  }

  /**
   * Handle unsubscription request
   */
  private async handleUnsubscribe(connectionId: string, message: any): Promise<void> {
    const connection = this.websocketManager.getConnection(connectionId);
    if (!connection) return;

    const { channel, userId = connection.userId } = message;

    if (!channel) {
      throw new Error('Channel is required for unsubscription');
    }

    // Unsubscribe from channel
    await this.multiplexer.unsubscribe(channel, userId || connectionId);

    // Send confirmation
    await this.websocketManager.sendMessage(connection, {
      type: 'unsubscription:confirmed',
      channel,
      timestamp: Date.now()
    });
  }

  /**
   * Handle publish request
   */
  private async handlePublish(connectionId: string, message: any): Promise<void> {
    const connection = this.websocketManager.getConnection(connectionId);
    if (!connection) return;

    const { channel, payload, broadcast = false } = message;

    if (!channel || !payload) {
      throw new Error('Channel and payload are required for publish');
    }

    // Publish to channel
    await this.multiplexer.publish(channel, payload, connectionId, broadcast);

    // Send acknowledgment
    await this.websocketManager.sendMessage(connection, {
      type: 'publish:acknowledged',
      channel,
      timestamp: Date.now()
    });
  }

  /**
   * Handle direct message
   */
  private async handleDirectMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.websocketManager.getConnection(connectionId);
    if (!connection) return;

    const { target, payload } = message;

    if (!target || !payload) {
      throw new Error('Target and payload are required for direct message');
    }

    // Update presence activity
    if (connection.userId) {
      await this.presenceSystem.updateActivity(connection.userId);
    }

    // Send direct message (in a real implementation, this would route to the target user)
    await this.websocketManager.sendMessage(connection, {
      type: 'message:delivered',
      target,
      timestamp: Date.now()
    });
  }

  /**
   * Handle presence update
   */
  private async handlePresenceUpdate(connectionId: string, message: any): Promise<void> {
    const connection = this.websocketManager.getConnection(connectionId);
    if (!connection || !connection.userId) return;

    const { status } = message;

    if (status && ['online', 'away', 'busy', 'offline'].includes(status)) {
      await this.presenceSystem.updateStatus(connection.userId, status);
    }

    // Send updated presence
    const presence = this.presenceSystem.getUserPresence(connection.userId);
    await this.websocketManager.sendMessage(connection, {
      type: 'presence:updated',
      status: presence?.status,
      timestamp: Date.now()
    });
  }

  /**
   * Handle custom message
   */
  private async handleCustomMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.websocketManager.getConnection(connectionId);
    if (!connection) return;

    // Forward to multiplexer for custom handling
    await this.multiplexer.publish('custom', message, connectionId, false);

    // Send acknowledgment
    await this.websocketManager.sendMessage(connection, {
      type: 'message:processed',
      messageId: message.id,
      timestamp: Date.now()
    });
  }

  /**
   * Setup connection handlers
   */
  private setupConnectionHandlers(connectionId: string, socket: WebSocket, userId?: string): void {
    // Handle connection close
    socket.on('close', async () => {
      if (userId) {
        await this.presenceSystem.removeConnection(userId, connectionId);
      }
    });

    // Handle connection error
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Listen for WebSocket manager events
    this.websocketManager.on('connection', (event: any) => {
      if (event.connectionId === connectionId) {
        // Handle connection-specific events
      }
    });
  }

  /**
   * Setup event bridging between components
   */
  private setupEventBridging(): void {
    // WebSocket Manager -> Multiplexer
    this.websocketManager.on('custom-message', async (event: any) => {
      try {
        const { message, connectionId } = event;

        // Route message through multiplexer if it has a channel
        if (message.channel) {
          await this.multiplexer.publish(message.channel, message, connectionId, false);
        }
      } catch (error) {
        console.error('Error bridging WebSocket to Multiplexer:', error);
      }
    });

    // Multiplexer -> Presence System
    this.multiplexer.on('subscribe', async (event: any) => {
      try {
        const { channel, userId } = event;

        // Update user activity on subscription
        if (userId) {
          await this.presenceSystem.updateActivity(userId, {
            action: 'subscribe',
            channel
          });
        }
      } catch (error) {
        console.error('Error bridging Multiplexer to Presence:', error);
      }
    });

    // Presence System -> WebSocket Manager
    this.presenceSystem.on('status:change', async (event: any) => {
      try {
        const { userId, newStatus } = event;

        // Notify connected clients of status change
        const connections = this.websocketManager.getConnectionsByUser(userId);
        for (const connection of connections) {
          await this.websocketManager.sendMessage(connection, {
            type: 'presence:status_changed',
            userId,
            status: newStatus,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Error bridging Presence to WebSocket:', error);
      }
    });

    // Scalability Engine -> All components
    this.scalabilityEngine.on('cluster', async (event: any) => {
      try {
        switch (event.type) {
          case 'node_join':
            // Handle new node joining
            console.log('New node joined cluster:', event.nodeId);
            break;

          case 'node_leave':
            // Handle node leaving
            console.log('Node left cluster:', event.nodeId);
            break;

          case 'migrate':
            // Handle connection migration
            console.log('Connection migration:', event.data);
            break;
        }
      } catch (error) {
        console.error('Error handling cluster event:', error);
      }
    });
  }

  /**
   * Get system statistics
   */
  public getStats(): {
    websocket: any;
    multiplexer: any;
    presence: any;
    scalability: any;
  } {
    return {
      websocket: this.websocketManager.getStats(),
      multiplexer: this.multiplexer.getStats(),
      presence: this.presenceSystem.getStats(),
      scalability: this.scalabilityEngine.getClusterStats()
    };
  }

  /**
   * Get health status
   */
  public async getHealth(): Promise<any> {
    const [websocketHealth, multiplexerHealth, presenceHealth, scalabilityHealth] = await Promise.all([
      this.websocketManager.getHealth(),
      this.multiplexer.getStats(),
      this.presenceSystem.getHealth(),
      this.scalabilityEngine.getHealth()
    ]);

    return {
      healthy: websocketHealth.healthy && presenceHealth.healthy && scalabilityHealth.healthy,
      components: {
        websocket: websocketHealth,
        multiplexer: { ...multiplexerHealth, channels: multiplexerHealth.channels.active },
        presence: presenceHealth,
        scalability: scalabilityHealth
      },
      timestamp: Date.now()
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down ClaudeFlare Real-Time Communication System...');

    await Promise.all([
      this.websocketManager.dispose(),
      this.multiplexer.dispose(),
      this.presenceSystem.dispose(),
      this.scalabilityEngine.dispose()
    ]);

    console.log('Real-Time Communication System shutdown completed');
  }

  // Getters for individual components
  public getWebSocketManager(): WebSocketManager {
    return this.websocketManager;
  }

  public getMultiplexer(): Multiplexer {
    return this.multiplexer;
  }

  public getPresenceSystem(): PresenceSystem {
    return this.presenceSystem;
  }

  public getScalabilityEngine(): ScalabilityEngine {
    return this.scalabilityEngine;
  }
}

// Export the main class
export { RealTime };

// Export version
export const version = '1.0.0';

// Export default instance
export default RealTime;