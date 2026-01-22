/**
 * Architecture Engine for ClaudeFlare Application Factory
 * Generates architecture recommendations based on requirements and constraints
 */

import { z } from 'zod';
import { AnalysisResult, TechnologyRecommendation } from './requirement-analyzer';

export interface ArchitectureRecommendation {
  services: Service[];
  patterns: string[];
  technologies: Technology[];
  estimatedCost: CostEstimate;
  estimatedTimeline: string;
  risks: Risk[];
  scalabilityPlan: ScalabilityPlan;
  deploymentPlan: DeploymentPlan;
  monitoringPlan: MonitoringPlan;
}

export interface Service {
  name: string;
  type: 'worker' | 'page' | 'worker-pages' | 'database' | 'storage' | 'queue' | 'cache' | 'auth';
  purpose: string;
  technologies: string[];
  configuration: ServiceConfiguration;
  dependencies?: string[];
  scalability?: ServiceScaling;
  monitoring?: ServiceMonitoring;
}

export interface ServiceConfiguration {
  runtime: string;
  environment: string[];
  config: Record<string, any>;
  secrets?: string[];
  resources?: ResourceRequirements;
}

export interface ResourceRequirements {
  cpu: string;
  memory: string;
  storage: string;
  bandwidth: string;
}

export interface ServiceScaling {
  minInstances: number;
  maxInstances: number;
  scalingStrategy: 'horizontal' | 'vertical' | 'auto';
  triggers: ScalingTrigger[];
}

export interface ServiceMonitoring {
  metrics: string[];
  alerts: AlertConfig[];
  logging: LogConfig;
}

export interface Technology {
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'storage' | 'auth' | 'monitoring' | 'deployment';
  version: string;
  reason: string;
  alternatives?: string[];
  cloudflareOptimized?: boolean;
}

export interface CostEstimate {
  monthly: number;
  breakdown: Record<string, number>;
  currency: string;
  freeTierEligible: boolean;
  notes: string[];
}

export interface Risk {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
  probability: number;
}

export interface ScalabilityPlan {
  strategy: 'monolithic' | 'microservices' | 'serverless' | 'hybrid';
  autoScaling: boolean;
  loadBalancing: boolean;
  caching: CacheStrategy[];
  database: DatabaseScaling;
  cdn: CDNConfig;
}

export interface CacheStrategy {
  type: 'edge' | 'cdn' | 'application' | 'database';
  purpose: string;
  technology: string;
  ttl?: number;
}

export interface DatabaseScaling {
  strategy: 'read-replicas' | 'sharding' | 'scaling' | 'serverless';
  connectionPool: number;
  indexing: IndexStrategy[];
}

export interface IndexStrategy {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
}

export interface CDNConfig {
  enabled: boolean;
  provider: string;
  strategy: 'static' | 'dynamic' | 'api';
  edgeFunctions: boolean;
}

export interface DeploymentPlan {
  strategy: 'blue-green' | 'canary' | 'rolling' | 'trunk-based';
  pipeline: CIConfig;
  environment: EnvironmentConfig[];
  rollback: RollbackStrategy;
}

export interface CIConfig {
  provider: string;
  triggers: TriggerConfig[];
  stages: string[];
  artifacts: string[];
}

export interface TriggerConfig {
  event: 'push' | 'pull-request' | 'schedule' | 'manual';
  branch: string;
  conditions?: string[];
}

export interface EnvironmentConfig {
  name: string;
  purpose: string;
  features: string[];
  scaling: EnvironmentScaling;
}

export interface EnvironmentScaling {
  minInstances: number;
  maxInstances: number;
  cpu: string;
  memory: string;
}

export interface RollbackStrategy {
  automatic: boolean;
  trigger: 'error-rate' | 'performance' | 'manual';
  timeout: number;
  maxRetries: number;
}

