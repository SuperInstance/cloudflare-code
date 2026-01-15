/**
 * Core type definitions for the Error Tracking System
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum ErrorCategory {
  RUNTIME = 'runtime',
  SYNTAX = 'syntax',
  TYPE = 'type',
  REFERENCE = 'reference',
  RANGE = 'range',
  NETWORK = 'network',
  API = 'api',
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  INTEGRATION = 'integration',
  PERFORMANCE = 'performance',
  MEMORY = 'memory',
  CONCURRENCY = 'concurrency',
  UNKNOWN = 'unknown'
}

export enum ErrorPriority {
  P0 = 0, // Critical - System down
  P1 = 1, // High - Major functionality broken
  P2 = 2, // Medium - Workaround available
  P3 = 3, // Low - Minor issue
  P4 = 4  // Trivial - Cosmetic or edge case
}

export enum ErrorStatus {
  NEW = 'new',
  INVESTIGATING = 'investigating',
  IDENTIFIED = 'identified',
  FIXING = 'fixing',
  VERIFYING = 'verifying',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
  FALSE_POSITIVE = 'false_positive'
}

// ============================================================================
// Core Interfaces
// ============================================================================

export interface ErrorContext {
  userAgent?: string;
  language?: string;
  platform?: string;
  screenSize?: { width: number; height: number };
  viewportSize?: { width: number; height: number };
  timezone?: string;
  locale?: string;
  url?: string;
  route?: string;
  referrer?: string;
  [key: string]: any;
}

export interface StackFrame {
  filename?: string;
  functionName?: string;
  lineNumber?: number;
  columnNumber?: number;
  source?: string;
  context?: {
    pre?: string[];
    post?: string[];
    line?: string;
  };
}

export interface Breadcrumb {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: Record<string, any>;
  type?: 'default' | 'http' | 'navigation' | 'user' | 'console';
}

export interface User {
  id?: string;
  email?: string;
  username?: string;
  name?: string;
  ipAddress?: string;
  segment?: string;
  roles?: string[];
  metadata?: Record<string, any>;
}

export interface RequestInfo {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, any>;
  params?: Record<string, any>;
  cookies?: Record<string, string>;
}

export interface CustomData {
  [key: string]: any;
}

export interface Attachment {
  name: string;
  type: string;
  data: string | Buffer;
  size?: number;
}

export interface ErrorEvent {
  id: string;
  timestamp: number;
  error: Error | string;
  type: string;
  message: string;
  stack?: string;
  stackFrames?: StackFrame[];
  severity: ErrorSeverity;
  category: ErrorCategory;
  priority: ErrorPriority;
  status: ErrorStatus;
  context: ErrorContext;
  breadcrumbs: Breadcrumb[];
  user?: User;
  request?: RequestInfo;
  customData?: CustomData;
  attachments?: Attachment[];
  tags?: Record<string, string>;
  fingerprint?: string;
  groupId?: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  affectedUsers: number;
  handled: boolean;
  environment: string;
  release?: string;
  distribution?: string;
  serverName?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
}

export interface ErrorGroup {
  id: string;
  fingerprint: string;
  title: string;
  type: string;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  priority: ErrorPriority;
  status: ErrorStatus;
  firstSeen: number;
  lastSeen: number;
  occurrences: number;
  affectedUsers: number;
  errors: ErrorEvent[];
  patterns: string[];
  potentialCauses: string[];
  suggestedFixes: string[];
  relatedIssues: string[];
  metadata: Record<string, any>;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface ErrorFrequency {
  errorType: string;
  count: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
}

export interface ErrorImpact {
  affectedUsers: number;
  affectedSessions: number;
  totalErrors: number;
  errorRate: number;
  severityDistribution: Record<ErrorSeverity, number>;
  categoryDistribution: Record<ErrorCategory, number>;
}

export interface ErrorTrend {
  period: string;
  timestamp: number;
  totalErrors: number;
  uniqueErrors: number;
  errorRate: number;
  topErrors: Array<{
    type: string;
    count: number;
  }>;
}

export interface ErrorPattern {
  pattern: string;
  type: 'temporal' | 'sequential' | 'correlated' | 'cyclical';
  description: string;
  confidence: number;
  occurrences: number;
  examples: ErrorEvent[];
  relatedPatterns?: string[];
}

export interface RootCauseAnalysis {
  errorId: string;
  rootCause: string;
  confidence: number;
  evidence: string[];
  contributingFactors: string[];
  suggestedActions: string[];
  relatedErrors: string[];
  analysisDepth: 'shallow' | 'medium' | 'deep';
}

// ============================================================================
// Alerting Types
// ============================================================================

export enum AlertType {
  THRESHOLD = 'threshold',
  ANOMALY = 'anomaly',
  SPIKE = 'spike',
  NEW_ERROR = 'new_error',
  REGRESSION = 'regression',
  AVAILABILITY = 'availability',
  PERFORMANCE = 'performance',
  CUSTOM = 'custom'
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  type: AlertType;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldown?: number;
  throttleWindow?: number;
  maxAlertsPerWindow?: number;
  groupBy?: string[];
  filters?: ErrorFilter[];
  metadata?: Record<string, any>;
}

export interface AlertCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: any;
  duration?: number;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty' | 'custom';
  config: Record<string, any>;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  type: AlertType;
  severity: AlertSeverity;
  status: 'triggered' | 'acknowledged' | 'resolved' | 'suppressed';
  timestamp: number;
  triggerData: {
    errorId: string;
    errorType: string;
    errorMessage: string;
    matchDetails: Record<string, any>;
  };
  occurrences: number;
  affectedUsers: number;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolvedBy?: string;
  resolvedAt?: number;
  suppressUntil?: number;
  suppressReason?: string;
  notificationStatus: Record<string, 'sent' | 'failed' | 'pending'>;
  metadata?: Record<string, any>;
}

export interface AlertHistory {
  alertId: string;
  timestamp: number;
  action: 'triggered' | 'acknowledged' | 'resolved' | 'suppressed' | 'escalated';
  user?: string;
  details: Record<string, any>;
}

// ============================================================================
// Filtering Types
// ============================================================================

export interface ErrorFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex' | 'exists';
  value?: any;
  values?: any[];
}

export interface ErrorQuery {
  filters?: ErrorFilter[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  aggregation?: {
    field: string;
    operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
    groupBy?: string[];
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ErrorTrackingConfig {
  dsn?: string;
  environment: string;
  release?: string;
  distribution?: string;
  serverName?: string;
  debug?: boolean;
  sampleRate?: number;
  maxBreadcrumbs?: number;
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null | Promise<ErrorEvent | null>;
  beforeBreadcrumb?: (breadcrumb: Breadcrumb) => Breadcrumb | null;
  ignoreErrors?: (string | RegExp)[];
  ignoreUrls?: (string | RegExp)[];
  whitelistUrls?: (string | RegExp)[];
  autoSessionTracking?: boolean;
  captureUnhandledRejections?: boolean;
  captureConsole?: boolean;
  captureHttpRequests?: boolean;
  captureUserFeedback?: boolean;
  maxEventQueueSize?: number;
  flushTimeout?: number;
  retryAttempts?: number;
  enableStackCapture?: boolean;
  enableContextCapture?: boolean;
  enableScreenshotCapture?: boolean;
  enablePerformanceMonitoring?: boolean;
  integrations?: Integration[];
  tracesSampleRate?: number;
  environmentVariable?: string;
  proxy?: string;
  timeout?: number;
  headers?: Record<string, string>;
  caCerts?: string[];
}

export interface Integration {
  name: string;
  setup?: (config: ErrorTrackingConfig) => void;
  processEvent?: (event: ErrorEvent) => ErrorEvent | null;
  processException?: (exception: any) => void;
  processMessage?: (message: string) => void;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageAdapter {
  init(): Promise<void>;
  storeError(error: ErrorEvent): Promise<void>;
  getError(id: string): Promise<ErrorEvent | null>;
  getErrors(query?: ErrorQuery): Promise<ErrorEvent[]>;
  updateError(id: string, updates: Partial<ErrorEvent>): Promise<void>;
  deleteError(id: string): Promise<void>;
  getGroupedErrors(fingerprint: string): Promise<ErrorEvent[]>;
  createGroup(group: ErrorGroup): Promise<void>;
  getGroup(id: string): Promise<ErrorGroup | null>;
  getGroups(query?: ErrorQuery): Promise<ErrorGroup[]>;
  updateGroup(id: string, updates: Partial<ErrorGroup>): Promise<void>;
  deleteGroup(id: string): Promise<void>;
  searchErrors(searchTerm: string, query?: ErrorQuery): Promise<ErrorEvent[]>;
  getErrorTrends(period: string, limit?: number): Promise<ErrorTrend[]>;
  getErrorFrequencies(period: string, limit?: number): Promise<ErrorFrequency[]>;
  getErrorImpact(period: string): Promise<ErrorImpact>;
  storeAlert(alert: Alert): Promise<void>;
  getAlert(id: string): Promise<Alert | null>;
  getAlerts(query?: ErrorQuery): Promise<Alert[]>;
  updateAlert(id: string, updates: Partial<Alert>): Promise<void>;
  deleteAlert(id: string): Promise<void>;
  storeRule(rule: AlertRule): Promise<void>;
  getRule(id: string): Promise<AlertRule | null>;
  getRules(): Promise<AlertRule[]>;
  updateRule(id: string, updates: Partial<AlertRule>): Promise<void>;
  deleteRule(id: string): Promise<void>;
  cleanup(retentionDays: number): Promise<void>;
  close(): Promise<void>;
}

// ============================================================================
// SDK Interface
// ============================================================================

export interface ErrorTrackingSDK {
  captureException(error: Error, context?: Partial<ErrorEvent>): string;
  captureMessage(message: string, level?: ErrorEvent['level'], context?: Partial<ErrorEvent>): string;
  captureEvent(event: Partial<ErrorEvent>): string;
  captureBreadcrumb(breadcrumb: Breadcrumb): void;
  setUser(user: User | null): void;
  setContext(key: string, context: any): void;
  setTag(key: string, value: string): void;
  setTags(tags: Record<string, string>): void;
  setExtra(key: string, value: any): void;
  clearBreadcrumbs(): void;
  addAttachment(attachment: Attachment): void;
  withScope(callback: (scope: Scope) => void): void;
  configure(config: Partial<ErrorTrackingConfig>): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export interface Scope {
  setLevel(level: ErrorEvent['level']): void;
  setUser(user: User | null): void;
  setTag(key: string, value: string): void;
  setTags(tags: Record<string, string>): void;
  setExtra(key: string, value: any): void;
  setContext(key: string, context: any): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
  clearBreadcrumbs(): void;
  setFingerprint(fingerprint: string[]): void;
  addAttachment(attachment: Attachment): void;
  applyToEvent(event: ErrorEvent): ErrorEvent;
}

// ============================================================================
// Events
// ============================================================================

export interface ErrorTrackingEvents {
  'error:captured': (event: ErrorEvent) => void;
  'error:grouped': (group: ErrorGroup) => void;
  'error:analyzed': (analysis: RootCauseAnalysis) => void;
  'alert:triggered': (alert: Alert) => void;
  'alert:acknowledged': (alert: Alert) => void;
  'alert:resolved': (alert: Alert) => void;
  'before-send': (event: ErrorEvent) => ErrorEvent | null;
  'after-send': (event: ErrorEvent) => void;
  'send-failed': (event: ErrorEvent, error: Error) => void;
  'breadcrumb': (breadcrumb: Breadcrumb) => void;
}

export declare interface ErrorTrackingEmitter {
  on<K extends keyof ErrorTrackingEvents>(
    event: K,
    listener: ErrorTrackingEvents[K]
  ): this;
  off<K extends keyof ErrorTrackingEvents>(
    event: K,
    listener: ErrorTrackingEvents[K]
  ): this;
  emit<K extends keyof ErrorTrackingEvents>(
    event: K,
    ...args: Parameters<ErrorTrackingEvents[K]>
  ): boolean;
}

// ============================================================================
// Statistics & Metrics
// ============================================================================

export interface ErrorStatistics {
  totalErrors: number;
  uniqueErrors: number;
  totalGroups: number;
  errorRate: number;
  averageResolutionTime: number;
  topErrorTypes: Array<{
    type: string;
    count: number;
  }>;
  severityDistribution: Record<ErrorSeverity, number>;
  categoryDistribution: Record<ErrorCategory, number>;
  statusDistribution: Record<ErrorStatus, number>;
  timeSeries: Array<{
    timestamp: number;
    count: number;
  }>;
}

export interface PerformanceMetrics {
  captureLatency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  processingLatency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  alertLatency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  storageLatency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
}

// ============================================================================
// Export Base Classes
// ============================================================================

export class ErrorTrackingEventEmitter extends EventEmitter implements ErrorTrackingEmitter {
  on<K extends keyof ErrorTrackingEvents>(
    event: K,
    listener: ErrorTrackingEvents[K]
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof ErrorTrackingEvents>(
    event: K,
    listener: ErrorTrackingEvents[K]
  ): this {
    return super.off(event, listener);
  }

  emit<K extends keyof ErrorTrackingEvents>(
    event: K,
    ...args: Parameters<ErrorTrackingEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
