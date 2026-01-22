/**
 * Microsoft Teams Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const teamsTemplate: IntegrationTemplate = {
  id: 'microsoft-teams',
  partnerId: 'microsoft',
  name: 'Microsoft Teams',
  description: 'Integrate with Microsoft Teams for collaboration',
  category: 'communication' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using',
  authConfig: ['oauth2'],
  webhookEvents: ['message', 'call', 'meeting'],
  actions: [
    {
      id: 'send-message',
      name: 'Send Message',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['channel', 'text']
      },
      outputSchema: {},
      endpoint: '/teams/{channel}/messages',
      method: 'POST',
      requiredScopes: ['Chat.Send']
    }
  ],
  triggers: [],
  configuration: [],
  permissions: [
    { scope: 'Chat.Send', description: 'Send messages', required: true }
  ],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
