// Test setup file
import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('fs');
jest.mock('fs/promises');
jest.mock('os');
jest.mock('path');
jest.mock('zlib');
jest.mock('csv-writer');
jest.mock('exceljs');
jest.mock('parquetjs');
jest.mock('node-cron');

// Setup global test variables
global.console = {
  ...console,
  // Suppress console errors during tests
  error: jest.fn(),
  warn: jest.fn()
};

// Mock implementation for external libraries
const mockFs = require('fs');
const mockFsPromises = require('fs/promises');
const mockOs = require('os');
const mockPath = require('path');
const mockZlib = require('zlib');
const mockCsvWriter = require('csv-writer');
const mockExcelJs = require('exceljs');
const mockParquet = require('parquetjs');
const mockCron = require('node-cron');

// Mock implementations
mockFs.createWriteStream.mockReturnValue({
  write: jest.fn(),
  end: jest.fn(),
  on: jest.fn()
});

mockFsPromises.mkdtemp.mockResolvedValue('/tmp/test-dir');
mockFsPromises.writeFile.mockResolvedValue(undefined);
mockFsPromises.unlink.mockResolvedValue(undefined);
mockFsPromises.readdir.mockResolvedValue([]);
mockFsPromises.stat.mockResolvedValue({ size: 1024 });

mockOs.tmpdir.mockReturnValue('/tmp');
mockOs.platform.mockReturnValue('linux');

mockPath.join.mockImplementation((...args) => args.join('/'));
mockPath.basename.mockReturnValue('test-file');
mockPath.extname.mockReturnValue('.txt');

mockZlib.gzip.mockImplementation((buffer, callback) => callback(null, Buffer.from('compressed')));
mockZlib.gunzip.mockImplementation((buffer, callback) => callback(null, Buffer.from('decompressed')));
mockZlib.brotliCompress.mockImplementation((buffer, callback) => callback(null, Buffer.from('compressed')));
mockZlib.brotliDecompress.mockImplementation((buffer, callback) => callback(null, Buffer.from('decompressed')));

mockCsvWriter.createObjectCsvWriter.mockReturnValue({
  writeRecords: jest.fn().mockResolvedValue(undefined)
});

mockExcelJs.Workbook.mockImplementation(function() {
  this.addWorksheet = jest.fn().mockReturnValue({
    addRow: jest.fn()
  });
  this.xlsx.writeFile = jest.fn().mockResolvedValue(undefined);
});

mockParquet.ParquetWriter.mockImplementation({
  openFile: jest.fn().mockResolvedValue({
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined)
  }),
  open: jest.fn().mockResolvedValue({
    read: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined)
  })
});

mockCron.schedule.mockReturnValue({
  start: jest.fn(),
  stop: jest.fn()
});

// Increase timeout for async operations
jest.setTimeout(30000);