# Intelligent Documentation Generation System

A comprehensive documentation generation system for ClaudeFlare that automatically generates documentation from code comments, type definitions, and codebase structure.

## Features

- **Multi-Language Support**: Parse 15+ programming languages
- **Multiple Output Formats**: Markdown, HTML, JSON
- **Comprehensive Documentation Types**:
  - API Reference
  - README files
  - Architecture diagrams (Mermaid)
  - Tutorials
  - Changelogs
- **Smart Extraction**:
  - JSDoc comments (TypeScript/JavaScript)
  - Docstrings (Python)
  - Godoc (Go)
  - Rustdoc (Rust)
  - Javadoc (Java)
- **Architecture Diagrams**: Generate Mermaid diagrams showing code structure
- **Template System**: Customizable output templates
- **Type Inference**: Extract type information for API docs
- **Code Examples**: Include examples from docstrings
- **R2 Integration**: Store generated docs in Cloudflare R2

## Installation

```typescript
import {
  DocumentationGenerator,
  generateDocs,
  generateAPIReference,
  generateReadme,
} from './lib/docs';
```

## Quick Start

### Generate Complete Documentation

```typescript
import { generateDocs } from './lib/docs';

const result = await generateDocs({
  files: [
    { path: 'src/index.ts', content: '...' },
  ],
  options: {
    projectName: 'MyProject',
    version: '1.0.0',
    description: 'An amazing project',
    format: ['markdown', 'html', 'json'],
    type: ['api-reference', 'readme', 'architecture'],
  },
});

console.log('Generated', result.outputs.length, 'documents');
```

### Generate API Reference Only

```typescript
import { generateAPIReference } from './lib/docs';

const apiDocs = await generateAPIReference(files, 'markdown');
console.log(apiDocs.content);
```

### Generate README

```typescript
import { generateReadme } from './lib/docs';

const readme = await generateReadme(files, {
  projectName: 'MyProject',
  version: '1.0.0',
  description: 'An amazing project',
  license: 'MIT',
});
```

## Supported Languages

- TypeScript
- JavaScript
- Python
- Java
- Go
- Rust
- C++
- C
- C#
- PHP
- Ruby
- Swift
- Kotlin
- Scala
- Shell
- SQL

## Docstring Formats

### JSDoc (TypeScript/JavaScript)

```typescript
/**
 * Calculates the sum of two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The sum
 * @example
 *   sum(1, 2) // returns 3
 * @since 1.0.0
 * @version 2.0.0
 */
export function sum(a: number, b: number): number {
  return a + b;
}
```

### Python Docstrings

```python
def greet(name: str) -> str:
    """Greet a person.

    Args:
        name: The person's name

    Returns:
        A greeting message

    Example:
        >>> greet("World")
        'Hello, World!'
    """
    return f"Hello, {name}!"
```

## Output Formats

### Markdown

```typescript
const generator = new DocumentationGenerator({
  format: ['markdown'],
  type: ['api-reference'],
});

const result = await generator.generate(files);
const markdown = result.outputs[0].content;
```

### HTML

```typescript
const generator = new DocumentationGenerator({
  format: ['html'],
  type: ['api-reference'],
  includeSearch: true, // Enable search functionality
});

const result = await generator.generate(files);
const html = result.outputs[0].content;
```

### JSON

```typescript
const generator = new DocumentationGenerator({
  format: ['json'],
  type: ['api-reference'],
});

const result = await generator.generate(files);
const data = JSON.parse(result.outputs[0].content);
```

## Architecture Diagrams

Generate Mermaid diagrams showing code structure:

```typescript
import { DiagramGenerator } from './lib/docs';

const diagramGenerator = new DiagramGenerator({
  type: 'component',
  groupByModule: true,
  includeDependencies: true,
  includeTypes: true,
});

const diagram = diagramGenerator.generateArchitectureDiagram(docs);
const mermaid = diagramGenerator.generateMermaid(diagram);

console.log(mermaid);
// Output:
// graph TD
//   Calculator[Calculator]
//   User[User]
//   Calculator --> User
```

## API Reference

