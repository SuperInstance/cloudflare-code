/**
 * Identity and Access Management (IAM) Module
 * Manages user identities, roles, permissions, and access control
 */

export { IAMService } from './iam-service';
export { UserManagement } from './user-management';
export { RoleManagement } from './role-management';
export { PermissionManagement } from './permission-management';

export * from './types';
// export * from './utils'; // Commented out - utils has external dependencies