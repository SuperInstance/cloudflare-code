/**
 * Chat Page
 *
 * Main chat interface with streaming support.
 */

// @ts-nocheck - External React/Next.js dependencies
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical, Phone } from 'lucide-react';
import { TopNav } from '@/components/ui/BottomNav';
import { ChatMessage, ChatInput } from '@/components/chat';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { PullToRefresh } from '@/components/ui/Loading';
import { api, offlineDb } from '@/lib/api/client';
import { useNetworkStatus } from '@/lib/pwa/network-manager';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  isStreaming?: boolean;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const { isOnline } = useNetworkStatus();

  // Load conversation
  useEffect(() => {
    async function loadMessages() {
      try {
        const data = await api.getConversation(conversationId);
        setMessages(data.messages);
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (conversationId) {
      loadMessages();
    }
  }, [conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentResponse]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setCurrentResponse('');

    // If online, stream response
    if (isOnline) {
      try {
        let fullResponse = '';

        for await (const chunk of api.streamMessage(conversationId, content)) {
          const data = JSON.parse(chunk);
          if (data.content) {
            fullResponse += data.content;
            setCurrentResponse(fullResponse);
          }
        }

        // Add assistant message
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: fullResponse,
          role: 'assistant',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentResponse('');

      } catch (error) {
        console.error('Failed to send message:', error);

        // Add error message
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: 'Sorry, I encountered an error. Please try again.',
          role: 'system',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsStreaming(false);
      }
    } else {
      // Offline - queue message
      await offlineDb.add('messages', {
        id: Date.now().toString(),
        conversationId,
        content,
        role: 'user',
        timestamp: Date.now(),
        pending: true,
      });

      // Add offline indicator
      const offlineMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Message queued. Will send when you\'re back online.',
        role: 'system',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, offlineMessage]);
      setIsStreaming(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const data = await api.getConversation(conversationId);
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <TopNav
        title="Chat"
        onBack={() => router.back()}
        actions={
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <MoreVertical className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        }
      />

      {/* Messages */}
      <PullToRefresh isRefreshing={isLoading} onRefresh={handleRefresh}>
        <div className="flex-1 overflow-y-auto pb-safe">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4">
                <Phone className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Start a conversation
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ask anything about your code or projects
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {messages.map((message) => (
                <ChatMessage key={message.id} {...message} />
              ))}

              {/* Current streaming response */}
              {isStreaming && currentResponse && (
                <ChatMessage
                  id="streaming"
                  content={currentResponse}
                  role="assistant"
                  timestamp={new Date()}
                  isStreaming
                />
              )}

              {/* Typing indicator */}
              {isStreaming && !currentResponse && (
                <div className="bg-white dark:bg-gray-900">
                  <TypingIndicator />
                </div>
              )}
            </div>
          )}

          {/* Spacer for scrolling */}
          <div ref={messagesEndRef} />
        </div>
      </PullToRefresh>

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isStreaming}
        placeholder={isOnline ? 'Type a message...' : 'Offline - messages will be queued'}
      />

      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-gray-800 text-white text-xs text-center py-1 px-4">
          You're offline. Messages will be sent when you reconnect.
        </div>
      )}
    </div>
  );
}
