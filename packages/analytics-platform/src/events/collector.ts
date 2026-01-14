/**
 * Event Collector
 * High-performance event collection with buffering, batching, and routing
 */

import type { AnalyticsEvent, EventType } from '../types/index.js';
import { EventTracker, EventTrackerConfig } from './tracker.js';

export interface CollectorConfig extends EventTrackerConfig {
  bufferSize: number;
  routingEnabled: boolean;
  routes: RouteConfig[];
  enrichmentEnabled: boolean;
  enrichers: EnricherConfig[];
}

export interface RouteConfig {
  name: string;
  filter: EventFilter;
  destination: string;
  priority: number;
  transform?: string;
}

export interface EventFilter {
  eventType?: EventType[];
  userIdPattern?: string;
  propertyFilter?: Record<string, any>;
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface EnricherConfig {
  name: string;
  type: 'user_profile' | 'geo_location' | 'device_info' | 'custom';
  config: Record<string, any>;
}

/**
 * Event Collector - High-performance collection system
 */
export class EventCollector {
  private tracker: EventTracker;
  private config: CollectorConfig;
  private routes: Map<string, RouteConfig> = new Map();
  private enrichers: Map<string, EventEnricher> = new Map();
  private metrics: CollectorMetrics;

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = {
      bufferSize: 10000,
      batchSize: 100,
      flushInterval: 60000,
      maxRetries: 3,
      enableValidation: true,
      enableSampling: false,
      samplingRate: 1.0,
      routingEnabled: true,
      routes: [],
      enrichmentEnabled: true,
      enrichers: [],
      ...config,
    };

    this.tracker = new EventTracker(this.config);
    this.metrics = this.createEmptyMetrics();

    this.initializeRoutes();
    this.initializeEnrichers();
  }

  /**
   * Collect event
   */
  async collect(event: AnalyticsEvent): Promise<string> {
    const startTime = Date.now();

    try {
      // Enrich event
      if (this.config.enrichmentEnabled) {
        await this.enrichEvent(event);
      }

      // Track event
      const eventId = await this.tracker.track(
        event.type,
        event.userId,
        event.properties,
        event.context,
        event.metadata
      );

      // Route event
      if (this.config.routingEnabled) {
        await this.routeEvent(event);
      }

      // Update metrics
      this.metrics.eventsCollected++;
      this.metrics.collectionTime += Date.now() - startTime;

      return eventId;
    } catch (error) {
      this.metrics.eventsFailed++;
      throw error;
    }
  }

  /**
   * Collect multiple events
   */
  async collectBatch(events: AnalyticsEvent[]): Promise<string[]> {
    const eventIds: string[] = [];

    for (const event of events) {
      const id = await this.collect(event);
      eventIds.push(id);
    }

    return eventIds;
  }

  /**
   * Collect event from HTTP request
   */
  async collectFromRequest(
    request: Request,
    userId: string,
    properties: Record<string, any> = {}
  ): Promise<string> {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // Extract event type from request
    const eventType = this.extractEventType(request, properties);

    // Build context from request
    const context = {
      userAgent,
      url: url.href,
      referrer: request.headers.get('referer') || url.href,
      platform: this.detectPlatform(userAgent),
      browser: this.detectBrowser(userAgent),
      deviceType: this.detectDeviceType(userAgent),
      ipAddress: request.headers.get('cf-connecting-ip') || '',
    };

    // Merge properties with request data
    const mergedProperties = {
      ...properties,
      method: request.method,
      path: url.pathname,
      query: url.search,
    };

    return this.tracker.track(eventType, userId, mergedProperties, context);
  }

  /**
   * Enrich event
   */
  private async enrichEvent(event: AnalyticsEvent): Promise<void> {
    for (const enricher of this.enrichers.values()) {
      try {
        await enricher.enrich(event);
      } catch (error) {
        console.error(`Enricher ${enricher.name} failed:`, error);
      }
    }
  }

  /**
   * Route event to destinations
   */
  private async routeEvent(event: AnalyticsEvent): Promise<void> {
    const matchingRoutes = this.findMatchingRoutes(event);

    for (const route of matchingRoutes) {
      try {
        await this.sendToRoute(event, route);
        this.metrics.eventsRouted++;
      } catch (error) {
        console.error(`Route ${route.name} failed:`, error);
        this.metrics.routingErrors++;
      }
    }
  }

