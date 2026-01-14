/**
 * Bayesian Optimization for Architecture Search
 * Gaussian process-based optimization for neural architecture search
 */

import {
  Architecture,
  SearchStrategyType,
  BayesianConfig,
  SearchResult,
  SearchStatistics,
  ArchitectureEncoding,
  GaussianProcess,
  KernelConfig,
  AcquisitionFunction,
} from '../types';

// ============================================================================
// Gaussian Process
// ============================================================================

export class GaussianProcessModel {
  private kernel: KernelConfig;
  private noise: number;
  private X: number[][] = [];
  private y: number[] = [];
  private alpha: number[] = [];
  private L: number[][] = []; // Cholesky decomposition

  constructor(kernel: KernelConfig, noise: number = 1e-6) {
    this.kernel = kernel;
    this.noise = noise;
  }

  /**
   * Fit the GP to data
   */
  public fit(X: number[][], y: number[]): void {
    this.X = X;
    this.y = y;

    // Compute kernel matrix
    const K = this.computeKernelMatrix(X);

    // Add noise term
    for (let i = 0; i < K.length; i++) {
      K[i][i] += this.noise;
    }

    // Cholesky decomposition
    this.L = this.cholesky(K);

    // Solve for alpha
    this.alpha = this.solveCholesky(this.L, this.y);
  }

  /**
   * Predict mean and variance for new points
   */
  public predict(X_test: number[][]): { mean: number[]; variance: number[] } {
    const n = X_test.length;
    const mean: number[] = [];
    const variance: number[] = [];

    // Compute kernel between test and training points
    const K_star = this.computeCrossKernel(X_test, this.X);

    // Compute kernel for test points
    const K_star_star = this.computeKernelMatrix(X_test);

    for (let i = 0; i < n; i++) {
      // Predictive mean
      let mean_i = 0;
      for (let j = 0; j < K_star[i].length; j++) {
        mean_i += K_star[i][j] * this.alpha[j];
      }
      mean.push(mean_i);

      // Predictive variance
      const v = this.solveCholesky(this.L, K_star[i]);
      let variance_i = K_star_star[i][i];

      for (let j = 0; j < v.length; j++) {
        variance_i -= v[j] * v[j];
      }

      variance.push(Math.max(0, variance_i));
    }

    return { mean, variance };
  }

  /**
   * Compute kernel matrix
   */
  private computeKernelMatrix(X: number[][]): number[][] {
    const n = X.length;
    const K: number[][] = [];

    for (let i = 0; i < n; i++) {
      K[i] = [];
      for (let j = 0; j < n; j++) {
        K[i][j] = this.kernelFunction(X[i], X[j]);
      }
    }

    return K;
  }

  /**
   * Compute cross-kernel between two sets of points
   */
  private computeCrossKernel(X1: number[][], X2: number[][]): number[][] {
    const K: number[][] = [];

    for (let i = 0; i < X1.length; i++) {
      K[i] = [];
      for (let j = 0; j < X2.length; j++) {
        K[i][j] = this.kernelFunction(X1[i], X2[j]);
      }
    }

    return K;
  }

  /**
   * Kernel function
   */
  private kernelFunction(x1: number[], x2: number[]): number {
    switch (this.kernel.type) {
      case 'rbf':
        return this.rbfKernel(x1, x2);

      case 'matern':
        return this.maternKernel(x1, x2);

      case 'rational-quadratic':
        return this.rationalQuadraticKernel(x1, x2);

      default:
        return this.rbfKernel(x1, x2);
    }
  }

  /**
   * RBF (Radial Basis Function) kernel
   */
  private rbfKernel(x1: number[], x2: number[]): number {
    const lengthScale = Array.isArray(this.kernel.lengthScale)
      ? this.kernel.lengthScale
      : new Array(x1.length).fill(this.kernel.lengthScale);

    let squaredDistance = 0;
    for (let i = 0; i < x1.length; i++) {
      squaredDistance += Math.pow((x1[i] - x2[i]) / lengthScale[i], 2);
    }

    return this.kernel.variance * Math.exp(-0.5 * squaredDistance);
  }

