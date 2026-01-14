/**
 * DAST Scanner - Dynamic Application Security Testing
 * Performs automated dynamic security testing of web applications
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { Severity, VulnerabilityType, Finding, ScanConfig, ScanResult, ScanStatistics, ScanStatus, OWASPTop10 } from '../types';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface DASTOptions {
  maxDepth?: number;
  maxPages?: number;
  timeout?: number;
  followRedirects?: boolean;
  auth?: AuthConfig;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  excludeUrls?: string[];
  includeUrls?: string[];
}

export interface AuthConfig {
  type: 'basic' | 'bearer' | 'form' | 'cookie';
  credentials: {
    username?: string;
    password?: string;
    token?: string;
    cookieName?: string;
    cookieValue?: string;
    loginUrl?: string;
    usernameField?: string;
    passwordField?: string;
  };
}

export interface CrawlResult {
  url: string;
  statusCode: number;
  contentType: string;
  links: string[];
  forms: Form[];
  apis: APIEndpoint[];
  headers: Record<string, string>;
}

export interface Form {
  action: string;
  method: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  type: string;
  value?: string;
  required: boolean;
}

export interface APIEndpoint {
  method: string;
  url: string;
  parameters: Parameter[];
  headers: Record<string, string>;
  authRequired: boolean;
}

export interface Parameter {
  name: string;
  type: string;
  location: 'query' | 'path' | 'header' | 'body';
  required: boolean;
}

export class DASTScanner {
  private logger: Logger;
  private client: AxiosInstance;
  private visitedUrls: Set<string>;
  private crawlQueue: string[];
  private findings: Finding[];
  private totalPages: number;

  constructor(logger: Logger, options: DASTOptions = {}) {
    this.logger = logger;
    this.visitedUrls = new Set();
    this.crawlQueue = [];
    this.findings = [];
    this.totalPages = 0;

    const clientConfig: AxiosRequestConfig = {
      timeout: options.timeout || 30000,
      maxRedirects: options.followRedirects !== false ? 5 : 0,
      validateStatus: () => true, // Don't throw on any status code
      headers: {
        'User-Agent': 'ClaudeFlare-DAST-Scanner/1.0',
        ...options.headers,
      },
    };

    if (options.auth) {
      this.applyAuth(clientConfig, options.auth);
    }

    if (options.cookies) {
      clientConfig.headers = clientConfig.headers || {};
      clientConfig.headers['Cookie'] = Object.entries(options.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }

    this.client = axios.create(clientConfig);
  }

  /**
   * Apply authentication to request
   */
  private applyAuth(config: AxiosRequestConfig, auth: AuthConfig): void {
    switch (auth.type) {
      case 'basic':
        config.auth = {
          username: auth.credentials.username || '',
          password: auth.credentials.password || '',
        };
        break;
      case 'bearer':
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${auth.credentials.token}`;
        break;
      case 'cookie':
        config.headers = config.headers || {};
        if (auth.credentials.cookieName && auth.credentials.cookieValue) {
          config.headers['Cookie'] = `${auth.credentials.cookieName}=${auth.credentials.cookieValue}`;
        }
        break;
    }
  }

  /**
   * Perform form-based authentication
   */
  private async performFormAuth(auth: AuthConfig): Promise<boolean> {
    if (!auth.credentials.loginUrl) {
      return false;
    }

    try {
      const loginPageResponse = await this.client.get(auth.credentials.loginUrl);
      const $ = cheerio.load(loginPageResponse.data);

      const formData: Record<string, string> = {};
      formData[auth.credentials.usernameField || 'username'] = auth.credentials.username || '';
      formData[auth.credentials.passwordField || 'password'] = auth.credentials.password || '';

      // Submit login form
      const response = await this.client.post(auth.credentials.loginUrl, formData, {
        maxRedirects: 0,
      });

      // Extract cookies from response
      if (response.headers['set-cookie']) {
        this.client.defaults.headers.common['Cookie'] = response.headers['set-cookie'].join('; ');
      }

      return response.status < 400;
    } catch (error) {
      this.logger.warn(`Form authentication failed: ${error}`);
      return false;
    }
  }

  /**
   * Scan a web application
   */
  public async scan(targetUrl: string, options: DASTOptions = {}): Promise<ScanResult> {
    const scanId = uuidv4();
    const startTime = new Date();
    this.logger = this.logger.withScanId(scanId);

    this.logger.info(`Starting DAST scan of ${targetUrl}`);

    try {
      // Perform authentication if configured
      if (options.auth?.type === 'form') {
        await this.performFormAuth(options.auth);
      }

      // Crawl the application
      this.crawlQueue.push(targetUrl);
      const crawlResults: CrawlResult[] = [];

      while (this.crawlQueue.length > 0 && this.totalPages < (options.maxPages || 100)) {
        const url = this.crawlQueue.shift()!;
        if (this.visitedUrls.has(url)) {
          continue;
        }

        const result = await this.crawlPage(url, options);
        if (result) {
          crawlResults.push(result);
          this.totalPages++;
        }

        this.visitedUrls.add(url);
      }

      this.logger.info(`Crawled ${this.totalPages} pages`);

      // Analyze findings from crawl
      await this.analyzeCrawlResults(crawlResults);

      // Run security tests
      await this.runSecurityTests(crawlResults, options);

      // Test discovered forms
      for (const result of crawlResults) {
        for (const form of result.forms) {
          await this.testForm(form, result.url);
        }
      }

      // Test discovered APIs
      for (const result of crawlResults) {
        for (const api of result.apis) {
          await this.testAPI(api, result.url);
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const stats = this.calculateStatistics();

      this.logger.info(`DAST scan completed in ${duration}ms`);
      this.logger.info(`Found ${this.findings.length} vulnerabilities`);

      return {
        id: scanId,
        scanType: 'dast',
        status: ScanStatus.COMPLETED,
        config: {
          target: targetUrl,
          targetType: 'url',
          enableSAST: false,
          enableDAST: true,
          enableSCA: false,
          enableCompliance: false,
          outputFormat: 'json',
        } as ScanConfig,
        findings: this.findings,
        groupedFindings: this.groupFindings(),
        stats,
        startTime,
        endTime,
        duration,
        scannerVersion: '1.0.0',
      };
    } catch (error) {
      this.logger.error(`DAST scan failed: ${error}`);
      throw error;
    }
  }

  /**
   * Crawl a single page
   */
  private async crawlPage(url: string, options: DASTOptions): Promise<CrawlResult | null> {
    try {
      this.logger.debug(`Crawling ${url}`);

      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);

      const links: string[] = [];
      const forms: Form[] = [];
      const apis: APIEndpoint[] = [];

      // Extract links
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const absoluteUrl = this.resolveUrl(href, url);
          if (this.shouldCrawl(absoluteUrl, url, options)) {
            links.push(absoluteUrl);
            if (!this.visitedUrls.has(absoluteUrl) && !this.crawlQueue.includes(absoluteUrl)) {
              this.crawlQueue.push(absoluteUrl);
            }
          }
        }
      });

      // Extract forms
      $('form').each((_, element) => {
        const form = this.extractForm(element, $, url);
        forms.push(form);
      });

      // Extract potential API endpoints
      this.extractAPIEndpoints($, url, apis);

      return {
        url,
        statusCode: response.status,
        contentType: response.headers['content-type'] || '',
        links,
        forms,
        apis,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      this.logger.warn(`Failed to crawl ${url}: ${error}`);
      return null;
    }
  }

  /**
   * Extract form information
   */
  private extractForm(element: any, $: cheerio.CheerioAPI, baseUrl: string): Form {
    const action = $(element).attr('action') || '';
    const method = ($(element).attr('method') || 'GET').toUpperCase();
    const fields: FormField[] = [];

    $(element)
      .find('input, textarea, select')
      .each((_, inputElement) => {
        const name = $(inputElement).attr('name');
        const type = ($(inputElement).attr('type') || 'text').toLowerCase();
        const value = $(inputElement).attr('value');
        const required = $(inputElement).attr('required') !== undefined;

        if (name) {
          fields.push({ name, type, value, required });
        }
      });

    return {
      action: this.resolveUrl(action, baseUrl),
      method,
      fields,
    };
  }

  /**
   * Extract API endpoints
   */
  private extractAPIEndpoints($: cheerio.CheerioAPI, baseUrl: string, apis: APIEndpoint[]): void {
    // Look for AJAX calls, fetch requests, etc.
    $('script').each((_, element) => {
      const scriptContent = $(element).html() || '';

      // Match fetch() calls
      const fetchMatches = scriptContent.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g);
      if (fetchMatches) {
        for (const match of fetchMatches) {
          const urlMatch = match.match(/['"`]([^'"`]+)['"`]/);
          if (urlMatch) {
            apis.push({
              method: 'GET',
              url: this.resolveUrl(urlMatch[1], baseUrl),
              parameters: [],
              headers: {},
              authRequired: false,
            });
          }
        }
      }

      // Match XMLHttpRequest calls
      const xhrMatches = scriptContent.match(/\.open\s*\(\s*['"`]([A-Z]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g);
      if (xhrMatches) {
        for (const match of xhrMatches) {
          const parts = match.match(/['"`]([A-Z]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/);
          if (parts) {
            apis.push({
              method: parts[1],
              url: this.resolveUrl(parts[2], baseUrl),
              parameters: [],
              headers: {},
              authRequired: false,
            });
          }
        }
      }
    });
  }

  /**
   * Resolve relative URL to absolute
   */
  private resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL should be crawled
   */
  private shouldCrawl(url: string, baseUrl: string, options: DASTOptions): boolean {
    try {
      const urlObj = new URL(url);
      const baseObj = new URL(baseUrl);

      // Only crawl same domain
      if (urlObj.hostname !== baseObj.hostname) {
        return false;
      }

      // Check exclude patterns
      if (options.excludeUrls) {
        for (const pattern of options.excludeUrls) {
          if (url.match(pattern)) {
            return false;
          }
        }
      }

      // Check include patterns
      if (options.includeUrls && options.includeUrls.length > 0) {
        return options.includeUrls.some((pattern) => url.match(pattern));
      }

      // Only crawl HTTP/HTTPS
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Analyze crawl results for security issues
   */
  private async analyzeCrawlResults(results: CrawlResult[]): Promise<void> {
    for (const result of results) {
      // Check security headers
      this.checkSecurityHeaders(result);

      // Check for information disclosure
      this.checkInformationDisclosure(result);

      // Check for Clickjacking
      this.checkClickjacking(result);
    }
  }

  /**
   * Check security headers
   */
  private checkSecurityHeaders(result: CrawlResult): void {
    const requiredHeaders = [
      { name: 'X-Frame-Options', severity: Severity.MEDIUM },
      { name: 'X-Content-Type-Options', severity: Severity.LOW },
      { name: 'Strict-Transport-Security', severity: Severity.HIGH },
      { name: 'Content-Security-Policy', severity: Severity.HIGH },
      { name: 'X-XSS-Protection', severity: Severity.LOW },
      { name: 'Referrer-Policy', severity: Severity.LOW },
      { name: 'Permissions-Policy', severity: Severity.MEDIUM },
    ];

    for (const header of requiredHeaders) {
      if (!result.headers[header.name.toLowerCase()]) {
        this.findings.push({
          id: `missing-header-${header.name}-${result.url}`,
          title: `Missing Security Header: ${header.name}`,
          description: `The ${header.name} header is not set, which may expose the application to security risks.`,
          severity: {
            level: header.severity,
            score: this.getSeverityScore(header.severity),
          },
          type: VulnerabilityType.SECURITY_MISCONFIGURATION,
          owasp: [OWASPTop10.A05_SECURITY_MISCONFIGURATION],
          confidence: 100,
          file: result.url,
          line: 0,
          column: 0,
          codeSnippet: `Response headers do not include ${header.name}`,
          remediation: `Add the ${header.name} header to server responses.`,
          references: [
            `https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/${header.name}`,
            'https://owasp.org/www-project-secure-headers/',
          ],
          scanner: 'dast',
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Check for information disclosure
   */
  private checkInformationDisclosure(result: CrawlResult): void {
    // Check for server version disclosure
    const serverHeader = result.headers['server'];
    if (serverHeader && serverHeader.length > 20) {
      this.findings.push({
        id: `server-disclosure-${result.url}`,
        title: 'Server Version Disclosure',
        description: 'The server header discloses detailed version information.',
        severity: {
          level: Severity.LOW,
          score: 2,
        },
        type: VulnerabilityType.SENSITIVE_DATA_EXPOSURE,
        confidence: 95,
        file: result.url,
        line: 0,
        column: 0,
        codeSnippet: `Server: ${serverHeader}`,
        remediation: 'Configure server to not disclose version information in headers.',
        references: [
          'https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html',
        ],
        scanner: 'dast',
        timestamp: new Date(),
      });
    }

    // Check for X-Powered-By header
    const poweredBy = result.headers['x-powered-by'];
    if (poweredBy) {
      this.findings.push({
        id: `x-powered-by-${result.url}`,
        title: 'X-Powered-By Header Disclosure',
        description: 'The X-Powered-By header discloses technology information.',
        severity: {
          level: Severity.INFO,
          score: 1,
        },
        type: VulnerabilityType.SENSITIVE_DATA_EXPOSURE,
        confidence: 100,
        file: result.url,
        line: 0,
        column: 0,
        codeSnippet: `X-Powered-By: ${poweredBy}`,
        remediation: 'Remove X-Powered-By header from server responses.',
        references: ['https://owasp.org/www-project-secure-headers/'],
        scanner: 'dast',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Check for Clickjacking vulnerabilities
   */
  private checkClickjacking(result: CrawlResult): void {
    const xFrameOptions = result.headers['x-frame-options'];
    const csp = result.headers['content-security-policy'];

    if (!xFrameOptions && (!csp || !csp.includes('frame-ancestors'))) {
      this.findings.push({
        id: `clickjacking-${result.url}`,
        title: 'Clickjacking Vulnerability',
        description: 'The page may be vulnerable to clickjacking attacks.',
        severity: {
          level: Severity.MEDIUM,
          score: 5,
        },
        type: VulnerabilityType.XSS,
        owasp: [OWASPTop10.A05_SECURITY_MISCONFIGURATION],
        confidence: 80,
        file: result.url,
        line: 0,
        column: 0,
        codeSnippet: 'Missing X-Frame-Options and CSP frame-ancestors',
        remediation: 'Add X-Frame-Options or Content-Security-Policy with frame-ancestors directive.',
        references: [
          'https://owasp.org/www-community/attacks/Clickjacking',
          'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options',
        ],
        scanner: 'dast',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Run security tests
   */
  private async runSecurityTests(results: CrawlResult[], options: DASTOptions): Promise<void> {
    for (const result of results) {
      // Test for SQL injection
      await this.testSQLInjection(result);

      // Test for XSS
      await this.testXSS(result);

      // Test for path traversal
      await this.testPathTraversal(result);

      // Test for CSRF
      await this.testCSRF(result);

      // Test for IDOR
      await this.testIDOR(result);

      // Test for rate limiting
      await this.testRateLimiting(result);
    }
  }

  /**
   * Test for SQL injection
   */
  private async testSQLInjection(result: CrawlResult): Promise<void> {
    const payloads = [
      "' OR '1'='1",
      "' OR '1'='1'--",
      "' OR '1'='1'/*",
      "1' OR '1'='1",
      "admin'--",
      "admin'/*",
      "' UNION SELECT NULL--",
      "1' ORDER BY 1--",
    ];

    for (const form of result.forms) {
      for (const field of form.fields) {
        if (field.type === 'text' || field.type === 'search' || field.type === 'email') {
          for (const payload of payloads) {
            try {
              const formData: Record<string, string> = {};
              formData[field.name] = payload;

              const response = await this.client.post(form.action, formData);

              // Check for SQL error patterns
              const errorPatterns = [
                /SQL syntax.*MySQL/i,
                /Warning.*mysql_/i,
                /PostgreSQL.*ERROR/i,
                /Oracle.*ORA-/i,
                /Microsoft SQL Server/i,
                /SQLite3::SQLException/i,
              ];

              for (const pattern of errorPatterns) {
                if (pattern.test(response.data)) {
                  this.findings.push({
                    id: `sqli-${result.url}-${field.name}`,
                    title: 'SQL Injection Vulnerability',
                    description: `SQL injection vulnerability detected in field '${field.name}'`,
                    severity: {
                      level: Severity.CRITICAL,
                      score: 10,
                    },
                    type: VulnerabilityType.SQL_INJECTION,
                    cwe: [{ id: 89, name: 'SQL Injection', description: '', url: '' }],
                    owasp: [OWASPTop10.A03_INJECTION],
                    confidence: 90,
                    file: form.action,
                    line: 0,
                    column: 0,
                    codeSnippet: `Field: ${field.name}, Payload: ${payload}`,
                    remediation: 'Use parameterized queries or prepared statements.',
                    references: [
                      'https://owasp.org/www-community/attacks/SQL_Injection',
                      'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
                    ],
                    scanner: 'dast',
                    timestamp: new Date(),
                    metadata: {
                      payload,
                      field: field.name,
                      responseSnippet: response.data.substring(0, 200),
                    },
                  });
                  break;
                }
              }
            } catch (error) {
              // Ignore errors during testing
            }
          }
        }
      }
    }
  }

  /**
   * Test for XSS
   */
  private async testXSS(result: CrawlResult): Promise<void> {
    const payloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
    ];

    for (const form of result.forms) {
      for (const field of form.fields) {
        if (field.type === 'text' || field.type === 'search' || field.type === 'textarea') {
          for (const payload of payloads) {
            try {
              const formData: Record<string, string> = {};
              formData[field.name] = payload;

              const response = await this.client.post(form.action, formData);

              // Check if payload is reflected in response
              if (response.data.includes(payload) || response.data.includes(payload.replace(/"/g, '&quot;'))) {
                this.findings.push({
                  id: `xss-${result.url}-${field.name}`,
                  title: 'Cross-Site Scripting (XSS) Vulnerability',
                  description: `XSS vulnerability detected in field '${field.name}'`,
                  severity: {
                    level: Severity.HIGH,
                    score: 8,
                  },
                  type: VulnerabilityType.XSS,
                  cwe: [{ id: 79, name: 'Cross-site Scripting', description: '', url: '' }],
                  owasp: [OWASPTop10.A03_INJECTION],
                  confidence: 85,
                  file: form.action,
                  line: 0,
                  column: 0,
                  codeSnippet: `Field: ${field.name}, Payload: ${payload}`,
                  remediation: 'Sanitize user input before rendering in HTML.',
                  references: [
                    'https://owasp.org/www-community/attacks/xss/',
                    'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
                  ],
                  scanner: 'dast',
                  timestamp: new Date(),
                  metadata: {
                    payload,
                    field: field.name,
                  },
                });
              }
            } catch (error) {
              // Ignore errors during testing
            }
          }
        }
      }
    }
  }

  /**
   * Test for path traversal
   */
  private async testPathTraversal(result: CrawlResult): Promise<void> {
    const payloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....//....//....//etc/passwd',
      '%2e%2e%2fetc%2fpasswd',
    ];

    for (const form of result.forms) {
      for (const field of form.fields) {
        if (field.type === 'text' || field.type === 'file') {
          for (const payload of payloads) {
            try {
              const formData: Record<string, string> = {};
              formData[field.name] = payload;

              const response = await this.client.post(form.action, formData);

              // Check for successful path traversal indicators
              const successPatterns = [
                /root:x:0:0:/i,
                /administrators/i,
                /www-data/i,
              ];

              for (const pattern of successPatterns) {
                if (pattern.test(response.data)) {
                  this.findings.push({
                    id: `pathtraversal-${result.url}-${field.name}`,
                    title: 'Path Traversal Vulnerability',
                    description: `Path traversal vulnerability detected in field '${field.name}'`,
                    severity: {
                      level: Severity.HIGH,
                      score: 7,
                    },
                    type: VulnerabilityType.PATH_TRAVERSAL,
                    cwe: [{ id: 22, name: 'Path Traversal', description: '', url: '' }],
                    owasp: [OWASPTop10.A01_BROKEN_ACCESS_CONTROL],
                    confidence: 85,
                    file: form.action,
                    line: 0,
                    column: 0,
                    codeSnippet: `Field: ${field.name}, Payload: ${payload}`,
                    remediation: 'Validate and sanitize file paths. Use a whitelist of allowed files.',
                    references: [
                      'https://owasp.org/www-community/attacks/Path_Traversal',
                      'https://cheatsheetseries.owasp.org/cheatsheets/File_Inclusion_Cheat_Sheet.html',
                    ],
                    scanner: 'dast',
                    timestamp: new Date(),
                    metadata: {
                      payload,
                      field: field.name,
                    },
                  });
                  break;
                }
              }
            } catch (error) {
              // Ignore errors during testing
            }
          }
        }
      }
    }
  }

  /**
   * Test for CSRF
   */
  private async testCSRF(result: CrawlResult): Promise<void> {
    for (const form of result.forms) {
      // Check for CSRF token
      const hasCSRFToken = form.fields.some(
        (field) => field.name.toLowerCase().includes('csrf') || field.name.toLowerCase().includes('token')
      );

      if (!hasCSRFToken && form.method === 'POST') {
        this.findings.push({
          id: `csrf-${result.url}`,
          title: 'Missing CSRF Token',
          description: `Form at ${form.action} does not have CSRF protection`,
          severity: {
            level: Severity.MEDIUM,
            score: 6,
          },
          type: VulnerabilityType.CSRF,
          cwe: [{ id: 352, name: 'Cross-Site Request Forgery', description: '', url: '' }],
          owasp: [OWASPTop10.A01_BROKEN_ACCESS_CONTROL],
          confidence: 70,
          file: form.action,
          line: 0,
          column: 0,
          codeSnippet: `Form action: ${form.action}, Method: ${form.method}`,
          remediation: 'Add CSRF tokens to all state-changing forms.',
          references: [
            'https://owasp.org/www-community/attacks/csrf',
            'https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html',
          ],
          scanner: 'dast',
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Test for IDOR
   */
  private async testIDOR(result: CrawlResult): Promise<void> {
    // Look for ID patterns in URLs
    const idPattern = /\/(\d+)\//;
    const match = result.url.match(idPattern);

    if (match) {
      const originalId = match[1];
      const modifiedId = parseInt(originalId) + 1;
      const testUrl = result.url.replace(originalId, modifiedId.toString());

      try {
        const response = await this.client.get(testUrl);

        // If we get a 200 response with data, might be IDOR
        if (response.status === 200 && response.data.length > 100) {
          this.findings.push({
            id: `idor-${result.url}`,
            title: 'Potential Insecure Direct Object Reference',
            description: 'ID in URL may be accessible without proper authorization',
            severity: {
              level: Severity.MEDIUM,
              score: 6,
            },
            type: VulnerabilityType.AUTHORIZATION_BYPASS,
            cwe: [{ id: 639, name: 'Insecure Direct Object Reference', description: '', url: '' }],
            owasp: [OWASPTop10.A01_BROKEN_ACCESS_CONTROL],
            confidence: 60,
            file: result.url,
            line: 0,
            column: 0,
            codeSnippet: `Original ID: ${originalId}, Modified ID: ${modifiedId}`,
            remediation: 'Implement proper access control checks for all direct object references.',
            references: [
              'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authorization_Testing/04.1-Testing_for_Insecure_Direct_Object_References',
            ],
            scanner: 'dast',
            timestamp: new Date(),
          });
        }
      } catch (error) {
        // Ignore errors
      }
    }
  }

  /**
   * Test for rate limiting
   */
  private async testRateLimiting(result: CrawlResult): Promise<void> {
    const requestsPerSecond = 10;
    const duration = 2000; // 2 seconds
    const requests = [];

    for (let i = 0; i < requestsPerSecond; i++) {
      requests.push(this.client.get(result.url));
    }

    try {
      const responses = await Promise.all(requestes);
      const successCount = responses.filter((r) => r.status === 200).length;

      if (successCount === requestsPerSecond) {
        this.findings.push({
          id: `ratelimit-${result.url}`,
          title: 'Missing Rate Limiting',
          description: 'Endpoint does not appear to have rate limiting',
          severity: {
            level: Severity.MEDIUM,
            score: 5,
          },
          type: VulnerabilityType.DOS,
          cwe: [{ id: 770, name: 'Allocation of Resources Without Limits', description: '', url: '' }],
          owasp: [OWASPTop10.A04_INSECURE_DESIGN],
          confidence: 70,
          file: result.url,
          line: 0,
          column: 0,
          codeSnippet: `${requestsPerSecond} successful requests in ${duration}ms`,
          remediation: 'Implement rate limiting on all endpoints.',
          references: [
            'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/10.2-Testing_for_No_Rate_Limiting',
          ],
          scanner: 'dast',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      // If rate limiting is working, we'll get 429 errors
    }
  }

  /**
   * Test a form
   */
  private async testForm(form: Form, baseUrl: string): Promise<void> {
    // Form testing is done in runSecurityTests
  }

  /**
   * Test an API endpoint
   */
  private async testAPI(api: APIEndpoint, baseUrl: string): Promise<void> {
    // API testing logic
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(): ScanStatistics {
    const stats: ScanStatistics = {
      total: this.findings.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      filesScanned: this.visitedUrls.size,
      linesScanned: 0,
      vulnerabilitiesFound: this.findings.length,
      falsePositiveRate: 0,
    };

    for (const finding of this.findings) {
      switch (finding.severity.level) {
        case Severity.CRITICAL:
          stats.critical++;
          break;
        case Severity.HIGH:
          stats.high++;
          break;
        case Severity.MEDIUM:
          stats.medium++;
          break;
        case Severity.LOW:
          stats.low++;
          break;
        case Severity.INFO:
          stats.info++;
          break;
      }
    }

    return stats;
  }

  /**
   * Group findings
   */
  private groupFindings(): any[] {
    const groups = new Map<string, any>();

    for (const finding of this.findings) {
      const key = `${finding.type}-${finding.severity.level}`;
      if (!groups.has(key)) {
        groups.set(key, {
          type: finding.type,
          severity: finding.severity.level,
          findings: [],
          count: 0,
          files: new Set<string>(),
        });
      }
      const group = groups.get(key);
      group.findings.push(finding);
      group.count++;
      group.files.add(finding.file);
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      files: Array.from(group.files),
    }));
  }

  /**
   * Get severity score
   */
  private getSeverityScore(severity: Severity): number {
    switch (severity) {
      case Severity.CRITICAL:
        return 10;
      case Severity.HIGH:
        return 8;
      case Severity.MEDIUM:
        return 5;
      case Severity.LOW:
        return 3;
      case Severity.INFO:
        return 1;
      default:
        return 0;
    }
  }
}
