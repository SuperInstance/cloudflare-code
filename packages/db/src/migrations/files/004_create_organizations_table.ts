/**
 * Migration 004: Create organizations table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateOrganizationsTableMigration extends Migration {
  readonly version = 4;
  readonly name = 'create_organizations_table';
  readonly description = 'Create organizations table for team management';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        avatar_url TEXT,
        settings JSON DEFAULT '{}',
        plan TEXT DEFAULT 'free',
        max_users INTEGER DEFAULT 5,
        max_projects INTEGER DEFAULT 10,
        billing_email TEXT,
        trial_ends_at INTEGER,
        subscription_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
      CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan);

      CREATE TABLE IF NOT EXISTS organization_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        invited_by INTEGER,
        joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        UNIQUE(organization_id, user_id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
      CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS organization_members;`);
    await this.execute(context, `DROP TABLE IF EXISTS organizations;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_organizations_slug;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_organizations_plan;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_org_members_org_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_org_members_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_org_members_role;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const orgExists = await this.tableExists(context, 'organizations');
    const membersExists = await this.tableExists(context, 'organization_members');
    return orgExists && membersExists;
  }
}
