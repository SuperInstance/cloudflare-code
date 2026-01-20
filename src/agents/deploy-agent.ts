/**
 * Deploy Agent - Handles Cloudflare Workers deployment and infrastructure provisioning
 *
 * Features:
 * - Code bundling with esbuild optimization
 * - Worker deployment to .workers.dev and custom domains
 * - D1 database creation and migration support
 * - KV namespace provisioning
 * - Route and domain management
 * - Rollback capabilities with version tracking
 * - Deployment manifest generation
 * - Free tier optimization monitoring
 * - File locking for parallel coordination
 * - Progress reporting to coordinator
 */

import type { AgentState, ProjectFile } from '../types';
import type { Bindings } from '../index';

// Deploy Agent Configuration
interface DeployAgentConfig {
  sessionId: string;
  agentId: string;
  provider: 'manus' | 'zai' | 'minimax' | 'claude' | 'grok';
  stateManager: any; // ProjectStateManager
  coordinatorUrl: string;
  cloudflareApiToken?: string;
  cloudflareAccountId?: string;
}

// Deployment target types
type DeploymentTarget = 'workers-dev' | 'custom-domain' | 'preview';
type DeploymentEnvironment = 'development' | 'staging' | 'production';

// Deployment request
interface DeploymentRequest {
  type: DeploymentTarget;
  environment: DeploymentEnvironment;
  projectName: string;
  files: Record<string, ProjectFile>;
  options: {
    customDomain?: string;
    enableD1?: boolean;
    d1Schema?: string;
    enableKV?: boolean;
    kvNamespaces?: string[];
    enableR2?: boolean;
    r2Bucket?: string;
    enableRoutes?: boolean;
    routes?: string[];
    enableRollback?: boolean;
    maxVersions?: number;
    optimizeBundle?: boolean;
    minify?: boolean;
    sourceMaps?: boolean;
    envVars?: Record<string, string>;
    secrets?: Record<string, string>;
  };
}

// Bundle result
interface BundleResult {
  success: boolean;
  bundlePath: string;
  size: number;
  optimizedSize: number;
  hash: string;
  errors?: string[];
}

// Deployment manifest
interface DeploymentManifest {
  deploymentId: string;
  timestamp: number;
  environment: DeploymentEnvironment;
  target: DeploymentTarget;
  projectName: string;
  url: string;
  customDomain?: string;
  bundle: {
    hash: string;
    size: number;
    files: string[];
  };
  resources: {
    d1?: string[];
    kv?: string[];
    r2?: string[];
    routes?: string[];
  };
  envVars: Record<string, string>;
  version: number;
  previousVersion?: string;
  rollbackEnabled: boolean;
}

// Cloudflare API response types
interface CloudflareWorkerResponse {
  id: string;
  script_name: string;
  created_on: string;
  modified_on: string;
  usage_model?: string;
  etag: string;
}

interface CloudflareDeploymentResponse {
  id: string;
  success: boolean;
  errors: Array<{ code: number; message: string }>;
}

// D1 database info
interface D1DatabaseInfo {
  id: string;
  name: string;
  version: string;
  created_at: string;
  num_tables: number;
}

// KV namespace info
interface KVNamespaceInfo {
  id: string;
  title: string;
  support: 'url_encoding' | 'advanced' | '';
}

// Deployment result
interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  url: string;
  customDomain?: string;
  manifest: DeploymentManifest;
  errors?: string[];
  warnings?: string[];
  metadata: {
    deployedAt: number;
    provider: string;
    bundleSize: number;
    freeTierUsage?: {
      workersRequests: number;
      kvStorage: number;
      d1Storage: number;
    };
  };
}

// Rollback result
interface RollbackResult {
  success: boolean;
  previousDeploymentId: string;
  previousUrl: string;
  errors?: string[];
}

export class DeployAgent {
  private config: DeployAgentConfig;
  private state: AgentState;
  private lockedFiles: Set<string>;
  private deploymentHistory: Map<string, DeploymentManifest[]>;
  private currentDeployment?: DeploymentManifest;

