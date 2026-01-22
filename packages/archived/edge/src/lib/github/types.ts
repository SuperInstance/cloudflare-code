/**
 * GitHub Integration Type Definitions
 *
 * Comprehensive types for GitHub API, webhooks, and operations
 * Compatible with Cloudflare Workers runtime
 */

// ============================================================================
// GitHub API Types
// ============================================================================

/**
 * GitHub API Response Wrapper
 */
export interface GitHubResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * GitHub Error Response
 */
export interface GitHubError {
  message: string;
  documentation_url?: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
  }>;
}

// ============================================================================
// Repository Types
// ============================================================================

/**
 * GitHub Repository
 */
export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: GitHubLicense | null;
  allow_forking: boolean;
  is_template: boolean;
  web_commit_signoff_required: boolean;
  topics: string[];
  visibility: 'public' | 'private';
  default_branch: string;
}

/**
 * GitHub License
 */
export interface GitHubLicense {
  key: string;
  name: string;
  spdx_id: string;
  url: string;
  node_id: string;
}

/**
 * Repository Content
 */
export interface GitHubContent {
  type: 'file' | 'dir' | 'submodule' | 'symlink';
  size: number;
  name: string;
  path: string;
  content?: string; // Base64 encoded
  encoding?: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  download_url?: string;
}

/**
 * Repository File with Decoded Content
 */
export interface GitHubFile extends GitHubContent {
  decodedContent: string;
}

/**
 * Git Commit
 */
export interface GitCommit {
  sha: string;
  node_id: string;
  commit: GitCommitDetail;
  url: string;
  html_url: string;
  comments_url: string;
  author: GitHubUser | null;
  committer: GitHubUser | null;
  parents: Array<{
    sha: string;
    url: string;
    html_url: string;
  }>;
}

/**
 * Git Commit Detail
 */
export interface GitCommitDetail {
  url: string;
  author: GitCommitAuthor;
  committer: GitCommitAuthor;
  message: string;
  comment_count: number;
  tree: {
    sha: string;
    url: string;
  };
}

/**
 * Git Commit Author
 */
export interface GitCommitAuthor {
  name: string;
  email: string;
  date: string;
}

/**
 * Git Reference (Branch/Tag)
 */
export interface GitReference {
  ref: string;
  node_id: string;
  url: string;
  object: {
    sha: string;
    type: string;
    url: string;
  };
}

/**
 * Git Tree
 */
export interface GitTree {
  sha: string;
  url: string;
  tree: Array<{
    path: string;
    mode: string;
    type: 'blob' | 'tree' | 'commit';
    sha: string;
    size?: number;
    url: string;
  }>;
  truncated: boolean;
}

// ============================================================================
// Pull Request Types
// ============================================================================

/**
 * Pull Request State
 */
export type PullRequestState = 'open' | 'closed' | 'all';

/**
 * Pull Request
 */
export interface GitHubPullRequest {
  id: number;
  node_id: string;
  number: number;
  state: PullRequestState;
  locked: boolean;
  title: string;
  user: GitHubUser;
  body: string | null;
  labels: Array<{
    id: number;
    node_id: string;
    url: string;
    name: string;
    color: string;
    default: boolean;
    description: string | null;
  }>;
  milestone: GitHubMilestone | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];
  requested_teams: GitHubTeam[];
  head: GitHubPRBranch;
  base: GitHubPRBranch;
  author_association: string;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  merged_by: GitHubUser | null;
  comments: number;
  review_comments: number;
  maintainers_can_modify: boolean;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  html_url: string;
  url: string;
  issue_url: string;
  comments_url: string;
}

/**
 * Pull Request Branch
 */
export interface GitHubPRBranch {
  label: string;
  ref: string;
  sha: string;
  user: GitHubUser;
  repo: GitHubRepository;
}

/**
 * Pull Request Review
 */
export interface GitHubPullRequestReview {
  id: number;
  node_id: string;
  user: GitHubUser | null;
  body: string | null;
  commit_id: string;
  submitted_at: string | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  html_url: string;
  pull_request_url: string;
  author_association: string;
}

