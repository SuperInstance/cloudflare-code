'use client';

import React, { useState } from 'react';
import { Search, Download, Star, ExternalLink, Package } from 'lucide-react';
import { Plugin } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatNumber } from '@/lib/utils/cn';

interface PluginShowcaseProps {
  plugins: Plugin[];
  onInstall: (pluginId: string) => void;
  onUninstall: (pluginId: string) => void;
}

export function PluginShowcase({
  plugins,
  onInstall,
  onUninstall,
}: PluginShowcaseProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const allTags = Array.from(
    new Set(plugins.flatMap((p) => p.tags))
  ).slice(0, 10);

  const filteredPlugins = plugins.filter((plugin) => {
    const matchesSearch =
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag =
      selectedTag === 'all' || plugin.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold">Plugin Showcase</h2>
        <p className="text-muted-foreground">
          Extend your workflow with community plugins
        </p>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Badge
              variant={selectedTag === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedTag('all')}
            >
              All
            </Badge>
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTag === tag ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plugins Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onInstall={onInstall}
            onUninstall={onUninstall}
          />
        ))}
      </div>
    </div>
  );
}

interface PluginCardProps {
  plugin: Plugin;
  onInstall: (pluginId: string) => void;
  onUninstall: (pluginId: string) => void;
}

function PluginCard({ plugin, onInstall, onUninstall }: PluginCardProps) {
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    try {
      if (plugin.installed) {
        await onUninstall(plugin.id);
      } else {
        await onInstall(plugin.id);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{plugin.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                v{plugin.version} by {plugin.author}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{plugin.description}</p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Download className="h-4 w-4" />
            <span>{formatNumber(plugin.downloads)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>{plugin.rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex gap-2 flex-wrap">
          {plugin.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Action */}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant={plugin.installed ? 'outline' : 'default'}
            onClick={handleAction}
            disabled={loading}
          >
            {loading
              ? 'Loading...'
              : plugin.installed
              ? 'Uninstall'
              : 'Install'}
          </Button>

          {plugin.repository && (
            <Button variant="outline" size="icon" asChild>
              <a
                href={plugin.repository}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
