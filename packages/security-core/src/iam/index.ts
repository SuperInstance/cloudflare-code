/**
 * Identity and Access Management (IAM) Module
 * Manages user identities, roles, permissions, and access control
 */

export { default as IAMService } from './iam-service';
export { default as UserManagement } from './user-management';
export { default as RoleManagement } from './role-management';
export { default as PermissionManagement } from './permission-management';

export * from './types';
export * from './utils';