/**
 * Pull Request Comment
 */
export interface GitHubPullRequestComment {
  id: number;
  node_id: string;
  pull_request_review_id: number | null;
  in_reply_to_id: number | null;
  user: GitHubUser | null;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request_url: string;
  author_association: string;
  commit_id: string;
  path: string | null;
  diff_hunk: string | null;
  position: number | null;
  original_position: number | null;
  start_commit_id: string | null;
  original_commit_id: string | null;
}

// ============================================================================
// Issue Types
// ============================================================================

/**
 * Issue State
 */
export type IssueState = 'open' | 'closed' | 'all';

/**
 * Issue
 */
export interface GitHubIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  user: GitHubUser;
  state: IssueState;
  locked: boolean;
  labels: Array<{
    id: number;
    node_id: string;
    url: string;
    name: string;
    color: string;
    default: boolean;
    description: string | null;
  }>;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: GitHubMilestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author_association: string;
  body: string | null;
  html_url: string;
  url: string;
}

// ============================================================================
// User Types
// ============================================================================

/**
 * GitHub User
 */
export interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  type: 'User' | 'Bot';
  site_admin: boolean;
  name: string | null;
  email: string | null;
}

/**
 * GitHub Team
 */
export interface GitHubTeam {
  id: number;
  node_id: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: 'secret' | 'closed' | 'open';
  url: string;
  html_url: string;
  members_url: string;
  repositories_url: string;
  permission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage';
}

/**
 * GitHub Milestone
 */
export interface GitHubMilestone {
  id: number;
  node_id: string;
  number: number;
  title: string;
  description: string;
  creator: GitHubUser;
  open_issues: number;
  closed_issues: number;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  due_on: string | null;
  html_url: string;
  url: string;
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Webhook Event Types
 */
export type WebhookEventType =
  | 'push'
  | 'pull_request'
  | 'pull_request_review'
  | 'pull_request_review_comment'
  | 'issues'
  | 'issue_comment'
  | 'create'
  | 'delete'
  | 'release'
  | 'workflow_run'
  | 'check_run'
  | 'check_suite'
  | 'installation'
  | 'installation_repositories';

/**
 * Webhook Headers
 */
export interface WebhookHeaders {
  'x-github-event': WebhookEventType;
  'x-github-delivery': string;
  'x-hub-signature-256'?: string;
  'x-hub-signature'?: string;
  'x-github-hook-id': string;
  'x-github-hook-installation-target-type'?: 'integration' | 'organization' | 'repository';
  'x-github-hook-installation-target-id'?: string;
}

/**
 * Base Webhook Payload
 */
export interface WebhookPayload {
  [key: string]: unknown;
}

/**
 * Push Webhook Payload
 */
export interface PushWebhookPayload {
  ref: string;
  before: string;
  after: string;
  repository: GitHubRepository;
  pusher: {
    name: string;
    email: string;
  };
  sender: GitHubUser;
  created: boolean;
  deleted: boolean;
  forced: boolean;
  base_ref: string | null;
  compare: string;
  commits: Array<{
    id: string;
    tree_id: string;
    distinct: boolean;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
      username: string;
    };
    committer: {
      name: string;
      email: string;
      username: string;
    };
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  head_commit: {
    id: string;
    tree_id: string;
    distinct: boolean;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
      username: string;
    };
    committer: {
      name: string;
      email: string;
      username: string;
    };
    added: string[];
    removed: string[];
    modified: string[];
  } | null;
}

/**
 * Pull Request Webhook Payload
 */
export interface PullRequestWebhookPayload {
  action: 'opened' | 'edited' | 'closed' | 'reopened' | 'assigned' | 'unassigned' | 'review_requested' | 'review_request_removed' | 'labeled' | 'unlabeled' | 'synchronize';
  number: number;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
  installation?: {
    id: number;
    node_id: string;
  };
  changes?: Record<string, unknown>;
}

/**
 * Issue Webhook Payload
 */
