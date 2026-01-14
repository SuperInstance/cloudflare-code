/**
 * Health endpoint tests
 */

import { mockEnv } from './setup';

describe('Health Endpoint', () => {
  it('should return healthy status', async () => {
    const response = await fetch('http://localhost/health');
    const data = await response.json();

    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
  });

  it('should include correct version', async () => {
    const response = await fetch('http://localhost/health');
    const data = await response.json();

    expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
