# Streaming Guide

The Streaming Gateway provides real-time communication capabilities using Server-Sent Events (SSE) and WebSockets.

## Server-Sent Events (SSE)

SSE is ideal for server-to-client streaming where you need to push updates to clients.

### Basic SSE Setup

```typescript
import { SSEGateway } from '@claudeflare/api-gateway-v3/streaming';

const sseGateway = new SSEGateway({
  maxConnections: 10000,
  bufferSize: 64 * 1024,
  heartbeatInterval: 30000,
  timeout: 120000,
  compression: true,
});
```

### Creating SSE Connection

```typescript
// Create a writable stream
const writable = new WritableStream({
  write(chunk) {
    // Send data to client
  },
  close() {
    // Cleanup
  },
});

// Connect client
const connectionId = await sseGateway.connect('client-123', writable);

// Subscribe to channels
await sseGateway.subscribe(connectionId, 'notifications');
await sseGateway.subscribe(connectionId, 'updates');
```

### Sending Messages

```typescript
// Send to specific connection
await sseGateway.send(connectionId, {
  id: 'msg-1',
  event: 'notification',
  data: JSON.stringify({
    title: 'New message',
    body: 'You have a new message',
  }),
  retry: 3000,
});

// Broadcast to all subscribers
await sseGateway.broadcast('notifications', {
  event: 'update',
  data: JSON.stringify({
    type: 'new-post',
    postId: '123',
  }),
});
```

### SSE Message Format

```typescript
interface SSEMessage {
  id?: string;          // Message ID for reconnection
  event?: string;       // Event type
  data: string;         // Message data (string or JSON string)
  retry?: number;       // Reconnection delay in ms
}
```

### Managing Connections

```typescript
// Get connection info
const connection = sseGateway.getConnection(connectionId);
console.log(connection?.clientId);
console.log(connection?.channels);

// Get all connections for a client
const clientConnections = sseGateway.getClientConnections('client-123');

// Disconnect client
await sseGateway.disconnect(connectionId, 1000, 'Client disconnected');

// Cleanup idle connections
const cleaned = await sseGateway.cleanupIdle(300000); // 5 minutes
```

### SSE Metrics

```typescript
const metrics = sseGateway.getMetrics();
console.log(`Total connections: ${metrics.totalConnections}`);
console.log(`Active connections: ${metrics.activeConnections}`);
console.log(`Messages sent: ${metrics.totalMessages}`);
console.log(`Bytes sent: ${formatBytes(metrics.totalBytes)}`);
```

## WebSockets

WebSockets provide bidirectional communication between client and server.

### Basic WebSocket Setup

```typescript
import { WebSocketGateway } from '@claudeflare/api-gateway-v3/streaming';

const wsGateway = new WebSocketGateway({
  maxConnections: 10000,
  bufferSize: 64 * 1024,
  heartbeatInterval: 30000,
  timeout: 120000,
});
```

### Accepting WebSocket Connections

```typescript
// Accept WebSocket connection
const connectionId = await wsGateway.accept(webSocket, 'client-123');

// Subscribe to channels
await wsGateway.subscribe(connectionId, 'messages');
await wsGateway.subscribe(connectionId, 'presence');
```

### WebSocket Messages

```typescript
interface WebSocketMessage {
  type: 'message' | 'error' | 'close' | 'ping' | 'pong';
  data?: unknown;
  code?: number;
  reason?: string;
}
```

### Sending WebSocket Messages

```typescript
// Send to specific client
await wsGateway.send(connectionId, {
  type: 'message',
  data: {
    event: 'chat-message',
    from: 'user-123',
    message: 'Hello!',
  },
});

// Broadcast to channel
await wsGateway.broadcast('messages', {
  type: 'message',
  data: {
    event: 'broadcast',
    message: 'System announcement',
  },
});
```

### Handling Incoming Messages

