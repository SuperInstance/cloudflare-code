/**
 * Unit Tests for PR Automation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PRAutomation, createPRAutomation } from '../../src/pr/automation';
import { GitHubClient } from '../../src/client/client';
import { PullRequestState, PullRequestMergeMethod } from '../../src/types';

describe('PRAutomation', () => {
  let automation: PRAutomation;
  let mockClient: GitHubClient;

  beforeEach(() => {
    mockClient = {
      getPullRequest: vi.fn(),
      createPullRequest: vi.fn(),
      updatePullRequest: vi.fn(),
      mergePullRequest: vi.fn(),
      getRepository: vi.fn(),
      deleteBranch: vi.fn(),
      octokit: {
        rest: {
          pulls: {
            createReview: vi.fn(),
            requestReviewers: vi.fn(),
            createComment: vi.fn()
          },
          issues: {
            addLabels: vi.fn(),
            addAssignees: vi.fn()
          }
        }
      }
    } as unknown as GitHubClient;

    automation = createPRAutomation(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PR Creation', () => {
    it('should create a pull request', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        title: 'Test PR',
        state: PullRequestState.Open,
        head: { ref: 'feature-branch' },
        base: { ref: 'main' },
        mergeable: true
      };

      vi.mocked(mockClient.createPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient.getRepository).mockResolvedValue({
        archived: false,
        locked: false
      } as any);

      const pr = await automation.createPullRequest('octocat', 'Hello-World', {
        title: 'Test PR',
        head: 'feature-branch',
        base: 'main'
      });

      expect(pr).toBeDefined();
      expect(mockClient.createPullRequest).toHaveBeenCalledWith(
        'octocat',
        'Hello-World',
        expect.objectContaining({
          title: 'Test PR',
          head: 'feature-branch',
          base: 'main'
        })
      );
    });

    it('should create PR with labels', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        title: 'Test PR',
        state: PullRequestState.Open,
        labels: []
      };

      vi.mocked(mockClient.createPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient.getRepository).mockResolvedValue({
        archived: false,
        locked: false
      } as any);

      await automation.createPullRequest('octocat', 'Hello-World', {
        title: 'Test PR',
        head: 'feature-branch',
        base: 'main',
        labels: ['bug', 'enhancement']
      });

      expect(mockClient['octokit'].rest.issues.addLabels).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: ['bug', 'enhancement']
        })
      );
    });

    it('should create PR with assignees', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        title: 'Test PR',
        state: PullRequestState.Open,
        assignees: []
      };

      vi.mocked(mockClient.createPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient.getRepository).mockResolvedValue({
        archived: false,
        locked: false
      } as any);

      await automation.createPullRequest('octocat', 'Hello-World', {
        title: 'Test PR',
        head: 'feature-branch',
        base: 'main',
        assignees: ['octocat', 'devin']
      });

      expect(mockClient['octokit'].rest.issues.addAssignees).toHaveBeenCalled();
    });

    it('should create PR from template', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        title: 'Feature: New functionality',
        state: PullRequestState.Open
      };

      vi.mocked(mockClient.createPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient.getRepository).mockResolvedValue({
        archived: false,
        locked: false
      } as any);

      const pr = await automation.createPullRequestFromTemplate(
        'octocat',
        'Hello-World',
        {
          title: 'Feature: {{featureName}}',
          body: 'This PR adds {{featureName}}',
          labels: ['enhancement']
        },
        'feature-branch',
        'main',
        { featureName: 'new functionality' }
      );

      expect(pr.title).toBe('Feature: new functionality');
    });

    it('should throw error for archived repository', async () => {
      vi.mocked(mockClient.getRepository).mockResolvedValue({
        archived: true
      } as any);

      await expect(
        automation.createPullRequest('octocat', 'Hello-World', {
          title: 'Test PR',
          head: 'feature-branch',
          base: 'main'
        })
      ).rejects.toThrow();
    });
  });

  describe('PR Updates', () => {
    it('should update pull request', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        title: 'Updated Title',
        state: PullRequestState.Open
      };

      vi.mocked(mockClient.getPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient.updatePullRequest).mockResolvedValue(mockPR as any);

      const pr = await automation.updatePullRequest('octocat', 'Hello-World', 1, {
        title: 'Updated Title'
      });

      expect(pr.title).toBe('Updated Title');
    });

    it('should set labels', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        labels: [{ name: 'bug' }, { name: 'enhancement' }]
      };

      vi.mocked(mockClient.getPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient['octokit'].rest.issues.addLabels).mockResolvedValue({ data: [] } as any);
      vi.mocked(mockClient['octokit'].rest.issues.removeLabel).mockResolvedValue({} as any);

      const labels = await automation.setLabels('octocat', 'Hello-World', 1, ['bug', 'enhancement']);

      expect(Array.isArray(labels)).toBe(true);
    });

    it('should add assignees', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        assignees: [{ login: 'octocat' }]
      };

      vi.mocked(mockClient.getPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient['octokit'].rest.issues.addAssignees).mockResolvedValue({} as any);

      await automation.addAssignees('octocat', 'Hello-World', 1, ['devin']);

      expect(mockClient['octokit'].rest.issues.addAssignees).toHaveBeenCalled();
    });
  });

  describe('PR Merging', () => {
    it('should merge pull request', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        mergeable: true,
        merged: false,
        state: PullRequestState.Open,
        draft: false
      };

      const mockCommit = {
        id: 'abc123',
        message: 'Merge PR #1'
      };

      vi.mocked(mockClient.getPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient.mergePullRequest).mockResolvedValue(mockCommit as any);

      const commit = await automation.mergePullRequest('octocat', 'Hello-World', 1);

      expect(commit).toBeDefined();
      expect(mockClient.mergePullRequest).toHaveBeenCalled();
    });

    it('should auto-merge PR with rules', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        mergeable: true,
        merged: false,
        state: PullRequestState.Open,
        draft: false,
        head: { sha: 'abc123', ref: 'feature' },
        base: { ref: 'main' }
      };

      const mockCommit = {
        id: 'abc123',
        message: 'Merge PR #1'
      };

      vi.mocked(mockClient.getPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient.mergePullRequest).mockResolvedValue(mockCommit as any);
      vi.mocked(mockClient['octokit'].rest.pulls.listReviews).mockResolvedValue({ data: [] } as any);
      vi.mocked(mockClient['octokit'].rest.repos.getCombinedStatusForRef).mockResolvedValue({
        data: { statuses: [] }
      } as any);

      const commit = await automation.autoMergePullRequest('octocat', 'Hello-World', 1, {
        requiredApprovingReviewCount: 0,
        autoMergeMethod: PullRequestMergeMethod.Merge
      });

      expect(commit).toBeDefined();
    });

    it('should throw error for unmergeable PR', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        mergeable: false,
        mergeable_state: 'dirty',
        state: PullRequestState.Open
      };

      vi.mocked(mockClient.getPullRequest).mockResolvedValue(mockPR as any);

      await expect(
        automation.mergePullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow();
    });
  });

  describe('PR Reviews', () => {
    it('should create review', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        state: PullRequestState.Open
      };

      vi.mocked(mockClient['octokit'].rest.pulls.createReview).mockResolvedValue({ data: {} } as any);
      vi.mocked(mockClient.getPullRequest).mockResolvedValue(mockPR as any);

      const pr = await automation.createReview('octocat', 'Hello-World', 1, {
        event: 'APPROVED',
        body: 'Looks good!'
      });

      expect(pr).toBeDefined();
    });

    it('should request reviewers', async () => {
      vi.mocked(mockClient['octokit'].rest.pulls.requestReviewers).mockResolvedValue({ data: {} } as any);

      await automation.requestReviewers('octocat', 'Hello-World', 1, {
        reviewers: ['octocat', 'devin']
      });

      expect(mockClient['octokit'].rest.pulls.requestReviewers).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewers: ['octocat', 'devin']
        })
      );
    });

    it('should list reviews', async () => {
      const mockReviews = [
        {
          id: 1,
          user: { login: 'octocat' },
          state: 'APPROVED',
          body: 'LGTM!'
        }
      ];

      vi.mocked(mockClient['octokit'].rest.pulls.listReviews).mockResolvedValue({
        data: mockReviews
      } as any);

      const reviews = await automation.listReviews('octocat', 'Hello-World', 1);

      expect(Array.isArray(reviews)).toBe(true);
      expect(reviews.length).toBeGreaterThan(0);
    });
  });

  describe('PR Comments', () => {
    it('should create comment', async () => {
      const mockComment = {
        id: 1,
        body: 'Test comment',
        user: { login: 'octocat' }
      };

      vi.mocked(mockClient['octokit'].rest.issues.createComment).mockResolvedValue({
        data: mockComment
      } as any);

      const comment = await automation.createComment('octocat', 'Hello-World', 1, 'Test comment');

      expect(comment).toBeDefined();
    });

    it('should update comment', async () => {
      const mockComment = {
        id: 1,
        body: 'Updated comment'
      };

      vi.mocked(mockClient['octokit'].rest.issues.updateComment).mockResolvedValue({
        data: mockComment
      } as any);

      const comment = await automation.updateComment('octocat', 'Hello-World', 1, 'Updated comment');

      expect(comment.body).toBe('Updated comment');
    });

    it('should delete comment', async () => {
      vi.mocked(mockClient['octokit'].rest.issues.deleteComment).mockResolvedValue({} as any);

      await automation.deleteComment('octocat', 'Hello-World', 1);

      expect(mockClient['octokit'].rest.issues.deleteComment).toHaveBeenCalled();
    });

    it('should list comments', async () => {
      const mockComments = [
        { id: 1, body: 'Comment 1' },
        { id: 2, body: 'Comment 2' }
      ];

      vi.mocked(mockClient['octokit'].rest.issues.listComments).mockResolvedValue({
        data: mockComments
      } as any);

      const comments = await automation.listComments('octocat', 'Hello-World', 1);

      expect(Array.isArray(comments)).toBe(true);
      expect(comments.length).toBe(2);
    });
  });

  describe('PR Status Checks', () => {
    it('should create status check', async () => {
      const mockStatus = {
        id: 1,
        context: 'ci/test',
        state: 'success'
      };

      vi.mocked(mockClient['octokit'].rest.repos.createCommitStatus).mockResolvedValue({
        data: mockStatus
      } as any);

      const status = await automation.createStatusCheck('octocat', 'Hello-World', 'abc123', {
        context: 'ci/test',
        state: 'success',
        description: 'Tests passed'
      });

      expect(status).toBeDefined();
    });

    it('should get status checks', async () => {
      const mockStatuses = [
        { id: 1, context: 'ci/test', state: 'success' },
        { id: 2, context: 'ci/lint', state: 'failure' }
      ];

      vi.mocked(mockClient['octokit'].rest.repos.listCommitStatusesForRef).mockResolvedValue({
        data: mockStatuses
      } as any);

      const statuses = await automation.getStatusChecks('octocat', 'Hello-World', 'abc123');

      expect(Array.isArray(statuses)).toBe(true);
    });

    it('should get combined status', async () => {
      const mockCombinedStatus = {
        state: 'success',
        statuses: []
      };

      vi.mocked(mockClient['octokit'].rest.repos.getCombinedStatusForRef).mockResolvedValue({
        data: mockCombinedStatus
      } as any);

      const status = await automation.getCombinedStatus('octocat', 'Hello-World', 'abc123');

      expect(status).toBeDefined();
    });
  });

  describe('PR Utilities', () => {
    it('should get PR', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        title: 'Test PR',
        state: PullRequestState.Open
      };

      vi.mocked(mockClient.getPullRequest).mockResolvedValue(mockPR as any);

      const pr = await automation.getPullRequest('octocat', 'Hello-World', 1);

      expect(pr).toBeDefined();
      expect(pr.number).toBe(1);
    });

    it('should list PRs', async () => {
      const mockPRs = [
        { id: 1, number: 1, state: PullRequestState.Open },
        { id: 2, number: 2, state: PullRequestState.Open }
      ];

      vi.mocked(mockClient['octokit'].rest.pulls.list).mockResolvedValue({
        data: mockPRs
      } as any);

      const prs = await automation.listPullRequests('octocat', 'Hello-World');

      expect(Array.isArray(prs)).toBe(true);
      expect(prs.length).toBe(2);
    });

    it('should get PR diff', async () => {
      const mockPR = {
        id: 1,
        number: 1,
        diff_url: 'https://api.github.com/repos/octocat/Hello-World/pulls/1'
      };

      vi.mocked(mockClient.getPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockClient['octokit'].request).mockResolvedValue({
        data: 'diff content'
      } as any);

      const diff = await automation.getDiff('octocat', 'Hello-World', 1);

      expect(diff).toBeDefined();
    });

    it('should get PR commits', async () => {
      const mockCommits = [
        { id: 'abc123', message: 'Commit 1' },
        { id: 'def456', message: 'Commit 2' }
      ];

      vi.mocked(mockClient['octokit'].rest.pulls.listCommits).mockResolvedValue({
        data: mockCommits
      } as any);

      const commits = await automation.getCommits('octocat', 'Hello-World', 1);

      expect(Array.isArray(commits)).toBe(true);
      expect(commits.length).toBe(2);
    });

    it('should get PR files', async () => {
      const mockFiles = [
        { filename: 'src/index.ts', additions: 10, deletions: 5 },
        { filename: 'README.md', additions: 2, deletions: 0 }
      ];

      vi.mocked(mockClient['octokit'].rest.pulls.listFiles).mockResolvedValue({
        data: mockFiles
      } as any);

      const files = await automation.getFiles('octocat', 'Hello-World', 1);

      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBe(2);
    });
  });
});

describe('createPRAutomation', () => {
  it('should create PR automation instance', () => {
    const mockClient = {} as GitHubClient;
    const automation = createPRAutomation(mockClient);

    expect(automation).toBeInstanceOf(PRAutomation);
  });
});
