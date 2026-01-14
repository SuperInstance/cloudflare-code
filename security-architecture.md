# Security Architecture: Hardware-Rooted Trust for ClaudeFlare

## Overview

ClaudeFlare implements defense-in-depth security with hardware-rooted trust as the foundation. Credentials are sealed using platform security primitives (TPM, Secure Enclave, Keystore) and can only be unsealed by authorized devices with biometric authentication.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Hardware Root of Trust](#hardware-root-of-trust)
- [Credential Sealing](#credential-sealing)
- [Platform Implementations](#platform-implementations)
- [Fallback Strategies](#fallback-strategies)
- [Cross-Platform Abstraction](#cross-platform-abstraction)
- [Audit Logging](#audit-logging)
- [Security Best Practices](#security-best-practices)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              HARDWARE ROOT OF TRUST                     │   │
│  │                                                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │   TPM    │  │  Secure  │  │ Keystore │            │   │
│  │  │(Windows) │  │ Enclave  │  │(Android) │            │   │
│  │  │          │  │ (macOS/iOS)│ │          │            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  │       │              │              │                  │   │
│  │       └──────────────┴──────────────┘                  │   │
│  │                      │                                 │   │
│  │                      ▼                                 │   │
│  │              ┌───────────────┐                         │   │
│  │              │ Unified Key   │                         │   │
│  │              │  Management   │                         │   │
│  │              └───────────────┘                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SEALED ENVELOPE PATTERN                    │   │
│  │                                                         │   │
│  │  1. Generate device-specific key pair (hardware)        │   │
│  │  2. Encrypt credentials with device public key          │   │
│  │  3. Store encrypted blob in cloud (D1)                  │   │
│  │  4. Unseal only with hardware key + biometrics          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SECURITY LAYERS                            │   │
│  │                                                         │   │
│  │  Network  │  Application  │  Compute  │  Data          │   │
│  │  DTLS-SRTP│  CSP/Input    │  WASM     │  Encrypted     │   │
│  │  Finger-  │  Validation   │  Sandbox  │  at Rest       │   │
│  │  printing │  Secret Scan  │  Limits   │  Audit Log     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hardware Root of Trust

### Why Hardware-Rooted Security?

- **Non-exportable keys**: Private keys never leave hardware
- **Biometric binding**: Keys require user presence (Face ID, Touch ID, Windows Hello)
- **Anti-extraction**: Hardware prevents key extraction
- **Secure boot**: Chain of trust from firmware

### Platform Security Primitives

| Platform | Hardware | Key Type | Biometric |
|----------|----------|----------|-----------|
| **Windows** | TPM 2.0 | RSA-2048/ECC-P256 | Windows Hello |
| **macOS** | Secure Enclave | ECC-P256 | Touch ID |
| **iOS** | Secure Enclave | ECC-P256 | Face ID/Touch ID |
| **Android** | TEE / Keymaster | RSA-2048/ECC-P256 | BiometricPrompt |

---

## Credential Sealing

### Sealed Envelope Pattern

```
┌────────────────────────────────────────────────────────────┐
│              SEALED CREDENTIAL FLOW                        │
└────────────────────────────────────────────────────────────┘

Device A (Desktop)                    Cloud (D1)
     │                                    │
     │ 1. Generate hardware key           │
     │    (non-exportable)                 │
     │                                    │
     │ 2. Encrypt credential              │
     │    ┌──────────────────────┐        │
     │    │ SealedEnvelope {     │        │
     │    │   credential: AES-256│───────▶│ Store
     │    │   key: device_pubkey │        │
     │    │   device_id: A       │        │
     │    │   sig: device_sign   │        │
     │    │ }                    │        │
     │    └──────────────────────┘        │
     │                                    │
     │ 3. Delete from memory              │
     │                                    │
     │                                    │
Device B (Mobile)                         │
     │                                    │
     │ 4. Fetch sealed envelope           │
     │    ◀──────────────────────────────│
     │                                    │
     │ 5. Verify signature                │
     │                                    │
     │ 6. Request biometric auth          │
     │                                    │
     │ 7. Unseal with hardware key        │
     │    → credential                    │
```

### Envelope Structure

```typescript
// security/sealed-envelope.ts
export interface SealedEnvelope {
  version: 1;
  algorithm: 'RSA-OAEP-256' | 'ECIES-P256';

  // Device identity
  deviceId: string;        // Hardware-bound ID
  devicePublicKey: string; // For verification

  // Sealed credential
  encryptedKey: string;    // AES-256 key encrypted for device
  encryptedCredential: string;
  nonce: string;
  timestamp: number;

  // Integrity
  signature: string;       // Device signature
  signerCert: string;      // Device attestation certificate
}
```

---

## Platform Implementations

### Windows TPM 2.0

```go
// desktop/security/tpm.go
package security

import (
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"fmt"

	"github.com/google/go-tpm/tpm2"
	"github.com/google/go-tpm/tpmutil"
)

type TPMManager struct {
	rwc   tpmutil.TPMCloser
	handle tpm2.Handle
}

func NewTPMManager() (*TPMManager, error) {
	// Open TPM device
	rwc, err := tpm2.OpenTPM()
	if err != nil {
		return nil, fmt.Errorf("failed to open TPM: %w", err)
	}

	// Create or load persistent key
	handle, err := loadOrCreateDeviceKey(rwc)
	if err != nil {
		rwc.Close()
		return nil, err
	}

	return &TPMManager{
		rwc:    rwc,
		handle: handle,
	}, nil
}

// Seal credential to TPM
func (t *TPMManager) Seal(credential []byte) (*SealedEnvelope, error) {
	// Generate AES-256 key for encryption
	aesKey, encryptedCred, err := encryptAES(credential)
	if err != nil {
		return nil, err
	}

	// Get device public key
	pubKey, err := t.getPublicKey()
	if err != nil {
		return nil, err
	}

	// Encrypt AES key with device public key (RSA-OAEP)
	encryptedKey, err := rsa.EncryptOAEP(
		sha256.New(),
		rand.Reader,
		pubKey,
		aesKey,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt key: %w", err)
	}

	// Get device attestation
	cert, err := t.getAttestationCertificate()
	if err != nil {
		return nil, err
	}

	// Sign envelope
	signature, err := t.signEnvelope(envelopeData)
	if err != nil {
		return nil, err
	}

	return &SealedEnvelope{
		Version:             1,
		Algorithm:           "RSA-OAEP-256",
		DeviceID:            t.getDeviceID(),
		DevicePublicKey:     base64.StdEncoding.EncodeToString(x509.MarshalPKCS1PublicKey(pubKey)),
		EncryptedKey:        base64.StdEncoding.EncodeToString(encryptedKey),
		EncryptedCredential: base64.StdEncoding.EncodeToString(encryptedCred),
		Nonce:               base64.StdEncoding.EncodeToString(generateNonce()),
		Timestamp:           time.Now().Unix(),
		Signature:           base64.StdEncoding.EncodeToString(signature),
		SignerCert:          base64.StdEncoding.EncodeToString(cert.Raw),
	}, nil
}

// Unseal credential from TPM
func (t *TPMManager) Unseal(envelope *SealedEnvelope) ([]byte, error) {
	// Verify signature
	if err := t.verifySignature(envelope); err != nil {
		return nil, fmt.Errorf("signature verification failed: %w", err)
	}

	// Request user presence (Windows Hello)
	if err := t.requestUserPresence(); err != nil {
		return nil, fmt.Errorf("user presence required: %w", err)
	}

	// Decrypt AES key using TPM
	encryptedKey, _ := base64.StdEncoding.DecodeString(envelope.EncryptedKey)
	aesKey, err := t.decryptKey(encryptedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt key: %w", err)
	}

	// Decrypt credential
	encryptedCred, _ := base64.StdEncoding.DecodeString(envelope.EncryptedCredential)
	credential, err := decryptAES(aesKey, encryptedCred)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt credential: %w", err)
	}

	return credential, nil
}

func (t *TPMManager) decryptKey(encryptedKey []byte) ([]byte, error) {
	// Use TPM's RSA key for decryption
	// This requires TPM authorization with user presence
	auth := []byte{}

	decrypted, err := tpm2.RSADecrypt(t.rwc, t.handle, encryptedKey, nil, auth)
	if err != nil {
		return nil, err
	}

	return decrypted, nil
}

func (t *TPMManager) requestUserPresence() error {
	// Trigger Windows Hello biometric prompt
	// This is done via Windows Credential Provider API
	return tpm2.CheckUserPresence(t.rwc, t.handle)
}

func (t *TPMManager) signEnvelope(data []byte) ([]byte, error) {
	digest := sha256.Sum256(data)

	// Sign using TPM key (requires user presence)
	signature, err := tpm2.Sign(t.rwc, t.handle, "", digest[:], nil, nil)
	if err != nil {
		return nil, err
	}

	return signature, nil
}

func (t *TPMManager) getDeviceID() string {
	// Use TPM's endorsement key certificate as device ID
	ekCert, _ := tpm2.ReadEKCert(t.rwc)
	if ekCert != nil {
		return fmt.Sprintf("%x", sha256.Sum256(ekCert.Raw))
	}
	// Fallback to TPM properties
	props, _ := tpm2.GetManufacturer(t.rwc)
	return fmt.Sprintf("tpm-%s", props)
}

func loadOrCreateDeviceKey(rwc tpmutil.TPMCloser) (tpm2.Handle, error) {
	// Try to load existing persistent key
	handle, err := tpm2.LoadKeyHandle(rwc, tpm2.TPMRHOwner, "claudeflare-device-key")
	if err == nil {
		return handle, nil
	}

	// Create new SRK (Storage Root Key)
	srkHandle, _, err := tpm2.CreatePrimary(
		rwc,
		tpm2.TPMRHOwner,
		tpm2.PCRSelection{},
		tpm2.Public{
			Type:       tpm2.AlgRSA,
			NameAlg:    tpm2.AlgSHA256,
			Attributes: tpm2.FlagFixedTPM | tpm2.FlagFixedParent | tpm2.FlagUserWithAuth | tpm2.FlagRestricted | tpm2.FlagSign,
			RSAParameters: &tpm2.RSAParams{
				Symmetric: &tpm2.SymScheme{
					Alg:     tpm2.AlgAES,
					KeyBits: 128,
					Mode:    tpm2.AlgCFB,
				},
				KeyBits: 2048,
			},
		},
		nil,
	)
	if err != nil {
		return 0, err
	}

	// Create device key
	keyHandle, _, _, _, _, _, err := tpm2.CreateKey(
		rwc,
		srkHandle,
		tpm2.PCRSelection{},
		"claudeflare-device-key",
		tpm2.Public{
			Type:       tpm2.AlgRSA,
			NameAlg:    tpm2.AlgSHA256,
			Attributes: tpm2.FlagFixedTPM | tpm2.FlagFixedParent | tpm2.FlagUserWithAuth | tpm2.FlagSign | tpm2.FlagDecrypt,
			RSAParameters: &tpm2.RSAParams{
				Symmetric: &tpm2.SymScheme{
					Alg:     tpm2.AlgAES,
					KeyBits: 128,
					Mode:    tpm2.AlgCFB,
				},
				KeyBits: 2048,
			},
		},
		nil,
	)
	if err != nil {
		return 0, err
	}

	// Make persistent
	persistentHandle, err := tpm2.EvictControl(rwc, "", tpm2.TPMRHOwner, keyHandle, "claudeflare-device-key")
	if err != nil {
		return 0, err
	}

	return persistentHandle, nil
}

func (m *TPMManager) Close() error {
	return m.rwc.Close()
}
```

### macOS Secure Enclave

```swift
// desktop/security/SecureEnclaveManager.swift
import Security
import CryptoKit
import LocalAuthentication

class SecureEnclaveManager {
    private let keyTag = "com.claudeflare.device.key"
    private let accessControl: SecAccessControl

    init() {
        // Create access control requiring biometrics
        var error: Unmanaged<CFError>?
        self.accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.biometryCurrentSet, .privateKeyUsage],
            &error
        )!
    }

    // Generate or load Secure Enclave key
    func getOrCreateKey() throws -> SecKey {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrApplicationTag as String: keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecSuccess {
            return (item as! SecKey)
        }

        // Create new key in Secure Enclave
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: keyTag,
                kSecAttrAccessControl as String: accessControl
            ]
        ]

        return SecKeyCreateRandomKey(attributes as CFDictionary, nil)!
    }

    // Seal credential
    func seal(credential: Data) throws -> SealedEnvelope {
        let key = try getOrCreateKey()
        let publicKey = SecKeyCopyPublicKey(key)!

        // Generate AES-256 key
        let aesKey = SymmetricKey(size: .bits256)
        let sealed = try AES.GCM.seal(credential, using: aesKey)

        // Encrypt AES key with Secure Enclave public key (ECIES)
        let aesKeyData = aesKey.withUnsafeBytes { Data($0) }
        var error: Unmanaged<CFError>?
        let encryptedAESKey = SecKeyCreateEncryptedData(
            publicKey,
            .eciesEncryptionStandardX963SHA256AESGCM,
            aesKeyData as CFData,
            &error
        )!

        // Sign envelope
        let envelopeData = serializeEnvelope(
            encryptedKey: encryptedAESKey as Data,
            encryptedCredential: sealed.combined ?? Data(),
            nonce: sealed.nonce.withUnsafeBytes { Data($0) }
        )

        var signError: Unmanaged<CFError>?
        let signature = SecKeyCreateSignature(
            key,
            .ecdsaSignatureDigestX962SHA256,
            envelopeData as CFData,
            &signError
        )!

        // Get attestation certificate
        let cert = try getAttestationCertificate()

        return SealedEnvelope(
            version: 1,
            algorithm: .eciesP256,
            deviceId: getDeviceID(),
            devicePublicKey: exportPublicKey(publicKey),
            encryptedKey: encryptedAESKey as Data,
            encryptedCredential: sealed.combined!,
            nonce: sealed.nonce.withUnsafeBytes { Data($0) },
            timestamp: Date().timeIntervalSince1970,
            signature: signature as Data,
            signerCert: cert
        )
    }

    // Unseal credential
    func unseal(envelope: SealedEnvelope) throws -> Data {
        let key = try getOrCreateKey()

        // Verify signature first
        let envelopeData = serializeEnvelope(
            encryptedKey: envelope.encryptedKey,
            encryptedCredential: envelope.encryptedCredential,
            nonce: envelope.nonce
        )

        let publicKey = SecKeyCreatePublicKeyFromEnclave(
            envelope.devicePublicKey,
            envelope.signerCert
        )!

        var verifyError: Unmanaged<CFError>?
        let valid = SecKeyVerifySignature(
            publicKey,
            .ecdsaSignatureDigestX962SHA256,
            envelopeData as CFData,
            envelope.signature as CFData,
            &verifyError
        )

        guard valid else {
            throw SecurityError.signatureInvalid
        }

        // Request biometric authentication
        let context = LAContext()
        context.localizedReason = "Authenticate to access credentials"
        context.localizedCancelTitle = "Cancel"

        let authorized = try context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Authenticate to access credentials"
        )

        guard authorized else {
            throw SecurityError.authenticationFailed
        }

        // Decrypt AES key using Secure Enclave
        var decryptError: Unmanaged<CFError>?
        let aesKeyData = SecKeyCreateDecryptedData(
            key,
            .eciesEncryptionStandardX963SHA256AESGCM,
            envelope.encryptedKey as CFData,
            &decryptError
        )!

        let aesKey = SymmetricKey(data: aesKeyData)

        // Decrypt credential
        let sealedBox = try AES.GCM.SealedBox(
            nonce: envelope.nonce.withUnsafeBytes { Array($0) },
            ciphertext: envelope.encryptedCredential,
            tag: Data() // Tag is combined in encryptedCredential
        )

        return try AES.GCM.open(sealedBox, using: aesKey)
    }

    private func getDeviceID() -> String {
        // Use Secure Enclave certificate as device ID
        let key = try? getOrCreateKey()
        let cert = SecCertificateCreateWithData(nil, key!)!
        return SHA256.hash(data: cert.data)
            .compactMap { String(format: "%02x", $0) }
            .joined()
    }

    private func exportPublicKey(_ key: SecKey) -> Data {
        var error: Unmanaged<CFError>?
        return SecKeyCopyExternalRepresentation(key, &error)! as Data
    }

    private func getAttestationCertificate() throws -> Data {
        // For macOS, use Keychain certificate
        let query: [String: Any] = [
            kSecClass as String: kSecClassCertificate,
            kSecAttrLabel as String: "claudeflare-attestation",
            kSecReturnData as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecSuccess {
            return item as! Data
        }

        // Generate self-signed certificate for attestation
        let key = try getOrCreateKey()
        // ... certificate generation logic
        throw SecurityError.certificateNotFound
    }
}

enum SecurityError: Error {
    case signatureInvalid
    case authenticationFailed
    case certificateNotFound
}
```

### Android Keystore

```kotlin
// mobile/security/KeystoreManager.kt
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.KeyPermanentlyInvalidatedException
import androidx.biometric.BiometricPrompt
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class KeystoreManager(private val context: Context) {
    private val keyAlias = "claudeflare_device_key"
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    // Get or create hardware-backed key
    private fun getOrCreateKey(): SecretKey {
        val existingKey = keyStore.getEntry(keyAlias, null) as? KeyStore.SecretKeyEntry
        if (existingKey != null) {
            return existingKey.secretKey
        }

        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )

        val spec = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(true)
            .setUserAuthenticationValidityDurationSeconds(30)
            .setInvalidatedByBiometricEnrollment(true)
            .build()

        generator.init(spec)
        return generator.generateKey()
    }

    // Seal credential with biometric prompt
    suspend fun seal(credential: ByteArray): SealedEnvelope {
        val key = getOrCreateKey()

        // Get public key for encryption
        val factory = KeyFactory.getInstance(key.algorithm, "AndroidKeyStore")
        val publicKey = (keyStore.getCertificate(keyAlias) as? X509Certificate)?.publicKey
            ?: throw SecurityException("No certificate found")

        // Generate AES-256 key
        val aesKey = generateAESKey()

        // Encrypt credential with AES
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, aesKey)
        val iv = cipher.iv
        val encryptedCredential = cipher.doFinal(credential)

        // Encrypt AES key with device public key (RSA)
        val rsaCipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding")
        rsaCipher.init(Cipher.ENCRYPT_MODE, publicKey)
        val encryptedAESKey = rsaCipher.doFinal(aesKey.encoded)

        // Sign envelope
        val signature = signEnvelope(encryptedAESKey, encryptedCredential, iv)

        // Get attestation
        val cert = keyStore.getCertificate(keyAlias) as X509Certificate

        return SealedEnvelope(
            version = 1,
            algorithm = "RSA-OAEP-256",
            deviceId = getDeviceId(),
            devicePublicKey = publicKey.encoded,
            encryptedKey = encryptedAESKey,
            encryptedCredential = encryptedCredential,
            nonce = iv,
            timestamp = System.currentTimeMillis() / 1000,
            signature = signature,
            signerCert = cert.encoded
        )
    }

    // Unseal credential with biometric authentication
    suspend fun unseal(envelope: SealedEnvelope): ByteArray {
        // Verify signature
        if (!verifySignature(envelope)) {
            throw SecurityException("Invalid signature")
        }

        // Show biometric prompt
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Authenticate to access credentials")
            .setSubtitle("Biometric authentication required")
            .setNegativeButtonText("Cancel")
            .build()

        return suspendCancellableCoroutine { continuation ->
            val biometricPrompt = BiometricPrompt(
                context as FragmentActivity,
                ContextCompat.getMainExecutor(context),
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        try {
                            val credential = unsealWithKey(envelope)
                            continuation.resume(credential)
                        } catch (e: Exception) {
                            continuation.resumeWithException(e)
                        }
                    }

                    override fun onAuthenticationFailed() {
                        continuation.resumeWithException(SecurityException("Biometric authentication failed"))
                    }

                    override fun onError(error: CharSequence, code: Int) {
                        continuation.resumeWithException(SecurityException(error.toString()))
                    }
                }
            )

            biometricPrompt.authenticate(promptInfo)
        }
    }

    private fun unsealWithKey(envelope: SealedEnvelope): ByteArray {
        try {
            val key = getOrCreateKey()

            // Decrypt AES key using hardware-backed key
            val rsaCipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding")
            rsaCipher.init(Cipher.DECRYPT_MODE, key)
            val aesKeyBytes = rsaCipher.doFinal(envelope.encryptedKey)
            val aesKey = SecretKeySpec(aesKeyBytes, "AES")

            // Decrypt credential
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, aesKey, GCMParameterSpec(128, envelope.nonce))
            return cipher.doFinal(envelope.encryptedCredential)

        } catch (e: KeyPermanentlyInvalidatedException) {
            throw SecurityException("Key invalidated by biometric enrollment change")
        }
    }

    private fun getDeviceId(): String {
        val cert = keyStore.getCertificate(keyAlias) as X509Certificate
        val md = MessageDigest.getInstance("SHA-256")
        return md.digest(cert.encoded).joinToString("") { "%02x".format(it) }
    }

    private fun signEnvelope(vararg parts: ByteArray): ByteArray {
        // Use Android Keystore for signing
        val signature = Signature.getInstance("SHA256withECDSA")
        val key = keyStore.getKey(keyAlias, null) as PrivateKey
        signature.initSign(key)
        parts.forEach { signature.update(it) }
        return signature.sign()
    }

    private fun verifySignature(envelope: SealedEnvelope): Boolean {
        val publicKey = keyStore.getCertificate(keyAlias).publicKey
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initVerify(publicKey)
        signature.update(envelope.encryptedKey)
        signature.update(envelope.encryptedCredential)
        signature.update(envelope.nonce)
        return signature.verify(envelope.signature)
    }
}
```

---

## Fallback Strategies

### Software Key Fallback

When hardware security is unavailable, use encrypted software keys with additional protection.

```typescript
// security/software-fallback.ts
export class SoftwareKeyManager {
  private masterKey: Uint8Array;
  private keyDerivationSalt: Uint8Array;

  constructor() {
    // Derive master key from device-specific secrets
    this.masterKey = this.deriveMasterKey();
    this.keyDerivationSalt = crypto.getRandomValues(new Uint8Array(32));
  }

  private deriveMasterKey(): Uint8Array {
    // Combine multiple device-specific factors
    const factors = [];

    // 1. Hardware identifier (CPU ID, etc.)
    factors.push(this.getHardwareId());

    // 2. Installation-specific random seed
    factors.push(this.getInstallationSeed());

    // 3. User-provided passphrase (if available)
    factors.push(this.getUserPassphrase() || '');

    // Derive key using PBKDF2
    return crypto.pbkdf2Sync(
      factors.join('|'),
      this.keyDerivationSalt,
      100000,  // iterations
      32,      // key length
      'sha256'
    );
  }

  async seal(credential: string): Promise<SealedEnvelope> {
    // Generate AES key
    const aesKey = crypto.getRandomValues(new Uint8Array(32));

    // Encrypt credential
    const encrypted = await this.encryptAES(credential, aesKey);

    // Encrypt AES key with master key
    const encryptedAESKey = await this.encryptAES(
      aesKey.toString(),
      this.masterKey
    );

    return {
      version: 1,
      algorithm: 'AES-256-GCM',
      deviceId: this.getHardwareId(),
      devicePublicKey: '', // No public key for software fallback
      encryptedKey: encryptedAESKey,
      encryptedCredential: encrypted,
      nonce: crypto.getRandomValues(new Uint8Array(12)),
      timestamp: Date.now() / 1000,
      signature: '', // No signature for software fallback
      signerCert: '',
      isSoftwareFallback: true,
    };
  }

  async unseal(envelope: SealedEnvelope): Promise<string> {
    // Decrypt AES key
    const aesKeyBytes = await this.decryptAES(
      envelope.encryptedKey,
      this.masterKey
    );

    // Decrypt credential
    return await this.decryptAES(
      envelope.encryptedCredential,
      new Uint8Array(aesKeyBytes)
    );
  }
}
```

---

## Cross-Platform Abstraction

### Unified Security Interface

```typescript
// security/unified.ts
export interface SecurityManager {
  // Initialize hardware security
  initialize(): Promise<void>;

  // Check if hardware security is available
  isHardwareBacked(): Promise<boolean>;

  // Seal credential to device
  seal(credential: string): Promise<SealedEnvelope>;

  // Unseal credential from device
  unseal(envelope: SealedEnvelope): Promise<string>;

  // Get device attestation
  getAttestation(): Promise<Attestation>;

  // Destroy all keys
  destroy(): Promise<void>;
}

// Platform factory
export async function createSecurityManager(): Promise<SecurityManager> {
  const platform = detectPlatform();

  switch (platform) {
    case 'windows':
      return new WindowsTPMManager();
    case 'macos':
      return new MacOSSecureEnclaveManager();
    case 'ios':
      return new iOSSecureEnclaveManager();
    case 'android':
      return new AndroidKeystoreManager();
    default:
      // Fallback to software keys
      return new SoftwareKeyManager();
  }
}

function detectPlatform(): string {
  if (typeof window !== 'undefined') {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Win')) return 'windows';
    if (userAgent.includes('Mac')) return 'macos';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'ios';
    if (userAgent.includes('Android')) return 'android';
  }

  // Desktop environment (Go)
  if (typeof process !== 'undefined' && process.platform) {
    switch (process.platform) {
      case 'win32': return 'windows';
      case 'darwin': return 'macos';
      case 'linux': return 'linux';
    }
  }

  return 'unknown';
}
```

---

## Audit Logging

### Immutable Security Events

```typescript
// security/audit-log.ts
export class SecurityAuditLog {
  private d1: D1Database;

  async logEvent(event: SecurityEvent): Promise<void> {
    await this.d1.prepare(`
      INSERT INTO security_events (
        id, type, device_id, user_id,
        timestamp, ip_address, user_agent,
        details, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      event.type,
      event.deviceId,
      event.userId,
      Date.now(),
      event.ipAddress,
      event.userAgent,
      JSON.stringify(event.details),
      this.signEvent(event)
    ).run();
  }

  async queryEvents(filter: EventFilter): Promise<SecurityEvent[]> {
    const query = this.buildQuery(filter);
    const results = await this.d1.prepare(query).all();

    return results.map(row => ({
      id: row.id as string,
      type: row.type as string,
      deviceId: row.device_id as string,
      userId: row.user_id as string,
      timestamp: row.timestamp as number,
      ipAddress: row.ip_address as string,
      userAgent: row.user_agent as string,
      details: JSON.parse(row.details as string),
      signature: row.signature as string,
    }));
  }

  private signEvent(event: SecurityEvent): string {
    const data = JSON.stringify(event);
    const signature = crypto.subtle.sign(
      'SHA-256',
      this.signingKey,
      new TextEncoder().encode(data)
    );
    return Buffer.from(signature).toString('base64');
  }
}
```

### Event Types

```typescript
export enum SecurityEventType {
  // Credential lifecycle
  CREDENTIAL_CREATED = 'credential.created',
  CREDENTIAL_ACCESSED = 'credential.accessed',
  CREDENTIAL_UPDATED = 'credential.updated',
  CREDENTIAL_DELETED = 'credential.deleted',

  // Authentication
  BIOMETRIC_AUTH_SUCCESS = 'auth.biometric.success',
  BIOMETRIC_AUTH_FAILED = 'auth.biometric.failed',
  BIOMETRIC_AUTH_CANCELLED = 'auth.biometric.cancelled',

  // Key operations
  KEY_GENERATED = 'key.generated',
  KEY_EXPORTED = 'key.exported',
  KEY_DESTROYED = 'key.destroyed',

  // Security violations
  SIGNATURE_INVALID = 'security.signature.invalid',
  TAMPER_DETECTED = 'security.tamper.detected',
  UNAUTHORIZED_ACCESS = 'security.unauthorized',
}
```

---

## Security Best Practices

### Credential Storage

```typescript
// D1 schema for credential metadata
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,

  -- Sealed envelope
  envelope TEXT NOT NULL,  -- JSON blob

  -- Metadata
  created_at INTEGER NOT NULL,
  accessed_at INTEGER,
  expires_at INTEGER,

  -- Security
  is_hardware_backed INTEGER NOT NULL,
  security_level TEXT NOT NULL,  -- 'high', 'medium', 'low'

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_credentials_user ON credentials(user_id);
CREATE INDEX idx_credentials_device ON credentials(device_id);
```

### Key Rotation

```typescript
// security/rotation.ts
export class KeyRotationManager {
  async rotateKeys(): Promise<void> {
    // 1. Generate new key pair
    const newKey = await this.securityManager.generateKey();

    // 2. Re-seal all credentials with new key
    const credentials = await this.getAllCredentials();

    for (const cred of credentials) {
      const unsealed = await this.securityManager.unseal(cred.envelope);
      const newEnvelope = await this.securityManager.seal(unsealed);

      await this.updateCredential(cred.id, newEnvelope);
    }

    // 3. Destroy old key
    await this.securityManager.destroy();

    // 4. Log rotation event
    await this.auditLog.logEvent({
      type: SecurityEventType.KEY_ROTATED,
      timestamp: Date.now(),
      details: { credentialCount: credentials.length },
    });
  }
}
```

---

## Summary

The security architecture provides:

| Feature | Implementation |
|---------|----------------|
| **Hardware Root** | TPM 2.0 (Windows), Secure Enclave (macOS/iOS), Keystore (Android) |
| **Credential Sealing** | RSA-OAEP / ECIES with hardware-backed keys |
| **Biometric Auth** | Required for unsealing operations |
| **Fallback** | Software keys with device-derived secrets |
| **Audit Logging** | Immutable logs in D1 with signatures |
| **Cross-Platform** | Unified interface across all platforms |

**Key Benefits:**
- Private keys never leave hardware
- Biometric binding prevents unauthorized access
- Cross-platform support with unified API
- Graceful fallback for unsupported hardware
- Complete audit trail for compliance

---

## References

- [TPM 2.0 Specification](https://trustedcomputinggroup.org/resource/tpm-library-specification/)
- [Apple Secure Enclave](https://developer.apple.com/documentation/security/certificate_key_and_trust_services/keys/protecting_keys_with_the_secure_enclave)
- [Android Keystore](https://developer.android.com/training/articles/keystore)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
