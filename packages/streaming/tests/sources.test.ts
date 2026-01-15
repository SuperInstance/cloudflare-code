import {
  KafkaConnector,
  HttpConnector,
  WebSocketConnector,
  DatabaseConnector,
  FileConnector,
  ConnectorFactory
} from '../src/sources';
import { SourceConfig, KafkaConfig, HttpConfig, WebSocketConfig } from '../src/types';

jest.mock('kafkajs');
jest.mock('pg');
jest.mock('ws');

describe('Source Connectors', () => {
  describe('KafkaConnector', () => {
    let connector: KafkaConnector;
    let config: KafkaConfig;

    beforeEach(() => {
      config = {
        brokers: ['localhost:9092'],
        topic: 'test-topic',
        groupId: 'test-group'
      };
      connector = new KafkaConnector(config);
    });

    afterEach(() => {
      connector.stop();
    });

    it('should create Kafka connector', () => {
      expect(connector).toBeInstanceOf(KafkaConnector);
    });

    it('should track metrics', () => {
      const metrics = connector.getMetrics();
      expect(metrics).toMatchObject({
        eventsReceived: 0,
        eventsProcessed: 0,
        errors: 0,
        connectionStatus: 'disconnected'
      });
    });

    it('should handle connection lifecycle', async () => {
      const connectSpy = jest.spyOn(connector, 'connect');
      const disconnectSpy = jest.spyOn(connector, 'disconnect');

      await connector.connect();
      expect(connectSpy).toHaveBeenCalled();
      expect(connector.isConnected()).toBe(true);

      await connector.disconnect();
      expect(disconnectSpy).toHaveBeenCalled();
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe('HttpConnector', () => {
    let connector: HttpConnector;
    let config: HttpConfig;

    beforeEach(() => {
      config = {
        url: 'https://api.example.com/data',
        interval: 1000,
        timeout: 5000
      };
      connector = new HttpConnector(config);
    });

    afterEach(() => {
      connector.stop();
    });

    it('should create HTTP connector', () => {
      expect(connector).toBeInstanceOf(HttpConnector);
    });

    it('should transform JSON responses', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([{ id: 1, value: 'test' }, { id: 2, value: 'test2' }])
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const dataCallback = jest.fn();
      connector.on('data', dataCallback);

      await connector.start();

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(dataCallback).toHaveBeenCalledTimes(2);
      expect(dataCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { id: 1, value: 'test' }
        })
      );
    });

    it('should handle custom transform function', async () => {
      config.transform = (data) => [
        {
          id: 'transformed',
          timestamp: Date.now(),
          data: { custom: data }
        }
      ];

      const connector = new HttpConnector(config);
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ original: 'data' })
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const dataCallback = jest.fn();
      connector.on('data', dataCallback);

      await connector.start();

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(dataCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { custom: { original: 'data' } }
        })
      );
    });
  });

  describe('WebSocketConnector', () => {
    let connector: WebSocketConnector;
    let config: WebSocketConfig;

    beforeEach(() => {
      config = {
        url: 'ws://localhost:8080',
        reconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3
      };
      connector = new WebSocketConnector(config);
    });

    afterEach(() => {
      connector.stop();
    });

    it('should create WebSocket connector', () => {
      expect(connector).toBeInstanceOf(WebSocketConnector);
    });

    it('should handle WebSocket messages', async () => {
      const mockWebSocket = {
        readyState: 1,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null
      };

      (global as any).WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

      const dataCallback = jest.fn();
      connector.on('data', dataCallback);

      await connector.start();

      const messageEvent = {
        data: JSON.stringify({ id: 1, value: 'test' })
      };

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(messageEvent);
      }

      expect(dataCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { id: 1, value: 'test' }
        })
      );
    });
  });

  describe('DatabaseConnector', () => {
    let connector: DatabaseConnector;
    let config: DatabaseConfig;

    beforeEach(() => {
      config = {
        connectionString: 'postgresql://localhost/test',
        query: 'SELECT * FROM test_table',
        interval: 1000
      };
      connector = new DatabaseConnector(config);
    });

    afterEach(() => {
      connector.stop();
    });

    it('should create database connector', () => {
      expect(connector).toBeInstanceOf(DatabaseConnector);
    });

    it('should transform database rows', async () => {
      const mockPool = {
        query: jest.fn().mockResolvedValue({
          rows: [
            { id: 1, value: 'test' },
            { id: 2, value: 'test2' }
          ]
        })
      };

      const Pool = jest.fn().mockImplementation(() => mockPool);

      connector = new DatabaseConnector({
        ...config,
        transform: (row) => ({
          id: `db-${row.id}`,
          timestamp: Date.now(),
          data: row
        })
      });

      const dataCallback = jest.fn();
      connector.on('data', dataCallback);

      await connector.start();

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(dataCallback).toHaveBeenCalledTimes(2);
      expect(dataCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { id: 1, value: 'test' }
        })
      );
    });
  });

  describe('FileConnector', () => {
    let connector: FileConnector;
    let config: FileConfig;

    beforeEach(() => {
      config = {
        path: '/tmp/test.json',
        format: 'json',
        watch: false,
        interval: 1000
      };
      connector = new FileConnector(config);
    });

    afterEach(() => {
      connector.stop();
    });

    it('should create file connector', () => {
      expect(connector).toBeInstanceOf(FileConnector);
    });

    it('should read JSON files', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        readFileSync: jest.fn().mockReturnValue(JSON.stringify([
          { id: 1, value: 'test' },
          { id: 2, value: 'test2' }
        ]))
      };

      const connector = new FileConnector(config);

      (global as any).require = jest.fn().mockImplementation((module) => {
        if (module === 'fs') return mockFs;
        return {};
      });

      const dataCallback = jest.fn();
      connector.on('data', dataCallback);

      await connector.start();

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(dataCallback).toHaveBeenCalledTimes(2);
      expect(dataCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { id: 1, value: 'test' }
        })
      );
    });

    it('should parse CSV files', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        readFileSync: jest.fn().mockReturnValue('id,value\n1,test\n2,test2')
      };

      const csvConnector = new FileConnector({
        ...config,
        format: 'csv'
      });

      (global as any).require = jest.fn().mockImplementation((module) => {
        if (module === 'fs') return mockFs;
        return {};
      });

      const dataCallback = jest.fn();
      csvConnector.on('data', dataCallback);

      await csvConnector.start();

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(dataCallback).toHaveBeenCalledTimes(2);
      expect(dataCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { id: '1', value: 'test' }
        })
      );
    });
  });

  describe('ConnectorFactory', () => {
    it('should create Kafka connector', () => {
      const config: SourceConfig = {
        type: 'kafka',
        connection: {
          brokers: ['localhost:9092'],
          topic: 'test'
        }
      };

      const connector = ConnectorFactory.create(config);
      expect(connector).toBeInstanceOf(KafkaConnector);
    });

    it('should create HTTP connector', () => {
      const config: SourceConfig = {
        type: 'http',
        connection: {
          url: 'https://api.example.com/data'
        }
      };

      const connector = ConnectorFactory.create(config);
      expect(connector).toBeInstanceOf(HttpConnector);
    });

    it('should create WebSocket connector', () => {
      const config: SourceConfig = {
        type: 'websocket',
        connection: {
          url: 'ws://localhost:8080'
        }
      };

      const connector = ConnectorFactory.create(config);
      expect(connector).toBeInstanceOf(WebSocketConnector);
    });

    it('should create Database connector', () => {
      const config: SourceConfig = {
        type: 'database',
        connection: {
          connectionString: 'postgresql://localhost/test',
          query: 'SELECT 1'
        }
      };

      const connector = ConnectorFactory.create(config);
      expect(connector).toBeInstanceOf(DatabaseConnector);
    });

    it('should create File connector', () => {
      const config: SourceConfig = {
        type: 'file',
        connection: {
          path: '/tmp/test.json'
        }
      };

      const connector = ConnectorFactory.create(config);
      expect(connector).toBeInstanceOf(FileConnector);
    });

    it('should throw error for unknown connector type', () => {
      const config: SourceConfig = {
        type: 'unknown' as any,
        connection: {}
      };

      expect(() => ConnectorFactory.create(config)).toThrow('Unknown connector type: unknown');
    });

    it('should create source stream', () => {
      const config: SourceConfig = {
        type: 'http',
        connection: {
          url: 'https://api.example.com/data'
        }
      };

      const stream = ConnectorFactory.createSourceStream(config);
      expect(stream).toHaveProperty('id');
      expect(stream).toHaveProperty('name');
      expect(stream).toHaveProperty('source');
      expect(stream).toHaveProperty('subscribe');
    });
  });

  describe('Metrics Tracking', () => {
    it('should track all connector metrics', async () => {
      const config: SourceConfig = {
        type: 'http',
        connection: {
          url: 'https://api.example.com/data'
        }
      };

      const connector = ConnectorFactory.create(config);

      const metrics = connector.getMetrics();
      expect(metrics).toHaveProperty('eventsReceived');
      expect(metrics).toHaveProperty('eventsProcessed');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('connectionStatus');
    });

    it('should update metrics during operation', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([{ id: 1, value: 'test' }])
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const config: SourceConfig = {
        type: 'http',
        connection: {
          url: 'https://api.example.com/data'
        }
      };

      const connector = ConnectorFactory.create(config);
      const dataCallback = jest.fn();
      connector.on('data', dataCallback);

      await connector.start();

      await new Promise(resolve => setTimeout(resolve, 1500));

      const metrics = connector.getMetrics();
      expect(metrics.eventsReceived).toBeGreaterThan(0);
      expect(metrics.lastActivity).toBeGreaterThan(0);
    });
  });
});