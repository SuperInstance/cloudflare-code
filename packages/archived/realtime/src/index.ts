/**
 * ClaudeFlare Real-Time Communication - Ultra-Optimized
 * Advanced WebSocket handling with multiplexing and presence
 */

export * from './types';
export * from './utils';
export { WebSocketManager } from './websocket/manager';
export { Multiplexer } from './multiplexer/multiplexer';
export { PresenceSystem } from './presence/system';
export { ScalabilityEngine } from './scalability/engine';
export { RealTime, createRealTime } from './system';

export const VERSION = '1.0.0';
export default RealTime;
