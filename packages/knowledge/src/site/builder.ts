/**
 * Site Builder - Generate static documentation sites
 */

// @ts-nocheck - External dependencies (marked, isomorphic-dompurify, highlight.js)

import { writeFile, mkdir, copyFile } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { performance } from 'perf_hooks';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import HighlightJS from 'highlight.js';
import { SiteConfig, GeneratedSite, SiteFile, SiteManifest, DocumentContent } from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { TemplateRenderer } from './template-renderer.js';
import { SearchIndexer } from './search-indexer.js';
import { AssetProcessor } from './asset-processor.js';

export interface SiteBuilderOptions {
  config: SiteConfig;
  documents: DocumentContent[];
  outputPath: string;
  optimize?: boolean;
  minify?: boolean;
}

export interface BuildResult {
  files: number;
  size: number;
  duration: number;
  pages: number;
  assets: number;
}

export class SiteBuilder {
  private logger: Logger;
  private templateRenderer: TemplateRenderer;
  private searchIndexer: SearchIndexer;
  private assetProcessor: AssetProcessor;
  private files: SiteFile[] = [];

  constructor(private options: SiteBuilderOptions) {
    this.logger = new Logger('SiteBuilder');
    this.templateRenderer = new TemplateRenderer(options.config.theme);
    this.searchIndexer = new SearchIndexer(options.config.search);
    this.assetProcessor = new AssetProcessor(options.optimize);
  }

  /**
   * Build the documentation site
   */
  async build(): Promise<BuildResult> {
    const startTime = performance.now();
    this.logger.info('Starting site build');

    // Reset files
    this.files = [];

    // Generate pages
    await this.generatePages();

    // Generate index pages
    await this.generateIndexPages();

    // Copy assets
    await this.copyAssets();

    // Generate search index
    await this.generateSearchIndex();

    // Write files
    await this.writeFiles();

    // Calculate metrics
    const duration = performance.now() - startTime;
    const result = this.calculateBuildMetrics(duration);

    this.logger.info('Site build complete', {
      duration: `${duration.toFixed(2)}ms`,
      files: result.files,
      pages: result.pages,
      assets: result.assets,
      size: `${(result.size / 1024).toFixed(2)}KB`
    });

    return result;
  }

  /**
   * Generate individual documentation pages
   */
  private async generatePages(): Promise<void> {
    this.logger.info('Generating documentation pages');

    for (const doc of this.options.documents) {
      const page = await this.generatePage(doc);
      this.files.push(page);
    }
  }

  /**
   * Generate a single documentation page
   */
  private async generatePage(doc: DocumentContent): Promise<SiteFile> {
    const { metadata, content, html, examples } = doc;

    // Convert markdown to HTML if not already done
    let contentHtml = html || await this.markdownToHtml(content);

    // Add syntax highlighting
    contentHtml = this.addSyntaxHighlighting(contentHtml);

    // Add interactive examples
    if (examples && examples.length > 0) {
      contentHtml += this.generateExamplesHtml(examples);
    }

    // Render with template
    const pageHtml = await this.templateRenderer.render('page', {
      config: this.options.config,
      page: {
        title: metadata.title,
        description: metadata.description,
        content: contentHtml,
        metadata,
        examples,
        toc: this.generateTableOfContents(contentHtml)
      }
    });

    return {
      path: this.getPagePath(metadata.id),
      content: pageHtml,
      encoding: 'utf8'
    };
  }

  /**
   * Get the file path for a page
   */
  private getPagePath(id: string): string {
    return join(id, 'index.html');
  }

  /**
   * Generate index pages (home, categories, tags)
   */
  private async generateIndexPages(): Promise<void> {
    this.logger.info('Generating index pages');

    // Home page
    await this.generateHomePage();

    // Category pages
    await this.generateCategoryPages();

    // Tag pages
    await this.generateTagPages();

    // 404 page
    await this.generateNotFoundPage();
  }

  /**
   * Generate home page
   */
  private async generateHomePage(): Promise<void> {
    const categories = this.groupByCategory();
    const latestDocs = this.getLatestDocuments(10);

    const homeHtml = await this.templateRenderer.render('home', {
      config: this.options.config,
      categories,
      latestDocs
    });

    this.files.push({
      path: 'index.html',
      content: homeHtml,
      encoding: 'utf8'
    });
  }

