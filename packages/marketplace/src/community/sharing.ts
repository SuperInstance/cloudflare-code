/**
 * Community Sharing Features
 * Handles social sharing, collaboration, and community interaction
 */

import {
  Agent,
  UserProfile,
  AgentFork,
  AgentComment,
  AgentCollection,
  AgentReview,
  ShareOptions,
  AgentStats
} from '../types';

// ============================================================================
// Sharing Configuration
// ============================================================================

export interface ShareMetadata {
  title: string;
  description: string;
  image?: string;
  url: string;
  agent: Agent;
}

export interface ShareResult {
  success: boolean;
  url?: string;
  platform: string;
  error?: string;
}

export interface CollaborationOptions {
  allowForks: boolean;
    allowComments: boolean;
    allowReviews: boolean;
    visibility: 'public' | 'private' | 'unlisted';
  }

// ============================================================================
// Sharing Service
// ============================================================================

export class SharingService {
  async shareAgent(agent: Agent, options: ShareOptions): Promise<ShareResult> {
    const metadata = this.createShareMetadata(agent);

    switch (options.platform) {
      case 'twitter':
        return this.shareToTwitter(metadata, options);
      case 'github':
        return this.shareToGitHub(metadata, options);
      case 'linkedin':
        return this.shareToLinkedIn(metadata, options);
      case 'email':
        return this.shareViaEmail(metadata, options);
      case 'link':
        return this.shareViaLink(metadata);
      default:
        return {
          success: false,
          platform: options.platform,
          error: 'Unsupported platform'
        };
    }
  }

  private createShareMetadata(agent: Agent): ShareMetadata {
    return {
      title: agent.config.name,
      description: agent.config.description,
      url: `https://claudeflare.market/agents/${agent.metadata.id}`,
      agent
    };
  }

  private async shareToTwitter(
    metadata: ShareMetadata,
    options: ShareOptions
  ): Promise<ShareResult> {
    const message = options.message || `Check out ${metadata.title} - ${metadata.description}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(metadata.url)}`;

    return {
      success: true,
      url,
      platform: 'twitter'
    };
  }

  private async shareToGitHub(
    metadata: ShareMetadata,
    options: ShareOptions
  ): Promise<ShareResult> {
    // Would create a GitHub Gist or repo with the agent code
    return {
      success: true,
      url: 'https://github.com/claudeflare/agents',
      platform: 'github'
    };
  }

