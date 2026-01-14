/**
 * Code Review System Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CodeReviewSystem,
  createCodeReviewSystem,
  reviewCode,
  createStaticAnalyzer,
  createSecurityScanner,
  createQualityChecker,
  createRuleEngine,
  createPerformanceAnalyzer,
  createReportGenerator,
  getTotalRuleCount,
  getRuleCountByCategory,
} from './index';
import { GitHubClient } from '../github/client';

describe('CodeReviewSystem', () => {
  let system: CodeReviewSystem;

  beforeEach(() => {
    system = createCodeReviewSystem();
  });

  describe('reviewCode', () => {
    it('should review code files', async () => {
      const files = [
        {
          path: 'src/index.ts',
          content: `
function calculateSum(a: number, b: number): number {
  return a + b;
}

class Calculator {
  add(x: number, y: number): number {
    return x + y;
  }
}
          `,
        },
      ];

      const result = await system.reviewCode(files);

      expect(result).toBeDefined();
      expect(result.reports).toHaveLength(1);
      expect(result.multiFileReport).toBeDefined();
      expect(result.formatted).toBeDefined();
      expect(result.multiFileReport.overallScore).toBeGreaterThan(0);
    });

    it('should detect issues in code', async () => {
      const files = [
        {
          path: 'src/vulnerable.ts',
          content: `
const password = "hardcoded_password_123";
const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";

function queryUser(id: string) {
  db.query(\`SELECT * FROM users WHERE id = \${id}\`);
}
          `,
        },
      ];

      const result = await system.reviewCode(files);

      expect(result.multiFileReport.issues.length).toBeGreaterThan(0);
      expect(result.multiFileReport.overallScore).toBeLessThan(100);
    });

    it('should report progress', async () => {
      const files = [
        { path: 'test.ts', content: 'function test() {}' },
      ];

      const onProgress = vi.fn();
      await system.reviewCode(files, { onProgress });

      expect(onProgress).toHaveBeenCalled();
      const lastProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastProgress.progress).toBe(100);
    });

    it('should handle multiple files', async () => {
      const files = [
        { path: 'file1.ts', content: 'function foo() {}' },
        { path: 'file2.ts', content: 'function bar() {}' },
        { path: 'file3.ts', content: 'function baz() {}' },
      ];

      const result = await system.reviewCode(files);

      expect(result.reports).toHaveLength(3);
      expect(result.multiFileReport.files.length).toBe(3);
    });
  });

  describe('reviewPullRequest', () => {
    it('should review GitHub pull requests', async () => {
      const mockGitHubClient = {
        getPullRequest: vi.fn().mockResolvedValue({
          number: 1,
          title: 'Test PR',
          head: { sha: 'abc123', ref: 'feature' },
          base: { sha: 'def456', ref: 'main' },
        }),
        getFile: vi.fn().mockResolvedValue({
          decodedContent: 'function test() {}',
        }),
        request: vi.fn().mockResolvedValue({
          data: {
            files: [{ filename: 'test.ts', patch: '' }],
          },
        }),
        createPullRequestReview: vi.fn().mockResolvedValue({
          id: 123,
        }),
      } as unknown as GitHubClient;

      system.setGitHubClient(mockGitHubClient);

      const result = await system.reviewPullRequest('owner', 'repo', 1, {
        integration: {
          github: { enabled: true, autoComment: true },
        },
      });

      expect(result).toBeDefined();
      expect(result.reviewResult).toBeDefined();
      expect(mockGitHubClient.createPullRequestReview).toHaveBeenCalled();
    });
  });
});

describe('Factory Functions', () => {
  it('should create static analyzer', () => {
    const analyzer = createStaticAnalyzer();
    expect(analyzer).toBeDefined();
  });

  it('should create security scanner', () => {
    const scanner = createSecurityScanner();
    expect(scanner).toBeDefined();
  });

  it('should create quality checker', () => {
    const checker = createQualityChecker();
    expect(checker).toBeDefined();
  });

  it('should create rule engine', () => {
    const engine = createRuleEngine();
    expect(engine).toBeDefined();
  });

  it('should create performance analyzer', () => {
    const analyzer = createPerformanceAnalyzer();
    expect(analyzer).toBeDefined();
  });

  it('should create report generator', () => {
    const generator = createReportGenerator();
    expect(generator).toBeDefined();
  });
});

describe('reviewCode convenience function', () => {
  it('should review code without creating system', async () => {
    const files = [
      { path: 'test.ts', content: 'function test() {}' },
    ];

    const result = await reviewCode(files);

    expect(result).toBeDefined();
    expect(result.reports).toHaveLength(1);
  });
});

describe('Rule Engine Statistics', () => {
  it('should return total rule count', () => {
    const count = getTotalRuleCount();
    expect(count).toBeGreaterThan(0);
    expect(typeof count).toBe('number');
  });

  it('should return rule count by category', () => {
    const counts = getRuleCountByCategory();
    expect(counts).toBeDefined();
    expect(typeof counts).toBe('object');
    expect(counts.security).toBeGreaterThan(0);
    expect(counts.performance).toBeGreaterThan(0);
    expect(counts.quality).toBeGreaterThan(0);
  });
});

describe('End-to-End Tests', () => {
  it('should handle complex real-world code', async () => {
    const files = [
      {
        path: 'src/api/users.ts',
        content: `
import { Request, Response } from 'express';

const API_KEY = process.env.API_KEY || 'hardcoded_key_123';

export class UserController {
  async getUser(req: Request, res: Response) {
    const { id } = req.params;

    // SQL injection vulnerability
    const query = \`SELECT * FROM users WHERE id = \${id}\`;
    const user = await db.query(query);

    // XSS vulnerability
    res.send(\`<div>Welcome \${user.name}</div>\`);

    return user;
  }

  // Very long function
  async processUserData(data: any) {
    // 50+ lines of processing
    const step1 = this.step1(data);
    const step2 = this.step2(step1);
    const step3 = this.step3(step2);
    // ... many more steps
    return step50;
  }

  // N+1 query problem
  async getAllUsersWithPosts() {
    const users = await db.query('SELECT * FROM users');

    for (const user of users) {
      user.posts = await db.query(\`SELECT * FROM posts WHERE user_id = \${user.id}\`);
    }

    return users;
  }
}
        `,
      },
    ];

    const result = await reviewCode(files);

    // Should detect multiple issues
    expect(result.multiFileReport.issues.length).toBeGreaterThan(5);

    // Should have different types of issues
    const categories = new Set(result.multiFileReport.issues.map(i => i.category));
    expect(categories.size).toBeGreaterThan(1);

    // Score should reflect issues
    expect(result.multiFileReport.overallScore).toBeLessThan(80);
  });

  it('should generate reports in different formats', async () => {
    const files = [
      { path: 'test.ts', content: 'const x = 42;' },
    ];

    const consoleResult = await reviewCode(files, { reportFormat: 'console' });
    expect(consoleResult.formatted).toContain('CODE REVIEW REPORT');

    const jsonResult = await reviewCode(files, { reportFormat: 'json' });
    expect(jsonResult.formatted).toMatch(/^\{/);

    const markdownResult = await reviewCode(files, { reportFormat: 'markdown' });
    expect(markdownResult.formatted).toContain('# Code Review Report');

    const htmlResult = await reviewCode(files, { reportFormat: 'html' });
    expect(htmlResult.formatted).toContain('<!DOCTYPE html>');
  });
});

describe('Performance Tests', () => {
  it('should analyze small files quickly', async () => {
    const files = [
      { path: 'small.ts', content: 'function f() {}' },
    ];

    const start = performance.now();
    await reviewCode(files);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1000); // Should complete in < 1s
  });

  it('should handle medium-sized files efficiently', async () => {
    const content = Array.from({ length: 100 }, (_, i) =>
      `function function${i}() { return ${i}; }`
    ).join('\n');

    const files = [{ path: 'medium.ts', content }];

    const start = performance.now();
    await reviewCode(files);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5000); // Should complete in < 5s
  });
});

describe('Multi-Language Support', () => {
  it('should analyze TypeScript code', async () => {
    const files = [
      { path: 'test.ts', content: 'const x: number = 42;' },
    ];

    const result = await reviewCode(files);
    expect(result.reports[0].language).toBe('typescript');
  });

  it('should analyze JavaScript code', async () => {
    const files = [
      { path: 'test.js', content: 'const x = 42;' },
    ];

    const result = await reviewCode(files);
    expect(result.reports[0].language).toBe('javascript');
  });

  it('should analyze Python code', async () => {
    const files = [
      { path: 'test.py', content: 'x = 42' },
    ];

    const result = await reviewCode(files);
    expect(result.reports[0].language).toBe('python');
  });
});
