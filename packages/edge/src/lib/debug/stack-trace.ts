/**
 * Universal Stack Trace Parser
 *
 * Parses stack traces from 20+ programming languages with high accuracy.
 * Supports source code linking, async call stack unwinding, and frame filtering.
 *
 * Supported Languages:
 * - JavaScript/TypeScript (V8, Node.js, Deno, Bun)
 * - Python (CPython, PyPy)
 * - Java (JVM stack traces)
 * - C# (.NET stack traces)
 * - Go (Go stack traces)
 * - Rust (panic backtraces)
 * - Ruby (Ruby backtraces)
 * - PHP (stack traces)
 * - Swift (Swift backtraces)
 * - Kotlin (JVM stack traces)
 * - Scala (JVM stack traces)
 * - Clojure (JVM stack traces)
 * - Erlang (process crashes)
 * - Elixir (stacktraces)
 * - Lua (stack traces)
 * - Perl (carp/confess)
 * - Bash (caller traces)
 * - PowerShell (stack traces)
 */

import type {
  StackFrame,
  StackTrace,
  StackTraceParseResult,
  Language,
} from './types';
import { Language as LangEnum } from './types';

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Language-specific patterns for stack trace detection
 */
const LANGUAGE_PATTERNS: Record<Language, RegExp[]> = {
  [LangEnum.JAVASCRIPT]: [
    /^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)\s*$/,
    /^\s*at\s+(.+?)\s+\((.+?):(\d+)\)\s*$/,
    /^\s*at\s+(.+?):(\d+):(\d+)\s*$/,
    /^\s*at\s+(.+?)\s*\((native)\)\s*$/,
  ],
  [LangEnum.TYPESCRIPT]: [
    // TypeScript uses same format as JavaScript
    /^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)\s*$/,
    /^\s*at\s+(.+?)\s+\((.+?):(\d+)\)\s*$/,
  ],
  [LangEnum.PYTHON]: [
    /^\s*File\s+"(.+?)",\s+line\s+(\d+),\s+in\s+(.+)$/,
    /^\s*File\s+"(.+?)",\s+line\s+(\d+)$/,
    /^\s*.+?,\s+in\s+(.+)$/,
  ],
  [LangEnum.JAVA]: [
    /^\s*at\s+([<>.\w]+)\((.+?:(\d+))\)\s*$/,
    /^\s*at\s+([<>.\w]+)\(Native\s+Method\)\s*$/,
    /^\s*at\s+([<>.\w]+)\(Unknown\s+Source\)\s*$/,
  ],
  [LangEnum.CSHARP]: [
    /^\s*at\s+(.+?)\s+in\s+(.+?):line\s+(\d+)\s*$/,
    /^\s*at\s+(.+?)\(\)\s*$/,
  ],
  [LangEnum.CPP]: [
    /^\s*#0\s+(0x[0-9a-f]+\s+in\s+)?(.+?)\s+\((.+?):(\d+)\)\s*$/,
    /^\s*#(\d+)\s+(0x[0-9a-f]+\s+in\s+)?(.+?)\s+\((.+?):(\d+)\)\s*$/,
  ],
  [LangEnum.RUST]: [
    /^\s*\d+:\s+(.+?)\s*::\s*\w+\s*\n\s+at\s+(.+?):(\d+)$/,
    /^\s*\d+:\s+(.+?)\s*\n\s+at\s+(.+?):(\d+)$/,
  ],
  [LangEnum.GO]: [
    /^\s*(.+?)\s*\n\s+created\s+by\s+(.+?)\s+in\s+goroutine\s+\d+\s*\n\s+(.+?):(\d+)$/,
    /^\s*(.+?)\s*\n\s+(.+?):(\d+)$/,
  ],
  [LangEnum.RUBY]: [
    /^\s*from\s+(.+?):(\d+):in\s+`(.+?)'$/,
    /^\s*(.+?):(\d+):in\s+`(.+?)'$/,
  ],
  [LangEnum.PHP]: [
    /^\s*#\d+\s+(.+?)\((\d+)\):\s+(.+?)\(\)$/,
    /^\s*#\d+\s+(.+?):(\d+)$/,
  ],
  [LangEnum.SWIFT]: [
    /^\s*\d+\s+(.+?)\s+\$(.+?):(\d+)$/,
    /^\s*at\s+(.+?):(\d+)$/,
  ],
  [LangEnum.KOTLIN]: [
    // Kotlin uses JVM format
    /^\s*at\s+([<>.\w]+)\((.+?:(\d+))\)\s*$/,
    /^\s*at\s+([<>.\w]+)\(Unknown\s+Source\)\s*$/,
  ],
  [LangEnum.SCALA]: [
    // Scala uses JVM format
    /^\s*at\s+([<>.\w]+)\((.+?:(\d+))\)\s*$/,
  ],
  [LangEnum.CLOJURE]: [
    // Clojure uses JVM format
    /^\s*at\s+([<>.\w\/]+)\((.+?:(\d+))\)\s*$/,
  ],
  [LangEnum.ERLANG]: [
    /^\s*[\[{]?(.+?):(\d+)[\]}]?$/,
  ],
  [LangEnum.ELIXIR]: [
    /^\s*\((.+?)\s+(.+?):(\d+)\)\s*$/,
  ],
  [LangEnum.LUA]: [
    /^\s*(.+?):(\d+):\s+in\s+(.+?)$/,
  ],
  [LangEnum.PERL]: [
    /^\s*\t(.+?)\s+called\s+at\s+(.+?)\s+line\s+(\d+)$/,
  ],
  [LangEnum.BASH]: [
    /^\s*(.+?),\s+line\s+(\d+)$/,
  ],
  [LangEnum.POWERSHELL]: [
    /^\s*at\s+(.+?),\s+(.+?):\s+line\s+(\d+)$/,
  ],
  [LangEnum.UNKNOWN]: [],
};

