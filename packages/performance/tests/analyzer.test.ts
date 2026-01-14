/**
 * Performance Analyzer Tests
 */

import { describe, it, expect } from 'vitest';
import { PerformanceAnalyzer, PatternAnalyzer } from '../src/index.js';
import type { PerformanceMetrics, ProfileSnapshot } from '../src/types/index.js';

describe('PerformanceAnalyzer', () => {
  describe('Metrics Analysis', () => {
    it('should analyze normal metrics', () => {
      const analyzer = new PerformanceAnalyzer();

      const metrics: PerformanceMetrics = {
        duration: 100,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        cpuUsage: 0.3,
        cpuTime: 1000000,
        memoryUsed: 100000000,
        memoryTotal: 500000000,
        memoryPercentage: 20,
        eventLoopLag: 10,
        eventLoopUtilization: 0.2,
      };

      const recommendations = analyzer.analyzeMetrics(metrics);

      // Should not have critical issues for normal metrics
      const critical = recommendations.filter((r) => r.severity === 'critical');
      expect(critical.length).toBe(0);
    });

    it('should detect high CPU usage', () => {
      const analyzer = new PerformanceAnalyzer();

      const metrics: PerformanceMetrics = {
        duration: 100,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        cpuUsage: 0.9,
        cpuTime: 9000000,
        memoryUsed: 100000000,
        memoryTotal: 500000000,
        memoryPercentage: 20,
        eventLoopLag: 10,
        eventLoopUtilization: 0.2,
      };

      const recommendations = analyzer.analyzeMetrics(metrics);

      const cpuIssues = recommendations.filter((r) => r.category === 'cpu-usage');
      expect(cpuIssues.length).toBeGreaterThan(0);
      expect(cpuIssues[0].severity).toBe('high');
    });

    it('should detect high memory usage', () => {
      const analyzer = new PerformanceAnalyzer();

      const metrics: PerformanceMetrics = {
        duration: 100,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        cpuUsage: 0.3,
        cpuTime: 1000000,
        memoryUsed: 450000000,
        memoryTotal: 500000000,
        memoryPercentage: 90,
        eventLoopLag: 10,
        eventLoopUtilization: 0.2,
      };

      const recommendations = analyzer.analyzeMetrics(metrics);

      const memoryIssues = recommendations.filter((r) => r.category === 'memory-leak');
      expect(memoryIssues.length).toBeGreaterThan(0);
      expect(memoryIssues[0].severity).toBe('high');
    });

    it('should detect high event loop lag', () => {
      const analyzer = new PerformanceAnalyzer();

      const metrics: PerformanceMetrics = {
        duration: 100,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        cpuUsage: 0.3,
        cpuTime: 1000000,
        memoryUsed: 100000000,
        memoryTotal: 500000000,
        memoryPercentage: 20,
        eventLoopLag: 100,
        eventLoopUtilization: 0.2,
      };

      const recommendations = analyzer.analyzeMetrics(metrics);

      const lagIssues = recommendations.filter((r) => r.category === 'event-loop');
      expect(lagIssues.length).toBeGreaterThan(0);
      expect(lagIssues[0].severity).toBe('high');
    });

    it('should include metrics in recommendations', () => {
      const analyzer = new PerformanceAnalyzer();

      const metrics: PerformanceMetrics = {
        duration: 100,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        cpuUsage: 0.9,
        cpuTime: 9000000,
        memoryUsed: 100000000,
        memoryTotal: 500000000,
        memoryPercentage: 20,
        eventLoopLag: 10,
        eventLoopUtilization: 0.2,
      };

      const recommendations = analyzer.analyzeMetrics(metrics);

      expect(recommendations.some((r) => r.metrics !== undefined)).toBe(true);
    });
  });

  describe('Snapshot Analysis', () => {
    it('should handle empty snapshots', () => {
      const analyzer = new PerformanceAnalyzer();
      const snapshots: ProfileSnapshot[] = [];

      const recommendations = analyzer.analyzeSnapshots(snapshots);

      expect(recommendations.length).toBe(0);
    });

    it('should generate report', () => {
      const analyzer = new PerformanceAnalyzer();

      const metrics: PerformanceMetrics = {
        duration: 100,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        cpuUsage: 0.9,
        cpuTime: 9000000,
        memoryUsed: 100000000,
        memoryTotal: 500000000,
        memoryPercentage: 20,
        eventLoopLag: 100,
        eventLoopUtilization: 0.8,
      };

      const report = analyzer.generateReport(metrics);

      expect(report).toContain('# Performance Optimization Report');
      expect(report).toContain('Summary');
      expect(report).toContain('Recommendations');
    });
  });
});

