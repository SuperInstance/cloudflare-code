# Mobile Architecture: React Native for ClaudeFlare

## Overview

The ClaudeFlare mobile app enables AI coding assistance on the go, connecting to local desktop compute nodes via WebRTC or falling back to Cloudflare edge. Built with React Native 0.76+ with the New Architecture (Fabric & TurboModules) for optimal performance.

## Table of Contents

- [Architecture](#architecture)
- [React Native 0.76 New Architecture](#react-native-076-new-architecture)
- [Project Structure](#project-structure)
- [Go Mobile (gomobile) Bindings](#go-mobile-gomobile-bindings)
- [WebRTC Integration](#webrtc-integration)
- [QR Code Pairing](#qr-code-pairing)
- [UI Components](#ui-components)
- [Code Display](#code-display)
- [Credential Management](#credential-management)
- [Push Notifications](#push-notifications)
- [Offline Support](#offline-support)
- [Build & Deploy](#build--deploy)
- [Dependencies](#dependencies)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Native 0.76+ App                       │
│                    (New Architecture Enabled)                   │
├─────────────────────────────────────────────────────────────────┤
│  Fabric Renderer (Native UI Components)                         │
│    ├── Faster rendering with direct native manipulation         │
│    └── Synchronous JSI execution                                │
│                                                                  │
│  TurboModules (Native Modules)                                  │
│    ├── WebRTCModule (react-native-webrtc)                       │
│    ├── CameraModule (react-native-vision-camera)                │
│    └── SecureStoreModule (expo-secure-store)                   │
│                                                                  │
│  Navigation (React Navigation 6+)                               │
│    ├── Stack Navigator                                          │
│    ├── Tab Navigator                                            │
│    └── Modal Navigator                                          │
│                                                                  │
│  State Management (Zustand)                                     │
│    ├── Auth Store                                               │
│    ├── Project Store                                            │
│    └── Connection Store                                         │
│                                                                  │
│  Services Layer                                                  │
│    ├── WebRTC Service (P2P to desktop via gomobile)             │
│    ├── Cloudflare API (fallback)                                │
│    ├── GitHub API (repository sync)                             │
│    └── Credential Service (Keychain/Keystore)                   │
│                                                                  │
│  UI Components                                                   │
│    ├── Chat Interface (streaming AI responses)                  │
│    ├── Code Editor (Monaco in WebView)                          │
│    ├── Diff Viewer (react-native-diff-view)                     │
│    ├── File Browser                                             │
│    └── QR Scanner (vision-camera-code-scanner)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## React Native 0.76 New Architecture

### Overview

React Native 0.76 enables the **New Architecture by default**, bringing significant performance improvements:

- **Fabric**: New rendering system with direct native manipulation
- **TurboModules**: Lazy-loading native modules with JSI
- **CodeGen**: Type-safe bindings between JS and native
- **JSI**: Synchronous JavaScript interface (replaces async bridge)

### Key Benefits

| Feature | Old Architecture | New Architecture |
|---------|-----------------|------------------|
| Communication | Async Bridge | Synchronous JSI |
| Rendering | Shadow tree | Fabric (direct native) |
| Module Loading | Eager at startup | Lazy (TurboModules) |
| Type Safety | Limited | CodeGen-generated |
| Performance | Bridge overhead | Near-native speed |

### TypeScript Configuration (Strict Mode)

```json
// mobile/tsconfig.json
{
  "extends": "@react-native/typescript-config/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

## Project Structure

### Feature-Based Organization (2025 Best Practices)

```
mobile/
├── src/
│   ├── app/                  # App entry point with providers
│   │   ├── App.tsx           # Root component
│   │   └── providers.tsx     # Context providers
│   │
│   ├── features/             # Feature-based modules
│   │   ├── auth/             # Authentication & pairing
│   │   │   ├── screens/
│   │   │   │   ├── LoginScreen.tsx
│   │   │   │   └── PairingScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── QRScanner.tsx
│   │   │   │   └── PairCodeInput.tsx
│   │   │   ├── hooks/
│   │   │   │   └── usePairing.ts
│   │   │   ├── services/
│   │   │   │   └── pairingService.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── chat/             # AI chat interface
│   │   │   ├── screens/
│   │   │   │   └── ChatScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MessageInput.tsx
│   │   │   │   ├── StreamingMessage.tsx
│   │   │   │   └── TypingIndicator.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useChat.ts
│   │   │   │   └── useStreamingResponse.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── editor/           # Code editor & diff viewer
│   │   │   ├── screens/
│   │   │   │   └── EditorScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── CodeEditor.tsx      # Monaco in WebView
│   │   │   │   ├── DiffViewer.tsx      # react-native-diff-view
│   │   │   │   └── SyntaxHighlight.tsx
│   │   │   └── hooks/
│   │   │       └── useEditor.ts
│   │   │
│   │   ├── projects/         # Project management
│   │   │   ├── screens/
│   │   │   │   └── ProjectListScreen.tsx
│   │   │   ├── components/
│   │   │   │   └── ProjectCard.tsx
│   │   │   └── hooks/
│   │   │       └── useProjects.ts
│   │   │
│   │   └── settings/         # Settings & preferences
│   │       ├── screens/
│   │       │   └── SettingsScreen.tsx
│   │       └── components/
│   │           └── SettingItem.tsx
│   │
│   ├── shared/               # Shared utilities
│   │   ├── navigation/       # React Navigation config
│   │   │   ├── AppNavigator.tsx
│   │   │   ├── RootNavigator.tsx
│   │   │   └── linking.ts
│   │   │
│   │   ├── stores/           # Zustand state management
│   │   │   ├── authStore.ts
│   │   │   ├── projectStore.ts
│   │   │   └── connectionStore.ts
│   │   │
│   │   ├── services/         # Business logic
│   │   │   ├── webrtc/
│   │   │   │   ├── PeerConnectionManager.ts
│   │   │   │   ├── DataChannelManager.ts
│   │   │   │   └── SignalingService.ts
│   │   │   ├── api/
│   │   │   │   ├── CloudflareAPI.ts
│   │   │   │   └── GitHubAPI.ts
│   │   │   ├── credentials/
│   │   │   │   └── SecureStorage.ts
│   │   │   └── notifications/
│   │   │       └── PushNotificationService.ts
│   │   │
│   │   ├── components/       # Shared UI components
│   │   │   ├── common/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Loading.tsx
│   │   │   │   └── ErrorBoundary.tsx
│   │   │   └── filebrowser/
│   │   │       ├── FileTree.tsx
│   │   │       └── FileViewer.tsx
│   │   │
│   │   ├── hooks/            # Custom hooks
│   │   │   ├── useWebRTC.ts
│   │   │   ├── useOffline.ts
│   │   │   ├── useBiometrics.ts
│   │   │   └── useDebounce.ts
│   │   │
│   │   ├── utils/            # Utilities
│   │   │   ├── logger.ts
│   │   │   ├── queue.ts
│   │   │   └── validators.ts
│   │   │
│   │   └── types/            # Shared TypeScript types
│   │       ├── agent.ts
│   │       ├── webrtc.ts
│   │       └── api.ts
│   │
│   └── assets/               # Images, fonts
│       ├── images/
│       ├── fonts/
│       └── icons/
│
├── android/                  # Android native code
│   ├── app/
│   └── build.gradle
├── ios/                      # iOS native code
│   ├── ClaudeFlare/
│   └── Podfile
├── gomobile/                 # Go mobile bindings
│   ├── ios/                  # Generated .framework
│   └── android/              # Generated .aar
├── assets/                   # Root assets
├── eas.json                  # Expo Application Services
├── app.json                  # App config
├── tsconfig.json
├── package.json
├── babel.config.js
└── README.md
```

---

## Go Mobile (gomobile) Bindings

### Overview

gomobile enables building **iOS frameworks** (.framework) and **Android AARs** (.aar) from Go code, allowing direct integration of Go's WebRTC, crypto, and networking capabilities into React Native.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Go Package                           │
│                   claudeflare/mobile                     │
│  ├── webrtc/          # Pion WebRTC implementation       │
│  ├── signaling/       # WebSocket signaling client       │
│  ├── crypto/          # Encryption & signing             │
│  └── proxy/           # Desktop proxy protocol           │
└────────────────────┬─────────────────────────────────────┘
                     │ gomobile bind
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  iOS Framework  │    │  Android AAR    │
│  ClaudeFlare.framework   │   claudeflare.aar  │
└────────┬────────┘    └────────┬────────┘
         │                       │
         │ TurboModule           │ TurboModule
         ▼                       ▼
┌──────────────────────────────────────────┐
│         React Native App                  │
│  ───► import { ClaudeFlare }             │
│        from 'react-native-claudeflare'   │
└──────────────────────────────────────────┘
```

### Go Package Structure

```go
// mobile/cmd/gomobile/main.go
package main

// ClaudeFlareMobile exposes mobile APIs via gomobile
type ClaudeFlareMobile struct {
    webrtcManager *WebRTCManager
    signaling     *SignalingClient
}

// NewClaudeFlareMobile creates a new mobile instance
func NewClaudeFlareMobile() *ClaudeFlareMobile {
    return &ClaudeFlareMobile{
        webrtcManager: NewWebRTCManager(),
        signaling:     NewSignalingClient(),
    }
}

// ConnectToDesktop establishes WebRTC connection to desktop
func (m *ClaudeFlareMobile) ConnectToDesktop(pairCode string) error {
    // Fetch offer from signaling server
    offer, err := m.signaling.GetOffer(pairCode)
    if err != nil {
        return err
    }

    // Create peer connection
    pc, err := m.webrtcManager.CreatePeerConnection(offer)
    if err != nil {
        return err
    }

    // Create and send answer
    answer := pc.CreateAnswer()
    return m.signaling.SendAnswer(pairCode, answer)
}

// SendComputeRequest sends JSON-RPC request over data channel
func (m *ClaudeFlareMobile) SendComputeRequest(method string, params string) (string, error) {
    return m.webrtcManager.SendRequest(method, params)
}

// GetConnectionStatus returns current connection state
func (m *ClaudeFlareMobile) GetConnectionStatus() string {
    return m.webrtcManager.GetState()
}
```

### Building with gomobile

```bash
#!/bin/bash
# scripts/build-gomobile.sh

set -e

echo "Building gomobile bindings..."

# Initialize gomobile (first time only)
# gomobile init

# Build iOS framework
echo "Building iOS framework..."
gomobile bind -target=ios \
    -o mobile/gomobile/ios/ClaudeFlare.framework \
    -tags=ios \
    claudeflare/mobile/cmd/gomobile

# Build Android AAR
echo "Building Android AAR..."
gomobile bind -target=android \
    -o mobile/gomobile/android/claudeflare.aar \
    -tags=android \
    claudeflare/mobile/cmd/gomobile

echo "gomobile bindings built successfully!"
echo "iOS: mobile/gomobile/ios/ClaudeFlare.framework"
echo "Android: mobile/gomobile/android/claudeflare.aar"
```

### React Native TurboModule Wrapper

```typescript
// mobile/src/native/ClaudeFlareNative.ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
    connectToDesktop(pairCode: string): Promise<boolean>;
    sendComputeRequest(method: string, params: string): Promise<string>;
    getConnectionStatus(): Promise<string>;
    disconnect(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ClaudeFlareNative');
```

```typescript
// mobile/src/shared/services/webrtc/GomobileService.ts
import ClaudeFlareNative from '../../../native/ClaudeFlareNative';
import { NativeEventEmitter } from 'react-native';

export class GomobileWebRTCService {
    private emitter = new NativeEventEmitter(ClaudeFlareNative);

    async connectToDesktop(pairCode: string): Promise<boolean> {
        try {
            return await ClaudeFlareNative.connectToDesktop(pairCode);
        } catch (error) {
            console.error('Failed to connect:', error);
            throw error;
        }
    }

    async sendComputeRequest(method: string, params: any): Promise<any> {
        const response = await ClaudeFlareNative.sendComputeRequest(
            method,
            JSON.stringify(params)
        );
        return JSON.parse(response);
    }

    getConnectionStatus(): Promise<string> {
        return ClaudeFlareNative.getConnectionStatus();
    }

    async disconnect(): Promise<void> {
        await ClaudeFlareNative.disconnect();
    }
}
```

### Integration in React Native

```typescript
// mobile/src/features/auth/hooks/usePairing.ts
import { useState } from 'react';
import { GomobileWebRTCService } from '../../../shared/services/webrtc/GomobileService';

const webrtcService = new GomobileWebRTCService();

export function usePairing() {
    const [pairingStatus, setPairingStatus] = useState<'idle' | 'pairing' | 'connected' | 'failed'>('idle');
    const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');

    const pairWithDesktop = async (pairCode: string) => {
        setPairingStatus('pairing');
        try {
            const success = await webrtcService.connectToDesktop(pairCode);
            if (success) {
                setPairingStatus('connected');
                const status = await webrtcService.getConnectionStatus();
                setConnectionStatus(status);
            } else {
                setPairingStatus('failed');
            }
        } catch (error) {
            console.error('Pairing failed:', error);
            setPairingStatus('failed');
        }
    };

    return {
        pairingStatus,
        connectionStatus,
        pairWithDesktop,
        disconnect: () => webrtcService.disconnect()
    };
}
```

---

## QR Code Pairing

### Overview

Pair mobile devices with desktop compute nodes using QR code scanning. The modern approach uses **react-native-vision-camera** with the **vision-camera-code-scanner** plugin for 2025.

### Architecture

```
┌──────────────────────┐          ┌──────────────────────┐
│   Mobile Device      │          │   Desktop Node       │
│                      │          │                      │
│  1. Generate Pair    │  ──────▶  │  2. Display QR      │
│     Code (6-digit)   │          │     Code             │
│                      │          │                      │
│  3. Scan QR Code     │  ──────▶  │  4. Register with   │
│                      │          │     Signaling DO     │
│                      │          │                      │
│  5. WebRTC Connect   │  ◀─────  │  6. WebRTC Offer    │
└──────────────────────┘          └──────────────────────┘
```

### Installation

```bash
npm install react-native-vision-camera
npm install vision-camera-code-scanner
```

### iOS Configuration

```xml
<!-- mobile/ios/ClaudeFlare/Info.plist -->
<key>NSCameraUsageDescription</key>
<string>Allow camera access to scan QR codes for desktop pairing</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Allow access to photo library for QR code scanning</string>
```

### Android Configuration

```xml
<!-- mobile/android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" />
<uses-feature android:name="android.hardware.camera.autofocus" />
```

### QR Scanner Component

```typescript
// mobile/src/features/auth/components/QRScanner.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useCodeScanner } from 'vision-camera-code-scanner';

interface QRScannerProps {
    onCodeDetected: (code: string) => void;
    onClose: () => void;
}

export default function QRScanner({ onCodeDetected, onClose }: QRScannerProps) {
    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();
    const [isActive, setIsActive] = useState(true);

    const codeScanner = useCodeScanner({
        codeTypes: ['qr', 'ean-13'],
        onCodeScanned: (codes) => {
            if (codes.length > 0) {
                const code = codes[0].value;
                setIsActive(false);
                onCodeDetected(code);
            }
        },
    });

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>Camera permission required</Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!device) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>No camera device available</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Camera
                style={styles.camera}
                device={device}
                isActive={isActive}
                codeScanner={codeScanner}
                enableZoomGesture
            />

            <View style={styles.overlay}>
                <View style={styles.scanArea}>
                    <View style={styles.corner} />
                    <View style={[styles.corner, { alignSelf: 'flex-end' }]} />
                    <View style={[styles.corner, { alignSelf: 'flex-end' }]} />
                    <View style={[styles.corner, { alignSelf: 'flex-end' }]} />
                </View>

                <Text style={styles.instruction}>
                    Align QR code within the frame
                </Text>

                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeButtonText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanArea: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 12,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        flexDirection: 'row',
    },
    corner: {
        width: 20,
        height: 20,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderColor: '#fff',
        margin: 10,
    },
    instruction: {
        color: '#fff',
        fontSize: 16,
        marginTop: 20,
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    message: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 16,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    closeButton: {
        position: 'absolute',
        bottom: 50,
        backgroundColor: 'rgba(255, 59, 48, 0.9)',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
```

### Pairing Screen

```typescript
// mobile/src/features/auth/screens/PairingScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import QRScanner from '../components/QRScanner';
import { usePairing } from '../hooks/usePairing';

export default function PairingScreen() {
    const { pairWithDesktop, pairingStatus } = usePairing();
    const [showScanner, setShowScanner] = useState(false);
    const [manualCode, setManualCode] = useState('');

    const handleQRCodeScanned = async (code: string) => {
        try {
            // Parse QR code data
            const data = JSON.parse(code);
            if (data.type === 'claudeflare-pair' && data.pairCode) {
                await pairWithDesktop(data.pairCode);
            } else {
                Alert.alert('Invalid QR Code', 'This is not a ClaudeFlare pairing code');
            }
        } catch (error) {
            Alert.alert('Scan Error', 'Failed to process QR code');
        }
    };

    const handleManualPair = async () => {
        if (manualCode.length === 6) {
            await pairWithDesktop(manualCode);
        } else {
            Alert.alert('Invalid Code', 'Please enter a 6-digit pairing code');
        }
    };

    if (showScanner) {
        return <QRScanner onCodeDetected={handleQRCodeScanned} onClose={() => setShowScanner(false)} />;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Pair with Desktop</Text>
            <Text style={styles.subtitle}>
                Scan the QR code on your desktop or enter the 6-digit code
            </Text>

            <TouchableOpacity style={styles.scanButton} onPress={() => setShowScanner(true)}>
                <Text style={styles.scanButtonText}>📷 Scan QR Code</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
            </View>

            <TextInput
                style={styles.input}
                placeholder="Enter 6-digit code"
                value={manualCode}
                onChangeText={setManualCode}
                maxLength={6}
                keyboardType="number-pad"
                autoFocus
            />

            <TouchableOpacity
                style={[styles.pairButton, manualCode.length !== 6 && styles.pairButtonDisabled]}
                onPress={handleManualPair}
                disabled={manualCode.length !== 6 || pairingStatus === 'pairing'}
            >
                <Text style={styles.pairButtonText}>
                    {pairingStatus === 'pairing' ? 'Pairing...' : 'Pair'}
                </Text>
            </TouchableOpacity>

            {pairingStatus === 'connected' && (
                <Text style={styles.successText}>✓ Successfully paired!</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        color: '#666',
        marginBottom: 32,
    },
    scanButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24,
    },
    scanButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#ccc',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#999',
        fontWeight: '600',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 16,
        fontSize: 24,
        letterSpacing: 8,
        textAlign: 'center',
        marginBottom: 24,
    },
    pairButton: {
        backgroundColor: '#34C759',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    pairButtonDisabled: {
        backgroundColor: '#ccc',
    },
    pairButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    successText: {
        color: '#34C759',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        fontWeight: '600',
    },
});
```

### Desktop QR Code Generation

```go
// desktop/pairing/qr_generator.go
package pairing

import (
    "encoding/json"
    "github.com/skip2/go-qrcode"
)

type PairingData struct {
    Type     string `json:"type"`
    PairCode string `json:"pairCode"`
    Host     string `json:"host"`
    Port     int    `json:"port"`
}

func GenerateQRCode(pairCode, host string, port int) ([]byte, error) {
    data := PairingData{
        Type:     "claudeflare-pair",
        PairCode: pairCode,
        Host:     host,
        Port:     port,
    }

    jsonData, err := json.Marshal(data)
    if err != nil {
        return nil, err
    }

    // Generate 256x256 QR code
    qrCode, err := qrcode.Encode(string(jsonData), qrcode.Medium, 256)
    if err != nil {
        return nil, err
    }

    return qrCode, nil
}
```

---

## WebRTC Integration

### react-native-webrtc Setup

```typescript
// mobile/src/services/webrtc/PeerConnectionManager.ts
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCDataChannel,
  mediaDevices,
} from 'react-native-webrtc';

export class MobilePeerConnectionManager {
  private pc: RTCPeerConnection | null = null;
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private localStream: MediaStream | null = null;

  async connectToDesktop(pairCode: string): Promise<void> {
    try {
      // 1. Fetch signaling config from Cloudflare DO
      const signalingUrl = `https://signaling.claudeflare.workers.dev/pair/${pairCode}`;
      const response = await fetch(signalingUrl);
      const config = await response.json();

      // 2. Create peer connection with ICE config
      this.pc = new RTCPeerConnection(config.iceConfig);

      // 3. Set up ICE candidate handling
      this.pc.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          this.sendICECandidate(event.candidate, pairCode);
        }
      });

      // 4. Handle incoming data channels from desktop
      this.pc.addEventListener('datachannel', (event) => {
        const dc = event.channel;
        this.dataChannels.set(dc.label, dc);
        this.setupDataChannel(dc);
      });

      // 5. Set remote description (offer from desktop)
      await this.pc.setRemoteDescription(
        new RTCSessionDescription(config.offer)
      );

      // 6. Create answer
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      // 7. Send answer via signaling
      await this.sendAnswer(answer, pairCode);

      // 8. Listen for ICE candidates from desktop
      this.pollForCandidates(pairCode);

    } catch (error) {
      console.error('WebRTC connection failed:', error);
      throw error;
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.addEventListener('open', () => {
      console.log(`Data channel ${dc.label} open`);

      // Send initial status
      this.sendJSONRPC(dc, {
        jsonrpc: '2.0',
        method: 'control.hello',
        params: {
          platform: Platform.OS,
          version: appVersion
        }
      });
    });

    dc.addEventListener('message', (event) => {
      this.handleDataChannelMessage(dc, event.data);
    });

    dc.addEventListener('close', () => {
      console.log(`Data channel ${dc.label} closed`);
      this.dataChannels.delete(dc.label);
    });
  }

  private handleDataChannelMessage(dc: RTCDataChannel, data: string) {
    try {
      const message = JSON.parse(data);

      // Handle JSON-RPC requests
      if (message.jsonrpc === '2.0') {
        this.handleJSONRPC(dc, message);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private async handleJSONRPC(dc: RTCDataChannel, request: any) {
    const { method, params, id } = request;

    switch (method) {
      case 'compute.response':
        // Display generated code
        this.displayCode(params.code, params.language);
        if (id) {
          this.sendJSONRPC(dc, {
            jsonrpc: '2.0',
            id,
            result: { received: true }
          });
        }
        break;

      case 'control.status':
        // Update connection status
        updateConnectionStatus(params);
        break;
    }
  }

  sendJSONRPC(dc: RTCDataChannel, message: any) {
    if (dc.readyState === 'open') {
      dc.send(JSON.stringify(message));
    }
  }

  async sendICECandidate(candidate: RTCIceCandidate, pairCode: string) {
    await fetch(`https://signaling.claudeflare.workers.dev/pair/${pairCode}/ice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate: candidate.toJSON(),
        type: 'mobile'
      })
    });
  }

  async sendAnswer(answer: RTCSessionDescription, pairCode: string) {
    await fetch(`https://signaling.claudeflare.workers.dev/pair/${pairCode}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer: answer.toJSON(),
        type: 'mobile'
      })
    });
  }

  private async pollForCandidates(pairCode: string) {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `https://signaling.claudeflare.workers.dev/pair/${pairCode}/ice/poll`
        );
        const candidates = await response.json();

        for (const candidate of candidates) {
          await this.pc!.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('Failed to poll for ICE candidates:', error);
      }
    }, 1000);

    // Stop polling after connection is established
    this.pc!.addEventListener('connectionstatechange', () => {
      if (this.pc!.connectionState === 'connected') {
        clearInterval(pollInterval);
      }
    });
  }

  disconnect() {
    // Close all data channels
    for (const dc of this.dataChannels.values()) {
      dc.close();
    }
    this.dataChannels.clear();

    // Close peer connection
    this.pc?.close();
    this.pc = null;
  }
}
```

---

## UI Components

### Chat Interface

```typescript
// mobile/src/components/chat/MessageList.tsx
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MessageBubble from './MessageBubble';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: any;
}

interface MessageListProps {
  messages: Message[];
  onMessagePress?: (message: Message) => void;
}

export default function MessageList({ messages, onMessagePress }: MessageListProps) {
  const groupedMessages = useMemo(() => {
    const groups: Message[][] = [];
    let currentGroup: Message[] = [];

    for (const message of messages) {
      if (currentGroup.length === 0) {
        currentGroup.push(message);
      } else {
        const last = currentGroup[0];
        // Group if same role and within 2 minutes
        if (last.role === message.role &&
            message.timestamp - last.timestamp < 120000) {
          currentGroup.push(message);
        } else {
          groups.push(currentGroup);
          currentGroup = [message];
        }
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }, [messages]);

  return (
    <FlatList
      data={groupedMessages}
      keyExtractor={(group, index) => `group-${index}`}
      renderItem={({ item: group }) => (
        <View style={styles.messageGroup}>
          {group.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onPress={onMessagePress}
            />
          ))}
        </View>
      )}
      contentContainerStyle={styles.content}
      inverted
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  messageGroup: {
    marginBottom: 8,
  },
});
```

### Code Editor (Monaco in WebView)

```typescript
// mobile/src/components/code/CodeEditor.tsx
import React, { useRef, useEffect } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { StyleSheet } from 'react-native';

interface CodeEditorProps {
  code: string;
  language: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
}

const MONACO_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
    #container { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="container"></div>
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
  <script>
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});

    require(['vs/editor/editor.main'], function () {
      window.editor = monaco.editor.create(document.getElementById('container'), {
        value: '',
        language: 'typescript',
        theme: 'vs-dark',
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        readOnly: false
      });

      window.editor.onDidChangeModelContent(function () {
        const code = window.editor.getValue();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'change',
          code: code
        }));
      });
    });

    function setCode(code) {
      if (window.editor) {
        window.editor.setValue(code);
      }
    }

    function setLanguage(language) {
      if (window.editor) {
        monaco.editor.setModelLanguage(window.editor.getModel(), language);
      }
    }

    function setReadOnly(readOnly) {
      if (window.editor) {
        window.editor.updateOptions({ readOnly });
      }
    }
  </script>
