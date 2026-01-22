/**
 * JWT Token Handling with RS256
 *
 * Implements JWT creation, verification, and validation using RS256 algorithm.
 * Supports token rotation, key rotation, and secure token handling.
 */

import type {
  JWTPayload,
  TokenPair,
  JWTConfig,
  UserRole,
  Permission,
  AuthErrorCode,
} from './types';
import { AuthError } from './types';

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * Generate RSA key pair for JWT signing
 * Note: In production, keys should be stored in secure secrets
 */
export async function generateRSAKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  // Cloudflare Workers supports Web Crypto API
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const privateKey = await crypto.subtle.exportKey(
    'pkcs8',
    keyPair.privateKey
  );
  const publicKey = await crypto.subtle.exportKey(
    'spki',
    keyPair.publicKey
  );

  return {
    privateKey: String.fromCharCode(...new Uint8Array(privateKey)),
    publicKey: String.fromCharCode(...new Uint8Array(publicKey)),
  };
}

/**
 * Import private key for signing
 */
async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  // Remove PEM headers and newlines
  const privateKeyData = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryDerString = atob(privateKeyData);
  const binaryDer = new Uint8Array(binaryDerString.length);

  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * Import public key for verification
 */
async function importPublicKey(publicKeyPem: string): Promise<CryptoKey> {
  // Remove PEM headers and newlines
  const publicKeyData = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryDerString = atob(publicKeyData);
  const binaryDer = new Uint8Array(binaryDerString.length);

  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'spki',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify']
  );
}

/**
 * Base64URL encode a string
 */
function base64UrlEncode(data: string): string {
  const base64 = btoa(data);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode a string
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

// ============================================================================
// JWT HEADER
// ============================================================================

/**
 * JWT header interface
 */
interface JWTHeader {
  alg: string;
  typ: string;
  kid?: string;
}

/**
 * Create JWT header
 */
function createHeader(keyId?: string): JWTHeader {
  const header: JWTHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  if (keyId) {
    header.kid = keyId;
  }

  return header;
}

/**
 * Encode JWT header
 */
function encodeHeader(header: JWTHeader): string {
  return base64UrlEncode(JSON.stringify(header));
}

// ============================================================================
// PAYLOAD CREATION
// ============================================================================

/**
 * Create JWT payload
 */
export function createPayload(params: {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
  organizationId?: string;
  type: 'access' | 'refresh';
  config: JWTConfig;
}): JWTPayload {
  const now = Math.floor(Date.now() / 1000);
  const ttl = params.type === 'access'
    ? params.config.accessTokenTTL
    : params.config.refreshTokenTTL;

  return {
    sub: params.userId,
    iss: params.config.issuer,
    aud: params.config.audience,
    iat: now,
    exp: now + ttl,
    jti: crypto.randomUUID(),
    role: params.role,
    orgId: params.organizationId,
    sessionId: params.sessionId,
    type: params.type,
    permissions: params.permissions,
  };
}

/**
 * Encode JWT payload
 */
function encodePayload(payload: JWTPayload): string {
  return base64UrlEncode(JSON.stringify(payload));
}

// ============================================================================
// JWT SIGNING
// ============================================================================

/**
 * Sign JWT
 */
export async function signJWT(
  payload: JWTPayload,
  privateKeyPem: string,
  keyId?: string
): Promise<string> {
  try {
    const header = createHeader(keyId);
    const encodedHeader = encodeHeader(header);
    const encodedPayload = encodePayload(payload);
    const data = `${encodedHeader}.${encodedPayload}`;

    const privateKey = await importPrivateKey(privateKeyPem);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      dataBuffer
    );

    const signatureArray = new Uint8Array(signature);
    const signatureBase64 = String.fromCharCode(...signatureArray);
    const encodedSignature = base64UrlEncode(signatureBase64);

    return `${data}.${encodedSignature}`;
  } catch (error) {
    throw new AuthError(
      'INVALID_TOKEN',
      'Failed to sign JWT',
      500,
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Verify JWT signature
 */
export async function verifyJWT(
  token: string,
  publicKeyPem: string
): Promise<{ header: JWTHeader; payload: JWTPayload }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new AuthError('INVALID_TOKEN', 'Invalid token format', 401);
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    // Decode header and payload
    const header: JWTHeader = JSON.parse(base64UrlDecode(encodedHeader));
    const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

    // Verify algorithm
    if (header.alg !== 'RS256') {
      throw new AuthError('INVALID_TOKEN', 'Invalid token algorithm', 401);
    }

    // Verify signature
    const publicKey = await importPublicKey(publicKeyPem);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const signatureArray = new Uint8Array(
      atob(encodedSignature).split('').map(c => c.charCodeAt(0))
    );

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureArray,
      dataBuffer
    );

    if (!isValid) {
      throw new AuthError('INVALID_TOKEN', 'Invalid token signature', 401);
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new AuthError('EXPIRED_TOKEN', 'Token has expired', 401);
    }

    // Check not before (if present)
    if ((payload as any).nbf && (payload as any).nbf > now) {
      throw new AuthError('INVALID_TOKEN', 'Token not yet valid', 401);
    }

    return { header, payload };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError('INVALID_TOKEN', 'Token verification failed', 401);
  }
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate access token
 */
export async function generateAccessToken(params: {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
  organizationId?: string;
  config: JWTConfig;
}): Promise<string> {
  const payload = createPayload({
    ...params,
    type: 'access',
    config: params.config,
  });

  return signJWT(payload, params.config.privateKey, params.config.keyId);
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(params: {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
  organizationId?: string;
  config: JWTConfig;
}): Promise<string> {
  const payload = createPayload({
    ...params,
    type: 'refresh',
    config: params.config,
  });

  return signJWT(payload, params.config.privateKey, params.config.keyId);
}

/**
 * Generate token pair
 */
export async function generateTokenPair(params: {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
  organizationId?: string;
  config: JWTConfig;
}): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(params),
    generateRefreshToken(params),
  ]);

  const now = Date.now();
  const expiresAt = now + (params.config.accessTokenTTL * 1000);

  return {
    accessToken,
    refreshToken,
    expiresAt,
    tokenType: 'Bearer',
  };
}

