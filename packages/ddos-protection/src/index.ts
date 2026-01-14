/**
 * DDoS Protection Package
 * Comprehensive DDoS protection and mitigation system
 */

export * from './types';
export * from './config';
export * from './traffic/analyzer';
export * from './attack/detector';
export * from './mitigation/engine';
export * from './challenge/platform';
export * from './reputation';
export * from './analytics';
export * from './utils';

import {
  TrafficAnalyzer,
  type RequestData,
  type TrafficAnalysis,
  type StatisticsSnapshot
} from './traffic/analyzer';
import {
  AttackDetector,
  type AttackDetection
} from './attack/detector';
import {
  MitigationEngine,
  type MitigationDecision
} from './mitigation/engine';
import {
  ChallengePlatform,
  type ChallengeConfig,
  type ChallengeType
} from './challenge/platform';
import {
  IPReputationManager
} from './reputation';
import {
  AnalyticsManager
} from './analytics';
import {
  ConfigManager,
  type DDoSProtectionConfig
} from './config';
import {
  type AttackType,
  type MitigationAction,
  type RealtimeMonitoring
} from './types';
import { TimeUtils } from './utils';

/**
 * DDoS Protection result
 */
export interface DDoSProtectionResult {
  allowed: boolean;
  analysis?: TrafficAnalysis;
  attack?: AttackDetection;
  mitigation?: MitigationDecision;
  challenge?: {
    required: boolean;
    type?: ChallengeType;
    token?: string;
    html?: string;
  };
  metrics: {
    processingTime: number;
    timestamp: number;
  };
}

/**
 * Main DDoS Protection class
 */
export class DDoSProtection {
  private config: ConfigManager;
  private trafficAnalyzer: TrafficAnalyzer;
  private attackDetector: AttackDetector;
  private mitigationEngine: MitigationEngine;
  private challengePlatform: ChallengePlatform;
  private reputationManager: IPReputationManager;
  private analytics: AnalyticsManager;
  private initialized: boolean;

  constructor(config: Partial<DDoSProtectionConfig> = {}, env: string = 'production') {
    this.config = new ConfigManager(config, env);
    this.initialized = false;

    // Initialize components
    this.trafficAnalyzer = new TrafficAnalyzer({
      windowSize: 60000,
      maxWindows: 60,
      trackStatistics: true
    });

    this.attackDetector = new AttackDetector(this.trafficAnalyzer);

    this.mitigationEngine = new MitigationEngine({
      mode: this.config.getMitigationMode(),
      enableRateLimiting: true,
      enableIPBlocking: true,
      enableGeoBlocking: true,
      enableChallenge: this.config.isFeatureEnabled('challengePlatform')
    });

    this.challengePlatform = new ChallengePlatform();

    this.reputationManager = new IPReputationManager();

    this.analytics = new AnalyticsManager();

    this.initialized = true;
  }

