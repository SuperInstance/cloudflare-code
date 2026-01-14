/**
 * Migration 008: Create code reviews table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateCodeReviewsTableMigration extends Migration {
  readonly version = 8;
  readonly name = 'create_code_reviews_table';
  readonly description = 'Create code reviews table for AI-powered code analysis';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS code_reviews (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        repository_url TEXT,
        branch TEXT,
        commit_hash TEXT,
        file_path TEXT,
        code_content TEXT NOT NULL,
        language TEXT,
        review_type TEXT DEFAULT 'general' CHECK(review_type IN ('general', 'security', 'performance', 'style', 'bug_detection')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'analyzing', 'completed', 'failed')),
        issues_found INTEGER DEFAULT 0,
        suggestions JSON,
        analysis_summary TEXT,
        score REAL,
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        completed_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_code_reviews_user_id ON code_reviews(user_id);
      CREATE INDEX IF NOT EXISTS idx_code_reviews_status ON code_reviews(status);
      CREATE INDEX IF NOT EXISTS idx_code_reviews_review_type ON code_reviews(review_type);
      CREATE INDEX IF NOT EXISTS idx_code_reviews_language ON code_reviews(language);
      CREATE INDEX IF NOT EXISTS idx_code_reviews_created_at ON code_reviews(created_at);
      CREATE INDEX IF NOT EXISTS idx_code_reviews_repository_url ON code_reviews(repository_url);

      CREATE TABLE IF NOT EXISTS code_review_issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'error', 'critical')),
        type TEXT NOT NULL,
        line_start INTEGER,
        line_end INTEGER,
        message TEXT NOT NULL,
        suggestion TEXT,
        code_snippet TEXT,
        rule_id TEXT,
        resolved INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (review_id) REFERENCES code_reviews(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_review_issues_review_id ON code_review_issues(review_id);
      CREATE INDEX IF NOT EXISTS idx_review_issues_severity ON code_review_issues(severity);
      CREATE INDEX IF NOT EXISTS idx_review_issues_type ON code_review_issues(type);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS code_review_issues;`);
    await this.execute(context, `DROP TABLE IF EXISTS code_reviews;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_code_reviews_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_code_reviews_status;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_code_reviews_review_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_code_reviews_language;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_code_reviews_created_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_code_reviews_repository_url;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_review_issues_review_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_review_issues_severity;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_review_issues_type;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const reviewsExists = await this.tableExists(context, 'code_reviews');
    const issuesExists = await this.tableExists(context, 'code_review_issues');
    return reviewsExists && issuesExists;
  }
}
