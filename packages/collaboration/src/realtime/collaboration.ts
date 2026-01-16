/**
 * Real-time Collaboration Manager
 * Handles WebSocket connections, presence detection, and collaborative editing
 */

// @ts-nocheck - External dependencies (yjs, y-websocket, lib0) and event emitter issues
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Observable } from 'lib0/observable';
import { nanoid } from 'nanoid';
import type { WebSocketMessage, WebSocketConfig } from '../types';
import type {
  CollaborationSession,
  PresenceUpdate,
  PresenceState,
  UserStatus,
  CursorPosition,
  SelectionRange,
  SessionPermissions,
} from '../types';
import { CRDTDocumentManager, createOperation } from './crdt';

// ============================================================================
// Event Types
// ============================================================================

export interface CollaborationEvents {
  'user-joined': CollaborationSession;
  'user-left': CollaborationSession;
  'cursor-updated': { userId: string; cursor: CursorPosition };
  'selection-updated': { userId: string; selection: SelectionRange };
  'text-updated': { userId: string; content: string };
  'presence-updated': PresenceUpdate;
  'connection-established': void;
  'connection-lost': void;
  'connection-restored': void;
}

// ============================================================================
// Collaboration Manager
// ============================================================================

export class CollaborationManager extends Observable<CollaborationEvents> {
  private ws: WebSocket | null = null;
  private wsConfig: WebSocketConfig;
  private crdtManager: CRDTDocumentManager;
  private yjsProviders: Map<string, WebsocketProvider> = new Map();
  private sessions: Map<string, CollaborationSession> = new Map();
  private presenceStates: Map<string, PresenceState> = new Map();
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private currentUserId: string;
  private currentUserName: string;
  private currentUserColor: string;
  private isConnected: boolean = false;

  constructor(
    userId: string,
    userName: string,
    config?: Partial<WebSocketConfig>
  ) {
    super();

    this.currentUserId = userId;
    this.currentUserName = userName;
    this.currentUserColor = this.generateUserColor(userId);

    this.wsConfig = {
      url: config?.url || 'ws://localhost:3001',
      protocols: config?.protocols,
      reconnectInterval: config?.reconnectInterval || 1000,
      maxReconnectAttempts: config?.maxReconnectAttempts || 10,
      heartbeatInterval: config?.heartbeatInterval || 30000,
    };

    this.crdtManager = new CRDTDocumentManager();
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to collaboration server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.wsConfig.url, this.wsConfig.protocols);
      this.setupWebSocketHandlers();
      await this.waitForConnection();
      this.isConnected = true;
      this.startHeartbeat();
      this.emit('connection-established', []);
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Disconnect from collaboration server
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Close all Yjs providers
    for (const provider of this.yjsProviders.values()) {
      provider.destroy();
    }
    this.yjsProviders.clear();

    // Clear sessions
    this.sessions.clear();
    this.presenceStates.clear();
    this.isConnected = false;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.sendPresence('online');
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.emit('connection-lost', []);
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Wait for WebSocket connection to be established
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.wsConfig.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.clearReconnectTimer();

