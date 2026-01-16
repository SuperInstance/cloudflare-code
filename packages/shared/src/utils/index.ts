/**
 * Utility functions for ClaudeFlare
 */

import type { TokenUsage, AIProvider } from '../types';

// ============================================================================
// Token Counting Utilities
// ============================================================================

/**
 * Rough estimate of token count for text
 * Note: For production, use tokenizer from respective providers
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(
  provider: AIProvider,
  model: string,
  usage: TokenUsage
): number {
  const pricing = getModelPricing(provider, model);
  const inputCost = (usage.promptTokens / 1000) * pricing.inputCostPer1k;
  const outputCost = (usage.completionTokens / 1000) * pricing.outputCostPer1k;
  return inputCost + outputCost;
}

// ============================================================================
// Model Pricing
// ============================================================================

interface ModelPricing {
  inputCostPer1k: number;
  outputCostPer1k: number;
}

function getModelPricing(provider: AIProvider, model: string): ModelPricing {
  // Pricing as of 2024 - update regularly
  const pricing: Record<AIProvider, Record<string, ModelPricing>> = {
    anthropic: {
      'claude-3-opus-20240229': { inputCostPer1k: 0.015, outputCostPer1k: 0.075 },
      'claude-3-sonnet-20240229': { inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
      'claude-3-haiku-20240307': { inputCostPer1k: 0.00025, outputCostPer1k: 0.00125 },
    },
    openai: {
      'gpt-4-turbo-preview': { inputCostPer1k: 0.01, outputCostPer1k: 0.03 },
      'gpt-4': { inputCostPer1k: 0.03, outputCostPer1k: 0.06 },
      'gpt-3.5-turbo': { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
    },
    cohere: {
      'command': { inputCostPer1k: 0.0005, outputCostPer1k: 0.0005 },
      'command-light': { inputCostPer1k: 0.0003, outputCostPer1k: 0.0003 },
    },
    mistral: {
      'mistral-large': { inputCostPer1k: 0.004, outputCostPer1k: 0.012 },
      'mistral-medium': { inputCostPer1k: 0.0025, outputCostPer1k: 0.0075 },
      'mistral-small': { inputCostPer1k: 0.0002, outputCostPer1k: 0.0006 },
    },
  };

  return pricing[provider]?.[model] || { inputCostPer1k: 0, outputCostPer1k: 0 };
}

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * Generate cache key from request parameters
 */
export function generateCacheKey(
  provider: AIProvider,
  model: string,
  messages: Array<{ role: string; content: string }>
): string {
  const key = provider + ':' + model + ':' + JSON.stringify(messages);
  return simpleHash(key);
}

/**
 * Simple hash function for cache keys
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Format timestamp as ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Calculate duration in milliseconds
 */
export function duration(start: number, end: number): number {
  return end - start;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Generate random ID
 */
export function generateId(prefix?: string): string {
  const id = Math.random().toString(36).slice(2);
  return prefix ? prefix + '_' + id : id;
}
