/**
 * Identity and Access Management (IAM) Service
 * Central service for managing identities, access control, and compliance
 */

import {
  User,
  Role,
  Permission,
  SecurityEvent,
  AccessRequest,
  AccessDecision,
  SecurityPolicy
} from '../types';
import { IAMServiceInterface } from '../interfaces';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { UserManagement } from './user-management';
import { RoleManagement } from './role-management';
import { PermissionManagement } from './permission-management';

export class IAMService extends EventEmitter implements IAMServiceInterface {
  private logger: Logger;
  private userManagement: UserManagement;
  private roleManagement: RoleManagement;
  private permissionManagement: PermissionManagement;
  private accessPolicies: Map<string, SecurityPolicy> = new Map();
  private activeSessions: Map<string, any> = new Map();

  constructor() {
    super();
    this.logger = new Logger('IAMService');
    this.userManagement = new UserManagement();
    this.roleManagement = new RoleManagement();
    this.permissionManagement = new PermissionManagement();
  }

  /**
   * Authenticate user and return access decision
   */
  async authenticate(request: AccessRequest): Promise<AccessDecision> {
    try {
      // Validate request
      this.validateAccessRequest(request);

      // Check if user exists and is active
      const user = await this.userManagement.getUserById(request.principalId);
      if (!user || !user.isActive) {
        await this.logSecurityEvent({
          type: 'authentication',
          severity: 'medium',
          userId: request.principalId,
          action: 'access_denied',
          description: 'User not found or inactive',
          ip: request.context.ip || '',
          timestamp: new Date()
        });

        return {
          allowed: false,
          reason: 'User not found or inactive',
          evaluatedAt: new Date()
        };
      }

      // Check session validity
      const session = this.activeSessions.get(request.principalId);
      if (!session || this.isSessionExpired(session)) {
        // Create new session
        const newSession = await this.createSession(user, request.context);
        this.activeSessions.set(request.principalId, newSession);
      }

      // Evaluate access policies
      const policyDecision = await this.evaluateAccessPolicies(user, request);

      if (policyDecision.allowed) {
        await this.logSecurityEvent({
          type: 'authentication',
          severity: 'low',
          userId: request.principalId,
          action: 'access_granted',
          description: 'Access granted based on policies',
          ip: request.context.ip || '',
          timestamp: new Date()
        });

        this.emit('accessGranted', { user, request, decision: policyDecision });
      } else {
        await this.logSecurityEvent({
          type: 'authentication',
          severity: 'medium',
          userId: request.principalId,
          action: 'access_denied',
          description: 'Access denied by policy',
          ip: request.context.ip || '',
          timestamp: new Date()
        });

        this.emit('accessDenied', { user, request, decision: policyDecision });
      }

      return policyDecision;

    } catch (error) {
      this.logger.error('Authentication failed', error);
      await this.logSecurityEvent({
        type: 'authentication',
        severity: 'high',
        userId: request.principalId,
        action: 'access_error',
        description: 'Authentication error occurred',
        ip: request.context.ip || '',
        timestamp: new Date()
      });

      return {
        allowed: false,
        reason: 'Authentication failed',
        evaluatedAt: new Date()
      };
    }
  }

  /**
   * Check if user has specific permission on a resource
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    context?: any
  ): Promise<boolean> {
    try {
      const user = await this.userManagement.getUserById(userId);
      if (!user || !user.isActive) {
        return false;
      }

      // Get user's effective permissions
      const effectivePermissions = await this.getEffectivePermissions(user);

      // Check exact match
      const exactPermission = effectivePermissions.find(
        p => p.resource === resource && p.action === action
      );

      if (exactPermission) {
        return true;
      }

      // Check wildcard permissions
      const wildcardPermission = effectivePermissions.find(
        p => p.resource === '*' && p.action === action
      );

      if (wildcardPermission) {
        return true;
      }

      // Check context-based permissions
      if (context) {
        const contextPermission = effectivePermissions.find(
          p => p.resource === resource && p.action === action && this.evaluateConditions(p.conditions, context)
        );

        if (contextPermission) {
          return true;
        }
      }

      return false;

    } catch (error) {
      this.logger.error('Permission check failed', error);
      return false;
    }
  }

  /**
   * Get user's effective permissions (including inherited from roles)
   */
  async getEffectivePermissions(user: User): Promise<Permission[]> {
    try {
      const permissions = new Set<string>();

      // Add direct permissions
      user.permissions.forEach(perm => permissions.add(perm));

      // Add role permissions
      for (const role of user.roles) {
        const rolePermissions = await this.roleManagement.getRolePermissions(role.roleId);
        rolePermissions.forEach(perm => permissions.add(perm));
      }

      // Convert to Permission objects
      const permissionArray: Permission[] = [];
      for (const permString of permissions) {
        const [resource, action] = permString.split(':');
        permissionArray.push({
          permissionId: permString,
          resource,
          action,
          conditions: []
        });
      }

      return permissionArray;

    } catch (error) {
      this.logger.error('Failed to get effective permissions', error);
      return [];
    }
  }

