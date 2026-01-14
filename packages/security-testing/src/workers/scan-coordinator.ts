/**
 * Scan Coordinator Durable Object
 * Coordinates distributed security scanning across multiple workers
 */

import { DurableObject } from 'cloudflare:workers';
import { ScanResult, ScanStatus, Finding } from '../types';

export interface ScanTask {
  id: string;
  type: 'sast' | 'dast' | 'sca' | 'compliance' | 'pentest';
  target: string;
  config: any;
  status: ScanStatus;
  results?: ScanResult;
  error?: string;
  assignedWorker?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkerInfo {
  id: string;
  available: boolean;
  currentScans: number;
  maxScans: number;
  lastHeartbeat: Date;
}

export class ScanCoordinator implements DurableObject {
  private state: DurableObjectState;
  private env: any;
  private tasks: Map<string, ScanTask>;
  private workers: Map<string, WorkerInfo>;
  private queue: string[];

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.tasks = new Map();
    this.workers = new Map();
    this.queue = [];
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/submit') {
        return await this.handleSubmit(request);
      } else if (path === '/status') {
        return await this.handleStatus(request);
      } else if (path === '/results') {
        return await this.handleResults(request);
      } else if (path === '/register') {
        return await this.handleRegister(request);
      } else if (path === '/heartbeat') {
        return await this.handleHeartbeat(request);
      } else if (path === '/complete') {
        return await this.handleComplete(request);
      } else if (path === '/list') {
        return await this.handleList(request);
      } else {
        return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle scan submission
   */
  private async handleSubmit(request: Request): Promise<Response> {
    const body = await request.json() as any;

    const task: ScanTask = {
      id: this.generateTaskId(),
      type: body.type,
      target: body.target,
      config: body.config,
      status: ScanStatus.QUEUED,
      createdAt: new Date(),
    };

    this.tasks.set(task.id, task);
    this.queue.push(task.id);

    // Persist state
    await this.persistState();

    // Try to assign task
    await this.assignTasks();

    return new Response(JSON.stringify({ taskId: task.id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle status query
   */
  private async handleStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');

    if (!taskId) {
      return new Response('Missing taskId', { status: 400 });
    }

    const task = this.tasks.get(taskId);

    if (!task) {
      return new Response('Task not found', { status: 404 });
    }

    return new Response(JSON.stringify({
      taskId: task.id,
      status: task.status,
      type: task.type,
      target: task.target,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle results query
   */
  private async handleResults(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');

    if (!taskId) {
      return new Response('Missing taskId', { status: 400 });
    }

    const task = this.tasks.get(taskId);

    if (!task) {
      return new Response('Task not found', { status: 404 });
    }

    if (task.status !== ScanStatus.COMPLETED) {
      return new Response('Scan not completed', { status: 400 });
    }

    return new Response(JSON.stringify(task.results), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle worker registration
   */
  private async handleRegister(request: Request): Promise<Response> {
    const body = await request.json() as any;

    const worker: WorkerInfo = {
      id: body.workerId,
      available: true,
      currentScans: 0,
      maxScans: body.maxScans || 5,
      lastHeartbeat: new Date(),
    };

    this.workers.set(worker.id, worker);

    await this.persistState();

    return new Response(JSON.stringify({ registered: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle worker heartbeat
   */
  private async handleHeartbeat(request: Request): Promise<Response> {
    const body = await request.json() as any;
    const worker = this.workers.get(body.workerId);

    if (!worker) {
      return new Response('Worker not registered', { status: 404 });
    }

    worker.lastHeartbeat = new Date();
    worker.available = body.available !== undefined ? body.available : worker.available;
    worker.currentScans = body.currentScans || worker.currentScans;

    // Check for timed-out workers
    await this.cleanupWorkers();

    await this.persistState();

    return new Response(JSON.stringify({ acknowledged: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle scan completion
   */
  private async handleComplete(request: Request): Promise<Response> {
    const body = await request.json() as any;
    const task = this.tasks.get(body.taskId);

    if (!task) {
      return new Response('Task not found', { status: 404 });
    }

    if (body.error) {
      task.status = ScanStatus.FAILED;
      task.error = body.error;
    } else {
      task.status = ScanStatus.COMPLETED;
      task.results = body.results;
    }

    task.completedAt = new Date();

    // Free up worker
    if (task.assignedWorker) {
      const worker = this.workers.get(task.assignedWorker);
      if (worker) {
        worker.currentScans--;
        worker.available = worker.currentScans < worker.maxScans;
      }
    }

    await this.persistState();
    await this.assignTasks();

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle list tasks
   */
  private async handleList(request: Request): Promise<Response> {
    const tasks = Array.from(this.tasks.values()).map((task) => ({
      id: task.id,
      type: task.type,
      target: task.target,
      status: task.status,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    }));

    return new Response(JSON.stringify({ tasks }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Assign tasks to available workers
   */
  private async assignTasks(): Promise<void> {
    while (this.queue.length > 0) {
      const taskId = this.queue.shift()!;
      const task = this.tasks.get(taskId)!;

      // Find available worker
      const availableWorker = this.findAvailableWorker(task.type);

      if (availableWorker) {
        task.status = ScanStatus.RUNNING;
        task.startedAt = new Date();
        task.assignedWorker = availableWorker.id;

        availableWorker.currentScans++;
        availableWorker.available = availableWorker.currentScans < availableWorker.maxScans;

        // Notify worker
        await this.notifyWorker(availableWorker.id, task);

        await this.persistState();
      } else {
        // No workers available, put back in queue
        this.queue.unshift(taskId);
        break;
      }
    }
  }

  /**
   * Find available worker for task type
   */
  private findAvailableWorker(taskType: string): WorkerInfo | null {
    for (const worker of this.workers.values()) {
      if (worker.available && worker.currentScans < worker.maxScans) {
        // In production, you'd check if worker supports the task type
        return worker;
      }
    }
    return null;
  }

  /**
   * Notify worker of new task
   */
  private async notifyWorker(workerId: string, task: ScanTask): Promise<void> {
    // This would send a notification to the worker
    // In production, this might use WebSocket, Pub/Sub, or webhook
    console.log(`Notifying worker ${workerId} about task ${task.id}`);
  }

  /**
   * Cleanup timed-out workers
   */
  private async cleanupWorkers(): Promise<void> {
    const now = new Date();
    const timeout = 60000; // 1 minute

    for (const [id, worker] of this.workers) {
      if (now.getTime() - worker.lastHeartbeat.getTime() > timeout) {
        this.workers.delete(id);

        // Reassign any tasks assigned to this worker
        for (const task of this.tasks.values()) {
          if (task.assignedWorker === id && task.status === ScanStatus.RUNNING) {
            task.status = ScanStatus.QUEUED;
            task.startedAt = undefined;
            task.assignedWorker = undefined;
            this.queue.push(task.id);
          }
        }
      }
    }

    await this.assignTasks();
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    const state = {
      tasks: Array.from(this.tasks.entries()),
      workers: Array.from(this.workers.entries()),
      queue: this.queue,
    };

    await this.state.storage.put('state', JSON.stringify(state));
  }

  /**
   * Restore state from storage
   */
  private async restoreState(): Promise<void> {
    const stateJson = await this.state.storage.get<string>('state');

    if (stateJson) {
      const state = JSON.parse(stateJson);
      this.tasks = new Map(state.tasks);
      this.workers = new Map(state.workers);
      this.queue = state.queue;
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Scan Coordinator Worker
 */
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const id = env.SCAN_COORDINATOR.idFromName('global');
    const stub = env.SCAN_COORDINATOR.get(id);

    return stub.fetch(request);
  },
};
