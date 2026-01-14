/**
 * Refactoring Engine
 *
 * Core engine for performing safe code refactoring operations.
 * Supports extract, inline, rename, move, and signature changes.
 */

import { parse, generate } from '../parsers/parser';
import { ASTTransformer } from '../ast/transformer';
import { RefactoringOperation, RefactoringOptions, RefactoringResult } from './types';
import { ScopeAnalyzer } from '../utils/scope-analyzer';
import { ReferenceFinder } from '../utils/reference-finder';
import { CodeFormatter } from '../utils/formatter';
import { GitIntegration } from '../utils/git-integration';
import { Logger } from '../utils/logger';
import { ChangeTracker } from '../utils/change-tracker';

export class RefactoringEngine {
  private transformer: ASTTransformer;
  private scopeAnalyzer: ScopeAnalyzer;
  private referenceFinder: ReferenceFinder;
  private formatter: CodeFormatter;
  private git: GitIntegration;
  private logger: Logger;
  private changeTracker: ChangeTracker;

  constructor(options: RefactoringOptions = {}) {
    this.transformer = new ASTTransformer(options);
    this.scopeAnalyzer = new ScopeAnalyzer();
    this.referenceFinder = new ReferenceFinder();
    this.formatter = new CodeFormatter(options.prettierOptions);
    this.git = new GitIntegration(options.gitOptions);
    this.logger = new Logger(options.logLevel || 'info');
    this.changeTracker = new ChangeTracker();
  }

  /**
   * Extract a method/function from selected code
   */
  async extractMethod(
    filePath: string,
    startLine: number,
    endLine: number,
    name: string,
    options: {
      parameters?: string[];
      returnType?: string;
      visibility?: 'public' | 'private' | 'protected';
    } = {}
  ): Promise<RefactoringResult> {
    this.logger.info(`Extracting method ${name} from ${filePath}:${startLine}-${endLine}`);

    const startTime = Date.now();
    const originalContent = await this.git.getFileContent(filePath);

    try {
      // Parse the file
      const ast = await parse(filePath, originalContent);

      // Find the containing function/method
      const containingFunction = this.scopeAnalyzer.findContainingFunction(
        ast,
        startLine,
        endLine
      );

      if (!containingFunction) {
        throw new Error('Could not find containing function for extraction');
      }

      // Analyze variables to extract as parameters
      const variables = this.scopeAnalyzer.extractVariables(
        ast,
        startLine,
        endLine,
        containingFunction
      );

      const parameters = options.parameters || variables.required;
      const capturedVariables = variables.captured;

      // Perform the extraction
      const newAst = this.transformer.extractMethod(ast, {
        startLine,
        endLine,
        name,
        parameters,
        capturedVariables,
        returnType: options.returnType,
        visibility: options.visibility
      });

      // Generate the new code
      const newContent = await this.formatCode(newAst, originalContent, filePath);

      // Calculate changes
      const changes = this.changeTracker.calculateChanges(originalContent, newContent);

      // Create undo information
      const undo = {
        filePath,
        originalContent,
        revertChanges: changes.map(c => ({ ...c, reversed: true }))
      };

      this.logger.info(`Method extracted successfully in ${Date.now() - startTime}ms`);

      return {
        success: true,
        changes,
        newContent,
        filePath,
        operation: 'extractMethod',
        metadata: {
          methodName: name,
          parameters: parameters.length,
          linesAffected: changes.reduce((sum, c) => sum + (c.endLine - c.startLine + 1), 0)
        },
        undo
      };
    } catch (error) {
      this.logger.error(`Failed to extract method: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        filePath,
        operation: 'extractMethod'
      };
    }
  }

  /**
   * Inline a variable or function
   */
  async inlineVariable(
    filePath: string,
    variableName: string,
    options: {
      preserveComments?: boolean;
      inlineAll?: boolean;
    } = {}
  ): Promise<RefactoringResult> {
    this.logger.info(`Inlining variable ${variableName} in ${filePath}`);

    const startTime = Date.now();
    const originalContent = await this.git.getFileContent(filePath);

    try {
      // Parse the file
      const ast = await parse(filePath, originalContent);

      // Find all references to the variable
      const references = await this.referenceFinder.findReferences(
        ast,
        variableName,
        filePath
      );

      if (references.length === 0) {
        throw new Error(`No references found for variable ${variableName}`);
      }

      // Find the variable declaration
      const declaration = this.scopeAnalyzer.findVariableDeclaration(ast, variableName);

      if (!declaration) {
        throw new Error(`Could not find declaration for variable ${variableName}`);
      }

      // Get the initializer value
      const initializer = this.scopeAnalyzer.getInitializerValue(declaration);

      if (!initializer) {
        throw new Error(`Variable ${variableName} has no initializer to inline`);
      }

      // Perform the inlining
      const newAst = this.transformer.inlineVariable(ast, {
        variableName,
        references,
        declaration,
        initializer,
        inlineAll: options.inlineAll ?? true,
        preserveComments: options.preserveComments ?? true
      });

      // Generate the new code
      const newContent = await this.formatCode(newAst, originalContent, filePath);

      // Calculate changes
      const changes = this.changeTracker.calculateChanges(originalContent, newContent);

      // Create undo information
      const undo = {
        filePath,
        originalContent,
        revertChanges: changes.map(c => ({ ...c, reversed: true }))
      };

      this.logger.info(
        `Variable inlined successfully (${references.length} references) in ${Date.now() - startTime}ms`
      );

      return {
        success: true,
        changes,
        newContent,
        filePath,
        operation: 'inlineVariable',
        metadata: {
          variableName,
          referencesInlined: references.length,
          linesAffected: changes.reduce((sum, c) => sum + (c.endLine - c.startLine + 1), 0)
        },
        undo
      };
    } catch (error) {
      this.logger.error(`Failed to inline variable: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        filePath,
        operation: 'inlineVariable'
      };
    }
  }

