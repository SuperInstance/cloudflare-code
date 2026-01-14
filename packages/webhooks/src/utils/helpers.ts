/**
 * Utility functions for webhook operations
 */

import type { WebhookEvent } from '../types/webhook.js';

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate webhook URL
 */
export function isValidWebhookURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Check if event matches webhook event types
 */
export function eventMatchesWebhook(
  event: WebhookEvent,
  webhookEventTypes: string[]
): boolean {
  return webhookEventTypes.includes(event.type) || webhookEventTypes.includes('*');
}

/**
 * Calculate delay with jitter
 */
export function calculateDelayWithJitter(
  baseDelay: number,
  jitterPercent: number = 0.1
): number {
  const jitter = baseDelay * jitterPercent * (Math.random() * 2 - 1);
  return Math.max(0, Math.floor(baseDelay + jitter));
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Parse webhook signature from headers
 */
export function parseSignatureHeader(
  headers: Headers | Record<string, string>
): { signature: string; timestamp?: number; algorithm?: string } | null {
  const signature = headers instanceof Headers
    ? headers.get('webhook-signature')
    : headers['webhook-signature'];

  if (!signature) {
    return null;
  }

  const timestamp = headers instanceof Headers
    ? headers.get('webhook-timestamp')
    : headers['webhook-timestamp'];

  const algorithm = headers instanceof Headers
    ? headers.get('webhook-algorithm')
    : headers['webhook-algorithm'];

  return {
    signature,
    timestamp: timestamp ? parseInt(timestamp, 10) : undefined,
    algorithm: algorithm || undefined,
  };
}

/**
 * Create webhook event
 */
export function createWebhookEvent(
  type: string,
  source: string,
  subject: string,
  data: unknown,
  metadata?: Record<string, unknown>
): WebhookEvent {
  return {
    id: generateEventId(),
    type: type as any,
    source,
    subject,
    timestamp: new Date(),
    data,
    metadata,
  };
}

/**
 * Clone webhook event
 */
export function cloneWebhookEvent(event: WebhookEvent): WebhookEvent {
  return {
    ...event,
    timestamp: new Date(event.timestamp),
    data: JSON.parse(JSON.stringify(event.data)),
  };
}

/**
 * Merge webhook events
 */
export function mergeWebhookEvents(...events: Partial<WebhookEvent>[]): WebhookEvent {
  return {
    id: generateEventId(),
    type: events[0].type || 'custom' as any,
    source: events[0].source || '',
    subject: events[0].subject || '',
    timestamp: new Date(),
    data: {},
    ...events.reduce((acc, event) => ({ ...acc, ...event }), {}),
  };
}

/**
 * Validate event payload
 */
export function validateEventPayload(payload: unknown): boolean {
  if (payload === null || payload === undefined) {
    return false;
  }

  try {
    JSON.stringify(payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize webhook URL
 */
export function sanitizeWebhookURL(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove credentials
    parsed.username = '';
    parsed.password = '';
    // Remove fragment
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Compare webhook versions
 */
export function compareWebhookVersions(
  version1: string,
  version2: string
): number {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }

  return 0;
}

/**
 * Calculate backoff delay
 */
export function calculateBackoffDelay(
  attemptNumber: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number = 2
): number {
  const delay = initialDelay * Math.pow(multiplier, attemptNumber - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Is retryable status code
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(statusCode);
}

/**
 * Is timeout error
 */
export function isTimeoutError(error: Error): boolean {
  return error.name === 'AbortError' ||
    error.message.toLowerCase().includes('timeout') ||
    error.message.toLowerCase().includes('timed out');
}

/**
 * Create error response
 */
export function createErrorResponse(
  error: Error | string,
  statusCode: number = 500
): { error: string; statusCode: number; stack?: string } {
  const message = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'string' ? undefined : error.stack;

  return {
    error: message,
    statusCode,
    stack,
  };
}

/**
 * Parse retry-after header
 */
export function parseRetryAfterHeader(
  headers: Headers | Record<string, string>
): number | null {
  const retryAfter = headers instanceof Headers
    ? headers.get('retry-after')
    : headers['retry-after'];

  if (!retryAfter) {
    return null;
  }

  const seconds = parseInt(retryAfter, 10);
  if (isNaN(seconds)) {
    // Try parsing as HTTP-date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
    }
    return null;
  }

  return seconds * 1000;
}

/**
 * Build webhook headers
 */
export function buildWebhookHeaders(
  signature: string,
  timestamp: number,
  eventId: string,
  algorithm: string = 'hmac_sha256',
  customHeaders?: Record<string, string>
): Record<string, string> {
  return {
    'content-type': 'application/json',
    'webhook-signature': signature,
    'webhook-timestamp': timestamp.toString(),
    'webhook-id': eventId,
    'webhook-algorithm': algorithm,
    ...(customHeaders || {}),
  };
}

/**
 * Validate webhook secret
 */
export function isValidWebhookSecret(secret: string): boolean {
  // Minimum 32 characters
  if (secret.length < 32) {
    return false;
  }

  // Check for character variety
  const hasLower = /[a-z]/.test(secret);
  const hasUpper = /[A-Z]/.test(secret);
  const hasNumber = /[0-9]/.test(secret);
  const hasSpecial = /[^a-zA-Z0-9]/.test(secret);

  const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  return varietyCount >= 2;
}

/**
 * Generate webhook signature
 */
export async function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp?: number
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const payloadToSign = timestamp !== undefined
    ? `${timestamp}.${payload}`
    : payload;

  const messageData = encoder.encode(payloadToSign);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp?: number
): Promise<boolean> {
  const expectedSignature = await generateWebhookSignature(payload, secret, timestamp);

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const sigBytes = encoder.encode(signature);
  const expectedBytes = encoder.encode(expectedSignature);

  let result = 0;
  for (let i = 0; i < sigBytes.length; i++) {
    result |= sigBytes[i] ^ expectedBytes[i];
  }

  return result === 0;
}

/**
 * Batch processing helper
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000,
  maxDelay: number = 30000,
  multiplier: number = 2
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = Math.min(
        initialDelay * Math.pow(multiplier, attempt - 1),
        maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      fn(...args);
      lastCall = now;
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        fn(...args);
        lastCall = Date.now();
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  };
}