// ============================================================================
// TOKEN VALIDATION
// ============================================================================

/**
 * Validate access token
 */
export async function validateAccessToken(
  token: string,
  config: JWTConfig
): Promise<JWTPayload> {
  const { payload } = await verifyJWT(token, config.publicKey);

  if (payload.type !== 'access') {
    throw new AuthError('INVALID_TOKEN', 'Invalid token type', 401);
  }

  return payload;
}

/**
 * Validate refresh token
 */
export async function validateRefreshToken(
  token: string,
  config: JWTConfig
): Promise<JWTPayload> {
  const { payload } = await verifyJWT(token, config.publicKey);

  if (payload.type !== 'refresh') {
    throw new AuthError('INVALID_TOKEN', 'Invalid token type', 401);
  }

  return payload;
}

/**
 * Decode JWT without verification (for debugging)
 */
export function decodeJWT(token: string): JWTPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthError('INVALID_TOKEN', 'Invalid token format', 401);
  }

  const payload = JSON.parse(base64UrlDecode(parts[1]));
  return payload;
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): number {
  const payload = decodeJWT(token);
  return payload.exp * 1000; // Convert to milliseconds
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Get time until token expiration
 */
export function getTimeUntilExpiration(token: string): number {
  const payload = decodeJWT(token);
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: JWTConfig,
  checkRevoked: (tokenId: string) => Promise<boolean>
): Promise<TokenPair> {
  // Verify refresh token
  const { payload } = await verifyJWT(refreshToken, config.publicKey);

  if (payload.type !== 'refresh') {
    throw new AuthError('INVALID_TOKEN', 'Invalid refresh token', 401);
  }

  // Check if token is revoked
  const isRevoked = await checkRevoked(payload.jti);
  if (isRevoked) {
    throw new AuthError('REVOKED_TOKEN', 'Refresh token has been revoked', 401);
  }

  // Generate new token pair
  return generateTokenPair({
    userId: payload.sub,
    role: payload.role,
    permissions: payload.permissions,
    sessionId: payload.sessionId,
    organizationId: payload.orgId,
    config,
  });
}

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Default permissions by role
 */
export function getDefaultPermissions(role: UserRole): Permission[] {
  switch (role) {
    case 'anonymous':
      return [
        { resource: 'chat' as any, action: 'read' as any },
        { resource: 'models' as any, action: 'read' as any },
      ];

    case 'user':
      return [
        { resource: 'chat' as any, action: 'execute' as any },
        { resource: 'chat_stream' as any, action: 'execute' as any },
        { resource: 'models' as any, action: 'read' as any },
        { resource: 'codebase' as any, action: 'create' as any },
        { resource: 'codebase' as any, action: 'read' as any },
        { resource: 'codebase_search' as any, action: 'execute' as any },
        { resource: 'api_keys' as any, action: 'create' as any },
        { resource: 'api_keys' as any, action: 'read' as any },
        { resource: 'api_keys' as any, action: 'delete' as any },
        { resource: 'sessions' as any, action: 'read' as any },
        { resource: 'metrics' as any, action: 'read' as any },
      ];

    case 'pro':
      return [
        { resource: 'chat' as any, action: 'execute' as any },
        { resource: 'chat_stream' as any, action: 'execute' as any },
        { resource: 'models' as any, action: 'read' as any },
        { resource: 'models_premium' as any, action: 'execute' as any },
        { resource: 'codebase' as any, action: 'create' as any },
        { resource: 'codebase' as any, action: 'read' as any },
        { resource: 'codebase_upload' as any, action: 'execute' as any },
        { resource: 'codebase_search' as any, action: 'execute' as any },
        { resource: 'agents' as any, action: 'execute' as any },
        { resource: 'agents_orchestrate' as any, action: 'execute' as any },
        { resource: 'api_keys' as any, action: 'create' as any },
        { resource: 'api_keys' as any, action: 'read' as any },
        { resource: 'api_keys' as any, action: 'delete' as any },
        { resource: 'api_keys_manage' as any, action: 'update' as any },
        { resource: 'sessions' as any, action: 'read' as any },
        { resource: 'sessions' as any, action: 'delete' as any },
        { resource: 'metrics' as any, action: 'read' as any },
        { resource: 'metrics_detailed' as any, action: 'read' as any },
      ];

    case 'admin':
      return [
        { resource: 'chat' as any, action: 'manage' as any },
        { resource: 'models' as any, action: 'read' as any },
        { resource: 'models_premium' as any, action: 'execute' as any },
        { resource: 'codebase' as any, action: 'manage' as any },
        { resource: 'agents' as any, action: 'manage' as any },
        { resource: 'api_keys' as any, action: 'manage' as any },
        { resource: 'sessions' as any, action: 'manage' as any },
        { resource: 'metrics' as any, action: 'read' as any },
        { resource: 'metrics_detailed' as any, action: 'read' as any },
        { resource: 'users' as any, action: 'read' as any },
        { resource: 'users_manage' as any, action: 'manage' as any },
        { resource: 'organizations' as any, action: 'read' as any },
        { resource: 'organizations_manage' as any, action: 'manage' as any },
      ];

    case 'service_account':
      return [
        { resource: 'chat' as any, action: 'execute' as any },
        { resource: 'chat_stream' as any, action: 'execute' as any },
        { resource: 'models' as any, action: 'read' as any },
        { resource: 'codebase' as any, action: 'read' as any },
        { resource: 'codebase_search' as any, action: 'execute' as any },
        { resource: 'agents' as any, action: 'execute' as any },
        { resource: 'metrics' as any, action: 'read' as any },
      ];

    default:
      return [];
  }
}

/**
 * Check if user has permission
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredResource: string,
  requiredAction: string
): boolean {
  return userPermissions.some(
    p => p.resource === requiredResource && p.action === requiredAction
  );
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some(required =>
    userPermissions.some(
      p => p.resource === required.resource && p.action === required.action
    )
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
    userPermissions.some(
      p => p.resource === required.resource && p.action === required.action
    )
  );
}
