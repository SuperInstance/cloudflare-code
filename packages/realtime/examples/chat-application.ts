/**
 * Chat Application Example for ClaudeFlare Real-Time Communication
 *
 * This example demonstrates building a real-time chat application with:
 * - Multiple rooms/channels
 * - User presence and typing indicators
 * - Message history
 * - User status (online, away, busy)
 */

import { RealTime } from '../src/index';

// Mock WebSocket for demonstration
class ChatWebSocket {
  public readyState = 1;
  public onmessage: ((data: string) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((error: Error) => void) | null = null;
  private receivedMessages: string[] = [];

  constructor(
    public userId: string,
    public username: string,
    public remoteAddress = '127.0.0.1'
  ) {}

  public send(data: string): void {
    this.receivedMessages.push(data);
    console.log(`[${this.username}] Sent: ${data.substring(0, 100)}...`);
  }

  public close(): void {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose();
    }
  }
}

interface ChatUser {
  id: string;
  username: string;
  socket: ChatWebSocket;
  status: 'online' | 'away' | 'busy' | 'offline';
  currentRoom?: string;
  typing: boolean;
}

interface ChatRoom {
  id: string;
  name: string;
  users: Set<string>;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  type: 'text' | 'system' | 'typing';
  sender: string;
  senderName: string;
  content: string;
  timestamp: number;
  room: string;
}

class ChatApplication {
  private realtime: RealTime;
  private users: Map<string, ChatUser> = new Map();
  private rooms: Map<string, ChatRoom> = new Map();
  private typingTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.realtime = new RealTime({
      enableLogging: true,
      enableMetrics: true,
      websocket: {
        maxConnections: 1000,
        heartbeatInterval: 30000,
        heartbeatTimeout: 60000,
        enableBackpressure: true
      },
      multiplexer: {
        maxChannels: 100,
        enableHistory: true,
        historySize: 1000
      },
      presence: {
        heartbeatInterval: 30000,
        presenceTtl: 300000,
        enableActivityTracking: true,
        maxUsers: 1000
      }
    });

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    await this.realtime.initialize();
    console.log('✓ Chat Application initialized');

