// @ts-nocheck
/**
 * Type Migrator
 *
 * Migrates JavaScript to TypeScript and improves TypeScript types.
 * Eliminates 'any' types and generates type definitions.
 */

import { ASTTransformer } from '../ast/transformer';
import { parse } from '../parsers/parser';
import { Formatter } from '../utils/formatter';
import { Logger } from '../utils/logger';
import { TypeInferenceEngine } from './inference';
import { InterfaceGenerator } from './interface-generator';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TypeMigrationOptions {
  strictMode?: boolean;
  allowJs?: boolean;
  checkJs?: boolean;
  esModuleInterop?: boolean;
  skipLibCheck?: boolean;
  forceConsistentCasingInFileNames?: boolean;
  generateInferredTypes?: boolean;
  preserveComments?: boolean;
}

export interface TypeMigrationResult {
  success: boolean;
  filesMigrated: number;
  typesGenerated: number;
  anyTypesReplaced: number;
  errors: string[];
  warnings: string[];
}

export interface InterfaceInfo {
  name: string;
  filePath: string;
  properties: PropertyType[];
  methods: MethodType[];
  extends?: string[];
}

export interface PropertyType {
  name: string;
  type: string;
  optional: boolean;
  readonly: boolean;
}

export interface MethodType {
  name: string;
  parameters: ParameterType[];
  returnType: string;
  async: boolean;
}

export interface ParameterType {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export class TypeMigrator {
  private transformer: ASTTransformer;
  private formatter: Formatter;
  private logger: Logger;
  private typeInference: TypeInferenceEngine;
  private interfaceGenerator: InterfaceGenerator;

  constructor(private options: TypeMigrationOptions = {}) {
    this.transformer = new ASTTransformer({
      retainComments: options.preserveComments ?? true
    });
    this.formatter = new Formatter();
    this.logger = new Logger('info');
    this.typeInference = new TypeInferenceEngine();
    this.interfaceGenerator = new InterfaceGenerator();
  }

  /**
   * Migrate JavaScript to TypeScript
   */
  async migrateToTypeScript(
    projectPath: string
  ): Promise<TypeMigrationResult> {
    this.logger.info(`Migrating project to TypeScript: ${projectPath}`);

    const result: TypeMigrationResult = {
      success: true,
      filesMigrated: 0,
      typesGenerated: 0,
      anyTypesReplaced: 0,
      errors: [],
      warnings: []
    };

    try {
      // Initialize TypeScript configuration
      await this.initializeTsConfig(projectPath);

      // Find all JavaScript files
      const jsFiles = await this.findJavaScriptFiles(projectPath);

      this.logger.info(`Found ${jsFiles.length} JavaScript files to migrate`);

      for (const filePath of jsFiles) {
        try {
          await this.migrateFileToTypeScript(filePath);
          result.filesMigrated++;
        } catch (error) {
          result.errors.push(`${filePath}: ${error}`);
          this.logger.error(`Failed to migrate ${filePath}: ${error}`);
        }
      }

      // Generate type definitions for external libraries
      await this.generateLibDefinitions(projectPath);

      this.logger.info(`Migration complete: ${result.filesMigrated} files migrated`);

      return result;
    } catch (error) {
      this.logger.error(`Migration failed: ${error}`);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  /**
   * Eliminate 'any' types and replace with inferred types
   */
  async eliminateAnyTypes(filePath: string): Promise<number> {
    this.logger.info(`Eliminating 'any' types in ${filePath}`);

    const code = await fs.readFile(filePath, 'utf-8');
    const ast = await parse(filePath, code);

    let replacedCount = 0;

    this.transformer.traverse(ast, {
      TSAnyKeyword(path) {
        // Try to infer the actual type
        const inferredType = this.typeInference.inferType(path.node, path);

        if (inferredType && inferredType !== 'any') {
          // Replace 'any' with inferred type
          path.replaceWith(this.createTypeNode(inferredType));
          replacedCount++;
        }
      }
    });

    if (replacedCount > 0) {
      const result = this.transformer.generate(ast);
      const formatted = await this.formatter.format(result.code, filePath, code);
      await fs.writeFile(filePath, formatted);
    }

    return replacedCount;
  }

  /**
   * Migrate to strict mode
   */
  async migrateToStrictMode(projectPath: string): Promise<void> {
    this.logger.info(`Migrating to strict mode: ${projectPath}`);

    const tsConfigPath = path.join(projectPath, 'tsconfig.json');
    const tsConfig = JSON.parse(await fs.readFile(tsConfigPath, 'utf-8'));

    tsConfig.compilerOptions.strict = true;
    tsConfig.compilerOptions.noImplicitAny = true;
    tsConfig.compilerOptions.strictNullChecks = true;
    tsConfig.compilerOptions.strictFunctionTypes = true;
    tsConfig.compilerOptions.strictBindCallApply = true;
    tsConfig.compilerOptions.strictPropertyInitialization = true;
    tsConfig.compilerOptions.noImplicitThis = true;
    tsConfig.compilerOptions.alwaysStrict = true;

    await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2));

    // Fix any resulting type errors
    const tsFiles = await this.findTypeScriptFiles(projectPath);

    for (const filePath of tsFiles) {
      await this.fixStrictModeErrors(filePath);
    }
  }

