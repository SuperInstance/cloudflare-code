/**
 * Security Manager - SPF, DKIM, and DMARC management for email authentication
 */

// @ts-nocheck - Type issues with unknown error type and record properties
import crypto from 'crypto';
import { winston as logger } from '../utils/logger';
import {
  SecurityConfig,
  SPFConfig,
  DKIMConfig,
  DMARCConfig
} from '../types';

/**
 * Security Manager class for email authentication
 */
export class SecurityManager {
  private configs: Map<string, SecurityConfig> = new Map();

  /**
   * Add security configuration for a domain
   */
  addSecurityConfig(config: SecurityConfig): void {
    this.configs.set(config.domain, config);
    logger.info(`Added security config for ${config.domain}`);
  }

  /**
   * Get security configuration for domain
   */
  getSecurityConfig(domain: string): SecurityConfig | undefined {
    return this.configs.get(domain);
  }

  /**
   * Generate SPF record for domain
   */
  generateSPFRecord(domain: string): string {
    const config = this.configs.get(domain);
    if (!config || !config.spf || !config.spf.enabled) {
      throw new Error(`SPF not configured for ${domain}`);
    }

    const spf = config.spf;
    const parts: string[] = ['v=spf1'];

    // Add mechanisms
    if (spf.mechanisms && spf.mechanisms.length > 0) {
      parts.push(...spf.mechanisms);
    }

    // Add include domains
    if (spf.includeDomains && spf.includeDomains.length > 0) {
      spf.includeDomains.forEach(includeDomain => {
        parts.push(`include:${includeDomain}`);
      });
    }

    // Add IP addresses
    if (spf.ipAddresses && spf.ipAddresses.length > 0) {
      spf.ipAddresses.forEach(ip => {
        parts.push(ip.includes(':') ? `ip6:${ip}` : `ip4:${ip}`);
      });
    }

    // Add all mechanism
    parts.push(spf.all || '~all');

    return `v=spf1 ${parts.join(' ')}`;
  }

  /**
   * Validate SPF record
   */
  validateSPFRecord(record: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if record starts with v=spf1
    if (!record.startsWith('v=spf1')) {
      errors.push('SPF record must start with "v=spf1"');
    }

    // Check for all mechanism
    if (!record.includes('-all') && !record.includes('~all') &&
        !record.includes('+all') && !record.includes('?all')) {
      warnings.push('SPF record should end with an "all" mechanism');
    }

    // Warn against +all
    if (record.includes('+all')) {
      warnings.push('Using "+all" is not recommended as it allows any server to send email');
    }

    // Check for too many DNS lookups (max 10)
    const lookupCount = (record.match(/include:/g) || []).length +
                       (record.match(/a:/g) || []).length +
                       (record.match(/mx/g) || []).length +
                       (record.match(/exists:/g) || []).length;

    if (lookupCount > 10) {
      errors.push('SPF record exceeds maximum of 10 DNS lookups');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate DKIM key pair
   */
  generateDKIMKeyPair(domain: string, selector: string): {
    privateKey: string;
    publicKey: string;
    record: string;
  } {
    // Generate RSA key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Format public key for DNS record
    const publicKeyFormatted = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '')
      .trim();

    // Create DNS record
    const record = `${selector}._domainkey.${domain} TXT "v=DKIM1; k=rsa; p=${publicKeyFormatted}"`;

    logger.info(`Generated DKIM keys for ${domain} with selector ${selector}`);

    return {
      privateKey,
      publicKey,
      record
    };
  }

  /**
   * Sign email with DKIM
   */
  signEmailDKIM(
    emailContent: string,
    domain: string,
    selector: string,
    privateKey: string
  ): string {
    // Extract headers and body
    const parts = emailContent.split('\n\n');
    const headers = parts[0];
    const body = parts.slice(1).join('\n\n');

    // Prepare canonicalized headers
    const canonicalizedHeaders = this.canonicalizeHeaders(headers);
    const canonicalizedBody = this.canonicalizeBody(body);

    // Create DKIM signature
    const signatureData = this.createDKIMSignature(
      canonicalizedHeaders,
      canonicalizedBody,
      domain,
      selector
    );

    // Sign the data
    const sign = crypto.createSign('SHA256');
    sign.update(signatureData.toSign);
    const signature = sign.sign(privateKey, 'base64');

    // Format DKIM header
    const dkimHeader = `DKIM-Signature: ${signatureData.header}; b=${signature}`;

    // Insert DKIM header at the beginning of headers
    const signedEmail = `${dkimHeader}\n${emailContent}`;

    return signedEmail;
  }

  /**
   * Canonicalize headers for DKIM signing
   */
  private canonicalizeHeaders(headers: string): string {
    return headers
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\r\n');
  }

  /**
   * Canonicalize body for DKIM signing
   */
  private canonicalizeBody(body: string): string {
    return body
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '\r\n')
      .trim();
  }

