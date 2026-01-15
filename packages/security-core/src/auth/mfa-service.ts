/**
 * Multi-Factor Authentication (MFA) Service
 * Handles various MFA methods (TOTP, SMS, Email, WebAuthn)
 */

import speakeasy from 'speakeasy';
import { MfaService as WebAuthnMfaService } from '@simplewebauthn/server';
import { MfaMethod, MfaChallenge, User, AuthToken } from './types';
import { SecurityError } from '../types';
import { Logger } from '../utils/logger';
import { Validator } from '../utils/validator';
import { EventEmitter } from 'events';

export class MfaService extends EventEmitter {
  private logger: Logger;
  private totpSecrets: Map<string, string> = new Map();
  private smsService: any; // SMS service interface
  private emailService: any; // Email service interface
  private webAuthnService: WebAuthnMfaService;
  private challenges: Map<string, MfaChallenge> = new Map();

  constructor() {
    super();
    this.logger = new Logger('MfaService');
    this.webAuthnService = new WebAuthnMfaService({
      rpName: 'ClaudeFlare',
      rpID: 'localhost', // Should be configured
      origin: 'http://localhost:3000' // Should be configured
    });
  }

  /**
   * Setup MFA for a user
   */
  async setupMFA(userId: string, method: MfaMethod, options?: any): Promise<{ success: boolean; secret?: string; qrCodeUrl?: string; backupCode?: string }> {
    try {
      switch (method) {
        case 'totp':
          return this.setupTOTP(userId, options);
        case 'webauthn':
          return this.setupWebAuthn(userId, options);
        case 'sms':
          return this.setupSMS(userId, options);
        case 'email':
          return this.setupEmail(userId, options);
        default:
          throw new SecurityError(`Unsupported MFA method: ${method}`, 'UNSUPPORTED_MFA_METHOD', 400);
      }
    } catch (error) {
      this.logger.error('MFA setup failed', error);
      throw new SecurityError('MFA setup failed', 'MFA_SETUP_FAILED', 500);
    }
  }

  /**
   * Verify MFA setup
   */
  async verifySetup(userId: string, method: MfaMethod, code: string): Promise<{ success: boolean; backupCode?: string; recoveryCodes?: string[] }> {
    try {
      switch (method) {
        case 'totp':
          return this.verifyTOTPSetup(userId, code);
        case 'webauthn':
          return this.verifyWebAuthnSetup(userId, code);
        case 'sms':
          return this.verifySMSSetup(userId, code);
        case 'email':
          return this.verifyEmailSetup(userId, code);
        default:
          throw new SecurityError(`Unsupported MFA method: ${method}`, 'UNSUPPORTED_MFA_METHOD', 400);
      }
    } catch (error) {
      this.logger.error('MFA verification failed', error);
      throw new SecurityError('MFA verification failed', 'MFA_VERIFICATION_FAILED', 500);
    }
  }

  /**
   * Enable MFA for a user
   */
  async enableMFA(userId: string, method: MfaMethod, secretOrCredential: any, backupCodes?: string[]): Promise<boolean> {
    try {
      // In a real implementation, you would store this in the database
      this.logger.info(`MFA enabled for user ${userId} with method ${method}`);

      this.emit('mfaEnabled', { userId, method });

      return true;

    } catch (error) {
      this.logger.error('Failed to enable MFA', error);
      throw new SecurityError('Failed to enable MFA', 'MFA_ENABLE_FAILED', 500);
    }
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: string, method: MfaMethod, verificationCode: string): Promise<boolean> {
    try {
      // Verify the code first
      const isValid = await this.verifyMFA(userId, method, verificationCode);
      if (!isValid) {
        throw new SecurityError('Invalid verification code', 'INVALID_MFA_CODE', 400);
      }

      // In a real implementation, you would remove this from the database
      this.logger.info(`MFA disabled for user ${userId} with method ${method}`);

      this.emit('mfaDisabled', { userId, method });

      return true;

    } catch (error) {
      this.logger.error('Failed to disable MFA', error);
      throw new SecurityError('Failed to disable MFA', 'MFA_DISABLE_FAILED', 500);
    }
  }

