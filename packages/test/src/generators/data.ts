/**
 * Test Data Generators
 *
 * Generate realistic test data for various testing scenarios
 */

/**
 * String generators
 */
export class StringGenerator {
  /**
   * Generate random string
   */
  static random(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random email
   */
  static email(): string {
    const username = this.random(8).toLowerCase();
    const domain = ['example.com', 'test.com', 'demo.com', 'mail.com'][Math.floor(Math.random() * 4)];
    return `${username}@${domain}`;
  }

  /**
   * Generate random URL
   */
  static url(): string {
    const protocols = ['http', 'https'];
    const domains = ['example.com', 'test.com', 'demo.com', 'api.example.com'];
    const paths = ['api/v1', 'api/v2', 'graphql', 'rest', 'webhook'];
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];
    return `${protocol}://${domain}/${path}/${this.random(8)}`;
  }

  /**
   * Generate random UUID
   */
  static uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate random sentence
   */
  static sentence(wordCount: number = 10): string {
    const words = [
      'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
      'hello', 'world', 'test', 'data', 'generator', 'random', 'string',
      'cloudflare', 'workers', 'durable', 'objects', 'storage', 'cache',
      'performance', 'testing', 'benchmark', 'load', 'stress', 'e2e',
    ];

    const sentence = [];
    for (let i = 0; i < wordCount; i++) {
      sentence.push(words[Math.floor(Math.random() * words.length)]);
    }

    return sentence.join(' ') + '.';
  }

  /**
   * Generate random paragraph
   */
  static paragraph(sentenceCount: number = 5): string {
    const sentences = [];
    for (let i = 0; i < sentenceCount; i++) {
      sentences.push(this.sentence(Math.floor(Math.random() * 15) + 5));
    }
    return sentences.join(' ');
  }

  /**
   * Generate random slug
   */
  static slug(): string {
    const words = [
      'test', 'demo', 'example', 'sample', 'data', 'object',
      'item', 'entity', 'resource', 'endpoint', 'service',
    ];
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const suffix = Math.floor(Math.random() * 1000);
    return `${word1}-${word2}-${suffix}`;
  }

  /**
   * Generate random API key
   */
  static apiKey(): string {
    return `sk-${this.random(32)}`;
  }

  /**
   * Generate random token
   */
  static token(): string {
    return this.random(64);
  }
}

/**
 * Number generators
 */
export class NumberGenerator {
  /**
   * Generate random integer
   */
  static integer(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random float
   */
  static float(min: number = 0, max: number = 1, decimals: number = 2): number {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(decimals));
  }

  /**
   * Generate random percentage
   */
  static percentage(): number {
    return this.float(0, 100, 2);
  }

  /**
   * Generate random timestamp
   */
  static timestamp(daysAgo: number = 30): number {
    const now = Date.now();
    const daysInMs = daysAgo * 24 * 60 * 60 * 1000;
    return now - Math.floor(Math.random() * daysInMs);
  }

  /**
   * Generate random port number
   */
  static port(): number {
    return this.integer(1024, 65535);
  }

  /**
   * Generate random HTTP status code
   */
  static httpStatus(): number {
    const codes = [200, 201, 204, 301, 302, 400, 401, 403, 404, 429, 500, 502, 503];
    return codes[Math.floor(Math.random() * codes.length)];
  }
}

/**
 * Date generators
 */
export class DateGenerator {
  /**
   * Generate random date
   */
  static date(daysAgo: number = 30): Date {
    const timestamp = NumberGenerator.timestamp(daysAgo);
    return new Date(timestamp);
  }

  /**
   * Generate ISO date string
   */
  static isoDate(daysAgo: number = 30): string {
    return this.date(daysAgo).toISOString();
  }

  /**
   * Generate date range
   */
  static dateRange(count: number, daysSpan: number = 30): Date[] {
    const dates: Date[] = [];
    const now = Date.now();
    const spanInMs = daysSpan * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const timestamp = now - Math.floor(Math.random() * spanInMs);
      dates.push(new Date(timestamp));
    }

    return dates.sort((a, b) => a.getTime() - b.getTime());
  }
}

/**
 * Array generators
 */
export class ArrayGenerator {
  /**
   * Generate random array
   */
  static static<T>(generator: () => T, length: number = 10): T[] {
    return Array.from({ length }, generator);
  }

  /**
   * Generate random subset
   */
  static subset<T>(array: T[], size: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(size, array.length));
  }

  /**
   * Shuffle array
   */
  static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

/**
 * Object generators
 */
