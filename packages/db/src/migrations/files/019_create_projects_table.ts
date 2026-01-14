/**
 * Migration 019: Create projects table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateProjectsTableMigration extends Migration {
  readonly version = 19;
  readonly name = 'create_projects_table';
  readonly description = 'Create projects table for user projects';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        organization_id INTEGER,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'agent' CHECK(type IN ('agent', 'workflow', 'bot', 'api', 'function')),
        visibility TEXT DEFAULT 'private' CHECK(visibility IN ('public', 'private', 'unlisted')),
        settings JSON DEFAULT '{}',
        config JSON DEFAULT '{}',
        runtime_settings JSON DEFAULT '{}',
        deployment_config JSON DEFAULT '{}',
        version TEXT DEFAULT '1.0.0',
        is_active INTEGER DEFAULT 1,
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        last_deployed_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        UNIQUE(user_id, slug),
        UNIQUE(organization_id, slug)
      );

      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
      CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
      CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
      CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
      CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);

      CREATE TABLE IF NOT EXISTS project_collaborators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('owner', 'admin', 'editor', 'viewer')),
        invited_by INTEGER,
        joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        UNIQUE(project_id, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON project_collaborators(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON project_collaborators(user_id);
      CREATE INDEX IF NOT EXISTS idx_project_collaborators_role ON project_collaborators(role);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS project_collaborators;`);
    await this.execute(context, `DROP TABLE IF EXISTS projects;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_projects_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_projects_organization_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_projects_slug;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_projects_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_projects_visibility;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_projects_is_active;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_project_collaborators_project_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_project_collaborators_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_project_collaborators_role;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const projectsExists = await this.tableExists(context, 'projects');
    const collabsExists = await this.tableExists(context, 'project_collaborators');
    return projectsExists && collabsExists;
  }
}
