/**
 * GitHub Integration Type Definitions
 * Comprehensive type system for GitHub API v3 and v4
 */

import { z } from 'zod';

// ============================================================================
// Authentication Types
// ============================================================================

export enum AuthType {
  PersonalAccessToken = 'pat',
  OAuth = 'oauth',
  GitHubApp = 'app',
  Installation = 'installation'
}

export interface AuthConfig {
  type: AuthType;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  appId?: number;
  privateKey?: string;
  installationId?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
  resource: string;
}

export interface RateLimitState {
  core: RateLimitInfo;
  search: RateLimitInfo;
  graphql: RateLimitInfo;
  integrationManifest: RateLimitInfo;
}

// ============================================================================
// Repository Types
// ============================================================================

export enum RepositoryVisibility {
  Public = 'public',
  Private = 'private'
}

export enum RepositoryPermission {
  Admin = 'admin',
  Maintain = 'maintain',
  Write = 'write',
  Triage = 'triage',
  Read = 'read'
}

export interface Repository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: User;
  private: boolean;
  visibility: RepositoryVisibility;
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
  mirror_url: string | null;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: License | null;
  allow_forking: boolean;
  is_template: boolean;
  web_commit_signoff_required: boolean;
  topics: string[];
  visibility_level: string;
  permissions: RepositoryPermissions;
  security_and_analysis: SecurityAndAnalysis;
}

export interface RepositoryPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
}

export interface License {
  key: string;
  name: string;
  url: string | null;
  spdx_id: string;
  node_id: string;
  html_url: string;
}

export interface SecurityAndAnalysis {
  advanced_security: FeatureState;
  secret_scanning: FeatureState;
  secret_scanning_push_protection: FeatureState;
  dependabot_security_updates: FeatureState;
  dependabot_alerts: FeatureState;
  code_scanning_default_setup: FeatureState;
  code_scanning_coverage: FeatureState;
}

export interface FeatureState {
  status: 'enabled' | 'disabled' | 'not_configured';
}

// ============================================================================
// Branch Types
// ============================================================================

export interface Branch {
  name: string;
  commit: BranchCommit;
  protected: boolean;
  protection_url: string;
  protection: BranchProtection | null;
}

export interface BranchCommit {
  sha: string;
  node_id: string;
  commit: CommitDetail;
}

export interface CommitDetail {
  sha: string;
  node_id: string;
  tree: GitObject;
  message: string;
  author: GitActor;
  committer: GitActor;
  timestamp: string;
  verification: Verification;
}

export interface GitObject {
  sha: string;
  url: string;
}

export interface GitActor {
  date: string;
  name: string;
  email: string;
}

export interface Verification {
  verified: boolean;
  reason: string;
  signature: string | null;
  payload: string | null;
}

export interface BranchProtection {
  url: string;
  required_pull_request_reviews: RequiredPullRequestReviews;
  required_status_checks: RequiredStatusChecks;
  enforce_admins: EnforceAdmins;
  restrictions: Restrictions;
}

export interface RequiredPullRequestReviews {
  url: string;
  dismissal_restrictions: DismissalRestrictions;
  dismiss_stale_reviews: boolean;
  require_code_owner_reviews: boolean;
  required_approving_review_count: number;
}

export interface DismissalRestrictions {
  users: User[];
  teams: Team[];
  apps: App[];
}

export interface RequiredStatusChecks {
  url: string;
  strict: boolean;
  contexts: string[];
  checks: StatusCheck[];
}

export interface StatusCheck {
  context: string;
  app_id: number | null;
}

export interface EnforceAdmins {
  url: string;
  enabled: boolean;
}

export interface Restrictions {
  url: string;
  users: User[];
  teams: Team[];
  apps: App[];
}

// ============================================================================
// Pull Request Types
// ============================================================================

export enum PullRequestState {
  Open = 'open',
  Closed = 'closed',
  Merged = 'merged'
}