  /**
   * Inline a function
   */
  async inlineFunction(
    filePath: string,
    functionName: string,
    options: {
      inlineAll?: boolean;
      preserveComments?: boolean;
    } = {}
  ): Promise<RefactoringResult> {
    this.logger.info(`Inlining function ${functionName} in ${filePath}`);

    const startTime = Date.now();
    const originalContent = await this.git.getFileContent(filePath);

    try {
      // Parse the file
      const ast = await parse(filePath, originalContent);

      // Find all references to the function
      const references = await this.referenceFinder.findReferences(
        ast,
        functionName,
        filePath
      );

      if (references.length === 0) {
        throw new Error(`No references found for function ${functionName}`);
      }

      // Find the function declaration
      const declaration = this.scopeAnalyzer.findFunctionDeclaration(ast, functionName);

      if (!declaration) {
        throw new Error(`Could not find declaration for function ${functionName}`);
      }

      // Perform the inlining
      const newAst = this.transformer.inlineFunction(ast, {
        functionName,
        references,
        declaration,
        inlineAll: options.inlineAll ?? true,
        preserveComments: options.preserveComments ?? true
      });

      // Generate the new code
      const newContent = await this.formatCode(newAst, originalContent, filePath);

      // Calculate changes
      const changes = this.changeTracker.calculateChanges(originalContent, newContent);

      // Create undo information
      const undo = {
        filePath,
        originalContent,
        revertChanges: changes.map(c => ({ ...c, reversed: true }))
      };

      this.logger.info(
        `Function inlined successfully (${references.length} calls) in ${Date.now() - startTime}ms`
      );

      return {
        success: true,
        changes,
        newContent,
        filePath,
        operation: 'inlineFunction',
        metadata: {
          functionName,
          callsInlined: references.length,
          linesAffected: changes.reduce((sum, c) => sum + (c.endLine - c.startLine + 1), 0)
        },
        undo
      };
    } catch (error) {
      this.logger.error(`Failed to inline function: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        filePath,
        operation: 'inlineFunction'
      };
    }
  }

  /**
   * Rename a symbol (variable, function, class, etc.)
   */
  async renameSymbol(
    filePath: string,
    oldName: string,
    newName: string,
    options: {
      scope?: 'file' | 'project';
      renameInComments?: boolean;
      renameInStrings?: boolean;
    } = {}
  ): Promise<RefactoringResult> {
    this.logger.info(`Renaming ${oldName} to ${newName} in ${filePath}`);

    const startTime = Date.now();
    const originalContent = await this.git.getFileContent(filePath);

    try {
      // Validate new name
      if (!this.isValidIdentifier(newName)) {
        throw new Error(`Invalid identifier: ${newName}`);
      }

      // Parse the file
      const ast = await parse(filePath, originalContent);

      // Find all references to the symbol
      const references = await this.referenceFinder.findReferences(
        ast,
        oldName,
        filePath,
        options.scope || 'file'
      );

      if (references.length === 0) {
        throw new Error(`No references found for symbol ${oldName}`);
      }

      // Perform the renaming
      const newAst = this.transformer.renameSymbol(ast, {
        oldName,
        newName,
        references,
        renameInComments: options.renameInComments ?? false,
        renameInStrings: options.renameInStrings ?? false
      });

      // Generate the new code
      const newContent = await this.formatCode(newAst, originalContent, filePath);

      // Calculate changes
      const changes = this.changeTracker.calculateChanges(originalContent, newContent);

      // Create undo information
      const undo = {
        filePath,
        originalContent,
        revertChanges: changes.map(c => ({ ...c, reversed: true }))
      };

      this.logger.info(
        `Symbol renamed successfully (${references.length} occurrences) in ${Date.now() - startTime}ms`
      );

      return {
        success: true,
        changes,
        newContent,
        filePath,
        operation: 'renameSymbol',
        metadata: {
          oldName,
          newName,
          occurrencesRenamed: references.length,
          linesAffected: changes.reduce((sum, c) => sum + (c.endLine - c.startLine + 1), 0)
        },
        undo
      };
    } catch (error) {
      this.logger.error(`Failed to rename symbol: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        filePath,
        operation: 'renameSymbol'
      };
    }
  }