/**
 * Detect language from stack trace content
 */
function detectLanguage(stackTrace: string): Language {
  const lowerTrace = stackTrace.toLowerCase();

  // Check for language-specific keywords
  if (lowerTrace.includes('at ') && lowerTrace.includes('.js')) {
    return LangEnum.JAVASCRIPT;
  }
  if (lowerTrace.includes('at ') && lowerTrace.includes('.ts')) {
    return LangEnum.TYPESCRIPT;
  }
  if (lowerTrace.includes('file "') || lowerTrace.includes('traceback')) {
    return LangEnum.PYTHON;
  }
  if (lowerTrace.includes('at ') && lowerTrace.includes('.java')) {
    return LangEnum.JAVA;
  }
  if (lowerTrace.includes('at ') && lowerTrace.includes('.cs')) {
    return LangEnum.CSHARP;
  }
  if (lowerTrace.includes('#0') || lowerTrace.includes('#1')) {
    return LangEnum.CPP;
  }
  if (lowerTrace.includes('panicked at') || lowerTrace.includes('backtrace')) {
    return LangEnum.RUST;
  }
  if (lowerTrace.includes('goroutine') || lowerTrace.includes('go:')) {
    return LangEnum.GO;
  }
  if (lowerTrace.includes('from ') && lowerTrace.includes('.rb:')) {
    return LangEnum.RUBY;
  }
  if (lowerTrace.includes('.php:') || lowerTrace.includes('php')) {
    return LangEnum.PHP;
  }
  if (lowerTrace.includes('.swift:')) {
    return LangEnum.SWIFT;
  }
  if (lowerTrace.includes('.kt:')) {
    return LangEnum.KOTLIN;
  }
  if (lowerTrace.includes('.scala:')) {
    return LangEnum.SCALA;
  }
  if (lowerTrace.includes('clj:') || lowerTrace.includes('clojure')) {
    return LangEnum.CLOJURE;
  }
  if (lowerTrace.includes('erl:') || lowerTrace.includes('.erl:')) {
    return LangEnum.ERLANG;
  }
  if (lowerTrace.includes('ex:') || lowerTrace.includes('.exs:')) {
    return LangEnum.ELIXIR;
  }
  if (lowerTrace.includes('.lua:')) {
    return LangEnum.LUA;
  }
  if (lowerTrace.includes('called at')) {
    return LangEnum.PERL;
  }
  if (lowerTrace.includes('line ') && lowerTrace.includes('.sh:')) {
    return LangEnum.BASH;
  }
  if (lowerTrace.includes('powershell') || lowerTrace.includes('.ps1:')) {
    return LangEnum.POWERSHELL;
  }

  return LangEnum.UNKNOWN;
}

