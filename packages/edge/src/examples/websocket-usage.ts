/**
 * Real-time Communication Usage Examples
 * Demonstrates how to use the WebSocket real-time communication system
 */

import {
  createRealtimeClient,
  createRealtimeServer,
  RealtimeClient,
  RealtimeServer,
} from '../lib/realtime';
import type {
  AnyMessage,
  MessageType,
  PresenceStatus,
} from '../lib/realime/types';

/**
 * Example 1: Basic Client Connection
 */
export async function example1_BasicClientConnection() {
  console.log('=== Example 1: Basic Client Connection ===');

  // Create a real-time client
  const client = createRealtimeClient({
    url: 'wss://api.example.com/ws',
    reconnect: true,
    maxReconnectAttempts: 5,
    debug: true,
  });

  // Subscribe to connection events
  client.on('connect' as MessageType.CONNECT, (message: AnyMessage) => {
    console.log('Connected to server:', message);
  });

  client.on('disconnect' as MessageType.DISCONNECT, (message: AnyMessage) => {
    console.log('Disconnected from server:', message);
  });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check connection status
  console.log('Is connected:', client.isConnected());

  // Disconnect
  client.disconnect();
}

/**
 * Example 2: Join and Interact with Rooms
 */
export async function example2_RoomInteraction() {
  console.log('\n=== Example 2: Room Interaction ===');

  const client = createRealtimeClient({
    url: 'wss://api.example.com/ws',
    debug: true,
  });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 500));

  // Join a room
  await client.joinRoom('general', { theme: 'dark' });
  console.log('Joined room: general');

  // Subscribe to room events
  client.on('user_joined' as MessageType.USER_JOINED, (message: AnyMessage) => {
    console.log('User joined:', message.metadata);
  });

  client.on('user_left' as MessageType.USER_LEFT, (message: AnyMessage) => {
    console.log('User left:', message.metadata);
  });

  // Send a chat message
  await client.sendChatMessage('general', 'Hello, everyone!', 'text');

  // Leave the room
  await client.leaveRoom('general');
  console.log('Left room: general');

  client.disconnect();
}

/**
 * Example 3: Presence Tracking
 */
export async function example3_PresenceTracking() {
  console.log('\n=== Example 3: Presence Tracking ===');

  const client = createRealtimeClient({
    url: 'wss://api.example.com/ws',
    debug: true,
  });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 500));

  // Subscribe to presence updates
  client.on('presence_update' as MessageType.PRESENCE_UPDATE, (message: AnyMessage) => {
    console.log('Presence update:', message.data);
  });

  // Update own presence
  await client.updatePresence('online', 'Available for chat');
  console.log('Set presence to: online');

  // Change to away
  await client.updatePresence('away', 'In a meeting');
  console.log('Set presence to: away');

  client.disconnect();
}

/**
 * Example 4: Server-Side Setup
 */
export async function example4_ServerSetup() {
  console.log('\n=== Example 4: Server Setup ===');

  // Create a real-time server
  const server = createRealtimeServer({
    onMessage: async (message: AnyMessage, connection: Connection) => {
      console.log('Received message:', message.type);

      // Handle different message types
      switch (message.type) {
        case 'message':
          // Broadcast to room
          if (message.data.roomId) {
            await server.broadcastToRoom(message.data.roomId, message);
          }
          break;

        case 'presence_update':
          // Update user presence
          console.log('User presence updated:', message.data);
          break;
      }
    },

    onRoomEvent: (event) => {
      console.log('Room event:', event.type, event.roomId);
    },

    onPresenceChange: (presence) => {
      console.log('Presence changed:', presence.userId, presence.status);
    },

    onError: (error, connection) => {
      console.error('Server error:', error.message, connection?.connectionId);
    },
  });

  console.log('Server created');
  console.log('Statistics:', server.getStats());

  // Cleanup when done
  server.destroy();
}

/**
 * Example 5: Streaming LLM Responses
 */
