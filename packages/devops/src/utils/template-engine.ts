/**
 * Template engine for generating IaC configurations
 */

import * as Handlebars from 'handlebars';
import { Logger } from './logger';

export class TemplateEngine {
  private logger: Logger;
  private handlebars: typeof Handlebars;

  constructor(logger: Logger) {
    this.logger = logger;
    this.handlebars = Handlebars.create();

    // Register custom helpers
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // JSON stringify helper
    this.handlebars.registerHelper('json', (context) => {
      return JSON.stringify(context);
    });

    // Equals helper
    this.handlebars.registerHelper('eq', (a, b) => {
      return a === b;
    });

    // Not equals helper
    this.handlebars.registerHelper('ne', (a, b) => {
      return a !== b;
    });

    // And helper
    this.handlebars.registerHelper('and', (...args) => {
      return Array.prototype.every.call(args, Boolean);
    });

    // Or helper
    this.handlebars.registerHelper('or', (...args) => {
      return Array.prototype.slice.call(args, 0, -1).some(Boolean);
    });

    // Default helper
    this.handlebars.registerHelper('default', (value, defaultValue) => {
      return value !== undefined && value !== null ? value : defaultValue;
    });

    // Truncate helper
    this.handlebars.registerHelper('truncate', (str, length) => {
      if (typeof str !== 'string') return str;
      if (str.length <= length) return str;
      return str.substring(0, length - 3) + '...';
    });

    // Uppercase helper
    this.handlebars.registerHelper('uppercase', (str) => {
      return typeof str === 'string' ? str.toUpperCase() : str;
    });

    // Lowercase helper
    this.handlebars.registerHelper('lowercase', (str) => {
      return typeof str === 'string' ? str.toLowerCase() : str;
    });

    // Replace helper
    this.handlebars.registerHelper('replace', (str, search, replace) => {
      if (typeof str !== 'string') return str;
      return str.replace(new RegExp(search, 'g'), replace);
    });
  }

  /**
   * Compile a template
   */
  compile(template: string): HandlebarsTemplateDelegate {
    return this.handlebars.compile(template);
  }

  /**
   * Render a template with data
   */
  render(template: string, data: any): string {
    try {
      const compiled = this.compile(template);
      return compiled(data);
    } catch (error: any) {
      this.logger.error('Template render failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Register a partial template
   */
  registerPartial(name: string, template: string): void {
    this.handlebars.registerPartial(name, template);
  }

  /**
   * Register a custom helper
   */
  registerHelper(name: string, fn: (...args: any[]) => any): void {
    this.handlebars.registerHelper(name, fn);
  }
}
