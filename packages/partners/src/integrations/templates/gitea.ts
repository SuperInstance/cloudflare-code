/**
 * Gitea Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const giteaTemplate: IntegrationTemplate = {
  id: 'gitea',
  partnerId: 'gitea',
  name: 'Gitea',
  description: 'Integrate with self-hosted Gitea for Git hosting',
  category: 'git' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://docs.gitea.com/next/developers/api-usage',
  authConfig: ['api-key', 'oauth2'],
  webhookEvents: ['push', 'pull_request', 'issues', 'release'],
  actions: [
    {
      id: 'create-repo',
      name: 'Create Repository',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          private: { type: 'boolean' }
        },
        required: ['name']
      },
      outputSchema: {},
      endpoint: '/user/repos',
      method: 'POST',
      requiredScopes: []
    }
  ],
  triggers: [],
  configuration: [
    { key: 'url', type: 'string', label: 'Gitea URL', required: true },
    { key: 'access_token', type: 'textarea', label: 'Access Token', required: true, sensitive: true }
  ],
  permissions: [],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
