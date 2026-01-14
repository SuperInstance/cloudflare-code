/**
 * GitLab Integration Template
 * Provides pre-built integration with GitLab
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const gitlabTemplate: IntegrationTemplate = {
  id: 'gitlab',
  partnerId: 'gitlab',
  name: 'GitLab',
  description: 'Integrate with GitLab for repository management, CI/CD, issues, and merge requests',
  category: 'git' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://docs.gitlab.com/ee/api/rest/',
  authConfig: ['oauth2', 'api-key'],
  webhookEvents: [
    'push',
    'merge_request',
    'issues',
    'issue_note',
    'merge_request_note',
    'pipeline',
    'deployment',
    'release',
    'wiki_page'
  ],
  actions: [
    {
      id: 'create-project',
      name: 'Create Project',
      description: 'Create a new GitLab project',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          visibility: {
            type: 'string',
            enum: ['private', 'internal', 'public']
          },
          initialize_with_readme: { type: 'boolean' }
        },
        required: ['name']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          web_url: { type: 'string' },
          http_url_to_repo: { type: 'string' }
        }
      },
      endpoint: '/projects',
      method: 'POST',
      requiredScopes: ['api']
    },
    {
      id: 'create-issue',
      name: 'Create Issue',
      description: 'Create a new issue',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: { type: 'number' },
          title: { type: 'string' },
          description: { type: 'string' },
          labels: { type: 'string' },
          assignee_ids: { type: 'array', items: { type: 'number' } }
        },
        required: ['project_id', 'title']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          iid: { type: 'number' },
          state: { type: 'string' },
          web_url: { type: 'string' }
        }
      },
      endpoint: '/projects/{project_id}/issues',
      method: 'POST',
      requiredScopes: ['api']
    },
    {
      id: 'create-mr',
      name: 'Create Merge Request',
      description: 'Create a new merge request',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: { type: 'number' },
          source_branch: { type: 'string' },
          target_branch: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          remove_source_branch: { type: 'boolean' }
        },
        required: ['project_id', 'source_branch', 'target_branch', 'title']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          iid: { type: 'number' },
          state: { type: 'string' },
          web_url: { type: 'string' }
        }
      },
      endpoint: '/projects/{project_id}/merge_requests',
      method: 'POST',
      requiredScopes: ['api']
    },
    {
      id: 'trigger-pipeline',
      name: 'Trigger Pipeline',
      description: 'Trigger a CI/CD pipeline',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: { type: 'number' },
          ref: { type: 'string' },
          variables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                value: { type: 'string' }
              }
            }
          }
        },
        required: ['project_id', 'ref']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          status: { type: 'string' },
          web_url: { type: 'string' }
        }
      },
      endpoint: '/projects/{project_id}/pipeline',
      method: 'POST',
      requiredScopes: ['api']
    }
  ],
  triggers: [
    {
      id: 'push',
      name: 'Push Event',
      description: 'Triggered when code is pushed',
      eventType: 'push',
      requiredScopes: ['api']
    },
    {
      id: 'merge-request',
      name: 'Merge Request Event',
      description: 'Triggered on MR events',
      eventType: 'merge_request',
      requiredScopes: ['api']
    },
    {
      id: 'pipeline',
      name: 'Pipeline Event',
      description: 'Triggered on pipeline status changes',
      eventType: 'pipeline',
      requiredScopes: ['api']
    }
  ],
  configuration: [
    {
      key: 'url',
      type: 'string',
      label: 'GitLab URL',
      description: 'Self-hosted GitLab URL (optional)',
      required: false
    },
    {
      key: 'default_branch',
      type: 'string',
      label: 'Default Branch',
      description: 'Default branch name',
      required: false,
      default: 'main'
    }
  ],
  permissions: [
    {
      scope: 'api',
      description: 'Full API access',
      required: true
    },
    {
      scope: 'read_user',
      description: 'Read user information',
      required: false
    },
    {
      scope: 'read_repository',
      description: 'Read repository content',
      required: false
    }
  ],
  examples: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
