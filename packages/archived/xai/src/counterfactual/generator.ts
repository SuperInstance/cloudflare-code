/**
 * Counterfactual Explanation Generator
 * Generate counterfactual examples to explain predictions
 */

import {
  CounterfactualExplanation,
  CounterfactualConfig,
  CounterfactualChange,
  ActionabilityScore,
  FeatureConstraints,
} from '../types/explanations';
import { ModelMetadata } from '../types/models';
import {
  euclideanDistance,
  manhattanDistance,
  mean,
  sample,
} from '../utils/math';
import { validateInstance, validateFeatureNames } from '../utils/validation';

export class CounterfactualGenerator {
  private config: Required<CounterfactualConfig>;
  private metadata: ModelMetadata;

  constructor(metadata: ModelMetadata, config: CounterfactualConfig = {}) {
    this.metadata = metadata;
    this.config = this.validateAndSetConfig(config);
  }

  private validateAndSetConfig(config: CounterfactualConfig): Required<CounterfactualConfig> {
    return {
      method: config.method || 'genetic',
      numCandidates: config.numCandidates || 10,
      maxIterations: config.maxIterations || 1000,
      targetClass: config.targetClass ?? undefined,
      distanceMetric: config.distanceMetric || 'euclidean',
      constraints: config.constraints || {},
    };
  }

  /**
   * Generate counterfactual explanations
   */
  async generate(
    instance: Record<string, any>,
    currentPrediction: number | string,
    targetPrediction: number | string,
    predictFn: (features: Record<string, any>) => Promise<number | string>
  ): Promise<CounterfactualExplanation[]> {
    // Validate input
    validateFeatureNames(this.metadata.featureNames);
    validateInstance(instance, this.metadata.featureNames);

    let candidates: CounterfactualExplanation[];

    switch (this.config.method) {
      case 'genetic':
        candidates = await this.geneticAlgorithm(
          instance,
          currentPrediction,
          targetPrediction,
          predictFn
        );
        break;
      case 'gradient':
        candidates = await this.gradientBased(
          instance,
          currentPrediction,
          targetPrediction,
          predictFn
        );
        break;
      case 'prototype':
        candidates = await this.prototypeBased(
          instance,
          currentPrediction,
          targetPrediction,
          predictFn
        );
        break;
      case 'growing_spheres':
        candidates = await this.growingSpheres(
          instance,
          currentPrediction,
          targetPrediction,
          predictFn
        );
        break;
      default:
        candidates = await this.geneticAlgorithm(
          instance,
          currentPrediction,
          targetPrediction,
          predictFn
        );
    }

    // Sort by validity, proximity, and plausibility
    candidates.sort((a, b) => {
      if (a.validity !== b.validity) return b.validity ? 1 : -1;
      if (Math.abs(b.proximity - a.proximity) > 0.01) {
        return b.proximity - a.proximity;
      }
      return b.plausibility - a.plausibility;
    });

    return candidates.slice(0, this.config.numCandidates);
  }

  /**
   * Genetic algorithm for counterfactual generation
   */
  private async geneticAlgorithm(
    instance: Record<string, any>,
    currentPrediction: number | string,
    targetPrediction: number | string,
    predictFn: (features: Record<string, any>) => Promise<number | string>
  ): Promise<CounterfactualExplanation[]> {
    const populationSize = 100;
    const mutationRate = 0.1;
    const crossoverRate = 0.7;

    // Initialize population
    let population = this.initializePopulation(instance, populationSize);

    let bestCandidate: CounterfactualExplanation | null = null;

    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      // Evaluate fitness
      const fitnessScores = await this.evaluatePopulation(
        population,
        instance,
        currentPrediction,
        targetPrediction,
        predictFn
      );

      // Check if we found valid counterfactuals
      const validCandidates = population.filter((_, idx) => fitnessScores[idx].valid);

      for (let i = 0; i < validCandidates.length; i++) {
        const candidate = validCandidates[i];
        const score = fitnessScores[population.indexOf(candidate)];

        const explanation = await this.buildExplanation(
          instance,
          candidate,
          currentPrediction,
          targetPrediction,
          score.distance
        );

        if (!bestCandidate || explanation.proximity > bestCandidate.proximity) {
          bestCandidate = explanation;
        }
      }

      // Selection
      const selected = this.tournamentSelection(population, fitnessScores);

      // Crossover
      const offspring = this.crossover(selected, crossoverRate, instance);

      // Mutation
      const mutated = this.mutate(offspring, mutationRate, instance);

      // Replace population
      population = mutated;

      // Early termination if we have good candidates
      if (bestCandidate && bestCandidate.proximity > 0.95) {
        break;
      }
    }

