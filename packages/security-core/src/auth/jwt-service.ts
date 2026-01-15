/**
 * JWT (JSON Web Token) Service
 * Handles token generation, validation, and management
 */

import jwt from 'jsonwebtoken';
import { AuthConfig } from './types';
import { SecurityError } from '../types';
import { Logger } from '../utils/logger';

export class JwtService {
  private config: AuthConfig;
  private logger: Logger;
  private invalidatedTokens: Set<string> = new Set();

  constructor(config: AuthConfig) {
    this.config = config;
    this.logger = new Logger('JwtService');
  }

  /**
   * Generate access token for authenticated user
   */
  async generateAccessToken(user: any): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.jwtExpiry
    };

    return this.signToken(payload);
  }

  /**
   * Generate refresh token for authenticated user
   */
  async generateRefreshToken(user: any): Promise<string> {
    const payload = {
      sub: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenExpiry
    };

    return this.signToken(payload);
  }

  /**
   * Generate JWT token with custom payload
   */
  async generateToken(payload: any): Promise<string> {
    const fullPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: payload.exp || Math.floor(Date.now() / 1000) + this.config.jwtExpiry
    };

    return this.signToken(fullPayload);
  }

  /**
   * Sign JWT token
   */
  private signToken(payload: any): string {
    try {
      return jwt.sign(payload, this.config.jwtSecret, {
        algorithm: this.config.jwtAlgorithm
      });
    } catch (error) {
      this.logger.error('Failed to sign JWT', error);
      throw new SecurityError('Failed to generate token', 'TOKEN_GENERATION_FAILED', 500);
    }
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<boolean> {
    try {
      if (this.isTokenInvalidated(token)) {
        return false;
      }

      const payload = this.decodeToken(token);

      // Check if it's an access token (not refresh token)
      if (payload.type === 'refresh') {
        return false;
      }

      return payload.exp > Math.floor(Date.now() / 1000);
    } catch (error) {
      this.logger.error('Invalid access token', error);
      return false;
    }
  }

  /**
   * Validate refresh token
   */
  async validateRefreshToken(token: string): Promise<boolean> {
    try {
      if (this.isTokenInvalidated(token)) {
        return false;
      }

      const payload = this.decodeToken(token);

      // Check if it's a refresh token
      if (payload.type !== 'refresh') {
        return false;
      }

      return payload.exp > Math.floor(Date.now() / 1000);
    } catch (error) {
      this.logger.error('Invalid refresh token', error);
      return false;
    }
  }

  /**
   * Validate any JWT token
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      if (this.isTokenInvalidated(token)) {
        return false;
      }

      const payload = this.decodeToken(token);
      return payload.exp > Math.floor(Date.now() / 1000);
    } catch (error) {
      this.logger.error('Invalid token', error);
      return false;
    }
  }

  /**
   * Decode JWT token without verifying
   */
  async decodeToken(token: string): Promise<any> {
    try {
      return jwt.decode(token);
    } catch (error) {
      this.logger.error('Failed to decode token', error);
      throw new SecurityError('Failed to decode token', 'TOKEN_DECODE_FAILED', 500);
    }
  }

  /**
   * Verify JWT token signature
   */
  async verifyToken(token: string): Promise<any> {
    try {
      if (this.isTokenInvalidated(token)) {
        throw new SecurityError('Token has been invalidated', 'TOKEN_INVALIDATED', 401);
      }

      return jwt.verify(token, this.config.jwtSecret, {
        algorithms: [this.config.jwtAlgorithm]
      });
    } catch (error) {
      this.logger.error('Failed to verify token', error);
      throw new SecurityError('Invalid token', 'INVALID_TOKEN', 401);
    }
  }

  /**
   * Invalidate a token (add to blacklist)
   */
  async invalidateToken(token: string): Promise<void> {
    try {
      const payload = await this.verifyToken(token);

      // Store token with expiry time for cleanup
      const expiry = payload.exp * 1000;
      this.invalidatedTokens.add(token);

      // Schedule cleanup
      setTimeout(() => {
        this.invalidatedTokens.delete(token);
      }, expiry - Date.now());

      this.logger.info('Token invalidated', { token: token.substring(0, 10) + '...' });
    } catch (error) {
      this.logger.error('Failed to invalidate token', error);
      throw new SecurityError('Failed to invalidate token', 'TOKEN_INVALIDATION_FAILED', 500);
    }
  }

  /**
   * Check if token is invalidated
   */
  private isTokenInvalidated(token: string): boolean {
    return this.invalidatedTokens.has(token);
  }

  /**
   * Get token payload
   */
  async getPayload(token: string): Promise<any> {
    try {
      const isValid = await this.validateToken(token);
      if (!isValid) {
        throw new SecurityError('Token is invalid', 'INVALID_TOKEN', 401);
      }

      return await this.decodeToken(token);
    } catch (error) {
      this.logger.error('Failed to get token payload', error);
      throw new SecurityError('Failed to get token payload', 'TOKEN_PAYLOAD_ERROR', 500);
    }
  }

  /**
   * Check if token is expired
   */
  async isTokenExpired(token: string): Promise<boolean> {
    try {
      const payload = await this.decodeToken(token);
      return payload.exp <= Math.floor(Date.now() / 1000);
    } catch {
      return true;
    }
  }

  /**
   * Get token expiry time
   */
  async getTokenExpiry(token: string): Promise<Date> {
    try {
      const payload = await this.decodeToken(token);
      return new Date(payload.exp * 1000);
    } catch (error) {
      this.logger.error('Failed to get token expiry', error);
      throw new SecurityError('Failed to get token expiry', 'TOKEN_EXPIRY_ERROR', 500);
    }
  }

  /**
   * Refresh tokens with new expiry
   */
  async refreshToken(oldToken: string): Promise<string> {
    try {
      const payload = await this.verifyToken(oldToken);

      // Create new payload with refreshed expiry
      const newPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.config.jwtExpiry
      };

      return this.signToken(newPayload);
    } catch (error) {
      this.logger.error('Failed to refresh token', error);
      throw new SecurityError('Failed to refresh token', 'TOKEN_REFRESH_FAILED', 500);
    }
  }

  /**
   * Validate JWT token format
   */
  validateTokenFormat(token: string): boolean {
    // Basic format validation (header.payload.signature)
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  /**
   * Get token header
   */
  async getHeader(token: string): Promise<any> {
    try {
      return jwt.decode(token, { header: true });
    } catch (error) {
      this.logger.error('Failed to get token header', error);
      throw new SecurityError('Failed to get token header', 'TOKEN_HEADER_ERROR', 500);
    }
  }

  /**
   * Verify token signature using public key (for asymmetric cryptography)
   */
  async verifyTokenWithPublicKey(token: string, publicKey: string): Promise<any> {
    try {
      return jwt.verify(token, publicKey, {
        algorithms: [this.config.jwtAlgorithm]
      });
    } catch (error) {
      this.logger.error('Failed to verify token with public key', error);
      throw new SecurityError('Invalid token signature', 'INVALID_SIGNATURE', 401);
    }
  }

  /**
   * Generate JWT token with claim-based access control
   */
  async generateTokenWithClaims(user: any, claims: Record<string, any>): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles,
      permissions: user.permissions,
      ...claims,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.jwtExpiry
    };

    return this.signToken(payload);
  }
}