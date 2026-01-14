'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ApiRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RequestBuilderProps {
  request: ApiRequest;
  onChange: (request: ApiRequest) => void;
  onSend: () => void;
  isLoading: boolean;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
];

export function RequestBuilder({
  request,
  onChange,
  onSend,
  isLoading,
}: RequestBuilderProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params');

  const updateRequest = useCallback(
    (updates: Partial<ApiRequest>) => {
      onChange({ ...request, ...updates });
    },
    [request, onChange]
  );

  const addQueryParam = () => {
    updateRequest({
      queryParams: { ...request.queryParams, '': '' },
    });
  };

  const updateQueryParam = (key: string, newKey: string, value: string) => {
    const params = { ...request.queryParams };
    delete params[key];
    params[newKey] = value;
    updateRequest({ queryParams: params });
  };

  const removeQueryParam = (key: string) => {
    const params = { ...request.queryParams };
    delete params[key];
    updateRequest({ queryParams: params });
  };

  const addHeader = () => {
    updateRequest({
      headers: { ...request.headers, '': '' },
    });
  };

  const updateHeader = (key: string, newKey: string, value: string) => {
    const headers = { ...request.headers };
    delete headers[key];
    headers[newKey] = value;
    updateRequest({ headers });
  };

  const removeHeader = (key: string) => {
    const headers = { ...request.headers };
    delete headers[key];
    updateRequest({ headers });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Request Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Method and URL */}
        <div className="flex gap-2">
          <Select
            value={request.method}
            onValueChange={(value) =>
              updateRequest({ method: value as ApiRequest['method'] })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Enter endpoint (e.g., /v1/completions)"
            value={request.endpoint}
            onChange={(e) => updateRequest({ endpoint: e.target.value })}
            className="flex-1"
          />
        </div>

        {/* Tabs */}
        <div className="border rounded-lg">
          <div className="flex border-b">
            {(['params', 'headers', 'body'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'params' && (
              <div className="space-y-2">
                {Object.entries(request.queryParams).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <Input
                      placeholder="Parameter name"
                      value={key}
                      onChange={(e) =>
                        updateQueryParam(key, e.target.value, value)
                      }
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={value}
                      onChange={(e) =>
                        updateQueryParam(key, key, e.target.value)
                      }
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQueryParam(key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addQueryParam}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Query Parameter
                </Button>
              </div>
            )}

            {activeTab === 'headers' && (
              <div className="space-y-2">
                {Object.entries(request.headers).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <Input
                      placeholder="Header name"
                      value={key}
                      onChange={(e) => updateHeader(key, e.target.value, value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={value}
                      onChange={(e) => updateHeader(key, key, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHeader(key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addHeader}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Header
                </Button>
              </div>
            )}

            {activeTab === 'body' && (
              <div className="space-y-2">
                <Select
                  value={request.contentType}
                  onValueChange={(value) => updateRequest({ contentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Content-Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {['POST', 'PUT', 'PATCH'].includes(request.method) && (
                  <Textarea
                    placeholder="Request body (JSON)"
                    value={typeof request.body === 'string' ? request.body : JSON.stringify(request.body, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateRequest({ body: parsed });
                      } catch {
                        updateRequest({ body: e.target.value });
                      }
                    }}
                    className="min-h-[200px] font-mono text-sm"
                  />
                )}

                {!['POST', 'PUT', 'PATCH'].includes(request.method) && (
                  <div className="text-sm text-muted-foreground p-4 bg-muted rounded">
                    Request body is only applicable for POST, PUT, and PATCH methods
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Send Button */}
        <Button onClick={onSend} disabled={isLoading} className="w-full" size="lg">
          {isLoading ? 'Sending...' : 'Send Request'}
        </Button>
      </CardContent>
    </Card>
  );
}
