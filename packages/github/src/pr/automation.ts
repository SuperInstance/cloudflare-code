/**
 * Pull Request Automation
 * Comprehensive PR creation, updates, merging, and review automation
 */

import {
  PullRequest,
  PullRequestState,
  PullRequestMergeMethod,
  PullRequestReviewState,
  Repository,
  User,
  Branch,
  Commit,
  Issue,
  Label
} from '../types';

import {
  PullRequestError,
  PullRequestNotFoundError,
  PullRequestMergeError,
  PullRequestConflictError,
  ReviewNotFoundError,
  ProtectedBranchError,
  RepositoryLockedError,
  ArchivedRepositoryError
} from '../errors';

import { GitHubClient } from '../client/client';

// ============================================================================
// PR Creation Options
// ============================================================================

export interface CreatePROptions {
  title: string;
  body?: string;
  head: string;
  base: string;
  draft?: boolean;
  maintainerCanModify?: boolean;
  labels?: string[];
  assignees?: string[];
  reviewers?: string[];
  teamReviewers?: string[];
  milestone?: number;
}

// ============================================================================
// PR Update Options
// ============================================================================

export interface UpdatePROptions {
  title?: string;
  body?: string;
  state?: PullRequestState;
  base?: string;
  maintainerCanModify?: boolean;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

// ============================================================================
// PR Merge Options
// ============================================================================

export interface MergePROptions {
  commitTitle?: string;
  commitMessage?: string;
  mergeMethod?: PullRequestMergeMethod;
  sha?: string;
  expectHeadSha?: string;
}

// ============================================================================
// PR Review Options
// ============================================================================

export interface CreateReviewOptions {
  body?: string;
  event: PullRequestReviewState;
  comments?: ReviewComment[];
}

export interface ReviewComment {
  path: string;
  position: number;
  body: string;
}

export interface UpdateReviewOptions {
  body?: string;
}

// ============================================================================
// PR Comment Options
// ============================================================================

export interface CreateCommentOptions {
  body: string;
  commitId?: string;
  path?: string;
  position?: number;
  inReplyTo?: number;
}

// ============================================================================
// PR Status Check Options
// ============================================================================

export interface StatusCheckOptions {
  context: string;
  state: 'pending' | 'success' | 'error' | 'failure';
  description?: string;
  targetUrl?: string;
}

// ============================================================================
// PR Automation Rules
// ============================================================================

export interface AutomationRules {
  requiredApprovingReviewCount?: number;
  requireCodeOwnerReviews?: boolean;
  dismissStaleReviews?: boolean;
  requireUpToDateBranch?: boolean;
  requiredStatusChecks?: string[];
  restrictReviewers?: boolean;
  allowedReviewers?: string[];
  allowedTeams?: string[];
  autoMerge?: boolean;
  autoMergeMethod?: PullRequestMergeMethod;
  deleteBranchAfterMerge?: boolean;
}

// ============================================================================
// PR Template
// ============================================================================

export interface PRTemplate {
  title?: string;
  body: string;
  labels?: string[];
  assignees?: string[];
  reviewers?: string[];
  milestone?: number;
}

// ============================================================================
// Main PR Automation Class
// ============================================================================

export class PRAutomation {
  private client: GitHubClient;

  constructor(client: GitHubClient) {
    this.client = client;
  }

  // ============================================================================
  // PR Creation
  // ============================================================================

  async createPullRequest(
    owner: string,
    repo: string,
    options: CreatePROptions
  ): Promise<PullRequest> {
    const repository = await this.client.getRepository(owner, repo);

    if (repository.archived) {
      throw new ArchivedRepositoryError(`${owner}/${repo}`);
    }

    if (repository.locked) {
      throw new RepositoryLockedError(`${owner}/${repo}`);
    }

    const pr = await this.client.createPullRequest(owner, repo, {
      title: options.title,
      body: options.body,
      head: options.head,
      base: options.base,
      draft: options.draft || false,
      maintainerCanModify: options.maintainerCanModify
    });

    if (options.labels && options.labels.length > 0) {
      await this.addLabels(owner, repo, pr.number, options.labels);
    }

    if (options.assignees && options.assignees.length > 0) {
      await this.addAssignees(owner, repo, pr.number, options.assignees);
    }

    if (options.reviewers && options.reviewers.length > 0) {
      await this.requestReviewers(owner, repo, pr.number, {
        reviewers: options.reviewers,
        teamReviewers: options.teamReviewers
      });
    }

    if (options.milestone) {
      await this.updatePullRequest(owner, repo, pr.number, {
        milestone: options.milestone
      });
    }

    return pr;
  }

