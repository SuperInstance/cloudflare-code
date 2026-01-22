// @ts-nocheck
'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Code, Video, Zap, Shield, Globe, Users, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocSearch } from '@/components/search/DocSearch';

// ============================================================================
// Feature Cards Data
// ============================================================================

const features = [
  {
    title: 'Comprehensive API Reference',
    description: 'Complete documentation for all ClaudeFlare API endpoints with request/response examples',
    icon: Code,
    href: '/docs/api-reference/overview',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    title: 'Interactive Tutorials',
    description: '50+ step-by-step tutorials covering beginner to advanced topics',
    icon: BookOpen,
    href: '/docs/tutorials',
    color: 'text-green-500 bg-green-500/10',
  },
  {
    title: 'Video Tutorials',
    description: 'Watch and learn with our library of video tutorials and walkthroughs',
    icon: Video,
    href: '/docs/tutorials/videos',
    color: 'text-purple-500 bg-purple-500/10',
  },
  {
    title: 'Code Playground',
    description: 'Try ClaudeFlare directly in your browser with our interactive code playground',
    icon: Zap,
    href: '/playground',
    color: 'text-yellow-500 bg-yellow-500/10',
  },
  {
    title: 'Migration Guides',
    description: 'Easy migration from other AI platforms with step-by-step guides',
    icon: ArrowRight,
    href: '/docs/guides/migration',
    color: 'text-orange-500 bg-orange-500/10',
  },
  {
    title: 'Troubleshooting',
    description: 'Find solutions to common issues and get help when you need it',
    icon: Shield,
    href: '/docs/troubleshooting',
    color: 'text-red-500 bg-red-500/10',
  },
];

const quickLinks = [
  { title: 'Quick Start', href: '/docs/getting-started/quick-start', icon: 'Zap' },
  { title: 'API Reference', href: '/docs/api-reference/overview', icon: 'Code' },
  { title: 'Tutorials', href: '/docs/tutorials', icon: 'BookOpen' },
  { title: 'Troubleshooting', href: '/docs/troubleshooting/common-issues', icon: 'HelpCircle' },
];

const stats = [
  { label: 'API Endpoints', value: '50+', icon: Code },
  { label: 'Tutorials', value: '50+', icon: BookOpen },
  { label: 'Videos', value: '15', icon: Video },
  { label: 'Examples', value: '100+', icon: Zap },
];

// ============================================================================
// Homepage Component
// ============================================================================

export default function HomePage() {
  const handleSearch = async (query: string) => {
    // Simulated search - in production, call actual search API
    const allDocs = [
      { id: '1', title: 'Getting Started', description: 'Learn the basics of ClaudeFlare', category: 'getting-started', url: '/docs/getting-started/introduction', score: 1 },
      { id: '2', title: 'Chat API', description: 'Generate chat completions', category: 'api-reference', url: '/docs/api-reference/chat-api', score: 0.9 },
      { id: '3', title: 'Authentication', description: 'Secure your API requests', category: 'api-reference', url: '/docs/api-reference/authentication', score: 0.8 },
    ];

    if (!query) return [];

    return allDocs.filter(
      (doc) =>
        doc.title.toLowerCase().includes(query.toLowerCase()) ||
        doc.description.toLowerCase().includes(query.toLowerCase())
    );
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        <div className="container mx-auto px-4 py-24 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary mb-6">
              <Zap className="w-4 h-4" />
              <span>Now in v1.0 - OpenAI Compatible API</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              ClaudeFlare Documentation
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Complete documentation for the distributed AI coding platform built on
              Cloudflare Workers with intelligent multi-provider routing.
            </p>

            {/* Search */}
            <div className="max-w-2xl mx-auto mb-8">
              <DocSearch
                onSearch={handleSearch}
                placeholder="Search documentation..."
                className="w-full"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/docs/getting-started/quick-start"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                <Zap className="w-4 h-4" />
                Quick Start
              </Link>
              <Link
                href="/playground"
                className="inline-flex items-center gap-2 px-6 py-3 border border-border bg-background hover:bg-muted rounded-lg transition-colors font-medium"
              >
                <Code className="w-4 h-4" />
                Try Playground
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <stat.icon className="w-5 h-5 text-primary mr-2" />
                  <span className="text-3xl font-bold">{stat.value}</span>
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
          <p className="text-lg text-muted-foreground">
            From getting started to advanced features, find it all here
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group p-6 border border-border rounded-lg hover:border-primary/50 hover:shadow-lg transition-all"
            >
              <div className={cn('p-3 rounded-lg w-fit mb-4', feature.color)}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">{feature.description}</p>
              <div className="flex items-center gap-1 mt-4 text-sm text-primary group-hover:gap-2 transition-all">
                <span>Learn more</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Links Section */}
      <div className="bg-muted/30">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Get Started Quickly</h2>
            <p className="text-lg text-muted-foreground">
              Choose your path and start building with ClaudeFlare
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {quickLinks.map((link) => {
              const Icon = link.icon === 'Zap' ? Zap :
                          link.icon === 'Code' ? Code :
                          link.icon === 'BookOpen' ? BookOpen :
                          Shield;
              return (
                <Link
                  key={link.title}
                  href={link.href}
                  className="p-6 bg-background border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all text-center group"
                >
                  <Icon className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <div className="font-medium">{link.title}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Learning Paths Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Structured Learning Paths</h2>
          <p className="text-lg text-muted-foreground">
            Follow our curated paths to master ClaudeFlare
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Beginner Path */}
          <Link
            href="/docs/tutorials/beginner-path"
            className="group p-8 border-2 border-primary/20 rounded-xl hover:border-primary/50 hover:shadow-xl transition-all bg-gradient-to-br from-primary/5 to-transparent"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold mb-2">Beginner Path</h3>
                <p className="text-muted-foreground">
                  Perfect if you're new to ClaudeFlare
                </p>
              </div>
              <div className="p-3 bg-primary text-primary-foreground rounded-lg">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>6 tutorials</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>~90 minutes</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-primary font-medium">
              <span>Start learning</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Advanced Path */}
          <Link
            href="/docs/tutorials/advanced-path"
            className="group p-8 border-2 border-purple-500/20 rounded-xl hover:border-purple-500/50 hover:shadow-xl transition-all bg-gradient-to-br from-purple-500/5 to-transparent"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold mb-2">Advanced Path</h3>
                <p className="text-muted-foreground">
                  Master production deployment and optimization
                </p>
              </div>
              <div className="p-3 bg-purple-500 text-white rounded-lg">
                <Zap className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>5 tutorials</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>~120 minutes</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-purple-500 font-medium">
              <span>Continue learning</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* Community Section */}
      <div className="bg-muted/30">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <Globe className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Join the Community</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Get help, share your projects, and connect with other developers building with ClaudeFlare
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://github.com/claudeflare/claudeflare"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-background border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Users className="w-4 h-4" />
                GitHub
              </a>
              <a
                href="https://discord.gg/claudeflare"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-background border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Users className="w-4 h-4" />
                Discord
              </a>
              <a
                href="https://twitter.com/claudeflare"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-background border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Users className="w-4 h-4" />
                Twitter
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              © 2024 ClaudeFlare. Built with Next.js and TypeScript.
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/docs" className="text-muted-foreground hover:text-foreground">
                Documentation
              </Link>
              <Link href="/docs/api-reference" className="text-muted-foreground hover:text-foreground">
                API Reference
              </Link>
              <Link href="/docs/troubleshooting" className="text-muted-foreground hover:text-foreground">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Icon Components
// ============================================================================

function Clock({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function HelpCircle({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}
