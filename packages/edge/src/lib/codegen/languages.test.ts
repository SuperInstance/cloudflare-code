/**
 * Language Generator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getLanguageGenerator,
  getLanguageConfig,
  TypeScriptGenerator,
  PythonGenerator,
  GoGenerator,
  RustGenerator,
  JavaGenerator,
} from './languages';
import type { SupportedLanguage } from '../types';

describe('Language Generators', () => {
  describe('getLanguageGenerator', () => {
    it('should return TypeScript generator', () => {
      const generator = getLanguageGenerator('typescript');
      expect(generator).toBeInstanceOf(TypeScriptGenerator);
    });

    it('should return Python generator', () => {
      const generator = getLanguageGenerator('python');
      expect(generator).toBeInstanceOf(PythonGenerator);
    });

    it('should return Go generator', () => {
      const generator = getLanguageGenerator('go');
      expect(generator).toBeInstanceOf(GoGenerator);
    });

    it('should return Rust generator', () => {
      const generator = getLanguageGenerator('rust');
      expect(generator).toBeInstanceOf(RustGenerator);
    });

    it('should return Java generator', () => {
      const generator = getLanguageGenerator('java');
      expect(generator).toBeInstanceOf(JavaGenerator);
    });

    it('should return null for unsupported language', () => {
      const generator = getLanguageGenerator('scala' as SupportedLanguage);
      expect(generator).toBeNull();
    });
  });

  describe('getLanguageConfig', () => {
    it('should return TypeScript config', () => {
      const config = getLanguageConfig('typescript');
      expect(config).toBeDefined();
      expect(config?.language).toBe('typescript');
      expect(config?.extensions).toContain('.ts');
      expect(config?.features.staticTyping).toBe(true);
      expect(config?.features.generics).toBe(true);
    });

    it('should return Python config', () => {
      const config = getLanguageConfig('python');
      expect(config).toBeDefined();
      expect(config?.language).toBe('python');
      expect(config?.extensions).toContain('.py');
      expect(config?.features.decorators).toBe(true);
    });

    it('should return Go config', () => {
      const config = getLanguageConfig('go');
      expect(config).toBeDefined();
      expect(config?.indentation).toBe('tabs');
      expect(config?.features.modules).toBe(true);
    });

    it('should return Rust config', () => {
      const config = getLanguageConfig('rust');
      expect(config).toBeDefined();
      expect(config?.features.nullSafety).toBe(true);
      expect(config?.features.macros).toBe(true);
    });
  });

  describe('TypeScriptGenerator', () => {
    let generator: TypeScriptGenerator;

    beforeEach(() => {
      generator = new TypeScriptGenerator();
    });

    it('should generate function', () => {
      const code = generator.generateFunction(
        'add',
        [
          { name: 'a', type: 'number' },
          { name: 'b', type: 'number' },
        ],
        'return a + b;',
        { returnType: 'number' }
      );

      expect(code).toContain('function add');
      expect(code).toContain('a: number');
      expect(code).toContain('b: number');
      expect(code).toContain('return a + b;');
      expect(code).toContain('number');
    });

    it('should generate async function', () => {
      const code = generator.generateFunction(
        'fetch',
        [{ name: 'url', type: 'string' }],
        'const res = await fetch(url); return res.json();',
        { async: true, returnType: 'Promise<any>' }
      );

      expect(code).toContain('async function');
      expect(code).toContain('Promise<any>');
    });

    it('should generate class', () => {
      const code = generator.generateClass(
        'User',
        [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string' },
        ],
        [],
        {}
      );

      expect(code).toContain('class User');
      expect(code).toContain('id: string');
      expect(code).toContain('name: string');
    });

    it('should generate interface', () => {
      const code = generator.generateInterface(
        'User',
        [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string', optional: true },
        ],
        {}
      );

      expect(code).toContain('interface User');
      expect(code).toContain('id: string');
      expect(code).toContain('name?: string');
    });
  });

  describe('PythonGenerator', () => {
    let generator: PythonGenerator;

    beforeEach(() => {
      generator = new PythonGenerator();
    });

    it('should generate function', () => {
      const code = generator.generateFunction(
        'add',
        [
          { name: 'a', type: 'int' },
          { name: 'b', type: 'int' },
        ],
        'return a + b',
        { returnType: 'int' }
      );

      expect(code).toContain('def add');
      expect(code).toContain('a: int');
      expect(code).toContain('b: int');
      expect(code).toContain('-> int');
    });

    it('should generate async function', () => {
      const code = generator.generateFunction(
        'fetch',
        [{ name: 'url', type: 'str' }],
        'return await aiohttp.get(url)',
        { async: true, returnType: 'Response' }
      );

      expect(code).toContain('async def');
    });

    it('should generate class', () => {
      const code = generator.generateClass(
        'User',
        [
          { name: 'id', type: 'str' },
          { name: 'name', type: 'str' },
        ],
        [],
        {}
      );

      expect(code).toContain('class User:');
      expect(code).toContain('id: str');
      expect(code).toContain('name: str');
    });
  });

  describe('GoGenerator', () => {
    let generator: GoGenerator;

    beforeEach(() => {
      generator = new GoGenerator();
    });

    it('should generate function', () => {
      const code = generator.generateFunction(
        'Add',
        [
          { name: 'a', type: 'int' },
          { name: 'b', type: 'int' },
        ],
        'return a + b',
        { returnType: 'int' }
      );

      expect(code).toContain('func Add');
      expect(code).toContain('a int');
      expect(code).toContain('b int');
    });

    it('should generate struct', () => {
      const code = generator.generateClass(
        'User',
        [
          { name: 'ID', type: 'string' },
          { name: 'Name', type: 'string' },
        ],
        [],
        {}
      );

      expect(code).toContain('type User struct');
      expect(code).toContain('ID string');
      expect(code).toContain('Name string');
    });
  });

  describe('RustGenerator', () => {
    let generator: RustGenerator;

    beforeEach(() => {
      generator = new RustGenerator();
    });

    it('should generate function', () => {
      const code = generator.generateFunction(
        'add',
        [
          { name: 'a', type: 'i32' },
          { name: 'b', type: 'i32' },
        ],
        'a + b',
        { returnType: 'i32' }
      );

      expect(code).toContain('fn add');
      expect(code).toContain('a: i32');
      expect(code).toContain('b: i32');
      expect(code).toContain('-> i32');
    });

    it('should generate struct', () => {
      const code = generator.generateClass(
        'User',
        [
          { name: 'id', type: 'String' },
          { name: 'name', type: 'String' },
        ],
        [],
        {}
      );

      expect(code).toContain('pub struct User');
      expect(code).toContain('id: String');
      expect(code).toContain('name: String');
    });
  });

  describe('JavaGenerator', () => {
    let generator: JavaGenerator;

    beforeEach(() => {
      generator = new JavaGenerator();
    });

    it('should generate method', () => {
      const code = generator.generateFunction(
        'add',
        [
          { name: 'a', type: 'int' },
          { name: 'b', type: 'int' },
        ],
        'return a + b;',
        { returnType: 'int', modifiers: 'public' }
      );

      expect(code).toContain('public int add');
      expect(code).toContain('int a');
      expect(code).toContain('int b');
    });

    it('should generate class', () => {
      const code = generator.generateClass(
        'User',
        [
          { name: 'id', type: 'String' },
          { name: 'name', type: 'String' },
        ],
        [],
        {}
      );

      expect(code).toContain('public class User');
      expect(code).toContain('private String id');
      expect(code).toContain('private String name');
    });
  });
});
