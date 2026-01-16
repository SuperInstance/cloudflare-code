/**
 * AST Parser - Base abstract syntax tree parser
 */

// @ts-nocheck - AST parsing with unused parameters
import { Language } from '../types/index.js';

// ============================================================================
// AST Node Types
// ============================================================================

export interface ASTNode {
  type: string;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  range?: [number, number];
  [key: string]: any;
}

export interface ParseResult {
  ast: ASTNode | null;
  errors: ParseError[];
  language: Language;
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

// ============================================================================
// AST Parser
// ============================================================================

export abstract class ASTParser {
  abstract parse(content: string): Promise<ASTNode | null>;

  /**
   * Get node at specific line and column
   */
  getNodeAtLocation(ast: ASTNode | null, line: number, column: number): ASTNode | null {
    if (!ast) return null;

    let found: ASTNode | null = null;

    this.traverse(ast, (node) => {
      if (node.loc && node.loc.start.line <= line && node.loc.end.line >= line) {
        if (!found) {
          found = node;
        }
      }
    });

    return found;
  }

  /**
   * Get all nodes of specific type
   */
  getNodesByType(ast: ASTNode | null, type: string): ASTNode[] {
    if (!ast) return [];

    const nodes: ASTNode[] = [];

    this.traverse(ast, (node) => {
      if (node.type === type) {
        nodes.push(node);
      }
    });

    return nodes;
  }

  /**
   * Traverse AST with visitor function
   */
  traverse(ast: ASTNode | null, visitor: (node: ASTNode) => void): void {
    if (!ast) return;

    visitor(ast);

    for (const key in ast) {
      if (ast.hasOwnProperty(key)) {
        const child = ast[key];

        if (Array.isArray(child)) {
          child.forEach((item) => {
            if (item && typeof item === 'object' && item.type) {
              this.traverse(item, visitor);
            }
          });
        } else if (child && typeof child === 'object' && child.type) {
          this.traverse(child, visitor);
        }
      }
    }
  }

  /**
   * Get parent node
   */
  getParent(ast: ASTNode | null, node: ASTNode): ASTNode | null {
    if (!ast || ast === node) return null;

    let parent: ASTNode | null = null;

    this.traverse(ast, (current) => {
      if (parent) return; // Already found

      for (const key in current) {
        if (current.hasOwnProperty(key)) {
          const child = current[key];

          if (Array.isArray(child)) {
            if (child.includes(node)) {
              parent = current;
              return;
            }
            child.forEach((item) => {
              if (item === node) {
                parent = current;
              }
            });
          } else if (child === node) {
            parent = current;
          }
        }
      }
    });

    return parent;
  }

  /**
   * Get siblings of node
   */
  getSiblings(ast: ASTNode | null, node: ASTNode): ASTNode[] {
    const parent = this.getParent(ast, node);
    if (!parent) return [];

    const siblings: ASTNode[] = [];

    for (const key in parent) {
      if (parent.hasOwnProperty(key)) {
        const child = parent[key];

        if (Array.isArray(child)) {
          siblings.push(...child.filter((item) => item && item !== node && typeof item === 'object' && item.type));
        }
      }
    }

    return siblings;
  }

  /**
   * Get scope at location
   */
  getScopeAt(ast: ASTNode | null, line: number, column: number): ScopeInfo | null {
    const node = this.getNodeAtLocation(ast, line, column);
    if (!node) return null;

    return this.buildScope(node);
  }

  /**
   * Build scope information for node
   */
  private buildScope(node: ASTNode): ScopeInfo | null {
    const scope: ScopeInfo = {
      variables: [],
      functions: [],
      classes: [],
      imports: [],
    };

    this.traverse(node, (child) => {
      if (child.type === 'VariableDeclaration') {
        scope.variables.push(...child.declarations.map((d: any) => d.id.name));
      } else if (child.type === 'FunctionDeclaration' || child.type === 'FunctionExpression') {
        scope.functions.push(child.id?.name || '<anonymous>');
      } else if (child.type === 'ClassDeclaration') {
        scope.classes.push(child.id?.name || '<anonymous>');
      } else if (child.type === 'ImportDeclaration') {
        scope.imports.push(child.source.value);
      }
    });

    return scope;
  }

  /**
   * Extract comments from source
   */
  extractComments(content: string, language: Language): Comment[] {
    const comments: Comment[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Single-line comments
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
        comments.push({
          type: 'Line',
          value: trimmed.substring(trimmed.startsWith('//') ? 2 : 1).trim(),
          loc: {
            start: { line: i + 1, column: line.indexOf(trimmed[0]) },
            end: { line: i + 1, column: line.length },
          },
        });
      }

      // Multi-line comments (simplified)
      if (trimmed.startsWith('/*')) {
        const endIndex = i + lines.slice(i).findIndex((l) => l.includes('*/'));
        if (endIndex > i) {
          const value = lines
            .slice(i, endIndex + 1)
            .join('\n')
            .replace(/\/\*|\*\//g, '')
            .trim();

          comments.push({
            type: 'Block',
            value,
            loc: {
              start: { line: i + 1, column: line.indexOf('/*') },
              end: { line: endIndex + 1, column: lines[endIndex].indexOf('*/') + 2 },
            },
          });
        }
      }
    }

    return comments;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ScopeInfo {
  variables: string[];
  functions: string[];
  classes: string[];
  imports: string[];
}

export interface Comment {
  type: 'Line' | 'Block';
  value: string;
  loc: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

// ============================================================================
// AST Visitor
// ============================================================================

export class ASTVisitor {
  private visitors: Map<string, (node: ASTNode) => void> = new Map();

  /**
   * Register visitor for node type
   */
  visit(nodeType: string, visitor: (node: ASTNode) => void): void {
    this.visitors.set(nodeType, visitor);
  }

  /**
   * Visit AST
   */
  visitAST(ast: ASTNode | null, parser: ASTParser): void {
    if (!ast) return;

    parser.traverse(ast, (node) => {
      const visitor = this.visitors.get(node.type);
      if (visitor) {
        visitor(node);
      }
    });
  }

  /**
   * Clear all visitors
   */
  clear(): void {
    this.visitors.clear();
  }
}