  /**
   * Generate interfaces from classes
   */
  async extractInterfaces(
    projectPath: string,
    options: {
      includePublic?: boolean;
      includeProtected?: boolean;
      includePrivate?: boolean;
    } = {}
  ): Promise<InterfaceInfo[]> {
    this.logger.info(`Extracting interfaces from ${projectPath}`);

    const interfaces: InterfaceInfo[] = [];
    const tsFiles = await this.findTypeScriptFiles(projectPath);

    for (const filePath of tsFiles) {
      const code = await fs.readFile(filePath, 'utf-8');
      const ast = await parse(filePath, code);

      const fileInterfaces = await this.interfaceGenerator.extractFromClass(
        ast,
        filePath,
        options
      );

      interfaces.push(...fileInterfaces);
    }

    return interfaces;
  }

  /**
   * Generate type definitions for a file
   */
  async generateTypeDefinitions(filePath: string): Promise<string> {
    this.logger.info(`Generating type definitions for ${filePath}`);

    const code = await fs.readFile(filePath, 'utf-8');
    const ast = await parse(filePath, code);

    const types = this.typeInference.extractExportedTypes(ast, filePath);
    const definitions = this.interfaceGenerator.generateTypeDefinitions(types);

    return definitions;
  }

  /**
   * Introduce generics to improve type safety
   */
  async introduceGenerics(filePath: string): Promise<number> {
    this.logger.info(`Introducing generics in ${filePath}`);

    const code = await fs.readFile(filePath, 'utf-8');
    const ast = await parse(filePath, code);

    let genericsIntroduced = 0;

    // Find functions that use 'any' types and could benefit from generics
    this.transformer.traverse(ast, {
      FunctionDeclaration(path) {
        const anyParameters = path.node.params.filter(
          (param: any) => param.typeAnnotation?.type === 'TSAnyKeyword'
        );

        if (anyParameters.length > 0) {
          // Introduce generic type parameters
          const typeParameters = anyParameters.map((param: any, index) => {
            return t.typeParameter(
              t.identifier(`T${index}`),
              null,
              null
            );
          });

          path.node.typeParameters = t.typeParameterDeclaration(typeParameters);

          // Update parameter annotations
          anyParameters.forEach((param: any, index: number) => {
            param.typeAnnotation = t.typeAnnotation(
              t.typeReference(t.identifier(`T${index}`))
            );
          });

          genericsIntroduced++;
        }
      }
    });

    if (genericsIntroduced > 0) {
      const result = this.transformer.generate(ast);
      const formatted = await this.formatter.format(result.code, filePath, code);
      await fs.writeFile(filePath, formatted);
    }

    return genericsIntroduced;
  }

