/**
 * Comment Preserver
 *
 * Preserves comments during AST transformations.
 */

import * as t from '@babel/types';

export interface CommentMap {
  [key: string]: t.Comment[];
}

export class CommentPreserver {
  private comments: Map<string, t.Comment[]> = new Map();

  /**
   * Extract all comments from AST
   */
  extractComments(ast: t.Node): void {
    this.comments.clear();

    const traverse = require('@babel/traverse').default;

    traverse(ast, {
      enter(path) {
        if (path.node.leadingComments) {
          const key = this.getNodeKey(path.node);
          this.comments.set(key + '-leading', [...path.node.leadingComments]);
        }

        if (path.node.trailingComments) {
          const key = this.getNodeKey(path.node);
          this.comments.set(key + '-trailing', [...path.node.trailingComments]);
        }

        if (path.node.innerComments) {
          const key = this.getNodeKey(path.node);
          this.comments.set(key + '-inner', [...path.node.innerComments]);
        }
      }
    });
  }

  /**
   * Restore comments to AST
   */
  restoreComments(ast: t.Node): void {
    const traverse = require('@babel/traverse').default;

    traverse(ast, {
      enter(path) {
        const key = this.getNodeKey(path.node);

        const leading = this.comments.get(key + '-leading');
        if (leading) {
          path.node.leadingComments = leading;
        }

        const trailing = this.comments.get(key + '-trailing');
        if (trailing) {
          path.node.trailingComments = trailing;
        }

        const inner = this.comments.get(key + '-inner');
        if (inner) {
          path.node.innerComments = inner;
        }
      }
    });
  }

  /**
   * Get comment for a specific node
   */
  getComment(node: t.Node, type: 'leading' | 'trailing' | 'inner' = 'leading'): t.Comment[] | undefined {
    const key = this.getNodeKey(node);
    return this.comments.get(key + '-' + type);
  }

  /**
   * Set comment for a specific node
   */
  setComment(node: t.Node, comments: t.Comment[], type: 'leading' | 'trailing' | 'inner' = 'leading'): void {
    const key = this.getNodeKey(node);
    this.comments.set(key + '-' + type, comments);
  }

  /**
   * Remove all comments from AST (temporary)
   */
  removeComments(ast: t.Node): void {
    const traverse = require('@babel/traverse').default;

    traverse(ast, {
      enter(path) {
        delete path.node.leadingComments;
        delete path.node.trailingComments;
        delete path.node.innerComments;
      }
    });
  }

  /**
   * Generate unique key for a node
   */
  private getNodeKey(node: t.Node): string {
    if (node.loc) {
      return `${node.loc.start.line}:${node.loc.start.column}`;
    }

    return `${node.type}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clone comment map
   */
  clone(): CommentPreserver {
    const preserver = new CommentPreserver();
    preserver.comments = new Map(this.comments);
    return preserver;
  }

  /**
   * Merge comment maps
   */
  merge(other: CommentPreserver): void {
    for (const [key, comments] of other.comments) {
      if (!this.comments.has(key)) {
        this.comments.set(key, comments);
      }
    }
  }

  /**
   * Clear all comments
   */
  clear(): void {
    this.comments.clear();
  }

  /**
   * Get all comments
   */
  getAllComments(): Map<string, t.Comment[]> {
    return new Map(this.comments);
  }

  /**
   * Filter comments by type
   */
  filterComments(type: 'CommentLine' | 'CommentBlock'): t.Comment[] {
    const allComments: t.Comment[] = [];

    for (const comments of this.comments.values()) {
      for (const comment of comments) {
        if (comment.type === type) {
          allComments.push(comment);
        }
      }
    }

    return allComments;
  }

  /**
   * Get comments by line number
   */
  getCommentsAtLine(line: number): t.Comment[] {
    const comments: t.Comment[] = [];

    for (const commentArray of this.comments.values()) {
      for (const comment of commentArray) {
        if (comment.loc && comment.loc.start.line === line) {
          comments.push(comment);
        }
      }
    }

    return comments;
  }
}
