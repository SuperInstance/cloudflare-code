# @claudeflare/knowledge

AI-powered documentation generation and knowledge management for the ClaudeFlare distributed AI coding platform.

## Features

- **Automated Documentation Generation**: Generate comprehensive documentation from TypeScript, JavaScript, Python, and Go code
- **Knowledge Base**: Semantic search with embeddings, version tracking, and document relationships
- **Interactive Documentation Sites**: Static site generation with search, dark mode, and responsive design
- **Code Documentation Analysis**: JSDoc/TSDoc parsing, coverage metrics, and quality reports
- **Tutorial Generation**: Create interactive tutorials with exercises and quizzes
- **API Reference Builder**: OpenAPI/Swagger integration with auto-generated examples
- **AI Content Assistant**: AI-powered documentation writing, improvement, and translation

## Installation

```bash
npm install @claudeflare/knowledge
```

## Quick Start

### Generate Documentation

```typescript
import { DocumentationGenerator } from '@claudeflare/knowledge';

const generator = new DocumentationGenerator({
  inputPath: './src',
  outputPath: './docs',
  format: 'markdown',
  examples: true,
  typeInfo: true
});

const result = await generator.generate();
console.log(`Generated ${result.documents.length} documents`);
console.log(`Coverage: ${result.metrics.coverage.percentage}%`);
```

### Create Knowledge Base

```typescript
import { KnowledgeBase } from '@claudeflare/knowledge';

const kb = new KnowledgeBase(state, env);

// Add document
await kb.putDocument({
  metadata: {
    id: 'my-doc',
    title: 'My Document',
    description: 'A comprehensive guide',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: '1.0.0',
    tags: ['guide', 'tutorial'],
    category: 'getting-started',
    language: 'typescript'
  },
  content: '# My Document\n\nContent here...'
});

// Search
const results = await kb.search('tutorial', {
  limit: 10,
  semantic: true
});
```

### Build Documentation Site

```typescript
import { SiteBuilder } from '@claudeflare/knowledge';

const builder = new SiteBuilder({
  config: {
    title: 'My Documentation',
    description: 'Comprehensive API reference',
    baseUrl: 'https://docs.example.com',
    theme: myTheme,
    navigation: myNav,
    search: { enabled: true, provider: 'lunr' },
    deployment: { platform: 'workers' }
  },
  documents: myDocuments,
  outputPath: './site'
});

const result = await builder.build();
console.log(`Built ${result.pages} pages`);
```

### Generate Tutorials

```typescript
import { TutorialGenerator } from '@claudeflare/knowledge';

const tutorialGen = new TutorialGenerator({
  outputPath: './tutorials',
  includeExercises: true,
  includeQuizzes: true
});

const tutorials = await tutorialGen.generateFromDocs(documents);

for (const tutorial of tutorials) {
  await tutorialGen.saveTutorial(tutorial);
}
```

### AI Documentation Assistant

```typescript
import { AIDocumentationAssistant } from '@claudeflare/knowledge';

const ai = new AIDocumentationAssistant({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});

// Generate documentation from code
const docs = await ai.generateDocumentation(code, {
  language: 'typescript',
  audience: 'intermediate',
  includeExamples: true
});

// Improve existing documentation
const improved = await ai.improveDocumentation(docs);

// Get suggestions
const suggestions = await ai.generateSuggestions(code);

// Check grammar
const grammar = await ai.checkGrammar(docs);
```

## Documentation Generation

The documentation generator supports multiple output formats:

### Markdown

```typescript
const generator = new DocumentationGenerator({
  inputPath: './src',
  outputPath: './docs',
  format: 'markdown'
});
```

### HTML

```typescript
const generator = new DocumentationGenerator({
  inputPath: './src',
  outputPath: './docs',
  format: 'html'
});
```

### JSON

```typescript
const generator = new DocumentationGenerator({
  inputPath: './src',
  outputPath: './docs',
  format: 'json'
});
```

## Semantic Search

The knowledge base provides hybrid search combining keyword and semantic search:

```typescript
// Keyword search
const results = await kb.search('function name');

// Semantic search
const results = await kb.search('string manipulation', {
  semantic: true,
  threshold: 0.7
});

// Combined search
const results = await kb.search('api endpoint', {
  semantic: true,
  fuzzy: true,
  filter: {
    category: 'api',
    tags: ['rest']
  }
});
```

## Site Building

Build static documentation sites with:

- Responsive design
- Dark mode support
- Full-text search
- Code syntax highlighting
- Interactive examples
- Navigation tree
- Table of contents

```typescript
const builder = new SiteBuilder({
  config: siteConfig,
  documents: docs,
  outputPath: './site',
  optimize: true
});

const { files, pages, assets, duration } = await builder.build();
```

## Tutorial System

Create interactive tutorials with:

- Text content sections
- Code exercises with solutions
- Multiple-choice quizzes
- Video integration
- Progress tracking
- Assessment generation

```typescript
const tutorial = {
  id: 'intro-tutorial',
  metadata: {
    title: 'Introduction Tutorial',
    description: 'Learn the basics',
    duration: 30,
    difficulty: 'beginner',
    category: 'getting-started',
    tags: ['basics'],
    prerequisites: [],
    learningObjectives: [
      'Understand core concepts',
      'Build your first project'
    ]
  },
  sections: [
    {
      id: 'intro',
      title: 'Introduction',
      content: 'Welcome to the tutorial...',
      type: 'text',
      order: 1
    },
    {
      id: 'exercise-1',
      title: 'First Exercise',
      content: '',
      type: 'exercise',
      order: 2,
      contentData: {
        instructions: 'Create a function...',
        startingCode: '// Your code here',
        solution: 'function example() { return true; }',
        hints: ['Think about what the function should do'],
        tests: [],
        allowRun: true,
        showSolution: false
      }
    }
  ],
  resources: [],
  assessment: {
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What is X?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is correct because...',
        points: 10
      }
    ],
    passingScore: 70,
    randomize: true
  }
};
```

## AI Assistant

The AI assistant provides:

- Automated documentation generation
- Documentation improvement suggestions
- Grammar and style checking
- SEO optimization
- Translation support
- Content summarization

```typescript
// Generate documentation
const docs = await ai.generateDocumentation(code);

// Improve documentation
const improved = await ai.improveDocumentation(docs, {
  audience: 'beginner',
  tone: 'casual'
});

// Get quality suggestions
const suggestions = await ai.generateSuggestions(docs);

// Check grammar
const grammar = await ai.checkGrammar(docs);

// Optimize for SEO
const seo = await ai.optimizeSEO(title, description, content);

// Translate
const translated = await ai.translate(docs, 'spanish');

// Summarize
const summary = await ai.summarize(docs, 200);
```

## Performance

The package is optimized for performance:

- **Fast Generation**: Process 10K+ LOC in <2 minutes
- **Efficient Search**: Semantic search with 90%+ relevance
- **Quick Builds**: Generate static sites in seconds
- **Low Overhead**: Minimal memory footprint

## Testing

Comprehensive test coverage:

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

## Examples

See the `examples/` directory for complete usage examples:

- `basic-usage.ts` - Basic functionality
- `advanced-usage.ts` - Advanced features
- `custom-theme.ts` - Custom theming
- `deployment.ts` - Deployment strategies

## API Reference

Full API documentation is available at `/docs/api`

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md for guidelines.

## License

MIT License - see LICENSE for details.

## Support

- GitHub Issues: https://github.com/claudeflare/knowledge/issues
- Discord: https://discord.gg/claudeflare
- Documentation: https://docs.claudeflare.dev/knowledge
