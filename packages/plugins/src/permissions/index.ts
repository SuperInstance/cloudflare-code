/**
 * Plugin Permissions Module
 *
 * Exports permission management functionality for plugin sandboxing.
 */

export {
  PermissionManager,
  PermissionDeniedError,
  PermissionExpiredError,
  parsePermissionString,
  createPermissionString,
  isDangerousPermission,
  getPermissionDescription,
  getPermissionsByCategory,
  type Permission,
  type PermissionConstraints,
  type PermissionGrant,
  type PermissionRequest,
  type PermissionPolicy,
  type AuditEntry,
  type PermissionManagerConfig
} from './permissions';
