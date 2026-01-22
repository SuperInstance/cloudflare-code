/**
 * Deployment Orchestrator - Manage deployment strategies and execution
 */

import {
  DeploymentConfig,
  DeploymentState,
  DeploymentStatus,
  DeploymentPhase,
  DeploymentStrategy,
  HealthCheck,
  HealthStatus,
  RollbackConfig,
  DeploymentTarget,
  DeploymentMetrics,
  ErrorInfo,
} from '../types';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';
import { HealthChecker } from './health-checker';
import { CloudflareDeployer } from './deployers/cloudflare-deployer';
import { KubernetesDeployer } from './deployers/kubernetes-deployer';
import { DurableObjectCoordinator } from '../utils/durable-object';

export interface DeploymentOptions {
  config: DeploymentConfig;
  skipHealthChecks?: boolean;
  forceRollback?: boolean;
  dryRun?: boolean;
  timeout?: number;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  status: DeploymentStatus;
  duration: number;
  error?: ErrorInfo;
  metrics: DeploymentMetrics;
}

/**
 * Main deployment orchestrator class
 */
export class DeploymentOrchestrator {
  private logger: Logger;
  private metrics: MetricsCollector;
  private healthChecker: HealthChecker;
  private deployers: Map<string, CloudflareDeployer | KubernetesDeployer>;
  private coordinator: DurableObjectCoordinator;
  private activeDeployments = new Map<string, DeploymentState>();

  constructor(logger?: Logger, metrics?: MetricsCollector) {
    this.logger = logger || new Logger({ service: 'deployment-orchestrator' });
    this.metrics = metrics || new MetricsCollector({ service: 'deployment-orchestrator' });
    this.healthChecker = new HealthChecker(this.logger);
    this.coordinator = new DurableObjectCoordinator(this.logger);
    this.deployers = new Map();
  }

  /**
   * Execute a deployment
   */
  async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    const startTime = Date.now();
    const deploymentId = options.config.id;

    this.logger.info('Starting deployment', {
      deploymentId,
      strategy: options.config.strategy,
      environment: options.config.environment,
    });

    this.metrics.incrementCounter('deployment.attempts', 1, {
      strategy: options.config.strategy,
    });

    // Initialize deployment state
    const state = this.initializeDeploymentState(options.config);
    this.activeDeployments.set(deploymentId, state);

