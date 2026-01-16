/**
 * State Machine Engine
 * Core engine for state machine definition, transition management, and execution
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  State,
  StateContext,
  StateDefinition,
  StateMachineConfig,
  StateMachineDefinition,
  StateMachineEvents,
  StateMachineError,
  StateTransitionEvent,
  Transition,
  TransitionError,
  GuardError,
  ActionError,
  StateMachineSnapshot,
} from '../types/index.js';

/**
 * State machine engine class
 */
export class StateMachineEngine<TData = any> {
  protected definition: StateMachineDefinition<TData>;
  private currentState: State;
  private stateHistory: State[] = [];
  private stateStack: Map<State, State[]> = new Map();
  private activeStates: Set<State> = new Set();
  private emitter: EventEmitter;
  private config: Required<StateMachineConfig<TData>>;
  private metrics: Map<string, any> = new Map();
  private stateTimers: Map<State, number> = new Map();
  private isDestroyed: boolean = false;
  private transitionQueue: Array<() => Promise<any>> = [];
  private processingTransition: boolean = false;
  private contextData?: TData;
  private metadata: Record<string, any> = {};

  constructor(config: StateMachineConfig<TData>) {
    this.config = this.normalizeConfig(config);
    this.definition = this.config.definition;
    this.emitter = this.config.emitter || new EventEmitter();
    this.contextData = this.definition.context;
    this.metadata = this.definition.metadata || {};

    // Validate definition
    this.validateDefinition(this.definition);

    // Set initial state
    this.currentState = this.definition.initial;
    this.stateHistory.push(this.currentState);
    this.activeStates.add(this.currentState);

    // Auto-start if enabled
    if (this.config.autoStart) {
      this.enterState(this.currentState);
    }

    this.initializeMetrics();
  }

  /**
   * Get current state
   */
  get state(): State {
    return this.currentState;
  }

  /**
   * Get state history
   */
  get history(): readonly State[] {
    return [...this.stateHistory];
  }

  /**
   * Get all active states (including parallel states)
   */
  get active(): readonly State[] {
    return [...this.activeStates];
  }

  /**
   * Get context data
   */
  get context(): TData | undefined {
    return this.contextData;
  }

  /**
   * Set context data
   */
  set context(data: TData | undefined) {
    this.contextData = data;
  }

  /**
   * Get machine ID
   */
  get id(): string {
    return this.definition.id || uuidv4();
  }

  /**
   * Get machine version
   */
  get version(): string {
    return this.definition.version || '1.0.0';
  }

  /**
   * Check if machine is in a specific state
   */
  isIn(state: State): boolean {
    return this.currentState === state;
  }

  /**
   * Check if machine can transition on an event
   */
  can(event: string): boolean {
    const transitions = this.getAvailableTransitions(this.currentState, event);
    return transitions.length > 0;
  }

