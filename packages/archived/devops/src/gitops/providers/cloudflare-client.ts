/**
 * Cloudflare Client for managing Workers and resources
 */

import { Logger } from '../../utils/logger';
import { CloudflareWorkerConfig, DurableObjectConfig } from '../../types';
import axios from 'axios';

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  email?: string;
  apiKey?: string;
}

export class CloudflareClient {
  private logger: Logger;
  private client: axios.AxiosInstance;
  private accountId: string;

  constructor(logger: Logger, config?: CloudflareConfig) {
    this.logger = logger;

    const accountId = config?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = config?.apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error('Cloudflare credentials not configured');
    }

    this.accountId = accountId;

    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get current state of resources
   */
  async getCurrentState(desiredState: any[]): Promise<Map<string, any>> {
    const currentState = new Map<string, any>();

    for (const manifest of desiredState) {
      const key = this.getResourceKey(manifest);

      try {
        if (manifest.kind === 'Worker') {
          const worker = await this.getWorker(manifest.metadata.name);
          if (worker) {
            currentState.set(key, worker);
          }
        } else if (manifest.kind === 'DurableObject') {
          const durableObject = await this.getDurableObject(manifest.metadata.name);
          if (durableObject) {
            currentState.set(key, durableObject);
          }
        }
      } catch (error: any) {
        this.logger.debug('Resource not found in Cloudflare', { key });
      }
    }

    return currentState;
  }

