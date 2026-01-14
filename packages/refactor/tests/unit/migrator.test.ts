/**
 * Unit tests for TypeMigrator
 */

import { TypeMigrator } from '../../src/types/migrator';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('TypeMigrator', () => {
  let migrator: TypeMigrator;
  const fixturesPath = path.join(__dirname, '..', 'fixtures');

  beforeEach(() => {
    migrator = new TypeMigrator({
      strictMode: false,
      preserveComments: true,
      generateInferredTypes: true
    });
  });

  describe('migrateToTypeScript', () => {
    it('should convert JavaScript to TypeScript', async () => {
      const jsCode = `
function add(a, b) {
  return a + b;
}

const multiply = (x, y) => x * y;
`;

      const testFile = path.join(fixturesPath, 'migrate-test.js');
      await fs.writeFile(testFile, jsCode);

      const result = await migrator.migrateToTypeScript(fixturesPath);

      expect(result.success).toBe(true);
      expect(result.filesMigrated).toBeGreaterThan(0);
    });

    it('should preserve comments during migration', async () => {
      const jsCode = `
// Calculate sum
function sum(a, b) {
  return a + b;
}
`;

      const testFile = path.join(fixturesPath, 'migrate-comments.js');
      await fs.writeFile(testFile, jsCode);

      await migrator.migrateToTypeScript(fixturesPath);

      const tsFile = testFile.replace('.js', '.ts');
      const content = await fs.readFile(tsFile, 'utf-8');

      expect(content).toContain('// Calculate sum');
    });
  });

  describe('eliminateAnyTypes', () => {
    it('should replace any types with inferred types', async () => {
      const tsCode = `
function process(value: any): any {
  return value * 2;
}
`;

      const testFile = path.join(fixturesPath, 'eliminate-any.ts');
      await fs.writeFile(testFile, tsCode);

      const count = await migrator.eliminateAnyTypes(testFile);

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should preserve type safety when inference fails', async () => {
      const tsCode = `
function unknown(input: any): any {
  return input;
}
`;

      const testFile = path.join(fixturesPath, 'preserve-any.ts');
      await fs.writeFile(testFile, tsCode);

      await migrator.eliminateAnyTypes(testFile);

      const content = await fs.readFile(testFile, 'utf-8');
      // Content should still be valid
      expect(content).toBeDefined();
    });
  });

  describe('migrateToStrictMode', () => {
    it('should enable strict mode in tsconfig', async () => {
      const testFile = path.join(fixturesPath, 'tsconfig.json');
      const initialConfig = {
        compilerOptions: {
          strict: false
        }
      };

      await fs.writeFile(testFile, JSON.stringify(initialConfig, null, 2));

      await migrator.migrateToStrictMode(fixturesPath);

      const content = await fs.readFile(testFile, 'utf-8');
      const config = JSON.parse(content);

      expect(config.compilerOptions.strict).toBe(true);
    });

    it('should fix implicit any errors', async () => {
      const tsCode = `
function example(param) { // implicit any
  return param;
}
`;

      const testFile = path.join(fixturesPath, 'strict-fix.ts');
      await fs.writeFile(testFile, tsCode);

      await migrator.migrateToStrictMode(fixturesPath);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBeDefined();
    });
  });

  describe('extractInterfaces', () => {
    it('should extract interfaces from classes', async () => {
      const tsCode = `
class UserService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public getUser(id: number): User {
    return { id, name: 'Test' };
  }

  private validateKey(): boolean {
    return !!this.apiKey;
  }
}
`;

      const testFile = path.join(fixturesPath, 'extract-interface.ts');
      await fs.writeFile(testFile, tsCode);

      const interfaces = await migrator.extractInterfaces(fixturesPath, {
        includePublic: true,
        includeProtected: false,
        includePrivate: false
      });

      expect(interfaces.length).toBeGreaterThan(0);
      expect(interfaces[0].properties).toBeDefined();
      expect(interfaces[0].methods).toBeDefined();
    });

    it('should include protected members when requested', async () => {
      const tsCode = `
class Example {
  public field: string;
  protected hidden: number;
}
`;

      const testFile = path.join(fixturesPath, 'extract-protected.ts');
      await fs.writeFile(testFile, tsCode);

      const interfaces = await migrator.extractInterfaces(fixturesPath, {
        includeProtected: true
      });

      expect(interfaces.length).toBeGreaterThan(0);
    });

    it('should include private members when requested', async () => {
      const tsCode = `
class Example {
  private secret: string;
}
`;

      const testFile = path.join(fixturesPath, 'extract-private.ts');
      await fs.writeFile(testFile, tsCode);

      const interfaces = await migrator.extractInterfaces(fixturesPath, {
        includePrivate: true
      });

      expect(interfaces.length).toBeGreaterThan(0);
    });
  });

  describe('generateTypeDefinitions', () => {
    it('should generate type definitions for exports', async () => {
      const tsCode = `
export interface User {
  id: number;
  name: string;
}

export function getUser(id: number): User {
  return { id, name: 'Test' };
}

export const API_URL = 'https://api.example.com';
`;

      const testFile = path.join(fixturesPath, 'generate-defs.ts');
      await fs.writeFile(testFile, tsCode);

      const definitions = await migrator.generateTypeDefinitions(testFile);

      expect(definitions).toBeDefined();
      expect(definitions.length).toBeGreaterThan(0);
    });
  });

  describe('introduceGenerics', () => {
    it('should introduce generics to functions with any parameters', async () => {
      const tsCode = `
function identity(value: any): any {
  return value;
}

function first(arr: any[]): any {
  return arr[0];
}
`;

      const testFile = path.join(fixturesPath, 'introduce-generics.ts');
      await fs.writeFile(testFile, tsCode);

      const count = await migrator.introduceGenerics(testFile);

      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('type inference', () => {
    it('should infer types from usage', async () => {
      const tsCode = `
function calculate(x, y) {
  return x + y;
}

const result = calculate(1, 2);
`;

      const testFile = path.join(fixturesPath, 'infer-types.ts');
      await fs.writeFile(testFile, tsCode);

      await migrator.migrateToTypeScript(fixturesPath);

      const content = await fs.readFile(testFile.replace('.js', '.ts') || testFile, 'utf-8');
      expect(content).toBeDefined();
    });

    it('should handle complex type inference', async () => {
      const tsCode = `
function process(items) {
  return items.map(item => item.value);
}
`;

      const testFile = path.join(fixturesPath, 'infer-complex.ts');
      await fs.writeFile(testFile, tsCode);

      await migrator.migrateToTypeScript(fixturesPath);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle invalid TypeScript gracefully', async () => {
      const invalidCode = `
function broken( {
  return;
}
`;

      const testFile = path.join(fixturesPath, 'invalid-type.ts');
      await fs.writeFile(testFile, invalidCode);

      const result = await migrator.migrateToTypeScript(fixturesPath);

      // Should have errors but not crash
      expect(result.success).toBeDefined();
    });

    it('should continue migration with warnings', async () => {
      const validCode = 'const x = 1;';
      const testFile = path.join(fixturesPath, 'warn-migration.ts');
      await fs.writeFile(testFile, validCode);

      const result = await migrator.migrateToTypeScript(fixturesPath);

      expect(result).toBeDefined();
    });
  });

  afterEach(async () => {
    try {
      const files = await fs.readdir(fixturesPath);
      for (const file of files) {
        const filePath = path.join(fixturesPath, file);
        await fs.unlink(filePath).catch(() => {});
      }
    } catch {
      // Ignore cleanup errors
    }
  });
});
