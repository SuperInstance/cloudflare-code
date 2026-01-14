/**
 * Helper utilities for Community Platform
 */

import {
  User,
  ForumThread,
  Question,
  GalleryItem,
  Notification,
  NotificationType,
  ReputationReason,
  Badge,
  BadgeCategory,
  BadgeLevel,
  Report,
  ReportReason,
  ReportPriority
} from '../types';

// ==========================================
// Validation Utilities
// ==========================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (username.length > 30) {
    errors.push('Username must be no more than 30 characters long');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, hyphens, and underscores');
  }

  if (/^[0-9_-]/.test(username)) {
    errors.push('Username must start with a letter');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateContent(content: string, minLength: number = 10): ValidationResult {
  const errors: string[] = [];

  if (content.trim().length < minLength) {
    errors.push(`Content must be at least ${minLength} characters long`);
  }

  if (content.length > 50000) {
    errors.push('Content is too long (max 50,000 characters)');
  }

  // Check for excessive whitespace
  if (/\s{10,}/.test(content)) {
    errors.push('Content contains excessive whitespace');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ==========================================
// Text Processing Utilities
// ==========================================

export function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w{3,30})/g;
  const mentions = new Set<string>();
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.add(match[1]);
  }

  return Array.from(mentions);
}

export function extractTags(content: string): string[] {
  const tagRegex = /#(\w{2,30})/g;
  const tags = new Set<string>();
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }

  return Array.from(tags);
}

export function extractUrls(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  return content.match(urlRegex) || [];
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, '')
    .replace(/~~/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

export function extractExcerpt(content: string, maxLength: number = 200): string {
  const stripped = stripMarkdown(content);
  return truncateText(stripped, maxLength);
}

// ==========================================
// Formatting Utilities
// ==========================================

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function formatReputation(reputation: number): string {
  return formatNumber(reputation);
}

// ==========================================
// User Utilities
// ==========================================

export function getUserDisplayName(user: User | { username: string; display_name?: string }): string {
  return user.display_name || user.username;
}

export function getUserRoleLevel(role: string): number {
  const levels: Record<string, number> = {
    admin: 5,
    moderator: 4,
    trusted: 3,
    member: 2,
    restricted: 1
  };
  return levels[role] || 0;
}

export function canModerate(user: User | { role: string }): boolean {
  return ['admin', 'moderator'].includes(user.role);
}

export function canEditContent(user: User, contentAuthorId: string): boolean {
  return user.id === contentAuthorId || canModerate(user);
}

export function isUserBanned(user: User): boolean {
  if (!user.is_banned) return false;
  if (user.ban_until) {
    return new Date(user.ban_until) > new Date();
  }
  return true;
}

// ==========================================
// Content Utilities
// ==========================================

export function calculateReadTime(content: string, wordsPerMinute: number = 200): number {
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export function extractCodeBlocks(content: string): string[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push(match[2]);
  }

  return blocks;
}

export function hasCode(content: string): boolean {
  return /```[\s\S]*?```/.test(content) || /`[^`]+`/.test(content);
}

export function detectLanguage(content: string): string | null {
  const langRegex = /```(\w+)\n/;
  const match = langRegex.exec(content);
  return match ? match[1] : null;
}

// ==========================================
// Spam Detection Utilities
// ==========================================

export interface SpamScore {
  score: number;
  isSpam: boolean;
  reasons: string[];
}

export function calculateSpamScore(content: string, user?: Partial<User>): SpamScore {
  let score = 0;
  const reasons: string[] = [];

  // Check for excessive links
  const urls = extractUrls(content);
  if (urls.length > 5) {
    score += 30;
    reasons.push('Too many links');
  }

  // Check for excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (capsRatio > 0.5) {
    score += 20;
    reasons.push('Excessive capitalization');
  }

  // Check for repetitive content
  const words = content.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 10 && uniqueWords.size / words.length < 0.3) {
    score += 25;
    reasons.push('Repetitive content');
  }

  // Check for spam keywords
  const spamKeywords = [
    'buy now', 'click here', 'free money', 'winner', 'congratulations',
    'viagra', 'casino', 'poker', 'lottery', 'make money fast'
  ];
  const lowerContent = content.toLowerCase();
  for (const keyword of spamKeywords) {
    if (lowerContent.includes(keyword)) {
      score += 15;
      reasons.push(`Contains spam keyword: ${keyword}`);
    }
  }

  // Check user account age
  if (user?.created_at) {
    const accountAge = Date.now() - new Date(user.created_at).getTime();
    const daysOld = accountAge / (1000 * 60 * 60 * 24);
    if (daysOld < 1) {
      score += 10;
      reasons.push('New account');
    }
  }

  return {
    score: Math.min(100, score),
    isSpam: score >= 50,
    reasons
  };
}

