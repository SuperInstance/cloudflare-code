// @ts-nocheck
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { troubleshootingEntries, errorCodes, faqItems } from '@/lib/troubleshooting-data';

export default function TroubleshootingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const filteredEntries = troubleshootingEntries.filter((entry) => {
    const matchesSearch =
      !searchQuery ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.symptoms.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' || entry.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(troubleshootingEntries.map((e) => e.category)));

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Troubleshooting</h1>
        <p className="text-xl text-muted-foreground">
          Find solutions to common issues and get back to building
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search issues and solutions..."
            className="w-full pl-10 pr-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            selectedCategory === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          All Issues
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              selectedCategory === category
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Quick Links */}
      <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="#issues"
          className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
        >
          <div className="font-semibold mb-1">Common Issues</div>
          <div className="text-sm text-muted-foreground">
            {troubleshootingEntries.length} troubleshooting guides
          </div>
        </Link>
        <Link
          href="#error-codes"
          className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
        >
          <div className="font-semibold mb-1">Error Codes</div>
          <div className="text-sm text-muted-foreground">
            {errorCodes.length} error reference
          </div>
        </Link>
        <Link
          href="#faq"
          className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
        >
          <div className="font-semibold mb-1">FAQ</div>
          <div className="text-sm text-muted-foreground">
            {faqItems.length} common questions
          </div>
        </Link>
      </div>

      {/* Troubleshooting Entries */}
      <section id="issues" className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Common Issues</h2>
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'border border-border rounded-lg overflow-hidden',
                entry.severity === 'high' && 'border-red-500/50',
                entry.severity === 'medium' && 'border-yellow-500/50'
              )}
            >
              <button
                onClick={() => toggleExpand(entry.id)}
                className="w-full p-4 flex items-start justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 text-left">
                  <AlertTriangle
                    className={cn(
                      'w-5 h-5 flex-shrink-0 mt-0.5',
                      entry.severity === 'high' && 'text-red-500',
                      entry.severity === 'medium' && 'text-yellow-500',
                      entry.severity === 'low' && 'text-blue-500'
                    )}
                  />
                  <div>
                    <div className="font-semibold">{entry.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {entry.symptoms[0]}
                    </div>
                  </div>
                </div>
                {expandedItems.has(entry.id) ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {expandedItems.has(entry.id) && (
                <div className="p-4 border-t border-border bg-muted/20">
                  {/* Symptoms */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm mb-2">Symptoms</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {entry.symptoms.map((symptom, idx) => (
                        <li key={idx}>{symptom}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Causes */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm mb-2">Possible Causes</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {entry.causes.map((cause, idx) => (
                        <li key={idx}>{cause}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Solutions */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Solutions</h4>
                    <div className="space-y-3">
                      {entry.solutions.map((solution, idx) => (
                        <div key={idx} className="p-3 bg-background rounded-md">
                          <div className="font-medium text-sm mb-2">
                            {idx + 1}. {solution.description}
                          </div>
                          {solution.steps && (
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                              {solution.steps.map((step, stepIdx) => (
                                <li key={stepIdx}>{step}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Related Docs */}
                  {entry.relatedDocs.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-sm text-muted-foreground mb-2">Related Documentation</div>
                      <div className="flex flex-wrap gap-2">
                        {entry.relatedDocs.map((doc, idx) => (
                          <Link
                            key={idx}
                            href={doc}
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            {doc}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Error Codes */}
      <section id="error-codes" className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Error Codes Reference</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
              </tr>
            </thead>
            <tbody>
              {errorCodes.map((error) => (
                <tr key={error.code} className="border-b border-border">
                  <td className="px-4 py-3 text-sm font-mono">{error.code}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 rounded bg-red-500/10 text-red-500 text-xs">
                      {error.httpStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{error.title}</td>
                  <td className="px-4 py-3 text-sm">{error.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqItems.map((item) => (
            <div key={item.id} className="border border-border rounded-lg">
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full p-4 flex items-start justify-between hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium text-left">{item.question}</span>
                {expandedItems.has(item.id) ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
                )}
              </button>
              {expandedItems.has(item.id) && (
                <div className="px-4 pb-4 pt-0 border-t border-border">
                  <div className="pt-3 text-sm text-muted-foreground">
                    {item.answer}
                  </div>
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                      {item.category}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Still Need Help */}
      <div className="mt-12 p-6 bg-primary/5 border border-primary/20 rounded-lg text-center">
        <h3 className="text-xl font-semibold mb-2">Still Need Help?</h3>
        <p className="text-muted-foreground mb-4">
          Our community is here to help you troubleshoot any issues
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href="https://discord.gg/claudeflare"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Join Discord
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href="https://github.com/claudeflare/claudeflare/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
          >
            Open Issue
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
