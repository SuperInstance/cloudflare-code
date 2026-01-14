/**
 * State Manager
 * Manages state tracking, validation, persistence, and restoration
 */

import { StateMachineEngine } from '../engine/engine.js';
import {
  State,
  StateContext,
  StateMachineDefinition,
  StateMachineSnapshot,
  Transition,
  StateMachineError,
} from '../types/index.js';

/**
 * State validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * State change record
 */
export interface StateChangeRecord {
  timestamp: number;
  from: State;
  to: State;
  event: string;
  duration: number;
}

/**
 * State manager options
 */
export interface StateManagerOptions {
  /** Maximum history length */
  maxHistoryLength?: number;
  /** Enable state validation */
  enableValidation?: boolean;
  /** Enable state compression for large histories */
  enableCompression?: boolean;
  /** Persistence adapter */
  persistenceAdapter?: PersistenceAdapter;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Enable state versioning */
  enableVersioning?: boolean;
  /** Max versions to keep */
  maxVersions?: number;
}

/**
 * Persistence adapter interface
 */
export interface PersistenceAdapter {
  /** Load state snapshot */
  load(key: string): Promise<StateMachineSnapshot | null>;
  /** Save state snapshot */
  save(key: string, snapshot: StateMachineSnapshot): Promise<void>;
  /** Delete state snapshot */
  delete(key: string): Promise<void>;
  /** Check if state exists */
  exists(key: string): Promise<boolean>;
}

/**
 * State version
 */
export interface StateVersion {
  version: number;
  timestamp: number;
  snapshot: StateMachineSnapshot;
  description?: string;
}

/**
 * Migration function
 */
export type MigrationFunction = (
  snapshot: StateMachineSnapshot
) => StateMachineSnapshot | Promise<StateMachineSnapshot>;

/**
 * Migration definition
 */
export interface Migration {
  from: string;
  to: string;
  migrate: MigrationFunction;
}

/**
 * State manager class
 */
export class StateManager<TData = any> {
  private machine: StateMachineEngine<TData>;
  private options: Required<StateManagerOptions>;
  private changeLog: StateChangeRecord[] = [];
  private versions: StateVersion[] = [];
  private migrations: Map<string, Migration> = new Map();
  private autoSaveTimer?: NodeJS.Timeout;
  private validationRules: Map<string, (state: State, context?: StateContext) => boolean> = new Map();

  constructor(
    machine: StateMachineEngine<TData>,
    options: StateManagerOptions = {}
  ) {
    this.machine = machine;
    this.options = this.normalizeOptions(options);

    // Subscribe to state changes
    this.machine.on('state:change', this.handleStateChange.bind(this));

    // Setup auto-save
    if (this.options.autoSaveInterval > 0) {
      this.setupAutoSave();
    }
  }

  /**
   * Get current state
   */
  get currentState(): State {
    return this.machine.state;
  }

  /**
   * Get state history
   */
  get history(): readonly State[] {
    return this.machine.history;
  }

  /**
   * Get change log
   */
  get changeHistory(): readonly StateChangeRecord[] {
    return [...this.changeLog];
  }

  /**
   * Get all versions
   */
  get allVersions(): readonly StateVersion[] {
    return [...this.versions];
  }

