/**
 * Unit tests for Agent Search Engine
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentSearchEngine } from '../../src/discovery/search';
import { Agent, AgentCategory, AgentCapability, AgentPermission } from '../../src/types';

describe('AgentSearchEngine', () => {
  let engine: AgentSearchEngine;
  let testAgents: Agent[];

  beforeEach(() => {
    engine = new AgentSearchEngine();

    testAgents = [
      {
        metadata: {
          id: 'agent-1',
          author: 'user1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          version: '1.0.0',
          status: 'published',
          tags: ['code', 'typescript', 'assistant'],
          categories: [AgentCategory.CODE_ASSISTANT],
          visibility: 'public'
        },
        config: {
          name: 'Code Assistant',
          description: 'Helps with coding tasks in TypeScript',
          version: '1.0.0',
          category: AgentCategory.CODE_ASSISTANT,
          capabilities: [AgentCapability.CODE_GENERATION, AgentCapability.TEXT_GENERATION],
          permissions: [AgentPermission.READ],
          tools: [],
          prompts: {},
          settings: {}
        },
        code: 'export class CodeAssistant {}',
        stats: {
          installs: 1000,
          uses: 5000,
          rating: 4.5,
          ratingCount: 100,
          views: 10000,
          forks: 50
        }
      },
      {
        metadata: {
          id: 'agent-2',
          author: 'user2',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          version: '1.0.0',
          status: 'published',
          tags: ['data', 'analysis', 'python'],
          categories: [AgentCategory.DATA_ANALYSIS],
          visibility: 'public'
        },
        config: {
          name: 'Data Analyst',
          description: 'Analyzes data and creates visualizations',
          version: '1.0.0',
          category: AgentCategory.DATA_ANALYSIS,
          capabilities: [AgentCapability.DATA_ANALYSIS],
          permissions: [AgentPermission.READ, AgentPermission.EXECUTE],
          tools: [],
          prompts: {},
          settings: {}
        },
        code: 'export class DataAnalyst {}',
        stats: {
          installs: 500,
          uses: 2000,
          rating: 4.0,
          ratingCount: 50,
          views: 5000,
          forks: 25
        }
      },
      {
        metadata: {
          id: 'agent-3',
          author: 'user1',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
          version: '1.0.0',
          status: 'published',
          tags: ['writing', 'content', 'blog'],
          categories: [AgentCategory.WRITING],
          visibility: 'public'
        },
        config: {
          name: 'Writing Assistant',
          description: 'Helps with writing content',
          version: '1.0.0',
          category: AgentCategory.WRITING,
          capabilities: [AgentCapability.TEXT_GENERATION],
          permissions: [AgentPermission.READ, AgentPermission.WRITE],
          tools: [],
          prompts: {},
          settings: {}
        },
        code: 'export class WritingAssistant {}',
        stats: {
          installs: 200,
          uses: 1000,
          rating: 4.8,
          ratingCount: 30,
          views: 3000,
          forks: 10
        }
      }
    ];

    // Index test agents
    for (const agent of testAgents) {
      engine['indexAgent'](agent);
    }
  });

  describe('Indexing', () => {
    it('should index agents', () => {
      const indexed = engine['index'].agents.size;
      expect(indexed).toBe(3);
    });

    it('should index by category', () => {
      const codeAgents = engine['index'].byCategory.get(AgentCategory.CODE_ASSISTANT);
      expect(codeAgents?.size).toBe(1);
      expect(codeAgents?.has('agent-1')).toBe(true);
    });

    it('should index by capability', () => {
      const codeGenAgents = engine['index'].byCapability.get(AgentCapability.CODE_GENERATION);
      expect(codeGenAgents?.size).toBe(1);
    });

    it('should index by tag', () => {
      const codeTagAgents = engine['index'].byTag.get('code');
      expect(codeTagAgents?.size).toBe(1);
    });

    it('should index by author', () => {
      const user1Agents = engine['index'].byAuthor.get('user1');
      expect(user1Agents?.size).toBe(2);
    });
  });

  describe('Search', () => {
    it('should search by query', async () => {
      const result = await engine.search({
        query: 'code'
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].config.name).toContain('Code');
    });

    it('should filter by category', async () => {
      const result = await engine.search({
        filters: { category: AgentCategory.CODE_ASSISTANT }
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].config.category).toBe(AgentCategory.CODE_ASSISTANT);
    });

    it('should filter by capability', async () => {
      const result = await engine.search({
        filters: { capabilities: [AgentCapability.CODE_GENERATION] }
      });

      expect(result.items.length).toBe(1);
    });

    it('should sort by rating', async () => {
      const result = await engine.search({
        sort: { field: 'rating', order: 'desc' }
      });

      expect(result.items[0].stats?.rating).toBe(4.8);
    });

    it('should sort by installs', async () => {
      const result = await engine.search({
        sort: { field: 'installs', order: 'desc' }
      });

      expect(result.items[0].stats?.installs).toBe(1000);
    });

    it('should paginate results', async () => {
      const result = await engine.search({
        pagination: { page: 1, limit: 2 }
      });

      expect(result.items.length).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });

    it('should indicate if more results available', async () => {
      const result = await engine.search({
        pagination: { page: 1, limit: 2 }
      });

      expect(result.hasMore).toBe(true);
    });
  });

  describe('Recommendations', () => {
    it('should recommend similar agents', async () => {
      const recommendations = await engine.recommend('agent-1');

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty('agent');
      expect(recommendations[0]).toHaveProperty('score');
      expect(recommendations[0]).toHaveProperty('reasons');
    });

    it('should recommend based on category', async () => {
      const recommendations = await engine.recommend('agent-1');

      const hasCategoryReason = recommendations.some(r =>
        r.reasons.some(reason => reason.includes('category'))
      );
      expect(hasCategoryReason).toBe(true);
    });
  });

  describe('Trending and Popular', () => {
    it('should get trending agents', async () => {
      const trending = await engine.getTrending(10);
      expect(trending.length).toBeGreaterThan(0);
    });

    it('should get popular agents', async () => {
      const popular = await engine.getPopular(10);
      expect(popular.length).toBeGreaterThan(0);
      expect(popular[0].stats?.installs).toBeGreaterThanOrEqual(
        popular[1].stats?.installs || 0
      );
    });

    it('should get top rated agents', async () => {
      const topRated = await engine.getTopRated(10, 4.0);
      expect(topRated.length).toBeGreaterThan(0);
      topRated.forEach(agent => {
        expect(agent.stats?.rating).toBeGreaterThanOrEqual(4.0);
      });
    });

    it('should get newest agents', async () => {
      const newest = await engine.getNewest(10);
      expect(newest.length).toBeGreaterThan(0);
      expect(newest[0].metadata.createdAt.getTime()).toBeGreaterThanOrEqual(
        newest[1].metadata.createdAt.getTime()
      );
    });

    it('should get recently updated agents', async () => {
      const recent = await engine.getRecentlyUpdated(10);
      expect(recent.length).toBeGreaterThan(0);
    });
  });

  describe('Browsing', () => {
    it('should browse by category', async () => {
      const agents = await engine.browseByCategory(AgentCategory.CODE_ASSISTANT);
      expect(agents.length).toBe(1);
      expect(agents[0].config.category).toBe(AgentCategory.CODE_ASSISTANT);
    });

    it('should browse by capability', async () => {
      const agents = await engine.browseByCapability(AgentCapability.CODE_GENERATION);
      expect(agents.length).toBe(1);
    });

    it('should browse by tag', async () => {
      const agents = await engine.browseByTag('code');
      expect(agents.length).toBe(1);
    });

    it('should browse by author', async () => {
      const agents = await engine.browseByAuthor('user1');
      expect(agents.length).toBe(2);
    });
  });

  describe('Fuzzy Search', () => {
    it('should perform fuzzy search', async () => {
      const results = await engine.fuzzySearch('cod');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle misspellings', async () => {
      const results = await engine.fuzzySearch('codasist');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Autocomplete', () => {
    it('should provide autocomplete suggestions', async () => {
      const suggestions = await engine.autocomplete('cod');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should limit suggestions', async () => {
      const suggestions = await engine.autocomplete('a', 2);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Analytics', () => {
    it('should track search history', async () => {
      await engine.search({ query: 'test search' });
      const popular = engine.getPopularSearches();
      expect(popular.length).toBeGreaterThan(0);
    });

    it('should get category stats', () => {
      const stats = engine.getCategoryStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.get(AgentCategory.CODE_ASSISTANT)).toBe(1);
    });

    it('should get capability stats', () => {
      const stats = engine.getCapabilityStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Index Management', () => {
    it('should remove agent from index', () => {
      engine.removeAgent('agent-1');
      const agent = engine['index'].agents.get('agent-1');
      expect(agent).toBeUndefined();
    });

    it('should rebuild index', () => {
      engine.rebuildIndex(testAgents);
      expect(engine['index'].agents.size).toBe(3);
    });
  });
});
