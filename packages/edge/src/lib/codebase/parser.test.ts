/**
 * Unit Tests for Codebase Parser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodebaseParser } from './parser';

describe('CodebaseParser', () => {
  let parser: CodebaseParser;

  beforeEach(() => {
    parser = new CodebaseParser();
  });

  describe('parseFile', () => {
    it('should parse TypeScript code', async () => {
      const code = `
interface User {
  id: number;
  name: string;
}

export class UserService {
  async getUser(id: number): Promise<User> {
    return { id, name: 'Test' };
  }
}

export function formatDate(date: Date): string {
  return date.toISOString();
}
`;

      const result = await parser.parseFile(code, 'src/services/UserService.ts');

      expect(result.language).toBe('typescript');
      expect(result.path).toBe('src/services/UserService.ts');
      expect(result.lineCount).toBeGreaterThan(0);
      expect(result.structure.classes).toContain('UserService');
      expect(result.structure.interfaces).toContain('User');
      expect(result.structure.functions).toContain('formatDate');
    });

    it('should parse JavaScript code', async () => {
      const code = `
export class Calculator {
  add(a, b) {
    return a + b;
  }
}

export function multiply(a, b) {
  return a * b;
}
`;

      const result = await parser.parseFile(code, 'utils/calculator.js');

      expect(result.language).toBe('javascript');
      expect(result.structure.classes).toContain('Calculator');
      expect(result.structure.functions).toContain('multiply');
    });

    it('should parse Python code', async () => {
      const code = `
class DataProcessor:
    def process(self, data):
        return data

def transform(input):
    return input.upper()
`;

      const result = await parser.parseFile(code, 'processor.py');

      expect(result.language).toBe('python');
      expect(result.structure.classes).toContain('DataProcessor');
      expect(result.structure.functions).toContain('process');
      expect(result.structure.functions).toContain('transform');
    });

    it('should extract imports', async () => {
      const code = `
import { useState, useEffect } from 'react';
import type { User } from './types';
import axios from 'axios';
`;

      const result = await parser.parseFile(code, 'hooks/useUser.ts');

      expect(result.imports).toHaveLength(3);
      expect(result.imports[0].module).toBe('react');
      expect(result.imports[0].symbols).toContain('useState');
    });

    it('should extract exports', async () => {
      const code = `
export function helper() {}
export class Service {}
export default class DefaultClass {}
`;

      const result = await parser.parseFile(code, 'utils.ts');

      expect(result.exports).toHaveLength(3);
      expect(result.exports.some(e => e.name === 'helper' && !e.isDefault)).toBe(true);
      expect(result.exports.some(e => e.name === 'Service' && !e.isDefault)).toBe(true);
    });

    it('should parse JSON files', async () => {
      const code = '{"name": "test", "version": "1.0.0"}';
      const result = await parser.parseFile(code, 'package.json');

      expect(result.language).toBe('json');
    });

    it('should parse Markdown files', async () => {
      const code = `# Title

## Section 1

Some content.

\`\`\`typescript
const x = 1;
\`\`\`
`;
      const result = await parser.parseFile(code, 'README.md');

      expect(result.language).toBe('markdown');
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript from .ts extension', async () => {
      const result = await parser.parseFile('const x = 1;', 'file.ts');
      expect(result.language).toBe('typescript');
    });

    it('should detect JavaScript from .js extension', async () => {
      const result = await parser.parseFile('const x = 1;', 'file.js');
      expect(result.language).toBe('javascript');
    });

    it('should detect Python from .py extension', async () => {
      const result = await parser.parseFile('x = 1', 'file.py');
      expect(result.language).toBe('python');
    });

    it('should detect language from content when extension is unknown', async () => {
      const code = 'interface Test { value: string; }';
      const result = await parser.parseFile(code, 'unknown.ext');
      expect(result.language).toBe('typescript');
    });
  });

  describe('parseBatch', () => {
    it('should parse multiple files in parallel', async () => {
      const files = [
        { content: 'export const a = 1;', path: 'a.ts' },
        { content: 'export const b = 2;', path: 'b.ts' },
        { content: 'export const c = 3;', path: 'c.ts' },
      ];

      const results = await parser.parseBatch(files);

      expect(results).toHaveLength(3);
      expect(results[0].path).toBe('a.ts');
      expect(results[1].path).toBe('b.ts');
      expect(results[2].path).toBe('c.ts');
    });

    it('should handle empty array', async () => {
      const results = await parser.parseBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('performance', () => {
    it('should parse 1MB file in reasonable time', async () => {
      const largeCode = 'export function test() { return '.repeat(50000) + '1; }';

      const start = performance.now();
      await parser.parseFile(largeCode, 'large.ts');
      const duration = performance.now() - start;

      // Should parse in less than 100ms (relaxed for test environment)
      expect(duration).toBeLessThan(500);
    });
  });
});
