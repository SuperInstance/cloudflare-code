/**
 * Notion Integration Template
 * Provides pre-built integration with Notion
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const notionTemplate: IntegrationTemplate = {
  id: 'notion',
  partnerId: 'notion',
  name: 'Notion',
  description: 'Integrate with Notion for documentation and knowledge management',
  category: 'documentation' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://developers.notion.com/reference',
  authConfig: ['oauth2'],
  webhookEvents: [],
  actions: [
    {
      id: 'create-page',
      name: 'Create Page',
      description: 'Create a new page',
      inputSchema: {
        type: 'object',
        properties: {
          parent: { type: 'object' },
          properties: { type: 'object' },
          children: { type: 'array' }
        },
        required: ['parent', 'properties']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          url: { type: 'string' }
        }
      },
      endpoint: '/pages',
      method: 'POST',
      requiredScopes: []
    },
    {
      id: 'append-blocks',
      name: 'Append Blocks',
      description: 'Append content blocks to page',
      inputSchema: {
        type: 'object',
        properties: {
          block_id: { type: 'string' },
          children: { type: 'array' }
        },
        required: ['block_id', 'children']
      },
      outputSchema: {},
      endpoint: '/blocks/{block_id}/children',
      method: 'PATCH',
      requiredScopes: []
    },
    {
      id: 'query-database',
      name: 'Query Database',
      description: 'Query Notion database',
      inputSchema: {
        type: 'object',
        properties: {
          database_id: { type: 'string' },
          filter: { type: 'object' },
          sorts: { type: 'array' }
        },
        required: ['database_id']
      },
      outputSchema: {
        type: 'object',
        properties: {
          results: { type: 'array' }
        }
      },
      endpoint: '/databases/{database_id}/query',
      method: 'POST',
      requiredScopes: []
    }
  ],
  triggers: [],
  configuration: [
    {
      key: 'access_token',
      type: 'textarea',
      label: 'Access Token',
      description: 'Notion API access token',
      required: true,
      sensitive: true
    },
    {
      key: 'workspace_id',
      type: 'string',
      label: 'Workspace ID',
      description: 'Notion workspace ID',
      required: true
    }
  ],
  permissions: [],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
