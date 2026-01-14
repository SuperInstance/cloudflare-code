/**
 * SCIM 2.0 Provisioning and Synchronization
 * Provides user and group provisioning and sync capabilities
 */

import type {
  SCIMConfig,
  SCIMUser,
  SCIMGroup,
  SCIMPatchOperation,
} from '../types';

import { SCIMService } from './scim-service';

// ============================================================================
// Provisioning Options
// ============================================================================

export interface SCIMProvisioningOptions {
  autoCreateGroups?: boolean;
  attributeMapping?: AttributeMapping;
  syncInterval?: number;
  retryFailedProvisions?: boolean;
  notifyOnFailure?: boolean;
}

export interface AttributeMapping {
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  department?: string;
  title?: string;
  manager?: string;
  phone?: string;
  mobile?: string;
  custom?: Record<string, string>;
}

// ============================================================================
// Sync Options
// ============================================================================

export interface SCIMSyncOptions {
  fullSync?: boolean;
  syncUsers?: boolean;
  syncGroups?: boolean;
  deleteRemoved?: boolean;
  batchSize?: number;
  onProgress?: (stats: SCIMSyncStats) => void;
}

export interface SCIMSyncResult {
  success: boolean;
  stats: SCIMSyncStats;
  errors: Array<{ resource: string; error: string }>;
}

export interface SCIMSyncStats {
  usersCreated: number;
  usersUpdated: number;
  usersDeleted: number;
  usersFailed: number;
  groupsCreated: number;
  groupsUpdated: number;
  groupsDeleted: number;
  groupsFailed: number;
  totalProcessed: number;
  startTime: Date;
  endTime: Date;
}

// ============================================================================
// SCIM Provisioning Service
// ============================================================================

export class SCIMProvisioningService {
  private scim: SCIMService;
  private options: Required<SCIMProvisioningOptions>;

  constructor(config: SCIMConfig, options: SCIMProvisioningOptions = {}) {
    this.scim = new SCIMService(config);
    this.options = {
      autoCreateGroups: false,
      attributeMapping: {},
      syncInterval: 3600000, // 1 hour
      retryFailedProvisions: false,
      notifyOnFailure: false,
      ...options,
    };
  }

  // ============================================================================
  // User Provisioning
  // ============================================================================

