/**
 * GitHub Authentication Module
 *
 * Handles GitHub App authentication using JWT bearer tokens
 * and installation access tokens for repository operations
 */

import {
  GitHubAppInstallation,
  InstallationAccessToken,
  GitHubAuthError,
  GitHubAPIError,
} from './types';

// ============================================================================
// JWT Creation for GitHub App Authentication
// ============================================================================

/**
 * GitHub App Configuration
 */
export interface GitHubAppConfig {
  appId: number;
  privateKey: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
}

/**
 * JWT Payload for GitHub App Authentication
 */
interface JWTPayload {
  iat: number;
  exp: number;
  iss: number;
}

/**
 * Generate JWT for GitHub App Authentication
 *
 * GitHub Apps authenticate using JWTs signed with RS256
 * The JWT must include:
 * - iat (issued at time): Current time in seconds
 * - exp (expiration time): No more than 10 minutes from iat
 * - iss (issuer): The GitHub App ID
 *
 * @param config - GitHub App configuration
 * @returns JWT token string
 */
export async function generateAppJWT(config: GitHubAppConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    iat: now,
    exp: now + 600, // 10 minutes max
    iss: config.appId,
  };

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // Encode header
  const encodedHeader = base64UrlEncode(JSON.stringify(header));

  // Encode payload
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await signRS256(data, config.privateKey);

  return `${data}.${signature}`;
}

/**
 * Base64URL encode string
 */
function base64UrlEncode(str: string): string {
  // Convert to base64
  const base64 = btoa(str);
  // Convert to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Sign data with RSA-SHA256 (RS256)
 *
 * Note: In Cloudflare Workers, we need to use the Web Crypto API
 * The private key should be in PEM format
 */
async function signRS256(data: string, privateKeyPEM: string): Promise<string> {
  try {
    // Extract the private key from PEM format
    const privateKeyBase64 = privateKeyPEM
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
      .replace(/-----END RSA PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');

    // Decode base64 to ArrayBuffer
    const binaryString = atob(privateKeyBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Import the private key for signing
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      bytes,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    // Sign the data
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(data)
    );

    // Convert signature to base64url
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    throw new GitHubAuthError(
      `Failed to sign JWT: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// Installation Access Tokens
// ============================================================================

/**
 * Create Installation Access Token
 *
 * Creates an access token for a specific installation, which allows
 * the app to act on behalf of the installation (user or org)
 *
 * @param installationId - The GitHub App installation ID
 * @param jwt - The GitHub App JWT
 * @returns Installation access token with permissions
 */
export async function createInstallationAccessToken(
  installationId: number,
  jwt: string
): Promise<InstallationAccessToken> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ClaudeFlare-GitHub-Integration/1.0',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new GitHubAPIError(
      `Failed to create installation access token: ${error}`,
      response.status
    );
  }

  return response.json() as Promise<InstallationAccessToken>;
}

/**
 * Get Installation for Repository
 *
 * Finds the installation that has access to a specific repository
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param jwt - The GitHub App JWT
 * @returns Installation information
 */
export async function getRepositoryInstallation(
  owner: string,
  repo: string,
  jwt: string
): Promise<GitHubAppInstallation> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/installation`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ClaudeFlare-GitHub-Integration/1.0',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new GitHubAPIError(
      `Failed to get repository installation: ${error}`,
      response.status
    );
  }

  return response.json() as Promise<GitHubAppInstallation>;
}

/**
 * Get Installation for Organization
 *
 * Finds the installation for an organization
 *
 * @param org - Organization name
 * @param jwt - The GitHub App JWT
 * @returns Installation information
 */
export async function getOrganizationInstallation(
  org: string,
  jwt: string
): Promise<GitHubAppInstallation> {
  const response = await fetch(
    `https://api.github.com/orgs/${org}/installation`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ClaudeFlare-GitHub-Integration/1.0',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new GitHubAPIError(
      `Failed to get organization installation: ${error}`,
      response.status
    );
  }

  return response.json() as Promise<GitHubAppInstallation>;
}

/**
 * Get Installation for User
 *
 * Finds the installation for a user account
 *
 * @param username - Username
 * @param jwt - The GitHub App JWT
 * @returns Installation information
 */
export async function getUserInstallation(
  username: string,
  jwt: string
): Promise<GitHubAppInstallation> {
  const response = await fetch(
    `https://api.github.com/users/${username}/installation`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ClaudeFlare-GitHub-Integration/1.0',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new GitHubAPIError(
      `Failed to get user installation: ${error}`,
      response.status
    );
  }

  return response.json() as Promise<GitHubAppInstallation>;
}

/**
 * List Installations for App
 *
 * Lists all installations for the GitHub App
 *
 * @param jwt - The GitHub App JWT
 * @param page - Page number for pagination
 * @param perPage - Results per page (max 100)
 * @returns List of installations
 */
