/**
 * Reputation Service
 * Handles reputation points, levels, and rewards
 */

import { DatabaseConnection, BaseRepository } from '../utils/database';
import {
  ReputationEvent,
  ReputationReason,
  ReputationSourceType,
  ReputationLevel,
  User
} from '../types';
import { REPUTATION_RULES, getReputationLevel, calculateReputationChange } from '../utils/helpers';

export class ReputationEventRepository extends BaseRepository<ReputationEvent> {
  tableName = 'reputation_events';

  async findByUser(userId: string, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE user_id = ?`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [userId]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const events = await this.db.query<ReputationEvent>(sql, [userId, perPage, offset]);

    return {
      data: events,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByReason(userId: string, reason: ReputationReason, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE user_id = ? AND reason = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [userId, reason]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ? AND reason = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const events = await this.db.query<ReputationEvent>(sql, [userId, reason, perPage, offset]);

    return {
      data: events,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async getTotalReputation(userId: string): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM ${this.tableName}
      WHERE user_id = ?
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    const result = await this.db.queryOne<{ total: number }>(sql, [userId]);
    return result.total;
  }

  async getReputationByReason(userId: string): Promise<Record<ReputationReason, number>> {
    const sql = `
      SELECT reason, SUM(amount) as total
      FROM ${this.tableName}
      WHERE user_id = ?
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      GROUP BY reason
    `;
    const results = await this.db.query<{ reason: ReputationReason; total: number }>(sql, [userId]);

    const totals: Record<string, number> = {};
    for (const result of results) {
      totals[result.reason] = result.total;
    }

    return totals as Record<ReputationReason, number>;
  }

  async expireOldEvents(): Promise<number> {
    const sql = `
      UPDATE ${this.tableName}
      SET amount = 0
      WHERE expires_at IS NOT NULL
      AND expires_at <= CURRENT_TIMESTAMP
      AND amount != 0
    `;
    const result = await this.db.execute(sql);
    return result.rowsAffected;
  }
}

export class ReputationService {
  constructor(
    private db: DatabaseConnection,
    private notificationService?: any
  ) {
    this.eventRepo = new ReputationEventRepository(db);
  }

  private eventRepo: ReputationEventRepository;

  // Add reputation
  async addReputation(
    userId: string,
    amount: number,
    reason: ReputationReason,
    sourceType: ReputationSourceType,
    sourceId: string,
    expiresAt?: Date
  ): Promise<ReputationEvent> {
    // Create reputation event
    const event = await this.eventRepo.create({
      user_id: userId,
      amount,
      reason,
      source_type: sourceType,
      source_id: sourceId,
      expires_at: expiresAt,
      created_at: new Date()
    } as any);

    // Update user's total reputation
    await this.updateUserReputation(userId);

    // Check for level up
    await this.checkLevelUp(userId);

    return event;
  }

  // Remove reputation (penalty)
  async removeReputation(
    userId: string,
    amount: number,
    reason: string,
    sourceType: ReputationSourceType,
    sourceId: string
  ): Promise<ReputationEvent> {
    return this.addReputation(userId, -Math.abs(amount), reason as ReputationReason, sourceType, sourceId);
  }

  // Get user's reputation
  async getUserReputation(userId: string): Promise<number> {
    return this.eventRepo.getTotalReputation(userId);
  }

  // Get user's reputation level
  async getUserReputationLevel(userId: string): Promise<string> {
    const reputation = await this.getUserReputation(userId);
    return getReputationLevel(reputation);
  }

  // Get reputation history
  async getReputationHistory(userId: string, page: number = 1, perPage: number = 20) {
    return this.eventRepo.findByUser(userId, page, perPage);
  }

  // Get reputation breakdown by reason
  async getReputationBreakdown(userId: string): Promise<Record<ReputationReason, number>> {
    return this.eventRepo.getReputationByReason(userId);
  }

  // Get reputation levels
  getReputationLevels(): ReputationLevel[] {
    return [
      {
        level: 1,
        name: 'Newcomer',
        min_reputation: 0,
        privileges: ['post_questions', 'post_answers', 'vote'],
        icon: '/levels/newcomer.svg'
      },
      {
        level: 2,
        name: 'Participant',
        min_reputation: 10,
        privileges: ['post_questions', 'post_answers', 'vote', 'comment'],
        icon: '/levels/participant.svg'
      },
      {
        level: 3,
        name: 'Contributor',
        min_reputation: 50,
        privileges: ['post_questions', 'post_answers', 'vote', 'comment', 'create_forum_threads'],
        icon: '/levels/contributor.svg'
      },
      {
        level: 4,
        name: 'Established',
        min_reputation: 100,
        privileges: [
          'post_questions',
          'post_answers',
          'vote',
          'comment',
          'create_forum_threads',
          'edit_community_posts',
          'flag_content'
        ],
        icon: '/levels/established.svg'
      },
      {
        level: 5,
        name: 'Noteworthy',
        min_reputation: 200,
        privileges: [
          'post_questions',
          'post_answers',
          'vote',
          'comment',
          'create_forum_threads',
          'edit_community_posts',
          'flag_content',
          'approve_tag_edits'
        ],
        icon: '/levels/noteworthy.svg'
      },
      {
        level: 6,
        name: 'Notable',
        min_reputation: 500,
        privileges: [
          'post_questions',
          'post_answers',
          'vote',
          'comment',
          'create_forum_threads',
          'edit_community_posts',
          'flag_content',
          'approve_tag_edits',
          'create_gallery_items'
        ],
        icon: '/levels/notable.svg'
      },
      {
        level: 7,
        name: 'Outstanding',
        min_reputation: 1000,
        privileges: [
          'post_questions',
          'post_answers',
          'vote',
          'comment',
          'create_forum_threads',
          'edit_community_posts',
          'flag_content',
          'approve_tag_edits',
          'create_gallery_items',
          'moderate_content',
          'access_analytics'
        ],
        icon: '/levels/outstanding.svg'
      },
      {
        level: 8,
        name: 'Exceptional',
        min_reputation: 2000,
        privileges: [
          'post_questions',
          'post_answers',
          'vote',
          'comment',
          'create_forum_threads',
          'edit_community_posts',
          'flag_content',
          'approve_tag_edits',
          'create_gallery_items',
          'moderate_content',
          'access_analytics',
          'create_bounties'
        ],
        icon: '/levels/exceptional.svg'
      },
      {
        level: 9,
        name: 'Rare',
        min_reputation: 5000,
        privileges: [
          'post_questions',
          'post_answers',
          'vote',
          'comment',
          'create_forum_threads',
          'edit_community_posts',
          'flag_content',
          'approve_tag_edits',
          'create_gallery_items',
          'moderate_content',
          'access_analytics',
          'create_bounties',
          'edit_tags',
          'close_questions'
        ],
        icon: '/levels/rare.svg'
      },
      {
        level: 10,
        name: 'Epic',
        min_reputation: 10000,
        privileges: [
          'all',
          'special_badges',
          'custom_title',
          'beta_features'
        ],
        icon: '/levels/epic.svg'
      },
      {
        level: 11,
        name: 'Legendary',
        min_reputation: 25000,
        privileges: [
          'all',
          'special_badges',
          'custom_title',
          'beta_features',
          'mentor_users',
          'community_council'
        ],
        icon: '/levels/legendary.svg'
      }
    ];
  }

  // Get user's current level
  async getUserCurrentLevel(userId: string): Promise<ReputationLevel> {
    const reputation = await this.getUserReputation(userId);
    const levels = this.getReputationLevels();

    let currentLevel = levels[0];
    for (const level of levels) {
      if (reputation >= level.min_reputation) {
        currentLevel = level;
      }
    }

    return currentLevel;
  }

  // Check if user has privilege
  async hasPrivilege(userId: string, privilege: string): Promise<boolean> {
    const level = await this.getUserCurrentLevel(userId);
    return level.privileges.includes(privilege) || level.privileges.includes('all');
  }

  // Calculate reputation change for an action
  calculateReputationChange(reason: ReputationReason, amount?: number): number {
    return calculateReputationChange(reason, amount);
  }

  // Award reputation for various actions
  async awardPostCreated(userId: string, postId: string): Promise<void> {
    await this.addReputation(userId, 5, 'post_created', 'forum_post', postId);
  }

  async awardPostUpvoted(userId: string, postId: string, voterId: string): Promise<void> {
    if (userId !== voterId) {
      await this.addReputation(userId, 10, 'post_upvoted', 'forum_post', postId);
    }
  }

  async awardPostDownvoted(userId: string, postId: string): Promise<void> {
    await this.removeReputation(userId, 2, 'post_downvoted', 'forum_post', postId);
  }

  async awardAnswerAccepted(userId: string, answerId: string): Promise<void> {
    await this.addReputation(userId, 25, 'answer_accepted', 'answer', answerId);
  }

  async awardAnswerUpvoted(userId: string, answerId: string, voterId: string): Promise<void> {
    if (userId !== voterId) {
      await this.addReputation(userId, 15, 'answer_upvoted', 'answer', answerId);
    }
  }

  async awardQuestionUpvoted(userId: string, questionId: string, voterId: string): Promise<void> {
    if (userId !== voterId) {
      await this.addReputation(userId, 10, 'question_upvoted', 'question', questionId);
    }
  }

  async awardCommentUpvoted(userId: string, commentId: string, voterId: string): Promise<void> {
    if (userId !== voterId) {
      await this.addReputation(userId, 5, 'comment_upvoted', 'comment', commentId);
    }
  }

  async awardBadgeEarned(userId: string, badgeId: string): Promise<void> {
    await this.addReputation(userId, 50, 'receiving_badge', 'badge', badgeId);
  }

  async awardBountyEarned(userId: string, bountyId: string, amount: number): Promise<void> {
    await this.addReputation(userId, amount, 'bounty_earned', 'bounty', bountyId);
  }

  async awardGalleryShared(userId: string, itemId: string): Promise<void> {
    await this.addReputation(userId, 10, 'gallery_shared', 'gallery', itemId);
  }

  async awardGalleryForked(authorId: string, itemId: string, forkerId: string): Promise<void> {
    if (authorId !== forkerId) {
      await this.addReputation(authorId, 5, 'gallery_forked', 'gallery', itemId);
    }
  }

  async awardGalleryRated(authorId: string, itemId: string, raterId: string): Promise<void> {
    if (authorId !== raterId) {
      await this.addReputation(authorId, 2, 'gallery_rated', 'gallery', itemId);
    }
  }

  async awardEventParticipated(userId: string, eventId: string): Promise<void> {
    await this.addReputation(userId, 20, 'event_participated', 'event', eventId);
  }

  async awardReferral(referrerId: string, referredId: string): Promise<void> {
    await this.addReputation(referrerId, 100, 'referral', 'user', referredId);
  }

  // Admin functions
  async awardBonus(userId: string, amount: number, reason: string, awardedBy: string): Promise<void> {
    await this.addReputation(userId, amount, 'bonus' as ReputationReason, 'admin', awardedBy);

    if (this.notificationService) {
      await this.notificationService.create({
        recipient_id: userId,
        type: 'reputation_bonus',
        title: 'You received a reputation bonus!',
        body: `${reason} (+${amount} reputation)`,
        source_type: 'admin',
        source_id: awardedBy
      });
    }
  }

  async applyPenalty(userId: string, amount: number, reason: string, appliedBy: string): Promise<void> {
    await this.removeReputation(userId, amount, reason, 'admin', appliedBy);

    if (this.notificationService) {
      await this.notificationService.create({
        recipient_id: userId,
        type: 'reputation_penalty',
        title: 'Reputation penalty applied',
        body: `${reason} (-${amount} reputation)`,
        source_type: 'admin',
        source_id: appliedBy
      });
    }
  }

  // Recalculate user's total reputation
  private async updateUserReputation(userId: string): Promise<void> {
    const total = await this.getUserReputation(userId);

    const sql = `
      UPDATE users
      SET reputation = ?
      WHERE id = ?
    `;
    await this.db.execute(sql, [total, userId]);
  }

  // Check for level up and notify
  private async checkLevelUp(userId: string): Promise<void> {
    const newLevel = await this.getUserCurrentLevel(userId);
    const oldReputation = await this.db.queryOne<{ reputation: number }>(
      'SELECT reputation FROM users WHERE id = ?',
      [userId]
    );

    if (oldReputation) {
      const oldLevel = getReputationLevel(oldReputation.reputation);

      if (newLevel.level > oldLevel.level) {
        // Level up! Send notification
        if (this.notificationService) {
          await this.notificationService.create({
            recipient_id: userId,
            type: 'level_up',
            title: 'You leveled up!',
            body: `You reached ${newLevel.name} level!`,
            source_type: 'user',
            source_id: userId
          });
        }
      }
    }
  }

  // Get leaderboard
  async getLeaderboard(limit: number = 50, period?: 'daily' | 'weekly' | 'monthly' | 'all'): Promise<any[]> {
    let dateCondition = '';
    if (period === 'daily') {
      dateCondition = "AND DATE(r.created_at) = DATE('now')";
    } else if (period === 'weekly') {
      dateCondition = "AND r.created_at >= DATE('now', '-7 days')";
    } else if (period === 'monthly') {
      dateCondition = "AND r.created_at >= DATE('now', '-30 days')";
    }

    const sql = `
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        COALESCE(SUM(r.amount), 0) as reputation_gained
      FROM users u
      LEFT JOIN reputation_events r ON u.id = r.user_id
      ${dateCondition}
      WHERE u.deleted_at IS NULL
      AND u.is_banned = 0
      GROUP BY u.id
      ORDER BY reputation_gained DESC
      LIMIT ?
    `;

    return this.db.query<any>(sql, [limit]);
  }

  // Get top contributors
  async getTopContributors(limit: number = 10): Promise<any[]> {
    const sql = `
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.reputation,
        u.stats_posts_count + u.stats_questions_count + u.stats_answers_count as total_contributions
      FROM users u
      WHERE u.deleted_at IS NULL
      AND u.is_banned = 0
      ORDER BY u.reputation DESC
      LIMIT ?
    `;

    return this.db.query<any>(sql, [limit]);
  }

  // Maintenance
  async expireOldReputation(): Promise<number> {
    return this.eventRepo.expireOldEvents();
  }

  // Statistics
  async getReputationStats(): Promise<{
    totalReputationAwarded: number;
    totalUsers: number;
    averageReputation: number;
    levelDistribution: Record<number, number>;
  }> {
    const sql = `
      SELECT
        SUM(reputation) as total_rep,
        COUNT(*) as total_users,
        AVG(reputation) as avg_rep
      FROM users
      WHERE deleted_at IS NULL AND is_banned = 0
    `;
    const stats = await this.db.queryOne<any>(sql);

    // Get level distribution
    const levels = this.getReputationLevels();
    const levelDistribution: Record<number, number> = {};

    for (const level of levels) {
      const sql = `
        SELECT COUNT(*) as count
        FROM users
        WHERE reputation >= ? ${level.min_reputation > 0 ? 'AND reputation < ' + (levels[level.level]?.min_reputation || 999999) : ''}
      `;
      const result = await this.db.queryOne<{ count: number }>(sql, [level.min_reputation]);
      levelDistribution[level.level] = result.count;
    }

    return {
      totalReputationAwarded: stats.total_rep || 0,
      totalUsers: stats.total_users || 0,
      averageReputation: Math.round(stats.avg_rep || 0),
      levelDistribution
    };
  }
}
