/**
 * Documentation Generator - Core functionality for automated documentation generation
 */

// @ts-nocheck - External dependencies (recast) and type issues

import { readFile, readdir, stat, access } from 'fs/promises';
import { join, relative, extname, basename } from 'path';
import { performance } from 'perf_hooks';
import * as recast from 'recast';
import * as parser from 'recast/parsers/babel';
import {
  DocumentationOptions,
  DocumentContent,
  DocumentMetadata,
  CodeExample,
  ParsedDocumentation,
  SupportedLanguage,
  TypeSignature
} from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { ParserFactory } from '../code/parsers/factory.js';
import { TemplateEngine } from './template-engine.js';
import { DiagramGenerator } from './diagram-generator.js';

export interface GenerationResult {
  documents: DocumentContent[];
  metrics: GenerationMetrics;
  duration: number;
}

export interface GenerationMetrics {
  filesProcessed: number;
  documentsGenerated: number;
  examplesGenerated: number;
  diagramsGenerated: number;
  errors: GenerationError[];
  warnings: string[];
  coverage: {
    documented: number;
    total: number;
    percentage: number;
  };
}

export interface GenerationError {
  file: string;
  message: string;
  line?: number;
  stack?: string;
}

export class DocumentationGenerator {
  private logger: Logger;
  private parserFactory: ParserFactory;
  private templateEngine: TemplateEngine;
  private diagramGenerator: DiagramGenerator;
  private cache: Map<string, ParsedDocumentation>;

  constructor(private options: DocumentationOptions) {
    this.logger = new Logger('DocumentationGenerator');
    this.parserFactory = new ParserFactory();
    this.templateEngine = new TemplateEngine(options.theme);
    this.diagramGenerator = new DiagramGenerator();
    this.cache = new Map();
  }

  /**
   * Generate documentation from source code
   */
  async generate(): Promise<GenerationResult> {
    const startTime = performance.now();
    const metrics: GenerationMetrics = {
      filesProcessed: 0,
      documentsGenerated: 0,
      examplesGenerated: 0,
      diagramsGenerated: 0,
      errors: [],
      warnings: [],
      coverage: { documented: 0, total: 0, percentage: 0 }
    };

    this.logger.info('Starting documentation generation', {
      inputPath: this.options.inputPath,
      format: this.options.format
    });

    try {
      // Discover source files
      const files = await this.discoverFiles();
      this.logger.info(`Discovered ${files.length} source files`);

      // Process each file
      const documents: DocumentContent[] = [];
      for (const file of files) {
        try {
          const docs = await this.processFile(file);
          if (docs) {
            documents.push(docs);
            metrics.documentsGenerated++;
            metrics.examplesGenerated += docs.examples?.length || 0;
          }
          metrics.filesProcessed++;
        } catch (error) {
          metrics.errors.push({
            file,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          this.logger.error(`Error processing file: ${file}`, error);
        }
      }

      // Calculate overall coverage
      metrics.coverage = this.calculateCoverage(documents);

      // Generate diagrams if enabled
      if (this.options.typeInfo) {
        const diagrams = await this.generateDiagrams(documents);
        metrics.diagramsGenerated = diagrams;
      }

      // Output documents
      await this.outputDocuments(documents);

      const duration = performance.now() - startTime;
      this.logger.info('Documentation generation complete', {
        duration: `${duration.toFixed(2)}ms`,
        filesProcessed: metrics.filesProcessed,
        documentsGenerated: metrics.documentsGenerated,
        coverage: `${metrics.coverage.percentage}%`
      });

      return { documents, metrics, duration };
    } catch (error) {
      this.logger.error('Documentation generation failed', error);
      throw error;
    }
  }

  /**
   * Discover all source files in the input directory
   */
  private async discoverFiles(): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'];

    async function walk(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    }

    await walk(this.options.inputPath);
    return files;
  }

  /**
   * Process a single file and generate documentation
   */
  private async processFile(filePath: string): Promise<DocumentContent | null> {
    const startTime = performance.now();
    this.logger.debug(`Processing file: ${filePath}`);

    // Check cache first
    const stats = await stat(filePath);
    const cacheKey = `${filePath}:${stats.mtimeMs}`;
    if (this.cache.has(cacheKey)) {
      this.logger.debug(`Using cached documentation for: ${filePath}`);
      return this.createDocumentFromCache(filePath, cacheKey);
    }

    // Read file content
    const content = await readFile(filePath, 'utf-8');

    // Detect language
    const language = this.detectLanguage(filePath);
    if (!language) {
      this.logger.warn(`Unsupported file type: ${filePath}`);
      return null;
    }

    // Parse file based on language
    const parser = this.parserFactory.getParser(language);
    const parsed = await parser.parse(filePath, content);

    // Cache the parsed documentation
    this.cache.set(cacheKey, parsed);

    // Generate document
    const document = await this.createDocument(filePath, content, parsed, language);

    const duration = performance.now() - startTime;
    this.logger.debug(`Processed file in ${duration.toFixed(2)}ms: ${filePath}`);

    return document;
  }

  /**
   * Detect the programming language from file extension
   */
  private detectLanguage(filePath: string): SupportedLanguage | null {
    const ext = extname(filePath);
    const languageMap: Record<string, SupportedLanguage> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.mts': 'typescript',
      '.cts': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java'
    };

    return languageMap[ext] || null;
  }

