/**
 * Event Transformer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventTransformer } from '../src/transformer/transformer';
import type { EventEnvelope, TransformationRule } from '../src/transformer/transformer';

describe('EventTransformer', () => {
  let transformer: EventTransformer;
  let testEvent: EventEnvelope;

  beforeEach(() => {
    transformer = new EventTransformer();
    testEvent = {
      metadata: {
        eventId: 'evt_1',
        eventType: 'UserCreated',
        timestamp: Date.now(),
        version: 1,
        source: 'user-service',
        userId: 'user_123',
      },
      payload: {
        userId: 'user_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        role: 'user',
      },
    };
  });

  describe('Field Mapping', () => {
    it('should map fields to new locations', async () => {
      const ruleId = transformer.addRule({
        name: 'Map user fields',
        transformation: {
          type: 'map',
          mappings: {
            'firstName': 'name.first',
            'lastName': 'name.last',
            'email': 'contact.email',
          },
          overwrite: false,
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);

      expect(result.success).toBe(true);
      expect(result.event).toBeDefined();
      const payload = result.event!.payload as Record<string, unknown>;
      expect(payload.name).toEqual({ first: 'John', last: 'Doe' });
      expect(payload.contact).toEqual({ email: 'john.doe@example.com' });
    });

    it('should remove source fields after mapping', async () => {
      transformer.addRule({
        name: 'Map and remove',
        transformation: {
          type: 'map',
          mappings: {
            'firstName': 'name.first',
            'lastName': 'name.last',
          },
          removeSource: true,
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      const payload = result.event!.payload as Record<string, unknown>;

      expect(payload.firstName).toBeUndefined();
      expect(payload.lastName).toBeUndefined();
      expect(payload.name).toBeDefined();
    });
  });

  describe('Field Extraction', () => {
    it('should extract values using regex', async () => {
      const eventWithEmail = {
        ...testEvent,
        payload: {
          ...testEvent.payload,
          email: 'john.doe+tag@example.com',
        },
      };

      transformer.addRule({
        name: 'Extract email parts',
        transformation: {
          type: 'extract',
          extractions: [
            {
              sourceField: 'email',
              targetField: 'emailLocal',
              extractionType: 'regex',
              pattern: '^([^@]+)@',
            },
            {
              sourceField: 'email',
              targetField: 'emailDomain',
              extractionType: 'regex',
              pattern: '@([^@]+)$',
            },
          ],
        },
        enabled: true,
      });

      const result = await transformer.transform(eventWithEmail);
      const payload = result.event!.payload as Record<string, unknown>;

      expect(payload.emailLocal).toBe('john.doe+tag');
      expect(payload.emailDomain).toBe('example.com');
    });

    it('should extract values using substring', async () => {
      transformer.addRule({
        name: 'Extract substring',
        transformation: {
          type: 'extract',
          extractions: [
            {
              sourceField: 'email',
              targetField: 'emailPrefix',
              extractionType: 'substring',
              index: 0,
            },
          ],
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      const payload = result.event!.payload as Record<string, unknown>;

      expect(payload.emailPrefix).toBeDefined();
    });
  });

  describe('Enrichment', () => {
    it('should add static values', async () => {
      transformer.addRule({
        name: 'Add timestamp',
        transformation: {
          type: 'enrich',
          enrichments: [
            {
              targetField: 'metadata.processedAt',
              value: {
                type: 'timestamp',
                format: 'iso',
              },
            },
          ],
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      const metadata = result.event!.metadata as Record<string, unknown>;

      expect(metadata.processedAt).toBeDefined();
      expect(typeof metadata.processedAt).toBe('string');
    });

    it('should copy field values', async () => {
      transformer.addRule({
        name: 'Copy userId',
        transformation: {
          type: 'enrich',
          enrichments: [
            {
              targetField: 'metadata.ownerId',
              value: {
                type: 'field',
                source: 'userId',
              },
            },
          ],
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      const metadata = result.event!.metadata as Record<string, unknown>;

      expect(metadata.ownerId).toBe('user_123');
    });

    it('should add UUIDs', async () => {
      transformer.addRule({
        name: 'Add correlation ID',
        transformation: {
          type: 'enrich',
          enrichments: [
            {
              targetField: 'metadata.correlationId',
              value: {
                type: 'uuid',
                version: 4,
              },
            },
          ],
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      const metadata = result.event!.metadata as Record<string, unknown>;

      expect(metadata.correlationId).toBeDefined();
      expect(typeof metadata.correlationId).toBe('string');
    });
  });

  describe('Normalization', () => {
    it('should normalize string case', async () => {
      const eventWithMixedCase = {
        ...testEvent,
        payload: {
          ...testEvent.payload,
          email: 'John.Doe@Example.COM',
        },
      };

      transformer.addRule({
        name: 'Normalize email case',
        transformation: {
          type: 'normalize',
          normalizations: [
            {
              field: 'email',
              operation: 'lowercase',
            },
          ],
        },
        enabled: true,
      });

      const result = await transformer.transform(eventWithMixedCase);
      const payload = result.event!.payload as Record<string, unknown>;

      expect(payload.email).toBe('john.doe@example.com');
    });

    it('should trim whitespace', async () => {
      const eventWithSpaces = {
        ...testEvent,
        payload: {
          ...testEvent.payload,
          email: '  john.doe@example.com  ',
        },
      };

      transformer.addRule({
        name: 'Trim email',
        transformation: {
          type: 'normalize',
          normalizations: [
            {
              field: 'email',
              operation: 'trim',
            },
          ],
        },
        enabled: true,
      });

      const result = await transformer.transform(eventWithSpaces);
      const payload = result.event!.payload as Record<string, unknown>;

      expect(payload.email).toBe('john.doe@example.com');
    });
  });

  describe('Validation', () => {
    it('should validate required fields', async () => {
      transformer.addRule({
        name: 'Validate required fields',
        transformation: {
          type: 'validate',
          validations: [
            {
              field: 'userId',
              rule: { type: 'required' },
            },
            {
              field: 'email',
              rule: { type: 'required' },
            },
          ],
          failAction: 'error',
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      expect(result.success).toBe(true);
    });

    it('should validate field types', async () => {
      transformer.addRule({
        name: 'Validate field types',
        transformation: {
          type: 'validate',
          validations: [
            {
              field: 'userId',
              rule: { type: 'type', expected: 'string' },
            },
            {
              field: 'firstName',
              rule: { type: 'type', expected: 'string' },
            },
          ],
          failAction: 'error',
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      expect(result.success).toBe(true);
    });

    it('should validate patterns', async () => {
      transformer.addRule({
        name: 'Validate email pattern',
        transformation: {
          type: 'validate',
          validations: [
            {
              field: 'email',
              rule: {
                type: 'pattern',
                regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
              },
            },
          ],
          failAction: 'error',
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      expect(result.success).toBe(true);
    });

    it('should validate ranges', async () => {
      const eventWithAge = {
        ...testEvent,
        payload: {
          ...testEvent.payload,
          age: 30,
        },
      };

      transformer.addRule({
        name: 'Validate age range',
        transformation: {
          type: 'validate',
          validations: [
            {
              field: 'age',
              rule: { type: 'range', min: 18, max: 120 },
            },
          ],
          failAction: 'error',
        },
        enabled: true,
      });

      const result = await transformer.transform(eventWithAge);
      expect(result.success).toBe(true);
    });

    it('should validate enums', async () => {
      transformer.addRule({
        name: 'Validate role enum',
        transformation: {
          type: 'validate',
          validations: [
            {
              field: 'role',
              rule: {
                type: 'enum',
                values: ['user', 'admin', 'moderator'],
              },
            },
          ],
          failAction: 'error',
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      expect(result.success).toBe(true);
    });
  });

  describe('Custom Transformations', () => {
    it('should apply custom transformation functions', async () => {
      transformer.addRule({
        name: 'Custom transform',
        transformation: {
          type: 'custom',
          fn: (event: EventEnvelope) => {
            const payload = event.payload as Record<string, unknown>;
            payload.fullName = `${payload.firstName} ${payload.lastName}`;
            return event;
          },
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      const payload = result.event!.payload as Record<string, unknown>;

      expect(payload.fullName).toBe('John Doe');
    });

    it('should support async custom transformations', async () => {
      transformer.addRule({
        name: 'Async custom transform',
        transformation: {
          type: 'custom',
          fn: async (event: EventEnvelope) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            const metadata = event.metadata as Record<string, unknown>;
            metadata.asyncProcessed = true;
            return event;
          },
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      const metadata = result.event!.metadata as Record<string, unknown>;

      expect(metadata.asyncProcessed).toBe(true);
    });
  });

  describe('Conditional Transformations', () => {
    it('should only apply transformations when condition is met', async () => {
      transformer.addRule({
        name: 'Conditional transform',
        condition: {
          type: 'field',
          field: 'role',
          operator: 'eq',
          value: 'admin',
        },
        transformation: {
          type: 'enrich',
          enrichments: [
            {
              targetField: 'adminLevel',
              value: { type: 'static', value: 'super' },
            },
          ],
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent);
      const payload = result.event!.payload as Record<string, unknown>;

      // Should not have adminLevel since role is 'user', not 'admin'
      expect(payload.adminLevel).toBeUndefined();
    });
  });

  describe('Schema Evolution', () => {
    it('should evolve events to new schema version', async () => {
      const v1Event = {
        ...testEvent,
        metadata: {
          ...testEvent.metadata,
          version: 1,
        },
        payload: {
          userId: 'user_123',
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      transformer.addSchemaEvolution({
        eventType: 'UserCreated',
        fromVersion: 1,
        toVersion: 2,
        migrations: [
          {
            version: 2,
            transformations: [
              {
                type: 'extract',
                extractions: [
                  {
                    sourceField: 'name',
                    targetField: 'fullName',
                    extractionType: 'regex',
                    pattern: '^(.+)$',
                  },
                ],
              },
            ],
            addedFields: {
              firstName: { type: 'string', default: '' },
              lastName: { type: 'string', default: '' },
            },
            deprecatedFields: ['name'],
          },
        ],
      });

      const result = await transformer.evolveEvent(v1Event, 2);

      expect(result.success).toBe(true);
      expect(result.event?.metadata.version).toBe(2);
      const payload = result.event!.payload as Record<string, unknown>;
      expect(payload.name).toBeUndefined();
      expect(payload.fullName).toBeDefined();
    });
  });

  describe('Batch Transformation', () => {
    it('should transform multiple events', async () => {
      transformer.addRule({
        name: 'Add timestamp',
        transformation: {
          type: 'enrich',
          enrichments: [
            {
              targetField: 'metadata.processedAt',
              value: { type: 'timestamp', format: 'iso' },
            },
          ],
        },
        enabled: true,
      });

      const events = [
        testEvent,
        { ...testEvent, metadata: { ...testEvent.metadata, eventId: 'evt_2' } },
        { ...testEvent, metadata: { ...testEvent.metadata, eventId: 'evt_3' } },
      ];

      const results = await transformer.transformBatch(events);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should support parallel batch transformation', async () => {
      transformer.addRule({
        name: 'Async transform',
        transformation: {
          type: 'custom',
          fn: async (event: EventEnvelope) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return event;
          },
        },
        enabled: true,
      });

      const events = [
        testEvent,
        { ...testEvent, metadata: { ...testEvent.metadata, eventId: 'evt_2' } },
      ];

      const startTime = Date.now();
      await transformer.transformBatch(events, { parallel: true });
      const duration = Date.now() - startTime;

      // Parallel should be faster than sequential
      expect(duration).toBeLessThan(30);
    });
  });

  describe('Error Handling', () => {
    it('should handle transformation errors gracefully', async () => {
      transformer.addRule({
        name: 'Failing transform',
        transformation: {
          type: 'custom',
          fn: () => {
            throw new Error('Transformation failed');
          },
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent, { stopOnError: false });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Transformation failed');
    });

    it('should stop on error when configured', async () => {
      transformer.addRule({
        name: 'First rule',
        transformation: {
          type: 'enrich',
          enrichments: [
            {
              targetField: 'field1',
              value: { type: 'static', value: 'value1' },
            },
          ],
        },
        enabled: true,
      });

      transformer.addRule({
        name: 'Failing rule',
        transformation: {
          type: 'custom',
          fn: () => {
            throw new Error('Error');
          },
        },
        enabled: true,
      });

      transformer.addRule({
        name: 'Third rule',
        transformation: {
          type: 'enrich',
          enrichments: [
            {
              targetField: 'field2',
              value: { type: 'static', value: 'value2' },
            },
          ],
        },
        enabled: true,
      });

      const result = await transformer.transform(testEvent, { stopOnError: true });

      expect(result.success).toBe(false);
      const payload = result.event?.payload as Record<string, unknown>;
      expect(payload?.field1).toBeDefined();
      expect(payload?.field2).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    it('should track transformation statistics', async () => {
      const ruleId = transformer.addRule({
        name: 'Test rule',
        transformation: {
          type: 'enrich',
          enrichments: [
            {
              targetField: 'test',
              value: { type: 'static', value: 'test' },
            },
          ],
        },
        enabled: true,
      });

      await transformer.transform(testEvent);
      await transformer.transform(testEvent);

      const stats = transformer.getStats();
      expect(stats.totalTransformations).toBe(2);
      expect(stats.successfulTransformations).toBe(2);
    });
  });
});