  private async shareToLinkedIn(
    metadata: ShareMetadata,
    options: ShareOptions
  ): Promise<ShareResult> {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(metadata.url)}`;

    return {
      success: true,
      url,
      platform: 'linkedin'
    };
  }

  private async shareViaEmail(
    metadata: ShareMetadata,
    options: ShareOptions
  ): Promise<ShareResult> {
    const subject = encodeURIComponent(`Check out ${metadata.title}`);
    const body = encodeURIComponent(
      options.message ||
      `I found this interesting AI agent: ${metadata.title}\n\n${metadata.description}\n\n${metadata.url}`
    );
    const url = `mailto:?subject=${subject}&body=${body}`;

    return {
      success: true,
      url,
      platform: 'email'
    };
  }

  private async shareViaLink(metadata: ShareMetadata): Promise<ShareResult> {
    return {
      success: true,
      url: metadata.url,
      platform: 'link'
    };
  }

  generateEmbedCode(agent: Agent, options: {
    width?: number;
    height?: number;
    theme?: 'light' | 'dark';
  } = {}): string {
    const { width = 600, height = 400, theme = 'light' } = options;

    return `<iframe
  src="https://claudeflare.market/embed/agents/${agent.metadata.id}?theme=${theme}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allowfullscreen>
</iframe>`;
  }

  generateShareCard(agent: Agent): {
    html: string;
    jsonLd: string;
  } {
    const html = `
<div class="agent-share-card">
  <h3>${agent.config.name}</h3>
  <p>${agent.config.description}</p>
  <div class="stats">
    <span>⭐ ${agent.stats?.rating || 0}</span>
    <span>📥 ${agent.stats?.installs || 0}</span>
  </div>
  <a href="https://claudeflare.market/agents/${agent.metadata.id}">
    View on ClaudeFlare Marketplace
  </a>
</div>
`;

    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: agent.config.name,
      description: agent.config.description,
      applicationCategory: agent.config.category,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      },
      aggregateRating: agent.stats?.rating ? {
        '@type': 'AggregateRating',
        ratingValue: agent.stats.rating,
        ratingCount: agent.stats.ratingCount || 0
      } : undefined
    });

    return { html, jsonLd };
  }
}

// ============================================================================
// Collaboration Service
// ============================================================================

export class CollaborationService {
  private forks: Map<string, AgentFork[]> = new Map();
  private comments: Map<string, AgentComment[]> = new Map();
  private reviews: Map<string, AgentReview[]> = new Map();

  async forkAgent(
    agentId: string,
    userId: string,
    modifications: string[]
  ): Promise<AgentFork> {
    const fork: AgentFork = {
      id: `fork-${Date.now()}`,
      originalAgentId: agentId,
      forkedAgentId: `agent-${Date.now()}`,
      userId,
      createdAt: new Date(),
      modifications
    };

    if (!this.forks.has(agentId)) {
      this.forks.set(agentId, []);
    }

    this.forks.get(agentId)!.push(fork);
    return fork;
  }

  async getForks(agentId: string): Promise<AgentFork[]> {
    return this.forks.get(agentId) || [];
  }

  async addComment(
    agentId: string,
    userId: string,
    content: string,
    parentId?: string
  ): Promise<AgentComment> {
    const comment: AgentComment = {
      id: `comment-${Date.now()}`,
      agentId,
      userId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentId,
      replies: [],
      reactions: []
    };

    if (!this.comments.has(agentId)) {
      this.comments.set(agentId, []);
    }

    // If it's a reply, add to parent's replies
    if (parentId) {
      const parent = this.findComment(agentId, parentId);
      if (parent) {
        parent.replies.push(comment);
      }
    } else {
      this.comments.get(agentId)!.push(comment);
    }

    return comment;
  }

  private findComment(agentId: string, commentId: string): AgentComment | undefined {
    const comments = this.comments.get(agentId) || [];

    for (const comment of comments) {
      if (comment.id === commentId) {
        return comment;
      }

      // Check replies
      for (const reply of comment.replies) {
        if (reply.id === commentId) {
          return reply;
        }
      }
    }

    return undefined;
  }

  async getComments(agentId: string): Promise<AgentComment[]> {
    return this.comments.get(agentId) || [];
  }

  async addReaction(
    agentId: string,
    commentId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    const comment = this.findComment(agentId, commentId);
    if (!comment) return;

    const existingReaction = comment.reactions.find(r => r.emoji === emoji);
    if (existingReaction) {
      if (!existingReaction.users.includes(userId)) {
        existingReaction.users.push(userId);
        existingReaction.count++;
      }
    } else {
      comment.reactions.push({
        emoji,
        count: 1,
        users: [userId]
      });
    }
  }

  async removeReaction(
    agentId: string,
    commentId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    const comment = this.findComment(agentId, commentId);
    if (!comment) return;

    const reaction = comment.reactions.find(r => r.emoji === emoji);
    if (reaction) {
      reaction.users = reaction.users.filter(u => u !== userId);
      reaction.count = reaction.users.length;

      if (reaction.count === 0) {
        comment.reactions = comment.reactions.filter(r => r.emoji !== emoji);
      }
    }
  }

  async addReview(
    agentId: string,
    userId: string,
    rating: number,
    title: string,
    content: string
  ): Promise<AgentReview> {
    const review: AgentReview = {
      id: `review-${Date.now()}`,
      agentId,
      userId,
      rating: Math.max(1, Math.min(5, rating)),
      title,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      helpful: 0,
      verified: false
    };

    if (!this.reviews.has(agentId)) {
      this.reviews.set(agentId, []);
    }

    this.reviews.get(agentId)!.push(review);
    return review;
  }

  async getReviews(agentId: string): Promise<AgentReview[]> {
    return this.reviews.get(agentId) || [];
  }

  async markReviewHelpful(reviewId: string, userId: string): Promise<void> {
    for (const reviews of this.reviews.values()) {
      const review = reviews.find(r => r.id === reviewId);
      if (review) {
        review.helpful++;
      }
    }
  }

  async updateAgentStats(agentId: string): Promise<AgentStats> {
    const reviews = this.reviews.get(agentId) || [];
    const forks = this.forks.get(agentId) || [];

    const rating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    return {
      installs: 0, // Would be tracked separately
      uses: 0,
      rating: Math.round(rating * 10) / 10,
      ratingCount: reviews.length,
      views: 0,
      forks: forks.length
    };
  }
}

// ============================================================================
// Collection Service
// ============================================================================

export class CollectionService {
  private collections: Map<string, AgentCollection> = new Map();

  async createCollection(
    userId: string,
    name: string,
    description: string,
    visibility: 'public' | 'private' = 'private'
  ): Promise<AgentCollection> {
    const collection: AgentCollection = {
      id: `collection-${Date.now()}`,
      name,
      description,
      userId,
      agents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      visibility,
      followers: 0
    };

    this.collections.set(collection.id, collection);
    return collection;
  }

  async addAgentToCollection(
    collectionId: string,
    agentId: string
  ): Promise<void> {
    const collection = this.collections.get(collectionId);
    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    if (!collection.agents.includes(agentId)) {
      collection.agents.push(agentId);
      collection.updatedAt = new Date();
    }
  }

  async removeAgentFromCollection(
    collectionId: string,
    agentId: string
  ): Promise<void> {
    const collection = this.collections.get(collectionId);
    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    collection.agents = collection.agents.filter(id => id !== agentId);
    collection.updatedAt = new Date();
  }

  async getCollection(collectionId: string): Promise<AgentCollection | undefined> {
    return this.collections.get(collectionId);
  }

  async listUserCollections(userId: string): Promise<AgentCollection[]> {
    return Array.from(this.collections.values()).filter(c => c.userId === userId);
  }

  async listPublicCollections(limit: number = 20): Promise<AgentCollection[]> {
    return Array.from(this.collections.values())
      .filter(c => c.visibility === 'public')
      .sort((a, b) => b.followers - a.followers)
      .slice(0, limit);
  }

  async followCollection(collectionId: string, userId: string): Promise<void> {
    const collection = this.collections.get(collectionId);
    if (!collection) return;

    collection.followers++;
  }

  async unfollowCollection(collectionId: string, userId: string): Promise<void> {
    const collection = this.collections.get(collectionId);
    if (!collection) return;

    collection.followers = Math.max(0, collection.followers - 1);
  }
}

// ============================================================================
// User Profile Service
// ============================================================================

export class UserProfileService {
  private profiles: Map<string, UserProfile> = new Map();

  async createProfile(data: {
    username: string;
    displayName: string;
    email: string;
    bio?: string;
    location?: string;
    website?: string;
  }): Promise<UserProfile> {
    const profile: UserProfile = {
      id: `user-${Date.now()}`,
      username: data.username,
      displayName: data.displayName,
      email: data.email,
      bio: data.bio,
      location: data.location,
      website: data.website,
      createdAt: new Date(),
      stats: {
        agentsPublished: 0,
        totalInstalls: 0,
        totalUses: 0,
        followers: 0,
        following: 0
      },
      badges: [],
      verified: false
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  async getProfile(userId: string): Promise<UserProfile | undefined> {
    return this.profiles.get(userId);
  }

  async updateProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      throw new Error(`Profile ${userId} not found`);
    }

    Object.assign(profile, updates);
    this.profiles.set(userId, profile);
    return profile;
  }

  async addBadge(userId: string, badge: string): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) return;

    if (!profile.badges.includes(badge)) {
      profile.badges.push(badge);
    }
  }

  async followUser(followerId: string, followingId: string): Promise<void> {
    const follower = this.profiles.get(followerId);
    const following = this.profiles.get(followingId);

    if (follower && following) {
      follower.stats.following++;
      following.stats.followers++;
    }
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const follower = this.profiles.get(followerId);
    const following = this.profiles.get(followingId);

    if (follower && following) {
      follower.stats.following = Math.max(0, follower.stats.following - 1);
      following.stats.followers = Math.max(0, following.stats.followers - 1);
    }
  }

  async awardBadge(userId: string, badge: string): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) return;

    if (!profile.badges.includes(badge)) {
      profile.badges.push(badge);
    }
  }

  checkBadgeEligibility(userId: string): string[] {
    const profile = this.profiles.get(userId);
    if (!profile) return [];

    const badges: string[] = [];

    // Early adopter badge
    const daysSinceCreation = (Date.now() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) {
      badges.push('early_adopter');
    }

    // Prolific creator badge
    if (profile.stats.agentsPublished >= 10) {
      badges.push('prolific_creator');
    }

    // Popular creator badge
    if (profile.stats.totalInstalls >= 1000) {
      badges.push('popular_creator');
    }

    // Verified expert badge
    if (profile.stats.agentsPublished >= 5 && profile.stats.totalInstalls >= 500) {
      badges.push('verified_expert');
    }

    return badges;
  }
}

// ============================================================================
// Social Features
// ============================================================================

export class SocialFeatures {
  private trending: Map<string, number> = new Map();

  async trackView(agentId: string): Promise<void> {
    this.trending.set(agentId, (this.trending.get(agentId) || 0) + 1);
  }

  async getTrendingAgents(limit: number = 10): Promise<string[]> {
    return Array.from(this.trending.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
  }

  async getAgentSocialScore(agentId: string): Promise<{
    views: number;
    shares: number;
    comments: number;
    reviews: number;
    forks: number;
    overall: number;
  }> {
    // Calculate social engagement score
    const views = this.trending.get(agentId) || 0;
    const shares = 0; // Would be tracked separately
    const comments = 0; // Would be tracked separately
    const reviews = 0; // Would be tracked separately
    const forks = 0; // Would be tracked separately

    const overall = views * 1 + shares * 10 + comments * 5 + reviews * 15 + forks * 20;

    return {
      views,
      shares,
      comments,
      reviews,
      forks,
      overall
    };
  }

  async generateSharePreview(agent: Agent): Promise<{
    title: string;
    description: string;
    image: string;
    url: string;
  }> {
    return {
      title: `${agent.config.name} - ClaudeFlare Agent`,
      description: agent.config.description,
      image: `https://claudeflare.market/og/agents/${agent.metadata.id}.png`,
      url: `https://claudeflare.market/agents/${agent.metadata.id}`
    };
  }
}

