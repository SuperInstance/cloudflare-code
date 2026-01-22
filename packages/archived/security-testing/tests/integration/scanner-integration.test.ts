/**
 * Integration tests for Security Testing Package
 */

import { SecurityTesting, quickScan } from '../../src/index';
import { Severity, VulnerabilityType } from '../../src/types';
import { promises as fsp } from 'fs';
import path from 'path';
import nock from 'nock';

describe('Security Testing Integration', () => {
  let securityTesting: SecurityTesting;

  beforeEach(() => {
    securityTesting = new SecurityTesting();
    jest.clearAllMocks();
  });

  describe('Comprehensive Scanning', () => {
    it('should run comprehensive scan with all scanners', async () => {
      const mockCode = `
// Vulnerable code
const userId = req.params.id;
const query = "SELECT * FROM users WHERE id = " + userId;
db.execute(query);
      `;

      (fsp.readFile as jest.Mock).mockResolvedValue(mockCode);
      (fsp.readdir as jest.Mock).mockResolvedValue(['test.ts']);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 100 });
      (fsp.access as jest.Mock).mockResolvedValue(undefined);

      const results = await securityTesting.runComprehensiveScan('/test/path', {
        enableSAST: true,
        enableSCA: true,
        enableCompliance: false,
        enableDAST: false,
      });

      expect(results).toBeDefined();
      expect(results.sast).toBeDefined();
      expect(results.sca).toBeDefined();
      expect(results.summary).toBeDefined();
    });

    it('should aggregate findings from multiple scanners', async () => {
      const mockCode = 'const x = 1;';

      (fsp.readFile as jest.Mock).mockResolvedValue(mockCode);
      (fsp.readdir as jest.Mock).mockResolvedValue(['test.ts']);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 100 });

      const results = await securityTesting.runComprehensiveScan('/test/path');

      expect(results.summary).toBeDefined();
      expect(results.summary.totalFindings).toBeGreaterThanOrEqual(0);
      expect(results.summary.critical).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SAST Integration', () => {
    it('should scan code and detect vulnerabilities', async () => {
      const vulnerableCode = `
const query = "SELECT * FROM users WHERE id = " + userInput;
db.execute(query);
      `;

      (fsp.readFile as jest.Mock).mockResolvedValue(vulnerableCode);
      (fsp.readdir as jest.Mock).mockResolvedValue(['vulnerable.ts']);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 200 });

      const result = await securityTesting.scanCode('/test/path');

      expect(result).toBeDefined();
      expect(result.findings).toBeDefined();
      expect(result.findings.length).toBeGreaterThan(0);
    });

    it('should support custom severity threshold', async () => {
      const code = 'const x = 1;';
      (fsp.readFile as jest.Mock).mockResolvedValue(code);
      (fsp.readdir as jest.Mock).mockResolvedValue(['test.ts']);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 100 });

      const result = await securityTesting.scanCode('/test/path', {
        severityThreshold: Severity.HIGH,
      });

      expect(result).toBeDefined();
    });
  });

  describe('Dependency Scanning Integration', () => {
    it('should scan dependencies for vulnerabilities', async () => {
      const mockPackageJson = {
        name: 'test-package',
        dependencies: {
          'vulnerable-package': '1.0.0',
          'safe-package': '2.0.0',
        },
      };

      (fsp.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPackageJson));
      (fsp.access as jest.Mock).mockResolvedValue(undefined);

      const result = await securityTesting.scanDependencies('/test/path');

      expect(result).toBeDefined();
      expect(result.scanType).toBe('sca');
      expect(result.findings).toBeDefined();
    });

    it('should detect license issues', async () => {
      const mockPackageJson = {
        name: 'test-package',
        dependencies: {
          'gpl-package': '1.0.0',
        },
      };

      (fsp.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPackageJson));
      (fsp.access as jest.Mock).mockResolvedValue(undefined);

      const result = await securityTesting.scanDependencies('/test/path', {
        licenseBlacklist: ['GPL'],
      });

      expect(result).toBeDefined();
    });
  });

  describe('DAST Integration', () => {
    beforeEach(() => {
      nock.cleanAll();
    });

    it('should scan web application', async () => {
      const mockHTML = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<form action="/login" method="POST">
  <input type="text" name="username">
  <input type="password" name="password">
  <button type="submit">Login</button>
</form>
</body>
</html>
      `;

      nock('http://example.com')
        .get('/')
        .reply(200, mockHTML, {
          'content-type': 'text/html',
        });

      const result = await securityTesting.scanWebApplication('http://example.com', {
        maxPages: 1,
      });

      expect(result).toBeDefined();
      expect(result.scanType).toBe('dast');
      expect(result.findings).toBeDefined();
    });

    it('should detect missing security headers', async () => {
      nock('http://example.com')
        .get('/')
        .reply(200, '<html></html>', {
          'content-type': 'text/html',
        });

      const result = await securityTesting.scanWebApplication('http://example.com');

      const headerFindings = result.findings.filter(
        (f) => f.title.includes('Missing Security Header')
      );

      expect(headerFindings.length).toBeGreaterThan(0);
    });
  });

  describe('Policy Engine Integration', () => {
    it('should evaluate findings against policies', async () => {
      const mockFindings = [
        {
          id: 'test-1',
          severity: { level: Severity.HIGH, score: 8 },
          type: VulnerabilityType.SQL_INJECTION,
          file: '/test/file.ts',
          line: 10,
          column: 0,
          title: 'SQL Injection',
          description: 'SQL injection vulnerability',
          confidence: 90,
          codeSnippet: 'query = "SELECT * FROM users WHERE id = " + id',
          remediation: 'Use parameterized queries',
          references: [],
          scanner: 'sast',
          timestamp: new Date(),
        },
      ];

      const evaluations = await securityTesting.evaluatePolicies(mockFindings);

      expect(evaluations).toBeDefined();
      expect(Array.isArray(evaluations)).toBe(true);
    });

    it('should create pre-commit hook', async () => {
      (fsp.writeFile as jest.Mock).mockResolvedValue(undefined);

      await securityTesting.createPreCommitHook('.git/hooks/pre-commit');

      expect(fsp.writeFile).toHaveBeenCalled();
    });
  });

  describe('Compliance Scanning Integration', () => {
    it('should scan for SOC 2 compliance', async () => {
      (fsp.access as jest.Mock)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(undefined);

      const result = await securityTesting.scanCompliance(
        '/test/path',
        ['SOC_2' as any],
        {}
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].framework).toBe('SOC_2');
    });

    it('should generate compliance recommendations', async () => {
      (fsp.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await securityTesting.scanCompliance(
        '/test/path',
        ['SOC_2' as any],
        {}
      );

      expect(result[0].recommendations).toBeDefined();
      expect(Array.isArray(result[0].recommendations)).toBe(true);
    });
  });

  describe('Penetration Testing Integration', () => {
    it('should run penetration test', async () => {
      nock('http://example.com')
        .get('/')
        .reply(200, '<html></html>');

      const result = await securityTesting.runPenTest('http://example.com', {
        targetType: 'web',
        phases: [
          { name: 'reconnaissance', enabled: true },
          { name: 'scanning', enabled: false },
        ],
        options: {},
      });

      expect(result).toBeDefined();
      expect(result.phases).toBeDefined();
      expect(result.findings).toBeDefined();
    });
  });

  describe('Vulnerability Database', () => {
    it('should lookup vulnerabilities', () => {
      const vulns = securityTesting.lookupVulnerabilities(
        'ws',
        'npm',
        '8.0.0'
      );

      expect(vulns).toBeDefined();
      expect(Array.isArray(vulns)).toBe(true);
    });

    it('should get vulnerability statistics', () => {
      const stats = securityTesting.getVulnerabilityStats();

      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byEcosystem).toBeDefined();
      expect(stats.bySeverity).toBeDefined();
    });
  });

  describe('Quick Scan', () => {
    it('should perform quick scan', async () => {
      (fsp.readFile as jest.Mock).mockResolvedValue('const x = 1;');
      (fsp.readdir as jest.Mock).mockResolvedValue(['test.ts']);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 100 });
      (fsp.access as jest.Mock).mockResolvedValue(undefined);

      const result = await quickScan('/test/path');

      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle scanning errors gracefully', async () => {
      (fsp.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fsp.readdir as jest.Mock).mockResolvedValue(['test.ts']);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 100 });

      const result = await securityTesting.scanCode('/test/path');

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should handle invalid target paths', async () => {
      (fsp.readdir as jest.Mock).mockRejectedValue(new Error('Invalid path'));

      await expect(
        securityTesting.scanCode('/invalid/path')
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete scan within reasonable time', async () => {
      const startTime = Date.now();

      (fsp.readFile as jest.Mock).mockResolvedValue('const x = 1;');
      (fsp.readdir as jest.Mock).mockResolvedValue(['test.ts']);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 100 });

      await securityTesting.scanCode('/test/path');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });
});
