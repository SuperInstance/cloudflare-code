/**
 * Streaming Gateway - Real-time streaming and event processing
 *
 * Supports:
 * - Server-Sent Events (SSE)
 * - WebSocket proxying and management
 * - Stream processing and transformation
 * - Backpressure handling
 * - Stream routing and distribution
 */

import {
  StreamConfig,
  SSEMessage,
  WebSocketMessage,
  StreamSession,
  GatewayError,
} from '../types/index.js';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface StreamGatewayConfig {
  maxConnections: number;
  bufferSize: number;
  heartbeatInterval: number;
  timeout: number;
  compression: boolean;
  metrics: {
    enabled: boolean;
  };
}

export interface SSEConnection {
  id: string;
  clientId: string;
  channels: Set<string>;
  headers: Headers;
  createdAt: number;
  lastActivity: number;
  writable: WritableStream;
  writer?: WritableStreamDefaultWriter;
}

export interface WebSocketConnection extends SSEConnection {
  socket: WebSocket;
  state: 'connecting' | 'open' | 'closing' | 'closed';
  closeCode?: number;
  closeReason?: string;
}

export interface StreamRouterConfig {
  routes: StreamRoute[];
  fallback?: StreamFallback;
}

export interface StreamRoute {
  pattern: string | RegExp;
  target: string;
  transform?: StreamTransform;
  buffer?: boolean;
  compression?: boolean;
}

export interface StreamTransform {
  type: 'json' | 'text' | 'binary' | 'custom';
  encoder?: (data: unknown) => string | Uint8Array;
  decoder?: (data: string | Uint8Array) => unknown;
  filter?: (data: unknown) => boolean;
  middleware?: Array<(data: unknown) => Promise<unknown>>;
}

export interface StreamFallback {
  type: 'error' | 'default' | 'redirect';
  value?: unknown;
  url?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: StreamGatewayConfig = {
  maxConnections: 10000,
  bufferSize: 64 * 1024, // 64KB
  heartbeatInterval: 30000,
  timeout: 120000,
  compression: true,
  metrics: {
    enabled: true,
  },
};

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

// ============================================================================
// Metrics
// ============================================================================

interface StreamMetrics {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  totalBytes: number;
  errors: number;
  disconnections: number;
}

// ============================================================================
// SSE Gateway
// ============================================================================

export class SSEGateway extends EventEmitter {
  private config: StreamGatewayConfig;
  private connections: Map<string, SSEConnection>;
  private clientChannels: Map<string, Set<string>>;
  private metrics: StreamMetrics;
  private heartbeatTimer?: number;

  constructor(config: Partial<StreamGatewayConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connections = new Map();
    this.clientChannels = new Map();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalMessages: 0,
      totalBytes: 0,
      errors: 0,
      disconnections: 0,
    };

    this.startHeartbeat();
  }

  /**
   * Create SSE connection
   */
  async connect(
    clientId: string,
    writable: WritableStream,
    headers: Headers = new Headers()
  ): Promise<string> {
    if (this.connections.size >= this.config.maxConnections) {
      throw new GatewayError(
        'Maximum connections exceeded',
        'MAX_CONNECTIONS',
        503
      );
    }

    const connectionId = this.generateConnectionId();
    const connection: SSEConnection = {
      id: connectionId,
      clientId,
      channels: new Set(),
      headers,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      writable,
    };

    try {
      connection.writer = writable.getWriter();
      await this.writeHeaders(connection.writer, {
        ...SSE_HEADERS,
        ...Object.fromEntries(headers.entries()),
      });

      this.connections.set(connectionId, connection);
      this.metrics.totalConnections++;
      this.metrics.activeConnections++;

      this.emit('connection', connection);

      return connectionId;
    } catch (error) {
      this.metrics.errors++;
      throw new GatewayError(
        `Failed to create SSE connection: ${(error as Error).message}`,
        'SSE_CONNECTION_FAILED'
      );
    }
  }

  /**
   * Subscribe client to channel
   */
  async subscribe(connectionId: string, channel: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new GatewayError('Connection not found', 'CONNECTION_NOT_FOUND', 404);
    }

    connection.channels.add(channel);
    connection.lastActivity = Date.now();

    if (!this.clientChannels.has(channel)) {
      this.clientChannels.set(channel, new Set());
    }
    this.clientChannels.get(channel)!.add(connectionId);