  /**
   * Find matching routes for event
   */
  private findMatchingRoutes(event: AnalyticsEvent): RouteConfig[] {
    const routes = Array.from(this.routes.values());

    return routes
      .filter((route) => this.matchesRoute(event, route.filter))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if event matches route filter
   */
  private matchesRoute(event: AnalyticsEvent, filter: EventFilter): boolean {
    if (filter.eventType && !filter.eventType.includes(event.type)) {
      return false;
    }

    if (filter.userIdPattern) {
      const regex = new RegExp(filter.userIdPattern);
      if (!regex.test(event.userId)) {
        return false;
      }
    }

    if (filter.propertyFilter) {
      for (const [key, value] of Object.entries(filter.propertyFilter)) {
        if (event.properties[key] !== value) {
          return false;
        }
      }
    }

    if (filter.timeRange) {
      if (
        event.timestamp < filter.timeRange.start ||
        event.timestamp > filter.timeRange.end
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Send event to route destination
   */
  private async sendToRoute(event: AnalyticsEvent, route: RouteConfig): Promise<void> {
    // This would be implemented by the routing layer
    console.log(`Routing event ${event.id} to ${route.destination}`);
  }

  /**
   * Extract event type from request
   */
  private extractEventType(request: Request, properties: Record<string, any>): EventType {
    // Check for explicit event type in properties
    if (properties.event_type && this.isValidEventType(properties.event_type)) {
      return properties.event_type as EventType;
    }

    // Infer from request method and path
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'POST') {
      if (path.includes('signup') || path.includes('register')) {
        return 'signup';
      }
      if (path.includes('login') || path.includes('auth')) {
        return 'login';
      }
      if (path.includes('purchase') || path.includes('checkout')) {
        return 'purchase';
      }
      if (path.includes('subscription')) {
        return 'subscription';
      }
      if (path.includes('form') || path.includes('submit')) {
        return 'form_submit';
      }
    }

    // Default to page view
    return 'page_view';
  }

  /**
   * Check if value is valid event type
   */
  private isValidEventType(value: string): boolean {
    const validTypes: EventType[] = [
      'page_view',
      'click',
      'form_submit',
      'signup',
      'login',
      'purchase',
      'subscription',
      'feature_use',
      'error',
      'custom',
    ];
    return validTypes.includes(value as EventType);
  }

  /**
   * Detect platform from user agent
   */
  private detectPlatform(userAgent: string): string {
    if (userAgent.includes('Win')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      return 'iOS';
    }
    return 'Unknown';
  }

  /**
   * Detect browser from user agent
   */
  private detectBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
  }

  /**
   * Detect device type from user agent
   */
  private detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return 'mobile';
    }
    if (userAgent.includes('iPad') || userAgent.includes('Tablet')) {
      return 'tablet';
    }
    return 'desktop';
  }

  /**
   * Initialize routes
   */
  private initializeRoutes(): void {
    for (const route of this.config.routes) {
      this.routes.set(route.name, route);
    }
  }

  /**
   * Initialize enrichers
   */
  private initializeEnrichers(): void {
    for (const config of this.config.enrichers) {
      const enricher = this.createEnricher(config);
      if (enricher) {
        this.enrichers.set(config.name, enricher);
      }
    }
  }

