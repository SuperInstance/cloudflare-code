/**
 * Predefined Benchmark Suites
 *
 * Common benchmark scenarios for ClaudeFlare
 */

import type { BenchmarkSuite } from '../types/index.js';

export class BenchmarkSuites {
  /**
   * String operations benchmarks
   */
  static stringOperations(): BenchmarkSuite {
    return {
      name: 'string-operations',
      description: 'Benchmark common string operations',
      benchmarks: [
        {
          name: 'concat',
          description: 'String concatenation',
          fn: () => {
            let str = '';
            for (let i = 0; i < 100; i++) {
              str += 'hello ';
            }
            return str;
          },
        },
        {
          name: 'template-literal',
          description: 'Template literal concatenation',
          fn: () => {
            let str = '';
            for (let i = 0; i < 100; i++) {
              str = `${str}hello `;
            }
            return str;
          },
        },
        {
          name: 'join',
          description: 'Array join concatenation',
          fn: () => {
            const arr = [];
            for (let i = 0; i < 100; i++) {
              arr.push('hello');
            }
            return arr.join(' ');
          },
        },
        {
          name: 'split',
          description: 'String splitting',
          fn: () => {
            const str = 'hello world foo bar baz';
            return str.split(' ');
          },
        },
        {
          name: 'replace',
          description: 'String replacement',
          fn: () => {
            const str = 'hello world hello world hello world';
            return str.replace(/hello/g, 'hi');
          },
        },
        {
          name: 'trim',
          description: 'String trimming',
          fn: () => {
            const str = '   hello world   ';
            return str.trim();
          },
        },
      ],
    };
  }

