/**
 * GitHub Integration Module
 *
 * Comprehensive GitHub API client, webhook handling, and automation
 * Optimized for Cloudflare Workers
 */

// ============================================================================
// Exports
// ============================================================================

// Types
export * from './types';

// Authentication
export {
  generateAppJWT,
  createInstallationAccessToken,
  getRepositoryInstallation,
  getOrganizationInstallation,
  getUserInstallation,
  listInstallations,
  getOrCreateInstallationToken,
  clearCachedToken,
  getCachedTokens,
  createOAuthToken,
  checkOAuthToken,
  validatePersonalAccessToken,
  type GitHubAppConfig,
} from './auth';

// Client
export {
  GitHubClient,
  createGitHubClient,
  type GitHubClientOptions,
  type RequestOptions,
} from './client';

// Webhooks
export {
  verifyWebhookSignature,
  verifyLegacyWebhookSignature,
  parseWebhookHeaders,
  parseWebhookPayload,
  WebhookRouter,
  createDefaultWebhookRouter,
  webhookMiddleware,
  processWebhook,
  handlePushEvent,
  handlePullRequestEvent,
  handleIssueEvent,
  handleIssueCommentEvent,
  handleWorkflowRunEvent,
  handleCheckRunEvent,
  extractInstallationId,
  extractRepository,
  extractSender,
  extractAction,
  isTestPing,
  type WebhookContext,
  type WebhookHandlerResult,
  type WebhookEventHandler,
  type WebhookMiddlewareOptions,
} from './webhooks';

// Operations
export {
  // Tree and Blob
  createBlob,
  createTree,
  getTreeRecursive,
  // Branch
  createBranch,
  deleteBranch,
  getDefaultBranch,
  // Commit
  createCommit,
  amendCommit,
  revertCommit,
  cherryPickCommit,
  // File
  readFile,
  writeFile,
  deleteFile,
  moveFile,
  listDirectory,
  getPath,
  // Batch
  commitMultipleFiles,
  applyChanges,
  // Diff
  getDiff,
  // Repository
  forkRepository,
  getTarballUrl,
  getZipballUrl,
  // Tag
  createTag,
  listTags,
  deleteTag,
  // Release
  createRelease,
  listReleases,
} from './operations';

// Pull Request Automation
export {
  createPullRequest,
  createDraftPullRequest,
  createPullRequestFromBranch,
  updatePullRequest,
  convertDraftToPR,
  convertPRToDraft,
  reopenPullRequest,
  closePullRequest,
  addLabelsToPR,
  removeLabelFromPR,
  setLabelsOnPR,
  addAssigneesToPR,
  removeAssigneeFromPR,
  requestReviewersForPR,
  removeRequestedReviewersFromPR,
  createPRComment,
  createPRReviewComment,
  replyToPRReviewComment,
  editPRComment,
  deletePRComment,
  approvePullRequest,
  requestChangesOnPR,
  commentOnPR,
  dismissPRReview,
  getPRReviews,
  getPRReview,
  mergePullRequest,
  mergePRWithMerge,
  squashAndMergePR,
  rebaseAndMergePR,
  autoMergePullRequest,
  createAndAutoMergePR,
  labelPRBySize,
  generatePRDescriptionTemplate,
  isPRMergeable,
  isPRMerged,
  isPRDraft,
  isPRApproved,
  getPRSize,
} from './pr';

// Monorepo
export {
  detectMonorepo,
  detectPackageManager,
  listMonorepoPackages,
  findPackagesByPattern,
  getPackageInfo,
  buildDependencyGraph,
  getDependents,
  getTransitiveDependencies,
  topologicalSort,
  detectChangedPackages,
  calculateBuildOrder,
} from './monorepo';

// ============================================================================
// Re-exports for convenience
// ============================================================================

export {
  GitHubAPIError,
  GitHubAuthError,
  GitHubRateLimitError,
  WebhookVerificationError,
} from './types';
