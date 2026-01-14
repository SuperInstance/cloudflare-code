/**
 * Compliance mapping and helper functions
 */

import {
  ComplianceFramework,
  SOC2TrustService,
  ISO27001Domain,
  AuditEventType
} from '../types/events';

/**
 * SOC 2 Control Mapping
 */
export const SOC2_CONTROL_MAPPING: Record<string, {
  controlId: string;
  controlName: string;
  criteria: string;
  relevantEventTypes: AuditEventType[];
  testingProcedure: string;
  evidenceRequired: string[];
}> = {
  // Access Controls
  'CC6.1': {
    controlId: 'CC6.1',
    controlName: 'Logical and Physical Access Controls',
    criteria: 'The entity restricts access to information assets to authorized users',
    relevantEventTypes: [
      AuditEventType.AUTH_LOGIN,
      AuditEventType.AUTH_LOGOUT,
      AuditEventType.AUTH_FAILED_LOGIN,
      AuditEventType.AUTHZ_ACCESS_GRANTED,
      AuditEventType.AUTHZ_ACCESS_DENIED
    ],
    testingProcedure: 'Review audit logs for unauthorized access attempts and verify proper access controls',
    evidenceRequired: ['Access logs', 'User access reviews', 'Authentication logs']
  },

  'CC6.6': {
    controlId: 'CC6.6',
    controlName: 'Multi-Factor Authentication',
    criteria: 'The entity uses multi-factor authentication for access to systems',
    relevantEventTypes: [
      AuditEventType.AUTH_MFA_ENABLED,
      AuditEventType.AUTH_MFA_DISABLED,
      AuditEventType.AUTH_MFA_VERIFIED,
      AuditEventType.AUTH_MFA_FAILED
    ],
    testingProcedure: 'Verify MFA is enabled for all users and review authentication logs',
    evidenceRequired: ['MFA configuration', 'Authentication logs', 'User settings']
  },

  'CC6.7': {
    controlId: 'CC6.7',
    controlName: 'Encryption',
    criteria: 'The entity encrypts confidential information at rest and in transit',
    relevantEventTypes: [
      AuditEventType.SECURITY_ENCRYPTION_KEY_ROTATED,
      AuditEventType.SECURITY_CERTIFICATE_UPDATED
    ],
    testingProcedure: 'Verify encryption is enabled and keys are properly managed',
    evidenceRequired: ['Encryption certificates', 'Key rotation logs', 'Configuration settings']
  },

  // Change Management
  'CC8.1': {
    controlId: 'CC8.1',
    controlName: 'Change Management',
    criteria: 'The entity has processes for changes to system components',
    relevantEventTypes: [
      AuditEventType.SYSTEM_CONFIG_CHANGE,
      AuditEventType.SYSTEM_DEPLOYMENT,
      AuditEventType.SYSTEM_UPDATE
    ],
    testingProcedure: 'Review change management procedures and audit logs',
    evidenceRequired: ['Change requests', 'Deployment logs', 'Approval records']
  },

  // System Monitoring
  'CC7.2': {
    controlId: 'CC7.2',
    controlName: 'System Monitoring',
    criteria: 'The entity monitors system components for unusual or suspicious activities',
    relevantEventTypes: [
      AuditEventType.SECURITY_BRUTE_FORCE_ATTEMPT,
      AuditEventType.SECURITY_INTRUSION_DETECTED,
      AuditEventType.SECURITY_MALWARE_DETECTED,
      AuditEventType.MONITORING_ALERT_TRIGGERED,
      AuditEventType.MONITORING_ANOMALY_DETECTED
    ],
    testingProcedure: 'Verify monitoring systems are active and alerts are configured',
    evidenceRequired: ['Monitoring logs', 'Alert configurations', 'Incident reports']
  },

  // Data Integrity
  'PI1.1': {
    controlId: 'PI1.1',
    controlName: 'Data Processing Integrity',
    criteria: 'The entity processes data completely, accurately, and timely',
    relevantEventTypes: [
      AuditEventType.DATA_CREATED,
      AuditEventType.DATA_MODIFIED,
      AuditEventType.DATA_DELETED,
      AuditEventType.DATA_EXPORTED
    ],
    testingProcedure: 'Review data processing logs and verify data integrity',
    evidenceRequired: ['Processing logs', 'Data validation records', 'Error logs']
  },

  // Privacy
  'P1.1': {
    controlId: 'P1.1',
    controlName: 'Privacy Notice',
    criteria: 'The entity provides notice of its privacy practices',
    relevantEventTypes: [
      AuditEventType.DATA_ACCESS,
      AuditEventType.DATA_EXPORTED
    ],
    testingProcedure: 'Verify privacy notices are current and data handling follows stated practices',
    evidenceRequired: ['Privacy policy', 'Data access logs', 'Consent records']
  }
};

