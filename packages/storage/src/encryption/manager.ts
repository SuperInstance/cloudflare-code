/**
 * Encryption Manager
 * Manages encryption at rest and in transit
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import type {
  EncryptionType,
  EncryptionAlgorithm,
  EncryptionOptions,
  EncryptionInfo,
} from '../types';

// ============================================================================
// Key Management
// ============================================================================

export interface KeyInfo {
  keyId: string;
  algorithm: EncryptionAlgorithm;
  created: Date;
  expires?: Date;
  status: 'active' | 'expired' | 'revoked' | 'disabled';
}

export interface KeyGenerationOptions {
  algorithm?: EncryptionAlgorithm;
  keySize?: number;
  expiresIn?: number; // seconds
}

// ============================================================================
// Encryption Result
// ============================================================================

export interface EncryptionResult {
  data: Buffer;
  encryptionInfo: EncryptionInfo;
}

// ============================================================================
// Decryption Result
// ============================================================================

export interface DecryptionResult {
  data: Buffer;
  encryptionInfo: EncryptionInfo;
}

// ============================================================================
// Encryption Manager
// ============================================================================

export class EncryptionManager {
  private keys: Map<string, Buffer> = new Map();
  private keyInfo: Map<string, KeyInfo> = new Map();
  private defaultAlgorithm: EncryptionAlgorithm = 'AES-GCM-256';

  // ============================================================================
  // Key Management
  // ============================================================================

  /**
   * Generate a new encryption key
   */
  generateKey(options?: KeyGenerationOptions): { keyId: string; key: Buffer } {
    const algorithm = options?.algorithm ?? this.defaultAlgorithm;
    const keySize = options?.keySize ?? 32; // 256 bits for AES-256

    let key: Buffer;
    let keyId: string;

    switch (algorithm) {
      case 'AES256':
      case 'AES-GCM-256':
        key = randomBytes(keySize);
        keyId = this.generateKeyId();
        break;

      case 'AWS-KMS':
      case 'GCP-KMS':
      case 'Azure-KMS':
        // For cloud KMS, generate a key ID but don't store the key
        keyId = this.generateKMSKeyId(algorithm);
        key = Buffer.alloc(0); // Placeholder
        break;

      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    // Store key if not using KMS
    if (!algorithm.includes('KMS')) {
      this.keys.set(keyId, key);
    }

    // Store key info
    const info: KeyInfo = {
      keyId,
      algorithm,
      created: new Date(),
      expires: options?.expiresIn ? new Date(Date.now() + options.expiresIn * 1000) : undefined,
      status: 'active',
    };

    this.keyInfo.set(keyId, info);

    return { keyId, key };
  }

  /**
   * Import an existing key
   */
  importKey(keyId: string, key: Buffer, algorithm: EncryptionAlgorithm): void {
    this.keys.set(keyId, key);
    this.keyInfo.set(keyId, {
      keyId,
      algorithm,
      created: new Date(),
      status: 'active',
    });
  }

  /**
   * Get key info
   */
  getKeyInfo(keyId: string): KeyInfo | undefined {
    return this.keyInfo.get(keyId);
  }

  /**
   * List all keys
   */
  listKeys(): KeyInfo[] {
    return Array.from(this.keyInfo.values());
  }

  /**
   * Revoke a key
   */
  revokeKey(keyId: string): void {
    const info = this.keyInfo.get(keyId);
    if (info) {
      info.status = 'revoked';
      this.keys.delete(keyId);
    }
  }

  /**
   * Delete a key
   */
  deleteKey(keyId: string): void {
    this.keys.delete(keyId);
    this.keyInfo.delete(keyId);
  }

  /**
   * Rotate a key
   */
  rotateKey(keyId: string): { newKeyId: string; newKey: Buffer } {
    const oldInfo = this.keyInfo.get(keyId);
    if (!oldInfo) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Generate new key with same algorithm
    return this.generateKey({
      algorithm: oldInfo.algorithm,
    });
  }

  // ============================================================================
  // Encryption Operations
  // ============================================================================

  /**
   * Encrypt data
   */
  encrypt(
    data: Buffer,
    options: EncryptionOptions
  ): EncryptionResult {
    const algorithm = options.algorithm ?? this.defaultAlgorithm;

    let encrypted: Buffer;
    let iv: Buffer;
    let authTag: Buffer | undefined;
    let keyId: string;

    switch (algorithm) {
      case 'AES256':
        const key256 = this.getKey(options);
        iv = randomBytes(16);
        const cipher256 = createCipheriv('aes-256-cbc', key256, iv);
        encrypted = Buffer.concat([cipher256.update(data), cipher256.final()]);
        keyId = options.keyId ?? this.getDefaultKeyId();
        break;

      case 'AES-GCM-256':
        const keyGcm = this.getKey(options);
        iv = randomBytes(16); // GCM recommends 12 bytes but 16 is fine
        const cipherGcm = createCipheriv('aes-256-gcm', keyGcm, iv);
        authTag = Buffer.alloc(16);
        encrypted = Buffer.concat([cipherGcm.update(data), cipherGcm.final(), cipherGcm.getAuthTag()]);
        keyId = options.keyId ?? this.getDefaultKeyId();
        break;

      case 'AWS-KMS':
      case 'GCP-KMS':
      case 'Azure-KMS':
        // For KMS, encryption would be handled by the cloud provider
        // This is a placeholder
        encrypted = data;
        iv = Buffer.alloc(0);
        keyId = options.keyId ?? options.kmsKeyArn ?? 'kms-default';
        break;

      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    const encryptionInfo: EncryptionInfo = {
      type: options.type,
      algorithm,
      keyId,
      kmsKeyArn: options.kmsKeyArn,
      encrypted: true,
      iv: iv.toString('base64'),
      authTag: authTag?.toString('base64'),
    };

    return {
      data: encrypted,
      encryptionInfo,
    };
  }

  /**
   * Decrypt data
   */
  decrypt(
    data: Buffer,
    encryptionInfo: EncryptionOptions & {
      iv?: string;
      authTag?: string;
    }
  ): DecryptionResult {
    const algorithm = encryptionInfo.algorithm ?? this.defaultAlgorithm;

    let decrypted: Buffer;

    switch (algorithm) {
      case 'AES256':
        const key256 = this.getKey(encryptionInfo);
        const iv256 = Buffer.from(encryptionInfo.iv ?? '', 'base64');
        const decipher256 = createDecipheriv('aes-256-cbc', key256, iv256);
        decrypted = Buffer.concat([decipher256.update(data), decipher256.final()]);
        break;

      case 'AES-GCM-256':
        const keyGcm = this.getKey(encryptionInfo);
        const ivGcm = Buffer.from(encryptionInfo.iv ?? '', 'base64');
        const authTag = Buffer.from(encryptionInfo.authTag ?? '', 'base64');
        const decipherGcm = createDecipheriv('aes-256-gcm', keyGcm, ivGcm);
        decipherGcm.setAuthTag(authTag);
        decrypted = Buffer.concat([decipherGcm.update(data), decipherGcm.final()]);
        break;

      case 'AWS-KMS':
      case 'GCP-KMS':
      case 'Azure-KMS':
        // For KMS, decryption would be handled by the cloud provider
        decrypted = data;
        break;

      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    const info: EncryptionInfo = {
      type: encryptionInfo.type,
      algorithm,
      keyId: encryptionInfo.keyId ?? '',
      encrypted: false,
    };

    return {
      data: decrypted,
      encryptionInfo: info,
    };
  }

  /**
   * Encrypt stream
   */
  *encryptStream(
    stream: Generator<Buffer>,
    options: EncryptionOptions
  ): Generator<Buffer> {
    const algorithm = options.algorithm ?? this.defaultAlgorithm;

    switch (algorithm) {
      case 'AES256':
        const key256 = this.getKey(options);
        const iv = randomBytes(16);
        yield iv; // Yield IV first

        const cipher256 = createCipheriv('aes-256-cbc', key256, iv);
        for (const chunk of stream) {
          yield cipher256.update(chunk);
        }
        yield cipher256.final();
        break;

      case 'AES-GCM-256':
        const keyGcm = this.getKey(options);
        const ivGcm = randomBytes(16);
        yield ivGcm; // Yield IV first

        const cipherGcm = createCipheriv('aes-256-gcm', keyGcm, ivGcm);
        for (const chunk of stream) {
          yield cipherGcm.update(chunk);
        }
        const finalChunk = cipherGcm.final();
        yield finalChunk;
        yield cipherGcm.getAuthTag(); // Yield auth tag last
        break;

      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  /**
   * Decrypt stream
   */
  *decryptStream(
    stream: Generator<Buffer>,
    encryptionInfo: EncryptionOptions & {
      iv?: string;
      authTag?: string;
    }
  ): Generator<Buffer> {
    const algorithm = encryptionInfo.algorithm ?? this.defaultAlgorithm;

    switch (algorithm) {
      case 'AES256':
        const key256 = this.getKey(encryptionInfo);
        const { value: iv256, done: ivDone } = stream.next();
        if (ivDone || !iv256) throw new Error('No IV provided');

        const decipher256 = createDecipheriv('aes-256-cbc', key256, iv256);
        for (const chunk of stream) {
          yield decipher256.update(chunk);
        }
        yield decipher256.final();
        break;

      case 'AES-GCM-256':
        const keyGcm = this.getKey(encryptionInfo);
        const { value: ivGcm, done: ivGcmDone } = stream.next();
        if (ivGcmDone || !ivGcm) throw new Error('No IV provided');

        const decipherGcm = createDecipheriv('aes-256-gcm', keyGcm, ivGcm);

        // Stream all chunks except last (which is auth tag)
        let chunks: Buffer[] = [];
        let authTag: Buffer | undefined;

        for (const chunk of stream) {
          chunks.push(chunk);
        }

        if (chunks.length > 0) {
          authTag = chunks.pop()!;
          for (const chunk of chunks) {
            yield decipherGcm.update(chunk);
          }
        }

        if (authTag) {
          decipherGcm.setAuthTag(authTag);
        }

        yield decipherGcm.final();
        break;

      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  // ============================================================================
  // Client-Side Encryption
  // ============================================================================

  /**
   * Encrypt data client-side before upload
   */
  encryptForUpload(
    data: Buffer,
    options: EncryptionOptions
  ): { encryptedData: Buffer; encryptionInfo: EncryptionInfo } {
    const result = this.encrypt(data, {
      ...options,
      type: 'client-side',
    });

    return {
      encryptedData: result.data,
      encryptionInfo: result.encryptionInfo,
    };
  }

  /**
   * Decrypt data client-side after download
   */
  decryptAfterDownload(
    data: Buffer,
    encryptionInfo: EncryptionInfo
  ): Buffer {
    return this.decrypt(data, {
      type: 'client-side',
      algorithm: encryptionInfo.algorithm,
      keyId: encryptionInfo.keyId,
      iv: encryptionInfo.iv,
      authTag: encryptionInfo.authTag,
    }).data;
  }

  // ============================================================================
  // Server-Side Encryption
  // ============================================================================

  /**
   * Configure server-side encryption options
   */
  configureServerSideEncryption(options: {
    algorithm?: EncryptionAlgorithm;
    kmsKeyArn?: string;
    kmsContext?: Record<string, string>;
  }): EncryptionOptions {
    return {
      type: 'server-side',
      algorithm: options.algorithm ?? this.defaultAlgorithm,
      kmsKeyArn: options.kmsKeyArn,
      kmsContext: options.kmsContext,
    };
  }

  // ============================================================================
  // Hybrid Encryption
  // ============================================================================

  /**
   * Encrypt data using hybrid encryption (client + server)
   */
  encryptHybrid(
    data: Buffer,
    options: EncryptionOptions
  ): EncryptionResult {
    // First encrypt client-side
    const clientEncrypted = this.encrypt(data, {
      ...options,
      type: 'client-side',
    });

    // Then encrypt server-side (this would be done by the storage provider)
    // For now, just return client-side encryption
    return clientEncrypted;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate key ID
   */
  private generateKeyId(): string {
    return `key-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate KMS key ID
   */
  private generateKMSKeyId(algorithm: EncryptionAlgorithm): string {
    const provider = algorithm.split('-')[0].toLowerCase();
    return `${provider}-key-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Get key from options or generate new one
   */
  private getKey(options: EncryptionOptions): Buffer {
    if (options.key) {
      return options.key;
    }

    const keyId = options.keyId ?? this.getDefaultKeyId();
    const key = this.keys.get(keyId);

    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    return key;
  }

  /**
   * Get default key ID
   */
  private getDefaultKeyId(): string {
    const activeKeys = Array.from(this.keyInfo.values()).filter(k => k.status === 'active');
    if (activeKeys.length === 0) {
      // Generate a new key if none exists
      const { keyId } = this.generateKey();
      return keyId;
    }
    return activeKeys[0].keyId;
  }

  /**
   * Derive key from password
   */
  deriveKeyFromPassword(
    password: string,
    salt: string,
    keySize: number = 32
  ): Buffer {
    return scryptSync(password, salt, keySize);
  }

  /**
   * Generate encryption metadata for storage
   */
  generateEncryptionMetadata(options: EncryptionOptions): EncryptionInfo {
    return {
      type: options.type,
      algorithm: options.algorithm ?? this.defaultAlgorithm,
      keyId: options.keyId ?? '',
      kmsKeyArn: options.kmsKeyArn,
      encrypted: false,
    };
  }

  /**
   * Validate encryption options
   */
  validateEncryptionOptions(options: EncryptionOptions): boolean {
    if (!options.type) {
      throw new Error('Encryption type is required');
    }

    if (options.type === 'client-side' && !options.key && !options.keyId) {
      throw new Error('Key or keyId is required for client-side encryption');
    }

    if (options.type === 'server-side' && !options.kmsKeyArn) {
      // Server-side encryption can use default keys
    }

    return true;
  }

  /**
   * Get encryption strength
   */
  getEncryptionStrength(algorithm: EncryptionAlgorithm): number {
    const strengths: Record<EncryptionAlgorithm, number> = {
      'AES256': 256,
      'AES-GCM-256': 256,
      'RSA-OAEP': 2048,
      'AWS-KMS': 256,
      'GCP-KMS': 256,
      'Azure-KMS': 256,
    };

    return strengths[algorithm] ?? 0;
  }

  /**
   * Check if encryption is FIPS compliant
   */
  isFIPSCompliant(algorithm: EncryptionAlgorithm): boolean {
    const fipsCompliant: EncryptionAlgorithm[] = [
      'AES256',
      'AES-GCM-256',
      'AWS-KMS',
      'GCP-KMS',
      'Azure-KMS',
    ];

    return fipsCompliant.includes(algorithm);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clear all keys from memory
   */
  clearAllKeys(): void {
    this.keys.clear();
    this.keyInfo.clear();
  }

  /**
   * Export keys (for backup purposes)
   */
  exportKeys(): Map<string, Buffer> {
    return new Map(this.keys);
  }

  /**
   * Import keys (from backup)
   */
  importKeys(keys: Map<string, Buffer>): void {
    for (const [keyId, key] of keys.entries()) {
      this.keys.set(keyId, key);
    }
  }
}
