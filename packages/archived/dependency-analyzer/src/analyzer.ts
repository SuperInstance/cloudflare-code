/**
 * Main Dependency Analyzer
 *
 * This is the main entry point for the dependency analyzer package.
 * It coordinates all the analysis modules and provides a unified API.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

import { DependencyGraphBuilder, GraphAnalyzer, GraphVisualizer } from './graph/graph.js';
import { CircularDependencyDetector, CycleOptimizer } from './circular/detector.js';
import { UnusedDependencyDetector, TreeShakingAnalyzer } from './unused/detector.js';
import { UpdateManager } from './updates/manager.js';
import { LicenseAnalyzer } from './license/analyzer.js';
import { SecurityScanner, RiskAssessment } from './security/scanner.js';
import { DependencyOptimizer } from './optimization/optimizer.js';

import type {
  AnalyzerConfig,
  AnalysisResult,
  DependencyGraph,
  CircularCycle,
  UnusedDependency,
  UnusedCode,
  DependencyUpdate,
  LicenseInfo,
  Vulnerability,
  BundleAnalysis,
  OptimizationSuggestion,
} from './types/index.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<AnalyzerConfig> = {
  packageManager: 'npm',
  include: ['**/*.{ts,tsx,js,jsx}'],
  exclude: ['node_modules/**', 'dist/**', 'build/**', '**/*.d.ts'],
  rules: {
    circular: {
      enabled: true,
      maxDepth: 10,
    },
    unused: {
      enabled: true,
      includeExports: true,
    },
    security: {
      enabled: true,
      severity: ['moderate', 'high', 'critical'],
    },
    license: {
      enabled: true,
    },
  },
};

/**
 * Main Dependency Analyzer class
 */
export class DependencyAnalyzer {
  private config: AnalyzerConfig;
  private graph?: DependencyGraph;
  private graphBuilder?: DependencyGraphBuilder;

  constructor(config: Partial<AnalyzerConfig> = {}) {
    this.config = this.mergeConfig(config);
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(config: Partial<AnalyzerConfig>): AnalyzerConfig {
    return {
      ...DEFAULT_CONFIG,
      ...config,
      projectPath: config.projectPath || process.cwd(),
      rules: {
        ...DEFAULT_CONFIG.rules,
        ...config.rules,
      },
    } as AnalyzerConfig;
  }

  /**
   * Perform complete analysis
   */
  async analyze(): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Build dependency graph
    console.log('Building dependency graph...');
    await this.buildGraph();

    // Run all analyses
    const results: AnalysisResult = {
      projectPath: this.config.projectPath,
      timestamp: new Date(),
      packageManager: this.config.packageManager!,
      summary: {
        totalDependencies: 0,
        totalModules: 0,
        circularDependencies: 0,
        unusedDependencies: 0,
        vulnerabilities: 0,
        licenseIssues: 0,
      },
    };

    // Graph analysis
    if (this.graph) {
      results.summary.totalModules = this.graph.nodes.size;
      results.graph = this.graph;
    }

    // Circular dependency detection
    if (this.config.rules?.circular?.enabled) {
      console.log('Detecting circular dependencies...');
      const circularResult = await this.detectCircular();
      results.cycles = circularResult.cycles;
      results.summary.circularDependencies = circularResult.cycles.length;
    }

    // Unused dependency detection
    if (this.config.rules?.unused?.enabled) {
      console.log('Detecting unused dependencies...');
      const unusedResult = await this.detectUnused();
      results.unused = unusedResult;
      results.summary.unusedDependencies = unusedResult.dependencies.length;
    }

    // Update checking (always enabled for dependencies count)
    console.log('Checking for updates...');
    const updatesResult = await this.checkUpdates();
    results.updates = updatesResult.updates;
    results.summary.totalDependencies = updatesResult.updates.length;

    // License analysis
    if (this.config.rules?.license?.enabled) {
      console.log('Analyzing licenses...');
      const licenseResult = await this.analyzeLicenses();
      results.licenses = licenseResult.licenses;
      results.summary.licenseIssues = licenseResult.issues.length;
    }

    // Security scanning
    if (this.config.rules?.security?.enabled) {
      console.log('Scanning for vulnerabilities...');
      const securityResult = await this.scanSecurity();
      results.vulnerabilities = securityResult.vulnerabilities;
      results.summary.vulnerabilities = securityResult.summary.total;
    }

    // Bundle optimization
    console.log('Analyzing bundle...');
    const optimizationResult = await this.optimize();
    results.bundle = optimizationResult.bundle;

    const duration = Date.now() - startTime;
    console.log(`Analysis complete in ${duration}ms`);

    return results;
  }

  /**
   * Build dependency graph
   */
  async buildGraph(): Promise<DependencyGraph> {
    this.graphBuilder = new DependencyGraphBuilder(this.config);
    this.graph = await this.graphBuilder.build();
    return this.graph;
  }

