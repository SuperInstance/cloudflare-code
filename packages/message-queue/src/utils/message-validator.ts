// @ts-nocheck
/**
 * Message validation utilities
 * Ensures message integrity and compliance with queue requirements
 */

import type { Message, MessageMetadata, DeliveryGuarantee } from '../types';
import { MessagePriority, MessageState, DeliveryGuarantee as DeliveryGuaranteeEnum } from '../types';
import { validateId } from './id-generator';

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Maximum message size in bytes (256KB default)
 */
const MAX_MESSAGE_SIZE = 256 * 1024;

/**
 * Maximum message TTL in seconds (14 days default)
 */
const MAX_MESSAGE_TTL = 14 * 24 * 60 * 60;

/**
 * Maximum header size in bytes
 */
const MAX_HEADER_SIZE = 8 * 1024;

/**
 * Validate a complete message
 */
export function validateMessage(message: Message): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate message ID
  if (!validateId(message.id)) {
    errors.push({
      field: 'id',
      message: 'Invalid message ID format',
      value: message.id
    });
  }

  // Validate message body
  const bodyValidation = validateMessageBody(message.body);
  errors.push(...bodyValidation.errors);

  // Validate metadata
  const metadataValidation = validateMessageMetadata(message.metadata);
  errors.push(...metadataValidation.errors);

  // Validate timestamps
  const timestampsValidation = validateMessageTimestamps(message.timestamps);
  errors.push(...timestampsValidation.errors);

  // Validate delivery guarantee
  if (!Object.values(DeliveryGuaranteeEnum).includes(message.deliveryGuarantee)) {
    errors.push({
      field: 'deliveryGuarantee',
      message: 'Invalid delivery guarantee',
      value: message.deliveryGuarantee
    });
  }

  // Validate message state
  if (!Object.values(MessageState).includes(message.state)) {
    errors.push({
      field: 'state',
      message: 'Invalid message state',
      value: message.state
    });
  }

  // Validate retry count
  if (message.retryCount < 0) {
    errors.push({
      field: 'retryCount',
      message: 'Retry count must be non-negative',
      value: message.retryCount
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate message body
 */
export function validateMessageBody(body: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if body is null or undefined
  if (body === null || body === undefined) {
    errors.push({
      field: 'body',
      message: 'Message body cannot be null or undefined'
    });
    return { valid: false, errors };
  }

  // Check serialized size
  try {
    const serialized = JSON.stringify(body);
    const size = new Blob([serialized]).size;

    if (size > MAX_MESSAGE_SIZE) {
      errors.push({
        field: 'body',
        message: `Message body exceeds maximum size of ${MAX_MESSAGE_SIZE} bytes`,
        value: { actualSize: size, maxSize: MAX_MESSAGE_SIZE }
      });
    }
  } catch (error) {
    errors.push({
      field: 'body',
      message: 'Failed to serialize message body',
      value: error
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate message metadata
 */
export function validateMessageMetadata(metadata: MessageMetadata): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate priority
  if (!Object.values(MessagePriority).includes(metadata.priority)) {
    errors.push({
      field: 'metadata.priority',
      message: 'Invalid message priority',
      value: metadata.priority
    });
  }

  // Validate TTL
  if (metadata.ttl !== undefined) {
    if (metadata.ttl <= 0) {
      errors.push({
        field: 'metadata.ttl',
        message: 'TTL must be positive',
        value: metadata.ttl
      });
    } else if (metadata.ttl > MAX_MESSAGE_TTL) {
      errors.push({
        field: 'metadata.ttl',
        message: `TTL exceeds maximum of ${MAX_MESSAGE_TTL} seconds`,
        value: metadata.ttl
      });
    }
  }

  // Validate delay
  if (metadata.delay !== undefined) {
    if (metadata.delay < 0) {
      errors.push({
        field: 'metadata.delay',
        message: 'Delay must be non-negative',
        value: metadata.delay
      });
    } else if (metadata.delay > 900) {
      errors.push({
        field: 'metadata.delay',
        message: 'Delay cannot exceed 900 seconds (15 minutes)',
        value: metadata.delay
      });
    }
  }

  // Validate headers
  if (metadata.headers) {
    const headerValidation = validateHeaders(metadata.headers);
    errors.push(...headerValidation.errors);
  }

  // Validate message group ID format
  if (metadata.messageGroupId !== undefined) {
    if (typeof metadata.messageGroupId !== 'string' || metadata.messageGroupId.length > 128) {
      errors.push({
        field: 'metadata.messageGroupId',
        message: 'Message group ID must be a string with max length 128',
        value: metadata.messageGroupId
      });
    }
  }

  // Validate deduplication ID format
  if (metadata.messageDeduplicationId !== undefined) {
    if (typeof metadata.messageDeduplicationId !== 'string' || metadata.messageDeduplicationId.length > 128) {
      errors.push({
        field: 'metadata.messageDeduplicationId',
        message: 'Deduplication ID must be a string with max length 128',
        value: metadata.messageDeduplicationId
      });
    }
  }

  // Validate correlation ID
  if (metadata.correlationId !== undefined) {
    if (typeof metadata.correlationId !== 'string' || metadata.correlationId.length > 256) {
      errors.push({
        field: 'metadata.correlationId',
        message: 'Correlation ID must be a string with max length 256',
        value: metadata.correlationId
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate message headers
 */
export function validateHeaders(headers: Record<string, string>): ValidationResult {
  const errors: ValidationError[] = [];

  // Check total header size
  try {
    const serialized = JSON.stringify(headers);
    const size = new Blob([serialized]).size;

    if (size > MAX_HEADER_SIZE) {
      errors.push({
        field: 'metadata.headers',
        message: `Headers exceed maximum size of ${MAX_HEADER_SIZE} bytes`,
        value: { actualSize: size, maxSize: MAX_HEADER_SIZE }
      });
    }
  } catch (error) {
    errors.push({
      field: 'metadata.headers',
      message: 'Failed to serialize headers',
      value: error
    });
  }

  // Validate individual header keys and values
  for (const [key, value] of Object.entries(headers)) {
    // Header key validation (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      errors.push({
        field: `metadata.headers.${key}`,
        message: 'Header key must contain only alphanumeric characters, hyphens, and underscores',
        value: key
      });
    }

    // Header value validation
    if (typeof value !== 'string') {
      errors.push({
        field: `metadata.headers.${key}`,
        message: 'Header value must be a string',
        value: value
      });
    } else if (value.length > 256) {
      errors.push({
        field: `metadata.headers.${key}`,
        message: 'Header value exceeds maximum length of 256 characters',
        value: { key, length: value.length }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate message timestamps
 */
export function validateMessageTimestamps(timestamps: {
  createdAt: number;
  [key: string]: number | undefined;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate created at
  if (typeof timestamps.createdAt !== 'number' || timestamps.createdAt <= 0) {
    errors.push({
      field: 'timestamps.createdAt',
      message: 'Created at must be a positive number',
      value: timestamps.createdAt
    });
  }

  // Validate optional timestamps are positive if present
  const optionalTimestamps = [
    'enqueuedAt',
    'firstReceivedAt',
    'lastReceivedAt',
    'acknowledgedAt',
    'failedAt',
    'nextDeliveryAt'
  ];

  for (const field of optionalTimestamps) {
    const value = timestamps[field];
    if (value !== undefined && (typeof value !== 'number' || value <= 0)) {
      errors.push({
        field: `timestamps.${field}`,
        message: `${field} must be a positive number if present`,
        value
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate queue name
 */
export function validateQueueName(name: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Check length
  if (name.length < 1 || name.length > 80) {
    errors.push({
      field: 'name',
      message: 'Queue name must be between 1 and 80 characters',
      value: { length: name.length }
    });
  }

  // Check format (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    errors.push({
      field: 'name',
      message: 'Queue name must contain only alphanumeric characters, hyphens, and underscores',
      value: name
    });
  }

  // Check it doesn't start with a number or special character
  if (/^[0-9_-]/.test(name)) {
    errors.push({
      field: 'name',
      message: 'Queue name must start with a letter',
      value: name
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate batch size
 */
export function validateBatchSize(size: number, maxBatchSize: number = 10): ValidationResult {
  const errors: ValidationError[] = [];

  if (size <= 0) {
    errors.push({
      field: 'batchSize',
      message: 'Batch size must be positive',
      value: size
    });
  }

  if (size > maxBatchSize) {
    errors.push({
      field: 'batchSize',
      message: `Batch size cannot exceed ${maxBatchSize}`,
      value: size
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate timeout value
 */
export function validateTimeout(timeout: number, maxTimeout: number = 20000): ValidationResult {
  const errors: ValidationError[] = [];

  if (timeout <= 0) {
    errors.push({
      field: 'timeout',
      message: 'Timeout must be positive',
      value: timeout
    });
  }

  if (timeout > maxTimeout) {
    errors.push({
      field: 'timeout',
      message: `Timeout cannot exceed ${maxTimeout}ms`,
      value: timeout
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate visibility timeout
 */
export function validateVisibilityTimeout(timeout: number): ValidationResult {
  const errors: ValidationError[] = [];

  if (timeout < 0) {
    errors.push({
      field: 'visibilityTimeout',
      message: 'Visibility timeout must be non-negative',
      value: timeout
    });
  }

  if (timeout > 43200) {
    errors.push({
      field: 'visibilityTimeout',
      message: 'Visibility timeout cannot exceed 43200 seconds (12 hours)',
      value: timeout
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate message priority ordering
 */
export function validatePriorityOrder(messages: Message[]): ValidationResult {
  const errors: ValidationError[] = [];

  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].metadata.priority < messages[i + 1].metadata.priority) {
      errors.push({
        field: 'messages',
        message: `Messages not ordered by priority at index ${i}`,
        value: {
          current: messages[i].metadata.priority,
          next: messages[i + 1].metadata.priority
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate delivery guarantee compatibility
 */
export function validateDeliveryGuaranteeCompatibility(
  guarantee1: DeliveryGuarantee,
  guarantee2: DeliveryGuarantee
): ValidationResult {
  const errors: ValidationError[] = [];

  // Exactly-once requires compatible settings
  if (guarantee1 === DeliveryGuaranteeEnum.EXACTLY_ONCE && guarantee2 !== DeliveryGuaranteeEnum.EXACTLY_ONCE) {
    errors.push({
      field: 'deliveryGuarantee',
      message: 'Exactly-once delivery requires all components to use exactly-once',
      value: { guarantee1, guarantee2 }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
