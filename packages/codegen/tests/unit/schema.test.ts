/**
 * Unit tests for Schema Generator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaGenerator } from '../../src/schema/generator';
import { Language, Specification } from '../../src/types/index';

describe('SchemaGenerator', () => {
  let generator: SchemaGenerator;

  beforeEach(() => {
    generator = new SchemaGenerator();
  });

  describe('generate database schema', () => {
    it('should generate PostgreSQL schema', async () => {
      const spec: Specification = {
        name: 'Test API',
        description: 'Test API for schema generation',
        version: '1.0.0',
        requirements: [],
        models: [
          {
            name: 'User',
            description: 'User model',
            fields: [
              { name: 'id', type: 'integer', nullable: false, primaryKey: true },
              { name: 'email', type: 'string', nullable: false, unique: true },
              { name: 'name', type: 'string', nullable: true }
            ]
          }
        ]
      };

      const result = await generator.generate({
        spec,
        schemaType: 'database',
        language: Language.TypeScript,
        outputPath: '/tmp/schema.sql',
        database: 'postgresql'
      });

      expect(result.type).toBe('database');
      expect(result.tables).toBeDefined();
      expect(result.tables?.length).toBe(1);
      expect(result.tables?.[0].name).toBe('user');
      expect(result.tables?.[0].columns.length).toBe(3);
    });

    it('should generate MySQL schema', async () => {
      const spec: Specification = {
        name: 'Test API',
        description: 'Test API',
        version: '1.0.0',
        requirements: [],
        models: [
          {
            name: 'Product',
            description: 'Product model',
            fields: [
              { name: 'id', type: 'integer', nullable: false, primaryKey: true },
              { name: 'name', type: 'string', nullable: false }
            ]
          }
        ]
      };

      const result = await generator.generate({
        spec,
        schemaType: 'database',
        language: Language.TypeScript,
        outputPath: '/tmp/schema.sql',
        database: 'mysql'
      });

      expect(result.tables?.[0].columns[0].type).toContain('INT');
    });

    it('should generate foreign keys', async () => {
      const spec: Specification = {
        name: 'Test API',
        description: 'Test API',
        version: '1.0.0',
        requirements: [],
        models: [
          {
            name: 'Order',
            description: 'Order model',
            fields: [
              { name: 'id', type: 'integer', nullable: false, primaryKey: true },
              {
                name: 'userId',
                type: 'integer',
                nullable: false,
                foreignKey: {
                  table: 'users',
                  column: 'id',
                  onDelete: 'CASCADE'
                }
              }
            ]
          }
        ]
      };

      const result = await generator.generate({
        spec,
        schemaType: 'database',
        language: Language.TypeScript,
        outputPath: '/tmp/schema.sql',
        database: 'postgresql'
      });

      expect(result.tables?.[0].foreignKeys).toBeDefined();
      expect(result.tables?.[0].foreignKeys?.length).toBe(1);
    });
  });

  describe('generate TypeScript schema', () => {
    it('should generate TypeScript interfaces', async () => {
      const spec: Specification = {
        name: 'Test API',
        description: 'Test API',
        version: '1.0.0',
        requirements: [],
        models: [
          {
            name: 'User',
            description: 'User model',
            fields: [
              { name: 'id', type: 'integer', nullable: false },
              { name: 'email', type: 'string', nullable: false },
              { name: 'name', type: 'string', nullable: true }
            ]
          }
        ]
      };

      const result = await generator.generate({
        spec,
        schemaType: 'typescript',
        language: Language.TypeScript,
        outputPath: '/tmp/types.ts'
      });

      expect(result.type).toBe('typescript');
      expect(result.types).toBeDefined();
      expect(result.types?.length).toBe(1);
      expect(result.types?.[0].name).toBe('User');
      expect(result.types?.[0].definition).toContain('export interface User');
    });
  });

  describe('generate GraphQL schema', () => {
    it('should generate GraphQL types', async () => {
      const spec: Specification = {
        name: 'Test API',
        description: 'Test API',
        version: '1.0.0',
        requirements: [],
        models: [
          {
            name: 'User',
            description: 'User model',
            fields: [
              { name: 'id', type: 'integer', nullable: false },
              { name: 'email', type: 'string', nullable: false }
            ]
          }
        ]
      };

      const result = await generator.generate({
        spec,
        schemaType: 'graphql',
        language: Language.TypeScript,
        outputPath: '/tmp/schema.graphql'
      });

      expect(result.type).toBe('graphql');
      expect(result.types).toBeDefined();
      expect(result.types?.[0].definition).toContain('type User');
    });
  });

  describe('generate Protobuf schema', () => {
    it('should generate Protobuf messages', async () => {
      const spec: Specification = {
        name: 'Test API',
        description: 'Test API',
        version: '1.0.0',
        requirements: [],
        models: [
          {
            name: 'User',
            description: 'User model',
            fields: [
              { name: 'id', type: 'integer', nullable: false },
              { name: 'email', type: 'string', nullable: false }
            ]
          }
        ]
      };

      const result = await generator.generate({
        spec,
        schemaType: 'protobuf',
        language: Language.TypeScript,
        outputPath: '/tmp/schema.proto'
      });

      expect(result.type).toBe('protobuf');
      expect(result.types?.[0].definition).toContain('message User');
    });
  });

  describe('generate JSON Schema', () => {
    it('should generate JSON schemas', async () => {
      const spec: Specification = {
        name: 'Test API',
        description: 'Test API',
        version: '1.0.0',
        requirements: [],
        models: [
          {
            name: 'User',
            description: 'User model',
            fields: [
              { name: 'id', type: 'integer', nullable: false },
              { name: 'email', type: 'string', nullable: false }
            ]
          }
        ]
      };

      const result = await generator.generate({
        spec,
        schemaType: 'jsonSchema',
        language: Language.TypeScript,
        outputPath: '/tmp/schemas.json'
      });

      expect(result.type).toBe('jsonSchema');
      expect(result.types?.[0].definition).toContain('$schema');
    });
  });

  describe('generate migration', () => {
    it('should generate migration files', async () => {
      const spec: Specification = {
        name: 'Test API',
        description: 'Test API',
        version: '1.0.0',
        requirements: [],
        models: [
          {
            name: 'User',
            description: 'User model',
            fields: [
              { name: 'id', type: 'integer', nullable: false, primaryKey: true },
              { name: 'email', type: 'string', nullable: false }
            ]
          }
        ]
      };

      const result = await generator.generate({
        spec,
        schemaType: 'migration',
        language: Language.TypeScript,
        outputPath: '/tmp/migrations',
        generateMigrations: true
      });

      expect(result.type).toBe('migration');
      expect(result.migrations).toBeDefined();
      expect(result.migrations?.length).toBe(1);
    });
  });

  describe('type mapping', () => {
    it('should map types correctly for different databases', async () => {
      const spec: Specification = {
        name: 'Test API',
        description: 'Test API',
        version: '1.0.0',
        requirements: [],
        models: [
          {
            name: 'TestModel',
            description: 'Test model',
            fields: [
              { name: 'stringField', type: 'string', nullable: false },
              { name: 'intField', type: 'integer', nullable: false },
              { name: 'boolField', type: 'boolean', nullable: false },
              { name: 'dateField', type: 'date', nullable: false }
            ]
          }
        ]
      };

      const pgResult = await generator.generate({
        spec,
        schemaType: 'database',
        language: Language.TypeScript,
        outputPath: '/tmp/pg.sql',
        database: 'postgresql'
      });

      expect(pgResult.tables?.[0].columns[0].type).toBe('VARCHAR(255)');
      expect(pgResult.tables?.[0].columns[1].type).toBe('INTEGER');
      expect(pgResult.tables?.[0].columns[2].type).toBe('BOOLEAN');
      expect(pgResult.tables?.[0].columns[3].type).toBe('TIMESTAMP');
    });
  });
});
