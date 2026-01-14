/**
 * Migration 017: Create embeddings table
 */

import { Migration, MigrationContext } from '../migration';

export class CreateEmbeddingsTableMigration extends Migration {
  readonly version = 17;
  readonly name = 'create_embeddings_table';
  readonly description = 'Create embeddings table for vector storage';

  async up(context: MigrationContext): Promise<void> {
    await this.execute(
      context,
      `
      CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
        dimension INTEGER NOT NULL DEFAULT 1536,
        metadata JSON DEFAULT '{}',
        user_id INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_embeddings_content_id ON embeddings(content_id);
      CREATE INDEX IF NOT EXISTS idx_embeddings_content_type ON embeddings(content_type);
      CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings(model);
      CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings(user_id);
      CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_content_unique ON embeddings(content_id, content_type) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS embedding_collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        model TEXT NOT NULL,
        dimension INTEGER NOT NULL,
        metadata JSON DEFAULT '{}',
        created_by INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_embedding_collections_name ON embedding_collections(name);

      CREATE TABLE IF NOT EXISTS collection_embeddings (
        embedding_id INTEGER NOT NULL,
        collection_id INTEGER NOT NULL,
        added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (embedding_id, collection_id),
        FOREIGN KEY (embedding_id) REFERENCES embeddings(id) ON DELETE CASCADE,
        FOREIGN KEY (collection_id) REFERENCES embedding_collections(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_collection_embeddings_collection_id ON collection_embeddings(collection_id);
      CREATE INDEX IF NOT EXISTS idx_collection_embeddings_embedding_id ON collection_embeddings(embedding_id);
    `
    );
  }

  async down(context: MigrationContext): Promise<void> {
    await this.execute(context, `DROP TABLE IF EXISTS collection_embeddings;`);
    await this.execute(context, `DROP TABLE IF EXISTS embedding_collections;`);
    await this.execute(context, `DROP TABLE IF EXISTS embeddings;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_embeddings_content_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_embeddings_content_type;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_embeddings_model;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_embeddings_user_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_embeddings_created_at;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_embeddings_content_unique;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_embedding_collections_name;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_collection_embeddings_collection_id;`);
    await this.execute(context, `DROP INDEX IF EXISTS idx_collection_embeddings_embedding_id;`);
  }

  async validate(context: MigrationContext): Promise<boolean> {
    const embeddingsExists = await this.tableExists(context, 'embeddings');
    const collectionsExists = await this.tableExists(context, 'embedding_collections');
    return embeddingsExists && collectionsExists;
  }
}
