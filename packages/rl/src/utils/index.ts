/**
 * Utility Functions for RL
 */

/**
 * Math utilities
 */
export class MathUtils {
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  static softmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);
    return expLogits.map(e => e / sumExp);
  }

  static sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  static tanh(x: number): number {
    return Math.tanh(x);
  }

  static relu(x: number): number {
    return Math.max(0, x);
  }

  static mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  static std(values: number[]): number {
    const m = this.mean(values);
    return Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length);
  }

  static variance(values: number[]): number {
    const m = this.mean(values);
    return values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
  }

  static normalize(values: number[]): number[] {
    const m = this.mean(values);
    const s = this.std(values);
    return values.map(v => (v - m) / (s + 1e-8));
  }

  static normalizeMinMax(values: number[]): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    return values.map(v => range > 0 ? (v - min) / range : 0);
  }

  static argmax(values: number[]): number {
    let maxIdx = 0;
    let maxVal = values[0];

    for (let i = 1; i < values.length; i++) {
      if (values[i] > maxVal) {
        maxVal = values[i];
        maxIdx = i;
      }
    }

    return maxIdx;
  }

  static argmin(values: number[]): number {
    let minIdx = 0;
    let minVal = values[0];

    for (let i = 1; i < values.length; i++) {
      if (values[i] < minVal) {
        minVal = values[i];
        minIdx = i;
      }
    }

    return minIdx;
  }

  static sampleCategorical(probs: number[]): number {
    const rand = Math.random();
    let cumulative = 0;

    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (rand <= cumulative) {
        return i;
      }
    }

    return probs.length - 1;
  }

  static sampleNormal(mean: number = 0, std: number = 1): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }

  static sampleUniform(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}

/**
 * Array utilities
 */
export class ArrayUtils {
  static shuffle<T>(array: T[]): T[] {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }

    return chunks;
  }

  static sample<T>(array: T[], size: number): T[] {
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, size);
  }

  static sampleOne<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  static flatten<T>(arrays: T[][]): T[] {
    return arrays.reduce((flat, arr) => [...flat, ...arr], []);
  }

  static zip<T, U>(arrays1: T[], arrays2: U[]): [T, U][] {
    return arrays1.map((val, i) => [val, arrays2[i]]);
  }

  static unique<T>(array: T[]): T[] {
    return Array.from(new Set(array));
  }

  static groupBy<T>(array: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();

    for (const item of array) {
      const key = keyFn(item);
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }

    return groups;
  }
}

/**
 * Random utilities
 */
export class RandomUtils {
  private static seed: number = Date.now();

  static setSeed(seed: number): void {
    RandomUtils.seed = seed;
  }

  static random(): number {
    // Simple LCG random number generator
    RandomUtils.seed = (RandomUtils.seed * 1664525 + 1013904223) % 4294967296;
    return RandomUtils.seed / 4294967296;
  }

  static randInt(min: number, max: number): number {
    return Math.floor(RandomUtils.random() * (max - min + 1)) + min;
  }

  static randFloat(min: number, max: number): number {
    return RandomUtils.random() * (max - min) + min;
  }

  static randomChoice<T>(array: T[]): T {
    return array[RandomUtils.randInt(0, array.length - 1)];
  }
}

/**
 * State utilities
 */
export class StateUtils {
  static toVector(state: any): number[] {
    if (Array.isArray(state)) {
      return state as number[];
    }

    if (typeof state === 'number') {
      return [state];
    }

    if (typeof state === 'object' && state !== null) {
      return Object.values(state).flat() as number[];
    }

    return [];
  }

