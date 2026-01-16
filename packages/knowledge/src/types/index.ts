/**
 * Type definitions for ClaudeFlare Knowledge Management
 */

// @ts-nocheck - External dependencies (type-fest)

import { type TypedArray } from 'type-fest';

// ============================================================================
// Core Documentation Types
// ============================================================================

export interface DocumentationOptions {
  inputPath: string;
  outputPath: string;
  format: 'markdown' | 'html' | 'pdf' | 'json';
  theme?: string;
  includePrivate?: boolean;
  includeInternal?: boolean;
  examples?: boolean;
  typeInfo?: boolean;
  sourceUrl?: string;
  version?: string;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  description: string;
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  version: string;
  tags: string[];
  category: string;
  language: string;
  sourcePath?: string;
  checksum?: string;
}

export interface DocumentContent {
  metadata: DocumentMetadata;
  content: string;
  html?: string;
  examples?: CodeExample[];
  references?: DocumentReference[];
  attachments?: Attachment[];
}

export interface CodeExample {
  id: string;
  language: string;
  code: string;
  description?: string;
  runnable?: boolean;
  dependencies?: string[];
  expectedOutput?: string;
}

export interface DocumentReference {
  id: string;
  type: 'internal' | 'external' | 'code';
  target: string;
  label: string;
  line?: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

// ============================================================================
// Knowledge Base Types
// ============================================================================

export interface KnowledgeBaseOptions {
  storage: StorageBackend;
  embeddings: EmbeddingProvider;
  search: SearchProvider;
  versioning?: boolean;
  accessControl?: boolean;
}

export interface StorageBackend {
  get(id: string): Promise<DocumentContent | null>;
  put(id: string, doc: DocumentContent): Promise<void>;
  delete(id: string): Promise<void>;
  list(filter?: DocumentFilter): Promise<DocumentMetadata[]>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  similarity(a: number[], b: number[]): number;
}

export interface SearchProvider {
  index(doc: DocumentContent): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  suggest(prefix: string): Promise<string[]>;
}

export interface DocumentFilter {
  category?: string;
  tags?: string[];
  language?: string;
  author?: string;
  dateRange?: { start: Date; end: Date };
  version?: string;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filter?: DocumentFilter;
  semantic?: boolean;
  fuzzy?: boolean;
  threshold?: number;
}

export interface SearchResult {
  document: DocumentMetadata;
  score: number;
  highlights: Highlight[];
  snippet?: string;
}

export interface Highlight {
  field: string;
  text: string;
  position: { start: number; end: number };
}

export interface DocumentRelationship {
  sourceId: string;
  targetId: string;
  type: 'reference' | 'dependency' | 'related' | 'see-also';
  strength: number;
}

// ============================================================================
// Documentation Site Types
// ============================================================================

export interface SiteConfig {
  title: string;
  description: string;
  logo?: string;
  baseUrl: string;
  theme: SiteTheme;
  navigation: NavigationItem[];
  search: SearchConfig;
  analytics?: AnalyticsConfig;
  deployment: DeploymentConfig;
}

export interface SiteTheme {
  name: string;
  colors: ColorScheme;
  typography: Typography;
  layout: LayoutConfig;
  components: ComponentConfig;
  customCss?: string;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  border: string;
  code: CodeColors;
  darkMode?: ColorScheme;
}

export interface CodeColors {
  background: string;
  foreground: string;
  keyword: string;
  string: string;
  comment: string;
  function: string;
  number: string;
  operator: string;
}

export interface Typography {
  fontFamily: {
    heading: string[];
    body: string[];
    code: string[];
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
  };
}

export interface LayoutConfig {
  maxWidth: string;
  sidebar: {
    width: string;
    collapsible: boolean;
    sticky: boolean;
  };
  toc: {
    enabled: boolean;
    depth: number;
    sticky: boolean;
  };
  editLink: boolean;
  prevNext: boolean;
}

export interface ComponentConfig {
  header: {
    enabled: boolean;
    search: boolean;
    themeToggle: boolean;
    languageSelector: boolean;
    githubLink?: string;
  };
  footer: {
    enabled: boolean;
    copyright?: string;
    links?: FooterLink[];
  };
  codeBlock: {
    lineNumbers: boolean;
    copyButton: boolean;
    preview: boolean;
  };
  feedback: {
    enabled: boolean;
    type: 'thumbs' | 'rating' | 'form';
  };
}

export interface NavigationItem {
  title: string;
  path?: string;
  items?: NavigationItem[];
  external?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
}

export interface SearchConfig {
  enabled: boolean;
  provider: 'lunr' | 'algolia' | 'custom';
  apiKey?: string;
  indexName?: string;
  facets?: string[];
}

export interface AnalyticsConfig {
  provider: 'google' | 'plausible' | 'custom';
  id?: string;
  domain?: string;
  customDomain?: string;
}

export interface DeploymentConfig {
  platform: 'workers' | 'pages' | 'vercel' | 'netlify' | 'custom';
  cname?: string;
  environment?: Record<string, string>;
}

export interface FooterLink {
  label: string;
  url: string;
}

export interface GeneratedSite {
  files: SiteFile[];
  config: SiteConfig;
  manifest: SiteManifest;
}

export interface SiteFile {
  path: string;
  content: string | Buffer;
  encoding?: 'utf8' | 'base64';
}

export interface SiteManifest {
  version: string;
  generatedAt: Date;
  pages: PageEntry[];
  assets: AssetEntry[];
  searchIndex?: SearchIndex;
}

export interface PageEntry {
  path: string;
  title: string;
  description: string;
  lastModified: Date;
  category?: string;
  tags?: string[];
}

export interface AssetEntry {
  path: string;
  type: 'image' | 'script' | 'style' | 'font' | 'other';
  size: number;
  checksum: string;
}

export interface SearchIndex {
  documents: SearchDocument[];
  fields: string[];
  ref: string;
}

export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  url: string;
  category?: string;
  tags?: string[];
}

// ============================================================================
// Code Documentation Types
// ============================================================================

export interface CodeDocumentationOptions {
  includePatterns: string[];
  excludePatterns?: string[];
  languages: SupportedLanguage[];
  outputFormat: 'markdown' | 'html' | 'json';
  includeSource?: boolean;
  includeExamples?: boolean;
  generateDiagrams?: boolean;
}

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java';

export interface ParsedDocumentation {
  filePath: string;
  language: SupportedLanguage;
  exports: ExportInfo[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  constants: ConstantInfo[];
  coverage: CoverageMetrics;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'constant' | 'enum';
  exported: boolean;
  default: boolean;
  documentation?: string;
  sourceLocation: SourceLocation;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements?: string[];
  isAbstract: boolean;
  isStatic: boolean;
  documentation: string;
  decorators: DecoratorInfo[];
  properties: PropertyInfo[];
  methods: MethodInfo[];
  sourceLocation: SourceLocation;
}

export interface PropertyInfo {
  name: string;
  type: TypeSignature;
  readonly: boolean;
  optional: boolean;
  visibility: 'public' | 'protected' | 'private';
  documentation?: string;
  defaultValue?: string;
  sourceLocation: SourceLocation;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: TypeSignature;
  async: boolean;
  generator: boolean;
  static: boolean;
  abstract: boolean;
  visibility: 'public' | 'protected' | 'private';
  documentation: string;
  examples: CodeExample[];
  sourceLocation: SourceLocation;
}

export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: TypeSignature;
  async: boolean;
  generator: boolean;
  documentation: string;
  examples: CodeExample[];
  sourceLocation: SourceLocation;
}

export interface ParameterInfo {
  name: string;
  type: TypeSignature;
  optional: boolean;
  rest: boolean;
  defaultValue?: string;
  documentation?: string;
}

export interface InterfaceInfo {
  name: string;
  extends?: string[];
  documentation: string;
  properties: PropertyInfo[];
  methods: MethodInfo[];
  sourceLocation: SourceLocation;
  callSignatures?: FunctionInfo[];
  indexSignatures?: IndexSignatureInfo[];
}

export interface IndexSignatureInfo {
  keyType: TypeSignature;
  valueType: TypeSignature;
  readonly: boolean;
  documentation?: string;
}

export interface TypeInfo {
  name: string;
  kind: 'alias' | 'enum' | 'union' | 'intersection' | 'tuple' | 'mapped';
  type: TypeSignature;
  documentation: string;
  sourceLocation: SourceLocation;
}

export interface TypeSignature {
  text: string;
  raw?: string;
  generics?: TypeSignature[];
  union?: TypeSignature[];
  intersection?: TypeSignature[];
  array?: TypeSignature;
  tuple?: TypeSignature[];
  mapped?: {
    key: TypeSignature;
    value: TypeSignature;
  };
}

export interface ConstantInfo {
  name: string;
  type: TypeSignature;
  value: string;
  documentation?: string;
  sourceLocation: SourceLocation;
}

export interface DecoratorInfo {
  name: string;
  arguments: any[];
}

export interface SourceLocation {
  filePath: string;
  line: number;
  column: number;
}

export interface CoverageMetrics {
  documented: number;
  total: number;
  percentage: number;
  byType: Record<string, { documented: number; total: number }>;
  undocumented: UndocumentedItem[];
}

export interface UndocumentedItem {
  name: string;
  type: string;
  location: SourceLocation;
  severity: 'error' | 'warning' | 'info';
}

export interface DocumentationQualityReport {
  overall: QualityScore;
  completeness: CompletenessMetrics;
  clarity: ClarityMetrics;
  consistency: ConsistencyMetrics;
  examples: ExamplesMetrics;
  suggestions: QualitySuggestion[];
}

export interface QualityScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface CompletenessMetrics {
  documentedSymbols: number;
  totalSymbols: number;
  documentedParameters: number;
  totalParameters: number;
  documentedReturnTypes: number;
  documentedExamples: number;
}

export interface ClarityMetrics {
  avgDescriptionLength: number;
  avgExampleComplexity: number;
  technicalLevel: 'beginner' | 'intermediate' | 'advanced';
  jargonCount: number;
}

export interface ConsistencyMetrics {
  namingConventions: number;
  formattingConsistency: number;
  structureConsistency: number;
}

export interface ExamplesMetrics {
  totalExamples: number;
  runnableExamples: number;
  testedExamples: number;
  avgExamplesPerSymbol: number;
}

export interface QualitySuggestion {
  type: 'missing-doc' | 'improve-doc' | 'add-example' | 'fix-typo' | 'update-type';
  severity: 'high' | 'medium' | 'low';
  location: SourceLocation;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Tutorial Types
// ============================================================================

export interface Tutorial {
  id: string;
  metadata: TutorialMetadata;
  sections: TutorialSection[];
  resources: TutorialResource[];
  assessment?: TutorialAssessment;
}

export interface TutorialMetadata {
  title: string;
  description: string;
  author?: string;
  duration: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  prerequisites: string[];
  learningObjectives: string[];
  language: string;
  version: string;
  updatedAt: Date;
}

export interface TutorialSection {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'exercise' | 'quiz' | 'video' | 'interactive';
  order: number;
  duration?: number;
  contentData?: SectionContentData;
}

export type SectionContentData = ExerciseData | QuizData | VideoData | InteractiveData;

export interface ExerciseData {
  instructions: string;
  startingCode: string;
  solution: string;
  hints: string[];
  tests: TestCase[];
  allowRun: boolean;
  showSolution: boolean;
}

export interface TestCase {
  name: string;
  input?: any;
  expected: any;
  type: 'unit' | 'integration' | 'property';
}

export interface QuizData {
  questions: QuizQuestion[];
  passingScore: number;
  randomize: boolean;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'code';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
}

export interface VideoData {
  url: string;
  duration: number;
  thumbnail?: string;
  transcript?: string;
  chapters?: VideoChapter[];
}

export interface VideoChapter {
  title: string;
  timestamp: number;
}

export interface InteractiveData {
  type: 'playground' | 'simulation' | 'visualization';
  config: Record<string, any>;
  data?: any;
}

export interface TutorialResource {
  id: string;
  type: 'link' | 'download' | 'reference' | 'glossary';
  title: string;
  url?: string;
  content?: string;
  order: number;
}

export interface TutorialAssessment {
  id: string;
  questions: QuizQuestion[];
  passingScore: number;
  timeLimit?: number;
  randomize: boolean;
  showAnswers: boolean;
  retakeAllowed: boolean;
}

export interface TutorialProgress {
  userId: string;
  tutorialId: string;
  completedSections: string[];
  currentSection?: string;
  quizScores: Record<string, number>;
  startedAt: Date;
  completedAt?: Date;
  lastAccessedAt: Date;
}

// ============================================================================
// API Reference Types
// ============================================================================

export interface APIReference {
  openapi: string;
  info: APIInfo;
  servers: APIServer[];
  paths: APIPaths;
  components: APIComponents;
  security?: APISecurityRequirement[];
  tags?: APITag[];
  externalDocs?: APIExternalDocs;
}

export interface APIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: APIContact;
  license?: APILicense;
}

export interface APIContact {
  name?: string;
  url?: string;
  email?: string;
}

export interface APILicense {
  name: string;
  url?: string;
}

export interface APIServer {
  url: string;
  description?: string;
  variables?: Record<string, APIServerVariable>;
}

export interface APIServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface APIPaths {
  [path: string]: {
    [method: string]: APIOperation;
  };
}

export interface APIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: APIExternalDocs;
  operationId?: string;
  parameters?: APIParameter[];
  requestBody?: APIRequestBody;
  responses: APIResponses;
  callbacks?: APICallbacks;
  deprecated?: boolean;
  security?: APISecurityRequirement[];
  servers?: APIServer[];
}

export interface APIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema: APISchema;
  example?: any;
  examples?: Record<string, APIExample>;
}

export interface APIRequestBody {
  description?: string;
  content: Record<string, APIMediaType>;
  required?: boolean;
}

export interface APIMediaType {
  schema: APISchema;
  example?: any;
  examples?: Record<string, APIExample>;
  encoding?: Record<string, APIEncoding>;
}