</body>
</html>
`;

export default function CodeEditor({
  code,
  language,
  onChange,
  readOnly = false
}: CodeEditorProps) {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    // Inject initial code
    webViewRef.current?.injectJavaScript(`
      setCode(${JSON.stringify(code)});
      setLanguage('${language}');
      setReadOnly(${readOnly});
      true;
    `);
  }, [code, language, readOnly]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'change':
          onChange?.(data.code);
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebView message:', error);
    }
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ html: MONACO_HTML }}
      style={styles.webview}
      onMessage={handleMessage}
      scrollEnabled={false}
      onError={(error) => console.error('WebView error:', error)}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
});
```

### Diff Viewer

```typescript
// mobile/src/components/code/DiffViewer.tsx
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import DiffView from 'react-native-diff-view';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  language?: string;
  inputFormat?: 'text' | 'json';
}

export default function DiffViewer({
  oldText,
  newText,
  language = 'typescript',
  inputFormat = 'text'
}: DiffViewerProps) {
  const diff = DiffView.computeDiff(oldText, newText, { inputFormat });

  return (
    <ScrollView style={styles.container}>
      <DiffView
        diff={diff}
        format={(text: string) => text}
        renderLine={(line, index) => (
          <View key={index} style={[
            styles.line,
            line.type === 'insert' && styles.lineInsert,
            line.type === 'delete' && styles.lineDelete,
          ]}>
            <Text style={styles.lineNumber}>{line.lineNumber}</Text>
            <Text style={styles.lineContent}>{line.content}</Text>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  line: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  lineInsert: {
    backgroundColor: 'rgba(46, 160, 67, 0.2)',
  },
  lineDelete: {
    backgroundColor: 'rgba(248, 81, 73, 0.2)',
  },
  lineNumber: {
    width: 50,
    color: '#858585',
    fontSize: 12,
    marginRight: 8,
    textAlign: 'right',
  },
  lineContent: {
    flex: 1,
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: 13,
  },
});
```

