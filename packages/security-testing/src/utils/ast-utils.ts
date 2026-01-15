/**
 * AST utility functions for static code analysis
 * Provides AST traversal, pattern matching, and taint analysis
 */

import * as acorn from 'acorn';
import { simple as simpleWalk, ancestor as ancestorWalk } from 'acorn-walk';
import { Severity, VulnerabilityType, Finding } from '../types';

export interface ASTNode {
  type: string;
  start: number;
  end: number;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  [key: string]: any;
}

export interface PatternMatch {
  node: ASTNode;
  type: VulnerabilityType;
  severity: Severity;
  confidence: number;
  message: string;
  remediation: string;
  cwe?: number;
  owasp?: string;
}

export interface TaintSource {
  type: string;
  name: string;
  description: string;
  severity: Severity;
}

export interface TaintSink {
  type: string;
  name: string;
  description: string;
  severity: Severity;
}

export interface TaintFlow {
  source: TaintSource;
  sink: TaintSink;
  path: ASTNode[];
  sanitized: boolean;
}

export class ASTUtils {
  /**
   * Parse code to AST
   */
  static parse(code: string, filePath: string): ASTNode {
    try {
      return acorn.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ranges: true,
        allowHashBang: true,
        allowReserved: true,
      }) as ASTNode;
    } catch (error) {
      throw new Error(`Failed to parse ${filePath}: ${error}`);
    }
  }

  /**
   * Walk AST with visitor
   */
  static walk(ast: ASTNode, visitor: Record<string, (node: ASTNode) => void>): void {
    simpleWalk(ast, visitor);
  }

  /**
   * Walk AST with ancestors
   */
  static walkWithAncestors(
    ast: ASTNode,
    visitor: Record<string, (node: ASTNode, ancestors: ASTNode[]) => void>
  ): void {
    ancestorWalk(ast, visitor);
  }

  /**
   * Find all nodes of a specific type
   */
  static findNodes(ast: ASTNode, nodeType: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    simpleWalk(ast, {
      [nodeType]: (node: ASTNode) => {
        nodes.push(node);
      },
    });
    return nodes;
  }

  /**
   * Find nodes by pattern
   */
  static findByPattern(ast: ASTNode, predicate: (node: ASTNode) => boolean): ASTNode[] {
    const nodes: ASTNode[] = [];
    simpleWalk(ast, {
      _(node: ASTNode) {
        if (predicate(node)) {
          nodes.push(node);
        }
      },
    });
    return nodes;
  }

  /**
   * Check if node is a function call
   */
  static isFunctionCall(node: ASTNode): boolean {
    return (
      node.type === 'CallExpression' ||
      node.type === 'NewExpression' ||
      node.type === 'OptionalCallExpression'
    );
  }

  /**
   * Get function name from call expression
   */
  static getFunctionName(node: ASTNode): string | null {
    if (!this.isFunctionCall(node)) {
      return null;
    }

    const callee = node.callee;

    // Direct function call: foo()
    if (callee.type === 'Identifier') {
      return callee.name;
    }

    // Method call: obj.foo()
    if (callee.type === 'MemberExpression') {
      if (callee.property.type === 'Identifier') {
        return callee.property.name;
      }
    }

    return null;
  }

  /**
   * Get object name from member expression
   */
  static getObjectName(node: ASTNode): string | null {
    if (node.type === 'MemberExpression') {
      if (node.object.type === 'Identifier') {
        return node.object.name;
      }
    }
    return null;
  }

  /**
   * Get full call chain (e.g., "document.cookie")
   */
  static getCallChain(node: ASTNode): string {
    const parts: string[] = [];

    let current = node;
    while (current) {
      if (current.type === 'Identifier') {
        parts.unshift(current.name);
        break;
      } else if (current.type === 'MemberExpression') {
        if (current.property.type === 'Identifier') {
          parts.unshift(current.property.name);
        }
        current = current.object;
      } else {
        break;
      }
    }

    return parts.join('.');
  }

  /**
   * Check if node is a literal value
   */
  static isLiteral(node: ASTNode): boolean {
    return node.type === 'Literal';
  }

  /**
   * Get literal value
   */
  static getLiteralValue(node: ASTNode): any {
    if (this.isLiteral(node)) {
      return node.value;
    }
    return null;
  }

  /**
   * Check if node is a variable declaration
   */
  static isVariableDeclaration(node: ASTNode): boolean {
    return node.type === 'VariableDeclaration';
  }

  /**
   * Get variable declarations
   */
  static getVariableDeclarations(ast: ASTNode): Map<string, ASTNode> {
    const variables = new Map<string, ASTNode>();

    simpleWalk(ast, {
      VariableDeclaration(node: ASTNode) {
        for (const declarator of node.declarations) {
          if (declarator.id.type === 'Identifier') {
            variables.set(declarator.id.name, declarator);
          }
        }
      },
    });

    return variables;
  }

  /**
   * Get function declarations
   */
  static getFunctionDeclarations(ast: ASTNode): Map<string, ASTNode> {
    const functions = new Map<string, ASTNode>();

    simpleWalk(ast, {
      FunctionDeclaration(node: ASTNode) {
        if (node.id) {
          functions.set(node.id.name, node);
        }
      },
    });

    return functions;
  }

  /**
   * Find return statements
   */
  static findReturnStatements(ast: ASTNode): ASTNode[] {
    return this.findNodes(ast, 'ReturnStatement');
  }

  /**
   * Find all string literals
   */
  static findStringLiterals(ast: ASTNode): string[] {
    const literals: string[] = [];

    simpleWalk(ast, {
      Literal(node: ASTNode) {
        if (typeof node.value === 'string') {
          literals.push(node.value);
        }
      },
    });

    return literals;
  }

  /**
   * Find template literals
   */
  static findTemplateLiterals(ast: ASTNode): ASTNode[] {
    return this.findNodes(ast, 'TemplateLiteral');
  }

  /**
   * Check if code contains eval
   */
  static findEvalUsage(ast: ASTNode): PatternMatch[] {
    const matches: PatternMatch[] = [];

    simpleWalk(ast, {
      CallExpression(node: ASTNode) {
        const funcName = this.getFunctionName(node);
        if (funcName === 'eval') {
          matches.push({
            node,
            type: VulnerabilityType.COMMAND_INJECTION,
            severity: Severity.HIGH,
            confidence: 90,
            message: 'Use of eval() can lead to code injection vulnerabilities',
            remediation:
              'Avoid using eval(). Use alternative approaches like JSON.parse() for JSON or function constructors for dynamic code.',
            cwe: 95,
            owasp: 'A03:2021-Injection',
          });
        }
      }.bind(this)
    });

    return matches;
  }

  /**
   * Check for dangerous HTML manipulation
   */
  static findDangerousHTML(ast: ASTNode): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const dangerousFunctions = [
      'innerHTML',
      'outerHTML',
      'insertAdjacentHTML',
      'document.write',
      'document.writeln',
    ];

    simpleWalk(ast, {
      AssignmentExpression(node: ASTNode) {
        const chain = this.getCallChain(node.left);
        if (dangerousFunctions.some((fn) => chain.includes(fn))) {
          matches.push({
            node,
            type: VulnerabilityType.XSS,
            severity: Severity.HIGH,
            confidence: 85,
            message: `Direct HTML manipulation using ${chain} can lead to XSS`,
            remediation:
              'Use textContent or DOMPurify for sanitization. Avoid direct HTML manipulation with user input.',
            cwe: 79,
            owasp: 'A03:2021-Injection',
          });
        }
      }.bind(this),

      CallExpression(node: ASTNode) {
        const chain = this.getCallChain(node.callee);
        if (dangerousFunctions.some((fn) => chain.includes(fn))) {
          matches.push({
            node,
            type: VulnerabilityType.XSS,
            severity: Severity.HIGH,
            confidence: 85,
            message: `Direct HTML manipulation using ${chain} can lead to XSS`,
            remediation:
              'Use textContent or DOMPurify for sanitization. Avoid direct HTML manipulation with user input.',
            cwe: 79,
            owasp: 'A03:2021-Injection',
          });
        }
      }.bind(this)
    });

    return matches;
  }

  /**
   * Find SQL injection patterns
   */
  static findSQLInjection(ast: ASTNode): PatternMatch[] {
    const matches: PatternMatch[] = [];

    simpleWalk(ast, {
      CallExpression(node: ASTNode) {
        const args = node.arguments || [];

        // Check for direct query execution with string concatenation
        if (args.length > 0) {
          const firstArg = args[0];

          // Check for string concatenation in query
          if (
            firstArg.type === 'BinaryExpression' &&
            firstArg.operator === '+'
          ) {
            const funcName = this.getFunctionName(node);
            const sqlFunctions = ['query', 'execute', 'all', 'get', 'run'];

            if (funcName && sqlFunctions.some((fn) => funcName.includes(fn))) {
              matches.push({
                node,
                type: VulnerabilityType.SQL_INJECTION,
                severity: Severity.CRITICAL,
                confidence: 75,
                message: 'Possible SQL injection through string concatenation',
                remediation:
                  'Use parameterized queries or prepared statements. Never concatenate user input directly into SQL queries.',
                cwe: 89,
                owasp: 'A03:2021-Injection',
              });
            }
          }
        }
      }.bind(this)
    });

    return matches;
  }

  /**
   * Find hardcoded secrets
   */
  static findHardcodedSecrets(ast: ASTNode): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const secretPatterns = [
      { pattern: /password\s*[:=]\s*['"]\w+['"]/i, severity: Severity.HIGH },
      { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{10,}['"]/i, severity: Severity.HIGH },
      { pattern: /secret\s*[:=]\s*['"][^'"]{10,}['"]/i, severity: Severity.HIGH },
      { pattern: /token\s*[:=]\s*['"][^'"]{20,}['"]/i, severity: Severity.MEDIUM },
      {
        pattern: /aws[_-]?(access[_-]?key[_-]?id|secret[_-]?access[_-]?key)\s*[:=]\s*['"][^'"]+['"]/i,
        severity: Severity.CRITICAL,
      },
      {
        pattern: /(github|gitlab|bitbucket)[_-]token\s*[:=]\s*['"][^'"]+['"]/i,
        severity: Severity.HIGH,
      },
    ];

    // Find in property assignments
    simpleWalk(ast, {
      Property(node: ASTNode) {
        if (node.key.type === 'Identifier') {
          const keyName = node.key.name;
          const value = node.value;

          if (value.type === 'Literal' && typeof value.value === 'string') {
            for (const { pattern, severity } of secretPatterns) {
              if (pattern.test(`${keyName} = "${value.value}"`)) {
                matches.push({
                  node,
                  type: VulnerabilityType.SENSITIVE_DATA_EXPOSURE,
                  severity,
                  confidence: 70,
                  message: `Possible hardcoded secret: ${keyName}`,
                  remediation:
                    'Store secrets in environment variables or a secure secret management system. Never commit secrets to code.',
                  cwe: 798,
                  owasp: 'A02:2021-Cryptographic Failures',
                });
                break;
              }
            }
          }
        }
      },
    });

    return matches;
  }

  /**
   * Perform taint analysis
   */
  static performTaintAnalysis(
    ast: ASTNode,
    sources: TaintSource[],
    sinks: TaintSink[]
  ): TaintFlow[] {
    const flows: TaintFlow[] = [];
    const variables = new Map<string, TaintSource>();

    // Define taint sources
    simpleWalk(ast, {
      VariableDeclarator(node: ASTNode) {
        if (node.init) {
          // Check if initialization is from a source
          for (const source of sources) {
            if (this.isTaintSource(node, source)) {
              if (node.id.type === 'Identifier') {
                variables.set(node.id.name, source);
              }
            }
          }
        }
      }.bind(this)
    });

    // Track data flow to sinks
    simpleWalk(ast, {
      CallExpression(node: ASTNode) {
        const args = node.arguments || [];

        for (const arg of args) {
          if (arg.type === 'Identifier') {
            const source = variables.get(arg.name);
            if (source) {
              // Check if this call is a sink
              for (const sink of sinks) {
                if (this.isTaintSink(node, sink)) {
                  flows.push({
                    source,
                    sink,
                    path: [arg, node],
                    sanitized: false,
                  });
                }
              }
            }
          }
        }
      }.bind(this)
    });

    return flows;
  }

  /**
   * Check if node is a taint source
   */
  private static isTaintSource(node: ASTNode, source: TaintSource): boolean {
    // Implementation depends on source type
    if (source.type === 'parameter') {
      // Check if it's a function parameter
      return node.type === 'Identifier' && node.name === source.name;
    }
    return false;
  }

  /**
   * Check if node is a taint sink
   */
  private static isTaintSink(node: ASTNode, sink: TaintSink): boolean {
    const funcName = this.getFunctionName(node);
    return funcName === sink.name;
  }

  /**
   * Get node location info
   */
  static getLocation(node: ASTNode): { line: number; column: number } {
    if (node.loc) {
      return {
        line: node.loc.start.line,
        column: node.loc.start.column,
      };
    }
    return { line: 0, column: 0 };
  }

  /**
   * Extract code snippet from node
   */
  static extractCode(code: string, node: ASTNode): string {
    return code.substring(node.start, node.end);
  }

  /**
   * Check if node is in a try-catch block
   */
  static isInTryCatch(node: ASTNode, ast: ASTNode): boolean {
    let inTry = false;

    ancestorWalk(ast, {
      _(node: ASTNode, ancestors: ASTNode[]) {
        if (node.type === 'TryStatement') {
          inTry = true;
        }
      },
    });

    return inTry;
  }

  /**
   * Find all usages of a variable
   */
  static findVariableUsages(ast: ASTNode, varName: string): ASTNode[] {
    const usages: ASTNode[] = [];

    simpleWalk(ast, {
      Identifier(node: ASTNode) {
        if (node.name === varName && node.parent?.type !== 'VariableDeclarator') {
          usages.push(node);
        }
      },
    });

    return usages;
  }

  /**
   * Analyze function complexity
   */
  static analyzeComplexity(ast: ASTNode): {
    cyclomaticComplexity: number;
    linesOfCode: number;
    parameters: number;
    nestingDepth: number;
  } {
    let complexity = 1; // Base complexity
    let nestingDepth = 0;
    let maxNestingDepth = 0;
    let parameters = 0;

    simpleWalk(ast, {
      FunctionDeclaration(node: ASTNode) {
        if (node.params) {
          parameters = node.params.length;
        }
      },

      IfStatement() {
        complexity++;
        nestingDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, nestingDepth);
      },

      WhileStatement() {
        complexity++;
        nestingDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, nestingDepth);
      },

      DoWhileStatement() {
        complexity++;
        nestingDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, nestingDepth);
      },

      ForStatement() {
        complexity++;
        nestingDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, nestingDepth);
      },

      ForInStatement() {
        complexity++;
        nestingDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, nestingDepth);
      },

      ForOfStatement() {
        complexity++;
        nestingDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, nestingDepth);
      },

      SwitchCase() {
        complexity++;
      },

      ConditionalExpression() {
        complexity++;
      },

      CatchClause() {
        complexity++;
      },
    });

    return {
      cyclomaticComplexity: complexity,
      linesOfCode: ast.end - ast.start,
      parameters,
      nestingDepth: maxNestingDepth,
    };
  }
}
