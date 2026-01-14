# @claudeflare/storage

A comprehensive storage abstraction layer for the ClaudeFlare distributed AI coding platform, providing multi-cloud file management with CDN integration, encryption, versioning, and analytics.

## Features

- **Multi-Storage Backend Support**
  - Cloudflare R2
  - AWS S3
  - Google Cloud Storage
  - Azure Blob Storage
  - Local filesystem (development)
  - In-memory storage (testing)

- **Advanced File Management**
  - Upload/download with progress tracking
  - Batch operations
  - File search and filtering
  - Duplicate detection
  - File validation and transformation

- **Bucket Management**
  - Create, delete, and configure buckets
  - Bucket analytics and insights
  - Bucket synchronization
  - Lifecycle policies
  - CORS configuration

- **CDN Integration**
  - Cloudflare CDN
  - Cache invalidation
  - Custom domain support
  - SSL certificate management
  - Cache rule configuration

- **File Versioning**
  - Version tracking and restoration
  - Version comparison and diffing
  - Rollback to previous versions
  - Retention policies

- **Encryption**
  - Server-side encryption
  - Client-side encryption
  - Key management
  - Key rotation

- **Storage Analytics**
  - Usage metrics
  - Performance tracking
  - Cost optimization
  - Capacity planning

## Installation

```bash
npm install @claudeflare/storage
```

## Quick Start

```typescript
import { MemoryStorageAdapter, FileManager } from '@claudeflare/storage';

// Create adapter
const adapter = new MemoryStorageAdapter({
  backend: 'memory',
  credentials: { backend: 'memory', credentials: {} },
});

// Create file manager
const fileManager = new FileManager(adapter);

// Upload a file
const metadata = await fileManager.uploadFile(
  'my-bucket',
  'hello.txt',
  Buffer.from('Hello, World!')
);

console.log('Uploaded:', metadata.key, metadata.size);

// Download the file
const { data } = await fileManager.downloadFile('my-bucket', 'hello.txt');
console.log('Content:', data.toString());
```

## Usage Examples

### Using Different Storage Backends

#### Cloudflare R2

```typescript
import { R2StorageAdapter } from '@claudeflare/storage';

const adapter = new R2StorageAdapter({
  backend: 'r2',
  credentials: {
    backend: 'r2',
    credentials: {
      accountId: 'your-account-id',
      accessKeyId: 'your-access-key',
      secretAccessKey: 'your-secret-key',
    },
  },
  region: 'auto',
});
```

#### AWS S3

```typescript
import { S3StorageAdapter } from '@claudeflare/storage';

const adapter = new S3StorageAdapter({
  backend: 's3',
  credentials: {
    backend: 's3',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: 'us-east-1',
    },
  },
  region: 'us-east-1',
});
```

#### Local Storage (Development)

```typescript
import { LocalStorageAdapter } from '@claudeflare/storage';

const adapter = new LocalStorageAdapter({
  backend: 'local',
  credentials: {
    backend: 'local',
    credentials: {
      baseDir: './storage',
    },
  },
});
```

### File Operations

```typescript
// Upload with options
await fileManager.uploadFile(
  'my-bucket',
  'document.pdf',
  fileBuffer,
  {
    contentType: 'application/pdf',
    metadata: { author: 'John Doe' },
    tags: { category: 'documents', year: '2024' },
  }
);

// Batch operations
const files = [
  { key: 'file1.txt', data: Buffer.from('File 1') },
  { key: 'file2.txt', data: Buffer.from('File 2') },
  { key: 'file3.txt', data: Buffer.from('File 3') },
];

const result = await fileManager.batchUpload('my-bucket', files, {
  concurrency: 5,
  progressCallback: (progress) => {
    console.log(`Progress: ${progress.completed}/${progress.total}`);
  },
});

// Search files
const pdfs = await fileManager.searchFiles('my-bucket', {
  suffix: '.pdf',
  contentType: 'application/pdf',
  minSize: 1024,
  maxSize: 10 * 1024 * 1024, // 10MB
});
```

