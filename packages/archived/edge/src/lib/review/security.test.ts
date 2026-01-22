/**
 * Security Scanner Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityScanner, createSecurityScanner } from './security';

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;

  beforeEach(() => {
    scanner = createSecurityScanner();
  });

  describe('scanFile', () => {
    it('should detect hardcoded passwords', async () => {
      const code = `
const password = "mySecretPassword123";
const config = {
  passwd: "anotherPassword456"
};
      `;

      const report = await scanner.scanFile(code, 'test.ts', 'typescript');

      expect(report.secrets.length).toBeGreaterThan(0);
      expect(report.secrets.some(s => s.type === 'password')).toBe(true);
    });

    it('should detect API keys', async () => {
      const code = `
const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
const API_KEY = "AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe";
      `;

      const report = await scanner.scanFile(code, 'test.ts', 'typescript');

      expect(report.secrets.length).toBeGreaterThan(0);
    });

    it('should detect SQL injection vulnerabilities', async () => {
      const code = `
function queryUser(userId: string) {
  db.query(\`SELECT * FROM users WHERE id = \${userId}\`);
}

function findUser(name: string) {
  db.execute("SELECT * FROM users WHERE name = '" + name + "'");
}
      `;

      const report = await scanner.scanFile(code, 'test.ts', 'typescript');

      const sqlInjections = report.vulnerabilities.filter(v => v.category === 'injection');
      expect(sqlInjections.length).toBeGreaterThan(0);
    });

    it('should detect XSS vulnerabilities', async () => {
      const code = `
function render userInput: string) {
  document.innerHTML = \`<div>\${userInput}</div>\`;
}

function updateContent(data: string) {
  element.innerHTML = data;
}
      `;

      const report = await scanner.scanFile(code, 'test.ts', 'typescript');

      const xssVulns = report.vulnerabilities.filter(v => v.category === 'injection');
      expect(xssVulns.length).toBeGreaterThan(0);
    });

    it('should detect weak cryptography', async () => {
      const code = `
const hash = md5(data);
const signature = sha1(message);
      `;

      const report = await scanner.scanFile(code, 'test.ts', 'typescript');

      const cryptoVulns = report.vulnerabilities.filter(v => v.category === 'crypto');
      expect(cryptoVulns.length).toBeGreaterThan(0);
    });

    it('should calculate security score correctly', async () => {
      const cleanCode = `
function add(a: number, b: number): number {
  return a + b;
}
      `;

      const cleanReport = await scanner.scanFile(cleanCode, 'test.ts', 'typescript');
      expect(cleanReport.score).toBeGreaterThan(80);

      const vulnerableCode = `
const password = "hardcoded";
const hash = md5(data);
db.query(\`SELECT * FROM users WHERE id = \${userId}\`);
      `;

      const vulnerableReport = await scanner.scanFile(vulnerableCode, 'test.ts', 'typescript');
      expect(vulnerableReport.score).toBeLessThan(80);
    });

    it('should generate correct summary', async () => {
      const code = `
const password = "hardcoded";
const hash = md5(data);
db.query(\`SELECT * FROM users WHERE id = \${userId}\`);
document.innerHTML = userInput;
      `;

      const report = await scanner.scanFile(code, 'test.ts', 'typescript');

      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.summary.critical + report.summary.high).toBeGreaterThan(0);
    });
  });

  describe('scanAuthIssues', () => {
    it('should detect hardcoded credentials in auth logic', async () => {
      const code = `
function authenticate(username: string, password: string) {
  if (username === "admin" && password === "admin123") {
    return true;
  }
  return false;
}
      `;

      const authIssues = await scanner.scanAuthIssues(code, 'test.ts', 'typescript');

      expect(authIssues.length).toBeGreaterThan(0);
      expect(authIssues[0].category).toBe('auth');
    });
  });

  describe('loadVulnerabilityDatabase', () => {
    it('should load vulnerability data', () => {
      const vulns = [
        {
          packageName: 'lodash',
          version: '4.17.15',
          severity: 'high' as const,
          cve: 'CVE-2021-23337',
          title: 'Prototype Pollution in lodash',
          description: 'Lodash is vulnerable to prototype pollution',
          patchedVersions: ['4.17.21'],
          recommendation: 'Update to version 4.17.21 or later',
          references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-23337'],
        },
      ];

      scanner.loadVulnerabilityDatabase(vulns);

      // Should not throw
      expect(scanner).toBeDefined();
    });
  });

  describe('createSecurityScanner', () => {
    it('should create a scanner instance', () => {
      const scanner = createSecurityScanner();
      expect(scanner).toBeInstanceOf(SecurityScanner);
    });

    it('should accept custom configuration', () => {
      const scanner = createSecurityScanner({
        checkSecrets: true,
        checkInjection: true,
        checkXSS: true,
        minSecretEntropy: 4.0,
      });
      expect(scanner).toBeInstanceOf(SecurityScanner);
    });
  });
});

describe('Secret Detection', () => {
  let scanner: SecurityScanner;

  beforeEach(() => {
    scanner = createSecurityScanner();
  });

  it('should detect AWS access keys', async () => {
    const code = 'const awsKey = "AKIAIOSFODNN7EXAMPLE";';
    const report = await scanner.scanFile(code, 'test.ts', 'typescript');

    const awsKeys = report.secrets.filter(s => s.type === 'aws-access-key');
    expect(awsKeys.length).toBe(1);
  });

  it('should detect JWT tokens', async () => {
    const code = 'const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.4Adcj3UBLbh30G8w4T5kQE2sELoH6YZQKF0hdmIgX5g";';
    const report = await scanner.scanFile(code, 'test.ts', 'typescript');

    const jwts = report.secrets.filter(s => s.type === 'jwt');
    expect(jwts.length).toBe(1);
  });

  it('should detect database URLs', async () => {
    const code = `
const mongoUrl = "mongodb://user:password@localhost:27017/mydb";
const pgUrl = "postgres://user:pass@localhost:5432/mydb";
      `;

    const report = await scanner.scanFile(code, 'test.ts', 'typescript');

    const dbUrls = report.secrets.filter(s => s.type === 'database-url');
    expect(dbUrls.length).toBeGreaterThan(0);
  });

  it('should avoid false positives', async () => {
    const code = `
const password = "123"; // Too short
const key = "example"; // Common word
const url = "https://example.com"; // URL
      `;

    const report = await scanner.scanFile(code, 'test.ts', 'typescript');

    // Should not detect these as secrets
    const highConfidenceSecrets = report.secrets.filter(s => s.verified && s.severity === 'critical');
    expect(highConfidenceSecrets.length).toBe(0);
  });
});
