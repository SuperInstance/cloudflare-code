/**
 * Code Review Manager
 * Manages the code review workflow including assignments, comments, and approvals
 */

import { nanoid } from 'nanoid';
import type {
  Review,
  ReviewStatus,
  ReviewPriority,
  ReviewSettings,
  ReviewStatistics,
  ReviewComment,
  CommentType,
  CommentStatus,
  CommentReaction,
  ReviewAssignment,
  AssignmentStatus,
  SuggestedChange,
  ReviewAnalytics,
} from '../types';

// ============================================================================
// Code Review Manager
// ============================================================================

export class CodeReviewManager {
  private reviews: Map<string, Review> = new Map();
  private comments: Map<string, ReviewComment[]> = new Map();
  private assignments: Map<string, ReviewAssignment[]> = new Map();
  private suggestedChanges: Map<string, SuggestedChange[]> = new Map();
  private analytics: Map<string, ReviewAnalytics> = new Map();

  // ============================================================================
  // Review Management
  // ============================================================================

  /**
   * Create a new code review
   */
  createReview(
    projectId: string,
    pullRequestId: string,
    title: string,
    description: string,
    authorId: string,
    reviewerIds: string[],
    options?: {
      priority?: ReviewPriority;
      dueDate?: number;
      settings?: Partial<ReviewSettings>;
    }
  ): Review {
    const review: Review = {
      id: nanoid(),
      projectId,
      pullRequestId,
      title,
      description,
      authorId,
      reviewerIds,
      status: 'pending',
      priority: options?.priority || 'medium',
      created: Date.now(),
      updated: Date.now(),
      dueDate: options?.dueDate,
      settings: {
        requireAllApprovals: options?.settings?.requireAllApprovals || false,
        minApprovals: options?.settings?.minApprovals || 1,
        allowSelfApproval: options?.settings?.allowSelfApproval || false,
        dismissStaleReviews: options?.settings?.dismissStaleReviews || true,
        staleReviewDays: options?.settings?.staleReviewDays || 7,
      },
      statistics: {
        totalFiles: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        commentsCount: 0,
        resolutionsCount: 0,
      },
    };

    this.reviews.set(review.id, review);
    this.comments.set(review.id, []);
    this.assignments.set(review.id, []);
    this.suggestedChanges.set(review.id, []);

    // Create assignments for reviewers
    for (const reviewerId of reviewerIds) {
      this.createAssignment(review.id, reviewerId, authorId);
    }

    // Initialize analytics
    this.analytics.set(review.id, {
      reviewId: review.id,
      timeToFirstReview: 0,
      timeToApproval: 0,
      commentCount: 0,
      participantCount: reviewerIds.length,
      iterationCount: 0,
    });

    return review;
  }

  /**
   * Get a review by ID
   */
  getReview(reviewId: string): Review | undefined {
    return this.reviews.get(reviewId);
  }

  /**
   * Get reviews for a project
   */
  getReviewsForProject(projectId: string): Review[] {
    return Array.from(this.reviews.values()).filter(
      (r) => r.projectId === projectId
    );
  }

  /**
   * Get reviews for a user
   */
  getReviewsForUser(userId: string): Review[] {
    return Array.from(this.reviews.values()).filter(
      (r) =>
        r.authorId === userId || r.reviewerIds.includes(userId)
    );
  }

  /**
   * Update review status
   */
  updateReviewStatus(
    reviewId: string,
    status: ReviewStatus
  ): Review | undefined {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return undefined;
    }

    review.status = status;
    review.updated = Date.now();

    // Update analytics if approved
    if (status === 'approved') {
      const analytics = this.analytics.get(reviewId);
      if (analytics) {
        analytics.timeToApproval = Date.now() - review.created;
      }
    }

