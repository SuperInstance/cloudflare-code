/**
 * GitHub Webhook Handler
 * Comprehensive webhook signature verification, event parsing, and routing
 */

import crypto from 'crypto';
import { Webhooks, EmitterWebhookEvent } from '@octokit/webhooks';
import { IncomingMessage, ServerResponse } from 'http';

import {
  WebhookEvent,
  Repository,
  User,
  PullRequest,
  Issue,
  WorkflowRun,
  Release
} from '../types';

import {
  WebhookError,
  InvalidWebhookSignatureError,
  WebhookDeliveryError
} from '../errors';

// ============================================================================
// Webhook Event Context
// ============================================================================

export interface WebhookContext {
  id: string;
  name: WebhookEvent;
  payload: unknown;
  signature: string;
  timestamp: Date;
  deliveryId: string;
  repository?: Repository;
  sender?: User;
  installation?: {
    id: number;
    node_id: string;
  };
  action?: string;
}

// ============================================================================
// Webhook Handler Options
// ============================================================================

export interface WebhookHandlerOptions {
  secret: string;
  path?: string;
  eventFilter?: (event: WebhookContext) => boolean;
  retryConfig?: RetryConfig;
  logConfig?: LogConfig;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetryDelay: number;
}

export interface LogConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  includePayload: boolean;
}

// ============================================================================
// Webhook Event Handler Type
// ============================================================================

export type WebhookEventHandler<T = EmitterWebhookEvent> = (context: WebhookContext, event: T) => void | Promise<void>;

// ============================================================================
// Webhook Event Registry
// ============================================================================

export class WebhookEventRegistry {
  private handlers: Map<WebhookEvent, Set<WebhookEventHandler>> = new Map();
  private wildcardHandlers: Set<WebhookEventHandler> = new Set();
  private errorHandlers: Set<(error: Error, context: WebhookContext) => void | Promise<void>> = new Set();

  on<T = EmitterWebhookEvent>(event: WebhookEvent, handler: WebhookEventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as WebhookEventHandler);
  }

  onAny(handler: WebhookEventHandler): void {
    this.wildcardHandlers.add(handler);
  }

  onError(handler: (error: Error, context: WebhookContext) => void | Promise<void>): void {
    this.errorHandlers.add(handler);
  }

  off<T = EmitterWebhookEvent>(event: WebhookEvent, handler: WebhookEventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler as WebhookEventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  offAny(handler: WebhookEventHandler): void {
    this.wildcardHandlers.delete(handler);
  }

  getHandlers(event: WebhookEvent): Set<WebhookEventHandler> {
    return this.handlers.get(event) || new Set();
  }

  getWildcardHandlers(): Set<WebhookEventHandler> {
    return this.wildcardHandlers;
  }

  getErrorHandlers(): Set<(error: Error, context: WebhookContext) => void | Promise<void>> {
    return this.errorHandlers;
  }

  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
    this.errorHandlers.clear();
  }
}

// ============================================================================
// Webhook Delivery Tracker
// ============================================================================

export interface DeliveryRecord {
  id: string;
  webhookId: number;
  event: WebhookEvent;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  statusCode?: number;
  response?: string;
  attempts: number;
  timestamp: Date;
  error?: string;
}

export class WebhookDeliveryTracker {
  private deliveries: Map<string, DeliveryRecord> = new Map();
  private maxRecords: number = 1000;

  recordDelivery(delivery: DeliveryRecord): void {
    if (this.deliveries.size >= this.maxRecords) {
      const oldestKey = this.deliveries.keys().next().value;
      this.deliveries.delete(oldestKey);
    }
    this.deliveries.set(delivery.id, delivery);
  }

  getDelivery(id: string): DeliveryRecord | undefined {
    return this.deliveries.get(id);
  }

