/**
 * Visual Regression Testing Types
 * Provides types for visual testing and comparison capabilities
 */

export interface VisualSnapshot {
  id: string;
  name: string;
  description?: string;
  url: string;
  imageUrl: string;
  viewport: Viewport;
  timestamp: Date;
  metadata: SnapshotMetadata;
}

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
}

export interface SnapshotMetadata {
  version: string;
  environment: string;
  browser?: BrowserInfo;
  element?: ElementSelector;
  region?: Region;
  diffThreshold?: number;
  comparisonMode?: 'strict' | 'fuzzy' | 'semantic';
}

export interface BrowserInfo {
  name: string;
  version: string;
  platform: string;
  userAgent: string;
}

export interface ElementSelector {
  selector: string;
  type: 'css' | 'xpath' | 'id' | 'class' | 'name';
  attributes?: Record<string, string>;
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualTestResult {
  id: string;
  snapshotId: string;
  testName: string;
  passed: boolean;
  duration: number;
  baseline: VisualSnapshot;
  current: VisualSnapshot;
  comparison?: VisualComparison;
  error?: VisualTestError;
  metadata: TestMetadata;
}

export interface VisualComparison {
  pixelDiffCount: number;
  pixelDiffPercentage: number;
  regionDiffs: RegionDiff[];
  matchScore: number;
  isExactMatch: boolean;
  visualDiff: VisualDiff;
}

export interface VisualDiff {
  imageUrl: string;
  highlights: DiffHighlight[];
  overallColor: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
}

export interface DiffHighlight {
  region: Region;
  severity: 'low' | 'medium' | 'high';
  description?: string;
  color: string;
}

export interface RegionDiff {
  region: Region;
  beforeColor: string;
  afterColor: string;
  difference: number;
  similarity: number;
}

export interface VisualTestError {
  type: 'capture' | 'comparison' | 'baseline' | 'storage';
  message: string;
  code: string;
  details?: any;
}

export interface TestMetadata {
  environment: string;
  browser?: BrowserInfo;
  viewport?: Viewport;
  timestamp: Date;
  testId?: string;
  tags?: string[];
}

export interface VisualTestConfig {
  viewport: Viewport;
  comparison: {
    mode: 'strict' | 'fuzzy' | 'semantic';
    threshold: number;
    ignoreColors?: string[];
    ignoreRegions?: Region[];
    maskRegions?: Region[];
  };
  screenshot: {
    quality: number;
    fullPage: boolean;
    captureBeyondViewport?: boolean;
    animations?: 'disabled' | 'running' | 'frozen';
    waitBeforeCapture?: number;
    waitSelector?: string;
  };
  storage: {
    provider: 'filesystem' | 's3' | 'azure' | 'gcp';
    baseUrl?: string;
    options?: any;
  };
  reporting: {
    format: 'image' | 'diff-image' | 'highlight-image' | 'json' | 'html';
    outputDir: string;
    generateDiff: boolean;
    generateHighlights: boolean;
  };
}

export interface VisualTestSuite {
  id: string;
  name: string;
  description?: string;
  config: VisualTestConfig;
  tests: VisualTestCase[];
  baseUrl: string;
  setup?: string;
  teardown?: string;
}

export interface VisualTestCase {
  id: string;
  name: string;
  description?: string;
  url: string;
  viewport?: Viewport;
  element?: ElementSelector;
  region?: Region;
  steps?: VisualTestStep[];
  expectedScreenshot?: string;
  tolerance?: number;
  tags?: string[];
}

export interface VisualTestStep {
  type: 'navigation' | 'interaction' | 'wait' | 'capture';
  action: string;
  value?: any;
  description?: string;
  waitAfter?: number;
}

export interface VisualTestReport {
  id: string;
  suiteId: string;
  suiteName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: VisualTestResult[];
  summary: SummaryStats;
  artifacts: Artifact[];
}

export interface SummaryStats {
  averageDuration: number;
  averageMatchScore: number;
  totalPixelDiffs: number;
  mostCommonIssue: string;
  environment: string;
  browser: string;
}

export interface Artifact {
  type: 'screenshot' | 'diff' | 'highlight' | 'report';
  name: string;
  url: string;
  size: number;
  checksum: string;
}