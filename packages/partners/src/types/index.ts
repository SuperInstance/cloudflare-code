/**
 * Partner Integration Types
 * Defines all types for partner integrations, OAuth, webhooks, and monitoring
 */

// ============================================================================
// Core Integration Types
// ============================================================================

export interface Partner {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo?: string;
  website: string;
  documentation?: string;
  category: IntegrationCategory;
  status: 'active' | 'beta' | 'deprecated';
  capabilities: IntegrationCapability[];
  authMethods: AuthMethod[];
  webhookEvents: string[];
  rateLimits?: RateLimit;
  createdAt: Date;
  updatedAt: Date;
}

export type IntegrationCategory =
  | 'git'
  | 'project-management'
  | 'communication'
  | 'cicd'
  | 'code-quality'
  | 'documentation'
  | 'monitoring'
  | 'analytics'
  | 'storage'
  | 'other';

export type IntegrationCapability =
  | 'oauth'
  | 'oidc'
  | 'webhooks'
  | 'api'
  | 'realtime'
  | 'files'
  | 'webauthn'
  | 'sso'
  | 'scim'
  | 'audit';

export type AuthMethod =
  | 'oauth2'
  | 'oidc'
  | 'api-key'
  | 'basic-auth'
  | 'token'
  | 'jwt'
  | 'webhook';

export interface RateLimit {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  concurrentRequests?: number;
}

export interface IntegrationConfig {
  id: string;
  partnerId: string;
  userId: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  authConfig: AuthConfig;
  webhookConfig?: WebhookConfig;
  settings: Record<string, unknown>;
  syncSettings?: SyncSettings;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}

export interface AuthConfig {
  method: AuthMethod;
  credentials: Record<string, unknown>;
  scopes?: string[];
  expiresAt?: Date;
  refreshToken?: string;
}

export interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
  headers?: Record<string, string>;
  retryConfig?: RetryConfig;
  signatureAlgorithm?: 'sha256' | 'sha512';
}

export interface SyncSettings {
  enabled: boolean;
  interval?: number;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  syncOnEvent?: string[];
}

// ============================================================================
// OAuth/OIDC Types
// ============================================================================

export interface OAuthProvider {
  id: string;
  name: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  jwksUri?: string;
  revocationEndpoint?: string;
  registrationEndpoint?: string;
  scopes: string[];
  defaultScopes: string[];
  pkce: boolean;
  state: boolean;
  tokenEndpointAuth: 'client_secret_basic' | 'client_secret_post' | 'private_key_jwt' | 'none';
  responseType: 'code' | 'token' | 'id_token';
  grantType: 'authorization_code' | 'client_credentials' | 'refresh_token' | 'password';
  additionalParameters?: Record<string, string>;
}

export interface OIDCProvider extends OAuthProvider {
  issuer: string;
  subjectType: 'public' | 'pairwise';
  idTokenSigningAlg: string[];
  idTokenEncryptionAlg?: string[];
  idTokenEncryptionEnc?: string[];
  userinfoSigningAlg?: string[];
  userinfoEncryptionAlg?: string[];
  userinfoEncryptionEnc?: string[];
  requestObjectSigningAlg?: string[];
  requestObjectEncryptionAlg?: string[];
  requestObjectEncryptionEnc?: string[];
  tokenEndpointAuthSigningAlg?: string[];
  claimsSupported: string[];
  claimsParameterSupported: boolean;
  requestParameterSupported: boolean;
  requestUriParameterSupported: boolean;
  requireRequestUriRegistration: boolean;
  frontchannelLogoutSupported: boolean;
  frontchannelLogoutSessionRequired: boolean;
  backchannelLogoutSupported: boolean;
  backchannelLogoutSessionRequired: boolean;
  acrValuesSupported?: string[];
}

