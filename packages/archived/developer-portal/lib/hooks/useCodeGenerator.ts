import { useState, useCallback } from 'react';
import { ApiRequest, CodeSnippet } from '@/types';
import { generateCodeSnippet } from '@/lib/utils/codegen';

export function useCodeGenerator() {
  const [snippets, setSnippets] = useState<Record<string, CodeSnippet>>({});
  const [selectedLanguage, setSelectedLanguage] = useState('typescript');

  const generate = useCallback((request: ApiRequest, language?: string) => {
    const lang = language || selectedLanguage;
    const snippet = generateCodeSnippet(request, lang);

    setSnippets((prev) => ({
      ...prev,
      [lang]: snippet,
    }));

    return snippet;
  }, [selectedLanguage]);

  const generateAll = useCallback((request: ApiRequest) => {
    const languages = [
      'typescript',
      'javascript',
      'python',
      'go',
      'curl',
      'java',
      'rust',
      'php',
    ];

    const newSnippets: Record<string, CodeSnippet> = {};

    languages.forEach((lang) => {
      newSnippets[lang] = generateCodeSnippet(request, lang);
    });

    setSnippets(newSnippets);
    return newSnippets;
  }, []);

  const getSnippet = useCallback((language: string) => {
    return snippets[language];
  }, [snippets]);

  const clearSnippets = useCallback(() => {
    setSnippets({});
  }, []);

  return {
    snippets,
    selectedLanguage,
    setSelectedLanguage,
    generate,
    generateAll,
    getSnippet,
    clearSnippets,
  };
}
