import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { Transform } from 'stream';

export function generateId(): string {
  return uuidv4();
}

export function generateHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export class RateLimiter {
  private requests: number[] = [];
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return this.requests.length < this.limit;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    const activeRequests = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.limit - activeRequests.length);
  }
}

export class AsyncQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private concurrency: number;
  private active = 0;

  constructor(concurrency: number = 10) {
    this.concurrency = concurrency;
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(() => task().then(resolve).catch(reject));
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.active >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.active++;

    const task = this.queue.shift()!;
    try {
      await task();
    } finally {
      this.active--;
      this.processing = false;
      this.process();
    }
  }

  async waitForCompletion(): Promise<void> {
    while (this.active > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

export function safeJsonParse<T = any>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }
  const clonedObj = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
}

export function createMemoryStream(): { stream: import('stream').Readable; data: string[]; write: (chunk: string) => void } {
  const data: string[] = [];
  const stream = new Transform({
    transform(chunk: Buffer, encoding, callback) {
      data.push(chunk.toString());
      callback();
    },
  });

  return {
    stream,
    data,
    write: (chunk: string) => stream.push(chunk),
  };
}