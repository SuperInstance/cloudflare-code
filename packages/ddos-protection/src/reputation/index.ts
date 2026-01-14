/**
 * IP Reputation System
 * Tracks and manages IP reputation scores for intelligent blocking
 */

import type {
  IPReputation,
  ReputationCategory,
  RequestData
} from '../types';
import { IPUtils, TimeUtils, StringUtils, CacheUtils } from '../utils';

/**
 * Reputation history entry
 */
interface ReputationHistory {
  timestamp: number;
  score: number;
  reason: string;
}

/**
 * IP reputation data with history
 */
interface IPReputationData extends IPReputation {
  history: ReputationHistory[];
  lastUpdated: number;
}

/**
 * Threat intelligence feed data
 */
interface ThreatIntel {
  ip: string;
  score: number;
  category: ReputationCategory;
  source: string;
  lastSeen: number;
  expiresAt: number;
}

/**
 * IP Reputation Manager class
 */
export class IPReputationManager {
  private reputations: Map<string, IPReputationData>;
  private threatIntelCache: Map<string, ThreatIntel>;
  private knownNetworks: Map<string, ReputationCategory>; // CIDR -> category
  private cache: Map<string, { value: IPReputation; expires: number }>;
  private readonly DEFAULT_SCORE = 0.5;
  private readonly CACHE_TTL = 3600000; // 1 hour
  private readonly MAX_HISTORY_SIZE = 100;

  constructor() {
    this.reputations = new Map();
    this.threatIntelCache = new Map();
    this.knownNetworks = new Map();
    this.cache = CacheUtils.createCache<IPReputation>(this.CACHE_TTL);

    this.initializeKnownNetworks();
    this.startCleanupTimer();
  }

  /**
   * Get IP reputation
   */
  async getReputation(ip: string): Promise<IPReputation> {
    // Check cache first
    const cached = CacheUtils.getFromCache(this.cache, ip);
    if (cached) {
      return cached;
    }

    // Get or create reputation data
    let reputationData = this.reputations.get(ip);

    if (!reputationData) {
      reputationData = await this.buildReputation(ip);
      this.reputations.set(ip, reputationData);
    }

    // Update if stale
    const now = TimeUtils.now();
    if (now - reputationData.lastUpdated > 300000) { // 5 minutes
      await this.updateReputation(ip);
      reputationData = this.reputations.get(ip)!;
    }

    // Cache the result
    CacheUtils.setInCache(this.cache, ip, reputationData, this.CACHE_TTL);

    return {
      ip: reputationData.ip,
      score: reputationData.score,
      category: reputationData.category,
      lastSeen: reputationData.lastSeen,
      totalRequests: reputationData.totalRequests,
      maliciousRequests: reputationData.maliciousRequests,
      isTor: reputationData.isTor,
      isVpn: reputationData.isVpn,
      isProxy: reputationData.isProxy,
      isDatacenter: reputationData.isDatacenter,
      abuseScore: reputationData.abuseScore,
      confidence: reputationData.confidence
    };
  }

  /**
   * Update IP reputation based on request
   */
  updateFromRequest(request: RequestData, isMalicious: boolean): void {
    let reputationData = this.reputations.get(request.ip);

    if (!reputationData) {
      reputationData = this.createDefaultReputation(request.ip);
      this.reputations.set(request.ip, reputationData);
    }

    // Update counters
    reputationData.totalRequests++;
    if (isMalicious) {
      reputationData.maliciousRequests++;
    }

    // Update score
    const oldScore = reputationData.score;
    const newScore = this.calculateScore(reputationData);
    reputationData.score = newScore;

    // Update category
    reputationData.category = this.categorizeScore(newScore);

    // Update last seen
    reputationData.lastSeen = TimeUtils.now();
    reputationData.lastUpdated = TimeUtils.now();

    // Add to history
    this.addToHistory(reputationData, oldScore, newScore, isMalicious ? 'malicious_request' : 'legitimate_request');

    // Invalidate cache
    this.cache.delete(request.ip);
  }