export interface MonitoringPlan {
  infrastructure: InfrastructureMonitoring;
  application: ApplicationMonitoring;
  business: BusinessMonitoring;
  security: SecurityMonitoring;
}

export interface InfrastructureMonitoring {
  provider: string;
  metrics: string[];
  alerts: AlertConfig[];
  dashboard: string[];
}

export interface ApplicationMonitoring {
  apm: APMConfig;
  logs: LogConfig;
  tracing: TracingConfig;
}

export interface APMConfig {
  provider: string;
  sampling: number;
  transactionNaming: 'path' | 'route' | 'custom';
  customMetrics: string[];
}

export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  retention: number;
  destinations: string[];
}

export interface TracingConfig {
  enabled: true;
  provider: string;
  sampling: number;
  instrumentation: string[];
}

export interface BusinessMonitoring {
  metrics: BusinessMetric[];
  dashboards: DashboardConfig[];
  alerts: AlertConfig[];
}

export interface BusinessMetric {
  name: string;
  description: string;
  calculation: string;
  thresholds: ThresholdConfig[];
}

export interface DashboardConfig {
  name: string;
  description: string;
  panels: PanelConfig[];
  refresh: number;
}

export interface PanelConfig {
  title: string;
  type: 'chart' | 'table' | 'stat' | 'text';
  query: string;
  visualization?: VisualizationConfig;
}

export interface VisualizationConfig {
  type: 'line' | 'bar' | 'pie' | 'metric' | 'table';
  options: Record<string, any>;
}

export interface SecurityMonitoring {
  scanning: SecurityScanConfig;
  alerting: AlertConfig;
  compliance: ComplianceConfig;
}

export interface SecurityScanConfig {
  vulnerability: ScanConfig;
  code: ScanConfig;
  dependency: ScanConfig;
}

export interface ScanConfig {
  enabled: true;
  frequency: string;
  tools: string[];
  severity: string[];
}

export interface ComplianceConfig {
  standards: string[];
  checks: string[];
  reporting: string;
}

export interface AlertConfig {
  name: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
  throttling: string;
}

export interface ThresholdConfig {
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number;
  action: string;
}

/**
 * Generate architecture recommendations based on requirements
 */
export async function recommendArchitecture(
  requirements: AnalysisResult,
  constraints: any[] = [],
  preferences?: any
): Promise<ArchitectureRecommendation> {
  // Initialize recommendation structure
  const recommendation = initializeArchitecture();

  // Generate core services based on requirements
  generateCoreServices(recommendation, requirements, constraints);

  // Apply architecture patterns
  applyArchitecturePatterns(recommendation, requirements);

  // Select technologies
  selectTechnologies(recommendation, requirements, preferences);

  // Plan scalability
  planScalability(recommendation, requirements);

  // Plan deployment
  planDeployment(recommendation, requirements, constraints);

  // Plan monitoring
  planMonitoring(recommendation, requirements);

  // Estimate costs
  estimateCosts(recommendation, requirements, constraints);

  // Assess risks
  assessRisks(recommendation, requirements, constraints);

  return recommendation;
}

/**
 * Initialize architecture recommendation structure
 */
