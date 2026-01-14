/**
 * Code Splitting Optimizer
 *
 * Implements intelligent code splitting strategies for optimal bundle sizes
 */

import { CodeSplittingOptions, BundleModule, BundleChunk, BundleRecommendation } from '../types/index.js';

export class CodeSplittingOptimizer {
  private options: CodeSplittingOptions;

  constructor(options: Partial<CodeSplittingOptions> = {}) {
    this.options = {
      strategy: 'mixed',
      manualChunks: {},
      minChunkSize: 20 * 1024, // 20KB
      maxChunkSize: 244 * 1024, // 244KB
      ...options,
    };
  }

  /**
   * Analyze and generate code splitting recommendations
   */
  analyzeSplitting(modules: BundleModule[]): BundleRecommendation[] {
    const recommendations: BundleRecommendation[] = [];

    // Group modules by type/route
    const routeModules = this.extractRouteModules(modules);
    const vendorModules = this.extractVendorModules(modules);
    const componentModules = this.extractComponentModules(modules);

    // Route-based splitting
    if (this.options.strategy === 'route' || this.options.strategy === 'mixed') {
      const routeRecommendations = this.analyzeRouteSplitting(routeModules);
      recommendations.push(...routeRecommendations);
    }

    // Vendor splitting
    if (this.options.strategy === 'vendor' || this.options.strategy === 'mixed') {
      const vendorRecommendations = this.analyzeVendorSplitting(vendorModules);
      recommendations.push(...vendorRecommendations);
    }

    // Component-based splitting
    if (this.options.strategy === 'component' || this.options.strategy === 'mixed') {
      const componentRecommendations = this.analyzeComponentSplitting(componentModules);
      recommendations.push(...componentRecommendations);
    }

    return recommendations;
  }

  /**
   * Generate split chunks configuration
   */
  generateSplitChunks(modules: BundleModule[]): Record<string, string[]> {
    const chunks: Record<string, string[]> = {
      vendor: [],
      common: [],
      routes: [],
      components: [],
    };

    // Vendor libraries
    const vendorModules = this.extractVendorModules(modules);
    chunks.vendor = vendorModules.map(m => m.name);

    // Common shared code
    const commonModules = this.extractCommonModules(modules);
    chunks.common = commonModules.map(m => m.name);

    // Route-specific chunks
    const routeModules = this.extractRouteModules(modules);
    for (const route of this.groupByRoute(routeModules)) {
      chunks[`route-${route.name}`] = route.modules.map(m => m.name);
    }

    // Large components
    const largeComponents = modules
      .filter(m => m.size > 50 * 1024 && !m.isEntry)
      .map(m => m.name);

    if (largeComponents.length > 0) {
      chunks['large-components'] = largeComponents;
    }

    return chunks;
  }

