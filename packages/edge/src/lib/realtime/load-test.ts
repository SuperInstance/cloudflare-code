/**
 * Load Testing Setup for Real-time Communication
 * Tests performance under high connection/message loads
 */

import type {
  AnyMessage,
  MessageType,
  Connection,
} from './types';
import { ConnectionManager } from './connection';
import { RoomManager } from './rooms';
import { PresenceTracker } from './presence';
import { MessageHandler } from './messaging';
import { generateId } from '../utils';

/**
 * Load test configuration
 */
interface LoadTestConfig {
  // Connection settings
  maxConnections: number;
  connectionRate: number; // connections per second

  // Room settings
  roomsCount: number;
  membersPerRoom: number;

  // Message settings
  messagesPerSecond: number;
  messageSize: number;

  // Duration
  duration: number; // seconds

  // Metrics
  collectMetrics: boolean;
  metricsInterval: number; // milliseconds
}

/**
 * Load test results
 */
interface LoadTestResults {
  timestamp: number;
  duration: number;
  connections: {
    total: number;
    successful: number;
    failed: number;
    averageConnectTime: number;
  };
  messages: {
    sent: number;
    received: number;
    failed: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number; // messages per second
  };
  errors: {
    count: number;
    rate: number;
    types: Record<string, number>;
  };
  resources: {
    memoryUsed: number;
    cpuUsage: number;
  };
}

/**
 * Mock WebSocket for load testing
 */
class LoadTestWebSocket {
  readyState: number = WebSocket.OPEN;
  messageQueue: string[] = [];
  latencySamples: number[] = [];
  baseLatency: number;

  constructor(baseLatency: number = 10) {
    this.baseLatency = baseLatency;
  }

  send(data: string | ArrayBuffer): void {
    // Simulate network latency
    const latency = this.baseLatency + Math.random() * 5;
    this.latencySamples.push(latency);
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
  }

  getAverageLatency(): number {
    if (this.latencySamples.length === 0) return 0;
    const sum = this.latencySamples.reduce((a, b) => a + b, 0);
    return sum / this.latencySamples.length;
  }

  getP95Latency(): number {
    if (this.latencySamples.length === 0) return 0;
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }

  getP99Latency(): number {
    if (this.latencySamples.length === 0) return 0;
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.99);
    return sorted[index];
  }
}

/**
 * Load tester class
 */
export class LoadTester {
  private connectionManager: ConnectionManager;
  private roomManager: RoomManager;
  private presenceTracker: PresenceTracker;
  private messageHandler: MessageHandler;
  private results: Partial<LoadTestResults>;
  private latencies: number[] = [];
  private errorCounts: Map<string, number> = new Map();
  private startTime: number = 0;

  constructor() {
    this.messageHandler = new MessageHandler({
      maxQueueSize: 100000,
      maxRetries: 3,
      enableBatching: true,
      batchSize: 1000,
    });

    this.connectionManager = new ConnectionManager({
      maxConnections: 100000,
      maxConnectionsPerUser: 100,
      enableMetrics: true,
    }, this.messageHandler);

    this.roomManager = new RoomManager({
      maxRooms: 10000,
      maxMembersPerRoom: 1000,
    });

    this.presenceTracker = new PresenceTracker();

    this.results = {};
  }

  /**
   * Run connection load test
   */
  async testConnections(config: LoadTestConfig): Promise<LoadTestResults> {
    this.startTime = Date.now();
    this.results = {
      connections: {
        total: config.maxConnections,
        successful: 0,
        failed: 0,
        averageConnectTime: 0,
      },
      errors: {
        count: 0,
        rate: 0,
        types: {},
      },
    };

    const connectTimes: number[] = [];
    const delay = 1000 / config.connectionRate;

    for (let i = 0; i < config.maxConnections; i++) {
      const start = performance.now();

      try {
        const mockWs = new LoadTestWebSocket() as unknown as WebSocket;
        const userId = `user_${i % 1000}`;
        const sessionId = generateId('session');

        const connection = await this.connectionManager.acceptConnection(
          mockWs,
          {
            type: 'connect' as MessageType.CONNECT,
            id: generateId('msg'),
            timestamp: Date.now(),
            data: {
              userId,
              sessionId,
              reconnect: false,
            },
          }
        );

        // Track presence
        this.presenceTracker.connect(userId, connection.connectionId);

        const connectTime = performance.now() - start;
        connectTimes.push(connectTime);

        this.results.connections!.successful++;

      } catch (error) {
        this.results.connections!.failed++;
        this.trackError('connection_error');
      }

      // Rate limiting
      await this.sleep(delay);
    }

    // Calculate average connect time
    if (connectTimes.length > 0) {
      const sum = connectTimes.reduce((a, b) => a + b, 0);
      this.results.connections!.averageConnectTime = sum / connectTimes.length;
    }

    this.results.duration = Date.now() - this.startTime;
    this.results.timestamp = Date.now();

    return this.results as LoadTestResults;
  }

