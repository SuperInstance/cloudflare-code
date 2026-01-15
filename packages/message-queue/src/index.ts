/**
 * ClaudeFlare Message Queue - Ultra-Optimized
 * Advanced message queuing system
 */

export * from './types';
export { MessageQueue } from './queue';
export { QueueManager } from './manager';
export { MessageProcessor } from './processor';
export { DeadLetterHandler } from './dead-letter';
export { QueueMonitor } from './monitor';
export { MessageQueueSystem, createMessageQueueSystem } from './system';

export const VERSION = '1.0.0';
export default MessageQueueSystem;
