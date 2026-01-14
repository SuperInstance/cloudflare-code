/**
 * Scaling analytics and insights
 */

import type {
  ScalingAnalytics,
  ScalingEvent,
  ScalingPattern,
  ScalingInsight,
  ScalingRecommendation,
  ScalingSummary,
  TimePeriod,
  PatternType,
  InsightCategory,
  InsightSeverity,
  RecommendationType,
  RecommendationPriority,
  ScalingEventType,
  ScalingStatus,
  ResourceState,
  UserImpact,
  ExpectedBenefit,
  RecommendationImplementation,
  OptimizationEffort,
  OptimizationRisk
} from '../types/index.js';
import { Logger } from '@claudeflare/logger';

export interface AnalyticsConfig {
  eventRetentionDays: number;
  minEventsForAnalysis: number;
  insightGenerationInterval: number;
}

export class ScalingAnalyticsEngine {
  private logger: Logger;
  private config: AnalyticsConfig;
  private events: Map<string, ScalingEvent[]> = new Map();
  private insights: Map<string, ScalingInsight[]> = new Map();
  private recommendations: Map<string, ScalingRecommendation[]> = new Map();

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.logger = new Logger('ScalingAnalyticsEngine');
    this.config = {
      eventRetentionDays: 30,
      minEventsForAnalysis: 10,
      insightGenerationInterval: 3600000, // 1 hour
      ...config
    };
  }

  /**
   * Record a scaling event
   */
  recordEvent(event: ScalingEvent): void {
    const resourceId = event.trigger;

    if (!this.events.has(resourceId)) {
      this.events.set(resourceId, []);
    }

    const history = this.events.get(resourceId)!;
    history.push(event);

    // Enforce retention
    const maxAge = Date.now() - this.config.eventRetentionDays * 24 * 60 * 60 * 1000;
    const validEvents = history.filter((e) => e.timestamp.getTime() > maxAge);

    this.events.set(resourceId, validEvents);

    // Generate insights
    this.generateInsights(resourceId);
  }

  /**
   * Get comprehensive analytics for a resource
   */
  getAnalytics(resourceId: string, period: TimePeriod): ScalingAnalytics {
    const allEvents = this.events.get(resourceId) || [];
    const filteredEvents = allEvents.filter(
      (e) => e.timestamp >= period.start && e.timestamp <= period.end
    );

    const patterns = this.detectPatterns(filteredEvents);
    const insights = this.insights.get(resourceId) || [];
    const recommendations = this.recommendations.get(resourceId) || [];
    const summary = this.calculateSummary(filteredEvents);

    return {
      resourceId,
      period,
      events: filteredEvents,
      patterns,
      insights,
      recommendations,
      summary
    };
  }

  /**
   * Detect patterns in scaling events
   */
  private detectPatterns(events: ScalingEvent[]): ScalingPattern[] {
    const patterns: ScalingPattern[] = [];

    if (events.length < this.config.minEventsForAnalysis) {
      return patterns;
    }

    // Detect time-based patterns
    const timePatterns = this.detectTimePatterns(events);
    patterns.push(...timePatterns);

    // Detect scale-up patterns
    const scaleUpPatterns = this.detectScaleUpPatterns(events);
    patterns.push(...scaleUpPatterns);

    // Detect scale-down patterns
    const scaleDownPatterns = this.detectScaleDownPatterns(events);
    patterns.push(...scaleDownPatterns);

    // Detect anomalies
    const anomalies = this.detectAnomalies(events);
    patterns.push(...anomalies);

    return patterns;
  }

  /**
   * Detect time-based patterns
   */
  private detectTimePatterns(events: ScalingEvent[]): ScalingPattern[] {
    const patterns: ScalingPattern[] = [];

    // Group events by hour of day
    const hourlyEvents = new Map<number, ScalingEvent[]>();
    for (const event of events) {
      const hour = event.timestamp.getHours();
      if (!hourlyEvents.has(hour)) {
        hourlyEvents.set(hour, []);
      }
      hourlyEvents.get(hour)!.push(event);
    }

    // Find hours with high scaling activity
    const avgEventsPerHour = events.length / 24;
    for (const [hour, hourEvents] of hourlyEvents) {
      if (hourEvents.length > avgEventsPerHour * 2) {
        patterns.push({
          type: PatternType.SEASONAL,
          description: `High scaling activity around ${hour}:00`,
          confidence: Math.min(0.95, hourEvents.length / events.length),
          occurrences: hourEvents.length,
          schedule: {
            frequency: 'daily',
            days: Array.from({ length: 7 }, (_, i) => i)
          },
          characteristics: {
            hour,
            eventCount: hourEvents.length
          }
        });
      }
    }

    return patterns;
  }

  /**
   * Detect scale-up patterns
   */
  private detectScaleUpPatterns(events: ScalingEvent[]): ScalingPattern[] {
    const patterns: ScalingPattern[] = [];

    const scaleUpEvents = events.filter((e) => e.type === ScalingEventType.SCALE_UP);

    if (scaleUpEvents.length < 5) {
      return patterns;
    }

    // Analyze scale-up triggers
    const triggerCounts = new Map<string, number>();
    for (const event of scaleUpEvents) {
      const trigger = event.trigger;
      triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
    }

    // Find common triggers
    for (const [trigger, count] of triggerCounts) {
      if (count >= scaleUpEvents.length * 0.3) {
        patterns.push({
          type: PatternType.CORRELATED,
          description: `Frequent scale-ups triggered by ${trigger}`,
          confidence: count / scaleUpEvents.length,
          occurrences: count,
          characteristics: {
            trigger,
            percentage: (count / scaleUpEvents.length) * 100
          }
        });
      }
    }

    return patterns;
  }

  /**
   * Detect scale-down patterns
   */
  private detectScaleDownPatterns(events: ScalingEvent[]): ScalingPattern[] {
    const patterns: ScalingPattern[] = [];

    const scaleDownEvents = events.filter((e) => e.type === ScalingEventType.SCALE_DOWN);

    if (scaleDownEvents.length < 5) {
      return patterns;
    }

    // Check if scale-downs often follow scale-ups
    let followedByScaleDown = 0;
    for (let i = 0; i < events.length - 1; i++) {
      if (
        events[i].type === ScalingEventType.SCALE_UP &&
        events[i + 1].type === ScalingEventType.SCALE_DOWN
      ) {
        followedByScaleDown++;
      }
    }

    if (followedByScaleDown >= scaleDownEvents.length * 0.5) {
      patterns.push({
        type: PatternType.ANOMALY,
        description: 'Frequent scale-up/scale-down oscillations detected',
        confidence: followedByScaleDown / scaleDownEvents.length,
        occurrences: followedByScaleDown,
        characteristics: {
          oscillationRate: followedByScaleDown / scaleDownEvents.length
        }
      });
    }

    return patterns;
  }

  /**
   * Detect anomalies in scaling events
   */
  private detectAnomalies(events: ScalingEvent[]): ScalingPattern[] {
    const patterns: ScalingPattern[] = [];

    // Look for failed scaling events
    const failedEvents = events.filter((e) => e.status === ScalingStatus.FAILED);

    if (failedEvents.length > events.length * 0.1) {
      patterns.push({
        type: PatternType.ANOMALY,
        description: `High failure rate: ${failedEvents.length}/${events.length} events failed`,
        confidence: failedEvents.length / events.length,
        occurrences: failedEvents.length,
        characteristics: {
          failureRate: failedEvents.length / events.length
        }
      });
    }

    // Look for very long scaling operations
    const avgDuration =
      events.reduce((sum, e) => sum + e.duration, 0) / events.length;
    const slowEvents = events.filter((e) => e.duration > avgDuration * 3);

    if (slowEvents.length > 0) {
      patterns.push({
        type: PatternType.ANOMALY,
        description: `${slowEvents.length} scaling operations took 3x longer than average`,
        confidence: 0.8,
        occurrences: slowEvents.length,
        characteristics: {
          avgDuration,
          slowEventsCount: slowEvents.length
        }
      });
    }

    return patterns;
  }

  /**
   * Generate insights from events
   */
  private generateInsights(resourceId: string): void {
    const events = this.events.get(resourceId) || [];
    if (events.length < this.config.minEventsForAnalysis) {
      return;
    }

    const insights: ScalingInsight[] = [];

    // Performance insights
    const performanceInsights = this.generatePerformanceInsights(events);
    insights.push(...performanceInsights);

    // Cost insights
    const costInsights = this.generateCostInsights(events);
    insights.push(...costInsights);

    // Availability insights
    const availabilityInsights = this.generateAvailabilityInsights(events);
    insights.push(...availabilityInsights);

    // Efficiency insights
    const efficiencyInsights = this.generateEfficiencyInsights(events);
    insights.push(...efficiencyInsights);

    this.insights.set(resourceId, insights);

    // Generate recommendations
    this.generateRecommendations(resourceId, events, insights);
  }

  /**
   * Generate performance insights
   */
  private generatePerformanceInsights(events: ScalingEvent[]): ScalingInsight[] {
    const insights: ScalingInsight[] = [];

    const scaleUpEvents = events.filter((e) => e.type === ScalingEventType.SCALE_UP);

    // Check if scaling is keeping up with demand
    const avgPerformanceChange =
      scaleUpEvents.reduce((sum, e) => sum + e.impact.performanceChange, 0) /
      scaleUpEvents.length;

    if (avgPerformanceChange < 0.2) {
      insights.push({
        category: InsightCategory.PERFORMANCE,
        severity: InsightSeverity.WARNING,
        title: 'Limited performance improvement from scaling',
        description: `Scaling events are showing low performance improvements (${(avgPerformanceChange * 100).toFixed(1)}% average)`,
        evidence: [
          `Analyzed ${scaleUpEvents.length} scale-up events`,
          `Average performance change: ${(avgPerformanceChange * 100).toFixed(1)}%`
        ],
        impact: 'Scaling may not be addressing performance bottlenecks effectively',
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Generate cost insights
   */
  private generateCostInsights(events: ScalingEvent[]): ScalingInsight[] {
    const insights: ScalingInsight[] = [];

    // Check for cost-inefficient scaling patterns
    const scaleUpDownPairs: Array<{ up: ScalingEvent; down: ScalingEvent }> = [];

    for (let i = 0; i < events.length - 1; i++) {
      if (
        events[i].type === ScalingEventType.SCALE_UP &&
        events[i + 1].type === ScalingEventType.SCALE_DOWN
      ) {
        const timeDiff = events[i + 1].timestamp.getTime() - events[i].timestamp.getTime();
        if (timeDiff < 3600000) {
          // Less than 1 hour
          scaleUpDownPairs.push({ up: events[i], down: events[i + 1] });
        }
      }
    }

    if (scaleUpDownPairs.length > events.length * 0.1) {
      insights.push({
        category: InsightCategory.COST,
        severity: InsightSeverity.WARNING,
        title: 'Frequent scale oscillations increasing costs',
        description: `${scaleUpDownPairs.length} instances of scale-up followed by scale-down within 1 hour`,
        evidence: [
          `${scaleUpDownPairs.length} oscillation patterns detected`,
          'This pattern may indicate suboptimal scaling thresholds'
        ],
        impact: 'Unnecessary scaling operations are increasing costs without benefit',
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Generate availability insights
   */
  private generateAvailabilityInsights(events: ScalingEvent[]): ScalingInsight[] {
    const insights: ScalingInsight[] = [];

    const failedEvents = events.filter((e) => e.status === ScalingStatus.FAILED);

    if (failedEvents.length > 0) {
      insights.push({
        category: InsightCategory.AVAILABILITY,
        severity: InsightSeverity.CRITICAL,
        title: 'Scaling failures detected',
        description: `${failedEvents.length} scaling operations have failed`,
        evidence: failedEvents.map((e) => `${e.type} at ${e.timestamp.toISOString()}`),
        impact: 'Failed scaling operations may impact service availability',
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Generate efficiency insights
   */
  private generateEfficiencyInsights(events: ScalingEvent[]): ScalingInsight[] {
    const insights: ScalingInsight[] = [];

    // Check scaling speed
    const avgDuration =
      events.reduce((sum, e) => sum + e.duration, 0) / events.length;

    if (avgDuration > 300000) {
      // More than 5 minutes
      insights.push({
        category: InsightCategory.EFFICIENCY,
        severity: InsightSeverity.WARNING,
        title: 'Slow scaling operations detected',
        description: `Average scaling time is ${(avgDuration / 1000).toFixed(0)}s`,
        evidence: [`Average duration across ${events.length} events: ${(avgDuration / 1000).toFixed(0)}s`],
        impact: 'Slow scaling may not keep up with rapid demand changes',
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    resourceId: string,
    events: ScalingEvent[],
    insights: ScalingInsight[]
  ): void {
    const recommendations: ScalingRecommendation[] = [];

    // Analyze insights and create recommendations
    for (const insight of insights) {
      const recs = this.createRecommendationsFromInsight(insight);
      recommendations.push(...recs);
    }

    // Add pattern-based recommendations
    const patterns = this.detectPatterns(events);
    for (const pattern of patterns) {
      const recs = this.createRecommendationsFromPattern(pattern, resourceId);
      recommendations.push(...recs);
    }

    // Prioritize recommendations
    recommendations.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    this.recommendations.set(resourceId, recommendations);
  }

  /**
   * Create recommendations from insights
   */
  private createRecommendationsFromInsight(insight: ScalingInsight): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];

    switch (insight.category) {
      case InsightCategory.PERFORMANCE:
        recommendations.push({
          id: `rec-perf-${Date.now()}`,
          type: RecommendationType.CHANGE_POLICY,
          priority: insight.severity === InsightSeverity.CRITICAL ? 'high' : 'medium',
          title: 'Optimize scaling thresholds for performance',
          description: insight.description,
          rationale: insight.impact,
          expectedBenefit: {
            performance: 0.3,
            cost: 0.1,
            reliability: 0.2
          },
          implementation: {
            steps: [
              'Review current scaling thresholds',
              'Analyze performance metrics during scaling events',
              'Adjust thresholds based on actual performance data'
            ],
            estimatedTime: 120,
            complexity: OptimizationEffort.MEDIUM,
            risk: OptimizationRisk.LOW,
            rollbackPlan: 'Revert to previous thresholds'
          },
          createdAt: new Date()
        });
        break;

      case InsightCategory.COST:
        recommendations.push({
          id: `rec-cost-${Date.now()}`,
          type: RecommendationType.COST_OPTIMIZATION,
          priority: 'medium',
          title: 'Reduce scaling oscillations',
          description: insight.description,
          rationale: insight.impact,
          expectedBenefit: {
            performance: 0,
            cost: 0.25,
            reliability: 0.1
          },
          implementation: {
            steps: [
              'Increase cooldown periods',
              'Adjust scale-down thresholds',
              'Implement hysteresis to prevent oscillations'
            ],
            estimatedTime: 60,
            complexity: OptimizationEffort.LOW,
            risk: OptimizationRisk.LOW,
            rollbackPlan: 'Restore original thresholds'
          },
          createdAt: new Date()
        });
        break;

      case InsightCategory.AVAILABILITY:
        recommendations.push({
          id: `rec-avail-${Date.now()}`,
          type: RecommendationType.CHANGE_POLICY,
          priority: 'urgent',
          title: 'Fix scaling failures',
          description: insight.description,
          rationale: insight.impact,
          expectedBenefit: {
            performance: 0.2,
            cost: 0,
            reliability: 0.4
          },
          implementation: {
            steps: [
              'Investigate failure root causes',
              'Fix underlying issues',
              'Add better error handling',
              'Implement fallback mechanisms'
            ],
            estimatedTime: 240,
            complexity: OptimizationEffort.HIGH,
            risk: OptimizationRisk.MEDIUM,
            rollbackPlan: 'Disable problematic scaling actions'
          },
          createdAt: new Date()
        });
        break;

      case InsightCategory.EFFICIENCY:
        recommendations.push({
          id: `rec-eff-${Date.now()}`,
          type: RecommendationType.ARCHITECTURE_CHANGE,
          priority: 'medium',
          title: 'Optimize scaling speed',
          description: insight.description,
          rationale: insight.impact,
          expectedBenefit: {
            performance: 0.2,
            cost: 0.1,
            reliability: 0.3
          },
          implementation: {
            steps: [
              'Pre-provision resources',
              'Use faster scaling mechanisms',
              'Optimize infrastructure initialization'
            ],
            estimatedTime: 180,
            complexity: OptimizationEffort.MEDIUM,
            risk: OptimizationRisk.MEDIUM,
            rollbackPlan: 'Revert to previous scaling approach'
          },
          createdAt: new Date()
        });
        break;
    }

    return recommendations;
  }

  /**
   * Create recommendations from patterns
   */
  private createRecommendationsFromPattern(
    pattern: ScalingPattern,
    resourceId: string
  ): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];

    switch (pattern.type) {
      case PatternType.SEASONAL:
        recommendations.push({
          id: `rec-seasonal-${Date.now()}`,
          type: RecommendationType.SCHEDULE_SCALING,
          priority: 'medium',
          title: 'Implement scheduled scaling',
          description: pattern.description,
          rationale: 'Predictable patterns can be handled with scheduled scaling',
          expectedBenefit: {
            performance: 0.2,
            cost: 0.15,
            reliability: 0.2
          },
          implementation: {
            steps: [
              'Define scaling schedules based on detected patterns',
              'Configure time-based scaling policies',
              'Monitor and adjust schedules'
            ],
            estimatedTime: 90,
            complexity: OptimizationEffort.LOW,
            risk: OptimizationRisk.LOW,
            rollbackPlan: 'Disable scheduled scaling'
          },
          createdAt: new Date()
        });
        break;

      case PatternType.ANOMALY:
        if (pattern.description.includes('oscillation')) {
          recommendations.push({
            id: `rec-osc-${Date.now()}`,
            type: RecommendationType.CHANGE_POLICY,
            priority: 'high',
            title: 'Fix scaling oscillation',
            description: pattern.description,
            rationale: 'Oscillations waste resources and may cause instability',
            expectedBenefit: {
              performance: 0.1,
              cost: 0.2,
              reliability: 0.2
            },
            implementation: {
              steps: [
                'Add hysteresis to scaling thresholds',
                'Increase cooldown periods',
                'Review and adjust trigger conditions'
              ],
              estimatedTime: 60,
              complexity: OptimizationEffort.LOW,
              risk: OptimizationRisk.LOW,
              rollbackPlan: 'Restore previous thresholds'
            },
            createdAt: new Date()
          });
        }
        break;
    }

    return recommendations;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(events: ScalingEvent[]): ScalingSummary {
    if (events.length === 0) {
      return {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        averageScaleTime: 0,
        totalCostSavings: 0,
        performanceImprovement: 0,
        uptime: 100
      };
    }

    const successfulEvents = events.filter((e) => e.status === ScalingStatus.SUCCESS).length;
    const failedEvents = events.filter((e) => e.status === ScalingStatus.FAILED).length;
    const averageScaleTime = events.reduce((sum, e) => sum + e.duration, 0) / events.length;

    const totalCostSavings = events.reduce((sum, e) => sum + Math.abs(e.impact.costChange), 0);

    const performanceImprovement =
      events
        .filter((e) => e.type === ScalingEventType.SCALE_UP)
        .reduce((sum, e) => sum + e.impact.performanceChange, 0) /
      events.filter((e) => e.type === ScalingEventType.SCALE_UP).length || 0;

    const uptime = 100 - (failedEvents / events.length) * 100;

    return {
      totalEvents: events.length,
      successfulEvents,
      failedEvents,
      averageScaleTime,
      totalCostSavings,
      performanceImprovement,
      uptime
    };
  }

  /**
   * Get recommendations for a resource
   */
  getRecommendations(resourceId: string): ScalingRecommendation[] {
    return this.recommendations.get(resourceId) || [];
  }

  /**
   * Get insights for a resource
   */
  getInsights(resourceId: string): ScalingInsight[] {
    return this.insights.get(resourceId) || [];
  }

  /**
   * Clear all data for a resource
   */
  clearResourceData(resourceId: string): void {
    this.events.delete(resourceId);
    this.insights.delete(resourceId);
    this.recommendations.delete(resourceId);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }
}
