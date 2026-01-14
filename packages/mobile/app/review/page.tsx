/**
 * Code Review Page
 *
 * Review pull requests on mobile.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter } from 'lucide-react';
import { TopNav } from '@/components/ui/BottomNav';
import { PullRequestCard, PullRequestList } from '@/components/review/PullRequestCard';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api/client';

export default function ReviewPage() {
  const router = useRouter();
  const [pullRequests, setPullRequests] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    async function loadPullRequests() {
      try {
        const data = await api.getPullRequests();
        setPullRequests(data);
      } catch (error) {
        console.error('Failed to load PRs:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPullRequests();
  }, []);

  const filteredPRs = pullRequests.filter((pr) =>
    pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPullRequests();
      setPullRequests(data);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async (prId: string, decision: 'approve' | 'request_changes' | 'comment') => {
    try {
      await api.reviewPullRequest(prId);
      // Refresh list
      const data = await api.getPullRequests();
      setPullRequests(data);
    } catch (error) {
      console.error('Failed to review:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <TopNav
        title="Pull Requests"
        onBack={() => router.back()}
        actions={
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <Filter className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        }
      />

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b dark:bg-gray-900 dark:border-gray-800">
        <Input
          placeholder="Search pull requests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-5 h-5 text-gray-400" />}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {['All', 'Open', 'Needs Review', 'Approved'].map((filter) => (
          <button
            key={filter}
            className="px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-medium whitespace-nowrap active:scale-95 transition-transform dark:bg-gray-900 dark:border-gray-800"
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Pull Requests List */}
      <PullRequestList
        pullRequests={filteredPRs.map((pr) => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          author: pr.author,
          status: pr.status,
          branch: pr.branch,
          baseBranch: pr.baseBranch,
          additions: pr.additions,
          deletions: pr.deletions,
          comments: pr.commentCount,
          createdAt: pr.createdAt,
          onPress: () => router.push(`/review/${pr.id}`),
          onReview: (decision) => handleReview(pr.id, decision),
        }))}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        emptyMessage={searchQuery ? 'No PRs match your search' : 'No pull requests'}
      />
    </div>
  );
}
