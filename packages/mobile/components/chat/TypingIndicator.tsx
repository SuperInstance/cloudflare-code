/**
 * Typing Indicator Component
 *
 * Animated typing indicator for chat.
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface TypingIndicatorProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TypingIndicator({ className, size = 'md' }: TypingIndicatorProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <div className={cn('flex items-center gap-1 px-4 py-2', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full bg-primary-600 animate-bounce',
            sizeClasses[size]
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '1.4s',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Streaming text component
 */
export interface StreamingTextProps {
  text: string;
  speed?: number;
  className?: string;
}

export function StreamingText({ text, speed = 20, className }: StreamingTextProps) {
  const [displayedText, setDisplayedText] = React.useState('');

  React.useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span className={className}>
      {displayedText}
      {displayedText.length < text.length && (
        <span className="inline-block w-2 h-4 bg-primary-600 ml-0.5 animate-pulse" />
      )}
    </span>
  );
}
