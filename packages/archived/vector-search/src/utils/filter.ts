/**
 * Filter utilities for vector search
 */

import { VectorFilter, MetadataFilter, FilterOperator, VectorMetadata } from '../types/index.js';

/**
 * Check if metadata matches a filter
 */
export function matchesFilter(metadata: VectorMetadata, filter: MetadataFilter): boolean {
  const value = metadata[filter.field];

  switch (filter.operator) {
    case FilterOperator.EQUALS:
      return value === filter.value;

    case FilterOperator.NOT_EQUALS:
      return value !== filter.value;

    case FilterOperator.GREATER_THAN:
      return typeof value === 'number' && value > (filter.value as number);

    case FilterOperator.GREATER_THAN_OR_EQUAL:
      return typeof value === 'number' && value >= (filter.value as number);

    case FilterOperator.LESS_THAN:
      return typeof value === 'number' && value < (filter.value as number);

    case FilterOperator.LESS_THAN_OR_EQUAL:
      return typeof value === 'number' && value <= (filter.value as number);

    case FilterOperator.IN:
      return Array.isArray(filter.value) && filter.value.includes(value as string | number);

    case FilterOperator.NOT_IN:
      return Array.isArray(filter.value) && !filter.value.includes(value as string | number);

    case FilterOperator.CONTAINS:
      if (typeof value === 'string') {
        return value.includes(filter.value as string);
      }
      if (Array.isArray(value)) {
        return value.includes(filter.value as string | number);
      }
      return false;

    case FilterOperator.NOT_CONTAINS:
      if (typeof value === 'string') {
        return !value.includes(filter.value as string);
      }
      if (Array.isArray(value)) {
        return !value.includes(filter.value as string | number);
      }
      return true;

    case FilterOperator.STARTS_WITH:
      return typeof value === 'string' && value.startsWith(filter.value as string);

    case FilterOperator.ENDS_WITH:
      return typeof value === 'string' && value.endsWith(filter.value as string);

    default:
      throw new Error(`Unsupported filter operator: ${filter.operator}`);
  }
}

/**
 * Check if metadata matches a vector filter (with AND/OR logic)
 */
export function matchesVectorFilter(metadata: VectorMetadata, filter: VectorFilter): boolean {
  // Must match all conditions
  if (filter.must && filter.must.length > 0) {
    for (const f of filter.must) {
      if (!matchesFilter(metadata, f)) {
        return false;
      }
    }
  }

  // Must not match any conditions
  if (filter.mustNot && filter.mustNot.length > 0) {
    for (const f of filter.mustNot) {
      if (matchesFilter(metadata, f)) {
        return false;
      }
    }
  }

  // Should match at least one condition
  if (filter.should && filter.should.length > 0) {
    const shouldMatch = filter.should.some((f) => matchesFilter(metadata, f));
    if (!shouldMatch) {
      return false;
    }
  }

  return true;
}

/**
 * Combine multiple filters with AND logic
 */
export function andFilters(...filters: VectorFilter[]): VectorFilter {
  const combined: VectorFilter = {};

  for (const filter of filters) {
    if (filter.must) {
      combined.must = [...(combined.must || []), ...filter.must];
    }
    if (filter.mustNot) {
      combined.mustNot = [...(combined.mustNot || []), ...filter.mustNot];
    }
    if (filter.should) {
      combined.should = [...(combined.should || []), ...filter.should];
    }
  }

  return combined;
}

/**
 * Combine multiple filters with OR logic
 */
export function orFilters(...filters: VectorFilter[]): VectorFilter {
  const combined: VectorFilter = { should: [] };

  for (const filter of filters) {
    if (filter.must) {
      combined.should!.push(...filter.must);
    }
    if (filter.mustNot) {
      combined.mustNot = [...(combined.mustNot || []), ...filter.mustNot];
    }
    if (filter.should) {
      combined.should!.push(...filter.should);
    }
  }

  return combined;
}

/**
 * Negate a filter
 */
export function negateFilter(filter: VectorFilter): VectorFilter {
  const negated: VectorFilter = {};

  // Negate must conditions
  if (filter.must) {
    negated.mustNot = filter.must.map((f) => ({
      ...f,
      operator: negateOperator(f.operator),
    }));
  }

  // Negate mustNot conditions
  if (filter.mustNot) {
    negated.must = filter.mustNot.map((f) => ({
      ...f,
      operator: negateOperator(f.operator),
    }));
  }

  // Negate should conditions
  if (filter.should) {
    negated.mustNot = filter.should.map((f) => ({
      ...f,
      operator: negateOperator(f.operator),
    }));
  }

  return negated;
}

/**
 * Negate a filter operator
 */
function negateOperator(operator: FilterOperator): FilterOperator {
  switch (operator) {
    case FilterOperator.EQUALS:
      return FilterOperator.NOT_EQUALS;
    case FilterOperator.NOT_EQUALS:
      return FilterOperator.EQUALS;
    case FilterOperator.GREATER_THAN:
      return FilterOperator.LESS_THAN_OR_EQUAL;
    case FilterOperator.GREATER_THAN_OR_EQUAL:
      return FilterOperator.LESS_THAN;
    case FilterOperator.LESS_THAN:
      return FilterOperator.GREATER_THAN_OR_EQUAL;
    case FilterOperator.LESS_THAN_OR_EQUAL:
      return FilterOperator.GREATER_THAN;
    case FilterOperator.IN:
      return FilterOperator.NOT_IN;
    case FilterOperator.NOT_IN:
      return FilterOperator.IN;
    case FilterOperator.CONTAINS:
      return FilterOperator.NOT_CONTAINS;
    case FilterOperator.NOT_CONTAINS:
      return FilterOperator.CONTAINS;
    default:
      return operator;
  }
}