    // Create default rooms
    await this.createRoom('general', 'General Chat');
    await this.createRoom('random', 'Random Thoughts');
    await this.createRoom('help', 'Help & Support');
  }

  private setupEventHandlers(): void {
    // Handle WebSocket messages
    this.realtime.getWebSocketManager().on('custom-message', async (event) => {
      await this.handleChatMessage(event);
    });

    // Handle presence changes
    this.realtime.getPresenceSystem().on('status:change', (event) => {
      this.handleUserStatusChange(event);
    });
  }

  // User management
  async connectUser(userId: string, username: string): Promise<string> {
    const socket = new ChatWebSocket(userId, username);
    const connectionId = await this.realtime.handleConnection(socket, 'chat-app', userId, {
      username,
      joinedAt: Date.now()
    });

    const user: ChatUser = {
      id: userId,
      username,
      socket,
      status: 'online',
      typing: false
    };

    this.users.set(userId, user);

    // Initialize presence
    await this.realtime.getPresenceSystem().initializePresence(userId, connectionId, {
      username,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`
    });

    // Auto-join general room
    await this.joinRoom(userId, 'general');

    console.log(`✓ User connected: ${username} (${userId})`);
    return connectionId;
  }

  async disconnectUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    // Leave all rooms
    for (const [roomId, room] of this.rooms) {
      if (room.users.has(userId)) {
        await this.leaveRoom(userId, roomId);
      }
    }

    // Remove user
    this.users.delete(userId);

    console.log(`✓ User disconnected: ${user.username} (${userId})`);
  }

  // Room management
  async createRoom(roomId: string, roomName: string): Promise<void> {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room already exists: ${roomId}`);
    }

    await this.realtime.getMultiplexer().createChannel(roomId, {
      persistent: true,
      metadata: { name: roomName }
    });

    const room: ChatRoom = {
      id: roomId,
      name: roomName,
      users: new Set(),
      messages: []
    };

    this.rooms.set(roomId, room);

    // Send system message
    await this.sendSystemMessage(roomId, `Room "${roomName}" created`);

    console.log(`✓ Room created: ${roomName} (${roomId})`);
  }

  async joinRoom(userId: string, roomId: string): Promise<void> {
    const user = this.users.get(userId);
    const room = this.rooms.get(roomId);

    if (!user || !room) {
      throw new Error('User or room not found');
    }

    // Leave current room if any
    if (user.currentRoom && user.currentRoom !== roomId) {
      await this.leaveRoom(userId, user.currentRoom);
    }

    // Join new room
    await this.realtime.getMultiplexer().subscribe(roomId, userId, {
      username: user.username,
      joinedAt: Date.now()
    });

    room.users.add(userId);
    user.currentRoom = roomId;

    // Send system message
    await this.sendSystemMessage(roomId, `${user.username} joined the room`);

    // Send recent messages
    const recentMessages = this.realtime.getMultiplexer().getChannelHistory(roomId, 10);
    for (const message of recentMessages) {
      await this.deliverMessage(userId, message);
    }

    console.log(`✓ User ${user.username} joined room ${roomId}`);
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    const user = this.users.get(userId);
    const room = this.rooms.get(roomId);

    if (!user || !room) return;

    // Unsubscribe from room
    await this.realtime.getMultiplexer().unsubscribe(roomId, userId);

    room.users.delete(userId);
    if (user.currentRoom === roomId) {
      user.currentRoom = undefined;
    }

    // Stop typing if user was typing in this room
    if (user.typing && this.typingTimers.has(userId)) {
      clearTimeout(this.typingTimers.get(userId)!);
      this.typingTimers.delete(userId);
      user.typing = false;
    }

    // Send system message if room is not empty
    if (room.users.size > 0) {
      await this.sendSystemMessage(roomId, `${user.username} left the room`);
    }

    console.log(`✓ User ${user.username} left room ${roomId}`);
  }

  // Messaging
  async sendMessage(userId: string, content: string, type: 'text' | 'system' = 'text'): Promise<void> {
    const user = this.users.get(userId);
    if (!user || !user.currentRoom) return;

    const roomId = user.currentRoom;
    const room = this.rooms.get(roomId);

    if (!room) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      sender: userId,
      senderName: user.username,
      content,
      timestamp: Date.now(),
      room: roomId
    };

    // Add to room history
    room.messages.push(message);

    // Publish to multiplexer
    await this.realtime.getMultiplexer().publish(roomId, {
      type: 'chat_message',
      payload: message
    }, userId, false);

    // Update user activity
    await this.realtime.getPresenceSystem().updateActivity(userId, {
      action: 'message',
      room: roomId
    });

    console.log(`💬 Message in ${roomId}: ${user.username}: ${content}`);
  }

  async sendTypingIndicator(userId: string, isTyping: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (!user || !user.currentRoom) return;

    const roomId = user.currentRoom;

    // Clear existing typing timer
    if (this.typingTimers.has(userId)) {
      clearTimeout(this.typingTimers.get(userId)!);
      this.typingTimers.delete(userId);
    }

    user.typing = isTyping;

    if (isTyping) {
      // Send typing indicator
      await this.realtime.getMultiplexer().publish(roomId, {
        type: 'typing_indicator',
        payload: {
          userId,
          username: user.username,
          isTyping
        }
      }, userId, false);

      // Set timeout to clear typing status
      const timer = setTimeout(() => {
        this.sendTypingIndicator(userId, false);
      }, 3000);

      this.typingTimers.set(userId, timer);
    }

    console.log(`✍️ ${user.username} is ${isTyping ? 'typing' : 'stopped typing'} in ${roomId}`);
  }

  // System messages
  async sendSystemMessage(roomId: string, content: string): Promise<void> {
    await this.sendMessage('system', content, 'system');
  }

  // Status management
  async updateUserStatus(userId: string, status: 'online' | 'away' | 'busy' | 'offline'): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.status = status;

    await this.realtime.getPresenceSystem().updateStatus(userId, status);

    console.log(`👤 ${user.username} status changed to ${status}`);
  }

  // Message handling
  private async handleChatMessage(event: any): Promise<void> {
    const { connectionId, message } = event;
    const user = Array.from(this.users.values()).find(u =>
      this.realtime.getWebSocketManager().getConnection(u.id)?.id === connectionId
    );

    if (!user) return;

    switch (message.type) {
      case 'chat_message':
        await this.deliverMessageToRoom(user, message.payload);
        break;

      case 'typing_indicator':
        await this.broadcastTypingIndicator(user, message.payload);
        break;

      case 'join_room':
        await this.joinRoom(user.id, message.roomId);
        break;

      case 'leave_room':
        await this.leaveRoom(user.id, message.roomId);
        break;

      case 'change_status':
        await this.updateUserStatus(user.id, message.status);
        break;
    }
  }

  private async deliverMessageToRoom(user: ChatUser, message: ChatMessage): Promise<void> {
    const room = this.rooms.get(message.room);
    if (!room || !room.users.has(user.id)) return;

    // Echo message back to sender
    await this.deliverMessage(user.id, message);

    // For demo purposes, we'll just log the message
    console.log(`💬 [${room.name}] ${message.senderName}: ${message.content}`);
  }

  private async deliverMessage(userId: string, message: any): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.socket.send(JSON.stringify(message));
  }

  private async broadcastTypingIndicator(user: ChatUser, payload: any): Promise<void> {
    const room = this.rooms.get(user.currentRoom!);
    if (!room) return;

    // Broadcast typing indicator to all users in room except sender
    const message = {
      type: 'typing_indicator',
      payload,
      timestamp: Date.now()
    };

    for (const userId of room.users) {
      if (userId !== user.id) {
        await this.deliverMessage(userId, message);
      }
    }
  }

  private async handleUserStatusChange(event: any): Promise<void> {
    const { userId, newStatus } = event;
    const user = this.users.get(userId);

    if (user) {
      user.status = newStatus;
      console.log(`👤 ${user.username} status updated to ${newStatus}`);
    }
  }

  // Utility methods
  getUserList(): ChatUser[] {
    return Array.from(this.users.values());
  }

  getRoomList(): ChatRoom[] {
    return Array.from(this.rooms.values());
  }

  getActiveUsersInRoom(roomId: string): ChatUser[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return Array.from(room.users)
      .map(userId => this.users.get(userId))
      .filter(Boolean) as ChatUser[];
  }

  async getStats(): Promise<any> {
    return this.realtime.getStats();
  }

  async getHealth(): Promise<any> {
    return this.realtime.getHealth();
  }

  async shutdown(): Promise<void> {
    await this.realtime.shutdown();
    console.log('✓ Chat Application shutdown');
  }
}

