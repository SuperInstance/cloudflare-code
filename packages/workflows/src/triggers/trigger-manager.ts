// @ts-nocheck
/**
 * Trigger Manager - manages workflow triggers
 */

import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import type {
  Trigger,
  TriggerType,
  TriggerConfig,
  TriggerId,
  WorkflowId,
  WebhookTriggerConfig,
  ScheduleTriggerConfig,
  EventTriggerConfig,
  ManualTriggerConfig
} from '../types';
import { WebhookHandler } from './webhook-handler';
import { ScheduleHandler } from './schedule-handler';
import { EventHandler } from './event-handler';

export interface TriggerCallback {
  (triggerId: TriggerId, data: any): Promise<void>;
}

export class TriggerManager {
  private triggers: Map<TriggerId, Trigger>;
  private workflowTriggers: Map<WorkflowId, Set<TriggerId>>;
  private webhookHandler: WebhookHandler;
  private scheduleHandler: ScheduleHandler;
  private eventHandler: EventHandler;
  private callbacks: Map<TriggerId, TriggerCallback>;

  constructor() {
    this.triggers = new Map();
    this.workflowTriggers = new Map();
    this.webhookHandler = new WebhookHandler();
    this.scheduleHandler = new ScheduleHandler();
    this.eventHandler = new EventHandler();
    this.callbacks = new Map();
  }

  /**
   * Register a trigger
   */
  public async registerTrigger(
    trigger: Trigger,
    callback: TriggerCallback
  ): Promise<void> {
    this.triggers.set(trigger.id, trigger);
    this.callbacks.set(trigger.id, callback);

    // Add to workflow triggers
    if (!this.workflowTriggers.has(trigger.nodeId)) {
      this.workflowTriggers.set(trigger.nodeId, new Set());
    }
    this.workflowTriggers.get(trigger.nodeId)!.add(trigger.id);

    // Register with appropriate handler
    switch (trigger.type) {
      case 'webhook':
        await this.webhookHandler.register(trigger, callback);
        break;

      case 'schedule':
        await this.scheduleHandler.register(trigger, callback);
        break;

      case 'event':
        await this.eventHandler.register(trigger, callback);
        break;

      case 'manual':
        // Manual triggers don't need registration
        break;
    }
  }

  /**
   * Unregister a trigger
   */
  public async unregisterTrigger(triggerId: TriggerId): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      return;
    }

    // Unregister from handler
    switch (trigger.type) {
      case 'webhook':
        await this.webhookHandler.unregister(triggerId);
        break;

      case 'schedule':
        await this.scheduleHandler.unregister(triggerId);
        break;

      case 'event':
        await this.eventHandler.unregister(triggerId);
        break;
    }

    // Remove from mappings
    this.triggers.delete(triggerId);
    this.callbacks.delete(triggerId);

    const workflowTriggers = this.workflowTriggers.get(trigger.nodeId);
    if (workflowTriggers) {
      workflowTriggers.delete(triggerId);
      if (workflowTriggers.size === 0) {
        this.workflowTriggers.delete(trigger.nodeId);
      }
    }
  }

  /**
   * Get trigger by ID
   */
  public getTrigger(triggerId: TriggerId): Trigger | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Get all triggers for a workflow
   */
  public getWorkflowTriggers(nodeId: string): Trigger[] {
    const triggerIds = this.workflowTriggers.get(nodeId) || new Set();
    const triggers: Trigger[] = [];

    for (const triggerId of triggerIds) {
      const trigger = this.triggers.get(triggerId);
      if (trigger) {
        triggers.push(trigger);
      }
    }

    return triggers;
  }

  /**
   * Get all triggers of a specific type
   */
  public getTriggersByType(type: TriggerType): Trigger[] {
    const triggers: Trigger[] = [];

    for (const trigger of this.triggers.values()) {
      if (trigger.type === type) {
        triggers.push(trigger);
      }
    }

    return triggers;
  }

  /**
   * Enable a trigger
   */
  public async enableTrigger(triggerId: TriggerId): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (trigger) {
      trigger.enabled = true;

      if (trigger.type === 'schedule') {
        await this.scheduleHandler.resume(triggerId);
      }
    }
  }

  /**
   * Disable a trigger
   */
  public async disableTrigger(triggerId: TriggerId): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (trigger) {
      trigger.enabled = false;

      if (trigger.type === 'schedule') {
        await this.scheduleHandler.pause(triggerId);
      }
    }
  }

  /**
   * Trigger a manual workflow
   */
  public async triggerManual(
    triggerId: TriggerId,
    data: any,
    user?: string
  ): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger || trigger.type !== 'manual') {
      throw new Error(`Invalid manual trigger: ${triggerId}`);
    }

    const config = trigger.config as ManualTriggerConfig;

    // Check permissions if configured
    if (config.allowedUsers && user) {
      if (!config.allowedUsers.includes(user)) {
        throw new Error(`User not allowed to trigger workflow: ${user}`);
      }
    }

    const callback = this.callbacks.get(triggerId);
    if (callback) {
      await callback(triggerId, {
        ...data,
        triggeredBy: user,
        triggeredAt: new Date()
      });
    }
  }

  /**
   * Handle an incoming webhook
   */
  public async handleWebhook(
    endpoint: string,
    request: Request
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.webhookHandler.handle(endpoint, request);
  }

  /**
   * Emit an event
   */
  public async emitEvent(eventType: string, data: any): Promise<void> {
    await this.eventHandler.emit(eventType, data);
  }

  /**
   * Get trigger statistics
   */
  public getStats(): {
    totalTriggers: number;
    enabledTriggers: number;
    triggersByType: Record<TriggerType, number>;
  } {
    const triggersByType: Record<string, number> = {
      webhook: 0,
      schedule: 0,
      event: 0,
      manual: 0
    };

    let enabledTriggers = 0;

    for (const trigger of this.triggers.values()) {
      triggersByType[trigger.type]++;
      if (trigger.enabled) {
        enabledTriggers++;
      }
    }

    return {
      totalTriggers: this.triggers.size,
      enabledTriggers,
      triggersByType: triggersByType as Record<TriggerType, number>
    };
  }

  /**
   * Cleanup all triggers
   */
  public async cleanup(): Promise<void> {
    await this.webhookHandler.cleanup();
    await this.scheduleHandler.cleanup();
    await this.eventHandler.cleanup();

    this.triggers.clear();
    this.workflowTriggers.clear();
    this.callbacks.clear();
  }
}