describe('PatternAnalyzer', () => {
  describe('Code Analysis', () => {
    it('should detect event listeners without removal', () => {
      const analyzer = new PatternAnalyzer();

      const code = `
        element.addEventListener('click', handler);
        element.addEventListener('mouseover', handler);
      `;

      const results = analyzer.analyzeCode(code);

      const addEventListenerIssues = results.filter(
        (r) => r.pattern.name === 'Event listener not removed'
      );

      expect(addEventListenerIssues.length).toBeGreaterThan(0);
      expect(addEventListenerIssues[0].matches.length).toBe(2);
    });

    it('should detect nested loops', () => {
      const analyzer = new PatternAnalyzer();

      const code = `
        for (let i = 0; i < arr.length; i++) {
          for (let j = 0; j < arr2.length; j++) {
            // nested
          }
        }
      `;

      const results = analyzer.analyzeCode(code);

      const nestedLoopIssues = results.filter(
        (r) => r.pattern.name === 'Nested loops'
      );

      expect(nestedLoopIssues.length).toBeGreaterThan(0);
    });

    it('should detect setIntervals without clearing', () => {
      const analyzer = new PatternAnalyzer();

      const code = `
        const timer = setInterval(callback, 1000);
      `;

      const results = analyzer.analyzeCode(code);

      const intervalIssues = results.filter(
        (r) => r.pattern.name === 'SetInterval not cleared'
      );

      expect(intervalIssues.length).toBeGreaterThan(0);
    });

    it('should detect synchronous file operations', () => {
      const analyzer = new PatternAnalyzer();

      const code = `
        const data = fs.readFileSync('file.txt');
      `;

      const results = analyzer.analyzeCode(code);

      const syncIssues = results.filter(
        (r) => r.pattern.name === 'Synchronous file operations'
      );

      expect(syncIssues.length).toBeGreaterThan(0);
    });

    it('should detect JSON.parse/stringify for cloning', () => {
      const analyzer = new PatternAnalyzer();

      const code = `
        const clone = JSON.parse(JSON.stringify(obj));
      `;

      const results = analyzer.analyzeCode(code);

      const cloneIssues = results.filter(
        (r) => r.pattern.name === 'Deep object cloning'
      );

      expect(cloneIssues.length).toBeGreaterThan(0);
    });

    it('should return empty results for clean code', () => {
      const analyzer = new PatternAnalyzer();

      const code = `
        function hello(name) {
          return 'Hello ' + name;
        }
      `;

      const results = analyzer.analyzeCode(code);

      expect(results.length).toBe(0);
    });

    it('should track line numbers', () => {
      const analyzer = new PatternAnalyzer();

      const code = `
        line 1
        line 2
        element.addEventListener('click', handler);
        line 4
      `;

      const results = analyzer.analyzeCode(code);

      const issue = results.find(
        (r) => r.pattern.name === 'Event listener not removed'
      );

      expect(issue).toBeDefined();
      expect(issue?.matches[0].line).toBe(3);
    });
  });

  describe('Custom Patterns', () => {
    it('should allow adding custom patterns', () => {
      const analyzer = new PatternAnalyzer();

      analyzer.addPattern({
        name: 'custom-pattern',
        pattern: /TODO:/,
        description: 'TODO comments found',
        severity: 'low',
        category: 'code-quality',
        fix: 'Resolve TODO items',
      });

      const code = `
        // TODO: implement this
        function foo() {}
      `;

      const results = analyzer.analyzeCode(code);

      const customPattern = results.find((r) => r.pattern.name === 'custom-pattern');
      expect(customPattern).toBeDefined();
    });
  });

  describe('Report Generation', () => {
    it('should generate markdown report', () => {
      const analyzer = new PatternAnalyzer();

      const code = `
        element.addEventListener('click', handler);
        const timer = setInterval(callback, 1000);
      `;

      const results = analyzer.analyzeCode(code);
      const report = analyzer.generateReport(results);

      expect(report).toContain('# Code Pattern Analysis Report');
      expect(report).toContain('Event listener not removed');
      expect(report).toContain('SetInterval not cleared');
    });
  });
});
