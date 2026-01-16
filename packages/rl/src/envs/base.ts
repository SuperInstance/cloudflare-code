// @ts-nocheck
/**
 * Base Environment Interface
 * Gym-like environment interface for RL agents
 */

export interface Space {
  readonly shape: readonly number[];
  readonly dtype: 'float32' | 'float64' | 'int32' | 'int64' | 'bool' | 'string';
  readonly low?: number;
  readonly high?: number;
  readonly size: number;

  sample(): any;
  contains(x: any): boolean;
}

export interface BoxSpace extends Space {
  readonly shape: readonly number[];
  readonly dtype: 'float32' | 'float64' | 'int32' | 'int64';
  readonly low: number;
  readonly high: number;
}

export interface DiscreteSpace extends Space {
  readonly dtype: 'int32' | 'int64';
  readonly n: number;
}

export interface MultiDiscreteSpace extends Space {
  readonly dtype: 'int32' | 'int64';
  readonly nvec: readonly number[];
}

export interface MultiBinarySpace extends Space {
  readonly dtype: 'int32';
  readonly n: number;
}

export interface DictSpace extends Space {
  readonly spaces: Record<string, Space>;
}

export interface TupleSpace extends Space {
  readonly spaces: readonly Space[];
}

export class Box implements BoxSpace {
  readonly shape: readonly number[];
  readonly dtype: 'float32' | 'float64' | 'int32' | 'int64';
  readonly low: number;
  readonly high: number;
  readonly size: number;

  constructor(
    low: number | number[],
    high: number | number[],
    dtype: 'float32' | 'float64' | 'int32' | 'int64' = 'float32',
    shape?: readonly number[]
  ) {
    this.dtype = dtype;

    if (typeof low === 'number' && typeof high === 'number') {
      this.low = low;
      this.high = high;
      this.shape = shape || [1];
    } else {
      this.low = Array.isArray(low) ? Math.min(...low) : low;
      this.high = Array.isArray(high) ? Math.max(...high) : high;
      this.shape = shape || [Array.isArray(low) ? low.length : 1];
    }

    this.size = this.shape.reduce((a, b) => a * b, 1);
  }

  sample(): number[] {
    if (this.shape.length === 1 && this.shape[0] === 1) {
      return [this._sampleScalar()];
    }

    const result: number[] = [];
    for (let i = 0; i < this.size; i++) {
      result.push(this._sampleScalar());
    }
    return result;
  }

  private _sampleScalar(): number {
    const range = this.high - this.low;
    const random = Math.random();

    if (this.dtype === 'int32' || this.dtype === 'int64') {
      return Math.floor(random * (range + 1)) + this.low;
    }
    return random * range + this.low;
  }

  contains(x: any): boolean {
    if (!Array.isArray(x)) {
      x = [x];
    }

    if (x.length !== this.size) {
      return false;
    }

    for (const val of x) {
      if (typeof val !== 'number') return false;
      if (val < this.low || val > this.high) return false;
    }

    return true;
  }
}

export class Discrete implements DiscreteSpace {
  readonly dtype: 'int32' | 'int64' = 'int32';
  readonly n: number;
  readonly shape: readonly number[] = [1];
  readonly size: number;

  constructor(n: number) {
    if (n <= 0) {
      throw new Error(`Discrete space n must be positive, got ${n}`);
    }
    this.n = n;
    this.size = 1;
  }

  sample(): number {
    return Math.floor(Math.random() * this.n);
  }

  contains(x: any): boolean {
    return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < this.n;
  }
}

export class MultiDiscrete implements MultiDiscreteSpace {
  readonly dtype: 'int32' | 'int64' = 'int32';
  readonly nvec: readonly number[];
  readonly shape: readonly number[];
  readonly size: number;

  constructor(nvec: readonly number[]) {
    this.nvec = nvec;
    this.shape = [nvec.length];
    this.size = nvec.length;
  }

  sample(): number[] {
    return this.nvec.map(n => Math.floor(Math.random() * n));
  }

  contains(x: any): boolean {
    if (!Array.isArray(x) || x.length !== this.size) {
      return false;
    }

    for (let i = 0; i < x.length; i++) {
      if (typeof x[i] !== 'number' || !Number.isInteger(x[i])) {
        return false;
      }
      if (x[i] < 0 || x[i] >= this.nvec[i]) {
        return false;
      }
    }

    return true;
  }
}

export class MultiBinary implements MultiBinarySpace {
  readonly dtype: 'int32' = 'int32';
  readonly n: number;
  readonly shape: readonly number[] = [1];
  readonly size: number;

  constructor(n: number = 1) {
    this.n = n;
    this.size = n;
  }

  sample(): number[] {
    return Array.from({ length: this.n }, () => Math.random() < 0.5 ? 0 : 1);
  }

  contains(x: any): boolean {
    if (!Array.isArray(x) || x.length !== this.n) {
      return false;
    }

    for (const val of x) {
      if (val !== 0 && val !== 1) {
        return false;
      }
    }

    return true;
  }
}

export class Dict implements DictSpace {
  readonly dtype: 'string' = 'string';
  readonly spaces: Record<string, Space>;
  readonly shape: readonly number[] = [];
  readonly size: number;

  constructor(spaces: Record<string, Space>) {
    this.spaces = spaces;
    this.size = Object.values(spaces).reduce((sum, space) => sum + space.size, 0);
  }

