/**
 * Enterprise Authentication Service
 * Provides comprehensive authentication functionality
 */

import { SecurityError } from '../types/security';

// Type definitions
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'developer' | 'user';
  mfaEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  mfaCode?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: AuthToken;
  user?: Partial<User>;
  error?: string;
  requiresMFA?: boolean;
  mfaChallenge?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}

export interface RegisterResponse {
  success: boolean;
  user?: Partial<User>;
  error?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtAlgorithm: string;
  jwtExpiry: number;
  refreshTokenExpiry: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  mfaRequired: boolean;
  sessionTimeout: number;
  cookieSecure: boolean;
  cookieSameSite: 'strict' | 'lax' | 'none';
}

// In-memory storage for demo
const userStore = new Map<string, User>();
const apiKeyStore = new Map<string, {
  key: string;
  userId: string;
  name: string;
  createdAt: Date;
  lastUsed?: Date;
  permissions: string[];
}>();

export class EnterpriseAuthService {
  private loginAttempts: Map<string, { attempts: number; lastAttempt: Date }> = new Map();
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.initializeDemoUsers();
  }

  // Authentication Methods
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      // Validate request
      if (!request.email || !request.password) {
        return {
          success: false,
          error: 'Email and password are required'
        };
      }

      // Check login attempts
      await this.checkLoginAttempts(request.email);

      // Find user
      const user = await this.findUserByEmail(request.email);
      console.log('Login attempt for email:', request.email, 'User found:', !!user);

      if (!user || !user.isActive) {
        console.log('User not found or inactive');
        await this.recordFailedLogin(request.email);
        throw new SecurityError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      // Verify password
      const hash = await this.hashPassword(request.password);
      console.log('Password hash attempt:', hash, 'Stored hash:', user.password);
      const isPasswordValid = await this.verifyPassword(request.password, user.password);
      console.log('Password valid:', isPasswordValid);

      if (!isPasswordValid) {
        console.log('Password verification failed');
        await this.recordFailedLogin(request.email);
        throw new SecurityError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      // Generate tokens
      console.log('Generating tokens for user:', user.id);
      const token = await this.generateTokens(user);
      console.log('Token generated successfully');

      // Update user login info
      console.log('Updating user login info');
      await this.updateUserLoginInfo(user.id, request.rememberMe);

      const sanitizedUser = this.sanitizeUser(user);
      console.log('Login successful, returning user data');
      return {
        success: true,
        token,
        user: sanitizedUser
      };

    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError('Authentication failed', 'AUTHENTICATION_FAILED', 500);
    }
  }

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    try {
      // Validate request
      if (!request.email || !request.password || !request.username) {
        return {
          success: false,
          error: 'Email, password, and username are required'
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
        role: (request.role || 'user') as 'admin' | 'developer' | 'user',
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      });

      // Generate tokens
      await this.generateTokens(user);

      return {
        success: true,
        user: this.sanitizeUser(user)
      };

    } catch (error) {
      throw new SecurityError('Registration failed', 'REGISTRATION_FAILED', 500);
    }
  }

  async logout(request: LogoutRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Invalidate tokens by adding to blacklist
      // In a real implementation, you would use a proper token store
      console.log('Logout for user with access token:', request.accessToken);

      return { success: true };
    } catch (error) {
      throw new SecurityError('Logout failed', 'LOGOUT_FAILED', 500);
    }
  }

  async refreshToken(request: RefreshTokenRequest): Promise<{ success: boolean; token?: AuthToken; error?: string }> {
    try {
      // Simple validation - in production, verify the refresh token properly
      if (!request.refreshToken) {
        throw new SecurityError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
      }

      // For demo, return a new token
      // In production, you would validate the refresh token and get user info
      const dummyUser = await this.findUserByEmail('admin@claudeflare.com');
      if (!dummyUser) {
        throw new SecurityError('User not found', 'USER_NOT_FOUND', 404);
      }

      const newToken = await this.generateTokens(dummyUser);
      return {
        success: true,
        token: newToken
      };

    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError('Token refresh failed', 'TOKEN_REFRESH_FAILED', 500);
    }
  }

  // OAuth 2.0 Methods (simplified for demo)
  async getOAuth2AuthorizationUrl(_provider: string): Promise<{ url: string; state: string; codeVerifier?: string }> {
    // In production, this would generate proper OAuth URLs
    return {
      url: `https://github.com/login/oauth/authorize?client_id=${this.config.jwtSecret}&redirect_uri=${encodeURIComponent('https://your-domain.com/api/v1/auth/oauth2/github/callback')}&scope=user:email`,
      state: Math.random().toString(36).substring(7),
      codeVerifier: Math.random().toString(36).substring(7)
    };
  }

  async handleOAuth2Callback(_provider: string, _request: { code: string; state: string }): Promise<any> {
    // In production, this would exchange code for tokens and get user info
    const user = await this.findUserByEmail('admin@claudeflare.com');

    if (!user) {
      throw new SecurityError('User not found', 'USER_NOT_FOUND', 404);
    }

    const token = await this.generateTokens(user);

    return {
      success: true,
      token,
      user: this.sanitizeUser(user)
    };
  }

  // SAML 2.0 Methods (simplified for demo)
  async getSAML2AuthorizationUrl(_provider: string): Promise<string> {
    // In production, this would generate proper SAML URLs
    return `https://your-saml-provider.com/saml2/idp/SSOService.php?RelayState=${encodeURIComponent('https://your-domain.com/api/v1/auth/saml2/callback')}`;
  }

  async handleSAML2Callback(_provider: string, _assertion: any): Promise<any> {
    // In production, this would validate SAML assertion and get user info
    const user = await this.findUserByEmail('admin@claudeflare.com');

    if (!user) {
      throw new SecurityError('User not found', 'USER_NOT_FOUND', 404);
    }

    const token = await this.generateTokens(user);

    return {
      success: true,
      token,
      user: this.sanitizeUser(user)
    };
  }

  // MFA Methods (simplified for demo)
  async setupMFA(_userId: string, _method: 'totp' | 'sms' | 'email'): Promise<any> {
    // In production, this would generate MFA secrets and setup codes
    return {
      success: true,
      secret: 'JBSWY3DPEHPK3PXP',
      qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      backupCodes: ['123456', '789012', '345678', '901234', '567890']
    };
  }

  async verifyMFA(_userId: string, _code: string): Promise<any> {
    // In production, this would verify the MFA code
    return {
      success: true,
      message: 'MFA verified successfully'
    };
  }

  // API Key Management
  async createApiKey(userId: string, name: string, permissions: string[]): Promise<string> {
    const key = 'cf_' + Buffer.from(Math.random().toString() + Date.now().toString()).toString('base64');
    apiKeyStore.set(key, {
      key,
      userId,
      name,
      createdAt: new Date(),
      permissions
    });
    return key;
  }

  async validateApiKey(apiKey: string): Promise<{ userId: string; permissions: string[] } | null> {
    const keyData = apiKeyStore.get(apiKey);
    if (!keyData) {
      return null;
    }

    // Update last used time
    keyData.lastUsed = new Date();
    apiKeyStore.set(apiKey, keyData);

    return {
      userId: keyData.userId,
      permissions: keyData.permissions
    };
  }

  async listApiKeys(userId: string): Promise<any[]> {
    const keys = Array.from(apiKeyStore.values())
      .filter(key => key.userId === userId)
      .map(({ key, ...rest }) => ({
        ...rest,
        key: '****' + key.slice(-8) // Mask the key
      }));
    return keys;
  }

  async revokeApiKey(userId: string, key: string): Promise<boolean> {
    const keyData = apiKeyStore.get(key);
    if (keyData && keyData.userId === userId) {
      apiKeyStore.delete(key);
      return true;
    }
    return false;
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

    if (attempts.attempts >= this.config.maxLoginAttempts) {
      // Optionally lock the account
      await this.lockUserAccount(email);
    }
  }

  private async lockUserAccount(email: string): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (user) {
      user.isActive = false;
      userStore.set(user.email, user);
    }
  }

  private async generateTokens(user: User): Promise<AuthToken> {
    try {
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + this.config.jwtExpiry
      };

      const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + btoa(JSON.stringify(payload));

      const refreshPayload = {
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + this.config.refreshTokenExpiry
      };

      const refreshToken = 'refresh_' + btoa(JSON.stringify(refreshPayload));

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.config.jwtExpiry,
        scope: ['read', 'write']
      };
    } catch (error) {
      console.error('Token generation error:', error);
      throw new Error('Failed to generate tokens');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    // Simple hash for demo - in production, use bcrypt
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const hash = await this.hashPassword(password);
    return hash === hashedPassword;
  }

  private sanitizeUser(user: User): Partial<User> {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  // Abstract method implementations
  protected async findUserByEmail(email: string): Promise<User | null> {
    return userStore.get(email) || null;
  }

  protected async findUserById(id: string): Promise<User | null> {
    for (const user of userStore.values()) {
      if (user.id === id) {
        return user;
      }
    }
    return null;
  }

  protected async createUser(user: Partial<User>): Promise<User> {
    const newUser: User = {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      username: user.username!,
      email: user.email!,
      password: user.password!,
      firstName: user.firstName!,
      lastName: user.lastName!,
      role: user.role || 'user',
      mfaEnabled: user.mfaEnabled || false,
      isActive: user.isActive || true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    userStore.set(user.email!, newUser);
    return newUser;
  }

  protected async updateUserLoginInfo(userId: string, _rememberMe?: boolean): Promise<void> {
    const user = await this.findUserById(userId);
    if (user) {
      user.updatedAt = new Date();
      userStore.set(user.email, user);
    }
  }

  protected async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    const user = await this.findUserById(userId);
    if (user) {
      user.password = hashedPassword;
      user.updatedAt = new Date();
      userStore.set(user.email, user);
    }
  }

  protected async updateUserStatus(userId: string, status: string): Promise<void> {
    const user = await this.findUserById(userId);
    if (user) {
      user.isActive = status === 'active';
      user.updatedAt = new Date();
      userStore.set(user.email, user);
    }
  }

  // Session management methods
  async getSession(_sessionId: string): Promise<any> {
    // In production, this would fetch from a session store
    // For demo, return a dummy session
    return {
      userId: 'demo-user-id',
      userEmail: 'demo@claudeflare.com',
      userRole: 'developer',
      permissions: ['read', 'write'],
      createdAt: new Date(),
      lastUsed: new Date()
    };
  }

  async requestPasswordReset(email: string): Promise<any> {
    // In production, this would generate a reset token and send email
    console.log(`Password reset requested for email: ${email}`);
    return { success: true };
  }

  private async initializeDemoUsers() {
    // Create demo users with pre-hashed passwords
    const demoUsers: Omit<User, 'id'>[] = [
      {
        username: 'admin',
        email: 'admin@claudeflare.com',
        password: '4889ba9b', // hash of 'password' using our hash function
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin' as const,
        mfaEnabled: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        username: 'developer',
        email: 'developer@claudeflare.com',
        password: '4889ba9b', // hash of 'password' using our hash function
        firstName: 'Developer',
        lastName: 'User',
        role: 'developer' as const,
        mfaEnabled: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const userData of demoUsers) {
      if (!userStore.has(userData.email)) {
        userStore.set(userData.email, {
          ...userData,
          id: 'user_' + Math.random().toString(36).substr(2, 9)
        });
      }
    }
  }
}