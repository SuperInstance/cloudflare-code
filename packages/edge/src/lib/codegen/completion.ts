/**
 * Code Completion Engine
 *
 * Intelligent code completion with context awareness,
 * semantic analysis, and multi-language support.
 */

import type {
  CompletionRequest,
  CompletionResult,
  CompletionItem,
  CompletionContext,
  CompletionKind,
  CompletionOptions,
  Symbol,
  Import,
  CursorPosition,
} from './types';
import type { SupportedLanguage } from '../codebase/types';

/**
 * Completion provider for specific languages
 */
interface CompletionProvider {
  getCompletions(request: CompletionRequest): Promise<CompletionItem[]>;
  getTriggerCharacters(): string[];
}

/**
 * Code Completion Engine
 */
export class CodeCompletionEngine {
  private providers: Map<SupportedLanguage, CompletionProvider>;
  private cache: Map<string, { items: CompletionItem[]; timestamp: number }>;
  private cacheTimeout: number;

  constructor() {
    this.providers = new Map();
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute

    // Register default providers
    this.registerProvider('typescript', new TypeScriptCompletionProvider());
    this.registerProvider('javascript', new JavaScriptCompletionProvider());
    this.registerProvider('python', new PythonCompletionProvider());
    this.registerProvider('go', new GoCompletionProvider());
    this.registerProvider('rust', new RustCompletionProvider());
    this.registerProvider('java', new JavaCompletionProvider());
  }

  /**
   * Register a completion provider for a language
   */
  registerProvider(language: SupportedLanguage, provider: CompletionProvider): void {
    this.providers.set(language, provider);
  }

  /**
   * Get code completions
   */
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const provider = this.providers.get(request.language);

    if (!provider) {
      return {
        items: [],
        context: request.context || this.buildContext(request),
        isIncomplete: false,
      };
    }

