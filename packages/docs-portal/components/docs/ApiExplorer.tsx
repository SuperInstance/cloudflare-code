// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { Play, Copy, Check } from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import { CodeBlock } from './CodeBlock';
import type { APIEndpoint } from '@/types';

// ============================================================================
// API Explorer Component
// ============================================================================

interface ApiExplorerProps {
  endpoint: APIEndpoint;
  className?: string;
}

export function ApiExplorer({ endpoint, className }: ApiExplorerProps) {
  const [requestBody, setRequestBody] = useState(
    endpoint.examples[0]?.request.body || {}
  );
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExecute = async () => {
    setIsLoading(true);
    setResponse(null);

    try {
      // Simulate API call (in real implementation, make actual request)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setResponse(endpoint.examples[0]?.response.body || {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a sample response. In production, this would be an actual API response.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      });
    } catch (error) {
      setResponse({
        error: {
          message: error instanceof Error ? error.message : 'An error occurred',
          type: 'api_error',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCurl = async () => {
    const curlCommand = `curl -X ${endpoint.method} '${endpoint.path}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -d '${JSON.stringify(requestBody, null, 2)}'`;

    await copyToClipboard(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted border-b border-border">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'px-2 py-1 rounded text-xs font-mono font-semibold',
              endpoint.method === 'GET'
                ? 'bg-green-500/10 text-green-500'
                : endpoint.method === 'POST'
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-yellow-500/10 text-yellow-500'
            )}
          >
            {endpoint.method}
          </span>
          <span className="font-mono text-sm">{endpoint.path}</span>
        </div>
        <button
          onClick={handleCopyCurl}
          className="p-2 rounded hover:bg-muted-foreground/10 transition-colors"
          title="Copy as cURL"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Request Panel */}
        <div className="border-r border-border">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <h3 className="font-semibold text-sm">Request</h3>
          </div>
          <div className="p-4">
            <CodeBlock
              code={JSON.stringify(requestBody, null, 2)}
              language="json"
              filename="request.json"
            />

            <button
              onClick={handleExecute}
              disabled={isLoading}
              className={cn(
                'w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                isLoading
                  ? 'bg-muted-foreground/50 cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Send Request
                </>
              )}
            </button>
          </div>
        </div>

        {/* Response Panel */}
        <div>
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <h3 className="font-semibold text-sm">Response</h3>
          </div>
          <div className="p-4 min-h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : response ? (
              <CodeBlock
                code={JSON.stringify(response, null, 2)}
                language="json"
                filename="response.json"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Click "Send Request" to see the response
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
