/**
 * Secrets Manager - Enterprise-grade secret storage and management
 * Provides secure secret storage, rotation, versioning, and access control
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  Secret,
  SecretMetadata,
  SecretValue,
  SecretAccessPolicy,
  RotationPolicy,
  SecretOperation,
  SecretShareRequest,
  TemporaryCredential,
  SecretAccessDeniedError,
  SecretNotFoundError,
  SecurityError,
} from '../types';

// ============================================================================
// STORAGE LAYER ABSTRACTION
// ============================================================================

interface SecretStorage {
  get(secretId: string): Promise<Secret | null>;
  put(secret: Secret): Promise<void>;
  delete(secretId: string): Promise<void>;
  list(filter?: Record<string, any>): Promise<SecretMetadata[]>;
  exists(secretId: string): Promise<boolean>;
}

interface SecretAuditLogger {
  logAccess(
    secretId: string,
    principalId: string,
    operation: SecretOperation,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void>;
}

// ============================================================================
// CLOUDFLARE SECRETS STORAGE IMPLEMENTATION
// ============================================================================

class CloudflareSecretStorage implements SecretStorage {
  private cache: Map<string, Secret> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(private env: any = {}) {}

  async get(secretId: string): Promise<Secret | null> {
    // Check cache first
    const cached = this.cache.get(secretId);
    if (cached) {
      return cached;
    }

    // In a real implementation, this would fetch from Cloudflare Workers Secrets
    // For now, we'll use environment variables as a fallback
    const envValue = this.env[secretId];
    if (envValue) {
      const secret: Secret = {
        currentVersion: {
          value: envValue,
          version: 1,
          createdAt: new Date(),
        },
        accessPolicy: this.getDefaultAccessPolicy(),
        rotationPolicy: this.getDefaultRotationPolicy(),
        ...this.getDefaultMetadata(secretId),
      };
      this.cache.set(secretId, secret);
      return secret;
    }

    return null;
  }

  async put(secret: Secret): Promise<void> {
    // In a real implementation, this would store in Cloudflare Workers Secrets
    this.cache.set(secret.id, secret);
  }

  async delete(secretId: string): Promise<void> {
    this.cache.delete(secretId);
    // In real implementation, would delete from Cloudflare
  }

  async list(filter?: Record<string, any>): Promise<SecretMetadata[]> {
    // Return metadata for cached secrets
    const secrets = Array.from(this.cache.values());
    return secrets.map(s => this.extractMetadata(s));
  }

  async exists(secretId: string): Promise<boolean> {
    const secret = await this.get(secretId);
    return secret !== null;
  }

  private getDefaultAccessPolicy(): SecretAccessPolicy {
    return {
      allowedPrincipals: ['*'],
      allowedIpRanges: ['*'],
      requireMfa: false,
      auditAccess: true,
      allowedOperations: [SecretOperation.READ],
    };
  }

  private getDefaultRotationPolicy(): RotationPolicy {
    return {
      enabled: true,
      intervalDays: 90,
      automaticRotation: false,
      notificationDaysBefore: 7,
      gracePeriodDays: 30,
    };
  }

  private getDefaultMetadata(id: string): Partial<Secret> {
    return {
      id,
      name: id,
      description: `Secret: ${id}`,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      tags: {},
      checksum: '',
      algorithm: 'aes-256-gcm',
    };
  }

  private extractMetadata(secret: Secret): SecretMetadata {
    const { currentVersion, previousVersions, accessPolicy, rotationPolicy, ...metadata } = secret;
    return metadata;
  }
}

// ============================================================================
// IN-MEMORY SECRETS STORAGE (for testing)
// ============================================================================

class InMemorySecretStorage implements SecretStorage {
  private secrets: Map<string, Secret> = new Map();

  async get(secretId: string): Promise<Secret | null> {
    return this.secrets.get(secretId) || null;
  }

  async put(secret: Secret): Promise<void> {
    this.secrets.set(secret.id, secret);
  }

  async delete(secretId: string): Promise<void> {
    this.secrets.delete(secretId);
  }

  async list(filter?: Record<string, any>): Promise<SecretMetadata[]> {
    let secrets = Array.from(this.secrets.values());

    if (filter) {
      secrets = secrets.filter(s => {
        return Object.entries(filter).every(([key, value]) => {
          const secretValue = (s as any)[key];
          return secretValue === value;
        });
      });
    }

    return secrets.map(s => this.extractMetadata(s));
  }

  async exists(secretId: string): Promise<boolean> {
    return this.secrets.has(secretId);
  }

  private extractMetadata(secret: Secret): SecretMetadata {
    const { currentVersion, previousVersions, accessPolicy, rotationPolicy, ...metadata } = secret;
    return metadata;
  }
}

// ============================================================================
// AUDIT LOGGER IMPLEMENTATION
// ============================================================================

class ConsoleAuditLogger implements SecretAuditLogger {
  async logAccess(
    secretId: string,
    principalId: string,
    operation: SecretOperation,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      secretId,
      principalId,
      operation,
      success,
      metadata,
    };

    console.log('[AUDIT]', JSON.stringify(logEntry));
  }
}

// ============================================================================
// SECRETS MANAGER
// ============================================================================

export interface SecretsManagerConfig {
  storage?: SecretStorage;
  auditLogger?: SecretAuditLogger;
  defaultRotationDays?: number;
  encryptionRequired?: boolean;
  accessLoggingEnabled?: boolean;
  maxPreviousVersions?: number;
}

export class SecretsManager {
  private storage: SecretStorage;
  private auditLogger: SecretAuditLogger;
  private config: Required<Omit<SecretsManagerConfig, 'storage' | 'auditLogger'>>;

  constructor(config: SecretsManagerConfig = {}) {
    this.storage = config.storage || new InMemorySecretStorage();
    this.auditLogger = config.auditLogger || new ConsoleAuditLogger();
    this.config = {
      defaultRotationDays: config.defaultRotationDays || 90,
      encryptionRequired: config.encryptionRequired ?? true,
      accessLoggingEnabled: config.accessLoggingEnabled ?? true,
      maxPreviousVersions: config.maxPreviousVersions || 10,
    };
  }

  // ========================================================================
  // SECRET CRUD OPERATIONS
  // ========================================================================

  /**
   * Create a new secret
   */
  async createSecret(params: {
    name: string;
    value: string;
    description?: string;
    createdBy: string;
    accessPolicy?: Partial<SecretAccessPolicy>;
    rotationPolicy?: Partial<RotationPolicy>;
    tags?: Record<string, string>;
  }): Promise<Secret> {
    const secretId = this.generateSecretId(params.name);
    const now = new Date();

    // Check if secret already exists
    const exists = await this.storage.exists(secretId);
    if (exists) {
      throw new SecurityError(`Secret already exists: ${params.name}`, 'SECRET_EXISTS', 409);
    }

    // Create secret with encryption
    const encryptedValue = this.config.encryptionRequired
      ? await this.encryptValue(params.value)
      : params.value;

    const secret: Secret = {
      id: secretId,
      name: params.name,
      description: params.description,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: params.createdBy,
      tags: params.tags || {},
      checksum: this.generateChecksum(params.value),
      algorithm: this.config.encryptionRequired ? 'aes-256-gcm' : 'none',
      currentVersion: {
        value: encryptedValue,
        version: 1,
        createdAt: now,
      },
      accessPolicy: this.buildAccessPolicy(params.accessPolicy),
      rotationPolicy: this.buildRotationPolicy(params.rotationPolicy),
    };

    await this.storage.put(secret);
    await this.logAccess(secretId, params.createdBy, SecretOperation.WRITE, true);

    return secret;
  }

  /**
   * Get a secret by ID
   */
  async getSecret(
    secretId: string,
    principalId: string,
    options?: { includePreviousVersions?: boolean }
  ): Promise<Secret> {
    const secret = await this.storage.get(secretId);
    if (!secret) {
      throw new SecretNotFoundError(secretId);
    }

    // Check access permissions
    await this.validateAccess(secret, principalId, SecretOperation.READ);

    // Update last accessed time
    secret.lastAccessedAt = new Date();
    await this.storage.put(secret);

    // Log access
    await this.logAccess(secretId, principalId, SecretOperation.READ, true);

    // Decrypt value if needed
    if (this.config.encryptionRequired) {
      secret.currentVersion.value = await this.decryptValue(secret.currentVersion.value);
    }

    // Filter out previous versions if not requested
    if (!options?.includePreviousVersions) {
      delete secret.previousVersions;
    } else if (secret.previousVersions) {
      // Decrypt previous versions too
      for (const version of secret.previousVersions) {
        if (this.config.encryptionRequired) {
          version.value = await this.decryptValue(version.value);
        }
      }
    }

    return secret;
  }

  /**
   * Update a secret value
   */
  async updateSecret(
    secretId: string,
    principalId: string,
    updates: {
      value?: string;
      description?: string;
      tags?: Record<string, string>;
    }
  ): Promise<Secret> {
    const secret = await this.storage.get(secretId);
    if (!secret) {
      throw new SecretNotFoundError(secretId);
    }

    // Check access permissions
    await this.validateAccess(secret, principalId, SecretOperation.WRITE);

    const now = new Date();
    const needsNewVersion = updates.value !== undefined;

    if (needsNewVersion) {
      // Archive current version
      if (!secret.previousVersions) {
        secret.previousVersions = [];
      }

      // Decrypt current value for archiving
      const currentValue = this.config.encryptionRequired
        ? await this.decryptValue(secret.currentVersion.value)
        : secret.currentVersion.value;

      secret.previousVersions.push({
        value: currentValue, // Store decrypted in history
        version: secret.currentVersion.version,
        createdAt: secret.currentVersion.createdAt,
      });

      // Trim old versions if needed
      if (secret.previousVersions.length > this.config.maxPreviousVersions) {
        secret.previousVersions = secret.previousVersions.slice(-this.config.maxPreviousVersions);
      }

      // Encrypt new value
      const encryptedValue = this.config.encryptionRequired
        ? await this.encryptValue(updates.value!)
        : updates.value!;

      secret.currentVersion = {
        value: encryptedValue,
        version: secret.version + 1,
        createdAt: now,
      };

      secret.version = secret.version + 1;
      secret.checksum = this.generateChecksum(updates.value!);
      secret.lastRotatedAt = now;

      // Calculate next rotation date
      if (secret.rotationPolicy.enabled) {
        secret.nextRotationAt = new Date(
          now.getTime() + secret.rotationPolicy.intervalDays * 24 * 60 * 60 * 1000
        );
      }
    }

    // Update metadata
    if (updates.description !== undefined) {
      secret.description = updates.description;
    }

    if (updates.tags !== undefined) {
      secret.tags = { ...secret.tags, ...updates.tags };
    }

    secret.updatedAt = now;
    await this.storage.put(secret);
    await this.logAccess(secretId, principalId, SecretOperation.WRITE, true);

    return secret;
  }

  /**
   * Delete a secret
   */
  async deleteSecret(secretId: string, principalId: string): Promise<void> {
    const secret = await this.storage.get(secretId);
    if (!secret) {
      throw new SecretNotFoundError(secretId);
    }

    // Check access permissions
    await this.validateAccess(secret, principalId, SecretOperation.DELETE);

    await this.storage.delete(secretId);
    await this.logAccess(secretId, principalId, SecretOperation.DELETE, true);
  }

  /**
   * List secrets with optional filtering
   */
  async listSecrets(filter?: {
    createdBy?: string;
    tags?: Record<string, string>;
    search?: string;
  }): Promise<SecretMetadata[]> {
    let secrets = await this.storage.list();

    if (filter) {
      secrets = secrets.filter(s => {
        if (filter.createdBy && s.createdBy !== filter.createdBy) {
          return false;
        }

        if (filter.tags) {
          const matchesAllTags = Object.entries(filter.tags).every(([key, value]) => {
            return s.tags[key] === value;
          });
          if (!matchesAllTags) {
            return false;
          }
        }

        if (filter.search) {
          const searchLower = filter.search.toLowerCase();
          const matchesSearch =
            s.name.toLowerCase().includes(searchLower) ||
            s.description?.toLowerCase().includes(searchLower);
          if (!matchesSearch) {
            return false;
          }
        }

        return true;
      });
    }

    return secrets;
  }

  // ========================================================================
  // SECRET ROTATION
  // ========================================================================

  /**
   * Rotate a secret with a new value
   */
  async rotateSecret(
    secretId: string,
    principalId: string,
    newValue: string
  ): Promise<Secret> {
    const secret = await this.storage.get(secretId);
    if (!secret) {
      throw new SecretNotFoundError(secretId);
    }

    // Check access permissions
    await this.validateAccess(secret, principalId, SecretOperation.ROTATE);

    // Archive current version
    if (!secret.previousVersions) {
      secret.previousVersions = [];
    }

    const currentValue = this.config.encryptionRequired
      ? await this.decryptValue(secret.currentVersion.value)
      : secret.currentVersion.value;

    secret.previousVersions.push({
      value: currentValue,
      version: secret.currentVersion.version,
      createdAt: secret.currentVersion.createdAt,
    });

    // Trim old versions
    if (secret.previousVersions.length > this.config.maxPreviousVersions) {
      secret.previousVersions = secret.previousVersions.slice(-this.config.maxPreviousVersions);
    }

    // Encrypt and store new value
    const encryptedValue = this.config.encryptionRequired
      ? await this.encryptValue(newValue)
      : newValue;

    const now = new Date();
    secret.currentVersion = {
      value: encryptedValue,
      version: secret.version + 1,
      createdAt: now,
    };

    secret.version = secret.version + 1;
    secret.updatedAt = now;
    secret.lastRotatedAt = now;
    secret.checksum = this.generateChecksum(newValue);

    // Calculate next rotation date
    if (secret.rotationPolicy.enabled) {
      secret.nextRotationAt = new Date(
        now.getTime() + secret.rotationPolicy.intervalDays * 24 * 60 * 60 * 1000
      );
    }

    await this.storage.put(secret);
    await this.logAccess(secretId, principalId, SecretOperation.ROTATE, true);

    return secret;
  }

  /**
   * Get secrets that need rotation
   */
  async getSecretsNeedingRotation(): Promise<Secret[]> {
    const secrets = await this.storage.list();
    const now = new Date();
    const needsRotation: Secret[] = [];

    for (const metadata of secrets) {
      const secret = await this.storage.get(metadata.id);
      if (secret && secret.rotationPolicy.enabled) {
        if (secret.nextRotationAt && secret.nextRotationAt <= now) {
          needsRotation.push(secret);
        } else if (secret.lastRotatedAt) {
          const daysSinceRotation =
            (now.getTime() - secret.lastRotatedAt.getTime()) / (24 * 60 * 60 * 1000);
          if (daysSinceRotation >= secret.rotationPolicy.intervalDays) {
            needsRotation.push(secret);
          }
        }
      }
    }

    return needsRotation;
  }

  // ========================================================================
  // SECRET SHARING
  // ========================================================================

  /**
   * Create a temporary credential for secret access
   */
  async createTemporaryCredential(params: {
    secretId: string;
    principalId: string;
    requesterId: string;
    expiresAt: Date;
    permissions: SecretOperation[];
    maxUses?: number;
    justification?: string;
  }): Promise<TemporaryCredential> {
    const secret = await this.storage.get(params.secretId);
    if (!secret) {
      throw new SecretNotFoundError(params.secretId);
    }

    // Check if requester can share
    await this.validateAccess(secret, params.requesterId, SecretOperation.SHARE);

    // Generate temporary token
    const token = this.generateSecureToken();
    const credentialId = uuidv4();

    const credential: TemporaryCredential = {
      credentialId,
      secretId: params.secretId,
      principalId: params.principalId,
      token,
      expiresAt: params.expiresAt,
      permissions: params.permissions,
      createdAt: new Date(),
      maxUses: params.maxUses,
      useCount: 0,
    };

    // In a real implementation, store this securely
    // For now, return it directly
    await this.logAccess(
      params.secretId,
      params.requesterId,
      SecretOperation.SHARE,
      true,
      { targetPrincipal: params.principalId }
    );

    return credential;
  }

  /**
   * Validate and use a temporary credential
   */
  async useTemporaryCredential(
    credential: TemporaryCredential,
    secretId: string,
    operation: SecretOperation
  ): Promise<boolean> {
    // Check expiration
    if (new Date() > credential.expiresAt) {
      throw new SecurityError('Temporary credential has expired', 'CREDENTIAL_EXPIRED', 401);
    }

    // Check permissions
    if (!credential.permissions.includes(operation)) {
      throw new SecurityError(
        `Operation ${operation} not permitted by credential`,
        'INSUFFICIENT_PERMISSIONS',
        403
      );
    }

    // Check usage limit
    if (credential.maxUses && credential.useCount >= credential.maxUses) {
      throw new SecurityError('Temporary credential usage limit exceeded', 'CREDENTIAL_EXHAUSTED', 401);
    }

    // Check if credential applies to the requested secret
    if (credential.secretId !== secretId) {
      throw new SecurityError('Credential not valid for this secret', 'INVALID_CREDENTIAL', 403);
    }

    // Increment use count
    credential.useCount++;

    // Log the access
    await this.logAccess(secretId, credential.principalId, operation, true, {
      viaCredential: credential.credentialId,
    });

    return true;
  }

  // ========================================================================
  // ACCESS CONTROL
  // ========================================================================

  /**
   * Check if a principal has access to a secret
   */
  async checkAccess(
    secretId: string,
    principalId: string,
    operation: SecretOperation
  ): Promise<boolean> {
    try {
      const secret = await this.storage.get(secretId);
      if (!secret) {
        return false;
      }

      await this.validateAccess(secret, principalId, operation);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Grant access to a secret for a principal
   */
  async grantAccess(
    secretId: string,
    principalId: string,
    permissions: SecretOperation[],
    grantedBy: string
  ): Promise<void> {
    const secret = await this.storage.get(secretId);
    if (!secret) {
      throw new SecretNotFoundError(secretId);
    }

    // Check if grantor has permission to share
    await this.validateAccess(secret, grantedBy, SecretOperation.SHARE);

    // Add principal to allowed principals
    if (!secret.accessPolicy.allowedPrincipals.includes(principalId)) {
      secret.accessPolicy.allowedPrincipals.push(principalId);
    }

    // Update allowed operations
    const currentOps = new Set(secret.accessPolicy.allowedOperations);
    permissions.forEach(op => currentOps.add(op));
    secret.accessPolicy.allowedOperations = Array.from(currentOps);

    secret.updatedAt = new Date();
    await this.storage.put(secret);

    await this.logAccess(secretId, grantedBy, SecretOperation.SHARE, true, {
      targetPrincipal: principalId,
      permissions,
    });
  }

  /**
   * Revoke access to a secret for a principal
   */
  async revokeAccess(
    secretId: string,
    principalId: string,
    revokedBy: string
  ): Promise<void> {
    const secret = await this.storage.get(secretId);
    if (!secret) {
      throw new SecretNotFoundError(secretId);
    }

    // Check if revoker has permission to share
    await this.validateAccess(secret, revokedBy, SecretOperation.SHARE);

    // Remove principal from allowed principals
    secret.accessPolicy.allowedPrincipals = secret.accessPolicy.allowedPrincipals.filter(
      p => p !== principalId
    );

    secret.updatedAt = new Date();
    await this.storage.put(secret);

    await this.logAccess(secretId, revokedBy, SecretOperation.SHARE, true, {
      targetPrincipal: principalId,
      action: 'revoke',
    });
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private async validateAccess(
    secret: Secret,
    principalId: string,
    operation: SecretOperation
  ): Promise<void> {
    const policy = secret.accessPolicy;

    // Check if operation is allowed
    if (!policy.allowedOperations.includes(operation)) {
      throw new SecretAccessDeniedError(secret.id, principalId);
    }

    // Check if principal is allowed
    if (!policy.allowedPrincipals.includes('*') && !policy.allowedPrincipals.includes(principalId)) {
      throw new SecretAccessDeniedError(secret.id, principalId);
    }

    // MFA check would go here if required
    // IP range check would go here if configured
  }

  private buildAccessPolicy(policy?: Partial<SecretAccessPolicy>): SecretAccessPolicy {
    return {
      allowedPrincipals: policy?.allowedPrincipals || ['*'],
      allowedIpRanges: policy?.allowedIpRanges || ['*'],
      requireMfa: policy?.requireMfa ?? false,
      auditAccess: policy?.auditAccess ?? true,
      maxTtl: policy?.maxTtl,
      allowedOperations: policy?.allowedOperations || [SecretOperation.READ],
    };
  }

  private buildRotationPolicy(policy?: Partial<RotationPolicy>): RotationPolicy {
    return {
      enabled: policy?.enabled ?? true,
      intervalDays: policy?.intervalDays || this.config.defaultRotationDays,
      automaticRotation: policy?.automaticRotation ?? false,
      notificationDaysBefore: policy?.notificationDaysBefore || 7,
      gracePeriodDays: policy?.gracePeriodDays || 30,
    };
  }

  private generateSecretId(name: string): string {
    // Convert name to a safe ID format
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  private generateChecksum(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private async encryptValue(value: string): Promise<string> {
    // In a real implementation, this would use proper encryption
    // For now, we'll use a simple encoding
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex'),
    });
  }

  private async decryptValue(encryptedValue: string): Promise<string> {
    try {
      const { iv, data, authTag } = JSON.parse(encryptedValue);
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.getEncryptionKey(),
        Buffer.from(iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      throw new SecurityError('Failed to decrypt secret value', 'DECRYPTION_ERROR', 500);
    }
  }

  private getEncryptionKey(): Buffer {
    // In a real implementation, this would come from a KMS
    // For now, use a hardcoded key (DO NOT USE IN PRODUCTION)
    return crypto.scryptSync('default-key', 'salt', 32);
  }

  private async logAccess(
    secretId: string,
    principalId: string,
    operation: SecretOperation,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (this.config.accessLoggingEnabled) {
      await this.auditLogger.logAccess(secretId, principalId, operation, success, metadata);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { CloudflareSecretStorage, InMemorySecretStorage, ConsoleAuditLogger };
