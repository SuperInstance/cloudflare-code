// @ts-nocheck - External dependencies (axios) may not be installed

/**
 * OAuth2 Service
 * Handles OAuth2 authentication flows (Authorization Code, Implicit, Client Credentials)
 */

import axios from 'axios';
import crypto from 'crypto';
import { OAuth2Config, OAuth2AuthorizationUrlResponse, OAuth2CallbackRequest, OAuth2CallbackResponse } from './types';
import { SecurityError } from '../types';
import { Logger } from '../utils/logger';
import { AuthService } from './auth-service';

export class OAuth2Service {
  private config: OAuth2Config;
  private authService: AuthService;
  private logger: Logger;

  constructor(config: OAuth2Config, authService: AuthService) {
    this.config = config;
    this.authService = authService;
    this.logger = new Logger('OAuth2Service');
  }

  /**
   * Generate OAuth2 authorization URL
   */
  generateAuthorizationUrl(): OAuth2AuthorizationUrlResponse {
    try {
      // Generate PKCE code verifier and challenge
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);

      // Build authorization URL
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        response_type: 'code',
        scope: this.config.scopes.join(' '),
        state: crypto.randomUUID(),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });

      if (this.config.state) {
        params.set('state', this.config.state);
      }

      const authorizationUrl = `${this.config.authorizationEndpoint}?${params.toString()}`;

      this.logger.info('OAuth2 authorization URL generated', {
        provider: this.config.provider,
        clientId: this.config.clientId
      });

      return {
        url: authorizationUrl,
        state: params.get('state') || '',
        codeVerifier
      };

    } catch (error) {
      this.logger.error('Failed to generate OAuth2 authorization URL', error);
      throw new SecurityError('Failed to generate authorization URL', 'AUTH_URL_GENERATION_FAILED', 500);
    }
  }

  /**
   * Handle OAuth2 callback
   */
  async handleCallback(request: OAuth2CallbackRequest, codeVerifier: string): Promise<OAuth2CallbackResponse> {
    try {
      // Validate state parameter
      if (!request.state) {
        throw new SecurityError('State parameter is missing', 'STATE_MISSING', 400);
      }

      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangeCodeForToken(request.code, codeVerifier);

      // Validate token response
      if (!tokenResponse.access_token) {
        throw new SecurityError('Failed to obtain access token', 'TOKEN_EXCHANGE_FAILED', 400);
      }

      // Get user information from provider
      const userInfo = await this.getUserInfo(tokenResponse.access_token);

      // Find or create user
      const user = await this.findOrCreateOAuth2User(userInfo, this.config.provider);

      // Generate JWT token
      const token = await this.authService['generateTokens'](user);

      this.logger.info('OAuth2 callback handled successfully', {
        provider: this.config.provider,
        userId: user.id
      });

      return {
        success: true,
        token,
        user
      };

    } catch (error) {
      this.logger.error('OAuth2 callback failed', error);
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError('OAuth2 authentication failed', 'OAUTH2_AUTH_FAILED', 500);
    }
  }

  /**
   * Refresh OAuth2 access token
   */
  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      const response = await axios.post(this.config.tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in
      };

    } catch (error) {
      this.logger.error('Failed to refresh OAuth2 token', error);
      throw new SecurityError('Failed to refresh token', 'TOKEN_REFRESH_FAILED', 500);
    }
  }

  /**
   * Get user information from OAuth2 provider
   */
  async getUserInfo(accessToken: string): Promise<any> {
    try {
      // Different providers have different endpoints for user info
      let userInfoEndpoint: string;

      switch (this.config.provider) {
        case 'google':
          userInfoEndpoint = 'https://www.googleapis.com/oauth2/v2/userinfo';
          break;
        case 'github':
          userInfoEndpoint = 'https://api.github.com/user';
          break;
        case 'microsoft':
          userInfoEndpoint = 'https://graph.microsoft.com/v1.0/me';
          break;
        case 'facebook':
          userInfoEndpoint = 'https://graph.facebook.com/me?fields=id,name,email';
          break;
        default:
          // Custom provider - assume token introspection endpoint
          userInfoEndpoint = `${this.config.tokenEndpoint.replace('/token', '/userinfo')}`;
      }

      const response = await axios.get(userInfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      return response.data;

    } catch (error) {
      this.logger.error('Failed to get user info from OAuth2 provider', error);
      throw new SecurityError('Failed to get user information', 'USER_INFO_FAILED', 500);
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<any> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code_verifier: codeVerifier
      });

      const response = await axios.post(this.config.tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;

    } catch (error) {
      this.logger.error('Failed to exchange code for token', error);
      throw new SecurityError('Failed to exchange code for token', 'CODE_EXCHANGE_FAILED', 500);
    }
  }

  /**
   * Find or create OAuth2 user
   */
  private async findOrCreateOAuth2User(userInfo: any, provider: string): Promise<any> {
    try {
      // Extract user information based on provider
      const email = this.extractEmail(userInfo, provider);
      const name = this.extractName(userInfo, provider);
      const username = this.extractUsername(userInfo, provider);

      if (!email) {
        throw new SecurityError('Email is required for OAuth2 authentication', 'EMAIL_REQUIRED', 400);
      }

      // Find existing user
      let user = await this.authService['findUserByEmail'](email);

      if (!user) {
        // Create new user
        user = await this.authService['createUser']({
          email,
          username,
          firstName: name.firstName,
          lastName: name.lastName,
          role: 'user',
          mfaEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          metadata: {
            provider,
            providerId: userInfo.id,
            providerData: userInfo
          }
        });
      } else {
        // Update existing user with provider info
        user.metadata = {
          ...user.metadata,
          provider,
          providerId: userInfo.id,
          providerData: userInfo,
          lastLoginAt: new Date()
        };
        await this.authService['updateUserLoginInfo'](user.id, false);
      }

      return user;

    } catch (error) {
      this.logger.error('Failed to find or create OAuth2 user', error);
      throw new SecurityError('Failed to find or create user', 'USER_CREATE_FAILED', 500);
    }
  }

  /**
   * Extract email from provider-specific user info
   */
  private extractEmail(userInfo: any, provider: string): string {
    switch (provider) {
      case 'google':
        return userInfo.email;
      case 'github':
        return userInfo.email || `${userInfo.id}+users.noreply.github.com`;
      case 'microsoft':
        return userInfo.mail;
      case 'facebook':
        return userInfo.email;
      default:
        return userInfo.email || userInfo.email_address;
    }
  }

  /**
   * Extract name from provider-specific user info
   */
  private extractName(userInfo: any, provider: string): { firstName: string; lastName: string } {
    switch (provider) {
      case 'google':
        return {
          firstName: userInfo.given_name || '',
          lastName: userInfo.family_name || ''
        };
      case 'github':
        const [firstName, ...lastNameParts] = userInfo.name.split(' ');
        return {
          firstName: firstName || '',
          lastName: lastNameParts.join(' ') || ''
        };
      case 'microsoft':
        return {
          firstName: userInfo.displayName?.split(' ')[0] || '',
          lastName: userInfo.displayName?.split(' ')[1] || ''
        };
      case 'facebook':
        return {
          firstName: userInfo.first_name || '',
          lastName: userInfo.last_name || ''
        };
      default:
        return {
          firstName: userInfo.firstName || userInfo.name?.split(' ')[0] || '',
          lastName: userInfo.lastName || userInfo.name?.split(' ')[1] || ''
        };
    }
  }

  /**
   * Extract username from provider-specific user info
   */
  private extractUsername(userInfo: any, provider: string): string {
    switch (provider) {
      case 'google':
        return userInfo.email.split('@')[0];
      case 'github':
        return userInfo.login;
      case 'microsoft':
        return userInfo.userPrincipalName?.split('@')[0] || userInfo.displayName?.toLowerCase().replace(/\s+/g, '_');
      case 'facebook':
        return userInfo.email?.split('@')[0] || userInfo.id;
      default:
        return userInfo.username || userInfo.login || userInfo.email?.split('@')[0] || userInfo.id;
    }
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url')
      .replace(/\+/g, '')
      .replace(/\//g, '')
      .replace(/=/g, '');
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256')
      .update(verifier)
      .digest('base64url')
      .replace(/\+/g, '')
      .replace(/\//g, '')
      .replace(/=/g, '');
  }

  /**
   * Revoke OAuth2 token
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      // Some providers support token revocation
      const revokeEndpoint = this.config.provider === 'google'
        ? 'https://oauth2.googleapis.com/revoke'
        : `${this.config.tokenEndpoint.replace('/token', '/revoke')}`;

      await axios.post(revokeEndpoint, `token=${token}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.logger.info('OAuth2 token revoked', { provider: this.config.provider });
      return true;

    } catch (error) {
      this.logger.warn('Failed to revoke OAuth2 token', error);
      // Token revocation is not supported by all providers
      return false;
    }
  }

  /**
   * Get OAuth2 provider configuration
   */
  getProviderConfig(): OAuth2Config {
    return {
      ...this.config,
      // Don't expose client secret
      clientSecret: '***'
    };
  }
}