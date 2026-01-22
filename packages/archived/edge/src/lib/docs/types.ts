/**
 * Documentation Generation System - Type Definitions
 *
 * Core types for auto-generating documentation from code including:
 * - API documentation from type definitions
 * - README generation from codebase
 * - Architecture diagrams from structure
 * - Tutorial generation
 * - Multi-format output (Markdown, HTML, PDF)
 */

/**
 * Supported output formats
 */
export type DocFormat = 'markdown' | 'html' | 'pdf' | 'json';

/**
 * Documentation types
 */
export type DocType =
  | 'api-reference'
  | 'user-guide'
  | 'architecture'
  | 'tutorial'
  | 'changelog'
  | 'contributing'
  | 'readme'
  | 'all';

/**
 * Docstring format types
 */
export type DocstringFormat =
  | 'jsdoc'
  | 'docstrings'
  | 'godoc'
  | 'rustdoc'
  | 'javadoc'
  | 'auto';

/**
 * Programming language for parsing
 */
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'shell'
  | 'sql';

/**
 * Symbol kind/type
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'constant'
  | 'variable'
  | 'method'
  | 'property'
  | 'namespace'
  | 'module';

/**
 * Access modifier
 */
export type AccessModifier = 'public' | 'private' | 'protected' | 'internal';

/**
 * Documentation symbol extracted from code
 */
export interface DocSymbol {
  id: string;
  name: string;
  kind: SymbolKind;
  access: AccessModifier;
  filePath: string;
  startLine: number;
  endLine: number;

  // Documentation
  description?: string;
  summary?: string;
  examples?: string[];
  deprecated?: boolean;
  since?: string;
  version?: string;

  // Type information
  signature?: string;
  returnType?: string;
  generics?: string[];
  typeParameters?: TypeParameter[];

  // Parameters (for functions/methods)
  parameters?: Parameter[];

  // Members (for classes/interfaces)
  members?: DocSymbol[];

  // Inheritance
  extends?: string[];
  implements?: string[];

  // Decorators/Annotations
  decorators?: string[];

  // Tags
  tags?: DocTag[];

  // Source code
  code?: string;

  // Metadata
  exported: boolean;
  static?: boolean;
  abstract?: boolean;
  readonly?: boolean;
  optional?: boolean;
}

/**
 * Type parameter
 */
export interface TypeParameter {
  name: string;
  constraint?: string;
  default?: string;
}

/**
 * Function/method parameter
 */
export interface Parameter {
  name: string;
  type: string;
  description?: string;
  optional: boolean;
  defaultValue?: string;
  rest: boolean;
}

/**
 * Documentation tag (e.g., @param, @return, @throws)
 */
export interface DocTag {
  name: string;
  value: string;
  type?: string;
}

/**
 * Parsed documentation from a file
 */
export interface ParsedDocumentation {
  filePath: string;
  language: SupportedLanguage;
  symbols: DocSymbol[];
  imports: Import[];
  exports: Export[];

  // File-level documentation
  fileDescription?: string;
  fileTags?: DocTag[];

  // Statistics
  stats: {
    totalSymbols: number;
    functions: number;
    classes: number;
    interfaces: number;
    types: number;
    exported: number;
    documented: number;
    documentationCoverage: number;
  };
}

/**
 * Import statement
 */
export interface Import {
  module: string;
  symbols: string[];
  isDefault: boolean;
  isDynamic: boolean;
  line: number;
}

/**
 * Export statement
 */
export interface Export {
  name: string;
  isDefault: boolean;
  type: SymbolKind;
  line: number;
}

/**
 * Generated documentation output
 */
export interface DocOutput {
  format: DocFormat;
  type: DocType;
  content: string;
  metadata: {
    version: string;
    generatedAt: number;
    sourceFiles: string[];
    symbols: number;
    formatVersion: string;
  };
}

/**
 * API reference section
 */
export interface APIReference {
  title: string;
  description?: string;
  symbols: DocSymbol[];
  categories: {
    name: string;
    symbols: DocSymbol[];
  }[];
}

/**
 * Architecture diagram node
 */
export interface DiagramNode {
  id: string;
  label: string;
  type: 'component' | 'service' | 'database' | 'queue' | 'cache' | 'external';
  description?: string;
  properties?: Record<string, string>;
}

/**
 * Architecture diagram edge (relationship)
 */
export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  type: 'depends' | 'implements' | 'extends' | 'uses' | 'flows';
  style?: 'solid' | 'dashed' | 'dotted';
}

/**
 * Architecture diagram
 */
export interface ArchitectureDiagram {
  title: string;
  description?: string;
  type: 'component' | 'deployment' | 'sequence' | 'flow' | 'class';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: {
    name: string;
    nodes: string[];
  }[];
}

