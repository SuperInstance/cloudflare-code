/**
 * ClaudeFlare TypeScript SDK
 *
 * A comprehensive TypeScript/JavaScript SDK for the ClaudeFlare distributed AI coding platform
 *
 * @example
 * ```typescript
 * import { ClaudeFlare } from '@claudeflare/sdk-ts';
 *
 * const client = new ClaudeFlare({
 *   apiKey: 'your-api-key',
 * });
 *
 * // Chat completion
 * const response = await client.chat.completions.create({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 *
 * console.log(response.content);
 * ```
 */

// Main client export
export { ClaudeFlare, ClaudeFlareClient } from './client.js';

// Type exports
export * from './types/index.js';

// Resource exports
export { Chat, ChatCompletions } from './resources/chat.js';
export { Code, CodeGeneration, CodeAnalysis } from './resources/code.js';
export { Agents, AgentOrchestration, AgentRegistry } from './resources/agents.js';
export { Models } from './resources/models.js';
export { Codebase, CodebaseUpload, CodebaseSearch, CodebaseManagement } from './resources/codebase.js';

// Utility exports
export * from './utils/errors.js';
export { Logger, LogLevel, getLogger, setLogger } from './utils/logger.js';
export * from './utils/retry.js';
export * from './utils/streaming.js';

// Default export
export { ClaudeFlare as default } from './client.js';
