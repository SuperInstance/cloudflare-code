/**
 * DDoS Protection Type Definitions
 */

/**
 * Represents an incoming HTTP request for analysis
 */
export interface RequestData {
  id: string;
  timestamp: number;
  ip: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  userAgent: string;
  referer?: string;
  body?: any;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  geo?: GeoData;
  fingerprint?: string;
}

/**
 * Geographic location data
 */
export interface GeoData {
  country: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  asn?: number;
  timezone?: string;
}

/**
 * Request pattern metrics
 */
export interface RequestMetrics {
  totalRequests: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  uniqueIps: number;
  topPaths: PathMetric[];
  topUserAgents: UserAgentMetric[];
  statusCodes: Record<number, number>;
}

/**
 * Path-specific metrics
 */
export interface PathMetric {
  path: string;
  count: number;
  averageResponseTime: number;
  errorRate: number;
}

/**
 * User agent metrics
 */
export interface UserAgentMetric {
  userAgent: string;
  count: number;
  isBot: boolean;
  reputation: number;
}

/**
 * Traffic analysis results
 */
export interface TrafficAnalysis {
  requestData: RequestData;
  metrics: RequestMetrics;
  patterns: PatternAnalysis;
  anomalies: Anomaly[];
  riskScore: number;
  recommendations: string[];
}

/**
 * Pattern analysis results
 */
export interface PatternAnalysis {
  attackType?: AttackType;
  confidence: number;
  indicators: string[];
  patterns: string[];
  behavioralScore: number;
}

/**
 * Anomaly detection result
 */
export interface Anomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  confidence: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Attack type enumeration
 */
export enum AttackType {
  VOLUMETRIC = 'volumetric',
  PROTOCOL = 'protocol',
  APPLICATION = 'application',
  BOT = 'bot',
  HTTP_FLOOD = 'http_flood',
  SLOWLORIS = 'slowloris',
  DNS_AMPLIFICATION = 'dns_amplification',
  NTP_AMPLIFICATION = 'ntp_amplification',
  SSDP_REFLECTION = 'ssdp_reflection',
  SYN_FLOOD = 'syn_flood',
  UDP_FLOOD = 'udp_flood',
  ICMP_FLOOD = 'icmp_flood',
  UNKNOWN = 'unknown'
}

/**
 * Anomaly type enumeration
 */
export enum AnomalyType {
  HIGH_VOLUME = 'high_volume',
  HIGH_ERROR_RATE = 'high_error_rate',
  UNUSUAL_PATTERN = 'unusual_pattern',
  SUSPICIOUS_USER_AGENT = 'suspicious_user_agent',
  GEOGRAPHIC_ANOMALY = 'geographic_anomaly',
  BEHAVIORAL_ANOMALY = 'behavioral_anomaly',
  SIGNATURE_MATCH = 'signature_match',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded'
}

/**
 * Anomaly severity levels
 */
export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Attack detection result
 */
export interface AttackDetection {
  isAttack: boolean;
  attackType: AttackType;
  confidence: number;
  severity: AnomalySeverity;
  sourceIps: string[];
  affectedEndpoints: string[];
  estimatedImpact: ImpactAssessment;
  mitigationRecommended: MitigationAction[];
  timestamp: number;
  id: string;
}

/**
 * Impact assessment
 */
export interface ImpactAssessment {
  availabilityImpact: number;
  performanceImpact: number;
  resourceUsage: number;
  estimatedTrafficLoss: number;
  duration?: number;
}

/**
 * Mitigation action types
 */
export enum MitigationActionType {
  RATE_LIMIT = 'rate_limit',
  IP_BLOCK = 'ip_block',
  GEO_BLOCK = 'geo_block',
  CHALLENGE = 'challenge',
  BLACKHOLE = 'blackhole',
  TRAFFIC_SHAPING = 'traffic_shaping',
  CONNECTION_LIMIT = 'connection_limit',
  CAPTCHA = 'captcha',
  JS_CHALLENGE = 'js_challenge',
  MANAGED_CHALLENGE = 'managed_challenge'
}

/**
 * Mitigation action
 */
export interface MitigationAction {
  type: MitigationActionType;
  target: string;
  parameters: Record<string, any>;
  duration?: number;
  priority: number;
  timestamp: number;
}

/**
 * Mitigation result
 */
export interface MitigationResult {
  action: MitigationAction;
  success: boolean;
  timeToMitigate: number;
  affectedRequests: number;
  falsePositiveRate: number;
  timestamp: number;
  metrics: MitigationMetrics;
}

/**
 * Mitigation metrics
 */
export interface MitigationMetrics {
  trafficBlocked: number;
  trafficAllowed: number;
  averageLatency: number;
  cpuUsage: number;
  memoryUsage: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstSize: number;
  windowSize: number;
}

/**
 * IP reputation data
 */
export interface IPReputation {
  ip: string;
  score: number;
  category: ReputationCategory;
  lastSeen: number;
  totalRequests: number;
  maliciousRequests: number;
  isTor: boolean;
  isVpn: boolean;
  isProxy: boolean;
  isDatacenter: boolean;
  abuseScore: number;
  confidence: number;
}

/**
 * Reputation categories
 */
export enum ReputationCategory {
  TRUSTED = 'trusted',
  NEUTRAL = 'neutral',
  SUSPICIOUS = 'suspicious',
  MALICIOUS = 'malicious',
  KNOWN_ATTACKER = 'known_attacker'
}