```typescript
// Set up message handler
wsGateway.on('message', ({ connectionId, message }) => {
  console.log(`Received from ${connectionId}:`, message);

  // Echo back
  wsGateway.send(connectionId, {
    type: 'message',
    data: {
      event: 'echo',
      original: message,
    },
  });
});
```

### Managing WebSocket Connections

```typescript
// Get connection info
const connection = wsGateway.getConnection(connectionId);

// Close connection
await wsGateway.disconnect(connectionId, 1000, 'Normal closure');
```

## Stream Router

Route streams to different targets with transformation.

```typescript
import { StreamRouter } from '@claudeflare/api-gateway-v3/streaming';

const router = new StreamRouter({
  routes: [
    {
      pattern: '/api/v1',
      target: 'https://api-v1.example.com',
      transform: {
        type: 'json',
        encoder: (data) => JSON.stringify(data),
        decoder: (data) => JSON.parse(data),
      },
    },
    {
      pattern: '/api/v2',
      target: 'https://api-v2.example.com',
      buffer: true,
      compression: true,
    },
  ],
  fallback: {
    type: 'error',
  },
});

// Route stream
const routedStream = await router.route(inputStream, '/api/v1');
```

## Stream Processor

Process streams with backpressure handling.

```typescript
import { StreamProcessor } from '@claudeflare/api-gateway-v3/streaming';

const processor = new StreamProcessor(64 * 1024, 0.8);

// Process stream chunks
const results = await processor.process(inputStream, async (chunk) => {
  const decoder = new TextDecoder();
  const text = decoder.decode(chunk);
  return JSON.parse(text);
});

// Split stream into chunks
for await (const chunk of processor.chunkStream(inputStream, 1024)) {
  console.log('Chunk:', chunk);
}
```

## Stream Manager

Unified manager for all streaming components.

```typescript
import { StreamManager } from '@claudeflare/api-gateway-v3/streaming';

const manager = new StreamManager({
  maxConnections: 10000,
  bufferSize: 64 * 1024,
  heartbeatInterval: 30000,
  timeout: 120000,
  compression: true,
});

// Access components
const sseGateway = manager.getSSEGateway();
const wsGateway = manager.getWebSocketGateway();
const router = manager.getRouter();
const processor = manager.getProcessor();

// Get combined metrics
const metrics = manager.getMetrics();
console.log('SSE:', metrics.sse);
console.log('WebSocket:', metrics.websocket);

// Shutdown all
await manager.shutdown();
```

## Real-time Events

### Connection Events

```typescript
sseGateway.on('connection', (connection) => {
  console.log(`Client connected: ${connection.clientId}`);
});

sseGateway.on('disconnect', ({ connectionId, code, reason }) => {
  console.log(`Client disconnected: ${connectionId} (${code}: ${reason})`);
});
```

### Subscription Events

```typescript
sseGateway.on('subscribe', ({ connectionId, channel }) => {
  console.log(`Client ${connectionId} subscribed to ${channel}`);
});

sseGateway.on('unsubscribe', ({ connectionId, channel }) => {
  console.log(`Client ${connectionId} unsubscribed from ${channel}`);
});
```

### Message Events

```typescript
sseGateway.on('broadcast', ({ channel, message, sent }) => {
  console.log(`Broadcasted to ${sent} clients in ${channel}`);
});
```

## Backpressure Handling

The streaming gateways automatically handle backpressure:

- Configurable buffer size
- Automatic flow control
- Graceful handling of slow consumers

```typescript
const gateway = new SSEGateway({
  bufferSize: 128 * 1024, // 128KB buffer
  backpressure: true, // Enable backpressure handling
});
```

## Best Practices

1. **Use SSE** for server-to-client streaming
2. **Use WebSockets** for bidirectional communication
3. **Set appropriate timeouts** to prevent hanging connections
4. **Implement heartbeat** to detect dead connections
5. **Handle backpressure** for slow consumers
6. **Use channels** to organize message routing
7. **Monitor metrics** to track connection health
8. **Cleanup idle connections** regularly

## Examples

See the [examples directory](../examples/streaming.ts) for complete examples.
