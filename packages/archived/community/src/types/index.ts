/**
 * Community Platform Types
 * Defines all types for forums, Q&A, gallery, users, moderation, notifications, and events
 */

// ==========================================
// Base Types
// ==========================================

export interface BaseModel {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface Timestamps {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface PaginationMeta {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ==========================================
// User Types
// ==========================================

export interface User extends BaseModel {
  username: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  website?: string;
  github_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
  reputation: number;
  role: UserRole;
  badges: Badge[];
  stats: UserStats;
  preferences: UserPreferences;
  is_verified: boolean;
  is_banned: boolean;
  ban_reason?: string;
  ban_until?: Date;
  last_active_at: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  TRUSTED = 'trusted',
  MEMBER = 'member',
  RESTRICTED = 'restricted'
}

export interface UserStats {
  posts_count: number;
  questions_count: number;
  answers_count: number;
  comments_count: number;
  upvotes_received: number;
  downvotes_received: number;
  best_answers: number;
  solutions_provided: number;
  code_shared: number;
  reputation_gained: number;
}

export interface UserPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  weekly_digest: boolean;
  mention_notifications: boolean;
  reply_notifications: boolean;
  badge_notifications: boolean;
  privacy_show_profile: boolean;
  privacy_show_activity: boolean;
  privacy_show_email: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
}

export interface UserPublicProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  website?: string;
  reputation: number;
  role: UserRole;
  badges: Badge[];
  stats: UserStats;
  joined_at: Date;
  last_active_at: Date;
  is_verified: boolean;
}

// ==========================================
// Badge Types
// ==========================================

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url?: string;
  category: BadgeCategory;
  level: BadgeLevel;
  requirement: BadgeRequirement;
  earned_at?: Date;
  progress?: number;
  target?: number;
}

export enum BadgeCategory {
  PARTICIPATION = 'participation',
  CONTRIBUTION = 'contribution',
  QUALITY = 'quality',
  COMMUNITY = 'community',
  EXPERTISE = 'expertise',
  SPECIAL = 'special'
}

export enum BadgeLevel {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond'
}

export interface BadgeRequirement {
  type: 'posts' | 'reputation' | 'upvotes' | 'answers' | 'best_answers' | 'days_active' | 'custom';
  target: number;
  description: string;
}

// ==========================================
// Forum Types
// ==========================================

export interface ForumCategory extends BaseModel {
  name: string;
  slug: string;
  description: string;
  icon?: string;
  color?: string;
  parent_id?: string;
  order: number;
  thread_count: number;
  post_count: number;
  last_post?: ForumPost;
  is_locked: boolean;
  permissions: CategoryPermissions;
  tags: string[];
}

export interface CategoryPermissions {
  read: UserRole[];
  write: UserRole[];
  moderate: UserRole[];
}

export interface ForumThread extends BaseModel {
  title: string;
  slug: string;
  content: string;
  author_id: string;
  author?: UserPublicProfile;
  category_id: string;
  category?: ForumCategory;
  tags: string[];
  is_pinned: boolean;
  is_locked: boolean;
  is_featured: boolean;
  view_count: number;
  like_count: number;
  reply_count: number;
  last_reply_at?: Date;
  last_reply_by?: string;
  status: ThreadStatus;
  reactions: ThreadReaction[];
}

export enum ThreadStatus {
  OPEN = 'open',
  LOCKED = 'locked',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
  HIDDEN = 'hidden'
}

export interface ForumPost extends BaseModel {
  thread_id: string;
  content: string;
  author_id: string;
  author?: UserPublicProfile;
  parent_id?: string;
  is_first_post: boolean;
  is_answer?: boolean;
  like_count: number;
  dislike_count: number;
  reactions: PostReaction[];
  edits: PostEdit[];
  is_edited: boolean;
  edited_at?: Date;
  edited_reason?: string;
}

export interface ThreadReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface PostReaction {
  emoji: string;
  user_id: string;
  created_at: Date;
}

export interface PostEdit {
  edited_at: Date;
  edited_by: string;
  reason?: string;
}

export interface ThreadView {
  thread_id: string;
  user_id?: string;
  viewed_at: Date;
  ip_address?: string;
}

// ==========================================
// Q&A Types
// ==========================================

export interface Question extends BaseModel {
  title: string;
  slug: string;
  body: string;
  author_id: string;
  author?: UserPublicProfile;
  tags: string[];
  category?: string;
  view_count: number;
  vote_count: number;
  answer_count: number;
  favorite_count: number;
  status: QuestionStatus;
  accepted_answer_id?: string;
  accepted_answer?: Answer;
  bounty?: Bounty;
  duplicates: string[];
  related_questions: string[];
  last_activity_at: Date;
  is_featured: boolean;
}

