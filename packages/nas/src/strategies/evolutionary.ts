/**
 * Evolutionary Architecture Search
 * Genetic algorithms for neural architecture search
 */

import {
  Architecture,
  SearchStrategy,
  SearchStrategyType,
  EvolutionaryConfig,
  MutationOperator,
  CrossoverType,
  SelectionMethod,
  InitializationStrategy,
  SearchState,
  ConvergenceMetrics,
  SearchResult,
  SearchStatistics,
} from '../types';

// ============================================================================
// Evolutionary Search Strategy
// ============================================================================

export class EvolutionarySearch {
  private config: EvolutionaryConfig;
  private state: SearchState;
  private population: Architecture[];
  private fitnessHistory: number[][];
  private diversityHistory: number[];

  constructor(config: EvolutionaryConfig) {
    this.config = config;
    this.state = this.initializeState();
    this.population = [];
    this.fitnessHistory = [];
    this.diversityHistory = [];
  }

  // ============================================================================
  // Main Search Loop
  // ============================================================================

  /**
   * Run the evolutionary search
   */
  public async search(
    evaluate: (arch: Architecture) => Promise<Architecture>
  ): Promise<SearchResult> {
    const startTime = Date.now();

    // Initialize population
    this.population = await this.initializePopulation();

    // Evaluate initial population
    this.population = await this.evaluatePopulation(this.population, evaluate);

    // Update best architecture
    this.updateBestArchitecture();

    // Main evolution loop
    while (!this.shouldTerminate()) {
      this.state.iteration++;

      // Selection
      const parents = this.selectParents();

      // Crossover
      const offspring = this.crossover(parents);

      // Mutation
      const mutated = this.mutate(offspring);

      // Evaluate offspring
      const evaluated = await this.evaluatePopulation(mutated, evaluate);

      // Survival selection
      this.population = this.survivalSelection([...this.population, ...evaluated]);

      // Update state
      this.updateState();

      // Log progress
      this.logProgress();
    }

    const duration = Date.now() - startTime;

    return {
      strategy: 'evolutionary',
      iterations: this.state.iteration,
      bestArchitecture: this.state.bestArchitecture,
      paretoFront: this.state.paretoFront,
      history: this.state.history,
      statistics: this.calculateStatistics(),
      duration,
    };
  }

  // ============================================================================
  // Population Initialization
  // ============================================================================

  private async initializePopulation(): Promise<Architecture[]> {
    const population: Architecture[] = [];

    switch (this.config.population.initialization) {
      case 'random':
        for (let i = 0; i < this.config.population.size; i++) {
          population.push(this.generateRandomArchitecture());
        }
        break;

      case 'heuristic':
        population.push(...this.generateHeuristicArchitectures());
        const remaining = this.config.population.size - population.length;
        for (let i = 0; i < remaining; i++) {
          population.push(this.generateRandomArchitecture());
        }
        break;

      case 'seeded':
        population.push(...this.generateSeededArchitectures());
        break;

      case 'guided':
        population.push(...this.generateGuidedArchitectures());
        break;
    }

    return population;
  }

  private generateRandomArchitecture(): Architecture {
    // This would use the search space to generate a random architecture
    // For now, return a placeholder
    return {
      id: `arch_${Math.random().toString(36).substr(2, 9)}`,
      genotype: {
        encoding: {
          type: 'direct',
          representation: [],
          length: 0,
        },
        constraints: this.config.constraints,
        searchSpace: {} as any,
      },
      phenotype: {
        layers: [],
        connections: [],
        topology: { type: 'sequential', depth: 0, width: 0, branches: 0 },
      },
      metrics: {
        flops: 0,
        parameters: 0,
        memory: 0,
        latency: 0,
        energy: 0,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        generation: 0,
        source: 'evolutionary',
        tags: [],
      },
    };
  }

  private generateHeuristicArchitectures(): Architecture[] {
    // Generate architectures based on heuristics
    // e.g., ResNet-style, EfficientNet-style, etc.
    return [];
  }

  private generateSeededArchitectures(): Architecture[] {
    // Use pre-defined seed architectures
    return [];
  }