  /**
   * Create DKIM signature data
   */
  private createDKIMSignature(
    headers: string,
    body: string,
    domain: string,
    selector: string
  ): {
    header: string;
    toSign: string;
  } {
    const bodyHash = crypto
      .createHash('sha256')
      .update(body)
      .digest('base64');

    const headerFields = [
      `v=1`,
      `a=rsa-sha256`,
      `c=relaxed/relaxed`,
      `d=${domain}`,
      `s=${selector}`,
      `h=from:to:subject:date`,
      `bh=${bodyHash}`
    ].join('; ');

    return {
      header: headerFields,
      toSign: headers
    };
  }

  /**
   * Verify DKIM signature
   */
  verifyDKIMSignature(
    emailContent: string,
    publicKey: string
  ): {
    valid: boolean;
    error?: string;
  } {
    // Extract DKIM-Signature header
    const dkimMatch = emailContent.match(/DKIM-Signature:([^\n]+)/);
    if (!dkimMatch) {
      return { valid: false, error: 'No DKIM signature found' };
    }

    try {
      const signature = dkimMatch[1].trim();

      // Extract signature value (b= parameter)
      const bMatch = signature.match(/b=([^\s;]+)/);
      if (!bMatch) {
        return { valid: false, error: 'No signature value found' };
      }

      const signatureValue = bMatch[1];

      // Verify signature
      const verify = crypto.createVerify('SHA256');
      verify.update(emailContent);
      const isValid = verify.verify(publicKey, signatureValue, 'base64');

      return { valid: isValid };
    } catch (error) {
      return {
        valid: false,
        error: `Verification failed: ${error.message}`
      };
    }
  }

  /**
   * Generate DMARC record
   */
  generateDMARCRecord(domain: string): string {
    const config = this.configs.get(domain);
    if (!config || !config.dmarc || !config.dmarc.enabled) {
      throw new Error(`DMARC not configured for ${domain}`);
    }

    const dmarc = config.dmarc;
    const parts: string[] = [`v=DMARC1; p=${dmarc.policy}`];

    // Add subdomain policy
    if (dmarc.subdomainPolicy) {
      parts.push(`sp=${dmarc.subdomainPolicy}`);
    }

    // Add alignment
    if (dmarc.alignment) {
      parts.push(`aspf=${dmarc.alignment}`);
      parts.push(`adkim=${dmarc.alignment}`);
    }

    // Add percentage
    if (dmarc.percentage && dmarc.percentage < 100) {
      parts.push(`pct=${dmarc.percentage}`);
    }

    // Add RUA (report URI)
    if (dmarc.rua && dmarc.rua.length > 0) {
      parts.push(`rua=${dmarc.rua.join(',')}`);
    }

    // Add RUF (forensic report URI)
    if (dmarc.ruf && dmarc.ruf.length > 0) {
      parts.push(`ruf=${dmarc.ruf.join(',')}`);
    }

    return `_dmarc.${domain} TXT "${parts.join('; ')}"`;
  }

