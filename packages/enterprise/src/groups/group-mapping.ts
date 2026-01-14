/**
 * Group and Role Mapping Service
 * Handles mapping of external groups/roles to internal ones
 */

import type {
  GroupMappingConfig,
  GroupMapping,
  RoleMapping,
  RoleAssignment,
  RoleCondition,
  GroupSyncResult,
} from '../types';

// ============================================================================
// Mapping Service Options
// ============================================================================

export interface GroupMappingServiceOptions {
  autoCreateGroups?: boolean;
  preserveManualAssignments?: boolean;
  syncInterval?: number;
  validationEnabled?: boolean;
}

// ============================================================================
// Group Mapping Service
// ============================================================================

export class GroupMappingService {
  private config: GroupMappingConfig;
  private options: Required<GroupMappingServiceOptions>;
  private mappingsCache: Map<string, GroupMapping>;
  private roleAssignmentsCache: Map<string, RoleAssignment[]>;

  constructor(config: GroupMappingConfig, options: GroupMappingServiceOptions = {}) {
    this.config = config;
    this.options = {
      autoCreateGroups: true,
      preserveManualAssignments: true,
      syncInterval: 3600000, // 1 hour
      validationEnabled: true,
      ...options,
    };

    this.mappingsCache = new Map();
    this.roleAssignmentsCache = new Map();

    // Initialize cache with configured mappings
    for (const mapping of config.mappings) {
      this.mappingsCache.set(mapping.sourceGroup, mapping);
    }
  }

  // ============================================================================
  // Group Mapping Methods
  // ============================================================================

  /**
   * Map external group to internal group
   */
  mapGroup(sourceGroup: string): string | null {
    const mapping = this.mappingsCache.get(sourceGroup);

    if (!mapping) {
      // If auto-create is enabled, return the source group as-is
      if (this.options.autoCreateGroups) {
        return sourceGroup;
      }
      return null;
    }

    return mapping.targetGroup;
  }

  /**
   * Reverse map internal group to external group
   */
  reverseMapGroup(targetGroup: string): string[] {
    const sourceGroups: string[] = [];

    for (const [sourceGroup, mapping] of this.mappingsCache.entries()) {
      if (mapping.targetGroup === targetGroup) {
        sourceGroups.push(sourceGroup);
      }
    }

    return sourceGroups;
  }

  /**
   * Add a group mapping
   */
  addGroupMapping(mapping: GroupMapping): void {
    this.mappingsCache.set(mapping.sourceGroup, mapping);
  }

  /**
   * Remove a group mapping
   */
  removeGroupMapping(sourceGroup: string): boolean {
    return this.mappingsCache.delete(sourceGroup);
  }

  /**
   * Get all group mappings
   */
  getGroupMappings(): GroupMapping[] {
    return Array.from(this.mappingsCache.values());
  }

  /**
   * Get group mapping by source group
   */
  getGroupMapping(sourceGroup: string): GroupMapping | undefined {
    return this.mappingsCache.get(sourceGroup);
  }

  /**
   * Update group mapping
   */
  updateGroupMapping(sourceGroup: string, updates: Partial<GroupMapping>): boolean {
    const mapping = this.mappingsCache.get(sourceGroup);

    if (!mapping) {
      return false;
    }

    const updated = {
      ...mapping,
      ...updates,
    };

    this.mappingsCache.set(sourceGroup, updated);
    return true;
  }

  /**
   * Map multiple groups
   */
  mapGroups(sourceGroups: string[]): string[] {
    const mappedGroups: string[] = [];

    for (const sourceGroup of sourceGroups) {
      const targetGroup = this.mapGroup(sourceGroup);

      if (targetGroup) {
        mappedGroups.push(targetGroup);
      }
    }

    return [...new Set(mappedGroups)]; // Remove duplicates
  }

  // ============================================================================
  // Role Mapping Methods
  // ============================================================================

  /**
   * Map external role to internal role
   */
  mapRole(sourceRole: string, context?: Record<string, any>): string[] {
    const mappedRoles: string[] = [];

    // Find matching role mappings
    for (const groupMapping of this.mappingsCache.values()) {
      if (groupMapping.roleMappings) {
        for (const roleMapping of groupMapping.roleMappings) {
          if (roleMapping.sourceRole === sourceRole) {
            // Check if conditions are met
            if (this.evaluateRoleConditions(roleMapping.conditions || [], context)) {
              mappedRoles.push(roleMapping.targetRole);
            }
          }
        }
      }
    }

    return mappedRoles.length > 0 ? mappedRoles : [sourceRole];
  }

