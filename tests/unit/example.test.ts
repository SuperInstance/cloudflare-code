/**
 * Example Unit Test
 * Demonstrates testing patterns for ClaudeFlare
 */

import { describe, it, expect, vi } from 'vitest';

describe('Example Unit Tests', () => {
  describe('Basic functionality', () => {
    it('should perform basic assertions', () => {
      expect(1 + 1).toBe(2);
      expect(true).toBe(true);
    });

    it('should handle async operations', async () => {
      const promise = Promise.resolve('success');
      await expect(promise).resolves.toBe('success');
    });

    it('should mock functions', () => {
      const mockFn = vi.fn();
      mockFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Workers-specific tests', () => {
    it('should create Request objects', () => {
      const request = new Request('https://example.com', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      expect(request.url).toBe('https://example.com/');
      expect(request.method).toBe('POST');
    });

    it('should create Response objects', () => {
      const response = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
    });
  });

  describe('Coverage examples', () => {
    it('should demonstrate branches coverage', () => {
      const getValue = (condition: boolean) => {
        if (condition) {
          return 'yes';
        } else {
          return 'no';
        }
      };

      expect(getValue(true)).toBe('yes');
      expect(getValue(false)).toBe('no');
    });

    it('should demonstrate function coverage', () => {
      const add = (a: number, b: number) => a + b;
      const multiply = (a: number, b: number) => a * b;

      expect(add(2, 3)).toBe(5);
      expect(multiply(2, 3)).toBe(6);
    });
  });
});
