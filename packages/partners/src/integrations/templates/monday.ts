/**
 * Monday.com Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const mondayTemplate: IntegrationTemplate = {
  id: 'monday',
  partnerId: 'monday',
  name: 'Monday.com',
  description: 'Integrate with Monday.com for work management',
  category: 'project-management' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://developer.monday.com/api-reference/docs',
  authConfig: ['api-key'],
  webhookEvents: ['item_created', 'item_updated', 'status_updated'],
  actions: [
    {
      id: 'create-item',
      name: 'Create Item',
      inputSchema: {
        type: 'object',
        properties: {
          board_id: { type: 'number' },
          group_id: { type: 'string' },
          item_name: { type: 'string' },
          column_values: { type: 'object' }
        },
        required: ['board_id', 'item_name']
      },
      outputSchema: {},
      endpoint: '/graphql',
      method: 'POST',
      requiredScopes: []
    }
  ],
  triggers: [],
  configuration: [
    { key: 'api_token', type: 'textarea', label: 'API Token', required: true, sensitive: true }
  ],
  permissions: [],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