/**
 * Challenge types
 */
export enum ChallengeType {
  JAVASCRIPT = 'javascript',
  CAPTCHA = 'captcha',
  HCAPTCHA = 'hcaptcha',
  RECAPTCHA = 'recaptcha',
  TURNSTILE = 'turnstile',
  CUSTOM = 'custom'
}

/**
 * Challenge configuration
 */
export interface ChallengeConfig {
  type: ChallengeType;
  difficulty: number;
  timeout: number;
  siteKey?: string;
  secretKey?: string;
  customConfig?: Record<string, any>;
}

/**
 * Challenge result
 */
export interface ChallengeResult {
  passed: boolean;
  challengeType: ChallengeType;
  solveTime: number;
  token?: string;
  score?: number;
  error?: string;
}

/**
 * Analytics data
 */
export interface AnalyticsData {
  period: TimePeriod;
  totalRequests: number;
  blockedRequests: number;
  attacksDetected: number;
  attacksMitigated: number;
  topAttackTypes: Record<AttackType, number>;
  topSourceCountries: Record<string, number>;
  averageResponseTime: number;
  peakRequestsPerSecond: number;
  riskScore: number;
}

/**
 * Time period for analytics
 */
export enum TimePeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year'
}

/**
 * DDoS protection configuration
 */
export interface DDoSProtectionConfig {
  enabled: boolean;
  rateLimiting: RateLimitConfig;
  ipReputation: boolean;
  challengePlatform: boolean;
  analytics: boolean;
  mitigationMode: MitigationMode;
  whitelist: string[];
  blacklist: string[];
  geoWhitelist: string[];
  geoBlacklist: string[];
  thresholds: Thresholds;
  notifications: NotificationConfig;
}

/**
 * Mitigation mode
 */
export enum MitigationMode {
  MONITOR = 'monitor',
  MITIGATE = 'mitigate',
  AGGRESSIVE = 'aggressive'
}

/**
 * Detection thresholds
 */
export interface Thresholds {
  requestsPerSecond: number;
  errorRate: number;
  responseTime: number;
  anomalyScore: number;
  riskScore: number;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  enabled: boolean;
  webhook?: string;
  email?: string[];
  slack?: string;
  pagerduty?: string;
  thresholds: {
    warning: number;
    critical: number;
  };
}

/**
 * Attack signature
 */
export interface AttackSignature {
  id: string;
  name: string;
  pattern: RegExp | string;
  attackType: AttackType;
  severity: AnomalySeverity;
  description: string;
  mitigationAction: MitigationActionType;
}

/**
 * Statistics snapshot
 */
export interface StatisticsSnapshot {
  timestamp: number;
  requests: number;
  blocked: number;
  challenged: number;
  allowed: number;
  errors: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
}

/**
 * Real-time monitoring data
 */
export interface RealtimeMonitoring {
  currentRps: number;
  averageResponseTime: number;
  activeConnections: number;
  blockedRequests: number;
  ongoingAttacks: OngoingAttack[];
  systemHealth: SystemHealth;
}

/**
 * Ongoing attack information
 */
export interface OngoingAttack {
  id: string;
  type: AttackType;
  startTime: number;
  duration: number;
  severity: AnomalySeverity;
  sourceIps: string[];
  mitigationActive: boolean;
}

/**
 * System health status
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'under_attack' | 'down';
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

/**
 * Cloudflare-specific types
 */
export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  zoneId: string;
  edgeFunctions: boolean;
  cacheEnabled: boolean;
}

/**
 * Mitigation rule
 */
export interface MitigationRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: RuleCondition;
  action: MitigationAction;
  priority: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Rule condition
 */
export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: any;
  logicalOperator?: LogicalOperator;
}

/**
 * Rule operators
 */
export enum RuleOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  REGEX = 'regex',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN = 'in',
  NOT_IN = 'not_in',
  IP_IN_RANGE = 'ip_in_range'
}

/**
 * Logical operators for combining conditions
 */
export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not'
}

/**
 * Traffic shaping parameters
 */
export interface TrafficShapingParams {
  maxBandwidth?: number;
  maxConnections?: number;
  maxRequestsPerSecond?: number;
  priority?: number;
  queueSize?: number;
}

/**
 * IP range for blocking/allowing
 */
export interface IPRange {
  start: string;
  end: string;
  cidr: string;
  description?: string;
}

/**
 * WAF (Web Application Firewall) rule
 */
export interface WAFRule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  action: 'block' | 'challenge' | 'log' | 'allow';
  severity: AnomalySeverity;
  enabled: boolean;
}

/**
 * SSL/TLS configuration
 */
export interface SSLConfig {
  minVersion: string;
  ciphers: string[];
  hstsEnabled: boolean;
  hstsMaxAge: number;
}

/**
 * Bot detection result
 */
export interface BotDetection {
  isBot: boolean;
  botType?: BotType;
  confidence: number;
  reasons: string[];
}

/**
 * Bot types
 */
export enum BotType {
  GOOD_BOT = 'good_bot',
  BAD_BOT = 'bad_bot',
  SEARCH_ENGINE = 'search_engine',
  MONITORING = 'monitoring',
  SCRAPPER = 'scrapper',
  UNKNOWN = 'unknown'
}
