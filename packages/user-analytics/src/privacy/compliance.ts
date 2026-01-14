/**
 * Privacy & Compliance Module
 * GDPR, CCPA compliance and data privacy management
 */

import type {
  PrivacyRequest,
  PrivacyRequestResult,
  PrivacyRequestMetadata,
  ConsentRecord,
  ConsentEntry,
  DataClassification,
  AnalyticsEvent,
  User,
} from '../types/index.js';

// ============================================================================
// Consent Manager
// ============================================================================

export class ConsentManager {
  private consents: Map<string, ConsentRecord>;

  constructor() {
    this.consents = new Map();
  }

  /**
   * Record user consent
   */
  recordConsent(
    userId: string,
    purpose: string,
    granted: boolean,
    documentId?: string,
    ipAddress?: string
  ): void {
    const existing = this.consents.get(userId);

    if (existing) {
      const entryIndex = existing.consents.findIndex((c) => c.purpose === purpose);

      if (entryIndex >= 0) {
        existing.consents[entryIndex] = {
          purpose,
          granted,
          timestamp: Date.now(),
          ipAddress,
          documentId,
        };
      } else {
        existing.consents.push({
          purpose,
          granted,
          timestamp: Date.now(),
          ipAddress,
          documentId,
        });
      }

      existing.updatedAt = Date.now();
    } else {
      this.consents.set(userId, {
        userId,
        consents: [
          {
            purpose,
            granted,
            timestamp: Date.now(),
            ipAddress,
            documentId,
          },
        ],
        updatedAt: Date.now(),
        version: '1.0',
      });
    }
  }

  /**
   * Check if user has given consent for a purpose
   */
  hasConsent(userId: string, purpose: string): boolean {
    const record = this.consents.get(userId);

    if (!record) return false;

    const consent = record.consents.find((c) => c.purpose === purpose);

    return consent?.granted || false;
  }

  /**
   * Get all consents for a user
   */
  getConsents(userId: string): ConsentRecord | undefined {
    return this.consents.get(userId);
  }

  /**
   * Revoke all consents for a user
   */
  revokeAllConsents(userId: string): void {
    const record = this.consents.get(userId);

    if (record) {
      for (const consent of record.consents) {
        consent.granted = false;
        consent.timestamp = Date.now();
      }
      record.updatedAt = Date.now();
    }
  }

  /**
   * Export consent data for a user
   */
  exportConsents(userId: string): ConsentRecord | undefined {
    return this.consents.get(userId);
  }
}

// ============================================================================
// Data Classifier
// ============================================================================

export class DataClassifier {
  private classifications: Map<string, DataClassification>;

  constructor() {
    this.classifications = this.initializeClassifications();
  }

  /**
   * Classify data type
   */
  classify(dataType: string): DataClassification {
    return (
      this.classifications.get(dataType) || {
        dataType,
        sensitivity: 'internal',
        retention: 365 * 24 * 60 * 60 * 1000, // 1 year
        purposes: ['analytics'],
        legalBasis: 'legitimate_interest',
        requiresConsent: false,
      }
    );
  }

  /**
   * Check if data type requires consent
   */
  requiresConsent(dataType: string): boolean {
    const classification = this.classify(dataType);
    return classification.requiresConsent;
  }

  /**
   * Get retention period for data type
   */
  getRetentionPeriod(dataType: string): number {
    const classification = this.classify(dataType);
    return classification.retention;
  }

  /**
   * Check if data should be anonymized
   */
  shouldAnonymize(dataType: string): boolean {
    const classification = this.classify(dataType);
    return classification.sensitivity === 'confidential' ||
           classification.sensitivity === 'restricted';
  }

