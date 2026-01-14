/**
 * Code Chunker
 *
 * Splits code into semantic chunks while maintaining context
 * and preserving code structure for better retrieval.
 *
 * Performance Targets:
 * - Chunk 1MB file: <20ms
 * - Maintain context overlap: <5ms
 * - Preserve structure: <10ms
 */

import type {
  CodeChunk,
  SupportedLanguage,
  ChunkerOptions,
  ChunkType,
  ParsedFile,
} from './types';

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  maxSize: 2000,
  overlap: 200,
  byStructure: true,
  minSize: 100,
  preserveStructure: true,
};

/**
 * Code structure patterns for different languages
 */
const STRUCTURE_PATTERNS: Record<
  SupportedLanguage,
  {
    function?: RegExp;
    class?: RegExp;
    blockStart?: RegExp;
    blockEnd?: RegExp;
  }
> = {
  typescript: {
    function: /(?:^|\n)\s*(?:async\s+)?(?:function\s+)?(?:\w+)\s*(?:<[^>]+>)?\s*\(/,
    class: /(?:^|\n)\s*(?:abstract\s+)?class\s+\w+/,
    blockStart: /{\s*(?:\/\*[\s\S]*?\*\/\s*)*$/,
    blockEnd: /^\s*}/,
  },
  javascript: {
    function: /(?:^|\n)\s*(?:async\s+)?(?:function\s+)?(?:\w+)\s*\(/,
    class: /(?:^|\n)\s*class\s+\w+/,
    blockStart: /{\s*(?:\/\*[\s\S]*?\*\/\s*)*$/,
    blockEnd: /^\s*}/,
  },
  python: {
    function: /(?:^|\n)\s*def\s+\w+\s*\(/,
    class: /(?:^|\n)\s*class\s+\w+/,
    blockStart: /:\s*(?:#[^\n]*)?$/,
    blockEnd: /^(?!\s)/, // Dedent marks end
  },
  java: {
    function: /(?:^|\n)\s*(?:public|private|protected)?\s*(?:static\s+)?(?:\w+)\s+\w+\s*\(/,
    class: /(?:^|\n)\s*(?:public\s+)?(?:abstract\s+)?class\s+\w+/,
    blockStart: /{\s*(?:\/\*[\s\S]*?\*\/\s*)*$/,
    blockEnd: /^\s*}/,
  },
  go: {
    function: /(?:^|\n)\s*func\s+(?:\([^)]+\)\s+)?\w+/,
    blockStart: /{\s*(?:\/\/.*\s*)*$/,
    blockEnd: /^\s*}/,
  },
  rust: {
    function: /(?:^|\n)\s*(?:pub\s+)?(?:async\s+)?fn\s+\w+/,
    class: /(?:^|\n)\s*struct\s+\w+/,
    blockStart: /{\s*(?:\/\/.*\s*)*$/,
    blockEnd: /^\s*}/,
  },
  cpp: {
    function: /(?:^|\n)\s*(?:\w+)\s+\w+\s*\(/,
    class: /(?:^|\n)\s*class\s+\w+/,
    blockStart: /{\s*(?:\/\*[\s\S]*?\*\/\s*)*$/,
    blockEnd: /^\s*}/,
  },
  c: {
    function: /(?:^|\n)\s*(?:\w+)\s+\w+\s*\(/,
    blockStart: /{\s*(?:\/\*[\s\S]*?\*\/\s*)*$/,
    blockEnd: /^\s*}/,
  },
  csharp: {
    function: /(?:^|\n)\s*(?:public|private|protected)?\s*(?:static\s+)?(?:\w+)\s+\w+\s*\(/,
    class: /(?:^|\n)\s*(?:public\s+)?class\s+\w+/,
    blockStart: /{\s*(?:\/\*[\s\S]*?\*\/\s*)*$/,
    blockEnd: /^\s*}/,
  },
  php: {
    function: /(?:^|\n)\s*function\s+\w+\s*\(/,
    class: /(?:^|\n)\s*class\s+\w+/,
    blockStart: /{\s*(?:\/\/.*\s*)*$/,
    blockEnd: /^\s*}/,
  },
  ruby: {
    function: /(?:^|\n)\s*def\s+\w+/,
    class: /(?:^|\n)\s*class\s+\w+/,
    blockStart: /(?:$|\s)#.*$/,
    blockEnd: /^end$/,
  },
  swift: {
    function: /(?:^|\n)\s*func\s+\w+/,
    class: /(?:^|\n)\s*class\s+\w+/,
    blockStart: /{\s*(?:\/\/.*\s*)*$/,
    blockEnd: /^\s*}/,
  },
  kotlin: {
    function: /(?:^|\n)\s*fun\s+\w+/,
    class: /(?:^|\n)\s*(?:open\s+)?class\s+\w+/,
    blockStart: /{\s*(?:\/\/.*\s*)*$/,
    blockEnd: /^\s*}/,
  },
  scala: {
    function: /(?:^|\n)\s*def\s+\w+/,
    class: /(?:^|\n)\s*class\s+\w+/,
    blockStart: /{\s*(?:\/\/.*\s*)*$/,
    blockEnd: /^\s*}/,
  },
  markdown: {
    blockStart: /```/,
    blockEnd: /```/,
  },
  json: {},
  yaml: {},
  toml: {},
  xml: {},
  html: {},
  css: {},
  shell: {
    function: /(?:^|\n)\s*\w+\s*\(\s*\)\s*\{/,
    blockStart: /\{/,
    blockEnd: /^\}/,
  },
  sql: {
    function: /(?:^|\n)\s*(?:CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|DEFINER\s*=\s*\w+\s+FUNCTION)\s+(?:\w+\.)?\w+/,
  },
};

/**
 * Code Chunker
 */
export class CodeChunker {
  private options: Required<ChunkerOptions>;

  constructor(options: ChunkerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Chunk parsed file into semantic pieces
   *
   * @param parsed - Parsed file to chunk
   * @returns Array of code chunks
   */
  async chunk(parsed: ParsedFile): Promise<CodeChunk[]> {
    const startTime = performance.now();

    let chunks: CodeChunk[];

    if (this.options.byStructure && this.canChunkByStructure(parsed.language)) {
      chunks = this.chunkByStructure(parsed);
    } else {
      chunks = this.chunkBySize(parsed);
    }

    // Add overlap between chunks for context
    if (this.options.overlap > 0) {
      chunks = this.addOverlap(chunks);
    }

    // Link dependencies
    chunks = this.linkDependencies(chunks);

    const latency = performance.now() - startTime;
    console.debug(`Chunked ${parsed.path} into ${chunks.length} chunks in ${latency.toFixed(2)}ms`);

    return chunks;
  }

  /**
   * Chunk by code structure (functions, classes, etc.)
   *
   * @private
   */
  private chunkByStructure(parsed: ParsedFile): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = parsed.content.split('\n');
    const patterns = STRUCTURE_PATTERNS[parsed.language];

    if (!patterns) {
      return this.chunkBySize(parsed);
    }

    let currentChunk: {
      startLine: number;
      content: string[];
      type: ChunkType;
      name?: string;
      bracketDepth: number;
      inBlock: boolean;
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for function/class start
      const isFunctionStart = patterns.function?.test(line);
      const isClassStart = patterns.class?.test(line);

      if (isFunctionStart || isClassStart) {
        // Save previous chunk if exists
        if (currentChunk && currentChunk.content.length > 0) {
          chunks.push(this.finalizeChunk(currentChunk, parsed.path, parsed.language, i));
        }

        // Extract name
        const nameMatch = line.match(/(?:function|class|def|func|interface)\s+(\w+)/);
        const name = nameMatch ? nameMatch[1] : undefined;

        // Start new chunk
        currentChunk = {
          startLine: lineNum,
          content: [line],
          type: isFunctionStart ? 'function' : 'class',
          name,
          bracketDepth: 0,
          inBlock: false,
        };

        // Check if block starts on same line
        if (patterns.blockStart?.test(line)) {
          currentChunk.bracketDepth = this.countBrackets(line);
          currentChunk.inBlock = true;
        }

        continue;
      }

      // Track bracket depth
      if (currentChunk && currentChunk.inBlock) {
        currentChunk.bracketDepth += this.countBrackets(line);

        // Check if block ends
        if (currentChunk.bracketDepth <= 0 && patterns.blockEnd?.test(line)) {
          currentChunk.content.push(line);
          chunks.push(this.finalizeChunk(currentChunk, parsed.path, parsed.language, lineNum));
          currentChunk = null;
          continue;
        }
      }

      // Add line to current chunk
      if (currentChunk) {
        currentChunk.content.push(line);

        // Check if chunk is too large
        const content = currentChunk.content.join('\n');
        if (content.length > this.options.maxSize) {
          chunks.push(this.finalizeChunk(currentChunk, parsed.path, parsed.language, lineNum));
          currentChunk = null;
        }
      }
    }

    // Don't forget the last chunk
    if (currentChunk && currentChunk.content.length > 0) {
      chunks.push(this.finalizeChunk(currentChunk, parsed.path, parsed.language, lines.length));
    }

    // If no chunks were created, fall back to size-based chunking
    if (chunks.length === 0) {
      return this.chunkBySize(parsed);
    }

    return chunks;
  }

  /**
   * Chunk by size (fallback)
   *
   * @private
   */
  private chunkBySize(parsed: ParsedFile): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const content = parsed.content;
    let startPos = 0;

    while (startPos < content.length) {
      let endPos = Math.min(startPos + this.options.maxSize, content.length);

      // Try to break at a newline
      if (endPos < content.length) {
        const lastNewline = content.lastIndexOf('\n', endPos);
        if (lastNewline > startPos + this.options.minSize) {
          endPos = lastNewline + 1;
        }
      }

      const chunkContent = content.substring(startPos, endPos);
      const lines = chunkContent.split('\n');
      const startLine = content.substring(0, startPos).split('\n').length + 1;
      const endLine = startLine + lines.length - 1;

      chunks.push({
        id: this.generateChunkId(parsed.path, startLine, endLine),
        filePath: parsed.path,
        language: parsed.language,
        content: chunkContent,
        startLine,
        endLine,
        type: 'other',
        dependencies: [],
        imports: parsed.imports.filter(imp => imp.line >= startLine && imp.line <= endLine),
        exports: parsed.exports.filter(exp => exp.line >= startLine && exp.line <= endLine),
      });

      startPos = endPos;
    }

    return chunks;
  }

  /**
   * Add overlap between chunks for context
   *
   * @private
   */
  private addOverlap(chunks: CodeChunk[]): CodeChunk[] {
    if (chunks.length <= 1) {
      return chunks;
    }

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currChunk = chunks[i];

      // Get overlap from previous chunk
      const prevLines = prevChunk.content.split('\n');
      const overlapLines = Math.min(
        this.options.overlap,
        prevLines.length,
        Math.floor(this.options.overlap / 50) // Approximate 50 chars per line
      );

      if (overlapLines > 0) {
        const overlapContent = prevLines.slice(-overlapLines).join('\n');
        currChunk.content = overlapContent + '\n...\n' + currChunk.content;
        currChunk.startLine = Math.max(1, prevChunk.endLine - overlapLines + 1);
      }
    }

    return chunks;
  }

  /**
   * Link dependencies between chunks
   *
   * @private
   */
  private linkDependencies(chunks: CodeChunk[]): CodeChunk[] {
    // Create a map of chunk IDs by function/class name
    const nameToId = new Map<string, string>();
    for (const chunk of chunks) {
      if (chunk.name) {
        nameToId.set(chunk.name, chunk.id);
      }
    }

    // Link chunks based on references
    for (const chunk of chunks) {
      const dependencies: string[] = [];

      // Find references to other functions/classes
      for (const [name, id] of nameToId.entries()) {
        if (name === chunk.name) continue;

        // Check if name is referenced in chunk content
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        if (regex.test(chunk.content) && chunk.type !== 'import') {
          dependencies.push(id);
        }
      }

      chunk.dependencies = dependencies;
    }

    return chunks;
  }

  /**
   * Finalize a chunk
   *
   * @private
   */
  private finalizeChunk(
    chunkData: {
      startLine: number;
      content: string[];
      type: ChunkType;
      name?: string;
    },
    filePath: string,
    language: SupportedLanguage,
    endLine: number
  ): CodeChunk {
    const content = chunkData.content.join('\n');
    const startLine = chunkData.startLine;

    return {
      id: this.generateChunkId(filePath, startLine, endLine),
      filePath,
      language,
      content,
      startLine,
      endLine,
      type: chunkData.type,
      name: chunkData.name,
      dependencies: [],
      imports: [],
      exports: [],
    };
  }

  /**
   * Check if language supports structure-based chunking
   *
   * @private
   */
  private canChunkByStructure(language: SupportedLanguage): boolean {
    const patterns = STRUCTURE_PATTERNS[language];
    return !!(patterns?.function || patterns?.class);
  }

  /**
   * Count brackets in a line
   *
   * @private
   */
  private countBrackets(line: string): number {
    let depth = 0;
    for (const char of line) {
      if (char === '{') depth++;
      if (char === '}') depth--;
    }
    return depth;
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
   * Estimate token count for text
   *
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get chunk statistics
   *
   * @param chunks - Array of chunks
   * @returns Statistics about the chunks
   */
  getChunkStats(chunks: CodeChunk[]): {
    totalChunks: number;
    totalTokens: number;
    avgChunkSize: number;
    avgTokensPerChunk: number;
    byType: Record<ChunkType, number>;
  } {
    const byType: Record<string, number> = {};
    let totalTokens = 0;
    let totalSize = 0;

    for (const chunk of chunks) {
      byType[chunk.type] = (byType[chunk.type] || 0) + 1;
      totalTokens += this.estimateTokens(chunk.content);
      totalSize += chunk.content.length;
    }

    return {
      totalChunks: chunks.length,
      totalTokens,
      avgChunkSize: totalSize / chunks.length,
      avgTokensPerChunk: totalTokens / chunks.length,
      byType: byType as Record<ChunkType, number>,
    };
  }
}

/**
 * Create a chunker instance
 */
export function createChunker(options?: ChunkerOptions): CodeChunker {
  return new CodeChunker(options);
}

/**
 * Default chunker instance
 */
export const defaultChunker = new CodeChunker();
