/**
 * Tests for preferences manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PreferencesManager } from '../preferences/manager';
import type { NotificationChannelType, NotificationCategory, NotificationPriority } from '../types';

describe('Preferences Manager', () => {
  let manager: PreferencesManager;

  beforeEach(() => {
    manager = new PreferencesManager({
      enableTimezoneSupport: true,
      enableGrouping: true,
      defaultLocale: 'en',
      defaultTimezone: 'UTC',
    });
  });

  describe('getPreferences', () => {
    it('should return default preferences for new user', () => {
      const prefs = manager.getPreferences('user-1');

      expect(prefs.userId).toBe('user-1');
      expect(prefs.locale).toBe('en');
      expect(prefs.timezone).toBe('UTC');
      expect(prefs.channels.email.enabled).toBe(true);
      expect(prefs.channels.sms.enabled).toBe(false);
      expect(prefs.categories.system.enabled).toBe(true);
      expect(prefs.categories.marketing.enabled).toBe(false);
    });

    it('should return existing preferences for known user', () => {
      const customPrefs = manager.getPreferences('user-1');
      customPrefs.channels.sms.enabled = true;
      manager.setPreferences(customPrefs);

      const retrieved = manager.getPreferences('user-1');
      expect(retrieved.channels.sms.enabled).toBe(true);
    });
  });

  describe('setPreferences', () => {
    it('should set preferences for a user', () => {
      const prefs = manager.getPreferences('user-1');
      prefs.channels.sms.enabled = true;

      manager.setPreferences(prefs);

      const retrieved = manager.getPreferences('user-1');
      expect(retrieved.channels.sms.enabled).toBe(true);
      expect(retrieved.updatedAt).toBeDefined();
    });
  });

  describe('updatePreferences', () => {
    it('should update existing preferences', () => {
      const updated = manager.updatePreferences('user-1', {
        locale: 'fr',
        timezone: 'Europe/Paris',
      });

      expect(updated.locale).toBe('fr');
      expect(updated.timezone).toBe('Europe/Paris');
      expect(updated.channels.email.enabled).toBe(true); // Unchanged
    });

    it('should merge channel preferences', () => {
      const updated = manager.updatePreferences('user-1', {
        channels: {
          email: { enabled: false },
          sms: { enabled: true },
        },
      });

      expect(updated.channels.email.enabled).toBe(false);
      expect(updated.channels.sms.enabled).toBe(true);
      expect(updated.channels.push.enabled).toBe(true); // Unchanged
    });
  });

  describe('shouldNotify', () => {
    it('should allow notification when all conditions met', () => {
      const prefs = manager.getPreferences('user-1');
      manager.setPreferences(prefs);

      const shouldNotify = manager.shouldNotify(
        'user-1',
        'system',
        'email',
        'normal'
      );

      expect(shouldNotify).toBe(true);
    });

    it('should deny notification when channel disabled', () => {
      manager.disableChannel('user-1', 'email');

      const shouldNotify = manager.shouldNotify(
        'user-1',
        'system',
        'email',
        'normal'
      );

      expect(shouldNotify).toBe(false);
    });

    it('should deny notification when category disabled', () => {
      manager.disableCategory('user-1', 'system');

      const shouldNotify = manager.shouldNotify(
        'user-1',
        'system',
        'email',
        'normal'
      );

      expect(shouldNotify).toBe(false);
    });

    it('should deny notification when channel not in category preferences', () => {
      const prefs = manager.getPreferences('user-1');
      prefs.categories.performance.channels = ['in_app']; // Only in_app
      manager.setPreferences(prefs);

      const shouldNotify = manager.shouldNotify(
        'user-1',
        'performance',
        'email',
        'normal'
      );

      expect(shouldNotify).toBe(false);
    });

    it('should allow critical notifications during DND', () => {
      const prefs = manager.getPreferences('user-1');
      prefs.doNotDisturb.enabled = true;
      prefs.doNotDisturb.overrideCritical = true;
      manager.setPreferences(prefs);

      const shouldNotify = manager.shouldNotify(
        'user-1',
        'system',
        'email',
        'critical'
      );

      expect(shouldNotify).toBe(true);
    });

    it('should deny normal notifications during DND', () => {
      const prefs = manager.getPreferences('user-1');
      prefs.doNotDisturb.enabled = true;
      prefs.doNotDisturb.overrideCritical = true;
      prefs.doNotDisturb.overrideUrgent = true;
      manager.setPreferences(prefs);

      const shouldNotify = manager.shouldNotify(
        'user-1',
        'system',
        'email',
        'normal'
      );

      expect(shouldNotify).toBe(false);
    });
  });

  describe('enableChannel / disableChannel', () => {
    it('should enable and disable channels', () => {
      manager.disableChannel('user-1', 'email');
      expect(manager.getPreferences('user-1').channels.email.enabled).toBe(false);

      manager.enableChannel('user-1', 'email');
      expect(manager.getPreferences('user-1').channels.email.enabled).toBe(true);
    });
  });

  describe('enableCategory / disableCategory', () => {
    it('should enable and disable categories', () => {
      manager.disableCategory('user-1', 'system');
      expect(manager.getPreferences('user-1').categories.system.enabled).toBe(false);

      manager.enableCategory('user-1', 'system');
      expect(manager.getPreferences('user-1').categories.system.enabled).toBe(true);
    });
  });

  describe('addSchedule / removeSchedule', () => {
    it('should add and remove schedules', () => {
      manager.addSchedule('user-1', {
        id: 'work-hours',
        name: 'Work Hours',
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '18:00',
        channels: ['slack'],
        categories: ['deployment'],
      });

      const prefs = manager.getPreferences('user-1');
      expect(prefs.schedule.schedules.length).toBe(1);
      expect(prefs.schedule.enabled).toBe(true);

      manager.removeSchedule('user-1', 'work-hours');
      expect(manager.getPreferences('user-1').schedule.schedules.length).toBe(0);
    });
  });

  describe('addDndSchedule / removeDndSchedule', () => {
    it('should add and remove DND schedules', () => {
      manager.addDndSchedule('user-1', {
        id: 'night-sleep',
        name: 'Night Sleep',
        startTime: '22:00',
        endTime: '07:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      });

      const prefs = manager.getPreferences('user-1');
      expect(prefs.doNotDisturb.schedules.length).toBe(1);
      expect(prefs.doNotDisturb.enabled).toBe(true);

      manager.removeDndSchedule('user-1', 'night-sleep');
      expect(manager.getPreferences('user-1').doNotDisturb.schedules.length).toBe(0);
    });
  });

  describe('deletePreferences', () => {
    it('should delete user preferences', () => {
      manager.getPreferences('user-1');
      expect(manager.getPreferences('user-1')).toBeDefined();

      manager.deletePreferences('user-1');

      // Should get fresh defaults after deletion
      const prefs = manager.getPreferences('user-1');
      expect(prefs).toBeDefined();
      expect(prefs.channels.email.enabled).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return manager statistics', () => {
      manager.getPreferences('user-1');
      manager.getPreferences('user-2');

      const prefs1 = manager.getPreferences('user-1');
      prefs1.doNotDisturb.enabled = true;
      manager.setPreferences(prefs1);

      const stats = manager.getStats();

      expect(stats.totalUsers).toBe(2);
      expect(stats.usersWithDnd).toBe(1);
      expect(stats.enabledChannels.get('email')).toBe(2);
      expect(stats.enabledCategories.get('system')).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all preferences', () => {
      manager.getPreferences('user-1');
      manager.getPreferences('user-2');

      expect(manager.getUserIds().length).toBe(2);

      manager.clear();

      expect(manager.getUserIds().length).toBe(0);
    });
  });
});
