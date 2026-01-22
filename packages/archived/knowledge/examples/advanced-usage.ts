/**
 * Advanced Usage Examples for ClaudeFlare Knowledge Package
 */

import {
  DocumentationGenerator,
  KnowledgeBase,
  SiteBuilder,
  TutorialGenerator,
  AIDocumentationAssistant,
  CodeDocumentationAnalyzer
} from '../src/index.js';
import { join } from 'path';

// Example 1: Custom Theme for Documentation Site
async function buildCustomSite() {
  const customTheme = {
    name: 'my-custom-theme',
    colors: {
      primary: '#2563eb',
      secondary: '#475569',
      accent: '#0891b2',
      background: '#ffffff',
      foreground: '#0f172a',
      border: '#e2e8f0',
      code: {
        background: '#1e293b',
        foreground: '#e2e8f0',
        keyword: '#c678dd',
        string: '#98c379',
        comment: '#5c6370',
        function: '#61afef',
        number: '#d19a66',
        operator: '#56b6c2'
      },
      darkMode: {
        primary: '#3b82f6',
        secondary: '#94a3b8',
        accent: '#06b6d4',
        background: '#0f172a',
        foreground: '#f1f5f9',
        border: '#334155',
        code: {
          background: '#1e293b',
          foreground: '#e2e8f0',
          keyword: '#c678dd',
          string: '#98c379',
          comment: '#5c6370',
          function: '#61afef',
          number: '#d19a66',
          operator: '#56b6c2'
        }
      }
    },
    customCss: `
      .custom-class {
        font-family: 'Inter', sans-serif;
      }
    `
  };

  const builder = new SiteBuilder({
    config: {
      title: 'My API Documentation',
      description: 'Comprehensive API reference and guides',
      baseUrl: 'https://api.myapp.com/docs',
      theme: customTheme as any,
      navigation: [
        {
          title: 'Getting Started',
          collapsible: true,
          collapsed: false,
          items: [
            { title: 'Introduction', path: '/' },
            { title: 'Quick Start', path: '/quickstart' },
            { title: 'Authentication', path: '/auth' }
          ]
        },
        {
          title: 'API Reference',
          collapsible: true,
          collapsed: false,
          items: [
            { title: 'Users API', path: '/api/users' },
            { title: 'Posts API', path: '/api/posts' },
            { title: 'Comments API', path: '/api/comments' }
          ]
        }
      ],
      search: {
        enabled: true,
        provider: 'lunr',
        facets: ['category', 'tags']
      },
      analytics: {
        provider: 'plausible',
        domain: 'api.myapp.com'
      },
      deployment: {
        platform: 'workers',
        environment: {
          API_URL: 'https://api.myapp.com'
        }
      }
    },
    documents: [],
    outputPath: join(process.cwd(), 'dist/docs'),
    optimize: true,
    minify: true
  });

  const result = await builder.build();
  console.log(`Site built with ${result.files} files`);
}

// Example 2: Code Quality Analysis
async function analyzeCodeQuality() {
  const analyzer = new CodeDocumentationAnalyzer({
    includePatterns: ['./src/**/*.ts'],
    excludePatterns: ['./src/**/*.test.ts', './src/**/*.spec.ts'],
    languages: ['typescript', 'javascript'],
    outputFormat: 'json',
    includeSource: false,
    includeExamples: true,
    generateDiagrams: true
  });

  const analysis = await analyzer.analyze();

  console.log('=== Documentation Coverage ===');
  console.log(`Total Items: ${analysis.coverage.total}`);
  console.log(`Documented: ${analysis.coverage.documented}`);
  console.log(`Percentage: ${analysis.coverage.percentage.toFixed(1)}%`);
  console.log(`Grade: ${analysis.quality.overall.grade}`);

  console.log('\n=== Quality Metrics ===');
  console.log(`Clarity: ${analysis.quality.clarity.avgDescriptionLength.toFixed(0)} avg chars`);
  console.log(`Examples: ${analysis.quality.examples.avgExamplesPerSymbol.toFixed(2)} per symbol`);
  console.log(`Consistency: ${analysis.quality.consistency.namingConventions.toFixed(1)}%`);

  console.log('\n=== Undocumented Items ===');
  for (const item of analysis.coverage.undocumented.slice(0, 10)) {
    console.log(`- ${item.name} (${item.type}) at ${item.location.filePath}:${item.location.line}`);
  }

  console.log('\n=== Suggestions ===');
  for (const suggestion of analysis.suggestions.slice(0, 10)) {
    console.log(`- [${suggestion.severity.toUpperCase()}] ${suggestion.message}`);
  }
}

