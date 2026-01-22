/**
 * Predefined Load Test Scenarios
 *
 * Common load testing scenarios for Cloudflare Workers
 */

import type { LoadTestConfig } from '../types/index.js';

export class LoadTestScenarios {
  /**
   * Standard API load test
   */
  static standardApi(baseUrl: string, path = '/v1/status'): LoadTestConfig {
    return {
      name: 'standard-api',
      target: `${baseUrl}${path}`,
      method: 'GET',
      connections: 100,
      duration: 30,
      pipelining: 1,
      timeout: 10,
      requests: {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ClaudeFlare-LoadTest/1.0',
        },
      },
      expectations: {
        maxLatency: 500,
        p95Latency: 300,
        p99Latency: 400,
        minThroughput: 100,
        maxErrorRate: 1,
      },
    };
  }

  /**
   * High throughput test
   */
  static highThroughput(baseUrl: string, path = '/v1/chat'): LoadTestConfig {
    return {
      name: 'high-throughput',
      target: `${baseUrl}${path}`,
      method: 'POST',
      connections: 1000,
      duration: 60,
      pipelining: 10,
      timeout: 30,
      requests: {
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          model: 'claude-3-haiku',
          messages: [
            { role: 'user', content: 'Hello, world!' },
          ],
        },
      },
      expectations: {
        maxLatency: 5000,
        p95Latency: 3000,
        minThroughput: 1000,
        maxErrorRate: 5,
      },
    };
  }

  /**
   * WebSocket test (via HTTP endpoint)
   */
  static websocket(baseUrl: string, path = '/v1/chat/stream'): LoadTestConfig {
    return {
      name: 'websocket-stream',
      target: `${baseUrl}${path}`,
      method: 'POST',
      connections: 100,
      duration: 60,
      pipelining: 1,
      timeout: 60,
      requests: {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: {
          model: 'claude-3-haiku',
          messages: [
            { role: 'user', content: 'Count to 10' },
          ],
          stream: true,
        },
      },
      expectations: {
        maxLatency: 10000,
        minThroughput: 50,
        maxErrorRate: 2,
      },
    };
  }

  /**
   * Cold start test
   */
  static coldStart(baseUrl: string, path = '/v1/status'): LoadTestConfig {
    return {
      name: 'cold-start',
      target: `${baseUrl}${path}`,
      method: 'GET',
      connections: 1,
      duration: 10,
      pipelining: 1,
      timeout: 5,
      amount: 100, // 100 sequential requests
      requests: {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      },
      expectations: {
        maxLatency: 1000,
        p95Latency: 500,
        minThroughput: 1,
        maxErrorRate: 0,
      },
    };
  }

  /**
   * Memory stress test
   */
  static memoryStress(baseUrl: string, path = '/v1/codebase/upload'): LoadTestConfig {
    return {
      name: 'memory-stress',
      target: `${baseUrl}${path}`,
      method: 'POST',
      connections: 50,
      duration: 120,
      pipelining: 5,
      timeout: 60,
      requests: {
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          files: [
            {
              name: 'large-file.ts',
              content: 'x'.repeat(1024 * 1024), // 1MB
            },
          ],
        },
      },
      expectations: {
        maxLatency: 10000,
        minThroughput: 10,
        maxErrorRate: 5,
      },
    };
  }

  /**
   * R2 storage test
   */
  static r2Storage(baseUrl: string, path = '/v1/storage'): LoadTestConfig {
    return {
      name: 'r2-storage',
      target: `${baseUrl}${path}`,
      method: 'POST',
      connections: 50,
      duration: 60,
      pipelining: 1,
      timeout: 30,
      requests: {
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          action: 'upload',
          data: 'x'.repeat(1024 * 100), // 100KB
        },
      },
      expectations: {
        maxLatency: 2000,
        p95Latency: 1000,
        minThroughput: 20,
        maxErrorRate: 2,
      },
    };
  }

  /**
   * KV storage test
   */
  static kvStorage(baseUrl: string, path = '/v1/cache'): LoadTestConfig {
    return {
      name: 'kv-storage',
      target: `${baseUrl}${path}`,
      method: 'GET',
      connections: 200,
      duration: 60,
      pipelining: 10,
      timeout: 5,
      requests: {
        headers: {
          'Content-Type': 'application/json',
        },
        query: {
          key: 'test-key',
        },
      },
      expectations: {
        maxLatency: 200,
        p95Latency: 100,
        minThroughput: 500,
        maxErrorRate: 1,
      },
    };
  }

  /**
   * Durable Object test
   */
  static durableObject(baseUrl: string, path = '/v1/sessions'): LoadTestConfig {
    return {
      name: 'durable-object',
      target: `${baseUrl}${path}`,
      method: 'POST',
      connections: 100,
      duration: 60,
      pipelining: 1,
      timeout: 10,
      requests: {
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          action: 'create',
          data: { test: 'data' },
        },
      },
      expectations: {
        maxLatency: 500,
        p95Latency: 300,
        minThroughput: 100,
        maxErrorRate: 2,
      },
    };
  }

  /**
   * Concurrent connections test
   */
  static concurrentConnections(baseUrl: string, path = '/v1/chat'): LoadTestConfig {
    return {
      name: 'concurrent-connections',
      target: `${baseUrl}${path}`,
      method: 'POST',
      connections: 10000,
      duration: 30,
      pipelining: 1,
      timeout: 60,
      rate: 1000, // 1000 requests per second
      requests: {
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          model: 'claude-3-haiku',
          messages: [
            { role: 'user', content: 'Quick response' },
          ],
          max_tokens: 50,
        },
      },
      expectations: {
        maxLatency: 5000,
        p95Latency: 2000,
        minThroughput: 500,
        maxErrorRate: 10,
      },
    };
  }

  /**
   * Spike test
   */
  static spikeTest(baseUrl: string, path = '/v1/status'): LoadTestConfig {
    return {
      name: 'spike-test',
      target: `${baseUrl}${path}`,
      method: 'GET',
      connections: 5000,
      duration: 10,
      pipelining: 1,
      timeout: 10,
      requests: {
        headers: {
          'Content-Type': 'application/json',
        },
      },
      expectations: {
        maxLatency: 2000,
        minThroughput: 100,
        maxErrorRate: 20,
      },
    };
  }

  /**
   * Endurance test
   */
  static enduranceTest(baseUrl: string, path = '/v1/status'): LoadTestConfig {
    return {
      name: 'endurance-test',
      target: `${baseUrl}${path}`,
      method: 'GET',
      connections: 100,
      duration: 3600, // 1 hour
      pipelining: 1,
      timeout: 10,
      requests: {
        headers: {
          'Content-Type': 'application/json',
        },
      },
      expectations: {
        maxLatency: 1000,
        p95Latency: 500,
        minThroughput: 50,
        maxErrorRate: 1,
      },
    };
  }

  /**
   * Custom scenario builder
   */
  static custom(overrides: Partial<LoadTestConfig>): LoadTestConfig {
    return {
      name: 'custom-test',
      target: 'http://localhost:8787',
      method: 'GET',
      connections: 10,
      duration: 10,
      pipelining: 1,
      timeout: 10,
      requests: {},
      ...overrides,
    };
  }
}

export default LoadTestScenarios;
