/**
 * Language Detector - Detects programming language from file path and content
 */

import { Language } from '../types/index.js';

// ============================================================================
// Language Detection
// ============================================================================

export class LanguageDetector {
  private extensions: Map<string, Language> = new Map();
  private patterns: Map<Language, RegExp[]> = new Map();

  constructor() {
    this.initializeExtensions();
    this.initializePatterns();
  }

  // ========================================================================
  // Detection Methods
  // ========================================================================

  /**
   * Detect language from file path
   */
  detectFromPath(filePath: string): Language {
    const ext = this.getExtension(filePath);
    const language = this.extensions.get(ext);

    if (language) {
      return language;
    }

    // Try detecting from patterns
    return this.detectFromPatterns(filePath);
  }

  /**
   * Detect language from file content
   */
  detectFromContent(content: string): Language | null {
    // Check for shebang
    const shebangMatch = content.match(/^#!(?:\/usr\/bin\/env\s+)?(\w+)/);
    if (shebangMatch) {
      const interpreter = shebangMatch[1];
      const languageMap: Record<string, Language> = {
        node: 'javascript',
        python: 'python',
        ruby: 'ruby',
        php: 'php',
        bash: 'typescript', // shell scripts
        sh: 'typescript',
      };
      return languageMap[interpreter] || null;
    }

    // Check for language-specific patterns
    if (this.isTypeScript(content)) return 'typescript';
    if (this.isJavaScript(content)) return 'javascript';
    if (this.isPython(content)) return 'python';
    if (this.isGo(content)) return 'go';
    if (this.isRust(content)) return 'rust';
    if (this.isJava(content)) return 'java';
    if (this.isCpp(content)) return 'cpp';
    if (this.isCSharp(content)) return 'csharp';
    if (this.isRuby(content)) return 'ruby';
    if (this.isPHP(content)) return 'php';

    return null;
  }

  /**
   * Detect language with confidence score
   */
  detectWithConfidence(filePath: string, content?: string): {
    language: Language;
    confidence: number;
  } {
    const fromPath = this.detectFromPath(filePath);

    if (content) {
      const fromContent = this.detectFromContent(content);

      if (fromContent && fromContent === fromPath) {
        return { language: fromPath, confidence: 1.0 };
      }

      if (fromContent) {
        return { language: fromContent, confidence: 0.8 };
      }
    }

    return { language: fromPath, confidence: 0.9 };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private getExtension(filePath: string): string {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  private detectFromPatterns(filePath: string): Language {
    const fileName = filePath.split('/').pop() || '';

    // Special filenames
    if (fileName === 'Dockerfile') return 'typescript';
    if (fileName === 'Makefile') return 'typescript';
    if (fileName === 'go.mod') return 'go';
    if (fileName === 'Cargo.toml') return 'rust';
    if (fileName === 'package.json') return 'typescript';
    if (fileName === 'Gemfile') return 'ruby';
    if (fileName === 'composer.json') return 'php';

    return 'typescript'; // Default
  }

  private isTypeScript(content: string): boolean {
    return /:\s*(string|number|boolean|any|void|never|unknown)\b/.test(content) &&
      /interface\s+\w+/.test(content);
  }

  private isJavaScript(content: string): boolean {
    return /const\s+\w+\s*=\s*\([^)]*\)\s*=>/.test(content) ||
      /function\s*\w*\s*\([^)]*\)\s*{/.test(content);
  }

  private isPython(content: string): boolean {
    return /^\s*(def|class|import|from)\s+/m.test(content) &&
      !/function\s+/.test(content);
  }

  private isGo(content: string): boolean {
    return /^\s*package\s+\w+/m.test(content) &&
      /func\s+\w+\s*\(/.test(content);
  }

  private isRust(content: string): boolean {
    return /fn\s+main\s*\(\)/.test(content) ||
      /use\s+std::/.test(content) ||
      /let\s+mut\s+/.test(content);
  }

  private isJava(content: string): boolean {
    return /public\s+class\s+\w+/.test(content) ||
      /public\s+static\s+void\s+main/.test(content);
  }

  private isCpp(content: string): boolean {
    return /#include\s+<[\w.]+>/.test(content) ||
      /std::/.test(content) ||
      /cout\s*<<|cin\s*>>/.test(content);
  }

  private isCSharp(content: string): boolean {
    return /using\s+System;/.test(content) ||
      /namespace\s+\w+/.test(content);
  }

  private isRuby(content: string): boolean {
    return /def\s+\w+|class\s+\w+|require\s+['"]/.test(content) &&
      /end\s*$/.test(content);
  }

  private isPHP(content: string): boolean {
    return /<\?php/.test(content) ||
      /\$\w+\s*=\s*new\s+/.test(content);
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  private initializeExtensions(): void {
    // TypeScript
    this.extensions.set('ts', 'typescript');
    this.extensions.set('tsx', 'typescript');

    // JavaScript
    this.extensions.set('js', 'javascript');
    this.extensions.set('jsx', 'javascript');
    this.extensions.set('mjs', 'javascript');

    // Python
    this.extensions.set('py', 'python');

    // Go
    this.extensions.set('go', 'go');

    // Rust
    this.extensions.set('rs', 'rust');

    // Java
    this.extensions.set('java', 'java');

    // C++
    this.extensions.set('cpp', 'cpp');
    this.extensions.set('cc', 'cpp');
    this.extensions.set('cxx', 'cpp');
    this.extensions.set('h', 'cpp');
    this.extensions.set('hpp', 'cpp');

    // C#
    this.extensions.set('cs', 'csharp');

    // Ruby
    this.extensions.set('rb', 'ruby');

    // PHP
    this.extensions.set('php', 'php');
  }

  private initializePatterns(): void {
    // TypeScript patterns
    this.patterns.set('typescript', [
      /interface\s+\w+/,
      /:\s*(string|number|boolean|any|void|never)/,
      /type\s+\w+\s*=/,
    ]);

    // JavaScript patterns
    this.patterns.set('javascript', [
      /const\s+\w+\s*=\s*\([^)]*\)\s*=>/,
      /function\s*\w*\s*\([^)]*\)\s*{/,
      /require\s*\(/,
    ]);

    // Python patterns
    this.patterns.set('python', [
      /def\s+\w+\s*\(/,
      /class\s+\w+\s*:/,
      /import\s+\w+/,
      /from\s+\w+\s+import/,
    ]);

    // Go patterns
    this.patterns.set('go', [
      /package\s+\w+/,
      /func\s+\w+\s*\(/,
      /import\s+\(/,
      /go\s+\w+\s*\(/,
    ]);

    // Rust patterns
    this.patterns.set('rust', [
      /fn\s+main\s*\(\)/,
      /use\s+\w+::/,
      /let\s+mut\s+/,
      /impl\s+\w+/,
    ]);

    // Java patterns
    this.patterns.set('java', [
      /public\s+class\s+\w+/,
      /public\s+static\s+void\s+main/,
      /System\.out\.print/,
    ]);

    // C++ patterns
    this.patterns.set('cpp', [
      /#include\s+<[\w.]+>/,
      /std::/,
      /cout\s*<<|cin\s*>>/,
    ]);

    // C# patterns
    this.patterns.set('csharp', [
      /using\s+System;/,
      /namespace\s+\w+/,
    ]);

    // Ruby patterns
    this.patterns.set('ruby', [
      /def\s+\w+/,
      /class\s+\w+/,
      /require\s+['"]/,
      /end\s*$/,
    ]);

    // PHP patterns
    this.patterns.set('php', [
      /<\?php/,
      /\$\w+\s*=\s*new\s+/,
      /function\s+\w+\s*\(/,
    ]);
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): Language[] {
    return Array.from(new Set(this.extensions.values()));
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: Language): boolean {
    return this.extensions.has(language) || Array.from(this.extensions.values()).includes(language);
  }
}
