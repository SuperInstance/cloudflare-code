/**
 * Utilities for generating IDs
 */

/**
 * Generate a unique event ID
 * Format: evt_<timestamp>_<random>
 */
export function generateEventId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `evt_${timestamp}_${random}`;
}

/**
 * Generate a unique correlation ID
 * Format: corr_<timestamp>_<random>
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `corr_${timestamp}_${random}`;
}

/**
 * Generate a unique causation ID
 * Format: caus_<timestamp>_<random>
 */
export function generateCausationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `caus_${timestamp}_${random}`;
}

/**
 * Generate a unique stream ID
 * Format: stream_<type>_<id>
 */
export function generateStreamId(type: string, id: string): string {
  return `stream_${type}_${id}`;
}

/**
 * Generate a unique saga ID
 * Format: saga_<type>_<timestamp>_<random>
 */
export function generateSagaId(type: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `saga_${type}_${timestamp}_${random}`;
}

/**
 * Generate a unique message ID
 * Format: msg_<timestamp>_<random>
 */
export function generateMessageId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `msg_${timestamp}_${random}`;
}

/**
 * Generate a unique subscription ID
 * Format: sub_<topic>_<random>
 */
export function generateSubscriptionId(topic: string): string {
  const random = Math.random().toString(36).substring(2, 15);
  return `sub_${topic}_${random}`;
}

/**
 * Generate a unique consumer group ID
 * Format: cg_<name>_<random>
 */
export function generateConsumerGroupId(name: string): string {
  const random = Math.random().toString(36).substring(2, 15);
  return `cg_${name}_${random}`;
}

/**
 * Generate a unique replay ID
 * Format: replay_<timestamp>_<random>
 */
export function generateReplayId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `replay_${timestamp}_${random}`;
}

/**
 * Generate a partition key for message ordering
 */
export function generatePartitionKey(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (typeof data === 'number') {
    return data.toString();
  }
  if (data && typeof data === 'object' && 'id' in data) {
    return String((data as { id: unknown }).id);
  }
  // Use a hash of the object for consistent partitioning
  return hashObject(data);
}

/**
 * Simple hash function for objects
 */
function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Parse an ID to extract its components
 */
export function parseId(id: string): { type: string; timestamp?: number; unique: string } | null {
  const parts = id.split('_');
  if (parts.length < 2) {
    return null;
  }

  const type = parts[0];
  const timestamp = parts.length > 2 ? parseInt(parts[parts.length - 2], 10) : undefined;
  const unique = parts[parts.length - 1];

  return { type, timestamp, unique };
}

/**
 * Validate if an ID is in the correct format
 */
export function isValidId(id: string, expectedType?: string): boolean {
  const parsed = parseId(id);
  if (!parsed) {
    return false;
  }
  if (expectedType && !parsed.type.startsWith(expectedType)) {
    return false;
  }
  return true;
}

/**
 * Generate a batch ID for grouping messages
 */
export function generateBatchId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `batch_${timestamp}_${random}`;
}

/**
 * Generate a commit ID for event store transactions
 */
export function generateCommitId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `commit_${timestamp}_${random}`;
}

/**
 * Generate a snapshot ID
 */
export function generateSnapshotId(streamId: string, version: number): string {
  return `snapshot_${streamId}_v${version}`;
}

/**
 * Generate a trace ID for distributed tracing
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(16);
  const random = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return `${timestamp}${random}`;
}

/**
 * Generate a span ID for distributed tracing
 */
export function generateSpanId(): string {
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}
