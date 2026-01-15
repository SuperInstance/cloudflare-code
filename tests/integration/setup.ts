/**
 * Integration Test Setup
 */

import { vi, beforeEach } from 'vitest';

// Mock environment
(process.env as any)['CLOUDFLARE_ACCOUNT_ID'] = 'test-account-id';
(process.env as any)['ENVIRONMENT'] = 'test';

// Setup mocks
beforeEach(() => {
  vi.clearAllMocks();
});