  /**
   * Assign role to user
   */
  assignRoleToUser(
    userId: string,
    roleId: string,
    options?: {
      source?: string;
      sourceId?: string;
      expiresAt?: Date;
      conditions?: RoleCondition[];
    }
  ): RoleAssignment {
    const assignment: RoleAssignment = {
      userId,
      roleId,
      source: options?.source || 'manual',
      sourceId: options?.sourceId,
      expiresAt: options?.expiresAt,
      conditions: options?.conditions,
    };

    // Add to cache
    if (!this.roleAssignmentsCache.has(userId)) {
      this.roleAssignmentsCache.set(userId, []);
    }

    this.roleAssignmentsCache.get(userId)!.push(assignment);

    return assignment;
  }

  /**
   * Revoke role from user
   */
  revokeRoleFromUser(userId: string, roleId: string): boolean {
    const assignments = this.roleAssignmentsCache.get(userId);

    if (!assignments) {
      return false;
    }

    const initialLength = assignments.length;
    const filtered = assignments.filter(a => a.roleId !== roleId);

    if (filtered.length < initialLength) {
      this.roleAssignmentsCache.set(userId, filtered);
      return true;
    }

    return false;
  }

  /**
   * Get user roles
   */
  getUserRoles(userId: string): RoleAssignment[] {
    const assignments = this.roleAssignmentsCache.get(userId) || [];

    // Filter expired assignments
    const now = new Date();
    const validAssignments = assignments.filter(
      a => !a.expiresAt || a.expiresAt > now
    );

    // Update cache with filtered assignments
    if (validAssignments.length < assignments.length) {
      this.roleAssignmentsCache.set(userId, validAssignments);
    }

    return validAssignments;
  }

  /**
   * Check if user has role
   */
  userHasRole(userId: string, roleId: string): boolean {
    const assignments = this.getUserRoles(userId);
    return assignments.some(a => a.roleId === roleId);
  }

  /**
   * Get all role assignments for a role
   */
  getRoleAssignments(roleId: string): RoleAssignment[] {
    const allAssignments: RoleAssignment[] = [];

    for (const assignments of this.roleAssignmentsCache.values()) {
      for (const assignment of assignments) {
        if (assignment.roleId === roleId) {
          allAssignments.push(assignment);
        }
      }
    }

    return allAssignments;
  }

  // ============================================================================
  // Synchronization Methods
  // ============================================================================

