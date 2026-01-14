# @claudeflare/refactor

Automated refactoring and code transformation engine for the ClaudeFlare distributed AI coding platform. Supports 10+ programming languages with AST-based transformations, ensuring 99%+ refactoring safety.

## Features

- **Refactoring Engine**: Extract method, inline variables/functions, rename symbols, move files, change signatures, extract interfaces, introduce parameters
- **AST Transformer**: Parse, manipulate, traverse, and generate ASTs with comment and formatting preservation
- **Code Modernizer**: Update syntax, APIs, patterns, and adopt new language features automatically
- **Migration Manager**: Framework, library, and language version migrations with rollback support
- **Dependency Updater**: Automated dependency updates with security and breaking change detection
- **Type Migrator**: JavaScript to TypeScript migration, any type elimination, and type inference
- **Auto-Fixer**: Automated lint fixes, error fixing, security fixes, and performance optimizations

## Installation

```bash
npm install @claudeflare/refactor
```

## Quick Start

```typescript
import { RefactoringEngine } from '@claudeflare/refactor';

const engine = new RefactoringEngine();

// Extract a method
const result = await engine.extractMethod(
  '/path/to/file.ts',
  startLine,
  endLine,
  'newMethodName'
);

if (result.success) {
  console.log('Method extracted successfully!');
  console.log(result.newContent);
}
```

## Usage

### Refactoring Operations

```typescript
import { createRefactoringEngine } from '@claudeflare/refactor';

const engine = createRefactoringEngine();

// Extract method
await engine.extractMethod(filePath, 10, 20, 'calculateTotal', {
  parameters: ['items', 'tax'],
  returnType: 'number'
});

// Inline variable
await engine.inlineVariable(filePath, 'tempVar');

// Rename symbol
await engine.renameSymbol(filePath, 'oldName', 'newName', {
  scope: 'project'
});

// Change function signature
await engine.changeSignature(filePath, 'processData', {
  parameters: {
    add: [{ name: 'options', type: 'ProcessOptions' }]
  }
});

// Extract interface
await engine.extractInterface(filePath, 'UserService', 'IUserService');

// Introduce parameter
await engine.introduceParameter(filePath, 'calculate', {
  name: 'multiplier',
  type: 'number',
  defaultValue: '1.0'
});

// Batch refactor
const operations = [
  {
    type: 'renameSymbol',
    filePath: '/path/to/file.ts',
    oldName: 'old',
    newName: 'new'
  },
  // ... more operations
];
await engine.batchRefactor(operations);
```

### Code Modernization

```typescript
import { createModernizer } from '@claudeflare/refactor';

const modernizer = createModernizer({
  targetVersion: 'ES2020',
  aggressive: false
});

const result = await modernizer.modernize(code, filePath);

result.changes.forEach(change => {
  console.log(`${change.type}: ${change.description}`);
});
```

### Type Migration

```typescript
import { createTypeMigrator } from '@claudeflare/refactor';

const migrator = createTypeMigrator({
  strictMode: true,
  generateInferredTypes: true
});

// Migrate JavaScript to TypeScript
const result = await migrator.migrateToTypeScript(projectPath);

// Eliminate 'any' types
await migrator.eliminateAnyTypes(filePath);

// Migrate to strict mode
await migrator.migrateToStrictMode(projectPath);

// Extract interfaces
const interfaces = await migrator.extractInterfaces(projectPath);
```

### Dependency Updates

```typescript
import { createDependencyUpdater } from '@claudeflare/refactor';

const updater = createDependencyUpdater({
  securityOnly: false,
  breakingChanges: 'warn'
});

// Check for updates
const updates = await updater.checkUpdates(projectPath);

// Update a package
const result = await updater.updatePackage('lodash', '4.17.21');

// Check for security issues
const vulnerabilities = await updater.checkSecurity(projectPath);
```

### Automated Fixes

```typescript
import { createAutoFixer } from '@claudeflare/refactor';

const fixer = createAutoFixer({
  fixType: 'all',
  dryRun: false
});

// Fix a single file
const result = await fixer.fixFile(filePath);

// Fix entire project
const projectResult = await fixer.fixProject(projectPath);

// Fix only security issues
const securityFixer = createAutoFixer({ fixType: 'security' });
```

### Migration Management

```typescript
import { createMigrationManager } from '@claudeflare/refactor';

const manager = createMigrationManager({
  createBackup: true,
  testAfterMigration: true,
  rollbackOnError: true
});

// Plan a migration
const plan = await manager.planMigration(projectPath, {
  type: 'framework',
  from: 'react-16',
  to: 'react-18'
});

console.log(`Risk level: ${plan.riskLevel}`);
console.log(`Estimated time: ${plan.estimatedTime} minutes`);

// Execute the migration
const result = await manager.executeMigration(projectPath, {
  type: 'framework',
  from: 'react-16',
  to: 'react-18'
});
```

