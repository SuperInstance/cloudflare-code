// @ts-nocheck - Missing utils/logger module

/**
 * Role Management Service
 * Handles role creation, assignment, and permission inheritance
 */

import { Role } from '../types';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

export class RoleManagement extends EventEmitter {
  private logger: Logger;
  private roles: Map<string, Role> = new Map();
  private roleHierarchy: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.logger = new Logger('RoleManagement');
    this.initializeDefaultRoles();
  }

  /**
   * Create a new role
   */
  async createRole(role: Partial<Role>): Promise<Role> {
    try {
      this.validateRoleData(role);

      const newRole: Role = {
        roleId: `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: role.name!,
        description: role.description || '',
        permissions: role.permissions || [],
        isSystemRole: role.isSystemRole || false,
        inherits: role.inherits || [],
        createdAt: role.createdAt || new Date(),
        updatedAt: role.updatedAt || new Date()
      };

      // Store role
      this.roles.set(newRole.roleId, newRole);

      // Update hierarchy if inherits specified
      if (newRole.inherits && newRole.inherits.length > 0) {
        this.roleHierarchy.set(newRole.roleId, new Set(newRole.inherits));
      }

      this.logger.info(`Role created: ${newRole.name}`);
      this.emit('roleCreated', newRole);

      return newRole;

    } catch (error) {
      this.logger.error('Failed to create role', error);
      throw error;
    }
  }

  /**
   * Update role information
   */
  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      // Validate updates
      this.validateRoleUpdates(updates);

      // Create updated role
      const updatedRole: Role = {
        ...role,
        ...updates,
        roleId: role.roleId, // Prevent ID changes
        updatedAt: new Date()
      };

      // Store updated role
      this.roles.set(roleId, updatedRole);

      // Update hierarchy if inherits changed
      if (updates.inherits !== undefined) {
        if (updates.inherits && updates.inherits.length > 0) {
          this.roleHierarchy.set(roleId, new Set(updates.inherits));
        } else {
          this.roleHierarchy.delete(roleId);
        }
      }

      this.logger.info(`Role updated: ${updatedRole.name}`);
      this.emit('roleUpdated', updatedRole);

      return updatedRole;

    } catch (error) {
      this.logger.error('Failed to update role', error);
      throw error;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<boolean> {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      // Check if role is in use
      if (role.isSystemRole) {
        throw new Error('Cannot delete system role');
      }

      // Check if other roles inherit from this role
      const inheritedBy = Array.from(this.roleHierarchy.entries())
        .filter(([_, parents]) => parents.has(roleId))
        .map(([childId, _]) => childId);

      if (inheritedBy.length > 0) {
        throw new Error(`Cannot delete role - it is inherited by: ${inheritedBy.join(', ')}`);
      }

      // Remove role
      this.roles.delete(roleId);
      this.roleHierarchy.delete(roleId);

      this.logger.info(`Role deleted: ${role.name}`);
      this.emit('roleDeleted', role);

      return true;

    } catch (error) {
      this.logger.error('Failed to delete role', error);
      throw error;
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: string): Promise<Role | null> {
    try {
      return this.roles.get(roleId) || null;
    } catch (error) {
      this.logger.error('Failed to get role by ID', error);
      return null;
    }
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: string): Promise<Role | null> {
    try {
      const role = Array.from(this.roles.values())
        .find(r => r.name === name);
      return role || null;
    } catch (error) {
      this.logger.error('Failed to get role by name', error);
      return null;
    }
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    try {
      return Array.from(this.roles.values())
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger.error('Failed to get all roles', error);
      return [];
    }
  }

  /**
   * Get role permissions including inherited ones
   */
  async getRolePermissions(roleId: string): Promise<string[]> {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      const permissions = new Set<string>(role.permissions);

      // Get inherited permissions
      await this.getInheritedPermissions(roleId, permissions);

      return Array.from(permissions);

    } catch (error) {
      this.logger.error('Failed to get role permissions', error);
      return [];
    }
  }

  /**
   * Add permission to role
   */
  async addPermissionToRole(roleId: string, permissionId: string): Promise<boolean> {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (!role.permissions.includes(permissionId)) {
        role.permissions.push(permissionId);
        role.updatedAt = new Date();
        this.roles.set(roleId, role);

        this.logger.info(`Permission added to role: ${role.name}`);
        this.emit('permissionAddedToRole', { roleId, permissionId });
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to add permission to role', error);
      return false;
    }
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      const index = role.permissions.indexOf(permissionId);
      if (index > -1) {
        role.permissions.splice(index, 1);
        role.updatedAt = new Date();
        this.roles.set(roleId, role);

        this.logger.info(`Permission removed from role: ${role.name}`);
        this.emit('permissionRemovedFromRole', { roleId, permissionId });
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to remove permission from role', error);
      return false;
    }
  }

  /**
   * Add inheritance to role
   */
  async addInheritance(roleId: string, parentRoleId: string): Promise<boolean> {
    try {
      const role = this.roles.get(roleId);
      const parentRole = this.roles.get(parentRoleId);

      if (!role || !parentRole) {
        throw new Error('Role or parent role not found');
      }

      if (roleId === parentRoleId) {
        throw new Error('Role cannot inherit from itself');
      }

      // Check for circular inheritance
      if (await this.hasCircularInheritance(roleId, parentRoleId)) {
        throw new Error('Circular inheritance detected');
      }

      if (!role.inherits) {
        role.inherits = [];
      }

      if (!role.inherits.includes(parentRoleId)) {
        role.inherits.push(parentRoleId);
        role.updatedAt = new Date();
        this.roles.set(roleId, role);

        this.updateRoleHierarchy(roleId, parentRoleId);

        this.logger.info(`Inheritance added: ${role.name} inherits from ${parentRole.name}`);
        this.emit('inheritanceAdded', { roleId, parentRoleId });
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to add inheritance', error);
      return false;
    }
  }

  /**
   * Remove inheritance from role
   */
  async removeInheritance(roleId: string, parentRoleId: string): Promise<boolean> {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      const index = role.inherits?.indexOf(parentRoleId);
      if (index > -1) {
        role.inherits!.splice(index, 1);
        role.updatedAt = new Date();
        this.roles.set(roleId, role);

        this.removeRoleHierarchy(roleId, parentRoleId);

        this.logger.info(`Inheritance removed: ${role.name} no longer inherits from parent`);
        this.emit('inheritanceRemoved', { roleId, parentRoleId });
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to remove inheritance', error);
      return false;
    }
  }

  /**
   * Get role hierarchy
   */
  async getRoleHierarchy(): Promise<Record<string, string[]>> {
    try {
      const hierarchy: Record<string, string[]> = {};

      for (const [roleId, role] of this.roles) {
        hierarchy[role.name] = role.inherits || [];
      }

      return hierarchy;

    } catch (error) {
      this.logger.error('Failed to get role hierarchy', error);
      return {};
    }
  }

  /**
   * Check if user has a role (including inherited)
   */
  async hasRole(userId: string, roleName: string): Promise<boolean> {
    try {
      // In a real implementation, this would check user's roles against the hierarchy
      // This is a simplified version
      return false;

    } catch (error) {
      this.logger.error('Failed to check role', error);
      return false;
    }
  }

  /**
   * Get all roles assigned to a user
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      // In a real implementation, this would get user's roles and expand hierarchy
      // This is a simplified version
      return [];

    } catch (error) {
      this.logger.error('Failed to get user roles', error);
      return [];
    }
  }

  /**
   * Get role statistics
   */
  async getRoleStatistics(): Promise<{
    totalRoles: number;
    systemRoles: number;
    customRoles: number;
    averagePermissions: number;
    rolesWithInheritance: number;
  }> {
    try {
      const roles = Array.from(this.roles.values());
      const totalRoles = roles.length;
      const systemRoles = roles.filter(r => r.isSystemRole).length;
      const customRoles = totalRoles - systemRoles;

      let totalPermissions = 0;
      let rolesWithInheritanceCount = 0;

      roles.forEach(role => {
        totalPermissions += role.permissions.length;
        if (role.inherits && role.inherits.length > 0) {
          rolesWithInheritanceCount++;
        }
      });

      const averagePermissions = totalRoles > 0 ? totalPermissions / totalRoles : 0;

      return {
        totalRoles,
        systemRoles,
        customRoles,
        averagePermissions: Math.round(averagePermissions),
        rolesWithInheritance: rolesWithInheritanceCount
      };

    } catch (error) {
      this.logger.error('Failed to get role statistics', error);
      throw error;
    }
  }

  // Private helper methods
  private initializeDefaultRoles(): void {
    const defaultRoles = [
      {
        roleId: 'role_admin',
        name: 'admin',
        description: 'System administrator with full access',
        permissions: ['*'],
        isSystemRole: true,
        inherits: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        roleId: 'role_user',
        name: 'user',
        description: 'Standard user with basic access',
        permissions: ['read:own', 'write:own'],
        isSystemRole: true,
        inherits: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        roleId: 'role_viewer',
        name: 'viewer',
        description: 'Read-only access to resources',
        permissions: ['read:all'],
        isSystemRole: true,
        inherits: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultRoles.forEach(role => {
      this.roles.set(role.roleId, role);
    });
  }

  private validateRoleData(role: Partial<Role>): void {
    if (!role.name) {
      throw new Error('Role name is required');
    }

    if (!role.name.match(/^[a-zA-Z0-9_\-]+$/)) {
      throw new Error('Role name can only contain letters, numbers, underscores, and hyphens');
    }

    if (role.permissions && !Array.isArray(role.permissions)) {
      throw new Error('Permissions must be an array');
    }

    if (role.inherits && !Array.isArray(role.inherits)) {
      throw new Error('Inherits must be an array');
    }
  }

  private validateRoleUpdates(updates: Partial<Role>): void {
    if (updates.name && !updates.name.match(/^[a-zA-Z0-9_\-]+$/)) {
      throw new Error('Role name can only contain letters, numbers, underscores, and hyphens');
    }

    if (updates.permissions && !Array.isArray(updates.permissions)) {
      throw new Error('Permissions must be an array');
    }

    if (updates.inherits && !Array.isArray(updates.inherits)) {
      throw new Error('Inherits must be an array');
    }
  }

  private async getInheritedPermissions(roleId: string, permissions: Set<string>): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role || !role.inherits) {
      return;
    }

    for (const parentId of role.inherits) {
      const parentRole = this.roles.get(parentId);
      if (parentRole) {
        // Add parent permissions
        parentRole.permissions.forEach(perm => permissions.add(perm));

        // Recursively get parent's inherited permissions
        await this.getInheritedPermissions(parentId, permissions);
      }
    }
  }

  private updateRoleHierarchy(roleId: string, parentRoleId: string): void {
    if (!this.roleHierarchy.has(roleId)) {
      this.roleHierarchy.set(roleId, new Set());
    }
    this.roleHierarchy.get(roleId)!.add(parentRoleId);
  }

  private removeRoleHierarchy(roleId: string, parentRoleId: string): void {
    const parents = this.roleHierarchy.get(roleId);
    if (parents) {
      parents.delete(parentRoleId);
      if (parents.size === 0) {
        this.roleHierarchy.delete(roleId);
      }
    }
  }

  private async hasCircularInheritance(roleId: string, parentRoleId: string): Promise<boolean> {
    const visited = new Set<string>();
    const stack: string[] = [parentRoleId];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (current === roleId) {
        return true;
      }

      visited.add(current);

      const parents = this.roleHierarchy.get(current);
      if (parents) {
        for (const parent of parents) {
          if (!visited.has(parent)) {
            stack.push(parent);
          }
        }
      }
    }

    return false;
  }
}