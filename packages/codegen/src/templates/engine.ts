/**
 * Template Engine
 * Renders templates using various template engines
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * Template engine interface
 */
export interface TemplateEngine {
  render(template: string, data: Record<string, unknown>): Promise<string>;
  renderFile(filePath: string, data: Record<string, unknown>): Promise<string>;
}

/**
 * EJS-based template engine implementation
 */
export class TemplateEngine {
  private cache: Map<string, string> = new Map();

  /**
   * Render a template string with data
   */
  async render(template: string, data: Record<string, unknown>): Promise<string> {
    // Simple variable replacement for {{variable}} syntax
    let result = template;

    // Replace all {{variable}} occurrences
    const pattern = /\{\{(\w+)\}\}/g;
    result = result.replace(pattern, (match, key) => {
      return String(data[key] ?? match);
    });

    // Handle conditionals {{#if condition}}...{{/if}}
    result = await this.renderConditionals(result, data);

    // Handle loops {{#each items}}...{{/each}}
    result = await this.renderLoops(result, data);

    return result;
  }

  /**
   * Render a template file with data
   */
  async renderFile(filePath: string, data: Record<string, unknown>): Promise<string> {
    // Check cache first
    if (this.cache.has(filePath)) {
      return this.render(this.cache.get(filePath)!, data);
    }

    const template = await readFile(filePath, 'utf-8');
    this.cache.set(filePath, template);
    return this.render(template, data);
  }

  /**
   * Render conditionals
   */
  private async renderConditionals(
    template: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const result = template;

    // Handle {{#if condition}}...{{/if}}
    const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

    return result.replace(ifPattern, (match, condition, content) => {
      const value = data[condition];
      const shouldRender = Boolean(value);
      return shouldRender ? content : '';
    });
  }

  /**
   * Render loops
   */
  private async renderLoops(
    template: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const result = template;

    // Handle {{#each items}}...{{/each}}
    const eachPattern = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return result.replace(eachPattern, (match, key, templateContent) => {
      const items = data[key] as Array<Record<string, unknown>> | undefined;

      if (!Array.isArray(items) || items.length === 0) {
        return '';
      }

      return items
        .map(item => {
          let itemContent = templateContent;
          // Replace {{this}} with current item
          itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
          // Replace {{@key}} with item properties
          for (const [prop, value] of Object.entries(item)) {
            itemContent = itemContent.replace(
              new RegExp(`\\{\\{${prop}\\}\\}`, 'g'),
              String(value)
            );
          }
          return itemContent;
        })
        .join('\n');
    });
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Advanced template engine with support for multiple template syntaxes
 */
export class AdvancedTemplateEngine implements TemplateEngine {
  private engines: Map<string, any> = new Map();

  constructor() {
    this.initializeEngines();
  }

  /**
   * Initialize template engines
   */
  private async initializeEngines(): Promise<void> {
    try {
      // Try to load EJS
      const ejs = await import('ejs');
      this.engines.set('ejs', ejs);
    } catch {
      // EJS not available
    }

    try {
      // Try to load Handlebars
      const handlebars = await import('handlebars');
      this.engines.set('handlebars', handlebars);
    } catch {
      // Handlebars not available
    }
  }

  /**
   * Render a template string with data
   */
  async render(
    template: string,
    data: Record<string, unknown>,
    engine: 'simple' | 'ejs' | 'handlebars' = 'simple'
  ): Promise<string> {
    switch (engine) {
      case 'ejs':
        return this.renderWithEJS(template, data);

      case 'handlebars':
        return this.renderWithHandlebars(template, data);

      case 'simple':
      default:
        return this.renderSimple(template, data);
    }
  }

  /**
   * Render a template file with data
   */
  async renderFile(
    filePath: string,
    data: Record<string, unknown>,
    engine: 'simple' | 'ejs' | 'handlebars' = 'simple'
  ): Promise<string> {
    const template = await readFile(filePath, 'utf-8');
    return this.render(template, data, engine);
  }

  /**
   * Render using simple variable replacement
   */
  private async renderSimple(
    template: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const engine = new TemplateEngine();
    return engine.render(template, data);
  }

  /**
   * Render using EJS
   */
  private async renderWithEJS(
    template: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const ejs = this.engines.get('ejs');
    if (!ejs) {
      throw new Error('EJS is not installed');
    }

    return ejs.render(template, data);
  }

  /**
   * Render using Handlebars
   */
  private async renderWithHandlebars(
    template: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const handlebars = this.engines.get('handlebars');
    if (!handlebars) {
      throw new Error('Handlebars is not installed');
    }

    const compiledTemplate = handlebars.compile(template);
    return compiledTemplate(data);
  }

  /**
   * Check if an engine is available
   */
  hasEngine(engine: 'ejs' | 'handlebars'): boolean {
    return this.engines.has(engine);
  }

  /**
   * Get available engines
   */
  getAvailableEngines(): string[] {
    return ['simple', ...Array.from(this.engines.keys())];
  }
}