// ============================================================================
// Analytics and Insights
// ============================================================================

export class CommunityAnalytics {
  async getAgentInsights(agentId: string): Promise<{
    engagement: {
      views: number;
      uniqueVisitors: number;
      avgTimeOnPage: number;
      bounceRate: number;
    };
    social: {
      shares: number;
      comments: number;
      reviews: number;
      avgRating: number;
    };
    growth: {
      installsOverTime: Array<{ date: Date; count: number }>;
      forksOverTime: Array<{ date: Date; count: number }>;
    };
  }> {
    // Mock implementation - would query analytics database
    return {
      engagement: {
        views: 1000,
        uniqueVisitors: 800,
        avgTimeOnPage: 120,
        bounceRate: 0.4
      },
      social: {
        shares: 50,
        comments: 25,
        reviews: 10,
        avgRating: 4.5
      },
      growth: {
        installsOverTime: [],
        forksOverTime: []
      }
    };
  }

  async getUserInsights(userId: string): Promise<{
    totalAgents: number;
    totalInstalls: number;
    totalReviews: number;
    avgRating: number;
    topAgents: string[];
  }> {
    // Mock implementation
    return {
      totalAgents: 5,
      totalInstalls: 500,
      totalReviews: 20,
      avgRating: 4.3,
      topAgents: []
    };
  }

  async getCommunityStats(): Promise<{
    totalAgents: number;
    totalUsers: number;
    totalInstalls: number;
    avgRating: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    // Mock implementation
    return {
      totalAgents: 1000,
      totalUsers: 5000,
      totalInstalls: 50000,
      avgRating: 4.2,
      topCategories: []
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default SharingService;
