/**
 * Header component for the dashboard
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
  User,
  Bell,
  Search,
  Menu,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDashboardStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Code', href: '/code', icon: Code2 },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface HeaderProps {
  title?: string;
  actions?: React.ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  const pathname = usePathname();
  const { user, notifications, theme, setTheme, sidebarOpen, setSidebarOpen } =
    useDashboardStore();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notificationOpen, setNotificationOpen] = React.useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4">
        {/* Sidebar Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="mr-4 lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>

        {/* Logo */}
        <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Code2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="hidden font-bold sm:inline-block">
            ClaudeFlare
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
          {navigation.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-1 items-center justify-end space-x-2">
          {/* Search */}
          <div className="hidden md:flex w-full max-w-sm items-center space-x-2">
            <Button
              variant="outline"
              className="relative h-9 w-full justify-start rounded-lg bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-64 lg:w-80"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="mr-2 h-4 w-4" />
              <span className="inline-flex">Search...</span>
              <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>

          {/* Theme Selector */}
          <Select value={theme} onValueChange={(value: 'light' | 'dark') => setTheme(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setNotificationOpen(!notificationOpen)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>

            {notificationOpen && (
              <div className="absolute right-0 top-12 z-50 w-80 rounded-md border bg-popover p-4 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Notifications</h3>
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                    Mark all as read
                  </Button>
                </div>
                <div className="space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No notifications
                    </p>
                  ) : (
                    notifications.slice(0, 5).map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          'flex flex-col space-y-1 rounded-md border p-3 text-sm',
                          notification.read
                            ? 'bg-muted/50 opacity-60'
                            : 'bg-background'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <p className="font-medium">{notification.title}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(notification.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          {notification.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-2">
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
            <div className="text-sm">
              <p className="font-medium">{user?.email || 'User'}</p>
            </div>
          </div>

          {/* Custom Actions */}
          {actions}
        </div>
      </div>
    </header>
  );
}