  /**
   * Process incoming request
   */
  async processRequest(request: RequestData): Promise<DDoSProtectionResult> {
    const startTime = TimeUtils.now();
    const endTimer = TimeUtils.now;

    try {
      // Step 1: Analyze traffic
      const trafficAnalysis = await this.trafficAnalyzer.processRequest(request);

      // Step 2: Check for attacks
      const attackDetection = await this.attackDetector.analyzeRequest(request);

      // Step 3: Update IP reputation
      if (this.config.isFeatureEnabled('ipReputation')) {
        const isMalicious = attackDetection?.isAttack || false;
        this.reputationManager.updateFromRequest(request, isMalicious);
      }

      // Step 4: Determine mitigation actions
      let recommendedActions: MitigationAction[] = [];
      if (attackDetection?.isAttack) {
        recommendedActions = attackDetection.mitigationRecommended;
      }

      // Step 5: Apply mitigation
      const mitigation = await this.mitigationEngine.processRequest(request, recommendedActions);

      // Step 6: Generate challenge if needed
      let challenge: DDoSProtectionResult['challenge'] = undefined;
      if (mitigation.challengeRequired) {
        const challengeData = await this.challengePlatform.generateChallenge(
          request,
          mitigation.action?.parameters?.challengeType || 'javascript'
        );
        challenge = {
          required: true,
          type: challengeData.type,
          token: challengeData.token,
          html: challengeData.challenge
        };
      }

      // Step 7: Record analytics
      if (this.config.isFeatureEnabled('analytics')) {
        this.analytics.recordMetrics(trafficAnalysis.metrics);
        if (mitigation.action) {
          this.analytics.recordMitigation({
            action: mitigation.action,
            success: mitigation.action ? true : false,
            timeToMitigate: endTimer() - startTime,
            affectedRequests: 1,
            falsePositiveRate: 0,
            timestamp: TimeUtils.now(),
            metrics: {
              trafficBlocked: mitigation.allow ? 0 : 1,
              trafficAllowed: mitigation.allow ? 1 : 0,
              averageLatency: 0,
              cpuUsage: 0,
              memoryUsage: 0
            }
          });
        }

        if (attackDetection?.isAttack) {
          this.analytics.recordAttack(
            attackDetection.attackType,
            attackDetection.severity,
            attackDetection.sourceIps
          );
        }

        if (request.geo) {
          this.analytics.recordGeoData(
            request.geo.country,
            attackDetection?.isAttack || false
          );
        }
      }

      const processingTime = endTimer() - startTime;

      return {
        allowed: mitigation.allow,
        analysis: trafficAnalysis,
        attack: attackDetection || undefined,
        mitigation,
        challenge,
        metrics: {
          processingTime,
          timestamp: TimeUtils.now()
        }
      };

    } catch (error) {
      // Log error but allow request (fail open)
      console.error('DDoS protection error:', error);

      return {
        allowed: true,
        metrics: {
          processingTime: TimeUtils.now() - startTime,
          timestamp: TimeUtils.now()
        }
      };
    }
  }

  /**
   * Verify challenge response
   */
  async verifyChallenge(token: string, solution: string, remoteIP?: string) {
    return this.challengePlatform.verifyChallenge(token, solution, remoteIP);
  }

  /**
   * Block an IP address
   */
  blockIP(ip: string, parameters?: Record<string, any>): void {
    this.mitigationEngine.blockIP(ip, parameters);
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ip: string): boolean {
    return this.mitigationEngine.unblockIP(ip);
  }

  /**
   * Add allow list entry
   */
  allowIP(ip: string, duration?: number): void {
    this.mitigationEngine.allowIP(ip, duration);
  }

  /**
   * Block a country
   */
  blockCountry(country: string, parameters?: Record<string, any>): void {
    this.mitigationEngine.blockCountry(country, parameters);
  }

  /**
   * Unblock a country
   */
  unblockCountry(country: string): boolean {
    return this.mitigationEngine.unblockCountry(country);
  }

  /**
   * Get IP reputation
   */
  async getIPReputation(ip: string) {
    return this.reputationManager.getReputation(ip);
  }

  /**
   * Get analytics
   */
  getAnalytics(period: 'hour' | 'day' | 'week' | 'month' | 'year' = 'day') {
    return this.analytics.getAnalytics(period);
  }

  /**
   * Get real-time monitoring data
   */
  getRealtimeMonitoring(): RealtimeMonitoring {
    return this.analytics.getRealtimeMonitoring();
  }

  /**
   * Get mitigation metrics
   */
  getMitigationMetrics() {
    return this.mitigationEngine.getMetrics();
  }

  /**
   * Get active attacks
   */
  getActiveAttacks(): AttackDetection[] {
    return this.attackDetector.getActiveAttacks();
  }

  /**
   * Get configuration
   */
  getConfig(): DDoSProtectionConfig {
    return this.config.getConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DDoSProtectionConfig>): void {
    this.config.updateConfig(updates);

    // Update mitigation engine mode
    this.mitigationEngine.updateConfig({
      mode: this.config.getMitigationMode()
    });
  }

  /**
   * Get statistics
   */
  getStatistics(): StatisticsSnapshot | null {
    return this.trafficAnalyzer.getStatistics();
  }

  /**
   * Export state
   */
  exportState(): {
    config: DDoSProtectionConfig;
    mitigation: ReturnType<MitigationEngine['exportState']>;
    reputation: Array<{ ip: string; data: any }>;
    analytics: string;
  } {
    return {
      config: this.config.getConfig(),
      mitigation: this.mitigationEngine.exportState(),
      reputation: this.reputationManager.exportData(),
      analytics: this.analytics.exportData('day')
    };
  }

