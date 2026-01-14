/**
 * Style Checker - Checks code style, formatting, and conventions
 */

import { Issue, Severity, Category, FileInfo, Language } from '../types/index.js';

// ============================================================================
// Style Checker Options
// ============================================================================

interface StyleCheckerOptions {
  maxLineLength?: number;
  indentSize?: number;
  indentStyle?: 'spaces' | 'tabs';
  quoteStyle?: 'single' | 'double' | 'any';
  semicolons?: boolean;
  trailingCommas?: boolean;
  checkNamingConventions?: boolean;
  checkImportOrder?: boolean;
}

const DEFAULT_OPTIONS: StyleCheckerOptions = {
  maxLineLength: 120,
  indentSize: 2,
  indentStyle: 'spaces',
  quoteStyle: 'single',
  semicolons: true,
  trailingCommas: true,
  checkNamingConventions: true,
  checkImportOrder: true,
};

// ============================================================================
// Style Checker
// ============================================================================

export class StyleChecker {
  private options: StyleCheckerOptions;

  constructor(options: StyleCheckerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ========================================================================
  // Main Check Methods
  // ========================================================================

  /**
   * Check style of file
   */
  async checkFile(filePath: string, content: string, fileInfo: FileInfo): Promise<Issue[]> {
    const issues: Issue[] = [];

    issues.push(...this.checkLineLength(filePath, content));
    issues.push(...this.checkIndentation(filePath, content));
    issues.push(...this.checkQuotes(filePath, content, fileInfo));
    issues.push(...this.checkSemicolons(filePath, content, fileInfo));
    issues.push(...this.checkTrailingWhitespace(filePath, content));
    issues.push(...this.checkTrailingCommas(filePath, content, fileInfo));
    issues.push(...this.checkNamingConventions(filePath, content, fileInfo));
    issues.push(...this.checkImportOrder(filePath, content, fileInfo));
    issues.push(...this.checkBlankLines(filePath, content));
    issues.push(...this.checkSpacing(filePath, content));
    issues.push(...this.checkBraces(filePath, content, fileInfo));
    issues.push(...this.checkComments(filePath, content, fileInfo));

    return issues;
  }

  // ========================================================================
  // Style Checks
  // ========================================================================

  private checkLineLength(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > this.options.maxLineLength!) {
        issues.push(this.createIssue(
          'line-too-long',
          'Line Too Long',
          `Line exceeds maximum length of ${this.options.maxLineLength} characters (${line.length} characters)`,
          filePath,
          i + 1,
          line.search(/\S|$/) + 1,
          'info',
          'Break the line or refactor to reduce length'
        ));
      }
    }

