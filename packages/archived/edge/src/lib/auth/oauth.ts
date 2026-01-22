/**
 * OAuth 2.0 Providers
 *
 * Implements OAuth 2.0 flows for GitHub and Google with PKCE support.
 * Includes CSRF protection, state management, and secure token exchange.
 */

import type {
  OAuthProvider,
  OAuthProfile,
  OAuthConfig,
  OAuthState,
  User,
  UserRole,
  Permission,
} from './types';
import { AuthError } from './types';
import { getDefaultPermissions } from './jwt';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Generate OAuth state for CSRF protection
 */
export function generateOAuthState(provider: OAuthProvider, redirectUri: string): OAuthState {
  const state = crypto.randomUUID();

  return {
    state,
    provider,
    redirectUri,
    createdAt: Date.now(),
  };
}

/**
 * Generate code verifier for PKCE
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate code challenge from verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = String.fromCharCode(...new Uint8Array(hash));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate nonce for OpenID Connect
 */
export function generateNonce(): string {
  return crypto.randomUUID();
}

// ============================================================================
// GITHUB OAUTH
// ============================================================================

/**
 * GitHub OAuth configuration
 */
interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

/**
 * Get GitHub authorization URL
 */
export function getGitHubAuthUrl(config: GitHubOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope.join(' '),
    state,
    response_type: 'code',
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange GitHub code for access token
 */
export async function exchangeGitHubCode(
  code: string,
  config: GitHubOAuthConfig
): Promise<{ accessToken: string; refreshToken?: string }> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new AuthError('OAUTH_ERROR', 'Failed to exchange GitHub code', 502);
  }

  const data = await response.json();

  if (data.error) {
    throw new AuthError('OAUTH_ERROR', data.error_description || 'GitHub OAuth error', 401);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

/**
 * Fetch GitHub user profile
 */
export async function getGitHubProfile(accessToken: string): Promise<OAuthProfile> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new AuthError('OAUTH_ERROR', 'Failed to fetch GitHub profile', 502);
  }

  const data = await response.json();

  // Fetch user email (primary)
  const emailResponse = await fetch('https://api.github.com/user/emails', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  let email = data.email;
  let verified = !!email;

  if (emailResponse.ok) {
    const emails = await emailResponse.json();
    const primaryEmail = emails.find((e: any) => e.primary);
    if (primaryEmail) {
      email = primaryEmail.email;
      verified = primaryEmail.verified;
    }
  }

  return {
    provider: 'github',
    providerId: String(data.id),
    email: email || `${data.login}@users.noreply.github.com`,
    name: data.name || data.login,
    avatar: data.avatar_url,
    username: data.login,
    verified,
  };
}

// ============================================================================
// GOOGLE OAUTH
// ============================================================================

/**
 * Google OAuth configuration
 */
interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

/**
 * Get Google authorization URL
 */
export function getGoogleAuthUrl(
  config: GoogleOAuthConfig,
  state: string,
  codeChallenge: string,
  nonce?: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope.join(' '),
    state,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  if (nonce) {
    params.append('nonce', nonce);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange Google code for tokens
 */
export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  config: GoogleOAuthConfig
): Promise<{ accessToken: string; refreshToken?: string; idToken?: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new AuthError('OAUTH_ERROR', 'Failed to exchange Google code', 502);
  }

  const data = await response.json();

  if (data.error) {
    throw new AuthError('OAUTH_ERROR', data.error_description || 'Google OAuth error', 401);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
  };
}

/**
 * Fetch Google user profile
 */
export async function getGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new AuthError('OAUTH_ERROR', 'Failed to fetch Google profile', 502);
  }

  const data = await response.json();

  return {
    provider: 'google',
    providerId: data.id,
    email: data.email,
    name: data.name,
    avatar: data.picture,
    verified: data.verified_email || true,
  };
}

// ============================================================================
// OAUTH SERVICE
// ============================================================================

/**
 * OAuth service for handling OAuth flows
 */
export class OAuthService {
  private config: OAuthConfig;
  private stateCache: Map<string, OAuthState>;

  constructor(config: OAuthConfig) {
    this.config = config;
    this.stateCache = new Map();
  }

  /**
   * Get authorization URL for provider
   */
  getAuthorizationUrl(
    provider: OAuthProvider,
    redirectUri: string
  ): { url: string; state: string; codeVerifier?: string; nonce?: string } {
    const state = generateOAuthState(provider, redirectUri);

    // Store state for verification (in production, use KV with TTL)
    this.stateCache.set(state.state, state);

    if (provider === 'github') {
      if (!this.config.github) {
        throw new AuthError('OAUTH_ERROR', 'GitHub OAuth not configured', 500);
      }

      return {
        url: getGitHubAuthUrl(
          {
            clientId: this.config.github.clientId,
            clientSecret: this.config.github.clientSecret,
            redirectUri: this.config.github.redirectUri,
            scope: this.config.github.scope,
          },
          state.state
        ),
        state: state.state,
      };
    }

    if (provider === 'google') {
      if (!this.config.google) {
        throw new AuthError('OAUTH_ERROR', 'Google OAuth not configured', 500);
      }

      const codeVerifier = generateCodeVerifier();

      return {
        url: getGoogleAuthUrl(
          {
            clientId: this.config.google.clientId,
            clientSecret: this.config.google.clientSecret,
            redirectUri: this.config.google.redirectUri,
            scope: this.config.google.scope,
          },
          state.state,
          await generateCodeChallenge(codeVerifier),
          state.nonce
        ),
        state: state.state,
        codeVerifier,
      };
    }

    throw new AuthError('OAUTH_ERROR', 'Unsupported OAuth provider', 400);
  }

