/**
 * Plugin Permission System
 *
 * Comprehensive permission management for plugin sandboxing:
 * - Resource access control
 * - API exposure management
 * - Capability-based security
 * - Permission validation and enforcement
 * - Audit logging
 * - Dynamic permission grants
 */

import { z } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('Permissions');

// ============================================================================
// Permission Definitions
// ============================================================================

export type PermissionScope =
  // File System
  | 'fs.read'
  | 'fs.write'
  | 'fs.delete'
  | 'fs.list'
  // Network
  | 'network.http'
  | 'network.https'
  | 'network.websocket'
  | 'network.dns'
  // Storage
  | 'storage.kv'
  | 'storage.durable'
  | 'storage.d1'
  | 'storage.r2'
  // System
  | 'system.env'
  | 'system.exec'
  | 'system.process'
  | 'system.signal'
  // Platform APIs
  | 'api.ai'
  | 'api.agent'
  | 'api.codegen'
  | 'api.webhook'
  | 'api.analytics'
  | 'api.auth'
  // ClaudeFlare Specific
  | 'claudeflare.workspace'
  | 'claudeflare.project'
  | 'claudeflare.deployment'
  | 'claudeflare.database'
  | 'claudeflare.cache'
  | 'claudeflare.queue';

export type ResourceType = 'file' | 'directory' | 'url' | 'storage-key' | 'env' | 'api' | 'service';

export interface Permission {
  scope: PermissionScope;
  resource?: string;
  pattern?: string;
  constraints?: PermissionConstraints;
  description?: string;
  dangerous?: boolean;
}

export interface PermissionConstraints {
  // Time constraints
  expiresAt?: Date;
  maxDuration?: number;
  validDuring?: { start: string; end: string };

  // Rate limits
  maxCalls?: number;
  maxCallsPerMinute?: number;
  maxCallsPerHour?: number;
  maxCallsPerDay?: number;

  // Resource limits
  maxBytesRead?: number;
  maxBytesWritten?: number;
  maxFileSize?: number;

  // Network constraints
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowedPorts?: number[];
  blockedPorts?: number[];

  // Data constraints
  allowedPaths?: string[];
  blockedPaths?: string[];
  allowedKeys?: string[];
  blockedKeys?: string[];
  allowedHeaders?: string[];
  blockedHeaders?: string[];

  // Execution constraints
  maxExecutionTime?: number;
  maxMemoryUsage?: number;
  maxCpuUsage?: number;
}

export interface PermissionGrant {
  permission: Permission;
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  revoked?: boolean;
  revokedAt?: Date;
  revokedBy?: string;
  reason?: string;
  auditId: string;
}

export interface PermissionRequest {
  pluginId: string;
  permissions: Permission[];
  reason?: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  respondedAt?: Date;
  respondedBy?: string;
  expiresAt?: Date;
}

export interface PermissionPolicy {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  defaultAllow: boolean;
  precedence: number;
  appliesTo: string[]; // plugin IDs or patterns
}

// ============================================================================
// Permission Registry
// ============================================================================

