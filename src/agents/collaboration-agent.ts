/**
 * Multi-User Collaboration Agent
 *
 * Specialized agent for building real-time collaborative features,
 * user management, and social learning capabilities
 */

import type {
  STEMProject,
  User,
  STEMComponent,
  WiringConnection,
  ChatMessage
} from '../stem-types';

export interface CollaborationSession {
  id: string;
  projectId: string;
  participants: string[];
  permissions: Map<string, 'read' | 'write' | 'admin'>;
  createdAt: number;
  lastActivity: number;
  isPrivate: boolean;
  inviteCode?: string;
}

export interface RealtimeUpdate {
  type: 'component_added' | 'component_moved' | 'connection_made' | 'component_deleted' | 'chat_message';
  userId: string;
  timestamp: number;
  data: any;
}

export interface UserActivity {
  userId: string;
  projectId: string;
  lastSeen: number;
  actions: string[];
  cursorPosition?: { x: number; y: number };
  currentlyEditing?: string;
}

export class CollaborationAgent {
  private activeSessions: Map<string, CollaborationSession>;
  private userActivities: Map<string, UserActivity>;
  private websocketManager: any;
  private notificationService: any;

  constructor() {
    this.activeSessions = new Map();
    this.userActivities = new Map();
    this.initializeWebSocketManager();
    this.initializeNotificationService();
  }

  /**
   * Initialize WebSocket manager for real-time communication
   */
  private initializeWebSocketManager(): void {
    this.websocketManager = {
      connections: new Map<string, WebSocket>(),

      connect(userId: string, projectId: string, ws: WebSocket): void {
        const connectionId = `${userId}_${projectId}`;
        this.connections.set(connectionId, ws);

        ws.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(connectionId, message);
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        });

        ws.addEventListener('close', () => {
          this.connections.delete(connectionId);
        });
      },

      handleMessage(connectionId: string, message: any): void {
        switch (message.type) {
          case 'join_session':
            this.joinSession(connectionId, message);
            break;
          case 'leave_session':
            this.leaveSession(connectionId, message);
            break;
          case 'project_update':
            this.broadcastUpdate(connectionId, message);
            break;
          case 'chat_message':
            this.broadcastChat(connectionId, message);
            break;
          case 'cursor_update':
            this.broadcastCursor(connectionId, message);
            break;
        }
      },