  /**
   * Analyze route-based splitting
   */
  private analyzeRouteSplitting(modules: BundleModule[]): BundleRecommendation[] {
    const recommendations: BundleRecommendation[] = [];
    const routes = this.groupByRoute(modules);

    for (const route of routes) {
      const totalSize = route.modules.reduce((sum, m) => sum + m.size, 0);

      if (totalSize > 100 * 1024) {
        recommendations.push({
          type: 'code-splitting',
          priority: 'high',
          title: `Route "${route.name}" Can Be Lazy Loaded`,
          description: `Route bundle is ${this.formatSize(totalSize)}. Lazy load to reduce initial bundle size.`,
          impact: Math.min(40, (totalSize / 1024 / 1024) * 10),
          effort: 'low',
          codeExample: `// Create lazy-loaded route component
const ${this.capitalize(route.name)}Route = lazy(() => import('./pages/${route.name}'));

// In router
<Route path="/${route.name}" element={
  <Suspense fallback={<Loading />}>
    <${this.capitalize(route.name)}Route />
  </Suspense>
} />`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Analyze vendor splitting
   */
  private analyzeVendorSplitting(modules: BundleModule[]): BundleRecommendation[] {
    const recommendations: BundleRecommendation[] = [];
    const vendorGroups = this.groupByVendor(modules);

    for (const [vendor, vendorModules] of Object.entries(vendorGroups)) {
      const totalSize = vendorModules.reduce((sum, m) => sum + m.size, 0);

      if (totalSize > 50 * 1024) {
        recommendations.push({
          type: 'vendor',
          priority: 'medium',
          title: `Vendor "${vendor}" Can Be Separate Chunk`,
          description: `Vendor code for ${vendor} is ${this.formatSize(totalSize)}. Extract to separate chunk for better caching.`,
          impact: Math.min(30, (totalSize / 1024 / 1024) * 5),
          effort: 'low',
          codeExample: `// webpack.config.js
optimization: {
  splitChunks: {
    cacheGroups: {
      ${vendor.replace(/[^a-zA-Z0-9]/g, '-')}: {
        test: /[\\/]node_modules[\\/]${vendor}[\\/]/,
        name: '${vendor.replace(/[^a-zA-Z0-9]/g, '-')}',
        chunks: 'all',
      },
    },
  },
}`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Analyze component splitting
   */
  private analyzeComponentSplitting(modules: BundleModule[]): BundleRecommendation[] {
    const recommendations: BundleRecommendation[] = [];

    // Find large components
    const largeComponents = modules.filter(m => m.size > 50 * 1024 && !m.isEntry);

    for (const component of largeComponents) {
      recommendations.push({
        type: 'lazy-loading',
        priority: 'medium',
        title: `Component "${component.name}" Can Be Lazy Loaded`,
        description: `Component is ${this.formatSize(component.size)}. Lazy load to defer loading until needed.`,
        impact: Math.min(20, (component.size / 1024 / 1024) * 5),
        effort: 'low',
        codeExample: `// Lazy load the component
const ${component.name} = lazy(() => import('./components/${component.name}'));

// Use with Suspense
<Suspense fallback={<Skeleton />}>
  <${component.name} />
</Suspense>`,
      });
    }

    return recommendations;
  }

  /**
   * Extract route modules
   */
  private extractRouteModules(modules: BundleModule[]): BundleModule[] {
    return modules.filter(m =>
      m.name.includes('route') ||
      m.name.includes('page') ||
      m.name.includes('view') ||
      /pages|routes|views/.test(m.name)
    );
  }

  /**
   * Extract vendor modules
   */
  private extractVendorModules(modules: BundleModule[]): BundleModule[] {
    return modules.filter(m =>
      /node_modules|vendor/.test(m.name) ||
      /^(react|react-dom|lodash|moment|axios)/.test(m.name)
    );
  }

  /**
   * Extract component modules
   */
  private extractComponentModules(modules: BundleModule[]): BundleModule[] {
    return modules.filter(m =>
      m.name.includes('component') ||
      m.name.includes('Component') ||
      /components/.test(m.name)
    );
  }

  /**
   * Extract common modules shared across multiple chunks
   */
  private extractCommonModules(modules: BundleModule[]): BundleModule[] {
    return modules.filter(m => m.dependents.length > 2);
  }

  /**
   * Group modules by route
   */
  private groupByRoute(modules: BundleModule[]): Array<{ name: string; modules: BundleModule[] }> {
    const groups = new Map<string, BundleModule[]>();

    for (const module of modules) {
      const routeMatch = module.name.match(/pages\/([^\/]+)/) ||
                        module.name.match(/routes\/([^\/]+)/) ||
                        module.name.match(/views\/([^\/]+)/);

      if (routeMatch) {
        const routeName = routeMatch[1];
        if (!groups.has(routeName)) {
          groups.set(routeName, []);
        }
        groups.get(routeName)!.push(module);
      }
    }

    return Array.from(groups.entries()).map(([name, modules]) => ({ name, modules }));
  }

  /**
   * Group modules by vendor
   */
  private groupByVendor(modules: BundleModule[]): Record<string, BundleModule[]> {
    const groups: Record<string, BundleModule[]> = {};

    for (const module of modules) {
      const vendorMatch = module.name.match(/node_modules\/([^\/]+)/);
      if (vendorMatch) {
        const vendor = vendorMatch[1];
        if (!groups[vendor]) {
          groups[vendor] = [];
        }
        groups[vendor].push(module);
      }
    }

    return groups;
  }

  /**
   * Format size in human-readable format
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Update splitting options
   */
  updateOptions(options: Partial<CodeSplittingOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): CodeSplittingOptions {
    return { ...this.options };
  }
}

export default CodeSplittingOptimizer;
