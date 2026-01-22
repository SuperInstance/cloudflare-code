/**
 * Transaction Manager
 * Advanced transaction management with nesting, savepoints, and retry logic
 */

import { DatabaseAdapter } from '../adapters/adapter';
import {
  Transaction,
  TransactionOptions,
  TransactionStatus,
  IsolationLevel,
  QueryResult,
} from '../types';

// ============================================================================
// Transaction Manager
// ============================================================================

export class TransactionManager {
  private adapter: DatabaseAdapter;
  private activeTransactions: Map<string, TransactionState> = new Map();
  private transactionStack: TransactionState[] = [];

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  // ========================================================================
  // Transaction Management
  // ========================================================================

  async begin(options?: TransactionOptions): Promise<Transaction> {
    const transactionId = this.generateTransactionId();

    const state: TransactionState = {
      id: transactionId,
      status: TransactionStatus.ACTIVE,
      isolationLevel: options?.isolationLevel || IsolationLevel.READ_COMMITTED,
      beginTime: new Date(),
      savepoints: [],
      options: options || {},
      depth: this.transactionStack.length,
    };

    try {
      if (this.transactionStack.length === 0) {
        // Top-level transaction
        await this.adapter.query(`SET TRANSACTION ISOLATION LEVEL ${state.isolationLevel}`);
        await this.adapter.query('BEGIN');
      } else {
        // Nested transaction - use savepoint
        const savepointName = `sp_${transactionId}`;
        await this.adapter.query(`SAVEPOINT ${savepointName}`);
        state.savepoint = savepointName;
      }

      this.transactionStack.push(state);
      this.activeTransactions.set(transactionId, state);

      return this.createTransactionInterface(state);
    } catch (error) {
      throw new Error(`Failed to begin transaction: ${error}`);
    }
  }

  async commit(transaction: Transaction): Promise<void> {
    const state = this.activeTransactions.get(transaction.id);

    if (!state) {
      throw new Error('Transaction not found');
    }

    if (state.status !== TransactionStatus.ACTIVE) {
      throw new Error(`Transaction is not active: ${state.status}`);
    }

    try {
      if (state.depth === 0) {
        // Top-level transaction
        await this.adapter.query('COMMIT');
      } else {
        // Release savepoint for nested transaction
        if (state.savepoint) {
          await this.adapter.query(`RELEASE SAVEPOINT ${state.savepoint}`);
        }
      }

      state.status = TransactionStatus.COMMITTED;
      state.endTime = new Date();

      this.transactionStack.pop();
      this.activeTransactions.delete(transaction.id);
    } catch (error) {
      state.status = TransactionStatus.FAILED;
      state.endTime = new Date();
      throw new Error(`Failed to commit transaction: ${error}`);
    }
  }

  async rollback(transaction: Transaction, toSavepoint?: string): Promise<void> {
    const state = this.activeTransactions.get(transaction.id);

    if (!state) {
      throw new Error('Transaction not found');
    }

    if (state.status !== TransactionStatus.ACTIVE) {
      throw new Error(`Transaction is not active: ${state.status}`);
    }

    try {
      if (toSavepoint) {
        // Rollback to specific savepoint
        await this.adapter.query(`ROLLBACK TO SAVEPOINT ${toSavepoint}`);
      } else if (state.depth === 0) {
        // Rollback entire transaction
        await this.adapter.query('ROLLBACK');
      } else {
        // Rollback nested transaction
        if (state.savepoint) {
          await this.adapter.query(`ROLLBACK TO SAVEPOINT ${state.savepoint}`);
        }
      }

      state.status = TransactionStatus.ROLLED_BACK;
      state.endTime = new Date();

      this.transactionStack.pop();
      this.activeTransactions.delete(transaction.id);
    } catch (error) {
      state.status = TransactionStatus.FAILED;
      state.endTime = new Date();
      throw new Error(`Failed to rollback transaction: ${error}`);
    }
  }

  // ========================================================================
  // Savepoint Management
  // ========================================================================

  async createSavepoint(transaction: Transaction, name?: string): Promise<string> {
    const state = this.activeTransactions.get(transaction.id);

    if (!state) {
      throw new Error('Transaction not found');
    }

    if (state.status !== TransactionStatus.ACTIVE) {
      throw new Error(`Transaction is not active: ${state.status}`);
    }

    const savepointName = name || `sp_${Date.now()}`;

    try {
      await this.adapter.query(`SAVEPOINT ${savepointName}`);
      state.savepoints.push({
        name: savepointName,
        createdAt: new Date(),
      });

      return savepointName;
    } catch (error) {
      throw new Error(`Failed to create savepoint: ${error}`);
    }
  }

