import {
  PolicyDefinition,
  ComplianceStandard,
  ComplianceCategory,
  SeverityLevel
} from '../types';

/**
 * SOC 2 Type II Policy Definitions
 */
export const SOC2_POLICIES: PolicyDefinition[] = [
  {
    id: 'soc2-cc-1.1',
    name: 'Control Environment',
    description: 'Management establishes structures, reporting lines, and authorities to ensure control objectives are met',
    standard: ComplianceStandard.SOC2,
    category: ComplianceCategory.SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'CISO',
    rules: [
      {
        id: 'soc2-cc-1.1-1',
        name: 'Board Oversight',
        description: 'Board of directors should oversee security governance',
        condition: 'governance.boardOversight === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Establish board-level security committee with regular oversight meetings'
      },
      {
        id: 'soc2-cc-1.1-2',
        name: 'Policy Management',
        description: 'Security policies must be documented, communicated, and enforced',
        condition: 'policies.published.length > 0 && policies.lastReview <= 365 days ago',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Create and publish comprehensive security policy suite'
      }
    ],
    controls: [
      {
        id: 'soc2-ctrl-gov-1',
        name: 'Governance Committee',
        description: 'Executive security governance committee',
        type: 'preventive',
        frequency: 'quarterly',
        automated: false,
        implementation: 'Quarterly board meetings with security agenda items'
      }
    ]
  },
  {
    id: 'soc2-cc-6.1',
    name: 'Logical and Physical Access Controls',
    description: 'Logical and physical access controls safeguard against threats',
    standard: ComplianceStandard.SOC2,
    category: ComplianceCategory.ACCESS_CONTROL,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Team',
    rules: [
      {
        id: 'soc2-cc-6.1-1',
        name: 'MFA Requirement',
        description: 'Multi-factor authentication required for all external access',
        condition: 'authentication.mfaEnabled === true && authentication.mfaCoverage === 100%',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Enable MFA for all user accounts immediately'
      },
      {
        id: 'soc2-cc-6.1-2',
        name: 'Password Complexity',
        description: 'Passwords must meet complexity requirements',
        condition: 'passwordPolicy.minLength >= 12 && passwordPolicy.requireComplexity === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Update password policy to require 12+ character complex passwords'
      },
      {
        id: 'soc2-cc-6.1-3',
        name: 'Access Review',
        description: 'User access must be reviewed quarterly',
        condition: 'accessReviews.lastReview <= 90 days ago && accessReviews.coverage === 100%',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Conduct quarterly access review for all users'
      },
      {
        id: 'soc2-cc-6.1-4',
        name: 'Least Privilege',
        description: 'Users should have minimum required access',
        condition: 'access.privilegeLevel === "required"',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: true,
        remediation: 'Implement role-based access control with least privilege principle'
      },
      {
        id: 'soc2-cc-6.1-5',
        name: 'Session Timeout',
        description: 'Sessions must timeout after inactivity',
        condition: 'session.timeout <= 30 minutes',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: true,
        remediation: 'Configure 30-minute session timeout for all applications'
      }
    ],
    controls: [
      {
        id: 'soc2-ctrl-auth-1',
        name: 'MFA Enforcement',
        description: 'Multi-factor authentication for all access',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'MFA required at login for all users'
      },
      {
        id: 'soc2-ctrl-auth-2',
        name: 'Identity Provider',
        description: 'Centralized identity management',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'SSO via enterprise identity provider'
      }
    ]
  },
  {
    id: 'soc2-cc-6.6',
    name: 'Encryption',
    description: 'Encryption of confidential information',
    standard: ComplianceStandard.SOC2,
    category: ComplianceCategory.CRYPTOGRAPHY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Team',
    rules: [
      {
        id: 'soc2-cc-6.6-1',
        name: 'Data at Rest Encryption',
        description: 'All sensitive data must be encrypted at rest',
        condition: 'encryption.atRest.enabled === true && encryption.atRest.algorithm === "AES-256"',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Enable AES-256 encryption for all databases and storage'
      },
      {
        id: 'soc2-cc-6.6-2',
        name: 'Data in Transit Encryption',
        description: 'All data transmission must be encrypted',
        condition: 'encryption.inTransit.enabled === true && encryption.inTransit.tlsVersion >= "1.2"',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Enforce TLS 1.2+ for all network communications'
      },
      {
        id: 'soc2-cc-6.6-3',
        name: 'Key Management',
        description: 'Encryption keys must be properly managed',
        condition: 'keyManagement.rotation <= 90 days && keyManagement.storage === "hsm"',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement HSM-based key management with 90-day rotation'
      }
    ],
    controls: [
      {
        id: 'soc2-ctrl-enc-1',
        name: 'Database Encryption',
        description: 'Transparent data encryption for databases',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'TDE enabled on all database instances'
      }
    ]
  },
  {
    id: 'soc2-cc-7.2',
    name: 'System Monitoring',
    description: 'Monitor systems for security events and anomalies',
    standard: ComplianceStandard.SOC2,
    category: ComplianceCategory.OPERATIONS_SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Operations',
    rules: [
      {
        id: 'soc2-cc-7.2-1',
        name: 'Log Collection',
        description: 'Security logs must be collected from all systems',
        condition: 'logging.coverage === 100% && logging.retention >= 90 days',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Deploy log collectors to all systems with 90-day retention'
      },
      {
        id: 'soc2-cc-7.2-2',
        name: 'Intrusion Detection',
        description: 'IDS/IPS must be deployed and monitored',
        condition: 'ids.deployed === true && ids.monitoring === "24/7"',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Deploy intrusion detection with continuous monitoring'
      },
      {
        id: 'soc2-cc-7.2-3',
        name: 'Alert Response Time',
        description: 'Security alerts must be responded to promptly',
        condition: 'alerting.meanResponseTime <= 15 minutes',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: true,
        remediation: 'Establish 24/7 security monitoring with 15-minute SLA'
      }
    ],
    controls: [
      {
        id: 'soc2-ctrl-mon-1',
        name: 'SIEM',
        description: 'Security information and event management',
        type: 'detective',
        frequency: 'continuous',
        automated: true,
        implementation: 'Centralized log aggregation and analysis'
      }
    ]
  },
  {
    id: 'soc2-cc-8.1',
    name: 'Change Management',
    description: 'Control changes to systems and data',
    standard: ComplianceStandard.SOC2,
    category: ComplianceCategory.OPERATIONS_SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Engineering',
    rules: [
      {
        id: 'soc2-cc-8.1-1',
        name: 'Change Approval',
        description: 'All changes must be approved',
        condition: 'changes.approvalRequired === true && changes.approvalRate === 100%',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement formal change approval process'
      },
      {
        id: 'soc2-cc-8.1-2',
        name: 'Change Testing',
        description: 'Changes must be tested before deployment',
        condition: 'changes.testingRequired === true && changes.testCoverage >= 80%',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Require automated testing for all changes'
      },
      {
        id: 'soc2-cc-8.1-3',
        name: 'Rollback Capability',
        description: 'Changes must be reversible',
        condition: 'changes.rollbackEnabled === true',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: true,
        remediation: 'Ensure all deployments have rollback capability'
      }
    ],
    controls: [
      {
        id: 'soc2-ctrl-change-1',
        name: 'CI/CD Pipeline',
        description: 'Automated deployment pipeline',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'GitOps-based deployment with approval gates'
      }
    ]
  }
];

