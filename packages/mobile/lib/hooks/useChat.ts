/**
 * Chat Hook
 *
 * Custom hook for managing chat state and streaming responses.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../api/client';
import { offlineDb } from '../pwa/offline-db';
import { useNetworkStatus } from '../pwa/network-manager';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  isStreaming?: boolean;
}

export interface UseChatOptions {
  conversationId: string;
  onMessage?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export function useChat({ conversationId, onMessage, onError }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const { isOnline } = useNetworkStatus();

  // Load messages on mount
  useEffect(() => {
    async function loadMessages() {
      try {
        setIsLoading(true);

        // Try API first if online
        if (isOnline) {
          const data = await api.getConversation(conversationId);
          setMessages(data.messages);

          // Cache messages offline
          for (const message of data.messages) {
            await offlineDb.put('messages', message);
          }
        } else {
          // Load from offline storage
          const offlineMessages = await offlineDb.queryByIndex(
            'messages',
            'conversationId',
            conversationId
          );
          setMessages(offlineMessages);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        onError?.(error as Error);
      } finally {
        setIsLoading(false);
      }
    }

    loadMessages();
  }, [conversationId, isOnline, onError]);

  // Send message with streaming
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        content,
        role: 'user',
        timestamp: new Date(),
      };

      // Add user message immediately
      setMessages((prev) => [...prev, userMessage]);
      onMessage?.(userMessage);

      // Store offline if needed
      await offlineDb.put('messages', {
        ...userMessage,
        timestamp: userMessage.timestamp.getTime(),
        pending: !isOnline,
      });

      if (!isOnline) {
        // Queue message for background sync
        const queuedMessage = {
          id: userMessage.id,
          conversationId,
          content,
          role: 'user' as const,
          timestamp: Date.now(),
          pending: true,
        };
        await offlineDb.add('messages', queuedMessage);

        const systemMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: 'Message queued. Will send when you\'re back online.',
          role: 'system',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, systemMessage]);
        return;
      }

      // Stream response
      setIsStreaming(true);
      setCurrentResponse('');

      try {
        abortControllerRef.current = new AbortController();
        let fullResponse = '';

        for await (const chunk of api.streamMessage(conversationId, content)) {
          const data = JSON.parse(chunk);

          if (data.content) {
            fullResponse += data.content;
            setCurrentResponse(fullResponse);
          }

          if (data.done) {
            break;
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
        onMessage?.(assistantMessage);

        // Store offline
        await offlineDb.put('messages', {
          ...assistantMessage,
          timestamp: assistantMessage.timestamp.getTime(),
        });

      } catch (error) {
        console.error('Failed to send message:', error);

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: 'Sorry, I encountered an error. Please try again.',
          role: 'system',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);
        onError?.(error as Error);

      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [conversationId, isStreaming, isOnline, onMessage, onError]
  );

  // Stop streaming
  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setCurrentResponse('');
  }, []);

  // Retry last message
  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');

    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content);
    }
  }, [messages, sendMessage]);

  // Clear all messages
  const clearMessages = useCallback(async () => {
    setMessages([]);
    await offlineDb.delete('messages', conversationId);
  }, [conversationId]);

  return {
    messages,
    isLoading,
    isStreaming,
    currentResponse,
    sendMessage,
    stopStreaming,
    retryLastMessage,
    clearMessages,
  };
}

/**
 * Hook for managing conversations list
 */
export function useConversations() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadConversations() {
      try {
        setIsLoading(true);
        const data = await api.getConversations();
        setConversations(data);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadConversations();
  }, []);

  const createConversation = useCallback(async (title?: string) => {
    try {
      const newConversation = await api.post('/chat/conversations', {
        title: title || 'New Chat',
      });
      setConversations((prev) => [newConversation, ...prev]);
      return newConversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.delete(`/chat/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  }, []);

  return {
    conversations,
    isLoading,
    createConversation,
    deleteConversation,
  };
}
