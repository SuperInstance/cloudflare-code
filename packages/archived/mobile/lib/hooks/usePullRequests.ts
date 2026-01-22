/**
 * Pull Requests Hook
 *
 * Custom hook for managing pull requests and code reviews.
 */

// @ts-nocheck - External React/Next.js dependencies
import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  status: 'open' | 'closed' | 'merged' | 'draft';
  branch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  comments: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewComment {
  id: string;
  pullRequestId: string;
  file: string;
  line: number;
  content: string;
  author: string;
  createdAt: Date;
}

export function usePullRequests(filters?: {
  status?: string;
  author?: string;
}) {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadPullRequests() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await api.getPullRequests();

        let filtered = data;

        if (filters?.status) {
          filtered = filtered.filter((pr: PullRequest) => pr.status === filters.status);
        }

        if (filters?.author) {
          filtered = filtered.filter((pr: PullRequest) =>
            pr.author.toLowerCase().includes(filters.author!.toLowerCase())
          );
        }

        setPullRequests(filtered);
      } catch (err) {
        console.error('Failed to load PRs:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPullRequests();
  }, [filters]);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getPullRequests();
      setPullRequests(data);
    } catch (err) {
      console.error('Failed to refresh PRs:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reviewPullRequest = useCallback(
    async (id: string, decision: 'approve' | 'request_changes' | 'comment') => {
      try {
        await api.reviewPullRequest(id);

        // Update local state
        setPullRequests((prev) =>
          prev.map((pr) =>
            pr.id === id
              ? {
                  ...pr,
                  status: decision === 'approve' ? 'merged' : pr.status,
                }
              : pr
          )
        );

        return true;
      } catch (err) {
        console.error('Failed to review PR:', err);
        setError(err as Error);
        return false;
      }
    },
    []
  );

  const addComment = useCallback(
    async (prId: string, file: string, line: number, comment: string) => {
      try {
        await api.addComment(prId, file, line, comment);

        // Update local state
        setPullRequests((prev) =>
          prev.map((pr) =>
            pr.id === prId
              ? {
                  ...pr,
                  comments: pr.comments + 1,
                }
              : pr
          )
        );

        return true;
      } catch (err) {
        console.error('Failed to add comment:', err);
        setError(err as Error);
        return false;
      }
    },
    []
  );

  return {
    pullRequests,
    isLoading,
    error,
    refresh,
    reviewPullRequest,
    addComment,
  };
}

/**
 * Hook for a single pull request
 */
export function usePullRequest(id: string) {
  const [pullRequest, setPullRequest] = useState<PullRequest | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadPullRequest() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await api.getPullRequest(id);
        setPullRequest(data);

        // Load comments
        const commentsData = await api.get(`/review/pull-requests/${id}/comments`);
        setComments(commentsData);
      } catch (err) {
        console.error('Failed to load PR:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPullRequest();
  }, [id]);

  const review = useCallback(
    async (decision: 'approve' | 'request_changes' | 'comment') => {
      if (!pullRequest) return false;

      try {
        await api.reviewPullRequest(pullRequest.id, decision);

        setPullRequest((prev) =>
          prev
            ? {
                ...prev,
                status: decision === 'approve' ? 'merged' : prev.status,
              }
            : null
        );

        return true;
      } catch (err) {
        console.error('Failed to review:', err);
        setError(err as Error);
        return false;
      }
    },
    [pullRequest]
  );

  const addComment = useCallback(
    async (file: string, line: number, content: string) => {
      if (!pullRequest) return false;

      try {
        await api.addComment(pullRequest.id, file, line, content);

        const newComment: ReviewComment = {
          id: Date.now().toString(),
          pullRequestId: pullRequest.id,
          file,
          line,
          content,
          author: 'You',
          createdAt: new Date(),
        };

        setComments((prev) => [...prev, newComment]);
        return true;
      } catch (err) {
        console.error('Failed to add comment:', err);
        setError(err as Error);
        return false;
      }
    },
    [pullRequest]
  );

  return {
    pullRequest,
    comments,
    isLoading,
    error,
    review,
    addComment,
  };
}
