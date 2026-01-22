/**
 * Core type definitions for the Email Service
 */

/**
 * Email provider types supported by the system
 */
export enum EmailProvider {
  SMTP = 'smtp',
  SENDGRID = 'sendgrid',
  SES = 'ses',
  MAILGUN = 'mailgun',
  POSTMARK = 'postmark'
}

/**
 * Email priority levels
 */
export enum EmailPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low'
}

/**
 * Email status throughout the delivery lifecycle
 */
export enum EmailStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  DEFERRED = 'deferred',
  FAILED = 'failed',
  OPENED = 'opened',
  CLICKED = 'clicked',
  COMPLAINED = 'complained'
}

/**
 * Bounce classification types
 */
export enum BounceType {
  HARD = 'hard',
  SOFT = 'soft',
  TRANSIENT = 'transient',
  UNKNOWN = 'unknown'
}

/**
 * Bounce categories for detailed classification
 */
export enum BounceCategory {
  INVALID_EMAIL = 'invalid_email',
  BOUNCED_MAILBOX = 'bounced_mailbox',
  FULL_MAILBOX = 'full_mailbox',
  BLOCKED = 'blocked',
  SPAM = 'spam',
  TECHNICAL = 'technical',
  UNKNOWN = 'unknown'
}

/**
 * Template types supported by the template engine
 */
export enum TemplateType {
  HTML = 'html',
  TEXT = 'text',
  MJML = 'mjml',
  HANDLEBARS = 'handlebars'
}

/**
 * Email address structure
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * Email attachment structure
 */
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  encoding?: string;
  contentType?: string;
  cid?: string;
}

/**
 * Core email message structure
 */
export interface EmailMessage {
  id: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  metadata?: Record<string, any>;
  priority?: EmailPriority;
  scheduledAt?: Date;
  trackOpens?: boolean;
  trackClicks?: boolean;
  provider?: EmailProvider;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Email delivery result
 */
export interface DeliveryResult {
  success: boolean;
  messageId: string;
  provider: EmailProvider;
  providerMessageId?: string;
  status: EmailStatus;
  error?: Error;
  timestamp: Date;
  retryable?: boolean;
}

/**
 * Email tracking data
 */
export interface EmailTracking {
  emailId: string;
  messageId: string;
  recipient: string;
  trackingId: string;
  openedAt?: Date;
  clickedAt?: Date;
  clickCount?: number;
  openCount?: number;
  userAgent?: string;
  ipAddress?: string;
  device?: string;
  location?: string;
}

/**
 * Email statistics aggregate
 */
export interface EmailStatistics {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  deferred: number;
  failed: number;
  complained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
}

/**
 * Bounce information
 */
export interface BounceInfo {
  emailId: string;
  recipient: string;
  type: BounceType;
  category: BounceCategory;
  reason: string;
  bouncedAt: Date;
  provider?: EmailProvider;
  providerCode?: string;
  diagnosticCode?: string;
  retryable?: boolean;
}

/**
 * Email list structure
 */
export interface EmailList {
  id: string;
  name: string;
  description?: string;
  subscribers: number;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * List subscriber structure
 */
export interface ListSubscriber {
  id: string;
  listId: string;
  email: string;
  name?: string;
  status: SubscriptionStatus;
  subscribedAt: Date;
  unsubscribedAt?: Date;
  metadata?: Record<string, any>;
  tags?: string[];
}

/**
 * Subscription status
 */
export enum SubscriptionStatus {
  ACTIVE = 'active',
  UNSUBSCRIBED = 'unsubscribed',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
  PENDING = 'pending'
}

/**
 * Email template structure
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  type: TemplateType;
  content: string;
  textContent?: string;
  variables: TemplateVariable[];
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

/**
 * Template preview result
 */
export interface TemplatePreview {
  html: string;
  text?: string;
  subject: string;
  renderedAt: Date;
  errors?: string[];
}

/**
 * Email provider configuration
 */
export interface ProviderConfig {
  type: EmailProvider;
  enabled: boolean;
  priority: number;
  rateLimit?: number;
  credentials: Record<string, any>;
}

/**
 * SMTP configuration
 */
export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

/**
 * SendGrid configuration
 */
export interface SendGridConfig {
  apiKey: string;
  endpoint?: string;
}

/**
 * AWS SES configuration
 */
export interface SESConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint?: string;
}

/**
 * Mailgun configuration
 */
export interface MailgunConfig {
  apiKey: string;
  domain: string;
  endpoint?: string;
  eu?: boolean;
}

/**
 * Postmark configuration
 */
export interface PostmarkConfig {
  serverToken: string;
  endpoint?: string;
}

/**
 * Security configuration (SPF/DKIM/DMARC)
 */
export interface SecurityConfig {
  domain: string;
  spf?: SPFConfig;
  dkim?: DKIMConfig;
  dmarc?: DMARCConfig;
}

/**
 * SPF configuration
 */
export interface SPFConfig {
  enabled: boolean;
  mechanisms: string[];
  includeDomains?: string[];
  ipAddresses?: string[];
  all: '-all' | '~all' | '+all' | '?all';
}

/**
 * DKIM configuration
 */
export interface DKIMConfig {
  enabled: boolean;
  selector: string;
  privateKey: string;
  publicKey?: string;
  domain?: string;
}

/**
 * DMARC configuration
 */
export interface DMARCConfig {
  enabled: boolean;
  policy: 'none' | 'quarantine' | 'reject';
  subdomainPolicy?: 'none' | 'quarantine' | 'reject';
  percentage?: number;
  rua?: string[];
  ruf?: string[];
  alignment: 'r' | 's' | 'strict' | 'relaxed';
}

/**
 * Scheduled email information
 */
export interface ScheduledEmail {
  id: string;
  email: EmailMessage;
  scheduledAt: Date;
  status: EmailStatus;
  recurring?: RecurringConfig;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  nextRunAt?: Date;
}

/**
 * Recurring email configuration
 */
export interface RecurringConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval?: number;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  endDate?: Date;
  timezone?: string;
}

/**
 * Campaign analytics
 */
export interface CampaignAnalytics {
  campaignId: string;
  name: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  revenue?: number;
  startDate: Date;
  endDate?: Date;
}

/**
 * Batch send result
 */
export interface BatchSendResult {
  total: number;
  successful: number;
  failed: number;
  results: DeliveryResult[];
  errors: Error[];
  duration: number;
}

/**
 * List segmentation criteria
 */
export interface SegmentationCriteria {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'notIn';
  value: any;
}

/**
 * List segment
 */
export interface ListSegment {
  id: string;
  listId: string;
  name: string;
  criteria: SegmentationCriteria[];
  subscriberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Drip campaign configuration
 */
export interface DripCampaign {
  id: string;
  name: string;
  listId: string;
  steps: DripStep[];
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Drip campaign step
 */
export interface DripStep {
  id: string;
  templateId: string;
  delay: number;
  delayUnit: 'minutes' | 'hours' | 'days';
  order: number;
  subject?: string;
}

/**
 * Email provider health status
 */
export interface ProviderHealth {
  provider: EmailProvider;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  successRate: number;
  errorRate: number;
  lastChecked: Date;
}

/**
 * Send time optimization result
 */
export interface SendTimeOptimization {
  recommendedTime: Date;
  confidence: number;
  timezone: string;
  reason: string;
}
