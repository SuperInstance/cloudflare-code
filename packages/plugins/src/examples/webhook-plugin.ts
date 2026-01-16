// @ts-nocheck
/**
 * Example webhook plugin
 */

import { Plugin } from '../core/plugin';
import type { PluginManifest, SecurityContext, WebhookPayload } from '../types';
import { globalWebhookHandler } from '../webhooks';

/**
 * Webhook plugin manifest
 */
const manifest: PluginManifest = {
  id: 'github-webhook-handler',
  name: 'GitHub Webhook Handler',
  description: 'Handles GitHub webhooks for code events',
  version: '1.0.0',
  minPlatformVersion: '1.0.0',
  type: 'webhook',
  author: {
    name: 'ClaudeFlare Team',
  },
  license: 'MIT',
  keywords: ['github', 'webhook', 'git', 'events'],
  capabilities: {
    sandboxed: true,
    hotReload: true,
    networkAccess: false,
    fsAccess: false,
    dbAccess: false,
    customPermissions: [],
  },
  main: 'index.js',
  subscribes: ['onCodeGeneration', 'onCodeReview'],
};

/**
 * GitHub webhook handler plugin
 */
export class GitHubWebhookPlugin extends Plugin {
  private webhookId?: string;

  public readonly manifest = manifest;

  protected async onLoad(): Promise<void> {
    this.getLogger().info('GitHub webhook plugin loaded');

    // Register webhook
    const webhookUrl = this.getConfig<string>('webhookUrl');
    const webhookSecret = this.getSecrets().WEBHOOK_SECRET;

    if (webhookUrl && webhookSecret) {
      this.webhookId = `github-${this.getId()}`;

      globalWebhookHandler.register({
        id: this.webhookId,
        url: webhookUrl,
        secret: webhookSecret,
        events: ['github.push', 'github.pull_request', 'github.issue'],
        enabled: true,
        method: 'POST',
        timeout: 10000,
        retry: {
          maxAttempts: 3,
          backoffMs: 1000,
        },
        pluginId: this.getId(),
      });

      this.getLogger().info('Webhook registered', { webhookUrl });
    }

    this.registerHook('onCodeGeneration', this.onCodeGeneration.bind(this));
    this.registerHook('onCodeReview', this.onCodeReview.bind(this));
  }

  protected async onUnload(): Promise<void> {
    if (this.webhookId) {
      globalWebhookHandler.unregister(this.webhookId);
    }
  }

  protected async onExecute(
    input: unknown,
    securityContext?: SecurityContext
  ): Promise<unknown> {
    const { event, data } = input as { event: string; data: WebhookPayload };

    this.getLogger().info('Processing webhook event', { event });

    // Process webhook event
    return {
      processed: true,
      event,
      timestamp: new Date(),
    };
  }

  private async onCodeGeneration(context: HookContext): Promise<void> {
    const data = context.data as {
      prompt: string;
      language: string;
      code?: string;
    };

    this.getLogger().info('Code generation event', {
      language: data.language,
      hasCode: !!data.code,
    });

    // Could trigger webhook notification
    if (this.webhookId && data.code) {
      // await globalWebhookHandler.deliver(this.webhookId, {
      //   type: 'code.generated',
      //   id: crypto.randomUUID(),
      //   timestamp: new Date(),
      //   source: 'claudeflare',
      //   data,
      //   headers: {},
      // });
    }
  }

  private async onCodeReview(context: HookContext): Promise<void> {
    const data = context.data as {
      code: string;
      language: string;
      issues?: Array<{ line: number; message: string }>;
    };

    this.getLogger().info('Code review event', {
      language: data.language,
      issueCount: data.issues?.length || 0,
    });
  }
}

export default function createPlugin() {
  return new GitHubWebhookPlugin();
}
