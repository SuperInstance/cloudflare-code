/**
 * Smart Router Module
 *
 * Intelligent request routing with complexity-based routing,
 * confidence cascading, and cost optimization.
 *
 * Features:
 * - Request complexity analysis
 * - Multi-objective strategy selection
 * - Confidence-based tiered cascading
 * - Cost optimization and batching
 * - Semantic caching integration
 *
 * Targets:
 * - 70-90% requests handled by Tier 1 (free)
 * - 90%+ cost reduction
 * - <50ms routing overhead
 */

export * from './types';
export * from './analyzer';
export * from './strategy';
export * from './cascade';
export * from './cost-optimizer';
export * from './smart-router';
