/**
 * List Manager - Email list creation, segmentation, and management
 */

// @ts-nocheck - Type issues with unknown error type
import { v4 as uuidv4 } from 'uuid';
import { winston as logger } from '../utils/logger';
import {
  EmailList,
  ListSubscriber,
  SubscriptionStatus,
  ListSegment,
  SegmentationCriteria,
  BounceInfo
} from '../types';

/**
 * List Manager class for managing email lists and subscribers
 */
export class ListManager {
  private lists: Map<string, EmailList> = new Map();
  private subscribers: Map<string, ListSubscriber> = new Map();
  private listSubscribers: Map<string, Set<string>> = new Map(); // listId -> subscriberIds
  private segments: Map<string, ListSegment> = new Map();

  /**
   * Create a new email list
   */
  createList(
    name: string,
    description?: string,
    tags?: string[]
  ): EmailList {
    const list: EmailList = {
      id: uuidv4(),
      name,
      description,
      subscribers: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags
    };

    this.lists.set(list.id, list);
    this.listSubscribers.set(list.id, new Set());

    logger.info(`Created email list '${name}' with ID ${list.id}`);

    return list;
  }

  /**
   * Get list by ID
   */
  getList(listId: string): EmailList | undefined {
    return this.lists.get(listId);
  }

  /**
   * Get all lists
   */
  getAllLists(): EmailList[] {
    return Array.from(this.lists.values());
  }

  /**
   * Update list
   */
  updateList(
    listId: string,
    updates: Partial<EmailList>
  ): EmailList | null {
    const list = this.lists.get(listId);
    if (!list) {
      return null;
    }

    const updated = {
      ...list,
      ...updates,
      id: list.id, // Preserve ID
      createdAt: list.createdAt, // Preserve creation time
      updatedAt: new Date()
    };

    this.lists.set(listId, updated);
    logger.info(`Updated list '${updated.name}'`);

    return updated;
  }

  /**
   * Delete list
   */
  deleteList(listId: string): boolean {
    // Remove all subscribers from this list
    const subscriberIds = this.listSubscribers.get(listId);
    if (subscriberIds) {
      subscriberIds.forEach(subscriberId => {
        this.subscribers.delete(subscriberId);
      });
    }

    // Remove segments
    for (const [segmentId, segment] of this.segments) {
      if (segment.listId === listId) {
        this.segments.delete(segmentId);
      }
    }

    const deleted = this.lists.delete(listId);
    this.listSubscribers.delete(listId);

    if (deleted) {
      logger.info(`Deleted list ${listId}`);
    }

    return deleted;
  }

  /**
   * Add subscriber to list
   */
  addSubscriber(
    listId: string,
    email: string,
    name?: string,
    metadata?: Record<string, any>,
    tags?: string[]
  ): ListSubscriber {
    // Check if already subscribed
    const existingSubscriber = this.findSubscriber(listId, email);
    if (existingSubscriber) {
      if (existingSubscriber.status === SubscriptionStatus.UNSUBSCRIBED) {
        // Re-subscribe
        existingSubscriber.status = SubscriptionStatus.ACTIVE;
        existingSubscriber.subscribedAt = new Date();
        existingSubscriber.unsubscribedAt = undefined;
        logger.info(`Re-subscribed ${email} to list ${listId}`);
        return existingSubscriber;
      }
      throw new Error(`Email ${email} is already subscribed to this list`);
    }

    const subscriber: ListSubscriber = {
      id: uuidv4(),
      listId,
      email,
      name,
      status: SubscriptionStatus.ACTIVE,
      subscribedAt: new Date(),
      metadata,
      tags
    };

    this.subscribers.set(subscriber.id, subscriber);
    this.listSubscribers.get(listId)!.add(subscriber.id);

    // Update list subscriber count
    const list = this.lists.get(listId);
    if (list) {
      list.subscribers++;
      list.updatedAt = new Date();
    }

    logger.info(`Added subscriber ${email} to list ${listId}`);

    return subscriber;
  }