// ============================================================================
// LANGUAGE-SPECIFIC PARSERS
// ============================================================================

/**
 * Parse JavaScript/TypeScript stack trace
 */
function parseJavaScriptStack(
  stackTrace: string,
  language: LangEnum.JAVASCRIPT | LangEnum.TYPESCRIPT
): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stackTrace.split('\n').filter(line => line.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip error message lines
    if (line.startsWith('Error:') || line.match(/^[A-Z]\w+Error:/)) {
      continue;
    }

    // Parse frame
    const match =
      line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)\s*$/) ||
      line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+)\)\s*$/) ||
      line.match(/^\s*at\s+(.+?):(\d+):(\d+)\s*$/) ||
      line.match(/^\s*at\s+(.+?)\s*\((native)\)\s*$/);

    if (match) {
      const frame: StackFrame = {
        index: frames.length,
        language,
        raw: line,
        isAsync: line.includes('async') || line.includes('Promise'),
        isLibrary: false,
        isApp: false,
      };

      if (match[4]) {
        // Full format: at function (file:line:col)
        frame.functionName = match[1] !== 'anonymous' ? match[1] : undefined;
        frame.filePath = match[2];
        frame.lineNumber = parseInt(match[3]);
        frame.columnNumber = parseInt(match[4]);
      } else if (match[3]) {
        // Without column: at function (file:line)
        frame.functionName = match[1] !== 'anonymous' ? match[1] : undefined;
        frame.filePath = match[2];
        frame.lineNumber = parseInt(match[3]);
      } else if (match[2]) {
        // Short format: at file:line:col
        frame.filePath = match[1];
        frame.lineNumber = parseInt(match[2]);
        frame.columnNumber = parseInt(match[3]);
      }

      // Determine if library frame
      frame.isLibrary = isLibraryPath(frame.filePath || '');
      frame.isApp = !frame.isLibrary;

      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Parse Python stack trace
 */
function parsePythonStack(stackTrace: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stackTrace.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Match "File "path", line N, in function"
    const match = line.match(/^\s*File\s+"(.+?)",\s+line\s+(\d+),\s+in\s+(.+)$/);

    if (match) {
      const frame: StackFrame = {
        index: frames.length,
        language: LangEnum.PYTHON,
        filePath: match[1],
        lineNumber: parseInt(match[2]),
        functionName: match[3],
        raw: line,
        isAsync: line.includes('async') || line.includes('await'),
        isLibrary: isLibraryPath(match[1]),
        isApp: !isLibraryPath(match[1]),
      };

      // Get next line for code context if available
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('')) {
        frame.raw += '\n' + lines[i + 1].trim();
      }

      frames.push(frame);
    }

    i++;
  }

  return frames;
}

/**
 * Parse Java stack trace
 */
