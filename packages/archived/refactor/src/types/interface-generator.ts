// @ts-nocheck
/**
 * Interface Generator
 *
 * Generates TypeScript interfaces from classes and objects.
 */

import { Logger } from '../utils/logger';
import * as fs from 'fs/promises';

export interface InterfaceGenerationOptions {
  includePrivate?: boolean;
  includeProtected?: boolean;
  includeJSDoc?: boolean;
  exportInterface?: boolean;
  outputDirectory?: string;
}

export class InterfaceGenerator {
  private logger: Logger;

  constructor(private options: InterfaceGenerationOptions = {}) {
    this.logger = new Logger('info');
  }

  /**
   * Extract interfaces from classes
   */
  async extractFromClass(
    ast: any,
    filePath: string,
    options: { includePublic?: boolean; includeProtected?: boolean; includePrivate?: boolean } = {}
  ): Promise<any[]> {
    const interfaces: any[] = [];
    const t = require('@babel/types');

    const traverse = require('@babel/traverse').default;

    traverse(ast, {
      ClassDeclaration(path) {
        const className = path.node.id?.name;

        if (!className) {
          return;
        }

        const members = this.extractClassMembers(path.node, options);

        const interfaceInfo = {
          name: `I${className}`,
          filePath,
          properties: members.properties,
          methods: members.methods,
          extends: this.getExtendedInterfaces(path.node)
        };

        interfaces.push(interfaceInfo);
      }
    });

    return interfaces;
  }

  /**
   * Generate type definitions
   */
  generateTypeDefinitions(types: any[]): string {
    const definitions: string[] = [];

    for (const type of types) {
      switch (type.kind) {
        case 'interface':
          definitions.push(this.generateInterfaceDeclaration(type));
          break;

        case 'class':
          definitions.push(this.generateInterfaceFromClass(type));
          break;

        case 'function':
          definitions.push(this.generateFunctionType(type));
          break;

        case 'type':
          definitions.push(this.generateTypeAlias(type));
          break;
      }
    }

    return definitions.join('\n\n');
  }

  /**
   * Generate and save interface file
   */
  async generateInterfaceFile(
    interfaces: any[],
    outputPath: string
  ): Promise<void> {
    let content = '';

    for (const iface of interfaces) {
      content += this.generateInterfaceCode(iface);
      content += '\n\n';
    }

    await fs.writeFile(outputPath, content);
    this.logger.info(`Generated interface file: ${outputPath}`);
  }

  /**
   * Extract class members
   */
  private extractClassMembers(
    classNode: any,
    options: { includePublic?: boolean; includeProtected?: boolean; includePrivate?: boolean }
  ): { properties: any[]; methods: any[] } {
    const properties: any[] = [];
    const methods: any[] = [];

    const t = require('@babel/types');

    for (const member of classNode.body.body) {
      const visibility = this.getVisibility(member);

      if (visibility === 'private' && !options.includePrivate) {
        continue;
      }

      if (visibility === 'protected' && !options.includeProtected) {
        continue;
      }

      if (t.isClassProperty(member)) {
        properties.push({
          name: t.isIdentifier(member.key) ? member.key.name : '(computed)',
          type: this.extractTypeAnnotation(member.typeAnnotation),
          optional: member.optional,
          readonly: member.readonly
        });
      } else if (t.isClassMethod(member)) {
        methods.push({
          name: t.isIdentifier(member.key) ? member.key.name : '(computed)',
          parameters: this.extractParameters(member.params),
          returnType: this.extractTypeAnnotation(member.returnType),
          async: member.async
        });
      }
    }

    return { properties, methods };
  }

  /**
   * Get visibility of class member
   */
  private getVisibility(member: any): 'public' | 'protected' | 'private' {
    if (member.accessibility) {
      return member.accessibility;
    }

    if (member.key?.name?.startsWith('_')) {
      return 'private';
    }

    return 'public';
  }

  /**
   * Get extended interfaces
   */
  private getExtendedInterfaces(classNode: any): string[] {
    const extended: string[] = [];

    if (classNode.extends) {
      for (const base of classNode.extends) {
        const t = require('@babel/types');
        if (t.isIdentifier(base)) {
          extended.push(`I${base.name}`);
        }
      }
    }

    return extended;
  }