  /**
   * Find subscriber by email
   */
  private findSubscriber(listId: string, email: string): ListSubscriber | undefined {
    const subscriberIds = this.listSubscribers.get(listId);
    if (!subscriberIds) {
      return undefined;
    }

    for (const subscriberId of subscriberIds) {
      const subscriber = this.subscribers.get(subscriberId);
      if (subscriber && subscriber.email === email) {
        return subscriber;
      }
    }

    return undefined;
  }

  /**
   * Get subscriber by ID
   */
  getSubscriber(subscriberId: string): ListSubscriber | undefined {
    return this.subscribers.get(subscriberId);
  }

  /**
   * Get all subscribers for a list
   */
  getSubscribers(listId: string): ListSubscriber[] {
    const subscriberIds = this.listSubscribers.get(listId);
    if (!subscriberIds) {
      return [];
    }

    return Array.from(subscriberIds)
      .map(id => this.subscribers.get(id))
      .filter((s): s is ListSubscriber => s !== undefined);
  }

  /**
   * Update subscriber
   */
  updateSubscriber(
    subscriberId: string,
    updates: Partial<ListSubscriber>
  ): ListSubscriber | null {
    const subscriber = this.subscribers.get(subscriberId);
    if (!subscriber) {
      return null;
    }

    const updated = {
      ...subscriber,
      ...updates,
      id: subscriber.id, // Preserve ID
      listId: subscriber.listId, // Preserve list ID
      subscribedAt: subscriber.subscribedAt // Preserve subscribe time
    };

    this.subscribers.set(subscriberId, updated);

    // Update list timestamp
    const list = this.lists.get(subscriber.listId);
    if (list) {
      list.updatedAt = new Date();
    }

    logger.info(`Updated subscriber ${subscriber.email}`);

    return updated;
  }

  /**
   * Unsubscribe subscriber
   */
  unsubscribe(subscriberId: string): boolean {
    const subscriber = this.subscribers.get(subscriberId);
    if (!subscriber) {
      return false;
    }

    subscriber.status = SubscriptionStatus.UNSUBSCRIBED;
    subscriber.unsubscribedAt = new Date();

    // Update list subscriber count
    const list = this.lists.get(subscriber.listId);
    if (list) {
      list.subscribers--;
      list.updatedAt = new Date();
    }

    logger.info(`Unsubscribed ${subscriber.email} from list ${subscriber.listId}`);

    return true;
  }

  /**
   * Unsubscribe by email
   */
  unsubscribeByEmail(listId: string, email: string): boolean {
    const subscriber = this.findSubscriber(listId, email);
    if (!subscriber) {
      return false;
    }

    return this.unsubscribe(subscriber.id);
  }

  /**
   * Remove subscriber from list
   */
  removeSubscriber(subscriberId: string): boolean {
    const subscriber = this.subscribers.get(subscriberId);
    if (!subscriber) {
      return false;
    }

    this.subscribers.delete(subscriberId);
    this.listSubscribers.get(subscriber.listId)!.delete(subscriberId);

    // Update list subscriber count
    const list = this.lists.get(subscriber.listId);
    if (list) {
      list.subscribers--;
      list.updatedAt = new Date();
    }

    logger.info(`Removed subscriber ${subscriber.email} from list ${subscriber.listId}`);

    return true;
  }

