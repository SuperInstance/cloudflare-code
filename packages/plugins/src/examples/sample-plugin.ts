/**
 * Sample plugin implementation
 */

import { Plugin } from '../core/plugin';
import type { PluginManifest, SecurityContext, HookContext } from '../types';

/**
 * Sample plugin manifest
 */
const manifest: PluginManifest = {
  id: 'sample-plugin',
  name: 'Sample Plugin',
  description: 'A sample plugin for ClaudeFlare',
  version: '1.0.0',
  minPlatformVersion: '1.0.0',
  type: 'custom',
  author: {
    name: 'ClaudeFlare Team',
    email: 'team@claudeflare.dev',
  },
  license: 'MIT',
  keywords: ['sample', 'example', 'demo'],
  capabilities: {
    sandboxed: true,
    hotReload: true,
    networkAccess: false,
    fsAccess: false,
    dbAccess: false,
    customPermissions: [],
  },
  main: 'index.js',
  subscribes: ['beforeRequest', 'afterResponse'],
};

/**
 * Sample plugin class
 */
export class SamplePlugin extends Plugin {
  public readonly manifest = manifest;

  protected async onLoad(): Promise<void> {
    this.getLogger().info('Sample plugin loaded');

    // Register hook handlers
    this.registerHook('beforeRequest', this.onBeforeRequest.bind(this));
    this.registerHook('afterResponse', this.onAfterResponse.bind(this));
  }

  protected async onActivate(): Promise<void> {
    this.getLogger().info('Sample plugin activated');
  }

  protected async onDeactivate(): Promise<void> {
    this.getLogger().info('Sample plugin deactivated');
  }

  protected async onUnload(): Promise<void> {
    this.getLogger().info('Sample plugin unloaded');
  }

  protected async onExecute(
    input: unknown,
    securityContext?: SecurityContext
  ): Promise<unknown> {
    this.getLogger().info('Executing sample plugin', { input });

    // Process input
    return {
      message: 'Sample plugin executed successfully',
      input,
      timestamp: new Date(),
    };
  }

  /**
   * Before request hook handler
   */
  private async onBeforeRequest(context: HookContext): Promise<void> {
    this.getLogger().debug('Before request hook', { data: context.data });

    // Can modify request data
    // context.modify({ ...context.data, modified: true });

    // Can cancel request
    // context.cancel();
  }

  /**
   * After response hook handler
   */
  private async onAfterResponse(context: HookContext): Promise<void> {
    this.getLogger().debug('After response hook', { data: context.data });

    // Can modify response data
    // context.modify({ ...context.data, processed: true });
  }
}

/**
 * Export plugin factory
 */
export default function createPlugin() {
  return new SamplePlugin();
}
