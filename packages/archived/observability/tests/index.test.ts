/**
 * Test entry point
 */

import { describe, it, expect } from 'vitest';

describe('Observability Package', () => {
  it('should export all main components', () => {
    const pkg = require('../src/index');

    expect(pkg.Observability).toBeDefined();
    expect(pkg.createObservability).toBeDefined();
    expect(pkg.DistributedTracer).toBeDefined();
    expect(pkg.StructuredLogger).toBeDefined();
    expect(pkg.CPUProfiler).toBeDefined();
    expect(pkg.MemoryProfiler).toBeDefined();
    expect(pkg.MemoryLeakDetector).toBeDefined();
    expect(pkg.HTTPInspector).toBeDefined();
    expect(pkg.DebugRecorder).toBeDefined();
    expect(pkg.SessionReplayer).toBeDefined();
  });

  it('should export utility functions', () => {
    const pkg = require('../src/index');

    expect(pkg.generateTraceId).toBeDefined();
    expect(pkg.now).toBeDefined();
    expect(pkg.formatDuration).toBeDefined();
    expect(pkg.extractErrorInfo).toBeDefined();
  });

  it('should export version', () => {
    const pkg = require('../src/index');
    expect(pkg.VERSION).toBeDefined();
  });
});
