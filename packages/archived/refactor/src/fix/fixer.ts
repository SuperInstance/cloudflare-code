// @ts-nocheck
/**
 * Auto Fixer
 *
 * Automatically fixes lint errors, warnings, and common issues.
 */

import { ASTTransformer } from '../ast/transformer';
import { parse } from '../parsers/parser';
import { Formatter } from '../utils/formatter';
import { Logger } from '../utils/logger';
import { ChangeTracker } from '../utils/change-tracker';

export interface FixOptions {
  fixType?: 'all' | 'lint' | 'error' | 'warning' | 'security' | 'performance';
  autoCommit?: boolean;
  dryRun?: boolean;
  maxFixes?: number;
}

export interface FixResult {
  success: boolean;
  fixesApplied: Fix[];
  warnings: string[];
  errors: string[];
  remainingIssues: number;
}

export interface Fix {
  type: string;
  rule: string;
  file: string;
  line: number;
  column: number;
  message: string;
  applied: boolean;
}

export class AutoFixer {
  private transformer: ASTTransformer;
  private formatter: Formatter;
  private logger: Logger;
  private changeTracker: ChangeTracker;

  constructor(private options: FixOptions = {}) {
    this.transformer = new ASTTransformer();
    this.formatter = new Formatter();
    this.logger = new Logger('info');
    this.changeTracker = new ChangeTracker();
  }

