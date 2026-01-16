// @ts-nocheck
// ============================================================================
// Core Types
// ============================================================================

export interface DocMeta {
  title: string;
  description: string;
  slug: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  lastUpdated: string;
  version: string;
  author?: string;
}

export interface APIMeta extends DocMeta {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  category: 'chat' | 'agents' | 'code' | 'webhooks' | 'admin';
  authentication: boolean;
  rateLimit?: {
    requests: number;
    window: string;
  };
}

export interface TutorialMeta extends DocMeta {
  type: 'written' | 'video' | 'interactive';
  videoUrl?: string;
  prerequisites?: string[];
  objectives: string[];
}

export interface TroubleshootingEntry {
  id: string;
  title: string;
  category: string;
  symptoms: string[];
  causes: string[];
  solutions: Solution[];
  relatedErrors: string[];
  relatedDocs: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Solution {
  description: string;
  steps: string[];
  codeExample?: CodeExample;
  verificationStep?: string;
}

export interface CodeExample {
  language: string;
  code: string;
  title?: string;
  filename?: string;
}

export interface MigrationGuide {
  id: string;
  title: string;
  fromVersion: string;
  toVersion: string;
  breakingChanges: BreakingChange[];
  newFeatures: string[];
  deprecatedFeatures: string[];
  migrationSteps: MigrationStep[];
  estimatedTime: number;
}

export interface BreakingChange {
  feature: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  replacement?: string;
  migrationExample?: CodeExample;
}

export interface MigrationStep {
  step: number;
  title: string;
  description: string;
  action: string;
  codeExample?: CodeExample;
  verification?: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface APIEndpoint {
  id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters: APIParameter[];
  requestBody?: APIRequestBody;
  responses: APIResponse[];
  examples: APIExample[];
  tags: string[];
  authentication: boolean;
  rateLimit?: {
    requests: number;
    per: string;
  };
}

export interface APIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description: string;
  required: boolean;
  schema: APISchema;
  example?: any;
}

export interface APIRequestBody {
  description: string;
  required: boolean;
  content: {
    'application/json': APISchema;
    'application/x-www-form-urlencoded'?: APISchema;
    'multipart/form-data'?: APISchema;
  };
}

export interface APISchema {
  type: string;
  properties?: Record<string, APISchema>;
  items?: APISchema;
  required?: string[];
  enum?: any[];
  format?: string;
  description?: string;
  example?: any;
  default?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface APIResponse {
  statusCode: number;
  description: string;
  content?: {
    'application/json': {
      schema: APISchema;
      example?: any;
    };
  };
}

export interface APIExample {
  title: string;
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    statusCode: number;
    body: any;
  };
  language?: string;
}

// ============================================================================
// Playground Types
// ============================================================================

export interface PlaygroundState {
  code: string;
  language: string;
  theme: 'light' | 'dark';
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  autoRun: boolean;
  runDelay: number;
}

export interface PlaygroundPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  language: string;
  tags: string[];
}

export interface PlaygroundResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// ============================================================================
// Navigation Types
// ============================================================================

export interface NavItem {
  title: string;
  href?: string;
  children?: NavItem[];
  icon?: string;
  badge?: string;
  external?: boolean;
}

export interface DocSection {
  title: string;
  items: NavItem[];
}

export interface BreadcrumbItem {
  title: string;
  href: string;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  score: number;
  highlights: {
    field: string;
    fragments: string[];
  }[];
}

export interface SearchFilters {
  category?: string[];
  difficulty?: string[];
  tags?: string[];
  version?: string;
}

export interface SuggestionResult {
  term: string;
  count: number;
  category?: string;
}

// ============================================================================
// Content Types
// ============================================================================

export interface MarkdownDoc {
  meta: DocMeta;
  content: string;
  headings: Heading[];
  readingTime: number;
}

export interface Heading {
  id: string;
  text: string;
  level: number;
  children?: Heading[];
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
  highlightLines?: number[];
}

// ============================================================================
// UI Types
// ============================================================================

export interface Tab {
  id: string;
  label: string;
  content: string | React.ReactNode;
  icon?: string;
}

export interface AccordionItem {
  id: string;
  title: string;
  content: string | React.ReactNode;
  defaultOpen?: boolean;
}

export interface Callout {
  type: 'info' | 'warning' | 'error' | 'success' | 'tip';
  title?: string;
  content: string;
}

export interface Card {
  title: string;
  description: string;
  icon?: string;
  link?: string;
  badge?: string;
}

// ============================================================================
// Version Types
// ============================================================================

export interface VersionInfo {
  version: string;
  releaseDate: string;
  status: 'stable' | 'beta' | 'alpha' | 'deprecated';
  docsPath: string;
  migrationGuide?: string;
}

export interface VersionSelectorProps {
  currentVersion: string;
  availableVersions: VersionInfo[];
  onSelect: (version: string) => void;
}

// ============================================================================
// Language Types
// ============================================================================

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export interface Translation {
  [key: string]: string | Translation;
}

// ============================================================================
// Video Types
// ============================================================================

export interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  youtubeId?: string;
  vimeoId?: string;
  tags: string[];
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  relatedDocs: string[];
  chapters: VideoChapter[];
}

export interface VideoChapter {
  title: string;
  timestamp: number;
}

// ============================================================================
// Interactive Example Types
// ============================================================================

export interface InteractiveExample {
  id: string;
  title: string;
  description: string;
  category: string;
  template: string;
  defaultCode: string;
  expectedOutput: string;
  hints: string[];
  tests: TestCase[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface TestCase {
  name: string;
  input: any;
  expectedOutput: any;
  description?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ErrorCode {
  code: string;
  title: string;
  description: string;
  httpStatus: number;
  category: string;
  causes: string[];
  solutions: string[];
  example?: {
    request: any;
    response: any;
  };
}

// ============================================================================
// SDK Types
// ============================================================================

export interface SDKInfo {
  name: string;
  language: string;
  version: string;
  installation: string;
  import: string;
  basicUsage: string;
  documentation: string;
  github?: string;
  npm?: string;
  examples: SDKExample[];
}

export interface SDKExample {
  title: string;
  description: string;
  code: string;
  category: string;
}

// ============================================================================
// Analytics Types (for docs usage tracking)
// ============================================================================

export interface DocAnalytics {
  pageViews: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  searchQueries: SearchQuery[];
  popularPages: PageStats[];
}

export interface SearchQuery {
  query: string;
  count: number;
  clickThroughRate: number;
}

export interface PageStats {
  page: string;
  views: number;
  avgTime: number;
}
