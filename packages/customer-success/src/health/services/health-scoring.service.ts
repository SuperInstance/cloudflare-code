/**
 * Health Scoring Service
 * Calculates and manages customer health scores
 */

import {
  CustomerHealth,
  HealthScore,
  HealthFactors,
  HealthTrends,
  HealthAlert,
  HealthRecommendation,
  HealthScoreConfiguration,
  RiskLevel,
  HealthStatus,
  ScoreWeights,
  ScoreThresholds,
  FactorConfiguration,
  AlertRule,
  HealthHistoryEntry,
} from '../types/health.types';

export class HealthScoringService {
  private configuration: HealthScoreConfiguration;
  private healthScores: Map<string, CustomerHealth> = new Map();

  constructor(configuration?: Partial<HealthScoreConfiguration>) {
    this.configuration = this.getDefaultConfiguration();
    if (configuration) {
      this.configuration = { ...this.configuration, ...configuration };
    }
  }

  /**
   * Calculate comprehensive health score for a customer
   */
  async calculateHealthScore(customerId: string): Promise<CustomerHealth> {
    const factors = await this.collectHealthFactors(customerId);
    const score = this.calculateOverallScore(factors);
    const trends = await this.calculateTrends(customerId);
    const alerts = this.generateAlerts(customerId, factors, score);
    const recommendations = await this.generateRecommendations(customerId, factors, score, alerts);
    const riskLevel = this.determineRiskLevel(score.overall);
    const status = this.determineHealthStatus(score.overall, riskLevel);
    const history = await this.getHealthHistory(customerId);

    const health: CustomerHealth = {
      id: this.generateId(),
      customerId,
      score,
      factors,
      trends,
      alerts,
      recommendations,
      riskLevel,
      status,
      lastUpdated: new Date(),
      nextReviewDate: this.calculateNextReviewDate(),
      history,
      metadata: {},
    };

    this.healthScores.set(customerId, health);
    await this.recordHealthHistory(health);

    return health;
  }

  /**
   * Batch calculate health scores for multiple customers
   */
  async calculateBatchHealthScores(customerIds: string[]): Promise<Map<string, CustomerHealth>> {
    const results = new Map<string, CustomerHealth>();

    for (const customerId of customerIds) {
      try {
        const health = await this.calculateHealthScore(customerId);
        results.set(customerId, health);
      } catch (error) {
        console.error(`Failed to calculate health for ${customerId}:`, error);
      }
    }

    return results;
  }

  /**
   * Get current health score for a customer
   */
  async getHealthScore(customerId: string): Promise<CustomerHealth | null> {
    return this.healthScores.get(customerId) || null;
  }

  /**
   * Get health scores for all customers
   */
  async getAllHealthScores(): Promise<CustomerHealth[]> {
    return Array.from(this.healthScores.values());
  }

  /**
   * Get health scores by status
   */
  async getHealthScoresByStatus(status: HealthStatus): Promise<CustomerHealth[]> {
    return Array.from(this.healthScores.values()).filter(h => h.status === status);
  }

  /**
   * Get health scores by risk level
   */
  async getHealthScoresByRiskLevel(riskLevel: RiskLevel): Promise<CustomerHealth[]> {
    return Array.from(this.healthScores.values()).filter(h => h.riskLevel === riskLevel);
  }

  /**
   * Update health score configuration
   */
  updateConfiguration(configuration: Partial<HealthScoreConfiguration>): void {
    this.configuration = { ...this.configuration, ...configuration };
  }

