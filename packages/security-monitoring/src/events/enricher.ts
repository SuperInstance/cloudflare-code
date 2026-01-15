/**
 * Event Enricher
 * Enriches security events with additional context and intelligence
 */

import { Cache } from '@claudeflare/cache';
import { Client } from '@elastic/elasticsearch';

import {
  SecurityEvent,
  EnrichedSecurityEvent,
  EnrichmentData,
  GeoLocation,
  ThreatIntelligence,
  UserBehavior,
  HistoricalData,
  ContextualData,
} from '../types';

export interface EventEnricherConfig {
  cache: Cache;
  elasticsearch: Client;
  enableGeoLocation?: boolean;
  enableThreatIntel?: boolean;
  enableUserBehavior?: boolean;
  enableHistoricalData?: boolean;
}

export class EventEnricher {
  private config: Required<EventEnricherConfig>;
  private geoLocationCache: Map<string, GeoLocation>;
  private threatIntelCache: Map<string, ThreatIntelligence>;
  private userBehaviorCache: Map<string, UserBehavior>;

  constructor(config: EventEnricherConfig) {
    this.config = {
      enableGeoLocation: true,
      enableThreatIntel: true,
      enableUserBehavior: true,
      enableHistoricalData: true,
      ...config,
    };

    this.geoLocationCache = new Map();
    this.threatIntelCache = new Map();
    this.userBehaviorCache = new Map();
  }

  /**
   * Enrich a security event
   */
  public async enrich(event: SecurityEvent): Promise<EnrichedSecurityEvent> {
    const enrichmentData: EnrichmentData = {};
    let riskScore = 0;

    // Enrich with geolocation data
    if (this.config.enableGeoLocation && event.ipAddress) {
      const geoLocation = await this.getGeoLocation(event.ipAddress);
      if (geoLocation) {
        enrichmentData.geoLocation = geoLocation;
        riskScore += this.calculateGeoLocationRisk(geoLocation, event);
      }
    }

    // Enrich with threat intelligence
    if (this.config.enableThreatIntel) {
      const threatIntel = await this.getThreatIntelligence(event);
      if (threatIntel) {
        enrichmentData.threatIntelligence = threatIntel;
        riskScore += this.calculateThreatIntelRisk(threatIntel);
      }
    }

    // Enrich with user behavior
    if (this.config.enableUserBehavior && event.userId) {
      const userBehavior = await this.getUserBehavior(event);
      if (userBehavior) {
        enrichmentData.userBehavior = userBehavior;
        riskScore += this.calculateUserBehaviorRisk(userBehavior);
      }
    }

    // Enrich with historical data
    if (this.config.enableHistoricalData) {
      const historicalData = await this.getHistoricalData(event);
      if (historicalData) {
        enrichmentData.historicalData = historicalData;
        riskScore += this.calculateHistoricalRisk(historicalData);
      }
    }

    // Enrich with contextual data
    const contextualData = await this.getContextualData(event);
    if (contextualData) {
      enrichmentData.contextualData = contextualData;
    }

    // Calculate MITRE ATT&CK techniques
    const mitreTechniques = this.mapToMitreTechniques(event);

    // Create enriched event
    const enrichedEvent: EnrichedSecurityEvent = {
      ...event,
      enriched: true,
      enrichmentData,
      riskScore: Math.min(100, Math.max(0, riskScore)),
      mitreTechniques,
    };

    return enrichedEvent;
  }

  /**
   * Get geolocation data for an IP address
   */
  private async getGeoLocation(ipAddress: string): Promise<GeoLocation | null> {
    // Check cache first
    if (this.geoLocationCache.has(ipAddress)) {
      return this.geoLocationCache.get(ipAddress)!;
    }

    try {
      // Check Redis cache
      const cached = await this.config.cache.get<GeoLocation>(`geo:${ipAddress}`);
      if (cached) {
        this.geoLocationCache.set(ipAddress, cached);
        return cached;
      }

      // Skip private IPs
      if (this.isPrivateIp(ipAddress)) {
        return null;
      }

      // Call geolocation service (mock implementation)
      const geoLocation = await this.fetchGeoLocation(ipAddress);
      if (geoLocation) {
        // Cache for 24 hours
        await this.config.cache.set(`geo:${ipAddress}`, geoLocation, 86400);
        this.geoLocationCache.set(ipAddress, geoLocation);
      }

      return geoLocation;
    } catch (error) {
      console.error('Error fetching geolocation:', error);
      return null;
    }
  }

