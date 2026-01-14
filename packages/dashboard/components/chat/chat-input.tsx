/**
 * Chat input component
 */

'use client';

import * as React from 'react';
import { Send, Square, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
  placeholder = 'Type your message...',
  className,
}: ChatInputProps) {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  React.useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  return (
    <div className={cn('border-t bg-background p-4', className)}>
      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={disabled}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[60px] max-h-[200px] resize-none pr-12"
          />
        </div>

        <Button
          onClick={isStreaming ? onStop : handleSubmit}
          disabled={disabled || (!value.trim() && !isStreaming)}
          size="icon"
          className={cn(
            'shrink-0 h-10 w-10',
            isStreaming && 'bg-destructive hover:bg-destructive/90'
          )}
        >
          {isStreaming ? (
            <Square className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <p>Press Enter to send, Shift + Enter for new line</p>
        <p>{value.length} characters</p>
      </div>
    </div>
  );
}
