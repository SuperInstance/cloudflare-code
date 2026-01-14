/**
 * Graceful Shutdown Handler
 * Manages graceful shutdown of instances during deployment
 */

import { DeploymentTarget } from '../types';
import { Logger } from '../utils/logger';

export interface GracefulShutdownOptions {
  timeout: number;
  drainInterval?: number;
  logger?: Logger;
}

export interface ShutdownProgress {
  targetId: string;
  targetName: string;
  startTime: Date;
  connections: number;
  connectionsDrained: number;
  status: 'draining' | 'complete' | 'timeout';
  error?: string;
}

export class GracefulShutdown {
  private timeout: number;
  private drainInterval: number;
  private logger: Logger;
  private activeShutdowns: Map<string, ShutdownProgress> = new Map();

  constructor(options: GracefulShutdownOptions) {
    this.timeout = options.timeout;
    this.drainInterval = options.drainInterval || 1000;
    this.logger = options.logger || new Logger({ component: 'GracefulShutdown' });
  }

  /**
   * Initiate graceful shutdown for a target
   */
  async shutdown(target: DeploymentTarget): Promise<void> {
    this.logger.info('Initiating graceful shutdown', {
      targetId: target.id,
      targetName: target.name,
      timeout: this.timeout,
    });

    const progress: ShutdownProgress = {
      targetId: target.id,
      targetName: target.name,
      startTime: new Date(),
      connections: await this.getConnectionCount(target),
      connectionsDrained: 0,
      status: 'draining',
    };

    this.activeShutdowns.set(target.id, progress);

    try {
      await this.withTimeout(
        this.drainConnections(target, progress),
        this.timeout
      );

      progress.status = 'complete';
      this.logger.info('Graceful shutdown completed', {
        targetId: target.id,
        connectionsDrained: progress.connectionsDrained,
      });
    } catch (error) {
      progress.status = 'timeout';
      progress.error = error instanceof Error ? error.message : String(error);

      this.logger.error('Graceful shutdown timed out', {
        targetId: target.id,
        error: progress.error,
      });

      throw new Error(
        `Graceful shutdown timeout for ${target.name}: ${progress.error}`
      );
    } finally {
      this.activeShutdowns.delete(target.id);
    }
  }

  /**
   * Drain connections from a target
   */
  private async drainConnections(
    target: DeploymentTarget,
    progress: ShutdownProgress
  ): Promise<void> {
    this.logger.info('Draining connections', {
      targetId: target.id,
      initialConnections: progress.connections,
    });

    // Signal the target to stop accepting new connections
    await this.signalShutdown(target);

    let connectionsDrained = 0;

    while (connectionsDrained < progress.connections) {
      // Wait for drain interval
      await this.sleep(this.drainInterval);

      // Check current connection count
      const currentConnections = await this.getConnectionCount(target);
      const drained = progress.connections - currentConnections;
      connectionsDrained = drained;

      progress.connectionsDrained = connectionsDrained;

      this.logger.debug('Connection drain progress', {
        targetId: target.id,
        connectionsDrained,
        totalConnections: progress.connections,
        percentage: Math.round((connectionsDrained / progress.connections) * 100),
      });

      // If no progress for several iterations, force shutdown
      if (currentConnections === progress.connections) {
        const stuckCount = await this.checkStuckCount(target);
        if (stuckCount > 5) {
          this.logger.warn('Forcing shutdown due to stuck connections', {
            targetId: target.id,
            remainingConnections: currentConnections,
          });
          break;
        }
      }
    }

    // Verify all connections are drained
    const finalConnections = await this.getConnectionCount(target);
    if (finalConnections > 0) {
      this.logger.warn('Remaining connections after drain', {
        targetId: target.id,
        remainingConnections: finalConnections,
      });
    }
  }

  /**
   * Signal the target to stop accepting new connections
   */
  private async signalShutdown(target: DeploymentTarget): Promise<void> {
    this.logger.debug('Signaling shutdown', {
      targetId: target.id,
    });

    // Implement actual shutdown signaling logic
    // This could involve:
    // - Sending SIGTERM to the process
    // - Calling a shutdown endpoint
    // - Updating a load balancer configuration
    // - Setting a flag in a shared store

    await this.sleep(100);
  }

  /**
   * Get the current connection count for a target
   */
  private async getConnectionCount(target: DeploymentTarget): Promise<number> {
    // In a real implementation, this would query the actual connection count
    // For now, we'll simulate it
    return 10;
  }

  /**
   * Check if the connection count is stuck
   */
  private async checkStuckCount(target: DeploymentTarget): Promise<number> {
    // In a real implementation, this would track how many iterations
    // the connection count hasn't changed
    return 0;
  }

  /**
   * Shutdown multiple targets in parallel
   */
  async shutdownAll(targets: DeploymentTarget[]): Promise<void> {
    this.logger.info('Shutting down multiple targets', {
      targetCount: targets.length,
    });

    const shutdownPromises = targets.map((target) => this.shutdown(target));

    try {
      await Promise.all(shutdownPromises);
    } catch (error) {
      this.logger.error('Failed to shutdown all targets', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Shutdown multiple targets with a limit on concurrent operations
   */
  async shutdownAllWithLimit(
    targets: DeploymentTarget[],
    concurrencyLimit: number
  ): Promise<void> {
    this.logger.info('Shutting down targets with concurrency limit', {
      targetCount: targets.length,
      concurrencyLimit,
    });

    const results: Array<PromiseSettledResult<void>> = [];

    for (let i = 0; i < targets.length; i += concurrencyLimit) {
      const batch = targets.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map((target) => this.shutdown(target));

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Check if any shutdowns failed
      const failed = batchResults.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        this.logger.warn('Some shutdowns failed in batch', {
          batchSize: batch.length,
          failedCount: failed.length,
        });
      }
    }

    // Throw if any shutdowns failed
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      throw new Error(
        `${failed.length} of ${targets.length} shutdowns failed`
      );
    }
  }

  /**
   * Get progress of active shutdowns
   */
  getProgress(): ShutdownProgress[] {
    return Array.from(this.activeShutdowns.values());
  }

  /**
   * Abort all active shutdowns
   */
  abortAll(): void {
    this.logger.warn('Aborting all graceful shutdowns', {
      activeShutdowns: this.activeShutdowns.size,
    });

    for (const [targetId, progress] of this.activeShutdowns) {
      this.logger.warn('Aborting shutdown', {
        targetId,
        connectionsDrained: progress.connectionsDrained,
      });
    }

    this.activeShutdowns.clear();
  }

  /**
   * Wrap a promise with a timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
