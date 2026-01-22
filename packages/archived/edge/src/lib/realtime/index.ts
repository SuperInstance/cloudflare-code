/**
 * Real-time Communication Module
 * Entry point for all real-time communication features
 */

// Type definitions
export * from './types';

// Connection management
export {
  ConnectionManager,
  ReconnectionManager,
  ConnectionPool,
} from './connection';

// Room management
export {
  RoomManager,
  RoomEventBroadcaster,
} from './rooms';

// Presence tracking
export {
  PresenceTracker,
  PresenceHeartbeatManager,
  PresenceSyncManager,
} from './presence';

// Message handling
export {
  MessageHandler,
  MessageBatcher,
  MessagePriorityQueue,
} from './messaging';

// Utilities
export { createRealtimeClient, createRealtimeServer } from './client';

/**
 * Real-time communication factory
 */
export class RealtimeFactory {
  /**
   * Create a complete real-time communication system
   */
  static create(config?: {
    maxConnections?: number;
    maxRooms?: number;
    enableMetrics?: boolean;
  }) {
    const messageHandler = new MessageHandler();
    const connectionManager = new ConnectionManager(
      {
        maxConnections: config?.maxConnections,
        enableMetrics: config?.enableMetrics,
      },
      messageHandler
    );
    const roomManager = new RoomManager({
      maxRooms: config?.maxRooms,
    });
    const presenceTracker = new PresenceTracker();
    const messageBatcher = new MessageBatcher();
    const roomEventBroadcaster = new RoomEventBroadcaster();

    return {
      connectionManager,
      roomManager,
      presenceTracker,
      messageHandler,
      messageBatcher,
      roomEventBroadcaster,
    };
  }
}
