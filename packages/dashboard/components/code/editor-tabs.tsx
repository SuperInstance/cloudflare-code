// @ts-nocheck
/**
 * Editor tabs component for open files
 */

'use client';

import * as React from 'react';
import { X, Close } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/lib/store';

export function EditorTabs() {
  const { openFiles, activeFileId, setActiveFile, closeFile, updateFileContent } = useEditorStore();

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
      <div className="flex">
        {openFiles.map((file) => (
          <div
            key={file.id}
            className={cn(
              'group flex items-center space-x-2 border-r px-4 py-2 text-sm cursor-pointer hover:bg-background/50 transition-colors',
              activeFileId === file.id
                ? 'bg-background border-b-2 border-b-primary'
                : 'border-b-2 border-b-transparent'
            )}
            onClick={() => setActiveFile(file.id)}
          >
            <span className={cn('truncate max-w-[150px]', file.modified && 'font-medium')}>
              {file.name}
              {file.modified && ' •'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.id);
              }}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EditorPanelProps {
  activeFile: {
    id: string;
    name: string;
    path: string;
    content: string;
    modified: boolean;
  } | null;
  onChange?: (content: string) => void;
}

export function EditorPanel({ activeFile, onChange }: EditorPanelProps) {
  if (!activeFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2">No file selected</p>
          <p className="text-sm">Select a file from the file tree to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full">
      {/* File info bar */}
      <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground bg-muted/30">
        <span className="truncate">{activeFile.path}</span>
        {activeFile.modified && (
          <span className="text-foreground font-medium">Modified</span>
        )}
      </div>
    </div>
  );
}
