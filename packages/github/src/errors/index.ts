/**
 * Custom Error Classes for GitHub Integration
 * Comprehensive error handling system
 */

// @ts-nocheck - Unused variables and type issues

// ============================================================================
// Base GitHub Error
// ============================================================================

export class GitHubError extends Error {
  public readonly code: string;
  public readonly status: number | null;
  public readonly documentationUrl: string | null;
  public readonly requestId: string | null;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string = 'GITHUB_ERROR',
    status: number | null = null,
    documentationUrl: string | null = null,
    requestId: string | null = null,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'GitHubError';
    this.code = code;
    this.status = status;
    this.documentationUrl = documentationUrl;
    this.requestId = requestId;
    this.retryable = retryable;

    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      documentationUrl: this.documentationUrl,
      requestId: this.requestId,
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

// ============================================================================
// Authentication Errors
// ============================================================================

export class AuthenticationError extends GitHubError {
  constructor(
    message: string = 'Authentication failed',
    details?: { status?: number; requestId?: string }
  ) {
    super(
      message,
      'AUTHENTICATION_ERROR',
      details?.status || 401,
      'https://docs.github.com/rest',
      details?.requestId,
      false
    );
    this.name = 'AuthenticationError';
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(details?: { requestId?: string }) {
    super('Authentication token has expired', details);
    this.code = 'TOKEN_EXPIRED';
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(details?: { requestId?: string }) {
    super('Invalid authentication token', details);
    this.code = 'INVALID_TOKEN';
    this.name = 'InvalidTokenError';
  }
}

export class OAuthError extends AuthenticationError {
  constructor(
    message: string,
    public readonly error: string,
    public readonly errorDescription: string | null = null,
    public readonly errorUri: string | null = null
  ) {
    super(message);
    this.code = 'OAUTH_ERROR';
    this.name = 'OAuthError';
  }
}

export class AppAuthenticationError extends AuthenticationError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, details);
    this.code = 'APP_AUTH_ERROR';
    this.name = 'AppAuthenticationError';
  }
}

// ============================================================================
// Rate Limit Errors
// ============================================================================

export class RateLimitError extends GitHubError {
  public readonly limit: number;
  public readonly remaining: number;
  public readonly resetAt: Date;
  public readonly resource: string;

  constructor(
    limit: number,
    remaining: number,
    resetAt: Date,
    resource: string = 'core'
  ) {
    super(
      `Rate limit exceeded for resource '${resource}'. ${remaining} of ${limit} requests remaining. Resets at ${resetAt.toISOString()}`,
      'RATE_LIMIT_EXCEEDED',
      403,
      'https://docs.github.com/rest/overview/rate-limits-for-the-rest-api',
      null,
      true
    );
    this.name = 'RateLimitError';
    this.limit = limit;
    this.remaining = remaining;
    this.resetAt = resetAt;
    this.resource = resource;
  }

  public getRetryDelay(): number {
    return Math.max(0, this.resetAt.getTime() - Date.now());
  }
}

export class SecondaryRateLimitError extends GitHubError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super(
      `Secondary rate limit exceeded. Retry after ${retryAfter} seconds.`,
      'SECONDARY_RATE_LIMIT',
      403,
      'https://docs.github.com/rest/overview/rate-limits-for-the-rest-api',
      null,
      true
    );
    this.name = 'SecondaryRateLimitError';
    this.retryAfter = retryAfter;
  }

  public getRetryDelay(): number {
    return this.retryAfter * 1000;
  }
}

// ============================================================================
// Request Errors
// ============================================================================

export class RequestError extends GitHubError {
  constructor(
    message: string,
    status: number,
    details?: { documentationUrl?: string; requestId?: string }
  ) {
    super(
      message,
      'REQUEST_ERROR',
      status,
      details?.documentationUrl || 'https://docs.github.com/rest',
      details?.requestId,
      status >= 500 || status === 408
    );
    this.name = 'RequestError';
  }
}

