/**
 * GitHub Webhook Handler
 *
 * Handles incoming GitHub webhooks with signature verification,
 * event routing, and processing optimized for Cloudflare Workers
 */

import {
  WebhookHeaders,
  WebhookEventType,
  PushWebhookPayload,
  PullRequestWebhookPayload,
  IssueWebhookPayload,
  IssueCommentWebhookPayload,
  CheckRunWebhookPayload,
  WorkflowRunWebhookPayload,
  WebhookVerificationError,
} from './types';
import { Context } from 'hono';

// ============================================================================
// Webhook Signature Verification
// ============================================================================

/**
 * Verify webhook signature
 *
 * GitHub webhooks are signed with HMAC-SHA256
 * The signature is sent in the x-hub-signature-256 header
 *
 * @param payload - Raw request body
 * @param signature - Signature from x-hub-signature-256 header
 * @param secret - Webhook secret
 * @returns True if signature is valid
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // Signature format: sha256=<hex>
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const signatureHash = signature.slice(7);

  // Compute HMAC-SHA256
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
  const computedHash = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time comparison to prevent timing attacks
  return constantTimeEqual(signatureHash, computedHash);
}

/**
 * Constant-time string comparison
 *
 * Prevents timing attacks by comparing all characters
 * regardless of where the first difference occurs
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Verify legacy webhook signature (SHA-1)
 *
 * GitHub used to use SHA-1 for webhook signatures
 * This is for backward compatibility
 *
 * @param payload - Raw request body
 * @param signature - Signature from x-hub-signature header
 * @param secret - Webhook secret
 * @returns True if signature is valid
 */
export async function verifyLegacyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature.startsWith('sha1=')) {
    return false;
  }

  const signatureHash = signature.slice(5);

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
  const computedHash = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return constantTimeEqual(signatureHash, computedHash);
}

// ============================================================================
// Webhook Event Parsing
// ============================================================================

/**
 * Parse webhook headers
 *
 * @param headers - Request headers
 * @returns Parsed webhook headers
 */
export function parseWebhookHeaders(headers: Headers): WebhookHeaders {
  const event = headers.get('x-github-event');
  const delivery = headers.get('x-github-delivery');
  const signature256 = headers.get('x-hub-signature-256');
  const signature = headers.get('x-hub-signature');
  const hookId = headers.get('x-github-hook-id');
  const installationTargetType = headers.get('x-github-hook-installation-target-type');
  const installationTargetId = headers.get('x-github-hook-installation-target-id');

  if (!event) {
    throw new WebhookVerificationError('Missing x-github-event header');
  }

  if (!delivery) {
    throw new WebhookVerificationError('Missing x-github-delivery header');
  }

  if (!hookId) {
    throw new WebhookVerificationError('Missing x-github-hook-id header');
  }

  return {
    'x-github-event': event as WebhookEventType,
    'x-github-delivery': delivery,
    'x-hub-signature-256': signature256 ?? undefined,
    'x-hub-signature': signature ?? undefined,
    'x-github-hook-id': hookId,
    'x-github-hook-installation-target-type': (installationTargetType as 'integration' | 'organization' | 'repository') ?? undefined,
    'x-github-hook-installation-target-id': installationTargetId ?? undefined,
  };
}

/**
 * Parse webhook payload
 *
 * @param event - Event type
 * @param payload - Raw payload
 * @returns Parsed payload
 */
export function parseWebhookPayload(
  event: WebhookEventType,
  payload: unknown
):
  | PushWebhookPayload
  | PullRequestWebhookPayload
  | IssueWebhookPayload
  | IssueCommentWebhookPayload
  | CheckRunWebhookPayload
  | WorkflowRunWebhookPayload {
  // Type assertion based on event type
  return payload as
    | PushWebhookPayload
    | PullRequestWebhookPayload
    | IssueWebhookPayload
    | IssueCommentWebhookPayload
    | CheckRunWebhookPayload
    | WorkflowRunWebhookPayload;
}

// ============================================================================
// Webhook Event Handler Interface
// ============================================================================

/**
 * Webhook event handler context
 */
export interface WebhookContext {
  event: WebhookEventType;
  deliveryId: string;
  installationId?: number;
  payload: unknown;
  timestamp: number;
}

/**
 * Webhook event handler result
 */
export interface WebhookHandlerResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Webhook event handler function
 */