  /**
   * Get health score configuration
   */
  getConfiguration(): HealthScoreConfiguration {
    return { ...this.configuration };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(customerId: string, alertId: string, acknowledgedBy: string): Promise<void> {
    const health = this.healthScores.get(customerId);
    if (!health) return;

    const alert = health.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = acknowledgedBy;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(customerId: string, alertId: string, resolvedBy: string): Promise<void> {
    const health = this.healthScores.get(customerId);
    if (!health) return;

    const alert = health.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.resolvedBy = resolvedBy;
    }
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(customerId: string, recommendationId: string): Promise<void> {
    const health = this.healthScores.get(customerId);
    if (!health) return;

    const recommendation = health.recommendations.find(r => r.id === recommendationId);
    if (recommendation) {
      recommendation.status = 'dismissed';
    }
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(
    customerId: string,
    recommendationId: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): Promise<void> {
    const health = this.healthScores.get(customerId);
    if (!health) return;

    const recommendation = health.recommendations.find(r => r.id === recommendationId);
    if (recommendation) {
      recommendation.status = status;
      recommendation.updatedAt = new Date();
      if (status === 'completed') {
        recommendation.completedAt = new Date();
      }
    }
  }

  // Private methods

  private async collectHealthFactors(customerId: string): Promise<HealthFactors> {
    // In a real implementation, this would fetch data from various sources
    // For now, we'll return mock data structure

    return {
      usage: await this.collectUsageFactors(customerId),
      adoption: await this.collectAdoptionFactors(customerId),
      engagement: await this.collectEngagementFactors(customerId),
      support: await this.collectSupportFactors(customerId),
      satisfaction: await this.collectSatisfactionFactors(customerId),
      financial: await this.collectFinancialFactors(customerId),
      growth: await this.collectGrowthFactors(customerId),
    };
  }

  private async collectUsageFactors(customerId: string): Promise<any> {
    // Mock implementation - in production, fetch from analytics service
    return {
      activeUsers: {
        current: 150,
        previous: 140,
        change: 10,
        trend: 'increasing',
        score: 85,
      },
      requestVolume: {
        current: 50000,
        previous: 45000,
        change: 5000,
        trend: 'increasing',
        score: 90,
      },
      featureUsage: {
        featuresUsed: 12,
        totalFeatures: 20,
        adoptionRate: 60,
        topFeatures: ['code_generation', 'project_management', 'collaboration'],
        underutilizedFeatures: ['analytics', 'automation'],
        score: 70,
      },
      sessionDuration: {
        average: 45,
        previous: 42,
        change: 3,
        score: 80,
      },
      loginFrequency: {
        daily: 80,
        weekly: 120,
        monthly: 145,
        score: 85,
      },
      apiUsage: {
        calls: 50000,
        errorRate: 0.5,
        latency: 120,
        score: 88,
      },
    };
  }

  private async collectAdoptionFactors(customerId: string): Promise<any> {
    return {
      featuresAdopted: 12,
      totalFeatures: 20,
      adoptionRate: 60,
      coreFeaturesAdopted: ['code_generation', 'project_management'],
      advancedFeaturesAdopted: ['collaboration', 'integration'],
      timeToAdoption: 7,
      adoptionVelocity: 2,
      newFeaturesTried: 3,
      featureDepthOfUse: {
        code_generation: 90,
        project_management: 75,
        collaboration: 60,
      },
      score: 72,
    };
  }

  private async collectEngagementFactors(customerId: string): Promise<any> {
    return {
      loginStreak: 15,
      lastLogin: new Date(),
      daysSinceLastLogin: 0,
      interactionRate: 8.5,
      documentationViews: 45,
      tutorialCompletion: 3,
      communityParticipation: {
        posts: 5,
        comments: 12,
        likes: 23,
        score: 75,
      },
      feedbackProvided: 8,
      score: 82,
    };
  }

  private async collectSupportFactors(customerId: string): Promise<any> {
    return {
      ticketsOpened: 15,
      ticketsResolved: 14,
      openTickets: 1,
      avgResolutionTime: 4.5,
      customerSatisfaction: 4.2,
      ticketSeverity: {
        critical: 0,
        high: 2,
        medium: 8,
        low: 5,
      },
      recurringIssues: ['api_rate_limits'],
      selfServiceRate: 65,
      escalationRate: 10,
      score: 80,
    };
  }

  private async collectSatisfactionFactors(customerId: string): Promise<any> {
    return {
      npsScore: 45,
      npsCategory: 'promoter',
      csatScore: 4.3,
      cesScore: 85,
      sentimentAnalysis: {
        positive: 75,
        neutral: 20,
        negative: 5,
      },
      surveyResponses: 12,
      lastSurveyDate: new Date(),
      feedbackCount: 28,
      positiveFeedback: 22,
      negativeFeedback: 6,
      score: 85,
    };
  }

  private async collectFinancialFactors(customerId: string): Promise<any> {
    return {
      subscriptionStatus: 'active',
      paymentHistory: {
        onTimePayments: 11,
        latePayments: 1,
        failedPayments: 0,
        paymentSuccessRate: 92,
      },
      mrr: 2500,
      arr: 30000,
      contractValue: 30000,
      remainingContractValue: 15000,
      contractStartDate: new Date('2024-01-01'),
      contractEndDate: new Date('2025-01-01'),
      daysUntilRenewal: 180,
      paymentMethod: 'credit_card',
      billingFrequency: 'monthly',
      expansionRevenue: 500,
      contractionRevenue: 0,
      churnRisk: 'low',
      score: 90,
    };
  }

  private async collectGrowthFactors(customerId: string): Promise<any> {
    return {
      userGrowthRate: 12.5,
      revenueGrowthRate: 8.3,
      usageGrowthRate: 15.7,
      expansionOpportunities: [
        {
          type: 'upgrade',
          product: 'Enterprise Plan',
          currentTier: 'Professional',
          suggestedTier: 'Enterprise',
          potentialValue: 12000,
          likelihood: 65,
          reason: 'Approaching usage limits',
          recommendedAction: 'Contact customer about upgrade options',
        },
      ],
      upsellPotential: 70,
      crossSellPotential: 45,
      renewalProbability: 85,
      advocateScore: 78,
      score: 78,
    };
  }

  private calculateOverallScore(factors: HealthFactors): HealthScore {
    const weights = this.configuration.weights;

    // Calculate category scores
    const usageScore = this.calculateFactorScore(factors.usage);
    const adoptionScore = this.calculateFactorScore(factors.adoption);
    const engagementScore = this.calculateFactorScore(factors.engagement);
    const supportScore = this.calculateFactorScore(factors.support);
    const satisfactionScore = this.calculateFactorScore(factors.satisfaction);
    const growthScore = this.calculateFactorScore(factors.growth);

    // Calculate weighted overall score
    const overall = Math.round(
      (usageScore * weights.usage +
        adoptionScore * weights.adoption +
        engagementScore * weights.engagement +
        supportScore * weights.support +
        satisfactionScore * weights.satisfaction +
        growthScore * weights.growth) /
      (weights.usage + weights.adoption + weights.engagement +
        weights.support + weights.satisfaction + weights.growth)
    );

    // Calculate composite scores
    const product = Math.round((usageScore + adoptionScore) / 2);
    const relationship = Math.round((engagementScore + supportScore + satisfactionScore) / 3);
    const financial = Math.round((factors.financial.score + growthScore) / 2);

    return {
      overall,
      product,
      relationship,
      financial,
      breakdown: {
        usage: { score: usageScore, weight: weights.usage, trend: 'stable' },
        adoption: { score: adoptionScore, weight: weights.adoption, trend: 'stable' },
        engagement: { score: engagementScore, weight: weights.engagement, trend: 'stable' },
        support: { score: supportScore, weight: weights.support, trend: 'stable' },
        satisfaction: { score: satisfactionScore, weight: weights.satisfaction, trend: 'stable' },
        growth: { score: growthScore, weight: weights.growth, trend: 'stable' },
      },
    };
  }

  private calculateFactorScore(factor: any): number {
    // Extract score from factor object
    if (typeof factor === 'object' && factor.score !== undefined) {
      return factor.score;
    }
    return 50; // Default score
  }

  private async calculateTrends(customerId: string): Promise<HealthTrends> {
    // Mock implementation - in production, fetch historical data
    return {
      overall: this.createMockTrendData(75),
      product: this.createMockTrendData(80),
      relationship: this.createMockTrendData(72),
      financial: this.createMockTrendData(85),
      factors: {
        usage: this.createMockTrendData(85),
        adoption: this.createMockTrendData(72),
        engagement: this.createMockTrendData(82),
        support: this.createMockTrendData(80),
        satisfaction: this.createMockTrendData(85),
        growth: this.createMockTrendData(78),
      },
    };
  }

  private createMockTrendData(currentScore: number): any {
    return {
      current: currentScore,
      previous: currentScore - 2,
      change: 2,
      changePercent: 2.7,
      direction: 'up',
      dataPoints: [
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), value: currentScore - 5 },
        { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), value: currentScore - 3 },
        { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), value: currentScore - 1 },
        { date: new Date(), value: currentScore },
      ],
      movingAverage: currentScore - 2,
    };
  }

  private generateAlerts(
    customerId: string,
    factors: HealthFactors,
    score: HealthScore
  ): HealthAlert[] {
    const alerts: HealthAlert[] = [];

    // Check each alert rule
    this.configuration.alertRules.forEach(rule => {
      if (!rule.enabled) return;

      const factorValue = this.getFactorValue(factors, rule.factor);
      if (this.evaluateCondition(factorValue, rule)) {
        alerts.push({
          id: this.generateId(),
          type: 'threshold_breach',
          severity: rule.severity,
          category: this.getAlertCategory(rule.factor),
          title: `${rule.factor} Alert`,
          description: `${rule.factor} has ${rule.condition} ${rule.threshold}`,
          factor: rule.factor,
          currentValue: factorValue,
          threshold: rule.threshold,
          triggeredAt: new Date(),
          status: 'active',
          actions: rule.actions.map(action => ({
            ...action,
            completed: false,
          })),
        });
      }
    });

    // Generate custom alerts based on score thresholds
    if (score.overall < this.configuration.thresholds.critical) {
      alerts.push({
        id: this.generateId(),
        type: 'threshold_breach',
        severity: 'critical',
        category: 'usage',
        title: 'Critical Health Score',
        description: `Overall health score is critically low at ${score.overall}`,
        factor: 'overall',
        currentValue: score.overall,
        threshold: this.configuration.thresholds.critical,
        triggeredAt: new Date(),
        status: 'active',
        actions: [
          {
            type: 'contact',
            description: 'Immediate outreach required',
            priority: 'urgent',
            completed: false,
          },
          {
            type: 'escalation',
            description: 'Escalate to customer success manager',
            priority: 'urgent',
            completed: false,
          },
        ],
      });
    }

    return alerts;
  }

  private getFactorValue(factors: HealthFactors, factorName: string): number {
    const parts = factorName.split('.');
    let value: any = factors;
    for (const part of parts) {
      value = value[part];
      if (value === undefined) return 0;
    }
    return typeof value === 'number' ? value : (value.score || 0);
  }

  private evaluateCondition(value: number, rule: AlertRule): boolean {
    switch (rule.condition) {
      case 'greater_than':
        return value > rule.threshold;
      case 'less_than':
        return value < rule.threshold;
      case 'equals':
        return value === rule.threshold;
      case 'changes_by':
        // Would need historical data
        return false;
      case 'trend':
        // Would need trend analysis
        return false;
      default:
        return false;
    }
  }

  private getAlertCategory(factor: string): any {
    if (factor.includes('usage') || factor.includes('feature')) return 'usage';
    if (factor.includes('engagement') || factor.includes('login')) return 'engagement';
    if (factor.includes('support') || factor.includes('ticket')) return 'support';
    if (factor.includes('nps') || factor.includes('satisfaction')) return 'satisfaction';
    if (factor.includes('payment') || factor.includes('revenue')) return 'financial';
    return 'usage';
  }

  private async generateRecommendations(
    customerId: string,
    factors: HealthFactors,
    score: HealthScore,
    alerts: HealthAlert[]
  ): Promise<HealthRecommendation[]> {
    const recommendations: HealthRecommendation[] = [];

    // Feature adoption recommendations
    if (factors.adoption.score < 70) {
      recommendations.push({
        id: this.generateId(),
        customerId,
        type: 'feature_adoption',
        priority: 'medium',
        title: 'Improve Feature Adoption',
        description: 'Customer is not fully utilizing available features',
        rationale: `Only ${factors.adoption.adoptionRate}% of features are being used`,
        expectedImpact: [
          { area: 'Product Health', improvement: 15 },
          { area: 'Engagement', improvement: 10 },
        ],
        actions: [
          {
            order: 1,
            action: 'Schedule feature training session',
            type: 'manual',
            completed: false,
          },
          {
            order: 2,
            action: 'Send feature usage guides',
            type: 'automated',
            completed: false,
          },
        ],
        resources: [
          {
            type: 'document',
            title: 'Feature Adoption Guide',
            url: '/docs/feature-adoption',
          },
        ],
        estimatedEffort: 2,
        successMetrics: [
          'Increase adoption rate to 80%',
          'Reduce underutilized features to 2 or less',
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Engagement recommendations
    if (factors.engagement.score < 75) {
      recommendations.push({
        id: this.generateId(),
        customerId,
        type: 'engagement_improvement',
        priority: 'medium',
        title: 'Boost Customer Engagement',
        description: 'Engagement metrics indicate room for improvement',
        rationale: `Engagement score is ${factors.engagement.score}/100`,
        expectedImpact: [
          { area: 'Relationship Health', improvement: 20 },
          { area: 'Retention', improvement: 15 },
        ],
        actions: [
          {
            order: 1,
            action: 'Reach out to understand barriers',
            type: 'manual',
            completed: false,
          },
          {
            order: 2,
            action: 'Share best practices and tips',
            type: 'manual',
            completed: false,
          },
        ],
        resources: [],
        estimatedEffort: 3,
        successMetrics: [
          'Increase login streak to 20+ days',
          'Increase interaction rate to 10+ per session',
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Expansion recommendations
    if (factors.growth.upsellPotential > 70) {
      recommendations.push({
        id: this.generateId(),
        customerId,
        type: 'expansion',
        priority: 'high',
        title: 'Expansion Opportunity',
        description: 'Customer shows strong expansion potential',
        rationale: `High upsell potential (${factors.growth.upsellPotential}%) and growth trajectory`,
        expectedImpact: [
          { area: 'Revenue', improvement: 25 },
          { area: 'Customer Value', improvement: 30 },
        ],
        actions: [
          {
            order: 1,
            action: 'Review expansion opportunities',
            type: 'manual',
            completed: false,
          },
          {
            order: 2,
            action: 'Prepare expansion proposal',
            type: 'manual',
            completed: false,
          },
          {
            order: 3,
            action: 'Schedule expansion discussion',
            type: 'manual',
            completed: false,
          },
        ],
        resources: [
          {
            type: 'playbook',
            title: 'Expansion Playbook',
            url: '/playbooks/expansion',
          },
        ],
        estimatedEffort: 5,
        successMetrics: [
          'Present expansion proposal',
          'Achieve expansion revenue target',
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return recommendations;
  }

  private determineRiskLevel(score: number): RiskLevel {
    if (score < this.configuration.thresholds.critical) return 'critical';
    if (score < this.configuration.thresholds.high) return 'high';
    if (score < this.configuration.thresholds.medium) return 'medium';
    if (score < this.configuration.thresholds.healthy) return 'low';
    return 'none';
  }

  private determineHealthStatus(score: number, riskLevel: RiskLevel): HealthStatus {
    if (score < 40) return 'churned';
    if (score < 50) return 'at_risk';
    if (score < 70) return 'needs_attention';
    if (score < 85) return 'healthy';
    return 'thriving';
  }

  private calculateNextReviewDate(): Date {
    const intervalMs = this.configuration.refreshInterval * 60 * 60 * 1000;
    return new Date(Date.now() + intervalMs);
  }

  private async getHealthHistory(customerId: string): Promise<HealthHistoryEntry[]> {
    // Mock implementation - in production, fetch from database
    return [];
  }

  private async recordHealthHistory(health: CustomerHealth): Promise<void> {
    // In production, this would save to a database
    const entry: HealthHistoryEntry = {
      id: this.generateId(),
      date: new Date(),
      score: health.score,
      status: health.status,
      riskLevel: health.riskLevel,
      changes: [],
      notes: 'Automated health score calculation',
    };

    health.history.push(entry);
  }

  private getDefaultConfiguration(): HealthScoreConfiguration {
    return {
      weights: {
        usage: 0.25,
        adoption: 0.20,
        engagement: 0.20,
        support: 0.10,
        satisfaction: 0.15,
        growth: 0.10,
      },
      thresholds: {
        critical: 40,
        high: 55,
        medium: 70,
        healthy: 85,
        thriving: 90,
      },
      factors: [],
      refreshInterval: 24,
      alertRules: this.getDefaultAlertRules(),
      trendWindow: 30,
      predictionHorizon: 90,
    };
  }

  private getDefaultAlertRules(): AlertRule[] {
    return [
      {
        id: 'usage_low',
        name: 'Low Usage Alert',
        factor: 'usage.activeUsers.current',
        condition: 'less_than',
        threshold: 50,
        severity: 'high',
        cooldown: 24,
        actions: [],
        enabled: true,
      },
      {
        id: 'engagement_low',
        name: 'Low Engagement Alert',
        factor: 'engagement.loginStreak',
        condition: 'less_than',
        threshold: 5,
        severity: 'medium',
        cooldown: 48,
        actions: [],
        enabled: true,
      },
      {
        id: 'nps_low',
        name: 'Low NPS Alert',
        factor: 'satisfaction.npsScore',
        condition: 'less_than',
        threshold: 0,
        severity: 'high',
        cooldown: 72,
        actions: [],
        enabled: true,
      },
      {
        id: 'payment_failed',
        name: 'Payment Failure Alert',
        factor: 'financial.paymentHistory.failedPayments',
        condition: 'greater_than',
        threshold: 0,
        severity: 'critical',
        cooldown: 24,
        actions: [],
        enabled: true,
      },
    ];
  }

  private generateId(): string {
    return `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
