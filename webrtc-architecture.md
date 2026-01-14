# WebRTC Architecture: P2P Communication for ClaudeFlare

## Overview

This document details WebRTC-based peer-to-peer communication between mobile devices, desktop compute nodes, and Cloudflare edge infrastructure. WebRTC enables direct UDP connections with NAT traversal, providing sub-15ms latency for local GPU compute.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Data Channel Protocol](#data-channel-protocol)
- [Signaling Server](#signaling-server)
- [NAT Traversal](#nat-traversal)
- [Connection Resilience](#connection-resilience)
- [Security](#security)
- [Implementation Examples](#implementation-examples)

---

## Architecture Overview

```
┌─────────────────┐                    ┌─────────────────┐
│  Mobile Device  │                    │  Desktop Node   │
│  (React Native) │                    │  (Go + pion)     │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │         ┌──────────────┐             │
         │────────▶│  Cloudflare  │◀────────────│
         │         │  Signaling   │             │
         │         │  DO (WebSocket)            │
         │         └──────────────┘             │
         │                                      │
         ▼                                      ▼
    WebRTC Data Channel (Direct P2P)
         │                                      │
         │           JSON-RPC + Binary          │
         └──────────────────────────────────────┘
```

### Connection Flow

1. **Pairing**: QR code → 6-digit code → Durable Object coordination
2. **Signaling**: Offer/Answer exchange via Cloudflare DO
3. **ICE**: STUN/TURN for NAT traversal
4. **Connection**: Direct UDP data channel established
5. **Communication**: JSON-RPC over data channel

---

## Data Channel Protocol

### Channel Types

```typescript
// webrtc/protocol.ts
export enum ChannelType {
  // Reliable, ordered - for control messages
  CONTROL = 'control',

  // Unreliable, unordered - for compute results (streaming)
  COMPUTE = 'compute',

  // Reliable, ordered - for file transfers
  FILE = 'file'
}

export interface ChannelConfig {
  type: ChannelType;
  ordered: boolean;
  maxRetransmits?: number;
  maxPacketLifeTime?: number;
  protocol: string;
}

export const CHANNEL_CONFIGS: Record<ChannelType, ChannelConfig> = {
  [ChannelType.CONTROL]: {
    type: ChannelType.CONTROL,
    ordered: true,
    maxRetransmits: 3,
    protocol: 'jsonrpc'
  },
  [ChannelType.COMPUTE]: {
    type: ChannelType.COMPUTE,
    ordered: false,
    maxRetransmits: 0,
    protocol: 'binary-stream'
  },
  [ChannelType.FILE]: {
    type: ChannelType.FILE,
    ordered: true,
    maxRetransmits: 10,
    protocol: 'chunked'
  }
};
```

### JSON-RPC Protocol

```typescript
// webrtc/jsonrpc.ts
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// Methods
export enum RPCMethod {
  // Compute methods
  GENERATE = 'compute.generate',
  EMBED = 'compute.embed',
  EXECUTE = 'compute.execute',

  // File methods
  READ_FILE = 'file.read',
  WRITE_FILE = 'file.write',
  LIST_DIR = 'file.list',

  // Control methods
  PING = 'control.ping',
  STATUS = 'control.status',
  CANCEL = 'control.cancel'
}
```

### Binary Chunking for Large Messages

WebRTC data channels have a ~16KB message size limit due to SCTP. For larger payloads:

```typescript
// webrtc/chunking.ts
const CHUNK_SIZE = 16 * 1024; // 16KB

export interface ChunkHeader {
  id: string;
  index: number;
  total: number;
  size: number;
  checksum: string;
}

export async function sendChunked(
  dc: RTCDataChannel,
  data: ArrayBuffer
): Promise<void> {
  const total = Math.ceil(data.byteLength / CHUNK_SIZE);
  const id = crypto.randomUUID();

  for (let i = 0; i < total; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, data.byteLength);
    const chunk = data.slice(start, end);

    const header: ChunkHeader = {
      id,
      index: i,
      total,
      size: chunk.byteLength,
      checksum: await sha256(chunk)
    };

    // Combine header + chunk
    const combined = new Uint8Array(
      JSON.stringify(header).length + 1 + chunk.byteLength
    );
    combined.set(new TextEncoder().encode(JSON.stringify(header) + '\n'), 0);
    combined.set(new Uint8Array(chunk), JSON.stringify(header).length + 1);

    dc.send(combined.buffer);
  }
}

export class ChunkReceiver {
  private buffers = new Map<string, Uint8Array[]>();

  receive(data: ArrayBuffer): { complete: boolean; data?: ArrayBuffer } {
    const text = new TextDecoder().decode(data.slice(0, 1024));
    const headerEnd = text.indexOf('\n');

    if (headerEnd === -1) {
      throw new Error('Invalid chunk format');
    }

    const header: ChunkHeader = JSON.parse(text.slice(0, headerEnd));
    const chunk = new Uint8Array(data.slice(headerEnd + 1));

    if (!this.buffers.has(header.id)) {
      this.buffers.set(header.id, []);
    }

    const buffer = this.buffers.get(header.id)!;
    buffer[header.index] = new Uint8Array(chunk);

    if (buffer.length === header.total) {
      // All chunks received
      const combined = new Uint8Array(
        buffer.reduce((sum, arr) => sum + arr.length, 0)
      );

      let offset = 0;
      for (const arr of buffer) {
        combined.set(arr, offset);
        offset += arr.length;
      }

      this.buffers.delete(header.id);
      return { complete: true, data: combined.buffer };
    }

    return { complete: false };
  }
}
```

---

## Signaling Server

### Durable Object Signaling

```typescript
// workers/webrtc/signaling-do.ts
export class SignalingDO extends DurableObject {
  // Active WebSocket connections
  private sockets = new Map<string, WebSocket>();

  // Pending offers (waiting for answer)
  private pendingOffers = new Map<string, {
    offer: RTCSessionDescription;
    createdAt: number;
  }>();

  // ICE candidates for relay
  private iceCandidates = new Map<string, RTCIceCandidate[]>();

  async fetch(request: Request) {
    const url = new URL(request.url);
    const clientId = request.headers.get('X-Client-ID')!;

    // WebSocket upgrade for signaling
    if (url.pathname === '/signal') {
      return this.handleWebSocket(request, clientId);
    }

    // REST API for offer/answer
    if (url.pathname === '/offer') {
      return this.handleOffer(request, clientId);
    }

    if (url.pathname === '/answer') {
      return this.handleAnswer(request, clientId);
    }

    if (url.pathname === '/ice') {
      return this.handleICE(request, clientId);
    }
  }

  private async handleWebSocket(request: Request, clientId: string) {
    const { 0: client, 1: server } = Object.values(new WebSocketPair());

    this.ctx.acceptWebSocket(server);
    this.sockets.set(clientId, client);

    // Handle incoming WebSocket messages
    server.addEventListener('message', (event: MessageEvent) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'offer':
          this.relayOffer(message, clientId);
          break;
        case 'answer':
          this.relayAnswer(message, clientId);
          break;
        case 'ice':
          this.relayICE(message, clientId);
          break;
      }
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  private async handleOffer(request: Request, fromId: string) {
    const { offer, to } = await request.json();

    // Store offer
    this.pendingOffers.set(to, {
      offer,
      createdAt: Date.now()
    });

    // Forward to target via WebSocket or poll
    const targetSocket = this.sockets.get(to);
    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
      targetSocket.send(JSON.stringify({
        type: 'offer',
        from: fromId,
        offer
      }));
    }

    return new Response(JSON.stringify({ status: 'offer_sent' }));
  }

  private async handleAnswer(request: Request, fromId: string) {
    const { answer, to } = await request.json();

    // Forward to target
    const targetSocket = this.sockets.get(to);
    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
      targetSocket.send(JSON.stringify({
        type: 'answer',
        from: fromId,
        answer
      }));
    }

    return new Response(JSON.stringify({ status: 'answer_sent' }));
  }

  private async handleICE(request: Request, fromId: string) {
    const { candidate, to } = await request.json();

    // Store for relay
    if (!this.iceCandidates.has(to)) {
      this.iceCandidates.set(to, []);
    }
    this.iceCandidates.get(to)!.push(candidate);

    // Forward immediately if connected
    const targetSocket = this.sockets.get(to);
    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
      targetSocket.send(JSON.stringify({
        type: 'ice',
        from: fromId,
        candidate
      }));
    }

    return new Response(JSON.stringify({ status: 'ice_relayed' }));
  }
}
```

---

## NAT Traversal

### ICE Configuration

```typescript
// webrtc/ice-config.ts
export interface RTCConfiguration {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
  iceTransportPolicy: 'all' | 'relay';
}

export function getICEConfig(useTurn = false): RTCConfiguration {
  const config: RTCConfiguration = {
    iceServers: [
      // STUN servers for NAT discovery
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all'
  };

  if (useTurn) {
    // TURN servers for symmetric NAT
    config.iceServers.push({
      urls: 'turn:turn.cloudflare.com:3478',
      username: 'claudeflare',
      credential: process.env.TURN_CREDENTIALS!
    });
  }

  return config;
}
```

### Connection State Machine

```typescript
// webrtc/connection-state.ts
export enum ConnectionState {
  NEW = 'new',
  CHECKING = 'checking',
  CONNECTED = 'connected',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DISCONNECTED = 'disconnected',
  CLOSED = 'closed'
}

export class ConnectionManager {
  private state = ConnectionState.NEW;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  onStateChange: (state: ConnectionState) => void = () => {};

  async connect(config: RTCConfiguration) {
    this.state = ConnectionState.CHECKING;
    this.onStateChange(this.state);

    try {
      const pc = new RTCPeerConnection(config);

      pc.addEventListener('iceconnectionstatechange', () => {
        this.handleICEStateChange(pc.iceConnectionState);
      });

      pc.addEventListener('connectionstatechange', () => {
        this.handleConnectionStateChange(pc.connectionState);
      });

      return pc;
    } catch (error) {
      this.state = ConnectionState.FAILED;
      this.onStateChange(this.state);
      throw error;
    }
  }

  private handleICEStateChange(state: RTCIceConnectionState) {
    switch (state) {
      case 'connected':
        this.state = ConnectionState.CONNECTED;
        this.reconnectAttempts = 0;
        break;

      case 'completed':
        this.state = ConnectionState.COMPLETED;
        break;

      case 'failed':
        this.state = ConnectionState.FAILED;
        this.attemptReconnect();
        break;

      case 'disconnected':
        this.state = ConnectionState.DISCONNECTED;
        this.attemptReconnect();
        break;
    }

    this.onStateChange(this.state);
  }

  private async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.state = ConnectionState.CLOSED;
      this.onStateChange(this.state);
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff
    const delay = Math.pow(2, this.reconnectAttempts) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Trigger reconnection via signaling
    this.onStateChange(ConnectionState.CHECKING);
  }
}
```

---

## Connection Resilience

### Offline Message Queue

```typescript
// webrtc/offline-queue.ts
export class OfflineQueue {
  private queue: Array<{ message: any; timestamp: number }> = [];
  private queueSize = 0;
  private maxQueueSize = 10 * 1024 * 1024; // 10MB

  async enqueue(message: any): Promise<boolean> {
    const size = JSON.stringify(message).length;

    if (this.queueSize + size > this.maxQueueSize) {
      // Evict oldest messages
      while (this.queueSize + size > this.maxQueueSize * 0.8) {
        const evicted = this.queue.shift()!;
        this.queueSize -= JSON.stringify(evicted).length;
      }
    }

    this.queue.push({ message, timestamp: Date.now() });
    this.queueSize += size;

    // Persist to IndexedDB
    await this.persist();

    return true;
  }

  async flush(sendFn: (message: any) => Promise<void>): Promise<void> {
    while (this.queue.length > 0) {
      const { message } = this.queue.shift()!;

      try {
        await sendFn(message);
        this.queueSize -= JSON.stringify(message).length;
      } catch (error) {
        // Re-queue if send fails
        this.queue.unshift({ message, timestamp: Date.now() });
        throw error;
      }
    }

    await this.persist();
  }

  private async persist() {
    if ('indexedDB' in window) {
      const db = await this.openDB();
      const tx = db.transaction('queue', 'readwrite');
      await tx.objectStore('queue').put(this.queue);
    }
  }
}
```

### Session Restoration

```typescript
// webrtc/session-restore.ts
export interface SessionSnapshot {
  sessionId: string;
  dataChannels: Map<string, any>;
  pendingRequests: Map<string, any>;
  state: any;
  timestamp: number;
}

export class SessionManager {
  private snapshot: SessionSnapshot | null = null;

  async captureSnapshot(): Promise<SessionSnapshot> {
    return {
      sessionId: crypto.randomUUID(),
      dataChannels: new Map(),
      pendingRequests: new Map(),
      state: {},
      timestamp: Date.now()
    };
  }

  async restoreSession(snapshot: SessionSnapshot) {
    // Restore data channels
    for (const [label, config] of snapshot.dataChannels) {
      await this.createDataChannel(label, config);
    }

    // Replay pending requests
    for (const [id, request] of snapshot.pendingRequests) {
      await this.replayRequest(id, request);
    }

    // Restore application state
    this.applyState(snapshot.state);
  }

  private async replayRequest(id: string, request: any) {
    // Re-send the request through the data channel
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        ...request
      }));
    }
  }
}
```

---

## Security

### DTLS-SRTP Encryption

WebRTC uses DTLS-SRTP for all data channel communication:

- **DTLS**: Datagram Transport Layer Security for handshake
- **SRTP**: Secure Real-time Transport Protocol for media/data
- **Automatic**: No additional configuration needed
- **E2E Encrypted**: Data encrypted end-to-end between peers

### Certificate Fingerprinting

```typescript
// webrtc/security.ts
export async function verifyPeerIdentity(
  pc: RTCPeerConnection,
  expectedFingerprint: string
): Promise<boolean> {
  const certificate = await pc.getCertificate();
  if (!certificate) {
    return false;
  }

  const fingerprints = await certificate.getFingerprints();
  const actualFingerprint = fingerprints[0].value;

  return actualFingerprint === expectedFingerprint;
}

// Generate fingerprint for verification
export async function getLocalFingerprint(): Promise<string> {
  const cert = await RTCCertificate.generateCertificate({
    name: 'ECDSA',
    namedCurve: 'P-256'
  });

  const fingerprints = await cert.getFingerprints();
  return fingerprints[0].value;
}
```

---

## Implementation Examples

### Desktop (Go + pion/webrtc)

```go
// desktop/webrtc/peerconnection.go
package webrtc

import (
    "encoding/json"
    "github.com/pion/webrtc/v3"
)

type PeerConnectionManager struct {
    pc *webrtc.PeerConnection
    dc map[string]*webrtc.DataChannel
}

func (m *PeerConnectionManager) CreateOffer() (*webrtc.SessionDescription, error) {
    // Create peer connection
    config := webrtc.Configuration{
        ICEServers: []webrtc.ICEServer{
            {URLs: []string{"stun:stun.cloudflare.com:3478"}},
        },
        ICECandidatePoolSize: 10,
    }

    pc, err := webrtc.NewPeerConnection(config)
    if err != nil {
        return nil, err
    }

    m.pc = pc
    m.dc = make(map[string]*webrtc.DataChannel)

    // Create data channels
    controlDC, err := pc.CreateDataChannel("control", &webrtc.DataChannelInit{
        Ordered:           &[]bool{true}[0],
        MaxRetransmits:    &[]uint16{3}[0],
    })
    if err != nil {
        return nil, err
    }
    m.dc["control"] = controlDC

    computeDC, err := pc.CreateDataChannel("compute", &webrtc.DataChannelInit{
        Ordered:        &[]bool{false}[0],
        MaxRetransmits: &[]uint16{0}[0],
    })
    if err != nil {
        return nil, err
    }
    m.dc["compute"] = computeDC

    // Create offer
    offer, err := pc.CreateOffer(nil)
    if err != nil {
        return nil, err
    }

    if err = pc.SetLocalDescription(offer); err != nil {
        return nil, err
    }

    return &offer, nil
}
```

### Mobile (React Native)

```typescript
// mobile/webrtc/PeerConnectionManager.ts
import { RTCView } from 'react-native-webrtc';

export class MobilePeerConnectionManager {
  private pc: RTCPeerConnection | null = null;
  private dataChannels: Map<string, RTCDataChannel> = new Map();

  async connectToDesktop(pairCode: string): Promise<void> {
    // Fetch signaling config from Cloudflare
    const config = await fetch(
      `https://signaling.claudeflare.workers.dev/pair/${pairCode}`
    ).then(r => r.json());

    // Create peer connection
    this.pc = new RTCPeerConnection(config.iceConfig);

    // Handle incoming data channel from desktop
    this.pc.addEventListener('datachannel', (event) => {
      const dc = event.channel;
      this.dataChannels.set(dc.label, dc);
      this.setupDataChannel(dc);
    });

    // Set remote description (offer from desktop)
    await this.pc.setRemoteDescription(
      new RTCSessionDescription(config.offer)
    );

    // Create answer
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    // Send answer via signaling
    await fetch(
      `https://signaling.claudeflare.workers.dev/pair/${pairCode}/answer`,
      {
        method: 'POST',
        body: JSON.stringify({ answer })
      }
    );
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);

      switch (message.method) {
        case 'compute.generate':
          this.handleGenerate(message);
          break;
        case 'control.status':
          this.updateStatus(message.params);
          break;
      }
    });
  }
}
```

---

## Summary

WebRTC provides the foundation for low-latency, direct communication between all nodes in the ClaudeFlare platform:

| Feature | Implementation |
|---------|----------------|
| **Signaling** | Cloudflare Durable Object with WebSocket |
| **NAT Traversal** | STUN (Cloudflare) + TURN (for symmetric NAT) |
| **Data Channels** | 3 types: control, compute (streaming), file (chunked) |
| **Protocol** | JSON-RPC + binary chunking for large messages |
| **Resilience** | Reconnection with exponential backoff |
| **Security** | DTLS-SRTP automatic encryption |
| **Offline Support** | IndexedDB queue with flush on reconnect |

**Key Benefits:**
- Sub-15ms latency for local GPU access
- No server in the loop for compute traffic
- Automatic encryption
- Works on all platforms (Web, mobile, desktop)

---

## References

- [Cloudflare Calls WebRTC](https://blog.cloudflare.com/cloudflare-calls-anycast-webrtc/)
- [WebRTC for the Curious](https://webrtcforthecurious.com/docs/07-data-communication/)
- [Pion WebRTC (Go)](https://github.com/pion/webrtc)
- [react-native-webrtc](https://github.com/react-native-webrtc/react-native-webrtc)