export const PERMISSION_DEFINITIONS: Record<PermissionScope, {
  description: string;
  dangerous: boolean;
  category: string;
  constraints?: Partial<PermissionConstraints>;
}> = {
  // File System
  'fs.read': {
    description: 'Read files from the file system',
    dangerous: true,
    category: 'filesystem'
  },
  'fs.write': {
    description: 'Write files to the file system',
    dangerous: true,
    category: 'filesystem'
  },
  'fs.delete': {
    description: 'Delete files from the file system',
    dangerous: true,
    category: 'filesystem'
  },
  'fs.list': {
    description: 'List directory contents',
    dangerous: false,
    category: 'filesystem'
  },

  // Network
  'network.http': {
    description: 'Make HTTP requests',
    dangerous: true,
    category: 'network'
  },
  'network.https': {
    description: 'Make HTTPS requests',
    dangerous: false,
    category: 'network'
  },
  'network.websocket': {
    description: 'Open WebSocket connections',
    dangerous: true,
    category: 'network'
  },
  'network.dns': {
    description: 'Perform DNS lookups',
    dangerous: false,
    category: 'network'
  },

  // Storage
  'storage.kv': {
    description: 'Access Cloudflare KV storage',
    dangerous: false,
    category: 'storage'
  },
  'storage.durable': {
    description: 'Access Durable Objects',
    dangerous: false,
    category: 'storage'
  },
  'storage.d1': {
    description: 'Access D1 database',
    dangerous: false,
    category: 'storage'
  },
  'storage.r2': {
    description: 'Access R2 object storage',
    dangerous: false,
    category: 'storage'
  },

  // System
  'system.env': {
    description: 'Read environment variables',
    dangerous: true,
    category: 'system'
  },
  'system.exec': {
    description: 'Execute system commands',
    dangerous: true,
    category: 'system',
    constraints: { maxExecutionTime: 30000 } // 30 seconds max
  },
  'system.process': {
    description: 'Access process information',
    dangerous: false,
    category: 'system'
  },
  'system.signal': {
    description: 'Send signals to processes',
    dangerous: true,
    category: 'system'
  },

  // Platform APIs
  'api.ai': {
    description: 'Access AI/ML APIs',
    dangerous: false,
    category: 'platform'
  },
  'api.agent': {
    description: 'Access agent APIs',
    dangerous: false,
    category: 'platform'
  },
  'api.codegen': {
    description: 'Access code generation APIs',
    dangerous: false,
    category: 'platform'
  },
  'api.webhook': {
    description: 'Access webhook APIs',
    dangerous: false,
    category: 'platform'
  },
  'api.analytics': {
    description: 'Access analytics APIs',
    dangerous: false,
    category: 'platform'
  },
  'api.auth': {
    description: 'Access authentication APIs',
    dangerous: true,
    category: 'platform'
  },

  // ClaudeFlare Specific
  'claudeflare.workspace': {
    description: 'Access workspace data',
    dangerous: true,
    category: 'claudeflare'
  },
  'claudeflare.project': {
    description: 'Access project data',
    dangerous: true,
    category: 'claudeflare'
  },
  'claudeflare.deployment': {
    description: 'Manage deployments',
    dangerous: true,
    category: 'claudeflare'
  },
  'claudeflare.database': {
    description: 'Access database',
    dangerous: true,
    category: 'claudeflare'
  },
  'claudeflare.cache': {
    description: 'Access cache',
    dangerous: false,
    category: 'claudeflare'
  },
  'claudeflare.queue': {
    description: 'Access message queues',
    dangerous: false,
    category: 'claudeflare'
  }
};

// ============================================================================
// Permission Manager
// ============================================================================

export interface PermissionManagerConfig {
  autoApproveSafe?: boolean;
  requireExplicitDangerous?: boolean;
  grantExpiration?: number;
  auditLogEnabled?: boolean;
  defaultDeny?: boolean;
}

export class PermissionManager {
  private grants: Map<string, PermissionGrant[]> = new Map();
  private policies: Map<string, PermissionPolicy> = new Map();
  private requests: Map<string, PermissionRequest> = new Map();
  private auditLog: AuditEntry[] = [];
  private config: Required<PermissionManagerConfig>;

  constructor(config: PermissionManagerConfig = {}) {
    this.config = {
      autoApproveSafe: config.autoApproveSafe ?? true,
      requireExplicitDangerous: config.requireExplicitDangerous ?? true,
      grantExpiration: config.grantExpiration ?? 3600000, // 1 hour
      auditLogEnabled: config.auditLogEnabled ?? true,
      defaultDeny: config.defaultDeny ?? true
    };

    // Initialize default policies
    this.initializeDefaultPolicies();
  }

  // ========================================================================
  // Permission Checking
  // ========================================================================

  /**
   * Check if a plugin has a specific permission
   */
  async checkPermission(
    pluginId: string,
    scope: PermissionScope,
    resource?: string,
    context?: Record<string, unknown>
  ): Promise<boolean> {
    const permission: Permission = { scope, resource };
    const result = await this.evaluatePermission(pluginId, permission, context);

    if (this.config.auditLogEnabled) {
      this.logAudit({
        type: 'permission_check',
        pluginId,
        permission,
        granted: result.allowed,
        reason: result.reason,
        timestamp: new Date(),
        context
      });
    }

    return result.allowed;
  }

  /**
   * Check multiple permissions at once
   */
  async checkPermissions(
    pluginId: string,
    permissions: Array<{ scope: PermissionScope; resource?: string }>,
    context?: Record<string, unknown>
  ): Promise<Map<PermissionScope, boolean>> {
    const results = new Map<PermissionScope, boolean>();

    await Promise.all(
      permissions.map(async ({ scope, resource }) => {
        const allowed = await this.checkPermission(pluginId, scope, resource, context);
        results.set(scope, allowed);
      })
    );

    return results;
  }

