/**
 * ClaudeFlare Deployment Automation System
 * Main entry point for the deployment package
 */

// Export all types
export * from './types';

// Export zero-downtime deployment
export {
  ZeroDowntimeDeployer,
  type ZeroDowntimeDeploymentOptions,
  type DeploymentResult,
} from './zero-downtime/deployer';

export {
  HealthCheckRunner,
  type HealthCheckRunnerOptions,
} from './zero-downtime/health-check-runner';

export {
  GracefulShutdown,
  type GracefulShutdownOptions,
  type ShutdownProgress,
} from './zero-downtime/graceful-shutdown';

export {
  MetricsCollector,
  type MetricsCollectorOptions,
} from './zero-downtime/metrics-collector';

// Export blue-green deployment
export {
  BlueGreenDeployer,
  type BlueGreenDeploymentOptions,
  type BlueGreenDeploymentResult,
} from './blue-green/deployer';

// Export canary deployment
export {
  CanaryDeployer,
  type CanaryDeploymentOptions,
  type CanaryDeploymentResult,
} from './canary/deployer';

export {
  CanaryMonitor,
  type CanaryMonitorOptions,
  type MetricSnapshot,
} from './canary/canary-monitor';

export {
  TrafficManager,
  type TrafficManagerOptions,
  type TrafficDistribution,
} from './canary/traffic-manager';

// Export testing
export {
  SmokeTestRunner,
  type SmokeTestRunnerOptions,
} from './testing/smoke-test-runner';

// Export verification
export {
  VerificationEngine,
  type VerificationEngineOptions,
  type VerificationExecutionResult,
} from './verification/engine';

// Export pipeline
export {
  CDPipeline,
  type CDPipelineOptions,
  type PipelineExecution,
  type PipelineStageResult,
} from './pipeline/cd-pipeline';

// Export GitOps
export {
  GitOpsSync,
  type GitOpsSyncOptions,
} from './gitops/sync';

// Export rollback
export {
  RollbackManager,
  type RollbackManagerOptions,
  type RollbackPlan,
} from './rollback/manager';

// Export monitoring
export {
  DeploymentMonitor,
  type DeploymentMonitorOptions,
  type MonitoringEvent,
  type AlertTriggered,
} from './monitoring/deployment-monitor';

// Export utilities
export {
  Logger,
  LogLevel,
  type LoggerOptions,
  type LogEntry,
} from './utils/logger';

export {
  ConfigManager,
  type ConfigLoadOptions,
} from './utils/config';

// Version
export const VERSION = '1.0.0';
