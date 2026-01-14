/**
 * @claudeflare/refactor
 *
 * Automated refactoring and code transformation engine for ClaudeFlare.
 * Supports 10+ programming languages with AST-based transformations.
 *
 * @example
 * ```typescript
 * import { RefactoringEngine } from '@claudeflare/refactor';
 *
 * const engine = new RefactoringEngine();
 * const result = await engine.extractMethod(
 *   '/path/to/file.ts',
 *   10,
 *   20,
 *   'newMethod'
 * );
 * ```
 */

// Core refactoring engine
export { RefactoringEngine } from './refactor/engine';
export {
  RefactoringOperation,
  RefactoringOptions,
  RefactoringResult,
  CodeChange,
  UndoInfo,
  ExtractMethodOperation,
  InlineVariableOperation,
  InlineFunctionOperation,
  RenameSymbolOperation,
  MoveFileOperation,
  ChangeSignatureOperation,
  ExtractInterfaceOperation,
  IntroduceParameterOperation
} from './refactor/types';

// AST transformer
export { ASTTransformer, TransformOptions, ASTTransformResult } from './ast/transformer';

// Code modernizer
export {
  CodeModernizer,
  ModernizationOptions,
  ModernizationResult,
  ModernizationChange
} from './modernizer/modernizer';

// Migration manager
export {
  MigrationManager,
  MigrationOptions,
  MigrationResult,
  MigrationChange,
  MigrationPlan,
  MigrationStep,
  BreakingChange,
  MigrationType,
  FrameworkMigration,
  LibraryMigration,
  LanguageMigration,
  BreakingChangeMigration
} from './migration/manager';

// Dependency updater
export {
  DependencyUpdater,
  DependencyUpdateOptions,
  DependencyInfo,
  UpdateInfo,
  SecurityIssue,
  UpdateResult,
  RollbackInfo
} from './dependencies/updater';

// Type migrator
export {
  TypeMigrator,
  TypeMigrationOptions,
  TypeMigrationResult,
  InterfaceInfo,
  PropertyType,
  MethodType,
  ParameterType
} from './types/migrator';

// Type inference
export { TypeInferenceEngine, InferredType } from './types/inference';

// Interface generator
export {
  InterfaceGenerator,
  InterfaceGenerationOptions
} from './types/interface-generator';

// Auto fixer
export {
  AutoFixer,
  FixOptions,
  FixResult,
  Fix
} from './fix/fixer';

// Parser
export { parse, generate, ParseOptions, ParseResult } from './parsers/parser';

// Utilities
export { ScopeAnalyzer } from './utils/scope-analyzer';
export { ReferenceFinder, Reference } from './utils/reference-finder';
export { Formatter, CodeFormatter } from './utils/formatter';
export { GitIntegration, GitOptions } from './utils/git-integration';
export { Logger, LogLevel } from './utils/logger';
export { ChangeTracker, CodeChange as UtilCodeChange } from './utils/change-tracker';
export { CommentPreserver, CommentMap } from './utils/comment-preserver';
export { VersionUtils } from './utils/version-utils';

// Types
export * from './refactor/types';
export * from './ast/transformer';
export * from './modernizer/modernizer';
export * from './migration/manager';
export * from './dependencies/updater';
export * from './types/migrator';

/**
 * Create a refactoring engine with default options
 */
export function createRefactoringEngine(options?: RefactoringOptions): RefactoringEngine {
  const { RefactoringEngine } = require('./refactor/engine');
  return new RefactoringEngine(options);
}

/**
 * Create a code modernizer with default options
 */
export function createModernizer(options?: ModernizationOptions): CodeModernizer {
  const { CodeModernizer } = require('./modernizer/modernizer');
  return new CodeModernizer(options);
}

/**
 * Create a migration manager with default options
 */
export function createMigrationManager(options?: MigrationOptions): MigrationManager {
  const { MigrationManager } = require('./migration/manager');
  return new MigrationManager(options);
}

/**
 * Create a dependency updater with default options
 */
export function createDependencyUpdater(
  options?: DependencyUpdateOptions
): DependencyUpdater {
  const { DependencyUpdater } = require('./dependencies/updater');
  return new DependencyUpdater(options);
}

/**
 * Create a type migrator with default options
 */
export function createTypeMigrator(options?: TypeMigrationOptions): TypeMigrator {
  const { TypeMigrator } = require('./types/migrator');
  return new TypeMigrator(options);
}

/**
 * Create an auto fixer with default options
 */
export function createAutoFixer(options?: FixOptions): AutoFixer {
  const { AutoFixer } = require('./fix/fixer');
  return new AutoFixer(options);
}

// Version
export const VERSION = '0.1.0';

/**
 * Supported languages
 */
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'java',
  'go',
  'rust',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby'
] as const;

/**
 * Supported refactoring operations
 */
export const SUPPORTED_OPERATIONS = [
  'extractMethod',
  'inlineVariable',
  'inlineFunction',
  'renameSymbol',
  'moveFile',
  'changeSignature',
  'extractInterface',
  'introduceParameter'
] as const;