export enum QuestionStatus {
  OPEN = 'open',
  ANSWERED = 'answered',
  CLOSED = 'closed',
  DUPLICATE = 'duplicate',
  DELETED = 'deleted'
}

export interface Answer extends BaseModel {
  question_id: string;
  body: string;
  author_id: string;
  author?: UserPublicProfile;
  is_accepted: boolean;
  vote_count: number;
  comment_count: number;
  edits: number;
  edited_at?: Date;
}

export interface Comment extends BaseModel {
  parent_type: 'question' | 'answer';
  parent_id: string;
  content: string;
  author_id: string;
  author?: UserPublicProfile;
  vote_count: number;
  edits: number;
  edited_at?: Date;
}

export interface Vote {
  id: string;
  user_id: string;
  target_type: 'question' | 'answer' | 'comment';
  target_id: string;
  vote_type: 'upvote' | 'downvote';
  created_at: Date;
}

export interface Bounty {
  amount: number;
  expires_at: Date;
  awarded_to?: string;
  awarded_at?: Date;
}

export interface QuestionFavorite {
  question_id: string;
  user_id: string;
  created_at: Date;
}

export interface QuestionView {
  question_id: string;
  user_id?: string;
  viewed_at: Date;
}

// ==========================================
// Gallery Types
// ==========================================

export interface GalleryItem extends BaseModel {
  title: string;
  slug: string;
  description: string;
  type: GalleryItemType;
  author_id: string;
  author?: UserPublicProfile;
  content: string;
  language?: string;
  framework?: string;
  tags: string[];
  category: string;
  is_featured: boolean;
  is_approved: boolean;
  view_count: number;
  fork_count: number;
  like_count: number;
  download_count: number;
  rating_average: number;
  rating_count: number;
  dependencies?: string[];
  screenshots?: string[];
  demo_url?: string;
  repository_url?: string;
  documentation_url?: string;
  license: string;
  version: string;
  parent_id?: string;
  original_author_id?: string;
}

export enum GalleryItemType {
  SNIPPET = 'snippet',
  TEMPLATE = 'template',
  AGENT = 'agent',
  PLUGIN = 'plugin',
  WORKFLOW = 'workflow',
  EXAMPLE = 'example'
}

export interface GalleryRating {
  item_id: string;
  user_id: string;
  rating: number;
  review?: string;
  created_at: Date;
  updated_at: Date;
}

export interface GalleryFork {
  id: string;
  parent_id: string;
  child_id: string;
  forked_at: Date;
}

export interface GalleryReport {
  id: string;
  item_id: string;
  reporter_id: string;
  reason: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: Date;
  resolved_at?: Date;
  resolution_notes?: string;
}

// ==========================================
// Reputation Types
// ==========================================

export interface ReputationEvent {
  id: string;
  user_id: string;
  amount: number;
  reason: ReputationReason;
  source_type: ReputationSourceType;
  source_id: string;
  created_at: Date;
  expires_at?: Date;
}

export enum ReputationReason {
  POST_CREATED = 'post_created',
  POST_UPVOTED = 'post_upvoted',
  POST_DOWNVOTED = 'post_downvoted',
  ANSWER_ACCEPTED = 'answer_accepted',
  ANSWER_UPVOTED = 'answer_upvoted',
  QUESTION_UPVOTED = 'question_upvoted',
  COMMENT_UPVOTED = 'comment_upvoted',
  RECEIVING_BADGE = 'receiving_badge',
  COMMUNITY_EDIT = 'community_edit',
  BOUNTY_EARNED = 'bounty_earned',
  GALLERY_SHARED = 'gallery_shared',
  GALLERY_FORKED = 'gallery_forked',
  GALLERY_RATED = 'gallery_rated',
  EVENT_PARTICIPATED = 'event_participated',
  REFERRAL = 'referral',
  BONUS = 'bonus',
  PENALTY = 'penalty'
}

export enum ReputationSourceType {
  FORUM_POST = 'forum_post',
  QUESTION = 'question',
  ANSWER = 'answer',
  COMMENT = 'comment',
  BADGE = 'badge',
  BOUNTY = 'bounty',
  GALLERY = 'gallery',
  EVENT = 'event',
  ADMIN = 'admin'
}

export interface ReputationLevel {
  level: number;
  name: string;
  min_reputation: number;
  privileges: string[];
  icon?: string;
}

