/**
 * Security Utility Functions
 * Helper functions for common security operations
 */

import crypto from 'crypto';
import { DataClassification, AuditSeverity } from '../types';

// ============================================================================
// DATA CLASSIFICATION HELPERS
// ============================================================================

export class DataClassificationHelper {
  /**
   * Classify data based on content and context
   */
  static classifyData(data: string, context?: Record<string, any>): DataClassification {
    // Check for highly sensitive patterns
    if (this.containsSSN(data) ||
        this.containsCreditCard(data) ||
        this.containsMedicalInfo(data) ||
        this.containsApiKey(data)) {
      return DataClassification.HIGHLY_CONFIDENTIAL;
    }

    // Check for confidential patterns
    if (this.containsPersonalInfo(data) ||
        this.containsFinancialInfo(data) ||
        this.containsPassword(data)) {
      return DataClassification.CONFIDENTIAL;
    }

    // Check for internal patterns
    if (this.containsInternalInfo(data, context)) {
      return DataClassification.INTERNAL;
    }

    // Default to public
    return DataClassification.PUBLIC;
  }

  /**
   * Check if data contains SSN
   */
  private static containsSSN(data: string): boolean {
    const ssnPatterns = [
      /\d{3}-\d{2}-\d{4}/,
      /\d{3}\s\d{2}\s\d{4}/,
      /\d{9}/,
    ];
    return ssnPatterns.some(pattern => pattern.test(data));
  }

  /**
   * Check if data contains credit card number
   */
  private static containsCreditCard(data: string): boolean {
    const cardPatterns = [
      /\d{4}-\d{4}-\d{4}-\d{4}/,
      /\d{4}\s\d{4}\s\d{4}\s\d{4}/,
      /\d{16}/,
    ];
    return cardPatterns.some(pattern => pattern.test(data));
  }

  /**
   * Check if data contains medical information
   */
  private static containsMedicalInfo(data: string): boolean {
    const medicalKeywords = [
      'diagnosis', 'prescription', 'medical', 'patient', 'treatment',
      'health', 'disease', 'symptom', 'medication'
    ];
    const lowerData = data.toLowerCase();
    return medicalKeywords.some(keyword => lowerData.includes(keyword));
  }

  /**
   * Check if data contains API key
   */
  private static containsApiKey(data: string): boolean {
    const apiKeyPatterns = [
      /api[_-]?key/i,
      /apikey/i,
      /secret[_-]?key/i,
      /access[_-]?token/i,
      /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/i,
    ];
    return apiKeyPatterns.some(pattern => pattern.test(data));
  }

  /**
   * Check if data contains personal information
   */
  private static containsPersonalInfo(data: string): boolean {
    const personalPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\+?\d{1,3}?[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/, // Phone
    ];
    return personalPatterns.some(pattern => pattern.test(data));
  }

  /**
   * Check if data contains financial information
   */
  private static containsFinancialInfo(data: string): boolean {
    const financialKeywords = [
      'salary', 'income', 'revenue', 'bank', 'account', 'balance',
      'transaction', 'payment', 'invoice'
    ];
    const lowerData = data.toLowerCase();
    return financialKeywords.some(keyword => lowerData.includes(keyword));
  }

  /**
   * Check if data contains password
   */
  private static containsPassword(data: string): boolean {
    const passwordPatterns = [
      /password/i,
      /passwd/i,
      /pwd/i,
    ];
    return passwordPatterns.some(pattern => pattern.test(data));
  }

  /**
   * Check if data is internal
   */
  private static containsInternalInfo(data: string, context?: Record<string, any>): boolean {
    // Check context first
    if (context?.internal === true) {
      return true;
    }

    // Check for internal domains
    const internalDomains = [
      '@internal.',
      '@private.',
      '.local',
      '.internal',
    ];
    return internalDomains.some(domain => data.includes(domain));
  }
}

// ============================================================================
// SECURITY VALIDATION HELPERS
// ============================================================================

export class SecurityValidator {
  /**
   * Validate password strength
   */
  static validatePassword(password: string): {
    valid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Check length
    if (password.length >= 12) {
      score += 2;
    } else if (password.length >= 8) {
      score += 1;
      feedback.push('Password should be at least 12 characters');
    } else {
      feedback.push('Password is too short');
    }

    // Check for uppercase
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should contain uppercase letters');
    }

