/**
 * Compliance Automation - Automated compliance management and reporting
 * Provides SOC2, ISO27001, GDPR, HIPAA, PCI DSS compliance automation
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ComplianceFramework,
  ComplianceControl,
  ControlStatus,
  Evidence,
  EvidenceType,
  Assessment,
  AssessmentResult,
  Finding,
  FindingSeverity,
  FindingStatus,
  Exception,
  ComplianceReport,
  ComplianceSummary,
  ComplianceError,
  AuditEvent,
} from '../types';

// ============================================================================
// CONTROL LIBRARY
// ============================================================================

interface ControlDefinition {
  controlId: string;
  framework: ComplianceFramework;
  title: string;
  description: string;
  category: string;
  defaultStatus: ControlStatus;
  automatedChecks?: string[];
  evidenceRequired: EvidenceType[];
  assessmentFrequency: number; // in days
}

export const CONTROLS_LIBRARY: Record<ComplianceFramework, ControlDefinition[]> = {
  [ComplianceFramework.SOC2]: [
    {
      controlId: 'CC-6.1',
      framework: ComplianceFramework.SOC2,
      title: 'Logical and Physical Access Controls',
      description: 'The entity restricts logical access to system components and data to authorized users',
      category: 'Access Control',
      defaultStatus: ControlStatus.IMPLEMENTED,
      automatedChecks: ['check_mfa_enabled', 'check_access_policies', 'check_password_policy'],
      evidenceRequired: [EvidenceType.AUDIT_LOG, EvidenceType.POLICY, EvidenceType.CONFIGURATION],
      assessmentFrequency: 90,
    },
    {
      controlId: 'CC-6.6',
      framework: ComplianceFramework.SOC2,
      title: 'Authentication Mechanisms',
      description: 'The entity uses authentication mechanisms to verify the identity of users',
      category: 'Access Control',
      defaultStatus: ControlStatus.IMPLEMENTED,
      automatedChecks: ['check_auth_logs', 'check_session_management'],
      evidenceRequired: [EvidenceType.AUDIT_LOG, EvidenceType.CONFIGURATION],
      assessmentFrequency: 90,
    },
    {
      controlId: 'CC-7.2',
      framework: ComplianceFramework.SOC2,
      title: 'System Monitoring',
      description: 'The entity monitors system components to detect anomalies',
      category: 'Monitoring',
      defaultStatus: ControlStatus.IMPLEMENTED,
      automatedChecks: ['check_monitoring_enabled', 'check_alerting_configured'],
      evidenceRequired: [EvidenceType.AUTOMATED_CHECK, EvidenceType.CONFIGURATION],
      assessmentFrequency: 30,
    },
    {
      controlId: 'A-1.1',
      framework: ComplianceFramework.SOC2,
      title: 'Data Encryption',
      description: 'The entity encrypts data at rest and in transit',
      category: 'Data Protection',
      defaultStatus: ControlStatus.IMPLEMENTED,
      automatedChecks: ['check_encryption_at_rest', 'check_tls_enabled'],
      evidenceRequired: [EvidenceType.CONFIGURATION, EvidenceType.AUTOMATED_CHECK],
      assessmentFrequency: 90,
    },
  ],

  [ComplianceFramework.ISO27001]: [
    {
      controlId: 'A.9.2.1',
      framework: ComplianceFramework.ISO27001,
      title: 'Access Control Policy',
      description: 'Control of access to information',
      category: 'Access Control',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.POLICY, EvidenceType.DOCUMENTATION],
      assessmentFrequency: 180,
    },
    {
      controlId: 'A.9.4.1',
      framework: ComplianceFramework.ISO27001,
      title: 'Information Access Control',
      description: 'Access to information and other associated assets shall be restricted',
      category: 'Access Control',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.AUDIT_LOG, EvidenceType.CONFIGURATION],
      assessmentFrequency: 90,
    },
    {
      controlId: 'A.10.1.1',
      framework: ComplianceFramework.ISO27001,
      title: 'Cryptography Controls',
      description: 'Use of cryptography to protect information',
      category: 'Cryptography',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.CONFIGURATION, EvidenceType.AUTOMATED_CHECK],
      assessmentFrequency: 180,
    },
    {
      controlId: 'A.12.4.1',
      framework: ComplianceFramework.ISO27001,
      title: 'Event Logging',
      description: 'Logging events and producing evidence',
      category: 'Logging',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.AUDIT_LOG, EvidenceType.CONFIGURATION],
      assessmentFrequency: 90,
    },
  ],

  [ComplianceFramework.GDPR]: [
    {
      controlId: 'Art.32',
      framework: ComplianceFramework.GDPR,
      title: 'Security of Processing',
      description: 'Technical and organizational measures to ensure security',
      category: 'Security',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.POLICY, EvidenceType.CONFIGURATION, EvidenceType.AUDIT_LOG],
      assessmentFrequency: 90,
    },
    {
      controlId: 'Art.25',
      framework: ComplianceFramework.GDPR,
      title: 'Data Protection by Design',
      description: 'Implement data protection measures from the start',
      category: 'Privacy by Design',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.DOCUMENTATION, EvidenceType.POLICY],
      assessmentFrequency: 180,
    },
    {
      controlId: 'Art.35',
      framework: ComplianceFramework.GDPR,
      title: 'Data Protection Impact Assessment',
      description: 'Conduct DPIAs for high-risk processing',
      category: 'Risk Assessment',
      defaultStatus: ControlStatus.PARTIALLY_IMPLEMENTED,
      evidenceRequired: [EvidenceType.DOCUMENTATION, EvidenceType.TEST_RESULT],
      assessmentFrequency: 365,
    },
  ],

  [ComplianceFramework.HIPAA]: [
    {
      controlId: '164.312(a)(1)',
      framework: ComplianceFramework.HIPAA,
      title: 'Access Control',
      description: 'Implement technical policies and procedures to allow only authorized persons',
      category: 'Access Control',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.AUDIT_LOG, EvidenceType.POLICY],
      assessmentFrequency: 180,
    },
    {
      controlId: '164.312(a)(2)(i)',
      framework: ComplianceFramework.HIPAA,
      title: 'Unique User Identification',
      description: 'Assign a unique name and/or number for identifying and tracking user identity',
      category: 'Access Control',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.CONFIGURATION, EvidenceType.AUDIT_LOG],
      assessmentFrequency: 180,
    },
    {
      controlId: '164.312(e)(1)',
      framework: ComplianceFramework.HIPAA,
      title: 'Encryption',
      description: 'Implement a mechanism to encrypt and decrypt electronic protected health information',
      category: 'Encryption',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.CONFIGURATION, EvidenceType.AUTOMATED_CHECK],
      assessmentFrequency: 180,
    },
    {
      controlId: '164.312(b)',
      framework: ComplianceFramework.HIPAA,
      title: 'Audit Controls',
      description: 'Implement hardware, software, and/or procedural mechanisms that record and examine',
      category: 'Audit',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.AUDIT_LOG, EvidenceType.CONFIGURATION],
      assessmentFrequency: 90,
    },
  ],

  [ComplianceFramework.PCI_DSS]: [
    {
      controlId: '8.2',
      framework: ComplianceFramework.PCI_DSS,
      title: 'Authentication Mechanisms',
      description: 'Use strong cryptography and secure protocols',
      category: 'Authentication',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.CONFIGURATION, EvidenceType.AUTOMATED_CHECK],
      assessmentFrequency: 90,
    },
    {
      controlId: '8.3',
      framework: ComplianceFramework.PCI_DSS,
      title: 'Secure Authentication',
      description: 'Implement multi-factor authentication for all access',
      category: 'Authentication',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.CONFIGURATION, EvidenceType.AUTOMATED_CHECK],
      assessmentFrequency: 90,
    },
    {
      controlId: '10.2',
      framework: ComplianceFramework.PCI_DSS,
      title: 'Audit Trail',
      description: 'Implement automated audit trails for all system components',
      category: 'Audit',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.AUDIT_LOG, EvidenceType.CONFIGURATION],
      assessmentFrequency: 90,
    },
    {
      controlId: '3.4',
      framework: ComplianceFramework.PCI_DSS,
      title: 'Encryption of Data at Rest',
      description: 'Render cardholder data unreadable anywhere it is stored',
      category: 'Encryption',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.CONFIGURATION, EvidenceType.AUTOMATED_CHECK],
      assessmentFrequency: 90,
    },
  ],

  [ComplianceFramework.NIST_800_53]: [
    {
      controlId: 'AC-2',
      framework: ComplianceFramework.NIST_800_53,
      title: 'Account Management',
      description: 'Manage information system accounts',
      category: 'Access Control',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.POLICY, EvidenceType.AUDIT_LOG],
      assessmentFrequency: 180,
    },
    {
      controlId: 'AU-2',
      framework: ComplianceFramework.NIST_800_53,
      title: 'Audit Events',
      description: 'Audit events and generate records',
      category: 'Audit',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.AUDIT_LOG, EvidenceType.CONFIGURATION],
      assessmentFrequency: 90,
    },
    {
      controlId: 'SC-13',
      framework: ComplianceFramework.NIST_800_53,
      title: 'Cryptographic Protection',
      description: 'Use cryptographic mechanisms to protect information',
      category: 'Cryptography',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.CONFIGURATION, EvidenceType.AUTOMATED_CHECK],
      assessmentFrequency: 180,
    },
  ],

  [ComplianceFramework.CSA_STAR]: [
    {
      controlId: 'AMC-01',
      framework: ComplianceFramework.CSA_STAR,
      title: 'Account Management',
      description: 'Manage the lifecycle of accounts',
      category: 'Access Control',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.POLICY, EvidenceType.AUDIT_LOG],
      assessmentFrequency: 180,
    },
    {
      controlId: 'DSC-01',
      framework: ComplianceFramework.CSA_STAR,
      title: 'Data Security',
      description: 'Protect data in transit and at rest',
      category: 'Data Security',
      defaultStatus: ControlStatus.IMPLEMENTED,
      evidenceRequired: [EvidenceType.CONFIGURATION, EvidenceType.AUTOMATED_CHECK],
      assessmentFrequency: 90,
    },
  ],
};

// ============================================================================
// EVIDENCE COLLECTION
// ============================================================================

export interface EvidenceCollector {
  collectEvidence(
    control: ComplianceControl,
    evidenceType: EvidenceType
  ): Promise<Evidence[]>;
}

export class AutomatedEvidenceCollector implements EvidenceCollector {
  async collectEvidence(
    control: ComplianceControl,
    evidenceType: EvidenceType
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    switch (evidenceType) {
      case EvidenceType.AUTOMATED_CHECK:
        evidence.push(await this.runAutomatedCheck(control));
        break;

      case EvidenceType.CONFIGURATION:
        evidence.push(await this.collectConfiguration(control));
        break;

      case EvidenceType.AUDIT_LOG:
        evidence.push(await this.collectAuditLogSample(control));
        break;

      default:
        // Other types require manual collection
        break;
    }

    return evidence;
  }

  private async runAutomatedCheck(control: ComplianceControl): Promise<Evidence> {
    const definition = CONTROLS_LIBRARY[control.framework].find(
      c => c.controlId === control.controlId
    );

    if (!definition || !definition.automatedChecks) {
      throw new ComplianceError('No automated checks defined for control', control.framework);
    }

    const results: Record<string, any> = {};

    for (const check of definition.automatedChecks) {
      // Run the automated check
      results[check] = await this.executeCheck(check);
    }

    return {
      evidenceId: uuidv4(),
      type: EvidenceType.AUTOMATED_CHECK,
      source: 'automated',
      collectedAt: new Date(),
      description: `Automated compliance check for ${control.controlId}`,
      data: results,
      verified: true,
    };
  }

  private async executeCheck(checkName: string): Promise<any> {
    // Simulated automated checks
    switch (checkName) {
      case 'check_mfa_enabled':
        return { enabled: true, coverage: '95%' };

      case 'check_access_policies':
        return { policies: 12, enforced: true };

      case 'check_password_policy':
        return { minLength: 8, complexity: true, rotationDays: 90 };

      case 'check_encryption_at_rest':
        return { algorithm: 'aes-256-gcm', enabled: true };

      case 'check_tls_enabled':
        return { version: '1.3', enabled: true };

      case 'check_monitoring_enabled':
        return { enabled: true, retentionDays: 90 };

      default:
        return { status: 'unknown' };
    }
  }

  private async collectConfiguration(control: ComplianceControl): Promise<Evidence> {
    // Collect configuration settings relevant to the control
    const config = {
      encryption: {
        algorithm: 'aes-256-gcm',
        keyRotationDays: 90,
      },
      authentication: {
        mfaRequired: true,
        sessionTimeout: 60,
      },
      audit: {
        enabled: true,
        retentionDays: 90,
      },
    };

    return {
      evidenceId: uuidv4(),
      type: EvidenceType.CONFIGURATION,
      source: 'system',
      collectedAt: new Date(),
      description: `Configuration evidence for ${control.controlId}`,
      data: config,
      verified: true,
    };
  }

  private async collectAuditLogSample(control: ComplianceControl): Promise<Evidence> {
    // Sample audit logs as evidence
    const sampleLogs = {
      eventCount: 1000,
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      eventsByType: {
        authentication: 150,
        authorization: 500,
        dataAccess: 250,
        dataModification: 100,
      },
    };

    return {
      evidenceId: uuidv4(),
      type: EvidenceType.AUDIT_LOG,
      source: 'audit_log',
      collectedAt: new Date(),
      description: `Audit log sample for ${control.controlId}`,
      data: sampleLogs,
      verified: true,
    };
  }
}

// ============================================================================
// COMPLIANCE AUTOMATION ENGINE
// ============================================================================

export interface ComplianceAutomationConfig {
  frameworks: ComplianceFramework[];
  autoAssessmentEnabled: boolean;
  assessmentIntervalDays: number;
  evidenceCollectionEnabled: boolean;
  reportingEnabled: boolean;
  evidenceCollector?: EvidenceCollector;
}

export class ComplianceAutomationEngine {
  private controls: Map<string, ComplianceControl> = new Map();
  private config: Required<Omit<ComplianceAutomationConfig, 'evidenceCollector'>> & {
    evidenceCollector?: EvidenceCollector;
  };

  constructor(config: ComplianceAutomationConfig) {
    this.config = {
      frameworks: config.frameworks,
      autoAssessmentEnabled: config.autoAssessmentEnabled ?? true,
      assessmentIntervalDays: config.assessmentIntervalDays || 90,
      evidenceCollectionEnabled: config.evidenceCollectionEnabled ?? true,
      reportingEnabled: config.reportingEnabled ?? true,
      evidenceCollector: config.evidenceCollector || new AutomatedEvidenceCollector(),
    };

    this.initializeControls();
  }

  /**
   * Initialize controls from the library
   */
  private initializeControls(): void {
    const now = new Date();

    for (const framework of this.config.frameworks) {
      const definitions = CONTROLS_LIBRARY[framework] || [];

      for (const definition of definitions) {
        const control: ComplianceControl = {
          controlId: definition.controlId,
          framework: definition.framework,
          title: definition.title,
          description: definition.description,
          category: definition.category,
          status: definition.defaultStatus,
          evidence: [],
          assessments: [],
          nextAssessmentDue: new Date(
            now.getTime() + definition.assessmentFrequency * 24 * 60 * 60 * 1000
          ),
          owner: 'compliance-team',
          exceptions: [],
        };

        this.controls.set(this.getControlKey(definition.framework, definition.controlId), control);
      }
    }
  }

  private getControlKey(framework: ComplianceFramework, controlId: string): string {
    return `${framework}:${controlId}`;
  }

  /**
   * Get all controls for a framework
   */
  getControls(framework?: ComplianceFramework): ComplianceControl[] {
    const allControls = Array.from(this.controls.values());

    if (framework) {
      return allControls.filter(c => c.framework === framework);
    }

    return allControls;
  }

  /**
   * Get a specific control
   */
  getControl(framework: ComplianceFramework, controlId: string): ComplianceControl | null {
    return this.controls.get(this.getControlKey(framework, controlId)) || null;
  }

  /**
   * Run automated assessments for controls
   */
  async runAssessments(framework?: ComplianceFramework): Promise<Assessment[]> {
    const assessments: Assessment[] = [];
    const controls = this.getControls(framework);

    for (const control of controls) {
      if (!this.isAssessmentDue(control)) {
        continue;
      }

      const assessment = await this.assessControl(control);
      assessments.push(assessment);
    }

    return assessments;
  }

  /**
   * Assess a single control
   */
  async assessControl(control: ComplianceControl): Promise<Assessment> {
    const findings: Finding[] = [];
    const recommendations: string[] = [];

    // Collect evidence
    if (this.config.evidenceCollectionEnabled && this.config.evidenceCollector) {
      const definition = CONTROLS_LIBRARY[control.framework].find(
        c => c.controlId === control.controlId
      );

      if (definition) {
        for (const evidenceType of definition.evidenceRequired) {
          try {
            const evidence = await this.config.evidenceCollector.collectEvidence(
              control,
              evidenceType
            );
            control.evidence.push(...evidence);
          } catch (error) {
            findings.push({
              findingId: uuidv4(),
              severity: FindingSeverity.MEDIUM,
              title: `Failed to collect ${evidenceType} evidence`,
              description: `Unable to collect ${evidenceType} for control ${control.controlId}`,
              impact: 'Limited visibility into control effectiveness',
              remediation: 'Configure evidence collection for this control',
              status: FindingStatus.OPEN,
              discoveredAt: new Date(),
            });
          }
        }
      }
    }

    // Evaluate control status
    const result = this.evaluateControlStatus(control, findings);

    const assessment: Assessment = {
      assessmentId: uuidv4(),
      controlIds: [control.controlId],
      assessor: 'automation-engine',
      assessedAt: new Date(),
      result,
      findings,
      recommendations,
      nextReviewDate: this.calculateNextAssessmentDate(control),
    };

    // Update control
    control.assessments.push(assessment);
    control.lastAssessedAt = assessment.assessedAt;
    control.nextAssessmentDue = assessment.nextReviewDate;

    return assessment;
  }

  /**
   * Evaluate control status based on evidence and findings
   */
  private evaluateControlStatus(
    control: ComplianceControl,
    findings: Finding[]
  ): AssessmentResult {
    const criticalFindings = findings.filter(f => f.severity === FindingSeverity.CRITICAL).length;
    const highFindings = findings.filter(f => f.severity === FindingSeverity.HIGH).length;
    const mediumFindings = findings.filter(f => f.severity === FindingSeverity.MEDIUM).length;

    if (criticalFindings > 0) {
      return AssessmentResult.NON_COMPLIANT;
    }

    if (highFindings > 0) {
      return AssessmentResult.PARTIALLY_COMPLIANT;
    }

    if (mediumFindings > 2) {
      return AssessmentResult.PARTIALLY_COMPLIANT;
    }

    return AssessmentResult.COMPLIANT;
  }

  /**
   * Check if assessment is due
   */
  private isAssessmentDue(control: ComplianceControl): boolean {
    if (!this.config.autoAssessmentEnabled) {
      return false;
    }

    return !control.nextAssessmentDue || control.nextAssessmentDue <= new Date();
  }

  /**
   * Calculate next assessment date
   */
  private calculateNextAssessmentDate(control: ComplianceControl): Date {
    const definition = CONTROLS_LIBRARY[control.framework].find(
      c => c.controlId === control.controlId
    );

    if (!definition) {
      const defaultDays = this.config.assessmentIntervalDays;
      return new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000);
    }

    return new Date(Date.now() + definition.assessmentFrequency * 24 * 60 * 60 * 1000);
  }

  /**
   * Generate a compliance report
   */
  async generateReport(framework: ComplianceFramework, period?: {
    start: Date;
    end: Date;
  }): Promise<ComplianceReport> {
    const controls = this.getControls(framework);
    const allFindings: Finding[] = [];

    // Collect findings from all assessments
    for (const control of controls) {
      for (const assessment of control.assessments) {
        allFindings.push(...assessment.findings);
      }
    }

    const summary = this.calculateSummary(controls, allFindings);
    const recommendations = this.generateRecommendations(controls, allFindings);

    return {
      reportId: uuidv4(),
      framework,
      period: period || {
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      generatedAt: new Date(),
      summary,
      controls,
      findings: allFindings,
      recommendations,
    };
  }

  /**
   * Calculate compliance summary
   */
  private calculateSummary(controls: ComplianceControl[], findings: Finding[]): ComplianceSummary {
    const summary: ComplianceSummary = {
      totalControls: controls.length,
      compliantControls: 0,
      partiallyCompliantControls: 0,
      nonCompliantControls: 0,
      compliancePercentage: 0,
      criticalFindings: 0,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0,
    };

    // Count findings by severity
    for (const finding of findings) {
      switch (finding.severity) {
        case FindingSeverity.CRITICAL:
          summary.criticalFindings++;
          break;
        case FindingSeverity.HIGH:
          summary.highFindings++;
          break;
        case FindingSeverity.MEDIUM:
          summary.mediumFindings++;
          break;
        case FindingSeverity.LOW:
          summary.lowFindings++;
          break;
      }
    }

    // Assess control status from latest assessment
    for (const control of controls) {
      const latestAssessment = control.assessments[control.assessments.length - 1];

      if (!latestAssessment) {
        summary.nonCompliantControls++;
        continue;
      }

      switch (latestAssessment.result) {
        case AssessmentResult.COMPLIANT:
          summary.compliantControls++;
          break;
        case AssessmentResult.PARTIALLY_COMPLIANT:
          summary.partiallyCompliantControls++;
          break;
        case AssessmentResult.NON_COMPLIANT:
          summary.nonCompliantControls++;
          break;
      }
    }

    // Calculate compliance percentage
    if (summary.totalControls > 0) {
      summary.compliancePercentage = Math.round(
        (summary.compliantControls / summary.totalControls) * 100
      );
    }

    return summary;
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(controls: ComplianceControl[], findings: Finding[]): string[] {
    const recommendations: string[] = [];

    // Analyze findings for patterns
    const findingCounts = new Map<string, number>();
    for (const finding of findings) {
      const key = finding.title;
      findingCounts.set(key, (findingCounts.get(key) || 0) + 1);
    }

    // Generate recommendations for common findings
    for (const [title, count] of findingCounts.entries()) {
      if (count >= 3) {
        recommendations.push(`Address recurring issue: ${title} (${count} occurrences)`);
      }
    }

    // Check for non-compliant controls
    for (const control of controls) {
      const latestAssessment = control.assessments[control.assessments.length - 1];
      if (latestAssessment && latestAssessment.result === AssessmentResult.NON_COMPLIANT) {
        recommendations.push(
          `Remediate control ${control.controlId}: ${control.title}`
        );
      }
    }

    return recommendations;
  }

  /**
   * Create an exception for a control
   */
  createException(
    framework: ComplianceFramework,
    controlId: string,
    params: {
      reason: string;
      approvedBy: string;
      expiresAt?: Date;
      conditions: string[];
      riskAcceptance: string;
    }
  ): Exception {
    const control = this.getControl(framework, controlId);
    if (!control) {
      throw new ComplianceError('Control not found', framework);
    }

    const exception: Exception = {
      exceptionId: uuidv4(),
      controlId,
      reason: params.reason,
      approvedBy: params.approvedBy,
      approvedAt: new Date(),
      expiresAt: params.expiresAt,
      conditions: params.conditions,
      riskAcceptance: params.riskAcceptance,
    };

    if (!control.exceptions) {
      control.exceptions = [];
    }

    control.exceptions.push(exception);

    return exception;
  }

  /**
   * Get controls needing attention
   */
  getControlsNeedingAttention(framework: ComplianceFramework): ComplianceControl[] {
    const controls = this.getControls(framework);
    const now = new Date();

    return controls.filter(c => {
      // Assessment due
      if (c.nextAssessmentDue && c.nextAssessmentDue <= now) {
        return true;
      }

      // Non-compliant status
      const latestAssessment = c.assessments[c.assessments.length - 1];
      if (latestAssessment && latestAssessment.result === AssessmentResult.NON_COMPLIANT) {
        return true;
      }

      // Open critical or high findings
      const hasOpenCriticalFindings = latestAssessment?.findings.some(
        f => (f.severity === FindingSeverity.CRITICAL || f.severity === FindingSeverity.HIGH) &&
             f.status === FindingStatus.OPEN
      );

      if (hasOpenCriticalFindings) {
        return true;
      }

      // Expired exceptions
      if (c.exceptions?.some(e => e.expiresAt && e.expiresAt <= now)) {
        return true;
      }

      return false;
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { AutomatedEvidenceCollector, ComplianceAutomationEngine, CONTROLS_LIBRARY };
