/**
 * GitOps Engine - Core reconciliation and synchronization logic
 */

import {
  GitOpsConfig,
  ReconciliationState,
  ReconciliationStatus,
  ConflictResolution,
  SyncResult,
  DriftReport,
  DriftChange,
  DeploymentConfig,
  Environment,
} from '../types';
import { GitProviderAdapter } from './providers/git-provider-adapter';
import { KubernetesClient } from './providers/kubernetes-client';
import { CloudflareClient } from './providers/cloudflare-client';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import { Validator } from '../utils/validator';
import { diffObjects, generateHash } from '../utils/helpers';
import { DurableObjectStorage } from '../utils/durable-object';

export interface GitOpsEngineOptions {
  config: GitOpsConfig;
  storage?: DurableObjectStorage;
  logger?: Logger;
  metrics?: MetricsCollector;
}

/**
 * Main GitOps engine class
 * Handles repository watching, state reconciliation, and drift detection
 */
export class GitOpsEngine {
  private config: GitOpsConfig;
  private storage?: DurableObjectStorage;
  private logger: Logger;
  private metrics: MetricsCollector;
  private gitProvider: GitProviderAdapter;
  private clusterClient: KubernetesClient | CloudflareClient;
  private validator: Validator;
  private syncInterval?: NodeJS.Timeout;
  private driftCheckInterval?: NodeJS.Timeout;
  private isRunning = false;
  private lastSyncRevision = '';
  private resourceStates = new Map<string, ReconciliationState>();

  constructor(options: GitOpsEngineOptions) {
    this.config = options.config;
    this.storage = options.storage;
    this.logger = options.logger || new Logger({ service: 'gitops-engine' });
    this.metrics = options.metrics || new MetricsCollector({ service: 'gitops-engine' });

    // Initialize Git provider
    this.gitProvider = new GitProviderAdapter(
      this.config.repository,
      this.logger
    );

    // Initialize cluster client based on provider type
    if (process.env.CLOUDFLARE_ACCOUNT_ID) {
      this.clusterClient = new CloudflareClient(this.logger);
    } else {
      this.clusterClient = new KubernetesClient(this.logger);
    }

    this.validator = new Validator(this.logger);
  }

