import { ObservabilityPlatform } from '../src/core/observability-platform';
import { ConfigManager } from '../src/core/config-manager';
import { TelemetryManager } from '../src/core/telemetry-manager';
import { ExportManager } from '../src/core/export-manager';
import { ErrorHandler } from '../src/core/error-handler';
import { Utils } from '../src/core/utils';
import { createTestConfig, cleanupTestData } from './setup';

describe('Core Observability Platform', () => {
  let platform: ObservabilityPlatform;
  let config: any;

  beforeEach(() => {
    config = createTestConfig();
    platform = ObservabilityPlatform.getInstance();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Initialization', () => {
    it('should initialize platform with valid config', async () => {
      await expect(platform.initialize(config)).resolves.not.toThrow();
      expect(platform.isInitialized()).toBe(true);
    });

    it('should throw error when initialized twice', async () => {
      await platform.initialize(config);
      await expect(platform.initialize(config)).rejects.toThrow('Observability platform is already initialized');
    });

    it('should handle invalid configuration gracefully', async () => {
      const invalidConfig = { ...config, metrics: { exportInterval: 500 } }; // Too short interval
      await expect(platform.initialize(invalidConfig)).resolves.not.toThrow();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await platform.initialize(config);
      await expect(platform.shutdown()).resolves.not.toThrow();
      expect(platform.isInitialized()).toBe(false);
    });

    it('should not shutdown when not initialized', async () => {
      await expect(platform.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Component Access', () => {
    it('should provide access to telemetry manager', async () => {
      await platform.initialize(config);
      const telemetryManager = platform.getTelemetryManager();
      expect(telemetryManager).toBeInstanceOf(TelemetryManager);
    });

    it('should provide access to export manager', async () => {
      await platform.initialize(config);
      const exportManager = platform.getExportManager();
      expect(exportManager).toBeInstanceOf(ExportManager);
    });

    it('should throw error when accessing uninitialized platform', () => {
      expect(() => platform.getTelemetryManager()).toThrow('Observability platform is not initialized');
    });
  });

  describe('Shutdown Hooks', () => {
    it('should execute shutdown hooks in correct order', async () => {
      const hookOrder: number[] = [];

      await platform.initialize(config);

      platform.addShutdownHook(async () => {
        hookOrder.push(1);
      });

      platform.addShutdownHook(async () => {
        hookOrder.push(2);
      });

      await platform.shutdown();

      expect(hookOrder).toEqual([2, 1]); // Should be executed in reverse order
    });

    it('should handle hook errors gracefully', async () => {
      await platform.initialize(config);

      platform.addShutdownHook(async () => {
        throw new Error('Hook error');
      });

      await expect(platform.shutdown()).resolves.not.toThrow();
    });
  });
});

describe('Config Manager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  describe('Configuration Management', () => {
    it('should load default configuration', () => {
      const config = configManager.getConfig();
      expect(config).toBeDefined();
      expect(config.tracing).toBeDefined();
      expect(config.metrics).toBeDefined();
      expect(config.logging).toBeDefined();
    });

    it('should update configuration', () => {
      const updates = { metrics: { enabled: false } };
      configManager.updateConfig(updates);
      const config = configManager.getConfig();
      expect(config.metrics.enabled).toBe(false);
    });

    it('should reset configuration to defaults', () => {
      configManager.updateConfig({ metrics: { enabled: false } });
      configManager.resetConfig();
      const config = configManager.getConfig();
      expect(config.metrics.enabled).toBe(true);
    });

    it('should validate configuration', () => {
      const validConfig = createTestConfig();
      expect(configManager.validateConfig(validConfig)).toBe(true);

      const invalidConfig = { ...validConfig, tracing: { samplingRate: 1.5 } };
      expect(configManager.validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe('File Operations', () => {
    it('should save configuration to file', async () => {
      await expect(configManager.saveToFile()).resolves.not.toThrow();
    });

    it('should export configuration to environment variables', async () => {
      const originalEnv = { ...process.env };

      await configManager.exportToEnv();

      expect(process.env.OTEL_SERVICE_NAME).toBe('test-service');

      // Restore original env
      Object.assign(process.env, originalEnv);
    });
  });

  describe('Watchers', () => {
    it('should notify watchers when config changes', () => {
      let notified = false;
      configManager.addWatcher(() => { notified = true; });

      configManager.updateConfig({ metrics: { enabled: true } });
      expect(notified).toBe(true);
    });
  });
});

describe('Telemetry Manager', () => {
  let telemetryManager: TelemetryManager;

  beforeEach(() => {
    telemetryManager = new TelemetryManager();
  });

  afterEach(async () => {
    await telemetryManager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(telemetryManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await telemetryManager.initialize();
    });

    it('should increment counter metrics', () => {
      telemetryManager.incrementCounter('test.counter', 5, { tag: 'value' });
      telemetryManager.incrementCounter('test.counter', 3);

      // Note: This test would need to be adapted to the actual implementation
      expect(telemetryManager.getMetricsCacheSize()).toBeGreaterThan(0);
    });

    it('should set gauge metrics', () => {
      telemetryManager.setGauge('test.gauge', 42.5, { type: 'temperature' });

      expect(telemetryManager.getMetricsCacheSize()).toBeGreaterThan(0);
    });

    it('should add histogram values', () => {
      telemetryManager.addHistogramValue('test.histogram', 10);
      telemetryManager.addHistogramValue('test.histogram', 20);
      telemetryManager.addHistogramValue('test.histogram', 30);

      expect(telemetryManager.getMetricsCacheSize()).toBeGreaterThan(0);
    });

    it('should handle negative gauge values', () => {
      telemetryManager.setGauge('test.gauge', -10);

      expect(telemetryManager.getMetricsCacheSize()).toBeGreaterThan(0);
    });
  });

  describe('Logging', () => {
    beforeEach(async () => {
      await telemetryManager.initialize();
    });

    it('should log messages at different levels', () => {
      telemetryManager.debug('Debug message', { context: 'debug' });
      telemetryManager.info('Info message', { context: 'info' });
      telemetryManager.warn('Warning message', { context: 'warn' });
      telemetryManager.error('Error message', { context: 'error' });
      telemetryManager.fatal('Fatal message', { context: 'fatal' });

      expect(telemetryManager.getLogsCacheSize()).toBe(5);
    });

    it('should log errors with stack traces', () => {
      const testError = new Error('Test error');
      telemetryManager.error('Error with stack', {}, testError);

      expect(telemetryManager.getLogsCacheSize()).toBe(1);
    });

    it('should respect cache limits', () => {
      // Add many logs to trigger cache eviction
      for (let i = 0; i < 15000; i++) {
        telemetryManager.info(`Log ${i}`);
      }

      expect(telemetryManager.getLogsCacheSize()).toBeLessThanOrEqual(10000);
    });
  });

  describe('Tracing', () => {
    beforeEach(async () => {
      await telemetryManager.initialize();
    });

    it('should start and end spans', () => {
      const span = telemetryManager.startSpan('test.span');
      expect(span).toBeDefined();
      expect(span.name).toBe('test.span');

      telemetryManager.endSpan(span);
    });

    it('should handle trace IDs', () => {
      const span = telemetryManager.startSpan('test.span');
      const traceId = telemetryManager.getCurrentTraceId();

      expect(traceId).toBeDefined();
      telemetryManager.endSpan(span);
    });
  });

  describe('Export', () => {
    beforeEach(async () => {
      await telemetryManager.initialize();
    });

    it('should export metrics', async () => {
      telemetryManager.incrementCounter('test.counter', 1);

      const result = await telemetryManager.exportMetrics();

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.exported).toBe('number');
    });

    it('should export logs', async () => {
      telemetryManager.info('Test log message');

      const result = await telemetryManager.exportLogs();

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.exported).toBe('number');
    });

    it('should export traces', async () => {
      const span = telemetryManager.startSpan('test.span');
      telemetryManager.endSpan(span);

      const result = await telemetryManager.exportTraces();

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.exported).toBe('number');
    });
  });
});

describe('Export Manager', () => {
  let exportManager: ExportManager;

  beforeEach(() => {
    exportManager = new ExportManager();
  });

  afterEach(async () => {
    await exportManager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize with valid config', async () => {
      const config = createTestConfig();
      await expect(exportManager.initialize(config)).resolves.not.toThrow();
    });
  });

  describe('Exporter Management', () => {
    beforeEach(async () => {
      const config = createTestConfig();
      await exportManager.initialize(config);
    });

    it('should provide exporter status', () => {
      const status = exportManager.getExporterStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });

    it('should handle exporter failures gracefully', async () => {
      const result = await exportManager.exportMetrics();
      expect(result).toBeDefined();
    });
  });
});

