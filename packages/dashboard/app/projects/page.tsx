/**
 * Projects page - list and manage projects
 */

'use client';

import * as React from 'react';
import { Plus, Search, Filter, MoreHorizontal, FolderKanban, Clock, DollarSign } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { useDashboardStore } from '@/lib/store';
import { formatDate, formatCurrency, formatRelativeTime } from '@/lib/utils';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const { setProjects, setCurrentProject } = useDashboardStore();
  const [projects, setLocalProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'name' | 'updatedAt' | 'createdAt'>('updatedAt');
  const [filterBy, setFilterBy] = React.useState<'all' | 'active' | 'archived'>('all');

  React.useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProjects();
      if (response.success) {
        setLocalProjects(response.data);
        setProjects(response.data);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = React.useMemo(() => {
    return projects
      .filter((project) => {
        const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase()) ||
          project.description.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filterBy === 'all' ||
          (filterBy === 'active' && !project.name.startsWith('[Archived]')) ||
          (filterBy === 'archived' && project.name.startsWith('[Archived]'));
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'updatedAt') return b.updatedAt - a.updatedAt;
        return b.createdAt - a.createdAt;
      });
  }, [projects, search, sortBy, filterBy]);

  const handleCreateProject = () => {
    // TODO: Open create project modal
    console.log('Create project');
  };

  const handleProjectClick = (project: Project) => {
    setCurrentProject(project);
    window.location.href = `/projects/${project.id}`;
  };

  if (loading) {
    return (
      <MainLayout title="Projects">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading projects...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Projects"
      actions={
        <Button onClick={handleCreateProject}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">Recently Updated</SelectItem>
              <SelectItem value="createdAt">Recently Created</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects found</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                {search ? 'Try adjusting your search or filters' : 'Create your first project to get started'}
              </p>
              {!search && (
                <Button onClick={handleCreateProject}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => handleProjectClick(project)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {project.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Open menu
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="mr-2 h-4 w-4" />
                      Updated {formatRelativeTime(project.updatedAt)}
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <DollarSign className="mr-2 h-4 w-4" />
                      {formatCurrency(project.stats.totalCost)} total cost
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                  <div className="flex items-center justify-between w-full">
                    <span>{project.members.length} members</span>
                    <span>{project.stats.totalRequests} requests</span>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
