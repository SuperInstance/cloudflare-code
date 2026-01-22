/**
 * Documentation Generator
 *
 * Main orchestrator for generating comprehensive documentation from code.
 * Coordinates parsing, analysis, and output generation across multiple formats.
 *
 * Performance Targets:
 * - Generate full docs for 100 files: <5s
 * - Memory overhead: ~10x total source size
 * - Parallel processing for multiple outputs
 */

import type {
  DocOutput,
  DocFormat,
  DocType,
  ParsedDocumentation,
  DocGeneratorOptions,
  GenerationResult,
  TemplateContext,
  ArchitectureDiagram,
  Tutorial,
} from './types';

import { DocumentationParser } from './parser';
import { APIDocGenerator } from './api-docs';
import { DiagramGenerator } from './diagrams';
import { ReadmeGenerator } from './readme';

/**
 * Documentation Generator
 *
 * Main class that orchestrates the entire documentation generation process.
 */
export class DocumentationGenerator {
  private parser: DocumentationParser;
  private apiGenerator: APIDocGenerator;
  private diagramGenerator: DiagramGenerator;
  private readmeGenerator: ReadmeGenerator;
  private options: DocGeneratorOptions;

  constructor(options: DocGeneratorOptions = {}) {
    this.options = {
      format: ['markdown', 'html', 'json'],
      type: ['api-reference', 'readme', 'architecture'],
      projectName: 'Project',
      version: '1.0.0',
      description: '',
      repository: '',
      homepage: '',
      author: '',
      license: 'MIT',
      includeTOC: true,
      includeIndex: true,
      includeSearch: false,
      includeTypes: true,
      includeExamples: true,
      includeDiagrams: true,
      includeInherited: false,
      groupByCategory: true,
      sortSymbols: 'name',
      ...options,
    };

    this.parser = new DocumentationParser();
    this.apiGenerator = new APIDocGenerator(this.options);
    this.diagramGenerator = new DiagramGenerator();
    this.readmeGenerator = new ReadmeGenerator(this.options);
  }

  /**
   * Generate documentation from file contents
   *
   * @param files - Array of file contents and paths
   * @returns Generation result
   */
  async generate(files: Array<{ content: string; path: string }>): Promise<GenerationResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const outputs: DocOutput[] = [];