  /**
   * Create a document content from parsed documentation
   */
  private async createDocument(
    filePath: string,
    content: string,
    parsed: ParsedDocumentation,
    language: SupportedLanguage
  ): Promise<DocumentContent> {
    const relativePath = relative(this.options.inputPath, filePath);
    const moduleName = this.extractModuleName(filePath);

    const metadata: DocumentMetadata = {
      id: this.generateId(relativePath),
      title: moduleName,
      description: this.generateDescription(parsed),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: this.options.version || '1.0.0',
      tags: this.generateTags(parsed),
      category: this.categorizeDocument(parsed),
      language,
      sourcePath: filePath,
      checksum: this.generateChecksum(content)
    };

    // Generate markdown content
    const docContent = this.generateMarkdown(parsed, relativePath);

    // Generate examples if enabled
    const examples = this.options.examples
      ? await this.generateExamples(parsed, language)
      : [];

    // Generate HTML if needed
    let html: string | undefined;
    if (this.options.format === 'html' || this.options.format === 'pdf') {
      html = await this.templateEngine.render(docContent, metadata);
    }

    return {
      metadata,
      content: docContent,
      html,
      examples,
      references: this.extractReferences(parsed, relativePath)
    };
  }

  /**
   * Create document from cached parsed documentation
   */
  private createDocumentFromCache(
    filePath: string,
    cacheKey: string
  ): DocumentContent | null {
    const parsed = this.cache.get(cacheKey);
    if (!parsed) return null;

    return this.createDocument(
      filePath,
      '', // Content not needed for cached docs
      parsed,
      parsed.language
    );
  }

