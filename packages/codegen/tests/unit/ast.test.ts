/**
 * Unit tests for AST Parser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ASTParser } from '../../src/ast/parser';
import { Language } from '../../src/types/index';

describe('ASTParser', () => {
  let parser: ASTParser;

  beforeEach(() => {
    parser = new ASTParser();
  });

  describe('parse JavaScript', () => {
    it('should parse valid JavaScript code', () => {
      const code = `
function add(a, b) {
  return a + b;
}

class Calculator {
  multiply(a, b) {
    return a * b;
  }
}
`;

      const result = parser.parse(code, Language.JavaScript);

      expect(result.errors).toHaveLength(0);
      expect(result.ast.type).toBe('Program');
      expect(result.ast.children).toBeDefined();
    });

    it('should handle parsing errors', () => {
      const code = `
function test( {
  return;
}
`;

      const result = parser.parse(code, Language.JavaScript);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parse TypeScript', () => {
    it('should parse TypeScript code', () => {
      const code = `
function add(a: number, b: number): number {
  return a + b;
}

interface User {
  id: number;
  name: string;
}
`;

      const result = parser.parse(code, Language.TypeScript);

      expect(result.ast.type).toBe('Program');
    });
  });

  describe('parse Python', () => {
    it('should parse Python functions and classes', () => {
      const code = `
def add(a, b):
    return a + b

class Calculator:
    def multiply(self, a, b):
        return a * b
`;

      const result = parser.parse(code, Language.Python);

      expect(result.ast.type).toBe('Program');
      expect(result.ast.children).toBeDefined();
      expect(result.ast.children?.length).toBeGreaterThan(0);
    });

    it('should extract function names', () => {
      const code = `
def hello():
    pass

def goodbye():
    pass
`;

      const result = parser.parse(code, Language.Python);

      const functions = result.ast.children?.filter((c: any) => c.type === 'FunctionDeclaration');
      expect(functions).toHaveLength(2);
      expect(functions[0].name).toBe('hello');
      expect(functions[1].name).toBe('goodbye');
    });

    it('should extract class names', () => {
      const code = `
class User:
    pass

class Admin:
    pass
`;

      const result = parser.parse(code, Language.Python);

      const classes = result.ast.children?.filter((c: any) => c.type === 'ClassDeclaration');
      expect(classes).toHaveLength(2);
      expect(classes[0].name).toBe('User');
      expect(classes[1].name).toBe('Admin');
    });
  });

  describe('parse Go', () => {
    it('should parse Go functions', () => {
      const code = `
func add(a, b int) int {
    return a + b
}

func (c *Calculator) multiply(a, b int) int {
    return a * b
}
`;

      const result = parser.parse(code, Language.Go);

      expect(result.ast.type).toBe('Program');
      expect(result.ast.children).toBeDefined();
    });

    it('should parse Go structs', () => {
      const code = `
type User struct {
    ID   int
    Name string
}
`;

      const result = parser.parse(code, Language.Go);

      const structs = result.ast.children?.filter((c: any) => c.type === 'StructDeclaration');
      expect(structs).toHaveLength(1);
      expect(structs[0].name).toBe('User');
    });
  });

  describe('parse Rust', () => {
    it('should parse Rust functions', () => {
      const code = `
fn add(a: i32, b: i32) -> i32 {
    a + b
}

impl Calculator {
    fn multiply(&self, a: i32, b: i32) -> i32 {
        a * b
    }
}
`;

      const result = parser.parse(code, Language.Rust);

      expect(result.ast.type).toBe('Program');
      expect(result.ast.children).toBeDefined();
    });

    it('should parse Rust structs', () => {
      const code = `
struct User {
    id: i32,
    name: String,
}
`;

      const result = parser.parse(code, Language.Rust);

      const structs = result.ast.children?.filter((c: any) => c.type === 'StructDeclaration');
      expect(structs).toHaveLength(1);
      expect(structs[0].name).toBe('User');
    });

    it('should parse impl blocks', () => {
      const code = `
impl User {
    fn new(id: i32, name: String) -> Self {
        User { id, name }
    }
}
`;

      const result = parser.parse(code, Language.Rust);

      const impls = result.ast.children?.filter((c: any) => c.type === 'ImplBlock');
      expect(impls).toHaveLength(1);
      expect(impls[0].name).toBe('User');
    });
  });

  describe('generate code from AST', () => {
    it('should generate JavaScript from AST', () => {
      const code = `function add(a, b) { return a + b; }`;
      const ast = parser.parse(code, Language.JavaScript).ast;
      const generated = parser.generate(ast, Language.JavaScript);

      expect(generated).toContain('function add');
      expect(generated).toContain('return a + b');
    });

    it('should generate Python from AST', () => {
      const code = `def add(a, b):\n    return a + b`;
      const ast = parser.parse(code, Language.Python).ast;
      const generated = parser.generate(ast, Language.Python);

      expect(generated).toContain('def add');
    });

    it('should generate Go from AST', () => {
      const code = `func add(a, b int) int { return a + b }`;
      const ast = parser.parse(code, Language.Go).ast;
      const generated = parser.generate(ast, Language.Go);

      expect(generated).toContain('func add');
    });

    it('should generate Rust from AST', () => {
      const code = `fn add(a: i32, b: i32) -> i32 { a + b }`;
      const ast = parser.parse(code, Language.Rust).ast;
      const generated = parser.generate(ast, Language.Rust);

      expect(generated).toContain('fn add');
    });
  });

  describe('error handling', () => {
    it('should handle invalid code gracefully', () => {
      const code = `this is not valid code at all !!!`;
      const result = parser.parse(code, Language.JavaScript);

      // Should still return a result even with errors
      expect(result).toBeDefined();
      expect(result.ast).toBeDefined();
    });
  });
});