export async function example5_StreamLLMResponse() {
  console.log('\n=== Example 5: Stream LLM Response ===');

  const client = createRealtimeClient({
    url: 'wss://api.example.com/ws',
    debug: true,
  });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 500));

  // Join a room
  await client.joinRoom('collaborative-editing');

  // Subscribe to stream events
  client.on('stream_data' as MessageType.STREAM_DATA, (message: AnyMessage) => {
    const { streamId, chunk, sequence, final } = message.data;

    // Append chunk to response
    process.stdout.write(chunk);

    if (final) {
      console.log('\nStream complete:', streamId);
    }
  });

  // Send a prompt to start streaming
  await client.sendMessage({
    type: 'stream_start' as MessageType.STREAM_START,
    id: 'msg_123',
    timestamp: Date.now(),
    data: {
      prompt: 'Explain quantum computing',
      model: 'claude-3-opus',
    },
  });

  // Wait for streaming to complete
  await new Promise(resolve => setTimeout(resolve, 5000));

  client.disconnect();
}

/**
 * Example 6: Real-time Collaboration
 */
export async function example6_RealtimeCollaboration() {
  console.log('\n=== Example 6: Real-time Collaboration ===');

  // Create multiple clients to simulate collaboration
  const alice = createRealtimeClient({
    url: 'wss://api.example.com/ws',
    debug: false,
  });

  const bob = createRealtimeClient({
    url: 'wss://api.example.com/ws',
    debug: false,
  });

  // Wait for connections
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Both join the same room
  await alice.joinRoom('project-alpha');
  await bob.joinRoom('project-alpha');

  // Subscribe to messages
  alice.on('message' as MessageType.MESSAGE, (message: AnyMessage) => {
    console.log(`Alice received from ${message.metadata?.userId}:`, message.data.content);
  });

  bob.on('message' as MessageType.MESSAGE, (message: AnyMessage) => {
    console.log(`Bob received from ${message.metadata?.userId}:`, message.data.content);
  });

  // Alice sends a message
  await alice.sendChatMessage('project-alpha', 'Hey Bob, want to review my PR?');

  // Bob replies
  await bob.sendChatMessage('project-alpha', 'Sure! Let me take a look.');

  // Update presence
  await alice.updatePresence('busy', 'Reviewing code');

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Cleanup
  alice.disconnect();
  bob.disconnect();
}

/**
 * Example 7: Error Handling
 */
export async function example7_ErrorHandling() {
  console.log('\n=== Example 7: Error Handling ===');

  const client = createRealtimeClient({
    url: 'wss://api.example.com/ws',
    reconnect: true,
    maxReconnectAttempts: 3,
    debug: true,
  });

  // Subscribe to errors
  client.on('error' as MessageType.ERROR, (message: AnyMessage) => {
    console.error('Error received:', message.data);
    console.error('Code:', message.data.code);
    console.error('Message:', message.data.message);
    console.error('Recoverable:', message.data.recoverable);
  });

  // Subscribe to connection state changes
  client.on('disconnect' as MessageType.DISCONNECT, (message: AnyMessage) => {
    console.log('Disconnected:', message.data.reason);

    if (message.data.reconnect) {
      console.log('Will attempt to reconnect...');
    }
  });

  // Wait and disconnect
  await new Promise(resolve => setTimeout(resolve, 1000));
  client.disconnect();
}

/**
 * Example 8: Advanced Room Management
 */
export async function example8_AdvancedRoomManagement() {
  console.log('\n=== Example 8: Advanced Room Management ===');

  const server = createRealtimeServer();

  // Create rooms
  const generalRoom = server.createRoom?.('general', 'admin', 'public', {
    topic: 'General discussion',
    persistent: true,
  });

  const privateRoom = server.createRoom?.('private-team', 'admin', 'private', {
    topic: 'Team internal discussions',
    password: 'secret123',
  });

  const directRoom = server.createRoom?.('alice-bob', 'alice', 'direct');

  console.log('Rooms created:', generalRoom, privateRoom, directRoom);

  // Get room members
  const members = server.getRoomMembers('general');
  console.log('Room members:', members);

  // Get user presence
  const presence = server.getUserPresence('alice');
  console.log('User presence:', presence);

  // Broadcast to room
  const delivered = await server.broadcastToRoom('general', {
    type: 'message' as MessageType.MESSAGE,
    id: 'msg_broadcast',
    timestamp: Date.now(),
    data: {
      content: 'Broadcast message to all members',
    },
  });

  console.log('Message delivered to:', delivered, 'members');

  // Get statistics
  const stats = server.getStats();
  console.log('Server statistics:', stats);

  server.destroy();
}

