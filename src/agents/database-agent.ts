/**
 * Database Agent - Generates D1 schemas, migrations, and query builders
 *
 * Features:
 * - D1 database schema generation with proper relationships
 * - Migration file generation for schema changes
 * - Type-safe query builders for CRUD operations
 * - Database seeding with sample data
 * - Integration with Cloudflare D1
 * - Progress reporting to coordinator
 */

import type { AgentState, ProjectFile } from '../types';
import type { Bindings } from '../index';

// Database Agent Configuration
interface DatabaseAgentConfig {
  sessionId: string;
  agentId: string;
  provider: 'manus' | 'zai' | 'minimax' | 'claude' | 'grok';
  stateManager: any; // ProjectStateManager
  coordinatorUrl: string;
  db: D1Database; // Cloudflare D1 binding
}

// Database field types
type FieldType =
  | 'text'
  | 'integer'
  | 'real'
  | 'blob'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'json';

// Database field definition
interface DatabaseField {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  primaryKey?: boolean;
  foreignKey?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
  defaultValue?: string | number | boolean;
  check?: string;
  comment?: string;
}

// Table definition
interface DatabaseTable {
  name: string;
  fields: DatabaseField[];
  indexes?: Array<{
    name: string;
    columns: string[];
    unique?: boolean;
  }>;
  comment?: string;
}

// Entity definition (higher-level concept)
interface DatabaseEntity {
  name: string;
  tableName: string;
  fields: DatabaseField[];
  relationships?: Array<{
    type: 'one-to-many' | 'many-to-one' | 'many-to-many' | 'one-to-one';
    targetTable: string;
    foreignKey?: string;
    joinTable?: string;
    joinColumns?: Array<{
      table: string;
      column: string;
      foreignColumn: string;
    }>;
  }>;
}

// Schema generation request
interface SchemaRequest {
  entities: DatabaseEntity[];
  options?: {
    generateReadme?: boolean;
    generateIndexFiles?: boolean;
    generateSeedData?: boolean;
    usePluralTableNames?: boolean;
  };
}

// Migration generation request
interface MigrationRequest {
  name: string;
  type: 'create' | 'alter' | 'drop' | 'seed';
  table?: string;
  sql?: string;
  toSchema?: string;
  fromSchema?: string;
}

// Seeding request
interface SeedRequest {
  table: string;
  strategy: 'fixed' | 'random' | 'csv';
  data?: any[];
  count?: number;
  csvPath?: string;
}

// Query builder request
interface QueryBuilderRequest {
  table: string;
  operations: Array<{
    type: 'find' | 'findOne' | 'insert' | 'update' | 'delete' | 'count';
    filter?: any;
    sort?: string[];
    limit?: number;
    offset?: number;
  }>;
}

// Response types
interface GenerationResult {
  success: boolean;
  files: ProjectFile[];
  errors?: string[];
  metadata: {
    generatedAt: number;
    provider: string;
    tokens?: number;
  };
}

class DatabaseAgent {
  private config: DatabaseAgentConfig;
  private state: AgentState;
  private lockedFiles: Set<string>;

  constructor(config: DatabaseAgentConfig) {
    this.config = config;
    this.state = {
      agentId: config.agentId,
      sessionId: config.sessionId,
      agentType: 'database',
      status: 'idle',
      progress: 0,
      currentTask: undefined,
    };
    this.lockedFiles = new Set();
  }

