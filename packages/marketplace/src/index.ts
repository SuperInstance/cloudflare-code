/**
 * ClaudeFlare Agent Marketplace
 * A comprehensive marketplace for AI agents
 */

// ============================================================================
// Core Exports
// ============================================================================

export * from './types';

// ============================================================================
// Agent Templates
// ============================================================================

export {
  AgentTemplateManager,
  TemplateRegistry
} from './agents/template';

export type {
  AgentTemplate,
  TemplateType
} from './types';

// ============================================================================
// Agent Builder
// ============================================================================

export {
  AgentBuilder,
  CodeBuilder,
  AgentFactory,
  BuildProfiler,
  AgentDebugger
} from './agents/builder';

export type {
  BuilderOptions,
  CodeBuilderOptions
} from './agents/builder';

// ============================================================================
// Publishing
// ============================================================================

export {
  PublishingManager,
  ReleaseManager,
  SemVerHelper,
  ChangelogGenerator
} from './publishing/platform';

export type {
  PublishingOptions,
  VersionInfo,
  ReleaseWorkflow,
  PublishManifest,
  PublishResult
} from './publishing/platform';

// ============================================================================
// Discovery and Search
// ============================================================================

export {
  AgentSearchEngine,
  AgentDiscoveryService
} from './discovery/search';

export type {
  SearchIndex,
  RankingOptions
} from './discovery/search';

// ============================================================================
// Validation and Testing
// ============================================================================

export {
  AgentValidator,
  AgentTester,
  BenchmarkRunner,
  QualityMetrics
} from './testing/validator';

export type {
  ValidationOptions,
  ValidationRule,
  SecurityCheck
} from './testing/validator';

// ============================================================================
// Community and Sharing
// ============================================================================

export {
  SharingService,
  CollaborationService,
  CollectionService,
  UserProfileService,
  SocialFeatures,
  CommunityAnalytics
} from './community/sharing';

export type {
  ShareMetadata,
  ShareResult,
  CollaborationOptions
} from './community/sharing';

// ============================================================================
// API Routes
// ============================================================================

export {
  MarketplaceAPI,
  authMiddleware,
  rateLimitMiddleware,
  corsMiddleware
} from './api/routes';

export type {
  ApiContext
} from './api/routes';

// ============================================================================
// Utilities
// ============================================================================

export * from './utils';

// ============================================================================
// Main Marketplace Class
// ============================================================================

import { AgentTemplateManager } from './agents/template';
import { AgentBuilder } from './agents/builder';
import { PublishingManager } from './publishing/platform';
import { AgentSearchEngine } from './discovery/search';
import { AgentValidator } from './testing/validator';
import { SharingService, CollaborationService } from './community/sharing';
import { MarketplaceAPI } from './api/routes';
import type { Agent, AgentConfig, SearchOptions } from './types';

export class ClaudeFlareMarketplace {
  private templateManager: AgentTemplateManager;
  private publishingManager: PublishingManager;
  private searchEngine: AgentSearchEngine;
  private validator: AgentValidator;
  private sharingService: SharingService;
  private collaborationService: CollaborationService;
  private api: MarketplaceAPI;

  constructor() {
    this.templateManager = new AgentTemplateManager();
    this.publishingManager = new PublishingManager();
    this.searchEngine = new AgentSearchEngine();
    this.validator = new AgentValidator();
    this.sharingService = new SharingService();
    this.collaborationService = new CollaborationService();
    this.api = new MarketplaceAPI();
  }

  // ========================================================================
  // Template Management
  // ========================================================================

  getTemplateManager(): AgentTemplateManager {
    return this.templateManager;
  }

  async listTemplates(category?: string) {
    if (category) {
      return this.templateManager.listTemplatesByCategory(category as any);
    }
    return this.templateManager.listTemplates();
  }

  async getTemplate(id: string) {
    return this.templateManager.getTemplate(id);
  }

  async scaffoldAgent(templateId: string, customizations: Record<string, any>) {
    return this.templateManager.generateAgentFromTemplate(
      templateId,
      {},
      customizations
    );
  }

  // ========================================================================
  // Agent Building
  // ========================================================================

  createAgentBuilder(config: {
    name: string;
    description?: string;
    category: any;
    capabilities?: any[];
    permissions?: any[];
  }) {
    return new AgentBuilder(config);
  }