  async releaseSavepoint(transaction: Transaction, name: string): Promise<void> {
    const state = this.activeTransactions.get(transaction.id);

    if (!state) {
      throw new Error('Transaction not found');
    }

    try {
      await this.adapter.query(`RELEASE SAVEPOINT ${name}`);

      const index = state.savepoints.findIndex(sp => sp.name === name);
      if (index > -1) {
        state.savepoints.splice(index, 1);
      }
    } catch (error) {
      throw new Error(`Failed to release savepoint: ${error}`);
    }
  }

  async rollbackToSavepoint(transaction: Transaction, name: string): Promise<void> {
    const state = this.activeTransactions.get(transaction.id);

    if (!state) {
      throw new Error('Transaction not found');
    }

    try {
      await this.adapter.query(`ROLLBACK TO SAVEPOINT ${name}`);

      // Remove savepoints created after this one
      const index = state.savepoints.findIndex(sp => sp.name === name);
      if (index > -1) {
        state.savepoints.splice(index + 1);
      }
    } catch (error) {
      throw new Error(`Failed to rollback to savepoint: ${error}`);
    }
  }

  // ========================================================================
  // Transaction Execution Helper
  // ========================================================================

  async transaction<T>(
    callback: (trx: Transaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const trx = await this.begin(options);

    try {
      const result = await callback(trx);
      await this.commit(trx);
      return result;
    } catch (error) {
      await this.rollback(trx);
      throw error;
    }
  }

  async transactional<T>(
    callback: (trx: Transaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.transaction(callback, options);
  }

  // ========================================================================
  // Retry Logic
  // ========================================================================

  async transactionWithRetry<T>(
    callback: (trx: Transaction) => Promise<T>,
    options?: TransactionOptions & {
      maxRetries?: number;
      retryDelay?: number;
      retryableErrors?: RegExp[];
    }
  ): Promise<T> {
    const maxRetries = options?.maxRetries || 3;
    const retryDelay = options?.retryDelay || 1000;
    const retryableErrors = options?.retryableErrors || [
      /deadlock/i,
      /lock wait timeout/i,
      /connection reset/i,
    ];

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.transaction(callback, options);
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        const isRetryable = retryableErrors.some(pattern =>
          pattern.test(lastError!.message)
        );

        if (!isRetryable) {
          throw error;
        }

        // Wait before retry
        await this.sleep(retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========================================================================
  // Transaction State
  // ========================================================================

  getTransaction(id: string): Transaction | undefined {
    const state = this.activeTransactions.get(id);
    return state ? this.createTransactionInterface(state) : undefined;
  }

  getActiveTransactions(): Transaction[] {
    return Array.from(this.activeTransactions.values()).map(state =>
      this.createTransactionInterface(state)
    );
  }

  getTransactionCount(): number {
    return this.activeTransactions.size;
  }

  hasActiveTransactions(): boolean {
    return this.activeTransactions.size > 0;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private createTransactionInterface(state: TransactionState): Transaction {
    return {
      id: state.id,
      status: state.status,
      isolationLevel: state.isolationLevel,
      beginTime: state.beginTime,
      endTime: state.endTime,

      commit: async (query: string, params?: any[]) => {
        return this.adapter.query(query, params);
      },

      rollback: async () => {
        await this.rollback(this.createTransactionInterface(state));
      },

      createSavepoint: async (name?: string) => {
        return {
          name: await this.createSavepoint(this.createTransactionInterface(state), name),
          createdAt: new Date(),
        };
      },

      releaseSavepoint: async (name: string) => {
        await this.releaseSavepoint(this.createTransactionInterface(state), name);
      },

      rollbackToSavepoint: async (name: string) => {
        await this.rollbackToSavepoint(this.createTransactionInterface(state), name);
      },
    };
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Transaction State Interface
// ============================================================================

interface TransactionState {
  id: string;
  status: TransactionStatus;
  isolationLevel: IsolationLevel;
  beginTime: Date;
  endTime?: Date;
  savepoint?: string;
  savepoints: Array<{ name: string; createdAt: Date }>;
  options: TransactionOptions;
  depth: number;
}

// ============================================================================
// Distributed Transaction Coordinator
// ============================================================================

export class DistributedTransactionCoordinator {
  private participants: Map<string, DatabaseAdapter> = new Map();
  private transactions: Map<string, DistributedTransactionState> = new Map();

  registerParticipant(name: string, adapter: DatabaseAdapter): void {
    this.participants.set(name, adapter);
  }

  async beginDistributed(transactionId: string): Promise<void> {
    const state: DistributedTransactionState = {
      id: transactionId,
      status: 'pending',
      participants: [],
      beginTime: new Date(),
    };

    this.transactions.set(transactionId, state);

    // Begin transaction on all participants
    for (const [name, adapter] of this.participants) {
      await adapter.query('BEGIN');
      state.participants.push({ name, adapter, prepared: false });
    }
  }

  async prepare(transactionId: string): Promise<void> {
    const state = this.transactions.get(transactionId);

    if (!state) {
      throw new Error('Distributed transaction not found');
    }

    // Prepare all participants (2PC phase 1)
    for (const participant of state.participants) {
      await participant.adapter.query('PREPARE TRANSACTION \'' + state.id + '\'');
      participant.prepared = true;
    }

    state.status = 'prepared';
  }

  async commit(transactionId: string): Promise<void> {
    const state = this.transactions.get(transactionId);

    if (!state) {
      throw new Error('Distributed transaction not found');
    }

    try {
      // Commit all participants (2PC phase 2)
      for (const participant of state.participants) {
        await participant.adapter.query('COMMIT PREPARED \'' + state.id + '\'');
      }

      state.status = 'committed';
      state.endTime = new Date();
    } catch (error) {
      state.status = 'failed';
      throw error;
    } finally {
      this.transactions.delete(transactionId);
    }
  }

  async rollback(transactionId: string): Promise<void> {
    const state = this.transactions.get(transactionId);

    if (!state) {
      throw new Error('Distributed transaction not found');
    }

    try {
      // Rollback all participants
      for (const participant of state.participants) {
        if (participant.prepared) {
          await participant.adapter.query('ROLLBACK PREPARED \'' + state.id + '\'');
        } else {
          await participant.adapter.query('ROLLBACK');
        }
      }

      state.status = 'rolled_back';
      state.endTime = new Date();
    } finally {
      this.transactions.delete(transactionId);
    }
  }

  getStatus(transactionId: string): string | undefined {
    return this.transactions.get(transactionId)?.status;
  }
}

// ============================================================================
// Distributed Transaction State
// ============================================================================

interface DistributedTransactionState {
  id: string;
  status: 'pending' | 'prepared' | 'committed' | 'rolled_back' | 'failed';
  participants: Array<{
    name: string;
    adapter: DatabaseAdapter;
    prepared: boolean;
  }>;
  beginTime: Date;
  endTime?: Date;
}

// ============================================================================
// Transaction Decorator
// ============================================================================

export function Transactional(options?: TransactionOptions) {
  return function(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const manager = (this as any).transactionManager as TransactionManager;

      if (!manager) {
        throw new Error('TransactionManager not found on class instance');
      }

      return manager.transaction(async (trx) => {
        return originalMethod.apply(this, [...args, trx]);
      }, options);
    };

    return descriptor;
  };
}

// ============================================================================
// Transaction Context
// ============================================================================

export class TransactionContext {
  private static context: AsyncLocalStorage<Transaction> = new AsyncLocalStorage();

  static run<T>(
    transaction: Transaction,
    callback: () => Promise<T>
  ): Promise<T> {
    return this.context.run(transaction, callback);
  }

  static get(): Transaction | undefined {
    return this.context.getStore();
  }

  static async query<T>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const transaction = this.get();

    if (!transaction) {
      throw new Error('No active transaction in context');
    }

    return transaction.commit(sql, params);
  }
}

// Polyfill for AsyncLocalStorage (for Node.js < 12.17)
class AsyncLocalStorage<T> {
  private store: Map<any, T> = new Map();

  run(instance: T, callback: () => any): any {
    const key = {};
    this.store.set(key, instance);
    try {
      return callback();
    } finally {
      this.store.delete(key);
    }
  }

  getStore(): T | undefined {
    for (const [, value] of this.store) {
      return value;
    }
    return undefined;
  }
}
