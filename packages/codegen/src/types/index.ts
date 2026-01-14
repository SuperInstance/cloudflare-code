/**
 * Core types and interfaces for the code generation package
 */

// ============================================================================
// Language Support
// ============================================================================

/**
 * Supported programming languages for code generation
 */
export enum Language {
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  Python = 'python',
  Go = 'go',
  Rust = 'rust',
  Java = 'java',
  CSharp = 'csharp',
  Cpp = 'cpp',
  PHP = 'php',
  Ruby = 'ruby',
  Swift = 'swift',
  Kotlin = 'kotlin',
  Dart = 'dart',
  Scala = 'scala'
}

/**
 * Language-specific configurations
 */
export interface LanguageConfig {
  language: Language;
  fileExtension: string;
  compiler?: string;
  packageManager?: string;
  testFramework?: string;
  linter?: string;
  formatter?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  templates: Record<string, string>;
}

// ============================================================================
// Code Generation Options
// ============================================================================

/**
 * Base options for all code generation operations
 */
export interface BaseGenerationOptions {
  language: Language;
  outputPath: string;
  overwrite?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  format?: boolean;
  lint?: boolean;
  typeCheck?: boolean;
  includeComments?: boolean;
  includeTests?: boolean;
  includeDocs?: boolean;
}

/**
 * Code synthesis options
 */