    // Check for lowercase
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should contain lowercase letters');
    }

    // Check for numbers
    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should contain numbers');
    }

    // Check for special characters
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Password should contain special characters');
    }

    // Check for common patterns
    if (/(.)\1{2,}/.test(password)) {
      score -= 1;
      feedback.push('Password contains repeated characters');
    }

    // Check for common passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin'];
    if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
      score -= 2;
      feedback.push('Password contains common patterns');
    }

    return {
      valid: score >= 5,
      score: Math.max(0, Math.min(5, score)),
      feedback,
    };
  }

  /**
   * Validate email address
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate IP address
   */
  static validateIP(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => parseInt(part, 10) >= 0 && parseInt(part, 10) <= 255);
    }

    return ipv6Regex.test(ip);
  }

  /**
   * Validate URL
   */
  static validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  static sanitizeInput(input: string, options?: {
    removeHTML?: boolean;
    removeSQL?: boolean;
    maxLength?: number;
  }): string {
    let sanitized = input;

    if (options?.removeHTML !== false) {
      // Remove HTML tags
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    if (options?.removeSQL !== false) {
      // Remove common SQL injection patterns
      sanitized = sanitized.replace(/['";\\]/g, '');
      sanitized = sanitized.replace(/\b(OR|AND|SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b/gi, '');
    }

    if (options?.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized.trim();
  }
}

// ============================================================================
// AUDIT HELPERS
// ============================================================================

export class AuditHelper {
  /**
   * Determine audit severity from event type and outcome
   */
  static determineSeverity(
    eventType: string,
    outcome: string
  ): AuditSeverity {
    // Critical events
    if (eventType === 'security_event' && outcome === 'failure') {
      return AuditSeverity.CRITICAL;
    }

    // High severity
    if (eventType === 'authentication' && outcome === 'failure') {
      return AuditSeverity.HIGH;
    }
    if (eventType === 'authorization' && outcome === 'failure') {
      return AuditSeverity.HIGH;
    }
    if (eventType === 'data_modification' && outcome === 'error') {
      return AuditSeverity.HIGH;
    }

    // Medium severity
    if (eventType === 'data_access' && outcome === 'failure') {
      return AuditSeverity.MEDIUM;
    }
    if (eventType === 'configuration_change' && outcome === 'error') {
      return AuditSeverity.MEDIUM;
    }

    // Default to low
    return AuditSeverity.LOW;
  }

  /**
   * Generate correlation ID
   */
  static generateCorrelationId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate request ID
   */
  static generateRequestId(): string {
    return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Mask sensitive data in logs
   */
  static maskSensitiveData(data: Record<string, any>, fieldsToMask: string[] = [
    'password', 'token', 'secret', 'key', 'apiKey', 'sessionId'
  ]): Record<string, any> {
    const masked = { ...data };

    for (const field of fieldsToMask) {
      if (masked[field]) {
        const value = String(masked[field]);
        masked[field] = value.length > 4
          ? `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
          : '***';
      }
    }

    // Recursively mask nested objects
    for (const key in masked) {
      if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = this.maskSensitiveData(masked[key], fieldsToMask);
      }
    }

    return masked;
  }
}

// ============================================================================
// ENCRYPTION HELPERS
// ============================================================================

export class EncryptionHelper {
  /**
   * Generate a secure random key
   */
  static generateKey(length: number = 32): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * Generate key from password
   */
  static deriveKey(
    password: string,
    salt: Buffer,
    iterations: number = 100000
  ): Buffer {
    return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  }

  /**
   * Generate a random IV
   */
  static generateIV(length: number = 16): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  static encrypt(data: string, key: Buffer): {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
  } {
    const iv = this.generateIV(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let ciphertext = cipher.update(data, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const authTag = cipher.getAuthTag();

    return { ciphertext, iv, authTag };
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  static decrypt(
    ciphertext: Buffer,
    key: Buffer,
    iv: Buffer,
    authTag: Buffer
  ): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    return plaintext.toString('utf8');
  }

  /**
   * Hash data
   */
  static hash(data: string, algorithm: string = 'sha256'): Buffer {
    return crypto.createHash(algorithm).update(data).digest();
  }

  /**
   * Generate HMAC
   */
  static hmac(data: string, key: Buffer, algorithm: string = 'sha256'): Buffer {
    return crypto.createHmac(algorithm, key).update(data).digest();
  }

  /**
   * Compare data with HMAC in constant time
   */
  static compareHMAC(
    data: string,
    key: Buffer,
    expected: Buffer,
    algorithm: string = 'sha256'
  ): boolean {
    const actual = this.hmac(data, key, algorithm);
    return crypto.timingSafeEqual(actual, expected);
  }
}

// ============================================================================
// COMPLIANCE HELPERS
// ============================================================================

export class ComplianceHelper {
  /**
   * Check if data handling meets GDPR requirements
   */
  static checkGDPRCompliance(dataClassification: DataClassification): {
    compliant: boolean;
    requirements: string[];
  } {
    const requirements: string[] = [];

    if (dataClassification === DataClassification.HIGHLY_CONFIDENTIAL) {
      requirements.push('Obtain explicit consent');
      requirements.push('Implement data minimization');
      requirements.push('Enable right to erasure');
      requirements.push('Provide data portability');
      requirements.push('Implement privacy by design');
    }

    if (dataClassification === DataClassification.CONFIDENTIAL) {
      requirements.push('Implement access controls');
      requirements.push('Maintain audit logs');
      requirements.push('Enable data subject rights');
    }

    return {
      compliant: requirements.length === 0,
      requirements,
    };
  }

  /**
   * Check if data handling meets HIPAA requirements
   */
  static checkHIPAACompliance(dataClassification: DataClassification): {
    compliant: boolean;
    requirements: string[];
  } {
    const requirements: string[] = [];

    if (dataClassification === DataClassification.HIGHLY_CONFIDENTIAL) {
      requirements.push('Implement PHI encryption');
      requirements.push('Maintain audit trails');
      requirements.push('Enable access controls');
      requirements.push('Implement Business Associate Agreements');
      requirements.push('Enable breach notification');
    }

    return {
      compliant: requirements.length === 0,
      requirements,
    };
  }

  /**
   * Check if data handling meets PCI DSS requirements
   */
  static checkPCIDSSCompliance(handlesCardData: boolean): {
    compliant: boolean;
    requirements: string[];
  } {
    const requirements: string[] = [];

    if (handlesCardData) {
      requirements.push('Implement strong cryptography');
      requirements.push('Maintain vulnerability management program');
      requirements.push('Implement secure application development');
      requirements.push('Monitor and test networks');
      requirements.push('Maintain information security policy');
      requirements.push('Restrict access to cardholder data');
      requirements.push('Track and monitor access to network resources');
    }

    return {
      compliant: requirements.length === 0,
      requirements,
    };
  }

  /**
   * Generate compliance checklist
   */
  static generateChecklist(frameworks: string[]): {
    framework: string;
    items: string[];
  }[] {
    const checklists: {
      framework: string;
      items: string[];
    }[] = [];

    for (const framework of frameworks) {
      switch (framework.toLowerCase()) {
        case 'soc2':
          checklists.push({
            framework: 'SOC 2 Type II',
            items: [
              'Implement access controls',
              'Enable audit logging',
              'Document security policies',
              'Conduct risk assessments',
              'Monitor system activity',
              'Implement change management',
              'Provide security training',
              'Test incident response',
            ],
          });
          break;

        case 'iso27001':
          checklists.push({
            framework: 'ISO 27001',
            items: [
              'Establish information security policy',
              'Implement risk assessment process',
              'Implement access control',
              'Enable physical security',
              'Implement communications security',
              'Maintain compliance policies',
              'Conduct internal audits',
              'Management review',
            ],
          });
          break;

        case 'gdpr':
          checklists.push({
            framework: 'GDPR',
            items: [
              'Lawful basis for processing',
              'Privacy notices',
              'Data subject rights',
              'Data breach notification',
              'Data protection by design',
              'Data protection impact assessments',
              'Data processor agreements',
              'Records of processing activities',
            ],
          });
          break;
      }
    }

    return checklists;
  }
}

// All classes are already exported inline - no duplicate export needed
