/**
 * Customer Success Platform - Communication Types
 * Defines all customer communication related types and interfaces
 */

export interface CommunicationCampaign {
  id: string;
  name: string;
  description: string;
  type: CampaignType;
  category: CampaignCategory;
  objective: string;
  target: CampaignTarget;
  content: CampaignContent;
  schedule: CampaignSchedule;
  channels: CommunicationChannel[];
  budget?: CampaignBudget;
  metrics: CampaignMetrics;
  configuration: CampaignConfiguration;
  status: CampaignStatus;
  approval: CampaignApproval;
  createdBy: string;
  assignedTo?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  launchedAt?: Date;
  completedAt?: Date;
}

export type CampaignType =
  | 'onboarding'
  | 'feature_announcement'
  | 'educational'
  | 'engagement'
  | 'retention'
  | 'win_back'
  | 'upgrade_promotion'
  | 'survey'
  | 'event'
  | 'custom';

export type CampaignCategory =
  | 'product'
  | 'success'
  | 'marketing'
  | 'support'
  | 'sales'
  | 'community'
  | 'custom';

export interface CampaignTarget {
  type: 'segment' | 'tier' | 'cohort' | 'individual' | 'rule_based' | 'list';
  criteria: TargetCriteria[];
  segments?: string[];
  tiers?: string[];
  cohorts?: string[];
  customers?: string[];
  lists?: string[];
  estimatedReach: number;
  exclusions: TargetExclusion[];
}

export interface TargetCriteria {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'has_not';
  value: any;
  logic?: 'and' | 'or';
}

export interface TargetExclusion {
  type: 'segment' | 'customer' | 'criteria';
  value: any;
  reason: string;
}

export interface CampaignContent {
  subject: string;
  preheader?: string;
  body: string;
  template?: string;
  variables: ContentVariable[];
  personalization: PersonalizationRule[];
  assets: ContentAsset[];
  version: number;
  language: string;
  format: 'html' | 'text' | 'markdown';
}

export interface ContentVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'custom';
  source: string;
  defaultValue?: any;
  required: boolean;
}

export interface PersonalizationRule {
  field: string;
  condition: string;
  content: string;
  priority: number;
}

export interface ContentAsset {
  id: string;
  type: 'image' | 'video' | 'document' | 'link' | 'button';
  name: string;
  url: string;
  alt?: string;
  metadata?: Record<string, any>;
}

export interface CampaignSchedule {
  type: 'immediate' | 'scheduled' | 'recurring' | 'triggered';
  startDate?: Date;
  endDate?: Date;
  timezone: string;
  recurring?: RecurringSchedule;
  trigger?: TriggerSchedule;
  sendTime?: string; // HH:MM format
  optimizeSendTime: boolean;
  respectQuietHours: boolean;
  quietHours: QuietHours;
}

export interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  interval?: number;
  endDate?: Date;
  occurrences?: number;
}

export interface TriggerSchedule {
  event: string;
  conditions: TriggerCondition[];
  delay?: number; // in minutes
  window?: number; // in hours
  cooldown?: number; // in hours
}

export interface TriggerCondition {
  field: string;
  operator: string;
  value: any;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  timezone: string;
  weekends: boolean;
}

export type CommunicationChannel =
  | 'email'
  | 'in_app'
  | 'push'
  | 'sms'
  | 'slack'
  | 'webhook'
  | 'custom';

export interface CampaignBudget {
  total: number;
  currency: string;
  allocated: Record<string, number>;
  spent: number;
  remaining: number;
}

export interface CampaignMetrics {
  target: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  conversionRate: number;
  unsubscribeRate: number;
  bounceRate: number;
  complaintRate: number;
  revenue: number;
  cost: number;
  roi: number;
  metricsByChannel: Record<string, ChannelMetrics>;
  metricsBySegment: Record<string, SegmentMetrics>;
  metricsOverTime: MetricsOverTime[];
}