  /**
   * Main entry point for database generation tasks
   */
  async generate(request: SchemaRequest | MigrationRequest | SeedRequest | QueryBuilderRequest): Promise<GenerationResult> {
    await this.updateState('working', 0, 'Starting database generation');

    try {
      if ('entities' in request) {
        return await this.generateSchema(request);
      } else if ('type' in request && request.type === 'seed') {
        return await this.generateSeedData(request);
      } else if ('operations' in request) {
        return await this.generateQueryBuilders(request);
      } else {
        return await this.generateMigration(request);
      }
    } catch (error) {
      await this.updateState('error', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      await this.releaseAllLocks();
    }
  }

  /**
   * Generate complete database schema
   */
  async generateSchema(request: SchemaRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, 'Generating database schema');

    const files: ProjectFile[] = [];

    // Generate SQL schema
    const schemaFiles = await this.generateSQLSchema(request.entities, request.options);
    files.push(...schemaFiles);

    // Generate TypeScript types
    const typeFiles = await this.generateTypeDefinitions(request.entities);
    files.push(...typeFiles);

    // Generate query builders
    const queryFiles = await this.generateQueryBuildersForSchema(request.entities);
    files.push(...queryFiles);

    // Generate migration
    const migrationFiles = await this.generateInitialMigration(request.entities);
    files.push(...migrationFiles);

    // Generate documentation
    if (request.options?.generateReadme) {
      const readmeFile = await this.generateSchemaReadme(request.entities);
      files.push(readmeFile);
    }

    // Generate seed data
    if (request.options?.generateSeedData) {
      const seedFiles = await this.generateSeedFiles(request.entities);
      files.push(...seedFiles);
    }

    await this.updateState('completed', 100, 'Database schema generation complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Generate migration files
   */
  async generateMigration(request: MigrationRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, `Generating migration: ${request.name}`);

    const files: ProjectFile[] = [];

    if (request.type === 'create') {
      // Create table migration
      const migrationFile = await this.generateCreateTableMigration(request);
      files.push(migrationFile);
    } else if (request.type === 'alter') {
      // Alter table migration
      const migrationFile = await this.generateAlterTableMigration(request);
      files.push(migrationFile);
    } else if (request.type === 'drop') {
      // Drop table migration
      const migrationFile = await this.generateDropTableMigration(request);
      files.push(migrationFile);
    } else if (request.type === 'seed') {
      // Seed migration
      const migrationFile = await this.generateSeedMigration(request);
      files.push(migrationFile);
    }

    await this.updateState('completed', 100, 'Migration generation complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Generate seed data files
   */
  async generateSeedData(request: SeedRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, `Generating seed data for ${request.table}`);

    const files: ProjectFile[] = [];

    // Generate SQL seed file
    const sqlSeedFile = await this.generateSQLSeedFile(request);
    files.push(sqlSeedFile);

    // Generate TypeScript seed file
    const tsSeedFile = await this.generateTypeScriptSeedFile(request);
    files.push(tsSeedFile);

    await this.updateState('completed', 100, 'Seed data generation complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Generate query builders
   */
  async generateQueryBuilders(request: QueryBuilderRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, 'Generating query builders');

    const files: ProjectFile[] = [];

    // Generate base query builders
    const baseFiles = await this.generateBaseQueryBuilders();
    files.push(...baseFiles);

    // Generate specific table query builders
    const tableFiles = await this.generateTableQueryBuilders(request.table);
    files.push(...tableFiles);

    await this.updateState('completed', 100, 'Query builder generation complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Generate SQL schema files
   */
  private async generateSQLSchema(entities: DatabaseEntity[], options?: SchemaRequest['options']): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    // Generate main schema file
    const schemaSQL = this.generateSchemaSQL(entities, options);
    const schemaFile: ProjectFile = {
      path: 'src/db/schema.sql',
      content: schemaSQL,
      language: 'sql',
      hash: this.generateHash(schemaSQL),
    };
    files.push(schemaFile);

    // Generate index file
    if (options?.generateIndexFiles) {
      const indexSQL = this.generateIndexSQL(entities);
      const indexFile: ProjectFile = {
        path: 'src/db/index.sql',
        content: indexSQL,
        language: 'sql',
        hash: this.generateHash(indexSQL),
      };
      files.push(indexFile);
    }

    return files;
  }

  /**
   * Generate schema SQL
   */
  private generateSchemaSQL(entities: DatabaseEntity[], options?: SchemaRequest['options']): string {
    const tableNames = options?.usePluralTableNames ? entities.map(e => this.pluralize(e.tableName)) : entities.map(e => e.tableName);

    const sqlStatements = entities.map((entity, index) => {
      const tableName = tableNames[index];
      const tableDDL = this.generateTableDDL(entity, tableName);
      return tableDDL;
    }).join('\n\n');

    return `-- Database Schema
-- Generated by Cocapn Database Agent
-- Date: ${new Date().toISOString()}

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

${sqlStatements}

-- Create indexes
${this.generateIndexSQL(entities)}

-- Enable WAL mode for better performance
PRAGMA journal_mode = WAL;

-- Set synchronous mode to NORMAL
PRAGMA synchronous = NORMAL;

-- Set cache size
PRAGMA cache_size = -10000; -- 10MB cache`;
  }

  /**
   * Generate table DDL
   */
  private generateTableDDL(entity: DatabaseEntity, tableName: string): string {
    const fieldDefinitions = entity.fields.map(field =>
      this.generateFieldDefinition(field)
    ).join(',\n  ');

    const fieldConstraints = entity.fields
      .filter(field => field.primaryKey)
      .map(field => field.name);

    const primaryKeyConstraint = fieldConstraints.length > 0
      ? `\n  PRIMARY KEY (${fieldConstraints.join(', ')})`
      : '';

    const indexes = entity.fields
      .filter(field => field.foreignKey)
      .map(field => this.generateForeignKeyDDL(tableName, field))
      .join('\n');

    return `CREATE TABLE ${tableName} (
  ${fieldDefinitions}${primaryKeyConstraint}
);${indexes ? '\n' + indexes : ''}`;
  }

  /**
   * Generate field definition
   */
  private generateFieldDefinition(field: DatabaseField): string {
    let definition = `${field.name} ${this.mapTypeToSQL(field.type)}`;

    if (field.required) {
      definition += ' NOT NULL';
    }

    if (field.unique) {
      definition += ' UNIQUE';
    }

    if (field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        definition += ` DEFAULT '${field.defaultValue}'`;
      } else {
        definition += ` DEFAULT ${field.defaultValue}`;
      }
    }

    if (field.check) {
      definition += ` CHECK (${field.check})`;
    }

    return definition;
  }

  /**
   * Generate foreign key DDL
   */
  private generateForeignKeyDDL(tableName: string, field: DatabaseField): string {
    if (!field.foreignKey) return '';

    const onDelete = field.foreignKey.onDelete || 'RESTRICT';
    const onUpdate = field.foreignKey.onUpdate || 'RESTRICT';

    return `\nALTER TABLE ${tableName}
ADD CONSTRAINT fk_${tableName}_${field.name}_${field.foreignKey.table}
FOREIGN KEY (${field.name}) REFERENCES ${field.foreignKey.table}(${field.foreignKey.column})
ON DELETE ${onDelete} ON UPDATE ${onUpdate};`;
  }

  /**
   * Generate index SQL
   */
  private generateIndexSQL(entities: DatabaseEntity[]): string {
    const indexStatements: string[] = [];

    // Generate foreign key indexes
    entities.forEach(entity => {
      entity.fields.forEach(field => {
        if (field.foreignKey) {
          const indexName = `idx_${entity.tableName}_${field.name}`;
          indexStatements.push(`CREATE INDEX ${indexName} ON ${entity.tableName}(${field.name});`);
        }
      });
    });

    // Generate custom indexes
    entities.forEach(entity => {
      if (entity.indexes) {
        entity.indexes.forEach(index => {
          const uniqueClause = index.unique ? 'UNIQUE ' : '';
          const columns = index.columns.join(', ');
          const indexName = `idx_${entity.tableName}_${index.name}`;
          indexStatements.push(`CREATE ${uniqueClause}INDEX ${indexName} ON ${entity.tableName}(${columns});`);
        });
      }
    });

    return indexStatements.join('\n');
  }

  /**
   * Generate TypeScript type definitions
   */
  private async generateTypeDefinitions(entities: DatabaseEntity[]): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    // Generate base types file
    const typesFile: ProjectFile = {
      path: 'src/db/types.ts',
      content: this.generateTypesFile(entities),
      language: 'typescript',
      hash: this.generateHash(this.generateTypesFile(entities)),
    };
    files.push(typesFile);

    // Generate individual entity files
    for (const entity of entities) {
      const entityFile: ProjectFile = {
        path: `src/db/${entity.name.toLowerCase()}.ts`,
        content: this.generateEntityTypes(entity),
        language: 'typescript',
        hash: this.generateHash(this.generateEntityTypes(entity)),
      };
      files.push(entityFile);
    }

    return files;
  }

  /**
   * Generate types file
   */
  private generateTypesFile(entities: DatabaseEntity[]): string {
    const typeImports = entities.map(entity => {
      const pluralName = this.pluralize(entity.name);
      return `import type { ${entity.name}, Create${entity.name}, Update${entity.name} } from './${entity.name.toLowerCase()}';`;
    }).join('\n');

    const exports = entities.map(entity => {
      const pluralName = this.pluralize(entity.name);
      return `export { ${entity.name}, Create${entity.name}, Update${entity.name} } from './${entity.name.toLowerCase()}';\nexport type { ${pluralName}List } from './${entity.name.toLowerCase()}';`;
    }).join('\n\n');

    return `// Database Types
// Generated by Cocapn Database Agent
// Date: ${new Date().toISOString()}

${typeImports}

${exports}`;
  }

  /**
   * Generate entity types
   */
  private generateEntityTypes(entity: DatabaseEntity): string {
    const fieldTypes = entity.fields.map(field => {
      let type = this.mapTypeToTypeScript(field.type);
      if (!field.required) {
        type = `${type} | null`;
      }
      if (field.foreignKey) {
        type = `${type} | ${field.foreignKey.table}`;
      }
      return `  ${field.name}: ${type};`;
    }).join('\n');

    const pluralName = this.pluralize(entity.name);

    return `// ${entity.name} Entity Types
// Generated by Cocapn Database Agent
// Date: ${new Date().toISOString()}

export interface ${entity.name} {
${fieldTypes}
}

export interface Create${entity.name} {
${entity.fields.filter(f => !f.primaryKey).map(field => {
    let type = this.mapTypeToTypeScript(field.type);
    if (!field.required) {
      type = `${type} | null | undefined`;
    }
    return `  ${field.name}: ${type};`;
  }).join('\n')}
}

export interface Update${entity.name} {
${entity.fields.filter(f => !f.primaryKey).map(field => {
    let type = this.mapTypeToTypeScript(field.type);
    if (!field.required) {
      type = `${type} | null | undefined`;
    }
    return `  ${field.name}?: ${type};`;
  }).join('\n')}
}

export interface ${pluralName}List extends Array<${entity.name}> {}`;
  }

  /**
   * Generate query builders
   */
  private async generateQueryBuildersForSchema(entities: DatabaseEntity[]): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    // Generate base query builder
    const baseFile: ProjectFile = {
      path: 'src/db/query-builder.ts',
      content: this.generateBaseQueryBuilder(),
      language: 'typescript',
      hash: this.generateHash(this.generateBaseQueryBuilder()),
    };
    files.push(baseFile);

    // Generate individual query builders
    for (const entity of entities) {
      const queryFile: ProjectFile = {
        path: `src/db/${entity.name.toLowerCase()}-query.ts`,
        content: this.generateEntityQueryBuilder(entity),
        language: 'typescript',
        hash: this.generateHash(this.generateEntityQueryBuilder(entity)),
      };
      files.push(queryFile);
    }

    // Generate database manager
    const dbManagerFile: ProjectFile = {
      path: 'src/db/db-manager.ts',
      content: this.generateDatabaseManager(entities),
      language: 'typescript',
      hash: this.generateHash(this.generateDatabaseManager(entities)),
    };
    files.push(dbManagerFile);

    return files;
  }

  /**
   * Generate base query builder
   */
  private generateBaseQueryBuilder(): string {
    return `// Base Query Builder
// Generated by Cocapn Database Agent
// Date: ${new Date().toISOString()}

import type { D1Database } from '@cloudflare/workers-types';

export abstract class BaseQueryBuilder {
  protected db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  protected async execute(query: string, params: any[] = []): Promise<any> {
    try {
      return await this.db.prepare(query).bind(...params).first();
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  }

  protected async executeAll(query: string, params: any[] = []): Promise<any[]> {
    try {
      return await this.db.prepare(query).bind(...params).all();
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  }

  protected async executeRun(query: string, params: any[] = []): Promise<any> {
    try {
      return await this.db.prepare(query).bind(...params).run();
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  }
}

export class QueryHelper {
  static whereClause(conditions: any[] = []): { sql: string; params: any[] } {
    const params: any[] = [];
    const clauses: string[] = [];

    conditions.forEach(condition => {
      if (condition.field && condition.operator && condition.value !== undefined) {
        clauses.push(\`\${condition.field} \${condition.operator} ?\`);
        params.push(condition.value);
      }
    });

    return {
      sql: clauses.length > 0 ? \` WHERE \${clauses.join(' AND ')}\` : '',
      params
    };
  }

  static orderByClause(orders: string[] = []): string {
    return orders.length > 0 ? \` ORDER BY \${orders.join(', ')}\` : '';
  }

  static limitClause(limit?: number, offset?: number): string {
    if (limit && offset) {
      return \` LIMIT \${limit} OFFSET \${offset}\`;
    } else if (limit) {
      return \` LIMIT \${limit}\`;
    }
    return '';
  }
}`;
  }

  /**
   * Generate entity query builder
   */
  private generateEntityQueryBuilder(entity: DatabaseEntity): string {
    const pluralName = this.pluralize(entity.name);

    return `// ${entity.name} Query Builder
// Generated by Cocapn Database Agent
// Date: ${new Date().toISOString()}

import { BaseQueryBuilder, QueryHelper } from './query-builder';
import type { ${entity.name}, Create${entity.name}, Update${entity.name} } from './${entity.name.toLowerCase()}';

export class ${entity.name}QueryBuilder extends BaseQueryBuilder {
  async findAll(conditions: any[] = [], orders: string[] = [], limit?: number, offset?: number): Promise<${pluralName}> {
    const where = QueryHelper.whereClause(conditions);
    const orderBy = QueryHelper.orderByClause(orders);
    const limitOffset = QueryHelper.limitClause(limit, offset);

    const query = \`SELECT * FROM ${entity.tableName}\${where.sql}\${orderBy}\${limitOffset}\`;
    const result = await this.executeAll(query, where.params);

    return result as ${pluralName};
  }

  async findOne(conditions: any[]): Promise<${entity.name} | null> {
    const where = QueryHelper.whereClause(conditions);
    const query = \`SELECT * FROM ${entity.tableName}\${where.sql} LIMIT 1\`;

    return await this.execute(query, where.params) as ${entity.name} | null;
  }

  async findById(id: string | number): Promise<${entity.name} | null> {
    return await this.findOne([{ field: 'id', operator: '=', value: id }]);
  }

  async create(data: Create${entity.name}): Promise<${entity.name}> {
    const fields = Object.keys(data).filter(key => data[key] !== undefined && data[key] !== null);
    const values = fields.map(field => data[field as keyof Create${entity.name}]);
    const placeholders = fields.map(() => '?');

    const query = \`INSERT INTO ${entity.tableName} (\${fields.join(', ')}) VALUES (\${placeholders.join(', ')}) RETURNING *\`;

    return await this.execute(query, values) as ${entity.name};
  }

  async update(id: string | number, data: Update${entity.name}): Promise<${entity.name} | null> {
    const fields = Object.keys(data).filter(key => data[key] !== undefined && data[key] !== null);
    const values = fields.map(field => data[field as keyof Update${entity.name}]);
    values.push(id);

    const setClause = fields.map((field, index) => \`\${field} = ?\`).join(', ');

    const query = \`UPDATE ${entity.tableName} SET \${setClause} WHERE id = ? RETURNING *\`;

    return await this.execute(query, values) as ${entity.name} | null;
  }

  async delete(id: string | number): Promise<boolean> {
    const query = \`DELETE FROM ${entity.tableName} WHERE id = ?\`;
    const result = await this.executeRun(query, [id]);

    return result.changes > 0;
  }

  async count(conditions: any[] = []): Promise<number> {
    const where = QueryHelper.whereClause(conditions);
    const query = \`SELECT COUNT(*) as count FROM ${entity.tableName}\${where.sql}\`;

    const result = await this.execute(query, where.params);
    return result.count as number;
  }

  async findWithRelations(conditions: any[] = [], relations: string[] = []): Promise<${pluralName}> {
    // TODO: Implement relation loading
    return await this.findAll(conditions);
  }
}`;
  }

  /**
   * Generate database manager
   */
  private generateDatabaseManager(entities: DatabaseEntity[]): string {
    const builderImports = entities.map(entity =>
      `import { ${entity.name}QueryBuilder } from './${entity.name.toLowerCase()}-query';`
    ).join('\n');

    const builderInstances = entities.map(entity =>
      `    ${entity.name.toLowerCase()}: new ${entity.name}QueryBuilder(this.db),`
    ).join('\n');

    return `// Database Manager
// Generated by Cocapn Database Agent
// Date: ${new Date().toISOString()}

${builderImports}

export class DatabaseManager {
  private db: D1Database;
  private initialized = false;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Initialize database with schema
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const schema = await this.db.prepare('SELECT name FROM sqlite_master WHERE type = \'table\' AND name NOT LIKE \'sqlite_%\'').all();

      if (schema.results.length === 0) {
        // Database is empty, run schema
        const schemaSQL = \`\\n\${await Deno.readTextFile('./src/db/schema.sql')}\`;
        const statements = schemaSQL.split(';').filter(stmt => stmt.trim());

        for (const statement of statements) {
          if (statement.trim()) {
            await this.db.prepare(statement).run();
          }
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  // Get health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.prepare('SELECT 1').first();
      return true;
    } catch {
      return false;
    }
  }

  // Get query builders
  get ${entities.map(e => e.name.toLowerCase()).join(', ')}() {
    return {
${builderInstances}
    };
  }

  // Begin transaction
  async beginTransaction(): Promise<DatabaseTransaction> {
    return new DatabaseTransaction(this.db);
  }
}

export class DatabaseTransaction {
  private db: D1Database;
  private completed = false;

  constructor(db: D1Database) {
    this.db = db;
  }

  async execute(query: string, params: any[] = []): Promise<any> {
    return await this.db.prepare(query).bind(...params).first();
  }

  async executeAll(query: string, params: any[] = []): Promise<any[]> {
    return await this.db.prepare(query).bind(...params).all();
  }

  async executeRun(query: string, params: any[] = []): Promise<any> {
    return await this.db.prepare(query).bind(...params).run();
  }

  async commit(): Promise<void> {
    this.completed = true;
    // SQLite transactions are auto-committed when the connection is released
  }

  async rollback(): Promise<void> {
    this.completed = true;
    // SQLite transactions are rolled back when the connection is released
  }

  isCompleted(): boolean {
    return this.completed;
  }
}`;
  }

  /**
   * Generate initial migration
   */
  private async generateInitialMigration(entities: DatabaseEntity[]): Promise<ProjectFile[]> {
    const upSQL = this.generateSchemaSQL(entities);
    const downSQL = this.generateDownSQL(entities);

    const migrationFile: ProjectFile = {
      path: 'src/db/migrations/001_initial_schema.sql',
      content: `-- Initial Migration
-- Generated by Cocapn Database Agent
-- Date: ${new Date().toISOString()}

-- Up migration
${upSQL}

-- Down migration
${downSQL}`,
      language: 'sql',
      hash: this.generateHash(this.generateSchemaSQL(entities)),
    };

    const indexFile: ProjectFile = {
      path: 'src/db/migrations/index.ts',
      content: this.generateMigrationIndex(),
      language: 'typescript',
      hash: this.generateHash(this.generateMigrationIndex()),
    };

    return [migrationFile, indexFile];
  }

  /**
   * Generate down SQL (reverse migration)
   */
  private generateDownSQL(entities: DatabaseEntity[]): string {
    return entities.map((entity, index) => {
      const tableName = this.pluralize(entity.tableName);
      return `DROP TABLE IF EXISTS ${tableName};`;
    }).join('\n');
  }

  /**
   * Generate migration index
   */
  private generateMigrationIndex(): string {
    return `// Migration Index
// Generated by Cocapn Database Agent

export const migrations = [
  {
    id: 001,
    name: 'initial_schema',
    up: './001_initial_schema.sql',
    down: null
  }
];`;
  }

  /**
   * Generate seed files
   */
  private async generateSeedFiles(entities: DatabaseEntity[]): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    for (const entity of entities) {
      const seedFile: ProjectFile = {
        path: `src/db/seed/${entity.name.toLowerCase()}.ts`,
        content: this.generateSeedFile(entity),
        language: 'typescript',
        hash: this.generateHash(this.generateSeedFile(entity)),
      };
      files.push(seedFile);
    }

    const indexFile: ProjectFile = {
      path: 'src/db/seed/index.ts',
      content: this.generateSeedIndex(entities),
      language: 'typescript',
      hash: this.generateHash(this.generateSeedIndex(entities)),
    };
    files.push(indexFile);

    return files;
  }

