// @ts-nocheck - Missing type definitions for p-queue
/**
 * Invalidation Engine
 *
 * Advanced cache invalidation with URL purging, tag purging,
 * wildcard purging, and batch processing.
 */

import PQueue from 'p-queue';
import { nanoid } from 'nanoid';
import type {
  IPurgeRequest,
  IPurgeResult,
  PurgeType,
  PurgeStatus,
  IInvalidatorOptions
} from '../types/index.js';
import { CacheController } from '../cache/controller.js';

export class InvalidationEngine {
  private cacheController: CacheController;
  private pendingPurges: Map<string, IPurgeRequest>;
  private purgeQueue: PQueue;
  private options: IInvalidatorOptions;
  private cloudflareAPI?: {
    apiKey: string;
    email: string;
    zoneId: string;
    accountId: string;
  };

  constructor(
    cacheController: CacheController,
    options?: IInvalidatorOptions
  ) {
    this.cacheController = cacheController;
    this.pendingPurges = new Map();

    this.options = {
      batchSize: options?.batchSize ?? 100,
      maxConcurrent: options?.maxConcurrent ?? 5,
      retryAttempts: options?.retryAttempts ?? 3,
      retryDelay: options?.retryDelay ?? 1000,
      timeout: options?.timeout ?? 30000,
      progressCallback: options?.progressCallback
    };

    this.purgeQueue = new PQueue({
      concurrency: this.options.maxConcurrent
    });
  }

  /**
   * Configure Cloudflare API
   */
  public configureCloudflare(config: {
    apiKey: string;
    email: string;
    zoneId: string;
    accountId: string;
  }): void {
    this.cloudflareAPI = config;
  }

  /**
   * Purge by URL
   */
  public async purgeURLs(urls: string[]): Promise<IPurgeResult> {
    const requestId = nanoid();
    const startTime = Date.now();

    const request: IPurgeRequest = {
      id: requestId,
      type: 'url' as PurgeType,
      targets: urls,
      status: 'pending' as PurgeStatus,
      createdAt: new Date(),
      progress: 0,
      errors: []
    };

    this.pendingPurges.set(requestId, request);

    try {
      request.status = 'in_progress' as PurgeStatus;

      // Purge local cache
      let localPurged = 0;
      for (const url of urls) {
        try {
          await this.cacheController.delete(url);
          localPurged++;
        } catch (error) {
          request.errors.push({
            target: url,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Purge Cloudflare CDN if configured
      let cdnPurged = 0;
      if (this.cloudflareAPI) {
        const cfResult = await this.purgeCloudflareURLs(urls);
        cdnPurged = cfResult.purged;
        request.errors.push(...cfResult.errors);
      }

      request.status = 'completed' as PurgeStatus;
      request.completedAt = new Date();
      request.progress = 100;

      const result: IPurgeResult = {
        requestId,
        success: request.errors.length === 0,
        purged: localPurged + cdnPurged,
        failed: request.errors.length,
        duration: Date.now() - startTime,
        errors: request.errors.map(e => `${e.target}: ${e.error}`)
      };

      this.options.progressCallback?.(100);

      return result;
    } catch (error) {
      request.status = 'failed' as PurgeStatus;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        requestId,
        success: false,
        purged: 0,
        failed: urls.length,
        duration: Date.now() - startTime,
        errors: [errorMessage]
      };
    } finally {
      this.pendingPurges.delete(requestId);
    }
  }

  /**
   * Purge by tag
   */
  public async purgeTags(tags: string[]): Promise<IPurgeResult> {
    const requestId = nanoid();
    const startTime = Date.now();

    const request: IPurgeRequest = {
      id: requestId,
      type: 'tag' as PurgeType,
      targets: tags,
      tags,
      status: 'pending' as PurgeStatus,
      createdAt: new Date(),
      progress: 0,
      errors: []
    };

    this.pendingPurges.set(requestId, request);

    try {
      request.status = 'in_progress' as PurgeStatus;

      // Purge local cache by tag
      let localPurged = 0;
      for (const tag of tags) {
        try {
          const deleted = await this.cacheController.deleteByTag(tag);
          localPurged += deleted;
        } catch (error) {
          request.errors.push({
            target: tag,
            error: error instanceof Error ? error.message : String(error)
          });
        }

        this.options.progressCallback?.(
          Math.round(((tags.indexOf(tag) + 1) / tags.length) * 100)
        );
      }

      // Purge Cloudflare CDN by tag
      let cdnPurged = 0;
      if (this.cloudflareAPI) {
        const cfResult = await this.purgeCloudflareTags(tags);
        cdnPurged = cfResult.purged;
        request.errors.push(...cfResult.errors);
      }

      request.status = 'completed' as PurgeStatus;
      request.completedAt = new Date();
      request.progress = 100;

      const result: IPurgeResult = {
        requestId,
        success: request.errors.length === 0,
        purged: localPurged + cdnPurged,
        failed: request.errors.length,
        duration: Date.now() - startTime,
        errors: request.errors.map(e => `${e.target}: ${e.error}`)
      };

      return result;
    } catch (error) {
      request.status = 'failed' as PurgeStatus;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        requestId,
        success: false,
        purged: 0,
        failed: tags.length,
        duration: Date.now() - startTime,
        errors: [errorMessage]
      };
    } finally {
      this.pendingPurges.delete(requestId);
    }
  }

  /**
   * Purge by wildcard pattern
   */
  public async purgeWildcard(pattern: string): Promise<IPurgeResult> {
    const requestId = nanoid();
    const startTime = Date.now();

    const request: IPurgeRequest = {
      id: requestId,
      type: 'wildcard' as PurgeType,
      targets: [pattern],
      status: 'pending' as PurgeStatus,
      createdAt: new Date(),
      progress: 0,
      errors: []
    };

    this.pendingPurges.set(requestId, request);

    try {
      request.status = 'in_progress' as PurgeStatus;

      // Convert wildcard to regex
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );

      // Purge local cache by pattern
      const localPurged = await this.cacheController.deleteByPattern(regex);

      // Purge Cloudflare CDN by wildcard
      let cdnPurged = 0;
      if (this.cloudflareAPI) {
        const cfResult = await this.purgeCloudflareWildcard(pattern);
        cdnPurged = cfResult.purged;
        request.errors.push(...cfResult.errors);
      }

      request.status = 'completed' as PurgeStatus;
      request.completedAt = new Date();
      request.progress = 100;

      const result: IPurgeResult = {
        requestId,
        success: request.errors.length === 0,
        purged: localPurged + cdnPurged,
        failed: request.errors.length,
        duration: Date.now() - startTime,
        errors: request.errors.map(e => `${e.target}: ${e.error}`)
      };

      return result;
    } catch (error) {
      request.status = 'failed' as PurgeStatus;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        requestId,
        success: false,
        purged: 0,
        failed: 1,
        duration: Date.now() - startTime,
        errors: [errorMessage]
      };
    } finally {
      this.pendingPurges.delete(requestId);
    }
  }

