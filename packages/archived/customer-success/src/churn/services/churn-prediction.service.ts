/**
 * Churn Prediction Service
 * ML-based churn prediction and risk assessment
 */

import {
  ChurnPrediction,
  ChurnModel,
  ChurnAnalysis,
  ChurnIntervention,
  RiskLevel,
  ChurnType,
  RiskFactor,
  FeatureImportance,
  InterventionRecommendation,
  InterventionType,
  ChurnStage,
  ChurnTrajectory,
} from '../types/churn.types';

export class ChurnPredictionService {
  private models: Map<string, ChurnModel> = new Map();
  private predictions: Map<string, ChurnPrediction> = new Map();
  private activeModel: ChurnModel | null = null;

  constructor() {
    this.initializeDefaultModel();
  }

  /**
   * Predict churn risk for a customer
   */
  async predictChurn(customerId: string, timeHorizon: number = 90): Promise<ChurnPrediction> {
    const model = this.getActiveModel();
    if (!model) {
      throw new Error('No active churn prediction model available');
    }

    // Collect features for prediction
    const features = await this.collectFeatures(customerId);

    // Run prediction
    const prediction = await this.runPrediction(model, features, customerId, timeHorizon);

    // Analyze risk factors
    const riskFactors = await this.identifyRiskFactors(customerId, features, prediction);

    // Generate intervention recommendations
    const interventions = await this.generateInterventions(customerId, prediction, riskFactors);

    // Calculate trends
    const trends = await this.calculateTrends(customerId);

    const churnPrediction: ChurnPrediction = {
      id: this.generateId(),
      customerId,
      prediction: {
        willChurn: prediction.probability > 0.5,
        probability: prediction.probability,
        confidence: prediction.confidence,
        expectedChurnDate: prediction.probability > 0.5
          ? new Date(Date.now() + timeHorizon * 24 * 60 * 60 * 1000)
          : undefined,
        churnType: this.predictChurnType(riskFactors),
        primaryReason: this.getPrimaryReason(riskFactors),
        secondaryReasons: this.getSecondaryReasons(riskFactors),
        preventable: this.isPreventable(riskFactors),
      },
      riskFactors,
      riskScore: this.calculateRiskScore(prediction.probability, riskFactors),
      riskLevel: this.determineRiskLevel(prediction.probability),
      probability: prediction.probability,
      confidence: prediction.confidence,
      predictedChurnDate: prediction.probability > 0.5
        ? new Date(Date.now() + timeHorizon * 24 * 60 * 60 * 1000)
        : undefined,
      timeHorizon,
      modelVersion: model.version,
      features: this.calculateFeatureImportance(features),
      trends,
      interventions,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastUpdated: new Date(),
      history: [],
    };

    this.predictions.set(customerId, churnPrediction);
    return churnPrediction;
  }

  /**
   * Analyze churn risk in detail
   */
  async analyzeChurnRisk(customerId: string): Promise<ChurnAnalysis> {
    const prediction = await this.predictChurn(customerId);

    const patterns = await this.identifyChurnPatterns(customerId);
    const signals = await this.detectChurnSignals(customerId);
    const indicators = await this.calculateChurnIndicators(customerId);
    const stage = this.determineChurnStage(prediction);
    const trajectory = await this.calculateChurnTrajectory(customerId, prediction);
    const similarCases = await this.findSimilarCustomers(customerId, prediction);
    const recommendations = await this.generateAnalysisRecommendations(prediction);

    return {
      id: this.generateId(),
      customerId,
      period: {
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        end: new Date(),
        type: 'predictive',
      },
      summary: {
        currentRisk: prediction.riskLevel,
        riskScore: prediction.riskScore,
        riskTrend: this.getTrendDirection(prediction.trends),
        primaryDrivers: prediction.riskFactors.slice(0, 3).map(f => f.name),
        churnProbability: prediction.probability,
        confidence: prediction.confidence,
        estimatedChurnDate: prediction.predictedChurnDate,
        revenueAtRisk: await this.calculateRevenueAtRisk(customerId),
      },
      patterns,
      signals,
      indicators,
      stage,
      trajectory,
      similarCases,
      recommendations,
      generatedAt: new Date(),
    };
  }

