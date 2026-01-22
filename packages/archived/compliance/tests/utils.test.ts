import { describe, it, expect } from 'vitest';
import {
  DateUtils,
  SeverityUtils,
  RiskUtils,
  ComplianceUtils,
  ValidationUtils,
  IdUtils,
  ArrayUtils,
  ObjectUtils
} from '../src/utils';
import { SeverityLevel, RiskLevel, ComplianceStatus, ComplianceStandard } from '../src/types';

describe('DateUtils', () => {
  it('should add days to date', () => {
    const date = new Date('2024-01-01');
    const result = DateUtils.addDays(date, 7);

    expect(result.getDate()).toBe(8);
  });

  it('should add months to date', () => {
    const date = new Date('2024-01-01');
    const result = DateUtils.addMonths(date, 2);

    expect(result.getMonth()).toBe(2); // March
  });

  it('should get date range', () => {
    const range = DateUtils.getDateRange('weekly');

    expect(range.start).toBeDefined();
    expect(range.end).toBeDefined();
    expect(range.start < range.end).toBe(true);
  });

  it('should calculate days between dates', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-08');

    const days = DateUtils.daysBetween(start, end);

    expect(days).toBe(7);
  });
});

describe('SeverityUtils', () => {
  it('should get numeric value for severity', () => {
    expect(SeverityUtils.getNumericValue(SeverityLevel.CRITICAL)).toBe(5);
    expect(SeverityUtils.getNumericValue(SeverityLevel.HIGH)).toBe(4);
    expect(SeverityUtils.getNumericValue(SeverityLevel.MEDIUM)).toBe(3);
    expect(SeverityUtils.getNumericValue(SeverityLevel.LOW)).toBe(2);
    expect(SeverityUtils.getNumericValue(SeverityLevel.INFO)).toBe(1);
  });

  it('should get color for severity', () => {
    const color = SeverityUtils.getColor(SeverityLevel.CRITICAL);
    expect(color).toBe('#d32f2f');
  });

  it('should compare severities', () => {
    const comparison = SeverityUtils.compare(SeverityLevel.CRITICAL, SeverityLevel.LOW);
    expect(comparison).toBeGreaterThan(0);
  });

  it('should get highest severity', () => {
    const highest = SeverityUtils.getHighest([
      SeverityLevel.LOW,
      SeverityLevel.MEDIUM,
      SeverityLevel.HIGH
    ]);
    expect(highest).toBe(SeverityLevel.HIGH);
  });
});

describe('RiskUtils', () => {
  it('should calculate risk score', () => {
    const score = RiskUtils.calculateRiskScore(4, 5);
    expect(score).toBe(20);
  });

  it('should get risk level from score', () => {
    expect(RiskUtils.getRiskLevel(25)).toBe(RiskLevel.CRITICAL);
    expect(RiskUtils.getRiskLevel(16)).toBe(RiskLevel.HIGH);
    expect(RiskUtils.getRiskLevel(10)).toBe(RiskLevel.MEDIUM);
    expect(RiskUtils.getRiskLevel(4)).toBe(RiskLevel.LOW);
  });

  it('should get numeric value for risk level', () => {
    expect(RiskUtils.getNumericValue(RiskLevel.CRITICAL)).toBe(4);
    expect(RiskUtils.getNumericValue(RiskLevel.HIGH)).toBe(3);
    expect(RiskUtils.getNumericValue(RiskLevel.MEDIUM)).toBe(2);
    expect(RiskUtils.getNumericValue(RiskLevel.LOW)).toBe(1);
  });
});

describe('ComplianceUtils', () => {
  it('should calculate compliance percentage', () => {
    const percentage = ComplianceUtils.calculateCompliance(80, 100);
    expect(percentage).toBe(80);
  });

  it('should get compliance status from percentage', () => {
    expect(ComplianceUtils.getComplianceStatus(95)).toBe(ComplianceStatus.COMPLIANT);
    expect(ComplianceUtils.getComplianceStatus(85)).toBe(ComplianceStatus.PARTIALLY_COMPLIANT);
    expect(ComplianceUtils.getComplianceStatus(70)).toBe(ComplianceStatus.NON_COMPLIANT);
  });

  it('should get trend', () => {
    expect(ComplianceUtils.getTrend(85, 80)).toBe('improving');
    expect(ComplianceUtils.getTrend(80, 80)).toBe('stable');
    expect(ComplianceUtils.getTrend(75, 80)).toBe('declining');
  });

  it('should get standard name', () => {
    expect(ComplianceUtils.getStandardName(ComplianceStandard.SOC2)).toBe('SOC 2 Type II');
    expect(ComplianceUtils.getStandardName(ComplianceStandard.GDPR)).toBe('GDPR');
  });
});

