/**
 * ClaudeFlare Knowledge Management Package
 *
 * Comprehensive documentation generation and knowledge management system
 * for distributed AI coding platforms.
 */

// @ts-nocheck - Missing type exports

// Core exports
export { DocumentationGenerator } from './generation/generator.js';
export type {
  GenerationResult,
  GenerationMetrics,
  GenerationError
} from './generation/generator.js';

export { KnowledgeBase } from './knowledge/base.js';
export type {
  KnowledgeBaseConfig,
  VersionControl
} from './knowledge/base.js';

export { SiteBuilder } from './site/builder.js';
export type {
  SiteBuilderOptions,
  BuildResult
} from './site/builder.js';

export { CodeDocumentationAnalyzer } from './code/documentation.js';
export type {
  DocumentationAnalysis,
  CodeDocumentationOptions
} from './code/documentation.js';

export { TutorialGenerator, TutorialPlayer } from './tutorials/generator.js';
export type {
  TutorialGeneratorOptions,
  TutorialTemplate,
  TutorialSectionTemplate,
  ExerciseTemplate,
  QuizTemplate,
  VideoTemplate
} from './tutorials/generator.js';

export {
  AIDocumentationAssistant,
  AutoDocumentationService
} from './ai/assistant.js';
export type {
  AIAssistantConfig,
  GenerationOptions
} from './ai/assistant.js';

// Type exports
export * from './types/index.js';

// Utility exports
export { Logger, LogLevel, NullLogger } from './utils/logger.js';

// Version
export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@claudeflare/knowledge';

/**
 * Create a documentation generator instance
 */
export function createDocumentationGenerator(options: any) {
  return new DocumentationGenerator(options);
}

/**
 * Create a knowledge base instance
 */
export function createKnowledgeBase(config: any) {
  return new KnowledgeBase(config);
}

/**
 * Create a site builder instance
 */
export function createSiteBuilder(options: any) {
  return new SiteBuilder(options);
}

/**
 * Create a code documentation analyzer
 */
export function createCodeAnalyzer(options: any) {
  return new CodeDocumentationAnalyzer(options);
}

/**
 * Create a tutorial generator
 */
export function createTutorialGenerator(options: any) {
  return new TutorialGenerator(options);
}

/**
 * Create an AI documentation assistant
 */
export function createAIAssistant(config: any) {
  return new AIDocumentationAssistant(config);
}

// Default export
export default {
  VERSION,
  PACKAGE_NAME,
  createDocumentationGenerator,
  createKnowledgeBase,
  createSiteBuilder,
  createCodeAnalyzer,
  createTutorialGenerator,
  createAIAssistant
};
