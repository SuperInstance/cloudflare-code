/**
 * AST Transformer
 *
 * Core AST transformation engine for code manipulation.
 * Supports parsing, traversal, manipulation, and generation.
 */

import * as t from '@babel/types';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { parse } from '../parsers/parser';
import { CommentPreserver } from '../utils/comment-preserver';
import { Formatter } from '../utils/formatter';
import { Logger } from '../utils/logger';

export interface TransformOptions {
  retainComments?: boolean;
  retainFormatting?: boolean;
  sourceMaps?: boolean;
  preserveOriginal?: boolean;
}

export interface ASTTransformResult {
  code: string;
  map?: any;
  ast: t.Node;
}

export class ASTTransformer {
  private commentPreserver: CommentPreserver;
  private formatter: Formatter;
  private logger: Logger;

  constructor(private options: TransformOptions = {}) {
    this.commentPreserver = new CommentPreserver();
    this.formatter = new Formatter();
    this.logger = new Logger('info');
  }

  /**
   * Parse code to AST
   */
  async parse(code: string, filePath: string, language: string = 'typescript'): Promise<t.Node> {
    return parse(filePath, code);
  }

  /**
   * Generate code from AST
   */
  generate(ast: t.Node, options: any = {}): ASTTransformResult {
    const defaultOptions = {
      retainLines: this.options.retainFormatting ?? true,
      retainFunctionParens: true,
      comments: this.options.retainComments ?? true,
      compact: false,
      concise: false,
      indent: {
        adjustMultilineComment: true,
        style: '  '
      },
      sourceMaps: this.options.sourceMaps ?? false,
      ...options
    };

    const result = generate(ast, defaultOptions);

    return {
      code: result.code,
      map: result.map,
      ast
    };
  }

  /**
   * Traverse AST with visitors
   */
  traverse(ast: t.Node, visitors: traverse.Visitors): void {
    traverse(ast, visitors);
  }

  /**
   * Extract method from code selection
   */
  extractMethod(
    ast: t.Node,
    options: {
      startLine: number;
      endLine: number;
      name: string;
      parameters: string[];
      capturedVariables: string[];
      returnType?: string;
      visibility?: 'public' | 'private' | 'protected';
    }
  ): t.Node {
    let extractedNode: t.BlockStatement | null = null;
    let targetFunction: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression | null = null;

    // Find the extracted code block
    this.traverse(ast, {
      Statement(path) {
        if (this.isInRange(path.node, options.startLine, options.endLine)) {
          extractedNode = path.node as any;
        }
      }
    });

    if (!extractedNode) {
      throw new Error('Could not find code block to extract');
    }

    // Create the new method
    const newMethod = t.functionDeclaration(
      t.identifier(options.name),
      options.parameters.map(p => t.identifier(p)),
      t.blockStatement(extractedNode.body ? [extractedNode] : []),
      false,
      false
    );

    // Replace the extracted code with a call to the new method
    let replacementMade = false;
    this.traverse(ast, {
      BlockStatement(path) {
        if (!replacementMade && this.isInRange(path.node, options.startLine, options.endLine)) {
          const callExpression = t.callExpression(
            t.identifier(options.name),
            options.parameters.map(p => t.identifier(p))
          );

          const statements = path.node.body.filter(
            stmt => !this.isInRange(stmt, options.startLine, options.endLine)
          );

          statements.push(t.expressionStatement(callExpression));
          path.node.body = statements;
          replacementMade = true;
        }
      }
    });

    // Insert the new method before the containing function
    this.traverse(ast, {
      Program(path) {
        path.node.body.unshift(newMethod);
      }
    });

    return ast;
  }

  /**
   * Inline variable
   */
  inlineVariable(
    ast: t.Node,
    options: {
      variableName: string;
      references: any[];
      declaration: any;
      initializer: any;
      inlineAll: boolean;
      preserveComments: boolean;
    }
  ): t.Node {
    const { variableName, initializer, preserveComments } = options;

    // Find all references and replace with initializer
    this.traverse(ast, {
      Identifier(path) {
        if (path.isReferencedIdentifier() && path.node.name === variableName) {
          // Clone the initializer to avoid reference issues
          const replacement = t.cloneNode(initializer, false);
          path.replaceWith(replacement);
        }
      }
    });

    // Remove the variable declaration
    this.traverse(ast, {
      VariableDeclaration(path) {
        const declarator = path.node.declarations.find(
          (d: any) => (d.id as t.Identifier).name === variableName
        );

        if (declarator) {
          if (path.parent.type === 'Program' || path.parent.type === 'BlockStatement') {
            // Remove only the specific declarator
            path.node.declarations = path.node.declarations.filter(
              (d: any) => (d.id as t.Identifier).name !== variableName
            );

            // Remove the entire declaration if no declarators left
            if (path.node.declarations.length === 0) {
              path.remove();
            }
          }
        }
      }
    });

    return ast;
  }

