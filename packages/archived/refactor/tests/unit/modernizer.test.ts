/**
 * Unit tests for CodeModernizer
 */

import { CodeModernizer } from '../../src/modernizer/modernizer';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CodeModernizer', () => {
  let modernizer: CodeModernizer;
  const fixturesPath = path.join(__dirname, '..', 'fixtures');

  beforeEach(() => {
    modernizer = new CodeModernizer({
      targetVersion: 'ES2020',
      preserveComments: true,
      aggressive: false
    });
  });

  describe('modernize', () => {
    it('should convert var to let/const', async () => {
      const code = `
var x = 1;
var y = 2;
x = 3;
`;

      const testFile = path.join(fixturesPath, 'modernize-var.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();

      const syntaxChanges = result.changes.filter(c => c.type === 'syntax');
      expect(syntaxChanges.length).toBeGreaterThan(0);
    });

    it('should convert functions to arrow functions', async () => {
      const code = `
const obj = {
  method: function() {
    return 42;
  }
};
`;

      const testFile = path.join(fixturesPath, 'modernize-arrow.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
      expect(result.changes.some(c => c.description.includes('arrow'))).toBe(true);
    });

    it('should convert string concatenation to template literals', async () => {
      const code = `
const name = 'World';
const greeting = 'Hello, ' + name + '!';
`;

      const testFile = path.join(fixturesPath, 'modernize-template.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
      expect(result.changes.some(c => c.description.includes('template literal'))).toBe(true);
    });

    it('should suggest optional chaining', async () => {
      const code = `
const user = response && response.data && response.data.name;
`;

      const testFile = path.join(fixturesPath, 'modernize-optional.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });

    it('should suggest nullish coalescing', async () => {
      const code = `
const value = input !== null && input !== undefined ? input : 'default';
`;

      const testFile = path.join(fixturesPath, 'modernize-nullish.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });

    it('should convert to destructuring patterns', async () => {
      const code = `
const obj = { a: 1, b: 2 };
const a = obj.a;
const b = obj.b;
`;

      const testFile = path.join(fixturesPath, 'modernize-destructure.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });

    it('should convert callbacks to async/await', async () => {
      const code = `
function fetchData() {
  return promise.then(data => {
    return process(data);
  });
}
`;

      const testFile = path.join(fixturesPath, 'modernize-async.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });

    it('should use object spread instead of Object.assign', async () => {
      const code = `
const obj = Object.assign({}, base, { extra: true });
`;

      const testFile = path.join(fixturesPath, 'modernize-spread.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });

    it('should handle dry run mode', async () => {
      const code = 'var x = 1;';
      const testFile = path.join(fixturesPath, 'modernize-dryrun.ts');

      modernizer = new CodeModernizer({ dryRun: true });
      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
      expect(result.newContent).toBe(code); // Should not modify in dry run
    });
  });

  describe('API modernization', () => {
    it('should detect deprecated APIs', async () => {
      const code = `
fs.exists(path, (exists) => {
  console.log(exists);
});
`;

      const testFile = path.join(fixturesPath, 'modernize-deprecated.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
      const apiChanges = result.changes.filter(c => c.type === 'api' || c.type === 'deprecation');
      expect(apiChanges.length).toBeGreaterThan(0);
    });

    it('should modernize callback APIs to promises', async () => {
      const code = `
fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) throw err;
  console.log(data);
});
`;

      const testFile = path.join(fixturesPath, 'modernize-promise.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Pattern updates', () => {
    it('should convert for loops to for...of', async () => {
      const code = `
const arr = [1, 2, 3];
for (let i = 0; i < arr.length; i++) {
  console.log(arr[i]);
}
`;

      const testFile = path.join(fixturesPath, 'modernize-forof.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
      const patternChanges = result.changes.filter(c => c.type === 'pattern');
      expect(patternChanges.some(c => c.description.includes('for...of'))).toBe(true);
    });

    it('should suggest array methods over manual loops', async () => {
      const code = `
const arr = [1, 2, 3];
const doubled = [];
for (let i = 0; i < arr.length; i++) {
  doubled.push(arr[i] * 2);
}
`;

      const testFile = path.join(fixturesPath, 'modernize-array-method.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });
  });

  describe('Feature adoption', () => {
    it('should suggest private class fields', async () => {
      const code = `
class Example {
  constructor() {
    this._private = 'value';
  }
}
`;

      const testFile = path.join(fixturesPath, 'modernize-private.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
      const featureChanges = result.changes.filter(c => c.type === 'feature');
      expect(featureChanges.some(c => c.description.includes('private'))).toBe(true);
    });

    it('should suggest class properties', async () => {
      const code = `
class Example {
  constructor() {
    this.value = 42;
  }
}
`;

      const testFile = path.join(fixturesPath, 'modernize-class-prop.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });

    it('should suggest numeric separators', async () => {
      const code = 'const billion = 1000000000;';
      const testFile = path.join(fixturesPath, 'modernize-numeric.ts');

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });

    it('should use logical assignment operators', async () => {
      const code = `
let x = null;
if (!x) {
  x = 'default';
}
`;

      const testFile = path.join(fixturesPath, 'modernize-logical.ts');
      await fs.writeFile(testFile, code);

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully', async () => {
      const code = 'const x = ;'; // Invalid syntax
      const testFile = path.join(fixturesPath, 'modernize-error.ts');

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should continue with warnings for non-critical issues', async () => {
      const code = 'const x = 1;';
      const testFile = path.join(fixturesPath, 'modernize-warning.ts');

      const result = await modernizer.modernize(code, testFile);

      expect(result.success).toBe(true);
    });
  });

  afterEach(async () => {
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
