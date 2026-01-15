/**
 * Error Grouping Module
 * Groups similar errors using fingerprinting and intelligent deduplication
 */

import crypto from 'crypto';
import {
  ErrorEvent,
  ErrorGroup,
  ErrorCategory,
  ErrorSeverity,
  ErrorPriority,
  ErrorStatus
} from '../types';

// ============================================================================
// Fingerprint Generator
// ============================================================================

export class FingerprintGenerator {
  /**
   * Generate a unique fingerprint for an error event
   */
  static generate(event: ErrorEvent): string {
    // Combine multiple factors for fingerprinting
    const factors = [
      event.type,
      this.normalizeMessage(event.message),
      this.getStackSignature(event.stackFrames),
      event.category,
      event.environment
    ];

    const fingerprintString = factors.join('|');

    // Create hash
    return crypto
      .createHash('sha256')
      .update(fingerprintString)
      .digest('hex');
  }

  /**
   * Normalize error message for fingerprinting
   */
  private static normalizeMessage(message: string): string {
    // Remove dynamic values like IDs, timestamps, UUIDs
    return message
      .replace(/\b\d{10,13}\b/g, 'TIMESTAMP') // Unix timestamps
      .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?\b/g, 'ISO_DATE') // ISO dates
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'UUID') // UUIDs
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP_ADDRESS') // IP addresses
      .replace(/\/[a-f0-9]{24,}/gi, '/:ID') // MongoDB ObjectIds
      .replace(/\/\d+/g, '/:ID') // Numeric IDs in URLs
      .replace(/'\d+'/g, "':ID'") // Numeric IDs in strings
      .replace(/"\d+"/g, '":ID"') // Numeric IDs in double-quoted strings
      .replace(/:id[^a-z]/gi, ':ID') // Parameterized IDs
      .replace(/[0-9a-f]{40,}/gi, 'HASH') // Git hashes, etc.
      .replace(/token=[^&\s]+/gi, 'token=REDACTED') // Tokens
      .replace(/key=[^&\s]+/gi, 'key=REDACTED') // API keys
      .toLowerCase();
  }

  /**
   * Get stack signature from stack frames
   */
  private static getStackSignature(frames?: any[]): string {
    if (!frames || frames.length === 0) {
      return 'no-stack';
    }

    // Use top 3 frames
    const relevantFrames = frames.slice(0, 3);
    return relevantFrames
      .map((frame: any) => {
        const func = frame.functionName || '(anonymous)';
        const file = this.normalizeFilePath(frame.filename || '(unknown)');
        return `${func}@${file}`;
      })
      .join('|');
  }

  /**
   * Normalize file paths for fingerprinting
   */
  private static normalizeFilePath(path: string): string {
    return path
      .replace(/\/node_modules\/([^\/]+)/, '/node_modules/PACKAGE')
      .replace(/\/[\w-]+-\d+\.\d+\.\d+/, '/PACKAGE-VERSION')
      .replace(/\.min\.js/g, '.js')
      .replace(/\[hash\]/g, '[HASH]')
      .replace(/\[chunkhash\]/g, '[CHUNKHASH]')
      .replace(/\/src\/.*\.tsx?$/, '/src/FILE.ts')
      .replace(/\/lib\/.*\.js$/, '/lib/FILE.js');
  }
}

// ============================================================================
// Similarity Calculator
// ============================================================================

export class SimilarityCalculator {
  /**
   * Calculate similarity between two error events (0-1)
   */
  static calculate(event1: ErrorEvent, event2: ErrorEvent): number {
    let score = 0;
    let weightSum = 0;

    // Type match (weight: 0.2)
    if (event1.type === event2.type) {
      score += 0.2;
    }
    weightSum += 0.2;

    // Category match (weight: 0.15)
    if (event1.category === event2.category) {
      score += 0.15;
    }
    weightSum += 0.15;

    // Message similarity (weight: 0.3)
    const messageSim = this.stringSimilarity(
      this.normalizeMessage(event1.message),
      this.normalizeMessage(event2.message)
    );
    score += messageSim * 0.3;
    weightSum += 0.3;

    // Stack similarity (weight: 0.35)
    const stackSim = this.stackSimilarity(event1.stackFrames, event2.stackFrames);
    score += stackSim * 0.35;
    weightSum += 0.35;

    return score / weightSum;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLen = Math.max(str1.length, str2.length);
    return 1 - distance / maxLen;
  }

