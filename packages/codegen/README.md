# @claudeflare/codegen

AI-powered code generation package for the ClaudeFlare distributed AI coding platform.

## Features

- **Code Synthesis**: Generate code from natural language descriptions
- **Boilerplate Generation**: Create project scaffolding for multiple frameworks
- **API Client Generation**: Generate type-safe API clients from OpenAPI/GraphQL specs
- **SDK Generation**: Create multi-language SDKs for REST/GraphQL/gRPC APIs
- **Schema Generation**: Generate database schemas, TypeScript types, GraphQL schemas, and more
- **Test Generation**: Automatically generate unit, integration, and E2E tests
- **Documentation Generation**: Create comprehensive API documentation and code comments

## Supported Languages

- TypeScript / JavaScript
- Python
- Go
- Rust
- Java
- C#
- C++
- PHP
- Ruby
- Swift
- Kotlin
- Dart
- Scala

## Installation

```bash
npm install @claudeflare/codegen
```

## Quick Start

```typescript
import { createCodeGen, Language } from '@claudeflare/codegen';

// Initialize CodeGen
const codegen = createCodeGen();

// Generate code from natural language
const result = await codegen.synthesize({
  prompt: 'Create a function to validate email addresses',
  language: Language.TypeScript,
  outputPath: './src/validator.ts'
});

if (result.success) {
  console.log(result.data.code);
}
```

## Usage

### Code Synthesis

```typescript
// Generate code
const result = await codegen.synthesize({
  prompt: 'Create a REST API controller for user management',
  language: Language.TypeScript,
  outputPath: './src/users.controller.ts',
  format: true,
  includeComments: true,
  includeTests: true
});
```

### Code Refactoring

```typescript
// Refactor code
const result = await codegen.refactor(
  'function add(a,b){return a+b;}',
  Language.TypeScript,
  ['add type annotations', 'improve readability']
);
```

### Code Completion

```typescript
// Complete code
const result = await codegen.complete(
  'function calculateSum(numbers: number[]): number {',
  Language.TypeScript,
  { line: 1, column: 50 }
);
```

### Code Explanation

```typescript
// Explain code
const result = await codegen.explain(
  'function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }',
  Language.JavaScript,
  'detailed'
);
```

### Project Boilerplate

```typescript
// Generate project scaffold
const result = await codegen.generateBoilerplate({
  name: 'my-express-app',
  template: 'express-ts',
  outputPath: './my-express-app',
  features: ['authentication', 'logging'],
  config: {
    gitInit: true,
    installDeps: false,
    createReadme: true
  }
});
```

### API Client Generation

```typescript
// Generate API client
const apiSpec = {
  name: 'UserAPI',
  type: 'rest',
  version: '1.0.0',
  baseUrl: 'https://api.example.com',
  endpoints: [
    {
      name: 'getUsers',
      path: '/users',
      method: 'GET',
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
  outputPath: './src/api-client',
  generateTypes: true,
  generateDocs: true
});
```

### SDK Generation

```typescript
// Generate multi-language SDK
const result = await codegen.generateSDK({
  spec: apiSpec,
  sdkType: 'rest',
  languages: [Language.TypeScript, Language.Python, Language.Go],
  outputPath: './sdks',
  generateExamples: true,
  generateDocs: true
});
```

### Schema Generation

```typescript
// Generate database schema
const spec = {
  name: 'UserSchema',
  description: 'User database schema',
  version: '1.0.0',
  requirements: [],
  models: [
    {
      name: 'User',
      description: 'User account',
      fields: [
        { name: 'id', type: 'integer', nullable: false, primaryKey: true },
        { name: 'email', type: 'string', nullable: false, unique: true },
        { name: 'name', type: 'string', nullable: true }
      ]
    }
  ]
};

const result = await codegen.generateSchema({
  spec,
  schemaType: 'database',
  database: 'postgresql',
  language: Language.TypeScript,
  outputPath: './schema.sql'
});
```

### Test Generation

```typescript
// Generate tests
const result = await codegen.generateTests({
  sourcePath: './src',
  testType: 'all',
  testFramework: 'vitest',
  language: Language.TypeScript,
  outputPath: './tests',
  coverageTarget: 80,
  generateMocks: true
});
```

### Documentation Generation

```typescript
// Generate documentation
const result = await codegen.generateDocs({
  sourcePath: './src',
  docType: 'api',
  format: 'markdown',
  language: Language.TypeScript,
  outputPath: './docs',
  includeExamples: true,
  toc: true
});
```

## Configuration

### Environment Variables

```bash
# Anthropic Claude API
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# OpenAI API
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4-turbo-preview

# Azure OpenAI
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com
AZURE_OPENAI_MODEL=gpt-4
```

## Project Templates

Available boilerplate templates:

- `express-ts`: Express.js server with TypeScript
- `react-ts`: React application with TypeScript and Vite
- `python-fastapi`: FastAPI server with Python
- `go-service`: Go microservice

## API Reference

See [API Documentation](./docs/api.md) for detailed API reference.

## Examples

Check out the [examples](./examples) directory for more usage examples.

## License

MIT

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details.
