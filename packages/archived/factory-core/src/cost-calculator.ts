/**
 * Cost Calculator for ClaudeFlare Application Factory
 * Calculates Cloudflare deployment costs based on architecture and usage
 */

import { ArchitectureRecommendation } from './architecture-engine';

export interface CostAnalysis {
  monthly: MonthlyCost;
  yearly: YearlyCost;
  breakdown: ServiceBreakdown;
  scenarios: CostScenario[];
  optimization: OptimizationRecommendation;
  assumptions: string[];
}

export interface MonthlyCost {
  total: number;
  currency: string;
  freeTier: boolean;
  freeTierSavings: number;
  estimatedWithGrowth: number;
}

export interface YearlyCost {
  total: number;
  currency: string;
  savingsWithFreeTier: number;
  discountOptions: DiscountOption[];
}

export interface ServiceBreakdown {
  compute: ServiceCost[];
  storage: ServiceCost[];
  bandwidth: ServiceCost[];
  database: ServiceCost[];
  addons: ServiceCost[];
}

export interface ServiceCost {
  name: string;
  type: string;
  baseCost: number;
  estimatedUsage: number;
  totalCost: number;
  currency: string;
  notes: string[];
}

export interface CostScenario {
  name: string;
  description: string;
  trafficProfile: TrafficProfile;
  monthlyCost: number;
  yearlyCost: number;
  growthRate: number;
  assumptions: string[];
}

export interface TrafficProfile {
  dailyRequests: number;
  averageCpuTime: number; // in milliseconds
  storageSize: number; // in GB
  bandwidth: number; // in GB
  concurrentUsers: number;
  peakMultiplier: number;
}