  /**
   * Create access request for approval workflow
   */
  async createAccessRequest(
    userId: string,
    resource: string,
    action: string,
    justification?: string,
    context?: any
  ): Promise<AccessRequest> {
    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const request: AccessRequest = {
        requestId,
        principalId: userId,
        resource,
        action,
        context: context || {
          timestamp: now,
          ip: '',
          userAgent: '',
          sessionId: ''
        },
        requestedAt: now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours expiry
      };

      // Store request (in real implementation, use database)
      this.emit('accessRequestCreated', request);

      this.logger.info(`Access request created`, {
        requestId,
        userId,
        resource,
        action
      });

      return request;

    } catch (error) {
      this.logger.error('Failed to create access request', error);
      throw new Error('Failed to create access request');
    }
  }

  /**
   * Approve or deny access request
   */
  async reviewAccessRequest(
    requestId: string,
    reviewer: string,
    decision: 'approved' | 'rejected',
    comments?: string
  ): Promise<boolean> {
    try {
      // Find request
      const request = await this.findAccessRequest(requestId);
      if (!request) {
        throw new Error('Access request not found');
      }

      // Check if request is still valid
      if (request.expiresAt < new Date()) {
        throw new Error('Access request has expired');
      }

      if (decision === 'approved') {
        // Grant temporary access
        await this.grantTemporaryAccess(request, reviewer);
      }

      // Log review decision
      await this.logSecurityEvent({
        type: 'authorization',
        severity: 'low',
        userId: request.principalId,
        action: 'access_request_reviewed',
        description: `Access request ${decision} by ${reviewer}`,
        ip: '',
        timestamp: new Date()
      });

      this.emit('accessRequestReviewed', {
        requestId,
        decision,
        reviewer,
        comments
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to review access request', error);
      throw new Error('Failed to review access request');
    }
  }

  /**
   * Update user role assignments
   */
  async updateUserRoles(userId: string, roles: string[]): Promise<boolean> {
    try {
      const user = await this.userManagement.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user roles
      user.roles = roles.map(roleId => ({ roleId, role: roleId, permissions: [] }));
      user.updatedAt = new Date();

      await this.userManagement.updateUser(userId, user);

      // Log role change
      await this.logSecurityEvent({
        type: 'authorization',
        severity: 'medium',
        userId,
        action: 'roles_updated',
        description: `User roles updated to ${roles.join(', ')}`,
        ip: '',
        timestamp: new Date()
      });

      this.emit('userRolesUpdated', { userId, roles });

      return true;

    } catch (error) {
      this.logger.error('Failed to update user roles', error);
      return false;
    }
  }

  /**
   * Perform access review for compliance
   */
  async performAccessReview(targetUsers?: string[]): Promise<AccessReview[]> {
    try {
      const reviews: AccessReview[] = [];
      const users = targetUsers || (await this.userManagement.getAllUsers()).map(u => u.id);

      for (const userId of users) {
        const user = await this.userManagement.getUserById(userId);
        if (!user || !user.isActive) continue;

        const findings = await this.analyzeUserAccess(user);
        const review: AccessReview = {
          id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `Access Review - ${user.username}`,
          description: `Review of access permissions for ${user.username}`,
          status: 'completed',
          reviewer: 'system',
          period: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            end: new Date()
          },
          targetUsers: [userId],
          findings,
          completedAt: new Date()
        };

        reviews.push(review);
      }

      this.logger.info(`Access review completed for ${reviews.length} users`);
      return reviews;

    } catch (error) {
      this.logger.error('Access review failed', error);
      throw new Error('Access review failed');
    }
  }

  // Private helper methods
  private validateAccessRequest(request: AccessRequest): void {
    if (!request.principalId || !request.resource || !request.action) {
      throw new Error('Invalid access request: missing required fields');
    }

    if (request.requestedAt > new Date()) {
      throw new Error('Access request cannot be in the future');
    }
  }

  private async evaluateAccessPolicies(
    user: User,
    request: AccessRequest
  ): Promise<AccessDecision> {
    let allowed = false;
    let reason = 'No applicable policy';

    // Check role-based access
    const hasRoleAccess = await this.checkRoleBasedAccess(user, request);
    if (hasRoleAccess.allowed) {
      return hasRoleAccess;
    }

    // Check permission-based access
    const hasPermissionAccess = await this.checkPermissionBasedAccess(user, request);
    if (hasPermissionAccess.allowed) {
      return hasPermissionAccess;
    }

    // Check resource-specific policies
    const resourcePolicy = await this.checkResourcePolicy(request);
    if (resourcePolicy.allowed) {
      return resourcePolicy;
    }

    return {
      allowed,
      reason,
      evaluatedAt: new Date()
    };
  }

  private async checkRoleBasedAccess(
    user: User,
    request: AccessRequest
  ): Promise<AccessDecision> {
    // Implement role-based access control logic
    // This is a simplified version
    return {
      allowed: false,
      reason: 'Role-based access not implemented',
      evaluatedAt: new Date()
    };
  }

  private async checkPermissionBasedAccess(
    user: User,
    request: AccessRequest
  ): Promise<AccessDecision> {
    const hasPermission = await this.hasPermission(
      request.principalId,
      request.resource,
      request.action,
      request.context
    );

    return {
      allowed: hasPermission,
      reason: hasPermission ? 'Permission granted' : 'Permission denied',
      evaluatedAt: new Date()
    };
  }

  private async checkResourcePolicy(request: AccessRequest): Promise<AccessDecision> {
    // Implement resource-specific policy logic
    return {
      allowed: false,
      reason: 'Resource policy not implemented',
      evaluatedAt: new Date()
    };
  }

  private async createSession(user: User, context: any): Promise<any> {
    return {
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      ip: context.ip || '',
      userAgent: context.userAgent || ''
    };
  }

  private isSessionExpired(session: any): boolean {
    return session.expiresAt < new Date();
  }

  private async evaluateConditions(conditions: any[], context: any): Promise<boolean> {
    // Implement condition evaluation logic
    return true;
  }

  private async findAccessRequest(requestId: string): Promise<AccessRequest | null> {
    // Implement request finding logic
    return null;
  }

  private async grantTemporaryAccess(request: AccessRequest, reviewer: string): Promise<void> {
    // Implement temporary access grant logic
    this.logger.info(`Temporary access granted`, {
      requestId: request.requestId,
      userId: request.principalId,
      resource: request.resource,
      action: request.action,
      grantedBy: reviewer
    });
  }

  private async analyzeUserAccess(user: User): Promise<AccessReviewFinding[]> {
    const findings: AccessReviewFinding[] = [];

    // Analyze user's permissions and access patterns
    const permissions = await this.getEffectivePermissions(user);

    // Check for overly permissive access
    const adminPermissions = permissions.filter(p =>
      p.resource === '*' || p.action === 'admin' || p.action === 'manage'
    );

    if (adminPermissions.length > 0 && user.roles.some(r => r.role !== 'admin')) {
      findings.push({
        userId: user.id,
        userName: user.username,
        accessType: 'Administrative',
        justification: 'User has administrative permissions',
        riskLevel: 'high',
        recommendation: 'Review and restrict administrative permissions'
      });
    }

    // Check for sensitive resource access
    const sensitiveResources = ['users', 'roles', 'permissions', 'secrets', 'encryption_keys'];
    const sensitiveAccess = permissions.filter(p =>
      sensitiveResources.some(res => p.resource.includes(res))
    );

    if (sensitiveAccess.length > 0) {
      findings.push({
        userId: user.id,
        userName: user.username,
        accessType: 'Sensitive Resources',
        justification: 'User has access to sensitive resources',
        riskLevel: 'medium',
        recommendation: 'Review sensitive access permissions'
      });
    }

    return findings;
  }

  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    this.emit('securityEvent', event);
  }

  // Public methods for IAM operations
  async createUser(user: Partial<User>): Promise<User> {
    return await this.userManagement.createUser(user);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    return await this.userManagement.updateUser(userId, updates);
  }

  async deleteUser(userId: string): Promise<boolean> {
    return await this.userManagement.deleteUser(userId);
  }

  async getUserById(userId: string): Promise<User | null> {
    return await this.userManagement.getUserById(userId);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userManagement.getAllUsers();
  }

  async createRole(role: Partial<Role>): Promise<Role> {
    return await this.roleManagement.createRole(role);
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    return await this.roleManagement.updateRole(roleId, updates);
  }

  async deleteRole(roleId: string): Promise<boolean> {
    return await this.roleManagement.deleteRole(roleId);
  }

  async getRoleById(roleId: string): Promise<Role | null> {
    return await this.roleManagement.getRoleById(roleId);
  }

  async getAllRoles(): Promise<Role[]> {
    return await this.roleManagement.getAllRoles();
  }

  async createPermission(permission: Partial<Permission>): Promise<Permission> {
    return await this.permissionManagement.createPermission(permission);
  }

  async updatePermission(permissionId: string, updates: Partial<Permission>): Promise<Permission> {
    return await this.permissionManagement.updatePermission(permissionId, updates);
  }

  async deletePermission(permissionId: string): Promise<boolean> {
    return await this.permissionManagement.deletePermission(permissionId);
  }

  async getAllPermissions(): Promise<Permission[]> {
    return await this.permissionManagement.getAllPermissions();
  }
}