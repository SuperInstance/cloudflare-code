/**
 * Type definitions for event governance
 */

// ============================================================================
// Event Governance
// ============================================================================

export interface GovernancePolicy {
  policyId: string;
  name: string;
  description: string;
  type: 'validation' | 'transformation' | 'routing' | 'retention' | 'security';
  enabled: boolean;
  priority: number;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  createdAt: number;
  updatedAt: number;
}

export interface PolicyCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'gt' | 'lt' | 'exists';
  value?: unknown;
  negated?: boolean;
}

export interface PolicyAction {
  type: 'allow' | 'deny' | 'transform' | 'route' | 'tag' | 'alert';
  parameters?: Record<string, unknown>;
}

// ============================================================================
// Event Validation
// ============================================================================

export interface ValidationRule {
  ruleId: string;
  name: string;
  eventType: string;
  schema: string;
  strict: boolean;
  version: number;
  customValidators?: Array<{
    name: string;
    function: string;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  timestamp: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

// ============================================================================
// Event Retention
// ============================================================================

export interface RetentionPolicy {
  policyId: string;
  name: string;
  eventType?: string;
  duration: number; // milliseconds
  action: 'delete' | 'archive' | 'compress';
  archiveLocation?: string;
  criteria: RetentionCriteria[];
}

export interface RetentionCriteria {
  field: string;
  condition: string;
  value: unknown;
}

// ============================================================================
// Event Security
// ============================================================================

export interface SecurityPolicy {
  policyId: string;
  name: string;
  eventType?: string;
  authentication: {
    required: boolean;
    methods: string[];
  };
  authorization: {
    required: boolean;
    permissions: string[];
  };
  encryption: {
    atRest: boolean;
    inTransit: boolean;
    algorithm?: string;
  };
  audit: {
    enabled: boolean;
    logLevel: 'minimal' | 'standard' | 'verbose';
  };
}

export interface EventAuditLog {
  logId: string;
  eventId: string;
  eventType: string;
  action: string;
  userId?: string;
  serviceId?: string;
  timestamp: number;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
}

// ============================================================================
// Event Monitoring
// ============================================================================

export interface EventMetrics {
  eventType: string;
  timestamp: number;
  publishCount: number;
  errorCount: number;
  processingTimeMs: number;
  consumerLag: number;
  deadLetterCount: number;
}

export interface MonitoringRule {
  ruleId: string;
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'equals';
  windowMs: number;
  alert: {
    enabled: boolean;
    channels: string[];
    template: string;
  };
}

// ============================================================================
// Event Schema Registry
// ============================================================================

export interface SchemaRegistry {
  registerSchema(schema: EventSchemaDefinition): Promise<string>;
  getSchema(eventType: string, version?: number): Promise<EventSchemaDefinition>;
  validateEvent(eventType: string, version: number, payload: unknown): Promise<ValidationResult>;
  listSchemas(eventType?: string): Promise<EventSchemaDefinition[]>;
  evolveSchema(eventType: string, schema: unknown, strategy: EvolutionStrategy): Promise<void>;
}

export interface EventSchemaDefinition {
  schemaId: string;
  eventType: string;
  version: number;
  schema: unknown; // JSON Schema or other schema format
  compatibility: 'backward' | 'forward' | 'full' | 'none';
  dependencies?: string[];
  deprecated: boolean;
  createdAt: number;
  updatedAt: number;
}

export type EvolutionStrategy =
  | 'backward-compatible'
  | 'forward-compatible'
  | 'full-compatible'
  | 'breaking-change';

// ============================================================================
// Event Catalog
// ============================================================================

export interface EventCatalog {
  eventType: string;
  name: string;
  description: string;
  owner: string;
  schemaId: string;
  currentVersion: number;
  producers: string[];
  consumers: string[];
  tags: string[];
  documentation?: string;
  examples: EventExample[];
  governance: {
    retention?: RetentionPolicy;
    security?: SecurityPolicy;
    validation?: ValidationRule;
  };
}

export interface EventExample {
  name: string;
  description: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Compliance
// ============================================================================

export interface ComplianceReport {
  reportId: string;
  generatedAt: number;
  period: {
    from: number;
    to: number;
  };
  findings: ComplianceFinding[];
  summary: {
    totalEvents: number;
    compliantEvents: number;
    nonCompliantEvents: number;
    complianceRate: number;
  };
}

export interface ComplianceFinding {
  findingId: string;
  eventType: string;
  eventId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  policy: string;
  description: string;
  recommendation?: string;
}
