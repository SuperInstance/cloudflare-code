'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatDuration } from '@/lib/utils/cn';

interface TopEndpointsProps {
  data: Array<{ path: string; requests: number; avgLatency: number }>;
}

export function TopEndpoints({ data }: TopEndpointsProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No endpoint data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Endpoints</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((endpoint, index) => (
            <div
              key={endpoint.path}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1">
                <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                  {index + 1}
                </Badge>
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono truncate block">
                    {endpoint.path}
                  </code>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(endpoint.requests)} requests
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(endpoint.avgLatency)} avg
                    </span>
                  </div>
                </div>
              </div>
              <Badge
                variant={endpoint.avgLatency < 500 ? 'default' : 'destructive'}
              >
                {endpoint.avgLatency < 500 ? 'Fast' : 'Slow'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
