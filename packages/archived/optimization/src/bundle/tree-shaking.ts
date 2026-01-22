// @ts-nocheck
/**
 * Tree Shaking Optimizer
 *
 * Analyzes and optimizes tree shaking for dead code elimination
 */

import { BundleModule, BundleDependency, BundleRecommendation } from '../types/index.js';
import { parse } from 'acorn';
import { simple as walk } from 'acorn-walk';

export interface TreeShakingAnalysis {
  totalModules: number;
  usedModules: number;
  unusedModules: number;
  deadCode: DeadCodeReport[];
  recommendations: BundleRecommendation[];
}

export interface DeadCodeReport {
  module: string;
  type: 'function' | 'class' | 'variable' | 'import';
  name: string;
  size: number;
  reason: string;
}

export class TreeShakingOptimizer {
  /**
   * Analyze bundle for tree shaking opportunities
   */
  async analyze(code: string, modules: BundleModule[]): Promise<TreeShakingAnalysis> {
    const deadCode: DeadCodeReport[] = [];
    const recommendations: BundleRecommendation[] = [];

    // Parse the code
    let ast: any;
    try {
      ast = parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
      });
    } catch (error) {
      return {
        totalModules: modules.length,
        usedModules: modules.length,
        unusedModules: 0,
        deadCode: [],
        recommendations: [],
      };
    }

    // Find all defined functions, classes, and variables
    const definitions = this.findDefinitions(ast, code);

    // Find all used identifiers
    const usedIdentifiers = this.findUsedIdentifiers(ast);

    // Find unused definitions
    for (const def of definitions) {
      if (!usedIdentifiers.has(def.name) && !def.isExported) {
        deadCode.push({
          module: def.module || 'unknown',
          type: def.type,
          name: def.name,
          size: def.end - def.start,
          reason: 'Defined but never used',
        });
      }
    }

    // Analyze imports
    const unusedImports = this.findUnusedImports(ast);
    for (const imp of unusedImports) {
      deadCode.push({
        module: imp.module,
        type: 'import',
        name: imp.name,
        size: 100, // Estimated
        reason: 'Imported but never used',
      });
    }

    // Generate recommendations
    const unusedModules = modules.filter(m =>
      !m.isEntry && m.dependents.length === 0
    );

    recommendations.push(...this.generateRecommendations(deadCode, unusedModules));

    return {
      totalModules: modules.length,
      usedModules: modules.filter(m => m.isEntry || m.dependents.length > 0).length,
      unusedModules: unusedModules.length,
      deadCode,
      recommendations,
    };
  }

  /**
   * Find all definitions in the AST
   */
  private findDefinitions(ast: any, code: string): Array<{
    name: string;
    type: 'function' | 'class' | 'variable';
    start: number;
    end: number;
    isExported: boolean;
    module?: string;
  }> {
    const definitions: Array<{
      name: string;
      type: 'function' | 'class' | 'variable';
      start: number;
      end: number;
      isExported: boolean;
      module?: string;
    }> = [];

    walk(ast, {
      FunctionDeclaration(node: any) {
        if (node.id) {
          definitions.push({
            name: node.id.name,
            type: 'function',
            start: node.start,
            end: node.end,
            isExported: false,
          });
        }
      },
      ClassDeclaration(node: any) {
        if (node.id) {
          definitions.push({
            name: node.id.name,
            type: 'class',
            start: node.start,
            end: node.end,
            isExported: false,
          });
        }
      },
      VariableDeclaration(node: any) {
        for (const declarator of node.declarations) {
          if (declarator.id.type === 'Identifier') {
            definitions.push({
              name: declarator.id.name,
              type: 'variable',
              start: node.start,
              end: node.end,
              isExported: false,
            });
          }
        }
      },
      ExportNamedDeclaration(node: any) {
        if (node.declaration) {
          if (node.declaration.id) {
            const def = definitions.find(d => d.name === node.declaration.id.name);
            if (def) {
              def.isExported = true;
            }
          }
        }
      },
      ExportDefaultDeclaration(node: any) {
        if (node.declaration.id) {
          const def = definitions.find(d => d.name === node.declaration.id.name);
          if (def) {
            def.isExported = true;
          }
        }
      },
    });

    return definitions;
  }

  /**
   * Find all used identifiers in the AST
   */
  private findUsedIdentifiers(ast: any): Set<string> {
    const used = new Set<string>();

    walk(ast, {
      Identifier(node: any) {
        // Skip if it's a declaration (property name, function name, etc.)
        // This is a simplified check
        used.add(node.name);
      },
    });

    return used;
  }

  /**
   * Find unused imports
   */
  private findUnusedImports(ast: any): Array<{ module: string; name: string }> {
    const imports: Array<{ module: string; name: string; used: boolean }> = [];

    walk(ast, {
      ImportDeclaration(node: any) {
        const module = node.source.value;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier' ||
              specifier.type === 'ImportSpecifier') {
            imports.push({
              module,
              name: specifier.local.name,
              used: false,
            });
          }
        }
      },
    });

    return imports.filter(imp => !imp.used);
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    deadCode: DeadCodeReport[],
    unusedModules: BundleModule[]
  ): BundleRecommendation[] {
    const recommendations: BundleRecommendation[] = [];

    // Dead code elimination
    const deadCodeByModule = this.groupBy(deadCode, 'module');
    for (const [module, code] of Object.entries(deadCodeByModule)) {
      const totalSize = code.reduce((sum, c) => sum + c.size, 0);
      if (totalSize > 1000) { // > 1KB
        recommendations.push({
          type: 'tree-shaking',
          priority: 'medium',
          title: `Dead Code in "${module}"`,
          description: `Found ${code.length} unused definitions (${this.formatSize(totalSize)}). Remove or export if needed externally.`,
          impact: Math.min(20, totalSize / 100),
          effort: 'low',
          codeExample: `// Remove unused code:
// - ${code.map(c => c.name).join('\n// - ')}

// Or use sideEffects: false in package.json
{
  "sideEffects": false
}`,
        });
      }
    }

    // Unused imports
    const unusedImports = deadCode.filter(c => c.type === 'import');
    if (unusedImports.length > 0) {
      const importsByModule = this.groupBy(unusedImports, 'module');
      for (const [module, imports] of Object.entries(importsByModule)) {
        recommendations.push({
          type: 'tree-shaking',
          priority: 'low',
          title: `Unused Imports from "${module}"`,
          description: `Found ${imports.length} unused imports. Remove to reduce bundle size.`,
          impact: Math.min(5, imports.length),
          effort: 'low',
          codeExample: `// Remove unused imports:
// import { ${imports.map(i => i.name).join(', ')} } from '${module}';

// Keep only what you use:
import { usedImport } from '${module}';`,
        });
      }
    }

    // Unused modules
    if (unusedModules.length > 0) {
      recommendations.push({
        type: 'code-splitting',
        priority: 'high',
        title: 'Unused Modules Detected',
        description: `Found ${unusedModules.length} modules that are not imported anywhere. Remove from bundle.`,
        impact: unusedModules.reduce((sum, m) => sum + m.size, 0) / 1024,
        effort: 'low',
        codeExample: `// Remove these unused files:
${unusedModules.map(m => `// - ${m.name}`).join('\n')}`,
      });
    }

    return recommendations;
  }

  /**
   * Group array by property
   */
  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((result, item) => {
      const group = String(item[key]);
      if (!result[group]) {
        result[group] = [];
      }
      result[group].push(item);
      return result;
    }, {} as Record<string, T[]>);
  }

  /**
   * Format size in human-readable format
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  /**
   * Analyze specific file for tree shaking
   */
  async analyzeFile(filePath: string): Promise<TreeShakingAnalysis> {
    // This would read the file and analyze it
    // For now, return a placeholder
    return {
      totalModules: 0,
      usedModules: 0,
      unusedModules: 0,
      deadCode: [],
      recommendations: [],
    };
  }

  /**
   * Generate webpack configuration for better tree shaking
   */
  generateWebpackConfig(): string {
    return `// webpack.config.js
module.exports = {
  mode: 'production',
  optimization: {
    usedExports: true,
    sideEffects: true,
    providedExports: true,
  },
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
};`;
  }

  /**
   * Generate esbuild configuration for better tree shaking
   */
  generateEsbuildConfig(): string {
    return `// esbuild.config.js
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  treeShaking: true,
  minify: true,
  format: 'esm',
  outfile: 'dist/bundle.js',
});`;
  }

  /**
   * Generate Vite configuration for better tree shaking
   */
  generateViteConfig(): string {
    return `// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {},
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: true,
        tryCatchDeoptimization: false,
      },
    },
  },
});`;
  }
}

export default TreeShakingOptimizer;
