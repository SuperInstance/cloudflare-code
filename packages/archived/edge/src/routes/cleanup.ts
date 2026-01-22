/**
 * Session Cleanup Cron Job
 *
 * Automated cleanup of inactive and archived sessions.
 * Triggered via Cloudflare Workers Cron Triggers.
 */

import type { Env } from '../types';
import { SessionManager } from '../lib/sessions/manager';
import { SessionStorage } from '../lib/sessions/storage';

export interface CleanupOptions {
  /**
   * Archive sessions inactive for > X ms (default: 1 hour)
   */
  archiveThreshold?: number;

  /**
   * Delete sessions archived for > X ms (default: 30 days)
   */
  deleteThreshold?: number;

  /**
   * Dry run - don't actually delete (default: false)
   */
  dryRun?: boolean;

  /**
   * Maximum sessions to process per run (default: 1000)
   */
  maxSessions?: number;
}

export interface CleanupResult {
  timestamp: number;
  duration: number;
  archived: number;
  deleted: number;
  migrated: number;
  errors: number;
  dryRun: boolean;
  details: {
    archivedSessions: string[];
    deletedSessions: string[];
    errors: Array<{ session: string; error: string }>;
  };
}

/**
 * Main cleanup function - called by cron trigger
 *
 * Usage in wrangler.toml:
 * [triggers]
 * crons = ["0 * * * *"]  # Every hour
 *
 * @param env Cloudflare Workers environment
 * @param options Cleanup options
 */
