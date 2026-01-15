/**
 * Real-Time Communication System - Optimized
 */

import { WebSocketManager } from './websocket/manager';
import { Multiplexer } from './multiplexer/multiplexer';
import { PresenceSystem } from './presence/system';
import { ScalabilityEngine } from './scalability/engine';

export interface RealTimeConfig {
  websocket?: any;
  multiplexer?: any;
  presence?: any;
  scalability?: any;
  enableLogging?: boolean;
}

export class RealTime {
  private websocketManager: WebSocketManager;
  private multiplexer: Multiplexer;
  private presenceSystem: PresenceSystem;
  private scalabilityEngine: ScalabilityEngine;

  constructor(config: RealTimeConfig = {}) {
    this.websocketManager = new WebSocketManager(config.websocket || {});
    this.multiplexer = new Multiplexer(config.multiplexer || {});
    this.presenceSystem = new PresenceSystem(config.presence || {});
    this.scalabilityEngine = new ScalabilityEngine(config.scalability || {});
    this.setupEventBridging();
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.websocketManager.getHealth(),
      this.multiplexer.getStats(),
      this.presenceSystem.getStats(),
      this.scalabilityEngine.getHealth()
    ]);
  }

  async handleConnection(socket: WebSocket, namespace: string, userId?: string, metadata: any = {}): Promise<string> {
    const connectionId = await this.websocketManager.acceptConnection(socket, namespace, userId, metadata);
    if (userId) await this.presenceSystem.initializePresence(userId, connectionId, { connectionId, metadata });
    return connectionId;
  }

  async handleMessage(connectionId: string, data: any): Promise<void> {
    const message = typeof data === 'string' ? JSON.parse(data) : data;
    const connection = this.websocketManager.getConnection(connectionId);
    if (!connection) return;

    switch (message.type) {
      case 'subscribe': await this.handleSubscribe(connection, message); break;
      case 'unsubscribe': await this.handleUnsubscribe(connection, message); break;
      case 'publish': await this.handlePublish(connection, message); break;
      case 'presence': await this.handlePresenceUpdate(connection, message); break;
    }
  }

  private async handleSubscribe(connection: any, message: any): Promise<void> {
    const { channel } = message;
    await this.multiplexer.subscribe(channel, connection.userId || connection.id, { connectionId: connection.id });
    await this.websocketManager.sendMessage(connection, { type: 'subscription:confirmed', channel });
  }

  private async handleUnsubscribe(connection: any, message: any): Promise<void> {
    await this.multiplexer.unsubscribe(message.channel, connection.userId || connection.id);
    await this.websocketManager.sendMessage(connection, { type: 'unsubscription:confirmed', channel: message.channel });
  }

  private async handlePublish(connection: any, message: any): Promise<void> {
    await this.multiplexer.publish(message.channel, message.payload, connection.id, message.broadcast);
    await this.websocketManager.sendMessage(connection, { type: 'publish:acknowledged', channel: message.channel });
  }

  private async handlePresenceUpdate(connection: any, message: any): Promise<void> {
    if (connection.userId && message.status) await this.presenceSystem.updateStatus(connection.userId, message.status);
  }

  private setupEventBridging(): void {
    this.websocketManager.on('message', async (event: any) => {
      if (event.message?.channel) await this.multiplexer.publish(event.message.channel, event.message, event.connectionId, false);
    });

    this.presenceSystem.on('status:change', async (event: any) => {
      const connections = this.websocketManager.getConnectionsByUser(event.userId);
      for (const connection of connections) {
        await this.websocketManager.sendMessage(connection, { type: 'presence:status_changed', userId: event.userId, status: event.newStatus });
      }
    });
  }

  getStats(): any {
    return {
      websocket: this.websocketManager.getStats(),
      multiplexer: this.multiplexer.getStats(),
      presence: this.presenceSystem.getStats(),
      scalability: this.scalabilityEngine.getClusterStats()
    };
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.websocketManager.dispose(),
      this.multiplexer.dispose(),
      this.presenceSystem.dispose(),
      this.scalabilityEngine.dispose()
    ]);
  }
}

export function createRealTime(config: RealTimeConfig = {}): RealTime {
  return new RealTime(config);
}