  static fromVector(vector: number[], template: any): any {
    if (Array.isArray(template)) {
      return vector;
    }

    if (typeof template === 'number') {
      return vector[0];
    }

    if (typeof template === 'object' && template !== null) {
      const keys = Object.keys(template);
      const result: Record<string, any> = {};
      let idx = 0;

      for (const key of keys) {
        const templateValue = (template as Record<string, any>)[key];

        if (Array.isArray(templateValue)) {
          const length = templateValue.length;
          result[key] = vector.slice(idx, idx + length);
          idx += length;
        } else if (typeof templateValue === 'number') {
          result[key] = vector[idx];
          idx++;
        } else {
          result[key] = templateValue;
        }
      }

      return result;
    }

    return vector;
  }

  static equals(state1: any, state2: any): boolean {
    const vec1 = this.toVector(state1);
    const vec2 = this.toVector(state2);

    if (vec1.length !== vec2.length) {
      return false;
    }

    for (let i = 0; i < vec1.length; i++) {
      if (Math.abs(vec1[i] - vec2[i]) > 1e-6) {
        return false;
      }
    }

    return true;
  }

  static hash(state: any): string {
    const vec = this.toVector(state);
    return vec.map(v => Math.round(v * 1000) / 1000).join(',');
  }
}

/**
 * Time utilities
 */
export class TimeUtils {
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  static timestamp(): number {
    return Date.now();
  }

  static elapsed(start: number): number {
    return Date.now() - start;
  }
}

/**
 * Logging utilities
 */
export class Logger {
  private level: 'debug' | 'info' | 'warn' | 'error';
  private prefix: string;

  constructor(prefix: string = '', level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.prefix = prefix;
    this.level = level;
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${this.prefix}`, ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${this.prefix}`, ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${this.prefix}`, ...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${this.prefix}`, ...args);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }
}

/**
 * Progress bar utility
 */
export class ProgressBar {
  private total: number;
  private current: number = 0;
  private width: number = 50;
  private lastUpdate: number = 0;

  constructor(total: number) {
    this.total = total;
  }

  update(progress: number): void {
    this.current = Math.floor(progress);
    this.render();
  }

  increment(amount: number = 1): void {
    this.current += amount;
    this.render();
  }

  private render(): void {
    const now = Date.now();

    // Limit update frequency
    if (now - this.lastUpdate < 100 && this.current < this.total) {
      return;
    }

    this.lastUpdate = now;

    const percentage = this.current / this.total;
    const filled = Math.floor(this.width * percentage);
    const empty = this.width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentageStr = (percentage * 100).toFixed(1);

    process.stdout.write(`\r[${bar}] ${percentageStr}% (${this.current}/${this.total})`);

    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  complete(): void {
    this.current = this.total;
    this.render();
  }
}

/**
 * Configuration utilities
 */
export class ConfigUtils {
  static merge<T>(...configs: Partial<T>[]): T {
    const result: any = {};

    for (const config of configs) {
      if (config && typeof config === 'object') {
        for (const [key, value] of Object.entries(config)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = this.merge(result[key] ?? {}, value);
          } else {
            result[key] = value;
          }
        }
      }
    }

    return result as T;
  }

  static validate<T>(config: any, schema: Record<string, any>): boolean {
    for (const [key, validator] of Object.entries(schema)) {
      if (!(key in config)) {
        return false;
      }

      if (typeof validator === 'function') {
        if (!validator(config[key])) {
          return false;
        }
      } else if (typeof validator === 'object') {
        if (!this.validate(config[key], validator)) {
          return false;
        }
      }
    }

    return true;
  }

  static getDefaultConfig<T>(defaults: T): T {
    return defaults;
  }
}

/**
 * File I/O utilities
 */
export class FileUtils {
  static async exists(path: string): Promise<boolean> {
    // In production, would check if file exists
    return false;
  }

  static async read(path: string): Promise<string> {
    // In production, would read file
    return '';
  }

  static async write(path: string, content: string): Promise<void> {
    // In production, would write file
  }

  static async mkdir(path: string): Promise<void> {
    // In production, would create directory
  }

  static async rm(path: string): Promise<void> {
    // In production, would remove file
  }
}
