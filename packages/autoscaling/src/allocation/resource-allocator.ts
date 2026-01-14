/**
 * Resource allocation and capacity planning
 */

import type {
  ResourceAllocation,
  ResourceSpec,
  ResourceUsage,
  ResourceType,
  AllocationStrategy,
  AllocationStrategyType,
  AllocationConstraint,
  AllocationStatus
} from '../types/index.js';
import { Logger } from '@claudeflare/logger';

export interface AllocationRequest {
  resourceId: string;
  resourceType: ResourceType;
  strategy: AllocationStrategy;
  constraints: AllocationConstraint[];
  priority: number;
  requestedSpec: Partial<ResourceSpec>;
}

export interface AllocationResult {
  success: boolean;
  allocation: ResourceAllocation | null;
  reason?: string;
  alternatives?: ResourceAllocation[];
}

export class ResourceAllocator {
  private logger: Logger;
  private allocations: Map<string, ResourceAllocation> = new Map();
  private availableCapacity: Map<ResourceType, ResourceSpec> = new Map();
  private pendingRequests: AllocationRequest[] = [];

  constructor() {
    this.logger = new Logger('ResourceAllocator');
    this.initializeCapacity();
  }

  /**
   * Initialize available capacity
   */
  private initializeCapacity(): void {
    // Initialize default capacity for each resource type
    this.availableCapacity.set('worker', {
      cpu: { cores: 1000, frequency: 3000, credits: 100000, burstCapacity: 2000 },
      memory: { size: 1000000, type: 'dram' as const },
      storage: { size: 10000000, type: 'ssd' as const, iops: 100000, throughput: 1000 },
      network: { bandwidth: 10000, connections: 100000, requestsPerSecond: 100000 }
    });

    this.availableCapacity.set('durable_object', {
      cpu: { cores: 500, frequency: 3000, credits: 50000, burstCapacity: 1000 },
      memory: { size: 500000, type: 'dram' as const },
      storage: { size: 5000000, type: 'ssd' as const, iops: 50000, throughput: 500 },
      network: { bandwidth: 5000, connections: 50000, requestsPerSecond: 50000 }
    });

    this.availableCapacity.set('kv', {
      cpu: { cores: 100, frequency: 2000, credits: 10000, burstCapacity: 200 },
      memory: { size: 100000, type: 'dram' as const },
      storage: { size: 1000000, type: 'ssd' as const, iops: 10000, throughput: 100 },
      network: { bandwidth: 1000, connections: 10000, requestsPerSecond: 10000 }
    });

    this.availableCapacity.set('r2', {
      cpu: { cores: 50, frequency: 2000, credits: 5000, burstCapacity: 100 },
      memory: { size: 50000, type: 'dram' as const },
      storage: { size: 100000000, type: 'ssd' as const, iops: 5000, throughput: 50 },
      network: { bandwidth: 500, connections: 5000, requestsPerSecond: 5000 }
    });
  }

  /**
   * Request resource allocation
   */
  async allocate(request: AllocationRequest): Promise<AllocationResult> {
    this.logger.info(`Processing allocation request for ${request.resourceId}`);

    // Check if allocation already exists
    if (this.allocations.has(request.resourceId)) {
      const existing = this.allocations.get(request.resourceId)!;
      return {
        success: false,
        allocation: existing,
        reason: 'Resource already allocated'
      };
    }

    // Calculate required resources
    const requiredSpec = this.calculateRequiredSpec(request);

    // Check if capacity is available
    const available = this.availableCapacity.get(request.resourceType);
    if (!available) {
      return {
        success: false,
        allocation: null,
        reason: `Unknown resource type: ${request.resourceType}`
      };
    }

    // Apply allocation strategy
    const strategyResult = this.applyStrategy(request, requiredSpec, available);

    if (!strategyResult.canAllocate) {
      // Add to pending queue
      this.pendingRequests.push(request);
      this.logger.warn(`Insufficient capacity for ${request.resourceId}, added to queue`);

      return {
        success: false,
        allocation: null,
        reason: strategyResult.reason,
        alternatives: strategyResult.alternatives
      };
    }

    // Create allocation
    const allocation = this.createAllocation(request, strategyResult.allocatedSpec);

    // Update available capacity
    this.updateAvailableCapacity(request.resourceType, strategyResult.allocatedSpec, true);

    // Store allocation
    this.allocations.set(request.resourceId, allocation);

    this.logger.info(`Successfully allocated resources for ${request.resourceId}`);

    return {
      success: true,
      allocation
    };
  }

