/**
 * SOC (Security Operations Center) Engine
 * Main integration point for all SOC components
 */

import { ThreatDetectionEngine } from './threat/detectors';
import { LogCollector, EventCorrelator, AlertManager } from './siem/siem';
import { PlaybookLibrary, PlaybookExecutor, ResponseExecutor } from './response/playbooks';
import { VulnerabilityScanner, RiskAssessor } from './vulnerability/scanner';
import {
  MetricsCalculator,
  TrendAnalyzer,
  BehaviorProfiler,
  ThreatIntelligenceManager,
  SecurityDashboard
} from './analytics/analytics';
import {
  ComplianceControlLibrary,
  ComplianceAssessor,
  PolicyManager
} from './compliance/compliance';
import { SOCConfig, ThreatDetection, Incident, Vulnerability, ComplianceReport, SecurityMetrics } from './types';
import { generateId } from './utils/helpers';

// ============================================================================
// SOC Engine
// ============================================================================

export class SOCEngine {
  private config: SOCConfig;
  private threatDetection: ThreatDetectionEngine;
  private logCollector: LogCollector;
  private eventCorrelator: EventCorrelator;
  private alertManager: AlertManager;
  private playbookLibrary: PlaybookLibrary;
  private playbookExecutor: PlaybookExecutor;
  private vulnerabilityScanner: VulnerabilityScanner;
  private riskAssessor: RiskAssessor;
  private metricsCalculator: MetricsCalculator;
  private trendAnalyzer: TrendAnalyzer;
  private behaviorProfiler: BehaviorProfiler;
  private threatIntelligence: ThreatIntelligenceManager;
  private complianceLibrary: ComplianceControlLibrary;
  private complianceAssessor: ComplianceAssessor;
  private policyManager: PolicyManager;
  private dashboard: SecurityDashboard;
  private isRunning: boolean = false;
  private startTime?: number;

  constructor(config: SOCConfig) {
    this.config = config;

    // Initialize components
    this.threatDetection = new ThreatDetectionEngine();
    this.logCollector = new LogCollector();
    this.eventCorrelator = new EventCorrelator();
    this.alertManager = new AlertManager();
    this.responseExecutor = new ResponseExecutor();
    this.playbookLibrary = new PlaybookLibrary();
    this.playbookExecutor = new PlaybookExecutor(this.playbookLibrary, this.responseExecutor);
    this.vulnerabilityScanner = new VulnerabilityScanner();
    this.riskAssessor = new RiskAssessor();
    this.metricsCalculator = new MetricsCalculator();
    this.trendAnalyzer = new TrendAnalyzer();
    this.behaviorProfiler = new BehaviorProfiler();
    this.threatIntelligence = new ThreatIntelligenceManager();
    this.complianceLibrary = new ComplianceControlLibrary();
    this.complianceAssessor = new ComplianceAssessor(this.complianceLibrary);
    this.policyManager = new PolicyManager();
    this.dashboard = new SecurityDashboard();

    // Setup alert handlers
    this.setupAlertHandlers();

    // Setup SIEM integration
    this.setupSIEMIntegration();
  }

  /**
   * Start SOC engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('SOC engine is already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();

    // Start background tasks
    this.startBackgroundTasks();

    console.log('SOC engine started');
  }

  /**
   * Stop SOC engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('SOC engine is not running');
    }

    this.isRunning = false;

    // Flush logs
    await this.logCollector.flush();

    console.log('SOC engine stopped');
  }

  /**
   * Get engine status
   */
  getStatus(): {
    running: boolean;
    uptime?: number;
    config: SOCConfig;
    components: {
      threatDetection: boolean;
      siem: boolean;
      response: boolean;
      vulnerability: boolean;
      analytics: boolean;
      compliance: boolean;
    };
  } {
    return {
      running: this.isRunning,
      uptime: this.startTime ? Date.now() - this.startTime : undefined,
      config: this.config,
      components: {
        threatDetection: this.config.enableThreatDetection,
        siem: this.config.enableSIEM,
        response: this.config.enableAutoResponse,
        vulnerability: this.config.vulnerabilityScans.enabled,
        analytics: this.config.enableBehavioralAnalysis,
        compliance: this.config.frameworks.length > 0
      }
    };
  }

