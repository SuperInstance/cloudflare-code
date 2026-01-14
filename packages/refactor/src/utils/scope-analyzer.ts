/**
 * Scope Analyzer
 *
 * Analyzes variable scopes, references, and declarations.
 */

import { Logger } from './logger';

export interface VariableInfo {
  name: string;
  type: string;
  isReadOnly: boolean;
  isUsed: boolean;
  scope: string;
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType: string;
  isAsync: boolean;
  isGenerator: boolean;
  scope: string;
}

export class ScopeAnalyzer {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('info');
  }

  /**
   * Find the containing function for a given line range
   */
  findContainingFunction(ast: any, startLine: number, endLine: number): any {
    const t = require('@babel/types');
    let containingFunction: any = null;

    const traverse = require('@babel/traverse').default;
    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.loc) {
          if (path.node.loc.start.line <= startLine && path.node.loc.end.line >= endLine) {
            containingFunction = path.node;
          }
        }
      },
      FunctionExpression(path) {
        if (path.node.loc) {
          if (path.node.loc.start.line <= startLine && path.node.loc.end.line >= endLine) {
            containingFunction = path.node;
          }
        }
      },
      ArrowFunctionExpression(path) {
        if (path.node.loc) {
          if (path.node.loc.start.line <= startLine && path.node.loc.end.line >= endLine) {
            containingFunction = path.node;
          }
        }
      }
    });

    return containingFunction;
  }

  /**
   * Extract variables that need to be parameters
   */
  extractVariables(
    ast: any,
    startLine: number,
    endLine: number,
    containingFunction: any
  ): { required: string[]; captured: string[] } {
    const required: string[] = [];
    const captured: string[] = [];

    const traverse = require('@babel/traverse').default;
    const usedVariables = new Set<string>();
    const declaredVariables = new Set<string>();

    // Find variables used in the extracted range
    traverse(ast, {
      Identifier(path) {
        if (
          path.node.loc &&
          path.node.loc.start.line >= startLine &&
          path.node.loc.end.line <= endLine &&
          path.isReferencedIdentifier()
        ) {
          usedVariables.add(path.node.name);
        }
      }
    });

    // Find variables declared in containing function
    if (containingFunction) {
      traverse(containingFunction, {
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id)) {
            declaredVariables.add(path.node.id.name);
          }
        }
      });
    }

    // Determine which variables should be parameters vs captured
    usedVariables.forEach(variable => {
      if (!declaredVariables.has(variable)) {
        required.push(variable);
      } else {
        captured.push(variable);
      }
    });

    return { required, captured };
  }

  /**
   * Find variable declaration
   */
  findVariableDeclaration(ast: any, variableName: string): any {
    const t = require('@babel/types');
    let declaration: any = null;

    const traverse = require('@babel/traverse').default;
    traverse(ast, {
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === variableName) {
          declaration = path.node;
        }
      }
    });

    return declaration;
  }

  /**
   * Find function declaration
   */
  findFunctionDeclaration(ast: any, functionName: string): any {
    const t = require('@babel/types');
    let declaration: any = null;

    const traverse = require('@babel/traverse').default;
    traverse(ast, {
      FunctionDeclaration(path) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === functionName) {
          declaration = path.node;
        }
      },
      FunctionExpression(path) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === functionName) {
          declaration = path.node;
        }
      }
    });

    return declaration;
  }

  /**
   * Find class declaration
   */
  findClassDeclaration(ast: any, className: string): any {
    const t = require('@babel/types');
    let declaration: any = null;

    const traverse = require('@babel/traverse').default;
    traverse(ast, {
      ClassDeclaration(path) {
        if (t.isIdentifier(path.node.id) && path.node.id.name === className) {
          declaration = path.node;
        }
      }
    });

    return declaration;
  }

  /**
   * Get initializer value from variable declaration
   */
  getInitializerValue(declaration: any): any {
    if (!declaration.init) {
      return null;
    }

    return declaration.init;
  }

  /**
   * Analyze class members
   */
  analyzeClassMembers(classDecl: any, visibility: 'public' | 'all' = 'public'): {
    methods: any[];
    properties: any[];
  } {
    const methods: any[] = [];
    const properties: any[] = [];

    const t = require('@babel/types');

    classDecl.body.body.forEach((member: any) => {
      if (t.isClassMethod(member)) {
        if (visibility === 'all' || member.kind === 'constructor' || member.kind === 'method') {
          methods.push({
            name: t.isIdentifier(member.key) ? member.key.name : '(computed)',
            static: member.static,
            async: member.async,
            generator: member.generator,
            params: member.params.map((p: any) => (t.isIdentifier(p) ? p.name : '?'))
          });
        }
      } else if (t.isClassProperty(member)) {
        if (visibility === 'all' || !member.accessibility || member.accessibility === 'public') {
          properties.push({
            name: t.isIdentifier(member.key) ? member.key.name : '(computed)',
            static: member.static,
            readonly: member.readonly,
            typeAnnotation: member.typeAnnotation
          });
        }
      }
    });

    return { methods, properties };
  }

  /**
   * Infer parameter value from call site
   */
  inferParameterValue(callSite: any, parameterName: string): string | undefined {
    // Try to infer a reasonable default value from the context
    return undefined;
  }
}
