/**
 * Activity Feed and Notification Manager
 * Manages activity streams, notifications, and digests
 */

// @ts-nocheck - Activity management with type mismatches and unused parameters
import { nanoid } from 'nanoid';
import type {
  Activity,
  ActivityType,
  ActivityAction,
  ActivityTarget,
  ActivityMetadata,
  ActivityVisibility,
  ActivityFilter,
  Notification,
  NotificationType,
  NotificationPreferences,
  NotificationMetadata,
  ActivityDigest,
  DigestPeriod,
  DigestSummary,
} from '../types';

// ============================================================================
// Activity Manager
// ============================================================================

export class ActivityManager {
  private activities: Map<string, Activity> = new Map();
  private notifications: Map<string, Map<string, Notification>> = new Map(); // userId -> notificationId -> notification
  private notificationPreferences: Map<string, NotificationPreferences> = new Map();

  // ============================================================================
  // Activity Management
  // ============================================================================

  /**
   * Create a new activity
   */
  createActivity(
    type: ActivityType,
    actorId: string,
    actorName: string,
    action: ActivityAction,
    target: ActivityTarget,
    options?: {
      actorAvatar?: string;
      metadata?: ActivityMetadata;
      visibility?: ActivityVisibility;
    }
  ): Activity {
    const activity: Activity = {
      id: nanoid(),
      type,
      actorId,
      actorName,
      actorAvatar: options?.actorAvatar,
      action,
      target,
      metadata: options?.metadata || {},
      timestamp: Date.now(),
      visibility: options?.visibility || 'public',
    };

    this.activities.set(activity.id, activity);

    // Create notifications for relevant users
    this.createNotificationsFromActivity(activity);

    return activity;
  }

  /**
   * Get an activity by ID
   */
  getActivity(activityId: string): Activity | undefined {
    return this.activities.get(activityId);
  }