  /**
   * Calculate stack similarity
   */
  private static stackSimilarity(
    frames1?: any[],
    frames2?: any[]
  ): number {
    if (!frames1 || !frames2) {
      return frames1 === frames2 ? 1 : 0;
    }

    if (frames1.length === 0 && frames2.length === 0) {
      return 1;
    }

    const len = Math.min(frames1.length, frames2.length, 5);
    if (len === 0) return 0;

    let matchCount = 0;
    for (let i = 0; i < len; i++) {
      const f1 = frames1[i];
      const f2 = frames2[i];

      if (f1.functionName === f2.functionName &&
          this.filePathSimilar(f1.filename, f2.filename)) {
        matchCount++;
      }
    }

    return matchCount / len;
  }

  /**
   * Check if file paths are similar
   */
  private static filePathSimilar(path1?: string, path2?: string): boolean {
    if (!path1 || !path2) return path1 === path2;

    // Extract file names and compare
    const file1 = path1.split('/').pop();
    const file2 = path2.split('/').pop();

    return file1 === file2;
  }

  /**
   * Normalize error message
   */
  private static normalizeMessage(message: string): string {
    return FingerprintGenerator['normalizeMessage'](message);
  }
}

// ============================================================================
// Error Grouper
// ============================================================================

export class ErrorGrouper {
  private groups: Map<string, ErrorGroup> = new Map();
  private similarityThreshold: number = 0.8;

