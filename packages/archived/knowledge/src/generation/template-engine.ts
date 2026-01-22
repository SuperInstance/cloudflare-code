/**
 * Template Engine for documentation generation
 */

// @ts-nocheck - External dependencies (handlebars, marked)

import { readFileSync } from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';
import { marked } from 'marked';
import { DocumentMetadata, DocumentContent } from '../types/index.js';
import { Logger } from '../utils/logger.js';

export class TemplateEngine {
  private logger: Logger;
  private templates: Map<string, HandlebarsTemplateDelegate>;
  private theme: any;

  constructor(themeName?: string) {
    this.logger = new Logger('TemplateEngine');
    this.templates = new Map();
    this.theme = this.loadTheme(themeName);
    this.registerHelpers();
  }

  /**
   * Render document with template
   */
  async render(content: string, metadata: DocumentMetadata): Promise<string> {
    const template = this.getTemplate('document');
    return template({
      content,
      metadata,
      theme: this.theme
    });
  }

  /**
   * Render markdown to HTML
   */
  async renderMarkdown(markdown: string): Promise<string> {
    return marked(markdown);
  }

  /**
   * Get template by name
   */
  private getTemplate(name: string): HandlebarsTemplateDelegate {
    if (this.templates.has(name)) {
      return this.templates.get(name)!;
    }

    const template = this.compileTemplate(name);
    this.templates.set(name, template);
    return template;
  }

  /**
   * Compile template
   */
  private compileTemplate(name: string): HandlebarsTemplateDelegate {
    const templateSource = this.getDefaultTemplate(name);
    return Handlebars.compile(templateSource);
  }

  /**
   * Get default template
   */
  private getDefaultTemplate(name: string): string {
    const templates: Record<string, string> = {
      document: `
<!DOCTYPE html>
<html lang="{{metadata.language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{metadata.title}} - Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1, h2, h3 { margin-top: 1.5em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
  </style>
</head>
<body>
  <h1>{{metadata.title}}</h1>
  <p class="description">{{metadata.description}}</p>
  <div class="content">
    {{{content}}}
  </div>
</body>
</html>
      `.trim(),

      page: `
<!DOCTYPE html>
<html lang="{{page.metadata.language}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{page.title}}</title>
</head>
<body>
  <header>
    <h1>{{page.title}}</h1>
  </header>
  <main>
    {{{page.content}}}
  </main>
</body>
</html>
      `.trim()
    };

    return templates[name] || '';
  }

  /**
   * Load theme configuration
   */
  private loadTheme(themeName?: string): any {
    return {
      name: themeName || 'default',
      colors: {
        primary: '#0066cc',
        secondary: '#6c757d',
        background: '#ffffff',
        foreground: '#212529'
      }
    };
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    Handlebars.registerHelper('and', (a: any, b: any) => a && b);
    Handlebars.registerHelper('or', (a: any, b: any) => a || b);
    Handlebars.registerHelper('not', (a: any) => !a);

    Handlebars.registerHelper('json', (obj: any) => JSON.stringify(obj));
    Handlebars.registerHelper('toLowerCase', (str: string) => str.toLowerCase());
    Handlebars.registerHelper('toUpperCase', (str: string) => str.toUpperCase());

    Handlebars.registerHelper('formatDate', (date: Date) => {
      return new Date(date).toLocaleDateString();
    });

    Handlebars.registerHelper('slugify', (str: string) => {
      return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    });
  }
}
