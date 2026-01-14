'use client';

import React, { useState } from 'react';
import { Bookmark, FolderOpen, Trash2, Edit2, Plus } from 'lucide-react';
import { SavedRequest, ApiRequest } from '@/types';
import { formatDate } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface SavedRequestsProps {
  savedRequests: SavedRequest[];
  onLoad: (request: ApiRequest) => void;
  onDelete: (id: string) => void;
  onSave: (request: ApiRequest, name: string, tags?: string[]) => void;
  currentRequest?: ApiRequest;
}

export function SavedRequests({
  savedRequests,
  onLoad,
  onDelete,
  onSave,
  currentRequest,
}: SavedRequestsProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestTags, setRequestTags] = useState('');

  const handleSave = () => {
    if (!currentRequest || !requestName.trim()) return;

    const tags = requestTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    onSave(currentRequest, requestName, tags);
    setSaveDialogOpen(false);
    setRequestName('');
    setRequestTags('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Saved Requests
          </CardTitle>
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Save Current
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Request</DialogTitle>
                <DialogDescription>
                  Save the current request configuration for later use
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Name</label>
                  <Input
                    placeholder="My API request"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Tags (comma-separated)</label>
                  <Input
                    placeholder="api, production, test"
                    value={requestTags}
                    onChange={(e) => setRequestTags(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {savedRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No saved requests yet. Save a request to see it here.
          </p>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {savedRequests.map((saved) => (
              <div
                key={saved.id}
                className="p-3 bg-muted hover:bg-muted/80 rounded-lg cursor-pointer transition-colors group"
                onClick={() => onLoad(saved.request)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4 text-primary" />
                    <span className="font-medium">{saved.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(saved.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mb-2">
                  {saved.request.method} {saved.request.endpoint}
                </div>

                {saved.tags && saved.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {saved.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-xs text-muted-foreground mt-2">
                  Last updated: {formatDate(saved.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
