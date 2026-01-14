'use client';

import React, { useState } from 'react';
import { Search, TrendingUp, Clock, MessageSquare, ThumbsUp, Eye } from 'lucide-react';
import { CommunityPost } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime, formatNumber } from '@/lib/utils/cn';

interface ForumProps {
  posts: CommunityPost[];
  onCreatePost: () => void;
}

export function Forum({ posts, onCreatePost }: ForumProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'general', 'api', 'integrations', 'bug-reports', 'feature-requests'];
  const sortedPosts = {
    trending: [...posts].sort((a, b) => b.likes - a.likes),
    latest: [...posts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    unanswered: posts.filter((p) => p.replies.length === 0),
  };

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Developer Forum</h2>
          <p className="text-muted-foreground">
            Connect with other developers and share knowledge
          </p>
        </div>
        <Button onClick={onCreatePost}>Create Post</Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search discussions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((category) => (
          <Badge
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </Badge>
        ))}
      </div>

      {/* Posts */}
      <Tabs defaultValue="latest" className="w-full">
        <TabsList>
          <TabsTrigger value="latest">
            <Clock className="h-4 w-4 mr-2" />
            Latest
          </TabsTrigger>
          <TabsTrigger value="trending">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trending
          </TabsTrigger>
          <TabsTrigger value="unanswered">
            <MessageSquare className="h-4 w-4 mr-2" />
            Unanswered
          </TabsTrigger>
        </TabsList>

        <TabsContent value="latest" className="space-y-4">
          {sortedPosts.latest.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </TabsContent>

        <TabsContent value="trending" className="space-y-4">
          {sortedPosts.trending.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </TabsContent>

        <TabsContent value="unanswered" className="space-y-4">
          {sortedPosts.unanswered.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No unanswered posts
              </CardContent>
            </Card>
          ) : (
            sortedPosts.unanswered.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface PostCardProps {
  post: CommunityPost;
}

function PostCard({ post }: PostCardProps) {
  return (
    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
      <CardContent className="p-6">
        <div className="flex gap-4">
          {/* Author Avatar */}
          <Avatar className="h-12 w-12">
            <AvatarImage src={post.author.avatar} />
            <AvatarFallback>{post.author.name.charAt(0)}</AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-lg hover:underline">
                  {post.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {post.content}
                </p>
              </div>
              <Badge variant="outline">{post.category}</Badge>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{post.author.name}</span>
              <span>•</span>
              <span>{formatDateTime(post.createdAt)}</span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-4 w-4" />
                <span>{formatNumber(post.likes)}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                <span>{post.replies.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{formatNumber(post.views)}</span>
              </div>
            </div>

            {post.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
