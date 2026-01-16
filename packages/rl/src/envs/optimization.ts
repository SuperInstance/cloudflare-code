// @ts-nocheck
/**
 * Optimization Environments for RL
 */

import { Env, StepResult, Box, Discrete, MultiDiscrete } from './base.js';

/**
 * Resource Allocation Environment
 * Agent learns to allocate resources efficiently
 */
export class ResourceAllocationEnv extends Env<ResourceState, number[]> {
  readonly observationSpace: Box;
  readonly actionSpace: MultiDiscrete;

  private numResources: number;
  private numTasks: number;
  private totalCapacity: number;
  private taskDemands: number[] = [];
  private currentAllocation: number[] = [];

  constructor(
    numResources: number = 5,
    numTasks: number = 10,
    options: {
      totalCapacity?: number;
      maxDemand?: number;
    } = {}
  ) {
    super();

    this.numResources = numResources;
    this.numTasks = numTasks;
    this.totalCapacity = options.totalCapacity ?? 100;

    this.observationSpace = new Box(0, options.maxDemand ?? 20, 'float32', [numTasks * 2]);
    this.actionSpace = new MultiDiscrete(Array(numTasks).fill(numResources + 1));

    this._metadata = {
      'render.modes': ['human'],
      'num.resources': numResources,
      'num.tasks': numTasks,
    };
  }

  async reset(options?: Record<string, any>): Promise<ResourceState> {
    this._elapsedSteps = 0;

    // Generate random task demands
    this.taskDemands = Array.from({ length: this.numTasks }, () => Math.floor(Math.random() * 20) + 1);
    this.currentAllocation = Array(this.numResources).fill(0);

    return {
      taskDemands: [...this.taskDemands],
      currentAllocation: [...this.currentAllocation],
      remainingCapacity: this.totalCapacity,
      completedTasks: 0,
      totalReward: 0,
    };
  }

  async step(action: number[]): Promise<StepResult<ResourceState>> {
    this._elapsedSteps++;

    // Action is an array where each element specifies which resource to allocate to each task
    let totalAllocated = 0;
    let completedTasks = 0;
    let overflowPenalty = 0;

    for (let taskIdx = 0; taskIdx < this.numTasks; taskIdx++) {
      const resourceIdx = action[taskIdx];

      if (resourceIdx < this.numResources) {
        // Allocate task to resource
        const demand = this.taskDemands[taskIdx];
        const newAllocation = this.currentAllocation[resourceIdx] + demand;

        if (newAllocation <= this.totalCapacity / this.numResources) {
          this.currentAllocation[resourceIdx] = newAllocation;
          totalAllocated += demand;
          completedTasks++;
        } else {
          overflowPenalty += 1;
        }
      }
    }

    // Calculate reward
    const efficiencyReward = totalAllocated / this.totalCapacity;
    const completionReward = completedTasks / this.numTasks;
    const overflowPenaltyNormalized = overflowPenalty / this.numTasks;

    const reward = efficiencyReward * 0.5 + completionReward * 0.5 - overflowPenaltyNormalized * 0.3;

    const remainingCapacity = this.totalCapacity - this.currentAllocation.reduce((a, b) => a + b, 0);

    const newState: ResourceState = {
      taskDemands: [...this.taskDemands],
      currentAllocation: [...this.currentAllocation],
      remainingCapacity,
      completedTasks,
      totalReward: (this.getCurrentState().totalReward ?? 0) + reward,
    };

    return {
      observation: newState,
      reward,
      terminated: completedTasks === this.numTasks || remainingCapacity === 0,
      truncated: this._elapsedSteps >= 20,
      info: {
        totalAllocated,
        completedTasks,
        overflowPenalty,
        utilization: (this.totalCapacity - remainingCapacity) / this.totalCapacity,
      },
    };
  }

  private getCurrentState(): ResourceState {
    return {
      taskDemands: [],
      currentAllocation: [],
      remainingCapacity: this.totalCapacity,
      completedTasks: 0,
      totalReward: 0,
    };
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    const state = this.getCurrentState();

    return `
Resource Allocation (Step ${this._elapsedSteps})
==========================================
Tasks: ${this.numTasks}
Resources: ${this.numResources}
Total Capacity: ${this.totalCapacity}

Current Allocation: ${state.currentAllocation.map((a, i) => `R${i}:${a}`).join(', ')}
Remaining Capacity: ${state.remainingCapacity.toFixed(2)}
Completed Tasks: ${state.completedTasks}/${this.numTasks}
Total Reward: ${state.totalReward.toFixed(3)}
`;
  }
}

