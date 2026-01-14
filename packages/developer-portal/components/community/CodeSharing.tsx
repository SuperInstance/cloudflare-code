'use client';

import React, { useState } from 'react';
import { Search, Code, Heart, Fork, Copy, Check } from 'lucide-react';
import { CodeShare } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SyntaxHighlighter } from '@/components/code/SyntaxHighlighter';
import { copyToClipboard, formatNumber, formatDate } from '@/lib/utils/cn';

interface CodeSharingProps {
  snippets: CodeShare[];
  onShare: () => void;
}

export function CodeSharing({ snippets, onShare }: CodeSharingProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const languages = ['all', 'typescript', 'javascript', 'python', 'go', 'rust'];
  const sortedSnippets = [...snippets].sort(
    (a, b) => b.likes - a.likes || b.forks - a.forks
  );

  const filteredSnippets = sortedSnippets.filter((snippet) => {
    const matchesSearch =
      snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLanguage =
      selectedLanguage === 'all' || snippet.language === selectedLanguage;
    return matchesSearch && matchesLanguage;
  });

  const handleCopy = async (id: string, code: string) => {
    await copyToClipboard(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Code Sharing</h2>
          <p className="text-muted-foreground">
            Share and discover code snippets from the community
          </p>
        </div>
        <Button onClick={onShare}>
          <Code className="h-4 w-4 mr-2" />
          Share Code
        </Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code snippets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            {languages.map((lang) => (
              <Badge
                key={lang}
                variant={selectedLanguage === lang ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedLanguage(lang)}
              >
                {lang}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Snippets Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredSnippets.map((snippet) => (
          <CodeSnippetCard
            key={snippet.id}
            snippet={snippet}
            copied={copiedId === snippet.id}
            onCopy={() => handleCopy(snippet.id, snippet.code)}
          />
        ))}
      </div>
    </div>
  );
}

interface CodeSnippetCardProps {
  snippet: CodeShare;
  copied: boolean;
  onCopy: () => void;
}

function CodeSnippetCard({ snippet, copied, onCopy }: CodeSnippetCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{snippet.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {snippet.description}
            </p>
          </div>
          <Badge variant="outline">{snippet.language}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Code Preview */}
        <div className="relative">
          <div className="bg-muted rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted-foreground/10 border-b">
              <span className="text-xs font-mono">
                {snippet.language}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopy}
                className="h-6 px-2"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="p-3 max-h-[200px] overflow-hidden">
              <pre className="text-xs font-mono">
                {expanded
                  ? snippet.code
                  : snippet.code.split('\n').slice(0, 10).join('\n')}
              </pre>
              {!expanded && snippet.code.split('\n').length > 10 && (
                <div className="text-xs text-muted-foreground mt-2">
                  ... {snippet.code.split('\n').length - 10} more lines
                </div>
              )}
            </div>
          </div>

          {snippet.code.split('\n').length > 10 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full mt-2"
            >
              {expanded ? 'Show Less' : 'Show More'}
            </Button>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={snippet.author.avatar} />
              <AvatarFallback>
                {snippet.author.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium">
                {snippet.author.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(snippet.createdAt)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              <span>{formatNumber(snippet.likes)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Fork className="h-4 w-4" />
              <span>{formatNumber(snippet.forks)}</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {snippet.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {snippet.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