/**
 * ISO 27001 Policy Definitions
 */
export const ISO27001_POLICIES: PolicyDefinition[] = [
  {
    id: 'iso-27001-A.9',
    name: 'Access Control',
    description: 'Ensure authorized user access and prevent unauthorized access',
    standard: ComplianceStandard.ISO27001,
    category: ComplianceCategory.ACCESS_CONTROL,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Information Security',
    rules: [
      {
        id: 'iso-27001-A.9.1',
        name: 'Access Control Policy',
        description: 'Formal access control policy must exist',
        condition: 'policies.accessControl.exists === true && policies.accessControl.published === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Create and publish formal access control policy'
      },
      {
        id: 'iso-27001-A.9.2',
        name: 'User Access Management',
        description: 'Formal user registration and de-registration process',
        condition: 'userManagement.processExists === true && userManagement.automated === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement automated user lifecycle management'
      },
      {
        id: 'iso-27001-A.9.3',
        name: 'User Responsibilities',
        description: 'Users must sign confidentiality agreements',
        condition: 'userManagement.ndaSigned === true && userManagement.ndaCoverage === 100%',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: false,
        remediation: 'Ensure all users sign updated confidentiality agreements'
      },
      {
        id: 'iso-27001-A.9.4',
        name: 'System Access Control',
        description: 'Access controls based on business requirements',
        condition: 'accessControl.rbacEnabled === true && accessControl.reviewed <= 6 months ago',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement role-based access control with semi-annual reviews'
      }
    ],
    controls: [
      {
        id: 'iso-ctrl-ac-1',
        name: 'Identity Management System',
        description: 'Centralized identity and access management',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'Enterprise IAM with automated provisioning'
      }
    ]
  },
  {
    id: 'iso-27001-A.10',
    name: 'Cryptography',
    description: 'Proper use of cryptography to protect information',
    standard: ComplianceStandard.ISO27001,
    category: ComplianceCategory.CRYPTOGRAPHY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Team',
    rules: [
      {
        id: 'iso-27001-A.10.1',
        name: 'Cryptography Policy',
        description: 'Policy on cryptographic controls must exist',
        condition: 'policies.cryptography.exists === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Develop comprehensive cryptography policy'
      },
      {
        id: 'iso-27001-A.10.1.1',
        name: 'Key Management',
        description: 'Lifecycle management of cryptographic keys',
        condition: 'keyManagement.lifecycleDefined === true && keyManagement.automated === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement automated key lifecycle management'
      },
      {
        id: 'iso-27001-A.10.1.2',
        name: 'Encryption Standards',
        description: 'Use approved encryption algorithms',
        condition: 'encryption.algorithms.includes("AES-256") && encryption.algorithms.includes("RSA-4096")',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Mandate AES-256 and RSA-4096 for all encryption'
      }
    ],
    controls: [
      {
        id: 'iso-ctrl-crypto-1',
        name: 'Key Management Service',
        description: 'Centralized key management',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'Cloud KMS with HSM backing'
      }
    ]
  },
  {
    id: 'iso-27001-A.12',
    name: 'Operations Security',
    description: 'Ensure correct and secure operations',
    standard: ComplianceStandard.ISO27001,
    category: ComplianceCategory.OPERATIONS_SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Operations',
    rules: [
      {
        id: 'iso-27001-A.12.1',
        name: 'Operating Procedures',
        description: 'Documented operating procedures',
        condition: 'procedures.operations.documented === true && procedures.operations.versioned === true',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: false,
        remediation: 'Document and version all operational procedures'
      },
      {
        id: 'iso-27001-A.12.2',
        name: 'Malware Protection',
        description: 'Malware detection and prevention controls',
        condition: 'malwareDetection.deployed === true && malwareDetection.updated <= 24 hours ago',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Deploy endpoint protection with daily updates'
      },
      {
        id: 'iso-27001-A.12.3',
        name: 'Backup',
        description: 'Information backup procedures',
        condition: 'backup.frequency === "daily" && backup.tested <= 30 days ago',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement daily backups with monthly restoration tests'
      },
      {
        id: 'iso-27001-A.12.4',
        name: 'Logging',
        description: 'Event logging and monitoring',
        condition: 'logging.enabled === true && logging.retention >= 12 months',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Enable comprehensive logging with 12-month retention'
      },
      {
        id: 'iso-27001-A.12.5',
        name: 'Vulnerability Management',
        description: 'Regular vulnerability scanning and patching',
        condition: 'vulnerabilityManagement.frequency === "weekly" && vulnerabilityManagement.sla <= 30 days',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Weekly vulnerability scanning with 30-day remediation SLA'
      }
    ],
    controls: [
      {
        id: 'iso-ctrl-ops-1',
        name: 'Backup System',
        description: 'Automated backup and recovery',
        type: 'corrective',
        frequency: 'daily',
        automated: true,
        implementation: 'Automated daily backups with geo-redundancy'
      }
    ]
  },
  {
    id: 'iso-27001-A.14',
    name: 'System Acquisition',
    description: 'Security of system acquisition and development',
    standard: ComplianceStandard.ISO27001,
    category: ComplianceCategory.SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Engineering',
    rules: [
      {
        id: 'iso-27001-A.14.1',
        name: 'Security Requirements',
        description: 'Identify and document security requirements',
        condition: 'development.securityRequirements === true && development.threatModeling === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Require threat modeling for all projects'
      },
      {
        id: 'iso-27001-A.14.2',
        name: 'Secure Development',
        description: 'Security controls in development process',
        condition: 'development.sastEnabled === true && development.scaEnabled === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Enable SAST and SCA in CI/CD pipeline'
      },
      {
        id: 'iso-27001-A.14.3',
        name: 'Testing Data',
        description: 'Protect test data from production data',
        condition: 'testing.dataMasked === true && testing.dataAnonymized === true',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: true,
        remediation: 'Use synthetic or masked data for testing'
      }
    ],
    controls: [
      {
        id: 'iso-ctrl-dev-1',
        name: 'Secure SDLC',
        description: 'Security-integrated development lifecycle',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'Security gates in CI/CD pipeline'
      }
    ]
  }
];

