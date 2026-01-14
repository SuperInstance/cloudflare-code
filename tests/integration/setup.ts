/**
 * Integration Test Setup
 */

import { vi } from 'vitest';

// Mock environment
process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
process.env.ENVIRONMENT = 'test';

// Setup mocks
beforeEach(() => {
  vi.clearAllMocks();
});
