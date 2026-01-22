/**
 * Aggregate root implementation for event sourcing
 */

// @ts-nocheck - Cloudflare Workers DurableObject types not fully available
import type {
  AggregateRoot,
  StoredEvent,
  Snapshot,
} from '../types';
import { generateEventId } from '../utils/id';

// ============================================================================
// Aggregate Base
// ============================================================================

export abstract class AggregateBase<TState = unknown> implements AggregateRoot<TState> {
  public readonly id: string;
  public version: number = 0;
  public state: TState;
  public uncommittedEvents: Array<{
    eventType: string;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }> = [];

  protected constructor(
    id: string,
    initialState: TState
  ) {
    this.id = id;
    this.state = initialState;
  }

  /**
   * Apply an event to the aggregate state
   */
  abstract apply(event: unknown): void;

  /**
   * Raise a new event (not yet committed)
   */
  protected raiseEvent(
    eventType: string,
    payload: unknown,
    metadata?: Record<string, unknown>
  ): void {
    this.uncommittedEvents.push({
      eventType,
      payload,
      metadata,
    });

    // Apply immediately to update state
    this.apply({ eventType, data: payload });
    this.version++;
  }

  /**
   * Load events from history
   */
  loadFromHistory(events: StoredEvent[]): void {
    for (const event of events) {
      this.apply({ eventType: event.metadata.eventType, data: event.event });
      this.version = event.streamVersion;
    }
  }

  /**
   * Load from snapshot
   */
  loadFromSnapshot(snapshot: Snapshot): void {
    this.version = snapshot.version;
    this.state = snapshot.state as TState;
  }

  /**
   * Commit uncommitted events
   */
  commit(): void {
    this.uncommittedEvents = [];
  }

  /**
   * Rollback uncommitted events
   */
  rollback(): void {
    // Replay from last committed version
    // In a real implementation, you'd need to store the committed state
    this.uncommittedEvents = [];
  }

  /**
   * Get uncommitted events
   */
  getUncommittedEvents(): Array<{
    eventType: string;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }> {
    return [...this.uncommittedEvents];
  }

  /**
   * Check if aggregate has uncommitted changes
   */
  hasUncommittedEvents(): boolean {
    return this.uncommittedEvents.length > 0;
  }
}

// ============================================================================
// Aggregate Repository
// ============================================================================

export interface AggregateRepository<TAggregate extends AggregateBase> {
  getById(id: string): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
  delete(id: string): Promise<void>;
}

export class EventSourcedRepository<TAggregate extends AggregateBase>
  implements AggregateRepository<TAggregate> {

  constructor(
    private eventStore: EventStoreDurableObjectStub,
    private aggregateFactory: (id: string, initialState: unknown) => TAggregate
  ) {}

  async getById(id: string): Promise<TAggregate | null> {
    // Try to get latest snapshot first
    const snapshot = await this.eventStore.getLatestSnapshot(id);

    const aggregate = this.aggregateFactory(id, this.getInitialState());

    if (snapshot) {
      aggregate.loadFromSnapshot(snapshot);

      // Load events after snapshot
      const events = await this.eventStore.readEvents(id, {
        fromVersion: snapshot.version + 1,
      });

      aggregate.loadFromHistory(events);
    } else {
      // Load all events
      const events = await this.eventStore.readEvents(id);
      aggregate.loadFromHistory(events);
    }

    return aggregate;
  }

  async save(aggregate: TAggregate): Promise<void> {
    const uncommitted = aggregate.getUncommittedEvents();

    if (uncommitted.length === 0) {
      return;
    }

    await this.eventStore.appendEvents(
      aggregate.id,
      uncommitted,
      aggregate.version - uncommitted.length
    );

    aggregate.commit();

    // Optionally create snapshot every N events
    const snapshotInterval = 100;
    if (aggregate.version % snapshotInterval === 0) {
      await this.eventStore.createSnapshot(aggregate.id, aggregate.state);
    }
  }

  async delete(id: string): Promise<void> {
    await this.eventStore.deleteStream(id);
  }

  protected abstract getInitialState(): unknown;
}

// ============================================================================
// Aggregate Factory
// ============================================================================

export class AggregateFactory {
  constructor(private eventStore: EventStoreDurableObjectStub) {}

  createRepository<TAggregate extends AggregateBase>(
    aggregateClass: new (id: string, initialState: unknown) => TAggregate,
    initialState: unknown
  ): AggregateRepository<TAggregate> {
    return new EventSourcedRepository<TAggregate>(
      this.eventStore,
      (id: string) => new aggregateClass(id, initialState)
    );
  }
}

// ============================================================================
// Example Aggregate Implementations
// ============================================================================

/**
 * Example: User Account Aggregate
 */
export interface UserAccountState {
  userId: string;
  email: string;
  username: string;
  isActive: boolean;
  balance: number;
  createdAt: number;
  updatedAt: number;
}

export class UserAccount extends AggregateBase<UserAccountState> {
  constructor(id: string) {
    super(id, {
      userId: id,
      email: '',
      username: '',
      isActive: false,
      balance: 0,
      createdAt: 0,
      updatedAt: 0,
    });
  }

