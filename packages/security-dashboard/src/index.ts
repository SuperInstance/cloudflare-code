// Main exports for the Security Dashboard package

// Components
export { MetricCard, MetricGrid } from './components/MetricCard';
export { ThreatMap } from './components/ThreatMap';
export { IncidentList } from './components/IncidentList';
export { IncidentDetail } from './components/IncidentDetail';
export { VulnerabilityDashboard } from './components/VulnerabilityDashboard';
export { ComplianceDashboard } from './components/ComplianceDashboard';
export { SecurityReports } from './components/SecurityReports';
export {
  SecurityNotifications,
  SecurityToast,
  SecurityAlertBanner,
} from './components/SecurityNotifications';
export { ThreatFeedComponent } from './components/ThreatFeed';
export { SecuritySettings } from './components/SecuritySettings';

// Metrics Charts
export {
  SecurityMetricsChart,
  MetricDistribution,
  MetricComparison,
  AnomalyDetection,
} from './metrics/SecurityMetricsChart';

// Hooks
export { useSecurityMetrics } from './hooks/useSecurityMetrics';
export {
  useThreatFeeds,
  useThreatIndicators,
  useThreatMap,
  useAttackCampaigns,
} from './hooks/useThreatIntelligence';
export {
  useIncidents,
  useIncident,
  useResponsePlaybooks,
} from './hooks/useIncidents';
export {
  useVulnerabilities,
  useVulnerabilityScans,
  useVulnerabilityTrend,
} from './hooks/useVulnerabilities';
export {
  useComplianceFrameworks,
  useComplianceFramework,
  useComplianceControls,
  usePolicies,
  useComplianceEvidence,
} from './hooks/useCompliance';

// Types
export type {
  SecurityMetric,
  SecurityMetricsData,
  ThreatIndicator,
  ThreatFeed,
  ThreatMapData,
  AttackCampaign,
  Incident,
  IncidentTask,
  IncidentTimelineEntry,
  ResponsePlaybook,
  ResponsePlaybookStep,
  Vulnerability,
  VulnerabilityScan,
  VulnerabilityTrend,
  ComplianceFramework,
  ComplianceControl,
  ComplianceEvidence,
  Policy,
  SecurityReport,
  ReportSection,
  ReportChart,
  ReportTable,
  ReportSummary,
  FilterOptions,
  PaginationOptions,
  ApiResponse,
  DashboardWidget,
  NotificationSettings,
  SecurityEvent,
} from './types';

// Utilities
export {
  cn,
  formatDate,
  formatRelativeTime,
  getSeverityColor,
  getSeverityTextColor,
  getStatusColor,
  formatNumber,
  calculatePercentage,
  getDateRangePreset,
  generateId,
  truncateText,
  debounce,
  downloadFile,
  copyToClipboard,
  calculateCVSSSeverity,
  getComplianceScore,
  groupBy,
  sortBy,
  filterBy,
  calculateTrend,
  validateEmail,
  validateUrl,
  validateIP,
  escapeHtml,
  formatBytes,
  formatDuration,
  getInitials,
  getRandomColor,
  exportToCSV,
  exportToJSON,
  parseQueryString,
  buildQueryString,
} from './lib/utils';

// Version
export const VERSION = '1.0.0';
