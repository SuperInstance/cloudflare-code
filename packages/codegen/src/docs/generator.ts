/**
 * Documentation Generator
 * Generates API documentation, code comments, README files, etc.
 */

import { Language, DocsOptions, GeneratedDocumentation, DocumentationSection, APIDocumentation, TypeDocumentation, CodeExample, Diagram, TableOfContents, SearchIndex, CodeFile } from '../types/index.js';
import { FileManager } from '../utils/file-manager.js';
import { TemplateEngine } from '../templates/engine.js';

/**
 * Documentation Generator class
 */
export class DocumentationGenerator {
  private fileManager: FileManager;
  private templateEngine: TemplateEngine;

  constructor() {
    this.fileManager = new FileManager();
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Generate documentation from source code
   */
  async generate(options: DocsOptions): Promise<GeneratedDocumentation> {
    const sourceFiles = await this.readSourceFiles(options.sourcePath);

    const sections: DocumentationSection[] = [];
    const examples: CodeExample[] = [];
    const diagrams: Diagram[] = [];
    let toc: TableOfContents | undefined;
    let searchIndex: SearchIndex | undefined;

    if (options.docType === 'api' || options.docType === 'all') {
      const apiDocs = await this.generateAPIDocumentation(sourceFiles, options);
      sections.push(...this.apiDocsToSections(apiDocs));
      examples.push(...apiDocs.examples || []);
    }

    if (options.docType === 'code' || options.docType === 'all') {
      const typeDocs = await this.generateTypeDocumentation(sourceFiles, options);
      sections.push(...this.typeDocsToSections(typeDocs));
    }

    if (options.docType === 'readme' || options.docType === 'all') {
      const readmeSection = await this.generateReadme(sourceFiles, options);
      sections.unshift(readmeSection);
    }

    if (options.docType === 'architecture' || options.docType === 'all') {
      const archDiagrams = await this.generateArchitectureDiagrams(sourceFiles, options);
      diagrams.push(...archDiagrams);
    }

    if (options.toc) {
      toc = this.generateTableOfContents(sections);
    }

    if (options.searchIndex) {
      searchIndex = this.generateSearchIndex(sections, sourceFiles);
    }

    const files = await this.createDocFiles(sections, options);

    return {
      title: 'API Documentation',
      description: 'Comprehensive API documentation',
      version: '1.0.0',
      format: options.format,
      files,
      sections,
      examples,
      diagrams,
      toc,
      searchIndex
    };
  }

  /**
   * Generate API documentation
   */
  private async generateAPIDocumentation(
    sourceFiles: CodeFile[],
    options: DocsOptions
  ): Promise<APIDocumentation> {
    const endpoints: any[] = [];
    const models: any[] = [];
    const errors: any[] = [];

    for (const file of sourceFiles) {
      // Extract API endpoints from file
      const fileEndpoints = this.extractEndpoints(file);
      endpoints.push(...fileEndpoints);

      // Extract models
      const fileModels = this.extractModels(file);
      models.push(...fileModels);
    }

    return {
      endpoints,
      models,
      errors,
      authentication: {
        type: 'Bearer',
        description: 'Bearer token authentication',
        setup: 'Include Authorization header with Bearer token',
        examples: [
          {
            title: 'Authenticated Request',
            description: 'Making an authenticated request',
            code: 'fetch(url, { headers: { Authorization: "Bearer <token>" } })',
            language: Language.TypeScript
          }
        ]
      }
    };
  }

  /**
   * Generate type documentation
   */
  private async generateTypeDocumentation(
    sourceFiles: CodeFile[],
    options: DocsOptions
  ): Promise<TypeDocumentation> {
    const types: any[] = [];
    const interfaces: any[] = [];
    const enums: any[] = [];

    for (const file of sourceFiles) {
      if (file.language === Language.TypeScript || file.language === Language.JavaScript) {
        const fileTypes = this.extractTypes(file);
        types.push(...fileTypes);

        const fileInterfaces = this.extractInterfaces(file);
        interfaces.push(...fileInterfaces);

        const fileEnums = this.extractEnums(file);
        enums.push(...fileEnums);
      }
    }

    return { types, interfaces, enums };
  }

  /**
   * Generate README
   */
  private async generateReadme(
    sourceFiles: CodeFile[],
    options: DocsOptions
  ): Promise<DocumentationSection> {
    let content = `# Project Documentation\n\n`;
    content += `## Description\n\n`;
    content += `This project provides...\n\n`;
    content += `## Installation\n\n`;
    content += `\`\`\`bash\nnpm install\n\`\`\n\n`;
    content += `## Usage\n\n`;
    content += `\`\`\`typescript\nimport { Something } from './src';\n\`\`\n\n`;
    content += `## Features\n\n`;
    content += `- Feature 1\n- Feature 2\n\n`;
    content += `## API Reference\n\n`;
    content += `See [API Documentation](./docs/api.md)\n\n`;
    content += `## Contributing\n\n`;
    content += `Contributions are welcome!\n\n`;
    content += `## License\n\n`;
    content += `MIT\n`;

    return {
      title: 'README',
      content,
      level: 1,
      anchor: 'readme'
    };
  }

  /**
   * Generate architecture diagrams
   */
  private async generateArchitectureDiagrams(
    sourceFiles: CodeFile[],
    options: DocsOptions
  ): Promise<Diagram[]> {
    const diagrams: Diagram[] = [];

    diagrams.push({
      type: 'flowchart',
      title: 'System Architecture',
      description: 'High-level system architecture',
      format: 'mermaid',
      source: `graph TD
    A[Client] --> B[API Gateway]
    B --> C[Service A]
    B --> D[Service B]
    C --> E[Database]
    D --> E`
    });

    diagrams.push({
      type: 'sequence',
      title: 'Request Flow',
      description: 'Sequence diagram for API requests',
      format: 'mermaid',
      source: `sequenceDiagram
    participant Client
    participant API
    participant Service
    participant DB

    Client->>API: Request
    API->>Service: Process
    Service->>DB: Query
    DB-->>Service: Result
    Service-->>API: Response
    API-->>Client: Response`
    });

    return diagrams;
  }

   /**
   * Generate table of contents
   */
  private generateTableOfContents(sections: DocumentationSection[]): TableOfContents {
    const items = this.sectionsToTOCItems(sections);

    return { items };
  }

  /**
   * Generate search index
   */
  private generateSearchIndex(
    sections: DocumentationSection[],
    sourceFiles: CodeFile[]
  ): SearchIndex {
    const entries: any[] = [];

    for (const section of sections) {
      entries.push({
        id: section.anchor,
        title: section.title,
        content: section.content.substring(0, 200),
        keywords: this.extractKeywords(section.content),
        url: `#${section.anchor}`,
        category: 'documentation'
      });
    }

    for (const file of sourceFiles) {
      for (const exp of file.exports || []) {
        entries.push({
          id: `${file.path}-${exp.name}`,
          title: exp.name,
          content: `${exp.type} from ${file.path}`,
          keywords: [exp.name, exp.type, file.path],
          url: file.path,
          category: 'code'
        });
      }
    }

    return { entries };
  }

  /**
   * Create documentation files
   */
  private async createDocFiles(
    sections: DocumentationSection[],
    options: DocsOptions
  ): Promise<any[]> {
    const files: any[] = [];

    if (options.format === 'markdown') {
      const mdContent = this.sectionsToMarkdown(sections);
      files.push({
        path: 'docs/api.md',
        content: mdContent,
        language: Language.TypeScript
      });
    } else if (options.format === 'html') {
      const htmlContent = this.sectionsToHTML(sections);
      files.push({
        path: 'docs/api.html',
        content: htmlContent,
        language: Language.TypeScript
      });
    } else if (options.format === 'json') {
      const jsonContent = JSON.stringify(sections, null, 2);
      files.push({
        path: 'docs/api.json',
        content: jsonContent,
        language: Language.TypeScript
      });
    }

    return files;
  }

  /**
   * Convert sections to markdown
   */
  private sectionsToMarkdown(sections: DocumentationSection[]): string {
    let md = '';

    for (const section of sections) {
      const prefix = '#'.repeat(section.level);
      md += `${prefix} ${section.title}\n\n`;
      md += `${section.content}\n\n`;
    }

    return md;
  }

  /**
   * Convert sections to HTML
   */
  private sectionsToHTML(sections: DocumentationSection[]): string {
    let html = '<!DOCTYPE html>\n<html>\n<head>\n<title>Documentation</title>\n</head>\n<body>\n';

    for (const section of sections) {
      const tag = `h${section.level}`;
      html += `<${tag} id="${section.anchor}">${section.title}</${tag}>\n`;
      html += `<div>${section.content}</div>\n`;
    }

    html += '</body>\n</html>';
    return html;
  }

  /**
   * Read source files
   */
  private async readSourceFiles(sourcePath: string): Promise<CodeFile[]> {
    const { glob } = await import('glob');
    const { extname } = await import('path');
    const { readFile } = await import('fs/promises');

    const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py'];
    const filePaths: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(`${sourcePath}/${pattern}`);
      filePaths.push(...matches);
    }

    const files: CodeFile[] = [];
    for (const filePath of filePaths) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const ext = extname(filePath);
        const language = this.getLanguageFromExtension(ext);

        files.push({
          path: filePath,
          language,
          content,
          exports: this.extractExports(content, language),
          imports: this.extractImports(content, language)
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return files;
  }

  /**
   * Get language from file extension
   */
  private getLanguageFromExtension(ext: string): Language {
    const extMap: Record<string, Language> = {
      '.ts': Language.TypeScript,
      '.tsx': Language.TypeScript,
      '.js': Language.JavaScript,
      '.jsx': Language.JavaScript,
      '.py': Language.Python,
      '.go': Language.Go,
      '.rs': Language.Rust,
      '.java': Language.Java
    };

    return extMap[ext] || Language.TypeScript;
  }

  /**
   * Extract exports from code
   */
  private extractExports(code: string, language: Language): any[] {
    const exports: any[] = [];

    if (language === Language.TypeScript || language === Language.JavaScript) {
      const functionExports = code.match(/export\s+(?:async\s+)?function\s+(\w+)/g);
      if (functionExports) {
        for (const match of functionExports) {
          const name = match.match(/function\s+(\w+)/)?.[1];
          if (name) {
            exports.push({ name, type: 'function' });
          }
        }
      }

      const classExports = code.match(/export\s+class\s+(\w+)/g);
      if (classExports) {
        for (const match of classExports) {
          const name = match.match(/class\s+(\w+)/)?.[1];
          if (name) {
            exports.push({ name, type: 'class' });
          }
        }
      }

      const interfaceExports = code.match(/export\s+interface\s+(\w+)/g);
      if (interfaceExports) {
        for (const match of interfaceExports) {
          const name = match.match(/interface\s+(\w+)/)?.[1];
          if (name) {
            exports.push({ name, type: 'interface' });
          }
        }
      }

      const typeExports = code.match(/export\s+type\s+(\w+)/g);
      if (typeExports) {
        for (const match of typeExports) {
          const name = match.match(/type\s+(\w+)/)?.[1];
          if (name) {
            exports.push({ name, type: 'type' });
          }
        }
      }
    }

    return exports;
  }

  /**
   * Extract imports from code
   */
  private extractImports(code: string, language: Language): any[] {
    const imports: any[] = [];

    if (language === Language.TypeScript || language === Language.JavaScript) {
      const es6Imports = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
      if (es6Imports) {
        for (const match of es6Imports) {
          const module = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
          if (module) {
            imports.push({ module, type: 'es6' });
          }
        }
      }
    }

    return imports;
  }

  /**
   * Extract endpoints from file
   */
  private extractEndpoints(file: CodeFile): any[] {
    const endpoints: any[] = [];

    if (file.language === Language.TypeScript || file.language === Language.JavaScript) {
      // Look for Express-style route definitions
      const routePatterns = [
        /app\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g,
        /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g
      ];

      for (const pattern of routePatterns) {
        let match;
        while ((match = pattern.exec(file.content)) !== null) {
          endpoints.push({
            name: `${match[1].toUpperCase()} ${match[2]}`,
            method: match[1].toUpperCase(),
            path: match[2],
            description: `Endpoint for ${match[2]}`,
            parameters: [],
            requestBody: undefined,
            responses: [],
            examples: []
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Extract models from file
   */
  private extractModels(file: CodeFile): any[] {
    const models: any[] = [];

    if (file.language === Language.TypeScript) {
      const interfaceMatches = file.content.match(/export\s+interface\s+(\w+)\s*{([^}]*)}/g);
      if (interfaceMatches) {
        for (const match of interfaceMatches) {
          const nameMatch = match.match(/interface\s+(\w+)/);
          const fieldsMatch = match.match(/{([^}]*)}/);

          if (nameMatch && fieldsMatch) {
            const fields = fieldsMatch[1].split('\n')
              .map(line => line.trim())
              .filter(line => line && !line.startsWith('//'))
              .map(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                  return {
                    name: parts[0].trim(),
                    type: parts[1].trim(),
                    description: ''
                  };
                }
                return null;
              })
              .filter(Boolean);

            models.push({
              name: nameMatch[1],
              description: `${nameMatch[1]} model`,
              fields: fields
            });
          }
        }
      }
    }

    return models;
  }

  /**
   * Extract types from file
   */
  private extractTypes(file: CodeFile): any[] {
    const types: any[] = [];

    if (file.language === Language.TypeScript) {
      const typeMatches = file.content.match(/export\s+type\s+(\w+)\s*=\s*([^;]+);/g);
      if (typeMatches) {
        for (const match of typeMatches) {
          const nameMatch = match.match(/type\s+(\w+)/);
          const definitionMatch = match.match(/=\s*([^;]+);/);

          if (nameMatch && definitionMatch) {
            types.push({
              name: nameMatch[1],
              definition: definitionMatch[1].trim(),
              description: `${nameMatch[1]} type`
            });
          }
        }
      }
    }

    return types;
  }

  /**
   * Extract interfaces from file
   */
  private extractInterfaces(file: CodeFile): any[] {
    const interfaces: any[] = [];

    if (file.language === Language.TypeScript) {
      const interfaceMatches = file.content.match(/export\s+interface\s+(\w+)\s*{([^}]*)}/g);
      if (interfaceMatches) {
        for (const match of interfaceMatches) {
          const nameMatch = match.match(/interface\s+(\w+)/);
          const bodyMatch = match.match(/{([^}]*)}/);

          if (nameMatch && bodyMatch) {
            const properties = bodyMatch[1].split('\n')
              .map(line => line.trim())
              .filter(line => line && !line.startsWith('//'))
              .map(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                  return {
                    name: parts[0].trim(),
                    type: parts[1].trim(),
                    description: ''
                  };
                }
                return null;
              })
              .filter(Boolean);

            interfaces.push({
              name: nameMatch[1],
              description: `${nameMatch[1]} interface`,
              properties,
              methods: []
            });
          }
        }
      }
    }

    return interfaces;
  }