export interface ChannelMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  cost: number;
}

export interface SegmentMetrics {
  target: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  conversionRate: number;
}

export interface MetricsOverTime {
  date: Date;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
}

export interface CampaignConfiguration {
  trackingEnabled: boolean;
  trackingDomain?: string;
  utmParameters: UtmParameters;
  linkTracking: boolean;
  openTracking: boolean;
  clickTracking: boolean;
  unsubscribeHandling: 'one_click' | 'link' | 'email';
  bcc?: string[];
  replyTo?: string;
  fromName: string;
  fromEmail: string;
  testMode: boolean;
  testRecipients?: string[];
  dryRun: boolean;
  batchSize?: number;
  throttle?: number; // emails per minute
  retryPolicy: RetryPolicy;
}

export interface UtmParameters {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  term?: string;
}

export interface RetryPolicy {
  enabled: boolean;
  maxAttempts: number;
  retryIntervals: number[]; // in minutes
  retryConditions: string[];
}

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface CampaignApproval {
  required: boolean;
  approvers: string[];
  status: 'pending' | 'approved' | 'rejected';
  requestedAt?: Date;
  decidedAt?: Date;
  comments?: string;
}

export interface CommunicationMessage {
  id: string;
  campaignId?: string;
  customerId: string;
  customerEmail?: string;
  channel: CommunicationChannel;
  type: MessageType;
  status: MessageStatus;
  direction: 'outbound' | 'inbound';
  subject: string;
  content: MessageContent;
  metadata: MessageMetadata;
  events: MessageEvent[];
  metrics: MessageMetrics;
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageType =
  | 'campaign'
  | 'transactional'
  | 'triggered'
  | 'automated'
  | 'manual'
  | 'response'
  | 'notification';

export type MessageStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'converted'
  | 'bounced'
  | 'deferred'
  | 'failed'
  | 'cancelled';

export interface MessageContent {
  body: string;
  html?: string;
  template?: string;
  variables: Record<string, any>;
  attachments: MessageAttachment[];
  personalization: Record<string, any>;
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface MessageMetadata {
  campaignId?: string;
  workflowId?: string;
  playbookId?: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string[];
  correlationId?: string;
  customFields: Record<string, any>;
}

export interface MessageEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  details?: Record<string, any>;
  source?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type EventType =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'converted'
  | 'bounced'
  | 'deferred'
  | 'failed'
  | 'unsubscribed'
  | 'complained'
  | 'rejected';

export interface MessageMetrics {
  opens: number;
  clicks: number;
  conversions: number;
  firstOpenAt?: Date;
  firstClickAt?: Date;
  convertedAt?: Date;
  clickPaths: ClickPath[];
}

export interface ClickPath {
  url: string;
  clickedAt: Date;
  referrer?: string;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  category: string;
  subject: string;
  preheader?: string;
  body: string;
  variables: TemplateVariable[];
  personalization: PersonalizationRule[];
  assets: ContentAsset[];
  tags: string[];
  language: string;
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

export type TemplateType =
  | 'email'
  | 'in_app'
  | 'push'
  | 'sms'
  | 'slack'
  | 'notification'
  | 'custom';

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'array' | 'object';
  description: string;
  defaultValue?: any;
  required: boolean;
  example?: any;
}

export interface Survey {
  id: string;
  name: string;
  description: string;
  type: SurveyType;
  category: SurveyCategory;
  questions: SurveyQuestion[];
  configuration: SurveyConfiguration;
  distribution: SurveyDistribution;
  schedule: SurveySchedule;
  responses: SurveyResponse[];
  metrics: SurveyMetrics;
  status: SurveyStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  launchedAt?: Date;
  closedAt?: Date;
}

export type SurveyType =
  | 'nps'
  | 'csat'
  | 'ces'
  | 'custom'
  | 'poll'
  | 'quiz'
  | 'feedback';

export type SurveyCategory =
  | 'product'
  | 'support'
  | 'feature'
  | 'onboarding'
  | 'relationship'
  | 'custom';

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  text: string;
  description?: string;
  required: boolean;
  order: number;
  options?: QuestionOption[];
  scale?: ScaleConfig;
  validation?: ValidationRule[];
  conditionalLogic?: ConditionalLogic;
  metadata: Record<string, any>;
}

export type QuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'rating'
  | 'scale'
  | 'multiple_choice'
  | 'checkbox'
  | 'dropdown'
  | 'date'
  | 'ranking'
  | 'matrix'
  | 'nps'
  | 'csat'
  | 'ces';

export interface QuestionOption {
  id: string;
  text: string;
  value: any;
  order: number;
  exclusive?: boolean;
}

export interface ScaleConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  step?: number;
}