export type WebhookEventHandler = (
  context: WebhookContext
) => Promise<WebhookHandlerResult>;

/**
 * Webhook event handlers registry
 */
interface WebhookEventHandlers {
  [key: string]: WebhookEventHandler | undefined;
}

// ============================================================================
// Webhook Router
// ============================================================================

/**
 * Webhook Router Class
 *
 * Routes webhook events to appropriate handlers
 */
export class WebhookRouter {
  private handlers: WebhookEventHandlers = {};
  private fallbackHandler?: WebhookEventHandler;

  /**
   * Register handler for an event type
   *
   * @param event - Event type
   * @param handler - Event handler
   */
  on(event: WebhookEventType, handler: WebhookEventHandler): void {
    this.handlers[event] = handler;
  }

  /**
   * Register multiple handlers
   *
   * @param handlers - Object mapping event types to handlers
   */
  onMany(handlers: Partial<Record<WebhookEventType, WebhookEventHandler>>): void {
    for (const [event, handler] of Object.entries(handlers)) {
      if (handler) {
        this.handlers[event as WebhookEventType] = handler;
      }
    }
  }

  /**
   * Register fallback handler for unregistered events
   *
   * @param handler - Fallback handler
   */
  onFallback(handler: WebhookEventHandler): void {
    this.fallbackHandler = handler;
  }

  /**
   * Route webhook to appropriate handler
   *
   * @param context - Webhook context
   * @returns Handler result
   */
  async route(context: WebhookContext): Promise<WebhookHandlerResult> {
    const handler = this.handlers[context.event];

    if (handler) {
      return handler(context);
    }

    if (this.fallbackHandler) {
      return this.fallbackHandler(context);
    }

    // Default: acknowledge but don't process
    return {
      success: true,
      message: `No handler registered for event: ${context.event}`,
    };
  }
}

// ============================================================================
// Webhook Middleware for Hono
// ============================================================================

/**
 * Webhook verification middleware options
 */
export interface WebhookMiddlewareOptions {
  secret: string;
  requireSignature?: boolean;
}

/**
 * Create webhook verification middleware for Hono
 *
 * @param options - Middleware options
 * @returns Hono middleware function
 */
export function webhookMiddleware(options: WebhookMiddlewareOptions) {
  return async (c: Context, next: () => Promise<void>) => {
    const signature256 = c.req.header('x-hub-signature-256');
    const signature = c.req.header('x-hub-signature');

    // Verify signature if required
    if (options.requireSignature || signature256 || signature) {
      // Get raw body
      const body = await c.req.raw.text();
      const valid = signature256
        ? await verifyWebhookSignature(body, signature256!, options.secret)
        : signature
        ? await verifyLegacyWebhookSignature(body, signature!, options.secret)
        : false;

      if (!valid) {
        return c.json({ error: 'Invalid signature' }, 401);
      }

      // Store raw body in context for later use
      c.set('webhookBody', body);
    }

    await next();
  };
}

// ============================================================================
// Webhook Handler Utilities
// ============================================================================

/**
 * Extract installation ID from webhook payload
 *
 * @param payload - Webhook payload
 * @returns Installation ID or undefined
 */
export function extractInstallationId(payload: unknown): number | undefined {
  const payloadObj = payload as Record<string, unknown>;

  // Check for installation at top level
  if (payloadObj.installation) {
    const installation = payloadObj.installation as Record<string, unknown>;
    return installation.id as number;
  }

  // Check in repository object
  if (payloadObj.repository) {
    return undefined; // Installation ID is not in repository object
  }

  return undefined;
}

/**
 * Extract repository information from webhook payload
 *
 * @param payload - Webhook payload
 * @returns Repository owner and name or undefined
 */
export function extractRepository(payload: unknown): { owner: string; repo: string } | undefined {
  const payloadObj = payload as Record<string, unknown>;

  if (payloadObj.repository) {
    const repository = payloadObj.repository as Record<string, unknown>;
    const fullName = repository.full_name as string;
    const [owner, repo] = fullName.split('/');

    return { owner, repo };
  }

  return undefined;
}

/**
 * Extract sender from webhook payload
 *
 * @param payload - Webhook payload
 * @returns Sender username or undefined
 */
export function extractSender(payload: unknown): string | undefined {
  const payloadObj = payload as Record<string, unknown>;

  if (payloadObj.sender) {
    const sender = payloadObj.sender as Record<string, unknown>;
    return sender.login as string;
  }

  return undefined;
}

