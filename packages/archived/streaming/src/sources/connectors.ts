// @ts-nocheck
import { EventEmitter } from 'events';
import { Event, Stream, StreamObserver, SourceConfig } from '../types';

export interface SourceConnector<T = any> extends EventEmitter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  start(): void;
  stop(): void;
  isConnected: boolean;
  getMetrics(): SourceMetrics;
  pause(): void;
  resume(): void;
}

export interface SourceMetrics {
  eventsReceived: number;
  eventsProcessed: number;
  errors: number;
  lastActivity: number;
  avgLatency: number;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  throughput: number;
}

export interface KafkaConfig {
  brokers: string[];
  topic: string;
  groupId?: string;
  autoOffsetReset?: 'earliest' | 'latest';
  maxWaitTime?: number;
  maxBytes?: number;
}

export interface HttpConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  interval?: number;
  timeout?: number;
  maxRetries?: number;
  transform?: (data: any) => Event[];
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  headers?: Record<string, string>;
}

export interface DatabaseConfig {
  connectionString: string;
  query: string;
  interval?: number;
  batchSize?: number;
  transform?: (row: any) => Event;
}

export interface FileConfig {
  path: string;
  format?: 'json' | 'csv' | 'line-delimited';
  encoding?: string;
  watch?: boolean;
  interval?: number;
  transform?: (data: any) => Event;
}

export class KafkaConnector extends EventEmitter implements SourceConnector<any> {
  private config: KafkaConfig;
  private _isConnected = false;
  private metrics: SourceMetrics = {
    eventsReceived: 0,
    eventsProcessed: 0,
    errors: 0,
    lastActivity: 0,
    avgLatency: 0,
    connectionStatus: 'disconnected',
    throughput: 0
  };

  private consumer: any = null;
  private processing = false;

  constructor(config: KafkaConfig) {
    super();
    this.config = {
      ...config,
      brokers: config.brokers ?? [],
      topic: config.topic ?? '',
      autoOffsetReset: config.autoOffsetReset ?? 'latest',
      maxWaitTime: config.maxWaitTime ?? 100,
      maxBytes: config.maxBytes ?? 1024 * 1024,
    };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  set isConnected(value: boolean) {
    this._isConnected = value;
  }

  async connect(): Promise<void> {
    if (this._isConnected) return;

    this.metrics.connectionStatus = 'connecting';

    try {
      const Kafka = require('kafkajs').Kafka;
      const kafka = new Kafka({
        clientId: 'claudeflare-streaming',
        brokers: this.config.brokers
      });

      this.consumer = kafka.consumer({ groupId: this.config.groupId });

      await this.consumer.connect();
      this._isConnected = true;
      this.metrics.connectionStatus = 'connected';
      this.emit('connected');

      this.startConsumer();

    } catch (error) {
      this.metrics.connectionStatus = 'error';
      this.metrics.errors++;
      this.emit('error', error);
      throw error;
    }
  }

  private startConsumer(): void {
    if (this.processing) return;

    this.processing = true;

    const processBatch = async () => {
      if (!this._isConnected) {
        this.processing = false;
        return;
      }

      try {
        const eachMessage = async ({ topic, partition, message }: any) => {
          const startTime = Date.now();

          const event: Event = {
            id: message.key?.toString() || `${topic}-${partition}-${message.offset}`,
            timestamp: message.timestamp || Date.now(),
            data: JSON.parse(message.value.toString()),
            metadata: {
              topic,
              partition,
              offset: message.offset,
              key: message.key?.toString()
            }
          };

          this.metrics.eventsReceived++;
          this.metrics.lastActivity = Date.now();

          this.emit('data', event);

          const latency = Date.now() - startTime;
          this.updateLatency(latency);
        };

        await this.consumer.subscribe({ topics: [this.config.topic] });

        await this.consumer.run({
          eachMessage,
          autoCommit: true
        });

      } catch (error) {
        this.metrics.errors++;
        this.emit('error', error);
      }
    };

    processBatch();
  }

  disconnect(): Promise<void> {
    if (!this._isConnected) return Promise.resolve();

    return new Promise(async (resolve) => {
      try {
        if (this.consumer) {
          await this.consumer.disconnect();
        }
        this._isConnected = false;
        this.metrics.connectionStatus = 'disconnected';
        this.emit('disconnected');
        resolve();
      } catch (error) {
        this.metrics.errors++;
        this.emit('error', error);
        resolve();
      }
    });
  }

  start(): void {
    this.connect().then(() => {
      this.emit('started');
    });
  }

  stop(): void {
    this.disconnect().then(() => {
      this.emit('stopped');
    });
  }

  pause(): void {
    this.consumer?.pause([{ topic: this.config.topic }]);
    this.emit('paused');
  }

  resume(): void {
    this.consumer?.resume([{ topic: this.config.topic }]);
    this.emit('resumed');
  }

  getMetrics(): SourceMetrics {
    return { ...this.metrics };
  }

  private updateLatency(latency: number): void {
    const totalLatency = this.metrics.avgLatency * this.metrics.eventsReceived;
    this.metrics.avgLatency = (totalLatency + latency) / (this.metrics.eventsReceived || 1);
  }
}

export class HttpConnector extends EventEmitter implements SourceConnector<any> {
  private config: HttpConfig;
  private _isConnected = false;
  private metrics: SourceMetrics = {
    eventsReceived: 0,
    eventsProcessed: 0,
    errors: 0,
    lastActivity: 0,
    avgLatency: 0,
    connectionStatus: 'disconnected',
    throughput: 0
  };

