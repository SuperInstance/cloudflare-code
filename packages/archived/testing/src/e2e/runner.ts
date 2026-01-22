/**
 * E2E Testing Framework - Browser automation with Playwright
 */

import type { Browser, Page, BrowserContext } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import type {
  E2ETestOptions,
  PageAction,
  E2ETestFlow,
  TestFunction,
  TestContext,
  TestMetadata,
} from '../types/index.js';

// ============================================================================
// Browser Manager
// ============================================================================

export class BrowserManager {
  private browsers = new Map<string, Browser>();
  private contexts = new Map<string, BrowserContext>();
  private pages = new Map<string, Page>();

  async launch(options: E2ETestOptions = {}): Promise<Browser> {
    const browserType = options.browser || 'chromium';
    const browserName = `${browserType}-${Date.now()}`;

    let browser: Browser;
    switch (browserType) {
      case 'chromium':
        browser = await chromium.launch({
          headless: options.headless !== false,
        });
        break;
      case 'firefox':
        browser = await firefox.launch({
          headless: options.headless !== false,
        });
        break;
      case 'webkit':
        browser = await webkit.launch({
          headless: options.headless !== false,
        });
        break;
      default:
        throw new Error(`Unsupported browser: ${browserType}`);
    }

    this.browsers.set(browserName, browser);
    return browser;
  }

  async createContext(browser: Browser, options?: {
    viewport?: { width: number; height: number };
    baseURL?: string;
  }): Promise<BrowserContext> {
    const context = await browser.newContext({
      viewport: options?.viewport || { width: 1280, height: 720 },
      baseURL: options?.baseURL,
    });

    const contextId = `context-${Date.now()}`;
    this.contexts.set(contextId, context);

    return context;
  }

  async createPage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    const pageId = `page-${Date.now()}`;
    this.pages.set(pageId, page);
    return page;
  }

  async closeBrowser(browser: Browser): Promise<void> {
    await browser.close();
    for (const [id, b] of this.browsers) {
      if (b === browser) {
        this.browsers.delete(id);
        break;
      }
    }
  }

  async closeContext(context: BrowserContext): Promise<void> {
    await context.close();
    for (const [id, c] of this.contexts) {
      if (c === context) {
        this.contexts.delete(id);
        break;
      }
    }
  }

  async closeAll(): Promise<void> {
    for (const browser of this.browsers.values()) {
      await browser.close();
    }
    this.browsers.clear();
    this.contexts.clear();
    this.pages.clear();
  }
}

// ============================================================================
// Page Actions
// ============================================================================

export class PageActionExecutor {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async execute(action: PageAction): Promise<void> {
    switch (action.type) {
      case 'click':
        await this.click(action.selector!, action.options);
        break;

      case 'fill':
        await this.fill(action.selector!, action.value!, action.options);
        break;

      case 'select':
        await this.select(action.selector!, action.value!, action.options);
        break;

      case 'hover':
        await this.hover(action.selector!, action.options);
        break;

      case 'navigate':
        await this.navigate(action.value!);
        break;

      case 'waitFor':
        await this.waitFor(action.selector!, action.options);
        break;

      case 'screenshot':
        await this.screenshot(action.options);
        break;

      case 'assert':
        await this.assert(action.selector!, action.value!, action.options);
        break;

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  async executeMultiple(actions: PageAction[]): Promise<void> {
    for (const action of actions) {
      await this.execute(action);
    }
  }

  private async click(selector: string, options?: Record<string, unknown>): Promise<void> {
    await this.page.click(selector, options);
  }

  private async fill(selector: string, value: string, options?: Record<string, unknown>): Promise<void> {
    await this.page.fill(selector, value, options);
  }

  private async select(selector: string, value: string, options?: Record<string, unknown>): Promise<void> {
    await this.page.selectOption(selector, value, options);
  }

  private async hover(selector: string, options?: Record<string, unknown>): Promise<void> {
    await this.page.hover(selector, options);
  }

  private async navigate(url: string): Promise<void> {
    await this.page.goto(url);
  }

  private async waitFor(selector: string, options?: Record<string, unknown>): Promise<void> {
    await this.page.waitForSelector(selector, options);
  }

  private async screenshot(options?: Record<string, unknown>): Promise<void> {
    await this.page.screenshot(options);
  }

  private async assert(selector: string, assertion: string, options?: Record<string, unknown>): Promise<void> {
    const assertionParts = assertion.split(' ');
    const [assertionType, ...expectedParts] = assertionParts;
    const expected = expectedParts.join(' ');

    switch (assertionType) {
      case 'visible':
        await this.page.waitForSelector(selector, { state: 'visible', ...options });
        break;

      case 'hidden':
        await this.page.waitForSelector(selector, { state: 'hidden', ...options });
        break;

      case 'text':
        const text = await this.page.textContent(selector);
        if (!text?.includes(expected)) {
          throw new Error(`Expected text "${expected}" not found in element "${selector}"`);
        }
        break;

      case 'attribute':
        const [attrName, attrValue] = expected.split('=');
        const attr = await this.page.getAttribute(selector, attrName);
        if (attr !== attrValue) {
          throw new Error(`Expected attribute "${attrName}" to be "${attrValue}", got "${attr}"`);
        }
        break;

      case 'count':
        const count = await this.page.locator(selector).count();
        const expectedCount = parseInt(expected, 10);
        if (count !== expectedCount) {
          throw new Error(`Expected ${expectedCount} elements, found ${count}`);
        }
        break;

      default:
        throw new Error(`Unknown assertion type: ${assertionType}`);
    }
  }
}

// ============================================================================
// E2E Test Flow Runner
// ============================================================================

export class E2EFlowRunner {
  private browserManager: BrowserManager;
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private actionExecutor?: PageActionExecutor;