  /**
   * Batch predict churn for multiple customers
   */
  async batchPredictChurn(customerIds: string[]): Promise<Map<string, ChurnPrediction>> {
    const results = new Map<string, ChurnPrediction>();

    for (const customerId of customerIds) {
      try {
        const prediction = await this.predictChurn(customerId);
        results.set(customerId, prediction);
      } catch (error) {
        console.error(`Failed to predict churn for ${customerId}:`, error);
      }
    }

    return results;
  }

  /**
   * Train a new churn prediction model
   */
  async trainModel(config: {
    algorithm: string;
    features: string[];
    trainingPeriod: { start: Date; end: Date };
    hyperparameters?: Record<string, any>;
  }): Promise<ChurnModel> {
    const model: ChurnModel = {
      id: this.generateId(),
      name: `Churn Model ${new Date().toISOString()}`,
      description: 'Trained churn prediction model',
      version: `${Date.now()}`,
      type: 'classification',
      algorithm: config.algorithm as any,
      status: 'training',
      performance: this.getMockPerformance(),
      features: config.features.map((f, i) => ({
        name: f,
        type: 'numerical',
        importance: 1 - (i * 0.1),
        description: `Feature ${f}`,
        source: 'analytics',
        missingValueStrategy: 'mean',
      })),
      configuration: {
        hyperparameters: config.hyperparameters || {},
        featureSelection: {
          method: 'mutual_info',
          maxFeatures: config.features.length,
        },
        crossValidation: {
          method: 'stratified_k_fold',
          folds: 5,
          shuffle: true,
          stratify: true,
        },
        training: {
          earlyStopping: true,
          earlyStoppingPatience: 10,
          classWeight: 'balanced',
        },
        prediction: {
          threshold: 0.5,
          minConfidence: 0.6,
          timeHorizon: 90,
          recalibrationInterval: 30,
        },
      },
      trainingData: {
        source: 'historical_data',
        periodStart: config.trainingPeriod.start,
        periodEnd: config.trainingPeriod.end,
        sampleSize: 10000,
        positiveSamples: 1500,
        negativeSamples: 8500,
        imbalanceRatio: 5.67,
        features: config.features.length,
        splits: [
          { name: 'train', size: 7000, percentage: 70, churnRate: 15 },
          { name: 'validation', size: 1500, percentage: 15, churnRate: 15 },
          { name: 'test', size: 1500, percentage: 15, churnRate: 15 },
        ],
      },
      deployment: {
        environment: 'development',
        version: '0.1.0',
        deployedAt: new Date(),
        deployedBy: 'system',
        predictionsMade: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTrainedAt: new Date(),
    };

    // Simulate training completion
    setTimeout(() => {
      model.status = 'trained';
      this.models.set(model.id, model);
    }, 5000);

    this.models.set(model.id, model);
    return model;
  }

  /**
   * Deploy a model to production
   */
  async deployModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    model.status = 'deployed';
    model.deployment = {
      ...model.deployment,
      environment: 'production',
      deployedAt: new Date(),
    };
    this.activeModel = model;
  }

  /**
   * Get active model
   */
  getActiveModel(): ChurnModel | null {
    return this.activeModel;
  }

  /**
   * Create and execute intervention
   */
  async createIntervention(
    customerId: string,
    intervention: InterventionRecommendation
  ): Promise<ChurnIntervention> {
    const prediction = this.predictions.get(customerId);
    if (!prediction) {
      throw new Error(`No prediction found for customer: ${customerId}`);
    }

    const churnIntervention: ChurnIntervention = {
      id: this.generateId(),
      customerId,
      predictionId: prediction.id,
      type: intervention.type,
      status: 'pending',
      assignedTo: intervention.assignedTo || 'customer_success',
      actions: intervention.actions.map((a, i) => ({
        ...a,
        order: i + 1,
        completed: false,
      })),
      timeline: {
        plannedStartDate: new Date(),
        plannedEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        milestones: [
          {
            stageId: 'initial',
            stageName: 'Initial Contact',
            targetDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            status: 'pending',
          },
          {
            stageId: 'follow_up',
            stageName: 'Follow-up',
            targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: 'pending',
          },
        ],
      },
      budget: intervention.cost,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return churnIntervention;
  }

  /**
   * Get customers at risk
   */
  async getCustomersAtRisk(
    riskLevel: RiskLevel,
    limit: number = 50
  ): Promise<ChurnPrediction[]> {
    const predictions = Array.from(this.predictions.values());
    return predictions
      .filter(p => p.riskLevel === riskLevel)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit);
  }

