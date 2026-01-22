/**
 * Role-Based Access Control (RBAC)
 *
 * Implements authorization logic with role hierarchy, permission checking,
 * and resource-based access control.
 */

import type {
  UserRole,
  Permission,
  Resource,
  Action,
  AuthContext,
  User,
  Organization,
  OrganizationMember,
} from './types';
import { AuthError } from './types';

// ============================================================================
// ROLE HIERARCHY
// ============================================================================

/**
 * Role hierarchy levels (higher = more permissions)
 */
const ROLE_LEVELS: Record<UserRole, number> = {
  anonymous: 0,
  user: 1,
  pro: 2,
  admin: 3,
  service_account: 1,
};

/**
 * Check if role1 has higher or equal level than role2
 */
export function hasRoleLevel(role1: UserRole, role2: UserRole): boolean {
  return ROLE_LEVELS[role1] >= ROLE_LEVELS[role2];
}

/**
 * Get all roles with level >= given role
 */
export function getHigherOrEqualRoles(role: UserRole): UserRole[] {
  const level = ROLE_LEVELS[role];
  return Object.entries(ROLE_LEVELS)
    .filter(([_, l]) => l >= level)
    .map(([r]) => r as UserRole);
}

// ============================================================================
// PERMISSION DEFINITIONS
// ============================================================================

/**
 * Default permissions for each role
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  anonymous: [
    { resource: 'chat' as Resource, action: 'read' as Action },
    { resource: 'models' as Resource, action: 'read' as Action },
  ],

  user: [
    { resource: 'chat' as Resource, action: 'execute' as Action },
    { resource: 'chat_stream' as Resource, action: 'execute' as Action },
    { resource: 'models' as Resource, action: 'read' as Action },
    { resource: 'codebase' as Resource, action: 'create' as Action },
    { resource: 'codebase' as Resource, action: 'read' as Action },
    { resource: 'codebase_search' as Resource, action: 'execute' as Action },
    { resource: 'api_keys' as Resource, action: 'create' as Action },
    { resource: 'api_keys' as Resource, action: 'read' as Action },
    { resource: 'api_keys' as Resource, action: 'delete' as Action },
    { resource: 'sessions' as Resource, action: 'read' as Action },
    { resource: 'metrics' as Resource, action: 'read' as Action },
  ],

  pro: [
    { resource: 'chat' as Resource, action: 'execute' as Action },
    { resource: 'chat_stream' as Resource, action: 'execute' as Action },
    { resource: 'models' as Resource, action: 'read' as Action },
    { resource: 'models_premium' as Resource, action: 'execute' as Action },
    { resource: 'codebase' as Resource, action: 'create' as Action },
    { resource: 'codebase' as Resource, action: 'read' as Action },
    { resource: 'codebase_upload' as Resource, action: 'execute' as Action },
    { resource: 'codebase_search' as Resource, action: 'execute' as Action },
    { resource: 'agents' as Resource, action: 'execute' as Action },
    { resource: 'agents_orchestrate' as Resource, action: 'execute' as Action },
    { resource: 'api_keys' as Resource, action: 'create' as Action },
    { resource: 'api_keys' as Resource, action: 'read' as Action },
    { resource: 'api_keys' as Resource, action: 'delete' as Action },
    { resource: 'api_keys_manage' as Resource, action: 'update' as Action },
    { resource: 'sessions' as Resource, action: 'read' as Action },
    { resource: 'sessions' as Resource, action: 'delete' as Action },
    { resource: 'metrics' as Resource, action: 'read' as Action },
    { resource: 'metrics_detailed' as Resource, action: 'read' as Action },
  ],

  admin: [
    { resource: 'chat' as Resource, action: 'manage' as Action },
    { resource: 'models' as Resource, action: 'read' as Action },
    { resource: 'models_premium' as Resource, action: 'execute' as Action },
    { resource: 'codebase' as Resource, action: 'manage' as Action },
    { resource: 'agents' as Resource, action: 'manage' as Action },
    { resource: 'api_keys' as Resource, action: 'manage' as Action },
    { resource: 'sessions' as Resource, action: 'manage' as Action },
    { resource: 'metrics' as Resource, action: 'read' as Action },
    { resource: 'metrics_detailed' as Resource, action: 'read' as Action },
    { resource: 'users' as Resource, action: 'read' as Action },
    { resource: 'users_manage' as Resource, action: 'manage' as Action },
    { resource: 'organizations' as Resource, action: 'read' as Action },
    { resource: 'organizations_manage' as Resource, action: 'manage' as Action },
  ],

  service_account: [
    { resource: 'chat' as Resource, action: 'execute' as Action },
    { resource: 'chat_stream' as Resource, action: 'execute' as Action },
    { resource: 'models' as Resource, action: 'read' as Action },
    { resource: 'codebase' as Resource, action: 'read' as Action },
    { resource: 'codebase_search' as Resource, action: 'execute' as Action },
    { resource: 'agents' as Resource, action: 'execute' as Action },
    { resource: 'metrics' as Resource, action: 'read' as Action },
  ],
};

/**
 * Get default permissions for role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get all permissions for user (role + custom)
 */
