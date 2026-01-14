/**
 * Main observability class that integrates all components
 */

import { DistributedTracer } from './tracing';
import { StructuredLogger, LogStream } from './logging';
import { CPUProfiler, MemoryProfiler } from './profiling';
import { MemoryLeakDetector } from './memory';
import { HTTPInspector } from './inspection';
import { DebugRecorder } from './recording';
import { ObservabilityConfig } from './types';

export class Observability {
  private tracer: DistributedTracer;
  private logger: StructuredLogger;
  private logStream: LogStream;
  private cpuProfiler: CPUProfiler;
  private memoryProfiler: MemoryProfiler;
  private leakDetector: MemoryLeakDetector;
  private httpInspector: HTTPInspector;
  private debugRecorder: DebugRecorder;
  private initialized: boolean = false;

  constructor(private config: ObservabilityConfig) {
    this.tracer = new DistributedTracer(config.serviceName);
    this.logger = new StructuredLogger(config.serviceName, {
      level: config.logging.level,
      enableCorrelation: config.logging.correlationEnabled,
    });
    this.logStream = new LogStream();
    this.cpuProfiler = new CPUProfiler();
    this.memoryProfiler = new MemoryProfiler();
    this.leakDetector = new MemoryLeakDetector();
    this.httpInspector = new HTTPInspector({
      recordHeaders: config.inspection.recordHeaders,
      recordBody: config.inspection.recordBody,
      maxBodySize: config.inspection.maxBodySize,
      maskSensitiveHeaders: config.inspection.maskSensitiveHeaders,
    });
    this.debugRecorder = new DebugRecorder({
      maxSessionDuration: config.recording.maxSessionDuration,
      maxFramesPerSession: config.recording.maxFramesPerSession,
      autoRecordOnError: config.recording.autoRecordOnError,
    });
  }

  /**
   * Initialize the observability system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing observability system', {
      serviceName: this.config.serviceName,
      environment: this.config.environment,
    });

    // Initialize HTTP inspection
    if (this.config.inspection.enabled) {
      this.httpInspector.interceptFetch();
      this.logger.info('HTTP inspection enabled');
    }

    // Start memory profiling if enabled
    if (this.config.memory.enabled) {
      this.memoryProfiler.start();
      this.leakDetector.startMonitoring();
      this.logger.info('Memory profiling enabled');
    }

    // Set up log streaming
    this.logStream.subscribe(
      {
        minLevel: this.config.logging.level,
      },
      (entry) => {
        // Forward log entries to any external service
        if (this.config.logging.exporter === 'otlp' && this.config.logging.exporterEndpoint) {
          this.sendLogsToOTLP([entry]);
        }
      }
    );

    this.initialized = true;
    this.logger.info('Observability system initialized');
  }

  /**
   * Get the tracer instance
   */
  getTracer(): DistributedTracer {
    return this.tracer;
  }

  /**
   * Get the logger instance
   */
  getLogger(): StructuredLogger {
    return this.logger;
  }

  /**
   * Get the log stream instance
   */
  getLogStream(): LogStream {
    return this.logStream;
  }

  /**
   * Get the CPU profiler instance
   */
  getCPUProfiler(): CPUProfiler {
    return this.cpuProfiler;
  }

  /**
   * Get the memory profiler instance
   */
  getMemoryProfiler(): MemoryProfiler {
    return this.memoryProfiler;
  }

  /**
   * Get the leak detector instance
   */
  getLeakDetector(): MemoryLeakDetector {
    return this.leakDetector;
  }

  /**
   * Get the HTTP inspector instance
   */
  getHTTPInspector(): HTTPInspector {
    return this.httpInspector;
  }

  /**
   * Get the debug recorder instance
   */
  getDebugRecorder(): DebugRecorder {
    return this.debugRecorder;
  }

