/**
 * Code Pattern Analyzer
 *
 * Detects anti-patterns and suggests optimizations
 */

export interface CodePattern {
  name: string;
  pattern: RegExp | string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  fix: string;
  fixCode?: string;
}

export class PatternAnalyzer {
  private patterns: CodePattern[] = [
    // Memory leak patterns
    {
      name: 'Event listener not removed',
      pattern: /addEventListener\s*\(/g,
      description: 'Event listener added without corresponding removeEventListener',
      severity: 'high',
      category: 'memory-leak',
      fix: 'Ensure removeEventListener is called when the component is unmounted or the object is destroyed.',
      fixCode: `// Bad
element.addEventListener('click', handler);

// Good
element.addEventListener('click', handler);
// Later: element.removeEventListener('click', handler);`,
    },
    {
      name: 'SetInterval not cleared',
      pattern: /setInterval\s*\(/g,
      description: 'Interval timer created without being cleared',
      severity: 'high',
      category: 'memory-leak',
      fix: 'Store the interval ID and call clearInterval when done.',
      fixCode: `// Bad
setInterval(callback, 1000);

// Good
const timer = setInterval(callback, 1000);
// Later: clearInterval(timer);`,
    },
    {
      name: 'SetTimeout not cleared',
      pattern: /setTimeout\s*\(/g,
      description: 'Timeout created without being cleared',
      severity: 'medium',
      category: 'memory-leak',
      fix: 'Store the timeout ID and call clearTimeout if needed.',
    },
    // Performance anti-patterns
    {
      name: 'Nested loops',
      pattern: /for\s*\([^)]+\)\s*{[\s\S]*?for\s*\(/g,
      description: 'Nested loops can lead to O(n²) or worse complexity',
      severity: 'medium',
      category: 'algorithm',
      fix: 'Consider using a Map or Set for O(1) lookups, or optimize the algorithm.',
      fixCode: `// Bad: O(n²)
for (let i = 0; i < arr1.length; i++) {
  for (let j = 0; j < arr2.length; j++) {
    if (arr1[i] === arr2[j]) { ... }
  }
}

// Good: O(n)
const set = new Set(arr2);
for (const item of arr1) {
  if (set.has(item)) { ... }
}`,
    },
    {
      name: 'Array.includes in loop',
      pattern: /for\s*\([^)]+\)[^{]*{[^}]*\.includes\s*\(/g,
      description: 'Array.includes in a loop is O(n) inside O(n) = O(n²)',
      severity: 'medium',
      category: 'algorithm',
      fix: 'Convert array to Set for O(1) lookups.',
      fixCode: `// Bad: O(n²)
for (const item of largeArray) {
  if (targetArray.includes(item)) { ... }
}

// Good: O(n)
const targetSet = new Set(targetArray);
for (const item of largeArray) {
  if (targetSet.has(item)) { ... }
}`,
    },
    {
      name: 'String concatenation in loop',
      pattern: /for\s*\([^)]+\)[^{]*{[^}]*(\+\s*[^=]|\.push)/g,
      description: 'String concatenation in loops creates many intermediate strings',
      severity: 'low',
      category: 'code-quality',
      fix: 'Use array join or template literals for better performance.',
      fixCode: `// Bad
let str = '';
for (let i = 0; i < 1000; i++) {
  str += 'hello ';
}

// Good
const parts = [];
for (let i = 0; i < 1000; i++) {
  parts.push('hello');
}
const str = parts.join(' ');`,
    },
    {
      name: 'Synchronous file operations',
      pattern: /\.(readFileSync|writeFileSync|existsSync)\s*\(/g,
      description: 'Synchronous file operations block the event loop',
      severity: 'high',
      category: 'event-loop',
      fix: 'Use async file operations to avoid blocking.',
      fixCode: `// Bad
const data = fs.readFileSync('file.txt');

// Good
const data = await fs.promises.readFile('file.txt');`,
    },
    {
      name: 'JSON.parse on large data',
      pattern: /JSON\.parse\s*\(\s*(\w+\.|this\.)/g,
      description: 'JSON.parse on large data can be slow',
      severity: 'low',
      category: 'code-quality',
      fix: 'Consider streaming JSON parsers or chunking large data.',
    },
    {
      name: 'Deep object cloning',
      pattern: /JSON\.parse\s*\(\s*JSON\.stringify\s*\(/g,
      description: 'JSON.parse/stringify is a slow way to deep clone',
      severity: 'low',
      category: 'code-quality',
      fix: 'Use structuredClone or a dedicated library.',
      fixCode: `// Bad
const clone = JSON.parse(JSON.stringify(obj));

// Good (Node.js 17+)
const clone = structuredClone(obj);

// Alternative: Use a library like lodash
const clone = _.cloneDeep(obj);`,
    },
    // Caching anti-patterns
    {
      name: 'Missing cache',
      pattern: /function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?return\s+\w+\.\w+\s*\([^)]*\)\s*;?\s*}/g,
      description: 'Expensive function call without caching',
      severity: 'low',
      category: 'caching',
      fix: 'Implement memoization or caching for expensive operations.',
      fixCode: `// Bad
function expensiveOperation(input) {
  return computeExpensiveResult(input);
}

// Good
const cache = new Map();
function expensiveOperation(input) {
  if (cache.has(input)) {
    return cache.get(input);
  }
  const result = computeExpensiveResult(input);
  cache.set(input, result);
  return result;
}

// Or use a memoization library
import memoize from 'lodash.memoize';
const expensiveOperation = memoize(computeExpensiveResult);`,
    },
    // Network optimization
    {
      name: 'Sequential network requests',
      pattern: /await\s+fetch\s*\([^)]+\)[\s\S]*?await\s+fetch\s*\(/g,
      description: 'Sequential fetch requests instead of parallel',
      severity: 'medium',
      category: 'network',
      fix: 'Use Promise.all for parallel requests.',
      fixCode: `// Bad: Sequential
const result1 = await fetch(url1);
const result2 = await fetch(url2);

// Good: Parallel
const [result1, result2] = await Promise.all([
  fetch(url1),
  fetch(url2),
]);`,
    },
    // Database optimization
    {
      name: 'N+1 query pattern',
      pattern: /for\s*\([^)]+\)[^{]*{[^}]*\.(query|find|fetch)\s*\(/g,
      description: 'Database query inside a loop (N+1 problem)',
      severity: 'high',
      category: 'database',
      fix: 'Use batch queries or joins to fetch all data at once.',
      fixCode: `// Bad: N+1 queries
for (const user of users) {
  const posts = await db.query('SELECT * FROM posts WHERE user_id = ?', user.id);
}

// Good: Single query
const userIds = users.map(u => u.id);
const posts = await db.query(
  'SELECT * FROM posts WHERE user_id IN (?)',
  [userIds]
);`,
    },
  ];

  /**
   * Analyze code for anti-patterns
   */
  analyzeCode(code: string): Array<{
    pattern: CodePattern;
    matches: Array<{
      line: number;
      column: number;
      text: string;
    }>;
  }> {
    const results: Array<{
      pattern: CodePattern;
      matches: Array<{
        line: number;
        column: number;
        text: string;
      }>;
    }> = [];

    const lines = code.split('\n');

    for (const pattern of this.patterns) {
      const matches: Array<{
        line: number;
        column: number;
        text: string;
      }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        if (pattern.pattern instanceof RegExp) {
          const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
          while ((match = regex.exec(line)) !== null) {
            matches.push({
              line: i + 1,
              column: match.index + 1,
              text: match[0],
            });
          }
        } else {
          const index = line.indexOf(pattern.pattern);
          if (index !== -1) {
            matches.push({
              line: i + 1,
              column: index + 1,
              text: pattern.pattern,
            });
          }
        }
      }

      if (matches.length > 0) {
        results.push({ pattern, matches });
      }
    }

    return results;
  }

  /**
   * Get all patterns
   */
  getPatterns(): CodePattern[] {
    return [...this.patterns];
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: CodePattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Generate pattern report
   */
  generateReport(analysis: ReturnType<PatternAnalyzer['analyzeCode']>): string {
    let report = '# Code Pattern Analysis Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Issues Found:** ${analysis.length}\n\n`;

    // Group by severity
    const bySeverity = analysis.reduce((acc, item) => {
      if (!acc[item.pattern.severity]) {
        acc[item.pattern.severity] = [];
      }
      acc[item.pattern.severity].push(item);
      return acc;
    }, {} as Record<string, typeof analysis>);

    const severityOrder = ['critical', 'high', 'medium', 'low'];

    for (const severity of severityOrder) {
      const items = bySeverity[severity];
      if (!items || items.length === 0) continue;

      report += `## ${severity.toUpperCase()} (${items.length})\n\n`;

      for (const item of items) {
        report += `### ${item.pattern.name}\n\n`;
        report += `**Category:** ${item.pattern.category}\n`;
        report += `**Matches:** ${item.matches.length}\n\n`;
        report += `${item.pattern.description}\n\n`;
        report += `**Fix:** ${item.pattern.fix}\n\n`;

        if (item.pattern.fixCode) {
          report += '```typescript\n';
          report += item.pattern.fixCode;
          report += '\n```\n\n';
        }

        report += '**Locations:**\n';
        for (const match of item.matches.slice(0, 10)) {
          report += `- Line ${match.line}: ${match.text.trim()}\n`;
        }
        if (item.matches.length > 10) {
          report += `- ... and ${item.matches.length - 10} more\n`;
        }
        report += '\n';
      }
    }

    return report;
  }
}

export default PatternAnalyzer;