  /**
   * Move a file to a new location
   */
  async moveFile(
    oldPath: string,
    newPath: string,
    options: {
      updateImports?: boolean;
      createDirectory?: boolean;
    } = {}
  ): Promise<RefactoringResult> {
    this.logger.info(`Moving file from ${oldPath} to ${newPath}`);

    const startTime = Date.now();

    try {
      // Read the original file
      const originalContent = await this.git.getFileContent(oldPath);

      // Update imports if requested
      let newContent = originalContent;
      if (options.updateImports) {
        const ast = await parse(oldPath, originalContent);
        const newAst = this.transformer.updateImportsAfterMove(ast, {
          oldPath,
          newPath
        });
        newContent = await this.formatCode(newAst, originalContent, newPath);
      }

      // Move the file using git
      await this.git.moveFile(oldPath, newPath, options);

      // Find and update all files that import the moved file
      const changes: RefactoringResult[] = [];
      if (options.updateImports) {
        const importers = await this.referenceFinder.findImporters(oldPath);
        for (const importer of importers) {
          const result = await this.updateImportsAfterMove(
            importer,
            oldPath,
            newPath
          );
          if (result.success) {
            changes.push(result);
          }
        }
      }

      this.logger.info(`File moved successfully in ${Date.now() - startTime}ms`);

      return {
        success: true,
        changes: [
          {
            filePath: oldPath,
            startLine: 0,
            endLine: 0,
            type: 'move',
            description: `Moved ${oldPath} to ${newPath}`
          }
        ],
        newContent,
        filePath: newPath,
        operation: 'moveFile',
        metadata: {
          oldPath,
          newPath,
          importersUpdated: changes.length
        },
        undo: {
          filePath: newPath,
          originalContent,
          revertChanges: [
            {
              filePath: newPath,
              startLine: 0,
              endLine: 0,
              type: 'move',
              description: `Move back from ${newPath} to ${oldPath}`
            }
          ]
        }
      };
    } catch (error) {
      this.logger.error(`Failed to move file: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        filePath: oldPath,
        operation: 'moveFile'
      };
    }
  }

  /**
   * Change function/method signature
   */
  async changeSignature(
    filePath: string,
    functionName: string,
    changes: {
      parameters?: {
        add?: Array<{ name: string; type?: string; defaultValue?: string }>;
        remove?: string[];
        rename?: Array<{ old: string; new: string }>;
        reorder?: string[];
      };
      returnType?: string;
      async?: boolean;
    },
    options: {
      updateCallSites?: boolean;
      preserveDefaults?: boolean;
    } = {}
  ): Promise<RefactoringResult> {
    this.logger.info(`Changing signature of ${functionName} in ${filePath}`);

    const startTime = Date.now();
    const originalContent = await this.git.getFileContent(filePath);

    try {
      // Parse the file
      const ast = await parse(filePath, originalContent);

      // Find the function declaration
      const declaration = this.scopeAnalyzer.findFunctionDeclaration(ast, functionName);

      if (!declaration) {
        throw new Error(`Could not find declaration for function ${functionName}`);
      }

      // Find all call sites if updating them
      let callSites: any[] = [];
      if (options.updateCallSites) {
        callSites = await this.referenceFinder.findCallSites(ast, functionName);
      }

      // Perform the signature change
      const newAst = this.transformer.changeSignature(ast, {
        functionName,
        declaration,
        changes,
        callSites,
        updateCallSites: options.updateCallSites ?? true,
        preserveDefaults: options.preserveDefaults ?? true
      });

      // Generate the new code
      const newContent = await this.formatCode(newAst, originalContent, filePath);

      // Calculate changes
      const resultChanges = this.changeTracker.calculateChanges(originalContent, newContent);

      // Create undo information
      const undo = {
        filePath,
        originalContent,
        revertChanges: resultChanges.map(c => ({ ...c, reversed: true }))
      };

      this.logger.info(
        `Signature changed successfully (${callSites.length} call sites updated) in ${Date.now() - startTime}ms`
      );

      return {
        success: true,
        changes: resultChanges,
        newContent,
        filePath,
        operation: 'changeSignature',
        metadata: {
          functionName,
          parametersAdded: changes.parameters?.add?.length || 0,
          parametersRemoved: changes.parameters?.remove?.length || 0,
          callSitesUpdated: callSites.length
        },
        undo
      };
    } catch (error) {
      this.logger.error(`Failed to change signature: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        filePath,
        operation: 'changeSignature'
      };
    }
  }

