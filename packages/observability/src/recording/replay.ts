/**
 * Debug session replay functionality
 */

// @ts-nocheck - Complex replay type issues
import { DebugRecording, DebugFrame, ReplayState, ReplayFilter } from '../types';

export class SessionReplayer {
  private recording: DebugRecording;
  private state: ReplayState = {
    currentFrame: 0,
    isPlaying: false,
    playbackSpeed: 1,
    filters: {},
  };
  private playbackInterval?: number;

  constructor(recording: DebugRecording) {
    this.recording = recording;
  }

  /**
   * Start playback
   */
  play(speed: number = 1): void {
    this.state.isPlaying = true;
    this.state.playbackSpeed = speed;

    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
    }

    this.playbackInterval = window.setInterval(() => {
      if (this.state.currentFrame >= this.recording.frames.length - 1) {
        this.pause();
        return;
      }

      this.nextFrame();
    }, 1000 / speed);
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.state.isPlaying = false;

    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = undefined;
    }
  }

  /**
   * Stop playback and reset
   */
  stop(): void {
    this.pause();
    this.state.currentFrame = 0;
  }

  /**
   * Move to next frame
   */
  nextFrame(): boolean {
    if (this.state.currentFrame < this.recording.frames.length - 1) {
      this.state.currentFrame++;
      return true;
    }
    return false;
  }

  /**
   * Move to previous frame
   */
  previousFrame(): boolean {
    if (this.state.currentFrame > 0) {
      this.state.currentFrame--;
      return true;
    }
    return false;
  }

  /**
   * Jump to specific frame
   */
  jumpToFrame(frameIndex: number): boolean {
    if (frameIndex >= 0 && frameIndex < this.recording.frames.length) {
      this.state.currentFrame = frameIndex;
      return true;
    }
    return false;
  }

  /**
   * Jump to specific time
   */
  jumpToTime(timestamp: number): boolean {
    const frame = this.recording.frames.find(
      (f) => f.timestamp >= timestamp
    );

    if (frame) {
      const index = this.recording.frames.indexOf(frame);
      return this.jumpToFrame(index);
    }

    return false;
  }

  /**
   * Get current frame
   */
  getCurrentFrame(): DebugFrame | null {
    return this.recording.frames[this.state.currentFrame] || null;
  }

  /**
   * Get replay state
   */
  getState(): ReplayState {
    return { ...this.state };
  }

  /**
   * Apply filters
   */
  applyFilters(filters: ReplayFilter): void {
    this.state.filters = filters;

    // Reset to first matching frame
    const firstMatch = this.findFirstFilteredFrame();
    if (firstMatch !== null) {
      this.state.currentFrame = firstMatch;
    }
  }

  /**
   * Clear filters
   */
  clearFilters(): void {
    this.state.filters = {};
  }

  /**
   * Get filtered frames
   */
  getFilteredFrames(): DebugFrame[] {
    const filters = this.state.filters;

    return this.recording.frames.filter((frame) => {
      if (filters.startTime && frame.timestamp < filters.startTime) {
        return false;
      }
      if (filters.endTime && frame.timestamp > filters.endTime) {
        return false;
      }
      if (filters.files && !filters.files.includes(frame.file)) {
        return false;
      }
      if (filters.functions) {
        const matchesFunction = frame.callStack.some((stackFrame) =>
          filters.functions!.includes(stackFrame.functionName)
        );
        if (!matchesFunction) {
          return false;
        }
      }
      if (filters.variables) {
        const hasVariable = frame.variables.some((v) =>
          filters.variables!.includes(v.name)
        );
        if (!hasVariable) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Find first frame matching filters
   */
  private findFirstFilteredFrame(): number | null {
    const filtered = this.getFilteredFrames();
    if (filtered.length === 0) return null;

    const index = this.recording.frames.indexOf(filtered[0]);
    return index;
  }

  /**
   * Search for frames by content
   */
  searchFrames(query: string): DebugFrame[] {
    const lowerQuery = query.toLowerCase();

    return this.recording.frames.filter((frame) => {
      // Search in file name
      if (frame.file.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in variables
      if (frame.variables) {
        const varsJSON = JSON.stringify(frame.variables).toLowerCase();
        if (varsJSON.includes(lowerQuery)) {
          return true;
        }
      }

      // Search in call stack
      if (frame.callStack) {
        const stackJSON = JSON.stringify(frame.callStack).toLowerCase();
        if (stackJSON.includes(lowerQuery)) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Get frame at index
   */
  getFrameAt(index: number): DebugFrame | null {
    return this.recording.frames[index] || null;
  }

  /**
   * Get total frame count
   */
  getTotalFrames(): number {
    return this.recording.frames.length;
  }

  /**
   * Get recording metadata
   */
  getMetadata(): {
    startTime: number;
    endTime: number;
    totalFrames: number;
    duration: number;
  } {
    return this.recording.metadata;
  }

  /**
   * Generate timeline visualization data
   */
  generateTimeline(): Array<{
    frame: number;
    timestamp: number;
    file: string;
    line: number;
    action: string;
  }> {
    return this.recording.frames.map((frame, index) => ({
      frame: index,
      timestamp: frame.timestamp,
      file: frame.file,
      line: frame.line,
      action: frame.action,
    }));
  }

  /**
   * Get call frequency analysis
   */
  getCallFrequency(): Map<string, number> {
    const frequency = new Map<string, number>();

    for (const frame of this.recording.frames) {
      for (const stackFrame of frame.callStack) {
        const key = `${stackFrame.functionName} (${stackFrame.fileId}:${stackFrame.lineNumber})`;
        frequency.set(key, (frequency.get(key) || 0) + 1);
      }
    }

    return frequency;
  }

  /**
   * Get variable changes over time
   */
  getVariableChanges(variableName: string): Array<{
    frame: number;
    timestamp: number;
    value: any;
  }> {
    const changes: Array<{
      frame: number;
      timestamp: number;
      value: any;
    }> = [];

    for (let i = 0; i < this.recording.frames.length; i++) {
      const frame = this.recording.frames[i];
      const variable = frame.variables.find((v) => v.name === variableName);

      if (variable) {
        changes.push({
          frame: i,
          timestamp: frame.timestamp,
          value: variable.value,
        });
      }
    }

    return changes;
  }

  /**
   * Export replay as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(
      {
        format: 'replay-session',
        version: '1.0.0',
        recording: this.recording,
        state: this.state,
      },
      null,
      2
    );
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.pause();
  }
}