  sample(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, space] of Object.entries(this.spaces)) {
      result[key] = space.sample();
    }
    return result;
  }

  contains(x: any): boolean {
    if (typeof x !== 'object' || x === null) {
      return false;
    }

    for (const [key, space] of Object.entries(this.spaces)) {
      if (!(key in x)) {
        return false;
      }
      if (!space.contains(x[key])) {
        return false;
      }
    }

    return true;
  }
}

export class Tuple implements TupleSpace {
  readonly dtype: 'string' = 'string';
  readonly spaces: readonly Space[];
  readonly shape: readonly number[] = [this.spaces.length];
  readonly size: number;

  constructor(spaces: readonly Space[]) {
    this.spaces = spaces;
    this.size = spaces.reduce((sum, space) => sum + space.size, 0);
  }

  sample(): any[] {
    return this.spaces.map(space => space.sample());
  }

  contains(x: any): boolean {
    if (!Array.isArray(x) || x.length !== this.spaces.length) {
      return false;
    }

    for (let i = 0; i < this.spaces.length; i++) {
      if (!this.spaces[i].contains(x[i])) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Base Environment Class
 * All environments should extend this class
 */
export abstract class Env<ObservationType = any, ActionType = any> {
  abstract readonly observationSpace: Space;
  abstract readonly actionSpace: Space;

  protected _metadata: Record<string, any> = {};
  protected _renderMode: 'human' | 'rgb_array' | 'ansi' | null = null;
  protected _rewardRange: [number, number] = [-Infinity, Infinity];
  protected _spec: Record<string, any> | null = null;
  protected _elapsedSteps: number = 0;

  /**
   * Reset the environment to initial state
   */
  abstract reset(options?: Record<string, any>): Promise<ObservationType> | ObservationType;

  /**
   * Step the environment forward
   */
  abstract step(action: ActionType): Promise<StepResult<ObservationType>> | StepResult<ObservationType>;

  /**
   * Render the environment (optional)
   */
  render?(mode?: 'human' | 'rgb_array' | 'ansi'): any;

  /**
   * Close the environment and cleanup resources
   */
  close?(): Promise<void> | void;

  /**
   * Get metadata about the environment
   */
  get metadata(): Record<string, any> {
    return this._metadata;
  }

  /**
   * Get the reward range
   */
  get rewardRange(): [number, number] {
    return this._rewardRange;
  }

  /**
   * Get the environment spec
   */
  get spec(): Record<string, any> | null {
    return this._spec;
  }

  /**
   * Get elapsed steps
   */
  get elapsedSteps(): number {
    return this._elapsedSteps;
  }

  /**
   * Set render mode
   */
  setRenderMode(mode: 'human' | 'rgb_array' | 'ansi' | null): void {
    this._renderMode = mode;
  }

  /**
   * Seed the random number generator
   */
  seed?(seed: number): number;

  /**
   * Unwrap nested environments
   */
  unwrap(): this {
    return this;
  }

  /**
   * Get a string representation
   */
  toString(): string {
    return `<${this.constructor.name} instance>`;
  }
}

export interface StepResult<ObservationType> {
  observation: ObservationType;
  reward: number;
  terminated: boolean;
  truncated: boolean;
  info: Record<string, any>;
}

export interface TimeStep {
  observation: any;
  reward: number | null;
  terminated: boolean;
  truncated: boolean;
}

/**
 * Environment wrapper base class
 */
export abstract class EnvWrapper<ObservationType = any, ActionType = any>
  extends Env<ObservationType, ActionType> {
  protected env: Env<ObservationType, ActionType>;

  constructor(env: Env<ObservationType, ActionType>) {
    super();
    this.env = env;
  }

  get observationSpace(): Space {
    return this.env.observationSpace;
  }

  get actionSpace(): Space {
    return this.env.actionSpace;
  }

  get metadata(): Record<string, any> {
    return this.env.metadata;
  }

  get rewardRange(): [number, number] {
    return this.env.rewardRange;
  }

  get spec(): Record<string, any> | null {
    return this.env.spec;
  }

  async reset(options?: Record<string, any>): Promise<ObservationType> {
    return this.env.reset(options);
  }

  async step(action: ActionType): Promise<StepResult<ObservationType>> {
    return this.env.step(action);
  }

  render?(mode?: 'human' | 'rgb_array' | 'ansi'): any {
    return this.env.render?.(mode);
  }

  async close?(): Promise<void> {
    return this.env.close?.();
  }

  seed?(seed: number): number {
    return this.env.seed?.(seed) ?? 0;
  }

  unwrap(): Env<ObservationType, ActionType> {
    return this.env;
  }
}

/**
 * Gym-like environment API compatibility layer
 */
export interface EnvRegistry {
  register(id: string, entryPoint: () => Env): void;
  make(id: string, options?: Record<string, any>): Env;
  list(): string[];
}

export class Registry implements EnvRegistry {
  private static instance: Registry;
  private environments: Map<string, () => Env> = new Map();

  private constructor() {}

  static getInstance(): Registry {
    if (!Registry.instance) {
      Registry.instance = new Registry();
    }
    return Registry.instance;
  }

  register(id: string, entryPoint: () => Env): void {
    if (this.environments.has(id)) {
      throw new Error(`Environment ${id} is already registered`);
    }
    this.environments.set(id, entryPoint);
  }

  make(id: string, options?: Record<string, any>): Env {
    const entryPoint = this.environments.get(id);
    if (!entryPoint) {
      throw new Error(`No registered environment with id: ${id}`);
    }
    return entryPoint();
  }

  list(): string[] {
    return Array.from(this.environments.keys());
  }
}

export const registry = Registry.getInstance();
