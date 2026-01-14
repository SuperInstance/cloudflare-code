/**
 * Unit tests for Agent Template System
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentTemplateManager } from '../../src/agents/template';
import { AgentCategory, TemplateType } from '../../src/types';

describe('AgentTemplateManager', () => {
  let manager: AgentTemplateManager;

  beforeEach(() => {
    manager = new AgentTemplateManager();
  });

  describe('Template Registration', () => {
    it('should have built-in templates registered', () => {
      const templates = manager.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should have code assistant template', () => {
      const template = manager.getTemplate('code-assistant-basic');
      expect(template).toBeDefined();
      expect(template?.category).toBe(AgentCategory.CODE_ASSISTANT);
    });

    it('should have data analyst template', () => {
      const template = manager.getTemplate('data-analyst');
      expect(template).toBeDefined();
      expect(template?.category).toBe(AgentCategory.DATA_ANALYSIS);
    });
  });

  describe('Template Listing', () => {
    it('should list all templates', () => {
      const templates = manager.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('description');
    });

    it('should filter templates by category', () => {
      const codeTemplates = manager.listTemplatesByCategory(AgentCategory.CODE_ASSISTANT);
      expect(codeTemplates.length).toBeGreaterThan(0);
      codeTemplates.forEach(t => {
        expect(t.category).toBe(AgentCategory.CODE_ASSISTANT);
      });
    });

    it('should filter templates by type', () => {
      const basicTemplates = manager.listTemplatesByType(TemplateType.BASIC);
      expect(basicTemplates.length).toBeGreaterThan(0);
      basicTemplates.forEach(t => {
        expect(t.type).toBe(TemplateType.BASIC);
      });
    });
  });

  describe('Template Search', () => {
    it('should search templates by name', () => {
      const results = manager.searchTemplates('code');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(t => {
        expect(
          t.name.toLowerCase().includes('code') ||
          t.description.toLowerCase().includes('code')
        ).toBe(true);
      });
    });

    it('should return empty array for non-existent search', () => {
      const results = manager.searchTemplates('nonexistenttemplate12345');
      expect(results).toEqual([]);
    });
  });

  describe('Custom Templates', () => {
    it('should register custom template', () => {
      const customTemplate = {
        id: 'custom-test',
        name: 'Custom Test',
        description: 'A custom test template',
        type: TemplateType.CUSTOM,
        category: AgentCategory.CUSTOM,
        config: {
          name: 'Custom Agent',
          description: 'Test',
          version: '1.0.0',
          category: AgentCategory.CUSTOM,
          capabilities: [],
          permissions: [],
          tools: [],
          prompts: {},
          settings: {}
        },
        scaffolding: {
          files: {},
          structure: [],
          dependencies: []
        },
        customizations: {
          parameters: {},
          prompts: {}
        },
        examples: []
      };

      manager.registerCustomTemplate(customTemplate);
      const retrieved = manager.getCustomTemplate('custom-test');
      expect(retrieved).toEqual(customTemplate);
    });

    it('should list custom templates', () => {
      const customTemplate = {
        id: 'custom-test-2',
        name: 'Custom Test 2',
        description: 'Another custom test template',
        type: TemplateType.CUSTOM,
        category: AgentCategory.CUSTOM,
        config: {
          name: 'Custom Agent 2',
          description: 'Test',
          version: '1.0.0',
          category: AgentCategory.CUSTOM,
          capabilities: [],
          permissions: [],
          tools: [],
          prompts: {},
          settings: {}
        },
        scaffolding: {
          files: {},
          structure: [],
          dependencies: []
        },
        customizations: {
          parameters: {},
          prompts: {}
        },
        examples: []
      };

      manager.registerCustomTemplate(customTemplate);
      const customs = manager.listCustomTemplates();
      expect(customs.length).toBeGreaterThan(0);
    });

    it('should unregister custom template', () => {
      const customTemplate = {
        id: 'custom-test-3',
        name: 'Custom Test 3',
        description: 'Yet another custom test template',
        type: TemplateType.CUSTOM,
        category: AgentCategory.CUSTOM,
        config: {
          name: 'Custom Agent 3',
          description: 'Test',
          version: '1.0.0',
          category: AgentCategory.CUSTOM,
          capabilities: [],
          permissions: [],
          tools: [],
          prompts: {},
          settings: {}
        },
        scaffolding: {
          files: {},
          structure: [],
          dependencies: []
        },
        customizations: {
          parameters: {},
          prompts: {}
        },
        examples: []
      };

      manager.registerCustomTemplate(customTemplate);
      expect(manager.getCustomTemplate('custom-test-3')).toBeDefined();

      manager.unregisterCustomTemplate('custom-test-3');
      expect(manager.getCustomTemplate('custom-test-3')).toBeUndefined();
    });
  });

  describe('Agent Generation', () => {
    it('should generate agent from template', () => {
      const agent = manager.generateAgentFromTemplate(
        'code-assistant-basic',
        {}
      );

      expect(agent).toBeDefined();
      expect(agent.metadata).toHaveProperty('id');
      expect(agent.config).toHaveProperty('name');
      expect(agent.config.category).toBe(AgentCategory.CODE_ASSISTANT);
      expect(agent.code).toBeDefined();
    });

    it('should apply customizations to generated agent', () => {
      const agent = manager.generateAgentFromTemplate(
        'code-assistant-basic',
        { language: 'python' }
      );

      expect(agent.config.settings).toBeDefined();
    });
  });

  describe('Scaffolding', () => {
    it('should scaffold agent from template', async () => {
      const result = await manager.scaffoldFromTemplate(
        'code-assistant-basic',
        '/tmp/test-agent'
      );

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should handle non-existent template', async () => {
      const result = await manager.scaffoldFromTemplate(
        'nonexistent-template',
        '/tmp/test-agent'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Template nonexistent-template not found');
    });
  });
});
