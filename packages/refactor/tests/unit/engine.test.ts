/**
 * Unit tests for RefactoringEngine
 */

import { RefactoringEngine } from '../../src/refactor/engine';
import { RefactoringOperation } from '../../src/refactor/types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('RefactoringEngine', () => {
  let engine: RefactoringEngine;
  const fixturesPath = path.join(__dirname, '..', 'fixtures');

  beforeEach(() => {
    engine = new RefactoringEngine({
      logLevel: 'error',
      prettierOptions: { semi: true, singleQuote: true }
    });
  });

  describe('extractMethod', () => {
    it('should extract a method from selected code', async () => {
      const testCode = `
function example() {
  const a = 1;
  const b = 2;
  const sum = a + b;
  console.log(sum);
  return sum;
}
`;

      const testFile = path.join(fixturesPath, 'extract-method-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.extractMethod(testFile, 3, 4, 'addNumbers');

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.newContent).toContain('function addNumbers');
      expect(result.metadata?.methodName).toBe('addNumbers');
    });

    it('should handle parameters correctly', async () => {
      const testCode = `
function example() {
  const x = 5;
  const y = 10;
  const result = x * y + x;
  return result;
}
`;

      const testFile = path.join(fixturesPath, 'extract-method-params.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.extractMethod(
        testFile,
        4,
        4,
        'calculate',
        { parameters: ['x', 'y'] }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.parameters).toBe(2);
    });

    it('should fail when no containing function is found', async () => {
      const testCode = `
const x = 1;
const y = 2;
`;

      const testFile = path.join(fixturesPath, 'extract-method-no-func.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.extractMethod(testFile, 2, 2, 'newMethod');

      expect(result.success).toBe(false);
      expect(result.error).toContain('containing function');
    });
  });

  describe('inlineVariable', () => {
    it('should inline a variable with single reference', async () => {
      const testCode = `
const greeting = 'Hello';
console.log(greeting);
`;

      const testFile = path.join(fixturesPath, 'inline-variable-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.inlineVariable(testFile, 'greeting');

      expect(result.success).toBe(true);
      expect(result.metadata?.variableName).toBe('greeting');
      expect(result.metadata?.referencesInlined).toBe(1);
    });

    it('should inline a variable with multiple references', async () => {
      const testCode = `
const name = 'World';
console.log(name);
console.log(\`Hello, \${name}\`);
`;

      const testFile = path.join(fixturesPath, 'inline-variable-multi.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.inlineVariable(testFile, 'name');

      expect(result.success).toBe(true);
      expect(result.metadata?.referencesInlined).toBeGreaterThan(1);
    });

    it('should fail when variable has no initializer', async () => {
      const testCode = `
let x;
x = 1;
console.log(x);
`;

      const testFile = path.join(fixturesPath, 'inline-variable-no-init.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.inlineVariable(testFile, 'x');

      expect(result.success).toBe(false);
      expect(result.error).toContain('no initializer');
    });
  });

  describe('inlineFunction', () => {
    it('should inline a simple function', async () => {
      const testCode = `
function add(a: number, b: number): number {
  return a + b;
}

const result = add(1, 2);
`;

      const testFile = path.join(fixturesPath, 'inline-function-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.inlineFunction(testFile, 'add');

      expect(result.success).toBe(true);
      expect(result.metadata?.functionName).toBe('add');
      expect(result.metadata?.callsInlined).toBe(1);
    });
  });

  describe('renameSymbol', () => {
    it('should rename a variable throughout the file', async () => {
      const testCode = `
const oldName = 'value';
console.log(oldName);
const another = oldName + '!';
`;

      const testFile = path.join(fixturesPath, 'rename-symbol-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.renameSymbol(testFile, 'oldName', 'newName');

      expect(result.success).toBe(true);
      expect(result.metadata?.oldName).toBe('oldName');
      expect(result.metadata?.newName).toBe('newName');
      expect(result.metadata?.occurrencesRenamed).toBe(3);
    });

    it('should fail for invalid identifier', async () => {
      const testCode = 'const x = 1;';
      const testFile = path.join(fixturesPath, 'rename-symbol-invalid.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.renameSymbol(testFile, 'x', '123invalid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid identifier');
    });
  });

  describe('changeSignature', () => {
    it('should add a parameter to a function', async () => {
      const testCode = `
function greet(name: string) {
  console.log(\`Hello, \${name}\`);
}

greet('World');
`;

      const testFile = path.join(fixturesPath, 'change-signature-add.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.changeSignature(
        testFile,
        'greet',
        {
          parameters: {
            add: [{ name: 'title', type: 'string', defaultValue: "'Mr'" }]
          }
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.parametersAdded).toBe(1);
    });

    it('should remove a parameter from a function', async () => {
      const testCode = `
function greet(name: string, title: string) {
  console.log(\`Hello, \${title} \${name}\`);
}

greet('World', 'Mr');
`;

      const testFile = path.join(fixturesPath, 'change-signature-remove.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.changeSignature(
        testFile,
        'greet',
        {
          parameters: {
            remove: ['title']
          }
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.parametersRemoved).toBe(1);
    });
  });

  describe('extractInterface', () => {
    it('should extract interface from class', async () => {
      const testCode = `
class UserService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public getUser(id: number): User {
    return fetch(\`/users/\${id}\`);
  }

  public updateUser(id: number, data: any): boolean {
    return true;
  }
}
`;

      const testFile = path.join(fixturesPath, 'extract-interface-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.extractInterface(
        testFile,
        'UserService',
        'IUserService'
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.className).toBe('UserService');
      expect(result.metadata?.interfaceName).toBe('IUserService');
      expect(result.metadata?.methodsExtracted).toBeGreaterThan(0);
    });
  });

  describe('introduceParameter', () => {
    it('should introduce a parameter to a function', async () => {
      const testCode = `
function calculate() {
  const taxRate = 0.1;
  return 100 * (1 + taxRate);
}
`;

      const testFile = path.join(fixturesPath, 'introduce-param-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.introduceParameter(
        testFile,
        'calculate',
        {
          name: 'taxRate',
          type: 'number',
          defaultValue: '0.1'
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.parameterName).toBe('taxRate');
    });
  });

  describe('batchRefactor', () => {
    it('should execute multiple refactoring operations', async () => {
      const operations: RefactoringOperation[] = [
        {
          type: 'renameSymbol',
          filePath: path.join(fixturesPath, 'batch-test.ts'),
          oldName: 'oldVar',
          newName: 'newVar'
        },
        {
          type: 'renameSymbol',
          filePath: path.join(fixturesPath, 'batch-test.ts'),
          oldName: 'anotherVar',
          newName: 'renamedVar'
        }
      ];

      const testCode = 'const oldVar = 1; const anotherVar = 2;';
      const testFile = path.join(fixturesPath, 'batch-test.ts');
      await fs.writeFile(testFile, testCode);

      const results = await engine.batchRefactor(operations);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('undoRefactoring', () => {
    it('should undo a successful refactoring', async () => {
      const testCode = 'const original = "value";';
      const testFile = path.join(fixturesPath, 'undo-test.ts');
      await fs.writeFile(testFile, testCode);

      const result = await engine.renameSymbol(testFile, 'original', 'renamed');

      expect(result.success).toBe(true);
      expect(result.undo).toBeDefined();

      const undone = await engine.undoRefactoring(result);

      expect(undone).toBe(true);
    });

    it('should fail when no undo info is available', async () => {
      const result = {
        success: true,
        changes: [],
        filePath: '/fake/path',
        operation: 'renameSymbol'
      };

      const undone = await engine.undoRefactoring(result);

      expect(undone).toBe(false);
    });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const files = await fs.readdir(fixturesPath);
      for (const file of files) {
        if (file.endsWith('.ts')) {
          await fs.unlink(path.join(fixturesPath, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });
});
