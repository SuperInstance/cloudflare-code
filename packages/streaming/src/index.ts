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
  StreamProcessorImpl,
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
  ConnectorFactory,
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
    return new StreamProcessorImpl<T>(config, faultConfig);
  }

  static createTransformEngine<T>(
    config?: any
  ): any {
    return new TransformEngine<T>(config);
  }

  static createFaultToleranceManager(
    config: any,
    processingConfig: any
  ): any {
    return new FaultToleranceManager(config, processingConfig);
  }

  static createConnector<T>(
    config: any
  ): any {
    return ConnectorFactory.create<T>(config);
  }

  static createSourceStream<T>(
    config: any
  ): any {
    return ConnectorFactory.createSourceStream<T>(config);
  }
}

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