function initializeArchitecture(): ArchitectureRecommendation {
  return {
    services: [],
    patterns: [],
    technologies: [],
    estimatedCost: {
      monthly: 0,
      breakdown: {},
      currency: 'USD',
      freeTierEligible: true,
      notes: []
    },
    estimatedTimeline: '2-4 weeks',
    risks: [],
    scalabilityPlan: {
      strategy: 'serverless',
      autoScaling: true,
      loadBalancing: true,
      caching: [],
      database: {
        strategy: 'scaling',
        connectionPool: 20,
        indexing: []
      },
      cdn: {
        enabled: true,
        provider: 'Cloudflare',
        strategy: 'dynamic',
        edgeFunctions: true
      }
    },
    deploymentPlan: {
      strategy: 'canary',
      pipeline: {
        provider: 'GitHub Actions',
        triggers: [],
        stages: ['build', 'test', 'deploy'],
        artifacts: ['dist', 'report']
      },
      environment: [],
      rollback: {
        automatic: true,
        trigger: 'error-rate',
        timeout: 300,
        maxRetries: 3
      }
    },
    monitoringPlan: {
      infrastructure: {
        provider: 'Cloudflare',
        metrics: ['cpu', 'memory', 'bandwidth'],
        alerts: [],
        dashboard: ['overview', 'performance']
      },
      application: {
        apm: {
          provider: 'Sentry',
          sampling: 0.1,
          transactionNaming: 'route',
          customMetrics: ['response-time', 'error-rate']
        },
        logs: {
          level: 'info',
          format: 'json',
          retention: 30,
          destinations: ['cloudflare-logs', 'sentry']
        },
        tracing: {
          enabled: true,
          provider: 'Sentry',
          sampling: 0.05,
          instrumentation: ['http', 'database', 'cache']
        }
      },
      business: {
        metrics: [],
        dashboards: [],
        alerts: []
      },
      security: {
        scanning: {
          vulnerability: { enabled: true, frequency: 'daily', tools: ['trivy'], severity: ['medium', 'high', 'critical'] },
          code: { enabled: true, frequency: 'commit', tools: ['semgrep'], severity: ['medium', 'high', 'critical'] },
          dependency: { enabled: true, frequency: 'weekly', tools: ['npm audit'], severity: ['medium', 'high', 'critical'] }
        },
        alerting: {
          name: 'Security Alert',
          condition: 'vulnerability.detected',
          severity: 'high',
          channels: ['email', 'slack'],
          throttling: '1hour'
        },
        compliance: {
          standards: ['OWASP Top 10', 'CIS Benchmarks'],
          checks: ['vulnerabilities', 'access-controls', 'logging'],
          reporting: 'monthly'
        }
      }
    }
  };
}

/**
 * Generate core services based on requirements
 */