export interface IssueWebhookPayload {
  action: 'opened' | 'edited' | 'deleted' | 'transferred' | 'pinned' | 'unpinned' | 'closed' | 'reopened' | 'assigned' | 'unassigned' | 'labeled' | 'unlabeled' | 'locked' | 'unlocked' | 'milestoned' | 'demilestoned';
  issue: GitHubIssue;
  repository: GitHubRepository;
  sender: GitHubUser;
  installation?: {
    id: number;
    node_id: string;
  };
  changes?: Record<string, unknown>;
}

/**
 * Issue Comment Webhook Payload
 */
export interface IssueCommentWebhookPayload {
  action: 'created' | 'edited' | 'deleted';
  issue: GitHubIssue;
  comment: {
    id: number;
    node_id: string;
    user: GitHubUser;
    created_at: string;
    updated_at: string;
    body: string;
    html_url: string;
    author_association: string;
  };
  repository: GitHubRepository;
  sender: GitHubUser;
  installation?: {
    id: number;
    node_id: string;
  };
  changes?: Record<string, unknown>;
}

/**
 * Check Run Webhook Payload
 */
export interface CheckRunWebhookPayload {
  action: 'created' | 'completed' | 'rerequested' | 'requested_action';
  check_run: {
    id: number;
    node_id: string;
    name: string;
    head_sha: string;
    external_id: string;
    status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested';
    started_at: string;
    completed_at: string | null;
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
    output: {
      title: string;
      summary: string;
      text: string;
      annotations_count: number;
      annotations_url: string;
    };
  };
  repository: GitHubRepository;
  sender: GitHubUser;
  installation?: {
    id: number;
    node_id: string;
  };
}

/**
 * Workflow Run Webhook Payload
 */
export interface WorkflowRunWebhookPayload {
  action: 'requested' | 'completed';
  workflow_run: {
    id: number;
    name: string;
    node_id: string;
    head_branch: string;
    head_sha: string;
    run_number: number;
    event: string;
    status: string;
    conclusion: string | null;
    workflow_id: number;
    created_at: string;
    updated_at: string;
    run_started_at: string;
    actor: GitHubUser;
    run_attempt: number;
    referenced_workflows: unknown[];
    repository: GitHubRepository;
    head_commit: {
      id: string;
      tree_id: string;
      message: string;
      timestamp: string;
      author: {
        name: string;
        email: string;
      };
      committer: {
        name: string;
        email: string;
      };
    };
  };
  repository: GitHubRepository;
  sender: GitHubUser;
  installation?: {
    id: number;
    node_id: string;
  };
}

// ============================================================================
// GitHub App Types
// ============================================================================

/**
 * GitHub App Installation
 */
export interface GitHubAppInstallation {
  id: number;
  node_id: string;
  account: GitHubUser;
  repository_selection: 'all' | 'selected';
  access_tokens_url: string;
  repositories_url: string;
  html_url: string;
  app_id: number;
  target_id: number;
  target_type: 'User' | 'Organization';
  permissions: GitHubAppPermissions;
  created_at: string;
  updated_at: string;
  single_file_name: string | null;
  suspended_by: GitHubUser | null;
  suspended_at: string | null;
}

/**
 * GitHub App Permissions
 */
export interface GitHubAppPermissions {
  actions?: 'read' | 'write' | 'admin';
  administration?: 'read' | 'write' | 'admin';
  checks?: 'read' | 'write';
  contents?: 'read' | 'write' | 'admin';
  deployments?: 'read' | 'write' | 'admin';
  environments?: 'read' | 'write' | 'admin';
  issues?: 'read' | 'write' | 'admin';
  metadata?: 'read' | 'write';
  packages?: 'read' | 'write' | 'admin';
  pages?: 'read' | 'write' | 'admin';
  pull_requests?: 'read' | 'write' | 'admin';
  repository_announcements?: 'read' | 'write' | 'admin';
  repository_hooks?: 'read' | 'write' | 'admin';
  repository_projects?: 'read' | 'write' | 'admin';
  secret_scanning_alerts?: 'read' | 'write';
  secrets?: 'read' | 'write' | 'admin';
  security_events?: 'read' | 'write';
  single_file?: 'read' | 'write';
  statuses?: 'read' | 'write' | 'admin';
  vulnerability_alerts?: 'read' | 'write';
  workflows?: 'read' | 'write' | 'admin';
  members?: 'read' | 'write' | 'admin';
  organization_administration?: 'read' | 'write' | 'admin';
  organization_hooks?: 'read' | 'write' | 'admin';
  organization_plan?: 'read';
  organization_projects?: 'read' | 'write' | 'admin';
  organization_secrets?: 'read' | 'write' | 'admin';
  organization_self_hosted_runners?: 'read' | 'write' | 'admin';
  organization_user_blocking?: 'read' | 'write' | 'admin';
  team_discussions?: 'read' | 'write' | 'admin';
}