// Chat application example
async function runChatExample(): Promise<void> {
  console.log('=== Chat Application Example ===\n');

  const chatApp = new ChatApplication();
  await chatApp.initialize();

  try {
    // Create and connect users
    const user1 = await chatApp.connectUser('user-1', 'Alice');
    const user2 = await chatApp.connectUser('user-2', 'Bob');
    const user3 = await chatApp.connectUser('user-3', 'Charlie');

    console.log('\n👥 Users connected');

    // Simulate chat interactions
    console.log('\n--- Chat Interactions ---');

    // Users join different rooms
    await chatApp.joinRoom('user-1', 'general');
    await chatApp.joinRoom('user-2', 'general');
    await chatApp.joinRoom('user-3', 'help');

    // Send messages
    await chatApp.sendMessage('user-1', 'Hello everyone!');
    await new Promise(resolve => setTimeout(resolve, 100));

    await chatApp.sendMessage('user-2', 'Hey Alice! How are you?');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Typing indicators
    await chatApp.sendTypingIndicator('user-1', true);
    await new Promise(resolve => setTimeout(resolve, 500));
    await chatApp.sendTypingIndicator('user-1', false);

    await chatApp.sendMessage('user-1', 'Just working on some code.');
    await new Promise(resolve => setTimeout(resolve, 100));

    // User status change
    await chatApp.updateUserStatus('user-2', 'busy');

    // Create a new room
    await chatApp.createRoom('dev-chat', 'Development Chat');
    await chatApp.joinRoom('user-1', 'dev-chat');
    await chatApp.joinRoom('user-2', 'dev-chat');

    await chatApp.sendMessage('user-1', 'Check out this new feature I\'m working on!');

    // Display room and user information
    console.log('\n--- Room Information ---');
    const rooms = chatApp.getRoomList();
    for (const room of rooms) {
      const activeUsers = chatApp.getActiveUsersInRoom(room.id);
      console.log(`📁 ${room.name} (${room.id})`);
      console.log(`   Users: ${activeUsers.map(u => u.username).join(', ')}`);
      console.log(`   Messages: ${room.messages.length}`);
    }

    console.log('\n--- User Information ---');
    const users = chatApp.getUserList();
    for (const user of users) {
      console.log(`👤 ${user.username} (${user.id})`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Current Room: ${user.currentRoom || 'None'}`);
    }

    // Show system stats
    console.log('\n--- System Statistics ---');
    const stats = await chatApp.getStats();
    console.log('📊 Real-Time Stats:');
    console.log(`  - Connections: ${stats.websocket.connections.active}`);
    console.log(`  - Channels: ${stats.multiplexer.channels.total}`);
    console.log(`  - Users: ${stats.presence.totalUsers}`);

    const health = await chatApp.getHealth();
    console.log(`  - Health: ${healthy ? '✓ Healthy' : '⚠ Issues'}`);

    // Disconnect users
    console.log('\n--- Disconnecting Users ---');
    await chatApp.disconnectUser('user-1');
    await chatApp.disconnectUser('user-2');
    await chatApp.disconnectUser('user-3');

    console.log('\n✅ Chat Example Completed');

  } catch (error) {
    console.error('❌ Error in chat example:', error);
    throw error;
  } finally {
    await chatApp.shutdown();
  }
}

// Export the chat application
export { ChatApplication, runChatExample };

// Run the example if this file is executed directly
if (require.main === module) {
  runChatExample().catch(console.error);
}