  private generateGuidedArchitectures(): Architecture[] {
    // Use guidance from previous searches or expert knowledge
    return [];
  }

  // ============================================================================
  // Population Evaluation
  // ============================================================================

  private async evaluatePopulation(
    population: Architecture[],
    evaluate: (arch: Architecture) => Promise<Architecture>
  ): Promise<Architecture[]> {
    const batchSize = this.config.parallelism;
    const evaluated: Architecture[] = [];

    for (let i = 0; i < population.length; i += batchSize) {
      const batch = population.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(arch => {
          this.state.evaluated++;
          return evaluate(arch);
        })
      );
      evaluated.push(...results);
    }

    return evaluated;
  }

  // ============================================================================
  // Selection
  // ============================================================================

  private selectParents(): Architecture[] {
    const numParents = Math.floor(this.config.population.size * this.config.crossover.rate);
    const parents: Architecture[] = [];

    switch (this.config.selection.method) {
      case 'tournament':
        for (let i = 0; i < numParents; i++) {
          parents.push(this.tournamentSelect());
        }
        break;

      case 'roulette':
        for (let i = 0; i < numParents; i++) {
          parents.push(this.rouletteSelect());
        }
        break;

      case 'rank':
        const ranked = this.rankPopulation();
        for (let i = 0; i < numParents; i++) {
          parents.push(this.rankSelect(ranked));
        }
        break;

      case 'sus':
        parents.push(...this.susSelect(numParents));
        break;

      case 'pareto':
        parents.push(...this.paretoSelect(numParents));
        break;
    }

    return parents;
  }

  private tournamentSelect(): Architecture {
    const tournamentSize = this.config.selection.tournamentSize || 3;
    let best = null;
    let bestFitness = -Infinity;

    for (let i = 0; i < tournamentSize; i++) {
      const individual = this.population[Math.floor(Math.random() * this.population.length)];
      const fitness = this.calculateFitness(individual);

      if (fitness > bestFitness) {
        best = individual;
        bestFitness = fitness;
      }
    }

    return best!;
  }

  private rouletteSelect(): Architecture {
    const fitnesses = this.population.map(arch => this.calculateFitness(arch));
    const totalFitness = fitnesses.reduce((sum, f) => sum + f, 0);
    let threshold = Math.random() * totalFitness;

    for (let i = 0; i < this.population.length; i++) {
      threshold -= fitnesses[i];
      if (threshold <= 0) {
        return this.population[i];
      }
    }

    return this.population[this.population.length - 1];
  }

  private rankSelect(ranked: Architecture[]): Architecture {
    // Select based on rank probability
    const ranks = ranked.map((_, i) => ranked.length - i);
    const totalRank = ranks.reduce((sum, r) => sum + r, 0);
    let threshold = Math.random() * totalRank;

    for (let i = 0; i < ranked.length; i++) {
      threshold -= ranks[i];
      if (threshold <= 0) {
        return ranked[i];
      }
    }

    return ranked[ranked.length - 1];
  }

  private susSelect(count: number): Architecture[] {
    const fitnesses = this.population.map(arch => this.calculateFitness(arch));
    const totalFitness = fitnesses.reduce((sum, f) => sum + f, 0);
    const pointerDistance = totalFitness / count;
    const startPointer = Math.random() * pointerDistance;

    const selected: Architecture[] = [];
    let pointer = startPointer;
    let sum = 0;

    for (let i = 0; i < this.population.length && selected.length < count; i++) {
      sum += fitnesses[i];
      while (sum >= pointer && selected.length < count) {
        selected.push(this.population[i]);
        pointer += pointerDistance;
      }
    }

    return selected;
  }

  private paretoSelect(count: number): Architecture[] {
    // Select from Pareto front
    const paretoFront = this.state.paretoFront;

    if (paretoFront.length >= count) {
      return paretoFront.slice(0, count);
    }

    const remaining = count - paretoFront.length;
    const rest = this.population.filter(arch => !paretoFront.includes(arch));

    return [...paretoFront, ...rest.slice(0, remaining)];
  }

  // ============================================================================
  // Crossover
  // ============================================================================

  private crossover(parents: Architecture[]): Architecture[] {
    const offspring: Architecture[] = [];

    for (let i = 0; i < parents.length - 1; i += 2) {
      const parent1 = parents[i];
      const parent2 = parents[i + 1];

      if (Math.random() < this.config.crossover.rate) {
        const [child1, child2] = this.performCrossover(parent1, parent2);
        offspring.push(child1, child2);
      } else {
        offspring.push(this.clone(parent1), this.clone(parent2));
      }
    }

    return offspring;
  }

  private performCrossover(
    parent1: Architecture,
    parent2: Architecture
  ): [Architecture, Architecture] {
    switch (this.config.crossover.type) {
      case 'single-point':
        return this.singlePointCrossover(parent1, parent2);

      case 'two-point':
        return this.twoPointCrossover(parent1, parent2);

      case 'uniform':
        return this.uniformCrossover(parent1, parent2);

      case 'layer-based':
        return this.layerBasedCrossover(parent1, parent2);

      case 'path-based':
        return this.pathBasedCrossover(parent1, parent2);

      default:
        return this.singlePointCrossover(parent1, parent2);
    }
  }

  private singlePointCrossover(
    parent1: Architecture,
    parent2: Architecture
  ): [Architecture, Architecture] {
    const layers1 = parent1.phenotype.layers;
    const layers2 = parent2.phenotype.layers;

    const minLength = Math.min(layers1.length, layers2.length);
    const point = Math.floor(Math.random() * minLength);

    const child1Layers = [...layers1.slice(0, point), ...layers2.slice(point)];
    const child2Layers = [...layers2.slice(0, point), ...layers1.slice(point)];

    return [
      this.createChild(child1Layers, parent1, parent2),
      this.createChild(child2Layers, parent1, parent2),
    ];
  }

  private twoPointCrossover(
    parent1: Architecture,
    parent2: Architecture
  ): [Architecture, Architecture] {
    const layers1 = parent1.phenotype.layers;
    const layers2 = parent2.phenotype.layers;

    const minLength = Math.min(layers1.length, layers2.length);
    const point1 = Math.floor(Math.random() * minLength);
    const point2 = Math.floor(Math.random() * (minLength - point1)) + point1;

    const child1Layers = [
      ...layers1.slice(0, point1),
      ...layers2.slice(point1, point2),
      ...layers1.slice(point2),
    ];

    const child2Layers = [
      ...layers2.slice(0, point1),
      ...layers1.slice(point1, point2),
      ...layers2.slice(point2),
    ];

    return [
      this.createChild(child1Layers, parent1, parent2),
      this.createChild(child2Layers, parent1, parent2),
    ];
  }

  private uniformCrossover(
    parent1: Architecture,
    parent2: Architecture
  ): [Architecture, Architecture] {
    const layers1 = parent1.phenotype.layers;
    const layers2 = parent2.phenotype.layers;

    const child1Layers = layers1.map((layer, i) =>
      Math.random() < 0.5 ? layer : layers2[i]
    );

    const child2Layers = layers1.map((layer, i) =>
      Math.random() < 0.5 ? layers2[i] : layer
    );

    return [
      this.createChild(child1Layers, parent1, parent2),
      this.createChild(child2Layers, parent1, parent2),
    ];
  }

  private layerBasedCrossover(
    parent1: Architecture,
    parent2: Architecture
  ): [Architecture, Architecture] {
    // Crossover entire layer blocks
    const layers1 = parent1.phenotype.layers;
    const layers2 = parent2.phenotype.layers;

    const blockSize = 3;
    const numBlocks = Math.ceil(layers1.length / blockSize);

    const child1Layers: any[] = [];
    const child2Layers: any[] = [];

    for (let block = 0; block < numBlocks; block++) {
      const swap = Math.random() < 0.5;

      if (swap) {
        child1Layers.push(...layers2.slice(block * blockSize, (block + 1) * blockSize));
        child2Layers.push(...layers1.slice(block * blockSize, (block + 1) * blockSize));
      } else {
        child1Layers.push(...layers1.slice(block * blockSize, (block + 1) * blockSize));
        child2Layers.push(...layers2.slice(block * blockSize, (block + 1) * blockSize));
      }
    }

    return [
      this.createChild(child1Layers, parent1, parent2),
      this.createChild(child2Layers, parent1, parent2),
    ];
  }

  private pathBasedCrossover(
    parent1: Architecture,
    parent2: Architecture
  ): [Architecture, Architecture] {
    // Crossover network paths/skip connections
    const child1 = this.clone(parent1);
    const child2 = this.clone(parent2);

    // Swap some skip connections
    const connections1 = child1.phenotype.connections.filter(c => c.type === 'skip');
    const connections2 = child2.phenotype.connections.filter(c => c.type === 'skip');

    const numSwap = Math.floor(connections1.length / 2);

    for (let i = 0; i < numSwap; i++) {
      if (connections1[i] && connections2[i]) {
        const temp = connections1[i];
        connections1[i] = connections2[i];
        connections2[i] = temp;
      }
    }

    return [child1, child2];
  }

  private createChild(
    layers: any[],
    parent1: Architecture,
    parent2: Architecture
  ): Architecture {
    return {
      id: `arch_${Math.random().toString(36).substr(2, 9)}`,
      genotype: {
        encoding: {
          type: 'direct',
          representation: [],
          length: 0,
        },
        constraints: parent1.genotype.constraints,
        searchSpace: parent1.genotype.searchSpace,
      },
      phenotype: {
        layers,
        connections: parent1.phenotype.connections,
        topology: parent1.phenotype.topology,
      },
      metrics: {
        flops: 0,
        parameters: 0,
        memory: 0,
        latency: 0,
        energy: 0,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        parentId: parent1.id,
        generation: this.state.iteration,
        source: 'evolutionary',
        tags: ['crossover'],
      },
    };
  }

  // ============================================================================
  // Mutation
  // ============================================================================

  private mutate(architectures: Architecture[]): Architecture[] {
    return architectures.map(arch => {
      if (Math.random() < this.config.mutation.rate) {
        return this.performMutation(arch);
      }
      return arch;
    });
  }

  private performMutation(arch: Architecture): Architecture {
    const mutant = this.clone(arch);
    const operators = this.config.mutation.operators;

    // Apply random mutation operators
    const numMutations = Math.max(1, Math.floor(this.config.mutation.strength));

    for (let i = 0; i < numMutations; i++) {
      const operator = operators[Math.floor(Math.random() * operators.length)];

      switch (operator) {
        case 'layer-add':
          this.mutateLayerAdd(mutant);
          break;

        case 'layer-remove':
          this.mutateLayerRemove(mutant);
          break;

        case 'layer-modify':
          this.mutateLayerModify(mutant);
          break;

        case 'connection-add':
          this.mutateConnectionAdd(mutant);
          break;

        case 'connection-remove':
          this.mutateConnectionRemove(mutant);
          break;

        case 'parameter-mutate':
          this.mutateParameter(mutant);
          break;

        case 'path-add':
          this.mutatePathAdd(mutant);
          break;

        case 'path-remove':
          this.mutatePathRemove(mutant);
          break;
      }
    }

    mutant.metadata.updatedAt = Date.now();
    mutant.metadata.generation = this.state.iteration;
    mutant.metadata.tags.push('mutated');

    return mutant;
  }

  private mutateLayerAdd(arch: Architecture): void {
    if (arch.phenotype.layers.length < this.config.constraints.maxLayers) {
      // Add a new layer (implementation depends on search space)
      arch.phenotype.layers.push({
        id: `layer_${arch.phenotype.layers.length}`,
        type: 'conv2d',
        operation: 'conv3x3',
        parameters: { filters: 64, kernelSize: 3 },
        inputs: [],
        outputs: [],
      });
    }
  }

  private mutateLayerRemove(arch: Architecture): void {
    if (arch.phenotype.layers.length > this.config.constraints.minLayers) {
      const idx = Math.floor(Math.random() * arch.phenotype.layers.length);
      arch.phenotype.layers.splice(idx, 1);
    }
  }

  private mutateLayerModify(arch: Architecture): void {
    if (arch.phenotype.layers.length > 0) {
      const idx = Math.floor(Math.random() * arch.phenotype.layers.length);
      const layer = arch.phenotype.layers[idx];

      // Modify layer parameters
      if (layer.parameters.filters) {
        layer.parameters.filters = this.mutateValue(layer.parameters.filters as number);
      }
      if (layer.parameters.kernelSize) {
        const sizes = [3, 5, 7];
        layer.parameters.kernelSize = sizes[Math.floor(Math.random() * sizes.length)];
      }
    }
  }

  private mutateConnectionAdd(arch: Architecture): void {
    // Add a skip connection
    const layers = arch.phenotype.layers;
    if (layers.length > 2) {
      const from = Math.floor(Math.random() * (layers.length - 2));
      const to = Math.min(from + 2 + Math.floor(Math.random() * 3), layers.length - 1);

      arch.phenotype.connections.push({
        from: layers[from].id,
        to: layers[to].id,
        type: 'skip',
      });
    }
  }

  private mutateConnectionRemove(arch: Architecture): void {
    const skipConnections = arch.phenotype.connections.filter(c => c.type === 'skip');
    if (skipConnections.length > 0) {
      const idx = Math.floor(Math.random() * skipConnections.length);
      const connection = skipConnections[idx];
      const connIdx = arch.phenotype.connections.indexOf(connection);
      if (connIdx !== -1) {
        arch.phenotype.connections.splice(connIdx, 1);
      }
    }
  }

  private mutateParameter(arch: Architecture): void {
    // Mutate a random parameter
    const layers = arch.phenotype.layers;
    if (layers.length > 0) {
      const layer = layers[Math.floor(Math.random() * layers.length)];
      const params = Object.keys(layer.parameters);

      if (params.length > 0) {
        const param = params[Math.floor(Math.random() * params.length)];
        const value = layer.parameters[param];

        if (typeof value === 'number') {
          layer.parameters[param] = this.mutateValue(value);
        }
      }
    }
  }

  private mutatePathAdd(arch: Architecture): void {
    // Add a new parallel path
    this.mutateConnectionAdd(arch);
  }

  private mutatePathRemove(arch: Architecture): void {
    // Remove a path
    this.mutateConnectionRemove(arch);
  }

  private mutateValue(value: number): number {
    // Mutate a numeric value
    const mutationStrength = 0.1;
    const delta = (Math.random() - 0.5) * 2 * mutationStrength * value;
    return Math.max(1, Math.round(value + delta));
  }

  // ============================================================================
  // Survival Selection
  // ============================================================================

  private survivalSelection(population: Architecture[]): Architecture[] {
    // Sort by fitness
    const sorted = this.rankPopulation();

    // Apply elitism
    const eliteCount = this.config.selection.elitism || Math.floor(population.length * 0.1);
    const elite = sorted.slice(0, eliteCount);

    // Select rest based on diversity if enabled
    let survivors: Architecture[];

    if (this.config.population.diversity.enabled) {
      survivors = this.diversitySelection(sorted, population.length - eliteCount);
    } else {
      survivors = sorted.slice(eliteCount, population.length);
    }

    return [...elite, ...survivors];
  }

  private diversitySelection(ranked: Architecture[], count: number): Architecture[] {
    // Select for diversity using fitness sharing or novelty
    const selected: Architecture[] = [];
    const remaining = [...ranked];

    while (selected.length < count && remaining.length > 0) {
      selected.push(remaining.shift()!);

      // Remove similar individuals
      if (this.config.population.diversity.method === 'crowding') {
        this.applyCrowding(remaining, selected[selected.length - 1]);
      }
    }

    return selected;
  }

  private applyCrowding(population: Architecture[], individual: Architecture): void {
    const threshold = this.config.population.diversity.threshold;

    for (let i = population.length - 1; i >= 0; i--) {
      if (this.calculateDistance(individual, population[i]) < threshold) {
        population.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // Fitness Calculation
  // ============================================================================

  private calculateFitness(arch: Architecture): number {
    // Multi-objective fitness
    const objectives = this.config.objectives;
    let fitness = 0;

    for (const obj of objectives) {
      const value = (arch.metrics as any)[obj.metric] || 0;

      if (obj.direction === 'maximize') {
        fitness += obj.weight * value;
      } else {
        fitness -= obj.weight * value;
      }

      // Apply target if specified
      if (obj.target !== undefined) {
        const error = Math.abs(value - obj.target);
        fitness -= 0.1 * error;
      }
    }

    return fitness;
  }

  private rankPopulation(): Architecture[] {
    return [...this.population].sort((a, b) => {
      const fitnessA = this.calculateFitness(a);
      const fitnessB = this.calculateFitness(b);
      return fitnessB - fitnessA;
    });
  }

  // ============================================================================
  // Pareto Front Calculation
  // ============================================================================

  private updateParetoFront(): void {
    const fronts = this.calculateParetoFronts(this.population);
    this.state.paretoFront = fronts[0] || [];
  }

  private calculateParetoFronts(population: Architecture[]): Architecture[][] {
    // Non-dominated sorting (NSGA-II style)
    const fronts: Architecture[][] = [];
    const ranked = [...population];

    while (ranked.length > 0) {
      const front: Architecture[] = [];

      for (let i = 0; i < ranked.length; i++) {
        let dominated = false;

        for (let j = 0; j < ranked.length; j++) {
          if (i !== j && this.dominates(ranked[j], ranked[i])) {
            dominated = true;
            break;
          }
        }

        if (!dominated) {
          front.push(ranked[i]);
        }
      }

      fronts.push(front);

      // Remove front from ranked
      for (const arch of front) {
        const idx = ranked.indexOf(arch);
        if (idx !== -1) {
          ranked.splice(idx, 1);
        }
      }
    }

    return fronts;
  }

  private dominates(arch1: Architecture, arch2: Architecture): boolean {
    // Check if arch1 dominates arch2
    const objectives = this.config.objectives;

    let atLeastOneBetter = false;

    for (const obj of objectives) {
      const value1 = (arch1.metrics as any)[obj.metric] || 0;
      const value2 = (arch2.metrics as any)[obj.metric] || 0;

      if (obj.direction === 'maximize') {
        if (value1 < value2) {
          return false;
        }
        if (value1 > value2) {
          atLeastOneBetter = true;
        }
      } else {
        if (value1 > value2) {
          return false;
        }
        if (value1 < value2) {
          atLeastOneBetter = true;
        }
      }
    }

    return atLeastOneBetter;
  }

  // ============================================================================
  // State Management
  // ============================================================================

  private initializeState(): SearchState {
    return {
      iteration: 0,
      evaluated: 0,
      bestArchitecture: {} as Architecture,
      history: [],
      paretoFront: [],
      convergence: {
        score: 0,
        improvement: 0,
        stability: 0,
        diversity: 0,
      },
    };
  }

  private updateBestArchitecture(): void {
    const best = this.population.reduce((best, arch) => {
      const fitnessBest = this.calculateFitness(best);
      const fitnessArch = this.calculateFitness(arch);
      return fitnessArch > fitnessBest ? arch : best;
    }, this.population[0]);

    this.state.bestArchitecture = best;
  }

  private updateState(): void {
    this.updateBestArchitecture();
    this.updateParetoFront();

    // Add to history
    this.state.history.push(...this.population);

    // Update convergence metrics
    this.updateConvergenceMetrics();

    // Update budget
    this.config.budget.current = this.state.evaluated;
  }

  private updateConvergenceMetrics(): void {
    const currentFitness = this.calculateFitness(this.state.bestArchitecture);
    const fitnessHistory = this.population.map(arch => this.calculateFitness(arch));

    // Improvement
    const improvement = this.fitnessHistory.length > 0
      ? currentFitness - Math.max(...this.fitnessHistory[this.fitnessHistory.length - 1])
      : 0;

    // Stability (variance in fitness)
    const variance = this.calculateVariance(fitnessHistory);
    const stability = 1 / (1 + variance);

    // Diversity
    const diversity = this.calculatePopulationDiversity();

    this.state.convergence = {
      score: currentFitness,
      improvement,
      stability,
      diversity,
    };

    this.fitnessHistory.push(fitnessHistory);
    this.diversityHistory.push(diversity);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculatePopulationDiversity(): number {
    let totalDistance = 0;
    let count = 0;

    for (let i = 0; i < this.population.length; i++) {
      for (let j = i + 1; j < this.population.length; j++) {
        totalDistance += this.calculateDistance(this.population[i], this.population[j]);
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }

  private calculateDistance(arch1: Architecture, arch2: Architecture): number {
    // Calculate architectural distance (simplified)
    const layers1 = arch1.phenotype.layers;
    const layers2 = arch2.phenotype.layers;

    let distance = Math.abs(layers1.length - layers2.length);

    const minLength = Math.min(layers1.length, layers2.length);
    for (let i = 0; i < minLength; i++) {
      if (layers1[i].operation !== layers2[i].operation) {
        distance++;
      }
    }

    return distance;
  }

  // ============================================================================
  // Termination Criteria
  // ============================================================================

  private shouldTerminate(): boolean {
    // Check iteration limit
    if (this.state.iteration >= this.config.maxIterations) {
      return true;
    }

    // Check budget
    if (this.config.budget.current >= this.config.budget.limit) {
      return true;
    }

    // Check early stopping
    if (this.config.earlyStopping?.enabled) {
      const improvement = this.state.convergence.improvement;
      const minDelta = this.config.earlyStopping.minDelta;
      const patience = this.config.earlyStopping.patience;

      if (Math.abs(improvement) < minDelta) {
        // Check if improvement has been small for 'patience' iterations
        const recentHistory = this.fitnessHistory.slice(-patience);
        const allSmallImprovement = recentHistory.every(history => {
          const max = Math.max(...history);
          return Math.abs(max - this.state.convergence.score) < minDelta;
        });

        if (allSmallImprovement && recentHistory.length === patience) {
          return true;
        }
      }
    }

    return false;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private clone(arch: Architecture): Architecture {
    return JSON.parse(JSON.stringify(arch));
  }

  private calculateStatistics(): SearchStatistics {
    return {
      totalEvaluated: this.state.evaluated,
      uniqueArchitectures: new Set(this.state.history.map(a => a.id)).size,
      convergence: this.state.convergence.score,
      diversity: this.state.convergence.diversity,
      improvementRate: this.state.convergence.improvement,
    };
  }

  private logProgress(): void {
    if (this.state.iteration % 10 === 0) {
      console.log(`Iteration ${this.state.iteration}:`);
      console.log(`  Evaluated: ${this.state.evaluated}`);
      console.log(`  Best Fitness: ${this.state.convergence.score}`);
      console.log(`  Improvement: ${this.state.convergence.improvement}`);
      console.log(`  Diversity: ${this.state.convergence.diversity}`);
      console.log(`  Pareto Front Size: ${this.state.paretoFront.length}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createEvolutionaryConfig(
  overrides: Partial<EvolutionaryConfig> = {}
): EvolutionaryConfig {
  return {
    maxIterations: 100,
    populationSize: 50,
    parallelism: 4,
    budget: {
      type: 'iterations',
      limit: 1000,
      current: 0,
    },
    objectives: [
      { name: 'accuracy', metric: 'accuracy', direction: 'maximize', weight: 1.0 },
      { name: 'flops', metric: 'flops', direction: 'minimize', weight: 0.5 },
      { name: 'latency', metric: 'latency', direction: 'minimize', weight: 0.3 },
    ],
    constraints: {
      maxLayers: 20,
      minLayers: 3,
      maxParameters: 10000000,
      maxFLOPs: 1000000000,
      maxLatency: 100,
      maxMemory: 1000,
    },
    earlyStopping: {
      enabled: true,
      patience: 20,
      minDelta: 0.001,
      metric: 'accuracy',
    },
    mutation: {
      rate: 0.1,
      operators: ['layer-add', 'layer-remove', 'layer-modify', 'parameter-mutate'],
      strength: 2,
      adaptive: false,
    },
    crossover: {
      rate: 0.8,
      type: 'single-point',
      points: 1,
    },
    selection: {
      method: 'tournament',
      pressure: 2,
      tournamentSize: 3,
      elitism: 2,
    },
    population: {
      size: 50,
      initialization: 'random',
      diversity: {
        enabled: true,
        method: 'crowding',
        threshold: 3,
      },
    },
    ...overrides,
  };
}
