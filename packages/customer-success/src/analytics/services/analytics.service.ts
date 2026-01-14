/**
 * Usage Analytics Service
 * Provides comprehensive usage analytics and insights
 */

import {
  UsageAnalytics,
  AnalyticsPeriod,
  UsageMetrics,
  FeatureAnalytics,
  UserAnalytics,
  ApiAnalytics,
  CollaborationAnalytics,
  RevenueAnalytics,
  CohortAnalytics,
  FunnelAnalytics,
  RetentionAnalytics,
  BenchmarkComparison,
  AnalyticsInsight,
  AnalyticsQuery,
  CustomerSegment,
} from '../types/analytics.types';

export class AnalyticsService {
  /**
   * Generate comprehensive usage analytics for a customer
   */
  async generateAnalytics(customerId: string, period: AnalyticsPeriod): Promise<UsageAnalytics> {
    const metrics = await this.collectUsageMetrics(customerId, period);
    const features = await this.analyzeFeatureUsage(customerId, period);
    const users = await this.analyzeUserBehavior(customerId, period);
    const api = await this.analyzeApiUsage(customerId, period);
    const collaboration = await this.analyzeCollaboration(customerId, period);
    const revenue = await this.analyzeRevenue(customerId, period);
    const cohorts = await this.analyzeCohorts(customerId, period);
    const funnels = await this.analyzeFunnels(customerId, period);
    const retention = await this.analyzeRetention(customerId, period);
    const benchmarks = await this.compareToBenchmarks(customerId, metrics);
    const insights = await this.generateInsights(customerId, period);

    return {
      customerId,
      period,
      metrics,
      features,
      users,
      api,
      collaboration,
      revenue,
      cohorts,
      funnels,
      retention,
      benchmarks,
      insights,
      generatedAt: new Date(),
    };
  }

  /**
   * Query analytics data with custom filters and groupings
   */
  async query(query: AnalyticsQuery): Promise<any[]> {
    // Implementation would depend on data storage
    // This is a placeholder for the query interface
    return [];
  }