export class ObjectGenerator {
  /**
   * Generate random user object
   */
  static user(): {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: StringGenerator.uuid(),
      name: StringGenerator.sentence(3),
      email: StringGenerator.email(),
      createdAt: DateGenerator.isoDate(),
      updatedAt: DateGenerator.isoDate(),
    };
  }

  /**
   * Generate random session object
   */
  static session(): {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
    createdAt: string;
  } {
    const now = Date.now();
    const expiresAt = now + 3600000; // 1 hour

    return {
      id: StringGenerator.uuid(),
      userId: StringGenerator.uuid(),
      token: StringGenerator.token(),
      expiresAt: new Date(expiresAt).toISOString(),
      createdAt: new Date(now).toISOString(),
    };
  }

  /**
   * Generate random API request object
   */
  static apiRequest(): {
    id: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: any;
    timestamp: number;
  } {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const method = methods[Math.floor(Math.random() * methods.length)];

    return {
      id: StringGenerator.uuid(),
      method,
      url: StringGenerator.url(),
      headers: {
        'content-type': 'application/json',
        'user-agent': StringGenerator.random(20),
        'x-request-id': StringGenerator.uuid(),
      },
      body: method !== 'GET' && method !== 'DELETE' ? { data: StringGenerator.sentence(5) } : undefined,
      timestamp: NumberGenerator.timestamp(),
    };
  }

  /**
   * Generate random API response object
   */
  static apiResponse(): {
    id: string;
    status: number;
    headers: Record<string, string>;
    body: any;
    duration: number;
  } {
    const status = NumberGenerator.httpStatus();

    return {
      id: StringGenerator.uuid(),
      status,
      headers: {
        'content-type': 'application/json',
        'x-response-id': StringGenerator.uuid(),
      },
      body: {
        message: StringGenerator.sentence(5),
        timestamp: Date.now(),
      },
      duration: NumberGenerator.integer(10, 500),
    };
  }

  /**
   * Generate random cache entry
   */
  static cacheEntry(): {
    key: string;
    value: string;
    metadata: {
      createdAt: number;
      expiresAt: number;
      hits: number;
    };
  } {
    const now = Date.now();
    const ttl = NumberGenerator.integer(60, 3600) * 1000;

    return {
      key: StringGenerator.slug(),
      value: StringGenerator.paragraph(2),
      metadata: {
        createdAt: now,
        expiresAt: now + ttl,
        hits: NumberGenerator.integer(0, 1000),
      },
    };
  }

  /**
   * Generate random rate limit entry
   */
  static rateLimitEntry(): {
    key: string;
    count: number;
    limit: number;
    window: number;
    resetAt: number;
  } {
    const window = NumberGenerator.integer(60, 3600);
    const now = Date.now();

    return {
      key: StringGenerator.slug(),
      count: NumberGenerator.integer(0, 100),
      limit: NumberGenerator.integer(100, 1000),
      window,
      resetAt: now + window * 1000,
    };
  }

  /**
   * Generate random metrics
   */
  static metrics(): {
    timestamp: number;
    requests: number;
    errors: number;
    latency: number;
    throughput: number;
  } {
    return {
      timestamp: NumberGenerator.timestamp(),
      requests: NumberGenerator.integer(0, 10000),
      errors: NumberGenerator.integer(0, 100),
      latency: NumberGenerator.integer(10, 1000),
      throughput: NumberGenerator.integer(100, 10000),
    };
  }
}

/**
 * Code generators
 */
export class CodeGenerator {
  /**
   * Generate random TypeScript code
   */
  static typescript(functionCount: number = 3): string {
    const functions = [];

    for (let i = 0; i < functionCount; i++) {
      const functionName = StringGenerator.random(8).toLowerCase();
      const paramCount = NumberGenerator.integer(0, 5);
      const params = Array.from({ length: paramCount }, () => StringGenerator.random(6).toLowerCase());

      functions.push(`
export function ${functionName}(${params.join(', ')}): ${StringGenerator.random(6)} {
  // ${StringGenerator.sentence(5)}
  return ${StringGenerator.random(10)};
}`);
    }

    return functions.join('\n');
  }

  /**
   * Generate random JavaScript code
   */
  static javascript(functionCount: number = 3): string {
    const functions = [];

    for (let i = 0; i < functionCount; i++) {
      const functionName = StringGenerator.random(8).toLowerCase();
      const paramCount = NumberGenerator.integer(0, 5);
      const params = Array.from({ length: paramCount }, () => StringGenerator.random(6).toLowerCase());

      functions.push(`
function ${functionName}(${params.join(', ')}) {
  // ${StringGenerator.sentence(5)}
  return ${StringGenerator.random(10)};
}`);
    }

    return functions.join('\n');
  }

  /**
   * Generate random Python code
   */
  static python(functionCount: number = 3): string {
    const functions = [];

    for (let i = 0; i < functionCount; i++) {
      const functionName = StringGenerator.random(8).toLowerCase();
      const paramCount = NumberGenerator.integer(0, 5);
      const params = Array.from({ length: paramCount }, () => StringGenerator.random(6).toLowerCase());

      functions.push(`
def ${functionName}(${params.join(', ')}):
    """${StringGenerator.sentence(5)}"""
    return "${StringGenerator.random(10)}"
`);
    }

    return functions.join('\n');
  }

