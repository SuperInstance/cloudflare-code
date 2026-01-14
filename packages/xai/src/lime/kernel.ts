/**
 * LIME Kernel Functions
 * Various kernel functions for LIME's weighted linear regression
 */

export interface KernelFunction {
  (distance: number): number;
}

export class LIMEKernel {
  /**
   * Exponential kernel (default LIME kernel)
   * K(x) = exp(-D(x)^2 / kernel_width^2)
   */
  static exponential(kernelWidth: number = 0.75): KernelFunction {
    return (distance: number): number => {
      return Math.sqrt(Math.exp(-(distance * distance) / (kernelWidth * kernelWidth)));
    };
  }

  /**
   * Gaussian kernel
   * K(x) = exp(-D(x)^2 / (2 * sigma^2))
   */
  static gaussian(sigma: number = 1.0): KernelFunction {
    return (distance: number): number => {
      return Math.exp(-(distance * distance) / (2 * sigma * sigma));
    };
  }

  /**
   * Epanechnikov kernel
   * K(x) = max(0, 1 - D(x)^2)
   */
  static epanechnikov(): KernelFunction {
    return (distance: number): number => {
      return Math.max(0, 1 - distance * distance);
    };
  }

  /**
   * Triangular kernel
   * K(x) = max(0, 1 - |D(x)|)
   */
  static triangular(): KernelFunction {
    return (distance: number): number => {
      return Math.max(0, 1 - Math.abs(distance));
    };
  }

  /**
   * Uniform kernel
   * K(x) = 1 if |D(x)| <= 1, else 0
   */
  static uniform(): KernelFunction {
    return (distance: number): number => {
      return Math.abs(distance) <= 1 ? 1 : 0;
    };
  }

  /**
   * Cosine kernel
   * K(x) = (pi/4) * cos((pi/2) * D(x)) if |D(x)| <= 1, else 0
   */
  static cosine(): KernelFunction {
    return (distance: number): number => {
      if (Math.abs(distance) > 1) return 0;
      return (Math.PI / 4) * Math.cos((Math.PI / 2) * distance);
    };
  }

  /**
   * Linear kernel
   * K(x) = max(0, 1 - |D(x)|)
   */
  static linear(): KernelFunction {
    return (distance: number): number => {
      return Math.max(0, 1 - Math.abs(distance));
    };
  }

  /**
   * Quartic (biweight) kernel
   * K(x) = (15/16) * (1 - D(x)^2)^2
   */
  static quartic(): KernelFunction {
    return (distance: number): number => {
      const d = distance * distance;
      if (d > 1) return 0;
      return (15 / 16) * Math.pow(1 - d, 2);
    };
  }

  /**
   * Triweight kernel
   * K(x) = (35/32) * (1 - D(x)^2)^3
   */
  static triweight(): KernelFunction {
    return (distance: number): number => {
      const d = distance * distance;
      if (d > 1) return 0;
      return (35 / 32) * Math.pow(1 - d, 3);
    };
  }

  /**
   * Tricube kernel
   * K(x) = (70/81) * (1 - |D(x)|^3)^3
   */
  static tricube(): KernelFunction {
    return (distance: number): number => {
      const d = Math.abs(distance);
      if (d > 1) return 0;
      return (70 / 81) * Math.pow(1 - Math.pow(d, 3), 3);
    };
  }

  /**
   * Silverman kernel
   * K(x) = 0.5 * exp(-|D(x)| / sqrt(2)) * sin(|D(x)| / sqrt(2) + pi/4)
   */
  static silverman(): KernelFunction {
    return (distance: number): number => {
      const d = Math.abs(distance);
      const sqrt2 = Math.sqrt(2);
      return 0.5 * Math.exp(-d / sqrt2) * Math.sin(d / sqrt2 + Math.PI / 4);
    };
  }

  /**
   * Get kernel function by name
   */
  static getKernel(name: string, params: Record<string, number> = {}): KernelFunction {
    switch (name.toLowerCase()) {
      case 'exponential':
        return this.exponential(params.width ?? 0.75);
      case 'gaussian':
        return this.gaussian(params.sigma ?? 1.0);
      case 'epanechnikov':
        return this.epanechnikov();
      case 'triangular':
        return this.triangular();
      case 'uniform':
        return this.uniform();
      case 'cosine':
        return this.cosine();
      case 'linear':
        return this.linear();
      case 'quartic':
      case 'biweight':
        return this.quartic();
      case 'triweight':
        return this.triweight();
      case 'tricube':
        return this.tricube();
      case 'silverman':
        return this.silverman();
      default:
        return this.exponential(params.width ?? 0.75);
    }
  }

