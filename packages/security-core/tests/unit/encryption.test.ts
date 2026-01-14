/**
 * Unit Tests for Encryption Utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  EncryptionEngine,
  CryptoUtils,
} from '../../src/encryption/crypto';
import {
  EncryptionAlgorithm,
  HashAlgorithm,
  KeyDerivationAlgorithm,
} from '../../src/types';

describe('EncryptionEngine', () => {
  let engine: EncryptionEngine;

  beforeEach(() => {
    engine = new EncryptionEngine({
      defaultAlgorithm: EncryptionAlgorithm.AES_256_GCM,
      fipsCompliant: false,
      cacheKeys: true,
    });
  });

  describe('AES-256-GCM Encryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const plaintext = 'Sensitive data to encrypt';
      const key = await engine.generateKey(32);

      const encrypted = await engine.encryptAES256GCM(plaintext, key);
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.encryptedData.iv).toBeDefined();
      expect(encrypted.encryptedData.authTag).toBeDefined();
      expect(encrypted.encryptedData.ciphertext).not.toBe(plaintext);

      const decrypted = await engine.decryptAES256GCM(encrypted.encryptedData, key);
      expect(decrypted.plaintext.toString('utf8')).toBe(plaintext);
      expect(decrypted.verified).toBe(true);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = 'Same data';
      const key = await engine.generateKey(32);

      const encrypted1 = await engine.encryptAES256GCM(plaintext, key);
      const encrypted2 = await engine.encryptAES256GCM(plaintext, key);

      expect(encrypted1.encryptedData.ciphertext.toString('hex')).not.toBe(
        encrypted2.encryptedData.ciphertext.toString('hex')
      );
    });

    it('should fail to decrypt with wrong key', async () => {
      const plaintext = 'Secret data';
      const key1 = await engine.generateKey(32);
      const key2 = await engine.generateKey(32);

      const encrypted = await engine.encryptAES256GCM(plaintext, key1);

      await expect(
        engine.decryptAES256GCM(encrypted.encryptedData, key2)
      ).rejects.toThrow();
    });
  });

  describe('AES-256-CBC Encryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const plaintext = 'Data for CBC encryption';
      const key = await engine.generateKey(32);

      const encrypted = await engine.encryptAES256CBC(plaintext, key);
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.encryptedData.iv).toBeDefined();

      const decrypted = await engine.decryptAES256CBC(encrypted.encryptedData, key);
      expect(decrypted.plaintext.toString('utf8')).toBe(plaintext);
    });
  });

  describe('RSA Encryption', () => {
    it('should generate RSA key pair', async () => {
      const keyPair = await engine.generateRSAKeyPair(2048);

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.keyId).toBeDefined();
      expect(keyPair.keySize).toBe(2048);
    });

    it('should encrypt and decrypt with RSA-OAEP', async () => {
      const keyPair = await engine.generateRSAKeyPair(2048);
      const plaintext = 'Data for RSA encryption';

      const encrypted = await engine.encryptRSAOAEP(plaintext, keyPair.publicKey);
      expect(encrypted.encryptedData.ciphertext).toBeDefined();

      const decrypted = await engine.decryptRSAOAEP(encrypted.encryptedData, keyPair.privateKey);
      expect(decrypted.plaintext.toString('utf8')).toBe(plaintext);
    });

    it('should sign and verify data', async () => {
      const keyPair = await engine.generateRSAKeyPair(2048);
      const data = 'Data to sign';

      const signature = await engine.signRSA(data, keyPair.privateKey);
      expect(signature).toBeDefined();

      const verified = await engine.verifyRSA(data, signature, keyPair.publicKey);
      expect(verified).toBe(true);
    });

    it('should fail to verify tampered data', async () => {
      const keyPair = await engine.generateRSAKeyPair(2048);
      const data = 'Original data';
      const tamperedData = 'Tampered data';

      const signature = await engine.signRSA(data, keyPair.privateKey);

      const verified = await engine.verifyRSA(tamperedData, signature, keyPair.publicKey);
      expect(verified).toBe(false);
    });
  });

  describe('Hashing', () => {
    it('should compute SHA-256 hash', async () => {
      const data = 'Data to hash';
      const hash = await engine.hash(data, HashAlgorithm.SHA256);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(32); // 256 bits = 32 bytes
    });

    it('should compute SHA-512 hash', async () => {
      const data = 'Data to hash';
      const hash = await engine.hash(data, HashAlgorithm.SHA512);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // 512 bits = 64 bytes
    });

    it('should produce consistent hashes', async () => {
      const data = 'Consistent data';

      const hash1 = await engine.hash(data, HashAlgorithm.SHA256);
      const hash2 = await engine.hash(data, HashAlgorithm.SHA256);

      expect(hash1.toString('hex')).toBe(hash2.toString('hex'));
    });

    it('should verify hash correctly', async () => {
      const data = 'Data to verify';
      const hash = await engine.hash(data, HashAlgorithm.SHA256);

      const isValid = await engine.verifyHash(data, hash, HashAlgorithm.SHA256);
      expect(isValid).toBe(true);
    });

    it('should reject invalid hash', async () => {
      const data = 'Original data';
      const wrongHash = await engine.hash('Different data', HashAlgorithm.SHA256);

      const isValid = await engine.verifyHash(data, wrongHash, HashAlgorithm.SHA256);
      expect(isValid).toBe(false);
    });

    it('should hash with iterations for key stretching', async () => {
      const data = 'Password';
      const iterations = 10000;

      const hash = await engine.hashIterated(data, iterations, HashAlgorithm.SHA256);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(32);
    });
  });

  describe('HMAC', () => {
    it('should generate HMAC', async () => {
      const data = 'Data for HMAC';
      const key = await engine.generateKey(32);

      const hmac = await engine.generateHMAC(data, key, HashAlgorithm.SHA256);
      expect(hmac).toBeDefined();
      expect(hmac.length).toBe(32);
    });

    it('should verify HMAC correctly', async () => {
      const data = 'Data to verify';
      const key = await engine.generateKey(32);

      const hmac = await engine.generateHMAC(data, key, HashAlgorithm.SHA256);
      const isValid = await engine.verifyHMAC(data, key, hmac, HashAlgorithm.SHA256);

      expect(isValid).toBe(true);
    });

    it('should reject invalid HMAC', async () => {
      const data = 'Original data';
      const key = await engine.generateKey(32);
      const wrongHmac = await engine.generateHMAC('Different data', key, HashAlgorithm.SHA256);

      const isValid = await engine.verifyHMAC(data, key, wrongHmac, HashAlgorithm.SHA256);
      expect(isValid).toBe(false);
    });
  });

  describe('Key Derivation', () => {
    it('should derive key with PBKDF2', async () => {
      const password = 'SecurePassword123';
      const salt = await engine.generateKey(16);

      const derivedKey = await engine.deriveKeyPBKDF2(password, salt, 100000, 32);
      expect(derivedKey).toBeDefined();
      expect(derivedKey.length).toBe(32);
    });

    it('should derive key with HKDF', async () => {
      const inputKey = await engine.generateKey(32);
      const salt = await engine.generateKey(16);
      const info = Buffer.from('key-derivation');

      const derivedKey = await engine.deriveKeyHKDF(inputKey, salt, info, 32);
      expect(derivedKey).toBeDefined();
      expect(derivedKey.length).toBe(32);
    });

    it('should derive key with scrypt', async () => {
      const password = 'SecurePassword123';
      const salt = await engine.generateKey(16);

      const derivedKey = await engine.deriveKeyScrypt(password, salt, 32, 16384, 8, 1);
      expect(derivedKey).toBeDefined();
      expect(derivedKey.length).toBe(32);
    });

    it('should produce consistent derived keys', async () => {
      const password = 'SamePassword';
      const salt = await engine.generateKey(16);

      const key1 = await engine.deriveKeyPBKDF2(password, salt, 100000, 32);
      const key2 = await engine.deriveKeyPBKDF2(password, salt, 100000, 32);

      expect(key1.toString('hex')).toBe(key2.toString('hex'));
    });
  });

  describe('Secure Random Generation', () => {
    it('should generate random bytes', async () => {
      const random = await engine.generateSecureRandom({
        length: 32,
        type: 'bytes',
      });

      expect(random).toBeDefined();
      expect(Buffer.byteLength(random, 'binary')).toBe(32);
    });

    it('should generate random hex', async () => {
      const random = await engine.generateSecureRandom({
        length: 32,
        type: 'hex',
      });

      expect(random).toBeDefined();
      expect(random.length).toBe(64); // 32 bytes = 64 hex chars
      expect(/^[0-9a-f]+$/.test(random)).toBe(true);
    });

    it('should generate random base64', async () => {
      const random = await engine.generateSecureRandom({
        length: 32,
        type: 'base64',
      });

      expect(random).toBeDefined();
      expect(random.length).toBeGreaterThan(0);
    });

    it('should generate random URL-safe string', async () => {
      const random = await engine.generateSecureRandom({
        length: 32,
        type: 'url-safe',
      });

      expect(random).toBeDefined();
      expect(random).not.toContain('+');
      expect(random).not.toContain('/');
      expect(random).not.toContain('=');
    });

    it('should generate random integers', async () => {
      const random = await engine.generateRandomInt(1, 100);

      expect(random).toBeGreaterThanOrEqual(1);
      expect(random).toBeLessThanOrEqual(100);
    });

    it('should generate UUIDs', () => {
      const uuid1 = engine.generateUUID();
      const uuid2 = engine.generateUUID();

      expect(uuid1).toBeDefined();
      expect(uuid2).toBeDefined();
      expect(uuid1).not.toBe(uuid2);
      expect(/^[0-9a-f-]{36}$/.test(uuid1)).toBe(true);
    });

    it('should generate secure passwords', async () => {
      const password = await engine.generatePassword(16, {
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
      });

      expect(password).toBeDefined();
      expect(password.length).toBe(16);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true);
    });
  });

  describe('Key Management', () => {
    it('should cache and retrieve keys', async () => {
      const keyData = await engine.generateKey(32);
      const key = {
        keyId: engine.generateKeyId(),
        version: 1,
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        keyData,
        createdAt: new Date(),
        status: 'active' as any,
        metadata: {},
      };

      engine.cacheEncryptionKey(key);
      const retrieved = engine.getCachedKey(key.keyId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.keyData.toString('hex')).toBe(keyData.toString('hex'));
    });

    it('should remove cached keys', async () => {
      const keyData = await engine.generateKey(32);
      const key = {
        keyId: engine.generateKeyId(),
        version: 1,
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        keyData,
        createdAt: new Date(),
        status: 'active' as any,
        metadata: {},
      };

      engine.cacheEncryptionKey(key);
      engine.removeCachedKey(key.keyId);

      const retrieved = engine.getCachedKey(key.keyId);
      expect(retrieved).toBeUndefined();
    });

    it('should rotate keys', async () => {
      const keyData = await engine.generateKey(32);
      const oldKey = {
        keyId: engine.generateKeyId(),
        version: 1,
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        keyData,
        createdAt: new Date(),
        status: 'active' as any,
        metadata: {},
      };

      const newKey = await engine.rotateKey(oldKey);

      expect(newKey.version).toBe(2);
      expect(newKey.keyId).not.toBe(oldKey.keyId);
      expect(newKey.metadata.rotatedFrom).toBe(oldKey.keyId);
    });
  });

  describe('Utility Methods', () => {
    it('should encode and decode base64', () => {
      const data = 'Hello, World!';
      const encoded = engine.encodeBase64(data);
      const decoded = engine.decodeBase64(encoded);

      expect(decoded.toString('utf8')).toBe(data);
    });

    it('should encode and decode base64url', () => {
      const data = 'Hello, World!';
      const encoded = engine.encodeBase64URL(data);
      const decoded = engine.decodeBase64URL(encoded);

      expect(decoded.toString('utf8')).toBe(data);
    });

    it('should compare buffers in constant time', () => {
      const buffer1 = Buffer.from('same-data');
      const buffer2 = Buffer.from('same-data');
      const buffer3 = Buffer.from('different-data');

      expect(engine.constantTimeCompare(buffer1, buffer2)).toBe(true);
      expect(engine.constantTimeCompare(buffer1, buffer3)).toBe(false);
    });
  });
});

describe('CryptoUtils', () => {
  describe('Quick Helpers', () => {
    it('should encrypt and decrypt strings', async () => {
      const plaintext = 'Quick encryption test';
      const key = Buffer.from('01234567890123456789012345678901'); // 32 bytes

      const encrypted = await CryptoUtils.encrypt(plaintext, key);
      expect(encrypted).toBeDefined();

      const decrypted = await CryptoUtils.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should hash strings', async () => {
      const data = 'Hash this data';
      const hash = await CryptoUtils.hash(data, HashAlgorithm.SHA256);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate secure tokens', async () => {
      const token = await CryptoUtils.generateToken(32);

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate UUIDs', () => {
      const uuid1 = CryptoUtils.generateUUID();
      const uuid2 = CryptoUtils.generateUUID();

      expect(uuid1).toBeDefined();
      expect(uuid2).toBeDefined();
      expect(uuid1).not.toBe(uuid2);
    });
  });
});
