/**
 * Schema Generator
 * Generates database schemas, TypeScript types, GraphQL schemas, Protobuf definitions, etc.
 */

import type { Language, SchemaOptions, GeneratedSchema, GeneratedFile, GeneratedType, TableSchema, ColumnSchema, Specification, ModelSpec } from '../types/index.js';
import type { FileManager } from '../utils/file-manager.js';

/**
 * Schema Generator class
 */
export class SchemaGenerator {
  private fileManager: FileManager;

  constructor() {
    this.fileManager = new FileManager();
  }

  /**
   * Generate schema from specification
   */
  async generate(options: SchemaOptions): Promise<GeneratedSchema> {
    const spec = options.spec;

    // Generate based on schema type
    switch (options.schemaType) {
      case 'database':
        return this.generateDatabaseSchema(spec, options);

      case 'typescript':
        return this.generateTypeScriptSchema(spec, options);

      case 'graphql':
        return this.generateGraphQLSchema(spec, options);

      case 'protobuf':
        return this.generateProtobufSchema(spec, options);

      case 'jsonSchema':
        return this.generateJSONSchemaSchema(spec, options);

      case 'openapi':
        return this.generateOpenAPISchema(spec, options);

      case 'migration':
        return this.generateMigrationSchema(spec, options);

      default:
        throw new Error(`Unsupported schema type: ${options.schemaType}`);
    }
  }

  /**
   * Generate database schema
   */
  private generateDatabaseSchema(spec: Specification, options: SchemaOptions): GeneratedSchema {
    const tables: TableSchema[] = [];
    const files: GeneratedFile[] = [];

    for (const model of spec.models || []) {
      const table = this.generateTableFromModel(model, options);
      tables.push(table);
    }

    // Generate SQL file
    const sql = this.generateSQL(tables, options);
    files.push({
      path: 'schema.sql',
      content: sql,
      language: Language.TypeScript
    });

    // Generate migration files if requested
    if (options.generateMigrations) {
      const migrations = this.generateMigrations(tables, options);
      files.push(...migrations);
    }

    return {
      type: 'database',
      language: options.language,
      tables,
      files
    };
  }

  /**
   * Generate TypeScript schema
   */
  private generateTypeScriptSchema(spec: Specification, options: SchemaOptions): GeneratedSchema {
    const types: GeneratedType[] = [];
    const files: GeneratedFile[] = [];

    for (const model of spec.models || []) {
      const type = this.generateTypeFromModel(model, options);
      types.push(type);
    }

    // Generate types file
    const typesCode = types.map(t => t.definition).join('\n\n');
    files.push({
      path: 'types.ts',
      content: typesCode,
      language: Language.TypeScript
    });

    return {
      type: 'typescript',
      language: Language.TypeScript,
      types,
      files
    };
  }

  /**
   * Generate GraphQL schema
   */
  private generateGraphQLSchema(spec: Specification, options: SchemaOptions): GeneratedSchema {
    const types: GeneratedType[] = [];
    const files: GeneratedFile[] = [];

    // Generate GraphQL types
    for (const model of spec.models || []) {
      const graphqlType = this.generateGraphQLTypeFromModel(model);
      types.push(graphqlType);
    }

    // Generate schema file
    const schemaCode = this.generateGraphQLSchemaCode(types, spec);
    files.push({
      path: 'schema.graphql',
      content: schemaCode,
      language: Language.TypeScript
    });

    return {
      type: 'graphql',
      language: Language.TypeScript,
      types,
      files
    };
  }

  /**
   * Generate Protobuf schema
   */
  private generateProtobufSchema(spec: Specification, options: SchemaOptions): GeneratedSchema {
    const types: GeneratedType[] = [];
    const files: GeneratedFile[] = [];

    for (const model of spec.models || []) {
      const protoType = this.generateProtoTypeFromModel(model);
      types.push(protoType);
    }

    // Generate proto file
    const protoCode = this.generateProtoFile(types, spec);
    files.push({
      path: 'schema.proto',
      content: protoCode,
      language: Language.TypeScript
    });

    return {
      type: 'protobuf',
      language: Language.TypeScript,
      types,
      files
    };
  }

