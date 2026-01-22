/**
 * ClaudeFlare Advanced Streaming Data Platform
 * Real-time analytics and event processing with fault tolerance
 */

// ============================================================================
// Core Types
// ============================================================================

export * from './types';

// ============================================================================
// Stream Processor
// ============================================================================

export {
  StreamProcessor,
  TimeWindow,
  CountWindow,
  SessionWindow,
  WindowFunction,
  StateFunction
} from './processor';

// ============================================================================
// Transform Engine
// ============================================================================

export {
  TransformEngine,
  TransformFunction,
  TransformContext,
  TransformOperation,
  TransformEngineFactory
} from './transform';

// ============================================================================
// Fault Tolerance
// ============================================================================

export {
  FaultToleranceEngine,
  FaultToleranceManager,
  FaultToleranceStrategy,
  CheckpointData,
  RecoveryContext
} from './fault-tolerance';

// ============================================================================
// Source Connectors
// ============================================================================

export {
  SourceConnector,
  KafkaConnector,
  HttpConnector,
  WebSocketConnector,
  DatabaseConnector,
  FileConnector
} from './sources';

// ============================================================================
// Main Platform Class
// ============================================================================

export class StreamingPlatform {
  static createProcessor<T>(
    config?: any,
    faultConfig?: any
  ): any {
    const { StreamProcessor } = require('./processor');
    return new StreamProcessor(config, faultConfig);
  }

  static createTransformEngine<T>(
    config?: any
  ): any {
    const { TransformEngine } = require('./transform');
    return new TransformEngine(config);
  }

  static createFaultToleranceManager(
    config: any,
    processingConfig: any
  ): any {
    const { FaultToleranceManager } = require('./fault-tolerance');
    return new FaultToleranceManager(config, processingConfig);
  }

  static createConnector<T>(
    config: any
  ): any {
    const { createSourceConnector, SourceConnector } = require('./sources');
    const factory = createSourceConnector || ((c: any) => new SourceConnector(c));
    return factory(config);
  }

  static createSourceStream<T>(
    config: any
  ): any {
    // Placeholder implementation
    return null;
  }
}

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