  /**
   * Fix all issues in a file
   */
  async fixFile(filePath: string): Promise<FixResult> {
    this.logger.info(`Fixing issues in ${filePath}`);

    const fixesApplied: Fix[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const code = await require('fs/promises').readFile(filePath, 'utf-8');
      const ast = await parse(filePath, code);

      // Apply different types of fixes based on options
      if (this.options.fixType === 'all' || this.options.fixType === 'lint') {
        const lintFixes = await this.fixLintIssues(ast, filePath, code);
        fixesApplied.push(...lintFixes);
      }

      if (this.options.fixType === 'all' || this.options.fixType === 'error') {
        const errorFixes = await this.fixErrors(ast, filePath, code);
        fixesApplied.push(...errorFixes);
      }

      if (this.options.fixType === 'all' || this.options.fixType === 'security') {
        const securityFixes = await this.fixSecurityIssues(ast, filePath, code);
        fixesApplied.push(...securityFixes);
      }

      if (this.options.fixType === 'all' || this.options.fixType === 'performance') {
        const performanceFixes = await this.fixPerformanceIssues(ast, filePath, code);
        fixesApplied.push(...performanceFixes);
      }

      // Generate fixed code
      const result = this.transformer.generate(ast);
      const fixedCode = await this.formatter.format(result.code, filePath, code);

      // Write fixed code if not dry run
      if (!this.options.dryRun && fixesApplied.length > 0) {
        await require('fs/promises').writeFile(filePath, fixedCode);
      }

      this.logger.info(`Applied ${fixesApplied.length} fixes`);

      return {
        success: true,
        fixesApplied,
        warnings,
        errors,
        remainingIssues: 0
      };
    } catch (error) {
      this.logger.error(`Failed to fix ${filePath}: ${error}`);
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        fixesApplied,
        warnings,
        errors,
        remainingIssues: 0
      };
    }
  }

  /**
   * Fix all issues in a project
   */
  async fixProject(projectPath: string): Promise<FixResult> {
    this.logger.info(`Fixing issues in project: ${projectPath}`);

    const allFixes: Fix[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const { findProjectFiles } = await import('../utils/reference-finder');

      // Find all fixable files
      const files = await this.findFixableFiles(projectPath);

      this.logger.info(`Found ${files.length} files to fix`);

      for (const filePath of files) {
        const result = await this.fixFile(filePath);
        allFixes.push(...result.fixesApplied);
        warnings.push(...result.warnings);
        errors.push(...result.errors);
      }

      return {
        success: errors.length === 0,
        fixesApplied: allFixes,
        warnings,
        errors,
        remainingIssues: 0
      };
    } catch (error) {
      this.logger.error(`Failed to fix project: ${error}`);
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        fixesApplied: allFixes,
        warnings,
        errors,
        remainingIssues: 0
      };
    }
  }

  /**
   * Fix lint issues
   */
  private async fixLintIssues(ast: any, filePath: string, code: string): Promise<Fix[]> {
    const fixes: Fix[] = [];

    this.transformer.traverse(ast, {
      // Fix unused variables
      VariableDeclarator(path) {
        if (this.isUnusedVariable(path)) {
          const binding = path.scope.getBinding(path.node.id.name);
          if (binding && !binding.referenced && !binding.constantViolations.length) {
            path.remove();
            fixes.push({
              type: 'lint',
              rule: 'no-unused-vars',
              file: filePath,
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              message: `Remove unused variable '${path.node.id.name}'`,
              applied: true
            });
          }
        }
      },

      // Fix missing semicolons
      ExpressionStatement(path) {
        if (!path.node.semicolon && this.needsSemicolon(path)) {
          path.node.semicolon = true;
          fixes.push({
            type: 'lint',
            rule: 'semi',
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Add missing semicolon',
            applied: true
          });
        }
      },

      // Fix double quotes vs single quotes
      StringLiteral(path) {
        // Prefer single quotes
        if (path.node.extra?.raw?.startsWith('"')) {
          path.node.extra.raw = `'${path.node.value}'`;
          fixes.push({
            type: 'lint',
            rule: 'quotes',
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Use single quotes instead of double quotes',
            applied: true
          });
        }
      },

      // Fix trailing commas
      ObjectExpression(path) {
        if (!this.hasTrailingComma(path.node)) {
          fixes.push({
            type: 'lint',
            rule: 'comma-dangle',
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Add trailing comma',
            applied: false // Needs formatter
          });
        }
      }
    });

    return fixes;
  }

  /**
   * Fix errors
   */
  private async fixErrors(ast: any, filePath: string, code: string): Promise<Fix[]> {
    const fixes: Fix[] = [];

    this.transformer.traverse(ast, {
      // Fix undefined references
      Identifier(path) {
        if (path.isReferencedIdentifier() && !path.scope.hasBinding(path.node.name)) {
          // Try to suggest fixes for undefined references
          fixes.push({
            type: 'error',
            rule: 'no-undef',
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: `'${path.node.name}' is not defined`,
            applied: false
          });
        }
      },

      // Fix duplicate function parameters
      FunctionDeclaration(path) {
        const paramNames = new Set<string>();
        path.node.params.forEach((param: any) => {
          const name = (param as any).name;
          if (paramNames.has(name)) {
            fixes.push({
              type: 'error',
              rule: 'no-dupe-args',
              file: filePath,
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              message: `Duplicate parameter '${name}'`,
              applied: false
            });
          }
          paramNames.add(name);
        });
      }
    });

    return fixes;
  }

  /**
   * Fix security issues
   */
  private async fixSecurityIssues(ast: any, filePath: string, code: string): Promise<Fix[]> {
    const fixes: Fix[] = [];

    this.transformer.traverse(ast, {
      // Fix eval usage
      CallExpression(path) {
        if ((path.node.callee as any).name === 'eval') {
          fixes.push({
            type: 'security',
            rule: 'no-eval',
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Avoid using eval() for security reasons',
            applied: false
          });
        }

        // Fix innerHTML usage
        if ((path.node.callee as any)?.property?.name === 'innerHTML') {
          fixes.push({
            type: 'security',
            rule: 'no-inner-html',
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Avoid using innerHTML to prevent XSS',
            applied: false
          });
        }
      },

      // Fix insecure crypto usage
      MemberExpression(path) {
        if ((path.node.object as any)?.name === 'Math' && (path.node.property as any)?.name === 'random') {
          fixes.push({
            type: 'security',
            rule: 'no-math-random',
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Use crypto.getRandomValues() instead of Math.random() for security',
            applied: false
          });
        }
      }
    });

    return fixes;
  }

  /**
   * Fix performance issues
   */
  private async fixPerformanceIssues(ast: any, filePath: string, code: string): Promise<Fix[]> {
    const fixes: Fix[] = [];

    this.transformer.traverse(ast, {
      // Fix unnecessary concatenation
      BinaryExpression(path) {
        if (path.node.operator === '+' && this.isStringConcatenation(path.node)) {
          fixes.push({
            type: 'performance',
            rule: 'prefer-template',
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Use template literals instead of string concatenation',
            applied: false
          });
        }
      },

      // Fix inefficient array operations
      ForStatement(path) {
        if (this.canUseArrayMethod(path.node)) {
          fixes.push({
            type: 'performance',
            rule: 'prefer-array-methods',
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            message: 'Use array methods instead of for loops where possible',
            applied: false
          });
        }
      }
    });

    return fixes;
  }

  /**
   * Find fixable files in project
   */
  private async findFixableFiles(projectPath: string): Promise<string[]> {
    const { findProjectFiles } = await import('../utils/reference-finder');

    // This will be implemented by reference-finder
    const files: string[] = [];

    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

    async function walk(dir: string) {
      const { readdir } = require('fs/promises');
      const { join } = require('path');

      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.')) {
            await walk(fullPath);
          }
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }

    await walk(projectPath);
    return files;
  }

  // Helper methods

  private isUnusedVariable(path: any): boolean {
    const binding = path.scope.getBinding(path.node.id.name);
    return !binding || (!binding.referenced && !binding.constantViolations.length);
  }

  private needsSemicolon(path: any): boolean {
    // Check if expression statement needs semicolon
    return true; // Simplified
  }

  private hasTrailingComma(node: any): boolean {
    // Check if object/array has trailing comma
    return false; // Simplified
  }

  private isStringConcatenation(node: any): boolean {
    // Check if binary expression is string concatenation
    return true; // Simplified
  }

  private canUseArrayMethod(node: any): boolean {
    // Check if for loop can be converted to array method
    return false; // Simplified
  }
}
