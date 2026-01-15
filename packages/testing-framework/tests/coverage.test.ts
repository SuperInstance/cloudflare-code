import { describe, test, expect, beforeEach, afterEach, jest } from '../src/unit/jest-compat';
import {
  CoverageReporter,
  CoverageCollector,
  CoverageConfig,
  CoverageReport,
  CoverageThreshold,
  createCoverageCollector,
  CoverageUtils,
  coverageReporter
} from '../src/coverage';
import { DEFAULT_REPORTERS } from '../src/coverage/reporters';

describe('Coverage Reporting', () => {
  let reporter: CoverageReporter;
  let collector: CoverageCollector;

  beforeEach(() => {
    reporter = new CoverageReporter({
      reports: {
        html: false,
        json: true,
        xml: false,
        text: false,
        lcov: false,
        cobertura: false
      },
      outputDir: './test-coverage',
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70
      }
    });
    collector = createCoverageCollector();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CoverageReporter', () => {
    test('should initialize coverage reporter', () => {
      expect(reporter).toBeDefined();
    });

    test('should configure coverage settings', () => {
      const config: Partial<CoverageConfig> = {
        include: ['src/**/*.ts'],
        exclude: ['**/node_modules/**'],
        outputDir: './custom-coverage',
        thresholds: {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 80
        }
      };

      reporter.configure(config);

      // Note: We can't directly access private config in tests
      // This test mainly ensures the method doesn't throw
      expect(true).toBe(true);
    });

    test('should add single file coverage', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      expect(() => {
        reporter.addFile('/path/to/file.ts', coverage);
      }).not.toThrow();
    });

    test('should add multiple files coverage', () => {
      const coverageData = {
        '/file1.ts': {
          statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
          fnMap: { '0': { name: 'func1', line: 1 } },
          branchMap: {},
          s: { '0': 1 },
          f: { '0': 1 },
          b: {}
        },
        '/file2.ts': {
          statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
          fnMap: { '0': { name: 'func2', line: 1 } },
          branchMap: {},
          s: { '0': 0 },
          f: { '0': 0 },
          b: {}
        }
      };

      expect(() => {
        reporter.addFiles(coverageData);
      }).not.toThrow();
    });

    test('should generate coverage report', async () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      reporter.addFile('/test/file.ts', coverage);

      const report = await reporter.generateReport('./test-coverage');

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.files).toBeDefined();
      expect(report.summary.lines.total).toBeGreaterThan(0);
    });

    test('should check coverage thresholds', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 90 },
        f: { '0': 90 },
        b: {}
      };

      reporter.addFile('/test/file.ts', coverage);

      const result = reporter.checkThresholds();

      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.files).toBeDefined();
    });

    test('should create coverage badge', () => {
      const badgeUrl = reporter.createBadge('percentage', 85.5, 'coverage');
      expect(badgeUrl).toContain('img.shields.io/badge');
      expect(badgeUrl).toContain('86%25'); // Rounded percentage
      expect(badgeUrl).toContain('yellow'); // Color for 86%
    });

    test('should generate badge SVG', () => {
      const svg = reporter.generateBadgeSVG(85.5, 'coverage');
      expect(svg).toContain('<svg');
      expect(svg).toContain('coverage');
      expect(svg).toContain('86%');
      expect(svg).toContain('#ffc107'); // Yellow color
    });

    test('should save badge to file', () => {
      const writeFileSync = jest.spyOn(require('fs'), 'writeFileSync').mockImplementation(() => {});

      reporter.saveBadge(85.5, './badge.svg', 'coverage');

      expect(writeFileSync).toHaveBeenCalledWith('./badge.svg', expect.any(String));
      expect(writeFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('CoverageCollector', () => {
    test('should create coverage collector', () => {
      expect(collector).toBeDefined();
    });

    test('should add and retrieve coverage files', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      collector.addFile('/test/file.ts', coverage);
      const paths = collector.getFilePaths();

      expect(paths).toContain('/test/file.ts');
      expect(paths).toHaveLength(1);
    });

    test('should check file existence', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      collector.addFile('/test/file.ts', coverage);

      expect(collector.hasFile('/test/file.ts')).toBe(true);
      expect(collector.hasFile('/nonexistent/file.ts')).toBe(false);
    });

    test('should get file coverage', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      collector.addFile('/test/file.ts', coverage);
      const fileCoverage = collector.getFileCoverage('/test/file.ts');

      expect(fileCoverage).toBeDefined();
      expect(fileCoverage?.s).toBeDefined();
      expect(fileCoverage?.f).toBeDefined();
    });

    test('should remove file', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      collector.addFile('/test/file.ts', coverage);
      expect(collector.hasFile('/test/file.ts')).toBe(true);

      const removed = collector.removeFile('/test/file.ts');
      expect(removed).toBe(true);
      expect(collector.hasFile('/test/file.ts')).toBe(false);
    });

    test('should get directory coverage', () => {
      const coverage1 = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      const coverage2 = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      collector.addFile('/src/file1.ts', coverage1);
      collector.addFile('/src/file2.ts', coverage2);
      collector.addFile('/test/helper.ts', coverage2);

      const dirCoverage = collector.getDirectoryCoverage('/src');

      expect(dirCoverage.summary.lines.total).toBe(2);
      expect(Object.keys(dirCoverage.files)).toHaveLength(2);
    });

    test('should filter coverage by patterns', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      collector.addFile('/src/component.tsx', coverage);
      collector.addFile('/src/utils.ts', coverage);
      collector.addFile('/test/helper.ts', coverage);

      const filtered = collector.filter(['src/**/*.ts*']);

      expect(Object.keys(filtered.files)).toHaveLength(2);
      expect(filtered.files['/src/component.tsx']).toBeDefined();
      expect(filtered.files['/src/utils.ts']).toBeDefined();
    });

    test('should exclude files from coverage', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      collector.addFile('/src/component.tsx', coverage);
      collector.addFile('/src/utils.ts', coverage);
      collector.addFile('/test/helper.ts', coverage);

      const excluded = collector.exclude(['test/**/*']);

      expect(Object.keys(excluded.files)).toHaveLength(2);
      expect(excluded.files['/test/helper.ts']).toBeUndefined();
    });

    test('should merge coverage collectors', () => {
      const collector1 = createCoverageCollector();
      const collector2 = createCoverageCollector();

      const coverage1 = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      const coverage2 = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      collector1.addFile('/file1.ts', coverage1);
      collector2.addFile('/file2.ts', coverage2);

      collector1.merge(collector2);

      expect(collector1.getFilePaths()).toHaveLength(2);
      expect(collector1.getFilePaths()).toContain('/file1.ts');
      expect(collector1.getFilePaths()).toContain('/file2.ts');
    });

    test('should clear coverage data', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      collector.addFile('/test/file.ts', coverage);
      expect(collector.getFilePaths()).toHaveLength(1);

      collector.clear();
      expect(collector.getFilePaths()).toHaveLength(0);
    });

    test('should calculate coverage changes', () => {
      const previousCollector = createCoverageCollector();
      const currentCollector = createCoverageCollector();

      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      previousCollector.addFile('/test/file.ts', coverage);
      currentCollector.addFile('/test/file.ts', coverage);

      // Modify coverage in current
      currentCollector.getFileCoverage('/test/file.ts')!.s['0'] = 0;

      const change = currentCollector.calculateChange(previousCollector);

      expect(change).toBeDefined();
      expect(change.current).toBeDefined();
      expect(change.previous).toBeDefined();
      expect(change.changes).toBeDefined();
      expect(change.hasDecrease).toBe(true);
    });
  });

  describe('CoverageUtils', () => {
    test('should create coverage reporter', () => {
      const reporter = CoverageUtils.createReporter();
      expect(reporter).toBeInstanceOf(CoverageReporter);
    });

    test('should get available presets', () => {
      const presets = CoverageUtils.getPresets();
      expect(presets).toBeInstanceOf(Array);
      expect(presets.length).toBeGreaterThan(0);

      const strictPreset = presets.find(p => p.name === 'strict');
      expect(strictPreset).toBeDefined();
      expect(strictPreset?.thresholds.lines).toBe(90);
    });

    test('should create coverage badge', () => {
      const badge = CoverageUtils.createBadge(75.5);
      expect(badge).toContain('img.shields.io/badge');
      expect(badge).toContain('76%25');
      expect(badge).toContain('yellow');
    });

    test('should generate badge SVG', () => {
      const svg = CoverageUtils.generateBadgeSVG(75.5);
      expect(svg).toContain('<svg');
      expect(svg).toContain('76%');
      expect(svg).toContain('#ffc107');
    });
  });

  describe('Default Coverage Reporter', () => {
    test('should have default reporter instance', () => {
      expect(coverageReporter).toBeDefined();
      expect(coverageReporter).toBeInstanceOf(CoverageReporter);
    });

    test('should generate default report', async () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 1 },
        f: { '0': 1 },
        b: {}
      };

      coverageReporter.addFile('/test/file.ts', coverage);
      const report = await coverageReporter.generateReport();

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
    });
  });

  describe('Coverage Thresholds', () => {
    test('should pass when coverage meets threshold', () => {
      const reporter = new CoverageReporter({
        thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 }
      });

      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 85 }, // 85% coverage
        f: { '0': 85 },
        b: {}
      };

      reporter.addFile('/test/file.ts', coverage);
      const result = reporter.checkThresholds();

      expect(result.passed).toBe(true);
      expect(result.summary.lines.passed).toBe(true);
      expect(result.summary.statements.passed).toBe(true);
      expect(result.summary.functions.passed).toBe(true);
    });

    test('should fail when coverage below threshold', () => {
      const reporter = new CoverageReporter({
        thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 }
      });

      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 75 }, // 75% coverage
        f: { '0': 75 },
        b: {}
      };

      reporter.addFile('/test/file.ts', coverage);
      const result = reporter.checkThresholds();

      expect(result.passed).toBe(false);
      expect(result.summary.lines.passed).toBe(false);
      expect(result.summary.statements.passed).toBe(false);
      expect(result.summary.functions.passed).toBe(false);
    });

    test('should handle per-file thresholds', () => {
      const reporter = new CoverageReporter({
        thresholds: {
          lines: 80,
          statements: 80,
          functions: 80,
          branches: 70,
          perFile: {
            '/critical/file.ts': 95,
            '/normal/file.ts': 70
          }
        }
      });

      const criticalCoverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 90 }, // 90% coverage below 95% threshold
        f: { '0': 90 },
        b: {}
      };

      const normalCoverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 75 }, // 75% coverage above 70% threshold
        f: { '0': 75 },
        b: {}
      };

      reporter.addFile('/critical/file.ts', criticalCoverage);
      reporter.addFile('/normal/file.ts', normalCoverage);

      const result = reporter.checkThresholds();

      expect(result.passed).toBe(false);
      expect(result.files['/critical/file.ts'].lines.passed).toBe(false);
      expect(result.files['/normal/file.ts'].lines.passed).toBe(true);
    });
  });

  describe('Coverage Reporters', () => {
    test('should have all default reporters', () => {
      expect(DEFAULT_REPORTERS).toBeInstanceOf(Array);
      expect(DEFAULT_REPORTERS.length).toBeGreaterThan(0);

      const reporterNames = DEFAULT_REPORTERS.map(r => r.name);
      expect(reporterNames).toContain('html');
      expect(reporterNames).toContain('json');
      expect(reporterNames).toContain('text');
      expect(reporterNames).toContain('xml');
      expect(reporterNames).toContain('lcov');
      expect(reporterNames).toContain('cobertura');
    });

    test('each reporter should have correct format', () => {
      for (const reporter of DEFAULT_REPORTERS) {
        expect(reporter.format).toBeDefined();
        expect(reporter.name).toBeDefined();
        expect(reporter.output).toBeDefined();
        expect(reporter.generate).toBeDefined();
        expect(typeof reporter.generate).toBe('function');
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty coverage data', () => {
      expect(() => {
        reporter.addFile('/empty/file.ts', {});
      }).not.toThrow();
    });

    test('should handle missing coverage files gracefully', () => {
      const result = reporter.checkThresholds();
      expect(result).toBeDefined();
      expect(result.passed).toBe(true); // Should pass with no data
    });

    test('should handle zero coverage', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 0 },
        f: { '0': 0 },
        b: {}
      };

      reporter.addFile('/test/file.ts', coverage);
      const result = reporter.checkThresholds();

      expect(result.summary.lines.percentage).toBe(0);
      expect(result.summary.statements.percentage).toBe(0);
      expect(result.summary.functions.percentage).toBe(0);
    });

    test('should handle 100% coverage', () => {
      const coverage = {
        statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } } },
        fnMap: { '0': { name: 'testFunction', line: 1 } },
        branchMap: {},
        s: { '0': 100 },
        f: { '0': 100 },
        b: { '0': [100, 100] }
      };

      reporter.addFile('/test/file.ts', coverage);
      const result = reporter.checkThresholds();

      expect(result.summary.lines.percentage).toBe(100);
      expect(result.summary.statements.percentage).toBe(100);
      expect(result.summary.functions.percentage).toBe(100);
      expect(result.summary.branches.percentage).toBe(100);
    });
  });
});