/**
 * ISO 27001 Control Mapping
 */
export const ISO27001_CONTROL_MAPPING: Record<string, {
  controlId: string;
  controlName: string;
  domain: ISO27001Domain;
  relevantEventTypes: AuditEventType[];
  testingProcedure: string;
  evidenceRequired: string[];
}> = {
  // Access Control (A.9)
  'A.9.1': {
    controlId: 'A.9.1',
    controlName: 'Business Requirement for Access Control',
    domain: ISO27001Domain.ACCESS_CONTROL,
    relevantEventTypes: [
      AuditEventType.AUTH_LOGIN,
      AuditEventType.AUTH_LOGOUT,
      AuditEventType.AUTHZ_ACCESS_GRANTED,
      AuditEventType.AUTHZ_ACCESS_DENIED
    ],
    testingProcedure: 'Review access control policy and verify implementation',
    evidenceRequired: ['Access control policy', 'Access logs', 'User access reviews']
  },

  'A.9.2': {
    controlId: 'A.9.2',
    controlName: 'User Access Management',
    domain: ISO27001Domain.ACCESS_CONTROL,
    relevantEventTypes: [
      AuditEventType.USER_CREATED,
      AuditEventType.USER_DELETED,
      AuditEventType.USER_MODIFIED,
      AuditEventType.USER_SUSPENDED
    ],
    testingProcedure: 'Review user lifecycle management processes',
    evidenceRequired: ['User access requests', 'Approval records', 'Termination logs']
  },

  'A.9.3': {
    controlId: 'A.9.3',
    controlName: 'User Responsibilities',
    domain: ISO27001Domain.ACCESS_CONTROL,
    relevantEventTypes: [
      AuditEventType.AUTH_PASSWORD_CHANGE,
      AuditEventType.AUTH_MFA_ENABLED
    ],
    testingProcedure: 'Verify users follow security procedures',
    evidenceRequired: ['Password policy', 'Security awareness training', 'User agreements']
  },

  'A.9.4': {
    controlId: 'A.9.4',
    controlName: 'System and Application Access Control',
    domain: ISO27001Domain.ACCESS_CONTROL,
    relevantEventTypes: [
      AuditEventType.AUTHZ_ROLE_ASSIGNED,
      AuditEventType.AUTHZ_ROLE_UNASSIGNED,
      AuditEventType.AUTHZ_PRIVILEGE_ESCALATION
    ],
    testingProcedure: 'Review access control mechanisms',
    evidenceRequired: ['Access control lists', 'Role definitions', 'Privilege logs']
  },

  // Operations Security (A.12)
  'A.12.1': {
    controlId: 'A.12.1',
    controlName: 'Operational Procedures',
    domain: ISO27001Domain.OPERATIONS_SECURITY,
    relevantEventTypes: [
      AuditEventType.SYSTEM_CONFIG_CHANGE,
      AuditEventType.SYSTEM_DEPLOYMENT,
      AuditEventType.SYSTEM_STARTUP,
      AuditEventType.SYSTEM_SHUTDOWN
    ],
    testingProcedure: 'Review operational procedures and documentation',
    evidenceRequired: ['Operating procedures', 'Change logs', 'Incident reports']
  },

  'A.12.2': {
    controlId: 'A.12.2',
    controlName: 'Malware Protection',
    domain: ISO27001Domain.OPERATIONS_SECURITY,
    relevantEventTypes: [
      AuditEventType.SECURITY_MALWARE_DETECTED
    ],
    testingProcedure: 'Verify malware protection is active and updated',
    evidenceRequired: ['Antivirus logs', 'Scan reports', 'Incident records']
  },

  'A.12.3': {
    controlId: 'A.12.3',
    controlName: 'Backup',
    domain: ISO27001Domain.OPERATIONS_SECURITY,
    relevantEventTypes: [
      AuditEventType.DATA_BACKUP,
      AuditEventType.DATA_RESTORE
    ],
    testingProcedure: 'Verify backup procedures and test restoration',
    evidenceRequired: ['Backup logs', 'Restore test results', 'Backup policies']
  },

  'A.12.4': {
    controlId: 'A.12.4',
    controlName: 'Logging and Monitoring',
    domain: ISO27001Domain.OPERATIONS_SECURITY,
    relevantEventTypes: [
      AuditEventType.AUDIT_LOG_ACCESSED,
      AuditEventType.MONITORING_ALERT_TRIGGERED,
      AuditEventType.MONITORING_ANOMALY_DETECTED
    ],
    testingProcedure: 'Review logging and monitoring systems',
    evidenceRequired: ['Audit logs', 'Monitoring configurations', 'Alert logs']
  },

  // Information Security Incident Management (A.16)
  'A.16.1': {
    controlId: 'A.16.1',
    controlName: 'Management of Information Security Incidents',
    domain: ISO27001Domain.INFORMATION_SECURITY_INCIDENT_MANAGEMENT,
    relevantEventTypes: [
      AuditEventType.SECURITY_VULNERABILITY_DETECTED,
      AuditEventType.SECURITY_INTRUSION_DETECTED,
      AuditEventType.SECURITY_DATA_BREACH,
      AuditEventType.COMPLIANCE_ASSESSMENT
    ],
    testingProcedure: 'Review incident management procedures and records',
    evidenceRequired: ['Incident reports', 'Response procedures', 'Lessons learned']
  }
};