  async createPullRequestFromTemplate(
    owner: string,
    repo: string,
    template: PRTemplate,
    head: string,
    base: string,
    variables?: Record<string, string>
  ): Promise<PullRequest> {
    let body = template.body;

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }

    return this.createPullRequest(owner, repo, {
      title: template.title || 'Pull Request',
      body,
      head,
      base,
      labels: template.labels,
      assignees: template.assignees,
      reviewers: template.reviewers,
      milestone: template.milestone
    });
  }

  // ============================================================================
  // PR Updates
  // ============================================================================

  async updatePullRequest(
    owner: string,
    repo: string,
    number: number,
    options: UpdatePROptions
  ): Promise<PullRequest> {
    const pr = await this.getPullRequest(owner, repo, number);

    if (options.labels) {
      await this.setLabels(owner, repo, number, options.labels);
    }

    if (options.assignees) {
      await this.setAssignees(owner, repo, number, options.assignees);
    }

    return this.client.updatePullRequest(owner, repo, number, {
      title: options.title,
      body: options.body,
      state: options.state,
      base: options.base,
      maintainerCanModify: options.maintainerCanModify
    });
  }

  async convertToDraft(owner: string, repo: string, number: number): Promise<PullRequest> {
    return this.client.updatePullRequest(owner, repo, number, {
      draft: true
    }) as Promise<PullRequest>;
  }

  async markAsReady(owner: string, repo: string, number: number): Promise<PullRequest> {
    return this.client.updatePullRequest(owner, repo, number, {
      draft: false
    }) as Promise<PullRequest>;
  }

  // ============================================================================
  // PR Merging
  // ============================================================================

  async mergePullRequest(
    owner: string,
    repo: string,
    number: number,
    options?: MergePROptions
  ): Promise<Commit> {
    const pr = await this.getPullRequest(owner, repo, number);

    if (pr.state === PullRequestState.Closed) {
      throw new PullRequestMergeError(
        number,
        'Pull request is already closed',
        pr.mergeable || false,
        pr.mergeable_state || ''
      );
    }

    if (pr.merged) {
      throw new PullRequestMergeError(
        number,
        'Pull request is already merged',
        pr.mergeable || false,
        pr.mergeable_state || ''
      );
    }

    if (pr.mergeable === false) {
      throw new PullRequestConflictError(number);
    }

    if (pr.draft) {
      await this.markAsReady(owner, repo, number);
    }

    try {
      const result = await this.client.mergePullRequest(owner, repo, number, {
        commitTitle: options?.commitTitle,
        commitMessage: options?.commitMessage,
        mergeMethod: options?.mergeMethod || PullRequestMergeMethod.Merge,
        sha: options?.sha
      });

      return result;
    } catch (error) {
      throw new PullRequestMergeError(
        number,
        error instanceof Error ? error.message : 'Unknown merge error',
        pr.mergeable || false,
        pr.mergeable_state || ''
      );
    }
  }

  async autoMergePullRequest(
    owner: string,
    repo: string,
    number: number,
    rules: AutomationRules
  ): Promise<Commit> {
    const pr = await this.getPullRequest(owner, repo, number);

    await this.validatePRForAutoMerge(pr, rules);

    if (!pr.mergeable) {
      await this.updatePullRequest(owner, repo, number, {});
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.autoMergePullRequest(owner, repo, number, rules);
    }

    const result = await this.mergePullRequest(owner, repo, number, {
      mergeMethod: rules.autoMergeMethod || PullRequestMergeMethod.Merge
    });

    if (rules.deleteBranchAfterMerge) {
      await this.deleteBranch(owner, repo, pr.head.ref);
    }

    return result;
  }