  /**
   * Deallocate resources
   */
  async deallocate(resourceId: string): Promise<boolean> {
    const allocation = this.allocations.get(resourceId);
    if (!allocation) {
      this.logger.warn(`No allocation found for ${resourceId}`);
      return false;
    }

    // Update available capacity
    this.updateAvailableCapacity(allocation.resourceType, allocation.allocation, false);

    // Remove allocation
    this.allocations.delete(resourceId);

    this.logger.info(`Deallocated resources for ${resourceId}`);

    // Process pending requests
    await this.processPendingRequests();

    return true;
  }

  /**
   * Update existing allocation
   */
  async updateAllocation(
    resourceId: string,
    newSpec: Partial<ResourceSpec>
  ): Promise<AllocationResult> {
    const allocation = this.allocations.get(resourceId);
    if (!allocation) {
      return {
        success: false,
        allocation: null,
        reason: 'Allocation not found'
      };
    }

    // Calculate delta
    const delta = this.calculateResourceDelta(allocation.allocation, newSpec);

    // Check if enough capacity is available
    const available = this.availableCapacity.get(allocation.resourceType);
    if (!this.hasSufficientCapacity(available, delta)) {
      return {
        success: false,
        allocation: null,
        reason: 'Insufficient capacity for update'
      };
    }

    // Update allocation
    const oldSpec = allocation.allocation;
    allocation.allocation = { ...allocation.allocation, ...newSpec };
    allocation.updatedAt = new Date();

    // Update available capacity
    this.updateAvailableCapacity(allocation.resourceType, delta, true);

    this.logger.info(`Updated allocation for ${resourceId}`);

    return {
      success: true,
      allocation
    };
  }

  /**
   * Get allocation by ID
   */
  getAllocation(resourceId: string): ResourceAllocation | undefined {
    return this.allocations.get(resourceId);
  }

  /**
   * Get all allocations
   */
  getAllAllocations(): ResourceAllocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Get allocations by type
   */
  getAllocationsByType(resourceType: ResourceType): ResourceAllocation[] {
    return Array.from(this.allocations.values()).filter(
      (a) => a.resourceType === resourceType
    );
  }

  /**
   * Get available capacity
   */
  getAvailableCapacity(resourceType: ResourceType): ResourceSpec | undefined {
    return this.availableCapacity.get(resourceType);
  }

  /**
   * Get utilization statistics
   */
  getUtilization(resourceType: ResourceType): {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  } | null {
    const available = this.availableCapacity.get(resourceType);
    if (!available) {
      return null;
    }

    const allocations = this.getAllocationsByType(resourceType);

    let usedCpu = 0;
    let usedMemory = 0;
    let usedStorage = 0;
    let usedNetwork = 0;

    for (const allocation of allocations) {
      usedCpu += allocation.allocation.cpu.cores;
      usedMemory += allocation.allocation.memory.size;
      usedStorage += allocation.allocation.storage.size;
      usedNetwork += allocation.allocation.network.bandwidth;
    }

    return {
      cpu: (usedCpu / available.cpu.cores) * 100,
      memory: (usedMemory / available.memory.size) * 100,
      storage: (usedStorage / available.storage.size) * 100,
      network: (usedNetwork / available.network.bandwidth) * 100
    };
  }

  /**
   * Rebalance allocations across available capacity
   */
  async rebalance(): Promise<void> {
    this.logger.info('Starting resource rebalancing');

    for (const resourceType of Object.values(ResourceType)) {
      const utilization = this.getUtilization(resourceType);
      if (!utilization) {
        continue;
      }

      // Check if rebalancing is needed
      const isImbalanced =
        Math.abs(utilization.cpu - utilization.memory) > 20 ||
        Math.abs(utilization.cpu - utilization.storage) > 20;

      if (isImbalanced) {
        this.logger.info(`Rebalancing ${resourceType} resources`);
        await this.rebalanceResourceType(resourceType);
      }
    }
  }

