/**
 * Template engine for notification content
 */

import type {
  NotificationTemplate,
  TemplateVariable,
  NotificationChannelType,
  NotificationCategory,
} from '../types';

export interface TemplateConfig {
  enableCaching?: boolean;
  cacheSize?: number;
  defaultLocale?: string;
  fallbackLocale?: string;
}

export interface TemplateContext {
  locale?: string;
  timezone?: string;
  variables: Record<string, unknown>;
}

export interface CompiledTemplate {
  template: NotificationTemplate;
  compiled: TemplateFunction;
  variables: Set<string>;
}

export type TemplateFunction = (context: Record<string, unknown>) => string;

/**
 * Template engine implementation
 */
export class TemplateEngine {
  private templates: Map<string, NotificationTemplate> = new Map();
  private compiledTemplates: Map<string, CompiledTemplate> = new Map();
  private config: TemplateConfig;
  private cache: Map<string, string> = new Map();

  constructor(config: TemplateConfig = {}) {
    this.config = {
      enableCaching: true,
      cacheSize: 1000,
      defaultLocale: 'en',
      fallbackLocale: 'en',
      ...config,
    };
  }

  /**
   * Register a template
   */
  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(this.getTemplateKey(template), template);

    // Invalidate compiled template cache
    this.compiledTemplates.delete(this.getTemplateKey(template));