export enum PullRequestMergeMethod {
  Merge = 'merge',
  Squash = 'squash',
  Rebase = 'rebase'
}

export interface PullRequest {
  id: number;
  node_id: string;
  number: number;
  state: PullRequestState;
  locked: boolean;
  title: string;
  user: User;
  body: string | null;
  labels: Label[];
  milestone: Milestone | null;
  active_lock_reason: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  assignees: User[];
  reviewers: User[];
  requested_reviewers: User[];
  requested_teams: Team[];
  head: PullRequestCommit;
  base: PullRequestCommit;
  author_association: string;
  draft: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  merged: boolean;
  merged_by: User | null;
  comments: number;
  review_comments: number;
  maintainer_can_modify: boolean;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  comments_url: string;
  review_comments_url: string;
  review_comment_url: string;
  commits_url: string;
  statuses_url: string;
  permalink_url: string;
  number_url: string;
  html_url: string;
  repository: Repository;
}

export interface PullRequestCommit {
  label: string;
  ref: string;
  sha: string;
  user: User;
  repo: Repository;
}

export interface PullRequestReview {
  id: number;
  node_id: string;
  user: User | null;
  body: string | null;
  commit_id: string;
  submitted_at: string | null;
  state: PullRequestReviewState;
  html_url: string;
  pull_request_url: string;
  author_association: string;
  links: ReviewLinks;
}

export enum PullRequestReviewState {
  Approved = 'APPROVED',
  ChangesRequested = 'CHANGES_REQUESTED',
  Commented = 'COMMENTED',
  Dismissed = 'DISMISSED',
  Pending = 'PENDING'
}

export interface ReviewLinks {
  html: Link;
  pull_request: Link;
}

export interface Link {
  href: string;
}

// ============================================================================
// Issue Types
// ============================================================================

export enum IssueState {
  Open = 'open',
  Closed = 'closed',
  All = 'all'
}

export interface Issue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  user: User;
  state: IssueState;
  locked: boolean;
  labels: Label[];
  assignees: User[];
  milestone: Milestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author_association: string;
  active_lock_reason: string | null;
  body: string | null;
  closed_by: User | null;
  reactions: Reactions;
  timeline_url: string;
  performed_via_github_app: App | null;
  pull_request: IssuePullRequest | null;
  html_url: string;
  repository: Repository;
}

export interface IssuePullRequest {
  url: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  merged_at: string | null;
}

export interface Label {
  id: number;
  node_id: string;
  url: string;
  name: string;
  color: string;
  default: boolean;
  description: string | null;
}

export interface Milestone {
  id: number;
  node_id: string;
  number: number;
  title: string;
  description: string | null;
  creator: User;
  open_issues: number;
  closed_issues: number;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  due_on: string | null;
  html_url: string;
  labels_url: string;
}

export interface Reactions {
  total_count: number;
  plus_one: number;
  minus_one: number;
  laugh: number;
  hooray: number;
  confused: number;
  heart: number;
  rocket: number;
  eyes: number;
  url: string;
}

export interface IssueComment {
  id: number;
  node_id: string;
  issue_url: string;
  issue_id: number;
  user: User;
  created_at: string;
  updated_at: string;
  body: string;
  reactions: Reactions;
  author_association: string;
  performed_via_github_app: App | null;
  html_url: string;
}

// ============================================================================
// User Types
// ============================================================================

export enum UserType {
  User = 'User',
  Bot = 'Bot',
  Organization = 'Organization',
  Mannequin = 'Mannequin'
}

export interface User {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string | null;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: UserType;
  site_admin: boolean;
  name: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  hireable: boolean | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
  private_gists: number | null;
  total_private_repos: number | null;
  owned_private_repos: number | null;
  disk_usage: number | null;
  collaborators: number | null;
  two_factor_authentication: boolean | null;
  plan: Plan | null;
}

export interface Plan {
  name: string;
  space: number;
  private_repos: number;
  collaborators: number;
}

