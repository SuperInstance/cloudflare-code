/**
 * Debug session recording with variable inspection and breakpoint management
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DebugSession,
  Breakpoint,
  VariableInspection,
  WatchExpression,
  StepAction,
  DebugFrame,
  DebugRecording,
  ReplayState,
  CallStackFrame,
} from '../types';

export interface RecordingOptions {
  maxSessionDuration?: number;
  maxFramesPerSession?: number;
  autoRecordOnError?: boolean;
  captureVariables?: boolean;
  captureCallStack?: boolean;
}

export class DebugRecorder {
  private sessions: Map<string, DebugSession> = new Map();
  private breakpoints: Map<string, Breakpoint> = new Map();
  private watchExpressions: Map<string, WatchExpression> = new Map();
  private recordings: Map<string, DebugRecording> = new Map();
  private activeSessionId: string | null = null;
  private errorHandlers: Array<(error: Error) => void> = [];

  constructor(private options: RecordingOptions = {}) {
    this.options = {
      maxSessionDuration: options.maxSessionDuration || 300000, // 5 minutes
      maxFramesPerSession: options.maxFramesPerSession || 10000,
      autoRecordOnError: options.autoRecordOnError ?? true,
      captureVariables: options.captureVariables ?? true,
      captureCallStack: options.captureCallStack ?? true,
    };

    // Setup global error handler if auto-record is enabled
    if (this.options.autoRecordOnError) {
      this.setupErrorHandler();
    }
  }

  /**
   * Setup global error handler
   */
  private setupErrorHandler(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleGlobalError(event.error);
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleGlobalError(event.reason);
      });
    }
  }

  /**
   * Handle global error
   */
  private handleGlobalError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (e) {
        console.error('Error in error handler:', e);
      }
    }

    // Auto-start recording if enabled
    if (this.options.autoRecordOnError && !this.activeSessionId) {
      this.startSession(`Auto-record: ${error.message}`);
    }
  }

  /**
   * Start a debug session
   */
  startSession(name: string): string {
    const sessionId = uuidv4();
    const session: DebugSession = {
      id: sessionId,
      name,
      startTime: Date.now(),
      status: 'active',
      traceId: this.generateTraceId(),
      breakpointIds: [],
      watchExpressions: [],
    };

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;

    // Initialize recording
    this.recordings.set(sessionId, {
      sessionId,
      frames: [],
      metadata: {
        startTime: Date.now(),
        endTime: 0,
        totalFrames: 0,
        recordingDuration: 0,
      },
    });

    return sessionId;
  }

  /**
   * Stop a debug session
   */
  stopSession(sessionId?: string): void {
    const id = sessionId || this.activeSessionId;
    if (!id) return;

    const session = this.sessions.get(id);
    if (session) {
      session.status = 'completed';
      session.endTime = Date.now();

      // Update recording metadata
      const recording = this.recordings.get(id);
      if (recording) {
        recording.metadata.endTime = Date.now();
        recording.metadata.recordingDuration =
          recording.metadata.endTime - recording.metadata.startTime;
      }
    }

    if (this.activeSessionId === id) {
      this.activeSessionId = null;
    }
  }

  /**
   * Pause current session
   */
  pauseSession(sessionId?: string): void {
    const id = sessionId || this.activeSessionId;
    if (!id) return;

    const session = this.sessions.get(id);
    if (session) {
      session.status = 'paused';
    }
  }

  /**
   * Resume a paused session
   */
  resumeSession(sessionId?: string): void {
    const id = sessionId || this.activeSessionId;
    if (!id) return;

    const session = this.sessions.get(id);
    if (session && session.status === 'paused') {
      session.status = 'active';
    }
  }

  /**
   * Record a debug frame
   */
  recordFrame(
    action: StepAction,
    file: string,
    line: number,
    variables?: Record<string, any>
  ): void {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;

    const recording = this.recordings.get(sessionId);
    if (!recording) return;

    // Check max frames limit
    if (recording.frames.length >= this.options.maxFramesPerSession!) {
      this.stopSession(sessionId);
      return;
    }

    // Check max duration
    const duration = Date.now() - recording.metadata.startTime;
    if (duration >= this.options.maxSessionDuration!) {
      this.stopSession(sessionId);
      return;
    }

    const frame: DebugFrame = {
      timestamp: Date.now(),
      action,
      file,
      line,
      callStack: this.options.captureCallStack ? this.captureCallStack() : [],
      variables: this.options.captureVariables ? this.captureVariables(variables) : [],
      watchResults: this.evaluateWatchExpressions(),
    };

    recording.frames.push(frame);
    recording.metadata.totalFrames++;
  }

  /**
   * Capture current call stack
   */
  private captureCallStack(): CallStackFrame[] {
    const stack: CallStackFrame[] = [];
    const error = new Error();

    if (error.stack) {
      const lines = error.stack.split('\n');

      for (const line of lines) {
        // Parse stack frame
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (match) {
          const [, functionName, fileId, lineNumber, columnNumber] = match;
          stack.push({
            functionName,
            fileId,
            lineNumber: parseInt(lineNumber, 10),
            columnNumber: parseInt(columnNumber, 10),
          });
        }
      }
    }

    return stack;
  }

  /**
   * Capture variables at current point
   */
  private captureVariables(variables?: Record<string, any>): VariableInspection[] {
    const inspected: VariableInspection[] = [];

    if (!variables) {
      return inspected;
    }

    for (const [name, value] of Object.entries(variables)) {
      inspected.push(this.inspectVariable(name, value, 'local'));
    }

    return inspected;
  }

  /**
   * Inspect a variable
   */
  inspectVariable(name: string, value: any, scope: VariableInspection['scope'] = 'local'): VariableInspection {
    return {
      name,
      value: this.sanitizeValue(value),
      type: typeof value,
      properties: this.getProperties(value),
      scope,
      readonly: false,
    };
  }

  /**
   * Sanitize a value for recording
   */
  private sanitizeValue(value: any): any {
    if (value === null) return null;
    if (value === undefined) return undefined;

    const type = typeof value;

    if (type === 'string' || type === 'number' || type === 'boolean') {
      return value;
    }

    if (type === 'object') {
      if (Array.isArray(value)) {
        return value.slice(0, 100); // Limit array size
      }

      // For objects, return a simplified representation
      const simplified: any = {};
      for (const key of Object.keys(value).slice(0, 50)) {
        try {
          simplified[key] = this.sanitizeValue(value[key]);
        } catch {
          simplified[key] = '[Error accessing property]';
        }
      }
      return simplified;
    }

    if (type === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }

    return `[${type}]`;
  }

  /**
   * Get properties of a value
   */
  private getProperties(value: any): VariableInspection[] | undefined {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }

    try {
      const properties: VariableInspection[] = [];

      for (const key of Object.keys(value).slice(0, 20)) {
        try {
          properties.push({
            name: key,
            value: this.sanitizeValue(value[key]),
            type: typeof value[key],
          });
        } catch {
          properties.push({
            name: key,
            value: '[Error]',
            type: 'unknown',
          });
        }
      }

      return properties;
    } catch {
      return undefined;
    }
  }

  /**
   * Add a breakpoint
   */
  addBreakpoint(file: string, line: number, condition?: string): string {
    const breakpointId = uuidv4();
    const breakpoint: Breakpoint = {
      id: breakpointId,
      sessionId: this.activeSessionId || '',
      file,
      line,
      condition,
      hitCount: 0,
      enabled: true,
    };

    this.breakpoints.set(breakpointId, breakpoint);

    // Add to current session
    if (this.activeSessionId) {
      const session = this.sessions.get(this.activeSessionId);
      if (session) {
        session.breakpointIds.push(breakpointId);
      }
    }

    return breakpointId;
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(breakpointId: string): boolean {
    return this.breakpoints.delete(breakpointId);
  }

  /**
   * Enable/disable a breakpoint
   */
  toggleBreakpoint(breakpointId: string, enabled: boolean): void {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (breakpoint) {
      breakpoint.enabled = enabled;
    }
  }

  /**
   * Check if breakpoint should trigger
   */
  shouldTriggerBreakpoint(file: string, line: number): boolean {
    for (const breakpoint of this.breakpoints.values()) {
      if (
        breakpoint.enabled &&
        breakpoint.file === file &&
        breakpoint.line === line
      ) {
        // Check condition if present
        if (breakpoint.condition) {
          try {
            // In a real implementation, this would evaluate the condition
            // For now, we'll always trigger
            breakpoint.hitCount++;
            return true;
          } catch {
            return false;
          }
        }

        breakpoint.hitCount++;
        return true;
      }
    }

    return false;
  }

  /**
   * Add a watch expression
   */
  addWatchExpression(expression: string): string {
    const watchId = uuidv4();
    const watch: WatchExpression = {
      id: watchId,
      sessionId: this.activeSessionId || '',
      expression,
      value: undefined,
      type: 'unknown',
    };

    this.watchExpressions.set(watchId, watch);

    // Add to current session
    if (this.activeSessionId) {
      const session = this.sessions.get(this.activeSessionId);
      if (session) {
        session.watchExpressions.push(expression);
      }
    }

    return watchId;
  }

  /**
   * Remove a watch expression
   */
  removeWatchExpression(watchId: string): boolean {
    return this.watchExpressions.delete(watchId);
  }

  /**
   * Evaluate all watch expressions
   */
  evaluateWatchExpressions(): WatchExpression[] {
    const results: WatchExpression[] = [];

    for (const watch of this.watchExpressions.values()) {
      try {
        // In a real implementation, this would evaluate the expression
        // For now, return a placeholder
        results.push({
          ...watch,
          value: '[Evaluated]',
          type: 'unknown',
        });
      } catch (error) {
        results.push({
          ...watch,
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Get a recording by session ID
   */
  getRecording(sessionId: string): DebugRecording | undefined {
    return this.recordings.get(sessionId);
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active session
   */
  getActiveSession(): DebugSession | undefined {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Export recording as JSON
   */
  exportRecording(sessionId: string): string | null {
    const recording = this.recordings.get(sessionId);
    if (!recording) return null;

    return JSON.stringify(
      {
        format: 'debug-recording',
        version: '1.0.0',
        recording,
        session: this.sessions.get(sessionId),
      },
      null,
      2
    );
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.sessions.clear();
    this.breakpoints.clear();
    this.watchExpressions.clear();
    this.recordings.clear();
    this.activeSessionId = null;
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add error handler
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalSessions: number;
    activeSession: string | null;
    totalBreakpoints: number;
    totalWatchExpressions: number;
    totalRecordings: number;
    totalFrames: number;
  } {
    let totalFrames = 0;

    for (const recording of this.recordings.values()) {
      totalFrames += recording.frames.length;
    }

    return {
      totalSessions: this.sessions.size,
      activeSession: this.activeSessionId,
      totalBreakpoints: this.breakpoints.size,
      totalWatchExpressions: this.watchExpressions.size,
      totalRecordings: this.recordings.size,
      totalFrames,
    };
  }
}
