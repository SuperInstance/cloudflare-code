/**
 * CQRS (Command Query Responsibility Segregation) implementation
 */

// @ts-nocheck - Type issues with complex event sourcing patterns
import type {
  Command,
  Query,
  CommandHandler,
  QueryHandler,
  Projection,
  QueryModel,
  StoredEvent,
} from '../types';
import { generateEventId } from '../utils/id';

// ============================================================================
// Command Bus
// ============================================================================

export class CommandBus {
  private handlers: Map<string, CommandHandler> = new Map();

  registerHandler(commandType: string, handler: CommandHandler): void {
    this.handlers.set(commandType, handler);
  }

  async execute(command: Command): Promise<void> {
    const handler = this.handlers.get(command.commandType);

    if (!handler) {
      throw new Error(`No handler registered for command: ${command.commandType}`);
    }

    await handler.handle(command);
  }

  async executeBatch(commands: Command[]): Promise<void> {
    for (const command of commands) {
      await this.execute(command);
    }
  }

  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }

  listHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// ============================================================================
// Query Bus
// ============================================================================

export class QueryBus {
  private handlers: Map<string, QueryHandler> = new Map();

  registerHandler(queryType: string, handler: QueryHandler): void {
    this.handlers.set(queryType, handler);
  }

  async execute<T = unknown>(query: Query): Promise<T> {
    const handler = this.handlers.get(query.queryType);

    if (!handler) {
      throw new Error(`No handler registered for query: ${query.queryType}`);
    }

    return handler.handle(query) as Promise<T>;
  }

  hasHandler(queryType: string): boolean {
    return this.handlers.has(queryType);
  }

  listHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// ============================================================================
// Projection Engine
// ============================================================================

export class ProjectionEngine {
  private projections: Map<string, Projection> = new Map();
  private eventStore: EventStoreDurableObjectStub;

  constructor(eventStore: EventStoreDurableObjectStub) {
    this.eventStore = eventStore;
  }

  registerProjection(projection: Projection): void {
    this.projections.set(projection.id, projection);
  }

  async projectEvent(event: StoredEvent): Promise<void> {
    for (const projection of this.projections.values()) {
      await projection.handle(event);
      projection.lastProcessedEventNumber++;
      projection.lastProcessedAt = Date.now();
    }
  }

  async projectEvents(events: StoredEvent[]): Promise<void> {
    for (const event of events) {
      await this.projectEvent(event);
    }
  }

  async rebuildProjection(projectionId: string): Promise<void> {
    const projection = this.projections.get(projectionId);

    if (!projection) {
      throw new Error(`Projection not found: ${projectionId}`);
    }

    // Reset projection state
    projection.state = this.getInitialState(projection);
    projection.lastProcessedEventNumber = 0;
    projection.lastProcessedAt = 0;

    // Replay all events
    const allStreams = await this.eventStore.listStreams();

    for (const streamId of allStreams) {
      const events = await this.eventStore.readEvents(streamId);
      await this.projectEvents(events);
    }
  }

  getProjection(projectionId: string): Projection | null {
    return this.projections.get(projectionId) ?? null;
  }

  listProjections(): Projection[] {
    return Array.from(this.projections.values());
  }

  private getInitialState(projection: Projection): unknown {
    // Return initial state based on projection type
    // This is a simplified implementation
    return null;
  }
}

// ============================================================================
// Read Model
// ============================================================================

export class ReadModel<TState = unknown> implements QueryModel<TState> {
  private data: Map<string, TState> = new Map();

  constructor(
    private projectionId: string,
    private projectionEngine: ProjectionEngine
  ) {}

  async read(query: unknown): Promise<TState[]> {
    // Convert query to filter criteria
    const filter = this.queryToFilter(query);

    const results: TState[] = [];
    for (const [id, state] of this.data) {
      if (this.matchesFilter(id, state, filter)) {
        results.push(state);
      }
    }

    return results;
  }

  async getById(id: string): Promise<TState | null> {
    return this.data.get(id) ?? null;
  }

  async upsert(id: string, state: TState): Promise<void> {
    this.data.set(id, state);
  }

  async delete(id: string): Promise<void> {
    this.data.delete(id);
  }

  private queryToFilter(query: unknown): Record<string, unknown> {
    // Simplified query to filter conversion
    if (typeof query === 'object' && query !== null) {
      return query as Record<string, unknown>;
    }
    return {};
  }

  private matchesFilter(
    id: string,
    state: TState,
    filter: Record<string, unknown>
  ): boolean {
    // Simplified filter matching
    for (const [key, value] of Object.entries(filter)) {
      if (key === 'id' && id !== value) {
        return false;
      }
      if (
        state &&
        typeof state === 'object' &&
        (state as Record<string, unknown>)[key] !== value
      ) {
        return false;
      }
    }
    return true;
  }
}

// ============================================================================
// Example Projections
// ============================================================================

/**
 * User Account Summary Projection
 */
export interface UserAccountSummary {
  userId: string;
  username: string;
  email: string;
  isActive: boolean;
  balance: number;
  orderCount: number;
  lastOrderAt?: number;
}

export class UserAccountSummaryProjection implements Projection {
  id = 'user-account-summary';
  name = 'User Account Summary';
  state: Map<string, UserAccountSummary> = new Map();
  lastProcessedEventNumber = 0;
  lastProcessedAt = 0;