// ==========================================
// Reputation Utilities
// ==========================================

export const REPUTATION_RULES: Record<ReputationReason, number> = {
  post_created: 5,
  post_upvoted: 10,
  post_downvoted: -2,
  answer_accepted: 25,
  answer_upvoted: 15,
  question_upvoted: 10,
  comment_upvoted: 5,
  receiving_badge: 50,
  community_edit: 2,
  bounty_earned: 0, // Variable amount
  gallery_shared: 10,
  gallery_forked: 5,
  gallery_rated: 2,
  event_participated: 20,
  referral: 100,
  bonus: 0, // Variable amount
  penalty: 0  // Variable amount
};

export function calculateReputationChange(reason: ReputationReason, amount?: number): number {
  if (amount !== undefined) return amount;
  return REPUTATION_RULES[reason] || 0;
}

export function getReputationLevel(reputation: number): string {
  if (reputation >= 10000) return 'Legendary';
  if (reputation >= 5000) return 'Epic';
  if (reputation >= 2000) return 'Rare';
  if (reputation >= 1000) return 'Exceptional';
  if (reputation >= 500) return 'Notable';
  if (reputation >= 200) return 'Noteworthy';
  if (reputation >= 100) return 'Established';
  if (reputation >= 50) return 'Contributor';
  if (reputation >= 10) return 'Participant';
  return 'Newcomer';
}

// ==========================================
// Badge Utilities
// ==========================================