  /**
   * Fetch geolocation data from service
   */
  private async fetchGeoLocation(ipAddress: string): Promise<GeoLocation | null> {
    // Mock implementation - in production, integrate with real geolocation service
    // like MaxMind GeoIP2, IP-API, or similar

    try {
      // Simulate API call
      const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
      const data = await response.json();

      if (data.status === 'success') {
        return {
          country: data.countryCode || 'Unknown',
          city: data.city,
          region: data.regionName,
          latitude: data.lat,
          longitude: data.lon,
          isp: data.isp,
          asn: data.as,
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if IP is private
   */
  private isPrivateIp(ipAddress: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/i,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
    ];

    return privateRanges.some(range => range.test(ipAddress));
  }

  /**
   * Calculate risk based on geolocation
   */
  private calculateGeoLocationRisk(geoLocation: GeoLocation, event: SecurityEvent): number {
    let risk = 0;

    // High-risk countries
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
    if (highRiskCountries.includes(geoLocation.country)) {
      risk += 15;
    }

    // Check if this is a new location for the user
    if (event.userId && event.metadata) {
      // This would check against known locations for this user
      // For now, add a small risk if geolocation is available
      risk += 5;
    }

    return risk;
  }

  /**
   * Get threat intelligence for an event
   */
  private async getThreatIntelligence(event: SecurityEvent): Promise<ThreatIntelligence | null> {
    const indicators = this.extractIndicators(event);

    if (indicators.length === 0) {
      return null;
    }

    const results: ThreatIntelligence = {
      knownAttacker: false,
      reputationScore: 50,
      indicators: [],
      relatedCampaigns: [],
    };

    for (const indicator of indicators) {
      try {
        // Check cache
        const cacheKey = `threat:${indicator.type}:${indicator.value}`;
        const cached = await this.config.cache.get<any>(cacheKey);

        let intel: any;
        if (cached) {
          intel = cached;
        } else {
          // Fetch threat intelligence (mock implementation)
          intel = await this.fetchThreatIntelligence(indicator.value);
          if (intel) {
            await this.config.cache.set(cacheKey, intel, 3600);
          }
        }

        if (intel) {
          results.indicators.push(indicator.value);
          if (intel.knownAttacker) {
            results.knownAttacker = true;
          }
          results.reputationScore = Math.min(results.reputationScore, intel.reputationScore || 50);
          if (intel.campaigns) {
            results.relatedCampaigns.push(...intel.campaigns);
          }
        }
      } catch (error) {
        console.error('Error fetching threat intel:', error);
      }
    }

    return results;
  }

  /**
   * Extract indicators from event
   */
  private extractIndicators(event: SecurityEvent): Array<{ type: string; value: string }> {
    const indicators: Array<{ type: string; value: string }> = [];

    // IP address
    if (event.ipAddress) {
      indicators.push({ type: 'ip', value: event.ipAddress });
    }

    // Domain/URL from resource
    if (event.resource) {
      const domainMatch = event.resource.match(/(?:https?:\/\/)?([^\/]+)/);
      if (domainMatch) {
        indicators.push({ type: 'domain', value: domainMatch[1] });
      }
    }

    // Email from user
    if (event.userId && event.userId.includes('@')) {
      indicators.push({ type: 'email', value: event.userId });
    }

    return indicators;
  }

  /**
   * Fetch threat intelligence from service
   */
  private async fetchThreatIntelligence(indicator: string): Promise<any> {
    // Mock implementation - in production, integrate with threat intelligence feeds
    // like VirusTotal, AlienVault OTX, Recorded Future, etc.

    try {
      // Simulate API call
      const response = await fetch(`https://otx.alienvault.com/api/v1/indicators/IPv4/${indicator}/`);
      const data = await response.json();

      return {
        knownAttacker: data.reputation && data.reputation.threat_score > 50,
        reputationScore: data.reputation ? 100 - data.reputation.threat_score : 50,
        campaigns: data.pulses ? data.pulses.map((p: any) => p.name) : [],
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate risk based on threat intelligence
   */
  private calculateThreatIntelRisk(threatIntel: ThreatIntelligence): number {
    let risk = 0;

    if (threatIntel.knownAttacker) {
      risk += 30;
    }

    if (threatIntel.reputationScore < 30) {
      risk += 20;
    } else if (threatIntel.reputationScore < 50) {
      risk += 10;
    }

    if (threatIntel.indicators.length > 0) {
      risk += threatIntel.indicators.length * 5;
    }

    return risk;
  }

  /**
   * Get user behavior analysis
   */
  private async getUserBehavior(event: SecurityEvent): Promise<UserBehavior | null> {
    if (!event.userId) {
      return null;
    }

    try {
      // Get user's baseline behavior from cache/database
      const userKey = `user:behavior:${event.userId}`;
      let baseline = await this.config.cache.get<any>(userKey);

      if (!baseline) {
        baseline = {
          locations: new Set<string>(),
          devices: new Set<string>(),
          accessTimes: new Array<number>(),
          patterns: new Map<string, number>(),
        };
      }

      const userBehavior: UserBehavior = {
        isNewLocation: false,
        isNewDevice: false,
        isUnusualTime: false,
        isUnusualPattern: false,
        riskScore: 0,
        baselineDeviation: 0,
      };

      // Check for new location
      if (event.ipAddress && event.enrichmentData?.geoLocation) {
        const location = `${event.enrichmentData.geoLocation.country},${event.enrichmentData.geoLocation.city}`;
        if (!baseline.locations.has(location)) {
          userBehavior.isNewLocation = true;
          userBehavior.riskScore += 15;
          baseline.locations.add(location);
        }
      }

      // Check for new device
      if (event.userAgent) {
        const device = this.hashUserAgent(event.userAgent);
        if (!baseline.devices.has(device)) {
          userBehavior.isNewDevice = true;
          userBehavior.riskScore += 10;
          baseline.devices.add(device);
        }
      }

      // Check for unusual time
      const hour = event.timestamp.getHours();
      const normalHours = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // 9 AM - 5 PM
      if (!normalHours.includes(hour)) {
        userBehavior.isUnusualTime = true;
        userBehavior.riskScore += 10;
      }

      // Calculate baseline deviation
      const deviation = this.calculateBehavioralDeviation(event, baseline);
      userBehavior.baselineDeviation = deviation;
      if (deviation > 0.7) {
        userBehavior.isUnusualPattern = true;
        userBehavior.riskScore += 20;
      }

      // Update baseline in cache
      await this.config.cache.set(userKey, baseline, 604800); // 7 days

      return userBehavior;
    } catch (error) {
      console.error('Error analyzing user behavior:', error);
      return null;
    }
  }

  /**
   * Hash user agent for device identification
   */
  private hashUserAgent(userAgent: string): string {
    // Simple hash for demo purposes
    let hash = 0;
    for (let i = 0; i < userAgent.length; i++) {
      const char = userAgent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Calculate behavioral deviation
   */
  private calculateBehavioralDeviation(event: SecurityEvent, baseline: any): number {
    // Simplified deviation calculation
    // In production, use more sophisticated ML models

    const locationKey = event.ipAddress || 'unknown';
    const patternKey = `${event.type}:${locationKey}`;

    const accessCount = baseline.patterns.get(patternKey) || 0;
    const totalAccess = Array.from(baseline.patterns.values()).reduce((a, b) => a + b, 0);

    if (totalAccess === 0) {
      return 1; // No baseline, max deviation
    }

    const frequency = accessCount / totalAccess;
    return 1 - frequency;
  }

  /**
   * Calculate risk based on user behavior
   */
  private calculateUserBehaviorRisk(userBehavior: UserBehavior): number {
    return userBehavior.riskScore;
  }

  /**
   * Get historical data for an event
   */
  private async getHistoricalData(event: SecurityEvent): Promise<HistoricalData | null> {
    try {
      // Query similar events from Elasticsearch
      const query = {
        bool: {
          must: [
            { term: { type: event.type } },
          ],
          must_not: [
            { term: { id: event.id } },
          ],
        },
      };

      if (event.userId) {
        query.bool.must.push({ term: { userId: event.userId } });
      }

      if (event.ipAddress) {
        query.bool.must.push({ term: { ipAddress: event.ipAddress } });
      }

      const response = await this.config.elasticsearch.search({
        index: 'security-events',
        body: {
          query,
          size: 100,
          sort: [
            { timestamp: { order: 'desc' } },
          ],
        },
      });

      const hits = response.body.hits.hits;
      const historicalData: HistoricalData = {
        previousEvents: hits.length,
        similarEvents: 0,
        frequency: 0,
        trend: 'stable',
        lastOccurrence: hits.length > 0 ? new Date(hits[0]._source.timestamp) : undefined,
      };

      // Calculate frequency (events per day)
      if (hits.length > 0) {
        const oldestEvent = new Date(hits[hits.length - 1]._source.timestamp);
        const daysSince = Math.max(1, (Date.now() - oldestEvent.getTime()) / (1000 * 60 * 60 * 24));
        historicalData.frequency = hits.length / daysSince;

        // Determine trend
        const recentEvents = hits.slice(0, 10);
        const olderEvents = hits.slice(10, 20);
        if (recentEvents.length > olderEvents.length * 1.5) {
          historicalData.trend = 'increasing';
        } else if (recentEvents.length < olderEvents.length * 0.5) {
          historicalData.trend = 'decreasing';
        }
      }

      return historicalData;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return null;
    }
  }

  /**
   * Calculate risk based on historical data
   */
  private calculateHistoricalRisk(historicalData: HistoricalData): number {
    let risk = 0;

    if (historicalData.frequency > 10) {
      risk += 5; // High frequency, suspicious
    }

    if (historicalData.trend === 'increasing') {
      risk += 10; // Increasing trend, suspicious
    }

    return risk;
  }

  /**
   * Get contextual data for an event
   */
  private async getContextualData(event: SecurityEvent): Promise<ContextualData | null> {
    try {
      // Find related events, incidents, and alerts
      const relatedEvents = await this.findRelatedEvents(event);
      const relatedIncidents = await this.findRelatedIncidents(event);
      const relatedAlerts = await this.findRelatedAlerts(event);

      return {
        relatedEvents,
        relatedIncidents,
        relatedAlerts,
        dependencies: [],
      };
    } catch (error) {
      console.error('Error fetching contextual data:', error);
      return null;
    }
  }

  /**
   * Find related events
   */
  private async findRelatedEvents(event: SecurityEvent): Promise<string[]> {
    try {
      const query = {
        bool: {
          should: [
            { term: { userId: event.userId } },
            { term: { ipAddress: event.ipAddress } },
            { term: { sessionId: event.sessionId } },
            { term: { correlationId: event.correlationId } },
          ],
          minimum_should_match: 1,
        },
      };

      const response = await this.config.elasticsearch.search({
        index: 'security-events',
        body: {
          query,
          size: 10,
          _source: ['id'],
        },
      });

      return response.body.hits.hits.map((hit: any) => hit._source.id);
    } catch (error) {
      return [];
    }
  }

  /**
   * Find related incidents
   */
  private async findRelatedIncidents(event: SecurityEvent): Promise<string[]> {
    try {
      const query = {
        bool: {
          should: [
            { term: { 'relatedEvents.keyword': event.id } },
            { term: { userId: event.userId } },
          ],
          minimum_should_match: 1,
        },
      };

      const response = await this.config.elasticsearch.search({
        index: 'security-incidents',
        body: {
          query,
          size: 5,
          _source: ['id'],
        },
      });

      return response.body.hits.hits.map((hit: any) => hit._source.id);
    } catch (error) {
      return [];
    }
  }

  /**
   * Find related alerts
   */
  private async findRelatedAlerts(event: SecurityEvent): Promise<string[]> {
    try {
      const query = {
        bool: {
          should: [
            { term: { 'events.keyword': event.id } },
          ],
          minimum_should_match: 1,
        },
      };

      const response = await this.config.elasticsearch.search({
        index: 'security-alerts',
        body: {
          query,
          size: 5,
          _source: ['id'],
        },
      });

      return response.body.hits.hits.map((hit: any) => hit._source.id);
    } catch (error) {
      return [];
    }
  }

  /**
   * Map event to MITRE ATT&CK techniques
   */
  private mapToMitreTechniques(event: SecurityEvent): string[] {
    const techniques: string[] = [];

    // Map event types to MITRE techniques
    const techniqueMap: Record<string, string[]> = {
      'auth.login.failure': ['T1110 - Brute Force'],
      'auth.privilege.escalation': ['T1068 - Exploitation for Privilege Escalation'],
      'access.denied': ['T1078 - Valid Accounts'],
      'data.exported': ['T1041 - Exfiltration Over C2 Channel'],
      'data.deleted': ['T1485 - Data Destruction'],
      'malware.detected': ['T1204 - User Execution'],
      'intrusion.detected': ['T1190 - Exploit Public-Facing Application'],
      'ddos.attempt': ['T1498 - Network Denial of Service'],
      'port.scan': ['T1595.001 - Active Scanning'],
    };

    const eventType = event.type as string;
    if (techniqueMap[eventType]) {
      techniques.push(...techniqueMap[eventType]);
    }

    return techniques;
  }
}
