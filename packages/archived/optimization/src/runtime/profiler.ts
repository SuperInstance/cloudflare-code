// @ts-nocheck
/**
 * Runtime Performance Profiler
 *
 * Profiles runtime performance to identify optimization opportunities
 */

import { RuntimeProfile, RuntimeOptimizationConfig, HotPathAnalysis, OptimizationSuggestion } from '../types/index.js';

export class RuntimeProfiler {
  private profiles: Map<string, RuntimeProfile> = new Map();
  private callStack: string[] = [];
  private config: RuntimeOptimizationConfig;
  private memoCache: Map<string, Map<any, any>> = new Map();

  constructor(config: Partial<RuntimeOptimizationConfig> = {}) {
    this.config = {
      enableProfiling: true,
      enableMemoization: true,
      enableDebouncing: true,
      enableThrottling: true,
      hotPathThreshold: 100,
      memoizationCacheSize: 1000,
      debounceWait: 100,
      throttleWait: 16,
      ...config,
    };
  }

  /**
   * Profile a function execution
   */
  profile<T extends (...args: any[]) => any>(fn: T, name?: string): T {
    if (!this.config.enableProfiling) {
      return fn;
    }

    const fnName = name || fn.name || 'anonymous';

    return ((...args: any[]) => {
      const start = performance.now();
      this.callStack.push(fnName);

      try {
        const result = fn(...args);
        const end = performance.now();

        if (result instanceof Promise) {
          return result.finally(() => {
            this.recordProfile(fnName, end - start);
            this.callStack.pop();
          });
        }

        this.recordProfile(fnName, end - start);
        this.callStack.pop();
        return result;
      } catch (error) {
        const end = performance.now();
        this.recordProfile(fnName, end - start);
        this.callStack.pop();
        throw error;
      }
    }) as T;
  }

  /**
   * Record profile data
   */
  private recordProfile(functionName: string, duration: number): void {
    let profile = this.profiles.get(functionName);

    if (!profile) {
      profile = {
        functionName,
        callCount: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        selfTime: 0,
        isHotPath: false,
      };
      this.profiles.set(functionName, profile);
    }

    profile.callCount++;
    profile.totalTime += duration;
    profile.avgTime = profile.totalTime / profile.callCount;
    profile.minTime = Math.min(profile.minTime, duration);
    profile.maxTime = Math.max(profile.maxTime, duration);
    profile.selfTime += duration;
    profile.isHotPath = profile.avgTime > this.config.hotPathThreshold;
  }

