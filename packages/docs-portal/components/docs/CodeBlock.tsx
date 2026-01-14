'use client';

import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'prism-react-renderer';
import { Check, Copy } from 'lucide-react';
import { cn, copyToClipboard, getLanguageFromFilename } from '@/lib/utils';

// ============================================================================
// Code Block Component
// ============================================================================

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  highlightLines?: number[];
  showLineNumbers?: boolean;
  title?: string;
  className?: string;
}

export function CodeBlock({
  code,
  language = 'text',
  filename,
  highlightLines = [],
  showLineNumbers = true,
  title,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const detectedLanguage = filename
    ? getLanguageFromFilename(filename)
    : language;

  return (
    <div className={cn('relative group my-4', className)}>
      {/* Header */}
      {(title || filename) && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {title || filename}
            </span>
            {filename && (
              <span className="text-xs text-muted-foreground">
                {detectedLanguage}
              </span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-muted-foreground/10 transition-colors"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      )}

      {/* Code */}
      <div
        className={cn(
          'rounded-lg overflow-hidden',
          !title && !filename && 'relative'
        )}
      >
        <SyntaxHighlighter
          language={detectedLanguage}
          showLineNumbers={showLineNumbers}
          highlightLines={highlightLines}
          customStyle={{
            margin: 0,
            borderRadius: title || filename ? '0 0 0.5rem 0.5rem' : '0.5rem',
            background: 'hsl(var(--muted))',
          }}
          lineNumberStyle={{
            color: 'hsl(var(--muted-foreground))',
            fontSize: '0.875rem',
            paddingRight: '1rem',
            minWidth: '2.5rem',
            textAlign: 'right',
            userSelect: 'none',
          }}
          codeTagProps={{
            style: {
              fontSize: '0.875rem',
              fontFamily: 'var(--font-mono)',
            },
          }}
        >
          {code.trim()}
        </SyntaxHighlighter>

        {/* Copy button for code-only blocks */}
        {!title && !filename && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 rounded-md bg-background/80 backdrop-blur-sm border border-border opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Inline Code Component
// ============================================================================

interface InlineCodeProps {
  children: React.ReactNode;
  className?: string;
}

export function InlineCode({ children, className }: InlineCodeProps) {
  return (
    <code
      className={cn(
        'px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-sm',
        className
      )}
    >
      {children}
    </code>
  );
}

// ============================================================================
// Code Tabs Component
// ============================================================================

interface CodeTab {
  label: string;
  code: string;
  language?: string;
  filename?: string;
}

interface CodeTabsProps {
  tabs: CodeTab[];
  className?: string;
}

export function CodeTabs({ tabs, className }: CodeTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className={cn('my-4', className)}>
      {/* Tab Headers */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === index
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <CodeBlock {...tabs[activeTab]} />
    </div>
  );
}

// ============================================================================
// Code Diff Component
// ============================================================================

interface CodeDiffProps {
  before: string;
  after: string;
  language?: string;
  className?: string;
}

export function CodeDiff({ before, after, language, className }: CodeDiffProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-4 my-4', className)}>
      <div>
        <div className="text-sm font-medium text-muted-foreground mb-2">
          Before
        </div>
        <CodeBlock code={before} language={language} />
      </div>
      <div>
        <div className="text-sm font-medium text-muted-foreground mb-2">
          After
        </div>
        <CodeBlock code={after} language={language} />
      </div>
    </div>
  );
}

// ============================================================================
// Code Preview Component
// ============================================================================

interface CodePreviewProps {
  code: string;
  language?: string;
  preview: React.ReactNode;
  showPreview?: boolean;
  className?: string;
}

export function CodePreview({
  code,
  language,
  preview,
  showPreview = true,
  className,
}: CodePreviewProps) {
  const [view, setView] = useState<'code' | 'preview' | 'split'>('split');

  return (
    <div className={cn('my-4', className)}>
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          <button
            onClick={() => setView('code')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              view === 'code'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            Code
          </button>
          <button
            onClick={() => setView('preview')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              view === 'preview'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            Preview
          </button>
          <button
            onClick={() => setView('split')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              view === 'split'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            Split
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          'border border-border rounded-lg overflow-hidden',
          view === 'split' && 'grid grid-cols-2'
        )}
      >
        {(view === 'code' || view === 'split') && (
          <div className={view === 'split' ? 'border-r border-border' : ''}>
            <CodeBlock code={code} language={language} />
          </div>
        )}
        {(view === 'preview' || view === 'split') && (
          <div className="p-4 bg-background">
            {preview}
          </div>
        )}
      </div>
    </div>
  );
}
