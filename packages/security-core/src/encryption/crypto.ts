/**
 * Encryption Utilities - Enterprise-grade cryptographic operations
 * Provides AES-256-GCM, RSA, hashing, HMAC, and key derivation
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  EncryptionAlgorithm,
  HashAlgorithm,
  KeyDerivationAlgorithm,
  EncryptionKey,
  KeyStatus,
  EncryptedData,
  EncryptionResult,
  DecryptionResult,
  KeyDerivationParams,
  KeyPair,
  SecureRandomOptions,
  EncryptionError,
  DecryptionError,
} from '../types';

// ============================================================================
// ENCRYPTION ENGINE
// ============================================================================

export interface EncryptionConfig {
  defaultAlgorithm?: EncryptionAlgorithm;
  keyManagementService?: string;
  fipsCompliant?: boolean;
  cacheKeys?: boolean;
  keyRotationDays?: number;
}

export class EncryptionEngine {
  private keyCache: Map<string, EncryptionKey> = new Map();
  private config: Required<EncryptionConfig>;

  constructor(config: EncryptionConfig = {}) {
    this.config = {
      defaultAlgorithm: config.defaultAlgorithm || EncryptionAlgorithm.AES_256_GCM,
      keyManagementService: config.keyManagementService || 'builtin',
      fipsCompliant: config.fipsCompliant ?? false,
      cacheKeys: config.cacheKeys ?? true,
      keyRotationDays: config.keyRotationDays || 90,
    };
  }

  // ========================================================================
  // SYMMETRIC ENCRYPTION (AES-256-GCM)
  // ========================================================================

  /**
   * Encrypt data using AES-256-GCM
   * Provides authenticated encryption with associated data (AEAD)
   */
  async encryptAES256GCM(
    plaintext: Buffer | string,
    key?: Buffer
  ): Promise<EncryptionResult> {
    try {
      const keyBuffer = key || await this.generateKey(32); // 256 bits
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

      const plaintextBuffer = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);
      const ciphertext = Buffer.concat([
        cipher.update(plaintextBuffer),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        ciphertext: ciphertext,
        iv: iv,
        authTag: authTag,
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        keyId: this.getKeyId(keyBuffer),
      };

      return {
        encryptedData,
        keyId: encryptedData.keyId,
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new EncryptionError('Failed to encrypt with AES-256-GCM', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Decrypt AES-256-GCM encrypted data
   */
  async decryptAES256GCM(
    encryptedData: EncryptedData,
    key: Buffer
  ): Promise<DecryptionResult> {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, encryptedData.iv);
      decipher.setAuthTag(encryptedData.authTag!);

      const plaintext = Buffer.concat([
        decipher.update(encryptedData.ciphertext),
        decipher.final(),
      ]);

      return {
        plaintext,
        verified: true, // GCM provides authentication
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new DecryptionError('Failed to decrypt AES-256-GCM data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Encrypt data using AES-256-CBC (fallback for compatibility)
   */
  async encryptAES256CBC(
    plaintext: Buffer | string,
    key?: Buffer
  ): Promise<EncryptionResult> {
    try {
      const keyBuffer = key || await this.generateKey(32); // 256 bits
      const iv = crypto.randomBytes(16); // 128-bit IV for CBC
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

      const plaintextBuffer = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);
      const ciphertext = Buffer.concat([
        cipher.update(plaintextBuffer),
        cipher.final(),
      ]);

      const encryptedData: EncryptedData = {
        ciphertext: ciphertext,
        iv: iv,
        algorithm: EncryptionAlgorithm.AES_256_CBC,
        keyId: this.getKeyId(keyBuffer),
      };

      return {
        encryptedData,
        keyId: encryptedData.keyId,
        algorithm: EncryptionAlgorithm.AES_256_CBC,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new EncryptionError('Failed to encrypt with AES-256-CBC', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Decrypt AES-256-CBC encrypted data
   */
  async decryptAES256CBC(
    encryptedData: EncryptedData,
    key: Buffer
  ): Promise<DecryptionResult> {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, encryptedData.iv);

      const plaintext = Buffer.concat([
        decipher.update(encryptedData.ciphertext),
        decipher.final(),
      ]);

      return {
        plaintext,
        verified: false, // CBC doesn't provide authentication
        algorithm: EncryptionAlgorithm.AES_256_CBC,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new DecryptionError('Failed to decrypt AES-256-CBC data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ========================================================================
  // ASYMMETRIC ENCRYPTION (RSA)
  // ========================================================================

  /**
   * Generate an RSA key pair
   */
  async generateRSAKeyPair(keySize: 2048 | 4096 = 2048): Promise<KeyPair> {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      const keyId = uuidv4();
      const keyPair: KeyPair = {
        publicKey: Buffer.from(publicKey),
        privateKey: Buffer.from(privateKey),
        keyId,
        algorithm: EncryptionAlgorithm.RSA_OAEP,
        createdAt: new Date(),
        keySize,
      };

      return keyPair;
    } catch (error) {
      throw new EncryptionError('Failed to generate RSA key pair', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Encrypt data using RSA-OAEP
   */
  async encryptRSAOAEP(
    plaintext: Buffer | string,
    publicKey: Buffer
  ): Promise<EncryptionResult> {
    try {
      const plaintextBuffer = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey.toString(),
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        plaintextBuffer
      );

      const encryptedData: EncryptedData = {
        ciphertext: encrypted,
        iv: Buffer.alloc(0), // RSA doesn't use IV
        algorithm: EncryptionAlgorithm.RSA_OAEP,
        keyId: this.getKeyId(publicKey),
      };

      return {
        encryptedData,
        keyId: encryptedData.keyId,
        algorithm: EncryptionAlgorithm.RSA_OAEP,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new EncryptionError('Failed to encrypt with RSA-OAEP', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Decrypt RSA-OAEP encrypted data
   */
  async decryptRSAOAEP(
    encryptedData: EncryptedData,
    privateKey: Buffer
  ): Promise<DecryptionResult> {
    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey.toString(),
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encryptedData.ciphertext
      );

      return {
        plaintext: decrypted,
        verified: true,
        algorithm: EncryptionAlgorithm.RSA_OAEP,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new DecryptionError('Failed to decrypt RSA-OAEP data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Sign data using RSA
   */
  async signRSA(
    data: Buffer | string,
    privateKey: Buffer,
    algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'
  ): Promise<Buffer> {
    try {
      const sign = crypto.createSign(algorithm);
      sign.update(data);
      sign.end();
      return sign.sign(privateKey);
    } catch (error) {
      throw new EncryptionError('Failed to sign data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Verify RSA signature
   */
  async verifyRSA(
    data: Buffer | string,
    signature: Buffer,
    publicKey: Buffer,
    algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'
  ): Promise<boolean> {
    try {
      const verify = crypto.createVerify(algorithm);
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature);
    } catch {
      return false;
    }
  }

  // ========================================================================
  // HASHING
  // ========================================================================

  /**
   * Compute hash of data
   */
  async hash(
    data: Buffer | string,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): Promise<Buffer> {
    try {
      const hash = crypto.createHash(algorithm);
      hash.update(data);
      return hash.digest();
    } catch (error) {
      throw new EncryptionError('Failed to compute hash', {
        algorithm,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Compute hash as hex string
   */
  async hashHex(
    data: Buffer | string,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): Promise<string> {
    const hash = await this.hash(data, algorithm);
    return hash.toString('hex');
  }

  /**
   * Verify data against a hash
   */
  async verifyHash(
    data: Buffer | string,
    expectedHash: Buffer,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): Promise<boolean> {
    const actualHash = await this.hash(data, algorithm);
    return crypto.timingSafeEqual(actualHash, expectedHash);
  }

  /**
   * Hash with multiple iterations (key stretching)
   */
  async hashIterated(
    data: Buffer | string,
    iterations: number,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): Promise<Buffer> {
    let hash = Buffer.isBuffer(data) ? data : Buffer.from(data);
    for (let i = 0; i < iterations; i++) {
      hash = await this.hash(hash, algorithm);
    }
    return hash;
  }

  // ========================================================================
  // HMAC (KEYED-HASH MESSAGE AUTHENTICATION CODE)
  // ========================================================================

  /**
   * Generate HMAC for data
   */
  async generateHMAC(
    data: Buffer | string,
    key: Buffer,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): Promise<Buffer> {
    try {
      const hmac = crypto.createHmac(algorithm, key);
      hmac.update(data);
      return hmac.digest();
    } catch (error) {
      throw new EncryptionError('Failed to generate HMAC', {
        algorithm,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate HMAC as hex string
   */
  async generateHACHex(
    data: Buffer | string,
    key: Buffer,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): Promise<string> {
    const hmac = await this.generateHMAC(data, key, algorithm);
    return hmac.toString('hex');
  }

  /**
   * Verify HMAC
   */
  async verifyHMAC(
    data: Buffer | string,
    key: Buffer,
    expectedHMAC: Buffer,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): Promise<boolean> {
    try {
      const actualHMAC = await this.generateHMAC(data, key, algorithm);
      return crypto.timingSafeEqual(actualHMAC, expectedHMAC);
    } catch {
      return false;
    }
  }

  // ========================================================================
  // KEY DERIVATION
  // ========================================================================

  /**
   * Derive key using PBKDF2
   */
  async deriveKeyPBKDF2(
    password: string,
    salt: Buffer,
    iterations: number = 100000,
    keyLength: number = 32,
    digest: string = 'sha256'
  ): Promise<Buffer> {
    try {
      return crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest);
    } catch (error) {
      throw new EncryptionError('Failed to derive key with PBKDF2', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Derive key using HKDF (HMAC-based Key Derivation Function)
   */
  async deriveKeyHKDF(
    inputKey: Buffer,
    salt: Buffer,
    info: Buffer,
    keyLength: number = 32,
    hash: HashAlgorithm = HashAlgorithm.SHA256
  ): Promise<Buffer> {
    try {
      return crypto.hkdfSync(hash, inputKey, salt, info, keyLength);
    } catch (error) {
      throw new EncryptionError('Failed to derive key with HKDF', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Derive key using scrypt
   */
  async deriveKeyScrypt(
    password: string,
    salt: Buffer,
    keyLength: number = 32,
    cost: number = 16384,
    blockSize: number = 8,
    parallelization: number = 1
  ): Promise<Buffer> {
    try {
      return crypto.scryptSync(password, salt, keyLength, {
        cost,
        blockSize,
        parallelization,
      });
    } catch (error) {
      throw new EncryptionError('Failed to derive key with scrypt', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Derive key using Argon2i (requires argon2 package)
   */
  async deriveKeyArgon2i(
    password: string,
    salt: Buffer,
    iterations: number = 3,
    memory: number = 65536, // in KB
    parallelism: number = 1,
    keyLength: number = 32
  ): Promise<Buffer> {
    try {
      const argon2 = await import('argon2');
      const hash = await argon2.hash(password, {
        type: argon2.argon2i,
        memory,
        iterations,
        parallelism,
        hashLength: keyLength,
        salt: Buffer.from(salt),
      });
      return Buffer.from(hash);
    } catch (error) {
      throw new EncryptionError('Failed to derive key with Argon2i', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Derive key using Argon2id (recommended for passwords)
   */
  async deriveKeyArgon2id(
    password: string,
    salt: Buffer,
    iterations: number = 3,
    memory: number = 65536, // in KB
    parallelism: number = 1,
    keyLength: number = 32
  ): Promise<Buffer> {
    try {
      const argon2 = await import('argon2');
      const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memory,
        iterations,
        parallelism,
        hashLength: keyLength,
        salt: Buffer.from(salt),
      });
      return Buffer.from(hash);
    } catch (error) {
      throw new EncryptionError('Failed to derive key with Argon2id', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ========================================================================
  // SECURE RANDOM GENERATION
  // ========================================================================

  /**
   * Generate cryptographically secure random bytes
   */
  async generateSecureRandom(options: SecureRandomOptions): Promise<string> {
    const bytes = crypto.randomBytes(options.length);

    switch (options.type) {
      case 'bytes':
        return bytes.toString('binary');
      case 'hex':
        return bytes.toString('hex');
      case 'base64':
        return bytes.toString('base64');
      case 'url-safe':
        return bytes.toString('base64url');
      default:
        throw new EncryptionError('Invalid random type', { type: options.type });
    }
  }

  /**
   * Generate a random integer within a range
   */
  async generateRandomInt(min: number, max: number): Promise<number> {
    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const bytes = crypto.randomBytes(bytesNeeded);
    const value = bytes.readUIntBE(0, bytesNeeded);
    return min + (value % range);
  }

  /**
   * Generate a UUID v4
   */
  generateUUID(): string {
    return uuidv4();
  }

  /**
   * Generate a secure random password
   */
  async generatePassword(length: number = 16, options?: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  }): Promise<string> {
    const defaults = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
    };
    const opts = { ...defaults, ...options };

    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charset = '';
    if (opts.includeUppercase) charset += uppercase;
    if (opts.includeLowercase) charset += lowercase;
    if (opts.includeNumbers) charset += numbers;
    if (opts.includeSymbols) charset += symbols;

    if (charset.length === 0) {
      throw new EncryptionError('No character sets selected');
    }

    let password = '';
    const randomBytes = await this.generateSecureRandom({ length, type: 'bytes' });
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes.charCodeAt(i) % charset.length];
    }

    return password;
  }

  // ========================================================================
  // KEY MANAGEMENT
  // ========================================================================

  /**
   * Generate a symmetric encryption key
   */
  async generateKey(length: number = 32): Promise<Buffer> {
    return crypto.randomBytes(length);
  }

  /**
   * Generate a key ID
   */
  generateKeyId(): string {
    return uuidv4();
  }

  /**
   * Store a key in the cache
   */
  cacheEncryptionKey(key: EncryptionKey): void {
    if (this.config.cacheKeys) {
      this.keyCache.set(key.keyId, key);
    }
  }

  /**
   * Retrieve a key from the cache
   */
  getCachedKey(keyId: string): EncryptionKey | undefined {
    return this.keyCache.get(keyId);
  }

  /**
   * Remove a key from the cache
   */
  removeCachedKey(keyId: string): void {
    this.keyCache.delete(keyId);
  }

  /**
   * Rotate a key
   */
  async rotateKey(oldKey: EncryptionKey): Promise<EncryptionKey> {
    const newKey: EncryptionKey = {
      keyId: this.generateKeyId(),
      version: oldKey.version + 1,
      algorithm: oldKey.algorithm,
      keyData: await this.generateKey(oldKey.keyData.length),
      createdAt: new Date(),
      status: KeyStatus.ACTIVE,
      metadata: {
        ...oldKey.metadata,
        rotatedFrom: oldKey.keyId,
        rotatedAt: new Date().toISOString(),
      },
    };

    if (this.config.cacheKeys) {
      this.cacheEncryptionKey(newKey);
    }

    return newKey;
  }

  /**
   * Export a key in a specific format
   */
  async exportKey(key: Buffer, format: 'raw' | 'jwk' | 'spki' | 'pkcs8'): Promise<string> {
    switch (format) {
      case 'raw':
        return key.toString('base64');
      case 'jwk':
        // Simplified JWK export (full implementation would be more complex)
        return JSON.stringify({
          kty: 'oct',
          k: key.toString('base64url'),
        });
      case 'spki':
      case 'pkcs8':
        // For asymmetric keys only
        throw new EncryptionError('Format not supported for symmetric keys', { format });
      default:
        throw new EncryptionError('Invalid export format', { format });
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private getKeyId(key: Buffer): string {
    // Generate a deterministic key ID from the key
    const hash = crypto.createHash('sha256');
    hash.update(key);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Compare two buffers in constant time
   */
  constantTimeCompare(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Encode data to base64
   */
  encodeBase64(data: Buffer | string): string {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return buffer.toString('base64');
  }

  /**
   * Decode data from base64
   */
  decodeBase64(encoded: string): Buffer {
    return Buffer.from(encoded, 'base64');
  }

  /**
   * Encode data to base64url (URL-safe)
   */
  encodeBase64URL(data: Buffer | string): string {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return buffer.toString('base64url');
  }

  /**
   * Decode data from base64url
   */
  decodeBase64URL(encoded: string): Buffer {
    return Buffer.from(encoded, 'base64url');
  }
}

// ============================================================================
// CRYPTOGRAPHIC UTILITIES
// ============================================================================

export class CryptoUtils {
  private static engine = new EncryptionEngine();

  /**
   * Quick encryption helper
   */
  static async encrypt(
    plaintext: string,
    key?: Buffer,
    algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM
  ): Promise<string> {
    let result: EncryptionResult;

    switch (algorithm) {
      case EncryptionAlgorithm.AES_256_GCM:
        result = await this.engine.encryptAES256GCM(plaintext, key);
        break;
      case EncryptionAlgorithm.AES_256_CBC:
        result = await this.engine.encryptAES256CBC(plaintext, key);
        break;
      default:
        throw new EncryptionError('Unsupported algorithm', { algorithm });
    }

    return JSON.stringify({
      ct: result.encryptedData.ciphertext.toString('base64'),
      iv: result.encryptedData.iv.toString('base64'),
      tag: result.encryptedData.authTag?.toString('base64'),
      alg: result.algorithm,
    });
  }

  /**
   * Quick decryption helper
   */
  static async decrypt(
    ciphertext: string,
    key: Buffer,
    algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM
  ): Promise<string> {
    const data = JSON.parse(ciphertext);
    const encryptedData: EncryptedData = {
      ciphertext: Buffer.from(data.ct, 'base64'),
      iv: Buffer.from(data.iv, 'base64'),
      authTag: data.tag ? Buffer.from(data.tag, 'base64') : undefined,
      algorithm: data.alg,
      keyId: '',
    };

    let result: DecryptionResult;

    switch (algorithm) {
      case EncryptionAlgorithm.AES_256_GCM:
        result = await this.engine.decryptAES256GCM(encryptedData, key);
        break;
      case EncryptionAlgorithm.AES_256_CBC:
        result = await this.engine.decryptAES256CBC(encryptedData, key);
        break;
      default:
        throw new DecryptionError('Unsupported algorithm', { algorithm });
    }

    return result.plaintext.toString('utf8');
  }

  /**
   * Quick hash helper
   */
  static async hash(
    data: string,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): Promise<string> {
    return this.engine.hashHex(data, algorithm);
  }

  /**
   * Generate a secure random token
   */
  static async generateToken(length: number = 32): Promise<string> {
    return this.engine.generateSecureRandom({
      length,
      type: 'base64url',
    });
  }

  /**
   * Generate a UUID
   */
  static generateUUID(): string {
    return this.engine.generateUUID();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { EncryptionEngine, EncryptionConfig };
