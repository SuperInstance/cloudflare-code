/**
 * Advanced Sandbox Plugin
 *
 * Demonstrates how to use the enhanced sandbox with:
 * - Permission management
 * - Resource limits
 * - Secure execution
 * - Worker isolation
 */

import { Plugin } from '../core/plugin';
import { createWorkerSandbox, createDurableObjectSandbox } from '../sandbox/enhanced-sandbox';
import { PermissionManager } from '../permissions';
import { hooks } from '../hooks';

export class SandboxPlugin extends Plugin {
  private workerSandbox = this.useContext('workerSandbox') as ReturnType<typeof createWorkerSandbox>;
  private durableSandbox = this.useContext('durableSandbox') as ReturnType<typeof createDurableObjectSandbox>;
  private permissions = this.useContext('permissions') as PermissionManager;

  override async onLoad(): Promise<void> {
    await super.onLoad();

    // Initialize permission manager
    if (!this.permissions) {
      this.setContext('permissions', new PermissionManager({
        autoApproveSafe: true,
        requireExplicitDangerous: true,
        auditLogEnabled: true
      }));
      this.permissions = this.getContext('permissions') as PermissionManager;
    }

    // Initialize worker sandbox
    if (!this.workerSandbox) {
      this.workerSandbox = createWorkerSandbox(
        this.id,
        this.permissions,
        this.security,
        {
          maxMemory: 64 * 1024 * 1024, // 64MB
          maxExecutionTime: 10000, // 10 seconds
          networkAccess: true,
          allowedDomains: ['api.example.com'],
          logLevel: 'info'
        }
      );
      await this.workerSandbox.initialize();
      this.setContext('workerSandbox', this.workerSandbox);
    }

    // Initialize durable object sandbox
    if (!this.durableSandbox) {
      this.durableSandbox = createDurableObjectSandbox(
        this.id,
        this.permissions,
        this.security,
        {
          maxExecutionTime: 30000,
          storageAccess: true,
          logLevel: 'info'
        }
      );
      await this.durableSandbox.initialize();
      this.setContext('durableSandbox', this.durableSandbox);
    }

    this.logger.info('Sandbox plugin loaded');
  }

  override async onActivate(): Promise<void> {
    await super.onActivate();

    // Request necessary permissions
    await this.requestPermissions();

    // Register hooks
    this.registerHook(hooks.beforeAgentExecution, this.handleBeforeExecution.bind(this), {
      priority: 100
    });

    this.logger.info('Sandbox plugin activated');
  }

  /**
   * Request necessary permissions
   */
  private async requestPermissions(): Promise<void> {
    const requiredPermissions = [
      { scope: 'network.https' as const, description: 'Make HTTPS requests' },
      { scope: 'storage.kv' as const, description: 'Access KV storage' }
    ];

    for (const permission of requiredPermissions) {
      const hasPermission = await this.permissions.checkPermission(
        this.id,
        permission.scope
      );

      if (!hasPermission) {
        this.logger.info('Requesting permission', { scope: permission.scope });
        this.permissions.requestPermissions(this.id, [permission], permission.description);
      }
    }
  }

  /**
   * Execute code in worker sandbox
   */
  async executeInWorker(code: string, timeout = 5000): Promise<unknown> {
    if (!this.workerSandbox) {
      throw new Error('Worker sandbox not initialized');
    }

    try {
      const result = await this.workerSandbox.execute(code, {
        timeout,
        context: {
          logger: this.logger,
          console: console
        }
      });

      if (result.success) {
        this.logger.info('Worker execution succeeded', {
          executionTime: result.metrics.executionTime
        });
        return result.data;
      } else {
        this.logger.error('Worker execution failed', {
          error: result.error?.message
        });
        throw result.error;
      }
    } catch (error) {
      this.logger.error('Failed to execute in worker', { error });
      throw error;
    }
  }

  /**
   * Execute code in durable object sandbox
   */
  async executeInDurable(code: string, timeout = 10000): Promise<unknown> {
    if (!this.durableSandbox) {
      throw new Error('Durable sandbox not initialized');
    }

    try {
      const result = await this.durableSandbox.execute(code, {
        timeout,
        context: {
          state: this.durableSandbox.getState(),
          logger: this.logger
        }
      });

      if (result.success) {
        this.logger.info('Durable execution succeeded', {
          executionTime: result.metrics.executionTime
        });
        return result.data;
      } else {
        this.logger.error('Durable execution failed', {
          error: result.error?.message
        });
        throw result.error;
      }
    } catch (error) {
      this.logger.error('Failed to execute in durable', { error });
      throw error;
    }
  }

  /**
   * Execute with permission check
   */
  async executeWithPermission(
    scope: string,
    code: string,
    resource?: string
  ): Promise<unknown> {
    // Check permission
    const hasPermission = await this.permissions.checkPermission(
      this.id,
      scope as any,
      resource
    );

    if (!hasPermission) {
      throw new Error(`Permission denied: ${scope}`);
    }

    // Execute in worker sandbox
    return this.executeInWorker(code);
  }

  /**
   * Get sandbox statistics
   */
  getSandboxStats(): {
    worker: { active: boolean; executionCount: number };
    durable: { executionCount: number; metrics: unknown };
  } {
    return {
      worker: this.workerSandbox?.getStats() || { active: false, executionCount: 0 },
      durable: this.durableSandbox?.getStats() || { executionCount: 0, metrics: {} }
    };
  }

  /**
   * Get permission audit log
   */
  getPermissionAudit(): unknown[] {
    return this.permissions.getAuditLog({
      pluginId: this.id,
      limit: 100
    });
  }

  /**
   * Hook handler before agent execution
   */
  private async handleBeforeExecution(data: unknown): Promise<unknown> {
    this.logger.debug('Before agent execution hook called');

    // Check if we have required permissions
    const hasPermissions = await this.permissions.checkPermissions(
      this.id,
      [
        { scope: 'network.https' },
        { scope: 'storage.kv' }
      ]
    );

    if (!hasPermissions.get('network.https')) {
      this.logger.warn('Missing network.https permission');
    }

    return data;
  }

  override async onDeactivate(): Promise<void> {
    // Clean up sandboxes
    this.workerSandbox?.terminate();
    this.permissions?.revokeAllPermissions(this.id, 'system', 'Plugin deactivated');

    await super.onDeactivate();
  }
}

// Export for dynamic loading
export default SandboxPlugin;
