// @ts-nocheck
/**
 * Action Registry - centralized registry of all available actions
 */

import type { Action, ActionType, ActionCategory } from '../types';

export class ActionRegistry {
  private actions: Map<ActionType, Action>;
  private actionsByCategory: Map<ActionCategory, Set<ActionType>>;

  constructor() {
    this.actions = new Map();
    this.actionsByCategory = new Map();
    this.registerDefaultActions();
  }

  /**
   * Register an action
   */
  public register(action: Action): void {
    this.actions.set(action.type, action);

    // Add to category index
    if (!this.actionsByCategory.has(action.category)) {
      this.actionsByCategory.set(action.category, new Set());
    }
    this.actionsByCategory.get(action.category)!.add(action.type);
  }

  /**
   * Get an action by type
   */
  public get(type: ActionType): Action | undefined {
    return this.actions.get(type);
  }

  /**
   * Check if an action exists
   */
  public has(type: ActionType): boolean {
    return this.actions.has(type);
  }

  /**
   * Get all actions
   */
  public getAll(): Action[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get actions by category
   */
  public getByCategory(category: ActionCategory): Action[] {
    const actionTypes = this.actionsByCategory.get(category) || new Set();
    const actions: Action[] = [];

    for (const type of actionTypes) {
      const action = this.actions.get(type);
      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Get all categories
   */
  public getCategories(): ActionCategory[] {
    return Array.from(this.actionsByCategory.keys());
  }

  /**
   * Search actions by name or description
   */
  public search(query: string): Action[] {
    const lowerQuery = query.toLowerCase();

    return this.getAll().filter(action =>
      action.name.toLowerCase().includes(lowerQuery) ||
      action.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Register all default actions
   */
  private registerDefaultActions(): void {
    // Code Actions
    this.register({
      id: 'action-generate-code',
      type: 'generate_code',
      name: 'Generate Code',
      description: 'Generate code using AI based on a prompt',
      category: 'code',
      inputs: [
        {
          name: 'prompt',
          type: 'string',
          required: true,
          description: 'The prompt describing what code to generate'
        },
        {
          name: 'language',
          type: 'string',
          required: true,
          description: 'The programming language',
          defaultValue: 'typescript'
        },
        {
          name: 'framework',
          type: 'string',
          required: false,
          description: 'The framework or library to use'
        }
      ],
      outputs: [
        {
          name: 'code',
          type: 'string',
          description: 'The generated code'
        },
        {
          name: 'language',
          type: 'string',
          description: 'The language of the generated code'
        }
      ],
      implementation: {
        type: 'service',
        service: 'ai',
        method: 'generateCode'
      }
    });

    this.register({
      id: 'action-review-code',
      type: 'review_code',
      name: 'Review Code',
      description: 'Review code for issues and improvements',
      category: 'code',
      inputs: [
        {
          name: 'code',
          type: 'string',
          required: true,
          description: 'The code to review'
        },
        {
          name: 'filePath',
          type: 'string',
          required: false,
          description: 'The file path for context'
        }
      ],
      outputs: [
        {
          name: 'issues',
          type: 'array',
          description: 'List of issues found'
        },
        {
          name: 'score',
          type: 'number',
          description: 'Code quality score (0-100)'
        },
        {
          name: 'suggestions',
          type: 'array',
          description: 'Improvement suggestions'
        }
      ],
      implementation: {
        type: 'service',
        service: 'ai',
        method: 'reviewCode'
      }
    });

    this.register({
      id: 'action-refactor-code',
      type: 'refactor_code',
      name: 'Refactor Code',
      description: 'Refactor code to improve quality',
      category: 'code',
      inputs: [
        {
          name: 'code',
          type: 'string',
          required: true,
          description: 'The code to refactor'
        },
        {
          name: 'refactorType',
          type: 'string',
          required: false,
          description: 'Type of refactoring to apply',
          defaultValue: 'general'
        }
      ],
      outputs: [
        {
          name: 'refactoredCode',
          type: 'string',
          description: 'The refactored code'
        },
        {
          name: 'changes',
          type: 'number',
          description: 'Number of changes made'
        }
      ],
      implementation: {
        type: 'service',
        service: 'ai',
        method: 'refactorCode'
      }
    });

    this.register({
      id: 'action-run-tests',
      type: 'run_tests',
      name: 'Run Tests',
      description: 'Run tests and collect results',
      category: 'code',
      inputs: [
        {
          name: 'testPath',
          type: 'string',
          required: true,
          description: 'Path to tests'
        },
        {
          name: 'framework',
          type: 'string',
          required: false,
          description: 'Testing framework',
          defaultValue: 'jest'
        }
      ],
      outputs: [
        {
          name: 'passed',
          type: 'number',
          description: 'Number of passed tests'
        },
        {
          name: 'failed',
          type: 'number',
          description: 'Number of failed tests'
        },
        {
          name: 'coverage',
          type: 'number',
          description: 'Code coverage percentage'
        }
      ],
      implementation: {
        type: 'service',
        service: 'testing',
        method: 'runTests'
      }
    });

    this.register({
      id: 'action-deploy-code',
      type: 'deploy_code',
      name: 'Deploy Code',
      description: 'Deploy code to an environment',
      category: 'code',
      inputs: [
        {
          name: 'environment',
          type: 'string',
          required: true,
          description: 'Target environment'
        },
        {
          name: 'branch',
          type: 'string',
          required: true,
          description: 'Git branch to deploy'
        }
      ],
      outputs: [
        {
          name: 'deploymentId',
          type: 'string',
          description: 'Deployment identifier'
        },
        {
          name: 'url',
          type: 'string',
          description: 'Deployment URL'
        }
      ],
      implementation: {
        type: 'service',
        service: 'deployment',
        method: 'deploy'
      }
    });

    // Communication Actions
    this.register({
      id: 'action-send-slack',
      type: 'send_slack',
      name: 'Send Slack Message',
      description: 'Send a message to a Slack channel',
      category: 'communication',
      inputs: [
        {
          name: 'channel',
          type: 'string',
          required: true,
          description: 'Slack channel ID or name'
        },
        {
          name: 'message',
          type: 'string',
          required: true,
          description: 'Message text'
        },
        {
          name: 'blocks',
          type: 'array',
          required: false,
          description: 'Slack blocks for formatted messages'
        }
      ],
      outputs: [
        {
          name: 'timestamp',
          type: 'string',
          description: 'Message timestamp'
        }
      ],
      implementation: {
        type: 'service',
        service: 'slack',
        method: 'sendMessage'
      }
    });

    this.register({
      id: 'action-send-email',
      type: 'send_email',
      name: 'Send Email',
      description: 'Send an email',
      category: 'communication',
      inputs: [
        {
          name: 'to',
          type: 'string',
          required: true,
          description: 'Recipient email address'
        },
        {
          name: 'subject',
          type: 'string',
          required: true,
          description: 'Email subject'
        },
        {
          name: 'body',
          type: 'string',
          required: true,
          description: 'Email body'
        },
        {
          name: 'attachments',
          type: 'array',
          required: false,
          description: 'Email attachments'
        }
      ],
      outputs: [
        {
          name: 'messageId',
          type: 'string',
          description: 'Email message ID'
        }
      ],
      implementation: {
        type: 'service',
        service: 'email',
        method: 'send'
      }
    });

    this.register({
      id: 'action-send-discord',
      type: 'send_discord',
      name: 'Send Discord Message',
      description: 'Send a message to a Discord channel via webhook',
      category: 'communication',
      inputs: [
        {
          name: 'webhookUrl',
          type: 'string',
          required: true,
          description: 'Discord webhook URL'
        },
        {
          name: 'content',
          type: 'string',
          required: true,
          description: 'Message content'
        },
        {
          name: 'embeds',
          type: 'array',
          required: false,
          description: 'Discord embeds'
        }
      ],
      outputs: [
        {
          name: 'messageId',
          type: 'string',
          description: 'Discord message ID'
        }
      ],
      implementation: {
        type: 'service',
        service: 'discord',
        method: 'sendWebhook'
      }
    });

    this.register({
      id: 'action-send-teams',
      type: 'send_teams',
      name: 'Send Teams Message',
      description: 'Send a message to Microsoft Teams',
      category: 'communication',
      inputs: [
        {
          name: 'webhookUrl',
          type: 'string',
          required: true,
          description: 'Teams webhook URL'
        },
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Message text'
        }
      ],
      outputs: [
        {
          name: 'messageId',
          type: 'string',
          description: 'Teams message ID'
        }
      ],
      implementation: {
        type: 'service',
        service: 'teams',
        method: 'sendWebhook'
      }
    });

    this.register({
      id: 'action-send-telegram',
      type: 'send_telegram',
      name: 'Send Telegram Message',
      description: 'Send a message via Telegram Bot API',
      category: 'communication',
      inputs: [
        {
          name: 'botToken',
          type: 'string',
          required: true,
          description: 'Telegram bot token'
        },
        {
          name: 'chatId',
          type: 'string',
          required: true,
          description: 'Chat ID to send to'
        },
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Message text'
        }
      ],
      outputs: [
        {
          name: 'messageId',
          type: 'string',
          description: 'Telegram message ID'
        }
      ],
      implementation: {
        type: 'service',
        service: 'telegram',
        method: 'sendMessage'
      }
    });

    // GitHub Actions
    this.register({
      id: 'action-create-issue',
      type: 'create_issue',
      name: 'Create GitHub Issue',
      description: 'Create a new GitHub issue',
      category: 'github',
      inputs: [
        {
          name: 'owner',
          type: 'string',
          required: true,
          description: 'Repository owner'
        },
        {
          name: 'repo',
          type: 'string',
          required: true,
          description: 'Repository name'
        },
        {
          name: 'title',
          type: 'string',
          required: true,
          description: 'Issue title'
        },
        {
          name: 'body',
          type: 'string',
          required: false,
          description: 'Issue body'
        },
        {
          name: 'labels',
          type: 'array',
          required: false,
          description: 'Issue labels'
        }
      ],
      outputs: [
        {
          name: 'issueNumber',
          type: 'number',
          description: 'Created issue number'
        },
        {
          name: 'url',
          type: 'string',
          description: 'Issue URL'
        }
      ],
      implementation: {
        type: 'service',
        service: 'github',
        method: 'createIssue'
      }
    });

    this.register({
      id: 'action-create-pr',
      type: 'create_pr',
      name: 'Create Pull Request',
      description: 'Create a new pull request',
      category: 'github',
      inputs: [
        {
          name: 'owner',
          type: 'string',
          required: true,
          description: 'Repository owner'
        },
        {
          name: 'repo',
          type: 'string',
          required: true,
          description: 'Repository name'
        },
        {
          name: 'head',
          type: 'string',
          required: true,
          description: 'Head branch'
        },
        {
          name: 'base',
          type: 'string',
          required: true,
          description: 'Base branch'
        },
        {
          name: 'title',
          type: 'string',
          required: true,
          description: 'PR title'
        },
        {
          name: 'body',
          type: 'string',
          required: false,
          description: 'PR body'
        }
      ],
      outputs: [
        {
          name: 'prNumber',
          type: 'number',
          description: 'Created PR number'
        },
        {
          name: 'url',
          type: 'string',
          description: 'PR URL'
        }
      ],
      implementation: {
        type: 'service',
        service: 'github',
        method: 'createPR'
      }
    });

    this.register({
      id: 'action-comment-pr',
      type: 'comment_pr',
      name: 'Comment on Pull Request',
      description: 'Add a comment to a pull request',
      category: 'github',
      inputs: [
        {
          name: 'owner',
          type: 'string',
          required: true,
          description: 'Repository owner'
        },
        {
          name: 'repo',
          type: 'string',
          required: true,
          description: 'Repository name'
        },
        {
          name: 'prNumber',
          type: 'number',
          required: true,
          description: 'PR number'
        },
        {
          name: 'body',
          type: 'string',
          required: true,
          description: 'Comment body'
        }
      ],
      outputs: [
        {
          name: 'commentId',
          type: 'string',
          description: 'Comment ID'
        }
      ],
      implementation: {
        type: 'service',
        service: 'github',
        method: 'commentPR'
      }
    });

    this.register({
      id: 'action-merge-pr',
      type: 'merge_pr',
      name: 'Merge Pull Request',
      description: 'Merge a pull request',
      category: 'github',
      inputs: [
        {
          name: 'owner',
          type: 'string',
          required: true,
          description: 'Repository owner'
        },
        {
          name: 'repo',
          type: 'string',
          required: true,
          description: 'Repository name'
        },
        {
          name: 'prNumber',
          type: 'number',
          required: true,
          description: 'PR number'
        },
        {
          name: 'mergeMethod',
          type: 'string',
          required: false,
          description: 'Merge method (merge, squash, rebase)',
          defaultValue: 'merge'
        }
      ],
      outputs: [
        {
          name: 'merged',
          type: 'boolean',
          description: 'Whether PR was merged'
        },
        {
          name: 'sha',
          type: 'string',
          description: 'Merge commit SHA'
        }
      ],
      implementation: {
        type: 'service',
        service: 'github',
        method: 'mergePR'
      }
    });

    this.register({
      id: 'action-update-status',
      type: 'update_status',
      name: 'Update Commit Status',
      description: 'Update status check for a commit',
      category: 'github',
      inputs: [
        {
          name: 'owner',
          type: 'string',
          required: true,
          description: 'Repository owner'
        },
        {
          name: 'repo',
          type: 'string',
          required: true,
          description: 'Repository name'
        },
        {
          name: 'sha',
          type: 'string',
          required: true,
          description: 'Commit SHA'
        },
        {
          name: 'state',
          type: 'string',
          required: true,
          description: 'Status state (pending, success, error, failure)'
        },
        {
          name: 'description',
          type: 'string',
          required: false,
          description: 'Status description'
        },
        {
          name: 'context',
          type: 'string',
          required: false,
          description: 'Status context'
        }
      ],
      outputs: [
        {
          name: 'state',
          type: 'string',
          description: 'Updated state'
        }
      ],
      implementation: {
        type: 'service',
        service: 'github',
        method: 'updateStatus'
      }
    });

    this.register({
      id: 'action-close-issue',
      type: 'close_issue',
      name: 'Close GitHub Issue',
      description: 'Close a GitHub issue',
      category: 'github',
      inputs: [
        {
          name: 'owner',
          type: 'string',
          required: true,
          description: 'Repository owner'
        },
        {
          name: 'repo',
          type: 'string',
          required: true,
          description: 'Repository name'
        },
        {
          name: 'issueNumber',
          type: 'number',
          required: true,
          description: 'Issue number'
        }
      ],
      outputs: [
        {
          name: 'closed',
          type: 'boolean',
          description: 'Whether issue was closed'
        }
      ],
      implementation: {
        type: 'service',
        service: 'github',
        method: 'closeIssue'
      }
    });

    this.register({
      id: 'action-fork-repo',
      type: 'fork_repo',
      name: 'Fork Repository',
      description: 'Fork a GitHub repository',
      category: 'github',
      inputs: [
        {
          name: 'owner',
          type: 'string',
          required: true,
          description: 'Repository owner'
        },
        {
          name: 'repo',
          type: 'string',
          required: true,
          description: 'Repository name'
        }
      ],
      outputs: [
        {
          name: 'forkName',
          type: 'string',
          description: 'Fork repository name'
        },
        {
          name: 'url',
          type: 'string',
          description: 'Fork URL'
        }
      ],
      implementation: {
        type: 'service',
        service: 'github',
        method: 'forkRepo'
      }
    });

    // AI Actions
    this.register({
      id: 'action-chat-completion',
      type: 'chat_completion',
      name: 'Chat Completion',
      description: 'Get AI chat completion',
      category: 'ai',
      inputs: [
        {
          name: 'messages',
          type: 'array',
          required: true,
          description: 'Chat messages'
        },
        {
          name: 'model',
          type: 'string',
          required: false,
          description: 'AI model to use',
          defaultValue: 'claude-3'
        },
        {
          name: 'temperature',
          type: 'number',
          required: false,
          description: 'Sampling temperature',
          defaultValue: 0.7
        }
      ],
      outputs: [
        {
          name: 'message',
          type: 'string',
          description: 'AI response message'
        },
        {
          name: 'usage',
          type: 'object',
          description: 'Token usage'
        }
      ],
      implementation: {
        type: 'service',
        service: 'ai',
        method: 'chatCompletion'
      }
    });

    this.register({
      id: 'action-code-generation',
      type: 'code_generation',
      name: 'Generate Code with AI',
      description: 'Generate code using AI',
      category: 'ai',
      inputs: [
        {
          name: 'prompt',
          type: 'string',
          required: true,
          description: 'Code generation prompt'
        },
        {
          name: 'language',
          type: 'string',
          required: true,
          description: 'Programming language'
        }
      ],
      outputs: [
        {
          name: 'code',
          type: 'string',
          description: 'Generated code'
        }
      ],
      implementation: {
        type: 'service',
        service: 'ai',
        method: 'generateCode'
      }
    });

    this.register({
      id: 'action-summarization',
      type: 'summarization',
      name: 'Summarize Text',
      description: 'Summarize text using AI',
      category: 'ai',
      inputs: [
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Text to summarize'
        },
        {
          name: 'maxLength',
          type: 'number',
          required: false,
          description: 'Maximum summary length'
        }
      ],
      outputs: [
        {
          name: 'summary',
          type: 'string',
          description: 'Text summary'
        }
      ],
      implementation: {
        type: 'service',
        service: 'ai',
        method: 'summarize'
      }
    });

    this.register({
      id: 'action-translation',
      type: 'translation',
      name: 'Translate Text',
      description: 'Translate text using AI',
      category: 'ai',
      inputs: [
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Text to translate'
        },
        {
          name: 'from',
          type: 'string',
          required: false,
          description: 'Source language'
        },
        {
          name: 'to',
          type: 'string',
          required: true,
          description: 'Target language'
        }
      ],
      outputs: [
        {
          name: 'translated',
          type: 'string',
          description: 'Translated text'
        }
      ],
      implementation: {
        type: 'service',
        service: 'ai',
        method: 'translate'
      }
    });

    this.register({
      id: 'action-sentiment-analysis',
      type: 'sentiment_analysis',
      name: 'Analyze Sentiment',
      description: 'Analyze text sentiment',
      category: 'ai',
      inputs: [
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Text to analyze'
        }
      ],
      outputs: [
        {
          name: 'sentiment',
          type: 'string',
          description: 'Sentiment (positive, negative, neutral)'
        },
        {
          name: 'confidence',
          type: 'number',
          description: 'Confidence score'
        }
      ],
      implementation: {
        type: 'service',
        service: 'ai',
        method: 'analyzeSentiment'
      }
    });

    // Data Actions
    this.register({
      id: 'action-fetch-data',
      type: 'fetch_data',
      name: 'Fetch Data',
      description: 'Fetch data from a URL',
      category: 'data',
      inputs: [
        {
          name: 'url',
          type: 'string',
          required: true,
          description: 'URL to fetch from'
        },
        {
          name: 'method',
          type: 'string',
          required: false,
          description: 'HTTP method',
          defaultValue: 'GET'
        },
        {
          name: 'headers',
          type: 'object',
          required: false,
          description: 'HTTP headers'
        }
      ],
      outputs: [
        {
          name: 'data',
          type: 'object',
          description: 'Fetched data'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'fetchData'
      }
    });

    this.register({
      id: 'action-transform-data',
      type: 'transform_data',
      name: 'Transform Data',
      description: 'Transform data structure',
      category: 'data',
      inputs: [
        {
          name: 'data',
          type: 'object',
          required: true,
          description: 'Data to transform'
        },
        {
          name: 'transformation',
          type: 'string',
          required: true,
          description: 'Transformation to apply'
        }
      ],
      outputs: [
        {
          name: 'transformed',
          type: 'object',
          description: 'Transformed data'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'transformData'
      }
    });

    this.register({
      id: 'action-filter-data',
      type: 'filter_data',
      name: 'Filter Data',
      description: 'Filter data based on criteria',
      category: 'data',
      inputs: [
        {
          name: 'data',
          type: 'array',
          required: true,
          description: 'Data to filter'
        },
        {
          name: 'filters',
          type: 'object',
          required: true,
          description: 'Filter criteria'
        }
      ],
      outputs: [
        {
          name: 'filtered',
          type: 'array',
          description: 'Filtered data'
        },
        {
          name: 'count',
          type: 'number',
          description: 'Number of items'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'filterData'
      }
    });

    this.register({
      id: 'action-aggregate-data',
      type: 'aggregate_data',
      name: 'Aggregate Data',
      description: 'Aggregate data with operations',
      category: 'data',
      inputs: [
        {
          name: 'data',
          type: 'array',
          required: true,
          description: 'Data to aggregate'
        },
        {
          name: 'operations',
          type: 'array',
          required: true,
          description: 'Aggregation operations'
        }
      ],
      outputs: [
        {
          name: 'count',
          type: 'number',
          description: 'Item count'
        },
        {
          name: 'sum',
          type: 'number',
          description: 'Sum of values'
        },
        {
          name: 'avg',
          type: 'number',
          description: 'Average of values'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'aggregateData'
      }
    });

    this.register({
      id: 'action-store-data',
      type: 'store_data',
      name: 'Store Data',
      description: 'Store data in storage',
      category: 'data',
      inputs: [
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'Storage key'
        },
        {
          name: 'value',
          type: 'object',
          required: true,
          description: 'Data to store'
        },
        {
          name: 'ttl',
          type: 'number',
          required: false,
          description: 'Time to live in seconds'
        }
      ],
      outputs: [
        {
          name: 'stored',
          type: 'boolean',
          description: 'Whether data was stored'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'storeData'
      }
    });

    // Storage Actions
    this.register({
      id: 'action-kv-get',
      type: 'kv_get',
      name: 'KV Get',
      description: 'Get value from KV store',
      category: 'storage',
      inputs: [
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'KV key'
        }
      ],
      outputs: [
        {
          name: 'value',
          type: 'string',
          description: 'KV value'
        }
      ],
      implementation: {
        type: 'service',
        service: 'kv',
        method: 'get'
      }
    });

    this.register({
      id: 'action-kv-set',
      type: 'kv_set',
      name: 'KV Set',
      description: 'Set value in KV store',
      category: 'storage',
      inputs: [
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'KV key'
        },
        {
          name: 'value',
          type: 'string',
          required: true,
          description: 'KV value'
        },
        {
          name: 'ttl',
          type: 'number',
          required: false,
          description: 'Time to live'
        }
      ],
      outputs: [],
      implementation: {
        type: 'service',
        service: 'kv',
        method: 'set'
      }
    });

    this.register({
      id: 'action-kv-delete',
      type: 'kv_delete',
      name: 'KV Delete',
      description: 'Delete value from KV store',
      category: 'storage',
      inputs: [
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'KV key'
        }
      ],
      outputs: [],
      implementation: {
        type: 'service',
        service: 'kv',
        method: 'delete'
      }
    });

    this.register({
      id: 'action-r2-upload',
      type: 'r2_upload',
      name: 'R2 Upload',
      description: 'Upload file to R2',
      category: 'storage',
      inputs: [
        {
          name: 'bucket',
          type: 'string',
          required: true,
          description: 'R2 bucket name'
        },
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'Object key'
        },
        {
          name: 'data',
          type: 'string',
          required: true,
          description: 'File data'
        }
      ],
      outputs: [
        {
          name: 'size',
          type: 'number',
          description: 'File size'
        }
      ],
      implementation: {
        type: 'service',
        service: 'r2',
        method: 'upload'
      }
    });

    this.register({
      id: 'action-r2-download',
      type: 'r2_download',
      name: 'R2 Download',
      description: 'Download file from R2',
      category: 'storage',
      inputs: [
        {
          name: 'bucket',
          type: 'string',
          required: true,
          description: 'R2 bucket name'
        },
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'Object key'
        }
      ],
      outputs: [
        {
          name: 'data',
          type: 'string',
          description: 'File data'
        }
      ],
      implementation: {
        type: 'service',
        service: 'r2',
        method: 'download'
      }
    });

