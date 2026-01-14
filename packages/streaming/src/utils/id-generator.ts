/**
 * Utility functions for generating unique identifiers
 */

import { customAlphabet } from './nanoid.js';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const NANOID_SIZE = 21;

/**
 * Generate a unique ID for events
 */
export function generateEventId(): string {
  return `evt_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a unique ID for messages
 */
export function generateMessageId(): string {
  return `msg_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a unique ID for streams
 */
export function generateStreamId(): string {
  return `str_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a unique ID for commits
 */
export function generateCommitId(): string {
  return `cmt_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a unique ID for snapshots
 */
export function generateSnapshotId(): string {
  return `snp_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a unique ID for subscriptions
 */
export function generateSubscriptionId(): string {
  return `sub_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a unique ID for topics
 */
export function generateTopicId(): string {
  return `top_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a correlation ID for tracing
 */
export function generateCorrelationId(): string {
  return `cor_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a causation ID for event causality tracking
 */
export function generateCausationId(): string {
  return `cau_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a unique ID for processing jobs
 */
export function generateJobId(): string {
  return `job_${customAlphabet(ALPHABET, NANOID_SIZE)()}`;
}

/**
 * Generate a partition key for distributed processing
 */
export function generatePartitionKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generate a time-based ID (similar to MongoDB ObjectId)
 */
export function generateTimeBasedId(): string {
  const timestamp = Date.now().toString(16);
  const randomBytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
  return timestamp + randomBytes;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a snowflake-like ID
 */
export function generateSnowflakeId(workerId: number = 0, datacenterId: number = 0): string {
  const timestamp = Date.now();
  const workerBits = 5;
  const datacenterBits = 5;
  const sequenceBits = 12;

  const maxWorkerId = (1 << workerBits) - 1;
  const maxDatacenterId = (1 << datacenterBits) - 1;

  const worker = Math.min(Math.max(workerId, 0), maxWorkerId);
  const datacenter = Math.min(Math.max(datacenterId, 0), maxDatacenterId);

  let sequence = 0;
  const lastTimestamp = timestamp - 1;

  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1) & ((1 << sequenceBits) - 1);
    if (sequence === 0) {
      // Sequence overflow, wait for next millisecond
      throw new Error('Sequence overflow');
    }
  } else {
    sequence = 0;
  }

  const snowflake =
    (BigInt(timestamp) << BigInt(workerBits + datacenterBits + sequenceBits)) |
    (BigInt(datacenter) << BigInt(workerBits + sequenceBits)) |
    (BigInt(worker) << BigInt(sequenceBits)) |
    BigInt(sequence);

  return snowflake.toString();
}
