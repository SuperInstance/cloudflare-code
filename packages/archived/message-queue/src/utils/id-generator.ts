/**
 * Unique ID generator for messages and queues
 * Uses multiple strategies for collision-free ID generation
 */

/**
 * Generate a unique message ID
 * Format: timestamp-randomcounter-shard
 */
export function generateMessageId(): string {
  const timestamp = Date.now();
  const random = cryptoRandom();
  const counter = sequentialCounter();
  const shard = processShardId();

  return `${timestamp}-${random}-${counter}-${shard}`;
}

/**
 * Generate a unique queue ID
 */
export function generateQueueId(name: string): string {
  const hash = simpleHash(name);
  const timestamp = Date.now();
  const random = cryptoRandom();

  return `${name}-${hash}-${timestamp}-${random}`;
}

/**
 * Generate a correlation ID for message tracing
 */
export function generateCorrelationId(): string {
  return `corr-${Date.now()}-${cryptoRandom()}`;
}

/**
 * Generate a causation ID for event sourcing
 */
export function generateCausationId(messageId: string): string {
  return `cause-${messageId}`;
}

/**
 * Generate a message group ID for FIFO ordering
 */
export function generateMessageGroupId(key: string): string {
  const hash = simpleHash(key);
  return `group-${hash}`;
}

/**
 * Generate a deduplication ID
 */
export function generateDeduplicationId(message: unknown): string {
  const str = JSON.stringify(message);
  const hash = simpleHash(str);
  return `dedup-${hash}`;
}

/**
 * Generate a consumer ID
 */
export function generateConsumerId(queueName: string): string {
  return `consumer-${queueName}-${Date.now()}-${cryptoRandom()}`;
}

/**
 * Generate a sequence number for FIFO queues
 */
export function generateSequenceNumber(): string {
  const timestamp = Date.now();
  const counter = sequentialCounter();
  const shard = processShardId();

  return `${timestamp}.${counter}.${shard}`;
}

/**
 * Generate a receipt handle for message acknowledgment
 */
export function generateReceiptHandle(messageId: string): string {
  const timestamp = Date.now();
  const random = cryptoRandom();
  const signature = simpleHash(`${messageId}-${timestamp}-${random}`);

  return `${messageId}.${timestamp}.${random}.${signature}`;
}

/**
 * Parse a receipt handle
 */
export function parseReceiptHandle(handle: string): {
  messageId: string;
  timestamp: number;
  random: string;
  signature: string;
} | null {
  const parts = handle.split('.');
  if (parts.length !== 4) return null;

  const [messageId, timestamp, random, signature] = parts;

  return {
    messageId,
    timestamp: parseInt(timestamp, 10),
    random,
    signature
  };
}

/**
 * Verify receipt handle signature
 */
export function verifyReceiptHandle(handle: string): boolean {
  const parsed = parseReceiptHandle(handle);
  if (!parsed) return false;

  const expectedSignature = simpleHash(
    `${parsed.messageId}-${parsed.timestamp}-${parsed.random}`
  );

  return parsed.signature === expectedSignature;
}

/**
 * Generate a batch ID for batch operations
 */
export function generateBatchId(): string {
  return `batch-${Date.now()}-${cryptoRandom()}`;
}

/**
 * Generate a dead letter entry ID
 */
export function generateDeadLetterId(messageId: string): string {
  return `dlq-${messageId}-${Date.now()}`;
}

/**
 * Generate an event ID
 */
export function generateEventId(): string {
  return `event-${Date.now()}-${cryptoRandom()}`;
}

/**
 * Generate a health check ID
 */
export function generateHealthCheckId(): string {
  return `health-${Date.now()}-${cryptoRandom()}`;
}

/**
 * Cryptographically secure random number
 */
function cryptoRandom(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  }

  // Fallback for environments without crypto.randomUUID
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Simple hash function for non-cryptographic purposes
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Sequential counter for ordering guarantees
 */
let counter = 0;
function sequentialCounter(): number {
  return ++counter;
}

/**
 * Get process shard ID for distributed systems
 */
function processShardId(): string {
  // In a real distributed system, this would use actual shard information
  if (typeof process !== 'undefined' && process.env) {
    return process.env.SHARD_ID || '0';
  }
  return '0';
}

/**
 * Generate multiple unique IDs in bulk
 */
export function generateBulkMessageIds(count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateMessageId());
  }
  return ids;
}

/**
 * Validate ID format
 */
export function validateId(id: string): boolean {
  // Basic validation: non-empty, reasonable length, valid characters
  if (!id || id.length === 0 || id.length > 256) return false;

  // Check for valid characters (alphanumeric, hyphens, dots)
  const validPattern = /^[a-zA-Z0-9.-]+$/;
  return validPattern.test(id);
}

/**
 * Extract timestamp from ID if present
 */
export function extractTimestampFromId(id: string): number | null {
  const parts = id.split('-');
  if (parts.length > 0) {
    const timestamp = parseInt(parts[0], 10);
    if (!isNaN(timestamp) && timestamp > 1000000000000) {
      return timestamp;
    }
  }
  return null;
}
