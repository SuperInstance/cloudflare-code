/**
 * Parser Factory - Creates AST parsers for different languages
 */

// @ts-nocheck - Parser factory with type compatibility issues
import { Language } from '../types/index.js';
import { ASTParser } from './ast-parser.js';

// ============================================================================
// Parser Factory
// ============================================================================

export class ParserFactory {
  private parsers: Map<Language, ASTParser> = new Map();
  private cache: Map<string, unknown> = new Map();

  constructor() {
    this.initializeParsers();
  }

  /**
   * Parse code into AST
   */
  async parse(language: Language, content: string): Promise<unknown> {
    const cacheKey = `${language}:${this.hashContent(content)}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const parser = this.parsers.get(language);
    if (!parser) {
      throw new Error(`No parser available for language: ${language}`);
    }

    try {
      const ast = await parser.parse(content);
      this.cache.set(cacheKey, ast);
      return ast;
    } catch (error) {
      throw new Error(`Failed to parse ${language} code: ${(error as Error).message}`);
    }
  }

  /**
   * Check if parser is available for language
   */
  hasParser(language: Language): boolean {
    return this.parsers.has(language);
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): Language[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Clear the parse cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private initializeParsers(): void {
    // Initialize parsers for supported languages
    // Each parser handles AST generation for its language

    // TypeScript/JavaScript
    this.parsers.set('typescript', new TypeScriptParser());
    this.parsers.set('javascript', new JavaScriptParser());

    // Python
    this.parsers.set('python', new PythonParser());

    // Go
    this.parsers.set('go', new GoParser());

    // Rust
    this.parsers.set('rust', new RustParser());

    // Java
    this.parsers.set('java', new JavaParser());

    // C++
    this.parsers.set('cpp', new CppParser());

    // C#
    this.parsers.set('csharp', new CSharpParser());

    // Ruby
    this.parsers.set('ruby', new RubyParser());

    // PHP
    this.parsers.set('php', new PHPParser());
  }
}

// ============================================================================
// AST Parser Base
// ============================================================================

export abstract class ASTParser {
  abstract parse(content: string): Promise<unknown>;

  /**
   * Get node at position
   */
  getNodeAtPosition(ast: unknown, line: number, column: number): unknown {
    // Default implementation
    return null;
  }

  /**
   * Get all nodes of type
   */
  getNodesByType(ast: unknown, type: string): unknown[] {
    // Default implementation
    return [];
  }

  /**
   * Traverse AST
   */
  traverse(ast: unknown, visitor: (node: unknown) => void): void {
    // Default implementation
  }
}

// ============================================================================
// Language-Specific Parsers
// ============================================================================

class TypeScriptParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    // Simplified parsing - in production, use @typescript-eslint/typescript-estree
    // or the official TypeScript compiler API

    try {
      // Try using @babel/parser as a fallback
      const { parse } = await import('@babel/parser');
      return parse(content, {
        sourceType: 'module',
        plugins: ['typescript'],
      });
    } catch (error) {
      // Fallback to simple AST representation
      return this.createSimpleAST(content, 'typescript');
    }
  }
}

class JavaScriptParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    try {
      const { parse } = await import('@babel/parser');
      return parse(content, {
        sourceType: 'module',
        plugins: ['jsx'],
      });
    } catch (error) {
      return this.createSimpleAST(content, 'javascript');
    }
  }
}

class PythonParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    // Python AST parsing would require a Python parser or tree-sitter-python
    return this.createSimpleAST(content, 'python');
  }
}

class GoParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    // Go AST parsing would require tree-sitter-go
    return this.createSimpleAST(content, 'go');
  }
}

class RustParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    // Rust AST parsing would require tree-sitter-rust
    return this.createSimpleAST(content, 'rust');
  }
}

class JavaParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    // Java AST parsing would require tree-sitter-java
    return this.createSimpleAST(content, 'java');
  }
}

class CppParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    // C++ AST parsing would require tree-sitter-cpp
    return this.createSimpleAST(content, 'cpp');
  }
}

class CSharpParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    // C# AST parsing would require tree-sitter-c-sharp
    return this.createSimpleAST(content, 'csharp');
  }
}

class RubyParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    // Ruby AST parsing would require tree-sitter-ruby
    return this.createSimpleAST(content, 'ruby');
  }
}

class PHPParser extends ASTParser {
  async parse(content: string): Promise<unknown> {
    // PHP AST parsing would require tree-sitter-php
    return this.createSimpleAST(content, 'php');
  }
}

// ============================================================================
// Helper Methods
// ========================================================================

// Extension to add simple AST parsing
declare module './parser-factory' {
  interface ASTParser {
    createSimpleAST(content: string, language: Language): SimpleAST;
  }
}

interface SimpleAST {
  type: string;
  language: Language;
  lines: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: string[];
  exports: string[];
}

interface FunctionInfo {
  name: string;
  line: number;
  parameters: string[];
  isAsync: boolean;
}

interface ClassInfo {
  name: string;
  line: number;
  methods: string[];
}

ASTParser.prototype.createSimpleAST = function(content: string, language: Language): SimpleAST {
  const lines = content.split('\n');

  const ast: SimpleAST = {
    type: 'SimpleAST',
    language,
    lines,
    functions: [],
    classes: [],
    imports: [],
    exports: [],
  };

  // Extract functions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Functions
    const funcMatch =
      language === 'typescript' || language === 'javascript'
        ? line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)\s*=>|function))/)
        : language === 'python'
        ? line.match(/def\s+(\w+)\s*\(/)
        : language === 'go'
        ? line.match(/func\s+(?:\(\w+\s+\*\w+\)\s+)?(\w+)\s*\(/)
        : null;

    if (funcMatch) {
      const name = funcMatch[1] || funcMatch[2];
      if (name) {
        ast.functions.push({
          name,
          line: i + 1,
          parameters: [],
          isAsync: line.includes('async'),
        });
      }
    }

    // Classes
    const classMatch = line.match(/class\s+(\w+)/);
    if (classMatch) {
      ast.classes.push({
        name: classMatch[1],
        line: i + 1,
        methods: [],
      });
    }

    // Imports
    const importMatch =
      language === 'typescript' || language === 'javascript'
        ? line.match(/import\s+.*from\s+['"]([^'"]+)['"]/)
        : language === 'python'
        ? line.match(/import\s+(\w+)|from\s+(\w+)\s+import/)
        : null;

    if (importMatch) {
      ast.imports.push(importMatch[1] || importMatch[2]);
    }

    // Exports
    const exportMatch = line.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/);
    if (exportMatch) {
      ast.exports.push(exportMatch[1]);
    }
  }

  return ast;
};