  /**
   * Inline function
   */
  inlineFunction(
    ast: t.Node,
    options: {
      functionName: string;
      references: any[];
      declaration: any;
      inlineAll: boolean;
      preserveComments: boolean;
    }
  ): t.Node {
    const { functionName, declaration, preserveComments } = options;
    const functionBody = (declaration.body as t.BlockStatement).body;

    // Inline function calls
    this.traverse(ast, {
      CallExpression(path) {
        if ((path.node.callee as t.Identifier).name === functionName) {
          const args = path.node.arguments;

          // Create parameter mappings
          const params = declaration.params.map((p: any) => (p as t.Identifier).name);
          const paramMap = new Map<string, any>();

          params.forEach((param, i) => {
            paramMap.set(param, args[i] || t.identifier('undefined'));
          });

          // Clone and inline the function body
          const inlinedBody = functionBody.map(stmt => {
            const cloned = t.cloneNode(stmt, true);

            // Replace parameters with arguments
            this.traverse(cloned, {
              Identifier(path) {
                if (path.isReferencedIdentifier() && paramMap.has(path.node.name)) {
                  path.replaceWith(t.cloneNode(paramMap.get(path.node.name)!));
                }
              }
            });

            return cloned;
          });

          // Replace the call with the inlined body
          if (path.parent.type === 'ExpressionStatement') {
            path.parentPath.replaceWithMultiple(inlinedBody);
          } else {
            // For non-expression statement contexts, wrap in IIFE or handle differently
            const lastStmt = inlinedBody[inlinedBody.length - 1];
            if (t.isReturnStatement(lastStmt)) {
              path.replaceWith(lastStmt.argument || t.identifier('undefined'));
            } else {
              path.replaceWith(t.sequenceExpression(inlinedBody as any[]));
            }
          }
        }
      }
    });

    // Remove the function declaration
    this.traverse(ast, {
      FunctionDeclaration(path) {
        if ((path.node.id as t.Identifier).name === functionName) {
          path.remove();
        }
      }
    });

    return ast;
  }

  /**
   * Rename symbol
   */
  renameSymbol(
    ast: t.Node,
    options: {
      oldName: string;
      newName: string;
      references: any[];
      renameInComments: boolean;
      renameInStrings: boolean;
    }
  ): t.Node {
    const { oldName, newName } = options;

    // Rename all identifiers
    this.traverse(ast, {
      Identifier(path) {
        if (path.node.name === oldName) {
          path.node.name = newName;
        }
      }
    });

    // Optionally rename in comments
    if (options.renameInComments) {
      this.traverse(ast, {
        enter(path) {
          if (path.node.leadingComments) {
            path.node.leadingComments.forEach((comment: any) => {
              comment.value = comment.value.replace(
                new RegExp(`\\b${oldName}\\b`, 'g'),
                newName
              );
            });
          }
          if (path.node.trailingComments) {
            path.node.trailingComments.forEach((comment: any) => {
              comment.value = comment.value.replace(
                new RegExp(`\\b${oldName}\\b`, 'g'),
                newName
              );
            });
          }
        }
      });
    }

    return ast;
  }

  /**
   * Update imports after moving a file
   */
  updateImportsAfterMove(ast: t.Node, options: { oldPath: string; newPath: string }): t.Node {
    // This would update the imports within the moved file itself
    return ast;
  }