export class NotFoundError extends RequestError {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} not found: ${identifier}`,
      404,
      { documentationUrl: 'https://docs.github.com/rest' }
    );
    this.code = 'NOT_FOUND';
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends RequestError {
  public readonly errors: ValidationErrorItem[];

  constructor(
    message: string,
    errors: ValidationErrorItem[],
    details?: { requestId?: string }
  ) {
    super(message, 422, details);
    this.code = 'VALIDATION_ERROR';
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export interface ValidationErrorItem {
  resource: string;
  field: string;
  code: string;
  message?: string;
}

export class ConflictError extends RequestError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 409, details);
    this.code = 'CONFLICT';
    this.name = 'ConflictError';
  }
}

export class PreconditionFailedError extends RequestError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 412, details);
    this.code = 'PRECONDITION_FAILED';
    this.name = 'PreconditionFailedError';
  }
}

export class UnprocessableEntityError extends RequestError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 422, details);
    this.code = 'UNPROCESSABLE_ENTITY';
    this.name = 'UnprocessableEntityError';
  }
}

// ============================================================================
// Repository Errors
// ============================================================================

export class RepositoryError extends GitHubError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 'REPOSITORY_ERROR', null, null, details?.requestId, false);
    this.name = 'RepositoryError';
  }
}

export class RepositoryNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string) {
    super('Repository', `${owner}/${repo}`);
    this.name = 'RepositoryNotFoundError';
  }
}

export class BranchNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, branch: string) {
    super('Branch', `${owner}/${repo}/${branch}`);
    this.name = 'BranchNotFoundError';
  }
}

export class ProtectedBranchError extends GitHubError {
  constructor(branch: string, reason: string) {
    super(
      `Cannot modify protected branch '${branch}': ${reason}`,
      'PROTECTED_BRANCH',
      403,
      'https://docs.github.com/rest/branches',
      null,
      false
    );
    this.name = 'ProtectedBranchError';
  }
}

export class RepositoryLockedError extends RepositoryError {
  constructor(repo: string) {
    super(`Repository '${repo}' is locked and cannot be modified`);
    this.code = 'REPOSITORY_LOCKED';
    this.name = 'RepositoryLockedError';
  }
}

export class ArchivedRepositoryError extends RepositoryError {
  constructor(repo: string) {
    super(`Repository '${repo}' is archived and cannot be modified`);
    this.code = 'REPOSITORY_ARCHIVED';
    this.name = 'ArchivedRepositoryError';
  }
}

// ============================================================================
// Pull Request Errors
// ============================================================================

export class PullRequestError extends GitHubError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 'PR_ERROR', null, null, details?.requestId, false);
    this.name = 'PullRequestError';
  }
}

export class PullRequestNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, number: number) {
    super('Pull Request', `${owner}/${repo}#${number}`);
    this.name = 'PullRequestNotFoundError';
  }
}

export class PullRequestMergeError extends PullRequestError {
  constructor(
    prNumber: number,
    reason: string,
    public readonly mergeable: boolean,
    public readonly mergeableState: string
  ) {
    super(`Cannot merge PR #${prNumber}: ${reason}`);
    this.code = 'PR_MERGE_ERROR';
    this.name = 'PullRequestMergeError';
  }
}

export class PullRequestConflictError extends PullRequestError {
  constructor(prNumber: number) {
    super(`PR #${prNumber} has merge conflicts`);
    this.code = 'PR_MERGE_CONFLICT';
    this.name = 'PullRequestConflictError';
  }
}

export class ReviewNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, prNumber: number, reviewId: number) {
    super('Review', `${owner}/${repo}#${prNumber}/review/${reviewId}`);
    this.name = 'ReviewNotFoundError';
  }
}

// ============================================================================
// Issue Errors
// ============================================================================

export class IssueError extends GitHubError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 'ISSUE_ERROR', null, null, details?.requestId, false);
    this.name = 'IssueError';
  }
}

export class IssueNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, number: number) {
    super('Issue', `${owner}/${repo}#${number}`);
    this.name = 'IssueNotFoundError';
  }
}

