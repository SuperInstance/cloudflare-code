// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronRight,
  BookOpen,
  Code,
  GraduationCap,
  LifeBuoy,
  FileText,
  Video,
  Settings,
  Menu,
  X,
  Search,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavItem, DocSection } from '@/types';

// ============================================================================
// Navigation Data
// ============================================================================

const navigationSections: DocSection[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Introduction', href: '/docs/getting-started/introduction', icon: 'BookOpen' },
      { title: 'Quick Start', href: '/docs/getting-started/quick-start', icon: 'Zap' },
      { title: 'Installation', href: '/docs/getting-started/installation', icon: 'Download' },
      { title: 'First Project', href: '/docs/getting-started/first-project', icon: 'FolderOpen' },
      { title: 'Configuration', href: '/docs/getting-started/configuration', icon: 'Settings' },
      { title: 'Best Practices', href: '/docs/getting-started/best-practices', icon: 'Star' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { title: 'Overview', href: '/docs/api-reference/overview', icon: 'FileText' },
      { title: 'Authentication', href: '/docs/api-reference/authentication', icon: 'Lock' },
      { title: 'Chat API', href: '/docs/api-reference/chat-api', icon: 'MessageSquare' },
      { title: 'Code Generation', href: '/docs/api-reference/code-generation', icon: 'Code' },
      { title: 'Agents API', href: '/docs/api-reference/agents-api', icon: 'Bot' },
      { title: 'Webhooks', href: '/docs/api-reference/webhooks', icon: 'Webhook' },
      { title: 'Error Codes', href: '/docs/api-reference/error-codes', icon: 'AlertCircle' },
    ],
  },
  {
    title: 'SDKs',
    items: [
      { title: 'JavaScript/TypeScript', href: '/docs/sdks/javascript', icon: 'Code2' },
      { title: 'Python', href: '/docs/sdks/python', icon: 'Code2' },
      { title: 'Go', href: '/docs/sdks/go', icon: 'Code2' },
    ],
  },
  {
    title: 'Tutorials',
    items: [
      { title: 'Beginner', href: '/docs/tutorials/beginner', icon: 'GraduationCap', badge: '12 tutorials' },
      { title: 'Advanced', href: '/docs/tutorials/advanced', icon: 'GraduationCap', badge: '8 tutorials' },
      { title: 'Video Tutorials', href: '/docs/tutorials/videos', icon: 'Video', badge: '15 videos' },
      { title: 'Interactive Examples', href: '/docs/tutorials/interactive', icon: 'Play', badge: '20 examples' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { title: 'Code Completion', href: '/docs/guides/code-completion', icon: 'Code2' },
      { title: 'Multi-Agent Workflows', href: '/docs/guides/multi-agent-workflows', icon: 'Users' },
      { title: 'Custom Agents', href: '/docs/guides/custom-agents', icon: 'Bot' },
      { title: 'Rate Limiting', href: '/docs/guides/rate-limiting', icon: 'Gauge' },
      { title: 'Error Handling', href: '/docs/guides/error-handling', icon: 'AlertTriangle' },
    ],
  },
  {
    title: 'Migration Guides',
    items: [
      { title: 'v0 to v1', href: '/docs/migration/v0-to-v1', icon: 'ArrowRight' },
      { title: 'From OpenAI', href: '/docs/migration/from-openai', icon: 'ArrowRight' },
      { title: 'From Anthropic', href: '/docs/migration/from-anthropic', icon: 'ArrowRight' },
      { title: 'Version History', href: '/docs/migration/version-history', icon: 'History' },
    ],
  },
  {
    title: 'Troubleshooting',
    items: [
      { title: 'Common Issues', href: '/docs/troubleshooting/common-issues', icon: 'HelpCircle' },
      { title: 'Error Codes', href: '/docs/troubleshooting/error-codes', icon: 'AlertCircle' },
      { title: 'Performance Issues', href: '/docs/troubleshooting/performance', icon: 'Gauge' },
      { title: 'FAQ', href: '/docs/troubleshooting/faq', icon: 'HelpCircle' },
    ],
  },
  {
    title: 'Architecture',
    items: [
      { title: 'System Overview', href: '/docs/architecture/system-overview', icon: 'Server' },
      { title: 'Durable Objects', href: '/docs/architecture/durable-objects', icon: 'Database' },
      { title: 'Edge Computing', href: '/docs/architecture/edge-computing', icon: 'Globe' },
    ],
  },
  {
    title: 'Developer',
    items: [
      { title: 'Contributing', href: '/docs/developer/contributing', icon: 'GitPullRequest' },
      { title: 'Deployment', href: '/docs/developer/deployment', icon: 'Rocket' },
    ],
  },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Code,
  GraduationCap,
  LifeBuoy,
  FileText,
  Video,
  Settings,
  Zap,
  Download,
  FolderOpen,
  Star,
  Lock,
  MessageSquare,
  Bot,
  Webhook,
  AlertCircle,
  Code2,
  Users,
  Gauge,
  ArrowRight,
  HelpCircle,
  Server,
  Database,
  Globe,
  GitPullRequest,
  Rocket,
};

