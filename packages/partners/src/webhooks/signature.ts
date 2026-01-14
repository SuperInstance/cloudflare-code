/**
 * Webhook Signature Service
 * Generates and verifies webhook signatures
 */

import { WebhookEvent, WebhookSignature } from '../types';

export class WebhookSignatureService {
  /**
   * Generate webhook signature
   */
  public generateSignature(
    secret: string,
    event: WebhookEvent,
    version = 1
  ): WebhookSignature {
    const timestamp = new Date().toISOString();
    const payload = JSON.stringify(event.data);

    // Create signature string
    const signatureString = this.createSignatureString(
      version,
      timestamp,
      payload
    );

    // Generate signature
    const signature = this.hmac(secret, signatureString);

    return {
      timestamp,
      signature,
      algorithm: 'sha256'
    };
  }

  /**
   * Verify webhook signature
   */
  public verifySignature(
    payload: string,
    signature: string,
    secret: string,
    timestamp: string,
    tolerance = 300000 // 5 minutes default
  ): boolean {
    // Check timestamp freshness
    const payloadTime = new Date(timestamp).getTime();
    const now = Date.now();

    if (Math.abs(now - payloadTime) > tolerance) {
      return false;
    }

    // Create expected signature
    const signatureString = this.createSignatureString(1, timestamp, payload);
    const expectedSignature = this.hmac(secret, signatureString);

    // Constant-time comparison
    return this.constantTimeCompare(signature, expectedSignature);
  }

  /**
   * Create signature string
   */
  private createSignatureString(
    version: number,
    timestamp: string,
    payload: string
  ): string {
    return `v=${version}&t=${timestamp}&payload=${payload}`;
  }

  /**
   * Generate HMAC signature
   */
  private hmac(secret: string, message: string): string {
    const encoder = new TextEncoder();

    // Import secret key
    const key = encoder.encode(secret);

    return crypto.subtle
      .importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      .then(cryptoKey => {
        // Sign message
        const messageData = encoder.encode(message);
        return crypto.subtle.sign('HMAC', cryptoKey, messageData);
      })
      .then(signature => {
        // Convert to hex
        const hashArray = Array.from(new Uint8Array(signature));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      });
  }

  /**
   * Constant-time string comparison
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Generate webhook secret
   */
  public generateSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate webhook secret format
   */
  public validateSecret(secret: string): boolean {
    // Should be a hex string of 64 characters (32 bytes)
    return /^[a-f0-9]{64}$/.test(secret);
  }
}
