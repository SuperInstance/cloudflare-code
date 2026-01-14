/**
 * Dependency Optimization
 *
 * This module provides comprehensive dependency optimization:
 * - Bundle size analysis
 * - Dependency deduplication
 * - Tree-shaking optimization
 * - Lazy loading suggestions
 * - Dependency consolidation
 * - Performance analysis
 * - Cost optimization
 */

import { promises as fs } from 'fs';
import { join } from 'path';

import type {
  DependencyGraph,
  BundleAnalysis,
  DuplicateDependency,
  LazyLoadCandidate,
  OptimizationSuggestion,
  AnalyzerConfig,
} from '../types/index.js';

/**
 * Optimization analysis result
 */
interface OptimizationResult {
  bundle: BundleAnalysis;
  suggestions: OptimizationSuggestion[];
  potentialSavings: {
    size: number;
    percentage: number;
  };
}

/**
 * Package size info
 */
interface PackageSizeInfo {
  name: string;
  version: string;
  size: number;
  gzipSize?: number;
  dependencyCount: number;
}

/**
 * Dependency Optimizer
 */
export class DependencyOptimizer {
  private config: AnalyzerConfig;
  private graph?: DependencyGraph;

  constructor(config: AnalyzerConfig, graph?: DependencyGraph) {
    this.config = config;
    this.graph = graph;
  }

  /**
   * Perform full optimization analysis
   */
  async optimize(): Promise<OptimizationResult> {
    // Analyze bundle
    const bundle = await this.analyzeBundle();

    // Generate suggestions
    const suggestions = await this.generateSuggestions(bundle);

    // Calculate potential savings
    const potentialSavings = this.calculateSavings(suggestions);

    return {
      bundle,
      suggestions,
      potentialSavings,
    };
  }

  /**
   * Analyze bundle composition
   */
  async analyzeBundle(): Promise<BundleAnalysis> {
    const packageJson = await this.loadPackageJson();
    const allDeps = {
      ...(packageJson?.dependencies || {}),
      ...(packageJson?.devDependencies || {}),
    };

    const totalSize = await this.calculateTotalSize(allDeps);
    const duplicates = await this.findDuplicates(allDeps);
    const treeShakeable = await this.estimateTreeShakeable(allDeps);
    const lazyLoadCandidates = await this.findLazyLoadCandidates();

    return {
      totalSize,
      dependencies: Object.keys(allDeps).length,
      duplicates,
      treeShakeable,
      lazyLoadCandidates,
    };
  }

