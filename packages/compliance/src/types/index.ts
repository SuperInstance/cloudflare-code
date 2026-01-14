/**
 * Compliance Standards supported by the system
 */
export enum ComplianceStandard {
  SOC2 = 'SOC2',
  ISO27001 = 'ISO27001',
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  PCI_DSS = 'PCI_DSS'
}

/**
 * Compliance categories within standards
 */
export enum ComplianceCategory {
  SECURITY = 'Security',
  AVAILABILITY = 'Availability',
  PROCESSING_INTEGRITY = 'Processing Integrity',
  CONFIDENTIALITY = 'Confidentiality',
  PRIVACY = 'Privacy',
  ACCESS_CONTROL = 'Access Control',
  CRYPTOGRAPHY = 'Cryptography',
  PHYSICAL_SECURITY = 'Physical Security',
  OPERATIONS_SECURITY = 'Operations Security',
  DATA_PROTECTION = 'Data Protection',
  INCIDENT_MANAGEMENT = 'Incident Management',
  RISK_MANAGEMENT = 'Risk Management'
}

/**
 * Severity levels for compliance violations
 */
export enum SeverityLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Compliance status
 */
export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  NOT_APPLICABLE = 'not_applicable',
  PENDING_REVIEW = 'pending_review'
}

/**
 * Risk levels
 */
export enum RiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Evidence types
 */
export enum EvidenceType {
  LOG = 'log',
  CONFIGURATION = 'configuration',
  DOCUMENTATION = 'documentation',
  REVIEW = 'review',
  SCREENSHOT = 'screenshot',
  METRICS = 'metrics',
  CERTIFICATE = 'certificate',
  POLICY = 'policy',
  PROCEDURE = 'procedure'
}

/**
 * Remediation status
 */
export enum RemediationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  AWAITING_APPROVAL = 'awaiting_approval',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

/**
 * Scan target types
 */
export enum ScanTargetType {
  INFRASTRUCTURE = 'infrastructure',
  CODE = 'code',
  DATABASE = 'database',
  API = 'api',
  CONFIGURATION = 'configuration',
  DOCUMENTATION = 'documentation'
}

/**
 * Report formats
 */
export enum ReportFormat {
  PDF = 'pdf',
  HTML = 'html',
  JSON = 'json',
  CSV = 'csv',
  EXCEL = 'excel'
}

/**
 * Policy definition structure
 */
export interface PolicyDefinition {
  id: string;
  name: string;
  description?: string;
  standard: ComplianceStandard;
  category: ComplianceCategory;
  version: string;
  effectiveDate: Date;
  lastReviewed: Date;
  nextReviewDate: Date;
  owner: string;
  rules: PolicyRule[];
  controls: Control[];
  exceptions?: PolicyException[];
}

/**
 * Policy rule
 */
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  severity: SeverityLevel;
  automatedCheck: boolean;
  remediation?: string;
  references?: string[];
}

/**
 * Control implementation
 */
export interface Control {
  id: string;
  name: string;
  description: string;
  type: 'preventive' | 'detective' | 'corrective';
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  automated: boolean;
  implementation?: string;
  validation?: string;
}

/**
 * Policy exception
 */
export interface PolicyException {
  id: string;
  ruleId: string;
  reason: string;
  approvedBy: string;
  approvedDate: Date;
  expiryDate?: Date;
  conditions: string[];
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  policyId: string;
  policyName: string;
  timestamp: Date;
  status: ComplianceStatus;
  passedRules: number;
  failedRules: number;
  skippedRules: number;
  totalRules: number;
  violations: PolicyViolation[];
  score: number;
}

/**
 * Policy violation
 */
export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  severity: SeverityLevel;
  description: string;
  actualValue: any;
  expectedValue: any;
  location?: string;
  evidence?: string;
  remediation?: string;
}

/**
 * Scan configuration
 */
export interface ScanConfig {
  standards: ComplianceStandard[];
  categories?: ComplianceCategory[];
  targets: ScanTargetType[];
  scope?: string[];
  excludePatterns?: string[];
  includePatterns?: string[];
  depth?: number;
}

/**
 * Scan result
 */
export interface ScanResult {
  id: string;
  timestamp: Date;
  config: ScanConfig;
  summary: ScanSummary;
  findings: Finding[];
  evidence: Evidence[];
  recommendations: Recommendation[];
}

/**
 * Scan summary
 */
export interface ScanSummary {
  totalScans: number;
  passedScans: number;
  failedScans: number;
  skippedScans: number;
  complianceScore: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  timeElapsed: number;
}

/**
 * Compliance finding
 */
export interface Finding {
  id: string;
  title: string;
  description: string;
  standard: ComplianceStandard;
  category: ComplianceCategory;
  severity: SeverityLevel;
  status: ComplianceStatus;
  target: ScanTargetType;
  location: string;
  evidence: string[];
  references?: string[];
  remediation?: RemediationPlan;
  discoveredAt: Date;
}

/**
 * Remediation plan
 */
