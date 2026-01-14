/**
 * GitHub Pull Request Automation
 *
 * High-level PR operations including creation, review, merging,
 * and automated workflows
 */

import { GitHubClient } from './client';
import {
  GitHubPullRequest,
  GitHubPullRequestReview,
  GitCommit,
  CreatePROptions,
  MergePROptions,
} from './types';

// ============================================================================
// PR Creation
// ============================================================================

/**
 * Create a pull request with enhanced options
 *
 * @param client - GitHub client
 * @param options - PR creation options
 * @returns Created pull request
 */
export async function createPullRequest(
  client: GitHubClient,
  options: CreatePROptions
): Promise<GitHubPullRequest> {
  const {
    owner,
    repo,
    title,
    body,
    head,
    base,
    draft,
    maintainer_can_modify,
    labels,
    assignees,
    reviewers,
    team_reviewers,
  } = options;

  // Create PR
  const pr = await client.createPullRequest(owner, repo, title, body || '', head, base, draft ?? false);

  // Add labels if specified
  if (labels && labels.length > 0) {
    await addLabelsToPR(client, owner, repo, pr.number, labels);
  }

  // Add assignees if specified
  if (assignees && assignees.length > 0) {
    await addAssigneesToPR(client, owner, repo, pr.number, assignees);
  }

  // Request reviewers if specified
  if (reviewers && reviewers.length > 0) {
    await requestReviewersForPR(client, owner, repo, pr.number, reviewers, team_reviewers);
  }

  return pr;
}

/**
 * Create a draft pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param title - PR title
 * @param head - Head branch
 * @param base - Base branch
 * @returns Created draft PR
 */
export async function createDraftPullRequest(
  client: GitHubClient,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string
): Promise<GitHubPullRequest> {
  return client.createPullRequest(owner, repo, title, '', head, base, true);
}

/**
 * Create a pull request from a branch
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name (will be used as head)
 * @param base - Base branch
 * @param title - PR title
 * @param body - PR body
 * @returns Created pull request
 */
export async function createPullRequestFromBranch(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch: string,
  base: string,
  title: string,
  body?: string
): Promise<GitHubPullRequest> {
  return createPullRequest(client, {
    owner,
    repo,
    title,
    body,
    head: branch,
    base,
  });
}

// ============================================================================
// PR Updates
// ============================================================================

/**
 * Update pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param updates - Updates to apply
 * @returns Updated PR
 */
export async function updatePullRequest(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  updates: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    base?: string;
    draft?: boolean;
  }
): Promise<GitHubPullRequest> {
  return client.updatePullRequest(owner, repo, number, updates);
}

/**
 * Convert draft PR to regular PR
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @returns Updated PR
 */
export async function convertDraftToPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubPullRequest> {
  return client.updatePullRequest(owner, repo, number, { draft: false });
}

/**
 * Convert PR to draft
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @returns Updated PR
 */
export async function convertPRToDraft(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubPullRequest> {
  return client.updatePullRequest(owner, repo, number, { draft: true });
}

/**
 * Reopen closed pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @returns Updated PR
 */
export async function reopenPullRequest(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubPullRequest> {
  return client.updatePullRequest(owner, repo, number, { state: 'open' });
}

/**
 * Close pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @returns Updated PR
 */
export async function closePullRequest(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubPullRequest> {
  return client.updatePullRequest(owner, repo, number, { state: 'closed' });
}

// ============================================================================
// PR Labels
// ============================================================================

/**
 * Add labels to pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param labels - Labels to add
 * @returns Updated PR
 */
export async function addLabelsToPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  labels: string[]
): Promise<GitHubPullRequest> {
  return client.request<GitHubPullRequest>(
    `/repos/${owner}/${repo}/issues/${number}/labels`,
    {
      method: 'POST',
      body: { labels },
    }
  );
}

/**
 * Remove label from pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param label - Label to remove
 */
export async function removeLabelFromPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  label: string
): Promise<void> {
  await client.request(`/repos/${owner}/${repo}/issues/${number}/labels/${encodeURIComponent(label)}`, {
    method: 'DELETE',
  });
}

/**
 * Set labels on pull request (replace all)
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param labels - Labels to set
 * @returns Updated PR
 */
export async function setLabelsOnPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  labels: string[]
): Promise<GitHubPullRequest> {
  // First get current labels
  const pr = await client.getPullRequest(owner, repo, number);
  const currentLabels = pr.labels.map((l) => l.name);

  // Remove all current labels
  await client.request(`/repos/${owner}/${repo}/issues/${number}/labels`, {
    method: 'PUT',
    body: { labels: [] },
  });

  // Add new labels
  return addLabelsToPR(client, owner, repo, number, labels);
}

