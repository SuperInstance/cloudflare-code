/**
 * Cost calculation utilities for IaC
 */

import { IaCConfig, CostEstimate, CostBreakdown } from '../types';

/**
 * Calculate cost estimate for IaC configuration
 */
export async function computeCostEstimate(
  config: IaCConfig
): Promise<CostEstimate> {
  const breakdown: CostBreakdown[] = [];

  switch (config.type) {
    case 'terraform':
      breakdown.push(...calculateTerraformCosts(config));
      break;
    case 'kubernetes':
      breakdown.push(...calculateKubernetesCosts(config));
      break;
    case 'cloudflare':
      breakdown.push(...calculateCloudflareCosts(config));
      break;
    case 'helm':
      breakdown.push(...calculateHelmCosts(config));
      break;
  }

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

  return {
    currency: 'USD',
    total,
    breakdown,
    period: 'monthly',
  };
}

/**
 * Calculate Terraform infrastructure costs
 */
function calculateTerraformCosts(config: IaCConfig): CostBreakdown[] {
  const breakdown: CostBreakdown[] = [];

  // Provider-specific costs
  if (config.providers) {
    for (const provider of config.providers) {
      switch (provider.name) {
        case 'aws':
          breakdown.push(...calculateAWSCosts(provider.configuration));
          break;
        case 'google':
          breakdown.push(...calculateGCPCosts(provider.configuration));
          break;
        case 'azurerm':
          breakdown.push(...calculateAzureCosts(provider.configuration));
          break;
      }
    }
  }

  return breakdown;
}

/**
 * Calculate AWS costs
 */
function calculateAWSCosts(config: any): CostBreakdown[] {
  const breakdown: CostBreakdown[] = [];

  // EC2 instances
  const instances = config.instance_count || 1;
  breakdown.push({
    resource: 'EC2 Instances',
    amount: instances * 30.0, // $30/month per instance
    unit: 'USD',
    quantity: instances,
  });

  // S3 storage
  const storage = config.s3_storage_gb || 100;
  breakdown.push({
    resource: 'S3 Storage',
    amount: storage * 0.023, // $0.023 per GB
    unit: 'USD',
    quantity: storage,
  });

  // Lambda requests
  const lambdaRequests = config.lambda_requests || 1000000;
  breakdown.push({
    resource: 'Lambda Requests',
    amount: (lambdaRequests / 1000000) * 0.2,
    unit: 'USD',
    quantity: lambdaRequests,
  });

  return breakdown;
}

/**
 * Calculate GCP costs
 */
function calculateGCPCosts(config: any): CostBreakdown[] {
  const breakdown: CostBreakdown[] = [];

  // Compute Engine
  const instances = config.instance_count || 1;
  breakdown.push({
    resource: 'Compute Engine Instances',
    amount: instances * 25.0,
    unit: 'USD',
    quantity: instances,
  });

  // Cloud Storage
  const storage = config.storage_gb || 100;
  breakdown.push({
    resource: 'Cloud Storage',
    amount: storage * 0.02,
    unit: 'USD',
    quantity: storage,
  });

  return breakdown;
}

/**
 * Calculate Azure costs
 */
function calculateAzureCosts(config: any): CostBreakdown[] {
  const breakdown: CostBreakdown[] = [];

  // Virtual Machines
  const instances = config.instance_count || 1;
  breakdown.push({
    resource: 'Virtual Machines',
    amount: instances * 28.0,
    unit: 'USD',
    quantity: instances,
  });

  // Blob Storage
  const storage = config.storage_gb || 100;
  breakdown.push({
    resource: 'Blob Storage',
    amount: storage * 0.018,
    unit: 'USD',
    quantity: storage,
  });

  return breakdown;
}

/**
 * Calculate Kubernetes costs
 */
function calculateKubernetesCosts(config: IaCConfig): CostBreakdown[] {
  const breakdown: CostBreakdown[] = [];

  const replicas = config.variables?.replicas || 3;
  const cpu = config.variables?.cpu || '1';
  const memory = config.variables?.memory || '2Gi';

  // Node costs (assuming GKE/AKS/EKS pricing)
  const nodeCount = Math.ceil(replicas / 10); // ~10 pods per node
  breakdown.push({
    resource: 'Kubernetes Nodes',
    amount: nodeCount * 60.0,
    unit: 'USD',
    quantity: nodeCount,
  });

  // Load balancer
  breakdown.push({
    resource: 'Load Balancer',
    amount: 12.0,
    unit: 'USD',
    quantity: 1,
  });

  return breakdown;
}

/**
 * Calculate Cloudflare costs
 */
function calculateCloudflareCosts(config: IaCConfig): CostBreakdown[] {
  const breakdown: CostBreakdown[] = [];

  // Workers requests
  const workersRequests = config.variables?.workers_requests || 10000000;
  breakdown.push({
    resource: 'Workers Requests',
    amount: (workersRequests / 1000000) * 0.5,
    unit: 'USD',
    quantity: workersRequests,
  });

  // Workers CPU time
  const workersCpu = config.variables?.workers_cpu_ms || 1000000;
  breakdown.push({
    resource: 'Workers CPU Time',
    amount: (workersCpu / 1000000) * 12.0,
    unit: 'USD',
    quantity: workersCpu,
  });

  // KV storage
  const kvStorage = config.variables?.kv_storage_gb || 1;
  breakdown.push({
    resource: 'KV Storage',
    amount: kvStorage * 0.50,
    unit: 'USD',
    quantity: kvStorage,
  });

  // R2 storage
  const r2Storage = config.variables?.r2_storage_gb || 100;
  breakdown.push({
    resource: 'R2 Storage',
    amount: r2Storage * 0.015,
    unit: 'USD',
    quantity: r2Storage,
  });

  // Durable Objects
  const durableObjects = config.variables?.durable_objects || 0;
  if (durableObjects > 0) {
    breakdown.push({
      resource: 'Durable Objects',
      amount: durableObjects * 0.181,
      unit: 'USD',
      quantity: durableObjects,
    });
  }

  return breakdown;
}

/**
 * Calculate Helm costs
 */
function calculateHelmCosts(config: IaCConfig): CostBreakdown[] {
  // Helm charts just manage Kubernetes resources, so use Kubernetes cost calculation
  return calculateKubernetesCosts(config);
}