export interface SynthesisOptions extends BaseGenerationOptions {
  prompt: string;
  specification?: Specification;
  context?: CodeContext;
  optimization?: boolean;
  refactor?: boolean;
  completion?: boolean;
  explanation?: boolean;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Specification for code generation
 */
export interface Specification {
  name: string;
  description: string;
  version: string;
  requirements: Requirement[];
  constraints?: Constraint[];
  apis?: APISpec[];
  models?: ModelSpec[];
  components?: ComponentSpec[];
}

/**
 * Functional or non-functional requirement
 */
export interface Requirement {
  id: string;
  type: 'functional' | 'non-functional';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  acceptanceCriteria?: string[];
  dependencies?: string[];
}

/**
 * Constraint or limitation
 */
export interface Constraint {
  type: 'performance' | 'security' | 'scalability' | 'compliance' | 'technical';
  description: string;
  metric?: string;
  threshold?: number | string;
}

/**
 * API specification
 */
export interface APISpec {
  name: string;
  type: 'rest' | 'graphql' | 'grpc' | 'websocket';
  version: string;
  baseUrl: string;
  endpoints: Endpoint[];
  authentication?: AuthSpec;
  rateLimit?: RateLimitSpec;
}

/**
 * API endpoint
 */
export interface Endpoint {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  description: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Response[];
  errors?: ErrorSpec[];
  deprecated?: boolean;
}

/**
 * Parameter specification
 */
export interface Parameter {
  name: string;
  type: string;
  location: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description: string;
  schema?: JSONSchema;
  validation?: ValidationRule[];
}

/**
 * Request body specification
 */
export interface RequestBody {
  contentType: string;
  schema: JSONSchema;
  required: boolean;
  description: string;
  examples?: Record<string, unknown>;
}

/**
 * Response specification
 */
export interface Response {
  statusCode: number;
  description: string;
  contentType: string;
  schema?: JSONSchema;
  headers?: Record<string, string>;
  examples?: Record<string, unknown>;
}

/**
 * Error specification
 */
export interface ErrorSpec {
  code: string;
  statusCode: number;
  description: string;
  causes?: string[];
  resolution?: string;
}

/**
 * Authentication specification
 */
export interface AuthSpec {
  type: 'apiKey' | 'oauth2' | 'jwt' | 'basic' | 'bearer';
  description: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlow[];
}

/**
 * OAuth flow
 */
export interface OAuthFlow {
  type: 'implicit' | 'password' | 'clientCredentials' | 'authorizationCode';
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/**
 * Rate limit specification
 */
export interface RateLimitSpec {
  requests: number;
  period: number;
  periodUnit: 'second' | 'minute' | 'hour' | 'day';
  burst?: number;
}

/**
 * Data model specification
 */
export interface ModelSpec {
  name: string;
  description: string;
  fields: Field[];
  indexes?: Index[];
  relations?: Relation[];
  validations?: ValidationRule[];
}

/**
 * Model field
 */
export interface Field {
  name: string;
  type: string;
  nullable: boolean;
  unique?: boolean;
  indexed?: boolean;
  primaryKey?: boolean;
  foreignKey?: ForeignKey;
  defaultValue?: unknown;
  description?: string;
  validations?: ValidationRule[];
}

/**
 * Validation rule
 */
export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'email' | 'url' | 'range' | 'length' | 'custom';
  value?: unknown;
  message?: string;
  validator?: string;
}

/**
 * Database index
 */
export interface Index {
  name: string;
  fields: string[];
  unique?: boolean;
  type?: 'btree' | 'hash' | 'gin' | 'gist';
}

/**
 * Database relation
 */
export interface Relation {
  type: 'oneToOne' | 'oneToMany' | 'manyToMany';
  model: string;
  foreignKey: string;
  localKey?: string;
  pivotTable?: string;
}

/**
 * Foreign key
 */
export interface ForeignKey {
  table: string;
  column: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

/**
 * Component specification
 */
export interface ComponentSpec {
  name: string;
  type: 'ui' | 'service' | 'utility' | 'middleware' | 'controller';
  description: string;
  props?: PropSpec[];
  methods?: MethodSpec[];
  events?: EventSpec[];
  slots?: SlotSpec[];
}

/**
 * Component property
 */
export interface PropSpec {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description: string;
  validator?: string;
}

/**
 * Method specification
 */
export interface MethodSpec {
  name: string;
  parameters: Parameter[];
  returnType: string;
  description: string;
  async?: boolean;
  visibility?: 'public' | 'protected' | 'private';
  static?: boolean;
  implementation?: string;
}

/**
 * Event specification
 */
export interface EventSpec {
  name: string;
  payload?: JSONSchema;
  description: string;
  cancelable?: boolean;
}

/**
 * Slot specification
 */
export interface SlotSpec {
  name: string;
  description: string;
  fallback?: string;
  scope?: 'scoped' | 'unscoped';
}

/**
 * Code context for synthesis
 */
export interface CodeContext {
  files?: CodeFile[];
  dependencies?: Dependency[];
  environment?: Record<string, string>;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Code file
 */
export interface CodeFile {
  path: string;
  language: Language;
  content: string;
  exports?: Export[];
  imports?: Import[];
}

/**
 * Export declaration
 */
export interface Export {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'const' | 'default';
  exported?: string;
}

/**
 * Import declaration
 */
export interface Import {
  module: string;
  imports: string[];
  type: 'default' | 'named' | 'namespace' | 'side-effect';
}

/**
 * Dependency information
 */
export interface Dependency {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
}

// ============================================================================
// Boilerplate Generation
// ============================================================================

/**
 * Boilerplate generation options
 */
export interface BoilerplateOptions extends BaseGenerationOptions {
  template: string | Template;
  variables?: Record<string, unknown>;
  packageInfo?: PackageInfo;
  features?: string[];
  config?: BoilerplateConfig;
}

/**
 * Template specification
 */
export interface Template {
  name: string;
  description: string;
  version: string;
  author?: string;
  files: TemplateFile[];
  variables?: TemplateVariable[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  postInstall?: string[];
  inheritance?: TemplateInheritance;
}

/**
 * Template file
 */
export interface TemplateFile {
  path: string;
  template: string;
  condition?: string;
  executable?: boolean;
}

/**
 * Template variable
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
  options?: unknown[];
  validation?: string;
}

/**
 * Package information
 */
export interface PackageInfo {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  repository?: string;
  keywords?: string[];
}

/**
 * Boilerplate configuration
 */
export interface BoilerplateConfig {
  gitInit?: boolean;
  installDeps?: boolean;
  createReadme?: boolean;
  createLicense?: boolean;
  createChangelog?: boolean;
  createContributing?: boolean;
  createCodeOfConduct?: boolean;
  linter?: 'eslint' | 'prettier' | 'both';
  testFramework?: 'vitest' | 'jest' | 'mocha' | 'jasmine';
  buildTool?: 'webpack' | 'vite' | 'rollup' | 'esbuild' | 'tsc';
  packageManager?: 'npm' | 'yarn' | 'pnpm';
}

/**
 * Template inheritance
 */
export interface TemplateInheritance {
  extends: string;
  overrides?: Record<string, unknown>;
  exclude?: string[];
}

// ============================================================================
// API Client Generation
// ============================================================================

/**
 * API client generation options
 */
export interface APIClientOptions extends BaseGenerationOptions {
  spec: APISpec;
  specType: 'openapi' | 'swagger' | 'graphql' | 'custom';
  specPath?: string;
  clientName?: string;
  generateTypes?: boolean;
  generateDocs?: boolean;
  generateMocks?: boolean;
  validation?: boolean;
  axios?: boolean;
  fetch?: boolean;
}

/**
 * Generated API client
 */
export interface GeneratedAPIClient {
  name: string;
  files: GeneratedFile[];
  types: GeneratedType[];
  methods: GeneratedMethod[];
  documentation?: string;
  mocks?: GeneratedMock[];
}

/**
 * Generated file
 */
export interface GeneratedFile {
  path: string;
  content: string;
  language: Language;
}

/**
 * Generated type
 */
export interface GeneratedType {
  name: string;
  definition: string;
  description?: string;
  usage?: string;
}

/**
 * Generated method
 */
export interface GeneratedMethod {
  name: string;
  signature: string;
  description: string;
  parameters: Parameter[];
  returnType: string;
  implementation: string;
  examples: string[];
}

/**
 * Generated mock
 */
export interface GeneratedMock {
  endpoint: string;
  method: string;
  response: unknown;
  delay?: number;
  scenario?: string;
}

// ============================================================================
// SDK Generation
// ============================================================================

/**
 * SDK generation options
 */
export interface SDKOptions extends BaseGenerationOptions {
  spec: APISpec;
  sdkType: 'rest' | 'graphql' | 'grpc' | 'websocket';
  sdkName?: string;
  languages: Language[];
  generateExamples?: boolean;
  generateDocs?: boolean;
  includeRetry?: boolean;
  includeLogging?: boolean;
  includeMetrics?: boolean;
}

/**
 * Generated SDK
 */
export interface GeneratedSDK {
  name: string;
  version: string;
  language: Language;
  files: GeneratedFile[];
  types: GeneratedType[];
  classes: GeneratedClass[];
  functions: GeneratedFunction[];
  documentation: string;
  examples: CodeExample[];
}

/**
 * Generated class
 */
export interface GeneratedClass {
  name: string;
  description: string;
  properties: PropertySpec[];
  methods: GeneratedMethod[];
  constructors?: ConstructorSpec[];
  inheritance?: string;
}

/**
 * Property specification
 */
export interface PropertySpec {
  name: string;
  type: string;
  readonly: boolean;
  optional: boolean;
  description: string;
}

/**
 * Constructor specification
 */
export interface ConstructorSpec {
  parameters: Parameter[];
  description: string;
  implementation: string;
}

/**
 * Generated function
 */
export interface GeneratedFunction {
  name: string;
  signature: string;
  description: string;
  parameters: Parameter[];
  returnType: string;
  implementation: string;
  examples: string[];
}

/**
 * Code example
 */
export interface CodeExample {
  title: string;
  description: string;
  code: string;
  language: Language;
}

// ============================================================================
// Schema Generation
// ============================================================================

/**
 * Schema generation options
 */
export interface SchemaOptions extends BaseGenerationOptions {
  spec: Specification;
  schemaType: 'database' | 'typescript' | 'graphql' | 'protobuf' | 'jsonSchema' | 'openapi' | 'migration';
  database?: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite' | 'redis';
  generateIndexes?: boolean;
  generateRelations?: boolean;
  generateMigrations?: boolean;
  namingConvention?: 'camelCase' | 'snake_case' | 'PascalCase';
}

/**
 * Generated schema
 */
export interface GeneratedSchema {
  type: string;
  language: Language;
  tables?: TableSchema[];
  types?: GeneratedType[];
  enums?: EnumSchema[];
  migrations?: MigrationSchema[];
  relations?: Relation[];
  files: GeneratedFile[];
}

/**
 * Table schema
 */
export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  indexes?: Index[];
  foreignKeys?: ForeignKey[];
  constraints?: Constraint[];
  comment?: string;
}

/**
 * Column schema
 */
export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  defaultValue?: unknown;
  comment?: string;
}

/**
 * Enum schema
 */
export interface EnumSchema {
  name: string;
  values: string[];
  description?: string;
}

/**
 * Migration schema
 */
export interface MigrationSchema {
  name: string;
  version: string;
  up: string;
  down: string;
  description: string;
  timestamp?: number;
}

// ============================================================================
// Test Generation
// ============================================================================

/**
 * Test generation options
 */
export interface TestOptions extends BaseGenerationOptions {
  sourcePath: string;
  testType: 'unit' | 'integration' | 'e2e' | 'all';
  testFramework: 'vitest' | 'jest' | 'mocha' | 'jasmine';
  coverageTarget?: number;
  generateMocks?: boolean;
  generateFixtures?: boolean;
  generateScenarios?: boolean;
  assertionLibrary?: 'chai' | 'assert' | 'expect';
  mockingLibrary?: 'sinon' | 'testdouble' | 'msw';
}

/**
 * Generated test suite
 */
export interface GeneratedTestSuite {
  name: string;
  type: 'unit' | 'integration' | 'e2e';
  framework: string;
  files: GeneratedFile[];
  fixtures?: GeneratedFixture[];
  mocks?: GeneratedMock[];
  coverageTarget?: number;
}

/**
 * Generated test
 */
export interface GeneratedTest {
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e';
  setup: string;
  teardown: string;
  tests: TestCase[];
  coverage: number;
}

/**
 * Test case
 */
export interface TestCase {
  name: string;
  description: string;
  given: string;
  when: string;
  then: string;
  implementation: string;
  assertions: string[];
  mocks?: MockReference[];
}

/**
 * Mock reference
 */
export interface MockReference {
  name: string;
  type: string;
  setup: string;
  behavior: string;
}

/**
 * Generated fixture
 */
export interface GeneratedFixture {
  name: string;
  description: string;
  data: unknown;
  schema?: JSONSchema;
  usage: string;
}

// ============================================================================
// Documentation Generation
// ============================================================================

/**
 * Documentation generation options
 */
export interface DocsOptions extends BaseGenerationOptions {
  sourcePath: string;
  docType: 'api' | 'code' | 'readme' | 'architecture' | 'usage' | 'changelog' | 'all';
  format: 'markdown' | 'html' | 'json' | 'adoc';
  includeTypes?: boolean;
  includeExamples?: boolean;
  includeDiagrams?: boolean;
  toc?: boolean;
  searchIndex?: boolean;
  theme?: string;
}

/**
 * Generated documentation
 */
export interface GeneratedDocumentation {
  title: string;
  description: string;
  version: string;
  format: string;
  files: GeneratedFile[];
  sections: DocumentationSection[];
  api?: APIDocumentation;
  types?: TypeDocumentation;
  examples?: CodeExample[];
  diagrams?: Diagram[];
  toc?: TableOfContents;
  searchIndex?: SearchIndex;
}

/**
 * Documentation section
 */
export interface DocumentationSection {
  title: string;
  content: string;
  level: number;
  anchor: string;
  children?: DocumentationSection[];
}

/**
 * API documentation
 */
export interface APIDocumentation {
  endpoints: EndpointDoc[];
  models: ModelDoc[];
  errors: ErrorDoc[];
  authentication: AuthDoc;
}

/**
 * Endpoint documentation
 */
export interface EndpointDoc {
  name: string;
  method: string;
  path: string;
  description: string;
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Response[];
  examples: CodeExample[];
  errors?: ErrorSpec[];
}

/**
 * Model documentation
 */
export interface ModelDoc {
  name: string;
  description: string;
  fields: FieldDoc[];
  examples: unknown[];
}

/**
 * Field documentation
 */
export interface FieldDoc {
  name: string;
  type: string;
  description: string;
  required: boolean;
  nullable: boolean;
  example?: unknown;
}

/**
 * Error documentation
 */
export interface ErrorDoc {
  code: string;
  statusCode: number;
  description: string;
  causes?: string[];
  resolution?: string;
  example?: unknown;
}

/**
 * Authentication documentation
 */
export interface AuthDoc {
  type: string;
  description: string;
  setup: string;
  examples: CodeExample[];
}

/**
 * Type documentation
 */
export interface TypeDocumentation {
  types: TypeDoc[];
  interfaces: InterfaceDoc[];
  enums: EnumDoc[];
}

/**
 * Type documentation
 */
export interface TypeDoc {
  name: string;
  definition: string;
  description: string;
  properties: PropertyDoc[];
  methods?: MethodDoc[];
}

/**
 * Interface documentation
 */
export interface InterfaceDoc {
  name: string;
  description: string;
  properties: PropertyDoc[];
  methods: MethodDoc[];
  extends?: string[];
}

/**
 * Property documentation
 */
export interface PropertyDoc {
  name: string;
  type: string;
  description: string;
  readonly: boolean;
  optional: boolean;
}

/**
 * Method documentation
 */
export interface MethodDoc {
  name: string;
  description: string;
  parameters: Parameter[];
  returnType: string;
  signature: string;
  example?: string;
}

/**
 * Enum documentation
 */
export interface EnumDoc {
  name: string;
  description: string;
  values: EnumValueDoc[];
}

/**
 * Enum value documentation
 */
export interface EnumValueDoc {
  name: string;
  value: string | number;
  description: string;
}

/**
 * Diagram
 */
export interface Diagram {
  type: 'flowchart' | 'sequence' | 'class' | 'entity' | 'state';
  title: string;
  description: string;
  format: 'mermaid' | 'plantuml' | 'dot';
  source: string;
}

/**
 * Table of contents
 */
export interface TableOfContents {
  items: TOCItem[];
}

/**
 * TOC item
 */
export interface TOCItem {
  title: string;
  anchor: string;
  level: number;
  children?: TOCItem[];
}

/**
 * Search index
 */
export interface SearchIndex {
  entries: SearchIndexEntry[];
}

/**
 * Search index entry
 */
export interface SearchIndexEntry {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  url: string;
  category: string;
}

// ============================================================================
// JSON Schema
// ============================================================================

/**
 * JSON Schema definition
 */
export interface JSONSchema {
  $id?: string;
  $schema?: string;
  title?: string;
  description?: string;
  type?: JSONSchemaType;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  enum?: (string | number | boolean | null)[];
  const?: unknown;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  default?: unknown;
  examples?: unknown[];
  $ref?: string;
}

/**
 * JSON Schema types
 */
export type JSONSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

// ============================================================================
// Results and Errors
// ============================================================================

/**
 * Result of a code generation operation
 */
export interface GenerationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: GenerationError[];
  warnings?: string[];
  metadata?: GenerationMetadata;
}

/**
 * Generation error
 */
export interface GenerationError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  location?: ErrorLocation;
  stack?: string;
}

/**
 * Error location
 */
export interface ErrorLocation {
  file?: string;
  line?: number;
  column?: number;
  position?: number;
}

/**
 * Generation metadata
 */
export interface GenerationMetadata {
  duration: number;
  timestamp: Date;
  model?: string;
  tokensUsed?: number;
  filesGenerated: number;
  linesOfCode: number;
  languages: Language[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
  severity: 'warning';
}
