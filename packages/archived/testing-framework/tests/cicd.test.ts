/**
 * CI/CD Integration Tests
 * Comprehensive test suite for CI/CD integration functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CICDIntegration } from '../src/cicd/index';
import { CICDGenerator } from '../src/cicd/generator';
import { CICDAnalyzer } from '../src/cicd/analyzer';
import { CICDConfig, CICDReport } from '../src/cicd/types';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('fetch');

describe('CICDIntegration', () => {
  let cicdConfig: CICDConfig;
  let cicdIntegration: CICDIntegration;

  beforeEach(() => {
    // Create mock configuration
    cicdConfig = {
      platform: 'github-actions',
      repository: {
        owner: 'my-org',
        name: 'my-project',
        branch: 'main'
      },
      build: {
        command: 'npm run build',
        dependencies: {
          install: 'npm ci'
        }
      },
      testing: {
        command: 'npm test',
        patterns: ['**/*.test.{js,ts}'],
        environment: {},
        parallel: {
          enabled: false,
          splitBy: 'none'
        },
        coverage: {
          enabled: true,
          thresholds: {
            lines: 80,
            branches: 75,
            functions: 80,
            statements: 80
          },
          minimum: 80,
          failBuild: true
        },
        benchmarks: {
          enabled: false,
          thresholds: {},
          failBuild: true
        },
        security: {
          enabled: true,
          tools: ['npm audit'],
          failBuild: true
        },
        artifacts: {
          reports: true,
          screenshots: false,
          videos: false,
          logs: false,
          coverage: true
        }
      },
      deployment: {
        enabled: false,
        environment: 'staging',
        command: 'npm run deploy',
        preChecks: {
          enabled: false,
          commands: []
        },
        postVerification: {
          enabled: false,
          commands: [],
          timeout: 300
        }
      },
      notifications: {
        slack: {
          enabled: false,
          webhook: '',
          channel: '#ci-cd',
          onSuccess: true,
          onFailure: true
        }
      },
      caching: {
        nodeModules: {
          enabled: true,
          paths: ['node_modules']
        },
        build: {
          enabled: true,
          paths: ['dist']
        },
        tests: {
          enabled: true,
          paths: ['test-results']
        }
      },
      secrets: {
        environment: [],
        files: []
      },
      timeouts: {
        build: 30,
        tests: 60,
        deployment: 45
      },
      retries: {
        max: 2,
        delay: 5000,
        conditions: []
      },
      qualityGates: {
        testSuccessRate: {
          enabled: true,
          minimum: 90
        },
        coverage: {
          enabled: true,
          minimum: 80
        },
        performance: {
          enabled: false,
          thresholds: {}
        },
        security: {
          enabled: true,
          maximumVulnerabilities: 0,
          allowedLevels: ['low']
        }
      }
    };

    cicdIntegration = new CICDIntegration(cicdConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with correct configuration', () => {
      expect(cicdIntegration.getConfig()).toEqual(cicdConfig);
    });

    it('should validate configuration correctly', () => {
      const validation = cicdIntegration.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Test invalid configuration
      const invalidConfig = { ...cicdConfig, repository: { ...cicdConfig.repository, owner: '' } };
      const invalidIntegration = new CICDIntegration(invalidConfig);
      const invalidValidation = invalidIntegration.validate();
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors.length).toBeGreaterThan(0);
    });

    it('should update configuration', () => {
      const newConfig = { ...cicdConfig, platform: 'gitlab-ci' };
      cicdIntegration.updateConfig(newConfig);
      expect(cicdIntegration.getConfig().platform).toBe('gitlab-ci');
    });
  });

  describe('Initialization', () => {
    it('should create CI/CD configuration files', async () => {
      const outputDir = './test-ci-cd';
      const mockExistsSync = vi.spyOn(existsSync, 'call');
      const mockWriteFileSync = vi.spyOn(writeFileSync, 'call');
      const mockMkdirSync = vi.spyOn(mkdirSync, 'call');

      // Mock directory existence
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes('scripts') || path.includes('templates') || path.includes('config');
      });

      await cicdIntegration.initialize(outputDir);

      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();

      // Check that configuration files were created
      const configFiles = [
        join(outputDir, `${cicdConfig.repository.name}-ci.yml`),
        join(outputDir, '.gitlab-ci.yml'),
        join(outputDir, 'Jenkinsfile')
      ];

      for (const file of configFiles) {
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          expect.stringContaining(file),
          expect.any(String)
        );
      }
    });

    it('should handle initialization errors', async () => {
      const invalidConfig = { ...cicdConfig, repository: { ...cicdConfig.repository, owner: '' } };
      const invalidIntegration = new CICDIntegration(invalidConfig);

      await expect(invalidIntegration.initialize()).rejects.toThrow();
    });
  });

  describe('Pipeline Execution', () => {
    it('should run CI/CD pipeline successfully', async () => {
      const report = await cicdIntegration.runPipeline('test-pipeline');

      expect(report).toBeDefined();
      expect(report.build.id).toBe('test-pipeline');
      expect(report.tests.total).toBeGreaterThan(0);
      expect(report.qualityGates).toBeDefined();

      // Check that report was written to file
      const reportPath = join(process.cwd(), 'reports', 'cicd-report-test-pipeline.md');
      expect(existsSync(reportPath)).toBe(true);

      const reportContent = readFileSync(reportPath, 'utf-8');
      expect(reportContent).toContain('CI/CD Test Report');
    });

    it('should handle pipeline failures', async () => {
      // Mock analyzer to return failure
      const mockAnalyzer = vi.spyOn(cicdIntegration['analyzer'], 'analyze');
      mockAnalyzer.mockResolvedValue({
        build: {
          id: 'test-pipeline',
          number: '1',
          status: 'failure',
          startTime: Date.now(),
          branch: 'main',
          commit: {
            sha: 'abc123',
            message: 'Test commit',
            author: 'test@example.com',
            timestamp: Date.now()
          }
        },
        tests: {
          total: 10,
          passed: 5,
          failed: 5,
          skipped: 0,
          duration: 10000,
          suites: []
        },
        qualityGates: {
          testSuccessRate: false,
          coverage: true,
          performance: true,
          security: true,
          overall: false
        },
        artifacts: [],
        notifications: { sent: [], failed: [] }
      } as CICDReport);

      const report = await cicdIntegration.runPipeline('test-pipeline-failure');
      expect(report.qualityGates.overall).toBe(false);
    });
  });

  describe('Performance Analysis', () => {
    it('should analyze pipeline performance', async () => {
      const performance = await cicdIntegration.analyzePerformance('test-performance');

      expect(performance).toBeDefined();
      expect(performance.averageBuildTime).toBeGreaterThan(0);
      expect(performance.averageTestTime).toBeGreaterThan(0);
      expect(performance.successRate).toBeGreaterThan(0);
      expect(performance.trends.builds).toHaveLength(5);
      expect(performance.trends.tests).toHaveLength(5);
    });

    it('should generate trend report', async () => {
      const trendReport = await cicdIntegration.generateTrendReport('test-trends');

      expect(trendReport).toBeDefined();
      expect(trendReport).toContain('CI/CD Performance Trends');
      expect(trendReport).toContain('Build Time Trend');
      expect(trendReport).toContain('Test Time Trend');
    });
  });

  describe('Hooks and Setup', () => {
    it('should setup pre-commit hooks', async () => {
      const outputDir = './test-hooks';
      const mockExistsSync = vi.spyOn(existsSync, 'call');
      mockExistsSync.mockReturnValue(false);

      await cicdIntegration.setupPreCommitHooks(outputDir);

      // Check that pre-commit hook was created
      const hookPath = join(outputDir, 'pre-commit');
      expect(existsSync(hookPath)).toBe(true);
    });

    it('should setup automated deployment', async () => {
      // Enable deployment for this test
      cicdConfig.deployment.enabled = true;
      cicdIntegration.updateConfig(cicdConfig);

      const outputDir = './test-deployment';
      const mockWriteFileSync = vi.spyOn(writeFileSync, 'call');

      await cicdIntegration.setupAutomatedDeployment(outputDir);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('deploy.sh'),
        expect.stringContaining('Automated deployment script')
      );
    });

    it('should create monitoring dashboard', async () => {
      const outputDir = './test-dashboard';
      const mockWriteFileSync = vi.spyOn(writeFileSync, 'call');

      await cicdIntegration.createMonitoringDashboard(outputDir);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('dashboard.md'),
        expect.stringContaining('CI/CD Monitoring Dashboard')
      );
    });
  });

  describe('Utility Functions', () => {
    it('should create default configuration', () => {
      const defaultConfig = (CICDIntegration as any).createDefaultConfig();
      expect(defaultConfig.platform).toBe('github-actions');
      expect(defaultConfig.repository.owner).toBe('my-org');
      expect(defaultConfig.testing.coverage.enabled).toBe(true);
    });

    it('should save and load configuration', () => {
      const testConfigPath = './test-config.json';
      const mockWriteFileSync = vi.spyOn(writeFileSync, 'call');
      const mockReadFileSync = vi.spyOn(readFileSync, 'call');
      const mockExistsSync = vi.spyOn(existsSync, 'call');

      // Mock file operations
      mockExistsSync.mockReturnValueOnce(false);
      mockExistsSync.mockReturnValueOnce(true);
      mockReadFileSync.mockReturnValueOnce(JSON.stringify(cicdConfig));

      // Save configuration
      (CICDIntegration as any).saveConfig(cicdConfig, testConfigPath);
      expect(mockWriteFileSync).toHaveBeenCalled();

      // Load configuration
      (CICDIntegration as any).loadConfig(testConfigPath);
      expect(mockReadFileSync).toHaveBeenCalled();
    });

    it('should handle configuration loading errors', async () => {
      const mockExistsSync = vi.spyOn(existsSync, 'call');
      mockExistsSync.mockReturnValueOnce(false);

      await expect((CICDIntegration as any).loadConfig('./nonexistent.json')).rejects.toThrow();
    });
  });
});

