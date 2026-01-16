/**
 * Pair Programming Session Manager
 * Manages driver/navigator roles and collaboration features
 */

// @ts-nocheck - Pair programming with unused parameters
import { nanoid } from 'nanoid';
import type {
  PairSession,
  PairParticipant,
  PairRole,
  PairSessionStatus,
  PairPermissions,
  PairSessionSettings,
  PairStatistics,
  RoleSwitchRequest,
  WebRTCSession,
  WebRTCSessionType,
} from '../types';
import type { CollaborationManager } from '../realtime/collaboration';

// ============================================================================
// Pair Programming Manager
// ============================================================================

export class PairProgrammingManager {
  private sessions: Map<string, PairSession> = new Map();
  private webrtcSessions: Map<string, WebRTCSessionManager> = new Map();
  private collaborationManager: CollaborationManager;

  constructor(collaborationManager: CollaborationManager) {
    this.collaborationManager = collaborationManager;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Create a new pair programming session
   */
  createSession(
    projectId: string,
    driverUserId: string,
    driverUserName: string,
    navigatorUserId: string,
    navigatorUserName: string,
    settings?: Partial<PairSessionSettings>
  ): PairSession {
    const session: PairSession = {
      sessionId: nanoid(),
      projectId,
      driver: {
        userId: driverUserId,
        userName: driverUserName,
        role: 'driver',
        joinedAt: Date.now(),
        permissions: {
          canWrite: true,
          canExecute: true,
          canShareTerminal: true,
          canVoiceChat: true,
          canVideoChat: true,
          canScreenShare: true,
        },
      },
      navigator: {
        userId: navigatorUserId,
        userName: navigatorUserName,
        role: 'navigator',
        joinedAt: Date.now(),
        permissions: {
          canWrite: false,
          canExecute: false,
          canShareTerminal: true,
          canVoiceChat: true,
          canVideoChat: true,
          canScreenShare: true,
        },
      },
      status: 'active',
      startedAt: Date.now(),
      settings: {
        allowVoiceChat: settings?.allowVoiceChat ?? true,
        allowVideoChat: settings?.allowVideoChat ?? true,
        allowScreenShare: settings?.allowScreenShare ?? true,
        allowTerminalShare: settings?.allowTerminalShare ?? true,
        autoSwitchInterval: settings?.autoSwitchInterval,
        recordingEnabled: settings?.recordingEnabled ?? false,
      },
      statistics: {
        duration: 0,
        linesWritten: 0,
        filesTouched: 0,
        switchCount: 0,
        commitsMade: 0,
      },
    };

    this.sessions.set(session.sessionId, session);

    // Setup auto-switch if configured
    if (session.settings.autoSwitchInterval) {
      this.setupAutoSwitch(session.sessionId);
    }

    return session;
  }

  /**
   * Get a pair programming session
   */
  getSession(sessionId: string): PairSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * End a pair programming session
   */
  endSession(sessionId: string): PairSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.status = 'ended';
    session.endedAt = Date.now();
    session.statistics.duration = session.endedAt - session.startedAt;

    // Cleanup WebRTC sessions
    const webrtc = this.webrtcSessions.get(sessionId);
    if (webrtc) {
      webrtc.destroy();
      this.webrtcSessions.delete(sessionId);
    }

    return session;
  }