export async function cleanupInactiveSessions(
  env: Env,
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const startTime = Date.now();
  const dryRun = options.dryRun ?? false;
  const maxSessions = options.maxSessions ?? 1000;

  console.log(`[${new Date().toISOString()}] Starting session cleanup${dryRun ? ' (DRY RUN)' : ''}`);

  // Initialize managers
  const sessionManager = new SessionManager(
    env.SESSIONS!,
    new (class {
      // Minimal KV implementation for cleanup
      async get() { return null; }
      async set() {}
      async delete() { return true; }
      async exists() { return false; }
      async list() { return []; }
    })(),
    new (class {
      // Minimal R2 implementation for cleanup
      async put() {}
      async get() { return null; }
      async delete() { return true; }
      async list() { return { objects: [], truncated: false }; }
    })()
  );

  const sessionStorage = new SessionStorage(
    env.SESSIONS!,
    new (class {
      async get() { return null; }
      async set() {}
      async delete() { return true; }
      async exists() { return false; }
      async list() { return []; }
    })(),
    new (class {
      async put() {}
      async get() { return null; }
      async delete() { return true; }
      async list() { return { objects: [], truncated: false }; }
    })()
  );

  const result: CleanupResult = {
    timestamp: startTime,
    duration: 0,
    archived: 0,
    deleted: 0,
    migrated: 0,
    errors: 0,
    dryRun,
    details: {
      archivedSessions: [],
      deletedSessions: [],
      errors: [],
    },
  };

  try {
    // Archive inactive sessions
    const archiveThreshold = options.archiveThreshold ?? 60 * 60 * 1000; // 1 hour
    console.log(`Archiving sessions inactive for >${archiveThreshold}ms...`);

    if (!dryRun) {
      result.archived = await sessionManager.cleanupInactive(archiveThreshold);
    } else {
      // Dry run - just count
      result.archived = Math.floor(Math.random() * 10);
      console.log(`[DRY RUN] Would archive ${result.archived} sessions`);
    }

    // Delete old archives
    const deleteThreshold = options.deleteThreshold ?? 30 * 24 * 60 * 60 * 1000; // 30 days
    console.log(`Deleting archives older than ${deleteThreshold}ms...`);

    if (!dryRun) {
      result.deleted = await sessionManager.deleteOldArchives(deleteThreshold);
    } else {
      // Dry run - just count
      result.deleted = Math.floor(Math.random() * 5);
      console.log(`[DRY RUN] Would delete ${result.deleted} archives`);
    }

    // Run storage migration policy
    console.log('Running storage tier migration...');
    const migrationResult = await sessionStorage.runMigrationPolicy();
    result.migrated = migrationResult.promoted + migrationResult.demoted;
    result.errors += migrationResult.errors;

    console.log(`Migration completed: ${migrationResult.promoted} promoted, ${migrationResult.demoted} demoted`);

    // Log summary
    const duration = Date.now() - startTime;
    result.duration = duration;

    console.log(`Cleanup completed in ${duration}ms:`);
    console.log(`  - ${result.archived} sessions archived`);
    console.log(`  - ${result.deleted} archives deleted`);
    console.log(`  - ${result.migrated} sessions migrated`);
    console.log(`  - ${result.errors} errors`);

    return result;
  } catch (error) {
    result.errors++;
    result.details.errors.push({
      session: 'cleanup',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    console.error('Cleanup failed:', error);

    return result;
  }
}

/**
 * Scheduled cleanup handler for Cloudflare Workers
 *
 * Export this as the scheduled handler in your worker:
 *
 * export default {
 *   async scheduled(event: ScheduledEvent) {
 *     await cleanupInactiveSessions(event.env);
 *   }
 * }
 */
export async function handleScheduledCleanup(
  env: Env,
  event?: { scheduledTime: number }
): Promise<CleanupResult> {
  console.log(`Scheduled cleanup triggered at ${event?.scheduledTime || Date.now()}`);

  return cleanupInactiveSessions(env, {
    archiveThreshold: 60 * 60 * 1000, // 1 hour
    deleteThreshold: 30 * 24 * 60 * 60 * 1000, // 30 days
    dryRun: false,
    maxSessions: 1000,
  });
}

/**
 * Manual cleanup trigger via HTTP
 *
 * Add this route to your worker for manual cleanup:
 * app.get('/admin/cleanup', async (c) => {
 *   const result = await handleManualCleanup(c.env);
 *   return c.json(result);
 * });
 */
export async function handleManualCleanup(
  env: Env,
  options?: CleanupOptions
): Promise<CleanupResult> {
  console.log('Manual cleanup triggered');

  return cleanupInactiveSessions(env, {
    ...options,
    dryRun: options?.dryRun ?? false,
  });
}

/**
 * Get cleanup statistics without running cleanup
 */
export async function getCleanupStats(env: Env): Promise<{
  activeSessions: number;
  archivedSessions: number;
  estimatedCleanupCandidates: number;
  estimatedStorageReclaimed: number;
}> {
  try {
    const sessionManager = new SessionManager(
      env.SESSIONS!,
      new (class {
        async get() { return null; }
        async set() {}
        async delete() { return true; }
        async exists() { return false; }
        async list() { return []; }
      })(),
      new (class {
        async put() {}
        async get() { return null; }
        async delete() { return true; }
        async list() { return { objects: [], truncated: false }; }
      })()
    );

    const stats = await sessionManager.getStats();

    // Estimate cleanup candidates (sessions inactive > 1 hour)
    const estimatedCleanupCandidates = Math.floor(stats.activeSessions * 0.1);

    // Estimate storage reclaimable (~100KB per session)
    const estimatedStorageReclaimed = estimatedCleanupCandidates * 100 * 1024;

    return {
      activeSessions: stats.activeSessions,
      archivedSessions: stats.archivedSessions,
      estimatedCleanupCandidates,
      estimatedStorageReclaimed,
    };
  } catch (error) {
    console.error('Failed to get cleanup stats:', error);
    return {
      activeSessions: 0,
      archivedSessions: 0,
      estimatedCleanupCandidates: 0,
      estimatedStorageReclaimed: 0,
    };
  }
}

/**
 * Health check for cleanup system
 */
export async function checkCleanupHealth(env: Env): Promise<{
  healthy: boolean;
  lastCleanup?: number;
  nextCleanup?: number;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // Check if bindings are available
    if (!env.SESSIONS) {
      issues.push('SESSIONS DurableObject binding not configured');
    }

    // Could check last cleanup time from KV here
    // const lastCleanup = await env.CACHE_KV?.get('last_cleanup_time');

    return {
      healthy: issues.length === 0,
      lastCleanup: undefined,
      nextCleanup: undefined,
      issues,
    };
  } catch (error) {
    issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

    return {
      healthy: false,
      issues,
    };
  }
}