  private async validatePRForAutoMerge(
    pr: PullRequest,
    rules: AutomationRules
  ): Promise<void> {
    if (!pr.mergeable) {
      throw new PullRequestMergeError(
        pr.number,
        'Pull request is not mergeable',
        pr.mergeable,
        pr.mergeable_state
      );
    }

    const reviews = await this.listReviews(pr.repository.owner.login, pr.repository.name, pr.number);

    const approvalCount = reviews.filter(
      r => r.state === PullRequestReviewState.Approved
    ).length;

    if (rules.requiredApprovingReviewCount && approvalCount < rules.requiredApprovingReviewCount) {
      throw new PullRequestMergeError(
        pr.number,
        `Insufficient approvals. Required: ${rules.requiredApprovingReviewCount}, Got: ${approvalCount}`,
        pr.mergeable,
        pr.mergeable_state
      );
    }

    if (rules.requiredStatusChecks && rules.requiredStatusChecks.length > 0) {
      const combinedStatus = await this.getCombinedStatus(
        pr.repository.owner.login,
        pr.repository.name,
        pr.head.sha
      );

      for (const check of rules.requiredStatusChecks) {
        const status = combinedStatus.statuses.find(s => s.context === check);
        if (!status || status.state !== 'success') {
          throw new PullRequestMergeError(
            pr.number,
            `Required status check "${check}" is not passing`,
            pr.mergeable,
            pr.mergeable_state
          );
        }
      }
    }

    if (rules.requireUpToDateBranch) {
      await this.ensureBranchUpToDate(
        pr.repository.owner.login,
        pr.repository.name,
        pr.head.ref,
        pr.base.ref
      );
    }
  }

  // ============================================================================
  // PR Reviews
  // ============================================================================

  async createReview(
    owner: string,
    repo: string,
    number: number,
    options: CreateReviewOptions
  ): Promise<PullRequest> {
    const response = await this.client['octokit'].rest.pulls.createReview({
      owner,
      repo,
      pull_number: number,
      event: options.event,
      body: options.body,
      comments: options.comments
    });

    return this.getPullRequest(owner, repo, number);
  }

  async submitReview(
    owner: string,
    repo: string,
    number: number,
    reviewId: number,
    event: PullRequestReviewState,
    body?: string
  ): Promise<void> {
    await this.client['octokit'].rest.pulls.submitReview({
      owner,
      repo,
      pull_number: number,
      review_id: reviewId,
      event,
      body
    });
  }

  async updateReview(
    owner: string,
    repo: string,
    number: number,
    reviewId: number,
    options: UpdateReviewOptions
  ): Promise<void> {
    await this.client['octokit'].rest.pulls.updateReview({
      owner,
      repo,
      pull_number: number,
      review_id: reviewId,
      body: options.body
    });
  }

  async dismissReview(
    owner: string,
    repo: string,
    number: number,
    reviewId: number,
    message?: string
  ): Promise<void> {
    await this.client['octokit'].rest.pulls.dismissReview({
      owner,
      repo,
      pull_number: number,
      review_id: reviewId,
      message
    });
  }

  async deleteReview(
    owner: string,
    repo: string,
    number: number,
    reviewId: number
  ): Promise<void> {
    await this.client['octokit'].rest.pulls.deletePendingReview({
      owner,
      repo,
      pull_number: number,
      review_id: reviewId
    });
  }

  async listReviews(
    owner: string,
    repo: string,
    number: number
  ): Promise<any[]> {
    const response = await this.client['octokit'].rest.pulls.listReviews({
      owner,
      repo,
      pull_number: number
    });

    return response.data;
  }

  async requestReviewers(
    owner: string,
    repo: string,
    number: number,
    options: {
      reviewers?: string[];
      teamReviewers?: string[];
    }
  ): Promise<void> {
    await this.client['octokit'].rest.pulls.requestReviewers({
      owner,
      repo,
      pull_number: number,
      reviewers: options.reviewers,
      team_reviewers: options.teamReviewers
    });
  }