export interface OptimizationRecommendation {
  potentialSavings: number;
  recommendations: OptimizationItem[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface OptimizationItem {
  category: 'compute' | 'storage' | 'bandwidth' | 'database' | 'architecture';
  description: string;
  estimatedSavings: number;
  implementation: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface DiscountOption {
  name: string;
  description: string;
  discount: number;
  conditions: string[];
  applicable: boolean;
}

/**
 * Calculate deployment costs based on architecture
 */
export async function calculateCosts(
  architecture: ArchitectureRecommendation,
  region: string = 'global',
  traffic?: {
    dailyRequests: number;
    averageCpuTime: number;
    storage: number;
    bandwidth: number;
  }
): Promise<CostAnalysis> {
  // Initialize traffic profile with defaults
  const trafficProfile = initializeTrafficProfile(traffic);

  // Calculate base costs
  const serviceBreakdown = calculateServiceCosts(architecture, trafficProfile);

  // Calculate totals
  const monthly = calculateMonthlyTotal(serviceBreakdown, region);
  const yearly = calculateYearlyTotal(monthly);

  // Analyze scenarios
  const scenarios = generateScenarios(architecture, trafficProfile, region);

  // Provide optimization recommendations
  const optimization = analyzeOptimizationOpportunities(architecture, serviceBreakdown);

  // Calculate with growth
  const estimatedWithGrowth = calculateGrowthEstimate(monthly.total, trafficProfile);

  return {
    monthly: {
      ...monthly,
      estimatedWithGrowth,
      freeTierSavings: monthly.freeTier ? monthly.total : 0
    },
    yearly,
    breakdown: serviceBreakdown,
    scenarios,
    optimization,
    assumptions: generateAssumptions(trafficProfile, architecture)
  };
}

/**
 * Initialize traffic profile with defaults
 */
function initializeTrafficProfile(traffic?: {
  dailyRequests: number;
  averageCpuTime: number;
  storage: number;
  bandwidth: number;
}): TrafficProfile {
  return {
    dailyRequests: traffic?.dailyRequests || 1000,
    averageCpuTime: traffic?.averageCpuTime || 10, // 10ms
    storageSize: traffic?.storage || 1, // 1GB
    bandwidth: traffic?.bandwidth || 5, // 5GB
    concurrentUsers: traffic?.dailyRequests / 10 || 100,
    peakMultiplier: traffic?.dailyRequests > 10000 ? 2.5 : 1.5
  };
}

/**
 * Calculate costs for individual services
 */
function calculateServiceCosts(
  architecture: ArchitectureRecommendation,
  trafficProfile: TrafficProfile
): ServiceBreakdown {
  const breakdown: ServiceBreakdown = {
    compute: [],
    storage: [],
    bandwidth: [],
    database: [],
    addons: []
  };

  // Calculate worker compute costs
  architecture.services
    .filter(service => service.type === 'worker')
    .forEach(service => {
      const cost = calculateWorkerCost(service, trafficProfile);
      breakdown.compute.push(cost);
    });

  // Calculate storage costs
  architecture.services
    .filter(service => service.type === 'storage')
    .forEach(service => {
      const cost = calculateStorageCost(service, trafficProfile);
      breakdown.storage.push(cost);
    });

  // Calculate database costs
  architecture.services
    .filter(service => service.type === 'database')
    .forEach(service => {
      const cost = calculateDatabaseCost(service, trafficProfile);
      breakdown.database.push(cost);
    });

  // Calculate bandwidth costs
  const bandwidthCost = calculateBandwidthCost(trafficProfile);
  breakdown.bandwidth.push(bandwidthCost);

  // Calculate addon costs
  const addonCosts = calculateAddonCosts(architecture);
  breakdown.addons = addonCosts;

  return breakdown;
}

/**
 * Calculate worker compute cost
 */
function calculateWorkerCost(
  service: any,
  trafficProfile: TrafficProfile
): ServiceCost {
  // Cloudflare Workers pricing (as of 2024)
  const pricing = {
    freeTier: {
      requests: 100000, // 100k free requests per day
      cpu: 100000, // 100k ms free CPU per day
      memory: 100000 // 100k MB-ms free memory per day
    },
    paid: {
      cpuPerMs: 0.0000005, // $0.5 per 1M ms CPU
      memoryPerGBMs: 0.0000025, // $2.50 per GB-ms
      requestOverage: 0.0000005 // $0.5 per 1M requests over free tier
    }
  };

  const dailyRequests = trafficProfile.dailyRequests;
  const avgCpuTime = trafficProfile.averageCpuTime; // in milliseconds
  const memoryUsage = 128; // MB - typical worker memory

  // Calculate usage
  const cpuMs = dailyRequests * avgCpuTime;
  const memoryGBms = dailyRequests * memoryUsage * avgCpuTime / 1000000000; // Convert to GB-ms
  const requestsOverFreeTier = Math.max(0, dailyRequests - pricing.freeTier.requests);

  // Calculate costs
  const cpuCost = Math.max(0, cpuMs - pricing.freeTier.cpu) * pricing.paid.cpuPerMs;
  const memoryCost = Math.max(0, memoryGBms - pricing.freeTier.memory) * pricing.paid.memoryPerGBMs;
  const requestCost = requestsOverFreeTier * pricing.paid.requestOverage;
  const totalCost = cpuCost + memoryCost + requestCost;

  const notes = [];
  if (totalCost > 0) {
    notes.push(`Free tier used: ${Math.min(dailyRequests, pricing.freeTier.requests).toLocaleString()} requests`);
    if (requestsOverFreeTier > 0) {
      notes.push(`Overage: ${requestsOverFreeTier.toLocaleString()} requests`);
    }
  }

  return {
    name: service.name,
    type: 'worker',
    baseCost: 0,
    estimatedUsage: cpuMs + memoryGBms,
    totalCost,
    currency: 'USD',
    notes
  };
}

/**
 * Calculate storage cost
 */
function calculateStorageCost(
  service: any,
  trafficProfile: TrafficProfile
): ServiceCost {
  // Cloudflare R2 pricing (as of 2024)
  const pricing = {
    freeTier: 10, // 10GB free storage
    storagePerGB: 0.015, // $0.015 per GB per month
    egressPerGB: 0.01, // $0.01 per GB egress (after first 100GB)
    requestFree: 1000000, // 1M free requests per month
    requestPer1000: 0.40 // $0.40 per 1000 requests over free tier
  };

  const storageSize = trafficProfile.storageSize;
  const requests = trafficProfile.dailyRequests * 30; // Monthly requests
  const bandwidth = trafficProfile.bandwidth * 30; // Monthly bandwidth

  // Calculate costs
  const storageCost = Math.max(0, storageSize - pricing.freeTier) * pricing.storagePerGB;
  const requestCost = Math.max(0, requests - pricing.requestFree) * pricing.requestPer1000 / 1000;
  const egressCost = Math.max(0, bandwidth - 100) * pricing.egressPerGB;
  const totalCost = storageCost + requestCost + egressCost;

  const notes = [];
  if (storageCost > 0) {
    notes.push(`Storage: ${storageSize}GB (${pricing.freeTier}GB free)`);
  }
  if (requestCost > 0) {
    notes.push(`Requests: ${requests.toLocaleString()} (${pricing.requestFree.toLocaleString()} free)`);
  }
  if (egressCost > 0) {
    notes.push(`Egress: ${bandwidth}GB (100GB free)`);
  }

  return {
    name: service.name,
    type: 'storage',
    baseCost: 0,
    estimatedUsage: storageSize,
    totalCost,
    currency: 'USD',
    notes
  };
}

/**
 * Calculate database cost
 */
function calculateDatabaseCost(
  service: any,
  trafficProfile: TrafficProfile
): ServiceCost {
  // Cloudflare D1 pricing (as of 2024)
  const pricing = {
    freeTier: 1, // 1GB free storage
    storagePerGB: 15, // $15 per GB per month
    requestFree: 50000, // 50k free requests per month
    requestPer1000: 0.10 // $0.10 per 1000 requests over free tier
  };

  const storageSize = trafficProfile.storageSize;
  const requests = trafficProfile.dailyRequests * 30; // Monthly requests

  // Calculate costs
  const storageCost = Math.max(0, storageSize - pricing.freeTier) * pricing.storagePerGB;
  const requestCost = Math.max(0, requests - pricing.requestFree) * pricing.requestPer1000 / 1000;
  const totalCost = storageCost + requestCost;

  const notes = [];
  if (storageCost > 0) {
    notes.push(`Storage: ${storageSize}GB (${pricing.freeTier}GB free)`);
  }
  if (requestCost > 0) {
    notes.push(`Requests: ${requests.toLocaleString()} (${pricing.requestFree.toLocaleString()} free)`);
  }

  return {
    name: service.name,
    type: 'database',
    baseCost: 0,
    estimatedUsage: storageSize,
    totalCost,
    currency: 'USD',
    notes
  };
}

/**
 * Calculate bandwidth cost
 */
function calculateBandwidthCost(trafficProfile: TrafficProfile): ServiceCost {
  // Cloudflare Pages pricing (as of 2024)
  const pricing = {
    freeTier: 100, // 100GB free bandwidth per month
    bandwidthPerGB: 0.01 // $0.01 per GB after free tier
  };

  const monthlyBandwidth = trafficProfile.bandwidth * 30; // Monthly bandwidth

  // Calculate costs
  const bandwidthCost = Math.max(0, monthlyBandwidth - pricing.freeTier) * pricing.bandwidthPerGB;
  const totalCost = bandwidthCost;

  const notes = [];
  if (totalCost > 0) {
    notes.push(`Bandwidth: ${monthlyBandwidth}GB (${pricing.freeTier}GB free)`);
  }

  return {
    name: 'Bandwidth',
    type: 'bandwidth',
    baseCost: 0,
    estimatedUsage: monthlyBandwidth,
    totalCost,
    currency: 'USD',
    notes
  };
}

/**
 * Calculate addon costs
 */
function calculateAddonCosts(architecture: ArchitectureRecommendation): ServiceCost[] {
  const addons: ServiceCost[] = [];

  // Add monitoring costs
  if (architecture.monitoringPlan.infrastructure.provider !== 'Cloudflare') {
    addons.push({
      name: 'Monitoring',
      type: 'addon',
      baseCost: 0,
      estimatedUsage: 1,
      totalCost: 50, // $50/month for external monitoring
      currency: 'USD',
      notes: ['External APM and monitoring service']
    });
  }

  // Add security scanning costs
  if (architecture.monitoringPlan.security.scanning.vulnerability.enabled) {
    addons.push({
      name: 'Security Scanning',
      type: 'addon',
      baseCost: 0,
      estimatedUsage: 1,
      totalCost: 100, // $100/month for security scanning
      currency: 'USD',
      notes: ['Vulnerability scanning and security monitoring']
    });
  }

  // Add CDN costs if not using Cloudflare
  if (architecture.scalabilityPlan.cdn.provider !== 'Cloudflare') {
    addons.push({
      name: 'CDN',
      type: 'addon',
      baseCost: 0,
      estimatedUsage: 1,
      totalCost: 20, // $20/month for third-party CDN
      currency: 'USD',
      notes: ['Third-party CDN service']
    });
  }

  return addons;
}

/**
 * Calculate monthly total
 */
function calculateMonthlyTotal(
  breakdown: ServiceBreakdown,
  region: string
): MonthlyCost {
  const computeTotal = breakdown.compute.reduce((sum, service) => sum + service.totalCost, 0);
  const storageTotal = breakdown.storage.reduce((sum, service) => sum + service.totalCost, 0);
  const bandwidthTotal = breakdown.bandwidth.reduce((sum, service) => sum + service.totalCost, 0);
  const databaseTotal = breakdown.database.reduce((sum, service) => sum + service.totalCost, 0);
  const addonsTotal = breakdown.addons.reduce((sum, service) => sum + service.totalCost, 0);

  const total = computeTotal + storageTotal + bandwidthTotal + databaseTotal + addonsTotal;

  // Check if free tier eligible
  const freeTier = computeTotal === 0 && storageTotal <= 0 && bandwidthTotal <= 0 && databaseTotal <= 0;

  return {
    total,
    currency: 'USD',
    freeTier,
    freeTierSavings: 0,
    estimatedWithGrowth: total
  };
}

/**
 * Calculate yearly total
 */
function calculateYearlyTotal(monthly: MonthlyCost): YearlyCost {
  const total = monthly.total * 12;
  const savings = monthly.freeTierSavings * 12;

  return {
    total,
    currency: 'USD',
    savingsWithFreeTier: savings,
    discountOptions: [
      {
        name: 'Annual Billing Discount',
        description: 'Pay annually and save up to 20%',
        discount: 0.20,
        conditions: ['Annual commitment required', 'No refunds for partial years'],
        applicable: true
      },
      {
        name: 'Enterprise Discount',
        description: 'Volume discounts for high usage',
        discount: 0.15,
        conditions: ['Minimum $1000/month spend', 'Custom contract required'],
        applicable: monthly.total >= 1000
      }
    ]
  };
}

/**
 * Generate cost scenarios
 */
function generateScenarios(
  architecture: ArchitectureRecommendation,
  trafficProfile: TrafficProfile,
  region: string
): CostScenario[] {
  const scenarios: CostScenario[] = [];

  // Base scenario
  const baseCost = calculateMonthlyTotal(calculateServiceCosts(architecture, trafficProfile), region);
  scenarios.push({
    name: 'Current Usage',
    description: 'Based on current traffic estimates',
    trafficProfile,
    monthlyCost: baseCost.total,
    yearlyCost: baseCost.total * 12,
    growthRate: 0,
    assumptions: ['Current traffic patterns continue', 'No seasonal variations']
  });

  // Low growth scenario
  const lowTrafficProfile = {
    ...trafficProfile,
    dailyRequests: trafficProfile.dailyRequests * 1.2, // 20% growth
    storageSize: trafficProfile.storageSize * 1.1,
    bandwidth: trafficProfile.bandwidth * 1.15
  };
  const lowCost = calculateMonthlyTotal(calculateServiceCosts(architecture, lowTrafficProfile), region);
  scenarios.push({
    name: 'Low Growth (20%)',
    description: 'Conservative growth scenario',
    trafficProfile: lowTrafficProfile,
    monthlyCost: lowCost.total,
    yearlyCost: lowCost.total * 12,
    growthRate: 0.20,
    assumptions: ['Moderate user growth', 'Storing similar data volume']
  });

  // High growth scenario
  const highTrafficProfile = {
    ...trafficProfile,
    dailyRequests: trafficProfile.dailyRequests * 3, // 200% growth
    storageSize: trafficProfile.storageSize * 2.5,
    bandwidth: trafficProfile.bandwidth * 3
  };
  const highCost = calculateMonthlyTotal(calculateServiceCosts(architecture, highTrafficProfile), region);
  scenarios.push({
    name: 'High Growth (200%)',
    description: 'Aggressive growth scenario',
    trafficProfile: highTrafficProfile,
    monthlyCost: highCost.total,
    yearlyCost: highCost.total * 12,
    growthRate: 2.00,
    assumptions: ['Viral adoption', 'Increased user engagement', 'More data storage']
  });

  // Seasonal peak scenario
  const peakTrafficProfile = {
    ...trafficProfile,
    dailyRequests: trafficProfile.dailyRequests * trafficProfile.peakMultiplier,
    averageCpuTime: trafficProfile.averageCpuTime * 1.2 // Higher CPU during peaks
  };
  const peakCost = calculateMonthlyTotal(calculateServiceCosts(architecture, peakTrafficProfile), region);
  scenarios.push({
    name: 'Seasonal Peak',
    description: 'Traffic during peak periods',
    trafficProfile: peakTrafficProfile,
    monthlyCost: peakCost.total,
    yearlyCost: peakCost.total,
    growthRate: trafficProfile.peakMultiplier - 1,
    assumptions: ['Seasonal traffic spikes', 'Peak periods last 1-2 months per year']
  });

  return scenarios;
}

/**
 * Analyze optimization opportunities
 */
function analyzeOptimizationOpportunities(
  architecture: ArchitectureRecommendation,
  breakdown: ServiceBreakdown
): OptimizationRecommendation {
  const recommendations: OptimizationItem[] = [];
  let totalSavings = 0;

  // Compute optimization
  const computeCost = breakdown.compute.reduce((sum, service) => sum + service.totalCost, 0);
  if (computeCost > 0) {
    // Worker optimization
    recommendations.push({
      category: 'compute',
      description: 'Implement edge caching to reduce compute costs',
      estimatedSavings: computeCost * 0.4, // 40% reduction potential
      implementation: 'Cache static assets and API responses at the edge',
      complexity: 'low'
    });

    // Use SharedArrayBuffer for shared memory
    recommendations.push({
      category: 'compute',
      description: 'Use shared memory for cross-worker data sharing',
      estimatedSavings: computeCost * 0.15, // 15% reduction
      implementation: 'Implement SharedArrayBuffer for data exchange',
      complexity: 'medium'
    });

    totalSavings += computeCost * 0.55;
  }

  // Storage optimization
  const storageCost = breakdown.storage.reduce((sum, service) => sum + service.totalCost, 0);
  if (storageCost > 0) {
    // Tiered storage
    recommendations.push({
      category: 'storage',
      description: 'Implement tiered storage strategy',
      estimatedSavings: storageCost * 0.3, // 30% reduction
      implementation: 'Store cold data in lower-cost storage tiers',
      complexity: 'medium'
    });

    // Compression
    recommendations.push({
      category: 'storage',
      description: 'Enable data compression',
      estimatedSavings: storageCost * 0.2, // 20% reduction
      implementation: 'Compress uploaded files before storage',
      complexity: 'low'
    });

    totalSavings += storageCost * 0.5;
  }

  // Bandwidth optimization
  const bandwidthCost = breakdown.bandwidth.reduce((sum, service) => sum + service.totalCost, 0);
  if (bandwidthCost > 0) {
    // CDN optimization
    recommendations.push({
      category: 'bandwidth',
      description: 'Optimize CDN cache configuration',
      estimatedSavings: bandwidthCost * 0.6, // 60% reduction potential
      implementation: 'Increase cache TTL and optimize cache keys',
      complexity: 'low'
    });

    // Image optimization
    recommendations.push({
      category: 'bandwidth',
      description: 'Implement image optimization',
      estimatedSavings: bandwidthCost * 0.25, // 25% reduction
      implementation: 'Serve responsive images and WebP format',
      complexity: 'medium'
    });

    totalSavings += bandwidthCost * 0.85;
  }

  // Database optimization
  const databaseCost = breakdown.database.reduce((sum, service) => sum + service.totalCost, 0);
  if (databaseCost > 0) {
    // Read replicas
    recommendations.push({
      category: 'database',
      description: 'Implement read replicas for query scaling',
      estimatedSavings: databaseCost * 0.2, // 20% reduction
      implementation: 'Distribute read queries across multiple replicas',
      complexity: 'high'
    });

    // Query optimization
    recommendations.push({
      category: 'database',
      description: 'Optimize database queries',
      estimatedSavings: databaseCost * 0.15, // 15% reduction
      implementation: 'Add indexes and optimize query patterns',
      complexity: 'medium'
    });

    totalSavings += databaseCost * 0.35;
  }

  // Architecture optimization
  if (architecture.services.length > 5) {
    recommendations.push({
      category: 'architecture',
      description: 'Consolidate microservices where possible',
      estimatedSavings: (breakdown.compute.reduce((sum, s) => sum + s.totalCost, 0) +
                        breakdown.database.reduce((sum, s) => sum + s.totalCost, 0)) * 0.2,
      implementation: 'Merge related services to reduce infrastructure overhead',
      complexity: 'high'
    });
  }

  // Determine priority based on potential savings
  const priority = totalSavings > 100 ? 'critical' :
                   totalSavings > 50 ? 'high' :
                   totalSavings > 20 ? 'medium' : 'low';

  return {
    potentialSavings: totalSavings,
    recommendations,
    priority
  };
}

/**
 * Calculate growth estimate
 */
function calculateGrowthEstimate(currentCost: number, trafficProfile: TrafficProfile): number {
  // Assume conservative growth rate of 15% per month
  const monthlyGrowthRate = 0.15;
  const monthsToEstimate = 12; // Estimate 12 months out

  let estimatedCost = currentCost;
  for (let i = 0; i < monthsToEstimate; i++) {
    estimatedCost *= (1 + monthlyGrowthRate);
  }

  return estimatedCost;
}

/**
 * Generate assumptions for cost analysis
 */
function generateAssumptions(trafficProfile: TrafficProfile, architecture: ArchitectureRecommendation): string[] {
  const assumptions: string[] = [];

  // Traffic assumptions
  assumptions.push(`Average CPU time: ${trafficProfile.averageCpuTime}ms per request`);
  assumptions.push(`Average daily requests: ${trafficProfile.dailyRequests.toLocaleString()}`);
  assumptions.push(`Peak traffic multiplier: ${trafficProfile.peakMultiplier}x`);

  // Storage assumptions
  assumptions.push(`Storage size: ${trafficProfile.storageSize}GB`);
  assumptions.push(`Bandwidth: ${trafficProfile.bandwidth}GB per month`);

  // Architecture assumptions
  assumptions.push(`Number of services: ${architecture.services.length}`);
  assumptions.push(`Architecture pattern: ${architecture.scalabilityPlan.strategy}`);

  // Pricing assumptions
  assumptions.push('Prices based on current Cloudflare Workers and R2 pricing');
  assumptions.push('Free tier limits are applied where applicable');
  assumptions.push('No volume discounts applied');

  return assumptions;
}