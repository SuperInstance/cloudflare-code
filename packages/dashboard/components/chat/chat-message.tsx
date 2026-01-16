// @ts-nocheck
/**
 * Chat message component
 */

'use client';

import * as React from 'react';
import { User, Bot, Check, CheckCheck, Copy, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, copyToClipboard, formatRelativeTime } from '@/lib/utils';
import { useChatStore } from '@/lib/store';
import type { ChatMessage } from '@/types';

interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessageComponent({ message }: ChatMessageProps) {
  const { updateMessage } = useChatStore();
  const [copied, setCopied] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);

  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';

  const handleCopy = async () => {
    const success = await copyToClipboard(message.content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = () => {
    setRegenerating(true);
    // TODO: Trigger regeneration
    setTimeout(() => setRegenerating(false), 1000);
  };

  return (
    <div
      className={cn(
        'flex gap-4 p-4 rounded-lg',
        isUser ? 'bg-muted/50' : 'bg-background'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md',
          isUser ? 'bg-primary' : 'bg-secondary'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-secondary-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {isUser ? 'You' : 'Claude'}
            {message.metadata?.model && (
              <span className="ml-2 text-xs text-muted-foreground">
                {message.metadata.model}
              </span>
            )}
          </p>
          <div className="flex items-center space-x-1">
            {message.metadata?.tokens && (
              <span className="text-xs text-muted-foreground">
                {message.metadata.tokens.total} tokens
              </span>
            )}
            {message.metadata?.latency && (
              <span className="text-xs text-muted-foreground">
                {message.metadata.latency}ms
              </span>
            )}
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none">
          {isStreaming && message.content === '' ? (
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.4s]" />
              </div>
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {/* Actions */}
        {!isUser && message.status === 'completed' && (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={handleCopy}
            >
              <Copy className="h-3 w-3 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
          </div>
        )}
      </div>

      {/* Status */}
      {message.status && (
        <div className="flex items-center">
          {message.status === 'completed' ? (
            <CheckCheck className="h-4 w-4 text-green-600" />
          ) : message.status === 'streaming' ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : message.status === 'error' ? (
            <div className="h-4 w-4 rounded-full bg-destructive" />
          ) : null}
        </div>
      )}
    </div>
  );
}
