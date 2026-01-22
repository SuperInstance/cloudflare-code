/**
 * Linear Integration Template
 * Provides pre-built integration with Linear
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const linearTemplate: IntegrationTemplate = {
  id: 'linear',
  partnerId: 'linear',
  name: 'Linear',
  description: 'Integrate with Linear for issue tracking and project management',
  category: 'project-management' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://developers.linear.app/docs/graphql',
  authConfig: ['oauth2', 'api-key'],
  webhookEvents: [
    'Issue',
    'Comment',
    'Project',
    'Cycle',
    'WorkflowState'
  ],
  actions: [
    {
      id: 'create-issue',
      name: 'Create Issue',
      description: 'Create a new Linear issue',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          assigneeId: { type: 'string' },
          labelIds: { type: 'array', items: { type: 'string' } },
          priority: { type: 'number' }
        },
        required: ['teamId', 'title']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          state: { type: 'object' }
        }
      },
      endpoint: '/graphql',
      method: 'POST',
      requiredScopes: ['write', 'issues:create']
    },
    {
      id: 'search-issues',
      name: 'Search Issues',
      description: 'Search issues using filters',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: { type: 'string' },
          filter: {
            type: 'object',
            description: 'Filter criteria'
          }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          nodes: { type: 'array' }
        }
      },
      endpoint: '/graphql',
      method: 'POST',
      requiredScopes: ['read']
    },
    {
      id: 'add-comment',
      name: 'Add Comment',
      description: 'Add comment to issue',
      inputSchema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          body: { type: 'string' }
        },
        required: ['issueId', 'body']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          body: { type: 'string' }
        }
      },
      endpoint: '/graphql',
      method: 'POST',
      requiredScopes: ['write', 'comments:create']
    }
  ],
  triggers: [
    {
      id: 'issue-created',
      name: 'Issue Created',
      description: 'Triggered when issue is created',
      eventType: 'Issue',
      requiredScopes: ['read']
    },
    {
      id: 'issue-updated',
      name: 'Issue Updated',
      description: 'Triggered when issue is updated',
      eventType: 'Issue',
      requiredScopes: ['read']
    }
  ],
  configuration: [
    {
      key: 'team_id',
      type: 'string',
      label: 'Team ID',
      description: 'Default team ID',
      required: false
    }
  ],
  permissions: [
    {
      scope: 'read',
      description: 'Read issues',
      required: true
    },
    {
      scope: 'write',
      description: 'Create and update issues',
      required: true
    },
    {
      scope: 'issues:create',
      description: 'Create issues',
      required: false
    },
    {
      scope: 'comments:create',
      description: 'Add comments',
      required: false
    }
  ],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