  /**
   * Get churn forecast
   */
  async getChurnForecast(
    period: 'month' | 'quarter' | 'year'
  ): Promise<{
    period: { start: Date; end: Date };
    predictedChurn: number;
    predictedChurnRate: number;
    predictedRevenue: number;
    confidence: number;
    byRiskLevel: Record<RiskLevel, number>;
  }> {
    const predictions = Array.from(this.predictions.values());
    const atRisk = predictions.filter(p => p.riskLevel !== 'none' && p.riskLevel !== 'low');

    const predictedChurn = atRisk.filter(p => p.probability > 0.6).length;
    const totalCustomers = predictions.length;
    const predictedChurnRate = totalCustomers > 0 ? (predictedChurn / totalCustomers) * 100 : 0;

    const predictedRevenue = await this.calculatePredictedRevenueLoss(atRisk);

    const byRiskLevel: Record<RiskLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    predictions.forEach(p => {
      byRiskLevel[p.riskLevel]++;
    });

    const now = new Date();
    let endDate = new Date();
    switch (period) {
      case 'month':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarter':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'year':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    return {
      period: { start: now, end: endDate },
      predictedChurn,
      predictedChurnRate,
      predictedRevenue,
      confidence: 0.85,
      byRiskLevel,
    };
  }

  // Private helper methods