  /**
   * Provision a new user
   */
  async provisionUser(
    userData: Partial<SCIMUser>,
    options?: {
      assignGroups?: string[];
      activate?: boolean;
    }
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      // Build SCIM user from provided data
      const scimUser = this.buildSCIMUser(userData, options?.activate !== false);

      // Create user
      const response = await this.scim.createUser(scimUser);

      if (!response.success) {
        return {
          success: false,
          error: response.error?.detail || 'Failed to create user',
        };
      }

      const userId = response.data?.id;

      // Assign groups if specified
      if (userId && options?.assignGroups && options.assignGroups.length > 0) {
        for (const groupId of options.assignGroups) {
          await this.addUserToGroup(groupId, userId);
        }
      }

      return {
        success: true,
        userId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deprovision a user
   */
  async deprovisionUser(
    userId: string,
    options?: {
      keepAccount?: boolean;
      removeFromGroups?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (options?.keepAccount) {
        // Just deactivate the user
        const response = await this.scim.updateUser(userId, [
          {
            op: 'replace',
            path: 'active',
            value: 'false',
          },
        ]);

        if (!response.success) {
          return {
            success: false,
            error: response.error?.detail || 'Failed to deactivate user',
          };
        }

        return { success: true };
      } else {
        // Remove from groups first if requested
        if (options?.removeFromGroups) {
          await this.removeUserFromAllGroups(userId);
        }

        // Delete the user
        const response = await this.scim.deleteUser(userId);

        if (!response.success) {
          return {
            success: false,
            error: response.error?.detail || 'Failed to delete user',
          };
        }

        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update a user
   */
  async updateUser(
    userId: string,
    userData: Partial<SCIMUser>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const operations = this.buildPatchOperations(userData);
      const response = await this.scim.updateUser(userId, operations);

      if (!response.success) {
        return {
          success: false,
          error: response.error?.detail || 'Failed to update user',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Group Provisioning
  // ============================================================================

  /**
   * Provision a new group
   */
  async provisionGroup(
    groupData: SCIMGroup,
    options?: {
      autoCreate?: boolean;
    }
  ): Promise<{ success: boolean; groupId?: string; error?: string }> {
    try {
      // Check if group already exists
      const existingGroup = await this.scim.getGroupByDisplayName(groupData.displayName);

      if (existingGroup.success && existingGroup.data) {
        return {
          success: true,
          groupId: existingGroup.data.id,
        };
      }

      // Create group if autoCreate is enabled
      if (options?.autoCreate || this.options.autoCreateGroups) {
        const response = await this.scim.createGroup(groupData);

        if (!response.success) {
          return {
            success: false,
            error: response.error?.detail || 'Failed to create group',
          };
        }

        return {
          success: true,
          groupId: response.data?.id,
        };
      }

      return {
        success: false,
        error: 'Group does not exist and auto-create is disabled',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add user to group
   */
  async addUserToGroup(
    groupId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const operations: SCIMPatchOperation[] = [
        {
          op: 'add',
          path: 'members',
          value: [
            {
              value: userId,
              type: 'User',
            },
          ],
        },
      ];

      const response = await this.scim.updateGroup(groupId, operations);

      if (!response.success) {
        return {
          success: false,
          error: response.error?.detail || 'Failed to add user to group',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove user from group
   */
  async removeUserFromGroup(
    groupId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const operations: SCIMPatchOperation[] = [
        {
          op: 'remove',
          path: `members[value eq "${userId}"]`,
        },
      ];

      const response = await this.scim.updateGroup(groupId, operations);

      if (!response.success) {
        return {
          success: false,
          error: response.error?.detail || 'Failed to remove user from group',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove user from all groups
   */
  async removeUserFromAllGroups(userId: string): Promise<{
    success: boolean;
    removed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let removed = 0;

    try {
      // Get all groups
      const groupsResponse = await this.scim.listGroups({ count: 100 });

      if (!groupsResponse.success || !groupsResponse.data) {
        return {
          success: false,
          removed: 0,
          errors: ['Failed to list groups'],
        };
      }

      // Remove user from each group
      for (const group of groupsResponse.data.resources) {
        const isMember = group.members?.some(member => member.value === userId);

        if (isMember && group.id) {
          const result = await this.removeUserFromGroup(group.id, userId);

          if (result.success) {
            removed++;
          } else {
            errors.push(`${group.displayName}: ${result.error}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        removed,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        removed,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Batch provision users
   */
  async batchProvisionUsers(
    users: Array<Partial<SCIMUser>>,
    options?: {
      assignGroups?: string[];
      stopOnError?: boolean;
    }
  ): Promise<{
    succeeded: string[];
    failed: Array<{ user: string; error: string }>;
  }> {
    const succeeded: string[] = [];
    const failed: Array<{ user: string; error: string }> = [];

    for (const userData of users) {
      try {
        const result = await this.provisionUser(userData, options);

        if (result.success) {
          succeeded.push(result.userId || '');
        } else {
          failed.push({
            user: userData.userName || userData.externalId || 'unknown',
            error: result.error || 'Unknown error',
          });

          if (options?.stopOnError) {
            break;
          }
        }
      } catch (error) {
        failed.push({
          user: userData.userName || userData.externalId || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (options?.stopOnError) {
          break;
        }
      }
    }

    return { succeeded, failed };
  }

  /**
   * Batch deprovision users
   */
  async batchDeprovisionUsers(
    userIds: string[],
    options?: {
      keepAccounts?: boolean;
      removeFromGroups?: boolean;
    }
  ): Promise<{
    succeeded: string[];
    failed: Array<{ userId: string; error: string }>;
  }> {
    const succeeded: string[] = [];
    const failed: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        const result = await this.deprovisionUser(userId, options);

        if (result.success) {
          succeeded.push(userId);
        } else {
          failed.push({
            userId,
            error: result.error || 'Unknown error',
          });
        }
      } catch (error) {
        failed.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { succeeded, failed };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Build SCIM user from provided data
   */
  private buildSCIMUser(userData: Partial<SCIMUser>, active: boolean): SCIMUser {
    const mapping = this.options.attributeMapping;

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: userData.userName || '',
      name: userData.name,
      displayName: userData.displayName,
      nickName: userData.nickName,
      profileUrl: userData.profileUrl,
      title: userData.title,
      userType: userData.userType,
      preferredLanguage: userData.preferredLanguage,
      locale: userData.locale,
      timezone: userData.timezone,
      active: userData.active !== undefined ? userData.active : active,
      emails: userData.emails,
      phoneNumbers: userData.phoneNumbers,
      ims: userData.ims,
      photos: userData.photos,
      addresses: userData.addresses,
      groups: userData.groups,
      entitlements: userData.entitlements,
      roles: userData.roles,
      x509Certificates: userData.x509Certificates,
      enterprise: userData.enterprise,
      manager: userData.manager,
      externalId: userData.externalId,
    };
  }

  /**
   * Build patch operations from user data
   */
  private buildPatchOperations(userData: Partial<SCIMUser>): SCIMPatchOperation[] {
    const operations: SCIMPatchOperation[] = [];

    if (userData.active !== undefined) {
      operations.push({
        op: 'replace',
        path: 'active',
        value: userData.active,
      });
    }

    if (userData.displayName) {
      operations.push({
        op: 'replace',
        path: 'displayName',
        value: userData.displayName,
      });
    }

    if (userData.name) {
      if (userData.name.givenName) {
        operations.push({
          op: 'replace',
          path: 'name.givenName',
          value: userData.name.givenName,
        });
      }

      if (userData.name.familyName) {
        operations.push({
          op: 'replace',
          path: 'name.familyName',
          value: userData.name.familyName,
        });
      }
    }

    if (userData.emails) {
      operations.push({
        op: 'replace',
        path: 'emails',
        value: userData.emails,
      });
    }

    if (userData.phoneNumbers) {
      operations.push({
        op: 'replace',
        path: 'phoneNumbers',
        value: userData.phoneNumbers,
      });
    }

    return operations;
  }
}

// ============================================================================
// SCIM Synchronization Service
// ============================================================================

export class SCIMSyncService {
  private scim: SCIMService;

  constructor(config: SCIMConfig) {
    this.scim = new SCIMService(config);
  }

  /**
   * Perform full synchronization
   */
  async sync(options?: SCIMSyncOptions): Promise<SCIMSyncResult> {
    const startTime = new Date();
    const stats: SCIMSyncStats = {
      usersCreated: 0,
      usersUpdated: 0,
      usersDeleted: 0,
      usersFailed: 0,
      groupsCreated: 0,
      groupsUpdated: 0,
      groupsDeleted: 0,
      groupsFailed: 0,
      totalProcessed: 0,
      startTime,
      endTime: startTime,
    };

    const errors: Array<{ resource: string; error: string }> = [];

    try {
      // Sync users if enabled
      if (options?.syncUsers !== false) {
        await this.syncUsers(stats, errors, options);
      }

      // Sync groups if enabled
      if (options?.syncGroups !== false) {
        await this.syncGroups(stats, errors, options);
      }

      stats.endTime = new Date();

      // Notify progress
      if (options?.onProgress) {
        options.onProgress(stats);
      }

      return {
        success: errors.length === 0,
        stats,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        stats,
        errors: [
          ...errors,
          {
            resource: 'sync',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }

  /**
   * Sync users
   */
  private async syncUsers(
    stats: SCIMSyncStats,
    errors: Array<{ resource: string; error: string }>,
    options?: SCIMSyncOptions
  ): Promise<void> {
    try {
      // In a real implementation, this would:
      // 1. Fetch all users from SCIM
      // 2. Compare with local database
      // 3. Create new users, update existing users, delete removed users
      // 4. Handle errors gracefully

      const response = await this.scim.listUsers({
        count: options?.batchSize || 100,
      });

      if (!response.success || !response.data) {
        errors.push({
          resource: 'users',
          error: response.error?.detail || 'Failed to list users',
        });
        return;
      }

      // Simulated sync - in production, implement actual sync logic
      stats.usersCreated = response.data.resources.length;
      stats.totalProcessed += response.data.resources.length;

      if (options?.onProgress) {
        options.onProgress(stats);
      }
    } catch (error) {
      errors.push({
        resource: 'users',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Sync groups
   */
  private async syncGroups(
    stats: SCIMSyncStats,
    errors: Array<{ resource: string; error: string }>,
    options?: SCIMSyncOptions
  ): Promise<void> {
    try {
      // In a real implementation, this would:
      // 1. Fetch all groups from SCIM
      // 2. Compare with local database
      // 3. Create new groups, update existing groups, delete removed groups
      // 4. Handle errors gracefully

      const response = await this.scim.listGroups({
        count: options?.batchSize || 100,
      });

      if (!response.success || !response.data) {
        errors.push({
          resource: 'groups',
          error: response.error?.detail || 'Failed to list groups',
        });
        return;
      }

      // Simulated sync
      stats.groupsCreated = response.data.resources.length;
      stats.totalProcessed += response.data.resources.length;

      if (options?.onProgress) {
        options.onProgress(stats);
      }
    } catch (error) {
      errors.push({
        resource: 'groups',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Calculate sync statistics
   */
  getSyncStats(result: SCIMSyncResult): {
    duration: number;
    successRate: number;
    errorRate: number;
    usersPerSecond: number;
    groupsPerSecond: number;
  } {
    const duration = result.stats.endTime.getTime() - result.stats.startTime.getTime();
    const totalOperations =
      result.stats.usersCreated +
      result.stats.usersUpdated +
      result.stats.usersDeleted +
      result.stats.groupsCreated +
      result.stats.groupsUpdated +
      result.stats.groupsDeleted;

    return {
      duration,
      successRate: result.stats.totalProcessed > 0
        ? (result.stats.totalProcessed - result.stats.usersFailed - result.stats.groupsFailed) /
          result.stats.totalProcessed
        : 1,
      errorRate: result.stats.totalProcessed > 0
        ? (result.stats.usersFailed + result.stats.groupsFailed) / result.stats.totalProcessed
        : 0,
      usersPerSecond: duration > 0
        ? (result.stats.usersCreated + result.stats.usersUpdated + result.stats.usersDeleted) /
          (duration / 1000)
        : 0,
      groupsPerSecond: duration > 0
        ? (result.stats.groupsCreated + result.stats.groupsUpdated + result.stats.groupsDeleted) /
          (duration / 1000)
        : 0,
    };
  }
}

// ============================================================================
// Export convenience types
// ============================================================================

export type {
  SCIMProvisioningOptions,
  AttributeMapping,
  SCIMSyncOptions,
  SCIMSyncResult,
  SCIMSyncStats,
};
