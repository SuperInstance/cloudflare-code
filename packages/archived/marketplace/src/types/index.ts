/**
 * Core type definitions for the AI Agent Marketplace
 */

import { z } from 'zod';

// ============================================================================
// Agent Types
// ============================================================================

export enum AgentCategory {
  CODE_ASSISTANT = 'code_assistant',
  DATA_ANALYSIS = 'data_analysis',
  WRITING = 'writing',
  RESEARCH = 'research',
  AUTOMATION = 'automation',
  SECURITY = 'security',
  TESTING = 'testing',
  DEVOPS = 'devops',
  DESIGN = 'design',
  PRODUCTIVITY = 'productivity',
  CUSTOM = 'custom'
}

export enum AgentStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived'
}

export enum AgentCapability {
  TEXT_GENERATION = 'text_generation',
  CODE_GENERATION = 'code_generation',
  DATA_ANALYSIS = 'data_analysis',
  TOOL_USE = 'tool_use',
  WEB_SEARCH = 'web_search',
  FILE_OPERATIONS = 'file_operations',
  API_INTEGRATION = 'api_integration',
  DATABASE_ACCESS = 'database_access',
  IMAGE_PROCESSING = 'image_processing',
  MULTIMODAL = 'multimodal'
}

export enum AgentPermission {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  ENVIRONMENT = 'environment'
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  handler: string; // Reference to handler function
  permissions: AgentPermission[];
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

export interface AgentPrompt {
  system: string;
  user?: string;
  context?: string;
  variables?: Record<string, any>;
}

export interface AgentConfig {
  name: string;
  description: string;
  version: string;
  category: AgentCategory;
  capabilities: AgentCapability[];
  permissions: AgentPermission[];
  tools: AgentTool[];
  prompts: Record<string, AgentPrompt>;
  settings: Record<string, any>;
  constraints?: {
    maxTokens?: number;
    timeout?: number;
    allowedModels?: string[];
    memoryLimit?: number;
  };
}

export interface AgentMetadata {
  id: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  version: string;
  status: AgentStatus;
  tags: string[];
  categories: AgentCategory[];
  visibility: 'public' | 'private' | 'unlisted';
}

export interface AgentStats {
  installs: number;
  uses: number;
  rating: number;
  ratingCount: number;
  views: number;
  forks: number;
  lastUsed?: Date;
}

export interface AgentReview {
  id: string;
  agentId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  helpful: number;
  verified: boolean;
}

export interface Agent {
  metadata: AgentMetadata;
  config: AgentConfig;
  code: string;
  stats?: AgentStats;
  reviews?: AgentReview[];
}

// ============================================================================
// Template Types
// ============================================================================

export enum TemplateType {
  BASIC = 'basic',
  ADVANCED = 'advanced',
  SPECIALIZED = 'specialized',
  MULTI_MODAL = 'multi_modal',
  CHAINED = 'chained',
  CUSTOM = 'custom'
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  category: AgentCategory;
  config: Partial<AgentConfig>;
  scaffolding: {
    files: Record<string, string>;
    structure: string[];
    dependencies: string[];
  };
  customizations: {
    parameters: Record<string, {
      type: string;
      description: string;
      default?: any;
      required: boolean;
      options?: any[];
    }>;
    prompts: Record<string, string>;
  };
  examples: Array<{
    name: string;
    description: string;
    config: AgentConfig;
  }>;
}

// ============================================================================
// Builder Types
// ============================================================================

export enum BuildStep {
  VALIDATE = 'validate',
  COMPILE = 'compile',
  TEST = 'test',
  PACKAGE = 'package',
  DEPLOY = 'deploy'
}

export interface BuildConfig {
  steps: BuildStep[];
  optimizations: boolean;
  minify: boolean;
  sourceMaps: boolean;
  target: 'edge' | 'node' | 'browser';
}

export interface BuildResult {
  success: boolean;
  agent: Agent;
  warnings: string[];
  errors: string[];
  metrics: {
    buildTime: number;
    bundleSize: number;
    dependencies: number;
  };
}

export interface BuildContext {
  environment: 'development' | 'staging' | 'production';
  platform: 'cloudflare' | 'aws' | 'azure' | 'gcp';
  region?: string;
}

// ============================================================================
// Discovery Types
// ============================================================================

export interface SearchFilters {
  category?: AgentCategory;
  capabilities?: AgentCapability[];
  permissions?: AgentPermission[];
  rating?: { min: number; max: number };
  installs?: { min: number };
  updatedAfter?: Date;
  author?: string;
  tags?: string[];
  status?: AgentStatus;
  visibility?: 'public' | 'private' | 'unlisted';
}

export interface SearchOptions {
  query?: string;
  filters?: SearchFilters;
  sort?: {
    field: 'relevance' | 'rating' | 'installs' | 'updated' | 'created' | 'name';
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AgentRecommendation {
  agent: Agent;
  score: number;
  reasons: string[];
  similarAgents: Agent[];
}

// ============================================================================
// Testing Types
// ============================================================================

export enum TestType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  E2E = 'e2e',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  SAFETY = 'safety'
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: TestType;
  input: any;
  expectedOutput: any;
  assertions: Array<{
    type: string;
    property: string;
    operator: string;
    value: any;
  }>;
  timeout?: number;
  setup?: string;
  teardown?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: TestCase[];
  setup?: string;
  teardown?: string;
  parallel: boolean;
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  duration: number;
  output?: any;
  error?: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export interface TestReport {
  suiteId: string;
  suiteName: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location?: {
    file: string;
    line: number;
    column: number;
  };
  suggestion?: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  metrics: {
    complexity: number;
    maintainability: number;
    security: number;
    performance: number;
  };
  checks: {
    syntax: boolean;
    semantics: boolean;
    security: boolean;
    performance: boolean;
    bestPractices: boolean;
  };
}

// ============================================================================
// Community Types
// ============================================================================

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  createdAt: Date;
  stats: {
    agentsPublished: number;
    totalInstalls: number;
    totalUses: number;
    followers: number;
    following: number;
  };
  badges: string[];
  verified: boolean;
}

export interface AgentFork {
  id: string;
  originalAgentId: string;
  forkedAgentId: string;
  userId: string;
  createdAt: Date;
  modifications: string[];
}

export interface AgentComment {
  id: string;
  agentId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  parentId?: string;
  replies: AgentComment[];
  reactions: {
    emoji: string;
    count: number;
    users: string[];
  }[];
}

export interface AgentCollection {
  id: string;
  name: string;
  description: string;
  userId: string;
  agents: string[];
  createdAt: Date;
  updatedAt: Date;
  visibility: 'public' | 'private';
  followers: number;
}

export interface ShareOptions {
  platform: 'twitter' | 'github' | 'linkedin' | 'email' | 'link';
  message?: string;
  includePreview?: boolean;
}

// ============================================================================
// Publishing Types
// ============================================================================

export enum PublishState {
  DRAFT = 'draft',
  VALIDATING = 'validating',
  TESTING = 'testing',
  REVIEWING = 'reviewing',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed'
}

export interface PublishManifest {
  agentId: string;
  version: string;
  changelog: string;
  releaseNotes: string;
  dependencies: Record<string, string>;
  compatibility: {
    platform: string[];
    apiVersion: string[];
  };
  deprecationInfo?: {
    deprecatedInVersion: string;
    removedInVersion: string;
    migrationGuide: string;
  };
}

export interface PublishResult {
  success: boolean;
  agent: Agent;
  state: PublishState;
  url?: string;
  version: string;
  publishedAt: Date;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface UsageEvent {
  id: string;
  agentId: string;
  userId?: string;
  eventType: 'install' | 'use' | 'uninstall' | 'view' | 'fork';
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface AgentAnalytics {
  agentId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalUses: number;
    uniqueUsers: number;
    averageSessionDuration: number;
    successRate: number;
    errorRate: number;
    averageResponseTime: number;
  };
  trends: {
    daily: Array<{ date: Date; value: number }>;
    weekly: Array<{ week: Date; value: number }>;
    monthly: Array<{ month: Date; value: number }>;
  };
  topUsers: Array<{
    userId: string;
    uses: number;
  }>;
  commonErrors: Array<{
    error: string;
    count: number;
  }>;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const AgentConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: z.nativeEnum(AgentCategory),
  capabilities: z.array(z.nativeEnum(AgentCapability)),
  permissions: z.array(z.nativeEnum(AgentPermission)),
  tools: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    parameters: z.any(),
    handler: z.string(),
    permissions: z.array(z.nativeEnum(AgentPermission)),
    rateLimit: z.object({
      maxCalls: z.number(),
      windowMs: z.number()
    }).optional()
  })),
  prompts: z.record(z.object({
    system: z.string(),
    user: z.string().optional(),
    context: z.string().optional(),
    variables: z.record(z.any()).optional()
  })),
  settings: z.record(z.any()),
  constraints: z.object({
    maxTokens: z.number().optional(),
    timeout: z.number().optional(),
    allowedModels: z.array(z.string()).optional(),
    memoryLimit: z.number().optional()
  }).optional()
});

export const SearchFiltersSchema = z.object({
  category: z.nativeEnum(AgentCategory).optional(),
  capabilities: z.array(z.nativeEnum(AgentCapability)).optional(),
  permissions: z.array(z.nativeEnum(AgentPermission)).optional(),
  rating: z.object({
    min: z.number().min(0).max(5),
    max: z.number().min(0).max(5)
  }).optional(),
  installs: z.object({
    min: z.number()
  }).optional(),
  updatedAfter: z.date().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.nativeEnum(AgentStatus).optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).optional()
});

export const TestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.nativeEnum(TestType),
  input: z.any(),
  expectedOutput: z.any(),
  assertions: z.array(z.object({
    type: z.string(),
    property: z.string(),
    operator: z.string(),
    value: z.any()
  })),
  timeout: z.number().optional(),
  setup: z.string().optional(),
  teardown: z.string().optional()
});
