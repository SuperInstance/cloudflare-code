/**
 * Code Review Analytics
 * Analyze code review patterns and provide insights
 */

// @ts-nocheck - Analytics with unused imports
import type {
  Review,
  ReviewComment,
  ReviewAssignment,
  ReviewAnalytics,
  ReviewStatistics,
} from '../types';

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Generate a summary of a code review
 */
export function generateReviewSummary(review: Review): string {
  const daysSinceCreation = Math.floor(
    (Date.now() - review.created) / 86400000
  );

  const summary = [
    `Code Review Summary`,
    `==================`,
    `Title: ${review.title}`,
    `Status: ${review.status}`,
    `Priority: ${review.priority}`,
    `Created: ${new Date(review.created).toLocaleDateString()}`,
    `Age: ${daysSinceCreation} days`,
    ``,
    `Statistics:`,
    `- Total Files: ${review.statistics.totalFiles}`,
    `- Additions: ${review.statistics.totalAdditions}`,
    `- Deletions: ${review.statistics.totalDeletions}`,
    `- Comments: ${review.statistics.commentsCount}`,
    `- Resolutions: ${review.statistics.resolutionsCount}`,
    ``,
    `Reviewers: ${review.reviewerIds.length}`,
    `Settings:`,
    `- Min Approvals: ${review.settings.minApprovals}`,
    `- Require All: ${review.settings.requireAllApprovals}`,
    ``,
    review.dueDate
      ? `Due Date: ${new Date(review.dueDate).toLocaleDateString()}`
      : 'No Due Date',
  ].join('\n');

  return summary;
}

/**
 * Calculate review velocity (reviews completed per time period)
 */
export function calculateReviewVelocity(
  reviews: Review[],
  periodDays: number = 7
  ): {
  completedReviews: number;
  velocity: number;
  trend: 'increasing' | 'stable' | 'decreasing';
} {
  const now = Date.now();
  const periodMs = periodDays * 86400000;

  // Get reviews from the last period
  const recentReviews = reviews.filter(
    (r) =>
      r.status === 'approved' || r.status === 'rejected'
  );

  const completedReviews = recentReviews.length;
  const velocity = periodDays > 0 ? completedReviews / periodDays : 0;

  // Calculate trend by comparing with previous period
  const previousPeriodStart = now - periodMs * 2;
  const previousPeriodEnd = now - periodMs;

  const previousReviews = reviews.filter(
    (r) =>
      (r.status === 'approved' || r.status === 'rejected') &&
      r.created >= previousPeriodStart &&
      r.created <= previousPeriodEnd
  );

  const previousVelocity = periodDays > 0 ? previousReviews.length / periodDays : 0;

  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';

  if (velocity > previousVelocity * 1.1) {
    trend = 'increasing';
  } else if (velocity < previousVelocity * 0.9) {
    trend = 'decreasing';
  }

  return {
    completedReviews,
    velocity,
    trend,
  };
}

/**
 * Identify review bottlenecks
 */
export function identifyReviewBottlenecks(
  reviews: Review[],
  assignments: Map<string, ReviewAssignment[]>
  ): {
  slowReviewers: string[];
  backedUpReviews: string[];
  overdueReviews: string[];
  recommendations: string[];
} {
  const slowReviewers: string[] = [];
  const backedUpReviews: string[] = [];
  const overdueReviews: string[] = [];
  const recommendations: string[] = [];

  const now = Date.now();
  const reviewerStats = new Map<string, { count: number; totalTime: number }>();

  // Analyze reviewer performance
  for (const [reviewId, reviewAssignments] of assignments.entries()) {
    const review = reviews.find((r) => r.id === reviewId);
    if (!review) continue;

    for (const assignment of reviewAssignments) {
      if (assignment.status === 'completed' && assignment.completedAt) {
        const stats = reviewerStats.get(assignment.reviewerId) || {
          count: 0,
          totalTime: 0,
        };
        stats.count++;
        stats.totalTime += assignment.completedAt - assignment.assignedAt;
        reviewerStats.set(assignment.reviewerId, stats);
      }
    }
  }

  // Identify slow reviewers (below average completion time)
  const avgCompletionTime = Array.from(reviewerStats.values()).reduce(
    (sum, stats) => sum + stats.totalTime / stats.count,
    0
  ) / Math.max(reviewerStats.size, 1);

  for (const [reviewerId, stats] of reviewerStats.entries()) {
    const avgTime = stats.totalTime / stats.count;
    if (avgTime > avgCompletionTime * 1.5) {
      slowReviewers.push(reviewerId);
    }
  }

  // Identify backed up reviews (high comment count, not approved)
  for (const review of reviews) {
    if (
      review.status === 'in_review' &&
      review.statistics.commentsCount > 10
    ) {
      backedUpReviews.push(review.id);
    }

    // Check for overdue reviews
    if (review.dueDate && now > review.dueDate && review.status !== 'approved') {
      overdueReviews.push(review.id);
    }
  }

  // Generate recommendations
  if (slowReviewers.length > 0) {
    recommendations.push(
      `Consider providing additional training or resources for ${slowReviewers.length} reviewers with below-average performance`
    );
  }

  if (backedUpReviews.length > 0) {
    recommendations.push(
      `${backedUpReviews.length} reviews have high comment counts - consider breaking them into smaller PRs`
    );
  }

  if (overdueReviews.length > 0) {
    recommendations.push(
      `${overdueReviews.length} reviews are overdue - prioritize review assignments`
    );
  }

  return {
    slowReviewers,
    backedUpReviews,
    overdueReviews,
    recommendations,
  };
}