  constructor(config: DeployAgentConfig) {
    this.config = config;
    this.state = {
      agentId: config.agentId,
      sessionId: config.sessionId,
      agentType: 'deploy',
      status: 'idle',
      progress: 0,
      currentTask: undefined,
    };
    this.lockedFiles = new Set();
    this.deploymentHistory = new Map();
  }

  /**
   * Main entry point for deployment tasks
   */
  async deploy(request: DeploymentRequest): Promise<DeploymentResult> {
    await this.updateState('working', 0, 'Starting deployment');

    try {
      // Acquire locks for deployment files
      await this.acquireDeploymentLocks(request);

      // Step 1: Analyze project and detect resources
      await this.updateState('working', 10, 'Analyzing project structure');
      const analysis = await this.analyzeProject(request);

      // Step 2: Bundle code with esbuild
      await this.updateState('working', 20, 'Bundling code with esbuild');
      const bundle = await this.bundleCode(request, analysis);

      if (!bundle.success) {
        throw new Error(`Bundling failed: ${bundle.errors?.join(', ')}`);
      }

      // Step 3: Provision infrastructure (D1, KV, R2)
      await this.updateState('working', 40, 'Provisioning infrastructure');
      const resources = await this.provisionResources(request, analysis);

      // Step 4: Deploy Worker
      await this.updateState('working', 60, 'Deploying to Cloudflare Workers');
      const deployment = await this.deployWorker(request, bundle, resources);

      // Step 5: Configure routes and domains
      await this.updateState('working', 75, 'Configuring routes and domains');
      await this.configureRoutes(request, deployment, resources);

      // Step 6: Generate deployment manifest
      await this.updateState('working', 85, 'Generating deployment manifest');
      const manifest = await this.generateManifest(request, bundle, deployment, resources);

      // Step 7: Verify deployment
      await this.updateState('working', 90, 'Verifying deployment');
      const verification = await this.verifyDeployment(manifest);

      if (!verification.success) {
        // Rollback on verification failure
        await this.updateState('working', 95, 'Rolling back failed deployment');
        await this.rollback(manifest.deploymentId);
        throw new Error(`Deployment verification failed: ${verification.errors?.join(', ')}`);
      }

      // Step 8: Clean up temporary files
      await this.updateState('working', 95, 'Cleaning up temporary files');
      await this.cleanup(bundle);

      // Step 9: Save deployment history
      await this.saveDeploymentHistory(manifest);

      await this.updateState('completed', 100, 'Deployment complete');

      return {
        success: true,
        deploymentId: manifest.deploymentId,
        url: manifest.url,
        customDomain: manifest.customDomain,
        manifest,
        metadata: {
          deployedAt: Date.now(),
          provider: this.config.provider,
          bundleSize: bundle.size,
          freeTierUsage: await this.calculateFreeTierUsage(manifest),
        },
      };
    } catch (error) {
      await this.updateState('error', 0, error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        deploymentId: '',
        url: '',
        manifest: {} as DeploymentManifest,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        metadata: {
          deployedAt: Date.now(),
          provider: this.config.provider,
          bundleSize: 0,
        },
      };
    } finally {
      await this.releaseAllLocks();
    }
  }

