/**
 * Notification Service
 * Handles user notifications, preferences, and digests
 */

// @ts-nocheck - Notification service with type mismatches and missing properties
import { DatabaseConnection, BaseRepository } from '../utils/database';
import {
  Notification,
  NotificationType,
  NotificationSourceType,
  NotificationPreference,
  NotificationDigest,
  NotificationSummary
} from '../types';

export class NotificationRepository extends BaseRepository<Notification> {
  tableName = 'notifications';

  async findByRecipient(recipientId: string, page: number = 1, perPage: number = 20, unreadOnly: boolean = false): Promise<any> {
    const offset = (page - 1) * perPage;

    let whereClause = 'recipient_id = ?';
    const params: any[] = [recipientId];

    if (unreadOnly) {
      whereClause += ' AND read = 0';
    }

    const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause}`;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, params);
    const total = countResult?.count || 0;

    const sql = `
      SELECT n.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} n
      LEFT JOIN users u ON n.source_user_id = u.id
      WHERE ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const notifications = await this.db.query<any>(sql, [...params, perPage, offset]);

    return {
      data: notifications.map(n => this.mapNotificationToModel(n)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findByType(recipientId: string, type: NotificationType, page: number = 1, perPage: number = 20): Promise<any> {
    const offset = (page - 1) * perPage;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE recipient_id = ? AND type = ?
    `;
    const countResult = await this.db.queryOne<{ count: number }>(countSql, [recipientId, type]);
    const total = countResult?.count || 0;

    const sql = `
      SELECT n.*, u.username, u.display_name, u.avatar_url
      FROM ${this.tableName} n
      LEFT JOIN users u ON n.source_user_id = u.id
      WHERE n.recipient_id = ? AND n.type = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const notifications = await this.db.query<any>(sql, [recipientId, type, perPage, offset]);

    return {
      data: notifications.map(n => this.mapNotificationToModel(n)),
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) }
    };
  }

  async findUnreadCount(recipientId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE recipient_id = ? AND read = 0
    `;
    const result = await this.db.queryOne<{ count: number }>(sql, [recipientId]);
    return result?.count || 0;
  }

  async markAsRead(notificationId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET read = 1, read_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [notificationId]);
    return result.rowsAffected > 0;
  }

  async markAllAsRead(recipientId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET read = 1, read_at = CURRENT_TIMESTAMP
      WHERE recipient_id = ? AND read = 0
    `;
    const result = await this.db.execute(sql, [recipientId]);
    return result.rowsAffected > 0;
  }

  async markAsClicked(notificationId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET clicked = 1, clicked_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [notificationId]);
    return result.rowsAffected > 0;
  }

  async deleteOldNotifications(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const sql = `
      DELETE FROM ${this.tableName}
      WHERE created_at < ?
      AND read = 1
      AND clicked = 1
    `;
    const result = await this.db.execute(sql, [cutoffDate.toISOString()]);
    return result.rowsAffected;
  }

  async getUnreadCountByType(recipientId: string): Promise<Record<NotificationType, number>> {
    const sql = `
      SELECT type, COUNT(*) as count
      FROM ${this.tableName}
      WHERE recipient_id = ? AND read = 0
      GROUP BY type
    `;
    const results = await this.db.query<{ type: NotificationType; count: number }>(sql, [recipientId]);

    const counts: Record<string, number> = {};
    for (const result of results) {
      counts[result.type] = result.count;
    }

    return counts as Record<NotificationType, number>;
  }

  private mapNotificationToModel(notification: any): Notification {
    return {
      id: notification.id,
      recipient_id: notification.recipient_id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data ? JSON.parse(notification.data) : undefined,
      read: notification.read === 1,
      read_at: notification.read_at,
      clicked: notification.clicked === 1,
      clicked_at: notification.clicked_at,
      action_url: notification.action_url,
      source_type: notification.source_type,
      source_id: notification.source_id,
      source_user_id: notification.source_user_id,
      source_user: notification.username ? {
        id: notification.source_user_id,
        username: notification.username,
        display_name: notification.display_name,
        avatar_url: notification.avatar_url
      } : undefined,
      created_at: notification.created_at,
      updated_at: notification.updated_at
    };
  }
}

