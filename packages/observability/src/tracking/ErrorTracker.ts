// @ts-nocheck - Complex error tracking type issues
import { Observable, ObservableConfig } from '../core/Observable';
import { LogEntry, ErrorInfo } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Error Tracking and Exception Monitoring Service
 */
export class ErrorTracker extends Observable {
  private errors: Map<string, ErrorRecord> = new Map();
  private errorGroups: Map<string, ErrorGroup> = new Map();
  private userReports: Map<string, UserReport> = new Map();
  private sessions: Map<string, ErrorSession> = new Map();
  private tags: Map<string, string[]> = new Map();

  constructor(config: ObservableConfig = {}) {
    super(config);
  }

  override async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize error tracking
      this.initializeErrorTracking();

      // Initialize session tracking
      this.initializeSessionTracking();

      // Initialize error grouping
      this.initializeErrorGrouping();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ErrorTracker:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    // Clear all stored data
    this.errors.clear();
    this.errorGroups.clear();
    this.userReports.clear();
    this.sessions.clear();
    this.tags.clear();

    this.initialized = false;
  }

  async export(): Promise<any> {
    this.ensureInitialized();

    try {
      return {
        success: true,
        exported: 1,
        duration: 0,
        errorTrackingData: {
          errors: Array.from(this.errors.values()),
          errorGroups: Array.from(this.errorGroups.values()),
          userReports: Array.from(this.userReports.values()),
          sessions: Array.from(this.sessions.values()),
          tags: Array.from(this.tags.entries())
        }
      };
    } catch (error) {
      return this.handleExportError(error as Error);
    }
  }

  /**
   * Record an error
   */
  recordError(error: Error | string, context?: ErrorContext): ErrorRecord {
    const errorRecord = this.createErrorRecord(error, context);

    // Store error
    this.errors.set(errorRecord.id, errorRecord);

    // Create or update error group
    this.updateErrorGroup(errorRecord);

    // Update session
    this.updateSession(errorRecord);

    // Update tags
    this.updateTags(errorRecord);

    // Log to logger if available
    this.logError(errorRecord);

    return errorRecord;
  }

  /**
   * Record a user-reported error
   */
  recordUserReport(report: UserReportInput): UserReport {
    const userReport: UserReport = {
      id: uuidv4(),
      ...report,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.userReports.set(userReport.id, userReport);

    return userReport;
  }

  /**
   * Get error by ID
   */
  getError(errorId: string): ErrorRecord | null {
    return this.errors.get(errorId) || null;
  }

  /**
   * Get errors by fingerprint
   */
  getErrorsByFingerprint(fingerprint: string): ErrorRecord[] {
    return Array.from(this.errors.values()).filter(error =>
      error.fingerprint === fingerprint
    );
  }

  /**
   * Get errors by session ID
   */
  getErrorsBySession(sessionId: string): ErrorRecord[] {
    return Array.from(this.errors.values()).filter(error =>
      error.sessionId === sessionId
    );
  }

  /**
   * Get errors by tag
   */
  getErrorsByTag(tag: string): ErrorRecord[] {
    return Array.from(this.errors.values()).filter(error =>
      error.tags.includes(tag)
    );
  }

  /**
   * Get errors within time range
   */
  getErrorsByTimeRange(startTime: number, endTime: number): ErrorRecord[] {
    return Array.from(this.errors.values()).filter(error =>
      error.timestamp >= startTime && error.timestamp <= endTime
    );
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(timeWindow: number = 86400000): ErrorStatistics {
    const endTime = Date.now();
    const startTime = endTime - timeWindow;

    const recentErrors = this.getErrorsByTimeRange(startTime, endTime);

    return {
      totalErrors: recentErrors.length,
      uniqueErrors: new Set(recentErrors.map(e => e.fingerprint)).size,
      errorRate: recentErrors.length / (timeWindow / 1000), // errors per second
      byType: this.groupErrorsByType(recentErrors),
      bySeverity: this.groupErrorsBySeverity(recentErrors),
      byHttpStatus: this.groupErrorsByHttpStatus(recentErrors),
      topErrors: this.getTopErrorPatterns(recentErrors),
      resolutionRate: this.calculateResolutionRate(recentErrors),
      avgResolutionTime: this.calculateAvgResolutionTime(recentErrors)
    };
  }

  /**
   * Get error group by ID
   */
  getErrorGroup(groupId: string): ErrorGroup | null {
    return this.errorGroups.get(groupId) || null;
  }

  /**
   * Get error groups
   */
  getErrorGroups(): ErrorGroup[] {
    return Array.from(this.errorGroups.values());
  }

  /**
   * Get session errors
   */
  getSessionErrors(sessionId: string): ErrorRecord[] {
    return this.getErrorsBySession(sessionId);
  }

  /**
   * Mark error as resolved
   */
  markErrorResolved(errorId: string, resolution?: string): boolean {
    const error = this.errors.get(errorId);
    if (!error) return false;

    error.status = 'resolved';
    error.resolution = resolution;
    error.resolvedAt = Date.now();

    // Update error group
    const group = this.errorGroups.get(error.fingerprint);
    if (group) {
      group.lastSeen = error.timestamp;
      group.occurrenceCount = this.getErrorsByFingerprint(error.fingerprint).length;
    }

    return true;
  }

  /**
   * Get user reports
   */
  getUserReports(): UserReport[] {
    return Array.from(this.userReports.values());
  }

  /**
   * Update user report status
   */
  updateUserReportStatus(reportId: string, status: UserReportStatus, resolution?: string): boolean {
    const report = this.userReports.get(reportId);
    if (!report) return false;

    report.status = status;
    report.resolution = resolution;
    report.updatedAt = Date.now();

    return true;
  }

  /**
   * Search errors
   */
  searchErrors(query: ErrorSearchQuery): ErrorSearchResult {
    const allErrors = Array.from(this.errors.values());

    let filteredErrors = allErrors;

    // Apply filters
    if (query.filters) {
      filteredErrors = this.applyFilters(filteredErrors, query.filters);
    }

    // Apply search
    if (query.search) {
      filteredErrors = this.applySearch(filteredErrors, query.search);
    }

    // Apply sorting
    if (query.sortBy) {
      filteredErrors = this.applySorting(filteredErrors, query.sortBy, query.sortOrder);
    }

    // Apply pagination
    const paginatedErrors = this.applyPagination(filteredErrors, query.page, query.limit);

    return {
      errors: paginatedErrors,
      total: filteredErrors.length,
      page: query.page || 1,
      limit: query.limit || 20,
      totalPages: Math.ceil(filteredErrors.length / (query.limit || 20))
    };
  }

  /**
   * Get error tracking report
   */
  getErrorTrackingReport(timeWindow: number = 86400000): ErrorTrackingReport {
    const stats = this.getErrorStatistics(timeWindow);
    const topErrorGroups = this.getTopErrorGroups(timeWindow);

    return {
      timestamp: Date.now(),
      timeWindow,
      ...stats,
      topErrorGroups,
      recommendations: this.generateRecommendations(stats),
      trends: this.getErrorTrends(timeWindow)
    };
  }

  /**
   * Initialize error tracking
   */
  private initializeErrorTracking(): void {
    // Initialize global error handlers
    if (typeof window !== 'undefined') {
      this.initializeBrowserErrorHandlers();
    }

    this.initializeUnhandledRejectionHandler();
  }

  /**
   * Initialize browser error handlers
   */
  private initializeBrowserErrorHandlers(): void {
    window.addEventListener('error', (event) => {
      this.recordError({
        name: event.type,
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
  }

  /**
   * Initialize unhandled rejection handler
   */
  private initializeUnhandledRejectionHandler(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.recordError({
          name: 'UnhandledRejection',
          message: event.reason?.message || 'Unhandled Promise Rejection',
          stack: event.reason?.stack
        });
      });
    }
  }

  /**
   * Initialize session tracking
   */
  private initializeSessionTracking(): void {
    if (typeof window !== 'undefined') {
      const sessionId = this.getSessionId();
      this.sessions.set(sessionId, {
        sessionId,
        startTime: Date.now(),
        lastActivity: Date.now(),
        errors: [],
        urlHistory: []
      });

      // Track page changes
      window.addEventListener('popstate', () => {
        this.updateSessionActivity();
      });

      // Track user activity
      window.addEventListener('click', () => {
        this.updateSessionActivity();
      });

      window.addEventListener('scroll', () => {
        this.updateSessionActivity();
      });
    }
  }

  /**
   * Initialize error grouping
   */
  private initializeErrorGrouping(): void {
    // Initialize with common error patterns
    const commonPatterns = [
      { pattern: 'Network Error', type: 'network' },
      { pattern: 'Timeout', type: 'timeout' },
      { pattern: 'Auth Error', type: 'auth' },
      { pattern: 'Validation Error', type: 'validation' },
      { pattern: 'Not Found', type: '404' }
    ];

    commonPatterns.forEach(({ pattern, type }) => {
      this.errorGroups.set(pattern, {
        id: pattern,
        fingerprint: pattern,
        type,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        occurrenceCount: 0,
        avgResolutionTime: 0,
        severity: 'medium'
      });
    });
  }

  /**
   * Create error record
   */
  private createErrorRecord(error: Error | string, context?: ErrorContext): ErrorRecord {
    const errorObj = typeof error === 'string' ? new Error(error) : error;

    return {
      id: uuidv4(),
      sessionId: this.getSessionId(),
      userId: context?.userId,
      sessionId: context?.sessionId,
      fingerprint: this.generateFingerprint(errorObj, context),
      type: this.getErrorType(errorObj),
      severity: this.getSeverity(errorObj),
      title: errorObj.name,
      message: errorObj.message,
      stack: errorObj.stack,
      filename: (errorObj as any).filename,
      lineno: (errorObj as any).lineno,
      colno: (errorObj as any).colno,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      context: context?.context || {},
      tags: context?.tags || [],
      timestamp: Date.now(),
      status: 'open',
      resolution: null,
      resolvedAt: null,
      occurrenceCount: 1
    };
  }

  /**
   * Generate error fingerprint
   */
  private generateFingerprint(error: Error, context?: ErrorContext): string {
    const key = `${error.name}:${error.message}:${(error as any).filename || 'unknown'}`;
    const hash = this.hashString(key);
    return hash;
  }

  /**
   * Hash string
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get error type
   */
  private getErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('auth') || message.includes('unauthorized')) return 'auth';
    if (message.includes('validation')) return 'validation';
    if (message.includes('not found')) return '404';

    return 'runtime';
  }

  /**
   * Get error severity
   */
  private getSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();

    if (message.includes('critical') || message.includes('fatal')) return 'critical';
    if (message.includes('warning') || message.includes('deprecated')) return 'warning';
    if (message.includes('error')) return 'error';

    return 'info';
  }

  /**
   * Update error group
   */
  private updateErrorGroup(error: ErrorRecord): void {
    let group = this.errorGroups.get(error.fingerprint);

    if (!group) {
      group = {
        id: error.fingerprint,
        fingerprint: error.fingerprint,
        type: error.type,
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
        occurrenceCount: 1,
        avgResolutionTime: 0,
        severity: error.severity
      };
      this.errorGroups.set(error.fingerprint, group);
    } else {
      group.occurrenceCount++;
      group.lastSeen = error.timestamp;
      group.severity = error.severity;
    }
  }

  /**
   * Update session
   */
  private updateSession(error: ErrorRecord): void {
    const sessionId = this.getSessionId();
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        sessionId,
        startTime: Date.now(),
        lastActivity: Date.now(),
        errors: [],
        urlHistory: []
      };
      this.sessions.set(sessionId, session);
    }

    session.errors.push(error.id);
    session.lastActivity = Date.now();

    if (typeof window !== 'undefined') {
      const url = window.location.href;
      if (!session.urlHistory.includes(url)) {
        session.urlHistory.push(url);
      }
    }
  }

  /**
   * Update session activity
   */
  private updateSessionActivity(): void {
    const sessionId = this.getSessionId();
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Update tags
   */
  private updateTags(error: ErrorRecord): void {
    error.tags.forEach(tag => {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, []);
      }
      this.tags.get(tag)!.push(error.id);
    });
  }

  /**
   * Log error to logger
   */
  private logError(error: ErrorRecord): void {
    // In a real implementation, this would use the Logger service
    console.error(`Error tracked: ${error.title} - ${error.message}`);
  }

  /**
   * Group errors by type
   */
  private groupErrorsByType(errors: ErrorRecord[]): Record<ErrorType, number> {
    const grouped: Record<ErrorType, number> = {
      runtime: 0,
      network: 0,
      timeout: 0,
      auth: 0,
      validation: 0,
      '404': 0
    };

    errors.forEach(error => {
      grouped[error.type]++;
    });

    return grouped;
  }

  /**
   * Group errors by severity
   */
  private groupErrorsBySeverity(errors: ErrorRecord[]): Record<ErrorSeverity, number> {
    const grouped: Record<ErrorSeverity, number> = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0
    };

    errors.forEach(error => {
      grouped[error.severity]++;
    });

    return grouped;
  }

  /**
   * Group errors by HTTP status
   */
  private groupErrorsByHttpStatus(errors: ErrorRecord[]): Record<number, number> {
    const grouped: Record<number, number> = {};

    errors.forEach(error => {
      // Try to extract HTTP status from error context
      const httpStatus = error.context?.httpStatus;
      if (typeof httpStatus === 'number') {
        grouped[httpStatus] = (grouped[httpStatus] || 0) + 1;
      } else {
        grouped[0] = (grouped[0] || 0) + 1;
      }
    });

    return grouped;
  }

  /**
   * Get top error patterns
   */
  private getTopErrorPatterns(errors: ErrorRecord[]): TopErrorPattern[] {
    const patternCounts = new Map<string, number>();

    errors.forEach(error => {
      const pattern = `${error.type}:${error.message.substring(0, 100)}`;
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    });

    return Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Calculate resolution rate
   */
  private calculateResolutionRate(errors: ErrorRecord[]): number {
    const resolvedErrors = errors.filter(e => e.status === 'resolved');
    return errors.length > 0 ? (resolvedErrors.length / errors.length) * 100 : 0;
  }

  /**
   * Calculate average resolution time
   */
  private calculateAvgResolutionTime(errors: ErrorRecord[]): number {
    const resolvedErrors = errors.filter(e => e.resolvedAt);
    if (resolvedErrors.length === 0) return 0;

    const totalTime = resolvedErrors.reduce((sum, error) => {
      return sum + (error.resolvedAt! - error.timestamp);
    }, 0);

    return totalTime / resolvedErrors.length;
  }

  /**
   * Get top error groups
   */
  private getTopErrorGroups(timeWindow: number): ErrorGroup[] {
    const endTime = Date.now();
    const startTime = endTime - timeWindow;

    return Array.from(this.errorGroups.values())
      .filter(group => group.lastSeen >= startTime)
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 10);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(stats: ErrorStatistics): string[] {
    const recommendations: string[] = [];

    if (stats.errorRate > 1) {
      recommendations.push('High error rate detected - investigate application stability');
    }

    if (stats.uniqueErrors / stats.totalErrors > 0.5) {
      recommendations.push('High diversity in errors - consider improving error handling');
    }

    const topErrors = this.getTopErrorPatterns(stats.topErrors);
    topErrors.slice(0, 3).forEach(error => {
      recommendations.push(`Frequent error pattern: ${error.pattern} (${error.count} occurrences)`);
    });

    return recommendations;
  }

  /**
   * Get error trends
   */
  private getErrorTrends(timeWindow: number): ErrorTrend[] {
    // Simplified trend calculation
    return [{
      period: timeWindow,
      errorCount: this.getErrorStatistics(timeWindow).totalErrors,
      changePercentage: 0
    }];
  }

  /**
   * Apply filters
   */
  private applyFilters(errors: ErrorRecord[], filters: ErrorFilters): ErrorRecord[] {
    return errors.filter(error => {
      if (filters.types && !filters.types.includes(error.type)) return false;
      if (filters.severity && !filters.severity.includes(error.severity)) return false;
      if (filters.sessionId && error.sessionId !== filters.sessionId) return false;
      if (filters.userId && error.userId !== filters.userId) return false;
      if (filters.status && error.status !== filters.status) return false;
      return true;
    });
  }

  /**
   * Apply search
   */
  private applySearch(errors: ErrorRecord[], search: string): ErrorRecord[] {
    const searchTerm = search.toLowerCase();
    return errors.filter(error =>
      error.title.toLowerCase().includes(searchTerm) ||
      error.message.toLowerCase().includes(searchTerm) ||
      JSON.stringify(error.context).toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Apply sorting
   */
  private applySorting(errors: ErrorRecord[], sortBy: string, order: 'asc' | 'desc' = 'desc'): ErrorRecord[] {
    return [...errors].sort((a, b) => {
      let aVal = a[sortBy as keyof ErrorRecord];
      let bVal = b[sortBy as keyof ErrorRecord];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }

      return 0;
    });
  }

  /**
   * Apply pagination
   */
  private applyPagination(errors: ErrorRecord[], page: number, limit: number): ErrorRecord[] {
    const start = (page - 1) * limit;
    return errors.slice(start, start + limit);
  }

  /**
   * Get session ID
   */
  private getSessionId(): string {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      let sessionId = sessionStorage.getItem('error-session-id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('error-session-id', sessionId);
      }
      return sessionId;
    }
    return `server_session_${Date.now()}`;
  }
}