  /**
   * Extract an interface from a class
   */
  async extractInterface(
    filePath: string,
    className: string,
    interfaceName: string,
    options: {
      methods?: string[];
      properties?: string[];
      visibility?: 'public' | 'all';
      includeJSDoc?: boolean;
    } = {}
  ): Promise<RefactoringResult> {
    this.logger.info(`Extracting interface ${interfaceName} from class ${className}`);

    const startTime = Date.now();
    const originalContent = await this.git.getFileContent(filePath);

    try {
      // Parse the file
      const ast = await parse(filePath, originalContent);

      // Find the class declaration
      const classDeclaration = this.scopeAnalyzer.findClassDeclaration(ast, className);

      if (!classDeclaration) {
        throw new Error(`Could not find class ${className}`);
      }

      // Analyze class members
      const members = this.scopeAnalyzer.analyzeClassMembers(
        classDeclaration,
        options.visibility || 'public'
      );

      // Filter members based on options
      const selectedMembers = {
        methods: options.methods
          ? members.methods.filter(m => options.methods!.includes(m.name))
          : members.methods,
        properties: options.properties
          ? members.properties.filter(p => options.properties!.includes(p.name))
          : members.properties
      };

      // Perform the extraction
      const newAst = this.transformer.extractInterface(ast, {
        className,
        interfaceName,
        members: selectedMembers,
        includeJSDoc: options.includeJSDoc ?? true
      });

      // Generate the new code
      const newContent = await this.formatCode(newAst, originalContent, filePath);

      // Calculate changes
      const resultChanges = this.changeTracker.calculateChanges(originalContent, newContent);

      // Create undo information
      const undo = {
        filePath,
        originalContent,
        revertChanges: resultChanges.map(c => ({ ...c, reversed: true }))
      };

      this.logger.info(
        `Interface extracted successfully (${selectedMembers.methods.length} methods, ${selectedMembers.properties.length} properties) in ${Date.now() - startTime}ms`
      );

      return {
        success: true,
        changes: resultChanges,
        newContent,
        filePath,
        operation: 'extractInterface',
        metadata: {
          className,
          interfaceName,
          methodsExtracted: selectedMembers.methods.length,
          propertiesExtracted: selectedMembers.properties.length
        },
        undo
      };
    } catch (error) {
      this.logger.error(`Failed to extract interface: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        filePath,
        operation: 'extractInterface'
      };
    }
  }

  /**
   * Introduce a parameter to a function
   */
  async introduceParameter(
    filePath: string,
    functionName: string,
    parameter: {
      name: string;
      type?: string;
      defaultValue?: string;
      position?: number;
    },
    options: {
      updateCallSites?: boolean;
      inferFromContext?: boolean;
    } = {}
  ): Promise<RefactoringResult> {
    this.logger.info(`Introducing parameter ${parameter.name} to ${functionName}`);

    const startTime = Date.now();
    const originalContent = await this.git.getFileContent(filePath);

    try {
      // Parse the file
      const ast = await parse(filePath, originalContent);

      // Find the function declaration
      const declaration = this.scopeAnalyzer.findFunctionDeclaration(ast, functionName);

      if (!declaration) {
        throw new Error(`Could not find function ${functionName}`);
      }

      // Find all call sites
      const callSites = await this.referenceFinder.findCallSites(ast, functionName);

      // Infer value from context if requested
      let inferredValue: string | undefined;
      if (options.inferFromContext && callSites.length > 0) {
        inferredValue = this.scopeAnalyzer.inferParameterValue(callSites[0], parameter.name);
      }

      // Perform the parameter introduction
      const newAst = this.transformer.introduceParameter(ast, {
        functionName,
        declaration,
        parameter: {
          ...parameter,
          defaultValue: parameter.defaultValue || inferredValue
        },
        callSites,
        updateCallSites: options.updateCallSites ?? true
      });

      // Generate the new code
      const newContent = await this.formatCode(newAst, originalContent, filePath);

      // Calculate changes
      const resultChanges = this.changeTracker.calculateChanges(originalContent, newContent);

      // Create undo information
      const undo = {
        filePath,
        originalContent,
        revertChanges: resultChanges.map(c => ({ ...c, reversed: true }))
      };

      this.logger.info(
        `Parameter introduced successfully (${callSites.length} call sites updated) in ${Date.now() - startTime}ms`
      );

      return {
        success: true,
        changes: resultChanges,
        newContent,
        filePath,
        operation: 'introduceParameter',
        metadata: {
          functionName,
          parameterName: parameter.name,
          callSitesUpdated: callSites.length
        },
        undo
      };
    } catch (error) {
      this.logger.error(`Failed to introduce parameter: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        filePath,
        operation: 'introduceParameter'
      };
    }
  }