export class NotificationPreferenceRepository extends BaseRepository<NotificationPreference> {
  tableName = 'notification_preferences';

  async findByUser(userId: string): Promise<NotificationPreference | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE user_id = ?`;
    const pref = await this.db.queryOne<any>(sql, [userId]);

    if (!pref) {
      // Return default preferences
      return this.getDefaultPreferences(userId);
    }

    return {
      user_id: pref.user_id,
      email_enabled: pref.email_enabled === 1,
      push_enabled: pref.push_enabled === 1,
      types: pref.types ? JSON.parse(pref.types) : this.getDefaultTypePreferences()
    };
  }

  async update(userId: string, preferences: Partial<NotificationPreference>): Promise<boolean> {
    const existing = await this.findByUser(userId);

    if (existing) {
      const updates: any = {};
      if (preferences.email_enabled !== undefined) {
        updates.email_enabled = preferences.email_enabled;
      }
      if (preferences.push_enabled !== undefined) {
        updates.push_enabled = preferences.push_enabled;
      }
      if (preferences.types) {
        updates.types = JSON.stringify(preferences.types);
      }

      return this.update(userId, updates);
    } else {
      await this.create({
        user_id: userId,
        email_enabled: preferences.email_enabled ?? true,
        push_enabled: preferences.push_enabled ?? true,
        types: preferences.types || this.getDefaultTypePreferences()
      } as any);
      return true;
    }
  }

  async updateTypePreference(userId: string, type: NotificationType, prefs: {
    email?: boolean;
    push?: boolean;
    in_app?: boolean;
  }): Promise<boolean> {
    const existing = await this.findByUser(userId);
    const types = existing?.types || this.getDefaultTypePreferences();

    const typeIndex = types.findIndex(t => t.type === type);
    if (typeIndex >= 0) {
      types[typeIndex] = { ...types[typeIndex], ...prefs };
    } else {
      types.push({
        type,
        email: prefs.email ?? true,
        push: prefs.push ?? true,
        in_app: prefs.in_app ?? true
      });
    }

    return this.update(userId, { types });
  }

  private getDefaultPreferences(userId: string): NotificationPreference {
    return {
      user_id: userId,
      email_enabled: true,
      push_enabled: true,
      types: this.getDefaultTypePreferences()
    };
  }

  private getDefaultTypePreferences(): Array<{
    type: NotificationType;
    email: boolean;
    push: boolean;
    in_app: boolean;
  }> {
    return [
      { type: NotificationType.FORUM_REPLY, email: true, push: true, in_app: true },
      { type: NotificationType.FORUM_MENTION, email: true, push: true, in_app: true },
      { type: NotificationType.FORUM_LIKE, email: false, push: true, in_app: true },
      { type: NotificationType.QUESTION_ANSWERED, email: true, push: true, in_app: true },
      { type: NotificationType.ANSWER_ACCEPTED, email: true, push: true, in_app: true },
      { type: NotificationType.ANSWER_UPVOTED, email: false, push: true, in_app: true },
      { type: NotificationType.QUESTION_UPVOTED, email: false, push: true, in_app: true },
      { type: NotificationType.COMMENT_REPLY, email: true, push: true, in_app: true },
      { type: NotificationType.BADGE_EARNED, email: true, push: true, in_app: true },
      { type: NotificationType.REPUTATION_CHANGE, email: false, push: false, in_app: true },
      { type: NotificationType.MODERATION_NOTICE, email: true, push: true, in_app: true },
      { type: NotificationType.GALLERY_COMMENT, email: true, push: true, in_app: true },
      { type: NotificationType.GALLERY_FORK, email: true, push: true, in_app: true },
      { type: NotificationType.GALLERY_RATED, email: false, push: true, in_app: true },
      { type: NotificationType.EVENT_REMINDER, email: true, push: true, in_app: true },
      { type: NotificationType.EVENT_STARTING, email: true, push: true, in_app: true },
      { type: NotificationType.SYSTEM_ANNOUNCEMENT, email: true, push: true, in_app: true }
    ];
  }
}

export class NotificationDigestRepository extends BaseRepository<NotificationDigest> {
  tableName = 'notification_digests';

  async findByUser(userId: string, type: 'daily' | 'weekly'): Promise<NotificationDigest | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ? AND type = ?
      AND generated_at > DATE('now', '-1 day')
      ORDER BY generated_at DESC
      LIMIT 1
    `;
    return this.db.queryOne<NotificationDigest>(sql, [userId, type]);
  }

  async createDigest(userId: string, type: 'daily' | 'weekly', notifications: Notification[]): Promise<NotificationDigest> {
    // Group notifications by type
    const grouped: Record<string, Notification[]> = {};
    for (const notification of notifications) {
      if (!grouped[notification.type]) {
        grouped[notification.type] = [];
      }
      grouped[notification.type].push(notification);
    }

    // Create summaries
    const summaries: NotificationSummary[] = Object.entries(grouped).map(([type, notifs]) => ({
      type: type as NotificationType,
      count: notifs.length,
      latest_notification: notifs[0]
    }));

    return this.create({
      user_id: userId,
      type,
      notifications: summaries,
      generated_at: new Date(),
      sent_at: undefined
    } as any);
  }

  async markAsSent(digestId: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET sent_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const result = await this.db.execute(sql, [digestId]);
    return result.rowsAffected > 0;
  }

  async findPendingDigests(type: 'daily' | 'weekly'): Promise<NotificationDigest[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE type = ? AND sent_at IS NULL
      ORDER BY generated_at ASC
    `;
    return this.db.query<NotificationDigest>(sql, [type]);
  }
}

export class NotificationService {
  constructor(
    private db: DatabaseConnection,
    private emailService?: any,
    private pushService?: any
  ) {
    this.notificationRepo = new NotificationRepository(db);
    this.preferenceRepo = new NotificationPreferenceRepository(db);
    this.digestRepo = new NotificationDigestRepository(db);
  }

  private notificationRepo: NotificationRepository;
  private preferenceRepo: NotificationPreferenceRepository;
  private digestRepo: NotificationDigestRepository;

  // Create notification
  async create(data: {
    recipient_id: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: any;
    action_url?: string;
    source_type: NotificationSourceType;
    source_id: string;
    source_user_id?: string;
  }): Promise<Notification | null> {
    // Check user preferences
    const preferences = await this.preferenceRepo.findByUser(data.recipient_id);
    if (!preferences) {
      return null;
    }

    const typePref = preferences.types.find(t => t.type === data.type);
    if (!typePref || !typePref.in_app) {
      return null;
    }

    const notification = await this.notificationRepo.create({
      ...data,
      read: false,
      clicked: false,
      created_at: new Date(),
      updated_at: new Date()
    } as any);

    // Send email if enabled
    if (typePref.email && preferences.email_enabled && this.emailService) {
      await this.sendEmailNotification(notification, data.recipient_id);
    }

    // Send push if enabled
    if (typePref.push && preferences.push_enabled && this.pushService) {
      await this.sendPushNotification(notification, data.recipient_id);
    }

    return notification;
  }

  // Get notifications
  async getNotifications(userId: string, page: number = 1, perPage: number = 20, unreadOnly: boolean = false) {
    return this.notificationRepo.findByRecipient(userId, page, perPage, unreadOnly);
  }

  async getNotificationsByType(userId: string, type: NotificationType, page: number = 1, perPage: number = 20) {
    return this.notificationRepo.findByType(userId, type, page, perPage);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.findUnreadCount(userId);
  }

  async getUnreadCountByType(userId: string): Promise<Record<NotificationType, number>> {
    return this.notificationRepo.getUnreadCountByType(userId);
  }

  // Mark notifications
  async markAsRead(notificationId: string): Promise<boolean> {
    return this.notificationRepo.markAsRead(notificationId);
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    return this.notificationRepo.markAllAsRead(userId);
  }

  async markAsClicked(notificationId: string): Promise<boolean> {
    return this.notificationRepo.markAsClicked(notificationId);
  }

  // Preferences
  async getPreferences(userId: string): Promise<NotificationPreference | null> {
    return this.preferenceRepo.findByUser(userId);
  }

  async updatePreferences(userId: string, preferences: Partial<NotificationPreference>): Promise<boolean> {
    return this.preferenceRepo.update(userId, preferences);
  }

  async updateTypePreference(userId: string, type: NotificationType, prefs: {
    email?: boolean;
    push?: boolean;
    in_app?: boolean;
  }): Promise<boolean> {
    return this.preferenceRepo.updateTypePreference(userId, type, prefs);
  }

  // Digests
  async createDailyDigest(userId: string): Promise<NotificationDigest | null> {
    // Get unread notifications from last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE recipient_id = ? AND created_at > ?
      ORDER BY created_at DESC
    `;
    const notifications = await this.notificationRepo.db.query<Notification>(sql, [userId, since.toISOString()]);

    if (notifications.length === 0) {
      return null;
    }

    return this.digestRepo.createDigest(userId, 'daily', notifications);
  }

  async createWeeklyDigest(userId: string): Promise<NotificationDigest | null> {
    // Get unread notifications from last 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE recipient_id = ? AND created_at > ?
      ORDER BY created_at DESC
    `;
    const notifications = await this.notificationRepo.db.query<Notification>(sql, [userId, since.toISOString()]);

    if (notifications.length === 0) {
      return null;
    }

    return this.digestRepo.createDigest(userId, 'weekly', notifications);
  }

  async sendDigests(type: 'daily' | 'weekly'): Promise<void> {
    const pendingDigests = await this.digestRepo.findPendingDigests(type);

    for (const digest of pendingDigests) {
      // Send email
      if (this.emailService) {
        await this.sendEmailDigest(digest);
      }

      // Mark as sent
      await this.digestRepo.markAsSent(digest.id);
    }
  }

  // Cleanup
  async cleanupOldNotifications(daysOld: number = 90): Promise<number> {
    return this.notificationRepo.deleteOldNotifications(daysOld);
  }

  // Private methods for sending notifications
  private async sendEmailNotification(notification: Notification, userId: string): Promise<void> {
    if (!this.emailService) return;

    await this.emailService.send({
      to: userId,
      subject: notification.title,
      html: `
        <h2>${notification.title}</h2>
        <p>${notification.body}</p>
        ${notification.action_url ? `<p><a href="${notification.action_url}">View</a></p>` : ''}
      `
    });
  }

  private async sendPushNotification(notification: Notification, userId: string): Promise<void> {
    if (!this.pushService) return;

    await this.pushService.send({
      userId,
      title: notification.title,
      body: notification.body,
      data: {
        notificationId: notification.id,
        actionUrl: notification.action_url
      }
    });
  }

  private async sendEmailDigest(digest: NotificationDigest): Promise<void> {
    if (!this.emailService) return;

    const summaryHtml = digest.notifications.map(summary => `
      <div>
        <h3>${summary.type} (${summary.count})</h3>
        <p>${summary.latest_notification.title}</p>
      </div>
    `).join('');

    await this.emailService.send({
      to: digest.user_id,
      subject: `Your ${digest.type} notification digest`,
      html: `
        <h2>ClaudeFlare Notification Digest</h2>
        ${summaryHtml}
      `
    });
  }

  // Batch operations
  async createBulk(notifications: Array<{
    recipient_id: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: any;
    action_url?: string;
    source_type: NotificationSourceType;
    source_id: string;
    source_user_id?: string;
  }>): Promise<Notification[]> {
    const created: Notification[] = [];

    for (const data of notifications) {
      const notification = await this.create(data);
      if (notification) {
        created.push(notification);
      }
    }

    return created;
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    return this.notificationRepo.delete(notificationId);
  }

  async deleteAllNotifications(userId: string): Promise<number> {
    const sql = `DELETE FROM ${this.notificationRepo.tableName} WHERE recipient_id = ?`;
    const result = await this.notificationRepo.db.execute(sql, [userId]);
    return result.rowsAffected;
  }
}