// ============================================================================
// Team Types
// ============================================================================

export interface Team {
  id: number;
  node_id: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: 'secret' | 'closed' | 'open';
  permission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage';
  url: string;
  html_url: string;
  members_url: string;
  repositories_url: string;
  parent: Team | null;
}

// ============================================================================
// App Types
// ============================================================================

export interface App {
  id: number;
  slug: string;
  node_id: string;
  owner: User;
  name: string;
  description: string | null;
  external_url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  permissions: AppPermissions;
  events: string[];
  installations_count: number;
}

export interface AppPermissions {
  actions: string | null;
  administration: string | null;
  checks: string | null;
  contents: string | null;
  deployments: string | null;
  environments: string | null;
  issues: string | null;
  metadata: string | null;
  packages: string | null;
  pages: string | null;
  pull_requests: string | null;
  repository_hooks: string | null;
  repository_projects: string | null;
  security_events: string | null;
  statuses: string | null;
  vulnerability_alerts: string | null;
  members: string | null;
  organization_administration: string | null;
  organization_hooks: string | null;
  organization_plan: string | null;
  organization_projects: string | null;
  organization_secrets: string | null;
  organization_self_hosted_runners: string | null;
  organization_user_blocking: string | null;
  team_discussions: string | null;
}

// ============================================================================
// Webhook Types
// ============================================================================

export enum WebhookEvent {
  Push = 'push',
  PullRequest = 'pull_request',
  Issues = 'issues',
  IssueComment = 'issue_comment',
  PullRequestReview = 'pull_request_review',
  PullRequestReviewComment = 'pull_request_review_comment',
  Create = 'create',
  Delete = 'delete',
  Fork = 'fork',
  Watch = 'watch',
  Release = 'release',
  Deployment = 'deployment',
  DeploymentStatus = 'deployment_status',
  Milestone = 'milestone',
  Gollum = 'gollum',
  Status = 'status',
  CheckRun = 'check_run',
  CheckSuite = 'check_suite',
  WorkflowRun = 'workflow_run',
  WorkflowDispatch = 'workflow_dispatch',
  RepositoryDispatch = 'repository_dispatch',
  Ping = 'ping',
  Membership = 'membership',
  Member = 'member',
  Public = 'public',
  TeamAdd = 'team_add',
  Organization = 'organization',
  SecurityAdvisory = 'security_advisory'
}

export interface Webhook {
  id: number;
  url: string;
  effective_url: string;
  events: WebhookEvent[];
  name: string;
  active: boolean;
  config: WebhookConfig;
  updated_at: string;
  created_at: string;
  type: string;
  ping_url: string;
  last_response: WebhookResponse;
}

export interface WebhookConfig {
  url: string;
  content_type: string;
  insecure_ssl: string;
  secret: string | null;
  digest: string;
}

export interface WebhookResponse {
  code: number | null;
  status: string | null;
  message: string | null;
}

export interface WebhookDelivery {
  id: number;
  guid: string;
  delivered_at: string;
  redelivery: boolean;
  duration: number;
  status: string;
  status_code: number;
  event: string;
  action: string | null;
  installation_id: number | null;
  repository_id: number;
  url: string;
  request: WebhookRequest;
  response: WebhookResponse;
  hook_id: number;
  hook: Webhook;
}

export interface WebhookRequest {
  headers: Record<string, string>;
  payload: unknown;
}

// ============================================================================
// Release Types
// ============================================================================

export interface Release {
  id: number;
  node_id: string;
  tag_name: string;
  target_commitish: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  author: User;
  assets: ReleaseAsset[];
  html_url: string;
  tarball_url: string;
  zipball_url: string;
  upload_url: string;
}

export interface ReleaseAsset {
  url: string;
  browser_download_url: string;
  id: number;
  node_id: string;
  name: string;
  label: string | null;
  state: 'uploaded' | 'open';
  content_type: string;
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  uploader: User;
}

// ============================================================================
// CI/CD Types
// ============================================================================

