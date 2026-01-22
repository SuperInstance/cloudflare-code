/**
 * Revenue Analytics Module
 * Comprehensive revenue metrics, forecasting, and financial analytics
 */

import type {
  AnalyticsEvent,
  RevenueMetrics,
  MRRMetrics,
  ARRMetrics,
  RevenueChurnMetrics,
  ExpansionRevenueMetrics,
  RevenueForecasting,
  RevenueTrends,
  RevenueSegmentation,
} from '../types/index.js';

/**
 * Revenue Analytics Engine
 */
export class RevenueAnalytics {
  /**
   * Calculate comprehensive revenue metrics
   */
  async calculateMetrics(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<RevenueMetrics> {
    return {
      mrr: await this.calculateMRR(events, timeRange),
      arr: await this.calculateARR(events, timeRange),
      arpu: await this.calculateARPU(events, timeRange),
      ltv: await this.calculateLTV(events, timeRange),
      cac: await this.calculateCAC(events, timeRange),
      ltvCacRatio: 0, // Calculated after LTV and CAC
      churn: await this.calculateRevenueChurn(events, timeRange),
      expansion: await this.calculateExpansionRevenue(events, timeRange),
      forecasting: await this.forecastRevenue(events, timeRange),
      trends: await this.analyzeRevenueTrends(events, timeRange),
      segmentation: await this.analyzeRevenueSegmentation(events, timeRange),
    };
  }

  /**
   * Calculate Monthly Recurring Revenue (MRR)
   */
  async calculateMRR(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<MRRMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    // Calculate MRR components
    const subscriptions = periodEvents.filter((e) => e.type === 'subscription');

    let current = 0;
    let newMRR = 0;
    let expansion = 0;
    let contraction = 0;
    let churn = 0;

    for (const event of subscriptions) {
      const amount = event.properties.amount || 0;
      const action = event.properties.action; // new, upgrade, downgrade, cancel

      switch (action) {
        case 'new':
          current += amount;
          newMRR += amount;
          break;
        case 'upgrade':
          current += amount;
          expansion += amount;
          break;
        case 'downgrade':
          contraction += amount;
          break;
        case 'cancel':
          churn += amount;
          break;
        default:
          current += amount;
      }
    }

    // Calculate previous period MRR
    const previousMs = timeRange.start - (timeRange.end - timeRange.start);
    const previousEvents = events.filter(
      (e) => e.timestamp >= previousMs && e.timestamp < timeRange.start
    );
    const previous = previousEvents
      .filter((e) => e.type === 'subscription')
      .reduce((sum, e) => sum + (e.properties.amount || 0), 0);

    const growth = current - previous;
    const growthRate = previous > 0 ? (growth / previous) * 100 : 0;

    return {
      current,
      new: newMRR,
      expansion,
      contraction,
      churn,
      previous,
      growth,
      growthRate,
    };
  }

  /**
   * Calculate Annual Recurring Revenue (ARR)
   */
  async calculateARR(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<ARRMetrics> {
    const mrr = await this.calculateMRR(events, timeRange);
    const current = mrr.current * 12;

    // Forecast ARR based on current growth rate
    const monthlyGrowthRate = mrr.growthRate / 100;
    const forecast = current * Math.pow(1 + monthlyGrowthRate, 12);

    // Breakdown by plan
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );
    const byPlan = this.groupRevenueByPlan(periodEvents);

    // Breakdown by segment
    const bySegment = this.groupRevenueBySegment(periodEvents);

    return {
      current,
      forecast,
      yearOverYear: mrr.growthRate * 12,
      byPlan,
      bySegment,
    };
  }

  /**
   * Calculate Average Revenue Per User (ARPU)
   */
  async calculateARPU(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<number> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const totalRevenue = periodEvents
      .filter((e) => ['purchase', 'subscription'].includes(e.type))
      .reduce((sum, e) => sum + (e.properties.amount || e.properties.value || 0), 0);

    const uniqueUsers = new Set(periodEvents.map((e) => e.userId)).size;

    return uniqueUsers > 0 ? totalRevenue / uniqueUsers : 0;
  }

  /**
   * Calculate Lifetime Value (LTV)
   */
  async calculateLTV(events: AnalyticsEvent[], timeRange: { start: number; end: number }): Promise<number> {
    const arpu = await this.calculateARPU(events, timeRange);

    // Calculate average customer lifetime
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const churnEvents = periodEvents.filter((e) =>
      e.type === 'subscription' && e.properties.action === 'cancel'
    );

    const avgLifetime = churnEvents.length > 0
      ? churnEvents.reduce((sum, e) => {
          const userEvents = events.filter((ev) => ev.userId === e.userId);
          const firstEvent = Math.min(...userEvents.map((ev) => ev.timestamp));
          return sum + (e.timestamp - firstEvent);
        }, 0) / churnEvents.length
      : 0;

    const lifetimeInMonths = avgLifetime / (30 * 24 * 60 * 60 * 1000);

    return arpu * lifetimeInMonths;
  }

  /**
   * Calculate Customer Acquisition Cost (CAC)
   */
  async calculateCAC(events: AnalyticsEvent[], timeRange: { start: number; end: number }): Promise<number> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    // Calculate total acquisition spend
    const acquisitionSpend = periodEvents
      .filter((e) => e.properties.marketing_spend || e.properties.acquisition_cost)
      .reduce((sum, e) => sum + (e.properties.marketing_spend || e.properties.acquisition_cost || 0), 0);

    // Count new customers
    const newCustomers = new Set(
      periodEvents
        .filter((e) => e.type === 'signup')
        .map((e) => e.userId)
    ).size;

    return newCustomers > 0 ? acquisitionSpend / newCustomers : 0;
  }