  /**
   * Get available transitions from current state
   */
  getAvailableTransitions(from: State, event: string): Transition<TData>[] {
    const transitions: Transition<TData>[] = [];
    const stateDef = this.definition.states[from];

    if (stateDef?.transitions) {
      for (const transition of stateDef.transitions) {
        if (transition.on === event && this.matchesSource(transition.from, from)) {
          transitions.push(transition);
        }
      }
    }

    // Check global transitions
    if (this.definition.transitions) {
      for (const transition of this.definition.transitions) {
        if (transition.on === event && this.matchesSource(transition.from, from)) {
          transitions.push(transition);
        }
      }
    }

    // Sort by priority (descending)
    return transitions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Send an event to trigger a transition
   */
  async send(event: string, payload?: any): Promise<any> {
    if (this.isDestroyed) {
      throw new StateMachineError('Cannot send event: machine is destroyed', 'MACHINE_DESTROYED');
    }

    const transitionPromise = this.executeTransition(event, payload);

    // Queue transition if max parallel reached
    if (this.transitionQueue.length >= this.config.maxParallelTransitions) {
      return new Promise((resolve, reject) => {
        this.transitionQueue.push(async () => {
          try {
            const result = await transitionPromise;
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    return transitionPromise;
  }

  /**
   * Execute a state transition
   */
  private async executeTransition(event: string, payload?: any): Promise<any> {
    if (this.processingTransition) {
      throw new StateMachineError('Transition already in progress', 'TRANSITION_IN_PROGRESS');
    }

    this.processingTransition = true;
    const startTime = performance.now();
    const previousState = this.currentState;

    try {
      // Create context
      const context: StateContext<TData> = {
        current: this.currentState,
        previous: this.stateHistory[this.stateHistory.length - 2],
        event,
        payload,
        data: this.contextData,
        metadata: this.metadata,
        timestamp: Date.now(),
      };

      // Emit transition start
      this.emitter.emit('transition:start', context);

      // Find matching transitions
      const transitions = this.getAvailableTransitions(this.currentState, event);

      if (transitions.length === 0) {
        throw new TransitionError(
          `No transition found for event '${event}' from state '${this.currentState}'`,
          context,
          this.currentState,
          undefined,
          event
        );
      }

      // Try transitions in priority order
      let executedTransition = false;
      let result: any;

      for (const transition of transitions) {
        // Check guard
        if (transition.guard) {
          const guardResult = await this.executeGuard(transition.guard, context);
          if (!guardResult) {
            if (this.config.enableLogging) {
              this.log('Guard failed', { transition, context });
            }
            this.emitter.emit('guard:fail', context);
            continue;
          }
        }

        // Execute before actions
        if (transition.before) {
          await this.executeActions(transition.before, context);
        }

        // Exit current state
        await this.exitState(this.currentState, context);

        // Save history for hierarchical states
        if (this.definition.states[this.currentState]?.history) {
          this.saveHistory(this.currentState, previousState);
        }

        // Execute transition action
        if (transition.action) {
          result = await this.executeAction(transition.action, context);
        }

        // Transition to new state
        const newState = transition.to;
        this.currentState = newState;
        this.stateHistory.push(newState);
        this.activeStates.add(newState);

        // Update state timer
        if (this.stateTimers.has(this.currentState)) {
          const entryTime = this.stateTimers.get(this.currentState)!;
          const duration = performance.now() - entryTime;
          this.updateStateMetrics(this.currentState, duration);
        }

        // Enter new state
        await this.enterState(newState, context);

        // Execute after actions
        if (transition.after) {
          await this.executeActions(transition.after, context);
        }

        executedTransition = true;

        // Emit transition end
        const duration = performance.now() - startTime;
        const transitionEvent: StateTransitionEvent<TData> = {
          from: previousState,
          to: newState,
          event,
          payload,
          result,
          duration,
          timestamp: Date.now(),
          context: this.contextData,
          metadata: transition.metadata,
        };

        this.emitter.emit('transition:end', transitionEvent);
        this.emitter.emit('state:change', transitionEvent);

        // Update metrics
        this.updateTransitionMetrics(event, previousState, newState, duration);

        break;
      }

      if (!executedTransition) {
        throw new TransitionError(
          `All transitions failed for event '${event}' from state '${this.currentState}'`,
          context,
          this.currentState,
          undefined,
          event
        );
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const context: StateContext<TData> = {
        current: this.currentState,
        event,
        payload,
        timestamp: Date.now(),
      };

      this.emitter.emit('transition:error', error as Error, context);
      this.updateErrorMetrics(event, duration);

      throw error;
    } finally {
      this.processingTransition = false;

      // Process queued transitions
      if (this.transitionQueue.length > 0) {
        const next = this.transitionQueue.shift();
        if (next) {
          next().catch(err => this.log('Queued transition error', err));
        }
      }
    }
  }

  /**
   * Enter a state
   */
  private async enterState(state: State, context?: StateContext<TData>): Promise<void> {
    const stateDef = this.definition.states[state];
    if (!stateDef) {
      throw new StateMachineError(`State '${state}' not found`, 'STATE_NOT_FOUND');
    }

    // Record entry time
    this.stateTimers.set(state, performance.now());
    this.updateStateEntryMetrics(state);

    // Execute onEntry
    if (stateDef.onEntry) {
      await this.executeActions(stateDef.onEntry, context);
    }

    this.emitter.emit('state:entry', state, context);

    // Handle initial state for compound states
    if (stateDef.initial) {
      const initialContext: StateContext<TData> = {
        current: state,
        event: 'initial',
        timestamp: Date.now(),
      };
      await this.enterState(stateDef.initial, initialContext);
    }

    // Handle parallel states
    if (stateDef.parallel && stateDef.parallel.length > 0) {
      await Promise.all(
        stateDef.parallel.map(async (machine) => {
          const initialState = machine.initial;
          this.activeStates.add(initialState);
          await this.enterState(initialState, context);
        })
      );
    }
  }

  /**
   * Exit a state
   */
  private async exitState(state: State, context?: StateContext<TData>): Promise<void> {
    const stateDef = this.definition.states[state];
    if (!stateDef) {
      return;
    }

    this.emitter.emit('state:exit', state, context);

    // Execute onExit
    if (stateDef.onExit) {
      await this.executeActions(stateDef.onExit, context);
    }

    // Update metrics
    if (this.stateTimers.has(state)) {
      const entryTime = this.stateTimers.get(state)!;
      const duration = performance.now() - entryTime;
      this.updateStateExitMetrics(state, duration);
      this.stateTimers.delete(state);
    }

    this.activeStates.delete(state);
  }

  /**
   * Execute a guard function
   */
  private async executeGuard(
    guard: (context: StateContext<TData>) => boolean | Promise<boolean>,
    context: StateContext<TData>
  ): Promise<boolean> {
    try {
      const result = await guard(context);
      return result === true;
    } catch (error) {
      if (this.config.enableLogging) {
        this.log('Guard error', { error, guard, context });
      }
      this.emitter.emit('guard:fail', context);
      return false;
    }
  }

  /**
   * Execute an action
   */
  private async executeAction(
    action: (context: StateContext<TData>) => any,
    context: StateContext<TData>
  ): Promise<any> {
    const startTime = performance.now();

    try {
      this.emitter.emit('action:execute', action, context);
      const result = await Promise.race([
        action(context),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Action timeout')),
            this.config.transitionTimeout
          )
        ),
      ]);

      const duration = performance.now() - startTime;
      this.updateActionMetrics(duration);

      return result;
    } catch (error) {
      this.emitter.emit('action:error', error as Error, action, context);
      throw new ActionError(
        `Action execution failed: ${(error as Error).message}`,
        context,
        action
      );
    }
  }

  /**
   * Execute multiple actions
   */
  private async executeActions(
    actions: ((context: StateContext<TData>) => any) | ((context: StateContext<TData>) => any)[],
    context: StateContext<TData>
  ): Promise<void> {
    const actionList = Array.isArray(actions) ? actions : [actions];
    for (const action of actionList) {
      await this.executeAction(action, context);
    }
  }

  /**
   * Save state history for history states
   */
  private saveHistory(state: State, historyState: State): void {
    if (!this.stateStack.has(state)) {
      this.stateStack.set(state, []);
    }
    this.stateStack.get(state)!.push(historyState);
  }

  /**
   * Get history state
   */
  getHistory(state: State): State | undefined {
    const stack = this.stateStack.get(state);
    return stack && stack.length > 0 ? stack[stack.length - 1] : undefined;
  }

  /**
   * Check if transition source matches
   */
  private matchesSource(
    source: State | State[] | '*',
    from: State
  ): boolean {
    if (source === '*') {
      return true;
    }
    if (Array.isArray(source)) {
      return source.includes(from);
    }
    return source === from;
  }

  /**
   * Validate state machine definition
   */
  private validateDefinition(definition: StateMachineDefinition<TData>): void {
    if (!definition.initial) {
      throw new StateMachineError('Initial state is required', 'INVALID_DEFINITION');
    }

    if (!definition.states || Object.keys(definition.states).length === 0) {
      throw new StateMachineError('At least one state is required', 'INVALID_DEFINITION');
    }

    if (!definition.states[definition.initial]) {
      throw new StateMachineError(
        `Initial state '${definition.initial}' not found in states`,
        'INVALID_DEFINITION'
      );
    }

    // Validate all transitions
    for (const [stateName, stateDef] of Object.entries(definition.states)) {
      if (stateDef.transitions) {
        for (const transition of stateDef.transitions) {
          if (!transition.to) {
            throw new StateMachineError(
              `Transition from '${stateName}' missing target state`,
              'INVALID_DEFINITION'
            );
          }
          if (!definition.states[transition.to] && transition.to !== `${stateName}.${transition.to}`) {
            // Allow nested state notation
          }
        }
      }
    }
  }

  /**
   * Normalize configuration
   */
  private normalizeConfig(
    config: StateMachineConfig<TData>
  ): Required<StateMachineConfig<TData>> {
    return {
      definition: config.definition,
      autoStart: config.autoStart ?? false,
      enableLogging: config.enableLogging ?? false,
      enableMetrics: config.enableMetrics ?? true,
      transitionTimeout: config.transitionTimeout ?? 5000,
      maxParallelTransitions: config.maxParallelTransitions ?? 10,
      emitter: config.emitter || new EventEmitter(),
      persist: config.persist ?? false,
      persistenceKey: config.persistenceKey || `state-machine-${uuidv4()}`,
      devMode: config.devMode ?? false,
    };
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    this.metrics.set('transitions', {
      total: 0,
      successful: 0,
      failed: 0,
      byState: {} as Record<string, number>,
      byEvent: {} as Record<string, number>,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
    });

    this.metrics.set('states', new Map<string, any>());

    this.metrics.set('actions', {
      total: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
    });
  }

  /**
   * Update transition metrics
   */
  private updateTransitionMetrics(
    event: string,
    from: State,
    to: State,
    duration: number
  ): void {
    const metrics = this.metrics.get('transitions');
    if (!metrics || !this.config.enableMetrics) return;

    metrics.total++;
    metrics.successful++;
    metrics.byState[from] = (metrics.byState[from] || 0) + 1;
    metrics.byEvent[event] = (metrics.byEvent[event] || 0) + 1;

    // Update duration stats
    const totalDuration = metrics.avgDuration * (metrics.total - 1) + duration;
    metrics.avgDuration = totalDuration / metrics.total;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.lastTransition = Date.now();
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(event: string, duration: number): void {
    const metrics = this.metrics.get('transitions');
    if (!metrics || !this.config.enableMetrics) return;

    metrics.total++;
    metrics.failed++;
    metrics.byEvent[event] = (metrics.byEvent[event] || 0) + 1;
  }

  /**
   * Update state entry metrics
   */
  private updateStateEntryMetrics(state: State): void {
    const stateMetrics = this.metrics.get('states') as Map<string, any>;
    if (!stateMetrics || !this.config.enableMetrics) return;

    if (!stateMetrics.has(state)) {
      stateMetrics.set(state, {
        entries: 0,
        exits: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        firstEntry: Date.now(),
      });
    }

    const metrics = stateMetrics.get(state);
    metrics.entries++;
  }

  /**
   * Update state exit metrics
   */
  private updateStateExitMetrics(state: State, duration: number): void {
    const stateMetrics = this.metrics.get('states') as Map<string, any>;
    if (!stateMetrics || !this.config.enableMetrics) return;

    const metrics = stateMetrics.get(state);
    if (!metrics) return;

    metrics.exits++;
    metrics.totalTime += duration;
    metrics.avgTime = metrics.totalTime / metrics.exits;
    metrics.minTime = Math.min(metrics.minTime, duration);
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    metrics.lastExit = Date.now();
  }

  /**
   * Update state metrics
   */
  private updateStateMetrics(state: State, duration: number): void {
    this.updateStateExitMetrics(state, duration);
  }

  /**
   * Update action metrics
   */
  private updateActionMetrics(duration: number): void {
    const metrics = this.metrics.get('actions');
    if (!metrics || !this.config.enableMetrics) return;

    metrics.total++;
    const totalDuration = metrics.avgDuration * (metrics.total - 1) + duration;
    metrics.avgDuration = totalDuration / metrics.total;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
  }

  /**
   * Get transition metrics
   */
  getTransitionMetrics() {
    return this.metrics.get('transitions');
  }

  /**
   * Get state metrics
   */
  getStateMetrics() {
    return this.metrics.get('states');
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot(): StateMachineSnapshot<TData> {
    return {
      state: this.currentState,
      history: [...this.stateHistory],
      context: this.contextData,
      metadata: { ...this.metadata },
      version: this.version,
      timestamp: Date.now(),
    };
  }

  /**
   * Restore from a snapshot
   */
  restoreSnapshot(snapshot: StateMachineSnapshot<TData>): void {
    if (this.isDestroyed) {
      throw new StateMachineError('Cannot restore: machine is destroyed', 'MACHINE_DESTROYED');
    }

    this.currentState = snapshot.state;
    this.stateHistory = [...snapshot.history];
    this.contextData = snapshot.context;
    this.metadata = snapshot.metadata || {};
    this.activeStates.clear();
    this.activeStates.add(this.currentState);
  }

  /**
   * Reset state machine to initial state
   */
  reset(): void {
    if (this.isDestroyed) {
      throw new StateMachineError('Cannot reset: machine is destroyed', 'MACHINE_DESTROYED');
    }

    this.currentState = this.definition.initial;
    this.stateHistory = [this.currentState];
    this.activeStates.clear();
    this.activeStates.add(this.currentState);
    this.stateStack.clear();
    this.stateTimers.clear();
    this.initializeMetrics();

    if (this.config.autoStart) {
      this.enterState(this.currentState);
    }

    this.emitter.emit('machine:reset');
  }

  /**
   * Register event listener
   */
  on<K extends keyof StateMachineEvents<TData>>(
    event: K,
    listener: StateMachineEvents<TData>[K]
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  /**
   * Register one-time event listener
   */
  once<K extends keyof StateMachineEvents<TData>>(
    event: K,
    listener: StateMachineEvents<TData>[K]
  ): this {
    this.emitter.once(event, listener);
    return this;
  }

  /**
   * Remove event listener
   */
  off<K extends keyof StateMachineEvents<TData>>(
    event: K,
    listener: StateMachineEvents<TData>[K]
  ): this {
    this.emitter.off(event, listener);
    return this;
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners<K extends keyof StateMachineEvents<TData>>(event?: K): this {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
    return this;
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, data?: any): void {
    if (this.config.enableLogging || this.config.devMode) {
      console.log(`[StateMachine:${this.id}] ${message}`, data || '');
    }
  }

  /**
   * Destroy the state machine
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this.emitter.emit('machine:destroy');
    this.emitter.removeAllListeners();
    this.stateHistory = [];
    this.activeStates.clear();
    this.stateStack.clear();
    this.stateTimers.clear();
    this.metrics.clear();
    this.transitionQueue = [];
  }

  /**
   * Check if machine is destroyed
   */
  get destroyed(): boolean {
    return this.isDestroyed;
  }
}

/**
 * Create a state machine from definition
 */
export function createStateMachine<TData = any>(
  definition: StateMachineDefinition<TData>,
  config?: Partial<StateMachineConfig<TData>>
): StateMachineEngine<TData> {
  return new StateMachineEngine<TData>({
    definition,
    ...config,
  });
}