  /**
   * Get all profiles
   */
  getProfiles(): RuntimeProfile[] {
    return Array.from(this.profiles.values()).sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Get profile for a specific function
   */
  getProfile(functionName: string): RuntimeProfile | undefined {
    return this.profiles.get(functionName);
  }

  /**
   * Get hot paths (functions with high execution time)
   */
  getHotPaths(): RuntimeProfile[] {
    return Array.from(this.profiles.values())
      .filter(p => p.isHotPath)
      .sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Analyze hot paths and generate optimization suggestions
   */
  analyzeHotPaths(): HotPathAnalysis[] {
    const hotPaths = this.getHotPaths();
    const analyses: HotPathAnalysis[] = [];

    for (const hotPath of hotPaths) {
      const suggestions = this.generateOptimizationSuggestions(hotPath);

      analyses.push({
        functionName: hotPath.functionName,
        filePath: 'unknown', // Would need source map
        lineNumber: 0,
        executionTime: hotPath.avgTime,
        callCount: hotPath.callCount,
        percentage: (hotPath.totalTime / this.getTotalExecutionTime()) * 100,
        optimizations: suggestions,
      });
    }

    return analyses;
  }

  /**
   * Generate optimization suggestions for a function
   */
  private generateOptimizationSuggestions(profile: RuntimeProfile): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // High call count + moderate time = memoization candidate
    if (profile.callCount > 100 && profile.avgTime > 1) {
      suggestions.push({
        functionName: profile.functionName,
        suggestionType: 'memoization',
        description: 'Function called frequently with moderate execution time. Consider memoization.',
        expectedImprovement: Math.min(80, (profile.callCount / 100) * 50),
        codeBefore: `${profile.functionName}(args) {
  // Expensive computation
  return compute(args);
}`,
        codeAfter: `const memoized${this.capitalize(profile.functionName)} = memoize(${profile.functionName});

// Or manually:
const cache = new Map();
function ${profile.functionName}(args) {
  const key = JSON.stringify(args);
  if (cache.has(key)) {
    return cache.get(key);
  }
  const result = compute(args);
  cache.set(key, result);
  return result;
}`,
      });
    }

    // High execution time = algorithm optimization candidate
    if (profile.avgTime > 50) {
      suggestions.push({
        functionName: profile.functionName,
        suggestionType: 'algorithm',
        description: 'Function has high execution time. Consider algorithmic optimization.',
        expectedImprovement: Math.min(90, (profile.avgTime / 50) * 30),
        codeBefore: `${profile.functionName}(arr) {
  // O(n²) algorithm
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      // ...
    }
  }
}`,
        codeAfter: `${profile.functionName}(arr) {
  // O(n) algorithm using Map/Set
  const seen = new Set();
  for (const item of arr) {
    if (!seen.has(item)) {
      seen.add(item);
      // ...
    }
  }
}`,
      });
    }

    // Very high call count = caching candidate
    if (profile.callCount > 1000) {
      suggestions.push({
        functionName: profile.functionName,
        suggestionType: 'caching',
        description: 'Function called very frequently. Consider caching results.',
        expectedImprovement: Math.min(95, (profile.callCount / 1000) * 40),
        codeBefore: `function ${profile.functionName}(id) {
  return fetchDataFromAPI(id);
}`,
        codeAfter: `const cache = new LRUCache({ max: 1000 });

async function ${profile.functionName}(id) {
  if (cache.has(id)) {
    return cache.get(id);
  }
  const result = await fetchDataFromAPI(id);
  cache.set(id, result);
  return result;
}`,
      });
    }

    return suggestions;
  }

  /**
   * Memoize a function
   */
  memoize<T extends (...args: any[]) => any>(fn: T, cacheKeyGenerator?: (...args: Parameters<T>) => string): T {
    if (!this.config.enableMemoization) {
      return fn;
    }

    const cache = new Map<string, ReturnType<T>>();
    const fnName = fn.name || 'memoized';

    this.memoCache.set(fnName, cache as Map<any, any>);

    return ((...args: Parameters<T>) => {
      const key = cacheKeyGenerator
        ? cacheKeyGenerator(...args)
        : JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = fn(...args);

      // Limit cache size
      if (cache.size >= this.config.memoizationCacheSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(key, result);
      return result;
    }) as T;
  }

  /**
   * Debounce a function
   */
  debounce<T extends (...args: any[]) => any>(fn: T, wait?: number): T & { cancel: () => void } {
    if (!this.config.enableDebouncing) {
      return Object.assign(fn, { cancel: () => {} });
    }

    const timeout = wait ?? this.config.debounceWait;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const debounced = ((...args: Parameters<T>) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        fn(...args);
        timeoutId = null;
      }, timeout);
    }) as T & { cancel: () => void };

    debounced.cancel = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return debounced;
  }

  /**
   * Throttle a function
   */
  throttle<T extends (...args: any[]) => any>(fn: T, wait?: number): T & { cancel: () => void } {
    if (!this.config.enableThrottling) {
      return Object.assign(fn, { cancel: () => {} });
    }

    const timeout = wait ?? this.config.throttleWait;
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const throttled = ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= timeout) {
        lastCall = now;
        fn(...args);
      } else if (timeoutId === null) {
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          fn(...args);
          timeoutId = null;
        }, timeout - timeSinceLastCall);
      }
    }) as T & { cancel: () => void };

    throttled.cancel = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return throttled;
  }

  /**
   * Get total execution time across all profiles
   */
  private getTotalExecutionTime(): number {
    let total = 0;
    for (const profile of this.profiles.values()) {
      total += profile.totalTime;
    }
    return total;
  }

  /**
   * Clear all profiles
   */
  clearProfiles(): void {
    this.profiles.clear();
  }

  /**
   * Clear memoization caches
   */
  clearMemoCache(): void {
    this.memoCache.clear();
  }

  /**
   * Get profiling statistics
   */
  getStats(): {
    totalFunctions: number;
    totalCalls: number;
    totalTime: number;
    avgTimePerCall: number;
    hotPathCount: number;
  } {
    const profiles = Array.from(this.profiles.values());
    const totalCalls = profiles.reduce((sum, p) => sum + p.callCount, 0);
    const totalTime = profiles.reduce((sum, p) => sum + p.totalTime, 0);

    return {
      totalFunctions: profiles.length,
      totalCalls,
      totalTime,
      avgTimePerCall: totalCalls > 0 ? totalTime / totalCalls : 0,
      hotPathCount: profiles.filter(p => p.isHotPath).length,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RuntimeOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RuntimeOptimizationConfig {
    return { ...this.config };
  }

  /**
   * Generate flame graph data
   */
  generateFlameGraph(): Array<{
    name: string;
    value: number;
    children: Array<{ name: string; value: number }>;
  }> {
    const profiles = this.getProfiles().slice(0, 20);

    return profiles.map(profile => ({
      name: profile.functionName,
      value: profile.totalTime,
      children: [],
    }));
  }

  /**
   * Capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default RuntimeProfiler;