  /**
   * Send logs to OTLP endpoint
   */
  private async sendLogsToOTLP(entries: any[]): Promise<void> {
    if (!this.config.logging.exporterEndpoint) {
      return;
    }

    try {
      await fetch(this.config.logging.exporterEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceLogs: [
            {
              resource: {
                attributes: [
                  {
                    key: 'service.name',
                    value: { stringValue: this.config.serviceName },
                  },
                ],
              },
              scopeLogs: [
                {
                  scope: {
                    name: 'claudeflare-observability',
                  },
                  logRecords: entries.map((entry) => ({
                    timeUnixNano: entry.timestamp * 1000000,
                    severityNumber: this.mapLogLevel(entry.level),
                    severityText: entry.level,
                    body: {
                      stringValue: entry.message,
                    },
                    attributes: Object.entries(entry.attributes).map(([key, value]) => ({
                      key,
                      value: { stringValue: String(value) },
                    })),
                  })),
                },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      console.error('Failed to send logs to OTLP:', error);
    }
  }

  /**
   * Map log level to OTLP severity number
   */
  private mapLogLevel(level: string): number {
    const levels: Record<string, number> = {
      trace: 1,
      debug: 5,
      info: 9,
      warn: 13,
      error: 17,
      fatal: 21,
    };
    return levels[level] || 9;
  }

  /**
   * Shutdown the observability system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down observability system');

    // Stop memory profiling
    if (this.config.memory.enabled) {
      this.memoryProfiler.stop();
      this.leakDetector.stopMonitoring();
    }

    // Stop CPU profiling if active
    if (this.cpuProfiler.getStatus().isProfiling) {
      this.cpuProfiler.stop();
    }

    // Stop debug recording
    if (this.debugRecorder.getActiveSession()) {
      this.debugRecorder.stopSession();
    }

    this.initialized = false;
    this.logger.info('Observability system shutdown complete');
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    initialized: boolean;
    tracingEnabled: boolean;
    loggingEnabled: boolean;
    profilingEnabled: boolean;
    memoryEnabled: boolean;
    inspectionEnabled: boolean;
    recordingEnabled: boolean;
    uptime: number;
  } {
    return {
      initialized: this.initialized,
      tracingEnabled: this.config.tracing.enabled,
      loggingEnabled: this.config.logging.enabled,
      profilingEnabled: this.config.profiling.enabled,
      memoryEnabled: this.config.memory.enabled,
      inspectionEnabled: this.config.inspection.enabled,
      recordingEnabled: this.config.recording.enabled,
      uptime: this.initialized ? Date.now() - (this.logger.getStatistics().newestEntry || Date.now()) : 0,
    };
  }

  /**
   * Export all observability data
   */
  exportData(): {
    traces: string;
    logs: string;
    profiles: string;
    memory: string;
    inspection: string;
    recordings: string;
  } {
    return {
      traces: JSON.stringify(this.tracer.getTraceStatistics()),
      logs: JSON.stringify(this.logger.getStatistics()),
      profiles: JSON.stringify(this.cpuProfiler.getStatus()),
      memory: JSON.stringify(this.memoryProfiler.getStatistics()),
      inspection: JSON.stringify(this.httpInspector.getStatistics()),
      recordings: JSON.stringify(this.debugRecorder.getStatistics()),
    };
  }
}

/**
 * Create a new observability instance with default configuration
 */
export function createObservability(config: Partial<ObservabilityConfig> = {}): Observability {
  const defaultConfig: ObservabilityConfig = {
    enabled: true,
    serviceName: 'claudeflare-service',
    serviceVersion: '1.0.0',
    environment: 'production',
    tracing: {
      enabled: true,
      sampleRate: 1.0,
      exporter: 'console',
      propagateHeaders: ['traceparent', 'uber-trace-id'],
      batchSize: 100,
      batchTimeout: 5000,
    },
    logging: {
      enabled: true,
      level: 'info' as any,
      format: 'json',
      exporter: 'console',
      correlationEnabled: true,
    },
    profiling: {
      enabled: true,
      interval: 1000,
      duration: 30000,
      maxSamples: 100000,
      exporter: 'otlp',
    },
    memory: {
      enabled: true,
      samplingInterval: 1000,
      heapSnapshotInterval: 60000,
      leakDetectionThreshold: 20,
    },
    inspection: {
      enabled: true,
      recordHeaders: true,
      recordBody: true,
      maxBodySize: 102400,
      maskSensitiveHeaders: ['authorization', 'cookie', 'set-cookie', 'x-api-key'],
    },
    recording: {
      enabled: true,
      maxSessionDuration: 300000,
      maxFramesPerSession: 10000,
      autoRecordOnError: true,
    },
  };

  return new Observability({
    ...defaultConfig,
    ...config,
    tracing: { ...defaultConfig.tracing, ...config.tracing },
    logging: { ...defaultConfig.logging, ...config.logging },
    profiling: { ...defaultConfig.profiling, ...config.profiling },
    memory: { ...defaultConfig.memory, ...config.memory },
    inspection: { ...defaultConfig.inspection, ...config.inspection },
    recording: { ...defaultConfig.recording, ...config.recording },
  });
}
