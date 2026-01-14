/**
 * Migration 022: Create notifications table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateNotificationsTableMigration extends Migration {
  readonly version = 22;
  readonly name = 'create_notifications_table';
  readonly description = 'Create notifications table for user notifications';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data JSON DEFAULT '{}',
        read INTEGER DEFAULT 0,
        read_at INTEGER,
        action_url TEXT,
        action_label TEXT,
        priority INTEGER DEFAULT 0,
        expires_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
      CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

      CREATE TABLE IF NOT EXISTS notification_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        email_notifications INTEGER DEFAULT 1,
        push_notifications INTEGER DEFAULT 1,
        notification_types JSON DEFAULT '{}',
        quiet_hours_start TEXT,
        quiet_hours_end TEXT,
        timezone TEXT DEFAULT 'UTC',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS notification_preferences;`);
    await this.execute(context, `DROP TABLE IF EXISTS notifications;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_notifications_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_notifications_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_notifications_read;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_notifications_created_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_notifications_priority;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_notifications_expires_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_notification_prefs_user_id;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const notificationsExists = await this.tableExists(context, 'notifications');
    const prefsExists = await this.tableExists(context, 'notification_preferences');
    return notificationsExists && prefsExists;
  }
}