  /**
   * Calculate required resource specification
   */
  private calculateRequiredSpec(request: AllocationRequest): ResourceSpec {
    const defaultSpec: ResourceSpec = {
      cpu: { cores: 1, frequency: 3000, credits: 100, burstCapacity: 10 },
      memory: { size: 512, type: 'dram' as const },
      storage: { size: 1000, type: 'ssd' as const, iops: 100, throughput: 10 },
      network: { bandwidth: 100, connections: 1000, requestsPerSecond: 100 }
    };

    return {
      ...defaultSpec,
      ...request.requestedSpec
    } as ResourceSpec;
  }

  /**
   * Apply allocation strategy
   */
  private applyStrategy(
    request: AllocationRequest,
    requiredSpec: ResourceSpec,
    available: ResourceSpec
  ): {
    canAllocate: boolean;
    allocatedSpec: ResourceSpec;
    reason?: string;
    alternatives?: ResourceAllocation[];
  } {
    switch (request.strategy.type) {
      case AllocationStrategyType.BIN_PACKING:
        return this.binPackStrategy(request, requiredSpec, available);

      case AllocationStrategyType.WORST_FIT:
        return this.worstFitStrategy(request, requiredSpec, available);

      case AllocationStrategyType.BEST_FIT:
        return this.bestFitStrategy(request, requiredSpec, available);

      case AllocationStrategyType.FIRST_FIT:
        return this.firstFitStrategy(request, requiredSpec, available);

      case AllocationStrategyType.SPREAD:
        return this.spreadStrategy(request, requiredSpec, available);

      default:
        return this.firstFitStrategy(request, requiredSpec, available);
    }
  }

  /**
   * Bin packing strategy - pack tightly
   */
  private binPackStrategy(
    request: AllocationRequest,
    requiredSpec: ResourceSpec,
    available: ResourceSpec
  ): {
    canAllocate: boolean;
    allocatedSpec: ResourceSpec;
    reason?: string;
  } {
    // Try to allocate exactly what's requested
    if (this.hasSufficientCapacity(available, requiredSpec)) {
      return {
        canAllocate: true,
        allocatedSpec: requiredSpec
      };
    }

    // Try to reduce allocation
    const reducedSpec = this.reduceSpec(requiredSpec, 0.8);
    if (this.hasSufficientCapacity(available, reducedSpec)) {
      return {
        canAllocate: true,
        allocatedSpec: reducedSpec
      };
    }

    return {
      canAllocate: false,
      allocatedSpec: requiredSpec,
      reason: 'Insufficient capacity for bin packing'
    };
  }

  /**
   * Worst fit strategy - maximize remaining space
   */
  private worstFitStrategy(
    request: AllocationRequest,
    requiredSpec: ResourceSpec,
    available: ResourceSpec
  ): {
    canAllocate: boolean;
    allocatedSpec: ResourceSpec;
    reason?: string;
  } {
    // Find the largest available allocation
    const maxSpec = this.findMaxAllocation(available);

    if (this.hasSufficientCapacity(maxSpec, requiredSpec)) {
      return {
        canAllocate: true,
        allocatedSpec: requiredSpec
      };
    }

    return {
      canAllocate: false,
      allocatedSpec: requiredSpec,
      reason: 'Insufficient capacity for worst fit'
    };
  }

  /**
   * Best fit strategy - minimize remaining space
   */
  private bestFitStrategy(
    request: AllocationRequest,
    requiredSpec: ResourceSpec,
    available: ResourceSpec
  ): {
    canAllocate: boolean;
    allocatedSpec: ResourceSpec;
    reason?: string;
  } {
    // Try to find the smallest allocation that fits
    if (this.hasSufficientCapacity(available, requiredSpec)) {
      return {
        canAllocate: true,
        allocatedSpec: requiredSpec
      };
    }

    return {
      canAllocate: false,
      allocatedSpec: requiredSpec,
      reason: 'Insufficient capacity for best fit'
    };
  }

