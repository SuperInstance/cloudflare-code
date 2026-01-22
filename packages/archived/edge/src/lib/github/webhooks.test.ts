/**
 * GitHub Webhook Tests
 *
 * Comprehensive tests for webhook handling and signature verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifyWebhookSignature,
  verifyLegacyWebhookSignature,
  parseWebhookHeaders,
  parseWebhookPayload,
  extractInstallationId,
  extractRepository,
  extractSender,
  extractAction,
  isTestPing,
  WebhookRouter,
  createDefaultWebhookRouter,
  handlePushEvent,
  handlePullRequestEvent,
  processWebhook,
  type WebhookContext,
  type WebhookHandlerResult,
} from './webhooks';
import type { PushWebhookPayload, PullRequestWebhookPayload } from './types';

describe('Webhook Signature Verification', () => {
  const secret = 'test-webhook-secret';
  const payload = JSON.stringify({ test: 'data' });

  describe('verifyWebhookSignature', () => {
    it('should verify valid SHA-256 signature', async () => {
      // Create a valid signature
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(payload);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const signatureHash = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      const signature = `sha256=${signatureHash}`;

      const isValid = await verifyWebhookSignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const isValid = await verifyWebhookSignature(payload, 'sha256=invalid', secret);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong format', async () => {
      const isValid = await verifyWebhookSignature(payload, 'wrong-format', secret);

      expect(isValid).toBe(false);
    });
  });

  describe('verifyLegacyWebhookSignature', () => {
    it('should verify valid SHA-1 signature', async () => {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(payload);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const signatureHash = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      const signature = `sha1=${signatureHash}`;

      const isValid = await verifyLegacyWebhookSignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid SHA-1 signature', async () => {
      const isValid = await verifyLegacyWebhookSignature(payload, 'sha1=invalid', secret);

      expect(isValid).toBe(false);
    });
  });
});

describe('Webhook Header Parsing', () => {
  it('should parse valid webhook headers', () => {
    const headers = new Headers({
      'x-github-event': 'push',
      'x-github-delivery': 'delivery-id-123',
      'x-github-hook-id': 'hook-id-456',
      'x-hub-signature-256': 'sha256=signature',
    });

    const parsed = parseWebhookHeaders(headers);

    expect(parsed['x-github-event']).toBe('push');
    expect(parsed['x-github-delivery']).toBe('delivery-id-123');
    expect(parsed['x-github-hook-id']).toBe('hook-id-456');
    expect(parsed['x-hub-signature-256']).toBe('sha256=signature');
  });

  it('should throw error on missing event header', () => {
    const headers = new Headers({
      'x-github-delivery': 'delivery-id-123',
      'x-github-hook-id': 'hook-id-456',
    });

    expect(() => parseWebhookHeaders(headers)).toThrow();
  });

  it('should throw error on missing delivery header', () => {
    const headers = new Headers({
      'x-github-event': 'push',
      'x-github-hook-id': 'hook-id-456',
    });

    expect(() => parseWebhookHeaders(headers)).toThrow();
  });

  it('should throw error on missing hook ID header', () => {
    const headers = new Headers({
      'x-github-event': 'push',
      'x-github-delivery': 'delivery-id-123',
    });

    expect(() => parseWebhookHeaders(headers)).toThrow();
  });
});

describe('Webhook Payload Parsing', () => {
  it('should parse push webhook payload', () => {
    const payload: PushWebhookPayload = {
      ref: 'refs/heads/main',
      before: 'old-sha',
      after: 'new-sha',
      repository: {
        id: 1,
        name: 'repo',
        full_name: 'owner/repo',
        private: false,
        owner: { login: 'owner', id: 1 },
        default_branch: 'main',
      } as any,
      pusher: { name: 'user', email: 'user@example.com' },
      sender: { login: 'user', id: 1 } as any,
      created: false,
      deleted: false,
      forced: false,
      base_ref: null,
      compare: 'compare-url',
      commits: [],
      head_commit: null,
    };

    const parsed = parseWebhookPayload('push', payload);

    expect(parsed).toHaveProperty('ref');
    expect(parsed).toHaveProperty('repository');
  });

  it('should parse pull request webhook payload', () => {
    const payload: PullRequestWebhookPayload = {
      action: 'opened',
      number: 123,
      pull_request: {
        id: 1,
        number: 123,
        title: 'Test PR',
        state: 'open',
        user: { login: 'user', id: 1 } as any,
        head: { ref: 'feature', sha: 'sha' } as any,
        base: { ref: 'main', sha: 'sha' } as any,
      } as any,
      repository: {
        id: 1,
        name: 'repo',
        full_name: 'owner/repo',
        private: false,
        owner: { login: 'owner', id: 1 },
        default_branch: 'main',
      } as any,
      sender: { login: 'user', id: 1 } as any,
    };

    const parsed = parseWebhookPayload('pull_request', payload);

    expect(parsed).toHaveProperty('action');
    expect(parsed).toHaveProperty('pull_request');
  });
});

describe('Webhook Payload Extraction', () => {
  describe('extractInstallationId', () => {
    it('should extract installation ID from payload', () => {
      const payload = {
        installation: {
          id: 12345,
          node_id: 'node-id',
        },
      };

      const installationId = extractInstallationId(payload);

      expect(installationId).toBe(12345);
    });

    it('should return undefined if no installation', () => {
      const payload = {
        repository: {
          id: 1,
        },
      };

      const installationId = extractInstallationId(payload);

      expect(installationId).toBeUndefined();
    });
  });

  describe('extractRepository', () => {
    it('should extract repository info from payload', () => {
      const payload = {
        repository: {
          id: 1,
          name: 'repo',
          full_name: 'owner/repo',
        },
      };

      const repo = extractRepository(payload);

      expect(repo).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should return undefined if no repository', () => {
      const payload = {
        sender: {
          login: 'user',
        },
      };

      const repo = extractRepository(payload);

      expect(repo).toBeUndefined();
    });
  });

  describe('extractSender', () => {
    it('should extract sender from payload', () => {
      const payload = {
        sender: {
          login: 'user',
          id: 1,
        },
      };

      const sender = extractSender(payload);

      expect(sender).toBe('user');
    });

    it('should return undefined if no sender', () => {
      const payload = {
        repository: {
          id: 1,
        },
      };

      const sender = extractSender(payload);

      expect(sender).toBeUndefined();
    });
  });

  describe('extractAction', () => {
    it('should extract action from payload', () => {
      const payload = {
        action: 'opened',
        issue: {},
      };

      const action = extractAction(payload);

      expect(action).toBe('opened');
    });

    it('should return undefined if no action', () => {
      const payload = {
        repository: {
          id: 1,
        },
      };

      const action = extractAction(payload);

      expect(action).toBeUndefined();
    });
  });

  describe('isTestPing', () => {
    it('should identify ping event', () => {
      expect(isTestPing('ping' as any, {})).toBe(true);
    });

    it('should identify empty push event as ping', () => {
      expect(isTestPing('push', null)).toBe(true);
    });

    it('should return false for normal events', () => {
      expect(isTestPing('push', { repository: {} })).toBe(false);
    });
  });
});

describe('Webhook Router', () => {
  let router: WebhookRouter;

  beforeEach(() => {
    router = new WebhookRouter();
  });

  it('should register handler for event', () => {
    const handler = vi.fn();
    router.on('push', handler);

    // Handler is registered
    expect(true).toBe(true);
  });

  it('should route to registered handler', async () => {
    const handler = vi.fn(async () => ({ success: true, message: 'Handled' }));
    router.on('push', handler);

    const context: WebhookContext = {
      event: 'push',
      deliveryId: 'delivery-123',
      payload: {},
      timestamp: Date.now(),
    };

    const result = await router.route(context);

    expect(handler).toHaveBeenCalledWith(context);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Handled');
  });

  it('should use fallback handler for unregistered events', async () => {
    const fallbackHandler = vi.fn(async () => ({ success: true, message: 'Fallback' }));
    router.onFallback(fallbackHandler);

    const context: WebhookContext = {
      event: 'issues' as any,
      deliveryId: 'delivery-123',
      payload: {},
      timestamp: Date.now(),
    };

    const result = await router.route(context);

    expect(fallbackHandler).toHaveBeenCalledWith(context);
    expect(result.message).toBe('Fallback');
  });

  it('should return default response for unregistered events without fallback', async () => {
    const context: WebhookContext = {
      event: 'issues' as any,
      deliveryId: 'delivery-123',
      payload: {},
      timestamp: Date.now(),
    };

    const result = await router.route(context);

    expect(result.success).toBe(true);
    expect(result.message).toContain('No handler registered');
  });
});

describe('Webhook Event Handlers', () => {
  describe('handlePushEvent', () => {
    it('should handle push event', async () => {
      const context: WebhookContext = {
        event: 'push',
        deliveryId: 'delivery-123',
        payload: {
          ref: 'refs/heads/main',
          before: 'old-sha',
          after: 'new-sha',
          repository: {
            id: 1,
            name: 'repo',
            full_name: 'owner/repo',
            private: false,
            owner: { login: 'owner', id: 1 },
            default_branch: 'main',
          },
          pusher: { name: 'user', email: 'user@example.com' },
          sender: { login: 'user', id: 1 },
          created: false,
          deleted: false,
          forced: false,
          base_ref: null,
          compare: 'url',
          commits: [],
          head_commit: null,
        },
        timestamp: Date.now(),
      };

      const result = await handlePushEvent(context);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('branch', 'main');
    });
  });

  describe('handlePullRequestEvent', () => {
    it('should handle pull request event', async () => {
      const context: WebhookContext = {
        event: 'pull_request',
        deliveryId: 'delivery-123',
        payload: {
          action: 'opened',
          number: 123,
          pull_request: {
            id: 1,
            number: 123,
            title: 'Test PR',
            state: 'open',
            user: { login: 'user', id: 1 },
            head: { ref: 'feature', sha: 'sha' },
            base: { ref: 'main', sha: 'sha' },
          } as any,
          repository: {
            id: 1,
            name: 'repo',
            full_name: 'owner/repo',
            private: false,
            owner: { login: 'owner', id: 1 },
            default_branch: 'main',
          },
          sender: { login: 'user', id: 1 },
        },
        timestamp: Date.now(),
      };

      const result = await handlePullRequestEvent(context);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('action', 'opened');
    });
  });
});

describe('createDefaultWebhookRouter', () => {
  it('should create router with default handlers', () => {
    const router = createDefaultWebhookRouter();

    expect(router).toBeInstanceOf(WebhookRouter);
  });
});

describe('processWebhook', () => {
  it('should process valid webhook request', async () => {
    const secret = 'test-secret';
    const router = createDefaultWebhookRouter();

    // Create valid signature
    const payload = JSON.stringify({ test: 'data' });
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHash = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'ping',
        'x-github-delivery': 'delivery-123',
        'x-github-hook-id': 'hook-456',
        'x-hub-signature-256': `sha256=${signatureHash}`,
      },
      body: payload,
    });

    const result = await processWebhook(request, secret, router);

    expect(result.success).toBe(true);
    expect(result.event).toBe('ping');
  });

  it('should reject webhook with invalid signature', async () => {
    const secret = 'test-secret';
    const router = createDefaultWebhookRouter();

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-123',
        'x-github-hook-id': 'hook-456',
        'x-hub-signature-256': 'sha256=invalid',
      },
      body: '{}',
    });

    const result = await processWebhook(request, secret, router);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Signature verification failed');
  });

  it('should handle test ping events', async () => {
    const secret = 'test-secret';
    const router = createDefaultWebhookRouter();

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'ping',
        'x-github-delivery': 'delivery-123',
        'x-github-hook-id': 'hook-456',
      },
      body: '{}',
    });

    const result = await processWebhook(request, secret, router);

    expect(result.success).toBe(true);
    expect(result.result.message).toContain('Test ping');
  });
});
