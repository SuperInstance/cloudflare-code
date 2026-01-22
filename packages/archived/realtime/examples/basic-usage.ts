/**
 * Basic Usage Example for ClaudeFlare Real-Time Communication
 *
 * This example demonstrates how to set up and use the real-time communication
 * package with WebSocket connections, channel management, and presence tracking.
 */

import { RealTime } from '../src/index';

// Mock WebSocket class for demonstration
class MockWebSocket {
  public readyState = 1;
  public onmessage: ((data: string) => void) | null = null;
  public onclose: (() => void) | null = null;
  private receivedMessages: string[] = [];

  constructor(public remoteAddress = '127.0.0.1') {}

  public send(data: string): void {
    this.receivedMessages.push(data);
    console.log(`[WebSocket] Sent: ${data}`);
  }

  public close(): void {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose();
    }
  }
}

async function basicUsageExample() {
  console.log('=== ClaudeFlare Real-Time Communication - Basic Usage Example ===\n');

  // Initialize the real-time system with default configuration
  const realtime = new RealTime({
    enableLogging: true,
    enableMetrics: true
  });

  try {
    // Initialize the system
    await realtime.initialize();
    console.log('✓ Real-time system initialized');

    // Example 1: Handle WebSocket connections
    console.log('\n--- Example 1: WebSocket Connection Management ---');

    const ws1 = new MockWebSocket('192.168.1.100');
    const ws2 = new MockWebSocket('192.168.1.101');
    const ws3 = new MockWebSocket('192.168.1.102');

    // Accept WebSocket connections
    const conn1 = await realtime.handleConnection(ws1, 'chat-room', 'user-123');
    const conn2 = await realtime.handleConnection(ws2, 'chat-room', 'user-456');
    const conn3 = await realtime.handleConnection(ws3, 'game-room', 'user-789');

    console.log(`✓ Connections established: ${conn1}, ${conn2}, ${conn3}`);

    // Example 2: Channel subscription
    console.log('\n--- Example 2: Channel Subscription ---');

    // Simulate subscription messages
    const subscribeMessage = JSON.stringify({
      id: 'msg-subscribe',
      type: 'subscribe',
      channel: 'general-chat',
      userId: 'user-123',
      timestamp: Date.now()
    });

    await realtime.handleMessage(conn1, subscribeMessage);
    console.log('✓ User subscribed to channel');

    // Example 3: Publishing messages
    console.log('\n--- Example 3: Message Publishing ---');

    const publishMessage = JSON.stringify({
      id: 'msg-publish',
      type: 'publish',
      channel: 'general-chat',
      payload: {
        text: 'Hello, everyone!',
        sender: 'user-123'
      },
      timestamp: Date.now()
    });

    await realtime.handleMessage(conn1, publishMessage);
    console.log('✓ Message published to channel');

    // Example 4: Direct messaging
    console.log('\n--- Example 4: Direct Messaging ---');

    const directMessage = JSON.stringify({
      id: 'msg-direct',
      type: 'direct',
      target: 'user-456',
      payload: {
        text: 'Hey, can you help me with this?',
        sender: 'user-123'
      },
      timestamp: Date.now()
    });

    await realtime.handleMessage(conn1, directMessage);
    console.log('✓ Direct message sent');

    // Example 5: Presence updates
    console.log('\n--- Example 5: Presence Management ---');

    const statusUpdate = JSON.stringify({
      id: 'msg-status',
      type: 'presence',
      status: 'busy',
      timestamp: Date.now()
    });

    await realtime.handleMessage(conn1, statusUpdate);
    console.log('✓ User status updated');

    // Example 6: Multi-channel communication
    console.log('\n--- Example 6: Multi-Channel Communication ---');

    // Subscribe user to multiple channels
    const gameSubscribe = JSON.stringify({
      id: 'msg-game-sub',
      type: 'subscribe',
      channel: 'game-lobby',
      userId: 'user-789',
      timestamp: Date.now()
    });

    await realtime.handleMessage(conn3, gameSubscribe);
    console.log('✓ User subscribed to multiple channels');

    // Send message to game channel
    const gameMessage = JSON.stringify({
      id: 'msg-game',
      type: 'publish',
      channel: 'game-lobby',
      payload: {
        text: 'Anyone up for a match?',
        sender: 'user-789'
      },
      timestamp: Date.now()
    });

    await realtime.handleMessage(conn3, gameMessage);
    console.log('✓ Message sent to game channel');

    // Example 7: System statistics
    console.log('\n--- Example 7: System Statistics ---');

    const stats = realtime.getStats();
    console.log('📊 System Statistics:');
    console.log(`  - WebSocket Connections: ${stats.websocket.connections.active}`);
    console.log(`  - Channels: ${stats.multiplexer.channels.total}`);
    console.log(`  - Active Users: ${stats.presence.onlineUsers}`);
    console.log(`  - Cluster Nodes: ${stats.scalability.healthyNodes}`);

    // Example 8: Health monitoring
    console.log('\n--- Example 8: Health Monitoring ---');

    const health = await realtime.getHealth();
    console.log(`🏥 System Health: ${healthy ? '✓ Healthy' : '⚠ Issues detected'}`);
    console.log(`  - WebSocket: ${health.components.websocket.healthy ? '✓' : '✗'}`);
    console.log(`  - Multiplexer: ${health.components.multiplexer.healthy ? '✓' : '✗'}`);
    console.log(`  - Presence: ${health.components.presence.healthy ? '✓' : '✗'}`);
    console.log(`  - Scalability: ${health.components.scalability.healthy ? '✓' : '✗'}`);

    // Example 9: Connection lifecycle
    console.log('\n--- Example 9: Connection Lifecycle ---');

    // Close a connection
    await realtime.getWebSocketManager().closeConnection(conn1, {
      code: 1000,
      reason: 'User disconnected',
      wasClean: true
    });
    console.log('✓ Connection closed gracefully');

    // Example 10: Advanced configuration
    console.log('\n--- Example 10: Advanced Configuration ---');

    // Create a new instance with custom configuration
    const advancedRealtime = new RealTime({
      websocket: {
        maxConnections: 5000,
        heartbeatInterval: 15000,
        heartbeatTimeout: 30000,
        maxMessageSize: 2048576, // 2MB
        enableBackpressure: true
      },
      multiplexer: {
        maxChannels: 1000,
        maxSubscribers: 5000,
        enableHistory: true,
        historySize: 500,
        messageOrdering: true
      },
      presence: {
        heartbeatInterval: 30000,
        presenceTtl: 300000, // 5 minutes
        maxUsers: 10000,
        enableActivityTracking: true
      },
      scalability: {
        instanceId: 'worker-node-1',
        clusterNodes: ['node-1', 'node-2'],
        enableLoadBalancing: true,
        connectionMigration: true,
        maxConnectionsPerNode: 2500,
        enableAutoScaling: true
      }
    });

    console.log('✓ Advanced configuration applied');

    // Clean up
    console.log('\n--- Cleaning up ---');
    await realtime.shutdown();
    console.log('✓ System shutdown completed');

  } catch (error) {
    console.error('❌ Error in basic usage example:', error);
    throw error;
  }
}

// Run the example
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };