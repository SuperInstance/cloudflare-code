/**
 * Multimodal Type Definitions
 * Core types for vision, OCR, and multimodal AI capabilities
 */

// ============================================================================
// Vision Types
// ============================================================================

export type ImageType =
  | 'screenshot'
  | 'photo'
  | 'diagram'
  | 'whiteboard'
  | 'document'
  | 'code-snapshot'
  | 'ui-mockup'
  | 'error-screenshot'
  | 'architecture-diagram'
  | 'flowchart';

export type AnalysisFeature =
  | 'ui-elements'
  | 'text'
  | 'code'
  | 'layout'
  | 'colors'
  | 'accessibility'
  | 'errors'
  | 'components'
  | 'structure';

export type VisionProvider = 'anthropic' | 'openai' | 'claude' | 'gpt-4v';

export interface ImageAnalysisOptions {
  image: Buffer | string;
  type?: ImageType;
  features?: AnalysisFeature[];
  provider?: VisionProvider;
  detail?: 'low' | 'high' | 'auto';
  maxTokens?: number;
  temperature?: number;
}

export interface UIElement {
  type: string;
  label?: string;
  position: BoundingBox;
  confidence: number;
  attributes?: Record<string, unknown>;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageAnalysisResult {
  description: string;
  uiElements?: UIElement[];
  text?: string;
  code?: CodeExtraction[];
  layout?: LayoutInfo;
  colors?: ColorInfo[];
  accessibility?: AccessibilityInfo;
  errors?: ErrorInfo[];
  metadata: AnalysisMetadata;
}

export interface LayoutInfo {
  structure: string;
  hierarchy: LayoutNode[];
  responsiveness?: string;
}

export interface LayoutNode {
  type: string;
  children?: LayoutNode[];
  position?: BoundingBox;
}

export interface ColorInfo {
  primary: string[];
  secondary: string[];
  accent: string[];
  palette: string[];
}

export interface AccessibilityInfo {
  score: number;
  issues: AccessibilityIssue[];
  suggestions: string[];
}

export interface AccessibilityIssue {
  severity: 'error' | 'warning' | 'info';
  description: string;
  element?: string;
  wcagCriteria?: string;
}

export interface ErrorInfo {
  type: string;
  message: string;
  position?: BoundingBox;
  stack?: string;
  suggestions?: string[];
}

export interface AnalysisMetadata {
  provider: VisionProvider;
  model: string;
  processingTime: number;
  confidence: number;
  timestamp: Date;
}

// ============================================================================
// Code Extraction Types
// ============================================================================

export type CodeLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'auto-detect';

export interface CodeExtractionOptions {
  image: Buffer | string;
  language?: CodeLanguage;
  includeLineNumbers?: boolean;
  preserveFormatting?: boolean;
  ocrEnhancement?: boolean;
  syntaxValidation?: boolean;
}

export interface CodeExtraction {
  code: string;
  language: CodeLanguage;
  confidence: number;
  lineRanges?: LineRange[];
  metadata: CodeExtractionMetadata;
}

export interface LineRange {
  start: number;
  end: number;
  text?: string;
}

export interface CodeExtractionMetadata {
  method: 'vision' | 'ocr' | 'hybrid';
  provider: VisionProvider;
  ocrConfidence?: number;
  visionConfidence: number;
  processingTime: number;
  detectedElements: DetectedElement[];
}

export interface DetectedElement {
  type: 'keyword' | 'string' | 'comment' | 'function' | 'variable' | 'operator';
  value: string;
  position: BoundingBox;
  confidence: number;
}

// ============================================================================
// Diagram Types
// ============================================================================

export type DiagramType =
  | 'architecture'
  | 'flowchart'
  | 'sequence-diagram'
  | 'entity-relationship'
  | 'class-diagram'
  | 'state-machine'
  | 'network-topology'
  | 'data-flow'
  | 'component-diagram';

export interface DiagramAnalysisOptions {
  image: Buffer | string;
  type?: DiagramType;
  extractComponents?: boolean;
  generateCode?: boolean;
  targetLanguage?: CodeLanguage;
}

export interface DiagramAnalysisResult {
  type: DiagramType;
  title?: string;
  description: string;
  components: DiagramComponent[];
  connections: DiagramConnection[];
  layers?: DiagramLayer[];
  code?: GeneratedCode;
  metadata: DiagramMetadata;
}

export interface DiagramComponent {
  id: string;
  type: string;
  label: string;
  position: BoundingBox;
  properties?: Record<string, unknown>;
  technologies?: string[];
}

export interface DiagramConnection {
  from: string;
  to: string;
  type: 'line' | 'arrow' | 'dashed' | 'bidirectional';
  label?: string;
  properties?: Record<string, unknown>;
}

export interface DiagramLayer {
  name: string;
  components: string[];
  dependencies: string[];
}

export interface GeneratedCode {
  language: CodeLanguage;
  code: string;
  framework?: string;
  dependencies: string[];
  files?: CodeFile[];
}

export interface CodeFile {
  path: string;
  content: string;
  language: CodeLanguage;
}

export interface DiagramMetadata {
  confidence: number;
  processingTime: number;
  provider: VisionProvider;
  complexity: 'low' | 'medium' | 'high';
}

// ============================================================================
// OCR Types
// ============================================================================

export type OCRLanguage =
  | 'eng'
  | 'spa'
  | 'fra'
  | 'deu'
  | 'chi_sim'
  | 'chi_tra'
  | 'jpn'
  | 'kor'
  | 'ara'
  | 'rus';

export interface OCRRecognitionOptions {
  image: Buffer | string;
  language?: OCRLanguage;
  preprocess?: boolean;
  enhanceContrast?: boolean;
  denoise?: boolean;
  segmentByLines?: boolean;
  preserveLayout?: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  lines: OCRLine[];
  blocks?: OCRBlock[];
  metadata: OCRMetadata;
}

export interface OCRLine {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  words?: OCRWord[];
}

export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface OCRBlock {
  type: 'text' | 'table' | 'image' | 'code';
  content: string;
  boundingBox: BoundingBox;
  confidence: number;
}

export interface OCRMetadata {
  engine: 'tesseract' | 'vision-api';
  language: OCRLanguage;
  processingTime: number;
  preprocessed: boolean;
  resolution?: ImageResolution;
}

export interface ImageResolution {
  width: number;
  height: number;
  dpi: number;
}

// ============================================================================
// Multimodal RAG Types
// ============================================================================

export interface EmbeddingVector {
  vector: number[];
  dimension: number;
  model: string;
}

export type MediaType = 'text' | 'image' | 'code' | 'diagram';

export interface MultimodalDocument {
  id: string;
  type: MediaType;
  content: string;
  embedding?: EmbeddingVector;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  source: string;
  timestamp: Date;
  author?: string;
  tags?: string[];
  language?: string;
  dependencies?: string[];
  confidence?: number;
}

export interface MultimodalSearchOptions {
  query: string | Buffer;
  mediaTypes?: MediaType[];
  limit?: number;
  threshold?: number;
  filters?: SearchFilter;
}

export interface SearchFilter {
  dateRange?: { start: Date; end: Date };
  tags?: string[];
  languages?: string[];
  authors?: string[];
}

export interface MultimodalSearchResult {
  documents: SearchResultItem[];
  metadata: SearchMetadata;
}

export interface SearchResultItem {
  document: MultimodalDocument;
  relevance: number;
  highlights?: string[];
  reasoning?: string;
}

export interface SearchMetadata {
  queryType: 'text' | 'image' | 'hybrid';
  processingTime: number;
  totalResults: number;
  searchedIndexes: string[];
}

// ============================================================================
// Visual Debugging Types
// ============================================================================

export interface VisualDebuggingOptions {
  image: Buffer | string;
  context?: string;
  reproduceSteps?: boolean;
  suggestFixes?: boolean;
}

export interface VisualDebuggingResult {
  issues: VisualIssue[];
  reproduction?: ReproductionGuide;
  fixes?: FixSuggestion[];
  metadata: DebuggingMetadata;
}

export interface VisualIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  position: BoundingBox;
  stackTrace?: string;
  expected?: string;
  actual?: string;
}

export interface ReproductionGuide {
  steps: string[];
  prerequisites: string[];
  environment?: Record<string, string>;
}

export interface FixSuggestion {
  issue: string;
  solution: string;
  code?: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DebuggingMetadata {
  provider: VisionProvider;
  processingTime: number;
  confidence: number;
  requiresContext: boolean;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface ImageStorageOptions {
  bucket?: string;
  key?: string;
  metadata?: Record<string, string>;
  contentType?: string;
}

export interface StoredImage {
  url: string;
  key: string;
  bucket: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  metadata?: Record<string, string>;
}

// ============================================================================
// Error Types
// ============================================================================

export class MultimodalError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MultimodalError';
  }
}

export class VisionError extends MultimodalError {
  constructor(message: string, details?: unknown) {
    super(message, 'VISION_ERROR', details);
    this.name = 'VisionError';
  }
}

export class OCRError extends MultimodalError {
  constructor(message: string, details?: unknown) {
    super(message, 'OCR_ERROR', details);
    this.name = 'OCRError';
  }
}

export class CodeExtractionError extends MultimodalError {
  constructor(message: string, details?: unknown) {
    super(message, 'CODE_EXTRACTION_ERROR', details);
    this.name = 'CodeExtractionError';
  }
}

export class DiagramAnalysisError extends MultimodalError {
  constructor(message: string, details?: unknown) {
    super(message, 'DIAGRAM_ERROR', details);
    this.name = 'DiagramAnalysisError';
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface MultimodalConfig {
  vision?: VisionConfig;
  ocr?: OCRConfig;
  storage?: StorageConfig;
  embedding?: EmbeddingConfig;
}

export interface VisionConfig {
  defaultProvider: VisionProvider;
  anthropic?: {
    apiKey: string;
    model?: string;
  };
  openai?: {
    apiKey: string;
    model?: string;
  };
  maxTokens?: number;
  temperature?: number;
}

export interface OCRConfig {
  engine: 'tesseract' | 'vision-api' | 'hybrid';
  tesseract?: {
    language: OCRLanguage;
    path?: string;
  };
  preprocessImages?: boolean;
  enhanceContrast?: boolean;
}

export interface StorageConfig {
  provider: 'r2' | 's3' | 'local';
  bucket: string;
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface EmbeddingConfig {
  model: string;
  dimension: number;
  batchSize: number;
  indexName: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface MultimodalResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    processingTime: number;
    timestamp: Date;
    version: string;
  };
}