export function getUserPermissions(user: User): Permission[] {
  const rolePerms = getRolePermissions(user.role);
  return [...rolePerms, ...(user.permissions || [])];
}

/**
 * Get all permissions for organization member
 */
export function getMemberPermissions(member: OrganizationMember): Permission[] {
  const rolePerms = getRolePermissions(member.role);
  return [...rolePerms, ...(member.permissions || [])];
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Check if user has specific permission
 */
export function hasPermission(
  userPermissions: Permission[],
  resource: Resource,
  action: Action,
  conditions?: Record<string, unknown>
): boolean {
  return userPermissions.some(permission => {
    const matchesResource = permission.resource === resource;
    const matchesAction = permission.action === action ||
                          permission.action === 'manage' ||
                          permission.action === 'execute';

    if (!matchesResource || !matchesAction) {
      return false;
    }

    // Check conditions if provided
    if (conditions && permission.conditions) {
      return Object.entries(conditions).every(([key, value]) => {
        return permission.conditions![key] === value;
      });
    }

    return true;
  });
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some(required =>
    hasPermission(userPermissions, required.resource, required.action, required.conditions)
  );
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every(required =>
    hasPermission(userPermissions, required.resource, required.action, required.conditions)
  );
}

/**
 * Check if user can access resource
 */
export function canAccessResource(
  authContext: AuthContext,
  resource: Resource,
  action: Action,
  resourceId?: string
): boolean {
  if (!authContext.authenticated) {
    return hasPermission(
      authContext.permissions,
      resource,
      action
    );
  }

  // Check if user has the permission
  if (!hasPermission(authContext.permissions, resource, action)) {
    return false;
  }

  // For organization resources, check if user belongs to organization
  if (resourceId && authContext.organizationId) {
    // Resource-specific checks can be added here
    return true;
  }

  return true;
}

// ============================================================================
// AUTHORIZATION SERVICE
// ============================================================================

/**
 * Authorization service for checking permissions
 */
export class AuthorizationService {
  /**
   * Authorize request with required permissions
   */
  static authorize(
    authContext: AuthContext,
    requiredPermissions: Permission[],
    requireAll: boolean = false
  ): void {
    if (!authContext.authenticated) {
      throw new AuthError(
        'INVALID_CREDENTIALS',
        'Authentication required',
        401
      );
    }

    const authorized = requireAll
      ? hasAllPermissions(authContext.permissions, requiredPermissions)
      : hasAnyPermission(authContext.permissions, requiredPermissions);

    if (!authorized) {
      throw new AuthError(
        'INSUFFICIENT_PERMISSIONS',
        `Missing required permissions: ${requiredPermissions.map(p => `${p.resource}:${p.action}`).join(', ')}`,
        403,
        { requiredPermissions, userPermissions: authContext.permissions }
      );
    }
  }

  /**
   * Authorize request for specific resource
   */
  static authorizeResource(
    authContext: AuthContext,
    resource: Resource,
    action: Action,
    resourceId?: string
  ): void {
    if (!authContext.authenticated) {
      throw new AuthError(
        'INVALID_CREDENTIALS',
        'Authentication required',
        401
      );
    }

    if (!canAccessResource(authContext, resource, action, resourceId)) {
      throw new AuthError(
        'INSUFFICIENT_PERMISSIONS',
        `Not authorized to ${action} on ${resource}`,
        403,
        { resource, action, resourceId }
      );
    }
  }

  /**
   * Check if user can perform action on another user
   */
  static canManageUser(
    authContext: AuthContext,
    targetUserId: string
  ): boolean {
    // Admin can manage anyone
    if (authContext.role === 'admin') {
      return true;
    }

    // Users can manage themselves
    if (authContext.userId === targetUserId) {
      return true;
    }

    // Check if user has explicit permission
    return hasPermission(authContext.permissions, 'users_manage', 'manage');
  }

  /**
   * Check if user can manage organization
   */
  static canManageOrganization(
    authContext: AuthContext,
    organizationId: string
  ): boolean {
    // Admin can manage any organization
    if (authContext.role === 'admin') {
      return true;
    }

    // Check if user belongs to organization
    if (authContext.organizationId !== organizationId) {
      return false;
    }

    // Check if user has permission
    return hasPermission(authContext.permissions, 'organizations_manage', 'manage');
  }

  /**
   * Check if user can access API key
   */
  static canAccessAPIKey(
    authContext: AuthContext,
    keyOwnerId: string,
    keyOrganizationId?: string
  ): boolean {
    // Admin can access any key
    if (authContext.role === 'admin') {
      return true;
    }

    // User can access their own keys
    if (authContext.userId === keyOwnerId) {
      return true;
    }

    // Check organization access
    if (keyOrganizationId && authContext.organizationId === keyOrganizationId) {
      return hasPermission(authContext.permissions, 'api_keys_manage', 'read');
    }

    return false;
  }

  /**
   * Check if user can upgrade role
   */
  static canUpgradeRole(
    authContext: AuthContext,
    currentRole: UserRole,
    targetRole: UserRole
  ): boolean {
    // Only admin can change roles
    if (authContext.role !== 'admin') {
      return false;
    }

    // Can't upgrade to higher level than own role
    if (ROLE_LEVELS[targetRole] > ROLE_LEVELS[authContext.role]) {
      return false;
    }

    return true;
  }

  /**
   * Filter accessible resources
   */
  static filterAccessibleResources<T extends { ownerId?: string; organizationId?: string }>(
    authContext: AuthContext,
    resources: T[],
    resourceType: Resource,
    action: Action
  ): T[] {
    return resources.filter(resource => {
      // Check permission
      if (!hasPermission(authContext.permissions, resourceType, action)) {
        return false;
      }

      // Admin can see all
      if (authContext.role === 'admin') {
        return true;
      }

      // Check ownership
      if (resource.ownerId && resource.ownerId === authContext.userId) {
        return true;
      }

      // Check organization access
      if (resource.organizationId && resource.organizationId === authContext.organizationId) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get accessible resources query filter
   */
  static getResourceQueryFilter(authContext: AuthContext): {
    userId?: string;
    organizationId?: string;
  } {
    // Admin can see all
    if (authContext.role === 'admin') {
      return {};
    }

    // Regular users see their own and org resources
    return {
      userId: authContext.userId,
      organizationId: authContext.organizationId,
    };
  }
}

// ============================================================================
// PERMISSION UTILITIES
// ============================================================================

/**
 * Create permission from string (e.g., "chat:execute")
 */
export function parsePermission(permissionString: string): Permission {
  const [resource, action] = permissionString.split(':');
  return {
    resource: resource as Resource,
    action: action as Action,
  };
}

/**
 * Convert permission to string
 */
export function stringifyPermission(permission: Permission): string {
  return `${permission.resource}:${permission.action}`;
}

/**
 * Parse multiple permissions
 */
export function parsePermissions(permissionStrings: string[]): Permission[] {
  return permissionStrings.map(parsePermission);
}

/**
 * Stringify multiple permissions
 */
export function stringifyPermissions(permissions: Permission[]): string[] {
  return permissions.map(stringifyPermission);
}

/**
 * Validate permission
 */
export function isValidPermission(permission: Permission): boolean {
  const validResources: Resource[] = [
    'chat',
    'chat_stream',
    'models',
    'models_premium',
    'codebase',
    'codebase_upload',
    'codebase_search',
    'agents',
    'agents_orchestrate',
    'api_keys',
    'api_keys_manage',
    'sessions',
    'sessions_manage',
    'metrics',
    'metrics_detailed',
    'users',
    'users_manage',
    'organizations',
    'organizations_manage',
  ];

  const validActions: Action[] = [
    'read',
    'create',
    'update',
    'delete',
    'execute',
    'manage',
  ];

  return validResources.includes(permission.resource) &&
         validActions.includes(permission.action);
}

/**
 * Check if permission action implies another
 */
export function actionImplies(action: Action, otherAction: Action): boolean {
  if (action === otherAction) return true;
  if (action === 'manage') return true;
  if (action === 'execute' && otherAction === 'read') return true;

  return false;
}

/**
 * Merge permissions (remove duplicates, keep higher privileges)
 */
export function mergePermissions(permissions: Permission[]): Permission[] {
  const merged = new Map<string, Permission>();

  for (const permission of permissions) {
    const key = `${permission.resource}:${permission.action}`;

    if (!merged.has(key)) {
      merged.set(key, permission);
    } else {
      // Merge conditions
      const existing = merged.get(key)!;
      merged.set(key, {
        ...existing,
        conditions: {
          ...(existing.conditions || {}),
          ...(permission.conditions || {}),
        },
      });
    }
  }

  return Array.from(merged.values());
}

/**
 * Calculate permission set hash (for caching)
 */
export function hashPermissions(permissions: Permission[]): string {
  const sorted = permissions
    .map(p => `${p.resource}:${p.action}`)
    .sort()
    .join(',');
  return sorted;
}

// ============================================================================
// ORGANIZATION RBAC
// ============================================================================

/**
 * Organization-specific RBAC
 */
export class OrganizationRBAC {
  /**
   * Check if member can perform action in organization
   */
  static canPerformAction(
    member: OrganizationMember,
    resource: Resource,
    action: Action
  ): boolean {
    const permissions = getMemberPermissions(member);
    return hasPermission(permissions, resource, action);
  }

  /**
   * Check if member can invite users
   */
  static canInviteUsers(member: OrganizationMember): boolean {
    return hasPermission(
      getMemberPermissions(member),
      'organizations_manage',
      'create'
    );
  }

  /**
   * Check if member can remove users
   */
  static canRemoveUsers(member: OrganizationMember, targetMember: OrganizationMember): boolean {
    // Can't remove owner
    if (targetMember.role === 'admin') {
      return false;
    }

    // Can only remove users with lower role
    if (!hasRoleLevel(member.role, targetMember.role)) {
      return false;
    }

    return hasPermission(
      getMemberPermissions(member),
      'organizations_manage',
      'delete'
    );
  }

  /**
   * Check if member can change member role
   */
  static canChangeMemberRole(
    member: OrganizationMember,
    targetMember: OrganizationMember,
    newRole: UserRole
  ): boolean {
    // Can't change owner role
    if (targetMember.role === 'admin') {
      return false;
    }

    // Can only assign roles lower than or equal to own role
    if (!hasRoleLevel(member.role, newRole)) {
      return false;
    }

    return hasPermission(
      getMemberPermissions(member),
      'organizations_manage',
      'update'
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  ROLE_LEVELS,
  ROLE_PERMISSIONS,
};