  /**
   * Manually set IP reputation
   */
  setReputation(ip: string, score: number, category?: ReputationCategory, reason?: string): void {
    let reputationData = this.reputations.get(ip);

    if (!reputationData) {
      reputationData = this.createDefaultReputation(ip);
      this.reputations.set(ip, reputationData);
    }

    const oldScore = reputationData.score;
    reputationData.score = Math.max(0, Math.min(1, score));
    reputationData.category = category || this.categorizeScore(reputationData.score);
    reputationData.lastUpdated = TimeUtils.now();

    this.addToHistory(reputationData, oldScore, reputationData.score, reason || 'manual_update');

    // Invalidate cache
    this.cache.delete(ip);
  }

  /**
   * Bulk import threat intelligence
   */
  importThreatIntel(intel: ThreatIntel[]): void {
    for (const entry of intel) {
      this.threatIntelCache.set(entry.ip, entry);

      // Update reputation if IP exists
      const reputationData = this.reputations.get(entry.ip);
      if (reputationData) {
        const oldScore = reputationData.score;
        reputationData.score = Math.min(reputationData.score, entry.score);
        reputationData.category = entry.category;
        reputationData.lastUpdated = TimeUtils.now();

        this.addToHistory(reputationData, oldScore, reputationData.score, `threat_intel:${entry.source}`);
      }
    }
  }

  /**
   * Add known network (CIDR)
   */
  addKnownNetwork(cidr: string, category: ReputationCategory): void {
    this.knownNetworks.set(cidr, category);
  }

  /**
   * Get reputation history for IP
   */
  getHistory(ip: string): ReputationHistory[] {
    const reputationData = this.reputations.get(ip);
    return reputationData ? [...reputationData.history] : [];
  }

  /**
   * Check if IP should be blocked based on reputation
   */
  shouldBlock(ip: string, threshold: number = 0.7): boolean {
    const reputationData = this.reputations.get(ip);
    if (!reputationData) return false;

    return reputationData.score < threshold;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalIPs: number;
    trustedIPs: number;
    neutralIPs: number;
    suspiciousIPs: number;
    maliciousIPs: number;
    knownAttackers: number;
  } {
    const stats = {
      totalIPs: this.reputations.size,
      trustedIPs: 0,
      neutralIPs: 0,
      suspiciousIPs: 0,
      maliciousIPs: 0,
      knownAttackers: 0
    };

    for (const reputation of this.reputations.values()) {
      switch (reputation.category) {
        case 'trusted':
          stats.trustedIPs++;
          break;
        case 'neutral':
          stats.neutralIPs++;
          break;
        case 'suspicious':
          stats.suspiciousIPs++;
          break;
        case 'malicious':
          stats.maliciousIPs++;
          break;
        case 'known_attacker':
          stats.knownAttackers++;
          break;
      }
    }

    return stats;
  }

  /**
   * Build reputation for new IP
   */
  private async buildReputation(ip: string): Promise<IPReputationData> {
    const data = this.createDefaultReputation(ip);

    // Check threat intelligence
    const threatIntel = this.threatIntelCache.get(ip);
    if (threatIntel && TimeUtils.now() < threatIntel.expiresAt) {
      data.score = threatIntel.score;
      data.category = threatIntel.category;
      data.abuseScore = 1 - threatIntel.score;
      data.confidence = 0.9;
    }

    // Check known networks
    for (const [cidr, category] of this.knownNetworks.entries()) {
      if (IPUtils.isIPInCIDR(ip, cidr)) {
        data.category = category;
        data.score = this.scoreForCategory(category);
        break;
      }
    }

    // Check if IP is in known ranges (TOR, VPN, etc.)
    await this.enrichReputation(data);

    data.lastUpdated = TimeUtils.now();

    return data;
  }

  /**
   * Update existing reputation
   */
  private async updateReputation(ip: string): Promise<void> {
    const reputationData = this.reputations.get(ip);
    if (!reputationData) return;

    // Refresh threat intelligence
    const threatIntel = this.threatIntelCache.get(ip);
    if (threatIntel && TimeUtils.now() < threatIntel.expiresAt) {
      reputationData.score = Math.min(reputationData.score, threatIntel.score);
      reputationData.category = threatIntel.category;
    }

    // Re-enrich data
    await this.enrichReputation(reputationData);

    reputationData.lastUpdated = TimeUtils.now();
  }