/**
 * Extract action from webhook payload
 *
 * Some webhook events have an 'action' field that describes what happened
 *
 * @param payload - Webhook payload
 * @returns Action or undefined
 */
export function extractAction(payload: unknown): string | undefined {
  const payloadObj = payload as Record<string, unknown>;
  return payloadObj.action as string;
}

/**
 * Check if webhook is a test ping
 *
 * GitHub sends a 'ping' event when a webhook is first created
 *
 * @param event - Event type
 * @param payload - Webhook payload
 * @returns True if this is a ping event
 */
export function isTestPing(event: WebhookEventType, payload: unknown): boolean {
  return event === 'ping' || (event === 'push' && !payload);
}

// ============================================================================
// Common Webhook Event Handlers
// ============================================================================

/**
 * Handle push event
 *
 * Triggered when a commit is pushed to a repository
 */
export async function handlePushEvent(
  context: WebhookContext
): Promise<WebhookHandlerResult> {
  const payload = parseWebhookPayload('push', context.payload) as PushWebhookPayload;

  // Extract relevant information
  const { ref, before, after, repository, pusher, commits, head_commit } = payload;

  // Determine if this is a branch creation or deletion
  const isBranchCreated = payload.created;
  const isBranchDeleted = payload.deleted;

  // Get branch name from ref (refs/heads/main -> main)
  const branchName = ref.replace('refs/heads/', '');

  return {
    success: true,
    message: `Push to ${repository.full_name} on branch ${branchName}`,
    data: {
      branch: branchName,
      before,
      after,
      commitCount: commits.length,
      pusher: pusher.name,
      isBranchCreated,
      isBranchDeleted,
      headCommit: head_commit ? {
        id: head_commit.id,
        message: head_commit.message,
        author: head_commit.author.name,
      } : null,
    },
  };
}

/**
 * Handle pull request event
 *
 * Triggered when a pull request is opened, closed, reopened, etc.
 */
export async function handlePullRequestEvent(
  context: WebhookContext
): Promise<WebhookHandlerResult> {
  const payload = parseWebhookPayload('pull_request', context.payload) as PullRequestWebhookPayload;

  const { action, pull_request, repository, sender } = payload;

  return {
    success: true,
    message: `PR #${pull_request.number} ${action} by ${sender.login}`,
    data: {
      action,
      pullRequest: {
        number: pull_request.number,
        title: pull_request.title,
        state: pull_request.state,
        merged: pull_request.merged,
        draft: pull_request.draft,
        headBranch: pull_request.head.ref,
        baseBranch: pull_request.base.ref,
        additions: pull_request.additions,
        deletions: pull_request.deletions,
        changedFiles: pull_request.changed_files,
      },
      repository: repository.full_name,
      sender: sender.login,
    },
  };
}

/**
 * Handle issue event
 *
 * Triggered when an issue is opened, closed, edited, etc.
 */
export async function handleIssueEvent(
  context: WebhookContext
): Promise<WebhookHandlerResult> {
  const payload = parseWebhookPayload('issues', context.payload) as IssueWebhookPayload;

  const { action, issue, repository, sender } = payload;

  return {
    success: true,
    message: `Issue #${issue.number} ${action} by ${sender.login}`,
    data: {
      action,
      issue: {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        assignees: issue.assignees.map(a => a.login),
      },
      repository: repository.full_name,
      sender: sender.login,
    },
  };
}

/**
 * Handle issue comment event
 *
 * Triggered when a comment is created, edited, or deleted on an issue
 */
export async function handleIssueCommentEvent(
  context: WebhookContext
): Promise<WebhookHandlerResult> {
  const payload = parseWebhookPayload('issue_comment', context.payload) as IssueCommentWebhookPayload;

  const { action, issue, comment, repository, sender } = payload;

  return {
    success: true,
    message: `Comment ${action} on issue #${issue.number} by ${sender.login}`,
    data: {
      action,
      issue: {
        number: issue.number,
        title: issue.title,
      },
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.created_at,
      },
      repository: repository.full_name,
      sender: sender.login,
    },
  };
}

/**
 * Handle workflow run event
 *
 * Triggered when a GitHub Actions workflow run is requested or completed
 */