/**
 * GDPR Policy Definitions
 */
export const GDPR_POLICIES: PolicyDefinition[] = [
  {
    id: 'gdpr-art-32',
    name: 'Security of Processing',
    description: 'Technical and organizational measures for data security',
    standard: ComplianceStandard.GDPR,
    category: ComplianceCategory.DATA_PROTECTION,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'DPO',
    rules: [
      {
        id: 'gdpr-art-32-1',
        name: 'Pseudonymization',
        description: 'Use pseudonymization and encryption',
        condition: 'dataProtection.pseudonymization === true && dataProtection.encryption === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement pseudonymization and encryption for all personal data'
      },
      {
        id: 'gdpr-art-32-2',
        name: 'Confidentiality',
        description: 'Ensure ongoing confidentiality of data',
        condition: 'accessControl.confidentiality === true && accessControl.auditing === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement access controls and audit logging'
      },
      {
        id: 'gdpr-art-32-3',
        name: 'Data Resilience',
        description: 'Ability to restore availability and access',
        condition: 'backup.frequency === "daily" && backup.rpo <= 1 hour',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement daily backups with 1-hour RPO'
      },
      {
        id: 'gdpr-art-32-4',
        name: 'Security Testing',
        description: 'Regular security testing',
        condition: 'securityTesting.frequency === "quarterly" && securityTesting.penetrationTesting === true',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: false,
        remediation: 'Conduct quarterly security assessments including penetration testing'
      }
    ],
    controls: [
      {
        id: 'gdpr-ctrl-sec-1',
        name: 'Data Protection by Design',
        description: 'Privacy-centric architecture',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'Privacy-preserving data architecture'
      }
    ]
  },
  {
    id: 'gdpr-art-15',
    name: 'Right of Access',
    description: 'Data subject right to access their personal data',
    standard: ComplianceStandard.GDPR,
    category: ComplianceCategory.PRIVACY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'DPO',
    rules: [
      {
        id: 'gdpr-art-15-1',
        name: 'Data Access Process',
        description: 'Process for data subjects to request their data',
        condition: 'processes.dataAccessRequest.exists === true && processes.dataAccessRequest.automated === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement self-service data access request portal'
      },
      {
        id: 'gdpr-art-15-2',
        name: 'Response Time',
        description: 'Respond to access requests within 30 days',
        condition: 'requests.accessResponseTime <= 30 days',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement SLA tracking for access requests'
      },
      {
        id: 'gdpr-art-15-3',
        name: 'Data Copy',
        description: 'Provide copy of personal data',
        condition: 'requests.dataCopyFormat === "machine-readable" && requests.dataCopyComplete === true',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: true,
        remediation: 'Enable export of all personal data in machine-readable format'
      }
    ],
    controls: [
      {
        id: 'gdpr-ctrl-access-1',
        name: 'Data Subject Portal',
        description: 'Self-service privacy portal',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'Web portal for data subject requests'
      }
    ]
  },
  {
    id: 'gdpr-art-16',
    name: 'Right to Rectification',
    description: 'Data subject right to correct inaccurate data',
    standard: ComplianceStandard.GDPR,
    category: ComplianceCategory.PRIVACY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'DPO',
    rules: [
      {
        id: 'gdpr-art-16-1',
        name: 'Rectification Process',
        description: 'Process for data subjects to correct their data',
        condition: 'processes.dataRectification.exists === true && processes.dataRectification.verified === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement data correction workflow with verification'
      },
      {
        id: 'gdpr-art-16-2',
        name: 'Data Verification',
        description: 'Verify accuracy before correction',
        condition: 'processes.dataRectification.verification === "identity-proofing"',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: true,
        remediation: 'Require identity verification for data corrections'
      }
    ],
    controls: [
      {
        id: 'gdpr-ctrl-rect-1',
        name: 'Data Correction API',
        description: 'Programmatic data correction',
        type: 'corrective',
        frequency: 'continuous',
        automated: true,
        implementation: 'API for verified data corrections'
      }
    ]
  },
  {
    id: 'gdpr-art-17',
    name: 'Right to Erasure',
    description: 'Data subject right to deletion (right to be forgotten)',
    standard: ComplianceStandard.GDPR,
    category: ComplianceCategory.PRIVACY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'DPO',
    rules: [
      {
        id: 'gdpr-art-17-1',
        name: 'Deletion Process',
        description: 'Process for data subjects to request deletion',
        condition: 'processes.dataDeletion.exists === true && processes.dataDeletion.responseTime <= 30 days',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement data deletion request process with 30-day SLA'
      },
      {
        id: 'gdpr-art-17-2',
        name: 'Complete Deletion',
        description: 'Delete data from all systems',
        condition: 'processes.dataDeletion.scope === "all-systems" && processes.dataDeletion.verified === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Ensure deletion cascades to all systems with verification'
      },
      {
        id: 'gdpr-art-17-3',
        name: 'Retention Compliance',
        description: 'Respect legal retention requirements',
        condition: 'processes.dataDeletion.retentionCheck === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Check retention requirements before deletion'
      }
    ],
    controls: [
      {
        id: 'gdpr-ctrl-del-1',
        name: 'Data Deletion Manager',
        description: 'Automated data deletion',
        type: 'corrective',
        frequency: 'continuous',
        automated: true,
        implementation: 'System-wide data deletion with verification'
      }
    ]
  },
  {
    id: 'gdpr-art-35',
    name: 'Data Protection Impact Assessment',
    description: 'DPIA for high-risk processing',
    standard: ComplianceStandard.GDPR,
    category: ComplianceCategory.DATA_PROTECTION,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'DPO',
    rules: [
      {
        id: 'gdpr-art-35-1',
        name: 'DPIA Required',
        description: 'Conduct DPIA for high-risk processing',
        condition: 'dpia.highRiskProcessing.assessed === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Identify and assess all high-risk processing activities'
      },
      {
        id: 'gdpr-art-35-2',
        name: 'DPIA Process',
        description: 'Systematic DPIA process',
        condition: 'dpia.process.exists === true && dpia.process.dpoConsultation === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Establish DPIA process with DPO consultation'
      },
      {
        id: 'gdpr-art-35-3',
        name: 'DPIA Review',
        description: 'Regular review of DPIAs',
        condition: 'dpia.review.frequency === "annually" && dpia.review.updatedWhenRisksChange === true',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: false,
        remediation: 'Review DPIAs annually and when risks change'
      }
    ],
    controls: [
      {
        id: 'gdpr-ctrl-dpia-1',
        name: 'DPIA Workflow',
        description: 'DPIA management system',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'DPIA tracking and approval workflow'
      }
    ]
  }
];

