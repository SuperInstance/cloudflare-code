/**
 * Customer Success Platform - Analytics Types
 * Defines all usage analytics related types and interfaces
 */

export interface UsageAnalytics {
  customerId: string;
  period: AnalyticsPeriod;
  metrics: UsageMetrics;
  features: FeatureAnalytics;
  users: UserAnalytics;
  api: ApiAnalytics;
  collaboration: CollaborationAnalytics;
  revenue: RevenueAnalytics;
  cohorts: CohortAnalytics;
  funnels: FunnelAnalytics;
  retention: RetentionAnalytics;
  benchmarks: BenchmarkComparison;
  insights: AnalyticsInsight[];
  generatedAt: Date;
}

export interface AnalyticsPeriod {
  start: Date;
  end: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  comparison?: {
    start: Date;
    end: Date;
    type: 'previous_period' | 'same_period_last_year' | 'custom';
  };
}

export interface UsageMetrics {
  activeUsers: ActiveUserMetrics;
  sessions: SessionMetrics;
  requests: RequestMetrics;
  storage: StorageMetrics;
  bandwidth: BandwidthMetrics;
  compute: ComputeMetrics;
}

export interface ActiveUserMetrics {
  dau: number; // Daily Active Users
  wau: number; // Weekly Active Users
  mau: number; // Monthly Active Users
  dauOverMau: number; // Stickiness ratio
  newUsers: number;
  returningUsers: number;
  churnedUsers: number;
  userGrowthRate: number;
  averageUsersPerDay: number;
  peakUsers: number;
  peakDate: Date;
}

export interface SessionMetrics {
  totalSessions: number;
  averageSessionDuration: number; // in minutes
  averageSessionDurationChange: number;
  totalSessionDuration: number; // in hours
  sessionsPerUser: number;
  bounceRate: number; // percentage of single-action sessions
  sessionsByDay: SessionsByDay[];
  sessionsByHour: SessionsByHour[];
  averageActionsPerSession: number;
}

export interface SessionsByDay {
  date: Date;
  sessions: number;
  uniqueUsers: number;
  averageDuration: number;
}

export interface SessionsByHour {
  hour: number; // 0-23
  sessions: number;
  averageDuration: number;
}

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number; // in milliseconds
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  peakRequestsPerSecond: number;
  requestsByEndpoint: RequestsByEndpoint[];
  requestsByDay: RequestsByDay[];
  errorRate: number;
  errorCategories: ErrorCategory[];
}

