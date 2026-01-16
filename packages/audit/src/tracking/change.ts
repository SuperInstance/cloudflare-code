// @ts-nocheck - External dependencies and type compatibility issues
/**
 * Change Tracking and History System
 * Tracks all changes to resources with full audit trail
 * Supports rollback, diff generation, and compliance reporting
 */

import {
  type BaseAuditEvent,
  type ChangeHistoryEntry,
  ChangeHistoryEntrySchema,
  ResourceType,
  ActorType
} from '../types/events';

/**
 * Change record
 */
export interface ChangeRecord {
  id: string;
  timestamp: Date;
  changedBy: {
    id: string;
    name: string;
    type: ActorType;
  };
  entityType: ResourceType;
  entityId: string;
  entityName?: string;
  changeType: 'created' | 'modified' | 'deleted' | 'restored' | 'archived';
  changes: Change[];
  reason?: string;
  requestId?: string;
  rollbackId?: string;
  metadata?: Record<string, any>;
}

/**
 * Individual field change
 */
export interface Change {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

/**
 * Diff result
 */
export interface DiffResult {
  hasChanges: boolean;
  changes: Change[];
  added: number;
  removed: number;
  modified: number;
}

/**
 * Change statistics
 */
export interface ChangeStats {
  totalChanges: number;
  changesByType: Record<string, number>;
  changesByEntity: Record<string, number>;
  changesByActor: Record<string, number>;
  mostChangedEntities: Array<{ entityId: string; count: number }>;
  mostActiveActors: Array<{ actorId: string; count: number }>;
}

/**
 * Rollback plan
 */
export interface RollbackPlan {
  changeId: string;
  steps: RollbackStep[];
  estimatedImpact: string[];
  prerequisites: string[];
  canRollback: boolean;
}

/**
 * Rollback step
 */
export interface RollbackStep {
  order: number;
  description: string;
  entityType: ResourceType;
  entityId: string;
  changes: Change[];
  dependencies?: string[];
}

/**
 * Change tracking configuration
 */
export interface ChangeTrackingConfig {
  enableTracking: boolean;
  enableRollback: boolean;
  enableDiff: boolean;
  trackMetadata: boolean;
  retentionDays: number;
  maxHistoryPerEntity: number;
  sensitiveFields: string[];
}

/**
 * Change tracking system
 */
export class ChangeTrackingSystem {
  private config: ChangeTrackingConfig;
  private changeHistory: Map<string, ChangeHistoryEntry[]> = new Map();
  private entitySnapshots: Map<string, Map<string, any>> = new Map();
  private rollbackStack: Map<string, ChangeRecord[]> = new Map();

  constructor(config: Partial<ChangeTrackingConfig> = {}) {
    this.config = {
      enableTracking: config.enableTracking !== false,
      enableRollback: config.enableRollback !== false,
      enableDiff: config.enableDiff !== false,
      trackMetadata: config.trackMetadata !== false,
      retentionDays: config.retentionDays || 2555, // 7 years
      maxHistoryPerEntity: config.maxHistoryPerEntity || 1000,
      sensitiveFields: config.sensitiveFields || [
        'password',
        'apiKey',
        'secret',
        'token',
        'privateKey',
        'ssn',
        'creditCard'
      ]
    };
  }

  /**
   * Track a change to an entity
   */
  async trackChange(change: Omit<ChangeRecord, 'id' | 'timestamp'>): Promise<string> {
    if (!this.config.enableTracking) {
      throw new Error('Change tracking is disabled');
    }

    const changeRecord: ChangeRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...change
    };

    // Create audit event
    const auditEvent = this.createAuditEvent(changeRecord);

    // Store in history
    const entityKey = this.getEntityKey(changeRecord.entityType, changeRecord.entityId);

    if (!this.changeHistory.has(entityKey)) {
      this.changeHistory.set(entityKey, []);
    }

    const history = this.changeHistory.get(entityKey)!;
    history.push(this.convertToHistoryEntry(changeRecord, auditEvent));

    // Trim history if exceeds max
    if (history.length > this.config.maxHistoryPerEntity) {
      history.shift();
    }

    // Update snapshot
    await this.updateSnapshot(changeRecord);

    // Add to rollback stack if enabled
    if (this.config.enableRollback) {
      const actorKey = changeRecord.changedBy.id;
      if (!this.rollbackStack.has(actorKey)) {
        this.rollbackStack.set(actorKey, []);
      }
      this.rollbackStack.get(actorKey)!.push(changeRecord);
    }