  constructor() {
    this.browserManager = new BrowserManager();
  }

  async run(flow: E2ETestFlow, options: E2ETestOptions = {}): Promise<void> {
    try {
      // Launch browser
      this.browser = await this.browserManager.launch(options);
      this.context = await this.browserManager.createContext(this.browser, {
        viewport: options.viewport,
        baseURL: options.baseURL,
      });
      this.page = await this.browserManager.createPage(this.context);
      this.actionExecutor = new PageActionExecutor(this.page);

      // Navigate to starting URL
      await this.page.goto(flow.url);

      // Execute actions
      if (flow.actions) {
        await this.actionExecutor.executeMultiple(flow.actions);
      }

      // Execute assertions
      if (flow.assertions) {
        await this.actionExecutor.executeMultiple(flow.assertions);
      }
    } finally {
      await this.cleanup();
    }
  }

  async runMultiple(flows: E2ETestFlow[], options: E2ETestOptions = {}): Promise<void> {
    for (const flow of flows) {
      await this.run(flow, options);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = undefined;
    }
    if (this.context) {
      await this.browserManager.closeContext(this.context);
      this.context = undefined;
    }
    if (this.browser) {
      await this.browserManager.closeBrowser(this.browser);
      this.browser = undefined;
    }
  }

  async closeAll(): Promise<void> {
    await this.browserManager.closeAll();
  }
}

// ============================================================================
// Visual Regression Testing
// ============================================================================

export interface VisualRegressionOptions {
  threshold?: number;
  maxDiffPixels?: number;
  ignoreAreas?: Array<{ x: number; y: number; width: number; height: number }>;
  ignoreColors?: boolean;
}

export class VisualRegressionTester {
  private screenshots = new Map<string, Buffer>();
  private options: VisualRegressionOptions;

  constructor(options: VisualRegressionOptions = {}) {
    this.options = {
      threshold: 0.2,
      maxDiffPixels: 100,
      ignoreAreas: [],
      ignoreColors: false,
      ...options,
    };
  }

  async captureScreenshot(page: Page, name: string): Promise<void> {
    const screenshot = await page.screenshot() as Buffer;
    this.screenshots.set(name, screenshot);
  }

  async compareScreenshots(name1: string, name2: string): Promise<boolean> {
    const shot1 = this.screenshots.get(name1);
    const shot2 = this.screenshots.get(name2);

    if (!shot1 || !shot2) {
      throw new Error('Screenshot not found');
    }

    // Simple comparison - in production you'd use a proper image diff library
    return shot1.equals(shot2);
  }

  async assertMatchesBaseline(page: Page, name: string): Promise<void> {
    const current = await page.screenshot() as Buffer;
    const baseline = this.screenshots.get(name);

    if (!baseline) {
      // Save as baseline if it doesn't exist
      this.screenshots.set(name, current);
      return;
    }

    const matches = this.compareImages(current, baseline);
    if (!matches) {
      throw new Error(`Screenshot "${name}" does not match baseline`);
    }
  }

  private compareImages(img1: Buffer, img2: Buffer): boolean {
    // Placeholder for actual image comparison
    // In production, you'd use a library like 'pixelmatch' or 'looks-same'
    return img1.equals(img2);
  }