// ==========================================
// Moderation Types
// ==========================================

export interface Report extends BaseModel {
  reporter_id: string;
  reporter?: UserPublicProfile;
  target_type: 'thread' | 'post' | 'question' | 'answer' | 'comment' | 'gallery_item' | 'user';
  target_id: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  assigned_to?: string;
  assigned_moderator?: UserPublicProfile;
  resolution_notes?: string;
  resolved_at?: Date;
  priority: ReportPriority;
  evidence?: string[];
}

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  INAPPROPRIATE = 'inappropriate',
  COPYRIGHT = 'copyright',
  MISINFORMATION = 'misinformation',
  OFF_TOPIC = 'off_topic',
  DUPLICATE = 'duplicate',
  QUALITY = 'quality',
  OTHER = 'other'
}

export enum ReportStatus {
  PENDING = 'pending',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
  ESCALATED = 'escalated'
}

export enum ReportPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface ModerationAction extends BaseModel {
  target_user_id?: string;
  target_type: 'user' | 'content';
  target_id: string;
  action_type: ModerationActionType;
  reason: string;
  performed_by: string;
  performed_by_user?: UserPublicProfile;
  duration?: number;
  permanent: boolean;
  expires_at?: Date;
  notes?: string;
}

export enum ModerationActionType {
  WARN = 'warn',
  MUTE = 'mute',
  SUSPEND = 'suspend',
  BAN = 'ban',
  CONTENT_REMOVE = 'content_remove',
  CONTENT_HIDE = 'content_hide',
  CONTENT_LOCK = 'content_lock',
  CONTENT_FEATURE = 'content_feature',
  USER_VERIFICATION = 'user_verification',
  USER_UNVERIFY = 'user_unverify',
  ROLE_CHANGE = 'role_change'
}

export interface ModerationLog {
  id: string;
  action: string;
  moderator_id: string;
  target_type: string;
  target_id: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface AutoModerationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: ModerationCondition[];
  actions: ModerationRuleAction[];
  priority: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export interface ModerationCondition {
  type: 'keyword' | 'spam_score' | 'new_user' | 'link_count' | 'repeat_poster' | 'custom';
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'regex' | 'in';
  value: any;
}

export interface ModerationRuleAction {
  type: 'flag' | 'hide' | 'approve' | 'notify' | 'ban' | 'rate_limit';
  parameters?: Record<string, any>;
}

export interface SpamDetection {
  id: string;
  content_type: string;
  content_id: string;
  score: number;
  is_spam: boolean;
  confidence: number;
  reasons: string[];
  detected_at: Date;
  reviewed: boolean;
  reviewed_by?: string;
  reviewed_at?: Date;
}

// ==========================================
// Notification Types
// ==========================================

export interface Notification extends BaseModel {
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  read: boolean;
  read_at?: Date;
  clicked: boolean;
  clicked_at?: Date;
  action_url?: string;
  source_type: NotificationSourceType;
  source_id: string;
  source_user_id?: string;
  source_user?: UserPublicProfile;
}

export enum NotificationType {
  FORUM_REPLY = 'forum_reply',
  FORUM_MENTION = 'forum_mention',
  FORUM_LIKE = 'forum_like',
  QUESTION_ANSWERED = 'question_answered',
  ANSWER_ACCEPTED = 'answer_accepted',
  ANSWER_UPVOTED = 'answer_upvoted',
  QUESTION_UPVOTED = 'question_upvoted',
  COMMENT_REPLY = 'comment_reply',
  BADGE_EARNED = 'badge_earned',
  REPUTATION_CHANGE = 'reputation_change',
  MODERATION_NOTICE = 'moderation_notice',
  GALLERY_COMMENT = 'gallery_comment',
  GALLERY_FORK = 'gallery_fork',
  GALLERY_RATED = 'gallery_rated',
  EVENT_REMINDER = 'event_reminder',
  EVENT_STARTING = 'event_starting',
  SYSTEM_ANNOUNCEMENT = 'system_announcement'
}

export enum NotificationSourceType {
  FORUM_POST = 'forum_post',
  QUESTION = 'question',
  ANSWER = 'answer',
  COMMENT = 'comment',
  BADGE = 'badge',
  GALLERY = 'gallery',
  EVENT = 'event',
  USER = 'user',
  SYSTEM = 'system'
}

export interface NotificationData {
  [key: string]: any;
}

export interface NotificationPreference {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  types: NotificationTypePreference[];
}

export interface NotificationTypePreference {
  type: NotificationType;
  email: boolean;
  push: boolean;
  in_app: boolean;
}

export interface NotificationDigest {
  id: string;
  user_id: string;
  type: 'daily' | 'weekly';
  notifications: NotificationSummary[];
  generated_at: Date;
  sent_at?: Date;
}

export interface NotificationSummary {
  type: NotificationType;
  count: number;
  latest_notification: Notification;
}

// ==========================================
// Event Types
// ==========================================

export interface CommunityEvent extends BaseModel {
  title: string;
  slug: string;
  description: string;
  type: EventType;
  host_id: string;
  host?: UserPublicProfile;
  start_time: Date;
  end_time: Date;
  timezone: string;
  location?: string;
  is_virtual: boolean;
  meeting_url?: string;
  max_attendees?: number;
  current_attendees: number;
  status: EventStatus;
  cover_image?: string;
  tags: string[];
  agenda?: EventAgendaItem[];
  requirements?: string[];
  is_featured: boolean;
  registration_deadline?: Date;
}

export enum EventType {
  WEBINAR = 'webinar',
  WORKSHOP = 'workshop',
  AMA = 'ama',
  HACKATHON = 'hackathon',
  MEETUP = 'meetup',
  OFFICE_HOURS = 'office_hours',
  CONFERENCE = 'conference',
  CHALLENGE = 'challenge'
}

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  REGISTRATION_OPEN = 'registration_open',
  REGISTRATION_CLOSED = 'registration_closed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface EventAgendaItem {
  time: string;
  title: string;
  description?: string;
  speaker?: string;
  duration: number;
}

