// Test setup file
import { vi } from 'vitest';

// Mock global functions
global.performance = {
  now: vi.fn(() => Date.now())
} as any;

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => `mock-id-${Math.random().toString(36).substr(2, 9)}`)
}));

// Mock console methods in tests
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

beforeEach(() => {
  // Mock console to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
});

// Global test utilities
export const createTestMessage = (topic: string, payload: any, headers: any = {}) => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  topic,
  payload,
  headers: {
    contentType: 'application/json',
    timestamp: Date.now(),
    ...headers
  },
  timestamp: Date.now(),
  retryCount: 0
});

export const createTestSubscription = (topic: string, subscriber: string) => ({
  id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  topic,
  subscriber,
  deliveryGuarantee: 'at-least-once' as const,
  batchSize: 1,
  retryPolicy: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  metadata: {}
});

export const createTestTopic = (name: string) => ({
  id: `topic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name,
  partitions: 1,
  replicationFactor: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  metadata: {}
});