  /**
   * Matern kernel
   */
  private maternKernel(x1: number[], x2: number[]): number {
    const nu = this.kernel.nu || 1.5;
    const lengthScale = Array.isArray(this.kernel.lengthScale)
      ? this.kernel.lengthScale
      : new Array(x1.length).fill(this.kernel.lengthScale);

    let distance = 0;
    for (let i = 0; i < x1.length; i++) {
      distance += Math.pow((x1[i] - x2[i]) / lengthScale[i], 2);
    }
    distance = Math.sqrt(distance);

    const scaledDistance = Math.sqrt(2 * nu) * distance;

    if (nu === 0.5) {
      return this.kernel.variance * Math.exp(-scaledDistance);
    } else if (nu === 1.5) {
      return (
        this.kernel.variance *
        (1 + scaledDistance) *
        Math.exp(-scaledDistance)
      );
    } else if (nu === 2.5) {
      return (
        this.kernel.variance *
        (1 + scaledDistance + (scaledDistance * scaledDistance) / 3) *
        Math.exp(-scaledDistance)
      );
    }

    return this.rbfKernel(x1, x2);
  }

  /**
   * Rational quadratic kernel
   */
  private rationalQuadraticKernel(x1: number[], x2: number[]): number {
    const lengthScale = this.kernel.lengthScale as number;
    const alpha = 1.0;

    let squaredDistance = 0;
    for (let i = 0; i < x1.length; i++) {
      squaredDistance += Math.pow(x1[i] - x2[i], 2);
    }

    return (
      this.kernel.variance *
      Math.pow(1 + squaredDistance / (2 * alpha * lengthScale * lengthScale), -alpha)
    );
  }

  /**
   * Cholesky decomposition
   */
  private cholesky(A: number[][]): number[][] {
    const n = A.length;
    const L: number[][] = [];

    for (let i = 0; i < n; i++) {
      L[i] = new Array(n).fill(0);

      for (let j = 0; j <= i; j++) {
        let sum = 0;

        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }

        if (i === j) {
          L[i][j] = Math.sqrt(A[i][i] - sum);
        } else {
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }

    return L;
  }

  /**
   * Solve using Cholesky decomposition
   */
  private solveCholesky(L: number[][], b: number[]): number[] {
    const n = L.length;
    const y: number[] = [];
    const x: number[] = [];

    // Forward substitution
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < i; j++) {
        sum += L[i][j] * y[j];
      }
      y[i] = (b[i] - sum) / L[i][i];
    }

    // Backward substitution
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += L[j][i] * x[j];
      }
      x[i] = (y[i] - sum) / L[i][i];
    }

    return x;
  }

  /**
   * Get training data
   */
  public getData(): { X: number[][]; y: number[] } {
    return { X: this.X, y: this.y };
  }

  /**
   * Get number of observations
   */
  public size(): number {
    return this.X.length;
  }
}

// ============================================================================
// Acquisition Functions
// ============================================================================

export class AcquisitionFunctionOptimizer {
  /**
   * Expected Improvement (EI)
   */
  public static expectedImprovement(
    mean: number,
    variance: number,
    bestValue: number,
    xi: number = 0.01
  ): number {
    const std = Math.sqrt(variance);
    if (std === 0) {
      return 0;
    }

    const z = (mean - bestValue - xi) / std;

    // EI = (mu - f(x_best) - xi) * Phi(z) + sigma * phi(z)
    const phi = this.standardNormalPDF(z);
    const Phi = this.standardNormalCDF(z);

    return (mean - bestValue - xi) * Phi + std * phi;
  }

  /**
   * Probability of Improvement (PI)
   */
  public static probabilityOfImprovement(
    mean: number,
    variance: number,
    bestValue: number,
    xi: number = 0.01
  ): number {
    const std = Math.sqrt(variance);
    if (std === 0) {
      return 0;
    }

    const z = (mean - bestValue - xi) / std;
    return this.standardNormalCDF(z);
  }

  /**
   * Upper Confidence Bound (UCB)
   */
  public static upperConfidenceBound(
    mean: number,
    variance: number,
    kappa: number = 2.0
  ): number {
    return mean + kappa * Math.sqrt(variance);
  }

