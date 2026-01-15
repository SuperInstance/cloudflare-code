/**
 * IAM-specific types
 */

import {
  User,
  Role,
  Permission,
  AccessDecision,
  AccessRequest,
  AccessContext
} from '../types';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  phone?: string;
  avatar?: string;
  preferences: UserProfilePreferences;
  metadata: Record<string, any>;
}

export interface UserProfilePreferences {
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: NotificationSettings;
  security: SecurityPreferences;
}

export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  push: boolean;
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
}

export interface SecurityPreferences {
  twoFactorEnabled: boolean;
  passwordlessLogin: boolean;
  sessionTimeout: number;
  rememberMe: boolean;
  trustedDevices: TrustedDevice[];
}

export interface TrustedDevice {
  deviceId: string;
  name: string;
  lastAccessed: Date;
  ipAddress: string;
  userAgent: string;
  isCurrent: boolean;
}

export interface IdentityProvider {
  id: string;
  name: string;
  type: 'saml' | 'oauth' | 'ldap' | 'active_directory';
  config: IdentityProviderConfig;
  enabled: boolean;
  priority: number;
}

export interface IdentityProviderConfig {
  clientId?: string;
  clientSecret?: string;
  endpoint?: string;
  baseDN?: string;
  bindDN?: string;
  bindPassword?: string;
  attributes: Record<string, string>;
  mapping: AttributeMapping;
}

export interface AttributeMapping {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles?: string;
}

export interface ProvisioningRule {
  id: string;
  name: string;
  conditions: ProvisioningCondition[];
  actions: ProvisioningAction[];
  priority: number;
  enabled: boolean;
}

export interface ProvisioningCondition {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'in' | 'not_in';
  value: any;
}

export interface ProvisioningAction {
  type: 'create' | 'update' | 'deactivate' | 'assign_role' | 'remove_role';
  parameters: Record<string, any>;
}

export interface AccessRequestPolicy {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  requiredPermissions: string[];
  approvalWorkflow: ApprovalWorkflow;
  enabled: boolean;
}

export interface ApprovalWorkflow {
  type: 'single' | 'multi' | 'escalation';
  approvers: Approver[];
  autoApprove?: boolean;
  conditions: ApprovalCondition[];
}

export interface Approver {
  type: 'role' | 'user' | 'manager';
  value: string;
  level: number;
}

export interface ApprovalCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than';
  value: any;
}

export interface AccessRequestReview {
  requestId: string;
  reviewer: string;
  decision: 'approved' | 'rejected' | 'deferred';
  comments: string;
  timestamp: Date;
}

export interface IdentityVerification {
  id: string;
  userId: string;
  method: 'email' | 'phone' | 'document' | 'biometric';
  status: 'pending' | 'verified' | 'failed' | 'expired';
  data: VerificationData;
  createdAt: Date;
  expiresAt?: Date;
}

export interface VerificationData {
  token?: string;
  documentId?: string;
  biometricData?: string;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface UserSessionSummary {
  userId: string;
  activeSessions: number;
  lastActive: Date;
  locations: string[];
  devices: string[];
  riskScore: number;
}

export interface IdentityAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  failedLogins: number;
  mfaAdoption: number;
  averageSessionDuration: number;
  topRiskyUsers: UserRiskScore[];
}

export interface UserRiskScore {
  userId: string;
  username: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
}

export interface RiskFactor {
  type: 'login_attempts' | 'unusual_location' | 'new_device' | 'time_anomaly' | 'policy_violation';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: Date;
}

export interface IdentityReport {
  id: string;
  name: string;
  type: 'user_summary' | 'access_review' | 'compliance' | 'risk_assessment';
  period: {
    start: Date;
    end: Date;
  };
  generatedAt: Date;
  data: Record<string, any>;
  insights: string[];
  recommendations: string[];
}

export interface UserLifecycleEvent {
  id: string;
  eventType: 'created' | 'activated' | 'deactivated' | 'updated' | 'deleted' | 'password_changed' | 'role_changed';
  userId: string;
  performedBy: string;
  timestamp: Date;
  details: Record<string, any>;
}

export interface AccessReview {
  id: string;
  name: string;
  description: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  reviewer: string;
  period: {
    start: Date;
    end: Date;
  };
  targetUsers: string[];
  findings: AccessReviewFinding[];
  completedAt?: Date;
}

export interface AccessReviewFinding {
  userId: string;
  userName: string;
  accessType: string;
  justification?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}