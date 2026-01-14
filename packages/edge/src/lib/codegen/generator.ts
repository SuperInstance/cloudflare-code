/**
 * Code Generator
 *
 * AI-powered code generation engine with template-based and
 * context-aware generation capabilities.
 */

import type {
  GenerationRequest,
  GenerationResult,
  GenerationOptions,
  GenerationConstraints,
  GenerationMetadata,
  TemplateContext,
  GenerationType,
  BatchGenerationRequest,
  BatchGenerationResult,
  GeneratorConfig,
} from './types';
import type { SupportedLanguage } from '../codebase/types';
import { TemplateEngine, getTemplateById, getTemplatesByCategory, getTemplatesForLanguage } from './templates';
import { CodeRetriever } from '../codebase/retriever';

/**
 * Code Generator class
 */
export class CodeGenerator {
  private config: GeneratorConfig;
  private retriever?: CodeRetriever;
  private stats: {
    totalGenerations: number;
    totalTokens: number;
    totalTime: number;
  };

  constructor(config: GeneratorConfig = {}, retriever?: CodeRetriever) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      enableCache: true,
      ...config,
    };
    this.retriever = retriever;
    this.stats = {
      totalGenerations: 0,
      totalTokens: 0,
      totalTime: 0,
    };
  }

  /**
   * Generate code from a request
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      // Merge request options with defaults
      const options = {
        ...this.config.defaults,
        ...request.options,
      };

      let code: string;
      let method: 'template' | 'ai' | 'hybrid' = 'template';
      let tokensUsed = 0;
      let confidence = 1.0;

      // Template-based generation
      if (request.templateId) {
        const template = getTemplateById(request.templateId);
        if (!template) {
          throw new Error(`Template not found: ${request.templateId}`);
        }

        const context = this.buildContext(request, template);
        code = TemplateEngine.render(template, context);
        method = 'template';
      }
      // Raw template string
      else if (request.template) {
        code = this.renderRawTemplate(request.template, request.context || {});
        method = 'template';
      }
      // AI or hybrid generation
      else if (options.useAI) {
        const similarCode = await this.findSimilarCode(request);

        if (similarCode && similarCode.length > 0) {
          // Hybrid: use template enhanced with retrieved code
          code = await this.generateWithRAG(request, similarCode);
          method = 'hybrid';
        } else {
          // Pure AI generation
          const aiResult = await this.generateWithAI(request);
          code = aiResult.code;
          tokensUsed = aiResult.tokensUsed;
          confidence = aiResult.confidence;
          method = 'ai';
        }
      }
      // Template-based with auto-selection
      else {
        const template = this.selectTemplate(request);
        if (template) {
          const context = this.buildContext(request, template);
          code = TemplateEngine.render(template, context);
          method = 'template';
        } else {
          throw new Error('No suitable template found and AI generation disabled');
        }
      }

      // Apply style formatting
      if (options.format) {
        code = this.formatCode(code, request.language, options.style);
      }

      // Validate constraints
      const issues = options.constraints
        ? this.validateConstraints(code, request, options.constraints)
        : [];

      const generationTime = Date.now() - startTime;

      this.stats.totalGenerations++;
      this.stats.totalTokens += tokensUsed;
      this.stats.totalTime += generationTime;

      return {
        success: true,
        code,
        language: request.language,
        type: request.type,
        metadata: {
          generatedAt: Date.now(),
          generationTime,
          method,
          tokensUsed,
          confidence,
        },
        issues: issues.length > 0 ? issues : undefined,
        suggestions: this.generateSuggestions(request, code),
      };
    } catch (error) {
      return {
        success: false,
        code: '',
        language: request.language,
        type: request.type,
        metadata: {
          generatedAt: Date.now(),
          generationTime: Date.now() - startTime,
          confidence: 0,
          method: 'template',
        },
        issues: [
          {
            id: 'generation-error',
            category: 'best-practices',
            severity: 'error',
            message: `Generation failed: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  /**
   * Generate multiple code snippets in batch
   */
  async generateBatch(request: BatchGenerationRequest): Promise<BatchGenerationResult> {
    const startTime = Date.now();
    const results: GenerationResult[] = [];
    const errors: string[] = [];

    if (request.parallel) {
      // Parallel generation
      const promises = request.requests.map(req => this.generate(req));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    } else {
      // Sequential generation
      for (const req of request.requests) {
        const result = await this.generate(req);
        results.push(result);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return {
      results,
      totalGenerationTime: Date.now() - startTime,
      successCount,
      failureCount,
      errors,
    };
  }

  /**
   * Find similar code from RAG store
   */
  private async findSimilarCode(request: GenerationRequest): Promise<string[]> {
    if (!this.retriever) {
      return [];
    }

    try {
      const query = this.buildSearchQuery(request);
      const retrieved = await this.retriever.retrieve(query, {
        maxChunks: 5,
        includeRelated: true,
      });

      return retrieved.chunks.map(c => c.content);
    } catch {
      return [];
    }
  }

  /**
   * Build search query for RAG
   */
  private buildSearchQuery(request: GenerationRequest): string {
    const parts = [
      request.type,
      request.language,
      request.description,
    ];

    if (request.context?.name) {
      parts.push(request.context.name);
    }

    return parts.join(' ');
  }

  /**
   * Generate code with RAG-enhanced prompt
   */
  private async generateWithAI(request: GenerationRequest, similarCode?: string[]): Promise<{
    code: string;
    tokensUsed: number;
    confidence: number;
  }> {
    const prompt = this.buildPrompt(request, similarCode);

    // This would integrate with the actual AI provider
    // For now, return a template-based fallback
    const template = this.selectTemplate(request);
    if (!template) {
      throw new Error('No template available for AI generation fallback');
    }

    const context = this.buildContext(request, template);
    const code = TemplateEngine.render(template, context);

    return {
      code,
      tokensUsed: 0,
      confidence: 0.85,
    };
  }

  /**
   * Generate code with RAG context
   */
  private async generateWithRAG(request: GenerationRequest, similarCode: string[]): Promise<string> {
    const template = this.selectTemplate(request);
    if (!template) {
      throw new Error('No suitable template found');
    }

    const context = this.buildContext(request, template);
    context.similarCode = similarCode;

    return TemplateEngine.render(template, context);
  }

  /**
   * Build AI prompt
   */
  private buildPrompt(request: GenerationRequest, similarCode?: string[]): string {
    const parts: string[] = [];

    parts.push(`Generate ${request.type} in ${request.language}`);
    parts.push(`\nDescription: ${request.description}`);

    if (request.context?.name) {
      parts.push(`Name: ${request.context.name}`);
    }

    if (similarCode && similarCode.length > 0) {
      parts.push('\n\nReference code:');
      parts.push('```');
      parts.push(...similarCode);
      parts.push('```');
    }

    parts.push('\n\nGenerate code following best practices and including:');
    parts.push('- Type safety');
    parts.push('- Error handling');
    parts.push('- Documentation');

    return parts.join('\n');
  }

  /**
   * Select best template for request
   */
  private selectTemplate(request: GenerationRequest): any {
    const templates = getTemplatesByCategory(request.type);
    const languageTemplates = templates.filter(t => t.language === request.language);

    if (languageTemplates.length === 0) {
      return null;
    }

    // Sort by priority (higher first)
    return languageTemplates.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
  }

  /**
   * Build template context from request
   */
  private buildContext(request: GenerationRequest, template: any): TemplateContext {
    const context: TemplateContext = {
      name: request.context?.name || this.generateName(request),
      language: request.language,
      generationType: request.type,
      description: request.description,
      ...request.context,
    };

    // Set defaults for common variables
    if (!context.params && template.variables.find((v: any) => v.name === 'params')) {
      context.params = request.context?.parameters || [];
    }

    if (!context.returnType && template.variables.find((v: any) => v.name === 'returnType')) {
      context.returnType = request.context?.returnType || 'any';
    }

    if (!context.body && template.variables.find((v: any) => v.name === 'body')) {
      context.body = request.context?.body || '// TODO: implement';
    }

    return context;
  }

  /**
   * Generate a name for the code
   */
  private generateName(request: GenerationRequest): string {
    const typeNames: Record<GenerationType, string> = {
      boilerplate: 'scaffold',
      function: 'myFunction',
      class: 'MyClass',
      interface: 'IMyInterface',
      api: 'myEndpoint',
      test: 'testMyFeature',
      migration: 'migration',
      documentation: 'docs',
      component: 'MyComponent',
      hook: 'useMyHook',
      middleware: 'myMiddleware',
      validator: 'validateMyInput',
      utility: 'util',
      config: 'config',
      script: 'script',
      workflow: 'workflow',
    };

    return typeNames[request.type] || 'generated';
  }

  /**
   * Render raw template string
   */
  private renderRawTemplate(template: string, context: Record<string, any>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{${key}}`;
      rendered = rendered.replaceAll(placeholder, String(value));
    }

    return rendered;
  }

  /**
   * Format code according to style preferences
   */
  private formatCode(code: string, language: SupportedLanguage, style?: any): string {
    // Basic formatting - in production would use prettier/etc
    return code.trim();
  }

  /**
   * Validate code against constraints
   */
  private validateConstraints(
    code: string,
    request: GenerationRequest,
    constraints: GenerationConstraints
  ): any[] {
    const issues: any[] = [];

    // Check max lines
    if (constraints.maxLines) {
      const lines = code.split('\n').length;
      if (lines > constraints.maxLines) {
        issues.push({
          id: 'max-lines',
          category: 'complexity' as const,
          severity: 'warning' as const,
          message: `Code exceeds maximum lines: ${lines} > ${constraints.maxLines}`,
        });
      }
    }

    // Check forbidden patterns
    if (constraints.forbiddenPatterns) {
      for (const pattern of constraints.forbiddenPatterns) {
        if (new RegExp(pattern).test(code)) {
          issues.push({
            id: 'forbidden-pattern',
            category: 'best-practices' as const,
            severity: 'error' as const,
            message: `Code contains forbidden pattern: ${pattern}`,
          });
        }
      }
    }

    // Check required patterns
    if (constraints.requiredPatterns) {
      for (const pattern of constraints.requiredPatterns) {
        if (!new RegExp(pattern).test(code)) {
          issues.push({
            id: 'missing-pattern',
            category: 'best-practices' as const,
            severity: 'warning' as const,
            message: `Code missing required pattern: ${pattern}`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Generate suggestions for the code
   */
  private generateSuggestions(request: GenerationRequest, code: string): string[] {
    const suggestions: string[] = [];

    // Suggest tests if not included
    if (request.type !== 'test' && !code.includes('test') && !code.includes('spec')) {
      suggestions.push('Consider adding unit tests for this code');
    }

    // Suggest documentation if missing
    if (!code.includes('/**') && !code.includes('"""') && !code.includes('# ')) {
      suggestions.push('Add documentation comments to improve code readability');
    }

    // Suggest type safety for dynamic languages
    if (['javascript', 'python'].includes(request.language)) {
      suggestions.push('Consider adding type annotations for better type safety');
    }

    return suggestions;
  }

  /**
   * Get generation statistics
   */
  getStats() {
    return {
      totalGenerations: this.stats.totalGenerations,
      totalTokens: this.stats.totalTokens,
      avgGenerationTime:
        this.stats.totalGenerations > 0
          ? this.stats.totalTime / this.stats.totalGenerations
          : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalGenerations: 0,
      totalTokens: 0,
      totalTime: 0,
    };
  }
}

/**
 * Create a code generator instance
 */
export function createGenerator(
  config?: GeneratorConfig,
  retriever?: CodeRetriever
): CodeGenerator {
  return new CodeGenerator(config, retriever);
}

/**
 * Default generator instance
 */
let defaultGenerator: CodeGenerator | null = null;

export function setDefaultGenerator(generator: CodeGenerator): void {
  defaultGenerator = generator;
}

export function getDefaultGenerator(): CodeGenerator {
  if (!defaultGenerator) {
    defaultGenerator = new CodeGenerator();
  }
  return defaultGenerator;
}

/**
 * Convenience function for quick generation
 */
export async function generateCode(request: GenerationRequest): Promise<GenerationResult> {
  return getDefaultGenerator().generate(request);
}
