/**
 * API Key Management
 *
 * Secure API key generation, validation, and management.
 * Uses SHA-256 hashing and secure random generation.
 */

import type {
  APIKey,
  APIKeyType,
  CreateAPIKeyRequest,
  APIKeyResponse,
  Permission,
  AuthErrorCode,
} from './types';
import { AuthError } from './types';

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * API key prefix types
 */
const API_KEY_PREFIXES: Record<APIKeyType, string> = {
  personal: 'pk',
  organization: 'ok',
  service: 'sk',
  test: 'tk',
};

/**
 * Generate secure API key
 */
export async function generateAPIKey(keyType: APIKeyType): Promise<string> {
  // Generate 32 bytes of random data
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to hex
  const hex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

  // Format: {prefix}_{timestamp}_{random}
  const prefix = API_KEY_PREFIXES[keyType];
  const timestamp = Date.now().toString(16);
  const random = hex;

  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Extract prefix from API key
 */
export function extractAPIKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 8);
}

/**
 * Hash API key using SHA-256
 */
export async function hashAPIKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verify API key against hash
 */
export async function verifyAPIKey(apiKey: string, keyHash: string): Promise<boolean> {
  const computedHash = await hashAPIKey(apiKey);
  return computedHash === keyHash;
}

// ============================================================================
// KEY VALIDATION
// ============================================================================

/**
 * Validate API key format
 */
export function validateAPIKeyFormat(apiKey: string): boolean {
  // Format: {prefix}_{timestamp}_{random}
  const parts = apiKey.split('_');
  if (parts.length !== 3) {
    return false;
  }

  const [prefix, timestamp, random] = parts;

  // Check prefix
  const validPrefixes = Object.values(API_KEY_PREFIXES);
  if (!validPrefixes.includes(prefix)) {
    return false;
  }

  // Check timestamp (hex)
  if (!/^[0-9a-f]+$/.test(timestamp)) {
    return false;
  }

  // Check random part (64 hex chars)
  if (!/^[0-9a-f]{64}$/.test(random)) {
    return false;
  }

  return true;
}

/**
 * Get API key type from prefix
 */
export function getAPIKeyTypeFromPrefix(prefix: string): APIKeyType | null {
  for (const [type, typePrefix] of Object.entries(API_KEY_PREFIXES)) {
    if (prefix.startsWith(typePrefix)) {
      return type as APIKeyType;
    }
  }
  return null;
}

/**
 * Check if API key is expired
 */
export function isAPIKeyExpired(apiKey: APIKey): boolean {
  if (!apiKey.expiresAt) {
    return false;
  }
  return Date.now() > apiKey.expiresAt;
}

/**
 * Check if API key is valid
 */
export function isAPIKeyValid(apiKey: APIKey): boolean {
  return !apiKey.revoked && !isAPIKeyExpired(apiKey);
}

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * API Key Manager class
 */
export class APIKeyManager {
  private kv: KVNamespace;
  private db?: D1Database;

  constructor(kv: KVNamespace, db?: D1Database) {
    this.kv = kv;
    this.db = db;
  }