    this.emit('subscribe', { connectionId, channel });
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(connectionId: string, channel: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.channels.delete(channel);
    connection.lastActivity = Date.now();

    const channelClients = this.clientChannels.get(channel);
    if (channelClients) {
      channelClients.delete(connectionId);
      if (channelClients.size === 0) {
        this.clientChannels.delete(channel);
      }
    }

    this.emit('unsubscribe', { connectionId, channel });
  }

  /**
   * Broadcast message to channel
   */
  async broadcast(channel: string, message: SSEMessage): Promise<number> {
    const clients = this.clientChannels.get(channel);
    if (!clients || clients.size === 0) {
      return 0;
    }

    let sent = 0;
    const errors: string[] = [];

    for (const connectionId of clients) {
      try {
        await this.send(connectionId, message);
        sent++;
      } catch (error) {
        errors.push(connectionId);
        this.metrics.errors++;
      }
    }

    // Clean up failed connections
    for (const connectionId of errors) {
      await this.disconnect(connectionId);
    }

    this.metrics.totalMessages += sent;
    this.emit('broadcast', { channel, message, sent });

    return sent;
  }

  /**
   * Send message to specific connection
   */
  async send(connectionId: string, message: SSEMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.writer) {
      throw new GatewayError('Connection not found', 'CONNECTION_NOT_FOUND', 404);
    }

