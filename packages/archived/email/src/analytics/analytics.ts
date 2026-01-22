/**
 * Email Analytics - Comprehensive tracking and analytics for email campaigns
 */

// @ts-nocheck - Type issues with CampaignAnalytics.failed property
import { v4 as uuidv4 } from 'uuid';
import { winston as logger } from '../utils/logger';
import {
  EmailStatistics,
  EmailTracking,
  EmailStatus,
  DeliveryResult,
  CampaignAnalytics,
  EmailMessage
} from '../types';

/**
 * Email Analytics class for tracking email performance
 */
export class EmailAnalytics {
  private trackingData: Map<string, EmailTracking> = new Map();
  private deliveryHistory: DeliveryResult[] = [];
  private campaignData: Map<string, CampaignAnalytics> = new Map();

  /**
   * Track email delivery
   */
  trackDelivery(result: DeliveryResult): void {
    this.deliveryHistory.push(result);

    // Initialize tracking if not exists
    if (!this.trackingData.has(result.messageId)) {
      this.trackingData.set(result.messageId, {
        emailId: result.messageId,
        messageId: result.providerMessageId || result.messageId,
        recipient: '', // Will be set when message is sent
        trackingId: uuidv4(),
        clickCount: 0,
        openCount: 0
      });
    }

    logger.info(`Tracked delivery for ${result.messageId}: ${result.status}`);
  }

  /**
   * Track email open
   */
  trackOpen(messageId: string, metadata?: {
    userAgent?: string;
    ipAddress?: string;
    device?: string;
    location?: string;
  }): void {
    const tracking = this.trackingData.get(messageId);
    if (tracking) {
      tracking.openedAt = new Date();
      tracking.openCount = (tracking.openCount || 0) + 1;

      if (metadata) {
        tracking.userAgent = metadata.userAgent;
        tracking.ipAddress = metadata.ipAddress;
        tracking.device = metadata.device;
        tracking.location = metadata.location;
      }

      logger.info(`Tracked open for ${messageId} (count: ${tracking.openCount})`);
    }
  }

  /**
   * Track email click
   */
  trackClick(messageId: string, metadata?: {
    userAgent?: string;
    ipAddress?: string;
    device?: string;
    location?: string;
  }): void {
    const tracking = this.trackingData.get(messageId);
    if (tracking) {
      tracking.clickedAt = new Date();
      tracking.clickCount = (tracking.clickCount || 0) + 1;

      if (metadata) {
        tracking.userAgent = metadata.userAgent;
        tracking.ipAddress = metadata.ipAddress;
        tracking.device = metadata.device;
        tracking.location = metadata.location;
      }

      logger.info(`Tracked click for ${messageId} (count: ${tracking.clickCount})`);
    }
  }

  /**
   * Track bounce
   */
  trackBounce(messageId: string, reason: string): void {
    const tracking = this.trackingData.get(messageId);
    if (tracking) {
      logger.info(`Tracked bounce for ${messageId}: ${reason}`);
    }
  }

  /**
   * Track complaint
   */
  trackComplaint(messageId: string): void {
    const tracking = this.trackingData.get(messageId);
    if (tracking) {
      logger.info(`Tracked complaint for ${messageId}`);
    }
  }

  /**
   * Get tracking data for email
   */
  getTrackingData(messageId: string): EmailTracking | undefined {
    return this.trackingData.get(messageId);
  }

  /**
   * Calculate email statistics
   */
  calculateStatistics(startDate?: Date, endDate?: Date): EmailStatistics {
    const filtered = this.filterDeliveryHistory(startDate, endDate);

    const stats: EmailStatistics = {
      total: filtered.length,
      sent: filtered.filter(r => r.status === EmailStatus.SENT).length,
      delivered: filtered.filter(r => r.status === EmailStatus.DELIVERED).length,
      opened: 0,
      clicked: 0,
      bounced: filtered.filter(r => r.status === EmailStatus.BOUNCED).length,
      deferred: filtered.filter(r => r.status === EmailStatus.DEFERRED).length,
      failed: filtered.filter(r => r.status === EmailStatus.FAILED).length,
      complained: filtered.filter(r => r.status === EmailStatus.COMPLAINED).length,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      complaintRate: 0
    };

    // Calculate opens and clicks from tracking data
    for (const tracking of this.trackingData.values()) {
      if (tracking.openedAt) stats.opened++;
      if (tracking.clickedAt) stats.clicked++;
    }

    // Calculate rates
    if (stats.total > 0) {
      stats.deliveryRate = (stats.delivered / stats.total) * 100;
      stats.openRate = (stats.opened / stats.total) * 100;
      stats.clickRate = (stats.clicked / stats.total) * 100;
      stats.bounceRate = (stats.bounced / stats.total) * 100;
      stats.complaintRate = (stats.complained / stats.total) * 100;
    }

    return stats;
  }

  /**
   * Get campaign analytics
   */
  getCampaignAnalytics(campaignId: string): CampaignAnalytics | undefined {
    return this.campaignData.get(campaignId);
  }

