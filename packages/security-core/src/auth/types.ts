/**
 * Authentication-specific types
 */

import {
  User,
  AuthToken,
  OAuth2Config,
  SAML2Config,
  Session,
  MfaChallenge,
  MfaMethod
} from '../types';

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  mfaCode?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: AuthToken;
  user?: User;
  error?: string;
  requiresMFA?: boolean;
  mfaChallenge?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}

export interface RegisterResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  accessToken: string;
  refreshToken?: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface OAuth2CallbackRequest {
  code: string;
  state?: string;
}

export interface OAuth2CallbackResponse {
  success: boolean;
  token?: AuthToken;
  user?: User;
  error?: string;
}

export interface OAuth2AuthorizationUrlResponse {
  url: string;
  state: string;
  codeVerifier?: string;
}

export interface SAML2Assertion {
  id: string;
  issueInstant: string;
  issuer: string;
  subject: Subject;
  conditions: Conditions;
  attributes: Record<string, string>;
  signature?: string;
}

export interface Subject {
  nameId: string;
  nameIdFormat?: string;
  subjectConfirmation?: SubjectConfirmation;
}

export interface SubjectConfirmation {
  method: string;
  recipient?: string;
  subjectConfirmationData?: string;
}

export interface Conditions {
  notBefore: string;
  notOnOrAfter: string;
  audienceRestrictions?: AudienceRestriction[];
}

export interface AudienceRestriction {
  audience: string;
}

export interface AuthProvider {
  name: string;
  type: 'oauth2' | 'saml2' | 'local';
  config: OAuth2Config | SAML2Config;
  enabled: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtAlgorithm: string;
  jwtExpiry: number;
  refreshTokenExpiry: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  mfaRequired: boolean;
  allowedProviders: AuthProvider[];
  sessionTimeout: number;
  cookieSecure: boolean;
  cookieDomain?: string;
  cookieSameSite: 'strict' | 'lax' | 'none';
}

export interface AuthEvent {
  type: 'login' | 'logout' | 'password_change' | 'mfa_setup' | 'mfa_verify' | 'password_reset';
  userId: string;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  details?: Record<string, any>;
}

export interface SessionConfig {
  timeoutMinutes: number;
  maxConcurrentSessions: number;
  idleTimeoutMinutes: number;
  rememberMeEnabled: boolean;
  rememberMeExpiryDays: number;
}