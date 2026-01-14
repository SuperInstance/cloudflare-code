/**
 * File system utilities
 */

export class FileUtils {
  /**
   * Read file as ArrayBuffer
   */
  static async readFileAsArrayBuffer(path: string): Promise<ArrayBuffer> {
    // In practice, would use actual file system API
    throw new Error('File system API not available in browser');
  }

  /**
   * Read file as text
   */
  static async readFileAsText(path: string): Promise<string> {
    // In practice, would use actual file system API
    throw new Error('File system API not available in browser');
  }

  /**
   * Write file
   */
  static async writeFile(path: string, data: ArrayBuffer | string): Promise<void> {
    // In practice, would use actual file system API
    throw new Error('File system API not available in browser');
  }

  /**
   * Check if file exists
   */
  static async fileExists(path: string): Promise<boolean> {
    // In practice, would use actual file system API
    return false;
  }

  /**
   * Delete file
   */
  static async deleteFile(path: string): Promise<void> {
    // In practice, would use actual file system API
    throw new Error('File system API not available in browser');
  }

  /**
   * List files in directory
   */
  static async listFiles(path: string, pattern?: string): Promise<string[]> {
    // In practice, would use actual file system API
    return [];
  }

  /**
   * Create directory
   */
  static async createDirectory(path: string): Promise<void> {
    // In practice, would use actual file system API
    throw new Error('File system API not available in browser');
  }

  /**
   * Delete directory
   */
  static async deleteDirectory(path: string, recursive: boolean = false): Promise<void> {
    // In practice, would use actual file system API
    throw new Error('File system API not available in browser');
  }

  /**
   * Get file size
   */
  static async getFileSize(path: string): Promise<number> {
    // In practice, would use actual file system API
    return 0;
  }

  /**
   * Get file modification time
   */
  static async getFileModificationTime(path: string): Promise<Date> {
    // In practice, would use actual file system API
    return new Date();
  }

  /**
   * Copy file
   */
  static async copyFile(sourcePath: string, destPath: string): Promise<void> {
    // In practice, would use actual file system API
    throw new Error('File system API not available in browser');
  }

  /**
   * Move file
   */
  static async moveFile(sourcePath: string, destPath: string): Promise<void> {
    // In practice, would use actual file system API
    throw new Error('File system API not available in browser');
  }

  /**
   * Get file extension
   */
  static getFileExtension(path: string): string {
    const lastDot = path.lastIndexOf('.');
    return lastDot >= 0 ? path.slice(lastDot + 1).toLowerCase() : '';
  }

  /**
   * Get file name without extension
   */
  static getFileName(path: string): string {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    const lastDot = path.lastIndexOf('.');

    const start = lastSlash >= 0 ? lastSlash + 1 : 0;
    const end = lastDot > start ? lastDot : path.length;

    return path.slice(start, end);
  }

  /**
   * Get directory path
   */
  static getDirectoryPath(path: string): string {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return lastSlash >= 0 ? path.slice(0, lastSlash) : '';
  }

  /**
   * Join path segments
   */
  static joinPath(...segments: string[]): string {
    return segments.filter(s => s.length > 0).join('/');
  }

  /**
   * Normalize path
   */
  static normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  /**
   * Check if path is absolute
   */
  static isAbsolutePath(path: string): boolean {
    return path.startsWith('/') || /^[A-Za-z]:/.test(path);
  }

  /**
   * Make path absolute
   */
  static makeAbsolutePath(path: string, basePath: string = '/'): string {
    if (this.isAbsolutePath(path)) {
      return this.normalizePath(path);
    }

    return this.normalizePath(this.joinPath(basePath, path));
  }

