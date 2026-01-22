/**
 * Deprecation Manager - Handle API deprecation lifecycle
 */

import {
  DeprecationRecord,
  WarningType,
  WarningSeverity,
  DeprecationWarning,
  VersionStatus,
  DeprecationHeaders,
  DeprecationPolicy,
  APIVersion,
} from '../types/index.js';

export class DeprecationManager {
  private deprecations: Map<string, DeprecationRecord[]>;
  private policy: DeprecationPolicy;
  private warningsEnabled: boolean;

  constructor(policy?: Partial<DeprecationPolicy>) {
    this.deprecations = new Map();
    this.policy = this.initializePolicy(policy);
    this.warningsEnabled = true;
  }

  /**
   * Create a new deprecation record
   */
  createDeprecation(record: DeprecationRecord): DeprecationRecord {
    this.validateDeprecation(record);

    const key = this.getDeprecationKey(record);
    const existing = this.deprecations.get(key) || [];

    existing.push(record);
    this.deprecations.set(key, existing);

    return record;
  }

  /**
   * Get deprecation by ID
   */
  getDeprecation(id: string): DeprecationRecord | undefined {
    for (const records of this.deprecations.values()) {
      const found = records.find(r => r.id === id);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Get all deprecations
   */
  getAllDeprecations(): DeprecationRecord[] {
    const all: DeprecationRecord[] = [];
    for (const records of this.deprecations.values()) {
      all.push(...records);
    }
    return all;
  }

  /**
   * Get deprecations by API version
   */
  getDeprecationsByVersion(version: string): DeprecationRecord[] {
    return this.getAllDeprecations().filter(d => d.apiVersion === version);
  }

  /**
   * Get deprecations by endpoint
   */
  getDeprecationsByEndpoint(endpoint: string): DeprecationRecord[] {
    return this.getAllDeprecations().filter(
      d => d.endpoint === endpoint
    );
  }

  /**
   * Get active deprecations (not yet sunset)
   */
  getActiveDeprecations(): DeprecationRecord[] {
    const now = new Date();
    return this.getAllDeprecations().filter(
      d => d.sunsetDate > now
    );
  }

  /**
   * Get expired deprecations (past sunset date)
   */
  getExpiredDeprecations(): DeprecationRecord[] {
    const now = new Date();
    return this.getAllDeprecations().filter(
      d => d.sunsetDate <= now
    );
  }

  /**
   * Check if endpoint is deprecated
   */
  isDeprecated(endpoint: string, version?: string): boolean {
    const deprecations = this.getDeprecationsByEndpoint(endpoint);
    if (deprecations.length === 0) return false;

    if (version) {
      return deprecations.some(d => d.apiVersion === version);
    }

    return true;
  }

  /**
   * Check if endpoint is sunset
   */
  isSunset(endpoint: string, version?: string): boolean {
    const now = new Date();
    const deprecations = this.getDeprecationsByEndpoint(endpoint);

    return deprecations.some(d => {
      if (version && d.apiVersion !== version) return false;
      return d.sunsetDate <= now;
    });
  }

  /**
   * Get deprecation for endpoint
   */
  getDeprecationForEndpoint(
    endpoint: string,
    version: string
  ): DeprecationRecord | undefined {
    return this.getDeprecationsByEndpoint(endpoint).find(
      d => d.apiVersion === version
    );
  }

  /**
   * Generate deprecation headers
   */
  generateDeprecationHeaders(
    endpoint: string,
    version: string
  ): DeprecationHeaders {
    const deprecation = this.getDeprecationForEndpoint(endpoint, version);

    if (!deprecation) {
      return { deprecation: false };
    }

    const headers: DeprecationHeaders = {
      deprecation: true,
      sunset: deprecation.sunsetDate,
    };

    if (deprecation.successorEndpoint) {
      headers.link = `<${deprecation.successorEndpoint}>; rel="successor-version"`;
    }

    if (deprecation.successorVersion) {
      headers['successor-version'] = deprecation.successorVersion;
    }

    // Generate warning header
    const daysUntilSunset = this.getDaysUntilSunset(deprecation);
    const warning = `299 - "This endpoint is deprecated and will be removed on ${deprecation.sunsetDate.toISOString()}. Please migrate to ${deprecation.successorEndpoint || 'the new version'} within ${daysUntilSunset} days."`;
    headers.warning = warning;

    headers['api-version'] = version;

    return headers;
  }

  /**
   * Generate deprecation warnings
   */
  generateWarnings(
    endpoint: string,
    version: string
  ): DeprecationWarning[] {
    const deprecation = this.getDeprecationForEndpoint(endpoint, version);

    if (!deprecation) return [];

    const warnings: DeprecationWarning[] = [];
    const daysUntilSunset = this.getDaysUntilSunset(deprecation);

    // Determine warning severity based on time until sunset
    let severity: WarningSeverity;
    if (daysUntilSunset > 90) {
      severity = WarningSeverity.INFO;
    } else if (daysUntilSunset > 30) {
      severity = WarningSeverity.WARNING;
    } else {
      severity = WarningSeverity.ERROR;
    }

    // Main deprecation warning
    warnings.push({
      type: WarningType.DEPRECATION,
      severity,
      message: `Endpoint ${endpoint} is deprecated and will be removed on ${deprecation.sunsetDate.toISOString()}`,
      code: 'DEPRECATED_ENDPOINT',
      documentation: deprecation.migrationGuide,
    });

    // Sunset warning if close to sunset date
    if (daysUntilSunset <= 30) {
      warnings.push({
        type: WarningType.SUNSET,
        severity: WarningSeverity.CRITICAL,
        message: `Endpoint will be sunset in ${daysUntilSunset} days`,
        code: 'IMMINENT_SUNSET',
      });
    }

    // Successor version warning
    if (deprecation.successorVersion) {
      warnings.push({
        type: WarningType.BREAKING_CHANGE,
        severity: WarningSeverity.INFO,
        message: `New version available: ${deprecation.successorVersion}`,
        code: 'NEW_VERSION_AVAILABLE',
      });
    }

    return warnings;
  }

  /**
   * Update deprecation record
   */
  updateDeprecation(id: string, updates: Partial<DeprecationRecord>): void {
    const record = this.getDeprecation(id);
    if (!record) {
      throw new Error(`Deprecation record ${id} not found`);
    }

    Object.assign(record, updates);

    // Validate updates
    this.validateDeprecation(record);
  }

  /**
   * Cancel deprecation
   */
  cancelDeprecation(id: string): void {
    const key = this.findDeprecationKey(id);
    if (!key) {
      throw new Error(`Deprecation record ${id} not found`);
    }

    const records = this.deprecations.get(key) || [];
    const updated = records.filter(r => r.id !== id);
    this.deprecations.set(key, updated);
  }

  /**
   * Get days until sunset
   */
  getDaysUntilSunset(deprecation: DeprecationRecord): number {
    const now = new Date();
    const sunset = deprecation.sunsetDate;
    const diff = sunset.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Check if deprecation period is valid
   */
  validateDeprecationPeriod(
    deprecationDate: Date,
    sunsetDate: Date
  ): boolean {
    const noticePeriod =
      (sunsetDate.getTime() - deprecationDate.getTime()) / (1000 * 60 * 60 * 24);
    return noticePeriod >= this.policy.minimumNoticePeriod;
  }

  /**
   * Get deprecation statistics
   */
  getDeprecationStats(): {
    total: number;
    active: number;
    expired: number;
    byVersion: Record<string, number>;
    byEndpoint: Record<string, number>;
    upcomingSunsets: Array<{ endpoint: string; version: string; days: number }>;
  } {
    const all = this.getAllDeprecations();
    const now = new Date();
    const active: DeprecationRecord[] = [];
    const expired: DeprecationRecord[] = [];
    const byVersion: Record<string, number> = {};
    const byEndpoint: Record<string, number> = {};
    const upcomingSunsets: Array<{ endpoint: string; version: string; days: number }> = [];

    for (const deprecation of all) {
      // Count by version
      byVersion[deprecation.apiVersion] = (byVersion[deprecation.apiVersion] || 0) + 1;

      // Count by endpoint
      if (deprecation.endpoint) {
        byEndpoint[deprecation.endpoint] = (byEndpoint[deprecation.endpoint] || 0) + 1;
      }

      // Categorize as active or expired
      if (deprecation.sunsetDate > now) {
        active.push(deprecation);
      } else {
        expired.push(deprecation);
      }

      // Track upcoming sunsets
      if (deprecation.sunsetDate > now) {
        const days = this.getDaysUntilSunset(deprecation);
        if (deprecation.endpoint) {
          upcomingSunsets.push({
            endpoint: deprecation.endpoint,
            version: deprecation.apiVersion,
            days,
          });
        }
      }
    }

    // Sort upcoming sunsets by days
    upcomingSunsets.sort((a, b) => a.days - b.days);

    return {
      total: all.length,
      active: active.length,
      expired: expired.length,
      byVersion,
      byEndpoint,
      upcomingSunsets: upcomingSunsets.slice(0, 10), // Top 10
    };
  }

  /**
   * Deprecate an API version
   */
  deprecateVersion(
    version: string,
    sunsetDate: Date,
    successorVersion?: string,
    reason?: string
  ): DeprecationRecord {
    const deprecationDate = new Date();

    const record: DeprecationRecord = {
      id: this.generateDeprecationId(),
      apiVersion: version,
      deprecationDate,
      sunsetDate,
      reason: reason || 'Version deprecated',
      successorVersion,
      migrationGuide: successorVersion ? `Migrate to ${successorVersion}` : undefined,
      warnings: [],
      affectedClients: [],
    };

    return this.createDeprecation(record);
  }

  /**
   * Deprecate an endpoint
   */
  deprecateEndpoint(
    endpoint: string,
    method: string,
    version: string,
    sunsetDate: Date,
    options: {
      successorEndpoint?: string;
      successorVersion?: string;
      reason?: string;
      migrationGuide?: string;
    } = {}
  ): DeprecationRecord {
    const deprecationDate = new Date();

    const record: DeprecationRecord = {
      id: this.generateDeprecationId(),
      apiVersion: version,
      endpoint,
      method,
      deprecationDate,
      sunsetDate,
      reason: options.reason || 'Endpoint deprecated',
      successorEndpoint: options.successorEndpoint,
      successorVersion: options.successorVersion,
      migrationGuide: options.migrationGuide,
      warnings: [],
      affectedClients: [],
    };

    return this.createDeprecation(record);
  }

  /**
   * Get deprecation timeline
   */
  getDeprecationTimeline(): Array<{
    date: Date;
    type: 'deprecation' | 'sunset';
    version: string;
    endpoint?: string;
    daysUntil: number;
  }> {
    const timeline: Array<{
      date: Date;
      type: 'deprecation' | 'sunset';
      version: string;
      endpoint?: string;
      daysUntil: number;
    }> = [];

    const now = new Date();

    for (const deprecation of this.getAllDeprecations()) {
      // Deprecation event
      const daysUntilDeprecation = Math.ceil(
        (deprecation.deprecationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      timeline.push({
        date: deprecation.deprecationDate,
        type: 'deprecation',
        version: deprecation.apiVersion,
        endpoint: deprecation.endpoint,
        daysUntil: daysUntilDeprecation,
      });

      // Sunset event
      const daysUntilSunset = this.getDaysUntilSunset(deprecation);
      timeline.push({
        date: deprecation.sunsetDate,
        type: 'sunset',
        version: deprecation.apiVersion,
        endpoint: deprecation.endpoint,
        daysUntil: daysUntilSunset,
      });
    }

    // Sort by date
    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

    return timeline;
  }

  /**
   * Validate deprecation record
   */
  private validateDeprecation(record: DeprecationRecord): void {
    // Check sunset date is after deprecation date
    if (record.sunsetDate <= record.deprecationDate) {
      throw new Error('Sunset date must be after deprecation date');
    }

    // Check minimum notice period
    const noticePeriod =
      (record.sunsetDate.getTime() - record.deprecationDate.getTime()) /
      (1000 * 60 * 60 * 24);
    if (noticePeriod < this.policy.minimumNoticePeriod) {
      throw new Error(
        `Notice period must be at least ${this.policy.minimumNoticePeriod} days`
      );
    }

    // Check if successor version is required
    if (this.policy.requireSuccessorVersion && !record.successorVersion) {
      throw new Error('Successor version is required');
    }

    // Check if migration guide is required
    if (this.policy.requireMigrationGuide && !record.migrationGuide) {
      throw new Error('Migration guide is required');
    }
  }

  /**
   * Initialize deprecation policy
   */
  private initializePolicy(policy?: Partial<DeprecationPolicy>): DeprecationPolicy {
    return {
      minimumNoticePeriod: 90,
      warningPeriod: 30,
      defaultSunsetPeriod: 180,
      requireSuccessorVersion: true,
      requireMigrationGuide: true,
      ...policy,
    };
  }

  /**
   * Get deprecation key for storage
   */
  private getDeprecationKey(record: DeprecationRecord): string {
    if (record.endpoint) {
      return `${record.endpoint}:${record.method || 'GET'}:${record.apiVersion}`;
    }
    return `version:${record.apiVersion}`;
  }

  /**
   * Find deprecation key by ID
   */
  private findDeprecationKey(id: string): string | undefined {
    for (const [key, records] of this.deprecations.entries()) {
      if (records.some(r => r.id === id)) {
        return key;
      }
    }
    return undefined;
  }

  /**
   * Generate unique deprecation ID
   */
  private generateDeprecationId(): string {
    return `deprecation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enable or disable warnings
   */
  setWarningsEnabled(enabled: boolean): void {
    this.warningsEnabled = enabled;
  }

  /**
   * Get policy
   */
  getPolicy(): DeprecationPolicy {
    return { ...this.policy };
  }

  /**
   * Set policy
   */
  setPolicy(policy: Partial<DeprecationPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /**
   * Export deprecations
   */
  exportDeprecations(): string {
    return JSON.stringify(Array.from(this.deprecations.values()), null, 2);
  }

  /**
   * Import deprecations
   */
  importDeprecations(data: string): void {
    const parsed = JSON.parse(data);
    this.deprecations.clear();
    for (const [key, records] of Object.entries(parsed)) {
      this.deprecations.set(key, records as DeprecationRecord[]);
    }
  }
}
