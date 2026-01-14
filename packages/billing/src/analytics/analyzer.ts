/**
 * Usage analytics and forecasting system
 */

import {
  UsageSummary,
  UsageMetricSummary,
  CostBreakdown,
  CostItem,
  UsageForecast,
  ForecastData,
  RevenueMetrics,
  ChurnAnalysis,
  ChurnReason,
  PlanType,
  UsageMetricType,
} from '../types/index.js';
import { pricingManager } from '../pricing/index.js';

/**
 * Usage analyzer for analytics and forecasting
 */
export class UsageAnalyzer {
  /**
   * Generate usage summary for an organization
   */
  async generateUsageSummary(params: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    usageData: {
      requests: number;
      tokens: number;
      cpuTime: number;
      storage: number;
      bandwidth: number;
      apiCalls: number;
    };
    planType: PlanType;
  }): Promise<UsageSummary> {
    const { organizationId, periodStart, periodEnd, usageData, planType } = params;

    const plan = pricingManager.getTierByPlan(planType, 'monthly');
    if (!plan) {
      throw new Error(`Plan ${planType} not found`);
    }

    const metrics = {
      requests: this.calculateMetricSummary(
        usageData.requests,
        'requests',
        plan.limits.requestsPerMonth
      ),
      tokens: this.calculateMetricSummary(
        usageData.tokens,
        'tokens',
        plan.limits.tokensPerMonth
      ),
      cpuTime: this.calculateMetricSummary(
        usageData.cpuTime,
        'seconds',
        plan.limits.cpuTimePerMonth
      ),
      storage: this.calculateMetricSummary(
        usageData.storage,
        'bytes',
        plan.limits.storage
      ),
      bandwidth: this.calculateMetricSummary(
        usageData.bandwidth,
        'bytes',
        plan.limits.bandwidth
      ),
      apiCalls: this.calculateMetricSummary(
        usageData.apiCalls,
        'calls',
        plan.limits.apiCallsPerMonth
      ),
    };

    const costBreakdown = this.calculateCostBreakdown(plan, usageData);

    return {
      organizationId,
      periodStart,
      periodEnd,
      metrics,
      costBreakdown,
    };
  }

  /**
   * Calculate metric summary with utilization
   */
  private calculateMetricSummary(
    total: number,
    unit: string,
    limit: number
  ): UsageMetricSummary {
    const summary: UsageMetricSummary = {
      total,
      average: total, // Would be more complex with time-series data
      peak: total, // Would require historical data
      unit,
    };

    if (limit !== -1) {
      summary.limit = limit;
      summary.utilizationPercent = (total / limit) * 100;
    }

    return summary;
  }

  /**
   * Calculate cost breakdown
   */
  private calculateCostBreakdown(
    plan: any,
    usageData: Record<string, number>
  ): CostBreakdown {
    const baseCost = plan.price;

    // Calculate overage costs
    const overageCost = pricingManager.calculateTotalOverageCost(plan, usageData);

    const items: CostItem[] = [
      {
        name: `${plan.name} Plan (${plan.interval})`,
        quantity: 1,
        unitPrice: baseCost,
        amount: baseCost,
      },
    ];

    // Add overage items
    if (overageCost > 0) {
      items.push({
        name: 'Overage Usage',
        quantity: 1,
        unitPrice: overageCost,
        amount: overageCost,
      });
    }

    return {
      baseCost,
      usageCost: overageCost,
      overageCost,
      totalCost: baseCost + overageCost,
      currency: plan.currency,
      items,
    };
  }

  /**
   * Generate usage forecast
   */
  async generateForecast(params: {
    organizationId: string;
    forecastStart: Date;
    forecastEnd: Date;
    historicalData: {
      requests: number[];
      tokens: number[];
      cpuTime: number[];
      storage: number[];
      bandwidth: number[];
    };
    planType: PlanType;
  }): Promise<UsageForecast> {
    const { organizationId, forecastStart, forecastEnd, historicalData, planType } = params;

    const plan = pricingManager.getTierByPlan(planType, 'monthly');
    if (!plan) {
      throw new Error(`Plan ${planType} not found`);
    }

    // Calculate forecast for each metric
    const requests = this.calculateForecast(historicalData.requests, 'requests');
    const tokens = this.calculateForecast(historicalData.tokens, 'tokens');
    const cpuTime = this.calculateForecast(historicalData.cpuTime, 'seconds');
    const storage = this.calculateForecast(historicalData.storage, 'bytes');
    const bandwidth = this.calculateForecast(historicalData.bandwidth, 'bytes');

    // Calculate projected cost
    const projectedUsage = {
      requests: requests.projected,
      tokens: tokens.projected,
      cpuTime: cpuTime.projected,
      storage: storage.projected,
      bandwidth: bandwidth.projected,
      apiCalls: 0, // Would be calculated from historical data
    };

    const projectedCost = pricingManager.calculateTotalOverageCost(
      plan,
      projectedUsage
    ) + plan.price;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      plan,
      projectedUsage,
      { requests, tokens, cpuTime, storage, bandwidth }
    );

    return {
      organizationId,
      forecastPeriod: {
        start: forecastStart,
        end: forecastEnd,
      },
      metrics: {
        requests,
        tokens,
        cpuTime,
        storage,
        bandwidth,
      },
      projectedCost,
      recommendations,
    };
  }

  /**
   * Calculate forecast for a single metric
   */
  private calculateForecast(
    historicalData: number[],
    unit: string
  ): ForecastData {
    if (historicalData.length === 0) {
      return {
        projected: 0,
        trend: 'stable',
        confidence: 0,
        unit,
      };
    }

    // Calculate simple linear regression
    const n = historicalData.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = historicalData.reduce((a, b) => a + b, 0);
    const sumXY = historicalData.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Project next value
    const projected = slope * n + intercept;

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (slope > 0.01) {
      trend = 'increasing';
    } else if (slope < -0.01) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    // Calculate confidence (simplified)
    const variance =
      historicalData.reduce((sum, y, x) => {
        const predicted = slope * x + intercept;
        return sum + Math.pow(y - predicted, 2);
      }, 0) / n;
    const mean = sumY / n;
    const confidence = Math.max(0, 1 - variance / (mean * mean));

    return {
      projected: Math.max(0, projected),
      trend,
      confidence: Math.min(1, confidence),
      unit,
    };
  }

  /**
   * Generate recommendations based on forecast
   */
  private generateRecommendations(
    plan: any,
    projectedUsage: Record<string, number>,
    forecasts: Record<string, ForecastData>
  ): string[] {
    const recommendations: string[] = [];

    // Check if approaching limits
    const utilizationThreshold = 0.8;

    if (plan.limits.requestsPerMonth !== -1) {
      const utilization = projectedUsage.requests / plan.limits.requestsPerMonth;
      if (utilization > utilizationThreshold) {
        const nextPlan = pricingManager.getTierByPlan(
          this.getNextPlan(plan.type),
          'monthly'
        );
        if (nextPlan) {
          recommendations.push(
            `Request usage is projected to reach ${(utilization * 100).toFixed(
              1
            )}% of limit. Consider upgrading to ${nextPlan.name} plan.`
          );
        }
      }
    }

    if (plan.limits.tokensPerMonth !== -1) {
      const utilization = projectedUsage.tokens / plan.limits.tokensPerMonth;
      if (utilization > utilizationThreshold) {
        recommendations.push(
          `Token usage is projected to reach ${(utilization * 100).toFixed(
            1
          )}% of limit.`
        );
      }
    }

    if (plan.limits.storage !== -1) {
      const utilization = projectedUsage.storage / plan.limits.storage;
      if (utilization > utilizationThreshold) {
        recommendations.push(
          `Storage usage is projected to reach ${(utilization * 100).toFixed(
            1
            )}% of limit. Consider archiving old data or upgrading.`
          );
      }
    }

    // Analyze trends
    if (forecasts.requests.trend === 'increasing' && forecasts.requests.confidence > 0.7) {
      recommendations.push(
        'Request usage is trending upward. Monitor usage closely to avoid overages.'
      );
    }

    if (forecasts.bandwidth.trend === 'increasing' && forecasts.bandwidth.confidence > 0.7) {
      recommendations.push(
        'Bandwidth usage is trending upward. Review API response sizes and consider compression.'
      );
    }

    // Cost optimization
    const projectedOverage = pricingManager.calculateTotalOverageCost(
      plan,
      projectedUsage
    );
    if (projectedOverage > plan.price * 0.5) {
      const nextPlan = pricingManager.getTierByPlan(
        this.getNextPlan(plan.type),
        'monthly'
      );
      if (nextPlan && nextPlan.price < plan.price + projectedOverage) {
        recommendations.push(
          `Projected overage costs ($${projectedOverage.toFixed(2)}) make upgrading to ${nextPlan.name} plan ($${nextPlan.price}/month) more cost-effective.`
        );
      }
    }

    return recommendations;
  }

  /**
   * Get next plan in hierarchy
   */
  private getNextPlan(currentPlan: PlanType): PlanType {
    const hierarchy = [PlanType.FREE, PlanType.PRO, PlanType.TEAM, PlanType.ENTERPRISE];
    const currentIndex = hierarchy.indexOf(currentPlan);
    if (currentIndex < hierarchy.length - 1) {
      return hierarchy[currentIndex + 1];
    }
    return currentPlan;
  }

  /**
   * Calculate revenue metrics
   */
  async calculateRevenueMetrics(params: {
    subscriptions: Array<{
      planId: string;
      status: string;
      createdAt: Date;
      canceledAt?: Date;
    }>;
    churnedSubscriptions: Array<{
      planId: string;
      canceledAt: Date;
      lifetimeValue: number;
    }>;
  }): Promise<RevenueMetrics> {
    const { subscriptions, churnedSubscriptions } = params;

    // Active subscriptions
    const activeSubscriptions = subscriptions.filter(
      (s) => s.status === 'active' || s.status === 'trialing'
    );

    // Calculate MRR
    let mrr = 0;
    for (const sub of activeSubscriptions) {
      const plan = pricingManager.getTier(sub.planId);
      if (plan) {
        const monthlyAmount =
          plan.interval === 'yearly' ? plan.price / 12 : plan.price;
        mrr += monthlyAmount;
      }
    }

    // Calculate ARR
    const arr = mrr * 12;

    // Calculate ARPU
    const arpu = activeSubscriptions.length > 0 ? mrr / activeSubscriptions.length : 0;

    // Calculate LTV
    const avgLifetimeValue =
      churnedSubscriptions.length > 0
        ? churnedSubscriptions.reduce((sum, s) => sum + s.lifetimeValue, 0) /
          churnedSubscriptions.length
        : 0;

    // Calculate churn rate (monthly)
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const churnedLastMonth = churnedSubscriptions.filter(
      (s) => s.canceledAt >= lastMonth
    ).length;
    const churnRate = activeSubscriptions.length > 0 ? churnedLastMonth / activeSubscriptions.length : 0;

    // Calculate growth rate (simplified)
    const growthRate = 0.1; // Would be calculated from historical data

    return {
      mrr,
      arr,
      arpu,
      ltv: avgLifetimeValue,
      churnRate,
      growthRate,
    };
  }

  /**
   * Analyze churn
   */
  async analyzeChurn(params: {
    totalSubscriptions: number;
    churnedSubscriptions: Array<{
      planId: string;
      canceledAt: Date;
      reason?: string;
    }>;
  }): Promise<ChurnAnalysis> {
    const { totalSubscriptions, churnedSubscriptions } = params;

    const totalChurned = churnedSubscriptions.length;
    const churnRate = totalSubscriptions > 0 ? totalChurned / totalSubscriptions : 0;

    // Analyze reasons
    const reasonCounts: Record<string, number> = {};
    for (const sub of churnedSubscriptions) {
      const reason = sub.reason || 'unspecified';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }

    const reasons: ChurnReason[] = Object.entries(reasonCounts)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: (count / totalChurned) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // Analyze by plan
    const byPlan: Record<PlanType, number> = {
      [PlanType.FREE]: 0,
      [PlanType.PRO]: 0,
      [PlanType.TEAM]: 0,
      [PlanType.ENTERPRISE]: 0,
    };

    for (const sub of churnedSubscriptions) {
      const plan = pricingManager.getTier(sub.planId);
      if (plan && byPlan[plan.type] !== undefined) {
        byPlan[plan.type]++;
      }
    }

    return {
      totalSubscriptions,
      churnedSubscriptions: totalChurned,
      churnRate,
      reasons,
      byPlan,
    };
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(params: {
    organizationId: string;
    metric: UsageMetricType;
    startDate: Date;
    endDate: Date;
    granularity: 'day' | 'week' | 'month';
    historicalData: Array<{
      timestamp: Date;
      value: number;
    }>;
  }): Promise<Array<{
    timestamp: Date;
    value: number;
    movingAverage?: number;
  }>> {
    const { historicalData, granularity } = params;

    // Group by time period
    const grouped = new Map<string, number[]>();

    for (const dataPoint of historicalData) {
      const key = this.getGroupingKey(dataPoint.timestamp, granularity);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(dataPoint.value);
    }

    // Aggregate and calculate moving average
    const result = Array.from(grouped.entries())
      .map(([key, values]) => {
        const timestamp = this.parseGroupingKey(key, granularity);
        const value = values.reduce((a, b) => a + b, 0) / values.length;
        return { timestamp, value };
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate moving average (3-period)
    const windowSize = 3;
    for (let i = 0; i < result.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const end = i + 1;
      const window = result.slice(start, end);
      const movingAverage =
        window.reduce((sum, d) => sum + d.value, 0) / window.length;
      result[i].movingAverage = movingAverage;
    }

    return result;
  }

  /**
   * Get grouping key for time period
   */
  private getGroupingKey(date: Date, granularity: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (granularity) {
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week':
        const weekNum = this.getWeekNumber(date);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
      case 'month':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Parse grouping key to date
   */
  private parseGroupingKey(key: string, granularity: string): Date {
    switch (granularity) {
      case 'day':
        return new Date(key + 'T00:00:00Z');
      case 'week':
        const [year, week] = key.split('-W');
        return this.getDateFromWeekNumber(parseInt(year), parseInt(week));
      case 'month':
        return new Date(key + '-01T00:00:00Z');
      default:
        return new Date(key + 'T00:00:00Z');
    }
  }

  /**
   * Get week number from date
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Get date from week number
   */
  private getDateFromWeekNumber(year: number, week: number): Date {
    const date = new Date(year, 0, 1 + (week - 1) * 7);
    return date;
  }
}

/**
 * Create a usage analyzer
 */
export function createUsageAnalyzer(): UsageAnalyzer {
  return new UsageAnalyzer();
}
