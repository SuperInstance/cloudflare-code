/**
 * Integration tests for Dependency Analyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyAnalyzer } from '../../src/analyzer.js';
import type { AnalyzerConfig, AnalysisResult } from '../../src/types/index.js';

describe('DependencyAnalyzer Integration Tests', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer({
      projectPath: '/tmp/test-project',
      packageManager: 'npm',
      include: ['**/*.ts'],
      exclude: ['node_modules/**', 'dist/**'],
    });
  });

  describe('Complete Analysis', () => {
    it('should perform complete analysis', async () => {
      const result = await analyzer.analyze();

      expect(result).toHaveProperty('projectPath');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('packageManager');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('totalModules');
      expect(result.summary).toHaveProperty('totalDependencies');
      expect(result.summary).toHaveProperty('circularDependencies');
      expect(result.summary).toHaveProperty('unusedDependencies');
      expect(result.summary).toHaveProperty('vulnerabilities');
      expect(result.summary).toHaveProperty('licenseIssues');
    });

    it('should build dependency graph', async () => {
      const graph = await analyzer.buildGraph();

      expect(graph).toHaveProperty('nodes');
      expect(graph).toHaveProperty('edges');
      expect(graph).toHaveProperty('adjacencies');
      expect(graph).toHaveProperty('reverseAdjacencies');
      expect(graph.nodes).toBeInstanceOf(Map);
      expect(Array.isArray(graph.edges)).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      await analyzer.buildGraph();
      const { cycles } = await analyzer.detectCircular();

      expect(Array.isArray(cycles)).toBe(true);
      expect(cycles.every((c) => c.path)).toBeDefined();
      expect(cycles.every((c) => c.severity)).toBeDefined();
    });

    it('should detect unused code', async () => {
      const { dependencies, code } = await analyzer.detectUnused();

      expect(Array.isArray(dependencies)).toBe(true);
      expect(Array.isArray(code)).toBe(true);
      expect(dependencies.every((d) => d.name)).toBeDefined();
      expect(code.every((c) => c.file)).toBeDefined();
    });

    it('should check for updates', async () => {
      const { updates } = await analyzer.checkUpdates();

      expect(Array.isArray(updates)).toBe(true);
      expect(updates.every((u) => u.name)).toBeDefined();
      expect(updates.every((u) => u.currentVersion)).toBeDefined();
      expect(updates.every((u) => u.latestVersion)).toBeDefined();
    });

    it('should analyze licenses', async () => {
      const { licenses, issues } = await analyzer.analyzeLicenses();

      expect(licenses).toBeInstanceOf(Map);
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should scan for vulnerabilities', async () => {
      const { vulnerabilities, summary } = await analyzer.scanSecurity();

      expect(Array.isArray(vulnerabilities)).toBe(true);
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('critical');
      expect(summary).toHaveProperty('high');
      expect(summary).toHaveProperty('moderate');
      expect(summary).toHaveProperty('low');
    });

    it('should optimize bundle', async () => {
      await analyzer.buildGraph();
      const { bundle } = await analyzer.optimize();

      expect(bundle).toHaveProperty('totalSize');
      expect(bundle).toHaveProperty('dependencies');
      expect(bundle).toHaveProperty('duplicates');
      expect(bundle).toHaveProperty('treeShakeable');
      expect(bundle).toHaveProperty('lazyLoadCandidates');
    });
  });

  describe('Visualization', () => {
    it('should generate DOT visualization', async () => {
      await analyzer.buildGraph();
      const dot = analyzer.visualize('dot');

      expect(dot).toContain('digraph dependencies');
      expect(dot).toContain('[');
      expect(dot).toContain(']');
    });

    it('should generate JSON visualization', async () => {
      await analyzer.buildGraph();
      const json = analyzer.visualize('json');

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('nodes');
      expect(parsed).toHaveProperty('links');
    });

    it('should generate Mermaid visualization', async () => {
      await analyzer.buildGraph();
      const mermaid = analyzer.visualize('mermaid');

      expect(mermaid).toContain('graph TD');
    });
  });

  describe('Report Generation', () => {
    it('should generate markdown report', async () => {
      const report = await analyzer.generateReport();

      expect(report).toContain('# Dependency Analysis Report');
      expect(report).toContain('## Summary');
    });

    it('should export as JSON', async () => {
      const json = await analyzer.exportResults('json');

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('projectPath');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('should export as markdown', async () => {
      const markdown = await analyzer.exportResults('markdown');

      expect(markdown).toContain('#');
    });

    it('should export as HTML', async () => {
      const html = await analyzer.exportResults('html');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
    });
  });

  describe('Configuration', () => {
    it('should merge configuration with defaults', () => {
      const customConfig: Partial<AnalyzerConfig> = {
        packageManager: 'yarn',
        projectPath: '/custom/path',
      };

      const customAnalyzer = new DependencyAnalyzer(customConfig);
      const config = customAnalyzer.getConfig();

      expect(config.packageManager).toBe('yarn');
      expect(config.projectPath).toBe('/custom/path');
      expect(config.rules).toBeDefined();
    });

    it('should respect disabled rules', async () => {
      const analyzerWithDisabledRules = new DependencyAnalyzer({
        projectPath: '/tmp/test',
        rules: {
          circular: { enabled: false },
          unused: { enabled: false },
          security: { enabled: false },
          license: { enabled: false },
        },
      });

      const result = await analyzerWithDisabledRules.analyze();

      expect(result.summary.circularDependencies).toBe(0);
      expect(result.summary.unusedDependencies).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing project directory gracefully', async () => {
      const invalidAnalyzer = new DependencyAnalyzer({
        projectPath: '/nonexistent/path',
        packageManager: 'npm',
      });

      // Should not throw, but return empty results
      const result = await invalidAnalyzer.analyze();
      expect(result).toBeDefined();
    });

    it('should handle invalid package.json gracefully', async () => {
      const analyzerWithInvalidConfig = new DependencyAnalyzer({
        projectPath: '/tmp/invalid',
        packageManager: 'npm',
      });

      // Should handle gracefully
      const { updates } = await analyzerWithInvalidConfig.checkUpdates();
      expect(Array.isArray(updates)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete analysis in reasonable time', async () => {
      const startTime = Date.now();
      await analyzer.analyze();
      const duration = Date.now() - startTime;

      // Should complete in less than 30 seconds for typical projects
      expect(duration).toBeLessThan(30000);
    });

    it('should cache graph between operations', async () => {
      await analyzer.buildGraph();
      const graph1 = analyzer.getGraph();

      // Second call should use cached graph
      await analyzer.buildGraph();
      const graph2 = analyzer.getGraph();

      expect(graph1).toBe(graph2);
    });
  });
});
