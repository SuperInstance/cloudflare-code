/**
 * Authentication Service Interface
 * Defines the contract for authentication implementations
 */

import {
  User,
  AuthToken,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  LogoutRequest,
  PasswordChangeRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest
} from '../auth/types';

export interface AuthServiceInterface {
  /**
   * Authenticate user with credentials
   */
  login(request: LoginRequest): Promise<LoginResponse>;

  /**
   * Register a new user
   */
  register(request: RegisterRequest): Promise<RegisterResponse>;

  /**
   * Refresh authentication tokens
   */
  refreshToken(request: RefreshTokenRequest): Promise<{ success: boolean; token?: AuthToken; error?: string }>;

  /**
   * Logout user and terminate sessions
   */
  logout(request: LogoutRequest): Promise<{ success: boolean; error?: string }>;

  /**
   * Change user password
   */
  changePassword(request: PasswordChangeRequest, userId: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Request password reset
   */
  requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Confirm password reset
   */
  confirmPasswordReset(request: PasswordResetConfirmRequest): Promise<{ success: boolean; error?: string }>;

  /**
   * Validate user credentials
   */
  validateCredentials(email: string, password: string): Promise<{ valid: boolean; user?: User }>;

  /**
   * Get user by ID
   */
  getUserById(id: string): Promise<User | null>;

  /**
   * Get user by email
   */
  getUserByEmail(email: string): Promise<User | null>;

  /**
   * Update user information
   */
  updateUser(userId: string, updates: Partial<User>): Promise<User>;

  /**
   * Lock user account
   */
  lockUser(userId: string): Promise<boolean>;

  /**
   * Unlock user account
   */
  unlockUser(userId: string): Promise<boolean>;

  /**
   * Check if user account is active
   */
  isUserActive(userId: string): Promise<boolean>;
}