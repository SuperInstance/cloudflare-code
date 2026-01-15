/**
 * Real-time collaboration WebSocket handler
 */

import { Server } from 'ws';
import { WebSocket } from 'ws';
import { UserPresence, CollaborationEvent } from '../types';

export class WebSocketManager {
  private wss: Server;
  private rooms = new Map<string, Set<WebSocket>>();
  private presences = new Map<string, UserPresence>();

  constructor(server: any) {
    this.wss = new Server({ server });
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const tenantId = this.extractTenantId(req);
      if (!tenantId) {
        ws.close(4000, 'Invalid tenant');
        return;
      }

      this.joinRoom(ws, tenantId);

      ws.on('message', (data) => {
        try {
          const event: CollaborationEvent = JSON.parse(data.toString());
          this.handleEvent(ws, tenantId, event);
        } catch (error) {
          console.error('WebSocket error:', error);
        }
      });

      ws.on('close', () => {
        this.leaveRoom(ws, tenantId);
        this.removeUserPresence(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.leaveRoom(ws, tenantId);
      });
    });
  }

  private extractTenantId(req: any): string | null {
    // Extract tenant from query params or subprotocol
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('tenantId');
  }

  private joinRoom(ws: WebSocket, roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(ws);
  }

  private leaveRoom(ws: WebSocket, roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  private handleEvent(ws: WebSocket, tenantId: string, event: CollaborationEvent) {
    switch (event.type) {
      case 'join':
        this.handleJoin(ws, tenantId, event);
        break;
      case 'leave':
        this.handleLeave(ws, tenantId, event);
        break;
      case 'move':
      case 'select':
      case 'edit':
      case 'connection':
        this.broadcastToRoom(tenantId, event, ws);
        break;
    }
  }

  private handleJoin(ws: WebSocket, tenantId: string, event: CollaborationEvent) {
    const presence: UserPresence = {
      userId: event.userId,
      userName: event.userName,
      cursor: { x: 0, y: 0 },
      selection: [],
      lastSeen: Date.now(),
    };

    this.presences.set(`${tenantId}:${event.userId}`, presence);
    this.broadcastToRoom(tenantId, event, ws);
  }

  private handleLeave(ws: WebSocket, tenantId: string, event: CollaborationEvent) {
    this.presences.delete(`${tenantId}:${event.userId}`);
    this.broadcastToRoom(tenantId, event, ws);
  }

  private broadcastToRoom(tenantId: string, event: CollaborationEvent, sender?: WebSocket) {
    const room = this.rooms.get(tenantId);
    if (room) {
      const message = JSON.stringify(event);
      room.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  private removeUserPresence(ws: WebSocket) {
    // Remove user from all presences
    for (const [key, presence] of this.presences.entries()) {
      if (presence.userId === ws.userId) {
        this.presences.delete(key);
      }
    }
  }

  broadcastToUser(userId: string, event: CollaborationEvent) {
    // Implementation for broadcasting to specific user
  }

  getRoomPresence(roomId: string): UserPresence[] {
    return Array.from(this.presences.values())
      .filter(p => p.lastSeen > Date.now() - 30000) // Active in last 30 seconds
      .map(p => ({ ...p, cursor: undefined })); // Remove cursor for privacy
  }
}