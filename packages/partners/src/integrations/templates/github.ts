/**
 * GitHub Integration Template
 * Provides pre-built integration with GitHub
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const githubTemplate: IntegrationTemplate = {
  id: 'github',
  partnerId: 'github',
  name: 'GitHub',
  description: 'Integrate with GitHub for repository management, issues, pull requests, and workflows',
  category: 'git' as IntegrationCategory,
  version: '2.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://docs.github.com/en/rest',
  authConfig: ['oauth2', 'api-key'],
  webhookEvents: [
    'push',
    'pull_request',
    'issues',
    'issue_comment',
    'pull_request_review',
    'release',
    'workflow_run',
    'deployment',
    'repository',
    'organization'
  ],
  actions: [
    {
      id: 'create-repository',
      name: 'Create Repository',
      description: 'Create a new GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Repository name'
          },
          description: {
            type: 'string',
            description: 'Repository description'
          },
          private: {
            type: 'boolean',
            description: 'Whether repository is private',
            default: false
          },
          auto_init: {
            type: 'boolean',
            description: 'Initialize with README',
            default: true
          }
        },
        required: ['name']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          full_name: { type: 'string' },
          html_url: { type: 'string' },
          clone_url: { type: 'string' }
        }
      },
      endpoint: '/user/repos',
      method: 'POST',
      requiredScopes: ['repo', 'public_repo']
    },
    {
      id: 'create-issue',
      name: 'Create Issue',
      description: 'Create a new issue in a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner'
          },
          repo: {
            type: 'string',
            description: 'Repository name'
          },
          title: {
            type: 'string',
            description: 'Issue title'
          },
          body: {
            type: 'string',
            description: 'Issue body/description'
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Issue labels'
          },
          assignees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Issue assignees'
          }
        },
        required: ['owner', 'repo', 'title']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          number: { type: 'number' },
          state: { type: 'string' },
          title: { type: 'string' },
          html_url: { type: 'string' }
        }
      },
      endpoint: '/repos/{owner}/{repo}/issues',
      method: 'POST',
      requiredScopes: ['repo']
    },
    {
      id: 'create-pull-request',
      name: 'Create Pull Request',
      description: 'Create a new pull request',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner'
          },
          repo: {
            type: 'string',
            description: 'Repository name'
          },
          title: {
            type: 'string',
            description: 'PR title'
          },
          body: {
            type: 'string',
            description: 'PR description'
          },
          head: {
            type: 'string',
            description: 'Branch name with changes'
          },
          base: {
            type: 'string',
            description: 'Branch to merge into',
            default: 'main'
          }
        },
        required: ['owner', 'repo', 'title', 'head']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          number: { type: 'number' },
          state: { type: 'string' },
          title: { type: 'string' },
          html_url: { type: 'string' }
        }
      },
      endpoint: '/repos/{owner}/{repo}/pulls',
      method: 'POST',
      requiredScopes: ['repo']
    },
    {
      id: 'add-comment',
      name: 'Add Comment',
      description: 'Add a comment to an issue or pull request',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          issue_number: { type: 'number' },
          body: { type: 'string' }
        },
        required: ['owner', 'repo', 'issue_number', 'body']
      },
      outputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          body: { type: 'string' },
          created_at: { type: 'string' }
        }
      },
      endpoint: '/repos/{owner}/{repo}/issues/{issue_number}/comments',
      method: 'POST',
      requiredScopes: ['repo']
    },
    {
      id: 'get-file',
      name: 'Get File Contents',
      description: 'Get the contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          path: { type: 'string' },
          ref: { type: 'string' }
        },
        required: ['owner', 'repo', 'path']
      },
      outputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          path: { type: 'string' },
          content: { type: 'string' },
          encoding: { type: 'string' }
        }
      },
      endpoint: '/repos/{owner}/{repo}/contents/{path}',
      method: 'GET',
      requiredScopes: ['repo']
    },
    {
      id: 'update-file',
      name: 'Update File',
      description: 'Update or create a file',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          path: { type: 'string' },
          message: { type: 'string' },
          content: { type: 'string' },
          sha: { type: 'string' },
          branch: { type: 'string' }
        },
        required: ['owner', 'repo', 'path', 'message', 'content']
      },
      outputSchema: {
        type: 'object',
        properties: {
          content: { type: 'object' },
          commit: { type: 'object' }
        }
      },
      endpoint: '/repos/{owner}/{repo}/contents/{path}',
      method: 'PUT',
      requiredScopes: ['repo']
    }
  ],
  triggers: [
    {
      id: 'push',
      name: 'Push Event',
      description: 'Triggered when code is pushed to a repository',
      eventType: 'push',
      requiredScopes: ['repo']
    },
    {
      id: 'pull-request',
      name: 'Pull Request Event',
      description: 'Triggered when a pull request is opened, updated, or closed',
      eventType: 'pull_request',
      filterSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['opened', 'synchronize', 'closed', 'reopened']
          }
        }
      },
      requiredScopes: ['repo']
    },
    {
      id: 'issues',
      name: 'Issue Event',
      description: 'Triggered when an issue is created, updated, or closed',
      eventType: 'issues',
      filterSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['opened', 'edited', 'closed', 'reopened']
          }
        }
      },
      requiredScopes: ['repo']
    },
    {
      id: 'workflow-run',
      name: 'Workflow Run Event',
      description: 'Triggered when a GitHub Actions workflow run completes',
      eventType: 'workflow_run',
      filterSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['completed', 'requested']
          }
        }
      },
      requiredScopes: ['repo']
    }
  ],
  configuration: [
    {
      key: 'installation_id',
      type: 'string',
      label: 'Installation ID',
      description: 'GitHub App installation ID',
      required: false
    },
    {
      key: 'default_branch',
      type: 'string',
      label: 'Default Branch',
      description: 'Default branch name',
      required: false,
      default: 'main'
    },
    {
      key: 'auto_merge',
      type: 'boolean',
      label: 'Auto Merge',
      description: 'Automatically merge approved PRs',
      required: false,
      default: false
    }
  ],
  permissions: [
    {
      scope: 'repo',
      description: 'Full control of private repositories',
      required: true
    },
    {
      scope: 'public_repo',
      description: 'Access to public repositories',
      required: false
    },
    {
      scope: 'workflow',
      description: 'Update GitHub Action workflows',
      required: false
    },
    {
      scope: 'admin:org',
      description: 'Administer organization',
      required: false
    }
  ],
  examples: [
    {
      name: 'Auto-comment on new issues',
      description: 'Automatically comment on new issues',
      config: {
        triggers: ['issues'],
        actions: ['add-comment'],
        filters: {
          action: 'opened'
        }
      },
      code: `// Auto-comment on new issues
if (event.action === 'opened') {
  await integrations.github.addComment({
    owner: 'owner',
    repo: 'repo',
    issue_number: event.issue.number,
    body: 'Thanks for opening this issue!'
  });
}`
    },
    {
      name: 'Deploy on push to main',
      description: 'Trigger deployment when code is pushed to main branch',
      config: {
        triggers: ['push'],
        filters: {
          ref: 'refs/heads/main'
        }
      },
      code: `// Deploy on push to main
if (event.ref === 'refs/heads/main') {
  await deploy(event.repository.name);
}`
    }
  ],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
