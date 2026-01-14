/**
 * Customer Success Platform - Success Playbooks Types
 * Defines all success playbook related types and interfaces
 */

export interface SuccessPlaybook {
  id: string;
  name: string;
  description: string;
  type: PlaybookType;
  category: PlaybookCategory;
  targetSegment: PlaybookTargetSegment;
  triggers: PlaybookTrigger[];
  stages: PlaybookStage[];
  configuration: PlaybookConfiguration;
  metrics: PlaybookMetrics;
  resources: PlaybookResource[];
  status: PlaybookStatus;
  version: number;
  author: string;
  reviewers: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  lastUsed?: Date;
  usageStats: PlaybookUsageStats;
}

export type PlaybookType =
  | 'onboarding'
  | 'adoption'
  | 'risk_mitigation'
  | 'expansion'
  | 'renewal'
  | 'win_back'
  | 'escalation'
  | 'custom';

export type PlaybookCategory =
  | 'customer_health'
  | 'feature_adoption'
  | 'engagement'
  | 'retention'
  | 'revenue_growth'
  | 'support'
  | 'success'
  | 'account_management';

export interface PlaybookTargetSegment {
  type: 'all' | 'tier' | 'segment' | 'cohort' | 'individual' | 'rule_based';
  criteria: SegmentCriteria[];
  tiers?: string[];
  segments?: string[];
  cohorts?: string[];
  customers?: string[];
  rules?: SegmentRule[];
}

export interface SegmentCriteria {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: any;
  weight?: number;
}

export interface SegmentRule {
  id: string;
  name: string;
  condition: string;
  logic: 'and' | 'or';
  criteria: SegmentCriteria[];
}

export interface PlaybookTrigger {
  id: string;
  type: TriggerType;
  condition: TriggerCondition;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  cooldown?: number; // minimum time between triggers (hours)
  autoStart: boolean;
  manualApproval: boolean;
  notificationSettings: TriggerNotificationSettings;
}

export type TriggerType =
  | 'health_score_change'
  | 'risk_level_change'
  | 'usage_decline'
  | 'engagement_drop'
  | 'support_ticket'
  | 'feedback_received'
  | 'milestone_reached'
  | 'milestone_missed'
  | 'contract_event'
  | 'payment_event'
  | 'feature_adoption'
  | 'nps_response'
  | 'manual'
  | 'scheduled'
  | 'webhook'
  | 'custom';

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between' | 'changes_by' | 'trend';
  value: any;
  threshold?: number;
  timeWindow?: number; // for trend-based triggers (hours)
  duration?: number; // how long condition must be true (hours)
}

export interface TriggerNotificationSettings {
  notifyOnTrigger: boolean;
  channels: ('email' | 'slack' | 'in_app' | 'sms' | 'webhook')[];
  recipients: string[];
  message?: string;
}

export interface PlaybookStage {
  id: string;
  name: string;
  description: string;
  order: number;
  type: StageType;
  duration?: number; // in days
  dependencies: string[]; // stage IDs that must be completed first
  tasks: PlaybookTask[];
  milestones: StageMilestone[];
  approvals: StageApproval[];
  automatedActions: AutomatedAction[];
  skipConditions: SkipCondition[];
  configuration: StageConfiguration;
}

export type StageType =
  | 'assessment'
  | 'planning'
  | 'execution'
  | 'monitoring'
  | 'review'
  | 'follow_up'
  | 'custom';

export interface PlaybookTask {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  assignee?: string; // role or user ID
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: TaskStatus;
  dueDate?: Date;
  estimatedDuration?: number; // in hours
  dependencies: string[]; // task IDs
  subtasks: Subtask[];
  checklists: Checklist[];
  attachments: TaskAttachment[];
  automation: TaskAutomation;
  completionCriteria: CompletionCriteria[];
  notes?: string;
}

export type TaskType =
  | 'contact'
  | 'email'
  | 'meeting'
  | 'training'
  | 'review'
  | 'analysis'
  | 'configuration'
  | 'documentation'
  | 'approval'
  | 'monitoring'
  | 'custom';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed' | 'blocked';

export interface Subtask {
  id: string;
  name: string;
  completed: boolean;
  completedAt?: Date;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
  required: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  checkedAt?: Date;
}

export interface TaskAttachment {
  id: string;
  name: string;
  type: 'document' | 'template' | 'link' | 'file' | 'video';
  url: string;
  size?: number;
  description?: string;
}

export interface TaskAutomation {
  enabled: boolean;
  triggers: AutomationTrigger[];
  actions: AutomationAction[];
  conditions: AutomationCondition[];
}

export interface AutomationTrigger {
  type: 'time_based' | 'event_based' | 'condition_based';
  config: any;
}

export interface AutomationAction {
  type: 'send_email' | 'create_task' | 'update_field' | 'webhook' | 'notification' | 'escalate';
  config: any;
}

export interface AutomationCondition {
  field: string;
  operator: string;
  value: any;
}

export interface CompletionCriteria {
  criterion: string;
  type: 'metric' | 'manual' | 'automated';
  value?: any;
  verifiedBy?: string; // role
}

