/**
 * Canary Deployment Module
 */

export {
  CanaryDeployer,
  type CanaryDeploymentOptions,
  type CanaryDeploymentResult,
} from './deployer';

export {
  CanaryMonitor,
  type CanaryMonitorOptions,
  type MetricSnapshot,
} from './canary-monitor';

export {
  TrafficManager,
  type TrafficManagerOptions,
  type TrafficDistribution,
} from './traffic-manager';
