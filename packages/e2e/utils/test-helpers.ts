import { Page, Locator } from '@playwright/test';

/**
 * Test helper utilities for E2E tests
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for API response
   */
  async waitForApiResponse(urlPattern: string | RegExp) {
    return this.page.waitForResponse(response => {
      return typeof urlPattern === 'string'
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url());
    });
  }

  /**
   * Fill form with data
   */
  async fillForm(formSelector: string, data: Record<string, string>) {
    for (const [field, value] of Object.entries(data)) {
      const input = this.page.locator(`${formSelector} [name="${field}"]`);
      await input.fill(value);
    }
  }

  /**
   * Take screenshot with name
   */
  async screenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true
    });
  }

  /**
   * Login with credentials
   */
  async login(email: string, password: string) {
    await this.page.goto('/auth/login');
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('/dashboard');
  }

  /**
   * Wait for toast notification
   */
  async waitForToast() {
    return this.page.waitForSelector('[data-testid="toast"]', { timeout: 5000 });
  }

  /**
   * Get toast message
   */
  async getToastMessage(): Promise<string> {
    const toast = await this.waitForToast();
    return await toast.textContent() || '';
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoading() {
    await this.page.waitForSelector('[data-testid="loading"]', { state: 'hidden' });
  }

  /**
   * Navigate to page and wait for load
   */
  async navigateTo(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
    await this.waitForLoading();
  }

  /**
   * Click element and wait for navigation
   */
  async clickAndWait(element: Locator) {
    await Promise.all([
      this.page.waitForLoadState('networkidle'),
      element.click()
    ]);
  }

  /**
   * Get text content from element
   */
  async getText(selector: string): Promise<string> {
    return await this.page.locator(selector).textContent() || '';
  }

  /**
   * Check if element exists
   */
  async exists(selector: string): Promise<boolean> {
    return await this.page.locator(selector).count() > 0;
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(selector: string, timeout = 5000) {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(selector: string, timeout = 5000) {
    await this.page.waitForSelector(selector, { state: 'hidden', timeout });
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Reload page
   */
  async reload() {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Execute JavaScript in page context
   */
  async evaluate<T>(fn: () => T): Promise<T> {
    return await this.page.evaluate(fn);
  }

  /**
   * Mock API response
   */
  async mockApi(endpoint: string, response: any) {
    await this.page.route(`**/${endpoint}`, route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(response),
        headers: { 'Content-Type': 'application/json' }
      });
    });
  }

  /**
   * Intercept and log API requests
   */
  async interceptApi(endpoint: string) {
    const requests: any[] = [];
    this.page.on('request', request => {
      if (request.url().includes(endpoint)) {
        requests.push({
          method: request.method(),
          url: request.url(),
          headers: request.headers()
        });
      }
    });
    return requests;
  }

  /**
   * Set viewport size
   */
  async setViewport(width: number, height: number) {
    await this.page.setViewportSize({ width, height });
  }

  /**
   * Hover over element
   */
  async hover(selector: string) {
    await this.page.hover(selector);
  }

  /**
   * Select dropdown option
   */
  async selectOption(selector: string, value: string) {
    await this.page.selectOption(selector, value);
  }

  /**
   * Upload file
   */
  async uploadFile(selector: string, filePath: string) {
    await this.page.setInputFiles(selector, filePath);
  }

  /**
   * Get element count
   */
  async getCount(selector: string): Promise<number> {
    return await this.page.locator(selector).count();
  }

  /**
   * Check checkbox
   */
  async check(selector: string) {
    await this.page.check(selector);
  }

  /**
   * Uncheck checkbox
   */
  async uncheck(selector: string) {
    await this.page.uncheck(selector);
  }

  /**
   * Get attribute value
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    return await this.page.getAttribute(selector, attribute);
  }

  /**
   * Wait for URL to contain
   */
  async waitForUrl(url: string) {
    await this.page.waitForURL(url);
  }

  /**
   * Go back
   */
  async goBack() {
    await this.page.goBack();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Go forward
   */
  async goForward() {
    await this.page.goForward();
    await this.page.waitForLoadState('networkidle');
  }
}

/**
 * Generate random test data
 */
export class TestDataGenerator {
  /**
   * Generate random email
   */
  static email(prefix = 'test'): string {
    const random = Math.random().toString(36).substring(7);
    return `${prefix}-${random}@example.com`;
  }

  /**
   * Generate random password
   */
  static password(length = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Generate random string
   */
  static string(length = 10): string {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  /**
   * Generate random number
   */
  static number(min = 0, max = 1000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random project name
   */
  static projectName(): string {
    const adjectives = ['Awesome', 'Brilliant', 'Creative', 'Dynamic', 'Epic'];
    const nouns = ['Project', 'App', 'System', 'Platform', 'Solution'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
  }

  /**
   * Generate random code snippet
   */
  static codeSnippet(): string {
    return `function ${this.string()}() {
  console.log('${this.string()}');
  return ${this.number()};
}`;
  }

  /**
   * Generate random chat message
   */
  static chatMessage(): string {
    const messages = [
      'How do I create a new component?',
      'Can you help me debug this issue?',
      'Write a function to sort an array',
      'Explain this code to me',
      'Generate a REST API endpoint'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

/**
 * API client for testing
 */
export class TestApiClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  /**
   * Make GET request
   */
  async get(endpoint: string, headers: Record<string, string> = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...headers
      }
    });
    return response.json();
  }

  /**
   * Make POST request
   */
  async post(endpoint: string, data: any, headers: Record<string, string> = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  /**
   * Make PUT request
   */
  async put(endpoint: string, data: any, headers: Record<string, string> = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  /**
   * Make DELETE request
   */
  async delete(endpoint: string, headers: Record<string, string> = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...headers
      }
    });
    return response.json();
  }
}