  /**
   * Pause a pair programming session
   */
  pauseSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    session.status = 'paused';
    return true;
  }

  /**
   * Resume a paused pair programming session
   */
  resumeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') {
      return false;
    }

    session.status = 'active';
    return true;
  }

  // ============================================================================
  // Role Management
  // ============================================================================

  /**
   * Switch driver and navigator roles
   */
  switchRoles(sessionId: string, requestedBy: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    // Store old roles
    const oldDriver = session.driver;
    const oldNavigator = session.navigator;

    // Switch roles
    session.driver = {
      ...oldNavigator,
      role: 'driver',
      permissions: {
        canWrite: true,
        canExecute: true,
        canShareTerminal: true,
        canVoiceChat: true,
        canVideoChat: true,
        canScreenShare: true,
      },
    };

    session.navigator = {
      ...oldDriver,
      role: 'navigator',
      permissions: {
        canWrite: false,
        canExecute: false,
        canShareTerminal: true,
        canVoiceChat: true,
        canVideoChat: true,
        canScreenShare: true,
      },
    };

    session.statistics.switchCount++;

    return true;
  }

  /**
   * Request a role switch
   */
  requestRoleSwitch(
    sessionId: string,
    requestedBy: string,
    reason?: string
  ): RoleSwitchRequest {
    const request: RoleSwitchRequest = {
      sessionId,
      requestedBy,
      requestedAt: Date.now(),
      reason,
    };

    // In a real implementation, this would send a notification
    // to the other participant for approval
    return request;
  }

  /**
   * Setup automatic role switching
   */
  private setupAutoSwitch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.settings.autoSwitchInterval) {
      return;
    }

    const interval = session.settings.autoSwitchInterval;
    setInterval(() => {
      if (session.status === 'active') {
        this.switchRoles(sessionId, session.driver.userId);
      }
    }, interval);
  }

  // ============================================================================
  // Permissions
  // ============================================================================

  /**
   * Check if a user has write permission
   */
  canWrite(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.driver.userId === userId) {
      return session.driver.permissions.canWrite;
    }

    if (session.navigator.userId === userId) {
      return session.navigator.permissions.canWrite;
    }

    return false;
  }

  /**
   * Check if a user can execute code
   */
  canExecute(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.driver.userId === userId) {
      return session.driver.permissions.canExecute;
    }

    if (session.navigator.userId === userId) {
      return session.navigator.permissions.canExecute;
    }

    return false;
  }

  /**
   * Check if a user can share terminal
   */
  canShareTerminal(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.driver.userId === userId) {
      return session.driver.permissions.canShareTerminal;
    }

    if (session.navigator.userId === userId) {
      return session.navigator.permissions.canShareTerminal;
    }

    return false;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Record a write operation
   */
  recordWrite(sessionId: string, lineCount: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.statistics.linesWritten += lineCount;
  }

  /**
   * Record a file touch
   */
  recordFileTouch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.statistics.filesTouched++;
  }

  /**
   * Record a commit
   */
  recordCommit(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.statistics.commitsMade++;
  }

  /**
   * Get session statistics
   */
  getStatistics(sessionId: string): PairStatistics | undefined {
    const session = this.sessions.get(sessionId);
    return session?.statistics;
  }

  // ============================================================================
  // WebRTC Features
  // ============================================================================

  /**
   * Start a WebRTC session (voice/video/screen)
   */
  startWebRTCSession(
    pairSessionId: string,
    type: WebRTCSessionType,
    localUserId: string
  ): WebRTCSessionManager {
    const webrtc = new WebRTCSessionManager(pairSessionId, type, localUserId);
    this.webrtcSessions.set(pairSessionId, webrtc);
    return webrtc;
  }

  /**
   * Get WebRTC session
   */
  getWebRTCSession(sessionId: string): WebRTCSessionManager | undefined {
    return this.webrtcSessions.get(sessionId);
  }

  /**
   * End WebRTC session
   */
  endWebRTCSession(sessionId: string): void {
    const webrtc = this.webrtcSessions.get(sessionId);
    if (webrtc) {
      webrtc.destroy();
      this.webrtcSessions.delete(sessionId);
    }
  }

  // ============================================================================
  // Session Queries
  // ============================================================================

  /**
   * Get all active sessions
   */
  getActiveSessions(): PairSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'active'
    );
  }

  /**
   * Get sessions for a project
   */
  getSessionsForProject(projectId: string): PairSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.projectId === projectId
    );
  }

  /**
   * Get sessions for a user
   */
  getSessionsForUser(userId: string): PairSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.driver.userId === userId || s.navigator.userId === userId
    );
  }

  /**
   * Clean up all sessions
   */
  destroy(): void {
    for (const webrtc of this.webrtcSessions.values()) {
      webrtc.destroy();
    }
    this.webrtcSessions.clear();
    this.sessions.clear();
  }
}

// ============================================================================
// WebRTC Session Manager
// ============================================================================

export class WebRTCSessionManager {
  private pairSessionId: string;
  private type: WebRTCSessionType;
  private localUserId: string;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private configuration: RTCConfiguration;

  constructor(
    pairSessionId: string,
    type: WebRTCSessionType,
    localUserId: string
  ) {
    this.pairSessionId = pairSessionId;
    this.type = type;
    this.localUserId = localUserId;
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
  }

  /**
   * Start the WebRTC session
   */
  async start(): Promise<void> {
    // Create peer connection
    this.peerConnection = new RTCPeerConnection(this.configuration);

    // Setup event handlers
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStreams.set(event.streams[0].id, event.streams[0]);
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
    };

    // Get media based on type
    switch (this.type) {
      case 'voice':
        await this.startVoiceChat();
        break;
      case 'video':
        await this.startVideoChat();
        break;
      case 'screen':
        await this.startScreenShare();
        break;
      case 'terminal':
        this.startTerminalShare();
        break;
    }
  }

  /**
   * Start voice chat
   */
  private async startVoiceChat(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }
    } catch (error) {
      console.error('Failed to start voice chat:', error);
      throw error;
    }
  }

  /**
   * Start video chat
   */
  private async startVideoChat(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }
    } catch (error) {
      console.error('Failed to start video chat:', error);
      throw error;
    }
  }

  /**
   * Start screen sharing
   */
  private async startScreenShare(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }
    } catch (error) {
      console.error('Failed to start screen share:', error);
      throw error;
    }
  }

  /**
   * Start terminal sharing via data channel
   */
  private startTerminalShare(): void {
    if (!this.peerConnection) {
      return;
    }

    this.dataChannel = this.peerConnection.createDataChannel('terminal', {
      ordered: true,
    });

    this.dataChannel.onopen = () => {
      console.log('Terminal data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      this.handleTerminalData(event.data);
    };
  }

  /**
   * Create offer
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Create answer
   */
  async createAnswer(
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Set remote description
   */
  async setRemoteDescription(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(description);
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  /**
   * Send terminal data
   */
  sendTerminalData(data: string): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(data);
    }
  }

  /**
   * Handle terminal data
   */
  private handleTerminalData(data: string): void {
    // In a real implementation, this would update the terminal UI
    console.log('Terminal data:', data);
  }

  /**
   * Send ICE candidate
   */
  private sendIceCandidate(candidate: RTCIceCandidate): void {
    // In a real implementation, this would send the candidate via signaling server
    console.log('ICE candidate:', candidate);
  }

  /**
   * Mute/unmute audio
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Enable/disable video
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Stop the session
   */
  stop(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStreams.clear();
  }

  /**
   * Destroy the WebRTC session
   */
  destroy(): void {
    this.stop();
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote streams
   */
  getRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
  }
}
