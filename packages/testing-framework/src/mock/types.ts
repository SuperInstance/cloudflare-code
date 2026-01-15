/**
 * Mock Services Types
 * Provides types and interfaces for creating mock external dependencies
 */

export interface MockServiceConfig {
  id: string;
  name: string;
  type: 'http' | 'database' | 'api' | 'websocket' | 'event' | 'storage';
  port?: number;
  host?: string;
  baseUrl?: string;
  latency?: number;
  errorRate?: number;
  responseDelay?: number;
  persistence?: boolean;
  data?: any;
  headers?: Record<string, string>;
}

export interface MockRequest {
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
  query: Record<string, string>;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  delay?: number;
}

export interface MockRoute {
  id: string;
  method: string;
  path: string;
  handler: (request: MockRequest) => Promise<MockResponse> | MockResponse;
  response?: MockResponse;
  condition?: (request: MockRequest) => boolean;
  priority?: number;
  enabled?: boolean;
}

export interface MockDatabaseConfig {
  type: 'mysql' | 'postgresql' | 'mongodb' | 'redis' | 'sqlite';
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  tables?: MockTableConfig[];
  data?: Record<string, any[]>;
}

export interface MockTableConfig {
  name: string;
  schema: MockColumnConfig[];
  data?: any[];
  indexes?: string[];
}

export interface MockColumnConfig {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  default?: any;
}

export interface MockWebSocketMessage {
  id: string;
  type: 'message' | 'event' | 'error';
  data: any;
  timestamp: Date;
  topic?: string;
}

export interface MockWebSocketConfig {
  port: number;
  protocols?: string[];
  handlers?: MockWebSocketHandler[];
  messageQueue?: MockWebSocketMessage[];
  connectionTimeout?: number;
}

export interface MockWebSocketHandler {
  event: string;
  handler: (data: any, socket: any) => void;
}

export interface MockEventBusConfig {
  topics: string[];
  handlers: MockEventHandler[];
  persistence?: boolean;
  storage?: 'memory' | 'file' | 'database';
}

export interface MockEventHandler {
  id: string;
  topic: string;
  handler: (event: any) => void;
  filter?: (event: any) => boolean;
  priority?: number;
}

export interface MockStorageConfig {
  type: 'filesystem' | 's3' | 'memory';
  endpoint?: string;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  basePath?: string;
}

export interface MockServiceRegistry {
  services: Map<string, MockService>;
  routes: Map<string, MockRoute[]>;
  databases: Map<string, MockDatabase>;
  websockets: Map<string, MockWebSocket>;
  eventBus: MockEventBus;
  storage: MockStorage;
}

export interface MockService {
  id: string;
  name: string;
  type: MockServiceConfig['type'];
  config: MockServiceConfig;
  isActive: boolean;
  stats: {
    requests: number;
    responses: number;
    errors: number;
    averageResponseTime: number;
    uptime: number;
    startTime: Date;
    lastRequest?: Date;
  };
}

export interface MockDatabase {
  id: string;
  config: MockDatabaseConfig;
  connections: number;
  queries: number;
  tables: Map<string, any[]>;
}

export interface MockWebSocket {
  id: string;
  config: MockWebSocketConfig;
  connections: Set<any>;
  messages: MockWebSocketMessage[];
  isActive: boolean;
}

export interface MockEventBus {
  config: MockEventBusConfig;
  subscribers: Map<string, MockEventHandler[]>;
  published: number;
  delivered: number;
}

export interface MockStorage {
  config: MockStorageConfig;
  files: Map<string, any>;
  uploads: number;
  downloads: number;
  size: number;
}

export interface MockScenario {
  id: string;
  name: string;
  description?: string;
  services: string[];
  data?: any;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  duration?: number;
}

export interface MockMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  responseTimeDistribution: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  activeConnections: number;
}

export interface MockServiceError {
  type: 'network' | 'timeout' | 'validation' | 'server' | 'client';
  message: string;
  code: string;
  details?: any;
  timestamp: Date;
}

export interface MockVerification {
  id: string;
  serviceId: string;
  type: 'request' | 'response' | 'data' | 'event';
  expected: any;
  actual: any;
  passed: boolean;
  message?: string;
  timestamp: Date;
}