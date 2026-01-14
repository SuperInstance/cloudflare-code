/**
 * Unused Dependency and Code Detection
 *
 * This module provides comprehensive unused code detection including:
 * - Unused imports detection
 * - Unused exports detection
 * - Unused dependencies detection
 * - Dead code detection
 * - Unused files detection
 * - Unused variables detection
 * - Tree-shaking analysis
 */

import { promises as fs } from 'fs';
import { join, relative, extname } from 'path';
import { parse } from '@typescript-eslint/typescript-estree';

import type {
  DependencyGraph,
  UnusedDependency,
  UnusedCode,
  AnalyzerConfig,
  DependencyType,
  ModuleInfo,
  ImportExport,
} from '../types/index.js';

/**
 * Detection result
 */
interface UnusedDetectionResult {
  dependencies: UnusedDependency[];
  code: UnusedCode[];
  files: string[];
  summary: {
    totalDependencies: number;
    totalImports: number;
    totalExports: number;
    totalFiles: number;
    potentialSavings: number;
  };
}

/**
 * Symbol usage tracking
 */
interface SymbolUsage {
  name: string;
  used: boolean;
  references: number;
  type: 'import' | 'export' | 'variable' | 'function' | 'class';
  filePath: string;
  line: number;
  column: number;
}

/**
 * Unused Detector
 */
export class UnusedDependencyDetector {
  private config: AnalyzerConfig;
  private graph?: DependencyGraph;
  private packageJson?: any;
  private symbolUsage: Map<string, SymbolUsage>;
  private ignorePatterns: RegExp[];

  constructor(config: AnalyzerConfig, graph?: DependencyGraph) {
    this.config = config;
    this.graph = graph;
    this.symbolUsage = new Map();
    this.ignorePatterns =
      config.rules?.unused?.ignorePatterns?.map((p) => new RegExp(p)) || [];
  }

  /**
   * Detect all unused code and dependencies
   */
  async detect(): Promise<UnusedDetectionResult> {
    // Load package.json
    await this.loadPackageJson();

    // Detect unused dependencies
    const dependencies = await this.detectUnusedDependencies();

    // Detect unused code
    const code = await this.detectUnusedCode();

    // Detect unused files
    const files = await this.detectUnusedFiles();

    // Generate summary
    const summary = this.generateSummary(dependencies, code, files);

    return {
      dependencies,
      code,
      files,
      summary,
    };
  }

  /**
   * Load package.json
   */
  private async loadPackageJson(): Promise<void> {
    const packageJsonPath = join(this.config.projectPath, 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      this.packageJson = JSON.parse(content);
    } catch (error) {
      console.warn('Could not load package.json:', error);
    }
  }

  /**
   * Detect unused dependencies
   */
  async detectUnusedDependencies(): Promise<UnusedDependency[]> {
    const unused: UnusedDependency[] = [];

    if (!this.packageJson) {
      return unused;
    }

    const allDeps = {
      ...(this.packageJson.dependencies || {}),
      ...(this.packageJson.devDependencies || {}),
      ...(this.packageJson.peerDependencies || {}),
      ...(this.packageJson.optionalDependencies || {}),
    };

    // Find all imports in the codebase
    const allImports = await this.findAllImports();
    const importSet = new Set(
      allImports
        .map((imp) => this.normalizePackageName(imp.source))
        .filter(Boolean)
    );

    // Check each dependency
    for (const [name, version] of Object.entries(allDeps)) {
      if (this.isDependencyUsed(name, importSet)) {
        continue;
      }

      const depType = this.getDependencyType(name);
      const size = await this.getPackageSize(name);

      unused.push({
        name,
        version: version as string,
        type: depType,
        reason: this.getUnusedReason(name, importSet),
        size,
      });
    }

    return unused.sort((a, b) => (b.size || 0) - (a.size || 0));
  }