  /**
   * Calculate revenue churn metrics
   */
  async calculateRevenueChurn(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<RevenueChurnMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const churnEvents = periodEvents.filter((e) =>
      e.type === 'subscription' && e.properties.action === 'cancel'
    );

    const churnedRevenue = churnEvents.reduce(
      (sum, e) => sum + (e.properties.amount || 0),
      0
    );

    const totalRevenue = periodEvents
      .filter((e) => e.type === 'subscription')
      .reduce((sum, e) => sum + (e.properties.amount || 0), 0);

    const rate = totalRevenue > 0 ? (churnedRevenue / totalRevenue) * 100 : 0;
    const customers = churnEvents.length;

    const bySegment = this.analyzeChurnBySegment(churnEvents);
    const byReason = this.analyzeChurnByReason(churnEvents);

    // Calculate net revenue retention
    const startOfPeriodRevenue = totalRevenue - churnedRevenue;
    const netRevenueRetention = startOfPeriodRevenue > 0
      ? ((totalRevenue - churnedRevenue) / startOfPeriodRevenue) * 100
      : 100;

    return {
      rate,
      amount: churnedRevenue,
      customers,
      bySegment,
      byReason,
      netRevenueRetention,
    };
  }

  /**
   * Calculate expansion revenue
   */
  async calculateExpansionRevenue(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<ExpansionRevenueMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const expansionEvents = periodEvents.filter((e) =>
      e.type === 'subscription' && e.properties.action === 'upgrade'
    );

    const amount = expansionEvents.reduce(
      (sum, e) => sum + (e.properties.additional_amount || e.properties.amount || 0),
      0
    );

    const totalRevenue = periodEvents
      .filter((e) => e.type === 'subscription')
      .reduce((sum, e) => sum + (e.properties.amount || 0), 0);

    const rate = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;

    const contributors = expansionEvents.map((e) => ({
      userId: e.userId,
      previousValue: e.properties.previous_amount || 0,
      newValue: e.properties.new_amount || e.properties.amount || 0,
      expansionAmount: e.properties.additional_amount || 0,
      reason: e.properties.reason || 'upgrade',
      timestamp: e.timestamp,
    }));

    const byType = this.groupExpansionByType(expansionEvents);

    return {
      amount,
      rate,
      contributors,
      byType,
    };
  }

