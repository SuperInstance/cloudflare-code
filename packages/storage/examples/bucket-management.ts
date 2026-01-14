/**
 * Bucket Management Examples
 */

import { MemoryStorageAdapter } from '../src';
import { BucketManager } from '../src';

async function bucketOperations() {
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  const bucketManager = new BucketManager(adapter);

  // Create buckets
  await bucketManager.createBucket({
    name: 'data-bucket',
    location: 'us-east-1',
    versioning: { status: 'Enabled' },
  });

  await bucketManager.createBucket({
    name: 'backup-bucket',
    location: 'us-west-2',
  });

  console.log('Created buckets');

  // List buckets
  const buckets = await bucketManager.listBuckets();
  console.log('\nAll buckets:');
  for (const bucket of buckets) {
    console.log(`  - ${bucket.name} (${bucket.location})`);
  }

  // Get bucket metadata
  const metadata = await bucketManager.getBucket('data-bucket');
  console.log('\nBucket metadata:', metadata.name);
  console.log('  Object count:', metadata.objectCount);
  console.log('  Storage class:', metadata.storageClass);
  console.log('  Versioning:', metadata.versioning);

  await adapter.close();
}

async function bucketAnalytics() {
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  const bucketManager = new BucketManager(adapter);

  // Create bucket and add files
  await adapter.createBucket({ name: 'analytics-bucket' });

  await adapter.uploadFile('analytics-bucket', 'file1.txt', Buffer.from('File 1'));
  await adapter.uploadFile('analytics-bucket', 'file2.txt', Buffer.from('File 2'));
  await adapter.uploadFile('analytics-bucket', 'large.dat', Buffer.from('Large file content'));
  await adapter.uploadFile('analytics-bucket', 'small.txt', Buffer.from('Small'));

  // Get analytics
  const analytics = await bucketManager.getBucketAnalytics('analytics-bucket');

  console.log('Bucket Analytics:');
  console.log('  Total objects:', analytics.objectCount);
  console.log('  Total size:', analytics.totalSize);
  console.log('  Average size:', analytics.averageSize);
  console.log('  Largest file:', analytics.largestObject?.key);
  console.log('  Smallest file:', analytics.smallestObject?.key);

  console.log('\nSize distribution:');
  for (const [size, count] of Object.entries(analytics.sizeDistribution)) {
    console.log(`  ${size}: ${count}`);
  }

  console.log('\nContent type distribution:');
  for (const [type, count] of Object.entries(analytics.contentTypeDistribution)) {
    console.log(`  ${type}: ${count}`);
  }

  await adapter.close();
}

async function bucketSync() {
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  const bucketManager = new BucketManager(adapter);

  // Create source and destination buckets
  await adapter.createBucket({ name: 'source-bucket' });
  await adapter.createBucket({ name: 'dest-bucket' });

  // Add files to source
  await adapter.uploadFile('source-bucket', 'file1.txt', Buffer.from('File 1'));
  await adapter.uploadFile('source-bucket', 'file2.txt', Buffer.from('File 2'));
  await adapter.uploadFile('source-bucket', 'file3.txt', Buffer.from('File 3'));

  // Add different file to destination
  await adapter.uploadFile('dest-bucket', 'file2.txt', Buffer.from('File 2'));
  await adapter.uploadFile('dest-bucket', 'file4.txt', Buffer.from('File 4'));

  // Sync buckets
  console.log('Syncing buckets...');
  const result = await bucketManager.syncBuckets('source-bucket', 'dest-bucket');

  console.log('Sync result:');
  console.log('  Copied:', result.copied);
  console.log('  Skipped:', result.skipped);
  console.log('  Deleted:', result.deleted);
  console.log('  Errors:', result.errors);

  // List destination files
  const destFiles = await adapter.listFiles('dest-bucket');
  console.log('\nDestination files:', destFiles.objects.length);

  await adapter.close();
}

async function bucketComparison() {
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  const bucketManager = new BucketManager(adapter);

  // Create two buckets with different content
  await adapter.createBucket({ name: 'bucket1' });
  await adapter.createBucket({ name: 'bucket2' });

  await adapter.uploadFile('bucket1', 'common.txt', Buffer.from('Common'));
  await adapter.uploadFile('bucket1', 'only1.txt', Buffer.from('Only in 1'));

  await adapter.uploadFile('bucket2', 'common.txt', Buffer.from('Common'));
  await adapter.uploadFile('bucket2', 'only2.txt', Buffer.from('Only in 2'));

  // Compare buckets
  const comparison = await bucketManager.compareBuckets('bucket1', 'bucket2');

  console.log('Bucket Comparison:');
  console.log('  Only in bucket1:', comparison.onlyInBucket1);
  console.log('  Only in bucket2:', comparison.onlyInBucket2);
  console.log('  Same files:', comparison.same.length);
  console.log('  Different files:', comparison.different.length);

  await adapter.close();
}

async function bucketCleanup() {
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  const bucketManager = new BucketManager(adapter);

  await adapter.createBucket({ name: 'cleanup-bucket' });

  // Add some files
  await adapter.uploadFile('cleanup-bucket', 'keep1.txt', Buffer.from('Keep 1'));
  await adapter.uploadFile('cleanup-bucket', 'keep2.txt', Buffer.from('Keep 2'));
  await adapter.uploadFile('cleanup-bucket', 'delete1.txt', Buffer.from('Delete 1'));
  await adapter.uploadFile('cleanup-bucket', 'delete2.txt', Buffer.from('Delete 2'));

  // Cleanup specific files
  await bucketManager.emptyBucket('cleanup-bucket');

  const result = await adapter.listFiles('cleanup-bucket');
  console.log('Files after cleanup:', result.objects.length);

  await adapter.close();
}

async function runExamples() {
  console.log('=== Bucket Operations ===\n');
  await bucketOperations();

  console.log('\n=== Bucket Analytics ===\n');
  await bucketAnalytics();

  console.log('\n=== Bucket Sync ===\n');
  await bucketSync();

  console.log('\n=== Bucket Comparison ===\n');
  await bucketComparison();

  console.log('\n=== Bucket Cleanup ===\n');
  await bucketCleanup();
}

runExamples().catch(console.error);