---

## Offline Support

### AsyncStorage Queue

```typescript
// mobile/src/utils/offline-queue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

interface QueuedRequest {
  id: string;
  timestamp: number;
  method: string;
  params: any;
  retries: number;
}

export class OfflineQueue {
  private queueKey = '@claudeflare:queue';
  private processing = false;

  async enqueue(method: string, params: any): Promise<void> {
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      method,
      params,
      retries: 0
    };

    const queue = await this.getQueue();
    queue.push(request);

    await AsyncStorage.setItem(this.queueKey, JSON.stringify(queue));
  }

  async process(sendFn: (method: string, params: any) => Promise<any>): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    try {
      const queue = await this.getQueue();

      for (const request of queue) {
        try {
          await sendFn(request.method, request.params);

          // Remove successfully sent request
          await this.removeRequest(request.id);
        } catch (error) {
          // Increment retry count
          request.retries++;

          if (request.retries > 5) {
            // Max retries reached, remove
            await this.removeRequest(request.id);
            console.error(`Request ${request.id} failed after 5 retries`);
          } else {
            // Update retry count
            await this.updateRequest(request);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async getQueue(): Promise<QueuedRequest[]> {
    const data = await AsyncStorage.getItem(this.queueKey);
    return data ? JSON.parse(data) : [];
  }

  private async removeRequest(id: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(r => r.id !== id);
    await AsyncStorage.setItem(this.queueKey, JSON.stringify(filtered));
  }

  private async updateRequest(request: QueuedRequest): Promise<void> {
    const queue = await this.getQueue();
    const index = queue.findIndex(r => r.id === request.id);

    if (index !== -1) {
      queue[index] = request;
      await AsyncStorage.setItem(this.queueKey, JSON.stringify(queue));
    }
  }
}
```

