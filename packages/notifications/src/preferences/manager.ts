// @ts-nocheck
/**
 * Notification preferences management
 */

import type {
  NotificationPreferences,
  ChannelPreferences,
  CategoryPreferences,
  SchedulePreferences,
  GroupingPreferences,
  DoNotDisturbPreferences,
  NotificationChannelType,
  NotificationCategory,
  NotificationPriority,
  TimeSchedule,
  DndSchedule,
} from '../types';

export interface PreferencesConfig {
  enableTimezoneSupport?: boolean;
  enableGrouping?: boolean;
  defaultLocale?: string;
  defaultTimezone?: string;
}

/**
 * Preferences manager implementation
 */
export class PreferencesManager {
  private preferences: Map<string, NotificationPreferences> = new Map();
  private config: PreferencesConfig;

  constructor(config: PreferencesConfig = {}) {
    this.config = {
      enableTimezoneSupport: true,
      enableGrouping: true,
      defaultLocale: 'en',
      defaultTimezone: 'UTC',
      ...config,
    };
  }

  /**
   * Get preferences for a user
   */
  getPreferences(userId: string): NotificationPreferences {
    let prefs = this.preferences.get(userId);

    if (!prefs) {
      prefs = this.createDefaultPreferences(userId);
      this.preferences.set(userId, prefs);
    }

    return prefs;
  }

  /**
   * Set preferences for a user
   */
  setPreferences(preferences: NotificationPreferences): void {
    preferences.updatedAt = new Date();
    this.preferences.set(preferences.userId, preferences);
  }

