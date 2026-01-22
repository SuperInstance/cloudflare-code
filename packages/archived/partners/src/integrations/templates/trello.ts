/**
 * Trello Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const trelloTemplate: IntegrationTemplate = {
  id: 'trello',
  partnerId: 'trello',
  name: 'Trello',
  description: 'Integrate with Trello for project boards',
  category: 'project-management' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://developer.atlassian.com/cloud/trello/rest/api-group-cards/',
  authConfig: ['oauth2', 'api-key'],
  webhookEvents: ['card.created', 'card.moved', 'comment.added'],
  actions: [
    {
      id: 'create-card',
      name: 'Create Card',
      inputSchema: {
        type: 'object',
        properties: {
          listId: { type: 'string' },
          name: { type: 'string' },
          desc: { type: 'string' }
        },
        required: ['listId', 'name']
      },
      outputSchema: {},
      endpoint: '/cards',
      method: 'POST',
      requiredScopes: []
    }
  ],
  triggers: [],
  configuration: [
    { key: 'api_key', type: 'string', label: 'API Key', required: true },
    { key: 'token', type: 'textarea', label: 'Token', required: true, sensitive: true }
  ],
  permissions: [],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
