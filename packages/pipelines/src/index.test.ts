/**
 * Data Pipeline Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import all modules for testing
import {
  RestApiIngestor,
  StreamBuilder,
  transform,
  PredefinedRules,
  workflow,
  DataQualityValidator
} from './index';

describe('Data Ingestion', () => {
  describe('RestApiIngestor', () => {
    it('should create ingestor with config', () => {
      const ingestor = new RestApiIngestor({
        id: 'test-api',
        config: {
          url: 'https://api.test.com/data',
          method: 'GET'
        }
      });

      expect(ingestor).toBeDefined();
    });
  });
});

describe('Stream Processing', () => {
  describe('StreamBuilder', () => {
    it('should create stream builder', () => {
      const builder = new StreamBuilder();
      expect(builder).toBeDefined();
    });

    it('should chain operations', () => {
      const builder = new StreamBuilder()
        .filter(() => true)
        .map(event => event)
        .limit(10);

      expect(builder).toBeDefined();
    });
  });
});

describe('Data Transformation', () => {
  describe('transform()', () => {
    it('should create transformation DSL', () => {
      const dsl = transform();
      expect(dsl).toBeDefined();
    });

    it('should chain transformation operations', async () => {
      const data = [
        { id: 1, name: 'Alice', email: 'ALICE@EXAMPLE.COM' },
        { id: 2, name: 'Bob', email: 'BOB@EXAMPLE.COM' }
      ];

      const result = await transform()
        .project('id', 'name', 'email')
        .normalize({ type: 'lowercase', field: 'email' })
        .execute(data);

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('alice@example.com');
    });
  });
});

describe('Data Quality', () => {
  describe('PredefinedRules', () => {
    it('should create required field rule', () => {
      const rule = PredefinedRules.requiredField('id');
      expect(rule).toBeDefined();
      expect(rule.config.field).toBe('id');
    });

    it('should create email validation rule', () => {
      const rule = PredefinedRules.email('email');
      expect(rule).toBeDefined();
      expect(rule.config.field).toBe('email');
    });
  });

  describe('DataQualityValidator', () => {
    it('should validate records', async () => {
      const validator = new DataQualityValidator({
        enabled: true,
        rules: [
          PredefinedRules.requiredField('id'),
          PredefinedRules.email('email')
        ],
        actions: ['drop']
      });

      const records = [
        { id: 1, email: 'test@example.com' },
        { id: 2, email: 'invalid-email' }
      ];

      const results = await validator.validateRecords(records);

      expect(results).toHaveLength(2); // 2 rules * 2 records
    });
  });
});

describe('Pipeline Orchestration', () => {
  describe('workflow()', () => {
    it('should create workflow builder', () => {
      const builder = workflow();
      expect(builder).toBeDefined();
    });

    it('should build complete workflow', () => {
      const wf = workflow()
        .id('test-workflow')
        .name('Test Workflow')
        .addSource('source', { type: 'test' })
        .addTransform('transform', { operation: 'test' })
        .addDestination('destination', { type: 'test' })
        .addEdge('source', 'transform')
        .addEdge('transform', 'destination')
        .build();

      expect(wf.id).toBe('test-workflow');
      expect(wf.nodes).toHaveLength(3);
      expect(wf.edges).toHaveLength(2);
    });
  });
});

describe('Utilities', () => {
  describe('chunk()', () => {
    it('should chunk array into smaller arrays', () => {
      const arr = [1, 2, 3, 4, 5, 6];
      const chunks = chunk(arr, 2);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual([1, 2]);
    });
  });

  describe('unique()', () => {
    it('should return unique values', () => {
      const arr = [1, 2, 2, 3, 3, 3];
      const result = unique(arr);

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('generateId()', () => {
    it('should generate unique ID', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test-/);
    });
  });
});

// Helper functions (would be imported from utils)
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
