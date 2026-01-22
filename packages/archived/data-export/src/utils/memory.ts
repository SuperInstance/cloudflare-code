// @ts-nocheck
export interface MemoryMonitor {
  getCurrentMemory(): number;
  getMemoryLimit(): number;
  isMemoryLimitExceeded(): boolean;
  setMemoryLimit(limit: number): void;
  onMemoryLimit(callback: () => void): void;
}

export class MemoryMonitorImpl implements MemoryMonitor {
  private memoryLimit: number;
  private callbacks: Set<() => void> = new Set();

  constructor(limit: number = 1024 * 1024 * 500) { // Default 500MB
    this.memoryLimit = limit;
  }

  getCurrentMemory(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed + usage.external;
  }

  getMemoryLimit(): number {
    return this.memoryLimit;
  }

  setMemoryLimit(limit: number): void {
    this.memoryLimit = limit;
  }

  isMemoryLimitExceeded(): boolean {
    return this.getCurrentMemory() >= this.memoryLimit;
  }

  onMemoryLimit(callback: () => void): void {
    this.callbacks.add(callback);
  }

  checkMemory(): boolean {
    const exceeded = this.isMemoryLimitExceeded();
    if (exceeded) {
      this.callbacks.forEach(callback => callback());
    }
    return exceeded;
  }
}

export function estimateRecordSize(records: any[]): number {
  if (!records.length) return 0;

  const sample = records.slice(0, Math.min(100, records.length));
  const json = JSON.stringify(sample);
  return json.length;
}

export function calculateChunkSize(
  totalRecords: number,
  targetMemoryMB: number = 100,
  safetyFactor: number = 0.8
): number {
  const targetMemory = targetMemoryMB * 1024 * 1024 * safetyFactor;
  const estimatedSizePerRecord = estimateRecordSize([{}]);

  if (estimatedSizePerRecord === 0) {
    return Math.ceil(totalRecords / 10); // Default to 10 chunks
  }

  const maxRecordsPerChunk = Math.floor(targetMemory / estimatedSizePerRecord);
  return Math.min(maxRecordsPerChunk, Math.ceil(totalRecords / 5)); // At least 5 chunks
}

export function createMemoryAwareChunker(
  records: any[],
  targetMemoryMB: number = 100
): any[][] {
  const chunkSize = calculateChunkSize(records.length, targetMemoryMB);
  const chunks: any[][] = [];

  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  return chunks;
}