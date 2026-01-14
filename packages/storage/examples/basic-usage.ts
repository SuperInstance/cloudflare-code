/**
 * Basic Storage Usage Examples
 */

import { MemoryStorageAdapter, FileManager } from '../src';

async function basicFileOperations() {
  // Create adapter
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  // Create file manager
  const fileManager = new FileManager(adapter);

  // Create a bucket
  await adapter.createBucket({ name: 'my-bucket' });

  // Upload a file
  const data = Buffer.from('Hello, World!');
  const metadata = await fileManager.uploadFile('my-bucket', 'hello.txt', data);

  console.log('Uploaded file:');
  console.log('  Key:', metadata.key);
  console.log('  Size:', metadata.size);
  console.log('  Content-Type:', metadata.contentType);
  console.log('  ETag:', metadata.etag);

  // Download the file
  const { data: downloaded, metadata: dlMetadata } = await fileManager.downloadFile(
    'my-bucket',
    'hello.txt'
  );

  console.log('\nDownloaded file:');
  console.log('  Content:', downloaded.toString());
  console.log('  Size:', dlMetadata.size);

  // List files
  const { objects } = await adapter.listFiles('my-bucket');
  console.log('\nFiles in bucket:');
  for (const file of objects) {
    console.log(`  - ${file.key} (${file.size} bytes)`);
  }

  // Delete the file
  await fileManager.deleteFile('my-bucket', 'hello.txt');
  console.log('\nFile deleted');

  // Cleanup
  await adapter.close();
}

async function batchOperations() {
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  const fileManager = new FileManager(adapter);

  await adapter.createBucket({ name: 'batch-bucket' });

  // Upload multiple files
  const files = [
    { key: 'file1.txt', data: Buffer.from('File 1 content') },
    { key: 'file2.txt', data: Buffer.from('File 2 content') },
    { key: 'file3.txt', data: Buffer.from('File 3 content') },
  ];

  console.log('Uploading files in batch...');
  const result = await fileManager.batchUpload('batch-bucket', files, {
    concurrency: 2,
    progressCallback: (progress) => {
      console.log(`  Progress: ${progress.completed}/${progress.total}`);
    },
  });

  console.log(`  Successful: ${result.successful.length}`);
  console.log(`  Failed: ${result.failed.length}`);

  // Download multiple files
  console.log('\nDownloading files in batch...');
  const downloadResult = await fileManager.batchDownload(
    'batch-bucket',
    ['file1.txt', 'file2.txt', 'file3.txt']
  );

  console.log(`  Downloaded: ${downloadResult.successful.length} files`);

  // Delete multiple files
  console.log('\nDeleting files in batch...');
  const deleteResult = await fileManager.batchDelete(
    'batch-bucket',
    ['file1.txt', 'file2.txt', 'file3.txt']
  );

  console.log(`  Deleted: ${deleteResult.successful.length} files`);

  await adapter.close();
}

async function fileSearch() {
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  const fileManager = new FileManager(adapter);

  await adapter.createBucket({ name: 'search-bucket' });

  // Upload various files
  await fileManager.uploadFile('search-bucket', 'doc1.txt', Buffer.from('Document 1'));
  await fileManager.uploadFile('search-bucket', 'doc2.txt', Buffer.from('Document 2'));
  await fileManager.uploadFile('search-bucket', 'image.jpg', Buffer.from('Fake image'));
  await fileManager.uploadFile('search-bucket', 'data.json', Buffer.from('{"key":"value"}'));

  // Search by prefix
  console.log('Searching for files with prefix "doc":');
  const docs = await fileManager.searchFiles('search-bucket', { prefix: 'doc' });
  for (const file of docs) {
    console.log(`  - ${file.key}`);
  }

  // Search by suffix
  console.log('\nSearching for .txt files:');
  const textFiles = await fileManager.searchFiles('search-bucket', { suffix: '.txt' });
  for (const file of textFiles) {
    console.log(`  - ${file.key}`);
  }

  // Search by content type
  console.log('\nSearching for text/plain files:');
  const plainText = await fileManager.searchFiles('search-bucket', {
    contentType: 'text/plain',
  });
  for (const file of plainText) {
    console.log(`  - ${file.key}`);
  }

  await adapter.close();
}

async function fileTagging() {
  const adapter = new MemoryStorageAdapter({
    backend: 'memory',
    credentials: { backend: 'memory', credentials: {} },
  });

  const fileManager = new FileManager(adapter);

  await adapter.createBucket({ name: 'tags-bucket' });

  // Upload file with tags
  await fileManager.uploadFile(
    'tags-bucket',
    'important.txt',
    Buffer.from('Important document'),
    undefined,
    undefined,
    { priority: 'high', category: 'documents' }
  );

  // Get file tags
  const tags = await fileManager.getFileTags('tags-bucket', 'important.txt');
  console.log('File tags:', tags);

  // Add a tag
  await fileManager.addFileTag('tags-bucket', 'important.txt', 'author', 'John Doe');
  const updatedTags = await fileManager.getFileTags('tags-bucket', 'important.txt');
  console.log('Updated tags:', updatedTags);

  // Remove a tag
  await fileManager.removeFileTag('tags-bucket', 'important.txt', 'priority');
  const finalTags = await fileManager.getFileTags('tags-bucket', 'important.txt');
  console.log('Final tags:', finalTags);

  await adapter.close();
}

async function runExamples() {
  console.log('=== Basic File Operations ===\n');
  await basicFileOperations();

  console.log('\n=== Batch Operations ===\n');
  await batchOperations();

  console.log('\n=== File Search ===\n');
  await fileSearch();

  console.log('\n=== File Tagging ===\n');
  await fileTagging();
}

runExamples().catch(console.error);