  /**
   * Thompson Sampling
   */
  public static thompsonSampling(
    mean: number,
    variance: number
  ): number {
    return this.sampleNormal(mean, Math.sqrt(variance));
  }

  /**
   * Expected Hyperparameter Improvement
   */
  public static expectedHyperImprovement(
    mean: number,
    variance: number,
    bestValue: number,
    gamma: number = 0.1
  ): number {
    const logGamma = Math.log(gamma);
    const logDiff = Math.log(Math.max(mean - bestValue, 1e-10));

    const improvement = Math.exp(logDiff - logGamma);

    const std = Math.sqrt(variance);
    if (std === 0) {
      return 0;
    }

    const z = (mean - bestValue) / std;
    const phi = this.standardNormalPDF(z);
    const Phi = this.standardNormalCDF(z);

    return improvement * Phi + std * phi;
  }

  /**
   * Standard normal PDF
   */
  private static standardNormalPDF(x: number): number {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
  }

  /**
   * Standard normal CDF
   */
  private static standardNormalCDF(x: number): number {
    // Approximation of standard normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Sample from normal distribution
   */
  private static sampleNormal(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }

  /**
   * Maximize acquisition function
   */
  public static maximize(
    gp: GaussianProcessModel,
    acquisitionFn: AcquisitionFunction,
    bounds: number[][],
    n_samples: number = 1000
  ): { value: number; point: number[] } {
    let bestValue = -Infinity;
    let bestPoint: number[] = [];

    // Random sampling
    for (let i = 0; i < n_samples; i++) {
      const point = bounds.map(b => b[0] + Math.random() * (b[1] - b[0]));

      const { mean, variance } = gp.predict([point]);

      let acquisitionValue = 0;

      switch (acquisitionFn) {
        case 'ei':
          acquisitionValue = this.expectedImprovement(
            mean[0],
            variance[0],
            Math.max(...gp.getData().y)
          );
          break;

        case 'pi':
          acquisitionValue = this.probabilityOfImprovement(
            mean[0],
            variance[0],
            Math.max(...gp.getData().y)
          );
          break;

        case 'ucb':
          acquisitionValue = this.upperConfidenceBound(
            mean[0],
            variance[0],
            2.0
          );
          break;

        case 'thompson-sampling':
          acquisitionValue = this.thompsonSampling(mean[0], variance[0]);
          break;

        case 'expected-hyper-improvement':
          acquisitionValue = this.expectedHyperImprovement(
            mean[0],
            variance[0],
            Math.max(...gp.getData().y)
          );
          break;
      }

      if (acquisitionValue > bestValue) {
        bestValue = acquisitionValue;
        bestPoint = point;
      }
    }

    return { value: bestValue, point: bestPoint };
  }
}

// ============================================================================
// Bayesian Optimization Search
// ============================================================================

export class BayesianOptimizationSearch {
  private config: BayesianConfig;
  private gp: GaussianProcessModel;
  private evaluatedPoints: Map<string, Architecture> = new Map();
  private X: number[][] = [];
  private y: number[] = [];
  private bestArchitecture: Architecture | null = null;
  private bestValue: number = -Infinity;
  private bounds: number[][];

  constructor(config: BayesianConfig) {
    this.config = config;
    this.gp = new GaussianProcessModel(config.kernel, config.surrogate.noise);
    this.bounds = this.initializeBounds();
  }

  // ============================================================================
  // Main Search Loop
  // ============================================================================