function generateCoreServices(
  recommendation: ArchitectureRecommendation,
  requirements: AnalysisResult,
  constraints: any[]
): void {
  const hasFrontend = requirements.technologies.some(tech => tech.category === 'framework' && ['react', 'vue', 'angular'].includes(tech.name.toLowerCase()));
  const hasBackend = requirements.technicalRequirements.some(req => req.category === 'backend');
  const hasDatabase = requirements.technicalRequirements.some(req => req.category === 'database');
  const hasAuth = requirements.securityRequirements.some(req => req.domain === 'authentication');
  const hasPayments = requirements.businessRequirements.some(req => req.goal.toLowerCase().includes('ecommerce') || req.goal.toLowerCase().includes('payment'));

  // API Gateway / Main Worker
  recommendation.services.push({
    name: 'api-gateway',
    type: 'worker',
    purpose: 'Central API gateway for all client requests',
    technologies: ['Hono', 'Zod'],
    configuration: {
      runtime: 'cloudflare:workers',
      environment: ['NODE_ENV', 'ENVIRONMENT', 'API_VERSION'],
      config: {
        rateLimiting: true,
        cors: true,
        compression: true
      },
      resources: {
        cpu: '100ms',
        memory: '128MB',
        storage: '1GB',
        bandwidth: 'unlimited'
      }
    },
    dependencies: ['auth-service'],
    scalability: {
      minInstances: 1,
      maxInstances: 100,
      scalingStrategy: 'auto',
      triggers: [{
        type: 'cpu-utilization',
        threshold: 70,
        action: 'scale-up'
      }]
    },
    monitoring: {
      metrics: ['requests', 'errors', 'response-times', 'cpu-utilization'],
      alerts: [{
        name: 'High Error Rate',
        condition: 'error-rate > 5%',
        severity: 'high',
        channels: ['slack'],
        throttling: '5min'
      }],
      logging: {
        level: 'info',
        format: 'json'
      }
    }
  });

  // Authentication Service
  if (hasAuth || requirements.securityRequirements.length > 0) {
    recommendation.services.push({
      name: 'auth-service',
      type: 'worker',
      purpose: 'Handle user authentication and authorization',
      technologies: ['Hono', 'JWT', 'bcrypt'],
      configuration: {
        runtime: 'cloudflare:workers',
        environment: ['JWT_SECRET', 'AUTH0_DOMAIN', 'GOOGLE_CLIENT_ID'],
        config: {
          sessionTimeout: 3600,
          maxLoginAttempts: 5,
          passwordPolicy: 'strong'
        },
        resources: {
          cpu: '50ms',
          memory: '64MB',
          storage: '512MB',
          bandwidth: 'unlimited'
        }
      },
      dependencies: ['database'],
      scalability: {
        minInstances: 1,
        maxInstances: 50,
        scalingStrategy: 'auto',
        triggers: [{
          type: 'request-rate',
          threshold: 1000,
          action: 'scale-up'
        }]
      }
    });
  }

  // Database Service
  if (hasDatabase || requirements.technicalRequirements.some(req => req.category === 'database')) {
    const dbTech = requirements.technologies.find(tech => tech.category === 'database');
    const dbType = dbTech?.name.toLowerCase() || 'postgres';

    recommendation.services.push({
      name: 'database-service',
      type: 'database',
      purpose: 'Data storage and retrieval for the application',
      technologies: [dbType],
      configuration: {
        runtime: dbType === 'postgres' ? 'cloudflare:d1' : 'cloudflare:kv',
        environment: ['DATABASE_URL', 'DATABASE_SSL'],
        config: {
          connectionPool: 20,
          maxConnections: 100,
          queryTimeout: 30000
        },
        secrets: ['DATABASE_PASSWORD', 'DATABASE_USERNAME']
      },
      scalability: {
        minInstances: 1,
        maxInstances: 1,
        scalingStrategy: 'vertical',
        triggers: []
      }
    });
  }

  // File Storage Service
  if (requirements.technicalRequirements.some(req => req.category === 'storage') ||
      requirements.businessRequirements.some(req => req.goal.toLowerCase().includes('ecommerce') || req.goal.toLowerCase().includes('files'))) {
    recommendation.services.push({
      name: 'storage-service',
      type: 'storage',
      purpose: 'File and object storage for uploads and assets',
      technologies: ['Cloudflare R2', 'MinIO'],
      configuration: {
        runtime: 'cloudflare:workers',
        environment: ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_API_TOKEN'],
        config: {
          maxFileSize: '100MB',
          allowedTypes: ['image', 'video', 'document'],
          cdnEnabled: true
        },
        resources: {
          cpu: '30ms',
          memory: '32MB',
          storage: 'unlimited',
          bandwidth: 'unlimited'
        }
      },
      scalability: {
        minInstances: 1,
        maxInstances: 20,
        scalingStrategy: 'auto',
        triggers: [{
          type: 'storage-size',
          threshold: '10GB',
          action: 'scale-up'
        }]
      }
    });
  }

  // Cache Service
  if (requirements.performanceRequirements.some(req => req.metric === 'response-time' || req.metric === 'latency')) {
    recommendation.services.push({
      name: 'cache-service',
      type: 'cache',
      purpose: 'In-memory caching for frequently accessed data',
      technologies: ['Cloudflare KV', 'Redis'],
      configuration: {
        runtime: 'cloudflare:workers',
        environment: ['REDIS_URL', 'CACHE_TTL'],
        config: {
          defaultTTL: 3600,
          maxSize: '1GB',
          evictionPolicy: 'lru'
        },
        resources: {
          cpu: '20ms',
          memory: '32MB',
          storage: '1GB',
          bandwidth: 'unlimited'
        }
      },
      scalability: {
        minInstances: 1,
        maxInstances: 10,
        scalingStrategy: 'auto',
        triggers: [{
          type: 'cache-hit-rate',
          threshold: 80,
          action: 'scale-up'
        }]
      }
    });
  }

  // Queue Service
  if (hasPayments || requirements.businessRequirements.some(req => req.goal.toLowerCase().includes('processing'))) {
    recommendation.services.push({
      name: 'queue-service',
      type: 'queue',
      purpose: 'Background job processing and task queuing',
      technologies: ['Cloudflare Queues'],
      configuration: {
        runtime: 'cloudflare:workers',
        environment: ['QUEUE_CONCURRENCY'],
        config: {
          maxConcurrency: 10,
          retryLimit: 3,
          deadLetterQueue: true
        },
        resources: {
          cpu: '100ms',
          memory: '64MB',
          storage: '10GB',
          bandwidth: 'unlimited'
        }
      },
      scalability: {
        minInstances: 1,
        maxInstances: 20,
        scalingStrategy: 'auto',
        triggers: [{
          type: 'queue-length',
          threshold: 1000,
          action: 'scale-up'
        }]
      }
    });
  }
}