/**
 * Example 9: Message Priority Queue
 */
export async function example9_MessagePriority() {
  console.log('\n=== Example 9: Message Priority ===');

  const client = createRealtimeClient({
    url: 'wss://api.example.com/ws',
    debug: true,
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Send messages with different priorities
  await client.sendMessage({
    type: 'message' as MessageType.MESSAGE,
    id: 'msg_low',
    timestamp: Date.now(),
    priority: 0, // LOW
    data: {
      content: 'Low priority message',
    },
  });

  await client.sendMessage({
    type: 'message' as MessageType.MESSAGE,
    id: 'msg_normal',
    timestamp: Date.now(),
    priority: 1, // NORMAL
    data: {
      content: 'Normal priority message',
    },
  });

  await client.sendMessage({
    type: 'message' as MessageType.MESSAGE,
    id: 'msg_high',
    timestamp: Date.now(),
    priority: 2, // HIGH
    data: {
      content: 'High priority message',
    },
  });

  await client.sendMessage({
    type: 'message' as MessageType.MESSAGE,
    id: 'msg_urgent',
    timestamp: Date.now(),
    priority: 3, // URGENT
    data: {
      content: 'Urgent message!',
    },
  });

  console.log('Messages sent with different priorities');

  client.disconnect();
}

/**
 * Example 10: Complete Workflow
 */
export async function example10_CompleteWorkflow() {
  console.log('\n=== Example 10: Complete Workflow ===');

  // Initialize server
  const server = createRealtimeServer({
    onMessage: async (message, connection) => {
      console.log('[Server] Received:', message.type);

      // Echo back for testing
      if (message.type === 'message') {
        await server.sendToUser(connection.userId, {
          ...message,
          id: 'echo_' + message.id,
        });
      }
    },
  });

  // Initialize client
  const client = createRealtimeClient({
    url: 'wss://api.example.com/ws',
    reconnect: true,
    debug: true,
  });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Join room
  await client.joinRoom('workflow-demo');
  console.log('[Client] Joined room');

  // Update presence
  await client.updatePresence('online', 'Ready to collaborate');
  console.log('[Client] Presence updated');

  // Send message
  await client.sendChatMessage('workflow-demo', 'Hello everyone!');
  console.log('[Client] Message sent');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Update presence to busy
  await client.updatePresence('busy', 'Working on task');
  console.log('[Client] Presence updated to busy');

  // Leave room
  await client.leaveRoom('workflow-demo');
  console.log('[Client] Left room');

  // Disconnect
  client.disconnect();
  console.log('[Client] Disconnected');

  // Get final stats
  const stats = server.getStats();
  console.log('[Server] Final stats:', stats);

  // Cleanup
  server.destroy();
  console.log('[Server] Destroyed');
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('Running Real-time Communication Examples\n');

  try {
    await example1_BasicClientConnection();
    await example2_RoomInteraction();
    await example3_PresenceTracking();
    await example4_ServerSetup();
    // Note: Examples 5-10 would need actual WebSocket server to work
    console.log('\n=== All examples completed ===');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export examples for use in tests or documentation
export const examples = {
  basicClientConnection: example1_BasicClientConnection,
  roomInteraction: example2_RoomInteraction,
  presenceTracking: example3_PresenceTracking,
  serverSetup: example4_ServerSetup,
  streamLLMResponse: example5_StreamLLMResponse,
  realtimeCollaboration: example6_RealtimeCollaboration,
  errorHandling: example7_ErrorHandling,
  advancedRoomManagement: example8_AdvancedRoomManagement,
  messagePriority: example9_MessagePriority,
  completeWorkflow: example10_CompleteWorkflow,
};