  /**
   * Run Bayesian optimization
   */
  public async search(
    evaluate: (arch: Architecture) => Promise<Architecture>,
    encode: (arch: Architecture) => number[]
  ): Promise<SearchResult> {
    const startTime = Date.now();
    let iteration = 0;
    let evaluated = 0;

    // Initial random sampling
    const nInitial = this.config.exploration.initialSamples;
    console.log(`Performing ${nInitial} initial random evaluations...`);

    for (let i = 0; i < nInitial; i++) {
      const arch = this.sampleRandomArchitecture();
      const encoding = encode(arch);

      const evaluated = await evaluate(arch);
      const value = this.objectiveFunction(evaluated);

      this.X.push(encoding);
      this.y.push(value);
      this.evaluatedPoints.set(arch.id, evaluated);

      this.updateBest(evaluated, value);
      evaluated++;
    }

    // Fit initial GP
    this.gp.fit(this.X, this.y);

    // Main optimization loop
    while (evaluated < this.config.budget.limit && iteration < this.config.maxIterations) {
      iteration++;

      // Occasionally add random point for exploration
      if (Math.random() < this.config.exploration.randomFraction) {
        const arch = this.sampleRandomArchitecture();
        const encoding = encode(arch);

        const evaluatedArch = await evaluate(arch);
        const value = this.objectiveFunction(evaluatedArch);

        this.X.push(encoding);
        this.y.push(value);
        this.evaluatedPoints.set(arch.id, evaluatedArch);

        this.updateBest(evaluatedArch, value);
        evaluated++;
      } else {
        // Select next point using acquisition function
        const { point } = AcquisitionFunctionOptimizer.maximize(
          this.gp,
          this.config.acquisition.function,
          this.bounds,
          this.config.acquisition.samples
        );

        // Decode point to architecture
        const arch = this.decodeToArchitecture(point);
        const encoding = encode(arch);

        const evaluatedArch = await evaluate(arch);
        const value = this.objectiveFunction(evaluatedArch);

        this.X.push(encoding);
        this.y.push(value);
        this.evaluatedPoints.set(arch.id, evaluatedArch);

        this.updateBest(evaluatedArch, value);
        evaluated++;
      }

      // Update GP
      this.gp.fit(this.X, this.y);

      // Log progress
      this.logProgress(iteration, evaluated);
    }

    const duration = Date.now() - startTime;

    return {
      strategy: 'bayesian-optimization',
      iterations: iteration,
      bestArchitecture: this.bestArchitecture!,
      paretoFront: this.getParetoFront(),
      history: Array.from(this.evaluatedPoints.values()),
      statistics: this.calculateStatistics(evaluated),
      duration,
    };
  }

  // ============================================================================
  // Sampling and Decoding
  // ============================================================================