  /**
   * Run messaging load test
   */
  async testMessaging(config: LoadTestConfig): Promise<LoadTestResults> {
    this.startTime = Date.now();
    this.latencies = [];

    // Create rooms and users
    const rooms: string[] = [];
    for (let i = 0; i < config.roomsCount; i++) {
      const room = this.roomManager.createRoom(`Room${i}`, `owner_${i}`, 'public');
      rooms.push(room.roomId);

      // Add members to room
      for (let j = 0; j < config.membersPerRoom; j++) {
        const userId = `user_${i}_${j}`;
        try {
          this.roomManager.joinRoom(room.roomId, userId);
        } catch (error) {
          // Room might be full
        }
      }
    }

    this.results = {
      messages: {
        sent: 0,
        received: 0,
        failed: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        throughput: 0,
      },
      errors: {
        count: 0,
        rate: 0,
        types: {},
      },
    };

    // Generate and send messages
    const messageDelay = 1000 / config.messagesPerSecond;
    const endTime = this.startTime + config.duration * 1000;

    while (Date.now() < endTime) {
      try {
        const roomId = rooms[Math.floor(Math.random() * rooms.length)];
        const message: AnyMessage = {
          type: 'message' as MessageType.MESSAGE,
          id: generateId('msg'),
          timestamp: Date.now(),
          data: {
            roomId,
            content: 'x'.repeat(config.messageSize),
          },
        };

        const start = performance.now();

        // Simulate message sending
        this.results.messages!.sent++;
        this.latencies.push(performance.now() - start);

      } catch (error) {
        this.results.messages!.failed++;
        this.trackError('message_send_error');
      }

      await this.sleep(messageDelay);
    }

    // Calculate latency metrics
    if (this.latencies.length > 0) {
      const sorted = [...this.latencies].sort((a, b) => a - b);
      this.results.messages!.averageLatency =
        this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
      this.results.messages!.p95Latency = sorted[Math.floor(sorted.length * 0.95)];
      this.results.messages!.p99Latency = sorted[Math.floor(sorted.length * 0.99)];
    }

    this.results.messages!.throughput =
      (this.results.messages!.sent / config.duration);

    this.results.duration = Date.now() - this.startTime;
    this.results.timestamp = Date.now();

    return this.results as LoadTestResults;
  }

  /**
   * Run comprehensive load test
   */
  async runComprehensiveTest(config: LoadTestConfig): Promise<LoadTestResults> {
    console.log('Starting comprehensive load test...');

    // Test connections
    console.log('Testing connections...');
    const connectionResults = await this.testConnections(config);
    console.log(`Connections: ${connectionResults.connections.successful}/${connectionResults.connections.total}`);

    // Test messaging
    console.log('Testing messaging...');
    const messagingResults = await this.testMessaging(config);
    console.log(`Messages: ${messagingResults.messages.sent} sent, ${messagingResults.messages.failed} failed`);

    // Combine results
    const combined: LoadTestResults = {
      timestamp: Date.now(),
      duration: connectionResults.duration + messagingResults.duration,
      connections: connectionResults.connections!,
      messages: messagingResults.messages!,
      errors: {
        count: (connectionResults.errors?.count ?? 0) + (messagingResults.errors?.count ?? 0),
        rate: 0,
        types: {
          ...connectionResults.errors?.types,
          ...messagingResults.errors?.types,
        },
      },
      resources: {
        memoryUsed: 0,
        cpuUsage: 0,
      },
    };

    combined.errors.rate = combined.errors.count / (combined.duration / 1000);

    console.log('Load test complete!');
    return combined;
  }

  /**
   * Run stress test (find breaking point)
   */
  async runStressTest(initialConfig: LoadTestConfig): Promise<LoadTestResults> {
    let config = { ...initialConfig };
    let results: LoadTestResults | null = null;
    let iteration = 0;
    const maxIterations = 10;

    console.log('Starting stress test...');

    while (iteration < maxIterations) {
      iteration++;
      console.log(`Iteration ${iteration}: ${config.maxConnections} connections, ${config.messagesPerSecond} msg/s`);

      try {
        results = await this.runComprehensiveTest(config);

        // Check error rate
        const errorRate = results.errors.count / (results.messages.sent + results.connections.total);

        if (errorRate > 0.05) { // 5% error rate threshold
          console.log(`Stress threshold reached at ${config.maxConnections} connections`);
          break;
        }

        // Increase load for next iteration
        config.maxConnections = Math.floor(config.maxConnections * 1.5);
        config.messagesPerSecond = Math.floor(config.messagesPerSecond * 1.5);

      } catch (error) {
        console.error('Stress test failed:', error);
        this.trackError('stress_test_failure');
        break;
      }
    }

    return results ?? {
      timestamp: Date.now(),
      duration: 0,
      connections: { total: 0, successful: 0, failed: 0, averageConnectTime: 0 },
      messages: { sent: 0, received: 0, failed: 0, averageLatency: 0, p95Latency: 0, p99Latency: 0, throughput: 0 },
      errors: { count: 0, rate: 0, types: {} },
      resources: { memoryUsed: 0, cpuUsage: 0 },
    };
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    return {
      connections: this.connectionManager.getStats(),
      rooms: this.roomManager.getStats(),
      presence: this.presenceTracker.getStats(),
      messages: this.messageHandler.getStats(),
    };
  }