  /**
   * Update preferences for a user
   */
  updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): NotificationPreferences {
    const prefs = this.getPreferences(userId);

    // Merge updates
    const updated: NotificationPreferences = {
      ...prefs,
      ...updates,
      channels: updates.channels ? { ...prefs.channels, ...updates.channels } : prefs.channels,
      categories: updates.categories
        ? { ...prefs.categories, ...updates.categories }
        : prefs.categories,
      schedule: updates.schedule
        ? { ...prefs.schedule, ...updates.schedule }
        : prefs.schedule,
      grouping: updates.grouping
        ? { ...prefs.grouping, ...updates.grouping }
        : prefs.grouping,
      doNotDisturb: updates.doNotDisturb
        ? { ...prefs.doNotDisturb, ...updates.doNotDisturb }
        : prefs.doNotDisturb,
      updatedAt: new Date(),
    };

    this.preferences.set(userId, updated);
    return updated;
  }

  /**
   * Check if a user wants to receive notifications for a category and channel
   */
  shouldNotify(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannelType,
    priority?: NotificationPriority
  ): boolean {
    const prefs = this.getPreferences(userId);

    // Check do-not-disturb first
    if (this.isDoNotDisturbActive(userId)) {
      // Critical notifications override DND
      if (priority === 'critical' && prefs.doNotDisturb.overrideCritical) {
        // Allow critical notifications
      } else if (priority === 'urgent' && prefs.doNotDisturb.overrideUrgent) {
        // Allow urgent notifications
      } else {
        return false;
      }
    }

    // Check category preferences
    const categoryPref = prefs.categories[category];
    if (!categoryPref.enabled) {
      return false;
    }

    // Check if channel is enabled for category
    if (!categoryPref.channels.includes(channel)) {
      return false;
    }

    // Check channel preferences
    const channelPref = prefs.channels[channel as keyof ChannelPreferences];
    if (!channelPref.enabled) {
      return false;
    }

    // Check priority threshold
    if (channelPref.threshold && priority) {
      const priorityLevels: NotificationPriority[] = ['critical', 'urgent', 'high', 'normal', 'low'];
      const thresholdIndex = priorityLevels.indexOf(channelPref.threshold);
      const priorityIndex = priorityLevels.indexOf(priority);

      if (priorityIndex < thresholdIndex) {
        return false;
      }
    }

    // Check time-based schedules
    if (prefs.schedule.enabled) {
      if (!this.isWithinSchedule(userId, channel, category)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if do-not-disturb is active for a user
   */
  isDoNotDisturbActive(userId: string): boolean {
    const prefs = this.getPreferences(userId);

    if (!prefs.doNotDisturb.enabled) {
      return false;
    }

    const now = new Date();

    for (const schedule of prefs.doNotDisturb.schedules) {
      if (this.isWithinDndSchedule(schedule, now, prefs.timezone)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if current time is within DND schedule
   */
  private isWithinDndSchedule(
    schedule: DndSchedule,
    now: Date,
    timezone: string
  ): boolean {
    // Convert to user's timezone if enabled
    const userTime = this.config.enableTimezoneSupport
      ? this.convertToTimeZone(now, timezone)
      : now;

    // Check day of week
    if (!schedule.daysOfWeek.includes(userTime.getDay())) {
      return false;
    }

    // Check time range
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

    const currentMinutes = userTime.getHours() * 60 + userTime.getMinutes();
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  /**
   * Check if current time is within notification schedule
   */
  private isWithinSchedule(
    userId: string,
    channel: NotificationChannelType,
    category: NotificationCategory
  ): boolean {
    const prefs = this.getPreferences(userId);

    // If no schedules defined, allow all
    if (prefs.schedule.schedules.length === 0) {
      return true;
    }

    const now = new Date();
    const userTime = this.config.enableTimezoneSupport
      ? this.convertToTimeZone(now, prefs.timezone)
      : now;

    for (const schedule of prefs.schedule.schedules) {
      // Check if channel is included
      if (!schedule.channels.includes(channel)) {
        continue;
      }

      // Check if category is included
      if (!schedule.categories.includes(category)) {
        continue;
      }

      // Check day of week
      if (!schedule.daysOfWeek.includes(userTime.getDay())) {
        continue;
      }

      // Check time range
      const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
      const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

      const currentMinutes = userTime.getHours() * 60 + userTime.getMinutes();
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return true;
      }
    }

    return false;
  }

  /**
   * Convert date to timezone
   */
  private convertToTimeZone(date: Date, timezone: string): Date {
    // In a real implementation, this would use a timezone library
    // For now, return the date as-is
    return new Date(date);
  }

  /**
   * Create default preferences for a user
   */
  private createDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      channels: this.createDefaultChannelPreferences(),
      categories: this.createDefaultCategoryPreferences(),
      schedule: this.createDefaultSchedulePreferences(),
      grouping: this.createDefaultGroupingPreferences(),
      doNotDisturb: this.createDefaultDndPreferences(),
      locale: this.config.defaultLocale!,
      timezone: this.config.defaultTimezone!,
      updatedAt: new Date(),
    };
  }

  /**
   * Create default channel preferences
   */
  private createDefaultChannelPreferences(): ChannelPreferences {
    return {
      email: { enabled: true },
      sms: { enabled: false },
      push: { enabled: true },
      slack: { enabled: false },
      discord: { enabled: false },
      webhook: { enabled: false },
      in_app: { enabled: true },
    };
  }

  /**
   * Create default category preferences
   */
  private createDefaultCategoryPreferences(): CategoryPreferences {
    const allChannels: NotificationChannelType[] = ['in_app', 'email', 'push'];

    return {
      system: {
        enabled: true,
        channels: allChannels,
        priority: 'normal',
      },
      security: {
        enabled: true,
        channels: ['in_app', 'email', 'sms', 'push'],
        priority: 'high',
      },
      billing: {
        enabled: true,
        channels: ['in_app', 'email'],
        priority: 'normal',
      },
      deployment: {
        enabled: true,
        channels: ['in_app', 'email', 'slack'],
        priority: 'normal',
      },
      performance: {
        enabled: true,
        channels: ['in_app'],
        priority: 'low',
      },
      alert: {
        enabled: true,
        channels: ['in_app', 'email', 'sms', 'push'],
        priority: 'high',
      },
      social: {
        enabled: true,
        channels: ['in_app'],
        priority: 'low',
      },
      marketing: {
        enabled: false,
        channels: ['in_app', 'email'],
        priority: 'low',
      },
      workflow: {
        enabled: true,
        channels: ['in_app', 'email'],
        priority: 'normal',
      },
    };
  }

  /**
   * Create default schedule preferences
   */
  private createDefaultSchedulePreferences(): SchedulePreferences {
    return {
      enabled: false,
      schedules: [],
    };
  }

  /**
   * Create default grouping preferences
   */
  private createDefaultGroupingPreferences(): GroupingPreferences {
    return {
      enabled: true,
      windowMinutes: 5,
      maxGroupSize: 10,
      channels: ['email'],
    };
  }

  /**
   * Create default DND preferences
   */
  private createDefaultDndPreferences(): DoNotDisturbPreferences {
    return {
      enabled: false,
      schedules: [],
      overrideUrgent: true,
      overrideCritical: true,
    };
  }

  /**
   * Add a time schedule
   */
  addSchedule(userId: string, schedule: TimeSchedule): void {
    const prefs = this.getPreferences(userId);
    prefs.schedule.schedules.push(schedule);
    prefs.schedule.enabled = true;
    this.preferences.set(userId, prefs);
  }

  /**
   * Remove a time schedule
   */
  removeSchedule(userId: string, scheduleId: string): boolean {
    const prefs = this.getPreferences(userId);
    const index = prefs.schedule.schedules.findIndex((s) => s.id === scheduleId);

    if (index === -1) {
      return false;
    }

    prefs.schedule.schedules.splice(index, 1);
    this.preferences.set(userId, prefs);
    return true;
  }

  /**
   * Add a DND schedule
   */
  addDndSchedule(userId: string, schedule: DndSchedule): void {
    const prefs = this.getPreferences(userId);
    prefs.doNotDisturb.schedules.push(schedule);
    prefs.doNotDisturb.enabled = true;
    this.preferences.set(userId, prefs);
  }

  /**
   * Remove a DND schedule
   */
  removeDndSchedule(userId: string, scheduleId: string): boolean {
    const prefs = this.getPreferences(userId);
    const index = prefs.doNotDisturb.schedules.findIndex((s) => s.id === scheduleId);

    if (index === -1) {
      return false;
    }

    prefs.doNotDisturb.schedules.splice(index, 1);
    this.preferences.set(userId, prefs);
    return true;
  }

  /**
   * Enable a channel for a user
   */
  enableChannel(userId: string, channel: NotificationChannelType): void {
    const prefs = this.getPreferences(userId);
    (prefs.channels[channel as keyof ChannelPreferences] as ChannelPreference).enabled = true;
    this.preferences.set(userId, prefs);
  }

  /**
   * Disable a channel for a user
   */
  disableChannel(userId: string, channel: NotificationChannelType): void {
    const prefs = this.getPreferences(userId);
    (prefs.channels[channel as keyof ChannelPreferences] as ChannelPreference).enabled = false;
    this.preferences.set(userId, prefs);
  }

  /**
   * Enable a category for a user
   */
  enableCategory(userId: string, category: NotificationCategory): void {
    const prefs = this.getPreferences(userId);
    prefs.categories[category as keyof CategoryPreferences].enabled = true;
    this.preferences.set(userId, prefs);
  }

  /**
   * Disable a category for a user
   */
  disableCategory(userId: string, category: NotificationCategory): void {
    const prefs = this.getPreferences(userId);
    prefs.categories[category as keyof CategoryPreferences].enabled = false;
    this.preferences.set(userId, prefs);
  }

  /**
   * Delete preferences for a user
   */
  deletePreferences(userId: string): boolean {
    return this.preferences.delete(userId);
  }

  /**
   * Get all user IDs with preferences
   */
  getUserIds(): string[] {
    return Array.from(this.preferences.keys());
  }

  /**
   * Clear all preferences
   */
  clear(): void {
    this.preferences.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalUsers: number;
    usersWithDnd: number;
    usersWithSchedules: number;
    enabledChannels: Map<NotificationChannelType, number>;
    enabledCategories: Map<NotificationCategory, number>;
  } {
    let usersWithDnd = 0;
    let usersWithSchedules = 0;
    const enabledChannels = new Map<NotificationChannelType, number>();
    const enabledCategories = new Map<NotificationCategory, number>();

    for (const prefs of this.preferences.values()) {
      if (prefs.doNotDisturb.enabled) {
        usersWithDnd++;
      }

      if (prefs.schedule.enabled && prefs.schedule.schedules.length > 0) {
        usersWithSchedules++;
      }

      // Count enabled channels
      for (const [channel, pref] of Object.entries(prefs.channels)) {
        if (pref.enabled) {
          enabledChannels.set(
            channel as NotificationChannelType,
            (enabledChannels.get(channel as NotificationChannelType) || 0) + 1
          );
        }
      }

      // Count enabled categories
      for (const [category, pref] of Object.entries(prefs.categories)) {
        if (pref.enabled) {
          enabledCategories.set(
            category as NotificationCategory,
            (enabledCategories.get(category as NotificationCategory) || 0) + 1
          );
        }
      }
    }

    return {
      totalUsers: this.preferences.size,
      usersWithDnd,
      usersWithSchedules,
      enabledChannels,
      enabledCategories,
    };
  }
}

interface ChannelPreference {
  enabled: boolean;
  priority?: NotificationPriority;
  threshold?: NotificationPriority;
}

interface CategoryPreference {
  enabled: boolean;
  channels: NotificationChannelType[];
  priority?: NotificationPriority;
  quietHours?: boolean;
}
