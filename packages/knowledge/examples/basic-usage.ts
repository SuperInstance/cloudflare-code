/**
 * Basic Usage Examples for ClaudeFlare Knowledge Package
 */

import { DocumentationGenerator } from '../src/generation/generator.js';
import { KnowledgeBase } from '../src/knowledge/base.js';
import { SiteBuilder } from '../src/site/builder.js';
import { TutorialGenerator } from '../src/tutorials/generator.js';
import { AIDocumentationAssistant } from '../src/ai/assistant.js';
import { join } from 'path';

// Example 1: Generate Documentation
async function generateDocumentation() {
  const generator = new DocumentationGenerator({
    inputPath: join(process.cwd(), 'src'),
    outputPath: join(process.cwd(), 'docs'),
    format: 'markdown',
    includePrivate: false,
    examples: true,
    typeInfo: true
  });

  const result = await generator.generate();

  console.log(`Generated ${result.documents.length} documents`);
  console.log(`Coverage: ${result.metrics.coverage.percentage.toFixed(1)}%`);
  console.log(`Duration: ${result.duration}ms`);
}

// Example 2: Create Knowledge Base
async function createKnowledgeBase() {
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
        // Use actual embedding service in production
        return new Array(1536).fill(0).map(() => Math.random());
      }
    },
    search: {
      index: async (doc: any) => {},
      search: async (query: string, options?: any) => [],
      delete: async (id: string) => {},
      clear: async () => {}
    }
  };

  const kb = new KnowledgeBase(mockState, mockEnv);

  // Add document
  await kb.putDocument({
    metadata: {
      id: 'example-doc',
      title: 'Example Document',
      description: 'An example document',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      tags: ['example'],
      category: 'demo',
      language: 'typescript'
    },
    content: '# Example Content\n\nThis is an example document.'
  });

  // Search
  const results = await kb.search('example', { limit: 10 });
  console.log(`Found ${results.length} results`);
}

// Example 3: Build Documentation Site
async function buildSite() {
  const builder = new SiteBuilder({
    config: {
      title: 'My Documentation',
      description: 'Comprehensive documentation',
      baseUrl: 'https://docs.example.com',
      theme: {
        name: 'default',
        colors: {
          primary: '#0066cc',
          secondary: '#6c757d',
          accent: '#28a745',
          background: '#ffffff',
          foreground: '#212529',
          border: '#dee2e6',
          code: {
            background: '#f8f9fa',
            foreground: '#212529',
            keyword: '#d73a49',
            string: '#032f62',
            comment: '#6a737d',
            function: '#6f42c1',
            number: '#005cc5',
            operator: '#d73a49'
          }
        },
        typography: {
          fontFamily: {
            heading: ['Inter', 'sans-serif'],
            body: ['Inter', 'sans-serif'],
            code: ['Fira Code', 'monospace']
          },
          fontSize: {
            xs: '0.75rem',
            sm: '0.875rem',
            base: '1rem',
            lg: '1.125rem',
            xl: '1.25rem',
            '2xl': '1.5rem',
            '3xl': '1.875rem'
          },
          lineHeight: {
            tight: '1.25',
            normal: '1.5',
            relaxed: '1.75'
          }
        },
        layout: {
          maxWidth: '1024px',
          sidebar: {
            width: '280px',
            collapsible: true,
            sticky: true
          },
          toc: {
            enabled: true,
            depth: 3,
            sticky: true
          },
          editLink: true,
          prevNext: true
        },
        components: {
          header: {
            enabled: true,
            search: true,
            themeToggle: true,
            languageSelector: true
          },
          footer: {
            enabled: true,
            copyright: '© 2024 My Project'
          },
          codeBlock: {
            lineNumbers: true,
            copyButton: true,
            preview: true
          },
          feedback: {
            enabled: true,
            type: 'thumbs'
          }
        }
      },
      navigation: [
        {
          title: 'Getting Started',
          items: [
            { title: 'Introduction', path: '/' },
            { title: 'Installation', path: '/installation' }
          ]
        },
        {
          title: 'API Reference',
          items: [
            { title: 'Functions', path: '/api/functions' },
            { title: 'Classes', path: '/api/classes' }
          ]
        }
      ],
      search: {
        enabled: true,
        provider: 'lunr'
      },
      deployment: {
        platform: 'workers'
      }
    },
    documents: [],
    outputPath: join(process.cwd(), 'site'),
    optimize: true
  });

  const result = await builder.build();
  console.log(`Built site with ${result.pages} pages and ${result.assets} assets`);
}

// Example 4: Generate Tutorials
async function generateTutorials() {
  const tutorialGen = new TutorialGenerator({
    outputPath: join(process.cwd(), 'tutorials'),
    includeExercises: true,
    includeQuizzes: true,
    includeVideos: false
  });

  const tutorials = await tutorialGen.generateFromDocs([]);

  for (const tutorial of tutorials) {
    await tutorialGen.saveTutorial(tutorial);
    console.log(`Generated tutorial: ${tutorial.metadata.title}`);
  }
}

// Example 5: AI Documentation Assistant
async function aiAssistance() {
  const ai = new AIDocumentationAssistant({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000
  });

  // Generate documentation from code
  const code = `
export function calculateSum(numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + n, 0);
}
  `.trim();

  const documentation = await ai.generateDocumentation(code, {
    language: 'typescript',
    audience: 'intermediate',
    tone: 'technical',
    includeExamples: true
  });

  console.log('Generated documentation:');
  console.log(documentation);

  // Improve existing documentation
  const improved = await ai.improveDocumentation(documentation, {
    audience: 'beginner'
  });

  console.log('Improved documentation:');
  console.log(improved);

  // Get suggestions
  const suggestions = await ai.generateSuggestions(code);
  console.log('Suggestions:');
  for (const suggestion of suggestions) {
    console.log(`- ${suggestion.type}: ${suggestion.explanation}`);
  }

  // Check grammar
  const grammar = await ai.checkGrammar(documentation);
  console.log(`Grammar score: ${grammar.score}/100`);

  // Optimize for SEO
  const seo = await ai.optimizeSEO(
    'My API Documentation',
    'Comprehensive API reference for my project',
    documentation
  );

  console.log('SEO suggestions:');
  console.log(`Keywords: ${seo.keywords.join(', ')}`);
}

// Run examples
async function main() {
  try {
    console.log('=== Example 1: Generate Documentation ===');
    await generateDocumentation();

    console.log('\n=== Example 2: Create Knowledge Base ===');
    await createKnowledgeBase();

    console.log('\n=== Example 3: Build Documentation Site ===');
    await buildSite();

    console.log('\n=== Example 4: Generate Tutorials ===');
    await generateTutorials();

    console.log('\n=== Example 5: AI Assistance ===');
    await aiAssistance();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
