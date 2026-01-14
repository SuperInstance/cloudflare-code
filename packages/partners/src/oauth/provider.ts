/**
 * OAuth 2.0 Provider Implementation
 * Implements RFC 6749 OAuth 2.0 Authorization Framework
 */

import { OAuthProvider, OAuthClient, OAuthSession, OAuthToken, ScopePermission } from '../types';

export class OAuthProviderService {
  private providers: Map<string, OAuthProvider> = new Map();
  private clients: Map<string, OAuthClient> = new Map();
  private sessions: Map<string, OAuthSession> = new Map();
  private tokens: Map<string, OAuthToken> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize pre-configured OAuth providers
   */
  private initializeProviders(): void {
    // GitHub
    this.registerProvider({
      id: 'github',
      name: 'GitHub',
      authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
      userInfoEndpoint: 'https://api.github.com/user',
      scopes: ['repo', 'user', 'admin:org', 'gist', 'notifications', 'workflow'],
      defaultScopes: ['repo', 'user'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code',
      additionalParameters: {
        allow_signup: 'true'
      }
    });

    // GitLab
    this.registerProvider({
      id: 'gitlab',
      name: 'GitLab',
      authorizationEndpoint: 'https://gitlab.com/oauth/authorize',
      tokenEndpoint: 'https://gitlab.com/oauth/token',
      userInfoEndpoint: 'https://gitlab.com/api/v4/user',
      scopes: ['api', 'read_user', 'read_repository', 'write_repository', 'read_api', 'sudo'],
      defaultScopes: ['api', 'read_user'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code'
    });

    // Bitbucket
    this.registerProvider({
      id: 'bitbucket',
      name: 'Bitbucket',
      authorizationEndpoint: 'https://bitbucket.org/site/oauth2/authorize',
      tokenEndpoint: 'https://bitbucket.org/site/oauth2/access_token',
      userInfoEndpoint: 'https://api.bitbucket.org/2.0/user',
      scopes: ['account', 'repository', 'repository:write', 'repository:admin', 'pullrequest', 'webhook'],
      defaultScopes: ['account', 'repository'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code'
    });

    // Google (OIDC)
    this.registerProvider({
      id: 'google',
      name: 'Google',
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
      jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
      scopes: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/cloud-platform'],
      defaultScopes: ['openid', 'profile', 'email'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code'
    });

    // Microsoft
    this.registerProvider({
      id: 'microsoft',
      name: 'Microsoft',
      authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',
      jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
      scopes: ['openid', 'profile', 'email', 'User.Read', 'Calendars.ReadWrite'],
      defaultScopes: ['openid', 'profile', 'email'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code'
    });

    // Slack
    this.registerProvider({
      id: 'slack',
      name: 'Slack',
      authorizationEndpoint: 'https://slack.com/oauth/v2/authorize',
      tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
      scopes: ['channels:history', 'channels:read', 'chat:write', 'files:read', 'incoming-webhook'],
      defaultScopes: ['channels:read', 'chat:write'],
      pkce: false,
      state: true,
      tokenEndpointAuth: 'client_secret_post',
      responseType: 'code',
      grantType: 'authorization_code'
    });

    // Jira
    this.registerProvider({
      id: 'jira',
      name: 'Jira',
      authorizationEndpoint: 'https://auth.atlassian.com/authorize',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
      scopes: ['read:jira-work', 'read:jira-user', 'write:jira-work', 'offline_access'],
      defaultScopes: ['read:jira-work', 'read:jira-user'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code'
    });

    // Linear
    this.registerProvider({
      id: 'linear',
      name: 'Linear',
      authorizationEndpoint: 'https://linear.app/oauth/authorize',
      tokenEndpoint: 'https://api.linear.app/oauth/token',
      scopes: ['read', 'write', 'issues:create', 'comments:create', 'admin'],
      defaultScopes: ['read', 'issues:create'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code'
    });

    // Notion
    this.registerProvider({
      id: 'notion',
      name: 'Notion',
      authorizationEndpoint: 'https://api.notion.com/v1/oauth/authorize',
      tokenEndpoint: 'https://api.notion.com/v1/oauth/token',
      scopes: [],
      defaultScopes: [],
      pkce: false,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code'
    });

    // Discord
    this.registerProvider({
      id: 'discord',
      name: 'Discord',
      authorizationEndpoint: 'https://discord.com/api/oauth2/authorize',
      tokenEndpoint: 'https://discord.com/api/oauth2/token',
      userInfoEndpoint: 'https://discord.com/api/users/@me',
      scopes: ['identify', 'email', 'guilds', 'webhook.incoming'],
      defaultScopes: ['identify', 'email'],
      pkce: false,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code'
    });
  }

  /**
   * Register a new OAuth provider
   */
  public registerProvider(provider: OAuthProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Get a provider by ID
   */
  public getProvider(id: string): OAuthProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all providers
   */
  public getAllProviders(): OAuthProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Register an OAuth client
   */
  public registerClient(client: OAuthClient): void {
    this.clients.set(client.id, client);
  }

  /**
   * Get client by ID
   */
  public getClient(id: string): OAuthClient | undefined {
    return this.clients.get(id);
  }

  /**
   * Generate authorization URL
   */
  public generateAuthorizationUrl(
    providerId: string,
    clientId: string,
    redirectUri: string,
    scopes: string[],
    state?: string
  ): { url: string; session: OAuthSession } {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    // Generate session
    const session = this.createSession(providerId, clientId, redirectUri, scopes, state);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: provider.responseType,
      scope: scopes.join(' '),
      state: session.state
    });

    // Add PKCE parameters if supported
    if (provider.pkce) {
      params.append('code_challenge', session.codeChallenge!);
      params.append('code_challenge_method', session.codeChallengeMethod!);
    }

    // Add additional parameters
    if (provider.additionalParameters) {
      Object.entries(provider.additionalParameters).forEach(([key, value]) => {
        params.append(key, value);
      });
    }

    const url = `${provider.authorizationEndpoint}?${params.toString()}`;

    return { url, session };
  }

  /**
   * Create OAuth session
   */
  private createSession(
    partnerId: string,
    clientId: string,
    redirectUri: string,
    scopes: string[],
    state?: string
  ): OAuthSession {
    const sessionId = crypto.randomUUID();
    const sessionState = state || this.generateSecureState();
    const provider = this.getProvider(partnerId)!;

    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;
    let codeChallengeMethod: 'plain' | 'S256' = 'plain';

    if (provider.pkce) {
      codeVerifier = this.generateCodeVerifier();
      codeChallenge = this.generateCodeChallenge(codeVerifier);
      codeChallengeMethod = 'S256';
    }

    const session: OAuthSession = {
      id: sessionId,
      state: sessionState,
      codeVerifier,
      codeChallenge,
      codeChallengeMethod,
      redirectUri,
      partnerId,
      clientId,
      scopes,
      responseTypes: [provider.responseType],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };

    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Exchange authorization code for access token
   */
  public async exchangeCodeForToken(
    providerId: string,
    code: string,
    state: string,
    session: OAuthSession
  ): Promise<OAuthToken> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    // Verify state
    if (session.state !== state) {
      throw new Error('Invalid state parameter');
    }

    // Build token request
    const params = new URLSearchParams({
      grant_type: provider.grantType,
      code,
      redirect_uri: session.redirectUri,
      client_id: session.clientId
    });

    // Add PKCE verifier
    if (provider.pkce && session.codeVerifier) {
      params.append('code_verifier', session.codeVerifier);
    }

    const client = this.getClient(session.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    };

    // Add client authentication
    if (provider.tokenEndpointAuth === 'client_secret_basic') {
      const credentials = btoa(`${client.clientId}:${client.clientSecret}`);
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (provider.tokenEndpointAuth === 'client_secret_post') {
      params.append('client_secret', client.clientSecret);
    }

    // Exchange code for token
    const response = await fetch(provider.tokenEndpoint, {
      method: 'POST',
      headers,
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    // Create token record
    const token: OAuthToken = {
      id: crypto.randomUUID(),
      partnerId: providerId,
      clientId: session.clientId,
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      scope: data.scope || session.scopes.join(' '),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000)
    };

    this.tokens.set(token.id, token);

    // Clean up session
    this.sessions.delete(session.id);

    return token;
  }

  /**
   * Refresh access token
   */
  public async refreshToken(tokenId: string): Promise<OAuthToken> {
    const existingToken = this.tokens.get(tokenId);
    if (!existingToken || !existingToken.refreshToken) {
      throw new Error('Token not found or no refresh token available');
    }

    const provider = this.getProvider(existingToken.partnerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    const client = this.getClient(existingToken.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: existingToken.refreshToken,
      client_id: client.clientId
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    };

    if (provider.tokenEndpointAuth === 'client_secret_basic') {
      const credentials = btoa(`${client.clientId}:${client.clientSecret}`);
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (provider.tokenEndpointAuth === 'client_secret_post') {
      params.append('client_secret', client.clientSecret);
    }

    const response = await fetch(provider.tokenEndpoint, {
      method: 'POST',
      headers,
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    const token: OAuthToken = {
      id: tokenId,
      partnerId: existingToken.partnerId,
      clientId: existingToken.clientId,
      userId: existingToken.userId,
      workspaceId: existingToken.workspaceId,
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token || existingToken.refreshToken,
      idToken: data.id_token,
      scope: data.scope || existingToken.scope,
      createdAt: existingToken.createdAt,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      metadata: existingToken.metadata
    };

    this.tokens.set(tokenId, token);

    return token;
  }

  /**
   * Get token by ID
   */
  public getToken(id: string): OAuthToken | undefined {
    return this.tokens.get(id);
  }

  /**
   * Revoke token
   */
  public async revokeToken(tokenId: string): Promise<void> {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error('Token not found');
    }

    const provider = this.getProvider(token.partnerId);
    if (!provider || !provider.revocationEndpoint) {
      // If no revocation endpoint, just remove from store
      this.tokens.delete(tokenId);
      return;
    }

    const client = this.getClient(token.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    const params = new URLSearchParams({
      token: token.accessToken,
      client_id: client.clientId,
      client_secret: client.clientSecret
    });

    await fetch(provider.revocationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    this.tokens.delete(tokenId);
  }

  /**
   * Get session by ID
   */
  public getSession(id: string): OAuthSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Clean up expired sessions
   */
  public cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Generate secure random state
   */
  private generateSecureState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Generate PKCE code challenge
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64URLEncode(new Uint8Array(hash));
  }

  /**
   * Base64 URL encode
   */
  private base64URLEncode(buffer: Uint8Array): string {
    let str = '';
    for (const byte of buffer) {
      str += String.fromCharCode(byte);
    }
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
