/**
 * ClaudeFlare Performance Benchmarks - Ultra-Optimized
 * Lightweight performance testing utilities
 */

export interface BenchmarkResult {
  name: string;
  time: number;
  memory: number;
  success: boolean;
  error?: string;
}

// Ultra-optimized benchmark runner
export class Benchmark {
  private results: BenchmarkResult[] = [];

  run(name: string, fn: () => void): void {
    const start = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      fn();
      this.results.push({
        name,
        time: performance.now() - start,
        memory: this.getMemoryUsage() - startMemory,
        success: true
      });
    } catch (error) {
      this.results.push({
        name,
        time: performance.now() - start,
        memory: this.getMemoryUsage() - startMemory,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private getMemoryUsage(): number {
    return (performance as any).memory?.usedJSHeapSize || 0;
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  report(): void {
    this.results.forEach(r => {
      const status = r.success ? '✓' : '✗';
      console.log(`${status} ${r.name}: ${r.time.toFixed(2)}ms (${r.memory.toFixed(2)}MB)`);
      if (!r.success) console.log(`  Error: ${r.error}`);
    });
  }
}

// Simplified benchmarks
export const benchmarks = {
  requirementAnalysis: (benchmark: Benchmark) => {
    benchmark.run('analyze-requirements', () => {
      const { analyzeRequirements } = require('@claudeflare/factory-core');
      analyzeRequirements('Build a social media app with React and Node.js');
    });
  },

  projectGeneration: (benchmark: Benchmark) => {
    benchmark.run('generate-project', () => {
      const { generateProject } = require('@claudeflare/factory-core');
      generateProject({ name: 'test', description: 'Test', type: 'saas' });
    });
  },

  pricingCalculation: (benchmark: Benchmark) => {
    benchmark.run('pricing-calc', () => {
      const { pricingCalculator } = require('@claudeflare/business-core');
      for (let i = 0; i < 1000; i++) {
        pricingCalculator.calculateCost(Math.random() * 20, Math.random() * 50);
      }
    });
  }
};

// Quick benchmark runner
export function runBenchmarks(): void {
  const benchmark = new Benchmark();
  console.log('ClaudeFlare Performance Benchmarks\n');

  benchmarks.requirementAnalysis(benchmark);
  benchmarks.projectGeneration(benchmark);
  benchmarks.pricingCalculation(benchmark);

  benchmark.report();
}

export { Benchmark, benchmarks, runBenchmarks };
export default runBenchmarks;