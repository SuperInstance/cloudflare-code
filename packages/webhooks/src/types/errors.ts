/**
 * Custom error classes for webhook system
 */

/**
 * Base webhook error
 */
export class WebhookError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Webhook not found error
 */
export class WebhookNotFoundError extends WebhookError {
  constructor(webhookId: string, details?: Record<string, unknown>) {
    super(
      `Webhook with ID ${webhookId} not found`,
      'WEBHOOK_NOT_FOUND',
      404,
      { webhookId, ...details }
    );
  }
}

/**
 * Invalid webhook configuration error
 */
export class InvalidWebhookConfigError extends WebhookError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'INVALID_WEBHOOK_CONFIG',
      400,
      details
    );
  }
}

/**
 * Webhook delivery error
 */
export class WebhookDeliveryError extends WebhookError {
  constructor(
    webhookId: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Failed to deliver webhook ${webhookId}: ${message}`,
      'WEBHOOK_DELIVERY_FAILED',
      500,
      { webhookId, ...details }
    );
  }
}

/**
 * Signature verification error
 */
export class SignatureVerificationError extends WebhookError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'SIGNATURE_VERIFICATION_FAILED',
      401,
      details
    );
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitExceededError extends WebhookError {
  constructor(webhookId: string, limit: number, resetAt: Date) {
    super(
      `Rate limit exceeded for webhook ${webhookId}. Maximum ${limit} requests allowed.`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { webhookId, limit, resetAt: resetAt.toISOString() }
    );
  }
}

/**
 * Timeout error
 */
export class WebhookTimeoutError extends WebhookError {
  constructor(webhookId: string, timeout: number) {
    super(
      `Webhook ${webhookId} delivery timed out after ${timeout}ms`,
      'WEBHOOK_TIMEOUT',
      504,
      { webhookId, timeout }
    );
  }
}

/**
 * Max retries exceeded error
 */
export class MaxRetriesExceededError extends WebhookError {
  constructor(webhookId: string, maxRetries: number) {
    super(
      `Maximum retry attempts (${maxRetries}) exceeded for webhook ${webhookId}`,
      'MAX_RETRIES_EXCEEDED',
      400,
      { webhookId, maxRetries }
    );
  }
}

/**
 * Invalid URL error
 */
export class InvalidWebhookURLError extends WebhookError {
  constructor(url: string, reason: string) {
    super(
      `Invalid webhook URL: ${url}. ${reason}`,
      'INVALID_WEBHOOK_URL',
      400,
      { url, reason }
    );
  }
}

/**
 * Security validation error
 */
export class SecurityValidationError extends WebhookError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'SECURITY_VALIDATION_FAILED',
      403,
      details
    );
  }
}

/**
 * Replay attack detected error
 */
export class ReplayAttackError extends WebhookError {
  constructor(eventId: string, timestamp: number) {
    super(
      `Replay attack detected for event ${eventId} with timestamp ${timestamp}`,
      'REPLAY_ATTACK_DETECTED',
      403,
      { eventId, timestamp }
    );
  }
}

/**
 * Serialization error
 */
export class SerializationError extends WebhookError {
  constructor(data: unknown, reason: string) {
    super(
      `Failed to serialize webhook payload: ${reason}`,
      'SERIALIZATION_FAILED',
      500,
      { data, reason }
    );
  }
}

/**
 * Deserialization error
 */
export class DeserializationError extends WebhookError {
  constructor(data: string, reason: string) {
    super(
      `Failed to deserialize webhook payload: ${reason}`,
      'DESERIALIZATION_FAILED',
      400,
      { data, reason }
    );
  }
}

/**
 * Queue error
 */
export class QueueError extends WebhookError {
  constructor(operation: string, details?: Record<string, unknown>) {
    super(
      `Queue operation failed: ${operation}`,
      'QUEUE_OPERATION_FAILED',
      500,
      { operation, ...details }
    );
  }
}

/**
 * Storage error
 */
export class StorageError extends WebhookError {
  constructor(operation: string, details?: Record<string, unknown>) {
    super(
      `Storage operation failed: ${operation}`,
      'STORAGE_OPERATION_FAILED',
      500,
      { operation, ...details }
    );
  }
}

/**
 * Filter evaluation error
 */
export class FilterEvaluationError extends WebhookError {
  constructor(filter: string, data: unknown) {
    super(
      `Failed to evaluate webhook filter: ${filter}`,
      'FILTER_EVALUATION_FAILED',
      500,
      { filter, data }
    );
  }
}

/**
 * Template transformation error
 */
export class TemplateTransformationError extends WebhookError {
  constructor(template: string, reason: string) {
    super(
      `Failed to transform webhook template: ${reason}`,
      'TEMPLATE_TRANSFORMATION_FAILED',
      500,
      { template, reason }
    );
  }
}

/**
 * IP not allowed error
 */
export class IPNotAllowedError extends WebhookError {
  constructor(ip: string) {
    super(
      `IP address ${ip} is not allowed to deliver webhooks`,
      'IP_NOT_ALLOWED',
      403,
      { ip }
    );
  }
}

/**
 * Invalid API key error
 */
export class InvalidAPIKeyError extends WebhookError {
  constructor(keyId?: string) {
    super(
      `Invalid API key${keyId ? `: ${keyId}` : ''}`,
      'INVALID_API_KEY',
      401,
      { keyId }
    );
  }
}