    return issues;
  }

  private checkIndentation(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().length === 0) continue;

      const indentMatch = line.match(/^(\s*)/);
      if (!indentMatch) continue;

      const indent = indentMatch[1];
      const usesTabs = indent.includes('\t');

      if (this.options.indentStyle === 'spaces' && usesTabs) {
        issues.push(this.createIssue(
          'mixed-indentation',
          'Mixed Indentation',
          'File uses tabs but spaces are preferred',
          filePath,
          i + 1,
          1,
          'hint',
          'Convert tabs to spaces'
        ));
      }

      // Check indent size
      const spaces = indent.match(/\s/g)?.length || 0;
      if (spaces > 0 && spaces % this.options.indentSize! !== 0 && !usesTabs) {
        issues.push(this.createIssue(
          'indent-size',
          'Incorrect Indent Size',
          `Indentation is ${spaces} spaces but should be multiple of ${this.options.indentSize}`,
          filePath,
          i + 1,
          1,
          'hint',
          `Use ${this.options.indentSize} spaces per indent level`
        ));
      }
    }

    return issues;
  }

  private checkQuotes(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    if (this.options.quoteStyle === 'any') return issues;

    const preferredQuote = this.options.quoteStyle === 'single' ? "'" : '"';
    const otherQuote = this.options.quoteStyle === 'single' ? '"' : "'";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip strings that use the other quote for escaping
      const matches = line.match(new RegExp(`${otherQuote}[^${otherQuote}]*${otherQuote}`, 'g'));

      if (matches) {
        for (const match of matches) {
          // Skip if contains the preferred quote (would need escaping)
          if (!match.includes(preferredQuote)) {
            issues.push(this.createIssue(
              'quote-style',
              'Incorrect Quote Style',
              `Use ${this.options.quoteStyle} quotes instead of ${this.options.quoteStyle === 'single' ? 'double' : 'single'}`,
              filePath,
              i + 1,
              line.indexOf(match) + 1,
              'hint',
              `Replace with ${preferredQuote}${match.substring(1, match.length - 1)}${preferredQuote}`
            ));
          }
        }
      }
    }

    return issues;
  }

  private checkSemicolons(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    if (fileInfo.language !== 'typescript' && fileInfo.language !== 'javascript') {
      return issues;
    }

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Skip empty lines, comments, and lines ending with braces
      if (!trimmed || trimmed.startsWith('//') || trimmed.endsWith('{') || trimmed.endsWith('}')) {
        continue;
      }

      // Check for statements without semicolons
      if (this.options.semicolons) {
        const needsSemicolon =
          /^(?!.*=>)(?!.*for\s*\()(?!.*if\s*\()(?!.*while\s*\()(?!.*switch\s*\().*[a-zA-Z0-9_\]$]\s*$/.test(trimmed);

        if (needsSemicolon && !trimmed.endsWith(';') && !trimmed.endsWith(',')) {
          issues.push(this.createIssue(
            'missing-semicolon',
            'Missing Semicolon',
            'Statements should end with semicolons',
            filePath,
            i + 1,
            lines[i].search(/\S|$/) + 1,
            'hint',
            'Add semicolon at end of statement'
          ));
        }
      }
    }

    return issues;
  }

  private checkTrailingWhitespace(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line !== line.trimEnd()) {
        issues.push(this.createIssue(
          'trailing-whitespace',
          'Trailing Whitespace',
          'Line has trailing whitespace',
          filePath,
          i + 1,
          line.trimEnd().length + 1,
          'hint',
          'Remove trailing whitespace'
        ));
      }
    }

    return issues;
  }

  private checkTrailingCommas(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];

    if (!this.options.trailingCommas) return issues;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for multiline arrays/objects without trailing comma
      if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && !trimmed.endsWith(']') && !trimmed.endsWith('}')) {
        // Look ahead for closing bracket
        let j = i + 1;
        let foundClosing = false;
        let hasTrailingComma = false;

        while (j < lines.length && j < i + 50) {
          const currentLine = lines[j];
          if (currentLine.includes(']') || currentLine.includes('}')) {
            foundClosing = true;
            const prevLine = lines[j - 1];
            hasTrailingComma = prevLine.trim().endsWith(',');
            break;
          }
          j++;
        }

        if (foundClosing && !hasTrailingComma) {
          issues.push(this.createIssue(
            'missing-trailing-comma',
            'Missing Trailing Comma',
            'Multiline arrays/objects should have trailing commas',
            filePath,
            i + 1,
            1,
            'hint',
            'Add trailing comma for easier diffs and cleaner git history'
          ));
        }
      }
    }

    return issues;
  }

  private checkNamingConventions(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];

    if (!this.options.checkNamingConventions) return issues;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check variable names (camelCase)
      const varMatch =
        fileInfo.language === 'typescript' || fileInfo.language === 'javascript'
          ? line.match(/(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/)
          : fileInfo.language === 'python'
          ? line.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=/)
          : null;

      if (varMatch) {
        const varName = varMatch[1];

        if (fileInfo.language === 'typescript' || fileInfo.language === 'javascript') {
          // Check for camelCase (allow PascalCase for classes/constructors)
          if (!/^[a-z][a-zA-Z0-9]*$/.test(varName) && !/^[A-Z][a-zA-Z0-9]*$/.test(varName)) {
            issues.push(this.createIssue(
              'naming-convention',
              'Naming Convention Violation',
              `Variable '${varName}' should use camelCase`,
              filePath,
              i + 1,
              varMatch.index! + 1,
              'info',
              `Rename to ${this.toCamelCase(varName)}`
            ));
          }
        } else if (fileInfo.language === 'python') {
          // Check for snake_case
          if (!/^[a-z][a-z0-9_]*$/.test(varName) && !/^[A-Z_][A-Z0-9_]*$/.test(varName)) {
            issues.push(this.createIssue(
              'naming-convention',
              'Naming Convention Violation',
              `Variable '${varName}' should use snake_case`,
              filePath,
              i + 1,
              varMatch.index! + 1,
              'info',
              `Rename to ${this.toSnakeCase(varName)}`
            ));
          }
        }
      }

      // Check class names (PascalCase)
      const classMatch = line.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (classMatch) {
        const className = classMatch[1];
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(className)) {
          issues.push(this.createIssue(
            'naming-convention',
            'Naming Convention Violation',
            `Class '${className}' should use PascalCase`,
            filePath,
            i + 1,
            classMatch.index! + 1,
            'info',
            `Rename to ${this.toPascalCase(className)}`
          ));
        }
      }

      // Check function names
      const funcMatch =
        fileInfo.language === 'typescript' || fileInfo.language === 'javascript'
          ? line.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/)
          : fileInfo.language === 'python'
          ? line.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)/)
          : null;

      if (funcMatch) {
        const funcName = funcMatch[1];

        if (fileInfo.language === 'typescript' || fileInfo.language === 'javascript') {
          if (!/^[a-z][a-zA-Z0-9]*$/.test(funcName)) {
            issues.push(this.createIssue(
              'naming-convention',
              'Naming Convention Violation',
              `Function '${funcName}' should use camelCase`,
              filePath,
              i + 1,
              funcMatch.index! + 1,
              'info',
              `Rename to ${this.toCamelCase(funcName)}`
            ));
          }
        } else if (fileInfo.language === 'python') {
          if (!/^[a-z][a-z0-9_]*$/.test(funcName)) {
            issues.push(this.createIssue(
              'naming-convention',
              'Naming Convention Violation',
              `Function '${funcName}' should use snake_case`,
              filePath,
              i + 1,
              funcMatch.index! + 1,
              'info',
              `Rename to ${this.toSnakeCase(funcName)}`
            ));
          }
        }
      }

      // Check constant names (UPPER_CASE)
      const constMatch =
        fileInfo.language === 'typescript' || fileInfo.language === 'javascript'
          ? line.match(/const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/)
          : null;

      if (constMatch) {
        const constName = constMatch[1];
        if (constName === constName.toUpperCase() && !/^[A-Z][A-Z0-9_]*$/.test(constName)) {
          issues.push(this.createIssue(
            'naming-convention',
            'Naming Convention Violation',
            `Constant '${constName}' should use UPPER_CASE`,
            filePath,
            i + 1,
            constMatch.index! + 1,
            'info',
            `Rename to ${this.toConstantCase(constName)}`
          ));
        }
      }
    }

    return issues;
  }

  private checkImportOrder(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];

    if (!this.options.checkImportOrder) return issues;

    const lines = content.split('\n');
    const imports: Array<{ line: number; name: string; type: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('import ')) {
        const isExternal = !trimmed.startsWith('import ./') && !trimmed.startsWith('import ../');
        const isType = trimmed.includes('import type');

        const nameMatch = trimmed.match(/import\s+(?:type\s+)?[^']*from\s+['"]([^'"]+)['"]/);
        const name = nameMatch ? nameMatch[1] : trimmed;

        imports.push({
          line: i + 1,
          name,
          type: isType ? 'type' : isExternal ? 'external' : 'internal',
        });
      }
    }

    // Check if imports are properly grouped
    let currentType = imports[0]?.type || '';
    let issuesFound = false;

    for (let i = 1; i < imports.length; i++) {
      if (imports[i].type !== currentType) {
        // Check if this is a proper type change (external -> internal -> type)
        const typeOrder = ['external', 'internal', 'type'];
        const currentIdx = typeOrder.indexOf(currentType);
        const newIdx = typeOrder.indexOf(imports[i].type);

        if (newIdx < currentIdx) {
          issues.push(this.createIssue(
            'import-order',
            'Incorrect Import Order',
            `Imports should be grouped: external, internal, then type imports`,
            filePath,
            imports[i].line,
            1,
            'info',
            'Reorganize imports according to convention'
          ));
          issuesFound = true;
        }

        currentType = imports[i].type;
      }
    }

    if (issuesFound) return issues;

    // Check if imports are alphabetically sorted within groups
    for (let i = 1; i < imports.length; i++) {
      if (
        imports[i].type === imports[i - 1].type &&
        imports[i].name < imports[i - 1].name
      ) {
        issues.push(this.createIssue(
          'import-order',
          'Imports Not Sorted',
          'Imports should be alphabetically sorted within groups',
          filePath,
          imports[i].line,
          1,
          'hint',
          'Sort imports alphabetically'
        ));
      }
    }

    return issues;
  }

  private checkBlankLines(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    let consecutiveBlankLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (trimmed.length === 0) {
        consecutiveBlankLines++;
      } else {
        if (consecutiveBlankLines > 2) {
          issues.push(this.createIssue(
            'too-many-blank-lines',
            'Too Many Blank Lines',
            `File has ${consecutiveBlankLines} consecutive blank lines (max: 2)`,
            filePath,
            i - consecutiveBlankLines + 1,
            1,
            'hint',
            'Remove extra blank lines'
          ));
        }
        consecutiveBlankLines = 0;
      }
    }

    return issues;
  }

  private checkSpacing(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for spaces around operators
      if (/[a-zA-Z0-9_](=|\+|\-|\*|\/|%|<|>|\||&|\^)[a-zA-Z0-9_]/.test(line)) {
        // Skip common exceptions
        if (!line.includes('++') && !line.includes('--') && !line.includes('->') && !line.includes('=>')) {
          issues.push(this.createIssue(
            'spacing',
            'Missing Spaces Around Operator',
            'Operators should be surrounded by spaces',
            filePath,
            i + 1,
            1,
            'hint',
            'Add spaces around operators'
          ));
        }
      }

      // Check for spaces after keywords
      if (/\b(if|while|for|switch|catch)\(/.test(line)) {
        issues.push(this.createIssue(
          'spacing',
          'Missing Space After Keyword',
          'Keywords should be followed by a space',
          filePath,
          i + 1,
          1,
          'hint',
          'Add space after keyword'
        ));
      }
    }

    return issues;
  }

  private checkBraces(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];

    if (fileInfo.language !== 'typescript' && fileInfo.language !== 'javascript' && fileInfo.language !== 'java') {
      return issues;
    }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for opening brace on same line
      if (/\)(?!\s*{)/.test(line) && /if|for|while|switch|function|catch/.test(line)) {
        issues.push(this.createIssue(
          'brace-style',
          'Opening Brace on New Line',
          'Opening braces should be on the same line',
          filePath,
          i + 1,
          1,
          'hint',
          'Move opening brace to same line'
        ));
      }

      // Check for else after closing brace
      if (/}\s*else/.test(line)) {
        const trimmed = line.trim();
        if (trimmed.includes('} else')) {
          // This is OK
        } else {
          issues.push(this.createIssue(
            'brace-style',
            'Else on New Line',
            'else should be on same line as closing brace',
            filePath,
            i + 1,
            1,
            'hint',
            'Use "} else {" format'
          ));
        }
      }
    }

    return issues;
  }

  private checkComments(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for TODO/FIXME comments
      if (/\/\/\s*(TODO|FIXME|HACK|XXX)/.test(trimmed) || /#\s*(TODO|FIXME|HACK|XXX)/.test(trimmed)) {
        issues.push(this.createIssue(
          'todo-comment',
          'TODO Comment Found',
          'Code contains TODO/FIXME comments that should be addressed',
          filePath,
          i + 1,
          line.search(/\S|$/) + 1,
          'info',
          'Address the TODO or create an issue to track it'
        ));
      }

      // Check for commented-out code
      if ((trimmed.startsWith('//') || trimmed.startsWith('#')) && /[a-zA-Z0-9_]\s*=\s*[^;]+;?/.test(trimmed)) {
        issues.push(this.createIssue(
          'commented-code',
          'Commented-Out Code',
          'Remove commented-out code',
          filePath,
          i + 1,
          1,
          'hint',
          'Delete the commented code or use version control'
        ));
      }
    }

    return issues;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private createIssue(
    ruleId: string,
    title: string,
    description: string,
    filePath: string,
    line: number,
    column: number,
    severity: Severity,
    suggestion: string
  ): Issue {
    return {
      id: `STYLE-${ruleId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId,
      severity,
      category: 'style',
      title,
      description,
      location: {
        path: filePath,
        line,
        column,
      },
      suggestion,
      timestamp: new Date(),
    };
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[A-Z]/, (letter) => letter.toLowerCase());
  }

  private toPascalCase(str: string): string {
    return this.toCamelCase(str).replace(/^[a-z]/, (letter) => letter.toUpperCase());
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  private toConstantCase(str: string): string {
    return this.toSnakeCase(str).toUpperCase();
  }
}
