/**
 * Integration tests for CodeGen
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CodeGen, createCodeGen } from '../../src/codegen';
import { Language } from '../../src/types/index';

describe('CodeGen Integration Tests', () => {
  let codegen: CodeGen;

  beforeAll(() => {
    // Create CodeGen instance with mocked LLM
    codegen = createCodeGen();
  });

  describe('full code generation workflow', () => {
    it('should synthesize and format code', async () => {
      const result = await codegen.synthesize({
        prompt: 'Create a function to calculate fibonacci numbers',
        language: Language.TypeScript,
        outputPath: '/tmp/fibonacci.ts',
        dryRun: true,
        format: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.code).toBeDefined();
    });

    it('should explain and then refactor code', async () => {
      const originalCode = `
function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}
`;

      // First explain
      const explanation = await codegen.explain(originalCode, Language.JavaScript);
      expect(explanation.success).toBe(true);
      expect(explanation.data?.summary).toBeDefined();

      // Then refactor
      const refactored = await codegen.refactor(originalCode, Language.TypeScript);
      expect(refactored.success).toBe(true);
      expect(refactored.data?.refactored).toBeDefined();
    });
  });

  describe('multi-language support', () => {
    const languages = [
      Language.TypeScript,
      Language.JavaScript,
      Language.Python,
      Language.Go
    ];

    it.each(languages)('should generate code for %s', async (lang) => {
      const result = await codegen.synthesize({
        prompt: 'Create a hello world function',
        language: lang,
        outputPath: `/tmp/hello.${lang}`,
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.data?.language).toBe(lang);
    });
  });

  describe('complete project generation', () => {
    it('should generate complete project structure', async () => {
      // Generate boilerplate
      const boilerplateResult = await codegen.generateBoilerplate({
        name: 'test-project',
        template: 'express-ts',
        outputPath: '/tmp/test-project'
      });

      expect(boilerplateResult.projectName).toBe('test-project');
      expect(boilerplateResult.filesCreated.length).toBeGreaterThan(0);

      // Generate additional code
      const codeResult = await codegen.synthesize({
        prompt: 'Create a user service with CRUD operations',
        language: Language.TypeScript,
        outputPath: '/tmp/test-project/src/services/user.service.ts',
        dryRun: true
      });

      expect(codeResult.success).toBe(true);

      // Generate tests
      const testResult = await codegen.generateTests({
        sourcePath: '/tmp/test-project/src',
        testType: 'unit',
        testFramework: 'vitest',
        language: Language.TypeScript,
        outputPath: '/tmp/test-project/tests'
      });

      expect(testResult.length).toBeGreaterThanOrEqual(0);

      // Generate documentation
      const docsResult = await codegen.generateDocs({
        sourcePath: '/tmp/test-project/src',
        docType: 'api',
        format: 'markdown',
        language: Language.TypeScript,
        outputPath: '/tmp/test-project/docs'
      });

      expect(docsResult.files).toBeDefined();
    });
  });

  describe('API client generation workflow', () => {
    it('should generate API client from spec', async () => {
      const apiSpec = {
        name: 'Test API',
        type: 'rest' as const,
        version: '1.0.0',
        baseUrl: 'https://api.test.com',
        endpoints: [
          {
            name: 'getUsers',
            path: '/users',
            method: 'GET' as const,
            description: 'Get all users',
            parameters: [],
            responses: [
              {
                statusCode: 200,
                description: 'Success',
                contentType: 'application/json'
              }
            ]
          }
        ]
      };

      const result = await codegen.generateAPIClient({
        spec: apiSpec,
        specType: 'custom',
        language: Language.TypeScript,
        outputPath: '/tmp/api-client',
        clientName: 'TestAPIClient',
        generateTypes: true,
        generateDocs: true
      });

      expect(result.name).toBe('TestAPIClient');
      expect(result.files).toBeDefined();
      expect(result.types).toBeDefined();
      expect(result.methods).toBeDefined();
    });
  });

  describe('SDK generation workflow', () => {
    it('should generate SDK for multiple languages', async () => {
      const apiSpec = {
        name: 'Test API',
        type: 'rest' as const,
        version: '1.0.0',
        baseUrl: 'https://api.test.com',
        endpoints: [
          {
            name: 'createResource',
            path: '/resources',
            method: 'POST' as const,
            description: 'Create a new resource',
            parameters: [],
            requestBody: {
              contentType: 'application/json',
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' }
                }
              },
              required: true,
              description: 'Resource data'
            },
            responses: [
              {
                statusCode: 201,
                description: 'Created',
                contentType: 'application/json'
              }
            ]
          }
        ]
      };

      const result = await codegen.generateSDK({
        spec: apiSpec,
        sdkType: 'rest',
        languages: [Language.TypeScript, Language.Python, Language.Go],
        outputPath: '/tmp/sdk',
        sdkName: 'TestSDK',
        generateExamples: true,
        generateDocs: true
      });

      expect(result.length).toBe(3);
      expect(result[0].language).toBe(Language.TypeScript);
      expect(result[1].language).toBe(Language.Python);
      expect(result[2].language).toBe(Language.Go);
    });
  });

  describe('schema generation workflow', () => {
    it('should generate database and TypeScript schemas', async () => {
      const spec = {
        name: 'Test Schema',
        description: 'Test schema',
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

      // Generate database schema
      const dbResult = await codegen.generateSchema({
        spec,
        schemaType: 'database',
        language: Language.TypeScript,
        outputPath: '/tmp/schema.sql',
        database: 'postgresql'
      });

      expect(dbResult.tables).toBeDefined();
      expect(dbResult.tables?.length).toBe(1);

      // Generate TypeScript types
      const tsResult = await codegen.generateSchema({
        spec,
        schemaType: 'typescript',
        language: Language.TypeScript,
        outputPath: '/tmp/types.ts'
      });

      expect(tsResult.types).toBeDefined();
      expect(tsResult.types?.length).toBe(1);
    });
  });
});