export interface StageMilestone {
  id: string;
  name: string;
  description: string;
  targetDate?: Date;
  achieved: boolean;
  achievedAt?: Date;
  criteria: string[];
}

export interface StageApproval {
  id: string;
  name: string;
  required: boolean;
  approvers: string[]; // role or user IDs
  status: 'pending' | 'approved' | 'rejected';
  requestedAt?: Date;
  decidedAt?: Date;
  comments?: string;
}

export interface AutomatedAction {
  id: string;
  name: string;
  type: 'email' | 'notification' | 'task_creation' | 'field_update' | 'webhook' | 'api_call';
  trigger: string; // when to execute
  config: any;
  enabled: boolean;
}

export interface SkipCondition {
  field: string;
  operator: string;
  value: any;
}

export interface StageConfiguration {
  allowSkip: boolean;
  requireCompletion: boolean;
  autoAdvance: boolean;
  notifyOnStart: boolean;
  notifyOnComplete: boolean;
  reminderSchedule?: ReminderSchedule;
}

export interface ReminderSchedule {
  enabled: boolean;
  frequency: number; // hours
  channels: ('email' | 'in_app' | 'slack')[];
  template?: string;
}

export interface PlaybookConfiguration {
  executionMode: 'manual' | 'auto' | 'hybrid';
  executionOrder: 'sequential' | 'parallel' | 'conditional';
  allowCustomization: boolean;
  requireApproval: boolean;
  approvers?: string[];
  maxDuration?: number; // in days
  escalationRules: EscalationRule[];
  successCriteria: SuccessCriteria[];
  failureHandling: FailureHandling;
  integrationSettings: IntegrationSettings;
}

export interface EscalationRule {
  trigger: string;
  condition: string;
  escalateTo: string; // role or user ID
  notify: boolean;
  actions: string[];
}

export interface SuccessCriteria {
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'between';
  value: any;
  weight: number;
  required: boolean;
}

export interface FailureHandling {
  onTaskFailure: 'continue' | 'pause' | 'abort' | 'escalate';
  onStageFailure: 'continue' | 'pause' | 'abort' | 'escalate';
  onTimeout: 'continue' | 'pause' | 'abort' | 'escalate';
  maxRetries: number;
  retryInterval: number; // in hours
}

export interface IntegrationSettings {
  crm: boolean;
  support: boolean;
  analytics: boolean;
  communication: boolean;
  customIntegrations: CustomIntegration[];
}

export interface CustomIntegration {
  name: string;
  type: string;
  config: any;
  enabled: boolean;
}

export interface PlaybookMetrics {
  primaryMetric: {
    name: string;
    target: number;
    current?: number;
  };
  secondaryMetrics: Metric[];
  trackingMetrics: Metric[];
  outcomes: OutcomeMetric[];
}

export interface Metric {
  name: string;
  description: string;
  type: 'counter' | 'percentage' | 'duration' | 'score' | 'currency';
  target?: number;
  current?: number;
}

export interface OutcomeMetric {
  name: string;
  type: 'retention' | 'expansion' | 'satisfaction' | 'engagement' | 'revenue';
  baseline: number;
  target: number;
  actual?: number;
  achieved: boolean;
}

export interface PlaybookResource {
  id: string;
  type: ResourceType;
  title: string;
  description: string;
  url?: string;
  content?: string;
  format: 'text' | 'video' | 'document' | 'template' | 'link' | 'interactive';
  language?: string;
  version?: string;
  tags: string[];
  required: boolean;
}

export type ResourceType =
  | 'template'
  | 'guide'
  | 'video'
  | 'document'
  | 'email_template'
  | 'script'
  | 'checklist'
  | 'tool'
  | 'link'
  | 'custom';

export type PlaybookStatus = 'draft' | 'active' | 'paused' | 'archived' | 'deprecated';

export interface PlaybookUsageStats {
  totalExecutions: number;
  activeExecutions: number;
  completedExecutions: number;
  successRate: number;
  averageDuration: number; // in days
  lastExecution?: Date;
  bySegment: Record<string, number>;
  byTier: Record<string, number>;
}

export interface PlaybookExecution {
  id: string;
  playbookId: string;
  customerId: string;
  customerName: string;
  status: ExecutionStatus;
  stage: string;
  progress: ExecutionProgress;
  tasks: ExecutionTask[];
  timeline: ExecutionTimeline;
  metrics: ExecutionMetrics;
  outcomes: ExecutionOutcome[];
  notes: ExecutionNote[];
  assignedTo: string;
  startedBy: string;
  configuration: ExecutionConfiguration;
  customizations: PlaybookCustomization[];
  triggers: TriggerEvent[];
  createdAt: Date;
  startedAt: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
}

export type ExecutionStatus =
  | 'not_started'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'on_hold';

export interface ExecutionProgress {
  percentage: number;
  completedStages: number;
  totalStages: number;
  completedTasks: number;
  totalTasks: number;
  currentStage?: string;
  currentTask?: string;
}

