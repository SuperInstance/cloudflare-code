/**
 * Customer Success Platform - Onboarding Types
 * Defines all onboarding workflow related types and interfaces
 */

export interface OnboardingStep {
  id: string;
  name: string;
  description: string;
  order: number;
  category: OnboardingStepCategory;
  required: boolean;
  estimatedDuration: number; // in minutes
  dependencies: string[]; // step IDs that must be completed first
  resources: OnboardingResource[];
  status: OnboardingStepStatus;
  completedAt?: Date;
  startedAt?: Date;
  metadata?: Record<string, any>;
}

export type OnboardingStepCategory =
  | 'account_setup'
  | 'team_management'
  | 'project_creation'
  | 'api_configuration'
  | 'documentation'
  | 'tutorial'
  | 'first_code_generation'
  | 'support_contact';

export type OnboardingStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

export interface OnboardingResource {
  type: 'video' | 'document' | 'interactive' | 'article' | 'webinar';
  title: string;
  url: string;
  duration?: number;
  thumbnail?: string;
}

export interface OnboardingWorkflow {
  id: string;
  customerId: string;
  customerType: CustomerType;
  templateId: string;
  status: OnboardingStatus;
  progress: OnboardingProgress;
  steps: OnboardingStep[];
  milestones: OnboardingMilestone[];
  timeline: OnboardingTimeline;
  assignedTo?: string; // CSM ID
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
}

export type CustomerType = 'enterprise' | 'mid_market' | 'small_business' | 'startup' | 'individual';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'paused' | 'cancelled';

export interface OnboardingProgress {
  percentage: number;
  completedSteps: number;
  totalSteps: number;
  currentStepId?: string;
  overallScore: number; // 0-100
  engagementScore: number; // 0-100
  timeToValue?: number; // in days
  lastActivityAt: Date;
}

export interface OnboardingMilestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  actualDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'missed';
  requirements: string[];
  achievements?: string[];
  rewards?: MilestoneReward[];
}

export interface MilestoneReward {
  type: 'feature_unlock' | 'credits' | 'support_upgrade' | 'swag' | 'discount';
  description: string;
  value?: any;
}

export interface OnboardingTimeline {
  startedAt?: Date;
  accountSetupCompletedAt?: Date;
  teamSetupCompletedAt?: Date;
  firstProjectCreatedAt?: Date;
  firstApiCallAt?: Date;
  firstCodeGeneratedAt?: Date;
  valueAchievedAt?: Date; // When customer gets first value
  completedAt?: Date;
  expectedDuration: number; // in days
  actualDuration?: number; // in days
  checkpoints: TimelineCheckpoint[];
}

export interface TimelineCheckpoint {
  date: Date;
  description: string;
  status: 'upcoming' | 'passed' | 'missed';
  actions: string[];
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  customerTypes: CustomerType[];
  steps: TemplateStep[];
  milestones: TemplateMilestone[];
  estimatedDuration: number; // in days
  playbooks: string[]; // playbook IDs
  customizable: boolean;
  isActive: boolean;
  version: number;
}

export interface TemplateStep {
  id: string;
  name: string;
  description: string;
  order: number;
  category: OnboardingStepCategory;
  required: boolean;
  estimatedDuration: number;
  dependencies: string[];
  resources: OnboardingResource[];
  successCriteria: string[];
}

export interface TemplateMilestone {
  name: string;
  description: string;
  dayNumber: number; // from start
  requirements: string[];
  rewards?: MilestoneReward[];
}

export interface OnboardingSession {
  id: string;
  workflowId: string;
  customerId: string;
  stepId: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in seconds
  actions: SessionAction[];
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface SessionAction {
  type: 'view' | 'click' | 'input' | 'submit' | 'error' | 'help_request' | 'skip';
  timestamp: Date;
  element?: string;
  details?: Record<string, any>;
}

export interface OnboardingAnalytics {
  workflowId: string;
  customerId: string;
  metrics: OnboardingMetrics;
  funnelMetrics: FunnelMetrics;
  engagementMetrics: EngagementMetrics;
  timeMetrics: TimeMetrics;
  completionMetrics: CompletionMetrics;
  dropOffPoints: DropOffPoint[];
  recommendations: string[];
}

export interface OnboardingMetrics {
  totalSteps: number;
  completedSteps: number;
  completionRate: number;
  averageStepDuration: number;
  totalDuration: number;
  skippedSteps: number;
  failedSteps: number;
  helpRequests: number;
}

export interface FunnelMetrics {
  started: number;
  accountSetup: number;
  teamSetup: number;
  firstProject: number;
  firstApiCall: number;
  firstCodeGeneration: number;
  completed: number;
  conversionRates: Record<string, number>;
}

export interface EngagementMetrics {
  sessionCount: number;
  totalSessionDuration: number;
  averageSessionDuration: number;
  actionsPerSession: number;
  resourceViews: number;
  helpRequests: number;
  engagementScore: number; // 0-100
}

export interface TimeMetrics {
  timeToFirstProject: number; // in hours
  timeToFirstApiCall: number; // in hours
  timeToFirstCodeGeneration: number; // in hours
  timeToValue: number; // in days
  averageTimeBetweenSteps: number; // in hours
  totalOnboardingTime: number; // in days
}

export interface CompletionMetrics {
  overallCompletionRate: number;
  requiredStepsCompletionRate: number;
  optionalStepsCompletionRate: number;
  categoryCompletionRates: Record<OnboardingStepCategory, number>;
  milestoneAchievementRate: number;
}

export interface DropOffPoint {
  stepId: string;
  stepName: string;
  dropOffCount: number;
  dropOffRate: number;
  averageTimeAtStep: number;
  commonReasons: string[];
  suggestedActions: string[];
}

export interface OnboardingConfiguration {
  enableSkip: boolean;
  allowCustomization: boolean;
  requireMilestones: boolean;
  autoProgression: boolean;
  reminderSchedule: ReminderSchedule[];
  notifications: NotificationSettings;
  supportSettings: SupportSettings;
  integrations: IntegrationSettings;
}

export interface ReminderSchedule {
  trigger: 'time_based' | 'activity_based' | 'milestone_based';
  interval?: number; // for time_based (hours)
  inactivityThreshold?: number; // for activity_based (hours)
  milestone?: string; // for milestone_based
  channels: ('email' | 'in_app' | 'push' | 'sms')[];
  template: string;
}

export interface NotificationSettings {
  email: boolean;
  inApp: boolean;
  push: boolean;
  sms: boolean;
  frequency: 'immediate' | 'daily' | 'weekly' | 'milestone';
}

export interface SupportSettings {
  autoOfferHelp: boolean;
  helpThreshold: number; // minutes of inactivity
  embeddedSupport: boolean;
  videoSupport: boolean;
  chatSupport: boolean;
}

export interface IntegrationSettings {
  crm: boolean;
  analytics: boolean;
  support: boolean;
  communication: boolean;
}

export interface OnboardingRecommendation {
  customerId: string;
  workflowId: string;
  type: 'next_step' | 'resource' | 'support' | 'intervention' | 'celebration';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  actionUrl?: string;
  actionType?: 'navigation' | 'modal' | 'side_panel' | 'notification';
  metadata?: Record<string, any>;
  expiresAt?: Date;
  dismissed: boolean;
  createdAt: Date;
}
