/**
 * Unit Tests for Security Helper Functions
 */

import { describe, it, expect } from '@jest/globals';
import {
  DataClassificationHelper,
  SecurityValidator,
  AuditHelper,
  EncryptionHelper,
  ComplianceHelper,
} from '../../src/utils/helpers';
import { DataClassification, AuditSeverity } from '../../src/types';

describe('DataClassificationHelper', () => {
  describe('classifyData', () => {
    it('should classify data with SSN as highly confidential', () => {
      const data = 'SSN: 123-45-6789';
      const classification = DataClassificationHelper.classifyData(data);

      expect(classification).toBe(DataClassification.HIGHLY_CONFIDENTIAL);
    });

    it('should classify data with credit card as highly confidential', () => {
      const data = 'Card: 4532-1234-5678-9010';
      const classification = DataClassificationHelper.classifyData(data);

      expect(classification).toBe(DataClassification.HIGHLY_CONFIDENTIAL);
    });

    it('should classify data with medical info as highly confidential', () => {
      const data = 'Patient diagnosis: hypertension';
      const classification = DataClassificationHelper.classifyData(data);

      expect(classification).toBe(DataClassification.HIGHLY_CONFIDENTIAL);
    });

    it('should classify data with API key as highly confidential', () => {
      const data = 'api_key=sk_live_1234567890abcdef';
      const classification = DataClassificationHelper.classifyData(data);

      expect(classification).toBe(DataClassification.HIGHLY_CONFIDENTIAL);
    });

    it('should classify data with email as confidential', () => {
      const data = 'Contact: user@example.com';
      const classification = DataClassificationHelper.classifyData(data);

      expect(classification).toBe(DataClassification.CONFIDENTIAL);
    });

    it('should classify data with password as confidential', () => {
      const data = 'password=Secret123!';
      const classification = DataClassificationHelper.classifyData(data);

      expect(classification).toBe(DataClassification.CONFIDENTIAL);
    });

    it('should classify internal data as internal', () => {
      const data = 'Internal documentation';
      const classification = DataClassificationHelper.classifyData(data, {
        internal: true,
      });

      expect(classification).toBe(DataClassification.INTERNAL);
    });

    it('should classify generic data as public', () => {
      const data = 'This is public information';
      const classification = DataClassificationHelper.classifyData(data);

      expect(classification).toBe(DataClassification.PUBLIC);
    });
  });
});