  /**
   * Forecast revenue
   */
  async forecastRevenue(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<RevenueForecasting> {
    const monthlyRevenue = await this.calculateMonthlyRevenue(events, timeRange);

    // Simple linear regression for forecasting
    const n = monthlyRevenue.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += monthlyRevenue[i];
      sumXY += i * monthlyRevenue[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecasts
    const forecastNextMonth = slope * n + intercept;
    const forecastNextQuarter = slope * (n + 3) + intercept;
    const forecastNextYear = slope * (n + 12) + intercept;

    const confidence = 0.85;
    const errorMargin = Math.abs(forecastNextYear) * 0.15;

    return {
      nextMonth: Math.max(0, forecastNextMonth),
      nextQuarter: Math.max(0, forecastNextQuarter),
      nextYear: Math.max(0, forecastNextYear),
      confidence,
      upper: forecastNextYear + errorMargin,
      lower: Math.max(0, forecastNextYear - errorMargin),
      method: 'linear_regression',
    };
  }

  /**
   * Analyze revenue trends
   */
  async analyzeRevenueTrends(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<RevenueTrends> {
    const monthly = await this.calculateMonthlyRevenue(events, timeRange);
    const quarterly = await this.calculateQuarterlyRevenue(events, timeRange);
    const yearly = await this.calculateYearlyRevenue(events, timeRange);

    const seasonality = this.detectSeasonality(monthly);
    const growth = this.analyzeGrowth(monthly);

    return {
      monthly: this.createTrendPoints(monthly, 'month'),
      quarterly: this.createTrendPoints(quarterly, 'quarter'),
      yearly: this.createTrendPoints(yearly, 'year'),
      seasonality,
      growth,
    };
  }

  /**
   * Analyze revenue segmentation
   */
  async analyzeRevenueSegmentation(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<RevenueSegmentation> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const byPlan = this.segmentByPlan(periodEvents);
    const byCustomer = this.segmentByCustomer(periodEvents);
    const byGeography = this.segmentByGeography(periodEvents);
    const byChannel = this.segmentByChannel(periodEvents);

    return {
      byPlan,
      byCustomer,
      byGeography,
      byChannel,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private groupRevenueByPlan(events: AnalyticsEvent[]): Record<string, number> {
    const byPlan: Record<string, number> = {};

    for (const event of events) {
      const plan = event.properties.plan || 'unknown';
      const amount = event.properties.amount || 0;
      byPlan[plan] = (byPlan[plan] || 0) + amount;
    }

    return byPlan;
  }

  private groupRevenueBySegment(events: AnalyticsEvent[]): Record<string, number> {
    const bySegment: Record<string, number> = {};

    for (const event of events) {
      const segment = event.properties.segment || 'unknown';
      const amount = event.properties.amount || 0;
      bySegment[segment] = (bySegment[segment] || 0) + amount;
    }

    return bySegment;
  }

  private analyzeChurnBySegment(events: AnalyticsEvent[]): Record<string, number> {
    const bySegment: Record<string, number> = {};

    for (const event of events) {
      const segment = event.properties.segment || 'unknown';
      const amount = event.properties.amount || 0;
      bySegment[segment] = (bySegment[segment] || 0) + amount;
    }

    return bySegment;
  }

  private analyzeChurnByReason(events: AnalyticsEvent[]): Record<string, number> {
    const byReason: Record<string, number> = {};

    for (const event of events) {
      const reason = event.properties.reason || 'unknown';
      byReason[reason] = (byReason[reason] || 0) + 1;
    }

    return byReason;
  }

  private groupExpansionByType(events: AnalyticsEvent[]): Record<string, number> {
    const byType: Record<string, number> = {};

    for (const event of events) {
      const type = event.properties.expansion_type || 'upgrade';
      const amount = event.properties.additional_amount || 0;
      byType[type] = (byType[type] || 0) + amount;
    }

    return byType;
  }

  private async calculateMonthlyRevenue(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<number[]> {
    const monthlyRevenue: number[] = [];
    const monthMs = 30 * 24 * 60 * 60 * 1000;

    for (let month = 0; month < 12; month++) {
      const start = timeRange.start - month * monthMs;
      const end = start + monthMs;

      const monthEvents = events.filter((e) => e.timestamp >= start && e.timestamp < end);
      const revenue = monthEvents
        .filter((e) => ['purchase', 'subscription'].includes(e.type))
        .reduce((sum, e) => sum + (e.properties.amount || 0), 0);

      monthlyRevenue.unshift(revenue);
    }

    return monthlyRevenue.filter((r) => r > 0);
  }

  private async calculateQuarterlyRevenue(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<number[]> {
    const quarterlyRevenue: number[] = [];
    const quarterMs = 90 * 24 * 60 * 60 * 1000;

    for (let quarter = 0; quarter < 4; quarter++) {
      const start = timeRange.start - quarter * quarterMs;
      const end = start + quarterMs;

      const quarterEvents = events.filter((e) => e.timestamp >= start && e.timestamp < end);
      const revenue = quarterEvents
        .filter((e) => ['purchase', 'subscription'].includes(e.type))
        .reduce((sum, e) => sum + (e.properties.amount || 0), 0);

      quarterlyRevenue.unshift(revenue);
    }

    return quarterlyRevenue.filter((r) => r > 0);
  }

  private async calculateYearlyRevenue(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<number[]> {
    const yearlyRevenue: number[] = [];
    const yearMs = 365 * 24 * 60 * 60 * 1000;

    for (let year = 0; year < 3; year++) {
      const start = timeRange.start - year * yearMs;
      const end = start + yearMs;

      const yearEvents = events.filter((e) => e.timestamp >= start && e.timestamp < end);
      const revenue = yearEvents
        .filter((e) => ['purchase', 'subscription'].includes(e.type))
        .reduce((sum, e) => sum + (e.properties.amount || 0), 0);

      yearlyRevenue.unshift(revenue);
    }

    return yearlyRevenue.filter((r) => r > 0);
  }

  private detectSeasonality(monthlyRevenue: number[]): any {
    if (monthlyRevenue.length < 12) {
      return { detected: false, pattern: 'none', strength: 0, peaks: [], troughs: [] };
    }

    // Simple seasonality detection
    const avg = monthlyRevenue.reduce((a, b) => a + b, 0) / monthlyRevenue.length;
    const variance = monthlyRevenue.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / monthlyRevenue.length;
    const std = Math.sqrt(variance);

    const peaks: number[] = [];
    const troughs: number[] = [];

    for (let i = 1; i < monthlyRevenue.length - 1; i++) {
      if (monthlyRevenue[i] > monthlyRevenue[i - 1] && monthlyRevenue[i] > monthlyRevenue[i + 1]) {
        if (monthlyRevenue[i] > avg + std) peaks.push(i);
      }
      if (monthlyRevenue[i] < monthlyRevenue[i - 1] && monthlyRevenue[i] < monthlyRevenue[i + 1]) {
        if (monthlyRevenue[i] < avg - std) troughs.push(i);
      }
    }

    const strength = std / avg;

    return {
      detected: strength > 0.1,
      pattern: 'monthly',
      strength,
      peaks,
      troughs,
    };
  }

  private analyzeGrowth(monthlyRevenue: number[]): any {
    if (monthlyRevenue.length < 2) {
      return { rate: 0, compounding: 0, momentum: 0, acceleration: 0, trend: 'stable' };
    }

    const growthRates: number[] = [];
    for (let i = 1; i < monthlyRevenue.length; i++) {
      if (monthlyRevenue[i - 1] > 0) {
        growthRates.push(((monthlyRevenue[i] - monthlyRevenue[i - 1]) / monthlyRevenue[i - 1]) * 100);
      }
    }

    const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    const compounding = Math.pow(1 + avgGrowthRate / 100, 12) - 1;

    const recentGrowth = growthRates.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, growthRates.length);
    const momentum = recentGrowth - avgGrowthRate;

    const acceleration = growthRates.length >= 2
      ? recentGrowth - growthRates[growthRates.length - 4]
      : 0;

    let trend: 'accelerating' | 'decelerating' | 'stable' = 'stable';
    if (acceleration > 1) trend = 'accelerating';
    else if (acceleration < -1) trend = 'decelerating';

    return {
      rate: avgGrowthRate,
      compounding: compounding * 100,
      momentum,
      acceleration,
      trend,
    };
  }

  private createTrendPoints(
    revenue: number[],
    periodType: string
  ): any[] {
    return revenue.map((rev, i) => ({
      period: `${periodType}_${i + 1}`,
      revenue: rev,
      growth: i > 0 ? ((rev - revenue[i - 1]) / revenue[i - 1]) * 100 : 0,
    }));
  }

  private segmentByPlan(events: AnalyticsEvent[]): any {
    const planRevenue = this.groupRevenueByPlan(events);
    const totalRevenue = Object.values(planRevenue).reduce((a, b) => a + b, 0);

    const segments = Object.entries(planRevenue).map(([plan, revenue]) => ({
      name: plan,
      revenue,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      growth: 0,
      customers: 0,
      arpu: 0,
    }));

    return {
      segments,
      concentration: 0,
      giniCoefficient: 0,
      herfindahlIndex: 0,
    };
  }

  private segmentByCustomer(events: AnalyticsEvent[]): any {
    const customerRevenue = new Map<string, number>();

    for (const event of events) {
      const amount = event.properties.amount || 0;
      customerRevenue.set(event.userId, (customerRevenue.get(event.userId) || 0) + amount);
    }

    const sorted = Array.from(customerRevenue.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const totalRevenue = Array.from(customerRevenue.values()).reduce((a, b) => a + b, 0);

    const segments = sorted.map(([userId, revenue]) => ({
      name: userId,
      revenue,
      percentage: (revenue / totalRevenue) * 100,
      growth: 0,
      customers: 1,
      arpu: revenue,
    }));

    return {
      segments,
      concentration: 0.5,
      giniCoefficient: 0.4,
      herfindahlIndex: 0.1,
    };
  }

  private segmentByGeography(events: AnalyticsEvent[]): any {
    const geoRevenue: Record<string, number> = {};

    for (const event of events) {
      const country = event.properties.country || 'Unknown';
      const amount = event.properties.amount || 0;
      geoRevenue[country] = (geoRevenue[country] || 0) + amount;
    }

    const totalRevenue = Object.values(geoRevenue).reduce((a, b) => a + b, 0);

    const segments = Object.entries(geoRevenue).map(([geo, revenue]) => ({
      name: geo,
      revenue,
      percentage: (revenue / totalRevenue) * 100,
      growth: 0,
      customers: 0,
      arpu: 0,
    }));

    return {
      segments,
      concentration: 0,
      giniCoefficient: 0,
      herfindahlIndex: 0,
    };
  }

  private segmentByChannel(events: AnalyticsEvent[]): any {
    const channelRevenue: Record<string, number> = {};

    for (const event of events) {
      const channel = event.properties.channel || event.properties.source || 'Unknown';
      const amount = event.properties.amount || 0;
      channelRevenue[channel] = (channelRevenue[channel] || 0) + amount;
    }

    const totalRevenue = Object.values(channelRevenue).reduce((a, b) => a + b, 0);

    const segments = Object.entries(channelRevenue).map(([channel, revenue]) => ({
      name: channel,
      revenue,
      percentage: (revenue / totalRevenue) * 100,
      growth: 0,
      customers: 0,
      arpu: 0,
    }));

    return {
      segments,
      concentration: 0,
      giniCoefficient: 0,
      herfindahlIndex: 0,
    };
  }
}
