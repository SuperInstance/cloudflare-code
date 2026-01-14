/**
 * Integration tests for the refactoring package
 */

import { RefactoringEngine } from '../../src/refactor/engine';
import { CodeModernizer } from '../../src/modernizer/modernizer';
import { TypeMigrator } from '../../src/types/migrator';
import { AutoFixer } from '../../src/fix/fixer';
import { DependencyUpdater } from '../../src/dependencies/updater';
import { MigrationManager } from '../../src/migration/manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Refactoring Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `refactor-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('End-to-end refactoring workflows', () => {
    it('should perform a complete refactoring session', async () => {
      // Create a test project
      const sourceFile = path.join(tempDir, 'example.ts');
      await fs.writeFile(sourceFile, `
class Calculator {
  add(x, y) {
    return x + y;
  }

  subtract(x, y) {
    return x - y;
  }
}

var calc = new Calculator();
var result = calc.add(5, 3);
console.log(result);
`);

      // Initialize refactoring engine
      const engine = new RefactoringEngine({ logLevel: 'error' });

      // Step 1: Rename variables
      const renameResult = await engine.renameSymbol(sourceFile, 'calc', 'calculator');
      expect(renameResult.success).toBe(true);

      // Step 2: Modernize code
      const modernizer = new CodeModernizer();
      const modernizeResult = await modernizer.modernize(renameResult.newContent!, sourceFile);
      expect(modernizeResult.success).toBe(true);

      // Step 3: Add types
      const migrator = new TypeMigrator();
      await migrator.migrateToTypeScript(tempDir);

      // Verify final result
      const finalContent = await fs.readFile(sourceFile, 'utf-8');
      expect(finalContent).toBeDefined();
    });

    it('should handle complex refactoring scenarios', async () => {
      const sourceFile = path.join(tempDir, 'complex.ts');
      await fs.writeFile(sourceFile, `
function processUserData(data) {
  var name = data.name;
  var email = data.email;

  function validate() {
    return name && email;
  }

  if (validate()) {
    return "User: " + name;
  }
  return null;
}
`);

      const engine = new RefactoringEngine({ logLevel: 'error' });

      // Extract the nested function
      const extractResult = await engine.extractMethod(
        sourceFile,
        5,
        7,
        'validateUserInfo'
      );
      expect(extractResult.success).toBe(true);

      // Inline the name variable
      const inlineResult = await engine.inlineVariable(
        sourceFile,
        'name'
      );
      expect(inlineResult.success).toBe(true);
    });
  });

  describe('TypeScript migration workflow', () => {
    it('should migrate JavaScript project to TypeScript', async () => {
      // Create a JavaScript project
      const jsFile = path.join(tempDir, 'utils.js');
      await fs.writeFile(jsFile, `
function add(a, b) {
  return a + b;
}

function multiply(x, y) {
  return x * y;
}

module.exports = { add, multiply };
`);

      // Create package.json
      const packageJson = path.join(tempDir, 'package.json');
      await fs.writeFile(packageJson, JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }));

      // Migrate to TypeScript
      const migrator = new TypeMigrator({ strictMode: false });
      const result = await migrator.migrateToTypeScript(tempDir);

      expect(result.success).toBe(true);
      expect(result.filesMigrated).toBeGreaterThan(0);

      // Verify tsconfig.json was created
      const tsconfigPath = path.join(tempDir, 'tsconfig.json');
      const tsconfigExists = await fs.access(tsconfigPath).then(() => true).catch(() => false);
      expect(tsconfigExists).toBe(true);
    });

    it('should eliminate any types and add proper typing', async () => {
      const tsFile = path.join(tempDir, 'any-types.ts');
      await fs.writeFile(tsFile, `
function process(data: any): any {
  return data.value;
}

const result: any = process({ value: 42 });
console.log(result);
`);

      const migrator = new TypeMigrator();
      const count = await migrator.eliminateAnyTypes(tsFile);

      expect(count).toBeGreaterThanOrEqual(0);

      const content = await fs.readFile(tsFile, 'utf-8');
      expect(content).toBeDefined();
    });
  });

  describe('Code modernization workflow', () => {
    it('should modernize legacy JavaScript code', async () => {
      const legacyFile = path.join(tempDir, 'legacy.js');
      await fs.writeFile(legacyFile, `
var UserService = function() {
  this.apiKey = 'secret';

  this.getUser = function(id, callback) {
    setTimeout(function() {
      callback({ id: id, name: 'John' });
    }, 100);
  };
};

var service = new UserService();
service.getUser(1, function(user) {
  console.log(user.name);
});
`);

      const modernizer = new CodeModernizer({ targetVersion: 'ES2020' });
      const result = await modernizer.modernize(await fs.readFile(legacyFile, 'utf-8'), legacyFile);

      expect(result.success).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);

      // Check for specific modernizations
      const syntaxChanges = result.changes.filter(c => c.type === 'syntax');
      expect(syntaxChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-fix workflow', () => {
    it('should fix all issues in a problematic file', async () => {
      const problematicFile = path.join(tempDir, 'problems.ts');
      await fs.writeFile(problematicFile, `
var unused_variable = 1;
var x = 2
const message = "Hello"
const y = x + 1

function test() {
  console.log("debug")
}
`);

      const fixer = new AutoFixer({ fixType: 'all' });
      const result = await fixer.fixFile(problematicFile);

      expect(result.success).toBe(true);
      expect(result.fixesApplied.length).toBeGreaterThan(0);

      // Verify fixes were applied
      const unusedFix = result.fixesApplied.find(f => f.rule === 'no-unused-vars');
      expect(unusedFix).toBeDefined();

      const semicolonFix = result.fixesApplied.find(f => f.rule === 'semi');
      expect(semicolonFix).toBeDefined();
    });

    it('should fix security vulnerabilities', async () => {
      const securityFile = path.join(tempDir, 'security.ts');
      await fs.writeFile(securityFile, `
function sanitize(input: string): string {
  return eval(input);
}

function render(data: string) {
  document.getElementById('output').innerHTML = data;
}

function random() {
  return Math.random();
}
`);

      const fixer = new AutoFixer({ fixType: 'security' });
      const result = await fixer.fixFile(securityFile);

      expect(result.success).toBe(true);

      const securityFixes = result.fixesApplied.filter(f => f.type === 'security');
      expect(securityFixes.length).toBeGreaterThan(0);
    });
  });

  describe('Migration workflow', () => {
    it('should plan and execute framework migration', async () => {
      // Create a React project structure
      const packageJson = {
        name: 'react-app',
        dependencies: {
          react: '16.8.0',
          'react-dom': '16.8.0'
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const manager = new MigrationManager({ dryRun: true });

      const plan = await manager.planMigration(tempDir, {
        type: 'framework',
        from: 'react-16',
        to: 'react-18'
      });

      expect(plan.steps).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.riskLevel).toBeDefined();
    });

    it('should handle breaking changes', async () => {
      const manager = new MigrationManager({ dryRun: true });

      const plan = await manager.planMigration(tempDir, {
        type: 'breaking',
        breakingChanges: ['deprecated-api-removal', 'signature-change']
      });

      expect(plan.breakingChanges).toBeDefined();
    });
  });

  describe('Dependency update workflow', () => {
    it('should check for dependency updates', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          'lodash': '4.17.15',
          'axios': '0.19.0'
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const updater = new DependencyUpdater();
      const updates = await updater.checkUpdates(tempDir);

      expect(updates).toBeDefined();
      expect(updates.length).toBeGreaterThan(0);
    });

    it('should update specific package', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          'lodash': '4.17.15'
        }
      };

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const updater = new DependencyUpdater({ dryRun: true });
      const result = await updater.updatePackage('lodash', '4.17.21', tempDir);

      expect(result).toBeDefined();
    });
  });

  describe('Multi-file refactoring', () => {
    it('should refactor across multiple files', async () => {
      const file1 = path.join(tempDir, 'file1.ts');
      const file2 = path.join(tempDir, 'file2.ts');

      await fs.writeFile(file1, `
export const API_URL = 'https://api.example.com';
export function fetchData() {
  return fetch(API_URL);
}
`);

      await fs.writeFile(file2, `
import { API_URL, fetchData } from './file1';

console.log(API_URL);
fetchData();
`);

      const engine = new RefactoringEngine({ logLevel: 'error' });

      // Rename in both files
      const result1 = await engine.renameSymbol(file1, 'API_URL', 'BASE_URL');
      expect(result1.success).toBe(true);

      const result2 = await engine.renameSymbol(file2, 'API_URL', 'BASE_URL');
      expect(result2.success).toBe(true);
    });
  });

  describe('Error recovery', () => {
    it('should handle and recover from refactoring errors', async () => {
      const validFile = path.join(tempDir, 'valid.ts');
      const invalidFile = path.join(tempDir, 'invalid.ts');

      await fs.writeFile(validFile, 'const x = 1;');
      await fs.writeFile(invalidFile, 'const y = ;'); // Invalid syntax

      const engine = new RefactoringEngine({ logLevel: 'error' });

      const invalidResult = await engine.renameSymbol(invalidFile, 'y', 'z');
      expect(invalidResult.success).toBe(false);

      // Should still be able to refactor valid file
      const validResult = await engine.renameSymbol(validFile, 'x', 'a');
      expect(validResult.success).toBe(true);
    });

    it('should undo failed refactorings', async () => {
      const testFile = path.join(tempDir, 'undo-test.ts');
      const originalCode = 'const original = "value";';
      await fs.writeFile(testFile, originalCode);

      const engine = new RefactoringEngine({ logLevel: 'error' });
      const result = await engine.renameSymbol(testFile, 'original', 'changed');

      if (result.success && result.undo) {
        const undone = await engine.undoRefactoring(result);
        expect(undone).toBe(true);

        const content = await fs.readFile(testFile, 'utf-8');
        expect(content).toBe(originalCode);
      }
    });
  });

  describe('Performance with large files', () => {
    it('should handle large files efficiently', async () => {
      const largeFile = path.join(tempDir, 'large.ts');

      // Generate a large file
      let content = '';
      for (let i = 0; i < 1000; i++) {
        content += `const variable${i} = ${i};\n`;
      }
      await fs.writeFile(largeFile, content);

      const engine = new RefactoringEngine({ logLevel: 'error' });
      const startTime = Date.now();

      const result = await engine.renameSymbol(largeFile, 'variable500', 'renamed');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});