  /**
   * Require a permission (throws if not granted)
   */
  async requirePermission(
    pluginId: string,
    scope: PermissionScope,
    resource?: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    const allowed = await this.checkPermission(pluginId, scope, resource, context);
    if (!allowed) {
      const error = new PermissionDeniedError(
        `Plugin "${pluginId}" does not have permission "${scope}"${resource ? ` for resource "${resource}"` : ''}`
      );
      throw error;
    }
  }

  // ========================================================================
  // Permission Grants
  // ========================================================================

  /**
   * Grant a permission to a plugin
   */
  grantPermission(
    pluginId: string,
    permission: Permission,
    options: { grantedBy: string; expiresAt?: Date; reason?: string }
  ): PermissionGrant {
    const grant: PermissionGrant = {
      permission,
      grantedBy: options.grantedBy,
      grantedAt: new Date(),
      expiresAt: options.expiresAt,
      auditId: this.generateAuditId(),
      reason: options.reason
    };

    const pluginGrants = this.grants.get(pluginId) || [];
    pluginGrants.push(grant);
    this.grants.set(pluginId, pluginGrants);

    if (this.config.auditLogEnabled) {
      this.logAudit({
        type: 'permission_grant',
        pluginId,
        permission,
        grantedBy: options.grantedBy,
        expiresAt: options.expiresAt,
        reason: options.reason,
        timestamp: new Date()
      });
    }

    logger.info('Permission granted', { pluginId, permission, grantedBy: options.grantedBy });

    return grant;
  }

  /**
   * Grant multiple permissions at once
   */
  grantPermissions(
    pluginId: string,
    permissions: Permission[],
    options: { grantedBy: string; expiresAt?: Date; reason?: string }
  ): PermissionGrant[] {
    return permissions.map(permission =>
      this.grantPermission(pluginId, permission, options)
    );
  }

  /**
   * Revoke a permission grant
   */
  revokePermission(
    pluginId: string,
    auditId: string,
    revokedBy: string,
    reason?: string
  ): boolean {
    const pluginGrants = this.grants.get(pluginId);
    if (!pluginGrants) return false;

    const grant = pluginGrants.find(g => g.auditId === auditId);
    if (!grant) return false;

    grant.revoked = true;
    grant.revokedAt = new Date();
    grant.revokedBy = revokedBy;
    grant.reason = reason;

    if (this.config.auditLogEnabled) {
      this.logAudit({
        type: 'permission_revoke',
        pluginId,
        permission: grant.permission,
        revokedBy,
        reason,
        timestamp: new Date()
      });
    }

    logger.info('Permission revoked', { pluginId, auditId, revokedBy });

    return true;
  }

  /**
   * Revoke all permissions for a plugin
   */
  revokeAllPermissions(pluginId: string, revokedBy: string, reason?: string): number {
    const pluginGrants = this.grants.get(pluginId);
    if (!pluginGrants) return 0;

    let count = 0;
    for (const grant of pluginGrants) {
      if (!grant.revoked) {
        grant.revoked = true;
        grant.revokedAt = new Date();
        grant.revokedBy = revokedBy;
        grant.reason = reason;
        count++;
      }
    }

    logger.info('All permissions revoked', { pluginId, count, revokedBy });

    return count;
  }

  /**
   * Get all grants for a plugin
   */
  getGrants(pluginId: string, includeRevoked = false): PermissionGrant[] {
    const pluginGrants = this.grants.get(pluginId) || [];
    if (includeRevoked) return pluginGrants;
    return pluginGrants.filter(g => !g.revoked);
  }

  // ========================================================================
  // Permission Requests
  // ========================================================================

  /**
   * Request permissions for a plugin
   */
  requestPermissions(
    pluginId: string,
    permissions: Permission[],
    reason?: string
  ): PermissionRequest {
    const request: PermissionRequest = {
      pluginId,
      permissions,
      reason,
      requestedAt: new Date(),
      status: 'pending',
      expiresAt: new Date(Date.now() + this.config.grantExpiration)
    };

    this.requests.set(this.generateRequestId(pluginId, permissions), request);

    if (this.config.auditLogEnabled) {
      this.logAudit({
        type: 'permission_request',
        pluginId,
        permissions,
        reason,
        timestamp: new Date()
      });
    }

    logger.info('Permission request created', { pluginId, permissions });

    return request;
  }

