// @ts-nocheck
export interface ServiceConfig {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  healthCheck: HealthCheckConfig;
  loadBalancing: LoadBalancingConfig;
  circuitBreaker: CircuitBreakerConfig;
  retry: RetryConfig;
  security: SecurityConfig;
  cache: CacheConfig;
  monitoring: MonitoringConfig;
}

export interface HealthCheckConfig {
  enabled: boolean;
  endpoint: string;
  interval: number;
  timeout: number;
  retries: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

export interface LoadBalancingConfig {
  strategy: 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted';
  stickySessions: boolean;
  healthCheckInterval: number;
  nodes: LoadBalancerNode[];
}

export interface LoadBalancerNode {
  host: string;
  port: number;
  weight: number;
  healthy: boolean;
  connections: number;
  lastHealthCheck: Date;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  threshold: number;
  timeout: number;
  resetTimeout: number;
  halfOpenRequests: number;
  slidingWindowSize: number;
  slidingWindowType: 'count' | 'percentage';
}

export interface RetryConfig {
  enabled: boolean;
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
}

export interface SecurityConfig {
  enabled: boolean;
  auth: {
    type: 'jwt' | 'oauth' | 'api-key' | 'basic';
    provider?: string;
  };
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    burst: number;
  };
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    key?: string;
  };
}

export interface CacheConfig {
  enabled: boolean;
  type: 'memory' | 'redis' | 'file';
  ttl: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  redis?: RedisConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  cluster?: boolean;
  nodes?: RedisNode[];
}

export interface RedisNode {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: {
    enabled: boolean;
    interval: number;
    retention: number;
  };
  tracing: {
    enabled: boolean;
    sampling: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    outputs: string[];
  };
}

export interface PlatformConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  services: ServiceConfig[];
  global: GlobalConfig;
  orchestration: OrchestrationConfig;
  deployment: DeploymentConfig;
  optimization: OptimizationConfig;
}

export interface GlobalConfig {
  port: number;
  host: string;
  cluster: boolean;
  workers: number;
  shutdownTimeout: number;
}

export interface OrchestrationConfig {
  enabled: boolean;
  autoScaling: {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    scaleUpThreshold: number;
    scaleDownThreshold: number;
  };
  serviceDependencies: ServiceDependency[];
  migration: MigrationConfig;
}

export interface ServiceDependency {
  service: string;
  dependsOn: string[];
  version: string;
  optional: boolean;
}

export interface MigrationConfig {
  enabled: boolean;
  autoMigrate: boolean;
  backupBeforeMigration: boolean;
  rollbackOnFailure: boolean;
}

export interface DeploymentConfig {
  enabled: boolean;
  strategy: 'rolling' | 'blue-green' | 'canary';
  healthCheckEndpoint: string;
  readinessProbe: ProbeConfig;
  livenessProbe: ProbeConfig;
  rollback: RollbackConfig;
}

export interface ProbeConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  threshold: number;
  failureThreshold: number;
}

export interface RollbackConfig {
  enabled: boolean;
  automatic: boolean;
  timeout: number;
  healthCheckInterval: number;
}

export interface OptimizationConfig {
  enabled: boolean;
  cpu: {
    enabled: boolean;
    target: number;
    scaleDown: number;
  };
  memory: {
    enabled: boolean;
    target: number;
    scaleDown: number;
  };
  network: {
    enabled: boolean;
    compression: boolean;
    caching: boolean;
  };
  database: {
    enabled: boolean;
    connectionPooling: boolean;
    queryCaching: boolean;
  };
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  uptime: number;
  responseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface MetricData {
  timestamp: Date;
  service: string;
  metric: string;
  value: number;
  tags: Record<string, string>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  timestamp: Date;
  duration: number;
  tags: Record<string, string>;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
}

export interface PlatformEvent {
  id: string;
  type: 'health_check' | 'metric' | 'trace' | 'log' | 'deployment' | 'error';
  timestamp: Date;
  source: string;
  payload: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ServiceRegistration {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  metadata: Record<string, any>;
  health: HealthStatus;
  capabilities: string[];
  dependencies: string[];
}

export interface APIDocumentation {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  servers: ServerConfig[];
  paths: Record<string, PathDefinition>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
}

export interface ServerConfig {
  url: string;
  description: string;
}

export interface PathDefinition {
  [method: string]: OperationDefinition;
}

export interface OperationDefinition {
  summary: string;
  description: string;
  tags: string[];
  parameters: ParameterDefinition[];
  requestBody?: RequestBodyDefinition;
  responses: Record<string, ResponseDefinition>;
  security?: SecurityRequirement[];
}

export interface ParameterDefinition {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required: boolean;
  schema: any;
  description?: string;
}

export interface RequestBodyDefinition {
  content: Record<string, MediaType>;
  required?: boolean;
}

export interface MediaType {
  schema: any;
  example?: any;
  examples?: Record<string, any>;
}

export interface ResponseDefinition {
  description: string;
  content?: Record<string, MediaType>;
}

export interface SecurityRequirement {
  [key: string]: string[];
}