  /**
   * Extract enums from file
   */
  private extractEnums(file: CodeFile): any[] {
    const enums: any[] = [];

    if (file.language === Language.TypeScript) {
      const enumMatches = file.content.match(/export\s+enum\s+(\w+)\s*{([^}]*)}/g);
      if (enumMatches) {
        for (const match of enumMatches) {
          const nameMatch = match.match(/enum\s+(\w+)/);
          const valuesMatch = match.match(/{([^}]*)}/);

          if (nameMatch && valuesMatch) {
            const values = valuesMatch[1].split(',')
              .map(v => v.trim())
              .filter(v => v)
              .map(v => {
                const parts = v.split('=');
                return {
                  name: parts[0].trim(),
                  value: parts[1] ? parts[1].trim() : parts[0].trim(),
                  description: ''
                };
              });

            enums.push({
              name: nameMatch[1],
              description: `${nameMatch[1]} enum`,
              values
            });
          }
        }
      }
    }

    return enums;
  }

  /**
   * Convert API docs to sections
   */
  private apiDocsToSections(apiDocs: APIDocumentation): DocumentationSection[] {
    const sections: DocumentationSection[] = [];

    sections.push({
      title: 'API Endpoints',
      content: apiDocs.endpoints.map(e => `### ${e.name}\n\n${e.description}\n`).join('\n'),
      level: 2,
      anchor: 'api-endpoints'
    });

    sections.push({
      title: 'Data Models',
      content: apiDocs.models.map(m => `### ${m.name}\n\n${m.description}\n`).join('\n'),
      level: 2,
      anchor: 'data-models'
    });

    return sections;
  }

  /**
   * Convert type docs to sections
   */
  private typeDocsToSections(typeDocs: TypeDocumentation): DocumentationSection[] {
    const sections: DocumentationSection[] = [];

    if (typeDocs.types.length > 0) {
      sections.push({
        title: 'Types',
        content: typeDocs.types.map(t => `### ${t.name}\n\n\`\`\`typescript\n${t.definition}\n\`\`\``).join('\n'),
        level: 2,
        anchor: 'types'
      });
    }

    if (typeDocs.interfaces.length > 0) {
      sections.push({
        title: 'Interfaces',
        content: typeDocs.interfaces.map(i => `### ${i.name}\n\n${i.description}`).join('\n'),
        level: 2,
        anchor: 'interfaces'
      });
    }

    if (typeDocs.enums.length > 0) {
      sections.push({
        title: 'Enums',
        content: typeDocs.enums.map(e => `### ${e.name}\n\n${e.description}`).join('\n'),
        level: 2,
        anchor: 'enums'
      });
    }

    return sections;
  }

  /**
   * Convert sections to TOC items
   */
  private sectionsToTOCItems(sections: DocumentationSection[]): any[] {
    return sections.map(section => ({
      title: section.title,
      anchor: section.anchor,
      level: section.level,
      children: section.children ? this.sectionsToTOCItems(section.children) : undefined
    }));
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Return unique words
    return Array.from(new Set(words));
  }
}
