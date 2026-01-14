/**
 * Documenter Agent Durable Object
 *
 * Generates documentation for code:
 * - Code documentation
 * - API documentation
 * - README generation
 * - Inline comments
 * - Architecture docs
 */

import type { AgentCapability } from '../lib/agents/types';

export interface DocumenterEnv {
  DOCUMENTER_DO: DurableObjectNamespace;
  AGENT_REGISTRY: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * Documenter agent state
 */
interface DocumenterState {
  documentsGenerated: number;
  linesDocumented: number;
  apisDocumented: number;
  load: number;
}

/**
 * Documenter Agent - Documentation generation
 *
 * Features:
 * - Code documentation
 * - API documentation
 * - README generation
 * - Inline comment suggestions
 * - Architecture documentation
 */
export class DocumenterAgent implements DurableObject {
  private state: DurableObjectState;
  private env: DocumenterEnv;
  private storage: DurableObjectStorage;
  private documenterState: DocumenterState;

  constructor(state: DurableObjectState, env: DocumenterEnv) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;

    this.documenterState = {
      documentsGenerated: 0,
      linesDocumented: 0,
      apisDocumented: 0,
      load: 0,
    };

    this.initializeFromStorage();
  }

  /**
   * Fetch handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/document') {
        return this.handleDocument(request);
      }

      if (method === 'POST' && path === '/readme') {
        return this.handleGenerateReadme(request);
      }

      if (method === 'POST' && path === '/api-docs') {
        return this.handleGenerateApiDocs(request);
      }

      if (method === 'GET' && path === '/state') {
        return this.handleGetState();
      }

      if (method === 'GET' && path === '/capabilities') {
        return this.handleGetCapabilities();
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle document request
   */
  private async handleDocument(request: Request): Promise<Response> {
    this.documenterState.load = Math.min(1, this.documenterState.load + 0.1);

    try {
      const body = await request.json() as {
        code: string;
        format?: 'jsdoc' | 'typescript' | 'markdown';
      };

      const documentation = await this.generateDocumentation(body);

      this.documenterState.documentsGenerated++;
      this.documenterState.linesDocumented += documentation.lines;

      await this.persistState();

      return new Response(
        JSON.stringify({
          documentation,
          documenterId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.documenterState.load = Math.max(0, this.documenterState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle generate README
   */
  private async handleGenerateReadme(request: Request): Promise<Response> {
    this.documenterState.load = Math.min(1, this.documenterState.load + 0.1);

    try {
      const body = await request.json() as {
        codebase: Record<string, string>;
        projectName?: string;
        description?: string;
      };

      const readme = await this.generateReadme(body);

      this.documenterState.documentsGenerated++;

      await this.persistState();

      return new Response(
        JSON.stringify({
          readme,
          documenterId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.documenterState.load = Math.max(0, this.documenterState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle generate API docs
   */
  private async handleGenerateApiDocs(request: Request): Promise<Response> {
    this.documenterState.load = Math.min(1, this.documenterState.load + 0.1);

    try {
      const body = await request.json() as {
        codebase: Record<string, string>;
        format?: 'openapi' | 'markdown' | 'typescript';
      };

      const apiDocs = await this.generateApiDocs(body);

      this.documenterState.documentsGenerated++;
      this.documenterState.apisDocumented += apiDocs.endpoints.length;

      await this.persistState();

      return new Response(
        JSON.stringify({
          apiDocs,
          documenterId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.documenterState.load = Math.max(0, this.documenterState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle get state
   */
  private async handleGetState(): Promise<Response> {
    return new Response(
      JSON.stringify(this.documenterState),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get capabilities
   */
  private async handleGetCapabilities(): Promise<Response> {
    const capabilities: AgentCapability[] = [
      {
        name: 'documenter',
        version: '1.0.0',
        description: 'Generates documentation for code',
        expertise: ['documentation', 'writing'],
        features: [
          'code-documentation',
          'api-documentation',
          'readme-generation',
          'inline-comments',
          'architecture-docs',
        ],
      },
    ];

    return new Response(
      JSON.stringify({ capabilities }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Generate code documentation
   */
  private async generateDocumentation(request: {
    code: string;
    format?: 'jsdoc' | 'typescript' | 'markdown';
  }): Promise<{
    documentation: string;
    format: string;
    lines: number;
  }> {
    const { code, format = 'jsdoc' } = request;

    let documentation = '';
    let lines = 0;

    // Extract functions and classes
    const functions = code.matchAll(
      /(?:export\s+)?(?:async\s+)?(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)|(?:class\s+\w+)/g
    );

    for (const match of functions) {
      const funcStart = code.indexOf(match[0]);
      const funcEnd = code.indexOf('\n', funcStart) + 1;
      const funcCode = code.substring(funcStart, funcEnd);

      const docs = this.generateFunctionDocs(funcCode, format);
      documentation += docs + '\n\n';
      lines++;
    }

    return {
      documentation,
      format,
      lines,
    };
  }

  /**
   * Generate function documentation
   */
  private generateFunctionDocs(functionCode: string, format: string): string {
    // Extract function name
    const nameMatch = functionCode.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|class\s+(\w+))/);
    const name = nameMatch ? (nameMatch[1] || nameMatch[2] || nameMatch[3]) : 'unknown';

    // Extract parameters
    const paramsMatch = functionCode.match(/\(([^)]*)\)/);
    const params = paramsMatch ? paramsMatch[1].split(',').map((p) => p.trim()) : [];

    if (format === 'jsdoc') {
      let docs = `/**\n`;
      docs += ` * ${this.capitalize(name)} - \n`;
      docs += ` *\n`;

      for (const param of params) {
        if (param) {
          docs += ` * @param {${this.inferType(param)}} ${param} - \n`;
        }
      }

      docs += ` * @returns {${this.inferReturnType(functionCode)}} - \n`;
      docs += ` */`;

      return docs;
    } else if (format === 'typescript') {
      let docs = `/**\n`;
      docs += ` * ${this.capitalize(name)}\n`;
      docs += ` *\n`;

      for (const param of params) {
        if (param) {
          docs += ` * @param ${param} - \n`;
        }
      }

      docs += ` */`;

      return docs;
    } else {
      return `## ${this.capitalize(name)}\n\n### Parameters\n\n${
        params.map((p) => `- \`${p}\``).join('\n')
      }\n\n### Returns\n\n-`;
    }
  }

  /**
   * Infer type from parameter name
   */
  private inferType(param: string): string {
    if (param.includes('[') || param.includes(']')) return 'Array';
    if (param.startsWith('is') || param.startsWith('has')) return 'boolean';
    if (param.includes('Count') || param.includes('Index')) return 'number';
    if (param.includes('Id')) return 'string';
    return 'any';
  }

  /**
   * Infer return type
   */
  private inferReturnType(functionCode: string): string {
    if (functionCode.includes('return')) {
      if (functionCode.includes('return [')) return 'Array';
      if (functionCode.includes('return {')) return 'Object';
      if (functionCode.includes('return true') || functionCode.includes('return false')) return 'boolean';
      if (functionCode.match(/return\s+\d+/)) return 'number';
      if (functionCode.match(/return\s*['"]/)) return 'string';
    }
    return 'void';
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Generate README
   */
  private async generateReadme(request: {
    codebase: Record<string, string>;
    projectName?: string;
    description?: string;
  }): Promise<string> {
    const { codebase, projectName = 'Project', description = 'A software project' } = request;

    let readme = `# ${projectName}\n\n`;
    readme += `${description}\n\n`;

    readme += `## Installation\n\n`;
    readme += `\\\`\\\`\\\`bash\nnpm install\n\\\`\\\`\\\`\n\n`;

    readme += `## Usage\n\n`;
    readme += `\\\`\\\`\\\`typescript\n`;
    readme += `import { something } from './src';\n\n`;
    readme += `// Your code here\n`;
    readme += `\\\`\\\`\\\`\n\n`;

    readme += `## Project Structure\n\n`;
    readme += `| Path | Description |\n`;
    readme += `|------|-------------|\n`;

    for (const [filePath, content] of Object.entries(codebase)) {
      const description = this.guessFileDescription(filePath, content);
      readme += `| \`${filePath}\` | ${description} |\n`;
    }

    readme += `\n## License\n\nMIT\n`;

    return readme;
  }

  /**
   * Guess file description
   */
  private guessFileDescription(filePath: string, content: string): string {
    const parts = filePath.split('/');

    if (parts.includes('test') || parts.includes('__tests__')) {
      return 'Test file';
    }

    if (parts.includes('types')) {
      return 'Type definitions';
    }

    if (parts.includes('utils') || parts.includes('helpers')) {
      return 'Utility functions';
    }

    if (content.includes('export function')) {
      return 'Functions and utilities';
    }

    if (content.includes('export class')) {
      return 'Class definitions';
    }

    if (content.includes('export const') || content.includes('export let')) {
      return 'Constants and variables';
    }

    return 'Source code';
  }

  /**
   * Generate API documentation
   */
  private async generateApiDocs(request: {
    codebase: Record<string, string>;
    format?: 'openapi' | 'markdown' | 'typescript';
  }): Promise<{
    endpoints: Array<{
      path: string;
      method: string;
      description: string;
      parameters: Array<{ name: string; type: string; required: boolean }>;
      responses: Record<string, string>;
    }>;
    documentation: string;
  }> {
    const { codebase, format = 'markdown' } = request;

    const endpoints: typeof apiDocsResult.endpoints = [];

    // Find API endpoint definitions
    for (const [filePath, content] of Object.entries(codebase)) {
      const routes = content.matchAll(/(?:app\.)?(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g);

      for (const match of routes) {
        const method = match[1];
        const path = match[2];

        endpoints.push({
          path,
          method: method.toUpperCase(),
          description: `${method.toUpperCase()} ${path} endpoint`,
          parameters: [],
          responses: {
            '200': 'Success',
            '400': 'Bad Request',
            '500': 'Server Error',
          },
        });
      }
    }

    let documentation = '';

    if (format === 'markdown') {
      documentation = '# API Documentation\n\n';

      for (const endpoint of endpoints) {
        documentation += `## ${endpoint.method} ${endpoint.path}\n\n`;
        documentation += `${endpoint.description}\n\n`;

        if (endpoint.parameters.length > 0) {
          documentation += '### Parameters\n\n';
          documentation += '| Name | Type | Required |\n';
          documentation += '|------|------|----------|\n';

          for (const param of endpoint.parameters) {
            documentation += `| ${param.name} | ${param.type} | ${param.required ? 'Yes' : 'No'} |\n`;
          }

          documentation += '\n';
        }

        documentation += '### Responses\n\n';
        for (const [code, description] of Object.entries(endpoint.responses)) {
          documentation += `- **${code}**: ${description}\n`;
        }

        documentation += '\n';
      }
    }

    return {
      endpoints,
      documentation,
    };
  }

  /**
   * Initialize from storage
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.get<DocumenterState>('documenterState');

      if (stored) {
        this.documenterState = stored;
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  /**
   * Persist state
   */
  private async persistState(): Promise<void> {
    try {
      await this.storage.put('documenterState', this.documenterState);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  /**
   * Alarm handler
   */
  async alarm(): Promise<void> {
    this.documenterState.load = Math.max(0, this.documenterState.load * 0.9);
    await this.persistState();
  }
}
