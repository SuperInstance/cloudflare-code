// @ts-nocheck
/**
 * File tree component for browsing project files
 */

'use client';

import * as React from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  Image,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileNode } from '@/types';

interface FileTreeProps {
  files: FileNode[];
  onFileSelect?: (file: FileNode) => void;
  selectedFileId?: string | null;
  className?: string;
}

const FILE_ICONS: Record<string, LucideIcon> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  py: FileCode,
  rs: FileCode,
  go: FileCode,
  java: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
  svg: Image,
};

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  onFileSelect?: (file: FileNode) => void;
  selectedFileId?: string | null;
}

function FileTreeNode({ node, level, onFileSelect, selectedFileId }: FileTreeNodeProps) {
  const [expanded, setExpanded] = React.useState(level < 1);
  const isSelected = selectedFileId === node.id;

  const getIcon = () => {
    if (node.type === 'directory') {
      return expanded ? FolderOpen : Folder;
    }

    const ext = node.name.split('.').pop()?.toLowerCase() || '';
    const Icon = FILE_ICONS[ext] || File;
    return Icon;
  };

  const Icon = getIcon();

  const handleClick = () => {
    if (node.type === 'directory') {
      setExpanded(!expanded);
    } else {
      onFileSelect?.(node);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center space-x-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-accent',
          isSelected && 'bg-accent',
          node.type === 'directory' && 'font-medium'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          <span className="flex-shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        )}
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
      {node.type === 'directory' && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFileId={selectedFileId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ files, onFileSelect, selectedFileId, className }: FileTreeProps) {
  return (
    <div className={cn('space-y-1 overflow-auto custom-scrollbar', className)}>
      {files.map((file) => (
        <FileTreeNode
          key={file.id}
          node={file}
          level={0}
          onFileSelect={onFileSelect}
          selectedFileId={selectedFileId}
        />
      ))}
    </div>
  );
}
