/**
 * Activity Analytics
 * Analyze activity patterns and generate insights
 */

import type {
  Activity,
  ActivityType,
  ActivityAction,
  ActivityFilter,
} from '../types';

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Generate a summary of activities
 */
export function generateActivitySummary(activities: Activity[]): {
  totalActivities: number;
  uniqueUsers: number;
  mostActiveUser: string;
  mostActiveType: ActivityType;
  mostActiveAction: ActivityAction;
  averageActivitiesPerDay: number;
} {
  const uniqueUsers = new Set<string>();
  const userActivityCount = new Map<string, number>();
  const typeCount = new Map<ActivityType, number>();
  const actionCount = new Map<ActivityAction, number>();

  let oldestTimestamp = Date.now();
  let newestTimestamp = 0;

  for (const activity of activities) {
    uniqueUsers.add(activity.actorId);

    const userCount = userActivityCount.get(activity.actorId) || 0;
    userActivityCount.set(activity.actorId, userCount + 1);

    const typeCountValue = typeCount.get(activity.type) || 0;
    typeCount.set(activity.type, typeCountValue + 1);

    const actionCountValue = actionCount.get(activity.action) || 0;
    actionCount.set(activity.action, actionCountValue + 1);

    if (activity.timestamp < oldestTimestamp) {
      oldestTimestamp = activity.timestamp;
    }

    if (activity.timestamp > newestTimestamp) {
      newestTimestamp = activity.timestamp;
    }
  }

  let mostActiveUser = '';
  let maxUserCount = 0;

  for (const [userId, count] of userActivityCount.entries()) {
    if (count > maxUserCount) {
      mostActiveUser = userId;
      maxUserCount = count;
    }
  }

  let mostActiveType: ActivityType = 'collaboration';
  let maxTypeCount = 0;

  for (const [type, count] of typeCount.entries()) {
    if (count > maxTypeCount) {
      mostActiveType = type;
      maxTypeCount = count;
    }
  }

  let mostActiveAction: ActivityAction = 'created';
  let maxActionCount = 0;

  for (const [action, count] of actionCount.entries()) {
    if (count > maxActionCount) {
      mostActiveAction = action;
      maxActionCount = count;
    }
  }

  const daysCovered = Math.max(
    1,
    Math.ceil((newestTimestamp - oldestTimestamp) / 86400000)
  );

  const averageActivitiesPerDay = activities.length / daysCovered;

  return {
    totalActivities: activities.length,
    uniqueUsers: uniqueUsers.size,
    mostActiveUser,
    mostActiveType,
    mostActiveAction,
    averageActivitiesPerDay,
  };
}

/**
 * Calculate activity score for a user
 */
export function calculateActivityScore(
  userId: string,
  activities: Activity[]
  ): {
  score: number;
  totalActivities: number;
  byType: Record<ActivityType, number>;
  byAction: Record<ActivityAction, number>;
  rank: 'high' | 'medium' | 'low';
} {
  const userActivities = activities.filter((a) => a.actorId === userId);

  const byType: Record<string, number> = {};
  const byAction: Record<string, number> = {};

  for (const activity of userActivities) {
    byType[activity.type] = (byType[activity.type] || 0) + 1;
    byAction[activity.action] = (byAction[activity.action] || 0) + 1;
  }

  // Calculate score based on activity count and diversity
  const countScore = Math.min(userActivities.length / 100, 1) * 50;
  const diversityScore = (Object.keys(byType).length / 5) * 30;
  const actionScore = (Object.keys(byAction).length / 8) * 20;

  const score = Math.round(countScore + diversityScore + actionScore);

  let rank: 'high' | 'medium' | 'low';
  if (score >= 70) {
    rank = 'high';
  } else if (score >= 40) {
    rank = 'medium';
  } else {
    rank = 'low';
  }

  return {
    score,
    totalActivities: userActivities.length,
    byType: byType as Record<ActivityType, number>,
    byAction: byAction as Record<ActivityAction, number>,
    rank,
  };
}

/**
 * Get activity trends over time
 */
