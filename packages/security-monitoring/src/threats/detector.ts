/**
 * Threat Detector
 * Multi-layered threat detection system with pattern-based, anomaly-based,
 * behavioral, and ML-based detection capabilities
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { Client } from '@elastic/elasticsearch';
import Redis from 'ioredis';
import cron from 'cron';

import {
  SecurityEvent,
  Threat,
  ThreatType,
  ThreatLevel,
  SecurityEventSeverity,
  EnrichedSecurityEvent,
} from '../types';
import { PatternBasedDetector } from './pattern-detector';
import { AnomalyDetector } from './anomaly-detector';
import { BehavioralAnalyzer } from './behavioral-analyzer';
import { MLBasedDetector } from './ml-detector';
import { ThreatScorer } from './threat-scorer';
import { DetectionRule } from '../types';
import { Cache } from '@claudeflare/cache';

// ============================================================================
// DETECTOR CONFIGURATION
// ============================================================================

export interface ThreatDetectorConfig {
  // Detection Configuration
  enablePatternDetection?: boolean;
  enableAnomalyDetection?: boolean;
  enableBehavioralAnalysis?: boolean;
  enableMLDetection?: boolean;

  // Threshold Configuration
  defaultThreshold?: number;
  highRiskThreshold?: number;
  criticalThreshold?: number;

  // Storage Configuration
  elasticsearchUrl?: string;
  elasticsearchIndex?: string;
  redisUrl?: string;
  redisKeyPrefix?: string;

  // Alert Configuration
  enableAlerts?: boolean;
  alertChannels?: string[];

  // ML Model Configuration
  mlModelPath?: string;
  mlModelUpdateInterval?: number;

  // Analysis Configuration
  analysisWindow?: number; // seconds
  minEventsForAnalysis?: number;
}

const DEFAULT_CONFIG: ThreatDetectorConfig = {
  enablePatternDetection: true,
  enableAnomalyDetection: true,
  enableBehavioralAnalysis: true,
  enableMLDetection: true,
  defaultThreshold: 50,
  highRiskThreshold: 70,
  criticalThreshold: 90,
  elasticsearchUrl: 'http://localhost:9200',
  elasticsearchIndex: 'threats',
  redisUrl: 'redis://localhost:6379',
  redisKeyPrefix: 'threat-detection:',
  enableAlerts: true,
  alertChannels: ['webhook', 'email'],
  mlModelUpdateInterval: 86400, // 24 hours
  analysisWindow: 3600, // 1 hour
  minEventsForAnalysis: 10,
};

// ============================================================================
// DETECTOR METRICS
// ============================================================================

export interface DetectorMetrics {
  totalEventsAnalyzed: number;
  totalThreatsDetected: number;
  totalThreatsBlocked: number;
  totalFalsePositives: number;
  averageDetectionTime: number;
  detectionRate: number;
  falsePositiveRate: number;
  byType: Record<ThreatType, number>;
  byLevel: Record<ThreatLevel, number>;
}

// ============================================================================
// MAIN DETECTOR CLASS
// ============================================================================

export class ThreatDetector extends EventEmitter {
  private config: Required<ThreatDetectorConfig>;
  private patternDetector: PatternBasedDetector;
  private anomalyDetector: AnomalyDetector;
  private behavioralAnalyzer: BehavioralAnalyzer;
  private mlDetector: MLBasedDetector;
  private threatScorer: ThreatScorer;
  private cache: Cache;
  private redis: Redis;
  private elasticsearch: Client;
  private metrics: DetectorMetrics;
  private isInitialized: boolean = false;
  private analysisTimer?: NodeJS.Timeout;
  private rules: Map<string, DetectionRule> = new Map();

  constructor(config: ThreatDetectorConfig = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ThreatDetectorConfig>;
    this.metrics = this.initializeMetrics();

    // Initialize components (will be initialized in init())
    this.patternDetector = null as any;
    this.anomalyDetector = null as any;
    this.behavioralAnalyzer = null as any;
    this.mlDetector = null as any;
    this.threatScorer = null as any;
    this.cache = null as any;
    this.redis = null as any;
    this.elasticsearch = null as any;
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize the threat detector
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('ThreatDetector already initialized');
      return;
    }

    try {
      console.log('Initializing ThreatDetector...');

      // Initialize Redis
      this.redis = new Redis(this.config.redisUrl);

      // Initialize Elasticsearch
      this.elasticsearch = new Client({
        node: this.config.elasticsearchUrl,
      });

      // Initialize cache
      this.cache = new Cache({
        client: this.redis,
        prefix: this.config.redisKeyPrefix,
      });

      // Initialize detectors
      this.patternDetector = new PatternBasedDetector({
        cache: this.cache,
        elasticsearch: this.elasticsearch,
      });

      this.anomalyDetector = new AnomalyDetector({
        cache: this.cache,
        elasticsearch: this.elasticsearch,
        window: this.config.analysisWindow,
      });

      this.behavioralAnalyzer = new BehavioralAnalyzer({
        cache: this.cache,
        elasticsearch: this.elasticsearch,
      });

      this.mlDetector = new MLBasedDetector({
        modelPath: this.config.mlModelPath,
        cache: this.cache,
      });

      this.threatScorer = new ThreatScorer({
        defaultThreshold: this.config.defaultThreshold,
        highRiskThreshold: this.config.highRiskThreshold,
        criticalThreshold: this.config.criticalThreshold,
      });

      // Load detection rules
      await this.loadDetectionRules();

      // Setup periodic analysis
      this.setupPeriodicAnalysis();

      // Setup ML model updates
      if (this.config.enableMLDetection) {
        this.setupMLModelUpdates();
      }

      this.isInitialized = true;
      console.log('ThreatDetector initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize ThreatDetector', error);
      throw error;
    }
  }

  /**
   * Shutdown the threat detector
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log('Shutting down ThreatDetector...');

    try {
      // Stop periodic analysis
      if (this.analysisTimer) {
        clearInterval(this.analysisTimer);
      }

      // Close connections
      await this.redis.quit();
      await this.elasticsearch.close();

      this.isInitialized = false;
      console.log('ThreatDetector shut down successfully');
      this.emit('shutdown');
    } catch (error) {
      console.error('Error during shutdown', error);
      throw error;
    }
  }

  // ========================================================================
  // THREAT DETECTION
  // ========================================================================

  /**
   * Analyze a security event for threats
   */
  public async analyzeEvent(event: EnrichedSecurityEvent): Promise<Threat[]> {
    if (!this.isInitialized) {
      throw new Error('ThreatDetector not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    const threats: Threat[] = [];

    try {
      this.metrics.totalEventsAnalyzed++;

      // Pattern-based detection
      if (this.config.enablePatternDetection) {
        const patternThreats = await this.patternDetector.detect(event);
        threats.push(...patternThreats);
      }

      // Anomaly detection
      if (this.config.enableAnomalyDetection) {
        const anomalyThreats = await this.anomalyDetector.detect(event);
        threats.push(...anomalyThreats);
      }

      // Behavioral analysis
      if (this.config.enableBehavioralAnalysis) {
        const behavioralThreats = await this.behavioralAnalyzer.detect(event);
        threats.push(...behavioralThreats);
      }

      // ML-based detection
      if (this.config.enableMLDetection) {
        const mlThreats = await this.mlDetector.detect(event);
        threats.push(...mlThreats);
      }

      // Score and rank threats
      const scoredThreats = await this.scoreThreats(threats);

      // Store threats
      await this.storeThreats(scoredThreats);

      // Update metrics
      const detectionTime = Date.now() - startTime;
      this.updateMetrics(scoredThreats, detectionTime);

      // Emit events
      scoredThreats.forEach(threat => {
        this.emit('threatDetected', threat);

        if (threat.level >= ThreatLevel.CRITICAL) {
          this.emit('criticalThreat', threat);
        }

        if (threat.level >= ThreatLevel.HIGH) {
          this.emit('highRiskThreat', threat);
        }
      });

      return scoredThreats;
    } catch (error) {
      console.error('Error analyzing event for threats', error);
      throw error;
    }
  }

  /**
   * Analyze multiple events in batch
   */
  public async analyzeBatch(events: EnrichedSecurityEvent[]): Promise<Threat[]> {
    if (!this.isInitialized) {
      throw new Error('ThreatDetector not initialized. Call initialize() first.');
    }

    const allThreats: Threat[] = [];

    for (const event of events) {
      const threats = await this.analyzeEvent(event);
      allThreats.push(...threats);
    }

    return allThreats;
  }

  // ========================================================================
  // THREAT SCORING
  // ========================================================================

  /**
   * Score threats and determine their level
   */
  private async scoreThreats(threats: Threat[]): Promise<Threat[]> {
    const scoredThreats = await Promise.all(
      threats.map(async (threat) => {
        const scored = await this.threatScorer.score(threat);
        return scored;
      })
    );

    // Sort by score (descending)
    scoredThreats.sort((a, b) => b.level - a.level);

    return scoredThreats;
  }

  // ========================================================================
  // THREAT STORAGE
  // ========================================================================

  /**
   * Store detected threats
   */
  private async storeThreats(threats: Threat[]): Promise<void> {
    if (threats.length === 0) {
      return;
    }

    // Bulk index threats
    const body = threats.flatMap(threat => [
      { index: { _index: this.config.elasticsearchIndex, _id: threat.id } },
      threat,
    ]);

    await this.elasticsearch.bulk({
      body,
      refresh: false,
    });
  }

  // ========================================================================
  // DETECTION RULES
  // ========================================================================

  /**
   * Load detection rules
   */
  private async loadDetectionRules(): Promise<void> {
    try {
      // Load default rules
      const defaultRules = this.getDefaultRules();
      defaultRules.forEach(rule => {
        this.rules.set(rule.id, rule);
      });

      // Load custom rules from storage
      const customRules = await this.loadCustomRules();
      customRules.forEach(rule => {
        this.rules.set(rule.id, rule);
      });

      // Update detectors with rules
      await this.patternDetector.updateRules(
        Array.from(this.rules.values()).filter(r => r.type === 'pattern')
      );

      await this.anomalyDetector.updateRules(
        Array.from(this.rules.values()).filter(r => r.type === 'anomaly')
      );

      await this.behavioralAnalyzer.updateRules(
        Array.from(this.rules.values()).filter(r => r.type === 'behavioral')
      );

      await this.mlDetector.updateRules(
        Array.from(this.rules.values()).filter(r => r.type === 'ml')
      );

      console.log(`Loaded ${this.rules.size} detection rules`);
    } catch (error) {
      console.error('Failed to load detection rules', error);
    }
  }

  /**
   * Get default detection rules
   */
  private getDefaultRules(): DetectionRule[] {
    return [
      // Pattern-based rules
      {
        id: 'sql-injection-pattern',
        name: 'SQL Injection Pattern',
        description: 'Detects SQL injection attempts in API calls',
        type: 'pattern',
        enabled: true,
        severity: SecurityEventSeverity.CRITICAL,
        conditions: [
          {
            field: 'type',
            operator: 'equals',
            value: 'api.call',
          },
          {
            field: 'resource',
            operator: 'matches',
            value: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i,
          },
        ],
        actions: [
          {
            type: 'alert',
            config: {},
          },
          {
            type: 'block',
            config: {},
          },
        ],
        falsePositiveRate: 0.05,
        detectionRate: 0.95,
        lastTuned: new Date(),
        version: 1,
      },
      {
        id: 'xss-pattern',
        name: 'XSS Pattern',
        description: 'Detects cross-site scripting attempts',
        type: 'pattern',
        enabled: true,
        severity: SecurityEventSeverity.HIGH,
        conditions: [
          {
            field: 'type',
            operator: 'equals',
            value: 'api.call',
          },
          {
            field: 'resource',
            operator: 'matches',
            value: /<script|javascript:|onerror=|onload=/i,
          },
        ],
        actions: [
          {
            type: 'alert',
            config: {},
          },
        ],
        falsePositiveRate: 0.1,
        detectionRate: 0.9,
        lastTuned: new Date(),
        version: 1,
      },
      // Anomaly detection rules
      {
        id: 'unusual-login-time',
        name: 'Unusual Login Time',
        description: 'Detects logins at unusual times',
        type: 'anomaly',
        enabled: true,
        severity: SecurityEventSeverity.MEDIUM,
        conditions: [
          {
            field: 'type',
            operator: 'equals',
            value: 'auth.login.success',
          },
          {
            field: 'timestamp',
            operator: 'in',
            value: [0, 1, 2, 3, 4, 5, 22, 23], // Late night/early morning hours
          },
        ],
        actions: [
          {
            type: 'alert',
            config: {},
          },
        ],
        falsePositiveRate: 0.2,
        detectionRate: 0.7,
        lastTuned: new Date(),
        version: 1,
      },
      // Behavioral rules
      {
        id: 'rapid-login-failures',
        name: 'Rapid Login Failures',
        description: 'Detects multiple failed login attempts',
        type: 'behavioral',
        enabled: true,
        severity: SecurityEventSeverity.HIGH,
        conditions: [
          {
            field: 'type',
            operator: 'equals',
            value: 'auth.login.failure',
          },
          {
            field: 'userId',
            operator: 'equals',
            value: null,
          },
        ],
        actions: [
          {
            type: 'alert',
            config: {},
          },
        ],
        falsePositiveRate: 0.1,
        detectionRate: 0.85,
        lastTuned: new Date(),
        version: 1,
      },
    ];
  }

  /**
   * Load custom rules from storage
   */
  private async loadCustomRules(): Promise<DetectionRule[]> {
    try {
      const response = await this.elasticsearch.search({
        index: 'detection-rules',
        body: {
          query: {
            match_all: {},
          },
        },
      });

      const hits = response.body.hits.hits;
      return hits.map((hit: any) => hit._source);
    } catch (error) {
      return [];
    }
  }

  // ========================================================================
  // PERIODIC TASKS
  // ========================================================================

  /**
   * Setup periodic analysis
   */
  private setupPeriodicAnalysis(): void {
    this.analysisTimer = setInterval(() => {
      this.runPeriodicAnalysis();
    }, 60000); // Every minute
  }

  /**
   * Run periodic analysis
   */
  private async runPeriodicAnalysis(): Promise<void> {
    try {
      // Analyze recent events for aggregate patterns
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - this.config.analysisWindow * 1000);

      const response = await this.elasticsearch.search({
        index: 'security-events-*',
        body: {
          query: {
            range: {
              timestamp: {
                gte: startTime,
                lte: endTime,
              },
            },
          },
          size: this.config.minEventsForAnalysis,
        },
      });

      const events = response.body.hits.hits.map((hit: any) => hit._source);

      if (events.length >= this.config.minEventsForAnalysis) {
        await this.analyzeBatch(events);
      }
    } catch (error) {
      console.error('Error running periodic analysis', error);
    }
  }

  /**
   * Setup ML model updates
   */
  private setupMLModelUpdates(): void {
    cron.schedule('0 0 * * *', async () => {
      await this.updateMLModels();
    });
  }

  /**
   * Update ML models
   */
  private async updateMLModels(): Promise<void> {
    try {
      console.log('Updating ML models...');
      await this.mlDetector.updateModels();
      console.log('ML models updated successfully');
    } catch (error) {
      console.error('Failed to update ML models', error);
    }
  }

  // ========================================================================
  // THREAT RETRIEVAL
  // ========================================================================

  /**
   * Get threat by ID
   */
  public async getThreatById(id: string): Promise<Threat | null> {
    try {
      const response = await this.elasticsearch.get({
        index: this.config.elasticsearchIndex,
        id,
      });

      return response.body._source;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get threats by type
   */
  public async getThreatsByType(type: ThreatType): Promise<Threat[]> {
    try {
      const response = await this.elasticsearch.search({
        index: this.config.elasticsearchIndex,
        body: {
          query: {
            term: { type },
          },
        },
      });

      return response.body.hits.hits.map((hit: any) => hit._source);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get active threats
   */
  public async getActiveThreats(): Promise<Threat[]> {
    try {
      const response = await this.elasticsearch.search({
        index: this.config.elasticsearchIndex,
        body: {
          query: {
            terms: {
              status: ['detected', 'investigating'],
            },
          },
        },
      });

      return response.body.hits.hits.map((hit: any) => hit._source);
    } catch (error) {
      return [];
    }
  }

  // ========================================================================
  // METRICS
  // ========================================================================

  /**
   * Get detector metrics
   */
  public getMetrics(): DetectorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): DetectorMetrics {
    return {
      totalEventsAnalyzed: 0,
      totalThreatsDetected: 0,
      totalThreatsBlocked: 0,
      totalFalsePositives: 0,
      averageDetectionTime: 0,
      detectionRate: 0,
      falsePositiveRate: 0,
      byType: {
        [ThreatType.MALWARE]: 0,
        [ThreatType.PHISHING]: 0,
        [ThreatType.DDOS]: 0,
        [ThreatType.INJECTION]: 0,
        [ThreatType.XSS]: 0,
        [ThreatType.CSRF]: 0,
        [ThreatType.BRUTE_FORCE]: 0,
        [ThreatType.SQL_INJECTION]: 0,
        [ThreatType.XSS_ATTACK]: 0,
        [ThreatType.PATH_TRAVERSAL]: 0,
        [ThreatType.COMMAND_INJECTION]: 0,
        [ThreatType.MITM]: 0,
        [ThreatType.PORT_SCAN]: 0,
        [ThreatType.SOCIAL_ENGINEERING]: 0,
        [ThreatType.INSIDER_THREAT]: 0,
        [ThreatType.DATA_EXFILTRATION]: 0,
        [ThreatType.ZERO_DAY]: 0,
        [ThreatType.RANSOMWARE]: 0,
        [ThreatType.CRYPTO_MINING]: 0,
        [ThreatType.BOTNET]: 0,
        [ThreatType.APT]: 0,
        [ThreatType.UNKNOWN]: 0,
      },
      byLevel: {
        [ThreatLevel.CRITICAL]: 0,
        [ThreatLevel.HIGH]: 0,
        [ThreatLevel.MEDIUM]: 0,
        [ThreatLevel.LOW]: 0,
        [ThreatLevel.MINIMAL]: 0,
      },
    };
  }

  /**
   * Update metrics
   */
  private updateMetrics(threats: Threat[], detectionTime: number): void {
    this.metrics.totalThreatsDetected += threats.length;
    this.metrics.totalThreatsBlocked += threats.filter(t => t.status === 'blocked').length;

    threats.forEach(threat => {
      this.metrics.byType[threat.type]++;
      this.metrics.byLevel[threat.level]++;
    });

    // Update average detection time
    const alpha = 0.2;
    this.metrics.averageDetectionTime =
      alpha * detectionTime + (1 - alpha) * this.metrics.averageDetectionTime;

    // Calculate rates
    if (this.metrics.totalEventsAnalyzed > 0) {
      this.metrics.detectionRate = this.metrics.totalThreatsDetected / this.metrics.totalEventsAnalyzed;
    }

    if (this.metrics.totalThreatsDetected > 0) {
      this.metrics.falsePositiveRate = this.metrics.totalFalsePositives / this.metrics.totalThreatsDetected;
    }
  }
}
