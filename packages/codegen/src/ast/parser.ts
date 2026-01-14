/**
 * AST Parser
 * Parses code into Abstract Syntax Trees for manipulation
 */

import { Language } from '../types/index.js';

/**
 * AST Node interface
 */
export interface ASTNode {
  type: string;
  name?: string;
  value?: any;
  children?: ASTNode[];
  metadata?: Record<string, unknown>;
}

/**
 * Parse result
 */
export interface ParseResult {
  ast: ASTNode;
  errors: ParseError[];
  warnings: ParseWarning[];
}

/**
 * Parse error
 */
export interface ParseError {
  message: string;
  line: number;
  column: number;
}

/**
 * Parse warning
 */
export interface ParseWarning {
  message: string;
  line: number;
  column: number;
}

/**
 * AST Parser class
 */
export class ASTParser {
  /**
   * Parse code into AST
   */
  parse(code: string, language: Language): ParseResult {
    switch (language) {
      case Language.TypeScript:
      case Language.JavaScript:
        return this.parseJavaScript(code);

      case Language.Python:
        return this.parsePython(code);

      case Language.Go:
        return this.parseGo(code);

      case Language.Rust:
        return this.parseRust(code);

      default:
        return this.parseGeneric(code, language);
    }
  }

  /**
   * Parse JavaScript/TypeScript
   */
  private parseJavaScript(code: string): ParseResult {
    try {
      const { parse } = require('@babel/parser');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });

      return {
        ast: this.babelToCustom(ast),
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        ast: { type: 'Program', children: [] },
        errors: [{
          message: error instanceof Error ? error.message : 'Parse error',
          line: 0,
          column: 0
        }],
        warnings: []
      };
    }
  }

  /**
   * Parse Python
   */
  private parsePython(code: string): ParseResult {
    // Simplified Python parsing
    const lines = code.split('\n');
    const statements: ASTNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('def ')) {
        const match = line.match(/def\s+(\w+)\s*\(([^)]*)\)/);
        if (match) {
          statements.push({
            type: 'FunctionDeclaration',
            name: match[1],
            children: [],
            metadata: { line: i + 1 }
          });
        }
      } else if (line.startsWith('class ')) {
        const match = line.match(/class\s+(\w+)/);
        if (match) {
          statements.push({
            type: 'ClassDeclaration',
            name: match[1],
            children: [],
            metadata: { line: i + 1 }
          });
        }
      }
    }

    return {
      ast: {
        type: 'Program',
        children: statements
      },
      errors: [],
      warnings: []
    };
  }

  /**
   * Parse Go
   */
  private parseGo(code: string): ParseResult {
    // Simplified Go parsing
    const lines = code.split('\n');
    const declarations: ASTNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('func ')) {
        const match = line.match(/func\s+(?:\(\s*\w+\s+\*\s*\w+\s*\)\s+)?(\w+)/);
        if (match) {
          declarations.push({
            type: 'FunctionDeclaration',
            name: match[1],
            children: [],
            metadata: { line: i + 1 }
          });
        }
      } else if (line.startsWith('type ')) {
        const match = line.match(/type\s+(\w+)\s+struct/);
        if (match) {
          declarations.push({
            type: 'StructDeclaration',
            name: match[1],
            children: [],
            metadata: { line: i + 1 }
          });
        }
      }
    }

    return {
      ast: {
        type: 'Program',
        children: declarations
      },
      errors: [],
      warnings: []
    };
  }

  /**
   * Parse Rust
   */
  private parseRust(code: string): ParseResult {
    // Simplified Rust parsing
    const lines = code.split('\n');
    const declarations: ASTNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('fn ')) {
        const match = line.match(/fn\s+(\w+)\s*\(/);
        if (match) {
          declarations.push({
            type: 'FunctionDeclaration',
            name: match[1],
            children: [],
            metadata: { line: i + 1 }
          });
        }
      } else if (line.startsWith('struct ')) {
        const match = line.match(/struct\s+(\w+)/);
        if (match) {
          declarations.push({
            type: 'StructDeclaration',
            name: match[1],
            children: [],
            metadata: { line: i + 1 }
          });
        }
      } else if (line.startsWith('impl ')) {
        const match = line.match(/impl\s+(\w+)/);
        if (match) {
          declarations.push({
            type: 'ImplBlock',
            name: match[1],
            children: [],
            metadata: { line: i + 1 }
          });
        }
      }
    }

    return {
      ast: {
        type: 'Program',
        children: declarations
      },
      errors: [],
      warnings: []
    };
  }

  /**
   * Generic parsing fallback
   */
  private parseGeneric(code: string, language: Language): ParseResult {
    // Very basic parsing for unsupported languages
    const lines = code.split('\n');
    const nodes: ASTNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        nodes.push({
          type: 'Statement',
          value: line,
          metadata: { line: i + 1 }
        });
      }
    }

    return {
      ast: {
        type: 'Program',
        children: nodes,
        metadata: { language }
      },
      errors: [],
      warnings: []
    };
  }

  /**
   * Convert Babel AST to custom AST format
   */
  private babelToCustom(node: any): ASTNode {
    if (!node || typeof node !== 'object') {
      return { type: 'Unknown' };
    }

    const customNode: ASTNode = {
      type: node.type
    };

    if (node.name) {
      customNode.name = node.name;
    }

    if (node.value !== undefined) {
      customNode.value = node.value;
    }

    if (node.body) {
      customNode.children = Array.isArray(node.body)
        ? node.body.map((n: any) => this.babelToCustom(n))
        : [this.babelToCustom(node.body)];
    }

    if (node.declarations) {
      customNode.children = node.declarations.map((d: any) => this.babelToCustom(d));
    }

    return customNode;
  }

  /**
   * Generate code from AST
   */
  generate(ast: ASTNode, language: Language): string {
    switch (language) {
      case Language.TypeScript:
      case Language.JavaScript:
        return this.generateJavaScript(ast);

      case Language.Python:
        return this.generatePython(ast);

      case Language.Go:
        return this.generateGo(ast);

      case Language.Rust:
        return this.generateRust(ast);

      default:
        return this.generateGeneric(ast);
    }
  }

  /**
   * Generate JavaScript from AST
   */
  private generateJavaScript(node: ASTNode): string {
    let code = '';

    switch (node.type) {
      case 'Program':
        if (node.children) {
          code = node.children.map(child => this.generateJavaScript(child)).join('\n\n');
        }
        break;

      case 'FunctionDeclaration':
        code = `function ${node.name}() {\n`;
        if (node.children) {
          code += node.children.map(child => '  ' + this.generateJavaScript(child)).join('\n');
        }
        code += '\n}';
        break;

      case 'ClassDeclaration':
        code = `class ${node.name} {\n`;
        if (node.children) {
          code += node.children.map(child => '  ' + this.generateJavaScript(child)).join('\n');
        }
        code += '\n}';
        break;

      default:
        if (node.value) {
          code = String(node.value);
        }
    }

    return code;
  }

  /**
   * Generate Python from AST
   */
  private generatePython(node: ASTNode): string {
    let code = '';

    switch (node.type) {
      case 'Program':
        if (node.children) {
          code = node.children.map(child => this.generatePython(child)).join('\n\n');
        }
        break;

      case 'FunctionDeclaration':
        code = `def ${node.name}():\n`;
        if (node.children) {
          code += node.children.map(child => '    ' + this.generatePython(child)).join('\n');
        }
        break;

      case 'ClassDeclaration':
        code = `class ${node.name}:\n`;
        if (node.children) {
          code += node.children.map(child => '    ' + this.generatePython(child)).join('\n');
        }
        break;

      default:
        if (node.value) {
          code = String(node.value);
        }
    }

    return code;
  }

  /**
   * Generate Go from AST
   */
  private generateGo(node: ASTNode): string {
    let code = '';

    switch (node.type) {
      case 'Program':
        if (node.children) {
          code = node.children.map(child => this.generateGo(child)).join('\n\n');
        }
        break;

      case 'FunctionDeclaration':
        code = `func ${node.name}() {\n`;
        if (node.children) {
          code += node.children.map(child => '\t' + this.generateGo(child)).join('\n');
        }
        code += '\n}';
        break;

      case 'StructDeclaration':
        code = `type ${node.name} struct {\n`;
        if (node.children) {
          code += node.children.map(child => '\t' + this.generateGo(child)).join('\n');
        }
        code += '\n}';
        break;

      default:
        if (node.value) {
          code = String(node.value);
        }
    }

    return code;
  }

  /**
   * Generate Rust from AST
   */
  private generateRust(node: ASTNode): string {
    let code = '';

    switch (node.type) {
      case 'Program':
        if (node.children) {
          code = node.children.map(child => this.generateRust(child)).join('\n\n');
        }
        break;

      case 'FunctionDeclaration':
        code = `fn ${node.name}() {\n`;
        if (node.children) {
          code += node.children.map(child => '    ' + this.generateRust(child)).join('\n');
        }
        code += '\n}';
        break;

      case 'StructDeclaration':
        code = `struct ${node.name} {\n`;
        if (node.children) {
          code += node.children.map(child => '    ' + this.generateRust(child)).join('\n');
        }
        code += '\n}';
        break;

      default:
        if (node.value) {
          code = String(node.value);
        }
    }

    return code;
  }

  /**
   * Generic code generation
   */
  private generateGeneric(node: ASTNode): string {
    if (node.value) {
      return String(node.value);
    }

    if (node.children) {
      return node.children.map(child => this.generateGeneric(child)).join('\n');
    }

    return '';
  }
}
