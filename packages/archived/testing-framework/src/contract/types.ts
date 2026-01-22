/**
 * Contract Testing Types
 * Provides types and interfaces for contract testing between services
 */

export interface Contract {
  id: string;
  name: string;
  version: string;
  provider: string;
  consumer: string;
  specification: ContractSpecification;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'deprecated' | 'pending';
}

export interface ContractSpecification {
  openapi?: OpenApiSpec;
  graphql?: GraphQlSpec;
  asyncapi?: AsyncApiSpec;
  custom?: any;
}

export interface OpenApiSpec {
  openapi: string;
  info: Info;
  servers: Server[];
  paths: Paths;
  components?: Components;
}

export interface GraphQlSpec {
  schema: string;
  queries: QueryDefinition[];
  mutations: MutationDefinition[];
  subscriptions?: SubscriptionDefinition[];
}

export interface AsyncApiSpec {
  asyncapi: string;
  info: Info;
  servers: Server[];
  channels: Channels;
  components?: Components;
}

export interface Info {
  title: string;
  version: string;
  description?: string;
}

export interface Server {
  url: string;
  description?: string;
  variables?: Record<string, Variable>;
}

export interface Variable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface Paths {
  [path: string]: PathItem;
}

export interface PathItem {
  summary?: string;
  description?: string;
  get?: Operation;
  put?: Operation;
  post?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  patch?: Operation;
  trace?: Operation;
}

export interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
  operationId: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Responses;
  callbacks?: Record<string, Callback>;
  deprecated?: boolean;
  security?: SecurityRequirement[];
  servers?: Server[];
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: ParameterStyle;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: Schema;
  example?: any;
  examples?: Record<string, Example>;
  content?: Record<string, MediaType>;
}

export type ParameterStyle = 'matrix' | 'label' | 'form' | 'simple' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';

export interface Schema {
  $id?: string;
  $ref?: string;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  not?: Schema;
  type: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: any;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  example?: any;
  externalDocs?: ExternalDocumentation;
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
  items?: Schema;
  properties?: Record<string, Schema>;
  additionalProperties?: Schema | boolean;
}

export interface MediaType {
  schema?: Schema;
  example?: any;
  examples?: Record<string, Example>;
  encoding?: Record<string, Encoding>;
}

export interface Example {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface Encoding {
  contentType?: string;
  headers?: Record<string, Header>;
  style?: ParameterStyle;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface Header extends Parameter {}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface Responses {
  [statusCode: string]: Response;
}

export interface Response {
  description: string;
  headers?: Record<string, Header>;
  content?: Record<string, MediaType>;
  links?: Record<string, Link>;
}

export interface Link {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: Server;
}

export interface Callback {
  [url: string]: PathItem;
}

export interface SecurityRequirement {
  [name: string]: string[];
}

export interface ExternalDocumentation {
  description?: string;
  url: string;
}

export interface Components {
  schemas?: Record<string, Schema>;
  responses?: Record<string, Response>;
  parameters?: Record<string, Parameter>;
  examples?: Record<string, Example>;
  requestBodies?: Record<string, RequestBody>;
  headers?: Record<string, Header>;
  securitySchemes?: Record<string, SecurityScheme>;
  links?: Record<string, Link>;
  callbacks?: Record<string, Callback>;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'mutualTLS';
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
  scopes?: Record<string, string>;
}

export interface QueryDefinition {
  name: string;
  description?: string;
  arguments: ArgumentDefinition[];
  returnType: string;
  example?: any;
}

export interface MutationDefinition {
  name: string;
  description?: string;
  arguments: ArgumentDefinition[];
  returnType: string;
  example?: any;
}

export interface SubscriptionDefinition {
  name: string;
  description?: string;
  arguments: ArgumentDefinition[];
  returnType: string;
  example?: any;
}

export interface ArgumentDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: any;
}

export interface Channels {
  [channel: string]: ChannelItem;
}

export interface ChannelItem {
  description?: string;
  subscribe?: Operation;
  publish?: Operation;
}

export interface ContractValidationResult {
  contractId: string;
  isValid: boolean;
  errors: ValidationError[];
  warnings: Warning[];
  metadata: ValidationMetadata;
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  details?: any;
}

export interface Warning {
  path: string;
  message: string;
  code: string;
}

export interface ValidationMetadata {
  validatedAt: Date;
  validatorVersion: string;
  executionTime: number;
  rules: RuleResult[];
}

export interface RuleResult {
  name: string;
  passed: boolean;
  message?: string;
  duration: number;
}

export interface TestResult {
  contractId: string;
  testName: string;
  passed: boolean;
  duration: number;
  error?: TestError;
  requests: TestRequest[];
  responses: TestResponse[];
}

export interface TestError {
  message: string;
  stack?: string;
  code?: string;
  details?: any;
}

export interface TestRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: Date;
}

export interface TestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: any;
  duration: number;
  timestamp: Date;
}