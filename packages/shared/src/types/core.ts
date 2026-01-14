/**
 * Core type definitions for ClaudeFlare platform
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Message role types in the conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Quality tiers for model selection
 */
export enum QualityTier {
  LOW = 'low',        // 1B parameter models, free tier
  MEDIUM = 'medium',  // 8B parameter models, balanced
  HIGH = 'high',      // 70B+ parameter models, best quality
  REALTIME = 'realtime'  // Ultra-fast inference priority
}

/**
 * Task types for specialized routing
 */
export enum TaskType {
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  DOCUMENTATION = 'documentation',
  DEBUGGING = 'debugging',
  REFACTORING = 'refactoring',
  EXPLANATION = 'explanation',
  CONVERSATION = 'conversation'
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Represents a single message in a conversation
 */
export interface Message {
  /** The role of the message sender */
  role: MessageRole;
  /** The content of the message */
  content: string;
  /** Unix timestamp in milliseconds */
  timestamp?: number;
  /** Optional metadata for the message */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for Message validation
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.number().optional(),
  metadata: z.record(z.unknown()).optional()
});

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Request context information for routing decisions
 */
export interface RequestContext {
  /** Conversation history */
  conversationHistory?: Message[];
  /** Project path for context */
  projectPath?: string;
  /** Programming language */
  language?: string;
  /** Framework being used */
  framework?: string;
  /** Whether code execution is required */
  requiresCodeExecution: boolean;
  /** Whether file access is required */
  requiresFileAccess: boolean;
  /** User's preferred provider */
  preferredProvider?: string;
  /** Providers to exclude from routing */
  excludeProviders?: string[];
}

/**
 * Zod schema for RequestContext validation
 */
export const RequestContextSchema = z.object({
  conversationHistory: z.array(MessageSchema).optional(),
  projectPath: z.string().optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  requiresCodeExecution: z.boolean(),
  requiresFileAccess: z.boolean(),
  preferredProvider: z.string().optional(),
  excludeProviders: z.array(z.string()).optional()
});

/**
 * Chat request for LLM completion
 */
export interface ChatRequest {
  /** Array of messages in the conversation */
  messages: Message[];
  /** Model identifier */
  model?: string;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Stop sequences */
  stopSequences?: string[];
  /** Top-p sampling parameter */
  topP?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
}

/**
 * Zod schema for ChatRequest validation
 */
export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  stream: z.boolean().optional(),
  stopSequences: z.array(z.string()).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional()
});

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Token usage information
 */
export interface TokenUsage {
  /** Number of prompt tokens used */
  prompt: number;
  /** Number of completion tokens used */
  completion: number;
  /** Total number of tokens used */
  total: number;
}

/**
 * Zod schema for TokenUsage validation
 */
export const TokenUsageSchema = z.object({
  prompt: z.number().nonnegative(),
  completion: z.number().nonnegative(),
  total: z.number().nonnegative()
});

/**
 * Chat response from LLM
 */
export interface ChatResponse {
  /** Generated content */
  content: string;
  /** Model identifier used */
  model: string;
  /** Token usage information */
  tokens: TokenUsage;
  /** Request latency in milliseconds */
  latency: number;
  /** Finish reason (stop, length, etc.) */
  finishReason?: string;
  /** Response metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for ChatResponse validation
 */
export const ChatResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  tokens: TokenUsageSchema,
  latency: z.number().nonnegative(),
  finishReason: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  /** Content delta for this chunk */
  delta: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Token usage (available only in final chunk) */
  tokens?: TokenUsage;
  /** Current model being used */
  model: string;
}

/**
 * Zod schema for StreamChunk validation
 */
export const StreamChunkSchema = z.object({
  delta: z.string(),
  done: z.boolean(),
  tokens: TokenUsageSchema.optional(),
  model: z.string()
});

// ============================================================================
// ROUTING TYPES
// ============================================================================

/**
 * Quality tier for model selection
 */
export type QualityTierType = `${QualityTier}`;

/**
 * Task type for specialized routing
 */
export type TaskTypeEnum = `${TaskType}`;

/**
 * Routing request for provider selection
 */
export interface RoutingRequest {
  /** Core request data */
  prompt: string;
  /** Context information */
  context: RequestContext;
  /** Quality requirements */
  quality: QualityTierType;
  /** Maximum acceptable latency in milliseconds */
  maxLatency?: number;
  /** Maximum cost in USD */
  maxCost?: number;
  /** Task classification */
  taskType: TaskTypeEnum;
  /** Estimated token count */
  estimatedTokens: number;
  /** Session identifier */
  sessionId: string;
  /** User identifier */
  userId: string;
}

/**
 * Zod schema for RoutingRequest validation
 */
export const RoutingRequestSchema = z.object({
  prompt: z.string(),
  context: RequestContextSchema,
  quality: z.enum(['low', 'medium', 'high', 'realtime']),
  maxLatency: z.number().positive().optional(),
  maxCost: z.number().nonnegative().optional(),
  taskType: z.enum([
    'code_generation',
    'code_review',
    'documentation',
    'debugging',
    'refactoring',
    'explanation',
    'conversation'
  ]),
  estimatedTokens: z.number().nonnegative(),
  sessionId: z.string(),
  userId: z.string()
});

// ============================================================================
// TYPE INFERENCE UTILITIES
// ============================================================================

/**
 * Infer Message type from schema
 */
export type MessageType = z.infer<typeof MessageSchema>;

/**
 * Infer RequestContext type from schema
 */
export type RequestContextType = z.infer<typeof RequestContextSchema>;

/**
 * Infer ChatRequest type from schema
 */
export type ChatRequestType = z.infer<typeof ChatRequestSchema>;

/**
 * Infer ChatResponse type from schema
 */
export type ChatResponseType = z.infer<typeof ChatResponseSchema>;

/**
 * Infer StreamChunk type from schema
 */
export type StreamChunkType = z.infer<typeof StreamChunkSchema>;

/**
 * Infer RoutingRequest type from schema
 */
export type RoutingRequestType = z.infer<typeof RoutingRequestSchema>;
