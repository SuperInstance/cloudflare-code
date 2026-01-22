/**
 * Type definitions for ClaudeFlare VS Code extension
 */

import { CancellationToken, CompletionItem, Diagnostic, ProviderResult, Range, TextDocument } from 'vscode';

/**
 * Configuration settings for ClaudeFlare
 */
export interface ClaudeFlareConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enableCompletion: boolean;
  enableInlineChat: boolean;
  enableCodeActions: boolean;
  completionDebounce: number;
  contextWindow: number;
  projectContextDepth: number;
  enableMultiAgent: boolean;
  enableTelemetry: boolean;
  autoReview: boolean;
  theme: 'auto' | 'light' | 'dark';
  streamResponses: boolean;
  showInlineAnnotations: boolean;
  excludePatterns: string[];
  agentTimeout: number;
}

/**
 * Chat message in the conversation
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Chat conversation session
 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  context?: ProjectContext;
}

/**
 * Project context information
 */
export interface ProjectContext {
  rootPath: string;
  files: ProjectFile[];
  dependencies: Record<string, string>;
  gitInfo?: GitInfo;
  language: string;
  framework?: string;
  buildTool?: string;
}

/**
 * File information in project context
 */
export interface ProjectFile {
  path: string;
  language: string;
  size: number;
  lastModified: number;
  isTest?: boolean;
  isConfig?: boolean;
}

/**
 * Git repository information
 */
export interface GitInfo {
  branch: string;
  commit: string;
  remote?: string;
  status: GitFileStatus[];
}

/**
 * Git file status
 */
export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
}

/**
 * Code completion request
 */
export interface CompletionRequest {
  document: TextDocument;
  position: { line: number; character: number };
  context: CompletionContext;
  token?: CancellationToken;
}

/**
 * Context for code completion
 */
export interface CompletionContext {
  prefix: string;
  suffix: string;
  language: string;
  filePath: string;
  projectContext?: ProjectContext;
}

/**
 * Code completion response
 */
export interface CompletionResponse {
  items: CompletionItem[];
  isIncomplete?: boolean;
}

/**
 * Code explanation request
 */
export interface CodeExplanationRequest {
  code: string;
  language: string;
  filePath: string;
  range?: Range;
  detail?: 'high' | 'medium' | 'low';
}

/**
 * Code explanation response
 */
export interface CodeExplanationResponse {
  explanation: string;
  summary: string;
  concepts: string[];
  complexity?: string;
  suggestions?: string[];
}

/**
 * Code refactoring request
 */
export interface RefactorRequest {
  code: string;
  language: string;
  filePath: string;
  range: Range;
  type: RefactorType;
  options?: RefactorOptions;
}

/**
 * Types of refactoring
 */
export type RefactorType =
  | 'simplify'
  | 'optimize'
  | 'extract-function'
  | 'extract-variable'
  | 'inline'
  | 'rename'
  | 'reorder'
  | 'modernize'
  | 'type-safe';

/**
 * Refactoring options
 */
export interface RefactorOptions {
  preserveTypes?: boolean;
  preserveComments?: boolean;
  addJSDoc?: boolean;
  targetVersion?: string;
}

/**
 * Code refactoring response
 */
export interface RefactorResponse {
  code: string;
  explanation: string;
  changes: CodeChange[];
  warnings?: string[];
}

/**
 * Code change information
 */
export interface CodeChange {
  range: Range;
  newText: string;
  description: string;
}

/**
 * Test generation request
 */
export interface TestGenerationRequest {
  code: string;
  language: string;
  filePath: string;
  framework?: string;
  coverageTarget?: number;
}

/**
 * Test generation response
 */
export interface TestGenerationResponse {
  tests: string;
  framework: string;
  coverage?: number;
  mocks: string[];
  setup?: string;
}

/**
 * Documentation generation request
 */
export interface DocumentationRequest {
  code: string;
  language: string;
  filePath: string;
  format: 'jsdoc' | 'tSDoc' | 'reStructuredText' | 'godoc';
  includeExamples?: boolean;
}

/**
 * Documentation generation response
 */
export interface DocumentationResponse {
  documentation: string;
  summary: string;
  parameters?: ParameterDoc[];
  returns?: string;
  examples?: string[];
}

/**
 * Parameter documentation
 */
export interface ParameterDoc {
  name: string;
  type: string;
  description: string;
  optional?: boolean;
}

/**
 * Code review request
 */
export interface CodeReviewRequest {
  code: string;
  language: string;
  filePath: string;
  prNumber?: number;
  context?: ProjectContext;
}

/**
 * Code review response
 */
export interface CodeReviewResponse {
  overall: ReviewSummary;
  issues: ReviewIssue[];
  suggestions: ReviewSuggestion[];
  metrics?: ReviewMetrics;
}

/**
 * Review summary
 */
export interface ReviewSummary {
  score: number;
  status: 'approved' | 'changes_requested' | 'commented';
  summary: string;
}

/**
 * Review issue
 */
export interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  line: number;
  column?: number;
  message: string;
  rule?: string;
  fix?: string;
}

/**
 * Review suggestion
 */
export interface ReviewSuggestion {
  type: string;
  description: string;
  code: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Review metrics
 */
export interface ReviewMetrics {
  complexity: number;
  maintainability: number;
  testCoverage?: number;
  duplications: number;
  security?: number;
}

/**
 * Multi-agent task
 */
export interface AgentTask {
  id: string;
  type: AgentTaskType;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agent: string;
  input: unknown;
  output?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
}

/**
 * Types of agent tasks
 */
export type AgentTaskType =
  | 'code-generation'
  | 'code-review'
  | 'refactoring'
  | 'testing'
  | 'documentation'
  | 'debugging'
  | 'optimization'
  | 'analysis';

/**
 * Agent orchestration request
 */
export interface AgentOrchestrationRequest {
  task: string;
  agents?: string[];
  context: ProjectContext;
  parallel?: boolean;
  maxDuration?: number;
}

/**
 * Agent orchestration response
 */
export interface AgentOrchestrationResponse {
  tasks: AgentTask[];
  result: OrchestrationResult;
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
  success: boolean;
  output: unknown;
  combinedOutput?: string;
  errors?: string[];
  metadata: Record<string, unknown>;
}

/**
 * API error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

/**
 * Streaming response callback
 */
export type StreamCallback = (chunk: string, done: boolean) => void;

/**
 * Telemetry event
 */
export interface TelemetryEvent {
  name: string;
  properties: Record<string, unknown>;
  measurements?: Record<string, number>;
}

/**
 * Inline suggestion
 */
export interface InlineSuggestion {
  text: string;
  range: Range;
  priority: number;
  source: string;
}
