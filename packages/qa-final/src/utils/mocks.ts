/**
 * Mock utilities for QA framework
 */

import { Page, APIRequestContext, Request } from '@playwright/test';
import type { MockServer, MockEndpoint, MockConfig, Call, RequestSpec, ResponseSpec } from './types';

/**
 * In-memory mock server implementation
 */
export class InMemoryMockServer implements MockServer {
  private endpoints = new Map<string, MockEndpoint>();
  private started = false;

  constructor(private baseUrl: string) {}

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.endpoints.clear();
    this.started = false;
  }

  reset(): void {
    this.endpoints.forEach(endpoint => {
      endpoint.calls = [];
    });
  }

  getEndpoint(path: string): MockEndpoint | undefined {
    return this.endpoints.get(path);
  }

  addEndpoint(endpoint: MockEndpoint): void {
    this.endpoints.set(`${endpoint.method}:${endpoint.path}`, endpoint);
  }

  findEndpoint(method: string, path: string): MockEndpoint | undefined {
    return this.endpoints.get(`${method}:${path}`);
  }

  recordCall(method: string, path: string, request: RequestSpec, response: ResponseSpec): void {
    const endpoint = this.findEndpoint(method, path);
    if (endpoint) {
      endpoint.calls.push({
        timestamp: new Date(),
        request,
        response
      });
    }
  }
}

/**
 * Mock factory for creating test mocks
 */
export class MockFactory {
  private server: InMemoryMockServer;

  constructor(baseUrl: string) {
    this.server = new InMemoryMockServer(baseUrl);
  }

  /**
   * Create a mock endpoint
   */
  createEndpoint(
    method: string,
    path: string,
    config: MockConfig = {}
  ): MockEndpoint {
    const endpoint: MockEndpoint = {
      path,
      method,
      config,
      calls: []
    };

    this.server.addEndpoint(endpoint);
    return endpoint;
  }

  /**
   * Mock a GET request
   */
  mockGet(path: string, response: unknown, status = 200): MockEndpoint {
    return this.createEndpoint('GET', path, { response, status });
  }

  /**
   * Mock a POST request
   */
  mockPost(path: string, response: unknown, status = 201): MockEndpoint {
    return this.createEndpoint('POST', path, { response, status });
  }

  /**
   * Mock a PUT request
   */
  mockPut(path: string, response: unknown, status = 200): MockEndpoint {
    return this.createEndpoint('PUT', path, { response, status });
  }

  /**
   * Mock a DELETE request
   */
  mockDelete(path: string, response: unknown, status = 204): MockEndpoint {
    return this.createEndpoint('DELETE', path, { response, status });
  }

  /**
   * Mock a PATCH request
   */
  mockPatch(path: string, response: unknown, status = 200): MockEndpoint {
    return this.createEndpoint('PATCH', path, { response, status });
  }

  /**
   * Mock an error response
   */
  mockError(path: string, error: Error, status = 500): MockEndpoint {
    return this.createEndpoint('GET', path, { error, status });
  }

  /**
   * Mock a delayed response
   */
  mockDelayed(
    method: string,
    path: string,
    response: unknown,
    delay: number
  ): MockEndpoint {
    return this.createEndpoint(method, path, { response, delay });
  }

  /**
   * Get the mock server
   */
  getServer(): InMemoryMockServer {
    return this.server;
  }
}

/**
 * API mock interceptor for Playwright
 */
export class ApiMockInterceptor {
  private mockFactory: MockFactory;

  constructor(baseUrl: string) {
    this.mockFactory = new MockFactory(baseUrl);
  }

  /**
   * Setup API mocking for a page
   */
  async setupForPage(page: Page): Promise<void> {
    await page.route('**/*', async (route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      const path = url.pathname + url.search;

      const endpoint = this.mockFactory.getServer().findEndpoint(method, path);

      if (endpoint) {
        const { config } = endpoint;

        // Apply delay if configured
        if (config.delay) {
          await new Promise(resolve => setTimeout(resolve, config.delay));
        }

        // Throw error if configured
        if (config.error) {
          await route.abort();
          return;
        }

        // Return mock response
        const status = config.status || 200;
        const headers = config.headers || { 'Content-Type': 'application/json' };
        const body = JSON.stringify(config.response);

        await route.fulfill({
          status,
          headers,
          body
        });

        // Record the call
        this.mockFactory.getServer().recordCall(
          method,
          path,
          {
            method,
            path,
            headers: request.headers(),
            body: request.postData()
          },
          {
            status,
            headers,
            body: config.response
          }
        );
      } else {
        // Continue with normal request if not mocked
        await route.continue();
      }
    });
  }

  /**
   * Setup API mocking for API request context
   */
  async setupForAPIRequest(request: APIRequestContext): Promise<void> {
    // Note: Playwright's APIRequestContext doesn't support routing
    // This would need to be implemented differently
  }

  /**
   * Get the mock factory
   */
  getMockFactory(): MockFactory {
    return this.mockFactory;
  }
}

/**
 * Data mock generator
 */