/**
 * Apply architecture patterns based on requirements
 */
function applyArchitecturePatterns(
  recommendation: ArchitectureRecommendation,
  requirements: AnalysisResult
): void {
  // Default patterns for typical applications
  recommendation.patterns = [
    'Clean Architecture',
    'Repository Pattern',
    'Service Layer',
    'Domain-Driven Design'
  ];

  // Microservices pattern for complex applications
  if (requirements.estimatedComplexity === 'high' || requirements.estimatedComplexity === 'very-high') {
    recommendation.patterns.push('Microservices');
    recommendation.scalabilityPlan.strategy = 'microservices';
  }

  // Serverless pattern for cloud-native applications
  if (requirements.technologies.some(tech => tech.cloudflareOptimized)) {
    recommendation.patterns.push('Serverless');
    recommendation.scalabilityPlan.strategy = 'serverless';
  }

  // Event-driven pattern for real-time applications
  if (requirements.businessRequirements.some(req =>
      req.goal.toLowerCase().includes('realtime') || req.goal.toLowerCase().includes('chat'))) {
    recommendation.patterns.push('Event-Driven');
  }

  // CQRS pattern for data-intensive applications
  if (requirements.performanceRequirements.some(req =>
      req.metric === 'throughput' && req.target > 1000)) {
    recommendation.patterns.push('CQRS');
  }
}

/**
 * Select technologies based on requirements and preferences
 */
function selectTechnologies(
  recommendation: ArchitectureRecommendation,
  requirements: AnalysisResult,
  preferences?: any
): void {
  // Add recommended technologies from requirement analysis
  requirements.technologies.forEach(techRec => {
    const technology: Technology = {
      name: techRec.name,
      category: techRec.category,
      version: 'latest',
      reason: techRec.reason,
      alternatives: techRec.alternatives,
      cloudflareOptimized: isCloudflareOptimized(techRec.name)
    };
    recommendation.technologies.push(technology);
  });

  // Add Cloudflare-specific optimizations
  if (!preferences || !preferences.technologies ||
      !preferences.technologies.includes('traditional')) {
    recommendation.technologies.push(
      {
        name: 'Cloudflare Workers',
        category: 'backend',
        version: 'latest',
        reason: 'Serverless execution at the edge for global performance',
        cloudflareOptimized: true
      },
      {
        name: 'Cloudflare D1',
        category: 'database',
        version: 'latest',
        reason: 'Serverless SQL database integrated with Workers',
        cloudflareOptimized: true
      },
      {
        name: 'Cloudflare R2',
        category: 'storage',
        version: 'latest',
        reason: 'S3-compatible object storage with no egress fees',
        cloudflareOptimized: true
      },
      {
        name: 'Cloudflare KV',
        category: 'storage',
        version: 'latest',
        reason: 'Key-value store for global data caching',
        cloudflareOptimized: true
      },
      {
        name: 'Cloudflare Queues',
        category: 'backend',
        version: 'latest',
        reason: 'Message queue for background processing',
        cloudflareOptimized: true
      }
    );
  }

  // Apply technology preferences
  if (preferences?.technologies) {
    const filteredTechs = recommendation.technologies.filter(tech =>
      preferences.technologies.includes(tech.name.toLowerCase())
    );
    recommendation.technologies = filteredTechs;
  }

  // Sort technologies by category
  recommendation.technologies.sort((a, b) => {
    const order = ['frontend', 'backend', 'database', 'storage', 'auth', 'monitoring', 'deployment'];
    return order.indexOf(a.category) - order.indexOf(b.category);
  });
}

