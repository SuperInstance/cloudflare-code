/**
 * Basic Usage Examples for ClaudeFlare CodeGen
 */

import { CodeGen, createCodeGen, Language } from '../src/index';

// Initialize CodeGen
const codegen = createCodeGen();

async function basicExamples() {
  console.log('=== ClaudeFlare CodeGen Basic Examples ===\n');

  // Example 1: Generate code from natural language
  console.log('1. Code Synthesis:');
  const synthesisResult = await codegen.synthesize({
    prompt: 'Create a function to validate email addresses',
    language: Language.TypeScript,
    outputPath: './examples/output/validator.ts',
    dryRun: true,
    format: true,
    includeComments: true
  });

  if (synthesisResult.success && synthesisResult.data) {
    console.log('Generated code:');
    console.log(synthesisResult.data.code);
    console.log('Explanation:', synthesisResult.data.explanation);
  }

  // Example 2: Refactor existing code
  console.log('\n2. Code Refactoring:');
  const refactorResult = await codegen.refactor(
    `function calc(a,b){return a+b;}`,
    Language.TypeScript,
    ['add type annotations', 'improve naming']
  );

  if (refactorResult.success && refactorResult.data) {
    console.log('Original:', refactorResult.data.original);
    console.log('Refactored:', refactorResult.data.refactored);
    console.log('Improvements:', refactorResult.data.improvements);
  }

  // Example 3: Code completion
  console.log('\n3. Code Completion:');
  const completionResult = await codegen.complete(
    'function calculateSum(numbers: number[]): number {',
    Language.TypeScript,
    { line: 1, column: 50 }
  );

  if (completionResult.success && completionResult.data) {
    console.log('Completion:', completionResult.data.completion);
  }

  // Example 4: Code explanation
  console.log('\n4. Code Explanation:');
  const explanationResult = await codegen.explain(
    `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`,
    Language.TypeScript,
    'detailed'
  );

  if (explanationResult.success && explanationResult.data) {
    console.log('Summary:', explanationResult.data.summary);
    console.log('Complexity:', explanationResult.data.complexity);
    console.log('Patterns:', explanationResult.data.patterns);
  }
}

async function boilerplateExample() {
  console.log('\n=== Project Boilerplate Generation ===\n');

  const result = await codegen.generateBoilerplate({
    name: 'my-express-app',
    template: 'express-ts',
    outputPath: './examples/output/my-express-app',
    features: ['authentication', 'logging', 'error handling'],
    config: {
      gitInit: false,
      installDeps: false,
      createReadme: true,
      createLicense: true,
      linter: true,
      formatter: true,
      tests: true
    }
  });

  console.log(`Project: ${result.projectName}`);
  console.log(`Files created: ${result.filesCreated.length}`);
  console.log('Commands:');
  result.commands.forEach(cmd => console.log(`  ${cmd}`));
  console.log('Next steps:');
  result.nextSteps.forEach(step => console.log(`  ${step}`));
}

