/**
 * Discord Integration Template
 * Provides pre-built integration with Discord
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const discordTemplate: IntegrationTemplate = {
  id: 'discord',
  partnerId: 'discord',
  name: 'Discord',
  description: 'Integrate with Discord for community management and notifications',
  category: 'communication' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://discord.com/developers/docs/intro',
  authConfig: ['oauth2', 'webhook'],
  webhookEvents: [
    'message',
    'guild_member_add',
    'guild_member_remove',
    'interaction',
    'ready'
  ],
  actions: [
    {
      id: 'send-message',
      name: 'Send Message',
      description: 'Send message to channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel_id: { type: 'string' },
          content: { type: 'string' },
          embeds: { type: 'array' },
          components: { type: 'array' }
        },
        required: ['channel_id']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          channel_id: { type: 'string' }
        }
      },
      endpoint: '/channels/{channel.id}/messages',
      method: 'POST',
      requiredScopes: ['bot']
    },
    {
      id: 'create-webhook',
      name: 'Create Webhook',
      description: 'Create webhook in channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel_id: { type: 'string' },
          name: { type: 'string' },
          avatar: { type: 'string' }
        },
        required: ['channel_id', 'name']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          url: { type: 'string' }
        }
      },
      endpoint: '/channels/{channel.id}/webhooks',
      method: 'POST',
      requiredScopes: ['webhook']
    }
  ],
  triggers: [
    {
      id: 'message',
      name: 'Message Event',
      description: 'Triggered on message',
      eventType: 'message',
      requiredScopes: ['bot']
    },
    {
      id: 'interaction',
      name: 'Interaction Event',
      description: 'Triggered by slash command or button',
      eventType: 'interaction',
      requiredScopes: ['bot']
    }
  ],
  configuration: [
    {
      key: 'bot_token',
      type: 'textarea',
      label: 'Bot Token',
      description: 'Discord bot token',
      required: true,
      sensitive: true
    },
    {
      key: 'client_id',
      type: 'string',
      label: 'Client ID',
      description: 'Application client ID',
      required: true
    },
    {
      key: 'client_secret',
      type: 'string',
      label: 'Client Secret',
      description: 'Application client secret',
      required: true,
      sensitive: true
    }
  ],
  permissions: [
    {
      scope: 'bot',
      description: 'Bot access',
      required: true
    }
  ],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