  /**
   * Sync groups from external source
   */
  async syncGroups(sourceGroups: Array<{
    name: string;
    members?: string[];
    attributes?: Record<string, any>;
  }>): Promise<GroupSyncResult> {
    const result: GroupSyncResult = {
      success: true,
      added: 0,
      updated: 0,
      removed: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Track current groups
      const processedGroups = new Set<string>();

      // Process each source group
      for (const sourceGroup of sourceGroups) {
        try {
          processedGroups.add(sourceGroup.name);

          const targetGroup = this.mapGroup(sourceGroup.name);

          if (!targetGroup) {
            result.failed++;
            result.errors.push({
              group: sourceGroup.name,
              error: 'No mapping found and auto-create is disabled',
            });
            continue;
          }

          // Check if group exists
          const exists = await this.groupExists(targetGroup);

          if (!exists) {
            // Create group
            await this.createGroup(targetGroup, sourceGroup);
            result.added++;
          } else {
            // Update group
            await this.updateGroup(targetGroup, sourceGroup);
            result.updated++;
          }

          // Sync members if provided
          if (sourceGroup.members) {
            await this.syncGroupMembers(targetGroup, sourceGroup.members);
          }
        } catch (error) {
          result.failed++;
          result.errors.push({
            group: sourceGroup.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Remove groups that no longer exist in source (if not preserving manual assignments)
      if (!this.options.preserveManualAssignments) {
        const existingGroups = await this.listGroups();

        for (const existingGroup of existingGroups) {
          const sourceGroups = this.reverseMapGroup(existingGroup);

          // Check if any source group still exists
          const stillExists = sourceGroups.some(sg => processedGroups.has(sg));

          if (!stillExists && sourceGroups.length > 0) {
            try {
              await this.deleteGroup(existingGroup);
              result.removed++;
            } catch (error) {
              result.failed++;
              result.errors.push({
                group: existingGroup,
                error: error instanceof Error ? error.message : 'Failed to delete group',
              });
            }
          }
        }
      }

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        group: 'sync',
        error: error instanceof Error ? error.message : 'Sync failed',
      });
      return result;
    }
  }

  /**
   * Sync user group memberships
   */
  async syncUserGroupMemberships(
    userId: string,
    sourceGroups: string[],
    context?: Record<string, any>
  ): Promise<{
    added: string[];
    removed: string[];
    errors: string[];
  }> {
    const added: string[] = [];
    const removed: string[] = [];
    const errors: string[] = [];

    try {
      // Get current user groups
      const currentGroups = await this.getUserGroupMemberships(userId);

      // Map source groups to target groups
      const targetGroups = this.mapGroups(sourceGroups);

      // Determine which groups to add
      for (const targetGroup of targetGroups) {
        if (!currentGroups.includes(targetGroup)) {
          try {
            await this.addUserToGroup(userId, targetGroup);
            added.push(targetGroup);
          } catch (error) {
            errors.push(`Failed to add to ${targetGroup}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Determine which groups to remove (if not preserving manual assignments)
      if (!this.options.preserveManualAssignments) {
        for (const currentGroup of currentGroups) {
          if (!targetGroups.includes(currentGroup)) {
            const sourceGroups = this.reverseMapGroup(currentGroup);

            // Only remove if this group was mapped (not manually assigned)
            if (sourceGroups.length > 0) {
              try {
                await this.removeUserFromGroup(userId, currentGroup);
                removed.push(currentGroup);
              } catch (error) {
                errors.push(`Failed to remove from ${currentGroup}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          }
        }
      }

      return { added, removed, errors };
    } catch (error) {
      errors.push(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { added, removed, errors };
    }
  }

  // ============================================================================
  // Role Condition Evaluation
  // ============================================================================

  /**
   * Evaluate role conditions
   */
  private evaluateRoleConditions(
    conditions: RoleCondition[],
    context?: Record<string, any>
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    if (!context) {
      return false;
    }

    // All conditions must be met
    for (const condition of conditions) {
      const fieldValue = this.getContextValue(context, condition.field);
      const conditionMet = this.evaluateCondition(fieldValue, condition.operator, condition.value);

      if (!conditionMet) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    fieldValue: any,
    operator: string,
    conditionValue: any
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue;

      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(conditionValue);

      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);

      case 'notIn':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);

      default:
        return false;
    }
  }

  /**
   * Get value from context by field path
   */
  private getContextValue(context: Record<string, any>, field: string): any {
    const fieldPath = field.split('.');

    let value: any = context;

    for (const key of fieldPath) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return value;
  }

  // ============================================================================
  // Abstract Methods (to be implemented by concrete class)
  // ============================================================================

  /**
   * Check if group exists
   */
  protected async groupExists(groupName: string): Promise<boolean> {
    // To be implemented by concrete class
    return false;
  }

  /**
   * Create group
   */
  protected async createGroup(
    groupName: string,
    sourceGroup: { name: string; members?: string[]; attributes?: Record<string, any> }
  ): Promise<void> {
    // To be implemented by concrete class
  }

  /**
   * Update group
   */
  protected async updateGroup(
    groupName: string,
    sourceGroup: { name: string; members?: string[]; attributes?: Record<string, any> }
  ): Promise<void> {
    // To be implemented by concrete class
  }

  /**
   * Delete group
   */
  protected async deleteGroup(groupName: string): Promise<void> {
    // To be implemented by concrete class
  }

  /**
   * List all groups
   */
  protected async listGroups(): Promise<string[]> {
    // To be implemented by concrete class
    return [];
  }

  /**
   * Get user group memberships
   */
  protected async getUserGroupMemberships(userId: string): Promise<string[]> {
    // To be implemented by concrete class
    return [];
  }

  /**
   * Add user to group
   */
  protected async addUserToGroup(userId: string, groupName: string): Promise<void> {
    // To be implemented by concrete class
  }

  /**
   * Remove user from group
   */
  protected async removeUserFromGroup(userId: string, groupName: string): Promise<void> {
    // To be implemented by concrete class
  }

  /**
   * Sync group members
   */
  protected async syncGroupMembers(groupName: string, members: string[]): Promise<void> {
    // To be implemented by concrete class
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Clear cache
   */
  clearCache(): void {
    this.mappingsCache.clear();
    this.roleAssignmentsCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    groupMappings: number;
    roleAssignments: number;
    usersWithAssignments: number;
  } {
    return {
      groupMappings: this.mappingsCache.size,
      roleAssignments: Array.from(this.roleAssignmentsCache.values()).reduce(
        (sum, assignments) => sum + assignments.length,
        0
      ),
      usersWithAssignments: this.roleAssignmentsCache.size,
    };
  }

  /**
   * Export configuration
   */
  exportConfig(): GroupMappingConfig {
    return {
      ...this.config,
      mappings: Array.from(this.mappingsCache.values()),
    };
  }
}

// ============================================================================
// Export convenience types
// ============================================================================

export type {
  GroupMappingConfig,
  GroupMapping,
  RoleMapping,
  RoleAssignment,
  RoleCondition,
  GroupSyncResult,
  GroupMappingServiceOptions,
};