  /**
   * Approve a permission request
   */
  async approveRequest(
    request: PermissionRequest,
    approvedBy: string
  ): Promise<PermissionGrant[]> {
    if (request.status !== 'pending') {
      throw new Error('Request is not pending');
    }

    request.status = 'approved';
    request.respondedAt = new Date();
    request.respondedBy = approvedBy;

    const grants = this.grantPermissions(
      request.pluginId,
      request.permissions,
      {
        grantedBy: approvedBy,
        expiresAt: request.expiresAt,
        reason: request.reason
      }
    );

    logger.info('Permission request approved', {
      pluginId: request.pluginId,
      approvedBy,
      count: grants.length
    });

    return grants;
  }

  /**
   * Deny a permission request
   */
  denyRequest(request: PermissionRequest, deniedBy: string, reason?: string): void {
    if (request.status !== 'pending') {
      throw new Error('Request is not pending');
    }

    request.status = 'denied';
    request.respondedAt = new Date();
    request.respondedBy = deniedBy;

    if (this.config.auditLogEnabled) {
      this.logAudit({
        type: 'permission_request_denied',
        pluginId: request.pluginId,
        permissions: request.permissions,
        deniedBy,
        reason,
        timestamp: new Date()
      });
    }

    logger.info('Permission request denied', {
      pluginId: request.pluginId,
      deniedBy,
      reason
    });
  }

  // ========================================================================
  // Policy Management
  // ========================================================================

  /**
   * Add a permission policy
   */
  addPolicy(policy: PermissionPolicy): void {
    this.policies.set(policy.id, policy);
    logger.info('Policy added', { policyId: policy.id, name: policy.name });
  }

  /**
   * Remove a permission policy
   */
  removePolicy(policyId: string): boolean {
    const result = this.policies.delete(policyId);
    if (result) {
      logger.info('Policy removed', { policyId });
    }
    return result;
  }

  /**
   * Get a policy by ID
   */
  getPolicy(policyId: string): PermissionPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all policies
   */
  getPolicies(): PermissionPolicy[] {
    return Array.from(this.policies.values()).sort((a, b) => b.precedence - a.precedence);
  }

  // ========================================================================
  // Audit Log
  // ========================================================================

