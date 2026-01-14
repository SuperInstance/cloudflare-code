/**
 * Example AI provider plugin
 */

import { Plugin } from '../core/plugin';
import type { PluginManifest, SecurityContext, HookContext } from '../types';

/**
 * AI provider plugin manifest
 */
const manifest: PluginManifest = {
  id: 'openai-provider',
  name: 'OpenAI Provider',
  description: 'OpenAI AI model provider plugin',
  version: '1.0.0',
  minPlatformVersion: '1.0.0',
  type: 'ai_provider',
  author: {
    name: 'ClaudeFlare Team',
  },
  license: 'MIT',
  keywords: ['openai', 'ai', 'llm', 'gpt'],
  capabilities: {
    sandboxed: true,
    hotReload: false,
    networkAccess: true,
    fsAccess: false,
    dbAccess: false,
    customPermissions: ['network:api.openai.com'],
  },
  main: 'index.js',
  requiredSecrets: ['OPENAI_API_KEY'],
  subscribes: ['onAIRequest', 'onAIResponse'],
};

/**
 * OpenAI provider plugin
 */
export class OpenAIProviderPlugin extends Plugin {
  public readonly manifest = manifest;

  protected async onLoad(): Promise<void> {
    this.getLogger().info('OpenAI provider plugin loaded');

    const apiKey = this.getSecrets().OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.registerHook('onAIRequest', this.onAIRequest.bind(this));
    this.registerHook('onAIResponse', this.onAIResponse.bind(this));
  }

  protected async onExecute(
    input: unknown,
    securityContext?: SecurityContext
  ): Promise<unknown> {
    const { model, prompt, options } = input as {
      model: string;
      prompt: string;
      options?: Record<string, unknown>;
    };

    this.getLogger().info('Executing OpenAI request', { model });

    const apiKey = this.getSecrets().OPENAI_API_KEY;
    const http = this.getHttp();

    try {
      const response = await http.post('https://api.openai.com/v1/chat/completions', {
        model: model || 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        ...options,
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      this.getLogger().error('OpenAI request failed', error);
      throw error;
    }
  }

  private async onAIRequest(context: HookContext): Promise<void> {
    const data = context.data as { model: string; prompt: string };

    this.getLogger().debug('AI request hook', {
      model: data.model,
      promptLength: data.prompt.length,
    });
  }

  private async onAIResponse(context: HookContext): Promise<void> {
    this.getLogger().debug('AI response hook', {
      hasData: !!context.data,
    });
  }
}

export default function createPlugin() {
  return new OpenAIProviderPlugin();
}
