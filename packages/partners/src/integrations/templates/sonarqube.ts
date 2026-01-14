/**
 * SonarQube Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const sonarqubeTemplate: IntegrationTemplate = {
  id: 'sonarqube',
  partnerId: 'sonarqube',
  name: 'SonarQube',
  description: 'Integrate with SonarQube for code quality analysis',
  category: 'code-quality' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://docs.sonarqube.org/latest/extend/web-api/',
  authConfig: ['api-key', 'basic-auth'],
  webhookEvents: ['analysis.completed'],
  actions: [
    {
      id: 'trigger-analysis',
      name: 'Trigger Analysis',
      inputSchema: {
        type: 'object',
        properties: {
          projectKey: { type: 'string' }
        },
        required: ['projectKey']
      },
      outputSchema: {},
      endpoint: '/ce/submit',
      method: 'POST',
      requiredScopes: []
    }
  ],
  triggers: [],
  configuration: [
    { key: 'url', type: 'string', label: 'SonarQube URL', required: true },
    { key: 'token', type: 'textarea', label: 'Authentication Token', required: true, sensitive: true }
  ],
  permissions: [],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