export function getActivityTrends(
  activities: Activity[],
  periodDays: number = 30
  ): {
  dailyCounts: Map<string, number>;
  trend: 'increasing' | 'stable' | 'decreasing';
  growthRate: number;
} {
  const dailyCounts = new Map<string, number>();
  const now = Date.now();
  const dayMs = 86400000;

  // Initialize all days with 0
  for (let i = periodDays - 1; i >= 0; i--) {
    const date = new Date(now - i * dayMs);
    const dateKey = date.toISOString().split('T')[0];
    dailyCounts.set(dateKey, 0);
  }

  // Count activities per day
  for (const activity of activities) {
    const date = new Date(activity.timestamp);
    const dateKey = date.toISOString().split('T')[0];

    if (dailyCounts.has(dateKey)) {
      const count = dailyCounts.get(dateKey)!;
      dailyCounts.set(dateKey, count + 1);
    }
  }

  // Calculate trend
  const counts = Array.from(dailyCounts.values());
  const firstHalf = counts.slice(0, Math.floor(counts.length / 2));
  const secondHalf = counts.slice(Math.floor(counts.length / 2));

  const firstHalfAvg =
    firstHalf.reduce((sum, c) => sum + c, 0) / firstHalf.length;
  const secondHalfAvg =
    secondHalf.reduce((sum, c) => sum + c, 0) / secondHalf.length;

  let trend: 'increasing' | 'stable' | 'decreasing';
  const growthRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

  if (growthRate > 10) {
    trend = 'increasing';
  } else if (growthRate < -10) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  return {
    dailyCounts,
    trend,
    growthRate: Math.round(growthRate),
  };
}

/**
 * Get peak activity hours
 */
export function getPeakActivityHours(activities: Activity[]): Map<number, number> {
  const hourCounts = new Map<number, number>();

  for (const activity of activities) {
    const hour = new Date(activity.timestamp).getHours();
    const count = hourCounts.get(hour) || 0;
    hourCounts.set(hour, count + 1);
  }

  // Sort by count descending
  const sorted = new Map(
    Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])
  );

  return sorted;
}

/**
 * Get user activity heatmap
 */
export function getUserActivityHeatmap(
  userId: string,
  activities: Activity[]
  ): Map<string, number> {
  const heatmap = new Map<string, number>();

  for (const activity of activities) {
    if (activity.actorId !== userId) {
      continue;
    }

    const date = new Date(activity.timestamp);
    const day = date.getDay();
    const hour = date.getHours();
    const key = `${day}-${hour}`;

    const count = heatmap.get(key) || 0;
    heatmap.set(key, count + 1);
  }

  return heatmap;
}

/**
 * Find inactive users
 */
export function findInactiveUsers(
  activities: Activity[],
  allUserIds: string[],
  inactiveDays: number = 30
  ): string[] {
  const now = Date.now();
  const inactiveThreshold = now - inactiveDays * 86400000;
  const lastActivityByUser = new Map<string, number>();

  // Find last activity for each user
  for (const activity of activities) {
    const lastActivity = lastActivityByUser.get(activity.actorId) || 0;
    if (activity.timestamp > lastActivity) {
      lastActivityByUser.set(activity.actorId, activity.timestamp);
    }
  }

  // Find inactive users
  const inactiveUsers: string[] = [];

  for (const userId of allUserIds) {
    const lastActivity = lastActivityByUser.get(userId) || 0;
    if (lastActivity < inactiveThreshold) {
      inactiveUsers.push(userId);
    }
  }

  return inactiveUsers;
}

/**
 * Calculate engagement rate
 */
export function calculateEngagementRate(
  activities: Activity[],
  totalUsers: number
  ): {
  engagedUsers: number;
  engagementRate: number;
  averageActivitiesPerUser: number;
} {
  const activeUsers = new Set<string>();

  for (const activity of activities) {
    activeUsers.add(activity.actorId);
  }

  const engagedUsers = activeUsers.size;
  const engagementRate = totalUsers > 0 ? (engagedUsers / totalUsers) * 100 : 0;
  const averageActivitiesPerUser =
    engagedUsers > 0 ? activities.length / engagedUsers : 0;

  return {
    engagedUsers,
    engagementRate: Math.round(engagementRate),
    averageActivitiesPerUser: Math.round(averageActivitiesPerUser * 10) / 10,
  };
}

/**
 * Generate activity insights
 */