  /**
   * Initialize default data classifications
   */
  private initializeClassifications(): Map<string, DataClassification> {
    const map = new Map<string, DataClassification>();

    // Personal data
    map.set('email', {
      dataType: 'email',
      sensitivity: 'confidential',
      retention: 730 * 24 * 60 * 60 * 1000, // 2 years
      purposes: ['communication', 'analytics'],
      legalBasis: 'consent',
      requiresConsent: true,
    });

    map.set('name', {
      dataType: 'name',
      sensitivity: 'confidential',
      retention: 730 * 24 * 60 * 60 * 1000,
      purposes: ['communication', 'analytics'],
      legalBasis: 'consent',
      requiresConsent: true,
    });

    map.set('ip_address', {
      dataType: 'ip_address',
      sensitivity: 'confidential',
      retention: 30 * 24 * 60 * 60 * 1000, // 30 days
      purposes: ['security', 'analytics'],
      legalBasis: 'legitimate_interest',
      requiresConsent: false,
    });

    // Behavioral data
    map.set('page_views', {
      dataType: 'page_views',
      sensitivity: 'internal',
      retention: 365 * 24 * 60 * 60 * 1000,
      purposes: ['analytics'],
      legalBasis: 'legitimate_interest',
      requiresConsent: false,
    });

    map.set('clicks', {
      dataType: 'clicks',
      sensitivity: 'internal',
      retention: 365 * 24 * 60 * 60 * 1000,
      purposes: ['analytics'],
      legalBasis: 'legitimate_interest',
      requiresConsent: false,
    });

    map.set('sessions', {
      dataType: 'sessions',
      sensitivity: 'internal',
      retention: 365 * 24 * 60 * 60 * 1000,
      purposes: ['analytics'],
      legalBasis: 'legitimate_interest',
      requiresConsent: false,
    });

    // Sensitive data
    map.set('payment_info', {
      dataType: 'payment_info',
      sensitivity: 'restricted',
      retention: 180 * 24 * 60 * 60 * 1000, // 6 months
      purposes: ['payment_processing'],
      legalBasis: 'contract',
      requiresConsent: true,
    });

    map.set('health_data', {
      dataType: 'health_data',
      sensitivity: 'restricted',
      retention: 365 * 24 * 60 * 60 * 1000,
      purposes: ['health_monitoring'],
      legalBasis: 'explicit_consent',
      requiresConsent: true,
    });

    return map;
  }
}

// ============================================================================
// Privacy Request Processor
// ============================================================================

export class PrivacyRequestProcessor {
  private consentManager: ConsentManager;
  private dataClassifier: DataClassifier;
  private requests: Map<string, PrivacyRequest>;

  constructor() {
    this.consentManager = new ConsentManager();
    this.dataClassifier = new DataClassifier();
    this.requests = new Map();
  }