  clearScreenshots(): void {
    this.screenshots.clear();
  }
}

// ============================================================================
// Accessibility Testing
// ============================================================================

export interface A11yViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

export class A11yTester {
  async testPage(page: Page): Promise<A11yViolation[]> {
    const violations: A11yViolation[] = [];

    // Run axe-core if available
    try {
      const results = await page.evaluate(async () => {
        if (!(window as any).axe) {
          return { violations: [] };
        }

        return await (window as any).axe.run();
      });

      violations.push(...results.violations);
    } catch (error) {
      // axe not available, skip
    }

    // Basic accessibility checks
    const basicViolations = await this.runBasicChecks(page);
    violations.push(...basicViolations);

    return violations;
  }

  private async runBasicChecks(page: Page): Promise<A11yViolation[]> {
    const violations: A11yViolation[] = [];

    // Check for images without alt text
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .filter(img => !img.getAttribute('alt'))
        .map(img => img.outerHTML);
    });

    if (imagesWithoutAlt.length > 0) {
      violations.push({
        id: 'image-alt',
        impact: 'serious',
        description: 'Images must have alternate text',
        help: 'Provide alt text for images',
        helpUrl: 'https://www.w3.org/WAI/tutorials/images/',
        nodes: imagesWithoutAlt.map(html => ({
          html,
          target: [],
          failureSummary: 'Image is missing alt attribute',
        })),
      });
    }

    // Check for form inputs without labels
    const inputsWithoutLabels = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      return inputs
        .filter(input => {
          const id = input.getAttribute('id');
          return !id || !document.querySelector(`label[for="${id}"]`);
        })
        .map(input => input.outerHTML);
    });

    if (inputsWithoutLabels.length > 0) {
      violations.push({
        id: 'label',
        impact: 'serious',
        description: 'Form inputs must have labels',
        help: 'Associate form inputs with labels',
        helpUrl: 'https://www.w3.org/WAI/tutorials/forms/',
        nodes: inputsWithoutLabels.map(html => ({
          html,
          target: [],
          failureSummary: 'Form input is missing a label',
        })),
      });
    }

    // Check for proper heading hierarchy
    const headingIssues = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const issues: string[] = [];
      let lastLevel = 0;

      for (const heading of headings) {
        const level = parseInt(heading.tagName[1]);
        if (level > lastLevel + 1) {
          issues.push(heading.outerHTML);
        }
        lastLevel = level;
      }

      return issues;
    });

    if (headingIssues.length > 0) {
      violations.push({
        id: 'heading-order',
        impact: 'moderate',
        description: 'Heading levels should not be skipped',
        help: 'Use heading elements in proper hierarchical order',
        helpUrl: 'https://www.w3.org/WAI/tutorials/page-structure/',
        nodes: headingIssues.map(html => ({
          html,
          target: [],
          failureSummary: 'Heading level skipped',
        })),
      });
    }

    return violations;
  }

  async assertNoViolations(page: Page): Promise<void> {
    const violations = await this.testPage(page);
    const criticalViolations = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    if (criticalViolations.length > 0) {
      const message = criticalViolations
        .map(v => `- ${v.id}: ${v.description}`)
        .join('\n');
      throw new Error(`Accessibility violations found:\n${message}`);
    }
  }
}

// ============================================================================
// Cross-Browser Testing
// ============================================================================

export class CrossBrowserTester {
  private browsers: Array<'chromium' | 'firefox' | 'webkit'> = ['chromium', 'firefox', 'webkit'];
  private flows: E2ETestFlow[] = [];
  private results = new Map<string, boolean>();

  addFlow(flow: E2ETestFlow): this {
    this.flows.push(flow);
    return this;
  }

  setBrowsers(browsers: Array<'chromium' | 'firefox' | 'webkit'>): this {
    this.browsers = browsers;
    return this;
  }

  async run(options: E2ETestOptions = {}): Promise<Map<string, boolean>> {
    this.results.clear();

    for (const browser of this.browsers) {
      for (const flow of this.flows) {
        const key = `${browser}:${flow.name}`;

        try {
          const runner = new E2EFlowRunner();
          await runner.run(flow, { ...options, browser });
          this.results.set(key, true);
        } catch (error) {
          this.results.set(key, false);
          console.error(`Cross-browser test failed for ${key}:`, error);
        }
      }
    }

    return this.results;
  }

  getResults(): Map<string, boolean> {
    return this.results;
  }

  getFailedBrowsers(): string[] {
    return Array.from(this.results.entries())
      .filter(([, success]) => !success)
      .map(([key]) => key);
  }
}

// ============================================================================
// Mobile Testing
// ============================================================================

