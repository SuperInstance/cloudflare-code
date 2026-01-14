// Security Metrics Types
export interface SecurityMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
  threshold: {
    warning: number;
    critical: number;
  };
  timestamp: Date;
}

export interface SecurityMetricsData {
  realTime: {
    threatAttempts: SecurityMetric;
    blockedAttacks: SecurityMetric;
    activeSessions: SecurityMetric;
    failedLogins: SecurityMetric;
    apiAbuse: SecurityMetric;
    dataExfiltrationAttempts: SecurityMetric;
    anomalyScore: SecurityMetric;
  };
  historical: {
    timeline: Date[];
    threatAttempts: number[];
    blockedAttacks: number[];
    failedLogins: number[];
    apiAbuse: number[];
  };
}

// Threat Intelligence Types
export interface ThreatIndicator {
  id: string;
  type: 'ipv4' | 'ipv6' | 'domain' | 'url' | 'email' | 'hash' | 'cve';
  value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  source: string;
  description: string;
  firstSeen: Date;
  lastSeen: Date;
  tags: string[];
  relatedIndicators: string[];
}

export interface ThreatFeed {
  id: string;
  name: string;
  type: 'cve' | 'ioc' | 'zero-day' | 'industry' | 'geolocation' | 'patterns';
  updateFrequency: string;
  lastUpdate: Date;
  indicators: ThreatIndicator[];
  status: 'active' | 'inactive' | 'error';
}

export interface ThreatMapData {
  latitude: number;
  longitude: number;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  country: string;
  city?: string;
}

export interface AttackCampaign {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'mitigated' | 'investigating';
  startDate: Date;
  endDate?: Date;
  targets: string[];
  tactics: string[];
  indicators: ThreatIndicator[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  attribution?: string;
}

// Incident Response Types
export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'contained' | 'eradicated' | 'resolved';
  priority: 1 | 2 | 3 | 4 | 5;
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  tags: string[];
  playbook?: string;
  tasks: IncidentTask[];
  timeline: IncidentTimelineEntry[];
  affectedAssets: string[];
  indicators: ThreatIndicator[];
  resolution?: string;
  impact: {
    usersAffected: number;
    systemsAffected: string[];
    dataExposed: boolean;
      estimatedLoss?: number;
  };
}

export interface IncidentTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  assignedTo?: string;
  dueDate?: Date;
  completedAt?: Date;
  order: number;
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: Date;
  action: string;
  description: string;
  performedBy: string;
  attachments?: string[];
}

export interface ResponsePlaybook {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: ResponsePlaybookStep[];
  estimatedDuration: number;
  lastUpdated: Date;
  version: string;
}

export interface ResponsePlaybookStep {
  order: number;
  title: string;
  description: string;
  automated: boolean;
  estimatedTime: number;
  dependencies?: number[];
}

// Vulnerability Scanner Types
export interface Vulnerability {
  id: string;
  cveId?: string;
  title: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  cvssScore?: number;
  cvssVector?: string;
  affectedComponent: string;
  affectedVersion: string;
  fixedVersion?: string;
  discoveredAt: Date;
  publishedAt?: Date;
  status: 'open' | 'in-progress' | 'resolved' | 'false-positive' | 'accepted-risk';
  falsePositive: boolean;
  remediation: string;
  references: string[];
  exploits: boolean;
  exploitsAvailable?: number;
  patches: boolean;
}

export interface VulnerabilityScan {
  id: string;
  name: string;
  type: 'full' | 'quick' | 'targeted' | 'compliance';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  targets: string[];
  scheduled: boolean;
  nextRun?: Date;
}

export interface VulnerabilityTrend {
  date: Date;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

// Compliance Types
export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  status: 'compliant' | 'non-compliant' | 'partial' | 'pending';
  lastAudit: Date;
  nextAudit: Date;
  controls: ComplianceControl[];
  overallScore: number;
}

export interface ComplianceControl {
  id: string;
  frameworkId: string;
  name: string;
  description: string;
  category: string;
  status: 'compliant' | 'non-compliant' | 'partial' | 'not-applicable';
  evidence: ComplianceEvidence[];
  policies: string[];
  lastReviewed: Date;
  nextReview: Date;
  owner: string;
  gapAnalysis?: {
    current: string;
    required: string;
    gap: string;
    priority: 'high' | 'medium' | 'low';
  };
}

export interface ComplianceEvidence {
  id: string;
  controlId: string;
  type: 'document' | 'screenshot' | 'log' | 'test-result' | 'configuration' | 'other';
  title: string;
  description: string;
  fileUrl?: string;
  uploadedAt: Date;
  uploadedBy: string;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  expirationDate?: Date;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  content: string;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  approvedBy?: string;
  controls: string[];
}

// Security Reports Types
export interface SecurityReport {
  id: string;
  title: string;
  type: 'executive' | 'technical' | 'compliance' | 'incident' | 'trend' | 'audit';
  description: string;
  generatedAt: Date;
  generatedBy: string;
  period: {
    start: Date;
    end: Date;
  };
  status: 'generating' | 'completed' | 'failed';
  fileUrl?: string;
  format: 'pdf' | 'html' | 'json' | 'csv';
  size?: number;
  sections: ReportSection[];
  metrics: SecurityMetricsData;
  summary: ReportSummary;
}

export interface ReportSection {
  id: string;
  title: string;
  order: number;
  content: string;
  charts: ReportChart[];
  tables: ReportTable[];
}

export interface ReportChart {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'heatmap';
  title: string;
  data: any;
}

export interface ReportTable {
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
}

export interface ReportSummary {
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  overallScore: number;
  trend: 'improving' | 'stable' | 'declining';
}

// Common Types
export interface FilterOptions {
  dateRange: {
    start: Date;
    end: Date;
  };
  severity?: string[];
  status?: string[];
  tags?: string[];
  searchQuery?: string;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'list' | 'map' | 'table';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  refreshInterval?: number;
  dataSource: string;
  config: any;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  slack: boolean;
  webhook?: string;
  severity: ('low' | 'medium' | 'high' | 'critical')[];
}

export interface SecurityEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  source: string;
  description: string;
  details: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}