  /**
   * Validate current state
   */
  async validate(context?: StateContext): Promise<ValidationResult> {
    if (!this.options.enableValidation) {
      return { valid: true, errors: [], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate state exists in definition
    if (!this.isStateValid(this.currentState)) {
      errors.push(`Current state '${this.currentState}' is not defined in the machine`);
    }

    // Check for orphaned states
    const orphaned = this.findOrphanedStates();
    if (orphaned.length > 0) {
      warnings.push(`Orphaned states detected: ${orphaned.join(', ')}`);
    }

    // Run custom validation rules
    for (const [name, rule] of this.validationRules) {
      try {
        if (!rule(this.currentState, context)) {
          errors.push(`Validation rule '${name}' failed`);
        }
      } catch (error) {
        errors.push(`Validation rule '${name}' threw error: ${(error as Error).message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate transition
   */
  async validateTransition(
    from: State,
    to: State,
    event: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check source state exists
    if (!this.isStateValid(from)) {
      errors.push(`Source state '${from}' is not defined`);
    }

    // Check target state exists
    if (!this.isStateValid(to)) {
      errors.push(`Target state '${to}' is not defined`);
    }

    // Check for invalid transitions (to final states, etc.)
    if (this.isFinalState(to)) {
      warnings.push(`Transitioning to final state '${to}'`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Save current state
   */
  async save(description?: string): Promise<void> {
    if (!this.options.persistenceAdapter) {
      throw new StateMachineError('No persistence adapter configured', 'NO_PERSISTENCE');
    }

    const snapshot = this.machine.createSnapshot();

    if (this.options.enableVersioning) {
      const version: StateVersion = {
        version: this.versions.length + 1,
        timestamp: Date.now(),
        snapshot,
        description,
      };

      this.versions.push(version);

      // Prune old versions
      if (this.versions.length > this.options.maxVersions) {
        this.versions.shift();
      }
    }

    const key = this.getPersistenceKey();
    await this.options.persistenceAdapter.save(key, snapshot);
  }

  /**
   * Load state
   */
  async load(): Promise<StateMachineSnapshot | null> {
    if (!this.options.persistenceAdapter) {
      throw new StateMachineError('No persistence adapter configured', 'NO_PERSISTENCE');
    }

    const key = this.getPersistenceKey();
    const snapshot = await this.options.persistenceAdapter.load(key);

    if (snapshot) {
      // Check if migration is needed
      const migrated = await this.migrateSnapshot(snapshot);
      this.machine.restoreSnapshot(migrated);
    }

    return snapshot;
  }

  /**
   * Delete saved state
   */
  async delete(): Promise<void> {
    if (!this.options.persistenceAdapter) {
      throw new StateMachineError('No persistence adapter configured', 'NO_PERSISTENCE');
    }

    const key = this.getPersistenceKey();
    await this.options.persistenceAdapter.delete(key);
    this.versions = [];
  }

  /**
   * Check if saved state exists
   */
  async exists(): Promise<boolean> {
    if (!this.options.persistenceAdapter) {
      return false;
    }

    const key = this.getPersistenceKey();
    return this.options.persistenceAdapter.exists(key);
  }

  /**
   * Create a version checkpoint
   */
  async checkpoint(description?: string): Promise<number> {
    const snapshot = this.machine.createSnapshot();
    const version: StateVersion = {
      version: this.versions.length + 1,
      timestamp: Date.now(),
      snapshot,
      description,
    };

    this.versions.push(version);

    // Prune old versions
    while (this.versions.length > this.options.maxVersions) {
      this.versions.shift();
    }

    return version.version;
  }

  /**
   * Restore to a specific version
   */
  async restoreVersion(versionNumber: number): Promise<void> {
    const version = this.versions.find(v => v.version === versionNumber);

    if (!version) {
      throw new StateMachineError(
        `Version ${versionNumber} not found`,
        'VERSION_NOT_FOUND'
      );
    }

    const migrated = await this.migrateSnapshot(version.snapshot);
    this.machine.restoreSnapshot(migrated);
  }

  /**
   * Get version by number
   */
  getVersion(versionNumber: number): StateVersion | undefined {
    return this.versions.find(v => v.version === versionNumber);
  }

  /**
   * Get latest version
   */
  getLatestVersion(): StateVersion | undefined {
    return this.versions[this.versions.length - 1];
  }

  /**
   * Register a migration
   */
  registerMigration(migration: Migration): void {
    const key = `${migration.from}->${migration.to}`;
    this.migrations.set(key, migration);
  }

  /**
   * Migrate snapshot to current version
   */
  async migrateSnapshot(snapshot: StateMachineSnapshot): Promise<StateMachineSnapshot> {
    let currentSnapshot = snapshot;
    let currentVersion = snapshot.version;

    while (true) {
      const migrationKey = `${currentVersion}->${this.getTargetVersion()}`;
      const migration = this.migrations.get(migrationKey);

      if (!migration) {
        break;
      }

      currentSnapshot = await migration.migrate(currentSnapshot);
      currentVersion = migration.to;
    }

    return currentSnapshot;
  }

  /**
   * Add validation rule
   */
  addValidationRule(
    name: string,
    rule: (state: State, context?: StateContext) => boolean
  ): void {
    this.validationRules.set(name, rule);
  }

  /**
   * Remove validation rule
   */
  removeValidationRule(name: string): void {
    this.validationRules.delete(name);
  }

  /**
   * Get state statistics
   */
  getStateStatistics(): Record<string, any> {
    const stats: Record<string, any> = {
      currentState: this.currentState,
      historyLength: this.history.length,
      totalTransitions: this.changeLog.length,
      versions: this.versions.length,
    };

    // Calculate state durations
    const stateDurations: Record<string, number> = {};
    for (const change of this.changeLog) {
      stateDurations[change.from] = (stateDurations[change.from] || 0) + change.duration;
    }

    // Find most visited states
    const stateVisits: Record<string, number> = {};
    for (const state of this.history) {
      stateVisits[state] = (stateVisits[state] || 0) + 1;
    }

    stats.stateDurations = stateDurations;
    stats.stateVisits = stateVisits;
    stats.mostVisitedState = Object.entries(stateVisits).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    return stats;
  }

  /**
   * Export state to JSON
   */
  exportState(): string {
    const data = {
      snapshot: this.machine.createSnapshot(),
      changeLog: this.changeLog,
      versions: this.versions,
      exportedAt: Date.now(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import state from JSON
   */
  importState(json: string): void {
    const data = JSON.parse(json);

    if (data.snapshot) {
      this.machine.restoreSnapshot(data.snapshot);
    }

    if (data.changeLog) {
      this.changeLog = data.changeLog;
    }

    if (data.versions) {
      this.versions = data.versions;
    }
  }

  /**
   * Clear history and change log
   */
  clearHistory(): void {
    this.changeLog = [];
    this.versions = [];
  }

  /**
   * Handle state change event
   */
  private handleStateChange(event: any): void {
    const record: StateChangeRecord = {
      timestamp: Date.now(),
      from: event.from,
      to: event.to,
      event: event.event,
      duration: event.duration,
    };

    this.changeLog.push(record);

    // Trim history if needed
    if (this.changeLog.length > this.options.maxHistoryLength) {
      this.changeLog = this.changeLog.slice(-this.options.maxHistoryLength);
    }
  }

  /**
   * Check if state is valid
   */
  private isStateValid(state: State): boolean {
    const definition = (this.machine as any).definition as StateMachineDefinition<TData>;
    return !!definition.states[state];
  }

  /**
   * Find orphaned states (in history but not in definition)
   */
  private findOrphanedStates(): State[] {
    const definition = (this.machine as any).definition as StateMachineDefinition<TData>;
    const definedStates = new Set(Object.keys(definition.states));
    const orphaned: State[] = [];

    for (const state of this.history) {
      if (!definedStates.has(state)) {
        orphaned.push(state);
      }
    }

    return orphaned;
  }

  /**
   * Check if state is a final state
   */
  private isFinalState(state: State): boolean {
    const definition = (this.machine as any).definition as StateMachineDefinition<TData>;
    const stateDef = definition.states[state];
    return stateDef?.final === true;
  }

  /**
   * Get target version for migrations
   */
  private getTargetVersion(): string {
    return this.machine.version;
  }

  /**
   * Get persistence key
   */
  private getPersistenceKey(): string {
    return `state-machine-${this.machine.id}`;
  }

  /**
   * Setup auto-save
   */
  private setupAutoSave(): void {
    this.autoSaveTimer = setInterval(
      () => {
        this.save().catch(err => {
          console.error('Auto-save failed:', err);
        });
      },
      this.options.autoSaveInterval
    );
  }

  /**
   * Normalize options
   */
  private normalizeOptions(
    options: StateManagerOptions
  ): Required<StateManagerOptions> {
    return {
      maxHistoryLength: options.maxHistoryLength ?? 1000,
      enableValidation: options.enableValidation ?? true,
      enableCompression: options.enableCompression ?? false,
      persistenceAdapter: options.persistenceAdapter,
      autoSaveInterval: options.autoSaveInterval ?? 0,
      enableVersioning: options.enableVersioning ?? true,
      maxVersions: options.maxVersions ?? 10,
    };
  }

  /**
   * Destroy state manager
   */
  destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }

    this.changeLog = [];
    this.versions = [];
    this.validationRules.clear();
    this.migrations.clear();
  }
}

/**
 * In-memory persistence adapter
 */
export class InMemoryPersistenceAdapter implements PersistenceAdapter {
  private storage: Map<string, StateMachineSnapshot> = new Map();

  async load(key: string): Promise<StateMachineSnapshot | null> {
    return this.storage.get(key) || null;
  }

  async save(key: string, snapshot: StateMachineSnapshot): Promise<void> {
    this.storage.set(key, snapshot);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Local storage persistence adapter (browser)
 */
export class LocalStoragePersistenceAdapter implements PersistenceAdapter {
  constructor(private prefix: string = 'sm-') {}

  async load(key: string): Promise<StateMachineSnapshot | null> {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const data = localStorage.getItem(this.prefix + key);
    return data ? JSON.parse(data) : null;
  }

  async save(key: string, snapshot: StateMachineSnapshot): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.prefix + key, JSON.stringify(snapshot));
    }
  }

  async delete(key: string): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.prefix + key);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem(this.prefix + key) !== null;
  }
}