export interface RequestsByEndpoint {
  endpoint: string;
  requests: number;
  percentage: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface RequestsByDay {
  date: Date;
  requests: number;
  successRate: number;
  averageResponseTime: number;
}

export interface ErrorCategory {
  category: string;
  count: number;
  percentage: number;
  commonErrors: CommonError[];
}

export interface CommonError {
  errorType: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  sampleMessage?: string;
}

export interface StorageMetrics {
  totalStorage: number; // in bytes
  usedStorage: number;
  availableStorage: number;
  utilizationRate: number;
  storageByType: StorageByType[];
  storageGrowthRate: number;
  projectedUsage: number;
  projectedDate: Date;
}

export interface StorageByType {
  type: string;
  size: number;
  percentage: number;
  growthRate: number;
}

export interface BandwidthMetrics {
  totalBandwidth: number; // in bytes
  inbound: number;
  outbound: number;
  bandwidthByDay: BandwidthByDay[];
  peakBandwidth: number;
  peakDate: Date;
  averageBandwidth: number;
}

export interface BandwidthByDay {
  date: Date;
  inbound: number;
  outbound: number;
  total: number;
}

export interface ComputeMetrics {
  totalCpuTime: number; // in seconds
  totalMemoryUsed: number; // in bytes
  averageCpuUsage: number; // percentage
  peakCpuUsage: number;
  averageMemoryUsage: number; // percentage
  peakMemoryUsage: number;
  computeUnits: number;
  costPerComputeUnit: number;
  totalComputeCost: number;
}

export interface FeatureAnalytics {
  features: FeatureUsage[];
  adoption: FeatureAdoption;
  depth: FeatureDepthAnalytics;
  correlation: FeatureCorrelation[];
  trends: FeatureTrends;
}

export interface FeatureUsage {
  featureId: string;
  featureName: string;
  category: string;
  users: number;
  usageCount: number;
  adoptionRate: number; // percentage of total users
  usageFrequency: number; // average uses per user
  averageSessionTime: number; // in minutes
  retention: number; // percentage of users who return
  growthRate: number;
  lastUsed: Date;
  firstUsed: Date;
  status: 'beta' | 'stable' | 'deprecated' | 'new';
}

export interface FeatureAdoption {
  totalFeatures: number;
  adoptedFeatures: number;
  adoptionRate: number;
  averageTimeToAdopt: number; // days from signup to first use
  adoptionByCategory: Record<string, number>;
  adoptionByTier: Record<string, number>;
  coreFeaturesAdopted: number;
  advancedFeaturesAdopted: number;
  powerUserFeaturesAdopted: number;
}

export interface FeatureDepthAnalytics {
  featuresByDepth: {
    shallow: number; // < 5 uses per user
    medium: number; // 5-20 uses per user
    deep: number; // > 20 uses per user
  };
  averageDepthScore: number;
  depthByFeature: Record<string, number>;
}

export interface FeatureCorrelation {
  featureA: string;
  featureB: string;
  correlation: number; // -1 to 1
  strength: 'weak' | 'moderate' | 'strong';
  lift: number; // likelihood of using B given A
}

export interface FeatureTrends {
  gainingTraction: string[]; // feature IDs
  decliningUsage: string[]; // feature IDs
  stableUsage: string[]; // feature IDs
  seasonalPatterns: SeasonalPattern[];
}

export interface SeasonalPattern {
  featureId: string;
  pattern: 'weekday_peak' | 'weekend_peak' | 'business_hours' | 'after_hours';
  confidence: number;
}

export interface UserAnalytics {
  users: UserMetrics[];
  segments: UserSegment[];
  behavior: UserBehaviorAnalytics;
  lifecycle: UserLifecycleAnalytics;
  journeys: UserJourney[];
}

export interface UserMetrics {
  userId: string;
  name?: string;
  email?: string;
  role: string;
  joinDate: Date;
  lastActive: Date;
  daysActive: number;
  sessions: number;
  actions: number;
  featuresUsed: number;
  segment: string;
  tier: string;
  healthScore: number;
  lifetimeValue: number;
  status: 'active' | 'inactive' | 'churned';
}

export interface UserSegment {
  segmentId: string;
  name: string;
  description: string;
  criteria: SegmentCriteria[];
  userCount: number;
  averageHealthScore: number;
  averageLtv: number;
  churnRate: number;
  expansionRate: number;
  characteristics: SegmentCharacteristics;
}

export interface SegmentCharacteristics {
  primaryFeatures: string[];
  averageUsage: number;
  commonPatterns: string[];
  demographics: Record<string, any>;
}

export interface UserBehaviorAnalytics {
  actionPatterns: ActionPattern[];
  timePatterns: TimePattern[];
  featureSequences: FeatureSequence[];
  commonPaths: CommonPath[];
  anomalies: BehaviorAnomaly[];
}

export interface ActionPattern {
  action: string;
  frequency: number;
  averageTime: number; // from session start
  commonNextActions: { action: string; probability: number }[];
}

export interface TimePattern {
  period: 'hour_of_day' | 'day_of_week' | 'day_of_month';
  peakTimes: number[];
  averageActivity: number;
  distribution: number[]; // one per hour/day
}

export interface FeatureSequence {
  sequence: string[]; // feature IDs in order
  frequency: number;
  averageDuration: number;
  conversionRate: number; // to completion
}

export interface CommonPath {
  path: PathStep[];
  frequency: number;
  percentage: number;
  averageDuration: number;
  completionRate: number;
  dropOffPoints: number[];
}

export interface PathStep {
  feature: string;
  action: string;
  averageTime: number; // from start
}

export interface BehaviorAnomaly {
  userId: string;
  type: 'unusual_feature' | 'unusual_time' | 'unusual_pattern' | 'inactivity' | 'over_activity';
  description: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: Date;
  details: Record<string, any>;
}

export interface UserLifecycleAnalytics {
  distribution: LifecycleStageDistribution;
  transitions: LifecycleTransition[];
  timeInStage: Record<string, number>;
  dropOffPoints: LifecycleDropOff[];
}

export interface LifecycleStageDistribution {
  new: number;
  activated: number;
  engaged: number;
  power: number;
  atRisk: number;
  churned: number;
  percentages: Record<string, number>;
}

export interface LifecycleTransition {
  from: string;
  to: string;
  count: number;
  rate: number;
  averageTime: number; // days in stage before transition
}

export interface LifecycleDropOff {
  stage: string;
  dropOffCount: number;
  dropOffRate: number;
  commonReasons: string[];
}

export interface UserJourney {
  journeyId: string;
  userId: string;
  stages: JourneyStage[];
  duration: number; // in days
  status: 'in_progress' | 'completed' | 'stalled' | 'abandoned';
  currentStage: string;
  completionRate: number;
  touchpoints: JourneyTouchpoint[];
}

export interface JourneyStage {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  enteredAt: Date;
  completedAt?: Date;
  duration?: number;
  actions: string[];
}

export interface JourneyTouchpoint {
  type: 'email' | 'in_app' | 'support' | 'documentation' | 'webinar' | 'training';
  timestamp: Date;
  engagement: 'viewed' | 'clicked' | 'completed';
}

export interface ApiAnalytics {
  endpoints: EndpointAnalytics[];
  usage: ApiUsageMetrics;
  errors: ApiErrorAnalytics;
  performance: ApiPerformanceAnalytics;
  security: ApiSecurityAnalytics;
}

export interface EndpointAnalytics {
  path: string;
  method: string;
  requests: number;
  uniqueUsers: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  statusCodes: Record<number, number>;
  growthRate: number;
  lastUsed: Date;
}

export interface ApiUsageMetrics {
  totalCalls: number;
  uniqueKeys: number;
  callsPerKey: number;
  topKeys: ApiKeyUsage[];
  rateLimitHits: number;
  quotaUsage: number;
  quotaLimit: number;
  utilizationRate: number;
}

export interface ApiKeyUsage {
  keyId: string;
  calls: number;
  lastUsed: Date;
  endpoints: string[];
  errors: number;
}

export interface ApiErrorAnalytics {
  totalErrors: number;
  errorRate: number;
  errorsByType: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  commonErrors: CommonApiError[];
  trends: ErrorTrend[];
}

export interface CommonApiError {
  statusCode: number;
  errorType: string;
  count: number;
  percentage: number;
  affectedUsers: number;
  sampleRequest?: any;
}

export interface ErrorTrend {
  date: Date;
  errors: number;
  errorRate: number;
}

export interface ApiPerformanceAnalytics {
  averageResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  slowestEndpoints: SlowEndpoint[];
  performanceTrends: PerformanceTrend[];
  slos: SloMetrics;
}

export interface SlowEndpoint {
  path: string;
  method: string;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requests: number;
}

export interface PerformanceTrend {
  date: Date;
  averageResponseTime: number;
  p95: number;
  p99: number;
}

export interface SloMetrics {
  targetResponseTime: number; // in ms
  achievedResponseTime: number;
  successRateTarget: number; // percentage
  achievedSuccessRate: number;
  uptimeTarget: number; // percentage
  achievedUptime: number;
  compliance: boolean;
}

export interface ApiSecurityAnalytics {
  blockedRequests: number;
  suspiciousActivity: SecurityIncident[];
  rateLimitViolations: number;
  authFailures: number;
  geoDistribution: GeoDistribution[];
}

export interface SecurityIncident {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
}

export interface GeoDistribution {
  country: string;
  requests: number;
  percentage: number;
}

export interface CollaborationAnalytics {
  projects: ProjectAnalytics[];
  teams: TeamAnalytics[];
  sharing: SharingAnalytics;
  communication: CommunicationAnalytics;
}

export interface ProjectAnalytics {
  projectId: string;
  name: string;
  members: number;
  activity: number;
  lastActive: Date;
  created: Date;
  status: 'active' | 'archived' | 'deleted';
  featuresUsed: string[];
  healthScore: number;
}

export interface TeamAnalytics {
  teamId: string;
  name: string;
  members: number;
  projects: number;
  activityScore: number;
  collaborationRate: number;
  averageMemberContribution: number;
  topContributors: string[];
  inactiveMembers: number;
}

export interface SharingAnalytics {
  sharedItems: number;
  sharesReceived: number;
  sharesSent: number;
  publicShares: number;
  privateShares: number;
  sharesByType: Record<string, number>;
}

export interface CommunicationAnalytics {
  messages: number;
  comments: number;
  mentions: number;
  responseTime: number; // average in minutes
  participationRate: number;
  topCommunicators: string[];
}

export interface RevenueAnalytics {
  mrr: MrrMetrics;
  arr: ArrMetrics;
  revenueByTier: Record<string, number>;
  revenueByFeature: Record<string, number>;
  revenueStreams: RevenueStream[];
  expansion: ExpansionMetrics;
  contraction: ContractionMetrics;
  forecast: RevenueForecast;
}

export interface MrrMetrics {
  current: number;
  previous: number;
  growth: number;
  growthRate: number;
  new: number;
  expansion: number;
  contraction: number;
  churn: number;
  reactivation: number;
}

export interface ArrMetrics {
  current: number;
  previous: number;
  growth: number;
  growthRate: number;
}

export interface RevenueStream {
  stream: string;
  amount: number;
  percentage: number;
  growthRate: number;
  customers: number;
  averageRevenuePerCustomer: number;
}

export interface ExpansionMetrics {
  expansionRevenue: number;
  expansionRate: number;
  expansionCustomers: number;
  averageExpansionValue: number;
  expansionByType: Record<string, number>;
  timeToExpansion: number; // average days
}

export interface ContractionMetrics {
  contractionRevenue: number;
  contractionRate: number;
  contractionCustomers: number;
  averageContractionValue: number;
  contractionByType: Record<string, number>;
}

export interface RevenueForecast {
  period: 'month' | 'quarter' | 'year';
  forecast: number;
  confidence: number; // percentage
  upperBound: number;
  lowerBound: number;
  factors: ForecastFactor[];
}

export interface ForecastFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
}