/**
 * Tutorial step
 */
export interface TutorialStep {
  title: string;
  description: string;
  code?: string;
  language?: SupportedLanguage;
  filePath?: string;
  order: number;
}

/**
 * Tutorial
 */
export interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  steps: TutorialStep[];
  prerequisites?: string[];
  tags?: string[];
}

/**
 * Changelog entry
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
    description: string;
    issues?: string[];
  }[];
}

/**
 * Parser options
 */
export interface DocParserOptions {
  /**
   * Include private/protected members
   */
  includePrivate?: boolean;

  /**
   * Include internal members
   */
  includeInternal?: boolean;

  /**
   * Extract source code for symbols
   */
  includeSource?: boolean;

  /**
   * Docstring format (auto-detect if not specified)
   */
  docstringFormat?: DocstringFormat;

  /**
   * Files/patterns to exclude
   */
  exclude?: string[];

  /**
   * Files/patterns to include
   */
  include?: string[];

  /**
   * Maximum file size to parse (in bytes)
   */
  maxFileSize?: number;

  /**
   * Follow imports/exports
   */
  followImports?: boolean;
}

/**
 * Generator options
 */
export interface DocGeneratorOptions {
  /**
   * Output format(s)
   */
  format?: DocFormat[];

  /**
   * Documentation type(s) to generate
   */
  type?: DocType[];

  /**
   * Project name
   */
  projectName?: string;

  /**
   * Project version
   */
  version?: string;

  /**
   * Project description
   */
  description?: string;

  /**
   * Repository URL
   */
  repository?: string;

  /**
   * Homepage URL
   */
  homepage?: string;

  /**
   * Author information
   */
  author?: string;

  /**
   * License
   */
  license?: string;

  /**
   * Include table of contents
   */
  includeTOC?: boolean;

  /**
   * Include index
   */
  includeIndex?: boolean;

  /**
   * Include search index (for HTML)
   */
  includeSearch?: boolean;

  /**
   * Template to use
   */
  template?: string;

  /**
   * Custom template variables
   */
  templateVars?: Record<string, any>;

  /**
   * Output directory
   */
  outputDir?: string;

  /**
   * Group symbols by category
   */
  groupByCategory?: boolean;

  /**
   * Sort symbols
   */
  sortSymbols?: 'name' | 'kind' | 'line' | 'access';

  /**
   * Include type definitions
   */
  includeTypes?: boolean;

  /**
   * Include examples
   */
  includeExamples?: boolean;

  /**
   * Include diagrams
   */
  includeDiagrams?: boolean;

  /**
   * Include inherited members
   */
  includeInherited?: boolean;
}

/**
 * Diagram generator options
 */
export interface DiagramGeneratorOptions {
  /**
   * Diagram type
   */
  type?: ArchitectureDiagram['type'];

  /**
   * Include dependencies
   */
  includeDependencies?: boolean;

  /**
   * Include type relationships
   */
  includeTypes?: boolean;

  /**
   * Max depth for traversal
   */
  maxDepth?: number;

  /**
   * Exclude patterns
   */
  exclude?: string[];

  /**
   * Group by module/package
   */
  groupByModule?: boolean;

  /**
   * Output format
   */
  outputFormat?: 'mermaid' | 'plantuml' | 'dot';
}

/**
 * Template context
 */
export interface TemplateContext {
  projectName: string;
  version: string;
  description: string;
  repository: string;
  homepage: string;
  author: string;
  license: string;
  generatedAt: number;

  // Documentation
  apiReference: APIReference;
  symbols: DocSymbol[];
  categories: Record<string, DocSymbol[]>;

  // Architecture
  diagrams: ArchitectureDiagram[];

  // Tutorials
  tutorials: Tutorial[];

  // Changelog
  changelog: ChangelogEntry[];

  // Statistics
  stats: {
    totalSymbols: number;
    totalFiles: number;
    languages: Record<SupportedLanguage, number>;
    coverage: number;
  };

  // Custom variables
  custom: Record<string, any>;
}

/**
 * Generation result
 */
export interface GenerationResult {
  success: boolean;
  outputs: DocOutput[];
  errors: string[];
  warnings: string[];
  stats: {
    filesParsed: number;
    symbolsExtracted: number;
    docsGenerated: number;
    generationTime: number;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  file: string;
  line: number;
  symbol?: string;
  message: string;
  severity: 'error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  file: string;
  line: number;
  symbol?: string;
  message: string;
  severity: 'warning';
}

/**
 * Search index entry (for HTML documentation)
 */
export interface SearchIndexEntry {
  id: string;
  name: string;
  kind: SymbolKind;
  description: string;
  filePath: string;
  url: string;
  keywords: string[];
}