  /**
   * Apply a refactoring operation
   */
  async applyRefactoring(
    operation: RefactoringOperation
  ): Promise<RefactoringResult> {
    switch (operation.type) {
      case 'extractMethod':
        return this.extractMethod(
          operation.filePath,
          operation.startLine,
          operation.endLine,
          operation.name,
          operation.options
        );
      case 'inlineVariable':
        return this.inlineVariable(
          operation.filePath,
          operation.name,
          operation.options
        );
      case 'inlineFunction':
        return this.inlineFunction(
          operation.filePath,
          operation.name,
          operation.options
        );
      case 'renameSymbol':
        return this.renameSymbol(
          operation.filePath,
          operation.oldName,
          operation.newName,
          operation.options
        );
      case 'moveFile':
        return this.moveFile(
          operation.filePath,
          operation.newPath,
          operation.options
        );
      case 'changeSignature':
        return this.changeSignature(
          operation.filePath,
          operation.functionName,
          operation.changes,
          operation.options
        );
      case 'extractInterface':
        return this.extractInterface(
          operation.filePath,
          operation.className,
          operation.interfaceName,
          operation.options
        );
      case 'introduceParameter':
        return this.introduceParameter(
          operation.filePath,
          operation.functionName,
          operation.parameter,
          operation.options
        );
      default:
        return {
          success: false,
          error: `Unknown operation type: ${(operation as any).type}`,
          filePath: operation.filePath,
          operation: operation.type
        };
    }
  }

