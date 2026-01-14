import { z } from 'zod';

/**
 * Health Response Schema
 */
export const healthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.number(),
  version: z.string(),
  environment: z.string(),
  uptime: z.number(),
});

/**
 * Service Status Schema
 */
export const serviceStatusSchema = z.object({
  api: z.boolean(),
  cache: z.boolean().optional(),
  storage: z.boolean().optional(),
  database: z.boolean().optional(),
  queue: z.boolean().optional(),
});

/**
 * Metrics Schema
 */
export const metricsSchema = z.object({
  requestsPerSecond: z.number().optional(),
  averageLatency: z.number().optional(),
  errorRate: z.number().optional(),
});

/**
 * Status Response Schema
 */
export const statusResponseSchema = z.object({
  status: z.enum(['operational', 'degraded', 'down']),
  version: z.string(),
  environment: z.string(),
  timestamp: z.number(),
  services: serviceStatusSchema,
  metrics: metricsSchema,
});

/**
 * Message Role Schema
 */
export const messageRoleSchema = z.enum(['system', 'user', 'assistant']);

/**
 * Chat Message Schema
 */
export const chatMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string().min(1, 'Message content cannot be empty'),
  timestamp: z.number().optional(),
});

/**
 * LLM Provider Schema
 */
export const llmProviderSchema = z.enum(['anthropic', 'openai', 'groq', 'cerebras', 'cloudflare']);

/**
 * Chat Request Schema
 */
export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, 'At least one message is required'),
  model: z.string().optional(),
  provider: llmProviderSchema.optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().min(1).max(128000).optional(),
  stream: z.boolean().optional().default(false),
  sessionId: z.string().optional(),
});

/**
 * Usage Schema
 */
export const usageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
});

/**
 * Chat Response Schema
 */
export const chatResponseSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  model: z.string(),
  provider: llmProviderSchema,
  finishReason: z.enum(['stop', 'length', 'content_filter']),
  usage: usageSchema,
  timestamp: z.number(),
});

/**
 * Model Capabilities Schema
 */
export const modelCapabilitiesSchema = z.object({
  streaming: z.boolean(),
  functionCalling: z.boolean(),
  vision: z.boolean(),
});

/**
 * Model Pricing Schema
 */
export const modelPricingSchema = z.object({
  inputCostPer1K: z.number(),
  outputCostPer1K: z.number(),
});

/**
 * Model Schema
 */
export const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: llmProviderSchema,
  contextLength: z.number(),
  description: z.string(),
  capabilities: modelCapabilitiesSchema,
  pricing: modelPricingSchema.optional(),
});

/**
 * Models Response Schema
 */
export const modelsResponseSchema = z.object({
  models: z.array(modelSchema),
  count: z.number(),
  timestamp: z.number(),
});

/**
 * Error Detail Schema
 */
export const errorDetailSchema = z.object({
  field: z.string().optional(),
  issue: z.string(),
  value: z.any().optional(),
});

/**
 * Error Response Schema
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    requestId: z.string(),
    timestamp: z.number(),
  }),
});

/**
 * Request Validation Error
 */
export const validationErrorSchema = z.object({
  error: z.object({
    code: z.literal('VALIDATION_ERROR'),
    message: z.string(),
    details: z.array(errorDetailSchema),
    requestId: z.string(),
    timestamp: z.number(),
  }),
});

/**
 * Type inference helpers
 */
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type ValidationError = z.infer<typeof validationErrorSchema>;