export interface ExecutionTask {
  taskId: string;
  playbookTaskId: string;
  name: string;
  status: TaskStatus;
  assignee?: string;
  dueDate?: Date;
  completedAt?: Date;
  notes?: string;
  attachments: string[];
  subtasks: Subtask[];
}

export interface ExecutionTimeline {
  milestones: ExecutionMilestone[];
  events: TimelineEvent[];
  reminders: Reminder[];
}

export interface ExecutionMilestone {
  stageId: string;
  stageName: string;
  targetDate: Date;
  actualDate?: Date;
  status: 'pending' | 'completed' | 'missed';
}

export interface TimelineEvent {
  id: string;
  type: EventType;
  description: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export type EventType =
  | 'started'
  | 'stage_started'
  | 'stage_completed'
  | 'task_assigned'
  | 'task_completed'
  | 'task_skipped'
  | 'escalated'
  | 'paused'
  | 'resumed'
  | 'cancelled'
  | 'completed'
  | 'note_added'
  | 'custom';

export interface Reminder {
  id: string;
  taskId?: string;
  stageId?: string;
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
  channel: 'email' | 'in_app' | 'slack';
  message: string;
}

export interface ExecutionMetrics {
  customMetrics: Record<string, number>;
  playbookMetrics: Record<string, number>;
  customerHealthBefore: number;
  customerHealthAfter?: number;
  riskScoreBefore: number;
  riskScoreAfter?: number;
  satisfactionScore?: number;
  outcomeScores: Record<string, number>;
}

export interface ExecutionOutcome {
  metric: string;
  baseline: number;
  target: number;
  actual: number;
  achieved: boolean;
  improvement: number;
  confidence: number;
}

export interface ExecutionNote {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  type: 'progress' | 'observation' | 'decision' | 'issue' | 'success' | 'custom';
  visibility: 'private' | 'team' | 'all';
  attachments: string[];
}

export interface ExecutionConfiguration {
  skipStages: string[];
  skipTasks: string[];
  modifiedTasks: ModifiedTask[];
  customTasks: CustomTask[];
  customFields: Record<string, any>;
}

export interface ModifiedTask {
  taskId: string;
  changes: Record<string, any>;
}

export interface CustomTask {
  id: string;
  name: string;
  description: string;
  insertAfter?: string; // task ID
  insertBefore?: string; // task ID
}

export interface PlaybookCustomization {
  type: 'stage_added' | 'stage_removed' | 'stage_modified' | 'task_added' | 'task_removed' | 'task_modified';
  elementId: string;
  description: string;
  changes: Record<string, any>;
}

export interface TriggerEvent {
  triggerId: string;
  type: TriggerType;
  timestamp: Date;
  data: Record<string, any>;
  matched: boolean;
}

export interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  category: PlaybookCategory;
  targetAudience: string[];
  objectives: string[];
  prerequisites: string[];
  stages: TemplateStage[];
  duration: number; // in days
  resources: PlaybookResource[];
  successCriteria: SuccessCriteria[];
  tags: string[];
  customizable: boolean;
  version: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateStage {
  name: string;
  description: string;
  duration: number;
  objectives: string[];
  tasks: TemplateTask[];
  deliverables: string[];
}

export interface TemplateTask {
  name: string;
  description: string;
  assignee: string;
  duration: number;
  resources: string[];
  dependencies: string[];
}

export interface PlaybookLibrary {
  id: string;
  name: string;
  description: string;
  playbooks: string[]; // playbook IDs
  filters: LibraryFilter[];
  sorting: LibrarySorting;
  categories: string[];
  tags: string[];
  public: boolean;
  owner: string;
  collaborators: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryFilter {
  field: string;
  operator: string;
  value: any;
}

export interface LibrarySorting {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PlaybookReport {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  playbookId?: string;
  executionIds?: string[];
  period: ReportPeriod;
  filters: ReportFilter[];
  metrics: ReportMetric[];
  grouping: ReportGrouping[];
  visualization: ReportVisualization[];
  schedule?: ReportSchedule;
  recipients: string[];
  createdBy: string;
  createdAt: Date;
  lastGenerated?: Date;
}

export type ReportType = 'execution' | 'outcome' | 'performance' | 'comparison' | 'custom';

export interface ReportPeriod {
  start: Date;
  end: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
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
  type: 'table' | 'chart' | 'graph' | 'gauge' | 'heatmap';
  config: any;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  timezone: string;
}

export interface PlaybookRecommendation {
  id: string;
  customerId: string;
  recommendedPlaybooks: RecommendedPlaybook[];
  reasoning: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  context: RecommendationContext;
  expiresAt: Date;
  createdAt: Date;
}

export interface RecommendedPlaybook {
  playbookId: string;
  playbookName: string;
  matchScore: number;
  expectedOutcome: string;
  estimatedDuration: number;
  requiredResources: string[];
  potentialRisks: string[];
}

export interface RecommendationContext {
  healthScore: number;
  riskLevel: string;
  currentStage: string;
  recentEvents: string[];
  customerAttributes: Record<string, any>;
}