  /**
   * Enrich reputation with additional data
   */
  private async enrichReputation(data: IPReputationData): Promise<void> {
    // Check if IP is in TOR exit node list (simplified)
    // In production, would query actual TOR node list
    data.isTor = this.isTorExitNode(data.ip);

    // Check if IP is in VPN list (simplified)
    data.isVpn = this.isKnownVPN(data.ip);

    // Check if IP is a proxy
    data.isProxy = this.isKnownProxy(data.ip);

    // Check if IP is from datacenter
    data.isDatacenter = this.isDatacenterIP(data.ip);

    // Adjust score based on flags
    if (data.isTor || data.isVpn || data.isProxy) {
      data.score = Math.min(data.score + 0.2, 1.0);
    }

    if (data.isDatacenter) {
      data.score = Math.min(data.score + 0.1, 1.0);
    }

    data.category = this.categorizeScore(data.score);
  }

  /**
   * Calculate reputation score
   */
  private calculateScore(data: IPReputationData): number {
    // Base score from request ratio
    let score = this.DEFAULT_SCORE;

    if (data.totalRequests > 0) {
      const maliciousRatio = data.maliciousRequests / data.totalRequests;
      score = 1 - maliciousRatio;
    }

    // Adjust based on flags
    if (data.isTor || data.isVpn) {
      score += 0.1;
    }

    if (data.isProxy) {
      score += 0.15;
    }

    if (data.isDatacenter) {
      score += 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Categorize score
   */
  private categorizeScore(score: number): ReputationCategory {
    if (score >= 0.9) return 'trusted';
    if (score >= 0.7) return 'neutral';
    if (score >= 0.5) return 'suspicious';
    if (score >= 0.3) return 'malicious';
    return 'known_attacker';
  }

  /**
   * Get score for category
   */
  private scoreForCategory(category: ReputationCategory): number {
    switch (category) {
      case 'trusted': return 0.95;
      case 'neutral': return 0.75;
      case 'suspicious': return 0.55;
      case 'malicious': return 0.35;
      case 'known_attacker': return 0.1;
      default: return 0.5;
    }
  }

  /**
   * Create default reputation data
   */
  private createDefaultReputation(ip: string): IPReputationData {
    return {
      ip,
      score: this.DEFAULT_SCORE,
      category: 'neutral',
      lastSeen: TimeUtils.now(),
      totalRequests: 0,
      maliciousRequests: 0,
      isTor: false,
      isVpn: false,
      isProxy: false,
      isDatacenter: false,
      abuseScore: 0,
      confidence: 0.5,
      history: [],
      lastUpdated: TimeUtils.now()
    };
  }

  /**
   * Add entry to history
   */
  private addToHistory(
    data: IPReputationData,
    oldScore: number,
    newScore: number,
    reason: string
  ): void {
    data.history.push({
      timestamp: TimeUtils.now(),
      score: newScore,
      reason
    });

    // Trim history if needed
    if (data.history.length > this.MAX_HISTORY_SIZE) {
      data.history.shift();
    }
  }

  /**
   * Check if IP is TOR exit node (simplified)
   */
  private isTorExitNode(ip: string): boolean {
    // In production, would query actual TOR node list
    // For now, return false
    return false;
  }

  /**
   * Check if IP is known VPN (simplified)
   */
  private isKnownVPN(ip: string): boolean {
    // In production, would query VPN IP lists
    // For now, return false
    return false;
  }

  /**
   * Check if IP is known proxy
   */
  private isKnownProxy(ip: string): boolean {
    // Check common proxy headers patterns
    const proxyPatterns = [
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./
    ];

    return proxyPatterns.some(pattern => pattern.test(ip));
  }

  /**
   * Check if IP is from datacenter
   */
  private isDatacenterIP(ip: string): boolean {
    // In production, would query ASN data
    // For now, check common cloud provider ranges (simplified)
    const datacenterRanges = [
      '3.0.0.0/8',      // AWS (partial)
      '8.0.0.0/8',      // Level 3
      '104.16.0.0/12'   // Cloudflare
    ];

    return datacenterRanges.some(range => IPUtils.isIPInCIDR(ip, range));
  }

  /**
   * Initialize known networks
   */
  private initializeKnownNetworks(): void {
    // Add some known malicious networks (example)
    // In production, this would be loaded from threat intelligence feeds
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup();
    }, 3600000); // Run every hour
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = TimeUtils.now();
    const maxAge = 30 * 24 * 3600000; // 30 days

    // Clean old reputations
    for (const [ip, data] of this.reputations.entries()) {
      if (now - data.lastSeen > maxAge && data.totalRequests < 10) {
        this.reputations.delete(ip);
      }
    }

    // Clean expired threat intel
    for (const [ip, intel] of this.threatIntelCache.entries()) {
      if (now > intel.expiresAt) {
        this.threatIntelCache.delete(ip);
      }
    }
  }

