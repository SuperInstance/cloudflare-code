/**
 * Language-Specific Code Generators
 *
 * Provides language-aware code generation with proper syntax,
 * idioms, and best practices for 20+ programming languages.
 */

import type { SupportedLanguage, LanguageGeneratorConfig, CommonPattern, BestPractice } from '../types';

/**
 * Base language generator
 */
export abstract class LanguageGenerator {
  abstract readonly config: LanguageGeneratorConfig;

  /**
   * Generate a function
   */
  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    throw new Error('Not implemented');
  }

  /**
   * Generate a class
   */
  generateClass(name: string, properties: any[], methods: any[], options: any = {}): string {
    throw new Error('Not implemented');
  }

  /**
   * Generate an interface
   */
  generateInterface(name: string, properties: any[], options: any = {}): string {
    throw new Error('Not implemented');
  }

  /**
   * Generate a comment
   */
  generateComment(text: string, doc: boolean = false): string {
    if (doc) {
      return this.config.lineComment[0] + doc + text;
    }
    return this.config.lineComment[0] + ' ' + text;
  }

  /**
   * Indent code
   */
  indent(code: string, level: number = 1): string {
    const indentChar = this.config.indentation === 'tabs' ? '\t' : ' '.repeat(this.config.indentSize);
    return indentChar.repeat(level) + code;
  }

  /**
   * Wrap in block
   */
  wrapInBlock(code: string, open: string, close: string): string {
    return `${open}\n${this.indent(code)}\n${close}`;
  }
}

/**
 * TypeScript generator
 */
export class TypeScriptGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'typescript',
    extensions: ['.ts', '.tsx'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
    indentation: 'spaces',
    indentSize: 2,
    features: {
      staticTyping: true,
      classes: true,
      interfaces: true,
      generics: true,
      asyncAwait: true,
      decorators: true,
      macros: false,
      operatorOverloading: false,
      patternMatching: true,
      modules: true,
      nullSafety: false,
    },
    bestPractices: [
      {
        id: 'ts-explicit-return',
        name: 'Explicit Return Types',
        category: 'type-safety',
        example: 'function add(a: number, b: number): number { return a + b; }',
      },
      {
        id: 'ts-readonly',
        name: 'Readonly Properties',
        category: 'best-practices',
        example: 'interface User { readonly id: string; }',
      },
    ],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const isAsync = options.async ? 'async ' : '';
    const signature = params.map(p => `${p.name}: ${p.type}`).join(', ');
    const returnType = options.returnType || 'void';

    return `${isAsync}function ${name}(${signature}): ${returnType} {
${this.indent(body)}
}`;
  }

  generateClass(name: string, properties: any[], methods: any[], options: any = {}): string {
    const propsDecl = properties.map(p => this.indent(`${p.name}: ${p.type};`)).join('\n');
    const methodsDecl = methods.map(m => this.indent(m.code)).join('\n\n');

    return `export class ${name} {
${propsDecl}

${methodsDecl}
}`;
  }

  generateInterface(name: string, properties: any[], options: any = {}): string {
    const props = properties.map(p => this.indent(`${p.name}${p.optional ? '?' : ''}: ${p.type};`)).join('\n');

    return `export interface ${name} {
${props}
}`;
  }
}

/**
 * Python generator
 */
export class PythonGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'python',
    extensions: ['.py'],
    lineComment: ['#'],
    blockComment: ['"""', '"""'],
    indentation: 'spaces',
    indentSize: 4,
    features: {
      staticTyping: false,
      classes: true,
      interfaces: true,
      generics: true,
      asyncAwait: true,
      decorators: true,
      macros: false,
      operatorOverloading: true,
      patternMatching: true,
      modules: true,
      nullSafety: false,
    },
    bestPractices: [
      {
        id: 'py-type-hints',
        name: 'Type Hints',
        category: 'type-safety',
        example: 'def add(a: int, b: int) -> int: return a + b',
      },
      {
        id: 'py-docstrings',
        name: 'Docstrings',
        category: 'documentation',
        example: '"""Function documentation."""',
      },
    ],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const isAsync = options.async ? 'async ' : '';
    const signature = params.map(p => p.name + (p.type ? `: ${p.type}` : '')).join(', ');
    const returnType = options.returnType ? ` -> ${options.returnType}` : '';

    return `${isAsync}def ${name}(${signature})${returnType}:
${this.indent(body)}
`;
  }

  generateClass(name: string, properties: any[], methods: any[], options: any = {}): string {
    const props = properties.length > 0
      ? `\n${this.indent('# Properties')}\n${properties.map(p => this.indent(`${p.name}: ${p.type}`)).join('\n')}\n`
      : '';

    const methodsDecl = methods.map(m => this.indent(m.code)).join('\n\n');

    return `class ${name}:${props}
${this.indent('"""' + (options.description || name) + '"""')}
${methodsDecl}
`;
  }
}

