/**
 * File Manager Utility
 * Handles file system operations for code generation
 */

import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';

/**
 * File write options
 */
export interface FileWriteOptions {
  mode?: number;
  executable?: boolean;
  overwrite?: boolean;
}

/**
 * File Manager class
 */
export class FileManager {
  /**
   * Ensure directory exists
   */
  async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Write file to disk
   */
  async writeFile(
    filePath: string,
    content: string,
    options: FileWriteOptions = {}
  ): Promise<void> {
    const { mode, executable, overwrite = true } = options;

    // Check if file exists
    const exists = await this.fileExists(filePath);
    if (exists && !overwrite) {
      throw new Error(`File ${filePath} already exists`);
    }

    // Ensure directory exists
    await this.ensureDir(dirname(filePath));

    // Write file
    await fs.writeFile(filePath, content, {
      mode: executable ? 0o755 : mode,
      encoding: 'utf-8'
    });
  }

  /**
   * Read file from disk
   */
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  /**
   * Delete directory recursively
   */
  async deleteDir(dirPath: string): Promise<void> {
    await fs.rm(dirPath, { recursive: true, force: true });
  }

  /**
   * List files in directory
   */
  async listFiles(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile())
      .map(entry => join(dirPath, entry.name));
  }

  /**
   * List directories in directory
   */
  async listDirs(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => join(dirPath, entry.name));
  }

  /**
   * Copy file
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    await this.ensureDir(dirname(destPath));
    await fs.copyFile(sourcePath, destPath);
  }

  /**
   * Move file
   */
  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    await this.ensureDir(dirname(destPath));
    await fs.rename(sourcePath, destPath);
  }

  /**
   * Get directory name
   */
  dirname(filePath: string): string {
    return dirname(filePath);
  }

  /**
   * Get basename
   */
  getBasename(filePath: string): string {
    return basename(filePath);
  }

  /**
   * Join paths
   */
  join(...paths: string[]): string {
    return join(...paths);
  }
}