  /**
   * Start the GitOps engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('GitOps engine is already running');
      return;
    }

    this.logger.info('Starting GitOps engine', {
      repository: `${this.config.repository.owner}/${this.config.repository.repo}`,
      targetPath: this.config.targetPath,
    });

    this.isRunning = true;

    try {
      // Validate Git access
      await this.gitProvider.validateAccess();

      // Perform initial sync
      await this.sync();

      // Setup periodic sync if auto-sync is enabled
      if (this.config.autoSync && this.config.syncInterval) {
        this.syncInterval = setInterval(
          () => this.sync(),
          this.config.syncInterval
        );
        this.logger.info('Auto-sync enabled', {
          interval: this.config.syncInterval,
        });
      }

      // Setup drift detection if enabled
      if (this.config.driftDetection?.enabled) {
        this.driftCheckInterval = setInterval(
          () => this.detectAndCorrectDrift(),
          this.config.driftDetection.checkInterval
        );
        this.logger.info('Drift detection enabled', {
          checkInterval: this.config.driftDetection.checkInterval,
        });
      }

      this.logger.info('GitOps engine started successfully');
    } catch (error) {
      this.logger.error('Failed to start GitOps engine', { error });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the GitOps engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping GitOps engine');

    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
      this.driftCheckInterval = undefined;
    }

    this.logger.info('GitOps engine stopped');
  }

  /**
   * Perform a full synchronization
   */
  async sync(ref?: string): Promise<SyncResult> {
    const startTime = Date.now();
    let syncRevision = '';
    let resourcesApplied = 0;
    let resourcesDeleted = 0;
    let resourcesSkipped = 0;
    let error: string | undefined;

    try {
      this.logger.info('Starting synchronization', { ref });
      this.metrics.incrementCounter('gitops.sync.attempts', 1);

      // Fetch desired state from Git
      const commitInfo = await this.gitProvider.fetchCommitInfo(ref);
      syncRevision = commitInfo.sha;

      if (syncRevision === this.lastSyncRevision) {
        this.logger.info('No changes detected', { revision: syncRevision });
        return {
          success: true,
          syncRevision,
          resourcesApplied: 0,
          resourcesDeleted: 0,
          resourcesSkipped: 0,
          duration: Date.now() - startTime,
        };
      }

      // Fetch manifests from repository
      const manifests = await this.gitProvider.fetchManifests(
        this.config.targetPath,
        ref
      );

      this.logger.info('Fetched manifests from Git', {
        count: manifests.length,
        revision: syncRevision,
      });

      // Get current state from cluster
      const currentState =
        await this.clusterClient.getCurrentState(manifests);

      this.logger.info('Retrieved current cluster state', {
        resources: currentState.size,
      });

      // Validate manifests if enabled
      if (this.config.validateOnSync) {
        await this.validateManifests(manifests);
      }

      // Reconcile state
      const reconciliationResult = await this.reconcileState(
        manifests,
        currentState,
        syncRevision
      );

      resourcesApplied = reconciliationResult.applied;
      resourcesDeleted = reconciliationResult.deleted;
      resourcesSkipped = reconciliationResult.skipped;

      // Update last sync revision
      this.lastSyncRevision = syncRevision;

      // Store state if storage is available
      if (this.storage) {
        await this.storage.set('lastSyncRevision', syncRevision);
        await this.storage.set('lastSyncTime', new Date().toISOString());
      }

      const duration = Date.now() - startTime;
      this.logger.info('Synchronization completed', {
        revision: syncRevision,
        resourcesApplied,
        resourcesDeleted,
        resourcesSkipped,
        duration,
      });

      this.metrics.incrementCounter('gitops.sync.success', 1);
      this.metrics.recordHistogram('gitops.sync.duration', duration);

      return {
        success: true,
        syncRevision,
        resourcesApplied,
        resourcesDeleted,
        resourcesSkipped,
        duration,
      };
    } catch (err: any) {
      error = err.message;
      const duration = Date.now() - startTime;

      this.logger.error('Synchronization failed', {
        error: err.message,
        duration,
      });

      this.metrics.incrementCounter('gitops.sync.failed', 1);

      return {
        success: false,
        syncRevision,
        resourcesApplied,
        resourcesDeleted,
        resourcesSkipped,
        duration,
        error,
      };
    }
  }

  /**
   * Reconcile desired state with actual state
   */
  private async reconcileState(
    desiredState: any[],
    currentState: Map<string, any>,
    revision: string
  ): Promise<{
    applied: number;
    deleted: number;
    skipped: number;
  }> {
    let applied = 0;
    let deleted = 0;
    let skipped = 0;

    const desiredResources = new Map<string, any>();
    for (const manifest of desiredState) {
      const key = this.getResourceKey(manifest);
      desiredResources.set(key, manifest);
    }

    // Process desired state
    for (const [key, desired] of desiredResources.entries()) {
      const current = currentState.get(key);
      const state = this.getOrCreateReconciliationState(key);

      try {
        state.generation++;
        state.lastAttemptedAt = new Date();
        state.status = ReconciliationStatus.IN_PROGRESS;

        if (!current) {
          // Resource doesn't exist - create it
          this.logger.info('Creating resource', { key });
          await this.clusterClient.applyResource(desired);
          applied++;
          state.status = ReconciliationStatus.SUCCESS;
          state.lastSuccessAt = new Date();
        } else {
          // Resource exists - check for differences
          const diff = diffObjects(current, desired);

          if (diff.hasChanges) {
            this.logger.info('Updating resource', {
              key,
              changes: diff.changes.length,
            });
            await this.clusterClient.applyResource(desired);
            applied++;
            state.status = ReconciliationStatus.SUCCESS;
            state.lastSuccessAt = new Date();
          } else {
            skipped++;
            state.status = ReconciliationStatus.SUCCESS;
          }
        }

        state.observedGeneration = state.generation;
        this.resourceStates.set(key, state);
      } catch (err: any) {
        this.logger.error('Failed to reconcile resource', {
          key,
          error: err.message,
        });
        state.status = ReconciliationStatus.FAILED;
        state.message = err.message;
        this.resourceStates.set(key, state);
        this.metrics.incrementCounter('gitops.reconciliation.failed', 1, {
          resource: key,
        });
      }
    }

    // Prune resources that exist in cluster but not in Git
    if (this.config.pruneResources) {
      for (const [key, current] of currentState.entries()) {
        if (!desiredResources.has(key)) {
          const state = this.getOrCreateReconciliationState(key);

          try {
            this.logger.info('Pruning resource', { key });
            await this.clusterClient.deleteResource(current);
            deleted++;
            state.status = ReconciliationStatus.SUCCESS;
            this.resourceStates.delete(key);
          } catch (err: any) {
            this.logger.error('Failed to prune resource', {
              key,
              error: err.message,
            });
            state.status = ReconciliationStatus.FAILED;
            state.message = err.message;
            this.resourceStates.set(key, state);
            this.metrics.incrementCounter('gitops.prune.failed', 1, {
              resource: key,
            });
          }
        }
      }
    }

    return { applied, deleted, skipped };
  }