export interface RemediationPlan {
  steps: RemediationStep[];
  estimatedEffort: number;
  priority: number;
  assignedTo?: string;
  dueDate?: Date;
}

/**
 * Remediation step
 */
export interface RemediationStep {
  id: string;
  description: string;
  action: string;
  target: string;
  order: number;
  dependencies?: string[];
  automated: boolean;
  status: RemediationStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Recommendation
 */
export interface Recommendation {
  id: string;
  priority: number;
  title: string;
  description: string;
  rationale: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  category: string;
}

/**
 * Evidence item
 */
export interface Evidence {
  id: string;
  type: EvidenceType;
  policyId?: string;
  controlId?: string;
  findingId?: string;
  timestamp: Date;
  collectedBy: string;
  data: any;
  metadata: EvidenceMetadata;
  hash?: string;
  signature?: string;
}

/**
 * Evidence metadata
 */
export interface EvidenceMetadata {
  source: string;
  location: string;
  format: string;
  size: number;
  retentionPeriod: number;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  chainOfCustody?: ChainOfCustody[];
}

/**
 * Chain of custody for evidence
 */
export interface ChainOfCustody {
  timestamp: Date;
  actor: string;
  action: string;
  reason: string;
  previousHash?: string;
  newHash?: string;
}

/**
 * Risk assessment
 */
export interface RiskAssessment {
  id: string;
  timestamp: Date;
  scope: string;
  overallRiskLevel: RiskLevel;
  risks: IdentifiedRisk[];
  mitigationPlan: MitigationPlan;
  nextReviewDate: Date;
}

/**
 * Identified risk
 */
export interface IdentifiedRisk {
  id: string;
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: RiskLevel;
  sources: string[];
  existingControls: string[];
  mitigationStrategies: MitigationStrategy[];
  owner: string;
  status: 'open' | 'mitigating' | 'mitigated' | 'accepted' | 'transferred';
}

/**
 * Mitigation strategy
 */
export interface MitigationStrategy {
  id: string;
  description: string;
  type: 'avoid' | 'reduce' | 'transfer' | 'accept';
  cost: number;
  effectiveness: number;
  timeline: string;
  responsible: string;
}

/**
 * Mitigation plan
 */
export interface MitigationPlan {
  strategies: MitigationStrategy[];
  priorities: string[];
  budget: number;
  timeline: string;
  successCriteria: string[];
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  id: string;
  type: string;
  standard: ComplianceStandard;
  period: ReportPeriod;
  generatedAt: Date;
  generatedBy: string;
  summary: ReportSummary;
  sections: ReportSection[];
  findings: Finding[];
  evidence: Evidence[];
  recommendations: Recommendation[];
  appendices: ReportAppendix[];
}

/**
 * Report period
 */
export interface ReportPeriod {
  start: Date;
  end: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';
}

/**
 * Report summary
 */
export interface ReportSummary {
  overallComplianceStatus: ComplianceStatus;
  complianceScore: number;
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  partiallyCompliantControls: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Report section
 */
export interface ReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
  subsections?: ReportSection[];
}

/**
 * Report appendix
 */
export interface ReportAppendix {
  id: string;
  title: string;
  type: string;
  content: any;
  order: number;
}

/**
 * Remediation workflow
 */
export interface RemediationWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  approvalChain: ApprovalChain;
  status: RemediationStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Workflow trigger
 */
export interface WorkflowTrigger {
  type: 'manual' | 'automatic' | 'scheduled';
  condition?: string;
  schedule?: string;
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  action: string;
  target: string;
  order: number;
  dependencies?: string[];
  automated: boolean;
  requiresApproval: boolean;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  status: RemediationStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Approval chain
 */
export interface ApprovalChain {
  levels: ApprovalLevel[];
  currentLevel: number;
  allRequired: boolean;
}

/**
 * Approval level
 */
export interface ApprovalLevel {
  level: number;
  role: string;
  approvers: string[];
  minRequired: number;
  status: 'pending' | 'approved' | 'rejected';
  approvals: Approval[];
}

/**
 * Approval
 */
export interface Approval {
  approver: string;
  timestamp: Date;
  decision: 'approved' | 'rejected';
  comments?: string;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

/**
 * Compliance monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  scanInterval: number;
  alertThreshold: number;
  notificationChannels: string[];
  retentionPeriod: number;
  autoRemediation: boolean;
}

/**
 * Compliance metrics
 */
export interface ComplianceMetrics {
  timestamp: Date;
  complianceScore: number;
  controlCoverage: number;
  meanTimeToRemediate: number;
  openFindings: number;
  closedFindings: number;
  criticalFindings: number;
  highFindings: number;
  riskTrend: number;
  policyViolationRate: number;
}

/**
 * Filter options for queries
 */
export interface FilterOptions {
  standards?: ComplianceStandard[];
  categories?: ComplianceCategory[];
  severities?: SeverityLevel[];
  statuses?: ComplianceStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  search?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}
