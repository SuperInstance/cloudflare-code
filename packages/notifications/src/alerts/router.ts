/**
 * Alert router for intelligent alert routing and management
 */

import type {
  Alert,
  AlertRoute,
  RouteCondition,
  RouteAction,
  NotificationChannelType,
  NotificationPriority,
} from '../types';

export interface RouterConfig {
  enableGrouping?: boolean;
  groupingWindowMs?: number;
  enableDeduplication?: boolean;
  deduplicationWindowMs?: number;
  maxGroupSize?: number;
}

export interface RoutingResult {
  route: AlertRoute;
  matched: boolean;
  priority: number;
  actions: RouteAction[];
  channels: NotificationChannelType[];
  users: string[];
  delay?: number;
}

export interface AlertGroup {
  id: string;
  alerts: Alert[];
  createdAt: Date;
  updatedAt: Date;
  routeId: string;
  expiresAt: Date;
}

export interface DeduplicationKey {
  key: string;
  alertId: string;
  expiresAt: Date;
}

/**
 * Alert router implementation
 */
export class AlertRouter {
  private routes: Map<string, AlertRoute> = new Map();
  private config: RouterConfig;
  private alertGroups: Map<string, AlertGroup> = new Map();
  private deduplicationKeys: Map<string, DeduplicationKey> = new Map();

  constructor(config: RouterConfig = {}) {
    this.config = {
      enableGrouping: true,
      groupingWindowMs: 60000, // 1 minute
      enableDeduplication: true,
      deduplicationWindowMs: 300000, // 5 minutes
      maxGroupSize: 50,
      ...config,
    };
  }

  /**
   * Add a route
   */
  addRoute(route: AlertRoute): void {
    this.routes.set(route.id, route);
  }

  /**
   * Remove a route
   */
  removeRoute(routeId: string): boolean {
    return this.routes.delete(routeId);
  }

  /**
   * Get a route by ID
   */
  getRoute(routeId: string): AlertRoute | undefined {
    return this.routes.get(routeId);
  }