// ============================================================================
// PR Assignees
// ============================================================================

/**
 * Add assignees to pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param assignees - Assignees to add
 * @returns Updated PR
 */
export async function addAssigneesToPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  assignees: string[]
): Promise<GitHubPullRequest> {
  return client.request<GitHubPullRequest>(
    `/repos/${owner}/${repo}/issues/${number}/assignees`,
    {
      method: 'POST',
      body: { assignees },
    }
  );
}

/**
 * Remove assignee from pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param assignee - Assignee to remove
 * @returns Updated PR
 */
export async function removeAssigneeFromPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  assignee: string
): Promise<GitHubPullRequest> {
  return client.request<GitHubPullRequest>(
    `/repos/${owner}/${repo}/issues/${number}/assignees`,
    {
      method: 'DELETE',
      body: { assignees: [assignee] },
    }
  );
}

// ============================================================================
// PR Reviewers
// ============================================================================

/**
 * Request reviewers for pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param reviewers - Reviewers to request
 * @param teamReviewers - Team reviewers to request
 * @returns Updated PR
 */
export async function requestReviewersForPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  reviewers: string[],
  teamReviewers?: string[]
): Promise<GitHubPullRequest> {
  return client.request<GitHubPullRequest>(
    `/repos/${owner}/${repo}/pulls/${number}/requested_reviewers`,
    {
      method: 'POST',
      body: {
        reviewers,
        team_reviewers: teamReviewers || [],
      },
    }
  );
}

/**
 * Remove requested reviewer from pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param reviewers - Reviewers to remove
 * @param teamReviewers - Team reviewers to remove
 * @returns Updated PR
 */
export async function removeRequestedReviewersFromPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  reviewers: string[],
  teamReviewers?: string[]
): Promise<GitHubPullRequest> {
  return client.request<GitHubPullRequest>(
    `/repos/${owner}/${repo}/pulls/${number}/requested_reviewers`,
    {
      method: 'DELETE',
      body: {
        reviewers,
        team_reviewers: teamReviewers || [],
      },
    }
  );
}

// ============================================================================
// PR Comments
// ============================================================================

/**
 * Create pull request comment
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param body - Comment body
 * @returns Created comment
 */
export async function createPRComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  body: string
): Promise<{ id: number; body: string; created_at: string }> {
  return client.request<{ id: number; body: string; created_at: string }>(
    `/repos/${owner}/${repo}/issues/${number}/comments`,
    {
      method: 'POST',
      body: { body },
    }
  );
}

/**
 * Create pull request review comment
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param body - Comment body
 * @param commitId - Commit SHA
 * @param path - File path
 * @param line - Line number
 * @returns Created comment
 */
export async function createPRReviewComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  body: string,
  commitId: string,
  path: string,
  line: number
): Promise<unknown> {
  return client.createPullRequestComment(owner, repo, number, body, commitId, path, line);
}

/**
 * Reply to a pull request review comment
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param commentId - Parent comment ID
 * @param body - Reply body
 * @returns Created reply
 */
export async function replyToPRReviewComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  commentId: number,
  body: string
): Promise<unknown> {
  // Get the PR to find the latest commit
  const pr = await client.getPullRequest(owner, repo, number);

  return client.request(`/repos/${owner}/${repo}/pulls/${number}/comments`, {
    method: 'POST',
    body: {
      body,
      in_reply_to: commentId,
      commit_id: pr.head.sha,
    },
  });
}

/**
 * Edit pull request comment
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param commentId - Comment ID
 * @param body - New comment body
 * @returns Updated comment
 */
export async function editPRComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<unknown> {
  return client.request(`/repos/${owner}/${repo}/issues/comments/${commentId}`, {
    method: 'PATCH',
    body: { body },
  });
}

/**
 * Delete pull request comment
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param commentId - Comment ID
 */