export interface OAuthClient {
  id: string;
  partnerId: string;
  name: string;
  clientId: string;
  clientSecret: string;
  clientSecretExpiresAt?: Date;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  scope: string;
  scopePermissions?: ScopePermission[];
  tokenEndpointAuthMethod: string;
  jwks?: Record<string, unknown>;
  softwareId?: string;
  softwareVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScopePermission {
  scope: string;
  consentRequired: boolean;
  description: string;
}

export interface OAuthSession {
  id: string;
  state: string;
  codeVerifier?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'plain' | 'S256';
  redirectUri: string;
  partnerId: string;
  clientId: string;
  scopes: string[];
  responseTypes: string[];
  statePayload?: Record<string, unknown>;
  nonce?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface OAuthToken {
  id: string;
  partnerId: string;
  clientId: string;
  userId?: string;
  workspaceId?: string;
  accessToken: string;
  tokenType: 'Bearer' | 'mac' | 'DPoP';
  expiresIn: number;
  refreshToken?: string;
  idToken?: string;
  scope: string;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface Webhook {
  id: string;
  partnerId: string;
  integrationId: string;
  url: string;
  secret: string;
  events: string[];
  headers?: Record<string, string>;
  enabled: boolean;
  version: number;
  retryConfig: RetryConfig;
  rateLimitPerSecond?: number;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors?: string[];
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  attemptNumber: number;
  payload: unknown;
  headers: Record<string, string>;
  responseStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  duration: number;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  deliveredAt?: Date;
  nextRetryAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  source: string;
  data: unknown;
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookSignature {
  timestamp: string;
  signature: string;
  algorithm: string;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  deliveryId?: string;
  eventType: string;
  action: 'created' | 'updated' | 'deleted' | 'delivered' | 'failed' | 'retrying';
  status: number;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface IntegrationMetrics {
  partnerId: string;
  integrationId: string;
  timestamp: Date;
  apiCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  webhookDeliveries: number;
  webhookSuccessRate: number;
  errorRate: number;
  rateLimitHits: number;
}

export interface IntegrationAlert {
  id: string;
  integrationId: string;
  type: 'error-rate' | 'latency' | 'webhook-failure' | 'rate-limit' | 'auth-expiry' | 'custom';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface IntegrationHealth {
  integrationId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  uptime: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  lastCheck: Date;
  responseTime?: number;
}

export interface UsageStats {
  partnerId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  timestamp: Date;
  totalUsers: number;
  activeUsers: number;
  totalApiCalls: number;
  totalWebhooks: number;
  avgLatency: number;
  errorRate: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface PartnerAPIKey {
  id: string;
  partnerId: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  revoked: boolean;
  revokedAt?: Date;
}

export interface APICallLog {
  id: string;
  partnerId: string;
  apiKeyId?: string;
  userId?: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface APIQuota {
  partnerId: string;
  userId?: string;
  period: 'minute' | 'hour' | 'day' | 'month';
  limit: number;
  remaining: number;
  resetAt: Date;
}

// ============================================================================
// Integration Template Types
// ============================================================================

export interface IntegrationTemplate {
  id: string;
  partnerId: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  version: string;
  author: string;
  documentation?: string;
  authConfig: AuthMethod[];
  webhookEvents: string[];
  actions: TemplateAction[];
  triggers: TemplateTrigger[];
  configuration: TemplateConfiguration[];
  permissions: TemplatePermission[];
  examples?: TemplateExample[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateAction {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  endpoint?: string;
  method?: string;
  requiredScopes: string[];
}

export interface TemplateTrigger {
  id: string;
  name: string;
  description: string;
  eventType: string;
  filterSchema?: Record<string, unknown>;
  requiredScopes: string[];
}

export interface TemplateConfiguration {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'textarea';
  label: string;
  description?: string;
  required: boolean;
  default?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  validation?: ValidationRule;
  sensitive?: boolean;
}

export interface ValidationRule {
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  custom?: string;
}

export interface TemplatePermission {
  scope: string;
  description: string;
  required: boolean;
}

export interface TemplateExample {
  name: string;
  description: string;
  config: Record<string, unknown>;
  code?: string;
}

// ============================================================================
// Marketplace Types
// ============================================================================

export interface MarketplaceListing {
  id: string;
  partnerId: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  longDescription?: string;
  category: IntegrationCategory;
  logo: string;
  screenshots?: string[];
  documentation?: string;
  website?: string;
  supportUrl?: string;
  privacyUrl?: string;
  tosUrl?: string;
  pricing?: PricingInfo;
  features: string[];
  highlights?: string[];
  ratings: RatingInfo;
  installCount: number;
  verified: boolean;
  featured: boolean;
  status: 'published' | 'draft' | 'archived';
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingInfo {
  free: boolean;
  pricingModel: 'free' | 'freemium' | 'paid' | 'enterprise';
  plans?: PricingPlan[];
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly' | 'one-time';
  features: string[];
}

export interface RatingInfo {
  average: number;
  count: number;
  distribution: Record<number, number>;
}

export interface Review {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Event Types
// ============================================================================

export interface IntegrationEvent {
  id: string;
  type: string;
  partnerId: string;
  integrationId: string;
  userId: string;
  workspaceId: string;
  data: Record<string, unknown>;
  timestamp: Date;
  correlationId?: string;
}

export type IntegrationEventType =
  | 'integration.created'
  | 'integration.updated'
  | 'integration.deleted'
  | 'integration.enabled'
  | 'integration.disabled'
  | 'integration.auth.expired'
  | 'integration.auth.refreshed'
  | 'integration.sync.started'
  | 'integration.sync.completed'
  | 'integration.sync.failed'
  | 'webhook.created'
  | 'webhook.updated'
  | 'webhook.deleted'
  | 'webhook.delivered'
  | 'webhook.failed'
  | 'api.call.succeeded'
  | 'api.call.failed'
  | 'quota.exceeded'
  | 'alert.triggered'
  | 'alert.resolved';
