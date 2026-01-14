/**
 * Cryptographic Utilities
 * Secure random number generation, hashing, and encryption
 */

import type { EncryptionConfig, EncryptedData } from '../types';

// ============================================================================
// Random Number Generation
// ============================================================================

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number, charset?: string): string {
  const defaultCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const chars = charset || defaultCharset;
  let result = '';

  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }

  return result;
}

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(bytes: number = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);

  // Set version to 4 and variant to RFC 4122
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;

  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.substr(0, 8),
    hex.substr(8, 4),
    hex.substr(12, 4),
    hex.substr(16, 4),
    hex.substr(20, 12)
  ].join('-');
}

// ============================================================================
// Hashing
// ============================================================================

/**
 * Hash a string using SHA-256
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a string using SHA-512
 */
export async function sha512(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a string using SHA-1 (legacy, not recommended)
 */
export async function sha1(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate an HMAC
 */
export async function hmac(
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512',
  key: string,
  data: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(key);
  const dataBuffer = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate an HMAC-SHA256
 */
export async function hmacSHA256(key: string, data: string): Promise<string> {
  return hmac('SHA-256', key, data);
}

// ============================================================================
// PBKDF2 Key Derivation
// ============================================================================

/**
 * Derive a key from a password using PBKDF2
 */
export async function pbkdf2(
  password: string,
  salt: string,
  iterations: number = 100000,
  hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256',
  keyLength: number = 32
): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: hashAlgorithm
    },
    importedKey,
    keyLength * 8
  );

  const derivedArray = Array.from(new Uint8Array(derivedBits));
  return derivedArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Encryption/Decryption
// ============================================================================

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(
  plaintext: string,
  key: string,
  config: EncryptionConfig = {}
): Promise<EncryptedData> {
  const algorithm = config.algorithm || 'AES-256-GCM';
  const ivLength = config.ivLength || 12;
  const authTagLength = config.authTagLength || 16;

  // Generate key from password
  const keyBuffer = await importKey(key, 256);
  const iv = crypto.getRandomValues(new Uint8Array(ivLength));

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(plaintext);

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: authTagLength
    },
    keyBuffer,
    dataBuffer
  );

  return {
    data: Array.from(new Uint8Array(encryptedData))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    authTag: '', // Included in encryptedData for GCM
    algorithm
  };
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(
  encryptedData: EncryptedData,
  key: string
): Promise<string> {
  const keyBuffer = await importKey(key, 256);
  const iv = new Uint8Array(
    encryptedData.iv.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  const data = new Uint8Array(
    encryptedData.data.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 16
    },
    keyBuffer,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Import a key for encryption/decryption
 */
async function importKey(password: string, keyLength: number = 256): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Derive a key from the password
  const keyDerivationKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = encoder.encode('claudeflare-security-salt');

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyDerivationKey,
    { name: 'AES-GCM', length: keyLength },
    false,
    ['encrypt', 'decrypt']
  );
}

// ============================================================================
// Base64 Encoding/Decoding
// ============================================================================

/**
 * Encode a string to base64
 */
export function base64Encode(data: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

/**
 * Decode a base64 string
 */
export function base64Decode(data: string): string {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Encode a string to URL-safe base64
 */
export function base64URLEncode(data: string): string {
  return base64Encode(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode a URL-safe base64 string
 */
export function base64URLDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64Decode(base64);
}

// ============================================================================
// Constant-Time Comparison
// ============================================================================

/**
 * Compare two strings in constant time to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// ============================================================================
// Password Hashing (bcrypt-style)
// ============================================================================

/**
 * Hash a password using a secure algorithm
 * Note: In Cloudflare Workers, we'll use a simplified approach
 * For production, consider using Workers KV to store bcrypt hashes
 */
export async function hashPassword(password: string, salt?: string): Promise<{
  hash: string;
  salt: string;
  algorithm: string;
  iterations: number;
}> {
  const passwordSalt = salt || generateToken(16);
  const iterations = 100000;
  const hash = await pbkdf2(password, passwordSalt, iterations);

  return {
    hash,
    salt: passwordSalt,
    algorithm: 'pbkdf2-sha256',
    iterations
  };
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
  iterations: number = 100000
): Promise<boolean> {
  const computedHash = await pbkdf2(password, salt, iterations);
  return constantTimeCompare(hash, computedHash);
}