  constructor(similarityThreshold: number = 0.8) {
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Add an error to a group (creates or updates)
   */
  addError(error: ErrorEvent): ErrorGroup {
    const fingerprint = FingerprintGenerator.generate(error);
    error.fingerprint = fingerprint;

    // Try to find existing group
    let group = this.findGroup(error);

    if (!group) {
      // Create new group
      group = this.createGroup(error);
      this.groups.set(group.id, group);
    } else {
      // Update existing group
      this.updateGroup(group, error);
    }

    return group;
  }

  /**
   * Find existing group for error
   */
  private findGroup(error: ErrorEvent): ErrorGroup | null {
    const fingerprint = FingerprintGenerator.generate(error);

    // First try exact fingerprint match
    const exactMatch = Array.from(this.groups.values()).find(
      g => g.fingerprint === fingerprint
    );

    if (exactMatch) {
      return exactMatch;
    }

    // Then try similarity-based matching
    for (const group of this.groups.values()) {
      // Compare with most recent error in group
      const mostRecent = group.errors[0];
      const similarity = SimilarityCalculator.calculate(error, mostRecent);

      if (similarity >= this.similarityThreshold) {
        return group;
      }
    }

    return null;
  }

  /**
   * Create new error group
   */
  private createGroup(error: ErrorEvent): ErrorGroup {
    const now = Date.now();
    const group: ErrorGroup = {
      id: `group-${error.id}`,
      fingerprint: error.fingerprint!,
      title: this.generateGroupTitle(error),
      type: error.type,
      message: error.message,
      severity: error.severity,
      category: error.category,
      priority: error.priority,
      status: ErrorStatus.NEW,
      firstSeen: now,
      lastSeen: now,
      occurrences: 1,
      affectedUsers: error.user ? 1 : 0,
      errors: [error],
      patterns: [],
      potentialCauses: [],
      suggestedFixes: [],
      relatedIssues: [],
      metadata: {
        environment: error.environment,
        release: error.release
      }
    };

    // Group error
    error.groupId = group.id;

    return group;
  }

  /**
   * Update existing group with new error
   */
  private updateGroup(group: ErrorGroup, error: ErrorEvent): void {
    const now = Date.now();

    // Update group properties
    group.lastSeen = now;
    group.occurrences++;

    // Add error if not already present
    if (!group.errors.find(e => e.id === error.id)) {
      group.errors.unshift(error);

      // Keep only last 100 errors
      if (group.errors.length > 100) {
        group.errors = group.errors.slice(0, 100);
      }

      // Update affected users count
      if (error.user) {
        const uniqueUsers = new Set(
          group.errors
            .filter(e => e.user?.id)
            .map(e => e.user!.id!)
        );
        group.affectedUsers = uniqueUsers.size;
      }

      // Recalculate priority if needed
      if (error.priority < group.priority) {
        group.priority = error.priority;
      }

      // Upgrade severity if needed
      if (this.shouldUpgradeSeverity(group.severity, error.severity)) {
        group.severity = error.severity;
      }
    }

    // Group error
    error.groupId = group.id;
  }

  /**
   * Generate human-readable group title
   */
  private generateGroupTitle(error: ErrorEvent): string {
    const location = this.getErrorLocation(error);
    return `${error.type}: ${error.message}${location ? ` at ${location}` : ''}`;
  }

  /**
   * Get error location from stack frames
   */
  private getErrorLocation(error: ErrorEvent): string | null {
    if (!error.stackFrames || error.stackFrames.length === 0) {
      return null;
    }

    const frame = error.stackFrames[0];
    const filename = frame.filename || '(unknown)';
    const line = frame.lineNumber || '?';
    const column = frame.columnNumber || '?';

    // Extract just the filename from path
    const name = filename.split('/').pop() || filename;
    return `${name}:${line}:${column}`;
  }

  /**
   * Determine if severity should be upgraded
   */
  private shouldUpgradeSeverity(
    current: ErrorSeverity,
    newSeverity: ErrorSeverity
  ): boolean {
    const severityOrder = [
      ErrorSeverity.INFO,
      ErrorSeverity.LOW,
      ErrorSeverity.MEDIUM,
      ErrorSeverity.HIGH,
      ErrorSeverity.CRITICAL
    ];

    return severityOrder.indexOf(newSeverity) > severityOrder.indexOf(current);
  }

  /**
   * Get group by ID
   */
  getGroup(id: string): ErrorGroup | null {
    return this.groups.get(id) || null;
  }

  /**
   * Get all groups
   */
  getAllGroups(): ErrorGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get groups filtered by criteria
   */
  getFilteredGroups(filter: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    status?: ErrorStatus;
    environment?: string;
    minOccurrences?: number;
  }): ErrorGroup[] {
    return this.getAllGroups().filter(group => {
      if (filter.severity && group.severity !== filter.severity) {
        return false;
      }
      if (filter.category && group.category !== filter.category) {
        return false;
      }
      if (filter.status && group.status !== filter.status) {
        return false;
      }
      if (filter.environment && group.metadata.environment !== filter.environment) {
        return false;
      }
      if (filter.minOccurrences && group.occurrences < filter.minOccurrences) {
        return false;
      }
      return true;
    });
  }

  /**
   * Merge multiple groups
   */
  mergeGroups(groupIds: string[]): ErrorGroup | null {
    if (groupIds.length === 0) return null;

    // Sort by firstSeen to use oldest as base
    const sortedGroups = groupIds
      .map(id => this.groups.get(id))
      .filter((g): g is ErrorGroup => g !== undefined)
      .sort((a, b) => a.firstSeen - b.firstSeen);

    if (sortedGroups.length === 0) return null;

    const baseGroup = sortedGroups[0];
    const groupsToMerge = sortedGroups.slice(1);

    // Merge errors
    for (const group of groupsToMerge) {
      for (const error of group.errors) {
        if (!baseGroup.errors.find(e => e.id === error.id)) {
          baseGroup.errors.push(error);
          error.groupId = baseGroup.id;
        }
      }
    }

    // Update metadata
    baseGroup.occurrences = baseGroup.errors.length;
    baseGroup.lastSeen = Math.max(...sortedGroups.map(g => g.lastSeen));

    // Calculate unique affected users
    const uniqueUsers = new Set(
      baseGroup.errors
        .filter(e => e.user?.id)
        .map(e => e.user!.id!)
    );
    baseGroup.affectedUsers = uniqueUsers.size;

    // Remove merged groups
    for (const group of groupsToMerge) {
      this.groups.delete(group.id);
    }

    // Update base group in map
    this.groups.set(baseGroup.id, baseGroup);

    return baseGroup;
  }

