/**
 * Tests for Formatters
 */

import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatDecimal,
  formatPercent,
  formatCurrency,
  formatDate,
  formatTime,
  timeAgo,
  formatAddress,
  formatName,
} from '../src/formatters/index.js';

describe('Number Formatters', () => {
  it('should format number for English locale', () => {
    const result = formatNumber(1234.56, 'en-US');
    expect(result).toBe('1,234.56');
  });

  it('should format number for German locale', () => {
    const result = formatNumber(1234.56, 'de-DE');
    expect(result).toBe('1.234,56');
  });

  it('should format decimal', () => {
    const result = formatDecimal(123.456, 'en-US', 2);
    expect(result).toBe('123.46');
  });

  it('should format percentage', () => {
    const result = formatPercent(0.75, 'en-US');
    expect(result).toContain('%');
  });

  it('should format currency', () => {
    const result = formatCurrency(99.99, 'en-US', 'USD');
    expect(result).toContain('$');
    expect(result).toContain('99.99');
  });

  it('should format currency for Euro', () => {
    const result = formatCurrency(99.99, 'de-DE', 'EUR');
    expect(result).toContain('€');
  });
});

describe('Date/Time Formatters', () => {
  it('should format date for English locale', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date, 'en-US');
    expect(result).toBeTruthy();
    expect(result).toContain('2024');
  });

  it('should format time', () => {
    const date = new Date('2024-01-15T14:30:00');
    const result = formatTime(date, 'en-US');
    expect(result).toBeTruthy();
  });

  it('should format time ago', () => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const result = timeAgo(oneHourAgo, 'en-US');
    expect(result).toContain('hour');
  });

  it('should handle different date formats', () => {
    const date = new Date('2024-01-15');
    const short = formatDate(date, 'en-US', { format: 'short' });
    const long = formatDate(date, 'en-US', { format: 'long' });

    expect(short).toBeTruthy();
    expect(long).toBeTruthy();
    expect(long.length).toBeGreaterThan(short.length);
  });
});

describe('Address Formatters', () => {
  it('should format US address', () => {
    const address = {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    };

    const result = formatAddress(address, 'en-US');
    expect(result).toContain('Main St');
    expect(result).toContain('New York');
  });

  it('should validate address', () => {
    const address = {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    };

    const result = formatAddress(address, 'en-US');
    expect(result).toBeTruthy();
  });
});

describe('Name Formatters', () => {
  it('should format name in Western order', () => {
    const name = {
      givenName: 'John',
      familyName: 'Doe',
    };

    const result = formatName(name, 'en-US', { order: 'western' });
    expect(result).toContain('John');
    expect(result).toContain('Doe');
    expect(result.indexOf('John')).toBeLessThan(result.indexOf('Doe'));
  });

  it('should format name in Eastern order', () => {
    const name = {
      givenName: '太郎',
      familyName: '山田',
    };

    const result = formatName(name, 'ja-JP', { order: 'eastern' });
    expect(result).toContain('山田');
    expect(result).toContain('太郎');
    expect(result.indexOf('山田')).toBeLessThan(result.indexOf('太郎'));
  });

  it('should parse full name', () => {
    const result = formatName('John Doe', 'en-US');
    expect(result).toContain('John');
  });

  it('should format monogram', () => {
    const name = {
      givenName: 'John',
      familyName: 'Doe',
    };

    const result = formatName(name, 'en-US', { format: 'monogram' });
    expect(result).toBe('JD');
  });
});
