/**
 * RBAC Tests
 */

import { describe, it, expect } from 'vitest';
import {
  hasRoleLevel,
  getHigherOrEqualRoles,
  getRolePermissions,
  getUserPermissions,
  hasPermission as rbacHasPermission,
  hasAnyPermission as rbacHasAnyPermission,
  hasAllPermissions as rbacHasAllPermissions,
  canAccessResource,
  AuthorizationService,
  parsePermission,
  stringifyPermission,
  parsePermissions,
  stringifyPermissions,
  isValidPermission,
  actionImplies,
  mergePermissions,
  hashPermissions,
  OrganizationRBAC,
  type Permission,
  type User,
  type OrganizationMember,
  type AuthContext,
  UserRole,
  Resource,
  Action,
} from './rbac';
import { AuthError } from './types';

describe('RBAC', () => {
  describe('Role Hierarchy', () => {
    it('should check role levels', () => {
      expect(hasRoleLevel('admin', 'user')).toBe(true);
      expect(hasRoleLevel('admin', 'admin')).toBe(true);
      expect(hasRoleLevel('user', 'admin')).toBe(false);
      expect(hasRoleLevel('user', 'user')).toBe(true);
    });

    it('should get higher or equal roles', () => {
      const roles = getHigherOrEqualRoles('user');
      expect(roles).toContain('user');
      expect(roles).toContain('pro');
      expect(roles).toContain('admin');
      expect(roles).not.toContain('anonymous');
    });
  });

  describe('Role Permissions', () => {
    it('should get permissions for user role', () => {
      const permissions = getRolePermissions('user');

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === 'chat' && p.action === 'execute')).toBe(true);
      expect(permissions.some(p => p.resource === 'users_manage')).toBe(false);
    });

    it('should get permissions for admin role', () => {
      const permissions = getRolePermissions('admin');

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.action === 'manage')).toBe(true);
      expect(permissions.some(p => p.resource === 'users_manage')).toBe(true);
    });

    it('should get permissions for anonymous role', () => {
      const permissions = getRolePermissions('anonymous');

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.every(p => p.action === 'read')).toBe(true);
    });
  });

  describe('User Permissions', () => {
    it('should get user permissions', () => {
      const user: User = {
        id: 'user-123',
        email: 'user@example.com',
        emailVerified: true,
        role: 'user',
        permissions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mfaEnabled: false,
        metadata: {},
      };

      const permissions = getUserPermissions(user);

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions).toEqual(getRolePermissions('user'));
    });

    it('should merge role and custom permissions', () => {
      const user: User = {
        id: 'user-123',
        email: 'user@example.com',
        emailVerified: true,
        role: 'user',
        permissions: [
          { resource: 'users_manage', action: 'read' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mfaEnabled: false,
        metadata: {},
      };

      const permissions = getUserPermissions(user);

      expect(permissions.length).toBeGreaterThan(getRolePermissions('user').length);
      expect(permissions.some(p => p.resource === 'users_manage')).toBe(true);
    });
  });

  describe('Permission Checking', () => {
    const permissions: Permission[] = [
      { resource: 'chat', action: 'execute' },
      { resource: 'models', action: 'read' },
      { resource: 'codebase', action: 'create' },
    ];

    it('should check if user has permission', () => {
      expect(rbacHasPermission(permissions, 'chat', 'execute')).toBe(true);
      expect(rbacHasPermission(permissions, 'chat', 'read')).toBe(false);
      expect(rbacHasPermission(permissions, 'users', 'manage')).toBe(false);
    });

    it('should check with conditions', () => {
      const permissionsWithConditions: Permission[] = [
        {
          resource: 'codebase',
          action: 'create',
          conditions: { organizationId: 'org-123' },
        },
      ];

      expect(
        rbacHasPermission(permissionsWithConditions, 'codebase', 'create', {
          organizationId: 'org-123',
        })
      ).toBe(true);

      expect(
        rbacHasPermission(permissionsWithConditions, 'codebase', 'create', {
          organizationId: 'org-456',
        })
      ).toBe(false);
    });

    it('should check if user has any permission', () => {
      const required: Permission[] = [
        { resource: 'chat', action: 'read' },
        { resource: 'models', action: 'read' },
      ];

      expect(rbacHasAnyPermission(permissions, required)).toBe(true);

      const notMatched: Permission[] = [
        { resource: 'users', action: 'manage' },
        { resource: 'organizations', action: 'delete' },
      ];

      expect(rbacHasAnyPermission(permissions, notMatched)).toBe(false);
    });

    it('should check if user has all permissions', () => {
      const required: Permission[] = [
        { resource: 'chat', action: 'execute' },
        { resource: 'models', action: 'read' },
      ];

      expect(rbacHasAllPermissions(permissions, required)).toBe(true);

      const notAll: Permission[] = [
        { resource: 'chat', action: 'execute' },
        { resource: 'users', action: 'manage' },
      ];

      expect(rbacHasAllPermissions(permissions, notAll)).toBe(false);
    });
  });

  describe('Resource Access', () => {
    const authContext: AuthContext = {
      authenticated: true,
      method: 'jwt',
      userId: 'user-123',
      role: 'user',
      permissions: [
        { resource: 'chat', action: 'execute' },
        { resource: 'codebase', action: 'create' },
      ],
      metadata: {
        authenticatedAt: Date.now(),
      },
    };

    it('should check if user can access resource', () => {
      expect(canAccessResource(authContext, 'chat', 'execute')).toBe(true);
      expect(canAccessResource(authContext, 'users', 'manage')).toBe(false);
    });

    it('should allow anonymous read access', () => {
      const anonymousContext: AuthContext = {
        authenticated: false,
        method: 'none',
        role: 'anonymous',
        permissions: [
          { resource: 'models', action: 'read' },
        ],
        metadata: {
          authenticatedAt: Date.now(),
        },
      };

      expect(canAccessResource(anonymousContext, 'models', 'read')).toBe(true);
      expect(canAccessResource(anonymousContext, 'chat', 'execute')).toBe(false);
    });

    it('should check organization access', () => {
      const orgContext: AuthContext = {
        authenticated: true,
        method: 'jwt',
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'user',
        permissions: [
          { resource: 'organizations', action: 'read' },
        ],
        metadata: {
          authenticatedAt: Date.now(),
        },
      };

      expect(canAccessResource(orgContext, 'organizations', 'read', 'org-123')).toBe(true);
    });
  });

  describe('Authorization Service', () => {
    const authContext: AuthContext = {
      authenticated: true,
      method: 'jwt',
      userId: 'user-123',
      role: 'user',
      permissions: [
        { resource: 'chat', action: 'execute' },
        { resource: 'models', action: 'read' },
      ],
      metadata: {
        authenticatedAt: Date.now(),
      },
    };

    it('should authorize with valid permissions', () => {
      expect(() => {
        AuthorizationService.authorize(
          authContext,
          [{ resource: 'chat', action: 'execute' }],
          false
        );
      }).not.toThrow();
    });

    it('should fail authorization with invalid permissions', () => {
      expect(() => {
        AuthorizationService.authorize(
          authContext,
          [{ resource: 'users', action: 'manage' }],
          false
        );
      }).toThrow(AuthError);
    });

    it('should authorize resource access', () => {
      expect(() => {
        AuthorizationService.authorizeResource(authContext, 'chat', 'execute');
      }).not.toThrow();
    });

    it('should fail resource authorization', () => {
      expect(() => {
        AuthorizationService.authorizeResource(authContext, 'users', 'manage');
      }).toThrow(AuthError);
    });

    it('should check if user can manage another user', () => {
      expect(AuthorizationService.canManageUser(authContext, 'user-123')).toBe(true);
      expect(AuthorizationService.canManageUser(authContext, 'user-456')).toBe(false);
    });

    it('should allow admin to manage any user', () => {
      const adminContext: AuthContext = {
        authenticated: true,
        method: 'jwt',
        userId: 'admin-123',
        role: 'admin',
        permissions: [],
        metadata: {
          authenticatedAt: Date.now(),
        },
      };

      expect(AuthorizationService.canManageUser(adminContext, 'user-456')).toBe(true);
    });
  });

  describe('Permission Utilities', () => {
    it('should parse permission from string', () => {
      const permission = parsePermission('chat:execute');

      expect(permission.resource).toBe('chat');
      expect(permission.action).toBe('execute');
    });

    it('should stringify permission', () => {
      const permission: Permission = {
        resource: 'models',
        action: 'read',
      };

      expect(stringifyPermission(permission)).toBe('models:read');
    });

    it('should parse multiple permissions', () => {
      const permissions = parsePermissions(['chat:execute', 'models:read']);

      expect(permissions).toHaveLength(2);
      expect(permissions[0].resource).toBe('chat');
      expect(permissions[1].resource).toBe('models');
    });

    it('should stringify multiple permissions', () => {
      const permissions: Permission[] = [
        { resource: 'chat', action: 'execute' },
        { resource: 'models', action: 'read' },
      ];

      const strings = stringifyPermissions(permissions);

      expect(strings).toContain('chat:execute');
      expect(strings).toContain('models:read');
    });

    it('should validate permission', () => {
      const valid: Permission = {
        resource: 'chat',
        action: 'execute',
      };

      expect(isValidPermission(valid)).toBe(true);

      const invalid: Permission = {
        resource: 'invalid' as Resource,
        action: 'execute',
      };

      expect(isValidPermission(invalid)).toBe(false);
    });

    it('should check if action implies another', () => {
      expect(actionImplies('manage', 'execute')).toBe(true);
      expect(actionImplies('execute', 'read')).toBe(true);
      expect(actionImplies('read', 'execute')).toBe(false);
    });

    it('should merge permissions', () => {
      const permissions: Permission[] = [
        { resource: 'chat', action: 'execute' },
        { resource: 'chat', action: 'read' },
        { resource: 'models', action: 'read' },
        { resource: 'chat', action: 'execute' }, // Duplicate
      ];

      const merged = mergePermissions(permissions);

      expect(merged.length).toBe(3); // Remove duplicate
      expect(merged.some(p => p.resource === 'chat' && p.action === 'execute')).toBe(true);
    });

    it('should hash permissions', () => {
      const permissions: Permission[] = [
        { resource: 'chat', action: 'execute' },
        { resource: 'models', action: 'read' },
      ];

      const hash1 = hashPermissions(permissions);
      const hash2 = hashPermissions(permissions.reverse());

      expect(hash1).toBe(hash2); // Order independent
    });
  });

  describe('Organization RBAC', () => {
    const member: OrganizationMember = {
      userId: 'user-123',
      organizationId: 'org-123',
      role: 'user',
      permissions: [],
      invitedBy: 'admin-123',
      invitedAt: Date.now(),
    };

    const admin: OrganizationMember = {
      userId: 'admin-123',
      organizationId: 'org-123',
      role: 'admin',
      permissions: [],
      invitedBy: 'owner-123',
      invitedAt: Date.now(),
    };

    it('should check if member can perform action', () => {
      expect(OrganizationRBAC.canPerformAction(member, 'chat', 'execute')).toBe(true);
      expect(OrganizationRBAC.canPerformAction(member, 'users_manage', 'manage')).toBe(false);
    });

    it('should check if member can invite users', () => {
      expect(OrganizationRBAC.canInviteUsers(admin)).toBe(true);
      expect(OrganizationRBAC.canInviteUsers(member)).toBe(false);
    });

    it('should check if member can remove users', () => {
      const targetMember: OrganizationMember = {
        userId: 'user-456',
        organizationId: 'org-123',
        role: 'user',
        permissions: [],
        invitedBy: 'admin-123',
        invitedAt: Date.now(),
      };

      expect(OrganizationRBAC.canRemoveUsers(admin, targetMember)).toBe(true);
      expect(OrganizationRBAC.canRemoveUsers(member, targetMember)).toBe(false);
    });

    it('should prevent removing owner', () => {
      const owner: OrganizationMember = {
        userId: 'owner-123',
        organizationId: 'org-123',
        role: 'admin',
        permissions: [],
        invitedBy: 'owner-123',
        invitedAt: Date.now(),
      };

      expect(OrganizationRBAC.canRemoveUsers(admin, owner)).toBe(false);
    });

    it('should check if member can change role', () => {
      const targetMember: OrganizationMember = {
        userId: 'user-456',
        organizationId: 'org-123',
        role: 'user',
        permissions: [],
        invitedBy: 'admin-123',
        invitedAt: Date.now(),
      };

      expect(OrganizationRBAC.canChangeMemberRole(admin, targetMember, 'pro')).toBe(true);
      expect(OrganizationRBAC.canChangeMemberRole(admin, targetMember, 'admin')).toBe(false);
      expect(OrganizationRBAC.canChangeMemberRole(member, targetMember, 'pro')).toBe(false);
    });
  });

  describe('Authorization Service Advanced', () => {
    it('should filter accessible resources', () => {
      const authContext: AuthContext = {
        authenticated: true,
        method: 'jwt',
        userId: 'user-123',
        role: 'user',
        permissions: [
          { resource: 'codebase', action: 'read' },
        ],
        metadata: {
          authenticatedAt: Date.now(),
        },
      };

      const resources = [
        { ownerId: 'user-123', organizationId: undefined },
        { ownerId: 'user-456', organizationId: undefined },
        { ownerId: 'user-789', organizationId: 'org-123' },
      ];

      const filtered = AuthorizationService.filterAccessibleResources(
        authContext,
        resources,
        'codebase',
        'read'
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].ownerId).toBe('user-123');
    });

    it('should allow admin to see all resources', () => {
      const adminContext: AuthContext = {
        authenticated: true,
        method: 'jwt',
        userId: 'admin-123',
        role: 'admin',
        permissions: [
          { resource: 'codebase', action: 'read' },
        ],
        metadata: {
          authenticatedAt: Date.now(),
        },
      };

      const resources = [
        { ownerId: 'user-123', organizationId: undefined },
        { ownerId: 'user-456', organizationId: undefined },
      ];

      const filtered = AuthorizationService.filterAccessibleResources(
        adminContext,
        resources,
        'codebase',
        'read'
      );

      expect(filtered.length).toBe(2);
    });

    it('should get resource query filter', () => {
      const userContext: AuthContext = {
        authenticated: true,
        method: 'jwt',
        userId: 'user-123',
        organizationId: 'org-123',
        role: 'user',
        permissions: [],
        metadata: {
          authenticatedAt: Date.now(),
        },
      };

      const filter = AuthorizationService.getResourceQueryFilter(userContext);

      expect(filter.userId).toBe('user-123');
      expect(filter.organizationId).toBe('org-123');
    });

    it('should return empty filter for admin', () => {
      const adminContext: AuthContext = {
        authenticated: true,
        method: 'jwt',
        userId: 'admin-123',
        role: 'admin',
        permissions: [],
        metadata: {
          authenticatedAt: Date.now(),
        },
      };

      const filter = AuthorizationService.getResourceQueryFilter(adminContext);

      expect(filter).toEqual({});
    });
  });
});