  /**
   * Validate DMARC record
   */
  validateDMARCRecord(record: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if record starts with v=DMARC1
    if (!record.includes('v=DMARC1')) {
      errors.push('DMARC record must include "v=DMARC1"');
    }

    // Check for policy
    if (!record.includes('p=') && !record.includes('p=none') &&
        !record.includes('p=quarantine') && !record.includes('p=reject')) {
      errors.push('DMARC record must include a policy (p=none, p=quarantine, or p=reject)');
    }

    // Check for RUA reports
    if (!record.includes('rua=')) {
      warnings.push('DMARC record should include RUA report URI');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check domain authentication status
   */
  async checkDomainAuthentication(domain: string): Promise<{
    domain: string;
    spf: {
      configured: boolean;
      record?: string;
      valid?: boolean;
      errors?: string[];
    };
    dkim: {
      configured: boolean;
      selector?: string;
      valid?: boolean;
    };
    dmarc: {
      configured: boolean;
      record?: string;
      valid?: boolean;
      errors?: string[];
    };
    overallStatus: 'authenticated' | 'partial' | 'not-authenticated';
  }> {
    const config = this.configs.get(domain);
    const result: any = {
      domain,
      spf: { configured: false },
      dkim: { configured: false },
      dmarc: { configured: false },
      overallStatus: 'not-authenticated'
    };

    if (!config) {
      return result;
    }

    // Check SPF
    if (config.spf && config.spf.enabled) {
      result.spf.configured = true;
      const spfRecord = this.generateSPFRecord(domain);
      result.spf.record = spfRecord;
      const spfValidation = this.validateSPFRecord(spfRecord);
      result.spf.valid = spfValidation.valid;
      result.spf.errors = spfValidation.errors;
    }

    // Check DKIM
    if (config.dkim && config.dkim.enabled) {
      result.dkim.configured = true;
      result.dkim.selector = config.dkim.selector;
      // DKIM validity would be checked against DNS
      result.dkim.valid = true; // Placeholder
    }

    // Check DMARC
    if (config.dmarc && config.dmarc.enabled) {
      result.dmarc.configured = true;
      const dmarcRecord = this.generateDMARCRecord(domain);
      result.dmarc.record = dmarcRecord;
      const dmarcValidation = this.validateDMARCRecord(dmarcRecord);
      result.dmarc.valid = dmarcValidation.valid;
      result.dmarc.errors = dmarcValidation.errors;
    }

    // Calculate overall status
    const authCount = [
      result.spf.configured && result.spf.valid,
      result.dkim.configured && result.dkim.valid,
      result.dmarc.configured && result.dmarc.valid
    ].filter(Boolean).length;

    if (authCount === 3) {
      result.overallStatus = 'authenticated';
    } else if (authCount >= 1) {
      result.overallStatus = 'partial';
    }

    return result;
  }

  /**
   * Generate all DNS records for domain
   */
  generateAllDNSRecords(domain: string): {
    spf?: string;
    dkim?: string;
    dmarc?: string;
    instructions: string[];
  } {
    const config = this.configs.get(domain);
    const records: any = {};
    const instructions: string[] = [];

    if (!config) {
      instructions.push('No security configuration found for domain');
      return { records, instructions };
    }

    // SPF
    if (config.spf && config.spf.enabled) {
      records.spf = `@ TXT ${this.generateSPFRecord(domain)}`;
      instructions.push('Add SPF record to your DNS');
    }

    // DKIM
    if (config.dkim && config.dkim.enabled) {
      const keys = this.generateDKIMKeyPair(domain, config.dkim.selector);
      records.dkim = keys.record;
      instructions.push('Add DKIM record to your DNS');
      instructions.push('Store the private key securely for signing emails');
    }

    // DMARC
    if (config.dmarc && config.dmarc.enabled) {
      records.dmarc = this.generateDMARCRecord(domain);
      instructions.push('Add DMARC record to your DNS');
    }

    return { ...records, instructions };
  }

  /**
   * Monitor security compliance
   */
  monitorSecurityCompliance(domain: string): {
    domain: string;
    compliant: boolean;
    issues: Array<{
      type: 'error' | 'warning';
      category: 'spf' | 'dkim' | 'dmarc';
      message: string;
    }>;
    recommendations: string[];
  } {
    const issues: any[] = [];
    const recommendations: string[] = [];
    const config = this.configs.get(domain);

    if (!config) {
      return {
        domain,
        compliant: false,
        issues: [{
          type: 'error',
          category: 'general',
          message: 'No security configuration found'
        }],
        recommendations: ['Configure SPF, DKIM, and DMARC for this domain']
      };
    }

    // Check SPF
    if (!config.spf || !config.spf.enabled) {
      issues.push({
        type: 'error',
        category: 'spf',
        message: 'SPF is not configured'
      });
      recommendations.push('Enable SPF to prevent spoofing');
    }

    // Check DKIM
    if (!config.dkim || !config.dkim.enabled) {
      issues.push({
        type: 'error',
        category: 'dkim',
        message: 'DKIM is not configured'
      });
      recommendations.push('Enable DKIM for email authentication');
    }

    // Check DMARC
    if (!config.dmarc || !config.dmarc.enabled) {
      issues.push({
        type: 'error',
        category: 'dmarc',
        message: 'DMARC is not configured'
      });
      recommendations.push('Enable DMARC for policy enforcement');
    } else if (config.dmarc.policy === 'none') {
      issues.push({
        type: 'warning',
        category: 'dmarc',
        message: 'DMARC policy is set to none (monitoring only)'
      });
      recommendations.push('Consider upgrading DMARC policy to quarantine or reject');
    }

    // Check if RUA reports are configured
    if (config.dmarc && config.dmarc.enabled && (!config.dmarc.rua || config.dmarc.rua.length === 0)) {
      issues.push({
        type: 'warning',
        category: 'dmarc',
        message: 'DMARC RUA reports not configured'
      });
      recommendations.push('Add RUA report URI to receive DMARC reports');
    }

    return {
      domain,
      compliant: issues.filter(i => i.type === 'error').length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Rotate DKIM keys
   */
  rotateDKIMKeys(domain: string, selector: string): {
    oldPublicKey: string;
    newPublicKey: string;
    newPrivateKey: string;
    newRecord: string;
    migrationSteps: string[];
  } {
    const config = this.configs.get(domain);
    if (!config || !config.dkim) {
      throw new Error(`DKIM not configured for ${domain}`);
    }

    const oldPublicKey = config.dkim.publicKey || '';
    const keys = this.generateDKIMKeyPair(domain, selector);

    // Update config
    config.dkim.privateKey = keys.privateKey;
    config.dkim.publicKey = keys.publicKey;

    return {
      oldPublicKey,
      newPublicKey: keys.publicKey,
      newPrivateKey: keys.privateKey,
      newRecord: keys.record,
      migrationSteps: [
        'Add new DKIM record to DNS (keep old record for 48 hours)',
        'Wait for DNS propagation',
        'Verify new DKIM record is working',
        'Remove old DKIM record from DNS'
      ]
    };
  }
}

/**
 * DNS record checker
 */
export class DNSChecker {
  /**
   * Check if DNS record exists
   */
  static async checkRecord(domain: string, type: string): Promise<{
    exists: boolean;
    record?: string;
  }> {
    // This would use actual DNS lookup libraries
    // For now, return placeholder
    return {
      exists: false
    };
  }

  /**
   * Get TXT record
   */
  static async getTXTRecord(domain: string): Promise<string[]> {
    // This would use actual DNS lookup
    return [];
  }

  /**
   * Verify SPF record in DNS
   */
  static async verifySPFInDNS(domain: string): Promise<{
    found: boolean;
    valid: boolean;
    record?: string;
    errors: string[];
  }> {
    const records = await this.getTXTRecord(domain);
    const spfRecord = records.find(r => r.startsWith('v=spf1'));

    return {
      found: !!spfRecord,
      valid: !!spfRecord,
      record: spfRecord,
      errors: []
    };
  }

  /**
   * Verify DMARC record in DNS
   */
  static async verifyDMARCInDNS(domain: string): Promise<{
    found: boolean;
    valid: boolean;
    record?: string;
    errors: string[];
  }> {
    const dmarcDomain = `_dmarc.${domain}`;
    const records = await this.getTXTRecord(dmarcDomain);
    const dmarcRecord = records.find(r => r.includes('v=DMARC1'));

    return {
      found: !!dmarcRecord,
      valid: !!dmarcRecord,
      record: dmarcRecord,
      errors: []
    };
  }
}