export interface ResourceState {
  taskDemands: number[];
  currentAllocation: number[];
  remainingCapacity: number;
  completedTasks: number;
  totalReward: number;
}

/**
 * Scheduling Environment
 * Agent learns to schedule tasks optimally
 */
export class SchedulingEnv extends Env<ScheduleState, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private numJobs: number;
  private numMachines: number;
  private jobs: Job[] = [];
  private schedule: Map<number, number[]> = new Map(); // machine -> jobs

  constructor(
    numJobs: number = 10,
    numMachines: number = 3,
    options: {
      maxProcessingTime?: number;
      maxDeadline?: number;
    } = {}
  ) {
    super();

    this.numJobs = numJobs;
    this.numMachines = numMachines;

    this.observationSpace = new Box(0, options.maxDeadline ?? 100, 'float32', [numJobs * 3]);
    this.actionSpace = new Discrete(numMachines);

    this._metadata = {
      'render.modes': ['human'],
      'num.jobs': numJobs,
      'num.machines': numMachines,
    };
  }

  async reset(options?: Record<string, any>): Promise<ScheduleState> {
    this._elapsedSteps = 0;
    this.schedule.clear();

    // Generate random jobs
    this.jobs = Array.from({ length: this.numJobs }, (_, i) => ({
      id: i,
      processingTime: Math.floor(Math.random() * 20) + 5,
      deadline: Math.floor(Math.random() * 50) + 30,
      priority: Math.floor(Math.random() * 5) + 1,
    }));

    // Initialize schedule
    for (let i = 0; i < this.numMachines; i++) {
      this.schedule.set(i, []);
    }

    return this.getState();
  }

  async step(action: number): Promise<StepResult<ScheduleState>> {
    if (this._elapsedSteps >= this.jobs.length) {
      throw new Error('All jobs have been scheduled');
    }

    this._elapsedSteps++;

    const job = this.jobs[this._elapsedSteps - 1];
    const machine = action;

    // Schedule job to machine
    const machineJobs = this.schedule.get(machine) ?? [];
    machineJobs.push(job);
    this.schedule.set(machine, machineJobs);

    // Calculate reward
    const reward = this.calculateReward();

    const newState = this.getState();

    return {
      observation: newState,
      reward,
      terminated: this._elapsedSteps === this.jobs.length,
      truncated: false,
      info: {
        jobId: job.id,
        machine,
        makespan: newState.makespan,
        tardiness: newState.totalTardiness,
      },
    };
  }

  private getState(): ScheduleState {
    const machineLoads = this.calculateMachineLoads();
    const makespan = Math.max(...machineLoads);
    const totalTardiness = this.calculateTotalTardiness();

    return {
      jobs: [...this.jobs],
      schedule: new Map(this.schedule),
      machineLoads,
      makespan,
      totalTardiness,
      scheduledJobs: this._elapsedSteps,
    };
  }

  private calculateMachineLoads(): number[] {
    const loads: number[] = [];

    for (let i = 0; i < this.numMachines; i++) {
      const jobs = this.schedule.get(i) ?? [];
      const load = jobs.reduce((sum, job) => sum + job.processingTime, 0);
      loads.push(load);
    }

    return loads;
  }

  private calculateTotalTardiness(): number {
    let totalTardiness = 0;

    for (let i = 0; i < this.numMachines; i++) {
      const jobs = this.schedule.get(i) ?? [];
      let currentTime = 0;

      for (const job of jobs) {
        currentTime += job.processingTime;
        const tardiness = Math.max(0, currentTime - job.deadline);
        totalTardiness += tardiness;
      }
    }

    return totalTardiness;
  }

  private calculateReward(): number {
    const machineLoads = this.calculateMachineLoads();
    const makespan = Math.max(...machineLoads);
    const avgLoad = machineLoads.reduce((a, b) => a + b, 0) / machineLoads.length;
    const loadBalance = 1 - Math.abs(avgLoad - makespan / this.numMachines) / avgLoad;

    const tardinessReward = 1 / (1 + this.calculateTotalTardiness());

    return loadBalance * 0.7 + tardinessReward * 0.3;
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    const state = this.getState();

    let output = `Job Scheduling (Step ${this._elapsedSteps}/${this.numJobs})\n`;
    output += '='.repeat(50) + '\n\n';

    for (let i = 0; i < this.numMachines; i++) {
      const jobs = this.schedule.get(i) ?? [];
      output += `Machine ${i}: Load = ${state.machineLoads[i]}\n`;
      output += `  Jobs: ${jobs.map(j => `J${j.id}`).join(', ')}\n`;
    }

    output += `\nMakespan: ${state.makespan}\n`;
    output += `Total Tardiness: ${state.totalTardiness}\n`;

    return output;
  }
}