    try {
      // Parse all files
      console.log('Parsing files for documentation...');
      const docs = await this.parser.parseBatch(files);

      if (docs.length === 0) {
        warnings.push('No files were parsed successfully');
        return this.createResult([], warnings, [], startTime);
      }

      console.log(`Parsed ${docs.length} files with ${docs.reduce((sum, d) => sum + d.symbols.length, 0)} symbols`);

      // Generate architecture diagram
      let diagram: ArchitectureDiagram | undefined;
      if (this.options.type?.includes('architecture') && this.options.includeDiagrams) {
        console.log('Generating architecture diagram...');
        diagram = this.diagramGenerator.generateArchitectureDiagram(docs);
      }

      // Generate documentation for each requested type and format
      for (const docType of this.options.type || ['api-reference']) {
        for (const format of this.options.format || ['markdown']) {
          console.log(`Generating ${docType} in ${format} format...`);

          try {
            const output = await this.generateSingleType(docs, docType, format, diagram);
            if (output) {
              outputs.push(output);
            }
          } catch (error) {
            const msg = `Failed to generate ${docType} in ${format}: ${error}`;
            errors.push(msg);
            console.error(msg);
          }
        }
      }

      const stats = {
        filesParsed: files.length,
        symbolsExtracted: docs.reduce((sum, d) => sum + d.symbols.length, 0),
        docsGenerated: outputs.length,
        generationTime: performance.now() - startTime,
      };

      console.log(`Documentation generation complete in ${stats.generationTime.toFixed(2)}ms`);

      return this.createResult(outputs, errors, warnings, startTime, stats);

    } catch (error) {
      errors.push(`Generation failed: ${error}`);
      return this.createResult([], errors, warnings, startTime);
    }
  }

  /**
   * Generate a single documentation type
   *
   * @private
   */
  private async generateSingleType(
    docs: ParsedDocumentation[],
    docType: DocType,
    format: DocFormat,
    diagram?: ArchitectureDiagram
  ): Promise<DocOutput | null> {
    const timestamp = Date.now();
    const sourceFiles = docs.map(d => d.filePath);

    switch (docType) {
      case 'api-reference':
        return this.generateAPIReference(docs, format, timestamp, sourceFiles);

      case 'readme':
        return this.generateReadme(docs, diagram, format, timestamp, sourceFiles);

      case 'architecture':
        return this.generateArchitecture(docs, diagram, format, timestamp, sourceFiles);

      case 'tutorial':
        return this.generateTutorial(docs, format, timestamp, sourceFiles);

      case 'all':
        return this.generateAll(docs, diagram, format, timestamp, sourceFiles);

      default:
        return null;
    }
  }

  /**
   * Generate API reference documentation
   *
   * @private
   */
  private generateAPIReference(
    docs: ParsedDocumentation[],
    format: DocFormat,
    timestamp: number,
    sourceFiles: string[]
  ): DocOutput {
    const apiRef = this.apiGenerator.generateAPIReference(docs);
    const content = this.apiGenerator.generateDocumentation(apiRef, format);

    return {
      format,
      type: 'api-reference',
      content,
      metadata: {
        version: this.options.version || '1.0.0',
        generatedAt: timestamp,
        sourceFiles,
        symbols: apiRef.symbols.length,
        formatVersion: '1.0.0',
      },
    };
  }

  /**
   * Generate README documentation
   *
   * @private
   */
  private generateReadme(
    docs: ParsedDocumentation[],
    diagram: ArchitectureDiagram | undefined,
    format: DocFormat,
    timestamp: number,
    sourceFiles: string[]
  ): DocOutput {
    if (format !== 'markdown') {
      throw new Error('README is only available in Markdown format');
    }

    const content = this.readmeGenerator.generateReadme(docs, diagram);

    return {
      format: 'markdown',
      type: 'readme',
      content,
      metadata: {
        version: this.options.version || '1.0.0',
        generatedAt: timestamp,
        sourceFiles,
        symbols: docs.reduce((sum, d) => sum + d.symbols.length, 0),
        formatVersion: '1.0.0',
      },
    };
  }

  /**
   * Generate architecture documentation
   *
   * @private
   */
  private generateArchitecture(
    docs: ParsedDocumentation[],
    diagram: ArchitectureDiagram | undefined,
    format: DocFormat,
    timestamp: number,
    sourceFiles: string[]
  ): DocOutput {
    if (!diagram) {
      throw new Error('No architecture diagram available');
    }

    let content: string;

    switch (format) {
      case 'markdown':
        content = `# Architecture Diagram\n\n${this.options.description || ''}\n\n\`\`\`mermaid\n${this.diagramGenerator.generateMermaid(diagram)}\n\`\`\``;
        break;

      case 'html':
        content = this.generateArchitectureHTML(diagram);
        break;

      case 'json':
        content = JSON.stringify(diagram, null, 2);
        break;

      default:
        throw new Error(`Unsupported format for architecture: ${format}`);
    }

    return {
      format,
      type: 'architecture',
      content,
      metadata: {
        version: this.options.version || '1.0.0',
        generatedAt: timestamp,
        sourceFiles,
        symbols: docs.reduce((sum, d) => sum + d.symbols.length, 0),
        formatVersion: '1.0.0',
      },
    };
  }

  /**
   * Generate architecture HTML
   *
   * @private
   */
  private generateArchitectureHTML(diagram: ArchitectureDiagram): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Architecture Diagram</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
</head>
<body>
  <h1>${diagram.title}</h1>
  ${diagram.description ? `<p>${diagram.description}</p>` : ''}
  <pre class="mermaid">
${this.diagramGenerator.generateMermaid(diagram)}
  </pre>
  <script>
    mermaid.initialize({ startOnLoad: true });
  </script>
