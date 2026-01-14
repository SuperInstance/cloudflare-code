'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Check, Code } from 'lucide-react';
import { ApiRequest, CodeSnippet } from '@/types';
import { LANGUAGE_CONFIGS } from '@/lib/utils/codegen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { copyToClipboard } from '@/lib/utils/cn';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeGeneratorProps {
  request: ApiRequest;
  onLanguageChange?: (language: string) => void;
}

export function CodeGenerator({ request, onLanguageChange }: CodeGeneratorProps) {
  const [snippets, setSnippets] = useState<Record<string, CodeSnippet>>({});
  const [selectedLanguage, setSelectedLanguage] = useState('typescript');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Generate snippets when request changes
    generateAllSnippets();
  }, [request]);

  const generateAllSnippets = () => {
    const newSnippets: Record<string, CodeSnippet> = {};

    Object.values(LANGUAGE_CONFIGS).forEach((config) => {
      // Import the code generator dynamically
      import('@/lib/utils/codegen').then(({ generateCodeSnippet }) => {
        const snippet = generateCodeSnippet(request, config.id);
        newSnippets[config.id] = snippet;
        setSnippets((prev) => ({ ...prev, [config.id]: snippet }));
      });
    });
  };

  const handleCopy = async () => {
    const snippet = snippets[selectedLanguage];
    if (!snippet) return;

    await copyToClipboard(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const snippet = snippets[selectedLanguage];
    if (!snippet) return;

    const config = LANGUAGE_CONFIGS[selectedLanguage as keyof typeof LANGUAGE_CONFIGS];
    const filename = `request.${config.extension}`;
    const blob = new Blob([snippet.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSnippet = snippets[selectedLanguage];
  const currentConfig = LANGUAGE_CONFIGS[selectedLanguage as keyof typeof LANGUAGE_CONFIGS];

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Code Snippet
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Language Selector */}
        <Tabs value={selectedLanguage} onValueChange={(value) => {
          setSelectedLanguage(value);
          onLanguageChange?.(value);
        }}>
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            {Object.values(LANGUAGE_CONFIGS).map((config) => (
              <TabsTrigger key={config.id} value={config.id} className="text-xs">
                {config.icon} {config.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(snippets).map(([lang, snippet]) => (
            <TabsContent key={lang} value={lang} className="mt-4">
              {/* Dependencies */}
              {snippet.dependencies && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm font-medium text-blue-500 mb-2">Dependencies:</p>
                  <code className="text-sm text-blue-600">{snippet.dependencies.join(', ')}</code>
                </div>
              )}

              {/* Code */}
              <div className="bg-muted rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
                <SyntaxHighlighter
                  language={snippet.language}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                >
                  {snippet.code}
                </SyntaxHighlighter>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Usage:</strong> Copy the code snippet above and integrate it into your application.
          </p>
          <p>
            <strong>Authentication:</strong> Make sure to set the <code className="bg-muted px-1 py-0.5 rounded">CLAUDEFLARE_API_KEY</code> environment variable before running the code.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
