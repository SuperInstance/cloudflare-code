/**
 * Chat Message Component
 *
 * Mobile-optimized chat message with markdown and code syntax highlighting.
 */

'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';

export interface ChatMessageProps {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date | string;
  isStreaming?: boolean;
}

export function ChatMessage({ content, role, timestamp, isStreaming }: ChatMessageProps) {
  const [copied, setCopied] = React.useState(false);
  const isUser = role === 'user';

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        isUser ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-gradient-to-br from-accent-400 to-accent-600 text-white'
        )}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {isUser ? 'You' : 'Claude'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatRelativeTime(timestamp)}
          </span>
          {isStreaming && (
            <span className="text-xs text-primary-600 dark:text-primary-400">typing...</span>
          )}
        </div>

        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';

                if (!inline && language) {
                  return (
                    <div className="relative group my-2">
                      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 rounded-t-lg text-xs text-gray-400">
                        <span>{language}</span>
                        <button
                          onClick={() => handleCopy(String(children).replace(/\n$/, ''))}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                        >
                          {copied ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <SyntaxHighlighter
                        style={oneDark}
                        language={language}
                        PreTag="div"
                        className="!mt-0 !rounded-t-none"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  );
                }

                return (
                  <code
                    className={cn(
                      'px-1.5 py-0.5 rounded text-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                      className
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              p({ children }) {
                return <p className="mb-2 last:mb-0">{children}</p>;
              },
              ul({ children }) {
                return <ul className="mb-2 ml-4 list-disc">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="mb-2 ml-4 list-decimal">{children}</ol>;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

/**
 * Chat input component
 */
export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Type a message...' }: ChatInputProps) {
  const [message, setMessage] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-white border-t dark:bg-gray-900 dark:border-gray-800">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-4 py-3 bg-gray-100 border-0 rounded-full focus:ring-2 focus:ring-primary-600 focus:bg-white transition-colors dark:bg-gray-800 dark:focus:bg-gray-700"
      />
      <button
        type="submit"
        disabled={!message.trim() || disabled}
        className={cn(
          'p-3 rounded-full transition-all duration-200',
          message.trim() && !disabled
            ? 'bg-primary-600 text-white hover:bg-primary-700 active:scale-95'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800'
        )}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </form>
  );
}
