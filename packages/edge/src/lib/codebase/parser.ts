/**
 * Codebase Parser
 *
 * Parses code files in multiple languages, extracts structure,
 * and prepares them for chunking and indexing.
 *
 * Performance Targets:
 * - Parse 1MB file: <50ms
 * - Extract structure: <10ms
 * - Memory overhead: ~2x file size
 */

import type {
  SupportedLanguage,
  ParsedFile,
  FileStructure,
  CodeChunk,
  Import,
  Export,
  ParserOptions,
} from './types';

const DEFAULT_OPTIONS: Required<ParserOptions> = {
  includeComments: true,
  maxChunkSize: 500,
  overlapLines: 3,
  extractSignatures: true,
  trackDependencies: true,
};

/**
 * Language detection patterns
 */
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  typescript: [/\.(ts|tsx)$/i, /^interface\s+\w+/, /^type\s+\w+/],
  javascript: [/\.(js|jsx|mjs|cjs)$/i, /^const\s+\w+\s*=\s*\(/],
  python: [/\.py$/i, /^def\s+\w+/, /^class\s+\w+:/],
  java: [/\.java$/i, /^public\s+(class|interface|enum)\s+\w+/],
  go: [/\.go$/i, /^func\s+\w+/, /^type\s+\w+\s+struct/],
  rust: [/\.rs$/i, /^fn\s+\w+/, /^struct\s+\w+/],
  cpp: [/\.(cpp|cc|cxx|h|hpp)$/i, /^class\s+\w+/, /^void\s+\w+\s*\(/],
  c: [/\.c$/i, /^void\s+\w+\s*\(/, /^int\s+\w+\s*\(/],
  csharp: [/\.cs$/i, /^public\s+class\s+\w+/],
  php: [/\.php$/i, /^function\s+\w+/, /^class\s+\w+/],
  ruby: [/\.rb$/i, /^def\s+\w+/, /^class\s+\w+/],
  swift: [/\.swift$/i, /^func\s+\w+/, /^class\s+\w+/],
  kotlin: [/\.kt$/i, /^fun\s+\w+/, /^class\s+\w+/],
  scala: [/\.scala$/i, /^def\s+\w+/, /^class\s+\w+/],
  markdown: [/\.md$/i],
  json: [/\.json$/i],
  yaml: [/\.ya?ml$/i],
  toml: [/\.toml$/i],
  xml: [/\.xml$/i],
  html: [/\.html?$/i],
  css: [/\.css$/i],
  shell: [/\.sh$/i, /^#!/],
  sql: [/\.sql$/i],
};

/**
 * Code structure extraction patterns
 */
const STRUCTURE_PATTERNS: Record<
  SupportedLanguage,
  {
    function?: RegExp;
    class?: RegExp;
    interface?: RegExp;
    import?: RegExp;
    export?: RegExp;
    comment?: RegExp;
  }
> = {
  typescript: {
    function: /(?:^|\n)\s*(?:async\s+)?(?:function\s+)?(\w+)\s*(?:<[^>]+>)?\s*\(/gm,
    class: /(?:^|\n)\s*(?:abstract\s+)?class\s+(\w+)/gm,
    interface: /(?:^|\n)\s*interface\s+(\w+)/gm,
    import: /import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g,
    export: /export\s+(?:(?:default\s+(?:class|function|const|interface)\s+(\w+))|(?:class|function|const|interface)\s+(\w))/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  javascript: {
    function: /(?:^|\n)\s*(?:async\s+)?(?:function\s+)?(\w+)\s*\(/gm,
    class: /(?:^|\n)\s*class\s+(\w+)/gm,
    import: /import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g,
    export: /export\s+(?:(?:default\s+)?(?:class|function|const)\s+(\w+))/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  python: {
    function: /(?:^|\n)\s*def\s+(\w+)\s*\(/gm,
    class: /(?:^|\n)\s*class\s+(\w+)/gm,
    import: /(?:from\s+(\S+)\s+)?import\s+(.+)/g,
    export: /__all__\s*=\s*\[(.+)\]/g,
    comment: /#.*$|"""[\s\S]*?"""|'''[\s\S]*?'''/gm,
  },
  java: {
    function: /(?:^|\n)\s*(?:public|private|protected)?\s*(?:static\s+)?(?:\w+)\s+(\w+)\s*\(/gm,
    class: /(?:^|\n)\s*(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/gm,
    interface: /(?:^|\n)\s*interface\s+(\w+)/gm,
    import: /import\s+([^;]+);/g,
    comment: /\/\/.*$|\/\*\*[\s\S]*?\*\/|\/\*[\s\S]*?\*\//gm,
  },
  go: {
    function: /(?:^|\n)\s*func\s+(?:\([^)]+\)\s+)?(\w+)/gm,
    import: /import\s+(?:"([^"]+)"|`([^`]+)`)/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  rust: {
    function: /(?:^|\n)\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm,
    class: /(?:^|\n)\s*struct\s+(\w+)/gm,
    import: /use\s+([^;]+);/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  cpp: {
    function: /(?:^|\n)\s*(?:\w+)\s+(\w+)\s*\(/gm,
    class: /(?:^|\n)\s*class\s+(\w+)/gm,
    import: /#include\s+[<"]([^>"]+)[>"]/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  c: {
    function: /(?:^|\n)\s*(?:\w+)\s+(\w+)\s*\(/gm,
    import: /#include\s+[<"]([^>"]+)[>"]/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  csharp: {
    function: /(?:^|\n)\s*(?:public|private|protected)?\s*(?:static\s+)?(?:\w+)\s+(\w+)\s*\(/gm,
    class: /(?:^|\n)\s*(?:public\s+)?class\s+(\w+)/gm,
    import: /using\s+([^;]+);/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  php: {
    function: /(?:^|\n)\s*function\s+(\w+)\s*\(/gm,
    class: /(?:^|\n)\s*class\s+(\w+)/gm,
    import: /use\s+([^;]+);/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  ruby: {
    function: /(?:^|\n)\s*def\s+(\w+)/gm,
    class: /(?:^|\n)\s*class\s+(\w+)/gm,
    import: /require\s+['"]([^'"]+)['"]/g,
    comment: /#.*$/gm,
  },
  swift: {
    function: /(?:^|\n)\s*func\s+(\w+)/gm,
    class: /(?:^|\n)\s*class\s+(\w+)/gm,
    import: /import\s+(\w+)/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  kotlin: {
    function: /(?:^|\n)\s*fun\s+(\w+)/gm,
    class: /(?:^|\n)\s*(?:open\s+)?class\s+(\w+)/gm,
    import: /import\s+([^;]+)/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  scala: {
    function: /(?:^|\n)\s*def\s+(\w+)/gm,
    class: /(?:^|\n)\s*class\s+(\w+)/gm,
    import: /import\s+([^;]+)/g,
    comment: /\/\/.*$|\/\*[\s\S]*?\*\//gm,
  },
  markdown: {
    comment: /```[\s\S]*?```/g,
  },
  json: {},
  yaml: {},
  toml: {},
  xml: {},
  html: {},
  css: {},
  shell: {
    function: /(?:^|\n)\s*(\w+)\s*\(\s*\)\s*\{/gm,
    comment: /#.*$/gm,
  },
  sql: {
    function: /(?:^|\n)\s*(?:CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|DEFINER\s*=\s*\w+\s+FUNCTION)\s+(?:\w+\.)?(\w+)/gm,
  },
};

/**
 * Codebase Parser
 */
export class CodebaseParser {
  constructor(options: ParserOptions = {}) {
    // Store options if needed later, otherwise just validate
    void { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse a file from content
   *
   * @param content - File content
   * @param filePath - File path
   * @returns Parsed file with structure and chunks
   */
  async parseFile(content: string, filePath: string): Promise<ParsedFile> {
    const startTime = performance.now();

    // Detect language
    const language = this.detectLanguage(filePath, content);

    // Extract structure
    const structure = this.extractStructure(content, filePath, language);

    // Parse imports and exports
    const imports = this.extractImports(content, language);
    const exports = this.extractExports(content, language);

    // Create initial chunks (will be refined by chunker)
    const chunks = this.createInitialChunks(content, filePath, language, structure);

    const lineCount = content.split('\n').length;
    const latency = performance.now() - startTime;

    console.debug(`Parsed ${filePath} in ${latency.toFixed(2)}ms (${lineCount} lines)`);

    return {
      path: filePath,
      language,
      content,
      chunks,
      structure,
      imports,
      exports,
      lineCount,
    };
  }

  /**
   * Detect programming language from file path and content
   *
   * @private
   */
  private detectLanguage(filePath: string, content: string): SupportedLanguage {
    const fileName = filePath.split('/').pop() || '';

    // Try file extension first
    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(fileName)) {
          return lang as SupportedLanguage;
        }
      }
    }

    // Try content patterns
    const lines = content.split('\n');
    const firstLine = lines[0] ?? '';
    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(firstLine) || pattern.test(content.substring(0, 1000))) {
          return lang as SupportedLanguage;
        }
      }
    }

    // Default to text
    return 'typescript';
  }

  /**
   * Extract code structure (functions, classes, etc.)
   *
   * @private
   */
  private extractStructure(content: string, filePath: string, language: SupportedLanguage): FileStructure {
    const structure: FileStructure = {
      path: filePath,
      language,
      functions: [],
      classes: [],
      interfaces: [],
      variables: [],
      imports: [],
      exports: [],
      lineCount: content.split('\n').length,
      hasComments: false,
    };

    const patterns = STRUCTURE_PATTERNS[language];
    if (!patterns) {
      return structure;
    }

    // Extract functions
    if (patterns.function) {
      let match;
      const regex = new RegExp(patterns.function);
      while ((match = regex.exec(content)) !== null) {
        if (match[1]) structure.functions.push(match[1]);
      }
    }

    // Extract classes
    if (patterns.class) {
      let match;
      const regex = new RegExp(patterns.class);
      while ((match = regex.exec(content)) !== null) {
        if (match[1]) structure.classes.push(match[1]);
      }
    }

    // Extract interfaces
    if (patterns.interface) {
      let match;
      const regex = new RegExp(patterns.interface);
      while ((match = regex.exec(content)) !== null) {
        if (match[1]) structure.interfaces.push(match[1]);
      }
    }

    // Check for comments
    if (patterns.comment) {
      structure.hasComments = patterns.comment.test(content);
    }

    return structure;
  }

  /**
   * Extract import statements
   *
   * @private
   */
  private extractImports(content: string, language: SupportedLanguage): Import[] {
    const imports: Import[] = [];
    const patterns = STRUCTURE_PATTERNS[language];

    if (!patterns || !patterns.import) {
      return imports;
    }

    let match;
    const regex = new RegExp(patterns.import, 'g');
    const lines = content.split('\n');

    while ((match = regex.exec(content)) !== null) {
      const module = match[1] || match[2];
      if (!module) continue;

      // Find line number
      const matchStart = match.index;
      let lineNum = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        charCount += line.length + 1;
        if (charCount > matchStart!) {
          lineNum = i + 1;
          break;
        }
      }

      // Extract symbols (simplified)
      const symbols: string[] = [];
      const importStatement = match[0]!;
      const symbolMatch = importStatement.match(/\{([^}]+)\}/);
      if (symbolMatch && symbolMatch[1]) {
        symbols.push(...symbolMatch[1].split(',').map(s => s.trim()));
      }

      imports.push({
        module,
        symbols,
        isDefault: !symbolMatch && importStatement.includes('import'),
        isDynamic: importStatement.includes('import('),
        line: lineNum,
      });
    }

    return imports;
  }

  /**
   * Extract export statements
   *
   * @private
   */
  private extractExports(content: string, language: SupportedLanguage): Export[] {
    const exports: Export[] = [];
    const patterns = STRUCTURE_PATTERNS[language];

    if (!patterns || !patterns.export) {
      return exports;
    }

    let match;
    const regex = new RegExp(patterns.export, 'g');
    const lines = content.split('\n');

    while ((match = regex.exec(content)) !== null) {
      const name = match[1] || match[2];
      if (!name) continue;

      // Find line number
      const matchStart = match.index!;
      let lineNum = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        charCount += line.length + 1;
        if (charCount > matchStart) {
          lineNum = i + 1;
          break;
        }
      }

      // Determine type
      const statement = match[0];
      let type: Export['type'] = 'variable';
      if (statement.includes('function') || statement.includes('def ')) {
        type = 'function';
      } else if (statement.includes('class')) {
        type = 'class';
      } else if (statement.includes('interface')) {
        type = 'interface';
      }

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
   * Create initial chunks (will be refined by chunker)
   *
   * @private
   */
  private createInitialChunks(
    content: string,
    filePath: string,
    language: SupportedLanguage,
    structure: FileStructure
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    // For now, create one chunk per file
    // The chunker will split this into smaller pieces
    const chunk: CodeChunk = {
      id: this.generateChunkId(filePath, 0, lines.length),
      filePath,
      language,
      content,
      startLine: 1,
      endLine: lines.length,
      type: 'other',
      dependencies: [],
      imports: structure.imports,
      exports: structure.exports,
    };

    chunks.push(chunk);

    return chunks;
  }

  /**
   * Generate unique chunk ID
   *
   * @private
   */
  private generateChunkId(filePath: string, startLine: number, endLine: number): string {
    const hash = this.simpleHash(filePath);
    return `${hash}:${startLine}-${endLine}`;
  }

  /**
   * Simple hash function for file paths
   *
   * @private
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Parse multiple files in parallel
   *
   * @param files - Array of file contents and paths
   * @returns Array of parsed files
   */
  async parseBatch(files: Array<{ content: string; path: string }>): Promise<ParsedFile[]> {
    const startTime = performance.now();

    const results = await Promise.all(
      files.map(file => this.parseFile(file.content, file.path))
    );

    const latency = performance.now() - startTime;
    console.debug(`Parsed ${files.length} files in ${latency.toFixed(2)}ms`);

    return results;
  }
}

/**
 * Create a parser instance
 */
export function createParser(options?: ParserOptions): CodebaseParser {
  return new CodebaseParser(options);
}

/**
 * Default parser instance
 */
export const defaultParser = new CodebaseParser();
