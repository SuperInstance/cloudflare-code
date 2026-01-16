/**
 * API Client Generator
 * Generates API clients from OpenAPI/Swagger/GraphQL specifications
 */

import { Language } from '../types/index.js';
import type { APIClientOptions, GeneratedAPIClient, GeneratedFile, GeneratedType, GeneratedMethod, APISpec, Endpoint, JSONSchema } from '../types/index.js';
import { FileManager } from '../utils/file-manager.js';
import { TemplateEngine } from '../templates/engine.js';

/**
 * API Client Generator class
 */
export class APIClientGenerator {
  private fileManager: FileManager;
  private _templateEngine: TemplateEngine;

  constructor() {
    this.fileManager = new FileManager();
    this._templateEngine = new TemplateEngine();
  }

  /**
   * Generate API client from specification
   */
  async generate(options: APIClientOptions): Promise<GeneratedAPIClient> {
    const spec = options.spec;

    // Generate TypeScript types
    const types = this.generateTypes(spec, options);

    // Generate client methods
    const methods = this.generateClientMethods(spec, options);

    // Generate client class
    const clientCode = this.generateClientClass(spec, methods, options);

    // Generate mocks if requested
    const mocks = options.generateMocks ? this.generateMocks(spec) : [];

    // Create files
    const files = await this.createClientFiles(spec, clientCode, types, methods, options);

    return {
      name: options.clientName || `${spec.name}Client`,
      files,
      types,
      methods,
      mocks
    };
  }

  /**
   * Generate TypeScript types from API spec
   */
  private generateTypes(spec: APISpec, options: APIClientOptions): GeneratedType[] {
    const types: GeneratedType[] = [];

    // Generate types for each endpoint's request/response
    for (const endpoint of spec.endpoints) {
      // Request body type
      if (endpoint.requestBody) {
        const typeName = this.getTypeName(endpoint, 'Request');
        const typeDef = this.generateTypeFromSchema(endpoint.requestBody.schema, typeName, options.language);
        types.push({
          name: typeName,
          definition: typeDef,
          description: endpoint.requestBody.description,
          usage: `Used for ${endpoint.method} ${endpoint.path} requests`
        });
      }

      // Response types
      for (const response of endpoint.responses) {
        if (response.schema) {
          const typeName = this.getTypeName(endpoint, 'Response', response.statusCode);
          const typeDef = this.generateTypeFromSchema(response.schema, typeName, options.language);
          types.push({
            name: typeName,
            definition: typeDef,
            description: response.description
          });
        }
      }
    }

    // Generate parameter types
    for (const endpoint of spec.endpoints) {
      if (endpoint.parameters && endpoint.parameters.length > 0) {
        const typeName = this.getTypeName(endpoint, 'Params');
        const typeDef = this.generateParamsType(endpoint, typeName, options.language);
        types.push({
          name: typeName,
          definition: typeDef,
          description: `Parameters for ${endpoint.method} ${endpoint.path}`
        });
      }
    }

    return types;
  }

  /**
   * Generate client methods
   */
  private generateClientMethods(spec: APISpec, options: APIClientOptions): GeneratedMethod[] {
    const methods: GeneratedMethod[] = [];

    for (const endpoint of spec.endpoints) {
      const methodName = this.getMethodName(endpoint);
      const parameters = this.getMethodParameters(endpoint);
      const returnType = this.getReturnType(endpoint);

      const implementation = this.generateMethodImplementation(endpoint, spec, options);

      methods.push({
        name: methodName,
        signature: this.getMethodSignature(methodName, parameters, returnType, options.language),
        description: endpoint.description,
        parameters,
        returnType,
        implementation,
        examples: this.generateMethodExamples(endpoint, spec)
      });
    }

    return methods;
  }

