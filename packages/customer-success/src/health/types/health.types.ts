/**
 * Customer Success Platform - Health Scoring Types
 * Defines all customer health scoring related types and interfaces
 */

export interface CustomerHealth {
  id: string;
  customerId: string;
  score: HealthScore;
  factors: HealthFactors;
  trends: HealthTrends;
  alerts: HealthAlert[];
  recommendations: HealthRecommendation[];
  riskLevel: RiskLevel;
  status: HealthStatus;
  lastUpdated: Date;
  nextReviewDate: Date;
  history: HealthHistoryEntry[];
  metadata: Record<string, any>;
}

export interface HealthScore {
  overall: number; // 0-100
  product: number; // 0-100
  relationship: number; // 0-100
  financial: number; // 0-100
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  usage: { score: number; weight: number; trend: 'up' | 'down' | 'stable' };
  adoption: { score: number; weight: number; trend: 'up' | 'down' | 'stable' };
  engagement: { score: number; weight: number; trend: 'up' | 'down' | 'stable' };
  support: { score: number; weight: number; trend: 'up' | 'down' | 'stable' };
  satisfaction: { score: number; weight: number; trend: 'up' | 'down' | 'stable' };
  growth: { score: number; weight: number; trend: 'up' | 'down' | 'stable' };
}

export interface HealthFactors {
  usage: UsageHealthFactors;
  adoption: AdoptionHealthFactors;
  engagement: EngagementHealthFactors;
  support: SupportHealthFactors;
  satisfaction: SatisfactionHealthFactors;
  financial: FinancialHealthFactors;
  growth: GrowthHealthFactors;
}

export interface UsageHealthFactors {
  activeUsers: {
    current: number;
    previous: number;
    change: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    score: number;
  };
  requestVolume: {
    current: number;
    previous: number;
    change: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    score: number;
  };
  featureUsage: {
    featuresUsed: number;
    totalFeatures: number;
    adoptionRate: number;
    topFeatures: string[];
    underutilizedFeatures: string[];
    score: number;
  };
  sessionDuration: {
    average: number; // in minutes
    previous: number;
    change: number;
    score: number;
  };
  loginFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
    score: number;
  };
  apiUsage: {
    calls: number;
    errorRate: number;
    latency: number;
    score: number;
  };
}

export interface AdoptionHealthFactors {
  featuresAdopted: number;
  totalFeatures: number;
  adoptionRate: number;
  coreFeaturesAdopted: string[];
  advancedFeaturesAdopted: string[];
  timeToAdoption: number; // days to adopt first feature
  adoptionVelocity: number; // features per month
  newFeaturesTried: number;
  featureDepthOfUse: Record<string, number>; // feature -> usage depth score
  score: number;
}

export interface EngagementHealthFactors {
  loginStreak: number; // consecutive days
  lastLogin: Date;
  daysSinceLastLogin: number;
  interactionRate: number; // interactions per session
  documentationViews: number;
  tutorialCompletion: number;
  communityParticipation: {
    posts: number;
    comments: number;
    likes: number;
    score: number;
  };
  feedbackProvided: number;
  score: number;
}

export interface SupportHealthFactors {
  ticketsOpened: number;
  ticketsResolved: number;
  openTickets: number;
  avgResolutionTime: number; // in hours
  customerSatisfaction: number; // 0-5
  ticketSeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recurringIssues: string[];
  selfServiceRate: number; // percentage solved via self-service
  escalationRate: number; // percentage escalated
  score: number;
}

export interface SatisfactionHealthFactors {
  npsScore: number; // -100 to 100
  npsCategory: 'promoter' | 'passive' | 'detractor';
  csatScore: number; // 0-100
  cesScore: number; // Customer Effort Score, 0-100
  sentimentAnalysis: {
    positive: number; // percentage
    neutral: number;
    negative: number;
  };
  surveyResponses: number;
  lastSurveyDate: Date;
  feedbackCount: number;
  positiveFeedback: number;
  negativeFeedback: number;
  score: number;
}

export interface FinancialHealthFactors {
  subscriptionStatus: 'active' | 'trial' | 'past_due' | 'cancelled' | 'expired';
  paymentHistory: {
    onTimePayments: number;
    latePayments: number;
    failedPayments: number;
    paymentSuccessRate: number;
  };
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  contractValue: number;
  remainingContractValue: number;
  contractStartDate: Date;
  contractEndDate?: Date;
  daysUntilRenewal: number;
  paymentMethod: 'credit_card' | 'invoice' | 'wire' | 'other';
  billingFrequency: 'monthly' | 'quarterly' | 'annual';
  expansionRevenue: number;
  contractionRevenue: number;
  churnRisk: 'low' | 'medium' | 'high';
  score: number;
}