describe('CICDGenerator', () => {
  let generator: CICDGenerator;

  beforeEach(() => {
    generator = new CICDGenerator(cicdConfig);
  });

  describe('Configuration Generation', () => {
    it('should generate GitHub Actions configuration', async () => {
      const outputDir = './test-github';
      const mockMkdirSync = vi.spyOn(mkdirSync, 'call');
      const mockWriteFileSync = vi.spyOn(writeFileSync, 'call');
      const mockExistsSync = vi.spyOn(existsSync, 'call');

      mockExistsSync.mockReturnValue(false);

      await generator.generate(outputDir);

      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.yml'),
        expect.stringContaining('name:')
      );

      // Check GitHub Actions specific content
      const workflowContent = mockWriteFileSync.mock.calls.find(
        call => call[0].includes('github-actions')
      )?.[1] as string;

      expect(workflowContent).toContain('github-actions');
      expect(workflowContent).toContain('runs-on: ubuntu-latest');
    });

    it('should generate GitLab CI configuration', async () => {
      const gitlabConfig = { ...cicdConfig, platform: 'gitlab-ci' };
      const gitlabGenerator = new CICDGenerator(gitlabConfig);

      const mockWriteFileSync = vi.spyOn(writeFileSync, 'call');
      const mockExistsSync = vi.spyOn(existsSync, 'call');
      mockExistsSync.mockReturnValue(false);

      await gitlabGenerator.generate('./test-gitlab');

      const gitlabContent = mockWriteFileSync.mock.calls.find(
        call => call[0].includes('.gitlab-ci.yml')
      )?.[1] as string;

      expect(gitlabContent).toContain('image: node:20');
      expect(gitlabContent).toContain('stages:');
    });

    it('should generate Jenkins pipeline', async () => {
      const jenkinsConfig = { ...cicdConfig, platform: 'jenkins' };
      const jenkinsGenerator = new CICDGenerator(jenkinsConfig);

      const mockWriteFileSync = vi.spyOn(writeFileSync, 'call');
      const mockExistsSync = vi.spyOn(existsSync, 'call');
      mockExistsSync.mockReturnValue(false);

      await jenkinsGenerator.generate('./test-jenkins');

      const jenkinsContent = mockWriteFileSync.mock.calls.find(
        call => call[0].includes('Jenkinsfile')
      )?.[1] as string;

      expect(jenkinsContent).toContain('pipeline {');
      expect(jenkinsContent).toContain('agent any');
    });

    it('should handle unsupported platform', async () => {
      const unsupportedConfig = { ...cicdConfig, platform: 'unsupported' as any };
      const unsupportedGenerator = new CICDGenerator(unsupportedConfig);

      await expect(unsupportedGenerator.generate('./test')).rejects.toThrow('Unsupported platform');
    });
  });

  describe('Report Generation', () => {
    it('should generate test report', () => {
      const mockReport = {
        build: {
          id: 'test-build',
          number: '1',
          status: 'success',
          startTime: Date.now(),
          branch: 'main',
          commit: {
            sha: 'abc123',
            message: 'Test commit',
            author: 'test@example.com',
            timestamp: Date.now()
          }
        },
        tests: {
          total: 10,
          passed: 8,
          failed: 2,
          skipped: 0,
          duration: 5000,
          suites: []
        },
        coverage: {
          lines: 85,
          branches: 78,
          functions: 89,
          statements: 82,
          perFile: {}
        },
        benchmarks: {
          'response-time': {
            value: 250,
            threshold: 300,
            status: 'pass' as const,
            unit: 'ms'
          }
        },
        security: {
          vulnerabilities: [],
          tools: ['npm audit']
        },
        qualityGates: {
          testSuccessRate: true,
          coverage: true,
          performance: true,
          security: true,
          overall: true
        },
        artifacts: [
          {
            name: 'test-results',
            path: 'test-results',
            size: 1024,
            type: 'json'
          }
        ],
        notifications: {
          sent: ['slack'],
          failed: []
        }
      };

      const report = generator.generateTestReport(mockReport);

      expect(report).toBeDefined();
      expect(report).toContain('CI/CD Test Report');
      expect(report).toContain('Build ID: test-build');
      expect(report).toContain('Total Tests: 10');
      expect(report).toContain('Coverage: 85.00%');
      expect(report).toContain('Overall: ✓');
    });

    it('should generate quality gates check script', () => {
      const script = generator.generateQualityGatesCheck();

      expect(script).toBeDefined();
      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('Running quality gates checks');
      expect(script).toContain('echo "🎉 All quality gates passed!"');
    });
  });

  describe('Validation', () => {
    it('should validate configuration correctly', () => {
      const validation = generator.validate();
      expect(validation.valid).toBe(true);

      const invalidConfig = { ...cicdConfig, repository: { ...cicdConfig.repository, owner: '' } };
      const invalidGenerator = new CICDGenerator(invalidConfig);
      const invalidValidation = invalidGenerator.validate();
      expect(invalidValidation.valid).toBe(false);
    });
  });
});