export interface ScheduleState {
  jobs: Job[];
  schedule: Map<number, number[]>;
  machineLoads: number[];
  makespan: number;
  totalTardiness: number;
  scheduledJobs: number;
}

export interface Job {
  id: number;
  processingTime: number;
  deadline: number;
  priority: number;
}

/**
 * Routing Environment
 * Agent learns to find optimal routes
 */
export class RoutingEnv extends Env<RoutingState, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private numNodes: number;
  private numVehicles: number;
  private demands: number[] = [];
  private distanceMatrix: number[][] = [];
  private vehicleRoutes: Map<number, number[]> = new Map();
  private vehicleLoads: number[] = [];
  private currentNode: number = 0;

  constructor(
    numNodes: number = 10,
    numVehicles: number = 2,
    options: {
      capacity?: number;
      maxDistance?: number;
    } = {}
  ) {
    super();

    this.numNodes = numNodes;
    this.numVehicles = numVehicles;

    this.observationSpace = new Box(0, options.maxDistance ?? 100, 'float32', [numNodes * 2]);
    this.actionSpace = new Discrete(numNodes);

    this._metadata = {
      'render.modes': ['human'],
      'num.nodes': numNodes,
      'num.vehicles': numVehicles,
    };
  }

  async reset(options?: Record<string, any>): Promise<RoutingState> {
    this._elapsedSteps = 0;
    this.vehicleRoutes.clear();
    this.vehicleLoads = Array(this.numVehicles).fill(0);

    // Generate random demands
    this.demands = Array.from({ length: this.numNodes }, () => Math.floor(Math.random() * 10) + 1);

    // Generate random distance matrix
    this.distanceMatrix = Array.from({ length: this.numNodes }, () =>
      Array.from({ length: this.numNodes }, () => Math.floor(Math.random() * 50) + 10)
    );

    // Initialize routes
    for (let i = 0; i < this.numVehicles; i++) {
      this.vehicleRoutes.set(i, [0]); // Start at depot (node 0)
    }

    this.currentNode = 0;

    return this.getState();
  }

  async step(action: number): Promise<StepResult<RoutingState>> {
    this._elapsedSteps++;

    const nextNode = action;
    const vehicle = this._elapsedSteps % this.numVehicles;

    // Add node to vehicle route
    const route = this.vehicleRoutes.get(vehicle) ?? [];
    route.push(nextNode);
    this.vehicleRoutes.set(vehicle, route);

    // Update vehicle load
    this.vehicleLoads[vehicle] += this.demands[nextNode];

    // Calculate reward
    const distance = this.distanceMatrix[this.currentNode][nextNode];
    const reward = -distance / 100; // Negative reward for distance

    this.currentNode = nextNode;

    const newState = this.getState();

    return {
      observation: newState,
      reward,
      terminated: this.allNodesVisited(),
      truncated: this._elapsedSteps >= this.numNodes * this.numVehicles,
      info: {
        vehicle,
        node: nextNode,
        distance,
        totalDistance: newState.totalDistance,
      },
    };
  }

  private getState(): RoutingState {
    let totalDistance = 0;

    for (const [vehicle, route] of this.vehicleRoutes) {
      for (let i = 0; i < route.length - 1; i++) {
        totalDistance += this.distanceMatrix[route[i]][route[i + 1]];
      }
    }

    const visitedNodes = new Set<number>();
    for (const route of this.vehicleRoutes.values()) {
      for (const node of route) {
        visitedNodes.add(node);
      }
    }

    return {
      demands: [...this.demands],
      distanceMatrix: this.distanceMatrix,
      vehicleRoutes: new Map(this.vehicleRoutes),
      vehicleLoads: [...this.vehicleLoads],
      totalDistance,
      visitedNodes: Array.from(visitedNodes),
    };
  }

  private allNodesVisited(): boolean {
    const visited = new Set<number>();
    for (const route of this.vehicleRoutes.values()) {
      for (const node of route) {
        visited.add(node);
      }
    }
    return visited.size === this.numNodes;
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    const state = this.getState();

    let output = `Vehicle Routing (Step ${this._elapsedSteps})\n`;
    output += '='.repeat(50) + '\n\n';

    for (let i = 0; i < this.numVehicles; i++) {
      const route = this.vehicleRoutes.get(i) ?? [];
      output += `Vehicle ${i}: Load = ${state.vehicleLoads[i]}\n`;
      output += `  Route: ${route.join(' -> ')}\n`;
    }

    output += `\nTotal Distance: ${state.totalDistance.toFixed(2)}\n`;
    output += `Visited Nodes: ${state.visitedNodes.length}/${this.numNodes}\n`;

    return output;
  }
}