### DocumentationGenerator

Main class for generating documentation.

```typescript
const generator = new DocumentationGenerator({
  projectName: string;
  version?: string;
  description?: string;
  repository?: string;
  homepage?: string;
  author?: string;
  license?: string;
  format?: DocFormat[];
  type?: DocType[];
  includeTOC?: boolean;
  includeIndex?: boolean;
  includeSearch?: boolean;
  includeTypes?: boolean;
  includeExamples?: boolean;
  includeDiagrams?: boolean;
  groupByCategory?: boolean;
  sortSymbols?: 'name' | 'kind' | 'line' | 'access';
});

const result = await generator.generate(files);
```

### DocumentationParser

Parse code and extract documentation.

```typescript
const parser = new DocumentationParser({
  includePrivate?: boolean;
  includeInternal?: boolean;
  includeSource?: boolean;
  docstringFormat?: DocstringFormat;
  exclude?: string[];
  maxFileSize?: number;
  followImports?: boolean;
});

const docs = await parser.parseBatch(files);
```

### APIDocGenerator

Generate API reference documentation.

```typescript
const apiGenerator = new APIDocGenerator(options);
const apiRef = apiGenerator.generateAPIReference(docs);
const markdown = apiGenerator.generateDocumentation(apiRef, 'markdown');
```

### DiagramGenerator

Generate architecture diagrams.

```typescript
const diagramGenerator = new DiagramGenerator({
  type?: 'component' | 'deployment' | 'sequence' | 'flow' | 'class';
  includeDependencies?: boolean;
  includeTypes?: boolean;
  maxDepth?: number;
  groupByModule?: boolean;
  outputFormat?: 'mermaid' | 'plantuml' | 'dot';
});

const diagram = diagramGenerator.generateArchitectureDiagram(docs);
```

## Storage Integration

Store generated documentation in Cloudflare R2:

```typescript
const generator = new DocumentationGenerator();

const result = await generator.generateAndStore(files, {
  R2: env.R2, // Cloudflare R2 binding
});

console.log('Stored at:', result.urls);
// Output: ['/docs/api-reference-1234567890.markdown', ...]
```

## Performance

- Parse 1MB file: <100ms
- Extract docstrings: <50ms
- Generate docs for 100 files: <5s
- Memory overhead: ~10x source size

## Examples

### Example 1: Generate docs for a TypeScript project

```typescript
import { DocumentationGenerator } from './lib/docs';

const generator = new DocumentationGenerator({
  projectName: 'MyLibrary',
  version: '2.0.0',
  description: 'A useful utility library',
  author: 'Your Name',
  license: 'MIT',
  format: ['markdown', 'html'],
  type: ['api-reference', 'readme', 'architecture'],
});

const files = [
  { path: 'src/index.ts', content: '...' },
  { path: 'src/utils.ts', content: '...' },
];

const result = await generator.generate(files);

for (const output of result.outputs) {
  console.log(`Generated ${output.type} in ${output.format}`);
}
```

### Example 2: Generate API reference with custom options

```typescript
import { generateAPIReference } from './lib/docs';

const apiDocs = await generateAPIReference(files, 'markdown');

// Save to file
await Deno.writeTextFile('./API.md', apiDocs.content);
```

### Example 3: Generate architecture diagram

```typescript
import { DiagramGenerator, DocumentationParser } from './lib/docs';

const parser = new DocumentationParser();
const docs = await parser.parseBatch(files);

const diagramGenerator = new DiagramGenerator({
  type: 'component',
  groupByModule: true,
});

const diagram = diagramGenerator.generateArchitectureDiagram(docs);
const mermaid = diagramGenerator.generateMermaid(diagram);

console.log(mermaid);
```

## Testing

Run tests:

```bash
npm test
```

Run specific test suite:

```bash
npm test -- src/lib/docs/parser.test.ts
npm test -- src/lib/docs/generator.test.ts
npm test -- src/lib/docs/integration.test.ts
```

## License

MIT

## Contributing

Contributions are welcome! Please see our contributing guidelines.

## Support

For issues and questions, please open an issue on GitHub.
