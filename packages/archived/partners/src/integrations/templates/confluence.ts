/**
 * Confluence Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const confluenceTemplate: IntegrationTemplate = {
  id: 'confluence',
  partnerId: 'confluence',
  name: 'Confluence',
  description: 'Integrate with Confluence for documentation',
  category: 'documentation' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://developer.atlassian.com/cloud/confluence/rest/v2/',
  authConfig: ['oauth2', 'api-key'],
  webhookEvents: ['page.created', 'page.updated', 'comment.created'],
  actions: [
    {
      id: 'create-page',
      name: 'Create Page',
      inputSchema: {
        type: 'object',
        properties: {
          spaceId: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'object' }
        },
        required: ['spaceId', 'title']
      },
      outputSchema: {},
      endpoint: '/pages',
      method: 'POST',
      requiredScopes: ['write:page']
    }
  ],
  triggers: [],
  configuration: [
    { key: 'site_url', type: 'string', label: 'Site URL', required: true }
  ],
  permissions: [
    { scope: 'read:page', description: 'Read pages', required: true },
    { scope: 'write:page', description: 'Create pages', required: true }
  ],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