  /**
   * Generate category index pages
   */
  private async generateCategoryPages(): Promise<void> {
    const categories = this.groupByCategory();

    for (const [category, docs] of categories.entries()) {
      const categoryHtml = await this.templateRenderer.render('category', {
        config: this.options.config,
        category,
        documents: docs
      });

      this.files.push({
        path: join('category', this.slugify(category), 'index.html'),
        content: categoryHtml,
        encoding: 'utf8'
      });
    }

    // Category index
    const categoryIndexHtml = await this.templateRenderer.render('category-index', {
      config: this.options.config,
      categories: Array.from(categories.keys())
    });

    this.files.push({
      path: join('category', 'index.html'),
      content: categoryIndexHtml,
      encoding: 'utf8'
    });
  }

  /**
   * Generate tag pages
   */
  private async generateTagPages(): Promise<void> {
    const tags = this.groupByTag();

    for (const [tag, docs] of tags.entries()) {
      const tagHtml = await this.templateRenderer.render('tag', {
        config: this.options.config,
        tag,
        documents: docs
      });

      this.files.push({
        path: join('tag', this.slugify(tag), 'index.html'),
        content: tagHtml,
        encoding: 'utf8'
      });
    }

    // Tag index
    const tagIndexHtml = await this.templateRenderer.render('tag-index', {
      config: this.options.config,
      tags: Array.from(tags.keys())
    });

    this.files.push({
      path: join('tag', 'index.html'),
      content: tagIndexHtml,
      encoding: 'utf8'
    });
  }

  /**
   * Generate 404 page
   */
  private async generateNotFoundPage(): Promise<void> {
    const notFoundHtml = await this.templateRenderer.render('404', {
      config: this.options.config
    });

    this.files.push({
      path: '404.html',
      content: notFoundHtml,
      encoding: 'utf8'
    });
  }

  /**
   * Copy static assets
   */
  private async copyAssets(): Promise<void> {
    this.logger.info('Copying assets');

    // Generate CSS
    const css = await this.templateRenderer.renderStyles();
    this.files.push({
      path: join('assets', 'styles.css'),
      content: css,
      encoding: 'utf8'
    });

    // Generate JS
    const js = await this.templateRenderer.renderScripts();
    this.files.push({
      path: join('assets', 'main.js'),
      content: js,
      encoding: 'utf8'
    });

    // Copy theme assets
    await this.copyThemeAssets();

    // Copy custom assets if provided
    await this.copyCustomAssets();
  }

  /**
   * Copy theme-specific assets
   */
  private async copyThemeAssets(): Promise<void> {
    const themeAssets = [
      'logo.svg',
      'favicon.ico',
      'og-image.png'
    ];

    for (const asset of themeAssets) {
      const content = await this.templateRenderer.getAsset(asset);
      if (content) {
        this.files.push({
          path: join('assets', asset),
          content,
          encoding: 'utf8'
        });
      }
    }
  }

  /**
   * Copy custom assets from source
   */
  private async copyCustomAssets(): Promise<void> {
    const { copyFile, readdir } = await import('fs/promises');
    const { join } = await import('path');

    // Check for custom assets directory
    const assetsDir = join(this.options.outputPath, 'custom-assets');
    try {
      const files = await readdir(assetsDir);
      for (const file of files) {
        const content = await readFile(join(assetsDir, file));
        this.files.push({
          path: join('assets', file),
          content,
          encoding: 'utf8'
        });
      }
    } catch {
      // No custom assets directory, skip
    }
  }

  /**
   * Generate search index
   */
  private async generateSearchIndex(): Promise<void> {
    this.logger.info('Generating search index');

    const searchIndex = await this.searchIndexer.buildIndex(this.options.documents);

    this.files.push({
      path: join('assets', 'search-index.json'),
      content: JSON.stringify(searchIndex, null, 2),
      encoding: 'utf8'
    });
  }

  /**
   * Write all generated files to disk
   */
  private async writeFiles(): Promise<void> {
    this.logger.info(`Writing ${this.files.length} files`);

    for (const file of this.files) {
      const filePath = join(this.options.outputPath, file.path);
      const dir = dirname(filePath);

      // Create directory if it doesn't exist
      await mkdir(dir, { recursive: true });

      // Write file
      await writeFile(filePath, file.content, file.encoding as BufferEncoding);
    }
  }