  /**
   * Import state
   */
  importState(state: {
    mitigation?: any;
    reputation?: any;
  }): void {
    if (state.mitigation) {
      this.mitigationEngine.importState(state.mitigation);
    }

    if (state.reputation) {
      this.reputationManager.importThreatIntel(state.reputation);
    }
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.trafficAnalyzer.reset();
    this.attackDetector.reset();
    this.mitigationEngine.reset();
    this.challengePlatform.reset();
    this.reputationManager.reset();
    this.analytics.reset();
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'down';
    components: {
      trafficAnalyzer: boolean;
      attackDetector: boolean;
      mitigationEngine: boolean;
      challengePlatform: boolean;
      reputationManager: boolean;
      analytics: boolean;
    };
  } {
    return {
      status: this.initialized ? 'healthy' : 'down',
      components: {
        trafficAnalyzer: true,
        attackDetector: true,
        mitigationEngine: true,
        challengePlatform: true,
        reputationManager: true,
        analytics: true
      }
    };
  }
}

/**
 * Factory function to create DDoS protection instance
 */
export function createDDoSProtection(
  config?: Partial<DDoSProtectionConfig>,
  env?: string
): DDoSProtection {
  return new DDoSProtection(config, env);
}

/**
 * Middleware factory for Express.js
 */
export function createDDoSProtectionMiddleware(
  ddosProtection: DDoSProtection
) {
  return async (req: any, res: any, next: any) => {
    try {
      // Extract request data
      const requestData: RequestData = {
        id: req.id || req.headers['x-request-id'] || Date.now().toString(),
        timestamp: Date.now(),
        ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
        method: req.method,
        url: req.url,
        headers: req.headers,
        userAgent: req.headers['user-agent'] || '',
        referer: req.headers['referer'],
        query: req.query,
        cookies: req.cookies,
        geo: req.geo // Assuming geo data is added by previous middleware
      };

      // Process request
      const result = await ddosProtection.processRequest(requestData);

      // Handle challenge requirement
      if (result.challenge?.required) {
        return res.status(403).send(result.challenge.html || 'Challenge required');
      }

      // Handle blocked request
      if (!result.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          reason: result.mitigation?.reason
        });
      }

      // Add analysis data to request
      req.ddosAnalysis = result.analysis;
      req.ddosAttack = result.attack;

      next();
    } catch (error) {
      console.error('DDoS protection middleware error:', error);
      next(); // Fail open
    }
  };
}

/**
 * Cloudflare Worker integration
 */
export class CloudflareDDoSProtection {
  private ddosProtection: DDoSProtection;

  constructor(config?: Partial<DDoSProtectionConfig>) {
    this.ddosProtection = new DDoSProtection(config, 'production');
  }

  /**
   * Handle Cloudflare Worker request
   */
  async handleRequest(request: Request): Promise<Response> {
    try {
      // Extract request data
      const cf = (request as any).cf || {};
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const requestData: RequestData = {
        id: headers['cf-ray'] || Date.now().toString(),
        timestamp: Date.now(),
        ip: headers['cf-connecting-ip'] || '',
        method: request.method,
        url: request.url,
        headers,
        userAgent: headers['user-agent'] || '',
        referer: headers['referer'],
        geo: {
          country: cf.country || headers['cf-ipcountry'],
          city: cf.city,
          colo: cf.colo,
          asn: parseInt(cf.asn || '0', 10)
        }
      };

      // Process request
      const result = await this.ddosProtection.processRequest(requestData);

      // Handle challenge
      if (result.challenge?.required) {
        return new Response(result.challenge.html || 'Challenge required', {
          status: 403,
          headers: {
            'Content-Type': 'text/html'
          }
        });
      }

      // Handle blocked request
      if (!result.allowed) {
        return new Response(JSON.stringify({
          error: 'Too Many Requests',
          reason: result.mitigation?.reason
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Allow request to proceed
      return null as any; // Signal to allow request

    } catch (error) {
      console.error('Cloudflare DDoS protection error:', error);
      return null as any; // Fail open
    }
  }

  /**
   * Get DDoS protection instance
   */
  getProtection(): DDoSProtection {
    return this.ddosProtection;
  }
}