    try {
      const data = this.formatSSEMessage(message);
      const encoder = new TextEncoder();
      const chunk = encoder.encode(data);

      await connection.writer.write(chunk);
      connection.lastActivity = Date.now();
      this.metrics.totalMessages++;
      this.metrics.totalBytes += chunk.length;
    } catch (error) {
      this.metrics.errors++;
      throw new GatewayError(
        `Failed to send message: ${(error as Error).message}`,
        'SEND_FAILED'
      );
    }
  }

  /**
   * Disconnect client
   */
  async disconnect(connectionId: string, code?: number, reason?: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      // Unsubscribe from all channels
      for (const channel of connection.channels) {
        const channelClients = this.clientChannels.get(channel);
        if (channelClients) {
          channelClients.delete(connectionId);
          if (channelClients.size === 0) {
            this.clientChannels.delete(channel);
          }
        }
      }

      // Close writer
      if (connection.writer) {
        try {
          await connection.writer.close();
        } catch {
          // Ignore close errors
        }
      }

      this.connections.delete(connectionId);
      this.metrics.activeConnections--;
      this.metrics.disconnections++;

      this.emit('disconnect', { connectionId, code, reason });
    } catch (error) {
      this.metrics.errors++;
    }
  }

  /**
   * Get connection info
   */
  getConnection(connectionId: string): SSEConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get active connections for client
   */
  getClientConnections(clientId: string): SSEConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.clientId === clientId
    );
  }

  /**
   * Get metrics
   */
  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  /**
   * Clean up idle connections
   */
  async cleanupIdle(idleTimeout: number): Promise<number> {
    const now = Date.now();
    const toDisconnect: string[] = [];

    for (const [id, connection] of this.connections) {
      if (now - connection.lastActivity > idleTimeout) {
        toDisconnect.push(id);
      }
    }

    for (const id of toDisconnect) {
      await this.disconnect(id, 1000, 'Idle timeout');
    }

    return toDisconnect.length;
  }

  /**
   * Shutdown gateway
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    const connectionIds = Array.from(this.connections.keys());
    await Promise.all(
      connectionIds.map((id) => this.disconnect(id, 1001, 'Server shutdown'))
    );

    this.connections.clear();
    this.clientChannels.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private formatSSEMessage(message: SSEMessage): string {
    let formatted = '';

    if (message.id) {
      formatted += `id: ${message.id}\n`;
    }

    if (message.event) {
      formatted += `event: ${message.event}\n`;
    }

    if (message.retry) {
      formatted += `retry: ${message.retry}\n`;
    }

    // Split data by newlines and prefix with "data: "
    const lines = message.data.split('\n');
    for (const line of lines) {
      formatted += `data: ${line}\n`;
    }

    formatted += '\n';
    return formatted;
  }

  private async writeHeaders(
    writer: WritableStreamDefaultWriter,
    headers: Record<string, string>
  ): Promise<void> {
    const headerString = Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');

    const encoder = new TextEncoder();
    await writer.write(encoder.encode(`${headerString}\r\n\r\n`));
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      const comment = ': heartbeat\n\n';
      const encoder = new TextEncoder();
      const chunk = encoder.encode(comment);

      for (const [id, connection] of this.connections) {
        if (connection.writer) {
          connection.writer.write(chunk).catch(() => {
            // Connection likely dead, will be cleaned up
          });
        }
      }
    }, this.config.heartbeatInterval) as unknown as number;
  }

  private generateConnectionId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// WebSocket Gateway
// ============================================================================

export class WebSocketGateway extends EventEmitter {
  private config: StreamGatewayConfig;
  private connections: Map<string, WebSocketConnection>;
  private clientChannels: Map<string, Set<string>>;
  private metrics: StreamMetrics;

  constructor(config: Partial<StreamGatewayConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connections = new Map();
    this.clientChannels = new Map();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalMessages: 0,
      totalBytes: 0,
      errors: 0,
      disconnections: 0,
    };
  }

  /**
   * Accept WebSocket connection
   */
  async accept(
    socket: WebSocket,
    clientId: string,
    headers: Headers = new Headers()
  ): Promise<string> {
    if (this.connections.size >= this.config.maxConnections) {
      socket.close(1008, 'Maximum connections exceeded');
      throw new GatewayError(
        'Maximum connections exceeded',
        'MAX_CONNECTIONS',
        503
      );
    }

    const connectionId = this.generateConnectionId();
    const connection: WebSocketConnection = {
      id: connectionId,
      clientId,
      channels: new Set(),
      headers,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      writable: new WritableStream(),
      socket,
      state: 'open',
    };

    this.connections.set(connectionId, connection);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    // Setup socket handlers
    socket.onmessage = (event) => this.handleMessage(connectionId, event);
    socket.onclose = (event) => this.handleClose(connectionId, event);
    socket.onerror = (error) => this.handleError(connectionId, error);

    this.emit('connection', connection);

    return connectionId;
  }

  /**
   * Subscribe to channel
   */
  async subscribe(connectionId: string, channel: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.state !== 'open') {
      throw new GatewayError('Connection not found', 'CONNECTION_NOT_FOUND', 404);
    }

    connection.channels.add(channel);
    connection.lastActivity = Date.now();

    if (!this.clientChannels.has(channel)) {
      this.clientChannels.set(channel, new Set());
    }
    this.clientChannels.get(channel)!.add(connectionId);

    // Send subscription confirmation
    this.send(connectionId, {
      type: 'message',
      data: { event: 'subscribed', channel },
    });

    this.emit('subscribe', { connectionId, channel });
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(connectionId: string, channel: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.channels.delete(channel);
    connection.lastActivity = Date.now();

    const channelClients = this.clientChannels.get(channel);
    if (channelClients) {
      channelClients.delete(connectionId);
      if (channelClients.size === 0) {
        this.clientChannels.delete(channel);
      }
    }

    // Send unsubscribe confirmation
    if (connection.state === 'open') {
      this.send(connectionId, {
        type: 'message',
        data: { event: 'unsubscribed', channel },
      });
    }

    this.emit('unsubscribe', { connectionId, channel });
  }

  /**
   * Broadcast to channel
   */
  async broadcast(channel: string, message: unknown): Promise<number> {
    const clients = this.clientChannels.get(channel);
    if (!clients || clients.size === 0) {
      return 0;
    }

    let sent = 0;
    const errors: string[] = [];

    for (const connectionId of clients) {
      try {
        await this.send(connectionId, {
          type: 'message',
          data: message,
        });
        sent++;
      } catch (error) {
        errors.push(connectionId);
        this.metrics.errors++;
      }
    }

    // Clean up failed connections
    for (const connectionId of errors) {
      await this.disconnect(connectionId, 1011, 'Send failed');
    }

    this.metrics.totalMessages += sent;
    this.emit('broadcast', { channel, message, sent });

    return sent;
  }

  /**
   * Send to specific connection
   */
  async send(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.state !== 'open') {
      throw new GatewayError('Connection not found or closed', 'CONNECTION_CLOSED', 404);
    }

    try {
      const data = JSON.stringify(message);
      connection.socket.send(data);
      connection.lastActivity = Date.now();
      this.metrics.totalMessages++;
      this.metrics.totalBytes += data.length;
    } catch (error) {
      this.metrics.errors++;
      throw new GatewayError(
        `Failed to send message: ${(error as Error).message}`,
        'SEND_FAILED'
      );
    }
  }

  /**
   * Close connection
   */
  async disconnect(
    connectionId: string,
    code: number = 1000,
    reason: string = ''
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      // Unsubscribe from all channels
      for (const channel of connection.channels) {
        const channelClients = this.clientChannels.get(channel);
        if (channelClients) {
          channelClients.delete(connectionId);
          if (channelClients.size === 0) {
            this.clientChannels.delete(channel);
          }
        }
      }

      // Close socket
      if (connection.state === 'open') {
        connection.socket.close(code, reason);
        connection.state = 'closing';
      }

      this.connections.delete(connectionId);
      this.metrics.activeConnections--;
      this.metrics.disconnections++;

      this.emit('disconnect', { connectionId, code, reason });
    } catch (error) {
      this.metrics.errors++;
    }
  }

  /**
   * Get connection info
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get metrics
   */
  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private handleMessage(connectionId: string, event: MessageEvent): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.lastActivity = Date.now();

    try {
      let message: WebSocketMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        message = {
          type: 'message',
          data: event.data,
        };
      }

      this.emit('message', { connectionId, message });
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', { connectionId, error });
    }
  }

  private handleClose(connectionId: string, event: CloseEvent): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.state = 'closed';
    connection.closeCode = event.code;
    connection.closeReason = event.reason;

    // Unsubscribe from all channels
    for (const channel of connection.channels) {
      const channelClients = this.clientChannels.get(channel);
      if (channelClients) {
        channelClients.delete(connectionId);
        if (channelClients.size === 0) {
          this.clientChannels.delete(channel);
        }
      }
    }

    this.connections.delete(connectionId);
    this.metrics.activeConnections--;
    this.metrics.disconnections++;

    this.emit('disconnect', {
      connectionId,
      code: event.code,
      reason: event.reason,
    });
  }

  private handleError(connectionId: string, error: Event): void {
    this.metrics.errors++;
    this.emit('error', { connectionId, error });
  }

  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Stream Router