  apply(event: unknown): void {
    if (!event || typeof event !== 'object') {
      return;
    }

    const { eventType, data } = event as { eventType: string; data: unknown };

    switch (eventType) {
      case 'UserCreated':
        this.applyUserCreated(data as UserCreatedEvent);
        break;
      case 'UserActivated':
        this.applyUserActivated();
        break;
      case 'UserDeactivated':
        this.applyUserDeactivated();
        break;
      case 'BalanceUpdated':
        this.applyBalanceUpdated(data as BalanceUpdatedEvent);
        break;
    }
  }

  private applyUserCreated(event: UserCreatedEvent): void {
    this.state.email = event.email;
    this.state.username = event.username;
    this.state.createdAt = event.createdAt;
    this.state.updatedAt = event.createdAt;
  }

  private applyUserActivated(): void {
    this.state.isActive = true;
    this.state.updatedAt = Date.now();
  }

  private applyUserDeactivated(): void {
    this.state.isActive = false;
    this.state.updatedAt = Date.now();
  }

  private applyBalanceUpdated(event: BalanceUpdatedEvent): void {
    this.state.balance = event.newBalance;
    this.state.updatedAt = Date.now();
  }

  // Domain methods
  create(email: string, username: string): void {
    if (this.state.email) {
      throw new Error('User already created');
    }

    this.raiseEvent('UserCreated', {
      email,
      username,
      createdAt: Date.now(),
    });
  }

  activate(): void {
    if (!this.state.email) {
      throw new Error('User not created');
    }
    if (this.state.isActive) {
      throw new Error('User already active');
    }

    this.raiseEvent('UserActivated', {});
  }

  deactivate(): void {
    if (!this.state.isActive) {
      throw new Error('User not active');
    }

    this.raiseEvent('UserDeactivated', {});
  }

  updateBalance(amount: number): void {
    const newBalance = this.state.balance + amount;
    if (newBalance < 0) {
      throw new Error('Insufficient balance');
    }

    this.raiseEvent('BalanceUpdated', {
      oldBalance: this.state.balance,
      amount,
      newBalance,
    });
  }
}

interface UserCreatedEvent {
  email: string;
  username: string;
  createdAt: number;
}

interface BalanceUpdatedEvent {
  oldBalance: number;
  amount: number;
  newBalance: number;
}

/**
 * Example: Order Aggregate
 */
export interface OrderState {
  orderId: string;
  customerId: string;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  createdAt: number;
  updatedAt: number;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export class Order extends AggregateBase<OrderState> {
  constructor(id: string) {
    super(id, {
      orderId: id,
      customerId: '',
      items: [],
      status: 'pending',
      totalAmount: 0,
      createdAt: 0,
      updatedAt: 0,
    });
  }

  apply(event: unknown): void {
    if (!event || typeof event !== 'object') {
      return;
    }

    const { eventType, data } = event as { eventType: string; data: unknown };

    switch (eventType) {
      case 'OrderCreated':
        this.applyOrderCreated(data as OrderCreatedEvent);
        break;
      case 'OrderConfirmed':
        this.applyOrderConfirmed();
        break;
      case 'OrderShipped':
        this.applyOrderShipped(data as OrderShippedEvent);
        break;
      case 'OrderDelivered':
        this.applyOrderDelivered();
        break;
      case 'OrderCancelled':
        this.applyOrderCancelled();
        break;
    }
  }

  private applyOrderCreated(event: OrderCreatedEvent): void {
    this.state.customerId = event.customerId;
    this.state.items = event.items;
    this.state.totalAmount = event.totalAmount;
    this.state.createdAt = event.createdAt;
    this.state.updatedAt = event.createdAt;
  }

  private applyOrderConfirmed(): void {
    this.state.status = 'confirmed';
    this.state.updatedAt = Date.now();
  }

  private applyOrderShipped(event: OrderShippedEvent): void {
    this.state.status = 'shipped';
    this.state.updatedAt = event.shippedAt;
  }

  private applyOrderDelivered(): void {
    this.state.status = 'delivered';
    this.state.updatedAt = Date.now();
  }

  private applyOrderCancelled(): void {
    this.state.status = 'cancelled';
    this.state.updatedAt = Date.now();
  }

  // Domain methods
  create(customerId: string, items: OrderItem[]): void {
    if (this.state.customerId) {
      throw new Error('Order already created');
    }

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    this.raiseEvent('OrderCreated', {
      customerId,
      items,
      totalAmount,
      createdAt: Date.now(),
    });
  }

  confirm(): void {
    if (this.state.status !== 'pending') {
      throw new Error('Order cannot be confirmed');
    }

    this.raiseEvent('OrderConfirmed', {});
  }

  ship(trackingNumber: string): void {
    if (this.state.status !== 'confirmed') {
      throw new Error('Order cannot be shipped');
    }

    this.raiseEvent('OrderShipped', {
      trackingNumber,
      shippedAt: Date.now(),
    });
  }

  deliver(): void {
    if (this.state.status !== 'shipped') {
      throw new Error('Order cannot be delivered');
    }

    this.raiseEvent('OrderDelivered', {});
  }

  cancel(): void {
    if (!['pending', 'confirmed'].includes(this.state.status)) {
      throw new Error('Order cannot be cancelled');
    }

    this.raiseEvent('OrderCancelled', {});
  }
}

interface OrderCreatedEvent {
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  createdAt: number;
}

interface OrderShippedEvent {
  trackingNumber: string;
  shippedAt: number;
}