  /**
   * Generate client class
   */
  private generateClientClass(
    spec: APISpec,
    methods: GeneratedMethod[],
    options: APIClientOptions
  ): string {
    const className = options.clientName || `${spec.name}Client`;

    if (options.language === Language.TypeScript) {
      return this.generateTypeScriptClientClass(spec, className, methods, options);
    } else if (options.language === Language.JavaScript) {
      return this.generateJavaScriptClientClass(spec, className, methods, options);
    } else if (options.language === Language.Python) {
      return this.generatePythonClientClass(spec, className, methods, options);
    } else if (options.language === Language.Go) {
      return this.generateGoClientClass(spec, className, methods, options);
    }

    throw new Error(`Unsupported language: ${options.language}`);
  }

  /**
   * Generate TypeScript client class
   */
  private generateTypeScriptClientClass(
    spec: APISpec,
    className: string,
    methods: GeneratedMethod[],
    options: APIClientOptions
  ): string {
    const imports = this.generateTypeScriptImports(spec, options);
    const classDeclaration = `export class ${className} {`;

    const constructorCode = `  private baseURL: string;
  private apiKey?: string;
  private axiosInstance: any;

  constructor(config: { baseURL: string; apiKey?: string; timeout?: number }) {
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.axiosInstance = this.createAxiosInstance();
  }

  private createAxiosInstance() {
    const axios = require('axios');
    const instance = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 30000,
      headers: this.apiKey ? { Authorization: \`Bearer \${this.apiKey}\` } : {}
    });

    instance.interceptors.response.use(
      (response: any) => response.data,
      (error: any) => {
        throw new Error(\`API Error: \${error.response?.data?.message || error.message}\`);
      }
    );

    return instance;
  }`;

    const methodsCode = methods.map(m => `

  ${m.signature} {
    ${m.implementation}
  }`).join('\n');

    return `${imports}

${classDeclaration}
${constructorCode}
${methodsCode}
}`;
  }

  /**
   * Generate JavaScript client class
   */
  private generateJavaScriptClientClass(
    spec: APISpec,
    className: string,
    methods: GeneratedMethod[],
    options: APIClientOptions
  ): string {
    // Similar to TypeScript but without type annotations
    return this.generateTypeScriptClientClass(spec, className, methods, options)
      .replace(/: \w+/g, '')
      .replace(/export class/, 'class')
      .replace(/: any/g, '')
      .replace(/: string/g, '');
  }

  /**
   * Generate Python client class
   */
  private generatePythonClientClass(
    spec: APISpec,
    className: string,
    methods: GeneratedMethod[],
    _options: APIClientOptions
  ): string {
    const classDeclaration = `class ${className}:`;

    const constructorCode = `    def __init__(self, base_url: str, api_key: str = None, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.session = self._create_session()

    def _create_session(self) -> 'requests.Session':
        import requests
        session = requests.Session()
        if self.api_key:
            session.headers.update({'Authorization': f'Bearer {self.api_key}'})
        return session`;

    const methodsCode = methods.map(m => `
    ${this.pythonifyMethodSignature(m.signature)}:
        """${m.description}"""
        ${this.pythonifyImplementation(m.implementation)}
`).join('\n');

    return `import requests
from typing import Optional, Dict, Any

${classDeclaration}
${constructorCode}
${methodsCode}
`;
  }

  /**
   * Generate Go client class
   */
  private generateGoClientClass(
    spec: APISpec,
    clientName: string,
    methods: GeneratedMethod[],
    _options: APIClientOptions
  ): string {
    return `package ${clientName.toLowerCase()}

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type ${clientName} struct {
    baseURL    string
    apiKey     string
    httpClient *http.Client
}

func New${clientName}(baseURL, apiKey string) *${clientName} {
    return &${clientName}{
        baseURL: baseURL,
        apiKey:  apiKey,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

${methods.map(m => this.goifyMethod(m)).join('\n\n')}
`;
  }

  /**
   * Generate TypeScript imports
   */
  private generateTypeScriptImports(spec: APISpec, options: APIClientOptions): string {
    let imports = "import axios from 'axios';\n";

    if (options.axios) {
      imports = "import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';\n";
    } else if (options.fetch) {
      imports = '';
    }

    return imports;
  }