  /**
   * Split a group into multiple groups
   */
  splitGroup(groupId: string, criteria: (error: ErrorEvent) => string): ErrorGroup[] {
    const group = this.groups.get(groupId);
    if (!group) return [];

    // Create subgroups based on criteria
    const subgroups = new Map<string, ErrorEvent[]>();

    for (const error of group.errors) {
      const key = criteria(error);
      if (!subgroups.has(key)) {
        subgroups.set(key, []);
      }
      subgroups.get(key)!.push(error);
    }

    // Create new groups for each subgroup
    const newGroups: ErrorGroup[] = [];

    for (const [key, errors] of subgroups.entries()) {
      if (errors.length === group.errors.length) {
        // No split needed
        continue;
      }

      // Create new group
      const firstError = errors[0];
      const newGroup: ErrorGroup = {
        id: `group-${firstError.id}`,
        fingerprint: key,
        title: `${group.title} [${key}]`,
        type: group.type,
        message: group.message,
        severity: group.severity,
        category: group.category,
        priority: group.priority,
        status: group.status,
        firstSeen: Math.min(...errors.map(e => e.timestamp)),
        lastSeen: Math.max(...errors.map(e => e.timestamp)),
        occurrences: errors.length,
        affectedUsers: new Set(errors.filter(e => e.user?.id).map(e => e.user!.id!)).size,
        errors,
        patterns: [],
        potentialCauses: [],
        suggestedFixes: [],
        relatedIssues: [],
        metadata: { ...group.metadata }
      };

      // Update error groupIds
      for (const error of errors) {
        error.groupId = newGroup.id;
      }

      newGroups.push(newGroup);
      this.groups.set(newGroup.id, newGroup);
    }

    // Remove original group if split
    if (newGroups.length > 0) {
      this.groups.delete(groupId);
    }

    return newGroups.length > 0 ? newGroups : [group];
  }

  /**
   * Update group status
   */
  updateGroupStatus(groupId: string, status: ErrorStatus): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.status = status;
    }
  }

  /**
   * Delete group
   */
  deleteGroup(groupId: string): void {
    this.groups.delete(groupId);
  }

  /**
   * Get group statistics
   */
  getStatistics(): {
    totalGroups: number;
    totalErrors: number;
    groupsBySeverity: Record<ErrorSeverity, number>;
    groupsByCategory: Record<ErrorCategory, number>;
    groupsByStatus: Record<ErrorStatus, number>;
  } {
    const groups = this.getAllGroups();
    const totalGroups = groups.length;
    const totalErrors = groups.reduce((sum, g) => sum + g.occurrences, 0);

    const groupsBySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.CRITICAL]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.INFO]: 0
    };

    const groupsByCategory: Record<string, number> = {};
    const groupsByStatus: Record<string, number> = {};

    for (const group of groups) {
      groupsBySeverity[group.severity]++;
      groupsByCategory[group.category] = (groupsByCategory[group.category] || 0) + 1;
      groupsByStatus[group.status] = (groupsByStatus[group.status] || 0) + 1;
    }

    return {
      totalGroups,
      totalErrors,
      groupsBySeverity,
      groupsByCategory: groupsByCategory as Record<ErrorCategory, number>,
      groupsByStatus: groupsByStatus as Record<ErrorStatus, number>
    };
  }

  /**
   * Clear all groups
   */
  clear(): void {
    this.groups.clear();
  }
}
