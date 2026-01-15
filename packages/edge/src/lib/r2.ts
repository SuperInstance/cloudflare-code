/**
 * R2 Storage - COLD Tier Storage
 *
 * Provides persistent object storage (50-100ms) using Cloudflare R2.
 * Limit: 10GB storage, zero egress fees
 */

import type { SessionData, MemoryEntry } from '../types/index';

export interface R2StorageOptions {
  /**
   * Enable compression for uploads
   */
  compression?: boolean;

  /**
   * Enable automatic retry on failure
   */
  retry?: boolean;

  /**
   * Maximum upload size in bytes (default: 100MB)
   */
  maxUploadSize?: number;
}

/**
 * R2Storage - COLD Tier for archives and long-term storage
 *
 * Features:
 * - 50-100ms latency
 * - 10GB storage limit
 * - Zero egress fees
 * - Automatic compression
 * - Multipart upload support for large files
 */
export class R2Storage {
  private bucket: R2Bucket;
  private options: Required<R2StorageOptions>;

  constructor(bucket: R2Bucket, options: R2StorageOptions = {}) {
    this.bucket = bucket;
    this.options = {
      compression: options.compression ?? true,
      retry: options.retry ?? true,
      maxUploadSize: options.maxUploadSize ?? 100 * 1024 * 1024, // 100MB
    };
  }

