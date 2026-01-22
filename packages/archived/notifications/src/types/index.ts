/**
 * Type definitions for the notification system
 */

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationChannelType =
  | 'email'
  | 'sms'
  | 'push'
  | 'slack'
  | 'discord'
  | 'webhook'
  | 'in_app';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

export type NotificationCategory =
  | 'system'
  | 'security'
  | 'billing'
  | 'deployment'
  | 'performance'
  | 'alert'
  | 'social'
  | 'marketing'
  | 'workflow'
  | 'custom';

export type NotificationStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'retrying'
  | 'cancelled';

export type DeliveryStatus =
  | 'pending'
  | 'in_progress'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'delayed'
  | 'accepted'
  | 'rejected';

export type EscalationStatus = 'pending' | 'escalating' | 'escalated' | 'resolved' | 'cancelled';

export type RateLimitStrategy = 'fixed_window' | 'sliding_window' | 'token_bucket' | 'leaky_bucket';

// ============================================================================
// Core Interfaces
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  channel: NotificationChannelType;
  priority: NotificationPriority;
  category: NotificationCategory;
  status: NotificationStatus;
  subject?: string;
  content: string;
  htmlContent?: string;
  data?: Record<string, unknown>;
  metadata?: NotificationMetadata;
  createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date;
  expiresAt?: Date;
  retryCount?: number;
  maxRetries?: number;
}

export interface NotificationMetadata extends Record<string, unknown> {
  source?: string;
  correlationId?: string;
  tags?: string[];
  templateId?: string;
  templateVersion?: number;
  locale?: string;
  timezone?: string;
}

export interface NotificationRecipient {
  id: string;
  userId: string;
  type: NotificationChannelType;
  address: string;
  verified: boolean;
  primary: boolean;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  category: NotificationCategory;
  channel: NotificationChannelType;
  subject?: string;
  content: string;
  htmlContent?: string;
  variables: TemplateVariable[];
  locale: string;
  version: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  parentTemplateId?: string;
  inheritFrom?: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  defaultValue?: unknown;
  description?: string;
}

export interface DeliveryReceipt {
  id: string;
  notificationId: string;
  channelId: string;
  status: DeliveryStatus;
  attempts: number;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  errorCode?: string;
  providerMessageId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Alert Types
// ============================================================================

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  type: string;
  priority: NotificationPriority;
  data?: Record<string, unknown>;
  metadata?: AlertMetadata;
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  assignedTo?: string;
}

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical' | 'fatal';

export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'closed' | 'escalating';

export interface AlertMetadata {
  correlationId?: string;
  sourceId?: string;
  tags?: string[];
  environment?: string;
  service?: string;
  host?: string;
}

// ============================================================================
// Routing Types
// ============================================================================