  /**
   * Generate seed file
   */
  private generateSeedFile(entity: DatabaseEntity): string {
    const pluralName = this.pluralize(entity.name);
    const sampleData = this.generateSampleData(entity);

    return `// ${entity.name} Seed Data
// Generated by Cocapn Database Agent
// Date: ${new Date().toISOString()}

import { DatabaseManager } from '../db-manager';
import type { ${entity.name} } from '../${entity.name.toLowerCase()}';

export async function seed${entity.name}(db: DatabaseManager, count: number = 10): Promise<${pluralName}> {
  const ${entity.name.toLowerCase()} = db.${entity.name.toLowerCase()};

  const results: ${pluralName} = [];

  for (let i = 0; i < count; i++) {
    const seedData = ${JSON.stringify(sampleData, null, 2)} as ${entity.name};
    const created = await ${entity.name.toLowerCase()}.create(seedData);

    if (created) {
      results.push(created);
    }
  }

  return results;
}

export async function clear${entity.name}(db: DatabaseManager): Promise<void> {
  const ${entity.name.toLowerCase()} = db.${entity.name.toLowerCase()};

  // Delete all records (reset auto-increment)
  await ${entity.name.toLowerCase()}.executeRun(\`DELETE FROM ${entity.tableName}\`);
}

${pluralName} as any; // TypeScript workaround`;
  }

