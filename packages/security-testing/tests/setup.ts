/**
 * Test setup and configuration
 */

export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  metric: jest.fn(),
  audit: jest.fn(),
  withScanId: jest.fn().mockReturnThis(),
  withContext: jest.fn().mockReturnThis(),
};

export const mockScanConfig = {
  target: '/test/target',
  targetType: 'code' as const,
  enableSAST: true,
  enableDAST: false,
  enableSCA: false,
  enableCompliance: false,
  outputFormat: 'json' as const,
};

export const mockFinding = {
  id: 'test-finding-1',
  title: 'Test Finding',
  description: 'A test security finding',
  severity: {
    level: 'high' as const,
    score: 8,
  },
  type: 'SQL_INJECTION' as const,
  cwe: [{ id: 89, name: 'SQL Injection', description: '', url: '' }],
  owasp: ['A03:2021-Injection' as const],
  confidence: 90,
  file: '/test/file.ts',
  line: 10,
  column: 5,
  codeSnippet: 'const query = "SELECT * FROM users WHERE id = " + userId',
  remediation: 'Use parameterized queries',
  references: ['https://example.com'],
  scanner: 'sast',
  timestamp: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

global.mockLogger = mockLogger;
global.mockScanConfig = mockScanConfig;
global.mockFinding = mockFinding;
