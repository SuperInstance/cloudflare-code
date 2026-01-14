/**
 * Unit tests for utility modules
 */

import { describe, it, expect } from 'vitest';
import { CodeValidator } from '../../src/utils/validator';
import { CodeFormatter } from '../../src/utils/formatter';
import { Language } from '../../src/types/index';

describe('CodeValidator', () => {
  let validator: CodeValidator;

  beforeEach(() => {
    validator = new CodeValidator();
  });

  describe('validate TypeScript', () => {
    it('should validate valid TypeScript code', () => {
      const code = `
function add(a: number, b: number): number {
  return a + b;
}
`;
      const result = validator.validate(code, Language.TypeScript);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect mismatched brackets', () => {
      const code = `
function test() {
  return value;
`;
      const result = validator.validate(code, Language.TypeScript);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about using "any" type', () => {
      const code = `
function process(data: any): void {
  console.log(data);
}
`;
      const result = validator.validate(code, Language.TypeScript);

      expect(result.warnings.some(w => w.code === 'NO_ANY')).toBe(true);
    });

    it('should warn about missing return types', () => {
      const code = `
function add(a, b) {
  return a + b;
}
`;
      const result = validator.validate(code, Language.TypeScript);

      expect(result.warnings.some(w => w.code === 'MISSING_RETURN_TYPE')).toBe(true);
    });
  });

  describe('validate Python', () => {
    it('should validate valid Python code', () => {
      const code = `
def add(a: int, b: int) -> int:
    return a + b
`;
      const result = validator.validate(code, Language.Python);

      expect(result.valid).toBe(true);
    });

    it('should warn about bare except', () => {
      const code = `
try:
    risky_operation()
except:
    pass
`;
      const result = validator.validate(code, Language.Python);

      expect(result.warnings.some(w => w.code === 'BARE_EXCEPT')).toBe(true);
    });
  });

  describe('validate Go', () => {
    it('should warn about missing comments for exported functions', () => {
      const code = `
func ExportedFunction() string {
    return "hello"
}
`;
      const result = validator.validate(code, Language.Go);

      expect(result.warnings.some(w => w.code === 'MISSING_COMMENT')).toBe(true);
    });
  });

  describe('validate Rust', () => {
    it('should warn about unwrap usage', () => {
      const code = `
fn get_value() -> String {
    let result = some_operation().unwrap();
    result
}
`;
      const result = validator.validate(code, Language.Rust);

      expect(result.warnings.some(w => w.code === 'UNWRAP_USAGE')).toBe(true);
    });

    it('should warn about expect usage', () => {
      const code = `
fn get_value() -> String {
    let result = some_operation().expect("Failed");
    result
}
`;
      const result = validator.validate(code, Language.Rust);

      expect(result.warnings.some(w => w.code === 'EXPECT_USAGE')).toBe(true);
    });
  });

  describe('detect long lines', () => {
    it('should warn about lines longer than 120 characters', () => {
      const code = `
const veryLongVariableName = "This is a very long string that exceeds the recommended line length for code files";
`;
      const result = validator.validate(code, Language.TypeScript);

      expect(result.warnings.some(w => w.code === 'LONG_LINE')).toBe(true);
    });
  });
});

describe('CodeFormatter', () => {
  let formatter: CodeFormatter;

  beforeEach(() => {
    formatter = new CodeFormatter();
  });

  describe('format TypeScript', () => {
    it('should format TypeScript code', () => {
      const code = `function add(a,b){return a+b;}`;
      const formatted = formatter.format(code, Language.TypeScript);

      expect(formatted).toContain('function add(a, b)');
      expect(formatted).toContain('\n');
    });

    it('should add trailing newline', () => {
      const code = `function test() {}`;
      const formatted = formatter.format(code, Language.TypeScript);

      expect(formatted.endsWith('\n')).toBe(true);
    });
  });

  describe('format Python', () => {
    it('should format Python code', () => {
      const code = `def add(a,b):return a+b`;
      const formatted = formatter.format(code, Language.Python);

      expect(formatted).toContain('def add(a, b):');
    });

    it('should use 4 spaces for indentation', () => {
      const code = `def test():\nreturn "hello"`;
      const formatted = formatter.format(code, Language.Python);

      expect(formatted).toContain('    return');
    });
  });

  describe('format Go', () => {
    it('should use tabs for Go code', () => {
      const code = `func test() string {\nreturn "hello"\n}`;
      const formatted = formatter.format(code, Language.Go);

      expect(formatted).toContain('\treturn');
    });
  });

  describe('format Rust', () => {
    it('should format Rust code', () => {
      const code = `fn test()->String{\n"hello".to_string()\n}`;
      const formatted = formatter.format(code, Language.Rust);

      expect(formatted).toContain('\n');
    });
  });
});
