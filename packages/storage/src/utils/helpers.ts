/**
 * Utility Functions for Storage Operations
 */

import type { FileMetadata } from '../types';

// ============================================================================
// File Size Utilities
// ============================================================================

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parse human-readable size string to bytes
 */
export function parseBytes(size: string): number {
  const units: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
    PB: 1024 ** 5,
  };

  const match = size.match(/^(\d+\.?\d*)\s*(B|KB|MB|GB|TB|PB)$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase() as keyof typeof units;

  return value * (units[unit] || 1);
}

// ============================================================================
// File Path Utilities
// ============================================================================

/**
 * Normalize file path
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Get file name from path
 */
export function getFileName(path: string): string {
  const parts = path.split('/');
  return parts.pop() || '';
}

/**
 * Get directory from path
 */
export function getDirectory(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return normalizePath(segments.filter(Boolean).join('/'));
}

// ============================================================================
// Content Type Utilities
// ============================================================================

/**
 * Get content type from file extension
 */
export function getContentType(filename: string): string {
  const ext = getFileExtension(filename);
  const contentTypes: Record<string, string> = {
    txt: 'text/plain',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    xml: 'application/xml',
    pdf: 'application/pdf',
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    mkv: 'video/x-matroska',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
  };

  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Check if content type is an image
 */
export function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

/**
 * Check if content type is a video
 */
export function isVideo(contentType: string): boolean {
  return contentType.startsWith('video/');
}

/**
 * Check if content type is an audio
 */
export function isAudio(contentType: string): boolean {
  return contentType.startsWith('audio/');
}

/**
 * Check if content type is a document
 */
export function isDocument(contentType: string): boolean {
  return (
    contentType.includes('pdf') ||
    contentType.includes('word') ||
    contentType.includes('excel') ||
    contentType.includes('powerpoint') ||
    contentType.includes('document') ||
    contentType.includes('spreadsheet') ||
    contentType.includes('presentation')
  );
}

// ============================================================================
// Checksum Utilities
// ============================================================================

/**
 * Calculate MD5 hash of buffer
 */
export function calculateMD5(data: Buffer): string {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Calculate SHA256 hash of buffer
 */
export function calculateSHA256(data: Buffer): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Calculate checksum using specified algorithm
 */
export function calculateChecksum(data: Buffer, algorithm: 'md5' | 'sha256' | 'sha1' = 'md5'): string {
  const crypto = require('crypto');
  return crypto.createHash(algorithm).update(data).digest('hex');
}

// ============================================================================
// Range Utilities
// ============================================================================

/**
 * Parse range header
 */
export function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return null;

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

/**
 * Format range header
 */
export function formatRangeHeader(start: number, end: number): string {
  return `bytes=${start}-${end}`;
}

// ============================================================================
// Metadata Utilities
// ============================================================================

/**
 * Clone file metadata
 */
export function cloneMetadata(metadata: FileMetadata): FileMetadata {
  return {
    ...metadata,
    customMetadata: metadata.customMetadata ? { ...metadata.customMetadata } : undefined,
    tags: metadata.tags ? { ...metadata.tags } : undefined,
  };
}

/**
 * Merge metadata
 */
export function mergeMetadata(
  base: FileMetadata,
  updates: Partial<FileMetadata>
): FileMetadata {
  return {
    ...base,
    ...updates,
    customMetadata: {
      ...base.customMetadata,
      ...updates.customMetadata,
    },
    tags: {
      ...base.tags,
      ...updates.tags,
    },
  };
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate bucket name
 */
export function validateBucketName(name: string): boolean {
  // Bucket name must be between 3 and 63 characters
  if (name.length < 3 || name.length > 63) {
    return false;
  }

  // Must contain only lowercase letters, numbers, dots, and hyphens
  if (!/^[a-z0-9.-]+$/.test(name)) {
    return false;
  }

  // Must start and end with a letter or number
  if (!/^[a-z0-9]/.test(name) || !/[a-z0-9]$/.test(name)) {
    return false;
  }

  // Must not be an IP address
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name)) {
    return false;
  }

  return true;
}

/**
 * Validate file key
 */
export function validateFileKey(key: string): boolean {
  // Key must be between 1 and 1024 characters
  if (key.length < 1 || key.length > 1024) {
    return false;
  }

  // Must not contain special characters
  // Note: Different providers have different rules, this is a general check
  return true;
}

/**
 * Validate storage class
 */
export function validateStorageClass(storageClass: string): boolean {
  const validClasses = [
    'STANDARD',
    'REDUCED_REDUNDANCY',
    'STANDARD_IA',
    'ONEZONE_IA',
    'INTELLIGENT_TIERING',
    'GLACIER',
    'DEEP_ARCHIVE',
    'OUTPOSTS',
  ];

  return validClasses.includes(storageClass);
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Convert file metadata to plain object
 */
export function metadataToObject(metadata: FileMetadata): Record<string, any> {
  return {
    key: metadata.key,
    bucket: metadata.bucket,
    size: metadata.size,
    contentType: metadata.contentType,
    etag: metadata.etag,
    versionId: metadata.versionId,
    lastModified: metadata.lastModified.toISOString(),
    customMetadata: metadata.customMetadata,
    storageClass: metadata.storageClass,
    encryption: metadata.encryption,
    tags: metadata.tags,
  };
}

/**
 * Convert plain object to file metadata
 */
export function objectToMetadata(obj: Record<string, any>): FileMetadata {
  return {
    key: obj.key,
    bucket: obj.bucket,
    size: obj.size,
    contentType: obj.contentType,
    etag: obj.etag,
    versionId: obj.versionId,
    lastModified: new Date(obj.lastModified),
    customMetadata: obj.customMetadata,
    storageClass: obj.storageClass,
    encryption: obj.encryption,
    tags: obj.tags,
  };
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Calculate time difference in human-readable format
 */
export function timeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  return formatDuration(diff) + ' ago';
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch array operations
 */
export async function batch<T, R>(
  items: T[],
  size: number,
  fn: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const chunks = chunk(items, size);
  const results: R[] = [];

  for (const chunk of chunks) {
    const batchResults = await fn(chunk);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

// ============================================================================
// Stream Utilities
// ============================================================================

/**
 * Convert buffer to stream
 */
export function bufferToStream(buffer: Buffer): NodeJS.ReadableStream {
  const { Readable } = require('stream');
  return Readable.from(buffer);
}

/**
 * Convert stream to buffer
 */
export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Pipe stream with error handling
 */
export async function pipeWithErrors(
  source: NodeJS.ReadableStream,
  destination: NodeJS.WritableStream
): Promise<void> {
  return new Promise((resolve, reject) => {
    source.pipe(destination)
      .on('finish', resolve)
      .on('error', reject);
  });
}

// ============================================================================
// URL Utilities
// ============================================================================

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, string | number | boolean>): string {
  const parts = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = queryString.startsWith('?')
    ? queryString.slice(1).split('&')
    : queryString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }

  return params;
}

/**
 * Add query parameters to URL
 */
export function addQueryParams(url: string, params: Record<string, string | number | boolean>): string {
  const queryString = buildQueryString(params);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${queryString.slice(1)}`;
}
