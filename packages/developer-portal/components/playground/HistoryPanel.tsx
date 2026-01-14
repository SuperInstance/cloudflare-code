'use client';

import React from 'react';
import { Clock, Trash2, Play } from 'lucide-react';
import { RequestHistory } from '@/types';
import { formatDateTime } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HistoryPanelProps {
  history: RequestHistory[];
  onSelectHistory: (item: RequestHistory) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, onSelectHistory, onClear }: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Request History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No request history yet. Send a request to see it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Request History
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {history.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-muted hover:bg-muted/80 rounded-lg cursor-pointer transition-colors"
              onClick={() => onSelectHistory(item)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={item.successful ? 'default' : 'destructive'}>
                    {item.request.method}
                  </Badge>
                  <code className="text-sm font-mono truncate flex-1">
                    {item.request.endpoint}
                  </code>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Play className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{formatDateTime(item.timestamp)}</span>
                <span>{item.response.status}</span>
                <span>{item.response.duration}ms</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