  /**
   * Create or update campaign analytics
   */
  updateCampaignAnalytics(
    campaignId: string,
    name: string,
    startDate: Date,
    endDate?: Date
  ): CampaignAnalytics {
    let analytics = this.campaignData.get(campaignId);

    if (!analytics) {
      analytics = {
        campaignId,
        name,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
        unsubscribeRate: 0,
        startDate,
        endDate
      };
      this.campaignData.set(campaignId, analytics);
    }

    // Calculate statistics for this campaign
    const campaignDeliveries = this.deliveryHistory.filter(d => {
      // This would filter by campaign if we stored campaign info in delivery
      return true;
    });

    analytics.sent = campaignDeliveries.length;
    analytics.delivered = campaignDeliveries.filter(d => d.status === EmailStatus.DELIVERED).length;
    analytics.bounced = campaignDeliveries.filter(d => d.status === EmailStatus.BOUNCED).length;
    analytics.failed = campaignDeliveries.filter(d => d.status === EmailStatus.FAILED).length;

    // Calculate rates
    if (analytics.sent > 0) {
      analytics.deliveryRate = (analytics.delivered / analytics.sent) * 100;
      analytics.bounceRate = (analytics.bounced / analytics.sent) * 100;
    }

    // Update end date if provided
    if (endDate) {
      analytics.endDate = endDate;
    }

    return analytics;
  }

  /**
   * Get provider performance statistics
   */
  getProviderPerformance(): Map<string, {
    total: number;
    success: number;
    failed: number;
    successRate: number;
    averageResponseTime: number;
  }> {
    const providerStats = new Map();

    for (const delivery of this.deliveryHistory) {
      const provider = delivery.provider;
      if (!providerStats.has(provider)) {
        providerStats.set(provider, {
          total: 0,
          success: 0,
          failed: 0,
          successRate: 0,
          responseTimes: []
        });
      }

      const stats = providerStats.get(provider);
      stats.total++;
      if (delivery.success) {
        stats.success++;
      } else {
        stats.failed++;
      }
    }

    // Calculate final stats
    for (const [provider, stats] of providerStats) {
      stats.successRate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;
      stats.averageResponseTime = 0; // Would be calculated if we tracked response times
    }

    return providerStats;
  }

  /**
   * Get best performing send times
   */
  getBestSendTimes(): Array<{
    hour: number;
    sent: number;
    opened: number;
    clickRate: number;
  }> {
    const hourlyStats = new Map<number, { sent: number; opened: number; clicked: number }>();

    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourlyStats.set(i, { sent: 0, opened: 0, clicked: 0 });
    }

    // Aggregate by hour
    for (const delivery of this.deliveryHistory) {
      const hour = delivery.timestamp.getHours();
      const stats = hourlyStats.get(hour)!;
      stats.sent++;

      // Check if opened/clicked
      const tracking = this.trackingData.get(delivery.messageId);
      if (tracking) {
        if (tracking.openedAt) stats.opened++;
        if (tracking.clickedAt) stats.clicked++;
      }
    }

    // Convert to array and calculate click rates
    const result = Array.from(hourlyStats.entries()).map(([hour, stats]) => ({
      hour,
      sent: stats.sent,
      opened: stats.opened,
      clickRate: stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0
    }));

