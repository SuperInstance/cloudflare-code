/**
 * Slack Integration Template
 * Provides pre-built integration with Slack
 */

import { IntegrationTemplate, IntegrationCategory } from '../types';

export const slackTemplate: IntegrationTemplate = {
  id: 'slack',
  partnerId: 'slack',
  name: 'Slack',
  description: 'Integrate with Slack for team communication, notifications, and workflows',
  category: 'communication' as IntegrationCategory,
  version: '1.0.0',
  author: 'ClaudeFlare',
  documentation: 'https://api.slack.com/docs',
  authConfig: ['oauth2'],
  webhookEvents: [
    'message',
    'app_mention',
    'reaction_added',
    'channel_created',
    'team_join',
    'link_shared',
    'app_home_opened'
  ],
  actions: [
    {
      id: 'send-message',
      name: 'Send Message',
      description: 'Send a message to a channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel: {
            type: 'string',
            description: 'Channel ID or name (e.g., #general)'
          },
          text: {
            type: 'string',
            description: 'Message text'
          },
          blocks: {
            type: 'array',
            description: 'Layout blocks'
          },
          thread_ts: {
            type: 'string',
            description: 'Thread parent timestamp'
          }
        },
        required: ['channel', 'text']
      },
      outputSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          channel: { type: 'string' },
          ts: { type: 'string' },
          message: { type: 'object' }
        }
      },
      endpoint: '/chat.postMessage',
      method: 'POST',
      requiredScopes: ['chat:write']
    },
    {
      id: 'send-ephemeral',
      name: 'Send Ephemeral Message',
      description: 'Send ephemeral message visible to specific user',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          user: { type: 'string' },
          text: { type: 'string' },
          attachments: { type: 'array' }
        },
        required: ['channel', 'user', 'text']
      },
      outputSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message_ts: { type: 'string' }
        }
      },
      endpoint: '/chat.postEphemeral',
      method: 'POST',
      requiredScopes: ['chat:write']
    },
    {
      id: 'update-message',
      name: 'Update Message',
      description: 'Update an existing message',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          ts: { type: 'string' },
          text: { type: 'string' },
          blocks: { type: 'array' }
        },
        required: ['channel', 'ts', 'text']
      },
      outputSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          channel: { type: 'string' },
          ts: { type: 'string' },
          message: { type: 'object' }
        }
      },
      endpoint: '/chat.update',
      method: 'POST',
      requiredScopes: ['chat:write']
    },
    {
      id: 'add-reaction',
      name: 'Add Reaction',
      description: 'Add emoji reaction to message',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          timestamp: { type: 'string' },
          name: { type: 'string' }
        },
        required: ['channel', 'timestamp', 'name']
      },
      outputSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' }
        }
      },
      endpoint: '/reactions.add',
      method: 'POST',
      requiredScopes: ['reactions:write']
    },
    {
      id: 'create-channel',
      name: 'Create Channel',
      description: 'Create a new channel',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          is_private: { type: 'boolean' }
        },
        required: ['name']
      },
      outputSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          channel: { type: 'object' }
        }
      },
      endpoint: '/conversations.create',
      method: 'POST',
      requiredScopes: ['channels:manage']
    },
    {
      id: 'invite-user',
      name: 'Invite to Channel',
      description: 'Invite user to channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          users: { type: 'string' }
        },
        required: ['channel', 'users']
      },
      outputSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          channel: { type: 'string' }
        }
      },
      endpoint: '/conversations.invite',
      method: 'POST',
      requiredScopes: ['channels:manage']
    },
    {
      id: 'open-modal',
      name: 'Open Modal',
      description: 'Open a modal for user interaction',
      inputSchema: {
        type: 'object',
        properties: {
          trigger_id: { type: 'string' },
          view: {
            type: 'object',
            description: 'Modal view payload'
          }
        },
        required: ['trigger_id', 'view']
      },
      outputSchema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          view: { type: 'object' }
        }
      },
      endpoint: '/views.open',
      method: 'POST',
      requiredScopes: ['none']
    }
  ],
  triggers: [
    {
      id: 'message',
      name: 'Message Event',
      description: 'Triggered when message is posted',
      eventType: 'message',
      filterSchema: {
        type: 'object',
        properties: {
          subtype: { type: 'string' }
        }
      },
      requiredScopes: ['channels:history', 'groups:history', 'im:history', 'mpim:history']
    },
    {
      id: 'app_mention',
      name: 'App Mention',
      description: 'Triggered when app is mentioned',
      eventType: 'app_mention',
      requiredScopes: ['channels:history', 'groups:history', 'im:history', 'mpim:history']
    },
    {
      id: 'slash-command',
      name: 'Slash Command',
      description: 'Triggered by slash command',
      eventType: 'slash_command',
      requiredScopes: ['commands']
    },
    {
      id: 'interaction',
      name: 'Interaction',
      description: 'Triggered by button/menu interaction',
      eventType: 'interaction',
      requiredScopes: ['none']
    }
  ],
  configuration: [
    {
      key: 'bot_user_id',
      type: 'string',
      label: 'Bot User ID',
      description: 'Bot user ID for the app',
      required: true
    },
    {
      key: 'bot_access_token',
      type: 'textarea',
      label: 'Bot Access Token',
      description: 'Bot user OAuth access token',
      required: true,
      sensitive: true
    },
    {
      key: 'signing_secret',
      type: 'string',
      label: 'Signing Secret',
      description: 'Used to verify requests from Slack',
      required: true,
      sensitive: true
    },
    {
      key: 'default_channel',
      type: 'string',
      label: 'Default Channel',
      description: 'Default channel for notifications',
      required: false
    }
  ],
  permissions: [
    {
      scope: 'chat:write',
      description: 'Send messages',
      required: true
    },
    {
      scope: 'channels:history',
      description: 'Read channel history',
      required: true
    },
    {
      scope: 'channels:read',
      description: 'Read channel information',
      required: true
    },
    {
      scope: 'reactions:write',
      description: 'Add reactions',
      required: false
    },
    {
      scope: 'files:write',
      description: 'Upload files',
      required: false
    },
    {
      scope: 'incoming-webhook',
      description: 'Incoming webhooks',
      required: false
    }
  ],
  examples: [
    {
      name: 'Send notification on deployment',
      description: 'Notify channel when deployment completes',
      config: {
        actions: ['send-message'],
        channel: '#deployments'
      },
      code: `await integrations.slack.sendMessage({
  channel: '#deployments',
  text: 'Deployed successfully! 🚀',
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Deployed successfully! 🚀\\n*Environment:* Production\\n*Version:* v1.2.3'
      }
    }
  ]
});`
    },
    {
      name: 'Create issue from Slack',
      description: 'Create GitHub issue from Slack message',
      config: {
        triggers: ['app_mention']
      },
      code: `if (event.text.includes('create issue')) {
  const issue = await integrations.github.createIssue({
    owner: 'myorg',
    repo: 'myrepo',
    title: 'Issue from Slack',
    body: event.text
  });

  await integrations.slack.sendMessage({
    channel: event.channel,
    text: \`Created issue: \${issue.html_url}\`
  });
}`
    }
  ],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date()
};
