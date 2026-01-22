/**
 * Funnel Analyzer
 * Comprehensive funnel analysis with drop-off analysis and conversion tracking
 */

import type {
  Funnel,
  FunnelStep,
  FunnelResult,
  FunnelStepResult,
  DropOffAnalysis,
  DropOffPath,
  DropOffReason,
  AbandonmentPoint,
  TimeMetrics,
  TimeBucket,
  FunnelComparison,
  ComparisonDifference,
  AnalyticsEvent,
  User,
  DateRange,
  FunnelBreakdown,
  BreakdownSegment,
  FunnelWindow,
} from '../types/index.js';

// ============================================================================
// Funnel Builder
// ============================================================================

export class FunnelBuilder {
  private idCounter = 0;

  /**
   * Create a new funnel
   */
  createFunnel(
    name: string,
    steps: Omit<FunnelStep, 'id' | 'order'>[],
    window?: FunnelWindow,
    conversionType: 'strict' | 'flexible' | 'custom' = 'strict'
  ): Funnel {
    const id = `funnel_${++this.idCounter}_${Date.now()}`;

    const funnelSteps: FunnelStep[] = steps.map((step, index) => ({
      id: `step_${id}_${index}`,
      order: index,
      ...step,
    }));

    return {
      id,
      name,
      steps: funnelSteps,
      window,
      conversionType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Create a simple conversion funnel
   */
  createConversionFunnel(
    name: string,
    eventNames: string[],
    window?: FunnelWindow
  ): Funnel {
    const steps = eventNames.map((eventName) => ({
      name: eventName,
      conditions: [
        {
          eventType: 'custom',
          eventName,
        },
      ],
      required: true,
    }));

    return this.createFunnel(name, steps, window);
  }

  /**
   * Create an e-commerce funnel
   */
  createEcommerceFunnel(name?: string): Funnel {
    return this.createFunnel(
      name || 'E-commerce Conversion',
      [
        {
          name: 'Product View',
          conditions: [
            {
              eventType: 'page_view',
              eventName: 'product_view',
            },
          ],
          required: true,
        },
        {
          name: 'Add to Cart',
          conditions: [
            {
              eventType: 'custom',
              eventName: 'add_to_cart',
            },
          ],
          required: true,
        },
        {
          name: 'Checkout Started',
          conditions: [
            {
              eventType: 'custom',
              eventName: 'checkout_started',
            },
          ],
          required: true,
        },
        {
          name: 'Purchase',
          conditions: [
            {
              eventType: 'conversion',
              eventName: 'purchase',
            },
          ],
          required: true,
        },
      ],
      {
        value: 7,
        unit: 'days',
        type: 'first_event',
      }
    );
  }

  /**
   * Create a signup funnel
   */
  createSignupFunnel(name?: string): Funnel {
    return this.createFunnel(
      name || 'User Signup',
      [
        {
          name: 'Landing Page',
          conditions: [
            {
              eventType: 'page_view',
              eventName: 'landing_page',
            },
          ],
          required: true,
        },
        {
          name: 'Signup Click',
          conditions: [
            {
              eventType: 'click',
              eventName: 'signup_click',
            },
          ],
          required: true,
        },
        {
          name: 'Form Submit',
          conditions: [
            {
              eventType: 'form_submit',
              eventName: 'signup_form_submit',
            },
          ],
          required: true,
        },
        {
          name: 'Account Created',
          conditions: [
            {
              eventType: 'conversion',
              eventName: 'account_created',
            },
          ],
          required: true,
        },
      ],
      {
        value: 1,
        unit: 'days',
      }
    );
  }

  /**
   * Create an onboarding funnel
   */
  createOnboardingFunnel(name?: string): Funnel {
    return this.createFunnel(
      name || 'User Onboarding',
      [
        {
          name: 'Account Created',
          conditions: [
            {
              eventType: 'conversion',
              eventName: 'account_created',
            },
          ],
          required: true,
        },
        {
          name: 'Profile Completed',
          conditions: [
            {
              eventType: 'custom',
              eventName: 'profile_completed',
            },
          ],
          required: true,
        },
        {
          name: 'First Action',
          conditions: [
            {
              eventType: 'custom',
              eventName: 'first_action',
            },
          ],
          required: true,
        },
        {
          name: 'Activation',
          conditions: [
            {
              eventType: 'custom',
              eventName: 'activation',
            },
          ],
          required: true,
        },
      ],
      {
        value: 14,
        unit: 'days',
      }
    );
  }
}

// ============================================================================
// Funnel Analyzer
// ============================================================================

export class FunnelAnalyzer {
  /**
   * Analyze a funnel
   */
  analyze(
    funnel: Funnel,
    events: AnalyticsEvent[],
    users?: User[]
  ): FunnelResult {
    const startTime = Date.now();

    // Filter events by time window
    const filteredEvents = this.filterEventsByWindow(events, funnel.window);

    // Get users who entered the funnel
    const enteringUsers = this.getEnteringUsers(funnel, filteredEvents);

    // Analyze each step
    const stepResults = this.analyzeSteps(
      funnel,
      filteredEvents,
      enteringUsers
    );

    // Calculate overall conversion rate
    const overallConversionRate = this.calculateOverallConversionRate(stepResults);

    // Perform drop-off analysis
    const dropOffAnalysis = this.analyzeDropOffs(
      funnel,
      stepResults,
      filteredEvents
    );

    // Calculate time metrics
    const timeToConvert = this.calculateTimeMetrics(funnel, filteredEvents, enteringUsers);

    const executionTime = Date.now() - startTime;

    return {
      funnelId: funnel.id,
      funnelName: funnel.name,
      totalUsers: enteringUsers.size,
      stepResults,
      overallConversionRate,
      dropOffAnalysis,
      timeToConvert,
      generatedAt: Date.now(),
    };
  }

  /**
   * Analyze a funnel with breakdown by dimension
   */
  analyzeWithBreakdown(
    funnel: Funnel,
    events: AnalyticsEvent[],
    dimension: string,
    users?: User[]
  ): FunnelResult & { breakdown: FunnelBreakdown } {
    // Get unique values for the dimension
    const dimensionValues = this.getDimensionValues(events, dimension);

    // Analyze for each segment
    const segments: BreakdownSegment[] = dimensionValues.map((value) => {
      const segmentEvents = events.filter(
        (e) => this.getEventDimension(e, dimension) === value
      );

      const result = this.analyze(funnel, segmentEvents, users);

      return {
        name: dimension,
        value: String(value),
        totalUsers: result.totalUsers,
        conversionRate: result.overallConversionRate,
        stepResults: result.stepResults,
      };
    });

    const baseResult = this.analyze(funnel, events, users);

    return {
      ...baseResult,
      breakdown: {
        byDimension: dimension,
        segments,
      },
    };
  }

  /**
   * Compare multiple funnels
   */
  compare(
    funnels: Array<{ funnel: Funnel; events: AnalyticsEvent[] }>,
    comparisonType: 'period' | 'segment' | 'variant'
  ): FunnelComparison {
    const funnelResults = funnels.map(({ funnel, events }) =>
      this.analyze(funnel, events)
    );

    const dimension =
      comparisonType === 'period'
        ? 'time_period'
        : comparisonType === 'segment'
        ? 'user_segment'
        : 'variant';

    const significantDifferences = this.findSignificantDifferences(
      funnelResults,
      dimension
    );

    return {
      funnelResults,
      comparisonType,
      dimension,
      significantDifferences,
      generatedAt: Date.now(),
    };
  }

  /**
   * Filter events by time window
   */
  private filterEventsByWindow(
    events: AnalyticsEvent[],
    window?: FunnelWindow
  ): AnalyticsEvent[] {
    if (!window) return events;

    const now = Date.now();
    const windowMs =
      window.unit === 'minutes'
        ? window.value * 60 * 1000
        : window.unit === 'hours'
        ? window.value * 60 * 60 * 1000
        : window.unit === 'days'
        ? window.value * 24 * 60 * 60 * 1000
        : window.value * 7 * 24 * 60 * 60 * 1000;

    const cutoff = now - windowMs;
    return events.filter((e) => e.timestamp >= cutoff);
  }

  /**
   * Get users who entered the funnel
   */
  private getEnteringUsers(
    funnel: Funnel,
    events: AnalyticsEvent[]
  ): Set<string> {
    const firstStep = funnel.steps[0];
    if (!firstStep) return new Set();

    const enteringUsers = new Set<string>();

    for (const event of events) {
      if (
        this.matchesStepCondition(event, firstStep) &&
        event.userId
      ) {
        enteringUsers.add(event.userId);
      }
    }

    return enteringUsers;
  }

  /**
   * Check if an event matches a step condition
   */
  private matchesStepCondition(
    event: AnalyticsEvent,
    step: FunnelStep
  ): boolean {
    return step.conditions.some((condition) => {
      const typeMatch = !condition.eventType || event.eventType === condition.eventType;
      const nameMatch = !condition.eventName || event.eventName === condition.eventName;
      return typeMatch && nameMatch;
    });
  }

  /**
   * Analyze funnel steps
   */
  private analyzeSteps(
    funnel: Funnel,
    events: AnalyticsEvent[],
    enteringUsers: Set<string>
  ): FunnelStepResult[] {
    const results: FunnelStepResult[] = [];
    const previousStepTime = new Map<string, number>();
    const userProgress = new Map<string, number>();

    for (const step of funnel.steps) {
      const stepEvents = events.filter((e) =>
        this.matchesStepCondition(e, step)
      );

      const stepUsers = new Set(
        stepEvents.filter((e) => e.userId).map((e) => e.userId!)
      );

      const completionRate =
        enteringUsers.size > 0
          ? (stepUsers.size / enteringUsers.size) * 100
          : 0;

      const dropOffCount = enteringUsers.size - stepUsers.size;
      const dropOffRate =
        enteringUsers.size > 0 ? (dropOffCount / enteringUsers.size) * 100 : 0;

      // Calculate time from previous step
      const timesFromPrevious: number[] = [];

      for (const event of stepEvents) {
        if (!event.userId) continue;

        const prevTime = previousStepTime.get(event.userId);
        if (prevTime) {
          timesFromPrevious.push(event.timestamp - prevTime);
        }

        previousStepTime.set(event.userId, event.timestamp);
      }

      const avgTimeFromPrevious =
        timesFromPrevious.length > 0
          ? timesFromPrevious.reduce((a, b) => a + b, 0) / timesFromPrevious.length
          : 0;

      const sortedTimes = [...timesFromPrevious].sort((a, b) => a - b);
      const medianTimeFromPrevious =
        sortedTimes.length > 0
          ? sortedTimes[Math.floor(sortedTimes.length / 2)]
          : 0;

      // Find abandonment points
      const abandonmentPoints = this.findAbandonmentPoints(
        step,
        events,
        stepUsers
      );

      results.push({
        stepId: step.id,
        stepName: step.name,
        order: step.order,
        users: stepUsers.size,
        uniqueUsers: stepUsers.size,
        completionRate,
        dropOffRate,
        dropOffCount,
        avgTimeFromPrevious,
        medianTimeFromPrevious,
        abandonmentPoints,
      });
    }

    return results;
  }

  /**
   * Find abandonment points for a step
   */
  private findAbandonmentPoints(
    step: FunnelStep,
    events: AnalyticsEvent[],
    stepUsers: Set<string>
  ): AbandonmentPoint[] {
    const abandonments: AbandonmentPoint[] = [];

    // Find events that happened after this step for users who didn't complete next step
    const stepEvents = events.filter((e) =>
      this.matchesStepCondition(e, step)
    );

    const exitActions = new Map<string, number>();

    for (const event of stepEvents) {
      if (!event.userId) continue;

      // Find subsequent events for this user
      const subsequentEvents = events.filter(
        (e) =>
          e.userId === event.userId &&
          e.timestamp > event.timestamp &&
          e.timestamp < event.timestamp + 60000 // Within 1 minute
      );

      for (const subsequent of subsequentEvents) {
        const key = `${subsequent.eventType}:${subsequent.eventName}`;
        exitActions.set(key, (exitActions.get(key) || 0) + 1);
      }
    }

    // Convert to abandonment points
    for (const [action, count] of exitActions.entries()) {
      const [type, name] = action.split(':');
      abandonments.push({
        action: name,
        count,
        percentage: (count / stepEvents.length) * 100,
      });
    }

    return abandonments.sort((a, b) => b.count - a.count).slice(0, 5);
  }

  /**
   * Calculate overall conversion rate
   */
  private calculateOverallConversionRate(
    stepResults: FunnelStepResult[]
  ): number {
    if (stepResults.length === 0) return 0;

    const firstStep = stepResults[0];
    const lastStep = stepResults[stepResults.length - 1];

    if (firstStep.users === 0) return 0;

    return (lastStep.users / firstStep.users) * 100;
  }

  /**
   * Analyze drop-offs
   */
  private analyzeDropOffs(
    funnel: Funnel,
    stepResults: FunnelStepResult[],
    events: AnalyticsEvent[]
  ): DropOffAnalysis {
    const totalDropOff = stepResults.reduce(
      (sum, step) => sum + step.dropOffCount,
      0
    );

    const dropOffByStep: Record<string, number> = {};
    stepResults.forEach((step) => {
      dropOffByStep[step.stepId] = step.dropOffCount;
    });

    // Find common drop-off paths
    const commonDropOffPaths = this.findCommonDropOffPaths(
      funnel,
      stepResults,
      events
    );

    // Generate drop-off reasons
    const reasons = this.generateDropOffReasons(stepResults, commonDropOffPaths);

    return {
      totalDropOff,
      dropOffByStep,
      commonDropOffPaths,
      reasons,
    };
  }

  /**
   * Find common drop-off paths
   */
  private findCommonDropOffPaths(
    funnel: Funnel,
    stepResults: FunnelStepResult[],
    events: AnalyticsEvent[]
  ): DropOffPath[] {
    const paths: Map<string, DropOffPath> = new Map();

    for (let i = 0; i < funnel.steps.length - 1; i++) {
      const currentStep = funnel.steps[i];
      const nextStep = funnel.steps[i + 1];

      // Find users who completed current step but not next
      const currentEvents = events.filter((e) =>
        this.matchesStepCondition(e, currentStep)
      );

      const nextEvents = events.filter((e) =>
        this.matchesStepCondition(e, nextStep)
      );

      const nextUsers = new Set(
        nextEvents.filter((e) => e.userId).map((e) => e.userId!)
      );

      for (const event of currentEvents) {
        if (!event.userId || nextUsers.has(event.userId)) continue;

        // Find what this user did instead
        const subsequentEvents = events.filter(
          (e) =>
            e.userId === event.userId &&
            e.timestamp > event.timestamp &&
            e.timestamp < event.timestamp + 300000 // Within 5 minutes
        );

        if (subsequentEvents.length === 0) continue;

        const path = subsequentEvents
          .slice(0, 3)
          .map((e) => `${e.eventType}:${e.eventName}`);

        const pathKey = path.join(' -> ');
        const existing = paths.get(pathKey);

        if (existing) {
          existing.count++;
        } else {
          paths.set(pathKey, {
            path,
            count: 1,
            percentage: 0,
            avgTimeInFunnel: 0,
          });
        }
      }
    }

    // Calculate percentages
    const total = Array.from(paths.values()).reduce((sum, p) => sum + p.count, 0);
    const result = Array.from(paths.values()).map((p) => ({
      ...p,
      percentage: total > 0 ? (p.count / total) * 100 : 0,
    }));

    return result
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Generate drop-off reasons
   */
  private generateDropOffReasons(
    stepResults: FunnelStepResult[],
    dropOffPaths: DropOffPath[]
  ): DropOffReason[] {
    const reasons: DropOffReason[] = [];

    // Analyze each step with significant drop-off
    for (const step of stepResults) {
      if (step.dropOffRate < 10) continue; // Only significant drop-offs

      const reason = this.inferDropOffReason(step, dropOffPaths);
      if (reason) {
        reasons.push({
          reason: reason.reason,
          count: step.dropOffCount,
          percentage: step.dropOffRate,
          suggestedAction: reason.suggestedAction,
        });
      }
    }

    return reasons;
  }

  /**
   * Infer drop-off reason for a step
   */
  private inferDropOffReason(
    step: FunnelStepResult,
    dropOffPaths: DropOffPath[]
  ): { reason: string; suggestedAction: string } | null {
    // Check if users are leaving to specific pages
    const exits = dropOffPaths.filter((p) =>
      p.path.some((action) => action.includes('page_view'))
    );

    if (exits.length > 0 && exits[0].percentage > 20) {
      const exitPage = exits[0].path.find((a) => a.includes('page_view'));
      return {
        reason: `Users are leaving to ${exitPage}`,
        suggestedAction: 'Review the page that users are navigating to',
      };
    }

    // Check abandonment points
    if (step.abandonmentPoints.length > 0) {
      const topAbandonment = step.abandonmentPoints[0];
      return {
        reason: `Users are ${topAbandonment.action} instead of proceeding`,
        suggestedAction: 'Consider removing or improving the alternative action',
      };
    }

    // Time-based inference
    if (step.avgTimeFromPrevious > 60000) {
      return {
        reason: 'Users are taking too long to complete this step',
        suggestedAction: 'Simplify the step or provide better guidance',
      };
    }

    return {
      reason: 'High drop-off rate detected',
      suggestedAction: 'Analyze user behavior and consider UI/UX improvements',
    };
  }

  /**
   * Calculate time metrics
   */
  private calculateTimeMetrics(
    funnel: Funnel,
    events: AnalyticsEvent[],
    enteringUsers: Set<string>
  ): TimeMetrics {
    const completionTimes: number[] = [];

    for (const userId of enteringUsers) {
      const userEvents = events.filter((e) => e.userId === userId);

      const firstEvent = userEvents.find((e) =>
        this.matchesStepCondition(e, funnel.steps[0])
      );
      const lastEvent = userEvents.find((e) =>
        this.matchesStepCondition(e, funnel.steps[funnel.steps.length - 1])
      );

      if (firstEvent && lastEvent) {
        completionTimes.push(lastEvent.timestamp - firstEvent.timestamp);
      }
    }

    if (completionTimes.length === 0) {
      return {
        avg: 0,
        median: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        distribution: [],
      };
    }

    const sorted = [...completionTimes].sort((a, b) => a - b);

    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    // Create distribution buckets
    const distribution = this.createDistributionBuckets(sorted);

    return {
      avg,
      median,
      p75,
      p90,
      p95,
      distribution,
    };
  }

  /**
   * Create distribution buckets
   */
  private createDistributionBuckets(times: number[]): TimeBucket[] {
    const buckets: TimeBucket[] = [];

    const ranges = [
      { min: 0, max: 1000, label: '0-1s' },
      { min: 1000, max: 5000, label: '1-5s' },
      { min: 5000, max: 10000, label: '5-10s' },
      { min: 10000, max: 30000, label: '10-30s' },
      { min: 30000, max: 60000, label: '30-60s' },
      { min: 60000, max: 120000, label: '1-2m' },
      { min: 120000, max: 300000, label: '2-5m' },
      { min: 300000, max: Infinity, label: '5m+' },
    ];

    for (const range of ranges) {
      const count = times.filter((t) => t >= range.min && t < range.max).length;
      buckets.push({
        range: range.label,
        count,
        percentage: (count / times.length) * 100,
      });
    }

    return buckets;
  }

  /**
   * Get dimension values from events
   */
  private getDimensionValues(events: AnalyticsEvent[], dimension: string): string[] {
    const values = new Set<string>();

    for (const event of events) {
      const value = this.getEventDimension(event, dimension);
      if (value !== undefined) {
        values.add(String(value));
      }
    }

    return Array.from(values);
  }

  /**
   * Get dimension value from event
   */
  private getEventDimension(event: AnalyticsEvent, dimension: string): unknown {
    if (dimension.startsWith('properties.')) {
      const key = dimension.replace('properties.', '');
      return event.properties[key];
    }

    if (dimension.startsWith('context.')) {
      const key = dimension.replace('context.', '');
      return (event.context as any)[key];
    }

    return (event as any)[dimension];
  }

  /**
   * Find significant differences between funnel results
   */
  private findSignificantDifferences(
    results: FunnelResult[],
    dimension: string
  ): ComparisonDifference[] {
    const differences: ComparisonDifference[] = [];

    if (results.length < 2) return differences;

    // Compare conversion rates
    const conversionRates = results.map((r) => r.overallConversionRate);
    const avgConversion =
      conversionRates.reduce((a, b) => a + b, 0) / conversionRates.length;
    const stdDev = Math.sqrt(
      conversionRates
        .map((r) => Math.pow(r - avgConversion, 2))
        .reduce((a, b) => a + b, 0) / conversionRates.length
    );

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const diff = Math.abs(results[i].overallConversionRate - results[j].overallConversionRate);

        if (diff > stdDev * 1.5) {
          differences.push({
            metric: 'overall_conversion_rate',
            dimension1: `Funnel ${i + 1}`,
            dimension2: `Funnel ${j + 1}`,
            value1: results[i].overallConversionRate,
            value2: results[j].overallConversionRate,
            absoluteChange: diff,
            relativeChange: (diff / results[i].overallConversionRate) * 100,
            statisticallySignificant: true,
            confidence: 0.95,
          });
        }
      }
    }

    return differences;
  }
}

// ============================================================================
// Funnel Optimizer
// ============================================================================

export class FunnelOptimizer {
  /**
   * Get optimization suggestions for a funnel
   */
  getOptimizationSuggestions(result: FunnelResult): string[] {
    const suggestions: string[] = [];

    // Check for high drop-off rates
    for (const step of result.stepResults) {
      if (step.dropOffRate > 50) {
        suggestions.push(
          `Step "${step.stepName}" has a very high drop-off rate (${step.dropOffRate.toFixed(1)}%). Consider simplifying or removing this step.`
        );
      } else if (step.dropOffRate > 30) {
        suggestions.push(
          `Step "${step.stepName}" has a high drop-off rate (${step.dropOffRate.toFixed(1)}%). Review the user experience at this point.`
        );
      }
    }

    // Check for long completion times
    if (result.timeToConvert.median > 60000) {
      suggestions.push(
        `Median completion time is ${(result.timeToConvert.median / 1000).toFixed(0)}s. Consider streamlining the process.`
      );
    }

    // Check abandonment points
    for (const step of result.stepResults) {
      if (step.abandonmentPoints.length > 0) {
        const topAbandonment = step.abandonmentPoints[0];
        if (topAbandonment.percentage > 20) {
          suggestions.push(
            `Many users are "${topAbandonment.action}" instead of completing "${step.stepName}". Consider addressing this diversion.`
          );
        }
      }
    }

    // Check drop-off reasons
    if (result.dropOffAnalysis.reasons) {
      for (const reason of result.dropOffAnalysis.reasons.slice(0, 3)) {
        if (reason.suggestedAction) {
          suggestions.push(reason.suggestedAction);
        }
      }
    }

    return suggestions;
  }