  /**
   * Verify OAuth state
   */
  verifyState(state: string, redirectUri: string): OAuthState {
    const storedState = this.stateCache.get(state);

    if (!storedState) {
      throw new AuthError('OAUTH_STATE_MISMATCH', 'Invalid OAuth state', 401);
    }

    if (storedState.redirectUri !== redirectUri) {
      throw new AuthError('OAUTH_STATE_MISMATCH', 'Redirect URI mismatch', 401);
    }

    // Check state age (10 minutes)
    const age = Date.now() - storedState.createdAt;
    if (age > 10 * 60 * 1000) {
      this.stateCache.delete(state);
      throw new AuthError('OAUTH_STATE_MISMATCH', 'OAuth state expired', 401);
    }

    // Remove used state
    this.stateCache.delete(state);

    return storedState;
  }

  /**
   * Exchange authorization code for user profile
   */
  async exchangeCode(
    provider: OAuthProvider,
    code: string,
    codeVerifier?: string
  ): Promise<OAuthProfile> {
    if (provider === 'github') {
      if (!this.config.github) {
        throw new AuthError('OAUTH_ERROR', 'GitHub OAuth not configured', 500);
      }

      const tokens = await exchangeGitHubCode(code, {
        clientId: this.config.github.clientId,
        clientSecret: this.config.github.clientSecret,
        redirectUri: this.config.github.redirectUri,
        scope: this.config.github.scope,
      });

      return getGitHubProfile(tokens.accessToken);
    }

    if (provider === 'google') {
      if (!this.config.google) {
        throw new AuthError('OAUTH_ERROR', 'Google OAuth not configured', 500);
      }

      if (!codeVerifier) {
        throw new AuthError('OAUTH_ERROR', 'Code verifier required for Google', 400);
      }

      const tokens = await exchangeGoogleCode(code, codeVerifier, {
        clientId: this.config.google.clientId,
        clientSecret: this.config.google.clientSecret,
        redirectUri: this.config.google.redirectUri,
        scope: this.config.google.scope,
      });

      return getGoogleProfile(tokens.accessToken);
    }

    throw new AuthError('OAUTH_ERROR', 'Unsupported OAuth provider', 400);
  }

  /**
   * Create or update user from OAuth profile
   */
  async createOrUpdateUser(
    profile: OAuthProfile,
    getUserByProvider: (provider: OAuthProvider, providerId: string) => Promise<User | null>,
    createUser: (user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => Promise<User>,
    updateUser: (userId: string, updates: Partial<User>) => Promise<User>
  ): Promise<User> {
    // Check if user exists
    const existing = await getUserByProvider(profile.provider, profile.providerId);

    if (existing) {
      // Update last login
      return updateUser(existing.id, {
        lastLoginAt: Date.now(),
        emailVerified: profile.verified,
        avatar: profile.avatar || existing.avatar,
        name: profile.name || existing.name,
      });
    }

    // Create new user
    const newUser = await createUser({
      email: profile.email,
      emailVerified: profile.verified,
      name: profile.name,
      avatar: profile.avatar,
      role: 'user',
      permissions: getDefaultPermissions('user'),
      mfaEnabled: false,
      metadata: {
        oauthProvider: profile.provider,
        oauthProviderId: profile.providerId,
        username: profile.username,
      },
    });

    return newUser;
  }

  /**
   * Clean up expired states
   */
  cleanupExpiredStates(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [state, data] of this.stateCache.entries()) {
      if (now - data.createdAt > maxAge) {
        this.stateCache.delete(state);
      }
    }
  }
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default GitHub scopes
 */
export const DEFAULT_GITHUB_SCOPES = [
  'read:user',
  'user:email',
];

/**
 * Default Google scopes
 */
export const DEFAULT_GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
];

/**
 * Create default OAuth config from environment
 */
export function createOAuthConfig(env: {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
}): OAuthConfig {
  const config: OAuthConfig = {};

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    config.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      redirectUri: env.GITHUB_REDIRECT_URI || 'https://api.example.com/auth/github/callback',
      scope: DEFAULT_GITHUB_SCOPES,
    };
  }

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    config.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI || 'https://api.example.com/auth/google/callback',
      scope: DEFAULT_GOOGLE_SCOPES,
    };
  }

  return config;
}
