/**
 * Customer Success Platform - Main Export
 * Comprehensive platform for managing customer success, health scoring, analytics, and communication
 */

// Services
export { OnboardingService } from './onboarding/services/onboarding.service';
export { HealthScoringService } from './health/services/health-scoring.service';
export { AnalyticsService } from './analytics/services/analytics.service';
export { ChurnPredictionService } from './churn/services/churn-prediction.service';
export { PlaybooksService } from './playbooks/services/playbooks.service';
export { CommunicationService } from './communication/services/communication.service';

// Types
export * from './onboarding/types/onboarding.types';
export * from './health/types/health.types';
export * from './analytics/types/analytics.types';
export * from './churn/types/churn.types';
export * from './playbooks/types/playbooks.types';
export * from './communication/types/communication.types';

// Main Customer Success Platform Class
export class CustomerSuccessPlatform {
  private onboarding: OnboardingService;
  private health: HealthScoringService;
  private analytics: AnalyticsService;
  private churn: ChurnPredictionService;
  private playbooks: PlaybooksService;
  private communication: CommunicationService;

  constructor(config?: any) {
    this.onboarding = new OnboardingService();
    this.health = new HealthScoringService(config?.health);
    this.analytics = new AnalyticsService();
    this.churn = new ChurnPredictionService();
    this.playbooks = new PlaybooksService();
    this.communication = new CommunicationService();
  }

  /**
   * Get onboarding service
   */
  getOnboardingService(): OnboardingService {
    return this.onboarding;
  }

  /**
   * Get health scoring service
   */
  getHealthScoringService(): HealthScoringService {
    return this.health;
  }

  /**
   * Get analytics service
   */
  getAnalyticsService(): AnalyticsService {
    return this.analytics;
  }

  /**
   * Get churn prediction service
   */
  getChurnPredictionService(): ChurnPredictionService {
    return this.churn;
  }

  /**
   * Get playbooks service
   */
  getPlaybooksService(): PlaybooksService {
    return this.playbooks;
  }

  /**
   * Get communication service
   */
  getCommunicationService(): CommunicationService {
    return this.communication;
  }

  /**
   * Get comprehensive customer view
   */
  async getCustomerView(customerId: string): Promise<{
    health: any;
    analytics: any;
    churnRisk: any;
    recommendations: string[];
  }> {
    const [health, analytics, churnRisk] = await Promise.all([
      this.health.calculateHealthScore(customerId),
      this.analytics.generateAnalytics(customerId, {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
        type: 'monthly',
      }),
      this.churn.predictChurn(customerId),
    ]);

    const recommendations: string[] = [];

    // Generate recommendations based on health score
    if (health.score.overall < 70) {
      recommendations.push('Health score is below threshold - consider intervention');
    }

    // Generate recommendations based on churn risk
    if (churnRisk.probability > 0.5) {
      recommendations.push('High churn risk detected - execute retention playbook');
    }

    // Generate recommendations based on analytics
    if (analytics.metrics.usage.activeUsers.dau < 50) {
      recommendations.push('Low daily active users - send engagement campaign');
    }

    return {
      health,
      analytics,
      churnRisk,
      recommendations,
    };
  }

  /**
   * Initialize customer success for a new customer
   */
  async initializeCustomer(
    customerId: string,
    customerType: string
  ): Promise<{
    onboarding: any;
    health: any;
    communication: any;
  }> {
    // Initialize onboarding
    const onboarding = await this.onboarding.initializeOnboarding(
      customerId,
      customerType as any
    );

    // Calculate initial health score
    const health = await this.health.calculateHealthScore(customerId);

    // Set up default communication preferences
    const preferences = await this.communication.getPreferences(customerId);

    // Send welcome message
    const welcomeMessage = await this.communication.sendMessage(
      customerId,
      'email',
      'Welcome to ClaudeFlare!',
      'Hello {{customerName}}, welcome to ClaudeFlare! We\'re excited to have you on board.',
      {
        variables: { customerName: 'Customer' },
        metadata: { category: 'onboarding' },
      }
    );

    return {
      onboarding,
      health,
      communication: {
        preferences,
        welcomeMessage,
      },
    };
  }
}

// Factory function
export function createCustomerSuccessPlatform(config?: any): CustomerSuccessPlatform {
  return new CustomerSuccessPlatform(config);
}