/**
 * Get SOC 2 controls for an event type
 */
export function getSOC2ControlsForEventType(eventType: AuditEventType): string[] {
  const controls: string[] = [];

  for (const [controlId, mapping] of Object.entries(SOC2_CONTROL_MAPPING)) {
    if (mapping.relevantEventTypes.includes(eventType)) {
      controls.push(controlId);
    }
  }

  return controls;
}

/**
 * Get ISO 27001 controls for an event type
 */
export function getISO27001ControlsForEventType(eventType: AuditEventType): string[] {
  const controls: string[] = [];

  for (const [controlId, mapping] of Object.entries(ISO27001_CONTROL_MAPPING)) {
    if (mapping.relevantEventTypes.includes(eventType)) {
      controls.push(controlId);
    }
  }

  return controls;
}

/**
 * Map event types to required retention periods
 */
export function getRetentionPeriodForEvent(eventType: AuditEventType): number {
  // Security events require longest retention
  if (eventType.startsWith('security.')) {
    return 2555; // 7 years
  }

  // Authentication and authorization events
  if (eventType.startsWith('auth.') || eventType.startsWith('authz.')) {
    return 2555; // 7 years
  }

  // Data events
  if (eventType.startsWith('data.')) {
    return 2555; // 7 years
  }

  // Audit events
  if (eventType.startsWith('audit.')) {
    return 2555; // 7 years
  }

  // System events
  if (eventType.startsWith('system.')) {
    return 1095; // 3 years
  }

  // Default retention
  return 2555; // 7 years
}

/**
 * Check if event type requires immediate alerting
 */
export function requiresImmediateAlert(eventType: AuditEventType): boolean {
  const alertRequiredEvents = [
    AuditEventType.SECURITY_DATA_BREACH,
    AuditEventType.SECURITY_INTRUSION_DETECTED,
    AuditEventType.SECURITY_BRUTE_FORCE_ATTEMPT,
    AuditEventType.SECURITY_DOS_ATTACK,
    AuditEventType.AUTHZ_PRIVILEGE_ESCALATION,
    AuditEventType.AUTH_MFA_DISABLED,
    AuditEventType.DATA_BULK_DELETE,
    AuditEventType.DATA_BULK_EXPORT,
    AuditEventType.SYSTEM_PERFORMANCE_DEGRADED
  ];

  return alertRequiredEvents.includes(eventType);
}

/**
 * Get alert severity for event type
 */
