/**
 * ClaudeFlare Agent Marketplace - Ultra-Optimized
 * Comprehensive marketplace for AI agents
 */

export * from './types';

// Core components (minimal exports)
export { AgentTemplateManager, TemplateRegistry } from './agents/template';
export { AgentBuilder, AgentFactory } from './agents/builder';
export { PublishingManager, ReleaseManager } from './publishing/platform';
export { MarketplaceMetrics } from './metrics/analytics';
export { MarketplaceStore } from './storage/store';

// Main system
export { Marketplace, createMarketplace } from './system';

export const VERSION = '1.0.0';
export default Marketplace;
