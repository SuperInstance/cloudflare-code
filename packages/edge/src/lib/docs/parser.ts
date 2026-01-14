/**
 * Documentation Parser
 *
 * Parses code files and extracts documentation from docstrings and comments.
 * Supports 15+ programming languages and multiple docstring formats.
 *
 * Performance Targets:
 * - Parse 1MB file: <100ms
 * - Extract docstrings: <50ms
 * - Memory overhead: ~3x file size
 */

import type {
  SupportedLanguage,
  DocstringFormat,
  DocSymbol,
  DocTag,
  ParsedDocumentation,
  Parameter,
  TypeParameter,
  Import,
  Export,
  SymbolKind,
  AccessModifier,
  DocParserOptions,
} from './types';

const DEFAULT_OPTIONS: Required<DocParserOptions> = {
  includePrivate: false,
  includeInternal: false,
  includeSource: false,
  docstringFormat: 'auto',
  exclude: ['node_modules/**', 'dist/**', 'build/**', '*.test.ts', '*.test.js', '*.spec.ts', '*.spec.js'],
  include: ['**/*.{ts,tsx,js,jsx,py,java,go,rs,cpp,c,cs,php,rb,swift,kt,scala}'],
  maxFileSize: 1024 * 1024, // 1MB
  followImports: false,
};

/**
 * Language detection patterns
 */
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  typescript: [/\.(ts|tsx)$/i],
  javascript: [/\.(js|jsx|mjs|cjs)$/i],
  python: [/\.py$/i],
  java: [/\.java$/i],
  go: [/\.go$/i],
  rust: [/\.rs$/i],
  cpp: [/\.(cpp|cc|cxx|h|hpp)$/i],
  c: [/\.c$/i],
  csharp: [/\.cs$/i],
  php: [/\.php$/i],
  ruby: [/\.rb$/i],
  swift: [/\.swift$/i],
  kotlin: [/\.kt$/i],
  scala: [/\.scala$/i],
  shell: [/\.sh$/i],
  sql: [/\.sql$/i],
};

/**
 * Docstring patterns for different languages
 */
const DOCSTRING_PATTERNS: Record<
  SupportedLanguage,
  {
    singleLine: RegExp;
    multiLineStart: RegExp;
    multiLineEnd: RegExp;
    blockComment?: RegExp;
  }
