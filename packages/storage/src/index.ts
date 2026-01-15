/**
 * ClaudeFlare Storage - Ultra-Optimized
 * Advanced storage abstraction layer
 */

export * from './types';
export { StorageEngine } from './engine';
export { StorageAdapter } from './adapter';
export { StorageCache } from './cache';
export { StorageBackup } from './backup';
export { StorageSystem, createStorageSystem } from './system';

export const VERSION = '1.0.0';
export default StorageSystem;
