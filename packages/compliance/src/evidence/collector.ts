import {
  Evidence,
  EvidenceType,
  EvidenceMetadata,
  ChainOfCustody,
  ComplianceStandard
} from '../types';

/**
 * Evidence collection configuration
 */
export interface EvidenceCollectionConfig {
  policyId?: string;
  controlId?: string;
  findingId?: string;
  evidenceTypes: EvidenceType[];
  sources: EvidenceSource[];
  retentionPeriod?: number;
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
}

/**
 * Evidence source
 */
export interface EvidenceSource {
  type: 'log' | 'api' | 'database' | 'file' | 'screenshot' | 'metrics' | 'document';
  location: string;
  credentials?: Record<string, string>;
  schedule?: string;
}

/**
 * Evidence collection result
 */
export interface EvidenceCollectionResult {
  evidence: Evidence[];
  errors: CollectionError[];
  summary: CollectionSummary;
}

/**
 * Collection error
 */
export interface CollectionError {
  source: string;
  error: string;
  timestamp: Date;
}

/**
 * Collection summary
 */
export interface CollectionSummary {
  totalCollected: number;
  byType: Record<EvidenceType, number>;
  bySource: Record<string, number>;
  totalTime: number;
  dataVolume: number;
}

/**
 * Evidence collector
 */
export class EvidenceCollector {
  private evidenceStore: Map<string, Evidence> = new Map();
  private custodyChain: Map<string, ChainOfCustody[]> = new Map();