    // Clear rendering cache
    this.clearCache();
  }

  /**
   * Get a template by ID and locale
   */
  getTemplate(
    templateId: string,
    locale?: string
  ): NotificationTemplate | undefined {
    const key = this.getTemplateKeyById(templateId, locale);
    return this.templates.get(key);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Render a template with context
   */
  async render(
    templateId: string,
    context: TemplateContext
  ): Promise<{ subject?: string; content: string; htmlContent?: string }> {
    const locale = context.locale || this.config.defaultLocale!;

    // Get template with locale fallback
    let template = this.getTemplate(templateId, locale);

    if (!template && locale !== this.config.fallbackLocale) {
      template = this.getTemplate(templateId, this.config.fallbackLocale);
    }

    if (!template) {
      throw new Error(`Template not found: ${templateId} (locale: ${locale})`);
    }

    // Validate variables
    this.validateVariables(template, context.variables);

    // Compile template if not already compiled
    const compiled = this.getCompiledTemplate(template);

    // Render subject
    const subject = template.subject
      ? this.renderTemplateString(template.subject, context.variables)
      : undefined;

    // Render content
    const content = compiled.compiled(context.variables);

    // Render HTML content if available
    const htmlContent = template.htmlContent
      ? this.renderTemplateString(template.htmlContent, context.variables)
      : undefined;

    return {
      subject,
      content,
      htmlContent,
    };
  }

  /**
   * Render a template string with variables
   */
  renderTemplateString(template: string, variables: Record<string, unknown>): string {
    // Check cache first
    if (this.config.enableCaching) {
      const cacheKey = this.getCacheKey(template, variables);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Simple template syntax: {{variable}}
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, this.formatValue(value));
    }

    // Handle conditionals: {{#if condition}}...{{/if}}
    result = this.renderConditionals(result, variables);

    // Handle loops: {{#each items}}...{{/each}}
    result = this.renderLoops(result, variables);

    // Cache the result
    if (this.config.enableCaching) {
      const cacheKey = this.getCacheKey(template, variables);
      this.cache.set(cacheKey, result);

      // Limit cache size
      if (this.cache.size > this.config.cacheSize!) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    return result;
  }

  /**
   * Render conditional blocks
   */
  private renderConditionals(
    template: string,
    variables: Record<string, unknown>
  ): string {
    const ifRegex = /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs;

    return template.replace(ifRegex, (match, condition, content) => {
      const value = variables[condition];
      const isTruthy = this.evaluateCondition(value);
      return isTruthy ? content : '';
    });
  }

  /**
   * Render loop blocks
   */
  private renderLoops(template: string, variables: Record<string, unknown>): string {
    const eachRegex = /\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs;

    return template.replace(eachRegex, (match, arrayName, content) => {
      const array = variables[arrayName];

      if (!Array.isArray(array)) {
        return '';
      }

      return array
        .map((item, index) => {
          let itemContent = content;

          // Replace {{this}} with current item
          itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));

          // Replace {{@index}} with current index
          itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));

          // If item is an object, replace its properties
          if (typeof item === 'object' && item !== null) {
            for (const [key, value] of Object.entries(item)) {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
              itemContent = itemContent.replace(regex, this.formatValue(value));
            }
          }

          return itemContent;
        })
        .join('');
    });
  }

  /**
   * Evaluate a condition value
   */
  private evaluateCondition(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      return value.length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }

    return true;
  }

  /**
   * Format a value for rendering
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Get or compile a template
   */
  private getCompiledTemplate(template: NotificationTemplate): CompiledTemplate {
    const key = this.getTemplateKey(template);

    let compiled = this.compiledTemplates.get(key);

    if (!compiled) {
      compiled = this.compileTemplate(template);
      this.compiledTemplates.set(key, compiled);
    }

    return compiled;
  }

  /**
   * Compile a template into a function
   */
  private compileTemplate(template: NotificationTemplate): CompiledTemplate {
    const variables = this.extractVariables(template);

    const compiled = (context: Record<string, unknown>): string => {
      return this.renderTemplateString(template.content, context);
    };

    return {
      template,
      compiled,
      variables,
    };
  }

  /**
   * Extract variables from a template
   */
  private extractVariables(template: NotificationTemplate): Set<string> {
    const variables = new Set<string>();

    // Add declared variables
    for (const variable of template.variables) {
      variables.add(variable.name);
    }

    // Extract variables from content
    const contentVariables = this.extractVariablesFromString(template.content);
    for (const variable of contentVariables) {
      variables.add(variable);
    }

    // Extract variables from subject
    if (template.subject) {
      const subjectVariables = this.extractVariablesFromString(template.subject);
      for (const variable of subjectVariables) {
        variables.add(variable);
      }
    }

    // Extract variables from HTML content
    if (template.htmlContent) {
      const htmlVariables = this.extractVariablesFromString(template.htmlContent);
      for (const variable of htmlVariables) {
        variables.add(variable);
      }
    }

    return variables;
  }

  /**
   * Extract variables from a string
   */
  private extractVariablesFromString(str: string): Set<string> {
    const variables = new Set<string>();
    const regex = /\{\{(\w+)\}\}/g;

    let match;
    while ((match = regex.exec(str)) !== null) {
      variables.add(match[1]);
    }

    return variables;
  }

  /**
   * Validate variables against template requirements
   */
  private validateVariables(
    template: NotificationTemplate,
    variables: Record<string, unknown>
  ): void {
    for (const templateVar of template.variables) {
      const value = variables[templateVar.name];

      // Check required variables
      if (templateVar.required && (value === undefined || value === null)) {
        throw new Error(`Required variable missing: ${templateVar.name}`);
      }

      // Check variable type
      if (value !== undefined && value !== null) {
        if (!this.validateVariableType(value, templateVar.type)) {
          throw new Error(
            `Variable type mismatch: ${templateVar.name} expected ${templateVar.type}, got ${typeof value}`
          );
        }
      }
    }
  }

  /**
   * Validate variable type
   */
  private validateVariableType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';

      case 'number':
        return typeof value === 'number';

      case 'boolean':
        return typeof value === 'boolean';

      case 'date':
        return value instanceof Date;

      case 'object':
        return typeof value === 'object' && !Array.isArray(value);

      case 'array':
        return Array.isArray(value);

      default:
        return true;
    }
  }

  /**
   * Get template key
   */
  private getTemplateKey(template: NotificationTemplate): string {
    return this.getTemplateKeyById(template.id, template.locale);
  }

  /**
   * Get template key by ID and locale
   */
  private getTemplateKeyById(templateId: string, locale?: string): string {
    return `${templateId}:${locale || this.config.defaultLocale}`;
  }

  /**
   * Get cache key for rendered template
   */
  private getCacheKey(template: string, variables: Record<string, unknown>): string {
    const varsKey = JSON.stringify(variables);
    return `${template}:${varsKey}`;
  }

  /**
   * Clear rendering cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear compiled templates cache
   */
  clearCompiledCache(): void {
    this.compiledTemplates.clear();
  }

  /**
   * Remove a template
   */
  removeTemplate(templateId: string, locale?: string): boolean {
    const key = this.getTemplateKeyById(templateId, locale);
    const deleted = this.templates.delete(key);

    if (deleted) {
      this.compiledTemplates.delete(key);
      this.clearCache();
    }

    return deleted;
  }

  /**
   * Preview a template with sample data
   */
  async preview(
    templateId: string,
    locale?: string,
    sampleData?: Record<string, unknown>
  ): Promise<{
    subject?: string;
    content: string;
    htmlContent?: string;
    variables: string[];
  }> {
    const context: TemplateContext = {
      locale,
      variables: sampleData || {},
    };

    const result = await this.render(templateId, context);
    const template = this.getTemplate(templateId, locale);

    return {
      ...result,
      variables: template ? Array.from(this.extractVariables(template)) : [],
    };
  }

  /**
   * Get all template versions
   */
  getTemplateVersions(templateId: string): NotificationTemplate[] {
    const templates: NotificationTemplate[] = [];

    for (const template of this.templates.values()) {
      if (template.id === templateId) {
        templates.push(template);
      }
    }

    return templates.sort((a, b) => b.version - a.version);
  }

  /**
   * Get template by version
   */
  getTemplateByVersion(templateId: string, version: number): NotificationTemplate | undefined {
    const templates = this.getTemplateVersions(templateId);
    return templates.find((t) => t.version === version);
  }

  /**
   * Clone a template
   */
  cloneTemplate(
    templateId: string,
    newLocale: string,
    newVersion?: number
  ): NotificationTemplate | undefined {
    const template = this.getTemplate(templateId);

    if (!template) {
      return undefined;
    }

    const cloned: NotificationTemplate = {
      ...template,
      id: `${templateId}_${newLocale}`,
      locale: newLocale,
      version: newVersion || template.version,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.registerTemplate(cloned);
    return cloned;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTemplates: number;
    compiledTemplates: number;
    cachedRenderings: number;
    locales: string[];
  } {
    const locales = new Set<string>();

    for (const template of this.templates.values()) {
      locales.add(template.locale);
    }

    return {
      totalTemplates: this.templates.size,
      compiledTemplates: this.compiledTemplates.size,
      cachedRenderings: this.cache.size,
      locales: Array.from(locales),
    };
  }
}
