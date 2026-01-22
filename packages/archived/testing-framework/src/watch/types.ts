/**
 * Watch Mode Types
 * Provides types and interfaces for file watching and test execution
 */

export interface WatchConfig {
  // File patterns to watch
  watch: string[];

  // Patterns to ignore
  ignore: string[];

  // Test execution configuration
  tests: {
    // Glob pattern for test files
    pattern: string;

    // Test file extensions
    extensions: string[];

    // Test run configuration
    run: {
      // Enable parallel execution
      parallel: boolean;

      // Maximum workers
      maxWorkers: number;

      // Fail fast
      failFast: boolean;

      // Test reporter
      reporter: string;

      // Test environment
      environment: 'node' | 'browser';

      // Additional env variables
      env: { [key: string]: string };
    };
  };

  // File watching behavior
  watchOptions: {
    // Use polling
    usePolling: boolean;

    // Polling interval in milliseconds
    interval: number;

    // Initial delay before watching
    awaitWriteFinish: {
      stabilityThreshold: number;
      pollInterval: number;
    };

    // Follow symbolic links
    followSymlinks: boolean;

    // Ignore hidden files
    ignoreInitial: boolean;
  };

  // Debounce configuration
  debounce: {
    // Debounce delay in milliseconds
    delay: number;

    // Maximum debounce time
    maxWait: number;

    // Debounce on all changes
    leading: boolean;
    trailing: boolean;
  };

  // Clear screen before each run
  clearScreen: boolean;

  // Enable verbose logging
  verbose: boolean;

  // Automatically re-run on changes
  autoRun: boolean;

  // Specific test file to run when no changes
  defaultTest?: string;

  // Custom hooks
  hooks?: {
    // Before watch start
    beforeWatch?: string;

    // Before each test run
    beforeRun?: string;

    // After each test run
    afterRun?: string;

    // On file change
    onChange?: string;

    // On error
    onError?: string;

    // On watch stop
    onStop?: string;
  };
}

export interface WatchEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir' | 'error';
  path: string;
  stats?: any;
  timestamp: number;
}

export interface WatchRunResult {
  passed: boolean;
  total: number;
  failed: number;
  skipped: number;
  duration: number;
  files: string[];
  coverage?: any;
  errors: string[];
  warnings: string[];
}

export interface WatchSession {
  id: string;
  startTime: number;
  lastRun?: number;
  totalRuns: number;
  totalFilesWatched: number;
  currentFiles: string[];
  isRunning: boolean;
  results: WatchRunResult[];
  status: 'idle' | 'running' | 'paused' | 'stopped';
  errors: string[];
}

export interface WatchMetrics {
  filesPerSecond: number;
  runsPerMinute: number;
  averageRunTime: number;
  successRate: number;
  failureCount: number;
  lastRunTime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface WatchHook {
  name: string;
  type: 'beforeWatch' | 'beforeRun' | 'afterRun' | 'onChange' | 'onError' | 'onStop';
  handler: (event?: WatchEvent, result?: WatchRunResult) => void | Promise<void>;
  async: boolean;
  priority: number;
}

export interface WatchFilter {
  pattern: string;
  type: 'include' | 'exclude';
  reason: string;
}

export interface WatchReport {
  session: WatchSession;
  metrics: WatchMetrics;
  events: WatchEvent[];
  filteredEvents: WatchEvent[];
  triggers: {
    fileChanges: number;
    manualRuns: number;
    hookTriggers: number;
  };
  performance: {
    eventProcessingTime: number;
    testExecutionTime: number;
    totalTime: number;
  };
  summary: {
    totalFiles: number;
    watchedFiles: number;
    testFiles: number;
    averageCoverage?: number;
    successStreak?: number;
    lastFailure?: string;
  };
}