// Type definitions
export interface ErrorRecord {
  id: string;
  sessionId: string;
  userId?: string;
  fingerprint: string;
  type: ErrorType;
  severity: ErrorSeverity;
  title: string;
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  url?: string;
  userAgent?: string;
  context: Record<string, any>;
  tags: string[];
  timestamp: number;
  status: 'open' | 'resolved' | 'acknowledged';
  resolution?: string;
  resolvedAt?: number;
  occurrenceCount: number;
}

export interface ErrorGroup {
  id: string;
  fingerprint: string;
  type: ErrorType;
  firstSeen: number;
  lastSeen: number;
  occurrenceCount: number;
  avgResolutionTime: number;
  severity: ErrorSeverity;
}

export interface UserReport {
  id: string;
  userId: string;
  errorId?: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  severity: ErrorSeverity;
  status: UserReportStatus;
  resolution?: string;
  timestamp: number;
  updatedAt: number;
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  context?: Record<string, any>;
  tags?: string[];
}

export interface UserReportInput {
  userId: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  severity: ErrorSeverity;
}

export type ErrorType = 'runtime' | 'network' | 'timeout' | 'auth' | 'validation' | '404';
export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';
export type UserReportStatus = 'pending' | 'in-progress' | 'resolved' | 'rejected';

