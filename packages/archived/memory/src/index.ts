// @ts-nocheck
/**
 * ClaudeFlare Memory System
 *
 * A comprehensive AI memory and learning system with:
 * - Episodic memory: Event and experience storage
 * - Semantic memory: Knowledge and patterns
 * - Procedural memory: Skills and procedures
 * - Knowledge graph: Relational knowledge representation
 * - Consolidation: Memory strengthening and organization
 * - Pruning: Memory management and optimization
 * - Learning: Experience replay and reinforcement learning
 * @packageDocumentation
 */

// Main exports
export { MemoryManager } from './manager';

// Type exports
export * from './types';

// Memory systems
export * from './memory';

// Knowledge graph
export * from './knowledge';

// Learning systems
export * from './learning';

// Utilities
export * from './utils';

// Default configuration
export { defaultConfig } from './config';

/**
 * Create a new memory manager instance
 */
export async function createMemoryManager(
  db: D1Database,
  config?: Partial<import('./types').MemorySystemConfig>
): Promise<typeof MemoryManager> {
  const { defaultConfig } = await import('./config');
  const finalConfig = { ...defaultConfig, ...config };

  const manager = new MemoryManager(finalConfig, db);
  await manager.initialize();

  return manager;
}

/**
 * Version of the memory system
 */
export const VERSION = '1.0.0';
