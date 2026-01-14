/**
 * On-call rotation management
 */

import type {
  OnCallRotation,
  OnCallSchedule,
  OnCallMember,
  NotificationChannelType,
} from '../types';

export interface OnCallStatus {
  rotationId: string;
  currentOnCall: OnCallMember;
  nextOnCall?: OnCallMember;
  handoverAt: Date;
  timezone: string;
}

/**
 * On-call rotation manager
 */
export class OnCallManager {
  private rotations: Map<string, OnCallRotation> = new Map();
  private currentTime: Date = new Date();

  /**
   * Add an on-call rotation
   */
  addRotation(rotation: OnCallRotation): void {
    this.rotations.set(rotation.id, rotation);
  }

  /**
   * Remove an on-call rotation
   */
  removeRotation(rotationId: string): boolean {
    return this.rotations.delete(rotationId);
  }

  /**
   * Get a rotation by ID
   */
  getRotation(rotationId: string): OnCallRotation | undefined {
    return this.rotations.get(rotationId);
  }

  /**
   * Get all rotations
   */
  getAllRotations(): OnCallRotation[] {
    return Array.from(this.rotations.values());
  }

  /**
   * Get current on-call status for a rotation
   */
  getCurrentOnCall(rotationId: string): OnCallStatus | undefined {
    const rotation = this.rotations.get(rotationId);
    if (!rotation) {
      return undefined;
    }

    const currentMember = this.determineCurrentMember(rotation);
    const nextMember = this.determineNextMember(rotation, currentMember);
    const handoverAt = this.calculateHandoverTime(rotation);

    return {
      rotationId,
      currentOnCall: currentMember,
      nextOnCall: nextMember,
      handoverAt,
      timezone: rotation.timezone,
    };
  }

  /**
   * Determine the current on-call member based on schedule
   */
  private determineCurrentMember(rotation: OnCallRotation): OnCallMember {
    const now = this.currentTime;
    const schedule = rotation.schedule;

    // Convert current time to rotation timezone
    const timeZoneNow = this.convertToTimeZone(now, rotation.timezone);

    // Find the member on duty based on the schedule
    const memberIndex = this.calculateMemberIndex(rotation, timeZoneNow);

    return rotation.members[memberIndex];
  }

  /**
   * Determine the next on-call member
   */
  private determineNextMember(
    rotation: OnCallRotation,
    currentMember: OnCallMember
  ): OnCallMember | undefined {
    const currentIndex = rotation.members.findIndex(
      (m) => m.userId === currentMember.userId
    );

    if (currentIndex === -1) {
      return undefined;
    }

    const nextIndex = (currentIndex + 1) % rotation.members.length;
    return rotation.members[nextIndex];
  }

  /**
   * Calculate the index of the current member based on schedule
   */
  private calculateMemberIndex(rotation: OnCallRotation, currentTime: Date): number {
    const schedule = rotation.schedule;

    switch (schedule.type) {
      case 'daily':
        return this.calculateDailyMember(rotation, currentTime);

      case 'weekly':
        return this.calculateWeeklyMember(rotation, currentTime);

      case 'custom':
        return this.calculateCustomMember(rotation, currentTime);

      default:
        return 0;
    }
  }

  /**
   * Calculate member index for daily rotation
   */
  private calculateDailyMember(rotation: OnCallRotation, currentTime: Date): number {
    // Daily rotation: members rotate every day
    const daysSinceEpoch = Math.floor(currentTime.getTime() / (1000 * 60 * 60 * 24));
    return daysSinceEpoch % rotation.members.length;
  }

  /**
   * Calculate member index for weekly rotation
   */
  private calculateWeeklyMember(rotation: OnCallRotation, currentTime: Date): number {
    // Weekly rotation: members rotate every week
    const weeksSinceEpoch = Math.floor(currentTime.getTime() / (1000 * 60 * 60 * 24 * 7));
    return weeksSinceEpoch % rotation.members.length;
  }