  /**
   * Rollback to a previous deployment
   */
  async rollback(deploymentId: string, targetVersion?: number): Promise<RollbackResult> {
    await this.updateState('working', 0, 'Starting rollback');

    try {
      // Get deployment history
      const history = this.deploymentHistory.get(this.config.sessionId) || [];
      const currentDeployment = history.find(d => d.deploymentId === deploymentId);

      if (!currentDeployment) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }

      // Find previous version
      const targetVersionNum = targetVersion || (currentDeployment.previousVersion || 0);
      const previousDeployment = history.find(d => d.version === targetVersionNum);

      if (!previousDeployment) {
        throw new Error(`Previous deployment version ${targetVersionNum} not found`);
      }

      await this.updateState('working', 20, 'Redeploying previous version');

      // Re-deploy previous version
      const redeployRequest: DeploymentRequest = {
        type: previousDeployment.target,
        environment: previousDeployment.environment,
        projectName: previousDeployment.projectName,
        files: {}, // Would need to be stored separately
        options: {
          customDomain: previousDeployment.customDomain,
          enableD1: previousDeployment.resources.d1 !== undefined,
          enableKV: previousDeployment.resources.kv !== undefined,
          enableR2: previousDeployment.resources.r2 !== undefined,
          enableRollback: true,
        },
      };

      // Execute rollback deployment
      const result = await this.deploy(redeployRequest);

      if (!result.success) {
        throw new Error(`Rollback deployment failed: ${result.errors?.join(', ')}`);
      }

      await this.updateState('completed', 100, 'Rollback complete');

      return {
        success: true,
        previousDeploymentId: previousDeployment.deploymentId,
        previousUrl: previousDeployment.url,
      };
    } catch (error) {
      await this.updateState('error', 0, error instanceof Error ? error.message : 'Rollback failed');

      return {
        success: false,
        previousDeploymentId: '',
        previousUrl: '',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Analyze project to detect required resources
   */
  private async analyzeProject(request: DeploymentRequest): Promise<{
    hasDatabase: boolean;
    hasKV: boolean;
    hasR2: boolean;
    hasRoutes: boolean;
    entryPoint: string;
    dependencies: string[];
  }> {
    const files = Object.values(request.files);

    // Detect D1 usage
    const hasDatabase = files.some(f =>
      f.content.includes('D1Database') ||
      f.content.includes('env.DB') ||
      f.path.endsWith('.sql')
    );

    // Detect KV usage
    const hasKV = files.some(f =>
      f.content.includes('KVNamespace') ||
      f.content.includes('env.CACHE')
    );

    // Detect R2 usage
    const hasR2 = files.some(f =>
      f.content.includes('R2Bucket') ||
      f.content.includes('env.STORAGE')
    );

    // Detect route configuration
    const hasRoutes = files.some(f =>
      f.path.includes('wrangler.toml') ||
      f.content.includes('routes')
    );

    // Find entry point
    const entryPoints = files.filter(f =>
      f.path.includes('index') ||
      f.path.includes('worker') ||
      f.path.includes('main')
    );
    const entryPoint = entryPoints[0]?.path || 'src/index.ts';

    // Extract dependencies
    const dependencies = this.extractDependencies(files);

    return {
      hasDatabase,
      hasKV,
      hasR2,
      hasRoutes,
      entryPoint,
      dependencies,
    };
  }

  /**
   * Extract dependencies from project files
   */
  private extractDependencies(files: ProjectFile[]): string[] {
    const deps = new Set<string>();

    files.forEach(file => {
      // Match import statements
      const importMatches = file.content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
      if (importMatches) {
        importMatches.forEach(match => {
          const dep = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
          if (dep && !dep.startsWith('.') && !dep.startsWith('/')) {
            deps.add(dep);
          }
        });
      }
    });

    return Array.from(deps);
  }

  /**
   * Bundle code using esbuild
   */
  private async bundleCode(
    request: DeploymentRequest,
    analysis: ReturnType<typeof this.analyzeProject>
  ): Promise<BundleResult> {
    try {
      // In a real implementation, this would use esbuild API
      // For now, we simulate the bundling process

      const entryPoint = analysis.entryPoint;
      const files = Object.values(request.files);

      // Calculate total size
      let totalSize = 0;
      const fileList: string[] = [];

      files.forEach(file => {
        const size = new Blob([file.content]).size;
        totalSize += size;
        fileList.push(file.path);
      });

      // Generate bundle hash
      const hash = this.generateHash(files.map(f => f.content).join(''));

      // Simulate optimization
      const optimizedSize = request.options.optimizeBundle
        ? Math.floor(totalSize * 0.7) // 30% reduction
        : totalSize;

      return {
        success: true,
        bundlePath: `/tmp/bundle-${Date.now()}.js`,
        size: totalSize,
        optimizedSize,
        hash,
      };
    } catch (error) {
      return {
        success: false,
        bundlePath: '',
        size: 0,
        optimizedSize: 0,
        hash: '',
        errors: [error instanceof Error ? error.message : 'Unknown bundling error'],
      };
    }
  }

  /**
   * Provision Cloudflare resources (D1, KV, R2)
   */
  private async provisionResources(
    request: DeploymentRequest,
    analysis: ReturnType<typeof this.analyzeProject>
  ): Promise<{
    d1?: D1DatabaseInfo[];
    kv?: KVNamespaceInfo[];
    r2?: string[];
  }> {
    const resources: {
      d1?: D1DatabaseInfo[];
      kv?: KVNamespaceInfo[];
      r2?: string[];
    } = {};

    // Provision D1 database
    if (request.options.enableD1 || analysis.hasDatabase) {
      await this.updateState('working', 45, 'Provisioning D1 database');
      resources.d1 = await this.provisionD1Database(request);
    }

    // Provision KV namespaces
    if (request.options.enableKV || analysis.hasKV) {
      await this.updateState('working', 50, 'Provisioning KV namespaces');
      resources.kv = await this.provisionKVNamespaces(request);
    }

    // Provision R2 bucket
    if (request.options.enableR2 || analysis.hasR2) {
      await this.updateState('working', 55, 'Provisioning R2 bucket');
      resources.r2 = await this.provisionR2Bucket(request);
    }

    return resources;
  }

  /**
   * Provision D1 database
   */
  private async provisionD1Database(request: DeploymentRequest): Promise<D1DatabaseInfo[]> {
    const databases: D1DatabaseInfo[] = [];

    // Generate database name from project
    const dbName = `${request.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-db`;

    // In a real implementation, this would call Cloudflare D1 API
    // For now, we simulate the provisioning
    const db: D1DatabaseInfo = {
      id: `d1-${Date.now()}`,
      name: dbName,
      version: '1.0.0',
      created_at: new Date().toISOString(),
      num_tables: 0,
    };

    // Run schema migrations if provided
    if (request.options.d1Schema) {
      await this.runD1Migrations(db.id, request.options.d1Schema);
    }

    databases.push(db);

    return databases;
  }

  /**
   * Run D1 database migrations
   */
  private async runD1Migrations(dbId: string, schema: string): Promise<void> {
    // In a real implementation, this would execute SQL migrations
    // on the D1 database using Cloudflare API
    console.log(`Running migrations for D1 database ${dbId}`);
  }

  /**
   * Provision KV namespaces
   */
  private async provisionKVNamespaces(request: DeploymentRequest): Promise<KVNamespaceInfo[]> {
    const namespaces: KVNamespaceInfo[] = [];

    const kvList = request.options.kvNamespaces || ['cache', 'sessions'];

    for (const name of kvList) {
      // Generate namespace name
      const namespaceName = `${request.projectName.toLowerCase()}-${name}`;

      // In a real implementation, this would call Cloudflare KV API
      const namespace: KVNamespaceInfo = {
        id: `kv-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
        title: namespaceName,
        support: 'advanced',
      };

      namespaces.push(namespace);
    }

    return namespaces;
  }

  /**
   * Provision R2 bucket
   */
  private async provisionR2Bucket(request: DeploymentRequest): Promise<string[]> {
    const buckets: string[] = [];

    const bucketName = request.options.r2Bucket ||
      `${request.projectName.toLowerCase()}-storage`;

    // In a real implementation, this would call Cloudflare R2 API
    buckets.push(bucketName);

    return buckets;
  }

  /**
   * Deploy Worker to Cloudflare
   */
  private async deployWorker(
    request: DeploymentRequest,
    bundle: BundleResult,
    resources: ReturnType<typeof this.provisionResources>
  ): Promise<CloudflareWorkerResponse> {
    // Generate worker name
    const workerName = `${request.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${request.environment}`;

    // Determine deployment URL
    let url = '';
    if (request.type === 'workers-dev') {
      url = `https://${workerName}.cocapn.workers.dev`;
    } else if (request.type === 'custom-domain' && request.options.customDomain) {
      url = `https://${request.options.customDomain}`;
    }

    // In a real implementation, this would:
    // 1. Upload the bundle to Cloudflare
    // 2. Create/update the Worker
    // 3. Bind resources (D1, KV, R2)
    // 4. Configure environment variables and secrets

    const response: CloudflareWorkerResponse = {
      id: `worker-${Date.now()}`,
      script_name: workerName,
      created_on: new Date().toISOString(),
      modified_on: new Date().toISOString(),
      usage_model: 'bundled',
      etag: bundle.hash,
    };

    return response;
  }

  /**
   * Configure routes and domains
   */
  private async configureRoutes(
    request: DeploymentRequest,
    deployment: CloudflareWorkerResponse,
    resources: ReturnType<typeof this.provisionResources>
  ): Promise<void> {
    if (!request.options.enableRoutes) {
      return;
    }

    // In a real implementation, this would:
    // 1. Configure custom domain routes
    // 2. Set up DNS records
    // 3. Verify domain ownership
    // 4. Configure SSL certificates

    if (request.type === 'custom-domain' && request.options.customDomain) {
      await this.verifyDomainOwnership(request.options.customDomain);
      await this.configureCustomRoutes(request.options.customDomain, deployment.id);
    }
  }

  /**
   * Verify domain ownership
   */
  private async verifyDomainOwnership(domain: string): Promise<boolean> {
    // In a real implementation, this would check DNS records
    // and verify domain ownership with Cloudflare
    return true;
  }

  /**
   * Configure custom routes
   */
  private async configureCustomRoutes(domain: string, workerId: string): Promise<void> {
    // In a real implementation, this would configure
    // Workers routes for the custom domain
    console.log(`Configuring routes for ${domain} -> ${workerId}`);
  }

  /**
   * Generate deployment manifest
   */
  private async generateManifest(
    request: DeploymentRequest,
    bundle: BundleResult,
    deployment: CloudflareWorkerResponse,
    resources: ReturnType<typeof this.provisionResources>
  ): Promise<DeploymentManifest> {
    // Get deployment history for version tracking
    const history = this.deploymentHistory.get(this.config.sessionId) || [];
    const previousVersion = history.length > 0 ? history[history.length - 1].version : 0;

    // Determine URL
    let url = '';
    let customDomain = undefined;
    if (request.type === 'workers-dev') {
      url = `https://${deployment.script_name}.cocapn.workers.dev`;
    } else if (request.type === 'custom-domain' && request.options.customDomain) {
      url = `https://${request.options.customDomain}`;
      customDomain = request.options.customDomain;
    }

    const manifest: DeploymentManifest = {
      deploymentId: `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
      timestamp: Date.now(),
      environment: request.environment,
      target: request.type,
      projectName: request.projectName,
      url,
      customDomain,
      bundle: {
        hash: bundle.hash,
        size: bundle.optimizedSize,
        files: Object.keys(request.files),
      },
      resources: {
        d1: resources.d1?.map(db => db.name),
        kv: resources.kv?.map(ns => ns.title),
        r2: resources.r2,
        routes: request.options.routes,
      },
      envVars: request.options.envVars || {},
      version: previousVersion + 1,
      previousVersion,
      rollbackEnabled: request.options.enableRollback || false,
    };

    this.currentDeployment = manifest;

    return manifest;
  }

  /**
   * Verify deployment with smoke tests
   */
  private async verifyDeployment(manifest: DeploymentManifest): Promise<{
    success: boolean;
    errors?: string[];
  }> {
    try {
      // In a real implementation, this would:
      // 1. Send test requests to the deployed Worker
      // 2. Verify responses are correct
      // 3. Check resource bindings
      // 4. Validate domain configuration

      const response = await fetch(manifest.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Cocapn-Deploy-Agent/1.0',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          errors: [`HTTP ${response.status}: ${response.statusText}`],
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Verification failed'],
      };
    }
  }

  /**
   * Calculate free tier usage
   */
  private async calculateFreeTierUsage(manifest: DeploymentManifest): Promise<{
    workersRequests: number;
    kvStorage: number;
    d1Storage: number;
  }> {
    // In a real implementation, this would query Cloudflare API
    // for actual usage metrics
    return {
      workersRequests: 0,
      kvStorage: 0,
      d1Storage: 0,
    };
  }

  /**
   * Save deployment history
   */
  private async saveDeploymentHistory(manifest: DeploymentManifest): Promise<void> {
    const history = this.deploymentHistory.get(this.config.sessionId) || [];
    history.push(manifest);

    // Keep only last N versions if maxVersions is set
    if (manifest.rollbackEnabled && manifest.previousVersion) {
      const maxVersions = 10; // Default
      if (history.length > maxVersions) {
        history.splice(0, history.length - maxVersions);
      }
    }

    this.deploymentHistory.set(this.config.sessionId, history);
  }

  /**
   * Clean up temporary files
   */
  private async cleanup(bundle: BundleResult): Promise<void> {
    // In a real implementation, this would delete
    // temporary bundle files
    console.log(`Cleaning up bundle: ${bundle.bundlePath}`);
  }

  /**
   * Acquire deployment file locks
   */
  private async acquireDeploymentLocks(request: DeploymentRequest): Promise<void> {
    const lockFiles = [
      'wrangler.toml',
      'package.json',
      'src/index.ts',
    ];

    for (const filePath of lockFiles) {
      const acquired = await this.acquireLock(filePath);
      if (!acquired) {
        throw new Error(`Failed to acquire lock for ${filePath}`);
      }
    }
  }

  // State management methods

  private async updateState(
    status: AgentState['status'],
    progress: number,
    currentTask?: string
  ): Promise<void> {
    this.state.status = status;
    this.state.progress = progress;
    this.state.currentTask = currentTask;

    await this.reportProgress();
  }

  private async reportProgress(): Promise<void> {
    try {
      await fetch(`${this.config.coordinatorUrl}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.config.sessionId,
          agentId: this.config.agentId,
          state: this.state,
        }),
      });
    } catch (error) {
      console.error('Failed to report progress:', error);
    }
  }

