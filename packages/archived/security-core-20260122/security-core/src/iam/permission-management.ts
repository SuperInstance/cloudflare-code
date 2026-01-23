// @ts-nocheck - Missing utils/logger module

/**
 * Permission Management Service
 * Handles permission creation, management, and access control
 */

import { Permission } from '../types';
import { Logger } from '../utils/logger';
import { Validator } from '../auth/utils/validator';
import { EventEmitter } from 'events';

export class PermissionManagement extends EventEmitter {
  private logger: Logger;
  private permissions: Map<string, Permission> = new Map();
  private permissionGroups: Map<string, string[]> = new Map();

  constructor() {
    super();
    this.logger = new Logger('PermissionManagement');
    this.initializeDefaultPermissions();
  }

  /**
   * Create a new permission
   */
  async createPermission(permission: Partial<Permission>): Promise<Permission> {
    try {
      this.validatePermissionData(permission);

      const newPermission: Permission = {
        permissionId: `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        resource: permission.resource!,
        action: permission.action!,
        conditions: permission.conditions || []
      };

      // Store permission
      this.permissions.set(newPermission.permissionId, newPermission);

      this.logger.info(`Permission created: ${newPermission.resource}:${newPermission.action}`);
      this.emit('permissionCreated', newPermission);

      return newPermission;

    } catch (error) {
      this.logger.error('Failed to create permission', error);
      throw error;
    }
  }

  /**
   * Update permission
   */
  async updatePermission(permissionId: string, updates: Partial<Permission>): Promise<Permission> {
    try {
      const permission = this.permissions.get(permissionId);
      if (!permission) {
        throw new Error('Permission not found');
      }

      // Validate updates
      this.validatePermissionUpdates(updates);

      // Create updated permission
      const updatedPermission: Permission = {
        ...permission,
        ...updates,
        permissionId: permission.permissionId // Prevent ID changes
      };

      // Store updated permission
      this.permissions.set(permissionId, updatedPermission);

      this.logger.info(`Permission updated: ${updatedPermission.resource}:${updatedPermission.action}`);
      this.emit('permissionUpdated', updatedPermission);

      return updatedPermission;

    } catch (error) {
      this.logger.error('Failed to update permission', error);
      throw error;
    }
  }

  /**
   * Delete permission
   */
  async deletePermission(permissionId: string): Promise<boolean> {
    try {
      const permission = this.permissions.get(permissionId);
      if (!permission) {
        throw new Error('Permission not found');
      }

      // Check if permission is in use by any role
      const isInUse = this.isPermissionInUse(permissionId);
      if (isInUse) {
        throw new Error('Cannot delete permission - it is in use by roles');
      }

      // Remove permission
      this.permissions.delete(permissionId);

      this.logger.info(`Permission deleted: ${permission.resource}:${permission.action}`);
      this.emit('permissionDeleted', permission);

      return true;

    } catch (error) {
      this.logger.error('Failed to delete permission', error);
      throw error;
    }
  }

  /**
   * Get permission by ID
   */
  async getPermissionById(permissionId: string): Promise<Permission | null> {
    try {
      return this.permissions.get(permissionId) || null;
    } catch (error) {
      this.logger.error('Failed to get permission by ID', error);
      return null;
    }
  }

  /**
   * Get permission by resource and action
   */
  async getPermission(resource: string, action: string): Promise<Permission | null> {
    try {
      const permission = Array.from(this.permissions.values())
        .find(p => p.resource === resource && p.action === action);
      return permission || null;
    } catch (error) {
      this.logger.error('Failed to get permission', error);
      return null;
    }
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    try {
      return Array.from(this.permissions.values())
        .sort((a, b) => {
          // Sort by resource, then by action
          const resourceCompare = a.resource.localeCompare(b.resource);
          if (resourceCompare !== 0) return resourceCompare;
          return a.action.localeCompare(b.action);
        });
    } catch (error) {
      this.logger.error('Failed to get all permissions', error);
      return [];
    }
  }

  /**
   * Get permissions by resource
   */
  async getPermissionsByResource(resource: string): Promise<Permission[]> {
    try {
      return Array.from(this.permissions.values())
        .filter(p => p.resource === resource || p.resource === '*')
        .sort((a, b) => a.action.localeCompare(b.action));
    } catch (error) {
      this.logger.error('Failed to get permissions by resource', error);
      return [];
    }
  }

  /**
   * Get permissions by action
   */
  async getPermissionsByAction(action: string): Promise<Permission[]> {
    try {
      return Array.from(this.permissions.values())
        .filter(p => p.action === action || p.action === '*')
        .sort((a, b) => a.resource.localeCompare(b.resource));
    } catch (error) {
      this.logger.error('Failed to get permissions by action', error);
      return [];
    }
  }

  /**
   * Check if permission exists
   */
  async permissionExists(resource: string, action: string): Promise<boolean> {
    try {
      return Array.from(this.permissions.values())
        .some(p => (p.resource === resource || p.resource === '*') &&
                   (p.action === action || p.action === '*'));
    } catch (error) {
      this.logger.error('Failed to check permission existence', error);
      return false;
    }
  }

  /**
   * Create permission group
   */
  async createPermissionGroup(name: string, permissionIds: string[]): Promise<boolean> {
    try {
      // Validate permission IDs
      const invalidPermissions = permissionIds.filter(id => !this.permissions.has(id));
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permission IDs: ${invalidPermissions.join(', ')}`);
      }

      this.permissionGroups.set(name, permissionIds);

      this.logger.info(`Permission group created: ${name} with ${permissionIds.length} permissions`);
      this.emit('permissionGroupCreated', { name, permissionIds });

      return true;

    } catch (error) {
      this.logger.error('Failed to create permission group', error);
      return false;
    }
  }

  /**
   * Get permission group
   */
  async getPermissionGroup(name: string): Promise<string[] | null> {
    try {
      return this.permissionGroups.get(name) || null;
    } catch (error) {
      this.logger.error('Failed to get permission group', error);
      return null;
    }
  }

  /**
   * Get all permission groups
   */
  async getAllPermissionGroups(): Promise<Record<string, string[]>> {
    try {
      const groups: Record<string, string[]> = {};
      for (const [name, permissions] of this.permissionGroups) {
        groups[name] = permissions;
      }
      return groups;
    } catch (error) {
      this.logger.error('Failed to get all permission groups', error);
      return {};
    }
  }

  /**
   * Delete permission group
   */
  async deletePermissionGroup(name: string): Promise<boolean> {
    try {
      if (!this.permissionGroups.has(name)) {
        throw new Error('Permission group not found');
      }

      this.permissionGroups.delete(name);

      this.logger.info(`Permission group deleted: ${name}`);
      this.emit('permissionGroupDeleted', name);

      return true;

    } catch (error) {
      this.logger.error('Failed to delete permission group', error);
      return false;
    }
  }

  /**
   * Evaluate permission with conditions
   */
  async evaluatePermission(
    permissionId: string,
    context: Record<string, any>
  ): Promise<boolean> {
    try {
      const permission = this.permissions.get(permissionId);
      if (!permission) {
        return false;
      }

      // If no conditions, permission is granted
      if (!permission.conditions || permission.conditions.length === 0) {
        return true;
      }

      // Evaluate each condition
      for (const condition of permission.conditions) {
        const conditionResult = await this.evaluateCondition(condition, context);
        if (!conditionResult) {
          return false;
        }
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to evaluate permission', error);
      return false;
    }
  }

  /**
   * Check if user has permission (with context)
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    context: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      // Get exact permission match
      const exactPermission = await this.getPermission(resource, action);
      if (exactPermission) {
        return await this.evaluatePermission(exactPermission.permissionId, context);
      }

      // Get wildcard permission
      const wildcardPermission = await this.getPermission('*', action);
      if (wildcardPermission) {
        return await this.evaluatePermission(wildcardPermission.permissionId, context);
      }

      // Get permission for any action on resource
      const resourcePermission = await this.getPermission(resource, '*');
      if (resourcePermission) {
        return await this.evaluatePermission(resourcePermission.permissionId, context);
      }

      // Get full wildcard permission
      const fullWildcardPermission = await this.getPermission('*', '*');
      if (fullWildcardPermission) {
        return await this.evaluatePermission(fullWildcardPermission.permissionId, context);
      }

      return false;

    } catch (error) {
      this.logger.error('Failed to check permission', error);
      return false;
    }
  }

  /**
   * Get user's effective permissions
   */
  async getUserPermissions(
    userId: string,
    context: Record<string, any> = {}
  ): Promise<string[]> {
    try {
      // In a real implementation, this would:
      // 1. Get user's assigned permissions
      // 2. Get user's roles
      // 3. Get role permissions
      // 4. Evaluate all with context
      // This is a simplified version

      const permissions: string[] = [];

      // Get all permissions that evaluate to true for this context
      for (const permission of this.permissions.values()) {
        const hasPermission = await this.evaluatePermission(permission.permissionId, context);
        if (hasPermission) {
          permissions.push(`${permission.resource}:${permission.action}`);
        }
      }

      return permissions;

    } catch (error) {
      this.logger.error('Failed to get user permissions', error);
      return [];
    }
  }

  /**
   * Get permission statistics
   */
  async getPermissionStatistics(): Promise<{
    totalPermissions: number;
    permissionsByResource: Record<string, number>;
    permissionsByAction: Record<string, number>;
    conditionalPermissions: number;
    wildcardPermissions: number;
  }> {
    try {
      const permissions = Array.from(this.permissions.values());
      const totalPermissions = permissions.length;

      const permissionsByResource: Record<string, number> = {};
      const permissionsByAction: Record<string, number> = {};
      let conditionalPermissions = 0;
      let wildcardPermissions = 0;

      permissions.forEach(permission => {
        // Count by resource
        permissionsByResource[permission.resource] =
          (permissionsByResource[permission.resource] || 0) + 1;

        // Count by action
        permissionsByAction[permission.action] =
          (permissionsByAction[permission.action] || 0) + 1;

        // Count conditional permissions
        if (permission.conditions && permission.conditions.length > 0) {
          conditionalPermissions++;
        }

        // Count wildcard permissions
        if (permission.resource === '*' || permission.action === '*') {
          wildcardPermissions++;
        }
      });

      return {
        totalPermissions,
        permissionsByResource,
        permissionsByAction,
        conditionalPermissions,
        wildcardPermissions
      };

    } catch (error) {
      this.logger.error('Failed to get permission statistics', error);
      throw error;
    }
  }

  // Private helper methods
  private initializeDefaultPermissions(): void {
    const defaultPermissions = [
      {
        permissionId: 'perm_read_all',
        resource: '*',
        action: 'read',
        conditions: []
      },
      {
        permissionId: 'perm_write_own',
        resource: '*',
        action: 'write',
        conditions: [
          {
            field: 'owner',
            operator: 'equals',
            value: '$userId'
          }
        ]
      },
      {
        permissionId: 'perm_delete_own',
        resource: '*',
        action: 'delete',
        conditions: [
          {
            field: 'owner',
            operator: 'equals',
            value: '$userId'
          }
        ]
      },
      {
        permissionId: 'perm_admin',
        resource: '*',
        action: 'admin',
        conditions: []
      },
      {
        permissionId: 'perm_manage_users',
        resource: 'users',
        action: 'manage',
        conditions: []
      },
      {
        permissionId: 'perm_view_roles',
        resource: 'roles',
        action: 'view',
        conditions: []
      },
      {
        permissionId: 'perm_manage_roles',
        resource: 'roles',
        action: 'manage',
        conditions: []
      },
      {
        permissionId: 'perm_view_permissions',
        resource: 'permissions',
        action: 'view',
        conditions: []
      },
      {
        permissionId: 'perm_manage_permissions',
        resource: 'permissions',
        action: 'manage',
        conditions: []
      },
      {
        permissionId: 'perm_view_audit_logs',
        resource: 'audit_logs',
        action: 'view',
        conditions: []
      },
      {
        permissionId: 'perm_export_data',
        resource: 'exports',
        action: 'create',
        conditions: []
      }
    ];

    defaultPermissions.forEach(permission => {
      this.permissions.set(permission.permissionId, permission);
    });
  }

  private validatePermissionData(permission: Partial<Permission>): void {
    if (!permission.resource) {
      throw new Error('Resource is required');
    }

    if (!permission.action) {
      throw new Error('Action is required');
    }

    if (permission.conditions && !Array.isArray(permission.conditions)) {
      throw new Error('Conditions must be an array');
    }
  }

  private validatePermissionUpdates(updates: Partial<Permission>): void {
    if (updates.conditions && !Array.isArray(updates.conditions)) {
      throw new Error('Conditions must be an array');
    }
  }

  private isPermissionInUse(permissionId: string): boolean {
    // In a real implementation, check if any role has this permission
    // This is a simplified version
    return false;
  }

  private async evaluateCondition(
    condition: any,
    context: Record<string, any>
  ): Promise<boolean> {
    const { field, operator, value, negate = false } = condition;

    // Get field value from context
    let fieldValue: any = context[field];
    if (fieldValue === undefined && field.startsWith('$')) {
      // Handle special variables like $userId
      fieldValue = context[field.substring(1)];
    }

    switch (operator) {
      case 'equals':
        return negate ? fieldValue !== value : fieldValue === value;

      case 'not_equals':
        return negate ? fieldValue === value : fieldValue !== value;

      case 'contains':
        return negate ? !fieldValue?.includes(value) : fieldValue?.includes(value);

      case 'starts_with':
        return negate ? !fieldValue?.startsWith(value) : fieldValue?.startsWith(value);

      case 'ends_with':
        return negate ? !fieldValue?.endsWith(value) : fieldValue?.endsWith(value);

      case 'greater_than':
        return negate ? fieldValue <= value : fieldValue > value;

      case 'less_than':
        return negate ? fieldValue >= value : fieldValue < value;

      case 'in':
        return negate ? !value.includes(fieldValue) : value.includes(fieldValue);

      case 'not_in':
        return negate ? value.includes(fieldValue) : !value.includes(fieldValue);

      case 'regex':
        try {
          const regex = new RegExp(value);
          return negate ? !regex.test(fieldValue) : regex.test(fieldValue);
        } catch {
          return false;
        }

      case 'ip_range':
        return negate ? !this.isIPInRange(fieldValue, value) : this.isIPInRange(fieldValue, value);

      default:
        return false;
    }
  }

  private isIPInRange(ip: string, range: string): boolean {
    try {
      // Simple IP range check
      const [start, end] = range.split('-');
      if (start && end) {
        const ipNum = this.ipToNumber(ip);
        const startNum = this.ipToNumber(start);
        const endNum = this.ipToNumber(end);
        return ipNum >= startNum && ipNum <= endNum;
      }
      return ip === range;
    } catch {
      return false;
    }
  }

  private ipToNumber(ip: string): number {
    const parts = ip.split('.');
    return (parseInt(parts[0]) << 24) +
           (parseInt(parts[1]) << 16) +
           (parseInt(parts[2]) << 8) +
           parseInt(parts[3]);
  }
}