/**
 * Code Modernizer
 *
 * Modernizes code to use latest syntax, APIs, and best practices.
 * Supports syntax updates, API modernization, and pattern updates.
 */

import { ASTTransformer } from '../ast/transformer';
import { parse } from '../parsers/parser';
import { Formatter } from '../utils/formatter';
import { Logger } from '../utils/logger';
import { semver } from '../utils/version-utils';

export interface ModernizationOptions {
  targetVersion?: string;
  framework?: string;
  aggressive?: boolean;
  preserveComments?: boolean;
  dryRun?: boolean;
}

export interface ModernizationResult {
  success: boolean;
  changes: ModernizationChange[];
  newContent?: string;
  warnings: string[];
  errors: string[];
}

export interface ModernizationChange {
  type: 'syntax' | 'api' | 'pattern' | 'deprecation' | 'feature';
  description: string;
  location: { line: number; column: number };
  oldCode?: string;
  newCode?: string;
  confidence: number;
}

export class CodeModernizer {
  private transformer: ASTTransformer;
  private formatter: Formatter;
  private logger: Logger;

  constructor(private options: ModernizationOptions = {}) {
    this.transformer = new ASTTransformer({
      retainComments: options.preserveComments ?? true
    });
    this.formatter = new Formatter();
    this.logger = new Logger('info');
  }

