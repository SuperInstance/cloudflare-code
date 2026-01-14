/**
 * Type Inference Engine
 *
 * Infers types from code context and usage patterns.
 */

import { Logger } from '../utils/logger';

export interface InferredType {
  type: string;
  confidence: number;
  nullable: boolean;
  array: boolean;
}

export class TypeInferenceEngine {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('info');
  }

  /**
   * Infer type from node
   */
  inferType(node: any, path?: any): string {
    const t = require('@babel/types');

    // Handle literals
    if (t.isStringLiteral(node)) {
      return 'string';
    }

    if (t.isNumericLiteral(node)) {
      return 'number';
    }

    if (t.isBooleanLiteral(node)) {
      return 'boolean';
    }

    if (t.isNullLiteral(node)) {
      return 'null';
    }

    // Handle arrays
    if (t.isArrayExpression(node)) {
      const elementTypes = new Set<string>();
      node.elements.forEach((el: any) => {
        if (el) {
          elementTypes.add(this.inferType(el));
        }
      });

      if (elementTypes.size === 1) {
        return `Array<${Array.from(elementTypes)[0]}>`;
      }

      return 'Array<any>';
    }

    // Handle objects
    if (t.isObjectExpression(node)) {
      return 'object';
    }

    // Handle functions
    if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
      const params = node.params.map((p: any) => this.inferType(p));
      const returnType = this.inferReturnType(node);

      return `(${params.join(', ')}) => ${returnType}`;
    }

    // Handle identifiers
    if (t.isIdentifier(node)) {
      if (path) {
        const binding = path.scope.getBinding(node.name);
        if (binding && binding.path) {
          return this.inferTypeFromBinding(binding);
        }
      }
      return 'any';
    }

    return 'any';
  }

  /**
   * Add type annotations to AST
   */
  async addTypeAnnotations(ast: any, filePath: string): Promise<any> {
    const t = require('@babel/types');

    const traverse = require('@babel/traverse').default;

    traverse(ast, {
      // Add type annotations to function parameters
      FunctionDeclaration(path) {
        path.node.params.forEach((param: any, index: number) => {
          if (!param.typeAnnotation && t.isIdentifier(param)) {
            const inferredType = this.inferType(param, path);
            param.typeAnnotation = t.typeAnnotation(
              this.createTypeAnnotation(inferredType)
            );
          }
        });

        // Add return type
        if (!path.node.returnType) {
          const returnType = this.inferReturnType(path.node);
          path.node.returnType = t.typeAnnotation(
            this.createTypeAnnotation(returnType)
          );
        }
      },

      // Add type annotations to variable declarations
      VariableDeclarator(path) {
        if (!path.node.id.typeAnnotation && path.node.init) {
          const inferredType = this.inferType(path.node.init, path);
          path.node.id.typeAnnotation = t.typeAnnotation(
            this.createTypeAnnotation(inferredType)
          );
        }
      },

      // Add type annotations to class properties
      ClassProperty(path) {
        if (!path.node.typeAnnotation && path.node.value) {
          const inferredType = this.inferType(path.node.value, path);
          path.node.typeAnnotation = t.typeAnnotation(
            this.createTypeAnnotation(inferredType)
          );
        }
      }
    });

    return ast;
  }

  /**
   * Extract exported types from AST
   */
  extractExportedTypes(ast: any, filePath: string): any[] {
    const types: any[] = [];
    const t = require('@babel/types');

    const traverse = require('@babel/traverse').default;

    traverse(ast, {
      TSInterfaceDeclaration(path) {
        if (this.isExported(path.node)) {
          types.push({
            kind: 'interface',
            name: path.node.id.name,
            node: path.node
          });
        }
      },

      TSTypeAliasDeclaration(path) {
        if (this.isExported(path.node)) {
          types.push({
            kind: 'type',
            name: path.node.id.name,
            node: path.node
          });
        }
      },

      ClassDeclaration(path) {
        if (this.isExported(path.node)) {
          types.push({
            kind: 'class',
            name: path.node.id.name,
            node: path.node
          });
        }
      },

      FunctionDeclaration(path) {
        if (this.isExported(path.node)) {
          types.push({
            kind: 'function',
            name: path.node.id.name,
            node: path.node
          });
        }
      }
    });

    return types;
  }

  /**
   * Infer type from binding
   */
  private inferTypeFromBinding(binding: any): string {
    const path = binding.path;

    if (path.isVariableDeclarator() && path.node.init) {
      return this.inferType(path.node.init, path);
    }

    if (path.isFunctionDeclaration() || path.isFunctionExpression()) {
      return 'Function';
    }

    if (path.isClassDeclaration()) {
      return path.node.id.name;
    }

    return 'any';
  }

  /**
   * Infer return type of function
   */
  private inferReturnType(node: any): string {
    const t = require('@babel/types');

    // Look for return statements
    const returnTypes: string[] = [];

    const traverse = require('@babel/traverse').default;
    traverse(node, {
      ReturnStatement(path) {
        if (path.node.argument) {
          returnTypes.push(this.inferType(path.node.argument));
        } else {
          returnTypes.push('void');
        }
      }
    });

    if (returnTypes.length === 0) {
      return 'void';
    }

    // If all return types are the same, use that type
    const uniqueTypes = new Set(returnTypes);
    if (uniqueTypes.size === 1) {
      return Array.from(uniqueTypes)[0];
    }

    // Otherwise, use union type
    return returnTypes.join(' | ');
  }

  /**
   * Create type annotation node
   */
  private createTypeAnnotation(typeString: string): any {
    const t = require('@babel/types');

    switch (typeString) {
      case 'string':
        return t.tsStringKeyword();
      case 'number':
        return t.tsNumberKeyword();
      case 'boolean':
        return t.tsBooleanKeyword();
      case 'void':
        return t.tsVoidKeyword();
      case 'any':
        return t.tsAnyKeyword();
      case 'unknown':
        return t.tsUnknownKeyword();
      case 'null':
        return t.tsNullKeyword();
      case 'undefined':
        return t.tsUndefinedKeyword();
      case 'object':
        return t.tsObjectKeyword();
      case 'Function':
        return t.tsFunctionType(
          [],
          t.tsTypeAnnotation(t.tsAnyKeyword())
        );
      default:
        // Handle complex types (arrays, unions, etc.)
        if (typeString.startsWith('Array<')) {
          const elementType = typeString.slice(6, -1);
          return t.tsArrayType(this.createTypeAnnotation(elementType));
        }

        if (typeString.includes('|')) {
          const types = typeString.split('|').map(t => t.trim());
          return t.tsUnionType(
            types.map(t => this.createTypeAnnotation(t))
          );
        }

        // Default to type reference
        return t.tsTypeReference(t.identifier(typeString));
    }
  }

  /**
   * Check if node is exported
   */
  private isExported(node: any): boolean {
    const parent = node.parent;

    if (!parent) {
      return false;
    }

    const t = require('@babel/types');

    return t.isExportNamedDeclaration(parent) ||
           t.isExportDefaultDeclaration(parent);
  }
}