  /**
   * Reset all reputation data
   */
  reset(): void {
    this.reputations.clear();
    this.threatIntelCache.clear();
    this.cache.clear();
  }

  /**
   * Export reputation data
   */
  exportData(): Array<{ ip: string; data: IPReputation }> {
    const exportData: Array<{ ip: string; data: IPReputation }> = [];

    for (const [ip, reputationData] of this.reputations.entries()) {
      exportData.push({
        ip,
        data: {
          ip: reputationData.ip,
          score: reputationData.score,
          category: reputationData.category,
          lastSeen: reputationData.lastSeen,
          totalRequests: reputationData.totalRequests,
          maliciousRequests: reputationData.maliciousRequests,
          isTor: reputationData.isTor,
          isVpn: reputationData.isVpn,
          isProxy: reputationData.isProxy,
          isDatacenter: reputationData.isDatacenter,
          abuseScore: reputationData.abuseScore,
          confidence: reputationData.confidence
        }
      });
    }

    return exportData;
  }
}

/**
 * IP Reputation Calculator
 */
export class IPReputationCalculator {
  /**
   * Calculate reputation score from multiple factors
   */
  static calculateScore(factors: {
    requestRatio?: number; // malicious / total
    isTor?: boolean;
    isVpn?: boolean;
    isProxy?: boolean;
    isDatacenter?: boolean;
    geoRisk?: number; // 0-1
    asnRisk?: number; // 0-1
    age?: number; // days since first seen
  }): number {
    let score = 0.5; // Start neutral

    // Request ratio (most important factor)
    if (factors.requestRatio !== undefined) {
      score = 1 - factors.requestRatio;
    }

    // Risk flags
    if (factors.isTor) score += 0.1;
    if (factors.isVpn) score += 0.1;
    if (factors.isProxy) score += 0.15;

    // Geographic risk
    if (factors.geoRisk) {
      score += factors.geoRisk * 0.1;
    }

    // ASN risk
    if (factors.asnRisk) {
      score += factors.asnRisk * 0.1;
    }

    // Age factor (older IPs get slight benefit)
    if (factors.age && factors.age > 30) {
      score += 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate abuse score
   */
  static calculateAbuseScore(reputation: IPReputation): number {
    let abuseScore = 0;

    if (reputation.isTor) abuseScore += 0.3;
    if (reputation.isVpn) abuseScore += 0.2;
    if (reputation.isProxy) abuseScore += 0.25;
    if (reputation.isDatacenter) abuseScore += 0.1;

    // Factor in request history
    if (reputation.totalRequests > 0) {
      const maliciousRatio = reputation.maliciousRequests / reputation.totalRequests;
      abuseScore += maliciousRatio * 0.5;
    }

    return Math.min(1, abuseScore);
  }

  /**
   * Calculate confidence score
   */
  static calculateConfidence(reputation: IPReputation): number {
    let confidence = 0.5;

    // More requests = higher confidence
    if (reputation.totalRequests > 100) {
      confidence += 0.2;
    } else if (reputation.totalRequests > 10) {
      confidence += 0.1;
    }

    // Known flags increase confidence
    if (reputation.isTor || reputation.isVpn || reputation.isProxy) {
      confidence += 0.2;
    }

    return Math.min(1, confidence);
  }
}