describe('CICDAnalyzer', () => {
  let analyzer: CICDAnalyzer;

  beforeEach(() => {
    analyzer = new CICDAnalyzer(cicdConfig);
  });

  describe('Pipeline Analysis', () => {
    it('should analyze pipeline results', async () => {
      const report = await analyzer.analyze('test-analysis');

      expect(report).toBeDefined();
      expect(report.build.id).toBe('test-analysis');
      expect(report.tests.total).toBeGreaterThan(0);
      expect(report.coverage).toBeDefined();
      expect(report.qualityGates).toBeDefined();
    });

    it('should analyze performance metrics', async () => {
      const performance = await analyzer.analyzePerformance('test-performance');

      expect(performance).toBeDefined();
      expect(performance.averageBuildTime).toBeGreaterThan(0);
      expect(performance.averageTestTime).toBeGreaterThan(0);
      expect(performance.successRate).toBeGreaterThan(0);
      expect(performance.trends.builds).toHaveLength(5);
      expect(performance.trends.tests).toHaveLength(5);
    });

    it('should generate trend report', async () => {
      const trendReport = await analyzer.generateTrendReport('test-trends');

      expect(trendReport).toBeDefined();
      expect(trendReport).toContain('CI/CD Performance Trends');
      expect(trendReport).toContain('Build Time Trend');
      expect(trendReport).toContain('Test Time Trend');
    });
  });

  describe('Component Analysis', () => {
    it('should analyze test results', async () => {
      const testResults = await analyzer['analyzeTestResults']('test');

      expect(testResults).toBeDefined();
      expect(testResults.total).toBeGreaterThan(0);
      expect(testResults.passed + testResults.failed + testResults.skipped).toBe(testResults.total);
      expect(testResults.suites).toHaveLength(3); // Unit, Integration, E2E
    });

    it('should analyze coverage results', async () => {
      const coverage = await analyzer['analyzeCoverage']('test');

      expect(coverage).toBeDefined();
      expect(coverage.lines).toBeGreaterThan(0);
      expect(coverage.branches).toBeGreaterThan(0);
      expect(coverage.functions).toBeGreaterThan(0);
      expect(coverage.statements).toBeGreaterThan(0);
    });

    it('should analyze security scan results', async () => {
      const security = await analyzer['analyzeSecurity']('test');

      expect(security).toBeDefined();
      expect(Array.isArray(security.vulnerabilities)).toBe(true);
      expect(Array.isArray(security.tools)).toBe(true);
      expect(security.tools.length).toBeGreaterThan(0);
    });

    it('should check quality gates', async () => {
      const qualityGates = await analyzer['checkQualityGates']('test');

      expect(qualityGates).toBeDefined();
      expect(typeof qualityGates.testSuccessRate).toBe('boolean');
      expect(typeof qualityGates.coverage).toBe('boolean');
      expect(typeof qualityGates.performance).toBe('boolean');
      expect(typeof qualityGates.security).toBe('boolean');
      expect(typeof qualityGates.overall).toBe('boolean');
    });

    it('should get artifacts', async () => {
      const artifacts = await analyzer['getArtifacts']('test');

      expect(artifacts).toBeDefined();
      expect(Array.isArray(artifacts)).toBe(true);
      expect(artifacts.length).toBeGreaterThan(0);

      const artifact = artifacts[0];
      expect(artifact.name).toBeDefined();
      expect(artifact.path).toBeDefined();
      expect(artifact.size).toBeGreaterThan(0);
      expect(artifact.type).toBeDefined();
    });
  });

  describe('Notifications', () => {
    it('should send Slack notification', async () => {
      // Mock fetch
      const mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch.mockResolvedValue({ ok: true });

      const mockReport = {
        build: {
          id: 'test',
          number: '1',
          status: 'success',
          startTime: Date.now(),
          branch: 'main',
          commit: {
            sha: 'abc123',
            message: 'Test commit',
            author: 'test@example.com',
            timestamp: Date.now()
          }
        },
        tests: {
          total: 10,
          passed: 8,
          failed: 2,
          skipped: 0,
          duration: 5000,
          suites: []
        },
        qualityGates: {
          testSuccessRate: true,
          coverage: true,
          performance: true,
          security: true,
          overall: true
        },
        notifications: { sent: [], failed: [] }
      } as CICDReport;

      // Enable Slack notifications
      cicdConfig.notifications.slack = {
        enabled: true,
        webhook: 'https://hooks.slack.com/test',
        channel: '#test',
        onSuccess: true,
        onFailure: true
      };

      const slackAnalyzer = new CICDAnalyzer(cicdConfig);
      await slackAnalyzer['sendSlackNotification'](mockReport);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should handle notification errors', async () => {
      // Mock fetch to throw error
      const mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch.mockRejectedValue(new Error('Network error'));

      const mockReport = {} as CICDReport;

      await expect(
        analyzer['sendSlackNotification'](mockReport)
      ).rejects.toThrow('Network error');
    });
  });
});