  /**
   * Create segment
   */
  createSegment(
    listId: string,
    name: string,
    criteria: SegmentationCriteria[]
  ): ListSegment {
    const segment: ListSegment = {
      id: uuidv4(),
      listId,
      name,
      criteria,
      subscriberCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.segments.set(segment.id, segment);

    // Calculate subscriber count
    segment.subscriberCount = this.calculateSegmentCount(segment);

    logger.info(`Created segment '${name}' with ${segment.subscriberCount} subscribers`);

    return segment;
  }

  /**
   * Calculate segment subscriber count
   */
  private calculateSegmentCount(segment: ListSegment): number {
    const subscribers = this.getSubscribers(segment.listId);

    return subscribers.filter(subscriber =>
      this.matchesCriteria(subscriber, segment.criteria)
    ).length;
  }

  /**
   * Check if subscriber matches segmentation criteria
   */
  private matchesCriteria(
    subscriber: ListSubscriber,
    criteria: SegmentationCriteria[]
  ): boolean {
    // All criteria must match (AND logic)
    return criteria.every(criterion => {
      const value = this.getSubscriberFieldValue(subscriber, criterion.field);

      switch (criterion.operator) {
        case 'equals':
          return value === criterion.value;

        case 'contains':
          return typeof value === 'string' && value.includes(criterion.value);

        case 'startsWith':
          return typeof value === 'string' && value.startsWith(criterion.value);

        case 'endsWith':
          return typeof value === 'string' && value.endsWith(criterion.value);

        case 'gt':
          return typeof value === 'number' && value > criterion.value;

        case 'lt':
          return typeof value === 'number' && value < criterion.value;

        case 'gte':
          return typeof value === 'number' && value >= criterion.value;

        case 'lte':
          return typeof value === 'number' && value <= criterion.value;

        case 'in':
          return Array.isArray(criterion.value) && criterion.value.includes(value);

        case 'notIn':
          return Array.isArray(criterion.value) && !criterion.value.includes(value);

        default:
          return false;
      }
    });
  }

  /**
   * Get field value from subscriber
   */
  private getSubscriberFieldValue(subscriber: ListSubscriber, field: string): any {
    // Support nested fields like metadata.age
    const parts = field.split('.');
    let value: any = subscriber;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get segment subscribers
   */
  getSegmentSubscribers(segmentId: string): ListSubscriber[] {
    const segment = this.segments.get(segmentId);
    if (!segment) {
      return [];
    }

    const subscribers = this.getSubscribers(segment.listId);

    return subscribers.filter(subscriber =>
      this.matchesCriteria(subscriber, segment.criteria)
    );
  }

  /**
   * Get segment by ID
   */
  getSegment(segmentId: string): ListSegment | undefined {
    return this.segments.get(segmentId);
  }

  /**
   * Get all segments for a list
   */
  getSegments(listId: string): ListSegment[] {
    return Array.from(this.segments.values()).filter(
      segment => segment.listId === listId
    );
  }

  /**
   * Update segment
   */
  updateSegment(
    segmentId: string,
    updates: Partial<ListSegment>
  ): ListSegment | null {
    const segment = this.segments.get(segmentId);
    if (!segment) {
      return null;
    }

    const updated = {
      ...segment,
      ...updates,
      id: segment.id, // Preserve ID
      listId: segment.listId, // Preserve list ID
      createdAt: segment.createdAt // Preserve creation time
    };

    // Recalculate subscriber count
    if (updates.criteria) {
      updated.subscriberCount = this.calculateSegmentCount(updated);
    }

    updated.updatedAt = new Date();
    this.segments.set(segmentId, updated);

    logger.info(`Updated segment '${updated.name}'`);

    return updated;
  }

  /**
   * Delete segment
   */
  deleteSegment(segmentId: string): boolean {
    return this.segments.delete(segmentId);
  }

  /**
   * Import subscribers from CSV
   */
  importSubscribers(
    listId: string,
    data: Array<{
      email: string;
      name?: string;
      metadata?: Record<string, any>;
    }>,
    options?: {
      updateExisting?: boolean;
      tags?: string[];
    }
  ): {
    added: number;
    updated: number;
    failed: number;
    errors: Array<{ email: string; error: string }>;
  } {
    const results = {
      added: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ email: string; error: string }>
    };

    for (const row of data) {
      try {
        const existing = this.findSubscriber(listId, row.email);

        if (existing) {
          if (options?.updateExisting) {
            this.updateSubscriber(existing.id, {
              name: row.name,
              metadata: row.metadata,
              tags: options.tags
            });
            results.updated++;
          }
        } else {
          this.addSubscriber(
            listId,
            row.email,
            row.name,
            row.metadata,
            options?.tags
          );
          results.added++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: row.email,
          error: error.message
        });
      }
    }

    logger.info(
      `Imported subscribers to list ${listId}: ${results.added} added, ${results.updated} updated, ${results.failed} failed`
    );

    return results;
  }

