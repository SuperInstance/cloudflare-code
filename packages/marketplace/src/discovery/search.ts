/**
 * Agent Discovery and Search System
 * Provides search, filtering, and recommendation capabilities for agents
 */

import {
  Agent,
  SearchFilters,
  SearchOptions,
  SearchResult,
  AgentRecommendation,
  AgentCategory,
  AgentCapability,
  AgentPermission,
  AgentStats
} from '../types';

// ============================================================================
// Search Configuration
// ============================================================================

export interface SearchIndex {
  agents: Map<string, Agent>;
  byCategory: Map<AgentCategory, Set<string>>;
  byCapability: Map<AgentCapability, Set<string>>;
  byPermission: Map<AgentPermission, Set<string>>;
  byTag: Map<string, Set<string>>;
  byAuthor: Map<string, Set<string>>;
  textIndex: Map<string, Set<string>>; // Token -> Agent IDs
}

export interface RankingOptions {
  weights?: {
    category?: number;
    capability?: number;
    rating?: number;
    installs?: number;
    recency?: number;
    textRelevance?: number;
  };
  boostRecent?: boolean;
  boostPopular?: boolean;
  boostRated?: boolean;
}

// ============================================================================
// Agent Search Engine
// ============================================================================

export class AgentSearchEngine {
  private index: SearchIndex;
  private searchHistory: Map<string, number> = new Map();

  constructor() {
    this.index = this.createIndex();
  }

  // ========================================================================
  // Index Management
  // ========================================================================

  private createIndex(): SearchIndex {
    return {
      agents: new Map(),
      byCategory: new Map(),
      byCapability: new Map(),
      byPermission: new Map(),
      byTag: new Map(),
      byAuthor: new Map(),
      textIndex: new Map()
    };
  }

  indexAgent(agent: Agent): void {
    const id = agent.metadata.id;

    // Add to main index
    this.index.agents.set(id, agent);

    // Index by category
    if (!this.index.byCategory.has(agent.config.category)) {
      this.index.byCategory.set(agent.config.category, new Set());
    }
    this.index.byCategory.get(agent.config.category)!.add(id);

    // Index by capabilities
    for (const capability of agent.config.capabilities) {
      if (!this.index.byCapability.has(capability)) {
        this.index.byCapability.set(capability, new Set());
      }
      this.index.byCapability.get(capability)!.add(id);
    }

    // Index by permissions
    for (const permission of agent.config.permissions) {
      if (!this.index.byPermission.has(permission)) {
        this.index.byPermission.set(permission, new Set());
      }
      this.index.byPermission.get(permission)!.add(id);
    }

    // Index by tags
    for (const tag of agent.metadata.tags) {
      if (!this.index.byTag.has(tag)) {
        this.index.byTag.set(tag, new Set());
      }
      this.index.byTag.get(tag)!.add(id);
    }

    // Index by author
    if (!this.index.byAuthor.has(agent.metadata.author)) {
      this.index.byAuthor.set(agent.metadata.author, new Set());
    }
    this.index.byAuthor.get(agent.metadata.author)!.add(id);

    // Text indexing
    this.indexText(id, agent);
  }

