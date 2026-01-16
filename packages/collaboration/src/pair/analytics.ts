/**
 * Pair Programming Analytics
 * Analyze pair programming sessions for insights and improvements
 */

// @ts-nocheck - Analytics with unused imports
import type {
  PairSession,
  PairStatistics,
  ReviewAnalytics,
  UserMetrics,
  ProjectMetrics,
} from '../types';

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Generate a summary of a pair programming session
 */
export function generatePairSummary(session: PairSession): string {
  const duration = session.endedAt
    ? session.endedAt - session.startedAt
    : Date.now() - session.startedAt;

  const durationMinutes = Math.round(duration / 60000);
  const linesPerMinute = durationMinutes > 0
    ? Math.round(session.statistics.linesWritten / durationMinutes)
    : 0;

  const summary = [
    `Pair Programming Session Summary`,
    `================================`,
    `Duration: ${durationMinutes} minutes`,
    `Lines Written: ${session.statistics.linesWritten}`,
    `Files Touched: ${session.statistics.filesTouched}`,
    `Commits Made: ${session.statistics.commitsMade}`,
    `Role Switches: ${session.statistics.switchCount}`,
    `Lines per Minute: ${linesPerMinute}`,
    ``,
    `Participants:`,
    `- Driver: ${session.driver.userName}`,
    `- Navigator: ${session.navigator.userName}`,
  ].join('\n');

  return summary;
}

/**
 * Calculate pair programming efficiency score
 */
export function calculatePairEfficiency(session: PairSession): number {
  const duration = session.endedAt
    ? session.endedAt - session.startedAt
    : Date.now() - session.startedAt;

  const durationHours = duration / 3600000;

  if (durationHours === 0) {
    return 0;
  }

  // Factors that contribute to efficiency
  const linesPerHour = session.statistics.linesWritten / durationHours;
  const commitsPerHour = session.statistics.commitsMade / durationHours;
  const filesPerHour = session.statistics.filesTouched / durationHours;
  const switchPenalty = session.statistics.switchCount * 0.1;

  // Normalize and combine scores
  const linesScore = Math.min(linesPerHour / 100, 1) * 40; // Max 40 points
  const commitsScore = Math.min(commitsPerHour / 10, 1) * 30; // Max 30 points
  const filesScore = Math.min(filesPerHour / 20, 1) * 20; // Max 20 points
  const switchScore = Math.max(10 - switchPenalty, 0); // Max 10 points

  const efficiency = linesScore + commitsScore + filesScore + switchScore;

  return Math.round(efficiency);
}

/**
 * Analyze pair dynamics between two users
 */
export function analyzePairDynamics(
  sessions: PairSession[]
  ): {
  totalSessions: number;
  totalDuration: number;
  averageDuration: number;
  totalLinesWritten: number;
  totalCommits: number;
  averageEfficiency: number;
  preferredRoles: Map<string, number>;
  collaborationScore: number;
} {
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((sum, session) => {
    const duration = session.endedAt
      ? session.endedAt - session.startedAt
      : Date.now() - session.startedAt;
    return sum + duration;
  }, 0);

  const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

  const totalLinesWritten = sessions.reduce(
    (sum, session) => sum + session.statistics.linesWritten,
    0
  );

  const totalCommits = sessions.reduce(
    (sum, session) => sum + session.statistics.commitsMade,
    0
  );

  const efficiencies = sessions.map((session) =>
    calculatePairEfficiency(session)
  );

  const averageEfficiency =
    efficiencies.length > 0
      ? efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length
      : 0;

  const preferredRoles = new Map<string, number>();

  for (const session of sessions) {
    const driverCount = preferredRoles.get(session.driver.userId) || 0;
    preferredRoles.set(session.driver.userId, driverCount + 1);

    const navigatorCount = preferredRoles.get(session.navigator.userId) || 0;
    preferredRoles.set(session.navigator.userId, navigatorCount);
  }

  // Calculate collaboration score based on multiple factors
  const collaborationScore = calculateCollaborationScore(sessions);

  return {
    totalSessions,
    totalDuration,
    averageDuration,
    totalLinesWritten,
    totalCommits,
    averageEfficiency,
    preferredRoles,
    collaborationScore,
  };
}

/**
 * Calculate collaboration score between users
 */
function calculateCollaborationScore(sessions: PairSession[]): number {
  if (sessions.length === 0) {
    return 0;
  }

  let score = 0;

  // Session frequency (max 30 points)
  const sessionFrequency = Math.min(sessions.length / 10, 1) * 30;
  score += sessionFrequency;

  // Average efficiency (max 40 points)
  const avgEfficiency =
    sessions.reduce((sum, s) => sum + calculatePairEfficiency(s), 0) /
    sessions.length;
  score += (avgEfficiency / 100) * 40;

  // Role balance (max 30 points)
  const roleBalance = calculateRoleBalance(sessions);
  score += roleBalance * 30;

  return Math.round(score);
}

/**
 * Calculate role balance score
 */
function calculateRoleBalance(sessions: PairSession[]): number {
  const userIds = new Set<string>();

  for (const session of sessions) {
    userIds.add(session.driver.userId);
    userIds.add(session.navigator.userId);
  }

  if (userIds.size !== 2) {
    return 0;
  }

  const [user1, user2] = Array.from(userIds);
  let user1DriverCount = 0;
  let user2DriverCount = 0;

  for (const session of sessions) {
    if (session.driver.userId === user1) {
      user1DriverCount++;
    } else {
      user2DriverCount++;
    }
  }

  const total = user1DriverCount + user2DriverCount;
  if (total === 0) {
    return 0;
  }

  const ratio = Math.min(user1DriverCount, user2DriverCount) / total;
  return ratio * 2; // Scale to 0-1
}