/**
 * Plan scalability based on requirements
 */
function planScalability(
  recommendation: ArchitectureRecommendation,
  requirements: AnalysisResult
): void {
  // Adjust caching strategy based on performance requirements
  if (requirements.performanceRequirements.some(req => req.metric === 'response-time')) {
    recommendation.scalabilityPlan.caching.push({
      type: 'edge',
      purpose: 'Static asset caching',
      technology: 'Cloudflare Cache',
      ttl: 86400
    });
  }

  if (requirements.performanceRequirements.some(req => req.metric === 'throughput')) {
    recommendation.scalabilityPlan.caching.push({
      type: 'application',
      purpose: 'API response caching',
      technology: 'Memory Cache',
      ttl: 3600
    });
  }

  // Adjust database scaling based on requirements
  const highThroughput = requirements.performanceRequirements.some(req =>
    req.metric === 'throughput' && req.target > 5000
  );

  if (highThroughput) {
    recommendation.scalabilityPlan.database.strategy = 'sharding';
    recommendation.scalabilityPlan.database.connectionPool = 50;
  }

  // Adjust CDN strategy based on application type
  if (requirements.businessRequirements.some(req =>
      req.goal.toLowerCase().includes('ecommerce') || req.goal.toLowerCase().includes('media'))) {
    recommendation.scalabilityPlan.cdn.strategy = 'static';
  }

  // Add database indexing strategies
  if (recommendation.services.some(service => service.type === 'database')) {
    recommendation.scalabilityPlan.database.indexing.push({
      table: 'users',
      columns: ['email', 'created_at'],
      type: 'btree'
    });
  }
}

/**
 * Plan deployment based on requirements
 */
function planDeployment(
  recommendation: ArchitectureRecommendation,
  requirements: AnalysisResult,
  constraints: any[]
): void {
  // Adjust deployment strategy based on complexity
  if (requirements.estimatedComplexity === 'very-high') {
    recommendation.deploymentPlan.strategy = 'blue-green';
  } else if (requirements.estimatedComplexity === 'high') {
    recommendation.deploymentPlan.strategy = 'canary';
  } else {
    recommendation.deploymentPlan.strategy = 'rolling';
  }

  // Configure CI/CD pipeline triggers
  recommendation.deploymentPlan.pipeline.triggers = [
    {
      event: 'push',
      branch: 'main'
    },
    {
      event: 'pull-request',
      branch: 'main'
    }
  ];

  // Add environment configurations
  recommendation.development = {
    name: 'development',
    purpose: 'Development and testing environment',
    features: ['debugging', 'hot-reload', 'feature-flags'],
    scaling: {
      minInstances: 1,
      maxInstances: 2,
      cpu: '100ms',
      memory: '128MB'
    }
  };

  recommendation.deploymentPlan.environment.push({
    name: 'staging',
    purpose: 'Pre-production testing and QA',
    features: ['integration-testing', 'performance-testing', 'security-scanning'],
    scaling: {
      minInstances: 1,
      maxInstances: 3,
      cpu: '200ms',
      memory: '256MB'
    }
  });

  recommendation.deploymentPlan.environment.push({
    name: 'production',
    purpose: 'Live production environment',
    features: ['monitoring', 'logging', 'backup', 'cdn'],
    scaling: {
      minInstances: 2,
      maxInstances: 100,
      cpu: '500ms',
      memory: '1024MB'
    }
  });
}

