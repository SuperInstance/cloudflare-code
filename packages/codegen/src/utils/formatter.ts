/**
 * Code Formatter
 * Formats generated code according to language standards
 */

import { Language } from '../types/index.js';

/**
 * Code Formatter class
 */
export class CodeFormatter {
  /**
   * Format code according to language standards
   */
  format(code: string, language: Language): string {
    switch (language) {
      case Language.TypeScript:
      case Language.JavaScript:
        return this.formatJavaScript(code);

      case Language.Python:
        return this.formatPython(code);

      case Language.Go:
        return this.formatGo(code);

      case Language.Rust:
        return this.formatRust(code);

      default:
        return this.formatBasic(code);
    }
  }

  /**
   * Format JavaScript/TypeScript code
   */
  private formatJavaScript(code: string): string {
    // Remove extra whitespace
    let formatted = code.replace(/\s+$/gm, '');

    // Ensure consistent spacing around operators
    formatted = formatted.replace(/([=!<>]=?|[\+\-\*\/%\^&|])/g, ' $1 ');
    formatted = formatted.replace(/\s+/g, ' '); // Collapse multiple spaces

    // Fix spacing after keywords
    const keywords = ['if', 'for', 'while', 'switch', 'catch', 'function'];
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\s*\\(`, 'g');
      formatted = formatted.replace(regex, `${keyword} (`);
    }

    // Ensure consistent indentation (2 spaces)
    const lines = formatted.split('\n');
    const indentedLines = this.fixIndentation(lines, 2);
    formatted = indentedLines.join('\n');

    // Add trailing newline if missing
    if (!formatted.endsWith('\n')) {
      formatted += '\n';
    }

    return formatted;
  }

  /**
   * Format Python code
   */
  private formatPython(code: string): string {
    let formatted = code;

    // Remove trailing whitespace
    formatted = formatted.replace(/\s+$/gm, '');

    // Ensure 4 spaces for indentation
    const lines = formatted.split('\n');
    const indentedLines = this.fixIndentation(lines, 4);
    formatted = indentedLines.join('\n');

    // Ensure spaces around operators
    formatted = formatted.replace(/([=!<>]=?|[\+\-\*\/%])/g, ' $1 ');

    // Fix spacing after keywords
    const keywords = ['if', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'def', 'class'];
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\s*\\(`, 'g');
      formatted = formatted.replace(regex, `${keyword} (`);
    }

    // Add trailing newline
    if (!formatted.endsWith('\n')) {
      formatted += '\n';
    }

    return formatted;
  }

  /**
   * Format Go code
   */
  private formatGo(code: string): string {
    let formatted = code;

    // Go uses tabs for indentation
    const lines = formatted.split('\n');
    const indentedLines = this.fixIndentationWithTabs(lines);
    formatted = indentedLines.join('\n');

    // Remove trailing whitespace
    formatted = formatted.replace(/\s+$/gm, '');

    // Add trailing newline
    if (!formatted.endsWith('\n')) {
      formatted += '\n';
    }

    return formatted;
  }

  /**
   * Format Rust code
   */
  private formatRust(code: string): string {
    let formatted = code;

    // Remove trailing whitespace
    formatted = formatted.replace(/\s+$/gm, '');

    // Ensure 4 spaces for indentation
    const lines = formatted.split('\n');
    const indentedLines = this.fixIndentation(lines, 4);
    formatted = indentedLines.join('\n');

    // Add trailing newline
    if (!formatted.endsWith('\n')) {
      formatted += '\n';
    }

    return formatted;
  }

  /**
   * Basic formatting for any language
   */
  private formatBasic(code: string): string {
    let formatted = code;

    // Remove trailing whitespace
    formatted = formatted.replace(/\s+$/gm, '');

    // Add trailing newline
    if (!formatted.endsWith('\n')) {
      formatted += '\n';
    }

    return formatted;
  }

  /**
   * Fix indentation with spaces
   */
  private fixIndentation(lines: string[], indentSize: number): string[] {
    const result: string[] = [];
    const indentStack: number[] = [0];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        result.push('');
        continue;
      }

      // Check for dedent tokens
      if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')') ||
          trimmed.startsWith('else') || trimmed.startsWith('elif') ||
          trimmed.startsWith('except') || trimmed.startsWith('finally')) {
        indentStack.pop();
      }

      // Apply indentation
      const currentIndent = indentStack[indentStack.length - 1] ?? 0;
      result.push(' '.repeat(currentIndent) + trimmed);

      // Check for indent tokens
      if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(') ||
          trimmed.endsWith(':') || trimmed.endsWith('=>')) {
        indentStack.push(currentIndent + indentSize);
      }
    }

    return result;
  }

  /**
   * Fix indentation with tabs
   */
  private fixIndentationWithTabs(lines: string[]): string[] {
    const result: string[] = [];
    const indentStack: number[] = [0];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        result.push('');
        continue;
      }

      // Check for dedent tokens
      if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
        indentStack.pop();
      }

      // Apply indentation
      const currentIndent = indentStack[indentStack.length - 1] ?? 0;
      result.push('\t'.repeat(currentIndent) + trimmed);

      // Check for indent tokens
      if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
        indentStack.push(currentIndent + 1);
      }
    }

    return result;
  }
}
