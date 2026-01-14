'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Video, Code, AlertCircle, BookOpen, ExternalLink } from 'lucide-react';
import { cn, debounce } from '@/lib/utils';
import type { SearchResult, SearchFilters } from '@/types';

// ============================================================================
// Document Icons
// ============================================================================

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'getting-started': BookOpen,
  'api-reference': Code,
  tutorials: Video,
  troubleshooting: AlertCircle,
  guides: FileText,
};

const categoryColors: Record<string, string> = {
  'getting-started': 'text-blue-500 bg-blue-500/10',
  'api-reference': 'text-purple-500 bg-purple-500/10',
  tutorials: 'text-green-500 bg-green-500/10',
  troubleshooting: 'text-red-500 bg-red-500/10',
  guides: 'text-yellow-500 bg-yellow-500/10',
};

// ============================================================================
// Search Input Component
// ============================================================================

interface DocSearchProps {
  onSearch: (query: string, filters?: SearchFilters) => Promise<SearchResult[]>;
  placeholder?: string;
  className?: string;
}

export function DocSearch({ onSearch, placeholder = 'Search documentation...', className }: DocSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filters, setFilters] = useState<SearchFilters>({});

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const debouncedSearch = useRef(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const searchResults = await onSearch(searchQuery, filters);
        setResults(searchResults);
        setShowResults(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300)
  ).current;

  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel();
  }, [query, filters]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          window.location.href = results[selectedIndex].url;
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-500/30 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={searchRef} className={cn('relative w-full max-w-2xl', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-4 py-3 rounded-lg border border-border',
            'bg-background text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'transition-shadow'
          )}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-background border border-border rounded-lg shadow-lg overflow-hidden max-h-[600px] overflow-y-auto">
          {/* Results List */}
          <div className="py-2">
            {results.map((result, index) => {
              const Icon = categoryIcons[result.category] || FileText;

              return (
                <a
                  key={result.id}
                  href={result.url}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
                    selectedIndex === index && 'bg-muted'
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {/* Icon */}
                  <div className={cn('p-2 rounded-lg', categoryColors[result.category])}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">
                      {highlightText(result.title, query)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {highlightText(result.description, query)}
                    </div>

                    {/* Highlights */}
                    {result.highlights && result.highlights.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {result.highlights.slice(0, 2).map((highlight, i) => (
                          <span key={i} className="text-muted-foreground/60">
                            {highlight.fragments[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-xs text-muted-foreground">
                    {Math.round(result.score * 100)}%
                  </div>
                </a>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{results.length} results</span>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">↑↓</kbd>
              <span>to navigate</span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">↵</kbd>
              <span>to select</span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">esc</kbd>
              <span>to close</span>
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {showResults && query && !isSearching && results.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-background border border-border rounded-lg shadow-lg p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <div className="font-medium text-foreground">No results found</div>
          <div className="text-sm text-muted-foreground mt-1">
            Try adjusting your search query or filters
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Advanced Search Component
// ============================================================================

interface AdvancedSearchProps extends DocSearchProps {
  availableCategories?: string[];
  availableTags?: string[];
  availableVersions?: string[];
}

export function AdvancedSearch({
  onSearch,
  availableCategories = [],
  availableTags = [],
  availableVersions = [],
  placeholder = 'Search documentation...',
  className,
}: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (searchQuery: string, searchFilters?: SearchFilters) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await onSearch(searchQuery, searchFilters);
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleFilter = (type: keyof SearchFilters, value: string) => {
    setFilters((prev) => {
      const current = prev[type] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      return { ...prev, [type]: updated.length > 0 ? updated : undefined };
    });
  };

  const activeFilterCount = [
    filters.category?.length || 0,
    filters.tags?.length || 0,
    filters.version ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className={cn('w-full max-w-2xl space-y-4', className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value, filters);
          }}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-24 py-3 rounded-lg border border-border',
            'bg-background text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'transition-shadow'
          )}
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'absolute right-12 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeFilterCount > 0
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
          {/* Categories */}
          {availableCategories.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Categories</label>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => toggleFilter('category', category)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      filters.category?.includes(category)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background border border-border hover:border-primary/50'
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {availableTags.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.slice(0, 10).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleFilter('tags', tag)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm transition-colors',
                      filters.tags?.includes(tag)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background border border-border hover:border-primary/50'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Version */}
          {availableVersions.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Version</label>
              <select
                value={filters.version || ''}
                onChange={(e) =>
                  setFilters({ ...filters, version: e.target.value || undefined })
                }
                className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
              >
                <option value="">All versions</option>
                {availableVersions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters({})}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </div>
          {results.map((result) => (
            <a
              key={result.id}
              href={result.url}
              className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <div className="flex items-start gap-3">
                {React.createElement(categoryIcons[result.category] || FileText, {
                  className: cn('w-5 h-5 flex-shrink-0 mt-0.5', categoryColors[result.category]?.split(' ')[0]),
                })}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{result.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{result.description}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {result.category}
                    </span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Quick Search Component (for command palette)
// ============================================================================

interface QuickSearchProps {
  open: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
}

export function QuickSearch({ open, onClose, onSearch }: QuickSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (query.trim()) {
      onSearch(query).then(setResults);
    } else {
      setResults([]);
    }
  }, [query, onSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        window.location.href = results[selectedIndex].url;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-background border border-border rounded-lg shadow-2xl overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type to search..."
          className="w-full px-4 py-4 text-lg border-b border-border bg-background focus:outline-none"
        />
        <div className="max-h-[400px] overflow-y-auto">
          {results.map((result, index) => (
            <a
              key={result.id}
              href={result.url}
              className={cn(
                'flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
                selectedIndex === index && 'bg-muted'
              )}
            >
              {React.createElement(categoryIcons[result.category] || FileText, {
                className: 'w-5 h-5 text-muted-foreground',
              })}
              <div>
                <div className="font-medium">{result.title}</div>
                <div className="text-sm text-muted-foreground">{result.description}</div>
              </div>
            </a>
          ))}
        </div>
        <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <span>Use ↑↓ to navigate</span>
          <span>↵ to select</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}