// Example 3: Advanced Knowledge Base Features
async function advancedKnowledgeBase() {
  const mockState = {
    storage: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => []
    }
  };

  const mockEnv = {
    storage: {
      get: async (id: string) => null,
      put: async (id: string, data: any) => {},
      delete: async (id: string) => {}
    },
    embeddings: {
      generateEmbedding: async (text: string) => {
        return new Array(1536).fill(0).map(() => Math.random());
      },
      generateBatchEmbeddings: async (texts: string[]) => {
        return texts.map(() => new Array(1536).fill(0).map(() => Math.random()));
      },
      similarity: (a: number[], b: number[]) => {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
      }
    },
    search: {
      index: async (doc: any) => {},
      search: async (query: string, options?: any) => [],
      suggest: async (prefix: string) => [],
      delete: async (id: string) => {},
      clear: async () => {}
    },
    enableVersioning: true,
    enableAccessControl: true
  };

  const kb = new KnowledgeBase(mockState, mockEnv);

  // Add documents with relationships
  const doc1 = {
    metadata: {
      id: 'doc1',
      title: 'Authentication Guide',
      description: 'How to authenticate users',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      tags: ['auth', 'security'],
      category: 'guide',
      language: 'typescript'
    },
    content: '# Authentication Guide\n\nOAuth2 flow...'
  };

  const doc2 = {
    metadata: {
      id: 'doc2',
      title: 'User Management',
      description: 'Managing user accounts',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      tags: ['users', 'admin'],
      category: 'guide',
      language: 'typescript'
    },
    content: '# User Management\n\nCRUD operations...'
  };

  await kb.putDocument(doc1);
  await kb.putDocument(doc2);

  // Create relationship
  await kb.addRelationship({
    sourceId: 'doc2',
    targetId: 'doc1',
    type: 'related',
    strength: 0.7
  });

  // Semantic search with filters
  const results = await kb.search('user authentication', {
    limit: 10,
    semantic: true,
    fuzzy: true,
    threshold: 0.6,
    filter: {
      category: 'guide',
      tags: ['auth']
    }
  });

  // Find similar documents
  const similar = await kb.findSimilar('doc1', 5);

  // Get statistics
  const stats = await kb.getStats();
  console.log('Knowledge Base Stats:', stats);

  // Version management
  const versions = await kb.getVersions('doc1');
  console.log('Document versions:', versions);

  // Access control
  await kb.grantAccess('doc1', 'user-123', 'read');
  await kb.grantAccess('doc1', 'admin-456', 'admin');

  const hasAccess = await kb.checkAccess('doc1', 'user-123');
  console.log('User has access:', hasAccess);
}

// Example 4: Tutorial with Advanced Features
async function advancedTutorial() {
  const tutorialGen = new TutorialGenerator({
    outputPath: join(process.cwd(), 'tutorials'),
    includeExercises: true,
    includeQuizzes: true,
    includeVideos: false
  });

  // Create custom tutorial
  const tutorial = {
    id: 'advanced-api-tutorial',
    metadata: {
      title: 'Advanced API Development',
      description: 'Learn advanced API development patterns',
      author: 'Expert Developer',
      duration: 120,
      difficulty: 'advanced' as const,
      category: 'api-development',
      tags: ['api', 'rest', 'advanced'],
      prerequisites: [
        'Basic JavaScript knowledge',
        'Understanding of HTTP',
        'REST API basics'
      ],
      learningObjectives: [
        'Design scalable API architectures',
        'Implement advanced authentication',
        'Handle error cases properly',
        'Optimize API performance'
      ],
      language: 'typescript',
      version: '2.0.0',
      updatedAt: new Date()
    },
    sections: [
      {
        id: 'intro',
        title: 'Course Introduction',
        content: 'Welcome to the advanced API course...',
        type: 'text' as const,
        order: 1,
        duration: 5
      },
      {
        id: 'arch-design',
        title: 'API Architecture Design',
        content: 'Design principles for scalable APIs...',
        type: 'text' as const,
        order: 2,
        duration: 15
      },
      {
        id: 'auth-exercise',
        title: 'Implementing OAuth2',
        content: '',
        type: 'exercise' as const,
        order: 3,
        duration: 30,
        contentData: {
          instructions: 'Implement OAuth2 authentication flow',
          startingCode: `
// Implement OAuth2 flow
export class OAuth2Auth {
  async authenticate(token: string) {
    // TODO: Implement
  }
}
          `.trim(),
          solution: `
export class OAuth2Auth {
  private validateToken(token: string): boolean {
    // Token validation logic
    return token.length > 0;
  }

  async authenticate(token: string) {
    if (!this.validateToken(token)) {
      throw new Error('Invalid token');
    }
    return { user: 'authenticated' };
  }
}
          `.trim(),
          hints: [
            'Validate the token format',
            'Check token expiration',
            'Return user object on success'
          ],
          tests: [
            {
              name: 'Should authenticate with valid token',
              input: { token: 'valid-token-123' },
              expected: { user: 'authenticated' },
              type: 'unit'
            },
            {
              name: 'Should reject invalid token',
              input: { token: '' },
              expected: 'Error: Invalid token',
              type: 'unit'
            }
          ],
          allowRun: true,
          showSolution: false
        }
      },
      {
        id: 'assessment',
        title: 'Knowledge Assessment',
        content: '',
        type: 'quiz' as const,
        order: 4,
        duration: 15,
        contentData: {
          questions: [
            {
              id: 'q1',
              type: 'multiple-choice' as const,
              question: 'What is the purpose of OAuth2?',
              options: [
                'Authentication and authorization',
                'Data storage',
                'UI rendering',
                'Database management'
              ],
              correctAnswer: 'Authentication and authorization',
              explanation: 'OAuth2 provides secure delegated access',
              points: 10
            },
            {
              id: 'q2',
              type: 'true-false' as const,
              question: 'API versioning is important for backward compatibility',
              correctAnswer: 'true',
              explanation: 'Versioning allows breaking changes without affecting existing clients',
              points: 5
            },
            {
              id: 'q3',
              type: 'code' as const,
              question: 'Write a function to validate email format',
              correctAnswer: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
              explanation: 'Email validation using regex',
              points: 15
            }
          ],
          passingScore: 70,
          randomize: true
        }
      }
    ],
    resources: [
      {
        id: 'resource-1',
        type: 'link',
        title: 'OAuth2 Specification',
        url: 'https://oauth.net/2/',
        order: 1
      },
      {
        id: 'resource-2',
        type: 'reference',
        title: 'API Design Best Practices',
        content: 'Key principles for API design...',
        order: 2
      }
    ],
    assessment: {
      id: 'final-assessment',
      questions: [],
      passingScore: 80,
      timeLimit: 30,
      randomize: true,
      showAnswers: true,
      retakeAllowed: true
    }
  };

  await tutorialGen.saveTutorial(tutorial);

  // Create tutorial player and track progress
  const player = new (TutorialGenerator as any).TutorialPlayer();

  const progress = await player.startTutorial(tutorial, 'user-789');
  console.log('Started tutorial:', progress);

  // Complete a section
  const updated = await player.completeSection(
    tutorial,
    'user-789',
    'intro',
    { q1: 'Authentication and authorization' }
  );
  console.log('Progress updated:', updated);

  // Generate progress report
  const report = tutorialGen.generateProgressReport(tutorial, updated);
  console.log('Progress Report:\n', report);
}