  /**
   * Generate JSON Schema
   */
  private generateJSONSchemaSchema(spec: Specification, options: SchemaOptions): GeneratedSchema {
    const types: GeneratedType[] = [];
    const files: GeneratedFile[] = [];

    for (const model of spec.models || []) {
      const jsonSchema = this.generateJSONSchemaFromModel(model);
      types.push(jsonSchema);
    }

    // Generate schemas file
    const schemasCode = types.map(t => t.definition).join('\n\n');
    files.push({
      path: 'schemas.json',
      content: schemasCode,
      language: Language.TypeScript
    });

    return {
      type: 'jsonSchema',
      language: Language.TypeScript,
      types,
      files
    };
  }

  /**
   * Generate OpenAPI schema
   */
  private generateOpenAPISchema(spec: Specification, options: SchemaOptions): GeneratedSchema {
    const files: GeneratedFile[] = [];

    const openapiSpec = {
      openapi: '3.0.0',
      info: {
        title: spec.name,
        version: spec.version,
        description: spec.description
      },
      paths: {},
      components: {
        schemas: {}
      }
    };

    // Add schemas
    for (const model of spec.models || []) {
      const schema = this.generateOpenAPISchemaFromModel(model);
      openapiSpec.components.schemas[model.name] = schema;
    }

    files.push({
      path: 'openapi.json',
      content: JSON.stringify(openapiSpec, null, 2),
      language: Language.TypeScript
    });

    return {
      type: 'openapi',
      language: Language.TypeScript,
      files
    };
  }

  /**
   * Generate migration schema
   */
  private generateMigrationSchema(spec: Specification, options: SchemaOptions): GeneratedSchema {
    const tables: TableSchema[] = [];
    const migrations: any[] = [];
    const files: GeneratedFile[] = [];

    for (const model of spec.models || []) {
      const table = this.generateTableFromModel(model, options);
      tables.push(table);
    }

    // Generate migration files
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const migration = this.generateMigration(table, i, options);
      migrations.push(migration);

      files.push({
        path: `migrations/${i + 1}_${this.toSnakeCase(table.name)}.sql`,
        content: migration.up,
        language: Language.TypeScript
      });
    }

