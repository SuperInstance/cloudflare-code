/**
 * Main layout wrapper for dashboard pages
 */

'use client';

import * as React from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { useDashboardStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function MainLayout({ children, title, actions }: MainLayoutProps) {
  const { sidebarOpen } = useDashboardStore();

  return (
    <div className="flex h-screen flex-col">
      <Header title={title} actions={actions} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          className={cn(
            'flex-1 overflow-auto transition-all duration-300',
            sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
          )}
        >
          <div className="container p-6">
            {title && (
              <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
