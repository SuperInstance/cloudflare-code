import { describe, test, expect, beforeEach, afterEach, jest } from '../src/unit/jest-compat';
import {
  SecurityTestRunner,
  SecurityTest,
  SecurityTestResult,
  SecurityScanReport,
  SecurityTestSuite,
  SecurityProfile,
  SecuritySeverity,
  SecurityTestType,
  SecurityTestConfig,
  SecurityFinding
} from '../src/security';
import { SecurityScanner } from '../src/security/scanner';
import { HttpClient } from '../src/http/client';
import { Logger } from '../src/core/logger';

describe('Security Testing', () => {
  let testRunner: SecurityTestRunner;
  let mockScanner: jest.Mocked<SecurityScanner>;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Mock dependencies
    mockScanner = {
      registerTest: jest.fn(),
      runTest: jest.fn(),
      getResults: jest.fn(),
      clearResults: jest.fn(),
      getTestRegistry: jest.fn()
    } as any;

    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    // Create test runner with mocked dependencies
    testRunner = new (class extends SecurityTestRunner {
      constructor() {
        super();
        (this as any).scanner = mockScanner;
        (this as any).httpClient = mockHttpClient;
        (this as any).logger = mockLogger;
      }
    })();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Test Runner', () => {
    test('should initialize security test runner', () => {
      expect(testRunner).toBeDefined();
      expect(mockScanner).toBeDefined();
    });

    test('should register security tests', () => {
      const tests: SecurityTest[] = [
        {
          id: 'test-1',
          name: 'XSS Test',
          type: 'xss',
          severity: 'high',
          target: 'http://example.com',
          parameters: {},
          expected: { pass: false },
          enabled: true
        }
      ];

      testRunner.registerTests(tests);

      expect(mockScanner.registerTest).toHaveBeenCalledWith(tests[0]);
    });

    test('should create security test suite', () => {
      const suite: SecurityTestSuite = {
        id: 'suite-1',
        name: 'Test Suite',
        description: 'Security test suite',
        target: 'http://example.com',
        tests: [],
        configuration: {
          baseUrl: 'http://example.com',
          timeout: 10000,
          retries: 2,
          parallel: true,
          maxConcurrent: 3,
          outputFormat: 'json',
          outputDir: './reports',
          includeTests: [],
          excludeTests: [],
          severityFilters: ['critical', 'high']
        },
        enabled: true
      };

      testRunner.createSuite(suite);

      expect(testRunner['suites']).toHaveProperty(suite.id);
    });

    test('should run security test suite', async () => {
      const suite: SecurityTestSuite = {
        id: 'suite-1',
        name: 'Test Suite',
        description: 'Security test suite',
        target: 'http://example.com',
        tests: [
          {
            id: 'test-1',
            name: 'XSS Test',
            type: 'xss',
            severity: 'high',
            target: 'http://example.com',
            parameters: {},
            expected: { pass: false },
            enabled: true
          }
        ],
        configuration: {
          baseUrl: 'http://example.com',
          timeout: 10000,
          retries: 2,
          parallel: true,
          maxConcurrent: 3,
          outputFormat: 'json',
          outputDir: './reports',
          includeTests: [],
          excludeTests: [],
          severityFilters: ['critical', 'high']
        },
        enabled: true
      };

      const mockResult: SecurityTestResult = {
        id: 'result-1',
        testId: 'test-1',
        testName: 'XSS Test',
        passed: false,
        severity: 'high',
        duration: 1000,
        findings: [],
        metadata: {
          timestamp: new Date(),
          environment: 'test',
          targetVersion: '1.0.0',
          testRunnerVersion: '1.0.0',
          scanId: 'scan-1'
        }
      };

      mockScanner.runTest.mockResolvedValue(mockResult);

      testRunner.createSuite(suite);
      const report = await testRunner.runSuite(suite.id, 'http://example.com');

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.name).toBe('Test Suite');
      expect(report.status).toBe('completed');
      expect(report.summary.totalTests).toBe(1);
      expect(report.summary.failedTests).toBe(1);
      expect(mockScanner.runTest).toHaveBeenCalledWith(suite.tests[0], 'http://example.com');
    });

    test('should handle suite not found error', async () => {
      await expect(testRunner.runSuite('non-existent-suite', 'http://example.com'))
        .rejects.toThrow('Suite not found: non-existent-suite');
    });

    test('should run OWASP Top 10 scan', async () => {
      const mockReport: SecurityScanReport = {
        id: 'report-1',
        name: 'OWASP Top 10 Scan',
        startTime: new Date(),
        target: 'http://example.com',
        status: 'completed',
        summary: {
          totalTests: 10,
          passedTests: 8,
          failedTests: 2,
          criticalFindings: 1,
          highFindings: 1,
          mediumFindings: 0,
          lowFindings: 0,
          infoFindings: 0,
          vulnerabilityScore: 80,
          complianceScore: 90
        },
        findings: [],
        tests: [],
        recommendations: [],
        vulnerabilities: [],
        score: {
          overall: 80,
          details: {
            owaspTopTen: 80,
            inputValidation: 90,
            accessControl: 70,
            dataProtection: 85,
            secureHeaders: 75,
            sslTls: 90,
            dependencySecurity: 80,
            secretsManagement: 85
          },
          grade: 'B'
        }
      };

      mockScanner.runTest.mockResolvedValue({} as any);

      const report = await testRunner.runOwaspTopTen('http://example.com');

      expect(report).toBeDefined();
      expect(report.name).toBe('OWASP Top 10 Security Test');
      expect(report.summary.totalTests).toBe(10);
    });

    test('should create security profile', () => {
      const profile: SecurityProfile = {
        id: 'profile-1',
        name: 'Test Profile',
        description: 'Test security profile',
        tests: [],
        configuration: {
          baseUrl: 'http://example.com',
          timeout: 10000,
          retries: 2,
          parallel: true,
          maxConcurrent: 3,
          outputFormat: 'json',
          outputDir: './reports',
          includeTests: [],
          excludeTests: [],
          severityFilters: ['critical', 'high']
        },
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      testRunner.createProfile(profile);

      expect(testRunner['profiles']).toHaveProperty(profile.id);
    });

    test('should run security profile', async () => {
      const profile: SecurityProfile = {
        id: 'profile-1',
        name: 'Test Profile',
        description: 'Test security profile',
        tests: [
          {
            id: 'test-1',
            name: 'XSS Test',
            type: 'xss',
            severity: 'high',
            target: 'http://example.com',
            parameters: {},
            expected: { pass: false },
            enabled: true
          }
        ],
        configuration: {
          baseUrl: 'http://example.com',
          timeout: 10000,
          retries: 2,
          parallel: true,
          maxConcurrent: 3,
          outputFormat: 'json',
          outputDir: './reports',
          includeTests: [],
          excludeTests: [],
          severityFilters: ['critical', 'high']
        },
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockResult: SecurityTestResult = {
        id: 'result-1',
        testId: 'test-1',
        testName: 'XSS Test',
        passed: false,
        severity: 'high',
        duration: 1000,
        findings: [],
        metadata: {
          timestamp: new Date(),
          environment: 'test',
          targetVersion: '1.0.0',
          testRunnerVersion: '1.0.0',
          scanId: 'scan-1'
        }
      };

      mockScanner.runTest.mockResolvedValue(mockResult);

      testRunner.createProfile(profile);
      const report = await testRunner.runProfile(profile.id, 'http://example.com');

      expect(report).toBeDefined();
      expect(report.name).toBe('Test Profile');
    });

    test('should handle profile not found error', async () => {
      await expect(testRunner.runProfile('non-existent-profile', 'http://example.com'))
        .rejects.toThrow('Profile not found: non-existent-profile');
    });

    test('should generate security report', () => {
      const mockReport: SecurityScanReport = {
        id: 'report-1',
        name: 'Security Scan',
        startTime: new Date(),
        target: 'http://example.com',
        status: 'completed',
        summary: {
          totalTests: 5,
          passedTests: 3,
          failedTests: 2,
          criticalFindings: 1,
          highFindings: 1,
          mediumFindings: 0,
          lowFindings: 0,
          infoFindings: 0,
          vulnerabilityScore: 70,
          complianceScore: 85
        },
        findings: [
          {
            id: 'finding-1',
            title: 'XSS Vulnerability',
            description: 'Cross-site scripting vulnerability found',
            severity: 'high',
            category: 'Cross-Site Scripting',
            evidence: '',
            url: 'http://example.com',
            method: 'GET',
            parameters: {},
            recommendation: 'Implement input validation',
            cwe: 79,
            owasp: 'OWASP-A1:2021'
          }
        ],
        tests: [],
        recommendations: [
          {
            id: 'rec-1',
            title: 'Fix XSS Vulnerability',
            description: 'Implement proper input validation',
            priority: 'high',
            complexity: 'medium',
            category: 'Cross-Site Scripting',
            affectedTests: ['XSS Test']
          }
        ],
        vulnerabilities: [],
        score: {
          overall: 70,
          details: {
            owaspTopTen: 70,
            inputValidation: 80,
            accessControl: 70,
            dataProtection: 85,
            secureHeaders: 75,
            sslTls: 90,
            dependencySecurity: 80,
            secretsManagement: 85
          },
          grade: 'C'
        }
      };

      testRunner['reports'].set('report-1', mockReport);
      const report = testRunner.generateReport('report-1');

      expect(report).toBeDefined();
      expect(report).toContain('# Security Scan Report');
      expect(report).toContain('XSS Vulnerability');
      expect(report).toContain('Fix XSS Vulnerability');
    });

    test('should handle report not found error', () => {
      expect(() => testRunner.generateReport('non-existent-report'))
        .toThrow('Report not found: non-existent-report');
    });

    test('should export report in JSON format', async () => {
      const mockReport: SecurityScanReport = {
        id: 'report-1',
        name: 'Security Scan',
        startTime: new Date(),
        target: 'http://example.com',
        status: 'completed',
        summary: {
          totalTests: 1,
          passedTests: 0,
          failedTests: 1,
          criticalFindings: 0,
          highFindings: 1,
          mediumFindings: 0,
          lowFindings: 0,
          infoFindings: 0,
          vulnerabilityScore: 70,
          complianceScore: 85
        },
        findings: [],
        tests: [],
        recommendations: [],
        vulnerabilities: [],
        score: {
          overall: 70,
          details: {
            owaspTopTen: 70,
            inputValidation: 80,
            accessControl: 70,
            dataProtection: 85,
            secureHeaders: 75,
            sslTls: 90,
            dependencySecurity: 80,
            secretsManagement: 85
          },
          grade: 'C'
        }
      };

      testRunner['reports'].set('report-1', mockReport);
      const jsonReport = await testRunner.exportReport('report-1', 'json');

      expect(jsonReport).toBeDefined();
      expect(typeof jsonReport).toBe('string');
      const parsed = JSON.parse(jsonReport);
      expect(parsed.id).toBe('report-1');
    });

    test('should handle unsupported export format', async () => {
      testRunner['reports'].set('report-1', {} as any);
      await expect(testRunner.exportReport('report-1', 'unsupported' as any))
        .rejects.toThrow('Unsupported format: unsupported');
    });

    test('should get security score grade', () => {
      expect(testRunner.getSecurityScore(95)).toBe('A+');
      expect(testRunner.getSecurityScore(85)).toBe('A');
      expect(testRunner.getSecurityScore(75)).toBe('B+');
      expect(testRunner.getSecurityScore(65)).toBe('B');
      expect(testRunner.getSecurityScore(55)).toBe('C+');
      expect(testRunner.getSecurityScore(45)).toBe('C');
      expect(testRunner.getSecurityScore(35)).toBe('D+');
      expect(testRunner.getSecurityScore(25)).toBe('D');
      expect(testRunner.getSecurityScore(15)).toBe('F');
    });

    test('should create common security profiles', () => {
      testRunner.createCommonProfiles();

      expect(testRunner['profiles']).toHaveProperty('owasp-profile');
      expect(testRunner['profiles']).toHaveProperty('api-security-profile');
      expect(testRunner['profiles']['owasp-profile'].name).toBe('OWASP Top 10');
      expect(testRunner['profiles']['api-security-profile'].name).toBe('API Security');
    });

    test('should get all reports', () => {
      const mockReport: SecurityScanReport = {
        id: 'report-1',
        name: 'Security Scan',
        startTime: new Date(),
        target: 'http://example.com',
        status: 'completed',
        summary: {
          totalTests: 1,
          passedTests: 0,
          failedTests: 1,
          criticalFindings: 0,
          highFindings: 1,
          mediumFindings: 0,
          lowFindings: 0,
          infoFindings: 0,
          vulnerabilityScore: 70,
          complianceScore: 85
        },
        findings: [],
        tests: [],
        recommendations: [],
        vulnerabilities: [],
        score: {
          overall: 70,
          details: {
            owaspTopTen: 70,
            inputValidation: 80,
            accessControl: 70,
            dataProtection: 85,
            secureHeaders: 75,
            sslTls: 90,
            dependencySecurity: 80,
            secretsManagement: 85
          },
          grade: 'C'
        }
      };

      testRunner['reports'].set('report-1', mockReport);
      const reports = testRunner.getReports();

      expect(reports).toHaveLength(1);
      expect(reports[0].id).toBe('report-1');
    });

    test('should get report by ID', () => {
      const mockReport: SecurityScanReport = {
        id: 'report-1',
        name: 'Security Scan',
        startTime: new Date(),
        target: 'http://example.com',
        status: 'completed',
        summary: {
          totalTests: 1,
          passedTests: 0,
          failedTests: 1,
          criticalFindings: 0,
          highFindings: 1,
          mediumFindings: 0,
          lowFindings: 0,
          infoFindings: 0,
          vulnerabilityScore: 70,
          complianceScore: 85
        },
        findings: [],
        tests: [],
        recommendations: [],
        vulnerabilities: [],
        score: {
          overall: 70,
          details: {
            owaspTopTen: 70,
            inputValidation: 80,
            accessControl: 70,
            dataProtection: 85,
            secureHeaders: 75,
            sslTls: 90,
            dependencySecurity: 80,
            secretsManagement: 85
          },
          grade: 'C'
        }
      };

      testRunner['reports'].set('report-1', mockReport);
      const report = testRunner.getReport('report-1');

      expect(report).toBeDefined();
      expect(report?.id).toBe('report-1');
    });

    test('should delete report', () => {
      testRunner['reports'].set('report-1', {} as any);
      const deleted = testRunner.deleteReport('report-1');

      expect(deleted).toBe(true);
      expect(testRunner['reports']).not.toHaveProperty('report-1');
    });

    test('should return false when deleting non-existent report', () => {
      const deleted = testRunner.deleteReport('non-existent-report');
      expect(deleted).toBe(false);
    });
  });

  describe('Security Scanner', () => {
    let scanner: SecurityScanner;

    beforeEach(() => {
      scanner = new SecurityScanner();
    });

    test('should register security test', () => {
      const test: SecurityTest = {
        id: 'test-1',
        name: 'XSS Test',
        type: 'xss',
        severity: 'high',
        target: 'http://example.com',
        parameters: {},
        expected: { pass: false },
        enabled: true
      };

      scanner.registerTest(test);

      expect(scanner['testRegistry']).toHaveProperty(test.id);
    });

    test('should run all registered tests', async () => {
      const test: SecurityTest = {
        id: 'test-1',
        name: 'XSS Test',
        type: 'xss',
        severity: 'high',
        target: 'http://example.com',
        parameters: {},
        expected: { pass: false },
        enabled: true
      };

      scanner.registerTest(test);

      const mockResult: SecurityTestResult = {
        id: 'result-1',
        testId: 'test-1',
        testName: 'XSS Test',
        passed: false,
        severity: 'high',
        duration: 1000,
        findings: [],
        metadata: {
          timestamp: new Date(),
          environment: 'test',
          targetVersion: '1.0.0',
          testRunnerVersion: '1.0.0',
          scanId: 'scan-1'
        }
      };

      // Mock the runTest method
      jest.spyOn(scanner as any, 'runTest').mockResolvedValue(mockResult);

      const results = await scanner.runAllTests('http://example.com');

      expect(results).toHaveLength(1);
      expect(results[0].testName).toBe('XSS Test');
    });

    test('should handle test execution errors', async () => {
      const test: SecurityTest = {
        id: 'test-1',
        name: 'Failing Test',
        type: 'xss',
        severity: 'high',
        target: 'http://example.com',
        parameters: {},
        expected: { pass: false },
        enabled: true
      };

      scanner.registerTest(test);

      // Mock runTest to throw an error
      jest.spyOn(scanner as any, 'runTest').mockRejectedValue(new Error('Test failed'));

      const results = await scanner.runAllTests('http://example.com');

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error).toBeDefined();
      expect(results[0].error?.message).toBe('Test failed');
    });

    test('should get test registry', () => {
      const test: SecurityTest = {
        id: 'test-1',
        name: 'XSS Test',
        type: 'xss',
        severity: 'high',
        target: 'http://example.com',
        parameters: {},
        expected: { pass: false },
        enabled: true
      };

      scanner.registerTest(test);

      const registry = scanner.getTestRegistry();

      expect(registry).toBeInstanceOf(Map);
      expect(registry).toHaveProperty(test.id);
    });

    test('should clear results', () => {
      scanner['results'] = [{ id: 'result-1' } as any];
      scanner.clearResults();
      expect(scanner['results']).toEqual([]);
    });
  });

  describe('Security Test Configuration', () => {
    test('should filter tests by include list', () => {
      const test: SecurityTest = {
        id: 'test-1',
        name: 'XSS Test',
        type: 'xss',
        severity: 'high',
        target: 'http://example.com',
        parameters: {},
        expected: { pass: false },
        enabled: true
      };

      const config: SecurityTestConfig = {
        baseUrl: 'http://example.com',
        timeout: 10000,
        retries: 2,
        parallel: true,
        maxConcurrent: 3,
        outputFormat: 'json',
        outputDir: './reports',
        includeTests: ['sql-injection'],
        excludeTests: [],
        severityFilters: ['critical', 'high']
      };

      // Access private method for testing
      const shouldRun = (testRunner as any).shouldRunTest(test, config);
      expect(shouldRun).toBe(false);
    });

    test('should filter tests by exclude list', () => {
      const test: SecurityTest = {
        id: 'test-1',
        name: 'XSS Test',
        type: 'xss',
        severity: 'high',
        target: 'http://example.com',
        parameters: {},
        expected: { pass: false },
        enabled: true
      };

      const config: SecurityTestConfig = {
        baseUrl: 'http://example.com',
        timeout: 10000,
        retries: 2,
        parallel: true,
        maxConcurrent: 3,
        outputFormat: 'json',
        outputDir: './reports',
        includeTests: [],
        excludeTests: ['xss'],
        severityFilters: ['critical', 'high']
      };

      const shouldRun = (testRunner as any).shouldRunTest(test, config);
      expect(shouldRun).toBe(false);
    });

    test('should filter tests by severity', () => {
      const test: SecurityTest = {
        id: 'test-1',
        name: 'Low Severity Test',
        type: 'xss',
        severity: 'low',
        target: 'http://example.com',
        parameters: {},
        expected: { pass: false },
        enabled: true
      };

      const config: SecurityTestConfig = {
        baseUrl: 'http://example.com',
        timeout: 10000,
        retries: 2,
        parallel: true,
        maxConcurrent: 3,
        outputFormat: 'json',
        outputDir: './reports',
        includeTests: [],
        excludeTests: [],
        severityFilters: ['critical', 'high']
      };

      const shouldRun = (testRunner as any).shouldRunTest(test, config);
      expect(shouldRun).toBe(false);
    });

    test('should calculate security scores correctly', () => {
      const report = {
        summary: {
          criticalFindings: 1,
          highFindings: 2,
          mediumFindings: 3,
          lowFindings: 4
        },
        findings: [
          { severity: 'critical' as SecuritySeverity, category: 'Cross-Site Scripting' },
          { severity: 'high' as SecuritySeverity, category: 'SQL Injection' },
          { severity: 'high' as SecuritySeverity, category: 'CSRF' },
          { severity: 'medium' as SecuritySeverity, category: 'Security Headers' },
          { severity: 'medium' as SecuritySeverity, category: 'Input Validation' },
          { severity: 'medium' as SecuritySeverity, category: 'Access Control' },
          { severity: 'low' as SecuritySeverity, category: 'Info Finding' }
        ]
      } as SecurityScanReport;

      (testRunner as any).calculateScores(report);

      expect(report.score.overall).toBeLessThan(100);
      expect(report.score.grade).toBeLessThanOrEqual('F');
      expect(report.score.details.owaspTopTen).toBeLessThanOrEqual(100);
      expect(report.score.details.inputValidation).toBeLessThanOrEqual(100);
    });
  });
});