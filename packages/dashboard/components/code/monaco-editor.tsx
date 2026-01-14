/**
 * Monaco Editor component for code editing
 */

'use client';

import * as React from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';
import { useEditorStore } from '@/lib/store';

loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs',
  },
});

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
  minimap?: boolean;
  fontSize?: number;
  theme?: 'light' | 'dark';
}

export function CodeEditor({
  value,
  onChange,
  language = 'typescript',
  readOnly = false,
  height = '600px',
  minimap = true,
  fontSize = 14,
  theme = 'dark',
}: CodeEditorProps) {
  const editorRef = React.useRef<any>(null);
  const { setCursorPosition } = useEditorStore();

  const handleEditorDidMount: OnMount = (editor, monaco: Monaco) => {
    editorRef.current = editor;

    // Set up editor options
    editor.updateOptions({
      fontSize,
      minimap: { enabled: minimap },
      readOnly,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      lineNumbers: 'on' as const,
      renderWhitespace: 'selection' as const,
      cursorBlinking: 'smooth' as const,
      cursorSmoothCaretAnimation: 'on' as const,
      smoothScrolling: true,
      folding: true,
      foldingStrategy: 'indentation' as const,
      showFoldingControls: 'always' as const,
      formatOnPaste: true,
      formatOnType: true,
      autoIndent: 'full' as const,
    });

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({
        line: e.position.lineNumber,
        column: e.position.column,
      });
    });

    // Set up custom theme
    monaco.editor.defineTheme('claudeflare-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
      },
    });

    monaco.editor.defineTheme('claudeflare-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000' },
        { token: 'keyword', foreground: '0000ff' },
        { token: 'string', foreground: 'a31515' },
        { token: 'number', foreground: '098658' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#000000',
        'editorLineNumber.foreground': '#237893',
        'editorLineNumber.activeForeground': '#000000',
        'editor.selectionBackground': '#add6ff',
        'editor.inactiveSelectionBackground': '#e5ebf1',
      },
    });

    // Apply theme
    monaco.editor.setTheme(theme === 'dark' ? 'claudeflare-dark' : 'claudeflare-light');
  };

  const handleChange = (value: string | undefined) => {
    onChange?.(value || '');
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme={theme}
        options={{
          readOnly,
          minimap: { enabled: minimap },
          fontSize,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}

export default CodeEditor;
