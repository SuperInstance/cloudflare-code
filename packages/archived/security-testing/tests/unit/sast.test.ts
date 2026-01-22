/**
 * Unit tests for SAST Scanner
 */

import { SASTScanner } from '../../src/sast/scanner';
import { Severity, VulnerabilityType } from '../../src/types';
import { promises as fsp } from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('../../src/utils/logger');

describe('SASTScanner', () => {
  let scanner: SASTScanner;
  const mockLogger = global.mockLogger;

  beforeEach(() => {
    scanner = new SASTScanner(mockLogger);
    jest.clearAllMocks();
  });

  describe('Scanner Initialization', () => {
    it('should initialize with default rules', () => {
      expect(scanner).toBeDefined();
      expect(scanner['rules']).toBeDefined();
      expect(scanner['rules'].size).toBeGreaterThan(0);
    });

    it('should add custom rules', () => {
      const customRule = {
        id: 'CUSTOM_RULE_1',
        name: 'Custom Rule',
        description: 'A custom security rule',
        category: 'custom',
        severity: Severity.HIGH,
        enabled: true,
        languages: ['typescript'],
        patterns: [],
      };

      scanner.addCustomRule(customRule);
      expect(scanner['rules'].has('CUSTOM_RULE_1')).toBe(true);
    });
  });

  describe('File Scanning', () => {
    const mockVulnerableCode = `
// SQL Injection vulnerability
const userId = req.params.id;
const query = "SELECT * FROM users WHERE id = " + userId;
db.execute(query);

// XSS vulnerability
const html = "<div>" + userInput + "</div>";
document.getElementById('output').innerHTML = html;

// Hardcoded secret
const apiKey = "sk-1234567890abcdefghijklmnop";

// Weak encryption
const cipher = crypto.createCipher('des', key);
    `;

    beforeEach(() => {
      (fsp.readFile as jest.Mock).mockResolvedValue(mockVulnerableCode);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 1000 });
    });

    it('should detect SQL injection vulnerabilities', async () => {
      const findings = await scanner.scanFile(
        '/test/vulnerable.ts',
        '/test',
        {}
      );

      const sqlInjectionFindings = findings.filter(
        (f) => f.type === VulnerabilityType.SQL_INJECTION
      );

      expect(sqlInjectionFindings.length).toBeGreaterThan(0);
      expect(sqlInjectionFindings[0].severity.level).toBe(Severity.CRITICAL);
    });

    it('should detect XSS vulnerabilities', async () => {
      const findings = await scanner.scanFile(
        '/test/vulnerable.ts',
        '/test',
        {}
      );

      const xssFindings = findings.filter(
        (f) => f.type === VulnerabilityType.XSS
      );

      expect(xssFindings.length).toBeGreaterThan(0);
      expect(xssFindings[0].severity.level).toBe(Severity.HIGH);
    });

    it('should detect hardcoded secrets', async () => {
      const findings = await scanner.scanFile(
        '/test/vulnerable.ts',
        '/test',
        {}
      );

      const secretFindings = findings.filter(
        (f) => f.type === VulnerabilityType.SENSITIVE_DATA_EXPOSURE
      );

      expect(secretFindings.length).toBeGreaterThan(0);
    });

    it('should detect weak encryption', async () => {
      const findings = await scanner.scanFile(
        '/test/vulnerable.ts',
        '/test',
        {}
      );

      const encryptionFindings = findings.filter(
        (f) => f.type === VulnerabilityType.ENCRYPTION_FAILURE
      );

      expect(encryptionFindings.length).toBeGreaterThan(0);
    });

    it('should calculate complexity', async () => {
      const complexCode = `
function complexFunction(a, b, c) {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        if (a > b) {
          if (b > c) {
            if (c > a) {
              return a + b + c;
            }
          }
        }
      }
    }
  }
  return 0;
}
      `;

      (fsp.readFile as jest.Mock).mockResolvedValue(complexCode);

      const findings = await scanner.scanFile(
        '/test/complex.ts',
        '/test',
        {}
      );

      const complexityFindings = findings.filter(
        (f) => f.title === 'Complex Function'
      );

      expect(complexityFindings.length).toBeGreaterThan(0);
    });
  });

  describe('Directory Scanning', () => {
    it('should scan directory and return results', async () => {
      const mockFiles = [
        '/test/file1.ts',
        '/test/file2.ts',
        '/test/file3.ts',
      ];

      (fsp.readdir as jest.Mock).mockResolvedValue(mockFiles);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 1000 });
      (fsp.readFile as jest.Mock).mockResolvedValue('const x = 1;');

      const result = await scanner.scanDirectory('/test', {
        maxFiles: 100,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.scanType).toBe('sast');
      expect(result.findings).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
    });

    it('should respect max files limit', async () => {
      const mockFiles = Array.from({ length: 200 }, (_, i) => `/test/file${i}.ts`);

      (fsp.readdir as jest.Mock).mockResolvedValue(mockFiles);
      (fsp.stat as jest.Mock).mockResolvedValue({ size: 1000 });
      (fsp.readFile as jest.Mock).mockResolvedValue('const x = 1;');

      const result = await scanner.scanDirectory('/test', {
        maxFiles: 50,
      });

      expect(result.stats.filesScanned).toBeLessThanOrEqual(50);
    });
  });

  describe('Severity Scoring', () => {
    it('should map severity to correct scores', () => {
      expect(scanner['getSeverityScore'](Severity.CRITICAL)).toBe(10);
      expect(scanner['getSeverityScore'](Severity.HIGH)).toBe(8);
      expect(scanner['getSeverityScore'](Severity.MEDIUM)).toBe(5);
      expect(scanner['getSeverityScore'](Severity.LOW)).toBe(3);
      expect(scanner['getSeverityScore'](Severity.INFO)).toBe(1);
    });
  });

  describe('Finding Grouping', () => {
    it('should group findings by type and severity', () => {
      const mockFindings = [
        {
          type: VulnerabilityType.SQL_INJECTION,
          severity: { level: Severity.HIGH, score: 8 },
          file: '/test/file1.ts',
        },
        {
          type: VulnerabilityType.SQL_INJECTION,
          severity: { level: Severity.HIGH, score: 8 },
          file: '/test/file2.ts',
        },
        {
          type: VulnerabilityType.XSS,
          severity: { level: Severity.MEDIUM, score: 5 },
          file: '/test/file1.ts',
        },
      ];

      const groups = scanner['groupFindings'](mockFindings);

      expect(groups).toBeDefined();
      expect(groups.length).toBe(2);
      expect(groups[0].count).toBe(2);
      expect(groups[1].count).toBe(1);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate correct statistics', () => {
      const mockFindings = [
        { severity: { level: Severity.CRITICAL } },
        { severity: { level: Severity.HIGH } },
        { severity: { level: Severity.HIGH } },
        { severity: { level: Severity.MEDIUM } },
        { severity: { level: Severity.LOW } },
      ];

      const stats = scanner['calculateStatistics'](mockFindings, 10, 1000);

      expect(stats.total).toBe(5);
      expect(stats.critical).toBe(1);
      expect(stats.high).toBe(2);
      expect(stats.medium).toBe(1);
      expect(stats.low).toBe(1);
      expect(stats.info).toBe(0);
      expect(stats.filesScanned).toBe(10);
      expect(stats.linesScanned).toBe(1000);
    });
  });

  describe('Context Extraction', () => {
    it('should extract code context around findings', () => {
      const code = `line 1
line 2
line 3
line 4
line 5
line 6
line 7`;

      const context = scanner['extractContext'](code, 4, 2);

      expect(context).toContain('line 2');
      expect(context).toContain('line 3');
      expect(context).toContain('line 4');
      expect(context).toContain('line 5');
      expect(context).toContain('line 6');
    });
  });
});