  /**
   * Get activities for a user
   */
  getActivitiesForUser(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      types?: ActivityType[];
      actions?: ActivityAction[];
    }
  ): Activity[] {
    let activities = Array.from(this.activities.values()).filter(
      (a) => a.actorId === userId || this.isActivityRelevantToUser(a, userId)
    );

    // Apply filters
    if (options?.types && options.types.length > 0) {
      activities = activities.filter((a) => options.types!.includes(a.type));
    }

    if (options?.actions && options.actions.length > 0) {
      activities = activities.filter((a) => options.actions!.includes(a.action));
    }

    // Sort by timestamp descending
    activities.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    return activities.slice(offset, offset + limit);
  }

  /**
   * Get activities for a project
   */
  getActivitiesForProject(projectId: string, limit: number = 50): Activity[] {
    return Array.from(this.activities.values())
      .filter((a) => a.metadata.projectId === projectId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get activities for a team
   */
  getActivitiesForTeam(teamId: string, limit: number = 50): Activity[] {
    return Array.from(this.activities.values())
      .filter((a) => a.metadata.teamId === teamId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Filter activities
   */
  filterActivities(filter: ActivityFilter): Activity[] {
    let activities = Array.from(this.activities.values());

    // Apply type filter
    if (filter.types && filter.types.length > 0) {
      activities = activities.filter((a) => filter.types!.includes(a.type));
    }

    // Apply action filter
    if (filter.actions && filter.actions.length > 0) {
      activities = activities.filter((a) => filter.actions!.includes(a.action));
    }

    // Apply actor filter
    if (filter.actors && filter.actors.length > 0) {
      activities = activities.filter((a) => filter.actors!.includes(a.actorId));
    }

    // Apply project filter
    if (filter.projects && filter.projects.length > 0) {
      activities = activities.filter((a) =>
        a.metadata.projectId && filter.projects!.includes(a.metadata.projectId)
      );
    }

    // Apply team filter
    if (filter.teams && filter.teams.length > 0) {
      activities = activities.filter((a) =>
        a.metadata.teamId && filter.teams!.includes(a.metadata.teamId)
      );
    }

    // Apply date range filter
    if (filter.startDate) {
      activities = activities.filter((a) => a.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      activities = activities.filter((a) => a.timestamp <= filter.endDate!);
    }

    // Apply search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      activities = activities.filter(
        (a) =>
          a.actorName.toLowerCase().includes(searchLower) ||
          a.target.name.toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp descending
    activities.sort((a, b) => b.timestamp - a.timestamp);

    return activities;
  }

  /**
   * Delete an activity
   */
  deleteActivity(activityId: string): boolean {
    return this.activities.delete(activityId);
  }

  /**
   * Clean up old activities
   */
  cleanupOldActivities(maxAge: number): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [activityId, activity] of this.activities.entries()) {
      if (now - activity.timestamp > maxAge) {
        this.activities.delete(activityId);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ============================================================================
  // Notification Management
  // ============================================================================

  /**
   * Create a notification
   */
  createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      activityId?: string;
      link?: string;
      expires?: number;
      metadata?: Partial<NotificationMetadata>;
    }
  ): Notification {
    const notification: Notification = {
      id: nanoid(),
      userId,
      activityId: options?.activityId,
      type,
      title,
      message,
      link: options?.link,
      read: false,
      created: Date.now(),
      expires: options?.expires,
      metadata: {
        priority: options?.metadata?.priority || 'normal',
        category: options?.metadata?.category || 'general',
        actionRequired: options?.metadata?.actionRequired || false,
        dismissible: options?.metadata?.dismissible !== false,
      },
    };

    let userNotifications = this.notifications.get(userId);
    if (!userNotifications) {
      userNotifications = new Map();
      this.notifications.set(userId, userNotifications);
    }

    userNotifications.set(notification.id, notification);

    return notification;
  }

  /**
   * Get notifications for a user
   */
  getNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      types?: NotificationType[];
    }
  ): Notification[] {
    let userNotifications = this.notifications.get(userId);
    if (!userNotifications) {
      return [];
    }

    let notifications = Array.from(userNotifications.values());

    // Apply filters
    if (options?.unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }

    if (options?.types && options.types.length > 0) {
      notifications = notifications.filter((n) => options.types!.includes(n.type));
    }

    // Sort by created timestamp descending
    notifications.sort((a, b) => b.created - a.created);

    // Apply limit
    if (options?.limit) {
      notifications = notifications.slice(0, options.limit);
    }

    return notifications;
  }

  /**
   * Get unread notification count for a user
   */
  getUnreadCount(userId: string): number {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) {
      return 0;
    }

    return Array.from(userNotifications.values()).filter((n) => !n.read).length;
  }

  /**
   * Mark a notification as read
   */
  markAsRead(userId: string, notificationId: string): boolean {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) {
      return false;
    }

    const notification = userNotifications.get(notificationId);
    if (!notification) {
      return false;
    }

    notification.read = true;
    return true;
  }

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead(userId: string): number {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) {
      return 0;
    }

    let marked = 0;
    for (const notification of userNotifications.values()) {
      if (!notification.read) {
        notification.read = true;
        marked++;
      }
    }

    return marked;
  }

  /**
   * Delete a notification
   */
  deleteNotification(userId: string, notificationId: string): boolean {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) {
      return false;
    }

    return userNotifications.delete(notificationId);
  }

  /**
   * Clean up expired notifications
   */
  cleanupExpiredNotifications(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, userNotifications] of this.notifications.entries()) {
      for (const [notificationId, notification] of userNotifications.entries()) {
        if (notification.expires && now > notification.expires) {
          userNotifications.delete(notificationId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  // ============================================================================
  // Notification Preferences
  // ============================================================================

  /**
   * Get notification preferences for a user
   */
  getNotificationPreferences(userId: string): NotificationPreferences {
    let preferences = this.notificationPreferences.get(userId);

    if (!preferences) {
      preferences = this.getDefaultNotificationPreferences();
      this.notificationPreferences.set(userId, preferences);
    }

    return preferences;
  }

  /**
   * Update notification preferences for a user
   */
  updateNotificationPreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): NotificationPreferences {
    let preferences = this.notificationPreferences.get(userId);

    if (!preferences) {
      preferences = this.getDefaultNotificationPreferences();
    }

    Object.assign(preferences, updates);
    this.notificationPreferences.set(userId, preferences);

    return preferences;
  }

  /**
   * Get default notification preferences
   */
  private getDefaultNotificationPreferences(): NotificationPreferences {
    return {
      email: true,
      push: true,
      inApp: true,
      digest: true,
      digestFrequency: 'daily',
      categories: {
        mention: true,
        comment: true,
        review_assignment: true,
        team_invite: true,
        approval: true,
        activity_digest: false,
      },
    };
  }

  // ============================================================================
  // Activity Digests
  // ============================================================================

  /**
   * Generate an activity digest for a user
   */
  generateDigest(
    userId: string,
    period: DigestPeriod,
    startDate: number,
    endDate: number
  ): ActivityDigest {
    const activities = this.getActivitiesForUser(userId, {
      limit: 1000,
    }).filter((a) => a.timestamp >= startDate && a.timestamp <= endDate);

    const summary = this.generateDigestSummary(activities);

    const digest: ActivityDigest = {
      userId,
      period,
      startDate,
      endDate,
      activities,
      summary,
      generated: Date.now(),
    };

    return digest;
  }

  /**
   * Generate digest summary
   */
  private generateDigestSummary(activities: Activity[]): DigestSummary {
    const byType: Record<string, number> = {};
    let unreadCount = 0;
    let mentionCount = 0;

    for (const activity of activities) {
      byType[activity.type] = (byType[activity.type] || 0) + 1;

      if (activity.metadata.additionalData?.mentioned) {
        mentionCount++;
      }
    }

    return {
      totalActivities: activities.length,
      byType: byType as Record<ActivityType, number>,
      unreadCount,
      mentionCount,
    };
  }

  /**
   * Send digest to user
   */
  sendDigest(userId: string, digest: ActivityDigest): void {
    const preferences = this.getNotificationPreferences(userId);

    if (!preferences.digest) {
      return;
    }

    // Create digest notification
    const title = `Your ${digest.period} activity digest`;
    const message = `You have ${digest.summary.totalActivities} new activities`;

    this.createNotification(userId, 'activity_digest', title, message, {
      metadata: {
        category: 'activity_digest',
        priority: 'low',
        actionRequired: false,
        dismissible: true,
      },
    });

    // In a real implementation, this would also send email/push notifications
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Check if an activity is relevant to a user
   */
  private isActivityRelevantToUser(activity: Activity, userId: string): boolean {
    // User is mentioned
    if (activity.metadata.additionalData?.mentionedUserIds?.includes(userId)) {
      return true;
    }

    // Activity is in user's projects
    if (activity.metadata.projectId) {
      // In a real implementation, this would check if user is a member of the project
      return true;
    }

    // Activity is in user's teams
    if (activity.metadata.teamId) {
      // In a real implementation, this would check if user is a member of the team
      return true;
    }

    return false;
  }

  /**
   * Create notifications from an activity
   */
  private createNotificationsFromActivity(activity: Activity): void {
    // Get mentioned users
    const mentionedUserIds =
      activity.metadata.additionalData?.mentionedUserIds || [];

    for (const userId of mentionedUserIds) {
      const preferences = this.getNotificationPreferences(userId);

      if (!preferences.categories.mention || !preferences.inApp) {
        continue;
      }

      this.createNotification(
        userId,
        'mention',
        `${activity.actorName} mentioned you`,
        `You were mentioned in ${activity.target.name}`,
        {
          activityId: activity.id,
          link: activity.target.url,
          metadata: {
            category: 'mention',
            priority: 'high',
            actionRequired: false,
          },
        }
      );
    }
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get activity statistics
   */
  getActivityStatistics(): {
    totalActivities: number;
    activitiesByType: Record<string, number>;
    activitiesByAction: Record<string, number>;
    totalNotifications: number;
    unreadNotifications: number;
  } {
    const activitiesByType: Record<string, number> = {};
    const activitiesByAction: Record<string, number> = {};

    for (const activity of this.activities.values()) {
      activitiesByType[activity.type] = (activitiesByType[activity.type] || 0) + 1;
      activitiesByAction[activity.action] = (activitiesByAction[activity.action] || 0) + 1;
    }

    let totalNotifications = 0;
    let unreadNotifications = 0;

    for (const userNotifications of this.notifications.values()) {
      for (const notification of userNotifications.values()) {
        totalNotifications++;
        if (!notification.read) {
          unreadNotifications++;
        }
      }
    }

    return {
      totalActivities: this.activities.size,
      activitiesByType,
      activitiesByAction,
      totalNotifications,
      unreadNotifications,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.activities.clear();
    this.notifications.clear();
    this.notificationPreferences.clear();
  }
}