  /**
   * Compare funnel performance over time
   */
  compareOverTime(
    currentResult: FunnelResult,
    previousResult: FunnelResult
  ): {
    improved: boolean;
    change: number;
    insights: string[];
  } {
    const currentRate = currentResult.overallConversionRate;
    const previousRate = previousResult.overallConversionRate;
    const change = currentRate - previousRate;
    const improved = change > 0;

    const insights: string[] = [];

    if (Math.abs(change) > 5) {
      insights.push(
        `Conversion rate ${improved ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}%`
      );
    }

    // Compare individual steps
    for (let i = 0; i < currentResult.stepResults.length; i++) {
      const current = currentResult.stepResults[i];
      const previous = previousResult.stepResults[i];

      if (!previous) continue;

      const stepChange = current.completionRate - previous.completionRate;

      if (Math.abs(stepChange) > 10) {
        insights.push(
          `Step "${current.stepName}" completion rate ${
            stepChange > 0 ? 'increased' : 'decreased'
          } by ${Math.abs(stepChange).toFixed(1)}%`
        );
      }
    }

    return {
      improved,
      change,
      insights,
    };
  }

  /**
   * Calculate funnel health score
   */
  calculateHealthScore(result: FunnelResult): {
    score: number;
    grade: string;
    factors: { name: string; score: number; weight: number }[];
  } {
    const factors: Array<{ name: string; score: number; weight: number }> = [];

    // Overall conversion rate (weight: 0.4)
    const conversionScore = Math.min(result.overallConversionRate / 100, 1);
    factors.push({ name: 'Conversion Rate', score: conversionScore, weight: 0.4 });

    // Drop-off rate (weight: 0.3)
    const avgDropOff =
      result.stepResults.reduce((sum, s) => sum + s.dropOffRate, 0) /
      result.stepResults.length;
    const dropOffScore = 1 - Math.min(avgDropOff / 100, 1);
    factors.push({ name: 'Drop-off Rate', score: dropOffScore, weight: 0.3 });

    // Time to complete (weight: 0.2)
    const timeScore = 1 - Math.min(result.timeToConvert.median / 300000, 1); // 5 min max
    factors.push({ name: 'Time to Complete', score: timeScore, weight: 0.2 });

    // Step consistency (weight: 0.1)
    const completionRates = result.stepResults.map((s) => s.completionRate);
    const avgRate = completionRates.reduce((a, b) => a + b, 0) / completionRates.length;
    const variance =
      completionRates.reduce((sum, r) => sum + Math.pow(r - avgRate, 2), 0) /
      completionRates.length;
    const consistencyScore = 1 - Math.min(variance / 10000, 1);
    factors.push({ name: 'Step Consistency', score: consistencyScore, weight: 0.1 });

    // Calculate weighted score
    const score = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

    // Determine grade
    let grade = 'F';
    if (score >= 0.9) grade = 'A';
    else if (score >= 0.8) grade = 'B';
    else if (score >= 0.7) grade = 'C';
    else if (score >= 0.6) grade = 'D';

    return {
      score: score * 100,
      grade,
      factors,
    };
  }
}