  /**
   * Generate MFA challenge
   */
  async generateChallenge(userId: string, method: MfaMethod): Promise<MfaChallenge> {
    try {
      const challengeId = `mfa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
      const maxAttempts = 3;

      let challenge: MfaChallenge;

      switch (method) {
        case 'totp':
          const secret = this.totpSecrets.get(userId);
          if (!secret) {
            throw new SecurityError('TOTP not set up for user', 'TOTP_NOT_SETUP', 400);
          }
          challenge = {
            challengeId,
            userId,
            method,
            secret,
            expiresAt,
            verified: false,
            attempts: 0,
            maxAttempts
          };
          break;

        case 'sms':
          challenge = {
            challengeId,
            userId,
            method,
            secret: await this.sendSMSChallenge(userId),
            expiresAt,
            verified: false,
            attempts: 0,
            maxAttempts
          };
          break;

        case 'email':
          challenge = {
            challengeId,
            userId,
            method,
            secret: await this.sendEmailChallenge(userId),
            expiresAt,
            verified: false,
            attempts: 0,
            maxAttempts
          };
          break;

        case 'webauthn':
          const webAuthnChallenge = await this.webAuthnService.generateChallenge(userId);
          challenge = {
            challengeId,
            userId,
            method,
            secret: webAuthnChallenge.challenge,
            expiresAt,
            verified: false,
            attempts: 0,
            maxAttempts
          };
          break;

        default:
          throw new SecurityError(`Unsupported MFA method: ${method}`, 'UNSUPPORTED_MFA_METHOD', 400);
      }

      this.challenges.set(challengeId, challenge);

      this.logger.info(`MFA challenge generated for user ${userId}`, { method, challengeId });

      return challenge;

    } catch (error) {
      this.logger.error('Failed to generate MFA challenge', error);
      throw new SecurityError('Failed to generate MFA challenge', 'CHALLENGE_GENERATION_FAILED', 500);
    }
  }

  /**
   * Verify MFA code
   */
  async verifyMFA(userId: string, method: MfaMethod, code: string): Promise<boolean> {
    try {
      // Find active challenge for this user
      const challenge = Array.from(this.challenges.values())
        .find(c => c.userId === userId && c.method === method && !c.verified);

      if (!challenge) {
        throw new SecurityError('No active MFA challenge found', 'NO_CHALLENGE', 400);
      }

      // Check if challenge is expired
      if (challenge.expiresAt < new Date()) {
        this.challenges.delete(challenge.challengeId);
        throw new SecurityError('MFA challenge expired', 'CHALLENGE_EXPIRED', 400);
      }

      // Check max attempts
      if (challenge.attempts >= challenge.maxAttempts) {
        this.challenges.delete(challenge.challengeId);
        throw new SecurityError('Too many MFA attempts', 'TOO_MANY_ATTEMPTS', 429);
      }

      let isValid = false;

      switch (method) {
        case 'totp':
          isValid = this.verifyTOTP(challenge.secret, code);
          break;

        case 'sms':
          isValid = this.verifySMSChallenge(challenge.secret, code);
          break;

        case 'email':
          isValid = this.verifyEmailChallenge(challenge.secret, code);
          break;

        case 'webauthn':
          isValid = await this.verifyWebAuthn(challenge.userId, code);
          break;

        default:
          throw new SecurityError(`Unsupported MFA method: ${method}`, 'UNSUPPORTED_MFA_METHOD', 400);
      }

      challenge.attempts++;
      this.challenges.set(challenge.challengeId, challenge);

      if (isValid) {
        challenge.verified = true;
        this.challenges.set(challenge.challengeId, challenge);

        this.logger.info(`MFA verified successfully for user ${userId}`, { method });
        this.emit('mfaVerified', { userId, method, challengeId: challenge.challengeId });

        // Clean up after successful verification
        setTimeout(() => {
          this.challenges.delete(challenge.challengeId);
        }, 60000); // Keep for 1 minute after verification
      }

      return isValid;

    } catch (error) {
      this.logger.error('MFA verification failed', error);
      throw new SecurityError('MFA verification failed', 'MFA_VERIFICATION_FAILED', 500);
    }
  }

  /**
   * Get user MFA status
   */
  async getMFAStatus(userId: string): Promise<{ enabled: boolean; methods: MfaMethod[]; backupCodesRemaining?: number }> {
    try {
      // In a real implementation, query the database
      const enabled = true; // Placeholder
      const methods: MfaMethod[] = ['totp']; // Placeholder
      const backupCodesRemaining = 5; // Placeholder

      return {
        enabled,
        methods,
        backupCodesRemaining
      };

    } catch (error) {
      this.logger.error('Failed to get MFA status', error);
      throw new SecurityError('Failed to get MFA status', 'MFA_STATUS_FAILED', 500);
    }
  }

  /**
   * Generate backup codes
   */
  async generateBackupCodes(userId: string, count: number = 10): Promise<string[]> {
    try {
      const backupCodes = [];
      for (let i = 0; i < count; i++) {
        backupCodes.push(this.generateBackupCode());
      }

      // In a real implementation, store these in the database
      this.logger.info(`Generated ${count} backup codes for user ${userId}`);

      return backupCodes;

    } catch (error) {
      this.logger.error('Failed to generate backup codes', error);
      throw new SecurityError('Failed to generate backup codes', 'BACKUP_CODES_FAILED', 500);
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    try {
      // In a real implementation, check against stored backup codes
      const isValid = Validator.isValidBackupCode(code);

      if (isValid) {
        // Mark backup code as used
        this.logger.info(`Backup code used by user ${userId}`);
      }

      return isValid;

    } catch (error) {
      this.logger.error('Failed to verify backup code', error);
      throw new SecurityError('Failed to verify backup code', 'BACKUP_CODE_VERIFY_FAILED', 500);
    }
  }

  // Private helper methods for TOTP
  private async setupTOTP(userId: string, options?: any): Promise<{ success: boolean; secret?: string; qrCodeUrl?: string }> {
    const secret = speakeasy.generateSecret({
      name: `ClaudeFlare (${userId})`,
      issuer: 'ClaudeFlare'
    });

    this.totpSecrets.set(userId, secret.base32);

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(secret.otpauth_url!)}`;

    return {
      success: true,
      secret: secret.base32,
      qrCodeUrl
    };
  }

  private verifyTOTP(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow for clock skew
    });
  }

  private async verifyTOTPSetup(userId: string, code: string): Promise<{ success: boolean; backupCode?: string; recoveryCodes?: string[] }> {
    const secret = this.totpSecrets.get(userId);
    if (!secret) {
      throw new SecurityError('TOTP secret not found', 'TOTP_SECRET_NOT_FOUND', 400);
    }

    const isValid = this.verifyTOTP(secret, code);
    if (!isValid) {
      throw new SecurityError('Invalid TOTP code', 'INVALID_TOTP_CODE', 400);
    }

    const backupCodes = await this.generateBackupCodes(userId);

    return {
      success: true,
      backupCodes
    };
  }

  // Private helper methods for SMS
  private async setupSMS(userId: string, options: any): Promise<{ success: boolean; secret?: string }> {
    // Send verification code to registered phone number
    const verificationCode = this.generateSMSVerificationCode();

    // In a real implementation, store this and send via SMS service
    this.logger.info(`SMS verification code sent to user ${userId}: ${verificationCode}`);

    return {
      success: true,
      secret: verificationCode
    };
  }

  private async sendSMSChallenge(userId: string): Promise<string> {
    const code = this.generateSMSVerificationCode();

    // In a real implementation, send via SMS service
    this.logger.info(`SMS challenge sent to user ${userId}: ${code}`);

    return code;
  }

  private verifySMSChallenge(expectedCode: string, providedCode: string): boolean {
    return expectedCode === providedCode;
  }

  private async verifySMSSetup(userId: string, code: string): Promise<{ success: boolean; backupCode?: string; recoveryCodes?: string[] }> {
    // Verify the code sent during setup
    const isValid = this.verifySMSChallenge('setup_code', code); // Simplified
    if (!isValid) {
      throw new SecurityError('Invalid SMS code', 'INVALID_SMS_CODE', 400);
    }

    const backupCodes = await this.generateBackupCodes(userId);

    return {
      success: true,
      backupCodes
    };
  }

  // Private helper methods for Email
  private async setupEmail(userId: string, options: any): Promise<{ success: boolean; secret?: string }> {
    const verificationCode = this.generateEmailVerificationCode();

    // In a real implementation, store this and send via email service
    this.logger.info(`Email verification code sent to user ${userId}: ${verificationCode}`);

    return {
      success: true,
      secret: verificationCode
    };
  }

  private async sendEmailChallenge(userId: string): Promise<string> {
    const code = this.generateEmailVerificationCode();

    // In a real implementation, send via email service
    this.logger.info(`Email challenge sent to user ${userId}: ${code}`);

    return code;
  }

  private verifyEmailChallenge(expectedCode: string, providedCode: string): boolean {
    return expectedCode === providedCode;
  }

  private async verifyEmailSetup(userId: string, code: string): Promise<{ success: boolean; backupCode?: string; recoveryCodes?: string[] }> {
    // Verify the code sent during setup
    const isValid = this.verifyEmailChallenge('setup_code', code); // Simplified
    if (!isValid) {
      throw new SecurityError('Invalid email code', 'INVALID_EMAIL_CODE', 400);
    }

    const backupCodes = await this.generateBackupCodes(userId);

    return {
      success: true,
      backupCodes
    };
  }

  // Private helper methods for WebAuthn
  private async setupWebAuthn(userId: string, options: any): Promise<{ success: boolean; secret?: string; qrCodeUrl?: string }> {
    // Generate WebAuthn registration options
    const options = await this.webAuthnService.generateRegistrationOptions(userId);

    return {
      success: true,
      secret: JSON.stringify(options)
    };
  }

  private async verifyWebAuthnSetup(userId: string, credential: any): Promise<{ success: boolean; backupCode?: string; recoveryCodes?: string[] }> {
    // Verify WebAuthn registration
    const verification = await this.webAuthnService.verifyRegistration(userId, credential);

    if (!verification.verified) {
      throw new SecurityError('WebAuthn verification failed', 'WEBAUTHN_VERIFICATION_FAILED', 400);
    }

    const backupCodes = await this.generateBackupCodes(userId);

    return {
      success: true,
      backupCodes
    };
  }

  private async verifyWebAuthn(userId: string, credential: any): Promise<boolean> {
    try {
      const verification = await this.webAuthnService.verifyAuthentication(userId, credential);
      return verification.verified;
    } catch {
      return false;
    }
  }

  // Utility methods
  private generateSMSVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateEmailVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateBackupCode(): string {
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
  }

  // Cleanup expired challenges
  private cleanupExpiredChallenges(): void {
    const now = new Date();
    const expiredChallenges: string[] = [];

    for (const [challengeId, challenge] of this.challenges) {
      if (challenge.expiresAt < now) {
        expiredChallenges.push(challengeId);
      }
    }

    for (const challengeId of expiredChallenges) {
      this.challenges.delete(challengeId);
    }

    if (expiredChallenges.length > 0) {
      this.logger.info(`Cleaned up ${expiredChallenges.length} expired MFA challenges`);
    }
  }
}