  /**
   * Export subscribers to CSV
   */
  exportSubscribers(
    listId: string,
    segmentId?: string
  ): Array<{
    email: string;
    name?: string;
    status: SubscriptionStatus;
    subscribedAt: Date;
    metadata?: Record<string, any>;
    tags?: string[];
  }> {
    let subscribers: ListSubscriber[];

    if (segmentId) {
      subscribers = this.getSegmentSubscribers(segmentId);
    } else {
      subscribers = this.getSubscribers(listId);
    }

    return subscribers.map(s => ({
      email: s.email,
      name: s.name,
      status: s.status,
      subscribedAt: s.subscribedAt,
      metadata: s.metadata,
      tags: s.tags
    }));
  }

  /**
   * Process bounce for subscriber
   */
  processBounce(bounce: BounceInfo): void {
    // Find subscriber by email across all lists
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.email === bounce.recipient) {
        // Mark as bounced
        subscriber.status = SubscriptionStatus.BOUNCED;

        // Update list subscriber count
        const list = this.lists.get(subscriber.listId);
        if (list) {
          list.subscribers--;
          list.updatedAt = new Date();
        }

        logger.info(`Marked ${subscriber.email} as bounced due to ${bounce.category}`);

        return;
      }
    }
  }

  /**
   * Clean list hygiene
   */
  cleanList(listId: string): {
    removedBounced: number;
    removedUnsubscribed: number;
    removedComplained: number;
    totalRemoved: number;
  } {
    const subscribers = this.getSubscribers(listId);
    const result = {
      removedBounced: 0,
      removedUnsubscribed: 0,
      removedComplained: 0,
      totalRemoved: 0
    };

    subscribers.forEach(subscriber => {
      let shouldRemove = false;

      if (subscriber.status === SubscriptionStatus.BOUNCED) {
        result.removedBounced++;
        shouldRemove = true;
      } else if (subscriber.status === SubscriptionStatus.UNSUBSCRIBED) {
        result.removedUnsubscribed++;
        shouldRemove = true;
      } else if (subscriber.status === SubscriptionStatus.COMPLAINED) {
        result.removedComplained++;
        shouldRemove = true;
      }

      if (shouldRemove) {
        this.removeSubscriber(subscriber.id);
        result.totalRemoved++;
      }
    });

    logger.info(`Cleaned list ${listId}: removed ${result.totalRemoved} subscribers`);

    return result;
  }

  /**
   * Get list statistics
   */
  getListStatistics(listId: string): {
    total: number;
    active: number;
    unsubscribed: number;
    bounced: number;
    complained: number;
    pending: number;
  } {
    const subscribers = this.getSubscribers(listId);

    const stats = {
      total: subscribers.length,
      active: 0,
      unsubscribed: 0,
      bounced: 0,
      complained: 0,
      pending: 0
    };

    subscribers.forEach(subscriber => {
      switch (subscriber.status) {
        case SubscriptionStatus.ACTIVE:
          stats.active++;
          break;
        case SubscriptionStatus.UNSUBSCRIBED:
          stats.unsubscribed++;
          break;
        case SubscriptionStatus.BOUNCED:
          stats.bounced++;
          break;
        case SubscriptionStatus.COMPLAINED:
          stats.complained++;
          break;
        case SubscriptionStatus.PENDING:
          stats.pending++;
          break;
      }
    });

    return stats;
  }

  /**
   * Get all lists statistics
   */
  getAllListsStatistics(): Array<{
    listId: string;
    listName: string;
    statistics: any;
  }> {
    return Array.from(this.lists.values()).map(list => ({
      listId: list.id,
      listName: list.name,
      statistics: this.getListStatistics(list.id)
    }));
  }

  /**
   * Merge lists
   */
  mergeLists(
    sourceListId: string,
    targetListId: string,
    removeSource: boolean = false
  ): {
    merged: number;
    skipped: number;
    sourceRemoved: boolean;
  } {
    const sourceSubscribers = this.getSubscribers(sourceListId);
    const result = {
      merged: 0,
      skipped: 0,
      sourceRemoved: false
    };

    sourceSubscribers.forEach(subscriber => {
      try {
        this.addSubscriber(
          targetListId,
          subscriber.email,
          subscriber.name,
          subscriber.metadata,
          subscriber.tags
        );
        result.merged++;
      } catch (error) {
        // Already exists in target
        result.skipped++;
      }
    });

    if (removeSource) {
      this.deleteList(sourceListId);
      result.sourceRemoved = true;
    }

    logger.info(
      `Merged list ${sourceListId} into ${targetListId}: ${result.merged} merged, ${result.skipped} skipped`
    );

    return result;
  }

  /**
   * Copy list
   */
  copyList(sourceListId: string, newName: string): EmailList {
    const sourceList = this.lists.get(sourceListId);
    if (!sourceList) {
      throw new Error(`Source list ${sourceListId} not found`);
    }

    // Create new list
    const newList = this.createList(
      newName,
      sourceList.description,
      sourceList.tags
    );

    // Copy subscribers
    const subscribers = this.getSubscribers(sourceListId);
    subscribers.forEach(subscriber => {
      try {
        this.addSubscriber(
          newList.id,
          subscriber.email,
          subscriber.name,
          subscriber.metadata,
          subscriber.tags
        );
      } catch (error) {
        // Skip duplicates
      }
    });

    logger.info(`Copied list ${sourceListId} to ${newList.id}`);

    return newList;
  }

  /**
   * Search subscribers
   */
  searchSubscribers(
    listId: string,
    query: string
  ): ListSubscriber[] {
    const subscribers = this.getSubscribers(listId);
    const lowerQuery = query.toLowerCase();

    return subscribers.filter(subscriber =>
      subscriber.email.toLowerCase().includes(lowerQuery) ||
      (subscriber.name && subscriber.name.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Validate email before adding
   */
  validateEmail(email: string): {
    valid: boolean;
    error?: string;
  } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return {
        valid: false,
        error: 'Invalid email format'
      };
    }

    return { valid: true };
  }
}

