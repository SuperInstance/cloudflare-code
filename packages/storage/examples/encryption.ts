/**
 * Encryption Examples
 */

import { EncryptionManager } from '../src';
import { MemoryStorageAdapter, FileManager } from '../src';

async function basicEncryption() {
  const encryption = new EncryptionManager();

  // Generate an encryption key
  const { keyId } = encryption.generateKey({
    algorithm: 'AES-GCM-256',
  });

  console.log('Generated key ID:', keyId);

  // Encrypt some data
  const originalData = Buffer.from('Secret message');
  const { data: encrypted, encryptionInfo } = encryption.encrypt(originalData, {
    type: 'client-side',
    algorithm: 'AES-GCM-256',
    keyId,
  });

  console.log('\nEncrypted data:');
  console.log('  Original size:', originalData.length);
  console.log('  Encrypted size:', encrypted.length);
  console.log('  Encryption info:', encryptionInfo);

  // Decrypt the data
  const { data: decrypted } = encryption.decrypt(encrypted, {
    type: 'client-side',
    algorithm: 'AES-GCM-256',
    keyId,
    iv: encryptionInfo.iv,
    authTag: encryptionInfo.authTag,
  });

  console.log('\nDecrypted data:');
  console.log('  Decrypted size:', decrypted.length);
  console.log('  Content matches:', decrypted.equals(originalData));

  // Cleanup
  encryption.clearAllKeys();
}

async function encryptionWithUpload() {
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  const encryption = new EncryptionManager();
  const fileManager = new FileManager(adapter);

  await adapter.createBucket({ name: 'encrypted-bucket' });

  // Generate key
  const { keyId } = encryption.generateKey();

  // Encrypt file before upload
  const originalData = Buffer.from('Confidential document content');
  const { data: encrypted, encryptionInfo } = encryption.encrypt(originalData, {
    type: 'client-side',
    keyId,
  });

  // Upload encrypted file
  await fileManager.uploadFile(
    'encrypted-bucket',
    'confidential.txt',
    encrypted,
    {
      metadata: {
        encrypted: 'true',
        encryptionInfo: JSON.stringify(encryptionInfo),
      },
    }
  );

  console.log('Uploaded encrypted file');

  // Download and decrypt
  const { data: downloaded } = await fileManager.downloadFile(
    'encrypted-bucket',
    'confidential.txt'
  );

  const { data: decrypted } = encryption.decrypt(downloaded, {
    type: 'client-side',
    keyId,
    iv: encryptionInfo.iv,
    authTag: encryptionInfo.authTag,
  });

  console.log('Decrypted content:', decrypted.toString());
  console.log('Content matches:', decrypted.equals(originalData));

  // Cleanup
  encryption.clearAllKeys();
  await adapter.close();
}

async function keyManagement() {
  const encryption = new EncryptionManager();

  // Generate multiple keys
  const key1 = encryption.generateKey({ algorithm: 'AES-GCM-256' });
  const key2 = encryption.generateKey({ algorithm: 'AES256' });

  console.log('Generated keys:');
  console.log('  Key 1:', key1.keyId);
  console.log('  Key 2:', key2.keyId);

  // List all keys
  const keys = encryption.listKeys();
  console.log('\nAll keys:', keys.length);
  for (const key of keys) {
    console.log(`  - ${key.keyId} (${key.algorithm})`);
  }

  // Rotate a key
  const newKey = encryption.rotateKey(key1.keyId);
  console.log('\nRotated key:', key1.keyId, '->', newKey.keyId);

  // Revoke old key
  encryption.revokeKey(key1.keyId);
  console.log('Revoked key:', key1.keyId);

  // Check key info
  const info = encryption.getKeyInfo(newKey.keyId);
  console.log('\nNew key info:', info);

  // Cleanup
  encryption.clearAllKeys();
}

async function hybridEncryption() {
  const encryption = new EncryptionManager();

  // Generate keys for different purposes
  const clientKey = encryption.generateKey({
    algorithm: 'AES-GCM-256',
  });

  const serverKey = encryption.generateKey({
    algorithm: 'AES256',
  });

  console.log('Client-side key:', clientKey.keyId);
  console.log('Server-side key:', serverKey.keyId);

  // Encrypt with client-side encryption
  const data = Buffer.from('Double encrypted data');
  const clientEncrypted = encryption.encrypt(data, {
    type: 'client-side',
    keyId: clientKey.keyId,
  });

  // Server would encrypt again with server-side encryption
  // This would typically be handled by the storage provider

  console.log('\nHybrid encryption complete');
  console.log('  Original size:', data.length);
  console.log('  Encrypted size:', clientEncrypted.data.length);

  // Decrypt
  const decrypted = encryption.decrypt(clientEncrypted.data, {
    type: 'client-side',
    keyId: clientKey.keyId,
    iv: clientEncrypted.encryptionInfo.iv,
    authTag: clientEncrypted.encryptionInfo.authTag,
  });

  console.log('  Decrypted successfully:', decrypted.data.equals(data));

  // Cleanup
  encryption.clearAllKeys();
}

async function runExamples() {
  console.log('=== Basic Encryption ===\n');
  await basicEncryption();

  console.log('\n=== Encryption with Upload ===\n');
  await encryptionWithUpload();

  console.log('\n=== Key Management ===\n');
  await keyManagement();

  console.log('\n=== Hybrid Encryption ===\n');
  await hybridEncryption();
}

runExamples().catch(console.error);