// Example 5: Multi-language Documentation
async function multiLanguageDocs() {
  const ai = new AIDocumentationAssistant({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  });

  // Generate documentation in English
  const code = `
export function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
  `.trim();

  const docsEn = await ai.generateDocumentation(code, {
    language: 'typescript',
    audience: 'beginner',
    includeExamples: true
  });

  console.log('English Documentation:\n', docsEn);

  // Translate to Spanish
  const docsEs = await ai.translate(docsEn, 'spanish');
  console.log('\nSpanish Documentation:\n', docsEs);

  // Translate to Japanese
  const docsJa = await ai.translate(docsEn, 'japanese');
  console.log('\nJapanese Documentation:\n', docsJa);

  // Generate multilingual site
  const languages = [
    { code: 'en', name: 'English', docs: docsEn },
    { code: 'es', name: 'Español', docs: docsEs },
    { code: 'ja', name: '日本語', docs: docsJa }
  ];

  for (const lang of languages) {
    console.log(`\n${lang.name} version:`);
    console.log(lang.docs);
  }
}

// Example 6: Automated Documentation Workflow
async function automatedWorkflow() {
  // 1. Analyze code
  const analyzer = new CodeDocumentationAnalyzer({
    includePatterns: ['./src/**/*.ts'],
    languages: ['typescript'],
    outputFormat: 'json'
  });

  const analysis = await analyzer.analyze();

  // 2. Generate documentation for missing items
  const ai = new AIDocumentationAssistant({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  });

  for (const item of analysis.coverage.undocumented.slice(0, 5)) {
    console.log(`Generating docs for ${item.name}...`);

    // Read the source code
    // In real implementation, read from file
    const sourceCode = `export function ${item.name}() { return true; }`;

    // Generate documentation
    const docs = await ai.generateDocumentation(sourceCode, {
      language: 'typescript',
      audience: 'intermediate'
    });

    console.log(`Generated:\n${docs}\n`);
  }

  // 3. Generate complete documentation
  const generator = new DocumentationGenerator({
    inputPath: './src',
    outputPath: './docs',
    format: 'markdown',
    examples: true
  });

  const result = await generator.generate();

  // 4. Build knowledge base
  const kb = new KnowledgeBase({} as any, {} as any);

  for (const doc of result.documents) {
    await kb.putDocument(doc);
  }

  // 5. Build documentation site
  const builder = new SiteBuilder({
    config: {} as any,
    documents: result.documents,
    outputPath: './site'
  });

  await builder.build();

  console.log('Automated workflow complete!');
}

// Run all examples
async function main() {
  console.log('=== Advanced Examples ===\n');

  console.log('1. Custom Site Building');
  await buildCustomSite();

  console.log('\n2. Code Quality Analysis');
  await analyzeCodeQuality();

  console.log('\n3. Advanced Knowledge Base');
  await advancedKnowledgeBase();

  console.log('\n4. Advanced Tutorial');
  await advancedTutorial();

  console.log('\n5. Multi-language Documentation');
  await multiLanguageDocs();

  console.log('\n6. Automated Workflow');
  await automatedWorkflow();
}

export {
  buildCustomSite,
  analyzeCodeQuality,
  advancedKnowledgeBase,
  advancedTutorial,
  multiLanguageDocs,
  automatedWorkflow
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