    return bestCandidate ? [bestCandidate] : [];
  }

  /**
   * Initialize population for genetic algorithm
   */
  private initializePopulation(
    instance: Record<string, any>,
    size: number
  ): Record<string, any>[] {
    const population: Record<string, any>[] = [];

    for (let i = 0; i < size; i++) {
      const individual: Record<string, any> = { ...instance };

      for (const feature of this.metadata.featureNames) {
        const constraint = this.config.constraints[feature];

        if (constraint?.immutable) {
          continue;
        }

        const featureType = this.metadata.featureTypes.find(
          ft => ft.name === feature
        );

        if (!featureType) continue;

        if (featureType.type === 'numeric') {
          const min = constraint?.min ?? featureType.range?.[0] ?? 0;
          const max = constraint?.max ?? featureType.range?.[1] ?? 1;
          individual[feature] = min + Math.random() * (max - min);
        } else if (featureType.type === 'categorical') {
          const categories = featureType.categories ?? [];
          if (categories.length > 0) {
            individual[feature] = categories[Math.floor(Math.random() * categories.length)];
          }
        } else if (featureType.type === 'boolean') {
          individual[feature] = Math.random() > 0.5;
        }
      }

      population.push(individual);
    }

    return population;
  }

  /**
   * Evaluate population fitness
   */
  private async evaluatePopulation(
    population: Record<string, any>[],
    instance: Record<string, any>,
    currentPrediction: number | string,
    targetPrediction: number | string,
    predictFn: (features: Record<string, any>) => Promise<number | string>
  ): Promise<Array<{ valid: boolean; distance: number; prediction: number | string }>> {
    const results = [];

    for (const individual of population) {
      const prediction = await predictFn(individual);
      const valid = prediction === targetPrediction;
      const distance = this.calculateDistance(individual, instance);

      results.push({ valid, distance, prediction });
    }

    return results;
  }

  /**
   * Tournament selection
   */
  private tournamentSelection(
    population: Record<string, any>[],
    fitnessScores: Array<{ valid: boolean; distance: number; prediction: any }>,
    tournamentSize: number = 3
  ): Record<string, any>[] {
    const selected: Record<string, any>[] = [];

    for (let i = 0; i < population.length; i++) {
      // Select random individuals for tournament
      const tournamentIndices = sample(
        Array.from({ length: population.length }, (_, idx) => idx),
        tournamentSize,
        false
      );

      // Find winner (prefer valid candidates with smaller distance)
      let winnerIdx = tournamentIndices[0];
      let bestScore = this.calculateFitness(fitnessScores[winnerIdx]);

      for (const idx of tournamentIndices.slice(1)) {
        const score = this.calculateFitness(fitnessScores[idx]);
        if (score > bestScore) {
          bestScore = score;
          winnerIdx = idx;
        }
      }

      selected.push(population[winnerIdx]);
    }

    return selected;
  }

  /**
   * Calculate fitness score
   */
  private calculateFitness(
    fitness: { valid: boolean; distance: number; prediction: any }
  ): number {
    // Fitness: prioritize validity, then minimize distance
    if (fitness.valid) {
      return 1 + 1 / (1 + fitness.distance);
    } else {
      return 1 / (1 + fitness.distance);
    }
  }

  /**
   * Crossover operation
   */
  private crossover(
    population: Record<string, any>[],
    rate: number,
    instance: Record<string, any>
  ): Record<string, any>[] {
    const offspring: Record<string, any>[] = [];

    for (let i = 0; i < population.length; i += 2) {
      const parent1 = population[i];
      const parent2 = population[i + 1] || population[0];

      if (Math.random() < rate) {
        // Perform crossover
        const child1: Record<string, any> = {};
        const child2: Record<string, any> = {};

        for (const feature of this.metadata.featureNames) {
          if (Math.random() < 0.5) {
            child1[feature] = parent1[feature];
            child2[feature] = parent2[feature];
          } else {
            child1[feature] = parent2[feature];
            child2[feature] = parent1[feature];
          }
        }

        offspring.push(child1, child2);
      } else {
        offspring.push(parent1, parent2);
      }
    }

    return offspring.slice(0, population.length);
  }

  /**
   * Mutation operation
   */
  private mutate(
    population: Record<string, any>[],
    rate: number,
    instance: Record<string, any>
  ): Record<string, any>[] {
    return population.map(individual => {
      const mutated: Record<string, any> = { ...individual };

      for (const feature of this.metadata.featureNames) {
        if (Math.random() < rate) {
          const constraint = this.config.constraints[feature];

          if (constraint?.immutable) {
            continue;
          }

          const featureType = this.metadata.featureTypes.find(
            ft => ft.name === feature
          );

          if (!featureType) continue;

          if (featureType.type === 'numeric') {
            const min = constraint?.min ?? featureType.range?.[0] ?? 0;
            const max = constraint?.max ?? featureType.range?.[1] ?? 1;
            mutated[feature] = min + Math.random() * (max - min);
          } else if (featureType.type === 'categorical') {
            const categories = featureType.categories ?? [];
            if (categories.length > 0) {
              mutated[feature] = categories[Math.floor(Math.random() * categories.length)];
            }
          } else if (featureType.type === 'boolean') {
            mutated[feature] = !mutated[feature];
          }
        }
      }

      return mutated;
    });
  }

  /**
   * Gradient-based counterfactual generation
   */
  private async gradientBased(
    instance: Record<string, any>,
    currentPrediction: number | string,
    targetPrediction: number | string,
    predictFn: (features: Record<string, any>) => Promise<number | string>
  ): Promise<CounterfactualExplanation[]> {
    // Simplified gradient-based approach
    const candidates: CounterfactualExplanation[] = [];
    const learningRate = 0.01;
    const maxSteps = 1000;

    let current = { ...instance };

    for (let step = 0; step < maxSteps; step++) {
      const prediction = await predictFn(current);

      if (prediction === targetPrediction) {
        const explanation = await this.buildExplanation(
          instance,
          current,
          currentPrediction,
          targetPrediction,
          this.calculateDistance(current, instance)
        );
        candidates.push(explanation);
        break;
      }

      // Estimate gradient (finite differences)
      const gradient = await this.estimateGradient(current, instance, predictFn);

      // Update features
      for (const feature of this.metadata.featureNames) {
        const constraint = this.config.constraints[feature];

        if (constraint?.immutable) continue;

        const featureType = this.metadata.featureTypes.find(
          ft => ft.name === feature
        );

        if (featureType?.type === 'numeric') {
          current[feature] -= learningRate * gradient[feature];

          // Apply constraints
          if (constraint?.min !== undefined) {
            current[feature] = Math.max(current[feature], constraint.min);
          }
          if (constraint?.max !== undefined) {
            current[feature] = Math.min(current[feature], constraint.max);
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Estimate gradient using finite differences
   */
  private async estimateGradient(
    instance: Record<string, any>,
    originalInstance: Record<string, any>,
    predictFn: (features: Record<string, any>) => Promise<number | string>
  ): Promise<Record<string, number>> {
    const gradient: Record<string, number> = {};
    const epsilon = 0.01;

    const basePrediction = await predictFn(instance);

    for (const feature of this.metadata.featureNames) {
      const featureType = this.metadata.featureTypes.find(
        ft => ft.name === feature
      );

      if (featureType?.type !== 'numeric') continue;

      const perturbed = { ...instance };
      perturbed[feature] += epsilon;

      const perturbedPrediction = await predictFn(perturbed);

      // Numerical gradient
      if (typeof basePrediction === 'number' && typeof perturbedPrediction === 'number') {
        gradient[feature] = (perturbedPrediction - basePrediction) / epsilon;
      } else {
        gradient[feature] = 0;
      }
    }

    return gradient;
  }

  /**
   * Prototype-based counterfactual generation
   */
  private async prototypeBased(
    instance: Record<string, any>,
    currentPrediction: number | string,
    targetPrediction: number | string,
    predictFn: (features: Record<string, any>) => Promise<number | string>,
    prototypes?: Record<string, any>[]
  ): Promise<CounterfactualExplanation[]> {
    // Find nearest prototype with target prediction
    if (!prototypes) {
      // Generate synthetic prototypes
      prototypes = this.generateSyntheticPrototypes(targetPrediction);
    }

    const validPrototypes: Record<string, any>[] = [];

    for (const prototype of prototypes) {
      const prediction = await predictFn(prototype);
      if (prediction === targetPrediction) {
        validPrototypes.push(prototype);
      }
    }

    if (validPrototypes.length === 0) {
      return [];
    }

    // Find closest prototype
    let closestPrototype = validPrototypes[0];
    let minDistance = this.calculateDistance(validPrototypes[0], instance);

    for (const prototype of validPrototypes.slice(1)) {
      const distance = this.calculateDistance(prototype, instance);
      if (distance < minDistance) {
        minDistance = distance;
        closestPrototype = prototype;
      }
    }

    const explanation = await this.buildExplanation(
      instance,
      closestPrototype,
      currentPrediction,
      targetPrediction,
      minDistance
    );

    return [explanation];
  }

  /**
   * Generate synthetic prototypes
   */
  private generateSyntheticPrototypes(
    targetPrediction: number | string
  ): Record<string, any>[] {
    const prototypes: Record<string, any>[] = [];
    const numPrototypes = 100;

    for (let i = 0; i < numPrototypes; i++) {
      const prototype: Record<string, any> = {};

      for (const feature of this.metadata.featureNames) {
        const featureType = this.metadata.featureTypes.find(
          ft => ft.name === feature
        );

        if (!featureType) continue;

        if (featureType.type === 'numeric') {
          const min = featureType.range?.[0] ?? 0;
          const max = featureType.range?.[1] ?? 1;
          prototype[feature] = min + Math.random() * (max - min);
        } else if (featureType.type === 'categorical') {
          const categories = featureType.categories ?? [];
          if (categories.length > 0) {
            prototype[feature] = categories[Math.floor(Math.random() * categories.length)];
          }
        } else if (featureType.type === 'boolean') {
          prototype[feature] = Math.random() > 0.5;
        }
      }

      prototypes.push(prototype);
    }

    return prototypes;
  }

  /**
   * Growing spheres method for counterfactual generation
   */
  private async growingSpheres(
    instance: Record<string, any>,
    currentPrediction: number | string,
    targetPrediction: number | string,
    predictFn: (features: Record<string, any>) => Promise<number | string>
  ): Promise<CounterfactualExplanation[]> {
    const candidates: CounterfactualExplanation[] = [];
    const maxIterations = 100;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Generate random point on sphere
      const randomPoint = this.generateRandomPoint(instance, iteration + 1);

      const prediction = await predictFn(randomPoint);

      if (prediction === targetPrediction) {
        const distance = this.calculateDistance(randomPoint, instance);
        const explanation = await this.buildExplanation(
          instance,
          randomPoint,
          currentPrediction,
          targetPrediction,
          distance
        );
        candidates.push(explanation);
        break;
      }
    }

    return candidates;
  }

  /**
   * Generate random point on sphere
   */
  private generateRandomPoint(
    center: Record<string, any>,
    radius: number
  ): Record<string, any> {
    const point: Record<string, any> = { ...center };

    for (const feature of this.metadata.featureNames) {
      const featureType = this.metadata.featureTypes.find(
        ft => ft.name === feature
      );

      if (!featureType) continue;

      if (featureType.type === 'numeric') {
        // Add Gaussian noise scaled by radius
        const noise = this.gaussianRandom() * radius;
        point[feature] += noise;

        // Clip to valid range
        const min = featureType.range?.[0] ?? 0;
        const max = featureType.range?.[1] ?? 1;
        point[feature] = Math.max(min, Math.min(max, point[feature]));
      }
    }

    return point;
  }

  /**
   * Gaussian random number
   */
  private gaussianRandom(): number {
    let u = 0;
    let v = 0;

    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Calculate distance between two instances
   */
  private calculateDistance(
    a: Record<string, any>,
    b: Record<string, any>
  ): number {
    switch (this.config.distanceMetric) {
      case 'euclidean':
        return euclideanDistance(
          this.extractNumericFeatures(a),
          this.extractNumericFeatures(b)
        );
      case 'manhattan':
        return manhattanDistance(
          this.extractNumericFeatures(a),
          this.extractNumericFeatures(b)
        );
      default:
        return euclideanDistance(
          this.extractNumericFeatures(a),
          this.extractNumericFeatures(b)
        );
    }
  }

  /**
   * Extract numeric features for distance calculation
   */
  private extractNumericFeatures(instance: Record<string, any>): number[] {
    const features: number[] = [];

    for (const feature of this.metadata.featureNames) {
      const featureType = this.metadata.featureTypes.find(
        ft => ft.name === feature
      );

      if (featureType?.type === 'numeric') {
        features.push(instance[feature] as number);
      } else if (featureType?.type === 'boolean') {
        features.push(instance[feature] === true ? 1 : 0);
      }
    }

    return features;
  }

  /**
   * Build counterfactual explanation
   */
  private async buildExplanation(
    originalInstance: Record<string, any>,
    counterfactualInstance: Record<string, any>,
    originalPrediction: number | string,
    counterfactualPrediction: number | string,
    distance: number
  ): Promise<CounterfactualExplanation> {
    const changes = this.calculateChanges(originalInstance, counterfactualInstance);

    return {
      originalInstance,
      counterfactualInstance,
      originalPrediction,
      counterfactualPrediction,
      changes,
      distance,
      validity: counterfactualPrediction === this.config.targetClass,
      proximity: this.calculateProximity(distance),
      plausibility: this.calculatePlausibility(changes),
      actionability: this.calculateActionability(changes),
    };
  }

  /**
   * Calculate changes between instances
   */
  private calculateChanges(
    original: Record<string, any>,
    counterfactual: Record<string, any>
  ): CounterfactualChange[] {
    const changes: CounterfactualChange[] = [];

    for (const feature of this.metadata.featureNames) {
      if (original[feature] !== counterfactual[feature]) {
        const featureType = this.metadata.featureTypes.find(
          ft => ft.name === feature
        );

        let magnitude = 0;
        let direction: 'increase' | 'decrease' = 'increase';

        if (featureType?.type === 'numeric') {
          const diff = (counterfactual[feature] as number) - (original[feature] as number);
          magnitude = Math.abs(diff);
          direction = diff > 0 ? 'increase' : 'decrease';
        } else {
          magnitude = 1; // Categorical change
          direction = 'increase';
        }

        changes.push({
          featureName: feature,
          originalValue: original[feature],
          counterfactualValue: counterfactual[feature],
          magnitude,
          direction,
          importance: magnitude,
        });
      }
    }

    return changes.sort((a, b) => b.magnitude - a.magnitude);
  }

  /**
   * Calculate proximity score
   */
  private calculateProximity(distance: number): number {
    // Convert distance to proximity (0-1 scale)
    return Math.max(0, 1 - distance / 10);
  }

  /**
   * Calculate plausibility score
   */
  private calculatePlausibility(changes: CounterfactualChange[]): number {
    // Plausibility based on number of changes and their magnitudes
    if (changes.length === 0) return 1.0;

    const avgMagnitude = mean(changes.map(c => c.magnitude));
    const numChanges = changes.length;

    // Fewer changes with smaller magnitudes are more plausible
    return Math.max(0, 1 - (numChanges * 0.1) - (avgMagnitude * 0.05));
  }

  /**
   * Calculate actionability score
   */
  private calculateActionability(changes: CounterfactualChange[]): ActionabilityScore {
    // Check if changes are actionable
    let totalCost = 0;
    let actionableChanges = 0;

    for (const change of changes) {
      const constraint = this.config.constraints[change.featureName];

      if (constraint?.immutable) {
        totalCost += 1000; // Very high cost for immutable features
      } else {
        actionableChanges++;
        totalCost += change.magnitude;
      }
    }

    const score = changes.length > 0 ? actionableChanges / changes.length : 1.0;
    const avgCost = changes.length > 0 ? totalCost / changes.length : 0;

    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (changes.length > 5) complexity = 'high';
    else if (changes.length > 2) complexity = 'medium';

    return {
      score,
      actionable: score > 0.5,
      cost: avgCost,
      timeToImplement: this.estimateTimeToImplement(changes),
      complexity,
    };
  }

  /**
   * Estimate time to implement changes
   */
  private estimateTimeToImplement(changes: CounterfactualChange[]): string {
    if (changes.length === 0) return 'No changes';

    if (changes.length <= 2) return 'Short-term (< 1 week)';
    if (changes.length <= 5) return 'Medium-term (1-4 weeks)';
    return 'Long-term (> 4 weeks)';
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(
    counterfactuals: CounterfactualExplanation[]
  ): string[] {
    const recommendations: string[] = [];

    if (counterfactuals.length === 0) {
      recommendations.push('No valid counterfactuals found. Consider adjusting constraints.');
      return recommendations;
    }

    const best = counterfactuals[0];

    recommendations.push(
      `To change prediction from "${best.originalPrediction}" to "${best.counterfactualPrediction}":`
    );

    for (const change of best.changes.slice(0, 5)) {
      const action = change.direction === 'increase' ? 'Increase' : 'Decrease';
      recommendations.push(
        `- ${action} ${change.featureName} from ${change.originalValue} to ${change.counterfactualValue}`
      );
    }

    if (best.actionability.actionable) {
      recommendations.push(
        `\nThese changes are considered actionable with ${best.actionability.complexity} complexity.`
      );
    } else {
      recommendations.push(
        '\nSome required changes may be difficult to implement in practice.'
      );
    }

    return recommendations;
  }
}