// ============================================================================

export class StreamRouter {
  private routes: StreamRoute[];
  private fallback?: StreamFallback;

  constructor(config: StreamRouterConfig) {
    this.routes = config.routes;
    this.fallback = config.fallback;
  }

  /**
   * Route stream to target
   */
  async route(
    stream: ReadableStream,
    pattern: string
  ): Promise<ReadableStream> {
    const route = this.findRoute(pattern);
    if (!route) {
      return this.handleFallback(stream);
    }

    let transformedStream = stream;

    if (route.transform) {
      transformedStream = this.applyTransform(stream, route.transform);
    }

    return transformedStream;
  }

  /**
   * Add route
   */
  addRoute(route: StreamRoute): void {
    this.routes.push(route);
  }

  /**
   * Remove route
   */
  removeRoute(pattern: string): boolean {
    const index = this.routes.findIndex(
      (r) => r.pattern === pattern || r.pattern.toString() === pattern
    );
    if (index >= 0) {
      this.routes.splice(index, 1);
      return true;
    }
    return false;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private findRoute(pattern: string): StreamRoute | undefined {
    return this.routes.find((route) => {
      if (typeof route.pattern === 'string') {
        return route.pattern === pattern;
      } else {
        return route.pattern.test(pattern);
      }
    });
  }

  private applyTransform(
    stream: ReadableStream,
    transform: StreamTransform
  ): ReadableStream {
    const transformStream = new TransformStream({
      start(controller) {
        // Initialization
      },
      async transform(chunk, controller) {
        try {
          let data: unknown;

          // Decode chunk
          if (transform.decoder) {
            data = transform.decoder(chunk);
          } else {
            const decoder = new TextDecoder();
            const text = decoder.decode(chunk);
            data = text;
          }

          // Filter
          if (transform.filter && !transform.filter(data)) {
            return;
          }

          // Middleware
          if (transform.middleware) {
            for (const mw of transform.middleware) {
              data = await mw(data);
            }
          }

          // Encode
          let output: string | Uint8Array;
          if (transform.encoder) {
            output = transform.encoder(data);
          } else {
            output = JSON.stringify(data);
          }

          if (typeof output === 'string') {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(output));
          } else {
            controller.enqueue(output);
          }
        } catch (error) {
          controller.error(error);
        }
      },
      flush(controller) {
        controller.terminate();
      },
    });

    return stream.pipeThrough(transformStream);
  }

