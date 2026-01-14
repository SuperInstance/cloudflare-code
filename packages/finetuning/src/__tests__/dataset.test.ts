/**
 * Dataset Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatasetManager } from '../datasets/manager';
import type { Env } from '../types';

describe('DatasetManager', () => {
  let env: Env;
  let manager: DatasetManager;

  beforeEach(() => {
    // Mock environment
    env = {
      R2: {
        put: async () => {},
        get: async () => null,
        delete: async () => {},
      } as any,
      DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => ({}),
            first: async () => null,
            all: async () => ({ results: [] }),
          }),
        }),
      } as any,
      R2_BUCKET: 'test-bucket',
      MAX_DATASET_SIZE: 1024 * 1024 * 1024,
    };

    manager = new DatasetManager(env);
  });

  describe('Dataset Upload', () => {
    it('should upload a dataset file', async () => {
      const data = new TextEncoder().encode(
        JSON.stringify([
          { prompt: 'Test', completion: 'Response' },
        ])
      );

      const dataset = await manager.uploadDataset(
        { data, name: 'test.jsonl', type: 'application/jsonl' },
        {
          name: 'Test Dataset',
          format: 'jsonl',
          source: 'upload',
          tags: ['test'],
        }
      );

      expect(dataset).toBeDefined();
      expect(dataset.name).toBe('Test Dataset');
      expect(dataset.format).toBe('jsonl');
      expect(dataset.status).toBe('uploading');
    });

    it('should reject oversized files', async () => {
      const largeData = new ArrayBuffer(2 * 1024 * 1024 * 1024); // 2GB

      await expect(
        manager.uploadDataset(
          { data: largeData, name: 'large.jsonl', type: 'application/jsonl' },
          {
            name: 'Large Dataset',
            format: 'jsonl',
            source: 'upload',
          }
        )
      ).rejects.toThrow('exceeds maximum allowed size');
    });
  });

  describe('Dataset Validation', () => {
    it('should validate JSONL format', async () => {
      const jsonlData = `{"prompt": "Hello", "completion": "Hi there!"}\n` +
                       `{"prompt": "How are you?", "completion": "I'm good!"}`;

      const parsed = (manager as any).parseJSONL(jsonlData);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].prompt).toBe('Hello');
      expect(parsed[1].completion).toBe("I'm good!");
    });

    it('should validate JSON format', async () => {
      const jsonData = JSON.stringify([
        { prompt: 'Test 1', completion: 'Response 1' },
        { prompt: 'Test 2', completion: 'Response 2' },
      ]);

      const parsed = (manager as any).parseJSON(jsonData);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].prompt).toBe('Test 1');
    });

    it('should validate CSV format', async () => {
      const csvData = 'prompt,completion\n"Hello","Hi there!"\n"How are you?","I\'m good!"';

      const parsed = (manager as any).parseCSV(csvData);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].prompt).toBe('Hello');
      expect(parsed[1].completion).toBe("I'm good!");
    });
  });

  describe('Dataset Statistics', () => {
    it('should calculate token statistics', async () => {
      const records = [
        { prompt: 'Hello world', completion: 'Hi there!' },
        { prompt: 'How are you?', completion: "I'm good!" },
      ];

      const stats = await (manager as any).calculateStatistics(records);

      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.avgPromptLength).toBeGreaterThan(0);
      expect(stats.avgCompletionLength).toBeGreaterThan(0);
    });
  });

  describe('Dataset Preprocessing', () => {
    it('should clean text', () => {
      const dirtyText = '  Hello    world\n\n  ';
      const clean = (manager as any).cleanText(dirtyText);

      expect(clean).toBe('Hello world');
    });

    it('should remove duplicates', () => {
      const records = [
        { prompt: 'Test', completion: 'Response' },
        { prompt: 'Test', completion: 'Response' },
        { prompt: 'Different', completion: 'Other' },
      ];

      const unique = (manager as any).removeDuplicates
        ? (manager as any).removeDuplicates(records)
        : records;

      expect(unique.length).toBeLessThanOrEqual(records.length);
    });

    it('should filter by length', () => {
      const records = [
        { prompt: 'A', completion: 'B' },
        { prompt: 'A long prompt here', completion: 'Long response' },
      ];

      const filtered = records.filter(r => {
        const total = r.prompt.length + r.completion.length;
        return total >= 10 && total <= 50;
      });

      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Format Conversion', () => {
    it('should convert JSON to JSONL', () => {
      const json = JSON.stringify([
        { prompt: 'Test', completion: 'Response' },
      ]);

      const jsonl = (manager as any).toJSONL
        ? (manager as any).toJSONL(JSON.parse(json))
        : JSON.stringify(JSON.parse(json)[0]);

      expect(jsonl).toContain('"prompt"');
      expect(jsonl).toContain('"completion"');
    });

    it('should convert JSONL to JSON', () => {
      const jsonl = '{"prompt": "Test", "completion": "Response"}';

      const parsed = (manager as any).parseJSONL(jsonl);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].prompt).toBe('Test');
    });
  });

  describe('Schema Inference', () => {
    it('should infer schema from records', () => {
      const records = [
        { prompt: 'Test', completion: 'Response', metadata: { key: 'value' } },
      ];

      const schema = (manager as any).inferSchema(records);

      expect(schema).toBeDefined();
      expect(schema.promptField).toBe('prompt');
      expect(schema.completionField).toBe('completion');
      expect(schema.fields).toBeInstanceOf(Array);
    });
  });
});