  /**
   * Detect and correct drift between desired and actual state
   */
  async detectAndCorrectDrift(): Promise<DriftReport | null> {
    if (!this.config.driftDetection?.enabled) {
      return null;
    }

    this.logger.info('Detecting configuration drift');
    this.metrics.incrementCounter('gitops.drift_detection.attempts', 1);

    try {
      const startTime = Date.now();

      // Fetch desired state from Git
      const manifests = await this.gitProvider.fetchManifests(
        this.config.targetPath
      );

      // Get current state from cluster
      const currentState = await this.clusterClient.getCurrentState(manifests);

      const changes: DriftChange[] = [];

      for (const manifest of manifests) {
        const key = this.getResourceKey(manifest);
        const current = currentState.get(key);

        if (current) {
          const diff = diffObjects(current, manifest);

          if (diff.hasChanges) {
            for (const change of diff.changes) {
              changes.push({
                resource: key,
                type: 'update',
                expected: change.expected,
                actual: change.actual,
                path: change.path,
              });
            }
          }
        } else {
          changes.push({
            resource: key,
            type: 'create',
            expected: manifest,
            actual: null,
          });
        }
      }

      // Check for extra resources
      for (const [key, current] of currentState.entries()) {
        const existsInDesired = manifests.some(
          (m) => this.getResourceKey(m) === key
        );

        if (!existsInDesired) {
          changes.push({
            resource: key,
            type: 'delete',
            expected: null,
            actual: current,
          });
        }
      }

      const hasDrift = changes.length > 0;
      const duration = Date.now() - startTime;

      const report: DriftReport = {
        hasDrift,
        driftDetectedAt: new Date(),
        changes,
        severity: this.calculateDriftSeverity(changes),
      };

      this.logger.info('Drift detection completed', {
        hasDrift,
        changesCount: changes.length,
        severity: report.severity,
        duration,
      });

      this.metrics.recordHistogram('gitops.drift_detection.duration', duration);

      if (hasDrift) {
        this.metrics.incrementCounter('gitops.drift_detection.detected', 1, {
          severity: report.severity,
        });

        // Auto-correct if enabled
        if (this.config.driftDetection.autoCorrect) {
          await this.correctDrift(report);
        }
      }

      return report;
    } catch (err: any) {
      this.logger.error('Drift detection failed', { error: err.message });
      this.metrics.incrementCounter('gitops.drift_detection.failed', 1);
      return null;
    }
  }