async function apiClientExample() {
  console.log('\n=== API Client Generation ===\n');

  const apiSpec = {
    name: 'UserAPI',
    type: 'rest' as const,
    version: '1.0.0',
    baseUrl: 'https://api.example.com',
    endpoints: [
      {
        name: 'getUsers',
        path: '/users',
        method: 'GET' as const,
        description: 'Get all users',
        parameters: [
          {
            name: 'page',
            type: 'integer',
            location: 'query' as const,
            required: false,
            description: 'Page number'
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Success',
            contentType: 'application/json'
          }
        ]
      },
      {
        name: 'createUser',
        path: '/users',
        method: 'POST' as const,
        description: 'Create a new user',
        requestBody: {
          contentType: 'application/json',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' }
            }
          },
          required: true,
          description: 'User data'
        },
        responses: [
          {
            statusCode: 201,
            description: 'User created',
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
    outputPath: './examples/output/user-api-client',
    clientName: 'UserAPIClient',
    generateTypes: true,
    generateDocs: true,
    generateMocks: true
  });

  console.log(`Client: ${result.name}`);
  console.log(`Files: ${result.files.length}`);
  console.log(`Types: ${result.types.length}`);
  console.log(`Methods: ${result.methods.length}`);
  console.log('\nMethods:');
  result.methods.forEach(method => {
    console.log(`  - ${method.signature}`);
  });
}

async function schemaExample() {
  console.log('\n=== Schema Generation ===\n');

  const spec = {
    name: 'ECommerceSchema',
    description: 'E-commerce database schema',
    version: '1.0.0',
    requirements: [],
    models: [
      {
        name: 'User',
        description: 'User account',
        fields: [
          { name: 'id', type: 'integer', nullable: false, primaryKey: true },
          { name: 'email', type: 'string', nullable: false, unique: true },
          { name: 'password', type: 'string', nullable: false },
          { name: 'name', type: 'string', nullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            nullable: false,
            defaultValue: 'CURRENT_TIMESTAMP'
          }
        ],
        indexes: [
          { name: 'idx_email', fields: ['email'], unique: true }
        ]
      },
      {
        name: 'Product',
        description: 'Product catalog',
        fields: [
          { name: 'id', type: 'integer', nullable: false, primaryKey: true },
          { name: 'name', type: 'string', nullable: false },
          { name: 'description', type: 'text', nullable: true },
          { name: 'price', type: 'number', nullable: false },
          { name: 'stock', type: 'integer', nullable: false, defaultValue: 0 }
        ]
      },
      {
        name: 'Order',
        description: 'Customer orders',
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
          },
          { name: 'total', type: 'number', nullable: false },
          { name: 'status', type: 'string', nullable: false }
        ]
      }
    ]
  };

  // Generate database schema
  const dbResult = await codegen.generateSchema({
    spec,
    schemaType: 'database',
    language: Language.TypeScript,
    outputPath: './examples/output/schema.sql',
    database: 'postgresql',
    generateIndexes: true,
    generateRelations: true,
    generateMigrations: true
  });

  console.log('Database Schema:');
  console.log(`  Tables: ${dbResult.tables?.length}`);
  dbResult.tables?.forEach(table => {
    console.log(`  - ${table.name}: ${table.columns.length} columns`);
  });

  // Generate TypeScript types
  const tsResult = await codegen.generateSchema({
    spec,
    schemaType: 'typescript',
    language: Language.TypeScript,
    outputPath: './examples/output/types.ts'
  });

  console.log('\nTypeScript Types:');
  tsResult.types?.forEach(type => {
    console.log(`  - ${type.name}`);
  });

  // Generate GraphQL schema
  const graphqlResult = await codegen.generateSchema({
    spec,
    schemaType: 'graphql',
    language: Language.TypeScript,
    outputPath: './examples/output/schema.graphql'
  });

  console.log('\nGraphQL Schema:');
  graphqlResult.types?.forEach(type => {
    console.log(`  - ${type.name}`);
  });
}

async function testGenerationExample() {
  console.log('\n=== Test Generation ===\n');

  const result = await codegen.generateTests({
    sourcePath: './examples/sample-code',
    testType: 'all',
    testFramework: 'vitest',
    language: Language.TypeScript,
    outputPath: './examples/output/tests',
    coverageTarget: 80,
    generateMocks: true,
    generateFixtures: true,
    generateScenarios: true
  });

  console.log(`Test Suites: ${result.length}`);
  result.forEach(suite => {
    console.log(`  - ${suite.name}: ${suite.type}`);
    console.log(`    Files: ${suite.files.length}`);
    console.log(`    Tests: ${suite.fixtures?.length || 0} fixtures`);
  });
}

async function documentationExample() {
  console.log('\n=== Documentation Generation ===\n');

  const result = await codegen.generateDocs({
    sourcePath: './examples/sample-code',
    docType: 'all',
    format: 'markdown',
    language: Language.TypeScript,
    outputPath: './examples/output/docs',
    includeTypes: true,
    includeExamples: true,
    includeDiagrams: true,
    toc: true,
    searchIndex: true
  });

  console.log(`Documentation: ${result.title}`);
  console.log(`Sections: ${result.sections.length}`);
  console.log(`Files: ${result.files.length}`);
  console.log(`Examples: ${result.examples.length}`);
  console.log(`Diagrams: ${result.diagrams.length}`);
  result.sections.forEach(section => {
    console.log(`  - ${section.title} (Level ${section.level})`);
  });
}

// Run all examples
async function runAllExamples() {
  try {
    await basicExamples();
    await boilerplateExample();
    await apiClientExample();
    await schemaExample();
    await testGenerationExample();
    await documentationExample();

    console.log('\n=== All Examples Completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  basicExamples,
  boilerplateExample,
  apiClientExample,
  schemaExample,
  testGenerationExample,
  documentationExample
};
