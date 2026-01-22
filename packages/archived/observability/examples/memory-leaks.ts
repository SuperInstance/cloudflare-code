/**
 * Memory leak detection example
 */

import { MemoryLeakDetector } from '@claudeflare/observability';

async function main() {
  const detector = new MemoryLeakDetector({
    threshold: 20, // 20% growth threshold
    minSnapshots: 3,
  });

  console.log('Starting memory leak detection...');

  // Start monitoring
  detector.startMonitoring();

  // Take initial snapshot
  await detector.takeSnapshot();
  console.log('Initial snapshot taken');

  // Simulate some memory allocations
  await simulateMemoryGrowth();

  // Take another snapshot
  await detector.takeSnapshot();
  console.log('Second snapshot taken');

  // More allocations
  await simulateMemoryGrowth();

  // Final snapshot
  await detector.takeSnapshot();
  console.log('Third snapshot taken');

  // Check for leaks
  const leaks = detector.checkForLeaks();

  if (leaks.length > 0) {
    console.warn('Memory leaks detected:', leaks);

    for (const leak of leaks) {
      console.error(`- ${leak.type}: ${leak.description}`);
      console.error(`  Size: ${leak.size} bytes`);
      console.error(`  Severity: ${leak.severity}`);
    }
  } else {
    console.log('No memory leaks detected');
  }

  // Get detection report
  const report = detector.getDetectionReport();
  console.log('\nDetection Report:', report);

  // Get memory timeline
  const timeline = detector.getTimeline();
  console.log('\nMemory Timeline:', timeline);

  // Stop monitoring
  detector.stopMonitoring();
}

async function simulateMemoryGrowth(): Promise<void> {
  // Create some objects that might leak
  const leakedData: any[] = [];

  for (let i = 0; i < 1000; i++) {
    leakedData.push({
      id: i,
      data: new Array(1000).fill(`data-${i}`),
      timestamp: Date.now(),
    });
  }

  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // In a real leak, these references wouldn't be cleared
  // For this demo, we'll just let them grow
}

main().catch(console.error);
