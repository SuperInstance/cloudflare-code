/**
 * Change Tracker
 *
 * Tracks changes made during refactoring operations.
 */

export interface CodeChange {
  filePath: string;
  startLine: number;
  endLine: number;
  type: 'insert' | 'delete' | 'replace' | 'move' | 'rename';
  description: string;
  oldContent?: string;
  newContent?: string;
}

export class ChangeTracker {
  private changes: CodeChange[] = [];

  /**
   * Calculate changes between original and new content
   */
  calculateChanges(original: string, modified: string): CodeChange[] {
    const changes: CodeChange[] = [];
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');

    // Simple line-by-line diff
    const maxLines = Math.max(originalLines.length, modifiedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i];
      const modifiedLine = modifiedLines[i];

      if (originalLine === undefined && modifiedLine !== undefined) {
        // Insertion
        changes.push({
          filePath: '',
          startLine: i + 1,
          endLine: i + 1,
          type: 'insert',
          description: 'Insert line',
          newContent: modifiedLine
        });
      } else if (originalLine !== undefined && modifiedLine === undefined) {
        // Deletion
        changes.push({
          filePath: '',
          startLine: i + 1,
          endLine: i + 1,
          type: 'delete',
          description: 'Delete line',
          oldContent: originalLine
        });
      } else if (originalLine !== modifiedLine) {
        // Replacement
        changes.push({
          filePath: '',
          startLine: i + 1,
          endLine: i + 1,
          type: 'replace',
          description: 'Modify line',
          oldContent: originalLine,
          newContent: modifiedLine
        });
      }
    }

    return changes;
  }

  /**
   * Add a change to the tracker
   */
  addChange(change: CodeChange): void {
    this.changes.push(change);
  }

  /**
   * Get all tracked changes
   */
  getChanges(): CodeChange[] {
    return [...this.changes];
  }

  /**
   * Clear all tracked changes
   */
  clear(): void {
    this.changes = [];
  }

  /**
   * Merge consecutive changes
   */
  mergeChanges(changes: CodeChange[]): CodeChange[] {
    if (changes.length === 0) {
      return [];
    }

    const merged: CodeChange[] = [];
    let current = { ...changes[0] };

    for (let i = 1; i < changes.length; i++) {
      const next = changes[i];

      if (current.type === next.type && current.endLine + 1 === next.startLine) {
        // Merge consecutive changes of the same type
        current.endLine = next.endLine;
        current.description = `${current.description} and ${next.description}`;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Reverse changes for rollback
   */
  reverseChanges(changes: CodeChange[]): CodeChange[] {
    return changes.map(change => {
      const reversed: CodeChange = {
        ...change,
        oldContent: change.newContent,
        newContent: change.oldContent
      };

      switch (change.type) {
        case 'insert':
          reversed.type = 'delete';
          break;
        case 'delete':
          reversed.type = 'insert';
          break;
      }

      return reversed;
    });
  }
}