  /**
   * Correct detected drift
   */
  private async correctDrift(driftReport: DriftReport): Promise<void> {
    this.logger.info('Correcting drift', {
      changesCount: driftReport.changes.length,
    });

    try {
      if (this.config.driftDetection?.correctionStrategy === 'manual') {
        this.logger.info('Manual correction required');
        return;
      }

      // Perform sync to correct drift
      const syncResult = await this.sync();

      if (!syncResult.success) {
        this.logger.error('Failed to correct drift', {
          error: syncResult.error,
        });
        throw new Error(syncResult.error);
      }

      this.logger.info('Drift correction completed', {
        resourcesApplied: syncResult.resourcesApplied,
      });
    } catch (err: any) {
      this.logger.error('Drift correction failed', { error: err.message });
      this.metrics.incrementCounter('gitops.drift_correction.failed', 1);
      throw err;
    }
  }

  /**
   * Get reconciliation state for a specific resource
   */
  getReconciliationState(resourceKey: string): ReconciliationState | undefined {
    return this.resourceStates.get(resourceKey);
  }

  /**
   * Get all reconciliation states
   */
  getAllReconciliationStates(): Map<string, ReconciliationState> {
    return new Map(this.resourceStates);
  }

  /**
   * Trigger a manual sync
   */
  async triggerSync(ref?: string): Promise<SyncResult> {
    this.logger.info('Manual sync triggered', { ref });
    return this.sync(ref);
  }

  /**
   * Rollback to a previous revision
   */
  async rollback(revision: string): Promise<SyncResult> {
    this.logger.info('Initiating rollback', { revision });
    this.metrics.incrementCounter('gitops.rollback.attempts', 1);

    try {
      const result = await this.sync(revision);

      if (result.success) {
        this.logger.info('Rollback completed successfully', {
          revision,
          resourcesApplied: result.resourcesApplied,
        });
        this.metrics.incrementCounter('gitops.rollback.success', 1);
      } else {
        this.logger.error('Rollback failed', { error: result.error });
        this.metrics.incrementCounter('gitops.rollback.failed', 1);
      }

      return result;
    } catch (err: any) {
      this.logger.error('Rollback error', { error: err.message });
      this.metrics.incrementCounter('gitops.rollback.failed', 1);
      throw err;
    }
  }

  /**
   * Get sync status
   */
  getStatus(): {
    isRunning: boolean;
    lastSyncRevision: string;
    autoSync: boolean;
    driftDetectionEnabled: boolean;
    resourceCount: number;
  } {
    return {
      isRunning: this.isRunning,
      lastSyncRevision: this.lastSyncRevision,
      autoSync: this.config.autoSync || false,
      driftDetectionEnabled: this.config.driftDetection?.enabled || false,
      resourceCount: this.resourceStates.size,
    };
  }

  /**
   * Validate manifests
   */
  private async validateManifests(manifests: any[]): Promise<void> {
    this.logger.info('Validating manifests', { count: manifests.length });

    for (const manifest of manifests) {
      const errors = await this.validator.validateManifest(manifest);

      if (errors.length > 0) {
        const key = this.getResourceKey(manifest);
        throw new Error(
          `Validation failed for ${key}: ${errors.join(', ')}`
        );
      }
    }

    this.logger.info('Manifest validation passed');
  }

  /**
   * Get or create reconciliation state for a resource
   */
  private getOrCreateReconciliationState(resourceKey: string): ReconciliationState {
    let state = this.resourceStates.get(resourceKey);

    if (!state) {
      state = {
        uid: generateHash(),
        generation: 0,
        observedGeneration: 0,
        status: ReconciliationStatus.PENDING,
      };
    }

    return state;
  }

  /**
   * Get unique resource key
   */
  private getResourceKey(manifest: any): string {
    const kind = manifest.kind;
    const metadata = manifest.metadata || {};
    const name = metadata.name;
    const namespace = metadata.namespace || 'default';
    return `${namespace}/${kind}/${name}`;
  }

  /**
   * Calculate drift severity
   */
  private calculateDriftSeverity(changes: DriftChange[]): 'low' | 'medium' | 'high' | 'critical' {
    if (changes.length === 0) return 'low';

    const deleteCount = changes.filter((c) => c.type === 'delete').length;
    const updateCount = changes.filter((c) => c.type === 'update').length;

    if (deleteCount > 0) return 'critical';
    if (updateCount > 10) return 'high';
    if (updateCount > 5) return 'medium';
    return 'low';
  }
}
