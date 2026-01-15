/**
 * Collaboration System - Optimized
 */

import { CollaborationManager } from './realtime';
import { PairProgrammingManager } from './pair';
import { CodeReviewManager } from './review';
import { KnowledgeSharingManager } from './knowledge';
import { TeamManager } from './team';
import { ActivityFeedManager } from './activity';

export interface CollaborationOptions {
  realtime?: any;
  pair?: any;
  review?: any;
  knowledge?: any;
  team?: any;
  activity?: any;
}

export class Collaboration {
  private realtime: CollaborationManager;
  private pair: PairProgrammingManager;
  private review: CodeReviewManager;
  private knowledge: KnowledgeSharingManager;
  private team: TeamManager;
  private activity: ActivityFeedManager;

  constructor(options: CollaborationOptions = {}) {
    this.realtime = new CollaborationManager(options.realtime || {});
    this.pair = new PairProgrammingManager(options.pair || {});
    this.review = new CodeReviewManager(options.review || {});
    this.knowledge = new KnowledgeSharingManager(options.knowledge || {});
    this.team = new TeamManager(options.team || {});
    this.activity = new ActivityFeedManager(options.activity || {});
  }

  async initialize(): Promise<void> {
    await Promise.all([this.realtime.initialize(), this.team.initialize()]);
  }

  async startSession(documentId: string, userId: string): Promise<any> {
    return this.realtime.createSession(documentId, userId);
  }

  getStats(): any {
    return {
      realtime: this.realtime.getStats(),
      pair: this.pair.getStats(),
      review: this.review.getStats(),
      team: this.team.getStats()
    };
  }
}

export function createCollaboration(options: CollaborationOptions = {}): Collaboration {
  return new Collaboration(options);
}