  /**
   * Collect evidence based on configuration
   */
  async collect(config: EvidenceCollectionConfig): Promise<EvidenceCollectionResult> {
    const startTime = Date.now();
    const evidence: Evidence[] = [];
    const errors: CollectionError[] = [];
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    // Collect from each source
    for (const source of config.sources) {
      try {
        const sourceEvidence = await this.collectFromSource(source, config);
        evidence.push(...sourceEvidence);

        // Track counts
        bySource[source.location] = (bySource[source.location] || 0) + sourceEvidence.length;
        for (const ev of sourceEvidence) {
          byType[ev.type] = (byType[ev.type] || 0) + 1;
        }
      } catch (error) {
        errors.push({
          source: source.location,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    }

    // Store evidence and create chain of custody
    for (const ev of evidence) {
      await this.storeEvidence(ev);
      await this.createChainOfCustody(ev, 'collected', 'Evidence collected');
    }

    const totalTime = Date.now() - startTime;
    const dataVolume = evidence.reduce((sum, ev) => sum + ev.metadata.size, 0);

    return {
      evidence,
      errors,
      summary: {
        totalCollected: evidence.length,
        byType: byType as Record<EvidenceType, number>,
        bySource,
        totalTime,
        dataVolume
      }
    };
  }

  /**
   * Collect evidence from a specific source
   */
  private async collectFromSource(
    source: EvidenceSource,
    config: EvidenceCollectionConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    switch (source.type) {
      case 'log':
        const logEvidence = await this.collectLogEvidence(source, config);
        evidence.push(...logEvidence);
        break;

      case 'api':
        const apiEvidence = await this.collectAPIEvidence(source, config);
        evidence.push(...apiEvidence);
        break;

      case 'database':
        const dbEvidence = await this.collectDatabaseEvidence(source, config);
        evidence.push(...dbEvidence);
        break;

      case 'file':
        const fileEvidence = await this.collectFileEvidence(source, config);
        evidence.push(...fileEvidence);
        break;

      case 'screenshot':
        const screenshotEvidence = await this.collectScreenshotEvidence(source, config);
        evidence.push(...screenshotEvidence);
        break;

      case 'metrics':
        const metricsEvidence = await this.collectMetricsEvidence(source, config);
        evidence.push(...metricsEvidence);
        break;

      case 'document':
        const docEvidence = await this.collectDocumentEvidence(source, config);
        evidence.push(...docEvidence);
        break;
    }

    return evidence;
  }

  /**
   * Collect log evidence
   */
  private async collectLogEvidence(
    source: EvidenceSource,
    config: EvidenceCollectionConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Mock log collection
    const logEntries = [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'User authentication successful',
        userId: 'user-123'
      },
      {
        timestamp: new Date(Date.now() - 1000),
        level: 'warn',
        message: 'Failed login attempt',
        userId: 'user-456'
      }
    ];

    for (const entry of logEntries) {
      evidence.push({
        id: this.generateEvidenceId(),
        type: EvidenceType.LOG,
        policyId: config.policyId,
        controlId: config.controlId,
        findingId: config.findingId,
        timestamp: new Date(),
        collectedBy: 'evidence-collector',
        data: entry,
        metadata: {
          source: source.type,
          location: source.location,
          format: 'json',
          size: JSON.stringify(entry).length,
          retentionPeriod: config.retentionPeriod || 90,
          classification: config.classification || 'internal'
        },
        hash: this.generateHash(entry)
      });
    }

    return evidence;
  }

  /**
   * Collect API evidence
   */
  private async collectAPIEvidence(
    source: EvidenceSource,
    config: EvidenceCollectionConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Mock API evidence collection
    evidence.push({
      id: this.generateEvidenceId(),
      type: EvidenceType.LOG,
      policyId: config.policyId,
      timestamp: new Date(),
      collectedBy: 'evidence-collector',
      data: {
        endpoint: source.location,
        method: 'GET',
        status: 200,
        responseTime: 45
      },
      metadata: {
        source: 'api',
        location: source.location,
        format: 'json',
        size: 0,
        retentionPeriod: config.retentionPeriod || 90,
        classification: config.classification || 'internal'
      }
    });

    return evidence;
  }

  /**
   * Collect database evidence
   */
  private async collectDatabaseEvidence(
    source: EvidenceSource,
    config: EvidenceCollectionConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Mock database evidence
    evidence.push({
      id: this.generateEvidenceId(),
      type: EvidenceType.CONFIGURATION,
      policyId: config.policyId,
      timestamp: new Date(),
      collectedBy: 'evidence-collector',
      data: {
        query: 'SELECT * FROM users WHERE active = true',
        resultCount: 150,
        executionTime: 12
      },
      metadata: {
        source: 'database',
        location: source.location,
        format: 'json',
        size: 0,
        retentionPeriod: config.retentionPeriod || 90,
        classification: config.classification || 'internal'
      }
    });

    return evidence;
  }

  /**
   * Collect file evidence
   */
  private async collectFileEvidence(
    source: EvidenceSource,
    config: EvidenceCollectionConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Mock file evidence
    evidence.push({
      id: this.generateEvidenceId(),
      type: EvidenceType.DOCUMENTATION,
      policyId: config.policyId,
      timestamp: new Date(),
      collectedBy: 'evidence-collector',
      data: {
        filename: 'policy.pdf',
        path: source.location,
        size: 1024000,
        modified: new Date()
      },
      metadata: {
        source: 'file',
        location: source.location,
        format: 'pdf',
        size: 1024000,
        retentionPeriod: config.retentionPeriod || 90,
        classification: config.classification || 'internal'
      }
    });

    return evidence;
  }

  /**
   * Collect screenshot evidence
   */
  private async collectScreenshotEvidence(
    source: EvidenceSource,
    config: EvidenceCollectionConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Mock screenshot evidence
    evidence.push({
      id: this.generateEvidenceId(),
      type: EvidenceType.SCREENSHOT,
      policyId: config.policyId,
      timestamp: new Date(),
      collectedBy: 'evidence-collector',
      data: {
        url: source.location,
        capturedAt: new Date(),
        dimensions: '1920x1080'
      },
      metadata: {
        source: 'screenshot',
        location: source.location,
        format: 'png',
        size: 256000,
        retentionPeriod: config.retentionPeriod || 90,
        classification: config.classification || 'internal'
      }
    });

    return evidence;
  }

  /**
   * Collect metrics evidence
   */
  private async collectMetricsEvidence(
    source: EvidenceSource,
    config: EvidenceCollectionConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Mock metrics evidence
    evidence.push({
      id: this.generateEvidenceId(),
      type: EvidenceType.METRICS,
      policyId: config.policyId,
      timestamp: new Date(),
      collectedBy: 'evidence-collector',
      data: {
        uptime: 99.9,
        responseTime: 45,
        errorRate: 0.01,
        throughput: 1000
      },
      metadata: {
        source: 'metrics',
        location: source.location,
        format: 'json',
        size: 0,
        retentionPeriod: config.retentionPeriod || 90,
        classification: config.classification || 'internal'
      }
    });

    return evidence;
  }

  /**
   * Collect document evidence
   */
  private async collectDocumentEvidence(
    source: EvidenceSource,
    config: EvidenceCollectionConfig
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Mock document evidence
    evidence.push({
      id: this.generateEvidenceId(),
      type: EvidenceType.POLICY,
      policyId: config.policyId,
      timestamp: new Date(),
      collectedBy: 'evidence-collector',
      data: {
        title: 'Security Policy',
        version: '1.0',
        approvedBy: 'CISO',
        approvedDate: new Date()
      },
      metadata: {
        source: 'document',
        location: source.location,
        format: 'pdf',
        size: 512000,
        retentionPeriod: config.retentionPeriod || 90,
        classification: config.classification || 'internal'
      }
    });

    return evidence;
  }

  /**
   * Store evidence
   */
  private async storeEvidence(evidence: Evidence): Promise<void> {
    this.evidenceStore.set(evidence.id, evidence);
  }

  /**
   * Create chain of custody entry
   */
  private async createChainOfCustody(
    evidence: Evidence,
    action: string,
    reason: string
  ): Promise<void> {
    const custody: ChainOfCustody = {
      timestamp: new Date(),
      actor: evidence.collectedBy,
      action,
      reason,
      newHash: evidence.hash
    };

    if (!this.custodyChain.has(evidence.id)) {
      this.custodyChain.set(evidence.id, []);
    }

    const chain = this.custodyChain.get(evidence.id)!;
    if (chain.length > 0) {
      custody.previousHash = chain[chain.length - 1].newHash;
    }

    chain.push(custody);
  }

  /**
   * Get evidence by ID
   */
  getEvidence(evidenceId: string): Evidence | undefined {
    return this.evidenceStore.get(evidenceId);
  }

  /**
   * Get evidence by policy
   */
  getEvidenceByPolicy(policyId: string): Evidence[] {
    return Array.from(this.evidenceStore.values()).filter(e => e.policyId === policyId);
  }

  /**
   * Get chain of custody
   */
  getChainOfCustody(evidenceId: string): ChainOfCustody[] {
    return this.custodyChain.get(evidenceId) || [];
  }

  /**
   * Verify evidence integrity
   */
  verifyEvidence(evidenceId: string): boolean {
    const evidence = this.evidenceStore.get(evidenceId);
    if (!evidence) return false;

    const chain = this.custodyChain.get(evidenceId);
    if (!chain || chain.length === 0) return false;

    // Verify hash chain
    for (let i = 0; i < chain.length; i++) {
      if (chain[i].newHash !== evidence.hash) {
        return false;
      }

      if (i > 0 && chain[i].previousHash !== chain[i - 1].newHash) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate evidence ID
   */
  private generateEvidenceId(): string {
    return `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate hash of data
   */
  private generateHash(data: any): string {
    // Simple hash generation - in production use crypto
    return `${Date.now()}-${Math.random().toString(36)}`;
  }
}