  async buildAgent(config: AgentConfig) {
    const builder = new AgentBuilder({
      name: config.name,
      description: config.description,
      category: config.category
    });

    return builder.build();
  }

  // ========================================================================
  // Publishing
  // ========================================================================

  getPublishingManager(): PublishingManager {
    return this.publishingManager;
  }

  async publishAgent(agent: any, options?: any) {
    return this.publishingManager.publish(agent, options);
  }

  async createVersion(agentId: string, versionInfo: any) {
    return this.publishingManager.createVersion(agentId, versionInfo);
  }

  // ========================================================================
  // Search and Discovery
  // ========================================================================

  getSearchEngine(): AgentSearchEngine {
    return this.searchEngine;
  }

  async searchAgents(options: SearchOptions) {
    return this.searchEngine.search(options);
  }

  async getTrending(limit?: number) {
    return this.searchEngine.getTrending(limit);
  }

  async getPopular(limit?: number) {
    return this.searchEngine.getPopular(limit);
  }

  async getTopRated(limit?: number, minRating?: number) {
    return this.searchEngine.getTopRated(limit, minRating);
  }

  async getNewest(limit?: number) {
    return this.searchEngine.getNewest(limit);
  }

  async recommendAgents(agentId: string, options?: any) {
    return this.searchEngine.recommend(agentId, options);
  }

  // ========================================================================
  // Validation and Testing
  // ========================================================================

  getValidator(): AgentValidator {
    return this.validator;
  }

  async validateAgent(agent: any, options?: any) {
    return this.validator.validate(agent, options);
  }

  async testAgent(agent: any, testSuite: any) {
    const tester = this.validator as any;
    return tester.runSuite(agent, testSuite);
  }

  // ========================================================================
  // Community Features
  // ========================================================================

  getSharingService(): SharingService {
    return this.sharingService;
  }

  async shareAgent(agent: any, options: any) {
    return this.sharingService.shareAgent(agent, options);
  }

  async forkAgent(agentId: string, userId: string, modifications: string[]) {
    return this.collaborationService.forkAgent(agentId, userId, modifications);
  }

  async addComment(agentId: string, userId: string, content: string, parentId?: string) {
    return this.collaborationService.addComment(agentId, userId, content, parentId);
  }

  async addReview(agentId: string, userId: string, rating: number, title: string, content: string) {
    return this.collaborationService.addReview(agentId, userId, rating, title, content);
  }

  // ========================================================================
  // API
  // ========================================================================

  getAPI(): MarketplaceAPI {
    return this.api;
  }

  exportAPI() {
    return this.api.export();
  }

  // ========================================================================
  // Indexing
  // ========================================================================

  indexAgent(agent: Agent): void {
    this.searchEngine['indexAgent'](agent);
  }

  indexAgents(agents: Agent[]): void {
    for (const agent of agents) {
      this.indexAgent(agent);
    }
  }

  removeFromIndex(agentId: string): void {
    this.searchEngine['removeAgent'](agentId);
  }

  rebuildIndex(agents: Agent[]): void {
    this.searchEngine['rebuildIndex'](agents);
  }

  // ========================================================================
  // Analytics
  // ========================================================================

  async getMarketplaceStats() {
    return {
      totalAgents: this.searchEngine['index'].agents.size,
      categories: this.searchEngine.getCategoryStats(),
      capabilities: this.searchEngine.getCapabilityStats(),
      popularSearches: this.searchEngine.getPopularSearches()
    };
  }

  async getAgentAnalytics(agentId: string) {
    const agent = this.searchEngine['index'].agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return {
      views: 0,
      installs: agent.stats?.installs || 0,
      rating: agent.stats?.rating || 0,
      forks: agent.stats?.forks || 0
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createMarketplace(): ClaudeFlareMarketplace {
  return new ClaudeFlareMarketplace();
}

export function createAgentBuilder(config: {
  name: string;
  description?: string;
  category: any;
}) {
  return new AgentBuilder(config);
}

export function createTemplateManager(): AgentTemplateManager {
  return new AgentTemplateManager();
}

export function createSearchEngine(): AgentSearchEngine {
  return new AgentSearchEngine();
}

export function createValidator(): AgentValidator {
  return new AgentValidator();
}

// ============================================================================
// Default Export
// ============================================================================

export default ClaudeFlareMarketplace;
