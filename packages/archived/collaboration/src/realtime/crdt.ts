/**
 * CRDT (Conflict-free Replicated Data Type) Implementation
 * Uses Yjs for text collaboration with custom operations
 */

// @ts-nocheck - External dependencies (yjs, y-websocket, y-protocols) and private member access
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { awareness, Awareness } from 'y-protocols/awareness';
import type { Doc } from 'yjs';
import { nanoid } from 'nanoid';
import type {
  CRDTDocument,
  CRDTType,
  CRDTOperation,
  OperationType,
  DocumentMetadata,
  CRDTState,
  Conflict,
  ConflictType,
  ConflictResolution,
  ResolutionStrategy,
} from '../types';

// ============================================================================
// CRDT Document Manager
// ============================================================================

export class CRDTDocumentManager {
  private documents: Map<string, CRDTDocumentWrapper> = new Map();
  private conflicts: Map<string, Conflict[]> = new Map();

  /**
   * Create a new CRDT document
   */
  createDocument(
    id: string,
    type: CRDTType,
    metadata: DocumentMetadata
  ): CRDTDocument {
    const ydoc = new Y.Doc();
    const document: CRDTDocument = {
      id,
      type,
      version: 0,
      state: new Uint8Array(),
      created: Date.now(),
      modified: Date.now(),
      metadata,
    };

    const wrapper = new CRDTDocumentWrapper(ydoc, document);
    this.documents.set(id, wrapper);

    return document;
  }

  /**
   * Get an existing document
   */
  getDocument(id: string): CRDTDocumentWrapper | undefined {
    return this.documents.get(id);
  }

