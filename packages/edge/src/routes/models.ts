import type { Context } from 'hono';
import type { Env, ModelsResponse, Model } from '../types/index';

/**
 * List available models endpoint (placeholder)
 * GET /v1/models
 *
 * This is a placeholder implementation that returns a static list of models.
 * The actual implementation will:
 * - Fetch available models from configuration
 * - Support multiple providers (Cloudflare AI, Groq, Cerebras, etc.)
 * - Include pricing information
 * - Show current capabilities and status
 */
export async function listModels(c: Context<{ Bindings: Env }>) {
  // Placeholder model list
  const models: Model[] = [
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      contextLength: 200000,
      description: 'Fast and efficient model for simple tasks',
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: true,
      },
      pricing: {
        inputCostPer1K: 0.00025,
        outputCostPer1K: 0.00125,
      },
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      contextLength: 200000,
      description: 'Balanced model for most tasks',
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: true,
      },
      pricing: {
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
      },
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      contextLength: 200000,
      description: 'Most powerful model for complex tasks',
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: true,
      },
      pricing: {
        inputCostPer1K: 0.015,
        outputCostPer1K: 0.075,
      },
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      contextLength: 128000,
      description: 'OpenAI\'s most capable model',
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: true,
      },
      pricing: {
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.03,
      },
    },
    {
      id: 'llama-3-70b',
      name: 'Llama 3 70B',
      provider: 'groq',
      contextLength: 8192,
      description: 'Open source model with Groq acceleration',
      capabilities: {
        streaming: true,
        functionCalling: false,
        vision: false,
      },
      pricing: {
        inputCostPer1K: 0.00059,
        outputCostPer1K: 0.00079,
      },
    },
    {
      id: 'mixtral-8x7b',
      name: 'Mixtral 8x7B',
      provider: 'cloudflare',
      contextLength: 32768,
      description: 'Mixture of Experts model via Workers AI',
      capabilities: {
        streaming: true,
        functionCalling: false,
        vision: false,
      },
      pricing: {
        inputCostPer1K: 0.0,
        outputCostPer1K: 0.0,
      },
    },
  ];

  const response: ModelsResponse = {
    models,
    count: models.length,
    timestamp: Date.now(),
  };

  return c.json(response, 200);
}

/**
 * Get model by ID endpoint (placeholder)
 * GET /v1/models/:id
 */
export async function getModel(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param();

  // TODO: Implement actual model lookup
  // For now, return a placeholder response
  return c.json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: `Model lookup for '${id}' is not yet implemented`,
      timestamp: Date.now(),
    },
  }, 501);
}
