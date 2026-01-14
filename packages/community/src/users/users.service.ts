/**
 * User Service
 * Handles user management, profiles, and preferences
 */

import { DatabaseConnection, BaseRepository } from '../utils/database';
import { generateUniqueSlug, generateSlug } from '../utils/database';
import {
  User,
  UserPublicProfile,
  UserRole,
  UserStats,
  UserPreferences,
  Badge,
  PaginationMeta,
  PaginatedResponse
} from '../types';

export class UserRepository extends BaseRepository<User> {
  tableName = 'users';

  async findByUsername(username: string): Promise<User | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE username = ? AND deleted_at IS NULL LIMIT 1`;
    return this.db.queryOne<User>(sql, [username]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE email = ? AND deleted_at IS NULL LIMIT 1`;
    return this.db.queryOne<User>(sql, [email]);
  }

  async search(query: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<UserPublicProfile>> {
    const searchTerm = `%${query}%`;
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count
      FROM users
      WHERE deleted_at IS NULL
      AND (username LIKE ? OR display_name LIKE ? OR bio LIKE ?)
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [searchTerm, searchTerm, searchTerm]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT
        id, username, display_name, avatar_url, bio, location, website,
        reputation, role, joined_at, last_active_at, is_verified
      FROM users
      WHERE deleted_at IS NULL
      AND (username LIKE ? OR display_name LIKE ? OR bio LIKE ?)
      ORDER BY reputation DESC, created_at ASC
      LIMIT ? OFFSET ?
    `;
    const users = await this.db.query<any>(sql, [searchTerm, searchTerm, searchTerm, perPage, offset]);

    const data: UserPublicProfile[] = users.map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      bio: u.bio,
      location: u.location,
      website: u.website,
      reputation: u.reputation,
      role: u.role,
      badges: [],
      stats: {
        posts_count: 0,
        questions_count: 0,
        answers_count: 0,
        comment_count: 0,
        upvotes_received: 0,
        downvotes_received: 0,
        best_answers: 0,
        solutions_provided: 0,
        code_shared: 0,
        reputation_gained: 0
      },
      joined_at: u.created_at,
      last_active_at: u.last_active_at,
      is_verified: u.is_verified
    }));

    return {
      data,
      meta: {
        total,
        page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage)
      }
    };
  }

  async getTopContributors(limit: number = 10): Promise<UserPublicProfile[]> {
    const sql = `
      SELECT
        id, username, display_name, avatar_url, bio,
        reputation, role, created_at, last_active_at, is_verified
      FROM users
      WHERE deleted_at IS NULL
      AND is_banned = 0
      ORDER BY reputation DESC
      LIMIT ?
    `;
    const users = await this.db.query<any>(sql, [limit]);

    return users.map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      bio: u.bio,
      reputation: u.reputation,
      role: u.role,
      badges: [],
      stats: {
        posts_count: 0,
        questions_count: 0,
        answers_count: 0,
        comment_count: 0,
        upvotes_received: 0,
        downvotes_received: 0,
        best_answers: 0,
        solutions_provided: 0,
        code_shared: 0,
        reputation_gained: 0
      },
      joined_at: u.created_at,
      last_active_at: u.last_active_at,
      is_verified: u.is_verified
    }));
  }

  async updateLastActive(userId: string): Promise<void> {
    const sql = `
      UPDATE users
      SET last_active_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this.db.execute(sql, [userId]);
  }

  async updateStats(userId: string): Promise<void> {
    const sql = `
      UPDATE users
      SET
        stats_posts_count = (
          SELECT COUNT(*) FROM forum_threads WHERE author_id = ?
        ),
        stats_questions_count = (
          SELECT COUNT(*) FROM questions WHERE author_id = ?
        ),
        stats_answers_count = (
          SELECT COUNT(*) FROM answers WHERE author_id = ?
        ),
        stats_upvotes_received = (
          SELECT COUNT(*) FROM votes
          WHERE target_id IN (
            SELECT id FROM questions WHERE author_id = ?
            UNION
            SELECT id FROM answers WHERE author_id = ?
          )
          AND vote_type = 'upvote'
        ),
        stats_best_answers = (
          SELECT COUNT(*) FROM answers
          WHERE author_id = ? AND is_accepted = 1
        )
      WHERE id = ?
    `;
    await this.db.execute(sql, [userId, userId, userId, userId, userId, userId, userId]);
  }

  async changeRole(userId: string, newRole: UserRole, performedBy: string): Promise<boolean> {
    const sql = `
      UPDATE users
      SET role = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [newRole, userId]);

    // Log the action
    await this.db.execute(`
      INSERT INTO moderation_logs (action, moderator_id, target_type, target_id, details, created_at)
      VALUES (?, ?, 'user', ?, ?, CURRENT_TIMESTAMP)
    `, [`Role changed to ${newRole}`, performedBy, JSON.stringify({ newRole })]);

    return result.rowsAffected > 0;
  }

  async updateReputation(userId: string, change: number, reason: string): Promise<User | null> {
    const sql = `
      UPDATE users
      SET reputation = reputation + ?,
          reputation_gained = reputation_gained + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `;
    const result = await this.db.queryOne<any>(sql, [change, Math.max(0, change), userId]);

    if (result) {
      // Log reputation event
      await this.db.execute(`
        INSERT INTO reputation_events (user_id, amount, reason, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [userId, change, reason]);
    }

    return result;
  }

  async banUser(userId: string, reason: string, duration?: number, permanent: boolean = false): Promise<boolean> {
    const banUntil = duration
      ? new Date(Date.now() + duration * 1000)
      : permanent
      ? null
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const sql = `
      UPDATE users
      SET is_banned = 1,
          ban_reason = ?,
          ban_until = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [reason, banUntil?.toISOString(), userId]);
    return result.rowsAffected > 0;
  }

  async unbanUser(userId: string): Promise<boolean> {
    const sql = `
      UPDATE users
      SET is_banned = 0,
          ban_reason = NULL,
          ban_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [userId]);
    return result.rowsAffected > 0;
  }

  async getPublicProfile(userId: string): Promise<UserPublicProfile | null> {
    const sql = `
      SELECT
        id, username, display_name, avatar_url, bio, location, website,
        github_url, twitter_url, linkedin_url,
        reputation, role, created_at, last_active_at, is_verified
      FROM users
      WHERE id = ? AND deleted_at IS NULL
    `;
    const user = await this.db.queryOne<any>(sql, [userId]);

    if (!user) return null;

    // Get user badges
    const badgesSql = `
      SELECT b.id, b.name, b.description, b.icon_url, b.category, b.level, ub.earned_at
      FROM badges b
      JOIN user_badges ub ON b.id = ub.badge_id
      WHERE ub.user_id = ?
      ORDER BY b.level, ub.earned_at DESC
    `;
    const badges = await this.db.query<any>(badgesSql, [userId]);

    // Get user stats
    const stats = await this.getUserStats(userId);

    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      location: user.location,
      website: user.website,
      reputation: user.reputation,
      role: user.role,
      badges: badges.map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon_url: b.icon_url,
        category: b.category,
        level: b.level,
        requirement: { type: 'custom', target: 0, description: '' },
        earned_at: b.earned_at
      })),
      stats,
      joined_at: user.created_at,
      last_active_at: user.last_active_at,
      is_verified: user.is_verified
    };
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const sql = `
      SELECT
        COALESCE(posts_count, 0) as posts_count,
        COALESCE(questions_count, 0) as questions_count,
        COALESCE(answers_count, 0) as answers_count,
        COALESCE(comment_count, 0) as comment_count,
        COALESCE(upvotes_received, 0) as upvotes_received,
        COALESCE(downvotes_received, 0) as downvotes_received,
        COALESCE(best_answers, 0) as best_answers,
        COALESCE(solutions_provided, 0) as solutions_provided,
        COALESCE(code_shared, 0) as code_shared,
        COALESCE(reputation_gained, 0) as reputation_gained
      FROM user_stats
      WHERE user_id = ?
    `;
    const stats = await this.db.queryOne<UserStats>(sql, [userId]);

    return stats || {
      posts_count: 0,
      questions_count: 0,
      answers_count: 0,
      comment_count: 0,
      upvotes_received: 0,
      downvotes_received: 0,
      best_answers: 0,
      solutions_provided: 0,
      code_shared: 0,
      reputation_gained: 0
    };
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    if (preferences.email_notifications !== undefined) {
      updates.push('pref_email_notifications = ?');
      params.push(preferences.email_notifications);
    }
    if (preferences.push_notifications !== undefined) {
      updates.push('pref_push_notifications = ?');
      params.push(preferences.push_notifications);
    }
    if (preferences.weekly_digest !== undefined) {
      updates.push('pref_weekly_digest = ?');
      params.push(preferences.weekly_digest);
    }
    if (preferences.mention_notifications !== undefined) {
      updates.push('pref_mention_notifications = ?');
      params.push(preferences.mention_notifications);
    }
    if (preferences.reply_notifications !== undefined) {
      updates.push('pref_reply_notifications = ?');
      params.push(preferences.reply_notifications);
    }
    if (preferences.badge_notifications !== undefined) {
      updates.push('pref_badge_notifications = ?');
      params.push(preferences.badge_notifications);
    }
    if (preferences.privacy_show_profile !== undefined) {
      updates.push('pref_privacy_show_profile = ?');
      params.push(preferences.privacy_show_profile);
    }
    if (preferences.privacy_show_activity !== undefined) {
      updates.push('pref_privacy_show_activity = ?');
      params.push(preferences.privacy_show_activity);
    }
    if (preferences.privacy_show_email !== undefined) {
      updates.push('pref_privacy_show_email = ?');
      params.push(preferences.privacy_show_email);
    }
    if (preferences.theme !== undefined) {
      updates.push('pref_theme = ?');
      params.push(preferences.theme);
    }
    if (preferences.language !== undefined) {
      updates.push('pref_language = ?');
      params.push(preferences.language);
    }
    if (preferences.timezone !== undefined) {
      updates.push('pref_timezone = ?');
      params.push(preferences.timezone);
    }

    if (updates.length === 0) return false;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    const sql = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, params);
    return result.rowsAffected > 0;
  }

  async getFollowers(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<UserPublicProfile>> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [userId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio,
             u.reputation, u.role, u.created_at, u.is_verified
      FROM user_follows uf
      JOIN users u ON uf.follower_id = u.id
      WHERE uf.following_id = ?
      ORDER BY uf.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const users = await this.db.query<any>(sql, [userId, perPage, offset]);

    return {
      data: users.map(u => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        bio: u.bio,
        reputation: u.reputation,
        role: u.role,
        badges: [],
        stats: {
          posts_count: 0,
          questions_count: 0,
          answers_count: 0,
          comment_count: 0,
          upvotes_received: 0,
          downvotes_received: 0,
          best_answers: 0,
          solutions_provided: 0,
          code_shared: 0,
          reputation_gained: 0
        },
        joined_at: u.created_at,
        last_active_at: u.created_at,
        is_verified: u.is_verified
      })),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async getFollowing(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<UserPublicProfile>> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [userId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio,
             u.reputation, u.role, u.created_at, u.is_verified
      FROM user_follows uf
      JOIN users u ON uf.following_id = u.id
      WHERE uf.follower_id = ?
      ORDER BY uf.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const users = await this.db.query<any>(sql, [userId, perPage, offset]);

    return {
      data: users.map(u => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        bio: u.bio,
        reputation: u.reputation,
        role: u.role,
        badges: [],
        stats: {
          posts_count: 0,
          questions_count: 0,
          answers_count: 0,
          comment_count: 0,
          upvotes_received: 0,
          downvotes_received: 0,
          best_answers: 0,
          solutions_provided: 0,
          code_shared: 0,
          reputation_gained: 0
        },
        joined_at: u.created_at,
        last_active_at: u.created_at,
        is_verified: u.is_verified
      })),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async followUser(followerId: string, followingId: string): Promise<boolean> {
    if (followerId === followingId) return false;

    const sql = `
      INSERT INTO user_follows (follower_id, following_id, created_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    const result = await this.db.execute(sql, [followerId, followingId]);

    // Create notification
    await this.db.execute(`
      INSERT INTO notifications (recipient_id, type, title, body, source_type, source_id, source_user_id, created_at)
      VALUES (?, 'user_follow', 'New follower', 'started following you', 'user', ?, ?, CURRENT_TIMESTAMP)
    `, [followingId, followerId, followerId]);

    return result.rowsAffected > 0;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    const sql = `DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?`;
    const result = await this.db.execute(sql, [followerId, followingId]);
    return result.rowsAffected > 0;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const sql = `SELECT 1 FROM user_follows WHERE follower_id = ? AND following_id = ? LIMIT 1`;
    const result = await this.db.queryOne(sql, [followerId, followingId]);
    return result !== null;
  }

  async getActiveUsers(days: number = 7, limit: number = 20): Promise<UserPublicProfile[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const sql = `
      SELECT DISTINCT u.id, u.username, u.display_name, u.avatar_url, u.bio,
             u.reputation, u.role, u.created_at, u.last_active_at, u.is_verified
      FROM users u
      WHERE u.deleted_at IS NULL
      AND u.is_banned = 0
      AND u.last_active_at > ?
      ORDER BY u.last_active_at DESC
      LIMIT ?
    `;
    const users = await this.db.query<any>(sql, [since.toISOString(), limit]);

    return users.map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      bio: u.bio,
      reputation: u.reputation,
      role: u.role,
      badges: [],
      stats: {
        posts_count: 0,
        questions_count: 0,
        answers_count: 0,
        comment_count: 0,
        upvotes_received: 0,
        downvotes_received: 0,
        best_answers: 0,
        solutions_provided: 0,
        code_shared: 0,
        reputation_gained: 0
      },
      joined_at: u.created_at,
      last_active_at: u.last_active_at,
      is_verified: u.is_verified
    }));
  }

  async getNewUsers(limit: number = 20): Promise<UserPublicProfile[]> {
    const sql = `
      SELECT id, username, display_name, avatar_url, bio,
             reputation, role, created_at, last_active_at, is_verified
      FROM users
      WHERE deleted_at IS NULL
      AND is_banned = 0
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const users = await this.db.query<any>(sql, [limit]);

    return users.map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      bio: u.bio,
      reputation: u.reputation,
      role: u.role,
      badges: [],
      stats: {
        posts_count: 0,
        questions_count: 0,
        answers_count: 0,
        comment_count: 0,
        upvotes_received: 0,
        downvotes_received: 0,
        best_answers: 0,
        solutions_provided: 0,
        code_shared: 0,
        reputation_gained: 0
      },
      joined_at: u.created_at,
      last_active_at: u.last_active_at,
      is_verified: u.is_verified
    }));
  }
}

