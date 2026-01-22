/**
 * Analyst Agent Durable Object
 *
 * Analyzes codebase structure and dependencies:
 * - Codebase structure analysis
 * - Dependency mapping
 * - Impact analysis
 * - Code visualization
 * - Architecture documentation
 */

import type { AgentCapability } from '../lib/agents/types';

export interface AnalystEnv {
  ANALYST_DO: DurableObjectNamespace;
  AGENT_REGISTRY: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * Analyst agent state
 */
interface AnalystState {
  analysesCompleted: number;
  filesAnalyzed: number;
  dependenciesMapped: number;
  load: number;
}

/**
 * Analyst Agent - Codebase analysis and architecture
 *
 * Features:
 * - Structure analysis
 * - Dependency mapping
 * - Impact analysis
 * - Code visualization
 * - Architecture insights
 */
export class AnalystAgent implements DurableObject {
  private state: DurableObjectState;
  private _env: AnalystEnv;
  private storage: DurableObjectStorage;
  private analystState: AnalystState;

  constructor(state: DurableObjectState, env: AnalystEnv) {
    this.state = state;
    this._env = env;
    this.storage = state.storage;

    this.analystState = {
      analysesCompleted: 0,
      filesAnalyzed: 0,
      dependenciesMapped: 0,
      load: 0,
    };

    this.initializeFromStorage();
  }