export class DataMockGenerator {
  /**
   * Generate mock user data
   */
  static user(overrides = {}) {
    return {
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Generate mock project data
   */
  static project(overrides = {}) {
    return {
      id: 'project-123',
      name: 'Test Project',
      description: 'A test project',
      owner: 'user-123',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Generate mock session data
   */
  static session(overrides = {}) {
    return {
      id: 'session-123',
      userId: 'user-123',
      token: 'mock-token-abc123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Generate mock API response
   */
  static apiResponse<T>(data: T, meta = {}) {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'req-123',
        ...meta
      }
    };
  }

  /**
   * Generate mock error response
   */
  static errorResponse(message: string, code = 'ERROR', status = 400) {
    return {
      success: false,
      error: {
        code,
        message,
        status
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'req-123'
      }
    };
  }

  /**
   * Generate mock pagination response
   */
  static paginatedResponse<T>(
    items: T[],
    page = 1,
    pageSize = 10,
    total?: number
  ) {
    return {
      items,
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil((total || items.length) / pageSize),
        total: total || items.length,
        hasNext: page * pageSize < (total || items.length),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Generate array of mock items
   */
  static arrayOf<T>(generator: () => T, count: number): T[] {
    return Array.from({ length: count }, generator);
  }

  /**
   * Generate mock file data
   */
  static file(overrides = {}) {
    return {
      id: 'file-123',
      name: 'test-file.txt',
      size: 1024,
      type: 'text/plain',
      url: 'https://example.com/files/test-file.txt',
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Generate mock webhook data
   */
  static webhook(overrides = {}) {
    return {
      id: 'webhook-123',
      url: 'https://example.com/webhooks/test',
      events: ['user.created', 'user.updated'],
      secret: 'webhook-secret-123',
      active: true,
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Generate mock log data
   */
  static log(overrides = {}) {
    return {
      id: 'log-123',
      level: 'info',
      message: 'Test log message',
      timestamp: new Date().toISOString(),
      metadata: {},
      ...overrides
    };
  }

  /**
   * Generate mock metric data
   */
  static metric(overrides = {}) {
    return {
      name: 'test-metric',
      value: 100,
      timestamp: new Date().toISOString(),
      labels: {},
      ...overrides
    };
  }
}

/**
 * Network condition mocker
 */
export class NetworkConditionMocker {
  /**
   * Mock slow network
   */
  static async mockSlowNetwork(page: Page, options = {
    download: 500 * 1024, // 500 KB/s
    upload: 500 * 1024,   // 500 KB/s
    latency: 100          // 100ms
  }): Promise<void> {
    const context = page.context();
    await context.route('**/*', async (route) => {
      // Simulate latency
      await new Promise(resolve => setTimeout(resolve, options.latency));
      await route.continue();
    });
  }

  /**
   * Mock offline mode
   */
  static async mockOffline(page: Page): Promise<void> {
    await page.context().setOffline(true);
  }

  /**
   * Mock online mode
   */
  static async mockOnline(page: Page): Promise<void> {
    await page.context().setOffline(false);
  }

  /**
   * Mock specific response code
   */
  static async mockResponseCode(
    page: Page,
    urlPattern: string,
    statusCode: number
  ): Promise<void> {
    await page.route(urlPattern, route => {
      route.fulfill({
        status: statusCode,
        body: JSON.stringify({ error: 'Mock error' })
      });
    });
  }
}

/**
 * Geolocation mocker
 */
export class GeolocationMocker {
  /**
   * Mock geolocation coordinates
   */
  static async mockGeolocation(
    page: Page,
    latitude: number,
    longitude: number,
    accuracy = 100
  ): Promise<void> {
    const context = page.context();
    await context.setGeolocation({ latitude, longitude, accuracy });
    await page.addInitScript(() => {
      // @ts-ignore
      window.navigator.geolocation.getCurrentPosition = success =>
        success({
          coords: {
            latitude,
            longitude,
            accuracy
          },
          timestamp: Date.now()
        });
    });
  }

  /**
   * Mock specific location
   */
  static async mockLocation(
    page: Page,
    location: 'New York' | 'London' | 'Tokyo' | 'San Francisco'
  ): Promise<void> {
    const locations = {
      'New York': { latitude: 40.7128, longitude: -74.0060 },
      'London': { latitude: 51.5074, longitude: -0.1278 },
      'Tokyo': { latitude: 35.6762, longitude: 139.6503 },
      'San Francisco': { latitude: 37.7749, longitude: -122.4194 }
    };

    const coords = locations[location];
    await this.mockGeolocation(page, coords.latitude, coords.longitude);
  }
}

/**
 * Device mocker
 */
export class DeviceMocker {
  /**
   * Mock mobile device
   */
  static async mockMobile(page: Page): Promise<void> {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      });
    });
  }

  /**
   * Mock tablet device
   */
  static async mockTablet(page: Page): Promise<void> {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.addInitScript(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      });
    });
  }

  /**
   * Mock desktop device
   */
  static async mockDesktop(page: Page): Promise<void> {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
    });
  }
}

/**
 * Time mocker
 */
export class TimeMocker {
  /**
   * Mock system time
   */
  static async mockTime(page: Page, date: Date): Promise<void> {
    const timestamp = date.getTime();
    await page.addInitScript(`{
      // @ts-ignore
      const originalDate = window.Date;
      // @ts-ignore
      window.Date = new Proxy(originalDate, {
        construct: () => new originalDate(${timestamp}),
        get: (target, prop) => {
          if (prop === 'now') {
            return () => ${timestamp};
          }
          return target[prop];
        }
      });
    }`);
  }

  /**
   * Mock time zone
   */
  static async mockTimeZone(page: Page, timeZone: string): Promise<void> {
    await page.emulateMedia({ timezone: timeZone });
  }
}

/**
 * Storage mocker
 */
export class StorageMocker {
  /**
   * Mock localStorage
   */
  static async mockLocalStorage(page: Page, data: Record<string, string>): Promise<void> {
    await page.addInitScript(data => {
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    }, data);
  }

  /**
   * Mock sessionStorage
   */
  static async mockSessionStorage(page: Page, data: Record<string, string>): Promise<void> {
    await page.addInitScript(data => {
      Object.entries(data).forEach(([key, value]) => {
        sessionStorage.setItem(key, value);
      });
    }, data);
  }

  /**
   * Clear all storage
   */
  static async clearStorage(page: Page): Promise<void> {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();
  }
}