### NetInfo Connectivity Listener

```typescript
// mobile/src/hooks/useOffline.ts
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useOffline() {
  const [isOffline, setIsOffline] = useState(false);
  const [isInternetReachable, setIsInternetReachable] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    return () => unsubscribe();
  }, []);

  return { isOffline, isInternetReachable };
}
```

---

## Build & Deploy

### Expo Configuration

```json
// mobile/app.json
{
  "expo": {
    "name": "ClaudeFlare",
    "slug": "claudeflare",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.claudeflare.app",
      "infoPlist": {
        "NSCameraUsageDescription": "Allow access to camera for QR code pairing",
        "NSMicrophoneUsageDescription": "Allow access to microphone for voice input"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.claudeflare.app",
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    "plugins": [
      "expo-secure-store"
    ]
  }
}
```

### EAS Build Configuration

```yaml
# mobile/eas.json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "ios": {
        "autoIncrement": true
      },
      "android": {
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id",
        "ascAppId": "your-app-specific-password",
        "appleTeamId": "your-team-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json"
      }
    }
  }
}
```

---

## Credential Management

### Overview

Secure credential storage using **react-native-keychain** for iOS Keychain and Android Keystore integration, with biometric authentication support.

### Installation

```bash
npm install react-native-keychain
npm install react-native-biometrics
```