export const BADGE_DEFINITIONS: Omit<Badge, 'id' | 'earned_at' | 'progress' | 'target'>[] = [
  // Participation badges
  {
    name: 'Welcome Aboard',
    description: 'Created your first post',
    icon_url: '/badges/welcome.svg',
    category: BadgeCategory.PARTICIPATION,
    level: BadgeLevel.BRONZE,
    requirement: { type: 'posts', target: 1, description: 'Create 1 post' }
  },
  {
    name: 'Conversation Starter',
    description: 'Created 10 posts',
    icon_url: '/badges/conversation.svg',
    category: BadgeCategory.PARTICIPATION,
    level: BadgeLevel.BRONZE,
    requirement: { type: 'posts', target: 10, description: 'Create 10 posts' }
  },
  {
    name: 'Discourse Master',
    description: 'Created 100 posts',
    icon_url: '/badges/discourse.svg',
    category: BadgeCategory.PARTICIPATION,
    level: BadgeLevel.SILVER,
    requirement: { type: 'posts', target: 100, description: 'Create 100 posts' }
  },
  {
    name: 'Prolific Writer',
    description: 'Created 1000 posts',
    icon_url: '/badges/writer.svg',
    category: BadgeCategory.PARTICIPATION,
    level: BadgeLevel.GOLD,
    requirement: { type: 'posts', target: 1000, description: 'Create 1000 posts' }
  },

  // Contribution badges
  {
    name: 'Curious',
    description: 'Asked your first question',
    icon_url: '/badges/curious.svg',
    category: BadgeCategory.CONTRIBUTION,
    level: BadgeLevel.BRONZE,
    requirement: { type: 'questions', target: 1, description: 'Ask 1 question' }
  },
  {
    name: 'Questioner',
    description: 'Asked 10 questions',
    icon_url: '/badges/questioner.svg',
    category: BadgeCategory.CONTRIBUTION,
    level: BadgeLevel.BRONZE,
    requirement: { type: 'questions', target: 10, description: 'Ask 10 questions' }
  },
  {
    name: 'Helper',
    description: 'Provided your first answer',
    icon_url: '/badges/helper.svg',
    category: BadgeCategory.CONTRIBUTION,
    level: BadgeLevel.BRONZE,
    requirement: { type: 'answers', target: 1, description: 'Provide 1 answer' }
  },
  {
    name: 'Problem Solver',
    description: 'Provided 10 answers',
    icon_url: '/badges/solver.svg',
    category: BadgeCategory.CONTRIBUTION,
    level: BadgeLevel.BRONZE,
    requirement: { type: 'answers', target: 10, description: 'Provide 10 answers' }
  },
  {
    name: 'Expert',
    description: 'Provided 100 answers',
    icon_url: '/badges/expert.svg',
    category: BadgeCategory.CONTRIBUTION,
    level: BadgeLevel.SILVER,
    requirement: { type: 'answers', target: 100, description: 'Provide 100 answers' }
  },
  {
    name: 'Solution Provider',
    description: 'Had 10 accepted answers',
    icon_url: '/badges/solution.svg',
    category: BadgeCategory.CONTRIBUTION,
    level: BadgeLevel.SILVER,
    requirement: { type: 'best_answers', target: 10, description: 'Have 10 accepted answers' }
  },

  // Quality badges
  {
    name: 'Good Question',
    description: 'Question received 10 upvotes',
    icon_url: '/badges/good-question.svg',
    category: BadgeCategory.QUALITY,
    level: BadgeLevel.BRONZE,
    requirement: { type: 'upvotes', target: 10, description: 'Get 10 upvotes on a question' }
  },
  {
    name: 'Great Question',
    description: 'Question received 50 upvotes',
    icon_url: '/badges/great-question.svg',
    category: BadgeCategory.QUALITY,
    level: BadgeLevel.SILVER,
    requirement: { type: 'upvotes', target: 50, description: 'Get 50 upvotes on a question' }
  },
  {
    name: 'Nice Answer',
    description: 'Answer received 10 upvotes',
    icon_url: '/badges/nice-answer.svg',
    category: BadgeCategory.QUALITY,
    level: BadgeLevel.BRONZE,
    requirement: { type: 'upvotes', target: 10, description: 'Get 10 upvotes on an answer' }
  },
  {
    name: 'Good Answer',
    description: 'Answer received 25 upvotes',
    icon_url: '/badges/good-answer.svg',
    category: BadgeCategory.QUALITY,
    level: BadgeLevel.SILVER,
    requirement: { type: 'upvotes', target: 25, description: 'Get 25 upvotes on an answer' }
  },
  {
    name: 'Guru',
    description: 'Answer received 100 upvotes',
    icon_url: '/badges/guru.svg',
    category: BadgeCategory.QUALITY,
    level: BadgeLevel.GOLD,
    requirement: { type: 'upvotes', target: 100, description: 'Get 100 upvotes on an answer' }
  },

  // Reputation badges
  {
    name: 'Rising Star',
    description: 'Reached 100 reputation',
    icon_url: '/badges/rising-star.svg',
    category: BadgeCategory.COMMUNITY,
    level: BadgeLevel.BRONZE,
    requirement: { type: 'reputation', target: 100, description: 'Reach 100 reputation' }
  },
  {
    name: 'Trusted',
    description: 'Reached 500 reputation',
    icon_url: '/badges/trusted.svg',
    category: BadgeCategory.COMMUNITY,
    level: BadgeLevel.SILVER,
    requirement: { type: 'reputation', target: 500, description: 'Reach 500 reputation' }
  },
  {
    name: 'Notable',
    description: 'Reached 1000 reputation',
    icon_url: '/badges/notable.svg',
    category: BadgeCategory.COMMUNITY,
    level: BadgeLevel.SILVER,
    requirement: { type: 'reputation', target: 1000, description: 'Reach 1000 reputation' }
  },
  {
    name: 'Outstanding',
    description: 'Reached 5000 reputation',
    icon_url: '/badges/outstanding.svg',
    category: BadgeCategory.COMMUNITY,
    level: BadgeLevel.GOLD,
    requirement: { type: 'reputation', target: 5000, description: 'Reach 5000 reputation' }
  },
  {
    name: 'Legendary',
    description: 'Reached 10000 reputation',
    icon_url: '/badges/legendary.svg',
    category: BadgeCategory.COMMUNITY,
    level: BadgeLevel.PLATINUM,
    requirement: { type: 'reputation', target: 10000, description: 'Reach 10000 reputation' }
  },

  // Special badges
  {
    name: 'Early Adopter',
    description: 'Joined in the first month',
    icon_url: '/badges/early-adopter.svg',
    category: BadgeCategory.SPECIAL,
    level: BadgeLevel.GOLD,
    requirement: { type: 'custom', target: 1, description: 'Joined in first month' }
  },
  {
    name: 'Beta Tester',
    description: 'Participated in beta testing',
    icon_url: '/badges/beta-tester.svg',
    category: BadgeCategory.SPECIAL,
    level: BadgeLevel.SILVER,
    requirement: { type: 'custom', target: 1, description: 'Participated in beta' }
  },
  {
    name: 'Community Leader',
    description: 'Elected as community leader',
    icon_url: '/badges/leader.svg',
    category: BadgeCategory.SPECIAL,
    level: BadgeLevel.PLATINUM,
    requirement: { type: 'custom', target: 1, description: 'Become community leader' }
  },
  {
    name: 'Mentor',
    description: 'Mentored 10 new users',
    icon_url: '/badges/mentor.svg',
    category: BadgeCategory.SPECIAL,
    level: BadgeLevel.GOLD,
    requirement: { type: 'custom', target: 10, description: 'Mentor 10 users' }
  }
];