/**
 * List analytics
 */
export class ListAnalytics {
  private listManager: ListManager;

  constructor(listManager: ListManager) {
    this.listManager = listManager;
  }

  /**
   * Get list growth over time
   */
  getListGrowth(listId: string, days: number = 30): Array<{
    date: Date;
    total: number;
    added: number;
    removed: number;
  }> {
    const subscribers = this.listManager.getSubscribers(listId);
    const growth: Array<any> = [];

    // Initialize data for each day
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const addedOnDay = subscribers.filter(s => {
        const subDate = new Date(s.subscribedAt);
        return (
          subDate.getDate() === date.getDate() &&
          subDate.getMonth() === date.getMonth() &&
          subDate.getFullYear() === date.getFullYear()
        );
      }).length;

      growth.push({
        date,
        total: subscribers.length,
        added: addedOnDay,
        removed: 0 // Would track from history
      });
    }

    return growth;
  }

  /**
   * Get list engagement metrics
   */
  getListEngagement(listId: string): {
    totalSubscribers: number;
    activeSubscribers: number;
    engagementRate: number;
    avgOpens: number;
    avgClicks: number;
  } {
    const subscribers = this.listManager.getSubscribers(listId);

    return {
      totalSubscribers: subscribers.length,
      activeSubscribers: subscribers.filter(s => s.status === SubscriptionStatus.ACTIVE).length,
      engagementRate: 0, // Would calculate from campaign data
      avgOpens: 0, // Would calculate from campaign data
      avgClicks: 0 // Would calculate from campaign data
    };
  }
}