export interface RoutingState {
  demands: number[];
  distanceMatrix: number[][];
  vehicleRoutes: Map<number, number[]>;
  vehicleLoads: number[];
  totalDistance: number;
  visitedNodes: number[];
}

/**
 * Load Balancing Environment
 * Agent learns to balance load across servers
 */
export class LoadBalancingEnv extends Env<LoadBalanceState, number> {
  readonly observationSpace: Box;
  readonly actionSpace: Discrete;

  private numServers: number;
  private maxQueueLength: number;
  private serverLoads: number[] = [];
  private serverCapacities: number[] = [];
  private arrivalRate: number = 0;
  private serviceRate: number = 0;

  constructor(
    numServers: number = 5,
    options: {
      maxQueueLength?: number;
      serverCapacity?: number;
    } = {}
  ) {
    super();

    this.numServers = numServers;
    this.maxQueueLength = options.maxQueueLength ?? 50;

    this.observationSpace = new Box(0, 1, 'float32', [numServers * 2]);
    this.actionSpace = new Discrete(numServers);

    this._metadata = {
      'render.modes': ['human'],
      'num.servers': numServers,
    };
  }

  async reset(options?: Record<string, any>): Promise<LoadBalanceState> {
    this._elapsedSteps = 0;

    // Initialize server loads and capacities
    this.serverLoads = Array(this.numServers).fill(0);
    this.serverCapacities = Array.from({ length: this.numServers }, () => Math.floor(Math.random() * 10) + 10);

    // Random arrival and service rates
    this.arrivalRate = Math.random() * 0.3 + 0.1;
    this.serviceRate = Math.random() * 0.4 + 0.2;

    return this.getState();
  }

  async step(action: number): Promise<StepResult<LoadBalanceState>> {
    this._elapsedSteps++;

    // Distribute incoming requests
    const numArrivals = Math.floor(Math.random() * 3) + 1;
    const server = action;

    let reward = 0;

    for (let i = 0; i < numArrivals; i++) {
      // Check if server has capacity
      if (this.serverLoads[server] < this.serverCapacities[server]) {
        this.serverLoads[server]++;
        reward += 0.1; // Reward for accepting request
      } else {
        reward -= 0.5; // Penalty for rejecting request
      }
    }

    // Process requests
    for (let i = 0; i < this.numServers; i++) {
      const processed = Math.floor(Math.random() * 3);
      this.serverLoads[i] = Math.max(0, this.serverLoads[i] - processed);
    }

    // Calculate load balance penalty
    const avgLoad = this.serverLoads.reduce((a, b) => a + b, 0) / this.numServers;
    const loadVariance =
      this.serverLoads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / this.numServers;
    const balancePenalty = -loadVariance * 0.1;

    reward += balancePenalty;

    const newState = this.getState();

    return {
      observation: newState,
      reward,
      terminated: this._elapsedSteps >= 100,
      truncated: false,
      info: {
        server,
        numArrivals,
        avgLoad,
        loadVariance,
      },
    };
  }

  private getState(): LoadBalanceState {
    const totalLoad = this.serverLoads.reduce((a, b) => a + b, 0);
    const avgLoad = totalLoad / this.numServers;

    return {
      serverLoads: [...this.serverLoads],
      serverCapacities: [...this.serverCapacities],
      totalLoad,
      avgLoad,
      maxLoad: Math.max(...this.serverLoads),
      minLoad: Math.min(...this.serverLoads),
      utilization: totalLoad / this.serverCapacities.reduce((a, b) => a + b, 0),
    };
  }

  render(mode: 'human' | 'rgb_array' | 'ansi' = 'human'): string {
    const state = this.getState();

    let output = `Load Balancing (Step ${this._elapsedSteps})\n`;
    output += '='.repeat(50) + '\n\n';

    for (let i = 0; i < this.numServers; i++) {
      const capacity = state.serverCapacities[i];
      const load = state.serverLoads[i];
      const utilization = (load / capacity) * 100;

      output += `Server ${i}: ${load}/${capacity} (${utilization.toFixed(1)}%)\n`;
    }

    output += `\nTotal Load: ${state.totalLoad}\n`;
    output += `Average Load: ${state.avgLoad.toFixed(2)}\n`;
    output += `Utilization: ${(state.utilization * 100).toFixed(1)}%\n`;

    return output;
  }
}

export interface LoadBalanceState {
  serverLoads: number[];
  serverCapacities: number[];
  totalLoad: number;
  avgLoad: number;
  maxLoad: number;
  minLoad: number;
  utilization: number;
}