  /**
   * Calculate kernel weights for distances
   */
  static calculateWeights(
    distances: number[],
    kernelFn: KernelFunction
  ): number[] {
    return distances.map(d => kernelFn(d));
  }

  /**
   * Normalize weights to sum to 1
   */
  static normalizeWeights(weights: number[]): number[] {
    const sum = weights.reduce((s, w) => s + w, 0);
    if (sum === 0) {
      // Return uniform weights if sum is zero
      return weights.map(() => 1 / weights.length);
    }
    return weights.map(w => w / sum);
  }

  /**
   * Calculate optimal kernel width based on data
   */
  static calculateOptimalKernelWidth(
    distances: number[],
    percentile: number = 50
  ): number {
    // Use median distance as default kernel width
    const sortedDistances = [...distances].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sortedDistances.length);
    const medianDistance = sortedDistances[Math.min(index, sortedDistances.length - 1)];

    // Kernel width is typically set to a multiple of median distance
    return medianDistance * Math.sqrt(distances.length);
  }

  /**
   * Adaptive kernel width based on local density
   */
  static calculateAdaptiveKernelWidth(
    distances: number[],
    kNearestNeighbors: number = 10
  ): number[] {
    const kernelWidths: number[] = [];

    for (let i = 0; i < distances.length; i++) {
      // Find k nearest neighbors
      const sortedDistances = [...distances].sort((a, b) => Math.abs(a - distances[i]) - Math.abs(b - distances[i]));
      const kNearest = sortedDistances.slice(1, kNearestNeighbors + 1);

      // Use mean distance to k nearest neighbors as kernel width
      const kernelWidth = kNearest.reduce((sum, d) => sum + Math.abs(d - distances[i]), 0) / kNearest.length;
      kernelWidths.push(kernelWidth);
    }

    return kernelWidths;
  }

  /**
   * Evaluate kernel quality metrics
   */
  static evaluateKernel(
    weights: number[],
    distances: number[]
  ): {
    effectiveSamples: number;
    concentration: number;
    sparsity: number;
  } {
    // Effective sample size
    const sumWeights = weights.reduce((s, w) => s + w, 0);
    const sumSquaredWeights = weights.reduce((s, w) => s + w * w, 0);
    const effectiveSamples = sumWeights * sumWeights / sumSquaredWeights;

    // Concentration (how concentrated weights are near the origin)
    const weightedDistances = weights.reduce((sum, w, i) => sum + w * distances[i], 0);
    const concentration = weightedDistances / sumWeights;

    // Sparsity (proportion of weights that are negligible)
    const threshold = 0.01 * Math.max(...weights);
    const negligibleCount = weights.filter(w => w < threshold).length;
    const sparsity = negligibleCount / weights.length;

    return {
      effectiveSamples,
      concentration,
      sparsity,
    };
  }

  /**
   * Compare different kernel functions
   */
  static compareKernels(
    distances: number[]
  ): Map<string, { weights: number[]; metrics: any }> {
    const results = new Map();

    const kernels = [
      { name: 'exponential', fn: this.exponential(0.75) },
      { name: 'gaussian', fn: this.gaussian(1.0) },
      { name: 'epanechnikov', fn: this.epanechnikov() },
      { name: 'triangular', fn: this.triangular() },
      { name: 'uniform', fn: this.uniform() },
      { name: 'quartic', fn: this.quartic() },
    ];

    for (const kernel of kernels) {
      const weights = this.calculateWeights(distances, kernel.fn);
      const normalizedWeights = this.normalizeWeights(weights);
      const metrics = this.evaluateKernel(normalizedWeights, distances);

      results.set(kernel.name, {
        weights: normalizedWeights,
        metrics,
      });
    }

    return results;
  }

  /**
   * Generate kernel recommendation
   */
  static recommendKernel(
    distances: number[],
    criteria: 'accuracy' | 'efficiency' | 'stability' = 'accuracy'
  ): string {
    if (criteria === 'efficiency') {
      // Uniform kernel is most efficient
      return 'uniform';
    } else if (criteria === 'stability') {
      // Epanechnikov provides good stability
      return 'epanechnikov';
    } else {
      // Exponential provides good accuracy
      return 'exponential';
    }
  }
}
