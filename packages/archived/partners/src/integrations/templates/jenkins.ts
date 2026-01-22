/**
 * Jenkins Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const jenkinsTemplate: IntegrationTemplate = {
  id: 'jenkins',
  partnerId: 'jenkins',
  name: 'Jenkins',
  description: 'Integrate with Jenkins for CI/CD automation',
  category: 'cicd' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://www.jenkins.io/doc/book/using/remote-access-api/',
  authConfig: ['api-key', 'basic-auth'],
  webhookEvents: ['job.completed', 'build.started', 'build.completed'],
  actions: [
    {
      id: 'trigger-build',
      name: 'Trigger Build',
      inputSchema: {
        type: 'object',
        properties: {
          job: { type: 'string' },
          parameters: { type: 'object' }
        },
        required: ['job']
      },
      outputSchema: {},
      endpoint: '/job/{job}/build',
      method: 'POST',
      requiredScopes: []
    }
  ],
  triggers: [],
  configuration: [
    { key: 'url', type: 'string', label: 'Jenkins URL', required: true },
    { key: 'username', type: 'string', label: 'Username', required: true },
    { key: 'api_token', type: 'string', label: 'API Token', required: true, sensitive: true }
  ],
  permissions: [],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
