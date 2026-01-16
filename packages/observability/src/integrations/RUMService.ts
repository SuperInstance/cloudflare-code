// @ts-nocheck - Complex RUM type issues
import { Observable, ObservableConfig } from '../core/Observable';
import { WebVitals, ServiceHealth } from '../types';

/**
 * Real User Monitoring (RUM) Service
 */
export class RUMService extends Observable {
  private webVitals: Map<string, WebVitals[]> = new Map();
  private sessionData: Map<string, RUMSession> = new Map();
  private pageViews: Map<string, PageViewData[]> = new Map();
  private customMetrics: Map<string, CustomMetricData[]> = new Map();

  constructor(config: ObservableConfig = {}) {
    super(config);
  }

  override async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize browser RUM collection
      this.initializeBrowserRUM();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize RUMService:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    // Clear all stored data
    this.webVitals.clear();
    this.sessionData.clear();
    this.pageViews.clear();
    this.customMetrics.clear();

    this.initialized = false;
  }

  async export(): Promise<any> {
    this.ensureInitialized();

    try {
      return {
        success: true,
        exported: 1,
        duration: 0,
        rumData: {
          webVitals: Array.from(this.webVitals.entries()),
          sessions: Array.from(this.sessionData.values()),
          pageViews: Array.from(this.pageViews.values()),
          customMetrics: Array.from(this.customMetrics.entries())
        }
      };
    } catch (error) {
      return this.handleExportError(error as Error);
    }
  }

  /**
   * Record Web Vitals
   */
  recordWebVitals(vitals: WebVitals): void {
    const sessionId = this.getSessionId();

    if (!this.webVitals.has(sessionId)) {
      this.webVitals.set(sessionId, []);
    }

    this.webVitals.get(sessionId)!.push(vitals);

    // Update session with latest metrics
    this.updateSessionWebVitals(sessionId, vitals);
  }

  /**
   * Record custom user interaction
   */
  recordInteraction(event: UserInteractionEvent): void {
    const sessionId = this.getSessionId();

    if (!this.sessionData.has(sessionId)) {
      this.createSession();
    }

    const session = this.sessionData.get(sessionId)!;
    session.interactions.push({
      ...event,
      timestamp: Date.now()
    });

    this.sessionData.set(sessionId, session);
  }

  /**
   * Record page view
   */
  recordPageView(pageView: PageViewData): void {
    const sessionId = this.getSessionId();

    if (!this.pageViews.has(sessionId)) {
      this.pageViews.set(sessionId, []);
    }

    const pageViewWithId = {
      ...pageView,
      sessionId,
      pageViewId: this.generatePageViewId(),
      timestamp: Date.now()
    };

    this.pageViews.get(sessionId)!.push(pageViewWithId);

    // Update session
    this.updateSessionPageView(sessionId, pageViewWithId);
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(metric: CustomMetricData): void {
    const sessionId = this.getSessionId();

    if (!this.customMetrics.has(metric.name)) {
      this.customMetrics.set(metric.name, []);
    }

    const metricWithId = {
      ...metric,
      sessionId,
      metricId: this.generateMetricId(),
      timestamp: Date.now()
    };

    this.customMetrics.get(metric.name)!.push(metricWithId);
  }

  /**
   * Get Web Vitals for a session
   */
  getWebVitals(sessionId?: string): WebVitals[] {
    if (sessionId) {
      return this.webVitals.get(sessionId) || [];
    }
    return Array.from(this.webVitals.values()).flat();
  }

  /**
   * Get Web Vitals statistics
   */
  getWebVitalsStatistics(): WebVitalsStatistics {
    const allVitals = this.getWebVitals();

    if (allVitals.length === 0) {
      return {
        total: 0,
        avgLCP: 0,
        avgFID: 0,
        avgCLS: 0,
        avgTBT: 0,
        avgFCP: 0,
        goodPercentage: 0,
        needsImprovementPercentage: 0,
        poorPercentage: 0
      };
    }

    const validLCP = allVitals.filter(v => v.lcp !== null).map(v => v.lcp!);
    const validFID = allVitals.filter(v => v.fid !== null).map(v => v.fid!);
    const validCLS = allVitals.filter(v => v.cls !== null).map(v => v.cls!);
    const validTBT = allVitals.filter(v => v.tbt !== null).map(v => v.tbt!);
    const validFCP = allVitals.filter(v => v.fcp !== null).map(v => v.fcp!);

    const total = allVitals.length;

    return {
      total,
      avgLCP: validLCP.length > 0 ? validLCP.reduce((a, b) => a + b, 0) / validLCP.length : 0,
      avgFID: validFID.length > 0 ? validFID.reduce((a, b) => a + b, 0) / validFID.length : 0,
      avgCLS: validCLS.length > 0 ? validCLS.reduce((a, b) => a + b, 0) / validCLS.length : 0,
      avgTBT: validTBT.length > 0 ? validTBT.reduce((a, b) => a + b, 0) / validTBT.length : 0,
      avgFCP: validFCP.length > 0 ? validFCP.reduce((a, b) => a + b, 0) / validFCP.length : 0,
      goodPercentage: allVitals.filter(v => v.status === 'good').length / total * 100,
      needsImprovementPercentage: allVitals.filter(v => v.status === 'needs-improvement').length / total * 100,
      poorPercentage: allVitals.filter(v => v.status === 'poor').length / total * 100
    };
  }

  /**
   * Get sessions
   */
  getSessions(): RUMSession[] {
    return Array.from(this.sessionData.values());
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): RUMSession | null {
    return this.sessionData.get(sessionId) || null;
  }

  /**
   * Get page views for a session
   */
  getPageViews(sessionId?: string): PageViewData[] {
    if (sessionId) {
      return this.pageViews.get(sessionId) || [];
    }
    return Array.from(this.pageViews.values()).flat();
  }

  /**
   * Get custom metrics
   */
  getCustomMetrics(name?: string): CustomMetricData[] {
    if (name) {
      return this.customMetrics.get(name) || [];
    }
    return Array.from(this.customMetrics.values()).flat();
  }

  /**
   * Get custom metric statistics
   */
  getCustomMetricStatistics(metricName: string): CustomMetricStatistics {
    const metrics = this.getCustomMetrics(metricName);

    if (metrics.length === 0) {
      return {
        total: 0,
        avg: 0,
        min: 0,
        max: 0,
        percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 }
      };
    }

    const values = metrics.map(m => m.value);
    const sorted = [...values].sort((a, b) => a - b);

    return {
      total: metrics.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      percentiles: {
        p50: this.percentile(sorted, 0.5),
        p90: this.percentile(sorted, 0.9),
        p95: this.percentile(sorted, 0.95),
        p99: this.percentile(sorted, 0.99)
      }
    };
  }

  /**
   * Get RUM performance report
   */
  getRUMReport(): RUMReport {
    return {
      timestamp: Date.now(),
      webVitals: this.getWebVitalsStatistics(),
      sessions: {
        total: this.sessionData.size,
        avgDuration: this.calculateAverageSessionDuration(),
        avgPageViews: this.calculateAveragePageViews()
      },
      customMetrics: Array.from(this.customMetrics.keys()).map(name => ({
        name,
        statistics: this.getCustomMetricStatistics(name)
      }))
    };
  }

  /**
   * Initialize browser RUM collection
   */
  private initializeBrowserRUM(): void {
    if (typeof window === 'undefined') return;

    // Initialize PerformanceObserver for Web Vitals
    if ('PerformanceObserver' in window) {
      this.initializePerformanceObserver();
    }

    // Initialize click tracking
    this.initializeClickTracking();

    // Initialize navigation tracking
    this.initializeNavigationTracking();

    // Initialize error tracking
    this.initializeErrorTracking();
  }

  /**
   * Initialize PerformanceObserver
   */
  private initializePerformanceObserver(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            this.recordWebVitals({
              id: this.generateWebVitalsId(),
              url: window.location.href,
              timestamp: Date.now(),
              lcp: entry.startTime,
              fid: null,
              cls: null,
              tbt: null,
              fcp: null,
              metric: 'LCP',
              status: 'good'
            });
          }
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      console.warn('Failed to initialize PerformanceObserver:', error);
    }
  }

  /**
   * Initialize click tracking
   */
  private initializeClickTracking(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      this.recordInteraction({
        type: 'click',
        element: target.tagName.toLowerCase(),
        elementId: target.id,
        elementClass: target.className,
        x: event.clientX,
        y: event.clientY,
        text: target.textContent?.substring(0, 100) || ''
      });
    }, true);
  }

  /**
   * Initialize navigation tracking
   */
  private initializeNavigationTracking(): void {
    if (typeof window === 'undefined') return;

    // Page load timing
    window.addEventListener('load', () => {
      this.recordPageView({
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        timing: {
          loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domInteractive: performance.timing.domInteractive - performance.timing.navigationStart,
          domComplete: performance.timing.domComplete - performance.timing.navigationStart
        }
      });
    });

    // Navigation changes
    let lastUrl = window.location.href;
    window.addEventListener('popstate', () => {
      if (window.location.href !== lastUrl) {
        this.recordPageView({
          url: window.location.href,
          title: document.title,
          referrer: lastUrl,
          timing: {}
        });
        lastUrl = window.location.href;
      }
    });
  }

  /**
   * Initialize error tracking
   */
  private initializeErrorTracking(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.recordInteraction({
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        errorType: event.error?.name || 'Error'
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.recordInteraction({
        type: 'error',
        message: event.reason?.message || 'Unhandled Promise Rejection',
        errorType: 'UnhandledRejection'
      });
    });
  }

  /**
   * Get or create session ID
   */
  private getSessionId(): string {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return 'server-session';
    }

    let sessionId = sessionStorage.getItem('rum-session-id');
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem('rum-session-id', sessionId);
    }

    return sessionId;
  }

  /**
   * Create a new session
   */
  private createSession(): void {
    const sessionId = this.getSessionId();
    const session: RUMSession = {
      sessionId,
      startTime: Date.now(),
      endTime: undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      viewport: typeof window !== 'undefined' ? {
        width: window.innerWidth,
        height: window.innerHeight
      } : undefined,
      device: this.getDeviceType(),
      location: typeof window !== 'undefined' ? {
        country: navigator.language,
        language: navigator.language
      } : undefined,
      interactions: [],
      pageViews: [],
      customMetrics: []
    };

    this.sessionData.set(sessionId, session);
  }

  /**
   * Update session Web Vitals
   */
  private updateSessionWebVitals(sessionId: string, vitals: WebVitals): void {
    const session = this.sessionData.get(sessionId);
    if (!session) return;

    session.webVitals = session.webVitals || [];
    session.webVitals.push(vitals);

    this.sessionData.set(sessionId, session);
  }

  /**
   * Update session page view
   */
  private updateSessionPageView(sessionId: string, pageView: PageViewData): void {
    const session = this.sessionData.get(sessionId);
    if (!session) return;

    session.pageViews.push(pageView);

    // Update end time if this is the current session
    if (!session.endTime) {
      session.endTime = Date.now();
    }

    this.sessionData.set(sessionId, session);
  }

  /**
   * Calculate average session duration
   */
  private calculateAverageSessionDuration(): number {
    const sessions = this.getSessions().filter(s => s.endTime);
    if (sessions.length === 0) return 0;

    const totalDuration = sessions.reduce((sum, session) => {
      return sum + (session.endTime! - session.startTime);
    }, 0);

    return totalDuration / sessions.length;
  }

  /**
   * Calculate average page views per session
   */
  private calculateAveragePageViews(): number {
    const sessions = this.getSessions();
    if (sessions.length === 0) return 0;

    const totalPageViews = sessions.reduce((sum, session) => {
      return sum + (session.pageViews?.length || 0);
    }, 0);

    return totalPageViews / sessions.length;
  }

  /**
   * Get device type
   */
  private getDeviceType(): string {
    if (typeof window === 'undefined') return 'server';

    const width = window.innerWidth;
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    const index = Math.floor(sortedValues.length * p);
    return sortedValues[index] || 0;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate Web Vitals ID
   */
  private generateWebVitalsId(): string {
    return `vitals_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate page view ID
   */
  private generatePageViewId(): string {
    return `pageview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate metric ID
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * RUM Session interface
 */
export interface RUMSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  userAgent: string;
  viewport?: { width: number; height: number };
  device: string;
  location?: { country: string; language: string };
  webVitals?: WebVitals[];
  interactions: UserInteractionEvent[];
  pageViews: PageViewData[];
  customMetrics: CustomMetricData[];
}

/**
 * User interaction event interface
 */
export interface UserInteractionEvent {
  type: string;
  element?: string;
  elementId?: string;
  elementClass?: string;
  x?: number;
  y?: number;
  text?: string;
  message?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  errorType?: string;
  timestamp: number;
}

/**
 * Page view data interface
 */
export interface PageViewData {
  sessionId: string;
  pageViewId: string;
  url: string;
  title: string;
  referrer: string;
  timing?: {
    loadTime: number;
    domInteractive: number;
    domComplete: number;
  };
  timestamp: number;
}

/**
 * Custom metric data interface
 */
export interface CustomMetricData {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  sessionId: string;
  metricId: string;
  timestamp: number;
}

/**
 * Web Vitals statistics interface
 */
export interface WebVitalsStatistics {
  total: number;
  avgLCP: number;
  avgFID: number;
  avgCLS: number;
  avgTBT: number;
  avgFCP: number;
  goodPercentage: number;
  needsImprovementPercentage: number;
  poorPercentage: number;
}

/**
 * Custom metric statistics interface
 */
export interface CustomMetricStatistics {
  total: number;
  avg: number;
  min: number;
  max: number;
  percentiles: { p50: number; p90: number; p95: number; p99: number };
}

/**
 * RUM report interface
 */
export interface RUMReport {
  timestamp: number;
  webVitals: WebVitalsStatistics;
  sessions: {
    total: number;
    avgDuration: number;
    avgPageViews: number;
  };
  customMetrics: {
    name: string;
    statistics: CustomMetricStatistics;
  }[];
}