    try {
      // Execute based on strategy
      switch (options.config.strategy) {
        case DeploymentStrategy.BLUE_GREEN:
          await this.executeBlueGreenDeployment(options, state);
          break;

        case DeploymentStrategy.CANARY:
          await this.executeCanaryDeployment(options, state);
          break;

        case DeploymentStrategy.ROLLING:
          await this.executeRollingDeployment(options, state);
          break;

        case DeploymentStrategy.RECREATE:
          await this.executeRecreateDeployment(options, state);
          break;

        default:
          throw new Error(`Unsupported deployment strategy: ${options.config.strategy}`);
      }

      // Update final state
      state.status = DeploymentStatus.SUCCESS;
      state.phase = DeploymentPhase.COMPLETE;
      state.endTime = new Date();
      state.metrics.duration = Date.now() - startTime;

      this.activeDeployments.set(deploymentId, state);

      this.logger.info('Deployment completed successfully', {
        deploymentId,
        duration: state.metrics.duration,
      });

      this.metrics.incrementCounter('deployment.success', 1, {
        strategy: options.config.strategy,
      });

      return {
        success: true,
        deploymentId,
        status: state.status,
        duration: state.metrics.duration,
        metrics: state.metrics,
      };
    } catch (error: any) {
      // Handle failure
      state.status = DeploymentStatus.FAILED;
      state.phase = DeploymentPhase.COMPLETE;
      state.endTime = new Date();
      state.error = {
        code: error.code || 'DEPLOYMENT_ERROR',
        message: error.message,
        timestamp: new Date(),
        retryable: error.retryable || false,
      };
      state.metrics.duration = Date.now() - startTime;

      this.activeDeployments.set(deploymentId, state);

      this.logger.error('Deployment failed', {
        deploymentId,
        error: error.message,
      });

      this.metrics.incrementCounter('deployment.failed', 1, {
        strategy: options.config.strategy,
      });

      // Attempt rollback if configured
      if (options.config.rollback?.automatic) {
        await this.performRollback(options.config, state);
      }

      return {
        success: false,
        deploymentId,
        status: state.status,
        duration: state.metrics.duration,
        error: state.error,
        metrics: state.metrics,
      };
    }
  }

  /**
   * Execute blue-green deployment
   */
  private async executeBlueGreenDeployment(
    options: DeploymentOptions,
    state: DeploymentState
  ): Promise<void> {
    this.logger.info('Executing blue-green deployment', {
      deploymentId: state.deploymentId,
    });

    state.phase = DeploymentPhase.PRE_DEPLOYMENT;
    await this.runPreDeploymentChecks(options, state);

    state.phase = DeploymentPhase.DEPLOYMENT;

    // Get deployer for target
    const deployer = this.getDeployer(options.config.target);

    // Create green environment
    const greenVersion = `${state.targetVersion}-green`;
    this.logger.info('Creating green environment', { version: greenVersion });

    await deployer.deploy(options.config, greenVersion);

    // Run health checks on green environment
    if (!options.skipHealthChecks && options.config.healthChecks) {
      state.phase = DeploymentPhase.VERIFICATION;
      await this.performHealthChecks(
        options.config.healthChecks,
        greenVersion
      );
    }

    // Switch traffic to green
    this.logger.info('Switching traffic to green environment');
    await deployer.switchTraffic(greenVersion);

    state.currentVersion = greenVersion;
    state.metrics.trafficPercentage = 100;

    state.phase = DeploymentPhase.POST_DEPLOYMENT;
    await this.runPostDeploymentSteps(options, state);

    // Clean up blue environment if configured
    if (options.config.rollback?.retainVersions && options.config.previousVersion) {
      this.logger.info('Retaining blue environment for rollback');
    } else if (options.config.previousVersion) {
      this.logger.info('Cleaning up blue environment');
      await deployer.cleanup(options.config.previousVersion);
    }
  }

  /**
   * Execute canary deployment
   */
  private async executeCanaryDeployment(
    options: DeploymentOptions,
    state: DeploymentState
  ): Promise<void> {
    this.logger.info('Executing canary deployment', {
      deploymentId: state.deploymentId,
    });

    state.phase = DeploymentPhase.PRE_DEPLOYMENT;
    await this.runPreDeploymentChecks(options, state);

    state.phase = DeploymentPhase.DEPLOYMENT;

    const deployer = this.getDeployer(options.config.target);

    // Define canary phases
    const canaryPhases = options.config.manifest.canaryPhases || [
      { percentage: 10, duration: 300000 },
      { percentage: 25, duration: 300000 },
      { percentage: 50, duration: 300000 },
      { percentage: 100, duration: 0 },
    ];

    let currentPercentage = 0;
    const canaryVersion = `${state.targetVersion}-canary`;

    // Deploy canary version
    this.logger.info('Deploying canary version', { version: canaryVersion });
    await deployer.deploy(options.config, canaryVersion);

    for (const phase of canaryPhases) {
      const targetPercentage = phase.percentage;
      const duration = phase.duration;

      this.logger.info('Starting canary phase', {
        currentPercentage,
        targetPercentage,
      });

      // Gradually increase traffic
      const steps = 10;
      const stepSize = (targetPercentage - currentPercentage) / steps;

      for (let i = 0; i < steps; i++) {
        const stepPercentage = currentPercentage + stepSize * (i + 1);
        await deployer.updateTrafficSplit(canaryVersion, stepPercentage);
        state.metrics.trafficPercentage = stepPercentage;

        // Brief pause between steps
        await this.sleep(5000);
      }

      currentPercentage = targetPercentage;

      // Verify health at this traffic level
      state.phase = DeploymentPhase.VERIFICATION;
      if (!options.skipHealthChecks && options.config.healthChecks) {
        await this.performHealthChecks(
          options.config.healthChecks,
          canaryVersion
        );
      }

      // Monitor for the phase duration
      if (duration > 0) {
        await this.monitorCanaryPhase(
          options.config,
          canaryVersion,
          duration
        );
      }

      // Check if canary is healthy enough to proceed
      const canaryHealthy = await this.assessCanaryHealth(
        options.config,
        canaryVersion
      );

      if (!canaryHealthy) {
        throw new Error('Canary deployment failed health checks');
      }
    }

    // Complete canary - promote to full
    state.currentVersion = canaryVersion;
    state.metrics.trafficPercentage = 100;

    state.phase = DeploymentPhase.POST_DEPLOYMENT;
    await this.runPostDeploymentSteps(options, state);

    // Clean up old version
    if (options.config.previousVersion) {
      await deployer.cleanup(options.config.previousVersion);
    }
  }

  /**
   * Execute rolling deployment
   */
  private async executeRollingDeployment(
    options: DeploymentOptions,
    state: DeploymentState
  ): Promise<void> {
    this.logger.info('Executing rolling deployment', {
      deploymentId: state.deploymentId,
    });

    state.phase = DeploymentPhase.PRE_DEPLOYMENT;
    await this.runPreDeploymentChecks(options, state);

    state.phase = DeploymentPhase.DEPLOYMENT;

    const deployer = this.getDeployer(options.config.target);

    // Get current replica count
    const replicaCount = options.config.manifest.replicas || 3;
    const batchSize = options.config.manifest.rollingBatchSize || 1;
    const batchDelay = options.config.manifest.rollingBatchDelay || 10000;

    let updatedReplicas = 0;

    while (updatedReplicas < replicaCount) {
      const batchEnd = Math.min(updatedReplicas + batchSize, replicaCount);

      this.logger.info('Updating rolling batch', {
        start: updatedReplicas,
        end: batchEnd,
      });

      // Update batch
      await deployer.updateBatch(
        options.config,
        state.targetVersion,
        updatedReplicas,
        batchEnd
      );

      updatedReplicas = batchEnd;

      // Verify health of updated replicas
      if (!options.skipHealthChecks && options.config.healthChecks) {
        await this.performHealthChecks(
          options.config.healthChecks,
          state.targetVersion
        );
      }

      // Wait before next batch
      if (updatedReplicas < replicaCount) {
        await this.sleep(batchDelay);
      }
    }

    state.currentVersion = state.targetVersion;

    state.phase = DeploymentPhase.POST_DEPLOYMENT;
    await this.runPostDeploymentSteps(options, state);
  }

  /**
   * Execute recreate deployment
   */
  private async executeRecreateDeployment(
    options: DeploymentOptions,
    state: DeploymentState
  ): Promise<void> {
    this.logger.info('Executing recreate deployment', {
      deploymentId: state.deploymentId,
    });

    state.phase = DeploymentPhase.PRE_DEPLOYMENT;
    await this.runPreDeploymentChecks(options, state);

    state.phase = DeploymentPhase.DEPLOYMENT;

    const deployer = this.getDeployer(options.config.target);

    // Scale down to zero
    this.logger.info('Scaling down to zero');
    await deployer.scale(options.config, 0);

    // Deploy new version
    this.logger.info('Deploying new version', {
      version: state.targetVersion,
    });
    await deployer.deploy(options.config, state.targetVersion);

    state.currentVersion = state.targetVersion;

    // Wait for deployment to be ready
    await deployer.waitForReady(options.config);

    // Verify health
    state.phase = DeploymentPhase.VERIFICATION;
    if (!options.skipHealthChecks && options.config.healthChecks) {
      await this.performHealthChecks(
        options.config.healthChecks,
        state.targetVersion
      );
    }

    state.phase = DeploymentPhase.POST_DEPLOYMENT;
    await this.runPostDeploymentSteps(options, state);
  }

  /**
   * Perform rollback
   */
  async rollback(
    deploymentId: string,
    targetVersion?: string
  ): Promise<DeploymentResult> {
    const state = this.activeDeployments.get(deploymentId);

    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    this.logger.info('Initiating rollback', {
      deploymentId,
      targetVersion: targetVersion || state.previousVersion,
    });

    this.metrics.incrementCounter('deployment.rollback', 1);

    const rollbackConfig: DeploymentConfig = {
      id: `${deploymentId}-rollback`,
      environment: state as any,
      strategy: DeploymentStrategy.ROLLING,
      target: {} as DeploymentTarget,
      manifest: {},
    };

    const state = {
      ...state,
      status: DeploymentStatus.ROLLING_BACK,
      phase: DeploymentPhase.DEPLOYMENT,
    };

    try {
      const deployer = this.getDeployer(rollbackConfig.target);
      const version = targetVersion || state.previousVersion;

      if (!version) {
        throw new Error('No previous version available for rollback');
      }

      await deployer.deploy(rollbackConfig, version);
      await deployer.switchTraffic(version);

      state.status = DeploymentStatus.ROLLED_BACK;
      state.currentVersion = version;
      state.phase = DeploymentPhase.COMPLETE;

      this.logger.info('Rollback completed', {
        deploymentId,
        version,
      });

      return {
        success: true,
        deploymentId,
        status: state.status,
        duration: 0,
        metrics: state.metrics,
      };
    } catch (error: any) {
      this.logger.error('Rollback failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Run pre-deployment checks
   */
  private async runPreDeploymentChecks(
    options: DeploymentOptions,
    state: DeploymentState
  ): Promise<void> {
    this.logger.info('Running pre-deployment checks', {
      deploymentId: state.deploymentId,
    });

    // Validate deployment configuration
    await this.validateDeploymentConfig(options.config);

    // Check deployment prerequisites
    await this.checkDeploymentPrerequisites(options.config);

    // Backup current state if configured
    if (options.config.rollback?.enabled) {
      await this.backupCurrentState(options.config);
    }
  }

  /**
   * Run post-deployment steps
   */
  private async runPostDeploymentSteps(
    options: DeploymentOptions,
    state: DeploymentState
  ): Promise<void> {
    this.logger.info('Running post-deployment steps', {
      deploymentId: state.deploymentId,
    });

    // Send notifications
    if (options.config.notifications) {
      await this.sendNotifications(
        options.config.notifications,
        'deployment_success',
        state
      );
    }

    // Record metrics
    this.recordDeploymentMetrics(state);
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(
    healthChecks: HealthCheck[],
    version: string
  ): Promise<void> {
    this.logger.info('Performing health checks', { count: healthChecks.length });

    for (const healthCheck of healthChecks) {
      const result = await this.healthChecker.check(healthCheck, version);

      if (result.status !== HealthStatus.HEALTHY) {
        throw new Error(
          `Health check '${healthCheck.name}' failed: ${result.message}`
        );
      }

      this.logger.info('Health check passed', { name: healthCheck.name });
    }

    this.logger.info('All health checks passed');
  }

  /**
   * Monitor canary phase
   */
  private async monitorCanaryPhase(
    config: DeploymentConfig,
    version: string,
    duration: number
  ): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 30000; // Check every 30 seconds

    while (Date.now() - startTime < duration) {
      await this.sleep(checkInterval);

      // Perform quick health check
      if (config.healthChecks) {
        const result = await this.healthChecker.check(
          config.healthChecks[0],
          version
        );

        if (result.status === HealthStatus.UNHEALTHY) {
          throw new Error(`Canary health check failed: ${result.message}`);
        }
      }

      // Check error rates
      const errorRate = await this.getErrorRate(version);

      if (errorRate > 0.05) {
        // 5% error rate threshold
        throw new Error(`Canary error rate too high: ${errorRate}`);
      }
    }
  }

  /**
   * Assess canary health
   */
  private async assessCanaryHealth(
    config: DeploymentConfig,
    version: string
  ): Promise<boolean> {
    // Compare metrics between versions
    const baselineMetrics = await this.getMetrics(config.previousVersion || '');
    const canaryMetrics = await this.getMetrics(version);

    // Check if canary metrics are within acceptable bounds
    const errorRateIncrease =
      (canaryMetrics.errorRate - baselineMetrics.errorRate) /
      baselineMetrics.errorRate;

    const latencyIncrease =
      (canaryMetrics.latency - baselineMetrics.latency) /
      baselineMetrics.latency;

    return (
      errorRateIncrease < 0.5 && // Less than 50% increase in errors
      latencyIncrease < 0.2 // Less than 20% increase in latency
    );
  }

  /**
   * Perform automatic rollback
   */
  private async performRollback(
    config: DeploymentConfig,
    state: DeploymentState
  ): Promise<void> {
    this.logger.info('Performing automatic rollback', {
      deploymentId: state.deploymentId,
    });

    try {
      await this.rollback(state.deploymentId, state.previousVersion);
    } catch (error: any) {
      this.logger.error('Automatic rollback failed', { error: error.message });
      // Send critical alert
    }
  }

  /**
   * Initialize deployment state
   */
  private initializeDeploymentState(config: DeploymentConfig): DeploymentState {
    return {
      deploymentId: config.id,
      status: DeploymentStatus.PENDING,
      phase: DeploymentPhase.VALIDATION,
      startTime: new Date(),
      targetVersion: config.manifest.version || 'latest',
      previousVersion: config.manifest.previousVersion,
      metrics: {
        healthCheckPasses: 0,
        healthCheckFailures: 0,
      },
    };
  }

  /**
   * Get deployer for target
   */
  private getDeployer(
    target: DeploymentTarget
  ): CloudflareDeployer | KubernetesDeployer {
    const key = `${target.type}-${target.provider}`;

    let deployer = this.deployers.get(key);

    if (!deployer) {
      switch (target.type) {
        case 'cloudflare_worker':
          deployer = new CloudflareDeployer(this.logger);
          break;
        case 'kubernetes':
          deployer = new KubernetesDeployer(this.logger);
          break;
        default:
          throw new Error(`Unsupported target type: ${target.type}`);
      }

      this.deployers.set(key, deployer);
    }

    return deployer;
  }

  /**
   * Validate deployment configuration
   */
  private async validateDeploymentConfig(config: DeploymentConfig): Promise<void> {
    // Validate required fields
    if (!config.id) {
      throw new Error('Deployment ID is required');
    }

    if (!config.target) {
      throw new Error('Deployment target is required');
    }

    if (!config.manifest) {
      throw new Error('Deployment manifest is required');
    }

    // Validate health check configuration
    if (config.healthChecks) {
      for (const healthCheck of config.healthChecks) {
        if (!healthCheck.name || !healthCheck.type || !healthCheck.config) {
          throw new Error('Invalid health check configuration');
        }
      }
    }

    this.logger.info('Deployment configuration validated');
  }

  /**
   * Check deployment prerequisites
   */
  private async checkDeploymentPrerequisites(
    config: DeploymentConfig
  ): Promise<void> {
    // Check if target is accessible
    const deployer = this.getDeployer(config.target);
    await deployer.checkPrerequisites(config);

    // Check resource availability
    await deployer.checkResourceAvailability(config);

    this.logger.info('Deployment prerequisites checked');
  }

  /**
   * Backup current state
   */
  private async backupCurrentState(config: DeploymentConfig): Promise<void> {
    const deployer = this.getDeployer(config.target);
    await deployer.backup(config);

    this.logger.info('Current state backed up');
  }

  /**
   * Get deployment state
   */
  getDeploymentState(deploymentId: string): DeploymentState | undefined {
    return this.activeDeployments.get(deploymentId);
  }

  /**
   * Get all active deployments
   */
  getActiveDeployments(): DeploymentState[] {
    return Array.from(this.activeDeployments.values());
  }

  /**
   * Cancel a deployment
   */
  async cancelDeployment(deploymentId: string): Promise<void> {
    const state = this.activeDeployments.get(deploymentId);

    if (!state) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (state.status === DeploymentStatus.SUCCESS) {
      throw new Error('Cannot cancel a completed deployment');
    }

    state.status = DeploymentStatus.CANCELLED;
    state.phase = DeploymentPhase.COMPLETE;
    state.endTime = new Date();

    this.logger.info('Deployment cancelled', { deploymentId });
  }

  /**
   * Send notifications
   */
  private async sendNotifications(
    notifications: any[],
    event: string,
    state: DeploymentState
  ): Promise<void> {
    // Implementation would send notifications via configured channels
    this.logger.info('Sending notifications', { event, count: notifications.length });
  }

  /**
   * Record deployment metrics
   */
  private recordDeploymentMetrics(state: DeploymentState): void {
    this.metrics.recordHistogram('deployment.duration', state.metrics.duration || 0);
    this.metrics.recordHistogram('deployment.health_check_passes', state.metrics.healthCheckPasses);
    this.metrics.recordHistogram('deployment.health_check_failures', state.metrics.healthCheckFailures);
  }

  /**
   * Get metrics for a version
   */
  private async getMetrics(version: string): Promise<any> {
    // Implementation would fetch metrics from monitoring system
    return {
      errorRate: 0.01,
      latency: 100,
    };
  }

  /**
   * Get error rate for a version
   */
  private async getErrorRate(version: string): Promise<number> {
    // Implementation would fetch error rate from monitoring system
    return 0.01;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
