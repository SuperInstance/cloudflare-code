/**
 * ClaudeFlare Platform - Ultra-Optimized
 * Unified platform integration layer
 */

export * from './types';
export { Platform, bootstrapPlatform, shutdownPlatform } from './bootstrap/platform';
export { DIContainer, DIModuleBuilder } from './di/container';
export { Injectable, Inject, Optional } from './di/decorators';
export { serviceDiscovery } from './services/discovery';

export const VERSION = '0.1.0';