  /**
   * Get relative path
   */
  static getRelativePath(fromPath: string, toPath: string): string {
    const from = this.normalizePath(fromPath).split('/');
    const to = this.normalizePath(toPath).split('/');

    // Find common prefix
    let i = 0;
    while (i < from.length && i < to.length && from[i] === to[i]) {
      i++;
    }

    // Build relative path
    const upCount = from.length - i - (from[from.length - 1] === '' ? 1 : 0);
    const downPath = to.slice(i);

    const upPath = Array(upCount).fill('..').join('/');
    return this.joinPath(upPath, ...downPath);
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
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
   * Get MIME type from file extension
   */
  static getMimeType(path: string): string {
    const extension = this.getFileExtension(path);

    const mimeTypes: Record<string, string> = {
      // Images
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',

      // Audio
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'm4a': 'audio/mp4',
      'wma': 'audio/x-ms-wma',

      // Video
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',

      // Text
      'txt': 'text/plain',
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'csv': 'text/csv',
      'md': 'text/markdown',

      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Archives
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',
      '7z': 'application/x-7z-compressed',

      // Models
      'pt': 'application/octet-stream',
      'pth': 'application/octet-stream',
      'ckpt': 'application/octet-stream',
      'bin': 'application/octet-stream',
      'safetensors': 'application/octet-stream'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Check if file is of type
   */
  static isFileType(path: string, type: 'image' | 'audio' | 'video' | 'text'): boolean {
    const mimeType = this.getMimeType(path);
    return mimeType.startsWith(type);
  }

  /**
   * Validate file path
   */
  static validateFilePath(path: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!path || path.trim().length === 0) {
      errors.push('File path is empty');
    }

    // Check for invalid characters (Windows)
    const invalidChars = /[<>:"|?*]/g;
    if (invalidChars.test(path)) {
      errors.push('File path contains invalid characters');
    }

    // Check for path traversal
    if (path.includes('..')) {
      errors.push('File path contains path traversal attempt');
    }

    // Check for control characters
    if (/[\x00-\x1f\x80-\x9f]/.test(path)) {
      errors.push('File path contains control characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize file name
   */
  static sanitizeFileName(fileName: string): string {
    // Remove invalid characters
    let sanitized = fileName.replace(/[<>:"|?*]/g, '_');

    // Replace multiple spaces with single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Remove leading/trailing spaces and dots
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');

    // Ensure file name is not empty
    if (sanitized.length === 0) {
      sanitized = 'unnamed';
    }

    // Limit length (255 characters for most file systems)
    if (sanitized.length > 250) {
      sanitized = sanitized.slice(0, 250);
    }

    return sanitized;
  }

  /**
   * Create temporary file path
   */
  static createTempPath(prefix: string = 'tmp', extension: string = 'tmp'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `/tmp/${prefix}_${timestamp}_${random}.${extension}`;
  }

  /**
   * Parse URI
   */
  static parseURI(uri: string): {
    protocol?: string;
    host?: string;
    port?: number;
    path?: string;
    query?: string;
    fragment?: string;
  } {
    const pattern = /^(?:([a-zA-Z]+):\/\/)?([^:/?#]+)?(?::(\d+))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;
    const match = uri.match(pattern);

    return {
      protocol: match?.[1],
      host: match?.[2],
      port: match?.[3] ? parseInt(match[3]) : undefined,
      path: match?.[4],
      query: match?.[5],
      fragment: match?.[6]
    };
  }

  /**
   * Build URI
   */
  static buildURI(parts: {
    protocol?: string;
    host?: string;
    port?: number;
    path?: string;
    query?: string;
    fragment?: string;
  }): string {
    let uri = '';

    if (parts.protocol) {
      uri += `${parts.protocol}://`;
    }

    if (parts.host) {
      uri += parts.host;

      if (parts.port) {
        uri += `:${parts.port}`;
      }
    }

    if (parts.path) {
      uri += parts.path;
    }

    if (parts.query) {
      uri += `?${parts.query}`;
    }

    if (parts.fragment) {
      uri += `#${parts.fragment}`;
    }

    return uri;
  }
}