  // ============================================================================
  // Threat Detection
  // ============================================================================

  /**
   * Analyze request for threats
   */
  analyzeRequest(request: {
    body?: any;
    query?: Record<string, string>;
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    ip: string;
    userId?: string;
    sessionId?: string;
  }): ThreatDetection[] {
    if (!this.config.enableThreatDetection) {
      return [];
    }

    const detections = this.threatDetection.analyzeRequest(request);

    // Process detections
    for (const detection of detections) {
      this.handleThreatDetection(detection);
    }

    return detections;
  }

  /**
   * Handle threat detection
   */
  private async handleThreatDetection(detection: ThreatDetection): Promise<void> {
    // Log detection
    this.logCollector.ingest({
      timestamp: Date.now(),
      level: detection.severity === 'critical' ? 'critical' : 'info',
      source: 'threat_detection',
      sourceIp: detection.source.ip,
      message: `Threat detected: ${detection.threatType}`,
      details: detection,
      tags: ['threat', detection.threatType]
    });

    // Check if auto-response is enabled
    if (this.config.enableAutoResponse && detection.isBlocked) {
      // Find and execute playbook
      const playbook = this.playbookLibrary.getPlaybookForThreat(detection.threatType);
      if (playbook) {
        const triggers = playbook.triggerConditions;
        const matches = triggers.some(condition => {
          // Simple matching - in production, use full condition evaluation
          if (condition.field === 'threatType' && condition.operator === 'equals') {
            return condition.value === detection.threatType;
          }
          if (condition.field === 'confidence' && condition.operator === 'gte') {
            return detection.confidence >= condition.value;
          }
          return false;
        });

        if (matches) {
          await this.executePlaybook(playbook.id, {
            type: 'automatic',
            detectionId: detection.id
          }, {
            source: detection.source,
            threat: detection
          });
        }
      }
    }

    // Create SIEM alert
    if (this.config.enableSIEM) {
      const alert = this.alertManager.createFromThreat(detection);
      await this.notifyAlertHandlers(alert);
    }
  }

  // ============================================================================
  // SIEM
  // ============================================================================

  /**
   * Ingest log entry
   */
  ingestLog(log: {
    message: string;
    level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    source: string;
    details?: any;
  }): string {
    if (!this.config.enableSIEM) {
      throw new Error('SIEM is not enabled');
    }

    const logId = this.logCollector.ingest(log);

    // Process log for correlations
    const logEntry = this.logCollector.getLog(logId);
    if (logEntry) {
      const correlations = this.eventCorrelator.process(logEntry);
      for (const correlation of correlations) {
        await this.handleCorrelation(correlation);
      }
    }

    return logId;
  }

  /**
   * Query logs
   */
  queryLogs(filters: {
    level?: string;
    source?: string;
    startTime?: number;
    endTime?: number;
    search?: string;
    limit?: number;
  }) {
    return this.logCollector.query(filters);
  }

  /**
   * Get SIEM statistics
   */
  getSIEMStats() {
    return this.logCollector.getStats();
  }

  // ============================================================================
  // Incident Response
  // ============================================================================

  /**
   * Execute playbook
   */
  async executePlaybook(
    playbookId: string,
    trigger: {
      type: 'automatic' | 'manual';
      incidentId?: string;
      detectionId?: string;
      triggeredBy?: string;
    },
    variables: Record<string, any> = {}
  ) {
    if (!this.config.enableAutoResponse) {
      throw new Error('Auto-response is not enabled');
    }

    return this.playbookExecutor.execute(playbookId, trigger, variables);
  }

  /**
   * Get playbooks
   */
  getPlaybooks() {
    return this.playbookLibrary.getPlaybooks();
  }

  /**
   * Get playbook executions
   */
  getPlaybookExecutions(filters?: {
    playbookId?: string;
    status?: 'running' | 'completed' | 'failed' | 'cancelled';
  }) {
    return this.playbookExecutor.getExecutions(filters);
  }

  // ============================================================================
  // Vulnerability Management
  // ============================================================================

