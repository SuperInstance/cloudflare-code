/**
 * Funnel Analysis Module
 * Analyze conversion funnels with step-by-step metrics and insights
 */

import type {
  AnalyticsEvent,
  FunnelAnalysis,
  Funnel,
  FunnelType,
  FunnelStep,
  FunnelMetrics,
  FunnelOverallMetrics,
  FunnelStepMetrics,
  FunnelBreakdown,
  FunnelSegmentBreakdown,
  FunnelComparison,
  FunnelComparisonEntry,
  FunnelStatisticalComparison,
  FunnelInsight,
  TimeRange,
} from '../types/index.js';

/**
 * Funnel Analysis Engine
 */
export class FunnelAnalyzer {
  /**
   * Analyze funnel performance
   */
  async analyze(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<FunnelAnalysis> {
    const metrics = await this.calculateFunnelMetrics(events, funnel);
    const breakdown = await this.breakdownBySegment(events, funnel, metrics);
    const comparison = await this.compareFunnels(events, funnel);
    const insights = await this.generateInsights(metrics, breakdown);

    return {
      funnel,
      metrics,
      breakdown,
      comparison,
      insights,
    };
  }

  /**
   * Calculate funnel metrics
   */
  async calculateFunnelMetrics(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<FunnelMetrics> {
    const overall = this.calculateOverallMetrics(events, funnel);
    const byStep = this.calculateStepMetrics(events, funnel);
    const bySegment = await this.calculateMetricsBySegment(events, funnel);
    const byTimePeriod = await this.calculateMetricsByTimePeriod(events, funnel);

    return {
      overall,
      byStep,
      bySegment,
      byTimePeriod,
    };
  }

  /**
   * Breakdown funnel by segment
   */
  async breakdownBySegment(
    events: AnalyticsEvent[],
    funnel: Funnel,
    metrics: FunnelMetrics
  ): Promise<FunnelBreakdown> {
    const bySegment = await this.analyzeBySegment(events, funnel);
    const bySource = await this.analyzeBySource(events, funnel);
    const byDevice = await this.analyzeByDevice(events, funnel);
    const byBrowser = await this.analyzeByBrowser(events, funnel);

    return {
      bySegment,
      bySource,
      byDevice,
      byBrowser,
    };
  }

  /**
   * Compare funnels
   */
  async compareFunnels(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<FunnelComparison> {
    const funnels = await this.getComparableFunnels(events, funnel);
    const comparisonEntries = this.buildComparisonEntries(funnel, funnels);
    const statistical = this.performStatisticalComparison(funnel, funnels);

    return {
      funnels: comparisonEntries,
      statistical,
    };
  }

  /**
   * Generate funnel insights
   */
  async generateInsights(
    metrics: FunnelMetrics,
    breakdown: FunnelBreakdown
  ): Promise<FunnelInsight[]> {
    const insights: FunnelInsight[] = [];

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(metrics.byStep);
    insights.push(...bottlenecks);

    // Identify optimization opportunities
    const optimizations = this.identifyOptimizations(metrics, breakdown);
    insights.push(...optimizations);

    // Detect anomalies
    const anomalies = this.detectAnomalies(metrics);
    insights.push(...anomalies);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, breakdown);
    insights.push(...recommendations);

    return insights;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private calculateOverallMetrics(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): FunnelOverallMetrics {
    const funnelEvents = this.getFunnelEvents(events, funnel);

    const entrants = this.countEntrants(funnelEvents, funnel);
    const completions = this.countCompletions(funnelEvents, funnel);
    const conversionRate = entrants > 0 ? (completions / entrants) * 100 : 0;

    const dropoff = entrants - completions;

    const timeToComplete = this.calculateTimeToComplete(funnelEvents, funnel);
    const avgTimeToComplete = timeToComplete.reduce((a, b) => a + b, 0) / timeToComplete.length;
    const medianTimeToComplete = this.calculateMedian(timeToComplete);

    return {
      entrants,
      completions,
      conversionRate,
      dropoff,
      avgTimeToComplete,
      medianTimeToComplete,
    };
  }

  private calculateStepMetrics(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): FunnelStepMetrics[] {
    const stepMetrics: FunnelStepMetrics[] = [];
    const funnelEvents = this.getFunnelEvents(events, funnel);
    const userSteps = this.groupUsersBySteps(funnelEvents, funnel);

    const totalEntrants = this.countEntrants(funnelEvents, funnel);

    for (const step of funnel.steps) {
      const stepUsers = userSteps.get(step.id) || new Set();
      const users = stepUsers.size;

      // Find previous step to calculate dropoff
      const stepIndex = funnel.steps.findIndex((s) => s.id === step.id);
      const previousStep = stepIndex > 0 ? funnel.steps[stepIndex - 1] : null;
      const previousUsers = previousStep
        ? (userSteps.get(previousStep.id) || new Set()).size
        : totalEntrants;

      const completionRate = previousUsers > 0 ? (users / previousUsers) * 100 : 0;
      const dropoffUsers = previousUsers - users;
      const dropoffRate = previousUsers > 0 ? (dropoffUsers / previousUsers) * 100 : 0;

      const timeFromStart = this.calculateTimeFromStart(funnelEvents, step.id, funnel);
      const timeFromPrevious = this.calculateTimeFromPrevious(funnelEvents, step, funnel);

      const timeDistribution = this.calculateTimeDistributionForStep(funnelEvents, step.id);

      stepMetrics.push({
        stepId: step.id,
        stepName: step.name,
        users,
        completionRate,
        dropoffRate,
        dropoffUsers,
        avgTimeFromStart: timeFromStart.reduce((a, b) => a + b, 0) / timeFromStart.length,
        avgTimeFromPrevious: timeFromPrevious.reduce((a, b) => a + b, 0) / timeFromPrevious.length,
        timeDistribution,
      });
    }

    return stepMetrics;
  }

  private getFunnelEvents(events: AnalyticsEvent[], funnel: Funnel): AnalyticsEvent[] {
    return events.filter((e) => {
      if (e.timestamp < funnel.timeRange.start || e.timestamp >= funnel.timeRange.end) {
        return false;
      }

      if (funnel.segment) {
        const segmentValue = this.getSegmentValue(e);
        if (segmentValue !== funnel.segment) return false;
      }

      return true;
    });
  }

  private countEntrants(events: AnalyticsEvent[], funnel: Funnel): number {
    if (funnel.steps.length === 0) return 0;

    const firstStep = funnel.steps[0];
    const entrantEvents = events.filter((e) => this.matchesStep(e, firstStep));

    return new Set(entrantEvents.map((e) => e.userId)).size;
  }

  private countCompletions(events: AnalyticsEvent[], funnel: Funnel): number {
    if (funnel.steps.length === 0) return 0;

    const requiredSteps = funnel.steps.filter((s) => s.required);
    const completorUsers = new Set<string>();

    for (const event of events) {
      if (!completorUsers.has(event.userId)) {
        let completedAll = true;

        for (const step of requiredSteps) {
          if (!this.matchesStep(event, step)) {
            const userEvents = events.filter((e) => e.userId === event.userId);
            const stepCompleted = userEvents.some((e) => this.matchesStep(e, step));

            if (!stepCompleted) {
              completedAll = false;
              break;
            }
          }
        }

        if (completedAll) {
          completorUsers.add(event.userId);
        }
      }
    }

    return completorUsers.size;
  }

  private matchesStep(event: AnalyticsEvent, step: FunnelStep): boolean {
    if (event.type !== step.event) return false;

    if (step.criteria) {
      for (const [field, value] of Object.entries(step.criteria.conditions)) {
        const eventValue = this.getNestedValue(event, field);
        if (eventValue !== value) return false;
      }
    }

    return true;
  }

  private groupUsersBySteps(events: AnalyticsEvent[], funnel: Funnel): Map<string, Set<string>> {
    const userSteps = new Map<string, Set<string>>();

    for (const step of funnel.steps) {
      userSteps.set(step.id, new Set());

      const stepEvents = events.filter((e) => this.matchesStep(e, step));
      for (const event of stepEvents) {
        userSteps.get(step.id)!.add(event.userId);
      }
    }

    return userSteps;
  }

  private calculateTimeToComplete(events: AnalyticsEvent[], funnel: Funnel): number[] {
    const completionTimes: number[] = [];

    for (const step of funnel.steps) {
      const stepEvents = events.filter((e) => this.matchesStep(e, step));

      for (const event of stepEvents) {
        const firstStep = funnel.steps[0];
        const firstEvent = events.find((e) =>
          e.userId === event.userId && this.matchesStep(e, firstStep)
        );

        if (firstEvent) {
          completionTimes.push(event.timestamp - firstEvent.timestamp);
        }
      }
    }

    return completionTimes;
  }

  private calculateTimeFromStart(
    events: AnalyticsEvent[],
    stepId: string,
    funnel: Funnel
  ): number[] {
    const times: number[] = [];
    const step = funnel.steps.find((s) => s.id === stepId);
    const firstStep = funnel.steps[0];

    if (!step) return times;

    const stepEvents = events.filter((e) => this.matchesStep(e, step));

    for (const event of stepEvents) {
      const firstEvent = events.find((e) =>
        e.userId === event.userId && this.matchesStep(e, firstStep)
      );

      if (firstEvent) {
        times.push(event.timestamp - firstEvent.timestamp);
      }
    }

    return times;
  }

  private calculateTimeFromPrevious(
    events: AnalyticsEvent[],
    step: FunnelStep,
    funnel: Funnel
  ): number[] {
    const times: number[] = [];
    const stepIndex = funnel.steps.findIndex((s) => s.id === step.id);

    if (stepIndex === 0) return times;

    const previousStep = funnel.steps[stepIndex - 1];
    const stepEvents = events.filter((e) => this.matchesStep(e, step));

    for (const event of stepEvents) {
      const previousEvent = events.find((e) =>
        e.userId === event.userId && this.matchesStep(e, previousStep)
      );

      if (previousEvent) {
        times.push(event.timestamp - previousEvent.timestamp);
      }
    }

    return times;
  }

  private calculateTimeDistributionForStep(
    events: AnalyticsEvent[],
    stepId: string
  ): any {
    const hourly = new Array(24).fill(0);

    const stepEvents = events.filter((e) => e.type === stepId || e.properties.step_id === stepId);

    for (const event of stepEvents) {
      const hour = new Date(event.timestamp).getHours();
      hourly[hour]++;
    }

    return { hourly, daily: new Array(7).fill(0), weekly: [] };
  }

  private async calculateMetricsBySegment(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<Record<string, FunnelStepMetrics[]>> {
    const bySegment: Record<string, FunnelStepMetrics[]> = {};

    const segments = ['new', 'active', 'churned', 'paid', 'free'];

    for (const segment of segments) {
      const segmentFunnel: Funnel = {
        ...funnel,
        segment,
      };

      const segmentEvents = this.getFunnelEvents(events, segmentFunnel);
      const stepMetrics = this.calculateStepMetrics(segmentEvents, funnel);

      bySegment[segment] = stepMetrics;
    }

    return bySegment;
  }

  private async calculateMetricsByTimePeriod(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<Record<string, FunnelStepMetrics[]>> {
    const byTimePeriod: Record<string, FunnelStepMetrics[]> = {};

    const periodDays = [1, 7, 30];
    const periodMs = 24 * 60 * 60 * 1000;

    for (const days of periodDays) {
      const periodStart = funnel.timeRange.end - days * periodMs;
      const periodEnd = funnel.timeRange.end;

      const periodFunnel: Funnel = {
        ...funnel,
        timeRange: {
          start: periodStart,
          end: periodEnd,
          duration: periodEnd - periodStart,
        },
      };

      const periodEvents = this.getFunnelEvents(events, periodFunnel);
      const stepMetrics = this.calculateStepMetrics(periodEvents, funnel);

      byTimePeriod[`last_${days}d`] = stepMetrics;
    }

    return byTimePeriod;
  }

  private async analyzeBySegment(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<FunnelSegmentBreakdown[]> {
    const breakdown: FunnelSegmentBreakdown[] = [];

    const segments = ['new', 'active', 'churned', 'paid', 'free'];

    for (const segment of segments) {
      const segmentFunnel: Funnel = {
        ...funnel,
        segment,
      };

      const segmentEvents = this.getFunnelEvents(events, segmentFunnel);
      const overall = this.calculateOverallMetrics(segmentEvents, funnel);
      const steps = this.calculateStepMetrics(segmentEvents, funnel);

      breakdown.push({
        segment,
        entrants: overall.entrants,
        completions: overall.completions,
        conversionRate: overall.conversionRate,
        steps,
      });
    }

    return breakdown;
  }

  private async analyzeBySource(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<FunnelSegmentBreakdown[]> {
    const sourceMap = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      const source = event.properties?.source || event.metadata?.source || 'unknown';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, []);
      }
      sourceMap.get(source)!.push(event);
    }

    const breakdown: FunnelSegmentBreakdown[] = [];

    for (const [source, sourceEvents] of sourceMap.entries()) {
      const overall = this.calculateOverallMetrics(sourceEvents, funnel);
      const steps = this.calculateStepMetrics(sourceEvents, funnel);

      breakdown.push({
        segment: source,
        entrants: overall.entrants,
        completions: overall.completions,
        conversionRate: overall.conversionRate,
        steps,
      });
    }

    return breakdown.sort((a, b) => b.conversionRate - a.conversionRate);
  }

  private async analyzeByDevice(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<FunnelSegmentBreakdown[]> {
    const deviceMap = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      const device = event.context.deviceType || 'unknown';
      if (!deviceMap.has(device)) {
        deviceMap.set(device, []);
      }
      deviceMap.get(device)!.push(event);
    }

    const breakdown: FunnelSegmentBreakdown[] = [];

    for (const [device, deviceEvents] of deviceMap.entries()) {
      const overall = this.calculateOverallMetrics(deviceEvents, funnel);
      const steps = this.calculateStepMetrics(deviceEvents, funnel);

      breakdown.push({
        segment: device,
        entrants: overall.entrants,
        completions: overall.completions,
        conversionRate: overall.conversionRate,
        steps,
      });
    }

    return breakdown;
  }

  private async analyzeByBrowser(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<FunnelSegmentBreakdown[]> {
    const browserMap = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      const browser = event.context.browser || 'unknown';
      if (!browserMap.has(browser)) {
        browserMap.set(browser, []);
      }
      browserMap.get(browser)!.push(event);
    }

    const breakdown: FunnelSegmentBreakdown[] = [];

    for (const [browser, browserEvents] of browserMap.entries()) {
      const overall = this.calculateOverallMetrics(browserEvents, funnel);
      const steps = this.calculateStepMetrics(browserEvents, funnel);

      breakdown.push({
        segment: browser,
        entrants: overall.entrants,
        completions: overall.completions,
        conversionRate: overall.conversionRate,
        steps,
      });
    }

    return breakdown;
  }

  private async getComparableFunnels(
    events: AnalyticsEvent[],
    funnel: Funnel
  ): Promise<Funnel[]> {
    // Return funnel variations for comparison
    const variations: Funnel[] = [];

    // Previous period funnel
    const periodDuration = funnel.timeRange.duration;
    variations.push({
      ...funnel,
      id: `${funnel.id}_previous`,
      name: `${funnel.name} (Previous Period)`,
      timeRange: {
        start: funnel.timeRange.start - periodDuration,
        end: funnel.timeRange.start,
        duration: periodDuration,
      },
    });

    return variations;
  }

  private buildComparisonEntries(
    funnel: Funnel,
    funnels: Funnel[]
  ): FunnelComparisonEntry[] {
    // Placeholder - would calculate actual metrics for each funnel
    return [
      {
        funnel: funnel.id,
        entrants: 1000,
        completions: 250,
        conversionRate: 25,
        difference: 0,
        significant: false,
      },
    ];
  }

  private performStatisticalComparison(
    funnel: Funnel,
    funnels: Funnel[]
  ): FunnelStatisticalComparison {
    return {
      test: 'chi_square',
      statistic: 0,
      pValue: 0.05,
      significant: false,
      winner: funnel.id,
      confidence: 0.95,
    };
  }

  private identifyBottlenecks(stepMetrics: FunnelStepMetrics[]): FunnelInsight[] {
    const insights: FunnelInsight[] = [];

    for (const step of stepMetrics) {
      if (step.dropoffRate > 50) {
        insights.push({
          type: 'bottleneck',
          severity: step.dropoffRate > 70 ? 'critical' : 'warning',
          title: `High dropoff at ${step.stepName}`,
          description: `${step.dropoffRate}% of users drop off at this step`,
          step: step.stepId,
          impact: step.dropoffUsers,
          recommendation: 'Optimize this step to reduce dropoff',
          confidence: 0.9,
        });
      }
    }

    return insights;
  }

  private identifyOptimizations(
    metrics: FunnelMetrics,
    breakdown: FunnelBreakdown
  ): FunnelInsight[] {
    const insights: FunnelInsight[] = [];

    // Find best performing segment
    const bestSegment = breakdown.bySegment.sort((a, b) => b.conversionRate - a.conversionRate)[0];

    if (bestSegment && bestSegment.conversionRate > metrics.overall.conversionRate * 1.2) {
      insights.push({
        type: 'optimization',
        severity: 'info',
        title: `High performing segment: ${bestSegment.segment}`,
        description: `${bestSegment.segment} has ${bestSegment.conversionRate}% conversion rate vs ${metrics.overall.conversionRate}% overall`,
        impact: bestSegment.conversionRate - metrics.overall.conversionRate,
        recommendation: `Investigate what makes ${bestSegment.segment} perform well`,
        confidence: 0.8,
      });
    }

    return insights;
  }

  private detectAnomalies(metrics: FunnelMetrics): FunnelInsight[] {
    // Placeholder implementation
    return [];
  }

  private generateRecommendations(
    metrics: FunnelMetrics,
    breakdown: FunnelBreakdown
  ): FunnelInsight[] {
    const insights: FunnelInsight[] = [];

    if (metrics.overall.conversionRate < 10) {
      insights.push({
        type: 'recommendation',
        severity: 'action_required',
        title: 'Low conversion rate',
        description: `Overall conversion rate is ${metrics.overall.conversionRate}%`,
        impact: metrics.overall.entrants * (1 - metrics.overall.conversionRate / 100),
        recommendation: 'Review funnel design and user experience',
        confidence: 0.95,
      });
    }

    return insights;
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private getSegmentValue(event: AnalyticsEvent): string {
    return event.properties?.segment || event.properties?.user_type || 'all';
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}
