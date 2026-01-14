/**
 * Parser Factory - Create language-specific parsers
 */

import { TypeScriptParser } from './typescript.js';
import { PythonParser } from './python.js';
import { GoParser } from './go.js';
import { SupportedLanguage, CodeDocumentationOptions } from '../../types/index.js';

export class ParserFactory {
  private parsers: Map<SupportedLanguage, any>;

  constructor(private options: CodeDocumentationOptions) {
    this.parsers = new Map();
    this.initializeParsers();
  }

  private initializeParsers(): void {
    this.parsers.set('typescript', new TypeScriptParser(this.options));
    this.parsers.set('javascript', new TypeScriptParser(this.options));
    this.parsers.set('python', new PythonParser(this.options));
    this.parsers.set('go', new GoParser(this.options));
  }

  getParser(language: SupportedLanguage): any {
    const parser = this.parsers.get(language);
    if (!parser) {
      throw new Error(`No parser available for language: ${language}`);
    }
    return parser;
  }
}