  /**
   * Scan code for vulnerabilities
   */
  async scanVulnerabilities(files: Array<{ path: string; content: string }>) {
    if (!this.config.vulnerabilityScans.enabled) {
      throw new Error('Vulnerability scanning is not enabled');
    }

    return this.vulnerabilityScanner.scanCode(files);
  }

  /**
   * Get vulnerability scans
   */
  getVulnerabilityScans() {
    return this.vulnerabilityScanner.getScans();
  }

  /**
   * Calculate risk score
   */
  calculateRiskScore(vulnerabilities: Vulnerability[]) {
    return this.riskAssessor.calculateRiskScore(vulnerabilities);
  }

  /**
   * Prioritize vulnerabilities
   */
  prioritizeVulnerabilities(vulnerabilities: Vulnerability[]) {
    return this.riskAssessor.prioritizeVulnerabilities(vulnerabilities);
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  /**
   * Calculate security metrics
   */
  calculateSecurityMetrics(period: { start: number; end: number }): SecurityMetrics {
    // Gather data from all components
    const detections = this.getDetectionData();
    const incidents = this.getIncidentData();
    const vulnerabilities = this.getVulnerabilityData();
    const responseActions = this.getResponseData();
    const compliance = this.getComplianceData();

    return this.metricsCalculator.calculateMetrics(
      { detections, incidents, vulnerabilities, responseActions, compliance },
      period
    );
  }

  /**
   * Get security dashboard
   */
  getSecurityDashboard() {
    const metrics = this.calculateSecurityMetrics({
      start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
      end: Date.now()
    });

    const widgets = [
      this.dashboard.createThreatOverviewWidget(metrics),
      this.dashboard.createIncidentStatusWidget(metrics),
      this.dashboard.createVulnerabilitySummaryWidget(metrics)
    ];

    // Add high-risk entities widget
    const profiles = this.behaviorProfiler.getAllProfiles();
    if (profiles.length > 0) {
      widgets.push(this.dashboard.createHighRiskEntitiesWidget(profiles));
    }

    return {
      metrics,
      widgets,
      lastUpdated: Date.now()
    };
  }

  /**
   * Get behavior profile
   */
  getBehaviorProfile(entityId: string) {
    return this.behaviorProfiler.getProfile(entityId);
  }

  /**
   * Get threat intelligence
   */
  getThreatIntelligence() {
    return this.threatIntelligence.getIntelligence();
  }

  // ============================================================================
  // Compliance
  // ============================================================================

  /**
   * Assess compliance
   */
  async assessCompliance(framework: string) {
    return this.complianceAssessor.assessFramework(framework);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(framework: string, period: { start: number; end: number }): Promise<ComplianceReport> {
    return this.complianceAssessor.generateReport(framework, period);
  }

  /**
   * Get policies
   */
  getPolicies() {
    return this.policyManager.getAllPolicies();
  }

  /**
   * Create policy
   */
  createPolicy(policy: {
    name: string;
    description: string;
    category: string;
    framework: string;
    content: string;
    owner: string;
  }) {
    return this.policyManager.createPolicy(policy);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private responseExecutor: ResponseExecutor;

  /**
   * Setup alert handlers
   */
  private setupAlertHandlers(): void {
    // Slack integration
    if (this.config.integrations.slack) {
      this.alertManager.registerHandler('slack', async (alert) => {
        // Send to Slack
        console.log('Slack alert:', alert.title);
      });
    }

    // Email integration
    if (this.config.integrations.email) {
      this.alertManager.registerHandler('email', async (alert) => {
        // Send email
        console.log('Email alert:', alert.title);
      });
    }

    // Jira integration
    if (this.config.integrations.jira) {
      this.alertManager.registerHandler('jira', async (alert) => {
        // Create Jira ticket
        console.log('Jira alert:', alert.title);
      });
    }
  }

  /**
   * Setup SIEM integration
   */
  private setupSIEMIntegration(): void {
    // Register alert handler for correlated events
    this.alertManager.registerHandler('correlation', async (alert) => {
      if (alert.correlatedEvent) {
        await this.handleCorrelation(alert.correlatedEvent);
      }
    });
  }

  /**
   * Handle correlated event
   */
  private async handleCorrelation(correlation: any): Promise<void> {
    // Create alert from correlation
    const alert = this.alertManager.createFromCorrelation(correlation);
    await this.notifyAlertHandlers(alert);
  }

  /**
   * Notify alert handlers
   */
  private async notifyAlertHandlers(alert: any): Promise<void> {
    // Handlers are already registered via setupAlertHandlers
    // The AlertManager will call them automatically
    console.log('Alert created:', alert.id, alert.title);
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    // Periodic vulnerability scanning
    if (this.config.vulnerabilityScans.enabled && this.config.vulnerabilityScans.schedule) {
      // In production, parse schedule and set interval
      setInterval(async () => {
        console.log('Running scheduled vulnerability scan');
        // Scan would be triggered here
      }, 24 * 60 * 60 * 1000); // Daily
    }

    // Periodic compliance assessment
    if (this.config.assessmentFrequency > 0) {
      setInterval(async () => {
        console.log('Running compliance assessment');
        for (const framework of this.config.frameworks) {
          await this.complianceAssessor.assessFramework(framework);
        }
      }, this.config.assessmentFrequency);
    }

    // Cleanup old data
    setInterval(async () => {
      const retentionMs = this.config.logRetention;
      if (retentionMs > 0) {
        const cutoff = Date.now() - retentionMs;
        this.eventCorrelator.clearOldEvents(cutoff);
      }
    }, 60 * 60 * 1000); // Hourly
  }

  /**
   * Get detection data for metrics
   */
  private getDetectionData() {
    // Return mock data - in production, query actual detections
    return [];
  }

  /**
   * Get incident data for metrics
   */
  private getIncidentData() {
    // Return mock data - in production, query actual incidents
    return [];
  }

  /**
   * Get vulnerability data for metrics
   */
  private getVulnerabilityData() {
    const scans = this.vulnerabilityScanner.getScans();
    return scans.flatMap(s => s.vulnerabilities);
  }

  /**
   * Get response data for metrics
   */
  private getResponseData() {
    const executions = this.playbookExecutor.getExecutions();
    return executions.flatMap(e =>
      e.steps
        .filter(s => s.result)
        .map(s => ({
          action: s.action || 'unknown',
          success: s.result!.success,
          timestamp: s.startedAt || Date.now(),
          automated: true
        }))
    );
  }

  /**
   * Get compliance data for metrics
   */
  private getComplianceData() {
    const data = [];
    for (const framework of this.config.frameworks) {
      const controls = this.complianceLibrary.getControlsByFramework(framework);
      const compliantControls = controls.filter(c => c.status === 'compliant').length;
      data.push({
        framework,
        compliantControls,
        totalControls: controls.length
      });
    }
    return data;
  }
}

// ============================================================================
// SOC Factory
// ============================================================================

export class SOCFactory {
  /**
   * Create SOC engine with default configuration
   */
  static createDefault(): SOCEngine {
    const config: SOCConfig = {
      // Detection
      enableThreatDetection: true,
      detectionMethods: ['signature', 'anomaly', 'behavioral'],
      falsePositiveThreshold: 0.3,

      // SIEM
      enableSIEM: true,
      logRetention: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxLogSize: 10000,
      enableRealtimeAlerting: true,

      // Response
      enableAutoResponse: true,
      requireApprovalFor: ['isolate'],
      defaultPlaybooks: ['sql_injection_response', 'ddos_mitigation', 'malware_response'],

      // Vulnerability
      vulnerabilityScans: {
        enabled: true,
        schedule: 'daily',
        depth: 10
      },

      // Analytics
      enableBehavioralAnalysis: true,
      baselinePeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      anomalyThreshold: 3,

      // Compliance
      frameworks: ['SOC2', 'ISO27001'],
      assessmentFrequency: 7 * 24 * 60 * 60 * 1000, // 7 days

      // Integrations
      integrations: {},

      // Performance
      maxConcurrentScans: 5,
      cacheTTL: 3600000 // 1 hour
    };

    return new SOCEngine(config);
  }

  /**
   * Create SOC engine with custom configuration
   */
  static create(config: Partial<SOCConfig>): SOCEngine {
    const defaultConfig = this.createDefault().getStatus().config;
    const mergedConfig = { ...defaultConfig, ...config };
    return new SOCEngine(mergedConfig);
  }
}
