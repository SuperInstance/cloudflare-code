/**
 * Migration 010: Create experiments table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateExperimentsTableMigration extends Migration {
  readonly version = 10;
  readonly name = 'create_experiments_table';
  readonly description = 'Create experiments table for A/B testing';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        hypothesis TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
        start_date INTEGER,
        end_date INTEGER,
        target_metrics TEXT DEFAULT '[]',
        variants JSON DEFAULT '[]',
        traffic_allocation INTEGER DEFAULT 100,
        min_sample_size INTEGER,
        statistical_significance REAL DEFAULT 0.95,
        winner_variant TEXT,
        metadata JSON DEFAULT '{}',
        created_by INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_experiments_key ON experiments(key);
      CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
      CREATE INDEX IF NOT EXISTS idx_experiments_start_date ON experiments(start_date);

      CREATE TABLE IF NOT EXISTS experiment_participants (
        id TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL,
        user_id INTEGER,
        session_id TEXT,
        variant TEXT NOT NULL,
        enrolled_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        converted INTEGER DEFAULT 0,
        converted_at INTEGER,
        metrics JSON DEFAULT '{}',
        FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(experiment_id, user_id),
        UNIQUE(experiment_id, session_id)
      );

      CREATE INDEX IF NOT EXISTS idx_exp_participants_experiment_id ON experiment_participants(experiment_id);
      CREATE INDEX IF NOT EXISTS idx_exp_participants_user_id ON experiment_participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_exp_participants_variant ON experiment_participants(variant);
      CREATE INDEX IF NOT EXISTS idx_exp_participants_converted ON experiment_participants(converted);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS experiment_participants;`);
    await this.execute(context, `DROP TABLE IF EXISTS experiments;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_experiments_key;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_experiments_status;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_experiments_start_date;`);
    await this.execute(context, `DROP INDEX IF NOT EXISTS idx_exp_participants_experiment_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_exp_participants_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_exp_participants_variant;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_exp_participants_converted;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const expExists = await this.tableExists(context, 'experiments');
    const partExists = await this.tableExists(context, 'experiment_participants');
    return expExists && partExists;
  }
}