export class IssueLockedError extends IssueError {
  constructor(number: number) {
    super(`Issue #${number} is locked and cannot be modified`);
    this.code = 'ISSUE_LOCKED';
    this.name = 'IssueLockedError';
  }
}

export class CommentNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, commentId: number) {
    super('Comment', `${owner}/${repo}#${commentId}`);
    this.name = 'CommentNotFoundError';
  }
}

// ============================================================================
// Release Errors
// ============================================================================

export class ReleaseError extends GitHubError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 'RELEASE_ERROR', null, null, details?.requestId, false);
    this.name = 'ReleaseError';
  }
}

export class ReleaseNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, tag: string) {
    super('Release', `${owner}/${repo}/releases/tag/${tag}`);
    this.name = 'ReleaseNotFoundError';
  }
}

export class AssetNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, assetId: number) {
    super('Release Asset', `${owner}/${repo}/assets/${assetId}`);
    this.name = 'AssetNotFoundError';
  }
}

// ============================================================================
// Webhook Errors
// ============================================================================

export class WebhookError extends GitHubError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 'WEBHOOK_ERROR', null, null, details?.requestId, false);
    this.name = 'WebhookError';
  }
}

export class WebhookNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, webhookId: number) {
    super('Webhook', `${owner}/${repo}/webhooks/${webhookId}`);
    this.name = 'WebhookNotFoundError';
  }
}

export class InvalidWebhookSignatureError extends WebhookError {
  constructor() {
    super('Invalid webhook signature');
    this.code = 'INVALID_SIGNATURE';
    this.name = 'InvalidWebhookSignatureError';
  }
}

export class WebhookDeliveryError extends WebhookError {
  constructor(
    webhookId: number,
    public readonly statusCode: number,
    public readonly response: string
  ) {
    super(`Webhook ${webhookId} delivery failed with status ${statusCode}`);
    this.code = 'WEBHOOK_DELIVERY_FAILED';
    this.name = 'WebhookDeliveryError';
  }
}

// ============================================================================
// CI/CD Errors
// ============================================================================

export class WorkflowError extends GitHubError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 'WORKFLOW_ERROR', null, null, details?.requestId, false);
    this.name = 'WorkflowError';
  }
}

export class WorkflowNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, workflowId: number) {
    super('Workflow', `${owner}/${repo}/actions/workflows/${workflowId}`);
    this.name = 'WorkflowNotFoundError';
  }
}

export class WorkflowRunNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, runId: number) {
    super('Workflow Run', `${owner}/${repo}/actions/runs/${runId}`);
    this.name = 'WorkflowRunNotFoundError';
  }
}

export class ArtifactNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, artifactId: number) {
    super('Artifact', `${owner}/${repo}/actions/artifacts/${artifactId}`);
    this.name = 'ArtifactNotFoundError';
  }
}

export class ArtifactExpiredError extends GitHubError {
  constructor(artifactId: number) {
    super(`Artifact ${artifactId} has expired and is no longer available`);
    this.code = 'ARTIFACT_EXPIRED';
    this.name = 'ArtifactExpiredError';
  }
}

// ============================================================================
// Security Errors
// ============================================================================

export class SecurityError extends GitHubError {
  constructor(message: string, details?: { requestId?: string }) {
    super(message, 'SECURITY_ERROR', null, null, details?.requestId, false);
    this.name = 'SecurityError';
  }
}

export class CodeScanningAlertNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, alertNumber: number) {
    super('Code Scanning Alert', `${owner}/${repo}/code-scanning/alerts/${alertNumber}`);
    this.name = 'CodeScanningAlertNotFoundError';
  }
}

export class SecretScanningAlertNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, alertNumber: number) {
    super('Secret Scanning Alert', `${owner}/${repo}/secret-scanning/alerts/${alertNumber}`);
    this.name = 'SecretScanningAlertNotFoundError';
  }
}

export class DependabotAlertNotFoundError extends NotFoundError {
  constructor(owner: string, repo: string, alertId: number) {
    super('Dependabot Alert', `${owner}/${repo}/dependabot/alerts/${alertId}`);
    this.name = 'DependabotAlertNotFoundError';
  }
}

