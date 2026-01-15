/**
 * ClaudeFlare Collaboration - Ultra-Optimized
 * Advanced collaboration features for real-time coding
 */

export * from './types';

// Core components (minimal exports)
export { CRDTDocumentManager, CollaborationManager } from './realtime';
export { PairProgrammingManager, WebRTCSessionManager } from './pair';
export { CodeReviewManager, ReviewWorkflow } from './review';
export { KnowledgeSharingManager } from './knowledge';
export { TeamManager } from './team';
export { ActivityFeedManager } from './activity';

// Main system
export { Collaboration, createCollaboration } from './system';

export const VERSION = '1.0.0';
export default Collaboration;