export enum WorkflowRunState {
  Queued = 'queued',
  InProgress = 'in_progress',
  Completed = 'completed',
  ActionRequired = 'action_required',
  Cancelled = 'cancelled',
  Failure = 'failure',
  Neutral = 'neutral',
  Skipped = 'skipped',
  Stale = 'stale',
  Success = 'success',
  TimedOut = 'timed_out'
}

export enum Conclusion {
  ActionRequired = 'action_required',
  Cancelled = 'cancelled',
  Failure = 'failure',
  Neutral = 'neutral',
  Success = 'success',
  Skipped = 'skipped',
  Stale = 'stale',
  TimedOut = 'timed_out'
}

export interface WorkflowRun {
  id: number;
  name: string;
  node_id: string;
  head_branch: string;
  head_sha: string;
  run_number: number;
  event: string;
  status: WorkflowRunState;
  conclusion: Conclusion | null;
  workflow_id: number;
  url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  actor: User;
  run_attempt: number;
  triggered_by: string | null;
  previous_attempt_url: string | null;
  repository: Repository;
  head_commit: HeadCommit;
  jobs: WorkflowJob[];
  logs_url: string;
  check_suite_url: string;
  cancel_url: string;
  rerun_url: string;
  delete_logs_url: string;
  artifacts_url: string;
}

export interface WorkflowJob {
  id: number;
  run_id: number;
  run_url: string;
  node_id: string;
  head_sha: string;
  url: string;
  html_url: string;
  status: WorkflowRunState;
  conclusion: Conclusion | null;
  started_at: string;
  completed_at: string | null;
  name: string;
  steps: JobStep[];
  check_run_url: string;
  labels: string[];
  runner_id: number | null;
  runner_name: string | null;
  runner_group_id: number | null;
  runner_group_name: string | null;
}

export interface JobStep {
  name: string;
  status: WorkflowRunState;
  conclusion: Conclusion | null;
  number: number;
  started_at: string;
  completed_at: string | null;
}

export interface HeadCommit {
  id: string;
  tree_id: string;
  message: string;
  timestamp: string;
  author: GitActor;
  committer: GitActor;
}

export interface Artifact {
  id: number;
  node_id: string;
  name: string;
  size_in_bytes: number;
  url: string;
  archive_download_url: string;
  expired: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
  artifact_run_id: number;
  workflow_run: WorkflowRun;
}

// ============================================================================
// Security Types
// ============================================================================

export interface CodeScanningAlert {
  number: number;
  created_at: string;
  updated_at: string;
  url: string;
  html_url: string;
  state: 'open' | 'dismissed' | 'fixed';
  fixed_at: string | null;
  dismissed_at: string | null;
  dismissed_by: User | null;
  dismissed_reason: string | null;
  dismissed_comment: string | null;
  rule: CodeScanningRule;
  tool: CodeScanningTool;
  most_recent_instance: CodeScanningInstance;
  instances_url: string;
  state_reason: string;
}

export interface CodeScanningRule {
  id: string;
  severity: 'none' | 'note' | 'warning' | 'error';
  description: string;
  name: string;
  full_description: string;
  tags: string[];
  security_severity_level: 'low' | 'medium' | 'high' | 'critical' | null;
}

export interface CodeScanningTool {
  name: string;
  version: string | null;
  guid: string | null;
}

export interface CodeScanningInstance {
  ref: string;
  commit_sha: string;
  location: CodeScanningLocation;
  classifications: string[];
}

export interface CodeScanningLocation {
  path: string;
  start_line: number;
  end_line: number;
  start_column: number;
  end_column: number;
}

export interface SecretScanningAlert {
  number: number;
  created_at: string;
  updated_at: string;
  url: string;
  html_url: string;
  state: 'open' | 'resolved' | 'dismissed';
  resolved_at: string | null;
  resolved_by: User | null;
  dismissed_at: string | null;
  dismissed_by: User | null;
  dismissed_reason: string | null;
  secret_type: string;
  secret_type_display_name: string;
  secret: string;
  validity: string | null;
  resolution_comment: string | null;
  push_protection_bypassed: boolean;
  push_protection_bypassed_by: User | null;
  push_protection_bypassed_at: string | null;
  locations_url: string;
}

