// @ts-nocheck
/**
 * ClaudeFlare DDoS Protection - Ultra-Optimized
 * Comprehensive DDoS protection and mitigation
 */

export * from './types';
export { TrafficAnalyzer } from './traffic/analyzer';
export { AttackDetector } from './attack/detector';
export { MitigationEngine } from './mitigation/engine';
export { ChallengePlatform } from './challenge/platform';
export { IPReputationManager } from './reputation';
export { AnalyticsManager } from './analytics';
export { ConfigManager } from './config';
export { TimeUtils } from './utils';
export { DDoSProtection, createDDoSProtection } from './system';

export const VERSION = '1.0.0';
export default DDoSProtection;