  /**
   * Update imports for files that import the moved file
   */
  updateImportsForMovedFile(ast: t.Node, options: { oldPath: string; newPath: string }): t.Node {
    const oldPathParts = options.oldPath.split('/');
    const newPathParts = options.newPath.split('/');

    this.traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value as string;
        if (source.startsWith('.') || source.startsWith('@')) {
          // Calculate relative path adjustment
          const updatedSource = this.recalculateImportPath(source, oldPathParts, newPathParts);
          path.node.source.value = updatedSource;
        }
      }
    });

    return ast;
  }

  /**
   * Change function signature
   */
  changeSignature(
    ast: t.Node,
    options: {
      functionName: string;
      declaration: any;
      changes: {
        parameters?: {
          add?: Array<{ name: string; type?: string; defaultValue?: string }>;
          remove?: string[];
          rename?: Array<{ old: string; new: string }>;
          reorder?: string[];
        };
        returnType?: string;
        async?: boolean;
      };
      callSites: any[];
      updateCallSites: boolean;
      preserveDefaults: boolean;
    }
  ): t.Node {
    const { functionName, changes, callSites, updateCallSites } = options;

    // Update the function declaration
    this.traverse(ast, {
      FunctionDeclaration(path) {
        if ((path.node.id as t.Identifier).name === functionName) {
          // Update parameters
          if (changes.parameters) {
            let params = path.node.params;

            // Add parameters
            if (changes.parameters.add) {
              changes.parameters.add.forEach(param => {
                const newParam = t.identifier(param.name);
                if (param.defaultValue) {
                  params.push(
                    t.assignmentPattern(
                      newParam,
                      this.parseExpression(param.defaultValue)
                    )
                  );
                } else {
                  params.push(newParam);
                }
              });
            }

            // Remove parameters
            if (changes.parameters.remove) {
              params = params.filter(
                (p: any) => !changes.parameters.remove!.includes((p as t.Identifier).name)
              );
            }

            // Rename parameters
            if (changes.parameters.rename) {
              params = params.map((p: any) => {
                const rename = changes.parameters.rename!.find(
                  r => r.old === (p as t.Identifier).name
                );
                if (rename) {
                  return t.identifier(rename.new);
                }
                return p;
              });
            }

            // Reorder parameters
            if (changes.parameters.reorder) {
              const paramMap = new Map(params.map((p: any) => [(p as t.Identifier).name, p]));
              params = changes.parameters.reorder.map(name => paramMap.get(name)!);
            }

            path.node.params = params;
          }

          // Update return type
          if (changes.returnType) {
            path.node.returnType = t.typeAnnotation(
              t.genericTypeAnnotation(t.identifier(changes.returnType))
            );
          }

          // Update async
          if (changes.async !== undefined) {
            path.node.async = changes.async;
          }
        }
      }
    });

    // Update call sites if requested
    if (updateCallSites) {
      this.traverse(ast, {
        CallExpression(path) {
          if ((path.node.callee as t.Identifier).name === functionName) {
            if (changes.parameters) {
              let args = path.node.arguments;

              // Add default arguments for new parameters
              if (changes.parameters.add) {
                changes.parameters.add.forEach(param => {
                  if (param.defaultValue) {
                    args.push(this.parseExpression(param.defaultValue));
                  } else {
                    args.push(t.identifier('undefined'));
                  }
                });
              }

              // Remove arguments for removed parameters
              if (changes.parameters.remove) {
                const paramNames = path.node.params.map((p: any) => (p as t.Identifier).name);
                args = args.filter((_, i) => {
                  if (i < paramNames.length) {
                    return !changes.parameters.remove!.includes(paramNames[i]);
                  }
                  return true;
                });
              }

              // Handle renamed parameters (object literals)
              if (changes.parameters.rename) {
                if (args.length === 1 && t.isObjectExpression(args[0])) {
                  const objExpr = args[0] as t.ObjectExpression;
                  objExpr.properties.forEach((prop: any) => {
                    const rename = changes.parameters.rename!.find(
                      r => r.old === (prop.key as t.Identifier).name
                    );
                    if (rename) {
                      prop.key = t.identifier(rename.new);
                    }
                  });
                }
              }

              // Reorder arguments
              if (changes.parameters.reorder && changes.parameters.reorder.length > 0) {
                if (args.length === 1 && t.isObjectExpression(args[0])) {
                  // Object literal - reorder properties
                  const objExpr = args[0] as t.ObjectExpression;
                  const propMap = new Map(
                    objExpr.properties.map((p: any) => [(p.key as t.Identifier).name, p])
                  );
                  objExpr.properties = changes.parameters.reorder
                    .map(name => propMap.get(name))
                    .filter(Boolean) as any[];
                } else {
                  // Positional arguments - reorder
                  const argArray = [...args];
                  args = changes.parameters.reorder.map((_, i) => argArray[i] || t.identifier('undefined'));
                }
              }

              path.node.arguments = args;
            }
          }
        }
      });
    }

    return ast;
  }

  /**
   * Extract interface from class
   */
  extractInterface(
    ast: t.Node,
    options: {
      className: string;
      interfaceName: string;
      members: {
        methods: any[];
        properties: any[];
      };
      includeJSDoc: boolean;
    }
  ): t.Node {
    const { className, interfaceName, members, includeJSDoc } = options;

    // Create interface declaration
    const interfaceDecl = t.tsInterfaceDeclaration(
      t.identifier(interfaceName),
      undefined,
      undefined,
      t.tsInterfaceBody([
        ...members.properties.map((prop: any) => {
          return t.tsPropertySignature(
            t.identifier(prop.name),
            prop.type
              ? t.tsTypeAnnotation(
                  t.tsTypeAnnotation(t.identifier(prop.type))
                )
              : undefined
          );
        }),
        ...members.methods.map((method: any) => {
          return t.tsMethodSignature(
            t.identifier(method.name),
            method.parameters.map((p: string) =>
              t.identifier(p)
            ),
            method.returnType
              ? t.tsTypeAnnotation(t.identifier(method.returnType))
              : undefined
          );
        })
      ])
    );

    // Insert interface before class
    let inserted = false;
    this.traverse(ast, {
      ClassDeclaration(path) {
        if ((path.node.id as t.Identifier).name === className && !inserted) {
          path.insertBefore(interfaceDecl);
          inserted = true;
        }
      }
    });

    // Make class implement the interface
    this.traverse(ast, {
      ClassDeclaration(path) {
        if ((path.node.id as t.Identifier).name === className) {
          if (!path.node.implements) {
            path.node.implements = [];
          }
          path.node.implements.push(
            t.tsExpressionWithTypeArguments(t.identifier(interfaceName))
          );
        }
      }
    });

    return ast;
  }

  /**
   * Introduce parameter to function
   */
  introduceParameter(
    ast: t.Node,
    options: {
      functionName: string;
      declaration: any;
      parameter: {
        name: string;
        type?: string;
        defaultValue?: string;
        position?: number;
      };
      callSites: any[];
      updateCallSites: boolean;
    }
  ): t.Node {
    const { functionName, parameter, callSites, updateCallSites } = options;

    // Add parameter to function declaration
    this.traverse(ast, {
      FunctionDeclaration(path) {
        if ((path.node.id as t.Identifier).name === functionName) {
          const newParam = t.identifier(parameter.name);

          if (parameter.defaultValue) {
            const paramWithDefault = t.assignmentPattern(
              newParam,
              this.parseExpression(parameter.defaultValue)
            );

            if (parameter.position !== undefined) {
              path.node.params.splice(parameter.position, 0, paramWithDefault);
            } else {
              path.node.params.push(paramWithDefault);
            }
          } else {
            if (parameter.position !== undefined) {
              path.node.params.splice(parameter.position, 0, newParam);
            } else {
              path.node.params.push(newParam);
            }
          }

          // Add type annotation if specified
          if (parameter.type) {
            const lastParam = path.node.params[path.node.params.length - 1] as t.Identifier;
            lastParam.typeAnnotation = t.typeAnnotation(
              t.genericTypeAnnotation(t.identifier(parameter.type))
            );
          }
        }
      }
    });

    // Update call sites if requested
    if (updateCallSites) {
      this.traverse(ast, {
        CallExpression(path) {
          if ((path.node.callee as t.Identifier).name === functionName) {
            const arg = parameter.defaultValue
              ? this.parseExpression(parameter.defaultValue)
              : t.identifier('undefined');

            if (parameter.position !== undefined) {
              path.node.arguments.splice(parameter.position, 0, arg);
            } else {
              path.node.arguments.push(arg);
            }
          }
        }
      });
    }

    return ast;
  }

  /**
   * Transform code with custom visitor
   */
  transform(code: string, visitors: traverse.Visitors, language: string = 'typescript'): string {
    const ast = this.parse(code, 'temp', language);
    this.traverse(ast, visitors);
    const result = this.generate(ast);
    return result.code;
  }

  /**
   * Clone AST node
   */
  cloneNode<T extends t.Node>(node: T, deep?: boolean): T {
    return t.cloneNode(node, deep);
  }

  /**
   * Check if node is in line range
   */
  private isInRange(node: any, startLine: number, endLine: number): boolean {
    if (!node.loc) return false;
    return node.loc.start.line >= startLine && node.loc.end.line <= endLine;
  }

  /**
   * Parse expression from string
   */
  private parseExpression(expr: string): t.Expression {
    try {
      // Use a simple parser for basic expressions
      return t.identifier(expr);
    } catch {
      return t.identifier('undefined');
    }
  }

  /**
   * Recalculate import path after moving file
   */
  private recalculateImportPath(
    importPath: string,
    oldPathParts: string[],
    newPathParts: string[]
  ): string {
    // This is a simplified version - real implementation would calculate proper relative paths
    return importPath;
  }
}
