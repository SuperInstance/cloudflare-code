/**
 * Tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  estimateLatency,
  calculatePercentile,
  calculateStdDev,
  calculateEMA,
  detectOutliers,
  calculateWeightedAverage,
  linearRegression,
  formatLatency,
  formatPercentage,
  clamp,
  mapRange,
  lerp,
} from '../utils/calculations.js';
import {
  validateRegion,
  validateGeoLocation,
  isValidCIDR,
  isValidIP,
  isPercentage,
  isValidPort,
  isValidURL,
} from '../utils/validation.js';

describe('Calculation Utilities', () => {
  describe('distance calculation', () => {
    it('should calculate distance between New York and London', () => {
      const distance = calculateDistance(40.71, -74.01, 51.51, -0.13);

      expect(distance).toBeGreaterThan(5500);
      expect(distance).toBeLessThan(5600);
    });

    it('should calculate distance between San Francisco and Tokyo', () => {
      const distance = calculateDistance(37.77, -122.42, 35.68, 139.77);

      expect(distance).toBeGreaterThan(8200);
      expect(distance).toBeLessThan(8300);
    });

    it('should return 0 for same location', () => {
      const distance = calculateDistance(40.71, -74.01, 40.71, -74.01);

      expect(distance).toBeCloseTo(0, 2);
    });
  });

  describe('latency estimation', () => {
    it('should estimate latency based on distance', () => {
      const latency = estimateLatency(5000); // 5000 km

      expect(latency).toBeGreaterThan(20);
      expect(latency).toBeLessThan(200);
    });

    it('should estimate higher latency for longer distances', () => {
      const latency1 = estimateLatency(1000);
      const latency2 = estimateLatency(10000);

      expect(latency2).toBeGreaterThan(latency1);
    });

    it('should have minimum latency for short distances', () => {
      const latency = estimateLatency(10); // 10 km

      expect(latency).toBeGreaterThan(0);
      expect(latency).toBeLessThan(50);
    });
  });

  describe('percentile calculation', () => {
    it('should calculate median (P50)', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const p50 = calculatePercentile(values, 50);

      expect(p50).toBe(5);
    });

    it('should calculate P95', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const p95 = calculatePercentile(values, 95);

      expect(p95).toBe(95);
    });

    it('should handle empty array', () => {
      const p50 = calculatePercentile([], 50);

      expect(p50).toBe(0);
    });
  });

  describe('standard deviation', () => {
    it('should calculate standard deviation', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = calculateStdDev(values);

      expect(stdDev).toBeCloseTo(2, 1);
    });

    it('should return 0 for single value', () => {
      const stdDev = calculateStdDev([5]);

      expect(stdDev).toBe(0);
    });

    it('should return 0 for empty array', () => {
      const stdDev = calculateStdDev([]);

      expect(stdDev).toBe(0);
    });
  });

  describe('exponential moving average', () => {
    it('should calculate EMA', () => {
      const values = [10, 20, 30, 40, 50];
      const ema = calculateEMA(values, 0.2);

      expect(ema).toHaveLength(5);
      expect(ema[0]).toBe(10);
      expect(ema[4]).toBeGreaterThan(ema[3]);
    });

    it('should handle empty array', () => {
      const ema = calculateEMA([], 0.2);

      expect(ema).toHaveLength(0);
    });
  });

  describe('outlier detection', () => {
    it('should detect outliers using IQR method', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]; // 100 is an outlier
      const result = detectOutliers(values);

      expect(result.outliers).toContain(100);
      expect(result.cleaned).not.toContain(100);
    });

    it('should handle small datasets', () => {
      const values = [1, 2, 3];
      const result = detectOutliers(values);

      expect(result.outliers).toHaveLength(0);
      expect(result.cleaned).toEqual(values);
    });
  });

  describe('weighted average', () => {
    it('should calculate weighted average', () => {
      const values = [1, 2, 3, 4];
      const weights = [1, 1, 1, 1];

      const avg = calculateWeightedAverage(values, weights);

      expect(avg).toBe(2.5);
    });

    it('should weight values correctly', () => {
      const values = [1, 2, 3];
      const weights = [1, 2, 3];

      const avg = calculateWeightedAverage(values, weights);

      expect(avg).toBeCloseTo(2.33, 2);
    });

    it('should handle empty arrays', () => {
      const avg = calculateWeightedAverage([], []);

      expect(avg).toBe(0);
    });
  });

  describe('linear regression', () => {
    it('should calculate slope and intercept', () => {
      const values = [1, 2, 3, 4, 5];
      const result = linearRegression(values);

      expect(result.slope).toBeCloseTo(1, 1);
      expect(result.intercept).toBeDefined();
      expect(result.predict(0)).toBeCloseTo(result.intercept, 1);
    });

    it('should predict future values', () => {
      const values = [10, 20, 30, 40, 50];
      const result = linearRegression(values);

      const predicted = result.predict(6); // 6th value

      expect(predicted).toBeCloseTo(60, 0);
    });
  });

  describe('formatting utilities', () => {
    it('should format latency in milliseconds', () => {
      expect(formatLatency(100)).toBe('100ms');
      expect(formatLatency(0.5)).toBe('500μs');
    });

    it('should format latency in seconds', () => {
      expect(formatLatency(1500)).toBe('1.50s');
      expect(formatLatency(5000)).toBe('5.00s');
    });

    it('should format percentage', () => {
      expect(formatPercentage(0.5)).toBe('50.00%');
      expect(formatPercentage(0.123)).toBe('12.30%');
      expect(formatPercentage(1)).toBe('100.00%');
    });
  });

  describe('math utilities', () => {
    it('should clamp values', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should map ranges', () => {
      expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
      expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
      expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
    });

    it('should interpolate values', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(0, 100, 1)).toBe(100);
    });
  });
});

describe('Validation Utilities', () => {
  describe('region validation', () => {
    it('should validate correct regions', () => {
      expect(validateRegion('us-east-1')).toBe(true);
      expect(validateRegion('eu-west-1')).toBe(true);
      expect(validateRegion('ap-southeast-1')).toBe(true);
    });

    it('should reject invalid regions', () => {
      expect(validateRegion('invalid-region')).toBe(false);
      expect(validateRegion('')).toBe(false);
      expect(validateRegion('us-east-')).toBe(false);
    });
  });

  describe('geographic location validation', () => {
    it('should validate correct locations', () => {
      const validLocation = {
        country: 'US',
        continent: 'NA',
        latitude: 40.71,
        longitude: -74.01,
      };

      expect(validateGeoLocation(validLocation)).toBe(true);
    });

    it('should reject invalid locations', () => {
      const invalidLocation1 = {
        country: 'US',
        continent: 'XX', // Invalid continent
        latitude: 40.71,
        longitude: -74.01,
      };

      const invalidLocation2 = {
        country: 'US',
        continent: 'NA',
        latitude: 100, // Invalid latitude
        longitude: -74.01,
      };

      expect(validateGeoLocation(invalidLocation1)).toBe(false);
      expect(validateGeoLocation(invalidLocation2)).toBe(false);
    });
  });

  describe('CIDR validation', () => {
    it('should validate correct CIDR notation', () => {
      expect(isValidCIDR('192.168.1.0/24')).toBe(true);
      expect(isValidCIDR('10.0.0.0/8')).toBe(true);
      expect(isValidCIDR('172.16.0.0/12')).toBe(true);
    });

    it('should reject invalid CIDR', () => {
      expect(isValidCIDR('192.168.1.0/33')).toBe(false); // Invalid prefix
      expect(isValidCIDR('256.1.1.1/24')).toBe(false); // Invalid IP
      expect(isValidCIDR('not-a-cidr')).toBe(false);
    });
  });

  describe('IP validation', () => {
    it('should validate correct IP addresses', () => {
      expect(isValidIP('192.168.1.1')).toBe(true);
      expect(isValidIP('10.0.0.1')).toBe(true);
      expect(isValidIP('172.16.0.1')).toBe(true);
      expect(isValidIP('8.8.8.8')).toBe(true);
    });

    it('should reject invalid IP addresses', () => {
      expect(isValidIP('256.1.1.1')).toBe(false);
      expect(isValidIP('192.168.1')).toBe(false);
      expect(isValidIP('not-an-ip')).toBe(false);
    });
  });

  describe('value validation', () => {
    it('should validate percentages', () => {
      expect(isPercentage(0)).toBe(true);
      expect(isPercentage(0.5)).toBe(true);
      expect(isPercentage(1)).toBe(true);
      expect(isPercentage(-0.1)).toBe(false);
      expect(isPercentage(1.1)).toBe(false);
    });

    it('should validate ports', () => {
      expect(isValidPort(80)).toBe(true);
      expect(isValidPort(443)).toBe(true);
      expect(isValidPort(8080)).toBe(true);
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(65536)).toBe(false);
    });

    it('should validate URLs', () => {
      expect(isValidURL('https://example.com')).toBe(true);
      expect(isValidURL('http://example.com')).toBe(true);
      expect(isValidURL('ftp://example.com')).toBe(true);
      expect(isValidURL('not-a-url')).toBe(false);
    });
  });
});
