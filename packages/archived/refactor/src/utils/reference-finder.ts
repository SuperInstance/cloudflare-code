// @ts-nocheck
/**
 * Reference Finder
 *
 * Finds all references to symbols across code.
 */

import { Logger } from './logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Reference {
  filePath: string;
  line: number;
  column: number;
  type: 'read' | 'write' | 'call';
  context: string;
}

export class ReferenceFinder {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('info');
  }

  /**
   * Find all references to a symbol
   */
  async findReferences(
    ast: any,
    symbolName: string,
    filePath: string,
    scope: 'file' | 'project' = 'file'
  ): Promise<Reference[]> {
    const references: Reference[] = [];

    if (scope === 'file') {
      this.findReferencesInAST(ast, symbolName, filePath, references);
    } else {
      // Search across project
      const projectPath = path.dirname(filePath);
      const allFiles = await this.findProjectFiles(projectPath);

      for (const file of allFiles) {
        try {
          const code = await fs.readFile(file, 'utf-8');
          const { parse } = require('../parsers/parser');
          const fileAst = await parse(file, code);
          this.findReferencesInAST(fileAst, symbolName, file, references);
        } catch (error) {
          this.logger.debug(`Could not parse ${file}: ${error}`);
        }
      }
    }

    return references;
  }

  /**
   * Find call sites for a function
   */
  async findCallSites(ast: any, functionName: string): Promise<any[]> {
    const callSites: any[] = [];
    const t = require('@babel/types');

    const traverse = require('@babel/traverse').default;
    traverse(ast, {
      CallExpression(path) {
        if (
          t.isIdentifier(path.node.callee) &&
          path.node.callee.name === functionName
        ) {
          callSites.push({
            node: path.node,
            arguments: path.node.arguments.map(arg => this.extractArgumentValue(arg)),
            loc: path.node.loc
          });
        }
      }
    });

    return callSites;
  }

  /**
   * Find files that import a given file
   */
  async findImporters(targetFilePath: string): Promise<string[]> {
    const importers: string[] = [];
    const projectPath = path.dirname(targetFilePath);

    const allFiles = await this.findProjectFiles(projectPath);

    for (const file of allFiles) {
      if (file === targetFilePath) continue;

      try {
        const code = await fs.readFile(file, 'utf-8');
        const { parse } = require('../parsers/parser');
        const ast = await parse(file, code);

        const hasImport = this.hasImportForFile(ast, targetFilePath, file);
        if (hasImport) {
          importers.push(file);
        }
      } catch (error) {
        this.logger.debug(`Could not check ${file}: ${error}`);
      }
    }

    return importers;
  }

  /**
   * Find references in a single AST
   */
  private findReferencesInAST(
    ast: any,
    symbolName: string,
    filePath: string,
    references: Reference[]
  ): void {
    const t = require('@babel/types');

    const traverse = require('@babel/traverse').default;
    traverse(ast, {
      Identifier(path) {
        if (path.node.name === symbolName) {
          if (path.isReferencedIdentifier()) {
            references.push({
              filePath,
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              type: this.determineReferenceType(path),
              context: this.getContext(path)
            });
          }
        }
      }
    });
  }

  /**
   * Determine if a reference is a read, write, or call
   */
  private determineReferenceType(path: any): 'read' | 'write' | 'call' {
    if (path.parentPath.isCallExpression() && path.key === 'callee') {
      return 'call';
    }

    if (path.parentPath.isAssignmentExpression() && path.key === 'left') {
      return 'write';
    }

    return 'read';
  }

  /**
   * Get context around a reference
   */
  private getContext(path: any): string {
    // Get a few lines of context around the reference
    const line = path.node.loc?.start.line || 0;
    return `line ${line}`;
  }

  /**
   * Extract argument value from call expression
   */
  private extractArgumentValue(arg: any): any {
    const t = require('@babel/types');

    if (t.isIdentifier(arg)) {
      return arg.name;
    } else if (t.isLiteral(arg)) {
      return arg.value;
    } else if (t.isExpression(arg)) {
      return '(expression)';
    }

    return null;
  }

  /**
   * Check if AST has import for target file
   */
  private hasImportForFile(ast: any, targetFilePath: string, currentFilePath: string): boolean {
    let hasImport = false;

    const traverse = require('@babel/traverse').default;
    traverse(ast, {
      ImportDeclaration(path) {
        const importSource = path.node.source.value;
        const targetDir = path.dirname(targetFilePath);
        const currentDir = path.dirname(currentFilePath);

        // Calculate relative path
        let relativePath = path.relative(currentDir, targetFilePath);
        if (!relativePath.startsWith('.')) {
          relativePath = './' + relativePath;
        }
        relativePath = relativePath.replace(/\.(ts|js|tsx|jsx)$/, '');

        if (importSource === relativePath || importSource === relativePath.replace(/^\.\//, '')) {
          hasImport = true;
        }
      }
    });

    return hasImport;
  }

  /**
   * Find all project files
   */
  private async findProjectFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.')) {
            await walk(fullPath);
          }
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }

    await walk(projectPath);
    return files;
  }
}