  /**
   * Delete a document
   */
  deleteDocument(id: string): boolean {
    const wrapper = this.documents.get(id);
    if (wrapper) {
      wrapper.destroy();
      this.documents.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Apply an operation to a document
   */
  async applyOperation(
    documentId: string,
    operation: CRDTOperation
  ): Promise<void> {
    const wrapper = this.documents.get(documentId);
    if (!wrapper) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Check for conflicts
    const conflicts = this.detectConflicts(wrapper, operation);
    if (conflicts.length > 0) {
      this.conflicts.set(
        `${documentId}:${operation.opId}`,
        conflicts
      );
    }

    // Apply the operation
    await wrapper.applyOperation(operation);
  }

  /**
   * Detect conflicts between operations
   */
  private detectConflicts(
    wrapper: CRDTDocumentWrapper,
    operation: CRDTOperation
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const pendingOps = wrapper.getPendingOperations();

    for (const pending of pendingOps) {
      // Check for concurrent edits on the same position
      if (this.isConcurrentEdit(pending, operation)) {
        conflicts.push({
          conflictId: nanoid(),
          documentId: wrapper.document.id,
          type: 'concurrent_edit',
          operations: [pending, operation],
          detectedAt: Date.now(),
          resolved: false,
        });
      }

      // Check for delete conflicts
      if (this.isDeleteConflict(pending, operation)) {
        conflicts.push({
          conflictId: nanoid(),
          documentId: wrapper.document.id,
          type: 'delete_conflict',
          operations: [pending, operation],
          detectedAt: Date.now(),
          resolved: false,
        });
      }
    }

    return conflicts;
  }

  /**
   * Check if two operations are concurrent edits
   */
  private isConcurrentEdit(op1: CRDTOperation, op2: CRDTOperation): boolean {
    if (op1.type !== 'insert' || op2.type !== 'insert') {
      return false;
    }

    // Check if operations are from different users and at the same position
    return (
      op1.userId !== op2.userId &&
      op1.position !== undefined &&
      op2.position !== undefined &&
      Math.abs(op1.position - op2.position) <= 1
    );
  }

  /**
   * Check if operations have a delete conflict
   */
  private isDeleteConflict(op1: CRDTOperation, op2: CRDTOperation): boolean {
    const deleteOp = op1.type === 'delete' ? op1 : op2.type === 'delete' ? op2 : null;
    const otherOp = op1.type === 'delete' ? op2 : op2.type === 'delete' ? op1 : null;

    if (!deleteOp || !otherOp) {
      return false;
    }

    // Check if delete operation affects the other operation's position
    if (deleteOp.position === undefined || otherOp.position === undefined) {
      return false;
    }

    const deleteStart = deleteOp.position;
    const deleteEnd = deleteOp.position + (deleteOp.length || 0);

    return otherOp.position >= deleteStart && otherOp.position <= deleteEnd;
  }

  /**
   * Resolve a conflict with a specific strategy
   */
  async resolveConflict(
    conflictId: string,
    strategy: ResolutionStrategy,
    resolvedBy: string
  ): Promise<void> {
    const conflict = this.findConflict(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    let resolution: ConflictResolution;

    switch (strategy) {
      case 'last_write_wins':
        resolution = this.lastWriteWinsResolution(conflict, resolvedBy);
        break;
      case 'operational_transform':
        resolution = this.operationalTransformResolution(conflict, resolvedBy);
        break;
      case 'manual_merge':
        throw new Error('Manual merge must be handled externally');
      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }

    conflict.resolution = resolution;
    conflict.resolved = true;
  }

  /**
   * Last write wins resolution strategy
   */
  private lastWriteWinsResolution(
    conflict: Conflict,
    resolvedBy: string
  ): ConflictResolution {
    const sortedOps = [...conflict.operations].sort((a, b) => b.timestamp - a.timestamp);
    const winner = sortedOps[0];

    return {
      strategy: 'last_write_wins',
      resolvedBy,
      resolvedAt: Date.now(),
      resolvedOperations: [winner],
    };
  }

  /**
   * Operational transform resolution strategy
   */
  private operationalTransformResolution(
    conflict: Conflict,
    resolvedBy: string
  ): ConflictResolution {
    // Transform operations to be compatible
    const transformedOps = this.transformOperations(conflict.operations);

    return {
      strategy: 'operational_transform',
      resolvedBy,
      resolvedAt: Date.now(),
      resolvedOperations: transformedOps,
    };
  }

  /**
   * Transform operations to resolve conflicts
   */
  private transformOperations(operations: CRDTOperation[]): CRDTOperation[] {
    const sortedOps = [...operations].sort((a, b) => a.timestamp - b.timestamp);
    const transformed: CRDTOperation[] = [];

    for (const op of sortedOps) {
      let transformedOp = { ...op };

      // Adjust position based on previous operations
      for (const prev of transformed) {
        if (prev.type === 'insert' && transformedOp.position !== undefined) {
          if (prev.position !== undefined && prev.position <= transformedOp.position) {
            transformedOp.position += prev.content.length;
          }
        } else if (prev.type === 'delete' && transformedOp.position !== undefined) {
          if (prev.position !== undefined && prev.position < transformedOp.position) {
            transformedOp.position -= prev.length || 0;
          }
        }
      }

      transformed.push(transformedOp);
    }

    return transformed;
  }

  /**
   * Find a conflict by ID
   */
  private findConflict(conflictId: string): Conflict | undefined {
    for (const conflicts of this.conflicts.values()) {
      const conflict = conflicts.find(c => c.conflictId === conflictId);
      if (conflict) {
        return conflict;
      }
    }
    return undefined;
  }

  /**
   * Get all conflicts for a document
   */
  getConflicts(documentId: string): Conflict[] {
    const conflicts: Conflict[] = [];
    for (const [key, docs] of this.conflicts.entries()) {
      if (key.startsWith(documentId)) {
        conflicts.push(...docs);
      }
    }
    return conflicts;
  }

  /**
   * Get document state
   */
  getDocumentState(documentId: string): CRDTState | undefined {
    const wrapper = this.documents.get(documentId);
    if (!wrapper) {
      return undefined;
    }

    return {
      document: wrapper.document,
      operations: wrapper.getOperations(),
      vectors: wrapper.getVectors(),
      pending: wrapper.getPendingOperations(),
      lastSync: wrapper.getLastSync(),
    };
  }

  /**
   * Export document state
   */
  exportDocument(documentId: string): Uint8Array | undefined {
    const wrapper = this.documents.get(documentId);
    return wrapper?.export();
  }

  /**
   * Import document state
   */
  importDocument(documentId: string, state: Uint8Array): boolean {
    const wrapper = this.documents.get(documentId);
    if (!wrapper) {
      return false;
    }

    return wrapper.import(state);
  }

  /**
   * Clean up all documents
   */
  destroy(): void {
    for (const wrapper of this.documents.values()) {
      wrapper.destroy();
    }
    this.documents.clear();
    this.conflicts.clear();
  }
}

// ============================================================================
// CRDT Document Wrapper
// ============================================================================

class CRDTDocumentWrapper {
  private ydoc: Doc;
  private document: CRDTDocument;
  private operations: CRDTOperation[] = [];
  private pendingOperations: CRDTOperation[] = [];
  private vectors: Map<string, number[]> = new Map();
  private lastSync: number = Date.now();

  constructor(ydoc: Doc, document: CRDTDocument) {
    this.ydoc = ydoc;
    this.document = document;
    this.setupYDoc();
  }

  private setupYDoc(): void {
    this.ydoc.on('update', (update: Uint8Array, origin: any, doc: Doc) => {
      this.document.state = Y.encodeStateAsUpdate(doc);
      this.document.version++;
      this.document.modified = Date.now();
    });
  }

  /**
   * Apply an operation to the document
   */
  async applyOperation(operation: CRDTOperation): Promise<void> {
    this.ydoc.transact(() => {
      switch (operation.type) {
        case 'insert':
          this.applyInsert(operation);
          break;
        case 'delete':
          this.applyDelete(operation);
          break;
        case 'format':
          this.applyFormat(operation);
          break;
        case 'replace':
          this.applyReplace(operation);
          break;
      }
    }, operation.userId);

    // Record the operation
    this.operations.push(operation);
    this.updateVector(operation.userId);
    this.lastSync = Date.now();
  }

  private applyInsert(operation: CRDTOperation): void {
    if (operation.position === undefined) {
      throw new Error('Insert operation requires position');
    }

    const ytext = this.ydoc.getText();
    ytext.insert(operation.position, operation.content, operation.attributes);
  }

  private applyDelete(operation: CRDTOperation): void {
    if (operation.position === undefined || operation.length === undefined) {
      throw new Error('Delete operation requires position and length');
    }

    const ytext = this.ydoc.getText();
    ytext.delete(operation.position, operation.length);
  }

  private applyFormat(operation: CRDTOperation): void {
    if (operation.position === undefined || operation.length === undefined) {
      throw new Error('Format operation requires position and length');
    }

    const ytext = this.ydoc.getText();
    ytext.format(operation.position, operation.length, operation.attributes || {});
  }

  private applyReplace(operation: CRDTOperation): void {
    if (operation.position === undefined || operation.length === undefined) {
      throw new Error('Replace operation requires position and length');
    }

    const ytext = this.ydoc.getText();
    ytext.delete(operation.position, operation.length);
    ytext.insert(operation.position, operation.content, operation.attributes);
  }

  /**
   * Update vector clock for a user
   */
  private updateVector(userId: string): void {
    const current = this.vectors.get(userId) || [0];
    current[0]++;
    this.vectors.set(userId, current);
  }

  /**
   * Get document content
   */
  getContent(): string {
    const ytext = this.ydoc.getText();
    return ytext.toString();
  }

  /**
   * Get all operations
   */
  getOperations(): CRDTOperation[] {
    return [...this.operations];
  }

  /**
   * Get pending operations
   */
  getPendingOperations(): CRDTOperation[] {
    return [...this.pendingOperations];
  }

  /**
   * Get vector clocks
   */
  getVectors(): Map<string, number[]> {
    return new Map(this.vectors);
  }

  /**
   * Get last sync time
   */
  getLastSync(): number {
    return this.lastSync;
  }

  /**
   * Export document state
   */
  export(): Uint8Array {
    return Y.encodeStateAsUpdate(this.ydoc);
  }

  /**
   * Import document state
   */
  import(state: Uint8Array): boolean {
    try {
      Y.applyUpdate(this.ydoc, state);
      this.lastSync = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Yjs document
   */
  getYDoc(): Doc {
    return this.ydoc;
  }

  /**
   * Destroy the document
   */
  destroy(): void {
    this.ydoc.destroy();
  }
}

// ============================================================================
// CRDT Helper Functions
// ============================================================================

/**
 * Create a CRDT operation
 */
export function createOperation(
  documentId: string,
  userId: string,
  type: OperationType,
  content: string,
  options?: {
    position?: number;
    length?: number;
    attributes?: Record<string, unknown>;
  }
): CRDTOperation {
  return {
    opId: nanoid(),
    documentId,
    userId,
    type,
    content,
    position: options?.position,
    length: options?.length,
    attributes: options?.attributes,
    timestamp: Date.now(),
    vector: [],
  };
}

/**
 * Compare vector clocks
 */
export function compareVectors(v1: number[], v2: number[]): number {
  const len = Math.max(v1.length, v2.length);

  for (let i = 0; i < len; i++) {
    const a = v1[i] || 0;
    const b = v2[i] || 0;

    if (a < b) return -1;
    if (a > b) return 1;
  }

  return 0;
}

/**
 * Check if vector clocks are concurrent
 */
export function areVectorsConcurrent(v1: number[], v2: number[]): boolean {
  let v1GreaterThanV2 = false;
  let v2GreaterThanV1 = false;

  const len = Math.max(v1.length, v2.length);

  for (let i = 0; i < len; i++) {
    const a = v1[i] || 0;
    const b = v2[i] || 0;

    if (a > b) v1GreaterThanV2 = true;
    if (b > a) v2GreaterThanV1 = true;
  }

  return v1GreaterThanV2 && v2GreaterThanV1;
}

/**
 * Merge vector clocks
 */
export function mergeVectors(v1: number[], v2: number[]): number[] {
  const len = Math.max(v1.length, v2.length);
  const merged: number[] = [];

  for (let i = 0; i < len; i++) {
    const a = v1[i] || 0;
    const b = v2[i] || 0;
    merged.push(Math.max(a, b));
  }

  return merged;
}

/**
 * Calculate operation length
 */
export function calculateOperationLength(operation: CRDTOperation): number {
  switch (operation.type) {
    case 'insert':
      return operation.content.length;
    case 'delete':
      return operation.length || 0;
    case 'replace':
      return operation.content.length - (operation.length || 0);
    case 'format':
      return operation.length || 0;
    default:
      return 0;
  }
}

/**
 * Validate operation
 */
export function validateOperation(operation: CRDTOperation): boolean {
  switch (operation.type) {
    case 'insert':
      return operation.position !== undefined && operation.content.length > 0;
    case 'delete':
      return (
        operation.position !== undefined &&
        operation.length !== undefined &&
        operation.length > 0
      );
    case 'format':
      return (
        operation.position !== undefined &&
        operation.length !== undefined &&
        operation.length > 0
      );
    case 'replace':
      return (
        operation.position !== undefined &&
        operation.length !== undefined &&
        operation.content.length > 0
      );
    default:
      return false;
  }
}
