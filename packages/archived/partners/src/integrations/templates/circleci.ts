/**
 * CircleCI Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const circleciTemplate: IntegrationTemplate = {
  id: 'circleci',
  partnerId: 'circleci',
  name: 'CircleCI',
  description: 'Integrate with CircleCI for continuous integration',
  category: 'cicd' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://circleci.com/docs/api/',
  authConfig: ['api-key'],
  webhookEvents: ['workflow.completed', 'job.completed'],
  actions: [
    {
      id: 'trigger-pipeline',
      name: 'Trigger Pipeline',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          branch: { type: 'string' }
        },
        required: ['project']
      },
      outputSchema: {},
      endpoint: '/project/{vcs}/{org}/{project}/pipeline',
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