> = {
  typescript: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  javascript: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  python: {
    singleLine: /#/,
    multiLineStart: /"""|'''/,
    multiLineEnd: /"""|'''/,
  },
  java: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  go: {
    singleLine: /\/\//,
    multiLineStart: /\/\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  rust: {
    singleLine: /\/\/\//!,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  cpp: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  c: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  csharp: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  php: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  ruby: {
    singleLine: /#/,
    multiLineStart: /=begin/,
    multiLineEnd: /=end/,
  },
  swift: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  kotlin: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  scala: {
    singleLine: /\/\/\//,
    multiLineStart: /\/\*\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
  shell: {
    singleLine: /#/,
    multiLineStart: /:/,
    multiLineEnd: /:/,
  },
  sql: {
    singleLine: /--/,
    multiLineStart: /\/\*/,
    multiLineEnd: /\*\//,
    blockComment: /\/\*[\s\S]*?\*\//g,
  },
};

/**
 * Symbol extraction patterns
 */
const SYMBOL_PATTERNS: Record<
  SupportedLanguage,
  {
    function?: RegExp;
    class?: RegExp;
    interface?: RegExp;
    type?: RegExp;
    enum?: RegExp;
    constant?: RegExp;
    variable?: RegExp;
    method?: RegExp;
    property?: RegExp;
  }
> = {
  typescript: {
    function: /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
    class: /(?:^|\n)\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g,
    interface: /(?:^|\n)\s*(?:export\s+)?interface\s+(\w+)/g,
    type: /(?:^|\n)\s*(?:export\s+)?type\s+(\w+)/g,
    enum: /(?:^|\n)\s*(?:export\s+)?enum\s+(\w+)/g,
    constant: /(?:^|\n)\s*(?:export\s+)?const\s+(\w+)\s*=/g,
    variable: /(?:^|\n)\s*(?:export\s+)?let\s+(\w+)\s*=/g,
    method: /(?:^|\n)\s*(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*(?:<[^>]+>)?\s*\(/g,
    property: /(?:^|\n)\s*(?:public|private|protected)?\s*(?:readonly\s+)?(\w+)\s*(?::\s*\w+\s*)?=/g,
  },
  javascript: {
    function: /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
    class: /(?:^|\n)\s*(?:export\s+)?class\s+(\w+)/g,
    constant: /(?:^|\n)\s*(?:export\s+)?const\s+(\w+)\s*=/g,
    variable: /(?:^|\n)\s*(?:export\s+)?let\s+(\w+)\s*=/g,
    method: /(?:^|\n)\s*(?:async\s+)?(\w+)\s*\(/g,
    property: /(?:^|\n)\s*(\w+)\s*:/g,
  },
  python: {
    function: /(?:^|\n)\s*def\s+(\w+)/g,
    class: /(?:^|\n)\s*class\s+(\w+)/g,
    constant: /(?:^|\n)\s*([A-Z_]{2,})\s*=/g,
    method: /(?:^|\n)\s+def\s+(\w+)\s*\(/g,
    property: /(?:^|\n)\s+self\.(\w+)\s*=/g,
  },
  java: {
    function: /(?:^|\n)\s*(?:public|private|protected)?\s*(?:static\s+)?(?:\w+)\s+(\w+)\s*\(/g,
    class: /(?:^|\n)\s*(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/g,
    interface: /(?:^|\n)\s*interface\s+(\w+)/g,
    enum: /(?:^|\n)\s*enum\s+(\w+)/g,
    constant: /(?:^|\n)\s*(?:public\s+)?static\s+final\s+\w+\s+(\w+)\s*=/g,
    method: /(?:^|\n)\s*(?:public|private|protected)?\s*(?:static\s+)?(?:\w+)\s+(\w+)\s*\(/g,
    property: /(?:^|\n)\s*(?:public|private|protected)?\s+\w+\s+(\w+)\s*;/g,
  },
  go: {
    function: /(?:^|\n)\s*func\s+(?:\([^)]+\)\s+)?(\w+)/g,
    constant: /(?:^|\n)\s*const\s+(\w+)\s*=/g,
    method: /(?:^|\n)\s*func\s+\([^)]+\)\s+(\w+)/g,
  },
  rust: {
    function: /(?:^|\n)\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g,
    constant: /(?:^|\n)\s*const\s+(\w+):\s*\w+/g,
    method: /(?:^|\n)\s*(?:pub\s+)?fn\s+(\w+)\s*\(/g,
  },
  cpp: {
    function: /(?:^|\n)\s*(?:\w+)\s+(\w+)\s*\(/g,
    class: /(?:^|\n)\s*class\s+(\w+)/g,
    constant: /(?:^|\n)\s*const\s+\w+\s+(\w+)\s*=/g,
  },
  c: {
    function: /(?:^|\n)\s*(?:\w+)\s+(\w+)\s*\(/g,
    constant: /(?:^|\n)\s*const\s+\w+\s+(\w+)\s*=/g,
  },
  csharp: {
    function: /(?:^|\n)\s*(?:public|private|protected)?\s*(?:static\s+)?(?:\w+)\s+(\w+)\s*\(/g,
    class: /(?:^|\n)\s*(?:public\s+)?class\s+(\w+)/g,
    interface: /(?:^|\n)\s*interface\s+(\w+)/g,
    constant: /(?:^|\n)\s*const\s+\w+\s+(\w+)\s*=/g,
  },
  php: {
    function: /(?:^|\n)\s*function\s+(\w+)/g,
    class: /(?:^|\n)\s*class\s+(\w+)/g,
    interface: /(?:^|\n)\s*interface\s+(\w+)/g,
    constant: /(?:^|\n)\s*const\s+(\w+)\s*=/g,
  },
  ruby: {
    function: /(?:^|\n)\s*def\s+(\w+)/g,
    class: /(?:^|\n)\s*class\s+(\w+)/g,
    constant: /(?:^|\n)\s*([A-Z_]{2,})\s*=/g,
    method: /(?:^|\n)\s+def\s+(\w+)/g,
  },
  swift: {
    function: /(?:^|\n)\s*func\s+(\w+)/g,
    class: /(?:^|\n)\s*class\s+(\w+)/g,
    constant: /(?:^|\n)\s*let\s+(\w+)\s*=/g,
    method: /(?:^|\n)\s*func\s+(\w+)\s*\(/g,
  },
  kotlin: {
    function: /(?:^|\n)\s*fun\s+(\w+)/g,
    class: /(?:^|\n)\s*(?:open\s+)?class\s+(\w+)/g,
    interface: /(?:^|\n)\s*interface\s+(\w+)/g,
    constant: /(?:^|\n)\s*const\s+val\s+(\w+)\s*=/g,
  },
  scala: {
    function: /(?:^|\n)\s*def\s+(\w+)/g,
    class: /(?:^|\n)\s*class\s+(\w+)/g,
    constant: /(?:^|\n)\s*val\s+(\w+)\s*=/g,
  },
  shell: {
    function: /(?:^|\n)\s*(\w+)\s*\(\s*\)\s*\{/g,
  },
  sql: {
    function: /(?:^|\n)\s*(?:CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION)\s+(?:\w+\.)?(\w+)/g,
  },
};

/**
 * Access modifier patterns
 */
const ACCESS_PATTERNS: Record<string, AccessModifier> = {
  public: 'public',
  private: 'private',
  protected: 'protected',
  internal: 'internal',
};

/**
 * Documentation Parser
 */
export class DocumentationParser {
  private options: Required<DocParserOptions>;

  constructor(options: DocParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse a file and extract documentation
   *
   * @param content - File content
   * @param filePath - File path
   * @returns Parsed documentation
   */
  async parseFile(content: string, filePath: string): Promise<ParsedDocumentation> {
    const startTime = performance.now();

    // Detect language
    const language = this.detectLanguage(filePath);

    // Extract symbols with documentation
    const symbols = await this.extractSymbols(content, filePath, language);

    // Parse imports
    const imports = this.extractImports(content, language, filePath);

    // Parse exports
    const exports = this.extractExports(content, language, filePath);

    // Extract file-level documentation
    const fileDescription = this.extractFileDescription(content, language);

    // Calculate statistics
    const stats = this.calculateStats(symbols);

    const latency = performance.now() - startTime;
    console.debug(`Parsed documentation from ${filePath} in ${latency.toFixed(2)}ms`);

    return {
      filePath,
      language,
      symbols,
      imports,
      exports,
      fileDescription,
      stats,
    };
  }

  /**
   * Detect programming language from file path
   *
   * @private
   */
  private detectLanguage(filePath: string): SupportedLanguage {
    const fileName = filePath.split('/').pop() || '';

    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(fileName)) {
          return lang as SupportedLanguage;
        }
      }
    }

    // Default to TypeScript
    return 'typescript';
  }

  /**
   * Extract all symbols with their documentation
   *
   * @private
   */
  private async extractSymbols(
    content: string,
    filePath: string,
    language: SupportedLanguage
  ): Promise<DocSymbol[]> {
    const symbols: DocSymbol[] = [];
    const patterns = SYMBOL_PATTERNS[language];
    const docPatterns = DOCSTRING_PATTERNS[language];

    if (!patterns) {
      return symbols;
    }

    // Extract all symbol types
    const symbolTypes: Array<{ kind: SymbolKind; pattern?: RegExp }> = [
      { kind: 'function', pattern: patterns.function },
      { kind: 'class', pattern: patterns.class },
      { kind: 'interface', pattern: patterns.interface },
      { kind: 'type', pattern: patterns.type },
      { kind: 'enum', pattern: patterns.enum },
      { kind: 'constant', pattern: patterns.constant },
      { kind: 'variable', pattern: patterns.variable },
    ];

    for (const { kind, pattern } of symbolTypes) {
      if (!pattern) continue;

      let match;
      const regex = new RegExp(pattern);
      const lines = content.split('\n');

      // Reset regex state
      regex.lastIndex = 0;

      while ((match = regex.exec(content)) !== null) {
        const name = match[1];
        const matchStart = match.index;

        // Find line number
        let lineNum = 0;
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1;
          if (charCount > matchStart) {
            lineNum = i + 1;
            break;
          }
        }

        // Extract documentation before the symbol
        const docstring = this.extractDocstringBefore(lines, lineNum - 1, language);

        // Extract access modifier
        const access = this.extractAccessModifier(lines, lineNum - 1, language);

        // Extract signature
        const signature = this.extractSignature(lines, lineNum - 1, kind, language);

        // Extract parameters for functions
        const parameters = kind === 'function' || kind === 'method'
          ? this.extractParameters(signature, language)
          : undefined;

        // Extract type parameters
        const typeParameters = this.extractTypeParameters(signature);

        // Check if exported
        const exported = this.isExported(lines, lineNum - 1, language);

        // Extract decorators
        const decorators = this.extractDecorators(lines, lineNum - 1, language);

        // Parse docstring tags
        const tags = this.parseDocstringTags(docstring);

        // Extract source code if requested
        const code = this.options.includeSource
          ? this.extractSymbolSource(lines, lineNum - 1, kind)
          : undefined;

        // Determine if should include based on access
        if (!this.shouldIncludeSymbol(access, exported)) {
          continue;
        }

        const symbol: DocSymbol = {
          id: this.generateSymbolId(filePath, name, kind, lineNum),
          name,
          kind,
          access,
          filePath,
          startLine: lineNum,
          endLine: lineNum, // Will be refined by more sophisticated parsing
          description: docstring,
          summary: this.extractSummary(docstring),
          examples: tags
            .filter(t => t.name === 'example')
            .map(t => t.value),
          deprecated: tags.some(t => t.name === 'deprecated'),
          since: tags.find(t => t.name === 'since')?.value,
          version: tags.find(t => t.name === 'version')?.value,
          signature,
          returnType: this.extractReturnType(tags),
          generics: typeParameters.map(tp => tp.name),
          typeParameters,
          parameters,
          tags,
          code,
          exported,
          static: this.isStatic(lines, lineNum - 1, language),
          abstract: this.isAbstract(lines, lineNum - 1, language),
          readonly: this.isReadonly(lines, lineNum - 1, language),
          optional: this.isOptional(signature),
          decorators,
        };

        symbols.push(symbol);
      }
    }

    return symbols;
  }

  /**
   * Extract docstring before a symbol
   *
   * @private
   */
  private extractDocstringBefore(lines: string[], symbolLine: number, language: SupportedLanguage): string {
    const docPatterns = DOCSTRING_PATTERNS[language];
    if (!docPatterns) return '';

    let docLines: string[] = [];
    let inDocstring = false;
    let docstringType: 'single' | 'multi' | null = null;

    // Scan backwards from symbol line
    for (let i = symbolLine; i >= 0; i--) {
      const line = lines[i].trim();

      if (!inDocstring) {
        // Check if we're starting a docstring
        if (docPatterns.multiLineStart.test(line)) {
          inDocstring = true;
          docstringType = 'multi';
          docLines.unshift(line);
        } else if (docPatterns.singleLine.test(line)) {
          inDocstring = true;
          docstringType = 'single';
          docLines.unshift(line);
        } else if (line === '') {
          // Empty line - continue scanning
          continue;
        } else {
          // Non-empty, non-comment line - we're done
          break;
        }
      } else {
        // We're in a docstring
        if (docstringType === 'single') {
          if (docPatterns.singleLine.test(line)) {
            docLines.unshift(line);
          } else {
            // End of single-line docstring
            break;
          }
        } else if (docstringType === 'multi') {
          docLines.unshift(line);
          if (docPatterns.multiLineEnd.test(line)) {
            // Found the end
            break;
          }
        }
      }
    }

    return this.cleanDocstring(docLines.join('\n'));
  }

  /**
   * Clean and format docstring
   *
   * @private
   */
  private cleanDocstring(docstring: string): string {
    return docstring
      .trim()
      .replace(/^\/\*\*/, '')
      .replace(/\*\/$/, '')
      .replace(/^\/\/\//gm, '')
      .replace(/^\/\/\/\s?/gm, '')
      .replace(/^\s*\*\s?/gm, '')
      .replace(/^"""/, '')
      .replace(/"""$/, '')
      .replace(/^'''/, '')
      .replace(/'''$/, '')
      .trim();
  }

  /**
   * Extract summary from docstring
   *
   * @private
   */
  private extractSummary(docstring: string): string | undefined {
    if (!docstring) return undefined;

    // Get first paragraph/sentence
    const firstParagraph = docstring.split(/\n\n/)[0];
    const firstSentence = firstParagraph.split(/[.!?]/)[0];

    return firstSentence.trim() || undefined;
  }

  /**
   * Extract access modifier
   *
   * @private
   */
  private extractAccessModifier(lines: string[], line: number, language: SupportedLanguage): AccessModifier {
    const lineContent = lines[line];

    for (const [keyword, modifier] of Object.entries(ACCESS_PATTERNS)) {
      if (lineContent.includes(keyword)) {
        return modifier;
      }
    }

    return 'public'; // Default
  }

  /**
   * Extract symbol signature
   *
   * @private
   */
  private extractSignature(lines: string[], line: number, kind: SymbolKind, language: SupportedLanguage): string {
    // Get the line containing the symbol
    let signature = lines[line].trim();

    // For functions, try to include parameter list
    if (kind === 'function' || kind === 'method') {
      // Look ahead for opening paren
      let parenEnd = -1;
      let depth = 0;
      for (let i = line; i < lines.length; i++) {
        for (let j = 0; j < lines[i].length; j++) {
          const char = lines[i][j];
          if (char === '(') depth++;
          if (char === ')') {
            depth--;
            if (depth === 0) {
              parenEnd = i;
              break;
            }
          }
        }
        if (parenEnd !== -1) break;
      }

      if (parenEnd !== -1) {
        signature = lines.slice(line, parenEnd + 1).join(' ').trim();
      }
    }

    return signature;
  }

  /**
   * Extract parameters from signature
   *
   * @private
   */
  private extractParameters(signature: string, language: SupportedLanguage): Parameter[] {
    const params: Parameter[] = [];

    // Extract parameter list
    const paramMatch = signature.match(/\(([^)]*)\)/);
    if (!paramMatch) return params;

    const paramString = paramMatch[1];
    if (!paramString.trim()) return params;

    // Split by comma, but handle nested generics
    const paramParts: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of paramString) {
      if (char === '<' || char === '[' || char === '{') depth++;
      if (char === '>' || char === ']' || char === '}') depth--;
      if (char === ',' && depth === 0) {
        paramParts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) paramParts.push(current.trim());

    // Parse each parameter
    for (const part of paramParts) {
      const param = this.parseParameter(part, language);
      if (param) params.push(param);
    }

    return params;
  }

  /**
   * Parse a single parameter
   *
   * @private
   */
  private parseParameter(paramStr: string, language: SupportedLanguage): Parameter | null {
    // Handle rest parameters
    const rest = paramStr.startsWith('...');

    // Remove leading/trailing whitespace
    const clean = paramStr.trim().replace(/^\.\.\./, '');

    // Split by : or = to get name and type
    let name = clean;
    let type = 'any';
    let optional = false;
    let defaultValue: string | undefined;

    // TypeScript/JavaScript style: name: type or name?: type
    const typeMatch = clean.match(/^(\w+)(\?)?:\s*([^=]+)(?:=\s*(.+))?$/);
    if (typeMatch) {
      name = typeMatch[1];
      optional = typeMatch[2] === '?';
      type = typeMatch[3].trim();
      defaultValue = typeMatch[4]?.trim();
    }

    return {
      name,
      type,
      optional,
      defaultValue,
      rest,
    };
  }

  /**
   * Extract type parameters from signature
   *
   * @private
   */
  private extractTypeParameters(signature: string): TypeParameter[] {
    const params: TypeParameter[] = [];

    const genericsMatch = signature.match(/<([^>]+)>/);
    if (!genericsMatch) return params;

    const genericsStr = genericsMatch[1];
    const parts = genericsStr.split(',').map(s => s.trim());

    for (const part of parts) {
      const constraintMatch = part.match(/(\w+)(?:\s+extends\s+([^\s=]+))?(?:\s*=\s*([^\s]+))?/);
      if (constraintMatch) {
        params.push({
          name: constraintMatch[1],
          constraint: constraintMatch[2],
          default: constraintMatch[3],
        });
      }
    }

    return params;
  }

  /**
   * Extract return type from tags
   *
   * @private
   */
  private extractReturnType(tags: DocTag[]): string | undefined {
    const returnTag = tags.find(t => t.name === 'return' || t.name === 'returns');
    return returnTag?.type;
  }

  /**
   * Parse docstring tags
   *
   * @private
   */
  private parseDocstringTags(docstring: string): DocTag[] {
    const tags: DocTag[] = [];
    if (!docstring) return tags;

    const lines = docstring.split('\n');
    let currentTag: DocTag | null = null;

    for (const line of lines) {
      const tagMatch = line.match(/^@(\w+)\s*(?:(\{([^}]*)\})?\s*(.*))?$/);

      if (tagMatch) {
        // Save previous tag
        if (currentTag) {
          tags.push(currentTag);
        }

        // Start new tag
        currentTag = {
          name: tagMatch[1],
          type: tagMatch[3],
          value: tagMatch[4] || '',
        };
      } else if (currentTag) {
        // Continue multi-line tag value
        currentTag.value += '\n' + line.trim();
      }
    }

    if (currentTag) {
      tags.push(currentTag);
    }

    return tags;
  }

  /**
   * Check if symbol is exported
   *
   * @private
   */
  private isExported(lines: string[], line: number, language: SupportedLanguage): boolean {
    const lineContent = lines[line].toLowerCase();
    return lineContent.includes('export') || lineContent.includes('@export');
  }

  /**
   * Check if symbol should be included based on access
   *
   * @private
   */
  private shouldIncludeSymbol(access: AccessModifier, exported: boolean): boolean {
    if (exported) return true;
    if (access === 'public') return true;
    if (access === 'private' && !this.options.includePrivate) return false;
    if (access === 'internal' && !this.options.includeInternal) return false;
    return this.options.includePrivate;
  }

  /**
   * Check if symbol is static
   *
   * @private
   */
  private isStatic(lines: string[], line: number, language: SupportedLanguage): boolean {
    return lines[line].includes('static');
  }

  /**
   * Check if symbol is abstract
   *
   * @private
   */
  private isAbstract(lines: string[], line: number, language: SupportedLanguage): boolean {
    return lines[line].includes('abstract');
  }

  /**
   * Check if symbol is readonly
   *
   * @private
   */
  private isReadonly(lines: string[], line: number, language: SupportedLanguage): boolean {
    return lines[line].includes('readonly') || lines[line].includes('const');
  }

  /**
   * Check if symbol is optional
   *
   * @private
   */
  private isOptional(signature: string): boolean {
    return signature.includes('?');
  }

  /**
   * Extract decorators
   *
   * @private
   */
  private extractDecorators(lines: string[], line: number, language: SupportedLanguage): string[] {
    const decorators: string[] = [];
    let i = line;

    // Scan backwards for decorators
    while (i >= 0 && lines[i].trim().startsWith('@')) {
      decorators.unshift(lines[i].trim());
      i--;
    }

    return decorators;
  }

  /**
   * Extract symbol source code
   *
   * @private
   */
  private extractSymbolSource(lines: string[], line: number, kind: SymbolKind): string {
    // Simple implementation - just return the line
    // A more sophisticated version would extract the entire block
    return lines[line];
  }

  /**
   * Extract imports
   *
   * @private
   */
  private extractImports(content: string, language: SupportedLanguage, filePath: string): Import[] {
    const imports: Import[] = [];

    // Simplified import extraction
    const importPatterns: Record<string, RegExp> = {
      typescript: /import\s+(?:(\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g,
      javascript: /import\s+(?:(\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g,
      python: /(?:from\s+(\S+)\s+)?import\s+(.+)/g,
    };

    const pattern = importPatterns[language];
    if (!pattern) return imports;

    let match;
    const lines = content.split('\n');

    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const module = match[2] || match[1];
      if (!module) continue;

      const matchStart = match.index;
      let lineNum = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1;
        if (charCount > matchStart) {
          lineNum = i + 1;
          break;
        }
      }

      const symbols: string[] = [];
      const symbolMatch = match[0].match(/\{([^}]+)\}/);
      if (symbolMatch) {
        symbols.push(...symbolMatch[1].split(',').map(s => s.trim()));
      }

      imports.push({
        module,
        symbols,
        isDefault: !symbolMatch,
        isDynamic: match[0].includes('import('),
        line: lineNum,
      });
    }

    return imports;
  }

  /**
   * Extract exports
   *
   * @private
   */
  private extractExports(content: string, language: SupportedLanguage, filePath: string): Export[] {
    const exports: Export[] = [];

    const exportPatterns: Record<string, RegExp> = {
      typescript: /export\s+(?:(?:default\s+)?(?:class|function|const|interface|type)\s+(\w+))/g,
      javascript: /export\s+(?:(?:default\s+)?(?:class|function|const)\s+(\w+))/g,
      python: /__all__\s*=\s*\[(.+)\]/g,
    };

    const pattern = exportPatterns[language];
    if (!pattern) return exports;

    let match;
    const lines = content.split('\n');

    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      if (!name) continue;

      const matchStart = match.index;
      let lineNum = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1;
        if (charCount > matchStart) {
          lineNum = i + 1;
          break;
        }
      }

      const statement = match[0];
      let type: Export['type'] = 'variable';
      if (statement.includes('function')) type = 'function';
      else if (statement.includes('class')) type = 'class';
      else if (statement.includes('interface')) type = 'interface';
      else if (statement.includes('type')) type = 'type';

      exports.push({
        name,
        isDefault: statement.includes('default'),
        type,
        line: lineNum,
      });
    }

    return exports;
  }

  /**
   * Extract file-level description
   *
   * @private
   */
  private extractFileDescription(content: string, language: SupportedLanguage): string | undefined {
    const lines = content.split('\n');

    // Look for file header comment
    let inHeader = false;
    let headerLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!inHeader) {
        if (trimmed.startsWith('/**') || trimmed.startsWith('///') || trimmed.startsWith('/*')) {
          inHeader = true;
          headerLines.push(trimmed);
        } else if (trimmed === '' || trimmed.startsWith('#!')) {
          continue;
        } else {
          break;
        }
      } else {
        headerLines.push(trimmed);
        if (trimmed.endsWith('*/') || trimmed.startsWith('*/')) {
          break;
        }
      }
    }

    if (headerLines.length > 0) {
      return this.cleanDocstring(headerLines.join('\n'));
    }

    return undefined;
  }

  /**
   * Calculate documentation statistics
   *
   * @private
   */
  private calculateStats(symbols: DocSymbol[]) {
    const stats = {
      totalSymbols: symbols.length,
      functions: 0,
      classes: 0,
      interfaces: 0,
      types: 0,
      exported: 0,
      documented: 0,
      documentationCoverage: 0,
    };

    for (const symbol of symbols) {
      switch (symbol.kind) {
        case 'function':
        case 'method':
          stats.functions++;
          break;
        case 'class':
          stats.classes++;
          break;
        case 'interface':
          stats.interfaces++;
          break;
        case 'type':
        case 'enum':
          stats.types++;
          break;
      }

      if (symbol.exported) stats.exported++;
      if (symbol.description) stats.documented++;
    }

    stats.documentationCoverage = stats.totalSymbols > 0
      ? (stats.documented / stats.totalSymbols) * 100
      : 0;

    return stats;
  }

  /**
   * Generate unique symbol ID
   *
   * @private
   */
  private generateSymbolId(filePath: string, name: string, kind: SymbolKind, line: number): string {
    const hash = this.simpleHash(filePath);
    return `${hash}:${kind}:${name}:${line}`;
  }

  /**
   * Simple hash function
   *
   * @private
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Parse multiple files in parallel
   *
   * @param files - Array of file contents and paths
   * @returns Array of parsed documentation
   */
  async parseBatch(files: Array<{ content: string; path: string }>): Promise<ParsedDocumentation[]> {
    const startTime = performance.now();

    const results = await Promise.all(
      files.map(file => this.parseFile(file.content, file.path))
    );

    const latency = performance.now() - startTime;
    console.debug(`Parsed ${files.length} files for documentation in ${latency.toFixed(2)}ms`);

    return results;
  }
}

/**
 * Create a documentation parser instance
 */
export function createDocParser(options?: DocParserOptions): DocumentationParser {
  return new DocumentationParser(options);
}

/**
 * Default parser instance
 */
export const defaultDocParser = new DocumentationParser();