/**
 * HIPAA Policy Definitions
 */
export const HIPAA_POLICIES: PolicyDefinition[] = [
  {
    id: 'hipaa-164.308-a1',
    name: 'Security Management Process',
    description: 'Implement policies and procedures to prevent, detect, and contain security violations',
    standard: ComplianceStandard.HIPAA,
    category: ComplianceCategory.SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Officer',
    rules: [
      {
        id: 'hipaa-164.308-a1-i',
        name: 'Risk Analysis',
        description: 'Conduct accurate and thorough risk assessment',
        condition: 'riskAnalysis.conducted === true && riskAnalysis.lastUpdate <= 12 months ago',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Conduct comprehensive HIPAA risk analysis annually'
      },
      {
        id: 'hipaa-164.308-a1-ii',
        name: 'Risk Management',
        description: 'Implement security measures to reduce risks',
        condition: 'riskManagement.plan.exists === true && riskManagement.implementationProgress === "on-track"',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Implement and track risk mitigation measures'
      },
      {
        id: 'hipaa-164.308-a1-iii',
        name: 'Sanction Policy',
        description: 'Policy for sanctions against workforce members',
        condition: 'policies.sanctions.exists === true && policies.sanctions.communicated === true',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: false,
        remediation: 'Create and communicate sanctions policy'
      }
    ],
    controls: [
      {
        id: 'hipaa-ctrl-risk-1',
        name: 'HIPAA Risk Management',
        description: 'HIPAA-specific risk management program',
        type: 'preventive',
        frequency: 'annually',
        automated: false,
        implementation: 'Annual HIPAA risk analysis and mitigation planning'
      }
    ]
  },
  {
    id: 'hipaa-164.308-a3',
    name: 'Workforce Security',
    description: 'Policies and procedures for workforce authorization and supervision',
    standard: ComplianceStandard.HIPAA,
    category: ComplianceCategory.ACCESS_CONTROL,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'HR',
    rules: [
      {
        id: 'hipaa-164.308-a3-i',
        name: 'Authorization',
        description: 'Authorize access to PHI only as appropriate',
        condition: 'workforce.authorization.process === "role-based" && workforce.authorization.documented === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement role-based authorization for PHI access'
      },
      {
        id: 'hipaa-164.308-a3-ii',
        name: 'Background Checks',
        description: 'Conduct background checks for workforce members',
        condition: 'workforce.backgroundCheck.required === true && workforce.backgroundCheck.conducted === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Require background checks for all personnel with PHI access'
      },
      {
        id: 'hipaa-164.308-a3-iii',
        name: 'Termination Procedures',
        description: 'Procedures for terminating access',
        condition: 'workforce.termination.accessRevoked === "immediate" && workforce.termination.logged === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Automate immediate access revocation on termination'
      }
    ],
    controls: [
      {
        id: 'hipaa-ctrl-workforce-1',
        name: 'Access Provisioning',
        description: 'Automated access management',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'Automated provisioning and deprovisioning'
      }
    ]
  },
  {
    id: 'hipaa-164.308-a5',
    name: 'Security Incident Procedures',
    description: 'Policies and procedures for security incidents',
    standard: ComplianceStandard.HIPAA,
    category: ComplianceCategory.INCIDENT_MANAGEMENT,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Officer',
    rules: [
      {
        id: 'hipaa-164.308-a5-i',
        name: 'Incident Response',
        description: 'Identify and respond to security incidents',
        condition: 'incidentResponse.plan.exists === true && incidentResponse.team.established === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Establish incident response plan and team'
      },
      {
        id: 'hipaa-164.308-a5-ii',
        name: 'Incident Reporting',
        description: 'Report security incidents promptly',
        condition: 'incidentResponse.reportingTime <= 60 minutes && incidentResponse.documented === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement 60-minute incident reporting SLA'
      },
      {
        id: 'hipaa-164.308-a5-iii',
        name: 'Breach Notification',
        description: 'Notify affected individuals and HHS of breaches',
        condition: 'breachNotification.process.exists === true && breachNotification.timeline <= 60 days',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Establish breach notification process meeting 60-day requirement'
      }
    ],
    controls: [
      {
        id: 'hipaa-ctrl-incident-1',
        name: 'Incident Response Platform',
        description: 'Security incident management',
        type: 'detective',
        frequency: 'continuous',
        automated: true,
        implementation: 'Automated incident detection and response workflow'
      }
    ]
  },
  {
    id: 'hipaa-164.312-a1',
    name: 'Access Control',
    description: 'Implement technical policies and procedures for electronic information access',
    standard: ComplianceStandard.HIPAA,
    category: ComplianceCategory.ACCESS_CONTROL,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Team',
    rules: [
      {
        id: 'hipaa-164.312-a1-i',
        name: 'Unique User Identification',
        description: 'Assign unique identifiers to each user',
        condition: 'accessControl.uniqueUsers === true && accessControl.noSharing === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Ensure unique user IDs with no account sharing'
      },
      {
        id: 'hipaa-164.312-a1-ii',
        name: 'Emergency Access',
        description: 'Emergency access procedure',
        condition: 'accessControl.emergencyAccess.exists === true && accessControl.emergencyAccess.logged === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement emergency access procedure with audit logging'
      },
      {
        id: 'hipaa-164.312-a1-iii',
        name: 'Automatic Logoff',
        description: 'Automatic logoff after inactivity',
        condition: 'accessControl.autoLogoff.enabled === true && accessControl.autoLogoff.timeout <= 15 minutes',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Configure 15-minute automatic logoff'
      },
      {
        id: 'hipaa-164.312-a1-iv',
        name: 'Encryption and Decryption',
        description: 'Encrypt PHI in transit and at rest',
        condition: 'encryption.atRest.enabled === true && encryption.inTransit.enabled === true',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Enable encryption for PHI at rest and in transit'
      }
    ],
    controls: [
      {
        id: 'hipaa-ctrl-ei-1',
        name: 'PHI Encryption',
        description: 'PHI-specific encryption controls',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'AES-256 encryption for all PHI'
      }
    ]
  },
  {
    id: 'hipaa-164.312-b',
    name: 'Audit Controls',
    description: 'Implement hardware, software, and procedural mechanisms to record and examine activity',
    standard: ComplianceStandard.HIPAA,
    category: ComplianceCategory.OPERATIONS_SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Team',
    rules: [
      {
        id: 'hipaa-164.312-b-1',
        name: 'Access Logging',
        description: 'Log all PHI access',
        condition: 'audit.phiAccess.enabled === true && audit.phiAccess.comprehensive === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Enable comprehensive logging of all PHI access'
      },
      {
        id: 'hipaa-164.312-b-2',
        name: 'Log Retention',
        description: 'Retain audit logs for 6 years',
        condition: 'audit.retention.period >= 6 years && audit.retention.secure === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Configure 6-year secure log retention'
      },
      {
        id: 'hipaa-164.312-b-3',
        name: 'Log Review',
        description: 'Regular review of audit logs',
        condition: 'audit.review.frequency === "monthly" && audit.review.documented === true',
        severity: SeverityLevel.MEDIUM,
        automatedCheck: false,
        remediation: 'Implement monthly audit log review process'
      }
    ],
    controls: [
      {
        id: 'hipaa-ctrl-audit-1',
        name: 'PHI Audit Logging',
        description: 'Comprehensive PHI access logging',
        type: 'detective',
        frequency: 'continuous',
        automated: true,
        implementation: 'Detailed logging of all PHI access and modifications'
      }
    ]
  }
];