/**
 * Installation Access Token
 */
export interface InstallationAccessToken {
  token: string;
  expires_at: string;
  permissions: GitHubAppPermissions;
  repositories: Array<{
    id: number;
    node_id: string;
    name: string;
    full_name: string;
  }>;
}

// ============================================================================
// Diff Types
// ============================================================================

/**
 * File Diff
 */
export interface FileDiff {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied';
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  previous_filename?: string;
}

/**
 * Comparison Result
 */
export interface ComparisonResult {
  url: string;
  html_url: string;
  permalink_url: string;
  diff_url: string;
  html_url: string;
  patch_url: string;
  base_commit: GitCommit;
  merge_base_commit: GitCommit;
  status: 'ahead' | 'behind' | 'identical' | 'diverged';
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: GitCommit[];
  files: FileDiff[];
}

// ============================================================================
// Git Operation Types
// ============================================================================

/**
 * Create Branch Options
 */
export interface CreateBranchOptions {
  owner: string;
  repo: string;
  branch: string;
  fromBranch?: string;
  fromSha?: string;
}

/**
 * Commit Options
 */
export interface CommitOptions {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: Array<{
    path: string;
    content: string;
    encoding?: 'utf-8' | 'base64';
  }>;
}

/**
 * Create Pull Request Options
 */
export interface CreatePROptions {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  head: string;
  base: string;
  draft?: boolean;
  maintainer_can_modify?: boolean;
  labels?: string[];
  assignees?: string[];
  reviewers?: string[];
  team_reviewers?: string[];
}

/**
 * Merge Pull Request Options
 */
export interface MergePROptions {
  owner: string;
  repo: string;
  pullNumber: number;
  commitTitle?: string;
  commitMessage?: string;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
}

/**
 * Add Comment Options
 */
export interface AddCommentOptions {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}

/**
 * Add Review Comment Options
 */
export interface AddReviewCommentOptions {
  owner: string;
  repo: string;
  pullNumber: number;
  body: string;
  commitId: string;
  path: string;
  position?: number;
  side?: 'LEFT' | 'RIGHT';
  startLine?: number;
  startSide?: 'LEFT' | 'RIGHT';
  line?: number;
}

/**
 * Submit Review Options
 */
export interface SubmitReviewOptions {
  owner: string;
  repo: string;
  pullNumber: number;
  reviewId: number;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' | 'DISMISS';
  body?: string;
}

// ============================================================================
// Monorepo Detection
// ============================================================================

/**
 * Monorepo Configuration
 */
export interface MonorepoConfig {
  type: 'npm' | 'yarn' | 'pnpm' | 'lerna' | 'turborepo' | 'nx' | 'rush' | 'custom';
  rootPackageJson?: Record<string, unknown>;
  packages: string[];
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  workspaces?: string[];
}

/**
 * Package Info
 */
export interface PackageInfo {
  name: string;
  path: string;
  version: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspacePath?: string;
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Rate Limit Info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
  resource: 'core' | 'search' | 'graphql' | 'integration_manifest';
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * GitHub API Error
 */
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public githubError?: GitHubError
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

/**
 * Authentication Error
 */
export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

/**
 * Rate Limit Error
 */
export class GitHubRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public rateLimit: RateLimitInfo
  ) {
    super(message);
    this.name = 'GitHubRateLimitError';
  }
}

/**
 * Webhook Verification Error
 */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}
