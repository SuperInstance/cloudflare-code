/**
 * Chat-to-Deploy Integration Tests
 * End-to-end tests for the complete Chat-to-Deploy flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';

describe('Chat-to-Deploy Flow', () => {
  let authToken: string;

  beforeEach(async () => {
    // Authenticate and get token
    const loginRes = await fetch('http://localhost/dev/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    authToken = await loginRes.text();
  });

  describe('Complete Chat-to-Deploy Journey', () => {
    it('should complete full workflow in under 60 seconds', async () => {
      const startTime = Date.now();

      // Step 1: User sends chat prompt
      const chatRes = await fetch('http://localhost/dev/agent/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'Create a simple REST API with user endpoints'
        })
      });
      expect(chatRes.ok).toBe(true);
      const chatResponse = await chatRes.json();
      expect(chatResponse).toHaveProperty('code');
      expect(chatResponse).toHaveProperty('deploymentReady');

      // Step 2: AI generates code
      expect(chatResponse.code).toBeDefined();
      expect(typeof chatResponse.code).toBe('string');

      // Step 3: Preview deployment
      const previewRes = await fetch('http://localhost/dev/agent/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: chatResponse.code
        })
      });
      expect(previewRes.ok).toBe(true);
      const preview = await previewRes.json();
      expect(preview).toHaveProperty('previewUrl');

      // Step 4: Deploy to Workers
      const deployRes = await fetch('http://localhost/dev/deploy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: chatResponse.code,
          name: 'test-rest-api'
        })
      });
      expect(deployRes.ok).toBe(true);
      const deployment = await deployRes.json();
      expect(deployment).toHaveProperty('url');
      expect(deployment).toHaveProperty('workerId');

      // Verify total time
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(60000); // Under 60 seconds
    });

    it('should handle deployment errors gracefully', async () => {
      const chatRes = await fetch('http://localhost/dev/agent/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'Create broken code with syntax errors'
        })
      });

      const chatResponse = await chatRes.json();
      expect(chatResponse).toHaveProperty('errors');
      expect(Array.isArray(chatResponse.errors)).toBe(true);
    });
  });

  describe('Code Generation', () => {
    it('should generate valid Cloudflare Workers code', async () => {
      const res = await fetch('http://localhost/dev/agent/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'Create a Hono-based API',
          template: 'hono'
        })
      });

      const result = await res.json();
      expect(result.code).toBeDefined();
      expect(result.code).toContain('export default');
    });

    it('should support different templates', async () => {
      const templates = ['hono', 'worker', 'graphql'];

      for (const template of templates) {
        const res = await fetch('http://localhost/dev/agent/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: `Create a ${template} app`,
            template
          })
        });

        expect(res.ok).toBe(true);
        const result = await res.json();
        expect(result.code).toBeDefined();
      }
    });
  });

  describe('Deployment Management', () => {
    it('should list active deployments', async () => {
      const res = await fetch('http://localhost/dev/deployments', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(res.ok).toBe(true);
      const deployments = await res.json();
      expect(Array.isArray(deployments)).toBe(true);
    });

    it('should get deployment status', async () => {
      // First deploy something
      const deployRes = await fetch('http://localhost/dev/deploy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: 'export default { fetch: () => new Response("OK") }',
          name: 'status-test-worker'
        })
      });

      const deployment = await deployRes.json();

      // Then check status
      const statusRes = await fetch(
        `http://localhost/dev/deployments/${deployment.workerId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(statusRes.ok).toBe(true);
      const status = await statusRes.json();
      expect(status).toHaveProperty('status');
      expect(['deployed', 'pending', 'failed']).toContain(status.status);
    });

    it('should delete deployment', async () => {
      // Deploy first
      const deployRes = await fetch('http://localhost/dev/deploy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: 'export default { fetch: () => new Response("OK") }',
          name: 'delete-test-worker'
        })
      });

      const deployment = await deployRes.json();

      // Delete it
      const deleteRes = await fetch(
        `http://localhost/dev/deployments/${deployment.workerId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(deleteRes.ok).toBe(true);
    });
  });

  describe('AI Provider Integration', () => {
    it('should route to appropriate AI provider', async () => {
      const providers = ['manus', 'claude', 'grok'];

      for (const provider of providers) {
        const res = await fetch('http://localhost/dev/agent/chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: 'Say hello',
            provider
          })
        });

        expect(res.ok).toBe(true);
        const result = await res.json();
        expect(result).toHaveProperty('provider', provider);
      }
    });

    it('should fallback on provider failure', async () => {
      const res = await fetch('http://localhost/dev/agent/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'Test fallback',
          provider: 'unavailable-provider',
          fallback: true
        })
      });

      expect(res.ok).toBe(true);
      const result = await res.json();
      expect(result).toHaveProperty('provider');
      expect(result.provider).not.toBe('unavailable-provider');
    });
  });

  describe('Session Persistence', () => {
    it('should maintain chat context across requests', async () => {
      const messages = [
        'Create a user data structure',
        'Add an email field',
        'Show the final structure'
      ];

      let sessionId: string;

      for (const message of messages) {
        const res = await fetch('http://localhost/dev/agent/chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: message,
            sessionId
          })
        });

        const result = await res.json();
        sessionId = result.sessionId;
        expect(result).toHaveProperty('context');
      }

      // Verify context was maintained
      const res = await fetch('http://localhost/dev/agent/context', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      });

      const context = await res.json();
      expect(context.messages.length).toBeGreaterThan(0);
    });
  });
});
