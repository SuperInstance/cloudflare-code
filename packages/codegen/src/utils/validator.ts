/**
 * Code Validator
 * Validates generated code for syntax errors and best practices
 */

import { Language, ValidationResult, ValidationError, ValidationWarning } from '../types/index.js';

/**
 * Code Validator class
 */
export class CodeValidator {
  /**
   * Validate code for syntax errors
   */
  validate(code: string, language: Language): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    switch (language) {
      case Language.TypeScript:
      case Language.JavaScript:
        this.validateJavaScript(code, errors, warnings);
        break;

      case Language.Python:
        this.validatePython(code, errors, warnings);
        break;

      case Language.Go:
        this.validateGo(code, errors, warnings);
        break;

      case Language.Rust:
        this.validateRust(code, errors, warnings);
        break;

      default:
        // Basic validation for other languages
        this.validateBasic(code, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate JavaScript/TypeScript code
   */
  private validateJavaScript(
    code: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check for basic syntax issues
    const issues = this.findBasicSyntaxIssues(code);

    for (const issue of issues) {
      if (issue.severity === 'error') {
        errors.push({
          path: 'unknown',
          message: issue.message,
          code: issue.code,
          severity: 'error'
        });
      } else {
        warnings.push({
          path: 'unknown',
          message: issue.message,
          code: issue.code,
          severity: 'warning'
        });
      }
    }

    // Check for TypeScript specific issues
    if (code.includes('interface ') || code.includes(': ')) {
      this.validateTypeScript(code, errors, warnings);
    }
  }

  /**
   * Validate TypeScript code
   */
  private validateTypeScript(
    code: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check for 'any' types
    const anyPattern = /:\s*any\b/g;
    let match;
    while ((match = anyPattern.exec(code)) !== null) {
      warnings.push({
        path: 'unknown',
        message: 'Using "any" type reduces type safety',
        code: 'NO_ANY',
        severity: 'warning'
      });
    }

    // Check for missing return types on functions
    const functionPattern = /function\s+\w+\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{/g;
    while ((match = functionPattern.exec(code)) !== null) {
      const hasReturnType = match[0].includes(':');
      if (!hasReturnType) {
        warnings.push({
          path: 'unknown',
          message: 'Function is missing return type annotation',
          code: 'MISSING_RETURN_TYPE',
          severity: 'warning'
        });
      }
    }
  }

  /**
   * Validate Python code
   */
  private validatePython(
    code: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const lines = code.split('\n');

    // Check for indentation consistency
    const indentSizes = new Set<number>();
    for (const line of lines) {
      const match = line.match(/^(\s*)/);
      if (match && match[1].length > 0) {
        indentSizes.add(match[1].length);
      }
    }

    // Python should have consistent indentation (multiples of 2 or 4)
    const indentArray = Array.from(indentSizes).sort((a, b) => a - b);
    for (let i = 1; i < indentArray.length; i++) {
      if (indentArray[i] % indentArray[0] !== 0) {
        errors.push({
          path: 'unknown',
          message: 'Inconsistent indentation detected',
          code: 'INCONSISTENT_INDENTATION',
          severity: 'error'
        });
        break;
      }
    }

    // Check for bare except
    const bareExceptPattern = /except\s*:/g;
    let match;
    while ((match = bareExceptPattern.exec(code)) !== null) {
      warnings.push({
        path: 'unknown',
        message: 'Bare except clause should be avoided',
        code: 'BARE_EXCEPT',
        severity: 'warning'
      });
    }
  }

  /**
   * Validate Go code
   */
  private validateGo(
    code: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check for exported functions without comments
    const exportedFunctionPattern = /^func\s+([A-Z]\w+)\s*\(/gm;
    let match;
    while ((match = exportedFunctionPattern.exec(code)) !== null) {
      const funcName = match[1];
      const startPos = match.index;
      const prevLines = code.substring(0, startPos).split('\n');
      const immediatePrevLine = prevLines[prevLines.length - 1];

      if (!immediatePrevLine.trim().startsWith('//')) {
        warnings.push({
          path: 'unknown',
          message: `Exported function "${funcName}" should have a comment`,
          code: 'MISSING_COMMENT',
          severity: 'warning'
        });
      }
    }
  }

  /**
   * Validate Rust code
   */
  private validateRust(
    code: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check for unwrap() calls
    const unwrapPattern = /\.unwrap\(\)/g;
    let match;
    while ((match = unwrapPattern.exec(code)) !== null) {
      warnings.push({
        path: 'unknown',
        message: 'Using unwrap() can cause panics, consider proper error handling',
        code: 'UNWRAP_USAGE',
        severity: 'warning'
      });
    }

    // Check for expect() calls
    const expectPattern = /\.expect\(/g;
    while ((match = expectPattern.exec(code)) !== null) {
      warnings.push({
        path: 'unknown',
        message: 'Using expect() can cause panics in production',
        code: 'EXPECT_USAGE',
        severity: 'warning'
      });
    }
  }

  /**
   * Basic validation for any language
   */
  private validateBasic(
    code: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const issues = this.findBasicSyntaxIssues(code);

    for (const issue of issues) {
      if (issue.severity === 'error') {
        errors.push({
          path: 'unknown',
          message: issue.message,
          code: issue.code,
          severity: 'error'
        });
      } else {
        warnings.push({
          path: 'unknown',
          message: issue.message,
          code: issue.code,
          severity: 'warning'
        });
      }
    }
  }

  /**
   * Find basic syntax issues
   */
  private findBasicSyntaxIssues(code: string): Array<{
    code: string;
    message: string;
    severity: 'error' | 'warning';
  }> {
    const issues: Array<{ code: string; message: string; severity: 'error' | 'warning' }> = [];

    // Check for mismatched brackets
    const brackets = { '(': ')', '[': ']', '{': '}' };
    const stack: string[] = [];

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      if (char in brackets) {
        stack.push(char);
      } else if (Object.values(brackets).includes(char)) {
        const last = stack.pop();
        if (!last || brackets[last as keyof typeof brackets] !== char) {
          issues.push({
            code: 'MISMATCHED_BRACKETS',
            message: `Mismatched bracket at position ${i}`,
            severity: 'error'
          });
        }
      }
    }

    if (stack.length > 0) {
      issues.push({
        code: 'UNCLOSED_BRACKETS',
        message: `${stack.length} unclosed bracket(s)`,
        severity: 'error'
      });
    }

    // Check for very long lines
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 120) {
        issues.push({
          code: 'LONG_LINE',
          message: `Line ${i + 1} is ${lines[i].length} characters (consider splitting)`,
          severity: 'warning'
        });
      }
    }

    return issues;
  }
}