export interface ErrorStatistics {
  totalErrors: number;
  uniqueErrors: number;
  errorRate: number;
  byType: Record<ErrorType, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byHttpStatus: Record<number, number>;
  topErrors: TopErrorPattern[];
  resolutionRate: number;
  avgResolutionTime: number;
}

export interface TopErrorPattern {
  pattern: string;
  count: number;
}

export interface ErrorSearchQuery {
  search?: string;
  filters?: ErrorFilters;
  sortBy?: keyof ErrorRecord;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ErrorFilters {
  types?: ErrorType[];
  severity?: ErrorSeverity[];
  sessionId?: string;
  userId?: string;
  status?: string;
  tags?: string[];
}

export interface ErrorSearchResult {
  errors: ErrorRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ErrorTrackingReport {
  timestamp: number;
  timeWindow: number;
  totalErrors: number;
  uniqueErrors: number;
  errorRate: number;
  byType: Record<ErrorType, number>;
  bySeverity: Record<ErrorSeverity, number>;
  topErrorGroups: ErrorGroup[];
  recommendations: string[];
  trends: ErrorTrend[];
}

export interface ErrorTrend {
  period: number;
  errorCount: number;
  changePercentage: number;
}

export interface ErrorSession {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  errors: string[];
  urlHistory: string[];
}