/**
 * Validate a filter
 */
export function validateFilter(filter: VectorFilter): boolean {
  if (filter.must) {
    for (const f of filter.must) {
      if (!f.field || f.operator === undefined || f.value === undefined) {
        return false;
      }
    }
  }

  if (filter.mustNot) {
    for (const f of filter.mustNot) {
      if (!f.field || f.operator === undefined || f.value === undefined) {
        return false;
      }
    }
  }

  if (filter.should) {
    for (const f of filter.should) {
      if (!f.field || f.operator === undefined || f.value === undefined) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Extract unique field names from a filter
 */
export function extractFilterFields(filter: VectorFilter): string[] {
  const fields = new Set<string>();

  if (filter.must) {
    for (const f of filter.must) {
      fields.add(f.field);
    }
  }

  if (filter.mustNot) {
    for (const f of filter.mustNot) {
      fields.add(f.field);
    }
  }

  if (filter.should) {
    for (const f of filter.should) {
      fields.add(f.field);
    }
  }

  return Array.from(fields);
}

/**
 * Check if a filter is empty
 */
export function isFilterEmpty(filter: VectorFilter): boolean {
  return (
    (!filter.must || filter.must.length === 0) &&
    (!filter.mustNot || filter.mustNot.length === 0) &&
    (!filter.should || filter.should.length === 0)
  );
}

/**
 * Convert filter to string representation
 */
export function filterToString(filter: VectorFilter): string {
  const parts: string[] = [];

  if (filter.must && filter.must.length > 0) {
    const mustStr = filter.must
      .map((f) => `${f.field} ${f.operator} ${JSON.stringify(f.value)}`)
      .join(' AND ');
    parts.push(`MUST: (${mustStr})`);
  }

  if (filter.mustNot && filter.mustNot.length > 0) {
    const mustNotStr = filter.mustNot
      .map((f) => `${f.field} ${f.operator} ${JSON.stringify(f.value)}`)
      .join(' AND ');
    parts.push(`MUST_NOT: (${mustNotStr})`);
  }

  if (filter.should && filter.should.length > 0) {
    const shouldStr = filter.should
      .map((f) => `${f.field} ${f.operator} ${JSON.stringify(f.value)}`)
      .join(' OR ');
    parts.push(`SHOULD: (${shouldStr})`);
  }

  return parts.join(' ');
}

/**
 * Optimize filter by removing redundant conditions
 */
export function optimizeFilter(filter: VectorFilter): VectorFilter {
  const optimized: VectorFilter = {};

  if (filter.must) {
    // Remove duplicate conditions
    const uniqueMust = removeDuplicateFilters(filter.must);
    if (uniqueMust.length > 0) {
      optimized.must = uniqueMust;
    }
  }

  if (filter.mustNot) {
    const uniqueMustNot = removeDuplicateFilters(filter.mustNot);
    if (uniqueMustNot.length > 0) {
      optimized.mustNot = uniqueMustNot;
    }
  }

  if (filter.should) {
    const uniqueShould = removeDuplicateFilters(filter.should);
    if (uniqueShould.length > 0) {
      optimized.should = uniqueShould;
    }
  }

  return optimized;
}

/**
 * Remove duplicate filter conditions
 */
function removeDuplicateFilters(filters: MetadataFilter[]): MetadataFilter[] {
  const seen = new Set<string>();
  const unique: MetadataFilter[] = [];

  for (const filter of filters) {
    const key = `${filter.field}:${filter.operator}:${JSON.stringify(filter.value)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(filter);
    }
  }

  return unique;
}

/**
 * Estimate filter selectivity (0.0 to 1.0)
 */
export function estimateFilterSelectivity(filter: VectorFilter): number {
  // Simple heuristic-based estimation
  let selectivity = 1.0;

  if (filter.must) {
    for (const f of filter.must) {
      selectivity *= estimateConditionSelectivity(f);
    }
  }

  if (filter.should && filter.should.length > 0) {
    // OR logic: take maximum selectivity
    const shouldSelectivity = Math.max(
      ...filter.should.map((f) => estimateConditionSelectivity(f))
    );
    selectivity *= shouldSelectivity;
  }

  return Math.max(0.0, Math.min(1.0, selectivity));
}

/**
 * Estimate selectivity of a single condition
 */
function estimateConditionSelectivity(condition: MetadataFilter): number {
  switch (condition.operator) {
    case FilterOperator.EQUALS:
    case FilterOperator.IN:
      // Low selectivity for equality
      return 0.1;

    case FilterOperator.NOT_EQUALS:
    case FilterOperator.NOT_IN:
      // High selectivity for inequality
      return 0.9;

    case FilterOperator.GREATER_THAN:
    case FilterOperator.LESS_THAN:
      // Medium selectivity for range
      return 0.5;

    case FilterOperator.GREATER_THAN_OR_EQUAL:
    case FilterOperator.LESS_THAN_OR_EQUAL:
      // Medium-high selectivity for inclusive range
      return 0.6;

    case FilterOperator.CONTAINS:
    case FilterOperator.STARTS_WITH:
    case FilterOperator.ENDS_WITH:
      // Medium selectivity for string operations
      return 0.3;

    default:
      return 0.5;
  }
}