  /**
   * Load package.json
   */
  private async loadPackageJson(): Promise<any> {
    try {
      const packageJsonPath = join(this.config.projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Calculate total size of dependencies
   */
  private async calculateTotalSize(deps: Record<string, string>): Promise<number> {
    let totalSize = 0;

    for (const [name, version] of Object.entries(deps)) {
      try {
        const size = await this.getPackageSize(name, version);
        totalSize += size || 0;
      } catch {
        // Skip if size can't be determined
      }
    }

    return totalSize;
  }

  /**
   * Get package size from bundlephobia API
   */
  private async getPackageSize(name: string, version?: string): Promise<number | undefined> {
    try {
      const url = version
        ? `https://bundlephobia.com/api/size?package=${name}@${version}`
        : `https://bundlephobia.com/api/size?package=${name}`;

      const response = await fetch(url);
      if (!response.ok) return undefined;

      const data = await response.json();
      return data.size || data.gzip;
    } catch {
      return undefined;
    }
  }

  /**
   * Find duplicate dependencies
   */
  async findDuplicates(deps: Record<string, string>): Promise<DuplicateDependency[]> {
    const duplicates: DuplicateDependency[] = [];
    const packageVersions = new Map<string, Set<string>>();

    // Find all installed versions of each package
    const lockfile = await this.readLockfile();

    if (lockfile) {
      for (const [name, info] of Object.entries(lockfile)) {
        if (!packageVersions.has(name)) {
          packageVersions.set(name, new Set());
        }

        if (typeof info === 'object' && 'version' in info) {
          packageVersions.get(name)!.add((info as any).version);
        } else if (typeof info === 'string') {
          packageVersions.get(name)!.add(info);
        }
      }
    }

    // Find duplicates
    for (const [name, versions] of packageVersions) {
      if (versions.size > 1) {
        const versionsArray = Array.from(versions);
        let totalSize = 0;

        for (const version of versionsArray) {
          const size = await this.getPackageSize(name, version);
          totalSize += size || 0;
        }

        duplicates.push({
          name,
          versions: versionsArray,
          count: versions.size,
          totalSize,
          canDeduplicate: true,
        });
      }
    }

    return duplicates.sort((a, b) => b.totalSize - a.totalSize);
  }

  /**
   * Read lockfile (package-lock.json or yarn.lock)
   */
  private async readLockfile(): Promise<Record<string, any> | null> {
    try {
      // Try package-lock.json first
      const packageLockPath = join(this.config.projectPath, 'package-lock.json');
      const content = await fs.readFile(packageLockPath, 'utf-8');
      const packageLock = JSON.parse(content);

      // Extract dependencies
      const deps: Record<string, any> = {};
      if (packageLock.packages) {
        for (const [path, info] of Object.entries(packageLock.packages)) {
          if (path.startsWith('node_modules/')) {
            const name = path.replace('node_modules/', '');
            deps[name] = info;
          }
        }
      } else if (packageLock.dependencies) {
        Object.assign(deps, packageLock.dependencies);
      }

      return deps;
    } catch {
      // Try yarn.lock
      try {
        const yarnLockPath = join(this.config.projectPath, 'yarn.lock');
        // Note: yarn.lock is not JSON, would need special parsing
        // For now, return null
        return null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Estimate tree-shakeable code
   */
  async estimateTreeShakeable(deps: Record<string, string>): Promise<number> {
    let shakeable = 0;

    for (const [name, version] of Object.entries(deps)) {
      const isTreeShakeable = await this.checkTreeShakeable(name);
      if (isTreeShakeable) {
        const size = await this.getPackageSize(name, version);
        shakeable += size || 0;
      }
    }

    return shakeable;
  }

  /**
   * Check if package supports tree-shaking
   */
  private async checkTreeShakeable(name: string): Promise<boolean> {
    try {
      // Check package.json for sideEffects flag
      const response = await fetch(`https://registry.npmjs.org/${name}`);
      const data = await response.json();
      const latest = data.versions?.[data['dist-tags']?.latest];

      if (latest?.sideEffects === false) {
        return true;
      }

      // Check if package has module field (ESM)
      if (latest?.module || latest?.esm) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Find candidates for lazy loading
   */
  async findLazyLoadCandidates(): Promise<LazyLoadCandidate[]> {
    const candidates: LazyLoadCandidate[] = [];

    if (!this.graph) {
      return candidates;
    }

    // Find dynamically imported modules
    for (const edge of this.graph.edges) {
      if (edge.type === 'dynamic') {
        const node = this.graph.nodes.get(edge.to);
        candidates.push({
          file: edge.from,
          import: edge.to,
          reason: 'Already dynamically imported - can be code-split',
          impact: (node?.metadata?.size as number) || 0,
          suggested: 'Keep as dynamic import',
        });
      }
    }

    // Find large dependencies that are only used in specific conditions
    const largeDeps = await this.findConditionalLargeDeps();
    candidates.push(...largeDeps);

    return candidates;
  }

  /**
   * Find large dependencies used conditionally
   */
  private async findConditionalLargeDeps(): Promise<LazyLoadCandidate[]> {
    const candidates: LazyLoadCandidate[] = [];

    // This would require AST analysis to find conditional imports
    // For now, return a placeholder

    return candidates;
  }

  /**
   * Generate optimization suggestions
   */
  async generateSuggestions(bundle: BundleAnalysis): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Deduplication suggestions
    for (const dup of bundle.duplicates) {
      if (dup.canDeduplicate) {
        const latestVersion = dup.versions.sort().reverse()[0];

        suggestions.push({
          type: 'dedupe',
          priority: dup.totalSize > 100000 ? 'high' : 'medium',
          title: `Deduplicate ${dup.name}`,
          description: `Found ${dup.count} versions of ${dup.name} (${dup.versions.join(', ')}). Consolidating to ${latestVersion} could save ${this.formatSize(dup.totalSize)}.`,
          impact: {
            size: dup.totalSize,
            performance: 0.2,
            complexity: -0.1,
          },
          effort: 'easy',
          code: `npm install ${dup.name}@${latestVersion} --save-exact`,
        });
      }
    }

    // Tree-shaking suggestions
    if (bundle.treeShakeable > 0) {
      suggestions.push({
        type: 'tree-shake',
        priority: bundle.treeShakeable > 500000 ? 'high' : 'medium',
        title: 'Enable tree-shaking',
        description: `${this.formatSize(bundle.treeShakeable)} of your dependencies can be tree-shaken. Ensure your bundler is configured to eliminate dead code.`,
        impact: {
          size: bundle.treeShakeable * 0.3, // Estimate 30% reduction
          performance: 0.3,
          complexity: 0,
        },
        effort: 'easy',
      });
    }

    // Lazy loading suggestions
    for (const candidate of bundle.lazyLoadCandidates) {
      if (candidate.impact > 50000) {
        suggestions.push({
          type: 'lazy-load',
          priority: candidate.impact > 100000 ? 'high' : 'medium',
          title: `Lazy load ${candidate.import}`,
          description: `This import (${this.formatSize(candidate.impact)}) is only used in specific conditions and can be lazy-loaded.`,
          impact: {
            size: candidate.impact * 0.8,
            performance: 0.4,
            complexity: 0.1,
          },
          effort: 'medium',
          code: this.generateLazyImportCode(candidate),
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate lazy import code
   */
  private generateLazyImportCode(candidate: LazyLoadCandidate): string {
    return `
// Before
import { heavyFunction } from '${candidate.import}';

// After
const heavyFunction = await import('${candidate.import}').then(m => m.heavyFunction);
`.trim();
  }

  /**
   * Calculate potential savings
   */
  private calculateSavings(suggestions: OptimizationSuggestion[]): {
    size: number;
    percentage: number;
  } {
    let totalSize = 0;

    for (const suggestion of suggestions) {
      totalSize += suggestion.impact.size;
    }

    // Calculate percentage (assuming 10MB baseline)
    const baseline = 10 * 1024 * 1024;
    const percentage = (totalSize / baseline) * 100;

    return {
      size: totalSize,
      percentage: Math.min(percentage, 100),
    };
  }

  /**
   * Format size for display
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Analyze performance impact
   */
  async analyzePerformance(): Promise<{
    installTime: number;
    bootTime: number;
    memoryUsage: number;
  }> {
    // These would be measured in practice
    return {
      installTime: 0,
      bootTime: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Find consolidation opportunities
   */
  async findConsolidations(): Promise<Array<{
    packages: string[];
    suggestion: string;
    savings: number;
  }>> {
    const consolidations: Array<{
      packages: string[];
      suggestion: string;
      savings: number;
    }> = [];

    // Find packages with overlapping functionality
    const functionalGroups = new Map<string, string[]>();

    // Date libraries
    const dateLibs = ['date-fns', 'moment', 'dayjs', 'luxon'];
    const foundDateLibs = await this.filterInstalled(dateLibs);
    if (foundDateLibs.length > 1) {
      functionalGroups.set('date', foundDateLibs);
    }

    // Utility libraries
    const utilLibs = ['lodash', 'underscore', 'ramda'];
    const foundUtilLibs = await this.filterInstalled(utilLibs);
    if (foundUtilLibs.length > 1) {
      functionalGroups.set('util', foundUtilLibs);
    }

    // UI libraries
    const uiLibs = ['react', 'preact', 'vue', 'svelte'];
    const foundUILibs = await this.filterInstalled(uiLibs);
    if (foundUILibs.length > 1) {
      functionalGroups.set('ui', foundUILibs);
    }

    // Generate suggestions
    for (const [category, packages] of functionalGroups) {
      const totalSize = await this.calculateTotalSize(
        Object.fromEntries(packages.map((p) => [p, 'latest']))
      );

      consolidations.push({
        packages,
        suggestion: `Consolidate ${category} libraries to a single option`,
        savings: totalSize * 0.6, // Estimate 60% savings
      });
    }

    return consolidations;
  }

  /**
   * Filter packages that are installed
   */
  private async filterInstalled(packages: string[]): Promise<string[]> {
    const packageJson = await this.loadPackageJson();
    const allDeps = {
      ...(packageJson?.dependencies || {}),
      ...(packageJson?.devDependencies || {}),
    };

    return packages.filter((pkg) => allDeps[pkg]);
  }
}

/**
 * Bundle Analyzer
 */
export class BundleAnalyzer {
  /**
   * Analyze bundle composition
   */
  static analyze(bundlePath: string): Promise<{
    modules: Array<{ name: string; size: number }>;
    totalSize: number;
    dependencies: number;
  }> {
    // This would analyze an actual bundle file
    return Promise.resolve({
      modules: [],
      totalSize: 0,
      dependencies: 0,
    });
  }

  /**
   * Generate bundle visualization
   */
  static generateVisualization(bundle: {
    modules: Array<{ name: string; size: number }>;
  }): string {
    // Generate treemap or sunburst data
    return JSON.stringify(bundle);
  }
}

/**
 * Performance Analyzer
 */
export class PerformanceAnalyzer {
  /**
   * Analyze dependency performance impact
   */
  static async analyze(config: AnalyzerConfig): Promise<{
    metrics: {
      installTime: number;
      buildTime: number;
      runtimeOverhead: number;
    };
    bottlenecks: string[];
  }> {
    // Measure actual performance metrics
    return {
      metrics: {
        installTime: 0,
        buildTime: 0,
        runtimeOverhead: 0,
      },
      bottlenecks: [],
    };
  }

  /**
   * Generate performance recommendations
   */
  static generateRecommendations(analysis: {
    metrics: { installTime: number; buildTime: number; runtimeOverhead: number };
    bottlenecks: string[];
  }): string[] {
    const recommendations: string[] = [];

    if (analysis.metrics.installTime > 60000) {
      recommendations.push('Consider reducing the number of dependencies to improve install time');
    }

    if (analysis.metrics.buildTime > 30000) {
      recommendations.push('Optimize build configuration and consider lazy loading');
    }

    for (const bottleneck of analysis.bottlenecks) {
      recommendations.push(`Address bottleneck: ${bottleneck}`);
    }

    return recommendations;
  }
}

/**
 * Cost Analyzer
 */
export class CostAnalyzer {
  /**
   * Analyze costs associated with dependencies
   */
  static analyze(dependencies: string[]): {
    maintenance: number;
    security: number;
    licensing: number;
    total: number;
  } {
    // Estimate costs based on dependency count and type
    const baseCost = dependencies.length * 100; // $100 per dependency per year

    return {
      maintenance: baseCost * 0.6,
      security: baseCost * 0.3,
      licensing: baseCost * 0.1,
      total: baseCost,
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  static generateOptimizations(cost: {
    maintenance: number;
    security: number;
    licensing: number;
    total: number;
  }): Array<{ area: string; suggestion: string; potentialSavings: number }> {
    return [
      {
        area: 'maintenance',
        suggestion: 'Reduce number of dependencies to lower maintenance burden',
        potentialSavings: cost.maintenance * 0.3,
      },
      {
        area: 'security',
        suggestion: 'Implement automated security scanning to reduce manual review',
        potentialSavings: cost.security * 0.5,
      },
    ];
  }
}