export function getAlertSeverity(eventType: AuditEventType): 'critical' | 'high' | 'medium' | 'low' {
  const criticalEvents = [
    AuditEventType.SECURITY_DATA_BREACH,
    AuditEventType.SECURITY_INTRUSION_DETECTED
  ];

  const highEvents = [
    AuditEventType.SECURITY_BRUTE_FORCE_ATTEMPT,
    AuditEventType.SECURITY_DOS_ATTACK,
    AuditEventType.AUTHZ_PRIVILEGE_ESCALATION,
    AuditEventType.DATA_BULK_DELETE
  ];

  const mediumEvents = [
    AuditEventType.AUTH_MFA_DISABLED,
    AuditEventType.AUTH_FAILED_LOGIN,
    AuditEventType.DATA_BULK_EXPORT
  ];

  if (criticalEvents.includes(eventType)) {
    return 'critical';
  }

  if (highEvents.includes(eventType)) {
    return 'high';
  }

  if (mediumEvents.includes(eventType)) {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate compliance evidence request
 */
export function generateEvidenceRequest(
  framework: ComplianceFramework,
  controlIds: string[],
  periodStart: Date,
  periodEnd: Date
): {
  framework: ComplianceFramework;
  controls: Array<{
    controlId: string;
    controlName: string;
    evidenceRequired: string[];
    query: any;
  }>;
} {
  const controls: any[] = [];

  for (const controlId of controlIds) {
    let mapping;

    if (framework === ComplianceFramework.SOC2) {
      mapping = SOC2_CONTROL_MAPPING[controlId];
    } else if (framework === ComplianceFramework.ISO27001) {
      mapping = ISO27001_CONTROL_MAPPING[controlId];
    }

    if (mapping) {
      controls.push({
        controlId: mapping.controlId,
        controlName: mapping.controlName,
        evidenceRequired: mapping.evidenceRequired,
        query: {
          eventTypes: mapping.relevantEventTypes,
          startTime: periodStart.toISOString(),
          endTime: periodEnd.toISOString()
        }
      });
    }
  }

  return {
    framework,
    controls
  };
}

/**
 * Calculate compliance score for a control
 */
export function calculateControlScore(
  totalTests: number,
  passedTests: number,
  findings: number,
  severityWeights: { critical: number; high: number; medium: number; low: number } = {
    critical: 10,
    high: 5,
    medium: 2,
    low: 1
  }
): number {
  if (totalTests === 0) {
    return 100;
  }

  const testScore = (passedTests / totalTests) * 100;

  // Deduct points for findings based on severity
  let deduction = 0;
  // This would be calculated from actual findings
  // For now, we return the test score

  return Math.max(0, Math.min(100, testScore));
}

/**
 * Generate compliance status
 */
export function generateComplianceStatus(score: number): 'compliant' | 'non_compliant' | 'partial' {
  if (score >= 95) {
    return 'compliant';
  } else if (score >= 70) {
    return 'partial';
  } else {
    return 'non_compliant';
  }
}

/**
 * Map events to compliance categories
 */
export function mapEventsToComplianceCategories(
  events: any[]
): Record<string, number> {
  const categories: Record<string, number> = {
    'Access Control': 0,
    'Data Protection': 0,
    'Incident Response': 0,
    'Change Management': 0,
    'Monitoring': 0,
    'Encryption': 0,
    'Business Continuity': 0
  };

  for (const event of events) {
    if (event.eventType.startsWith('auth.') || event.eventType.startsWith('authz.')) {
      categories['Access Control']++;
    } else if (event.eventType.startsWith('data.')) {
      categories['Data Protection']++;
    } else if (event.eventType.startsWith('security.')) {
      categories['Incident Response']++;
    } else if (event.eventType.startsWith('system.')) {
      categories['Change Management']++;
    } else if (event.eventType.startsWith('monitoring.')) {
      categories['Monitoring']++;
    } else if (event.eventType.includes('encrypt') || event.eventType.includes('certificate')) {
      categories['Encryption']++;
    }
  }

  return categories;
}

/**
 * Generate compliance recommendations
 */
export function generateComplianceRecommendations(
  framework: ComplianceFramework,
  findings: any[]
): Array<{
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  recommendation: string;
  reference?: string;
}> {
  const recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    recommendation: string;
    reference?: string;
  }> = [];

  // Analyze findings and generate recommendations
  const criticalFindings = findings.filter(f => f.severity === 'critical');
  const highFindings = findings.filter(f => f.severity === 'high');

  if (criticalFindings.length > 0) {
    recommendations.push({
      priority: 'critical',
      category: 'Security',
      recommendation: `Address ${criticalFindings.length} critical findings immediately`,
      reference: criticalFindings.map(f => f.id).join(', ')
    });
  }

  if (highFindings.length > 0) {
    recommendations.push({
      priority: 'high',
      category: 'Compliance',
      recommendation: `Address ${highFindings.length} high-priority findings within 30 days`,
      reference: highFindings.map(f => f.id).join(', ')
    });
  }

  return recommendations;
}

/**
 * Validate compliance with retention requirements
 */
export function validateRetentionRequirements(
  framework: ComplianceFramework,
  eventDate: Date,
  currentDate: Date = new Date()
): {
  isCompliant: boolean;
  daysRemaining: number;
  requiredRetentionDays: number;
} {
  const requiredRetentionDays = getRetentionPeriodForFramework(framework);
  const daysElapsed = Math.floor((currentDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = requiredRetentionDays - daysElapsed;

  return {
    isCompliant: daysRemaining >= 0,
    daysRemaining,
    requiredRetentionDays
  };
}

/**
 * Get retention period for framework
 */
function getRetentionPeriodForFramework(framework: ComplianceFramework): number {
  switch (framework) {
    case ComplianceFramework.SOC2:
      return 2555; // 7 years
    case ComplianceFramework.ISO27001:
      return 3650; // 10 years
    case ComplianceFramework.GDPR:
      return 2555; // 7 years
    case ComplianceFramework.HIPAA:
      return 2555; // 7 years
    case ComplianceFramework.PCI_DSS:
      return 365; // 1 year
    default:
      return 2555; // 7 years
  }
}
