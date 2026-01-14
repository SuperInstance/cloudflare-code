/**
 * System Information Utilities
 * Capture system and environment information for benchmark context
 */

import os from 'os';
import type { SystemInfo } from '../types/index.js';

/**
 * Get comprehensive system information
 */
export function getSystemInfo(): SystemInfo {
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'Unknown';
  const cpuSpeed = cpus[0]?.speed || 0;

  return {
    cpuModel,
    cpuSpeed,
    cpuCores: cpus.length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    platform: os.platform(),
    osRelease: os.release(),
    osVersion: os.version(),
    arch: os.arch(),
    nodeVersion: process.version,
    v8Version: process.versions.v8 || 'Unknown',
    programName: process.argv[1] || 'unknown'
  };
}

/**
 * Get current process memory usage
 */
export function getProcessMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    rss: usage.rss
  };
}

/**
 * Get current process CPU usage
 */
export function getProcessCpuUsage() {
  const usage = process.cpuUsage();
  return {
    user: usage.user,
    system: usage.system
  };
}

/**
 * Get CPU usage percentage
 */
export function getCpuUsagePercent(): number {
  const cpus = os.cpus();
  const startUsage = process.cpuUsage();
  const startTime = Date.now();

  return new Promise((resolve) => {
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const elapsedTime = Date.now() - startTime;
      const totalUsage = endUsage.user + endUsage.system;
      const percent = (totalUsage / (elapsedTime * 1000)) * 100;
      resolve(percent);
    }, 100);
  }) as any;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format nanoseconds to human readable string
 */
export function formatNanoseconds(ns: number): string {
  const units = [
    { name: 'ns', factor: 1 },
    { name: 'μs', factor: 1000 },
    { name: 'ms', factor: 1000000 },
    { name: 's', factor: 1000000000 }
  ];

  for (const unit of units) {
    if (Math.abs(ns) < unit.factor * 1000 || unit === units[units.length - 1]) {
      return `${(ns / unit.factor).toFixed(2)} ${unit.name}`;
    }
  }

  return `${ns} ns`;
}

/**
 * Format operations per second
 */
export function formatOpsPerSecond(ops: number): string {
  if (ops >= 1_000_000_000) {
    return `${(ops / 1_000_000_000).toFixed(2)} G ops/s`;
  } else if (ops >= 1_000_000) {
    return `${(ops / 1_000_000).toFixed(2)} M ops/s`;
  } else if (ops >= 1_000) {
    return `${(ops / 1_000).toFixed(2)} K ops/s`;
  }
  return `${ops.toFixed(2)} ops/s`;
}

/**
 * Calculate percentage difference
 */
export function percentageDifference(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Calculate speedup factor
 */
export function speedupFactor(baselineTime: number, currentTime: number): number {
  if (currentTime === 0) return 0;
  return baselineTime / currentTime;
}

/**
 * Format system info for display
 */
export function formatSystemInfo(info: SystemInfo): string {
  return `
System Information:
  CPU: ${info.cpuModel}
  Cores: ${info.cpuCores}
  Speed: ${info.cpuSpeed} MHz
  Memory: ${formatBytes(info.totalMemory)} total, ${formatBytes(info.freeMemory)} free
  Platform: ${info.platform} ${info.osRelease}
  Architecture: ${info.arch}
  Node: ${info.nodeVersion}
  V8: ${info.v8Version}
`.trim();
}