  /**
   * Detect circular dependencies
   */
  async detectCircular(): Promise<{ cycles: CircularCycle[] }> {
    if (!this.graph) {
      await this.buildGraph();
    }

    const detector = new CircularDependencyDetector(this.config);
    const result = detector.detect(this.graph!);
    return { cycles: result.cycles };
  }

  /**
   * Detect unused code and dependencies
   */
  async detectUnused(): Promise<{
    dependencies: UnusedDependency[];
    code: UnusedCode[];
  }> {
    const detector = new UnusedDependencyDetector(this.config, this.graph);
    const result = await detector.detect();
    return {
      dependencies: result.dependencies,
      code: result.code,
    };
  }

  /**
   * Check for dependency updates
   */
  async checkUpdates(): Promise<{ updates: DependencyUpdate[] }> {
    const manager = new UpdateManager(this.config);
    const result = await manager.checkUpdates();
    return { updates: result.updates };
  }

  /**
   * Analyze licenses
   */
  async analyzeLicenses(): Promise<{
    licenses: Map<string, LicenseInfo>;
    issues: Array<{ package: string; license: string; issue: string; severity: string }>;
  }> {
    const analyzer = new LicenseAnalyzer(this.config);
    const result = await analyzer.analyze();
    return {
      licenses: result.licenses,
      issues: result.issues,
    };
  }

  /**
   * Scan for security vulnerabilities
   */
  async scanSecurity(): Promise<{
    vulnerabilities: Vulnerability[];
    summary: { total: number; critical: number; high: number; moderate: number; low: number };
  }> {
    const scanner = new SecurityScanner(this.config);
    const result = await scanner.scan();
    return {
      vulnerabilities: result.vulnerabilities,
      summary: result.summary,
    };
  }

  /**
   * Optimize dependencies
   */
  async optimize(): Promise<{ bundle: BundleAnalysis }> {
    const optimizer = new DependencyOptimizer(this.config, this.graph);
    const result = await optimizer.optimize();
    return { bundle: result.bundle };
  }

  /**
   * Generate visualization
   */
  visualize(format: 'dot' | 'json' | 'mermaid' = 'json'): string {
    if (!this.graph) {
      throw new Error('Graph not built. Call buildGraph() first.');
    }

    switch (format) {
      case 'dot':
        return GraphVisualizer.toDot(this.graph);
      case 'mermaid':
        return GraphVisualizer.toMermaid(this.graph);
      case 'json':
      default:
        return GraphVisualizer.toJSON(this.graph);
    }
  }

