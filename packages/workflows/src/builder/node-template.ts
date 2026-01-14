/**
 * Node Templates for workflow builder
 */

import type { Node, ActionType, Position } from '../types';

export interface NodeTemplate {
  type: Node['type'];
  actionType?: ActionType;
  name: string;
  description: string;
  category: string;
  icon?: string;
  color?: string;
  defaultConfig?: any;
  inputs?: string[];
  outputs?: string[];
}

export class NodeTemplateRegistry {
  private templates: Map<string, NodeTemplate>;

  constructor() {
    this.templates = new Map();
    this.registerDefaultTemplates();
  }

  /**
   * Register a node template
   */
  public register(template: NodeTemplate): void {
    const key = this.getTemplateKey(template.type, template.actionType);
    this.templates.set(key, template);
  }

  /**
   * Get a template
   */
  public get(type: Node['type'], actionType?: ActionType): NodeTemplate | undefined {
    const key = this.getTemplateKey(type, actionType);
    return this.templates.get(key);
  }

  /**
   * Get all templates
   */
  public getAll(): NodeTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  public getByCategory(category: string): NodeTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Search templates
   */
  public search(query: string): NodeTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Create a node from a template
   */
  public createNode(
    type: Node['type'],
    actionType?: ActionType,
    position?: Position
  ): Node {
    const template = this.get(type, actionType);

    const node: Node = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      actionType,
      name: template?.name || 'New Node',
      description: template?.description,
      position: position || { x: 0, y: 0 },
      config: template?.defaultConfig || {},
      enabled: true
    };

