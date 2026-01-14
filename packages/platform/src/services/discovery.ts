/**
 * Service Discovery
 *
 * Automatic service discovery and registration for all ClaudeFlare packages.
 */

import type {
  ServiceType,
  ServiceInstance,
  ServiceRegistrationOptions,
} from '../types/core';
import { ServicePriority } from '../types/core';

/**
 * Service discovery configuration
 */
export interface ServiceDiscoveryConfig {
  readonly packages: ReadonlyArray<PackageConfig>;
  readonly autoRegister: boolean;
  readonly healthCheckInterval: number;
  readonly enableDiscovery: boolean;
}

/**
 * Package configuration
 */
export interface PackageConfig {
  readonly name: string;
  readonly version: string;
  readonly services: ReadonlyArray<ServiceConfig>;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  readonly id: string;
  readonly type: ServiceType;
  readonly priority: ServicePriority;
  readonly dependencies: readonly string[];
  readonly tags: readonly string[];
  readonly enabled: boolean;
}

/**
 * Package service definitions
 */
export const PACKAGE_SERVICES: ReadonlyArray<PackageConfig> = [
  {
    name: '@claudeflare/edge',
    version: '0.1.0',
    services: [
      {
        id: 'edge:api',
        type: ServiceType.STORAGE_KV,
        priority: ServicePriority.HIGH,
        dependencies: [],
        tags: ['api', 'edge', 'http'],
        enabled: true,
      },
      {
        id: 'edge:router',
        type: ServiceType.LOAD_BALANCER,
        priority: ServicePriority.HIGH,
        dependencies: [],
        tags: ['routing', 'edge'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/events',
    version: '0.1.0',
    services: [
      {
        id: 'events:bus',
        type: ServiceType.EVENT_BUS,
        priority: ServicePriority.CRITICAL,
        dependencies: [],
        tags: ['events', 'core', 'durable-objects'],
        enabled: true,
      },
      {
        id: 'events:streaming',
        type: ServiceType.EVENT_BUS,
        priority: ServicePriority.HIGH,
        dependencies: ['events:bus'],
        tags: ['events', 'streaming'],
        enabled: true,
      },
      {
        id: 'events:sourcing',
        type: ServiceType.STORAGE_D1,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus'],
        tags: ['events', 'sourcing', 'database'],
        enabled: true,
      },
      {
        id: 'events:queue',
        type: ServiceType.DURABLE_OBJECTS,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus'],
        tags: ['events', 'queue', 'messaging'],
        enabled: true,
      },
      {
        id: 'events:replay',
        type: ServiceType.DURABLE_OBJECTS,
        priority: ServicePriority.LOW,
        dependencies: ['events:sourcing'],
        tags: ['events', 'replay', 'debugging'],
        enabled: true,
      },
      {
        id: 'events:saga',
        type: ServiceType.DURABLE_OBJECTS,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus'],
        tags: ['events', 'saga', 'orchestration'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/ai',
    version: '0.1.0',
    services: [
      {
        id: 'ai:provider',
        type: ServiceType.AI_PROVIDER,
        priority: ServicePriority.HIGH,
        dependencies: [],
        tags: ['ai', 'llm', 'inference'],
        enabled: true,
      },
      {
        id: 'ai:embeddings',
        type: ServiceType.EMBEDDINGS,
        priority: ServicePriority.NORMAL,
        dependencies: ['ai:provider'],
        tags: ['ai', 'embeddings', 'vectors'],
        enabled: true,
      },
      {
        id: 'ai:semantic-cache',
        type: ServiceType.SEMANTIC_CACHE,
        priority: ServicePriority.NORMAL,
        dependencies: ['ai:embeddings', 'cache'],
        tags: ['ai', 'cache', 'semantic'],
        enabled: true,
      },
      {
        id: 'ai:rag-indexer',
        type: ServiceType.RAG_INDEXER,
        priority: ServicePriority.NORMAL,
        dependencies: ['ai:embeddings', 'storage:vector'],
        tags: ['ai', 'rag', 'indexing'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/agents',
    version: '0.1.0',
    services: [
      {
        id: 'agents:orchestrator',
        type: ServiceType.AGENT_ORCHESTRATOR,
        priority: ServicePriority.HIGH,
        dependencies: ['ai:provider', 'events:bus'],
        tags: ['agents', 'orchestration', 'ai'],
        enabled: true,
      },
      {
        id: 'agents:registry',
        type: ServiceType.STORAGE_KV,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus'],
        tags: ['agents', 'registry', 'storage'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/storage',
    version: '0.1.0',
    services: [
      {
        id: 'storage:kv',
        type: ServiceType.STORAGE_KV,
        priority: ServicePriority.HIGH,
        dependencies: [],
        tags: ['storage', 'kv', 'key-value'],
        enabled: true,
      },
      {
        id: 'storage:r2',
        type: ServiceType.STORAGE_R2,
        priority: ServicePriority.NORMAL,
        dependencies: [],
        tags: ['storage', 'r2', 'object-storage'],
        enabled: true,
      },
      {
        id: 'storage:d1',
        type: ServiceType.STORAGE_D1,
        priority: ServicePriority.NORMAL,
        dependencies: [],
        tags: ['storage', 'd1', 'database', 'sql'],
        enabled: true,
      },
      {
        id: 'storage:vector',
        type: ServiceType.DURABLE_OBJECTS,
        priority: ServicePriority.NORMAL,
        dependencies: ['storage:d1'],
        tags: ['storage', 'vectors', 'embeddings'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/cache',
    version: '0.1.0',
    services: [
      {
        id: 'cache:l1',
        type: ServiceType.CACHE,
        priority: ServicePriority.HIGH,
        dependencies: [],
        tags: ['cache', 'l1', 'memory'],
        enabled: true,
      },
      {
        id: 'cache:l2',
        type: ServiceType.CACHE,
        priority: ServicePriority.NORMAL,
        dependencies: ['storage:kv'],
        tags: ['cache', 'l2', 'persistent'],
        enabled: true,
      },
      {
        id: 'cache:multi',
        type: ServiceType.CACHE,
        priority: ServicePriority.NORMAL,
        dependencies: ['cache:l1', 'cache:l2'],
        tags: ['cache', 'multi-level', 'distributed'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/security',
    version: '0.1.0',
    services: [
      {
        id: 'security:auth',
        type: ServiceType.AUTHENTICATION,
        priority: ServicePriority.CRITICAL,
        dependencies: ['storage:kv'],
        tags: ['security', 'auth', 'authentication'],
        enabled: true,
      },
      {
        id: 'security:authorization',
        type: ServiceType.AUTHORIZATION,
        priority: ServicePriority.HIGH,
        dependencies: ['security:auth', 'storage:d1'],
        tags: ['security', 'authorization', 'rbac'],
        enabled: true,
      },
      {
        id: 'security:encryption',
        type: ServiceType.ENCRYPTION,
        priority: ServicePriority.NORMAL,
        dependencies: [],
        tags: ['security', 'encryption', 'crypto'],
        enabled: true,
      },
      {
        id: 'security:audit',
        type: ServiceType.AUDIT_LOGGING,
        priority: ServicePriority.HIGH,
        dependencies: ['events:bus', 'storage:d1'],
        tags: ['security', 'audit', 'logging'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/monitoring',
    version: '0.1.0',
    services: [
      {
        id: 'monitoring:metrics',
        type: ServiceType.MONITORING,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus'],
        tags: ['monitoring', 'metrics', 'telemetry'],
        enabled: true,
      },
      {
        id: 'monitoring:tracing',
        type: ServiceType.MONITORING,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus'],
        tags: ['monitoring', 'tracing', 'observability'],
        enabled: true,
      },
      {
        id: 'monitoring:logging',
        type: ServiceType.MONITORING,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus'],
        tags: ['monitoring', 'logging', 'analytics'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/loadbalancer',
    version: '0.1.0',
    services: [
      {
        id: 'loadbalancer:router',
        type: ServiceType.LOAD_BALANCER,
        priority: ServicePriority.HIGH,
        dependencies: ['monitoring:metrics'],
        tags: ['loadbalancer', 'routing', 'traffic'],
        enabled: true,
      },
      {
        id: 'loadbalancer:health',
        type: ServiceType.MONITORING,
        priority: ServicePriority.NORMAL,
        dependencies: ['monitoring:metrics'],
        tags: ['loadbalancer', 'health', 'checks'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/autoscaling',
    version: '0.1.0',
    services: [
      {
        id: 'autoscaling:manager',
        type: ServiceType.LOAD_BALANCER,
        priority: ServicePriority.NORMAL,
        dependencies: ['monitoring:metrics', 'loadbalancer:router'],
        tags: ['autoscaling', 'scaling', 'elastic'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/cli',
    version: '0.1.0',
    services: [
      {
        id: 'cli:executor',
        type: ServiceType.CLI,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus', 'security:auth'],
        tags: ['cli', 'terminal', 'commands'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/vscode',
    version: '0.1.0',
    services: [
      {
        id: 'vscode:extension',
        type: ServiceType.VS_CODE_EXTENSION,
        priority: ServicePriority.LOW,
        dependencies: ['cli:executor'],
        tags: ['vscode', 'extension', 'ide'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/dashboard',
    version: '0.1.0',
    services: [
      {
        id: 'dashboard:api',
        type: ServiceType.DASHBOARD,
        priority: ServicePriority.NORMAL,
        dependencies: ['security:auth', 'monitoring:metrics'],
        tags: ['dashboard', 'ui', 'web'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/developer-portal',
    version: '0.1.0',
    services: [
      {
        id: 'portal:api',
        type: ServiceType.DEVELOPER_PORTAL,
        priority: ServicePriority.NORMAL,
        dependencies: ['security:auth', 'dashboard:api'],
        tags: ['portal', 'api', 'developers'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/database',
    version: '0.1.0',
    services: [
      {
        id: 'database:pool',
        type: ServiceType.STORAGE_D1,
        priority: ServicePriority.HIGH,
        dependencies: [],
        tags: ['database', 'connection-pool', 'sql'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/workflows',
    version: '0.1.0',
    services: [
      {
        id: 'workflows:engine',
        type: ServiceType.DURABLE_OBJECTS,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus', 'storage:d1'],
        tags: ['workflows', 'orchestration', 'automation'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/pipelines',
    version: '0.1.0',
    services: [
      {
        id: 'pipelines:executor',
        type: ServiceType.DURABLE_OBJECTS,
        priority: ServicePriority.NORMAL,
        dependencies: ['workflows:engine', 'events:bus'],
        tags: ['pipelines', 'processing', 'etl'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/federated',
    version: '0.1.0',
    services: [
      {
        id: 'federated:coordinator',
        type: ServiceType.DURABLE_OBJECTS,
        priority: ServicePriority.NORMAL,
        dependencies: ['events:bus', 'security:encryption'],
        tags: ['federated', 'distributed', 'ml'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/xai',
    version: '0.1.0',
    services: [
      {
        id: 'xai:explainer',
        type: ServiceType.AI_PROVIDER,
        priority: ServicePriority.LOW,
        dependencies: ['ai:provider'],
        tags: ['xai', 'explainability', 'interpretability'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/rl',
    version: '0.1.0',
    services: [
      {
        id: 'rl:trainer',
        type: ServiceType.AI_PROVIDER,
        priority: ServicePriority.LOW,
        dependencies: ['ai:provider', 'storage:d1'],
        tags: ['rl', 'reinforcement', 'training'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/multimodal',
    version: '0.1.0',
    services: [
      {
        id: 'multimodal:processor',
        type: ServiceType.AI_PROVIDER,
        priority: ServicePriority.NORMAL,
        dependencies: ['ai:provider', 'storage:r2'],
        tags: ['multimodal', 'vision', 'audio'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/marketplace',
    version: '0.1.0',
    services: [
      {
        id: 'marketplace:registry',
        type: ServiceType.STORAGE_D1,
        priority: ServicePriority.NORMAL,
        dependencies: ['security:auth', 'storage:d1'],
        tags: ['marketplace', 'registry', 'agents'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/observability',
    version: '0.1.0',
    services: [
      {
        id: 'observability:collector',
        type: ServiceType.MONITORING,
        priority: ServicePriority.NORMAL,
        dependencies: ['monitoring:metrics', 'monitoring:tracing'],
        tags: ['observability', 'collector', 'telemetry'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/compliance',
    version: '0.1.0',
    services: [
      {
        id: 'compliance:checker',
        type: ServiceType.AUDIT_LOGGING,
        priority: ServicePriority.NORMAL,
        dependencies: ['security:audit', 'storage:d1'],
        tags: ['compliance', 'policy', 'regulations'],
        enabled: true,
      },
    ],
  },
  {
    name: '@claudeflare/governance',
    version: '0.1.0',
    services: [
      {
        id: 'governance:policy',
        type: ServiceType.AUTHORIZATION,
        priority: ServicePriority.NORMAL,
        dependencies: ['security:authorization', 'storage:d1'],
        tags: ['governance', 'policy', 'rules'],
        enabled: true,
      },
    ],
  },
];

/**
 * Service discovery class
 */
export class ServiceDiscovery {
  private config: ServiceDiscoveryConfig;

  constructor(config?: Partial<ServiceDiscoveryConfig>) {
    this.config = {
      packages: PACKAGE_SERVICES,
      autoRegister: true,
      healthCheckInterval: 30000,
      enableDiscovery: true,
      ...config,
    };
  }

  /**
   * Discover all services from packages
   */
  discoverServices(): ReadonlyArray<{
    package: string;
    service: ServiceConfig;
    options: ServiceRegistrationOptions;
  }> {
    const discoveries: Array<{
      package: string;
      service: ServiceConfig;
      options: ServiceRegistrationOptions;
    }> = [];

    for (const pkg of this.config.packages) {
      for (const service of pkg.services) {
        if (!service.enabled) {
          continue;
        }

        discoveries.push({
          package: pkg.name,
          service,
          options: {
            name: `${pkg.name}:${service.id}`,
            type: service.type,
            version: pkg.version,
            priority: service.priority,
            dependencies: service.dependencies,
            tags: service.tags,
            singleton: true,
            lazy: false,
          },
        });
      }
    }

    return discoveries;
  }

  /**
   * Get services by priority order
   */
  getServicesByPriority(
    services: ReadonlyArray<{
      package: string;
      service: ServiceConfig;
      options: ServiceRegistrationOptions;
    }>
  ): ReadonlyArray<typeof services[number]> {
    return [...services].sort(
      (a, b) => a.service.priority - b.service.priority
    );
  }

  /**
   * Build dependency graph
   */
  buildDependencyGraph(): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const pkg of this.config.packages) {
      for (const service of pkg.services) {
        if (!service.enabled) {
          continue;
        }

        const key = `${pkg.name}:${service.id}`;
        graph.set(key, new Set(service.dependencies));

        // Add reverse dependencies
        for (const dep of service.dependencies) {
          if (!graph.has(dep)) {
            graph.set(dep, new Set());
          }
        }
      }
    }

    return graph;
  }

  /**
   * Get startup order (topological sort)
   */
  getStartupOrder(): string[] {
    const graph = this.buildDependencyGraph();
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (node: string): void => {
      if (visited.has(node)) {
        return;
      }

      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected: ${node}`);
      }

      visiting.add(node);

      const deps = graph.get(node) || new Set();
      for (const dep of deps) {
        visit(dep);
      }

      visiting.delete(node);
      visited.add(node);
      order.push(node);
    };

    for (const node of graph.keys()) {
      visit(node);
    }

    return order;
  }

  /**
   * Validate dependencies
   */
  validateDependencies(): ReadonlyArray<{
    service: string;
    missing: readonly string[];
  }> {
    const allServices = new Set<string>();
    const issues: Array<{ service: string; missing: string[] }> = [];

    // Build service set
    for (const pkg of this.config.packages) {
      for (const service of pkg.services) {
        if (service.enabled) {
          allServices.add(`${pkg.name}:${service.id}`);
        }
      }
    }

    // Check dependencies
    for (const pkg of this.config.packages) {
      for (const service of pkg.services) {
        if (!service.enabled) {
          continue;
        }

        const key = `${pkg.name}:${service.id}`;
        const missing: string[] = [];

        for (const dep of service.dependencies) {
          if (!allServices.has(dep)) {
            missing.push(dep);
          }
        }

        if (missing.length > 0) {
          issues.push({ service: key, missing });
        }
      }
    }

    return issues;
  }
}

/**
 * Export singleton instance
 */
export const serviceDiscovery = new ServiceDiscovery();