    this.register({
      id: 'action-d1-query',
      type: 'd1_query',
      name: 'D1 Query',
      description: 'Execute D1 database query',
      category: 'storage',
      inputs: [
        {
          name: 'database',
          type: 'string',
          required: true,
          description: 'D1 database name'
        },
        {
          name: 'query',
          type: 'string',
          required: true,
          description: 'SQL query'
        },
        {
          name: 'params',
          type: 'array',
          required: false,
          description: 'Query parameters'
        }
      ],
      outputs: [
        {
          name: 'rows',
          type: 'array',
          description: 'Query results'
        },
        {
          name: 'affectedRows',
          type: 'number',
          description: 'Affected rows'
        }
      ],
      implementation: {
        type: 'service',
        service: 'd1',
        method: 'query'
      }
    });

    // HTTP Actions
    this.register({
      id: 'action-http-get',
      type: 'http_get',
      name: 'HTTP GET',
      description: 'Make HTTP GET request',
      category: 'http',
      inputs: [
        {
          name: 'url',
          type: 'string',
          required: true,
          description: 'Request URL'
        },
        {
          name: 'headers',
          type: 'object',
          required: false,
          description: 'Request headers'
        }
      ],
      outputs: [
        {
          name: 'status',
          type: 'number',
          description: 'HTTP status code'
        },
        {
          name: 'data',
          type: 'object',
          description: 'Response data'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'httpGet'
      }
    });

    this.register({
      id: 'action-http-post',
      type: 'http_post',
      name: 'HTTP POST',
      description: 'Make HTTP POST request',
      category: 'http',
      inputs: [
        {
          name: 'url',
          type: 'string',
          required: true,
          description: 'Request URL'
        },
        {
          name: 'body',
          type: 'object',
          required: true,
          description: 'Request body'
        },
        {
          name: 'headers',
          type: 'object',
          required: false,
          description: 'Request headers'
        }
      ],
      outputs: [
        {
          name: 'status',
          type: 'number',
          description: 'HTTP status code'
        },
        {
          name: 'data',
          type: 'object',
          description: 'Response data'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'httpPost'
      }
    });

    this.register({
      id: 'action-http-put',
      type: 'http_put',
      name: 'HTTP PUT',
      description: 'Make HTTP PUT request',
      category: 'http',
      inputs: [
        {
          name: 'url',
          type: 'string',
          required: true,
          description: 'Request URL'
        },
        {
          name: 'body',
          type: 'object',
          required: true,
          description: 'Request body'
        },
        {
          name: 'headers',
          type: 'object',
          required: false,
          description: 'Request headers'
        }
      ],
      outputs: [
        {
          name: 'status',
          type: 'number',
          description: 'HTTP status code'
        },
        {
          name: 'data',
          type: 'object',
          description: 'Response data'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'httpPut'
      }
    });

    this.register({
      id: 'action-http-delete',
      type: 'http_delete',
      name: 'HTTP DELETE',
      description: 'Make HTTP DELETE request',
      category: 'http',
      inputs: [
        {
          name: 'url',
          type: 'string',
          required: true,
          description: 'Request URL'
        },
        {
          name: 'headers',
          type: 'object',
          required: false,
          description: 'Request headers'
        }
      ],
      outputs: [
        {
          name: 'status',
          type: 'number',
          description: 'HTTP status code'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'httpDelete'
      }
    });

    this.register({
      id: 'action-http-patch',
      type: 'http_patch',
      name: 'HTTP PATCH',
      description: 'Make HTTP PATCH request',
      category: 'http',
      inputs: [
        {
          name: 'url',
          type: 'string',
          required: true,
          description: 'Request URL'
        },
        {
          name: 'body',
          type: 'object',
          required: true,
          description: 'Request body'
        },
        {
          name: 'headers',
          type: 'object',
          required: false,
          description: 'Request headers'
        }
      ],
      outputs: [
        {
          name: 'status',
          type: 'number',
          description: 'HTTP status code'
        },
        {
          name: 'data',
          type: 'object',
          description: 'Response data'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'httpPatch'
      }
    });

    // Logic Actions
    this.register({
      id: 'action-condition',
      type: 'condition',
      name: 'Condition',
      description: 'Evaluate conditions and branch',
      category: 'logic',
      inputs: [
        {
          name: 'conditions',
          type: 'array',
          required: true,
          description: 'Conditions to evaluate'
        }
      ],
      outputs: [
        {
          name: 'result',
          type: 'boolean',
          description: 'Condition result'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'condition'
      }
    });

    this.register({
      id: 'action-loop',
      type: 'loop',
      name: 'Loop',
      description: 'Loop over items',
      category: 'logic',
      inputs: [
        {
          name: 'iterable',
          type: 'array',
          required: true,
          description: 'Items to loop over'
        },
        {
          name: 'type',
          type: 'string',
          required: true,
          description: 'Loop type'
        }
      ],
      outputs: [
        {
          name: 'results',
          type: 'array',
          description: 'Loop results'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'loop'
      }
    });

    this.register({
      id: 'action-parallel',
      type: 'parallel',
      name: 'Parallel',
      description: 'Execute branches in parallel',
      category: 'logic',
      inputs: [
        {
          name: 'branches',
          type: 'array',
          required: true,
          description: 'Branches to execute'
        }
      ],
      outputs: [
        {
          name: 'results',
          type: 'array',
          description: 'Branch results'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'parallel'
      }
    });

    this.register({
      id: 'action-wait',
      type: 'wait',
      name: 'Wait',
      description: 'Wait for a specified time',
      category: 'logic',
      inputs: [
        {
          name: 'duration',
          type: 'number',
          required: true,
          description: 'Wait duration in milliseconds'
        }
      ],
      outputs: [
        {
          name: 'waited',
          type: 'number',
          description: 'Time waited'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'wait'
      }
    });

    // Utility Actions
    this.register({
      id: 'action-log',
      type: 'log',
      name: 'Log',
      description: 'Log a message',
      category: 'utility',
      inputs: [
        {
          name: 'level',
          type: 'string',
          required: true,
          description: 'Log level (debug, info, warn, error)'
        },
        {
          name: 'message',
          type: 'string',
          required: true,
          description: 'Message to log'
        }
      ],
      outputs: [],
      implementation: {
        type: 'inline',
        handler: 'log'
      }
    });

    this.register({
      id: 'action-notify',
      type: 'notify',
      name: 'Notify',
      description: 'Send notification',
      category: 'utility',
      inputs: [
        {
          name: 'channels',
          type: 'array',
          required: true,
          description: 'Notification channels'
        },
        {
          name: 'message',
          type: 'string',
          required: true,
          description: 'Notification message'
        }
      ],
      outputs: [],
      implementation: {
        type: 'inline',
        handler: 'notify'
      }
    });

    this.register({
      id: 'action-metric',
      type: 'metric',
      name: 'Metric',
      description: 'Record a metric',
      category: 'utility',
      inputs: [
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Metric name'
        },
        {
          name: 'value',
          type: 'number',
          required: true,
          description: 'Metric value'
        },
        {
          name: 'tags',
          type: 'object',
          required: false,
          description: 'Metric tags'
        }
      ],
      outputs: [],
      implementation: {
        type: 'inline',
        handler: 'metric'
      }
    });

    this.register({
      id: 'action-validate',
      type: 'validate',
      name: 'Validate',
      description: 'Validate data against schema',
      category: 'utility',
      inputs: [
        {
          name: 'data',
          type: 'object',
          required: true,
          description: 'Data to validate'
        },
        {
          name: 'schema',
          type: 'object',
          required: true,
          description: 'Validation schema'
        }
      ],
      outputs: [
        {
          name: 'valid',
          type: 'boolean',
          description: 'Whether data is valid'
        },
        {
          name: 'errors',
          type: 'array',
          description: 'Validation errors'
        }
      ],
      implementation: {
        type: 'inline',
        handler: 'validate'
      }
    });
  }

  /**
   * Get registry statistics
   */
  public getStats(): {
    totalActions: number;
    actionsByCategory: Record<string, number>;
    categories: string[];
  } {
    const actionsByCategory: Record<string, number> = {};

    for (const [category, actionTypes] of this.actionsByCategory) {
      actionsByCategory[category] = actionTypes.size;
    }

    return {
      totalActions: this.actions.size,
      actionsByCategory,
      categories: Array.from(this.actionsByCategory.keys())
    };
  }
}
