/**
 * Template Engine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  TemplateEngine,
  getTemplateById,
  getTemplatesByCategory,
  getTemplatesForLanguage,
  searchTemplatesByTag,
  TEMPLATES_BY_LANGUAGE,
} from './templates';
import type { TemplateContext, SupportedLanguage } from './types';

describe('TemplateEngine', () => {
  describe('getTemplateById', () => {
    it('should return template by ID', () => {
      const template = getTemplateById('ts-api-endpoint');
      expect(template).toBeDefined();
      expect(template?.id).toBe('ts-api-endpoint');
      expect(template?.category).toBe('api');
      expect(template?.language).toBe('typescript');
    });

    it('should return undefined for non-existent template', () => {
      const template = getTemplateById('non-existent');
      expect(template).toBeUndefined();
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return all templates for a category', () => {
      const apiTemplates = getTemplatesByCategory('api');
      expect(apiTemplates.length).toBeGreaterThan(0);
      expect(apiTemplates.every(t => t.category === 'api')).toBe(true);
    });

    it('should return templates for function category', () => {
      const funcTemplates = getTemplatesByCategory('function');
      expect(funcTemplates.length).toBeGreaterThan(0);
      expect(funcTemplates.every(t => t.category === 'function')).toBe(true);
    });
  });

  describe('getTemplatesForLanguage', () => {
    it('should return templates for TypeScript', () => {
      const tsTemplates = getTemplatesForLanguage('typescript');
      expect(tsTemplates.length).toBeGreaterThan(0);
      expect(tsTemplates.every(t => t.language === 'typescript')).toBe(true);
    });

    it('should return templates for Python', () => {
      const pyTemplates = getTemplatesForLanguage('python');
      expect(pyTemplates.length).toBeGreaterThan(0);
      expect(pyTemplates.every(t => t.language === 'python')).toBe(true);
    });
  });

  describe('searchTemplatesByTag', () => {
    it('should find templates by tag', () => {
      const templates = searchTemplatesByTag('api');
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should find templates by validation tag', () => {
      const templates = searchTemplatesByTag('validation');
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('TemplateEngine.render', () => {
    it('should render simple template', () => {
      const template = {
        id: 'test-simple',
        name: 'Simple Template',
        description: 'Test',
        category: 'function' as const,
        language: 'typescript' as SupportedLanguage,
        template: 'function {name}() { return {body}; }',
        variables: [
          { name: 'name', type: 'string', description: 'Name', required: true },
          { name: 'body', type: 'code', description: 'Body', required: true },
        ],
      };

      const context: TemplateContext = {
        name: 'test',
        language: 'typescript',
        generationType: 'function',
        body: '42',
      };

      const result = TemplateEngine.render(template, context);
      expect(result).toContain('function test()');
      expect(result).toContain('return 42;');
    });

    it('should render template with parameters', () => {
      const template = {
        id: 'test-params',
        name: 'Params Template',
        description: 'Test',
        category: 'function' as const,
        language: 'typescript' as SupportedLanguage,
        template: 'function {name}({params:signature}): {returnType} {{body}}',
        variables: [],
      };

      const context: TemplateContext = {
        name: 'add',
        language: 'typescript',
        generationType: 'function',
        params: [
          { name: 'a', type: 'number' },
          { name: 'b', type: 'number' },
        ],
        returnType: 'number',
        body: 'return a + b;',
      };

      const result = TemplateEngine.render(template, context);
      expect(result).toContain('a: number');
      expect(result).toContain('b: number');
      expect(result).toContain('function add(');
    });
  });

  describe('TemplateEngine.validateContext', () => {
    it('should validate required variables', () => {
      const template = {
        id: 'test-validation',
        name: 'Validation Template',
        description: 'Test',
        category: 'function' as const,
        language: 'typescript' as SupportedLanguage,
        template: '{name}',
        variables: [
          { name: 'name', type: 'string', description: 'Name', required: true },
        ],
      };

      const validContext: TemplateContext = {
        name: 'test',
        language: 'typescript',
        generationType: 'function',
      };

      const invalidContext: TemplateContext = {
        name: '',
        language: 'typescript',
        generationType: 'function',
      };

      const validResult = TemplateEngine.validateContext(template, validContext);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidResult = TemplateEngine.validateContext(template, invalidContext);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Template Count', () => {
  it('should have 50+ templates total', () => {
    let total = 0;
    for (const templates of Object.values(TEMPLATES_BY_LANGUAGE)) {
      total += templates.length;
    }
    expect(total).toBeGreaterThanOrEqual(50);
  });

  it('should support multiple languages', () => {
    const languages = Object.keys(TEMPLATES_BY_LANGUAGE).filter(
      lang => TEMPLATES_BY_LANGUAGE[lang as SupportedLanguage].length > 0
    );
    expect(languages.length).toBeGreaterThanOrEqual(5);
  });
});
