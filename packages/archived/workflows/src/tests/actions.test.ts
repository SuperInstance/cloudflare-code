/**
 * Action Registry Tests
 */

import { describe, it, expect } from '@jest/globals';
import { ActionRegistry } from '../actions/registry';

describe('Action Registry', () => {
  let registry: ActionRegistry;

  beforeEach(() => {
    registry = new ActionRegistry();
  });

  describe('Registration', () => {
    it('should register default actions', () => {
      const all = registry.getAll();
      expect(all.length).toBeGreaterThan(50);
    });

    it('should have code actions', () => {
      const codeActions = registry.getByCategory('code');
      expect(codeActions.length).toBeGreaterThan(0);

      const generateCode = registry.get('generate_code');
      expect(generateCode).toBeDefined();
      expect(generateCode?.category).toBe('code');
    });

    it('should have communication actions', () => {
      const commActions = registry.getByCategory('communication');
      expect(commActions.length).toBeGreaterThan(0);

      const sendSlack = registry.get('send_slack');
      expect(sendSlack).toBeDefined();
      expect(sendSlack?.category).toBe('communication');
    });

    it('should have GitHub actions', () => {
      const githubActions = registry.getByCategory('github');
      expect(githubActions.length).toBeGreaterThan(0);

      const createIssue = registry.get('create_issue');
      expect(createIssue).toBeDefined();
      expect(createIssue?.category).toBe('github');
    });

    it('should have AI actions', () => {
      const aiActions = registry.getByCategory('ai');
      expect(aiActions.length).toBeGreaterThan(0);

      const chatCompletion = registry.get('chat_completion');
      expect(chatCompletion).toBeDefined();
      expect(chatCompletion?.category).toBe('ai');
    });

    it('should have storage actions', () => {
      const storageActions = registry.getByCategory('storage');
      expect(storageActions.length).toBeGreaterThan(0);

      const kvGet = registry.get('kv_get');
      expect(kvGet).toBeDefined();
      expect(kvGet?.category).toBe('storage');
    });

    it('should have HTTP actions', () => {
      const httpActions = registry.getByCategory('http');
      expect(httpActions.length).toBeGreaterThan(0);

      const httpGet = registry.get('http_get');
      expect(httpGet).toBeDefined();
      expect(httpGet?.category).toBe('http');
    });
  });

  describe('Action Structure', () => {
    it('should have required action properties', () => {
      const action = registry.get('send_slack');
      expect(action?.id).toBeDefined();
      expect(action?.type).toBeDefined();
      expect(action?.name).toBeDefined();
      expect(action?.description).toBeDefined();
      expect(action?.category).toBeDefined();
      expect(action?.inputs).toBeDefined();
      expect(action?.outputs).toBeDefined();
      expect(action?.implementation).toBeDefined();
    });

    it('should have input definitions', () => {
      const action = registry.get('send_email');
      expect(action?.inputs.length).toBeGreaterThan(0);

      const toInput = action?.inputs.find(i => i.name === 'to');
      expect(toInput).toBeDefined();
      expect(toInput?.type).toBe('string');
      expect(toInput?.required).toBe(true);
    });

    it('should have output definitions', () => {
      const action = registry.get('create_issue');
      expect(action?.outputs.length).toBeGreaterThan(0);

      const issueNumber = action?.outputs.find(o => o.name === 'issueNumber');
      expect(issueNumber).toBeDefined();
      expect(issueNumber?.type).toBe('number');
    });
  });

  describe('Categories', () => {
    it('should return all categories', () => {
      const categories = registry.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('code');
      expect(categories).toContain('communication');
      expect(categories).toContain('github');
      expect(categories).toContain('ai');
      expect(categories).toContain('data');
      expect(categories).toContain('storage');
      expect(categories).toContain('http');
      expect(categories).toContain('logic');
      expect(categories).toContain('utility');
    });
  });

  describe('Search', () => {
    it('should search actions by name', () => {
      const results = registry.search('slack');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name.toLowerCase()).toContain('slack');
    });

    it('should search actions by description', () => {
      const results = registry.search('email');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', () => {
      const results = registry.search('nonexistent action xyz123');
      expect(results).toEqual([]);
    });
  });

  describe('Custom Actions', () => {
    it('should register custom action', () => {
      const customAction = {
        id: 'custom-action',
        type: 'custom' as const,
        name: 'Custom Action',
        description: 'A custom action',
        category: 'custom' as const,
        inputs: [],
        outputs: [],
        implementation: {
          type: 'inline' as const,
          handler: 'customHandler'
        }
      };

      registry.register(customAction);
      const retrieved = registry.get('custom');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Custom Action');
    });

    it('should check if action exists', () => {
      expect(registry.has('send_slack')).toBe(true);
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return action statistics', () => {
      const stats = registry.getStats();

      expect(stats.totalActions).toBeGreaterThan(50);
      expect(stats.categories.length).toBeGreaterThan(0);
      expect(stats.actionsByCategory).toBeDefined();
    });

    it('should count actions by category', () => {
      const stats = registry.getStats();

      expect(stats.actionsByCategory.code).toBeGreaterThan(0);
      expect(stats.actionsByCategory.communication).toBeGreaterThan(0);
      expect(stats.actionsByCategory.github).toBeGreaterThan(0);
    });
  });
});