describe('Error Handler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('Error Handling', () => {
    it('should handle regular errors', () => {
      const error = new Error('Test error');
      expect(() => {
        errorHandler.handleError(error, 'test context');
      }).not.toThrow();
    });

    it('should handle uncaught exceptions', () => {
      const error = new Error('Uncaught exception');
      expect(() => {
        errorHandler.handleUncaughtException(error);
      }).not.toThrow();
    });

    it('should handle unhandled rejections', () => {
      const reason = new Error('Unhandled rejection');
      expect(() => {
        errorHandler.handleUnhandledRejection(reason);
      }).not.toThrow();
    });

    it('should categorize errors correctly', () => {
      const networkError = new Error('Network timeout');
      const typeError = new TypeError('Type error');

      expect(errorHandler['determineErrorSeverity'](networkError)).toBe('warn');
      expect(errorHandler['determineErrorSeverity'](typeError)).toBe('error');
    });

    it('should provide error statistics', () => {
      errorHandler.handleError(new Error('Test error'), 'test');

      const stats = errorHandler.getErrorStats();
      expect(stats).toBeDefined();
      expect(stats.total).toBe(1);
      expect(stats.byType).toBeDefined();
    });
  });
});

describe('Utils', () => {
  describe('Utility Functions', () => {
    it('should generate UUID', () => {
      const uuid = Utils.generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate hash', () => {
      const hash = Utils.generateHash('test', 'sha256');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should debounce function calls', (done) => {
      let callCount = 0;
      const debouncedFn = Utils.debounce(() => {
        callCount++;
        expect(callCount).toBe(1);
        done();
      }, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();
    });

    it('should throttle function calls', (done) => {
      let callCount = 0;
      const throttledFn = Utils.throttle(() => {
        callCount++;
        if (callCount === 1) {
          setTimeout(() => {
            expect(callCount).toBe(1);
            done();
          }, 150);
        }
      }, 100);

      throttledFn();
      throttledFn();
      throttledFn();
    });

    it('should create rate limiter', () => {
      const rateLimiter = Utils.createRateLimit(5, 1000);

      let allowedCount = 0;
      for (let i = 0; i < 10; i++) {
        if (rateLimiter.isAllowed()) {
          allowedCount++;
        }
      }

      expect(allowedCount).toBe(5);
    });

    it('should retry operations', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Retryable error');
        }
        return 'success';
      };

      const result = await Utils.retry(operation, { maxAttempts: 5 });
      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should format bytes correctly', () => {
      expect(Utils.formatBytes(0)).toBe('0 Bytes');
      expect(Utils.formatBytes(1024)).toBe('1 KB');
      expect(Utils.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(Utils.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format duration correctly', () => {
      expect(Utils.formatDuration(500)).toBe('500ms');
      expect(Utils.formatDuration(1500)).toBe('1.50s');
      expect(Utils.formatDuration(65000)).toBe('1m 5s');
      expect(Utils.formatDuration(3665000)).toBe('1h 1m');
    });

    it('should sanitize input', () => {
      const input = '<script>alert("xss")</script>\'"\{}';
      const sanitized = Utils.sanitize(input);

      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('\'');
      expect(sanitized).not.toContain('"');
    });

    it('should validate email addresses', () => {
      expect(Utils.isValidEmail('test@example.com')).toBe(true);
      expect(Utils.isValidEmail('invalid-email')).toBe(false);
      expect(Utils.isValidEmail('')).toBe(false);
    });

    it('should validate URLs', () => {
      expect(Utils.isValidUrl('https://example.com')).toBe(true);
      expect(Utils.isValidUrl('invalid-url')).toBe(false);
      expect(Utils.isValidUrl('')).toBe(false);
    });

    it('should parse query strings', () => {
      const queryString = '?name=John&age=30&city=New%20York';
      const params = Utils.parseQueryString(queryString);

      expect(params.name).toBe('John');
      expect(params.age).toBe('30');
      expect(params.city).toBe('New York');
    });

    it('should flatten objects', () => {
      const obj = {
        user: {
          name: 'John',
          address: {
            city: 'New York',
            zip: '10001'
          }
        },
        age: 30
      };

      const flattened = Utils.flattenObject(obj);

      expect(flattened['user.name']).toBe('John');
      expect(flattened['user.address.city']).toBe('New York');
      expect(flattened['age']).toBe(30);
    });

    it('should clamp values', () => {
      expect(Utils.clamp(5, 0, 10)).toBe(5);
      expect(Utils.clamp(-1, 0, 10)).toBe(0);
      expect(Utils.clamp(15, 0, 10)).toBe(10);
    });

    it('should wait for conditions', async () => {
      let counter = 0;
      const condition = () => {
        counter++;
        return counter === 3;
      };

      await Utils.waitForCondition(condition, 1000, 50);
      expect(counter).toBe(3);
    });
  });
});