  /**
   * Initialize TypeScript configuration
   */
  private async initializeTsConfig(projectPath: string): Promise<void> {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json');

    try {
      await fs.access(tsConfigPath);
      this.logger.info('tsconfig.json already exists');
    } catch {
      this.logger.info('Creating tsconfig.json');

      const tsConfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          lib: ['ES2020'],
          outDir: './dist',
          rootDir: './src',
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          strict: this.options.strictMode ?? true,
          noImplicitAny: this.options.strictMode ?? true,
          strictNullChecks: this.options.strictMode ?? true,
          strictFunctionTypes: this.options.strictMode ?? true,
          strictBindCallApply: this.options.strictMode ?? true,
          strictPropertyInitialization: this.options.strictMode ?? true,
          noImplicitThis: this.options.strictMode ?? true,
          alwaysStrict: this.options.strictMode ?? true,
          esModuleInterop: this.options.esModuleInterop ?? true,
          skipLibCheck: this.options.skipLibCheck ?? true,
          forceConsistentCasingInFileNames: this.options.forceConsistentCasingInFileNames ?? true,
          allowJs: this.options.allowJs ?? true,
          checkJs: this.options.checkJs ?? false,
          moduleResolution: 'node',
          resolveJsonModule: true,
          allowSyntheticDefaultImports: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      };

      await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2));
    }
  }

  /**
   * Migrate a single file to TypeScript
   */
  private async migrateFileToTypeScript(filePath: string): Promise<void> {
    const code = await fs.readFile(filePath, 'utf-8');
    const ast = await parse(filePath, code);

    // Infer and add types
    const typedAst = await this.typeInference.addTypeAnnotations(ast, filePath);

    // Generate TypeScript code
    const result = this.transformer.generate(typedAst);
    const formatted = await this.formatter.format(result.code, filePath, code);

    // Write to .ts file
    const tsFilePath = filePath.replace(/\.js$/, '.ts');
    await fs.writeFile(tsFilePath, formatted);

    // Optionally remove the original .js file
    if (!this.options.allowJs) {
      await fs.unlink(filePath);
    }
  }

  /**
   * Find all JavaScript files in a project
   */
  private async findJavaScriptFiles(projectPath: string): Promise<string[]> {
    const jsFiles: string[] = [];

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist') {
            await walk(fullPath);
          }
        } else if (entry.name.endsWith('.js')) {
          jsFiles.push(fullPath);
        }
      }
    }

    await walk(projectPath);
    return jsFiles;
  }

  /**
   * Find all TypeScript files in a project
   */
  private async findTypeScriptFiles(projectPath: string): Promise<string[]> {
    const tsFiles: string[] = [];

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist') {
            await walk(fullPath);
          }
        } else if (entry.name.endsWith('.ts')) {
          tsFiles.push(fullPath);
        }
      }
    }

    await walk(projectPath);
    return tsFiles;
  }

  /**
   * Generate type definitions for external libraries
   */
  private async generateLibDefinitions(projectPath: string): Promise<void> {
    const typesPath = path.join(projectPath, 'types');

    try {
      await fs.mkdir(typesPath, { recursive: true });
    } catch {
      // Directory already exists
    }

    // Generate declaration files for untyped libraries
    const packageJson = JSON.parse(
      await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8')
    );

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    for (const [name, version] of Object.entries(dependencies)) {
      const defPath = path.join(typesPath, `${name}.d.ts`);

      try {
        await fs.access(defPath);
      } catch {
        // Create basic type definition
        const definition = this.generateBasicDefinition(name);
        await fs.writeFile(defPath, definition);
      }
    }
  }

  /**
   * Generate basic type definition for a library
   */
  private generateBasicDefinition(libraryName: string): string {
    return `declare module '${libraryName}' {
  // TODO: Add proper type definitions for ${libraryName}
  export const version: string;
  export default any;
}
`;
  }

  /**
   * Fix strict mode errors
   */
  private async fixStrictModeErrors(filePath: string): Promise<void> {
    const code = await fs.readFile(filePath, 'utf-8');
    const ast = await parse(filePath, code);

    // Fix implicit any errors
    this.transformer.traverse(ast, {
      Identifier(path) {
        if (path.isBinding() && !path.node.typeAnnotation) {
          const inferredType = this.typeInference.inferType(path.node, path);
          if (inferredType) {
            path.node.typeAnnotation = t.typeAnnotation(
              this.createTypeNode(inferredType)
            );
          }
        }
      }
    });

    const result = this.transformer.generate(ast);
    const formatted = await this.formatter.format(result.code, filePath, code);
    await fs.writeFile(filePath, formatted);
  }

  /**
   * Create a type node from a type string
   */
  private createTypeNode(typeString: string): any {
    const t = require('@babel/types');

    switch (typeString) {
      case 'string':
        return t.tsStringKeyword();
      case 'number':
        return t.tsNumberKeyword();
      case 'boolean':
        return t.tsBooleanKeyword();
      case 'void':
        return t.tsVoidKeyword();
      case 'any':
        return t.tsAnyKeyword();
      case 'unknown':
        return t.tsUnknownKeyword();
      case 'null':
        return t.tsNullKeyword();
      case 'undefined':
        return t.tsUndefinedKeyword();
      default:
        // Handle complex types (arrays, objects, etc.)
        if (typeString.endsWith('[]')) {
          const elementType = typeString.slice(0, -2);
          return t.tsArrayType(this.createTypeNode(elementType));
        }
        return t.tsTypeReference(t.identifier(typeString));
    }
  }
}

// Import babel types
import * as t from '@babel/types';