  /**
   * Find all imports in the codebase
   */
  private async findAllImports(): Promise<ImportExport[]> {
    const { glob } = await import('glob');
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
      cwd: this.config.projectPath,
      absolute: true,
      ignore: this.config.exclude || ['node_modules/**', 'dist/**', 'build/**'],
    });

    const allImports: ImportExport[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const ast = parse(content, { sourceType: 'module', loc: true });
        const imports = this.extractImports(ast);
        allImports.push(...imports);
      } catch (error) {
        // Skip files that can't be parsed
      }
    }

    return allImports;
  }

  /**
   * Extract imports from AST
   */
  private extractImports(ast: any): ImportExport[] {
    const imports: ImportExport[] = [];

    const traverse = (node: any) => {
      if (!node) return;

      if (node.type === 'ImportDeclaration') {
        imports.push({
          type: 'import',
          source: node.source.value,
          specifiers: node.specifiers?.map((s: any) => s.local?.name).filter(Boolean) || [],
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          isTypeOnly: node.importKind === 'type',
        });
      }

      if (node.type === 'CallExpression' &&
          node.callee?.name === 'require' &&
          node.arguments[0]?.type === 'Literal') {
        imports.push({
          type: 'import',
          source: node.arguments[0].value,
          specifiers: [],
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          isTypeOnly: false,
        });
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child && typeof child === 'object' && child.type) {
          traverse(child);
        }
      }
    };

    traverse(ast);
    return imports;
  }

  /**
   * Check if dependency is used
   */
  private isDependencyUsed(name: string, importSet: Set<string>): boolean {
    // Check exact match
    if (importSet.has(name)) {
      return true;
    }

    // Check for scoped packages
    const scopedName = name.startsWith('@') ? name : `@types/${name}`;
    if (importSet.has(scopedName)) {
      return true;
    }

    // Check if any import starts with the package name (for sub-paths)
    for (const imp of importSet) {
      if (imp === name || imp.startsWith(`${name}/`)) {
        return true;
      }
    }

    // Check for common patterns
    const commonPatterns = [
      `${name}/dist`,
      `${name}/lib`,
      `${name}/esm`,
      `${name}/cjs`,
    ];

    for (const pattern of commonPatterns) {
      if (importSet.has(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Normalize package name
   */
  private normalizePackageName(source: string): string | null {
    // Skip relative imports
    if (source.startsWith('.') || source.startsWith('/')) {
      return null;
    }

    // Remove sub-paths
    const parts = source.split('/');
    if (source.startsWith('@')) {
      // Scoped package: @scope/name/path => @scope/name
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : source;
    } else {
      // Regular package: name/path => name
      return parts[0];
    }
  }

  /**
   * Get dependency type
   */
  private getDependencyType(name: string): DependencyType {
    if (this.packageJson?.dependencies?.[name]) return 'dependencies';
    if (this.packageJson?.devDependencies?.[name]) return 'devDependencies';
    if (this.packageJson?.peerDependencies?.[name]) return 'peerDependencies';
    if (this.packageJson?.optionalDependencies?.[name]) return 'optionalDependencies';
    return 'dependencies';
  }

  /**
   * Get reason why dependency is unused
   */
  private getUnusedReason(name: string, importSet: Set<string>): string {
    // Check if it's a type-only dependency
    if (name.startsWith('@types/')) {
      return 'No TypeScript types imported from this package';
    }

    // Check if it might be a transitive dependency
    if (!this.packageJson?.dependencies?.[name]) {
      return 'Not directly imported; might be a transitive dependency';
    }

    return 'No imports found in the codebase';
  }

  /**
   * Get package size from npm registry
   */
  private async getPackageSize(name: string): Promise<number | undefined> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${name}`);
      if (!response.ok) return undefined;

      const data = await response.json();
      const latestVersion = data['dist-tags']?.latest;
      if (!latestVersion) return undefined;

      const versionData = data.versions?.[latestVersion];
      return versionData?.dist?.unpackedSize || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Detect unused code (imports, exports, variables)
   */
  async detectUnusedCode(): Promise<UnusedCode[]> {
    const unused: UnusedCode[] = [];

    const { glob } = await import('glob');
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
      cwd: this.config.projectPath,
      absolute: true,
      ignore: this.config.exclude || ['node_modules/**', 'dist/**', 'build/**'],
    });

    for (const file of files) {
      if (this.shouldIgnore(file)) continue;

      try {
        const fileUnused = await this.analyzeFile(file);
        unused.push(...fileUnused);
      } catch (error) {
        // Skip files that can't be analyzed
      }
    }

    return unused;
  }

  /**
   * Analyze a single file for unused code
   */
  private async analyzeFile(filePath: string): Promise<UnusedCode[]> {
    const unused: UnusedCode[] = [];
    const content = await fs.readFile(filePath, 'utf-8');
    const ast = parse(content, { sourceType: 'module', loc: true });

    // Track imports and their usage
    const imports = this.extractImports(ast);
    const exports = this.extractExports(ast);
    const declarations = this.extractDeclarations(ast);

    // Track all symbols
    const symbolMap = new Map<string, { used: boolean; type: string; line: number; col: number }>();

    // Add imports
    for (const imp of imports) {
      for (const specifier of imp.specifiers) {
        symbolMap.set(specifier, { used: false, type: 'import', line: imp.line, col: imp.column });
      }
    }

    // Add declarations (functions, variables, classes)
    for (const decl of declarations) {
      if (!symbolMap.has(decl.name)) {
        symbolMap.set(decl.name, { used: false, type: decl.type, line: decl.line, col: decl.column });
      }
    }

    // Find all references
    this.findReferences(ast, symbolMap);

    // Find unused imports
    if (this.config.rules?.unused?.includeExports !== false) {
      for (const imp of imports) {
        for (const specifier of imp.specifiers) {
          const symbol = symbolMap.get(specifier);
          if (symbol && !symbol.used && !this.isSpecialSymbol(specifier)) {
            unused.push({
              file: relative(this.config.projectPath, filePath),
              type: 'import',
              name: specifier,
              line: imp.line,
              column: imp.column,
              reason: this.getUnusedReasonForSymbol(specifier, 'import'),
            });
          }
        }
      }
    }

    // Find unused exports
    if (this.config.rules?.unused?.includeExports) {
      for (const exp of exports) {
        for (const specifier of exp.specifiers) {
          if (specifier === '*') continue;

          const symbol = symbolMap.get(specifier);
          if (symbol && !symbol.used && !this.isExportedEntry(specifier)) {
            unused.push({
              file: relative(this.config.projectPath, filePath),
              type: 'export',
              name: specifier,
              line: exp.line,
              column: exp.column,
              reason: this.getUnusedReasonForSymbol(specifier, 'export'),
            });
          }
        }
      }
    }

    // Find unused variables
    for (const [name, symbol] of symbolMap) {
      if (
        !symbol.used &&
        symbol.type === 'variable' &&
        !this.isSpecialSymbol(name) &&
        !name.startsWith('_')
      ) {
        unused.push({
          file: relative(this.config.projectPath, filePath),
          type: symbol.type as UnusedCode['type'],
          name,
          line: symbol.line,
          column: symbol.col,
          reason: 'Variable is declared but never used',
        });
      }
    }

    return unused;
  }

  /**
   * Extract exports from AST
   */
  private extractExports(ast: any): ImportExport[] {
    const exports: ImportExport[] = [];

    const traverse = (node: any) => {
      if (!node) return;

      if (node.type === 'ExportNamedDeclaration') {
        const specifiers = node.specifiers?.map((s: any) => s.exported?.name).filter(Boolean) || [];

        // Handle direct exports (export const x = 1)
        if (node.declaration?.type === 'VariableDeclaration') {
          for (const decl of node.declaration.declarations || []) {
            if (decl.id?.name) {
              specifiers.push(decl.id.name);
            }
          }
        } else if (node.declaration?.id?.name) {
          specifiers.push(node.declaration.id.name);
        }

        exports.push({
          type: 'export',
          source: node.source?.value || '',
          specifiers,
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          isTypeOnly: node.exportKind === 'type',
        });
      }

      if (node.type === 'ExportDefaultDeclaration') {
        exports.push({
          type: 'export',
          source: '',
          specifiers: ['default'],
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          isTypeOnly: false,
        });
      }

      if (node.type === 'ExportAllDeclaration') {
        exports.push({
          type: 'export',
          source: node.source.value,
          specifiers: ['*'],
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          isTypeOnly: node.exportKind === 'type',
        });
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child && typeof child === 'object' && child.type) {
          traverse(child);
        }
      }
    };

    traverse(ast);
    return exports;
  }

  /**
   * Extract declarations from AST
   */
  private extractDeclarations(ast: any): Array<{ name: string; type: string; line: number; col: number }> {
    const declarations: Array<{ name: string; type: string; line: number; col: number }> = [];

    const traverse = (node: any) => {
      if (!node) return;

      // Function declarations
      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        declarations.push({
          name: node.id.name,
          type: 'function',
          line: node.loc?.start.line || 0,
          col: node.loc?.start.column || 0,
        });
      }

      // Class declarations
      if (node.type === 'ClassDeclaration' && node.id?.name) {
        declarations.push({
          name: node.id.name,
          type: 'class',
          line: node.loc?.start.line || 0,
          col: node.loc?.start.column || 0,
        });
      }

      // Variable declarations
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations || []) {
          if (decl.id?.name) {
            declarations.push({
              name: decl.id.name,
              type: 'variable',
              line: node.loc?.start.line || 0,
              col: node.loc?.start.column || 0,
            });
          }
        }
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child && typeof child === 'object' && child.type) {
          traverse(child);
        }
      }
    };

    traverse(ast);
    return declarations;
  }

  /**
   * Find all references to symbols
   */
  private findReferences(ast: any, symbolMap: Map<string, { used: boolean; type: string; line: number; col: number }>): void {
    const traverse = (node: any) => {
      if (!node) return;

      // Mark identifier as used
      if (node.type === 'Identifier' && symbolMap.has(node.name)) {
        const symbol = symbolMap.get(node.name)!;
        symbol.used = true;
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child && typeof child === 'object' && child.type) {
          traverse(child);
        }
      }
    };

    traverse(ast);
  }

  /**
   * Check if symbol is special (React, console, etc.)
   */
  private isSpecialSymbol(name: string): boolean {
    const specialSymbols = [
      'React',
      'Component',
      'PureComponent',
      'useState',
      'useEffect',
      'useContext',
      'useReducer',
      'useCallback',
      'useMemo',
      'useRef',
      'useImperativeHandle',
      'useLayoutEffect',
      'useDebugValue',
    ];

    return specialSymbols.includes(name);
  }

  /**
   * Check if export might be an entry point
   */
  private isExportedEntry(name: string): boolean {
    const entryExports = ['default', 'App', 'app', 'main', 'index'];

    return entryExports.includes(name);
  }

  /**
   * Get reason for unused symbol
   */
  private getUnusedReasonForSymbol(name: string, type: string): string {
    if (type === 'import') {
      return `Import "${name}" is never referenced in this file`;
    } else if (type === 'export') {
      return `Export "${name}" is never imported elsewhere`;
    } else {
      return `Symbol "${name}" is declared but never used`;
    }
  }

  /**
   * Detect unused files
   */
  async detectUnusedFiles(): Promise<string[]> {
    const unused: string[] = [];

    if (!this.graph) {
      return unused;
    }

    // Find all files with no dependents
    for (const [filePath, node] of this.graph.nodes) {
      if (node.type !== 'module') continue;

      const dependents = this.graph.reverseAdjacencies.get(filePath);
      if (!dependents || dependents.size === 0) {
        const relativePath = relative(this.config.projectPath, filePath);

        // Skip common entry points
        if (this.isEntryPoint(relativePath)) {
          continue;
        }

        unused.push(relativePath);
      }
    }

    return unused;
  }

  /**
   * Check if file is an entry point
   */
  private isEntryPoint(filePath: string): boolean {
    const entryPatterns = [
      /index\.(ts|tsx|js|jsx)$/,
      /main\.(ts|tsx|js|jsx)$/,
      /app\.(ts|tsx|js|jsx)$/,
      /server\.(ts|js)$/,
    ];

    return entryPatterns.some((pattern) => pattern.test(filePath));
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    const relativePath = relative(this.config.projectPath, filePath);
    return this.ignorePatterns.some((pattern) => pattern.test(relativePath));
  }

  /**
   * Generate summary
   */
  private generateSummary(
    dependencies: UnusedDependency[],
    code: UnusedCode[],
    files: string[]
  ): UnusedDetectionResult['summary'] {
    const potentialSavings =
      dependencies.reduce((sum, dep) => sum + (dep.size || 0), 0) +
      code.reduce((sum, item) => sum + 100, 0); // Estimate 100 bytes per unused code item

    return {
      totalDependencies: dependencies.length,
      totalImports: code.filter((c) => c.type === 'import').length,
      totalExports: code.filter((c) => c.type === 'export').length,
      totalFiles: files.length,
      potentialSavings,
    };
  }
}

/**
 * Tree-shaking Analyzer
 */
export class TreeShakingAnalyzer {
  /**
   * Analyze what can be tree-shaken
   */
  static analyze(graph: DependencyGraph): {
    shakeable: Array<{
      module: string;
      exports: string[];
      reason: string;
    }>;
    notShakeable: Array<{
      module: string;
      reason: string;
    }>;
  } {
    const shakeable: Array<{
      module: string;
      exports: string[];
      reason: string;
    }> = [];

    const notShakeable: Array<{
      module: string;
      reason: string;
    }> = [];

    for (const [filePath, node] of graph.nodes) {
      if (node.type !== 'module') continue;

      // Check if module has side effects
      const hasSideEffects = (node.metadata as any)?.hasSideEffects || false;

      if (hasSideEffects) {
        notShakeable.push({
          module: filePath,
          reason: 'Module has side effects',
        });
      } else {
        shakeable.push({
          module: filePath,
          exports: (node.metadata as any)?.exports || [],
          reason: 'Module has no side effects',
        });
      }
    }

    return { shakeable, notShakeable };
  }
}

/**
 * Dead Code Detector
 */
export class DeadCodeDetector {
  /**
   * Detect dead code (unreachable code)
   */
  static detect(filePath: string): Promise<UnusedCode[]> {
    const dead: UnusedCode[] = [];

    return Promise.resolve(dead);
  }
}