function parseJavaStack(stackTrace: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stackTrace.split('\n').filter(line => line.trim().startsWith('at '));

  for (const line of lines) {
    const match =
      line.match(/^\s*at\s+([<>.\w]+)\((.+?):(\d+)\)\s*$/) ||
      line.match(/^\s*at\s+([<>.\w]+)\(Native\s+Method\)\s*$/) ||
      line.match(/^\s*at\s+([<>.\w]+)\(Unknown\s+Source\)\s*$/);

    if (match) {
      const frame: StackFrame = {
        index: frames.length,
        language: LangEnum.JAVA,
        raw: line,
        isAsync: false,
        isLibrary: false,
        isApp: false,
      };

      // Parse class and method
      const fullMethod = match[1];
      const lastDot = fullMethod.lastIndexOf('.');
      if (lastDot !== -1) {
        frame.className = fullMethod.substring(0, lastDot);
        frame.functionName = fullMethod.substring(lastDot + 1);
      } else {
        frame.functionName = fullMethod;
      }

      if (match[2] && match[3]) {
        frame.filePath = match[2];
        frame.lineNumber = parseInt(match[3]);
      }

      frame.isLibrary = isLibraryPath(frame.className || '');
      frame.isApp = !frame.isLibrary;

      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Parse Go stack trace
 */
function parseGoStack(stackTrace: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stackTrace.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Match "created by function in goroutine N"
    if (line.includes('created by ')) {
      const match = line.match(/created by\s+(.+?)\s+in\s+goroutine\s+\d+/);
      if (match) {
        const frame: StackFrame = {
          index: frames.length,
          language: LangEnum.GO,
          functionName: match[1],
          raw: line,
          isAsync: true,
          isLibrary: false,
          isApp: false,
        };

        // Check next line for file info
        if (i + 1 < lines.length) {
          const fileMatch = lines[i + 1].match(/\s*(.+?):(\d+)/);
          if (fileMatch) {
            frame.filePath = fileMatch[1];
            frame.lineNumber = parseInt(fileMatch[2]);
          }
        }

        frame.isLibrary = isLibraryPath(frame.filePath || '');
        frame.isApp = !frame.isLibrary;

        frames.push(frame);
      }
    } else {
      // Regular frame
      const match = line.match(/\s*(.+?)\s*\n\s+(.+?):(\d+)/);
      if (match) {
        const frame: StackFrame = {
          index: frames.length,
          language: LangEnum.GO,
          functionName: match[1],
          filePath: match[2],
          lineNumber: parseInt(match[3]),
          raw: line,
          isAsync: false,
          isLibrary: isLibraryPath(match[2]),
          isApp: !isLibraryPath(match[2]),
        };

        frames.push(frame);
      }
    }

    i++;
  }

  return frames;
}

/**
 * Parse Rust stack trace
 */
function parseRustStack(stackTrace: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stackTrace.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*\d+:\s+(.+?)\s*::\s*\w+\s*\n\s+at\s+(.+?):(\d+)$/);
    if (match) {
      const frame: StackFrame = {
        index: frames.length,
        language: LangEnum.RUST,
        functionName: match[1],
        filePath: match[2],
        lineNumber: parseInt(match[3]),
        raw: line,
        isAsync: line.includes('async'),
        isLibrary: isLibraryPath(match[2]),
        isApp: !isLibraryPath(match[2]),
      };

      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Parse Ruby stack trace
 */
function parseRubyStack(stackTrace: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stackTrace.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*from\s+(.+?):(\d+):in\s+`(.+?)'$/);
    if (match) {
      const frame: StackFrame = {
        index: frames.length,
        language: LangEnum.RUBY,
        filePath: match[1],
        lineNumber: parseInt(match[2]),
        functionName: match[3],
        raw: line,
        isAsync: false,
        isLibrary: isLibraryPath(match[1]),
        isApp: !isLibraryPath(match[1]),
      };

      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Parse C# stack trace
 */
function parseCSharpStack(stackTrace: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stackTrace.split('\n').filter(line => line.trim().startsWith('at '));

  for (const line of lines) {
    const match = line.match(/^\s*at\s+(.+?)\s+in\s+(.+?):line\s+(\d+)\s*$/);
    if (match) {
      const frame: StackFrame = {
        index: frames.length,
        language: LangEnum.CSHARP,
        functionName: match[1],
        filePath: match[2],
        lineNumber: parseInt(match[3]),
        raw: line,
        isAsync: line.includes('async') || line.includes('Task'),
        isLibrary: isLibraryPath(match[2]),
        isApp: !isLibraryPath(match[2]),
      };

      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Parse PHP stack trace
 */
function parsePHPStack(stackTrace: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stackTrace.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*#\d+\s+(.+?)\((\d+)\):\s+(.+?)\(\)$/);
    if (match) {
      const frame: StackFrame = {
        index: frames.length,
        language: LangEnum.PHP,
        filePath: match[1],
        lineNumber: parseInt(match[2]),
        functionName: match[3],
        raw: line,
        isAsync: false,
        isLibrary: isLibraryPath(match[1]),
        isApp: !isLibraryPath(match[1]),
      };

      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Generic parser for other languages
 */
function parseGenericStack(
  stackTrace: string,
  language: Language
): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stackTrace.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const frame: StackFrame = {
      index: frames.length,
      language,
      raw: line,
      isAsync: line.includes('async') || line.includes('await'),
      isLibrary: false,
      isApp: false,
    };

    // Try to extract common patterns
    const pathMatch = line.match(/([\/\w\-_]+\.[a-z]{2,4}):?(\d+)?:?(\d+)?/i);
    if (pathMatch) {
      frame.filePath = pathMatch[1];
      if (pathMatch[2]) {
        frame.lineNumber = parseInt(pathMatch[2]);
      }
      if (pathMatch[3]) {
        frame.columnNumber = parseInt(pathMatch[3]);
      }
      frame.isLibrary = isLibraryPath(pathMatch[1]);
      frame.isApp = !frame.isLibrary;
    }

    // Try to extract function name
    const funcMatch = line.match(/(?:in|at|function|method)\s+([^\s\(]+)/);
    if (funcMatch) {
      frame.functionName = funcMatch[1];
    }

    frames.push(frame);
  }

  return frames;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a file path is from a library/framework
 */
function isLibraryPath(path: string): boolean {
  if (!path) return false;

  const lowerPath = path.toLowerCase();

  // Common library patterns
  const libraryPatterns = [
    /node_modules/,
    /\/node_modules\//,
    /vendor\//,
    /\/lib\//,
    /\/dist\//,
    /\/build\//,
    /\.min\.js$/,
    /\.bundle\.js$/,
    /webpack\//,
    /babel\//,
    /@babel\//,
    /core-js/,
    /regenerator-runtime/,
    /\/packages\//,
    /\/internal\//,
    /runtime\.js/,
    /polyfills?/,
    /\/_nuxt\//,
    /\/_next\//,
  ];

  for (const pattern of libraryPatterns) {
    if (pattern.test(lowerPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate unique trace ID
 */
function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * Calculate confidence based on frames parsed
 */
function calculateConfidence(frames: StackFrame[], rawLength: number): number {
  if (frames.length === 0) return 0;

  const hasValidFrames = frames.some(
    f => f.filePath && f.lineNumber
  );

  const hasFunctions = frames.some(
    f => f.functionName
  );

  let confidence = 0.5;

  if (hasValidFrames) confidence += 0.3;
  if (hasFunctions) confidence += 0.15;
  if (frames.length > 3) confidence += 0.05;

  return Math.min(confidence, 1.0);
}

// ============================================================================
// MAIN PARSER CLASS
// ============================================================================

export class StackTraceParser {
  /**
   * Parse a stack trace string into structured frames
   */
  parse(stackTrace: string): StackTraceParseResult {
    if (!stackTrace || !stackTrace.trim()) {
      return {
        success: false,
        error: 'Stack trace is empty',
        confidence: 0,
      };
    }

    try {
      // Detect language
      const language = detectLanguage(stackTrace);

      // Parse based on language
      let frames: StackFrame[] = [];

      switch (language) {
        case LangEnum.JAVASCRIPT:
        case LangEnum.TYPESCRIPT:
          frames = parseJavaScriptStack(stackTrace, language);
          break;
        case LangEnum.PYTHON:
          frames = parsePythonStack(stackTrace);
          break;
        case LangEnum.JAVA:
        case LangEnum.KOTLIN:
        case LangEnum.SCALA:
        case LangEnum.CLOJURE:
          frames = parseJavaStack(stackTrace);
          break;
        case LangEnum.GO:
          frames = parseGoStack(stackTrace);
          break;
        case LangEnum.RUST:
          frames = parseRustStack(stackTrace);
          break;
        case LangEnum.RUBY:
          frames = parseRubyStack(stackTrace);
          break;
        case LangEnum.CSHARP:
          frames = parseCSharpStack(stackTrace);
          break;
        case LangEnum.PHP:
          frames = parsePHPStack(stackTrace);
          break;
        default:
          frames = parseGenericStack(stackTrace, language);
      }

      if (frames.length === 0) {
        return {
          success: false,
          error: 'No frames could be parsed from stack trace',
          confidence: 0,
        };
      }

      // Build stack trace object
      const trace: StackTrace = {
        traceId: generateTraceId(),
        language,
        frames,
        raw: stackTrace,
        appFrames: frames.filter(f => f.isApp),
        libraryFrames: frames.filter(f => f.isLibrary),
        asyncFrames: frames.filter(f => f.isAsync),
        rootCauseFrame: this.findRootCause(frames),
        timestamp: Date.now(),
      };

      const confidence = calculateConfidence(frames, stackTrace.length);

      return {
        success: true,
        trace,
        confidence,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
        confidence: 0,
      };
    }
  }

  /**
   * Find the likely root cause frame
   */
  private findRootCause(frames: StackFrame[]): StackFrame | undefined {
    // Root cause is typically:
    // 1. The first application frame
    // 2. The last frame in the stack
    // 3. A frame with error-indicating patterns

    // First, look for app frames
    const appFrames = frames.filter(f => f.isApp);
    if (appFrames.length > 0) {
      return appFrames[0];
    }

    // If no app frames, return the last frame
    if (frames.length > 0) {
      return frames[frames.length - 1];
    }

    return undefined;
  }

  /**
   * Filter frames to only application code
   */
  filterAppFrames(trace: StackTrace): StackFrame[] {
    return trace.frames.filter(f => f.isApp);
  }

  /**
   * Filter frames to only library code
   */
  filterLibraryFrames(trace: StackTrace): StackFrame[] {
    return trace.frames.filter(f => f.isLibrary);
  }

  /**
   * Get async call stack
   */
  getAsyncFrames(trace: StackTrace): StackFrame[] {
    return trace.frames.filter(f => f.isAsync);
  }

  /**
   * Unwind async call stack
   */
  unwindAsyncStack(trace: StackTrace): StackFrame[][] {
    const stacks: StackFrame[][] = [];
    let currentStack: StackFrame[] = [];

    for (const frame of trace.frames) {
      if (frame.isAsync && currentStack.length > 0) {
        // Start new async stack
        stacks.push(currentStack);
        currentStack = [frame];
      } else {
        currentStack.push(frame);
      }
    }

    if (currentStack.length > 0) {
      stacks.push(currentStack);
    }

    return stacks;
  }

  /**
   * Link frames to source code
   */
  async linkToSource(
    trace: StackTrace,
    getSource: (filePath: string, lineNumber: number) => Promise<string | null>
  ): Promise<StackTrace> {
    const linkedFrames: StackFrame[] = [];

    for (const frame of trace.frames) {
      const linkedFrame = { ...frame };

      if (frame.filePath && frame.lineNumber) {
        try {
          const source = await getSource(frame.filePath, frame.lineNumber);
          if (source) {
            const lines = source.split('\n');
            const contextSize = 3;
            const startLine = Math.max(0, frame.lineNumber - contextSize - 1);
            const endLine = Math.min(lines.length, frame.lineNumber + contextSize);

            linkedFrame.sourceContext = {
              content: lines.slice(startLine, endLine).join('\n'),
              startLine: startLine + 1,
              endLine: endLine,
              errorLine: frame.lineNumber,
            };
          }
        } catch (error) {
          // Source linking failed, continue without context
        }
      }

      linkedFrames.push(linkedFrame);
    }

    return {
      ...trace,
      frames: linkedFrames,
      appFrames: linkedFrames.filter(f => f.isApp),
      libraryFrames: linkedFrames.filter(f => f.isLibrary),
      asyncFrames: linkedFrames.filter(f => f.isAsync),
    };
  }

  /**
   * Get frame statistics
   */
  getStats(trace: StackTrace): {
    totalFrames: number;
    appFrames: number;
    libraryFrames: number;
    asyncFrames: number;
    languages: Language[];
    uniqueFiles: number;
  } {
    return {
      totalFrames: trace.frames.length,
      appFrames: trace.appFrames.length,
      libraryFrames: trace.libraryFrames.length,
      asyncFrames: trace.asyncFrames.length,
      languages: [trace.language],
      uniqueFiles: new Set(
        trace.frames
          .filter(f => f.filePath)
          .map(f => f.filePath)
      ).size,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new stack trace parser
 */
export function createStackTraceParser(): StackTraceParser {
  return new StackTraceParser();
}

/**
 * Parse a stack trace (convenience function)
 */
export async function parseStackTrace(
  stackTrace: string
): Promise<StackTraceParseResult> {
  const parser = new StackTraceParser();
  return parser.parse(stackTrace);
}

/**
 * Parse and link to source (convenience function)
 */
export async function parseStackTraceWithSource(
  stackTrace: string,
  getSource: (filePath: string, lineNumber: number) => Promise<string | null>
): Promise<StackTraceParseResult> {
  const parser = new StackTraceParser();
  const result = parser.parse(stackTrace);

  if (result.success && result.trace) {
    const linked = await parser.linkToSource(result.trace, getSource);
    result.trace = linked;
  }

  return result;
}