export class UserService {
  constructor(private db: DatabaseConnection) {
    this.userRepo = new UserRepository(db);
  }

  private userRepo: UserRepository;

  async createUser(data: {
    username: string;
    email: string;
    password_hash: string;
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  }): Promise<User> {
    // Check if username or email already exists
    const existingUsername = await this.userRepo.findByUsername(data.username);
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    const existingEmail = await this.userRepo.findByEmail(data.email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    return this.userRepo.create({
      username: data.username,
      email: data.email,
      password_hash: data.password_hash,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
      bio: data.bio,
      reputation: 1,
      role: UserRole.MEMBER,
      is_verified: false,
      is_banned: false,
      last_active_at: new Date()
    } as any);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.userRepo.findByUsername(username);
  }

  async getPublicProfile(userId: string): Promise<UserPublicProfile | null> {
    return this.userRepo.getPublicProfile(userId);
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User | null> {
    const updateData: any = { ...data };

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.email;
    delete updateData.reputation;
    delete updateData.role;
    delete updateData.is_verified;
    delete updateData.is_banned;
    delete updateData.created_at;

    await this.userRepo.update(userId, updateData);
    return this.userRepo.findById(userId);
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<boolean> {
    return this.userRepo.update(userId, { avatar_url: avatarUrl } as any);
  }

  async changePassword(userId: string, newPasswordHash: string): Promise<boolean> {
    return this.userRepo.update(userId, { password_hash: newPasswordHash } as any);
  }

  async deleteAccount(userId: string): Promise<boolean> {
    return this.userRepo.delete(userId);
  }

  async searchUsers(query: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<UserPublicProfile>> {
    return this.userRepo.search(query, page, perPage);
  }

  async getTopContributors(limit: number = 10): Promise<UserPublicProfile[]> {
    return this.userRepo.getTopContributors(limit);
  }

  async updateLastActive(userId: string): Promise<void> {
    await this.userRepo.updateLastActive(userId);
  }

  async followUser(followerId: string, followingId: string): Promise<boolean> {
    return this.userRepo.followUser(followerId, followingId);
  }

  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    return this.userRepo.unfollowUser(followerId, followingId);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return this.userRepo.isFollowing(followerId, followingId);
  }

  async getFollowers(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<UserPublicProfile>> {
    return this.userRepo.getFollowers(userId, page, perPage);
  }

  async getFollowing(userId: string, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<UserPublicProfile>> {
    return this.userRepo.getFollowing(userId, page, perPage);
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<boolean> {
    return this.userRepo.updatePreferences(userId, preferences);
  }

  async getActiveUsers(days: number = 7, limit: number = 20): Promise<UserPublicProfile[]> {
    return this.userRepo.getActiveUsers(days, limit);
  }

  async getNewUsers(limit: number = 20): Promise<UserPublicProfile[]> {
    return this.userRepo.getNewUsers(limit);
  }

  // Admin operations
  async changeRole(userId: string, newRole: UserRole, adminId: string): Promise<boolean> {
    return this.userRepo.changeRole(userId, newRole, adminId);
  }

  async banUser(userId: string, reason: string, duration?: number, permanent: boolean = false): Promise<boolean> {
    return this.userRepo.banUser(userId, reason, duration, permanent);
  }

  async unbanUser(userId: string): Promise<boolean> {
    return this.userRepo.unbanUser(userId);
  }

  async verifyUser(userId: string): Promise<boolean> {
    return this.userRepo.update(userId, { is_verified: true } as any);
  }
}