  /**
   * Generate optimization suggestions
   */
  async getSuggestions(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Get circular dependency suggestions
    if (this.config.rules?.circular?.enabled) {
      const { cycles } = await this.detectCircular();
      const cycleSuggestions = CycleOptimizer.optimize(cycles, this.graph!);
      suggestions.push(...cycleSuggestions.map((s) => ({
        type: 'remove' as const,
        priority: s.priority,
        title: s.action,
        description: s.description,
        impact: { size: 0, performance: 0, complexity: 0 },
        effort: 'medium',
        code: s.code,
      })));
    }

    // Get bundle optimization suggestions
    const optimizer = new DependencyOptimizer(this.config, this.graph);
    const optimizationResult = await optimizer.optimize();
    suggestions.push(...optimizationResult.suggestions);

    return suggestions;
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(): Promise<string> {
    const result = await this.analyze();
    const lines: string[] = [];

    lines.push('# Dependency Analysis Report');
    lines.push('');
    lines.push(`**Project**: ${result.projectPath}`);
    lines.push(`**Date**: ${result.timestamp.toISOString()}`);
    lines.push(`**Package Manager**: ${result.packageManager}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total Modules: ${result.summary.totalModules}`);
    lines.push(`- Total Dependencies: ${result.summary.totalDependencies}`);
    lines.push(`- Circular Dependencies: ${result.summary.circularDependencies}`);
    lines.push(`- Unused Dependencies: ${result.summary.unusedDependencies}`);
    lines.push(`- Vulnerabilities: ${result.summary.vulnerabilities}`);
    lines.push(`- License Issues: ${result.summary.licenseIssues}`);
    lines.push('');

    if (result.cycles && result.cycles.length > 0) {
      lines.push('## Circular Dependencies');
      lines.push('');
      for (const cycle of result.cycles) {
        lines.push(`### ${cycle.type} cycle (severity: ${cycle.severity})`);
        lines.push('```');
        lines.push(cycle.path.join(' -> '));
        lines.push('```');
        lines.push('');
      }
    }

    if (result.unused?.dependencies.length > 0) {
      lines.push('## Unused Dependencies');
      lines.push('');
      for (const dep of result.unused.dependencies.slice(0, 10)) {
        lines.push(`- **${dep.name}** (${dep.version}): ${dep.reason}`);
      }
      lines.push('');
    }

    if (result.updates && result.updates.length > 0) {
      lines.push('## Available Updates');
      lines.push('');
      const major = result.updates.filter((u) => u.type === 'major');
      const minor = result.updates.filter((u) => u.type === 'minor');
      const patch = result.updates.filter((u) => u.type === 'patch');

      lines.push(`- Major updates: ${major.length}`);
      lines.push(`- Minor updates: ${minor.length}`);
      lines.push(`- Patch updates: ${patch.length}`);
      lines.push('');
    }

    if (result.vulnerabilities && result.vulnerabilities.length > 0) {
      lines.push('## Security Vulnerabilities');
      lines.push('');
      lines.push(`Found ${result.vulnerabilities.length} vulnerabilities:`);
      lines.push('');
      for (const vuln of result.vulnerabilities.slice(0, 5)) {
        lines.push(`### ${vuln.packageName} - ${vuln.severity}`);
        lines.push(vuln.title);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Export analysis results
   */
  async exportResults(format: 'json' | 'markdown' | 'html'): Promise<string> {
    const result = await this.analyze();

    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      case 'markdown':
        return await this.generateReport();
      case 'html':
        return this.generateHTMLReport(result);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(result: AnalysisResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Dependency Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; }
    .metric { display: inline-block; margin: 10px 20px; }
    .metric-value { font-size: 32px; font-weight: bold; }
    .metric-label { color: #666; }
    .severity-critical { color: #d32f2f; }
    .severity-high { color: #f57c00; }
    .severity-moderate { color: #fbc02d; }
    .severity-low { color: #388e3c; }
  </style>
</head>
<body>
  <h1>Dependency Analysis Report</h1>
  <p><strong>Project:</strong> ${result.projectPath}</p>
  <p><strong>Date:</strong> ${result.timestamp.toISOString()}</p>
  <p><strong>Package Manager:</strong> ${result.packageManager}</p>

  <div class="summary">
    <h2>Summary</h2>
    <div class="metric">
      <div class="metric-value">${result.summary.totalModules}</div>
      <div class="metric-label">Total Modules</div>
    </div>
    <div class="metric">
      <div class="metric-value">${result.summary.totalDependencies}</div>
      <div class="metric-label">Dependencies</div>
    </div>
    <div class="metric">
      <div class="metric-value ${result.summary.circularDependencies > 0 ? 'severity-high' : ''}">
        ${result.summary.circularDependencies}
      </div>
      <div class="metric-label">Circular Dependencies</div>
    </div>
    <div class="metric">
      <div class="metric-value ${result.summary.vulnerabilities > 0 ? 'severity-critical' : ''}">
        ${result.summary.vulnerabilities}
      </div>
      <div class="metric-label">Vulnerabilities</div>
    </div>
  </div>

  ${result.vulnerabilities && result.vulnerabilities.length > 0 ? `
  <h2>Security Vulnerabilities</h2>
  <ul>
    ${result.vulnerabilities.slice(0, 10).map(v => `
      <li class="severity-${v.severity}">
        <strong>${v.packageName}</strong>: ${v.title}
      </li>
    `).join('')}
  </ul>
  ` : ''}

  ${result.unused?.dependencies.length > 0 ? `
  <h2>Unused Dependencies</h2>
  <ul>
    ${result.unused.dependencies.slice(0, 10).map(d => `
      <li><strong>${d.name}</strong> (${d.version}): ${d.reason}</li>
    `).join('')}
  </ul>
  ` : ''}
</body>
</html>
    `.trim();
  }

  /**
   * Get graph instance
   */
  getGraph(): DependencyGraph | undefined {
    return this.graph;
  }

  /**
   * Get config
   */
  getConfig(): AnalyzerConfig {
    return this.config;
  }
}

/**
 * Create analyzer with auto-detection of project settings
 */
export async function createAnalyzer(
  projectPath?: string
): Promise<DependencyAnalyzer> {
  const path = projectPath || process.cwd();

  // Detect package manager
  const packageManager = await detectPackageManager(path);

  return new DependencyAnalyzer({
    projectPath: path,
    packageManager,
  });
}

/**
 * Detect package manager used in project
 */
async function detectPackageManager(projectPath: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun'> {
  const { exists } = await import('fs/promises');

  // Check for lock files
  if (await exists(join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (await exists(join(projectPath, 'yarn.lock'))) {
    return 'yarn';
  }
  if (await exists(join(projectPath, 'bun.lockb'))) {
    return 'bun';
  }
  if (await exists(join(projectPath, 'package-lock.json'))) {
    return 'npm';
  }

  return 'npm'; // Default
}

// Export all main classes
export * from './types/index.js';
export { DependencyGraphBuilder, GraphAnalyzer, GraphVisualizer } from './graph/graph.js';
export { CircularDependencyDetector, CycleOptimizer } from './circular/detector.js';
export { UnusedDependencyDetector, TreeShakingAnalyzer } from './unused/detector.js';
export { UpdateManager } from './updates/manager.js';
export { LicenseAnalyzer } from './license/analyzer.js';
export { SecurityScanner, RiskAssessment } from './security/scanner.js';
export { DependencyOptimizer } from './optimization/optimizer.js';