export interface APIEncoding {
  contentType?: string;
  headers?: Record<string, APIHeader>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface APIResponses {
  [code: string]: APIResponse;
}

export interface APIResponse {
  description: string;
  headers?: Record<string, APIHeader>;
  content?: Record<string, APIMediaType>;
  links?: Record<string, APILink>;
}

export interface APIHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema: APISchema;
  example?: any;
  examples?: Record<string, APIExample>;
}

export interface APILink {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: APIServer;
}

export interface APICallbacks {
  [name: string]: {
    [expression: string]: APIOperation;
  };
}

export interface APIComponents {
  schemas?: Record<string, APISchema>;
  responses?: Record<string, APIResponse>;
  parameters?: Record<string, APIParameter>;
  examples?: Record<string, APIExample>;
  requestBodies?: Record<string, APIRequestBody>;
  headers?: Record<string, APIHeader>;
  securitySchemes?: Record<string, APISecurityScheme>;
  links?: Record<string, APILink>;
  callbacks?: Record<string, APICallbacks>;
}

export interface APISchema {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  default?: any;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];
  const?: any;
  allOf?: APISchema[];
  anyOf?: APISchema[];
  oneOf?: APISchema[];
  not?: APISchema;
  items?: APISchema;
  properties?: Record<string, APISchema>;
  additionalProperties?: APISchema | boolean;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: any;
  externalDocs?: APIExternalDocs;
  example?: any;
  deprecated?: boolean;
  $ref?: string;
}

export interface APIExample {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface APISecurityRequirement {
  [name: string]: string[];
}

export interface APISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface APITag {
  name: string;
  description?: string;
  externalDocs?: APIExternalDocs;
}

export interface APIExternalDocs {
  description?: string;
  url: string;
}

export interface ChangelogEntry {
  version: string;
  date: Date;
  type: 'major' | 'minor' | 'patch';
  description: string;
  changes: ChangelogChange[];
  author?: string;
}

export interface ChangelogChange {
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  description: string;
  scope?: string;
  breaking?: boolean;
  pr?: number;
  issue?: number;
}

// ============================================================================
// AI Assistant Types
// ============================================================================

export interface AIAssistantOptions {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  contextSize?: number;
}

export interface DocumentationRequest {
  type: 'generate' | 'improve' | 'translate' | 'summarize' | 'expand';
  content: string;
  context?: DocumentationContext;
  options?: DocumentationOptions;
}

export interface DocumentationContext {
  language: SupportedLanguage;
  framework?: string;
  audience: 'beginner' | 'intermediate' | 'advanced';
  purpose: string;
  relatedDocs?: string[];
}

export interface DocumentationSuggestion {
  type: SuggestionType;
  content: string;
  explanation: string;
  confidence: number;
  alternatives?: string[];
}

export type SuggestionType =
  | 'improve-clarity'
  | 'add-example'
  | 'fix-grammar'
  | 'enhance-description'
  | 'add-see-also'
  | 'add-parameters'
  | 'add-returns'
  | 'add-throws'
  | 'simplify';

export interface GrammarCheckResult {
  errors: GrammarError[];
  warnings: GrammarWarning[];
  score: number;
  suggestions: string[];
}

export interface GrammarError {
  message: string;
  position: { start: number; end: number };
  suggestions: string[];
  rule: string;
}

export interface GrammarWarning {
  message: string;
  position: { start: number; end: number };
  suggestions: string[];
  rule: string;
}

export interface SEOOptimization {
  title: SEOSuggestion[];
  description: SEOSuggestion[];
  keywords: string[];
  metaTags: MetaTag[];
}

export interface SEOSuggestion {
  text: string;
  current?: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface MetaTag {
  name: string;
  content: string;
}

// ============================================================================
// Version Control Types
// ============================================================================

export interface VersionControlConfig {
  provider: 'git' | 'github' | 'gitlab' | 'bitbucket';
  repository: string;
  branch?: string;
  token?: string;
}

export interface VersionedDocument {
  content: DocumentContent;
  version: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  timestamp: Date;
  diff?: DocumentDiff;
}

export interface DocumentDiff {
  additions: number;
  deletions: number;
  changes: DiffChange[];
}

export interface DiffChange {
  type: 'addition' | 'deletion' | 'modification';
  lineNumber: number;
  content: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class DocumentationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DocumentationError';
  }
}

export class GenerationError extends DocumentationError {
  constructor(message: string, details?: any) {
    super(message, 'GENERATION_ERROR', details);
    this.name = 'GenerationError';
  }
}

export class ValidationError extends DocumentationError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class StorageError extends DocumentationError {
  constructor(message: string, details?: any) {
    super(message, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

export class SearchError extends DocumentationError {
  constructor(message: string, details?: any) {
    super(message, 'SEARCH_ERROR', details);
    this.name = 'SearchError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;
