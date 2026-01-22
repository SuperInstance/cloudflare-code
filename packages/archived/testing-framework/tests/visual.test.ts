import { describe, test, expect, beforeEach, afterEach, jest } from '../src/unit/jest-compat';
import {
  VisualTestRunner,
  VisualTestConfig,
  VisualTestSuite,
  VisualTestReport,
  VisualSnapshot,
  VisualTestResult,
  VisualComparator,
  ImageProcessor,
  VisualTesting
} from '../src/visual';

describe('Visual Regression Testing', () => {
  let testRunner: VisualTestRunner;
  let mockConfig: VisualTestConfig;

  beforeEach(() => {
    testRunner = new VisualTestRunner();
    mockConfig = {
      viewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      },
      comparison: {
        mode: 'fuzzy',
        threshold: 5,
        ignoreColors: ['#ffffff', '#000000']
      },
      screenshot: {
        quality: 80,
        fullPage: true,
        waitBeforeCapture: 1000,
        waitSelector: '#app'
      },
      storage: {
        provider: 'filesystem',
        baseUrl: './snapshots'
      },
      reporting: {
        format: 'html',
        outputDir: './test-results',
        generateDiff: true,
        generateHighlights: true
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Visual Test Runner', () => {
    test('should initialize visual test runner', () => {
      expect(testRunner).toBeDefined();
      expect(testRunner.getSnapshots()).toEqual([]);
      expect(testRunner.getResults()).toEqual([]);
    });

    test('should capture snapshot with basic config', async () => {
      // Mock browser launch
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue({
          setViewport: jest.fn(),
          goto: jest.fn(),
          waitForSelector: jest.fn(),
          screenshot: jest.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
          close: jest.fn(),
          evaluate: jest.fn().mockResolvedValue('mock-user-agent')
        })
      };

      jest.spyOn(testRunner as any, 'launchBrowser').mockResolvedValue(mockBrowser);

      const snapshot = await testRunner.captureSnapshot(
        'test-snapshot',
        'http://localhost:3000',
        mockConfig
      );

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.name).toBe('test-snapshot');
      expect(snapshot.url).toBe('http://localhost:3000');
      expect(testRunner.getSnapshots()).toHaveLength(1);
    });

    test('should create and run test suite', async () => {
      const suite: VisualTestSuite = {
        id: 'test-suite-1',
        name: 'Test Suite',
        description: 'Test visual regressions',
        config: mockConfig,
        tests: [
          {
            id: 'test-1',
            name: 'Homepage',
            url: 'http://localhost:3000',
            viewport: mockConfig.viewport,
            tolerance: 5
          }
        ],
        baseUrl: 'http://localhost:3000'
      };

      // Mock the captureSnapshot method
      const mockSnapshot: VisualSnapshot = {
        id: 'snapshot-1',
        name: 'Homepage',
        url: 'http://localhost:3000',
        imageUrl: 'data:image/png;base64,mock-data',
        viewport: mockConfig.viewport,
        timestamp: new Date(),
        metadata: {
          version: '1.0.0',
          environment: 'browser',
          comparisonMode: 'fuzzy',
          diffThreshold: 5
        }
      };

      jest.spyOn(testRunner, 'captureSnapshot').mockResolvedValue(mockSnapshot);

      const report = await testRunner.runTestSuite(suite);

      expect(report).toBeDefined();
      expect(report.suiteId).toBe('test-suite-1');
      expect(report.totalTests).toBe(1);
      expect(report.results).toHaveLength(1);
    });

    test('should compare with baseline', async () => {
      const mockBaseline: VisualSnapshot = {
        id: 'baseline-1',
        name: 'baseline',
        url: 'http://localhost:3000',
        imageUrl: 'data:image/png;base64,baseline-data',
        viewport: mockConfig.viewport,
        timestamp: new Date(),
        metadata: {
          version: '1.0.0',
          environment: 'browser'
        }
      };

      const mockCurrent: VisualSnapshot = {
        id: 'current-1',
        name: 'current',
        url: 'http://localhost:3000',
        imageUrl: 'data:image/png;base64,current-data',
        viewport: mockConfig.viewport,
        timestamp: new Date(),
        metadata: {
          version: '1.0.0',
          environment: 'browser'
        }
      };

      // Store baseline snapshot
      testRunner['snapshots'].set('baseline-1', mockBaseline);

      // Mock capture and comparison
      jest.spyOn(testRunner, 'captureSnapshot').mockResolvedValue(mockCurrent);
      const mockComparison = {
        pixelDiffCount: 100,
        pixelDiffPercentage: 0.5,
        regionDiffs: [],
        matchScore: 99.5,
        isExactMatch: false,
        visualDiff: {
          imageUrl: '',
          highlights: [],
          overallColor: { r: 255, g: 0, b: 0, a: 255 }
        }
      };

      const mockComparator = jest.spyOn(testRunner as any, 'comparator');
      mockComparator.compareSnapshots.mockResolvedValue(mockComparison);

      const result = await testRunner.compareWithBaseline(
        'test-comparison',
        'baseline-1',
        'http://localhost:3000',
        mockConfig
      );

      expect(result).toBeDefined();
      expect(result.testName).toBe('test-comparison');
      expect(result.passed).toBe(true);
      expect(result.comparison).toBeDefined();
    });

    test('should handle comparison failures gracefully', async () => {
      // Mock baseline not found
      const result = testRunner['compareWithBaseline'](
        'test-failure',
        'non-existent-baseline',
        'http://localhost:3000',
        mockConfig
      );

      await expect(result).rejects.toThrow('Baseline snapshot not found');
    });

    test('should generate HTML report', () => {
      const mockResults: VisualTestResult[] = [
        {
          id: 'result-1',
          snapshotId: 'snapshot-1',
          testName: 'Test 1',
          passed: true,
          duration: 1000,
          baseline: {
            id: 'baseline-1',
            name: 'baseline',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          current: {
            id: 'current-1',
            name: 'current',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          comparison: {
            pixelDiffCount: 0,
            pixelDiffPercentage: 0,
            regionDiffs: [],
            matchScore: 100,
            isExactMatch: true,
            visualDiff: {
              imageUrl: '',
              highlights: [],
              overallColor: { r: 0, g: 255, b: 0, a: 255 }
            }
          },
          metadata: {
            environment: 'test',
            timestamp: new Date(),
            testId: 'test-1'
          }
        },
        {
          id: 'result-2',
          snapshotId: 'snapshot-2',
          testName: 'Test 2',
          passed: false,
          duration: 2000,
          baseline: {
            id: 'baseline-2',
            name: 'baseline',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          current: {
            id: 'current-2',
            name: 'current',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          comparison: {
            pixelDiffCount: 1000,
            pixelDiffPercentage: 10,
            regionDiffs: [],
            matchScore: 90,
            isExactMatch: false,
            visualDiff: {
              imageUrl: '',
              highlights: [],
              overallColor: { r: 255, g: 0, b: 0, a: 255 }
            }
          },
          error: {
            type: 'comparison',
            message: 'Images differ significantly',
            code: 'COMPARISON_ERROR'
          },
          metadata: {
            environment: 'test',
            timestamp: new Date(),
            testId: 'test-2'
          }
        }
      ];

      const htmlReport = testRunner.generateReport(mockResults);

      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('Visual Regression Test Report');
      expect(htmlReport).toContain('Test 1');
      expect(htmlReport).toContain('Test 2');
      expect(htmlReport).toContain('Match Score: 100.0%');
      expect(htmlReport).toContain('Match Score: 90.0%');
      expect(htmlReport).toContain('passed');
      expect(htmlReport).toContain('failed');
    });

    test('should clear results', () => {
      // Add some results first
      testRunner['results'] = [
        {
          id: 'result-1',
          snapshotId: 'snapshot-1',
          testName: 'Test',
          passed: true,
          duration: 1000,
          baseline: {
            id: 'baseline-1',
            name: 'baseline',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          current: {
            id: 'current-1',
            name: 'current',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          metadata: {
            environment: 'test',
            timestamp: new Date(),
            testId: 'test-1'
          }
        }
      ];

      testRunner.clearResults();
      expect(testRunner.getResults()).toEqual([]);
    });
  });

  describe('Visual Comparator', () => {
    test('should initialize visual comparator', () => {
      const comparator = new VisualComparator();
      expect(comparator).toBeDefined();
    });

    test('should compare images strictly', async () => {
      const comparator = new VisualComparator();

      // Mock image processor
      const mockImageProcessor = {
        loadImage: jest.fn().mockResolvedValue({
          data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]),
          width: 2,
          height: 1
        })
      };

      (comparator as any).imageProcessor = mockImageProcessor;

      const baseline = {
        id: 'baseline',
        name: 'baseline',
        url: 'http://localhost:3000',
        imageUrl: '',
        viewport: mockConfig.viewport,
        timestamp: new Date(),
        metadata: { version: '1.0.0', environment: 'test' }
      } as VisualSnapshot;

      const current = {
        id: 'current',
        name: 'current',
        url: 'http://localhost:3000',
        imageUrl: '',
        viewport: mockConfig.viewport,
        timestamp: new Date(),
        metadata: { version: '1.0.0', environment: 'test' }
      } as VisualSnapshot;

      const comparison = await comparator.compareSnapshots(
        baseline,
        current,
        { threshold: 0, mode: 'strict' }
      );

      expect(comparison).toBeDefined();
      expect(comparison.pixelDiffCount).toBeGreaterThan(0);
      expect(comparison.pixelDiffPercentage).toBeGreaterThan(0);
      expect(comparison.matchScore).toBeLessThan(100);
    });
  });

  describe('Image Processor', () => {
    test('should initialize image processor', () => {
      const processor = new ImageProcessor();
      expect(processor).toBeDefined();
    });

    test('should resize image', async () => {
      const processor = new ImageProcessor();

      const originalImageData = {
        data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]),
        width: 2,
        height: 1
      };

      const resized = await processor.resizeImage(originalImageData, 4, 2);
      expect(resized.width).toBe(4);
      expect(resized.height).toBe(2);
    });

    test('should crop image to region', () => {
      const processor = new ImageProcessor();

      const originalImageData = {
        data: new Uint8ClampedArray(Array(16).fill(255)), // 2x2 image
        width: 2,
        height: 2
      };

      const cropped = processor.cropImage(originalImageData, { x: 0, y: 0, width: 1, height: 1 });
      expect(cropped.width).toBe(1);
      expect(cropped.height).toBe(1);
      expect(cropped.data.length).toBe(4); // 1x1x4
    });

    test('should convert image to grayscale', () => {
      const processor = new ImageProcessor();

      const colorImage = {
        data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]), // Red, Green, Blue
        width: 1,
        height: 2
      };

      const grayImage = (processor as any).convertToGrayscale(colorImage);

      // Check that RGB values are equal (grayscale)
      expect(grayImage.data[0]).toBe(grayImage.data[1]); // Red == Green for first pixel
      expect(grayImage.data[1]).toBe(grayImage.data[2]); // Green == Blue for first pixel
      expect(grayImage.data[4]).toBe(grayImage.data[5]); // Red == Green for second pixel
      expect(grayImage.data[5]).toBe(grayImage.data[6]); // Green == Blue for second pixel
    });

    test('should apply color threshold', () => {
      const processor = new ImageProcessor();

      const image = {
        data: new Uint8ClampedArray([100, 100, 100, 255, 200, 200, 200, 255]), // Dark and light pixels
        width: 1,
        height: 2
      };

      const thresholded = processor.applyColorThreshold(image, 150);

      // Dark pixel (100) should be 0
      expect(thresholded.data[0]).toBe(0);
      // Light pixel (200) should be 255
      expect(thresholded.data[4]).toBe(255);
    });
  });

  describe('Visual Testing Utilities', () => {
    test('should create visual test suite', () => {
      const suite = VisualTesting.createSuite(mockConfig);

      expect(suite).toBeDefined();
      expect(suite.id).toBeDefined();
      expect(suite.config).toBe(mockConfig);
      expect(suite.tests).toEqual([]);
      expect(suite.baseUrl).toBe('http://localhost:3000');
    });

    test('should add test to suite', () => {
      const suite = VisualTesting.createSuite(mockConfig);

      VisualTesting.addTest(suite, {
        name: 'Homepage Test',
        url: '/home'
      });

      expect(suite.tests).toHaveLength(1);
      expect(suite.tests[0].name).toBe('Homepage Test');
      expect(suite.tests[0].url).toBe('/home');
    });

    test('should add element test to suite', () => {
      const suite = VisualTesting.createSuite(mockConfig);

      VisualTesting.addTest(suite, {
        name: 'Button Test',
        url: '/home',
        element: {
          selector: '.submit-button',
          type: 'css'
        }
      });

      expect(suite.tests).toHaveLength(1);
      expect(suite.tests[0].element).toBeDefined();
      expect(suite.tests[0].element?.selector).toBe('.submit-button');
    });

    test('should add region test to suite', () => {
      const suite = VisualTesting.createSuite(mockConfig);

      VisualTesting.addTest(suite, {
        name: 'Header Test',
        url: '/home',
        region: { x: 0, y: 0, width: 200, height: 50 }
      });

      expect(suite.tests).toHaveLength(1);
      expect(suite.tests[0].region).toBeDefined();
      expect(suite.tests[0].region?.width).toBe(200);
    });
  });

  describe('Report Generation', () => {
    test('should calculate summary statistics', () => {
      const mockResults: VisualTestResult[] = [
        {
          id: 'result-1',
          snapshotId: 'snapshot-1',
          testName: 'Test 1',
          passed: true,
          duration: 1000,
          baseline: {
            id: 'baseline-1',
            name: 'baseline',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          current: {
            id: 'current-1',
            name: 'current',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          comparison: {
            pixelDiffCount: 50,
            pixelDiffPercentage: 1,
            regionDiffs: [],
            matchScore: 99,
            isExactMatch: false,
            visualDiff: {
              imageUrl: '',
              highlights: [],
              overallColor: { r: 255, g: 0, b: 0, a: 255 }
            }
          },
          metadata: {
            environment: 'test',
            timestamp: new Date(),
            testId: 'test-1'
          }
        }
      ];

      const testRunner = new VisualTestRunner();
      const stats = (testRunner as any).calculateSummaryStats(mockResults);

      expect(stats.totalTests).toBe(1);
      expect(stats.passedTests).toBe(1);
      expect(stats.averageDuration).toBe(1000);
      expect(stats.averageMatchScore).toBe(99);
      expect(stats.totalPixelDiffs).toBe(50);
      expect(stats.mostCommonIssue).toBe('none');
    });

    test('should handle failed tests in statistics', () => {
      const mockResults: VisualTestResult[] = [
        {
          id: 'result-1',
          snapshotId: 'snapshot-1',
          testName: 'Test 1',
          passed: false,
          duration: 1000,
          baseline: {
            id: 'baseline-1',
            name: 'baseline',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          current: {
            id: 'current-1',
            name: 'current',
            url: 'http://localhost:3000',
            imageUrl: '',
            viewport: mockConfig.viewport,
            timestamp: new Date(),
            metadata: { version: '1.0.0', environment: 'test' }
          },
          error: {
            type: 'capture',
            message: 'Capture failed',
            code: 'CAPTURE_ERROR'
          },
          metadata: {
            environment: 'test',
            timestamp: new Date(),
            testId: 'test-1'
          }
        }
      ];

      const testRunner = new VisualTestRunner();
      const stats = (testRunner as any).calculateSummaryStats(mockResults);

      expect(stats.totalTests).toBe(1);
      expect(stats.passedTests).toBe(0);
      expect(stats.failedTests).toBe(1);
      expect(stats.mostCommonIssue).toBe('capture');
    });
  });

  describe('Visual Test Configuration', () => {
    test('should support different comparison modes', () => {
      const config1: VisualTestConfig = {
        ...mockConfig,
        comparison: {
          mode: 'strict',
          threshold: 0
        }
      };

      const config2: VisualTestConfig = {
        ...mockConfig,
        comparison: {
          mode: 'fuzzy',
          threshold: 5
        }
      };

      const config3: VisualTestConfig = {
        ...mockConfig,
        comparison: {
          mode: 'semantic',
          threshold: 10
        }
      };

      expect(config1.comparison.mode).toBe('strict');
      expect(config2.comparison.mode).toBe('fuzzy');
      expect(config3.comparison.mode).toBe('semantic');
    });

    test('should support viewport configurations', () => {
      const mobileViewport = {
        width: 375,
        height: 667,
        isMobile: true,
        hasTouch: true
      };

      const desktopViewport = {
        width: 1920,
        height: 1080,
        isLandscape: true
      };

      expect(mobileViewport.width).toBe(375);
      expect(mobileViewport.isMobile).toBe(true);
      expect(desktopViewport.width).toBe(1920);
      expect(desktopViewport.isLandscape).toBe(true);
    });

    test('should support storage configurations', () => {
      const fsConfig = {
        provider: 'filesystem',
        baseUrl: './snapshots',
        options: {}
      };

      const s3Config = {
        provider: 's3',
        baseUrl: 's3://bucket/snapshots',
        options: {
          region: 'us-east-1',
          accessKeyId: 'key',
          secretAccessKey: 'secret'
        }
      };

      expect(fsConfig.provider).toBe('filesystem');
      expect(s3Config.provider).toBe('s3');
      expect(s3Config.options.region).toBe('us-east-1');
    });
  });
});