  /**
   * Fetch handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/analyze') {
        return this.handleAnalyze(request);
      }

      if (method === 'POST' && path === '/impact') {
        return this.handleImpactAnalysis(request);
      }

      if (method === 'GET' && path === '/state') {
        return this.handleGetState();
      }

      if (method === 'GET' && path === '/capabilities') {
        return this.handleGetCapabilities();
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle analyze request
   */
  private async handleAnalyze(request: Request): Promise<Response> {
    this.analystState.load = Math.min(1, this.analystState.load + 0.1);

    try {
      const body = await request.json() as {
        codebase: Record<string, string>;
        analysisType?: 'structure' | 'dependencies' | 'architecture' | 'all';
      };

      const analysis = await this.performAnalysis(body);

      this.analystState.analysesCompleted++;
      this.analystState.filesAnalyzed += Object.keys(body.codebase).length;

      await this.persistState();

      return new Response(
        JSON.stringify({
          analysis,
          analystId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.analystState.load = Math.max(0, this.analystState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle impact analysis
   */
  private async handleImpactAnalysis(request: Request): Promise<Response> {
    this.analystState.load = Math.min(1, this.analystState.load + 0.1);

    try {
      const body = await request.json() as {
        codebase: Record<string, string>;
        changedFiles: string[];
      };

      const impact = await this.performImpactAnalysis(body);

      this.analystState.analysesCompleted++;

      await this.persistState();

      return new Response(
        JSON.stringify({
          impact,
          analystId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.analystState.load = Math.max(0, this.analystState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle get state
   */
  private async handleGetState(): Promise<Response> {
    return new Response(
      JSON.stringify(this.analystState),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get capabilities
   */
  private async handleGetCapabilities(): Promise<Response> {
    const capabilities: AgentCapability[] = [
      {
        name: 'codebase-analyst',
        version: '1.0.0',
        description: 'Analyzes codebase structure and dependencies',
        expertise: ['architecture', 'structure', 'dependencies'],
        features: [
          'structure-analysis',
          'dependency-mapping',
          'impact-analysis',
          'architecture-visualization',
          'code-metrics',
        ],
      },
    ];

    return new Response(
      JSON.stringify({ capabilities }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Perform codebase analysis
   */
  private async performAnalysis(request: {
    codebase: Record<string, string>;
    analysisType?: 'structure' | 'dependencies' | 'architecture' | 'all';
  }): Promise<{
    structure?: {
      directories: string[];
      files: string[];
      fileTypes: Record<string, number>;
      depth: number;
    };
    dependencies?: {
      internal: Array<{ from: string; to: string; type: string }>;
      external: Array<{ name: string; version?: string; usedIn: string[] }>;
      circular: Array<string[]>;
    };
    architecture?: {
      layers: string[];
      patterns: string[];
      coupling: Record<string, number>;
      cohesion: number;
    };
    metrics: {
      totalFiles: number;
      totalLines: number;
      averageFileLength: number;
      complexity: number;
    };
  }> {
    const { codebase, analysisType = 'all' } = request;

    const result: {
      structure?: ReturnType<AnalystAgent['analyzeStructure']>;
      dependencies?: ReturnType<AnalystAgent['analyzeDependencies']>;
      architecture?: ReturnType<AnalystAgent['analyzeArchitecture']>;
      patterns?: Record<string, unknown>;
      metrics: {
        totalFiles: number;
        totalLines: number;
        averageFileLength: number;
        complexity: number;
      };
    } = {
      metrics: {
        totalFiles: Object.keys(codebase).length,
        totalLines: 0,
        averageFileLength: 0,
        complexity: 0,
      },
    };

    // Calculate metrics
    for (const [, content] of Object.entries(codebase)) {
      const lines = content.split('\n').length;
      result.metrics.totalLines += lines;
    }

    result.metrics.averageFileLength = Math.floor(
      result.metrics.totalLines / result.metrics.totalFiles
    );

    // Structure analysis
    if (analysisType === 'all' || analysisType === 'structure') {
      result.structure = this.analyzeStructure(codebase);
    }

    // Dependency analysis
    if (analysisType === 'all' || analysisType === 'dependencies') {
      result.dependencies = this.analyzeDependencies(codebase);
      this.analystState.dependenciesMapped += result.dependencies.internal.length;
    }

    // Architecture analysis
    if (analysisType === 'all' || analysisType === 'architecture') {
      result.architecture = this.analyzeArchitecture(codebase);
    }

    return result;
  }

  /**
   * Analyze codebase structure
   */
  private analyzeStructure(codebase: Record<string, string>): {
    directories: string[];
    files: string[];
    fileTypes: Record<string, number>;
    depth: number;
  } {
    const directories = new Set<string>();
    const files: string[] = [];
    const fileTypes: Record<string, number> = {};
    let maxDepth = 0;

    for (const filePath of Object.keys(codebase)) {
      const parts = filePath.split('/');
      files.push(filePath);

      // Build directory structure
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += (currentPath ? '/' : '') + parts[i];
        directories.add(currentPath);
      }

      // Track file types
      const ext = filePath.split('.').pop() || 'unknown';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;

      // Calculate depth
      const depth = parts.length;
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }

    return {
      directories: Array.from(directories).sort(),
      files: files.sort(),
      fileTypes,
      depth: maxDepth,
    };
  }

  /**
   * Analyze dependencies
   */
  private analyzeDependencies(codebase: Record<string, string>): {
    internal: Array<{ from: string; to: string; type: string }>;
    external: Array<{ name: string; version?: string; usedIn: string[] }>;
    circular: Array<string[]>;
  } {
    const internal: Array<{ from: string; to: string; type: string }> = [];
    const externalMap = new Map<string, Set<string>>();

    for (const [file, content] of Object.entries(codebase)) {
      // Find imports
      const imports = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);

      for (const match of imports) {
        const importPath = match[1];
        if (!importPath) continue;

        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          // Internal import
          internal.push({
            from: file,
            to: importPath,
            type: 'import',
          });
        } else {
          // External import
          if (!externalMap.has(importPath)) {
            externalMap.set(importPath, new Set());
          }
          externalMap.get(importPath)!.add(file);
        }
      }
    }

    const external = Array.from(externalMap.entries()).map(([name, usedIn]) => ({
      name,
      usedIn: Array.from(usedIn),
    }));

    // Detect circular dependencies (simplified)
    const circular: Array<string[]> = [];
    const graph = new Map<string, string[]>();

    for (const dep of internal) {
      if (!graph.has(dep.from)) {
        graph.set(dep.from, []);
      }
      graph.get(dep.from)!.push(dep.to);
    }

    // Simple circular detection
    for (const [from, toList] of graph.entries()) {
      for (const to of toList) {
        if (graph.has(to) && graph.get(to)!.includes(from)) {
          circular.push([from, to]);
        }
      }
    }

    return {
      internal,
      external,
      circular,
    };
  }

  /**
   * Analyze architecture
   */
  private analyzeArchitecture(codebase: Record<string, string>): {
    layers: string[];
    patterns: string[];
    coupling: Record<string, number>;
    cohesion: number;
  } {
    const layers = new Set<string>();
    const patterns: string[] = [];
    const coupling: Record<string, number> = {};

    // Identify layers based on directory structure
    for (const filePath of Object.keys(codebase)) {
      const parts = filePath.split('/');

      if (parts.includes('src')) {
        layers.add('src');
      }

      if (parts.includes('lib') || parts.includes('utils')) {
        layers.add('lib');
      }

      if (parts.includes('components')) {
        layers.add('components');
      }

      if (parts.includes('api') || parts.includes('routes')) {
        layers.add('api');
      }

      if (parts.includes('test') || parts.includes('__tests__')) {
        layers.add('test');
      }
    }

    // Detect patterns
    if (Object.keys(codebase).some((f) => f.includes('controller'))) {
      patterns.push('MVC');
    }

    if (Object.keys(codebase).some((f) => f.includes('service'))) {
      patterns.push('Service Layer');
    }

    if (Object.keys(codebase).some((f) => f.includes('repository') || f.includes('dao'))) {
      patterns.push('Repository Pattern');
    }

    if (Object.keys(codebase).some((f) => f.includes('middleware'))) {
      patterns.push('Middleware Pattern');
    }

    // Calculate coupling (simplified)
    const files = Object.keys(codebase);
    for (const file of files) {
      const content = codebase[file];
      if (!content) continue;
      const imports = content.match(/from\s+['"]([^'"]+)['"]/g) || [];
      coupling[file] = imports.length;
    }

    // Calculate cohesion (simplified - inverse of average coupling)
    const avgCoupling = Object.values(coupling).reduce((a, b) => a + b, 0) / files.length;
    const cohesion = Math.max(0, Math.min(1, 1 / (avgCoupling + 1)));

    return {
      layers: Array.from(layers),
      patterns,
      coupling,
      cohesion,
    };
  }

  /**
   * Perform impact analysis
   */
  private async performImpactAnalysis(request: {
    codebase: Record<string, string>;
    changedFiles: string[];
  }): Promise<{
    impactLevel: 'low' | 'medium' | 'high';
    affectedFiles: string[];
    affectedAreas: string[];
    riskScore: number;
    recommendations: string[];
  }> {
    const { codebase, changedFiles } = request;

    // Find files that import changed files
    const affectedFiles = new Set<string>();
    const affectedAreas = new Set<string>();

    for (const [file, content] of Object.entries(codebase)) {
      for (const changedFile of changedFiles) {
        const fileName = changedFile.split('/').pop() || changedFile;

        if (content.includes(fileName) || content.includes(`from '${changedFile}`) || content.includes(`from "${changedFile}`)) {
          affectedFiles.add(file);

          // Determine area
          const parts = file.split('/');
          if (parts.includes('src')) affectedAreas.add('src');
          if (parts.includes('lib')) affectedAreas.add('lib');
          if (parts.includes('components')) affectedAreas.add('components');
          if (parts.includes('api')) affectedAreas.add('api');
        }
      }
    }

    // Calculate impact level
    const affectedCount = affectedFiles.size;
    let impactLevel: 'low' | 'medium' | 'high' = 'low';

    if (affectedCount > 20) {
      impactLevel = 'high';
    } else if (affectedCount > 5) {
      impactLevel = 'medium';
    }

    // Calculate risk score based on impact level and number of affected files
    const riskScore = Math.min(100, affectedCount * 5);

    // Generate recommendations
    const recommendations: string[] = [];

    if (impactLevel === 'high') {
      recommendations.push('Consider running comprehensive tests');
      recommendations.push('Review all affected files carefully');
      recommendations.push('Plan for potential breaking changes');
    }

    if (affectedAreas.has('api')) {
      recommendations.push('API changes may require client updates');
    }

    if (affectedAreas.has('components')) {
      recommendations.push('Component changes may affect UI/UX');
    }

    return {
      impactLevel,
      affectedFiles: Array.from(affectedFiles),
      affectedAreas: Array.from(affectedAreas),
      riskScore,
      recommendations,
    };
  }

  /**
   * Initialize from storage
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.get<AnalystState>('analystState');

      if (stored) {
        this.analystState = stored;
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  /**
   * Persist state
   */
  private async persistState(): Promise<void> {
    try {
      await this.storage.put('analystState', this.analystState);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  /**
   * Alarm handler
   */
  async alarm(): Promise<void> {
    this.analystState.load = Math.max(0, this.analystState.load * 0.9);
    await this.persistState();
  }
}