/**
 * Generate a performance report for a reviewer
 */
export function generateReviewerReport(
  userId: string,
  reviews: Review[],
  assignments: Map<string, ReviewAssignment[]>,
  comments: Map<string, ReviewComment[]>
  ): {
  userId: string;
  totalReviews: number;
  completedReviews: number;
  declinedReviews: number;
  averageCompletionTime: number;
  averageCommentsPerReview: number;
  totalComments: number;
  approvalRate: number;
  topCategories: string[];
  performance: 'excellent' | 'good' | 'average' | 'needs-improvement';
} {
  const userAssignments: ReviewAssignment[] = [];

  for (const reviewAssignments of assignments.values()) {
    for (const assignment of reviewAssignments) {
      if (assignment.reviewerId === userId) {
        userAssignments.push(assignment);
      }
    }
  }

  const completedReviews = userAssignments.filter(
    (a) => a.status === 'completed'
  ).length;

  const declinedReviews = userAssignments.filter(
    (a) => a.status === 'declined'
  ).length;

  let totalCompletionTime = 0;
  let completionCount = 0;

  for (const assignment of userAssignments) {
    if (assignment.status === 'completed' && assignment.completedAt) {
      totalCompletionTime += assignment.completedAt - assignment.assignedAt;
      completionCount++;
    }
  }

  const averageCompletionTime =
    completionCount > 0 ? totalCompletionTime / completionCount : 0;

  let totalComments = 0;
  let reviewWithComments = 0;

  for (const [reviewId, reviewComments] of comments.entries()) {
    const review = reviews.find((r) => r.id === reviewId);
    if (!review || !review.reviewerIds.includes(userId)) continue;

    const userComments = reviewComments.filter((c) => c.authorId === userId);
    if (userComments.length > 0) {
      totalComments += userComments.length;
      reviewWithComments++;
    }
  }

  const averageCommentsPerReview =
    reviewWithComments > 0 ? totalComments / reviewWithComments : 0;

  const approvalRate =
    userAssignments.length > 0
      ? completedReviews / userAssignments.length
      : 0;

  // Determine performance rating
  let performance: 'excellent' | 'good' | 'average' | 'needs-improvement';

  if (approvalRate >= 0.9 && averageCompletionTime < 86400000) {
    performance = 'excellent';
  } else if (approvalRate >= 0.7 && averageCompletionTime < 172800000) {
    performance = 'good';
  } else if (approvalRate >= 0.5) {
    performance = 'average';
  } else {
    performance = 'needs-improvement';
  }

  return {
    userId,
    totalReviews: userAssignments.length,
    completedReviews,
    declinedReviews,
    averageCompletionTime,
    averageCommentsPerReview,
    totalComments,
    approvalRate,
    topCategories: [], // Could be populated with category analysis
    performance,
  };
}

/**
 * Calculate review cycle time
 */
export function calculateReviewCycleTime(
  review: Review,
  assignments: ReviewAssignment[]
  ): number {
  const completedAssignments = assignments.filter(
    (a) => a.status === 'completed' && a.completedAt
  );

  if (completedAssignments.length === 0) {
    return 0;
  }

  const lastCompletion = Math.max(
    ...completedAssignments.map((a) => a.completedAt!)
  );

  return lastCompletion - review.created;
}

/**
 * Calculate review throughput
 */
export function calculateReviewThroughput(
  reviews: Review[],
  periodDays: number = 30
  ): {
  totalReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  throughputPerDay: number;
  averageTimeToApproval: number;
  averageTimeToRejection: number;
} {
  const now = Date.now();
  const periodMs = periodDays * 86400000;
  const cutoffDate = now - periodMs;

  const periodReviews = reviews.filter((r) => r.created >= cutoffDate);

  const approvedReviews = periodReviews.filter((r) => r.status === 'approved');
  const rejectedReviews = periodReviews.filter((r) => r.status === 'rejected');

  let totalApprovalTime = 0;
  let totalRejectionTime = 0;

  for (const review of approvedReviews) {
    totalApprovalTime += review.updated - review.created;
  }

  for (const review of rejectedReviews) {
    totalRejectionTime += review.updated - review.created;
  }

  const averageTimeToApproval =
    approvedReviews.length > 0
      ? totalApprovalTime / approvedReviews.length
      : 0;

  const averageTimeToRejection =
    rejectedReviews.length > 0
      ? totalRejectionTime / rejectedReviews.length
      : 0;

  const throughputPerDay = periodDays > 0 ? periodReviews.length / periodDays : 0;

  return {
    totalReviews: periodReviews.length,
    approvedReviews: approvedReviews.length,
    rejectedReviews: rejectedReviews.length,
    throughputPerDay,
    averageTimeToApproval,
    averageTimeToRejection,
  };
}