export interface CohortAnalytics {
  cohorts: Cohort[];
  retention: CohortRetention;
  revenue: CohortRevenue;
  behavior: CohortBehavior;
}

export interface Cohort {
  id: string;
  name: string;
  description: string;
  type: 'signup_date' | 'tier' | 'segment' | 'feature' | 'custom';
  period: CohortPeriod;
  customerCount: number;
  metrics: CohortMetrics;
}

export interface CohortPeriod {
  start: Date;
  end: Date;
}

export interface CohortMetrics {
  averageLtv: number;
  averageRevenue: number;
  retentionRate: number;
  churnRate: number;
  expansionRate: number;
  activationRate: number;
  averageTimeToValue: number;
}

export interface CohortRetention {
  data: RetentionTable;
  averageRetention: number[];
  bestCohort: string;
  worstCohort: string;
  insights: string[];
}

export interface RetentionTable {
  cohorts: string[];
  periods: number[];
  data: number[][]; // retention rates by cohort and period
}

export interface CohortRevenue {
  data: RevenueTable;
  totalRevenue: number;
  averageRevenuePerCohort: number;
  revenueByPeriod: number[];
}

export interface RevenueTable {
  cohorts: string[];
  periods: number[];
  data: number[][]; // revenue by cohort and period
}

export interface CohortBehavior {
  featureAdoption: Record<string, number[]>;
  engagementPatterns: Record<string, number[]>;
  lifecycleProgression: Record<string, number[]>;
}

