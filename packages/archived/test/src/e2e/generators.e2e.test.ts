/**
 * Data Generators E2E Tests
 *
 * Comprehensive tests for test data generators
 */

import { describe, it, expect } from 'vitest';
import {
  StringGenerator,
  NumberGenerator,
  DateGenerator,
  ArrayGenerator,
  ObjectGenerator,
  CodeGenerator,
  MessageGenerator,
  TestDataGenerator,
} from '../generators/data';

describe('Data Generators E2E Tests', () => {
  describe('String Generators', () => {
    it('should generate random strings', () => {
      const str1 = StringGenerator.random(10);
      const str2 = StringGenerator.random(10);

      expect(str1).toHaveLength(10);
      expect(str2).toHaveLength(10);
      expect(str1).not.toBe(str2);
    });

    it('should generate valid emails', () => {
      const email = StringGenerator.email();

      expect(email).toContain('@');
      expect(email).toContain('.');
      expect(email.split('@')).toHaveLength(2);
    });

    it('should generate valid URLs', () => {
      const url = StringGenerator.url();

      expect(url).toMatch(/^https?:\/\//);
      expect(url.split('/')).length.toBeGreaterThanOrEqual(3);
    });

    it('should generate valid UUIDs', () => {
      const uuid = StringGenerator.uuid();

      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate sentences', () => {
      const sentence = StringGenerator.sentence(5);

      expect(sentence.split(' ')).toHaveLength(5);
      expect(sentence.endsWith('.')).toBe(true);
    });

    it('should generate paragraphs', () => {
      const paragraph = StringGenerator.paragraph(3);

      expect(paragraph.split('. ')).toHaveLength(3);
    });

    it('should generate slugs', () => {
      const slug = StringGenerator.slug();

      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('should generate API keys', () => {
      const apiKey = StringGenerator.apiKey();

      expect(apiKey).toMatch(/^sk-[a-zA-Z0-9]{32}$/);
    });

    it('should generate tokens', () => {
      const token = StringGenerator.token();

      expect(token).toHaveLength(64);
    });
  });

  describe('Number Generators', () => {
    it('should generate integers in range', () => {
      const num = NumberGenerator.integer(10, 20);

      expect(num).toBeGreaterThanOrEqual(10);
      expect(num).toBeLessThanOrEqual(20);
      expect(Number.isInteger(num)).toBe(true);
    });

    it('should generate floats in range', () => {
      const num = NumberGenerator.float(0, 1, 2);

      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThanOrEqual(1);
    });

    it('should generate percentages', () => {
      const pct = NumberGenerator.percentage();

      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });

    it('should generate timestamps', () => {
      const ts = NumberGenerator.timestamp(30);

      expect(ts).toBeLessThanOrEqual(Date.now());
      expect(ts).toBeGreaterThan(Date.now() - 30 * 24 * 60 * 60 * 1000);
    });

    it('should generate port numbers', () => {
      const port = NumberGenerator.port();

      expect(port).toBeGreaterThanOrEqual(1024);
      expect(port).toBeLessThanOrEqual(65535);
    });

    it('should generate HTTP status codes', () => {
      const status = NumberGenerator.httpStatus();

      expect(status).toBeGreaterThanOrEqual(200);
      expect(status).toBeLessThan(600);
    });
  });

  describe('Date Generators', () => {
    it('should generate dates', () => {
      const date = DateGenerator.date(30);

      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should generate ISO date strings', () => {
      const iso = DateGenerator.isoDate(30);

      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should generate date ranges', () => {
      const dates = DateGenerator.dateRange(10, 30);

      expect(dates).toHaveLength(10);
      dates.forEach((date, i) => {
        if (i > 0) {
          expect(date.getTime()).toBeGreaterThanOrEqual(dates[i - 1].getTime());
        }
      });
    });
  });

  describe('Array Generators', () => {
    it('should generate arrays', () => {
      const arr = ArrayGenerator.static(() => StringGenerator.random(5), 10);

      expect(arr).toHaveLength(10);
      arr.forEach(item => {
        expect(item).toHaveLength(5);
      });
    });

    it('should generate subsets', () => {
      const source = [1, 2, 3, 4, 5];
      const subset = ArrayGenerator.subset(source, 3);

      expect(subset).toHaveLength(3);
      subset.forEach(item => {
        expect(source).toContain(item);
      });
    });

    it('should shuffle arrays', () => {
      const source = [1, 2, 3, 4, 5];
      const shuffled = ArrayGenerator.shuffle(source);

      expect(shuffled).toHaveLength(source.length);
      expect(shuffled).toEqual(expect.arrayContaining(source));
    });
  });

  describe('Object Generators', () => {
    it('should generate user objects', () => {
      const user = ObjectGenerator.user();

      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should generate session objects', () => {
      const session = ObjectGenerator.session();

      expect(session.id).toBeDefined();
      expect(session.userId).toBeDefined();
      expect(session.token).toBeDefined();
      expect(session.expiresAt).toBeDefined();
    });

    it('should generate API request objects', () => {
      const req = ObjectGenerator.apiRequest();

      expect(req.id).toBeDefined();
      expect(req.method).toBeDefined();
      expect(req.url).toBeDefined();
      expect(req.headers).toBeDefined();
      expect(req.timestamp).toBeDefined();
    });

    it('should generate API response objects', () => {
      const res = ObjectGenerator.apiResponse();

      expect(res.id).toBeDefined();
      expect(res.status).toBeDefined();
      expect(res.headers).toBeDefined();
      expect(res.duration).toBeDefined();
    });

    it('should generate cache entries', () => {
      const entry = ObjectGenerator.cacheEntry();

      expect(entry.key).toBeDefined();
      expect(entry.value).toBeDefined();
      expect(entry.metadata).toBeDefined();
      expect(entry.metadata.createdAt).toBeDefined();
    });

    it('should generate rate limit entries', () => {
      const entry = ObjectGenerator.rateLimitEntry();

      expect(entry.key).toBeDefined();
      expect(entry.count).toBeDefined();
      expect(entry.limit).toBeDefined();
      expect(entry.window).toBeDefined();
    });

    it('should generate metrics', () => {
      const metrics = ObjectGenerator.metrics();

      expect(metrics.timestamp).toBeDefined();
      expect(metrics.requests).toBeGreaterThanOrEqual(0);
      expect(metrics.errors).toBeGreaterThanOrEqual(0);
      expect(metrics.latency).toBeGreaterThan(0);
    });
  });

  describe('Code Generators', () => {
    it('should generate TypeScript code', () => {
      const code = CodeGenerator.typescript(3);

      expect(code).toContain('export function');
      expect(code.split('export function')).toHaveLength(4);
    });

    it('should generate JavaScript code', () => {
      const code = CodeGenerator.javascript(3);

      expect(code).toContain('function');
      expect(code.split('function')).toHaveLength(4);
    });

    it('should generate Python code', () => {
      const code = CodeGenerator.python(3);

      expect(code).toContain('def ');
      expect(code.split('def ')).toHaveLength(4);
    });

    it('should generate JSON', () => {
      const json = CodeGenerator.json(3);

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed).toBeDefined();
    });
  });

  describe('Message Generators', () => {
    it('should generate user messages', () => {
      const msg = MessageGenerator.userMessage();

      expect(msg.role).toBe('user');
      expect(msg.content).toBeDefined();
      expect(msg.timestamp).toBeDefined();
    });

    it('should generate assistant messages', () => {
      const msg = MessageGenerator.assistantMessage();

      expect(msg.role).toBe('assistant');
      expect(msg.content).toBeDefined();
      expect(msg.timestamp).toBeDefined();
    });

    it('should generate conversations', () => {
      const conv = MessageGenerator.conversation(10);

      expect(conv).toHaveLength(10);
      conv.forEach((msg, i) => {
        expect(msg.role).toBeDefined();
        expect(msg.content).toBeDefined();
      });
    });

    it('should generate system prompts', () => {
      const prompt = MessageGenerator.systemPrompt();

      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt.split('.')).length.toBeGreaterThan(2);
    });
  });

  describe('Test Data Generators', () => {
    it('should generate cache test data', () => {
      const data = TestDataGenerator.forCache(10);

      expect(data).toHaveLength(10);
      data.forEach(entry => {
        expect(entry.key).toBeDefined();
        expect(entry.value).toBeDefined();
      });
    });

    it('should generate rate limit test data', () => {
      const data = TestDataGenerator.forRateLimit(10);

      expect(data).toHaveLength(10);
      data.forEach(entry => {
        expect(entry.key).toBeDefined();
        expect(entry.requests).toBeGreaterThanOrEqual(0);
        expect(entry.limit).toBeGreaterThan(0);
      });
    });

    it('should generate session test data', () => {
      const data = TestDataGenerator.forSessions(10);

      expect(data).toHaveLength(10);
      data.forEach(session => {
        expect(session.id).toBeDefined();
        expect(session.userId).toBeDefined();
        expect(session.token).toBeDefined();
      });
    });

    it('should generate RAG test data', () => {
      const data = TestDataGenerator.forRAG(10);

      expect(data).toHaveLength(10);
      data.forEach(doc => {
        expect(doc.id).toBeDefined();
        expect(doc.content).toBeDefined();
        expect(doc.metadata).toBeDefined();
      });
    });

    it('should generate agent test data', () => {
      const data = TestDataGenerator.forAgents(10);

      expect(data).toHaveLength(10);
      data.forEach(agent => {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.type).toBeDefined();
      });
    });
  });
});