export interface DependabotAlert {
  id: number;
  url: string;
  html_url: string;
  state: 'auto_dismissed' | 'dismissed' | 'fixed' | 'open';
  dependency: DependabotDependency;
  security_advisory: SecurityAdvisory;
  security_vulnerability: SecurityVulnerability;
  dismissed_at: string | null;
  dismissed_by: User | null;
  dismissed_reason: string | null;
  fixed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DependabotDependency {
  package: DependabotPackage;
  manifest_path: string;
  scope: string | null;
}

export interface DependabotPackage {
  ecosystem: string;
  name: string;
}

export interface SecurityAdvisory {
  ghsa_id: string;
  cve_id: string;
  summary: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  identifiers: AdvisoryIdentifier[];
  references: AdvisoryReference[];
  published_at: string;
  updated_at: string;
  withdrawn_at: string | null;
  vulnerabilities: SecurityVulnerability[];
}

export interface AdvisoryIdentifier {
  type: string;
  value: string;
}

export interface AdvisoryReference {
  url: string;
}

export interface SecurityVulnerability {
  package: DependabotPackage;
  severity: string;
  vulnerable_version_range: string;
  first_patched_version: FirstPatchedVersion;
}

export interface FirstPatchedVersion {
  identifier: string;
}

// ============================================================================
// File Types
// ============================================================================

export interface File {
  sha: string;
  node_id: string;
  name: string;
  path: string;
  content: string | null;
  size: number;
  encoding: string | null;
  type: string;
  target: string | null;
  license: string | null;
}

export interface FileCommit {
  sha: string;
  node_id: string;
  url: string;
  html_url: string;
  files: FileChange[];
  commit: CommitDetail;
}

export interface FileChange {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch: string | null;
  previous_filename: string | null;
}

// ============================================================================
// Commit Types
// ============================================================================

export interface Commit {
  sha: string;
  node_id: string;
  commit: CommitDetail;
  url: string;
  html_url: string;
  comments_url: string;
  author: User | null;
  committer: User | null;
  parents: ParentCommit[];
  stats: CommitStats | null;
  files: FileChange[] | null;
}

export interface ParentCommit {
  sha: string;
  url: string;
  html_url: string;
}

export interface CommitStats {
  total: number;
  additions: number;
  deletions: number;
}

export interface CommitComment {
  id: number;
  node_id: string;
  position: number | null;
  line: number | null;
  path: string | null;
  user: User;
  commit_id: string;
  created_at: string;
  updated_at: string;
  author_association: string;
  body: string;
  reactions: Reactions;
  html_url: string;
}

// ============================================================================
// Status Types
// ============================================================================

export enum StatusState {
  Pending = 'pending',
  Success = 'success',
  Error = 'error',
  Failure = 'failure',
  ActionRequired = 'action_required'
}

export interface Status {
  id: number;
  node_id: string;
  sha: string;
  url: string;
  state: StatusState;
  creator: User;
  description: string | null;
  target_url: string | null;
  context: string;
  created_at: string;
  updated_at: string;
  avatar_url: string | null;
}

export interface CombinedStatus {
  state: StatusState;
  sha: string;
  total_count: number;
  statuses: Status[];
  commit: CommitDetail;
  repository: Repository;
  creator: User | null;
  url: string;
}

// ============================================================================
// Check Types
// ============================================================================

export enum CheckStatus {
  Queued = 'queued',
  InProgress = 'in_progress',
  Completed = 'completed',
  ActionRequired = 'action_required'
}

export interface CheckRun {
  id: number;
  node_id: string;
  head_sha: string;
  external_id: string | null;
  url: string;
  html_url: string;
  details_url: string | null;
  status: CheckStatus;
  conclusion: Conclusion | null;
  started_at: string;
  completed_at: string | null;
  output: CheckOutput;
  name: string;
  check_suite: CheckSuite;
  app: App;
  pull_requests: PullRequest[];
}

export interface CheckOutput {
  title: string | null;
  summary: string | null;
  text: string | null;
  annotations_count: number;
  annotations_url: string;
  annotations: CheckAnnotation[];
}

export interface CheckAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  start_column: number | null;
  end_column: number | null;
  annotation_level: 'notice' | 'warning' | 'failure';
  message: string;
  title: string | null;
  raw_details: string | null;
}

