/**
 * Unit tests for AutoFixer
 */

import { AutoFixer } from '../../src/fix/fixer';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('AutoFixer', () => {
  let fixer: AutoFixer;
  const fixturesPath = path.join(__dirname, '..', 'fixtures');

  beforeEach(() => {
    fixer = new AutoFixer({
      fixType: 'all',
      autoCommit: false,
      dryRun: false
    });
  });

  describe('fixFile', () => {
    it('should fix unused variables', async () => {
      const code = `
const unused = 1;
const used = 2;
console.log(used);
`;

      const testFile = path.join(fixturesPath, 'fix-unused.ts');
      await fs.writeFile(testFile, code);

      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);
      expect(result.fixesApplied).toBeDefined();

      const unusedFix = result.fixesApplied.find(f => f.rule === 'no-unused-vars');
      expect(unusedFix).toBeDefined();
    });

    it('should fix missing semicolons', async () => {
      const code = `
const x = 1
const y = 2
console.log(x)
`;

      const testFile = path.join(fixturesPath, 'fix-semicolons.ts');
      await fs.writeFile(testFile, code);

      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);
      expect(result.fixesApplied.length).toBeGreaterThan(0);
    });

    it('should fix quote style', async () => {
      const code = `
const message = "Hello";
const greeting = "World";
`;

      const testFile = path.join(fixturesPath, 'fix-quotes.ts');
      await fs.writeFile(testFile, code);

      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);

      const quoteFix = result.fixesApplied.find(f => f.rule === 'quotes');
      expect(quoteFix).toBeDefined();
    });

    it('should detect security issues', async () => {
      const code = `
const result = eval(userInput);
element.innerHTML = userInput;
`;

      const testFile = path.join(fixturesPath, 'fix-security.ts');
      await fs.writeFile(testFile, code);

      fixer = new AutoFixer({ fixType: 'security' });
      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);

      const securityFixes = result.fixesApplied.filter(f => f.type === 'security');
      expect(securityFixes.length).toBeGreaterThan(0);
    });

    it('should detect performance issues', async () => {
      const code = `
const greeting = 'Hello, ' + name + '!';
const items = [];
for (let i = 0; i < array.length; i++) {
  items.push(array[i] * 2);
}
`;

      const testFile = path.join(fixturesPath, 'fix-performance.ts');
      await fs.writeFile(testFile, code);

      fixer = new AutoFixer({ fixType: 'performance' });
      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);

      const perfFixes = result.fixesApplied.filter(f => f.type === 'performance');
      expect(perfFixes.length).toBeGreaterThan(0);
    });

    it('should handle dry run mode', async () => {
      const code = 'var x = 1;';
      const testFile = path.join(fixturesPath, 'fix-dryrun.ts');
      await fs.writeFile(testFile, code);

      fixer = new AutoFixer({ dryRun: true });
      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);

      // Original file should not be modified
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe(code);
    });
  });

  describe('fixProject', () => {
    it('should fix multiple files in a project', async () => {
      const file1 = path.join(fixturesPath, 'project-file1.ts');
      const file2 = path.join(fixturesPath, 'project-file2.ts');

      await fs.writeFile(file1, 'var x = 1;');
      await fs.writeFile(file2, 'var y = 2;');

      const result = await fixer.fixProject(fixturesPath);

      expect(result.success).toBe(true);
      expect(result.fixesApplied.length).toBeGreaterThan(0);
    });

    it('should handle projects with no fixable files', async () => {
      const emptyDir = path.join(fixturesPath, 'empty-project');
      await fs.mkdir(emptyDir, { recursive: true });

      const result = await fixer.fixProject(emptyDir);

      expect(result.success).toBe(true);
      expect(result.fixesApplied.length).toBe(0);
    });
  });

  describe('lint fixes', () => {
    it('should fix no-console warnings', async () => {
      const code = 'console.log("debug");';
      const testFile = path.join(fixturesPath, 'fix-console.ts');
      await fs.writeFile(testFile, code);

      fixer = new AutoFixer({ fixType: 'lint' });
      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);
    });

    it('should fix eqeqeq warnings', async () => {
      const code = `
if (x == null) {
  return;
}
`;

      const testFile = path.join(fixturesPath, 'fix-eqeqeq.ts');
      await fs.writeFile(testFile, code);

      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);
    });
  });

  describe('error fixes', () => {
    it('should detect undefined references', async () => {
      const code = 'console.log(undefinedVariable);';
      const testFile = path.join(fixturesPath, 'fix-undef.ts');
      await fs.writeFile(testFile, code);

      fixer = new AutoFixer({ fixType: 'error' });
      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);

      const undefFix = result.fixesApplied.find(f => f.rule === 'no-undef');
      expect(undefFix).toBeDefined();
      expect(undefFix?.applied).toBe(false); // Can't auto-fix
    });

    it('should detect duplicate parameters', async () => {
      const code = `
function duplicate(x, x) {
  return x;
}
`;

      const testFile = path.join(fixturesPath, 'fix-duplicate.ts');
      await fs.writeFile(testFile, code);

      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);

      const dupeFix = result.fixesApplied.find(f => f.rule === 'no-dupe-args');
      expect(dupeFix).toBeDefined();
    });
  });

  describe('batch fixing', () => {
    it('should respect maxFixes limit', async () => {
      const code = `
var x = 1;
const unused = 2;
const message = "test";
`;

      const testFile = path.join(fixturesPath, 'fix-limit.ts');
      await fs.writeFile(testFile, code);

      fixer = new AutoFixer({ maxFixes: 2 });
      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);
    });

    it('should collect warnings for unfixable issues', async () => {
      const code = 'eval(userInput);';
      const testFile = path.join(fixturesPath, 'fix-warnings.ts');
      await fs.writeFile(testFile, code);

      const result = await fixer.fixFile(testFile);

      expect(result.warnings).toBeDefined();
      expect(result.fixesApplied.some(f => !f.applied)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty files', async () => {
      const code = '';
      const testFile = path.join(fixturesPath, 'fix-empty.ts');
      await fs.writeFile(testFile, code);

      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);
    });

    it('should handle files with only comments', async () => {
      const code = `
// This is a comment
/* Multi-line
   comment */
`;

      const testFile = path.join(fixturesPath, 'fix-comments.ts');
      await fs.writeFile(testFile, code);

      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(true);
    });

    it('should handle syntax errors gracefully', async () => {
      const code = 'const x = ;'; // Invalid syntax
      const testFile = path.join(fixturesPath, 'fix-syntax-error.ts');
      await fs.writeFile(testFile, code);

      const result = await fixer.fixFile(testFile);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  afterEach(async () => {
    try {
      const files = await fs.readdir(fixturesPath);
      for (const file of files) {
        const filePath = path.join(fixturesPath, file);
        try {
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            await fs.unlink(filePath);
          } else if (stat.isDirectory()) {
            await fs.rm(filePath, { recursive: true, force: true });
          }
        } catch {
          // Ignore individual cleanup errors
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });
});
