/**
 * Jira Integration Template
 * Provides pre-built integration with Atlassian Jira
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const jiraTemplate: IntegrationTemplate = {
  id: 'jira',
  partnerId: 'jira',
  name: 'Jira',
  description: 'Integrate with Jira for issue tracking, project management, and agile development',
  category: 'project-management' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
  authConfig: ['oauth2', 'api-key'],
  webhookEvents: [
    'iss_created',
    'iss_updated',
    'iss_assigned',
    'worklog_created',
    'sprint_started',
    'sprint_closed',
    'version_released'
  ],
  actions: [
    {
      id: 'create-issue',
      name: 'Create Issue',
      description: 'Create a new Jira issue',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'object' },
          summary: { type: 'string' },
          description: { type: 'string' },
          issuetype: { type: 'object' },
          priority: { type: 'object' },
          assignee: { type: 'object' },
          labels: { type: 'array', items: { type: 'string' } }
        },
        required: ['project', 'summary', 'issuetype']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          key: { type: 'string' },
          self: { type: 'string' }
        }
      },
      endpoint: '/rest/api/3/issue',
      method: 'POST',
      requiredScopes: ['read:jira-work', 'write:jira-work']
    },
    {
      id: 'search-issues',
      name: 'Search Issues',
      description: 'Search for issues using JQL',
      inputSchema: {
        type: 'object',
        properties: {
          jql: { type: 'string' },
          startAt: { type: 'number' },
          maxResults: { type: 'number' },
          fields: { type: 'array', items: { type: 'string' } }
        },
        required: ['jql']
      },
      outputSchema: {
        type: 'object',
        properties: {
          startAt: { type: 'number' },
          maxResults: { type: 'number' },
          total: { type: 'number' },
          issues: { type: 'array' }
        }
      },
      endpoint: '/rest/api/3/search',
      method: 'POST',
      requiredScopes: ['read:jira-work']
    },
    {
      id: 'add-comment',
      name: 'Add Comment',
      description: 'Add comment to issue',
      inputSchema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          body: {
            type: 'object',
            description: 'Atlassian Document Format'
          }
        },
        required: ['issueId', 'body']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          created: { type: 'string' },
          body: { type: 'object' }
        }
      },
      endpoint: '/rest/api/3/issue/{issueId}/comment',
      method: 'POST',
      requiredScopes: ['write:jira-work']
    },
    {
      id: 'transition-issue',
      name: 'Transition Issue',
      description: 'Transition issue to new status',
      inputSchema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          transition: { type: 'object' }
        },
        required: ['issueId', 'transition']
      },
      outputSchema: {},
      endpoint: '/rest/api/3/issue/{issueId}/transitions',
      method: 'POST',
      requiredScopes: ['write:jira-work']
    },
    {
      id: 'create-sprint',
      name: 'Create Sprint',
      description: 'Create new sprint',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          originBoardId: { type: 'number' },
          startDate: { type: 'string' },
          endDate: { type: 'string' }
        },
        required: ['name', 'originBoardId']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          state: { type: 'string' }
        }
      },
      endpoint: '/rest/agile/1.0/sprint',
      method: 'POST',
      requiredScopes: ['write:jira-work']
    },
    {
      id: 'add-worklog',
      name: 'Add Worklog',
      description: 'Log work on issue',
      inputSchema: {
        type: 'object',
        properties: {
          issueId: { type: 'string' },
          timeSpent: { type: 'string' },
          comment: { type: 'object' }
        },
        required: ['issueId', 'timeSpent']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          timeSpent: { type: 'string' },
          author: { type: 'object' }
        }
      },
      endpoint: '/rest/api/3/issue/{issueId}/worklog',
      method: 'POST',
      requiredScopes: ['write:jira-work']
    }
  ],
  triggers: [
    {
      id: 'issue-created',
      name: 'Issue Created',
      description: 'Triggered when issue is created',
      eventType: 'iss_created',
      requiredScopes: ['read:jira-work']
    },
    {
      id: 'issue-updated',
      name: 'Issue Updated',
      description: 'Triggered when issue is updated',
      eventType: 'iss_updated',
      requiredScopes: ['read:jira-work']
    },
    {
      id: 'sprint-started',
      name: 'Sprint Started',
      description: 'Triggered when sprint starts',
      eventType: 'sprint_started',
      requiredScopes: ['read:jira-work']
    },
    {
      id: 'sprint-closed',
      name: 'Sprint Closed',
      description: 'Triggered when sprint closes',
      eventType: 'sprint_closed',
      requiredScopes: ['read:jira-work']
    }
  ],
  configuration: [
    {
      key: 'site_url',
      type: 'string',
      label: 'Site URL',
      description: 'Your Jira site URL (e.g., https://yourdomain.atlassian.net)',
      required: true
    },
    {
      key: 'project_key',
      type: 'string',
      label: 'Project Key',
      description: 'Default project key (e.g., PROJ)',
      required: false
    },
    {
      key: 'default_issue_type',
      type: 'select',
      label: 'Default Issue Type',
      description: 'Default issue type for new issues',
      required: false,
      options: [
        { label: 'Story', value: 'Story' },
        { label: 'Bug', value: 'Bug' },
        { label: 'Task', value: 'Task' },
        { label: 'Epic', value: 'Epic' }
      ]
    }
  ],
  permissions: [
    {
      scope: 'read:jira-work',
      description: 'Read Jira issues and projects',
      required: true
    },
    {
      scope: 'write:jira-work',
      description: 'Create and update issues',
      required: true
    },
    {
      scope: 'read:jira-user',
      description: 'Read user information',
      required: false
    },
    {
      scope: 'offline_access',
      description: 'Refresh access tokens',
      required: false
    }
  ],
  examples: [
    {
      name: 'Create issue from GitHub PR',
      description: 'Create Jira issue when GitHub PR is opened',
      config: {},
      code: `// Create Jira issue from GitHub PR
if (event.action === 'opened') {
  await integrations.jira.createIssue({
    project: { key: 'PROJ' },
    summary: \`PR: \${event.pull_request.title}\`,
    description: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: event.pull_request.body
            }
          ]
        }
      ]
    },
    issuetype: { name: 'Story' }
  });
}`
    }
  ],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