    const delay = this.wsConfig.reconnectInterval * Math.pow(2, this.reconnectAttempts);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Connection failed, will retry
      });
    }, delay);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string | Buffer): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      this.processMessage(message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Process WebSocket message
   */
  private processMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'user_joined':
        this.handleUserJoined(message.payload as CollaborationSession);
        break;
      case 'user_left':
        this.handleUserLeft(message.payload as CollaborationSession);
        break;
      case 'cursor_update':
        this.handleCursorUpdate(message.payload as PresenceUpdate);
        break;
      case 'selection_update':
        this.handleSelectionUpdate(message.payload as PresenceUpdate);
        break;
      case 'presence_update':
        this.handlePresenceUpdate(message.payload as PresenceUpdate);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Handle user joined event
   */
  private handleUserJoined(session: CollaborationSession): void {
    this.sessions.set(session.userId, session);
    this.emit('user-joined', [session]);
  }

  /**
   * Handle user left event
   */
  private handleUserLeft(session: CollaborationSession): void {
    this.sessions.delete(session.userId);
    this.emit('user-left', [session]);
  }

  /**
   * Handle cursor update event
   */
  private handleCursorUpdate(update: PresenceUpdate): void {
    const session = this.sessions.get(update.userId);
    if (session) {
      session.userCursor = update.cursor;
      session.lastActivityAt = update.timestamp;
      this.emit('cursor-updated', {
        userId: update.userId,
        cursor: update.cursor!,
      });
    }
  }

  /**
   * Handle selection update event
   */
  private handleSelectionUpdate(update: PresenceUpdate): void {
    const session = this.sessions.get(update.userId);
    if (session) {
      session.userSelection = update.selection;
      session.lastActivityAt = update.timestamp;
      this.emit('selection-updated', {
        userId: update.userId,
        selection: update.selection!,
      });
    }
  }

  /**
   * Handle presence update event
   */
  private handlePresenceUpdate(update: PresenceUpdate): void {
    const session = this.sessions.get(update.userId);
    if (session) {
      session.status = update.status;
      session.lastActivityAt = update.timestamp;
      this.emit('presence-updated', [update]);
    }
  }

  /**
   * Send WebSocket message
   */
  private sendMessage<T>(type: string, payload: T): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message: WebSocket not connected');
      return;
    }

    const message: WebSocketMessage<T> = {
      type: type as any,
      sessionId: nanoid(),
      userId: this.currentUserId,
      timestamp: Date.now(),
      payload,
    };

    this.ws.send(JSON.stringify(message));
  }

  // ============================================================================
  // Presence Management
  // ============================================================================

  /**
   * Send presence update
   */
  sendPresence(status: UserStatus): void {
    const update: PresenceUpdate = {
      sessionId: nanoid(),
      userId: this.currentUserId,
      status,
      timestamp: Date.now(),
    };

    this.sendMessage('presence_update', update);
  }

  /**
   * Update cursor position
   */
  updateCursor(documentId: string, cursor: CursorPosition): void {
    const update: PresenceUpdate = {
      sessionId: nanoid(),
      userId: this.currentUserId,
      status: 'online',
      cursor,
      activeFile: documentId,
      timestamp: Date.now(),
    };

    this.sendMessage('cursor_update', update);

    // Update local presence state
    let presenceState = this.presenceStates.get(documentId);
    if (!presenceState) {
      presenceState = {
        documentId,
        users: new Map(),
        cursors: new Map(),
        selections: new Map(),
        lastUpdate: Date.now(),
      };
      this.presenceStates.set(documentId, presenceState);
    }

    presenceState.cursors.set(this.currentUserId, cursor);
    presenceState.lastUpdate = Date.now();
  }

  /**
   * Update selection range
   */
  updateSelection(documentId: string, selection: SelectionRange): void {
    const update: PresenceUpdate = {
      sessionId: nanoid(),
      userId: this.currentUserId,
      status: 'online',
      selection,
      activeFile: documentId,
      timestamp: Date.now(),
    };

    this.sendMessage('selection_update', update);

    // Update local presence state
    let presenceState = this.presenceStates.get(documentId);
    if (!presenceState) {
      presenceState = {
        documentId,
        users: new Map(),
        cursors: new Map(),
        selections: new Map(),
        lastUpdate: Date.now(),
      };
      this.presenceStates.set(documentId, presenceState);
    }

    presenceState.selections.set(this.currentUserId, selection);
    presenceState.lastUpdate = Date.now();
  }

  /**
   * Get presence state for a document
   */
  getPresenceState(documentId: string): PresenceState | undefined {
    return this.presenceStates.get(documentId);
  }

  /**
   * Get all active users in a document
   */
  getActiveUsers(documentId: string): CollaborationSession[] {
    const presenceState = this.presenceStates.get(documentId);
    if (!presenceState) {
      return [];
    }

    return Array.from(presenceState.users.values()).filter(
      (user) => user.status === 'online'
    );
  }

  // ============================================================================
  // Document Collaboration
  // ============================================================================

  /**
   * Join a collaborative document session
   */
  async joinDocument(
    documentId: string,
    permissions: SessionPermissions
  ): Promise<CollaborationSession> {
    // Create Yjs document and provider
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(
      this.wsConfig.url,
      documentId,
      ydoc,
      { connect: true }
    );

    this.yjsProviders.set(documentId, provider);

    // Create session
    const session: CollaborationSession = {
      sessionId: nanoid(),
      documentId,
      projectId: '',
      userId: this.currentUserId,
      userName: this.currentUserName,
      userColor: this.currentUserColor,
      status: 'online',
      permissions,
      lastActivityAt: Date.now(),
    };

    this.sessions.set(this.currentUserId, session);

    // Setup document event handlers
    this.setupDocumentHandlers(documentId, ydoc);

    return session;
  }

  /**
   * Leave a collaborative document session
   */
  leaveDocument(documentId: string): void {
    const provider = this.yjsProviders.get(documentId);
    if (provider) {
      provider.destroy();
      this.yjsProviders.delete(documentId);
    }

    this.presenceStates.delete(documentId);
  }

  /**
   * Setup document event handlers
   */
  private setupDocumentHandlers(documentId: string, ydoc: Y.Doc): void {
    const ytext = ydoc.getText();

    ytext.observe((event) => {
      const content = ytext.toString();
      this.emit('text-updated', {
        userId: this.currentUserId,
        content,
      });
    });
  }

  /**
   * Get Yjs provider for a document
   */
  getDocumentProvider(documentId: string): WebsocketProvider | undefined {
    return this.yjsProviders.get(documentId);
  }

  // ============================================================================
  // Heartbeat
  // ============================================================================

  /**
   * Start heartbeat to maintain connection
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.sendPresence('online');
      }
    }, this.wsConfig.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Generate a consistent color for a user
   */
  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E2',
      '#F8B739',
      '#52C7B8',
    ];

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }

    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current user ID
   */
  getUserId(): string {
    return this.currentUserId;
  }

  /**
   * Get current user name
   */
  getUserName(): string {
    return this.currentUserName;
  }

  /**
   * Get current user color
   */
  getUserColor(): string {
    return this.currentUserColor;
  }

  /**
   * Get all active sessions
   */
  getSessions(): Map<string, CollaborationSession> {
    return new Map(this.sessions);
  }

  /**
   * Destroy the collaboration manager
   */
  destroy(): void {
    this.disconnect();
    this.crdtManager.destroy();
    super.destroy();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate distance between two cursor positions
 */
export function calculateCursorDistance(
  pos1: CursorPosition,
  pos2: CursorPosition
): number {
  const lineDiff = Math.abs(pos1.line - pos2.line);
  const colDiff = Math.abs(pos1.column - pos2.column);
  return lineDiff * 100 + colDiff;
}

/**
 * Check if two selections overlap
 */
export function doSelectionsOverlap(
  sel1: SelectionRange,
  sel2: SelectionRange
): boolean {
  const sel1Start = sel1.start.line * 1000 + sel1.start.column;
  const sel1End = sel1.end.line * 1000 + sel1.end.column;
  const sel2Start = sel2.start.line * 1000 + sel2.start.column;
  const sel2End = sel2.end.line * 1000 + sel2.end.column;

  return sel1Start < sel2End && sel2Start < sel1End;
}

/**
 * Merge two selection ranges
 */
export function mergeSelections(
  sel1: SelectionRange,
  sel2: SelectionRange
): SelectionRange {
  const startLine = Math.min(sel1.start.line, sel2.start.line);
  const endLine = Math.max(sel1.end.line, sel2.end.line);

  let startCol: number;
  let endCol: number;

  if (sel1.start.line < sel2.start.line) {
    startCol = sel1.start.column;
  } else if (sel1.start.line > sel2.start.line) {
    startCol = sel2.start.column;
  } else {
    startCol = Math.min(sel1.start.column, sel2.start.column);
  }

  if (sel1.end.line < sel2.end.line) {
    endCol = sel2.end.column;
  } else if (sel1.end.line > sel2.end.line) {
    endCol = sel1.end.column;
  } else {
    endCol = Math.max(sel1.end.column, sel2.end.column);
  }

  return {
    start: { line: startLine, column: startCol },
    end: { line: endLine, column: endCol },
  };
}