  /**
   * Batch purge with mixed types
   */
  public async batchPurge(operations: Array<{
    type: PurgeType;
    targets: string[];
  }>): Promise<IPurgeResult[]> {
    const results: IPurgeResult[] = [];

    for (const operation of operations) {
      let result: IPurgeResult;

      switch (operation.type) {
        case 'url':
          result = await this.purgeURLs(operation.targets);
          break;
        case 'tag':
          result = await this.purgeTags(operation.targets);
          break;
        case 'wildcard':
          for (const target of operation.targets) {
            result = await this.purgeWildcard(target);
            results.push(result);
          }
          continue;
        default:
          result = {
            requestId: nanoid(),
            success: false,
            purged: 0,
            failed: operation.targets.length,
            duration: 0,
            errors: [`Unknown purge type: ${operation.type}`]
          };
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Get purge status
   */
  public getPurgeStatus(requestId: string): IPurgeRequest | null {
    return this.pendingPurges.get(requestId) ?? null;
  }

  /**
   * Get all pending purges
   */
  public getPendingPurges(): IPurgeRequest[] {
    return Array.from(this.pendingPurges.values());
  }

  /**
   * Cancel purge
   */
  public cancelPurge(requestId: string): boolean {
    const request = this.pendingPurges.get(requestId);
    if (!request) return false;

    // Note: Actual cancellation depends on the Cloudflare API
    // This is a simplified implementation
    request.status = 'failed' as PurgeStatus;
    request.errors.push({
      target: '',
      error: 'Cancelled by user'
    });

    this.pendingPurges.delete(requestId);
    return true;
  }

  /**
   * Purge entire cache
   */
  public async purgeAll(): Promise<IPurgeResult> {
    const requestId = nanoid();
    const startTime = Date.now();

    try {
      // Clear local cache
      await this.cacheController.clear();

      // Purge Cloudflare CDN
      let cdnPurged = 0;
      const errors: string[] = [];

      if (this.cloudflareAPI) {
        try {
          const result = await this.purgeCloudflareAll();
          cdnPurged = result.purged;
          errors.push(...result.errors);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      return {
        requestId,
        success: errors.length === 0,
        purged: cdnPurged,
        failed: errors.length,
        duration: Date.now() - startTime,
        errors
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        requestId,
        success: false,
        purged: 0,
        failed: 1,
        duration: Date.now() - startTime,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Purge Cloudflare URLs
   */
  private async purgeCloudflareURLs(
    urls: string[]
  ): Promise<{ purged: number; errors: Array<{ target: string; error: string }> }> {
    if (!this.cloudflareAPI) {
      return { purged: 0, errors: [] };
    }

    const errors: Array<{ target: string; error: string }> = [];
    let purged = 0;

    // Process in batches
    const batchSize = this.options.batchSize ?? 100;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);

      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${this.cloudflareAPI.zoneId}/purge_cache`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Email': this.cloudflareAPI.email,
              'X-Auth-Key': this.cloudflareAPI.apiKey
            },
            body: JSON.stringify({
              files: batch
            })
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Cloudflare API error: ${error}`);
        }

        const data: any = await response.json();
        if (data.success) {
          purged += batch.length;
        } else {
          for (const url of batch) {
            errors.push({ target: url, error: 'Purge failed' });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        for (const url of batch) {
          errors.push({ target: url, error: errorMessage });
        }
      }
    }

    return { purged, errors };
  }

  /**
   * Purge Cloudflare tags
   */
  private async purgeCloudflareTags(
    tags: string[]
  ): Promise<{ purged: number; errors: Array<{ target: string; error: string }> }> {
    if (!this.cloudflareAPI) {
      return { purged: 0, errors: [] };
    }

    const errors: Array<{ target: string; error: string }> = [];

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.cloudflareAPI.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Email': this.cloudflareAPI.email,
            'X-Auth-Key': this.cloudflareAPI.apiKey
          },
          body: JSON.stringify({
            tags: tags
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cloudflare API error: ${error}`);
      }

      const data: any = await response.json();
      return {
        purged: data.success ? tags.length : 0,
        errors: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      for (const tag of tags) {
        errors.push({ target: tag, error: errorMessage });
      }

      return { purged: 0, errors };
    }
  }

  /**
   * Purge Cloudflare wildcard
   */
  private async purgeCloudflareWildcard(
    pattern: string
  ): Promise<{ purged: number; errors: Array<{ target: string; error: string }> }> {
    if (!this.cloudflareAPI) {
      return { purged: 0, errors: [] };
    }

    // Cloudflare doesn't support wildcard purging directly
    // We need to use prefix purge or purge everything
    // This is a simplified implementation

    try {
      // Use prefix purge if pattern ends with *
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);

        const response = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${this.cloudflareAPI.zoneId}/purge_cache`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Email': this.cloudflareAPI.email,
              'X-Auth-Key': this.cloudflareAPI.apiKey
            },
            body: JSON.stringify({
              prefixes: [prefix]
            })
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Cloudflare API error: ${error}`);
        }

        return { purged: 1, errors: [] };
      }

      // Fallback to purge all
      return await this.purgeCloudflareAll();
    } catch (error) {
      return {
        purged: 0,
        errors: [{ target: pattern, error: error instanceof Error ? error.message : String(error) }]
      };
    }
  }

  /**
   * Purge all Cloudflare cache
   */
  private async purgeCloudflareAll(): Promise<{
    purged: number;
    errors: Array<{ target: string; error: string }>;
  }> {
    if (!this.cloudflareAPI) {
      return { purged: 0, errors: [] };
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.cloudflareAPI.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Email': this.cloudflareAPI.email,
            'X-Auth-Key': this.cloudflareAPI.apiKey
          },
          body: JSON.stringify({
            purge_everything: true
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cloudflare API error: ${error}`);
      }

      return { purged: 1, errors: [] };
    } catch (error) {
      return {
        purged: 0,
        errors: [{ target: 'all', error: error instanceof Error ? error.message : String(error) }]
      };
    }
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): {
    size: number;
    pending: number;
    concurrency: number;
  } {
    return {
      size: this.purgeQueue.size,
      pending: this.purgeQueue.pending,
      concurrency: this.purgeQueue.concurrency
    };
  }

  /**
   * Pause purge queue
   */
  public pause(): void {
    this.purgeQueue.pause();
  }

  /**
   * Resume purge queue
   */
  public resume(): void {
    this.purgeQueue.start();
  }

  /**
   * Clear purge queue
   */
  public clearQueue(): void {
    this.purgeQueue.clear();
  }
}

export default InvalidationEngine;