  /**
   * Extract module name from file path
   */
  private extractModuleName(filePath: string): string {
    const name = basename(filePath, extname(filePath));
    // Convert to title case
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate description from parsed documentation
   */
  private generateDescription(parsed: ParsedDocumentation): string {
    // Look for file-level documentation
    const documentedItems = [
      ...parsed.classes,
      ...parsed.functions,
      ...parsed.interfaces
    ].filter(item => item.documentation);

    if (documentedItems.length > 0) {
      const firstDoc = documentedItems[0].documentation;
      // Extract first sentence or first 150 characters
      const match = firstDoc.match(/^[^.]+\.|^[^\n]{0,150}/);
      return match ? match[0].trim() : 'Module documentation';
    }

    return 'Module documentation';
  }

  /**
   * Generate tags from parsed documentation
   */
  private generateTags(parsed: ParsedDocumentation): string[] {
    const tags = new Set<string>();

    // Add language tag
    tags.add(parsed.language);

    // Add category tags based on exports
    parsed.classes.forEach(c => {
      if (c.isAbstract) tags.add('abstract');
    });

    parsed.functions.forEach(f => {
      if (f.async) tags.add('async');
      if (f.generator) tags.add('generator');
    });

    // Add type tags
    if (parsed.classes.length > 0) tags.add('classes');
    if (parsed.interfaces.length > 0) tags.add('interfaces');
    if (parsed.functions.length > 0) tags.add('functions');
    if (parsed.types.length > 0) tags.add('types');

    return Array.from(tags);
  }

  /**
   * Categorize document based on content
   */
  private categorizeDocument(parsed: ParsedDocumentation): string {
    if (parsed.classes.length > 0) return 'class';
    if (parsed.interfaces.length > 0) return 'interface';
    if (parsed.functions.length > 0) return 'function';
    if (parsed.types.length > 0) return 'type';
    if (parsed.constants.length > 0) return 'constant';
    return 'module';
  }

  /**
   * Generate markdown documentation
   */
  private generateMarkdown(parsed: ParsedDocumentation, relativePath: string): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${basename(relativePath, extname(relativePath))}`);
    lines.push('');

    // Overview
    if (parsed.exports.length > 0) {
      lines.push('## Overview');
      lines.push('');
      lines.push(`This module exports ${parsed.exports.length} ${this.pluralize('item', parsed.exports.length)}:`);
      lines.push('');
      parsed.exports.forEach(exp => {
        const badge = exp.exported ? '✓' : '✗';
        const defaultBadge = exp.default ? ' (default)' : '';
        lines.push(`- ${badge} \`${exp.name}\`${defaultBadge} - ${exp.type}`);
      });
      lines.push('');
    }

    // Classes
    if (parsed.classes.length > 0) {
      lines.push('## Classes');
      lines.push('');
      parsed.classes.forEach(cls => {
        this.addClassDocumentation(lines, cls);
      });
    }

    // Interfaces
    if (parsed.interfaces.length > 0) {
      lines.push('## Interfaces');
      lines.push('');
      parsed.interfaces.forEach(int => {
        this.addInterfaceDocumentation(lines, int);
      });
    }

    // Functions
    if (parsed.functions.length > 0) {
      lines.push('## Functions');
      lines.push('');
      parsed.functions.forEach(fn => {
        this.addFunctionDocumentation(lines, fn);
      });
    }

    // Type Aliases
    if (parsed.types.length > 0) {
      lines.push('## Types');
      lines.push('');
      parsed.types.forEach(type => {
        this.addTypeDocumentation(lines, type);
      });
    }

    // Constants
    if (parsed.constants.length > 0) {
      lines.push('## Constants');
      lines.push('');
      parsed.constants.forEach(constant => {
        this.addConstantDocumentation(lines, constant);
      });
    }

    // Coverage report
    lines.push('## Documentation Coverage');
    lines.push('');
    lines.push(`Documented: ${parsed.coverage.documented}/${parsed.coverage.total} (${parsed.coverage.percentage.toFixed(1)}%)`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Add class documentation to markdown
   */
  private addClassDocumentation(lines: string[], cls: any): void {
    lines.push(`### ${this.getVisibilityIcon('public')} \`${cls.name}\``);
    lines.push('');

    if (cls.extends) {
      lines.push(`**Extends:** \`${cls.extends}\``);
      lines.push('');
    }

    if (cls.implements && cls.implements.length > 0) {
      lines.push(`**Implements:** ${cls.implements.map((i: string) => `\`${i}\``).join(', ')}`);
      lines.push('');
    }

    if (cls.documentation) {
      lines.push(cls.documentation);
      lines.push('');
    }

    // Properties
    if (cls.properties && cls.properties.length > 0) {
      lines.push('#### Properties');
      lines.push('');
      cls.properties.forEach((prop: any) => {
        const visibilityIcon = this.getVisibilityIcon(prop.visibility);
        lines.push(`- ${visibilityIcon} \`${prop.name}\`: \`${this.formatType(prop.type)}\``);
        if (prop.documentation) {
          lines.push(`  ${prop.documentation}`);
        }
      });
      lines.push('');
    }

    // Methods
    if (cls.methods && cls.methods.length > 0) {
      lines.push('#### Methods');
      lines.push('');
      cls.methods.forEach((method: any) => {
        this.addMethodDocumentation(lines, method, '#####');
      });
    }
  }

  /**
   * Add interface documentation to markdown
   */
  private addInterfaceDocumentation(lines: string[], int: any): void {
    lines.push(`### \`${int.name}\``);
    lines.push('');

    if (int.extends && int.extends.length > 0) {
      lines.push(`**Extends:** ${int.extends.map((i: string) => `\`${i}\``).join(', ')}`);
      lines.push('');
    }

    if (int.documentation) {
      lines.push(int.documentation);
      lines.push('');
    }

    // Properties
    if (int.properties && int.properties.length > 0) {
      lines.push('#### Properties');
      lines.push('');
      int.properties.forEach((prop: any) => {
        const optional = prop.optional ? '?' : '';
        lines.push(`- \`${prop.name}${optional}\`: \`${this.formatType(prop.type)}\``);
        if (prop.documentation) {
          lines.push(`  ${prop.documentation}`);
        }
      });
      lines.push('');
    }

    // Methods
    if (int.methods && int.methods.length > 0) {
      lines.push('#### Methods');
      lines.push('');
      int.methods.forEach((method: any) => {
        this.addMethodDocumentation(lines, method, '#####');
      });
    }
  }

  /**
   * Add function documentation to markdown
   */
  private addFunctionDocumentation(lines: string[], fn: any): void {
    const async = fn.async ? 'async ' : '';
    const generator = fn.generator ? '*' : '';
    const signature = `${async}${generator}${fn.name}${this.formatParameters(fn.parameters)}`;

    lines.push(`### \`${signature}\``);
    lines.push('');

    if (fn.documentation) {
      lines.push(fn.documentation);
      lines.push('');
    }

    // Parameters
    if (fn.parameters && fn.parameters.length > 0) {
      lines.push('#### Parameters');
      lines.push('');
      fn.parameters.forEach((param: any) => {
        const optional = param.optional ? '?' : '';
        const rest = param.rest ? '...' : '';
        lines.push(`- \`${rest}${param.name}${optional}\`: \`${this.formatType(param.type)}\``);
        if (param.documentation) {
          lines.push(`  ${param.documentation}`);
        }
      });
      lines.push('');
    }

    // Return type
    lines.push(`**Returns:** \`${this.formatType(fn.returnType)}\``);
    lines.push('');
  }

  /**
   * Add method documentation to markdown
   */
  private addMethodDocumentation(lines: string[], method: any, heading: string): void {
    const async = method.async ? 'async ' : '';
    const generator = method.generator ? '*' : '';
    const signature = `${async}${generator}${method.name}${this.formatParameters(method.parameters)}`;

    lines.push(`${heading} \`${signature}\``);
    lines.push('');

    if (method.documentation) {
      lines.push(method.documentation);
      lines.push('');
    }

    // Parameters
    if (method.parameters && method.parameters.length > 0) {
      lines.push('**Parameters:**');
      lines.push('');
      method.parameters.forEach((param: any) => {
        const optional = param.optional ? '?' : '';
        const rest = param.rest ? '...' : '';
        lines.push(`- \`${rest}${param.name}${optional}\`: \`${this.formatType(param.type)}\``);
        if (param.documentation) {
          lines.push(`  ${param.documentation}`);
        }
      });
      lines.push('');
    }

    // Return type
    lines.push(`**Returns:** \`${this.formatType(method.returnType)}\``);
    lines.push('');
  }

  /**
   * Add type documentation to markdown
   */
  private addTypeDocumentation(lines: string[], type: any): void {
    lines.push(`### \`${type.name}\``);
    lines.push('');

    if (type.documentation) {
      lines.push(type.documentation);
      lines.push('');
    }

    lines.push(`**Type:** \`${this.formatType(type.type)}\``);
    lines.push('');
  }

  /**
   * Add constant documentation to markdown
   */
  private addConstantDocumentation(lines: string[], constant: any): void {
    lines.push(`### \`${constant.name}\``);
    lines.push('');

    if (constant.documentation) {
      lines.push(constant.documentation);
      lines.push('');
    }

    lines.push(`**Type:** \`${this.formatType(constant.type)}\``);
    lines.push('');
    lines.push(`**Value:** \`${constant.value}\``);
    lines.push('');
  }

  /**
   * Format parameters for display
   */
  private formatParameters(parameters: any[]): string {
    if (!parameters || parameters.length === 0) return '()';

    const params = parameters.map(param => {
      const optional = param.optional ? '?' : '';
      const rest = param.rest ? '...' : '';
      return `${rest}${param.name}${optional}: ${this.formatType(param.type)}`;
    });

    return `(${params.join(', ')})`;
  }

  /**
   * Format a type signature for display
   */
  private formatType(type: TypeSignature): string {
    if (type.generics && type.generics.length > 0) {
      const generics = type.generics.map(g => this.formatType(g)).join(', ');
      return `${type.text}<${generics}>`;
    }

    if (type.union && type.union.length > 0) {
      const union = type.union.map(u => this.formatType(u)).join(' | ');
      return `(${union})`;
    }

    if (type.intersection && type.intersection.length > 0) {
      const intersection = type.intersection.map(i => this.formatType(i)).join(' & ');
      return `(${intersection})`;
    }

    if (type.array) {
      return `${this.formatType(type.array)}[]`;
    }

    if (type.tuple && type.tuple.length > 0) {
      const tuple = type.tuple.map(t => this.formatType(t)).join(', ');
      return `[${tuple}]`;
    }

    return type.text || 'any';
  }

  /**
   * Get visibility icon
   */
  private getVisibilityIcon(visibility: string): string {
    const icons: Record<string, string> = {
      public: '🔓',
      protected: '🔐',
      private: '🔒'
    };
    return icons[visibility] || '🔓';
  }

  /**
   * Generate code examples
   */
  private async generateExamples(
    parsed: ParsedDocumentation,
    language: SupportedLanguage
  ): Promise<CodeExample[]> {
    const examples: CodeExample[] = [];

    // Generate examples for functions
    for (const fn of parsed.functions) {
      if (fn.documentation && !fn.name.startsWith('_')) {
        const example = this.generateFunctionExample(fn, language);
        if (example) {
          examples.push(example);
        }
      }
    }

    // Generate examples for classes
    for (const cls of parsed.classes) {
      const example = this.generateClassExample(cls, language);
      if (example) {
        examples.push(example);
      }
    }

    return examples;
  }

  /**
   * Generate example for a function
   */
  private generateFunctionExample(fn: any, language: SupportedLanguage): CodeExample | null {
    const code = this.buildFunctionExampleCode(fn, language);
    if (!code) return null;

    return {
      id: this.generateId(`example-${fn.name}`),
      language,
      code,
      description: `Example usage of ${fn.name}`,
      runnable: true
    };
  }

  /**
   * Build example code for a function
   */
  private buildFunctionExampleCode(fn: any, language: SupportedLanguage): string | null {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.buildJSExample(fn);
      case 'python':
        return this.buildPythonExample(fn);
      case 'go':
        return this.buildGoExample(fn);
      default:
        return null;
    }
  }

  /**
   * Build JavaScript/TypeScript example
   */
  private buildJSExample(fn: any): string {
    const lines: string[] = [];

    // Add imports if needed
    if (fn.async) {
      lines.push('const result = await ' + fn.name + '();');
    } else {
      lines.push('const result = ' + fn.name + '();');
    }

    lines.push('console.log(result);');

    return lines.join('\n');
  }

  /**
   * Build Python example
   */
  private buildPythonExample(fn: any): string {
    const lines: string[] = [];

    if (fn.async) {
      lines.push('result = await ' + fn.name + '()');
    } else {
      lines.push('result = ' + fn.name + '()');
    }

    lines.push('print(result)');

    return lines.join('\n');
  }

  /**
   * Build Go example
   */
  private buildGoExample(fn: any): string {
    const lines: string[] = [];

    lines.push('result := ' + fn.name + '()');
    lines.push('fmt.Println(result)');

    return lines.join('\n');
  }

  /**
   * Generate example for a class
   */
  private generateClassExample(cls: any, language: SupportedLanguage): CodeExample | null {
    const code = this.buildClassExampleCode(cls, language);
    if (!code) return null;

    return {
      id: this.generateId(`example-${cls.name}`),
      language,
      code,
      description: `Example usage of ${cls.name} class`,
      runnable: true
    };
  }

  /**
   * Build example code for a class
   */
  private buildClassExampleCode(cls: any, language: SupportedLanguage): string | null {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return `const instance = new ${cls.name}();
// Use instance methods and properties
`;

      case 'python':
        return `instance = ${cls.name}()
# Use instance methods and properties
`;

      case 'go':
        return `instance := &${cls.name}{}
// Use instance methods and properties
`;

      default:
        return null;
    }
  }

  /**
   * Generate diagrams
   */
  private async generateDiagrams(documents: DocumentContent[]): Promise<number> {
    let count = 0;

    for (const doc of documents) {
      try {
        // Generate architecture diagram if applicable
        const diagram = await this.diagramGenerator.generateClassDiagram(doc);
        if (diagram) {
          count++;
        }
      } catch (error) {
        this.logger.warn(`Failed to generate diagram for ${doc.metadata.id}`, error);
      }
    }

    return count;
  }

  /**
   * Extract references from parsed documentation
   */
  private extractReferences(parsed: ParsedDocumentation, relativePath: string): any[] {
    const references: any[] = [];

    // Extract type references
    const extractTypeRefs = (type: TypeSignature): void => {
      if (type.generics) {
        type.generics.forEach(extractTypeRefs);
      }
      if (type.union) {
        type.union.forEach(extractTypeRefs);
      }
      if (type.intersection) {
        type.intersection.forEach(extractTypeRefs);
      }

      // Add reference if it's a custom type
      if (type.text && !this.isBuiltinType(type.text)) {
        references.push({
          id: this.generateId(`ref-${type.text}`),
          type: 'code',
          target: type.text,
          label: type.text
        });
      }
    };

    // Extract from functions
    parsed.functions.forEach(fn => {
      fn.parameters.forEach((param: any) => extractTypeRefs(param.type));
      extractTypeRefs(fn.returnType);
    });

    // Extract from classes
    parsed.classes.forEach(cls => {
      cls.properties?.forEach((prop: any) => extractTypeRefs(prop.type));
      cls.methods?.forEach((method: any) => {
        method.parameters?.forEach((param: any) => extractTypeRefs(param.type));
        extractTypeRefs(method.returnType);
      });
    });

    // Extract from interfaces
    parsed.interfaces.forEach(int => {
      int.properties?.forEach((prop: any) => extractTypeRefs(prop.type));
    });

    // Extract from types
    parsed.types.forEach(type => extractTypeRefs(type.type));

    return references;
  }

  /**
   * Check if type is a builtin type
   */
  private isBuiltinType(type: string): boolean {
    const builtins = [
      'string', 'number', 'boolean', 'void', 'any', 'unknown', 'never',
      'null', 'undefined', 'object', 'Function', 'Promise', 'Array',
      'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet',
      'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit'
    ];
    return builtins.includes(type);
  }

  /**
   * Calculate documentation coverage
   */
  private calculateCoverage(documents: DocumentContent[]): { documented: number; total: number; percentage: number } {
    let documented = 0;
    let total = 0;

    for (const doc of documents) {
      // Count based on examples
      total += 1;
      if (doc.examples && doc.examples.length > 0) {
        documented += 1;
      }
    }

    const percentage = total > 0 ? (documented / total) * 100 : 0;

    return { documented, total, percentage };
  }

  /**
   * Output documents to filesystem
   */
  private async outputDocuments(documents: DocumentContent[]): Promise<void> {
    const { writeFile, mkdir } = await import('fs/promises');
    const { join } = await import('path');

    for (const doc of documents) {
      const outputPath = join(this.options.outputPath, doc.metadata.id + this.getExtension());
      const outputDir = join(outputPath, '..');

      // Create directory if it doesn't exist
      await mkdir(outputDir, { recursive: true });

      // Write file based on format
      if (this.options.format === 'html') {
        await writeFile(outputPath, doc.html || doc.content, 'utf-8');
      } else {
        await writeFile(outputPath, doc.content, 'utf-8');
      }
    }
  }

  /**
   * Get file extension based on output format
   */
  private getExtension(): string {
    switch (this.options.format) {
      case 'markdown':
        return '.md';
      case 'html':
        return '.html';
      case 'json':
        return '.json';
      default:
        return '.md';
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Generate checksum for content
   */
  private generateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Pluralize word
   */
  private pluralize(word: string, count: number): string {
    return count === 1 ? word : word + 's';
  }
}
