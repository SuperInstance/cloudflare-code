/**
 * Core type definitions for the dependency analyzer
 */

/**
 * Supported package managers
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

/**
 * Severity levels for issues
 */
export type Severity = 'low' | 'moderate' | 'high' | 'critical';

/**
 * Dependency types
 */
export type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';

/**
 * License types
 */
export type LicenseType = 'permissive' | 'weak-copyleft' | 'strong-copyleft' | 'proprietary' | 'unknown';

/**
 * Graph node representing a module or package
 */
export interface GraphNode {
  id: string;
  label: string;
  type: 'module' | 'package' | 'file';
  path: string;
  metadata?: Record<string, unknown>;
}

/**
 * Graph edge representing a dependency relationship
 */
export interface GraphEdge {
  from: string;
  to: string;
  type: 'imports' | 'requires' | 'dynamic' | 'type-only';
  weight?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacencies: Map<string, Set<string>>;
  reverseAdjacencies: Map<string, Set<string>>;
}

/**
 * Circular dependency cycle
 */
export interface CircularCycle {
  path: string[];
  length: number;
  type: 'direct' | 'indirect';
  severity: Severity;
  suggestions: string[];
}

/**
 * Unused dependency
 */
export interface UnusedDependency {
  name: string;
  version: string;
  type: DependencyType;
  reason: string;
  size?: number;
}

/**
 * Unused import/export
 */
export interface UnusedCode {
  file: string;
  type: 'import' | 'export' | 'variable' | 'function' | 'class';
  name: string;
  line: number;
  column: number;
  reason: string;
}

/**
 * Dependency update information
 */
export interface DependencyUpdate {
  name: string;
  currentVersion: string;
  latestVersion: string;
  wantedVersion: string;
  type: 'major' | 'minor' | 'patch' | 'prerelease' | 'major-next';
  deprecated?: boolean;
  breaking?: boolean;
}

/**
 * License information
 */
export interface LicenseInfo {
  name: string;
  spdxId: string;
  type: LicenseType;
  url?: string;
  text?: string;
  compatible: boolean;
  risks: string[];
}

/**
 * Security vulnerability
 */
export interface Vulnerability {
  id: string;
  packageName: string;
  title: string;
  description: string;
  severity: Severity;
  cvss?: number;
  cwe?: string[];
  patchedVersions?: string[];
  recommendations: string[];
  references: string[];
  publishedDate: Date;
  updatedDate: Date;
}

/**
 * Bundle analysis result
 */
export interface BundleAnalysis {
  totalSize: number;
  dependencies: number;
  duplicates: DuplicateDependency[];
  treeShakeable: number;
  lazyLoadCandidates: LazyLoadCandidate[];
}

/**
 * Duplicate dependency
 */
export interface DuplicateDependency {
  name: string;
  versions: string[];
  count: number;
  totalSize: number;
  canDeduplicate: boolean;
}

/**
 * Lazy loading candidate
 */
export interface LazyLoadCandidate {
  file: string;
  import: string;
  reason: string;
  impact: number;
  suggested: string;
}

/**
 * Import/Export statement
 */
export interface ImportExport {
  type: 'import' | 'export' | 'dynamic-import';
  source: string;
  specifiers: string[];
  line: number;
  column: number;
  isTypeOnly: boolean;
}

/**
 * Module information
 */
export interface ModuleInfo {
  path: string;
  imports: ImportExport[];
  exports: ImportExport[];
  dependencies: string[];
  dependents: string[];
  size: number;
  hasSideEffects: boolean;
}

/**
 * Analyzer configuration
 */
export interface AnalyzerConfig {
  projectPath: string;
  packageManager: PackageManager;
  include?: string[];
  exclude?: string[];
  rules?: {
    circular?: {
      enabled: boolean;
      maxDepth: number;
      ignorePatterns?: string[];
    };
    unused?: {
      enabled: boolean;
      includeExports: boolean;
      ignorePatterns?: string[];
    };
    security?: {
      enabled: boolean;
      severity: Severity[];
      ignorePatterns?: string[];
    };
    license?: {
      enabled: boolean;
      allowedLicenses?: string[];
      deniedLicenses?: string[];
    };
  };
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  projectPath: string;
  timestamp: Date;
  packageManager: PackageManager;
  summary: {
    totalDependencies: number;
    totalModules: number;
    circularDependencies: number;
    unusedDependencies: number;
    vulnerabilities: number;
    licenseIssues: number;
  };
  graph?: DependencyGraph;
  cycles?: CircularCycle[];
  unused?: {
    dependencies: UnusedDependency[];
    code: UnusedCode[];
  };
  updates?: DependencyUpdate[];
  licenses?: Map<string, LicenseInfo>;
  vulnerabilities?: Vulnerability[];
  bundle?: BundleAnalysis;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  type: 'dedupe' | 'tree-shake' | 'lazy-load' | 'remove' | 'replace';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: {
    size: number;
    performance: number;
    complexity: number;
  };
  effort: 'easy' | 'medium' | 'hard';
  code?: string;
}

/**
 * Progress callback
 */
export type ProgressCallback = (current: number, total: number, message: string) => void;

/**
 * Node in AST traversal
 */
export interface ASTNode {
  type: string;
  name?: string;
  source?: string;
  line?: number;
  column?: number;
  children?: ASTNode[];
}

/**
 * Package metadata
 */
export interface PackageMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Version range
 */
export interface VersionRange {
  from: string;
  to: string;
  type: 'major' | 'minor' | 'patch';
}
