'use client';

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface SyntaxHighlighterProps {
  language: string;
  code: string;
}

export function CustomSyntaxHighlighter({ language, code }: SyntaxHighlighterProps) {
  return (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      customStyle={{
        margin: 0,
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