### Secure Storage Service

```typescript
// mobile/src/shared/services/credentials/SecureStorage.ts
import * as Keychain from 'react-native-keychain';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

export type CredentialType = 'github-token' | 'cloudflare-api-key' | 'encryption-key' | 'session-token';

export class SecureStorageService {
    private rnBiometrics = new ReactNativeBiometrics();

    /**
     * Store credential securely with biometric protection
     */
    async setCredential(type: CredentialType, value: string, requireBiometrics: boolean = true): Promise<boolean> {
        try {
            const options: Keychain.Options = {
                service: `com.claudeflare.${type}`,
                accessControl: requireBiometrics ? Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET : undefined,
                accessible: requireBiometrics ? Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY : Keychain.ACCESSIBLE.WHEN_UNLOCKED,
            };

            return await Keychain.setGenericPassword(type, value, options);
        } catch (error) {
            console.error(`Failed to store ${type}:`, error);
            return false;
        }
    }

    /**
     * Retrieve credential with biometric authentication
     */
    async getCredential(type: CredentialType, promptMessage?: string): Promise<string | null> {
        try {
            const options: Keychain.Options = {
                service: `com.claudeflare.${type}`,
                authenticationPrompt: promptMessage || 'Authenticate to access credentials',
            };

            const credentials = await Keychain.getGenericPassword(options);
            if (credentials) {
                return credentials.password;
            }
            return null;
        } catch (error) {
            console.error(`Failed to retrieve ${type}:`, error);
            return null;
        }
    }

    /**
     * Remove credential
     */
    async removeCredential(type: CredentialType): Promise<boolean> {
        try {
            return await Keychain.resetGenericPassword({ service: `com.claudeflare.${type}` });
        } catch (error) {
            console.error(`Failed to remove ${type}:`, error);
            return false;
        }
    }

    /**
     * Check if biometric authentication is available
     */
    async isBiometricAvailable(): Promise<{ available: boolean; biometryType?: BiometryTypes }> {
        try {
            const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
            return { available, biometryType };
        } catch (error) {
            return { available: false };
        }
    }

    /**
     * Perform biometric authentication
     */
    async authenticate(promptMessage: string = 'Authenticate'): Promise<boolean> {
        try {
            const { success } = await this.rnBiometrics.simplePrompt({ promptMessage });
            return success;
        } catch (error) {
            console.error('Biometric authentication failed:', error);
            return false;
        }
    }

    /**
     * Check if device has secure enclave/strongbox
     */
    async hasSecureHardware(): Promise<boolean> {
        try {
            const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
            return available && (biometryType === BiometryTypes.TouchID || biometryType === BiometryTypes.FaceID);
        } catch {
            return false;
        }
    }
}
```

