/**
 * Code Generation Engine - Type Definitions
 *
 * Core types for template-based and AI-powered code generation,
 * completion, validation, and multi-language support.
 */

/**
 * Code generation types
 */

// Re-export SupportedLanguage
export type { SupportedLanguage } from '../codebase/types';
export type GenerationType =
  | 'boilerplate'      // Project scaffolding, file templates
  | 'function'         // Method/function generation
  | 'class'            // Class structure generation
  | 'interface'        // Interface/type generation
  | 'api'              // REST/GraphQL endpoints
  | 'test'             // Unit test generation
  | 'migration'        // Database schema changes
  | 'documentation'    // Docstrings and comments
  | 'component'        // UI components
  | 'hook'             // React/custom hooks
  | 'middleware'       // Middleware functions
  | 'validator'        // Input validation
  | 'utility'          // Utility functions
  | 'config'           // Configuration files
  | 'script'           // Build/deploy scripts
  | 'workflow';        // CI/CD workflows

/**
 * Code quality categories
 */
export type QualityCategory =
  | 'type-safety'
  | 'naming'
  | 'error-handling'
  | 'security'
  | 'performance'
  | 'complexity'
  | 'documentation'
  | 'testing'
  | 'maintainability'
  | 'best-practices';

/**
 * Severity levels for issues
 */
export type Severity = 'error' | 'warning' | 'info' | 'suggestion';

/**
 * Template context variables
 */
export interface TemplateContext {
  name: string;
  language: SupportedLanguage;
  generationType: GenerationType;
  description?: string;
  parameters?: Record<string, any>;
  metadata?: Record<string, any>;
  dependencies?: string[];
  imports?: string[];
  exports?: string[];
  // Custom context for extensibility
  [key: string]: any;
}

/**
 * Template definition
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  category: GenerationType;
  language: SupportedLanguage;
  template: string;
  variables: TemplateVariable[];
  examples?: TemplateExample[];
  tags?: string[];
  priority?: number;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'code';
  description: string;
  required: boolean;
  default?: any;
  options?: any[];
  validation?: (value: any) => boolean | string;
}

/**
 * Template example
 */
export interface TemplateExample {
  description: string;
  context: Partial<TemplateContext>;
  output: string;
}

/**
 * Code generation request
 */
export interface GenerationRequest {
  type: GenerationType;
  language: SupportedLanguage;
  description: string;
  context?: TemplateContext;
  template?: string;
  templateId?: string;
  options?: GenerationOptions;
  constraints?: GenerationConstraints;
  qualityChecks?: QualityCategory[];
}

/**
 * Code generation options
 */
export interface GenerationOptions {
  /**
   * Include type annotations
   */
  includeTypes?: boolean;

  /**
   * Include error handling
   */
  includeErrorHandling?: boolean;

  /**
   * Include documentation
   */
  includeDocumentation?: boolean;

  /**
   * Include tests
   */
  includeTests?: boolean;

  /**
   * Code style preferences
   */
  style?: CodeStyle;

  /**
   * Framework preferences
   */
  framework?: string;

  /**
   * Use AI for generation (vs template-only)
   */
  useAI?: boolean;

  /**
   * Temperature for AI generation (0-1)
   */
  temperature?: number;

  /**
   * Max tokens for generation
   */
  maxTokens?: number;

  /**
   * Number of variations to generate
   */
  variations?: number;

  /**
   * Include imports/dependencies
   */
  includeImports?: boolean;

  /**
   * Format output code
   */
  format?: boolean;
}

/**
 * Code style preferences
 */
export interface CodeStyle {
  indentation?: 'spaces' | 'tabs';
  indentSize?: number;
  lineWidth?: number;
  semicolons?: boolean;
  quotes?: 'single' | 'double' | 'backtick';
  trailingCommas?: boolean;
  spacing?: 'compact' | 'relaxed' | 'standard';
  naming?: NamingConvention;
}

/**
 * Naming conventions
 */
export interface NamingConvention {
  variables?: 'camelCase' | 'snake_case' | 'PascalCase' | 'UPPER_CASE';
  functions?: 'camelCase' | 'snake_case';
  classes?: 'PascalCase';
  constants?: 'UPPER_CASE' | 'camelCase';
  interfaces?: 'PascalCase'; // Can add 'I' prefix for C#
  types?: 'PascalCase';
  files?: 'kebab-case' | 'snake_case' | 'PascalCase';
}

/**
 * Generation constraints
 */
export interface GenerationConstraints {
  /**
   * Maximum complexity (cyclomatic complexity)
   */
  maxComplexity?: number;

