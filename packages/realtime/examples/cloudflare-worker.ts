/**
 * Cloudflare Worker Example for ClaudeFlare Real-Time Communication
 *
 * This example demonstrates how to integrate the real-time communication
 * package with Cloudflare Workers and WebSockets.
 */

import { RealTime } from '../src/index';

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return await handleWebSocketUpgrade(request, env);
    }

    // Handle HTTP requests
    switch (url.pathname) {
      case '/':
        return new Response('ClaudeFlare Real-Time Communication', {
          headers: { 'Content-Type': 'text/plain' }
        });

      case '/stats':
        return handleStatsRequest();

      case '/health':
        return handleHealthCheck();

      default:
        return new Response('Not Found', { status: 404 });
    }
  }
};

// WebSocket upgrade handler
async function handleWebSocketUpgrade(request: Request, env: any): Promise<Response> {
  try {
    // Parse the connection ID from the URL
    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connectionId') || 'anonymous';
    const namespace = url.searchParams.get('namespace') || 'default';
    const userId = url.searchParams.get('userId');

    // Create WebSocket pair
    const { pairs } = await env.WS WebSocketPair();
    const [client, server] = pairs;

    // Accept the WebSocket
    const ws = await server.accept();

    // Initialize real-time system if not already done
    if (!global.realtimeSystem) {
      global.realtimeSystem = new RealTime({
        enableLogging: true,
        enableMetrics: true,
        websocket: {
          maxConnections: 10000,
          heartbeatInterval: 30000,
          heartbeatTimeout: 60000,
          compression: true
        },
        scalability: {
          instanceId: env.INSTANCE_ID || 'worker-1',
          clusterNodes: env.CLUSTER_NODES?.split(',') || [],
          enableLoadBalancing: true,
          enableAutoScaling: true
        }
      });

      await global.realtimeSystem.initialize();
    }

    const realtime = global.realtimeSystem;

    // Set up WebSocket event handlers
    ws.addEventListener('message', async (event) => {
      try {
        const message = event.data;

        // Handle different message types
        if (typeof message === 'string') {
          const data = JSON.parse(message);

          switch (data.type) {
            case 'subscribe':
              await handleSubscription(ws, data, realtime);
              break;

            case 'unsubscribe':
              await handleUnsubscription(ws, data, realtime);
              break;

            case 'publish':
              await handlePublish(ws, data, realtime);
              break;

            case 'presence':
              await handlePresenceUpdate(ws, data, realtime);
              break;

            default:
              await handleCustomMessage(ws, data, realtime);
          }
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendError(ws, {
          code: 'INVALID_MESSAGE_FORMAT',
          message: error.message,
          timestamp: Date.now()
        });
      }
    });

    ws.addEventListener('close', () => {
      console.log('WebSocket connection closed');
      // Clean up presence and connection
      if (userId) {
        realtime.getPresenceSystem().goOffline(userId);
      }
    });

    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Accept the connection
    ws.accept();

    // Initialize presence if user ID provided
    const connectionMetadata = {
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
      userAgent: request.headers.get('User-Agent')
    };

    const connId = await realtime.handleConnection(ws, namespace, userId, connectionMetadata);

    // Send connection established message
    sendConnectionEstablished(ws, connId, userId, namespace);

    console.log(`WebSocket connection established: ${connId}`);

    // Return early to keep the connection open
    return new Response(null, { status: 101, webSocket: client });

  } catch (error) {
    console.error('WebSocket upgrade failed:', error);
    return new Response('WebSocket upgrade failed', { status: 500 });
  }
}

// Handle subscription
async function handleSubscription(ws: WebSocket, data: any, realtime: RealTime): Promise<void> {
  const { channel, userId = 'anonymous' } = data;

  await realtime.getMultiplexer().subscribe(channel, userId, {
    userAgent: ws.getUserAgent?.() || 'unknown',
    timestamp: Date.now()
  });

  sendResponse(ws, {
    type: 'subscription:confirmed',
    channel,
    timestamp: Date.now()
  });
}

// Handle unsubscription
async function handleUnsubscription(ws: WebSocket, data: any, realtime: RealTime): Promise<void> {
  const { channel, userId = 'anonymous' } = data;

  await realtime.getMultiplexer().unsubscribe(channel, userId);

  sendResponse(ws, {
    type: 'unsubscription:confirmed',
    channel,
    timestamp: Date.now()
  });
}

// Handle publish
async function handlePublish(ws: WebSocket, data: any, realtime: RealTime): Promise<void> {
  const { channel, payload, broadcast = false, userId = 'anonymous' } = data;

  await realtime.getMultiplexer().publish(channel, payload, userId, broadcast);

  // Update user activity
  if (userId) {
    await realtime.getPresenceSystem().updateActivity(userId, {
      action: 'publish',
      channel
    });
  }

  sendResponse(ws, {
    type: 'publish:acknowledged',
    channel,
    messageId: data.id,
    timestamp: Date.now()
  });
}

// Handle presence update
async function handlePresenceUpdate(ws: WebSocket, data: any, realtime: RealTime): Promise<void> {
  const { status, userId = 'anonymous' } = data;

  if (status && ['online', 'away', 'busy', 'offline'].includes(status)) {
    await realtime.getPresenceSystem().updateStatus(userId, status);
  }

  const presence = realtime.getPresenceSystem().getUserPresence(userId);
  sendResponse(ws, {
    type: 'presence:updated',
    status: presence?.status,
    timestamp: Date.now()
  });
}

// Handle custom message
async function handleCustomMessage(ws: WebSocket, data: any, realtime: RealTime): Promise<void> {
  await realtime.getMultiplexer().publish('custom', data, 'system', false);

  sendResponse(ws, {
    type: 'message:processed',
    messageId: data.id,
    timestamp: Date.now()
  });
}

// Helper functions
function sendConnectionEstablished(ws: WebSocket, connectionId: string, userId?: string, namespace?: string): void {
  sendResponse(ws, {
    type: 'connection:established',
    connectionId,
    userId,
    namespace,
    timestamp: Date.now()
  });
}

function sendResponse(ws: WebSocket, data: any): void {
  try {
    ws.send(JSON.stringify(data));
  } catch (error) {
    console.error('Failed to send response:', error);
  }
}

function sendError(ws: WebSocket, error: any): void {
  sendResponse(ws, {
    type: 'error',
    ...error
  });
}

// Handle stats request
async function handleStatsRequest(): Promise<Response> {
  if (!global.realtimeSystem) {
    return new Response('System not initialized', { status: 503 });
  }

  const stats = global.realtimeSystem.getStats();
  return new Response(JSON.stringify(stats, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle health check
async function handleHealthCheck(): Promise<Response> {
  if (!global.realtimeSystem) {
    return new Response(JSON.stringify({
      healthy: false,
      message: 'System not initialized'
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const health = await global.realtimeSystem.getHealth();
  return new Response(JSON.stringify(health, null, 2), {
    headers: { 'Content-Type': 'application/json' },
    status: healthy.healthy ? 200 : 503
  });
}

// Export types for wrangler.toml
export {
  RealTime
};