  /**
   * Get audit log entries
   */
  getAuditLog(options: {
    pluginId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): AuditEntry[] {
    let entries = this.auditLog;

    if (options.pluginId) {
      entries = entries.filter(e => e.pluginId === options.pluginId);
    }
    if (options.type) {
      entries = entries.filter(e => e.type === options.type);
    }
    if (options.startDate) {
      entries = entries.filter(e => e.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      entries = entries.filter(e => e.timestamp <= options.endDate!);
    }

    entries = entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async evaluatePermission(
    pluginId: string,
    permission: Permission,
    context?: Record<string, unknown>
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check explicit grants first
    const grants = this.getGrants(pluginId);
    for (const grant of grants) {
      if (this.permissionMatches(grant.permission, permission)) {
        // Check if expired
        if (grant.expiresAt && grant.expiresAt < new Date()) {
          continue;
        }

        // Check constraints
        if (grant.permission.constraints) {
          const constraintResult = this.checkConstraints(
            grant.permission.constraints,
            permission,
            context
          );
          if (!constraintResult.allowed) {
            return {
              allowed: false,
              reason: `Constraint check failed: ${constraintResult.reason}`
            };
          }
        }

        return { allowed: true };
      }
    }

    // Check policies
    const policies = this.getPolicies();
    for (const policy of policies) {
      if (this.policyApplies(policy, pluginId)) {
        for (const policyPermission of policy.permissions) {
          if (this.permissionMatches(policyPermission, permission)) {
            if (policyPermission.constraints) {
              const constraintResult = this.checkConstraints(
                policyPermission.constraints,
                permission,
                context
              );
              if (!constraintResult.allowed) {
                continue;
              }
            }
            return { allowed: true, reason: `Granted by policy: ${policy.name}` };
          }
        }
      }
    }

    // Default deny
    return { allowed: false, reason: this.config.defaultDeny ? 'Default deny policy' : 'No matching grant' };
  }

  private permissionMatches(granted: Permission, requested: Permission): boolean {
    if (granted.scope !== requested.scope) {
      return false;
    }

    // Check resource/pattern match
    if (granted.resource && requested.resource) {
      if (granted.pattern) {
        const regex = new RegExp(granted.pattern);
        return regex.test(requested.resource);
      }
      return granted.resource === requested.resource;
    }

    return true;
  }

  private policyApplies(policy: PermissionPolicy, pluginId: string): boolean {
    return policy.appliesTo.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(pluginId);
    });
  }

  private checkConstraints(
    constraints: PermissionConstraints,
    permission: Permission,
    context?: Record<string, unknown>
  ): { allowed: boolean; reason?: string } {
    const now = Date.now();

    // Time constraints
    if (constraints.expiresAt && constraints.expiresAt.getTime() < now) {
      return { allowed: false, reason: 'Permission expired' };
    }

    // Domain constraints
    if (permission.resource && constraints.allowedDomains) {
      const url = new URL(permission.resource);
      if (!constraints.allowedDomains.includes(url.hostname)) {
        return { allowed: false, reason: 'Domain not in allowlist' };
      }
    }

    if (permission.resource && constraints.blockedDomains) {
      const url = new URL(permission.resource);
      if (constraints.blockedDomains.includes(url.hostname)) {
        return { allowed: false, reason: 'Domain in blocklist' };
      }
    }

    // Path constraints
    if (permission.resource && constraints.allowedPaths) {
      const matches = constraints.allowedPaths.some(path => permission.resource?.startsWith(path));
      if (!matches) {
        return { allowed: false, reason: 'Path not in allowlist' };
      }
    }

    if (permission.resource && constraints.blockedPaths) {
      const matches = constraints.blockedPaths.some(path => permission.resource?.startsWith(path));
      if (matches) {
        return { allowed: false, reason: 'Path in blocklist' };
      }
    }

    return { allowed: true };
  }

  private logAudit(entry: AuditEntry): void {
    this.auditLog.push(entry);

    // Keep only last 10,000 entries
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }
  }

  private initializeDefaultPolicies(): void {
    // Safe operations policy
    this.addPolicy({
      id: 'safe-operations',
      name: 'Safe Operations',
      description: 'Allow safe operations for all plugins',
      permissions: [
        { scope: 'network.https' },
        { scope: 'storage.kv' },
        { scope: 'cache.read' }
      ],
      defaultAllow: false,
      precedence: 100,
      appliesTo: ['*']
    });
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(pluginId: string, permissions: Permission[]): string {
    const hash = this.hashPermissions(permissions);
    return `req_${pluginId}_${hash}`;
  }

  private hashPermissions(permissions: Permission[]): string {
    return permissions
      .map(p => p.scope)
      .sort()
      .join(',')
      .replace(/[^a-z0-9,]/gi, '');
  }
}

// ============================================================================
// Types
// ============================================================================

export interface AuditEntry {
  type: string;
  pluginId: string;
  permission?: Permission;
  permissions?: Permission[];
  granted?: boolean;
  grantedBy?: string;
  revokedBy?: string;
  reason?: string;
  expiresAt?: Date;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export class PermissionExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionExpiredError';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse permission string (e.g., "fs.read:/path/to/file")
 */
export function parsePermissionString(str: string): { scope: PermissionScope; resource?: string } {
  const [scope, resource] = str.split(':') as [PermissionScope, string | undefined];
  return { scope, resource };
}

/**
 * Create permission string
 */
export function createPermissionString(scope: PermissionScope, resource?: string): string {
  return resource ? `${scope}:${resource}` : scope;
}

/**
 * Check if a permission is dangerous
 */
export function isDangerousPermission(scope: PermissionScope): boolean {
  return PERMISSION_DEFINITIONS[scope]?.dangerous ?? false;
}

/**
 * Get permission description
 */
export function getPermissionDescription(scope: PermissionScope): string {
  return PERMISSION_DEFINITIONS[scope]?.description ?? 'Unknown permission';
}

/**
 * Get all permissions in a category
 */
export function getPermissionsByCategory(category: string): PermissionScope[] {
  return Object.entries(PERMISSION_DEFINITIONS)
    .filter(([_, def]) => def.category === category)
    .map(([scope]) => scope as PermissionScope);
}