  /**
   * Reset test state
   */
  reset(): void {
    this.connectionManager.destroy();
    this.presenceTracker.destroy();
    this.messageHandler.destroy();
    this.latencies = [];
    this.errorCounts.clear();
    this.results = {};
  }

  /**
   * Track error
   */
  private trackError(type: string): void {
    const count = this.errorCounts.get(type) ?? 0;
    this.errorCounts.set(type, count + 1);

    if (this.results.errors) {
      this.results.errors.count++;
      this.results.errors.types[type] = (this.results.errors.types[type] ?? 0) + 1;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Run predefined load test scenarios
 */
export async function runLoadTestScenarios(): Promise<void> {
  const tester = new LoadTester();

  // Scenario 1: Low load (baseline)
  console.log('\n=== Scenario 1: Low Load ===');
  const lowLoadResults = await tester.runComprehensiveTest({
    maxConnections: 100,
    connectionRate: 10,
    roomsCount: 10,
    membersPerRoom: 10,
    messagesPerSecond: 100,
    messageSize: 100,
    duration: 30,
    collectMetrics: true,
    metricsInterval: 1000,
  });
  console.log('Results:', lowLoadResults);

  tester.reset();

  // Scenario 2: Medium load
  console.log('\n=== Scenario 2: Medium Load ===');
  const mediumLoadResults = await tester.runComprehensiveTest({
    maxConnections: 1000,
    connectionRate: 50,
    roomsCount: 50,
    membersPerRoom: 20,
    messagesPerSecond: 1000,
    messageSize: 200,
    duration: 60,
    collectMetrics: true,
    metricsInterval: 1000,
  });
  console.log('Results:', mediumLoadResults);

  tester.reset();

  // Scenario 3: High load
  console.log('\n=== Scenario 3: High Load ===');
  const highLoadResults = await tester.runComprehensiveTest({
    maxConnections: 5000,
    connectionRate: 100,
    roomsCount: 100,
    membersPerRoom: 50,
    messagesPerSecond: 5000,
    messageSize: 500,
    duration: 120,
    collectMetrics: true,
    metricsInterval: 1000,
  });
  console.log('Results:', highLoadResults);

  tester.reset();

  // Scenario 4: Stress test
  console.log('\n=== Scenario 4: Stress Test ===');
  const stressResults = await tester.runStressTest({
    maxConnections: 1000,
    connectionRate: 50,
    roomsCount: 50,
    membersPerRoom: 20,
    messagesPerSecond: 1000,
    messageSize: 200,
    duration: 30,
    collectMetrics: true,
    metricsInterval: 1000,
  });
  console.log('Results:', stressResults);

  tester.reset();
}

/**
 * Example: Run a simple load test
 */
export async function exampleLoadTest(): Promise<void> {
  const tester = new LoadTester();

  const results = await tester.runComprehensiveTest({
    maxConnections: 1000,
    connectionRate: 100,
    roomsCount: 20,
    membersPerRoom: 50,
    messagesPerSecond: 1000,
    messageSize: 256,
    duration: 60,
    collectMetrics: true,
    metricsInterval: 5000,
  });

  console.log('\n=== Load Test Results ===');
  console.log(`Duration: ${results.duration}ms`);
  console.log(`Connections: ${results.connections.successful}/${results.connections.total}`);
  console.log(`Avg Connect Time: ${results.connections.averageConnectTime.toFixed(2)}ms`);
  console.log(`Messages Sent: ${results.messages.sent}`);
  console.log(`Messages Failed: ${results.messages.failed}`);
  console.log(`Avg Latency: ${results.messages.averageLatency.toFixed(2)}ms`);
  console.log(`P95 Latency: ${results.messages.p95Latency.toFixed(2)}ms`);
  console.log(`P99 Latency: ${results.messages.p99Latency.toFixed(2)}ms`);
  console.log(`Throughput: ${results.messages.throughput.toFixed(2)} msg/s`);
  console.log(`Errors: ${results.errors.count} (${results.errors.rate.toFixed(2)} errors/s)`);

  tester.reset();
}
