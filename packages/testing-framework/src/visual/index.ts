/**
 * Visual Regression Testing Module
 * Provides comprehensive visual testing capabilities for UI regression
 */

export * from './types';
export { VisualComparator } from './comparator';
export { ImageProcessor } from './image-processor';

import {
  VisualSnapshot,
  VisualTestResult,
  VisualTestConfig,
  VisualTestSuite,
  VisualTestReport
} from './types';
import { VisualComparator } from './comparator';
import { ImageProcessor } from './image-processor';
import { HttpClient } from '../http/client';
import { Logger } from '../core/logger';

export class VisualTestRunner {
  private comparator: VisualComparator;
  private imageProcessor: ImageProcessor;
  private httpClient: HttpClient;
  private logger: Logger;
  private snapshots: Map<string, VisualSnapshot> = new Map();
  private results: VisualTestResult[] = [];

  constructor() {
    this.comparator = new VisualComparator();
    this.imageProcessor = new ImageProcessor();
    this.httpClient = new HttpClient();
    this.logger = new Logger('VisualTestRunner');
  }

  /**
   * Capture a visual snapshot
   */
  async captureSnapshot(
    name: string,
    url: string,
    config: VisualTestConfig
  ): Promise<VisualSnapshot> {
    this.logger.info(`Capturing snapshot: ${name}`);

    try {
      // Launch browser
      const browser = await this.launchBrowser(config.viewport);
      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({
        width: config.viewport.width,
        height: config.viewport.height,
        deviceScaleFactor: config.viewport.deviceScaleFactor || 1
      });

      // Navigate to URL
      await page.goto(url, { waitUntil: 'networkidle' });

      // Wait for any specified selector
      if (config.screenshot.waitSelector) {
        await page.waitForSelector(config.screenshot.waitSelector);
      }

      // Wait before capture
      if (config.screenshot.waitBeforeCapture) {
        await this.sleep(config.screenshot.waitBeforeCapture);
      }

      // Capture screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        quality: config.screenshot.quality,
        fullPage: config.screenshot.fullPage,
        captureBeyondViewport: config.screenshot.captureBeyondViewport
      });

      await browser.close();

      // Create snapshot object
      const snapshot: VisualSnapshot = {
        id: this.generateId(),
        name,
        description: `Visual snapshot captured from ${url}`,
        url,
        imageUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
        viewport: config.viewport,
        timestamp: new Date(),
        metadata: {
          version: '1.0.0',
          environment: 'browser',
          browser: {
            name: 'chrome',
            version: 'latest',
            platform: 'unknown',
            userAgent: await page.evaluate(() => navigator.userAgent)
          },
          comparisonMode: config.comparison.mode,
          diffThreshold: config.comparison.threshold
        }
      };

      this.snapshots.set(snapshot.id, snapshot);
      this.logger.info(`Snapshot captured: ${snapshot.id}`);