  /**
   * Get all routes
   */
  getAllRoutes(): AlertRoute[] {
    return Array.from(this.routes.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Update a route
   */
  updateRoute(route: AlertRoute): boolean {
    if (!this.routes.has(route.id)) {
      return false;
    }
    this.routes.set(route.id, route);
    return true;
  }

  /**
   * Route an alert to appropriate channels and users
   */
  async routeAlert(alert: Alert): Promise<RoutingResult[]> {
    // Check for deduplication
    if (this.config.enableDeduplication) {
      const dedupResult = this.checkDeduplication(alert);
      if (dedupResult.deduplicated) {
        return [];
      }
    }

    // Find matching routes
    const matchingRoutes = this.findMatchingRoutes(alert);

    if (matchingRoutes.length === 0) {
      // Default routing
      return [this.createDefaultRouting(alert)];
    }

    // Process routes and create routing results
    const results: RoutingResult[] = [];

    for (const route of matchingRoutes) {
      const result = await this.processRoute(alert, route);
      results.push(result);
    }

    // Check for alert grouping
    if (this.config.enableGrouping) {
      this.groupAlert(alert, matchingRoutes[0]);
    }

    return results;
  }

  /**
   * Find all routes that match the alert
   */
  private findMatchingRoutes(alert: Alert): AlertRoute[] {
    const routes = Array.from(this.routes.values());

    return routes
      .filter((route) => route.enabled)
      .filter((route) => this.matchesConditions(alert, route.conditions))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if alert matches route conditions
   */
  private matchesConditions(alert: Alert, conditions: RouteCondition[]): boolean {
    if (conditions.length === 0) {
      return true;
    }

    return conditions.every((condition) => this.matchesCondition(alert, condition));
  }

  /**
   * Check if alert matches a single condition
   */
  private matchesCondition(alert: Alert, condition: RouteCondition): boolean {
    const alertValue = this.getAlertValue(alert, condition);

    switch (condition.operator) {
      case 'equals':
        return alertValue === condition.value;

      case 'contains':
        return typeof alertValue === 'string' && String(condition.value) in alertValue;

      case 'matches':
        if (typeof alertValue !== 'string' || typeof condition.value !== 'string') {
          return false;
        }
        try {
          const regex = new RegExp(condition.value);
          return regex.test(alertValue);
        } catch {
          return false;
        }

      case 'in':
        if (!Array.isArray(condition.value)) {
          return false;
        }
        return condition.value.includes(alertValue);

      case 'gt':
        return typeof alertValue === 'number' && alertValue > Number(condition.value);

      case 'lt':
        return typeof alertValue === 'number' && alertValue < Number(condition.value);

      case 'between':
        if (!Array.isArray(condition.value) || condition.value.length !== 2) {
          return false;
        }
        return (
          typeof alertValue === 'number' &&
          alertValue >= Number(condition.value[0]) &&
          alertValue <= Number(condition.value[1])
        );

      default:
        return false;
    }
  }

  /**
   * Get alert value for condition
   */
  private getAlertValue(alert: Alert, condition: RouteCondition): unknown {
    switch (condition.type) {
      case 'severity':
        return alert.severity;

      case 'source':
        return alert.source;

      case 'type':
        return alert.type;

      case 'tag':
        return alert.metadata?.tags?.includes(condition.value as string);

      case 'time':
        return alert.createdAt;

      case 'custom':
        if (condition.field && alert.data) {
          return alert.data[condition.field];
        }
        return undefined;

      default:
        return undefined;
    }
  }

  /**
   * Process route and generate routing result
   */
  private async processRoute(alert: Alert, route: AlertRoute): Promise<RoutingResult> {
    const actions = route.actions;
    const channels: NotificationChannelType[] = [];
    const users: string[] = [];
    let delay: number | undefined;

    // Process actions
    for (const action of actions) {
      switch (action.type) {
        case 'notify':
          this.processNotifyAction(action, channels, users);
          break;

        case 'escalate':
          this.processEscalateAction(action, channels, users);
          break;

        case 'group':
          // Grouping is handled separately
          break;

        case 'delay':
          delay = action.config.duration as number;
          break;

        case 'transform':
          // Transform the alert (not implemented yet)
          break;

        case 'filter':
          if (action.config.filter === true) {
            // Filter out this alert
            return this.createEmptyResult(route);
          }
          break;
      }
    }

    // Determine priority
    const priority = this.determinePriority(alert);

    return {
      route,
      matched: true,
      priority,
      actions,
      channels: channels.length > 0 ? channels : this.getDefaultChannels(alert),
      users,
      delay,
    };
  }

  /**
   * Process notify action
   */
  private processNotifyAction(
    action: RouteAction,
    channels: NotificationChannelType[],
    users: string[]
  ): void {
    if (action.config.channels) {
      const actionChannels = action.config.channels as NotificationChannelType[];
      channels.push(...actionChannels);
    }

    if (action.config.users) {
      const actionUsers = action.config.users as string[];
      users.push(...actionUsers);
    }
  }

  /**
   * Process escalate action
   */
  private processEscalateAction(
    action: RouteAction,
    channels: NotificationChannelType[],
    users: string[]
  ): void {
    if (action.config.escalationPath) {
      // Escalation paths are handled by the escalation engine
      // Here we just add the channels
      if (action.config.channels) {
        const actionChannels = action.config.channels as NotificationChannelType[];
        channels.push(...actionChannels);
      }
    }

    if (action.config.onCallUser) {
      users.push(action.config.onCallUser as string);
    }
  }

  /**
   * Determine notification priority from alert
   */
  private determinePriority(alert: Alert): NotificationPriority {
    const severityMap: Record<string, NotificationPriority> = {
      info: 'low',
      warning: 'normal',
      error: 'high',
      critical: 'urgent',
      fatal: 'critical',
    };

    return severityMap[alert.severity] || alert.priority;
  }

  /**
   * Get default channels for alert
   */
  private getDefaultChannels(alert: Alert): NotificationChannelType[] {
    const channels: NotificationChannelType[] = ['in_app'];

    switch (alert.severity) {
      case 'fatal':
      case 'critical':
        channels.push('email', 'sms', 'slack');
        break;

      case 'error':
        channels.push('email', 'slack');
        break;

      case 'warning':
        channels.push('email');
        break;

      default:
        break;
    }

    return channels;
  }

  /**
   * Create default routing result
   */
  private createDefaultRouting(alert: Alert): RoutingResult {
    return {
      route: {
        id: 'default',
        name: 'Default Route',
        priority: 0,
        conditions: [],
        actions: [],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      matched: true,
      priority: 0,
      actions: [],
      channels: this.getDefaultChannels(alert),
      users: [],
    };
  }

  /**
   * Create empty routing result (filtered)
   */
  private createEmptyResult(route: AlertRoute): RoutingResult {
    return {
      route,
      matched: false,
      priority: 0,
      actions: [],
      channels: [],
      users: [],
    };
  }

  /**
   * Check for alert deduplication
   */
  private checkDeduplication(alert: Alert): { deduplicated: boolean; key?: string } {
    const key = this.generateDeduplicationKey(alert);
    const existing = this.deduplicationKeys.get(key);

    if (existing && existing.expiresAt > new Date()) {
      // Update the existing deduplication key
      existing.expiresAt = new Date(Date.now() + this.config.deduplicationWindowMs!);
      return { deduplicated: true, key };
    }

    // Create new deduplication key
    this.deduplicationKeys.set(key, {
      key,
      alertId: alert.id,
      expiresAt: new Date(Date.now() + this.config.deduplicationWindowMs!),
    });

    return { deduplicated: false, key };
  }

  /**
   * Generate deduplication key for alert
   */
  private generateDeduplicationKey(alert: Alert): string {
    // Create a key based on alert properties that indicate duplicates
    const parts = [
      alert.type,
      alert.source,
      alert.severity,
      // Optionally include specific data fields
    ];

    if (alert.data?.fingerprint) {
      parts.push(String(alert.data.fingerprint));
    }

    return parts.join(':');
  }

  /**
   * Group alerts together
   */
  private groupAlert(alert: Alert, route: AlertRoute): void {
    const key = this.generateGroupKey(alert, route);
    let group = this.alertGroups.get(key);

    if (!group) {
      group = {
        id: key,
        alerts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        routeId: route.id,
        expiresAt: new Date(Date.now() + this.config.groupingWindowMs!),
      };
      this.alertGroups.set(key, group);
    }

    // Check if group is full
    if (group.alerts.length >= this.config.maxGroupSize!) {
      // Create a new group
      group = {
        id: `${key}_${Date.now()}`,
        alerts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        routeId: route.id,
        expiresAt: new Date(Date.now() + this.config.groupingWindowMs!),
      };
      this.alertGroups.set(group.id, group);
    }

    group.alerts.push(alert);
    group.updatedAt = new Date();
  }

  /**
   * Generate group key for alert
   */
  private generateGroupKey(alert: Alert, route: AlertRoute): string {
    return `group:${route.id}:${alert.type}:${alert.source}`;
  }

  /**
   * Get alert group by ID
   */
  getAlertGroup(groupId: string): AlertGroup | undefined {
    return this.alertGroups.get(groupId);
  }

  /**
   * Get all active alert groups
   */
  getActiveAlertGroups(): AlertGroup[] {
    const now = new Date();
    return Array.from(this.alertGroups.values()).filter((group) => group.expiresAt > now);
  }

  /**
   * Clean up expired groups and deduplication keys
   */
  cleanup(): void {
    const now = new Date();

    // Clean up expired groups
    for (const [key, group] of this.alertGroups.entries()) {
      if (group.expiresAt < now) {
        this.alertGroups.delete(key);
      }
    }

    // Clean up expired deduplication keys
    for (const [key, dedup] of this.deduplicationKeys.entries()) {
      if (dedup.expiresAt < now) {
        this.deduplicationKeys.delete(key);
      }
    }
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.routes.clear();
  }

  /**
   * Clear all groups
   */
  clearGroups(): void {
    this.alertGroups.clear();
  }

  /**
   * Clear all deduplication keys
   */
  clearDeduplicationKeys(): void {
    this.deduplicationKeys.clear();
  }

  /**
   * Get router statistics
   */
  getStats(): {
    totalRoutes: number;
    enabledRoutes: number;
    activeGroups: number;
    deduplicationKeys: number;
  } {
    const now = new Date();

    return {
      totalRoutes: this.routes.size,
      enabledRoutes: Array.from(this.routes.values()).filter((r) => r.enabled).length,
      activeGroups: Array.from(this.alertGroups.values()).filter((g) => g.expiresAt > now).length,
      deduplicationKeys: Array.from(this.deduplicationKeys.values()).filter((k) => k.expiresAt > now)
        .length,
    };
  }
}