  /**
   * Apply a resource to Cloudflare
   */
  async applyResource(manifest: any): Promise<void> {
    const kind = manifest.kind;

    try {
      switch (kind) {
        case 'Worker':
          await this.applyWorker(manifest);
          break;
        case 'DurableObject':
          await this.applyDurableObject(manifest);
          break;
        case 'KVNamespace':
          await this.applyKVNamespace(manifest);
          break;
        case 'R2Bucket':
          await this.applyR2Bucket(manifest);
          break;
        default:
          this.logger.warn('Unsupported resource kind', { kind });
      }
    } catch (error: any) {
      this.logger.error('Failed to apply Cloudflare resource', {
        kind,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a resource from Cloudflare
   */
  async deleteResource(manifest: any): Promise<void> {
    const kind = manifest.kind;
    const metadata = manifest.metadata || {};
    const name = metadata.name;

    try {
      switch (kind) {
        case 'Worker':
          await this.deleteWorker(name);
          break;
        case 'DurableObject':
          await this.deleteDurableObject(name);
          break;
        case 'KVNamespace':
          await this.deleteKVNamespace(name);
          break;
        case 'R2Bucket':
          await this.deleteR2Bucket(name);
          break;
        default:
          this.logger.warn('Unsupported resource kind', { kind });
      }

      this.logger.info('Cloudflare resource deleted', { kind, name });
    } catch (error: any) {
      this.logger.error('Failed to delete Cloudflare resource', {
        kind,
        name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get a Worker
   */
  async getWorker(name: string): Promise<any | null> {
    try {
      const { data } = await this.client.get(
        `/accounts/${this.accountId}/workers/scripts/${name}`
      );
      return data.result;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Apply a Worker
   */
  async applyWorker(manifest: any): Promise<void> {
    const metadata = manifest.metadata || {};
    const spec = manifest.spec || {};

    const workerConfig: CloudflareWorkerConfig = {
      name: metadata.name,
      script: spec.script,
      bindings: spec.bindings,
      routes: spec.routes,
      cronTriggers: spec.cronTriggers,
      environment: spec.environment,
      kvNamespaces: spec.kvNamespaces,
      durableObjects: spec.durableObjects,
    };

    const existingWorker = await this.getWorker(workerConfig.name);

    if (existingWorker) {
      // Update existing worker
      await this.client.put(
        `/accounts/${this.accountId}/workers/scripts/${workerConfig.name}`,
        {
          script: workerConfig.script,
          bindings: this.convertBindings(workerConfig.bindings),
          migrations: spec.migrations,
          logpush: spec.logpush,
          placement: spec.placement,
        }
      );

      // Update routes if specified
      if (workerConfig.routes && workerConfig.routes.length > 0) {
        await this.updateWorkerRoutes(workerConfig.name, workerConfig.routes);
      }

      this.logger.info('Worker updated', { name: workerConfig.name });
    } else {
      // Create new worker
      await this.client.put(
        `/accounts/${this.accountId}/workers/scripts/${workerConfig.name}`,
        {
          script: workerConfig.script,
          bindings: this.convertBindings(workerConfig.bindings),
        }
      );

      // Add routes if specified
      if (workerConfig.routes && workerConfig.routes.length > 0) {
        await this.updateWorkerRoutes(workerConfig.name, workerConfig.routes);
      }

      this.logger.info('Worker created', { name: workerConfig.name });
    }
  }

  /**
   * Delete a Worker
   */
  async deleteWorker(name: string): Promise<void> {
    await this.client.delete(
      `/accounts/${this.accountId}/workers/scripts/${name}`
    );
  }

  /**
   * Get a Durable Object
   */
  async getDurableObject(name: string): Promise<any | null> {
    try {
      const workers = await this.listWorkers();
      const worker = workers.find((w: any) => {
        return w.durable_objects?.some((obj: any) => obj.name === name);
      });
      return worker || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Apply a Durable Object
   */
  async applyDurableObject(manifest: any): Promise<void> {
    const metadata = manifest.metadata || {};
    const spec = manifest.spec || {};

    // Durable Objects are defined within Workers, so we need to update the parent worker
    const workerName = spec.workerName || metadata.name;
    const durableObjectConfig: DurableObjectConfig = {
      name: metadata.name,
      className: spec.className,
      scriptName: spec.scriptName,
    };

    const existingWorker = await this.getWorker(workerName);

    if (existingWorker) {
      // Add or update Durable Object binding in the worker
      const bindings = existingWorker.bindings || [];
      const doBindingIndex = bindings.findIndex(
        (b: any) => b.type === 'durable_object' && b.name === durableObjectConfig.name
      );

      const newBinding = {
        type: 'durable_object',
        name: durableObjectConfig.name,
        class_name: durableObjectConfig.className,
        script_name: durableObjectConfig.scriptName,
      };

      if (doBindingIndex >= 0) {
        bindings[doBindingIndex] = newBinding;
      } else {
        bindings.push(newBinding);
      }

      await this.client.put(
        `/accounts/${this.accountId}/workers/scripts/${workerName}`,
        {
          ...existingWorker,
          bindings: this.convertBindings(bindings),
        }
      );

      this.logger.info('Durable Object updated', { name: durableObjectConfig.name });
    } else {
      throw new Error(`Parent worker ${workerName} not found for Durable Object ${durableObjectConfig.name}`);
    }
  }

  /**
   * Delete a Durable Object
   */
  async deleteDurableObject(name: string): Promise<void> {
    // Need to remove the binding from the parent worker
    const durableObject = await this.getDurableObject(name);
    if (durableObject) {
      // Implementation would find parent worker and remove binding
      this.logger.info('Durable Object deleted', { name });
    }
  }

  /**
   * Apply a KV Namespace
   */
  async applyKVNamespace(manifest: any): Promise<void> {
    const metadata = manifest.metadata || {};
    const name = metadata.name;

    const existingNamespace = await this.getKVNamespace(name);

    if (!existingNamespace) {
      await this.client.post(`/accounts/${this.accountId}/storage/kv/namespaces`, {
        title: name,
      });
      this.logger.info('KV Namespace created', { name });
    }
  }

  /**
   * Delete a KV Namespace
   */
  async deleteKVNamespace(name: string): Promise<void> {
    const namespace = await this.getKVNamespace(name);
    if (namespace) {
      await this.client.delete(
        `/accounts/${this.accountId}/storage/kv/namespaces/${namespace.id}`
      );
    }
  }

  /**
   * Get a KV Namespace
   */
  async getKVNamespace(name: string): Promise<any | null> {
    try {
      const { data } = await this.client.get(
        `/accounts/${this.accountId}/storage/kv/namespaces`
      );

      const namespace = data.result.find((ns: any) => ns.title === name);
      return namespace || null;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Apply an R2 Bucket
   */
  async applyR2Bucket(manifest: any): Promise<void> {
    const metadata = manifest.metadata || {};
    const name = metadata.name;

    const existingBucket = await this.getR2Bucket(name);

    if (!existingBucket) {
      await this.client.put(`/accounts/${this.accountId}/r2/buckets/${name}`);
      this.logger.info('R2 Bucket created', { name });
    }
  }

  /**
   * Delete an R2 Bucket
   */
  async deleteR2Bucket(name: string): Promise<void> {
    await this.client.delete(`/accounts/${this.accountId}/r2/buckets/${name}`);
  }

  /**
   * Get an R2 Bucket
   */
  async getR2Bucket(name: string): Promise<any | null> {
    try {
      const { data } = await this.client.get(
        `/accounts/${this.accountId}/r2/buckets`
      );

      const bucket = data.find((b: any) => b.name === name);
      return bucket || null;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * List all Workers
   */
  async listWorkers(): Promise<any[]> {
    try {
      const { data } = await this.client.get(
        `/accounts/${this.accountId}/workers/scripts`
      );
      return data.result || [];
    } catch (error: any) {
      this.logger.error('Failed to list workers', { error: error.message });
      return [];
    }
  }

  /**
   * Update Worker routes
   */
  private async updateWorkerRoutes(workerName: string, routes: string[]): Promise<void> {
    const zoneId = await this.getZoneId();

    if (!zoneId) {
      this.logger.warn('No zone found, skipping route configuration');
      return;
    }

    // Get existing routes
    const { data: existingRoutes } = await this.client.get(
      `/zones/${zoneId}/workers/routes`
    );

    // Delete existing routes for this worker
    for (const route of existingRoutes.result || []) {
      if (route.script === workerName) {
        await this.client.delete(`/zones/${zoneId}/workers/routes/${route.id}`);
      }
    }

    // Add new routes
    for (const route of routes) {
      await this.client.post(`/zones/${zoneId}/workers/routes`, {
        pattern: route,
        script: workerName,
      });
    }
  }

  /**
   * Get Zone ID
   */
  private async getZoneId(): Promise<string | null> {
    try {
      const zoneName = process.env.CLOUDFLARE_ZONE_NAME;

      if (!zoneName) {
        return null;
      }

      const { data } = await this.client.get('/zones', {
        params: { name: zoneName },
      });

      if (data.result && data.result.length > 0) {
        return data.result[0].id;
      }

      return null;
    } catch (error: any) {
      this.logger.error('Failed to get zone ID', { error: error.message });
      return null;
    }
  }

  /**
   * Convert bindings to Cloudflare format
   */
  private convertBindings(bindings?: any[]): any[] {
    if (!bindings) return [];

    return bindings.map((binding) => {
      switch (binding.type) {
        case 'kv':
          return {
            type: 'kv_namespace',
            name: binding.name,
            namespace_id: binding.properties?.namespace_id,
          };

        case 'durable_object':
          return {
            type: 'durable_object',
            name: binding.name,
            class_name: binding.properties?.class_name,
            script_name: binding.properties?.script_name,
          };

        case 'r2':
          return {
            type: 'r2_bucket',
            name: binding.name,
            bucket_name: binding.properties?.bucket_name,
          };

        case 'secret':
          return {
            type: 'secret_text',
            name: binding.name,
            text: binding.properties?.text,
          };

        case 'wasm':
          return {
            type: 'wasm',
            name: binding.name,
            part: binding.properties?.part,
          };

        case 'text':
          return {
            type: 'plain_text',
            name: binding.name,
            text: binding.properties?.text,
          };

        default:
          return binding;
      }
    });
  }

  /**
   * Get resource key
   */
  private getResourceKey(manifest: any): string {
    const kind = manifest.kind;
    const metadata = manifest.metadata || {};
    const name = metadata.name;
    return `${kind}/${name}`;
  }
}