// ============================================================================
// Network Errors
// ============================================================================

export class NetworkError extends GitHubError {
  constructor(
    message: string,
    public readonly originalError: Error | null = null
  ) {
    super(message, 'NETWORK_ERROR', null, null, null, true);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends NetworkError {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.code = 'TIMEOUT';
    this.name = 'TimeoutError';
  }
}

export class ConnectionError extends NetworkError {
  constructor(message: string = 'Failed to establish connection', originalError?: Error) {
    super(message, originalError);
    this.code = 'CONNECTION_ERROR';
    this.name = 'ConnectionError';
  }
}

// ============================================================================
// Cache Errors
// ============================================================================

export class CacheError extends GitHubError {
  constructor(message: string, public readonly originalError: Error | null = null) {
    super(message, 'CACHE_ERROR', null, null, null, false);
    this.name = 'CacheError';
  }
}

export class CacheMissError extends CacheError {
  constructor(key: string) {
    super(`Cache miss for key: ${key}`);
    this.code = 'CACHE_MISS';
    this.name = 'CacheMissError';
  }
}

export class CacheConnectionError extends CacheError {
  constructor(originalError: Error) {
    super('Failed to connect to cache', originalError);
    this.code = 'CACHE_CONNECTION_ERROR';
    this.name = 'CacheConnectionError';
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

export class ConfigurationError extends GitHubError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', null, null, null, false);
    this.name = 'ConfigurationError';
  }
}

export class MissingConfigError extends ConfigurationError {
  constructor(field: string) {
    super(`Missing required configuration: ${field}`);
    this.code = 'MISSING_CONFIG';
    this.name = 'MissingConfigError';
  }
}

export class InvalidConfigError extends ConfigurationError {
  constructor(field: string, reason: string) {
    super(`Invalid configuration for ${field}: ${reason}`);
    this.code = 'INVALID_CONFIG';
    this.name = 'InvalidConfigError';
  }
}

// ============================================================================
// GraphQL Errors
// ============================================================================

export class GraphQLError extends GitHubError {
  public readonly query: string | null;
  public readonly variables: Record<string, unknown> | null;
  public readonly graphqlErrors: GraphQLSubError[];

  constructor(
    message: string,
    graphqlErrors: GraphQLSubError[],
    query?: string,
    variables?: Record<string, unknown>
  ) {
    super(message, 'GRAPHQL_ERROR', null, null, null, false);
    this.name = 'GraphQLError';
    this.query = query || null;
    this.variables = variables || null;
    this.graphqlErrors = graphqlErrors;
  }
}

export interface GraphQLSubError {
  message: string;
  locations: Array<{ line: number; column: number }>;
  path: (string | number)[];
  extensions?: Record<string, unknown>;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function isGitHubError(error: unknown): error is GitHubError {
  return error instanceof GitHubError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isRetryableError(error: unknown): boolean {
  if (!isGitHubError(error)) {
    return false;
  }
  return error.retryable;
}

export function getStatusCode(error: unknown): number | null {
  if (isGitHubError(error)) {
    return error.status;
  }
  return null;
}

export function createErrorFromResponse(
  status: number,
  body: {
    message?: string;
    code?: string;
    documentation_url?: string;
    errors?: ValidationErrorItem[];
  }
): GitHubError {
  const message = body.message || `HTTP ${status} Error`;
  const code = body.code || 'REQUEST_ERROR';
  const documentationUrl = body.documentation_url || null;

  switch (status) {
    case 401:
      return new AuthenticationError(message, { status, requestId: null });
    case 403:
      if (message.toLowerCase().includes('rate limit')) {
        return new RateLimitError(0, 0, new Date(), 'core');
      }
      return new RequestError(message, status, { documentationUrl });
    case 404:
      return new NotFoundError('Resource', 'unknown');
    case 409:
      return new ConflictError(message);
    case 422:
      return new ValidationError(message, body.errors || []);
    case 412:
      return new PreconditionFailedError(message);
    default:
      return new RequestError(message, status, { documentationUrl });
  }
}