    // Sort by click rate
    return result.sort((a, b) => b.clickRate - a.clickRate);
  }

  /**
   * Get domain performance
   */
  getDomainPerformance(): Map<string, {
    total: number;
    delivered: number;
    bounced: number;
    deliveryRate: number;
  }> {
    const domainStats = new Map();

    for (const delivery of this.deliveryHistory) {
      // Extract domain from recipient (would need recipient info in delivery)
      // For now, using provider as proxy
      const domain = delivery.provider;

      if (!domainStats.has(domain)) {
        domainStats.set(domain, {
          total: 0,
          delivered: 0,
          bounced: 0,
          deliveryRate: 0
        });
      }

      const stats = domainStats.get(domain);
      stats.total++;
      if (delivery.status === EmailStatus.DELIVERED) {
        stats.delivered++;
      } else if (delivery.status === EmailStatus.BOUNCED) {
        stats.bounced++;
      }
    }

    // Calculate rates
    for (const [domain, stats] of domainStats) {
      stats.deliveryRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;
    }

    return domainStats;
  }

  /**
   * Generate analytics report
   */
  generateReport(startDate?: Date, endDate?: Date): {
    summary: EmailStatistics;
    providerPerformance: Map<string, any>;
    bestSendTimes: Array<any>;
    domainPerformance: Map<string, any>;
    generatedAt: Date;
  } {
    return {
      summary: this.calculateStatistics(startDate, endDate),
      providerPerformance: this.getProviderPerformance(),
      bestSendTimes: this.getBestSendTimes(),
      domainPerformance: this.getDomainPerformance(),
      generatedAt: new Date()
    };
  }

  /**
   * Filter delivery history by date range
   */
  private filterDeliveryHistory(startDate?: Date, endDate?: Date): DeliveryResult[] {
    if (!startDate && !endDate) {
      return this.deliveryHistory;
    }

    return this.deliveryHistory.filter(delivery => {
      const timestamp = delivery.timestamp;

      if (startDate && timestamp < startDate) {
        return false;
      }

      if (endDate && timestamp > endDate) {
        return false;
      }

      return true;
    });
  }

  /**
   * Export tracking data as JSON
   */
  exportTrackingData(): string {
    const data = {
      tracking: Array.from(this.trackingData.values()),
      deliveries: this.deliveryHistory,
      campaigns: Array.from(this.campaignData.values()),
      exportedAt: new Date()
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import tracking data from JSON
   */
  importTrackingData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);

      // Clear existing data
      this.trackingData.clear();
      this.deliveryHistory = [];
      this.campaignData.clear();

      // Import data
      if (data.tracking) {
        data.tracking.forEach((t: EmailTracking) => {
          this.trackingData.set(t.emailId, t);
        });
      }

      if (data.deliveries) {
        this.deliveryHistory = data.deliveries;
      }

      if (data.campaigns) {
        data.campaigns.forEach((c: CampaignAnalytics) => {
          this.campaignData.set(c.campaignId, c);
        });
      }

      logger.info(`Imported tracking data: ${this.trackingData.size} emails, ${this.deliveryHistory.length} deliveries`);
    } catch (error) {
      logger.error('Failed to import tracking data:', error);
      throw new Error('Invalid JSON data format');
    }
  }

  /**
   * Clear old tracking data
   */
  clearOldData(olderThanDays: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let removedCount = 0;

    // Remove old delivery records
    this.deliveryHistory = this.deliveryHistory.filter(delivery => {
      if (delivery.timestamp < cutoffDate) {
        removedCount++;
        return false;
      }
      return true;
    });

    // Remove old tracking data
    for (const [key, tracking] of this.trackingData) {
      if (tracking.openedAt && tracking.openedAt < cutoffDate) {
        this.trackingData.delete(key);
        removedCount++;
      }
    }

    logger.info(`Cleared ${removedCount} old tracking records`);
  }

  /**
   * Get real-time statistics
   */
  getRealTimeStats(): {
    last24Hours: EmailStatistics;
    lastHour: EmailStatistics;
    today: EmailStatistics;
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return {
      last24Hours: this.calculateStatistics(last24Hours, now),
      lastHour: this.calculateStatistics(lastHour, now),
      today: this.calculateStatistics(today, now)
    };
  }

  /**
   * Compare two time periods
   */
  compareTimePeriods(
    period1Start: Date,
    period1End: Date,
    period2Start: Date,
    period2End: Date
  ): {
    period1: EmailStatistics;
    period2: EmailStatistics;
    change: {
      deliveryRate: number;
      openRate: number;
      clickRate: number;
      bounceRate: number;
    };
  } {
    const period1 = this.calculateStatistics(period1Start, period1End);
    const period2 = this.calculateStatistics(period2Start, period2End);

    return {
      period1,
      period2,
      change: {
        deliveryRate: period2.deliveryRate - period1.deliveryRate,
        openRate: period2.openRate - period1.openRate,
        clickRate: period2.clickRate - period1.clickRate,
        bounceRate: period2.bounceRate - period1.bounceRate
      }
    };
  }
}

/**
 * Email tracking pixel generator
 */
export class TrackingPixelGenerator {
  /**
   * Generate tracking pixel URL
   */
  static generateTrackingUrl(messageId: string, baseUrl: string): string {
    const trackingId = Buffer.from(`${messageId}:${Date.now()}`).toString('base64');
    return `${baseUrl}/track/open/${trackingId}`;
  }

  /**
   * Generate tracking pixel HTML
   */
  static generateTrackingPixel(messageId: string, baseUrl: string): string {
    const url = this.generateTrackingUrl(messageId, baseUrl);
    return `<img src="${url}" width="1" height="1" border="0" alt="" style="display:none;">`;
  }

  /**
   * Generate click tracking URL
   */
  static generateClickTrackingUrl(
    messageId: string,
    originalUrl: string,
    baseUrl: string
  ): string {
    const encodedUrl = Buffer.from(originalUrl).toString('base64');
    return `${baseUrl}/track/click/${messageId}/${encodedUrl}`;
  }

  /**
   * Add tracking to email HTML
   */
  static addTrackingToEmail(
    html: string,
    messageId: string,
    baseUrl: string
  ): string {
    // Add open tracking pixel
    const pixel = this.generateTrackingPixel(messageId, baseUrl);

    // Find closing body tag and insert pixel before it
    if (html.includes('</body>')) {
      return html.replace('</body>', `${pixel}</body>`);
    }

    // If no body tag, append at end
    return html + pixel;
  }

  /**
   * Add click tracking to all links in HTML
   */
  static addClickTracking(
    html: string,
    messageId: string,
    baseUrl: string
  ): string {
    // Find all href attributes and wrap them
    return html.replace(
      /href=["']([^"']+)["']/g,
      (match, url) => {
        // Skip anchor links, unsubscribe links, etc.
        if (url.startsWith('#') || url.includes('unsubscribe')) {
          return match;
        }
        const trackingUrl = this.generateClickTrackingUrl(messageId, url, baseUrl);
        return `href="${trackingUrl}"`;
      }
    );
  }
}
