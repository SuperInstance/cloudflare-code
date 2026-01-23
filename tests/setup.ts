/**
 * Test Setup File
 * Global test configuration and fixtures
 */

import { vi, afterEach } from 'vitest';

// Mock Cloudflare Workers environment
global.Request = Request as any;
global.Response = Response as any;
global.fetch = fetch as any;

// Mock environment variables
(process.env as any)['CLOUDFLARE_ACCOUNT_ID'] = 'test-account-id';
(process.env as any)['ENVIRONMENT'] = 'test';

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock KV namespace
class MockKVNamespace {
  private store = new Map<string, any>();

  async get(key: string, options?: { type?: 'json' | 'text' | 'arrayBuffer' }): Promise<any> {
    const value = this.store.get(key);
    if (options?.type === 'json') {
      return value ? JSON.parse(value) : null;
    }
    return value || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  list(): any {
    return {
      keys: Array.from(this.store.keys()).map(key => ({ name: key }))
    };
  }
}

// Make MockKV available globally
(global as any).MockKVNamespace = MockKVNamespace;

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});