### Biometric Authentication Hook

```typescript
// mobile/src/shared/hooks/useBiometrics.ts
import { useState, useEffect } from 'react';
import { SecureStorageService } from '../services/credentials/SecureStorage';

const secureStorage = new SecureStorageService();

export function useBiometrics() {
    const [isAvailable, setIsAvailable] = useState(false);
    const [biometryType, setBiometryType] = useState<'FaceID' | 'TouchID' | 'Biometrics' | null>(null);
    const [hasSecureHardware, setHasSecureHardware] = useState(false);

    useEffect(() => {
        checkAvailability();
    }, []);

    const checkAvailability = async () => {
        const { available, biometryType } = await secureStorage.isBiometricAvailable();
        setIsAvailable(available);
        setBiometryType(biometryType || null);
        setHasSecureHardware(await secureStorage.hasSecureHardware());
    };

    const authenticate = async (promptMessage?: string) => {
        return await secureStorage.authenticate(promptMessage);
    };

    return {
        isAvailable,
        biometryType,
        hasSecureHardware,
        authenticate,
    };
}
```

### OAuth Integration

```typescript
// mobile/src/features/auth/services/OAuthService.ts
import { SecureStorageService } from '../../../../shared/services/credentials/SecureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OAuthConfig {
    clientId: string;
    redirectUri: string;
    scopes: string[];
    authorizationEndpoint: string;
    tokenEndpoint: string;
}

export class OAuthService {
    private secureStorage = new SecureStorageService();

    async initiateOAuth(config: OAuthConfig): Promise<void> {
        // Generate PKCE code verifier
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        // Store for callback
        await AsyncStorage.setItem('@claudeflare:pkce_verifier', codeVerifier);

        // Build authorization URL
        const authUrl = new URL(config.authorizationEndpoint);
        authUrl.searchParams.set('client_id', config.clientId);
        authUrl.searchParams.set('redirect_uri', config.redirectUri);
        authUrl.searchParams.set('scope', config.scopes.join(' '));
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        // Open browser for OAuth flow
        // Use WebBrowser.openBrowserAsync(authUrl.toString())
    }

    async handleOAuthCallback(code: string, config: OAuthConfig): Promise<string> {
        // Retrieve PKCE verifier
        const codeVerifier = await AsyncStorage.getItem('@claudeflare:pkce_verifier');
        if (!codeVerifier) {
            throw new Error('PKCE verifier not found');
        }

        // Exchange code for token
        const response = await fetch(config.tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code,
                client_id: config.clientId,
                redirect_uri: config.redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        const { access_token, refresh_token } = await response.json();

        // Store securely
        await this.secureStorage.setCredential('github-token', access_token, true);

        return access_token;
    }

    private generateCodeVerifier(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    private async generateCodeChallenge(verifier: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return this.base64URLEncode(new Uint8Array(digest));
    }

    private base64URLEncode(buffer: Uint8Array): string {
        return btoa(String.fromCharCode(...buffer))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }
}
```

