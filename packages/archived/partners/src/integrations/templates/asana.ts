/**
 * Asana Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const asanaTemplate: IntegrationTemplate = {
  id: 'asana',
  partnerId: 'asana',
  name: 'Asana',
  description: 'Integrate with Asana for project management',
  category: 'project-management' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://developers.asana.com/docs/',
  authConfig: ['oauth2'],
  webhookEvents: ['task.added', 'task.changed', 'story.added'],
  actions: [
    {
      id: 'create-task',
      name: 'Create Task',
      inputSchema: {
        type: 'object',
        properties: {
          workspace: { type: 'string' },
          name: { type: 'string' },
          notes: { type: 'string' },
          assignee: { type: 'string' }
        },
        required: ['workspace', 'name']
      },
      outputSchema: {},
      endpoint: '/tasks',
      method: 'POST',
      requiredScopes: ['default']
    }
  ],
  triggers: [],
  configuration: [],
  permissions: [
    { scope: 'default', description: 'Default access', required: true }
  ],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