</body>
</html>`;
  }

  /**
   * Generate tutorial documentation
   *
   * @private
   */
  private generateTutorial(
    docs: ParsedDocumentation[],
    format: DocFormat,
    timestamp: number,
    sourceFiles: string[]
  ): DocOutput {
    // Find examples and create tutorial steps
    const examples = this.findExamples(docs);
    const tutorial = this.createTutorial(docs, examples);

    let content: string;

    switch (format) {
      case 'markdown':
        content = this.generateTutorialMarkdown(tutorial);
        break;

      case 'html':
        content = this.generateTutorialHTML(tutorial);
        break;

      case 'json':
        content = JSON.stringify(tutorial, null, 2);
        break;

      default:
        throw new Error(`Unsupported format for tutorial: ${format}`);
    }

    return {
      format,
      type: 'tutorial',
      content,
      metadata: {
        version: this.options.version || '1.0.0',
        generatedAt: timestamp,
        sourceFiles,
        symbols: docs.reduce((sum, d) => sum + d.symbols.length, 0),
        formatVersion: '1.0.0',
      },
    };
  }

  /**
   * Generate all documentation types
   *
   * @private
   */
  private generateAll(
    docs: ParsedDocumentation[],
    diagram: ArchitectureDiagram | undefined,
    format: DocFormat,
    timestamp: number,
    sourceFiles: string[]
  ): DocOutput {
    // Combine all documentation types into one
    const parts: string[] = [];

    if (format === 'markdown') {
      parts.push('# Complete Documentation\n');

      // README
      parts.push('## Project Overview\n');
      parts.push(this.readmeGenerator.generateReadme(docs, diagram));
      parts.push('\n---\n');

      // API Reference
      parts.push('## API Reference\n');
      const apiRef = this.apiGenerator.generateAPIReference(docs);
      parts.push(this.apiGenerator.generateDocumentation(apiRef, format));
      parts.push('\n---\n');

      // Architecture
      if (diagram) {
        parts.push('## Architecture\n');
        parts.push('```mermaid\n');
        parts.push(this.diagramGenerator.generateMermaid(diagram));
        parts.push('```\n');
      }
    } else if (format === 'html') {
      // Generate HTML index with sections
      parts.push(this.generateCompleteHTML(docs, diagram));
    } else {
      throw new Error('Combined documentation only available in Markdown and HTML formats');
    }

    return {
      format,
      type: 'all',
      content: parts.join('\n'),
      metadata: {
        version: this.options.version || '1.0.0',
        generatedAt: timestamp,
        sourceFiles,
        symbols: docs.reduce((sum, d) => sum + d.symbols.length, 0),
        formatVersion: '1.0.0',
      },
    };
  }

  /**
   * Generate complete HTML documentation
   *
   * @private
   */
  private generateCompleteHTML(docs: ParsedDocumentation[], diagram?: ArchitectureDiagram): string {
    const apiRef = this.apiGenerator.generateAPIReference(docs);
    const apiHTML = this.apiGenerator.generateDocumentation(apiRef, 'html');
    const readme = this.readmeGenerator.generateReadme(docs, diagram);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.options.projectName} - Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .nav { position: sticky; top: 0; background: white; padding: 1rem 0; border-bottom: 1px solid #e0e0e0; }
    .nav a { margin-right: 1rem; text-decoration: none; color: #0066cc; }
    .section { margin: 3rem 0; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="#readme">Overview</a>
    <a href="#api">API Reference</a>
    <a href="#architecture">Architecture</a>
  </nav>

  <div id="readme" class="section">
    <h1>Overview</h1>
    ${this.markdownToHTML(readme)}
  </div>

  <div id="api" class="section">
    <h1>API Reference</h1>
    ${apiHTML}
  </div>

  ${diagram ? `
  <div id="architecture" class="section">
    <h1>Architecture</h1>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <pre class="mermaid">
${this.diagramGenerator.generateMermaid(diagram)}
    </pre>
    <script>mermaid.initialize({ startOnLoad: true });</script>
  </div>
  ` : ''}
</body>
</html>`;
  }

  /**
   * Generate tutorial markdown
   *
   * @private
   */
  private generateTutorialMarkdown(tutorial: Tutorial): string {
    const lines: string[] = [];

    lines.push(`# ${tutorial.title}`);
    lines.push('');
    lines.push(tutorial.description);
    lines.push('');
    lines.push(`**Difficulty:** ${tutorial.difficulty}`);
    lines.push('');
    lines.push(`**Duration:** ${tutorial.duration} minutes`);
    lines.push('');

    if (tutorial.prerequisites && tutorial.prerequisites.length > 0) {
      lines.push('## Prerequisites');
      lines.push('');
      for (const prereq of tutorial.prerequisites) {
        lines.push(`- ${prereq}`);
      }
      lines.push('');
    }

    lines.push('## Steps');
    lines.push('');

    for (const step of tutorial.steps) {
      lines.push(`### ${step.title}`);
      lines.push('');
      lines.push(step.description);
      lines.push('');

      if (step.code) {
        lines.push('```typescript');
        lines.push(step.code);
        lines.push('```');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate tutorial HTML
   *
   * @private
   */
  private generateTutorialHTML(tutorial: Tutorial): string {
    const steps = tutorial.steps.map(step => `
      <div class="step">
        <h3>${step.title}</h3>
        <p>${step.description}</p>
        ${step.code ? `<pre><code>${this.escapeHTML(step.code)}</code></pre>` : ''}
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <title>${tutorial.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    .step { margin: 2rem 0; padding: 1rem; background: #fafafa; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${tutorial.title}</h1>
  <p>${tutorial.description}</p>
  <p><strong>Difficulty:</strong> ${tutorial.difficulty}</p>
  <p><strong>Duration:</strong> ${tutorial.duration} minutes</p>
  ${steps}
</body>
</html>`;
  }

  /**
   * Create tutorial from documentation
   *
   * @private
   */
  private createTutorial(docs: ParsedDocumentation[], examples: Array<{ title: string; description: string; code: string }>): Tutorial {
    return {
      id: 'getting-started',
      title: `Getting Started with ${this.options.projectName}`,
      description: this.options.description || 'Learn the basics of using this library.',
      difficulty: 'beginner',
      duration: 15,
      prerequisites: [
        'Node.js 18 or higher',
        'Basic TypeScript knowledge',
      ],
      steps: examples.slice(0, 5).map((ex, i) => ({
        title: `Step ${i + 1}: ${ex.title}`,
        description: ex.description,
        code: ex.code,
        language: 'typescript',
        order: i,
      })),
      tags: ['beginner', 'tutorial'],
    };
  }

  /**
   * Find examples from documentation
   *
   * @private
   */
  private findExamples(docs: ParsedDocumentation[]): Array<{ title: string; description: string; code: string }> {
    const examples: Array<{ title: string; description: string; code: string }> = [];

    for (const doc of docs) {
      for (const symbol of doc.symbols) {
        if (symbol.examples && symbol.examples.length > 0) {
          for (const example of symbol.examples) {
            examples.push({
              title: symbol.name,
              description: symbol.summary || '',
              code: example,
            });
          }
        }
      }
    }

    return examples;
  }

  /**
   * Convert markdown to HTML (simple implementation)
   *
   * @private
   */
  private markdownToHTML(markdown: string): string {
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/```typescript\n([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/\n/gim, '<br>');
  }

  /**
   * Escape HTML
   *
   * @private
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Create generation result
   *
   * @private
   */
  private createResult(
    outputs: DocOutput[],
    errors: string[],
    warnings: string[],
    startTime: number,
    stats?: {
      filesParsed: number;
      symbolsExtracted: number;
      docsGenerated: number;
      generationTime: number;
    }
  ): GenerationResult {
    return {
      success: errors.length === 0,
      outputs,
      errors,
      warnings,
      stats: stats || {
        filesParsed: 0,
        symbolsExtracted: 0,
        docsGenerated: outputs.length,
        generationTime: performance.now() - startTime,
      },
    };
  }

  /**
   * Generate documentation and save to R2
   *
   * @param files - Array of file contents and paths
   * @param env - Cloudflare environment with R2 binding
   * @returns Upload result
   */
  async generateAndStore(
    files: Array<{ content: string; path: string }>,
    env: { R2?: R2Bucket }
  ): Promise<GenerationResult & { urls: string[] }> {
    const result = await this.generate(files);
    const urls: string[] = [];

    if (env.R2 && result.success) {
      for (const output of result.outputs) {
        const key = `docs/${output.type}-${Date.now()}.${output.format}`;
        await env.R2.put(key, output.content, {
          httpMetadata: {
            contentType: output.format === 'html' ? 'text/html' : 'text/plain',
          },
        });

        urls.push(`/docs/${key}`);
      }
    }

    return { ...result, urls };
  }
}

/**
 * Create a documentation generator instance
 */
export function createDocGenerator(options?: DocGeneratorOptions): DocumentationGenerator {
  return new DocumentationGenerator(options);
}

/**
 * Default documentation generator instance
 */
export const defaultDocGenerator = new DocumentationGenerator();
