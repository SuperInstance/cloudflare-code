/**
 * Log Streaming - Real-time log streaming and event broadcasting
 */

import EventEmitter from 'eventemitter3';
import { WebSocket, WebSocketServer } from 'ws';
import { LogEntry, LogBatch, SearchQuery, StreamConfig, StreamEventType } from '../types';
import { createLogger } from '../utils/logger';
import { now } from '../utils/helpers';

export interface StreamClient {
  id: string;
  socket: WebSocket;
  filters?: StreamFilter[];
  connectedAt: number;
  lastActivity: number;
}

export interface StreamFilter {
  level?: number[];
  services?: string[];
  environments?: string[];
}

export interface StreamingEvents {
  'client:connected': StreamClient;
  'client:disconnected': { clientId: string; reason?: string };
  'log:streamed': { clientId: string; entry: LogEntry };
  'broadcast:sent': { clientCount: number };
  'stream:error': { error: Error; clientId?: string };
}

/**
 * Log Streaming Manager
 */
export class LogStreamingManager extends EventEmitter<StreamingEvents> {
  private logger = createLogger({ component: 'LogStreamingManager' });
  private config: Required<StreamConfig>;
  private wss?: WebSocketServer;
  private clients: Map<string, StreamClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: StreamConfig = {}) {
    super();

    this.config = {
      enabled: config.enabled ?? true,
      bufferSize: config.bufferSize ?? 100,
      flushInterval: config.flushInterval ?? 1000,
      retries: config.retries ?? 3,
      backoffMs: config.backoffMs ?? 1000,
    };

    if (this.config.enabled) {
      this.initializeHeartbeat();
    }

    this.logger.info('Log streaming manager initialized', {
      enabled: this.config.enabled,
    });
  }

  /**
   * Start WebSocket server
   */
  public startServer(port: number): void {
    if (!this.config.enabled) {
      this.logger.warn('Streaming is disabled, cannot start server');
      return;
    }

    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (socket: WebSocket, request) => {
      this.handleConnection(socket);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error', error);
      this.emit('stream:error', { error });
    });

    this.logger.info('WebSocket server started', { port });
  }

  /**
   * Handle new client connection
   */
  private handleConnection(socket: WebSocket): void {
    const clientId = this.generateClientId();

    const client: StreamClient = {
      id: clientId,
      socket,
      connectedAt: now(),
      lastActivity: now(),
    };

    this.clients.set(clientId, client);

    socket.on('message', (data: Buffer) => {
      this.handleMessage(clientId, data);
    });

    socket.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason.toString());
    });

    socket.on('error', (error) => {
      this.logger.error('Client socket error', { clientId, error });
      this.emit('stream:error', { error, clientId });
    });

    this.emit('client:connected', client);

    this.logger.info('Client connected', { clientId });
  }

  /**
   * Handle client message
   */
  private handleMessage(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = now();

    try {
      const message = JSON.parse(data.toString());

      // Handle filter updates
      if (message.type === 'update_filters' && message.filters) {
        client.filters = message.filters;
        this.logger.debug('Client filters updated', { clientId });
      }

      // Handle ping/pong
      if (message.type === 'ping') {
        this.sendToClient(clientId, { type: 'pong', timestamp: now() });
      }
    } catch (error) {
      this.logger.error('Failed to parse client message', error);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);

    this.emit('client:disconnected', {
      clientId,
      reason: reason || `code ${code}`,
    });

    this.logger.info('Client disconnected', { clientId, code, reason });
  }

  /**
   * Stream log entry to matching clients
   */
  public streamEntry(entry: LogEntry): void {
    if (!this.config.enabled || this.clients.size === 0) {
      return;
    }

    let sentCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (this.matchesFilters(entry, client.filters)) {
        this.sendToClient(clientId, {
          type: StreamEventType.LOG_RECEIVED,
          data: entry,
          timestamp: now(),
        });
        sentCount++;
      }
    }

    if (sentCount > 0) {
      this.emit('broadcast:sent', { clientCount: sentCount });
    }
  }

  /**
   * Stream batch to clients
   */
  public streamBatch(batch: LogBatch): void {
    if (!this.config.enabled || this.clients.size === 0) {
      return;
    }

    const message = {
      type: StreamEventType.BATCH_FLUSHED,
      data: {
        batchId: batch.metadata.batchId,
        count: batch.metadata.count,
        timestamp: batch.metadata.timestamp,
      },
      timestamp: now(),
    };

    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Stream search results to clients
   */
  public streamSearchResults(query: SearchQuery, results: any): void {
    if (!this.config.enabled || this.clients.size === 0) {
      return;
    }

    const message = {
      type: StreamEventType.SEARCH_COMPLETED,
      data: {
        query,
        results: {
          total: results.total,
          count: results.entries.length,
          took: results.took,
        },
      },
      timestamp: now(),
    };

    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Check if entry matches client filters
   */
  private matchesFilters(entry: LogEntry, filters?: StreamFilter[]): boolean {
    if (!filters || filters.length === 0) {
      return true;
    }

    return filters.some((filter) => {
      if (filter.level && filter.level.length > 0) {
        if (!filter.level.includes(entry.level)) {
          return false;
        }
      }

      if (filter.services && filter.services.length > 0) {
        if (!filter.services.includes(entry.service)) {
          return false;
        }
      }

      if (filter.environments && filter.environments.length > 0) {
        if (!entry.environment || !filter.environments.includes(entry.environment)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.socket.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error('Failed to send to client', { clientId, error });
    }
  }

  /**
   * Broadcast message to all clients
   */
  public broadcast(message: any): void {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Initialize heartbeat
   */
  private initializeHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeat();
    }, 30000); // Every 30 seconds
  }

  /**
   * Check client heartbeat
   */
  private checkHeartbeat(): void {
    const timeout = 60000; // 1 minute timeout
    const now = Date.now();

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastActivity > timeout) {
        this.logger.debug('Client timeout, disconnecting', { clientId });
        client.socket.terminate();
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected clients count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client info
   */
  public getClients(): Array<{ id: string; connectedAt: number; lastActivity: number }> {
    return Array.from(this.clients.values()).map((client) => ({
      id: client.id,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
    }));
  }

  /**
   * Disconnect a client
   */
  public disconnectClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.socket.close();
    this.clients.delete(clientId);

    this.logger.info('Client disconnected by server', { clientId });
    return true;
  }

  /**
   * Shutdown streaming manager
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down streaming manager');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      client.socket.close();
    }

    this.clients.clear();

    // Close server
    if (this.wss) {
      this.wss.close();
    }

    this.logger.info('Streaming manager shutdown complete');
  }
}

/**
 * Create a log streaming manager instance
 */
export function createLogStreamingManager(config?: StreamConfig): LogStreamingManager {
  return new LogStreamingManager(config);
}
