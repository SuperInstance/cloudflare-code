/**
 * Projects Page
 *
 * View and manage projects.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Filter } from 'lucide-react';
import { TopNav } from '@/components/ui/BottomNav';
import { ProjectCard, ProjectList } from '@/components/project/ProjectCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api/client';
import { formatLanguageName } from '@/lib/utils';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    async function loadProjects() {
      try {
        const data = await api.getProjects();
        setProjects(data);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProjects();
  }, []);

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <TopNav
        title="Projects"
        onBack={() => router.back()}
        actions={
          <button
            onClick={() => router.push('/projects/new')}
            className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b dark:bg-gray-900 dark:border-gray-800">
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-5 h-5 text-gray-400" />}
        />
      </div>

      {/* Projects List */}
      <ProjectList
        projects={filteredProjects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          language: formatLanguageName(project.language),
          lastModified: project.lastModified,
          pullRequests: project.pullRequestCount,
          issues: project.issueCount,
          stars: project.stars,
          onPress: () => router.push(`/projects/${project.id}`),
          actions: [
            {
              label: 'Chat',
              icon: <span className="text-lg">💬</span>,
              onPress: () => router.push(`/chat/new?projectId=${project.id}`),
            },
            {
              label: 'Settings',
              icon: <span className="text-lg">⚙️</span>,
              onPress: () => router.push(`/projects/${project.id}/settings`),
            },
          ],
        }))}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        emptyMessage={searchQuery ? 'No projects match your search' : 'No projects yet'}
      />
    </div>
  );
}