// ============================================================================
// Navigation Item Component
// ============================================================================

interface NavItemProps {
  item: NavItem;
  pathname: string;
  depth?: number;
}

function NavItemComponent({ item, pathname, depth = 0 }: NavItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = pathname === item.href;
  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon ? iconMap[item.icon] : undefined;

  useEffect(() => {
    // Auto-open if active or child is active
    if (isActive || (hasChildren && item.children?.some((child) => pathname === child.href))) {
      setIsOpen(true);
    }
  }, [pathname, isActive, hasChildren, item.children]);

  return (
    <div className={cn('space-y-1', depth > 0 && 'ml-4')}>
      <Link
        href={item.href || '#'}
        onClick={(e) => {
          if (hasChildren) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          !item.href && 'cursor-pointer'
        )}
      >
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
        <span className="flex-1">{item.title}</span>
        {item.badge && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <ChevronRight
            className={cn(
              'w-4 h-4 flex-shrink-0 transition-transform',
              isOpen && 'transform rotate-90'
            )}
          />
        )}
      </Link>

      {hasChildren && isOpen && (
        <div className="space-y-1 mt-1">
          {item.children!.map((child, index) => (
            <NavItemComponent key={index} item={child} pathname={pathname} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Navigation Component
// ============================================================================

interface DocsNavProps {
  className?: string;
}

export function DocsNav({ className }: DocsNavProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Filter navigation based on search
  const filteredSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(query) ||
          item.children?.some((child) => child.title.toLowerCase().includes(query))
        );
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Navigation Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 bg-background border-r border-border flex flex-col',
          'transition-transform duration-300',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          isCollapsed && 'lg:w-16',
          className
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-500 rounded-lg flex items-center justify-center">
            <Code className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="font-semibold text-lg">ClaudeFlare</div>
          )}
        </div>

        {/* Search */}
        {!isCollapsed && (
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search docs..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-4 -right-3 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md lg:flex hidden"
        >
          <ChevronRight
            className={cn('w-4 h-4 transition-transform', isCollapsed && 'rotate-180')}
          />
        </button>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {filteredSections.map((section) => (
            <div key={section.title}>
              {!isCollapsed && (
                <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item, index) => (
                  <NavItemComponent key={index} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-border">
            <div className="text-xs text-muted-foreground text-center">
              © 2024 ClaudeFlare
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

// ============================================================================
// Table of Contents Component
// ============================================================================

interface TOCProps {
  headings: Array<{
    id: string;
    text: string;
    level: number;
  }>;
  className?: string;
}

export function TableOfContents({ headings, className }: TOCProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className={cn('space-y-2', className)}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        On this page
      </div>
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={cn(
            'block text-sm transition-colors',
            heading.level === 2 && 'font-medium',
            heading.level === 3 && 'pl-4 text-muted-foreground',
            activeId === heading.id ? 'text-primary' : 'hover:text-foreground'
          )}
          style={{ paddingLeft: `${(heading.level - 2) * 1}rem` }}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  );
}

// ============================================================================
// Breadcrumb Component
// ============================================================================

interface BreadcrumbProps {
  items: Array<{
    title: string;
    href: string;
  }>;
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="w-4 h-4" />}
          {index === items.length - 1 ? (
            <span className="text-foreground font-medium">{item.title}</span>
          ) : (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.title}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

// ============================================================================
// Version Selector Component
// ============================================================================

interface VersionSelectorProps {
  currentVersion: string;
  versions: Array<{ version: string; url: string; status?: 'stable' | 'beta' | 'deprecated' }>;
  className?: string;
}

export function VersionSelector({ currentVersion, versions, className }: VersionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted hover:bg-muted/70 transition-colors"
      >
        <span className="text-sm font-medium">{currentVersion}</span>
        <ChevronRight
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-90')}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-1 w-40 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
            {versions.map((v) => (
              <Link
                key={v.version}
                href={v.url}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
                  v.version === currentVersion && 'bg-muted'
                )}
              >
                <span>{v.version}</span>
                {v.status && (
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      v.status === 'stable' && 'bg-green-500/10 text-green-500',
                      v.status === 'beta' && 'bg-yellow-500/10 text-yellow-500',
                      v.status === 'deprecated' && 'bg-red-500/10 text-red-500'
                    )}
                  >
                    {v.status}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