describe('ValidationUtils', () => {
  it('should validate email', () => {
    expect(ValidationUtils.isValidEmail('test@example.com')).toBe(true);
    expect(ValidationUtils.isValidEmail('invalid')).toBe(false);
  });

  it('should validate URL', () => {
    expect(ValidationUtils.isValidUrl('https://example.com')).toBe(true);
    expect(ValidationUtils.isValidUrl('not-a-url')).toBe(false);
  });

  it('should validate version', () => {
    expect(ValidationUtils.isValidVersion('1.0.0')).toBe(true);
    expect(ValidationUtils.isValidVersion('2.1.3-beta')).toBe(true);
    expect(ValidationUtils.isValidVersion('invalid')).toBe(false);
  });

  it('should validate ID', () => {
    expect(ValidationUtils.isValidId('test-id-123')).toBe(true);
    expect(ValidationUtils.isValidId('Invalid_ID')).toBe(false);
  });

  it('should generate slug', () => {
    const slug = ValidationUtils.generateSlug('Hello World Test!');
    expect(slug).toBe('hello-world-test');
  });
});

describe('IdUtils', () => {
  it('should generate ID', () => {
    const id = IdUtils.generateId('test');
    expect(id).toMatch(/^test-\d+-[a-z0-9]+$/);
  });

  it('should generate UUID', () => {
    const uuid = IdUtils.generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should generate hash', () => {
    const hash = IdUtils.generateHash('test data');
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
  });
});

describe('ArrayUtils', () => {
  it('should group array by key', () => {
    const data = [
      { category: 'A', value: 1 },
      { category: 'B', value: 2 },
      { category: 'A', value: 3 }
    ];

    const grouped = ArrayUtils.groupBy(data, item => item.category);

    expect(grouped['A']).toHaveLength(2);
    expect(grouped['B']).toHaveLength(1);
  });

  it('should get unique array', () => {
    const array = [1, 2, 2, 3, 3, 3];
    const unique = ArrayUtils.unique(array);

    expect(unique).toEqual([1, 2, 3]);
  });

  it('should sort array by key', () => {
    const array = [
      { value: 3 },
      { value: 1 },
      { value: 2 }
    ];

    const sorted = ArrayUtils.sortBy(array, item => item.value, 'asc');

    expect(sorted[0].value).toBe(1);
    expect(sorted[2].value).toBe(3);
  });

  it('should chunk array', () => {
    const array = [1, 2, 3, 4, 5];
    const chunks = ArrayUtils.chunk(array, 2);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual([1, 2]);
    expect(chunks[2]).toEqual([5]);
  });

  it('should paginate array', () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const paginated = ArrayUtils.paginate(array, 2, 3);

    expect(paginated.data).toEqual([4, 5, 6]);
    expect(paginated.total).toBe(10);
    expect(paginated.page).toBe(2);
    expect(paginated.hasMore).toBe(true);
  });
});

describe('ObjectUtils', () => {
  it('should deep clone object', () => {
    const obj = { a: 1, b: { c: 2 } };
    const cloned = ObjectUtils.deepClone(obj);

    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.b).not.toBe(obj.b);
  });

  it('should merge objects', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { b: 3, c: 4 };

    const merged = ObjectUtils.merge(obj1, obj2);

    expect(merged).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should get nested value', () => {
    const obj = {
      a: {
        b: {
          c: 'value'
        }
      }
    };

    const value = ObjectUtils.get(obj, 'a.b.c');
    expect(value).toBe('value');
  });

  it('should set nested value', () => {
    const obj: any = {};

    ObjectUtils.set(obj, 'a.b.c', 'value');

    expect(obj.a.b.c).toBe('value');
  });

  it('should remove undefined values', () => {
    const obj = {
      a: 1,
      b: undefined,
      c: null,
      d: 'value'
    };

    const cleaned = ObjectUtils.removeUndefined(obj);

    expect(cleaned).toEqual({ a: 1, c: null, d: 'value' });
  });
});