/**
 * Get pair programming recommendations
 */
export function getPairRecommendations(
  sessions: PairSession[]
  ): string[] {
  const recommendations: string[] = [];
  const dynamics = analyzePairDynamics(sessions);

  // Check for low efficiency
  if (dynamics.averageEfficiency < 50) {
    recommendations.push(
      'Consider increasing communication frequency to improve efficiency'
    );
  }

  // Check for imbalance in roles
  const roleBalance = calculateRoleBalance(sessions);
  if (roleBalance < 0.3) {
    recommendations.push(
      'Try switching roles more frequently to balance collaboration'
    );
  }

  // Check for low collaboration score
  if (dynamics.collaborationScore < 60) {
    recommendations.push(
      'Consider scheduling regular pair programming sessions to improve collaboration'
    );
  }

  // Check for high switch frequency
  const avgSwitches =
    sessions.reduce((sum, s) => sum + s.statistics.switchCount, 0) /
    sessions.length;
  if (avgSwitches > 10) {
    recommendations.push(
      'Consider reducing role switch frequency for better focus'
    );
  }

  // Check for low commit frequency
  const avgCommits =
    sessions.reduce((sum, s) => sum + s.statistics.commitsMade, 0) /
    sessions.length;
  if (avgCommits < 2) {
    recommendations.push(
      'Try making more frequent commits to save progress and reduce risk'
    );
  }

  return recommendations;
}

/**
 * Calculate time to first review
 */
export function calculateTimeToFirstReview(
  reviewCreated: number,
  firstCommentTime: number
  ): number {
  return firstCommentTime - reviewCreated;
}

/**
 * Calculate review cycle time
 */
export function calculateReviewCycleTime(
  reviewCreated: number,
  reviewCompleted: number
  ): number {
  return reviewCompleted - reviewCreated;
}

/**
 * Analyze review patterns
 */
export function analyzeReviewPatterns(
  analytics: ReviewAnalytics[]
  ): {
  avgTimeToFirstReview: number;
  avgTimeToApproval: number;
  avgCommentsPerReview: number;
  avgParticipantsPerReview: number;
  avgIterationsPerReview: number;
} {
  if (analytics.length === 0) {
    return {
      avgTimeToFirstReview: 0,
      avgTimeToApproval: 0,
      avgCommentsPerReview: 0,
      avgParticipantsPerReview: 0,
      avgIterationsPerReview: 0,
    };
  }

  const avgTimeToFirstReview =
    analytics.reduce((sum, a) => sum + a.timeToFirstReview, 0) /
    analytics.length;

  const avgTimeToApproval =
    analytics.reduce((sum, a) => sum + a.timeToApproval, 0) /
    analytics.length;

  const avgCommentsPerReview =
    analytics.reduce((sum, a) => sum + a.commentCount, 0) /
    analytics.length;

  const avgParticipantsPerReview =
    analytics.reduce((sum, a) => sum + a.participantCount, 0) /
    analytics.length;

  const avgIterationsPerReview =
    analytics.reduce((sum, a) => sum + a.iterationCount, 0) /
    analytics.length;

  return {
    avgTimeToFirstReview,
    avgTimeToApproval,
    avgCommentsPerReview,
    avgParticipantsPerReview,
    avgIterationsPerReview,
  };
}

/**
 * Generate pair programming heatmap data
 */
export function generatePairHeatmap(
  sessions: PairSession[]
  ): Map<string, number> {
  const heatmap = new Map<string, number>();

  for (const session of sessions) {
    const hour = new Date(session.startedAt).getHours();
    const day = new Date(session.startedAt).getDay();
    const key = `${day}-${hour}`;

    const count = heatmap.get(key) || 0;
    heatmap.set(key, count + 1);
  }

  return heatmap;
}

/**
 * Calculate user metrics from pair sessions
 */
export function calculateUserPairMetrics(
  userId: string,
  sessions: PairSession[]
  ): UserMetrics {
  const userSessions = sessions.filter(
    (s) => s.driver.userId === userId || s.navigator.userId === userId
  );

  const sessionCount = userSessions.length;
  const totalTime = userSessions.reduce((sum, s) => {
    const duration = s.endedAt
      ? s.endedAt - s.startedAt
      : Date.now() - s.startedAt;
    return sum + duration;
  }, 0);

  const avgSessionDuration = sessionCount > 0 ? totalTime / sessionCount : 0;

  let editCount = 0;
  let reviewCount = 0;

  for (const session of userSessions) {
    if (session.driver.userId === userId) {
      editCount += session.statistics.linesWritten;
    } else {
      reviewCount += session.statistics.linesWritten;
    }
  }

  const commentCount = 0; // Not tracked in pair sessions

  return {
    userId,
    sessionCount,
    editCount,
    commentCount,
    reviewCount,
    totalTime,
    avgSessionDuration,
  };
}

/**
 * Calculate project metrics from pair sessions
 */
export function calculateProjectPairMetrics(
  projectId: string,
  sessions: PairSession[]
  ): ProjectMetrics {
  const projectSessions = sessions.filter((s) => s.projectId === projectId);

  const activeUsers = new Set<string>();

  for (const session of projectSessions) {
    activeUsers.add(session.driver.userId);
    activeUsers.add(session.navigator.userId);
  }

  const totalSessions = projectSessions.length;
  const totalEdits = projectSessions.reduce(
    (sum, s) => sum + s.statistics.linesWritten,
    0
  );

  const totalComments = 0; // Not tracked in pair sessions
  const documentCount = projectSessions.reduce(
    (sum, s) => sum + s.statistics.filesTouched,
    0
  );

  return {
    projectId,
    activeUsers: activeUsers.size,
    totalSessions,
    totalEdits,
    totalComments,
    documentCount,
  };
}
