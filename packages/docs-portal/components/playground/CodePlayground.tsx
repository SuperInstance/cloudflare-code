'use client';

import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Copy, Download, Settings, Maximize2, Minimize2 } from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import type { PlaygroundState, PlaygroundResult, PlaygroundPreset } from '@/types';

// ============================================================================
// Code Playground Component
// ============================================================================

interface CodePlaygroundProps {
  presets?: PlaygroundPreset[];
  defaultCode?: string;
  defaultLanguage?: string;
  onRun?: (code: string, language: string) => Promise<PlaygroundResult>;
  className?: string;
}

export function CodePlayground({
  presets = [],
  defaultCode = '// Write your code here\n',
  defaultLanguage = 'javascript',
  onRun,
  className,
}: CodePlaygroundProps) {
  const [code, setCode] = useState(defaultCode);
  const [language, setLanguage] = useState(defaultLanguage);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Partial<PlaygroundState>>({
    fontSize: 14,
    wordWrap: true,
    lineNumbers: true,
    minimap: false,
    autoRun: false,
  });
  const editorRef = useRef<any>(null);

  const handleRun = async () => {
    if (!onRun) return;
    setIsRunning(true);
    setResult(null);

    try {
      const startTime = Date.now();
      const runResult = await onRun(code, language);
      setResult({
        ...runResult,
        executionTime: Date.now() - startTime,
      });
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setCode(defaultCode);
    setResult(null);
  };

  const handleCopy = async () => {
    await copyToClipboard(code);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePresetSelect = (preset: PlaygroundPreset) => {
    setCode(preset.code);
    setLanguage(preset.language as any);
    setResult(null);
  };

  useEffect(() => {
    if (settings.autoRun && !result) {
      const timer = setTimeout(() => handleRun(), 1000);
      return () => clearTimeout(timer);
    }
  }, [code, settings.autoRun]);

  return (
    <div
      className={cn(
        'flex flex-col border border-border rounded-lg overflow-hidden',
        isFullscreen && 'fixed inset-4 z-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-2 py-1 text-sm rounded bg-background border border-border"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="go">Go</option>
          </select>

          {presets.length > 0 && (
            <select
              onChange={(e) => {
                const preset = presets.find((p) => p.id === e.target.value);
                if (preset) handlePresetSelect(preset);
              }}
              className="px-2 py-1 text-sm rounded bg-background border border-border"
            >
              <option value="">Load preset...</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded hover:bg-muted-foreground/10 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded hover:bg-muted-foreground/10 transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-2 rounded hover:bg-muted-foreground/10 transition-colors"
            title="Copy"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded hover:bg-muted-foreground/10 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded hover:bg-muted-foreground/10 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-muted/50 border-b border-border space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Font Size</label>
              <input
                type="number"
                value={settings.fontSize}
                onChange={(e) => setSettings({ ...settings, fontSize: Number(e.target.value) })}
                className="w-full px-2 py-1 text-sm rounded bg-background border border-border mt-1"
                min={10}
                max={24}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wordwrap"
                checked={settings.wordWrap}
                onChange={(e) => setSettings({ ...settings, wordWrap: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="wordwrap" className="text-sm">
                Word Wrap
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="linenumbers"
                checked={settings.lineNumbers}
                onChange={(e) => setSettings({ ...settings, lineNumbers: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="linenumbers" className="text-sm">
                Line Numbers
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="minimap"
                checked={settings.minimap}
                onChange={(e) => setSettings({ ...settings, minimap: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="minimap" className="text-sm">
                Minimap
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-[400px]">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => setCode(value || '')}
          onMount={(editor) => {
            editorRef.current = editor;
            editor.focus();
          }}
          theme="vs-dark"
          options={{
            fontSize: settings.fontSize,
            wordWrap: settings.wordWrap ? 'on' : 'off',
            lineNumbers: settings.lineNumbers ? 'on' : 'off',
            minimap: { enabled: settings.minimap },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            folding: true,
            contextmenu: true,
          }}
        />
      </div>

      {/* Output */}
      <div className="border-t border-border">
        <div className="flex items-center justify-between px-4 py-2 bg-muted">
          <span className="text-sm font-medium">Output</span>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              isRunning
                ? 'bg-muted-foreground/50 cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            <Play className="w-4 h-4" />
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>

        <div className="p-4 bg-background min-h-[150px] max-h-[300px] overflow-auto">
          {result ? (
            <div className="space-y-2">
              {result.success ? (
                <>
                  <div className="text-sm text-green-500 font-mono whitespace-pre-wrap">
                    {result.output}
                  </div>
                  {result.tokens && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Tokens: {result.tokens.prompt} prompt + {result.tokens.completion} completion ={' '}
                      {result.tokens.total} total
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Executed in {result.executionTime}ms
                  </div>
                </>
              ) : (
                <div className="text-sm text-red-500 font-mono whitespace-pre-wrap">
                  {result.error}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Click "Run" to execute your code
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Quick Preset Component
// ============================================================================

interface QuickPresetProps {
  preset: PlaygroundPreset;
  onSelect: (preset: PlaygroundPreset) => void;
}

export function QuickPreset({ preset, onSelect }: QuickPresetProps) {
  return (
    <button
      onClick={() => onSelect(preset)}
      className="w-full p-4 text-left rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
    >
      <div className="font-medium text-foreground">{preset.name}</div>
      <div className="text-sm text-muted-foreground mt-1">{preset.description}</div>
      <div className="flex gap-1 mt-2">
        {preset.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

// ============================================================================
// Preset Grid Component
// ============================================================================

interface PresetGridProps {
  presets: PlaygroundPreset[];
  onSelect: (preset: PlaygroundPreset) => void;
  category?: string;
}

export function PresetGrid({ presets, onSelect, category }: PresetGridProps) {
  const filteredPresets = category
    ? presets.filter((p) => p.category === category)
    : presets;

  const categories = Array.from(new Set(presets.map((p) => p.category)));

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onSelect({ ...presets[0], category: '' } as any)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              !category
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelect({ ...presets[0], category: cat } as any)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                category === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPresets.map((preset) => (
          <QuickPreset key={preset.id} preset={preset} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
