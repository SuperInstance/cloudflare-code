/**
 * Home Page
 *
 * Main dashboard with quick access to all features.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Chat, Folder, GitPullRequest, Settings, Bell } from 'lucide-react';
import { BottomNav } from '@/components/ui/BottomNav';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const navItems = [
  { id: 'chat', label: 'Chat', icon: <Chat className="w-5 h-5" />, href: '/chat', badge: 0 },
  { id: 'projects', label: 'Projects', icon: <Folder className="w-5 h-5" />, href: '/projects', badge: 3 },
  { id: 'review', label: 'Review', icon: <GitPullRequest className="w-5 h-5" />, href: '/review', badge: 5 },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" />, href: '/settings', badge: 0 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Header */}
      <header className="safe-top bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ClaudeFlare
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI coding platform
            </p>
          </div>
          <Link href="/notifications">
            <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-error-500 rounded-full" />
            </button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6">
        {/* Quick Stats */}
        <section className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">3</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Projects</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-accent-600 dark:text-accent-400">5</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Pending Reviews</div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Actions */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/chat/new">
              <Card interactive>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-2">
                      <Chat className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      New Chat
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/projects/new">
              <Card interactive>
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-success-100 dark:bg-success-900 flex items-center justify-center mb-2">
                      <Folder className="w-6 h-6 text-success-600 dark:text-success-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      New Project
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Recent Activity
            </h2>
            <Link href="/activity" className="text-sm text-primary-600 dark:text-primary-400">
              View all
            </Link>
          </div>

          <div className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0">
                    <Chat className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      New response in chat
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      2 minutes ago
                    </p>
                  </div>
                  <Badge size="sm" variant="success">New</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-100 dark:bg-accent-900 flex items-center justify-center flex-shrink-0">
                    <GitPullRequest className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      PR approved: Add new feature
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      1 hour ago
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-success-100 dark:bg-success-900 flex items-center justify-center flex-shrink-0">
                    <Folder className="w-5 h-5 text-success-600 dark:text-success-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Project deployed successfully
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      3 hours ago
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <BottomNav items={navItems} />
    </div>
  );
}