## Supported Languages

- JavaScript
- TypeScript
- JSX
- TSX
- Python (planned)
- Java (planned)
- Go (planned)
- Rust (planned)
- C/C++ (planned)
- C# (planned)
- PHP (planned)
- Ruby (planned)

## Refactoring Operations

| Operation | Description | Safety |
|-----------|-------------|--------|
| Extract Method | Extract code into a new method | 99%+ |
| Inline Variable | Replace variable with its value | 99%+ |
| Inline Function | Replace function call with body | 95%+ |
| Rename Symbol | Rename variables, functions, classes | 99%+ |
| Move File | Move file and update imports | 99%+ |
| Change Signature | Add/remove/rename parameters | 95%+ |
| Extract Interface | Create interface from class | 99%+ |
| Introduce Parameter | Add parameter with default value | 95%+ |

## API Reference

### RefactoringEngine

Main engine for performing refactoring operations.

```typescript
class RefactoringEngine {
  constructor(options?: RefactoringOptions)

  extractMethod(filePath, startLine, endLine, name, options?): Promise<RefactoringResult>
  inlineVariable(filePath, variableName, options?): Promise<RefactoringResult>
  inlineFunction(filePath, functionName, options?): Promise<RefactoringResult>
  renameSymbol(filePath, oldName, newName, options?): Promise<RefactoringResult>
  moveFile(oldPath, newPath, options?): Promise<RefactoringResult>
  changeSignature(filePath, functionName, changes, options?): Promise<RefactoringResult>
  extractInterface(filePath, className, interfaceName, options?): Promise<RefactoringResult>
  introduceParameter(filePath, functionName, parameter, options?): Promise<RefactoringResult>
  batchRefactor(operations): Promise<RefactoringResult[]>
  undoRefactoring(result): Promise<boolean>
}
```

### CodeModernizer

Modernizes code to use latest syntax and best practices.

```typescript
class CodeModernizer {
  constructor(options?: ModernizationOptions)

  modernize(code, filePath, language?): Promise<ModernizationResult>
}
```

### TypeMigrator

Migrates JavaScript to TypeScript and improves types.

```typescript
class TypeMigrator {
  constructor(options?: TypeMigrationOptions)

  migrateToTypeScript(projectPath): Promise<TypeMigrationResult>
  eliminateAnyTypes(filePath): Promise<number>
  migrateToStrictMode(projectPath): Promise<void>
  extractInterfaces(projectPath, options?): Promise<InterfaceInfo[]>
  generateTypeDefinitions(filePath): Promise<string>
  introduceGenerics(filePath): Promise<number>
}
```

### DependencyUpdater

Manages dependency updates with safety checks.

```typescript
class DependencyUpdater {
  constructor(options?: DependencyUpdateOptions)

  checkUpdates(projectPath): Promise<DependencyInfo[]>
  updatePackage(packageName, version, projectPath?): Promise<UpdateResult>
  updateAll(projectPath, targetVersion?): Promise<UpdateResult>
  checkSecurity(projectPath): Promise<Map<string, SecurityIssue[]>>
  checkCompatibility(packageName, currentVersion, targetVersion): Promise<CompatibilityInfo>
}
```

### AutoFixer

Automatically fixes code issues.

```typescript
class AutoFixer {
  constructor(options?: FixOptions)

  fixFile(filePath): Promise<FixResult>
  fixProject(projectPath): Promise<FixResult>
}
```

## Safety Features

- **Undo Support**: All refactorings can be undone
- **Git Integration**: Automatic commits and branches
- **Backup Creation**: Automatic backups before major changes
- **Validation**: Syntax and type checking after transformations
- **Dry Run Mode**: Preview changes before applying
- **Rollback on Error**: Automatic rollback if tests fail

## Configuration

```typescript
// Refactoring options
interface RefactoringOptions {
  prettierOptions?: any;
  gitOptions?: {
    autoCommit?: boolean;
    commitMessage?: string;
    createBranch?: boolean;
  };
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// Modernization options
interface ModernizationOptions {
  targetVersion?: string;
  framework?: string;
  aggressive?: boolean;
  preserveComments?: boolean;
  dryRun?: boolean;
}

// Type migration options
interface TypeMigrationOptions {
  strictMode?: boolean;
  allowJs?: boolean;
  checkJs?: boolean;
  esModuleInterop?: boolean;
  generateInferredTypes?: boolean;
  preserveComments?: boolean;
}
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © ClaudeFlare

## Support

- Documentation: [docs.claudeflare.ai](https://docs.claudeflare.ai)
- Issues: [GitHub Issues](https://github.com/claudeflare/claudeflare/issues)
- Discord: [ClaudeFlare Discord](https://discord.gg/claudeflare)