export interface ValidationRule {
  type: 'required' | 'min_length' | 'max_length' | 'pattern' | 'min' | 'max' | 'email';
  value?: any;
  message: string;
}

export interface ConditionalLogic {
  condition: string;
  questions: string[]; // question IDs to show/hide
  action: 'show' | 'hide';
}

export interface SurveyConfiguration {
  anonymous: boolean;
  allowMultipleResponses: boolean;
  limitResponses?: number;
  shuffleQuestions: boolean;
  showProgress: boolean;
  allowReview: boolean;
  timeLimit?: number; // in minutes
  thankYouMessage: string;
  redirectUrl?: string;
  branding: BrandingConfig;
}

export interface BrandingConfig {
  logo?: string;
  primaryColor?: string;
  customCss?: string;
  customDomain?: string;
}

export interface SurveyDistribution {
  channels: SurveyChannel[];
  target: CampaignTarget;
  invitation: SurveyInvitation;
  reminders: SurveyReminder[];
  incentives?: Incentive;
}

export interface SurveyChannel {
  type: 'email' | 'in_app' | 'link' | 'embed' | 'sms';
  enabled: boolean;
  config: any;
}

export interface SurveyInvitation {
  subject: string;
  message: string;
  template?: string;
  sendImmediately: boolean;
}

export interface SurveyReminder {
  enabled: boolean;
  count: number;
  interval: number; // in hours
  template?: string;
}

export interface Incentive {
  type: 'discount' | 'credit' | 'gift' | 'entry' | 'custom';
  value: any;
  description: string;
  conditions: string[];
}

export interface SurveySchedule {
  type: 'immediate' | 'scheduled' | 'recurring' | 'triggered';
  startDate?: Date;
  endDate?: Date;
  recurring?: RecurringSchedule;
  trigger?: TriggerSchedule;
}

export type SurveyStatus = 'draft' | 'scheduled' | 'open' | 'paused' | 'closed' | 'archived';