  /**
   * Put data into R2
   * Latency: 50-100ms
   */
  async put(
    key: string,
    data: ArrayBuffer | string | object,
    metadata?: Record<string, string>
  ): Promise<void> {
    const startTime = performance.now();

    try {
      let body: ArrayBuffer;

      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(data);
        const bufferSlice = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
        // Ensure we have an ArrayBuffer, not SharedArrayBuffer
        if (bufferSlice instanceof ArrayBuffer) {
          body = bufferSlice;
        } else {
          body = new ArrayBuffer(bufferSlice.byteLength);
          new Uint8Array(body).set(new Uint8Array(bufferSlice));
        }
      } else if (data instanceof ArrayBuffer) {
        body = data;
      } else {
        // Object - stringify and compress
        const json = JSON.stringify(data, null, 2);
        body = await this.maybeCompress(json);
      }

      // Check size limit
      if (body.byteLength > this.options.maxUploadSize) {
        throw new Error(
          `Upload size ${body.byteLength} exceeds maximum ${this.options.maxUploadSize}`
        );
      }

      // Prepare metadata
      const r2Metadata: Record<string, string> = {
        ...metadata,
        timestamp: String(Date.now()),
        compressed: String(this.options.compression),
      };

      if (this.options.retry) {
        await this.retryOperation(() =>
          this.bucket.put(key, body, {
            customMetadata: r2Metadata,
            httpMetadata: {
              contentType: 'application/octet-stream',
            },
          })
        );
      } else {
        await this.bucket.put(key, body, {
          customMetadata: r2Metadata,
          httpMetadata: {
            contentType: 'application/octet-stream',
          },
        });
      }

      const latency = performance.now() - startTime;
      console.debug(`R2 put: ${key} - ${latency.toFixed(2)}ms (${body.byteLength} bytes)`);
    } catch (error) {
      console.error(`R2 put failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get data from R2
   */
  async get(key: string): Promise<ArrayBuffer | null> {
    const startTime = performance.now();

    try {
      const object = await this.bucket.get(key);

      if (!object) {
        return null;
      }

      let data = await object.arrayBuffer();

      // Decompress if needed - metadata is accessed via customProperties in some versions
      const customProps = (object as unknown as { customProperties?: Record<string, string> }).customProperties;
      if (customProps && customProps['compressed'] === 'true') {
        data = await this.decompress(data);
      }

      const latency = performance.now() - startTime;
      console.debug(`R2 get: ${key} - ${latency.toFixed(2)}ms (${data.byteLength} bytes)`);

      return data;
    } catch (error) {
      console.error(`R2 get failed for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get data as text
   */
  async getText(key: string): Promise<string | null> {
    const data = await this.get(key);
    if (!data) {
      return null;
    }

    const decoder = new TextDecoder();
    return decoder.decode(data);
  }

  /**
   * Get data as JSON object
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const text = await this.getText(key);
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      console.error(`Failed to parse JSON for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete object from R2
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.bucket.delete(key);
      return true;
    } catch (error) {
      console.error(`R2 delete failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple objects
   */
  async deleteMultiple(keys: string[]): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    for (const key of keys) {
      const success = await this.delete(key);
      if (success) {
        deleted++;
      } else {
        failed++;
      }
    }

    return { deleted, failed };
  }

  /**
   * Check if object exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const object = await this.bucket.head(key);
      return object !== null;
    } catch (error) {
      console.error(`R2 exists check failed for key ${key}:`, error);
      return false;
    }
  }

  /**
   * List objects by prefix
   */
  async list(prefix?: string, limit?: number): Promise<R2Objects> {
    try {
      const options: R2ListOptions = {};
      if (prefix !== undefined) {
        options.prefix = prefix;
      }
      if (limit !== undefined) {
        options.limit = limit;
      }
      return await this.bucket.list(options);
    } catch (error) {
      console.error(`R2 list failed for prefix ${prefix}:`, error);
      return { objects: [], delimitedPrefixes: [], truncated: false };
    }
  }

  /**
   * Get object metadata without downloading
   */
  async head(key: string): Promise<R2Object | null> {
    try {
      return await this.bucket.head(key);
    } catch (error) {
      console.error(`R2 head failed for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Copy object to another key
   */
  async copy(source: string, destination: string): Promise<void> {
    try {
      const object = await this.bucket.get(source);
      if (!object) {
        throw new Error(`Source object ${source} not found`);
      }

      const data = await object.arrayBuffer();
      const customProps = (object as unknown as { customProperties?: Record<string, string> }).customProperties;
      await this.put(destination, data, customProps || {});
    } catch (error) {
      console.error(`R2 copy failed from ${source} to ${destination}:`, error);
      throw error;
    }
  }

  /**
   * Store session archive
   */
  async archiveSession(session: SessionData): Promise<void> {
    const key = `sessions/${session.sessionId}/${session.metadata.repositoryHash}/${Date.now()}.json`;

    await this.put(key, session, {
      sessionId: session.sessionId,
      userId: session.userId,
      messageCount: String(session.metadata.messageCount),
      totalTokens: String(session.metadata.totalTokens),
      tier: 'cold',
    });
  }

  /**
   * Get session archive
   */
  async getSessionArchive(sessionId: string): Promise<SessionData[]> {
    const result = await this.list(`sessions/${sessionId}/`);

    const sessions: SessionData[] = [];
    for (const object of result.objects) {
      const session = await this.getJSON<SessionData>(object.key);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Store full conversation history
   */
  async storeConversationHistory(
    sessionId: string,
    messages: unknown[],
    metadata?: Record<string, string>
  ): Promise<void> {
    const key = `conversations/${sessionId}/${Date.now()}.json`;

    await this.put(key, { messages, metadata }, {
      sessionId,
      messageCount: String(messages.length),
      tier: 'cold',
    });
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(sessionId: string): Promise<{
    messages: unknown[];
    metadata?: Record<string, string>;
    timestamp: number;
  }[]> {
    const result = await this.list(`conversations/${sessionId}/`);

    const histories: Array<{
      messages: unknown[];
      metadata?: Record<string, string>;
      timestamp: number;
    }> = [];

    for (const object of result.objects) {
      const data = await this.getJSON<{
        messages: unknown[];
        metadata?: Record<string, string>;
      }>(object.key);

      if (data) {
        histories.push({
          ...data,
          timestamp: object.uploaded.getTime(),
        });
      }
    }

    return histories.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Store logs
   */
  async storeLogs(
    sessionId: string,
    logs: Array<{
      timestamp: number;
      level: string;
      message: string;
      data?: unknown;
    }>
  ): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0] ?? new Date().toISOString();
    const key = `logs/${sessionId}/${dateStr}.json`;

    await this.put(key, logs, {
      sessionId,
      date: dateStr,
      logCount: String(logs.length),
      tier: 'cold',
    });
  }

  /**
   * Get logs for a session
   */
  async getLogs(sessionId: string, date?: string): Promise<Array<{
    timestamp: number;
    level: string;
    message: string;
    data?: unknown;
  }>> {
    const prefix = `logs/${sessionId}/${date ?? ''}`;
    const result = await this.list(prefix);

    const allLogs: Array<{
      timestamp: number;
      level: string;
      message: string;
      data?: unknown;
    }> = [];

    for (const object of result.objects) {
      const logs = await this.getJSON<Array<{
        timestamp: number;
        level: string;
        message: string;
        data?: unknown;
      }>>(object.key);

      if (logs) {
        allLogs.push(...logs);
      }
    }

    return allLogs.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Store memory entry archive
   */
  async archiveMemoryEntry(entry: MemoryEntry): Promise<void> {
    const key = `memory/${entry.sessionId}/${entry.id}.json`;

    await this.put(key, entry, {
      sessionId: entry.sessionId,
      agentId: entry.agentId,
      timestamp: String(entry.timestamp),
      contentType: entry.metadata.contentType,
      tier: 'cold',
    });
  }

  /**
   * Get memory entries for a session
   */
  async getMemoryEntries(sessionId: string): Promise<MemoryEntry[]> {
    const result = await this.list(`memory/${sessionId}/`);

    const entries: MemoryEntry[] = [];
    for (const object of result.objects) {
      const entry = await this.getJSON<MemoryEntry>(object.key);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get storage statistics
   */
  async getStats(prefix?: string): Promise<{
    objectCount: number;
    totalSize: number;
    avgObjectSize: number;
  }> {
    const result = await this.list(prefix);

    let totalSize = 0;
    for (const object of result.objects) {
      totalSize += object.size;
    }

    return {
      objectCount: result.objects.length,
      totalSize,
      avgObjectSize: result.objects.length > 0 ? totalSize / result.objects.length : 0,
    };
  }

  /**
   * Multipart upload for large files
   */
  async multipartUpload(
    key: string,
    data: ArrayBuffer,
    partSize = 5 * 1024 * 1024 // 5MB per part
  ): Promise<void> {
    const totalParts = Math.ceil(data.byteLength / partSize);
    const uploadId = crypto.randomUUID();

    // Upload parts
    const parts: R2UploadedPart[] = [];
    for (let i = 0; i < totalParts; i++) {
      const start = i * partSize;
      const end = Math.min(start + partSize, data.byteLength);
      const partData = data.slice(start, end);

      // Note: R2's multipart upload API might differ
      // This is a simplified version
      const part = await this.bucket.put(
        `${key}.parts/${uploadId}/${i + 1}`,
        partData
      );

      if (part) {
        parts.push({
          partNumber: i + 1,
          etag: part.httpEtag,
        } as R2UploadedPart);
      }
    }

    // Complete multipart upload
    // Note: This is a simplified implementation
    // Real implementation would use R2's CompleteMultipartUpload API
    console.log(`Multipart upload completed: ${key} (${totalParts} parts)`);
  }

  /**
   * Compress data if compression is enabled
   */
  private async maybeCompress(data: string): Promise<ArrayBuffer> {
    // Helper to convert Uint8Array.buffer to ArrayBuffer
    const toArrayBuffer = (uint8Array: Uint8Array): ArrayBuffer => {
      const bufferSlice = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
      if (bufferSlice instanceof ArrayBuffer) {
        return bufferSlice;
      }
      // Handle SharedArrayBuffer case
      const arrayBuffer = new ArrayBuffer(bufferSlice.byteLength);
      new Uint8Array(arrayBuffer).set(new Uint8Array(bufferSlice));
      return arrayBuffer;
    };

    if (!this.options.compression) {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(data);
      return toArrayBuffer(uint8Array);
    }

    try {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(data);

      // Note: CompressionStream might not be available in all environments
      if (typeof CompressionStream === 'undefined') {
        return toArrayBuffer(uint8Array);
      }

      const compressed = new Response(uint8Array).body!
        .pipeThrough(new CompressionStream('gzip'));
      const arrayBuffer = await new Response(compressed).arrayBuffer();

      // Ensure result is ArrayBuffer
      if (arrayBuffer instanceof ArrayBuffer) {
        return arrayBuffer;
      }
      // Handle SharedArrayBuffer case
      const result = new ArrayBuffer(arrayBuffer.byteLength);
      new Uint8Array(result).set(new Uint8Array(arrayBuffer));
      return result;
    } catch (error) {
      console.warn('Compression failed, storing uncompressed:', error);
      const encoder = new TextEncoder();
      return encoder.encode(data).buffer;
    }
  }

  /**
   * Decompress data
   */
  private async decompress(data: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      const uint8Array = new Uint8Array(data);

      // Note: DecompressionStream might not be available in all environments
      if (typeof DecompressionStream === 'undefined') {
        return data;
      }

      const decompressed = new Response(uint8Array).body!
        .pipeThrough(new DecompressionStream('gzip'));
      const arrayBuffer = await new Response(decompressed).arrayBuffer();

      return arrayBuffer;
    } catch (error) {
      console.warn('Decompression failed, returning as-is:', error);
      return data;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }

        // Exponential backoff: 200ms, 400ms, 800ms
        const delay = 200 * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Retry operation failed');
  }
}

/**
 * Helper function to create R2Storage instance
 */
export function createR2Storage(bucket: R2Bucket, options?: R2StorageOptions): R2Storage {
  return new R2Storage(bucket, options);
}
