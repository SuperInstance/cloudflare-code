/**
 * Azure DevOps Integration Template
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const azureDevOpsTemplate: IntegrationTemplate = {
  id: 'azure-devops',
  partnerId: 'azure-devops',
  name: 'Azure DevOps',
  description: 'Integrate with Azure DevOps for CI/CD and project management',
  category: 'cicd' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://docs.microsoft.com/en-us/rest/api/azure/devops/',
  authConfig: ['oauth2', 'api-key'],
  webhookEvents: ['git.push', 'pullrequest.created', 'build.completed'],
  actions: [
    {
      id: 'create-build',
      name: 'Queue Build',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          definition: { type: 'number' }
        },
        required: ['project', 'definition']
      },
      outputSchema: {},
      endpoint: '/build/builds',
      method: 'POST',
      requiredScopes: ['build_execute']
    }
  ],
  triggers: [],
  configuration: [
    { key: 'organization', type: 'string', label: 'Organization', required: true },
    { key: 'project', type: 'string', label: 'Project', required: true }
  ],
  permissions: [
    { scope: 'build_execute', description: 'Execute builds', required: true }
  ],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
