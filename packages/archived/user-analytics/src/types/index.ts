/**
 * Core type definitions for the User Analytics Platform
 * Provides comprehensive type safety for all analytics operations
 */

// ============================================================================
// Event Types
// ============================================================================

export interface AnalyticsEvent {
  id: string;
  userId?: string;
  anonymousId?: string;
  sessionId: string;
  eventType: string;
  eventName: string;
  properties: Record<string, unknown>;
  userProperties?: Record<string, unknown>;
  context: EventContext;
  timestamp: number;
  receivedAt?: number;
  processedAt?: number;
  metadata?: EventMetadata;
}

export interface EventContext {
  appId: string;
  appVersion?: string;
  platform?: 'web' | 'mobile' | 'desktop' | 'api';
  os?: string;
  osVersion?: string;
  device?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser?: string;
  browserVersion?: string;
  screenResolution?: string;
  viewport?: string;
  language?: string;
  timezone?: string;
  campaign?: CampaignContext;
  location?: GeoLocation;
  ip?: string;
  userAgent?: string;
  referrer?: string;
  url?: string;
  page?: string;
  library?: {
    name: string;
    version: string;
  };
}

export interface CampaignContext {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface EventMetadata {
  validated?: boolean;
  enriched?: boolean;
  batchId?: string;
  processedBy?: string;
  version?: string;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface EventValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedEvent?: AnalyticsEvent;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface EventBatch {
  id: string;
  events: AnalyticsEvent[];
  count: number;
  size: number;
  createdAt: number;
  sentAt?: number;
  flushedAt?: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  retryCount: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: string;
  anonymousId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  avatar?: string;
  properties: UserProperties;
  demographics?: Demographics;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
  sessions: number;
  totalEvents: number;
  firstTouchpoint?: Touchpoint;
  lastTouchpoint?: Touchpoint;
  lifetimeValue?: number;
  engagementScore?: number;
  segments?: string[];
  cohorts?: string[];
  metadata?: UserMetadata;
}

export interface UserProperties {
  [key: string]: unknown;
  subscription?: string;
  plan?: string;
  tier?: string;
  status?: 'active' | 'inactive' | 'churned' | 'trial';
  country?: string;
  language?: string;
  timezone?: string;
  company?: {
    id?: string;
    name?: string;
    size?: string;
    industry?: string;
  };
  customAttributes?: Record<string, unknown>;
}

export interface Demographics {
  age?: number;
  ageGroup?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | 'unknown';
  education?: string;
  occupation?: string;
  income?: string;
  interests?: string[];
}

export interface Touchpoint {
  timestamp: number;
  source: string;
  medium: string;
  campaign?: string;
  referrer?: string;
  url?: string;
}

export interface UserMetadata {
  source?: string;
  verified?: boolean;
  deleted?: boolean;
  gdprConsent?: boolean;
  ccpaConsent?: boolean;
  dataProcessedUntil?: number;
  tags?: string[];
  notes?: string;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  userId?: string;
  anonymousId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  eventCount: number;
  pageViews: number;
  events: AnalyticsEvent[];
  entryPage?: string;
  exitPage?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  device?: string;
  browser?: string;
  os?: string;
  location?: GeoLocation;
  bounced?: boolean;
  converted?: boolean;
  conversionValue?: number;
  metadata?: SessionMetadata;
}

export interface SessionMetadata {
  quality?: 'high' | 'medium' | 'low';
  engagementScore?: number;
  tags?: string[];
  referrerDomain?: string;
  searchEngine?: string;
  searchQuery?: string;
}

// ============================================================================
// Segment Types
// ============================================================================

export interface Segment {
  id: string;
  name: string;
  description?: string;
  type: SegmentType;
  definition: SegmentDefinition;
  users: SegmentUser[];
  count: number;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  metadata?: SegmentMetadata;
}

export type SegmentType =
  | 'static'
  | 'dynamic'
  | 'behavioral'
  | 'demographic'
  | 'custom'
  | 'lookalike';

export interface SegmentDefinition {
  conditions: SegmentCondition[];
  logic?: 'and' | 'or';
  refreshInterval?: number;
  sampleSize?: number;
}

export interface SegmentCondition {
  field: string;
  operator: SegmentOperator;
  value: unknown;
  type?: 'property' | 'event' | 'cohort' | 'behavior';
  timeWindow?: TimeWindow;
}

export type SegmentOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'is_set'
  | 'is_not_set'
  | 'before'
  | 'after'
  | 'between'
  | 'regex';

export interface TimeWindow {
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  relative?: boolean;
}

export interface SegmentUser {
  userId: string;
  matchedAt: number;
  score?: number;
  properties?: Record<string, unknown>;
}

export interface SegmentMetadata {
  color?: string;
  icon?: string;
  category?: string;
  tags?: string[];
  public?: boolean;
  sharable?: boolean;
  lookalikeSource?: string;
}

export interface SegmentUpdate {
  segmentId: string;
  addedUsers: string[];
  removedUsers: string[];
  timestamp: number;
}

// ============================================================================
// Funnel Types
// ============================================================================

export interface Funnel {
  id: string;
  name: string;
  description?: string;
  steps: FunnelStep[];
  window?: FunnelWindow;
  conversionType: 'strict' | 'flexible' | 'custom';
  createdAt: number;
  updatedAt: number;
  metadata?: FunnelMetadata;
}

export interface FunnelStep {
  id: string;
  name: string;
  order: number;
  conditions: FunnelStepCondition[];
  required: boolean;
  timeToComplete?: number;
  metadata?: StepMetadata;
}

export interface FunnelStepCondition {
  eventType: string;
  eventName?: string;
  properties?: Record<string, unknown>;
  operator?: 'and' | 'or';
}

export interface FunnelWindow {
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks';
  type?: 'first_event' | 'step_entry';
}

export interface FunnelMetadata {
  category?: string;
  tags?: string[];
  conversionGoal?: string;
  baselineConversion?: number;
  targetConversion?: number;
}

export interface StepMetadata {
  description?: string;
  urlPattern?: string;
  expectedTime?: number;
  tips?: string[];
}

export interface FunnelResult {
  funnelId: string;
  funnelName: string;
  totalUsers: number;
  stepResults: FunnelStepResult[];
  overallConversionRate: number;
  dropOffAnalysis: DropOffAnalysis;
  timeToConvert: TimeMetrics;
  breakdown?: FunnelBreakdown;
  generatedAt: number;
  period?: DateRange;
}

export interface FunnelStepResult {
  stepId: string;
  stepName: string;
  order: number;
  users: number;
  uniqueUsers: number;
  completionRate: number;
  dropOffRate: number;
  dropOffCount: number;
  avgTimeFromPrevious: number;
  medianTimeFromPrevious: number;
  abandonmentPoints: AbandonmentPoint[];
}

export interface DropOffAnalysis {
  totalDropOff: number;
  dropOffByStep: Record<string, number>;
  commonDropOffPaths: DropOffPath[];
  reasons?: DropOffReason[];
}

export interface DropOffPath {
  path: string[];
  count: number;
  percentage: number;
  avgTimeInFunnel: number;
}

export interface DropOffReason {
  reason: string;
  count: number;
  percentage: number;
  suggestedAction?: string;
}

export interface AbandonmentPoint {
  url?: string;
  action?: string;
  count: number;
  percentage: number;
}

export interface TimeMetrics {
  avg: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  distribution: TimeBucket[];
}

export interface TimeBucket {
  range: string;
  count: number;
  percentage: number;
}

export interface FunnelBreakdown {
  byDimension: string;
  segments: BreakdownSegment[];
}

export interface BreakdownSegment {
  name: string;
  value: string;
  totalUsers: number;
  conversionRate: number;
  stepResults: FunnelStepResult[];
}

export interface FunnelComparison {
  funnelResults: FunnelResult[];
  comparisonType: 'period' | 'segment' | 'variant';
  dimension: string;
  significantDifferences: ComparisonDifference[];
  generatedAt: number;
}

export interface ComparisonDifference {
  metric: string;
  dimension1: string;
  dimension2: string;
  value1: number;
  value2: number;
  absoluteChange: number;
  relativeChange: number;
  statisticallySignificant: boolean;
  confidence: number;
  pValue?: number;
}

// ============================================================================
// Retention Types
// ============================================================================

export interface RetentionAnalysis {
  id: string;
  name: string;
  cohortType: CohortType;
  periodType: PeriodType;
  retentionCurve: RetentionCurve;
  summary: RetentionSummary;
  breakdown?: RetentionBreakdown;
  generatedAt: number;
  dateRange: DateRange;
}

export type CohortType = 'acquisition' | 'activation' | 'behavior' | 'custom';
export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface RetentionCurve {
  data: RetentionDataPoint[];
  averages: number[];
  bestCohort?: BestCohort;
  worstCohort?: WorstCohort;
}

export interface RetentionDataPoint {
  cohort: string;
  cohortPeriod: string;
  cohortSize: number;
  periods: RetentionPeriod[];
}

export interface RetentionPeriod {
  period: number;
  retained: number;
  percentage: number;
  returningUsers?: string[];
}

export interface BestCohort {
  cohort: string;
  retentionRates: number[];
  avgRetention: number;
}

export interface WorstCohort {
  cohort: string;
  retentionRates: number[];
  avgRetention: number;
}

export interface RetentionSummary {
  overallRetention: number[];
  day1Retention: number;
  day7Retention: number;
  day30Retention: number;
  avgRetention: number;
  medianRetention: number;
  churnRate: number;
  medianLifetime: number;
}

export interface RetentionBreakdown {
  byDimension: string;
  segments: RetentionSegment[];
}

export interface RetentionSegment {
  name: string;
  value: string;
  retentionCurve: RetentionCurve;
  summary: RetentionSummary;
}

export interface ChurnPrediction {
  userId: string;
  churnProbability: number;
  churnRisk: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  predictedChurnDate?: number;
  suggestedActions: string[];
  generatedAt: number;
}

export interface ChurnFactor {
  factor: string;
  impact: number;
  description: string;
  currentValue: unknown;
  typicalValue: unknown;
}

export interface SurvivalAnalysis {
  survivalCurve: SurvivalDataPoint[];
  medianSurvival: number;
  avgSurvival: number;
  percentiles: Record<number, number>;
  hazardRate?: number;
  generatedAt: number;
}

export interface SurvivalDataPoint {
  time: number;
  survival: number;
  atRisk: number;
  events: number;
  censored: number;
}

// ============================================================================
// Cohort Types
// ============================================================================

export interface Cohort {
  id: string;
  name: string;
  type: CohortType;
  definition: CohortDefinition;
  users: CohortUser[];
  size: number;
  createdAt: number;
  updatedAt: number;
  metadata?: CohortMetadata;
}

export interface CohortDefinition {
  criteria: CohortCriteria;
  timeWindow?: TimeWindow;
  maxSize?: number;
  refreshSchedule?: CohortRefreshSchedule;
}

export interface CohortCriteria {
  type: 'first_seen' | 'event' | 'property' | 'behavior' | 'custom';
  eventType?: string;
  eventName?: string;
  properties?: Record<string, unknown>;
  userProperties?: Record<string, unknown>;
  dateRange?: DateRange;
  behaviorType?: string;
  behaviorThreshold?: number;
}

export interface CohortRefreshSchedule {
  frequency: 'none' | 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
}

export interface CohortUser {
  userId: string;
  cohortEntryDate: number;
  properties?: Record<string, unknown>;
  active: boolean;
}

export interface CohortMetadata {
  description?: string;
  category?: string;
  tags?: string[];
  color?: string;
  public?: boolean;
  lookalike?: boolean;
}

export interface CohortComparison {
  cohorts: Cohort[];
  comparisonMetrics: CohortMetric[];
  significantDifferences: ComparisonDifference[];
  generatedAt: number;
}

export interface CohortMetric {
  name: string;
  cohortId: string;
  value: number;
  change?: number;
  changePercent?: number;
}

// ============================================================================
// Behavioral Types
// ============================================================================

export interface UserJourney {
  userId: string;
  sessionId?: string;
  journey: JourneyStep[];
  startTime: number;
  endTime: number;
  duration: number;
  eventCount: number;
  conversion?: ConversionInfo;
  metadata?: JourneyMetadata;
}

export interface JourneyStep {
  sequence: number;
  event: AnalyticsEvent;
  timeFromStart: number;
  timeFromPrevious: number;
  page?: string;
  type: 'page_view' | 'event' | 'conversion' | 'exit';
}

export interface ConversionInfo {
  converted: boolean;
  conversionValue?: number;
  conversionEvent?: string;
  timeToConvert?: number;
  funnel?: string;
}

export interface JourneyMetadata {
  device?: string;
  browser?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  location?: GeoLocation;
  quality?: 'high' | 'medium' | 'low';
}

export interface BehaviorPattern {
  id: string;
  name: string;
  description: string;
  patternType: PatternType;
  definition: PatternDefinition;
  users: string[];
  userCount: number;
  frequency: number;
  confidence: number;
  discoveredAt: number;
  lastUpdated: number;
}

export type PatternType =
  | 'sequence'
  | 'frequency'
  | 'timing'
  | 'navigation'
  | 'custom';

export interface PatternDefinition {
  steps: PatternStep[];
  timeWindow?: TimeWindow;
  minOccurrences?: number;
  maxOccurrences?: number;
}

export interface PatternStep {
  eventType: string;
  eventName?: string;
  properties?: Record<string, unknown>;
  optional?: boolean;
  position?: number;
  minGap?: number;
  maxGap?: number;
}

export interface SessionAnalysis {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime: number;
  duration: number;
  eventCount: number;
  pageViews: number;
  bounceRate: number;
  pagesPerSession: number;
  avgSessionDuration: number;
  topPages: PageMetric[];
  topEvents: EventMetric[];
  flow: PageFlow;
  engagement: EngagementMetrics;
  conversion?: ConversionInfo;
}

export interface PageMetric {
  page: string;
  views: number;
  uniqueViews: number;
  avgTimeOnPage: number;
  bounceRate: number;
  exitRate: number;
}

export interface EventMetric {
  eventType: string;
  eventName: string;
  count: number;
  uniqueUsers: number;
  avgPerSession: number;
}

export interface PageFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryPoints: string[];
  exitPoints: string[];
}

export interface FlowNode {
  id: string;
  page: string;
  views: number;
  uniqueUsers: number;
  avgTimeOnPage: number;
  bounceRate: number;
  exitRate: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  count: number;
  percentage: number;
  avgTimeBetween: number;
}

export interface EngagementMetrics {
  score: number;
  level: 'low' | 'medium' | 'high';
  factors: EngagementFactor[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface EngagementFactor {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface FeatureUsage {
  featureName: string;
  users: number;
  totalUsers: number;
  adoptionRate: number;
  usageFrequency: number;
  avgUsagePerUser: number;
  avgTimeSpent: number;
  retention: number;
  trend: FeatureTrend;
  topUsers: FeatureUser[];
  cohorts: FeatureCohortUsage[];
}

export interface FeatureTrend {
  period: string;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
}

export interface FeatureUser {
  userId: string;
  usageCount: number;
  lastUsed: number;
  avgTimeSpent: number;
}

export interface FeatureCohortUsage {
  cohortName: string;
  usageRate: number;
  avgTimeSpent: number;
}

// ============================================================================
// Real-time Types
// ============================================================================

export interface RealtimeEvent {
  event: AnalyticsEvent;
  processedAt: number;
  latency: number;
}

export interface RealtimeMetrics {
  timestamp: number;
  window: number;
  events: RealtimeEventMetrics;
  users: RealtimeUserMetrics;
  sessions: RealtimeSessionMetrics;
  conversions: RealtimeConversionMetrics;
  topEvents: RealtimeTopEvent[];
  topPages: RealtimeTopPage[];
}

export interface RealtimeEventMetrics {
  total: number;
  rate: number;
  byType: Record<string, number>;
}

export interface RealtimeUserMetrics {
  active: number;
  new: number;
  returning: number;
  anonymous: number;
}

export interface RealtimeSessionMetrics {
  active: number;
  avgDuration: number;
  bounceRate: number;
}

export interface RealtimeConversionMetrics {
  total: number;
  rate: number;
  value: number;
  byType: Record<string, number>;
}

export interface RealtimeTopEvent {
  eventType: string;
  eventName: string;
  count: number;
  rate: number;
}

export interface RealtimeTopPage {
  page: string;
  views: number;
  activeUsers: number;
}

export interface RealtimeAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
  resolvedAt?: number;
  acknowledgedBy?: string;
}

export type AlertType =
  | 'spike'
  | 'drop'
  | 'anomaly'
  | 'threshold'
  | 'custom';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

// ============================================================================
// Aggregation Types
// ============================================================================

export interface AggregationQuery {
  id: string;
  name: string;
  metric: AggregationMetric;
  dimensions: string[];
  filters: AggregationFilter[];
  groupBy: string[];
  orderBy: AggregationOrderBy[];
  timeRange: DateRange;
  granularity: AggregationGranularity;
  limit?: number;
  offset?: number;
}

export interface AggregationMetric {
  type: 'count' | 'sum' | 'avg' | 'median' | 'min' | 'max' | 'percentile';
  field?: string;
  percentile?: number;
  alias?: string;
}

export interface AggregationFilter {
  field: string;
  operator: SegmentOperator;
  value: unknown;
}

export interface AggregationOrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

export type AggregationGranularity =
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

export interface AggregationResult {
  queryId: string;
  results: AggregationRow[];
  summary: AggregationSummary;
  generatedAt: number;
  executionTime: number;
}

export interface AggregationRow {
  dimensions: Record<string, unknown>;
  metrics: Record<string, number>;
  count?: number;
}

export interface AggregationSummary {
  totalRows: number;
  hasMore: boolean;
  totalTimeRange: DateRange;
  dataCompleteness: number;
}

// ============================================================================
// Privacy & Compliance Types
// ============================================================================

export interface PrivacyRequest {
  id: string;
  type: 'access' | 'deletion' | 'rectification' | 'objection';
  userId?: string;
  anonymousId?: string;
  email?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: number;
  processedAt?: number;
  completedAt?: number;
  result?: PrivacyRequestResult;
  metadata?: PrivacyRequestMetadata;
}

export interface PrivacyRequestResult {
  dataFound: boolean;
  dataLocations: string[];
  recordsProcessed: number;
  recordsDeleted: number;
  exportUrl?: string;
  errors?: string[];
}

export interface PrivacyRequestMetadata {
  source: 'gdpr' | 'ccpa' | 'custom';
  jurisdiction: string;
  requestId: string;
  verified: boolean;
  notes?: string;
}

export interface ConsentRecord {
  userId: string;
  consents: ConsentEntry[];
  updatedAt: number;
  version: string;
}

export interface ConsentEntry {
  purpose: string;
  granted: boolean;
  timestamp: number;
  ipAddress?: string;
  documentId?: string;
}

export interface DataClassification {
  dataType: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  retention: number;
  purposes: string[];
  legalBasis: string;
  requiresConsent: boolean;
}

// ============================================================================
// Common Types
// ============================================================================

export interface DateRange {
  start: number;
  end: number;
  timezone?: string;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AnalyticsError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  timestamp: number;
}

export interface QueryOptions {
  includeTimestamps?: boolean;
  includeMetadata?: boolean;
  cache?: boolean;
  timeout?: number;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'parquet';
  compression?: 'none' | 'gzip' | 'zstd';
  includeHeaders?: boolean;
  delimiter?: string;
}

export interface ExportResult {
  downloadUrl: string;
  fileSize: number;
  recordCount: number;
  expiresAt: number;
}

// ============================================================================
// Storage Types (D1)
// ============================================================================

export interface StorageConfig {
  bindingName: string;
  tableName?: string;
  batchSize?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface QueryResult<T> {
  results: T[];
  success: boolean;
  error?: string;
  meta?: {
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface BatchOperation {
  operation: 'insert' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>[];
  condition?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AnalyticsConfig {
  storage: StorageConfig;
  events: EventsConfig;
  privacy: PrivacyConfig;
  realtime: RealtimeConfig;
  aggregation: AggregationConfig;
  performance: PerformanceConfig;
}

export interface EventsConfig {
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  validation: boolean;
  enrichment: boolean;
  sampling: number;
}

export interface PrivacyConfig {
  gdprEnabled: boolean;
  ccpaEnabled: boolean;
  dataRetention: number;
  anonymizeIp: boolean;
  hashEmails: boolean;
  consentRequired: boolean;
  dataResidency: string[];
}

export interface RealtimeConfig {
  enabled: boolean;
  windowSize: number;
  aggregationInterval: number;
  alertThresholds: AlertThreshold[];
}

export interface AlertThreshold {
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'anomaly';
  threshold: number;
  severity: AlertSeverity;
}

export interface AggregationConfig {
  enabled: boolean;
  preAggregation: boolean;
  materializedViews: boolean;
  refreshInterval: number;
  maxQueryTime: number;
}

export interface PerformanceConfig {
  cacheEnabled: boolean;
  cacheTTL: number;
  queryTimeout: number;
  maxConcurrentQueries: number;
  indexOptimization: boolean;
}