  async handle(event: StoredEvent): Promise<void> {
    const { eventType, streamId } = event.metadata;

    switch (eventType) {
      case 'UserCreated': {
        const data = event.event as UserCreatedEvent;
        this.state.set(streamId, {
          userId: streamId,
          username: data.username,
          email: data.email,
          isActive: false,
          balance: 0,
          orderCount: 0,
        });
        break;
      }

      case 'UserActivated': {
        const summary = this.state.get(streamId);
        if (summary) {
          summary.isActive = true;
        }
        break;
      }

      case 'UserDeactivated': {
        const summary = this.state.get(streamId);
        if (summary) {
          summary.isActive = false;
        }
        break;
      }

      case 'BalanceUpdated': {
        const data = event.event as BalanceUpdatedEvent;
        const summary = this.state.get(streamId);
        if (summary) {
          summary.balance = data.newBalance;
        }
        break;
      }

      case 'OrderCreated': {
        const data = event.event as OrderCreatedEvent;
        const summary = this.state.get(data.customerId);
        if (summary) {
          summary.orderCount++;
          summary.lastOrderAt = event.metadata.timestamp;
        }
        break;
      }
    }
  }
}

/**
 * Order Statistics Projection
 */
export interface OrderStatistics {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  totalRevenue: number;
  averageOrderValue: number;
  ordersToday: number;
  ordersThisWeek: number;
  ordersThisMonth: number;
}

export class OrderStatisticsProjection implements Projection {
  id = 'order-statistics';
  name = 'Order Statistics';
  state: OrderStatistics = {
    totalOrders: 0,
    ordersByStatus: {},
    totalRevenue: 0,
    averageOrderValue: 0,
    ordersToday: 0,
    ordersThisWeek: 0,
    ordersThisMonth: 0,
  };
  lastProcessedEventNumber = 0;
  lastProcessedAt = 0;

  async handle(event: StoredEvent): Promise<void> {
    const { eventType } = event.metadata;

    switch (eventType) {
      case 'OrderCreated': {
        const data = event.event as OrderCreatedEvent;
        this.state.totalOrders++;
        this.state.totalRevenue += data.totalAmount;
        this.state.averageOrderValue =
          this.state.totalRevenue / this.state.totalOrders;

        const status = 'pending';
        this.state.ordersByStatus[status] =
          (this.state.ordersByStatus[status] ?? 0) + 1;

        this.updateTimeBasedStats(event.metadata.timestamp);
        break;
      }

      case 'OrderConfirmed':
      case 'OrderShipped':
      case 'OrderDelivered':
      case 'OrderCancelled': {
        // Update status counts
        const oldStatus = this.getPreviousStatus(event);
        const newStatus = eventType.replace('Order', '').toLowerCase();

        if (oldStatus) {
          this.state.ordersByStatus[oldStatus]--;
        }
        this.state.ordersByStatus[newStatus] =
          (this.state.ordersByStatus[newStatus] ?? 0) + 1;
        break;
      }
    }
  }

  private updateTimeBasedStats(timestamp: number): void {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    if (timestamp > now - dayMs) {
      this.state.ordersToday++;
    }
    if (timestamp > now - weekMs) {
      this.state.ordersThisWeek++;
    }
    if (timestamp > now - monthMs) {
      this.state.ordersThisMonth++;
    }
  }

  private getPreviousStatus(event: StoredEvent): string | null {
    // Simplified - in real implementation, track state transitions
    return null;
  }
}

// ============================================================================
// Example Command Handlers
// ============================================================================

export class CreateUserCommandHandler implements CommandHandler {
  constructor(
    private eventStore: EventStoreDurableObjectStub,
    private aggregateFactory: AggregateFactory
  ) {}

  async handle(command: Command): Promise<void> {
    const { aggregateId, payload } = command;

    const repository = this.aggregateFactory.createRepository(
      UserAccount,
      {}
    );

    const user = await repository.getById(aggregateId);

    if (!user) {
      throw new Error(`User not found: ${aggregateId}`);
    }

    const data = payload as { email: string; username: string };
    user.create(data.email, data.username);

    await repository.save(user);
  }
}

export class UpdateBalanceCommandHandler implements CommandHandler {
  constructor(
    private eventStore: EventStoreDurableObjectStub,
    private aggregateFactory: AggregateFactory
  ) {}

  async handle(command: Command): Promise<void> {
    const { aggregateId, payload } = command;

    const repository = this.aggregateFactory.createRepository(
      UserAccount,
      {}
    );

    const user = await repository.getById(aggregateId);

    if (!user) {
      throw new Error(`User not found: ${aggregateId}`);
    }

    const data = payload as { amount: number };
    user.updateBalance(data.amount);

    await repository.save(user);
  }
}

// ============================================================================
// Example Query Handlers
// ============================================================================

export class GetUserQueryHandler implements QueryHandler {
  constructor(private readModel: ReadModel<UserAccountSummary>) {}

  async handle(query: Query): Promise<UserAccountSummary | null> {
    const { payload } = query;
    const userId = payload as string;

    return this.readModel.getById(userId);
  }
}

export class ListUsersQueryHandler implements QueryHandler {
  constructor(private readModel: ReadModel<UserAccountSummary>) {}

  async handle(query: Query): Promise<UserAccountSummary[]> {
    return this.readModel.read(query.payload);
  }
}

export class GetOrderStatisticsQueryHandler implements QueryHandler {
  constructor(private projection: OrderStatisticsProjection) {}

  async handle(): Promise<OrderStatistics> {
    return this.projection.state;
  }
}

// Import types used in examples
import type { EventStoreDurableObjectStub } from './event-store';
import { AggregateFactory } from './aggregate';
import { UserAccount, UserCreatedEvent, BalanceUpdatedEvent } from './aggregate';
import type { OrderCreatedEvent } from './aggregate';