    return node;
  }

  /**
   * Get template key
   */
  private getTemplateKey(type: Node['type'], actionType?: ActionType): string {
    return actionType ? `${type}:${actionType}` : type;
  }

  /**
   * Register default templates
   */
  private registerDefaultTemplates(): void {
    // Trigger Templates
    this.register({
      type: 'trigger',
      name: 'Webhook Trigger',
      description: 'Trigger workflow via HTTP webhook',
      category: 'triggers',
      icon: 'webhook',
      color: '#3b82f6',
      defaultConfig: {
        method: 'POST',
        endpoint: '/webhook'
      }
    });

    this.register({
      type: 'trigger',
      name: 'Schedule Trigger',
      description: 'Trigger workflow on a schedule',
      category: 'triggers',
      icon: 'schedule',
      color: '#10b981',
      defaultConfig: {
        scheduleType: 'cron',
        cron: '0 * * * *'
      }
    });

    this.register({
      type: 'trigger',
      name: 'Event Trigger',
      description: 'Trigger workflow on an event',
      category: 'triggers',
      icon: 'event',
      color: '#f59e0b',
      defaultConfig: {
        eventType: 'custom.event'
      }
    });

    // Code Action Templates
    this.register({
      type: 'action',
      actionType: 'generate_code',
      name: 'Generate Code',
      description: 'Generate code using AI',
      category: 'code',
      icon: 'code',
      color: '#8b5cf6',
      inputs: ['prompt', 'language'],
      outputs: ['code']
    });

    this.register({
      type: 'action',
      actionType: 'review_code',
      name: 'Review Code',
      description: 'Review code for issues',
      category: 'code',
      icon: 'review',
      color: '#8b5cf6',
      inputs: ['code', 'filePath'],
      outputs: ['issues', 'score']
    });

    this.register({
      type: 'action',
      actionType: 'run_tests',
      name: 'Run Tests',
      description: 'Run tests and collect results',
      category: 'code',
      icon: 'test',
      color: '#8b5cf6',
      inputs: ['testPath', 'framework'],
      outputs: ['passed', 'failed', 'coverage']
    });

    this.register({
      type: 'action',
      actionType: 'deploy_code',
      name: 'Deploy Code',
      description: 'Deploy code to environment',
      category: 'code',
      icon: 'deploy',
      color: '#8b5cf6',
      inputs: ['environment', 'branch'],
      outputs: ['deploymentId', 'url']
    });

    // Communication Templates
    this.register({
      type: 'action',
      actionType: 'send_slack',
      name: 'Send Slack',
      description: 'Send message to Slack',
      category: 'communication',
      icon: 'slack',
      color: '#4a154b',
      inputs: ['channel', 'message'],
      outputs: ['timestamp']
    });

    this.register({
      type: 'action',
      actionType: 'send_email',
      name: 'Send Email',
      description: 'Send an email',
      category: 'communication',
      icon: 'email',
      color: '#ea580c',
      inputs: ['to', 'subject', 'body'],
      outputs: ['messageId']
    });

    this.register({
      type: 'action',
      actionType: 'send_discord',
      name: 'Send Discord',
      description: 'Send message to Discord',
      category: 'communication',
      icon: 'discord',
      color: '#5865f2',
      inputs: ['webhookUrl', 'content'],
      outputs: ['messageId']
    });

    // GitHub Templates
    this.register({
      type: 'action',
      actionType: 'create_issue',
      name: 'Create Issue',
      description: 'Create GitHub issue',
      category: 'github',
      icon: 'github',
      color: '#181717',
      inputs: ['owner', 'repo', 'title', 'body'],
      outputs: ['issueNumber', 'url']
    });

    this.register({
      type: 'action',
      actionType: 'create_pr',
      name: 'Create PR',
      description: 'Create pull request',
      category: 'github',
      icon: 'github',
      color: '#181717',
      inputs: ['owner', 'repo', 'head', 'base', 'title'],
      outputs: ['prNumber', 'url']
    });

    this.register({
      type: 'action',
      actionType: 'comment_pr',
      name: 'Comment PR',
      description: 'Comment on pull request',
      category: 'github',
      icon: 'github',
      color: '#181717',
      inputs: ['owner', 'repo', 'prNumber', 'body'],
      outputs: ['commentId']
    });

    this.register({
      type: 'action',
      actionType: 'merge_pr',
      name: 'Merge PR',
      description: 'Merge pull request',
      category: 'github',
      icon: 'github',
      color: '#181717',
      inputs: ['owner', 'repo', 'prNumber'],
      outputs: ['merged', 'sha']
    });

    // AI Templates
    this.register({
      type: 'action',
      actionType: 'chat_completion',
      name: 'Chat Completion',
      description: 'AI chat completion',
      category: 'ai',
      icon: 'ai',
      color: '#ec4899',
      inputs: ['messages', 'model'],
      outputs: ['message', 'usage']
    });

    this.register({
      type: 'action',
      actionType: 'summarization',
      name: 'Summarize',
      description: 'Summarize text',
      category: 'ai',
      icon: 'ai',
      color: '#ec4899',
      inputs: ['text', 'maxLength'],
      outputs: ['summary']
    });

    // Data Templates
    this.register({
      type: 'action',
      actionType: 'fetch_data',
      name: 'Fetch Data',
      description: 'Fetch data from URL',
      category: 'data',
      icon: 'fetch',
      color: '#06b6d4',
      inputs: ['url', 'method'],
      outputs: ['data']
    });

    this.register({
      type: 'action',
      actionType: 'transform_data',
      name: 'Transform Data',
      description: 'Transform data structure',
      category: 'data',
      icon: 'transform',
      color: '#06b6d4',
      inputs: ['data', 'transformation'],
      outputs: ['transformed']
    });

    // Storage Templates
    this.register({
      type: 'action',
      actionType: 'kv_get',
      name: 'KV Get',
      description: 'Get value from KV',
      category: 'storage',
      icon: 'kv',
      color: '#f97316',
      inputs: ['key'],
      outputs: ['value']
    });

    this.register({
      type: 'action',
      actionType: 'kv_set',
      name: 'KV Set',
      description: 'Set value in KV',
      category: 'storage',
      icon: 'kv',
      color: '#f97316',
      inputs: ['key', 'value'],
      outputs: []
    });

    this.register({
      type: 'action',
      actionType: 'd1_query',
      name: 'D1 Query',
      description: 'Query D1 database',
      category: 'storage',
      icon: 'database',
      color: '#f97316',
      inputs: ['database', 'query'],
      outputs: ['rows']
    });

    // HTTP Templates
    this.register({
      type: 'action',
      actionType: 'http_get',
      name: 'HTTP GET',
      description: 'Make HTTP GET request',
      category: 'http',
      icon: 'http',
      color: '#14b8a6',
      inputs: ['url'],
      outputs: ['status', 'data']
    });

    this.register({
      type: 'action',
      actionType: 'http_post',
      name: 'HTTP POST',
      description: 'Make HTTP POST request',
      category: 'http',
      icon: 'http',
      color: '#14b8a6',
      inputs: ['url', 'body'],
      outputs: ['status', 'data']
    });

    // Logic Templates
    this.register({
      type: 'condition',
      name: 'Condition',
      description: 'Branch based on conditions',
      category: 'logic',
      icon: 'condition',
      color: '#64748b',
      inputs: ['conditions'],
      outputs: ['result']
    });

    this.register({
      type: 'loop',
      name: 'Loop',
      description: 'Loop over items',
      category: 'logic',
      icon: 'loop',
      color: '#64748b',
      inputs: ['iterable'],
      outputs: ['results']
    });

    this.register({
      type: 'parallel',
      name: 'Parallel',
      description: 'Execute in parallel',
      category: 'logic',
      icon: 'parallel',
      color: '#64748b',
      inputs: ['branches'],
      outputs: ['results']
    });

    this.register({
      type: 'wait',
      name: 'Wait',
      description: 'Wait for duration',
      category: 'logic',
      icon: 'wait',
      color: '#64748b',
      inputs: ['duration'],
      outputs: ['waited']
    });

    // Utility Templates
    this.register({
      type: 'action',
      actionType: 'log',
      name: 'Log',
      description: 'Log a message',
      category: 'utility',
      icon: 'log',
      color: '#94a3b8',
      inputs: ['level', 'message'],
      outputs: []
    });

    this.register({
      type: 'action',
      actionType: 'notify',
      name: 'Notify',
      description: 'Send notification',
      category: 'utility',
      icon: 'notify',
      color: '#94a3b8',
      inputs: ['channels', 'message'],
      outputs: []
    });
  }
}
