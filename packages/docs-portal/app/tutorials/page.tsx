// @ts-nocheck
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Clock, User, PlayCircle, BookOpen, Code, Filter, Search } from 'lucide-react';
import { cn, formatDate, calculateReadingTime } from '@/lib/utils';
import { CodePlayground, PresetGrid } from '@/components/playground/CodePlayground';
import { beginnerTutorials, advancedTutorials, videoTutorials, interactiveExamples, tutorialCategories } from '@/lib/tutorials-data';

// ============================================================================
// Tutorials Page Component
// ============================================================================

export default function TutorialsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const allTutorials = [...beginnerTutorials, ...advancedTutorials];

  const filteredTutorials = allTutorials.filter((tutorial) => {
    const matchesCategory = selectedCategory === 'all' || tutorial.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || tutorial.difficulty === selectedDifficulty;
    const matchesSearch =
      !searchQuery ||
      tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesDifficulty && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Tutorials</h1>
        <p className="text-xl text-muted-foreground">
          Learn ClaudeFlare through interactive tutorials, videos, and examples
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="p-6 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="text-3xl font-bold text-primary mb-1">50+</div>
          <div className="text-sm text-muted-foreground">Tutorials</div>
        </div>
        <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-lg">
          <div className="text-3xl font-bold text-green-500 mb-1">15</div>
          <div className="text-sm text-muted-foreground">Video Tutorials</div>
        </div>
        <div className="p-6 bg-purple-500/5 border border-purple-500/20 rounded-lg">
          <div className="text-3xl font-bold text-purple-500 mb-1">20+</div>
          <div className="text-sm text-muted-foreground">Interactive Examples</div>
        </div>
        <div className="p-6 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
          <div className="text-3xl font-bold text-yellow-500 mb-1">5+</div>
          <div className="text-sm text-muted-foreground">Hours of Content</div>
        </div>
      </div>

      {/* Learning Paths */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Learning Paths</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Beginner Path */}
          <Link
            href="/docs/tutorials/beginner-path"
            className="group p-6 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  Beginner Path
                </h3>
                <p className="text-muted-foreground text-sm">
                  Start your journey with ClaudeFlare from scratch
                </p>
              </div>
              <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>~90 minutes</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                <span>6 tutorials</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 border-2 border-background flex items-center justify-center text-xs font-medium"
                  >
                    {i}
                  </div>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Start learning</span>
            </div>
          </Link>

          {/* Advanced Path */}
          <Link
            href="/docs/tutorials/advanced-path"
            className="group p-6 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  Advanced Path
                </h3>
                <p className="text-muted-foreground text-sm">
                  Master advanced concepts and production deployment
                </p>
              </div>
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                <Zap className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>~120 minutes</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                <span>5 tutorials</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-background flex items-center justify-center text-xs font-medium"
                  >
                    {i}
                  </div>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Continue learning</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tutorials..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Categories</option>
            {tutorialCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'grid' ? 'bg-muted' : 'hover:bg-muted/50'
              )}
            >
              <GridIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'list' ? 'bg-muted' : 'hover:bg-muted/50'
              )}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tutorials Grid/List */}
      {filteredTutorials.length > 0 ? (
        <div
          className={cn(
            'gap-6',
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'flex flex-col'
          )}
        >
          {filteredTutorials.map((tutorial) => (
            <Link
              key={tutorial.slug}
              href={`/docs/tutorials/${tutorial.slug}`}
              className={cn(
                'group border border-border rounded-lg p-6 hover:border-primary/50 hover:shadow-lg transition-all',
                viewMode === 'list' && 'flex items-center gap-6'
              )}
            >
              {viewMode === 'grid' ? (
                <>
                  {/* Type Badge */}
                  <div className="mb-4">
                    <span
                      className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        tutorial.type === 'video'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-blue-500/10 text-blue-500'
                      )}
                    >
                      {tutorial.type === 'video' ? 'Video' : 'Written'}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                    {tutorial.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {tutorial.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tutorial.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{tutorial.estimatedTime} min</span>
                      </div>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs',
                          tutorial.difficulty === 'beginner' && 'bg-green-500/10 text-green-500',
                          tutorial.difficulty === 'intermediate' &&
                            'bg-yellow-500/10 text-yellow-500',
                          tutorial.difficulty === 'advanced' && 'bg-red-500/10 text-red-500'
                        )}
                      >
                        {tutorial.difficulty}
                      </span>
                    </div>
                    <PlayCircle className="w-4 h-4 group-hover:text-primary transition-colors" />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                      {tutorial.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {tutorial.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{tutorial.estimatedTime} min</span>
                    </div>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-xs',
                        tutorial.difficulty === 'beginner' && 'bg-green-500/10 text-green-500',
                        tutorial.difficulty === 'intermediate' && 'bg-yellow-500/10 text-yellow-500',
                        tutorial.difficulty === 'advanced' && 'bg-red-500/10 text-red-500'
                      )}
                    >
                      {tutorial.difficulty}
                    </span>
                  </div>
                </>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No tutorials found</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or search query
          </p>
        </div>
      )}

      {/* Video Tutorials Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-semibold mb-6">Video Tutorials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videoTutorials.map((video) => (
            <Link
              key={video.id}
              href={`/docs/tutorials/videos/${video.id}`}
              className="group"
            >
              <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                  <PlayCircle className="w-12 h-12 text-primary" />
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                  {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                </div>
              </div>
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                {video.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {video.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Interactive Playground Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-semibold mb-6">Interactive Examples</h2>
        <div className="p-6 bg-primary/5 border border-primary/20 rounded-lg mb-6">
          <p className="text-muted-foreground mb-4">
            Try out ClaudeFlare directly in your browser with our interactive code playground.
          </p>
          <div className="flex gap-3">
            <Link
              href="/playground"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Open Playground
            </Link>
            <Link
              href="/docs/tutorials/interactive"
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              View All Examples
            </Link>
          </div>
        </div>

        <CodePlayground
          presets={interactiveExamples.map((example) => ({
            id: example.id,
            name: example.title,
            description: example.description,
            category: example.category,
            code: example.template,
            language: 'javascript',
            tags: [],
          }))}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Icon Components
// ============================================================================

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

function Zap({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