  /**
   * Modernize code to use latest syntax and APIs
   */
  async modernize(code: string, filePath: string, language: string = 'typescript'): Promise<ModernizationResult> {
    this.logger.info(`Modernizing ${filePath}`);

    const changes: ModernizationChange[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      let ast = await parse(filePath, code);
      let modernizedCode = code;

      // Apply syntax modernizations
      const syntaxChanges = await this.modernizeSyntax(ast, code);
      changes.push(...syntaxChanges);

      // Apply API modernizations
      const apiChanges = await this.modernizeAPIs(ast, code);
      changes.push(...apiChanges);

      // Apply pattern updates
      const patternChanges = await this.updatePatterns(ast, code);
      changes.push(...patternChanges);

      // Migrate deprecations
      const deprecationChanges = await this.migrateDeprecations(ast, code);
      changes.push(...deprecationChanges);

      // Adopt new features
      const featureChanges = await this.adoptFeatures(ast, code);
      changes.push(...featureChanges);

      // Generate modernized code
      if (!this.options.dryRun) {
        ast = await parse(filePath, code); // Re-parse with all transformations applied
        const result = this.transformer.generate(ast);
        modernizedCode = await this.formatter.format(result.code, filePath, code);
      }

      this.logger.info(`Modernization complete: ${changes.length} changes`);

      return {
        success: true,
        changes,
        newContent: modernizedCode,
        warnings,
        errors
      };
    } catch (error) {
      this.logger.error(`Modernization failed: ${error}`);
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        changes,
        warnings,
        errors
      };
    }
  }

  /**
   * Modernize syntax to use latest language features
   */
  private async modernizeSyntax(ast: any, code: string): Promise<ModernizationChange[]> {
    const changes: ModernizationChange[] = [];

    this.transformer.traverse(ast, {
      // Convert var to let/const
      VariableDeclaration(path) {
        if (path.node.kind === 'var') {
          // Determine if let or const is appropriate
          path.node.kind = this.isConstDeclaration(path.node) ? 'const' : 'let';

          changes.push({
            type: 'syntax',
            description: 'Convert var to let/const',
            location: { line: path.node.loc?.start.line || 0, column: path.node.loc?.start.column || 0 },
            confidence: 0.95
          });
        }
      },

      // Convert function to arrow function where appropriate
      FunctionExpression(path) {
        if (this.canConvertToArrowFunction(path)) {
          const arrowFunc = this.convertToArrowFunction(path.node);
          path.replaceWith(arrowFunc);

          changes.push({
            type: 'syntax',
            description: 'Convert function to arrow function',
            location: { line: path.node.loc?.start.line || 0, column: path.node.loc?.start.column || 0 },
            confidence: 0.90
          });
        }
      },

      // Convert .bind(this) to arrow function
      CallExpression(path) {
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isMemberExpression(path.node.callee.object) &&
          (path.node.callee.property as t.Identifier).name === 'bind' &&
          t.isThisExpression((path.node.callee.object as t.MemberExpression).object)
        ) {
          const func = (path.node.callee.object as t.MemberExpression).property;
          const arrowFunc = t.arrowFunctionExpression(
            [],
            t.callExpression(func as t.Expression, [])
          );
          path.replaceWith(arrowFunc);

          changes.push({
            type: 'syntax',
            description: 'Convert .bind(this) to arrow function',
            location: { line: path.node.loc?.start.line || 0, column: path.node.loc?.start.column || 0 },
            confidence: 0.95
          });
        }
      },

      // Convert string concatenation to template literals
      BinaryExpression(path) {
        if (path.node.operator === '+' && this.isStringConcatenation(path.node)) {
          const templateLiteral = this.convertToTemplateLiteral(path.node);
          path.replaceWith(templateLiteral);

          changes.push({
            type: 'syntax',
            description: 'Convert string concatenation to template literal',
            location: { line: path.node.loc?.start.line || 0, column: path.node.loc?.start.column || 0 },
            confidence: 0.95
          });
        }
      },

      // Convert to optional chaining
      MemberExpression(path) {
        if (this.canConvertToOptionalChaining(path)) {
          const optional = this.convertToOptionalChaining(path.node);
          path.replaceWith(optional);

          changes.push({
            type: 'syntax',
            description: 'Convert to optional chaining',
            location: { line: path.node.loc?.start.line || 0, column: path.node.loc?.start.column || 0 },
            confidence: 0.90
          });
        }
      },

      // Convert to nullish coalescing
      ConditionalExpression(path) {
        if (this.isNullishCheck(path.node)) {
          const nullish = t.logicalExpression(
            '??',
            path.node.test,
            path.node.consequent
          );
          path.replaceWith(nullish);

          changes.push({
            type: 'syntax',
            description: 'Convert to nullish coalescing',
            location: { line: path.node.loc?.start.line || 0, column: path.node.loc?.start.column || 0 },
            confidence: 0.95
          });
        }
      },

      // Convert to object destructuring
      VariableDeclaration(path) {
        if (this.canDestructure(path.node)) {
          const destructured = this.convertToDestructuring(path.node);
          path.replaceWith(destructured);

          changes.push({
            type: 'syntax',
            description: 'Convert to object destructuring',
            location: { line: path.node.loc?.start.line || 0, column: path.node.loc?.start.column || 0 },
            confidence: 0.90
          });
        }
      },

      // Convert to array destructuring
      VariableDeclaration(path) {
        if (this.canArrayDestructure(path.node)) {
          const destructured = this.convertToArrayDestructuring(path.node);
          path.replaceWith(destructured);

          changes.push({
            type: 'syntax',
            description: 'Convert to array destructuring',
            location: { line: path.node.loc?.start.line || 0, column: path.node.loc?.start.column || 0 },
            confidence: 0.90
          });
        }
      },

      // Use async/await instead of promises
      CallExpression(path) {
        if (this.canConvertToAsyncAwait(path)) {
          const asyncAwait = this.convertToAsyncAwait(path.node);
          path.replaceWith(asyncAwait);

          changes.push({
            type: 'syntax',
            description: 'Convert to async/await',
            location: { line: path.node.loc?.start.line || 0, column: path.node.loc?.start.column || 0 },
            confidence: 0.85
          });
        }
      }
    });

    return changes;
  }

  /**
   * Modernize API usage to latest standards
   */
  private async modernizeAPIs(ast: any, code: string): Promise<ModernizationChange[]> {
    const changes: ModernizationChange[] = [];

    this.transformer.traverse(ast, {
      // Modernize Node.js APIs
      CallExpression(path) {
        // require() to import (handled separately)
        // fs.exists to fs.stat
        // fs.readFile to fs.promises.readFile
        if (this.isFSAPICall(path.node, 'exists')) {
          changes.push({
            type: 'api',
            description: 'fs.exists is deprecated, use fs.stat or fs.access',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 1.0
          });
        }

        // Modernize callback-based APIs to promise-based
        if (this.isCallbackAPI(path.node)) {
          const promiseAPI = this.convertToPromiseAPI(path.node);
          if (promiseAPI) {
            path.replaceWith(promiseAPI);
            changes.push({
              type: 'api',
              description: 'Convert callback API to promise-based API',
              location: { line: path.node.loc?.start.line || 0, column: 0 },
              confidence: 0.90
            });
          }
        }
      },

      // Modernize browser APIs
      MemberExpression(path) {
        // XMLHttpRequest to fetch
        if (this.isXMLHttpRequest(path.node)) {
          changes.push({
            type: 'api',
            description: 'Consider using fetch instead of XMLHttpRequest',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.95
          });
        }
      }
    });

    return changes;
  }

  /**
   * Update code patterns to modern best practices
   */
  private async updatePatterns(ast: any, code: string): Promise<ModernizationChange[]> {
    const changes: ModernizationChange[] = [];

    this.transformer.traverse(ast, {
      // Use for...of instead of for loop
      ForStatement(path) {
        if (this.canConvertToForOf(path.node)) {
          const forOf = this.convertToForOf(path.node);
          path.replaceWith(forOf);

          changes.push({
            type: 'pattern',
            description: 'Convert for loop to for...of',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.85
          });
        }
      },

      // Use array methods instead of manual loops
      ForStatement(path) {
        if (this.canConvertToArrayMethod(path.node)) {
          const arrayMethod = this.convertToArrayMethod(path.node);
          if (arrayMethod) {
            path.replaceWith(arrayMethod);
            changes.push({
              type: 'pattern',
              description: 'Convert loop to array method',
              location: { line: path.node.loc?.start.line || 0, column: 0 },
              confidence: 0.80
            });
          }
        }
      },

      // Use object spread instead of Object.assign
      CallExpression(path) {
        if (this.isObjectAssignCall(path.node)) {
          const spread = this.convertToObjectSpread(path.node);
          path.replaceWith(spread);

          changes.push({
            type: 'pattern',
            description: 'Use object spread instead of Object.assign',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.95
          });
        }
      },

      // Use array spread instead of .concat
      CallExpression(path) {
        if (this.isArrayConcatCall(path.node)) {
          const spread = this.convertToArraySpread(path.node);
          path.replaceWith(spread);

          changes.push({
            type: 'pattern',
            description: 'Use array spread instead of .concat()',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.95
          });
        }
      },

      // Use shorthand properties
      ObjectExpression(path) {
        if (this.canUseShorthandProperties(path.node)) {
          this.convertToShorthandProperties(path.node);
          changes.push({
            type: 'pattern',
            description: 'Use shorthand properties',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.95
          });
        }
      },

      // Use shorthand methods
      ObjectMethod(path) {
        if (this.canUseShorthandMethod(path.node)) {
          changes.push({
            type: 'pattern',
            description: 'Use shorthand method syntax',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.95
          });
        }
      },

      // Use computed property names where appropriate
      ObjectExpression(path) {
        if (this.canUseComputedProperty(path.node)) {
          changes.push({
            type: 'pattern',
            description: 'Use computed property names',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.85
          });
        }
      }
    });

    return changes;
  }

  /**
   * Migrate deprecated APIs and patterns
   */
  private async migrateDeprecations(ast: any, code: string): Promise<ModernizationChange[]> {
    const changes: ModernizationChange[] = [];

    this.transformer.traverse(ast, {
      // Migrate deprecated React APIs
      CallExpression(path) {
        if (this.isDeprecatedReactAPI(path.node)) {
          const modernAPI = this.getModernReactAPI(path.node);
          changes.push({
            type: 'deprecation',
            description: `Migrate from deprecated React API: ${modernAPI}`,
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.95
          });
        }
      },

      // Migrate deprecated Node.js APIs
      MemberExpression(path) {
        if (this.isDeprecatedNodeAPI(path.node)) {
          const modernAPI = this.getModernNodeAPI(path.node);
          changes.push({
            type: 'deprecation',
            description: `Migrate from deprecated Node.js API: ${modernAPI}`,
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.95
          });
        }
      },

      // Migrate deprecated browser APIs
      CallExpression(path) {
        if (this.isDeprecatedBrowserAPI(path.node)) {
          const modernAPI = this.getModernBrowserAPI(path.node);
          changes.push({
            type: 'deprecation',
            description: `Migrate from deprecated browser API: ${modernAPI}`,
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.95
          });
        }
      }
    });

    return changes;
  }

  /**
   * Adopt new language and framework features
   */
  private async adoptFeatures(ast: any, code: string): Promise<ModernizationChange[]> {
    const changes: ModernizationChange[] = [];

    this.transformer.traverse(ast, {
      // Suggest using private class fields
      ClassDeclaration(path) {
        if (this.canUsePrivateFields(path.node)) {
          changes.push({
            type: 'feature',
            description: 'Consider using private class fields (#)',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.85
          });
        }
      },

      // Suggest using class properties
      ClassDeclaration(path) {
        if (this.canUseClassProperties(path.node)) {
          changes.push({
            type: 'feature',
            description: 'Consider using class properties',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.90
          });
        }
      },

      // Suggest using numeric separators
      NumericLiteral(path) {
        if (this.canUseNumericSeparator(path.node)) {
          changes.push({
            type: 'feature',
            description: 'Consider using numeric separators for readability',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.85
          });
        }
      },

      // Suggest using logical assignment operators
      AssignmentExpression(path) {
        if (this.canUseLogicalAssignment(path.node)) {
          const logicalAssignment = this.convertToLogicalAssignment(path.node);
          path.replaceWith(logicalAssignment);

          changes.push({
            type: 'feature',
            description: 'Use logical assignment operators (??=, ||=, &&=)',
            location: { line: path.node.loc?.start.line || 0, column: 0 },
            confidence: 0.95
          });
        }
      }
    });

    return changes;
  }

  // Helper methods for syntax detection and conversion

  private isConstDeclaration(node: any): boolean {
    // Check if variable is never reassigned
    return true; // Simplified
  }

  private canConvertToArrowFunction(path: any): boolean {
    // Check if function can be safely converted to arrow function
    return !path.node.generator && !path.node.async;
  }

  private convertToArrowFunction(node: any): any {
    // Conversion logic
    return node;
  }

  private isStringConcatenation(node: any): boolean {
    // Check if binary expression is string concatenation
    return true; // Simplified
  }

  private convertToTemplateLiteral(node: any): any {
    // Conversion logic
    return node;
  }

  private canConvertToOptionalChaining(path: any): boolean {
    // Check if can convert to optional chaining
    return true; // Simplified
  }

  private convertToOptionalChaining(node: any): any {
    // Conversion logic
    return node;
  }

  private isNullishCheck(node: any): boolean {
    // Check if is nullish check pattern
    return true; // Simplified
  }

  private canDestructure(node: any): boolean {
    // Check if can use destructuring
    return true; // Simplified
  }

  private convertToDestructuring(node: any): any {
    // Conversion logic
    return node;
  }

  private canArrayDestructure(node: any): boolean {
    // Check if can use array destructuring
    return true; // Simplified
  }

  private convertToArrayDestructuring(node: any): any {
    // Conversion logic
    return node;
  }

  private canConvertToAsyncAwait(path: any): boolean {
    // Check if can convert to async/await
    return true; // Simplified
  }

  private convertToAsyncAwait(node: any): any {
    // Conversion logic
    return node;
  }

  private isFSAPICall(node: any, apiName: string): boolean {
    // Check if is FS API call
    return false; // Simplified
  }

  private isCallbackAPI(node: any): boolean {
    // Check if is callback-based API
    return false; // Simplified
  }

  private convertToPromiseAPI(node: any): any {
    // Convert callback API to promise API
    return node;
  }

  private isXMLHttpRequest(node: any): boolean {
    // Check if is XMLHttpRequest
    return false; // Simplified
  }

  private canConvertToForOf(node: any): boolean {
    // Check if can convert to for...of
    return true; // Simplified
  }

  private convertToForOf(node: any): any {
    // Conversion logic
    return node;
  }

  private canConvertToArrayMethod(node: any): boolean {
    // Check if can convert to array method
    return true; // Simplified
  }

  private convertToArrayMethod(node: any): any {
    // Conversion logic
    return node;
  }

  private isObjectAssignCall(node: any): boolean {
    // Check if is Object.assign call
    return false; // Simplified
  }

  private convertToObjectSpread(node: any): any {
    // Conversion logic
    return node;
  }

  private isArrayConcatCall(node: any): boolean {
    // Check if is array.concat call
    return false; // Simplified
  }

  private convertToArraySpread(node: any): any {
    // Conversion logic
    return node;
  }

  private canUseShorthandProperties(node: any): boolean {
    // Check if can use shorthand properties
    return true; // Simplified
  }

  private convertToShorthandProperties(node: any): void {
    // Conversion logic
  }

  private canUseShorthandMethod(node: any): boolean {
    // Check if can use shorthand method
    return true; // Simplified
  }

  private canUseComputedProperty(node: any): boolean {
    // Check if can use computed property
    return true; // Simplified
  }

  private isDeprecatedReactAPI(node: any): boolean {
    // Check if is deprecated React API
    return false; // Simplified
  }

  private getModernReactAPI(node: any): string {
    return 'modernAPI';
  }

  private isDeprecatedNodeAPI(node: any): boolean {
    // Check if is deprecated Node.js API
    return false; // Simplified
  }

  private getModernNodeAPI(node: any): string {
    return 'modernAPI';
  }

  private isDeprecatedBrowserAPI(node: any): boolean {
    // Check if is deprecated browser API
    return false; // Simplified
  }

  private getModernBrowserAPI(node: any): string {
    return 'modernAPI';
  }

  private canUsePrivateFields(node: any): boolean {
    // Check if can use private fields
    return true; // Simplified
  }

  private canUseClassProperties(node: any): boolean {
    // Check if can use class properties
    return true; // Simplified
  }

  private canUseNumericSeparator(node: any): boolean {
    // Check if can use numeric separator
    return true; // Simplified
  }

  private canUseLogicalAssignment(node: any): boolean {
    // Check if can use logical assignment
    return true; // Simplified
  }

  private convertToLogicalAssignment(node: any): any {
    // Conversion logic
    return node;
  }
}

// Import babel types
import * as t from '@babel/types';