export interface FunnelAnalytics {
  funnels: Funnel[];
  conversion: ConversionMetrics;
  dropOff: DropOffAnalysis;
}

export interface Funnel {
  id: string;
  name: string;
  description: string;
  type: 'onboarding' | 'activation' | 'conversion' | 'feature' | 'custom';
  steps: FunnelStep[];
  overallConversion: number;
  users: number;
  period: AnalyticsPeriod;
}

export interface FunnelStep {
  stepId: string;
  name: string;
  users: number;
  percentage: number; // of original users
  conversionRate: number; // from previous step
  dropOffRate: number;
  averageTime: number; // from start of funnel
  timeFromPrevious: number;
}

export interface ConversionMetrics {
  overallRate: number;
  bySegment: Record<string, number>;
  byCohort: Record<string, number>;
  trends: ConversionTrend[];
  optimalPath: string[];
}

export interface ConversionTrend {
  date: Date;
  rate: number;
  users: number;
}

export interface DropOffAnalysis {
  totalDropOffs: number;
  dropOffRate: number;
  dropOffsByStep: Record<string, DropOffPoint>;
  commonReasons: string[];
  suggestedActions: string[];
}

export interface RetentionAnalytics {
  metrics: RetentionMetrics;
  cohorts: RetentionCohort[];
  churn: ChurnAnalytics;
  reactivation: ReactivationAnalytics;
  predictive: PredictiveRetention;
}

