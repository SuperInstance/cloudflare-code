/**
 * Bitbucket Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const bitbucketTemplate: IntegrationTemplate = {
  id: 'bitbucket',
  partnerId: 'bitbucket',
  name: 'Bitbucket',
  description: 'Integrate with Bitbucket for code hosting and CI/CD',
  category: 'git' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://developer.atlassian.com/bitbucket/api/2/reference/',
  authConfig: ['oauth2'],
  webhookEvents: ['repo:push', 'pullrequest:created', 'pullrequest:updated', 'issue:created'],
  actions: [
    {
      id: 'create-repository',
      name: 'Create Repository',
      inputSchema: {
        type: 'object',
        properties: {
          workspace: { type: 'string' },
          slug: { type: 'string' }
        },
        required: ['workspace', 'slug']
      },
      outputSchema: {},
      endpoint: '/repositories/{workspace}/{slug}',
      method: 'POST',
      requiredScopes: ['repository']
    }
  ],
  triggers: [
    { id: 'push', name: 'Push', eventType: 'repo:push', requiredScopes: ['repository'] }
  ],
  configuration: [],
  permissions: [
    { scope: 'repository', description: 'Repository access', required: true },
    { scope: 'pullrequest', description: 'Pull request access', required: false }
  ],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
