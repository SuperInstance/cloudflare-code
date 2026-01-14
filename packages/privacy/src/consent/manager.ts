/**
 * Consent Management Durable Object for GDPR compliance
 * @packageDocumentation
 */

import type {
  ConsentRecord,
  ConsentProfile,
  ConsentStatus,
  ConsentCategory,
  ConsentSource,
  GrantConsentRequest,
  RevokeConsentRequest,
  BatchConsentUpdate,
  ConsentValidationResult,
  ConsentRecommendation,
  ConsentAction,
  ConsentActor,
  ConsentAuditLog,
  CookiePreferences,
  MarketingPreferences,
  CommunicationPreferences,
  ConsentConfig,
  CookiePreferencesSchema,
  MarketingPreferencesSchema,
  CommunicationPreferencesSchema,
} from './types';

export interface Env {
  PRIVACY_CONSENT: DurableObjectNamespace;
  PRIVACY_KV: KVNamespace;
  PRIVACY_DB?: D1Database;
}

// ============================================================================
// CONSENT MANAGEMENT DURABLE OBJECT
// ============================================================================

/**
 * Consent Management Durable Object
 * Manages user consent records and preferences per GDPR requirements
 */
export class ConsentManager implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private config: ConsentConfig;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.config = this.getDefaultConfig();
  }

  /**
   * Handle incoming requests to the consent manager
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (true) {
        case path === '/consent/grant' && request.method === 'POST':
          return this.handleGrantConsent(request);
        case path === '/consent/revoke' && request.method === 'POST':
          return this.handleRevokeConsent(request);
        case path === '/consent/batch' && request.method === 'POST':
          return this.handleBatchUpdate(request);
        case path.startsWith('/consent/validate/') && request.method === 'GET':
          const category = url.pathname.split('/').pop() as ConsentCategory;
          return this.handleValidateConsent(category, url);
        case path === '/consent/profile' && request.method === 'GET':
          return this.handleGetProfile(url);
        case path === '/consent/audit' && request.method === 'GET':
          return this.handleGetAuditLog(url);
        case path === '/consent/check' && request.method === 'POST':
          return this.handleCheckConsent(request);
        case path === '/consent/renew' && request.method === 'POST':
          return this.handleRenewConsent(request);
        case path === '/consent/withdraw' && request.method === 'POST':
          return this.handleWithdrawAll(request);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Consent manager error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // ========================================================================
  // CONSENT GRANTING
  // ========================================================================

  /**
   * Grant consent for a specific category
   * GDPR Article 7: Conditions for consent
   */
  private async handleGrantConsent(request: Request): Promise<Response> {
    const body: GrantConsentRequest = await request.json();

    // Validate request
    if (!body.userId || !body.category || !body.legalBasis) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate consent record
    const now = Date.now();
    const consentRecord: ConsentRecord = {
      id: crypto.randomUUID(),
      userId: body.userId,
      category: body.category,
      status: ConsentStatus.GRANTED,
      grantedAt: now,
      updatedAt: now,
      expiresAt: this.calculateExpiry(body.category),
      condition: this.determineConsentCondition(body.category),
      purpose: body.purpose || this.getDefaultPurpose(body.category),
      legalBasis: body.legalBasis,
      source: body.source,
      ipAddress: body.ipAddress,
      userAgent: body.userAgent,
      policyVersion: body.policyVersion,
      metadata: body.metadata,
    };

    // Store consent record
    await this.storeConsent(consentRecord);

    // Log to audit trail
    await this.logConsentAction({
      id: crypto.randomUUID(),
      userId: body.userId,
      category: body.category,
      action: ConsentAction.GRANTED,
      previousStatus: ConsentStatus.PENDING,
      newStatus: ConsentStatus.GRANTED,
      timestamp: now,
      actor: ConsentActor.USER,
      ipAddress: body.ipAddress,
      userAgent: body.userAgent,
    });

    // Update user profile
    await this.updateProfileStatus(body.userId);

    return new Response(
      JSON.stringify({
        success: true,
        consent: consentRecord,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Revoke/withdraw consent
   * GDPR Article 7(3): Right to withdraw consent
   */
  private async handleRevokeConsent(request: Request): Promise<Response> {
    const body: RevokeConsentRequest = await request.json();

    // Get existing consent
    const consent = await this.getConsent(body.consentId);
    if (!consent || consent.userId !== body.userId) {
      return new Response(
        JSON.stringify({ error: 'Consent record not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update consent status
    const now = Date.now();
    consent.status = ConsentStatus.REVOKED;
    consent.updatedAt = now;
    consent.withdrawnAt = now;
    consent.withdrawalReason = body.reason;

    // Store updated consent
    await this.storeConsent(consent);

    // Log to audit trail
    await this.logConsentAction({
      id: crypto.randomUUID(),
      userId: body.userId,
      category: consent.category,
      action: ConsentAction.WITHDRAWN,
      previousStatus: ConsentStatus.GRANTED,
      newStatus: ConsentStatus.REVOKED,
      timestamp: now,
      actor: ConsentActor.USER,
      ipAddress: body.ipAddress,
      userAgent: body.userAgent,
      reason: body.reason,
    });

    // Update user profile
    await this.updateProfileStatus(body.userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Consent withdrawn successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Batch update multiple consents
   */
  private async handleBatchUpdate(request: Request): Promise<Response> {
    const body: BatchConsentUpdate = await request.json();

    const now = Date.now();
    const results: Array<{ category: ConsentCategory; success: boolean; error?: string }> = [];

    // Grant consents
    for (const category of body.grant) {
      try {
        const consentRecord: ConsentRecord = {
          id: crypto.randomUUID(),
          userId: body.userId,
          category,
          status: ConsentStatus.GRANTED,
          grantedAt: now,
          updatedAt: now,
          expiresAt: this.calculateExpiry(category),
          condition: this.determineConsentCondition(category),
          purpose: this.getDefaultPurpose(category),
          legalBasis: 'Explicit consent given by user',
          source: body.source,
          ipAddress: body.ipAddress,
          userAgent: body.userAgent,
          policyVersion: body.policyVersion,
        };

        await this.storeConsent(consentRecord);
        results.push({ category, success: true });
      } catch (error) {
        results.push({
          category,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Revoke consents
    for (const category of body.revoke) {
      try {
        const consent = await this.getActiveConsent(body.userId, category);
        if (consent) {
          consent.status = ConsentStatus.REVOKED;
          consent.updatedAt = now;
          consent.withdrawnAt = now;
          await this.storeConsent(consent);
        }
        results.push({ category, success: true });
      } catch (error) {
        results.push({
          category,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update profile
    await this.updateProfileStatus(body.userId);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // CONSENT VALIDATION
  // ========================================================================

  /**
   * Validate consent for a specific category
   */
  private async handleValidateConsent(
    category: ConsentCategory,
    url: URL
  ): Promise<Response> {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await this.validateConsent(userId, category);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Check consent for multiple operations
   */
  private async handleCheckConsent(request: Request): Promise<Response> {
    const body = await request.json();
    const { userId, categories }: { userId: string; categories: ConsentCategory[] } = body;

    const results: Record<ConsentCategory, ConsentValidationResult> = {} as any;

    for (const category of categories) {
      results[category] = await this.validateConsent(userId, category);
    }

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Validate if consent exists and is valid for a category
   * GDPR Article 6: Lawfulness of processing
   */
  async validateConsent(
    userId: string,
    category: ConsentCategory
  ): Promise<ConsentValidationResult> {
    const consents = await this.getUserConsents(userId, category);
    const now = Date.now();

    // Check if consent is required for this category
    const required = this.isConsentRequired(category);
    if (!required) {
      return {
        valid: true,
        required: false,
        granted: true,
        expired: false,
        revoked: false,
        errors: [],
        consents,
        recommendation: ConsentRecommendation.PROCEED,
      };
    }

    // Check if any consent is active and not expired
    const activeConsent = consents.find(
      (c) =>
        c.status === ConsentStatus.GRANTED &&
        (!c.expiresAt || c.expiresAt > now)
    );

    if (activeConsent) {
      return {
        valid: true,
        required: true,
        granted: true,
        expired: false,
        revoked: false,
        errors: [],
        consents: [activeConsent],
        recommendation: ConsentRecommendation.PROCEED,
      };
    }

    // Check if consent expired
    const expiredConsent = consents.find(
      (c) => c.status === ConsentStatus.GRANTED && c.expiresAt && c.expiresAt <= now
    );

    if (expiredConsent) {
      return {
        valid: false,
        required: true,
        granted: false,
        expired: true,
        revoked: false,
        errors: ['Consent has expired'],
        consents: [expiredConsent],
        recommendation: ConsentRecommendation.RENEW_CONSENT,
      };
    }

    // Check if consent was revoked
    const revokedConsent = consents.find(
      (c) => c.status === ConsentStatus.REVOKED
    );

    if (revokedConsent) {
      return {
        valid: false,
        required: true,
        granted: false,
        expired: false,
        revoked: true,
        errors: ['Consent has been withdrawn'],
        consents: [revokedConsent],
        recommendation: ConsentRecommendation.REQUEST_CONSENT,
      };
    }

    // No consent found
    return {
      valid: false,
      required: true,
      granted: false,
      expired: false,
      revoked: false,
      errors: ['No consent found'],
      consents: [],
      recommendation: ConsentRecommendation.REQUEST_CONSENT,
    };
  }

  // ========================================================================
  // CONSENT PROFILE
  // ========================================================================

  /**
   * Get user's complete consent profile
   */
  private async handleGetProfile(url: URL): Promise<Response> {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const profile = await this.getProfile(userId);

    return new Response(
      JSON.stringify(profile),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get user consent profile
   */
  async getProfile(userId: string): Promise<ConsentProfile> {
    const consents = await this.getAllUserConsents(userId);
    const now = Date.now();

    // Determine overall status
    const status = this.determineOverallStatus(consents);

    return {
      userId,
      consents,
      status,
      createdAt: consents.length > 0 ? Math.min(...consents.map((c) => c.grantedAt)) : now,
      updatedAt: consents.length > 0 ? Math.max(...consents.map((c) => c.updatedAt)) : now,
      policyVersion: this.getCurrentPolicyVersion(),
      cookiePreferences: await this.getCookiePreferences(userId),
      marketingPreferences: await this.getMarketingPreferences(userId),
      communicationPreferences: await this.getCommunicationPreferences(userId),
    };
  }

  // ========================================================================
  // CONSENT AUDIT LOG
  // ========================================================================

  /**
   * Get consent audit log
   */
  private async handleGetAuditLog(url: URL): Promise<Response> {
    const userId = url.searchParams.get('userId');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const logs = await this.getAuditLogs(userId, limit, offset);

    return new Response(
      JSON.stringify({ logs }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Log consent action to audit trail
   * GDPR Article 30: Records of processing activities
   */
  async logConsentAction(log: ConsentAuditLog): Promise<void> {
    const logsKey = `audit:${log.userId}`;
    const logs = (await this.state.storage.get<ConsentAuditLog[]>(logsKey)) || [];

    logs.unshift(log);

    // Trim logs if too many
    const maxLogs = 1000;
    const trimmedLogs = logs.slice(0, maxLogs);

    await this.state.storage.put(logsKey, trimmedLogs);

    // Also store by timestamp for time-based queries
    const timestampKey = `audit:timestamp:${log.timestamp}`;
    await this.state.storage.put(timestampKey, log);
  }

  /**
   * Get audit logs for a user
   */
  async getAuditLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ConsentAuditLog[]> {
    const logsKey = `audit:${userId}`;
    const logs = (await this.state.storage.get<ConsentAuditLog[]>(logsKey)) || [];

    return logs.slice(offset, offset + limit);
  }

  // ========================================================================
  // CONSENT RENEWAL
  // ========================================================================

  /**
   * Renew expired consent
   */
  private async handleRenewConsent(request: Request): Promise<Response> {
    const body = await request.json();
    const { userId, consentId, ipAddress, userAgent } = body;

    const consent = await this.getConsent(consentId);
    if (!consent || consent.userId !== userId) {
      return new Response(
        JSON.stringify({ error: 'Consent record not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const wasExpired = consent.expiresAt && consent.expiresAt <= now;

    // Renew consent
    consent.status = ConsentStatus.GRANTED;
    consent.updatedAt = now;
    consent.expiresAt = this.calculateExpiry(consent.category);
    consent.withdrawnAt = undefined;
    consent.withdrawalReason = undefined;

    await this.storeConsent(consent);

    // Log action
    await this.logConsentAction({
      id: crypto.randomUUID(),
      userId,
      category: consent.category,
      action: ConsentAction.RENEWED,
      previousStatus: wasExpired ? ConsentStatus.EXPIRED : ConsentStatus.GRANTED,
      newStatus: ConsentStatus.GRANTED,
      timestamp: now,
      actor: ConsentActor.USER,
      ipAddress,
      userAgent,
    });

    return new Response(
      JSON.stringify({
        success: true,
        consent,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Withdraw all consents
   * GDPR Article 17: Right to erasure
   */
  private async handleWithdrawAll(request: Request): Promise<Response> {
    const body = await request.json();
    const { userId, reason, ipAddress, userAgent } = body;

    const consents = await this.getAllUserConsents(userId);
    const now = Date.now();

    for (const consent of consents) {
      if (consent.status === ConsentStatus.GRANTED) {
        consent.status = ConsentStatus.REVOKED;
        consent.updatedAt = now;
        consent.withdrawnAt = now;
        consent.withdrawalReason = reason;

        await this.storeConsent(consent);

        await this.logConsentAction({
          id: crypto.randomUUID(),
          userId,
          category: consent.category,
          action: ConsentAction.WITHDRAWN,
          previousStatus: ConsentStatus.GRANTED,
          newStatus: ConsentStatus.REVOKED,
          timestamp: now,
          actor: ConsentActor.USER,
          ipAddress,
          userAgent,
          reason,
        });
      }
    }

    await this.updateProfileStatus(userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'All consents withdrawn',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // STORAGE OPERATIONS
  // ========================================================================

  /**
   * Store consent record
   */
  private async storeConsent(consent: ConsentRecord): Promise<void> {
    const key = `consent:${consent.id}`;
    await this.state.storage.put(key, consent);

    // Index by user and category
    const userCategoryKey = `user:${consent.userId}:category:${consent.category}`;
    const existing = (await this.state.storage.get<string[]>(userCategoryKey)) || [];
    existing.push(consent.id);
    await this.state.storage.put(userCategoryKey, existing);

    // Index by user
    const userKey = `user:${consent.userId}`;
    const userConsents = (await this.state.storage.get<string[]>(userKey)) || [];
    userConsents.push(consent.id);
    await this.state.storage.put(userKey, userConsents);
  }

  /**
   * Get consent by ID
   */
  private async getConsent(consentId: string): Promise<ConsentRecord | null> {
    const key = `consent:${consentId}`;
    return await this.state.storage.get<ConsentRecord>(key);
  }

  /**
   * Get user consents for a category
   */
  private async getUserConsents(
    userId: string,
    category: ConsentCategory
  ): Promise<ConsentRecord[]> {
    const userCategoryKey = `user:${userId}:category:${category}`;
    const consentIds = (await this.state.storage.get<string[]>(userCategoryKey)) || [];

    const consents: ConsentRecord[] = [];
    for (const id of consentIds) {
      const consent = await this.getConsent(id);
      if (consent) {
        consents.push(consent);
      }
    }

    return consents;
  }

  /**
   * Get active consent for user and category
   */
  private async getActiveConsent(
    userId: string,
    category: ConsentCategory
  ): Promise<ConsentRecord | null> {
    const consents = await this.getUserConsents(userId, category);
    const now = Date.now();

    return (
      consents.find(
        (c) => c.status === ConsentStatus.GRANTED && (!c.expiresAt || c.expiresAt > now)
      ) || null
    );
  }

  /**
   * Get all user consents
   */
  private async getAllUserConsents(userId: string): Promise<ConsentRecord[]> {
    const userKey = `user:${userId}`;
    const consentIds = (await this.state.storage.get<string[]>(userKey)) || [];

    const consents: ConsentRecord[] = [];
    for (const id of consentIds) {
      const consent = await this.getConsent(id);
      if (consent) {
        consents.push(consent);
      }
    }

    return consents;
  }

  // ========================================================================
  // PREFERENCES
  // ========================================================================

  /**
   * Get cookie preferences
   */
  async getCookiePreferences(userId: string): Promise<CookiePreferences> {
    const key = `preferences:cookies:${userId}`;
    const prefs = await this.state.storage.get<CookiePreferences>(key);

    return (
      prefs || {
        essential: true,
        functional: false,
        performance: false,
        marketing: false,
        socialMedia: false,
        updatedAt: Date.now(),
      }
    );
  }

  /**
   * Set cookie preferences
   */
  async setCookiePreferences(
    userId: string,
    preferences: Partial<CookiePreferences>
  ): Promise<CookiePreferences> {
    const key = `preferences:cookies:${userId}`;
    const current = await this.getCookiePreferences(userId);

    const updated: CookiePreferences = {
      ...current,
      ...preferences,
      updatedAt: Date.now(),
    };

    await this.state.storage.put(key, updated);
    return updated;
  }

  /**
   * Get marketing preferences
   */
  async getMarketingPreferences(userId: string): Promise<MarketingPreferences> {
    const key = `preferences:marketing:${userId}`;
    const prefs = await this.state.storage.get<MarketingPreferences>(key);

    return (
      prefs || {
        email: false,
        sms: false,
        phone: false,
        directMail: false,
        onlineAdvertising: false,
        personalizedContent: false,
        updatedAt: Date.now(),
      }
    );
  }

  /**
   * Set marketing preferences
   */
  async setMarketingPreferences(
    userId: string,
    preferences: Partial<MarketingPreferences>
  ): Promise<MarketingPreferences> {
    const key = `preferences:marketing:${userId}`;
    const current = await this.getMarketingPreferences(userId);

    const updated: MarketingPreferences = {
      ...current,
      ...preferences,
      updatedAt: Date.now(),
    };

    await this.state.storage.put(key, updated);
    return updated;
  }

  /**
   * Get communication preferences
   */
  async getCommunicationPreferences(userId: string): Promise<CommunicationPreferences> {
    const key = `preferences:communication:${userId}`;
    const prefs = await this.state.storage.get<CommunicationPreferences>(key);

    return (
      prefs || {
        newsletter: false,
        productUpdates: false,
        securityAlerts: true, // Always enabled by default
        featureAnnouncements: false,
        surveys: false,
        betaInvitations: false,
        updatedAt: Date.now(),
      }
    );
  }

  /**
   * Set communication preferences
   */
  async setCommunicationPreferences(
    userId: string,
    preferences: Partial<CommunicationPreferences>
  ): Promise<CommunicationPreferences> {
    const key = `preferences:communication:${userId}`;
    const current = await this.getCommunicationPreferences(userId);

    const updated: CommunicationPreferences = {
      ...current,
      ...preferences,
      updatedAt: Date.now(),
    };

    await this.state.storage.put(key, updated);
    return updated;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Calculate consent expiry based on category
   */
  private calculateExpiry(category: ConsentCategory): number | undefined {
    const ttl =
      this.config.consentTtls?.[category] || this.config.defaultConsentTtl;

    if (ttl === undefined) {
      return undefined;
    }

    return Date.now() + ttl;
  }

  /**
   * Determine consent condition for category
   */
  private determineConsentCondition(category: ConsentCategory): string {
    const explicitCategories = [
      ConsentCategory.HEALTH_DATA,
      ConsentCategory.BIOMETRIC_DATA,
      ConsentCategory.PROFILING,
    ];

    return explicitCategories.includes(category) ? 'explicit' : 'opt_in';
  }

  /**
   * Get default purpose for category
   */
  private getDefaultPurpose(category: ConsentCategory): string {
    const purposes: Record<ConsentCategory, string> = {
      [ConsentCategory.NECESSARY]: 'Essential service functionality',
      [ConsentCategory.LEGITIMATE_INTEREST]: 'Legitimate business interest',
      [ConsentCategory.CONTRACT]: 'Fulfill contractual obligations',
      [ConsentCategory.LEGAL_OBLIGATION]: 'Comply with legal requirements',
      [ConsentCategory.VITAL_INTERESTS]: 'Protect vital interests',
      [ConsentCategory.PUBLIC_TASK]: 'Perform public task',
      [ConsentCategory.HEALTH_DATA]: 'Health-related services',
      [ConsentCategory.BIOMETRIC_DATA]: 'Authentication and security',
      [ConsentCategory.ANALYTICS]: 'Improve service quality',
      [ConsentCategory.MARKETING]: 'Marketing communications',
      [ConsentCategory.ADVERTISING]: 'Personalized advertising',
      [ConsentCategory.FUNCTIONAL]: 'Enhanced functionality',
      [ConsentCategory.PERSONALIZATION]: 'Personalized experience',
      [ConsentCategory.RESEARCH]: 'Research and development',
      [ConsentCategory.COOKIES]: 'Cookie usage',
      [ConsentCategory.TRACKING]: 'Cross-site tracking',
      [ConsentCategory.THIRD_PARTY]: 'Third-party data sharing',
      [ConsentCategory.LOCATION]: 'Location-based services',
      [ConsentCategory.PROFILING]: 'Profiling and analysis',
    };

    return purposes[category] || 'Data processing';
  }

  /**
   * Check if consent is required for category
   */
  private isConsentRequired(category: ConsentCategory): boolean {
    // Some categories don't require consent (e.g., necessary data for contract performance)
    const noConsentRequired = [
      ConsentCategory.NECESSARY,
      ConsentCategory.LEGAL_OBLIGATION,
      ConsentCategory.CONTRACT,
      ConsentCategory.VITAL_INTERESTS,
    ];

    return !noConsentRequired.includes(category);
  }

  /**
   * Determine overall consent status from multiple consents
   */
  private determineOverallStatus(consents: ConsentRecord[]): ConsentStatus {
    if (consents.length === 0) {
      return ConsentStatus.NOT_ASKED;
    }

    const now = Date.now();
    const activeCount = consents.filter(
      (c) => c.status === ConsentStatus.GRANTED && (!c.expiresAt || c.expiresAt > now)
    ).length;
    const revokedCount = consents.filter((c) => c.status === ConsentStatus.REVOKED).length;

    if (activeCount === consents.length) {
      return ConsentStatus.GRANTED;
    } else if (revokedCount === consents.length) {
      return ConsentStatus.REVOKED;
    } else {
      return ConsentStatus.PARTIAL;
    }
  }

  /**
   * Update profile status based on consents
   */
  private async updateProfileStatus(userId: string): Promise<void> {
    const consents = await this.getAllUserConsents(userId);
    const status = this.determineOverallStatus(consents);

    const profile = await this.getProfile(userId);
    profile.status = status;
    profile.updatedAt = Date.now();

    await this.state.storage.put(`profile:${userId}`, profile);
  }

  /**
   * Get current privacy policy version
   */
  private getCurrentPolicyVersion(): string {
    return '1.0.0';
  }

  /**
   * Get default consent configuration
   */
  private getDefaultConfig(): ConsentConfig {
    return {
      defaultConsentTtl: 365 * 24 * 60 * 60 * 1000, // 1 year
      requireExplicitConsent: false,
      trackHistory: true,
      auditRetentionPeriod: 5 * 365 * 24 * 60 * 60 * 1000, // 5 years
      autoExpire: true,
      requireGranularConsent: true,
      defaultStatus: ConsentStatus.PENDING,
      useCookieConsent: true,
      cookieConsentTtl: 30 * 24 * 60 * 60 * 1000, // 30 days
      trackIpAddresses: true,
      trackUserAgents: true,
    };
  }
}
