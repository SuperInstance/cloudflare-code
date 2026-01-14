/**
 * Workflow Versioning Manager
 * Provides version control, rollback support, migration tools, and A/B testing
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Workflow,
  WorkflowId,
  TriggerType,
  ActionType
} from '../types';

export interface WorkflowVersion {
  id: string;
  workflowId: WorkflowId;
  version: number;
  workflow: Workflow;
  changelog: VersionChangeLog;
  metadata: VersionMetadata;
  createdAt: Date;
  createdBy?: string;
}

export interface VersionChangeLog {
  type: 'major' | 'minor' | 'patch' | 'hotfix';
  description: string;
  changes: VersionChange[];
  breakingChanges: boolean;
}

export interface VersionChange {
  type: 'added' | 'modified' | 'removed' | 'fixed';
  entity: 'node' | 'connection' | 'trigger' | 'variable' | 'setting';
  entityId: string;
  description: string;
  details?: Record<string, any>;
}

export interface VersionMetadata {
  tags?: string[];
  environment?: 'development' | 'staging' | 'production';
  stable: boolean;
  deprecated: boolean;
  experimental?: boolean;
  migrationRequired?: boolean;
  compatibleFrom?: string;
  compatibleTo?: string;
}

export interface VersionDiff {
  versionA: string;
  versionB: string;
  changes: DiffChange[];
  summary: DiffSummary;
  compatibility: 'compatible' | 'breaking' | 'requires-migration';
}

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  entity: 'node' | 'connection' | 'trigger' | 'variable' | 'setting';
  entityId: string;
  oldValue?: any;
  newValue?: any;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface DiffSummary {
  addedNodes: number;
  removedNodes: number;
  modifiedNodes: number;
  addedConnections: number;
  removedConnections: number;
  modifiedConnections: number;
  breakingChanges: number;
}

export interface RollbackPlan {
  targetVersion: string;
  currentVersion: string;
  steps: RollbackStep[];
  estimatedDowntime?: number;
  dataMigration?: boolean;
  rollbackStrategy: 'immediate' | 'gradual' | 'blue-green';
}

export interface RollbackStep {
  order: number;
  action: string;
  description: string;
  requiresDowntime: boolean;
  estimatedDuration?: number;
}

export interface Migration {
  id: string;
  fromVersion: string;
  toVersion: string;
  steps: MigrationStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled-back';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface MigrationStep {
  order: number;
  type: 'data' | 'schema' | 'config' | 'custom';
  description: string;
  execute: () => Promise<void>;
  rollback?: () => Promise<void>;
}

export interface ABTest {
  id: string;
  name: string;
  description?: string;
  workflowId: WorkflowId;
  versions: TestVersion[];
  trafficAllocation: Map<string, number>; // versionId -> percentage
  metrics: TestMetric[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  winner?: string;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
}

export interface TestVersion {
  versionId: string;
  version: number;
  baseline: boolean;
}

export interface TestMetric {
  name: string;
  value: number;
  improvement?: number;
  significant: boolean;
}

export class WorkflowVersioningManager {
  private versions: Map<string, WorkflowVersion>;
  private activeVersions: Map<WorkflowId, string>; // workflowId -> versionId
  private migrations: Map<string, Migration>;
  private abTests: Map<string, ABTest>;
  private storage?: VersionStorage;

  constructor(storage?: VersionStorage) {
    this.versions = new Map();
    this.activeVersions = new Map();
    this.migrations = new Map();
    this.abTests = new Map();
    this.storage = storage;
  }

  /**
   * Create a new version of a workflow
   */
  public async createVersion(
    workflow: Workflow,
    changelog: Omit<VersionChangeLog, 'changes'> & { changes?: Omit<VersionChange, 'entity'>[] },
    metadata?: Partial<VersionMetadata>,
    createdBy?: string
  ): Promise<WorkflowVersion> {
    // Get current version number
    const currentVersion = await this.getCurrentVersionNumber(workflow.id);
    const newVersion = this.incrementVersion(currentVersion, changelog.type);

    // Create version object
    const version: WorkflowVersion = {
      id: uuidv4(),
      workflowId: workflow.id,
      version: newVersion,
      workflow: JSON.parse(JSON.stringify(workflow)),
      changelog: {
        ...changelog,
        changes: this.generateChangeLog(workflow, changelog.changes || [])
      },
      metadata: {
        stable: true,
        deprecated: false,
        ...metadata
      },
      createdAt: new Date(),
      createdBy
    };

    // Store version
    this.versions.set(version.id, version);

    // Persist to storage
    if (this.storage) {
      await this.storage.saveVersion(version);
    }

    return version;
  }

  /**
   * Get current version number for a workflow
   */
  private async getCurrentVersionNumber(workflowId: WorkflowId): Promise<number> {
    const activeVersionId = this.activeVersions.get(workflowId);
    if (!activeVersionId) {
      return 0;
    }

    const activeVersion = this.versions.get(activeVersionId);
    return activeVersion?.version || 0;
  }

  /**
   * Increment version number based on change type
   */
  private incrementVersion(current: number, type: VersionChangeLog['type']): number {
    const [major, minor, patch] = this.parseVersion(current);

    switch (type) {
      case 'major':
        return this.formatVersion(major + 1, 0, 0);
      case 'minor':
        return this.formatVersion(major, minor + 1, 0);
      case 'patch':
      case 'hotfix':
        return this.formatVersion(major, minor, patch + 1);
      default:
        return current;
    }
  }

  /**
   * Parse version number
   */
  private parseVersion(version: number): [number, number, number] {
    // Simple version parsing - in production, use semantic versioning
    const major = Math.floor(version / 10000);
    const minor = Math.floor((version % 10000) / 100);
    const patch = version % 100;
    return [major, minor, patch];
  }

  /**
   * Format version number
   */
  private formatVersion(major: number, minor: number, patch: number): number {
    return major * 10000 + minor * 100 + patch;
  }

  /**
   * Generate change log
   */
  private generateChangeLog(
    workflow: Workflow,
    changes: Omit<VersionChange, 'entity'>[]
  ): VersionChange[] {
    // Auto-generate changes from workflow diff
    const generatedChanges: VersionChange[] = [];

    // Compare with previous version if available
    const previousVersion = this.getActiveVersion(workflow.id);
    if (previousVersion) {
      const diff = this.diffWorkflows(previousVersion.workflow, workflow);
      generatedChanges.push(...diff);
    }

    // Add manual changes
    for (const change of changes) {
      generatedChanges.push({
        ...change,
        entity: 'node' // Default to node, should be specified
      } as VersionChange);
    }

    return generatedChanges;
  }

  /**
   * Get version by ID
   */
  public getVersion(versionId: string): WorkflowVersion | undefined {
    return this.versions.get(versionId);
  }

  /**
   * Get active version for a workflow
   */
  public getActiveVersion(workflowId: WorkflowId): WorkflowVersion | undefined {
    const versionId = this.activeVersions.get(workflowId);
    return versionId ? this.versions.get(versionId) : undefined;
  }

  /**
   * Get all versions for a workflow
   */
  public getWorkflowVersions(workflowId: WorkflowId): WorkflowVersion[] {
    return Array.from(this.versions.values())
      .filter(v => v.workflowId === workflowId)
      .sort((a, b) => b.version - a.version);
  }

  /**
   * Activate a version
   */
  public async activateVersion(versionId: string): Promise<void> {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    this.activeVersions.set(version.workflowId, versionId);

    if (this.storage) {
      await this.storage.setActiveVersion(version.workflowId, versionId);
    }
  }

  /**
   * Deactivate a version
   */
  public async deactivateVersion(workflowId: WorkflowId): Promise<void> {
    this.activeVersions.delete(workflowId);

    if (this.storage) {
      await this.storage.setActiveVersion(workflowId, null);
    }
  }

  /**
   * Compare two versions
   */
  public diffVersions(versionAId: string, versionBId: string): VersionDiff {
    const versionA = this.versions.get(versionAId);
    const versionB = this.versions.get(versionBId);

    if (!versionA || !versionB) {
      throw new Error('One or both versions not found');
    }

    const changes = this.diffWorkflows(versionA.workflow, versionB.workflow);
    const summary = this.calculateDiffSummary(changes);
    const compatibility = this.assessCompatibility(changes, summary);

    return {
      versionA: versionAId,
      versionB: versionBId,
      changes,
      summary,
      compatibility
    };
  }

  /**
   * Diff two workflows
   */
  private diffWorkflows(workflowA: Workflow, workflowB: Workflow): DiffChange[] {
    const changes: DiffChange[] = [];

    // Compare nodes
    const nodesA = new Map(workflowA.nodes.map(n => [n.id, n]));
    const nodesB = new Map(workflowB.nodes.map(n => [n.id, n]));

    // Find added nodes
    for (const [id, node] of nodesB) {
      if (!nodesA.has(id)) {
        changes.push({
          type: 'added',
          entity: 'node',
          entityId: id,
          newValue: node,
          impact: 'medium'
        });
      }
    }

    // Find removed nodes
    for (const [id, node] of nodesA) {
      if (!nodesB.has(id)) {
        changes.push({
          type: 'removed',
          entity: 'node',
          entityId: id,
          oldValue: node,
          impact: 'high'
        });
      }
    }

    // Find modified nodes
    for (const [id, nodeA] of nodesA) {
      const nodeB = nodesB.get(id);
      if (nodeB) {
        if (JSON.stringify(nodeA) !== JSON.stringify(nodeB)) {
          changes.push({
            type: 'modified',
            entity: 'node',
            entityId: id,
            oldValue: nodeA,
            newValue: nodeB,
            impact: this.assessNodeChangeImpact(nodeA, nodeB)
          });
        }
      }
    }

    // Compare connections
    const connectionsA = new Map(workflowA.connections.map(c => [c.id, c]));
    const connectionsB = new Map(workflowB.connections.map(c => [c.id, c]));

    // Find added connections
    for (const [id, conn] of connectionsB) {
      if (!connectionsA.has(id)) {
        changes.push({
          type: 'added',
          entity: 'connection',
          entityId: id,
          newValue: conn,
          impact: 'low'
        });
      }
    }

    // Find removed connections
    for (const [id, conn] of connectionsA) {
      if (!connectionsB.has(id)) {
        changes.push({
          type: 'removed',
          entity: 'connection',
          entityId: id,
          oldValue: conn,
          impact: 'medium'
        });
      }
    }

    return changes;
  }

  /**
   * Assess the impact of a node change
   */
  private assessNodeChangeImpact(nodeA: any, nodeB: any): DiffChange['impact'] {
    // Check for critical changes
    if (nodeA.type !== nodeB.type) {
      return 'critical';
    }

    if (nodeA.actionType !== nodeB.actionType) {
      return 'high';
    }

    // Check for configuration changes
    if (JSON.stringify(nodeA.config) !== JSON.stringify(nodeB.config)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Calculate diff summary
   */
  private calculateDiffSummary(changes: DiffChange[]): DiffSummary {
    const summary: DiffSummary = {
      addedNodes: 0,
      removedNodes: 0,
      modifiedNodes: 0,
      addedConnections: 0,
      removedConnections: 0,
      modifiedConnections: 0,
      breakingChanges: 0
    };

    for (const change of changes) {
      switch (change.entity) {
        case 'node':
          switch (change.type) {
            case 'added': summary.addedNodes++; break;
            case 'removed': summary.removedNodes++; break;
            case 'modified': summary.modifiedNodes++; break;
          }
          break;
        case 'connection':
          switch (change.type) {
            case 'added': summary.addedConnections++; break;
            case 'removed': summary.removedConnections++; break;
            case 'modified': summary.modifiedConnections++; break;
          }
          break;
      }

      if (change.impact === 'critical' || change.impact === 'high') {
        summary.breakingChanges++;
      }
    }

    return summary;
  }

  /**
   * Assess compatibility
   */
  private assessCompatibility(
    changes: DiffChange[],
    summary: DiffSummary
  ): VersionDiff['compatibility'] {
    if (summary.breakingChanges > 0) {
      return 'breaking';
    }

    if (summary.removedNodes > 0 || summary.removedConnections > 0) {
      return 'requires-migration';
    }

    return 'compatible';
  }

  /**
   * Create a rollback plan
   */
  public createRollbackPlan(
    workflowId: WorkflowId,
    targetVersionId: string,
    strategy: RollbackPlan['rollbackStrategy'] = 'immediate'
  ): RollbackPlan {
    const currentVersion = this.getActiveVersion(workflowId);
    const targetVersion = this.versions.get(targetVersionId);

    if (!currentVersion || !targetVersion) {
      throw new Error('Current or target version not found');
    }

    const diff = this.diffVersions(currentVersion.id, targetVersionId);
    const steps: RollbackStep[] = [];

    // Generate rollback steps based on diff
    let stepOrder = 1;

    // Step 1: Backup current state
    steps.push({
      order: stepOrder++,
      action: 'backup',
      description: 'Backup current workflow state',
      requiresDowntime: false
    });

    // Step 2: Stop current version
    steps.push({
      order: stepOrder++,
      action: 'stop',
      description: 'Stop current version execution',
      requiresDowntime: strategy === 'immediate'
    });

    // Step 3: Apply rollback
    steps.push({
      order: stepOrder++,
      action: 'rollback',
      description: `Rollback to version ${targetVersion.version}`,
      requiresDowntime: strategy === 'immediate'
    });

    // Step 4: Data migration if needed
    if (diff.compatibility === 'requires-migration') {
      steps.push({
        order: stepOrder++,
        action: 'migrate',
        description: 'Migrate data to previous schema',
        requiresDowntime: true,
        estimatedDuration: 300000 // 5 minutes
      });
    }

    // Step 5: Verify
    steps.push({
      order: stepOrder++,
      action: 'verify',
      description: 'Verify rollback integrity',
      requiresDowntime: false
    });

    return {
      targetVersion: targetVersionId,
      currentVersion: currentVersion.id,
      steps,
      estimatedDowntime: this.calculateDowntime(steps, strategy),
      dataMigration: diff.compatibility === 'requires-migration',
      rollbackStrategy: strategy
    };
  }

  /**
   * Calculate estimated downtime
   */
  private calculateDowntime(
    steps: RollbackStep[],
    strategy: RollbackPlan['rollbackStrategy']
  ): number {
    if (strategy === 'blue-green') {
      return 0; // No downtime with blue-green deployment
    }

    const downtimeSteps = steps.filter(s => s.requiresDowntime);
    return downtimeSteps.reduce((sum, step) => sum + (step.estimatedDuration || 5000), 0);
  }

  /**
   * Execute rollback
   */
  public async executeRollback(workflowId: WorkflowId, plan: RollbackPlan): Promise<void> {
    // Execute steps in order
    for (const step of plan.steps) {
      console.log(`Executing rollback step ${step.order}: ${step.action}`);

      // In production, this would execute actual rollback logic
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Activate target version
    await this.activateVersion(plan.targetVersion);
  }

  /**
   * Create a migration
   */
  public createMigration(
    fromVersionId: string,
    toVersionId: string,
    steps: MigrationStep[]
  ): Migration {
    const migration: Migration = {
      id: uuidv4(),
      fromVersion: fromVersionId,
      toVersion: toVersionId,
      steps,
      status: 'pending'
    };

    this.migrations.set(migration.id, migration);
    return migration;
  }

  /**
   * Execute a migration
   */
  public async executeMigration(migrationId: string): Promise<void> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    migration.status = 'running';
    migration.startedAt = new Date();

    try {
      // Execute steps in order
      for (const step of migration.steps) {
        await step.execute();
      }

      migration.status = 'completed';
      migration.completedAt = new Date();
    } catch (error) {
      migration.status = 'failed';
      migration.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Rollback a migration
   */
  public async rollbackMigration(migrationId: string): Promise<void> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`);
    }

    migration.status = 'rolled-back';

    // Execute rollback steps in reverse order
    for (let i = migration.steps.length - 1; i >= 0; i--) {
      const step = migration.steps[i];
      if (step.rollback) {
        await step.rollback();
      }
    }
  }

  /**
   * Create an A/B test
   */
  public createABTest(
    workflowId: WorkflowId,
    name: string,
    versions: TestVersion[],
    trafficAllocation: Map<string, number>,
    description?: string
  ): ABTest {
    const test: ABTest = {
      id: uuidv4(),
      name,
      description,
      workflowId,
      versions,
      trafficAllocation,
      metrics: [],
      status: 'draft',
      createdAt: new Date()
    };

    this.abTests.set(test.id, test);
    return test;
  }

  /**
   * Start an A/B test
   */
  public async startABTest(testId: string): Promise<void> {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    test.status = 'running';
    test.startDate = new Date();

    // In production, this would configure traffic routing
  }

  /**
   * Stop an A/B test
   */
  public async stopABTest(testId: string, winner?: string): Promise<void> {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    test.status = 'completed';
    test.endDate = new Date();
    test.winner = winner;

    // Promote winner if specified
    if (winner) {
      await this.activateVersion(winner);
    }
  }

  /**
   * Record metrics for an A/B test
   */
  public recordABTestMetric(testId: string, metric: TestMetric): void {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    test.metrics.push(metric);
  }

  /**
   * Get all versions
   */
  public getAllVersions(): WorkflowVersion[] {
    return Array.from(this.versions.values());
  }

  /**
   * Delete a version
   */
  public async deleteVersion(versionId: string): Promise<void> {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    // Check if version is active
    if (this.activeVersions.get(version.workflowId) === versionId) {
      throw new Error('Cannot delete active version');
    }

    this.versions.delete(versionId);

    if (this.storage) {
      await this.storage.deleteVersion(versionId);
    }
  }

  /**
   * Search versions by tags
   */
  public searchByTags(tags: string[]): WorkflowVersion[] {
    return Array.from(this.versions.values()).filter(version =>
      version.metadata.tags?.some(tag => tags.includes(tag))
    );
  }

  /**
   * Get version statistics
   */
  public getStatistics(): {
    totalVersions: number;
    activeVersions: number;
    deprecatedVersions: number;
    experimentalVersions: number;
  } {
    const versions = Array.from(this.versions.values());

    return {
      totalVersions: versions.length,
      activeVersions: this.activeVersions.size,
      deprecatedVersions: versions.filter(v => v.metadata.deprecated).length,
      experimentalVersions: versions.filter(v => v.metadata.experimental).length
    };
  }
}

/**
 * Version storage interface
 */
export interface VersionStorage {
  saveVersion(version: WorkflowVersion): Promise<void>;
  getVersion(versionId: string): Promise<WorkflowVersion | null>;
  getWorkflowVersions(workflowId: WorkflowId): Promise<WorkflowVersion[]>;
  setActiveVersion(workflowId: WorkflowId, versionId: string | null): Promise<void>;
  deleteVersion(versionId: string): Promise<void>;
}
