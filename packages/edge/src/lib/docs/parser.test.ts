/**
 * Documentation Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { DocumentationParser, createDocParser } from './parser';
import type { ParsedDocumentation, DocSymbol } from './types';

describe('DocumentationParser', () => {
  const parser = new DocumentationParser();

  describe('parseFile', () => {
    it('should parse TypeScript file with JSDoc comments', async () => {
      const content = `
/**
 * Calculates the sum of two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The sum
 * @example
 *   sum(1, 2) // returns 3
 */
export function sum(a: number, b: number): number {
  return a + b;
}

/**
 * Greets a person
 */
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;

      const result = await parser.parseFile(content, 'test.ts');

      expect(result.language).toBe('typescript');
      expect(result.symbols).toHaveLength(2);
      expect(result.stats.totalSymbols).toBe(2);
      expect(result.stats.documented).toBeGreaterThanOrEqual(1);
    });

    it('should extract function parameters', async () => {
      const content = `
/**
 * Creates a user
 */
export async function createUser(
  name: string,
  age: number,
  email?: string,
  ...rest: any[]
): Promise<User> {
  return db.users.create({ name, age, email });
}
`;

      const result = await parser.parseFile(content, 'user.ts');

      const func = result.symbols.find(s => s.name === 'createUser');
      expect(func).toBeDefined();
      expect(func?.parameters).toEqual([
        { name: 'name', type: 'string', optional: false, rest: false },
        { name: 'age', type: 'number', optional: false, rest: false },
        { name: 'email', type: 'string', optional: true, rest: false },
        { name: 'rest', type: 'any[]', optional: false, rest: true },
      ]);
    });

    it('should extract class with properties and methods', async () => {
      const content = `
/**
 * User class
 */
export class User {
  /**
   * User's name
   */
  name: string;

  /**
   * User's age
   */
  age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  /**
   * Get user info
   */
  getInfo(): string {
    return \`\${this.name} (\${this.age})\`;
  }
}
`;

      const result = await parser.parseFile(content, 'user.ts');

      const userClass = result.symbols.find(s => s.name === 'User');
      expect(userClass).toBeDefined();
      expect(userClass?.kind).toBe('class');
      expect(userClass?.exported).toBe(true);
    });

    it('should extract interface definitions', async () => {
      const content = `
/**
 * User interface
 */
export interface User {
  /** User ID */
  id: string;
  /** User name */
  name: string;
  /** User email */
  email: string;
}

/**
 * Admin interface extends User
 */
export interface Admin extends User {
  permissions: string[];
}
`;

      const result = await parser.parseFile(content, 'types.ts');

      const userInterface = result.symbols.find(s => s.name === 'User');
      expect(userInterface).toBeDefined();
      expect(userInterface?.kind).toBe('interface');

      const adminInterface = result.symbols.find(s => s.name === 'Admin');
      expect(adminInterface).toBeDefined();
      expect(adminInterface?.extends).toContain('User');
    });

    it('should extract type aliases', async () => {
      const content = `
/**
 * User type definition
 */
export type User = {
  id: string;
  name: string;
};

/**
 * Generic result type
 */
export type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};
`;

      const result = await parser.parseFile(content, 'types.ts');

      const userType = result.symbols.find(s => s.name === 'User');
      expect(userType).toBeDefined();
      expect(userType?.kind).toBe('type');

      const resultType = result.symbols.find(s => s.name === 'Result');
      expect(resultType).toBeDefined();
      expect(resultType?.typeParameters).toHaveLength(2);
    });

    it('should extract enum definitions', async () => {
      const content = `
/**
 * User role enum
 */
export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}
`;

      const result = await parser.parseFile(content, 'roles.ts');

      const roleEnum = result.symbols.find(s => s.name === 'Role');
      expect(roleEnum).toBeDefined();
      expect(roleEnum?.kind).toBe('enum');
    });

    it('should extract docstring tags', async () => {
      const content = `
/**
 * Function with tags
 * @param name - The name
 * @returns A greeting
 * @example
 *   greet("World") // "Hello, World!"
 * @since 1.0.0
 * @version 2.0.0
 * @deprecated Use greetPerson instead
 */
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;

      const result = await parser.parseFile(content, 'greet.ts');

      const func = result.symbols.find(s => s.name === 'greet');
      expect(func?.deprecated).toBe(true);
      expect(func?.since).toBe('1.0.0');
      expect(func?.version).toBe('2.0.0');
      expect(func?.examples).toHaveLength(1);
      expect(func?.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'param' }),
          expect.objectContaining({ name: 'returns' }),
          expect.objectContaining({ name: 'example' }),
          expect.objectContaining({ name: 'since' }),
          expect.objectContaining({ name: 'version' }),
          expect.objectContaining({ name: 'deprecated' }),
        ])
      );
    });

    it('should parse Python files with docstrings', async () => {
      const content = `
def greet(name: str) -> str:
    \"\"\"Greet a person.

    Args:
        name: The person's name

    Returns:
        A greeting message

    Example:
        >>> greet("World")
        'Hello, World!'
    \"\"\"
    return f"Hello, {name}!"
`;

      const result = await parser.parseFile(content, 'greet.py');

      expect(result.language).toBe('python');
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe('greet');
      expect(result.symbols[0].description).toContain('Greet a person');
    });

    it('should calculate statistics correctly', async () => {
      const content = `
export function func1() {}
export function func2() {}
export class MyClass {}
export interface MyInterface {}
export type MyType = {};
`;

      const result = await parser.parseFile(content, 'test.ts');

      expect(result.stats.totalSymbols).toBe(5);
      expect(result.stats.functions).toBeGreaterThanOrEqual(2);
      expect(result.stats.classes).toBeGreaterThanOrEqual(1);
      expect(result.stats.interfaces).toBeGreaterThanOrEqual(1);
      expect(result.stats.exported).toBe(5);
    });
  });

  describe('parseBatch', () => {
    it('should parse multiple files in parallel', async () => {
      const files = [
        { content: 'export function foo() {}', path: 'foo.ts' },
        { content: 'export function bar() {}', path: 'bar.ts' },
        { content: 'export function baz() {}', path: 'baz.ts' },
      ];

      const results = await parser.parseBatch(files);

      expect(results).toHaveLength(3);
      expect(results[0].symbols[0].name).toBe('foo');
      expect(results[1].symbols[0].name).toBe('bar');
      expect(results[2].symbols[0].name).toBe('baz');
    });
  });

  describe('createDocParser', () => {
    it('should create parser with custom options', () => {
      const customParser = createDocParser({
        includePrivate: true,
        includeSource: true,
        maxFileSize: 2048,
      });

      expect(customParser).toBeInstanceOf(DocumentationParser);
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript from .ts extension', async () => {
      const result = await parser.parseFile('', 'file.ts');
      expect(result.language).toBe('typescript');
    });

    it('should detect JavaScript from .js extension', async () => {
      const result = await parser.parseFile('', 'file.js');
      expect(result.language).toBe('javascript');
    });

    it('should detect Python from .py extension', async () => {
      const result = await parser.parseFile('', 'file.py');
      expect(result.language).toBe('python');
    });

    it('should detect Go from .go extension', async () => {
      const result = await parser.parseFile('', 'file.go');
      expect(result.language).toBe('go');
    });

    it('should detect Rust from .rs extension', async () => {
      const result = await parser.parseFile('', 'file.rs');
      expect(result.language).toBe('rust');
    });
  });

  describe('access modifiers', () => {
    it('should detect public access by default', async () => {
      const content = 'function foo() {}';
      const result = await parser.parseFile(content, 'test.ts');
      expect(result.symbols[0].access).toBe('public');
    });

    it('should detect private access', async () => {
      const content = 'private function foo() {}';
      const result = await parser.parseFile(content, 'test.ts');
      expect(result.symbols[0].access).toBe('private');
    });

    it('should detect protected access', async () => {
      const content = 'protected function foo() {}';
      const result = await parser.parseFile(content, 'test.ts');
      expect(result.symbols[0].access).toBe('protected');
    });
  });

  describe('decorators', () => {
    it('should extract decorators from classes', async () => {
      const content = `
@Injectable()
export class UserService {
  constructor(private repo: UserRepository) {}
}
`;

      const result = await parser.parseFile(content, 'user.service.ts');

      const service = result.symbols.find(s => s.name === 'UserService');
      expect(service?.decorators).toContain('@Injectable()');
    });
  });

  describe('file-level documentation', () => {
    it('should extract file description from header comments', async () => {
      const content = `
/**
 * User Module
 *
 * This module handles user-related operations including
 * creation, updates, and deletion of user accounts.
 * @module user
 */

export function createUser() {}
`;

      const result = await parser.parseFile(content, 'user.ts');

      expect(result.fileDescription).toContain('User Module');
    });
  });
});