  private initializeDefaultModel(): void {
    const defaultModel: ChurnModel = {
      id: 'default_model',
      name: 'Default Churn Prediction Model',
      description: 'Default model for churn prediction',
      version: '1.0.0',
      type: 'classification',
      algorithm: 'random_forest',
      status: 'deployed',
      performance: this.getMockPerformance(),
      features: [
        { name: 'usage_decline', type: 'numerical', importance: 0.9, description: 'Usage decline rate', source: 'analytics', missingValueStrategy: 'mean' },
        { name: 'engagement_score', type: 'numerical', importance: 0.85, description: 'Engagement score', source: 'analytics', missingValueStrategy: 'mean' },
        { name: 'support_tickets', type: 'numerical', importance: 0.75, description: 'Number of support tickets', source: 'support', missingValueStrategy: 'median' },
        { name: 'nps_score', type: 'numerical', importance: 0.8, description: 'NPS score', source: 'surveys', missingValueStrategy: 'mean' },
        { name: 'payment_failures', type: 'numerical', importance: 0.7, description: 'Payment failures', source: 'billing', missingValueStrategy: 'zero' },
        { name: 'login_frequency', type: 'numerical', importance: 0.65, description: 'Login frequency', source: 'analytics', missingValueStrategy: 'mean' },
      ],
      configuration: {
        hyperparameters: { n_estimators: 100, max_depth: 10 },
        featureSelection: { method: 'mutual_info', maxFeatures: 20 },
        crossValidation: { method: 'stratified_k_fold', folds: 5, shuffle: true, stratify: true },
        training: { earlyStopping: true, earlyStoppingPatience: 10, classWeight: 'balanced' },
        prediction: { threshold: 0.5, minConfidence: 0.6, timeHorizon: 90, recalibrationInterval: 30 },
      },
      trainingData: {
        source: 'historical_data',
        periodStart: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        sampleSize: 10000,
        positiveSamples: 1500,
        negativeSamples: 8500,
        imbalanceRatio: 5.67,
        features: 6,
        splits: [
          { name: 'train', size: 7000, percentage: 70, churnRate: 15 },
          { name: 'validation', size: 1500, percentage: 15, churnRate: 15 },
          { name: 'test', size: 1500, percentage: 15, churnRate: 15 },
        ],
      },
      deployment: {
        environment: 'production',
        version: '1.0.0',
        deployedAt: new Date(),
        deployedBy: 'system',
        predictionsMade: 0,
        lastPredictionAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTrainedAt: new Date(),
    };

    this.models.set(defaultModel.id, defaultModel);
    this.activeModel = defaultModel;
  }

  private getMockPerformance(): any {
    return {
      accuracy: 0.87,
      precision: 0.82,
      recall: 0.78,
      f1Score: 0.80,
      auc: 0.89,
      confusionMatrix: {
        truePositives: 1170,
        trueNegatives: 7425,
        falsePositives: 1075,
        falseNegatives: 330,
      },
      calibration: 0.85,
      lift: {
        liftScore: 3.5,
        liftByDecile: [4.2, 3.8, 3.2, 2.8, 2.1, 1.7, 1.3, 1.0, 0.7, 0.5],
        cumulativeLift: [4.2, 4.0, 3.7, 3.5, 3.2, 2.9, 2.6, 2.3, 2.0, 1.8],
      },
      validation: {
        crossValidation: {
          folds: 5,
          meanAccuracy: 0.86,
          stdAccuracy: 0.02,
          meanAuc: 0.88,
          stdAuc: 0.03,
        },
        holdout: {
          accuracy: 0.87,
          precision: 0.82,
          recall: 0.78,
          f1Score: 0.80,
          auc: 0.89,
        },
        benchmark: {
          baselineAccuracy: 0.75,
          improvement: 0.12,
          baselineModel: 'logistic_regression',
        },
      },
    };
  }

  private async collectFeatures(customerId: string): Promise<Record<string, number>> {
    // Mock implementation - in production, fetch from various data sources
    return {
      usage_decline: 0.25,
      engagement_score: 65,
      support_tickets: 8,
      nps_score: 35,
      payment_failures: 1,
      login_frequency: 0.6,
      days_since_last_login: 7,
      feature_usage_depth: 45,
      contract_days_remaining: 60,
      revenue_at_risk: 2500,
    };
  }

  private async runPrediction(
    model: ChurnModel,
    features: Record<string, number>,
    customerId: string,
    timeHorizon: number
  ): Promise<{ probability: number; confidence: number }> {
    // Mock prediction - in production, this would use the actual ML model
    let probability = 0.3; // Base probability

    // Adjust based on features
    if (features.usage_decline > 0.2) probability += 0.2;
    if (features.engagement_score < 50) probability += 0.15;
    if (features.support_tickets > 5) probability += 0.1;
    if (features.nps_score < 40) probability += 0.15;
    if (features.payment_failures > 0) probability += 0.1;
    if (features.days_since_last_login > 14) probability += 0.15;

    probability = Math.min(probability, 0.95);
    const confidence = 0.75 + (Math.random() * 0.15);

    return { probability, confidence };
  }

  private async identifyRiskFactors(
    customerId: string,
    features: Record<string, number>,
    prediction: { probability: number; confidence: number }
  ): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    if (features.usage_decline > 0.15) {
      riskFactors.push({
        id: this.generateId(),
        name: 'Declining Usage',
        category: 'usage',
        severity: features.usage_decline > 0.3 ? 'high' : 'medium',
        score: features.usage_decline * 100,
        weight: 0.25,
        currentValue: features.usage_decline,
        threshold: 0.15,
        trend: 'increasing',
        description: `Usage has declined by ${features.usage_decline * 100}%`,
        evidence: [
          {
            type: 'metric',
            description: 'Daily active users decreased',
            timestamp: new Date(),
            value: features.usage_decline,
            source: 'analytics',
          },
        ],
        startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        duration: 30,
      });
    }

    if (features.engagement_score < 60) {
      riskFactors.push({
        id: this.generateId(),
        name: 'Low Engagement',
        category: 'engagement',
        severity: features.engagement_score < 40 ? 'high' : 'medium',
        score: 100 - features.engagement_score,
        weight: 0.2,
        currentValue: features.engagement_score,
        threshold: 60,
        trend: 'stable',
        description: `Engagement score is ${features.engagement_score}/100`,
        evidence: [
          {
            type: 'metric',
            description: 'Low interaction rate and session duration',
            timestamp: new Date(),
            value: features.engagement_score,
            source: 'analytics',
          },
        ],
        startedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        duration: 45,
      });
    }

    if (features.support_tickets > 5) {
      riskFactors.push({
        id: this.generateId(),
        name: 'High Support Volume',
        category: 'support',
        severity: features.support_tickets > 10 ? 'high' : 'medium',
        score: Math.min(features.support_tickets * 8, 100),
        weight: 0.15,
        currentValue: features.support_tickets,
        threshold: 5,
        trend: 'increasing',
        description: `${features.support_tickets} support tickets in the last 30 days`,
        evidence: [
          {
            type: 'metric',
            description: 'Elevated support ticket volume',
            timestamp: new Date(),
            value: features.support_tickets,
            source: 'support',
          },
        ],
        startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        duration: 30,
      });
    }

    if (features.nps_score < 50) {
      riskFactors.push({
        id: this.generateId(),
        name: 'Low Satisfaction',
        category: 'satisfaction',
        severity: features.nps_score < 20 ? 'critical' : features.nps_score < 40 ? 'high' : 'medium',
        score: 100 - features.nps_score,
        weight: 0.2,
        currentValue: features.nps_score,
        threshold: 50,
        trend: 'stable',
        description: `NPS score is ${features.nps_score} (${features.nps_score < 0 ? 'detractor' : features.nps_score < 50 ? 'passive' : 'promoter'})`,
        evidence: [
          {
            type: 'feedback',
            description: 'Recent NPS survey responses indicate dissatisfaction',
            timestamp: new Date(),
            value: features.nps_score,
            source: 'surveys',
          },
        ],
        startedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        duration: 60,
      });
    }

    return riskFactors.sort((a, b) => b.score - a.score);
  }