  /**
   * Create customer segment based on criteria
   */
  async createSegment(
    name: string,
    description: string,
    criteria: any[]
  ): Promise<CustomerSegment> {
    // Implementation would query customer data and create segment
    return {
      id: this.generateId(),
      name,
      description,
      criteria,
      customerCount: 0,
      averageHealthScore: 0,
      healthDistribution: {
        churned: 0,
        at_risk: 0,
        needs_attention: 0,
        healthy: 0,
        thriving: 0,
      },
      riskDistribution: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        none: 0,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Generate cohort analysis
   */
  async generateCohortAnalysis(
    cohortType: string,
    period: AnalyticsPeriod
  ): Promise<CohortAnalytics> {
    return {
      cohorts: [],
      retention: this.createMockRetentionData(),
      revenue: this.createMockRevenueData(),
      behavior: {},
    };
  }

  /**
   * Generate funnel analysis
   */
  async generateFunnelAnalysis(
    funnelType: string,
    period: AnalyticsPeriod
  ): Promise<FunnelAnalytics> {
    return {
      funnels: [],
      conversion: this.createMockConversionMetrics(),
      dropOff: this.createMockDropOffAnalysis(),
    };
  }

  /**
   * Get real-time usage stats
   */
  async getRealTimeStats(customerId: string): Promise<{
    activeUsers: number;
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
  }> {
    // Mock implementation
    return {
      activeUsers: 45,
      requestsPerSecond: 125,
      averageResponseTime: 95,
      errorRate: 0.3,
    };
  }

  // Private helper methods

  private async collectUsageMetrics(customerId: string, period: AnalyticsPeriod): Promise<UsageMetrics> {
    return {
      activeUsers: {
        dau: 125,
        wau: 350,
        mau: 800,
        dauOverMau: 15.6,
        newUsers: 15,
        returningUsers: 110,
        churnedUsers: 5,
        userGrowthRate: 12.5,
        averageUsersPerDay: 125,
        peakUsers: 180,
        peakDate: new Date(),
      },
      sessions: {
        totalSessions: 2500,
        averageSessionDuration: 42,
        averageSessionDurationChange: 5.2,
        totalSessionDuration: 1750,
        sessionsPerUser: 20,
        bounceRate: 15,
        sessionsByDay: this.createMockSessionsByDay(),
        sessionsByHour: this.createMockSessionsByHour(),
        averageActionsPerSession: 12,
      },
      requests: {
        totalRequests: 1250000,
        successfulRequests: 1245000,
        failedRequests: 5000,
        successRate: 99.6,
        averageResponseTime: 110,
        p50ResponseTime: 95,
        p95ResponseTime: 180,
        p99ResponseTime: 350,
        requestsPerSecond: 145,
        peakRequestsPerSecond: 320,
        requestsByEndpoint: this.createMockRequestsByEndpoint(),
        requestsByDay: this.createMockRequestsByDay(),
        errorRate: 0.4,
        errorCategories: this.createMockErrorCategories(),
      },
      storage: {
        totalStorage: 107374182400, // 100GB
        usedStorage: 53687091200, // 50GB
        availableStorage: 53687091200,
        utilizationRate: 50,
        storageByType: this.createMockStorageByType(),
        storageGrowthRate: 8.5,
        projectedUsage: 75161927680,
        projectedDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
      bandwidth: {
        totalBandwidth: 536870912000, // 500GB
        inbound: 322122547200,
        outbound: 214748364800,
        bandwidthByDay: this.createMockBandwidthByDay(),
        peakBandwidth: 8589934592,
        peakDate: new Date(),
        averageBandwidth: 2147483648,
      },
      compute: {
        totalCpuTime: 72000,
        totalMemoryUsed: 161061273600,
        averageCpuUsage: 45,
        peakCpuUsage: 85,
        averageMemoryUsage: 55,
        peakMemoryUsage: 85,
        computeUnits: 15000,
        costPerComputeUnit: 0.01,
        totalComputeCost: 150,
      },
    };
  }

  private async analyzeFeatureUsage(customerId: string, period: AnalyticsPeriod): Promise<FeatureAnalytics> {
    return {
      features: this.createMockFeatureUsage(),
      adoption: {
        totalFeatures: 20,
        adoptedFeatures: 14,
        adoptionRate: 70,
        averageTimeToAdopt: 7,
        adoptionByCategory: {
          core: 100,
          collaboration: 75,
          analytics: 60,
          automation: 40,
        },
        adoptionByTier: {
          basic: 60,
          professional: 80,
          enterprise: 90,
        },
        coreFeaturesAdopted: 5,
        advancedFeaturesAdopted: 6,
        powerUserFeaturesAdopted: 3,
      },
      depth: {
        featuresByDepth: {
          shallow: 4,
          medium: 7,
          deep: 3,
        },
        averageDepthScore: 65,
        depthByFeature: {
          code_generation: 85,
          project_management: 70,
          collaboration: 55,
          analytics: 45,
        },
      },
      correlation: [
        {
          featureA: 'code_generation',
          featureB: 'project_management',
          correlation: 0.75,
          strength: 'strong',
          lift: 2.5,
        },
      ],
      trends: {
        gainingTraction: ['automation', 'integrations'],
        decliningUsage: ['legacy_editor'],
        stableUsage: ['code_generation', 'project_management'],
        seasonalPatterns: [],
      },
    };
  }

  private async analyzeUserBehavior(customerId: string, period: AnalyticsPeriod): Promise<UserAnalytics> {
    return {
      users: [],
      segments: this.createMockUserSegments(),
      behavior: {
        actionPatterns: this.createMockActionPatterns(),
        timePatterns: this.createMockTimePatterns(),
        featureSequences: this.createMockFeatureSequences(),
        commonPaths: this.createMockCommonPaths(),
        anomalies: [],
      },
      lifecycle: {
        distribution: {
          new: 50,
          activated: 200,
          engaged: 350,
          power: 150,
          atRisk: 30,
          churned: 20,
          percentages: {
            new: 6.25,
            activated: 25,
            engaged: 43.75,
            power: 18.75,
            atRisk: 3.75,
            churned: 2.5,
          },
        },
        transitions: [],
        timeInStage: {},
        dropOffPoints: [],
      },
      journeys: [],
    };
  }

  private async analyzeApiUsage(customerId: string, period: AnalyticsPeriod): Promise<ApiAnalytics> {
    return {
      endpoints: this.createMockEndpointAnalytics(),
      usage: {
        totalCalls: 1250000,
        uniqueKeys: 15,
        callsPerKey: 83333,
        topKeys: [],
        rateLimitHits: 45,
        quotaUsage: 750000,
        quotaLimit: 1000000,
        utilizationRate: 75,
      },
      errors: {
        totalErrors: 5000,
        errorRate: 0.4,
        errorsByType: {
          '400 Bad Request': 3000,
          '401 Unauthorized': 1000,
          '500 Internal Server Error': 500,
          '503 Service Unavailable': 500,
        },
        errorsByEndpoint: {
          '/api/v1/generate': 2000,
          '/api/v1/projects': 1500,
          '/api/v1/users': 1500,
        },
        commonErrors: [],
        trends: [],
      },
      performance: {
        averageResponseTime: 110,
        p50: 95,
        p95: 180,
        p99: 350,
        slowestEndpoints: [],
        performanceTrends: [],
        slos: {
          targetResponseTime: 200,
          achievedResponseTime: 110,
          successRateTarget: 99.5,
          achievedSuccessRate: 99.6,
          uptimeTarget: 99.9,
          achievedUptime: 99.95,
          compliance: true,
        },
      },
      security: {
        blockedRequests: 250,
        suspiciousActivity: [],
        rateLimitViolations: 45,
        authFailures: 1000,
        geoDistribution: [],
      },
    };
  }

  private async analyzeCollaboration(customerId: string, period: AnalyticsPeriod): Promise<CollaborationAnalytics> {
    return {
      projects: [],
      teams: [],
      sharing: {
        sharedItems: 150,
        sharesReceived: 80,
        sharesSent: 70,
        publicShares: 30,
        privateShares: 120,
        sharesByType: {
          project: 80,
          document: 40,
          code: 30,
        },
      },
      communication: {
        messages: 1250,
        comments: 450,
        mentions: 180,
        responseTime: 45,
        participationRate: 68,
        topCommunicators: [],
      },
    };
  }

  private async analyzeRevenue(customerId: string, period: AnalyticsPeriod): Promise<RevenueAnalytics> {
    return {
      mrr: {
        current: 25000,
        previous: 23000,
        growth: 2000,
        growthRate: 8.7,
        new: 5000,
        expansion: 3000,
        contraction: -500,
        churn: -2500,
        reactivation: 1000,
      },
      arr: {
        current: 300000,
        previous: 276000,
        growth: 24000,
        growthRate: 8.7,
      },
      revenueByTier: {
        basic: 5000,
        professional: 12000,
        enterprise: 8000,
      },
      revenueByFeature: {
        code_generation: 10000,
        collaboration: 8000,
        analytics: 5000,
        automation: 2000,
      },
      revenueStreams: [
        {
          stream: 'Subscription',
          amount: 22000,
          percentage: 88,
          growthRate: 7.5,
          customers: 150,
          averageRevenuePerCustomer: 147,
        },
        {
          stream: 'Add-ons',
          amount: 2000,
          percentage: 8,
          growthRate: 15,
          customers: 25,
          averageRevenuePerCustomer: 80,
        },
        {
          stream: 'Professional Services',
          amount: 1000,
          percentage: 4,
          growthRate: 20,
          customers: 5,
          averageRevenuePerCustomer: 200,
        },
      ],
      expansion: {
        expansionRevenue: 3000,
        expansionRate: 12,
        expansionCustomers: 15,
        averageExpansionValue: 200,
        expansionByType: {
          upgrade: 2000,
          add_on: 800,
          seat_increase: 200,
        },
        timeToExpansion: 90,
      },
      contraction: {
        contractionRevenue: 500,
        contractionRate: 2,
        contractionCustomers: 3,
        averageContractionValue: 167,
        contractionByType: {
          downgrade: 400,
          seat_decrease: 100,
        },
      },
      forecast: {
        period: 'month',
        forecast: 27000,
        confidence: 85,
        upperBound: 28500,
        lowerBound: 25500,
        factors: [
          {
            factor: 'Seasonal trend',
            impact: 'positive',
            weight: 0.3,
          },
          {
            factor: 'New feature release',
            impact: 'positive',
            weight: 0.5,
          },
        ],
      },
    };
  }

  private async analyzeCohorts(customerId: string, period: AnalyticsPeriod): Promise<CohortAnalytics> {
    return {
      cohorts: [],
      retention: this.createMockRetentionData(),
      revenue: this.createMockRevenueData(),
      behavior: {},
    };
  }

  private async analyzeFunnels(customerId: string, period: AnalyticsPeriod): Promise<FunnelAnalytics> {
    return {
      funnels: [],
      conversion: this.createMockConversionMetrics(),
      dropOff: this.createMockDropOffAnalysis(),
    };
  }

  private async analyzeRetention(customerId: string, period: AnalyticsPeriod): Promise<RetentionAnalytics> {
    return {
      metrics: {
        overallRetention: 85,
        day7Retention: 75,
        day30Retention: 65,
        day90Retention: 55,
        year1Retention: 45,
        averageCustomerLifetime: 540,
        retentionBySegment: {
          enterprise: 90,
          mid_market: 80,
          small_business: 70,
        },
        retentionByTier: {
          enterprise: 90,
          professional: 82,
          basic: 75,
        },
        retentionTrend: [],
      },
      cohorts: [],
      churn: {
        churnRate: 15,
        churnedCustomers: 30,
        churnedBySegment: {
          enterprise: 5,
          mid_market: 10,
          small_business: 15,
        },
        churnedByTier: {
          enterprise: 3,
          professional: 10,
          basic: 17,
        },
        churnedByReason: {
          price: 5,
          product: 3,
          competition: 4,
          out_of_business: 3,
        },
        averageChurnTime: 180,
        churnPrediction: {
          atRiskCustomers: 25,
          predictedChurn: 8,
          predictedRevenue: 8000,
          confidence: 75,
          topRiskFactors: [
            'Declining usage',
            'Low engagement',
            'Support tickets',
          ],
        },
      },
      reactivation: {
        reactivatedCustomers: 8,
        reactivationRate: 27,
        averageTimeToReactivate: 45,
        reactivationByMethod: {
          email: 4,
          phone: 2,
          in_app: 2,
        },
        reactivatedRevenue: 2000,
      },
      predictive: {
        forecast: [],
        riskSegments: [],
        recommendations: [],
      },
    };
  }

  private async compareToBenchmarks(customerId: string, metrics: UsageMetrics): Promise<BenchmarkComparison> {
    return {
      overall: {
        current: 75,
        benchmark: 70,
        percentile: 65,
        difference: 5,
        differencePercent: 7.1,
        status: 'above_average',
        trend: 'improving',
      },
      byCategory: {
        usage: {
          current: 80,
          benchmark: 72,
          percentile: 70,
          difference: 8,
          differencePercent: 11.1,
          status: 'above_average',
          trend: 'improving',
        },
        engagement: {
          current: 72,
          benchmark: 68,
          percentile: 60,
          difference: 4,
          differencePercent: 5.9,
          status: 'above_average',
          trend: 'stable',
        },
      },
      byTier: {},
      percentile: 65,
      ranking: 'Top 35%',
    };
  }

  private async generateInsights(customerId: string, period: AnalyticsPeriod): Promise<AnalyticsInsight[]> {
    return [
      {
        id: this.generateId(),
        type: 'trend',
        category: 'usage',
        severity: 'info',
        title: 'Strong Usage Growth',
        description: 'Daily active users have increased by 15% compared to last period',
        metric: 'dau',
        currentValue: 125,
        previousValue: 109,
        change: 16,
        changePercent: 14.7,
        significance: 0.85,
        confidence: 0.9,
        recommendations: [
          'Consider capitalizing on this growth with feature announcements',
          'Monitor infrastructure capacity',
        ],
        actionItems: [
          {
            action: 'Review infrastructure scaling',
            priority: 'medium',
            estimatedImpact: 'Prevent performance issues',
            effort: 'low',
          },
        ],
        relatedMetrics: ['wau', 'mau', 'requests'],
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: this.generateId(),
        type: 'opportunity',
        category: 'feature',
        severity: 'info',
        title: 'Feature Adoption Opportunity',
        description: 'Analytics feature has low adoption but high potential value',
        metric: 'feature_adoption_analytics',
        currentValue: 40,
        previousValue: 35,
        change: 5,
        changePercent: 14.3,
        significance: 0.75,
        confidence: 0.8,
        recommendations: [
          'Create targeted tutorial for analytics feature',
          'Share use cases and success stories',
          'Offer webinar on advanced analytics',
        ],
        actionItems: [
          {
            action: 'Schedule analytics training webinar',
            priority: 'medium',
            estimatedImpact: 'Increase analytics adoption by 20%',
            effort: 'medium',
          },
        ],
        relatedMetrics: ['feature_depth_analytics', 'user_engagement'],
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  // Mock data helpers

  private createMockSessionsByDay(): any[] {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date,
        sessions: 300 + Math.floor(Math.random() * 100),
        uniqueUsers: 100 + Math.floor(Math.random() * 50),
        averageDuration: 35 + Math.floor(Math.random() * 20),
      });
    }
    return days;
  }

  private createMockSessionsByHour(): any[] {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push({
        hour: i,
        sessions: i >= 9 && i <= 17 ? 50 + Math.floor(Math.random() * 30) : 10 + Math.floor(Math.random() * 20),
        averageDuration: 30 + Math.floor(Math.random() * 30),
      });
    }
    return hours;
  }

  private createMockRequestsByEndpoint(): any[] {
    return [
      {
        endpoint: '/api/v1/generate',
        requests: 500000,
        percentage: 40,
        averageResponseTime: 150,
        errorRate: 0.3,
      },
      {
        endpoint: '/api/v1/projects',
        requests: 375000,
        percentage: 30,
        averageResponseTime: 80,
        errorRate: 0.4,
      },
      {
        endpoint: '/api/v1/users',
        requests: 250000,
        percentage: 20,
        averageResponseTime: 60,
        errorRate: 0.5,
      },
      {
        endpoint: '/api/v1/analytics',
        requests: 125000,
        percentage: 10,
        averageResponseTime: 200,
        errorRate: 0.6,
      },
    ];
  }

  private createMockRequestsByDay(): any[] {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date,
        requests: 40000 + Math.floor(Math.random() * 10000),
        successRate: 99 + Math.random(),
        averageResponseTime: 100 + Math.floor(Math.random() * 30),
      });
    }
    return days;
  }

  private createMockErrorCategories(): any[] {
    return [
      {
        category: 'Client Errors',
        count: 3500,
        percentage: 70,
        commonErrors: [
          {
            errorType: '400 Bad Request',
            count: 3000,
            firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            lastSeen: new Date(),
          },
        ],
      },
      {
        category: 'Server Errors',
        count: 1500,
        percentage: 30,
        commonErrors: [
          {
            errorType: '500 Internal Server Error',
            count: 500,
            firstSeen: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            lastSeen: new Date(),
          },
        ],
      },
    ];
  }

  private createMockStorageByType(): any[] {
    return [
      {
        type: 'Projects',
        size: 32212254720,
        percentage: 60,
        growthRate: 10,
      },
      {
        type: 'Documents',
        size: 10737418240,
        percentage: 20,
        growthRate: 5,
      },
      {
        type: 'Media',
        size: 5368709120,
        percentage: 10,
        growthRate: 15,
      },
      {
        type: 'Logs',
        size: 5368709120,
        percentage: 10,
        growthRate: 8,
      },
    ];
  }

  private createMockBandwidthByDay(): any[] {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const total = 7516192768 + Math.floor(Math.random() * 2147483648);
      days.push({
        date,
        inbound: Math.floor(total * 0.6),
        outbound: Math.floor(total * 0.4),
        total,
      });
    }
    return days;
  }

  private createMockFeatureUsage(): any[] {
    return [
      {
        featureId: 'code_generation',
        featureName: 'Code Generation',
        category: 'core',
        users: 600,
        usageCount: 25000,
        adoptionRate: 75,
        usageFrequency: 42,
        averageSessionTime: 15,
        retention: 85,
        growthRate: 12,
        lastUsed: new Date(),
        firstUsed: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        status: 'stable',
      },
      {
        featureId: 'project_management',
        featureName: 'Project Management',
        category: 'core',
        users: 550,
        usageCount: 18000,
        adoptionRate: 69,
        usageFrequency: 33,
        averageSessionTime: 25,
        retention: 80,
        growthRate: 8,
        lastUsed: new Date(),
        firstUsed: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000),
        status: 'stable',
      },
    ];
  }

  private createMockUserSegments(): any[] {
    return [
      {
        segmentId: 'power_users',
        name: 'Power Users',
        description: 'Highly engaged users with advanced feature usage',
        criteria: [],
        userCount: 150,
        averageHealthScore: 85,
        averageLtv: 5000,
        churnRate: 3,
        expansionRate: 25,
        characteristics: {
          primaryFeatures: ['code_generation', 'automation', 'analytics'],
          averageUsage: 150,
          commonPatterns: ['Daily usage', 'Advanced features', 'API usage'],
          demographics: {},
        },
      },
    ];
  }

  private createMockActionPatterns(): any[] {
    return [
      {
        action: 'login',
        frequency: 800,
        averageTime: 0,
        commonNextActions: [
          { action: 'view_projects', probability: 0.6 },
          { action: 'create_project', probability: 0.3 },
          { action: 'view_analytics', probability: 0.1 },
        ],
      },
    ];
  }

  private createMockTimePatterns(): any[] {
    return [
      {
        period: 'hour_of_day',
        peakTimes: [10, 14, 16],
        averageActivity: 125,
        distribution: Array(24).fill(0).map((_, i) =>
          i >= 9 && i <= 17 ? 100 + Math.floor(Math.random() * 50) : 20 + Math.floor(Math.random() * 30)
        ),
      },
    ];
  }

  private createMockFeatureSequences(): any[] {
    return [
      {
        sequence: ['login', 'view_projects', 'open_project', 'generate_code'],
        frequency: 150,
        averageDuration: 45,
        conversionRate: 85,
      },
    ];
  }

  private createMockCommonPaths(): any[] {
    return [
      {
        path: [
          { feature: 'login', action: 'login', averageTime: 0 },
          { feature: 'projects', action: 'view', averageTime: 2 },
          { feature: 'projects', action: 'create', averageTime: 5 },
          { feature: 'code_generation', action: 'generate', averageTime: 15 },
        ],
        frequency: 200,
        percentage: 25,
        averageDuration: 20,
        completionRate: 80,
        dropOffPoints: [2],
      },
    ];
  }

  private createMockEndpointAnalytics(): any[] {
    return [
      {
        path: '/api/v1/generate',
        method: 'POST',
        requests: 500000,
        uniqueUsers: 600,
        averageResponseTime: 150,
        p95ResponseTime: 250,
        p99ResponseTime: 450,
        errorRate: 0.3,
        statusCodes: {
          '200': 498500,
          '400': 1000,
          '401': 300,
          '500': 200,
        },
        growthRate: 15,
        lastUsed: new Date(),
      },
    ];
  }

  private createMockRetentionData(): any {
    return {
      data: {
        cohorts: ['Jan', 'Feb', 'Mar'],
        periods: [0, 1, 2, 3],
        data: [
          [100, 75, 65, 55],
          [100, 78, 68, 58],
          [100, 80, 70, 60],
        ],
      },
      averageRetention: [100, 78, 68, 58],
      bestCohort: 'Mar',
      worstCohort: 'Jan',
      insights: [
        'Retention improving over time',
        '30-day retention at 68%',
      ],
    };
  }

  private createMockRevenueData(): any {
    return {
      data: {
        cohorts: ['Jan', 'Feb', 'Mar'],
        periods: [0, 1, 2, 3],
        data: [
          [25000, 23750, 22500, 21250],
          [28000, 26600, 25200, 23800],
          [30000, 28500, 27000, 25650],
        ],
      },
      totalRevenue: 287000,
      averageRevenuePerCohort: 95667,
      revenueByPeriod: [83000, 78850, 74700, 70700],
    };
  }

  private createMockConversionMetrics(): any {
    return {
      overallRate: 35,
      bySegment: {
        enterprise: 45,
        mid_market: 35,
        small_business: 25,
      },
      byCohort: {},
      trends: [],
      optimalPath: ['signup', 'verify', 'create_project', 'generate_code'],
    };
  }

  private createMockDropOffAnalysis(): any {
    return {
      totalDropOffs: 650,
      dropOffRate: 65,
      dropOffsByStep: {
        signup: 50,
        verify: 100,
        create_project: 200,
        generate_code: 300,
      },
      commonReasons: [
        'Complex setup process',
        'Lack of clear guidance',
        'Technical issues',
      ],
      suggestedActions: [
        'Simplify signup flow',
        'Add interactive tutorial',
        'Improve onboarding documentation',
      ],
    };
  }

  private generateId(): string {
    return `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