export interface RetentionMetrics {
  overallRetention: number;
  day7Retention: number;
  day30Retention: number;
  day90Retention: number;
  year1Retention: number;
  averageCustomerLifetime: number; // in days
  retentionBySegment: Record<string, number>;
  retentionByTier: Record<string, number>;
  retentionTrend: RetentionTrend[];
}

export interface RetentionTrend {
  period: Date;
  retentionRate: number;
  customerCount: number;
}

export interface RetentionCohort {
  cohort: string;
  startDate: Date;
  customerCount: number;
  retentionRates: number[];
  revenue: number[];
}

export interface ChurnAnalytics {
  churnRate: number;
  churnedCustomers: number;
  churnedBySegment: Record<string, number>;
  churnedByTier: Record<string, number>;
  churnedByReason: Record<string, number>;
  averageChurnTime: number; // days to churn
  churnPrediction: ChurnPrediction;
}

export interface ChurnPrediction {
  atRiskCustomers: number;
  predictedChurn: number;
  predictedRevenue: number;
  confidence: number;
  topRiskFactors: string[];
}

export interface ReactivationAnalytics {
  reactivatedCustomers: number;
  reactivationRate: number;
  averageTimeToReactivate: number; // days
  reactivationByMethod: Record<string, number>;
  reactivatedRevenue: number;
}

export interface PredictiveRetention {
  forecast: RetentionForecast[];
  riskSegments: RiskSegment[];
  recommendations: RetentionRecommendation[];
}

export interface RetentionForecast {
  period: Date;
  predictedRetention: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}

export interface RiskSegment {
  segment: string;
  customerCount: number;
  riskLevel: string;
  keyRiskFactors: string[];
  recommendedActions: string[];
}

export interface RetentionRecommendation {
  customerId: string;
  riskLevel: string;
  recommendations: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expectedImpact: number;
}

export interface BenchmarkComparison {
  overall: BenchmarkMetric;
  byCategory: Record<string, BenchmarkMetric>;
  byTier: Record<string, BenchmarkMetric>;
  percentile: number;
  ranking: string;
}

export interface BenchmarkMetric {
  current: number;
  benchmark: number;
  percentile: number;
  difference: number;
  differencePercent: number;
  status: 'above_average' | 'average' | 'below_average';
  trend: 'improving' | 'stable' | 'declining';
}

export interface AnalyticsInsight {
  id: string;
  type: InsightType;
  category: InsightCategory;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercent: number;
  significance: number; // 0-1
  confidence: number; // 0-1
  recommendations: string[];
  actionItems: ActionItem[];
  relatedMetrics: string[];
  generatedAt: Date;
  expiresAt: Date;
}

export type InsightType =
  | 'anomaly'
  | 'trend'
  | 'opportunity'
  | 'risk'
  | 'correlation'
  | 'milestone'
  | 'benchmark'
  | 'prediction';

export type InsightCategory =
  | 'usage'
  | 'adoption'
  | 'engagement'
  | 'retention'
  | 'revenue'
  | 'feature'
  | 'support'
  | 'performance';

export interface ActionItem {
  action: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  dueDate?: Date;
  estimatedImpact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface SegmentCriteria {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any;
}

export interface AnalyticsQuery {
  customerId?: string;
  customerIds?: string[];
  period: AnalyticsPeriod;
  dimensions: string[];
  metrics: string[];
  filters: QueryFilter[];
  groupBy?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

export interface QueryFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: any;
}

export interface AnalyticsExport {
  format: 'csv' | 'json' | 'excel' | 'pdf';
  query: AnalyticsQuery;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url?: string;
  expiresAt?: Date;
  createdAt: Date;
  completedAt?: Date;
  fileSize?: number;
  rowCount?: number;
}
