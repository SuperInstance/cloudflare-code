/**
 * TypeScript Parser - Parse TypeScript/JavaScript code
 */

import * as ts from 'typescript';
import {
  ParsedDocumentation,
  ExportInfo,
  ClassInfo,
  FunctionInfo,
  InterfaceInfo,
  TypeInfo,
  ConstantInfo,
  SourceLocation
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

export class TypeScriptParser {
  private logger: Logger;

  constructor(private options: any) {
    this.logger = new Logger('TypeScriptParser');
  }

  async parse(filePath: string, content: string): Promise<ParsedDocumentation> {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const exports: ExportInfo[] = [];
    const classes: ClassInfo[] = [];
    const functions: FunctionInfo[] = [];
    const interfaces: InterfaceInfo[] = [];
    const types: TypeInfo[] = [];
    const constants: ConstantInfo[] = [];

    this.parseNode(sourceFile, {
      exports,
      classes,
      functions,
      interfaces,
      types,
      constants
    }, filePath);

    const coverage = this.calculateCoverage({
      exports,
      classes,
      functions,
      interfaces,
      types,
      constants
    });

    return {
      filePath,
      language: 'typescript',
      exports,
      classes,
      functions,
      interfaces,
      types,
      constants,
      coverage
    };
  }

  private parseNode(node: ts.Node, collector: any, filePath: string): void {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      const func = this.parseFunction(node, filePath);
      if (func) {
        collector.functions.push(func);
        if (this.isExported(node)) {
          collector.exports.push({
            name: func.name,
            type: 'function',
            exported: true,
            default: false,
            documentation: func.documentation,
            sourceLocation: func.sourceLocation
          });
        }
      }
    }

    if (ts.isClassDeclaration(node)) {
      const cls = this.parseClass(node, filePath);
      if (cls) {
        collector.classes.push(cls);
        if (this.isExported(node)) {
          collector.exports.push({
            name: cls.name,
            type: 'class',
            exported: true,
            default: false,
            documentation: cls.documentation,
            sourceLocation: cls.sourceLocation
          });
        }
      }
    }

    if (ts.isInterfaceDeclaration(node)) {
      const int = this.parseInterface(node, filePath);
      if (int) {
        collector.interfaces.push(int);
        if (this.isExported(node)) {
          collector.exports.push({
            name: int.name,
            type: 'interface',
            exported: true,
            default: false,
            documentation: int.documentation,
            sourceLocation: int.sourceLocation
          });
        }
      }
    }

    if (ts.isTypeAliasDeclaration(node)) {
      const type = this.parseTypeAlias(node, filePath);
      if (type) {
        collector.types.push(type);
        if (this.isExported(node)) {
          collector.exports.push({
            name: type.name,
            type: 'type',
            exported: true,
            default: false,
            documentation: type.documentation,
            sourceLocation: type.sourceLocation
          });
        }
      }
    }

    if (ts.isVariableStatement(node)) {
      const vars = this.parseVariableStatement(node, filePath);
      collector.constants.push(...vars);
    }

    ts.forEachChild(node, child => this.parseNode(child, collector, filePath));
  }

  private parseFunction(node: ts.FunctionLike, filePath: string): FunctionInfo | null {
    const name = this.getFunctionName(node);
    if (!name) return null;

    const sourceLocation = this.getSourceLocation(node, filePath);
    const documentation = this.getJsDocComment(node);
    const parameters = this.parseParameters(node);
    const returnType = this.parseType(node.type);
    const async = this.isAsync(node);
    const generator = this.isGenerator(node);

    return {
      name,
      parameters,
      returnType,
      async,
      generator,
      documentation,
      examples: [],
      sourceLocation
    };
  }

  private parseClass(node: ts.ClassDeclaration, filePath: string): ClassInfo | null {
    const name = node.name?.getText() || 'Anonymous';
    const sourceLocation = this.getSourceLocation(node, filePath);
    const documentation = this.getJsDocComment(node);
    const extendsClause = node.heritageClauses?.find(h => h.token === ts.SyntaxKind.ExtendsKeyword);
    const implementsClause = node.heritageClauses?.find(h => h.token === ts.SyntaxKind.ImplementsKeyword);

    const properties: any[] = [];
    const methods: any[] = [];

    for (const member of node.members) {
      if (ts.isPropertyDeclaration(member)) {
        properties.push(this.parseProperty(member, filePath));
      } else if (ts.isMethodDeclaration(member)) {
        const method = this.parseFunction(member, filePath);
        if (method) {
          methods.push({
            ...method,
            static: this.isStatic(member),
            visibility: this.getVisibility(member)
          });
        }
      }
    }

    return {
      name,
      extends: extendsClause?.types[0]?.getText(),
      implements: implementsClause?.types.map(t => t.getText()),
      isAbstract: false,
      isStatic: false,
      documentation,
      decorators: [],
      properties,
      methods,
      sourceLocation
    };
  }

  private parseInterface(node: ts.InterfaceDeclaration, filePath: string): InterfaceInfo {
    const name = node.name.getText();
    const sourceLocation = this.getSourceLocation(node, filePath);
    const documentation = this.getJsDocComment(node);

    const properties: any[] = [];
    const methods: any[] = [];

    for (const member of node.members) {
      if (ts.isPropertySignature(member)) {
        properties.push(this.parsePropertySignature(member));
      } else if (ts.isMethodSignature(member)) {
        const method = this.parseMethodSignature(member);
        methods.push(method);
      }
    }

    return {
      name,
      extends: node.extendsClause?.types.map(t => t.getText()) || [],
      documentation,
      properties,
      methods,
      sourceLocation,
      callSignatures: [],
      indexSignatures: []
    };
  }

  private parseTypeAlias(node: ts.TypeAliasDeclaration, filePath: string): TypeInfo {
    const name = node.name.getText();
    const sourceLocation = this.getSourceLocation(node, filePath);
    const documentation = this.getJsDocComment(node);
    const type = this.parseType(node.type);

    return {
      name,
      kind: 'alias',
      type,
      documentation,
      sourceLocation
    };
  }

  private parseVariableStatement(node: ts.VariableStatement, filePath: string): ConstantInfo[] {
    const constants: ConstantInfo[] = [];

    for (const decl of node.declarationList.declarations) {
      if (ts.isVariableDeclaration(decl) && decl.name) {
        const name = decl.name.getText();
        const sourceLocation = this.getSourceLocation(decl, filePath);
        const documentation = this.getJsDocComment(decl);
        const type = this.parseType(decl.type);
        const value = decl.initializer?.getText() || 'undefined';

        constants.push({
          name,
          type,
          value,
          documentation,
          sourceLocation
        });
      }
    }

    return constants;
  }

  private parseParameters(node: ts.FunctionLike): any[] {
    const parameters: any[] = [];

    for (const param of node.parameters) {
      parameters.push({
        name: param.name.getText(),
        type: this.parseType(param.type),
        optional: param.questionToken !== undefined,
        rest: param.dotDotDotToken !== undefined,
        documentation: this.getJsDocComment(param),
        defaultValue: param.initializer?.getText()
      });
    }

    return parameters;
  }

  private parseProperty(node: ts.PropertyDeclaration, filePath: string): any {
    return {
      name: node.name.getText(),
      type: this.parseType(node.type),
      readonly: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword),
      optional: node.questionToken !== undefined,
      visibility: this.getVisibility(node),
      documentation: this.getJsDocComment(node),
      defaultValue: node.initializer?.getText(),
      sourceLocation: this.getSourceLocation(node, filePath)
    };
  }

  private parsePropertySignature(node: ts.PropertySignature): any {
    return {
      name: node.name.getText(),
      type: this.parseType(node.type),
      readonly: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword),
      optional: node.questionToken !== undefined,
      documentation: this.getJsDocComment(node),
      sourceLocation: { filePath: '', line: 0, column: 0 }
    };
  }

  private parseMethodSignature(node: ts.MethodSignature): any {
    return {
      name: node.name.getText(),
      parameters: this.parseParameters(node),
      returnType: this.parseType(node.type),
      async: false,
      generator: false,
      documentation: this.getJsDocComment(node),
      examples: [],
      sourceLocation: { filePath: '', line: 0, column: 0 }
    };
  }

  private parseType(typeNode: ts.TypeNode | undefined): any {
    if (!typeNode) {
      return { text: 'any' };
    }

    const text = typeNode.getText();

    if (ts.isArrayTypeNode(typeNode)) {
      return {
        text: `${typeNode.elementType.getText()}[]`,
        array: this.parseType(typeNode.elementType)
      };
    }

    if (ts.isUnionTypeNode(typeNode)) {
      return {
        text,
        union: typeNode.types.map(t => this.parseType(t))
      };
    }

    if (ts.isTupleTypeNode(typeNode)) {
      return {
        text,
        tuple: typeNode.elements.map(e => this.parseType(e))
      };
    }

    if (ts.isTypeReferenceNode(typeNode)) {
      const typeArgs = typeNode.typeArguments;
      if (typeArgs) {
        return {
          text,
          generics: typeArgs.map(t => this.parseType(t))
        };
      }
    }

    return { text };
  }

  private getFunctionName(node: ts.FunctionLike): string | null {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
      return node.name?.getText() || 'anonymous';
    }
    return 'arrow';
  }

  private isExported(node: ts.Node): boolean {
    return !!ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export;
  }

  private isAsync(node: ts.FunctionLike): boolean {
    return !!(node as ts.FunctionDeclaration).modifiers?.some(
      m => m.kind === ts.SyntaxKind.AsyncKeyword
    );
  }

  private isGenerator(node: ts.FunctionLike): boolean {
    return !!(node as ts.FunctionDeclaration).asteriskToken;
  }

  private isStatic(node: ts.Node): boolean {
    return !!ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static;
  }

  private getVisibility(node: ts.Node): 'public' | 'protected' | 'private' {
    const flags = ts.getCombinedModifierFlags(node);
    if (flags & ts.ModifierFlags.Private) return 'private';
    if (flags & ts.ModifierFlags.Protected) return 'protected';
    return 'public';
  }

  private getSourceLocation(node: ts.Node, filePath: string): SourceLocation {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return {
      filePath,
      line: line + 1,
      column: character + 1
    };
  }

  private getJsDocComment(node: ts.Node): string {
    const jsDocTags = ts.getJSDocComments(node);
    if (!jsDocTags || !jsDocTags.length) return '';

    const comments: string[] = [];
    for (const tag of jsDocTags) {
      if (ts.isJSDoc(tag)) {
        for (const child of tag.comments) {
          if (typeof child === 'string') {
            comments.push(child);
          }
        }
      }
    }

    return comments.join('\n');
  }

  private calculateCoverage(collector: any): any {
    const items = [
      ...collector.exports,
      ...collector.classes,
      ...collector.functions,
      ...collector.interfaces,
      ...collector.types
    ];

    const total = items.length;
    const documented = items.filter(item => item.documentation && item.documentation.trim().length > 0).length;

    return {
      documented,
      total,
      percentage: total > 0 ? (documented / total) * 100 : 0,
      byType: {},
      undocumented: []
    };
  }
}