---

## Push Notifications

### Overview

Push notification support for **agent completion notifications** using Firebase Cloud Messaging (FCM) for Android and Apple Push Notification Service (APNs) for iOS.

### Installation

```bash
npm install @react-native-firebase/app
npm install @react-native-firebase/messaging
npm install @react-native-firebase/apns
```

### Firebase Configuration

```javascript
// mobile/firebase.json
{
  "react-native": {
    "android_task_executor_maximum_pool_size": 10
  },
  "apps": [
    {
      "app_id": "1:123456789:android:abcdef",
      "project_id": "claudeflare-mobile",
      "android": {
        "package_name": "com.claudeflare.app",
        "sha1_cert_hashes": ["ABC123"]
      }
    },
    {
      "app_id": "1:123456789:ios:abcdef",
      "project_id": "claudeflare-mobile",
      "ios": {
        "bundle_id": "com.claudeflare.app"
      }
    }
  ]
}
```

### Notification Service

```typescript
// mobile/src/shared/services/notifications/PushNotificationService.ts
import messaging, {
    FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { SecureStorageService } from '../credentials/SecureStorage';

export interface NotificationData {
    type: 'agent-complete' | 'agent-error' | 'desktop-connected' | 'sync-complete';
    title: string;
    body: string;
    data?: Record<string, any>;
}

export class PushNotificationService {
    private secureStorage = new SecureStorageService();
    private unsubscribe?: () => void;

    /**
     * Initialize push notifications
     */
    async initialize(): Promise<void> {
        // Request permission
        const authStatus = await messaging().requestPermission();
        const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
            console.warn('Push notification permission denied');
            return;
        }

        // Get FCM token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);

        // Store token securely
        await this.secureStorage.setCredential('fcm-token', token, false);

        // Listen to token refresh
        this.unsubscribe = messaging().onTokenRefresh(async (newToken) => {
            console.log('FCM Token refreshed:', newToken);
            await this.secureStorage.setCredential('fcm-token', newToken, false);
            await this.registerTokenWithServer(newToken);
        });

        // Register with Cloudflare
        await this.registerTokenWithServer(token);

        // Setup message handlers
        this.setupMessageHandlers();
    }

    /**
     * Register FCM token with Cloudflare Workers
     */
    private async registerTokenWithServer(token: string): Promise<void> {
        try {
            await fetch('https://api.claudeflare.workers.dev/register-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    platform: Platform.OS,
                }),
            });
        } catch (error) {
            console.error('Failed to register token:', error);
        }
    }

    /**
     * Setup foreground and background message handlers
     */
    private setupMessageHandlers(): void {
        // Foreground messages
        messaging().onMessage(async (message: FirebaseMessagingTypes.RemoteMessage) => {
            console.log('Foreground message:', message);
            // Handle in-app notification
        });

        // Background/quit messages
        messaging().setBackgroundMessageHandler(async (message: FirebaseMessagingTypes.RemoteMessage) => {
            console.log('Background message:', message);
            // Handle background notification
        });
    }

    /**
     * Send notification to device via Cloudflare
     */
    async sendNotification(deviceToken: string, notification: NotificationData): Promise<void> {
        try {
            await fetch('https://api.claudeflare.workers.dev/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: deviceToken,
                    notification: {
                        title: notification.title,
                        body: notification.body,
                    },
                    data: notification.data,
                }),
            });
        } catch (error) {
            console.error('Failed to send notification:', error);
        }
    }

    /**
     * Get current FCM token
     */
    async getToken(): Promise<string | null> {
        return await messaging().getToken();
    }

    /**
     * Cleanup listeners
     */
    destroy(): void {
        this.unsubscribe?.();
    }
}
```

### Notification Hook

```typescript
// mobile/src/shared/hooks/useNotifications.ts
import { useEffect, useState } from 'react';
import { PushNotificationService, NotificationData } from '../services/notifications/PushNotificationService';

const notificationService = new PushNotificationService();

export function useNotifications() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            await notificationService.initialize();
            if (mounted) {
                setIsInitialized(true);
                setToken(await notificationService.getToken());
            }
        };

        init();

        return () => {
            notificationService.destroy();
        };
    }, []);

    const sendNotification = async (notification: NotificationData) => {
        if (token) {
            await notificationService.sendNotification(token, notification);
        }
    };

    return {
        isInitialized,
        token,
        sendNotification,
    };
}
```

### Agent Completion Notification

```typescript
// mobile/src/features/chat/hooks/useAgentNotification.ts
import { useNotifications } from '../../../shared/hooks/useNotifications';
import { useEffect } from 'react';

export function useAgentNotification(agentId: string) {
    const { sendNotification } = useNotifications();

    useEffect(() => {
        // Listen for agent completion
        const handleAgentComplete = async () => {
            await sendNotification({
                type: 'agent-complete',
                title: 'Agent Task Complete',
                body: `Agent ${agentId} has completed its task`,
                data: { agentId },
            });
        };

        return () => {
            // Cleanup
        };
    }, [agentId, sendNotification]);
}
```

---

## Dependencies

### Core Dependencies

```json
// mobile/package.json
{
  "name": "claudeflare-mobile",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-dev-client": "~5.0.0",
    "expo-secure-store": "~14.0.0",
    "react": "18.3.1",
    "react-native": "0.76.1",
    "react-native-webview": "13.12.5",

    // Navigation
    "@react-navigation/native": "^6.1.18",
    "@react-navigation/stack": "^6.4.1",
    "@react-navigation/bottom-tabs": "^6.6.1",

    // State Management
    "zustand": "^5.0.0",

    // WebRTC
    "react-native-webrtc": "^124.0.4",

    // Camera & QR Scanner
    "react-native-vision-camera": "^4.6.1",
    "vision-camera-code-scanner": "^0.6.2",

    // Code Editor
    "react-native-monaco-editor": "^2.0.0",
    "react-native-diff-view": "^2.5.0",

    // Networking
    "@react-native-community/netinfo": "^11.4.1",
    "react-native-event-source": "^1.1.1",

    // Storage
    "@react-native-async-storage/async-storage": "^2.1.0",

    // Security
    "react-native-keychain": "^9.0.0",
    "react-native-biometrics": "^4.0.0",

    // Push Notifications
    "@react-native-firebase/app": "^21.0.0",
    "@react-native-firebase/messaging": "^21.0.0",

    // UI Components
    "react-native-paper": "^5.12.5",
    "react-native-vector-icons": "^10.2.0",

    // Utilities
    "date-fns": "^4.1.0",
    "uuid": "^11.0.3"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.12",
    "@types/react-native": "~0.73.0",
    "typescript": "~5.6.0",
    "jest": "^29.7.0",
    "eslint": "^9.0.0"
  }
}
```

