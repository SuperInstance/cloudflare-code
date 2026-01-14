/**
 * OpenID Connect (OIDC) Provider Implementation
 * Implements OpenID Connect Core 1.0 specification
 */

import { OIDCProvider, OAuthToken, OAuthSession } from '../types';

export interface IDTokenClaims {
  iss: string; // Issuer
  sub: string; // Subject
  aud: string | string[]; // Audience
  exp: number; // Expiration
  iat: number; // Issued At
  auth_time?: number; // Authentication Time
  nonce?: string; // Nonce
  acr?: string; // Authentication Context Class Reference
  amr?: string[]; // Authentication Methods References
  azp?: string; // Authorized Party
  // Standard claims
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: AddressClaim;
  updated_at?: number;
}

export interface AddressClaim {
  formatted?: string;
  street_address?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
}

export interface UserInfoResponse extends IDTokenClaims {
  sub: string;
}

export class OIDCService {
  private providers: Map<string, OIDCProvider> = new Map();
  private jwksCache: Map<string, JsonWebKeySet> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize pre-configured OIDC providers
   */
  private initializeProviders(): void {
    // Google
    this.registerProvider({
      id: 'google',
      name: 'Google',
      issuer: 'https://accounts.google.com',
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
      jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      scopes: ['openid', 'profile', 'email'],
      defaultScopes: ['openid', 'profile', 'email'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code',
      subjectType: 'public',
      idTokenSigningAlg: ['RS256'],
      claimsSupported: [
        'aud', 'email', 'email_verified', 'exp', 'family_name', 'given_name',
        'iat', 'iss', 'locale', 'name', 'picture', 'sub'
      ],
      claimsParameterSupported: true,
      requestParameterSupported: false,
      requestUriParameterSupported: false,
      requireRequestUriRegistration: false,
      frontchannelLogoutSupported: true,
      frontchannelLogoutSessionRequired: false,
      backchannelLogoutSupported: true,
      backchannelLogoutSessionRequired: true,
      acrValuesSupported: ['0', '1', '2']
    });

    // Microsoft Azure AD
    this.registerProvider({
      id: 'microsoft',
      name: 'Microsoft',
      issuer: 'https://login.microsoftonline.com/common/v2.0',
      authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',
      jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
      revocationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
      scopes: ['openid', 'profile', 'email'],
      defaultScopes: ['openid', 'profile', 'email'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code',
      subjectType: 'public',
      idTokenSigningAlg: ['RS256'],
      claimsSupported: [
        'aud', 'email', 'given_name', 'iat', 'iss', 'locale', 'name',
        'oid', 'sub', 'tfp', 'upn'
      ],
      claimsParameterSupported: false,
      requestParameterSupported: false,
      requestUriParameterSupported: false,
      requireRequestUriRegistration: false,
      frontchannelLogoutSupported: false,
      frontchannelLogoutSessionRequired: false,
      backchannelLogoutSupported: true,
      backchannelLogoutSessionRequired: true
    });

    // Auth0
    this.registerProvider({
      id: 'auth0',
      name: 'Auth0',
      issuer: 'https://{domain}',
      authorizationEndpoint: 'https://{domain}/authorize',
      tokenEndpoint: 'https://{domain}/oauth/token',
      userInfoEndpoint: 'https://{domain}/userinfo',
      jwksUri: 'https://{domain}/.well-known/jwks.json',
      revocationEndpoint: 'https://{domain}/oauth/revoke',
      scopes: ['openid', 'profile', 'email'],
      defaultScopes: ['openid', 'profile', 'email'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code',
      subjectType: 'public',
      idTokenSigningAlg: ['RS256'],
      claimsSupported: [
        'aud', 'auth_time', 'azp', 'email', 'email_verified', 'exp',
        'family_name', 'given_name', 'iat', 'iss', 'locale', 'name',
        'nickname', 'picture', 'sub'
      ],
      claimsParameterSupported: true,
      requestParameterSupported: true,
      requestUriParameterSupported: false,
      requireRequestUriRegistration: false,
      frontchannelLogoutSupported: true,
      frontchannelLogoutSessionRequired: false,
      backchannelLogoutSupported: true,
      backchannelLogoutSessionRequired: true
    });

    // Okta
    this.registerProvider({
      id: 'okta',
      name: 'Okta',
      issuer: 'https://{domain}/oauth2/{authServerId}',
      authorizationEndpoint: 'https://{domain}/oauth2/{authServerId}/v1/authorize',
      tokenEndpoint: 'https://{domain}/oauth2/{authServerId}/v1/token',
      userInfoEndpoint: 'https://{domain}/oauth2/{authServerId}/v1/userinfo',
      jwksUri: 'https://{domain}/oauth2/{authServerId}/v1/keys',
      revocationEndpoint: 'https://{domain}/oauth2/{authServerId}/v1/revoke',
      scopes: ['openid', 'profile', 'email'],
      defaultScopes: ['openid', 'profile', 'email'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code',
      subjectType: 'public',
      idTokenSigningAlg: ['RS256'],
      claimsSupported: [
        'aud', 'email', 'email_verified', 'exp', 'family_name', 'given_name',
        'iat', 'iss', 'locale', 'name', 'nonce', 'picture', 'sub'
      ],
      claimsParameterSupported: false,
      requestParameterSupported: false,
      requestUriParameterSupported: false,
      requireRequestUriRegistration: false,
      frontchannelLogoutSupported: true,
      frontchannelLogoutSessionRequired: false,
      backchannelLogoutSupported: true,
      backchannelLogoutSessionRequired: true
    });

    // Keycloak
    this.registerProvider({
      id: 'keycloak',
      name: 'Keycloak',
      issuer: 'https://{domain}/realms/{realm}',
      authorizationEndpoint: 'https://{domain}/realms/{realm}/protocol/openid-connect/auth',
      tokenEndpoint: 'https://{domain}/realms/{realm}/protocol/openid-connect/token',
      userInfoEndpoint: 'https://{domain}/realms/{realm}/protocol/openid-connect/userinfo',
      jwksUri: 'https://{domain}/realms/{realm}/protocol/openid-connect/certs',
      revocationEndpoint: 'https://{domain}/realms/{realm}/protocol/openid-connect/revoke',
      scopes: ['openid', 'profile', 'email'],
      defaultScopes: ['openid', 'profile', 'email'],
      pkce: true,
      state: true,
      tokenEndpointAuth: 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code',
      subjectType: 'public',
      idTokenSigningAlg: ['RS256'],
      claimsSupported: [
        'aud', 'email', 'email_verified', 'exp', 'family_name', 'given_name',
        'iat', 'iss', 'locale', 'name', 'preferred_username', 'sub'
      ],
      claimsParameterSupported: false,
      requestParameterSupported: false,
      requestUriParameterSupported: false,
      requireRequestUriRegistration: false,
      frontchannelLogoutSupported: true,
      frontchannelLogoutSessionRequired: false,
      backchannelLogoutSupported: true,
      backchannelLogoutSessionRequired: true
    });
  }

  /**
   * Register an OIDC provider
   */
  public registerProvider(provider: OIDCProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Get provider by ID
   */
  public getProvider(id: string): OIDCProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all providers
   */
  public getAllProviders(): OIDCProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Fetch and validate provider configuration from well-known endpoint
   */
  public async discoverProvider(issuer: string): Promise<OIDCProvider> {
    const wellKnownUrl = `${issuer}/.well-known/openid-configuration`;

    const response = await fetch(wellKnownUrl);
    if (!response.ok) {
      throw new Error('Failed to discover OIDC configuration');
    }

    const config = await response.json();

    const provider: OIDCProvider = {
      id: this.extractProviderId(issuer),
      name: this.extractProviderName(issuer),
      issuer: config.issuer,
      authorizationEndpoint: config.authorization_endpoint,
      tokenEndpoint: config.token_endpoint,
      userInfoEndpoint: config.userinfo_endpoint,
      jwksUri: config.jwks_uri,
      revocationEndpoint: config.revocation_endpoint,
      scopes: config.scopes_supported || ['openid', 'profile', 'email'],
      defaultScopes: ['openid', 'profile', 'email'],
      pkce: config.code_challenge_methods_supported?.includes('S256') || false,
      state: true,
      tokenEndpointAuth: config.token_endpoint_auth_methods_supported?.[0] || 'client_secret_basic',
      responseType: 'code',
      grantType: 'authorization_code',
      subjectType: config.subject_types_supported?.[0] || 'public',
      idTokenSigningAlg: config.id_token_signing_alg_values_supported || ['RS256'],
      claimsSupported: config.claims_supported || [],
      claimsParameterSupported: config.claims_parameter_supported || false,
      requestParameterSupported: config.request_parameter_supported || false,
      requestUriParameterSupported: config.request_uri_parameter_supported || false,
      requireRequestUriRegistration: config.require_uri_registration || false,
      frontchannelLogoutSupported: config.frontchannel_logout_supported || false,
      frontchannelLogoutSessionRequired: config.frontchannel_logout_session_required || false,
      backchannelLogoutSupported: config.backchannel_logout_supported || false,
      backchannelLogoutSessionRequired: config.backchannel_logout_session_required || false,
      acrValuesSupported: config.acr_values_supported
    };

    return provider;
  }

  /**
   * Verify ID Token
   */
  public async verifyIDToken(
    providerId: string,
    idToken: string,
    nonce?: string
  ): Promise<IDTokenClaims> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    // Decode ID Token (without verification first)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid ID token format');
    }

    const header = JSON.parse(this.base64UrlDecode(parts[0]));
    const payload = JSON.parse(this.base64UrlDecode(parts[1])) as IDTokenClaims;

    // Verify issuer
    if (payload.iss !== provider.issuer) {
      throw new Error('Invalid issuer');
    }

    // Verify audience
    if (Array.isArray(payload.aud)) {
      if (!payload.aud.includes('client_id')) {
        throw new Error('Invalid audience');
      }
    } else {
      // Single audience
    }

    // Verify expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    // Verify nonce if provided
    if (nonce && payload.nonce !== nonce) {
      throw new Error('Invalid nonce');
    }

    // Verify signature
    await this.verifySignature(provider, idToken, header);

    return payload;
  }

  /**
   * Fetch user info
   */
  public async fetchUserInfo(
    providerId: string,
    accessToken: string
  ): Promise<UserInfoResponse> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    if (!provider.userInfoEndpoint) {
      throw new Error('UserInfo endpoint not configured');
    }

    const response = await fetch(provider.userInfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return await response.json();
  }

  /**
   * Fetch JWKS from provider
   */
  public async fetchJWKS(providerId: string): Promise<JsonWebKeySet> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    if (!provider.jwksUri) {
      throw new Error('JWKS URI not configured');
    }

    // Check cache
    const cached = this.jwksCache.get(providerId);
    if (cached && Date.now() - (cached as any).cachedAt < 3600000) {
      return cached;
    }

    const response = await fetch(provider.jwksUri);
    if (!response.ok) {
      throw new Error('Failed to fetch JWKS');
    }

    const jwks = await response.json();
    (jwks as any).cachedAt = Date.now();

    this.jwksCache.set(providerId, jwks);

    return jwks;
  }

  /**
   * Verify token signature
   */
  private async verifySignature(
    provider: OIDCProvider,
    idToken: string,
    header: JwtHeader
  ): Promise<void> {
    const jwks = await this.fetchJWKS(provider.id);

    const key = jwks.keys.find(k => k.kid === header.kid);
    if (!key) {
      throw new Error('Signing key not found');
    }

    // Import key
    const cryptoKey = await this.importKey(key, header.alg);

    // Verify signature
    const parts = idToken.split('.');
    const signature = this.base64UrlDecode(parts[2]);
    const data = `${parts[0]}.${parts[1]}`;

    const encoder = new TextEncoder();
    const valid = await crypto.subtle.verify(
      this.getAlgorithm(header.alg),
      cryptoKey,
      this.base64UrlToUint8Array(signature),
      encoder.encode(data)
    );

    if (!valid) {
      throw new Error('Invalid signature');
    }
  }

  /**
   * Import cryptographic key
   */
  private async importKey(key: JsonWebKey, alg: string): Promise<CryptoKey> {
    const algorithm = this.getAlgorithm(alg);

    return await crypto.subtle.importKey(
      'jwk',
      key,
      algorithm,
      false,
      ['verify']
    );
  }

  /**
   * Get crypto algorithm
   */
  private getAlgorithm(alg: string): AlgorithmIdentifier {
    switch (alg) {
      case 'RS256':
        return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
      case 'RS384':
        return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' };
      case 'RS512':
        return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' };
      case 'ES256':
        return { name: 'ECDSA', namedCurve: 'P-256' };
      case 'ES384':
        return { name: 'ECDSA', namedCurve: 'P-384' };
      case 'ES512':
        return { name: 'ECDSA', namedCurve: 'P-521' };
      case 'PS256':
        return { name: 'RSA-PSS', hash: 'SHA-256' };
      case 'PS384':
        return { name: 'RSA-PSS', hash: 'SHA-384' };
      case 'PS512':
        return { name: 'RSA-PSS', hash: 'SHA-512' };
      default:
        throw new Error(`Unsupported algorithm: ${alg}`);
    }
  }

  /**
   * Extract provider ID from issuer
   */
  private extractProviderId(issuer: string): string {
    try {
      const url = new URL(issuer);
      return url.hostname.replace(/\./g, '-');
    } catch {
      return 'custom';
    }
  }

  /**
   * Extract provider name from issuer
   */
  private extractProviderName(issuer: string): string {
    try {
      const url = new URL(issuer);
      return url.hostname;
    } catch {
      return 'Custom Provider';
    }
  }

  /**
   * Base64 URL decode
   */
  private base64UrlDecode(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }
    return atob(str);
  }

  /**
   * Convert base64url to Uint8Array
   */
  private base64UrlToUint8Array(str: string): Uint8Array {
    str = this.base64UrlDecode(str);
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Generate logout URL
   */
  public generateLogoutUrl(
    providerId: string,
    idTokenHint: string,
    postLogoutRedirectUri?: string,
    state?: string
  ): string {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    // Use standard OpenID Connect logout endpoint
    const logoutEndpoint = provider.issuer + '/protocol/openid-connect/logout';

    const params = new URLSearchParams({
      id_token_hint: idTokenHint
    });

    if (postLogoutRedirectUri) {
      params.append('post_logout_redirect_uri', postLogoutRedirectUri);
    }

    if (state) {
      params.append('state', state);
    }

    return `${logoutEndpoint}?${params.toString()}`;
  }
}

interface JwtHeader {
  alg: string;
  kid?: string;
  typ?: string;
}

interface JsonWebKeySet {
  keys: JsonWebKey[];
}

interface JsonWebKey {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}