  /**
   * Maximum lines of code
   */
  maxLines?: number;

  /**
   * Maximum function length
   */
  maxFunctionLength?: number;

  /**
   * Maximum parameters
   */
  maxParameters?: number;

  /**
   * Maximum nesting depth
   */
  maxNestingDepth?: number;

  /**
   * Forbidden patterns
   */
  forbiddenPatterns?: string[];

  /**
   * Required patterns
   */
  requiredPatterns?: string[];

  /**
   * Performance constraints
   */
  performance?: {
    maxTimeComplexity?: string;
    maxSpaceComplexity?: string;
    allowLoops?: boolean;
    allowRecursion?: boolean;
  };
}

/**
 * Code generation result
 */
export interface GenerationResult {
  success: boolean;
  code: string;
  language: SupportedLanguage;
  type: GenerationType;
  metadata: GenerationMetadata;
  variations?: string[];
  issues?: ValidationIssue[];
  suggestions?: string[];
  dependencies?: string[];
}

/**
 * Generation metadata
 */
export interface GenerationMetadata {
  template?: string;
  templateId?: string;
  generatedAt: number;
  generationTime: number;
  confidence: number;
  method: 'template' | 'ai' | 'hybrid';
  tokensUsed?: number;
  modelUsed?: string;
}

/**
 * Code completion request
 */
export interface CompletionRequest {
  code: string;
  language: SupportedLanguage;
  cursor: CursorPosition;
  context?: CompletionContext;
  options?: CompletionOptions;
}

/**
 * Cursor position
 */
export interface CursorPosition {
  line: number;
  column: number;
  offset?: number;
}

/**
 * Completion context
 */
export interface CompletionContext {
  filePath?: string;
  imports?: Import[];
  symbols?: Symbol[];
  ast?: any;
  surroundingCode?: {
    before: string;
    after: string;
  };
  conversationHistory?: Array<{
    role: string;
    content: string;
  }>;
}

/**
 * Import statement
 */
export interface Import {
  module: string;
  symbols: string[];
  isDefault: boolean;
  isTypeOnly?: boolean;
  line: number;
}

/**
 * Symbol definition
 */
export interface Symbol {
  name: string;
  kind: 'variable' | 'function' | 'class' | 'interface' | 'type' | 'enum' | 'constant';
  type?: string;
  definition: {
    line: number;
    column: number;
  };
  references?: Array<{
    line: number;
    column: number;
  }>;
}

/**
 * Completion options
 */
export interface CompletionOptions {
  maxResults?: number;
  includeSnippets?: boolean;
  includeDocumentation?: boolean;
  triggerCharacters?: string[];
  debounceMs?: number;
  prioritizeBasedOnContext?: boolean;
}

/**
 * Code completion result
 */
export interface CompletionResult {
  items: CompletionItem[];
  context: CompletionContext;
  isIncomplete?: boolean;
}

/**
 * Completion item
 */
export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  insertTextFormat?: 'plaintext' | 'snippet';
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  score?: number;
  additionalTextEdits?: TextEdit[];
  commitCharacters?: string[];
}

/**
 * Completion item kinds
 */
export type CompletionKind =
  | 'function'
  | 'method'
  | 'variable'
  | 'field'
  | 'property'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'constant'
  | 'keyword'
  | 'snippet'
  | 'file'
  | 'module'
  | 'operator'
  | 'text';

/**
 * Text edit
 */
export interface TextEdit {
  range: Range;
  newText: string;
}

/**
 * Range in text
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Position in text
 */
export interface Position {
  line: number;
  character: number;
}

/**
 * Validation request
 */
export interface ValidationRequest {
  code: string;
  language: SupportedLanguage;
  categories?: QualityCategory[];
  options?: ValidationOptions;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /**
   * Fix issues automatically
   */
  autoFix?: boolean;

  /**
   * Suggest fixes
   */
  suggestFixes?: boolean;

  /**
   * Severity threshold
   */
  severityThreshold?: Severity;

  /**
   * Custom rules
   */
  customRules?: ValidationRule[];

  /**
   * Check for security vulnerabilities
   */
  checkSecurity?: boolean;

  /**
   * Check for performance issues
   */
  checkPerformance?: boolean;