/**
 * Go generator
 */
export class GoGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'go',
    extensions: ['.go'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
    indentation: 'tabs',
    indentSize: 1,
    features: {
      staticTyping: true,
      classes: false,
      interfaces: true,
      generics: true,
      asyncAwait: false,
      decorators: false,
      macros: false,
      operatorOverloading: false,
      patternMatching: true,
      modules: true,
      nullSafety: false,
    },
    bestPractices: [
      {
        id: 'go-error-handling',
        name: 'Error Handling',
        category: 'error-handling',
        example: 'if err != nil { return err }',
      },
    ],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const signature = params.map(p => `${p.name} ${p.type}`).join(', ');
    const returnType = options.returnType || '';

    return `func ${name}(${signature}) ${returnType} {
${this.indent(body)}
}
`;
  }

  generateClass(name: string, properties: any[], methods: any[], options: any = {}): string {
    const props = properties.map(p => this.indent(`${p.name} ${p.type}\`json:"${p.name}"\``)).join('\n');
    const methodsDecl = methods.map(m => '\n' + m.code).join('\n');

    return `type ${name} struct {
${props}
}

${methodsDecl}
`;
  }
}

/**
 * Rust generator
 */
export class RustGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'rust',
    extensions: ['.rs'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
    indentation: 'spaces',
    indentSize: 4,
    features: {
      staticTyping: true,
      classes: false,
      interfaces: false,
      generics: true,
      asyncAwait: true,
      decorators: false,
      macros: true,
      operatorOverloading: true,
      patternMatching: true,
      modules: true,
      nullSafety: true,
    },
    bestPractices: [
      {
        id: 'rust-error-handling',
        name: 'Result Type',
        category: 'error-handling',
        example: 'fn foo() -> Result<T, E>',
      },
      {
        id: 'rust-ownership',
        name: 'Ownership',
        category: 'best-practices',
        example: 'Use references (&) instead of moving values when possible',
      },
    ],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const signature = params.map(p => `${p.name}: ${p.type}`).join(', ');
    const returnType = options.returnType ? ` -> ${options.returnType}` : '';

    return `fn ${name}(${signature})${returnType} {
${this.indent(body)}
}
`;
  }

  generateClass(name: string, properties: any[], methods: any[], options: any = {}): string {
    const fields = properties.map(p => this.indent(`${p.name}: ${p.type},`)).join('\n');
    const methodsDecl = methods.map(m => '\n' + m.code).join('\n');

    return `pub struct ${name} {
${fields}
}

impl ${name} {
${methodsDecl}
}
`;
  }
}

/**
 * Java generator
 */
export class JavaGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'java',
    extensions: ['.java'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
    indentation: 'spaces',
    indentSize: 4,
    features: {
      staticTyping: true,
      classes: true,
      interfaces: true,
      generics: true,
      asyncAwait: false,
      decorators: true,
      macros: false,
      operatorOverloading: false,
      patternMatching: true,
      modules: true,
      nullSafety: false,
    },
    bestPractices: [
      {
        id: 'java-exceptions',
        name: 'Exception Handling',
        category: 'error-handling',
        example: 'try-catch-finally blocks',
      },
    ],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const signature = params.map(p => `${p.type} ${p.name}`).join(', ');
    const returnType = options.returnType || 'void';
    const modifiers = options.modifiers || 'public';

    return `${modifiers} ${returnType} ${name}(${signature}) {
${this.indent(body)}
}
`;
  }

  generateClass(name: string, properties: any[], methods: any[], options: any = {}): string {
    const fields = properties.map(p => this.indent(`private ${p.type} ${p.name};`)).join('\n');
    const methodsDecl = methods.map(m => '\n' + this.indent(m.code)).join('\n');

    return `public class ${name} {
${fields}

${methodsDecl}
}
`;
  }
}

/**
 * C# generator
 */
export class CSharpGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'csharp',
    extensions: ['.cs'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
    indentation: 'spaces',
    indentSize: 4,
    features: {
      staticTyping: true,
      classes: true,
      interfaces: true,
      generics: true,
      asyncAwait: true,
      decorators: true,
      macros: false,
      operatorOverloading: true,
      patternMatching: true,
      modules: true,
      nullSafety: true,
    },
    bestPractices: [],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const isAsync = options.async ? 'async ' : '';
    const signature = params.map(p => `${p.type} ${p.name}`).join(', ');
    const returnType = options.returnType || 'void';
    const modifiers = options.modifiers || 'public';

    return `${modifiers} ${isAsync}${returnType} ${name}(${signature}) {
${this.indent(body)}
}
`;
  }
}

/**
 * C++ generator
 */
