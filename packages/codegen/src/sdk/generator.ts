/**
 * SDK Generator
 * Generates SDKs for REST, GraphQL, gRPC, and WebSocket APIs
 */

import type { Language, SDKOptions, GeneratedSDK, GeneratedFile, GeneratedType, GeneratedClass, GeneratedFunction, CodeExample, APISpec } from '../types/index.js';
import type { FileManager } from '../utils/file-manager.js';
import type { TemplateEngine } from '../templates/engine.js';

/**
 * SDK Generator class
 */
export class SDKGenerator {
  private fileManager: FileManager;
  private templateEngine: TemplateEngine;

  constructor() {
    this.fileManager = new FileManager();
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Generate SDK from specification
   */
  async generate(options: SDKOptions): Promise<GeneratedSDK[]> {
    const sdks: GeneratedSDK[] = [];

    for (const language of options.languages) {
      const sdk = await this.generateSDKForLanguage(language, options);
      sdks.push(sdk);
    }

    return sdks;
  }

  /**
   * Generate SDK for a specific language
   */
  private async generateSDKForLanguage(
    language: Language,
    options: SDKOptions
  ): Promise<GeneratedSDK> {
    const spec = options.spec;

    // Generate types
    const types = this.generateSDKTypes(spec, language);

    // Generate client class
    const clientClass = this.generateClientClass(spec, language, options);

    // Generate utility functions
    const functions = this.generateUtilityFunctions(spec, language, options);

    // Generate files
    const files = await this.generateSDKFiles(spec, language, options);

    // Generate examples
    const examples = this.generateExamples(spec, language, options);

    return {
      name: options.sdkName || `${spec.name}SDK`,
      version: spec.version,
      language,
      files,
      types,
      classes: [clientClass],
      functions,
      documentation: this.generateSDKDocumentation(spec, language),
      examples
    };
  }

  /**
   * Generate SDK types
   */
  private generateSDKTypes(spec: APISpec, language: Language): GeneratedType[] {
    const types: GeneratedType[] = [];

    for (const endpoint of spec.endpoints) {
      if (endpoint.requestBody) {
        const typeName = this.getRequestTypeName(endpoint);
        types.push({
          name: typeName,
          definition: this.generateTypeDefinition(endpoint.requestBody.schema, typeName, language),
          description: endpoint.requestBody.description
        });
      }

      for (const response of endpoint.responses) {
        if (response.schema) {
          const typeName = this.getResponseTypeName(endpoint, response.statusCode);
          types.push({
            name: typeName,
            definition: this.generateTypeDefinition(response.schema, typeName, language),
            description: response.description
          });
        }
      }
    }

    return types;
  }

  /**
   * Generate client class
   */
  private generateClientClass(
    spec: APISpec,
    language: Language,
    options: SDKOptions
  ): GeneratedClass {
    const className = options.sdkName || `${spec.name}Client`;

    return {
      name: className,
      description: `SDK client for ${spec.name} API`,
      properties: [
        {
          name: 'baseURL',
          type: 'string',
          readonly: true,
          optional: false,
          description: 'Base URL for API requests'
        },
        {
          name: 'apiKey',
          type: 'string',
          readonly: true,
          optional: true,
          description: 'API authentication key'
        }
      ],
      methods: this.generateClientMethods(spec, language, options),
      constructors: [
        {
          parameters: [
            {
              name: 'config',
              type: 'SDKConfig',
              required: true,
              description: 'SDK configuration object'
            }
          ],
          description: 'Initialize the SDK client',
          implementation: `this.baseURL = config.baseURL;
this.apiKey = config.apiKey;
this.timeout = config.timeout || 30000;`
        }
      ]
    };
  }

  /**
   * Generate client methods
   */
  private generateClientMethods(
    spec: APISpec,
    language: Language,
    options: SDKOptions
  ): any[] {
    const methods: any[] = [];

    for (const endpoint of spec.endpoints) {
      const methodName = this.getMethodName(endpoint);

      methods.push({
        name: methodName,
        description: endpoint.description,
        parameters: this.getMethodParameters(endpoint),
        returnType: this.getMethodReturnType(endpoint),
        implementation: this.generateMethodImplementation(endpoint, spec, language),
        examples: [`${methodName}({ /* params */ })`]
      });
    }

    return methods;
  }

  /**
   * Generate utility functions
   */
  private generateUtilityFunctions(
    spec: APISpec,
    language: Language,
    options: SDKOptions
  ): GeneratedFunction[] {
    const functions: GeneratedFunction[] = [];

    // Retry function
    if (options.includeRetry) {
      functions.push({
        name: 'withRetry',
        signature: 'withRetry<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T>',
        description: 'Execute a function with automatic retry logic',
        parameters: [],
        returnType: 'Promise<T>',
        implementation: `let retries = maxRetries || 3;
while (retries > 0) {
  try {
    return await fn();
  } catch (error) {
    retries--;
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}`,
        examples: ['withRetry(() => api.getData())']
      });
    }

    // Logging function
    if (options.includeLogging) {
      functions.push({
        name: 'logRequest',
        signature: 'logRequest(request: APIRequest): void',
        description: 'Log API request details',
        parameters: [],
        returnType: 'void',
        implementation: `console.log(\`[API] \${request.method} \${request.url}\`, {
  params: request.params,
  body: request.body
});`,
        examples: ['logRequest({ method: "GET", url: "/users" })']
      });
    }

    return functions;
  }

  /**
   * Generate SDK files
   */
  private async generateSDKFiles(
    spec: APISpec,
    language: Language,
    options: SDKOptions
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const sdkName = options.sdkName || spec.name;

    // Main client file
    files.push({
      path: `${this.toFileName(sdkName, language)}`,
      content: this.generateClientFile(spec, language, options),
      language
    });

    // Types file
    files.push({
      path: `types${this.getFileExtension(language)}`,
      content: this.generateTypesFile(spec, language, options),
      language
    });

    // Index file
    files.push({
      path: `index${this.getFileExtension(language)}`,
      content: this.generateIndexFile(spec, language, options),
      language
    });

    // Package.json for Node.js
    if (language === Language.TypeScript || language === Language.JavaScript) {
      files.push({
        path: 'package.json',
        content: JSON.stringify(this.generatePackageJson(spec, options), null, 2),
        language: Language.TypeScript
      });
    }

    return files;
  }

  /**
   * Generate client file content
   */
  private generateClientFile(spec: APISpec, language: Language, options: SDKOptions): string {
    const sdkName = options.sdkName || spec.name;

    if (language === Language.TypeScript) {
      return `import { ApiConfig, ApiResponse } from './types';

export class ${sdkName}Client {
  private baseURL: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: ApiConfig) {
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const url = \`\${this.baseURL}\${path}\`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { Authorization: \`Bearer \${this.apiKey}\` })
    };

    const response = await fetch(url, {
      method,
      headers,
      ...options
    });

    if (!response.ok) {
      throw new Error(\`API Error: \${response.status}\`);
    }

    return response.json();
  }

${spec.endpoints.map(e => `
  async ${this.getMethodName(e)}(${this.getMethodParams(e)}): Promise<ApiResponse<any>> {
    return this.request('${e.method}', '${e.path}'${e.requestBody ? ', { body: JSON.stringify(requestBody) }' : ''});
  }
`).join('\n')}
}`;
    } else if (language === Language.Python) {
      return `import requests
from typing import Dict, Any, Optional
from .types import ApiConfig, ApiResponse

class ${sdkName}Client:
    def __init__(self, config: ApiConfig):
        self.base_url = config.base_url
        self.api_key = config.api_key
        self.timeout = config.timeout or 30
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        session = requests.Session()
        if self.api_key:
            session.headers.update({'Authorization': f'Bearer {self.api_key}'})
        return session

${spec.endpoints.map(e => `
    def ${this.pythonifyName(this.getMethodName(e))}(self${this.getMethodParamsPython(e)}):
        """${e.description}"""
        url = f"{self.base_url}${e.path}"
        ${['POST', 'PUT', 'PATCH'].includes(e.method) ? 'response = self.session.' + e.method.toLowerCase() + '(url, json=request_body)' : 'response = self.session.' + e.method.toLowerCase() + '(url)'}
        response.raise_for_status()
        return response.json()
`).join('\n')}
`;
    }

    return `// SDK client for ${sdkName}`;
  }

  /**
   * Generate types file content
   */
  private generateTypesFile(spec: APISpec, language: Language, options: SDKOptions): string {
    if (language === Language.TypeScript) {
      return `export interface ApiConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

${spec.endpoints.map(e => {
  const requestTypeName = this.getRequestTypeName(e);
  return `export interface ${requestTypeName} {
  // Request body for ${e.method} ${e.path}
}`;
}).join('\n\n')}`;
    } else if (language === Language.Python) {
      return `from typing import Dict, Any, Optional

class ApiConfig:
    base_url: str
    api_key: Optional[str] = None
    timeout: int = 30

class ApiResponse(Dict[str, Any]):
    data: Any
    status: int
    headers: Dict[str, str]
`;
    }

    return `// Types for SDK`;
  }

  /**
   * Generate index file content
   */
  private generateIndexFile(spec: APISpec, language: Language, options: SDKOptions): string {
    const sdkName = options.sdkName || spec.name;

    if (language === Language.TypeScript) {
      return `export { ${sdkName}Client } from './${this.toFileName(sdkName, language).replace(/\.(ts|js)$/, '')}';
export * from './types';
`;
    } else if (language === Language.Python) {
      return `from .client import ${sdkName}Client
from .types import ApiConfig, ApiResponse

__all__ = ['${sdkName}Client', 'ApiConfig', 'ApiResponse']
`;
    }

    return `// Export main SDK components`;
  }

  /**
   * Generate package.json for Node.js SDK
   */
  private generatePackageJson(spec: APISpec, options: SDKOptions): Record<string, unknown> {
    const sdkName = (options.sdkName || spec.name).toLowerCase();

    return {
      name: sdkName,
      version: spec.version,
      description: `SDK for ${spec.name} API`,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        test: 'jest',
        lint: 'eslint src'
      },
      dependencies: {},
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0'
      }
    };
  }

  /**
   * Generate examples
   */
  private generateExamples(spec: APISpec, language: Language, options: SDKOptions): CodeExample[] {
    const examples: CodeExample[] = [];
    const sdkName = options.sdkName || spec.name;

    if (language === Language.TypeScript) {
      examples.push({
        title: 'Initialize Client',
        description: 'Create an instance of the SDK client',
        code: `import { ${sdkName}Client } from '${sdkName.toLowerCase()}';

const client = new ${sdkName}Client({
  baseURL: 'https://api.example.com',
  apiKey: 'your-api-key'
});`,
        language: Language.TypeScript
      });

      for (const endpoint of spec.endpoints.slice(0, 2)) {
        examples.push({
          title: `${endpoint.method} ${endpoint.path}`,
          description: endpoint.description,
          code: `const result = await client.${this.getMethodName(endpoint)}();`,
          language: Language.TypeScript
        });
      }
    } else if (language === Language.Python) {
      examples.push({
        title: 'Initialize Client',
        description: 'Create an instance of the SDK client',
        code: `from ${sdkName.toLowerCase()} import ${sdkName}Client

client = ${sdkName}Client(
    base_url="https://api.example.com",
    api_key="your-api-key"
)`,
        language: Language.Python
      });
    }

    return examples;
  }

  /**
   * Generate SDK documentation
   */
  private generateSDKDocumentation(spec: APISpec, language: Language): string {
    return `# ${spec.name} SDK

## Installation

\`\`\`bash
npm install ${spec.name.toLowerCase()}
\`\`\`

## Usage

\`\`\`${language === Language.TypeScript ? 'typescript' : 'python'}
import type { ${spec.name}Client } from '${spec.name.toLowerCase()}';

const client = new ${spec.name}Client({
  baseURL: '${spec.baseUrl}',
  apiKey: 'your-api-key'
});
\`\`\`

## API Reference

${spec.endpoints.map(e => `### ${e.method} ${e.path}

${e.description}`).join('\n\n')}
`;
  }

  /**
   * Get request type name
   */
  private getRequestTypeName(endpoint: any): string {
    return `${endpoint.name}Request`;
  }

  /**
   * Get response type name
   */
  private getResponseTypeName(endpoint: any, statusCode: number): string {
    return `${endpoint.name}Response`;
  }

  /**
   * Get method name
   */
  private getMethodName(endpoint: any): string {
    return endpoint.name
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .toLowerCase()
      .split(' ')
      .map((word: string, i: number) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  /**
   * Get method parameters
   */
  private getMethodParameters(endpoint: any): any[] {
    const params: any[] = [];

    if (endpoint.parameters) {
      params.push(...endpoint.parameters.map((p: any) => ({
        name: p.name,
        type: 'string',
        description: p.description
      })));
    }

    if (endpoint.requestBody) {
      params.push({
        name: 'requestBody',
        type: this.getRequestTypeName(endpoint),
        description: endpoint.requestBody.description
      });
    }

    return params;
  }

  /**
   * Get method return type
   */
  private getMethodReturnType(endpoint: any): string {
    return `Promise<${this.getResponseTypeName(endpoint, 200)}>`;
  }

  /**
   * Generate method implementation
   */
  private generateMethodImplementation(endpoint: any, spec: APISpec, language: Language): string {
    return `// Implementation for ${endpoint.method} ${endpoint.path}`;
  }

  /**
   * Generate type definition
   */
  private generateTypeDefinition(schema: any, typeName: string, language: Language): string {
    if (language === Language.TypeScript) {
      return `export interface ${typeName} {
  // Type definition
}`;
    }
    return `// Type ${typeName}`;
  }

  /**
   * Get method params as string
   */
  private getMethodParams(endpoint: any): string {
    const params: string[] = [];

    if (endpoint.requestBody) {
      params.push(`requestBody: ${this.getRequestTypeName(endpoint)}`);
    }

    return params.join(', ');
  }

  /**
   * Get method params for Python
   */
  private getMethodParamsPython(endpoint: any): string {
    const params: string[] = ['self'];

    if (endpoint.requestBody) {
      params.push(`request_body: Dict[str, Any] = None`);
    }

    return params.join(', ');
  }

  /**
   * Convert to file name
   */
  private toFileName(name: string, language: Language): string {
    const base = name.replace(/([A-Z])/g, '-$1').toLowerCase();
    return `${base}${this.getFileExtension(language)}`;
  }

  /**
   * Get file extension for language
   */
  private getFileExtension(language: Language): string {
    const extensions: Record<string, string> = {
      [Language.TypeScript]: '.ts',
      [Language.JavaScript]: '.js',
      [Language.Python]: '.py',
      [Language.Go]: '.go',
      [Language.Rust]: '.rs',
      [Language.Java]: '.java',
      [Language.CSharp]: '.cs',
      [Language.Cpp]: '.cpp',
      [Language.PHP]: '.php',
      [Language.Ruby]: '.rb'
    };

    return extensions[language] || '.txt';
  }

  /**
   * Python-ify name
   */
  private pythonifyName(name: string): string {
    return name.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}
