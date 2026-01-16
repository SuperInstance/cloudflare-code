"use strict";
/**
 * Unit tests for Log Collector
 */
Object.defineProperty(exports, "__esModule", { value: true });
const collector_1 = require("../../src/collector/collector");
const types_1 = require("../../src/types");
describe('LogCollector', () => {
    let collector;
    let config;
    beforeEach(() => {
        config = {
            service: 'test-service',
            environment: 'test',
            host: 'localhost',
            options: {
                batchSize: 10,
                bufferTimeout: 1000,
                enrichment: true,
                validation: true,
                deduplication: true,
            },
        };
        collector = new collector_1.LogCollector(config);
    });
    afterEach(async () => {
        await collector.shutdown();
    });
    describe('initialization', () => {
        test('should create collector with default options', () => {
            const defaultCollector = new collector_1.LogCollector({ service: 'test' });
            expect(defaultCollector).toBeInstanceOf(collector_1.LogCollector);
            defaultCollector.shutdown();
        });
        test('should initialize with provided config', () => {
            expect(collector).toBeInstanceOf(collector_1.LogCollector);
            const options = collector.getOptions();
            expect(options.batchSize).toBe(10);
            expect(options.bufferTimeout).toBe(1000);
        });
        test('should throw error for invalid service name', () => {
            expect(() => new collector_1.LogCollector({ service: '' })).toThrow();
        });
    });
    describe('collect', () => {
        test('should collect a log entry', async () => {
            const entry = {
                message: 'Test log message',
                level: types_1.LogLevel.INFO,
                service: 'test-service',
            };
            const result = await collector.collect(entry);
            expect(result).toBeDefined();
            expect(result.message).toBe('Test log message');
            expect(result.level).toBe(types_1.LogLevel.INFO);
            expect(result.service).toBe('test-service');
            expect(result.id).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });
        test('should enrich log entry when enabled', async () => {
            const enrichedCollector = new collector_1.LogCollector({
                service: 'test',
                options: { enrichment: true },
            });
            const entry = {
                message: 'Test',
                level: types_1.LogLevel.INFO,
                service: 'test',
            };
            const result = await enrichedCollector.collect(entry);
            expect(result.metadata).toBeDefined();
            expect(result.metadata?.collector).toBeDefined();
            await enrichedCollector.shutdown();
        });
        test('should handle error objects', async () => {
            const error = new Error('Test error');
            const entry = {
                message: 'Error occurred',
                level: types_1.LogLevel.ERROR,
                service: 'test',
                error,
            };
            const result = await collector.collect(entry);
            expect(result.error).toBeDefined();
            expect(result.error?.name).toBe('Error');
            expect(result.error?.message).toBe('Test error');
        });
        test('should deduplicate logs when enabled', async () => {
            const entry = {
                message: 'Duplicate test',
                level: types_1.LogLevel.INFO,
                service: 'test',
                metadata: { key: 'value' },
            };
            const result1 = await collector.collect(entry);
            const result2 = await collector.collect(entry);
            // Second collection should return the same entry
            expect(result1.id).toBe(result2.id);
            // Check buffer size - should only have one entry
            expect(collector.getBufferSize()).toBe(1);
        });
        test('should emit log:received event', async () => {
            const eventSpy = jest.fn();
            collector.on('log:received', eventSpy);
            const entry = {
                message: 'Test event',
                level: types_1.LogLevel.INFO,
                service: 'test',
            };
            await collector.collect(entry);
            expect(eventSpy).toHaveBeenCalledTimes(1);
            expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Test event',
            }));
        });
        test('should sanitize long messages', async () => {
            const longMessage = 'a'.repeat(20000);
            const entry = {
                message: longMessage,
                level: types_1.LogLevel.INFO,
                service: 'test',
            };
            const result = await collector.collect(entry);
            expect(result.message.length).toBeLessThanOrEqual(10000);
        });
    });
    describe('collectMany', () => {
        test('should collect multiple log entries', async () => {
            const entries = [
                { message: 'Log 1', level: types_1.LogLevel.INFO, service: 'test' },
                { message: 'Log 2', level: types_1.LogLevel.WARN, service: 'test' },
                { message: 'Log 3', level: types_1.LogLevel.ERROR, service: 'test' },
            ];
            const results = await collector.collectMany(entries);
            expect(results).toHaveLength(3);
            expect(results[0].message).toBe('Log 1');
            expect(results[1].message).toBe('Log 2');
            expect(results[2].message).toBe('Log 3');
        });
    });
    describe('flush', () => {
        test('should flush buffer when batch size is reached', async () => {
            const flushSpy = jest.fn();
            collector.on('batch:flushed', flushSpy);
            const entries = Array.from({ length: 10 }, (_, i) => ({
                message: `Log ${i}`,
                level: types_1.LogLevel.INFO,
                service: 'test',
            }));
            await collector.collectMany(entries);
            // Wait for async processing
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(flushSpy).toHaveBeenCalled();
        });
        test('should return null if buffer is empty', () => {
            const result = collector.flush();
            expect(result).toBeNull();
        });
        test('should create valid batch', async () => {
            const entry = {
                message: 'Test',
                level: types_1.LogLevel.INFO,
                service: 'test',
            };
            await collector.collect(entry);
            const batch = collector.flush('manual');
            expect(batch).not.toBeNull();
            expect(batch?.entries).toHaveLength(1);
            expect(batch?.metadata.batchId).toBeDefined();
            expect(batch?.metadata.count).toBe(1);
        });
    });
    describe('getStats', () => {
        test('should return collector statistics', async () => {
            const entry = {
                message: 'Test',
                level: types_1.LogLevel.INFO,
                service: 'test',
            };
            await collector.collect(entry);
            const stats = collector.getStats();
            expect(stats.bufferSize).toBe(1);
            expect(stats.bufferSizeBytes).toBeGreaterThan(0);
            expect(stats.queueStatus).toBeDefined();
        });
    });
    describe('child', () => {
        test('should create child collector', () => {
            const child = collector.child('child-service');
            expect(child).toBeInstanceOf(collector_1.LogCollector);
        });
        test('should forward events from child to parent', async () => {
            const eventSpy = jest.fn();
            collector.on('log:received', eventSpy);
            const child = collector.child('child-service');
            const entry = {
                message: 'Child log',
                level: types_1.LogLevel.INFO,
                service: 'child-service',
            };
            await child.collect(entry);
            expect(eventSpy).toHaveBeenCalled();
        });
    });
    describe('updateOptions', () => {
        test('should update collector options', () => {
            collector.updateOptions({
                batchSize: 100,
                bufferTimeout: 5000,
            });
            const options = collector.getOptions();
            expect(options.batchSize).toBe(100);
            expect(options.bufferTimeout).toBe(5000);
        });
    });
    describe('shutdown', () => {
        test('should shutdown gracefully', async () => {
            const entry = {
                message: 'Test',
                level: types_1.LogLevel.INFO,
                service: 'test',
            };
            await collector.collect(entry);
            await collector.shutdown();
            const stats = collector.getStats();
            expect(stats.bufferSize).toBe(0);
        });
        test('should flush remaining logs on shutdown', async () => {
            const flushSpy = jest.fn();
            collector.on('batch:flushed', flushSpy);
            const entry = {
                message: 'Test',
                level: types_1.LogLevel.INFO,
                service: 'test',
            };
            await collector.collect(entry);
            await collector.shutdown();
            expect(flushSpy).toHaveBeenCalled();
        });
    });
    describe('error handling', () => {
        test('should emit log:error event on failure', async () => {
            const errorSpy = jest.fn();
            collector.on('log:error', errorSpy);
            // This should trigger validation error
            const invalidEntry = {
                message: '',
                level: types_1.LogLevel.INFO,
                service: 'test',
            };
            try {
                await collector.collect(invalidEntry);
            }
            catch (e) {
                // Expected to throw
            }
            // Error event should be emitted
            expect(errorSpy).toHaveBeenCalled();
        });
    });
    describe('clearDeduplicationCache', () => {
        test('should clear deduplication cache', async () => {
            const entry = {
                message: 'Test',
                level: types_1.LogLevel.INFO,
                service: 'test',
                metadata: { key: 'value' },
            };
            await collector.collect(entry);
            collector.clearDeduplicationCache();
            // Should be able to collect same entry again
            await collector.collect(entry);
            expect(collector.getBufferSize()).toBe(2);
        });
    });
});
describe('createLogCollector', () => {
    test('should create log collector instance', () => {
        const collector = (0, collector_1.createLogCollector)({
            service: 'test',
        });
        expect(collector).toBeInstanceOf(collector_1.LogCollector);
        collector.shutdown();
    });
});
//# sourceMappingURL=collector.test.js.map