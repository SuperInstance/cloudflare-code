/**
 * ClaudeFlare Plugin System - Ultra-Optimized
 * Lightweight plugin framework
 */

export * from './types';
export { Plugin, WASMSandbox, createDefaultSandboxConfig } from './core';
export { PluginRegistry, PluginDiscovery } from './registry';
export { PluginLoader } from './loader';
export { globalHookRegistry, dispatchHook, dispatchHookSync } from './hooks';
export { globalWebhookHandler, WebhookHandler } from './webhooks';

export const VERSION = '1.0.0';