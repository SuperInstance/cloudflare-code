// @ts-nocheck
/**
 * Server-Sent Events (SSE) Data Ingestion
 * Handles data ingestion from SSE streams
 */

import type {
  SSEConfig,
  AuthConfig,
  StreamEvent
} from '../types';

export interface SSEIngestorConfig {
  id: string;
  config: SSEConfig;
}

export class SSEIngestor {
  private config: SSEIngestorConfig;
  private eventSource: EventSource | null = null;
  private controller: AbortController | null = null;
  private retryTimer: number | null = null;
  private reconnectAttempts = 0;

  constructor(config: SSEIngestorConfig) {
    this.config = config;
  }

  /**
   * Connect to SSE stream
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      // Build URL with auth params if needed
      const url = this.buildUrl();

      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log(`SSE connection opened: ${this.config.id}`);
        this.reconnectAttempts = 0;
      };

      this.eventSource.onerror = (error) => {
        console.error(`SSE connection error: ${this.config.id}`, error);

        // Attempt to reconnect
        if (this.config.config.reconnectInterval) {
          this.scheduleReconnect();
        }
      };

      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      throw error;
    }
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  /**
   * Listen to specific event type
   */
  on(eventType: string, handler: (event: StreamEvent) => void): void {
    if (!this.eventSource) {
      throw new Error('SSE connection not established');
    }

    this.eventSource.addEventListener(eventType, (event) => {
      this.handleMessage(event as MessageEvent);
    });
  }

  /**
   * Build SSE URL with authentication
   */
  private buildUrl(): string {
    let url = this.config.config.url;

    // Add auth as query params if using bearer token
    if (this.config.config.auth?.type === 'bearer') {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}token=${this.config.config.auth.credentials?.token || ''}`;
    }

    return url;
  }

  /**
   * Handle incoming SSE message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      let data: unknown;

      // Try to parse as JSON first
      try {
        data = JSON.parse(event.data);
      } catch {
        // If not JSON, use raw data
        data = event.data;
      }

      // Create stream event
      const streamEvent = this.createEvent(data, event);

      // Emit to handlers (would be implemented with proper event emitter)
      this.emit('data', streamEvent);
    } catch (error) {
      console.error('Error handling SSE message:', error);
    }
  }

  /**
   * Create stream event from SSE data
   */
  private createEvent(data: unknown, messageEvent: MessageEvent): StreamEvent {
    return {
      key: this.generateKey(data),
      value: data,
      timestamp: new Date(),
      headers: {
        'Content-Type': 'text/event-stream',
        'Last-Event-ID': messageEvent.lastEventId || ''
      },
      metadata: {
        source: this.config.id,
        sourceType: 'sse',
        eventType: messageEvent.type || 'message'
      }
    };
  }

  /**
   * Generate unique key for data
   */
  private generateKey(data: unknown): string {
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      for (const key of ['id', 'event_id', 'message_id']) {
        if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
          return `${this.config.id}-${obj[key]}`;
        }
      }
    }

    return `${this.config.id}-${Date.now()}-${Math.random()}`;
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.retryTimer !== null) {
      return;
    }

    const interval = this.config.config.reconnectInterval || 5000;
    const backoff = interval * Math.pow(2, this.reconnectAttempts);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, Math.min(backoff, 60000)); // Max 60 seconds
  }

  /**
   * Emit event (simplified implementation)
   */
  private emit(event: string, data: StreamEvent): void {
    // In a real implementation, this would use an event emitter
    console.log(`Emitting ${event}:`, data);
  }
}

/**
 * SSE manager for managing multiple SSE connections
 */
export class SSEManager {
  private connections: Map<string, SSEIngestor> = new Map();

  register(config: SSEIngestorConfig): void {
    const sse = new SSEIngestor(config);
    this.connections.set(config.id, sse);
    sse.connect();
  }

  unregister(id: string): void {
    const sse = this.connections.get(id);
    if (sse) {
      sse.disconnect();
      this.connections.delete(id);
    }
  }

  get(id: string): SSEIngestor | undefined {
    return this.connections.get(id);
  }

  disconnectAll(): void {
    for (const sse of this.connections.values()) {
      sse.disconnect();
    }
    this.connections.clear();
  }
}
