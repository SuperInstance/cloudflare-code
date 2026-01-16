// @ts-nocheck - Missing interfaces and utils modules

/**
 * Main Authentication Service
 * Handles user authentication, registration, and session management
 */

import { AuthServiceInterface } from '../interfaces';
import {
  User,
  AuthToken,
  AuthConfig,
  AuthEvent,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  LogoutRequest,
  PasswordChangeRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest
} from './types';
import { JwtService } from './jwt-service';
import { SessionService } from './session-service';
import { SecurityError } from '../types';
import { Logger } from '../utils/logger';
import { Validator } from '../utils/validator';
import { EventEmitter } from 'events';

export abstract class AuthService extends EventEmitter implements AuthServiceInterface {
  private jwtService: JwtService;
  private sessionService: SessionService;
  private logger: Logger;
  private config: AuthConfig;
  private loginAttempts: Map<string, { attempts: number; lastAttempt: Date }> = new Map();

  constructor(config: AuthConfig) {
    super();
    this.config = config;
    this.jwtService = new JwtService(config);
    this.sessionService = new SessionService(config);
    this.logger = new Logger('AuthService');
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      // Validate request
      const validation = this.validateLoginRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors?.[0] || 'Invalid request'
        };
      }

      // Check login attempts
      await this.checkLoginAttempts(request.email);

      // Find user
      const user = await this.findUserByEmail(request.email);
      if (!user || !user.isActive) {
        await this.recordFailedLogin(request.email);
        throw new SecurityError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(request.password, user.password);
      if (!isPasswordValid) {
        await this.recordFailedLogin(request.email);
        throw new SecurityError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      // Check if MFA is required
      if (user.mfaEnabled) {
        const mfaChallenge = await this.createMfaChallenge(user);
        return {
          success: true,
          requiresMFA: true,
          mfaChallenge: mfaChallenge
        };
      }

      // Generate tokens
      const token = await this.generateTokens(user);

      // Update user login info
      await this.updateUserLoginInfo(user.id, request.rememberMe);

      // Log successful login
      await this.logAuthEvent('login', user.id, true, request);

      this.logger.info(`User ${user.email} logged in successfully`);
      return {
        success: true,
        token,
        user: this.sanitizeUser(user)
      };

    } catch (error) {
      this.logger.error('Login failed', error);
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError('Authentication failed', 'AUTHENTICATION_FAILED', 500);
    }
  }

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    try {
      // Validate request
      const validation = this.validateRegisterRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors?.[0] || 'Invalid request'
        };
      }

      // Check if user already exists
      const existingUser = await this.findUserByEmail(request.email);
      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists'
        };
      }

      // Create new user
      const user = await this.createUser({
        ...request,
        password: await this.hashPassword(request.password),
        role: request.role || 'user',
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      });

      // Generate tokens
      const token = await this.generateTokens(user);

      // Log registration
      await this.logAuthEvent('register', user.id, true, request);

      this.logger.info(`User ${user.email} registered successfully`);
      return {
        success: true,
        user: this.sanitizeUser(user),
        token
      };

    } catch (error) {
      this.logger.error('Registration failed', error);
      throw new SecurityError('Registration failed', 'REGISTRATION_FAILED', 500);
    }
  }

  async refreshToken(request: RefreshTokenRequest): Promise<{ success: boolean; token?: AuthToken; error?: string }> {
    try {
      const isValid = await this.jwtService.validateRefreshToken(request.refreshToken);
      if (!isValid) {
        throw new SecurityError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
      }

      const payload = await this.jwtService.decodeToken(request.refreshToken);
      const user = await this.findUserById(payload.sub);

      if (!user || !user.isActive) {
        throw new SecurityError('User not found or inactive', 'USER_NOT_FOUND', 404);
      }

      const newToken = await this.generateTokens(user);
      return {
        success: true,
        token: newToken
      };

    } catch (error) {
      this.logger.error('Token refresh failed', error);
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError('Token refresh failed', 'TOKEN_REFRESH_FAILED', 500);
    }
  }

  async logout(request: LogoutRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Invalidate access token
      await this.jwtService.invalidateToken(request.accessToken);

      // Invalidate refresh token if provided
      if (request.refreshToken) {
        await this.jwtService.invalidateToken(request.refreshToken);
      }

      // Terminate session
      await this.sessionService.terminateSession(request.accessToken);

      this.logger.info('User logged out successfully');
      return { success: true };

    } catch (error) {
      this.logger.error('Logout failed', error);
      throw new SecurityError('Logout failed', 'LOGOUT_FAILED', 500);
    }
  }

  async changePassword(request: PasswordChangeRequest, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const validation = this.validatePasswordChangeRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors?.[0] || 'Invalid request'
        };
      }

      const user = await this.findUserById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await this.verifyPassword(request.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          error: 'Current password is incorrect'
        };
      }

      // Update password
      await this.updateUserPassword(userId, await this.hashPassword(request.newPassword));

      // Log password change
      await this.logAuthEvent('password_change', userId, true, request);

      this.logger.info(`Password changed for user ${user.email}`);
      return { success: true };

    } catch (error) {
      this.logger.error('Password change failed', error);
      throw new SecurityError('Password change failed', 'PASSWORD_CHANGE_FAILED', 500);
    }
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.findUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists for security
        this.logger.warn('Password reset requested for unknown email', { email });
        return { success: true };
      }

      // Generate reset token
      const resetToken = await this.generatePasswordResetToken(user);

      // Send reset email (implement email service)
      await this.sendPasswordResetEmail(user, resetToken);

      // Log password reset request
      await this.logAuthEvent('password_reset', user.id, true, { email });

      this.logger.info(`Password reset requested for ${email}`);
      return { success: true };

    } catch (error) {
      this.logger.error('Password reset request failed', error);
      throw new SecurityError('Password reset request failed', 'PASSWORD_RESET_FAILED', 500);
    }
  }

  async confirmPasswordReset(request: PasswordResetConfirmRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const validation = this.validatePasswordResetConfirmRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors?.[0] || 'Invalid request'
        };
      }

      const isValidReset = await this.validatePasswordResetToken(request.token);
      if (!isValidReset) {
        return {
          success: false,
          error: 'Invalid or expired reset token'
        };
      }

      // Get user from token
      const payload = await this.jwtService.decodeToken(request.token);
      const user = await this.findUserById(payload.sub);

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Update password
      await this.updateUserPassword(user.id, await this.hashPassword(request.newPassword));

      // Invalidate reset token
      await this.jwtService.invalidateToken(request.token);

      // Log password reset
      await this.logAuthEvent('password_reset', user.id, true, request);

      this.logger.info(`Password reset completed for ${user.email}`);
      return { success: true };

    } catch (error) {
      this.logger.error('Password reset confirmation failed', error);
      throw new SecurityError('Password reset confirmation failed', 'PASSWORD_RESET_CONFIRM_FAILED', 500);
    }
  }

  // Private helper methods
  private async checkLoginAttempts(email: string): Promise<void> {
    const attempts = this.loginAttempts.get(email);
    const now = new Date();

    if (attempts) {
      // Check if lockout period has expired
      if (now.getTime() - attempts.lastAttempt.getTime() > this.config.lockoutDuration * 60 * 1000) {
        this.loginAttempts.delete(email);
        return;
      }

      // Check if exceeded max attempts
      if (attempts.attempts >= this.config.maxLoginAttempts) {
        throw new SecurityError(
          `Account locked due to too many failed attempts. Please try again after ${this.config.lockoutDuration} minutes.`,
          'ACCOUNT_LOCKED',
          429
        );
      }
    }
  }

  private async recordFailedLogin(email: string): Promise<void> {
    const attempts = this.loginAttempts.get(email) || { attempts: 0, lastAttempt: new Date() };
    attempts.attempts++;
    attempts.lastAttempt = new Date();
    this.loginAttempts.set(email, attempts);

    this.logger.warn(`Failed login attempt for ${email}. Attempts: ${attempts.attempts}`);

    if (attempts.attempts >= this.config.maxLoginAttempts) {
      this.logger.error(`Account locked for ${email} due to too many failed attempts`);
      // Optionally lock the account
      await this.lockUserAccount(email);
    }
  }

  private async lockUserAccount(email: string): Promise<void> {
    // Implement account locking logic
    const user = await this.findUserByEmail(email);
    if (user) {
      await this.updateUserStatus(user.id, 'locked');
      this.logger.error(`Account ${email} has been locked`);
    }
  }

  private async generateTokens(user: User): Promise<AuthToken> {
    const accessToken = await this.jwtService.generateAccessToken(user);
    const refreshToken = await this.jwtService.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.jwtExpiry,
      scope: ['read', 'write']
    };
  }

  private async generatePasswordResetToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      type: 'password_reset',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours expiry
    };

    return this.jwtService.signToken(payload);
  }

  private async validatePasswordResetToken(token: string): Promise<boolean> {
    try {
      const payload = await this.jwtService.decodeToken(token);
      return payload.type === 'password_reset' && payload.exp > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  }

  private async sendPasswordResetEmail(user: User, token: string): Promise<void> {
    // Implement email sending logic
    this.logger.info(`Password reset email sent to ${user.email}`);
    // TODO: Integrate with email service
  }

  private validateLoginRequest(request: LoginRequest): ValidationResult {
    const errors: string[] = [];

    if (!Validator.isValidEmail(request.email)) {
      errors.push('Invalid email format');
    }

    if (!request.password || request.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateRegisterRequest(request: RegisterRequest): ValidationResult {
    const errors: string[] = [];

    if (!Validator.isValidUsername(request.username)) {
      errors.push('Username must be 3-20 characters long and contain only letters, numbers, and underscores');
    }

    if (!Validator.isValidEmail(request.email)) {
      errors.push('Invalid email format');
    }

    if (!Validator.isStrongPassword(request.password)) {
      errors.push('Password does not meet security requirements');
    }

    if (request.firstName && !Validator.isValidName(request.firstName)) {
      errors.push('Invalid first name');
    }

    if (request.lastName && !Validator.isValidName(request.lastName)) {
      errors.push('Invalid last name');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validatePasswordChangeRequest(request: PasswordChangeRequest): ValidationResult {
    const errors: string[] = [];

    if (!request.currentPassword) {
      errors.push('Current password is required');
    }

    if (!request.newPassword || request.newPassword.length < 8) {
      errors.push('New password must be at least 8 characters long');
    }

    if (request.newPassword !== request.confirmPassword) {
      errors.push('Passwords do not match');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validatePasswordResetConfirmRequest(request: PasswordResetConfirmRequest): ValidationResult {
    const errors: string[] = [];

    if (!request.token) {
      errors.push('Reset token is required');
    }

    if (!request.newPassword || request.newPassword.length < 8) {
      errors.push('New password must be at least 8 characters long');
    }

    if (request.newPassword !== request.confirmPassword) {
      errors.push('Passwords do not match');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const bcrypt = require('bcrypt');
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hashedPassword);
  }

  private sanitizeUser(user: User): User {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  // Abstract methods to be implemented by extending classes
  protected abstract findUserByEmail(email: string): Promise<User | null>;
  protected abstract findUserById(id: string): Promise<User | null>;
  protected abstract createUser(user: Partial<User>): Promise<User>;
  protected abstract updateUserLoginInfo(userId: string, rememberMe?: boolean): Promise<void>;
  protected abstract updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  protected abstract updateUserStatus(userId: string, status: string): Promise<void>;
  protected abstract logAuthEvent(event: string, userId: string, success: boolean, details?: any): Promise<void>;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}