### Bucket Management

```typescript
import { BucketManager } from '@claudeflare/storage';

const bucketManager = new BucketManager(adapter);

// Create bucket
await bucketManager.createBucket({
  name: 'my-bucket',
  location: 'us-east-1',
  versioning: { status: 'Enabled' },
  encryption: { type: 'server-side', algorithm: 'AES256' },
});

// Get analytics
const analytics = await bucketManager.getBucketAnalytics('my-bucket');
console.log('Total objects:', analytics.objectCount);
console.log('Total size:', analytics.totalSize);

// Sync buckets
await bucketManager.syncBuckets('source-bucket', 'dest-bucket', {
  delete: true,
  dryRun: false,
});
```

### CDN Integration

```typescript
import { CDNIntegration } from '@claudeflare/storage';

const cdn = new CDNIntegration({
  provider: 'cloudflare',
  zoneId: 'your-zone-id',
});

// Purge cache
await cdn.purgeFiles(['/file1.jpg', '/file2.jpg']);

// Add custom domain
await cdn.addCustomDomain('cdn.example.com', {
  sslEnabled: true,
});

// Get CDN statistics
const stats = await cdn.getStatistics('24h');
console.log('Cache hit rate:', stats.cacheHitRate);
console.log('Bandwidth saved:', stats.bandwidthSaved);
```

### File Versioning

```typescript
import { VersioningManager } from '@claudeflare/storage';

const versioning = new VersioningManager(adapter);

// List versions
const history = await versioning.listVersions('my-bucket', 'document.pdf');
console.log('Total versions:', history.totalVersions);

// Restore previous version
await versioning.rollback('my-bucket', 'document.pdf', 1);

// Compare versions
const comparison = await versioning.compareVersions(
  'my-bucket',
  'document.pdf',
  'version-1',
  'version-2'
);
```

### Encryption

```typescript
import { EncryptionManager } from '@claudeflare/storage';

const encryption = new EncryptionManager();

// Generate encryption key
const { keyId, key } = encryption.generateKey({
  algorithm: 'AES-GCM-256',
});

// Encrypt data
const { data: encrypted, encryptionInfo } = encryption.encrypt(
  fileBuffer,
  {
    type: 'client-side',
    algorithm: 'AES-GCM-256',
    keyId,
  }
);

// Decrypt data
const { data: decrypted } = encryption.decrypt(encrypted, {
  type: 'client-side',
  algorithm: 'AES-GCM-256',
  keyId,
  iv: encryptionInfo.iv,
  authTag: encryptionInfo.authTag,
});
```

### Storage Analytics

```typescript
import { StorageAnalyticsManager } from '@claudeflare/storage';

const analytics = new StorageAnalyticsManager(adapter);

// Get storage metrics
const metrics = await analytics.getStorageMetrics('my-bucket', {
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31'),
});

// Get usage report
const report = await analytics.getUsageReport('my-bucket', period);

// Generate cost optimization recommendations
const optimization = await analytics.generateCostOptimization('my-bucket');
console.log('Potential savings:', optimization.potentialSavings);

// Classify files by access pattern
const classification = await analytics.classifyFilesByAccess('my-bucket');
console.log('Hot files:', classification.hot.length);
console.log('Cold files:', classification.cold.length);
```

## API Reference

### Core Classes

- **StorageAdapter** - Base adapter for all storage backends
- **FileManager** - High-level file operations
- **BucketManager** - Bucket management and analytics
- **CDNIntegration** - CDN integration and cache management
- **VersioningManager** - File versioning and restoration
- **EncryptionManager** - Encryption and key management
- **StorageAnalyticsManager** - Analytics and insights

### Configuration

```typescript
interface StorageConfig {
  backend: StorageBackend;
  credentials: StorageCredentials;
  region?: string;
  endpoint?: string;
  maxRetries?: number;
  timeout?: number;
  acceleration?: boolean;
  forcePathStyle?: boolean;
  useSSL?: boolean;
}
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT

## Support

For issues and questions, please use the GitHub issue tracker.
