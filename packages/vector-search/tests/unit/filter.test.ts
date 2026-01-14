/**
 * Unit tests for filter utilities
 */

import {
  matchesFilter,
  matchesVectorFilter,
  andFilters,
  orFilters,
  negateFilter,
  validateFilter,
  extractFilterFields,
  isFilterEmpty,
  filterToString,
  optimizeFilter,
  estimateFilterSelectivity,
} from '../../src/utils/filter.js';
import {
  VectorFilter,
  MetadataFilter,
  FilterOperator,
} from '../../src/types/index.js';

describe('Filter Utilities', () => {
  describe('matchesFilter', () => {
    const metadata = {
      category: 'electronics',
      price: 100,
      inStock: true,
      tags: ['new', 'featured'],
    };

    it('should match EQUALS filter', () => {
      const filter: MetadataFilter = {
        field: 'category',
        operator: FilterOperator.EQUALS,
        value: 'electronics',
      };

      expect(matchesFilter(metadata, filter)).toBe(true);
    });

    it('should match NOT_EQUALS filter', () => {
      const filter: MetadataFilter = {
        field: 'category',
        operator: FilterOperator.NOT_EQUALS,
        value: 'clothing',
      };

      expect(matchesFilter(metadata, filter)).toBe(true);
    });

    it('should match GREATER_THAN filter', () => {
      const filter: MetadataFilter = {
        field: 'price',
        operator: FilterOperator.GREATER_THAN,
        value: 50,
      };

      expect(matchesFilter(metadata, filter)).toBe(true);
    });

    it('should match LESS_THAN filter', () => {
      const filter: MetadataFilter = {
        field: 'price',
        operator: FilterOperator.LESS_THAN,
        value: 200,
      };

      expect(matchesFilter(metadata, filter)).toBe(true);
    });

    it('should match IN filter', () => {
      const filter: MetadataFilter = {
        field: 'category',
        operator: FilterOperator.IN,
        value: ['electronics', 'books'],
      };

      expect(matchesFilter(metadata, filter)).toBe(true);
    });

    it('should match CONTAINS filter for arrays', () => {
      const filter: MetadataFilter = {
        field: 'tags',
        operator: FilterOperator.CONTAINS,
        value: 'new',
      };

      expect(matchesFilter(metadata, filter)).toBe(true);
    });

    it('should match STARTS_WITH filter', () => {
      const filter: MetadataFilter = {
        field: 'category',
        operator: FilterOperator.STARTS_WITH,
        value: 'ele',
      };

      expect(matchesFilter(metadata, filter)).toBe(true);
    });

    it('should match ENDS_WITH filter', () => {
      const filter: MetadataFilter = {
        field: 'category',
        operator: FilterOperator.ENDS_WITH,
        value: 'ics',
      };

      expect(matchesFilter(metadata, filter)).toBe(true);
    });

    it('should not match non-matching filter', () => {
      const filter: MetadataFilter = {
        field: 'category',
        operator: FilterOperator.EQUALS,
        value: 'books',
      };

      expect(matchesFilter(metadata, filter)).toBe(false);
    });
  });

  describe('matchesVectorFilter', () => {
    const metadata = {
      category: 'electronics',
      price: 100,
      inStock: true,
    };

    it('should match must conditions', () => {
      const filter: VectorFilter = {
        must: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
          {
            field: 'price',
            operator: FilterOperator.GREATER_THAN,
            value: 50,
          },
        ],
      };

      expect(matchesVectorFilter(metadata, filter)).toBe(true);
    });

    it('should match mustNot conditions', () => {
      const filter: VectorFilter = {
        mustNot: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'books',
          },
        ],
      };

      expect(matchesVectorFilter(metadata, filter)).toBe(true);
    });

    it('should match should conditions', () => {
      const filter: VectorFilter = {
        should: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'books',
          },
        ],
      };

      expect(matchesVectorFilter(metadata, filter)).toBe(true);
    });

    it('should not match failing must condition', () => {
      const filter: VectorFilter = {
        must: [
          {
            field: 'price',
            operator: FilterOperator.LESS_THAN,
            value: 50,
          },
        ],
      };

      expect(matchesVectorFilter(metadata, filter)).toBe(false);
    });

    it('should not match failing mustNot condition', () => {
      const filter: VectorFilter = {
        mustNot: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
        ],
      };

      expect(matchesVectorFilter(metadata, filter)).toBe(false);
    });
  });

  describe('andFilters', () => {
    it('should combine filters with AND logic', () => {
      const filter1: VectorFilter = {
        must: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
        ],
      };

      const filter2: VectorFilter = {
        must: [
          {
            field: 'price',
            operator: FilterOperator.GREATER_THAN,
            value: 50,
          },
        ],
      };

      const combined = andFilters(filter1, filter2);

      expect(combined.must).toHaveLength(2);
    });
  });

  describe('orFilters', () => {
    it('should combine filters with OR logic', () => {
      const filter1: VectorFilter = {
        must: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
        ],
      };

      const filter2: VectorFilter = {
        must: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'books',
          },
        ],
      };

      const combined = orFilters(filter1, filter2);

      expect(combined.should).toHaveLength(2);
    });
  });

  describe('negateFilter', () => {
    it('should negate filter', () => {
      const filter: VectorFilter = {
        must: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
        ],
      };

      const negated = negateFilter(filter);

      expect(negated.mustNot).toBeDefined();
      expect(negated.mustNot).toHaveLength(1);
    });
  });

  describe('validateFilter', () => {
    it('should validate correct filter', () => {
      const filter: VectorFilter = {
        must: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
        ],
      };

      expect(validateFilter(filter)).toBe(true);
    });

    it('should invalidate filter with missing field', () => {
      const filter: VectorFilter = {
        must: [
          {
            field: '',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
        ],
      };

      expect(validateFilter(filter)).toBe(false);
    });
  });

  describe('extractFilterFields', () => {
    it('should extract field names', () => {
      const filter: VectorFilter = {
        must: [
          { field: 'category', operator: FilterOperator.EQUALS, value: 'electronics' },
          { field: 'price', operator: FilterOperator.GREATER_THAN, value: 50 },
        ],
        should: [{ field: 'tags', operator: FilterOperator.CONTAINS, value: 'new' }],
      };

      const fields = extractFilterFields(filter);

      expect(fields).toContain('category');
      expect(fields).toContain('price');
      expect(fields).toContain('tags');
    });
  });

  describe('isFilterEmpty', () => {
    it('should return true for empty filter', () => {
      const filter: VectorFilter = {};

      expect(isFilterEmpty(filter)).toBe(true);
    });

    it('should return false for non-empty filter', () => {
      const filter: VectorFilter = {
        must: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
        ],
      };

      expect(isFilterEmpty(filter)).toBe(false);
    });
  });

  describe('filterToString', () => {
    it('should convert filter to string', () => {
      const filter: VectorFilter = {
        must: [
          {
            field: 'category',
            operator: FilterOperator.EQUALS,
            value: 'electronics',
          },
        ],
      };

      const str = filterToString(filter);

      expect(str).toContain('MUST');
      expect(str).toContain('category');
    });
  });

  describe('optimizeFilter', () => {
    it('should remove duplicate conditions', () => {
      const filter: VectorFilter = {
        must: [
          { field: 'category', operator: FilterOperator.EQUALS, value: 'electronics' },
          { field: 'category', operator: FilterOperator.EQUALS, value: 'electronics' },
        ],
      };

      const optimized = optimizeFilter(filter);

      expect(optimized.must).toHaveLength(1);
    });
  });

  describe('estimateFilterSelectivity', () => {
    it('should estimate selectivity', () => {
      const filter: VectorFilter = {
        must: [
          { field: 'category', operator: FilterOperator.EQUALS, value: 'electronics' },
        ],
      };

      const selectivity = estimateFilterSelectivity(filter);

      expect(selectivity).toBeGreaterThanOrEqual(0);
      expect(selectivity).toBeLessThanOrEqual(1);
    });
  });
});