/**
 * Plan monitoring based on requirements
 */
function planMonitoring(
  recommendation: ArchitectureRecommendation,
  requirements: AnalysisResult
): void {
  // Add business metrics for important business requirements
  requirements.businessRequirements.forEach(req => {
    recommendation.monitoringPlan.business.metrics.push({
      name: `${req.goal}-progress`,
      description: `Progress towards ${req.goal}`,
      calculation: 'count(completed_actions) / total_actions * 100',
      thresholds: [
        {
          operator: 'lt',
          value: 50,
          action: 'alert'
        }
      ]
    });
  });

  // Add specific alerts for critical performance requirements
  requirements.performanceRequirements.forEach(perfReq => {
    if (perfReq.priority === 'critical') {
      recommendation.monitoringPlan.application.alerts.push({
        name: `${perfReq.metric}-critical`,
        condition: `${perfReq.metric} > ${perfReq.target}`,
        severity: 'critical',
        channels: ['slack', 'email'],
        throttling: '1hour'
      });
    }
  });

  // Add security monitoring alerts
  requirements.securityRequirements.forEach(securityReq => {
    if (securityReq.priority === 'critical') {
      recommendation.monitoringPlan.security.alerting = {
        name: 'Critical Security Alert',
        condition: 'security.vulnerability.detected',
        severity: 'critical',
        channels: ['slack', 'email', 'sms'],
        throttling: '15min'
      };
    }
  });

  // Add compliance monitoring
  if (requirements.securityRequirements.some(req => req.domain === 'compliance')) {
    recommendation.monitoringPlan.business.dashboards.push({
      name: 'Compliance Dashboard',
      description: 'Compliance monitoring and reporting',
      panels: [
        {
          title: 'Security Compliance Score',
          type: 'metric',
          query: 'compliance.score',
          visualization: {
            type: 'metric',
            options: { threshold: 90 }
          }
        },
        {
          title: 'Audit Trail',
          type: 'table',
          query: 'audit.events'
        }
      ],
      refresh: 3600
    });
  }
}

/**
 * Estimate costs based on architecture and requirements
 */
function estimateCosts(
  recommendation: ArchitectureRecommendation,
  requirements: AnalysisResult,
  constraints: any[]
): void {
  const baseCosts = {
    'worker-cpu': 0.0000005,  // per ms
    'worker-memory': 0.0000025,  // per GB-ms
    'storage': 0.015,  // per GB-month
    'bandwidth': 0.001,  // per GB
    'database': 5,  // per GB-month
    'requests': 0.0000005  // per request
  };

  let totalMonthlyCost = 0;
  const breakdown: Record<string, number> = {};

  // Calculate worker costs
  recommendation.services
    .filter(service => service.type === 'worker')
    .forEach(service => {
      const cpuCost = (service.configuration.resources?.cpu || '100ms')
        .replace('ms', '') * baseCosts['worker-cpu'] * 1000 * 60 * 60 * 24 * 30;
      const memoryCost = 0.125 * baseCosts['worker-memory'] * 60 * 60 * 24 * 30; // 128MB = 0.125GB

      totalMonthlyCost += cpuCost + memoryCost;
      breakdown['worker-compute'] = (breakdown['worker-compute'] || 0) + cpuCost + memoryCost;
    });

  // Calculate storage costs
  recommendation.services
    .filter(service => service.type === 'storage')
    .forEach(service => {
      const storageSize = service.configuration.config?.maxFileSize || '100GB';
      const storageCost = parseFloat(storageSize.replace('GB', '')) * baseCosts['storage'];

      totalMonthlyCost += storageCost;
      breakdown['storage'] = (breakdown['storage'] || 0) + storageCost;
    });

  // Calculate database costs
  recommendation.services
    .filter(service => service.type === 'database')
    .forEach(service => {
      const dbSize = 10; // Assume 10GB default
      const dbCost = dbSize * baseCosts['database'];

      totalMonthlyCost += dbCost;
      breakdown['database'] = (breakdown['database'] || 0) + dbCost;
    });

  // Check if eligible for free tier
  const freeTierEligible = totalMonthlyCost < 5 &&
                          recommendation.services.length <= 3 &&
                          !requirements.technologies.some(tech => !tech.cloudflareOptimized);

  // Apply budget constraints
  constraints.forEach(constraint => {
    if (constraint.type === 'budget' && typeof constraint.value === 'number') {
      if (constraint.value < totalMonthlyCost) {
        recommendation.estimatedCost.notes.push(
          `Budget constraint may not cover estimated costs. Consider optimizing resource usage.`
        );
      }
    }
  });

  recommendation.estimatedCost.monthly = Math.max(0, totalMonthlyCost);
  recommendation.estimatedCost.breakdown = breakdown;
  recommendation.estimatedCost.freeTierEligible = freeTierEligible;

  if (freeTierEligible) {
    recommendation.estimatedCost.notes.push('Architecture is eligible for Cloudflare free tier');
  }
}

