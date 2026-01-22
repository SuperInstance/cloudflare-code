/**
 * Unit tests for ASTTransformer
 */

import { ASTTransformer } from '../../src/ast/transformer';
import { parse } from '../../src/parsers/parser';
import * as t from '@babel/types';

describe('ASTTransformer', () => {
  let transformer: ASTTransformer;

  beforeEach(() => {
    transformer = new ASTTransformer({
      retainComments: true,
      retainFormatting: true
    });
  });

  describe('parse', () => {
    it('should parse TypeScript code', async () => {
      const code = 'const x: number = 42;';
      const ast = await transformer.parse(code, 'test.ts', 'typescript');

      expect(ast).toBeDefined();
      expect(ast.type).toBe('Program');
    });

    it('should parse JavaScript code', async () => {
      const code = 'const x = 42;';
      const ast = await transformer.parse(code, 'test.js', 'javascript');

      expect(ast).toBeDefined();
      expect(ast.type).toBe('Program');
    });

    it('should parse JSX code', async () => {
      const code = '<div>Hello</div>';
      const ast = await transformer.parse(code, 'test.jsx', 'jsx');

      expect(ast).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate code from AST', async () => {
      const code = 'const x = 42;';
      const ast = await transformer.parse(code, 'test.ts');
      const result = transformer.generate(ast);

      expect(result.code).toBeDefined();
      expect(result.code).toContain('const x');
      expect(result.ast).toBeDefined();
    });

    it('should preserve comments when generating', async () => {
      const code = `
// This is a comment
const x = 42;
`;

      const ast = await transformer.parse(code, 'test.ts');
      const result = transformer.generate(ast);

      expect(result.code).toContain('comment');
    });
  });

  describe('traverse', () => {
    it('should traverse AST with visitor', async () => {
      const code = 'const x = 1; const y = 2;';
      const ast = await transformer.parse(code, 'test.ts');

      let visitedCount = 0;
      transformer.traverse(ast, {
        VariableDeclaration(path) {
          visitedCount++;
        }
      });

      expect(visitedCount).toBe(2);
    });

    it('should support multiple visitor types', async () => {
      const code = 'const x = () => 42; x();';
      const ast = await transformer.parse(code, 'test.ts');

      let declarations = 0;
      let calls = 0;

      transformer.traverse(ast, {
        VariableDeclaration(path) {
          declarations++;
        },
        CallExpression(path) {
          calls++;
        }
      });

      expect(declarations).toBe(1);
      expect(calls).toBe(1);
    });
  });

  describe('extractMethod', () => {
    it('should extract a method from code block', async () => {
      const code = `
function example() {
  const a = 1;
  const b = 2;
  const sum = a + b;
  console.log(sum);
}
`;

      const ast = await transformer.parse(code, 'test.ts');
      const newAst = transformer.extractMethod(ast, {
        startLine: 4,
        endLine: 4,
        name: 'addNumbers',
        parameters: ['a', 'b'],
        capturedVariables: []
      });

      const result = transformer.generate(newAst);
      expect(result.code).toContain('function addNumbers');
    });

    it('should handle captured variables', async () => {
      const code = `
function example() {
  const multiplier = 2;
  const result = 5 * multiplier;
}
`;

      const ast = await transformer.parse(code, 'test.ts');
      const newAst = transformer.extractMethod(ast, {
        startLine: 3,
        endLine: 3,
        name: 'calculate',
        parameters: [],
        capturedVariables: ['multiplier']
      });

      const result = transformer.generate(newAst);
      expect(result.code).toContain('function calculate');
    });
  });

  describe('inlineVariable', () => {
    it('should inline variable references', async () => {
      const code = `
const name = 'World';
console.log(name);
`;

      const ast = await transformer.parse(code, 'test.ts');
      const newAst = transformer.inlineVariable(ast, {
        variableName: 'name',
        references: [],
        declaration: null,
        initializer: t.stringLiteral('World'),
        inlineAll: true,
        preserveComments: true
      });

      const result = transformer.generate(newAst);
      expect(result.code).toContain("'World'");
    });
  });

  describe('renameSymbol', () => {
    it('should rename all occurrences of a symbol', async () => {
      const code = `
const oldName = 1;
console.log(oldName);
const x = oldName + 1;
`;

      const ast = await transformer.parse(code, 'test.ts');
      const newAst = transformer.renameSymbol(ast, {
        oldName: 'oldName',
        newName: 'newName',
        references: [],
        renameInComments: false,
        renameInStrings: false
      });

      const result = transformer.generate(newAst);
      expect(result.code).toContain('newName');
      expect(result.code).not.toContain('oldName');
    });
  });

  describe('changeSignature', () => {
    it('should add parameters to function', async () => {
      const code = `
function greet(name: string) {
  console.log(name);
}
greet('World');
`;

      const ast = await transformer.parse(code, 'test.ts');
      const newAst = transformer.changeSignature(ast, {
        functionName: 'greet',
        declaration: null,
        changes: {
          parameters: {
            add: [
              { name: 'title', type: 'string', defaultValue: "'Mr'" }
            ]
          }
        },
        callSites: [],
        updateCallSites: true,
        preserveDefaults: true
      });

      const result = transformer.generate(newAst);
      expect(result.code).toContain('title');
    });

    it('should remove parameters from function', async () => {
      const code = `
function greet(name: string, title: string) {
  console.log(name, title);
}
greet('World', 'Mr');
`;

      const ast = await transformer.parse(code, 'test.ts');
      const newAst = transformer.changeSignature(ast, {
        functionName: 'greet',
        declaration: null,
        changes: {
          parameters: {
            remove: ['title']
          }
        },
        callSites: [],
        updateCallSites: true,
        preserveDefaults: true
      });

      const result = transformer.generate(newAst);
      // Should only have one parameter
      expect(result.code.split('(')[1].split(')')[0].split(',').length).toBe(1);
    });
  });

  describe('cloneNode', () => {
    it('should clone AST nodes', async () => {
      const code = 'const x = 42;';
      const ast = await transformer.parse(code, 'test.ts');

      const original = ast;
      const clone = transformer.cloneNode(original, false);

      expect(clone).toBeDefined();
      expect(clone).not.toBe(original);
      expect(clone.type).toBe(original.type);
    });

    it('should perform deep clone when requested', async () => {
      const code = 'const x = { y: 42 };';
      const ast = await transformer.parse(code, 'test.ts');

      const original = ast;
      const clone = transformer.cloneNode(original, true);

      expect(clone).toBeDefined();
      expect(clone).not.toBe(original);
    });
  });

  describe('transform', () => {
    it('should transform code with custom visitor', async () => {
      const code = 'const x = 1;';
      const result = transformer.transform(code, {
        VariableDeclaration(path) {
          path.node.kind = 'let';
        }
      });

      expect(result).toContain('let');
    });

    it('should support multiple transformations', async () => {
      const code = 'var x = 1; var y = 2;';
      const result = transformer.transform(code, {
        VariableDeclaration(path) {
          path.node.kind = 'const';
        }
      });

      expect(result).toContain('const');
    });
  });
});