  async removeReviewers(
    owner: string,
    repo: string,
    number: number,
    reviewers: string[]
  ): Promise<void> {
    await this.client['octokit'].rest.pulls.removeRequestedReviewers({
      owner,
      repo,
      pull_number: number,
      reviewers
    });
  }

  // ============================================================================
  // PR Comments
  // ============================================================================

  async createComment(
    owner: string,
    repo: string,
    number: number,
    options: CreateCommentOptions
  ): Promise<any> {
    const response = await this.client['octokit'].rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: options.body
    });

    return response.data;
  }

  async createReviewComment(
    owner: string,
    repo: string,
    number: number,
    options: CreateCommentOptions
  ): Promise<any> {
    if (!options.commitId || !options.path || options.position === undefined) {
      throw new PullRequestError('Missing required fields for review comment');
    }

    const response = await this.client['octokit'].rest.pulls.createReviewComment({
      owner,
      repo,
      pull_number: number,
      body: options.body,
      commit_id: options.commitId,
      path: options.path,
      position: options.position,
      in_reply_to: options.inReplyTo
    });

    return response.data;
  }

  async updateComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string
  ): Promise<any> {
    const response = await this.client['octokit'].rest.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body
    });

    return response.data;
  }

  async deleteComment(owner: string, repo: string, commentId: number): Promise<void> {
    await this.client['octokit'].rest.issues.deleteComment({
      owner,
      repo,
      comment_id: commentId
    });
  }

  async listComments(
    owner: string,
    repo: string,
    number: number
  ): Promise<any[]> {
    const response = await this.client['octokit'].rest.issues.listComments({
      owner,
      repo,
      issue_number: number
    });

    return response.data;
  }

  // ============================================================================
  // PR Labels
  // ============================================================================

  async addLabels(
    owner: string,
    repo: string,
    number: number,
    labels: string[]
  ): Promise<Label[]> {
    const response = await this.client['octokit'].rest.issues.addLabels({
      owner,
      repo,
      issue_number: number,
      labels
    });

    return response.data;
  }

  async setLabels(
    owner: string,
    repo: string,
    number: number,
    labels: string[]
  ): Promise<Label[]> {
    const existing = await this.listLabels(owner, repo, number);
    const existingNames = existing.map(l => l.name);

    const toRemove = existingNames.filter(n => !labels.includes(n));
    const toAdd = labels.filter(l => !existingNames.includes(l));

    if (toRemove.length > 0) {
      await this.removeLabels(owner, repo, number, toRemove);
    }

    if (toAdd.length > 0) {
      await this.addLabels(owner, repo, number, toAdd);
    }

    return this.listLabels(owner, repo, number);
  }

  async removeLabel(
    owner: string,
    repo: string,
    number: number,
    name: string
  ): Promise<void> {
    await this.client['octokit'].rest.issues.removeLabel({
      owner,
      repo,
      issue_number: number,
      name
    });
  }

  async removeLabels(
    owner: string,
    repo: string,
    number: number,
    names: string[]
  ): Promise<void> {
    await Promise.all(
      names.map(name => this.removeLabel(owner, repo, number, name))
    );
  }

  async listLabels(
    owner: string,
    repo: string,
    number: number
  ): Promise<Label[]> {
    const pr = await this.getPullRequest(owner, repo, number);
    return pr.labels;
  }

  // ============================================================================
  // PR Assignees
  // ============================================================================

  async addAssignees(
    owner: string,
    repo: string,
    number: number,
    assignees: string[]
  ): Promise<void> {
    const pr = await this.getPullRequest(owner, repo, number);
    const existing = pr.assignees.map(a => a.login);
    const all = [...new Set([...existing, ...assignees])];

    await this.client['octokit'].rest.issues.addAssignees({
      owner,
      repo,
      issue_number: number,
      assignees: all
    });
  }

  async setAssignees(
    owner: string,
    repo: string,
    number: number,
    assignees: string[]
  ): Promise<void> {
    await this.client['octokit'].rest.issues.addAssignees({
      owner,
      repo,
      issue_number: number,
      assignees
    });
  }

  async removeAssignees(
    owner: string,
    repo: string,
    number: number,
    assignees: string[]
  ): Promise<void> {
    const pr = await this.getPullRequest(owner, repo, number);
    const existing = pr.assignees.map(a => a.login);
    const remaining = existing.filter(a => !assignees.includes(a));

    await this.setAssignees(owner, repo, number, remaining);
  }

  // ============================================================================
  // PR Status Checks
  // ============================================================================

  async createStatusCheck(
    owner: string,
    repo: string,
    sha: string,
    options: StatusCheckOptions
  ): Promise<any> {
    const response = await this.client['octokit'].rest.repos.createCommitStatus({
      owner,
      repo,
      sha,
      context: options.context,
      state: options.state,
      description: options.description,
      target_url: options.targetUrl
    });

    return response.data;
  }

  async getStatusChecks(
    owner: string,
    repo: string,
    sha: string
  ): Promise<any[]> {
    const response = await this.client['octokit'].rest.repos.listCommitStatusesForRef({
      owner,
      repo,
      ref: sha
    });

    return response.data;
  }

  async getCombinedStatus(
    owner: string,
    repo: string,
    sha: string
  ): Promise<any> {
    const response = await this.client['octokit'].rest.repos.getCombinedStatusForRef({
      owner,
      repo,
      ref: sha
    });

    return response.data;
  }

  // ============================================================================
  // PR Utilities
  // ============================================================================

  async getPullRequest(
    owner: string,
    repo: string,
    number: number
  ): Promise<PullRequest> {
    return this.client.getPullRequest(owner, repo, number);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all';
      head?: string;
      base?: string;
      sort?: 'created' | 'updated' | 'popularity' | 'long-running';
      direction?: 'asc' | 'desc';
    }
  ): Promise<PullRequest[]> {
    return this.client.listPullRequests(owner, repo, options);
  }

  async getDiff(
    owner: string,
    repo: string,
    number: number
  ): Promise<string> {
    const pr = await this.getPullRequest(owner, repo, number);
    const response = await this.client['octokit'].request('GET ' + pr.diff_url);

    return response.data as string;
  }

  async getPatch(
    owner: string,
    repo: string,
    number: number
  ): Promise<string> {
    const pr = await this.getPullRequest(owner, repo, number);
    const response = await this.client['octokit'].request('GET ' + pr.patch_url);

    return response.data as string;
  }

  async getCommits(
    owner: string,
    repo: string,
    number: number
  ): Promise<Commit[]> {
    const response = await this.client['octokit'].rest.pulls.listCommits({
      owner,
      repo,
      pull_number: number
    });

    return response.data;
  }

  async getFiles(
    owner: string,
    repo: string,
    number: number
  ): Promise<any[]> {
    const response = await this.client['octokit'].rest.pulls.listFiles({
      owner,
      repo,
      pull_number: number
    });

    return response.data;
  }

  // ============================================================================
  // Branch Operations
  // ============================================================================

  private async ensureBranchUpToDate(
    owner: string,
    repo: string,
    head: string,
    base: string
  ): Promise<void> {
    const headBranch = await this.client.getBranch(owner, repo, head);
    const baseBranch = await this.client.getBranch(owner, repo, base);

    if (headBranch.commit.sha !== baseBranch.commit.sha) {
      await this.mergeBranch(owner, repo, head, base);
    }
  }

  private async mergeBranch(
    owner: string,
    repo: string,
    head: string,
    base: string
  ): Promise<void> {
    await this.client['octokit'].rest.repos.merge({
      owner,
      repo,
      head,
      base
    });
  }

  private async deleteBranch(
    owner: string,
    repo: string,
    branch: string
  ): Promise<void> {
    try {
      await this.client.deleteBranch(owner, repo, branch);
    } catch (error) {
      // Branch might already be deleted or protected
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPRAutomation(client: GitHubClient): PRAutomation {
  return new PRAutomation(client);
}
