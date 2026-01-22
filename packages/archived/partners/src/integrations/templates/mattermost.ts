/**
 * Mattermost Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const mattermostTemplate: IntegrationTemplate = {
  id: 'mattermost',
  partnerId: 'mattermost',
  name: 'Mattermost',
  description: 'Integrate with Mattermost for team messaging',
  category: 'communication' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://developers.mattermost.com/integrate/webhooks/incoming/',
  authConfig: ['webhook', 'api-key', 'oauth2'],
  webhookEvents: ['posted', 'post_edited', 'user_added'],
  actions: [
    {
      id: 'send-message',
      name: 'Send Message',
      inputSchema: {
        type: 'object',
        properties: {
          channel_id: { type: 'string' },
          message: { type: 'string' },
          props: { type: 'object' }
        },
        required: ['channel_id', 'message']
      },
      outputSchema: {},
      endpoint: '/posts',
      method: 'POST',
      requiredScopes: []
    }
  ],
  triggers: [],
  configuration: [
    { key: 'url', type: 'string', label: 'Mattermost URL', required: true },
    { key: 'bot_token', type: 'textarea', label: 'Bot Token', required: true, sensitive: true }
  ],
  permissions: [],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
