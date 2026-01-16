/**
 * CodeGen Main Class
 * Unified interface for all code generation functionality
 */

import type { LLMManager, createLLMManager } from './llm/index.js';
import type { CodeSynthesizer } from './synthesis/index.js';
import type { BoilerplateGenerator } from './boilerplate/index.js';
import type { APIClientGenerator } from './api/index.js';
import type { SDKGenerator } from './sdk/index.js';
import type { SchemaGenerator } from './schema/index.js';
import type { TestGenerator } from './tests/index.js';
import type { DocumentationGenerator } from './docs/index.js';
import {
  Language,
  SynthesisOptions,
  BoilerplateOptions,
  APIClientOptions,
  SDKOptions,
  SchemaOptions,
  TestOptions,
  DocsOptions
} from './types/index.js';

/**
 * CodeGen configuration
 */
export interface CodeGenConfig {
  llm?: LLMManager;
  defaultLanguage?: Language;
}

/**
 * Main CodeGen class
 */
export class CodeGen {
  private llm: LLMManager;
  private synthesizer: CodeSynthesizer;
  private boilerplateGenerator: BoilerplateGenerator;
  private apiClientGenerator: APIClientGenerator;
  private sdkGenerator: SDKGenerator;
  private schemaGenerator: SchemaGenerator;
  private testGenerator: TestGenerator;
  private docsGenerator: DocumentationGenerator;

  constructor(config: CodeGenConfig = {}) {
    this.llm = config.llm || createLLMManager();
    this.synthesizer = new CodeSynthesizer(this.llm);
    this.boilerplateGenerator = new BoilerplateGenerator();
    this.apiClientGenerator = new APIClientGenerator();
    this.sdkGenerator = new SDKGenerator();
    this.schemaGenerator = new SchemaGenerator();
    this.testGenerator = new TestGenerator();
    this.docsGenerator = new DocumentationGenerator();
  }

  /**
   * Generate code from natural language prompt
   */
  async synthesize(options: SynthesisOptions) {
    return this.synthesizer.synthesize(options);
  }

  /**
   * Refactor existing code
   */
  async refactor(code: string, language: Language, goals?: string[]) {
    return this.synthesizer.refactor(code, language, goals);
  }

  /**
   * Complete code snippet
   */
  async complete(code: string, language: Language, cursorPosition?: { line: number; column: number }) {
    return this.synthesizer.complete(code, language, cursorPosition);
  }

  /**
   * Explain code
   */
  async explain(code: string, language: Language, detailLevel?: 'brief' | 'detailed' | 'comprehensive') {
    return this.synthesizer.explain(code, language, detailLevel);
  }

  /**
   * Generate project boilerplate
   */
  async generateBoilerplate(options: BoilerplateOptions) {
    return this.boilerplateGenerator.generate(options);
  }

  /**
   * Generate API client
   */
  async generateAPIClient(options: APIClientOptions) {
    return this.apiClientGenerator.generate(options);
  }

  /**
   * Generate SDK
   */
  async generateSDK(options: SDKOptions) {
    return this.sdkGenerator.generate(options);
  }

  /**
   * Generate schema
   */
  async generateSchema(options: SchemaOptions) {
    return this.schemaGenerator.generate(options);
  }

  /**
   * Generate tests
   */
  async generateTests(options: TestOptions) {
    return this.testGenerator.generate(options);
  }

  /**
   * Generate documentation
   */
  async generateDocs(options: DocsOptions) {
    return this.docsGenerator.generate(options);
  }

  /**
   * Get LLM manager
   */
  getLLM(): LLMManager {
    return this.llm;
  }
}

/**
 * Create default CodeGen instance
 */
export function createCodeGen(config?: CodeGenConfig): CodeGen {
  return new CodeGen(config);
}

// Export all generators
export { CodeSynthesizer } from './synthesis/index.js';
export { BoilerplateGenerator } from './boilerplate/index.js';
export { APIClientGenerator } from './api/index.js';
export { SDKGenerator } from './sdk/index.js';
export { SchemaGenerator } from './schema/index.js';
export { TestGenerator } from './tests/index.js';
export { DocumentationGenerator } from './docs/index.js';