  /**
   * Generate random JSON
   */
  static json(depth: number = 3): string {
    const generateObject = (currentDepth: number): any => {
      if (currentDepth <= 0) {
        return StringGenerator.random(10);
      }

      const type = Math.floor(Math.random() * 4);

      switch (type) {
        case 0: // string
          return StringGenerator.sentence(5);
        case 1: // number
          return NumberGenerator.integer(0, 1000);
        case 2: // array
          return Array.from({ length: NumberGenerator.integer(1, 5) }, () => generateObject(currentDepth - 1));
        case 3: // object
          const obj: any = {};
          const keyCount = NumberGenerator.integer(1, 5);
          for (let i = 0; i < keyCount; i++) {
            obj[StringGenerator.random(6)] = generateObject(currentDepth - 1);
          }
          return obj;
        default:
          return null;
      }
    };

    return JSON.stringify(generateObject(depth), null, 2);
  }
}

/**
 * Message generators for AI chat
 */
export class MessageGenerator {
  /**
   * Generate random user message
   */
  static userMessage(): {
    role: 'user';
    content: string;
    timestamp: number;
  } {
    return {
      role: 'user',
      content: StringGenerator.paragraph(2),
      timestamp: NumberGenerator.timestamp(),
    };
  }

  /**
   * Generate random assistant message
   */
  static assistantMessage(): {
    role: 'assistant';
    content: string;
    timestamp: number;
  } {
    return {
      role: 'assistant',
      content: StringGenerator.paragraph(3),
      timestamp: NumberGenerator.timestamp(),
    };
  }

  /**
   * Generate random conversation
   */
  static conversation(messageCount: number = 10): Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }> {
    const messages = [];
    const now = Date.now();

    for (let i = 0; i < messageCount; i++) {
      const role = i % 2 === 0 ? 'user' : 'assistant';
      messages.push({
        role,
        content: StringGenerator.paragraph(2),
        timestamp: now - (messageCount - i) * 60000,
      });
    }

    return messages;
  }

  /**
   * Generate random system prompt
   */
  static systemPrompt(): string {
    const prompts = [
      'You are a helpful AI assistant.',
      'You are a code expert who helps with programming questions.',
      'You are a creative writing assistant.',
      'You are a data analysis expert.',
      'You are a technical support specialist.',
    ];

    return prompts[Math.floor(Math.random() * prompts.length)] + '\n' + StringGenerator.paragraph(3);
  }
}

/**
 * Generate test data for specific scenarios
 */
export class TestDataGenerator {
  /**
   * Generate data for cache testing
   */
  static forCache(size: number = 100): Array<{ key: string; value: string; metadata?: any }> {
    return Array.from({ length: size }, () => ({
      key: `cache:${StringGenerator.slug()}`,
      value: StringGenerator.paragraph(2),
      metadata: {
        createdAt: NumberGenerator.timestamp(),
        ttl: NumberGenerator.integer(60, 3600),
      },
    }));
  }

  /**
   * Generate data for rate limiting testing
   */
  static forRateLimit(size: number = 100): Array<{
    key: string;
    requests: number;
    limit: number;
    window: number;
  }> {
    return Array.from({ length: size }, () => ({
      key: `ratelimit:${StringGenerator.slug()}`,
      requests: NumberGenerator.integer(0, 100),
      limit: NumberGenerator.integer(50, 200),
      window: NumberGenerator.integer(60, 300),
    }));
  }

  /**
   * Generate data for session testing
   */
  static forSessions(size: number = 50): Array<{
    id: string;
    userId: string;
    token: string;
    data: any;
    expiresAt: number;
  }> {
    return Array.from({ length: size }, () => {
      const now = Date.now();
      const ttl = NumberGenerator.integer(300, 3600) * 1000;

      return {
        id: StringGenerator.uuid(),
        userId: StringGenerator.uuid(),
        token: StringGenerator.token(),
        data: {
          user: ObjectGenerator.user(),
          metadata: ObjectGenerator.cacheEntry().metadata,
        },
        expiresAt: now + ttl,
      };
    });
  }

  /**
   * Generate data for RAG testing
   */
  static forRAG(documentCount: number = 100): Array<{
    id: string;
    content: string;
    metadata: {
      title: string;
      source: string;
      createdAt: number;
      tags: string[];
    };
  }> {
    return Array.from({ length: documentCount }, () => ({
      id: StringGenerator.uuid(),
      content: StringGenerator.paragraph(5),
      metadata: {
        title: StringGenerator.sentence(5),
        source: StringGenerator.url(),
        createdAt: NumberGenerator.timestamp(),
        tags: ArrayGenerator.subset(
          ['typescript', 'testing', 'e2e', 'performance', 'cloudflare', 'workers'],
          NumberGenerator.integer(1, 4)
        ),
      },
    }));
  }

  /**
   * Generate data for agent testing
   */
  static forAgents(agentCount: number = 10): Array<{
    id: string;
    name: string;
    type: string;
    config: any;
    status: 'active' | 'inactive';
  }> {
    const types = ['messenger', 'planner', 'executor', 'director'];

    return Array.from({ length: agentCount }, () => ({
      id: StringGenerator.uuid(),
      name: StringGenerator.sentence(3),
      type: types[Math.floor(Math.random() * types.length)],
      config: {
        timeout: NumberGenerator.integer(5000, 30000),
        retries: NumberGenerator.integer(0, 5),
        priority: NumberGenerator.integer(1, 10),
      },
      status: Math.random() > 0.3 ? 'active' : 'inactive',
    }));
  }
}