  private sampleRandomArchitecture(): Architecture {
    // Sample a random architecture (placeholder)
    const id = `arch_bo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
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
        layers: this.generateRandomLayers(),
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
        source: 'bayesian-optimization',
        tags: [],
      },
    };
  }

  private generateRandomLayers(): any[] {
    const numLayers = Math.floor(
      Math.random() * (this.config.constraints.maxLayers - this.config.constraints.minLayers)
    ) + this.config.constraints.minLayers;

    const layers = [];

    for (let i = 0; i < numLayers; i++) {
      layers.push({
        id: `layer_${i}`,
        type: 'conv2d',
        operation: 'conv3x3',
        parameters: {
          filters: [32, 64, 128, 256][Math.floor(Math.random() * 4)],
          kernelSize: [3, 5, 7][Math.floor(Math.random() * 3)],
          strides: 1,
        },
        inputs: [],
        outputs: [],
      });
    }

    return layers;
  }

  private decodeToArchitecture(encoding: number[]): Architecture {
    // Decode encoding to architecture (simplified)
    const arch = this.sampleRandomArchitecture();

    // Modify architecture based on encoding
    const numLayers = Math.floor(
      (encoding[0] + 1) / 2 *
      (this.config.constraints.maxLayers - this.config.constraints.minLayers)
    ) + this.config.constraints.minLayers;

    arch.phenotype.layers = arch.phenotype.layers.slice(0, numLayers);

    return arch;
  }

  // ============================================================================
  // Objective Function
  // ============================================================================

  private objectiveFunction(architecture: Architecture): number {
    // Multi-objective to single-objective
    const objectives = this.config.objectives;
    let value = 0;

    for (const obj of objectives) {
      const metricValue = (architecture.metrics as any)[obj.metric] || 0;

      if (obj.direction === 'maximize') {
        value += obj.weight * metricValue;
      } else {
        // For minimization, use negative or inverse
        value -= obj.weight * metricValue;
      }
    }

    return value;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private initializeBounds(): number[][] {
    // Initialize bounds for architecture encoding
    // This is simplified - in practice would depend on encoding scheme
    const encodingDim = 20; // Example encoding dimension

    return Array.from({ length: encodingDim }, () => [-1, 1]);
  }

  private updateBest(architecture: Architecture, value: number): void {
    if (value > this.bestValue) {
      this.bestArchitecture = architecture;
      this.bestValue = value;
    }
  }

  private getParetoFront(): Architecture[] {
    const architectures = Array.from(this.evaluatedPoints.values());

    // Non-dominated sorting
    const fronts = this.nonDominatedSort(architectures);

    return fronts[0] || [];
  }

  private nonDominatedSort(architectures: Architecture[]): Architecture[][] {
    const fronts: Architecture[][] = [];
    const remaining = [...architectures];

    while (remaining.length > 0) {
      const front: Architecture[] = [];

      for (const arch of remaining) {
        let dominated = false;

        for (const other of remaining) {
          if (arch !== other && this.dominates(other, arch)) {
            dominated = true;
            break;
          }
        }

        if (!dominated) {
          front.push(arch);
        }
      }

      fronts.push(front);

      // Remove front from remaining
      for (const arch of front) {
        const idx = remaining.indexOf(arch);
        if (idx !== -1) {
          remaining.splice(idx, 1);
        }
      }
    }

    return fronts;
  }

  private dominates(arch1: Architecture, arch2: Architecture): boolean {
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

  private calculateStatistics(evaluated: number): SearchStatistics {
    const architectures = Array.from(this.evaluatedPoints.values());

    return {
      totalEvaluated: evaluated,
      uniqueArchitectures: architectures.length,
      convergence: this.bestValue,
      diversity: this.calculateDiversity(architectures),
      improvementRate: this.calculateImprovementRate(),
    };
  }

  private calculateDiversity(architectures: Architecture[]): number {
    // Average pairwise distance
    let totalDistance = 0;
    let count = 0;

    const sample = architectures.slice(0, 50);

    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        totalDistance += Math.abs(
          sample[i].phenotype.layers.length - sample[j].phenotype.layers.length
        );
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }

  private calculateImprovementRate(): number {
    const values = this.y;

    if (values.length < 10) {
      return 0;
    }

    const recent = values.slice(-10);
    const earlier = values.slice(0, Math.min(10, values.length - 10));

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    return recentAvg - earlierAvg;
  }

  private logProgress(iteration: number, evaluated: number): void {
    if (iteration % 5 === 0) {
      console.log(`Iteration ${iteration}:`);
      console.log(`  Evaluated: ${evaluated}`);
      console.log(`  Best Value: ${this.bestValue.toFixed(4)}`);
      console.log(`  GP Size: ${this.gp.size()}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createBayesianConfig(
  overrides: Partial<BayesianConfig> = {}
): BayesianConfig {
  return {
    maxIterations: 100,
    populationSize: 1,
    parallelism: 1,
    budget: {
      type: 'evaluations',
      limit: 100,
      current: 0,
    },
    objectives: [
      { name: 'accuracy', metric: 'accuracy', direction: 'maximize', weight: 1.0 },
      { name: 'flops', metric: 'flops', direction: 'minimize', weight: 0.5 },
    ],
    constraints: {
      maxLayers: 20,
      minLayers: 3,
      maxParameters: 10000000,
      maxFLOPs: 1000000000,
      maxLatency: 100,
      maxMemory: 1000,
    },
    surrogate: {
      type: 'gaussian-process',
      noise: 1e-6,
      normalize: true,
    },
    acquisition: {
      function: 'ei',
      optimizeMethod: 'sampling',
      samples: 1000,
    },
    kernel: {
      type: 'rbf',
      lengthScale: 1.0,
      variance: 1.0,
    },
    exploration: {
      initialSamples: 10,
      randomFraction: 0.1,
      kappa: 2.0,
      xi: 0.01,
    },
    ...overrides,
  };
}