export class CPPGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'cpp',
    extensions: ['.cpp', '.hpp', '.h', '.cc'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
    indentation: 'spaces',
    indentSize: 2,
    features: {
      staticTyping: true,
      classes: true,
      interfaces: false,
      generics: true,
      asyncAwait: false,
      decorators: false,
      macros: true,
      operatorOverloading: true,
      patternMatching: false,
      modules: false,
      nullSafety: false,
    },
    bestPractices: [],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const signature = params.map(p => `${p.type} ${p.name}`).join(', ');
    const returnType = options.returnType || 'void';

    return `${returnType} ${name}(${signature}) {
${this.indent(body)}
}
`;
  }
}

/**
 * Ruby generator
 */
export class RubyGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'ruby',
    extensions: ['.rb'],
    lineComment: ['#'],
    blockComment: ['=begin', '=end'],
    indentation: 'spaces',
    indentSize: 2,
    features: {
      staticTyping: false,
      classes: true,
      interfaces: false,
      generics: false,
      asyncAwait: false,
      decorators: true,
      macros: false,
      operatorOverloading: true,
      patternMatching: true,
      modules: true,
      nullSafety: false,
    },
    bestPractices: [],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const signature = params.map(p => p.name).join(', ');
    return `def ${name}(${signature})
${this.indent(body)}
end
`;
  }
}

/**
 * PHP generator
 */
export class PHPGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'php',
    extensions: ['.php'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
    indentation: 'spaces',
    indentSize: 4,
    features: {
      staticTyping: true,
      classes: true,
      interfaces: true,
      generics: true,
      asyncAwait: false,
      decorators: false,
      macros: false,
      operatorOverloading: false,
      patternMatching: true,
      modules: false,
      nullSafety: false,
    },
    bestPractices: [],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const signature = params.map(p => {
      const type = p.type ? `${p.type} ` : '';
      return `${type}$${p.name}`;
    }).join(', ');
    const returnType = options.returnType ? `: ${options.returnType}` : '';

    return `function ${name}(${signature})${returnType} {
${this.indent(body)}
}
`;
  }
}

/**
 * Swift generator
 */
export class SwiftGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'swift',
    extensions: ['.swift'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
    indentation: 'spaces',
    indentSize: 4,
    features: {
      staticTyping: true,
      classes: true,
      interfaces: true,
      generics: true,
      asyncAwait: true,
      decorators: true,
      macros: false,
      operatorOverloading: true,
      patternMatching: true,
      modules: true,
      nullSafety: true,
    },
    bestPractices: [],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const isAsync = options.async ? 'async ' : '';
    const signature = params.map(p => `_ ${p.name}: ${p.type}`).join(', ');
    const returnType = options.returnType ? ` -> ${options.returnType}` : '';

    return `func ${isAsync}${name}(${signature})${returnType} {
${this.indent(body)}
}
`;
  }
}

/**
 * Kotlin generator
 */
export class KotlinGenerator extends LanguageGenerator {
  readonly config: LanguageGeneratorConfig = {
    language: 'kotlin',
    extensions: ['.kt', '.kts'],
    lineComment: ['//'],
    blockComment: ['/*', '*/'],
    indentation: 'spaces',
    indentSize: 4,
    features: {
      staticTyping: true,
      classes: true,
      interfaces: true,
      generics: true,
      asyncAwait: true,
      decorators: true,
      macros: false,
      operatorOverloading: true,
      patternMatching: true,
      modules: true,
      nullSafety: true,
    },
    bestPractices: [],
    commonPatterns: [],
  };

  generateFunction(name: string, params: any[], body: string, options: any = {}): string {
    const isSuspend = options.async ? 'suspend ' : '';
    const signature = params.map(p => `${p.name}: ${p.type}`).join(', ');
    const returnType = options.returnType ? `: ${options.returnType}` : '';

    return `fun ${isSuspend}${name}(${signature})${returnType} {
${this.indent(body)}
}
`;
  }
}

/**
 * Get language generator for given language
 */
export function getLanguageGenerator(language: SupportedLanguage): LanguageGenerator | null {
  const generators: Partial<Record<SupportedLanguage, new () => LanguageGenerator>> = {
    typescript: TypeScriptGenerator,
    javascript: TypeScriptGenerator,
    python: PythonGenerator,
    go: GoGenerator,
    rust: RustGenerator,
    java: JavaGenerator,
    csharp: CSharpGenerator,
    cpp: CPPGenerator,
    c: CPPGenerator,
    ruby: RubyGenerator,
    php: PHPGenerator,
    swift: SwiftGenerator,
    kotlin: KotlinGenerator,
  };

  const GeneratorClass = generators[language];
  return GeneratorClass ? new GeneratorClass() : null;
}

/**
 * Get language config
 */
export function getLanguageConfig(language: SupportedLanguage): LanguageGeneratorConfig | null {
  const generator = getLanguageGenerator(language);
  return generator ? generator.config : null;
}
