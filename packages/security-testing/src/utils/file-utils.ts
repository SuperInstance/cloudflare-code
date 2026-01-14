/**
 * File utility functions for security scanning
 * Handles file discovery, reading, and filtering
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'fast-glob';
import { parse } from 'acorn';
import { promises as fsp } from 'fs';

export interface FileFilter {
  extensions?: string[];
  patterns?: string[];
  excludePatterns?: string[];
  maxSize?: number;
  includeHidden?: boolean;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  extension: string;
  language: string;
  encoding: BufferEncoding;
}

export class FileUtils {
  /**
   * Find all files matching the given patterns
   */
  static async findFiles(
    rootPath: string,
    filter: FileFilter = {}
  ): Promise<string[]> {
    const patterns = filter.patterns || ['**/*'];
    const excludePatterns = filter.excludePatterns || [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.min.css',
      '**/vendor/**',
      '**/.cache/**',
    ];

    const files = await glob(patterns, {
      cwd: rootPath,
      absolute: true,
      ignore: excludePatterns,
      onlyFiles: true,
      dot: filter.includeHidden || false,
    });

    // Filter by extension if specified
    if (filter.extensions && filter.extensions.length > 0) {
      const extSet = new Set(filter.extensions.map((e) => e.toLowerCase()));
      return files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return extSet.has(ext) || extSet.has(ext.substring(1));
      });
    }

    // Filter by size if specified
    if (filter.maxSize) {
      const filtered: string[] = [];
      for (const file of files) {
        try {
          const stats = await fsp.stat(file);
          if (stats.size <= filter.maxSize) {
            filtered.push(file);
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
      return filtered;
    }

    return files;
  }

  /**
   * Get detailed information about a file
   */
  static async getFileInfo(filePath: string, rootPath: string): Promise<FileInfo> {
    const stats = await fsp.stat(filePath);
    const relativePath = path.relative(rootPath, filePath);
    const extension = path.extname(filePath).toLowerCase();
    const language = this.detectLanguage(extension);

    return {
      path: filePath,
      relativePath,
      size: stats.size,
      extension,
      language,
      encoding: 'utf-8',
    };
  }

  /**
   * Detect programming language from file extension
   */
  static detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.java': 'java',
      '.kt': 'kotlin',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.scala': 'scala',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.sql': 'sql',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.md': 'markdown',
    };

    return languageMap[extension] || 'unknown';
  }

  /**
   * Read file content safely
   */
  static async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    try {
      return await fsp.readFile(filePath, encoding);
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  /**
   * Check if file is binary
   */
  static async isBinary(filePath: string): Promise<boolean> {
    try {
      const buffer = await fsp.readFile(filePath);
      const chunk = buffer.slice(0, 24);

      // Check for null bytes (common in binary files)
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0) {
          return true;
        }
      }

      // Check for common binary file signatures
      const signatures = [
        [0x50, 0x4b], // ZIP, JAR, ODT, DOCX
        [0x1f, 0x8b], // GZIP
        [0x42, 0x5a, 0x68], // BZIP2
        [0x7f, 0x45, 0x4c, 0x46], // ELF
        [0x4d, 0x5a], // EXE
        [0x25, 0x50, 0x44, 0x46], // PDF
        [0x49, 0x49, 0x2a, 0x00], // TIFF little-endian
        [0x4d, 0x4d, 0x00, 0x2a], // TIFF big-endian
        [0x00, 0x00, 0x01, 0x00], // ICO
        [0x00, 0x00, 0x02, 0x00], // CUR
        [0xff, 0xd8, 0xff], // JPEG
        [0x89, 0x50, 0x4e, 0x47], // PNG
        [0x47, 0x49, 0x46], // GIF
        [0x52, 0x49, 0x46, 0x46], // WEBP, WAV
        [0x49, 0x49, 0x2a], // CR2
      ];

      for (const sig of signatures) {
        if (chunk.length >= sig.length) {
          let match = true;
          for (let i = 0; i < sig.length; i++) {
            if (chunk[i] !== sig[i]) {
              match = false;
              break;
            }
          }
          if (match) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract code snippet around a specific line
   */
  static extractSnippet(
    content: string,
    lineNumber: number,
    contextLines: number = 3
  ): { snippet: string; startLine: number } {
    const lines = content.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);

    const snippet = lines.slice(start, end).join('\n');
    return { snippet, startLine: start + 1 };
  }

  /**
   * Count lines of code
   */
  static countLines(content: string): { total: number; code: number; blank: number; comment: number } {
    const lines = content.split('\n');
    let code = 0;
    let blank = 0;
    let comment = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        blank++;
      } else if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
        comment++;
      } else {
        code++;
      }
    }

    return { total: lines.length, code, blank, comment };
  }

  /**
   * Parse AST for JavaScript/TypeScript
   */
  static parseAST(content: string, filePath: string): any {
    try {
      return parse(content, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ranges: true,
      });
    } catch (error) {
      throw new Error(`Failed to parse AST for ${filePath}: ${error}`);
    }
  }

  /**
   * Calculate file hash
   */
  static async calculateHash(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const content = await fsp.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Normalize file path
   */
  static normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }

  /**
   * Join path segments
   */
  static joinPath(...segments: string[]): string {
    return this.normalizePath(path.join(...segments));
  }

  /**
   * Check if path is within directory
   */
  static isWithinDirectory(filePath: string, directory: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    const normalizedDir = this.normalizePath(directory);
    return normalizedPath.startsWith(normalizedDir);
  }

  /**
   * Get project root directory
   */
  static async findProjectRoot(startPath: string): Promise<string | null> {
    let currentPath = startPath;

    while (currentPath !== path.parse(currentPath).root) {
      const packageJsonPath = path.join(currentPath, 'package.json');
      const gitPath = path.join(currentPath, '.git');

      if (
        (await this.fileExists(packageJsonPath)) ||
        (await this.fileExists(gitPath))
      ) {
        return currentPath;
      }

      currentPath = path.dirname(currentPath);
    }

    return null;
  }

  /**
   * Check if file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create directory recursively
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fsp.mkdir(dirPath, { recursive: true });
  }

  /**
   * Get all files in directory recursively
   */
  static async getAllFiles(dirPath: string): Promise<string[]> {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Filter files by size
   */
  static async filterBySize(files: string[], maxSize: number): Promise<string[]> {
    const filtered: string[] = [];

    for (const file of files) {
      try {
        const stats = await fsp.stat(file);
        if (stats.size <= maxSize) {
          filtered.push(file);
        }
      } catch {
        // Skip files that can't be read
        continue;
      }
    }

    return filtered;
  }
}
