/**
 * Unit Tests for Webhook Handler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebhookHandler,
  WebhookEventRegistry,
  EventFilters,
  WebhookEventBuilders,
  createWebhookHandler
} from '../../src/webhooks/handler';
import { WebhookEvent, Repository, User, PullRequest } from '../../src/types';
import { InvalidWebhookSignatureError } from '../../src/errors';
import { IncomingMessage, ServerResponse } from 'http';

describe('WebhookHandler', () => {
  let handler: WebhookHandler;
  let mockOptions: any;

  beforeEach(() => {
    mockOptions = {
      secret: 'test-secret',
      path: '/webhook',
      logConfig: {
        enabled: true,
        level: 'info',
        includePayload: false
      }
    };

    handler = createWebhookHandler(mockOptions);
  });

  afterEach(() => {
    handler.clearCache();
  });

  describe('Handler Creation', () => {
    it('should create a webhook handler', () => {
      expect(handler).toBeInstanceOf(WebhookHandler);
    });

    it('should require a secret', () => {
      expect(() => createWebhookHandler({
        secret: ''
      })).not.toThrow();
    });
  });

  describe('Signature Verification', () => {
    it('should verify valid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = handler['webhooks'].sign(payload);

      const isValid = handler.verifySignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'invalid-signature';

      const isValid = handler.verifySignature(payload, signature);

      expect(isValid).toBe(false);
    });

    it('should use cache for signature verification', () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = handler['webhooks'].sign(payload);

      const isValid1 = handler.verifySignatureWithCache(payload, signature);
      const isValid2 = handler.verifySignatureWithCache(payload, signature);

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });
  });

  describe('Event Registration', () => {
    it('should register event handler', () => {
      const mockHandler = vi.fn();
      handler.on(WebhookEvent.Push, mockHandler);

      const registry = handler.getRegistry();
      const handlers = registry.getHandlers(WebhookEvent.Push);

      expect(handlers.size).toBe(1);
    });

    it('should register wildcard handler', () => {
      const mockHandler = vi.fn();
      handler.onAny(mockHandler);

      const registry = handler.getRegistry();
      const wildcardHandlers = registry.getWildcardHandlers();

      expect(wildcardHandlers.size).toBe(1);
    });

    it('should register error handler', () => {
      const mockHandler = vi.fn();
      handler.onError(mockHandler);

      const registry = handler.getRegistry();
      const errorHandlers = registry.getErrorHandlers();

      expect(errorHandlers.size).toBe(1);
    });

    it('should unregister event handler', () => {
      const mockHandler = vi.fn();
      handler.on(WebhookEvent.Push, mockHandler);
      handler.off(WebhookEvent.Push, mockHandler);

      const registry = handler.getRegistry();
      const handlers = registry.getHandlers(WebhookEvent.Push);

      expect(handlers.size).toBe(0);
    });
  });

  describe('HTTP Handler', () => {
    it('should reject non-POST requests', async () => {
      const request = {
        method: 'GET',
        headers: {}
      } as IncomingMessage;

      const response = {
        statusCode: 0,
        headers: {},
        setHeader: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await handler.handle(request, response);

      expect(response.statusCode).toBe(405);
    });

    it('should reject requests without signature', async () => {
      const request = {
        method: 'POST',
        headers: {},
        // @ts-ignore
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('test payload'));
          } else if (event === 'end') {
            handler();
          }
        })
      } as IncomingMessage;

      const response = {
        statusCode: 0,
        headers: {},
        setHeader: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await handler.handle(request, response);

      expect(response.statusCode).toBe(401);
    });

    it('should handle valid webhook requests', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = handler['webhooks'].sign(payload);

      const request = {
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
          'x-github-delivery': 'test-delivery-id',
          'x-github-event': WebhookEvent.Ping
        },
        // @ts-ignore
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from(payload));
          } else if (event === 'end') {
            handler();
          }
        })
      } as IncomingMessage;

      const response = {
        statusCode: 0,
        headers: {},
        setHeader: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await handler.handle(request, response);

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Delivery Tracking', () => {
    it('should record delivery', () => {
      const record = {
        id: 'test-delivery-id',
        webhookId: 1,
        event: WebhookEvent.Push,
        status: 'success' as const,
        attempts: 1,
        timestamp: new Date()
      };

      handler['deliveryTracker'].recordDelivery(record);

      const retrieved = handler.getDelivery('test-delivery-id');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-delivery-id');
    });

    it('should get deliveries by webhook', () => {
      const record = {
        id: 'test-delivery-id',
        webhookId: 1,
        event: WebhookEvent.Push,
        status: 'success' as const,
        attempts: 1,
        timestamp: new Date()
      };

      handler['deliveryTracker'].recordDelivery(record);

      const deliveries = handler.getDeliveriesByWebhook(1);
      expect(deliverments.length).toBeGreaterThan(0);
    });

    it('should get failed deliveries', () => {
      const record = {
        id: 'failed-delivery-id',
        webhookId: 1,
        event: WebhookEvent.Push,
        status: 'failed' as const,
        attempts: 3,
        timestamp: new Date(),
        error: 'Test error'
      };

      handler['deliveryTracker'].recordDelivery(record);

      const failed = handler.getFailedDeliveries();
      expect(failed.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should get handler stats', () => {
      const stats = handler.getStats();

      expect(stats).toHaveProperty('deliveries');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('cachedSignatures');
    });
  });
});

describe('WebhookEventRegistry', () => {
  let registry: WebhookEventRegistry;

  beforeEach(() => {
    registry = new WebhookEventRegistry();
  });

  it('should register and retrieve handlers', () => {
    const handler = vi.fn();
    registry.on(WebhookEvent.Push, handler);

    const handlers = registry.getHandlers(WebhookEvent.Push);
    expect(handlers.has(handler)).toBe(true);
  });

  it('should register wildcard handlers', () => {
    const handler = vi.fn();
    registry.onAny(handler);

    const wildcardHandlers = registry.getWildcardHandlers();
    expect(wildcardHandlers.has(handler)).toBe(true);
  });

  it('should register error handlers', () => {
    const handler = vi.fn();
    registry.onError(handler);

    const errorHandlers = registry.getErrorHandlers();
    expect(errorHandlers.has(handler)).toBe(true);
  });

  it('should unregister handlers', () => {
    const handler = vi.fn();
    registry.on(WebhookEvent.Push, handler);
    registry.off(WebhookEvent.Push, handler);

    const handlers = registry.getHandlers(WebhookEvent.Push);
    expect(handlers.has(handler)).toBe(false);
  });

  it('should clear all handlers', () => {
    const handler = vi.fn();
    registry.on(WebhookEvent.Push, handler);
    registry.onAny(handler);
    registry.onError(handler);

    registry.clear();

    expect(registry.getHandlers(WebhookEvent.Push).size).toBe(0);
    expect(registry.getWildcardHandlers().size).toBe(0);
    expect(registry.getErrorHandlers().size).toBe(0);
  });
});

describe('EventFilters', () => {
  it('should filter by owner', () => {
    const filter = EventFilters.byOwner('octocat');
    const context = {
      repository: {
        owner: {
          login: 'octocat'
        }
      }
    } as any;

    expect(filter(context)).toBe(true);
  });

  it('should filter by repository name', () => {
    const filter = EventFilters.byRepository('Hello-World');
    const context = {
      repository: {
        name: 'Hello-World'
      }
    } as any;

    expect(filter(context)).toBe(true);
  });

  it('should filter by action', () => {
    const filter = EventFilters.byAction('opened');
    const context = {
      action: 'opened'
    } as any;

    expect(filter(context)).toBe(true);
  });

  it('should filter by branch', () => {
    const filter = EventFilters.byBranch('main');
    const context = {
      payload: {
        ref: 'refs/heads/main'
      }
    } as any;

    expect(filter(context)).toBe(true);
  });

  it('should combine filters with AND', () => {
    const filter = EventFilters.combine(
      EventFilters.byOwner('octocat'),
      EventFilters.byRepository('Hello-World')
    );

    const context = {
      repository: {
        owner: { login: 'octocat' },
        name: 'Hello-World'
      }
    } as any;

    expect(filter(context)).toBe(true);
  });

  it('should combine filters with OR', () => {
    const filter = EventFilters.or(
      EventFilters.byOwner('octocat'),
      EventFilters.byOwner('other-user')
    );

    const context1 = {
      repository: {
        owner: { login: 'octocat' }
      }
    } as any;

    const context2 = {
      repository: {
        owner: { login: 'other-user' }
      }
    } as any;

    expect(filter(context1)).toBe(true);
    expect(filter(context2)).toBe(true);
  });

  it('should negate filter', () => {
    const filter = EventFilters.not(EventFilters.byOwner('octocat'));
    const context = {
      repository: {
        owner: { login: 'other-user' }
      }
    } as any;

    expect(filter(context)).toBe(true);
  });
});

describe('WebhookEventBuilders', () => {
  it('should build PR opened context', () => {
    const repo = {
      id: 1,
      name: 'Hello-World',
      full_name: 'octocat/Hello-World',
      owner: { login: 'octocat' }
    } as Repository;

    const pr = {
      id: 1,
      number: 1,
      title: 'Test PR',
      state: 'open'
    } as PullRequest;

    const sender = {
      login: 'octocat',
      id: 1
    } as User;

    const context = WebhookEventBuilders.buildPullRequestOpenedContext(repo, pr, sender);

    expect(context.name).toBe(WebhookEvent.PullRequest);
    expect(context.action).toBe('opened');
    expect(context.repository).toBe(repo);
  });

  it('should build push context', () => {
    const repo = {
      id: 1,
      name: 'Hello-World',
      full_name: 'octocat/Hello-World',
      owner: { login: 'octocat' }
    } as Repository;

    const sender = {
      login: 'octocat',
      id: 1
    } as User;

    const context = WebhookEventBuilders.buildPushContext(repo, 'refs/heads/main', sender);

    expect(context.name).toBe(WebhookEvent.Push);
    expect(context.repository).toBe(repo);
    expect((context.payload as any).ref).toBe('refs/heads/main');
  });
});
