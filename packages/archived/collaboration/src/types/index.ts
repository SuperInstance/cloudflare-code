/**
 * Collaboration type definitions
 * Defines all types used across collaboration features
 */

// ============================================================================
// Core Types
// ============================================================================

export interface CollaborationSession {
  sessionId: string;
  documentId: string;
  projectId: string;
  userId: string;
  userName: string;
  userColor: string;
  userCursor?: CursorPosition;
  userSelection?: SelectionRange;
  status: UserStatus;
  role?: CollaborationRole;
  lastActivityAt: number;
  permissions: SessionPermissions;
}

export type UserStatus = 'online' | 'idle' | 'offline' | 'away';
export type CollaborationRole = 'owner' | 'editor' | 'viewer' | 'commenter';

export interface SessionPermissions {
  canEdit: boolean;
  canComment: boolean;
  canView: boolean;
  canShare: boolean;
  canDelete: boolean;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface PresenceUpdate {
  sessionId: string;
  userId: string;
  status: UserStatus;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  activeFile?: string;
  timestamp: number;
}

export interface PresenceState {
  documentId: string;
  users: Map<string, CollaborationSession>;
  cursors: Map<string, CursorPosition>;
  selections: Map<string, SelectionRange>;
  lastUpdate: number;
}

// ============================================================================
// CRDT Types
// ============================================================================

export interface CRDTDocument {
  id: string;
  type: CRDTType;
  version: number;
  state: Uint8Array;
  created: number;
  modified: number;
  metadata: DocumentMetadata;
}

export type CRDTType = 'text' | 'array' | 'map' | 'xml' | 'json';

export interface DocumentMetadata {
  title: string;
  language: string;
  path: string;
  projectId: string;
  creatorId: string;
  tags: string[];
  isPublic: boolean;
}

export interface CRDTOperation {
  opId: string;
  documentId: string;
  userId: string;
  type: OperationType;
  content: string;
  position?: number;
  length?: number;
  attributes?: Record<string, unknown>;
  timestamp: number;
  vector: number[];
}

export type OperationType = 'insert' | 'delete' | 'format' | 'replace';

export interface CRDTState {
  document: CRDTDocument;
  operations: CRDTOperation[];
  vectors: Map<string, number[]>;
  pending: CRDTOperation[];
  lastSync: number;
}

// ============================================================================
// Pair Programming Types
// ============================================================================

export interface PairSession {
  sessionId: string;
  projectId: string;
  driver: PairParticipant;
  navigator: PairParticipant;
  status: PairSessionStatus;
  startedAt: number;
  endedAt?: number;
  settings: PairSessionSettings;
  statistics: PairStatistics;
}

export interface PairParticipant {
  userId: string;
  userName: string;
  role: PairRole;
  joinedAt: number;
  permissions: PairPermissions;
}

export type PairRole = 'driver' | 'navigator';
export type PairSessionStatus = 'active' | 'paused' | 'ended';

export interface PairPermissions {
  canWrite: boolean;
  canExecute: boolean;
  canShareTerminal: boolean;
  canVoiceChat: boolean;
  canVideoChat: boolean;
  canScreenShare: boolean;
}

export interface PairSessionSettings {
  allowVoiceChat: boolean;
  allowVideoChat: boolean;
  allowScreenShare: boolean;
  allowTerminalShare: boolean;
  autoSwitchInterval?: number;
  recordingEnabled: boolean;
}

export interface PairStatistics {
  duration: number;
  linesWritten: number;
  filesTouched: number;
  switchCount: number;
  commitsMade: number;
}

export interface RoleSwitchRequest {
  sessionId: string;
  requestedBy: string;
  requestedAt: number;
  reason?: string;
}

// ============================================================================
// Code Review Types
// ============================================================================

export interface Review {
  id: string;
  projectId: string;
  pullRequestId: string;
  title: string;
  description: string;
  authorId: string;
  reviewerIds: string[];
  status: ReviewStatus;
  priority: ReviewPriority;
  created: number;
  updated: number;
  dueDate?: number;
  settings: ReviewSettings;
  statistics: ReviewStatistics;
}

export type ReviewStatus = 'pending' | 'in_review' | 'changes_requested' | 'approved' | 'rejected';
export type ReviewPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ReviewSettings {
  requireAllApprovals: boolean;
  minApprovals: number;
  allowSelfApproval: boolean;
  dismissStaleReviews: boolean;
  staleReviewDays: number;
}

export interface ReviewStatistics {
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  commentsCount: number;
  resolutionsCount: number;
  timeToReview?: number;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  inReplyTo?: string;
  authorId: string;
  authorName: string;
  content: string;
  filePath: string;
  line?: number;
  type: CommentType;
  status: CommentStatus;
  created: number;
  updated: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
  reactions: CommentReaction[];
}

export type CommentType = 'general' | 'inline' | 'suggestion';
export type CommentStatus = 'active' | 'resolved' | 'outdated';

export interface CommentReaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface ReviewAssignment {
  reviewId: string;
  reviewerId: string;
  assignedBy: string;
  assignedAt: number;
  status: AssignmentStatus;
  completedAt?: number;
}

export type AssignmentStatus = 'pending' | 'accepted' | 'declined' | 'completed';

export interface SuggestedChange {
  commentId: string;
  originalContent: string;
  suggestedContent: string;
  filePath: string;
  startLine: number;
  endLine: number;
  applied: boolean;
  appliedBy?: string;
  appliedAt?: number;
}

// ============================================================================
// Knowledge Sharing Types
// ============================================================================

export interface KnowledgeArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  authorId: string;
  authorName: string;
  category: string;
  tags: string[];
  status: ArticleStatus;
  visibility: ArticleVisibility;
  created: number;
  updated: number;
  publishedAt?: number;
  views: number;
  likes: number;
  metadata: ArticleMetadata;
}

