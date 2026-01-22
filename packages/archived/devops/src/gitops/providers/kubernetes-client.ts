/**
 * Kubernetes Client for applying and managing resources
 */

import { Logger } from '../../utils/logger';
import { KubernetesManifest } from '../../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class KubernetesClient {
  private logger: Logger;
  private context?: string;
  private namespace?: string;

  constructor(logger: Logger, context?: string, namespace?: string) {
    this.logger = logger;
    this.context = context;
    this.namespace = namespace;
  }

  /**
   * Get current state of resources in the cluster
   */
  async getCurrentState(desiredState: any[]): Promise<Map<string, any>> {
    const currentState = new Map<string, any>();

    for (const manifest of desiredState) {
      const key = this.getResourceKey(manifest);

      try {
        const resource = await this.getResource(manifest);
        if (resource) {
          currentState.set(key, resource);
        }
      } catch (error: any) {
        // Resource doesn't exist yet, which is fine
        this.logger.debug('Resource not found in cluster', { key });
      }
    }

    return currentState;
  }

  /**
   * Apply a resource to the cluster
   */
  async applyResource(manifest: any): Promise<void> {
    try {
      const yaml = this.manifestToYaml(manifest);
      const kubectlArgs = ['apply', '-f', '-'];

      if (this.context) {
        kubectlArgs.unshift('--context', this.context);
      }

      if (this.namespace) {
        kubectlArgs.unshift('--namespace', this.namespace);
      }

      const { stdout, stderr } = await execAsync(
        `kubectl ${kubectlArgs.join(' ')} <<'EOF'\n${yaml}\nEOF`
      );

      if (stderr && !stderr.includes('Warning')) {
        this.logger.warn('kubectl stderr', { stderr });
      }

      this.logger.info('Resource applied successfully', {
        key: this.getResourceKey(manifest),
        output: stdout.trim(),
      });
    } catch (error: any) {
      this.logger.error('Failed to apply resource', {
        key: this.getResourceKey(manifest),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a resource from the cluster
   */
  async deleteResource(manifest: any): Promise<void> {
    try {
      const yaml = this.manifestToYaml(manifest);
      const kubectlArgs = ['delete', '-f', '-'];

      if (this.context) {
        kubectlArgs.unshift('--context', this.context);
      }

      if (this.namespace) {
        kubectlArgs.unshift('--namespace', this.namespace);
      }

      const { stdout, stderr } = await execAsync(
        `kubectl ${kubectlArgs.join(' ')} <<'EOF'\n${yaml}\nEOF`
      );

      this.logger.info('Resource deleted successfully', {
        key: this.getResourceKey(manifest),
        output: stdout.trim(),
      });
    } catch (error: any) {
      this.logger.error('Failed to delete resource', {
        key: this.getResourceKey(manifest),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get a specific resource from the cluster
   */
  async getResource(manifest: any): Promise<any | null> {
    try {
      const kind = manifest.kind;
      const metadata = manifest.metadata || {};
      const name = metadata.name;
      const namespace = metadata.namespace || 'default';

      const kubectlArgs = [
        'get',
        kind.toLowerCase(),
        name,
        '-n',
        namespace,
        '-o',
        'json',
      ];

      if (this.context) {
        kubectlArgs.unshift('--context', this.context);
      }

      const { stdout } = await execAsync(`kubectl ${kubectlArgs.join(' ')}`);
      return JSON.parse(stdout);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Wait for a resource to be ready
   */
  async waitForResource(
    manifest: any,
    timeout: number = 300000
  ): Promise<void> {
    const key = this.getResourceKey(manifest);
    const startTime = Date.now();

    this.logger.info('Waiting for resource to be ready', { key, timeout });

    while (Date.now() - startTime < timeout) {
      try {
        const resource = await this.getResource(manifest);

        if (this.isResourceReady(resource)) {
          this.logger.info('Resource is ready', { key });
          return;
        }

        await this.sleep(5000);
      } catch (error: any) {
        this.logger.debug('Resource not ready yet', { key, error: error.message });
        await this.sleep(5000);
      }
    }

    throw new Error(`Timeout waiting for resource ${key} to be ready`);
  }

  /**
   * Check if a resource is ready
   */
  private isResourceReady(resource: any): boolean {
    if (!resource) return false;

    const kind = resource.kind;

    switch (kind) {
      case 'Deployment':
        return (
          resource.status?.readyReplicas === resource.spec?.replicas &&
          resource.status?.availableReplicas === resource.spec?.replicas
        );

      case 'StatefulSet':
        return (
          resource.status?.readyReplicas === resource.spec?.replicas &&
          resource.status?.currentReplicas === resource.spec?.replicas
        );

      case 'DaemonSet':
        return (
          resource.status?.numberReady === resource.status?.desiredNumberScheduled
        );

      case 'Service':
        return resource.status?.loadBalancer?.ingress?.length > 0;

      case 'Pod':
        return resource.status?.phase === 'Running';

      default:
        return true;
    }
  }

  /**
   * Get resource logs
   */
  async getLogs(manifest: any, container?: string): Promise<string> {
    try {
      const metadata = manifest.metadata || {};
      const name = metadata.name;
      const namespace = metadata.namespace || 'default';

      const kubectlArgs = ['logs', name, '-n', namespace];

      if (container) {
        kubectlArgs.push('-c', container);
      }

      if (this.context) {
        kubectlArgs.unshift('--context', this.context);
      }

      const { stdout } = await execAsync(`kubectl ${kubectlArgs.join(' ')}`);
      return stdout;
    } catch (error: any) {
      this.logger.error('Failed to get logs', {
        key: this.getResourceKey(manifest),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Scale a resource
   */
  async scaleResource(manifest: any, replicas: number): Promise<void> {
    try {
      const kind = manifest.kind;
      const metadata = manifest.metadata || {};
      const name = metadata.name;
      const namespace = metadata.namespace || 'default';

      const kubectlArgs = [
        'scale',
        kind.toLowerCase(),
        name,
        '--replicas',
        replicas.toString(),
        '-n',
        namespace,
      ];

      if (this.context) {
        kubectlArgs.unshift('--context', this.context);
      }

      await execAsync(`kubectl ${kubectlArgs.join(' ')}`);

      this.logger.info('Resource scaled successfully', {
        key: this.getResourceKey(manifest),
        replicas,
      });
    } catch (error: any) {
      this.logger.error('Failed to scale resource', {
        key: this.getResourceKey(manifest),
        replicas,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get resource key
   */
  private getResourceKey(manifest: any): string {
    const kind = manifest.kind;
    const metadata = manifest.metadata || {};
    const name = metadata.name;
    const namespace = metadata.namespace || 'default';
    return `${namespace}/${kind}/${name}`;
  }

  /**
   * Convert manifest to YAML
   */
  private manifestToYaml(manifest: any): string {
    // Remove status and metadata.resourceVersion
    const cleaned = { ...manifest };
    delete cleaned.status;
    if (cleaned.metadata) {
      delete cleaned.metadata.resourceVersion;
      delete cleaned.metadata.uid;
      delete cleaned.metadata.creationTimestamp;
      delete cleaned.metadata.selfLink;
    }
    return JSON.stringify(cleaned);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
