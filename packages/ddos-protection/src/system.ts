/**
 * DDoS Protection System - Optimized
 */

import type { DDoSProtectionConfig } from './config';
import { TrafficAnalyzer } from './traffic/analyzer';
import { AttackDetector } from './attack/detector';
import { MitigationEngine } from './mitigation/engine';
import { ChallengePlatform } from './challenge/platform';
import { IPReputationManager } from './reputation';
import { AnalyticsManager } from './analytics';
import { ConfigManager } from './config';

export interface DDoSProtectionResult {
  allowed: boolean;
  analysis?: any;
  attack?: any;
  mitigation?: any;
  metrics: { processingTime: number; timestamp: number };
}

export class DDoSProtection {
  private config: ConfigManager;
  private trafficAnalyzer: TrafficAnalyzer;
  private attackDetector: AttackDetector;
  private mitigationEngine: MitigationEngine;
  private challengePlatform: ChallengePlatform;
  private reputationManager: IPReputationManager;
  private analytics: AnalyticsManager;
  private initialized = false;

  constructor(config: Partial<DDoSProtectionConfig> = {}, env: string = 'production') {
    this.config = new ConfigManager(config, env);
    this.trafficAnalyzer = new TrafficAnalyzer({ windowSize: 60000, maxWindows: 60 });
    this.attackDetector = new AttackDetector({ sensitivity: 0.7, threshold: 100 });
    this.mitigationEngine = new MitigationEngine({ mode: 'auto', maxChallenges: 3 });
    this.challengePlatform = new ChallengePlatform({ type: 'hcaptcha', difficulty: 'medium' });
    this.reputationManager = new IPReputationManager({ cacheSize: 10000, ttl: 3600000 });
    this.analytics = new AnalyticsManager({ retention: 90 });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([this.trafficAnalyzer.initialize(), this.attackDetector.initialize()]);
    this.initialized = true;
  }

  async protect(request: Request): Promise<DDoSProtectionResult> {
    const startTime = Date.now();
    const requestData = await this.extractRequestData(request);

    // Analyze traffic
    const analysis = await this.trafficAnalyzer.analyze(requestData);

    // Detect attacks
    const attack = await this.attackDetector.detect(analysis);

    // Determine mitigation
    const mitigation = await this.mitigationEngine.mitigate(attack);

    // Build result
    return {
      allowed: mitigation.action === 'allow',
      analysis,
      attack,
      mitigation,
      metrics: { processingTime: Date.now() - startTime, timestamp: Date.now() }
    };
  }

  private async extractRequestData(request: Request): Promise<any> {
    return {
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || '',
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    };
  }

  getStats(): any {
    return {
      traffic: this.trafficAnalyzer.getStats(),
      attacks: this.attackDetector.getStats(),
      mitigation: this.mitigationEngine.getStats(),
      reputation: this.reputationManager.getStats(),
      analytics: this.analytics.getStats()
    };
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.trafficAnalyzer.dispose(),
      this.attackDetector.dispose(),
      this.mitigationEngine.dispose(),
      this.challengePlatform.dispose()
    ]);
  }
}

export function createDDoSProtection(config: Partial<DDoSProtectionConfig> = {}, env?: string): DDoSProtection {
  return new DDoSProtection(config, env);
}