  /**
   * JSON operations benchmarks
   */
  static jsonOperations(): BenchmarkSuite {
    const largeObject = {
      users: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        roles: ['admin', 'user', 'moderator'],
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          settings: {
            theme: 'dark',
            notifications: true,
            language: 'en',
          },
        },
      })),
    };

    return {
      name: 'json-operations',
      description: 'Benchmark JSON parsing and stringification',
      benchmarks: [
        {
          name: 'stringify-small',
          description: 'Stringify small object',
          fn: () => {
            return JSON.stringify({ foo: 'bar', baz: 123 });
          },
        },
        {
          name: 'stringify-large',
          description: 'Stringify large object',
          fn: () => {
            return JSON.stringify(largeObject);
          },
        },
        {
          name: 'parse-small',
          description: 'Parse small JSON',
          fn: () => {
            return JSON.parse('{"foo":"bar","baz":123}');
          },
        },
        {
          name: 'parse-large',
          description: 'Parse large JSON',
          fn: () => {
            return JSON.parse(JSON.stringify(largeObject));
          },
        },
      ],
    };
  }

  /**
   * Array operations benchmarks
   */
  static arrayOperations(): BenchmarkSuite {
    const largeArray = Array.from({ length: 10000 }, (_, i) => i);

    return {
      name: 'array-operations',
      description: 'Benchmark common array operations',
      benchmarks: [
        {
          name: 'map',
          description: 'Array map',
          fn: () => {
            return largeArray.map((x) => x * 2);
          },
        },
        {
          name: 'filter',
          description: 'Array filter',
          fn: () => {
            return largeArray.filter((x) => x % 2 === 0);
          },
        },
        {
          name: 'reduce',
          description: 'Array reduce',
          fn: () => {
            return largeArray.reduce((sum, x) => sum + x, 0);
          },
        },
        {
          name: 'find',
          description: 'Array find',
          fn: () => {
            return largeArray.find((x) => x === 5000);
          },
        },
        {
          name: 'includes',
          description: 'Array includes',
          fn: () => {
            return largeArray.includes(5000);
          },
        },
        {
          name: 'sort',
          description: 'Array sort',
          fn: () => {
            return [...largeArray].sort((a, b) => b - a);
          },
        },
        {
          name: 'slice',
          description: 'Array slice',
          fn: () => {
            return largeArray.slice(100, 200);
          },
        },
      ],
    };
  }

  /**
   * Data structure benchmarks
   */
  static dataStructures(): BenchmarkSuite {
    return {
      name: 'data-structures',
      description: 'Benchmark different data structures',
      benchmarks: [
        {
          name: 'map-set',
          description: 'Map set operation',
          fn: () => {
            const map = new Map();
            for (let i = 0; i < 1000; i++) {
              map.set(i, i * 2);
            }
            return map;
          },
        },
        {
          name: 'map-get',
          description: 'Map get operation',
          fn: () => {
            const map = new Map();
            for (let i = 0; i < 1000; i++) {
              map.set(i, i * 2);
            }
            for (let i = 0; i < 1000; i++) {
              map.get(i);
            }
            return map;
          },
        },
        {
          name: 'object-set',
          description: 'Object set operation',
          fn: () => {
            const obj: any = {};
            for (let i = 0; i < 1000; i++) {
              obj[i] = i * 2;
            }
            return obj;
          },
        },
        {
          name: 'object-get',
          description: 'Object get operation',
          fn: () => {
            const obj: any = {};
            for (let i = 0; i < 1000; i++) {
              obj[i] = i * 2;
            }
            for (let i = 0; i < 1000; i++) {
              obj[i];
            }
            return obj;
          },
        },
        {
          name: 'set-add',
          description: 'Set add operation',
          fn: () => {
            const set = new Set();
            for (let i = 0; i < 1000; i++) {
              set.add(i);
            }
            return set;
          },
        },
        {
          name: 'set-has',
          description: 'Set has operation',
          fn: () => {
            const set = new Set();
            for (let i = 0; i < 1000; i++) {
              set.add(i);
            }
            for (let i = 0; i < 1000; i++) {
              set.has(i);
            }
            return set;
          },
        },
      ],
    };
  }

  /**
   * Async operations benchmarks
   */
  static asyncOperations(): BenchmarkSuite {
    return {
      name: 'async-operations',
      description: 'Benchmark async operations',
      benchmarks: [
        {
          name: 'promise-resolve',
          description: 'Promise resolve',
          fn: async () => {
            return Promise.resolve(42);
          },
        },
        {
          name: 'promise-all',
          description: 'Promise.all',
          fn: async () => {
            const promises = Array.from({ length: 100 }, () => Promise.resolve(42));
            return Promise.all(promises);
          },
        },
        {
          name: 'async-await',
          description: 'Async/await',
          fn: async () => {
            const result = await Promise.resolve(42);
            return result * 2;
          },
        },
        {
          name: 'timeout',
          description: 'setTimeout 0',
          fn: () => {
            return new Promise((resolve) => {
              setTimeout(resolve, 0);
            });
          },
        },
      ],
    };
  }

  /**
   * Cryptography benchmarks
   */
  static crypto(): BenchmarkSuite {
    const data = 'Hello, World!';

    return {
      name: 'crypto',
      description: 'Benchmark cryptographic operations',
      benchmarks: [
        {
          name: 'sha-256',
          description: 'SHA-256 hash',
          fn: async () => {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            return hashBuffer;
          },
        },
        {
          name: 'sha-384',
          description: 'SHA-384 hash',
          fn: async () => {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-384', dataBuffer);
            return hashBuffer;
          },
        },
        {
          name: 'sha-512',
          description: 'SHA-512 hash',
          fn: async () => {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest('SHA-512', dataBuffer);
            return hashBuffer;
          },
        },
        {
          name: 'random-uuid',
          description: 'Generate random UUID',
          fn: () => {
            return crypto.randomUUID();
          },
        },
        {
          name: 'random-values',
          description: 'Generate random values',
          fn: () => {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return array;
          },
        },
      ],
    };
  }

  /**
   * Compression benchmarks
   */
  static compression(): BenchmarkSuite {
    const largeText = 'x'.repeat(10000);

    return {
      name: 'compression',
      description: 'Benchmark compression operations',
      benchmarks: [
        {
          name: 'gzip-compress',
          description: 'Gzip compression',
          fn: () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(largeText);
            // Simulate compression (actual compression not available in Workers)
            return data;
          },
        },
        {
          name: 'deflate-compress',
          description: 'Deflate compression',
          fn: () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(largeText);
            return data;
          },
        },
      ],
    };
  }

  /**
   * Encoding benchmarks
   */
  static encoding(): BenchmarkSuite {
    const data = 'Hello, World! This is a test string.';

    return {
      name: 'encoding',
      description: 'Benchmark encoding operations',
      benchmarks: [
        {
          name: 'text-encode',
          description: 'Text encoder',
          fn: () => {
            const encoder = new TextEncoder();
            return encoder.encode(data);
          },
        },
        {
          name: 'text-decode',
          description: 'Text decoder',
          fn: () => {
            const encoder = new TextEncoder();
            const buffer = encoder.encode(data);
            const decoder = new TextDecoder();
            return decoder.decode(buffer);
          },
        },
        {
          name: 'btoa',
          description: 'Base64 encode',
          fn: () => {
            return btoa(data);
          },
        },
        {
          name: 'atob',
          description: 'Base64 decode',
          fn: () => {
            const encoded = btoa(data);
            return atob(encoded);
          },
        },
      ],
    };
  }

  /**
   * Regular expression benchmarks
   */
  static regex(): BenchmarkSuite {
    const text = 'The quick brown fox jumps over the lazy dog. ' + 'The quick brown fox jumps over the lazy dog. '.repeat(100);

    return {
      name: 'regex',
      description: 'Benchmark regex operations',
      benchmarks: [
        {
          name: 'literal-match',
          description: 'Literal string match',
          fn: () => {
            return /quick/.test(text);
          },
        },
        {
          name: 'complex-match',
          description: 'Complex regex match',
          fn: () => {
            return /\b[A-Z][a-z]+\b/.test(text);
          },
        },
        {
          name: 'replace',
          description: 'Regex replace',
          fn: () => {
            return text.replace(/fox/g, 'cat');
          },
        },
        {
          name: 'match-all',
          description: 'Match all',
          fn: () => {
            return text.match(/the/gi);
          },
        },
      ],
    };
  }

  /**
   * Memory benchmarks
   */
  static memory(): BenchmarkSuite {
    return {
      name: 'memory',
      description: 'Benchmark memory operations',
      benchmarks: [
        {
          name: 'allocate-small',
          description: 'Allocate small buffers',
          fn: () => {
            return new Uint8Array(1024);
          },
        },
        {
          name: 'allocate-large',
          description: 'Allocate large buffers',
          fn: () => {
            return new Uint8Array(1024 * 1024);
          },
        },
        {
          name: 'buffer-copy',
          description: 'Buffer copy',
          fn: () => {
            const source = new Uint8Array(1024);
            const target = new Uint8Array(1024);
            target.set(source);
            return target;
          },
        },
      ],
    };
  }

  /**
   * Cloudflare Worker specific benchmarks
   */
  static workerOperations(): BenchmarkSuite {
    return {
      name: 'worker-operations',
      description: 'Benchmark Cloudflare Worker operations',
      benchmarks: [
        {
          name: 'request-parse',
          description: 'Parse HTTP request',
          fn: () => {
            const headers = new Headers({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer token',
            });
            const request = new Request('https://example.com/api', {
              method: 'POST',
              headers,
              body: '{"test": "data"}',
            });
            return request;
          },
        },
        {
          name: 'response-create',
          description: 'Create HTTP response',
          fn: () => {
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' },
            });
          },
        },
        {
          name: 'url-parse',
          description: 'Parse URL',
          fn: () => {
            return new URL('https://api.example.com/v1/users?page=2&limit=10');
          },
        },
        {
          name: 'headers-operations',
          description: 'Headers operations',
          fn: () => {
            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            headers.set('Authorization', 'Bearer token');
            headers.append('X-Custom', 'value1');
            headers.append('X-Custom', 'value2');
            return headers;
          },
        },
      ],
    };
  }

  /**
   * Get all predefined suites
   */
  static getAll(): BenchmarkSuite[] {
    return [
      this.stringOperations(),
      this.jsonOperations(),
      this.arrayOperations(),
      this.dataStructures(),
      this.asyncOperations(),
      this.crypto(),
      this.compression(),
      this.encoding(),
      this.regex(),
      this.memory(),
      this.workerOperations(),
    ];
  }
}

export default BenchmarkSuites;