      broadcastUpdate(excludeConnectionId: string, message: any): void {
        this.connections.forEach((ws, connectionId) => {
          if (connectionId !== excludeConnectionId && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'project_update',
              data: message.data,
              userId: message.userId,
              timestamp: Date.now()
            }));
          }
        });
      },

      broadcastChat(excludeConnectionId: string, message: any): void {
        this.connections.forEach((ws, connectionId) => {
          if (connectionId !== excludeConnectionId && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'chat_message',
              data: message.data,
              userId: message.userId,
              timestamp: Date.now()
            }));
          }
        });
      },

      broadcastCursor(excludeConnectionId: string, message: any): void {
        this.connections.forEach((ws, connectionId) => {
          if (connectionId !== excludeConnectionId && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'cursor_update',
              data: message.data,
              userId: message.userId,
              timestamp: Date.now()
            }));
          }
        });
      }
    };
  }

  /**
   * Initialize notification service for user communications
   */
  private initializeNotificationService(): void {
    this.notificationService = {
      notifications: new Map<string, Array<any>>(),

      addNotification(userId: string, notification: any): void {
        const userNotifications = this.notifications.get(userId) || [];
        userNotifications.push({
          ...notification,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          read: false
        });
        this.notifications.set(userId, userNotifications);
      },

      getNotifications(userId: string): any[] {
        const notifications = this.notifications.get(userId) || [];
        return notifications.sort((a, b) => b.timestamp - a.timestamp);
      },

      markAsRead(userId: string, notificationId: string): void {
        const notifications = this.notifications.get(userId) || [];
        const notification = notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
        }
      },

      markAllAsRead(userId: string): void {
        const notifications = this.notifications.get(userId) || [];
        notifications.forEach(n => n.read = true);
      }
    };
  }

  /**
   * Create a new collaboration session
   */
  async createCollaborationSession(
    projectId: string,
    creatorId: string,
    options: {
      isPrivate?: boolean;
      maxParticipants?: number;
      allowedUsers?: string[];
    } = {}
  ): Promise<CollaborationSession> {
    const sessionId = crypto.randomUUID();
    const session: CollaborationSession = {
      id: sessionId,
      projectId,
      participants: [creatorId],
      permissions: new Map([[creatorId, 'admin']]),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isPrivate: options.isPrivate || false,
      inviteCode: options.isPrivate ? this.generateInviteCode() : undefined
    };

    this.activeSessions.set(sessionId, session);

    // Add creator to notification service
    this.notificationService.addNotification(creatorId, {
      type: 'session_created',
      message: `Collaboration session created for project ${projectId}`,
      session: session
    });

    return session;
  }

  /**
   * Join an existing collaboration session
   */
  async joinSession(
    sessionId: string,
    userId: string,
    inviteCode?: string
  ): Promise<{ success: boolean; message: string; session?: CollaborationSession }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    // Check permissions
    if (session.isPrivate && !inviteCode && session.inviteCode !== inviteCode) {
      return { success: false, message: 'Invalid invite code for private session' };
    }

    // Check if user is already participating
    if (session.participants.includes(userId)) {
      return { success: true, message: 'Already in session', session };
    }

    // Add participant with default permissions
    session.participants.push(userId);
    session.permissions.set(userId, 'read'); // Default to read-only

    // Update user activity
    this.updateUserActivity(userId, session.projectId);

    // Notify all participants
    this.broadcastSessionUpdate(session, {
      type: 'user_joined',
      userId,
      timestamp: Date.now()
    });

    // Notify the new user
    this.notificationService.addNotification(userId, {
      type: 'session_joined',
      message: `You joined the collaboration session for project ${session.projectId}`,
      session: session
    });

    return { success: true, message: 'Joined session successfully', session };
  }

  /**
   * Leave a collaboration session
   */
  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Remove participant
    session.participants = session.participants.filter(id => id !== userId);
    session.permissions.delete(userId);

    // Clean up user activity
    this.cleanupUserActivity(userId, session.projectId);

    // Notify remaining participants
    this.broadcastSessionUpdate(session, {
      type: 'user_left',
      userId,
      timestamp: Date.now()
    });

    // Remove empty sessions
    if (session.participants.length === 0) {
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Update user activity and broadcasting
   */
  updateUserActivity(userId: string, projectId: string): void {
    const activity: UserActivity = {
      userId,
      projectId,
      lastSeen: Date.now(),
      actions: [],
      cursorPosition: undefined,
      currentlyEditing: undefined
    };

    this.userActivities.set(`${userId}_${projectId}`, activity);

    // Broadcast user presence update
    this.broadcastUserActivity(activity);
  }

  /**
   * Handle real-time project updates
   */
  async handleProjectUpdate(
    sessionId: string,
    userId: string,
    update: RealtimeUpdate
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Check permissions
    const userPermission = session.permissions.get(userId);
    if (userPermission === 'read' && update.type !== 'cursor_update') {
      throw new Error('Insufficient permissions for this action');
    }

    // Update session activity
    session.lastActivity = Date.now();

    // Store update in activity log
    const activityKey = `${userId}_${sessionId}`;
    const activity = this.userActivities.get(activityKey);
    if (activity) {
      activity.actions.push(`${update.type}_${update.timestamp}`);
      this.userActivities.set(activityKey, activity);
    }

    // Broadcast update to all participants
    this.websocketManager.broadcastUpdate(activityKey, update);
  }

  /**
   * Handle chat messages in collaboration sessions
   */
  async handleChatMessage(
    sessionId: string,
    userId: string,
    message: string,
    messageType: 'text' | 'emoji' | 'file_share' = 'text'
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const chatMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now()
    };

    const update: RealtimeUpdate = {
      type: 'chat_message',
      userId,
      timestamp: Date.now(),
      data: {
        message: chatMessage,
        messageType,
        sessionId
      }
    };

    // Broadcast to all participants
    this.websocketManager.broadcastChat(`${userId}_${sessionId}`, update);
  }

  /**
   * Handle cursor position updates
   */
  handleCursorUpdate(
    sessionId: string,
    userId: string,
    cursorPosition: { x: number; y: number }
  ): void {
    const activity = this.userActivities.get(`${userId}_${sessionId}`);
    if (activity) {
      activity.cursorPosition = cursorPosition;
      this.userActivities.set(`${userId}_${sessionId}`, activity);
    }

    const update: RealtimeUpdate = {
      type: 'cursor_update',
      userId,
      timestamp: Date.now(),
      data: { cursorPosition }
    };

    this.websocketManager.broadcastCursor(`${userId}_${sessionId}`, update);
  }

  /**
   * Request edit permissions for a component
   */
  async requestEditPermission(
    sessionId: string,
    userId: string,
    componentId: string,
    requestedAction: 'add' | 'modify' | 'delete'
  ): Promise<{ success: boolean; granted: boolean; reason?: string }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return { success: false, granted: false };

    const userPermission = session.permissions.get(userId);

    // Admin users can always edit
    if (userPermission === 'admin') {
      return { success: true, granted: true };
    }

    // Check if component is currently being edited by someone else
    const editingUser = this.findCurrentlyEditingUser(sessionId, componentId);
    if (editingUser && editingUser !== userId) {
      return {
        success: true,
        granted: false,
        reason: `Component currently being edited by ${editingUser}`
      };
    }

    // Grant edit permission (in production, this might require approval)
    if (userPermission === 'write' || userPermission === 'read') {
      session.permissions.set(userId, 'write');
      return { success: true, granted: true };
    }

    return { success: true, granted: false, reason: 'Insufficient permissions' };
  }

  /**
   * Get collaboration session information
   */
  getSessionInfo(sessionId: string): CollaborationSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get user's active sessions
   */
  getUserSessions(userId: string): CollaborationSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.participants.includes(userId));
  }

  /**
   * Get activity information for a project
   */
  getProjectActivity(projectId: string): UserActivity[] {
    return Array.from(this.userActivities.values())
      .filter(activity => activity.projectId === projectId);
  }

  /**
   * Generate collaboration reports
   */
  async generateCollaborationReport(projectId: string): Promise<{
    projectSummary: any;
    userEngagement: any[];
    collaborationMetrics: any;
    suggestions: string[];
  }> {
    const activities = this.getProjectActivity(projectId);
    const sessions = Array.from(this.activeSessions.values())
      .filter(session => session.projectId === projectId);

    // Calculate engagement metrics
    const userEngagement = activities.map(activity => ({
      userId: activity.userId,
      totalActions: activity.actions.length,
      lastSeen: activity.lastSeen,
      averageSessionTime: this.calculateAverageSessionTime(activity),
      mostFrequentAction: this.getMostFrequentAction(activity.actions)
    }));

    // Calculate collaboration metrics
    const collaborationMetrics = {
      totalSessions: sessions.length,
      averageParticipants: sessions.reduce((sum, session) => sum + session.participants.length, 0) / sessions.length || 0,
      mostActiveUser: userEngagement.reduce((most, user) =>
        user.totalActions > (most?.totalActions || 0) ? user : most, null
      ),
      collaborationScore: this.calculateCollaborationScore(userEngagement)
    };

    // Generate suggestions
    const suggestions = this.generateCollaborationSuggestions(collaborationMetrics, userEngagement);

    return {
      projectSummary: {
        projectId,
        sessionCount: sessions.length,
        participants: Array.from(new Set(sessions.flatMap(s => s.participants))),
        timeRange: {
          earliest: Math.min(...activities.map(a => a.lastSeen)),
          latest: Math.max(...activities.map(a => a.lastSeen))
        }
      },
      userEngagement,
      collaborationMetrics,
      suggestions
    };
  }

  // Helper methods

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private broadcastSessionUpdate(session: CollaborationSession, update: any): void {
    session.participants.forEach(userId => {
      this.notificationService.addNotification(userId, {
        type: 'session_update',
        message: `Session update: ${update.type}`,
        update
      });
    });
  }

  private broadcastUserActivity(activity: UserActivity): void {
    // Broadcast to other users in the same project
    const projectActivities = this.getProjectActivity(activity.projectId)
      .filter(a => a.userId !== activity.userId);

    // In real implementation, this would go through WebSocket manager
  }

  private findCurrentlyEditingUser(sessionId: string, componentId: string): string | null {
    const activities = Array.from(this.userActivities.values())
      .filter(a => a.projectId === sessionId && a.currentlyEditing === componentId);
    return activities.length > 0 ? activities[0].userId : null;
  }

  private calculateAverageSessionTime(activity: UserActivity): number {
    // Simplified calculation
    return 0; // Would calculate based on session start/end times
  }

  private getMostFrequentAction(actions: string[]): string | null {
    const actionCounts = actions.reduce((counts, action) => {
      counts[action] = (counts[action] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Object.entries(actionCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;
  }

  private calculateCollaborationScore(engagement: any[]): number {
    if (engagement.length === 0) return 0;

    const avgActions = engagement.reduce((sum, user) => sum + user.totalActions, 0) / engagement.length;
    const activeUsers = engagement.filter(user => user.totalActions > 10).length;

    return (activeUsers / engagement.length) * 100;
  }

  private generateCollaborationSuggestions(metrics: any, engagement: any[]): string[] {
    const suggestions: string[] = [];

    if (metrics.averageParticipants < 2) {
      suggestions.push("Consider inviting more collaborators to enhance learning");
    }

    if (metrics.collaborationScore < 50) {
      suggestions.push("Implement more collaborative features to increase engagement");
    }

    const inactiveUsers = engagement.filter(user => {
      const timeSinceLastSeen = Date.now() - user.lastSeen;
      return timeSinceLastSeen > 24 * 60 * 60 * 1000; // 24 hours
    });

    if (inactiveUsers.length > 0) {
      suggestions.push("Send follow-ups to inactive participants to re-engage them");
    }

    return suggestions;
  }

  // Cleanup and maintenance

  cleanup(): void {
    // Clean up inactive sessions (older than 7 days)
    const now = Date.now();
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > 7 * 24 * 60 * 60 * 1000) {
        this.activeSessions.delete(sessionId);
      }
    }

    // Clean up old user activities
    for (const [activityKey, activity] of this.userActivities.entries()) {
      if (now - activity.lastSeen > 24 * 60 * 60 * 1000) { // 24 hours
        this.userActivities.delete(activityKey);
      }
    }
  }

  // WebSocket connection management
  handleWebSocketConnection(ws: WebSocket, userId: string, projectId: string): void {
    this.websocketManager.connect(userId, projectId, ws);
  }

  // Export collaboration data
  exportCollaborationData(projectId: string): string {
    const sessions = Array.from(this.activeSessions.values())
      .filter(session => session.projectId === projectId);
    const activities = this.getProjectActivity(projectId);

    return JSON.stringify({
      sessions,
      activities,
      exportDate: Date.now(),
      projectId
    }, null, 2);
  }
}

// Export singleton instance
export const collaborationAgent = new CollaborationAgent();