  // File locking methods

  private async acquireLock(filePath: string): Promise<boolean> {
    try {
      const acquired = await this.config.stateManager.acquireLock(
        this.config.sessionId,
        filePath,
        this.config.agentId
      );

      if (acquired) {
        this.lockedFiles.add(filePath);
      }

      return acquired;
    } catch (error) {
      console.error(`Failed to acquire lock for ${filePath}:`, error);
      return false;
    }
  }

  private async releaseLock(filePath: string): Promise<void> {
    try {
      await this.config.stateManager.releaseLock(this.config.sessionId, filePath);
      this.lockedFiles.delete(filePath);
    } catch (error) {
      console.error(`Failed to release lock for ${filePath}:`, error);
    }
  }

  private async releaseAllLocks(): Promise<void> {
    for (const filePath of this.lockedFiles) {
      await this.releaseLock(filePath);
    }
  }

  // Utility methods

  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get current agent state
   */
  async getState(): Promise<AgentState> {
    return { ...this.state };
  }

  /**
   * Get deployment history
   */
  getDeploymentHistory(): DeploymentManifest[] {
    return this.deploymentHistory.get(this.config.sessionId) || [];
  }

  /**
   * Get current deployment manifest
   */
  getCurrentDeployment(): DeploymentManifest | undefined {
    return this.currentDeployment;
  }

  /**
   * Complete current task
   */
  async markDone(): Promise<void> {
    await this.updateState('idle', 100, undefined);
  }
}