export interface EventRegistration extends BaseModel {
  event_id: string;
  event?: CommunityEvent;
  user_id: string;
  user?: UserPublicProfile;
  status: RegistrationStatus;
  registered_at: Date;
  reminder_sent: boolean;
  attended: boolean;
  attended_at?: Date;
  feedback?: EventFeedback;
}

export enum RegistrationStatus {
  REGISTERED = 'registered',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  WAITLIST = 'waitlist'
}

export interface EventFeedback {
  rating: number;
  comments?: string;
  submitted_at: Date;
}

export interface EventReminder {
  event_id: string;
  user_id: string;
  remind_before: number; // minutes before event
  sent: boolean;
  sent_at?: Date;
}

// ==========================================
// Search Types
// ==========================================

export interface SearchQuery {
  query: string;
  type?: SearchType;
  category?: string;
  tags?: string[];
  author?: string;
  sort?: SearchSort;
  date_range?: DateRange;
  page?: number;
  per_page?: number;
}

export enum SearchType {
  ALL = 'all',
  THREADS = 'threads',
  QUESTIONS = 'questions',
  ANSWERS = 'answers',
  GALLERY = 'gallery',
  USERS = 'users'
}

export enum SearchSort {
  RELEVANCE = 'relevance',
  LATEST = 'latest',
  POPULAR = 'popular',
  MOST_VIEWED = 'most_viewed',
  MOST_LIKED = 'most_liked',
  MOST_ANSWERED = 'most_answered'
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface SearchResult<T> {
  type: SearchType;
  id: string;
  title: string;
  excerpt?: string;
  content?: string;
  author?: UserPublicProfile;
  score: number;
  highlights?: string[];
  data: T;
}

export interface SearchResponse<T> {
  results: SearchResult<T>[];
  total: number;
  page: number;
  per_page: number;
  facets?: SearchFacets;
}

export interface SearchFacets {
  types: { [key in SearchType]?: number };
  tags: { [tag: string]: number };
  authors: { [author: string]: number };
  categories: { [category: string]: number };
}

// ==========================================
// Analytics Types
// ==========================================

export interface CommunityStats {
  total_users: number;
  active_users: number;
  total_threads: number;
  total_posts: number;
  total_questions: number;
  total_answers: number;
  total_gallery_items: number;
  total_events: number;
  new_users_today: number;
  new_users_week: number;
  new_users_month: number;
  active_threads_today: number;
  questions_answered: number;
  average_response_time: number;
  top_contributors: UserPublicProfile[];
  popular_tags: string[];
  trending_topics: string[];
}

export interface UserActivity {
  user_id: string;
  date: Date;
  actions: ActivityAction[];
  total_actions: number;
}

export interface ActivityAction {
  type: string;
  count: number;
  details: any;
}

// ==========================================
// API Response Types
// ==========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

export interface ResponseMeta {
  timestamp: Date;
  request_id: string;
  version: string;
}