export function generateActivityInsights(activities: Activity[]): string[] {
  const insights: string[] = [];
  const summary = generateActivitySummary(activities);
  const trends = getActivityTrends(activities);
  const engagement = calculateEngagementRate(activities, summary.uniqueUsers);
  const peakHours = getPeakActivityHours(activities);

  // Trend insights
  if (trends.trend === 'increasing') {
    insights.push(
      `Activity is trending upward with ${trends.growthRate}% growth`
    );
  } else if (trends.trend === 'decreasing') {
    insights.push(
      `Activity is declining with ${Math.abs(trends.growthRate)}% decrease - consider engagement strategies`
    );
  } else {
    insights.push('Activity levels are stable');
  }

  // Engagement insights
  if (engagement.engagementRate < 30) {
    insights.push(
      `Low engagement rate (${engagement.engagementRate}%) - consider improving user onboarding and features`
    );
  } else if (engagement.engagementRate > 70) {
    insights.push('High engagement rate - users are actively using the platform');
  }

  // Peak hours insights
  if (peakHours.size > 0) {
    const [peakHour, peakCount] = Array.from(peakHours.entries())[0];
    insights.push(
      `Peak activity is at ${peakHour}:00 with ${peakCount} activities`
    );
  }

  // Activity type insights
  if (summary.mostActiveType === 'collaboration') {
    insights.push('Users are highly engaged in collaboration features');
  } else if (summary.mostActiveType === 'code_review') {
    insights.push('Code review is the most active area');
  }

  return insights;
}

/**
 * Compare user activity
 */
export function compareUserActivity(
  userId1: string,
  userId2: string,
  activities: Activity[]
  ): {
  user1Score: number;
  user2Score: number;
  user1Activities: number;
  user2Activities: number;
  winner: string;
  difference: number;
} {
  const user1Activities = activities.filter((a) => a.actorId === userId1);
  const user2Activities = activities.filter((a) => a.actorId === userId2);

  const user1Score = calculateActivityScore(userId1, activities);
  const user2Score = calculateActivityScore(userId2, activities);

  let winner: string;
  if (user1Score.score > user2Score.score) {
    winner = userId1;
  } else if (user2Score.score > user1Score.score) {
    winner = userId2;
  } else {
    winner = 'tie';
  }

  const difference = Math.abs(user1Score.score - user2Score.score);

  return {
    user1Score: user1Score.score,
    user2Score: user2Score.score,
    user1Activities: user1Activities.length,
    user2Activities: user2Activities.length,
    winner,
    difference,
  };
}

/**
 * Predict future activity
 */
export function predictActivity(
  activities: Activity[],
  forecastDays: number = 7
  ): Map<string, number> {
  const trends = getActivityTrends(activities, 30);
  const dailyAvg =
    activities.length / 30; // Average activities per day over last 30 days

  const predictions = new Map<string, number>();
  const now = Date.now();
  const dayMs = 86400000;

  let baseActivity = dailyAvg;

  for (let i = 1; i <= forecastDays; i++) {
    const date = new Date(now + i * dayMs);
    const dateKey = date.toISOString().split('T')[0];

    // Apply growth rate
    if (trends.trend === 'increasing') {
      baseActivity *= 1 + (trends.growthRate / 100) / 7;
    } else if (trends.trend === 'decreasing') {
      baseActivity *= 1 - (Math.abs(trends.growthRate) / 100) / 7;
    }

    predictions.set(dateKey, Math.round(baseActivity));
  }

  return predictions;
}

/**
 * Get activity velocity
 */
export function getActivityVelocity(
  activities: Activity[],
  windowDays: number = 7
  ): {
  currentVelocity: number;
  previousVelocity: number;
  change: number;
  changePercent: number;
} {
  const now = Date.now();
  const windowMs = windowDays * 86400000;

  const currentWindowStart = now - windowMs;
  const previousWindowStart = currentWindowStart - windowMs;
  const previousWindowEnd = currentWindowStart;

  const currentActivities = activities.filter(
    (a) => a.timestamp >= currentWindowStart
  );

  const previousActivities = activities.filter(
    (a) => a.timestamp >= previousWindowStart && a.timestamp < previousWindowEnd
  );

  const currentVelocity = currentActivities.length / windowDays;
  const previousVelocity = previousActivities.length / windowDays;

  const change = currentVelocity - previousVelocity;
  const changePercent =
    previousVelocity > 0 ? (change / previousVelocity) * 100 : 0;

  return {
    currentVelocity: Math.round(currentVelocity * 10) / 10,
    previousVelocity: Math.round(previousVelocity * 10) / 10,
    change: Math.round(change * 10) / 10,
    changePercent: Math.round(changePercent),
  };
}