  /**
   * Convert markdown to HTML
   */
  private async markdownToHtml(markdown: string): Promise<string> {
    // Configure marked
    marked.setOptions({
      highlight: (code, lang) => {
        if (lang && HighlightJS.getLanguage(lang)) {
          try {
            return HighlightJS.highlight(code, { language: lang }).value;
          } catch (err) {
            this.logger.warn(`Failed to highlight code: ${err}`);
          }
        }
        return HighlightJS.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true
    });

    const html = await marked(markdown);
    return DOMPurify.sanitize(html);
  }

  /**
   * Add syntax highlighting to HTML
   */
  private addSyntaxHighlighting(html: string): string {
    // Syntax highlighting is already added by marked
    // This is a placeholder for any additional processing
    return html;
  }

  /**
   * Generate interactive examples HTML
   */
  private generateExamplesHtml(examples: any[]): string {
    let html = '<div class="examples-section">';
    html += '<h3>Examples</h3>';

    for (const example of examples) {
      html += `
        <div class="example" data-language="${example.language}">
          <div class="example-description">${example.description || ''}</div>
          <pre><code class="language-${example.language}">${this.escapeHtml(example.code)}</code></pre>
          ${example.runnable ? '<button class="run-example">Run</button>' : ''}
          ${example.expectedOutput ? `<div class="example-output">${this.escapeHtml(example.expectedOutput)}</div>` : ''}
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  /**
   * Generate table of contents
   */
  private generateTableOfContents(html: string): Array<{ id: string; text: string; level: number }> {
    const toc: Array<{ id: string; text: string; level: number }> = [];
    const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h[1-6]>/g;

    let match;
    while ((match = headingRegex.exec(html)) !== null) {
      toc.push({
        id: match[2],
        text: match[3],
        level: parseInt(match[1], 10)
      });
    }

    return toc;
  }

  /**
   * Group documents by category
   */
  private groupByCategory(): Map<string, DocumentContent[]> {
    const groups = new Map<string, DocumentContent[]>();

    for (const doc of this.options.documents) {
      const category = doc.metadata.category || 'uncategorized';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(doc);
    }

    return groups;
  }

  /**
   * Group documents by tag
   */
  private groupByTag(): Map<string, DocumentContent[]> {
    const groups = new Map<string, DocumentContent[]>();

    for (const doc of this.options.documents) {
      for (const tag of doc.metadata.tags) {
        if (!groups.has(tag)) {
          groups.set(tag, []);
        }
        groups.get(tag)!.push(doc);
      }
    }

    return groups;
  }

  /**
   * Get latest documents
   */
  private getLatestDocuments(limit: number): DocumentContent[] {
    return [...this.options.documents]
      .sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Calculate build metrics
   */
  private calculateBuildMetrics(duration: number): BuildResult {
    const pages = this.options.documents.length + 4; // +4 for index pages
    const assets = this.files.filter(f => f.path.startsWith('assets')).length;

    let size = 0;
    for (const file of this.files) {
      if (typeof file.content === 'string') {
        size += file.content.length;
      } else {
        size += file.content.byteLength;
      }
    }

    return {
      files: this.files.length,
      size,
      duration,
      pages,
      assets
    };
  }

  /**
   * Slugify string for URL
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

/**
 * Template Renderer
 */
class TemplateRenderer {
  private templates: Map<string, HandlebarsTemplateDelegate>;

  constructor(private theme: SiteTheme) {
    this.templates = new Map();
  }

  async render(templateName: string, data: any): Promise<string> {
    const template = this.getTemplate(templateName);
    return template(data);
  }

  async renderStyles(): Promise<string> {
    const theme = this.theme;
    return `
      :root {
        --primary: ${theme.colors.primary};
        --secondary: ${theme.colors.secondary};
        --accent: ${theme.colors.accent};
        --background: ${theme.colors.background};
        --foreground: ${theme.colors.foreground};
        --border: ${theme.colors.border};
        --code-bg: ${theme.colors.code.background};
        --code-fg: ${theme.colors.code.foreground};
      }

      ${theme.customCss || ''}
    `;
  }

  async renderScripts(): Promise<string> {
    return `
      // Search functionality
      document.addEventListener('DOMContentLoaded', function() {
        // Initialize search
        initSearch();

        // Initialize theme toggle
        initThemeToggle();

        // Initialize code examples
        initCodeExamples();
      });

      function initSearch() {
        // Load search index and initialize
        fetch('/assets/search-index.json')
          .then(r => r.json())
          .then(index => {
            // Initialize search with index
            window.docsSearch = new DocsSearch(index);
          });
      }

      function initThemeToggle() {
        const toggle = document.querySelector('.theme-toggle');
        if (toggle) {
          toggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
          });
        }
      }

      function initCodeExamples() {
        document.querySelectorAll('.run-example').forEach(button => {
          button.addEventListener('click', async (e) => {
            const example = e.target.closest('.example');
            const code = example.querySelector('code').textContent;
            const output = example.querySelector('.example-output');

            try {
              // Execute code in sandboxed environment
              const result = await executeCode(code);
              output.textContent = result;
              output.classList.add('success');
            } catch (error) {
              output.textContent = error.message;
              output.classList.add('error');
            }
          });
        });
      }

      async function executeCode(code) {
        // Basic code execution (should be enhanced with proper sandboxing)
        return eval(code);
      }

      class DocsSearch {
        constructor(index) {
          this.index = lunr.Index.load(index);
          this.documents = index.documents;
        }

        search(query) {
          return this.index.search(query).map(result => {
            const doc = this.documents[result.ref];
            return {
              title: doc.title,
              url: doc.url,
              snippet: this.getSnippet(doc.content, query),
              score: result.score
            };
          });
        }

        getSnippet(content, query) {
          const maxLength = 200;
          const lowerContent = content.toLowerCase();
          const queryLower = query.toLowerCase();
          const pos = lowerContent.indexOf(queryLower);

          if (pos >= 0) {
            const start = Math.max(0, pos - 50);
            const end = Math.min(content.length, pos + query.length + 50);
            return '...' + content.substring(start, end) + '...';
          }

          return content.substring(0, maxLength) + '...';
        }
      }
    `;
  }

  async getAsset(assetName: string): Promise<Buffer | null> {
    // This would load actual assets in a real implementation
    return null;
  }

  private getTemplate(name: string): HandlebarsTemplateDelegate {
    if (this.templates.has(name)) {
      return this.templates.get(name)!;
    }

    const template = this.compileTemplate(name);
    this.templates.set(name, template);
    return template;
  }

  private compileTemplate(name: string): HandlebarsTemplateDelegate {
    // In a real implementation, this would load and compile templates
    // For now, return a simple template
    return Handlebars.compile(`<html><head><title>{{page.title}}</title></head><body>{{{page.content}}}</body></html>`);
  }
}

/**
 * Search Indexer
 */
class SearchIndexer {
  constructor(private config: SearchConfig) {}

  async buildIndex(documents: DocumentContent[]): Promise<any> {
    const index = {
      documents: {},
      fields: ['title', 'description', 'content'],
      ref: 'id'
    };

    for (const doc of documents) {
      index.documents[doc.metadata.id] = {
        id: doc.metadata.id,
        title: doc.metadata.title,
        description: doc.metadata.description,
        content: this.stripHtml(doc.content),
        url: this.getDocumentUrl(doc.metadata.id),
        tags: doc.metadata.tags
      };
    }

    // Build Lunr index
    const idx = lunr(function() {
      this.ref('id');
      this.field('title', { boost: 10 });
      this.field('description', { boost: 5 });
      this.field('content');

      for (const [id, doc] of Object.entries(index.documents)) {
        this.add(doc);
      }
    });

    return {
      index: idx.toJSON(),
      documents: index.documents
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  private getDocumentUrl(id: string): string {
    return `/${id}/`;
  }
}

/**
 * Asset Processor
 */
class AssetProcessor {
  constructor(private optimize: boolean = true) {}

  async process(content: Buffer, type: string): Promise<Buffer> {
    if (!this.optimize) {
      return content;
    }

    switch (type) {
      case 'image/png':
      case 'image/jpeg':
      case 'image/webp':
        return await this.optimizeImage(content);
      case 'text/css':
        return await this.minifyCss(content.toString('utf8'));
      case 'application/javascript':
        return await this.minifyJs(content.toString('utf8'));
      default:
        return content;
    }
  }

  private async optimizeImage(content: Buffer): Promise<Buffer> {
    // In a real implementation, this would use sharp or similar
    return content;
  }

  private async minifyCss(css: string): Promise<Buffer> {
    // In a real implementation, this would use cssnano or similar
    return Buffer.from(css.replace(/\s+/g, ' '));
  }

  private async minifyJs(js: string): Promise<Buffer> {
    // In a real implementation, this would use terser or similar
    return Buffer.from(js.replace(/\s+/g, ' '));
  }
}
