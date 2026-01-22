/**
 * Tests for template engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateEngine } from '../templates/engine';
import type { NotificationTemplate } from '../types';

describe('Template Engine', () => {
  let engine: TemplateEngine;
  let template: NotificationTemplate;

  beforeEach(() => {
    engine = new TemplateEngine({
      enableCaching: true,
      cacheSize: 100,
      defaultLocale: 'en',
      fallbackLocale: 'en',
    });

    template = {
      id: 'test-template',
      name: 'Test Template',
      category: 'system',
      channel: 'email',
      subject: 'Hello {{name}}',
      content: 'Dear {{name}},\n\nYour order {{orderId}} has been {{status}}.\n\nTotal: ${{amount}}',
      htmlContent: '<p>Dear {{name}},</p><p>Your order {{orderId}} has been {{status}}.</p>',
      variables: [
        { name: 'name', type: 'string', required: true },
        { name: 'orderId', type: 'string', required: true },
        { name: 'status', type: 'string', required: true },
        { name: 'amount', type: 'number', required: false },
      ],
      locale: 'en',
      version: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    engine.registerTemplate(template);
  });

  describe('registerTemplate', () => {
    it('should register a template', () => {
      const registered = engine.getTemplate('test-template', 'en');
      expect(registered).toBe(template);
    });
  });

  describe('render', () => {
    it('should render template with variables', async () => {
      const result = await engine.render('test-template', {
        locale: 'en',
        variables: {
          name: 'John Doe',
          orderId: 'ORD-123',
          status: 'shipped',
          amount: 99.99,
        },
      });

      expect(result.subject).toBe('Hello John Doe');
      expect(result.content).toContain('John Doe');
      expect(result.content).toContain('ORD-123');
      expect(result.content).toContain('shipped');
      expect(result.content).toContain('$99.99');
      expect(result.htmlContent).toContain('<p>Dear John Doe,</p>');
    });

    it('should throw error for missing required variables', async () => {
      await expect(
        engine.render('test-template', {
          locale: 'en',
          variables: {
            name: 'John Doe',
          },
        })
      ).rejects.toThrow('Required variable missing');
    });

    it('should use default values for optional variables', async () => {
      const templateWithDefaults: NotificationTemplate = {
        ...template,
        id: 'template-with-defaults',
        variables: [
          { name: 'name', type: 'string', required: true },
          { name: 'amount', type: 'number', required: false, defaultValue: 0 },
        ],
      };

      engine.registerTemplate(templateWithDefaults);

      const result = await engine.render('template-with-defaults', {
        locale: 'en',
        variables: {
          name: 'John Doe',
        },
      });

      expect(result.content).toBeDefined();
    });

    it('should render conditionals', async () => {
      const conditionalTemplate: NotificationTemplate = {
        id: 'conditional-template',
        name: 'Conditional Template',
        category: 'system',
        channel: 'email',
        content: 'Hello {{name}}\n{{#if urgent}}This is urgent!{{/if}}\n{{#if urgent}}Act now!{{/if}}',
        variables: [
          { name: 'name', type: 'string', required: true },
          { name: 'urgent', type: 'boolean', required: false },
        ],
        locale: 'en',
        version: 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      engine.registerTemplate(conditionalTemplate);

      const result1 = await engine.render('conditional-template', {
        locale: 'en',
        variables: {
          name: 'John',
          urgent: true,
        },
      });

      expect(result1.content).toContain('This is urgent!');
      expect(result1.content).toContain('Act now!');

      const result2 = await engine.render('conditional-template', {
        locale: 'en',
        variables: {
          name: 'John',
          urgent: false,
        },
      });

      expect(result2.content).not.toContain('This is urgent!');
    });

    it('should render loops', async () => {
      const loopTemplate: NotificationTemplate = {
        id: 'loop-template',
        name: 'Loop Template',
        category: 'system',
        channel: 'email',
        content: 'Items:\n{{#each items}}- {{this}}\n{{/each}}',
        variables: [
          { name: 'items', type: 'array', required: true },
        ],
        locale: 'en',
        version: 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      engine.registerTemplate(loopTemplate);

      const result = await engine.render('loop-template', {
        locale: 'en',
        variables: {
          items: ['Apple', 'Banana', 'Cherry'],
        },
      });

      expect(result.content).toContain('- Apple');
      expect(result.content).toContain('- Banana');
      expect(result.content).toContain('- Cherry');
    });
  });

  describe('preview', () => {
    it('should preview template with sample data', async () => {
      const preview = await engine.preview('test-template', 'en', {
        name: 'Jane Doe',
        orderId: 'ORD-456',
        status: 'delivered',
        amount: 149.99,
      });

      expect(preview.subject).toBe('Hello Jane Doe');
      expect(preview.content).toContain('Jane Doe');
      expect(preview.variables).toContain('name');
      expect(preview.variables).toContain('orderId');
    });
  });

  describe('cloneTemplate', () => {
    it('should clone template for new locale', () => {
      const cloned = engine.cloneTemplate('test-template', 'fr');

      expect(cloned).toBeDefined();
      expect(cloned?.locale).toBe('fr');
      expect(cloned?.id).toBe('test-template_fr');
    });
  });

  describe('removeTemplate', () => {
    it('should remove a template', () => {
      const removed = engine.removeTemplate('test-template', 'en');
      expect(removed).toBe(true);

      const registered = engine.getTemplate('test-template', 'en');
      expect(registered).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return engine statistics', () => {
      const stats = engine.getStats();

      expect(stats.totalTemplates).toBe(1);
      expect(stats.compiledTemplates).toBe(0);
      expect(stats.locales).toContain('en');
    });
  });
});