  /**
   * Create enricher from config
   */
  private createEnricher(config: EnricherConfig): EventEnricher | null {
    switch (config.type) {
      case 'user_profile':
        return new UserProfileEnricher(config.config);
      case 'geo_location':
        return new GeoLocationEnricher(config.config);
      case 'device_info':
        return new DeviceInfoEnricher(config.config);
      case 'custom':
        return new CustomEnricher(config.config);
      default:
        return null;
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): CollectorMetrics {
    return {
      ...this.metrics,
      trackerMetrics: this.tracker.getStats(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): CollectorMetrics {
    return {
      eventsCollected: 0,
      eventsRouted: 0,
      eventsFailed: 0,
      routingErrors: 0,
      collectionTime: 0,
      trackerMetrics: {
        bufferSize: 0,
        handlerCount: 0,
        validatorCount: 0,
      },
    };
  }

  /**
   * Flush all pending events
   */
  async flush(): Promise<void> {
    await this.tracker.flush();
  }

  /**
   * Shutdown collector
   */
  async shutdown(): Promise<void> {
    await this.tracker.shutdown();
  }
}

export interface CollectorMetrics {
  eventsCollected: number;
  eventsRouted: number;
  eventsFailed: number;
  routingErrors: number;
  collectionTime: number;
  trackerMetrics: {
    bufferSize: number;
    handlerCount: number;
    validatorCount: number;
  };
}

/**
 * Event Enricher Interface
 */
export interface EventEnricher {
  name: string;
  enrich(event: AnalyticsEvent): Promise<void>;
}

/**
 * User Profile Enricher
 */
export class UserProfileEnricher implements EventEnricher {
  name = 'user_profile';

  constructor(private config: Record<string, any>) {}

  async enrich(event: AnalyticsEvent): Promise<void> {
    // Add user profile data to event
    // This would fetch from a user profile service
    event.properties = {
      ...event.properties,
      user_segment: await this.getUserSegment(event.userId),
      account_age: await this.getAccountAge(event.userId),
      subscription_tier: await this.getSubscriptionTier(event.userId),
    };
  }

  private async getUserSegment(userId: string): Promise<string> {
    // Implementation would fetch from user service
    return 'new';
  }

  private async getAccountAge(userId: string): Promise<number> {
    // Implementation would fetch from user service
    return 0;
  }

  private async getSubscriptionTier(userId: string): Promise<string> {
    // Implementation would fetch from subscription service
    return 'free';
  }
}

/**
 * Geo Location Enricher
 */
export class GeoLocationEnricher implements EventEnricher {
  name = 'geo_location';

  constructor(private config: Record<string, any>) {}

  async enrich(event: AnalyticsEvent): Promise<void> {
    if (event.context.ipAddress) {
      const location = await this.getLocation(event.context.ipAddress);
      event.properties = {
        ...event.properties,
        country: location.country,
        region: location.region,
        city: location.city,
        timezone: location.timezone,
      };
    }
  }

  private async getLocation(ipAddress: string): Promise<any> {
    // Implementation would use a geo IP service
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      timezone: 'Unknown',
    };
  }
}

/**
 * Device Info Enricher
 */
export class DeviceInfoEnricher implements EventEnricher {
  name = 'device_info';

  constructor(private config: Record<string, any>) {}

  async enrich(event: AnalyticsEvent): Promise<void> {
    const deviceInfo = this.parseUserAgent(event.context.userAgent);

    event.properties = {
      ...event.properties,
      device_brand: deviceInfo.brand,
      device_model: deviceInfo.model,
      os_version: deviceInfo.osVersion,
      browser_version: deviceInfo.browserVersion,
      screen_density: deviceInfo.screenDensity,
    };
  }

  private parseUserAgent(userAgent: string): any {
    // Implementation would parse user agent string
    return {
      brand: 'Unknown',
      model: 'Unknown',
      osVersion: 'Unknown',
      browserVersion: 'Unknown',
      screenDensity: 'Unknown',
    };
  }
}

/**
 * Custom Enricher
 */
export class CustomEnricher implements EventEnricher {
  name = 'custom';

  constructor(private config: Record<string, any>) {}

  async enrich(event: AnalyticsEvent): Promise<void> {
    if (this.config.enrichmentFunction) {
      const enriched = await this.config.enrichmentFunction(event);
      event.properties = {
        ...event.properties,
        ...enriched,
      };
    }
  }
}

/**
 * Event Buffer for high-performance buffering
 */
export class EventBuffer {
  private buffer: AnalyticsEvent[] = [];
  private maxSize: number;
  private flushThreshold: number;

  constructor(maxSize = 10000, flushThreshold = 1000) {
    this.maxSize = maxSize;
    this.flushThreshold = flushThreshold;
  }

  /**
   * Add event to buffer
   */
  add(event: AnalyticsEvent): boolean {
    if (this.buffer.length >= this.maxSize) {
      return false;
    }

    this.buffer.push(event);
    return true;
  }

  /**
   * Get all events
   */
  getAll(): AnalyticsEvent[] {
    return [...this.buffer];
  }

  /**
   * Get events and clear buffer
   */
  flush(): AnalyticsEvent[] {
    const events = [...this.buffer];
    this.buffer = [];
    return events;
  }

  /**
   * Get buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer should flush
   */
  shouldFlush(): boolean {
    return this.buffer.length >= this.flushThreshold;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
  }
}