/**
 * PCI DSS Policy Definitions
 */
export const PCI_DSS_POLICIES: PolicyDefinition[] = [
  {
    id: 'pci-dss-1',
    name: 'Install and Maintain Firewall Configuration',
    description: 'Protect cardholder data with firewalls',
    standard: ComplianceStandard.PCI_DSS,
    category: ComplianceCategory.SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Network Security',
    rules: [
      {
        id: 'pci-dss-1.1',
        name: 'Firewall Configuration',
        description: 'Establish firewall configuration standards',
        condition: 'firewall.configDocumented === true && firewall.configReviewed <= 6 months ago',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Document and review firewall configuration standards'
      },
      {
        id: 'pci-dss-1.2',
        name: 'Default Passwords',
        description: 'Change vendor default passwords',
        condition: 'firewall.defaultPasswords.changed === true',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Change all default passwords immediately'
      },
      {
        id: 'pci-dss-1.3',
        name: 'Direct Access',
        description: 'Prevent direct access to cardholder data',
        condition: 'firewall.directAccess.blocked === true && firewall.inboundFiltered === true',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Block all direct inbound access to cardholder data environment'
      }
    ],
    controls: [
      {
        id: 'pci-ctrl-fw-1',
        name: 'Next-Generation Firewall',
        description: 'Advanced firewall protection',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'NGFW with IPS and application control'
      }
    ]
  },
  {
    id: 'pci-dss-2',
    name: 'Do Not Use Vendor-Supplied Defaults',
    description: 'Change default passwords and security parameters',
    standard: ComplianceStandard.PCI_DSS,
    category: ComplianceCategory.SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Team',
    rules: [
      {
        id: 'pci-dss-2.1',
        name: 'Password Configuration',
        description: 'Change all default passwords',
        condition: 'passwords.defaults.changed === true && passwords.defaults.inventoryMaintained === true',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Inventory and change all default passwords'
      },
      {
        id: 'pci-dss-2.2',
        name: 'System Hardening',
        description: 'Configure system security parameters',
        condition: 'systems.hardened === true && systems.hardening.standard === "industry-baseline"',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Apply industry baseline hardening to all systems'
      }
    ],
    controls: [
      {
        id: 'pci-ctrl-config-1',
        name: 'Configuration Management',
        description: 'Secure configuration management',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'Automated configuration enforcement'
      }
    ]
  },
  {
    id: 'pci-dss-3',
    name: 'Protect Stored Cardholder Data',
    description: 'Protect stored cardholder data',
    standard: ComplianceStandard.PCI_DSS,
    category: ComplianceCategory.DATA_PROTECTION,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Team',
    rules: [
      {
        id: 'pci-dss-3.1',
        name: 'Data Retention',
        description: 'Keep cardholder data storage to minimum',
        condition: 'dataStorage.retention.minimized === true && dataStorage.data.inventoryMaintained === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Minimize stored cardholder data and maintain inventory'
      },
      {
        id: 'pci-dss-3.2',
        name: 'Data Encryption',
        description: 'Encrypt stored cardholder data',
        condition: 'encryption.atRest.enabled === true && encryption.atRest.algorithm === "AES-256" && encryption.keys.managedSecurely === true',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Implement AES-256 encryption for stored cardholder data'
      },
      {
        id: 'pci-dss-3.3',
        name: 'Mask PAN',
        description: 'Display full PAN only when necessary',
        condition: 'display.panMasked === true && display.panMasking.firstSixLastFour === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Mask all PAN displays except first 6 and last 4 digits'
      },
      {
        id: 'pci-dss-3.4',
        name: 'Render Data Unreadable',
        description: 'Render cardholder data unreadable',
        condition: 'dataStorage.unreadable === true && dataStorage.hashing === "strong-hash" || dataStorage.encryption === "strong-encryption"',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Use strong hashing or encryption for all cardholder data'
      },
      {
        id: 'pci-dss-3.5',
        name: 'Key Storage',
        description: 'Protect cryptographic keys',
        condition: 'keys.storage.secure === true && keys.storage.accessLimited === true',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Store keys in secure HSM with limited access'
      }
    ],
    controls: [
      {
        id: 'pci-ctrl-enc-1',
        name: 'End-to-End Encryption',
        description: 'E2E encryption for payment data',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'Point-to-point encryption for card data'
      }
    ]
  },
  {
    id: 'pci-dss-4',
    name: 'Encrypt Transmission of Cardholder Data',
    description: 'Encrypt cardholder data across open networks',
    standard: ComplianceStandard.PCI_DSS,
    category: ComplianceCategory.DATA_PROTECTION,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Network Security',
    rules: [
      {
        id: 'pci-dss-4.1',
        name: 'Strong Cryptography',
        description: 'Use strong cryptography in transit',
        condition: 'encryption.inTransit.tlsVersion >= "1.2" && encryption.inTransit.strongCiphers === true',
        severity: SeverityLevel.CRITICAL,
        automatedCheck: true,
        remediation: 'Enforce TLS 1.2+ with strong ciphers for cardholder data'
      },
      {
        id: 'pci-dss-4.2',
        name: 'Wireless Networks',
        description: 'Secure wireless networks',
        condition: 'wireless.encryption === "WPA2" || wireless.encryption === "WPA3" && wireless.segmented === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Use WPA2/WPA3 encryption and isolate wireless networks'
      }
    ],
    controls: [
      {
        id: 'pci-ctrl-trans-1',
        name: 'TLS Enforcement',
        description: 'Mandatory TLS for payment data',
        type: 'preventive',
        frequency: 'continuous',
        automated: true,
        implementation: 'TLS-only policy for cardholder data transmission'
      }
    ]
  },
  {
    id: 'pci-dss-10',
    name: 'Track and Monitor Access',
    description: 'Track and monitor all access to network resources and cardholder data',
    standard: ComplianceStandard.PCI_DSS,
    category: ComplianceCategory.OPERATIONS_SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Operations',
    rules: [
      {
        id: 'pci-dss-10.1',
        name: 'Audit Trail',
        description: 'Implement audit trails for system components',
        condition: 'audit.trail.implemented === true && audit.trail.comprehensive === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement comprehensive audit trail for all system components'
      },
      {
        id: 'pci-dss-10.2',
        name: 'Audit Log Content',
        description: 'Include specific information in audit logs',
        condition: 'audit.logFields.includes("user") && audit.logFields.includes("event") && audit.logFields.includes("timestamp")',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Ensure logs include user, event, timestamp, and other required fields'
      },
      {
        id: 'pci-dss-10.3',
        name: 'Log Review',
        description: 'Review audit logs daily',
        condition: 'audit.review.frequency === "daily" && audit.review.automated === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement automated daily log review with alerts'
      },
      {
        id: 'pci-dss-10.5',
        name: 'Log Retention',
        description: 'Retain audit logs for at least one year',
        condition: 'audit.retention.period >= 1 year && audit.retention.immutable === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Configure 1-year log retention with write-once storage'
      },
      {
        id: 'pci-dss-10.6',
        name: 'Log Security',
        description: 'Protect audit logs from tampering',
        condition: 'audit.protection.tamperEvident === true && audit.protection.backedUp === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Implement tamper-evident logging with regular backups'
      }
    ],
    controls: [
      {
        id: 'pci-ctrl-log-1',
        name: 'SIEM for PCI',
        description: 'PCI-focused log management',
        type: 'detective',
        frequency: 'continuous',
        automated: true,
        implementation: 'SIEM with PCI-specific alerting'
      }
    ]
  },
  {
    id: 'pci-dss-11',
    name: 'Regularly Test Security Systems',
    description: 'Test security systems and processes regularly',
    standard: ComplianceStandard.PCI_DSS,
    category: ComplianceCategory.SECURITY,
    version: '1.0',
    effectiveDate: new Date('2024-01-01'),
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2025-01-01'),
    owner: 'Security Team',
    rules: [
      {
        id: 'pci-dss-11.1',
        name: 'Vulnerability Testing',
        description: 'Test for vulnerabilities quarterly',
        condition: 'testing.vulnerability.frequency === "quarterly" && testing.vulnerability.afterChanges === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Conduct quarterly vulnerability scans and after any significant change'
      },
      {
        id: 'pci-dss-11.2',
        name: 'Penetration Testing',
        description: 'Perform internal and external penetration testing annually',
        condition: 'testing.penetration.frequency === "annually" && testing.penetration.internal === true && testing.penetration.external === true',
        severity: SeverityLevel.HIGH,
        automatedCheck: false,
        remediation: 'Conduct annual internal and external penetration tests'
      },
      {
        id: 'pci-dss-11.3',
        name: 'Network Intrusion Detection',
        description: 'Deploy network intrusion detection',
        condition: 'ids.deployed === true && ids.monitored === "24/7"',
        severity: SeverityLevel.HIGH,
        automatedCheck: true,
        remediation: 'Deploy and monitor network intrusion detection systems'
      }
    ],
    controls: [
      {
        id: 'pci-ctrl-test-1',
        name: 'Vulnerability Management',
        description: 'Continuous vulnerability monitoring',
        type: 'detective',
        frequency: 'continuous',
        automated: true,
        implementation: 'Automated vulnerability scanning and management'
      }
    ]
  }
];

/**
 * Get all policies for a given standard
 */
export function getPoliciesByStandard(standard: ComplianceStandard): PolicyDefinition[] {
  switch (standard) {
    case ComplianceStandard.SOC2:
      return SOC2_POLICIES;
    case ComplianceStandard.ISO27001:
      return ISO27001_POLICIES;
    case ComplianceStandard.GDPR:
      return GDPR_POLICIES;
    case ComplianceStandard.HIPAA:
      return HIPAA_POLICIES;
    case ComplianceStandard.PCI_DSS:
      return PCI_DSS_POLICIES;
    default:
      return [];
  }
}

/**
 * Get all policies across all standards
 */
export function getAllPolicies(): PolicyDefinition[] {
  return [
    ...SOC2_POLICIES,
    ...ISO27001_POLICIES,
    ...GDPR_POLICIES,
    ...HIPAA_POLICIES,
    ...PCI_DSS_POLICIES
  ];
}