export interface MobileViewport {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export const MOBILE_VIEWPORTS: Record<string, MobileViewport> = {
  'iPhone 12': {
    name: 'iPhone 12',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'iPhone 12 Pro Max': {
    name: 'iPhone 12 Pro Max',
    width: 428,
    height: 926,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'iPad Pro': {
    name: 'iPad Pro',
    width: 1024,
    height: 1366,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'Samsung Galaxy S21': {
    name: 'Samsung Galaxy S21',
    width: 360,
    height: 800,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};

export class MobileTester {
  private flows: E2ETestFlow[] = [];
  private devices: string[] = [];
  private results = new Map<string, boolean>();

  addFlow(flow: E2ETestFlow): this {
    this.flows.push(flow);
    return this;
  }

  setDevices(devices: string[]): this {
    this.devices = devices;
    return this;
  }

  async run(options: E2ETestOptions = {}): Promise<Map<string, boolean>> {
    this.results.clear();

    for (const deviceName of this.devices) {
      const viewport = MOBILE_VIEWPORTS[deviceName];
      if (!viewport) {
        console.warn(`Unknown device: ${deviceName}`);
        continue;
      }

      for (const flow of this.flows) {
        const key = `${deviceName}:${flow.name}`;

        try {
          const runner = new E2EFlowRunner();
          await runner.run(flow, {
            ...options,
            viewport: { width: viewport.width, height: viewport.height },
          });
          this.results.set(key, true);
        } catch (error) {
          this.results.set(key, false);
          console.error(`Mobile test failed for ${key}:`, error);
        }
      }
    }

    return this.results;
  }

  async runAllDevices(flows: E2ETestFlow[], options: E2ETestOptions = {}): Promise<void> {
    for (const deviceName of Object.keys(MOBILE_VIEWPORTS)) {
      this.setDevices([deviceName]);
      this.flows = flows;
      await this.run(options);
    }
  }

  getResults(): Map<string, boolean> {
    return this.results;
  }
}

// ============================================================================
// E2E Test Builder
// ============================================================================

export class E2ETestBuilder {
  private flow: E2ETestFlow;
  private options: E2ETestOptions = {};

  constructor(name: string, url: string) {
    this.flow = {
      name,
      url,
      actions: [],
      assertions: [],
    };
  }

  navigate(url: string): this {
    this.flow.actions.push({
      type: 'navigate',
      value: url,
    });
    return this;
  }

  click(selector: string, options?: Record<string, unknown>): this {
    this.flow.actions.push({
      type: 'click',
      selector,
      options,
    });
    return this;
  }

  fill(selector: string, value: string, options?: Record<string, unknown>): this {
    this.flow.actions.push({
      type: 'fill',
      selector,
      value,
      options,
    });
    return this;
  }

  select(selector: string, value: string, options?: Record<string, unknown>): this {
    this.flow.actions.push({
      type: 'select',
      selector,
      value,
      options,
    });
    return this;
  }

  hover(selector: string, options?: Record<string, unknown>): this {
    this.flow.actions.push({
      type: 'hover',
      selector,
      options,
    });
    return this;
  }

  waitFor(selector: string, options?: Record<string, unknown>): this {
    this.flow.actions.push({
      type: 'waitFor',
      selector,
      options,
    });
    return this;
  }

  screenshot(path?: string, options?: Record<string, unknown>): this {
    this.flow.actions.push({
      type: 'screenshot',
      options: { path, ...options },
    });
    return this;
  }

  assertVisible(selector: string): this {
    this.flow.assertions!.push({
      type: 'assert',
      selector,
      value: 'visible',
    });
    return this;
  }

  assertText(selector: string, text: string): this {
    this.flow.assertions!.push({
      type: 'assert',
      selector,
      value: `text ${text}`,
    });
    return this;
  }

  assertHidden(selector: string): this {
    this.flow.assertions!.push({
      type: 'assert',
      selector,
      value: 'hidden',
    });
    return this;
  }

  setOptions(options: E2ETestOptions): this {
    this.options = options;
    return this;
  }

  async run(): Promise<void> {
    const runner = new E2EFlowRunner();
    await runner.run(this.flow, this.options);
  }

  getFlow(): E2ETestFlow {
    return this.flow;
  }
}

// ============================================================================
// Convenience functions
// ============================================================================

export function createE2ETest(name: string, url: string): E2ETestBuilder {
  return new E2ETestBuilder(name, url);
}

export async function runE2ETest(flow: E2ETestFlow, options?: E2ETestOptions): Promise<void> {
  const runner = new E2EFlowRunner();
  await runner.run(flow, options);
}

export function testA11y(page: Page): A11yTester {
  return new A11yTester();
}

export function testVisualRegression(options?: VisualRegressionOptions): VisualRegressionTester {
  return new VisualRegressionTester(options);
}

export function testCrossBrowser(): CrossBrowserTester {
  return new CrossBrowserTester();
}

export function testMobile(): MobileTester {
  return new MobileTester();
}