export async function listInstallations(
  jwt: string,
  page: number = 1,
  perPage: number = 30
): Promise<{ installations: GitHubAppInstallation[]; totalCount: number }> {
  const response = await fetch(
    `https://api.github.com/app/installations?page=${page}&per_page=${perPage}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ClaudeFlare-GitHub-Integration/1.0',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new GitHubAPIError(
      `Failed to list installations: ${error}`,
      response.status
    );
  }

  const installations = (await response.json()) as GitHubAppInstallation[];

  // Get total count from headers if available
  let totalCount = installations.length;
  const linkHeader = response.headers.get('Link');
  if (linkHeader) {
    // Parse Link header for total count
    const lastPageMatch = linkHeader.match(/page=(\d+).*; rel="last"/);
    if (lastPageMatch) {
      // This is an approximation - GitHub doesn't return exact count
      totalCount = parseInt(lastPageMatch[1], 10) * perPage;
    }
  }

  return { installations, totalCount };
}

// ============================================================================
// Token Caching
// ============================================================================

/**
 * Cached Installation Token
 */
interface CachedToken {
  token: string;
  expiresAt: number;
  installationId: number;
}

/**
 * Token Cache (in-memory for DOs, can be persisted to KV)
 */
const tokenCache = new Map<string, CachedToken>();

/**
 * Get Cached Installation Access Token
 *
 * Returns a cached token if it exists and is not expired,
 * otherwise creates a new one
 *
 * @param installationId - Installation ID
 * @param config - GitHub App configuration
 * @returns Installation access token
 */
export async function getOrCreateInstallationToken(
  installationId: number,
  config: GitHubAppConfig
): Promise<string> {
  const cacheKey = `installation:${installationId}`;
  const cached = tokenCache.get(cacheKey);

  // Check if cached token is still valid (with 5 minute buffer)
  if (cached && cached.expiresAt > Date.now() + 300000) {
    return cached.token;
  }

  // Generate new JWT
  const jwt = await generateAppJWT(config);

  // Create new installation token
  const tokenData = await createInstallationAccessToken(installationId, jwt);

  // Cache the token
  const expiresAt = new Date(tokenData.expires_at).getTime();
  tokenCache.set(cacheKey, {
    token: tokenData.token,
    expiresAt,
    installationId,
  });

  return tokenData.token;
}

/**
 * Clear cached token for an installation
 *
 * @param installationId - Installation ID
 */
export function clearCachedToken(installationId: number): void {
  const cacheKey = `installation:${installationId}`;
  tokenCache.delete(cacheKey);
}

/**
 * Get all cached tokens
 *
 * @returns Map of installation IDs to cached tokens
 */
export function getCachedTokens(): Map<number, string> {
  const tokens = new Map<number, string>();
  const now = Date.now();

  for (const [key, value] of tokenCache.entries()) {
    if (value.expiresAt > now + 300000) {
      const installationId = parseInt(key.split(':')[1], 10);
      tokens.set(installationId, value.token);
    }
  }

  return tokens;
}

// ============================================================================
// OAuth App Authentication (for user operations)
// ============================================================================

/**
 * Create OAuth App Token
 *
 * For OAuth Apps (not GitHub Apps), authenticate using client ID and secret
 * This is useful for operations that require user context
 *
 * @param clientId - OAuth App client ID
 * @param clientSecret - OAuth App client secret
 * @param code - OAuth authorization code
 * @returns Access token
 */
export async function createOAuthToken(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<{ access_token: string; token_type: string; scope: string }> {
  const response = await fetch(
    `https://github.com/login/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'ClaudeFlare-GitHub-Integration/1.0',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new GitHubAPIError(
      `Failed to create OAuth token: ${error}`,
      response.status
    );
  }

  return response.json() as Promise<{ access_token: string; token_type: string; scope: string }>;
}

/**
 * Refresh OAuth Token
 *
 * GitHub OAuth tokens don't expire, but this can be used to verify token validity
 *
 * @param token - OAuth token
 * @returns Token information
 */
export async function checkOAuthToken(
  token: string
): Promise<{ app: { url: string; name: string; client_id: string }; scopes: string[]; token: string }> {
  const response = await fetch('https://api.github.com/app', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ClaudeFlare-GitHub-Integration/1.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new GitHubAPIError(
      `Failed to check OAuth token: ${error}`,
      response.status
    );
  }

  return response.json() as Promise<{
    app: { url: string; name: string; client_id: string };
    scopes: string[];
    token: string;
  }>;
}

// ============================================================================
// Personal Access Token (PAT) Authentication
// ============================================================================

/**
 * Validate Personal Access Token
 *
 * Validates a GitHub Personal Access Token
 *
 * @param token - Personal access token
 * @returns User information if token is valid
 */
export async function validatePersonalAccessToken(
  token: string
): Promise<{ login: string; id: number; type: string }> {
  const response = await fetch('https://api.github.com/user', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ClaudeFlare-GitHub-Integration/1.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new GitHubAPIError(
      `Failed to validate personal access token: ${error}`,
      response.status
    );
  }

  return response.json() as Promise<{ login: string; id: number; type: string }>;
}