  /**
   * Generate sample data for seeding
   */
  private generateSampleData(entity: DatabaseEntity): any {
    const sampleData: any = {};

    entity.fields.forEach(field => {
      if (field.primaryKey && field.type === 'integer') {
        sampleData[field.name] = 'auto';
      } else if (field.name === 'id' && field.type === 'integer') {
        sampleData[field.name] = 'auto';
      } else if (field.type === 'text') {
        if (field.name.includes('email')) {
          sampleData[field.name] = \`test@example.com\`;
        } else if (field.name.includes('name')) {
          sampleData[field.name] = \`Sample ${field.name}\`;
        } else {
          sampleData[field.name] = \`Sample ${field.name} content\`;
        }
      } else if (field.type === 'integer') {
        sampleData[field.name] = 1;
      } else if (field.type === 'boolean') {
        sampleData[field.name] = true;
      } else if (field.type === 'date') {
        sampleData[field.name] = new Date().toISOString().split('T')[0];
      } else if (field.type === 'datetime') {
        sampleData[field.name] = new Date().toISOString();
      } else if (field.type === 'json') {
        sampleData[field.name] = JSON.stringify({ key: 'value' });
      }
    });

    return sampleData;
  }

  /**
   * Generate seed index
   */
  private generateSeedIndex(entities: DatabaseEntity[]): string {
    const seedFunctions = entities.map(entity =>
      `import { seed${entity.name}, clear${entity.name} } from './${entity.name.toLowerCase()}';`
    ).join('\n');

    const exportStatements = entities.map(entity =>
      `  ${entity.name.toLowerCase()(): { seed: seed${entity.name}, clear: clear${entity.name} } }`
    ).join(',\n');

    return `// Seed Index
// Generated by Cocapn Database Agent

${seedFunctions}

export const seeders = {
${exportStatements}
};

export async function seedAll(db: DatabaseManager, count: number = 10): Promise<void> {
  for (const [name, { seed }] of Object.entries(seeders)) {
    console.log(\`Seeding \${name}...\`);
    await seed(db, count);
  }
}

export async function clearAll(db: DatabaseManager): Promise<void> {
  for (const [name, { clear }] of Object.entries(seeders)) {
    console.log(\`Clearing \${name}...\`);
    await clear(db);
  }
}`;
  }

  /**
   * Generate schema README
   */
  private async generateSchemaReadme(entities: DatabaseEntity[]): Promise<ProjectFile> {
    const tableDocs = entities.map(entity =>
      this.generateTableDocumentation(entity)
    ).join('\n\n');

    const readmeContent = `# Database Schema Documentation

Generated by Cocapn Database Agent
Date: ${new Date().toISOString()}

## Overview

This document describes the database schema generated by the Cocapn platform for Cloudflare D1.

## Tables

${tableDocs}

## Relationships

${this.generateRelationshipDocumentation(entities)}

## Usage

### Query Examples

\`\`\`typescript
import { DatabaseManager } from './src/db/db-manager';

const db = new DatabaseManager(env.DB);
await db.initialize();

// Find all users
const users = await db.users().findAll();

// Create a new user
const user = await db.users().create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Find by ID
const user = await db.users().findById(1);
\`\`\`

## Cloudflare D1 Free Tier Limits

- 5GB total storage
- 100K read operations/day
- 10K write operations/day

For more information, see the [Cloudflare D1 documentation](https://developers.cloudflare.com/d1/).
`;

    return {
      path: 'src/db/README.md',
      content: readmeContent,
      language: 'markdown',
      hash: this.generateHash(readmeContent),
    };
  }

  /**
   * Generate table documentation
   */
  private generateTableDocumentation(entity: DatabaseEntity): string {
    const pluralName = this.pluralize(entity.name);
    const fields = entity.fields.map(field => {
      let fieldDoc = `- \`${field.name}\` (${field.type})`;
      if (field.required) fieldDoc += ' **required**';
      if (field.unique) fieldDoc += ' **unique**';
      if (field.primaryKey) fieldDoc += ' **primary key**';
      if (field.comment) fieldDoc += ` - ${field.comment}`;
      return fieldDoc;
    }).join('\n');

    const relationships = entity.relationships?.map(rel =>
      \`- \${rel.type} relationship with \${rel.targetTable}\`
    ).join('\n') || 'No relationships defined';

    return `### ${entity.name} (${pluralName})

**Purpose**: ${entity.comment || 'Entity for ' + pluralName}

**Fields**:
${fields}

**Relationships**:
${relationships}

**Usage**:
\`\`\`typescript
// Query ${pluralName}
const results = await db.${entity.name.toLowerCase()}().findAll();
\`\`\`
`;
  }

  /**
   * Generate relationship documentation
   */
  private generateRelationshipDocumentation(entities: DatabaseEntity[]): string {
    const relationships = entities.flatMap(entity =>
      entity.relationships?.map(rel =>
        \`- \${entity.name} -> \${rel.targetTable} (\${rel.type})\`
      ) || []
    );

    return relationships.length > 0
      ? relationships.join('\n')
      : 'No relationships defined.';
  }

  /**
   * Generate other migration types
   */
  private async generateCreateTableMigration(request: MigrationRequest): Promise<ProjectFile> {
    return {
      path: `src/db/migrations/${Date.now()}_create_${request.table}.sql`,
      content: `-- Create Table Migration
-- Name: ${request.name}
-- Date: ${new Date().toISOString()}

${request.sql}

-- Down migration
DROP TABLE IF EXISTS ${request.table};`,
      language: 'sql',
      hash: this.generateHash(request.sql || ''),
    };
  }

  private async generateAlterTableMigration(request: MigrationRequest): Promise<ProjectFile> {
    return {
      path: `src/db/migrations/${Date.now()}_alter_${request.table}.sql`,
      content: `-- Alter Table Migration
-- Name: ${request.name}
-- Date: ${new Date().toISOString()}

-- Up migration
${request.toSchema}

-- Down migration
${request.fromSchema}`,
      language: 'sql',
      hash: this.generateHash(request.toSchema || ''),
    };
  }

  private async generateDropTableMigration(request: MigrationRequest): Promise<ProjectFile> {
    return {
      path: `src/db/migrations/${Date.now()}_drop_${request.table}.sql`,
      content: `-- Drop Table Migration
-- Name: ${request.name}
-- Date: ${new Date().toISOString()}

-- Up migration
DROP TABLE IF EXISTS ${request.table};

-- Down migration (recreate table structure)
${request.sql}`,
      language: 'sql',
      hash: this.generateHash(request.sql || ''),
    };
  }

  private async generateSeedMigration(request: MigrationRequest): Promise<ProjectFile> {
    return {
      path: `src/db/migrations/${Date.now()}_seed_${request.table}.sql`,
      content: `-- Seed Migration
-- Name: ${request.name}
-- Date: ${new Date().toISOString()}

${request.sql}`,
      language: 'sql',
      hash: this.generateHash(request.sql || ''),
    };
  }

  private async generateSQLSeedFile(request: SeedRequest): Promise<ProjectFile> {
    const insertStatements = request.data?.map(item => {
      const values = Object.values(item).map(value => {
        if (typeof value === 'string') return `'${value}'`;
        return value;
      }).join(', ');
      return `INSERT INTO ${request.table} VALUES (${values});`;
    }).join('\n') || '';

    return {
      path: `src/db/seed/${request.table}.sql`,
      content: `-- Seed Data for ${request.table}
-- Generated by Cocapn Database Agent
-- Date: ${new Date().toISOString()}

${insertStatements}`,
      language: 'sql',
      hash: this.generateHash(insertStatements),
    };
  }

  private async generateTypeScriptSeedFile(request: SeedRequest): Promise<ProjectFile> {
    const seedContent = request.data?.map(item => JSON.stringify(item, null, 2)).join(',\n') || '';

    return {
      path: `src/db/seed/${request.table}.ts`,
      content: `// Seed Data for ${request.table}
// Generated by Cocapn Database Agent
// Date: ${new Date().toISOString()}

export const seedData = [
${seedContent}
];`,
      language: 'typescript',
      hash: this.generateHash(seedContent),
    };
  }

  // State management methods

  private async updateState(
    status: AgentState['status'],
    progress: number,
    currentTask?: string
  ): Promise<void> {
    this.state.status = status;
    this.state.progress = progress;
    this.state.currentTask = currentTask;

    await this.config.stateManager.updateAgent(this.config.sessionId, this.state);
    await this.reportProgress();
  }

  private async reportProgress(): Promise<void> {
    await fetch(`${this.config.coordinatorUrl}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.config.sessionId,
        agentId: this.config.agentId,
        state: this.state,
      }),
    });
  }

  // File locking methods

  private async acquireLock(filePath: string): Promise<boolean> {
    const acquired = await this.config.stateManager.acquireLock(
      this.config.sessionId,
      filePath,
      this.config.agentId
    );

    if (acquired) {
      this.lockedFiles.add(filePath);
    }

    return acquired;
  }

  private async releaseLock(filePath: string): Promise<void> {
    await this.config.stateManager.releaseLock(this.config.sessionId, filePath);
    this.lockedFiles.delete(filePath);
  }

  private async releaseAllLocks(): Promise<void> {
    for (const filePath of this.lockedFiles) {
      await this.releaseLock(filePath);
    }
  }

  // Utility methods

  private mapTypeToSQL(type: FieldType): string {
    const typeMap = {
      text: 'TEXT',
      integer: 'INTEGER',
      real: 'REAL',
      blob: 'BLOB',
      date: 'DATE',
      datetime: 'DATETIME',
      boolean: 'BOOLEAN',
      json: 'JSON',
    };
    return typeMap[type] || 'TEXT';
  }

  private mapTypeToTypeScript(type: FieldType): string {
    const typeMap = {
      text: 'string',
      integer: 'number',
      real: 'number',
      blob: 'string',
      date: 'string',
      datetime: 'string',
      boolean: 'boolean',
      json: 'any',
    };
    return typeMap[type] || 'string';
  }

  private pluralize(str: string): string {
    if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
    if (str.endsWith('s')) return str + 'es';
    if (str.endsWith('x')) return str + 'es';
    if (str.endsWith('z')) return str + 'es';
    return str + 's';
  }

  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get current agent state
   */
  async getState(): Promise<AgentState> {
    return { ...this.state };
  }

  /**
   * Complete current task
   */
  async markDone(): Promise<void> {
    await this.updateState('idle', 100, undefined);
  }
}