export interface CheckSuite {
  id: number;
  node_id: string;
  head_branch: string;
  head_sha: string;
  status: CheckStatus;
  conclusion: Conclusion | null;
  url: string;
  before: string;
  after: string;
  pull_requests: PullRequest[];
  app: App;
  created_at: string;
  updated_at: string;
  latest_check_runs_count: number;
  check_runs_url: string;
  head_commit: HeadCommit;
}

// ============================================================================
// GraphQL Types
// ============================================================================

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations: ErrorLocation[];
  path: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface ErrorLocation {
  line: number;
  column: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  next_url: string | null;
  prev_url: string | null;
  first_url: string;
  last_url: string;
}

export interface APIError {
  message: string;
  documentation_url: string;
  status: number;
  error: string;
  errors: ValidationError[];
}

export interface ValidationError {
  resource: string;
  field: string;
  code: string;
  message: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface GitHubClientConfig {
  auth: AuthConfig;
  baseUrl?: string;
  timeout?: number;
  userAgent?: string;
  retry?: RetryConfig;
  throttle?: ThrottleConfig;
  cache?: CacheConfig;
  log?: LogConfig;
}

export interface RetryConfig {
  maxRetries: number;
  retryAfter: number;
  factor: number;
  maxTimeout: number;
  retryableStatuses: number[];
}

export interface ThrottleConfig {
  enabled: boolean;
  factor: number;
  minTimeout: number;
  maxTimeout: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  type: 'memory' | 'redis';
  redis?: RedisConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  pretty: boolean;
  file?: string;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const AuthConfigSchema = z.object({
  type: z.nativeEnum(AuthType),
  token: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  appId: z.number().optional(),
  privateKey: z.string().optional(),
  installationId: z.number().optional()
});

export const RepositorySchema = z.object({
  id: z.number(),
  node_id: z.string(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  description: z.string().nullable(),
  fork: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  stargazers_count: z.number(),
  watchers_count: z.number(),
  language: z.string().nullable(),
  has_issues: z.boolean(),
  has_projects: z.boolean(),
  has_wiki: z.boolean(),
  archived: z.boolean(),
  open_issues_count: z.number()
});

export const PullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  state: z.nativeEnum(PullRequestState),
  title: z.string(),
  body: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  head: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string()
  }),
  base: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string()
  }),
  mergeable: z.boolean().nullable(),
  merged: z.boolean(),
  additions: z.number(),
  deletions: z.number(),
  changed_files: z.number()
});

export const IssueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  state: z.nativeEnum(IssueState),
  body: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  comments: z.number()
});

export const WorkflowRunSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.nativeEnum(WorkflowRunState),
  conclusion: z.nativeEnum(Conclusion).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  head_sha: z.string(),
  head_branch: z.string()
});

export const CodeScanningAlertSchema = z.object({
  number: z.number(),
  state: z.enum(['open', 'dismissed', 'fixed']),
  rule: z.object({
    id: z.string(),
    severity: z.enum(['none', 'note', 'warning', 'error']),
    description: z.string()
  }),
  created_at: z.string(),
  updated_at: z.string()
});

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type GitHubResponse<T> = Promise<T>;

export type GitHubPaginatedResponse<T> = Promise<PaginatedResponse<T>>;