  /**
   * First fit strategy - allocate to first available
   */
  private firstFitStrategy(
    request: AllocationRequest,
    requiredSpec: ResourceSpec,
    available: ResourceSpec
  ): {
    canAllocate: boolean;
    allocatedSpec: ResourceSpec;
    reason?: string;
  } {
    if (this.hasSufficientCapacity(available, requiredSpec)) {
      return {
        canAllocate: true,
        allocatedSpec: requiredSpec
      };
    }

    return {
      canAllocate: false,
      allocatedSpec: requiredSpec,
      reason: 'Insufficient capacity for first fit'
    };
  }

  /**
   * Spread strategy - distribute load evenly
   */
  private spreadStrategy(
    request: AllocationRequest,
    requiredSpec: ResourceSpec,
    available: ResourceSpec
  ): {
    canAllocate: boolean;
    allocatedSpec: ResourceSpec;
    reason?: string;
  } {
    // Check if we can spread across multiple instances
    const utilization = this.getUtilization(request.resourceType);

    if (utilization && utilization.cpu > 80) {
      return {
        canAllocate: false,
        allocatedSpec: requiredSpec,
        reason: 'Resource type is too utilized for spreading'
      };
    }

    if (this.hasSufficientCapacity(available, requiredSpec)) {
      return {
        canAllocate: true,
        allocatedSpec: requiredSpec
      };
    }

    return {
      canAllocate: false,
      allocatedSpec: requiredSpec,
      reason: 'Insufficient capacity for spread strategy'
    };
  }

  /**
   * Check if sufficient capacity exists
   */
  private hasSufficientCapacity(
    available: ResourceSpec | undefined,
    required: ResourceSpec | Partial<ResourceSpec>
  ): boolean {
    if (!available) {
      return false;
    }

    const req = required as ResourceSpec;

    return (
      available.cpu.cores >= req.cpu.cores &&
      available.memory.size >= req.memory.size &&
      available.storage.size >= req.storage.size &&
      available.network.bandwidth >= req.network.bandwidth
    );
  }

  /**
   * Calculate resource delta
   */
  private calculateResourceDelta(
    oldSpec: ResourceSpec,
    newSpec: Partial<ResourceSpec>
  ): ResourceSpec {
    return {
      cpu: {
        cores: (newSpec.cpu?.cores || 0) - oldSpec.cpu.cores,
        frequency: (newSpec.cpu?.frequency || 0) - oldSpec.cpu.frequency,
        credits: (newSpec.cpu?.credits || 0) - oldSpec.cpu.credits,
        burstCapacity: (newSpec.cpu?.burstCapacity || 0) - oldSpec.cpu.burstCapacity
      },
      memory: {
        size: (newSpec.memory?.size || 0) - oldSpec.memory.size,
        type: newSpec.memory?.type || oldSpec.memory.type
      },
      storage: {
        size: (newSpec.storage?.size || 0) - oldSpec.storage.size,
        type: newSpec.storage?.type || oldSpec.storage.type,
        iops: (newSpec.storage?.iops || 0) - oldSpec.storage.iops,
        throughput: (newSpec.storage?.throughput || 0) - oldSpec.storage.throughput
      },
      network: {
        bandwidth: (newSpec.network?.bandwidth || 0) - oldSpec.network.bandwidth,
        connections: (newSpec.network?.connections || 0) - oldSpec.network.connections,
        requestsPerSecond:
          (newSpec.network?.requestsPerSecond || 0) - oldSpec.network.requestsPerSecond
      }
    };
  }

  /**
   * Reduce resource specification
   */
  private reduceSpec(spec: ResourceSpec, factor: number): ResourceSpec {
    return {
      cpu: {
        cores: Math.ceil(spec.cpu.cores * factor),
        frequency: spec.cpu.frequency,
        credits: Math.ceil(spec.cpu.credits * factor),
        burstCapacity: Math.ceil(spec.cpu.burstCapacity * factor)
      },
      memory: {
        size: Math.ceil(spec.memory.size * factor),
        type: spec.memory.type
      },
      storage: {
        size: Math.ceil(spec.storage.size * factor),
        type: spec.storage.type,
        iops: Math.ceil(spec.storage.iops * factor),
        throughput: Math.ceil(spec.storage.throughput * factor)
      },
      network: {
        bandwidth: Math.ceil(spec.network.bandwidth * factor),
        connections: Math.ceil(spec.network.connections * factor),
        requestsPerSecond: Math.ceil(spec.network.requestsPerSecond * factor)
      }
    };
  }

