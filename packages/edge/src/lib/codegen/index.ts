/**
 * Code Generation Engine - Main Export
 *
 * Intelligent code generation with template-based and AI-powered synthesis,
 * code completion, validation, and multi-language support.
 *
 * Usage:
 * ```typescript
 * import {
 *   CodeGenerator,
 *   CodeCompletionEngine,
 *   CodeValidator,
 *   generateCode,
 *   getCompletions,
 *   validateCode,
 * } from '@claudeflare/edge/codegen';
 *
 * // Generate code
 * const result = await generateCode({
 *   type: 'function',
 *   language: 'typescript',
 *   description: 'Add two numbers',
 * });
 *
 * // Get completions
 * const completions = await getCompletions({
 *   code: 'function add(',
 *   language: 'typescript',
 *   cursor: { line: 0, column: 13 },
 * });
 *
 * // Validate code
 * const validation = await validateCode({
 *   code: 'function add(a: any, b: any) { return a + b; }',
 *   language: 'typescript',
 * });
 * ```
 */

// Types
export type {
  // Core types
  GenerationType,
  QualityCategory,
  Severity,
  TemplateContext,
  Template,
  TemplateVariable,
  TemplateExample,

  // Generation
  GenerationRequest,
  GenerationOptions,
  GenerationResult,
  GenerationMetadata,
  CodeStyle,
  NamingConvention,
  GenerationConstraints,
  BatchGenerationRequest,
  BatchGenerationResult,
  GenerationStats,

  // Completion
  CompletionRequest,
  CompletionResult,
  CompletionItem,
  CompletionKind,
  CompletionContext,
  CompletionOptions,
  CursorPosition,
  Symbol,
  Import,
  TextEdit,
  Range,
  Position,

  // Validation
  ValidationRequest,
  ValidationOptions,
  ValidationResult,
  ValidationIssue,
  ValidationRule,
  QualityMetrics,
  Fix,

  // Language
  LanguageGeneratorConfig,
  LanguageFeatures,
  BestPractice,
  CommonPattern,
} from './types';

// Template Engine
export {
  TemplateEngine,
  TEMPLATES_BY_LANGUAGE,
  getTemplatesByCategory,
  getTemplateById,
  searchTemplatesByTag,
  getTemplatesForLanguage,
  getAllTemplateIds,
} from './templates';

// Code Generator
export {
  CodeGenerator,
  createGenerator,
  setDefaultGenerator,
  getDefaultGenerator,
  generateCode,
} from './generator';

// Code Completion
export {
  CodeCompletionEngine,
  createCompletionEngine,
  setDefaultCompletionEngine,
  getDefaultCompletionEngine,
  getCompletions,
} from './completion';

// Code Validator
export {
  CodeValidator,
  createValidator,
  setDefaultValidator,
  getDefaultValidator,
  validateCode,
} from './validator';

// Language Generators
export {
  LanguageGenerator,
  TypeScriptGenerator,
  PythonGenerator,
  GoGenerator,
  RustGenerator,
  JavaGenerator,
  CSharpGenerator,
  CPPGenerator,
  RubyGenerator,
  PHPGenerator,
  SwiftGenerator,
  KotlinGenerator,
  getLanguageGenerator,
  getLanguageConfig,
} from './languages';

// Re-export for convenience
export type { SupportedLanguage } from '../codebase/types';
