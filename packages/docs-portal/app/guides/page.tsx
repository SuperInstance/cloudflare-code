'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Clock, User } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { migrationGuides } from '@/lib/migration-data';

export default function GuidesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Migration Guides</h1>
        <p className="text-xl text-muted-foreground">
          Step-by-step guides to help you migrate to ClaudeFlare from other platforms
        </p>
      </div>

      {/* Overview */}
      <div className="mb-12 p-6 bg-blue-500/10 border border-blue-500/50 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Why Migrate to ClaudeFlare?</h2>
        <ul className="space-y-2 text-sm">
          <li>✓ Multi-provider AI routing with automatic failover</li>
          <li>✓ OpenAI-compatible API for easy migration</li>
          <li>✓ Built on Cloudflare Workers for global edge deployment</li>
          <li>✓ Generous free tier across multiple providers</li>
          <li>✓ Cost optimization through intelligent routing</li>
        </ul>
      </div>

      {/* Migration Guides */}
      <div className="space-y-8">
        {migrationGuides.map((guide) => (
          <div
            key={guide.id}
            className="border border-border rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-muted/30 border-b border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{guide.title}</h3>
                  <p className="text-muted-foreground">
                    Migrating from {guide.fromVersion} to {guide.toVersion}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {guide.estimatedTime}m
                  </div>
                  <div className="text-xs text-muted-foreground">Estimated time</div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{guide.breakingChanges.length}</span>
                  <span className="text-muted-foreground">Breaking changes</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{guide.newFeatures.length}</span>
                  <span className="text-muted-foreground">New features</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{guide.migrationSteps.length}</span>
                  <span className="text-muted-foreground">Steps</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Breaking Changes Preview */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Breaking Changes</h4>
                <div className="space-y-2">
                  {guide.breakingChanges.slice(0, 3).map((change, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-md"
                    >
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          change.impact === 'high' && 'bg-red-500/10 text-red-500',
                          change.impact === 'medium' && 'bg-yellow-500/10 text-yellow-500',
                          change.impact === 'low' && 'bg-green-500/10 text-green-500'
                        )}
                      >
                        {change.impact}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{change.feature}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {change.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {guide.breakingChanges.length > 3 && (
                  <div className="text-sm text-muted-foreground mt-2">
                    +{guide.breakingChanges.length - 3} more changes
                  </div>
                )}
              </div>

              {/* Migration Steps Preview */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Migration Steps</h4>
                <div className="space-y-2">
                  {guide.migrationSteps.slice(0, 4).map((step) => (
                    <div key={step.step} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {step.step}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{step.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {step.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* New Features */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3">What's New</h4>
                <div className="flex flex-wrap gap-2">
                  {guide.newFeatures.slice(0, 5).map((feature, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm"
                    >
                      ✓ {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <Link
                href={`/docs/guides/${guide.id}`}
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
              >
                View full migration guide
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Resources */}
      <div className="mt-12 p-6 bg-muted/30 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Need Help Migrating?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/docs/troubleshooting/common-issues"
            className="p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
          >
            <div className="font-medium mb-1">Common Issues</div>
            <div className="text-sm text-muted-foreground">
              Find solutions to common migration problems
            </div>
          </Link>
          <Link
            href="https://discord.gg/claudeflare"
            target="_blank"
            className="p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
          >
            <div className="font-medium mb-1">Community Support</div>
            <div className="text-sm text-muted-foreground">
              Get help from the ClaudeFlare community
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
