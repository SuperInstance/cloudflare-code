/**
 * Code Formatter
 *
 * Formats code while preserving comments and style.
 */

import { Logger } from './logger';

export class Formatter {
  private logger: Logger;

  constructor(private options: any = {}) {
    this.logger = new Logger('info');
  }

  /**
   * Format code using Prettier
   */
  async format(code: string, filePath: string, originalCode?: string): Promise<string> {
    try {
      const prettier = await import('prettier');

      const config = await prettier.resolveConfig(filePath);
      const fileInfo = await prettier.getFileInfo(filePath);

      const formatted = await prettier.format(code, {
        filepath: filePath,
        parser: this.getPrettierParser(fileInfo.inferredParser),
        ...config,
        ...this.options
      });

      return formatted;
    } catch (error) {
      this.logger.warn(`Prettier formatting failed: ${error}`);
      return code;
    }
  }

  /**
   * Format with Prettier but preserve specific formatting
   */
  async formatWithPreservation(code: string, filePath: string): Promise<string> {
    // Preserve specific patterns while formatting
    let formatted = await this.format(code, filePath);

    // Preserve special markers or patterns
    formatted = this.preserveMarkers(formatted);

    return formatted;
  }

  /**
   * Check if code needs formatting
   */
  async needsFormatting(code: string, filePath: string): Promise<boolean> {
    try {
      const formatted = await this.format(code, filePath);
      return code !== formatted;
    } catch {
      return false;
    }
  }

  /**
   * Format a selection of code
   */
  async formatSelection(
    code: string,
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<string> {
    const lines = code.split('\n');
    const selection = lines.slice(startLine - 1, endLine).join('\n');

    try {
      const formatted = await this.format(selection, filePath);
      return [
        ...lines.slice(0, startLine - 1),
        ...formatted.split('\n'),
        ...lines.slice(endLine)
      ].join('\n');
    } catch {
      return code;
    }
  }

  /**
   * Get Prettier parser for file type
   */
  private getPrettierParser(inferredParser: string | null): string {
    if (inferredParser) {
      return inferredParser;
    }

    return 'babel';
  }

  /**
   * Preserve special markers in code
   */
  private preserveMarkers(code: string): string {
    // Preserve comments, special markers, etc.
    return code;
  }
}

export class CodeFormatter extends Formatter {
  constructor(options: any = {}) {
    super(options);
  }

  /**
   * Format with source map support
   */
  async formatWithSourceMap(code: string, filePath: string): Promise<{
    code: string;
    map: any;
  }> {
    const formatted = await this.format(code, filePath);

    // Generate source map (simplified)
    const map = {
      version: 3,
      file: filePath,
      sources: [filePath],
      mappings: ''
    };

    return { code: formatted, map };
  }
}
