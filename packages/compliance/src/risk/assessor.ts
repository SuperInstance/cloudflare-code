import {
  RiskAssessment,
  IdentifiedRisk,
  RiskLevel,
  ComplianceStandard,
  Finding,
  MitigationPlan,
  MitigationStrategy
} from '../types';

/**
 * Risk assessment configuration
 */
export interface RiskAssessmentConfig {
  scope: string;
  standards: ComplianceStandard[];
  timeframe: {
    start: Date;
    end: Date;
  };
  includeFindings?: boolean;
  includeHistoricalData?: boolean;
  tolerance: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Risk calculation parameters
 */
export interface RiskCalculationParams {
  likelihood: number;
  impact: number;
  velocity: number;
  detectability: number;
}

/**
 * Risk assessor
 */
export class RiskAssessor {
  private riskHistory: RiskAssessment[] = [];

  /**
   * Perform risk assessment
   */
  async assess(
    config: RiskAssessmentConfig,
    data?: {
      findings?: Finding[];
      previousAssessments?: RiskAssessment[];
    }
  ): Promise<RiskAssessment> {
    const risks = this.identifyRisks(config, data);

    // Calculate risk scores
    for (const risk of risks) {
      risk.riskScore = this.calculateRiskScore({
        likelihood: risk.likelihood,
        impact: risk.impact,
        velocity: 1,
        detectability: 1
      });
      risk.riskLevel = this.getRiskLevel(risk.riskScore);
    }

    // Sort by risk score
    risks.sort((a, b) => b.riskScore - a.riskScore);

    // Calculate overall risk level
    const overallRiskLevel = this.calculateOverallRiskLevel(risks);

    // Generate mitigation plan
    const mitigationPlan = this.generateMitigationPlan(risks, config);

    // Set next review date
    const nextReviewDate = new Date();
    nextReviewDate.setMonth(nextReviewDate.getMonth() + 3); // Quarterly review

    const assessment: RiskAssessment = {
      id: this.generateAssessmentId(),
      timestamp: new Date(),
      scope: config.scope,
      overallRiskLevel,
      risks,
      mitigationPlan,
      nextReviewDate
    };

    // Store in history
    this.riskHistory.push(assessment);

    return assessment;
  }

  /**
   * Identify risks
   */
  private identifyRisks(
    config: RiskAssessmentConfig,
    data?: {
      findings?: Finding[];
      previousAssessments?: RiskAssessment[];
    }
  ): IdentifiedRisk[] {
    const risks: IdentifiedRisk[] = [];

    // Identify risks from findings
    if (data?.findings) {
      for (const finding of data.findings) {
        if (finding.status !== 'compliant') {
          risks.push({
            id: this.generateRiskId(),
            title: `Compliance Gap: ${finding.title}`,
            description: finding.description,
            category: finding.category,
            likelihood: this.estimateLikelihood(finding),
            impact: this.estimateImpact(finding),
            riskScore: 0, // Will be calculated
            riskLevel: RiskLevel.MEDIUM, // Will be calculated
            sources: [finding.location],
            existingControls: [],
            mitigationStrategies: [],
            owner: 'Security Team',
            status: 'open'
          });
        }
      }
    }

    // Add standard-specific risks
    for (const standard of config.standards) {
      const standardRisks = this.getStandardRisks(standard);
      risks.push(...standardRisks);
    }

    return risks;
  }

