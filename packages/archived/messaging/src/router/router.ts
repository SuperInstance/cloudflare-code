// @ts-nocheck - Complex type relationships with routing rules
import { Message, RoutingRule, RoutingAction } from '../types';
import { matchTopicPattern } from '../utils';

export namespace MessageRouter {
  export interface Config {
    rules: RoutingRule[];
    maxConcurrency: number;
    enableTransformation: boolean;
    enableFiltering: boolean;
    enableMetrics: boolean;
  }

  export interface RouteResult {
    matched: boolean;
    rules: RoutingRule[];
    actions: RoutingAction[];
    transformedMessage?: Message;
  }
}

export class MessageRouter {
  private rules: Map<string, RoutingRule> = new Map();
  private config: MessageRouter.Config;
  private metrics: {
    totalMessages: number;
    matchedMessages: number;
    transformedMessages: number;
    filteredMessages: number;
    errors: number;
  };

  constructor(config: Partial<MessageRouter.Config> = {}) {
    this.config = {
      rules: [],
      maxConcurrency: 100,
      enableTransformation: true,
      enableFiltering: true,
      enableMetrics: true,
      ...config
    };

    this.metrics = {
      totalMessages: 0,
      matchedMessages: 0,
      transformedMessages: 0,
      filteredMessages: 0,
      errors: 0
    };
  }

  async initialize(): Promise<void> {
    // Initialize routing rules
    for (const rule of this.config.rules) {
      this.addRule(rule);
    }
  }

  async route(message: Message): Promise<MessageRouter.RouteResult> {
    const startTime = performance.now();
    this.metrics.totalMessages++;

    try {
      // Find matching rules
      const matchedRules = this.findMatchingRules(message);

      if (matchedRules.length === 0) {
        return {
          matched: false,
          rules: [],
          actions: []
        };
      }

      this.metrics.matchedMessages++;

      let transformedMessage = message;
      const allActions: RoutingAction[] = [];

      // Process each matched rule
      for (const rule of matchedRules) {
        if (!rule.enabled) continue;

        for (const action of rule.actions) {
          allActions.push(action);

          // Apply transformation if enabled
          if (this.config.enableTransformation && action.type === 'transform') {
            transformedMessage = this.applyTransformation(transformedMessage, action);
            this.metrics.transformedMessages++;
          }

          // Apply filter if enabled
          if (this.config.enableFiltering && action.type === 'filter') {
            if (!this.applyFilter(transformedMessage, action)) {
              this.metrics.filteredMessages++;
              return {
                matched: true,
                rules: matchedRules,
                actions: allActions,
                transformedMessage
              };
            }
          }
        }
      }

      return {
        matched: true,
        rules: matchedRules,
        actions: allActions,
        transformedMessage
      };

    } catch (error) {
      this.metrics.errors++;
      console.error('Error routing message:', error);

      return {
        matched: false,
        rules: [],
        actions: [],
        transformedMessage: message
      };
    }
  }

  private findMatchingRules(message: Message): RoutingRule[] {
    const matchedRules: RoutingRule[] = [];

    for (const rule of this.rules.values()) {
      if (this.ruleMatches(message, rule)) {
        matchedRules.push(rule);
      }
    }

    // Sort by priority (higher priority first)
    return matchedRules.sort((a, b) => b.priority - a.priority);
  }

  private ruleMatches(message: Message, rule: RoutingRule): boolean {
    // Match topic pattern
    if (!matchTopicPattern(message.topic, rule.pattern, rule.type)) {
      return false;
    }

    // Match header filters if present
    if (rule.actions.length > 0 && rule.actions[0].type === 'filter') {
      const filter = rule.actions[0].filter;
      if (filter && filter.headers) {
        for (const [key, value] of Object.entries(filter.headers)) {
          const headerValue = message.headers[key];
          if (headerValue !== value) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private applyTransformation(message: Message, action: RoutingAction): Message {
    if (!action.transform) {
      return message;
    }

    try {
      const transform = action.transform;

      // Transform payload
      if (transform.payload) {
        switch (transform.payload.operation) {
          case 'replace':
            message.payload = transform.payload.value;
            break;
          case 'append':
            if (Array.isArray(message.payload)) {
              message.payload.push(transform.payload.value);
            } else {
              message.payload = [message.payload, transform.payload.value];
            }
            break;
          case 'remove':
            delete message.payload[transform.payload.key];
            break;
        }
      }

      // Transform headers
      if (transform.headers) {
        for (const [key, value] of Object.entries(transform.headers)) {
          if (typeof value === 'string' && value.startsWith('remove:')) {
            delete message.headers[key];
          } else {
            message.headers[key] = value;
          }
        }
      }

      // Add timestamp
      message.headers.transformedAt = Date.now();

      return message;
    } catch (error) {
      console.error('Error transforming message:', error);
      return message;
    }
  }

  private applyFilter(message: Message, action: RoutingAction): boolean {
    if (!action.filter) {
      return true;
    }

    const filter = action.filter;

    // Check content type filter
    if (filter.contentType && message.headers.contentType !== filter.contentType) {
      return false;
    }

    // Check payload filter
    if (filter.payload) {
      if (typeof filter.payload === 'object') {
        for (const [key, value] of Object.entries(filter.payload)) {
          if (!message.payload || message.payload[key] !== value) {
            return false;
          }
        }
      } else if (message.payload !== filter.payload) {
        return false;
      }
    }

    return true;
  }

  addRule(rule: RoutingRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  updateRule(ruleId: string, updates: Partial<RoutingRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    rule.updatedAt = Date.now();
    return true;
  }

  getRule(ruleId: string): RoutingRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): RoutingRule[] {
    return Array.from(this.rules.values());
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = true;
    rule.updatedAt = Date.now();
    return true;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = false;
    rule.updatedAt = Date.now();
    return true;
  }

  getMetrics() {
    if (!this.config.enableMetrics) {
      return null;
    }

    return {
      ...this.metrics,
      matchRate: this.metrics.totalMessages > 0
        ? this.metrics.matchedMessages / this.metrics.totalMessages
        : 0,
      transformationRate: this.metrics.matchedMessages > 0
        ? this.metrics.transformedMessages / this.metrics.matchedMessages
        : 0,
      errorRate: this.metrics.totalMessages > 0
        ? this.metrics.errors / this.metrics.totalMessages
        : 0
    };
  }

  resetMetrics(): void {
    this.metrics = {
      totalMessages: 0,
      matchedMessages: 0,
      transformedMessages: 0,
      filteredMessages: 0,
      errors: 0
    };
  }
}