  /**
   * Extract type annotation
   */
  private extractTypeAnnotation(typeAnnotation: any): string {
    if (!typeAnnotation) {
      return 'any';
    }

    const t = require('@babel/types');

    if (t.isTSTypeAnnotation(typeAnnotation)) {
      return this.typeAnnotationToString(typeAnnotation.typeAnnotation);
    }

    return 'any';
  }

  /**
   * Extract parameters from function
   */
  private extractParameters(params: any[]): any[] {
    return params.map((param, index) => {
      const t = require('@babel/types');

      let name = `param${index}`;
      let type = 'any';
      let optional = false;

      if (t.isIdentifier(param)) {
        name = param.name;
        type = this.extractTypeAnnotation(param.typeAnnotation);
      } else if (t.isAssignmentPattern(param)) {
        if (t.isIdentifier(param.left)) {
          name = param.left.name;
          type = this.extractTypeAnnotation(param.left.typeAnnotation);
          optional = true;
        }
      } else if (t.isRestElement(param)) {
        name = `...${(param.argument as any).name || 'rest'}`;
        type = 'any[]';
      }

      return { name, type, optional };
    });
  }

  /**
   * Convert type annotation to string
   */
  private typeAnnotationToString(typeAnnotation: any): string {
    const t = require('@babel/types');

    if (t.isTSStringKeyword(typeAnnotation)) {
      return 'string';
    }

    if (t.isTSNumberKeyword(typeAnnotation)) {
      return 'number';
    }

    if (t.isTSBooleanKeyword(typeAnnotation)) {
      return 'boolean';
    }

    if (t.isTSVoidKeyword(typeAnnotation)) {
      return 'void';
    }

    if (t.isTSAnyKeyword(typeAnnotation)) {
      return 'any';
    }

    if (t.isTSArrayType(typeAnnotation)) {
      return `${this.typeAnnotationToString(typeAnnotation.elementType)}[]`;
    }

    if (t.isTSUnionType(typeAnnotation)) {
      return typeAnnotation.types
        .map((t: any) => this.typeAnnotationToString(t))
        .join(' | ');
    }

    if (t.isTSTypeReference(typeAnnotation)) {
      return typeAnnotation.typeName.name;
    }

    return 'any';
  }

  /**
   * Generate interface declaration code
   */
  private generateInterfaceDeclaration(type: any): string {
    let code = `interface ${type.node.id.name}`;

    if (type.node.typeParameters) {
      // Handle generics
      code += '<T>';
    }

    code += ' {\n';
    // Add interface body
    code += '}';

    return code;
  }

  /**
   * Generate interface from class
   */
  private generateInterfaceFromClass(type: any): string {
    let code = `interface I${type.name} {\n`;

    for (const prop of type.node.body?.body || []) {
      // Generate property declarations
    }

    code += '}';

    return code;
  }

  /**
   * Generate function type
   */
  private generateFunctionType(type: any): string {
    return `type ${type.name} = (...) => any;`;
  }

  /**
   * Generate type alias
   */
  private generateTypeAlias(type: any): string {
    return `type ${type.node.id.name} = ${type.node.typeAnnotation.typeAnnotation.id.name};`;
  }

  /**
   * Generate complete interface code
   */
  private generateInterfaceCode(iface: any): string {
    let code = '';

    if (this.options.exportInterface) {
      code += 'export ';
    }

    code += `interface ${iface.name}`;

    if (iface.extends && iface.extends.length > 0) {
      code += ` extends ${iface.extends.join(', ')}`;
    }

    code += ' {\n';

    // Add properties
    for (const prop of iface.properties) {
      code += `  ${prop.name}`;
      if (prop.optional) {
        code += '?';
      }
      code += `: ${prop.type};\n`;
    }

    // Add methods
    for (const method of iface.methods) {
      code += `  ${method.name}(`;
      code += method.parameters.map((p: any) => {
        let paramCode = p.name;
        if (p.optional) {
          paramCode += '?';
        }
        paramCode += `: ${p.type}`;
        return paramCode;
      }).join(', ');
      code += `): ${method.returnType};\n`;
    }

    code += '}';

    return code;
  }
}