export async function deletePRComment(
  client: GitHubClient,
  owner: string,
  repo: string,
  commentId: number
): Promise<void> {
  await client.request(`/repos/${owner}/${repo}/issues/comments/${commentId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// PR Reviews
// ============================================================================

/**
 * Approve pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param body - Review comment
 * @returns Created review
 */
export async function approvePullRequest(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  body?: string
): Promise<GitHubPullRequestReview> {
  return client.createPullRequestReview(owner, repo, number, 'APPROVE', body);
}

/**
 * Request changes on pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param body - Review comment
 * @param comments - Review comments
 * @returns Created review
 */
export async function requestChangesOnPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  body: string,
  comments?: Array<{
    path: string;
    position: number;
    body: string;
  }>
): Promise<GitHubPullRequestReview> {
  return client.createPullRequestReview(owner, repo, number, 'REQUEST_CHANGES', body, comments);
}

/**
 * Comment on pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param body - Review comment
 * @param comments - Review comments
 * @returns Created review
 */
export async function commentOnPR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  body: string,
  comments?: Array<{
    path: string;
    position: number;
    body: string;
  }>
): Promise<GitHubPullRequestReview> {
  return client.createPullRequestReview(owner, repo, number, 'COMMENT', body, comments);
}

/**
 * Dismiss pull request review
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param reviewId - Review ID
 * @param message - Dismissal message
 * @returns Dismissed review
 */
export async function dismissPRReview(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  reviewId: number,
  message?: string
): Promise<GitHubPullRequestReview> {
  return client.request<GitHubPullRequestReview>(
    `/repos/${owner}/${repo}/pulls/${number}/reviews/${reviewId}/dismissals`,
    {
      method: 'PUT',
      body: { message },
    }
  );
}

/**
 * Get pull request reviews
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @returns List of reviews
 */
export async function getPRReviews(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubPullRequestReview[]> {
  return client.listPullRequestReviews(owner, repo, number);
}

/**
 * Get pull request review
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param reviewId - Review ID
 * @returns Review
 */
export async function getPRReview(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  reviewId: number
): Promise<GitHubPullRequestReview> {
  return client.request<GitHubPullRequestReview>(
    `/repos/${owner}/${repo}/pulls/${number}/reviews/${reviewId}`
  );
}

// ============================================================================
// PR Merging
// ============================================================================

/**
 * Merge pull request
 *
 * @param client - GitHub client
 * @param options - Merge options
 * @returns Merge result
 */
export async function mergePullRequest(
  client: GitHubClient,
  options: MergePROptions
): Promise<{
  merged: boolean;
  message: string;
  sha: string;
}> {
  const { owner, repo, pullNumber, commitTitle, commitMessage, mergeMethod } = options;

  return client.mergePullRequest(owner, repo, pullNumber, commitTitle, commitMessage, mergeMethod);
}

/**
 * Merge pull request with merge commit
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param commitTitle - Commit title
 * @param commitMessage - Commit message
 * @returns Merge result
 */
export async function mergePRWithMerge(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  commitTitle?: string,
  commitMessage?: string
): Promise<{ merged: boolean; message: string; sha: string }> {
  return mergePullRequest(client, {
    owner,
    repo,
    pullNumber: number,
    commitTitle,
    commitMessage,
    mergeMethod: 'merge',
  });
}

/**
 * Squash and merge pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param commitTitle - Commit title
 * @param commitMessage - Commit message
 * @returns Merge result
 */
export async function squashAndMergePR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  commitTitle?: string,
  commitMessage?: string
): Promise<{ merged: boolean; message: string; sha: string }> {
  return mergePullRequest(client, {
    owner,
    repo,
    pullNumber: number,
    commitTitle,
    commitMessage,
    mergeMethod: 'squash',
  });
}

/**
 * Rebase and merge pull request
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @returns Merge result
 */
export async function rebaseAndMergePR(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number
): Promise<{ merged: boolean; message: string; sha: string }> {
  return mergePullRequest(client, {
    owner,
    repo,
    pullNumber: number,
    mergeMethod: 'rebase',
  });
}

// ============================================================================
// PR Status Checks
// ============================================================================

/**
 * Check if pull request is mergeable
 *
 * @param pr - Pull request
 * @returns True if mergeable
 */
export function isPRMergeable(pr: GitHubPullRequest): boolean {
  return pr.mergeable === true;
}

/**
 * Check if pull request is merged
 *
 * @param pr - Pull request
 * @returns True if merged
 */
export function isPRMerged(pr: GitHubPullRequest): boolean {
  return pr.merged === true;
}

/**
 * Check if pull request is draft
 *
 * @param pr - Pull request
 * @returns True if draft
 */
export function isPRDraft(pr: GitHubPullRequest): boolean {
  return pr.draft === true;
}

/**
 * Check if pull request is approved
 *
 * @param reviews - List of reviews
 * @returns True if approved
 */
export function isPRApproved(reviews: GitHubPullRequestReview[]): boolean {
  // Get the latest review from each reviewer
  const latestReviews = new Map<number, GitHubPullRequestReview>();

  for (const review of reviews) {
    if (review.user) {
      const existing = latestReviews.get(review.user.id);
      if (!existing || new Date(review.submitted_at) > new Date(existing.submitted_at)) {
        latestReviews.set(review.user.id, review);
      }
    }
  }

  // Check if there's at least one approving review and no changes requested
  let hasApproval = false;
  for (const review of latestReviews.values()) {
    if (review.state === 'APPROVED') {
      hasApproval = true;
    } else if (review.state === 'CHANGES_REQUESTED') {
      return false;
    }
  }

  return hasApproval;
}

/**
 * Get pull request size
 *
 * @param pr - Pull request
 * @returns Size category
 */
export function getPRSize(pr: GitHubPullRequest): 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' {
  const total = pr.additions + pr.deletions;

  if (total < 20) return 'xs';
  if (total < 100) return 's';
  if (total < 500) return 'm';
  if (total < 1000) return 'l';
  if (total < 5000) return 'xl';
  return 'xxl';
}

// ============================================================================
// PR Workflows
// ============================================================================

/**
 * Auto-merge pull request if conditions are met
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @param options - Auto-merge options
 * @returns Merge result or status
 */
export async function autoMergePullRequest(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number,
  options: {
    requireApproval?: boolean;
    approvalCount?: number;
    mergeMethod?: 'merge' | 'squash' | 'rebase';
    waitForChecks?: boolean;
  } = {}
): Promise<{
  success: boolean;
  merged?: boolean;
  message: string;
}> {
  const {
    requireApproval = true,
    approvalCount = 1,
    mergeMethod = 'merge',
    waitForChecks = false,
  } = options;

  // Get PR
  const pr = await client.getPullRequest(owner, repo, number);

  // Check if PR is already merged
  if (pr.merged) {
    return { success: true, merged: true, message: 'Pull request already merged' };
  }

  // Check if PR is open
  if (pr.state !== 'open') {
    return { success: false, message: `Pull request is ${pr.state}` };
  }

  // Check if PR is mergeable
  if (!pr.mergeable) {
    return { success: false, message: 'Pull request has merge conflicts' };
  }

  // Check approvals if required
  if (requireApproval) {
    const reviews = await client.listPullRequestReviews(owner, repo, number);
    const approvedCount = reviews.filter((r) => r.state === 'APPROVED').length;

    if (approvedCount < approvalCount) {
      return {
        success: false,
        message: `Insufficient approvals: ${approvedCount}/${approvalCount}`,
      };
    }
  }

  // Wait for checks if required
  if (waitForChecks) {
    // Check status checks
    // This would require additional API calls to check combined status
    // For now, we'll proceed
  }

  // Merge PR
  try {
    const result = await mergePullRequest(client, {
      owner,
      repo,
      pullNumber: number,
      mergeMethod,
    });

    if (result.merged) {
      return { success: true, merged: true, message: 'Successfully merged' };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Merge failed',
    };
  }
}

/**
 * Create PR from branch and auto-merge if ready
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @param base - Base branch
 * @param title - PR title
 * @param body - PR body
 * @param autoMergeOptions - Auto-merge options
 * @returns PR and merge status
 */
export async function createAndAutoMergePR(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch: string,
  base: string,
  title: string,
  body?: string,
  autoMergeOptions?: Parameters<typeof autoMergePullRequest>[5]
): Promise<{
  pullRequest: GitHubPullRequest;
  mergeStatus?: Awaited<ReturnType<typeof autoMergePullRequest>>;
}> {
  // Create PR
  const pr = await createPullRequestFromBranch(client, owner, repo, branch, base, title, body);

  // Attempt auto-merge if options provided
  let mergeStatus;
  if (autoMergeOptions) {
    mergeStatus = await autoMergePullRequest(client, owner, repo, pr.number, autoMergeOptions);
  }

  return { pullRequest: pr, mergeStatus };
}

/**
 * Update PR with automated labels based on size
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param number - PR number
 * @returns Updated PR with size labels
 */
export async function labelPRBySize(
  client: GitHubClient,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubPullRequest> {
  const pr = await client.getPullRequest(owner, repo, number);
  const size = getPRSize(pr);

  // Remove existing size labels
  const sizeLabels = ['size: XS', 'size: S', 'size: M', 'size: L', 'size: XL', 'size: XXL'];
  const currentLabels = pr.labels.map((l) => l.name);

  for (const label of sizeLabels) {
    if (currentLabels.includes(label)) {
      await removeLabelFromPR(client, owner, repo, number, label);
    }
  }

  // Add new size label
  await addLabelsToPR(client, owner, repo, number, [`size: ${size.toUpperCase()}`]);

  return client.getPullRequest(owner, repo, number);
}

/**
 * Generate PR description template
 *
 * @param pr - Pull request
 * @returns PR description template
 */
export function generatePRDescriptionTemplate(pr: GitHubPullRequest): string {
  const size = getPRSize(pr);

  return `## Summary
<!-- Describe the changes in this PR -->


## Changes
<!-- List the main changes -->


## Type of Change
<!-- Mark the relevant option with an 'x' -->
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
<!-- Describe testing performed -->


## Checklist
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No merge conflicts

## Size
Size: ${size.toUpperCase()} (+${pr.additions}, -${pr.deletions})
`;
}
