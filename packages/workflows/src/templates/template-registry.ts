/**
 * Workflow Template Registry
 */

import type { Template, TemplateCategory, Workflow } from '../types';

export class TemplateRegistry {
  private templates: Map<string, Template>;

  constructor() {
    this.templates = new Map();
    this.registerDefaultTemplates();
  }

  /**
   * Register a template
   */
  public register(template: Template): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get a template by ID
   */
  public get(id: string): Template | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  public getAll(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  public getByCategory(category: TemplateCategory): Template[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Search templates
   */
  public search(query: string): Template[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  }

  /**
   * Create a workflow from a template
   */
  public createFromTemplate(
    templateId: string,
    parameters: Record<string, any>
  ): Workflow {
    const template = this.get(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate parameters
    this.validateParameters(template, parameters);

    // Apply parameters to workflow
    const workflow = this.applyParameters(template, parameters);

    return workflow;
  }

  /**
   * Validate template parameters
   */
  private validateParameters(
    template: Template,
    parameters: Record<string, any>
  ): void {
    const errors: string[] = [];

    for (const param of template.parameters) {
      if (param.required && !(param.name in parameters)) {
        errors.push(`Required parameter missing: ${param.name}`);
      }

      if (param.name in parameters) {
        const value = parameters[param.name];

        // Type validation
        if (param.type === 'string' && typeof value !== 'string') {
          errors.push(`Parameter ${param.name} must be a string`);
        }

        if (param.type === 'number' && typeof value !== 'number') {
          errors.push(`Parameter ${param.name} must be a number`);
        }

        if (param.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Parameter ${param.name} must be a boolean`);
        }

        if (param.type === 'array' && !Array.isArray(value)) {
          errors.push(`Parameter ${param.name} must be an array`);
        }

        if (param.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
          errors.push(`Parameter ${param.name} must be an object`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Parameter validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Apply parameters to workflow
   */
  private applyParameters(
    template: Template,
    parameters: Record<string, any>
  ): Workflow {
    const workflow: Workflow = {
      ...template.workflow,
      id: `workflow-${Date.now()}`,
      name: this.replacePlaceholders(template.workflow.name, parameters),
      description: this.replacePlaceholders(template.workflow.description, parameters),
      version: 1,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Apply parameters to nodes
    workflow.nodes = workflow.nodes.map(node => ({
      ...node,
      name: this.replacePlaceholders(node.name, parameters),
      description: this.replacePlaceholders(node.description || '', parameters),
      config: this.applyParametersToConfig(node.config, parameters)
    }));

    // Apply parameters to variables
    workflow.variables = workflow.variables.map(variable => ({
      ...variable,
      value: this.applyParameterValue(variable.value, parameters)
    }));

    return workflow;
  }

  /**
   * Replace placeholders in a string
   */
  private replacePlaceholders(
    text: string,
    parameters: Record<string, any>
  ): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return parameters[key] !== undefined ? String(parameters[key]) : match;
    });
  }

  /**
   * Apply parameters to node config
   */
  private applyParametersToConfig(
    config: any,
    parameters: Record<string, any>
  ): any {
    if (typeof config === 'string') {
      return this.replacePlaceholders(config, parameters);
    }

    if (Array.isArray(config)) {
      return config.map(item => this.applyParametersToConfig(item, parameters));
    }

    if (typeof config === 'object' && config !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(config)) {
        result[key] = this.applyParametersToConfig(value, parameters);
      }
      return result;
    }

    return config;
  }

  /**
   * Apply parameter value
   */
  private applyParameterValue(value: any, parameters: Record<string, any>): any {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const key = value.slice(2, -2);
      return parameters[key];
    }

    return value;
  }

  /**
   * Get template categories
   */
  public getCategories(): TemplateCategory[] {
    const categories = new Set<TemplateCategory>();

    for (const template of this.templates.values()) {
      categories.add(template.category);
    }

    return Array.from(categories);
  }

  /**
   * Get template statistics
   */
  public getStats(): {
    totalTemplates: number;
    templatesByCategory: Record<string, number>;
  } {
    const templatesByCategory: Record<string, number> = {};

    for (const template of this.templates.values()) {
      templatesByCategory[template.category] =
        (templatesByCategory[template.category] || 0) + 1;
    }

    return {
      totalTemplates: this.templates.size,
      templatesByCategory
    };
  }

  /**
   * Register default templates
   */
  private registerDefaultTemplates(): void {
    // Development Templates
    this.register({
      id: 'template-pr-workflow',
      name: 'Pull Request Workflow',
      description: 'Automated PR review and testing workflow',
      category: 'development',
      parameters: [
        {
          name: 'repoOwner',
          type: 'string',
          required: true,
          description: 'Repository owner'
        },
        {
          name: 'repoName',
          type: 'string',
          required: true,
          description: 'Repository name'
        },
        {
          name: 'testFramework',
          type: 'string',
          required: false,
          description: 'Testing framework',
          defaultValue: 'jest'
        }
      ],
      workflow: {
        id: 'template-pr-workflow',
        name: '{{repoOwner}}/{{repoName}} PR Workflow',
        description: 'Automated workflow for pull requests',
        version: 1,
        status: 'draft',
        nodes: [
          {
            id: 'trigger-pr',
            type: 'trigger',
            name: 'PR Created',
            description: 'Triggered when PR is created',
            position: { x: 100, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'review-code',
            type: 'action',
            actionType: 'review_code',
            name: 'Review Code',
            description: 'AI code review',
            position: { x: 300, y: 100 },
            config: {
              parameters: {
                filePath: 'src/index.ts'
              }
            },
            enabled: true
          },
          {
            id: 'run-tests',
            type: 'action',
            actionType: 'run_tests',
            name: 'Run Tests',
            description: 'Execute test suite',
            position: { x: 500, y: 100 },
            config: {
              parameters: {
                framework: '{{testFramework}}',
                testPath: 'tests/'
              }
            },
            enabled: true
          },
          {
            id: 'comment-pr',
            type: 'action',
            actionType: 'comment_pr',
            name: 'Comment Results',
            description: 'Post results to PR',
            position: { x: 700, y: 100 },
            config: {
              parameters: {
                owner: '{{repoOwner}}',
                repo: '{{repoName}}'
              }
            },
            enabled: true
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'trigger-pr',
            targetNodeId: 'review-code'
          },
          {
            id: 'conn-2',
            sourceNodeId: 'review-code',
            targetNodeId: 'run-tests'
          },
          {
            id: 'conn-3',
            sourceNodeId: 'run-tests',
            targetNodeId: 'comment-pr'
          }
        ],
        triggers: [],
        variables: [],
        settings: {
          logLevel: 'info',
          enableMetrics: true,
          enableTracing: false
        },
        metadata: {
          category: 'development'
        }
      },
      documentation: '# Pull Request Workflow\n\nThis workflow automatically reviews and tests pull requests.',
      tags: ['github', 'pr', 'testing', 'review'],
      icon: 'pr',
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.register({
      id: 'template-deployment',
      name: 'Deployment Pipeline',
      description: 'Complete deployment pipeline with testing',
      category: 'development',
      parameters: [
        {
          name: 'environment',
          type: 'string',
          required: true,
          description: 'Deployment environment'
        },
        {
          name: 'branch',
          type: 'string',
          required: true,
          description: 'Git branch to deploy'
        },
        {
          name: 'notifyChannel',
          type: 'string',
          required: false,
          description: 'Slack channel for notifications'
        }
      ],
      workflow: {
        id: 'template-deployment',
        name: '{{environment}} Deployment',
        description: 'Deploy to {{environment}} environment',
        version: 1,
        status: 'draft',
        nodes: [
          {
            id: 'trigger-deploy',
            type: 'trigger',
            name: 'Deploy Trigger',
            description: 'Manual or scheduled deployment',
            position: { x: 100, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'run-tests',
            type: 'action',
            actionType: 'run_tests',
            name: 'Run Tests',
            description: 'Run test suite',
            position: { x: 300, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'deploy',
            type: 'action',
            actionType: 'deploy_code',
            name: 'Deploy',
            description: 'Deploy code',
            position: { x: 500, y: 100 },
            config: {
              parameters: {
                environment: '{{environment}}',
                branch: '{{branch}}'
              }
            },
            enabled: true
          },
          {
            id: 'notify',
            type: 'action',
            actionType: 'send_slack',
            name: 'Notify',
            description: 'Send notification',
            position: { x: 700, y: 100 },
            config: {
              parameters: {
                channel: '{{notifyChannel}}',
                message: 'Deployment to {{environment}} completed'
              }
            },
            enabled: true
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'trigger-deploy',
            targetNodeId: 'run-tests'
          },
          {
            id: 'conn-2',
            sourceNodeId: 'run-tests',
            targetNodeId: 'deploy'
          },
          {
            id: 'conn-3',
            sourceNodeId: 'deploy',
            targetNodeId: 'notify'
          }
        ],
        triggers: [],
        variables: [],
        settings: {
          logLevel: 'info',
          enableMetrics: true,
          enableTracing: false
        },
        metadata: {}
      },
      documentation: '# Deployment Pipeline\n\nAutomated deployment pipeline with testing and notifications.',
      tags: ['deployment', 'devops', 'ci-cd'],
      icon: 'deploy',
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Monitoring Templates
    this.register({
      id: 'template-error-monitoring',
      name: 'Error Monitoring',
      description: 'Monitor and alert on errors',
      category: 'monitoring',
      parameters: [
        {
          name: 'alertEmail',
          type: 'string',
          required: true,
          description: 'Email for alerts'
        },
        {
          name: 'slackChannel',
          type: 'string',
          required: false,
          description: 'Slack channel for alerts'
        }
      ],
      workflow: {
        id: 'template-error-monitoring',
        name: 'Error Monitoring',
        description: 'Monitor application errors',
        version: 1,
        status: 'draft',
        nodes: [
          {
            id: 'trigger-error',
            type: 'trigger',
            name: 'Error Event',
            description: 'Triggered on error',
            position: { x: 100, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'analyze',
            type: 'action',
            actionType: 'summarization',
            name: 'Analyze Error',
            description: 'Analyze error with AI',
            position: { x: 300, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'send-email',
            type: 'action',
            actionType: 'send_email',
            name: 'Send Alert Email',
            description: 'Email alert',
            position: { x: 500, y: 50 },
            config: {
              parameters: {
                to: '{{alertEmail}}',
                subject: 'Error Alert'
              }
            },
            enabled: true
          },
          {
            id: 'send-slack',
            type: 'action',
            actionType: 'send_slack',
            name: 'Send Slack Alert',
            description: 'Slack alert',
            position: { x: 500, y: 150 },
            config: {
              parameters: {
                channel: '{{slackChannel}}'
              }
            },
            enabled: true
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'trigger-error',
            targetNodeId: 'analyze'
          },
          {
            id: 'conn-2',
            sourceNodeId: 'analyze',
            targetNodeId: 'send-email'
          },
          {
            id: 'conn-3',
            sourceNodeId: 'analyze',
            targetNodeId: 'send-slack'
          }
        ],
        triggers: [],
        variables: [],
        settings: {
          logLevel: 'info',
          enableMetrics: true,
          enableTracing: false
        },
        metadata: {}
      },
      documentation: '# Error Monitoring\n\nMonitor and alert on application errors.',
      tags: ['monitoring', 'errors', 'alerts'],
      icon: 'error',
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Communication Templates
    this.register({
      id: 'template-announcements',
      name: 'Team Announcements',
      description: 'Broadcast announcements to multiple channels',
      category: 'communication',
      parameters: [
        {
          name: 'slackChannel',
          type: 'string',
          required: true,
          description: 'Slack channel'
        },
        {
          name: 'discordWebhook',
          type: 'string',
          required: false,
          description: 'Discord webhook URL'
        },
        {
          name: 'emailList',
          type: 'array',
          required: false,
          description: 'Email addresses'
        }
      ],
      workflow: {
        id: 'template-announcements',
        name: 'Team Announcements',
        description: 'Send announcements to team',
        version: 1,
        status: 'draft',
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            name: 'New Announcement',
            description: 'Trigger announcement workflow',
            position: { x: 100, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'parallel',
            type: 'parallel',
            name: 'Broadcast',
            description: 'Send to all channels',
            position: { x: 300, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'slack',
            type: 'action',
            actionType: 'send_slack',
            name: 'Send to Slack',
            description: 'Slack notification',
            position: { x: 500, y: 50 },
            config: {
              parameters: {
                channel: '{{slackChannel}}'
              }
            },
            enabled: true
          },
          {
            id: 'discord',
            type: 'action',
            actionType: 'send_discord',
            name: 'Send to Discord',
            description: 'Discord notification',
            position: { x: 500, y: 100 },
            config: {
              parameters: {
                webhookUrl: '{{discordWebhook}}'
              }
            },
            enabled: true
          },
          {
            id: 'email',
            type: 'action',
            actionType: 'send_email',
            name: 'Send Email',
            description: 'Email announcement',
            position: { x: 500, y: 150 },
            config: {
              parameters: {
                to: '{{emailList}}'
              }
            },
            enabled: true
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'trigger',
            targetNodeId: 'parallel'
          },
          {
            id: 'conn-2',
            sourceNodeId: 'parallel',
            targetNodeId: 'slack'
          },
          {
            id: 'conn-3',
            sourceNodeId: 'parallel',
            targetNodeId: 'discord'
          },
          {
            id: 'conn-4',
            sourceNodeId: 'parallel',
            targetNodeId: 'email'
          }
        ],
        triggers: [],
        variables: [],
        settings: {
          logLevel: 'info',
          enableMetrics: true,
          enableTracing: false
        },
        metadata: {}
      },
      documentation: '# Team Announcements\n\nBroadcast announcements to multiple communication channels.',
      tags: ['communication', 'announcements', 'slack', 'discord'],
      icon: 'announcement',
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Data Templates
    this.register({
      id: 'template-data-pipeline',
      name: 'Data Processing Pipeline',
      description: 'Process and transform data',
      category: 'data',
      parameters: [
        {
          name: 'dataSource',
          type: 'string',
          required: true,
          description: 'Data source URL'
        },
        {
          name: 'transformation',
          type: 'string',
          required: true,
          description: 'Transformation type'
        },
        {
          name: 'storageKey',
          type: 'string',
          required: true,
          description: 'Storage key'
        }
      ],
      workflow: {
        id: 'template-data-pipeline',
        name: 'Data Pipeline',
        description: 'Process {{transformation}} data',
        version: 1,
        status: 'draft',
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            name: 'Schedule',
            description: 'Scheduled data processing',
            position: { x: 100, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'fetch',
            type: 'action',
            actionType: 'fetch_data',
            name: 'Fetch Data',
            description: 'Fetch from source',
            position: { x: 300, y: 100 },
            config: {
              parameters: {
                url: '{{dataSource}}'
              }
            },
            enabled: true
          },
          {
            id: 'transform',
            type: 'action',
            actionType: 'transform_data',
            name: 'Transform',
            description: 'Transform data',
            position: { x: 500, y: 100 },
            config: {
              parameters: {
                transformation: '{{transformation}}'
              }
            },
            enabled: true
          },
          {
            id: 'store',
            type: 'action',
            actionType: 'store_data',
            name: 'Store',
            description: 'Store processed data',
            position: { x: 700, y: 100 },
            config: {
              parameters: {
                key: '{{storageKey}}'
              }
            },
            enabled: true
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'trigger',
            targetNodeId: 'fetch'
          },
          {
            id: 'conn-2',
            sourceNodeId: 'fetch',
            targetNodeId: 'transform'
          },
          {
            id: 'conn-3',
            sourceNodeId: 'transform',
            targetNodeId: 'store'
          }
        ],
        triggers: [],
        variables: [],
        settings: {
          logLevel: 'info',
          enableMetrics: true,
          enableTracing: false
        },
        metadata: {}
      },
      documentation: '# Data Pipeline\n\nProcess and transform data from various sources.',
      tags: ['data', 'etl', 'pipeline'],
      icon: 'data',
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Integration Templates
    this.register({
      id: 'template-github-sync',
      name: 'GitHub Sync',
      description: 'Sync GitHub events to other systems',
      category: 'integration',
      parameters: [
        {
          name: 'webhookSecret',
          type: 'string',
          required: true,
          description: 'Webhook secret'
        },
        {
          name: 'slackChannel',
          type: 'string',
          required: true,
          description: 'Slack channel for notifications'
        }
      ],
      workflow: {
        id: 'template-github-sync',
        name: 'GitHub Sync',
        description: 'Sync GitHub events',
        version: 1,
        status: 'draft',
        nodes: [
          {
            id: 'webhook',
            type: 'trigger',
            name: 'GitHub Webhook',
            description: 'GitHub webhook trigger',
            position: { x: 100, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'filter',
            type: 'condition',
            name: 'Filter Events',
            description: 'Filter GitHub events',
            position: { x: 300, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'notify',
            type: 'action',
            actionType: 'send_slack',
            name: 'Notify',
            description: 'Send notification',
            position: { x: 500, y: 100 },
            config: {
              parameters: {
                channel: '{{slackChannel}}'
              }
            },
            enabled: true
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'webhook',
            targetNodeId: 'filter'
          },
          {
            id: 'conn-2',
            sourceNodeId: 'filter',
            targetNodeId: 'notify'
          }
        ],
        triggers: [],
        variables: [],
        settings: {
          logLevel: 'info',
          enableMetrics: true,
          enableTracing: false
        },
        metadata: {}
      },
      documentation: '# GitHub Sync\n\nSync GitHub events to other systems.',
      tags: ['github', 'integration', 'webhook'],
      icon: 'github',
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Automation Templates
    this.register({
      id: 'template-daily-report',
      name: 'Daily Report',
      description: 'Generate and send daily reports',
      category: 'automation',
      parameters: [
        {
          name: 'reportTime',
          type: 'string',
          required: true,
          description: 'Report generation time (cron)',
          defaultValue: '0 9 * * *'
        },
        {
          name: 'recipients',
          type: 'array',
          required: true,
          description: 'Email recipients'
        },
        {
          name: 'dataSources',
          type: 'array',
          required: true,
          description: 'Data source URLs'
        }
      ],
      workflow: {
        id: 'template-daily-report',
        name: 'Daily Report',
        description: 'Generate daily report at {{reportTime}}',
        version: 1,
        status: 'draft',
        nodes: [
          {
            id: 'schedule',
            type: 'trigger',
            name: 'Daily Schedule',
            description: 'Trigger daily at scheduled time',
            position: { x: 100, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'fetch-data',
            type: 'action',
            actionType: 'fetch_data',
            name: 'Fetch Data',
            description: 'Fetch report data',
            position: { x: 300, y: 100 },
            config: {
              parameters: {
                url: '{{dataSources}}'
              }
            },
            enabled: true
          },
          {
            id: 'aggregate',
            type: 'action',
            actionType: 'aggregate_data',
            name: 'Aggregate',
            description: 'Aggregate data',
            position: { x: 500, y: 100 },
            config: {},
            enabled: true
          },
          {
            id: 'send-email',
            type: 'action',
            actionType: 'send_email',
            name: 'Send Report',
            description: 'Email report',
            position: { x: 700, y: 100 },
            config: {
              parameters: {
                to: '{{recipients}}',
                subject: 'Daily Report'
              }
            },
            enabled: true
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceNodeId: 'schedule',
            targetNodeId: 'fetch-data'
          },
          {
            id: 'conn-2',
            sourceNodeId: 'fetch-data',
            targetNodeId: 'aggregate'
          },
          {
            id: 'conn-3',
            sourceNodeId: 'aggregate',
            targetNodeId: 'send-email'
          }
        ],
        triggers: [],
        variables: [],
        settings: {
          logLevel: 'info',
          enableMetrics: true,
          enableTracing: false
        },
        metadata: {}
      },
      documentation: '# Daily Report\n\nAutomated daily report generation and delivery.',
      tags: ['automation', 'reports', 'scheduled'],
      icon: 'report',
      author: 'ClaudeFlare',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
}