export interface AlertRoute {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: RouteCondition[];
  actions: RouteAction[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteCondition {
  type: 'severity' | 'source' | 'type' | 'tag' | 'time' | 'custom';
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'gt' | 'lt' | 'between';
  value: unknown;
  field?: string;
}

export interface RouteAction {
  type: 'notify' | 'escalate' | 'group' | 'delay' | 'transform' | 'filter';
  config: Record<string, unknown>;
}

export interface EscalationPath {
  id: string;
  name: string;
  levels: EscalationLevel[];
  timeoutMinutes: number;
  repeatEnabled: boolean;
  maxEscalations: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationLevel {
  order: number;
  userId: string;
  roleId?: string;
  channels: NotificationChannelType[];
  timeoutMinutes?: number;
}

export interface OnCallRotation {
  id: string;
  name: string;
  description?: string;
  schedule: OnCallSchedule;
  members: OnCallMember[];
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnCallSchedule {
  type: 'daily' | 'weekly' | 'custom';
  rotationDays?: number[];
  startTime: string;
  endTime: string;
  handoverTime?: string;
}

export interface OnCallMember {
  userId: string;
  order: number;
  primaryContact: NotificationChannelType;
  backupContact?: NotificationChannelType;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimit {
  id: string;
  identifier: string;
  channel: NotificationChannelType;
  strategy: RateLimitStrategy;
  limit: number;
  windowMs: number;
  burstLimit?: number;
  priority: NotificationPriority;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitState {
  identifier: string;
  channel: NotificationChannelType;
  count: number;
  resetAt: Date;
  burstCount?: number;
  lastRequestAt: Date;
}

// ============================================================================
// Preference Types
// ============================================================================

export interface NotificationPreferences {
  userId: string;
  channels: ChannelPreferences;
  categories: CategoryPreferences;
  schedule: SchedulePreferences;
  grouping: GroupingPreferences;
  doNotDisturb: DoNotDisturbPreferences;
  locale: string;
  timezone: string;
  updatedAt: Date;
}

export interface ChannelPreferences {
  email: ChannelPreference;
  sms: ChannelPreference;
  push: ChannelPreference;
  slack: ChannelPreference;
  discord: ChannelPreference;
  webhook: ChannelPreference;
  in_app: ChannelPreference;
}

export interface ChannelPreference {
  enabled: boolean;
  priority?: NotificationPriority;
  threshold?: NotificationPriority;
}

export interface CategoryPreferences {
  system: CategoryPreference;
  security: CategoryPreference;
  billing: CategoryPreference;
  deployment: CategoryPreference;
  performance: CategoryPreference;
  alert: CategoryPreference;
  social: CategoryPreference;
  marketing: CategoryPreference;
  workflow: CategoryPreference;
}

export interface CategoryPreference {
  enabled: boolean;
  channels: NotificationChannelType[];
  priority?: NotificationPriority;
  quietHours?: boolean;
}

export interface SchedulePreferences {
  enabled: boolean;
  schedules: TimeSchedule[];
}

export interface TimeSchedule {
  id: string;
  name: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  channels: NotificationChannelType[];
  categories: NotificationCategory[];
}

export interface GroupingPreferences {
  enabled: boolean;
  windowMinutes: number;
  maxGroupSize: number;
  channels: NotificationChannelType[];
}

export interface DoNotDisturbPreferences {
  enabled: boolean;
  schedules: DndSchedule[];
  overrideUrgent: boolean;
  overrideCritical: boolean;
}

export interface DndSchedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  timezone?: string;
}

// ============================================================================
// Delivery Types
// ============================================================================

export interface DeliveryAttempt {
  id: string;
  notificationId: string;
  channelId: string;
  attemptNumber: number;
  status: DeliveryStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  success: boolean;
  errorMessage?: string;
  errorCode?: string;
  retryAfter?: Date;
  metadata?: Record<string, unknown>;
}

export interface DeliveryMetrics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalBounced: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  channelMetrics: Record<string, ChannelMetrics>;
  dailyMetrics: DailyMetrics[];
}

export interface ChannelMetrics {
  channel: NotificationChannelType;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  deliveryRate: number;
  averageTime: number;
}

export interface DailyMetrics {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  deliveryRate: number;
}

export interface BounceRecord {
  id: string;
  recipientId: string;
  channel: NotificationChannelType;
  type: 'hard' | 'soft';
  reason: string;
  errorCode?: string;
  bounceDate: Date;
  cleaned: boolean;
}

// ============================================================================
// Escalation Types
// ============================================================================

export interface Escalation {
  id: string;
  alertId: string;
  pathId: string;
  currentLevel: number;
  status: EscalationStatus;
  startedAt: Date;
  escalatedAt?: Date;
  completedAt?: Date;
  timeoutAt: Date;
  history: EscalationHistoryEntry[];
  notifications: string[];
}

export interface EscalationHistoryEntry {
  level: number;
  userId: string;
  action: 'notified' | 'acknowledged' | 'timeout' | 'escalated';
  timestamp: Date;
  note?: string;
}

export interface EscalationRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: EscalationCondition[];
  pathId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationCondition {
  type: 'severity' | 'status' | 'time' | 'unacknowledged' | 'custom';
  operator: 'equals' | 'gt' | 'lt' | 'contains' | 'matches';
  value: unknown;
  durationMinutes?: number;
}

// ============================================================================
// Provider Types
// ============================================================================

export interface EmailProvider {
  type: 'smtp' | 'sendgrid' | 'ses' | 'mailgun' | 'postmark';
  config: EmailProviderConfig;
}

export interface EmailProviderConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  apiKey?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
}

export interface SmsProvider {
  type: 'twilio' | 'aws_sns' | 'messagebird' | 'nexmo';
  config: SmsProviderConfig;
}

export interface SmsProviderConfig {
  accountSid?: string;
  authToken?: string;
  apiKey?: string;
  fromNumber: string;
}

export interface PushProvider {
  type: 'fcm' | 'apns' | 'onesignal' | 'airship';
  config: PushProviderConfig;
}

export interface PushProviderConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  privateKey?: string;
  clientEmail?: string;
  certificate?: string;
  keyId?: string;
  teamId?: string;
  bundleId?: string;
}

export interface WebhookProvider {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface SlackProvider {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface DiscordProvider {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface NotificationAnalytics {
  period: AnalyticsPeriod;
  summary: AnalyticsSummary;
  channels: ChannelAnalytics[];
  categories: CategoryAnalytics[];
  trends: AnalyticsTrend[];
  topUsers: UserAnalytics[];
}

export type AnalyticsPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface AnalyticsSummary {
  totalNotifications: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  uniqueUsers: number;
}

export interface ChannelAnalytics {
  channel: NotificationChannelType;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  averageTime: number;
}

export interface CategoryAnalytics {
  category: NotificationCategory;
  sent: number;
  delivered: number;
  failed: number;
  openRate?: number;
  clickRate?: number;
}

export interface AnalyticsTrend {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

export interface UserAnalytics {
  userId: string;
  sent: number;
  delivered: number;
  failed: number;
  openRate?: number;
}

// ============================================================================
// Durable Object Types
// ============================================================================

export interface NotificationDurableObjectState {
  notifications: Map<string, Notification>;
  receipts: Map<string, DeliveryReceipt>;
  metrics: DeliveryMetrics;
  lastUpdated: Date;
}

export interface AlertDurableObjectState {
  alerts: Map<string, Alert>;
  routes: Map<string, AlertRoute>;
  escalations: Map<string, Escalation>;
  lastUpdated: Date;
}

export interface RateLimitDurableObjectState {
  limits: Map<string, RateLimitState>;
  lastUpdated: Date;
}

export interface PreferencesDurableObjectState {
  preferences: Map<string, NotificationPreferences>;
  lastUpdated: Date;
}

// ============================================================================
// Error Types
// ============================================================================

export class NotificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

export class DeliveryError extends NotificationError {
  constructor(
    message: string,
    code: string,
    public recipientId: string,
    public channelId: string,
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = 'DeliveryError';
  }
}

export class RateLimitError extends NotificationError {
  constructor(
    message: string,
    public retryAfter: Date,
    details?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', details);
    this.name = 'RateLimitError';
  }
}

export class TemplateError extends NotificationError {
  constructor(
    message: string,
    public templateId: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'TEMPLATE_ERROR', details);
    this.name = 'TemplateError';
  }
}

export class EscalationError extends NotificationError {
  constructor(
    message: string,
    public escalationId: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'ESCALATION_ERROR', details);
    this.name = 'EscalationError';
  }
}

// ============================================================================
// Channel Types
// ============================================================================

export interface ChannelDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  averageDeliveryTime: number;
  lastDeliveryAt?: Date;
}

export interface ChannelDeliveryOptions {
  timeout?: number;
  priority?: number;
  retryable?: boolean;
}