    return review;
  }

  /**
   * Update review statistics
   */
  updateReviewStatistics(
    reviewId: string,
    statistics: Partial<ReviewStatistics>
  ): Review | undefined {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return undefined;
    }

    review.statistics = {
      ...review.statistics,
      ...statistics,
    };
    review.updated = Date.now();

    return review;
  }

  /**
   * Delete a review
   */
  deleteReview(reviewId: string): boolean {
    this.comments.delete(reviewId);
    this.assignments.delete(reviewId);
    this.suggestedChanges.delete(reviewId);
    this.analytics.delete(reviewId);
    return this.reviews.delete(reviewId);
  }

  // ============================================================================
  // Comment Management
  // ============================================================================

  /**
   * Add a comment to a review
   */
  addComment(
    reviewId: string,
    authorId: string,
    authorName: string,
    content: string,
    options?: {
      inReplyTo?: string;
      filePath?: string;
      line?: number;
      type?: CommentType;
    }
  ): ReviewComment {
    const comment: ReviewComment = {
      id: nanoid(),
      reviewId,
      inReplyTo: options?.inReplyTo,
      authorId,
      authorName,
      content,
      filePath: options?.filePath || '',
      line: options?.line,
      type: options?.type || (options?.filePath ? 'inline' : 'general'),
      status: 'active',
      created: Date.now(),
      updated: Date.now(),
      resolved: false,
      reactions: [],
    };

    const comments = this.comments.get(reviewId) || [];
    comments.push(comment);
    this.comments.set(reviewId, comments);

    // Update review statistics
    const review = this.reviews.get(reviewId);
    if (review) {
      review.statistics.commentsCount = comments.length;
      review.updated = Date.now();

      // Update analytics
      const analytics = this.analytics.get(reviewId);
      if (analytics && analytics.timeToFirstReview === 0) {
        analytics.timeToFirstReview = Date.now() - review.created;
      }
      if (analytics) {
        analytics.commentCount = comments.length;
      }
    }

    return comment;
  }

  /**
   * Get comments for a review
   */
  getComments(reviewId: string): ReviewComment[] {
    return this.comments.get(reviewId) || [];
  }

  /**
   * Get a comment by ID
   */
  getComment(reviewId: string, commentId: string): ReviewComment | undefined {
    const comments = this.comments.get(reviewId) || [];
    return comments.find((c) => c.id === commentId);
  }

  /**
   * Update a comment
   */
  updateComment(
    reviewId: string,
    commentId: string,
    updates: Partial<Pick<ReviewComment, 'content' | 'status'>>
  ): ReviewComment | undefined {
    const comments = this.comments.get(reviewId);
    if (!comments) {
      return undefined;
    }

    const comment = comments.find((c) => c.id === commentId);
    if (!comment) {
      return undefined;
    }

    Object.assign(comment, updates);
    comment.updated = Date.now();

    this.comments.set(reviewId, comments);

    // Update review statistics
    if (updates.status === 'resolved') {
      const review = this.reviews.get(reviewId);
      if (review) {
        review.statistics.resolutionsCount++;
        review.updated = Date.now();
      }
    }

    return comment;
  }

  /**
   * Resolve a comment
   */
  resolveComment(
    reviewId: string,
    commentId: string,
    resolvedBy: string
  ): ReviewComment | undefined {
    const comment = this.getComment(reviewId, commentId);
    if (!comment) {
      return undefined;
    }

    comment.resolved = true;
    comment.resolvedBy = resolvedBy;
    comment.resolvedAt = Date.now();
    comment.status = 'resolved';
    comment.updated = Date.now();

    // Update review statistics
    const review = this.reviews.get(reviewId);
    if (review) {
      review.statistics.resolutionsCount++;
      review.updated = Date.now();
    }

    return comment;
  }

  /**
   * Add a reaction to a comment
   */
  addReaction(
    reviewId: string,
    commentId: string,
    emoji: string,
    userId: string
  ): CommentReaction | undefined {
    const comments = this.comments.get(reviewId);
    if (!comments) {
      return undefined;
    }

    const comment = comments.find((c) => c.id === commentId);
    if (!comment) {
      return undefined;
    }

    let reaction = comment.reactions.find((r) => r.emoji === emoji);

    if (reaction) {
      if (!reaction.users.includes(userId)) {
        reaction.users.push(userId);
        reaction.count++;
      }
    } else {
      reaction = {
        emoji,
        users: [userId],
        count: 1,
      };
      comment.reactions.push(reaction);
    }

    comment.updated = Date.now();
    this.comments.set(reviewId, comments);

    return reaction;
  }

  /**
   * Remove a reaction from a comment
   */
  removeReaction(
    reviewId: string,
    commentId: string,
    emoji: string,
    userId: string
  ): boolean {
    const comments = this.comments.get(reviewId);
    if (!comments) {
      return false;
    }

    const comment = comments.find((c) => c.id === commentId);
    if (!comment) {
      return false;
    }

    const reactionIndex = comment.reactions.findIndex((r) => r.emoji === emoji);
    if (reactionIndex === -1) {
      return false;
    }

    const reaction = comment.reactions[reactionIndex];
    const userIndex = reaction.users.indexOf(userId);

    if (userIndex > -1) {
      reaction.users.splice(userIndex, 1);
      reaction.count--;

      if (reaction.count === 0) {
        comment.reactions.splice(reactionIndex, 1);
      }

      comment.updated = Date.now();
      this.comments.set(reviewId, comments);
      return true;
    }

    return false;
  }

  /**
   * Delete a comment
   */
  deleteComment(reviewId: string, commentId: string): boolean {
    const comments = this.comments.get(reviewId);
    if (!comments) {
      return false;
    }

    const index = comments.findIndex((c) => c.id === commentId);
    if (index === -1) {
      return false;
    }

    comments.splice(index, 1);
    this.comments.set(reviewId, comments);

    // Update review statistics
    const review = this.reviews.get(reviewId);
    if (review) {
      review.statistics.commentsCount = comments.length;
      review.updated = Date.now();
    }

    return true;
  }

  // ============================================================================
  // Assignment Management
  // ============================================================================

  /**
   * Create a review assignment
   */
  createAssignment(
    reviewId: string,
    reviewerId: string,
    assignedBy: string
  ): ReviewAssignment {
    const assignment: ReviewAssignment = {
      reviewId,
      reviewerId,
      assignedBy,
      assignedAt: Date.now(),
      status: 'pending',
    };

    const assignments = this.assignments.get(reviewId) || [];
    assignments.push(assignment);
    this.assignments.set(reviewId, assignments);

    return assignment;
  }

  /**
   * Get assignments for a review
   */
  getAssignments(reviewId: string): ReviewAssignment[] {
    return this.assignments.get(reviewId) || [];
  }

  /**
   * Get assignments for a user
   */
  getAssignmentsForUser(userId: string): ReviewAssignment[] {
    const allAssignments: ReviewAssignment[] = [];

    for (const assignments of this.assignments.values()) {
      for (const assignment of assignments) {
        if (assignment.reviewerId === userId) {
          allAssignments.push(assignment);
        }
      }
    }

    return allAssignments;
  }

  /**
   * Update assignment status
   */
  updateAssignmentStatus(
    reviewId: string,
    reviewerId: string,
    status: AssignmentStatus
  ): ReviewAssignment | undefined {
    const assignments = this.assignments.get(reviewId);
    if (!assignments) {
      return undefined;
    }

    const assignment = assignments.find((a) => a.reviewerId === reviewerId);
    if (!assignment) {
      return undefined;
    }

    assignment.status = status;

    if (status === 'completed') {
      assignment.completedAt = Date.now();
    }

    this.assignments.set(reviewId, assignments);

    // Check if review should be approved
    this.checkReviewApproval(reviewId);

    return assignment;
  }

  /**
   * Check if review should be approved based on assignments
   */
  private checkReviewApproval(reviewId: string): void {
    const review = this.reviews.get(reviewId);
    const assignments = this.assignments.get(reviewId);

    if (!review || !assignments) {
      return;
    }

    const completedAssignments = assignments.filter(
      (a) => a.status === 'completed'
    );

    // Check if minimum approvals met
    if (completedAssignments.length >= review.settings.minApprovals) {
      if (!review.settings.requireAllApprovals) {
        review.status = 'approved';
        review.updated = Date.now();

        // Update analytics
        const analytics = this.analytics.get(reviewId);
        if (analytics) {
          analytics.timeToApproval = Date.now() - review.created;
        }
      }
    }

    // If all required reviewers have completed, approve
    if (review.settings.requireAllApprovals) {
      if (completedAssignments.length === review.reviewerIds.length) {
        review.status = 'approved';
        review.updated = Date.now();

        // Update analytics
        const analytics = this.analytics.get(reviewId);
        if (analytics) {
          analytics.timeToApproval = Date.now() - review.created;
        }
      }
    }
  }

  // ============================================================================
  // Suggested Changes
  // ============================================================================

  /**
   * Add a suggested change
   */
  addSuggestedChange(
    reviewId: string,
    commentId: string,
    originalContent: string,
    suggestedContent: string,
    filePath: string,
    startLine: number,
    endLine: number
  ): SuggestedChange {
    const change: SuggestedChange = {
      commentId,
      originalContent,
      suggestedContent,
      filePath,
      startLine,
      endLine,
      applied: false,
    };

    const changes = this.suggestedChanges.get(reviewId) || [];
    changes.push(change);
    this.suggestedChanges.set(reviewId, changes);

    return change;
  }

  /**
   * Get suggested changes for a review
   */
  getSuggestedChanges(reviewId: string): SuggestedChange[] {
    return this.suggestedChanges.get(reviewId) || [];
  }

  /**
   * Apply a suggested change
   */
  applySuggestedChange(
    reviewId: string,
    commentId: string,
    appliedBy: string
  ): SuggestedChange | undefined {
    const changes = this.suggestedChanges.get(reviewId);
    if (!changes) {
      return undefined;
    }

    const change = changes.find((c) => c.commentId === commentId);
    if (!change) {
      return undefined;
    }

    change.applied = true;
    change.appliedBy = appliedBy;
    change.appliedAt = Date.now();

    this.suggestedChanges.set(reviewId, changes);

    return change;
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  /**
   * Get review analytics
   */
  getAnalytics(reviewId: string): ReviewAnalytics | undefined {
    return this.analytics.get(reviewId);
  }

  /**
   * Get analytics for multiple reviews
   */
  getAnalyticsForReviews(reviewIds: string[]): ReviewAnalytics[] {
    const analytics: ReviewAnalytics[] = [];

    for (const reviewId of reviewIds) {
      const data = this.analytics.get(reviewId);
      if (data) {
        analytics.push(data);
      }
    }

    return analytics;
  }

  /**
   * Calculate average review time
   */
  calculateAverageReviewTime(projectId?: string): number {
    let reviews = Array.from(this.reviews.values());

    if (projectId) {
      reviews = reviews.filter((r) => r.projectId === projectId);
    }

    const completedReviews = reviews.filter(
      (r) => r.status === 'approved' || r.status === 'rejected'
    );

    if (completedReviews.length === 0) {
      return 0;
    }

    const totalTime = completedReviews.reduce((sum, review) => {
      const analytics = this.analytics.get(review.id);
      return sum + (analytics?.timeToApproval || 0);
    }, 0);

    return totalTime / completedReviews.length;
  }

  /**
   * Get review statistics
   */
  getReviewStatistics(projectId?: string): {
    totalReviews: number;
    pendingReviews: number;
    approvedReviews: number;
    rejectedReviews: number;
    averageReviewTime: number;
    averageCommentsPerReview: number;
  } {
    let reviews = Array.from(this.reviews.values());

    if (projectId) {
      reviews = reviews.filter((r) => r.projectId === projectId);
    }

    const pendingReviews = reviews.filter((r) => r.status === 'pending').length;
    const approvedReviews = reviews.filter((r) => r.status === 'approved').length;
    const rejectedReviews = reviews.filter((r) => r.status === 'rejected').length;

    let totalComments = 0;
    for (const review of reviews) {
      totalComments += review.statistics.commentsCount;
    }

    const averageCommentsPerReview =
      reviews.length > 0 ? totalComments / reviews.length : 0;

    const averageReviewTime = this.calculateAverageReviewTime(projectId);

    return {
      totalReviews: reviews.length,
      pendingReviews,
      approvedReviews,
      rejectedReviews,
      averageReviewTime,
      averageCommentsPerReview,
    };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up old reviews
   */
  cleanupOldReviews(maxAge: number): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [reviewId, review] of this.reviews.entries()) {
      const age = now - review.created;

      if (age > maxAge && (review.status === 'approved' || review.status === 'rejected')) {
        this.deleteReview(reviewId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.reviews.clear();
    this.comments.clear();
    this.assignments.clear();
    this.suggestedChanges.clear();
    this.analytics.clear();
  }
}
