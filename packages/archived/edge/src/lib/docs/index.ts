/**
 * Documentation Generation System
 *
 * Comprehensive documentation generation from code including:
 * - API documentation from type definitions
 * - README generation from codebase
 * - Architecture diagrams from structure
 * - Tutorial generation
 * - Multi-format output (Markdown, HTML, PDF, JSON)
 *
 * @packageDocumentation
 */

// Core types
export type {
  DocFormat,
  DocType,
  DocstringFormat,
  SupportedLanguage,
  SymbolKind,
  AccessModifier,
  DocSymbol,
  TypeParameter,
  Parameter,
  DocTag,
  ParsedDocumentation,
  Import,
  Export,
  DocOutput,
  APIReference,
  ArchitectureDiagram,
  DiagramNode,
  DiagramEdge,
  Tutorial,
  TutorialStep,
  ChangelogEntry,
  DocParserOptions,
  DocGeneratorOptions,
  DiagramGeneratorOptions,
  TemplateContext,
  GenerationResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SearchIndexEntry,
} from './types';

// Parser
export {
  DocumentationParser,
  createDocParser,
  defaultDocParser,
} from './parser';

// API Documentation Generator
export {
  APIDocGenerator,
  createAPIDocGenerator,
} from './api-docs';

// Diagram Generator
export {
  DiagramGenerator,
  createDiagramGenerator,
  defaultDiagramGenerator,
} from './diagrams';

// README Generator
export {
  ReadmeGenerator,
  createReadmeGenerator,
  defaultReadmeGenerator,
} from './readme';

// Main Generator
export {
  DocumentationGenerator,
  createDocGenerator,
  defaultDocGenerator,
} from './generator';

// Templates
export { renderMarkdownTemplate } from './templates/markdown';
export { renderHTMLTemplate } from './templates/html';

/**
 * Create a complete documentation generation pipeline
 *
 * @example
 * ```typescript
 * import { createDocGenerator } from './lib/docs';
 *
 * const generator = createDocGenerator({
 *   projectName: 'MyProject',
 *   version: '1.0.0',
 *   description: 'An amazing project',
 *   format: ['markdown', 'html', 'json'],
 *   type: ['api-reference', 'readme', 'architecture'],
 * });
 *
 * const result = await generator.generate(files);
 * console.log('Generated', result.outputs.length, 'documents');
 * ```
 */
export function createDocumentationPipeline(options?: DocGeneratorOptions) {
  return {
    generator: createDocGenerator(options),
    parser: createDocParser(),
    apiGenerator: createAPIDocGenerator(options),
    diagramGenerator: createDiagramGenerator(),
    readmeGenerator: createReadmeGenerator(options),
  };
}

/**
 * Generate documentation from a codebase
 *
 * Convenience function that handles the entire workflow
 *
 * @example
 * ```typescript
 * import { generateDocs } from './lib/docs';
 *
 * const docs = await generateDocs({
 *   files: [
 *     { path: 'src/index.ts', content: '...' },
 *   ],
 *   options: {
 *     projectName: 'MyProject',
 *     format: ['markdown'],
 *   },
 * });
 * ```
 */
export async function generateDocs(input: {
  files: Array<{ content: string; path: string }>;
  options?: DocGeneratorOptions;
}) {
  const generator = createDocGenerator(input.options);
  return generator.generate(input.files);
}

/**
 * Generate API reference only
 *
 * @example
 * ```typescript
 * import { generateAPIReference } from './lib/docs';
 *
 * const apiDocs = await generateAPIReference(files);
 * console.log(apiDocs.content);
 * ```
 */
export async function generateAPIReference(
  files: Array<{ content: string; path: string }>,
  format: DocFormat = 'markdown'
) {
  const generator = createDocGenerator({
    type: ['api-reference'],
    format: [format],
  });

  const result = await generator.generate(files);
  return result.outputs.find(o => o.type === 'api-reference');
}

/**
 * Generate README only
 *
 * @example
 * ```typescript
 * import { generateReadme } from './lib/docs';
 *
 * const readme = await generateReadme(files);
 * console.log(readme.content);
 * ```
 */
export async function generateReadme(
  files: Array<{ content: string; path: string }>,
  options?: DocGeneratorOptions
) {
  const generator = createDocGenerator({
    ...options,
    type: ['readme'],
    format: ['markdown'],
  });

  const result = await generator.generate(files);
  return result.outputs.find(o => o.type === 'readme');
}

/**
 * Generate architecture diagram only
 *
 * @example
 * ```typescript
 * import { generateArchitectureDiagram } from './lib/docs';
 *
 * const diagram = await generateArchitectureDiagram(files);
 * console.log(diagram.content);
 * ```
 */
export async function generateArchitectureDiagram(
  files: Array<{ content: string; path: string }>,
  format: DocFormat = 'markdown'
) {
  const generator = createDocGenerator({
    type: ['architecture'],
    format: [format],
    includeDiagrams: true,
  });

  const result = await generator.generate(files);
  return result.outputs.find(o => o.type === 'architecture');
}

/**
 * Generate documentation and store in R2
 *
 * @example
 * ```typescript
 * import { generateAndStoreDocs } from './lib/docs';
 *
 * const result = await generateAndStoreDocs(files, env);
 * console.log('Stored docs at:', result.urls);
 * ```
 */
export async function generateAndStoreDocs(
  files: Array<{ content: string; path: string }>,
  env: { R2?: R2Bucket },
  options?: DocGeneratorOptions
) {
  const generator = createDocGenerator(options);
  return generator.generateAndStore(files, env);
}

// Re-export default instances for convenience
export { defaultDocParser as parser } from './parser';
export { defaultDocGenerator as generator } from './generator';
export { defaultDiagramGenerator as diagramGenerator } from './diagrams';
export { defaultReadmeGenerator as readmeGenerator } from './readme';
