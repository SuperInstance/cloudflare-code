/**
 * Bundle Analyzer
 *
 * Analyzes bundle size, dependencies, and provides optimization recommendations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { gzipSizeSync } from 'gzip-size';
import { brotliCompressSync } from 'zlib';
import { BundleAnalysisResult, BundleModule, BundleDependency, BundleChunk, BundleRecommendation, BundleConfig } from '../types/index.js';

export class BundleAnalyzer {
  private results: Map<string, BundleAnalysisResult> = new Map();

  /**
   * Analyze bundle from a file
   */
  async analyzeBundle(bundlePath: string): Promise<BundleAnalysisResult> {
    const stats = await fs.stat(bundlePath);
    const content = await fs.readFile(bundlePath, 'utf-8');

    const size = stats.size;
    const gzipSize = gzipSizeSync(content);
    const brotliSize = this.getBrotliSize(content);

    const modules = await this.extractModules(content);
    const dependencies = await this.extractDependencies(content);
    const chunks = await this.extractChunks(content);
    const recommendations = this.generateRecommendations(modules, dependencies, chunks);

    const result: BundleAnalysisResult = {
      name: path.basename(bundlePath),
      size,
      gzipSize,
      brotliSize,
      modules,
      dependencies,
      chunks,
      recommendations,
    };

    this.results.set(bundlePath, result);
    return result;
  }

  /**
   * Analyze multiple bundles
   */
  async analyzeBundles(bundlePaths: string[]): Promise<Map<string, BundleAnalysisResult>> {
    const results = new Map<string, BundleAnalysisResult>();

    for (const bundlePath of bundlePaths) {
      const result = await this.analyzeBundle(bundlePath);
      results.set(bundlePath, result);
    }

    return results;
  }

  /**
   * Extract module information from bundle content
   */
  private async extractModules(content: string): Promise<BundleModule[]> {
    const modules: BundleModule[] = [];

    // Try to parse as JSON for source map info
    try {
      const moduleRegex = /\/\*\s*([^*]+)\s*\*\/\s*(?:export\s+)?(?:function|const|class)\s+(\w+)/g;
      let match;

      while ((match = moduleRegex.exec(content)) !== null) {
        const [, filePath, name] = match;
        modules.push({
          id: name,
          name,
          size: this.estimateSize(content, name),
          renderedSize: 0,
          originalSize: 0,
          isEntry: false,
          isDynamicImport: false,
          imports: [],
          dependents: [],
        });
      }
    } catch (error) {
      // If parsing fails, return empty array
    }

    return modules;
  }

  /**
   * Extract dependency information from bundle content
   */
  private async extractDependencies(content: string): Promise<BundleDependency[]> {
    const dependencies: BundleDependency[] = [];

    // Look for require/import statements
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;

    const seen = new Set<string>();

    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      const dep = match[1];
      if (!seen.has(dep)) {
        seen.add(dep);
        dependencies.push({
          name: dep,
          version: 'unknown',
          size: this.estimateDependencySize(dep),
          treeShaken: false,
          required: true,
        });
      }
    }

    while ((match = importRegex.exec(content)) !== null) {
      const dep = match[1];
      if (!seen.has(dep)) {
        seen.add(dep);
        dependencies.push({
          name: dep,
          version: 'unknown',
          size: this.estimateDependencySize(dep),
          treeShaken: false,
          required: true,
        });
      }
    }

    return dependencies;
  }

  /**
   * Extract chunk information from bundle content
   */
  private async extractChunks(content: string): Promise<BundleChunk[]> {
    const chunks: BundleChunk[] = [];

    // Look for chunk references
    const chunkRegex = /__webpack_require__\.chunk\(([^)]+)\)/g;
    let match;

    while ((match = chunkRegex.exec(content)) !== null) {
      const chunkName = match[1];
      chunks.push({
        name: chunkName,
        size: 0,
        modules: [],
        imports: [],
        isDynamic: true,
      });
    }

    return chunks;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    modules: BundleModule[],
    dependencies: BundleDependency[],
    chunks: BundleChunk[]
  ): BundleRecommendation[] {
    const recommendations: BundleRecommendation[] = [];

    // Large bundle recommendation
    const totalSize = modules.reduce((sum, m) => sum + m.size, 0);
    if (totalSize > 500 * 1024) { // > 500KB
      recommendations.push({
        type: 'code-splitting',
        priority: 'high',
        title: 'Large Bundle Detected',
        description: `Bundle is ${this.formatSize(totalSize)}. Consider code splitting to reduce initial load time.`,
        impact: Math.min(50, (totalSize / 1024 / 1024) * 10),
        effort: 'medium',
        codeExample: `// Split vendor code
const vendorChunk = vendors.map(name => require(name));

// Split routes
const routes = [
  {
    path: '/dashboard',
    component: lazy(() => import('./Dashboard'))
  }
];`,
      });
    }

    // Tree shaking opportunities
    const unusedDeps = dependencies.filter(d => !d.required && d.size > 10 * 1024);
    if (unusedDeps.length > 0) {
      recommendations.push({
        type: 'tree-shaking',
        priority: 'medium',
        title: 'Unused Dependencies Detected',
        description: `Found ${unusedDeps.length} potentially unused dependencies consuming ${this.formatSize(unusedDeps.reduce((sum, d) => sum + d.size, 0))}.`,
        impact: unusedDeps.reduce((sum, d) => sum + d.size, 0) / totalSize * 100,
        effort: 'low',
        codeExample: `// Use named exports instead of default exports
// Bad:
import _ from 'lodash';

// Good:
import { debounce } from 'lodash';`,
      });
    }

    // Lazy loading opportunities
    const largeModules = modules.filter(m => m.size > 50 * 1024);
    if (largeModules.length > 0) {
      recommendations.push({
        type: 'lazy-loading',
        priority: 'high',
        title: 'Large Modules Can Be Lazy Loaded',
        description: `Found ${largeModules.length} modules larger than 50KB that could be lazy loaded.`,
        impact: largeModules.reduce((sum, m) => sum + m.size, 0) / totalSize * 100,
        effort: 'low',
        codeExample: `// Use dynamic imports for code splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}`,
      });
    }

    // Vendor chunking
    const vendorSize = dependencies.reduce((sum, d) => sum + d.size, 0);
    if (vendorSize > 200 * 1024) {
      recommendations.push({
        type: 'vendor',
        priority: 'medium',
        title: 'Vendor Code Can Be Split',
        description: `Vendor dependencies total ${this.formatSize(vendorSize)}. Split into separate chunk for better caching.`,
        impact: Math.min(30, vendorSize / 1024 / 1024 * 5),
        effort: 'low',
        codeExample: `// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /node_modules/,
          chunks: 'all',
          name: 'vendor',
        },
      },
    },
  },
};`,
      });
    }

    // Compression recommendation
    const compressionRatio = 1 - (gzipSizeSync(modules.reduce((acc, m) => acc + m.size, 0).toString()) / totalSize);
    if (compressionRatio > 0.6) {
      recommendations.push({
        type: 'compression',
        priority: 'high',
        title: 'Enable Compression',
        description: 'Bundle can be compressed by over 60%. Ensure gzip/brotli is enabled on your server.',
        impact: compressionRatio * 100,
        effort: 'low',
      });
    }

    return recommendations;
  }

  /**
   * Estimate size of a module
   */
  private estimateSize(content: string, moduleName: string): number {
    const regex = new RegExp(`export\\s+(?:function|const|class)\\s+${moduleName}`, 'g');
    const matches = content.match(regex);
    return matches ? matches.length * 1000 : 1000;
  }

  /**
   * Estimate dependency size
   */
  private estimateDependencySize(depName: string): number {
    // Rough estimates based on common packages
    const knownSizes: Record<string, number> = {
      'lodash': 70000,
      'moment': 70000,
      'react': 40000,
      'react-dom': 130000,
      '@mui/material': 400000,
      'antd': 500000,
    };

    for (const [name, size] of Object.entries(knownSizes)) {
      if (depName.includes(name)) {
        return size;
      }
    }

    return 20000; // Default estimate
  }

  /**
   * Get brotli compressed size
   */
  private getBrotliSize(content: string): number {
    try {
      const compressed = brotliCompressSync(Buffer.from(content));
      return compressed.length;
    } catch {
      return 0;
    }
  }

  /**
   * Format size in human-readable format
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
   * Compare two bundle analyses
   */
  compareBundles(before: BundleAnalysisResult, after: BundleAnalysisResult) {
    const sizeDiff = after.size - before.size;
    const gzipDiff = after.gzipSize - before.gzipSize;
    const brotliDiff = after.brotliSize - before.brotliSize;

    return {
      size: {
        before: before.size,
        after: after.size,
        diff: sizeDiff,
        diffPercent: (sizeDiff / before.size) * 100,
      },
      gzip: {
        before: before.gzipSize,
        after: after.gzipSize,
        diff: gzipDiff,
        diffPercent: (gzipDiff / before.gzipSize) * 100,
      },
      brotli: {
        before: before.brotliSize,
        after: after.brotliSize,
        diff: brotliDiff,
        diffPercent: (brotliDiff / before.brotliSize) * 100,
      },
      moduleCount: {
        before: before.modules.length,
        after: after.modules.length,
        diff: after.modules.length - before.modules.length,
      },
      dependencyCount: {
        before: before.dependencies.length,
        after: after.dependencies.length,
        diff: after.dependencies.length - before.dependencies.length,
      },
    };
  }

  /**
   * Generate bundle report
   */
  generateReport(result: BundleAnalysisResult): string {
    let report = '# Bundle Analysis Report\n\n';

    report += `## Bundle: ${result.name}\n\n`;
    report += '### Size Information\n\n';
    report += `- **Original Size:** ${this.formatSize(result.size)}\n`;
    report += `- **Gzip Size:** ${this.formatSize(result.gzipSize)} (${((1 - result.gzipSize / result.size) * 100).toFixed(1)}% reduction)\n`;
    report += `- **Brotli Size:** ${this.formatSize(result.brotliSize)} (${((1 - result.brotliSize / result.size) * 100).toFixed(1)}% reduction)\n\n`;

    if (result.modules.length > 0) {
      report += '### Top Modules\n\n';
      const topModules = [...result.modules].sort((a, b) => b.size - a.size).slice(0, 10);
      for (const module of topModules) {
        report += `- **${module.name}:** ${this.formatSize(module.size)}\n`;
      }
      report += '\n';
    }

    if (result.dependencies.length > 0) {
      report += '### Dependencies\n\n';
      const topDeps = [...result.dependencies].sort((a, b) => b.size - a.size).slice(0, 10);
      for (const dep of topDeps) {
        report += `- **${dep.name}:** ${this.formatSize(dep.size)}\n`;
      }
      report += '\n';
    }

    if (result.recommendations.length > 0) {
      report += '### Recommendations\n\n';
      for (const rec of result.recommendations) {
        const priorityEmoji = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        report += `#### ${priorityEmoji} ${rec.title}\n\n`;
        report += `${rec.description}\n\n`;
        report += `- **Impact:** ${rec.impact.toFixed(1)}% reduction\n`;
        report += `- **Effort:** ${rec.effort}\n\n`;
        if (rec.codeExample) {
          report += '```typescript\n';
          report += rec.codeExample;
          report += '\n```\n\n';
        }
      }
    }

    return report;
  }

  /**
   * Get all analysis results
   */
  getAllResults(): Map<string, BundleAnalysisResult> {
    return this.results;
  }

  /**
   * Clear all analysis results
   */
  clearResults(): void {
    this.results.clear();
  }
}

export default BundleAnalyzer;
