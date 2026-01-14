/**
 * Migration 018: Create vector indexes table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateVectorIndexesTableMigration extends Migration {
  readonly version = 18;
  readonly name = 'create_vector_indexes_table';
  readonly description = 'Create vector indexes table for similarity search';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS vector_indexes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        index_type TEXT NOT NULL DEFAULT 'HNSW' CHECK(index_type IN ('HNSW', 'IVF', 'FLAT')),
        dimension INTEGER NOT NULL,
        metric_type TEXT NOT NULL DEFAULT 'cosine' CHECK(metric_type IN ('cosine', 'l2', 'ip')),
        parameters JSON DEFAULT '{}',
        num_vectors INTEGER DEFAULT 0,
        index_size_bytes INTEGER DEFAULT 0,
        build_status TEXT DEFAULT 'ready' CHECK(build_status IN ('building', 'ready', 'error')),
        last_build_time INTEGER,
        metadata JSON DEFAULT '{}',
        created_by INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_vector_indexes_name ON vector_indexes(name);
      CREATE INDEX IF NOT EXISTS idx_vector_indexes_type ON vector_indexes(index_type);
      CREATE INDEX IF NOT EXISTS idx_vector_indexes_status ON vector_indexes(build_status);

      CREATE TABLE IF NOT EXISTS vector_index_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vector_index_id INTEGER NOT NULL,
        embedding_id INTEGER NOT NULL,
        vector_position INTEGER,
        distance REAL,
        metadata JSON DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (vector_index_id) REFERENCES vector_indexes(id) ON DELETE CASCADE,
        FOREIGN KEY (embedding_id) REFERENCES embeddings(id) ON DELETE CASCADE,
        UNIQUE(vector_index_id, embedding_id)
      );

      CREATE INDEX IF NOT EXISTS idx_vector_mappings_index_id ON vector_index_mappings(vector_index_id);
      CREATE INDEX IF NOT EXISTS idx_vector_mappings_embedding_id ON vector_index_mappings(embedding_id);
      CREATE INDEX IF NOT EXISTS idx_vector_mappings_position ON vector_index_mappings(vector_position);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS vector_index_mappings;`);
    await this.execute(context, `DROP TABLE IF EXISTS vector_indexes;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_vector_indexes_name;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_vector_indexes_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_vector_indexes_status;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_vector_mappings_index_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_vector_mappings_embedding_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_vector_mappings_position;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const indexesExists = await this.tableExists(context, 'vector_indexes');
    const mappingsExists = await this.tableExists(context, 'vector_index_mappings');
    return indexesExists && mappingsExists;
  }
}