  private intervalId: NodeJS.Timeout | null = null;
  private paused = false;

  constructor(config: HttpConfig) {
    super();
    this.config = {
      ...config,
      method: config.method ?? 'GET',
      interval: config.interval ?? 5000,
      timeout: config.timeout ?? 10000,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  set isConnected(value: boolean) {
    this._isConnected = value;
  }

  async connect(): Promise<void> {
    this._isConnected = true;
    this.metrics.connectionStatus = 'connected';
    this.emit('connected');
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this._isConnected = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.metrics.connectionStatus = 'disconnected';
    this.emit('disconnected');
    return Promise.resolve();
  }

  start(): void {
    this.connect().then(() => {
      this.startPolling();
      this.emit('started');
    });
  }

  private startPolling(): void {
    this.intervalId = setInterval(async () => {
      if (!this._isConnected || this.paused) return;

      try {
        await this.fetchData();
      } catch (error) {
        this.metrics.errors++;
        this.emit('error', error);
      }
    }, this.config.interval!);
  }

  private async fetchData(): Promise<void> {
    const startTime = Date.now();

    const response = await fetch(this.config.url, {
      method: this.config.method,
      headers: this.config.headers,
      body: this.config.body ? JSON.stringify(this.config.body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout!)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    let events: Event[] = [];

    if (this.config.transform) {
      events = this.config.transform(data);
    } else if (Array.isArray(data)) {
      events = data.map((item, index) => ({
        id: `${Date.now()}-${index}`,
        timestamp: Date.now(),
        data: item
      }));
    } else {
      events = [{
        id: Date.now().toString(),
        timestamp: Date.now(),
        data
      }];
    }

    events.forEach(event => {
      this.metrics.eventsReceived++;
      this.metrics.lastActivity = Date.now();
      this.emit('data', event);
    });

    this.updateLatency(latency);
  }

  stop(): void {
    this.disconnect().then(() => {
      this.emit('stopped');
    });
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  pause(): void {
    this.paused = true;
    this.emit('paused');
  }

  resume(): void {
    this.paused = false;
    this.emit('resumed');
  }

  getMetrics(): SourceMetrics {
    return { ...this.metrics };
  }

  private updateLatency(latency: number): void {
    const totalLatency = this.metrics.avgLatency * this.metrics.eventsReceived;
    this.metrics.avgLatency = (totalLatency + latency) / (this.metrics.eventsReceived || 1);
  }
}

export class WebSocketConnector extends EventEmitter implements SourceConnector {
  private config: WebSocketConfig;
  private isConnected = false;
  private metrics: SourceMetrics = {
    eventsReceived: 0,
    eventsProcessed: 0,
    errors: 0,
    lastActivity: 0,
    avgLatency: 0,
    connectionStatus: 'disconnected',
    throughput: 0
  };

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectIntervalId: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
      ...config
    };
  }

  async connect(): Promise<void> {
    if (this._isConnected) return;

    this.metrics.connectionStatus = 'connecting';

    try {
      const wsUrl = this.config.url;
      const wsProtocols = this.config.protocols;

      this.ws = new WebSocket(wsUrl, wsProtocols);

      this.ws.onopen = () => {
        this._isConnected = true;
        this.metrics.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        const startTime = Date.now();

        try {
          const data = JSON.parse(event.data);
          const eventObj: Event = {
            id: data.id || `ws-${Date.now()}-${Math.random()}`,
            timestamp: data.timestamp || Date.now(),
            data,
            metadata: {
              source: 'websocket',
              original: event.data
            }
          };

          this.metrics.eventsReceived++;
          this.metrics.lastActivity = Date.now();
          this.emit('data', eventObj);

          const latency = Date.now() - startTime;
          this.updateLatency(latency);

        } catch (error) {
          this.metrics.errors++;
          this.emit('error', error);
        }
      };

      this.ws.onclose = () => {
        this._isConnected = false;
        this.metrics.connectionStatus = 'disconnected';
        this.emit('disconnected');

        if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this.metrics.errors++;
        this.metrics.connectionStatus = 'error';
        this.emit('error', error);
      };

    } catch (error) {
      this.metrics.errors++;
      this.metrics.connectionStatus = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectIntervalId = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, this.config.reconnectInterval);
  }

  disconnect(): Promise<void> {
    if (!this._isConnected) return Promise.resolve();

    return new Promise((resolve) => {
      if (this.reconnectIntervalId) {
        clearTimeout(this.reconnectIntervalId);
        this.reconnectIntervalId = null;
      }

      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      this._isConnected = false;
      this.metrics.connectionStatus = 'disconnected';
      this.emit('disconnected');
      resolve();
    });
  }

  start(): void {
    this.connect().then(() => {
      this.emit('started');
    });
  }

  stop(): void {
    this.disconnect().then(() => {
      this.emit('stopped');
    });
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  pause(): void {
    if (this.ws) {
      this.ws.pause();
    }
    this.emit('paused');
  }

  resume(): void {
    if (this.ws) {
      this.ws.resume();
    }
    this.emit('resumed');
  }

  getMetrics(): SourceMetrics {
    return { ...this.metrics };
  }

  private updateLatency(latency: number): void {
    const totalLatency = this.metrics.avgLatency * this.metrics.eventsReceived;
    this.metrics.avgLatency = (totalLatency + latency) / (this.metrics.eventsReceived || 1);
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export class DatabaseConnector extends EventEmitter implements SourceConnector {
  private config: DatabaseConfig;
  private isConnected = false;
  private metrics: SourceMetrics = {
    eventsReceived: 0,
    eventsProcessed: 0,
    errors: 0,
    lastActivity: 0,
    avgLatency: 0,
    connectionStatus: 'disconnected',
    throughput: 0
  };

  private intervalId: NodeJS.Timeout | null = null;
  private connection: any = null;

  constructor(config: DatabaseConfig) {
    super();
    this.config = {
      interval: 5000,
      batchSize: 100,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      this.connection = await require('pg').Pool({
        connectionString: this.config.connectionString
      });

      await this.connection.query('SELECT 1');
      this._isConnected = true;
      this.metrics.connectionStatus = 'connected';
      this.emit('connected');

    } catch (error) {
      this.metrics.errors++;
      this.metrics.connectionStatus = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  disconnect(): Promise<void> {
    if (!this._isConnected) return Promise.resolve();

    return new Promise((resolve) => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      if (this.connection) {
        this.connection.end();
        this.connection = null;
      }

      this._isConnected = false;
      this.metrics.connectionStatus = 'disconnected';
      this.emit('disconnected');
      resolve();
    });
  }

  start(): void {
    this.connect().then(() => {
      this.startPolling();
      this.emit('started');
    });
  }

  private startPolling(): void {
    this.intervalId = setInterval(async () => {
      if (!this._isConnected) return;

      try {
        await this.fetchData();
      } catch (error) {
        this.metrics.errors++;
        this.emit('error', error);
      }
    }, this.config.interval);
  }

  private async fetchData(): Promise<void> {
    const startTime = Date.now();

    const result = await this.connection.query(this.config.query);

    const latency = Date.now() - startTime;

    let events: Event[] = [];

    if (this.config.transform) {
      events = result.rows.map((row: any) => {
        const event = this.config.transform(row);
        if (!event) return null;
        return {
          ...event,
          timestamp: event.timestamp || Date.now()
        };
      }).filter(Boolean);
    } else {
      events = result.rows.map((row: any, index: number) => ({
        id: `db-${Date.now()}-${index}`,
        timestamp: Date.now(),
        data: row
      }));
    }

    events.forEach(event => {
      this.metrics.eventsReceived++;
      this.metrics.lastActivity = Date.now();
      this.emit('data', event);
    });

    this.updateLatency(latency);
  }

  stop(): void {
    this.disconnect().then(() => {
      this.emit('stopped');
    });
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.emit('paused');
  }

  resume(): void {
    this.startPolling();
    this.emit('resumed');
  }

  getMetrics(): SourceMetrics {
    return { ...this.metrics };
  }

  private updateLatency(latency: number): void {
    const totalLatency = this.metrics.avgLatency * this.metrics.eventsReceived;
    this.metrics.avgLatency = (totalLatency + latency) / (this.metrics.eventsReceived || 1);
  }
}

export class FileConnector extends EventEmitter implements SourceConnector {
  private config: FileConfig;
  private isConnected = false;
  private metrics: SourceMetrics = {
    eventsReceived: 0,
    eventsProcessed: 0,
    errors: 0,
    lastActivity: 0,
    avgLatency: 0,
    connectionStatus: 'disconnected',
    throughput: 0
  };

  private watcher: any = null;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: FileConfig) {
    super();
    this.config = {
      format: 'line-delimited',
      encoding: 'utf8',
      watch: false,
      interval: 10000,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');

      if (!fs.existsSync(this.config.path)) {
        throw new Error(`File not found: ${this.config.path}`);
      }

      this._isConnected = true;
      this.metrics.connectionStatus = 'connected';
      this.emit('connected');

      if (this.config.watch) {
        this.startFileWatcher();
      } else {
        this.startPolling();
      }

    } catch (error) {
      this.metrics.errors++;
      this.metrics.connectionStatus = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  private startFileWatcher(): void {
    const fs = require('fs');
    const path = require('path');

    this.watcher = fs.watch(this.config.path, (eventType: string) => {
      if (eventType === 'change') {
        this.readFile();
      }
    });

    this.readFile();
  }

  private startPolling(): void {
    this.intervalId = setInterval(() => {
      if (!this._isConnected) return;

      try {
        this.readFile();
      } catch (error) {
        this.metrics.errors++;
        this.emit('error', error);
      }
    }, this.config.interval);

    this.readFile();
  }

  private async readFile(): Promise<void> {
    const startTime = Date.now();

    const fs = require('fs');
    const path = require('path');

    try {
      const content = fs.readFileSync(this.config.path, this.config.encoding as BufferEncoding);

      const latency = Date.now() - startTime;
      let events: Event[] = [];

      switch (this.config.format) {
        case 'json':
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            events = data.map((item, index) => ({
              id: `file-${Date.now()}-${index}`,
              timestamp: Date.now(),
              data: item
            }));
          } else {
            events = [{
              id: `file-${Date.now()}`,
              timestamp: Date.now(),
              data
            }];
          }
          break;

        case 'csv':
          const lines = content.split('\n');
          const headers = lines[0].split(',');
          events = lines.slice(1).filter(line => line.trim()).map((line, index) => {
            const values = line.split(',');
            const obj: any = {};
            headers.forEach((header, i) => {
              obj[header] = values[i];
            });
            return {
              id: `file-${Date.now()}-${index}`,
              timestamp: Date.now(),
              data: obj
            };
          });
          break;

        case 'line-delimited':
        default:
          events = content.split('\n').filter(line => line.trim()).map((line, index) => {
            try {
              const data = JSON.parse(line);
              return {
                id: `file-${Date.now()}-${index}`,
                timestamp: Date.now(),
                data
              };
            } catch {
              return {
                id: `file-${Date.now()}-${index}`,
                timestamp: Date.now(),
                data: line
              };
            }
          });
          break;
      }

      if (this.config.transform) {
        events = events.map(event => {
          const transformed = this.config.transform(event.data);
          return {
            ...event,
            data: transformed,
            timestamp: transformed.timestamp || event.timestamp
          };
        });
      }

      events.forEach(event => {
        this.metrics.eventsReceived++;
        this.metrics.lastActivity = Date.now();
        this.emit('data', event);
      });

      this.updateLatency(latency);

    } catch (error) {
      this.metrics.errors++;
      this.emit('error', error);
    }
  }

  disconnect(): Promise<void> {
    if (!this._isConnected) return Promise.resolve();

    return new Promise((resolve) => {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
      }

      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      this._isConnected = false;
      this.metrics.connectionStatus = 'disconnected';
      this.emit('disconnected');
      resolve();
    });
  }

  start(): void {
    this.connect().then(() => {
      this.emit('started');
    });
  }

  stop(): void {
    this.disconnect().then(() => {
      this.emit('stopped');
    });
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  pause(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.emit('paused');
  }

  resume(): void {
    if (this.config.watch) {
      this.startFileWatcher();
    } else {
      this.startPolling();
    }
    this.emit('resumed');
  }

  getMetrics(): SourceMetrics {
    return { ...this.metrics };
  }

  private updateLatency(latency: number): void {
    const totalLatency = this.metrics.avgLatency * this.metrics.eventsReceived;
    this.metrics.avgLatency = (totalLatency + latency) / (this.metrics.eventsReceived || 1);
  }
}

export class ConnectorFactory {
  static create<T>(config: SourceConfig): SourceConnector<T> {
    switch (config.type) {
      case 'kafka':
        return new KafkaConnector(config.connection as KafkaConfig);
      case 'http':
        return new HttpConnector(config.connection as HttpConfig);
      case 'websocket':
        return new WebSocketConnector(config.connection as WebSocketConfig);
      case 'database':
        return new DatabaseConnector(config.connection as DatabaseConfig);
      case 'file':
        return new FileConnector(config.connection as FileConfig);
      default:
        throw new Error(`Unknown connector type: ${config.type}`);
    }
  }

  static createSourceStream<T>(config: SourceConfig): Stream<T> {
    const connector = ConnectorFactory.create<T>(config);

    const stream = new EventEmitter() as Stream<T>;

    connector.on('data', (event: Event<T>) => {
      stream.emit('data', event);
    });

    connector.on('error', (error: Error) => {
      stream.emit('error', error);
    });

    connector.on('connected', () => {
      stream.emit('connected');
    });

    connector.on('disconnected', () => {
      stream.emit('disconnected');
    });

    return {
      ...stream,
      id: config.type + '_' + Date.now(),
      name: config.type,
      source: config.type,
      subscribe: (observer: StreamObserver<T>) => {
        const subscription = {
          id: Math.random().toString(36).substr(2, 9),
          closed: false,
          unsubscribe: () => {
            subscription.closed = true;
            connector.stop();
          }
        };

        if (observer.next) {
          connector.on('data', (event: Event<T>) => observer.next(event));
        }

        if (observer.error) {
          connector.on('error', (error: Error) => observer.error(error));
        }

        if (observer.complete) {
          connector.on('disconnected', () => observer.complete());
        }

        connector.start();
        return subscription;
      }
    } as Stream<T>;
  }
}