  /**
   * Undo a refactoring
   */
  async undoRefactoring(result: RefactoringResult): Promise<boolean> {
    if (!result.undo) {
      this.logger.error('No undo information available');
      return false;
    }

    try {
      const { filePath, originalContent } = result.undo;

      // Restore the original content
      await this.git.restoreFile(filePath, originalContent);

      this.logger.info(`Refactoring undone successfully for ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to undo refactoring: ${error}`);
      return false;
    }
  }

  /**
   * Batch refactor multiple files
   */
  async batchRefactor(
    operations: RefactoringOperation[]
  ): Promise<RefactoringResult[]> {
    this.logger.info(`Batch refactoring ${operations.length} operations`);

    const results: RefactoringResult[] = [];
    const successful: RefactoringResult[] = [];
    const failed: RefactoringResult[] = [];

    for (const operation of operations) {
      const result = await this.applyRefactoring(operation);
      results.push(result);

      if (result.success) {
        successful.push(result);
      } else {
        failed.push(result);
      }
    }

    this.logger.info(
      `Batch refactoring complete: ${successful.length} succeeded, ${failed.length} failed`
    );

    return results;
  }

  /**
   * Helper method to format code
   */
  private async formatCode(
    ast: any,
    originalContent: string,
    filePath: string
  ): Promise<string> {
    const generated = generate(ast, {
      retainLines: false,
      retainFunctionParens: true,
      comments: true
    });

    const formatted = await this.formatter.format(
      generated.code,
      filePath,
      originalContent
    );

    return formatted;
  }

  /**
   * Helper method to update imports after moving a file
   */
  private async updateImportsAfterMove(
    filePath: string,
    oldPath: string,
    newPath: string
  ): Promise<RefactoringResult> {
    const originalContent = await this.git.getFileContent(filePath);
    const ast = await parse(filePath, originalContent);

    const newAst = this.transformer.updateImportsForMovedFile(ast, {
      oldPath,
      newPath
    });

    const newContent = await this.formatCode(newAst, originalContent, filePath);
    const changes = this.changeTracker.calculateChanges(originalContent, newContent);

    return {
      success: true,
      changes,
      newContent,
      filePath,
      operation: 'updateImports',
      metadata: {
        oldPath,
        newPath
      }
    };
  }

  /**
   * Validate if a string is a valid identifier
   */
  private isValidIdentifier(name: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
  }
}
