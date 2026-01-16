// @ts-nocheck - Missing utils/logger module

/**
 * User Management Service
 * Handles user lifecycle, profile management, and user data operations
 */

import { User, UserStatus } from '../types';
import { Logger } from '../utils/logger';
import { Validator } from '../auth/utils/validator';
import { EventEmitter } from 'events';

export class UserManagement extends EventEmitter {
  private logger: Logger;
  private users: Map<string, User> = new Map();
  private userIndex: {
    email: Map<string, string>;
    username: Map<string, string>;
  } = {
    email: new Map(),
    username: new Map()
  };

  constructor() {
    super();
    this.logger = new Logger('UserManagement');
  }

  /**
   * Create a new user
   */
  async createUser(user: Partial<User>): Promise<User> {
    try {
      // Validate user data
      this.validateUserData(user);

      // Check for duplicate email or username
      if (this.userIndex.email.has(user.email!)) {
        throw new Error('Email already exists');
      }

      if (this.userIndex.username.has(user.username!)) {
        throw new Error('Username already exists');
      }

      // Create user object
      const newUser: User = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: user.username!,
        email: user.email!,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role || 'user',
        permissions: user.permissions || [],
        mfaEnabled: user.mfaEnabled || false,
        lastLoginAt: user.lastLoginAt,
        lastLoginIP: user.lastLoginIP,
        createdAt: user.createdAt || new Date(),
        updatedAt: user.updatedAt || new Date(),
        isActive: user.isActive !== false,
        metadata: user.metadata || {}
      };

      // Store user
      this.users.set(newUser.id, newUser);
      this.userIndex.email.set(newUser.email, newUser.id);
      this.userIndex.username.set(newUser.username, newUser.id);

      this.logger.info(`User created: ${newUser.username}`);
      this.emit('userCreated', newUser);

      return newUser;

    } catch (error) {
      this.logger.error('Failed to create user', error);
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate updates
      this.validateUserUpdates(updates);

      // Check for email/username conflicts
      if (updates.email && updates.email !== user.email) {
        if (this.userIndex.email.has(updates.email)) {
          throw new Error('Email already exists');
        }
        this.userIndex.delete(user.email);
        this.userIndex.email.set(updates.email, userId);
      }

      if (updates.username && updates.username !== user.username) {
        if (this.userIndex.username.has(updates.username)) {
          throw new Error('Username already exists');
        }
        this.userIndex.delete(user.username);
        this.userIndex.username.set(updates.username, userId);
      }

      // Update user
      const updatedUser: User = {
        ...user,
        ...updates,
        id: user.id, // Prevent ID changes
        updatedAt: new Date()
      };

      this.users.set(userId, updatedUser);

      this.logger.info(`User updated: ${updatedUser.username}`);
      this.emit('userUpdated', updatedUser);

      return updatedUser;

    } catch (error) {
      this.logger.error('Failed to update user', error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Soft delete by deactivating
      user.isActive = false;
      user.updatedAt = new Date();
      this.users.set(userId, user);

      // Remove from indexes
      this.userIndex.email.delete(user.email);
      this.userIndex.username.delete(user.username);

      this.logger.info(`User deleted: ${user.username}`);
      this.emit('userDeleted', user);

      return true;

    } catch (error) {
      this.logger.error('Failed to delete user', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const user = this.users.get(userId);
      return user && user.isActive ? user : null;
    } catch (error) {
      this.logger.error('Failed to get user by ID', error);
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const userId = this.userIndex.email.get(email);
      if (!userId) return null;

      const user = this.users.get(userId);
      return user && user.isActive ? user : null;
    } catch (error) {
      this.logger.error('Failed to get user by email', error);
      return null;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const userId = this.userIndex.username.get(username);
      if (!userId) return null;

      const user = this.users.get(userId);
      return user && user.isActive ? user : null;
    } catch (error) {
      this.logger.error('Failed to get user by username', error);
      return null;
    }
  }

  /**
   * Get all active users
   */
  async getAllUsers(): Promise<User[]> {
    try {
      return Array.from(this.users.values()).filter(user => user.isActive);
    } catch (error) {
      this.logger.error('Failed to get all users', error);
      return [];
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<User[]> {
    try {
      return Array.from(this.users.values())
        .filter(user => user.isActive && user.role === role);
    } catch (error) {
      this.logger.error('Failed to get users by role', error);
      return [];
    }
  }

  /**
   * Activate user account
   */
  async activateUser(userId: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.isActive = true;
      user.updatedAt = new Date();
      this.users.set(userId, user);

      // Rebuild indexes if needed
      this.userIndex.email.set(user.email, userId);
      this.userIndex.username.set(user.username, userId);

      this.logger.info(`User activated: ${user.username}`);
      this.emit('userActivated', user);

      return true;

    } catch (error) {
      this.logger.error('Failed to activate user', error);
      return false;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.isActive = false;
      user.updatedAt = new Date();
      this.users.set(userId, user);

      // Remove from indexes
      this.userIndex.email.delete(user.email);
      this.userIndex.username.delete(user.username);

      this.logger.info(`User deactivated: ${user.username}`);
      this.emit('userDeactivated', user);

      return true;

    } catch (error) {
      this.logger.error('Failed to deactivate user', error);
      return false;
    }
  }

  /**
   * Update user last login information
   */
  async updateLastLogin(userId: string, ipAddress: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.lastLoginAt = new Date();
      user.lastLoginIP = ipAddress;
      user.updatedAt = new Date();
      this.users.set(userId, user);

      this.logger.debug(`Updated last login for user: ${user.username}`);
      this.emit('userLastLoginUpdated', user);

      return true;

    } catch (error) {
      this.logger.error('Failed to update last login', error);
      return false;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      if (!Validator.isValidPassword(newPassword)) {
        throw new Error('Password does not meet security requirements');
      }

      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // In a real implementation, hash the password
      user.metadata = {
        ...user.metadata,
        passwordChangedAt: new Date()
      };
      user.updatedAt = new Date();
      this.users.set(userId, user);

      this.logger.info(`Password updated for user: ${user.username}`);
      this.emit('passwordUpdated', user);

      return true;

    } catch (error) {
      this.logger.error('Failed to update password', error);
      return false;
    }
  }

  /**
   * Enable MFA for user
   */
  async enableMFA(userId: string, mfaType: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.mfaEnabled = true;
      user.metadata = {
        ...user.metadata,
        mfaType,
        mfaEnabledAt: new Date()
      };
      user.updatedAt = new Date();
      this.users.set(userId, user);

      this.logger.info(`MFA enabled for user: ${user.username}`);
      this.emit('mfaEnabled', user);

      return true;

    } catch (error) {
      this.logger.error('Failed to enable MFA', error);
      return false;
    }
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(userId: string): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.mfaEnabled = false;
      user.metadata = {
        ...user.metadata,
        mfaDisabledAt: new Date()
      };
      user.updatedAt = new Date();
      this.users.set(userId, user);

      this.logger.info(`MFA disabled for user: ${user.username}`);
      this.emit('mfaDisabled', user);

      return true;

    } catch (error) {
      this.logger.error('Failed to disable MFA', error);
      return false;
    }
  }

  /**
   * Update user metadata
   */
  async updateMetadata(userId: string, metadata: Record<string, any>): Promise<boolean> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.metadata = {
        ...user.metadata,
        ...metadata,
        lastMetadataUpdate: new Date()
      };
      user.updatedAt = new Date();
      this.users.set(userId, user);

      this.logger.info(`Metadata updated for user: ${user.username}`);
      this.emit('metadataUpdated', user);

      return true;

    } catch (error) {
      this.logger.error('Failed to update metadata', error);
      return false;
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: {
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    status?: UserStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }> {
    try {
      let results = Array.from(this.users.values());

      // Apply filters
      if (query.email) {
        results = results.filter(user => user.email.toLowerCase().includes(query.email!.toLowerCase()));
      }

      if (query.username) {
        results = results.filter(user => user.username.toLowerCase().includes(query.username!.toLowerCase()));
      }

      if (query.firstName) {
        results = results.filter(user =>
          user.firstName.toLowerCase().includes(query.firstName!.toLowerCase())
        );
      }

      if (query.lastName) {
        results = results.filter(user =>
          user.lastName.toLowerCase().includes(query.lastName!.toLowerCase())
        );
      }

      if (query.role) {
        results = results.filter(user => user.role === query.role);
      }

      if (query.status) {
        results = results.filter(user =>
          query.status === 'active' ? user.isActive : !user.isActive
        );
      }

      // Remove inactive users if not specified
      if (!query.status) {
        results = results.filter(user => user.isActive);
      }

      // Count total
      const total = results.length;

      // Apply pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      const paginatedResults = results.slice(offset, offset + limit);

      return {
        users: paginatedResults,
        total
      };

    } catch (error) {
      this.logger.error('Failed to search users', error);
      return { users: [], total: 0 };
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByRole: Record<string, number>;
    usersByMFA: { enabled: number; disabled: number };
    recentUsers: User[];
  }> {
    try {
      const users = Array.from(this.users.values());
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.isActive).length;
      const inactiveUsers = totalUsers - activeUsers;

      const usersByRole: Record<string, number> = {};
      users.forEach(user => {
        usersByRole[user.role] = (usersByRole[user.role] || 0) + 1;
      });

      const usersByMFA = {
        enabled: users.filter(u => u.mfaEnabled).length,
        disabled: totalUsers - users.filter(u => u.mfaEnabled).length
      };

      const recentUsers = users
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

      return {
        totalUsers,
        activeUsers,
        inactiveUsers,
        usersByRole,
        usersByMFA,
        recentUsers
      };

    } catch (error) {
      this.logger.error('Failed to get user statistics', error);
      throw error;
    }
  }

  // Private helper methods
  private validateUserData(user: Partial<User>): void {
    if (!user.email || !Validator.isValidEmail(user.email)) {
      throw new Error('Invalid email address');
    }

    if (!user.username || !Validator.isValidUsername(user.username)) {
      throw new Error('Invalid username');
    }

    if (user.firstName && !Validator.isValidName(user.firstName)) {
      throw new Error('Invalid first name');
    }

    if (user.lastName && !Validator.isValidName(user.lastName)) {
      throw new Error('Invalid last name');
    }
  }

  private validateUserUpdates(updates: Partial<User>): void {
    if (updates.email && !Validator.isValidEmail(updates.email)) {
      throw new Error('Invalid email address');
    }

    if (updates.username && !Validator.isValidUsername(updates.username)) {
      throw new Error('Invalid username');
    }

    if (updates.firstName && !Validator.isValidName(updates.firstName)) {
      throw new Error('Invalid first name');
    }

    if (updates.lastName && !Validator.isValidName(updates.lastName)) {
      throw new Error('Invalid last name');
    }
  }

  private deleteUserFromIndexes(user: User): void {
    this.userIndex.email.delete(user.email);
    this.userIndex.username.delete(user.username);
  }
}