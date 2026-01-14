/**
 * Dependency Graph Construction and Analysis
 *
 * This module provides comprehensive dependency graph capabilities including:
 * - Graph construction from source code
 * - Graph visualization
 * - Graph analysis algorithms
 * - Dependency tree generation
 * - Module relationship mapping
 * - Import/export analysis
 */

import { promises as fs } from 'fs';
import { join, relative, dirname } from 'path';
import { parse } from '@typescript-eslint/typescript-estree';
import * as ts from 'typescript';

import type {
  DependencyGraph,
  GraphNode,
  GraphEdge,
  ImportExport,
  ModuleInfo,
  AnalyzerConfig,
  ASTNode,
} from '../types/index.js';

/**
 * Dependency Graph class for construction and analysis
 */
export class DependencyGraphBuilder {
  private graph: DependencyGraph;
  private config: AnalyzerConfig;
  private moduleCache: Map<string, ModuleInfo>;
  private astCache: Map<string, ASTNode>;

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.graph = this.initializeGraph();
    this.moduleCache = new Map();
    this.astCache = new Map();
  }

  /**
   * Initialize empty graph structure
   */
  private initializeGraph(): DependencyGraph {
    return {
      nodes: new Map(),
      edges: [],
      adjacencies: new Map(),
      reverseAdjacencies: new Map(),
    };
  }

  /**
   * Build the complete dependency graph
   */
  async build(): Promise<DependencyGraph> {
    const startTime = Date.now();

    // Step 1: Find all source files
    const sourceFiles = await this.findSourceFiles();

    // Step 2: Parse each file and build AST
    await this.parseAllFiles(sourceFiles);

    // Step 3: Build dependency relationships
    this.buildDependencies();

    // Step 4: Optimize graph
    this.optimizeGraph();

    const duration = Date.now() - startTime;
    console.log(`Graph built in ${duration}ms with ${this.graph.nodes.size} nodes and ${this.graph.edges.length} edges`);

    return this.graph;
  }

  /**
   * Find all source files based on config
   */
  private async findSourceFiles(): Promise<string[]> {
    const { glob } = await import('glob');
    const files: string[] = [];

    for (const pattern of this.config.include || ['**/*.{ts,tsx,js,jsx}']) {
      const matched = await glob(pattern, {
        cwd: this.config.projectPath,
        absolute: true,
        ignore: this.config.exclude || ['node_modules/**', 'dist/**', 'build/**'],
      });
      files.push(...matched);
    }

    return [...new Set(files)]; // Deduplicate
  }

  /**
   * Parse all source files and extract imports/exports
   */
  private async parseAllFiles(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await this.parseFile(file);
      } catch (error) {
        console.warn(`Failed to parse ${file}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  /**
   * Parse a single file and extract dependencies
   */
  private async parseFile(filePath: string): Promise<ModuleInfo> {
    // Check cache first
    if (this.moduleCache.has(filePath)) {
      return this.moduleCache.get(filePath)!;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = relative(this.config.projectPath, filePath);

    // Parse AST based on file type
    const ast = this.isTypeScriptFile(filePath)
      ? parse(content, { sourceType: 'module', loc: true })
      : this.parseJavaScript(content);

    // Extract imports and exports
    const imports = this.extractImports(ast, filePath);
    const exports = this.extractExports(ast, filePath);

    // Resolve dependencies
    const dependencies = await this.resolveDependencies(imports, filePath);

    // Create module info
    const moduleInfo: ModuleInfo = {
      path: filePath,
      imports,
      exports,
      dependencies,
      dependents: [],
      size: content.length,
      hasSideEffects: this.detectSideEffects(ast),
    };

    // Cache module info
    this.moduleCache.set(filePath, moduleInfo);

    // Add node to graph
    this.addNode({
      id: filePath,
      label: relativePath,
      type: 'module',
      path: filePath,
      metadata: {
        imports: imports.length,
        exports: exports.length,
        size: content.length,
      },
    });

    // Add edges for dependencies
    for (const dep of dependencies) {
      this.addEdge(filePath, dep, 'imports');
    }

    return moduleInfo;
  }

  /**
   * Check if file is TypeScript
   */
  private isTypeScriptFile(filePath: string): boolean {
    return /\.(ts|tsx)$/.test(filePath);
  }

  /**
   * Parse JavaScript using Acorn
   */
  private parseJavaScript(content: string): ASTNode {
    const acorn = require('acorn');
    return acorn.parse(content, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      locations: true,
    });
  }

  /**
   * Extract all import statements from AST
   */
  private extractImports(ast: any, filePath: string): ImportExport[] {
    const imports: ImportExport[] = [];

    const traverse = (node: any) => {
      if (!node) return;

      // ES6 import
      if (node.type === 'ImportDeclaration') {
        const specifiers = this.extractImportSpecifiers(node);
        imports.push({
          type: 'import',
          source: node.source.value,
          specifiers,
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          isTypeOnly: node.importKind === 'type',
        });
      }

      // Dynamic import
      if (node.type === 'ImportExpression') {
        imports.push({
          type: 'dynamic-import',
          source: node.source.value || node.source.name,
          specifiers: [],
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          isTypeOnly: false,
        });
      }

      // CommonJS require
      if (node.type === 'CallExpression' &&
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require') {
        if (node.arguments[0]?.type === 'Literal') {
          imports.push({
            type: 'import',
            source: node.arguments[0].value,
            specifiers: [],
            line: node.loc?.start.line || 0,
            column: node.loc?.start.column || 0,
            isTypeOnly: false,
          });
        }
      }

      // Traverse children
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
   * Extract import specifiers from import declaration
   */
  private extractImportSpecifiers(node: any): string[] {
    const specifiers: string[] = [];

    for (const spec of node.specifiers || []) {
      if (spec.type === 'ImportDefaultSpecifier') {
        specifiers.push(spec.local.name);
      } else if (spec.type === 'ImportSpecifier') {
        specifiers.push(spec.imported.name);
      } else if (spec.type === 'ImportNamespaceSpecifier') {
        specifiers.push(`* as ${spec.local.name}`);
      }
    }

    return specifiers;
  }

  /**
   * Extract all export statements from AST
   */
  private extractExports(ast: any, filePath: string): ImportExport[] {
    const exports: ImportExport[] = [];

    const traverse = (node: any) => {
      if (!node) return;

      // Named export
      if (node.type === 'ExportNamedDeclaration') {
        const specifiers = this.extractExportSpecifiers(node);
        exports.push({
          type: 'export',
          source: node.source?.value || '',
          specifiers,
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          isTypeOnly: node.exportKind === 'type',
        });
      }

      // Default export
      if (node.type === 'ExportDefaultDeclaration') {
        const name = node.declaration?.id?.name || 'default';
        exports.push({
          type: 'export',
          source: '',
          specifiers: [name],
          line: node.loc?.start.line || 0,
          column: node.loc?.start.column || 0,
          isTypeOnly: false,
        });
      }

      // Export all
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

      // Traverse children
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
   * Extract export specifiers from export declaration
   */
  private extractExportSpecifiers(node: any): string[] {
    const specifiers: string[] = [];

    for (const spec of node.specifiers || []) {
      if (spec.type === 'ExportSpecifier') {
        specifiers.push(spec.exported.name);
      }
    }

    // Direct exports from declaration
    if (node.declaration?.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations || []) {
        if (decl.id?.name) {
          specifiers.push(decl.id.name);
        }
      }
    } else if (node.declaration?.id?.name) {
      specifiers.push(node.declaration.id.name);
    }

    return specifiers;
  }

  /**
   * Resolve import paths to actual file paths
   */
  private async resolveDependencies(
    imports: ImportExport[],
    filePath: string
  ): Promise<string[]> {
    const dependencies: string[] = [];
    const fileDir = dirname(filePath);

    for (const imp of imports) {
      // Skip type-only imports
      if (imp.isTypeOnly) continue;

      // Skip node_modules imports for now
      if (!this.isLocalImport(imp.source)) {
        continue;
      }

      const resolved = await this.resolveImportPath(imp.source, fileDir);
      if (resolved) {
        dependencies.push(resolved);
      }
    }

    return dependencies;
  }

  /**
   * Check if import is a local file import
   */
  private isLocalImport(source: string): boolean {
    return source.startsWith('.') || source.startsWith('/');
  }

  /**
   * Resolve import path to actual file
   */
  private async resolveImportPath(
    source: string,
    fromDir: string
  ): Promise<string | null> {
    const possiblePaths = this.generatePossiblePaths(source, fromDir);

    for (const path of possiblePaths) {
      try {
        await fs.access(path);
        return path;
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  /**
   * Generate possible file paths for import
   */
  private generatePossiblePaths(source: string, fromDir: string): string[] {
    const paths: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.js'];

    // Direct path
    paths.push(join(fromDir, source));

    // With extensions
    for (const ext of extensions) {
      paths.push(join(fromDir, source + ext));
    }

    return paths;
  }

  /**
   * Detect if module has side effects
   */
  private detectSideEffects(ast: any): boolean {
    let hasSideEffects = false;

    const traverse = (node: any) => {
      if (!node) return;

      // Top-level expressions might have side effects
      if (node.type === 'ExpressionStatement') {
        hasSideEffects = true;
      }

      // Class decorators
      if (node.type === 'ClassDeclaration' && node.decorators?.length > 0) {
        hasSideEffects = true;
      }

      // Traverse children
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
    return hasSideEffects;
  }

  /**
   * Build dependency relationships
   */
  private buildDependencies(): void {
    for (const [filePath, module] of this.moduleCache) {
      for (const dep of module.dependencies) {
        // Add reverse edge
        if (!this.graph.reverseAdjacencies.has(dep)) {
          this.graph.reverseAdjacencies.set(dep, new Set());
        }
        this.graph.reverseAdjacencies.get(dep)!.add(filePath);

        // Update module info
        const depModule = this.moduleCache.get(dep);
        if (depModule) {
          depModule.dependents.push(filePath);
        }
      }
    }
  }

  /**
   * Optimize graph by removing redundant edges
   */
  private optimizeGraph(): void {
    // Remove transitive edges
    const toRemove = new Set<string>();

    for (const [from, neighbors] of this.graph.adjacencies) {
      for (const to of neighbors) {
        if (this.isTransitiveEdge(from, to)) {
          toRemove.add(`${from}->${to}`);
        }
      }
    }

    this.graph.edges = this.graph.edges.filter(
      (edge) => !toRemove.has(`${edge.from}->${edge.to}`)
    );
  }

  /**
   * Check if edge is transitive
   */
  private isTransitiveEdge(from: string, to: string): boolean {
    const neighbors = this.graph.adjacencies.get(from);
    if (!neighbors) return false;

    for (const neighbor of neighbors) {
      if (neighbor !== to) {
        const neighborNeighbors = this.graph.adjacencies.get(neighbor);
        if (neighborNeighbors?.has(to)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Add a node to the graph
   */
  private addNode(node: GraphNode): void {
    this.graph.nodes.set(node.id, node);
    if (!this.graph.adjacencies.has(node.id)) {
      this.graph.adjacencies.set(node.id, new Set());
    }
    if (!this.graph.reverseAdjacencies.has(node.id)) {
      this.graph.reverseAdjacencies.set(node.id, new Set());
    }
  }

  /**
   * Add an edge to the graph
   */
  private addEdge(from: string, to: string, type: GraphEdge['type']): void {
    if (!this.graph.adjacencies.has(from)) {
      this.graph.adjacencies.set(from, new Set());
    }
    this.graph.adjacencies.get(from)!.add(to);

    this.graph.edges.push({
      from,
      to,
      type,
      weight: 1,
    });
  }

  /**
   * Get the built graph
   */
  getGraph(): DependencyGraph {
    return this.graph;
  }

  /**
   * Get module info for a file
   */
  getModuleInfo(filePath: string): ModuleInfo | undefined {
    return this.moduleCache.get(filePath);
  }

  /**
   * Get all modules
   */
  getAllModules(): ModuleInfo[] {
    return Array.from(this.moduleCache.values());
  }

  /**
   * Find shortest path between two modules
   */
  findShortestPath(from: string, to: string): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [
      { node: from, path: [from] },
    ];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === to) {
        return path;
      }

      if (visited.has(node)) continue;
      visited.add(node);

      const neighbors = this.graph.adjacencies.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({
            node: neighbor,
            path: [...path, neighbor],
          });
        }
      }
    }

    return null;
  }

  /**
   * Get all paths between two modules
   */
  findAllPaths(from: string, to: string, maxDepth: number = 10): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: string[], depth: number) => {
      if (depth > maxDepth) return;

      if (current === to && path.length > 1) {
        paths.push([...path]);
        return;
      }

      visited.add(current);

      const neighbors = this.graph.adjacencies.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor], depth + 1);
        }
      }

      visited.delete(current);
    };

    dfs(from, [from], 0);
    return paths;
  }

  /**
   * Calculate graph metrics
   */
  calculateMetrics() {
    const metrics = {
      nodes: this.graph.nodes.size,
      edges: this.graph.edges.length,
      avgDegree: 0,
      maxDegree: 0,
      connectedComponents: 0,
      density: 0,
    };

    if (metrics.nodes > 0) {
      let totalDegree = 0;
      let maxDegree = 0;

      for (const [node, neighbors] of this.graph.adjacencies) {
        const degree = neighbors.size + (this.graph.reverseAdjacencies.get(node)?.size || 0);
        totalDegree += degree;
        maxDegree = Math.max(maxDegree, degree);
      }

      metrics.avgDegree = totalDegree / metrics.nodes;
      metrics.maxDegree = maxDegree;
      metrics.density = metrics.edges / (metrics.nodes * (metrics.nodes - 1) / 2);
    }

    return metrics;
  }
}

/**
 * Graph visualization utilities
 */
export class GraphVisualizer {
  /**
   * Generate DOT format for Graphviz
   */
  static toDot(graph: DependencyGraph): string {
    const lines: string[] = ['digraph dependencies {'];
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box];');
    lines.push('');

    // Add nodes
    for (const [id, node] of graph.nodes) {
      const label = node.label.replace(/"/g, '\\"');
      lines.push(`  "${id}" [label="${label}"];`);
    }

    lines.push('');

    // Add edges
    for (const edge of graph.edges) {
      const style = edge.type === 'dynamic' ? 'dashed' : 'solid';
      lines.push(`  "${edge.from}" -> "${edge.to}" [style=${style}];`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generate JSON format for visualization libraries
   */
  static toJSON(graph: DependencyGraph): string {
    const nodes = Array.from(graph.nodes.values()).map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      metadata: node.metadata,
    }));

    const links = graph.edges.map((edge) => ({
      source: edge.from,
      target: edge.to,
      type: edge.type,
      weight: edge.weight,
    }));

    return JSON.stringify({ nodes, links }, null, 2);
  }

  /**
   * Generate Mermaid.js format
   */
  static toMermaid(graph: DependencyGraph): string {
    const lines: string[] = ['graph TD'];

    for (const edge of graph.edges) {
      const from = graph.nodes.get(edge.from)?.label || edge.from;
      const to = graph.nodes.get(edge.to)?.label || edge.to;
      lines.push(`  ${from.replace(/\s+/g, '_')} --> ${to.replace(/\s+/g, '_')}`);
    }

    return lines.join('\n');
  }
}

/**
 * Graph analysis utilities
 */
export class GraphAnalyzer {
  constructor(private graph: DependencyGraph) {}

  /**
   * Find strongly connected components (using Kosaraju's algorithm)
   */
  findStronglyConnectedComponents(): string[][] {
    const visited = new Set<string>();
    const order: string[] = [];

    // First pass: build order
    const dfs1 = (node: string) => {
      visited.add(node);
      const neighbors = this.graph.adjacencies.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs1(neighbor);
        }
      }
      order.push(node);
    };

    for (const node of this.graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs1(node);
      }
    }

    // Second pass: find components
    visited.clear();
    const components: string[][] = [];

    const dfs2 = (node: string, component: string[]) => {
      visited.add(node);
      component.push(node);
      const reverseNeighbors = this.graph.reverseAdjacencies.get(node) || new Set();
      for (const neighbor of reverseNeighbors) {
        if (!visited.has(neighbor)) {
          dfs2(neighbor, component);
        }
      }
    };

    for (let i = order.length - 1; i >= 0; i--) {
      const node = order[i];
      if (!visited.has(node)) {
        const component: string[] = [];
        dfs2(node, component);
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Find topological sort order
   */
  topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const result: string[] = [];
    const queue: string[] = [];

    // Calculate in-degrees
    for (const [node] of this.graph.nodes) {
      inDegree.set(node, 0);
    }

    for (const edge of this.graph.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // Start with nodes that have no incoming edges
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    // Process nodes
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      const neighbors = this.graph.adjacencies.get(node) || new Set();
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Find articulation points (critical modules)
   */
  findArticulationPoints(): Set<string> {
    const articulationPoints = new Set<string>();
    const discoveryTime = new Map<string, number>();
    const lowTime = new Map<string, number>();
    const visited = new Set<string>();
    let time = 0;

    const dfs = (
      node: string,
      parent: string | null = null
    ): { discovery: number; low: number } => {
      visited.add(node);
      discoveryTime.set(node, time);
      lowTime.set(node, time);
      let children = 0;
      time++;

      const neighbors = this.graph.adjacencies.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (neighbor === parent) continue;

        if (!visited.has(neighbor)) {
          children++;
          const childResult = dfs(neighbor, node);

          if (
            parent !== null &&
            childResult.discovery <= lowTime.get(node)!
          ) {
            articulationPoints.add(node);
          }

          lowTime.set(node, Math.min(lowTime.get(node)!, childResult.low));
        } else {
          lowTime.set(
            node,
            Math.min(lowTime.get(node)!, discoveryTime.get(neighbor)!)
          );
        }
      }

      if (parent === null && children > 1) {
        articulationPoints.add(node);
      }

      return { discovery: discoveryTime.get(node)!, low: lowTime.get(node)! };
    };

    for (const node of this.graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return articulationPoints;
  }

  /**
   * Calculate centrality metrics
   */
  calculateCentrality(): Map<string, { degree: number; betweenness: number; closeness: number }> {
    const centrality = new Map<
      string,
      { degree: number; betweenness: number; closeness: number }
    >();

    // Degree centrality
    for (const [node, neighbors] of this.graph.adjacencies) {
      const degree = neighbors.size + (this.graph.reverseAdjacencies.get(node)?.size || 0);
      centrality.set(node, { degree, betweenness: 0, closeness: 0 });
    }

    // Betweenness centrality (simplified)
    for (const source of this.graph.nodes.keys()) {
      for (const target of this.graph.nodes.keys()) {
        if (source === target) continue;

        const paths = this.findAllPathsBetween(source, target, 3);
        for (const node of this.graph.nodes.keys()) {
          if (node === source || node === target) continue;

          const pathsThroughNode = paths.filter((path) => path.includes(node));
          const ratio = paths.length > 0 ? pathsThroughNode.length / paths.length : 0;
          const current = centrality.get(node)!;
          centrality.set(node, {
            ...current,
            betweenness: current.betweenness + ratio,
          });
        }
      }
    }

    // Closeness centrality (simplified)
    for (const source of this.graph.nodes.keys()) {
      let totalDistance = 0;
      let reachable = 0;

      for (const target of this.graph.nodes.keys()) {
        if (source === target) continue;

        const path = this.findShortestPathBetween(source, target);
        if (path) {
          totalDistance += path.length - 1;
          reachable++;
        }
      }

      if (reachable > 0) {
        const current = centrality.get(source)!;
        centrality.set(source, {
          ...current,
          closeness: reachable / totalDistance,
        });
      }
    }

    return centrality;
  }

  /**
   * Find all paths between two nodes (helper method)
   */
  private findAllPathsBetween(from: string, to: string, maxDepth: number): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: string[], depth: number) => {
      if (depth > maxDepth) return;

      if (current === to && path.length > 1) {
        paths.push([...path]);
        return;
      }

      visited.add(current);

      const neighbors = this.graph.adjacencies.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor], depth + 1);
        }
      }

      visited.delete(current);
    };

    dfs(from, [from], 0);
    return paths;
  }

  /**
   * Find shortest path between two nodes (helper method)
   */
  private findShortestPathBetween(from: string, to: string): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [
      { node: from, path: [from] },
    ];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === to) {
        return path;
      }

      if (visited.has(node)) continue;
      visited.add(node);

      const neighbors = this.graph.adjacencies.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({
            node: neighbor,
            path: [...path, neighbor],
          });
        }
      }
    }

    return null;
  }
}