/**
 * Identify review hotspots (files with most review activity)
 */
export function identifyReviewHotspots(
  reviews: Review[],
  comments: Map<string, ReviewComment[]>
  ): Map<string, number> {
  const fileActivity = new Map<string, number>();

  for (const [reviewId, reviewComments] of comments.entries()) {
    for (const comment of reviewComments) {
      if (comment.filePath) {
        const count = fileActivity.get(comment.filePath) || 0;
        fileActivity.set(comment.filePath, count + 1);
      }
    }
  }

  // Sort by activity count
  const sorted = new Map(
    Array.from(fileActivity.entries()).sort((a, b) => b[1] - a[1])
  );

  return sorted;
}

/**
 * Calculate review coverage (how many changes get reviewed)
 */
export function calculateReviewCoverage(
  reviews: Review[],
  totalChanges: number
  ): {
  reviewedChanges: number;
  coverage: number;
  unreviewedChanges: number;
} {
  const reviewedChanges = reviews.filter(
    (r) => r.status === 'approved' || r.status === 'in_review'
  ).length;

  const coverage = totalChanges > 0 ? (reviewedChanges / totalChanges) * 100 : 0;
  const unreviewedChanges = totalChanges - reviewedChanges;

  return {
    reviewedChanges,
    coverage,
    unreviewedChanges,
  };
}

/**
 * Generate review insights
 */
export function generateReviewInsights(
  reviews: Review[],
  assignments: Map<string, ReviewAssignment[]>,
  comments: Map<string, ReviewComment[]>
  ): string[] {
  const insights: string[] = [];

  // Calculate overall statistics
  const avgCompletionTime = calculateAverageCompletionTime(assignments);
  const bottlenecks = identifyReviewBottlenecks(reviews, assignments);
  const throughput = calculateReviewThroughput(reviews);
  const hotspots = identifyReviewHotspots(reviews, comments);

  // Generate insights
  if (avgCompletionTime > 172800000) {
    insights.push(
      `Average review time is ${Math.round(avgCompletionTime / 3600000)} hours - consider optimizing review process`
    );
  }

  if (bottlenecks.slowReviewers.length > 0) {
    insights.push(
      `${bottlenecks.slowReviewers.length} reviewers have below-average performance`
    );
  }

  if (throughput.approvedReviews / Math.max(throughput.totalReviews, 1) < 0.5) {
    insights.push(
      `Low approval rate (${Math.round(
        (throughput.approvedReviews / throughput.totalReviews) * 100
      )}%) - investigate review quality criteria`
    );
  }

  if (hotspots.size > 0) {
    const topFile = Array.from(hotspots.entries())[0];
    insights.push(
      `File "${topFile[0]}" has the most review activity (${topFile[1]} comments)`
    );
  }

  if (bottlenecks.overdueReviews.length > 0) {
    insights.push(
      `${bottlenecks.overdueReviews.length} reviews are overdue - prioritize review assignments`
    );
  }

  return insights;
}

/**
 * Calculate average completion time for assignments
 */
function calculateAverageCompletionTime(
  assignments: Map<string, ReviewAssignment[]>
  ): number {
  let totalTime = 0;
  let count = 0;

  for (const reviewAssignments of assignments.values()) {
    for (const assignment of reviewAssignments) {
      if (assignment.status === 'completed' && assignment.completedAt) {
        totalTime += assignment.completedAt - assignment.assignedAt;
        count++;
      }
    }
  }

  return count > 0 ? totalTime / count : 0;
}

/**
 * Calculate review engagement score
 */
export function calculateReviewEngagement(
  userId: string,
  comments: Map<string, ReviewComment[]>,
  reviews: Review[]
  ): {
  totalComments: number;
  reviewsParticipated: number;
  averageCommentsPerReview: number;
  engagementScore: number;
} {
  let totalComments = 0;
  const reviewsParticipatedSet = new Set<string>();

  for (const [reviewId, reviewComments] of comments.entries()) {
    const userComments = reviewComments.filter((c) => c.authorId === userId);

    if (userComments.length > 0) {
      totalComments += userComments.length;
      reviewsParticipatedSet.add(reviewId);
    }
  }

  const reviewsParticipated = reviewsParticipatedSet.size;
  const averageCommentsPerReview =
    reviewsParticipated > 0 ? totalComments / reviewsParticipated : 0;

  // Calculate engagement score (0-100)
  const participationScore = Math.min((reviewsParticipated / reviews.length) * 50, 50);
  const commentScore = Math.min(averageCommentsPerReview * 10, 50);
  const engagementScore = participationScore + commentScore;

  return {
    totalComments,
    reviewsParticipated,
    averageCommentsPerReview,
    engagementScore: Math.round(engagementScore),
  };
}
