'use client';

// @ts-nocheck
import React, { useState } from 'react';
import { Forum } from '@/components/community/Forum';
import { CodeSharing } from '@/components/community/CodeSharing';
import { PluginShowcase } from '@/components/community/PluginShowcase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommunityPost, CodeShare, Plugin } from '@/types';

export default function CommunityPage() {
  const [posts] = useState<CommunityPost[]>([
    {
      id: '1',
      title: 'How to handle rate limits effectively?',
      content:
        'I am building an application that makes many requests to ClaudeFlare. What are the best practices for handling rate limits?',
      author: {
        id: 'user1',
        name: 'John Doe',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
      },
      category: 'api',
      tags: ['rate-limiting', 'best-practices', 'api'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      likes: 42,
      replies: [],
      views: 234,
    },
    {
      id: '2',
      title: 'New integration with Next.js 14',
      content:
        'Just published a new package for integrating ClaudeFlare with Next.js 14 App Router. Check it out!',
      author: {
        id: 'user2',
        name: 'Jane Smith',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane',
      },
      category: 'integrations',
      tags: ['nextjs', 'integration', 'app-router'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      likes: 156,
      replies: [],
      views: 892,
    },
    {
      id: '3',
      title: 'Feature request: Webhook retry settings',
      content:
        'It would be great to have more control over webhook retry settings, such as custom backoff strategies.',
      author: {
        id: 'user3',
        name: 'Bob Johnson',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
      },
      category: 'feature-requests',
      tags: ['webhooks', 'features', 'retry'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      likes: 89,
      replies: [],
      views: 456,
    },
  ]);

  const [snippets] = useState<CodeShare[]>([
    {
      id: '1',
      title: 'TypeScript API Client',
      description:
        'A fully typed TypeScript client for ClaudeFlare API with retry logic and error handling',
      code: `import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.claudeflare.dev',
  timeout: 30000,
});

export async function sendMessage(messages: any[]) {
  const response = await client.post('/v1/completions', {
    model: 'claude-3-opus',
    messages,
    max_tokens: 1024,
  });
  return response.data;
}`,
      language: 'typescript',
      author: {
        id: 'user1',
        name: 'Alice Cooper',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      },
      tags: ['typescript', 'api', 'client'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      likes: 234,
      forks: 45,
    },
    {
      id: '2',
      title: 'Python Async Client',
      description:
        'Async Python client using aiohttp for high-performance applications',
      code: `import aiohttp
import asyncio

async def send_message(messages):
    async with aiohttp.ClientSession() as session:
        async with session.post(
            'https://api.claudeflare.dev/v1/completions',
            json={
                'model': 'claude-3-opus',
                'messages': messages,
                'max_tokens': 1024,
            }
        ) as response:
            return await response.json()`,
      language: 'python',
      author: {
        id: 'user2',
        name: 'Charlie Brown',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
      },
      tags: ['python', 'async', 'aiohttp'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      likes: 189,
      forks: 32,
    },
  ]);

  const [plugins] = useState<Plugin[]>([
    {
      id: '1',
      name: 'VS Code Extension',
      description:
        'Official VS Code extension for ClaudeFlare with syntax highlighting and IntelliSense',
      version: '1.2.0',
      author: 'ClaudeFlare Team',
      icon: '🧩',
      downloads: 12543,
      rating: 4.8,
      tags: ['vscode', 'editor', 'ide'],
      repository: 'https://github.com/claudeflare/vscode-extension',
      installed: false,
    },
    {
      id: '2',
      name: 'CLI Tool',
      description:
        'Command-line interface for interacting with ClaudeFlare APIs from your terminal',
      version: '2.0.1',
      author: 'ClaudeFlare Community',
      icon: '⚡',
      downloads: 8765,
      rating: 4.6,
      tags: ['cli', 'terminal', 'tooling'],
      repository: 'https://github.com/claudeflare/cli',
      installed: true,
    },
    {
      id: '3',
      name: 'React Hooks',
      description:
        'Custom React hooks for easy integration with ClaudeFlare in your React applications',
      version: '1.0.5',
      author: 'Community Contributor',
      icon: '⚛️',
      downloads: 5432,
      rating: 4.9,
      tags: ['react', 'hooks', 'frontend'],
      repository: 'https://github.com/claudeflare/react-hooks',
      installed: false,
    },
  ]);

  const handleCreatePost = () => {
    console.log('Create post');
  };

  const handleShareCode = () => {
    console.log('Share code');
  };

  const handleInstallPlugin = (pluginId: string) => {
    console.log('Install plugin:', pluginId);
  };

  const handleUninstallPlugin = (pluginId: string) => {
    console.log('Uninstall plugin:', pluginId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Developer Community</h1>
            <p className="text-sm text-muted-foreground">
              Connect, share, and learn from other developers
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="forum" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="forum">Forum</TabsTrigger>
            <TabsTrigger value="code">Code Sharing</TabsTrigger>
            <TabsTrigger value="plugins">Plugin Showcase</TabsTrigger>
          </TabsList>

          <TabsContent value="forum" className="mt-6">
            <Forum posts={posts} onCreatePost={handleCreatePost} />
          </TabsContent>

          <TabsContent value="code" className="mt-6">
            <CodeSharing snippets={snippets} onShare={handleShareCode} />
          </TabsContent>

          <TabsContent value="plugins" className="mt-6">
            <PluginShowcase
              plugins={plugins}
              onInstall={handleInstallPlugin}
              onUninstall={handleUninstallPlugin}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