  /**
   * Check for best practices
   */
  checkBestPractices?: boolean;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  id: string;
  name: string;
  category: QualityCategory;
  severity: Severity;
  description: string;
  pattern?: string | RegExp;
  check: (code: string, ast?: any) => ValidationResult;
  fix?: (code: string) => string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  metrics?: QualityMetrics;
  suggestions?: string[];
  fixedCode?: string;
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  id: string;
  category: QualityCategory;
  severity: Severity;
  message: string;
  description?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  fix?: Fix;
  rule?: string;
}

/**
 * Fix suggestion
 */
export interface Fix {
  description: string;
  edits: TextEdit[];
  automated: boolean;
}

/**
 * Quality metrics
 */
export interface QualityMetrics {
  complexity: number;
  maintainabilityIndex: number;
  linesOfCode: number;
  commentRatio: number;
  duplicationRatio: number;
  testCoverage?: number;
  technicalDebt?: number;
  score: number; // 0-100
}

/**
 * Language-specific generator config
 */
export interface LanguageGeneratorConfig {
  language: SupportedLanguage;
  extensions: string[];
  lineComment: string[];
  blockComment: [string, string];
  indentation: 'spaces' | 'tabs';
  indentSize: number;
  features: LanguageFeatures;
  bestPractices: BestPractice[];
  commonPatterns: CommonPattern[];
}

/**
 * Language features
 */
export interface LanguageFeatures {
  staticTyping: boolean;
  classes: boolean;
  interfaces: boolean;
  generics: boolean;
  asyncAwait: boolean;
  decorators: boolean;
  macros: boolean;
  operatorOverloading: boolean;
  patternMatching: boolean;
  modules: boolean;
  nullSafety: boolean;
}

/**
 * Best practice for a language
 */
export interface BestPractice {
  id: string;
  name: string;
  description: string;
  category: QualityCategory;
  example: string;
  counterExample?: string;
}

/**
 * Common code pattern
 */
export interface CommonPattern {
  name: string;
  description: string;
  template: string;
  useCases: string[];
}

/**
 * Code snippet for training
 */
export interface CodeSnippet {
  id: string;
  code: string;
  language: SupportedLanguage;
  type: GenerationType;
  description: string;
  tags: string[];
  quality: number; // 0-1 score
  metadata: Record<string, any>;
}

/**
 * Batch generation request
 */
export interface BatchGenerationRequest {
  requests: GenerationRequest[];
  options?: GenerationOptions;
  parallel?: boolean;
}

/**
 * Batch generation result
 */
export interface BatchGenerationResult {
  results: GenerationResult[];
  totalGenerationTime: number;
  successCount: number;
  failureCount: number;
  errors: string[];
}

/**
 * Code generation statistics
 */
export interface GenerationStats {
  totalGenerations: number;
  generationsByType: Record<GenerationType, number>;
  generationsByLanguage: Record<SupportedLanguage, number>;
  avgGenerationTime: number;
  successRate: number;
  avgTokensUsed: number;
  cacheHitRate: number;
  mostUsedTemplates: Array<{ template: string; count: number }>;
  lastReset: number;
}

/**
 * Template cache entry
 */
export interface TemplateCacheEntry {
  template: Template;
  rendered?: string;
  lastUsed: number;
  useCount: number;
}

/**
 * Generator configuration
 */
export interface GeneratorConfig {
  /**
   * Default generation options
   */
  defaults?: GenerationOptions;

  /**
   * Template directories
   */
  templateDirectories?: string[];

  /**
   * Enable template caching
   */
  enableCache?: boolean;

  /**
   * Cache size limit
   */
  cacheSize?: number;

  /**
   * AI provider for generation
   */
  aiProvider?: string;

  /**
   * AI model to use
   */
  aiModel?: string;

  /**
   * Timeout for generation (ms)
   */
  timeout?: number;

  /**
   * Max retries for AI generation
   */
  maxRetries?: number;

  /**
   * Enable telemetry
   */
  telemetry?: boolean;

  /**
   * Custom validators
   */
  customValidators?: ValidationRule[];

  /**
   * Language-specific configs
   */
  languageConfigs?: Map<SupportedLanguage, LanguageGeneratorConfig>;
}

/**
 * Code transformation request
 */
export interface TransformRequest {
  code: string;
  from: SupportedLanguage;
  to: SupportedLanguage;
  options?: TransformOptions;
}

/**
 * Code transformation options
 */
export interface TransformOptions {
  preserveComments?: boolean;
  preserveLogic?: boolean;
  adaptIdioms?: boolean;
  includeImports?: boolean;
  format?: boolean;
}

/**
 * Code transformation result
 */
export interface TransformResult {
  success: boolean;
  code: string;
  warnings?: string[];
  errors?: string[];
  confidence: number;
}