  getDeliveriesByWebhook(webhookId: number, limit: number = 50): DeliveryRecord[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getFailedDeliveries(limit: number = 50): DeliveryRecord[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.status === 'failed' || d.status === 'retrying')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  clear(): void {
    this.deliveries.clear();
  }
}

// ============================================================================
// Main Webhook Handler
// ============================================================================

export class WebhookHandler {
  private webhooks: Webhooks;
  private registry: WebhookEventRegistry;
  private options: WebhookHandlerOptions;
  private deliveryTracker: WebhookDeliveryTracker;
  private signatureCache: Map<string, { signature: string; timestamp: number }> = new Map();
  private signatureCacheTTL: number = 60000; // 1 minute

  constructor(options: WebhookHandlerOptions) {
    this.options = options;
    this.registry = new WebhookEventRegistry();
    this.deliveryTracker = new WebhookDeliveryTracker();

    this.webhooks = new Webhooks({
      secret: options.secret
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.webhooks.onAny(async ({ name, id, payload }) => {
      const context = this.createContext(name as WebhookEvent, id, payload);

      try {
        if (this.options.eventFilter && !this.options.eventFilter(context)) {
          this.log('debug', `Event filtered: ${name}`);
          return;
        }

        await this.executeHandlers(context);
      } catch (error) {
        await this.handleError(error as Error, context);
      }
    });

    this.webhooks.onError(async (error) => {
      this.log('error', 'Webhook signature verification failed', { error });
      throw new InvalidWebhookSignatureError();
    });
  }

  private createContext(
    event: WebhookEvent,
    deliveryId: string,
    payload: unknown
  ): WebhookContext {
    const payloadObj = payload as Record<string, unknown>;

    return {
      id: deliveryId,
      name: event,
      payload,
      signature: '',
      timestamp: new Date(),
      deliveryId,
      repository: payloadObj.repository as Repository,
      sender: payloadObj.sender as User,
      installation: payloadObj.installation as {
        id: number;
        node_id: string;
      },
      action: payloadObj.action as string
    };
  }

  private async executeHandlers(context: WebhookContext): Promise<void> {
    const { name, payload } = context;

    const record: DeliveryRecord = {
      id: context.deliveryId,
      webhookId: 0,
      event: name,
      status: 'pending',
      attempts: 0,
      timestamp: new Date()
    };

    try {
      const eventHandlers = this.registry.getHandlers(name);
      const wildcardHandlers = this.registry.getWildcardHandlers();

      const allHandlers = [...eventHandlers, ...wildcardHandlers];

      if (allHandlers.length === 0) {
        this.log('debug', `No handlers registered for event: ${name}`);
        return;
      }

      this.log('info', `Executing ${allHandlers.length} handlers for event: ${name}`);

      for (const handler of allHandlers) {
        record.attempts++;

        try {
          await handler(context, payload as EmitterWebhookEvent);
        } catch (error) {
          this.log('error', `Handler execution failed for event: ${name}`, {
            error,
            handler: handler.name
          });
          throw error;
        }
      }

      record.status = 'success';
      this.log('info', `Successfully processed webhook: ${name}`);
    } catch (error) {
      record.status = 'failed';
      record.error = (error as Error).message;
      throw error;
    } finally {
      this.deliveryTracker.recordDelivery(record);
    }
  }

  private async handleError(error: Error, context: WebhookContext): Promise<void> {
    this.log('error', `Error handling webhook: ${context.name}`, { error });

    const errorHandlers = this.registry.getErrorHandlers();

    for (const handler of errorHandlers) {
      try {
        await handler(error, context);
      } catch (handlerError) {
        this.log('error', 'Error in error handler', { error: handlerError });
      }
    }

    throw error;
  }

  // ============================================================================
  // Signature Verification
  ============================================================================//

  verifySignature(payload: string | Buffer, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.options.secret);
    const digest = hmac.update(payload).digest('hex');
    const expectedSignature = `sha256=${digest}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  verifySignatureWithCache(payload: string | Buffer, signature: string): boolean {
    const cacheKey = `${payload.toString()}:${signature}`;
    const cached = this.signatureCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.signatureCacheTTL) {
      return cached.signature === signature;
    }

    const isValid = this.verifySignature(payload, signature);

    this.signatureCache.set(cacheKey, {
      signature,
      timestamp: Date.now()
    });

    return isValid;
  }

  // ============================================================================
  // HTTP Handler
  // ============================================================================

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const startTime = Date.now();

    try {
      if (request.method !== 'POST') {
        response.statusCode = 405;
        response.setHeader('Allow', 'POST');
        response.end('Method Not Allowed');
        return;
      }

      const signature = request.headers['x-hub-signature-256'] as string;

      if (!signature) {
        throw new InvalidWebhookSignatureError();
      }

      const payload = await this.readPayload(request);

      if (!this.verifySignatureWithCache(payload, signature)) {
        throw new InvalidWebhookSignatureError();
      }

      const id = request.headers['x-github-delivery'] as string;
      const event = request.headers['x-github-event'] as WebhookEvent;

      if (!id || !event) {
        throw new WebhookError('Missing required headers');
      }

      const parsedPayload = JSON.parse(payload.toString());
      await this.webhooks.verifyAndReceive({
        id,
        name: event,
        payload: parsedPayload,
        signature
      });

      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ success: true, delivery_id: id }));

      this.log('info', `Webhook processed successfully`, {
        event,
        deliveryId: id,
        duration: Date.now() - startTime
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof InvalidWebhookSignatureError) {
        response.statusCode = 401;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({
        error: 'Internal server error',
        message: (error as Error).message
      }));

      this.log('error', 'Webhook handling failed', {
        error,
        duration
      });
    }
  }

  private async readPayload(request: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      request.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      request.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      request.on('error', reject);
    });
  }

  // ============================================================================
  // Event Registration
  // ============================================================================

  on<T = EmitterWebhookEvent>(
    event: WebhookEvent,
    handler: WebhookEventHandler<T>
  ): void {
    this.registry.on(event, handler);
  }

  onAny(handler: WebhookEventHandler): void {
    this.registry.onAny(handler);
  }

  onError(handler: (error: Error, context: WebhookContext) => void | Promise<void>): void {
    this.registry.onError(handler);
  }

  off<T = EmitterWebhookEvent>(
    event: WebhookEvent,
    handler: WebhookEventHandler<T>
  ): void {
    this.registry.off(event, handler);
  }

  offAny(handler: WebhookEventHandler): void {
    this.registry.offAny(handler);
  }

  // ============================================================================
  // Delivery Tracking
  // ============================================================================

  getDelivery(id: string): DeliveryRecord | undefined {
    return this.deliveryTracker.getDelivery(id);
  }

  getDeliveriesByWebhook(webhookId: number, limit?: number): DeliveryRecord[] {
    return this.deliveryTracker.getDeliveriesByWebhook(webhookId, limit);
  }

  getFailedDeliveries(limit?: number): DeliveryRecord[] {
    return this.deliveryTracker.getFailedDeliveries(limit);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    if (!this.options.logConfig?.enabled) {
      return;
    }

    const logLevel = this.options.logConfig.level;

    const shouldLog = level === 'error' ||
      (logLevel === 'debug' && ['debug', 'info', 'warn', 'error'].includes(level)) ||
      (logLevel === 'info' && ['info', 'warn', 'error'].includes(level)) ||
      (logLevel === 'warn' && ['warn', 'error'].includes(level));

    if (shouldLog) {
      const logData = {
        level,
        message,
        ...meta,
        timestamp: new Date().toISOString()
      };

      if (this.options.logConfig.includePayload && meta?.payload) {
        (logData as Record<string, unknown>).payload = meta.payload;
      }

      console.log(JSON.stringify(logData));
    }
  }

  getRegistry(): WebhookEventRegistry {
    return this.registry;
  }

  clearCache(): void {
    this.signatureCache.clear();
  }

  getStats(): {
    deliveries: number;
    failed: number;
    cachedSignatures: number;
  } {
    const failed = this.deliveryTracker.getFailedDeliveries().length;

    return {
      deliveries: this.deliveryTracker['deliveries'].size,
      failed,
      cachedSignatures: this.signatureCache.size
    };
  }
}

// ============================================================================
// Webhook Event Middleware
// ============================================================================

export class WebhookMiddleware {
  private handler: WebhookHandler;

  constructor(handler: WebhookHandler) {
    this.handler = handler;
  }

  middleware() {
    return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
      await this.handler.handle(request, response);
    };
  }

  expressMiddleware() {
    return async (req: any, res: any, next: any): Promise<void> => {
      if (req.path === (this.handler['options'].path || '/webhook')) {
        await this.handler.handle(req, res);
      } else {
        next();
      }
    };
  }

  fastifyMiddleware() {
    return async (request: any, reply: any): Promise<void> => {
      const req = request.raw as IncomingMessage;
      const res = reply.raw as ServerResponse;
      await this.handler.handle(req, res);
    };
  }
}

// ============================================================================
// Event Filter Helpers
// ============================================================================

export class EventFilters {
  static byOwner(owner: string): (context: WebhookContext) => boolean {
    return (context) => context.repository?.owner.login === owner;
  }

  static byRepository(name: string): (context: WebhookContext) => boolean {
    return (context) => context.repository?.name === name;
  }

  static byAction(action: string): (context: WebhookContext) => boolean {
    return (context) => context.action === action;
  }

  static byBranch(branch: string): (context: WebhookContext) => boolean {
    return (context) => {
      const payload = context.payload as Record<string, unknown>;
      return (payload.ref as string)?.replace('refs/heads/', '') === branch;
    };
  }

  static byLabel(label: string): (context: WebhookContext) => boolean {
    return (context) => {
      const payload = context.payload as Record<string, unknown>;
      const labels = (payload.pull_request || payload.issue)?.labels as Array<{ name: string }>;
      return labels?.some(l => l.name === label) || false;
    };
  }

  static combine(...filters: Array<(context: WebhookContext) => boolean>): (context: WebhookContext) => boolean {
    return (context) => filters.every(filter => filter(context));
  }

  static or(...filters: Array<(context: WebhookContext) => boolean>): (context: WebhookContext) => boolean {
    return (context) => filters.some(filter => filter(context));
  }

  static not(filter: (context: WebhookContext) => boolean): (context: WebhookContext) => boolean {
    return (context) => !filter(context);
  }
}

// ============================================================================
// Webhook Event Builders
// ============================================================================

export class WebhookEventBuilders {
  static buildPullRequestOpenedContext(repo: Repository, pr: PullRequest, sender: User): WebhookContext {
    return {
      id: 'test-id',
      name: WebhookEvent.PullRequest,
      payload: {
        action: 'opened',
        repository: repo,
        pull_request: pr,
        sender
      },
      signature: '',
      timestamp: new Date(),
      deliveryId: 'test-delivery-id',
      repository: repo,
      sender,
      action: 'opened'
    };
  }

  static buildIssueCreatedContext(repo: Repository, issue: Issue, sender: User): WebhookContext {
    return {
      id: 'test-id',
      name: WebhookEvent.Issues,
      payload: {
        action: 'opened',
        repository: repo,
        issue,
        sender
      },
      signature: '',
      timestamp: new Date(),
      deliveryId: 'test-delivery-id',
      repository: repo,
      sender,
      action: 'opened'
    };
  }

  static buildPushContext(repo: Repository, ref: string, sender: User): WebhookContext {
    return {
      id: 'test-id',
      name: WebhookEvent.Push,
      payload: {
        ref,
        repository: repo,
        sender,
        before: '0000000000000000000000000000000000000000',
        after: '1234567890123456789012345678901234567890'
      },
      signature: '',
      timestamp: new Date(),
      deliveryId: 'test-delivery-id',
      repository: repo,
      sender
    };
  }

  static buildWorkflowRunContext(repo: Repository, workflowRun: WorkflowRun, sender: User): WebhookContext {
    return {
      id: 'test-id',
      name: WebhookEvent.WorkflowRun,
      payload: {
        action: 'completed',
        repository: repo,
        workflow_run: workflowRun,
        sender
      },
      signature: '',
      timestamp: new Date(),
      deliveryId: 'test-delivery-id',
      repository: repo,
      sender,
      action: 'completed'
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createWebhookHandler(options: WebhookHandlerOptions): WebhookHandler {
  return new WebhookHandler(options);
}

export function createWebhookMiddleware(handler: WebhookHandler): WebhookMiddleware {
  return new WebhookMiddleware(handler);
}