  private indexText(id: string, agent: Agent): void {
    const text = [
      agent.config.name,
      agent.config.description,
      agent.metadata.tags.join(' '),
      agent.metadata.author
    ].join(' ').toLowerCase();

    const tokens = this.tokenize(text);

    for (const token of tokens) {
      if (!this.index.textIndex.has(token)) {
        this.index.textIndex.set(token, new Set());
      }
      this.index.textIndex.get(token)!.add(id);
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  removeAgent(id: string): void {
    const agent = this.index.agents.get(id);
    if (!agent) return;

    // Remove from all indexes
    this.index.agents.delete(id);
    this.index.byCategory.get(agent.config.category)?.delete(id);

    for (const capability of agent.config.capabilities) {
      this.index.byCapability.get(capability)?.delete(id);
    }

    for (const permission of agent.config.permissions) {
      this.index.byPermission.get(permission)?.delete(id);
    }

    for (const tag of agent.metadata.tags) {
      this.index.byTag.get(tag)?.delete(id);
    }

    this.index.byAuthor.get(agent.metadata.author)?.delete(id);
  }

  rebuildIndex(agents: Agent[]): void {
    this.index = this.createIndex();
    for (const agent of agents) {
      this.indexAgent(agent);
    }
  }

  // ========================================================================
  // Search
  // ========================================================================

  async search(options: SearchOptions): Promise<SearchResult<Agent>> {
    let results = new Set<string>();

    // Text search
    if (options.query) {
      const queryResults = this.textSearch(options.query);
      results = new Set([...results, ...queryResults]);
    } else {
      // If no query, start with all agents
      results = new Set(this.index.agents.keys());
    }

    // Apply filters
    if (options.filters) {
      const filtered = this.applyFilters(Array.from(results), options.filters);
      results = new Set(filtered);
    }

    // Sort results
    let sortedAgents = Array.from(results)
      .map(id => this.index.agents.get(id)!)
      .filter(agent => agent !== undefined);

    if (options.sort) {
      sortedAgents = this.sortAgents(sortedAgents, options.sort);
    }

    // Pagination
    const page = options.pagination?.page || 1;
    const limit = options.pagination?.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedAgents = sortedAgents.slice(start, end);

    // Track search history for analytics
    if (options.query) {
      this.trackSearch(options.query);
    }

    return {
      items: paginatedAgents,
      total: sortedAgents.length,
      page,
      limit,
      hasMore: end < sortedAgents.length
    };
  }

  private textSearch(query: string): string[] {
    const tokens = this.tokenize(query);
    const scores = new Map<string, number>();

    for (const token of tokens) {
      const matchingIds = this.index.textIndex.get(token);
      if (matchingIds) {
        for (const id of matchingIds) {
          scores.set(id, (scores.get(id) || 0) + 1);
        }
      }
    }

    // Sort by relevance (number of matching tokens)
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  }

  private applyFilters(ids: string[], filters: SearchFilters): string[] {
    let filtered = ids;

    // Filter by category
    if (filters.category) {
      const categoryIds = this.index.byCategory.get(filters.category);
      if (categoryIds) {
        filtered = filtered.filter(id => categoryIds.has(id));
      }
    }

    // Filter by capabilities
    if (filters.capabilities && filters.capabilities.length > 0) {
      for (const capability of filters.capabilities) {
        const capabilityIds = this.index.byCapability.get(capability);
        if (capabilityIds) {
          filtered = filtered.filter(id => capabilityIds.has(id));
        }
      }
    }

    // Filter by permissions
    if (filters.permissions && filters.permissions.length > 0) {
      for (const permission of filters.permissions) {
        const permissionIds = this.index.byPermission.get(permission);
        if (permissionIds) {
          filtered = filtered.filter(id => permissionIds.has(id));
        }
      }
    }

    // Filter by rating
    if (filters.rating) {
      filtered = filtered.filter(id => {
        const agent = this.index.agents.get(id);
        if (!agent?.stats) return false;
        const rating = agent.stats.rating || 0;
        return rating >= filters.rating!.min && rating <= filters.rating!.max;
      });
    }

    // Filter by installs
    if (filters.installs) {
      filtered = filtered.filter(id => {
        const agent = this.index.agents.get(id);
        if (!agent?.stats) return false;
        return (agent.stats.installs || 0) >= filters.installs!.min;
      });
    }

    // Filter by update date
    if (filters.updatedAfter) {
      filtered = filtered.filter(id => {
        const agent = this.index.agents.get(id);
        if (!agent?.metadata.updatedAt) return false;
        return agent.metadata.updatedAt >= filters.updatedAfter!;
      });
    }

    // Filter by author
    if (filters.author) {
      const authorIds = this.index.byAuthor.get(filters.author);
      if (authorIds) {
        filtered = filtered.filter(id => authorIds.has(id));
      }
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        const tagIds = this.index.byTag.get(tag);
        if (tagIds) {
          filtered = filtered.filter(id => tagIds.has(id));
        }
      }
    }

    // Filter by visibility
    if (filters.visibility) {
      filtered = filtered.filter(id => {
        const agent = this.index.agents.get(id);
        return agent?.metadata.visibility === filters.visibility;
      });
    }

    return filtered;
  }

  private sortAgents(
    agents: Agent[],
    sort: NonNullable<SearchOptions['sort']>
  ): Agent[] {
    const sorted = [...agents];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'name':
          comparison = a.config.name.localeCompare(b.config.name);
          break;
        case 'rating':
          const ratingA = a.stats?.rating || 0;
          const ratingB = b.stats?.rating || 0;
          comparison = ratingA - ratingB;
          break;
        case 'installs':
          const installsA = a.stats?.installs || 0;
          const installsB = b.stats?.installs || 0;
          comparison = installsA - installsB;
          break;
        case 'updated':
          const updatedA = a.metadata.updatedAt.getTime();
          const updatedB = b.metadata.updatedAt.getTime();
          comparison = updatedA - updatedB;
          break;
        case 'created':
          const createdA = a.metadata.createdAt.getTime();
          const createdB = b.metadata.createdAt.getTime();
          comparison = createdA - createdB;
          break;
        case 'relevance':
        default:
          // For relevance, we'd need more sophisticated scoring
          comparison = 0;
      }

      return sort.order === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  // ========================================================================
  // Advanced Search Features
// ========================================================================

  async fuzzySearch(query: string, threshold: number = 0.6): Promise<Agent[]> {
    const tokens = this.tokenize(query);
    const results = new Map<string, number>();

    for (const [id, agent] of this.index.agents) {
      const agentText = [
        agent.config.name,
        agent.config.description,
        ...agent.metadata.tags
      ].join(' ').toLowerCase();

      let score = 0;
      for (const token of tokens) {
        if (agentText.includes(token)) {
          score += 1;
        } else {
          // Calculate fuzzy match
          const fuzzyScore = this.calculateFuzzyScore(token, agentText);
          if (fuzzyScore >= threshold) {
            score += fuzzyScore;
          }
        }
      }

      if (score > 0) {
        results.set(id, score);
      }
    }

    return Array.from(results.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id]) => this.index.agents.get(id)!);
  }

  private calculateFuzzyScore(token: string, text: string): number {
    // Simple fuzzy matching - Levenshtein distance
    const words = text.split(/\s+/);
    let maxScore = 0;

    for (const word of words) {
      const distance = this.levenshteinDistance(token, word);
      const maxLen = Math.max(token.length, word.length);
      const similarity = 1 - distance / maxLen;
      maxScore = Math.max(maxScore, similarity);
    }

    return maxScore;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    return matrix[b.length][a.length];
  }

  // ========================================================================
  // Recommendations
  // ========================================================================

  async recommend(
    agentId: string,
    options: RankingOptions = {}
  ): Promise<AgentRecommendation[]> {
    const agent = this.index.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const scores = new Map<string, number>();

    for (const [id, candidate] of this.index.agents) {
      if (id === agentId) continue;

      let score = 0;
      const weights = options.weights || {};

      // Category similarity
      if (candidate.config.category === agent.config.category) {
        score += weights.category || 10;
      }

      // Capability overlap
      const commonCapabilities = candidate.config.capabilities.filter(c =>
        agent.config.capabilities.includes(c)
      );
      score += (commonCapabilities.length * (weights.capability || 5));

      // Rating boost
      if (options.boostRated && candidate.stats?.rating) {
        score += candidate.stats.rating * (weights.rating || 2);
      }

      // Popularity boost
      if (options.boostPopular && candidate.stats?.installs) {
        score += Math.log10(candidate.stats.installs + 1) * (weights.installs || 1);
      }

      // Recency boost
      if (options.boostRecent) {
        const daysSinceUpdate = (Date.now() - candidate.metadata.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 30 - daysSinceUpdate) * (weights.recency || 0.1);
      }

      if (score > 0) {
        scores.set(id, score);
      }
    }

    const recommendations = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, score]) => ({
        agent: this.index.agents.get(id)!,
        score,
        reasons: this.generateReasons(agent, this.index.agents.get(id)!, score),
        similarAgents: []
      }));

    return recommendations;
  }

  private generateReasons(source: Agent, target: Agent, score: number): string[] {
    const reasons: string[] = [];

    if (source.config.category === target.config.category) {
      reasons.push(`Same category: ${source.config.category}`);
    }

    const commonCapabilities = target.config.capabilities.filter(c =>
      source.config.capabilities.includes(c)
    );
    if (commonCapabilities.length > 0) {
      reasons.push(`Shared capabilities: ${commonCapabilities.join(', ')}`);
    }

    if (target.stats?.rating && target.stats.rating >= 4) {
      reasons.push(`Highly rated (${target.stats.rating}/5)`);
    }

    if (target.stats?.installs && target.stats.installs >= 1000) {
      reasons.push(`Popular (${target.stats.installs}+ installs)`);
    }

    return reasons;
  }

  async getTrending(limit: number = 10): Promise<Agent[]> {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const trending = Array.from(this.index.agents.values())
      .filter(agent => {
        if (!agent.stats) return false;
        return agent.metadata.updatedAt >= new Date(weekAgo);
      })
      .sort((a, b) => {
        const scoreA = this.calculateTrendingScore(a);
        const scoreB = this.calculateTrendingScore(b);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return trending;
  }

  private calculateTrendingScore(agent: Agent): number {
    if (!agent.stats) return 0;

    const recencyWeight = 0.5;
    const popularityWeight = 0.3;
    const ratingWeight = 0.2;

    const daysSinceUpdate = (Date.now() - agent.metadata.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 30 - daysSinceUpdate) / 30;

    const popularityScore = Math.min(1, (agent.stats.installs || 0) / 10000);
    const ratingScore = (agent.stats.rating || 0) / 5;

    return (
      recencyScore * recencyWeight +
      popularityScore * popularityWeight +
      ratingScore * ratingWeight
    );
  }

  async getPopular(limit: number = 10): Promise<Agent[]> {
    return Array.from(this.index.agents.values())
      .filter(agent => agent.stats?.installs && agent.stats.installs > 0)
      .sort((a, b) => (b.stats?.installs || 0) - (a.stats?.installs || 0))
      .slice(0, limit);
  }

  async getTopRated(limit: number = 10, minRating: number = 4): Promise<Agent[]> {
    return Array.from(this.index.agents.values())
      .filter(agent => agent.stats?.rating && agent.stats.rating >= minRating)
      .sort((a, b) => (b.stats?.rating || 0) - (a.stats?.rating || 0))
      .slice(0, limit);
  }

  async getNewest(limit: number = 10): Promise<Agent[]> {
    return Array.from(this.index.agents.values())
      .sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
      .slice(0, limit);
  }

  async getRecentlyUpdated(limit: number = 10): Promise<Agent[]> {
    return Array.from(this.index.agents.values())
      .sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime())
      .slice(0, limit);
  }

  // ========================================================================
  // Category Browse
  // ========================================================================

  async browseByCategory(category: AgentCategory): Promise<Agent[]> {
    const agentIds = this.index.byCategory.get(category);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map(id => this.index.agents.get(id)!)
      .filter(agent => agent !== undefined);
  }

  async browseByCapability(capability: AgentCapability): Promise<Agent[]> {
    const agentIds = this.index.byCapability.get(capability);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map(id => this.index.agents.get(id)!)
      .filter(agent => agent !== undefined);
  }

  async browseByTag(tag: string): Promise<Agent[]> {
    const agentIds = this.index.byTag.get(tag);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map(id => this.index.agents.get(id)!)
      .filter(agent => agent !== undefined);
  }

  async browseByAuthor(author: string): Promise<Agent[]> {
    const agentIds = this.index.byAuthor.get(author);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map(id => this.index.agents.get(id)!)
      .filter(agent => agent !== undefined);
  }

  // ========================================================================
  // Analytics
  // ========================================================================

  private trackSearch(query: string): void {
    const normalized = query.toLowerCase().trim();
    this.searchHistory.set(normalized, (this.searchHistory.get(normalized) || 0) + 1);
  }

  getPopularSearches(limit: number = 10): Array<{ query: string; count: number }> {
    return Array.from(this.searchHistory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  getCategoryStats(): Map<AgentCategory, number> {
    const stats = new Map<AgentCategory, number>();
    for (const [category, ids] of this.index.byCategory) {
      stats.set(category, ids.size);
    }
    return stats;
  }

  getCapabilityStats(): Map<AgentCapability, number> {
    const stats = new Map<AgentCapability, number>();
    for (const [capability, ids] of this.index.byCapability) {
      stats.set(capability, ids.size);
    }
    return stats;
  }

  // ========================================================================
  // Autocomplete
  // ========================================================================

  async autocomplete(query: string, limit: number = 5): Promise<string[]> {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return [];

    const suggestions = new Set<string>();

    // Add matching agent names
    for (const agent of this.index.agents.values()) {
      if (agent.config.name.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(agent.config.name);
      }
    }

    // Add matching tags
    for (const tag of this.index.byTag.keys()) {
      if (tag.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(tag);
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }
}

// ============================================================================
// Agent Discovery Service
// ============================================================================

export class AgentDiscoveryService {
  constructor(private searchEngine: AgentSearchEngine) {}

  async discover(options: {
    query?: string;
    category?: AgentCategory;
    capability?: AgentCapability;
    limit?: number;
  }): Promise<Agent[]> {
    const searchOptions: SearchOptions = {
      query: options.query,
      filters: {
        category: options.category,
        capabilities: options.capability ? [options.capability] : undefined
      },
      pagination: {
        page: 1,
        limit: options.limit || 20
      }
    };

    const result = await this.searchEngine.search(searchOptions);
    return result.items;
  }

  async explore(
    startCategory: AgentCategory,
    depth: number = 2
  ): Promise<Map<AgentCategory, Agent[]>> {
    const exploration = new Map<AgentCategory, Agent[]>();

    let categories = [startCategory];
    for (let i = 0; i < depth; i++) {
      const newCategories: AgentCategory[] = [];

      for (const category of categories) {
        const agents = await this.searchEngine.browseByCategory(category);
        exploration.set(category, agents);

        // Find related categories based on agent capabilities
        for (const agent of agents) {
          for (const capability of agent.config.capabilities) {
            const relatedAgents = await this.searchEngine.browseByCapability(capability);
            for (const relatedAgent of relatedAgents) {
              if (!exploration.has(relatedAgent.config.category)) {
                newCategories.push(relatedAgent.config.category);
              }
            }
          }
        }
      }

      categories = newCategories;
    }

    return exploration;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default AgentSearchEngine;
