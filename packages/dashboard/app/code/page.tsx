/**
 * Code editor page
 */

'use client';

import * as React from 'react';
import { PanelLeft, PanelLeftClose, Save, Play, Settings } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { FileTree } from '@/components/code/file-tree';
import { EditorTabs } from '@/components/code/editor-tabs';
import CodeEditor from '@/components/code/monaco-editor';
import { useEditorStore, useDashboardStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { getLanguageFromExtension } from '@/lib/utils';
import type { FileNode } from '@/types';

export default function CodePage() {
  const { currentProject } = useDashboardStore();
  const { openFiles, activeFileId, setActiveFile, updateFileContent, sidebarOpen, setSidebarOpen } =
    useEditorStore();
  const [files, setFiles] = React.useState<FileNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = React.useState(true);

  const activeFile = openFiles.find((f) => f.id === activeFileId) || null;

  React.useEffect(() => {
    if (currentProject) {
      loadFiles();
    }
  }, [currentProject]);

  const loadFiles = async () => {
    if (!currentProject) return;

    try {
      setLoading(true);
      const response = await apiClient.getProjectFiles(currentProject.id);
      if (response.success) {
        setFiles(response.data);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: FileNode) => {
    if (file.type === 'directory') return;

    // Check if file is already open
    const existingFile = openFiles.find((f) => f.id === file.id);
    if (existingFile) {
      setActiveFile(file.id);
      return;
    }

    // Load file content
    if (!currentProject) return;

    try {
      const response = await apiClient.getFileContent(currentProject.id, file.path);
      if (response.success) {
        const newFile = {
          id: file.id,
          name: file.name,
          path: file.path,
          content: response.data.content,
          modified: false,
        };

        // This would be handled by the store
        // useEditorStore.getState().openFile(newFile);
      }
    } catch (error) {
      console.error('Failed to load file content:', error);
    }
  };

  const handleContentChange = (content: string) => {
    if (activeFile) {
      updateFileContent(activeFile.id, content);
    }
  };

  const handleSave = async () => {
    if (!activeFile || !currentProject || !activeFile.modified) return;

    try {
      setSaving(true);
      await apiClient.updateFileContent(currentProject.id, activeFile.path, activeFile.content);
      // Update file modified state in store
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          >
            {leftPanelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          <span className="text-sm font-medium">
            {currentProject?.name || 'Select a project'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon">
            <Play className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!activeFile?.modified || saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - File Tree */}
        {leftPanelOpen && (
          <div className="w-64 border-r bg-background">
            <div className="h-full overflow-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <FileTree
                  files={files}
                  onFileSelect={handleFileSelect}
                  selectedFileId={activeFileId}
                />
              )}
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorTabs />

          <div className="flex-1 overflow-hidden">
            {activeFile ? (
              <CodeEditor
                value={activeFile.content}
                onChange={handleContentChange}
                language={getLanguageFromExtension(activeFile.name.split('.').pop() || '')}
                height="100%"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg font-medium mb-2">No file selected</p>
                  <p className="text-sm">Select a file from the file tree to edit</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