describe('SecurityValidator', () => {
  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const result = SecurityValidator.validatePassword('Str0ng!P@ssw0rd');

      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(5);
      expect(result.feedback).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result = SecurityValidator.validatePassword('weak');

      expect(result.valid).toBe(false);
      expect(result.score).toBeLessThan(5);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('should provide specific feedback', () => {
      const result = SecurityValidator.validatePassword('password');

      expect(result.feedback).toContain('Password should contain uppercase letters');
      expect(result.feedback).toContain('Password should contain numbers');
    });

    it('should detect repeated characters', () => {
      const result = SecurityValidator.validatePassword('Passssword123!');

      expect(result.valid).toBe(false);
      expect(result.feedback).toContain('contains repeated characters');
    });

    it('should detect common passwords', () => {
      const result = SecurityValidator.validatePassword('password123');

      expect(result.valid).toBe(false);
      expect(result.feedback).toContain('contains common patterns');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct emails', () => {
      expect(SecurityValidator.validateEmail('user@example.com')).toBe(true);
      expect(SecurityValidator.validateEmail('test.user+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(SecurityValidator.validateEmail('invalid')).toBe(false);
      expect(SecurityValidator.validateEmail('@example.com')).toBe(false);
      expect(SecurityValidator.validateEmail('user@')).toBe(false);
    });
  });

  describe('validateIP', () => {
    it('should validate IPv4 addresses', () => {
      expect(SecurityValidator.validateIP('192.168.1.1')).toBe(true);
      expect(SecurityValidator.validateIP('10.0.0.1')).toBe(true);
      expect(SecurityValidator.validateIP('255.255.255.255')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(SecurityValidator.validateIP('256.1.1.1')).toBe(false);
      expect(SecurityValidator.validateIP('192.168.1')).toBe(false);
      expect(SecurityValidator.validateIP('invalid')).toBe(false);
    });

    it('should validate IPv6 addresses', () => {
      expect(SecurityValidator.validateIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    });
  });

  describe('validateURL', () => {
    it('should validate correct URLs', () => {
      expect(SecurityValidator.validateURL('https://example.com')).toBe(true);
      expect(SecurityValidator.validateURL('http://example.com/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(SecurityValidator.validateURL('not-a-url')).toBe(false);
      expect(SecurityValidator.validateURL('example.com')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("XSS")</script>Hello';
      const sanitized = SecurityValidator.sanitizeInput(input);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello');
    });

    it('should remove SQL injection patterns', () => {
      const input = "'; DROP TABLE users; --";
      const sanitized = SecurityValidator.sanitizeInput(input);

      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('DROP');
    });

    it('should truncate long input', () => {
      const input = 'a'.repeat(1000);
      const sanitized = SecurityValidator.sanitizeInput(input, { maxLength: 100 });

      expect(sanitized.length).toBe(100);
    });

    it('should preserve valid input', () => {
      const input = 'Valid input 123';
      const sanitized = SecurityValidator.sanitizeInput(input);

      expect(sanitized).toBe(input);
    });
  });
});

describe('AuditHelper', () => {
  describe('determineSeverity', () => {
    it('should return critical for security failures', () => {
      const severity = AuditHelper.determineSeverity('security_event', 'failure');
      expect(severity).toBe(AuditSeverity.CRITICAL);
    });

    it('should return high for auth failures', () => {
      const severity = AuditHelper.determineSeverity('authentication', 'failure');
      expect(severity).toBe(AuditSeverity.HIGH);
    });

    it('should return high for authz failures', () => {
      const severity = AuditHelper.determineSeverity('authorization', 'failure');
      expect(severity).toBe(AuditSeverity.HIGH);
    });

    it('should return low for successful operations', () => {
      const severity = AuditHelper.determineSeverity('authentication', 'success');
      expect(severity).toBe(AuditSeverity.LOW);
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = AuditHelper.generateCorrelationId();
      const id2 = AuditHelper.generateCorrelationId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should include audit prefix', () => {
      const id = AuditHelper.generateCorrelationId();
      expect(id).toMatch(/^audit_/);
    });
  });

  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = AuditHelper.generateRequestId();
      const id2 = AuditHelper.generateRequestId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should include req prefix', () => {
      const id = AuditHelper.generateRequestId();
      expect(id).toMatch(/^req_/);
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask password fields', () => {
      const data = { username: 'user', password: 'secret123' };
      const masked = AuditHelper.maskSensitiveData(data);

      expect(masked.username).toBe('user');
      expect(masked.password).not.toBe('secret123');
      expect(masked.password).toContain('*');
    });

    it('should mask token fields', () => {
      const data = { token: 'abc123def456' };
      const masked = AuditHelper.maskSensitiveData(data);

      expect(masked.token).not.toBe('abc123def456');
      expect(masked.token).toContain('*');
    });

    it('should mask nested objects', () => {
      const data = {
        user: {
          username: 'user',
          password: 'secret123',
        },
      };
      const masked = AuditHelper.maskSensitiveData(data);

      expect(masked.user.username).toBe('user');
      expect(masked.user.password).toContain('*');
    });

    it('should handle custom fields', () => {
      const data = { apiKey: 'key-123', custom: 'value' };
      const masked = AuditHelper.maskSensitiveData(data, ['apiKey']);

      expect(masked.apiKey).toContain('*');
      expect(masked.custom).toBe('value');
    });
  });
});

describe('EncryptionHelper', () => {
  describe('key generation', () => {
    it('should generate secure random keys', () => {
      const key1 = EncryptionHelper.generateKey(32);
      const key2 = EncryptionHelper.generateKey(32);

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('should derive keys from passwords', () => {
      const password = 'SecurePassword123';
      const salt = EncryptionHelper.generateKey(16);

      const key = EncryptionHelper.deriveKey(password, salt, 100000);

      expect(key).toBeDefined();
      expect(key.length).toBe(32);
    });

    it('should generate IVs', () => {
      const iv1 = EncryptionHelper.generateIV(16);
      const iv2 = EncryptionHelper.generateIV(16);

      expect(iv1).toBeDefined();
      expect(iv2).toBeDefined();
      expect(iv1.toString('hex')).not.toBe(iv2.toString('hex'));
    });
  });

  describe('encryption/decryption', () => {
    it('should encrypt and decrypt data', () => {
      const data = 'Sensitive information';
      const key = EncryptionHelper.generateKey(32);

      const { ciphertext, iv, authTag } = EncryptionHelper.encrypt(data, key);
      expect(ciphertext).toBeDefined();
      expect(iv).toBeDefined();
      expect(authTag).toBeDefined();

      const decrypted = EncryptionHelper.decrypt(ciphertext, key, iv, authTag);
      expect(decrypted).toBe(data);
    });

    it('should fail with wrong key', () => {
      const data = 'Sensitive information';
      const key1 = EncryptionHelper.generateKey(32);
      const key2 = EncryptionHelper.generateKey(32);

      const { ciphertext, iv, authTag } = EncryptionHelper.encrypt(data, key1);

      expect(() => {
        EncryptionHelper.decrypt(ciphertext, key2, iv, authTag);
      }).toThrow();
    });
  });

  describe('hashing', () => {
    it('should compute hashes', () => {
      const data = 'Data to hash';
      const hash = EncryptionHelper.hash(data);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(32); // SHA-256
    });

    it('should produce consistent hashes', () => {
      const data = 'Same data';
      const hash1 = EncryptionHelper.hash(data);
      const hash2 = EncryptionHelper.hash(data);

      expect(hash1.toString('hex')).toBe(hash2.toString('hex'));
    });
  });

  describe('HMAC', () => {
    it('should generate HMAC', () => {
      const data = 'Data for HMAC';
      const key = EncryptionHelper.generateKey(32);

      const hmac = EncryptionHelper.hmac(data, key);
      expect(hmac).toBeDefined();
      expect(hmac.length).toBe(32);
    });

    it('should verify HMAC', () => {
      const data = 'Data to verify';
      const key = EncryptionHelper.generateKey(32);

      const hmac = EncryptionHelper.hmac(data, key);
      const isValid = EncryptionHelper.compareHMAC(data, key, hmac);

      expect(isValid).toBe(true);
    });

    it('should reject invalid HMAC', () => {
      const data = 'Original data';
      const key = EncryptionHelper.generateKey(32);
      const wrongHmac = EncryptionHelper.hmac('Different data', key);

      const isValid = EncryptionHelper.compareHMAC(data, key, wrongHmac);
      expect(isValid).toBe(false);
    });
  });
});

describe('ComplianceHelper', () => {
  describe('checkGDPRCompliance', () => {
    it('should return requirements for highly confidential data', () => {
      const result = ComplianceHelper.checkGDPRCompliance(
        DataClassification.HIGHLY_CONFIDENTIAL
      );

      expect(result.compliant).toBe(false);
      expect(result.requirements).toContain('Obtain explicit consent');
      expect(result.requirements).toContain('Implement data minimization');
    });

    it('should return compliant for public data', () => {
      const result = ComplianceHelper.checkGDPRCompliance(DataClassification.PUBLIC);

      expect(result.compliant).toBe(true);
      expect(result.requirements).toHaveLength(0);
    });
  });

  describe('checkHIPAACompliance', () => {
    it('should return requirements for highly confidential data', () => {
      const result = ComplianceHelper.checkHIPAACompliance(
        DataClassification.HIGHLY_CONFIDENTIAL
      );

      expect(result.compliant).toBe(false);
      expect(result.requirements).toContain('Implement PHI encryption');
      expect(result.requirements).toContain('Maintain audit trails');
    });
  });

  describe('checkPCIDSSCompliance', () => {
    it('should return requirements when handling card data', () => {
      const result = ComplianceHelper.checkPCIDSSCompliance(true);

      expect(result.compliant).toBe(false);
      expect(result.requirements).toContain('Implement strong cryptography');
      expect(result.requirements).toContain('Maintain vulnerability management program');
    });

    it('should return compliant when not handling card data', () => {
      const result = ComplianceHelper.checkPCIDSSCompliance(false);

      expect(result.compliant).toBe(true);
      expect(result.requirements).toHaveLength(0);
    });
  });

  describe('generateChecklist', () => {
    it('should generate SOC2 checklist', () => {
      const checklists = ComplianceHelper.generateChecklist(['soc2']);

      expect(checklists).toHaveLength(1);
      expect(checklists[0].framework).toBe('SOC 2 Type II');
      expect(checklists[0].items).toContain('Implement access controls');
      expect(checklists[0].items).toContain('Enable audit logging');
    });

    it('should generate ISO27001 checklist', () => {
      const checklists = ComplianceHelper.generateChecklist(['iso27001']);

      expect(checklists).toHaveLength(1);
      expect(checklists[0].framework).toBe('ISO 27001');
      expect(checklists[0].items).toContain('Establish information security policy');
    });

    it('should generate GDPR checklist', () => {
      const checklists = ComplianceHelper.generateChecklist(['gdpr']);

      expect(checklists).toHaveLength(1);
      expect(checklists[0].framework).toBe('GDPR');
      expect(checklists[0].items).toContain('Lawful basis for processing');
    });

    it('should generate multiple checklists', () => {
      const checklists = ComplianceHelper.generateChecklist(['soc2', 'iso27001', 'gdpr']);

      expect(checklists).toHaveLength(3);
      expect(checklists[0].framework).toBe('SOC 2 Type II');
      expect(checklists[1].framework).toBe('ISO 27001');
      expect(checklists[2].framework).toBe('GDPR');
    });
  });
});