    return {
      type: 'migration',
      language: Language.TypeScript,
      tables,
      migrations,
      files
    };
  }

  /**
   * Generate table from model
   */
  private generateTableFromModel(model: ModelSpec, options: SchemaOptions): TableSchema {
    const columns: ColumnSchema[] = [];

    for (const field of model.fields) {
      columns.push({
        name: this.formatColumnName(field.name, options),
        type: this.mapFieldTypeToDatabase(field.type, options.database || 'postgresql'),
        nullable: field.nullable,
        primaryKey: field.primaryKey || false,
        unique: field.unique || false,
        autoIncrement: field.name === 'id',
        defaultValue: field.defaultValue,
        comment: field.description
      });
    }

    return {
      name: this.formatTableName(model.name, options),
      columns,
      indexes: model.indexes || [],
      foreignKeys: model.fields
        .filter(f => f.foreignKey)
        .map(f => f.foreignKey!)
        .filter(Boolean),
      comment: model.description
    };
  }

  /**
   * Generate type from model
   */
  private generateTypeFromModel(model: ModelSpec, options: SchemaOptions): GeneratedType {
    const properties = model.fields.map(f => {
      const nullable = f.nullable ? '?' : '';
      const optional = f.nullable ? ' | null' : '';
      return `  ${f.name}${nullable}: ${this.mapTypeToTypeScript(f.type)}${optional};`;
    }).join('\n');

    return {
      name: model.name,
      definition: `export interface ${model.name} {
${properties}
}`,
      description: model.description
    };
  }

  /**
   * Generate GraphQL type from model
   */
  private generateGraphQLTypeFromModel(model: ModelSpec): GeneratedType {
    const fields = model.fields.map(f => {
      const nullable = f.nullable ? '' : '!';
      return `  ${f.name}: ${this.mapTypeToGraphQL(f.type)}${nullable}`;
    }).join('\n');

    return {
      name: model.name,
      definition: `type ${model.name} {
${fields}
}`,
      description: model.description
    };
  }

  /**
   * Generate Protobuf type from model
   */
  private generateProtoTypeFromModel(model: ModelSpec): GeneratedType {
    const fields = model.fields.map((f, i) => {
      const protoType = this.mapTypeToProto(f.type);
      const nullable = !f.nullable ? '' // Proto3 doesn't have required
        : '';
      return `  ${protoType} ${f.name} = ${i + 1};`;
    }).join('\n');

    return {
      name: model.name,
      definition: `message ${model.name} {
${fields}
}`,
      description: model.description
    };
  }

  /**
   * Generate JSON Schema from model
   */
  private generateJSONSchemaFromModel(model: ModelSpec): GeneratedType {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const field of model.fields) {
      properties[field.name] = {
        type: this.mapTypeToJSONSchema(field.type),
        description: field.description
      };

      if (!field.nullable) {
        required.push(field.name);
      }
    }

    return {
      name: model.name,
      definition: JSON.stringify({
        $id: `#/schemas/${model.name}`,
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: model.name,
        description: model.description,
        type: 'object',
        properties,
        required
      }, null, 2),
      description: model.description
    };
  }

  /**
   * Generate OpenAPI schema from model
   */
  private generateOpenAPISchemaFromModel(model: ModelSpec): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const field of model.fields) {
      properties[field.name] = {
        type: this.mapTypeToJSONSchema(field.type),
        description: field.description
      };

      if (!field.nullable) {
        required.push(field.name);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };
  }

  /**
   * Generate SQL
   */
  private generateSQL(tables: TableSchema[], options: SchemaOptions): string {
    let sql = '';

    for (const table of tables) {
      sql += `-- Table: ${table.name}\n`;
      sql += `CREATE TABLE ${table.name} (\n`;

      const columns = table.columns.map(col => {
        let colDef = `  ${col.name} ${col.type}`;

        if (col.primaryKey) {
          colDef += ' PRIMARY KEY';
        }

        if (col.unique && !col.primaryKey) {
          colDef += ' UNIQUE';
        }

        if (col.autoIncrement && options.database === 'mysql') {
          colDef += ' AUTO_INCREMENT';
        }

        if (!col.nullable && !col.primaryKey) {
          colDef += ' NOT NULL';
        }

        if (col.defaultValue !== undefined) {
          colDef += ` DEFAULT ${typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue}`;
        }

        if (col.comment) {
          colDef += ` COMMENT '${col.comment}'`;
        }

        return colDef;
      });

      sql += columns.join(',\n');
      sql += '\n);\n\n';

      // Add indexes
      if (table.indexes && table.indexes.length > 0) {
        for (const index of table.indexes) {
          sql += `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${index.name} ON ${table.name} (${index.fields.join(', ')});\n`;
        }
        sql += '\n';
      }

      // Add foreign keys
      if (table.foreignKeys && table.foreignKeys.length > 0) {
        for (const fk of table.foreignKeys) {
          sql += `ALTER TABLE ${table.name} ADD FOREIGN KEY (${fk.column}) REFERENCES ${fk.table}(${fk.column});\n`;
        }
        sql += '\n';
      }
    }

    return sql;
  }

  /**
   * Generate migration
   */
  private generateMigration(table: TableSchema, version: number, options: SchemaOptions): any {
    const up = this.generateSQL([table], options);
    const down = `DROP TABLE IF EXISTS ${table.name};\n`;

    return {
      name: table.name,
      version: `00${version + 1}`,
      up,
      down,
      description: `Create ${table.name} table`,
      timestamp: Date.now()
    };
  }

  /**
   * Generate migrations
   */
  private generateMigrations(tables: TableSchema[], options: SchemaOptions): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const migration = this.generateMigration(table, i, options);

      files.push({
        path: `migrations/${migration.version}_${this.toSnakeCase(table.name)}.sql`,
        content: migration.up,
        language: Language.TypeScript
      });
    }

    return files;
  }

  /**
   * Generate GraphQL schema code
   */
  private generateGraphQLSchemaCode(types: GeneratedType[], spec: Specification): string {
    let schema = `# ${spec.name}\n`;
    schema += `# ${spec.description}\n\n`;

    schema += types.map(t => t.definition).join('\n\n');

    // Add Query type
    schema += '\n\ntype Query {\n';
    schema += types.map(t => `  # Query for ${t.name}\n`).join('\n');
    schema += '}\n';

    return schema;
  }

  /**
   * Generate proto file
   */
  private generateProtoFile(types: GeneratedType[], spec: Specification): string {
    let proto = `syntax = "proto3";\n\n`;
    proto += `package ${spec.name.toLowerCase()};\n\n`;
    proto += `// ${spec.description}\n\n`;

    proto += types.map(t => t.definition).join('\n\n');

    return proto;
  }

  /**
   * Map field type to database type
   */
  private mapFieldTypeToDatabase(type: string, database: string): string {
    const typeMap: Record<string, Record<string, string>> = {
      postgresql: {
        string: 'VARCHAR(255)',
        text: 'TEXT',
        integer: 'INTEGER',
        number: 'NUMERIC',
        boolean: 'BOOLEAN',
        date: 'TIMESTAMP',
        datetime: 'TIMESTAMP',
        json: 'JSONB',
        uuid: 'UUID',
        email: 'VARCHAR(255)',
        url: 'VARCHAR(2048)'
      },
      mysql: {
        string: 'VARCHAR(255)',
        text: 'TEXT',
        integer: 'INT',
        number: 'DECIMAL(10,2)',
        boolean: 'TINYINT(1)',
        date: 'DATETIME',
        datetime: 'DATETIME',
        json: 'JSON',
        uuid: 'CHAR(36)',
        email: 'VARCHAR(255)',
        url: 'VARCHAR(2048)'
      },
      sqlite: {
        string: 'TEXT',
        text: 'TEXT',
        integer: 'INTEGER',
        number: 'REAL',
        boolean: 'INTEGER',
        date: 'TEXT',
        datetime: 'TEXT',
        json: 'TEXT',
        uuid: 'TEXT',
        email: 'TEXT',
        url: 'TEXT'
      },
      mongodb: {
        string: 'String',
        text: 'String',
        integer: 'Number',
        number: 'Number',
        boolean: 'Boolean',
        date: 'Date',
        datetime: 'Date',
        json: 'Object',
        uuid: 'String',
        email: 'String',
        url: 'String'
      }
    };

    return typeMap[database]?.[type] || typeMap.postgresql?.[type] || 'VARCHAR(255)';
  }

  /**
   * Map type to TypeScript
   */
  private mapTypeToTypeScript(type: string): string {
    const tsTypeMap: Record<string, string> = {
      string: 'string',
      text: 'string',
      integer: 'number',
      number: 'number',
      boolean: 'boolean',
      date: 'Date',
      datetime: 'Date',
      json: 'any',
      uuid: 'string',
      email: 'string',
      url: 'string'
    };

    return tsTypeMap[type] || 'any';
  }

  /**
   * Map type to GraphQL
   */
  private mapTypeToGraphQL(type: string): string {
    const graphqlTypeMap: Record<string, string> = {
      string: 'String',
      text: 'String',
      integer: 'Int',
      number: 'Float',
      boolean: 'Boolean',
      date: 'DateTime',
      datetime: 'DateTime',
      json: 'JSON',
      uuid: 'ID',
      email: 'String',
      url: 'String'
    };

    return graphqlTypeMap[type] || 'String';
  }

  /**
   * Map type to Proto
   */
  private mapTypeToProto(type: string): string {
    const protoTypeMap: Record<string, string> = {
      string: 'string',
      text: 'string',
      integer: 'int32',
      number: 'double',
      boolean: 'bool',
      date: 'int64',
      datetime: 'int64',
      json: 'string',
      uuid: 'string',
      email: 'string',
      url: 'string'
    };

    return protoTypeMap[type] || 'string';
  }

  /**
   * Map type to JSON Schema
   */
  private mapTypeToJSONSchema(type: string): string {
    const jsonSchemaTypeMap: Record<string, string> = {
      string: 'string',
      text: 'string',
      integer: 'integer',
      number: 'number',
      boolean: 'boolean',
      date: 'string',
      datetime: 'string',
      json: 'object',
      uuid: 'string',
      email: 'string',
      url: 'string'
    };

    return jsonSchemaTypeMap[type] || 'string';
  }

  /**
   * Format column name
   */
  private formatColumnName(name: string, options: SchemaOptions): string {
    switch (options.namingConvention) {
      case 'snake_case':
        return this.toSnakeCase(name);
      case 'camelCase':
        return name;
      case 'PascalCase':
        return this.toPascalCase(name);
      default:
        return this.toSnakeCase(name);
    }
  }

  /**
   * Format table name
   */
  private formatTableName(name: string, options: SchemaOptions): string {
    return this.formatColumnName(name, options);
  }

  /**
   * Convert to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.replace(/(^|_)([a-z])/g, (_, p1, p2) => p2.toUpperCase());
  }
}