/**
 * Assess risks based on architecture and requirements
 */
function assessRisks(
  recommendation: ArchitectureRecommendation,
  requirements: AnalysisResult,
  constraints: any[]
): void {
  const risks: Risk[] = [];

  // Technical risks
  if (recommendation.services.length > 5) {
    risks.push({
      severity: 'medium',
      description: 'Complex microservices architecture may increase deployment complexity',
      mitigation: 'Implement proper service mesh and comprehensive testing',
      probability: 0.6
    });
  }

  if (requirements.estimatedComplexity === 'very-high') {
    risks.push({
      severity: 'high',
      description: 'Very high complexity may lead to development delays',
      mitigation: 'Incremental development with regular milestone reviews',
      probability: 0.7
    });
  }

  // Performance risks
  if (requirements.performanceRequirements.some(req => req.metric === 'response-time' && req.target < 100)) {
    risks.push({
      severity: 'medium',
      description: 'Sub-100ms response time targets may be challenging to achieve',
      mitigation: 'Implement aggressive caching and edge computing strategies',
      probability: 0.5
    });
  }

  // Security risks
  if (requirements.securityRequirements.some(req => req.priority === 'critical')) {
    risks.push({
      severity: 'high',
      description: 'Critical security requirements require additional attention',
      mitigation: 'Implement security testing and monitoring throughout development',
      probability: 0.8
    });
  }

  // Budget risks
  if (recommendation.estimatedCost.monthly > 100) {
    risks.push({
      severity: 'high',
      description: 'High monthly cost may exceed budget expectations',
      mitigation: 'Implement cost optimization strategies and monitoring',
      probability: 0.6
    });
  }

  // Timeline risks
  if (requirements.estimatedComplexity === 'very-high' && requirements.risks.length > 3) {
    risks.push({
      severity: 'high',
      description: 'Complex project with multiple risks may require additional time',
      mitigation: 'Realistic timeline planning and risk mitigation strategy',
      probability: 0.7
    });
  }

  recommendation.risks = risks;
}

/**
 * Check if technology is optimized for Cloudflare
 */
function isCloudflareOptimized(technologyName: string): boolean {
  const cloudflareTechnologies = [
    'cloudflare workers', 'cloudflare d1', 'cloudflare r2', 'cloudflare kv',
    'cloudflare queues', 'cloudflare pages', 'cloudflare pages functions',
    'hono', 'wrangler', 'miniflare'
  ];

  return cloudflareTechnologies.some(tech =>
    technologyName.toLowerCase().includes(tech)
  );
}