  /**
   * Generate type from JSON schema
   */
  private generateTypeFromSchema(schema: JSONSchema, typeName: string, language: Language): string {
    if (language === Language.TypeScript || language === Language.JavaScript) {
      return this.generateTypeScriptType(schema, typeName);
    } else if (language === Language.Python) {
      return this.generatePythonType(schema, typeName);
    } else if (language === Language.Go) {
      return this.generateGoType(schema, typeName);
    }

    return `// Type for ${typeName}`;
  }

  /**
   * Generate TypeScript type
   */
  private generateTypeScriptType(schema: JSONSchema, typeName: string): string {
    let typeDef = `export interface ${typeName} {\n`;

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const prop = propSchema as JSONSchema;
        const required = schema.required?.includes(propName) ? '' : '?';
        const propType = this.getJSONSchemaType(prop);
        typeDef += `  ${propName}${required}: ${propType};\n`;
      }
    }

    typeDef += '}';
    return typeDef;
  }

  /**
   * Generate Python type
   */
  private generatePythonType(schema: JSONSchema, typeName: string): string {
    let typeDef = `class ${typeName}(TypedDict):\n`;

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const prop = propSchema as JSONSchema;
        const propType = this.getJSONSchemaPythonType(prop);
        const optional = schema.required?.includes(propName) ? '' : ' = None';
        typeDef += `    ${propName}: ${propType}${optional}\n`;
      }
    }

    return typeDef;
  }

  /**
   * Generate Go type
   */
  private generateGoType(schema: JSONSchema, typeName: string): string {
    let typeDef = `type ${typeName} struct {\n`;

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const prop = propSchema as JSONSchema;
        const propType = this.getJSONSchemaGoType(prop);
        const jsonTag = `json:"${propName}"`
        typeDef += `    ${this.capitalize(propName)} ${propType} \`${jsonTag}\`\n`;
      }
    }

    typeDef += '}';
    return typeDef;
  }

  /**
   * Get JSON schema type for TypeScript
   */
  private getJSONSchemaType(schema: JSONSchema): string {
    if (schema.type === 'string') return 'string';
    if (schema.type === 'number' || schema.type === 'integer') return 'number';
    if (schema.type === 'boolean') return 'boolean';
    if (schema.type === 'array') {
      const itemType = schema.items ? this.getJSONSchemaType(schema.items as JSONSchema) : 'any';
      return `${itemType}[]`;
    }
    if (schema.type === 'object') {
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        return 'Record<string, any>';
      }
      return 'Record<string, unknown>';
    }
    return 'unknown';
  }

  /**
   * Get JSON schema type for Python
   */
  private getJSONSchemaPythonType(schema: JSONSchema): string {
    if (schema.type === 'string') return 'str';
    if (schema.type === 'number' || schema.type === 'integer') return 'float';
    if (schema.type === 'boolean') return 'bool';
    if (schema.type === 'array') {
      const itemType = schema.items ? this.getJSONSchemaPythonType(schema.items as JSONSchema) : 'Any';
      return `List[${itemType}]`;
    }
    if (schema.type === 'object') return 'Dict[str, Any]';
    return 'Any';
  }

  /**
   * Get JSON schema type for Go
   */
  private getJSONSchemaGoType(schema: JSONSchema): string {
    if (schema.type === 'string') return 'string';
    if (schema.type === 'number') return 'float64';
    if (schema.type === 'integer') return 'int';
    if (schema.type === 'boolean') return 'bool';
    if (schema.type === 'array') {
      const itemType = schema.items ? this.getJSONSchemaGoType(schema.items as JSONSchema) : 'interface{}';
      return `[]${itemType}`;
    }
    if (schema.type === 'object') return 'map[string]interface{}';
    return 'interface{}';
  }

  /**
   * Generate parameters type
   */
  private generateParamsType(endpoint: Endpoint, typeName: string, language: Language): string {
    if (language === Language.TypeScript) {
      let typeDef = `export interface ${typeName} {\n`;

      for (const param of endpoint.parameters || []) {
        const optional = !param.required ? '?' : '';
        const paramType = this.getParameterType(param);
        typeDef += `  ${param.name}${optional}: ${paramType};\n`;
      }

      typeDef += '}';
      return typeDef;
    }

    return `// ${typeName}`;
  }

  /**
   * Get parameter type
   */
  private getParameterType(param: any): string {
    if (param.schema && param.schema.type) {
      switch (param.schema.type) {
        case 'string': return 'string';
        case 'number':
        case 'integer': return 'number';
        case 'boolean': return 'boolean';
        case 'array': return 'any[]';
        default: return 'any';
      }
    }
    return 'any';
  }

  /**
   * Generate method implementation
   */
  private generateMethodImplementation(
    endpoint: Endpoint,
    spec: APISpec,
    options: APIClientOptions
  ): string {
    if (options.language === Language.TypeScript || options.language === Language.JavaScript) {
      return this.generateTypeScriptMethodImplementation(endpoint, spec, options);
    } else if (options.language === Language.Python) {
      return this.generatePythonMethodImplementation(endpoint, spec);
    } else if (options.language === Language.Go) {
      return this.generateGoMethodImplementation(endpoint, spec);
    }

    return '// Implementation not available';
  }

  /**
   * Generate TypeScript method implementation
   */
  private generateTypeScriptMethodImplementation(
    endpoint: Endpoint,
    spec: APISpec,
    options: APIClientOptions
  ): string {
    const path = this.buildPath(endpoint);
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);
    const hasParams = endpoint.parameters && endpoint.parameters.length > 0;

    let implementation = `const url = \`${path}\`;\n`;
    implementation += `const config: AxiosRequestConfig = {\n  method: '${endpoint.method}',\n  url,\n`;

    if (hasBody) {
      implementation += `  data: requestBody,\n`;
    }

    if (hasParams) {
      implementation += `  params,\n`;
    }

    implementation += `};\n\n`;
    implementation += `return this.axiosInstance.request(config);`;

    return implementation;
  }

  /**
   * Generate Python method implementation
   */
  private generatePythonMethodImplementation(endpoint: Endpoint, spec: APISpec): string {
    const path = this.buildPath(endpoint);
    const method = endpoint.method.toLowerCase();
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);

    let implementation = `url = f"{self.base_url}${path}"\n`;

    if (hasBody) {
      implementation += `response = self.session.${method}(url, json=request_body, params=params)\n`;
    } else {
      implementation += `response = self.session.${method}(url, params=params)\n`;
    }

    implementation += `response.raise_for_status()\n`;
    implementation += `return response.json()`;

    return implementation;
  }

  /**
   * Generate Go method implementation
   */
  private generateGoMethodImplementation(endpoint: Endpoint, spec: APISpec): string {
    // Simplified Go implementation
    return `// Go implementation for ${endpoint.method} ${endpoint.path}`;
  }

  /**
   * Generate method examples
   */
  private generateMethodExamples(endpoint: Endpoint, spec: APISpec): string[] {
    const examples: string[] = [];

    // TypeScript example
    examples.push(`// ${endpoint.method} ${endpoint.path}`);
    examples.push(`const result = await client.${this.getMethodName(endpoint)}(`);

    if (endpoint.parameters && endpoint.parameters.length > 0) {
      examples.push(`  { ${endpoint.parameters.map(p => `${p.name}: 'value'`).join(', ')} }`);
    }

    examples.push(`);`);

    return examples;
  }

  /**
   * Build path with parameter interpolation
   */
  private buildPath(endpoint: Endpoint): string {
    let path = endpoint.path;

    // Replace path parameters
    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        if (param.location === 'path') {
          path = path.replace(`{${param.name}}`, `\${${param.name}}`);
        }
      }
    }

    return path;
  }

  /**
   * Generate method signature
   */
  private getMethodSignature(
    methodName: string,
    parameters: any[],
    returnType: string,
    language: Language
  ): string {
    if (language === Language.TypeScript) {
      const params = parameters.map(p => `${p.name}: ${p.type}`).join(', ');
      return `async ${methodName}(${params}): Promise<${returnType}>`;
    } else if (language === Language.JavaScript) {
      const params = parameters.map(p => p.name).join(', ');
      return `async ${methodName}(${params})`;
    } else if (language === Language.Python) {
      const params = parameters.map(p => `${p.name}: ${p.type} = None`).join(', ');
      return `async def ${methodName}(self${params.length ? ', ' + params : ''}) -> Dict[str, Any]`;
    } else if (language === Language.Go) {
      return `func (c *Client) ${methodName}(params map[string]string) (map[string]interface{}, error)`;
    }

    return `${methodName}(${parameters.join(', ')})`;
  }

  /**
   * Get method name from endpoint
   */
  private getMethodName(endpoint: Endpoint): string {
    const operationName = endpoint.name
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .split(' ')
      .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    return operationName || endpoint.method.toLowerCase();
  }

  /**
   * Get type name for endpoint
   */
  private getTypeName(endpoint: Endpoint, suffix: string, statusCode?: number): string {
    const baseName = endpoint.name
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    const statusCodeSuffix = statusCode ? `${statusCode}` : '';
    return `${baseName}${suffix}${statusCodeSuffix}`;
  }

  /**
   * Get method parameters from endpoint
   */
  private getMethodParameters(endpoint: Endpoint): any[] {
    const parameters: any[] = [];

    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        parameters.push({
          name: param.name,
          type: this.getParameterType(param),
          description: param.description
        });
      }
    }

    if (endpoint.requestBody) {
      parameters.push({
        name: 'requestBody',
        type: this.getTypeName(endpoint, 'Request'),
        description: endpoint.requestBody.description
      });
    }

    return parameters;
  }

  /**
   * Get return type for endpoint
   */
  private getReturnType(endpoint: Endpoint): string {
    const successResponse = endpoint.responses.find(r => r.statusCode >= 200 && r.statusCode < 300);
    if (successResponse && successResponse.schema) {
      return this.getTypeName(endpoint, 'Response', successResponse.statusCode);
    }
    return 'any';
  }

  /**
   * Generate mocks for API endpoints
   */
  private generateMocks(spec: APISpec): any[] {
    const mocks: any[] = [];

    for (const endpoint of spec.endpoints) {
      const successResponse = endpoint.responses.find(r => r.statusCode >= 200 && r.statusCode < 300);
      if (successResponse) {
        mocks.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          response: successResponse.examples || {},
          delay: 100,
          scenario: 'success'
        });
      }
    }

    return mocks;
  }

  /**
   * Create client files
   */
  private async createClientFiles(
    spec: APISpec,
    clientCode: string,
    types: GeneratedType[],
    methods: GeneratedMethod[],
    options: APIClientOptions
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Main client file
    const clientFile = options.language === Language.TypeScript
      ? `${options.clientName || spec.name}.ts`
      : `${options.clientName || spec.name}.js`;

    files.push({
      path: clientFile,
      content: clientCode,
      language: options.language
    });

    // Types file
    if (types.length > 0 && options.generateTypes) {
      const typesCode = types.map(t => t.definition).join('\n\n');
      files.push({
        path: 'types.ts',
        content: typesCode,
        language: options.language
      });
    }

    // Index file
    const indexCode = this.generateIndexFile(spec, clientFile, options);
    files.push({
      path: 'index.ts',
      content: indexCode,
      language: options.language
    });

    return files;
  }

  /**
   * Generate index file
   */
  private generateIndexFile(spec: APISpec, clientFile: string, options: APIClientOptions): string {
    const clientName = options.clientName || spec.name;
    return `export { ${clientName} } from './${clientFile.replace(/\.(ts|js)$/, '')}';
`;
  }

  /**
   * Python-ify method signature
   */
  private pythonifyMethodSignature(signature: string): string {
    return signature
      .replace(/async (\w+)\(([^)]*)\): Promise<[^>]+>/, 'def $1(self$2):')
      .replace(/: (\w+)/g, ': "$1"');
  }

  /**
   * Python-ify implementation
   */
  private pythonifyImplementation(implementation: string): string {
    return implementation
      .replace(/const /g, '')
      .replace(/this\./g, 'self.')
      .replace(/\${/g, '{');
  }

  /**
   * Go-ify method
   */
  private goifyMethod(method: GeneratedMethod): string {
    return `func (c *Client) ${method.name}() {
    // TODO: Implement ${method.name}
}`;
  }

  /**
   * Capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