export interface SurveyResponse {
  id: string;
  surveyId: string;
  customerId: string;
  respondentInfo: RespondentInfo;
  answers: SurveyAnswer[];
  score?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  metadata: ResponseMetadata;
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in seconds
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface RespondentInfo {
  anonymous: boolean;
  email?: string;
  name?: string;
  company?: string;
  role?: string;
  tenure?: number;
}

export interface SurveyAnswer {
  questionId: string;
  question: string;
  type: QuestionType;
  answer: any;
  answeredAt: Date;
  duration?: number; // time spent on question
  metadata?: Record<string, any>;
}

export interface ResponseMetadata {
  source: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  customFields: Record<string, any>;
}

export interface SurveyMetrics {
  invitations: number;
  starts: number;
  completions: number;
  abandonment: number;
  startRate: number;
  completionRate: number;
  averageScore: number;
  averageDuration: number;
  responsesByDay: ResponseByDay[];
  responsesByChannel: Record<string, number>;
  nps?: NpsMetrics;
  csat?: CsatMetrics;
  ces?: CesMetrics;
  questionAnalysis: QuestionAnalysis[];
}

export interface ResponseByDay {
  date: Date;
  starts: number;
  completions: number;
}

export interface NpsMetrics {
  score: number; // -100 to 100
  promoters: number;
  passives: number;
  detractors: number;
  promoterPercentage: number;
  passivePercentage: number;
  detractorPercentage: number;
  responseCount: number;
}

export interface CsatMetrics {
  score: number; // 0-100
  averageRating: number;
  positiveResponses: number;
  neutralResponses: number;
  negativeResponses: number;
  responseCount: number;
}

export interface CesMetrics {
  score: number; // 0-100
  averageRating: number;
  easyResponses: number;
  neutralResponses: number;
  difficultResponses: number;
  responseCount: number;
}

export interface QuestionAnalysis {
  questionId: string;
  question: string;
  type: QuestionType;
  responseCount: number;
  average?: number;
  distribution?: Record<string, number>;
  textResponses?: TextResponseAnalysis;
}

export interface TextResponseAnalysis {
  count: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topics: Topic[];
  wordCloud: WordCloudEntry[];
}

export interface Topic {
  name: string;
  frequency: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  keywords: string[];
}

export interface WordCloudEntry {
  word: string;
  frequency: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface CommunicationPreferences {
  customerId: string;
  email: EmailPreferences;
  inApp: InAppPreferences;
  push: PushPreferences;
  sms: SmsPreferences;
  slack: SlackPreferences;
  categories: CategoryPreferences;
  frequency: FrequencyPreferences;
  timezone: string;
  language: string;
  updatedAt: Date;
}

export interface EmailPreferences {
  enabled: boolean;
  address: string;
  categories: Record<string, boolean>;
  frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
  digest: boolean;
}

export interface InAppPreferences {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  mobile: boolean;
}

export interface PushPreferences {
  enabled: boolean;
  deviceTokens: DeviceToken[];
  categories: Record<string, boolean>;
  quietHours: QuietHours;
}

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
  appVersion?: string;
  osVersion?: string;
  active: boolean;
  lastUsed: Date;
}

export interface SmsPreferences {
  enabled: boolean;
  phoneNumber: string;
  country: string;
  categories: Record<string, boolean>;
}

export interface SlackPreferences {
  enabled: boolean;
  workspace: string;
  channel: string;
  categories: Record<string, boolean>;
}

export interface CategoryPreferences {
  product: boolean;
  security: boolean;
  billing: boolean;
  support: boolean;
  features: boolean;
  education: boolean;
  community: boolean;
  custom: Record<string, boolean>;
}

export interface FrequencyPreferences {
  maximum: number; // per day
  minimum: number; // per day
  quietHours: QuietHours;
  timezone: string;
  batchingEnabled: boolean;
  batchWindow: number; // in hours
}

export interface CommunicationReport {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  period: ReportPeriod;
  filters: ReportFilter[];
  metrics: ReportMetric[];
  grouping: ReportGrouping[];
  visualization: ReportVisualization[];
  schedule?: ReportSchedule;
  recipients: string[];
  format: 'pdf' | 'html' | 'csv' | 'excel';
  createdBy: string;
  createdAt: Date;
  lastGenerated?: Date;
}

export type ReportType =
  | 'campaign_summary'
  | 'channel_performance'
  | 'engagement'
  | 'survey_results'
  | 'nps_trends'
  | 'custom';

export interface ReportPeriod {
  start: Date;
  end: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  comparison?: {
    start: Date;
    end: Date;
  };
}

export interface ReportFilter {
  field: string;
  operator: string;
  value: any;
}

export interface ReportMetric {
  name: string;
  aggregation: 'sum' | 'average' | 'count' | 'min' | 'max' | 'percentage';
  label?: string;
}

export interface ReportGrouping {
  field: string;
  order: 'asc' | 'desc';
}

export interface ReportVisualization {
  type: 'table' | 'chart' | 'graph' | 'gauge' | 'heatmap' | 'funnel';
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  config: any;
}
