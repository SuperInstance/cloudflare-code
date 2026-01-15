/**
 * Resource Planner for ClaudeFlare Application Factory
 * Plans and optimizes Cloudflare resource allocation based on requirements
 */

import { ArchitectureRecommendation } from './architecture-engine';
import { AnalysisResult } from './requirement-analyzer';

export interface ResourcePlan {
  services: ResourceService[];
  limits: ResourceLimits;
  quotas: ResourceQuota;
  costs: ResourceCosts;
  recommendations: ResourceRecommendation[];
  scaling: ScalingPlan;
}

export interface ResourceService {
  name: string;
  type: 'worker' | 'page' | 'worker-pages' | 'database' | 'storage' | 'queue' | 'cache' | 'auth';
  resources: ServiceResources;
  scaling: ServiceScaling;
  costs: ServiceCosts;
  recommendations: ServiceRecommendation[];
}

export interface ServiceResources {
  cpu: ResourceAllocation;
  memory: ResourceAllocation;
  storage: ResourceAllocation;
  bandwidth: ResourceAllocation;
  concurrency: number;
  requestTimeout: number;
  maxRetries: number;
}

export interface ResourceAllocation {
  min: number;
  max: number;
  default: number;
  unit: string;
  guaranteed: boolean;
  burstable: boolean;
}

export interface ResourceLimits {
  workers: number;
  cpu: number;
  memory: number;
  storage: number;
  bandwidth: number;
  requests: number;
  concurrentExecutions: number;
}

export interface ResourceQuota {
  daily: ResourceQuotaLimits;
  monthly: ResourceQuotaLimits;
  yearly: ResourceQuotaLimits;
}

export interface ResourceQuotaLimits {
  requests: number;
  cpuMs: number;
  storageGB: number;
  bandwidthGB: number;
  executions: number;
}

export interface ResourceCosts {
  compute: CostBreakdown;
  storage: CostBreakdown;
  bandwidth: CostBreakdown;
  database: CostBreakdown;
  total: number;
  currency: string;
}

export interface CostBreakdown {
  fixed: number;
  variable: number;
  freeTier: number;
  estimatedUsage: number;
  overage: number;
}

export interface ResourceRecommendation {
  service: string;
  type: 'scale-up' | 'scale-down' | 'optimize' | 'monitor' | 'upgrade';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedSavings: number;
  implementation: string;
}