  private async generateInterventions(
    customerId: string,
    prediction: { probability: number; confidence: number },
    riskFactors: RiskFactor[]
  ): Promise<InterventionRecommendation[]> {
    const interventions: InterventionRecommendation[] = [];

    if (prediction.probability > 0.6) {
      interventions.push({
        id: this.generateId(),
        type: 'contact_outreach',
        priority: 'urgent',
        title: 'Immediate Customer Outreach',
        description: 'High churn risk detected - immediate outreach recommended',
        rationale: `Churn probability is ${(prediction.probability * 100).toFixed(0)}%`,
        expectedImpact: [{ area: 'Churn Reduction', improvement: 40 }],
        confidence: 0.75,
        effort: 'medium',
        cost: 100,
        estimatedTimeToImplement: 1,
        actions: [
          {
            order: 1,
            action: 'Schedule executive outreach call',
            type: 'manual',
            assignee: 'customer_success_manager',
            dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            completed: false,
          },
          {
            order: 2,
            action: 'Prepare personalized retention plan',
            type: 'manual',
            assignee: 'customer_success_manager',
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            completed: false,
          },
        ],
        playbooks: ['high_risk_retention'],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (riskFactors.some(f => f.category === 'engagement')) {
      interventions.push({
        id: this.generateId(),
        type: 'feature_training',
        priority: 'high',
        title: 'Feature Training and Best Practices',
        description: 'Improve engagement through targeted training',
        rationale: 'Low engagement identified as primary risk factor',
        expectedImpact: [{ area: 'Engagement', improvement: 30 }],
        confidence: 0.70,
        effort: 'low',
        cost: 50,
        estimatedTimeToImplement: 3,
        actions: [
          {
            order: 1,
            action: 'Schedule personalized training session',
            type: 'manual',
            assignee: 'customer_success_manager',
            completed: false,
          },
          {
            order: 2,
            action: 'Send curated best practices guide',
            type: 'automated',
            completed: false,
          },
        ],
        playbooks: ['engagement_improvement'],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (riskFactors.some(f => f.category === 'support')) {
      interventions.push({
        id: this.generateId(),
        type: 'support_upgrade',
        priority: 'high',
        title: 'Proactive Support Resolution',
        description: 'Address outstanding support issues',
        rationale: 'High support ticket volume indicates unresolved issues',
        expectedImpact: [{ area: 'Satisfaction', improvement: 35 }],
        confidence: 0.80,
        effort: 'medium',
        cost: 150,
        estimatedTimeToImplement: 5,
        actions: [
          {
            order: 1,
            action: 'Review all open tickets',
            type: 'manual',
            assignee: 'support_lead',
            completed: false,
          },
          {
            order: 2,
            action: 'Prioritize and escalate critical issues',
            type: 'manual',
            assignee: 'support_lead',
            completed: false,
          },
          {
            order: 3,
            action: 'Assign dedicated support specialist',
            type: 'manual',
            assignee: 'support_manager',
            completed: false,
          },
        ],
        playbooks: ['support_recovery'],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return interventions;
  }

  private async calculateTrends(customerId: string): Promise<any> {
    return {
      riskScore: {
        current: 65,
        previous: 55,
        change: 10,
        direction: 'up',
        dataPoints: [
          { date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), value: 45 },
          { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), value: 50 },
          { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), value: 55 },
          { date: new Date(), value: 65 },
        ],
        movingAverage: 54,
        trendLine: {
          slope: 0.2,
          intercept: 40,
          correlation: 0.95,
        },
      },
      usage: {
        current: 75,
        previous: 80,
        change: -5,
        direction: 'down',
        dataPoints: [],
        movingAverage: 78,
        trendLine: { slope: -0.15, intercept: 85, correlation: -0.85 },
      },
      engagement: {
        current: 60,
        previous: 70,
        change: -10,
        direction: 'down',
        dataPoints: [],
        movingAverage: 68,
        trendLine: { slope: -0.25, intercept: 80, correlation: -0.90 },
      },
    };
  }

  private calculateFeatureImportance(features: Record<string, number>): FeatureImportance[] {
    return Object.entries(features).map(([feature, value], index) => ({
      feature,
      importance: 1 - (index * 0.15),
      value,
      contribution: this.getContribution(feature, value),
      category: this.getFeatureCategory(feature),
    }));
  }

  private getContribution(feature: string, value: number): string {
    if (feature === 'usage_decline' && value > 0.2) return 'High - Strong indicator of churn risk';
    if (feature === 'engagement_score' && value < 50) return 'High - Low engagement increases churn likelihood';
    if (feature === 'nps_score' && value < 40) return 'High - Poor satisfaction predicts churn';
    return 'Medium - Contributing factor';
  }

  private getFeatureCategory(feature: string): string {
    if (feature.includes('usage')) return 'Usage';
    if (feature.includes('engagement') || feature.includes('login')) return 'Engagement';
    if (feature.includes('support')) return 'Support';
    if (feature.includes('nps') || feature.includes('satisfaction')) return 'Satisfaction';
    if (feature.includes('payment')) return 'Financial';
    return 'Other';
  }

  private calculateRiskScore(probability: number, riskFactors: RiskFactor[]): number {
    let riskScore = probability * 100;

    // Adjust based on risk factors
    riskFactors.forEach(factor => {
      riskScore += factor.score * factor.weight;
    });

    return Math.min(Math.round(riskScore), 100);
  }

  private determineRiskLevel(probability: number): RiskLevel {
    if (probability >= 0.8) return 'critical';
    if (probability >= 0.6) return 'high';
    if (probability >= 0.4) return 'medium';
    if (probability >= 0.2) return 'low';
    return 'none';
  }

  private predictChurnType(riskFactors: RiskFactor[]): ChurnType {
    if (riskFactors.some(f => f.category === 'support')) return 'service_related';
    if (riskFactors.some(f => f.category === 'engagement')) return 'passive';
    if (riskFactors.some(f => f.category === 'satisfaction')) return 'active';
    return 'voluntary';
  }

  private getPrimaryReason(riskFactors: RiskFactor[]): string {
    return riskFactors.length > 0 ? riskFactors[0].name : 'Unknown';
  }

  private getSecondaryReasons(riskFactors: RiskFactor[]): string[] {
    return riskFactors.slice(1, 4).map(f => f.name);
  }

  private isPreventable(riskFactors: RiskFactor[]): boolean {
    const preventableCategories = ['usage', 'engagement', 'support'];
    return riskFactors.some(f => preventableCategories.includes(f.category));
  }

  private getTrendDirection(trends: any): 'increasing' | 'stable' | 'decreasing' {
    return trends.riskScore.direction === 'up' ? 'increasing' :
           trends.riskScore.direction === 'down' ? 'decreasing' : 'stable';
  }

  private async calculateRevenueAtRisk(customerId: string): Promise<number> {
    // Mock implementation
    return 5000;
  }

  private async identifyChurnPatterns(customerId: string): Promise<any[]> {
    return [
      {
        id: this.generateId(),
        name: 'Gradual Usage Decline',
        description: 'Steady decrease in usage over the past 60 days',
        category: 'usage_decline',
        confidence: 0.85,
        strength: 'strong',
        timeframe: 60,
        occurrences: 8,
        significance: 0.92,
        examples: [],
      },
    ];
  }

  private async detectChurnSignals(customerId: string): Promise<any[]> {
    return [
      {
        id: this.generateId(),
        type: 'usage_drop',
        severity: 'high',
        description: '30% drop in daily active users',
        value: 30,
        threshold: 20,
        status: 'active',
        firstDetected: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        lastDetected: new Date(),
        occurrences: 14,
        trend: 'increasing',
        relatedSignals: [],
      },
    ];
  }

  private async calculateChurnIndicators(customerId: string): Promise<any[]> {
    return [
      {
        id: this.generateId(),
        name: 'DAU Trend',
        category: 'usage',
        value: -25,
        threshold: -15,
        status: 'warning',
        weight: 0.3,
        trend: 'declining',
        history: [],
        predictivePower: 0.82,
      },
    ];
  }

  private determineChurnStage(prediction: ChurnPrediction): ChurnStage {
    if (prediction.probability >= 0.8) return 'critical';
    if (prediction.probability >= 0.6) return 'high_risk';
    if (prediction.probability >= 0.4) return 'at_risk';
    if (prediction.probability >= 0.2) return 'early_warning';
    return 'healthy';
  }

  private async calculateChurnTrajectory(
    customerId: string,
    prediction: ChurnPrediction
  ): Promise<ChurnTrajectory> {
    const currentStage = this.determineChurnStage(prediction);

    return {
      currentStage,
      previousStage: 'healthy',
      direction: 'declining',
      velocity: 0.15,
      acceleration: 0.02,
      predictedPath: ['healthy', 'early_warning', 'at_risk', 'high_risk', 'critical'],
      predictedDates: [
        new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      ],
      confidence: prediction.confidence,
    };
  }

  private async findSimilarCustomers(
    customerId: string,
    prediction: ChurnPrediction
  ): Promise<any[]> {
    return [
      {
        customerId: 'customer_123',
        similarity: 0.85,
        outcome: 'retained',
        riskFactors: ['Declining Usage', 'Low Engagement'],
        keyDifferences: ['Higher revenue', 'Longer tenure'],
        lessons: ['Personal outreach was effective', 'Training improved engagement'],
      },
    ];
  }

  private async generateAnalysisRecommendations(prediction: ChurnPrediction): Promise<any[]> {
    return prediction.interventions.map(i => ({
      priority: i.priority,
      category: i.type,
      recommendation: i.title,
      rationale: i.rationale,
      expectedImpact: i.expectedImpact[0]?.improvement || 0,
      effort: i.effort,
      timeline: i.estimatedTimeToImplement * 7,
      actions: i.actions.map(a => a.action),
      resources: i.playbooks,
    }));
  }

  private async calculatePredictedRevenueLoss(predictions: ChurnPrediction[]): Promise<number> {
    // Mock implementation
    return predictions.reduce((sum, p) => sum + 5000, 0);
  }

  private generateId(): string {
    return `churn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
