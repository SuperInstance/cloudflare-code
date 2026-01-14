/**
 * New Chat Page
 *
 * Create a new conversation or continue existing ones.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquarePlus } from 'lucide-react';
import { TopNav } from '@/components/ui/BottomNav';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api/client';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

export default function NewChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadConversations() {
      try {
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

  const handleNewChat = async () => {
    try {
      const newConversation = await api.post('/chat/conversations', {
        title: 'New Chat',
      });
      router.push(`/chat/${newConversation.id}`);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <TopNav
        title="New Chat"
        onBack={() => router.back()}
      />

      {/* Main Content */}
      <div className="p-4">
        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          className="w-full p-4 mb-4 bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl text-white font-medium shadow-lg active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquarePlus className="w-5 h-5" />
            <span>Start New Chat</span>
          </div>
        </button>

        {/* Recent Conversations */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Recent Conversations
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 bg-gray-100 rounded-xl animate-pulse dark:bg-gray-800">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2 dark:bg-gray-700" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquarePlus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No conversations yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <Card
                  key={conversation.id}
                  interactive
                  onClick={() => router.push(`/chat/${conversation.id}`}
                  className="p-4"
                >
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {conversation.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                    {conversation.lastMessage}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
