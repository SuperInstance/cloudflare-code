/**
 * Customer Success Platform - Default Configuration
 * Central configuration for all customer success services
 */

export interface CustomerSuccessConfig {
  health: HealthScoringConfig;
  onboarding: OnboardingConfig;
  analytics: AnalyticsConfig;
  churn: ChurnPredictionConfig;
  playbooks: PlaybooksConfig;
  communication: CommunicationConfig;
}

export interface HealthScoringConfig {
  refreshInterval: number; // hours
  alertThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
  weights: {
    usage: number;
    adoption: number;
    engagement: number;
    support: number;
    satisfaction: number;
    growth: number;
  };
}

export interface OnboardingConfig {
  defaultTemplates: {
    enterprise: string;
    midMarket: string;
    smallBusiness: string;
  };
  timeToValueTarget: number; // days
  completionThreshold: number; // percentage
  autoProgression: boolean;
}

export interface AnalyticsConfig {
  retentionPeriod: number; // days
  aggregationInterval: number; // minutes
  realTimeWindow: number; // minutes
  batchProcessingWindow: number; // hours
}

export interface ChurnPredictionConfig {
  modelRefreshInterval: number; // days
  predictionHorizon: number; // days
  minConfidence: number; // 0-1
  riskThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface PlaybooksConfig {
  autoExecution: boolean;
  approvalRequired: boolean;
  approvers: string[];
  defaultAssignee: string;
}

export interface CommunicationConfig {
  defaultChannels: ('email' | 'in_app' | 'push' | 'sms')[];
  sendingQuota: {
    perDay: number;
    perHour: number;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM
    end: string; // HH:MM
    timezone: string;
  };
}

export const DEFAULT_CONFIG: CustomerSuccessConfig = {
  health: {
    refreshInterval: 24,
    alertThresholds: {
      critical: 40,
      high: 55,
      medium: 70,
    },
    weights: {
      usage: 0.25,
      adoption: 0.20,
      engagement: 0.20,
      support: 0.10,
      satisfaction: 0.15,
      growth: 0.10,
    },
  },
  onboarding: {
    defaultTemplates: {
      enterprise: 'enterprise_onboarding_v1',
      midMarket: 'midmarket_onboarding_v1',
      smallBusiness: 'smb_onboarding_v1',
    },
    timeToValueTarget: 14,
    completionThreshold: 80,
    autoProgression: true,
  },
  analytics: {
    retentionPeriod: 365,
    aggregationInterval: 15,
    realTimeWindow: 5,
    batchProcessingWindow: 1,
  },
  churn: {
    modelRefreshInterval: 30,
    predictionHorizon: 90,
    minConfidence: 0.6,
    riskThresholds: {
      critical: 0.8,
      high: 0.6,
      medium: 0.4,
      low: 0.2,
    },
  },
  playbooks: {
    autoExecution: false,
    approvalRequired: false,
    approvers: [],
    defaultAssignee: 'customer_success_manager',
  },
  communication: {
    defaultChannels: ['email', 'in_app'],
    sendingQuota: {
      perDay: 10000,
      perHour: 1000,
    },
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
      timezone: 'UTC',
    },
  },
};

export function mergeConfig(userConfig?: Partial<CustomerSuccessConfig>): CustomerSuccessConfig {
  if (!userConfig) {
    return DEFAULT_CONFIG;
  }

  return {
    health: { ...DEFAULT_CONFIG.health, ...userConfig.health },
    onboarding: { ...DEFAULT_CONFIG.onboarding, ...userConfig.onboarding },
    analytics: { ...DEFAULT_CONFIG.analytics, ...userConfig.analytics },
    churn: { ...DEFAULT_CONFIG.churn, ...userConfig.churn },
    playbooks: { ...DEFAULT_CONFIG.playbooks, ...userConfig.playbooks },
    communication: { ...DEFAULT_CONFIG.communication, ...userConfig.communication },
  };
}