export interface ServiceRecommendation {
  type: 'resource' | 'performance' | 'cost' | 'security' | 'reliability';
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ScalingPlan {
  strategy: 'static' | 'dynamic' | 'predictive' | 'auto';
  triggers: ScalingTrigger[];
  policies: ScalingPolicy[];
  targets: ScalingTarget[];
}

export interface ScalingTrigger {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  duration: number;
  action: 'scale-up' | 'scale-down' | 'alert';
}

export interface ScalingPolicy {
  name: string;
  minInstances: number;
  maxInstances: number;
  cooldownPeriod: number;
  scaleInCooldown: number;
  scaleOutCooldown: number;
  targetUtilization: number;
}

export interface ScalingTarget {
  service: string;
  metric: string;
  target: number;
  window: number;
  interval: number;
}

/**
 * Create comprehensive resource plan
 */
export async function createResourcePlan(
  architecture: ArchitectureRecommendation,
  requirements: AnalysisResult,
  trafficProfile?: {
    dailyRequests: number;
    peakMultiplier: number;
    growthRate: number;
  }
): Promise<ResourcePlan> {
  const plan: ResourcePlan = {
    services: [],
    limits: calculateResourceLimits(architecture, requirements),
    quotas: calculateResourceQuotas(requirements),
    costs: calculateResourceCosts(architecture, requirements, trafficProfile),
    recommendations: [],
    scaling: calculateScalingPlan(architecture, requirements)
  };

  // Plan resources for each service
  architecture.services.forEach(service => {
    plan.services.push(planServiceResources(service, requirements, trafficProfile));
  });

  // Generate recommendations
  plan.recommendations = generateResourceRecommendations(plan, architecture, requirements);

  return plan;
}

/**
 * Calculate resource limits based on architecture
 */
function calculateResourceLimits(
  architecture: ArchitectureRecommendation,
  requirements: AnalysisResult
): ResourceLimits {
  const baseLimits: ResourceLimits = {
    workers: 100,
    cpu: 100000, // ms per day
    memory: 1000000, // MB-ms per day
    storage: 10, // GB
    bandwidth: 100, // GB per day
    requests: 1000000,
    concurrentExecutions: 1000
  };

  // Adjust limits based on complexity
  const complexityMultiplier = {
    'low': 0.5,
    'medium': 1,
    'high': 1.5,
    'very-high': 2
  };

  const multiplier = complexityMultiplier[requirements.estimatedComplexity];

  return {
    workers: Math.floor(baseLimits.workers * multiplier),
    cpu: Math.floor(baseLimits.cpu * multiplier),
    memory: Math.floor(baseLimits.memory * multiplier),
    storage: baseLimits.storage * multiplier,
    bandwidth: baseLimits.bandwidth * multiplier,
    requests: Math.floor(baseLimits.requests * multiplier),
    concurrentExecutions: Math.floor(baseLimits.concurrentExecutions * multiplier)
  };
}

/**
 * Calculate resource quotas based on requirements
 */
function calculateResourceQuotas(requirements: AnalysisResult): ResourceQuota {
  const baseDaily = {
    requests: 10000,
    cpuMs: 10000,
    storageGB: 1,
    bandwidthGB: 10,
    executions: 1000
  };

  const complexityMultiplier = {
    'low': 0.5,
    'medium': 1,
    'high': 2,
    'very-high': 5
  };

  const multiplier = complexityMultiplier[requirements.estimatedComplexity];

  return {
    daily: {
      requests: baseDaily.requests * multiplier,
      cpuMs: baseDaily.cpuMs * multiplier,
      storageGB: baseDaily.storageGB * multiplier,
      bandwidthGB: baseDaily.bandwidthGB * multiplier,
      executions: baseDaily.executions * multiplier
    },
    monthly: {
      requests: baseDaily.requests * multiplier * 30,
      cpuMs: baseDaily.cpuMs * multiplier * 30,
      storageGB: baseDaily.storageGB * multiplier,
      bandwidthGB: baseDaily.bandwidthGB * multiplier * 30,
      executions: baseDaily.executions * multiplier * 30
    },
    yearly: {
      requests: baseDaily.requests * multiplier * 365,
      cpuMs: baseDaily.cpuMs * multiplier * 365,
      storageGB: baseDaily.storageGB * multiplier,
      bandwidthGB: baseDaily.bandwidthGB * multiplier * 365,
      executions: baseDaily.executions * multiplier * 365
    }
  };
}

/**
 * Calculate resource costs
 */
function calculateResourceCosts(
  architecture: ArchitectureRecommendation,
  requirements: AnalysisResult,
  trafficProfile?: {
    dailyRequests: number;
    peakMultiplier: number;
    growthRate: number;
  }
): ResourceCosts {
  const profile = trafficProfile || {
    dailyRequests: 1000,
    peakMultiplier: 1.5,
    growthRate: 0.15
  };

  // Calculate compute costs
  const computeCosts = calculateComputeCosts(architecture, profile);
  const storageCosts = calculateStorageCosts(architecture);
  const bandwidthCosts = calculateBandwidthCosts(architecture, profile);
  const databaseCosts = calculateDatabaseCosts(architecture, profile);

  const totalCosts = computeCosts.total + storageCosts.total +
                     bandwidthCosts.total + databaseCosts.total;

  return {
    compute: computeCosts,
    storage: storageCosts,
    bandwidth: bandwidthCosts,
    database: databaseCosts,
    total: totalCosts,
    currency: 'USD'
  };
}

/**
 * Calculate compute costs
 */
function calculateComputeCosts(
  architecture: ArchitectureRecommendation,
  trafficProfile: {
    dailyRequests: number;
    peakMultiplier: number;
    growthRate: number;
  }
): CostBreakdown {
  const workers = architecture.services.filter(s => s.type === 'worker');
  let totalComputeMs = 0;

  workers.forEach(worker => {
    const avgCpuTime = 10; // 10ms average
    const dailyCpuMs = trafficProfile.dailyRequests * avgCpuTime * trafficProfile.peakMultiplier;
    totalComputeMs += dailyCpuMs;
  });

  const freeTier = 100000; // 100k ms free per day
  const overage = Math.max(0, totalComputeMs - freeTier);
  const variableCost = overage * 0.0000005; // $0.5 per 1M ms

  return {
    fixed: 0,
    variable: variableCost,
    freeTier: Math.min(totalComputeMs, freeTier),
    estimatedUsage: totalComputeMs,
    overage
  };
}

/**
 * Calculate storage costs
 */
function calculateStorageCosts(architecture: ArchitectureRecommendation): CostBreakdown {
  const storageServices = architecture.services.filter(s => s.type === 'storage');
  let totalStorageGB = 0;

  storageServices.forEach(service => {
    // Estimate storage usage based on service type
    if (service.name.includes('media') || service.name.includes('file')) {
      totalStorageGB += 5; // 5GB for media storage
    } else {
      totalStorageGB += 1; // 1GB for general storage
    }
  });

  const freeTier = 10; // 10GB free
  const overage = Math.max(0, totalStorageGB - freeTier);
  const variableCost = overage * 0.015; // $0.015 per GB per month

  return {
    fixed: 0,
    variable: variableCost,
    freeTier: Math.min(totalStorageGB, freeTier),
    estimatedUsage: totalStorageGB,
    overage
  };
}

/**
 * Calculate bandwidth costs
 */
function calculateBandwidthCosts(
  architecture: ArchitectureRecommendation,
  trafficProfile: {
    dailyRequests: number;
    peakMultiplier: number;
    growthRate: number;
  }
): CostBreakdown {
  // Estimate bandwidth based on requests and average response size
  const avgResponseSize = 100; // 100KB average response
  const dailyBandwidthGB = (trafficProfile.dailyRequests * avgResponseSize * trafficProfile.peakMultiplier) / (1024 * 1024);
  const monthlyBandwidthGB = dailyBandwidthGB * 30;

  const freeTier = 100; // 100GB free
  const overage = Math.max(0, monthlyBandwidthGB - freeTier);
  const variableCost = overage * 0.01; // $0.01 per GB

  return {
    fixed: 0,
    variable: variableCost,
    freeTier: Math.min(monthlyBandwidthGB, freeTier),
    estimatedUsage: monthlyBandwidthGB,
    overage
  };
}

/**
 * Calculate database costs
 */
function calculateDatabaseCosts(
  architecture: ArchitectureRecommendation,
  trafficProfile: {
    dailyRequests: number;
    peakMultiplier: number;
    growthRate: number;
  }
): CostBreakdown {
  const dbServices = architecture.services.filter(s => s.type === 'database');
  let totalRequests = 0;

  dbServices.forEach(service => {
    const dailyRequests = trafficProfile.dailyRequests * 0.3; // 30% of requests hit DB
    totalRequests += dailyRequests;
  });

  const freeTier = 50000; // 50k free requests per month
  const overage = Math.max(0, totalRequests - freeTier);
  const variableCost = overage * 0.0001; // $0.10 per 1000 requests

  return {
    fixed: 0,
    variable: variableCost,
    freeTier: Math.min(totalRequests, freeTier),
    estimatedUsage: totalRequests,
    overage
  };
}

/**
 * Plan resources for a specific service
 */
function planServiceResources(
  service: any,
  requirements: AnalysisResult,
  trafficProfile?: {
    dailyRequests: number;
    peakMultiplier: number;
    growthRate: number;
  }
): ResourceService {
  const profile = trafficProfile || {
    dailyRequests: 1000,
    peakMultiplier: 1.5,
    growthRate: 0.15
  };

  // Base resource allocation
  const baseResources = {
    cpu: {
      min: 50,
      max: 1000,
      default: 100,
      unit: 'ms',
      guaranteed: true,
      burstable: true
    },
    memory: {
      min: 64,
      max: 1024,
      default: 128,
      unit: 'MB',
      guaranteed: true,
      burstable: true
    },
    storage: {
      min: 0.1,
      max: 10,
      default: 1,
      unit: 'GB',
      guaranteed: true,
      burstable: false
    },
    bandwidth: {
      min: 1,
      max: 100,
      default: 5,
      unit: 'GB',
      guaranteed: true,
      burstable: true
    },
    concurrency: 10,
    requestTimeout: 30000,
    maxRetries: 3
  };

  // Adjust resources based on service type and traffic
  const resources = adjustResourcesForService(service, baseResources, profile, requirements);

  // Calculate service costs
  const costs = calculateServiceCosts(service, resources, profile);

  // Generate service recommendations
  const recommendations = generateServiceRecommendations(service, resources, requirements);

  return {
    name: service.name,
    type: service.type,
    resources,
    scaling: service.scalability || {
      minInstances: 1,
      maxInstances: 100,
      scalingStrategy: 'auto',
      triggers: []
    },
    costs,
    recommendations
  };
}

/**
 * Adjust resources for specific service type
 */
function adjustResourcesForService(
  service: any,
  baseResources: any,
  trafficProfile: any,
  requirements: AnalysisResult
): any {
  const adjusted = { ...baseResources };

  // Adjust based on service type
  switch (service.type) {
    case 'worker':
      // Workers need more CPU for processing
      adjusted.cpu.default = Math.max(adjusted.cpu.default, 200);
      adjusted.concurrency = Math.max(adjusted.concurrency, 20);
      break;

    case 'database':
      // Database needs more memory and CPU for queries
      adjusted.memory.default = Math.max(adjusted.memory.default, 256);
      adjusted.cpu.default = Math.max(adjusted.cpu.default, 300);
      adjusted.concurrency = Math.max(adjusted.concurrency, 50);
      break;

    case 'storage':
      // Storage needs more bandwidth
      adjusted.bandwidth.default = Math.max(adjusted.bandwidth.default, 20);
      break;

    case 'cache':
      // Cache needs fast CPU and memory
      adjusted.cpu.default = Math.max(adjusted.cpu.default, 100);
      adjusted.memory.default = Math.max(adjusted.memory.default, 256);
      adjusted.concurrency = Math.max(adjusted.concurrency, 100);
      break;

    case 'auth':
      // Auth needs reliability and low latency
      adjusted.cpu.default = Math.max(adjusted.cpu.default, 50);
      adjusted.requestTimeout = 10000; // 10s timeout
      adjusted.maxRetries = 1;
      break;
  }

  // Adjust based on traffic profile
  const trafficMultiplier = trafficProfile.dailyRequests / 1000;
  if (trafficMultiplier > 1) {
    adjusted.cpu.default = Math.min(adjusted.cpu.max, adjusted.cpu.default * trafficMultiplier);
    adjusted.memory.default = Math.min(adjusted.memory.max, adjusted.memory.default * trafficMultiplier);
    adjusted.concurrency = Math.min(adjusted.concurrency * 2, 100);
  }

  // Adjust based on performance requirements
  if (requirements.performanceRequirements.some(req => req.metric === 'response-time' && req.target < 100)) {
    adjusted.cpu.default = Math.min(adjusted.cpu.max, adjusted.cpu.default * 0.5); // Less CPU per request, more parallel
    adjusted.concurrency = Math.min(adjusted.concurrency * 2, 100);
  }

  return adjusted;
}

/**
 * Calculate costs for a specific service
 */
function calculateServiceCosts(
  service: any,
  resources: any,
  trafficProfile: any
): ServiceCosts {
  // Simplified cost calculation per service
  const baseCost = 0; // Most services are within free tier

  // Additional costs for high-usage services
  let additionalCost = 0;

  if (service.type === 'database') {
    additionalCost = (trafficProfile.dailyRequests * 30) * 0.0001; // $0.10 per 1000 requests
  }

  if (service.type === 'storage' && resources.storage.default > 10) {
    additionalCost = (resources.storage.default - 10) * 0.015; // $0.015 per GB over 10GB
  }

  return {
    base: baseCost,
    variable: additionalCost,
    total: baseCost + additionalCost
  };
}

/**
 * Generate service recommendations
 */
function generateServiceRecommendations(
  service: any,
  resources: any,
  requirements: AnalysisResult
): ServiceRecommendation[] {
  const recommendations: ServiceRecommendation[] = [];

  // Performance recommendations
  if (resources.cpu.default > 500) {
    recommendations.push({
      type: 'performance',
      description: 'Consider increasing CPU allocation for better performance',
      impact: 'Faster response times and better user experience',
      effort: 'low',
      priority: 'medium'
    });
  }

  // Cost recommendations
  if (resources.memory.default > 512) {
    recommendations.push({
      type: 'cost',
      description: 'High memory usage may increase costs',
      impact: 'Potential cost savings with optimization',
      effort: 'medium',
      priority: 'medium'
    });
  }

  // Security recommendations
  if (service.type === 'auth' && resources.maxRetries > 3) {
    recommendations.push({
      type: 'security',
      description: 'Reduce retry count to prevent brute force attacks',
      impact: 'Improved security against brute force attempts',
      effort: 'low',
      priority: 'high'
    });
  }

  // Reliability recommendations
  if (resources.requestTimeout > 30000) {
    recommendations.push({
      type: 'reliability',
      description: 'Consider shorter timeout for better user experience',
      impact: 'Faster failure detection and recovery',
      effort: 'low',
      priority: 'medium'
    });
  }

  return recommendations;
}

/**
 * Resource Planner class for managing resource allocation
 */
export class ResourcePlanner {
  async createPlan(
    architecture: ArchitectureRecommendation,
    requirements: AnalysisResult,
    trafficProfile?: {
      dailyRequests: number;
      peakMultiplier: number;
      growthRate: number;
    }
  ): Promise<ResourcePlan> {
    return await createResourcePlan(architecture, requirements, trafficProfile);
  }
}

/**
 * Calculate scaling plan
 */
function calculateScalingPlan(
  architecture: ArchitectureRecommendation,
  requirements: AnalysisResult
): ScalingPlan {
  const triggers: ScalingTrigger[] = [];
  const policies: ScalingPolicy[] = [];
  const targets: ScalingTarget[] = [];

  // Add scaling triggers for high-traffic services
  architecture.services.forEach(service => {
    if (service.scalability) {
      // CPU-based scaling
      triggers.push({
        metric: 'cpu-utilization',
        threshold: 70,
        operator: 'gt',
        duration: 300, // 5 minutes
        action: 'scale-up'
      });

      // Memory-based scaling
      triggers.push({
        metric: 'memory-utilization',
        threshold: 80,
        operator: 'gt',
        duration: 300,
        action: 'scale-up'
      });

      // Request rate scaling
      triggers.push({
        metric: 'request-rate',
        threshold: 1000,
        operator: 'gt',
        duration: 300,
        action: 'scale-up'
      });
    }
  });

  // Add scaling policies
  policies.push({
    name: 'default-scaling',
    minInstances: 1,
    maxInstances: 100,
    cooldownPeriod: 300,
    scaleInCooldown: 600,
    scaleOutCooldown: 300,
    targetUtilization: 70
  });

  // Add scaling targets for critical services
  architecture.services
    .filter(service => service.type === 'api-gateway' || service.type === 'auth')
    .forEach(service => {
      targets.push({
        service: service.name,
        metric: 'cpu-utilization',
        target: 50,
        window: 300,
        interval: 60
      });
    });

  return {
    strategy: 'auto',
    triggers,
    policies,
    targets
  };
}

/**
 * Generate resource recommendations
 */
function generateResourceRecommendations(
  plan: ResourcePlan,
  architecture: ArchitectureRecommendation,
  requirements: AnalysisResult
): ResourceRecommendation[] {
  const recommendations: ResourceRecommendation[] = [];

  // Cost optimization recommendations
  if (plan.costs.total > 100) {
    recommendations.push({
      service: 'all',
      type: 'optimize',
      priority: 'high',
      description: 'High monthly costs detected - consider optimization strategies',
      estimatedSavings: plan.costs.total * 0.3,
      implementation: 'Implement caching, optimize queries, and reduce resource allocation'
    });
  }

  // Performance recommendations
  if (requirements.estimatedComplexity === 'very-high') {
    recommendations.push({
      service: 'compute',
      type: 'scale-up',
      priority: 'high',
      description: 'Very high complexity project - allocate additional compute resources',
      estimatedSavings: -50, // Additional cost but prevents performance issues
      implementation: 'Increase CPU and memory allocation for critical services'
    });
  }

  // Storage optimization
  if (plan.costs.storage.variable > 0) {
    recommendations.push({
      service: 'storage',
      type: 'optimize',
      priority: 'medium',
      description: 'Storage costs can be reduced with tiered storage strategy',
      estimatedSavings: plan.costs.storage.variable * 0.5,
      implementation: 'Implement cold storage for infrequently accessed data'
    });
  }

  // Database optimization
  if (plan.costs.database.variable > 0) {
    recommendations.push({
      service: 'database',
      type: 'optimize',
      priority: 'medium',
      description: 'Database costs can be reduced with query optimization',
      estimatedSavings: plan.costs.database.variable * 0.4,
      implementation: 'Add proper indexes and optimize query patterns'
    });
  }

  // Monitoring recommendations
  recommendations.push({
    service: 'monitoring',
    type: 'monitor',
    priority: 'medium',
    description: 'Implement comprehensive monitoring for all services',
    estimatedSavings: 0,
    implementation: 'Set up logging, metrics, and alerting for all resources'
  });

  return recommendations;
}