export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';
export type ArticleVisibility = 'public' | 'internal' | 'private';

export interface ArticleMetadata {
  readTime: number;
  difficulty: DifficultyLevel;
  language: string;
  relatedArticles: string[];
  attachments: ArticleAttachment[];
}

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface ArticleAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  authorId: string;
  tags: string[];
  created: number;
  updated: number;
  views: number;
  copies: number;
  upvotes: number;
  downvotes: number;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  parentCategoryId?: string;
  order: number;
  articleCount: number;
  created: number;
}

export interface BestPractice {
  id: string;
  title: string;
  description: string;
  category: string;
  rules: PracticeRule[];
  examples: PracticeExample[];
  antiPatterns: string[];
  references: string[];
  created: number;
  updated: number;
}

export interface PracticeRule {
  title: string;
  description: string;
  importance: 'critical' | 'important' | 'nice_to_have';
}

export interface PracticeExample {
  title: string;
  code: string;
  explanation: string;
  language: string;
}

// ============================================================================
// Team Management Types
// ============================================================================

export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar?: string;
  ownerId: string;
  settings: TeamSettings;
  permissions: TeamPermissions;
  memberCount: number;
  projectCount: number;
  created: number;
  updated: number;
}

export interface TeamSettings {
  allowPublicDiscovery: boolean;
  allowMemberInvite: boolean;
  requireApproval: boolean;
  defaultRole: TeamRole;
  maxMembers?: number;
  retentionDays: number;
}

export type TeamRole = 'owner' | 'admin' | 'moderator' | 'member' | 'guest';

export interface TeamPermissions {
  canCreateProjects: boolean;
  canDeleteProjects: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canManageSettings: boolean;
  canViewBilling: boolean;
}

export interface TeamMember {
  userId: string;
  userName: string;
  email: string;
  avatar?: string;
  role: TeamRole;
  joinedAt: number;
  status: MemberStatus;
  permissions: MemberPermissions;
  statistics: MemberStatistics;
}

export type MemberStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface MemberPermissions {
  canCreateProjects: boolean;
  canDeleteProjects: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canManageSettings: boolean;
}

export interface MemberStatistics {
  contributions: number;
  reviews: number;
  articles: number;
  lastActive: number;
}

export interface TeamInvite {
  inviteId: string;
  teamId: string;
  invitedBy: string;
  invitedEmail: string;
  role: TeamRole;
  status: InviteStatus;
  created: number;
  expires: number;
  acceptedAt?: number;
}

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface TeamProject {
  projectId: string;
  teamId: string;
  name: string;
  description: string;
  visibility: ProjectVisibility;
  memberCount: number;
  created: number;
  updated: number;
}

export type ProjectVisibility = 'public' | 'internal' | 'private';

export interface TeamHierarchy {
  teamId: string;
  parentTeamId?: string;
  childTeamIds: string[];
  level: number;
  path: string[];
}

// ============================================================================
// Activity Feed Types
// ============================================================================

export interface Activity {
  id: string;
  type: ActivityType;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  action: ActivityAction;
  target: ActivityTarget;
  metadata: ActivityMetadata;
  timestamp: number;
  visibility: ActivityVisibility;
}

export type ActivityType =
  | 'collaboration'
  | 'code_review'
  | 'knowledge'
  | 'team'
  | 'project'
  | 'user';

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'commented'
  | 'approved'
  | 'rejected'
  | 'assigned'
  | 'joined'
  | 'left'
  | 'mentioned';

export interface ActivityTarget {
  type: string;
  id: string;
  name: string;
  url?: string;
}

export interface ActivityMetadata {
  projectId?: string;
  teamId?: string;
  documentId?: string;
  reviewId?: string;
  additionalData?: Record<string, unknown>;
}

export type ActivityVisibility = 'public' | 'team' | 'private';