  private handleFallback(stream: ReadableStream): ReadableStream {
    if (!this.fallback) {
      return stream;
    }

    switch (this.fallback.type) {
      case 'error':
        throw new GatewayError('No matching route found', 'ROUTE_NOT_FOUND', 404);

      case 'default':
        return new ReadableStream({
          start(controller) {
            if (this.fallback?.value !== undefined) {
              controller.enqueue(this.fallback.value);
            }
            controller.close();
          },
        });

      case 'redirect':
        // In a real implementation, this would return a redirect response
        throw new GatewayError(
          `Redirect to: ${this.fallback.url}`,
          'REDIRECT',
          302
        );

      default:
        return stream;
    }
  }
}

// ============================================================================
// Stream Processor
// ============================================================================

export class StreamProcessor {
  private bufferSize: number;
  private backpressureThreshold: number;

  constructor(
    bufferSize: number = 64 * 1024,
    backpressureThreshold: number = 0.8
  ) {
    this.bufferSize = bufferSize;
    this.backpressureThreshold = backpressureThreshold;
  }

  /**
   * Process stream with backpressure handling
   */
  async process(
    stream: ReadableStream,
    processor: (chunk: unknown) => Promise<unknown>
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    const reader = stream.getReader();
    let buffer: Uint8Array[] = [];
    let bufferSize = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer.push(value);
        bufferSize += value.length;

        // Check backpressure
        if (bufferSize > this.bufferSize * this.backpressureThreshold) {
          await this.flushBuffer(buffer, processor, results);
          buffer = [];
          bufferSize = 0;
        }
      }

      // Flush remaining buffer
      if (buffer.length > 0) {
        await this.flushBuffer(buffer, processor, results);
      }

      return results;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Split stream into chunks
   */
  async *chunkStream(
    stream: ReadableStream,
    chunkSize: number
  ): AsyncGenerator<Uint8Array> {
    const reader = stream.getReader();
    let buffer = new Uint8Array(0);

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer.length > 0) {
            yield buffer;
          }
          break;
        }

        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;

        while (buffer.length >= chunkSize) {
          const chunk = buffer.slice(0, chunkSize);
          buffer = buffer.slice(chunkSize);
          yield chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async flushBuffer(
    buffer: Uint8Array[],
    processor: (chunk: unknown) => Promise<unknown>,
    results: unknown[]
  ): Promise<void> {
    const combined = this.combineChunks(buffer);
    const result = await processor(combined);
    results.push(result);
  }

  private combineChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined;
  }
}

// ============================================================================
// Stream Manager
// ============================================================================

export class StreamManager {
  private sseGateway: SSEGateway;
  private wsGateway: WebSocketGateway;
  private router: StreamRouter;
  private processor: StreamProcessor;

  constructor(config: Partial<StreamGatewayConfig> = {}) {
    this.sseGateway = new SSEGateway(config);
    this.wsGateway = new WebSocketGateway(config);
    this.router = new StreamRouter({ routes: [] });
    this.processor = new StreamProcessor(
      config.bufferSize || 64 * 1024
    );
  }

  getSSEGateway(): SSEGateway {
    return this.sseGateway;
  }

  getWebSocketGateway(): WebSocketGateway {
    return this.wsGateway;
  }

  getRouter(): StreamRouter {
    return this.router;
  }

  getProcessor(): StreamProcessor {
    return this.processor;
  }

  /**
   * Get combined metrics
   */
  getMetrics(): {
    sse: StreamMetrics;
    websocket: StreamMetrics;
  } {
    return {
      sse: this.sseGateway.getMetrics(),
      websocket: this.wsGateway.getMetrics(),
    };
  }

  /**
   * Shutdown all streaming components
   */
  async shutdown(): Promise<void> {
    await Promise.all([
      this.sseGateway.shutdown(),
      Promise.all(
        Array.from(this.wsGateway['connections'].keys()).map((id) =>
          this.wsGateway.disconnect(id, 1001, 'Server shutdown')
        )
      ),
    ]);
  }
}
