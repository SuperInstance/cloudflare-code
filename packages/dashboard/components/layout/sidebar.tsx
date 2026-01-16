// @ts-nocheck
/**
 * Sidebar component for the dashboard
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Code2,
  FolderKanban,
  MessageSquare,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/lib/store';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Code', href: '/code', icon: Code2 },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, projects } = useDashboardStore();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] border-r bg-background transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'w-16' : 'w-64',
          className
        )}
      >
        <div className="flex h-full flex-col">
          {/* Collapse Button */}
          <div className="flex justify-end p-2">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    collapsed && 'justify-center'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Recent Projects */}
          {!collapsed && projects.length > 0 && (
            <div className="border-t p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Recent Projects
              </h3>
              <div className="space-y-1">
                {projects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block truncate rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {project.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* User Info */}
          {!collapsed && (
            <div className="border-t p-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                  <span className="text-sm font-medium text-primary-foreground">
                    U
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">User</p>
                  <p className="truncate text-xs text-muted-foreground">
                    user@example.com
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

interface SidebarItemProps {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
  collapsed?: boolean;
}

function SidebarItem({ href, icon: Icon, children, collapsed }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname?.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        collapsed && 'justify-center'
      )}
      title={collapsed ? children : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{children}</span>}
    </Link>
  );
}
