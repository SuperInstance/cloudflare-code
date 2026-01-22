/**
 * Refactoring Types
 *
 * Type definitions for refactoring operations and results.
 */

export interface RefactoringOptions {
  prettierOptions?: any;
  gitOptions?: {
    autoCommit?: boolean;
    commitMessage?: string;
    createBranch?: boolean;
    branchName?: string;
  };
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface RefactoringResult {
  success: boolean;
  changes: CodeChange[];
  newContent?: string;
  filePath: string;
  operation: string;
  error?: string;
  metadata?: Record<string, any>;
  undo?: UndoInfo;
}

export interface CodeChange {
  filePath: string;
  startLine: number;
  endLine: number;
  type: 'insert' | 'delete' | 'replace' | 'move' | 'rename';
  description: string;
  oldContent?: string;
  newContent?: string;
}

export interface UndoInfo {
  filePath: string;
  originalContent: string;
  revertChanges: CodeChange[];
}

export type RefactoringOperation =
  | ExtractMethodOperation
  | InlineVariableOperation
  | InlineFunctionOperation
  | RenameSymbolOperation
  | MoveFileOperation
  | ChangeSignatureOperation
  | ExtractInterfaceOperation
  | IntroduceParameterOperation;

export interface BaseOperation {
  type: string;
  filePath: string;
  options?: any;
}

export interface ExtractMethodOperation extends BaseOperation {
  type: 'extractMethod';
  startLine: number;
  endLine: number;
  name: string;
  options?: {
    parameters?: string[];
    returnType?: string;
    visibility?: 'public' | 'private' | 'protected';
  };
}

export interface InlineVariableOperation extends BaseOperation {
  type: 'inlineVariable';
  name: string;
  options?: {
    preserveComments?: boolean;
    inlineAll?: boolean;
  };
}

export interface InlineFunctionOperation extends BaseOperation {
  type: 'inlineFunction';
  name: string;
  options?: {
    preserveComments?: boolean;
    inlineAll?: boolean;
  };
}

export interface RenameSymbolOperation extends BaseOperation {
  type: 'renameSymbol';
  oldName: string;
  newName: string;
  options?: {
    scope?: 'file' | 'project';
    renameInComments?: boolean;
    renameInStrings?: boolean;
  };
}

export interface MoveFileOperation extends BaseOperation {
  type: 'moveFile';
  newPath: string;
  options?: {
    updateImports?: boolean;
    createDirectory?: boolean;
  };
}

export interface ChangeSignatureOperation extends BaseOperation {
  type: 'changeSignature';
  functionName: string;
  changes: {
    parameters?: {
      add?: Array<{ name: string; type?: string; defaultValue?: string }>;
      remove?: string[];
      rename?: Array<{ old: string; new: string }>;
      reorder?: string[];
    };
    returnType?: string;
    async?: boolean;
  };
  options?: {
    updateCallSites?: boolean;
    preserveDefaults?: boolean;
  };
}

export interface ExtractInterfaceOperation extends BaseOperation {
  type: 'extractInterface';
  className: string;
  interfaceName: string;
  options?: {
    methods?: string[];
    properties?: string[];
    visibility?: 'public' | 'all';
    includeJSDoc?: boolean;
  };
}

export interface IntroduceParameterOperation extends BaseOperation {
  type: 'introduceParameter';
  functionName: string;
  parameter: {
    name: string;
    type?: string;
    defaultValue?: string;
    position?: number;
  };
  options?: {
    updateCallSites?: boolean;
    inferFromContext?: boolean;
  };
}