export async function handleWorkflowRunEvent(
  context: WebhookContext
): Promise<WebhookHandlerResult> {
  const payload = parseWebhookPayload('workflow_run', context.payload) as WorkflowRunWebhookPayload;

  const { action, workflow_run, repository, sender } = payload;

  return {
    success: true,
    message: `Workflow run ${action}: ${workflow_run.name}`,
    data: {
      action,
      workflowRun: {
        id: workflow_run.id,
        name: workflow_run.name,
        status: workflow_run.status,
        conclusion: workflow_run.conclusion,
        runNumber: workflow_run.run_number,
        event: workflow_run.event,
        headBranch: workflow_run.head_branch,
        headSha: workflow_run.head_sha,
        actor: workflow_run.actor.login,
      },
      repository: repository.full_name,
      sender: sender.login,
    },
  };
}

/**
 * Handle check run event
 *
 * Triggered when a check run is created, completed, or rerequested
 */
export async function handleCheckRunEvent(
  context: WebhookContext
): Promise<WebhookHandlerResult> {
  const payload = parseWebhookPayload('check_run', context.payload) as CheckRunWebhookPayload;

  const { action, check_run, repository, sender } = payload;

  return {
    success: true,
    message: `Check run ${action}: ${check_run.name}`,
    data: {
      action,
      checkRun: {
        id: check_run.id,
        name: check_run.name,
        headSha: check_run.head_sha,
        status: check_run.status,
        conclusion: check_run.conclusion,
        startedAt: check_run.started_at,
        completedAt: check_run.completed_at,
        output: {
          title: check_run.output.title,
          summary: check_run.output.summary,
        },
      },
      repository: repository.full_name,
      sender: sender.login,
    },
  };
}

// ============================================================================
// Webhook Handler Factory
// ============================================================================

/**
 * Create webhook router with default handlers
 *
 * @returns Webhook router with common event handlers
 */
export function createDefaultWebhookRouter(): WebhookRouter {
  const router = new WebhookRouter();

  // Register default handlers
  router.on('push', handlePushEvent);
  router.on('pull_request', handlePullRequestEvent);
  router.on('issues', handleIssueEvent);
  router.on('issue_comment', handleIssueCommentEvent);
  router.on('workflow_run', handleWorkflowRunEvent);
  router.on('check_run', handleCheckRunEvent);

  return router;
}

// ============================================================================
// Webhook Processing Utility
// ============================================================================

/**
 * Process webhook request
 *
 * High-level utility to process a webhook request end-to-end
 *
 * @param request - HTTP request
 * @param secret - Webhook secret
 * @param router - Webhook router
 * @returns Processing result
 */
export async function processWebhook(
  request: Request,
  secret: string,
  router: WebhookRouter
): Promise<{
  success: boolean;
  event: WebhookEventType;
  deliveryId: string;
  result: WebhookHandlerResult;
  error?: string;
}> {
  try {
    // Get raw body
    const body = await request.text();

    // Parse headers
    const headers = parseWebhookHeaders(request.headers);

    // Verify signature
    const signature256 = request.headers.get('x-hub-signature-256');
    const signature = request.headers.get('x-hub-signature');

    if (signature256 || signature) {
      const valid = signature256
        ? await verifyWebhookSignature(body, signature256, secret)
        : await verifyLegacyWebhookSignature(body, signature!, secret);

      if (!valid) {
        return {
          success: false,
          event: headers['x-github-event'],
          deliveryId: headers['x-github-delivery'],
          result: { success: false, message: 'Invalid signature' },
          error: 'Signature verification failed',
        };
      }
    }

    // Parse payload
    const payload = JSON.parse(body);

    // Create context
    const installationId = extractInstallationId(payload);
    const context: WebhookContext = {
      event: headers['x-github-event'],
      deliveryId: headers['x-github-delivery'],
      installationId,
      payload,
      timestamp: Date.now(),
    };

    // Check for test ping
    if (isTestPing(context.event, payload)) {
      return {
        success: true,
        event: context.event,
        deliveryId: context.deliveryId,
        result: {
          success: true,
          message: 'Test ping received',
        },
      };
    }

    // Route to handler
    const result = await router.route(context);

    return {
      success: true,
      event: context.event,
      deliveryId: context.deliveryId,
      result,
    };
  } catch (error) {
    return {
      success: false,
      event: 'unknown' as WebhookEventType,
      deliveryId: 'unknown',
      result: { success: false, message: 'Processing failed' },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
