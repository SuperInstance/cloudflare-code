// @ts-nocheck
/**
 * Chat interface page
 */

'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { ChatMessageComponent } from '@/components/chat/chat-message';
import { ChatInput } from '@/components/chat/chat-input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useChatStore, useDashboardStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import type { ChatMessage, ChatSession } from '@/types';

export default function ChatPage() {
  const { currentProject } = useDashboardStore();
  const { messages, isStreaming, setStreaming, addMessage, updateMessage } = useChatStore();
  const [sessions, setSessions] = React.useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = React.useState<ChatSession | null>(null);
  const [model, setModel] = React.useState('claude-3-opus-20240229');
  const [provider, setProvider] = React.useState<'anthropic' | 'openai'>('anthropic');
  const [temperature, setTemperature] = React.useState(0.7);
  const [maxTokens, setMaxTokens] = React.useState(4096);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    loadSessions();
  }, [currentProject]);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSessions = async () => {
    try {
      const response = await apiClient.getChatSessions(currentProject?.id);
      if (response.success) {
        setSessions(response.data);
        if (response.data.length > 0 && !currentSession) {
          setCurrentSession(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string) => {
    if (!currentSession) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: currentSession.id,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'completed',
    };
    addMessage(userMessage);

    // Add placeholder assistant message
    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      sessionId: currentSession.id,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
    };
    addMessage(assistantMessage);
    setStreaming(true, assistantMessage.id);

    try {
      abortControllerRef.current = new AbortController();

      await apiClient.streamChatMessage(
        {
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
          model,
          temperature,
          maxTokens,
          stream: true,
          sessionId: currentSession.id,
        },
        (chunk) => {
          updateMessage(assistantMessage.id, {
            content: assistantMessage.content + chunk,
          });
        },
        (metadata) => {
          updateMessage(assistantMessage.id, {
            status: 'completed',
            metadata,
          });
          setStreaming(false);
        },
        (error) => {
          updateMessage(assistantMessage.id, {
            status: 'error',
          });
          setStreaming(false);
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      updateMessage(assistantMessage.id, {
        status: 'error',
        content: 'Failed to generate response. Please try again.',
      });
      setStreaming(false);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setStreaming(false);
  };

  const handleNewSession = async () => {
    try {
      const response = await apiClient.createChatSession({
        projectId: currentProject?.id,
        title: `Chat ${new Date().toLocaleString()}`,
        settings: {
          model,
          provider,
          temperature,
          maxTokens,
          stream: true,
        },
      });

      if (response.success) {
        setSessions([response.data, ...sessions]);
        setCurrentSession(response.data);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  return (
    <MainLayout title="Chat">
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
        {/* Settings Bar */}
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div className="flex items-center gap-4">
            <Select value={provider} onValueChange={(value: any) => setProvider(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>

            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Temp:</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-sm w-12">{temperature.toFixed(1)}</span>
            </div>
          </div>

          <Button onClick={handleNewSession} variant="outline">
            New Chat
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto rounded-lg border bg-card p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">Start a conversation</p>
                <p className="text-sm">Send a message to begin chatting with Claude</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessageComponent key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSendMessage}
          onStop={handleStop}
          disabled={isStreaming || !currentSession}
          isStreaming={isStreaming}
        />
      </div>
    </MainLayout>
  );
}