  /**
   * Find maximum possible allocation
   */
  private findMaxAllocation(available: ResourceSpec): ResourceSpec {
    return {
      cpu: { ...available.cpu },
      memory: { ...available.memory },
      storage: { ...available.storage },
      network: { ...available.network }
    };
  }

  /**
   * Update available capacity
   */
  private updateAvailableCapacity(
    resourceType: ResourceType,
    spec: ResourceSpec | Partial<ResourceSpec>,
    allocate: boolean
  ): void {
    const available = this.availableCapacity.get(resourceType);
    if (!available) {
      return;
    }

    const multiplier = allocate ? -1 : 1;

    available.cpu.cores += (spec.cpu?.cores || 0) * multiplier;
    available.cpu.credits += (spec.cpu?.credits || 0) * multiplier;
    available.cpu.burstCapacity += (spec.cpu?.burstCapacity || 0) * multiplier;

    available.memory.size += (spec.memory?.size || 0) * multiplier;

    available.storage.size += (spec.storage?.size || 0) * multiplier;
    available.storage.iops += (spec.storage?.iops || 0) * multiplier;
    available.storage.throughput += (spec.storage?.throughput || 0) * multiplier;

    available.network.bandwidth += (spec.network?.bandwidth || 0) * multiplier;
    available.network.connections += (spec.network?.connections || 0) * multiplier;
    available.network.requestsPerSecond += (spec.network?.requestsPerSecond || 0) * multiplier;
  }

  /**
   * Create allocation object
   */
  private createAllocation(
    request: AllocationRequest,
    spec: ResourceSpec
  ): ResourceAllocation {
    const usage: ResourceUsage = {
      cpu: 0,
      memory: 0,
      storage: 0,
      network: 0,
      timestamp: new Date()
    };

    return {
      id: `alloc-${request.resourceId}`,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      allocation: spec,
      usage,
      status: AllocationStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Process pending allocation requests
   */
  private async processPendingRequests(): Promise<void> {
    if (this.pendingRequests.length === 0) {
      return;
    }

    this.logger.info(`Processing ${this.pendingRequests.length} pending requests`);

    const processed: string[] = [];

    for (const request of this.pendingRequests) {
      const result = await this.allocate(request);
      if (result.success) {
        processed.push(request.resourceId);
      }
    }

    // Remove processed requests
    this.pendingRequests = this.pendingRequests.filter(
      (r) => !processed.includes(r.resourceId)
    );
  }

  /**
   * Rebalance a specific resource type
   */
  private async rebalanceResourceType(resourceType: ResourceType): Promise<void> {
    const allocations = this.getAllocationsByType(resourceType);

    // Sort by utilization (ascending)
    const sortedAllocations = allocations.sort((a, b) => {
      const aUtil = a.usage.cpu + a.usage.memory + a.usage.storage;
      const bUtil = b.usage.cpu + b.usage.memory + b.usage.storage;
      return aUtil - bUtil;
    });

    // Consider rebalancing low-utilization allocations
    for (const allocation of sortedAllocations) {
      const totalUtil = (allocation.usage.cpu + allocation.usage.memory) / 2;

      if (totalUtil < 20) {
        // Downsize allocation
        const newSpec = this.reduceSpec(allocation.allocation, 0.7);
        await this.updateAllocation(allocation.resourceId, newSpec);
      }
    }
  }

  /**
   * Add capacity for a resource type
   */
  addCapacity(resourceType: ResourceType, spec: Partial<ResourceSpec>): void {
    const available = this.availableCapacity.get(resourceType);
    if (!available) {
      return;
    }

    this.updateAvailableCapacity(resourceType, spec, false);

    this.logger.info(`Added capacity for ${resourceType}`, spec);

    // Process pending requests
    this.processPendingRequests();
  }

  /**
   * Get pending requests count
   */
  getPendingRequestsCount(): number {
    return this.pendingRequests.length;
  }
}
