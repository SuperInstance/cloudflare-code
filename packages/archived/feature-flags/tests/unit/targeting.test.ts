/**
 * Unit tests for targeting engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TargetingEngine,
  SegmentBuilder,
} from '../../src/targeting/engine';
import type { Condition, UserAttributes } from '../../src/types/index';

describe('TargetingEngine', () => {
  let engine: TargetingEngine;
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = {
      getSegment: vi.fn(),
      setSegment: vi.fn(),
      deleteSegment: vi.fn(),
      listSegments: vi.fn(),
    };

    engine = new TargetingEngine({
      FLAGS_DURABLE_OBJECT: {
        idFromName: vi.fn(() => mockStorage),
      },
      ANALYTICS_DURABLE_OBJECT: {
        idFromName: vi.fn(),
      },
    } as any);
  });

  describe('condition evaluation', () => {
    const attributes: UserAttributes = {
      userId: 'user123',
      email: 'test@example.com',
      country: 'US',
      age: 25,
      deviceType: 'mobile',
      customAttributes: {
        tier: 'premium',
        daysActive: 100,
      },
    };

    describe('string operators', () => {
      it('should evaluate equals operator', () => {
        const condition: Condition = {
          attribute: 'country',
          operator: 'equals',
          value: 'US',
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });

      it('should evaluate contains operator (case insensitive)', () => {
        const condition: Condition = {
          attribute: 'email',
          operator: 'contains',
          value: 'example',
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });

      it('should evaluate starts_with operator', () => {
        const condition: Condition = {
          attribute: 'email',
          operator: 'starts_with',
          value: 'test',
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });

      it('should evaluate ends_with operator', () => {
        const condition: Condition = {
          attribute: 'email',
          operator: 'ends_with',
          value: '.com',
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });
    });

    describe('numeric operators', () => {
      it('should evaluate greater_than operator', () => {
        const condition: Condition = {
          attribute: 'age',
          operator: 'greater_than',
          value: 20,
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });

      it('should evaluate less_than operator', () => {
        const condition: Condition = {
          attribute: 'age',
          operator: 'less_than',
          value: 30,
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });

      it('should evaluate greater_than_or_equal operator', () => {
        const condition: Condition = {
          attribute: 'age',
          operator: 'greater_than_or_equal',
          value: 25,
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });

      it('should evaluate less_than_or_equal operator', () => {
        const condition: Condition = {
          attribute: 'age',
          operator: 'less_than_or_equal',
          value: 25,
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });
    });

    describe('array operators', () => {
      it('should evaluate in operator', () => {
        const condition: Condition = {
          attribute: 'country',
          operator: 'in',
          value: ['US', 'CA', 'UK'],
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });

      it('should evaluate not_in operator', () => {
        const condition: Condition = {
          attribute: 'country',
          operator: 'not_in',
          value: ['CA', 'UK'],
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });
    });

    describe('nested attributes', () => {
      it('should evaluate nested attribute conditions', () => {
        const condition: Condition = {
          attribute: 'customAttributes.tier',
          operator: 'equals',
          value: 'premium',
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });

      it('should evaluate nested numeric conditions', () => {
        const condition: Condition = {
          attribute: 'customAttributes.daysActive',
          operator: 'greater_than',
          value: 50,
        };
        expect(engine.matchesCondition(condition, attributes)).toBe(true);
      });
    });

    describe('multiple conditions', () => {
      const conditions: Condition[] = [
        { attribute: 'country', operator: 'equals', value: 'US' },
        { attribute: 'age', operator: 'greater_than', value: 18 },
        { attribute: 'deviceType', operator: 'equals', value: 'mobile' },
      ];

      it('should evaluate with AND logic', () => {
        const result = engine.matchesConditions(conditions, 'AND', attributes);
        expect(result).toBe(true);
      });

      it('should evaluate with OR logic', () => {
        const orConditions: Condition[] = [
          { attribute: 'country', operator: 'equals', value: 'UK' },
          { attribute: 'deviceType', operator: 'equals', value: 'mobile' },
        ];
        const result = engine.matchesConditions(orConditions, 'OR', attributes);
        expect(result).toBe(true);
      });

      it('should fail AND logic when one condition fails', () => {
        const failConditions: Condition[] = [
          { attribute: 'country', operator: 'equals', value: 'US' },
          { attribute: 'age', operator: 'less_than', value: 10 },
        ];
        const result = engine.matchesConditions(failConditions, 'AND', attributes);
        expect(result).toBe(false);
      });
    });
  });

  describe('attribute value extraction', () => {
    const attributes: UserAttributes = {
      userId: 'user123',
      customAttributes: {
        tier: 'premium',
        settings: {
          theme: 'dark',
          notifications: true,
        },
      },
    };

    it('should extract top-level attribute', () => {
      const value = engine.getAttributeValue(attributes, 'userId');
      expect(value).toBe('user123');
    });

    it('should extract nested attribute', () => {
      const value = engine.getAttributeValue(attributes, 'customAttributes.tier');
      expect(value).toBe('premium');
    });

    it('should extract deeply nested attribute', () => {
      const value = engine.getAttributeValue(
        attributes,
        'customAttributes.settings.theme'
      );
      expect(value).toBe('dark');
    });

    it('should return undefined for non-existent attribute', () => {
      const value = engine.getAttributeValue(attributes, 'nonexistent');
      expect(value).toBeUndefined();
    });

    it('should return undefined for invalid nested path', () => {
      const value = engine.getAttributeValue(
        attributes,
        'customAttributes.invalid.path'
      );
      expect(value).toBeUndefined();
    });
  });
});

describe('SegmentBuilder', () => {
  it('should build segment config', () => {
    const builder = new SegmentBuilder()
      .setName('Premium Users')
      .setDescription('Premium tier customers')
      .setLogic('AND')
      .addCondition('customAttributes.tier', 'equals', 'premium')
      .addCondition('customAttributes.daysActive', 'greater_than', 30)
      .addUser('user-1')
      .addUser('user-2');

    const config = builder.build();

    expect(config.name).toBe('Premium Users');
    expect(config.description).toBe('Premium tier customers');
    expect(config.逻辑).toBe('AND');
    expect(config.conditions).toHaveLength(2);
    expect(config.userIds).toHaveLength(2);
  });

  it('should add multiple users at once', () => {
    const builder = new SegmentBuilder()
      .setName('Test Segment')
      .addUsers(['user-1', 'user-2', 'user-3']);

    const config = builder.build();
    expect(config.userIds).toEqual(['user-1', 'user-2', 'user-3']);
  });
});
