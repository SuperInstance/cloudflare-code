/**
 * Migration 009: Create feature flags table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateFeatureFlagsTableMigration extends Migration {
  readonly version = 9;
  readonly name = 'create_feature_flags_table';
  readonly description = 'Create feature flags table for configuration management';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS feature_flags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        enabled INTEGER DEFAULT 0,
        type TEXT DEFAULT 'boolean' CHECK(type IN ('boolean', 'percentage', 'json')),
        value JSON,
        percentage_users INTEGER,
        rules JSON DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        created_by INTEGER,
        updated_by INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
      CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
      CREATE INDEX IF NOT EXISTS idx_feature_flags_tags ON feature_flags(tags);

      CREATE TABLE IF NOT EXISTS feature_flag_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature_flag_id INTEGER NOT NULL,
        user_id INTEGER,
        organization_id INTEGER,
        enabled INTEGER NOT NULL,
        value JSON,
        created_by INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (feature_flag_id) REFERENCES feature_flags(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_flag_overrides_flag_id ON feature_flag_overrides(feature_flag_id);
      CREATE INDEX IF NOT EXISTS idx_flag_overrides_user_id ON feature_flag_overrides(user_id);
      CREATE INDEX IF NOT EXISTS idx_flag_overrides_org_id ON feature_flag_overrides(organization_id);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS feature_flag_overrides;`);
    await this.execute(context, `DROP TABLE IF EXISTS feature_flags;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_feature_flags_key;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_feature_flags_enabled;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_feature_flags_tags;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_flag_overrides_flag_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_flag_overrides_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_flag_overrides_org_id;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const flagsExists = await this.tableExists(context, 'feature_flags');
    const overridesExists = await this.tableExists(context, 'feature_flag_overrides');
    return flagsExists && overridesExists;
  }
}
