/**
 * Validation utilities
 */

import { CronParser } from '../cron/parser';
import type { CronExpression } from '../types';

/**
 * Validate job ID
 */
export function validateJobId(id: string): boolean {
  return /^[a-zA-Z0-9-_]+$/.test(id) && id.length > 0 && id.length <= 256;
}

/**
 * Validate job name
 */
export function validateJobName(name: string): boolean {
  return name.length > 0 && name.length <= 256;
}

/**
 * Validate cron expression
 */
export function validateCronExpression(expression: CronExpression): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  return CronParser.validate(expression);
}

/**
 * Validate timeout value
 */
export function validateTimeout(timeout: number): boolean {
  return timeout > 0 && timeout <= 86400000; // Max 24 hours
}

/**
 * Validate retry policy
 */
export function validateRetryPolicy(policy: {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (policy.maxRetries < 0 || policy.maxRetries > 100) {
    errors.push('maxRetries must be between 0 and 100');
  }

  if (policy.initialDelay < 0 || policy.initialDelay > 3600000) {
    errors.push('initialDelay must be between 0 and 3600000ms (1 hour)');
  }

  if (policy.maxDelay < policy.initialDelay || policy.maxDelay > 86400000) {
    errors.push('maxDelay must be >= initialDelay and <= 86400000ms (24 hours)');
  }

  if (policy.backoffMultiplier < 1 || policy.backoffMultiplier > 10) {
    errors.push('backoffMultiplier must be between 1 and 10');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate priority value
 */
export function validatePriority(priority: number): boolean {
  return priority >= 0 && priority <= 4;
}

/**
 * Validate concurrency config
 */
export function validateConcurrency(config: {
  maxConcurrent: number;
  queueStrategy: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxConcurrent < 1 || config.maxConcurrent > 10000) {
    errors.push('maxConcurrent must be between 1 and 10000');
  }

  const validStrategies = ['fifo', 'lifo', 'priority', 'weighted'];
  if (!validStrategies.includes(config.queueStrategy)) {
    errors.push(`queueStrategy must be one of: ${validStrategies.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate date range
 */
export function validateDateRange(start: Date, end: Date): boolean {
  return start < end && end <= new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
}

/**
 * Validate metadata object
 */
export function validateMetadata(metadata: Record<string, any>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (Object.keys(metadata).length > 100) {
    errors.push('metadata cannot have more than 100 keys');
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (key.length > 256) {
      errors.push(`metadata key "${key}" exceeds maximum length of 256`);
    }

    if (typeof value === 'string' && value.length > 4096) {
      errors.push(`metadata value for key "${key}" exceeds maximum length of 4096`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate tags array
 */
export function validateTags(tags: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (tags.length > 50) {
    errors.push('Cannot have more than 50 tags');
  }

  for (const tag of tags) {
    if (tag.length > 100) {
      errors.push(`Tag "${tag}" exceeds maximum length of 100`);
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(tag)) {
      errors.push(`Tag "${tag}" contains invalid characters`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate timezone string
 */
export function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate node ID
 */
export function validateNodeId(nodeId: string): boolean {
  return /^[a-zA-Z0-9-:]+$/.test(nodeId) && nodeId.length > 0 && nodeId.length <= 256;
}

/**
 * Sanitize log message
 */
export function sanitizeLogMessage(message: string): string {
  // Remove potential sensitive data patterns
  return message
    .replace(/password["\s]*[:=]["\s]*[^\s"]+/gi, 'password=***')
    .replace(/token["\s]*[:=]["\s]*[^\s"]+/gi, 'token=***')
    .replace(/key["\s]*[:=]["\s]*[^\s"]+/gi, 'key=***')
    .replace(/secret["\s]*[:=]["\s]*[^\s"]+/gi, 'secret=***');
}

/**
 * Validate object against schema
 */
export function validateObject<T extends Record<string, any>>(
  obj: any,
  schema: {
    [K in keyof T]?: (value: any) => boolean;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [key, validator] of Object.entries(schema)) {
    if (!(key in obj)) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    if (validator && !validator(obj[key])) {
      errors.push(`Invalid value for field: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