  /**
   * Create a privacy request
   */
  createRequest(
    type: 'access' | 'deletion' | 'rectification' | 'objection',
    userId?: string,
    anonymousId?: string,
    email?: string,
    metadata?: Partial<PrivacyRequestMetadata>
  ): PrivacyRequest {
    const request: PrivacyRequest = {
      id: `privacy_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      userId,
      anonymousId,
      email,
      status: 'pending',
      requestedAt: Date.now(),
      metadata: {
        source: metadata?.source || 'custom',
        jurisdiction: metadata?.jurisdiction || 'unknown',
        requestId: metadata?.requestId || '',
        verified: metadata?.verified || false,
        notes: metadata?.notes,
      },
    };

    this.requests.set(request.id, request);
    return request;
  }

  /**
   * Process a privacy request
   */
  async processRequest(
    requestId: string,
    events: AnalyticsEvent[],
    users: User[]
  ): Promise<PrivacyRequestResult> {
    const request = this.requests.get(requestId);

    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    request.status = 'processing';
    request.processedAt = Date.now();

    try {
      let result: PrivacyRequestResult;

      switch (request.type) {
        case 'access':
          result = await this.processAccessRequest(request, events, users);
          break;
        case 'deletion':
          result = await this.processDeletionRequest(request, events, users);
          break;
        case 'rectification':
          result = await this.processRectificationRequest(request, users);
          break;
        case 'objection':
          result = await this.processObjectionRequest(request);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      request.status = 'completed';
      request.completedAt = Date.now();
      request.result = result;

      return result;
    } catch (error) {
      request.status = 'failed';
      request.completedAt = Date.now();
      throw error;
    }
  }

  /**
   * Process access request (GDPR right to access)
   */
  private async processAccessRequest(
    request: PrivacyRequest,
    events: AnalyticsEvent[],
    users: User[]
  ): Promise<PrivacyRequestResult> {
    const userEvents = this.filterUserEvents(events, request);
    const user = this.findUser(users, request);

    const dataFound = userEvents.length > 0 || !!user;

    // Export data
    const exportData = {
      user: user ? this.sanitizeUserData(user) : null,
      events: userEvents.map((e) => this.sanitizeEventData(e)),
      consents: user ? this.consentManager.getConsents(user.id) : null,
      metadata: {
        exportedAt: Date.now(),
        requestId: request.id,
      },
    };

    return {
      dataFound,
      dataLocations: ['analytics_events', 'users'],
      recordsProcessed: userEvents.length + (user ? 1 : 0),
      recordsDeleted: 0,
      exportUrl: `/exports/${request.id}.json`, // In production, generate actual URL
    };
  }

  /**
   * Process deletion request (GDPR right to be forgotten)
   */
  private async processDeletionRequest(
    request: PrivacyRequest,
    events: AnalyticsEvent[],
    users: User[]
  ): Promise<PrivacyRequestResult> {
    const userEvents = this.filterUserEvents(events, request);
    const user = this.findUser(users, request);

    let recordsDeleted = 0;

    // Delete events
    const eventsToDelete = userEvents.map((e) => e.id);
    recordsDeleted += eventsToDelete.length;

    // Delete user
    if (user) {
      recordsDeleted += 1;
    }

    // Revoke consents
    if (user) {
      this.consentManager.revokeAllConsents(user.id);
    }

    return {
      dataFound: userEvents.length > 0 || !!user,
      dataLocations: ['analytics_events', 'users'],
      recordsProcessed: userEvents.length + (user ? 1 : 0),
      recordsDeleted,
    };
  }

  /**
   * Process rectification request (GDPR right to rectification)
   */
  private async processRectificationRequest(
    request: PrivacyRequest,
    users: User[]
  ): Promise<PrivacyRequestResult> {
    const user = this.findUser(users, request);

    if (!user) {
      return {
        dataFound: false,
        dataLocations: [],
        recordsProcessed: 0,
        recordsDeleted: 0,
      };
    }

    // Return user data for rectification
    return {
      dataFound: true,
      dataLocations: ['users'],
      recordsProcessed: 1,
      recordsDeleted: 0,
    };
  }

  /**
   * Process objection request (GDPR right to object)
   */
  private async processObjectionRequest(
    request: PrivacyRequest
  ): Promise<PrivacyRequestResult> {
    // Revoke all consents for the user
    if (request.userId) {
      this.consentManager.revokeAllConsents(request.userId);
    }

    return {
      dataFound: true,
      dataLocations: ['consents'],
      recordsProcessed: 1,
      recordsDeleted: 0,
    };
  }

  /**
   * Filter events for user
   */
  private filterUserEvents(events: AnalyticsEvent[], request: PrivacyRequest): AnalyticsEvent[] {
    return events.filter((e) => {
      if (request.userId) return e.userId === request.userId;
      if (request.anonymousId) return e.anonymousId === request.anonymousId;
      if (request.email && e.userProperties) {
        return (e.userProperties as any).email === request.email;
      }
      return false;
    });
  }

  /**
   * Find user
   */
  private findUser(users: User[], request: PrivacyRequest): User | undefined {
    return users.find((u) => {
      if (request.userId) return u.id === request.userId;
      if (request.anonymousId) return u.anonymousId === request.anonymousId;
      if (request.email) return u.email === request.email;
      return false;
    });
  }

  /**
   * Sanitize user data for export
   */
  private sanitizeUserData(user: User): any {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      properties: user.properties,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
      // Exclude sensitive data
    };
  }

  /**
   * Sanitize event data for export
   */
  private sanitizeEventData(event: AnalyticsEvent): any {
    return {
      id: event.id,
      eventType: event.eventType,
      eventName: event.eventName,
      timestamp: event.timestamp,
      properties: event.properties,
      context: {
        platform: event.context.platform,
        browser: event.context.browser,
        // Exclude IP and other sensitive data
      },
    };
  }

  /**
   * Get request status
   */
  getRequest(requestId: string): PrivacyRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * List all requests
   */
  listRequests(): PrivacyRequest[] {
    return Array.from(this.requests.values());
  }
}

// ============================================================================
// Data Anonymizer
// ============================================================================

export class DataAnonymizer {
  private dataClassifier: DataClassifier;

  constructor() {
    this.dataClassifier = new DataClassifier();
  }

  /**
   * Anonymize an event
   */
  anonymizeEvent(event: AnalyticsEvent): AnalyticsEvent {
    const anonymized = { ...event };

    // Anonymize IP address
    if (anonymized.context.ip) {
      anonymized.context.ip = this.anonymizeIP(anonymized.context.ip);
    }

    // Anonymize user agent
    if (anonymized.context.userAgent) {
      anonymized.context.userAgent = this.anonymizeUserAgent(anonymized.context.userAgent);
    }

    // Anonymize user properties
    if (anonymized.userProperties) {
      anonymized.userProperties = this.anonymizeObject(anonymized.userProperties);
    }

    // Hash user ID
    if (anonymized.userId) {
      anonymized.userId = this.hashValue(anonymized.userId);
    }

    return anonymized;
  }

  /**
   * Anonymize a user
   */
  anonymizeUser(user: User): User {
    return {
      ...user,
      email: undefined,
      firstName: undefined,
      lastName: undefined,
      name: undefined,
      avatar: undefined,
      properties: this.anonymizeObject(user.properties),
      demographics: this.anonymizeObject(user.demographics || {}),
      metadata: {
        ...user.metadata,
        anonymized: true,
        anonymizedAt: Date.now(),
      },
    };
  }

  /**
   * Anonymize IP address
   */
  private anonymizeIP(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      // Zero out last octet
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
    return this.hashValue(ip);
  }

  /**
   * Anonymize user agent
   */
  private anonymizeUserAgent(userAgent: string): string {
    // Keep browser info but remove version and build details
    return userAgent
      .replace(/\d+\.\d+\.\d+\.\d+/g, 'X.X.X.X')
      .replace(/[a-f0-9]{32,}/gi, 'REDACTED');
  }

  /**
   * Anonymize object properties
   */
  private anonymizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const anonymized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.dataClassifier.shouldAnonymize(key)) {
        anonymized[key] = this.hashValue(String(value));
      } else if (typeof value === 'object' && value !== null) {
        anonymized[key] = this.anonymizeObject(value as Record<string, unknown>);
      } else {
        anonymized[key] = value;
      }
    }

    return anonymized;
  }

  /**
   * Hash a value
   */
  private hashValue(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `HASH_${Math.abs(hash).toString(16)}`;
  }
}

// ============================================================================
// Data Retention Manager
// ============================================================================

export class DataRetentionManager {
  private dataClassifier: DataClassifier;

  constructor() {
    this.dataClassifier = new DataClassifier();
  }

  /**
   * Check if data should be retained
   */
  shouldRetain(dataType: string, createdAt: number): boolean {
    const retentionPeriod = this.dataClassifier.getRetentionPeriod(dataType);
    const age = Date.now() - createdAt;

    return age < retentionPeriod;
  }

  /**
   * Get data eligible for deletion
   */
  getEligibleForDeletion(events: AnalyticsEvent[]): AnalyticsEvent[] {
    const now = Date.now();

    return events.filter((event) => {
      const retentionPeriod = this.dataClassifier.getRetentionPeriod(event.eventType);
      const age = now - event.timestamp;

      return age >= retentionPeriod;
    });
  }

  /**
   * Calculate retention score
   */
  calculateRetentionScore(event: AnalyticsEvent): number {
    const retentionPeriod = this.dataClassifier.getRetentionPeriod(event.eventType);
    const age = Date.now() - event.timestamp;

    // Score from 0 (should delete) to 1 (keep)
    return Math.max(0, 1 - age / retentionPeriod);
  }
}
