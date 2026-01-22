'use client';

import React from 'react';
import { Copy, Download, Check } from 'lucide-react';
import { ApiResponseData } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { copyToClipboard, formatBytes, formatDuration } from '@/lib/utils/cn';
import { useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ResponseViewerProps {
  response: ApiResponseData | null;
  error: string | null;
  isLoading: boolean;
}

export function ResponseViewer({ response, error, isLoading }: ResponseViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!response) return;

    const content = JSON.stringify(response.body, null, 2);
    await copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!response) return;

    const content = JSON.stringify(response.body, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'default';
    if (status >= 300 && status < 400) return 'secondary';
    if (status >= 400 && status < 500) return 'destructive';
    if (status >= 500) return 'destructive';
    return 'outline';
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">Sending request...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant="destructive">Error</Badge>
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive font-medium">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!response) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Send a request to see the response here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Response</CardTitle>
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
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status and metadata */}
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant={getStatusColor(response.status)} className="text-sm px-3">
            {response.status} {response.statusText}
          </Badge>

          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Duration:</span>{' '}
            {formatDuration(response.duration)}
          </div>

          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Size:</span> {formatBytes(response.size)}
          </div>
        </div>

        {/* Response Headers */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Response Headers</h3>
          <div className="bg-muted p-3 rounded-lg space-y-1 max-h-[150px] overflow-y-auto">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="text-sm font-mono">
                <span className="text-primary">{key}:</span> {value}
              </div>
            ))}
          </div>
        </div>

        {/* Response Body */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Response Body</h3>
          <div className="bg-muted rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
            <SyntaxHighlighter
              language="json"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              {JSON.stringify(response.body, null, 2)}
            </SyntaxHighlighter>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