  /**
   * Calculate risk score
   */
  calculateRiskScore(params: RiskCalculationParams): number {
    // Risk = Likelihood × Impact × Velocity ÷ Detectability
    const baseScore = params.likelihood * params.impact;

    // Adjust for velocity (how quickly risk materializes)
    const velocityMultiplier = params.velocity >= 3 ? 1.5 : params.velocity === 2 ? 1.2 : 1;

    // Adjust for detectability (harder to detect = higher risk)
    const detectabilityDivider = params.detectability >= 3 ? 1.5 : params.detectability === 2 ? 1.2 : 1;

    return Math.round((baseScore * velocityMultiplier) / detectabilityDivider);
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): RiskLevel {
    if (score >= 20) return RiskLevel.CRITICAL;
    if (score >= 15) return RiskLevel.HIGH;
    if (score >= 8) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRiskLevel(risks: IdentifiedRisk[]): RiskLevel {
    if (risks.length === 0) return RiskLevel.LOW;

    const criticalCount = risks.filter(r => r.riskLevel === RiskLevel.CRITICAL).length;
    const highCount = risks.filter(r => r.riskLevel === RiskLevel.HIGH).length;

    if (criticalCount > 0) return RiskLevel.CRITICAL;
    if (highCount >= 3) return RiskLevel.HIGH;
    if (highCount > 0) return RiskLevel.HIGH;

    return RiskLevel.MEDIUM;
  }

  /**
   * Generate mitigation plan
   */
  private generateMitigationPlan(
    risks: IdentifiedRisk[],
    config: RiskAssessmentConfig
  ): MitigationPlan {
    const strategies: MitigationStrategy[] = [];
    const priorities: string[] = [];
    let budget = 0;
    let timeline = '';

    // Prioritize risks
    const highPriorityRisks = risks.filter(r => r.riskLevel === RiskLevel.CRITICAL || r.riskLevel === RiskLevel.HIGH);

    for (const risk of highPriorityRisks) {
      priorities.push(risk.id);

      // Generate mitigation strategies
      const strategy: MitigationStrategy = {
        id: this.generateStrategyId(),
        description: `Mitigate ${risk.title}`,
        type: 'reduce',
        cost: this.estimateMitigationCost(risk),
        effectiveness: 0.8,
        timeline: this.estimateMitigationTimeline(risk),
        responsible: risk.owner
      };

      strategies.push(strategy);
      budget += strategy.cost;
    }

    // Set timeline based on highest priority risk
    if (highPriorityRisks.length > 0) {
      const maxTimeline = Math.max(
        ...strategies.map(s => parseInt(s.timeline) || 0)
      );
      timeline = `${maxTimeline} weeks`;
    }

    return {
      strategies,
      priorities,
      budget,
      timeline,
      successCriteria: [
        'All critical risks reduced to medium or low',
        'All high risks reduced to low',
        'Mitigation controls tested and verified',
        'Residual risk within tolerance'
      ]
    };
  }

  /**
   * Estimate likelihood from finding
   */
  private estimateLikelihood(finding: Finding): number {
    switch (finding.severity) {
      case 'critical':
        return 5; // Almost certain
      case 'high':
        return 4; // Likely
      case 'medium':
        return 3; // Possible
      case 'low':
        return 2; // Unlikely
      default:
        return 1; // Rare
    }
  }

  /**
   * Estimate impact from finding
   */
  private estimateImpact(finding: Finding): number {
    switch (finding.severity) {
      case 'critical':
        return 5; // Severe impact
      case 'high':
        return 4; // High impact
      case 'medium':
        return 3; // Medium impact
      case 'low':
        return 2; // Low impact
      default:
        return 1; // Minimal impact
    }
  }

  /**
   * Estimate mitigation cost
   */
  private estimateMitigationCost(risk: IdentifiedRisk): number {
    const baseCosts = {
      [RiskLevel.CRITICAL]: 50000,
      [RiskLevel.HIGH]: 25000,
      [RiskLevel.MEDIUM]: 10000,
      [RiskLevel.LOW]: 5000
    };

    return baseCosts[risk.riskLevel] || 10000;
  }

  /**
   * Estimate mitigation timeline
   */
  private estimateMitigationTimeline(risk: IdentifiedRisk): string {
    const timelines = {
      [RiskLevel.CRITICAL]: '4',
      [RiskLevel.HIGH]: '8',
      [RiskLevel.MEDIUM]: '12',
      [RiskLevel.LOW]: '16'
    };

    return timelines[risk.riskLevel] || '12';
  }

  /**
   * Get standard-specific risks
   */
  private getStandardRisks(standard: ComplianceStandard): IdentifiedRisk[] {
    const risks: IdentifiedRisk[] = [];

    switch (standard) {
      case ComplianceStandard.SOC2:
        risks.push(
          {
            id: this.generateRiskId(),
            title: 'Unauthorized Access to Systems',
            description: 'Risk of unauthorized users gaining access to systems',
            category: 'Access Control',
            likelihood: 3,
            impact: 5,
            riskScore: 0,
            riskLevel: RiskLevel.HIGH,
            sources: ['Infrastructure'],
            existingControls: ['MFA', 'Access Control Lists'],
            mitigationStrategies: [],
            owner: 'Security Team',
            status: 'open'
          },
          {
            id: this.generateRiskId(),
            title: 'Data Breach',
            description: 'Risk of confidential data exposure',
            category: 'Confidentiality',
            likelihood: 2,
            impact: 5,
            riskScore: 0,
            riskLevel: RiskLevel.HIGH,
            sources: ['Database', 'API'],
            existingControls: ['Encryption', 'DLP'],
            mitigationStrategies: [],
            owner: 'Security Team',
            status: 'open'
          }
        );
        break;

      case ComplianceStandard.GDPR:
        risks.push(
          {
            id: this.generateRiskId(),
            title: 'GDPR Non-Compliance Fines',
            description: 'Risk of regulatory fines for GDPR violations',
            category: 'Regulatory',
            likelihood: 2,
            impact: 5,
            riskScore: 0,
            riskLevel: RiskLevel.HIGH,
            sources: ['Processing Activities'],
            existingControls: ['Data Processing Agreements', 'Consent Management'],
            mitigationStrategies: [],
            owner: 'DPO',
            status: 'open'
          }
        );
        break;

      case ComplianceStandard.HIPAA:
        risks.push(
          {
            id: this.generateRiskId(),
            title: 'PHI Exposure',
            description: 'Risk of protected health information exposure',
            category: 'Data Protection',
            likelihood: 2,
            impact: 5,
            riskScore: 0,
            riskLevel: RiskLevel.HIGH,
            sources: ['EHR', 'Database'],
            existingControls: ['Encryption', 'Access Controls'],
            mitigationStrategies: [],
            owner: 'Security Officer',
            status: 'open'
          }
        );
        break;

      case ComplianceStandard.PCI_DSS:
        risks.push(
          {
            id: this.generateRiskId(),
            title: 'Cardholder Data Compromise',
            description: 'Risk of payment card data exposure',
            category: 'Data Security',
            likelihood: 2,
            impact: 5,
            riskScore: 0,
            riskLevel: RiskLevel.HIGH,
            sources: ['Payment Systems', 'Database'],
            existingControls: ['Encryption', 'Tokenization'],
            mitigationStrategies: [],
            owner: 'Payment Team',
            status: 'open'
          }
        );
        break;
    }

    return risks;
  }

  /**
   * Get risk history
   */
  getRiskHistory(): RiskAssessment[] {
    return this.riskHistory;
  }

  /**
   * Compare risk assessments
   */
  compareAssessments(
    assessment1: RiskAssessment,
    assessment2: RiskAssessment
  ): {
    improved: number;
    worsened: number;
    new: number;
    resolved: number;
  } {
    const risks1 = new Map(assessment1.risks.map(r => [r.id, r]));
    const risks2 = new Map(assessment2.risks.map(r => [r.id, r]));

    let improved = 0;
    let worsened = 0;
    let newRisks = 0;
    let resolved = 0;

    for (const [id, risk2] of risks2) {
      const risk1 = risks1.get(id);

      if (!risk1) {
        newRisks++;
      } else if (risk2.riskLevel < risk1.riskLevel) {
        improved++;
      } else if (risk2.riskLevel > risk1.riskLevel) {
        worsened++;
      }
    }

    for (const [id] of risks1) {
      if (!risks2.has(id)) {
        resolved++;
      }
    }

    return { improved, worsened, new: newRisks, resolved };
  }

  /**
   * Generate unique IDs
   */
  private generateAssessmentId(): string {
    return `risk-assessment-${Date.now()}`;
  }

  private generateRiskId(): string {
    return `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStrategyId(): string {
    return `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