### Dependency Summary

| Category | Package | Purpose |
|----------|---------|---------|
| **Core** | React Native 0.76.1 | Framework with New Architecture |
| **Core** | Expo 52.0 | Development & build tools |
| **Navigation** | React Navigation 6 | Screen navigation |
| **State** | Zustand 5.0 | State management |
| **WebRTC** | react-native-webrtc 124.0 | P2P communication |
| **Camera** | react-native-vision-camera 4.6 | Camera access |
| **QR Scanner** | vision-camera-code-scanner 0.6 | QR code scanning |
| **Editor** | react-native-monaco-editor 2.0 | Code editing |
| **Diff** | react-native-diff-view 2.5 | Code diffs |
| **Security** | react-native-keychain 9.0 | Secure storage |
| **Biometrics** | react-native-biometrics 4.0 | Face ID/Touch ID |
| **Notifications** | @react-native-firebase/messaging 21.0 | Push notifications |
| **Network** | @react-native-community/netinfo 11.4 | Network status |
| **Storage** | @react-native-async-storage/async-storage 2.1 | Local storage |

---

## Summary

The mobile app extends ClaudeFlare to iOS and Android devices:

| Feature | Implementation |
|---------|----------------|
| **Cross-platform** | React Native 0.76+ with New Architecture (Fabric & TurboModules) |
| **Code Editor** | Monaco in WebView |
| **Diff Viewer** | react-native-diff-view |
| **Desktop Connection** | WebRTC via react-native-webrtc + gomobile |
| **QR Pairing** | react-native-vision-camera + code scanner |
| **Offline Support** | AsyncStorage + NetInfo |
| **Credentials** | react-native-keychain (Keychain/Keystore) + biometrics |
| **Navigation** | React Navigation 6 |
| **State** | Zustand |
| **Push Notifications** | Firebase Cloud Messaging (FCM) + APNs |
| **OAuth** | PKCE flow with secure token storage |

**Key Capabilities:**
- React Native 0.76 New Architecture (Fabric + TurboModules) for optimal performance
- Pair with desktop via QR code scanning (vision-camera)
- View and edit code on mobile (Monaco in WebView)
- Review PRs with diff viewer
- Chat with AI agents with streaming responses
- Secure credential storage with biometric authentication
- Push notifications for agent completion
- Continue work offline with automatic sync
- Go mobile (gomobile) bindings for WebRTC and crypto

---

## References

### React Native & Expo
- [React Native 0.76 New Architecture](https://reactnative.dev/architecture/landing-page)
- [React Native Official Docs](https://reactnative.dev/docs/strict-typescript-api)
- [Expo Documentation](https://docs.expo.dev/)
- [Expo App Folder Structure Best Practices](https://expo.dev/blog/expo-app-folder-structure-best-practices)

### WebRTC & Real-time Communication
- [react-native-webrtc](https://github.com/react-native-webrtc/react-native-webrtc)
- [Pion WebRTC (Go)](https://github.com/pion/webrtc)
- [WebRTC for the Curious](https://webrtcforthecurious.com/docs/07-data-communication/)
- [Cloudflare Calls WebRTC](https://blog.cloudflare.com/cloudflare-calls-anycast-webrtc/)

### Camera & QR Scanning
- [React Native Vision Camera](https://react-native-vision-camera.com/docs/guides/code-scanning)
- [Vision Camera Code Scanner](https://scanbot.io/techblog/react-native-vision-camera-code-scanner-tutorial/)

### Code Editing & Display
- [React Native + Monaco Editor](https://www.phodal.com/blog/react-native-visual-studo-code-monaco-editor-build-mobile-editor/)
- [react-native-diff-view](https://github.com/jakemmarsh/react-native-diff-view)
- [react-diff-viewer](https://github.com/RevR1m/react-native-diff-view)

### Security & Credentials
- [react-native-keychain](https://oblador.github.io/react-native-keychain/docs/)
- [Biometric Authentication with react-native-keychain](https://dev.to/ajmal_hasan/biometric-authentication-with-react-native-keychain-5ac8)
- [React Native Security Docs](https://reactnative.dev/docs/security)

### Push Notifications
- [React Native Firebase Messaging](https://rnfirebase.io/messaging/usage)
- [Integrating Push Notifications in React Native Apps (FCM & APNs)](https://mishrilalsahu.in.net/Blogs/integrating-push-notifications-in-react-native-apps-fcm-apns)

### Offline Support
- [Building Offline-First React Native Apps in 2025](https://medium.com/@ektakumari8872/building-offline-first-react-native-apps-in-2025-a-complete-guide-with-caching-sync-and-b49a530843b7)
- [Building Robust Offline Functionality in React Native](https://dev.to/oghenetega_adiri/building-robust-offline-functionality-in-react-native-a-complete-guide-4174)

### Go Mobile
- [Go Mobile Wiki](https://github.com/golang/go/wiki/Mobile)
- [gomobile command reference](https://pkg.go.dev/golang.org/x/mobile/cmd/gomobile)
- [Outline SDK Mobile Integration](https://developers.google.com/outline/docs/guides/sdk/mobile-app-integration)

### State Management
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [State Management: Redux Toolkit vs Zustand vs Jotai](https://betterstack.com/community/guides/scaling-nodejs/zustand-vs-redux-toolkit-vs-jotai/)

### Navigation
- [React Navigation 6](https://reactnavigation.org/)
- [React Native Folder Structure 2025](https://codercrafter.in/blogs/react-native/react-native-folder-structure-2025-a-no-bs-guide-to-scalable-apps)