export function getBadgeProgress(badge: Omit<Badge, 'id' | 'earned_at'>, user: User): number {
  const { requirement } = badge;
  let current = 0;

  switch (requirement.type) {
    case 'posts':
      current = user.stats.posts_count;
      break;
    case 'questions':
      current = user.stats.questions_count;
      break;
    case 'answers':
      current = user.stats.answers_count;
      break;
    case 'best_answers':
      current = user.stats.best_answers;
      break;
    case 'upvotes':
      current = user.stats.upvotes_received;
      break;
    case 'reputation':
      current = user.reputation;
      break;
    default:
      current = 0;
  }

  return Math.min(100, Math.floor((current / requirement.target) * 100));
}

export function checkBadgeEligibility(user: User): Badge[] {
  const eligibleBadges: Badge[] = [];

  for (const badgeDef of BADGE_DEFINITIONS) {
    // Skip if user already has this badge
    if (user.badges.some(b => b.name === badgeDef.name)) {
      continue;
    }

    const progress = getBadgeProgress(badgeDef, user);
    if (progress >= 100) {
      eligibleBadges.push({
        ...badgeDef,
        id: `badge-${Date.now()}-${badgeDef.name.toLowerCase().replace(/\s+/g, '-')}`,
        earned_at: new Date(),
        progress: 100,
        target: badgeDef.requirement.target
      });
    }
  }

  return eligibleBadges;
}

// ==========================================
// Report Utilities
// ==========================================

export function getReportPriority(reason: ReportReason): ReportPriority {
  const priorityMap: Record<ReportReason, ReportPriority> = {
    [ReportReason.SPAM]: ReportPriority.LOW,
    [ReportReason.HARASSMENT]: ReportPriority.HIGH,
    [ReportReason.INAPPROPRIATE]: ReportPriority.HIGH,
    [ReportReason.COPYRIGHT]: ReportPriority.MEDIUM,
    [ReportReason.MISINFORMATION]: ReportPriority.MEDIUM,
    [ReportReason.OFF_TOPIC]: ReportPriority.LOW,
    [ReportReason.DUPLICATE]: ReportPriority.LOW,
    [ReportReason.QUALITY]: ReportPriority.LOW,
    [ReportReason.OTHER]: ReportPriority.LOW
  };

  return priorityMap[reason] || ReportPriority.LOW;
}

export function shouldAutoModerate(report: Report): boolean {
  return report.priority === ReportPriority.URGENT || report.priority === ReportPriority.HIGH;
}

// ==========================================
// Notification Utilities
// ==========================================

export function createNotification(
  recipientId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: any,
  sourceType?: string,
  sourceId?: string,
  sourceUserId?: string
): Partial<Notification> {
  return {
    recipient_id: recipientId,
    type,
    title,
    body,
    data,
    read: false,
    clicked: false,
    action_url: data?.action_url,
    source_type: sourceType,
    source_id: sourceId,
    source_user_id: sourceUserId,
    created_at: new Date(),
    updated_at: new Date()
  };
}

export function groupNotificationsByType(notifications: Notification[]): Record<NotificationType, Notification[]> {
  const grouped: Record<string, Notification[]> = {};
  for (const notification of notifications) {
    if (!grouped[notification.type]) {
      grouped[notification.type] = [];
    }
    grouped[notification.type].push(notification);
  }
  return grouped as Record<NotificationType, Notification[]>;
}

// ==========================================
// Search Utilities
// ==========================================

export function highlightText(text: string, query: string): string {
  const regex = new RegExp(`(${query.split(/\s+/).join('|')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

export function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

// ==========================================
// Rate Limiting Utilities
// ==========================================

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number = 10,
    private windowMs: number = 60000 // 1 minute
  ) {}

  async check(identifier: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.requests.get(identifier) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      return false;
    }

    timestamps.push(now);
    this.requests.set(identifier, timestamps);
    return true;
  }

  async reset(identifier: string): Promise<void> {
    this.requests.delete(identifier);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(t => t > windowStart);
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }
}

// ==========================================
// Color Utilities
// ==========================================

export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

export function generateGradient(): string {
  const colors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c',
    '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'
  ];

  const color1 = colors[Math.floor(Math.random() * colors.length)];
  const color2 = colors[Math.floor(Math.random() * colors.length)];

  return `linear-gradient(135deg, ${color1}, ${color2})`;
}
