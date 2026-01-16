'use client';

// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ApiRequest } from '@/types';
import { usePlayground } from '@/lib/hooks/usePlayground';
import { RequestBuilder } from '@/components/playground/RequestBuilder';
import { ResponseViewer } from '@/components/playground/ResponseViewer';
import { CodeGenerator } from '@/components/playground/CodeGenerator';
import { HistoryPanel } from '@/components/playground/HistoryPanel';
import { SavedRequests } from '@/components/playground/SavedRequests';
import { useSessionStorage } from '@/lib/hooks/useLocalStorage';

export default function PlaygroundPage() {
  const router = useRouter();
  const { sendRequest, isLoading, response, error, history, savedRequests } = usePlayground();

  const [request, setRequest] = useSessionStorage<ApiRequest>('playground-request', {
    endpoint: '/v1/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    queryParams: {},
    pathParams: {},
    body: {
      model: 'claude-3-opus',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'Hello, Claude!',
        },
      ],
    },
    contentType: 'application/json',
  });

  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const handleSend = async () => {
    try {
      await sendRequest(request);
    } catch (err) {
      console.error('Request failed:', err);
    }
  };

  const handleLoadFromHistory = (historyRequest: ApiRequest) => {
    setRequest(historyRequest);
  };

  const handleLoadSaved = (savedRequest: ApiRequest) => {
    setRequest(savedRequest);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">API Playground</h1>
              <p className="text-sm text-muted-foreground">
                Test and explore ClaudeFlare APIs interactively
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
              >
                History
              </button>
              <button
                onClick={() => setShowSaved(!showSaved)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
              >
                Saved
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            <RequestBuilder
              request={request}
              onChange={setRequest}
              onSend={handleSend}
              isLoading={isLoading}
            />

            {showHistory && (
              <HistoryPanel
                history={history}
                onSelectHistory={(item) => handleLoadFromHistory(item.request)}
                onClear={() => {}}
              />
            )}

            {showSaved && (
              <SavedRequests
                savedRequests={savedRequests}
                onLoad={handleLoadSaved}
                onDelete={() => {}}
                onSave={() => {}}
                currentRequest={request}
              />
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <ResponseViewer response={response} error={error} isLoading={isLoading} />
            <CodeGenerator request={request} />
          </div>
        </div>
      </div>
    </div>
  );
}
