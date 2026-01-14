/**
 * Streaming Example - Server-Sent Events and WebSockets
 */

import { StreamManager, SSEGateway, WebSocketGateway } from '../src/streaming/gateway.js';
import type { SSEMessage, WebSocketMessage } from '../src/types/index.js';

// Create stream manager
const streamManager = new StreamManager({
  maxConnections: 1000,
  bufferSize: 64 * 1024,
  heartbeatInterval: 30000,
  timeout: 120000,
  compression: true,
});

// Example 1: Server-Sent Events (SSE) - Real-time notifications
export async function handleSSEConnection(request: Request): Promise<Response> {
  const sseGateway = streamManager.getSSEGateway();
  const clientId = request.headers.get('X-Client-ID') || 'anonymous';

  // Create a writable stream for the response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Connect to SSE gateway
        const connectionId = await sseGateway.connect(
          clientId,
          new WritableStream({
            write(chunk) {
              controller.enqueue(chunk);
            },
            close() {
              controller.close();
            },
          })
        );

        // Subscribe to notification channel
        await sseGateway.subscribe(connectionId, 'notifications');

        // Send initial connection message
        await sseGateway.send(connectionId, {
          event: 'connected',
          data: JSON.stringify({
            connectionId,
            timestamp: Date.now(),
          }),
        });

        // Keep connection alive
        const heartbeatInterval = setInterval(async () => {
          try {
            await sseGateway.send(connectionId, {
              event: 'heartbeat',
              data: 'ping',
            });
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        // Cleanup on close
        request.signal?.addEventListener('abort', async () => {
          clearInterval(heartbeatInterval);
          await sseGateway.disconnect(connectionId);
        });
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Example 2: Broadcast notifications to all connected clients
export async function broadcastNotification(
  notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }
): Promise<number> {
  const sseGateway = streamManager.getSSEGateway();

  const message: SSEMessage = {
    event: 'notification',
    data: JSON.stringify(notification),
    id: `notif_${Date.now()}`,
  };

  return sseGateway.broadcast('notifications', message);
}

// Example 3: WebSocket connection handler
export async function handleWebSocketConnection(
  ws: WebSocket,
  clientId: string
): Promise<void> {
  const wsGateway = streamManager.getWebSocketGateway();

  // Accept WebSocket connection
  const connectionId = await wsGateway.accept(ws, clientId);

  // Subscribe to channels
  await wsGateway.subscribe(connectionId, 'messages');
  await wsGateway.subscribe(connectionId, 'updates');

  // Send welcome message
  await wsGateway.send(connectionId, {
    type: 'message',
    data: {
      event: 'connected',
      connectionId,
      timestamp: Date.now(),
    },
  });

  // Handle incoming messages
  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);

      // Echo message back
      await wsGateway.send(connectionId, {
        type: 'message',
        data: {
          event: 'echo',
          original: message,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      await wsGateway.send(connectionId, {
        type: 'error',
        data: {
          message: 'Invalid message format',
        },
      });
    }
  };
}

// Example 4: Send message to specific client
export async function sendDirectMessage(
  clientId: string,
  message: any
): Promise<void> {
  const wsGateway = streamManager.getWebSocketGateway();
  const connections = wsGateway.getClientConnections(clientId);

  for (const connection of connections) {
    await wsGateway.send(connection.id, {
      type: 'message',
      data: message,
    });
  }
}

// Example 5: Broadcast to channel
export async function broadcastToChannel(
  channel: string,
  message: any
): Promise<number> {
  const wsGateway = streamManager.getWebSocketGateway();
  return wsGateway.broadcast(channel, message);
}

// Example 6: Real-time analytics stream
export async function streamAnalytics(
  clientId: string,
  callback: (data: any) => void
): Promise<void> {
  const sseGateway = streamManager.getSSEGateway();

  // Create stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const connectionId = await sseGateway.connect(
          clientId,
          new WritableStream({
            write(chunk) {
              controller.enqueue(chunk);
            },
          })
        );

        await sseGateway.subscribe(connectionId, 'analytics');

        // Send periodic analytics updates
        const interval = setInterval(async () => {
          const analytics = await generateAnalytics();

          await sseGateway.send(connectionId, {
            event: 'analytics',
            data: JSON.stringify(analytics),
          });
        }, 5000);

        // Cleanup
        return () => {
          clearInterval(interval);
          sseGateway.disconnect(connectionId);
        };
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

// Helper function to generate analytics
async function generateAnalytics() {
  return {
    timestamp: Date.now(),
    requests: {
      total: Math.floor(Math.random() * 1000),
      success: Math.floor(Math.random() * 950),
      error: Math.floor(Math.random() * 50),
    },
    latency: {
      avg: Math.floor(Math.random() * 100) + 10,
      p95: Math.floor(Math.random() * 200) + 50,
      p99: Math.floor(Math.random() * 500) + 100,
    },
  };
}

// Example 7: Stream processing
export async function processDataStream(
  inputStream: ReadableStream,
  processor: (data: any) => Promise<any>
): Promise<any[]> {
  const streamProcessor = streamManager.getProcessor();

  return streamProcessor.process(inputStream, processor);
}

// Example 8: Stream chunking
export async function* chunkStream(
  stream: ReadableStream,
  chunkSize: number
): AsyncGenerator<Uint8Array> {
  const streamProcessor = streamManager.getProcessor();

  yield* streamProcessor.chunkStream(stream, chunkSize);
}

// Export metrics
export function getStreamingMetrics() {
  return streamManager.getMetrics();
}

// Export for cleanup
export async function shutdownStreaming() {
  await streamManager.shutdown();
}

export { streamManager };