export interface GrowthHealthFactors {
  userGrowthRate: number; // percentage
  revenueGrowthRate: number; // percentage
  usageGrowthRate: number; // percentage
  expansionOpportunities: ExpansionOpportunity[];
  upsellPotential: number; // 0-100
  crossSellPotential: number; // 0-100
  renewalProbability: number; // 0-100
  advocateScore: number; // likelihood to recommend, 0-100
  score: number;
}

export interface ExpansionOpportunity {
  type: 'upgrade' | 'add_on' | 'seat_increase' | 'usage_increase';
  product: string;
  currentTier: string;
  suggestedTier: string;
  potentialValue: number;
  likelihood: number; // 0-100
  reason: string;
  recommendedAction: string;
}

export interface HealthTrends {
  overall: TrendData;
  product: TrendData;
  relationship: TrendData;
  financial: TrendData;
  factors: Record<string, TrendData>;
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
  dataPoints: TrendPoint[];
  movingAverage: number;
  forecast?: number;
}

export interface TrendPoint {
  date: Date;
  value: number;
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type HealthStatus = 'churned' | 'at_risk' | 'needs_attention' | 'healthy' | 'thriving';

export interface HealthAlert {
  id: string;
  type: AlertType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: AlertCategory;
  title: string;
  description: string;
  factor: string;
  currentValue: number;
  threshold: number;
  triggeredAt: Date;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  actions: AlertAction[];
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  resolvedBy?: string;
}

export type AlertType =
  | 'threshold_breach'
  | 'trend_change'
  | 'anomaly'
  | 'prediction'
  | 'manual'
  | 'system';

export type AlertCategory =
  | 'usage'
  | 'adoption'
  | 'engagement'
  | 'support'
  | 'satisfaction'
  | 'financial'
  | 'growth';

export interface AlertAction {
  type: 'contact' | 'task' | 'playbook' | 'escalation' | 'monitor';
  description: string;
  assignee?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  completed: boolean;
  completedAt?: Date;
}

export interface HealthRecommendation {
  id: string;
  customerId: string;
  type: RecommendationType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: {
    area: string;
    improvement: number; // percentage points
  }[];
  actions: RecommendedAction[];
  resources: RecommendationResource[];
  estimatedEffort: number; // in hours
  successMetrics: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  completedAt?: Date;
}

export type RecommendationType =
  | 'feature_adoption'
  | 'engagement_improvement'
  | 'support_optimization'
  | 'expansion'
  | 'retention'
  | 'revenue_growth'
  | 'cost_reduction';

export interface RecommendedAction {
  order: number;
  action: string;
  type: 'automated' | 'manual' | 'hybrid';
  assignee?: string;
  dueDate?: Date;
  completed: boolean;
  completedAt?: Date;
  notes?: string;
}

export interface RecommendationResource {
  type: 'playbook' | 'template' | 'document' | 'video' | 'tool';
  title: string;
  url?: string;
  description: string;
}

export interface HealthHistoryEntry {
  id: string;
  date: Date;
  score: HealthScore;
  status: HealthStatus;
  riskLevel: RiskLevel;
  changes: HealthChange[];
  notes?: string;
  recordedBy?: string;
}

export interface HealthChange {
  factor: string;
  previousValue: number;
  newValue: number;
  change: number;
  impact: 'positive' | 'negative' | 'neutral';
  reason?: string;
}

export interface HealthScoreConfiguration {
  weights: ScoreWeights;
  thresholds: ScoreThresholds;
  factors: FactorConfiguration[];
  refreshInterval: number; // in hours
  alertRules: AlertRule[];
  trendWindow: number; // days to consider for trends
  predictionHorizon: number; // days to predict ahead
}

export interface ScoreWeights {
  usage: number;
  adoption: number;
  engagement: number;
  support: number;
  satisfaction: number;
  growth: number;
}

export interface ScoreThresholds {
  critical: number; // below this is critical
  high: number; // below this is high risk
  medium: number; // below this needs attention
  healthy: number; // above this is healthy
  thriving: number; // above this is thriving
}

export interface FactorConfiguration {
  name: string;
  category: string;
  weight: number;
  dataSource: string;
  calculationMethod: string;
  thresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  refreshInterval?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  factor: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'changes_by' | 'trend';
  threshold: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cooldown: number; // minimum hours between alerts
  actions: AlertAction[];
  enabled: boolean;
}

export interface HealthScoreBatchRequest {
  customerIds: string[];
  forceRefresh?: boolean;
  includeHistory?: boolean;
  includeAlerts?: boolean;
  includeRecommendations?: boolean;
}

export interface HealthScoreBatchResponse {
  results: Map<string, CustomerHealth>;
  errors: Map<string, string>;
  timestamp: Date;
  processingTime: number;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria[];
  customerCount: number;
  averageHealthScore: number;
  healthDistribution: Record<HealthStatus, number>;
  riskDistribution: Record<RiskLevel, number>;
  lastUpdated: Date;
}

export interface SegmentCriteria {
  factor: string;
  operator: 'greater_than' | 'less_than' | 'between' | 'equals' | 'contains';
  value: any;
  weight?: number;
}