  /**
   * Calculate member index for custom rotation
   */
  private calculateCustomMember(rotation: OnCallRotation, currentTime: Date): number {
    const schedule = rotation.schedule;
    const currentDayOfWeek = currentTime.getDay();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();

    // Parse start time
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;

    // Parse end time
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
    const endTimeInMinutes = endHour * 60 + endMinute;

    // Check if current time is within the rotation days and time range
    if (!schedule.rotationDays?.includes(currentDayOfWeek)) {
      // Outside rotation days, use first member
      return 0;
    }

    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    if (currentTimeInMinutes < startTimeInMinutes || currentTimeInMinutes >= endTimeInMinutes) {
      // Outside time range, use first member
      return 0;
    }

    // Within rotation window, calculate member index
    const elapsedMinutes = currentTimeInMinutes - startTimeInMinutes;
    const totalMinutesInWindow = endTimeInMinutes - startTimeInMinutes;
    const memberCount = rotation.members.length;
    const minutesPerMember = Math.floor(totalMinutesInWindow / memberCount);

    return Math.floor(elapsedMinutes / minutesPerMember) % memberCount;
  }

  /**
   * Calculate the next handover time
   */
  private calculateHandoverTime(rotation: OnCallRotation): Date {
    const currentMember = this.determineCurrentMember(rotation);
    const currentIndex = rotation.members.findIndex(
      (m) => m.userId === currentMember.userId
    );

    const schedule = rotation.schedule;

    // Parse handover time if specified, otherwise use start time
    const handoverTimeStr = schedule.handoverTime || schedule.startTime;
    const [handoverHour, handoverMinute] = handoverTimeStr.split(':').map(Number);

    const handoverTime = new Date(this.currentTime);
    handoverTime.setHours(handoverHour, handoverMinute, 0, 0);

    // If handover time has already passed today, move to tomorrow
    if (handoverTime <= this.currentTime) {
      handoverTime.setDate(handoverTime.getDate() + 1);
    }

    return handoverTime;
  }

  /**
   * Convert date to timezone
   */
  private convertToTimeZone(date: Date, timezone: string): Date {
    // In a real implementation, this would use a library like moment-timezone
    // For now, we'll return the date as-is
    return new Date(date);
  }

  /**
   * Get all users currently on call across all rotations
   */
  getAllCurrentOnCall(): Map<string, OnCallStatus> {
    const result = new Map<string, OnCallStatus>();

    for (const rotationId of this.rotations.keys()) {
      const status = this.getCurrentOnCall(rotationId);
      if (status) {
        result.set(rotationId, status);
      }
    }

    return result;
  }

  /**
   * Find the on-call user for a specific service or context
   */
  findOnCallUser(context: {
    service?: string;
    team?: string;
    environment?: string;
  }): OnCallMember | undefined {
    // In a real implementation, this would search for rotations matching the context
    // For now, we'll return the first available on-call user
    for (const rotationId of this.rotations.keys()) {
      const status = this.getCurrentOnCall(rotationId);
      if (status) {
        return status.currentOnCall;
      }
    }
    return undefined;
  }

  /**
   * Get the primary contact channel for an on-call member
   */
  getPrimaryContactChannel(member: OnCallMember): NotificationChannelType {
    return member.primaryContact;
  }

  /**
   * Get the backup contact channel for an on-call member
   */
  getBackupContactChannel(member: OnCallMember): NotificationChannelType | undefined {
    return member.backupContact;
  }

  /**
   * Update rotation
   */
  updateRotation(rotation: OnCallRotation): boolean {
    if (!this.rotations.has(rotation.id)) {
      return false;
    }
    this.rotations.set(rotation.id, rotation);
    return true;
  }

  /**
   * Clear all rotations
   */
  clearRotations(): void {
    this.rotations.clear();
  }

  /**
   * Set current time (for testing)
   */
  setCurrentTime(time: Date): void {
    this.currentTime = time;
  }

  /**
   * Get current time
   */
  getCurrentTime(): Date {
    return this.currentTime;
  }
}