      return snapshot;

    } catch (error) {
      this.logger.error(`Failed to capture snapshot: ${error}`);
      throw error;
    }
  }

  /**
   * Run a visual test suite
   */
  async runTestSuite(suite: VisualTestSuite): Promise<VisualTestReport> {
    this.logger.info(`Running visual test suite: ${suite.name}`);
    const startTime = new Date();

    const baselineSnapshots: VisualSnapshot[] = [];
    const results: VisualTestResult[] = [];

    // Capture baseline snapshots
    for (const test of suite.tests) {
      try {
        const snapshot = await this.captureSnapshot(
          `${suite.name}-${test.name}`,
          test.url,
          suite.config
        );

        if (test.element) {
          // Crop to element if specified
          const elementSnapshot = await this.captureElementSnapshot(
            test.url,
            test.element,
            suite.config
          );
          baselineSnapshots.push(elementSnapshot);
        } else if (test.region) {
          // Crop to region if specified
          const regionSnapshot = this.cropSnapshotToRegion(snapshot, test.region);
          baselineSnapshots.push(regionSnapshot);
        } else {
          baselineSnapshots.push(snapshot);
        }

      } catch (error) {
        this.logger.error(`Failed to capture baseline for test ${test.name}: ${error}`);
        results.push({
          id: this.generateId(),
          snapshotId: '',
          testName: test.name,
          passed: false,
          duration: 0,
          baseline: {
            id: '',
            name: 'baseline',
            url: test.url,
            imageUrl: '',
            viewport: suite.config.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          current: {
            id: '',
            name: 'current',
            url: test.url,
            imageUrl: '',
            viewport: suite.config.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          error: {
            type: 'capture',
            message: error instanceof Error ? error.message : 'Capture failed',
            code: 'CAPTURE_ERROR'
          },
          metadata: {
            environment: 'test',
            timestamp: new Date(),
            testId: test.id
          }
        });
      }
    }

    // Store baseline snapshots
    baselineSnapshots.forEach(snapshot => {
      this.snapshots.set(snapshot.id, snapshot);
    });

    // Generate report
    const report: VisualTestReport = {
      id: this.generateId(),
      suiteId: suite.id,
      suiteName: suite.name,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      totalTests: suite.tests.length,
      passedTests: results.filter(r => r.passed).length,
      failedTests: results.filter(r => !r.passed).length,
      results,
      summary: this.calculateSummaryStats(results),
      artifacts: []
    };

    this.logger.info(`Test suite completed: ${suite.name}`);
    return report;
  }

  /**
   * Compare current state with baseline
   */
  async compareWithBaseline(
    testName: string,
    baselineId: string,
    currentUrl: string,
    config: VisualTestConfig
  ): Promise<VisualTestResult> {
    this.logger.info(`Running comparison test: ${testName}`);

    try {
      // Capture current snapshot
      const currentSnapshot = await this.captureSnapshot(
        `current-${testName}`,
        currentUrl,
        config
      );

      // Get baseline snapshot
      const baselineSnapshot = this.snapshots.get(baselineId);
      if (!baselineSnapshot) {
        throw new Error(`Baseline snapshot not found: ${baselineId}`);
      }

      // Compare snapshots
      const comparison = await this.comparator.compareSnapshots(
        baselineSnapshot,
        currentSnapshot,
        {
          threshold: config.comparison.threshold,
          mode: config.comparison.mode,
          ignoreColors: config.comparison.ignoreColors,
          ignoreRegions: config.comparison.ignoreRegions,
          maskRegions: config.comparison.maskRegions
        }
      );

      const result: VisualTestResult = {
        id: this.generateId(),
        snapshotId: baselineSnapshot.id,
        testName,
        passed: comparison.matchScore >= (100 - config.comparison.threshold),
        duration: 0, // Would be calculated in practice
        baseline,
        current: currentSnapshot,
        comparison,
        metadata: {
          environment: 'test',
          timestamp: new Date(),
          testId: this.generateId()
        }
      };

      this.results.push(result);
      return result;

    } catch (error) {
      this.logger.error(`Comparison test failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): VisualSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Get results
   */
  getResults(): VisualTestResult[] {
    return [...this.results];
  }

  /**
   * Clear results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Generate HTML report
   */
  generateReport(results: VisualTestResult[]): string {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Visual Regression Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .test { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .test.passed { background: #d4edda; }
        .test.failed { background: #f8d7da; }
        .images { display: flex; gap: 20px; margin: 10px 0; }
        .images img { max-width: 400px; border: 1px solid #ccc; }
        .diff { margin: 10px 0; }
        .stats { background: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Visual Regression Test Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
    </div>
`;

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    html += `
    <div class="stats">
        <h2>Summary</h2>
        <p>Total Tests: ${results.length}</p>
        <p>Passed: ${passed}</p>
        <p>Failed: ${failed}</p>
        <p>Pass Rate: ${results.length > 0 ? ((passed / results.length) * 100).toFixed(1) : 0}%</p>
    </div>
`;

    results.forEach(result => {
      const status = result.passed ? 'passed' : 'failed';
      html += `
    <div class="test ${status}">
        <h3>${result.testName}</h3>
        <p>Match Score: ${result.comparison?.matchScore.toFixed(1)}%</p>
        <p>Differences: ${result.comparison?.pixelDiffCount || 0} pixels</p>
        <p>Duration: ${result.duration}ms</p>

        <div class="images">
            <div>
                <h4>Baseline</h4>
                <img src="${result.baseline.imageUrl}" alt="Baseline" />
            </div>
            <div>
                <h4>Current</h4>
                <img src="${result.current.imageUrl}" alt="Current" />
            </div>
            ${result.comparison?.visualDiff?.imageUrl ? `
            <div>
                <h4>Difference</h4>
                <img src="${result.comparison.visualDiff.imageUrl}" alt="Difference" />
            </div>
            ` : ''}
        </div>

        ${result.error ? `<p><strong>Error:</strong> ${result.error.message}</p>` : ''}
    </div>
`;
    });

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Helper methods
   */
  private async launchBrowser(viewport: { width: number; height: number }): Promise<any> {
    // In a real implementation, this would launch a browser using Puppeteer or Playwright
    // For now, return a mock browser object
    return {
      newPage: async () => ({
        setViewport: async () => {},
        goto: async () => {},
        waitForSelector: async () => {},
        screenshot: async () => new Buffer('mock-screenshot'),
        close: async () => {},
        evaluate: async () => 'mock-user-agent'
      })
    };
  }

  private async captureElementSnapshot(
    url: string,
    element: any,
    config: VisualTestConfig
  ): Promise<VisualSnapshot> {
    // This would capture a specific element instead of the full page
    // For now, return a placeholder
    return {
      id: this.generateId(),
      name: `element-snapshot`,
      url,
      imageUrl: '',
      viewport: config.viewport,
      timestamp: new Date(),
      metadata: {
        version: '1.0.0',
        environment: 'browser',
        element,
        comparisonMode: config.comparison.mode,
        diffThreshold: config.comparison.threshold
      }
    };
  }

  private cropSnapshotToRegion(snapshot: VisualSnapshot, region: any): VisualSnapshot {
    // This would crop the snapshot to the specified region
    return {
      ...snapshot,
      id: this.generateId(),
      name: `${snapshot.name}-cropped`,
      metadata: {
        ...snapshot.metadata,
        region
      }
    };
  }

  private calculateSummaryStats(results: VisualTestResult[]): any {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / totalTests || 0;
    const averageMatchScore = results.reduce((sum, r) => sum + (r.comparison?.matchScore || 0), 0) / totalTests || 0;
    const totalPixelDiffs = results.reduce((sum, r) => sum + (r.comparison?.pixelDiffCount || 0), 0);

    // Find most common issue
    const issues = results
      .filter(r => !r.passed)
      .map(r => r.error?.type || 'unknown');
    const mostCommonIssue = issues.length > 0
      ? issues.sort((a, b) => issues.filter(v => v === a).length - issues.filter(v => v === b).length).pop() || 'unknown'
      : 'none';

    return {
      totalTests,
      passedTests,
      averageDuration: Math.round(averageDuration),
      averageMatchScore: Math.round(averageMatchScore),
      totalPixelDiffs,
      mostCommonIssue,
      environment: 'browser',
      browser: 'chrome'
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `visual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create default instance
export const visualTestRunner = new VisualTestRunner();

// Utility functions
export const VisualTesting = {
  /**
   * Create a visual test suite
   */
  createSuite: (config: VisualTestConfig): VisualTestSuite => ({
    id: `suite_${Date.now()}`,
    name: 'Visual Test Suite',
    config,
    tests: [],
    baseUrl: 'http://localhost:3000'
  }),

  /**
   * Add test to suite
   */
  addTest: (suite: VisualTestSuite, test: any): void => {
    suite.tests.push({
      id: `test_${Date.now()}`,
      name: 'Test',
      url: suite.baseUrl,
      ...test
    });
  }
};