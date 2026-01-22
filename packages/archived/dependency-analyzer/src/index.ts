/**
 * Dependency Analyzer Package
 *
 * Comprehensive dependency analysis and management for the ClaudeFlare platform
 */

export { DependencyAnalyzer, createAnalyzer } from './analyzer.js';
export * from './types/index.js';
export * from './graph/graph.js';
export * from './circular/detector.js';
export * from './unused/detector.js';
export * from './updates/manager.js';
export * from './license/analyzer.js';
export * from './security/scanner.js';
export * from './optimization/optimizer.js';

// Version
export const VERSION = '0.1.0';

// Default export
export { DependencyAnalyzer as default } from './analyzer.js';
