'use client';

import React from 'react';
import { Webhook, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { WebhookEvent } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/lib/utils/cn';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface WebhookDebuggerProps {
  isConnected: boolean;
  events: WebhookEvent[];
  selectedEvent: WebhookEvent | null;
  onSelectEvent: (event: WebhookEvent) => void;
  onClear: () => void;
  onReplay: (event: WebhookEvent) => void;
}

export function WebhookDebugger({
  isConnected,
  events,
  selectedEvent,
  onSelectEvent,
  onClear,
  onReplay,
}: WebhookDebuggerProps) {
  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Debugger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Webhook URL"
                value="wss://claudeflare.dev/webhooks/debug"
                disabled
                className="w-[300px]"
              />
              <Button variant="outline" onClick={onClear}>
                Clear Events
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Events List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Events</span>
              <Badge variant="secondary">{events.length} events</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Waiting for webhook events...
                </p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedEvent?.id === event.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                    onClick={() => onSelectEvent(event)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            event.processed
                              ? selectedEvent?.id === event.id
                                ? 'secondary'
                                : 'default'
                              : 'destructive'
                          }
                        >
                          {event.type}
                        </Badge>
                        {event.retryCount > 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs"
                          >
                            Retry {event.retryCount}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {event.processed ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>

                    <div className="text-xs opacity-70">
                      {formatDateTime(event.timestamp)}
                    </div>

                    <div className="text-xs font-mono mt-1 truncate">
                      {JSON.stringify(event.data).slice(0, 50)}...
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Event Details */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedEvent ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Select an event to view details
              </p>
            ) : (
              <div className="space-y-4">
                {/* Metadata */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Event Type</span>
                    <Badge>{selectedEvent.type}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Timestamp</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(selectedEvent.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <Badge variant={selectedEvent.processed ? 'default' : 'destructive'}>
                      {selectedEvent.processed ? 'Processed' : 'Failed'}
                    </Badge>
                  </div>

                  {selectedEvent.signature && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Signature</span>
                      <code className="text-xs bg-muted p-2 rounded block break-all">
                        {selectedEvent.signature}
                      </code>
                    </div>
                  )}
                </div>

                {/* Headers */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Headers</h3>
                  <div className="bg-muted p-3 rounded-lg space-y-1 max-h-[150px] overflow-y-auto">
                    {Object.entries(selectedEvent.headers).map(([key, value]) => (
                      <div key={key} className="text-xs font-mono">
                        <span className="text-primary">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Payload</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReplay(selectedEvent)}
                    >
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Replay
                    </Button>
                  </div>
                  <div className="bg-muted rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <SyntaxHighlighter
                      language="json"
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      {JSON.stringify(selectedEvent.data, null, 2)}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