export interface Notification {
  id: string;
  userId: string;
  activityId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created: number;
  expires?: number;
  metadata: NotificationMetadata;
}

export type NotificationType =
  | 'mention'
  | 'comment'
  | 'review_assignment'
  | 'team_invite'
  | 'approval'
  | 'activity_digest';

export interface NotificationMetadata {
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  actionRequired: boolean;
  dismissible: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  digest: boolean;
  digestFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  categories: Record<string, boolean>;
}

export interface ActivityFilter {
  types?: ActivityType[];
  actions?: ActivityAction[];
  actors?: string[];
  projects?: string[];
  teams?: string[];
  startDate?: number;
  endDate?: number;
  search?: string;
}

export interface ActivityDigest {
  userId: string;
  period: DigestPeriod;
  startDate: number;
  endDate: number;
  activities: Activity[];
  summary: DigestSummary;
  generated: number;
}

export type DigestPeriod = 'hourly' | 'daily' | 'weekly';

export interface DigestSummary {
  totalActivities: number;
  byType: Record<ActivityType, number>;
  unreadCount: number;
  mentionCount: number;
}

// ============================================================================
// WebRTC Types
// ============================================================================

export interface WebRTCPeer {
  peerId: string;
  userId: string;
  userName: string;
  role: 'caller' | 'callee';
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  createdAt: number;
  lastActivity: number;
}

export interface WebRTCSession {
  sessionId: string;
  type: WebRTCSessionType;
  participants: Map<string, WebRTCPeer>;
  dataChannels: Map<string, RTCDataChannel>;
  localStream?: MediaStream;
  remoteStreams: Map<string, MediaStream>;
  started: number;
  ended?: number;
  metadata: WebRTCMetadata;
}

export type WebRTCSessionType = 'voice' | 'video' | 'screen' | 'terminal';

export interface WebRTCMetadata {
  recordingEnabled: boolean;
  recordingUrl?: string;
  quality: 'low' | 'medium' | 'high';
  bandwidthLimit?: number;
}

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  sessionId: string;
  senderId: string;
  receiverId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  timestamp: number;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  sessionId: string;
  userId: string;
  timestamp: number;
  payload: T;
}

export type WebSocketMessageType =
  | 'cursor_update'
  | 'selection_update'
  | 'text_operation'
  | 'presence_update'
  | 'user_joined'
  | 'user_left'
  | 'webrtc_signal'
  | 'role_switch'
  | 'terminal_data'
  | 'screen_share';

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

// ============================================================================
// Version Control Integration Types
// ============================================================================

export interface VCSCommit {
  hash: string;
  author: string;
  authorEmail: string;
  message: string;
  timestamp: number;
  files: string[];
  additions: number;
  deletions: number;
}

export interface VCSBranch {
  name: string;
  commit: string;
  author: string;
  isDefault: boolean;
  created: number;
}

export interface VCPullRequest {
  number: number;
  title: string;
  description: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  status: 'open' | 'closed' | 'merged';
  created: number;
  updated: number;
  mergeable?: boolean;
}

// ============================================================================
// Conflict Resolution Types
// ============================================================================

export interface Conflict {
  conflictId: string;
  documentId: string;
  type: ConflictType;
  operations: CRDTOperation[];
  detectedAt: number;
  resolved: boolean;
  resolution?: ConflictResolution;
}

export type ConflictType = 'concurrent_edit' | 'delete_conflict' | 'merge_conflict';

export interface ConflictResolution {
  strategy: ResolutionStrategy;
  resolvedBy: string;
  resolvedAt: number;
  resolvedOperations: CRDTOperation[];
  manualChanges?: string;
}

export type ResolutionStrategy =
  | 'last_write_wins'
  | 'operational_transform'
  | 'manual_merge'
  | 'keep_both';

// ============================================================================
// Analytics Types
// ============================================================================

export interface CollaborationAnalytics {
  period: AnalyticsPeriod;
  startDate: number;
  endDate: number;
  metrics: CollaborationMetrics;
  byUser: Map<string, UserMetrics>;
  byProject: Map<string, ProjectMetrics>;
}

export type AnalyticsPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface CollaborationMetrics {
  totalSessions: number;
  totalUsers: number;
  activeUsers: number;
  totalDocuments: number;
  totalEdits: number;
  totalComments: number;
  totalReviews: number;
  avgSessionDuration: number;
}

export interface UserMetrics {
  userId: string;
  sessionCount: number;
  editCount: number;
  commentCount: number;
  reviewCount: number;
  totalTime: number;
  avgSessionDuration: number;
}

export interface ProjectMetrics {
  projectId: string;
  activeUsers: number;
  totalSessions: number;
  totalEdits: number;
  totalComments: number;
  documentCount: number;
}

export interface ReviewAnalytics {
  reviewId: string;
  timeToFirstReview: number;
  timeToApproval: number;
  commentCount: number;
  participantCount: number;
  iterationCount: number;
}