  /**
   * Create API key
   */
  async createAPIKey(
    request: CreateAPIKeyRequest,
    userId: string,
    organizationId?: string
  ): Promise<{ apiKey: string; response: APIKeyResponse }> {
    // Validate request
    this.validateCreateRequest(request);

    // Check user's API key limit
    const count = await this.getUserAPIKeyCount(userId, organizationId);
    const limit = this.getAPIKeyLimit(request.keyType, organizationId);

    if (count >= limit) {
      throw new AuthError(
        'INVALID_API_KEY',
        'API key limit reached',
        400,
        { limit, current: count }
      );
    }

    // Generate API key
    const key = await generateAPIKey(request.keyType);
    const keyHash = await hashAPIKey(key);
    const keyPrefix = extractAPIKeyPrefix(key);
    const id = crypto.randomUUID();

    const apiKey: APIKey = {
      id,
      userId,
      organizationId,
      keyType: request.keyType,
      keyPrefix,
      keyHash,
      name: request.name,
      description: request.description,
      permissions: request.permissions,
      rateLimit: request.rateLimit,
      scopes: request.scopes,
      expiresAt: request.expiresAt,
      createdAt: Date.now(),
      revoked: false,
    };

    // Store in KV (cache)
    await this.kv.put(
      `api_key:${id}`,
      JSON.stringify(apiKey),
      {
        expirationTtl: apiKey.expiresAt
          ? Math.floor((apiKey.expiresAt - Date.now()) / 1000)
          : undefined,
      }
    );

    // Store in D1 (persistent)
    if (this.db) {
      await this.db
        .prepare(
          `INSERT INTO api_keys (
            id, user_id, organization_id, key_type, key_prefix, key_hash,
            name, description, permissions, rate_limit, scopes, expires_at,
            created_at, revoked
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          apiKey.id,
          apiKey.userId,
          apiKey.organizationId || null,
          apiKey.keyType,
          apiKey.keyPrefix,
          apiKey.keyHash,
          apiKey.name,
          apiKey.description || null,
          JSON.stringify(apiKey.permissions),
          JSON.stringify(apiKey.rateLimit || {}),
          JSON.stringify(apiKey.scopes),
          apiKey.expiresAt || null,
          apiKey.createdAt,
          apiKey.revoked ? 1 : 0
        )
        .run();
    }

    // Index by user
    await this.kv.put(
      `user_api_keys:${userId}`,
      JSON.stringify(await this.getUserAPIKeys(userId)),
      { expirationTtl: 3600 }
    );

    return {
      apiKey: key,
      response: this.toResponse(apiKey),
    };
  }

  /**
   * Get API key by ID
   */
  async getAPIKey(id: string): Promise<APIKey | null> {
    // Try KV cache first
    const cached = await this.kv.get(`api_key:${id}`, 'json');
    if (cached) {
      return cached as APIKey;
    }

    // Try D1
    if (this.db) {
      const result = await this.db
        .prepare('SELECT * FROM api_keys WHERE id = ?')
        .bind(id)
        .first();

      if (result) {
        const apiKey = this.fromDB(result);
        // Cache in KV
        await this.kv.put(`api_key:${id}`, JSON.stringify(apiKey));
        return apiKey;
      }
    }

    return null;
  }

  /**
   * Get API key by hash
   */
  async getAPIKeyByHash(keyHash: string): Promise<APIKey | null> {
    // Try D1 (primary lookup method)
    if (this.db) {
      const result = await this.db
        .prepare('SELECT * FROM api_keys WHERE key_hash = ?')
        .bind(keyHash)
        .first();

      if (result) {
        return this.fromDB(result);
      }
    }

    return null;
  }

  /**
   * Validate API key
   */
  async validateAPIKey(apiKey: string): Promise<APIKey | null> {
    // Validate format
    if (!validateAPIKeyFormat(apiKey)) {
      return null;
    }

    const keyHash = await hashAPIKey(apiKey);
    const key = await this.getAPIKeyByHash(keyHash);

    if (!key) {
      return null;
    }

    // Check if valid
    if (!isAPIKeyValid(key)) {
      return null;
    }

    // Update last used
    await this.updateLastUsed(key.id);

    return key;
  }

  /**
   * List user's API keys
   */
  async getUserAPIKeys(userId: string, organizationId?: string): Promise<APIKeyResponse[]> {
    if (this.db) {
      let query = 'SELECT * FROM api_keys WHERE user_id = ?';
      const params: (string | number)[] = [userId];

      if (organizationId) {
        query += ' AND organization_id = ?';
        params.push(organizationId);
      }

      query += ' ORDER BY created_at DESC';

      const results = await this.db.prepare(query).bind(...params).all();

      return results.results.map(row => this.toResponse(this.fromDB(row)));
    }

    // Fallback to KV
    const cached = await this.kv.get(`user_api_keys:${userId}`, 'json');
    if (cached) {
      return (cached as APIKey[]).map(key => this.toResponse(key));
    }

    return [];
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(id: string, userId: string): Promise<void> {
    const key = await this.getAPIKey(id);

    if (!key) {
      throw new AuthError('INVALID_API_KEY', 'API key not found', 404);
    }

    // Check ownership
    if (key.userId !== userId) {
      throw new AuthError('INSUFFICIENT_PERMISSIONS', 'Not authorized', 403);
    }

    key.revoked = true;
    key.revokedAt = Date.now();

    // Update KV
    await this.kv.put(`api_key:${id}`, JSON.stringify(key));

    // Update D1
    if (this.db) {
      await this.db
        .prepare('UPDATE api_keys SET revoked = 1, revoked_at = ? WHERE id = ?')
        .bind(key.revokedAt, id)
        .run();
    }

    // Clear cache
    await this.kv.delete(`user_api_keys:${userId}`);
  }

  /**
   * Delete API key
   */
  async deleteAPIKey(id: string, userId: string): Promise<void> {
    const key = await this.getAPIKey(id);

    if (!key) {
      throw new AuthError('INVALID_API_KEY', 'API key not found', 404);
    }

    // Check ownership
    if (key.userId !== userId) {
      throw new AuthError('INSUFFICIENT_PERMISSIONS', 'Not authorized', 403);
    }

    // Delete from KV
    await this.kv.delete(`api_key:${id}`);

    // Delete from D1
    if (this.db) {
      await this.db
        .prepare('DELETE FROM api_keys WHERE id = ?')
        .bind(id)
        .run();
    }

    // Clear cache
    await this.kv.delete(`user_api_keys:${userId}`);
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(id: string): Promise<void> {
    const now = Date.now();

    // Update KV
    const cached = await this.kv.get<APIKey>(`api_key:${id}`, 'json');
    if (cached) {
      cached.lastUsedAt = now;
      await this.kv.put(`api_key:${id}`, JSON.stringify(cached));
    }

    // Update D1 (async, don't wait)
    if (this.db) {
      this.db
        .prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
        .bind(now, id)
        .run()
        .catch(() => {});
    }
  }

  /**
   * Get user's API key count
   */
  private async getUserAPIKeyCount(userId: string, organizationId?: string): Promise<number> {
    if (this.db) {
      let query = 'SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND revoked = 0';
      const params: (string | number)[] = [userId];

      if (organizationId) {
        query += ' AND organization_id = ?';
        params.push(organizationId);
      }

      const result = await this.db.prepare(query).bind(...params).first();
      return (result?.count as number) || 0;
    }

    // Fallback to KV
    const keys = await this.getUserAPIKeys(userId, organizationId);
    return keys.length;
  }

  /**
   * Get API key limit
   */
  private getAPIKeyLimit(keyType: APIKeyType, organizationId?: string): number {
    switch (keyType) {
      case 'personal':
        return 5;
      case 'organization':
        return organizationId ? 100 : 0;
      case 'service':
        return 10;
      case 'test':
        return 3;
      default:
        return 5;
    }
  }

  /**
   * Validate create request
   */
  private validateCreateRequest(request: CreateAPIKeyRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new AuthError('INVALID_API_KEY', 'Name is required', 400);
    }

    if (request.name.length > 100) {
      throw new AuthError('INVALID_API_KEY', 'Name too long (max 100 characters)', 400);
    }

    if (request.permissions.length === 0) {
      throw new AuthError('INVALID_API_KEY', 'At least one permission is required', 400);
    }

    if (request.scopes.length === 0) {
      throw new AuthError('INVALID_API_KEY', 'At least one scope is required', 400);
    }

    if (request.expiresAt && request.expiresAt <= Date.now()) {
      throw new AuthError('EXPIRED_API_KEY', 'Expiration must be in the future', 400);
    }

    if (request.keyType === 'organization' && !request.organizationId) {
      throw new AuthError('INVALID_API_KEY', 'Organization ID required for organization keys', 400);
    }
  }

  /**
   * Convert API key to response (without hash)
   */
  private toResponse(apiKey: APIKey): APIKeyResponse {
    return {
      id: apiKey.id,
      keyPrefix: apiKey.keyPrefix,
      name: apiKey.name,
      description: apiKey.description,
      keyType: apiKey.keyType,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      revoked: apiKey.revoked,
    };
  }

  /**
   * Convert DB row to API key
   */
  private fromDB(row: any): APIKey {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id || undefined,
      keyType: row.key_type,
      keyPrefix: row.key_prefix,
      keyHash: row.key_hash,
      name: row.name,
      description: row.description || undefined,
      permissions: JSON.parse(row.permissions || '[]'),
      rateLimit: row.rate_limit ? JSON.parse(row.rate_limit) : undefined,
      scopes: JSON.parse(row.scopes || '[]'),
      expiresAt: row.expires_at || undefined,
      lastUsedAt: row.last_used_at || undefined,
      createdAt: row.created_at,
      revoked: row.revoked === 1,
      revokedAt: row.revoked_at || undefined,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract API key from request headers
 */
export function extractAPIKeyFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer {key}" and "Key {key}"
  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    return null;
  }

  const [scheme, key] = parts;
  if (scheme !== 'Bearer' && scheme !== 'Key') {
    return null;
  }

  return key;
}

/**
 * Mask API key for logging
 */
export function maskAPIKey(apiKey: string): string {
  if (apiKey.length < 16) {
    return '***';
  }
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
}

/**
 * Get API key info for logging
 */
export function getAPIKeyInfo(apiKey: APIKey): {
  id: string;
  name: string;
  keyType: APIKeyType;
  createdAt: number;
} {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyType: apiKey.keyType,
    createdAt: apiKey.createdAt,
  };
}