    return changeRecord.id;
  }

  /**
   * Get change history for an entity
   */
  getHistory(
    entityType: ResourceType,
    entityId: string,
    limit?: number
  ): ChangeHistoryEntry[] {
    const entityKey = this.getEntityKey(entityType, entityId);
    const history = this.changeHistory.get(entityKey) || [];

    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get change history for multiple entities
   */
  getHistoryForEntities(
    entityType: ResourceType,
    entityIds: string[]
  ): Map<string, ChangeHistoryEntry[]> {
    const result = new Map<string, ChangeHistoryEntry[]>();

    for (const entityId of entityIds) {
      const history = this.getHistory(entityType, entityId);
      if (history.length > 0) {
        result.set(entityId, history);
      }
    }

    return result;
  }

  /**
   * Get history by actor
   */
  getHistoryByActor(actorId: string, limit?: number): ChangeHistoryEntry[] {
    const allHistory: ChangeHistoryEntry[] = [];

    for (const history of this.changeHistory.values()) {
      for (const entry of history) {
        if (entry.changedBy.id === actorId) {
          allHistory.push(entry);
        }
      }
    }

    // Sort by timestamp descending
    allHistory.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return limit ? allHistory.slice(0, limit) : allHistory;
  }

  /**
   * Get history by time range
   */
  getHistoryByTimeRange(
    startTime: Date,
    endTime: Date,
    entityType?: ResourceType
  ): ChangeHistoryEntry[] {
    const result: ChangeHistoryEntry[] = [];

    for (const [entityKey, history] of this.changeHistory.entries()) {
      // Filter by entity type if specified
      if (entityType) {
        const keyEntityType = entityKey.split(':')[0] as ResourceType;
        if (keyEntityType !== entityType) {
          continue;
        }
      }

      // Filter by time range
      for (const entry of history) {
        const entryTime = new Date(entry.timestamp);
        if (entryTime >= startTime && entryTime <= endTime) {
          result.push(entry);
        }
      }
    }

    // Sort by timestamp descending
    result.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return result;
  }

  /**
   * Generate diff between two versions
   */
  generateDiff(
    entityType: ResourceType,
    entityId: string,
    fromVersion: number,
    toVersion: number
  ): DiffResult {
    const history = this.getHistory(entityType, entityId);

    if (fromVersion < 0 || toVersion >= history.length || fromVersion > toVersion) {
      throw new Error('Invalid version numbers');
    }

    const oldSnapshot = history[fromVersion];
    const newSnapshot = history[toVersion];

    return this.calculateDiff(oldSnapshot.changes, newSnapshot.changes);
  }

  /**
   * Generate diff between current state and previous state
   */
  generateDiffFromPrevious(
    entityType: ResourceType,
    entityId: string
  ): DiffResult {
    const history = this.getHistory(entityType, entityId);

    if (history.length < 2) {
      return {
        hasChanges: false,
        changes: [],
        added: 0,
        removed: 0,
        modified: 0
      };
    }

    const previous = history[history.length - 2];
    const current = history[history.length - 1];

    return this.calculateDiff(previous.changes, current.changes);
  }

  /**
   * Create rollback plan
   */
  createRollbackPlan(changeId: string): RollbackPlan {
    const changeRecord = this.findChangeRecord(changeId);

    if (!changeRecord) {
      throw new Error(`Change record not found: ${changeId}`);
    }

    if (!this.config.enableRollback) {
      throw new Error('Rollback is disabled');
    }

    // Determine if rollback is possible
    const canRollback = this.canRollbackChange(changeRecord);

    // Create rollback steps
    const steps: RollbackStep[] = [];

    // Reverse the changes
    for (const change of changeRecord.changes) {
      const reversedChange: Change = {
        field: change.field,
        oldValue: change.newValue,
        newValue: change.oldValue,
        changeType: this.getReverseChangeType(change.changeType)
      };

      steps.push({
        order: steps.length + 1,
        description: `Revert ${change.field} from ${change.newValue} to ${change.oldValue}`,
        entityType: changeRecord.entityType,
        entityId: changeRecord.entityId,
        changes: [reversedChange]
      });
    }

    return {
      changeId,
      steps: steps.reverse(),
      estimatedImpact: this.estimateRollbackImpact(changeRecord),
      prerequisites: this.getRollbackPrerequisites(changeRecord),
      canRollback
    };
  }

  /**
   * Execute rollback
   */
  async executeRollback(changeId: string, executedBy: string): Promise<string> {
    const plan = this.createRollbackPlan(changeId);

    if (!plan.canRollback) {
      throw new Error('Cannot rollback this change');
    }

    // Execute each rollback step
    for (const step of plan.steps) {
      // Apply the reversed changes
      await this.trackChange({
        changedBy: {
          id: executedBy,
          name: 'Rollback Operation',
          type: ActorType.SYSTEM
        },
        entityType: step.entityType,
        entityId: step.entityId,
        changeType: 'modified',
        changes: step.changes,
        reason: `Rollback of change ${changeId}`,
        requestId: crypto.randomUUID(),
        rollbackId: changeId
      });
    }

    return crypto.randomUUID();
  }

  /**
   * Get change statistics
   */
  getStats(timeRange?: { start: Date; end: Date }): ChangeStats {
    const allChanges: ChangeHistoryEntry[] = [];

    for (const history of this.changeHistory.values()) {
      for (const entry of history) {
        if (timeRange) {
          const entryTime = new Date(entry.timestamp);
          if (entryTime >= timeRange.start && entryTime <= timeRange.end) {
            allChanges.push(entry);
          }
        } else {
          allChanges.push(entry);
        }
      }
    }

    // Calculate statistics
    const changesByType: Record<string, number> = {};
    const changesByEntity: Record<string, number> = {};
    const changesByActor: Record<string, number> = {};

    for (const change of allChanges) {
      // Count by type
      changesByType[change.changeType] = (changesByType[change.changeType] || 0) + 1;

      // Count by entity
      const entityKey = `${change.entityType}:${change.entityId}`;
      changesByEntity[entityKey] = (changesByEntity[entityKey] || 0) + 1;

      // Count by actor
      changesByActor[change.changedBy.id] = (changesByActor[change.changedBy.id] || 0) + 1;
    }

    // Most changed entities
    const mostChangedEntities = Object.entries(changesByEntity)
      .map(([entityKey, count]) => {
        const [entityType, entityId] = entityKey.split(':');
        return { entityId: `${entityType}:${entityId}`, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Most active actors
    const mostActiveActors = Object.entries(changesByActor)
      .map(([actorId, count]) => ({ actorId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalChanges: allChanges.length,
      changesByType,
      changesByEntity,
      changesByActor,
      mostChangedEntities,
      mostActiveActors
    };
  }

  /**
   * Get snapshot of entity at specific time
   */
  getSnapshotAt(
    entityType: ResourceType,
    entityId: string,
    timestamp: Date
  ): any {
    const entityKey = this.getEntityKey(entityType, entityId);
    const history = this.changeHistory.get(entityKey) || [];

    // Find the state at or before the timestamp
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      const entryTime = new Date(entry.timestamp);

      if (entryTime <= timestamp) {
        return this.reconstructState(history.slice(0, i + 1));
      }
    }

    return null;
  }

  /**
   * Export change history
   */
  exportHistory(
    entityType?: ResourceType,
    entityId?: string,
    format: 'json' | 'csv' = 'json'
  ): string {
    let history: ChangeHistoryEntry[] = [];

    if (entityType && entityId) {
      history = this.getHistory(entityType, entityId);
    } else if (entityType) {
      for (const [key, value] of this.changeHistory.entries()) {
        if (key.startsWith(entityType)) {
          history.push(...value);
        }
      }
    } else {
      for (const value of this.changeHistory.values()) {
        history.push(...value);
      }
    }

    if (format === 'json') {
      return JSON.stringify(history, null, 2);
    } else {
      return this.exportAsCsv(history);
    }
  }

  /**
   * Clear old history based on retention policy
   */
  async applyRetentionPolicy(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    let deletedCount = 0;

    for (const [entityKey, history] of this.changeHistory.entries()) {
      const filtered = history.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate > cutoffDate;
      });

      deletedCount += history.length - filtered.length;

      if (filtered.length > 0) {
        this.changeHistory.set(entityKey, filtered);
      } else {
        this.changeHistory.delete(entityKey);
      }
    }

    return deletedCount;
  }

  /**
   * Private helper methods
   */

  private createAuditEvent(changeRecord: ChangeRecord): BaseAuditEvent {
    return {
      id: changeRecord.id,
      eventType: `data.${changeRecord.changeType}` as any,
      timestamp: changeRecord.timestamp.toISOString(),
      sequenceNumber: 0,
      actor: changeRecord.changedBy,
      resource: {
        type: changeRecord.entityType,
        id: changeRecord.entityId,
        name: changeRecord.entityName
      },
      outcome: 'success',
      severity: this.getSeverityForChangeType(changeRecord.changeType),
      complianceFrameworks: [],
      soc2TrustServices: [],
      iso27001Domains: [],
      description: this.generateDescription(changeRecord),
      details: {
        changes: changeRecord.changes,
        reason: changeRecord.reason,
        requestId: changeRecord.requestId
      },
      tags: ['change-tracking'],
      isImmutable: true,
      isArchived: false,
      checksum: ''
    };
  }

  private convertToHistoryEntry(
    changeRecord: ChangeRecord,
    auditEvent: BaseAuditEvent
  ): ChangeHistoryEntry {
    return {
      id: changeRecord.id,
      timestamp: changeRecord.timestamp.toISOString(),
      changedBy: changeRecord.changedBy,
      entityType: changeRecord.entityType,
      entityId: changeRecord.entityId,
      entityName: changeRecord.entityName,
      changeType: changeRecord.changeType,
      changes: changeRecord.changes.map(c => ({
        field: c.field,
        oldValue: this.sanitizeFieldValue(c.field, c.oldValue),
        newValue: this.sanitizeFieldValue(c.field, c.newValue),
        changeType: c.changeType
      })),
      reason: changeRecord.reason,
      requestId: changeRecord.requestId,
      rollbackId: changeRecord.rollbackId
    };
  }

  private sanitizeFieldValue(field: string, value: any): any {
    if (this.config.sensitiveFields.some(sensitive => field.toLowerCase().includes(sensitive.toLowerCase()))) {
      return '***REDACTED***';
    }
    return value;
  }

  private async updateSnapshot(changeRecord: ChangeRecord): Promise<void> {
    const entityKey = this.getEntityKey(changeRecord.entityType, changeRecord.entityId);

    if (!this.entitySnapshots.has(entityKey)) {
      this.entitySnapshots.set(entityKey, new Map());
    }

    const snapshots = this.entitySnapshots.get(entityKey)!;

    // Apply changes to snapshot
    const currentSnapshot = snapshots.get('current') || {};
    const newSnapshot = { ...currentSnapshot };

    for (const change of changeRecord.changes) {
      if (change.changeType === 'removed') {
        delete newSnapshot[change.field];
      } else {
        newSnapshot[change.field] = change.newValue;
      }
    }

    // Store snapshot
    snapshots.set(changeRecord.id, { ...currentSnapshot });
    snapshots.set('current', newSnapshot);
  }

  private reconstructState(history: ChangeHistoryEntry[]): any {
    const state: any = {};

    for (const entry of history) {
      for (const change of entry.changes) {
        if (change.changeType === 'removed') {
          delete state[change.field];
        } else {
          state[change.field] = change.newValue;
        }
      }
    }

    return state;
  }

  private calculateDiff(
    oldChanges: Change[],
    newChanges: Change[]
  ): DiffResult {
    const changes: Change[] = [];
    let added = 0;
    let removed = 0;
    let modified = 0;

    // This is a simplified diff implementation
    // A real implementation would need to track actual field values

    for (const newChange of newChanges) {
      const oldChange = oldChanges.find(c => c.field === newChange.field);

      if (!oldChange) {
        changes.push({ ...newChange, changeType: 'added' });
        added++;
      } else if (JSON.stringify(oldChange.newValue) !== JSON.stringify(newChange.newValue)) {
        changes.push({
          field: newChange.field,
          oldValue: oldChange.newValue,
          newValue: newChange.newValue,
          changeType: 'modified'
        });
        modified++;
      }
    }

    for (const oldChange of oldChanges) {
      const newChange = newChanges.find(c => c.field === oldChange.field);

      if (!newChange) {
        changes.push({ ...oldChange, changeType: 'removed' });
        removed++;
      }
    }

    return {
      hasChanges: changes.length > 0,
      changes,
      added,
      removed,
      modified
    };
  }

  private findChangeRecord(changeId: string): ChangeRecord | null {
    for (const history of this.changeHistory.values()) {
      const entry = history.find(e => e.id === changeId);
      if (entry) {
        return this.convertFromHistoryEntry(entry);
      }
    }
    return null;
  }

  private convertFromHistoryEntry(entry: ChangeHistoryEntry): ChangeRecord {
    return {
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      changedBy: entry.changedBy,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: entry.entityName,
      changeType: entry.changeType,
      changes: entry.changes,
      reason: entry.reason,
      requestId: entry.requestId,
      rollbackId: entry.rollbackId
    };
  }

  private canRollbackChange(changeRecord: ChangeRecord): boolean {
    // Cannot rollback deletions
    if (changeRecord.changeType === 'deleted') {
      return false;
    }

    // Check if entity still exists
    const entityKey = this.getEntityKey(changeRecord.entityType, changeRecord.entityId);
    const history = this.changeHistory.get(entityKey);

    if (!history || history.length === 0) {
      return false;
    }

    // Check if there have been subsequent changes
    const lastEntry = history[history.length - 1];
    if (lastEntry.id !== changeRecord.id) {
      // There are newer changes - rollback might cause conflicts
      return false;
    }

    return true;
  }

  private estimateRollbackImpact(changeRecord: ChangeRecord): string[] {
    const impacts: string[] = [];

    impacts.push(`Reverting ${changeRecord.changes.length} changes to ${changeRecord.entityType}:${changeRecord.entityId}`);

    if (changeRecord.changeType === 'created') {
      impacts.push('Entity will be deleted');
    }

    return impacts;
  }

  private getRollbackPrerequisites(changeRecord: ChangeRecord): string[] {
    const prerequisites: string[] = [];

    if (changeRecord.changes.some(c => c.field.includes('foreign') || c.field.includes('reference'))) {
      prerequisites.push('Verify no dependent entities exist');
    }

    if (changeRecord.rollbackId) {
      prerequisites.push(`Previous rollback ${changeRecord.rollbackId} must be reverted first`);
    }

    return prerequisites;
  }

  private getReverseChangeType(changeType: Change['changeType']): Change['changeType'] {
    switch (changeType) {
      case 'added':
        return 'removed';
      case 'removed':
        return 'added';
      case 'modified':
        return 'modified';
      default:
        return changeType;
    }
  }

  private getSeverityForChangeType(changeType: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    switch (changeType) {
      case 'deleted':
        return 'high';
      case 'created':
        return 'low';
      case 'modified':
        return 'info';
      default:
        return 'info';
    }
  }

  private generateDescription(changeRecord: ChangeRecord): string {
    const changeTypeText = {
      created: 'Created',
      modified: 'Modified',
      deleted: 'Deleted',
      restored: 'Restored',
      archived: 'Archived'
    }[changeRecord.changeType];

    const fields = changeRecord.changes.map(c => c.field).join(', ');
    return `${changeTypeText} ${changeRecord.entityType}:${changeRecord.entityId} (${fields})`;
  }

  private getEntityKey(entityType: ResourceType, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  private exportAsCsv(history: ChangeHistoryEntry[]): string {
    const headers = [
      'id',
      'timestamp',
      'changedBy',
      'entityType',
      'entityId',
      'changeType',
      'fields',
      'reason'
    ];

    const rows = history.map(entry => [
      entry.id,
      entry.timestamp,
      entry.changedBy.name,
      entry.entityType,
      entry.entityId,
      entry.changeType,
      entry.changes.map(c => c.field).join(';'),
      entry.reason || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}

/**
 * Factory function to create change tracking system
 */
export function createChangeTrackingSystem(
  config?: Partial<ChangeTrackingConfig>
): ChangeTrackingSystem {
  return new ChangeTrackingSystem(config);
}

/**
 * Track changes to any object
 */
export function trackChanges<T extends Record<string, any>>(
  trackingSystem: ChangeTrackingSystem,
  entityType: ResourceType,
  entityId: string,
  entityName: string,
  oldState: T,
  newState: T,
  changedBy: { id: string; name: string; type: ActorType },
  reason?: string
): Promise<string> {
  const changes: Change[] = [];

  for (const key of Object.keys(newState)) {
    const oldValue = oldState[key];
    const newValue = newState[key];

    if (oldValue === undefined && newValue !== undefined) {
      changes.push({
        field: key,
        oldValue,
        newValue,
        changeType: 'added'
      });
    } else if (oldValue !== undefined && newValue === undefined) {
      changes.push({
        field: key,
        oldValue,
        newValue,
        changeType: 'removed'
      });
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field: key,
        oldValue,
        newValue,
        changeType: 'modified'
      });
    }
  }

  return trackingSystem.trackChange({
    changedBy,
    entityType,
    entityId,
    entityName,
    changeType: 'modified',
    changes,
    reason
  });
}