    // Check cache
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return {
        items: cached.items,
        context: request.context || this.buildContext(request),
        isIncomplete: false,
      };
    }

    // Get completions from provider
    const items = await provider.getCompletions(request);

    // Sort and filter
    const options = request.options || {};
    const sortedItems = this.sortAndFilter(items, options);

    // Cache result
    this.cache.set(cacheKey, {
      items: sortedItems,
      timestamp: Date.now(),
    });

    return {
      items: sortedItems.slice(0, options.maxResults || 100),
      context: request.context || this.buildContext(request),
      isIncomplete: false,
    };
  }

  /**
   * Get trigger characters for a language
   */
  getTriggerCharacters(language: SupportedLanguage): string[] {
    const provider = this.providers.get(language);
    return provider ? provider.getTriggerCharacters() : [];
  }

  /**
   * Build completion context from request
   */
  private buildContext(request: CompletionRequest): CompletionContext {
    const lines = request.code.split('\n');
    const cursorLine = lines[request.cursor.line] || '';

    return {
      filePath: request.context?.filePath,
      imports: this.extractImports(request.code, request.language),
      symbols: this.extractSymbols(request.code, request.language),
      surroundingCode: {
        before: cursorLine.substring(0, request.cursor.column),
        after: cursorLine.substring(request.cursor.column),
      },
    };
  }

  /**
   * Extract imports from code
   */
  private extractImports(code: string, language: SupportedLanguage): Import[] {
    const imports: Import[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (language === 'typescript' || language === 'javascript') {
        const importMatch = line.match(/^import\s+(?:(\{[^}]+\})|(\*[^]*?\*)|([^,]*))\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          imports.push({
            module: importMatch[4],
            symbols: importMatch[1] ? importMatch[1].slice(1, -1).split(',').map(s => s.trim()) : [],
            isDefault: !!importMatch[3],
            line: i,
          });
        }
      } else if (language === 'python') {
        const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/);
        if (importMatch) {
          imports.push({
            module: importMatch[1] || '',
            symbols: importMatch[2].split(',').map(s => s.trim()),
            isDefault: false,
            line: i,
          });
        }
      }
    }

    return imports;
  }

  /**
   * Extract symbols from code
   */
  private extractSymbols(code: string, language: SupportedLanguage): Symbol[] {
    const symbols: Symbol[] = [];

    // Simple regex-based extraction (in production, use proper AST parser)
    const patterns: Record<SupportedLanguage, RegExp[]> = {
      typescript: [
        /(?:function|const|let)\s+(\w+)\s*[=:]/g,
        /class\s+(\w+)/g,
        /interface\s+(\w+)/g,
        /type\s+(\w+)\s*=/g,
      ],
      javascript: [
        /(?:function|const|let|var)\s+(\w+)\s*[=:]/g,
        /class\s+(\w+)/g,
      ],
      python: [
        /def\s+(\w+)\s*\(/g,
        /class\s+(\w+)/g,
      ],
      go: [
        /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/g,
        /type\s+(\w+)\s+struct/g,
      ],
      rust: [
        /fn\s+(\w+)\s*\(/g,
        /struct\s+(\w+)/g,
        /enum\s+(\w+)/g,
        /trait\s+(\w+)/g,
      ],
      java: [
        /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/g,
        /class\s+(\w+)/g,
        /interface\s+(\w+)/g,
      ],
      cpp: [],
      c: [],
      csharp: [],
      php: [],
      ruby: [],
      swift: [],
      kotlin: [],
      scala: [],
      markdown: [],
      json: [],
      yaml: [],
      toml: [],
      xml: [],
      html: [],
      css: [],
      shell: [],
      sql: [],
    };

    const langPatterns = patterns[language] || [];
    for (const pattern of langPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        symbols.push({
          name: match[1],
          kind: 'function',
          definition: { line: 0, column: 0 },
        });
      }
    }

    return symbols;
  }

  /**
   * Generate cache key from request
   */
  private getCacheKey(request: CompletionRequest): string {
    const prefix = request.code.substring(0, Math.min(1000, request.code.length));
    return `${request.language}:${request.cursor.line}:${request.cursor.column}:${prefix}`;
  }

  /**
   * Sort and filter completion items
   */
  private sortAndFilter(items: CompletionItem[], options: CompletionOptions): CompletionItem[] {
    let result = items;

    // Filter by relevance if context prioritization is enabled
    if (options.prioritizeBasedOnContext) {
      result = result.filter(item => item.score && item.score > 0.3);
    }

    // Sort by score/sort text
    result.sort((a, b) => {
      if (a.preselect && !b.preselect) return -1;
      if (!a.preselect && b.preselect) return 1;

      const aScore = a.score || 0;
      const bScore = b.score || 0;

      if (aScore !== bScore) {
        return bScore - aScore;
      }

      return (a.sortText || a.label).localeCompare(b.sortText || b.label);
    });

    return result;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * TypeScript completion provider
 */
class TypeScriptCompletionProvider implements CompletionProvider {
  async getCompletions(request: CompletionRequest): Promise<CompletionItem[]> {
    const items: CompletionItem[] = [];
    const { code, cursor } = request;
    const lines = code.split('\n');
    const cursorLine = lines[cursor.line] || '';
    const beforeCursor = cursorLine.substring(0, cursor.column);

    // Detect context and provide relevant completions
    if (this.isInImportStatement(beforeCursor)) {
      items.push(...this.getModuleCompletions(beforeCursor));
    } else if (this.isInTypeAnnotation(beforeCursor)) {
      items.push(...this.getTypeCompletions());
    } else if (this.isInFunctionCall(beforeCursor)) {
      items.push(...this.getFunctionCompletions(beforeCursor));
    } else {
      items.push(...this.getGeneralCompletions(beforeCursor));
    }

    return items;
  }

  getTriggerCharacters(): string[] {
    return ['.', '"', "'", '/', '@', '<'];
  }

  private isInImportStatement(text: string): boolean {
    return /\bimport\s+(?:\{[^}]*|\*\s*as\s+\w+)?\s*from\s+['"]?$/.test(text);
  }

  private isInTypeAnnotation(text: string): boolean {
    return /:\s*(\w+)?$/.test(text);
  }

  private isInFunctionCall(text: string): boolean {
    return /\w+\(\s*$/.test(text);
  }

  private getModuleCompletions(text: string): CompletionItem[] {
    return [
      {
        label: 'fs/promises',
        kind: 'module',
        detail: 'Node.js filesystem promises API',
        insertText: 'fs/promises',
      },
      {
        label: 'path',
        kind: 'module',
        detail: 'Node.js path utilities',
        insertText: 'path',
      },
      {
        label: 'zod',
        kind: 'module',
        detail: 'Zod validation library',
        insertText: 'zod',
      },
      {
        label: 'hono',
        kind: 'module',
        detail: 'Hono web framework',
        insertText: 'hono',
      },
    ];
  }

  private getTypeCompletions(): CompletionItem[] {
    return [
      { label: 'string', kind: 'type', insertText: 'string' },
      { label: 'number', kind: 'type', insertText: 'number' },
      { label: 'boolean', kind: 'type', insertText: 'boolean' },
      { label: 'void', kind: 'type', insertText: 'void' },
      { label: 'any', kind: 'type', insertText: 'any' },
      { label: 'unknown', kind: 'type', insertText: 'unknown' },
      { label: 'Promise', kind: 'class', insertText: 'Promise<' },
      { label: 'Array', kind: 'class', insertText: 'Array<' },
      { label: 'Map', kind: 'class', insertText: 'Map<' },
      { label: 'Set', kind: 'class', insertText: 'Set<' },
      { label: 'Record', kind: 'type', insertText: 'Record<string, ' },
    ];
  }

  private getFunctionCompletions(text: string): CompletionItem[] {
    const functionName = text.match(/(\w+)\(\s*$/)?.[1];

    if (functionName === 'console.log') {
      return [
        {
          label: 'JSON.stringify',
          kind: 'function',
          detail: 'Convert object to JSON string',
          insertText: 'JSON.stringify($0)',
          insertTextFormat: 'snippet',
        },
      ];
    }

    return [
      {
        label: 'fetch',
        kind: 'function',
        detail: 'Make HTTP request',
        insertText: 'fetch($1)',
        insertTextFormat: 'snippet',
      },
      {
        label: 'JSON.parse',
        kind: 'function',
        detail: 'Parse JSON string',
        insertText: 'JSON.parse($1)',
        insertTextFormat: 'snippet',
      },
    ];
  }

  private getGeneralCompletions(text: string): CompletionItem[] {
    const items: CompletionItem[] = [];

    // Keywords
    const keywords = [
      'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
      'return', 'async', 'await', 'try', 'catch', 'finally', 'throw',
      'class', 'interface', 'type', 'enum', 'import', 'export', 'from',
      'default', 'extends', 'implements', 'new', 'this', 'super',
    ];

    for (const keyword of keywords) {
      items.push({
        label: keyword,
        kind: 'keyword',
        insertText: keyword,
      });
    }

    // Common snippets
    items.push(
      {
        label: 'function',
        kind: 'snippet',
        detail: 'Function declaration',
        documentation: 'Insert a function declaration',
        insertText: 'function ${1:name}(${2:params}): ${3:returnType} {\n\t$0\n}',
        insertTextFormat: 'snippet',
        score: 0.9,
      },
      {
        label: 'async-function',
        kind: 'snippet',
        detail: 'Async function',
        documentation: 'Insert an async function',
        insertText: 'async function ${1:name}(${2:params}): Promise<${3:returnType}> {\n\t$0\n}',
        insertTextFormat: 'snippet',
        score: 0.9,
      },
      {
        label: 'arrow-function',
        kind: 'snippet',
        detail: 'Arrow function',
        documentation: 'Insert an arrow function',
        insertText: '(${1:params}) => {\n\t$0\n}',
        insertTextFormat: 'snippet',
        score: 0.9,
      },
      {
        label: 'interface',
        kind: 'snippet',
        detail: 'Interface declaration',
        documentation: 'Insert an interface',
        insertText: 'interface ${1:name} {\n\t$0\n}',
        insertTextFormat: 'snippet',
        score: 0.9,
      },
      {
        label: 'class',
        kind: 'snippet',
        detail: 'Class declaration',
        documentation: 'Insert a class',
        insertText: 'class ${1:name} {\n\tconstructor(${2:params}) {\n\t\t$0\n\t}\n}',
        insertTextFormat: 'snippet',
        score: 0.9,
      },
      {
        label: 'try-catch',
        kind: 'snippet',
        detail: 'Try-catch block',
        documentation: 'Insert try-catch block',
        insertText: 'try {\n\t$0\n} catch (error) {\n\tconsole.error(error);\n}',
        insertTextFormat: 'snippet',
        score: 0.85,
      }
    );

    return items;
  }
}

/**
 * JavaScript completion provider
 */
class JavaScriptCompletionProvider extends TypeScriptCompletionProvider {
  getTriggerCharacters(): string[] {
    return ['.', '"', "'", '/'];
  }

  private getTypeCompletions(): CompletionItem[] {
    return [];
  }
}

/**
 * Python completion provider
 */
class PythonCompletionProvider implements CompletionProvider {
  async getCompletions(request: CompletionRequest): Promise<CompletionItem[]> {
    const items: CompletionItem[] = [];

    // Python keywords
    const keywords = [
      'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return',
      'import', 'from', 'as', 'try', 'except', 'finally', 'raise',
      'with', 'lambda', 'async', 'await', 'yield', 'pass', 'break',
      'continue', 'global', 'nonlocal', 'assert', 'del', 'in', 'is',
    ];

    for (const keyword of keywords) {
      items.push({
        label: keyword,
        kind: 'keyword',
        insertText: keyword,
      });
    }

    // Common snippets
    items.push(
      {
        label: 'function',
        kind: 'snippet',
        detail: 'Function definition',
        insertText: 'def ${1:name}(${2:params}):\n\t"""${3:docstring}"""\n\t$0',
        insertTextFormat: 'snippet',
      },
      {
        label: 'async-function',
        kind: 'snippet',
        detail: 'Async function',
        insertText: 'async def ${1:name}(${2:params}):\n\t"""${3:docstring}"""\n\t$0',
        insertTextFormat: 'snippet',
      },
      {
        label: 'class',
        kind: 'snippet',
        detail: 'Class definition',
        insertText: 'class ${1:name}:\n\t"""${2:docstring}"""\n\tdef __init__(self${3:params}):\n\t\t$0',
        insertTextFormat: 'snippet',
      },
      {
        label: 'try-except',
        kind: 'snippet',
        detail: 'Try-except block',
        insertText: 'try:\n\t$0\nexcept Exception as e:\n\tprint(e)',
        insertTextFormat: 'snippet',
      },
      {
        label: 'for-loop',
        kind: 'snippet',
        detail: 'For loop',
        insertText: 'for ${1:item} in ${2:items}:\n\t$0',
        insertTextFormat: 'snippet',
      }
    );

    // Built-in functions
    const builtins = [
      'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict',
      'set', 'tuple', 'bool', 'type', 'isinstance', 'hasattr', 'getattr',
      'setattr', 'open', 'input', 'sorted', 'sum', 'min', 'max', 'abs',
      'enumerate', 'zip', 'map', 'filter', 'any', 'all',
    ];

    for (const builtin of builtins) {
      items.push({
        label: builtin,
        kind: 'function',
        insertText: builtin,
        score: 0.8,
      });
    }

    return items;
  }

  getTriggerCharacters(): string[] {
    return ['.', '"', "'", '@', '('];
  }
}

/**
 * Go completion provider
 */
class GoCompletionProvider implements CompletionProvider {
  async getCompletions(request: CompletionRequest): Promise<CompletionItem[]> {
    const items: CompletionItem[] = [];

    // Keywords
    const keywords = [
      'func', 'var', 'const', 'type', 'struct', 'interface',
      'if', 'else', 'for', 'range', 'return', 'go', 'select',
      'case', 'default', 'switch', 'defer', 'goto', 'fallthrough',
      'package', 'import', 'break', 'continue',
    ];

    for (const keyword of keywords) {
      items.push({
        label: keyword,
        kind: 'keyword',
        insertText: keyword,
      });
    }

    // Snippets
    items.push(
      {
        label: 'function',
        kind: 'snippet',
        detail: 'Function declaration',
        insertText: 'func ${1:name}(${2:params}) ${3:returnType} {\n\t$0\n}',
        insertTextFormat: 'snippet',
      },
      {
        label: 'struct',
        kind: 'snippet',
        detail: 'Struct definition',
        insertText: 'type ${1:name} struct {\n\t$0\n}',
        insertTextFormat: 'snippet',
      },
      {
        label: 'interface',
        kind: 'snippet',
        detail: 'Interface definition',
        insertText: 'type ${1:name} interface {\n\t$0\n}',
        insertTextFormat: 'snippet',
      },
      {
        label: 'for-range',
        kind: 'snippet',
        detail: 'For-range loop',
        insertText: 'for ${1:key}, ${2:value} := range ${3:collection} {\n\t$0\n}',
        insertTextFormat: 'snippet',
      }
    );

    return items;
  }

  getTriggerCharacters(): string[] {
    return ['.', '"', "'"];
  }
}

/**
 * Rust completion provider
 */
class RustCompletionProvider implements CompletionProvider {
  async getCompletions(request: CompletionRequest): Promise<CompletionItem[]> {
    const items: CompletionItem[] = [];

    // Keywords
    const keywords = [
      'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'trait',
      'impl', 'type', 'where', 'if', 'else', 'match', 'for', 'while',
      'loop', 'return', 'break', 'continue', 'move', 'unsafe', 'async',
      'await', 'mod', 'use', 'crate', 'pub', 'ref', 'dyn',
    ];

    for (const keyword of keywords) {
      items.push({
        label: keyword,
        kind: 'keyword',
        insertText: keyword,
      });
    }

    // Snippets
    items.push(
      {
        label: 'function',
        kind: 'snippet',
        detail: 'Function declaration',
        insertText: 'fn ${1:name}(${2:params})${3: -> ReturnType} {\n\t$0\n}',
        insertTextFormat: 'snippet',
      },
      {
        label: 'struct',
        kind: 'snippet',
        detail: 'Struct definition',
        insertText: 'struct ${1:Name} {\n\t$0\n}',
        insertTextFormat: 'snippet',
      },
      {
        label: 'impl',
        kind: 'snippet',
        detail: 'Impl block',
        insertText: 'impl ${1:StructName} {\n\t$0\n}',
        insertTextFormat: 'snippet',
      },
      {
        label: 'match',
        kind: 'snippet',
        detail: 'Match expression',
        insertText: 'match ${1:value} {\n\t${2:pattern} => ${3:expression},\n\t$0\n}',
        insertTextFormat: 'snippet',
      }
    );

    return items;
  }

  getTriggerCharacters(): string[] {
    return ['.', ':', '"', "'", '<'];
  }
}

/**
 * Java completion provider
 */
class JavaCompletionProvider implements CompletionProvider {
  async getCompletions(request: CompletionRequest): Promise<CompletionItem[]> {
    const items: CompletionItem[] = [];

    // Keywords
    const keywords = [
      'class', 'interface', 'extends', 'implements', 'public', 'private',
      'protected', 'static', 'final', 'abstract', 'void', 'int', 'String',
      'boolean', 'double', 'float', 'long', 'char', 'byte', 'short',
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return',
      'new', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'throws',
      'import', 'package', 'enum', 'var', 'assert', 'break', 'continue',
      'default', 'goto', 'instanceof', 'native', 'synchronized', 'transient',
      'volatile',
    ];

    for (const keyword of keywords) {
      items.push({
        label: keyword,
        kind: 'keyword',
        insertText: keyword,
      });
    }

    // Snippets
    items.push(
      {
        label: 'class',
        kind: 'snippet',
        detail: 'Class declaration',
        insertText: 'public class ${1:Name} {\n\t$0\n}',
        insertTextFormat: 'snippet',
      },
      {
        label: 'method',
        kind: 'snippet',
        detail: 'Method declaration',
        insertText: 'public ${1:void} ${2:name}(${3:params}) {\n\t$0\n}',
        insertTextFormat: 'snippet',
      },
      {
        label: 'main',
        kind: 'snippet',
        detail: 'Main method',
        insertText: 'public static void main(String[] args) {\n\t$0\n}',
        insertTextFormat: 'snippet',
        preselect: true,
      }
    );

    return items;
  }

  getTriggerCharacters(): string[] {
    return ['.', '"', "'", '@'];
  }
}

/**
 * Create completion engine instance
 */
export function createCompletionEngine(): CodeCompletionEngine {
  return new CodeCompletionEngine();
}

/**
 * Default completion engine instance
 */
let defaultCompletionEngine: CodeCompletionEngine | null = null;

export function setDefaultCompletionEngine(engine: CodeCompletionEngine): void {
  defaultCompletionEngine = engine;
}

export function getDefaultCompletionEngine(): CodeCompletionEngine {
  if (!defaultCompletionEngine) {
    defaultCompletionEngine = new CodeCompletionEngine();
  }
  return defaultCompletionEngine;
}

/**
 * Convenience function for quick completion
 */
export async function getCompletions(request: CompletionRequest): Promise<CompletionResult> {
  return getDefaultCompletionEngine().complete(request);
}
