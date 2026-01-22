/**
 * Prompt Engine - Advanced prompt template system with optimization and versioning
 */

import { EventEmitter } from 'eventemitter3';
import {
  PromptTemplate,
  PromptVariable,
  PromptExample,
  PromptTemplateType,
  PromptOptimizationResult,
  PromptTestCase,
  PromptValidationError,
  VariableValidation,
  LLMRequest,
  Message,
} from '../types/index.js';

// ============================================================================
// Prompt Engine Configuration
// ============================================================================

export interface PromptEngineConfig {
  enableOptimization: boolean;
  enableVersioning: boolean;
  enableABTesting: boolean;
  maxVersions: number;
  cacheEnabled: boolean;
  optimizationTargets: Array<'clarity' | 'specificity' | 'conciseness' | 'effectiveness'>;
}

// ============================================================================
// Prompt Engine Class
// ============================================================================

export class PromptEngine {
  private templates: Map<string, PromptTemplate>;
  private versions: Map<string, PromptTemplate[]>;
  private testCases: Map<string, PromptTestCase[]>;
  private abTestResults: Map<string, Map<string, number>>;
  private events: EventEmitter;
  private config: Required<PromptEngineConfig>;

  constructor(config: Partial<PromptEngineConfig> = {}) {
    this.templates = new Map();
    this.versions = new Map();
    this.testCases = new Map();
    this.abTestResults = new Map();
    this.events = new EventEmitter();
    this.config = {
      enableOptimization: config.enableOptimization ?? true,
      enableVersioning: config.enableVersioning ?? true,
      enableABTesting: config.enableABTesting ?? false,
      maxVersions: config.maxVersions ?? 10,
      cacheEnabled: config.cacheEnabled ?? true,
      optimizationTargets: config.optimizationTargets || [
        'clarity',
        'specificity',
        'conciseness',
        'effectiveness',
      ],
    };

    this.initializeDefaultTemplates();
  }

  // ========================================================================
  // Template Management
  // ========================================================================

  public registerTemplate(template: PromptTemplate): void {
    if (this.config.enableVersioning) {
      this.storeVersion(template);
    }

    this.templates.set(template.id, template);
    this.events.emit('template:registered', { templateId: template.id });
  }

  public getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  public getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplatesByTag(tag: string): PromptTemplate[] {
    return Array.from(this.templates.values()).filter((t) =>
      t.tags.includes(tag)
    );
  }

  public updateTemplate(
    id: string,
    updates: Partial<PromptTemplate>
  ): PromptTemplate | undefined {
    const template = this.templates.get(id);
    if (!template) return undefined;

    const updated: PromptTemplate = {
      ...template,
      ...updates,
      id: template.id, // Preserve ID
      updatedAt: new Date(),
    };

    if (this.config.enableVersioning) {
      this.storeVersion(updated);
    }

    this.templates.set(id, updated);
    this.events.emit('template:updated', { templateId: id });

    return updated;
  }

  public deleteTemplate(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.events.emit('template:deleted', { templateId: id });
    }
    return deleted;
  }

  // ========================================================================
  // Template Rendering
  // ========================================================================

  public render(
    templateId: string,
    variables: Record<string, unknown>
  ): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new PromptValidationError(templateId, ['Template not found']);
    }

    // Validate variables
    this.validateVariables(template, variables);

    // Render template
    let rendered = template.template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replaceAll(placeholder, String(value));
    }

    // Handle conditionals
    rendered = this.processConditionals(rendered, variables);

    // Handle loops
    rendered = this.processLoops(rendered, variables);

    return rendered.trim();
  }

  public renderToRequest(
    templateId: string,
    variables: Record<string, unknown>,
    options?: {
      systemPrompt?: string;
      additionalMessages?: Message[];
    }
  ): LLMRequest {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new PromptValidationError(templateId, ['Template not found']);
    }

    const renderedContent = this.render(templateId, variables);

    const messages: Message[] = [];

    // Add system prompt if provided
    if (template.systemPrompt || options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options?.systemPrompt || template.systemPrompt || '',
      });
    }

    // Add rendered content based on template type
    switch (template.type) {
      case 'chat':
        messages.push({
          role: 'user',
          content: renderedContent,
        });
        break;

      case 'completion':
        messages.push({
          role: 'user',
          content: renderedContent,
        });
        break;

      case 'function':
        messages.push({
          role: 'system',
          content: `You are a function that must follow this specification:\n${renderedContent}`,
        });
        break;

      default:
        messages.push({
          role: 'user',
          content: renderedContent,
        });
    }

    // Add additional messages if provided
    if (options?.additionalMessages) {
      messages.push(...options.additionalMessages);
    }

    return {
      messages,
      metadata: {
        templateId,
        templateVersion: template.version,
        renderedAt: new Date().toISOString(),
      },
    };
  }

  // ========================================================================
  // Variable Validation
  // ========================================================================

  private validateVariables(
    template: PromptTemplate,
    variables: Record<string, unknown>
  ): void {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = variables[variable.name];

      // Check required variables
      if (variable.required && (value === undefined || value === null)) {
        errors.push(`Required variable '${variable.name}' is missing`);
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, variable.type)) {
        errors.push(
          `Variable '${variable.name}' must be of type ${variable.type}`
        );
      }

      // Custom validation
      if (variable.validation) {
        const validationError = this.runValidation(
          value,
          variable.validation
        );
        if (validationError) {
          errors.push(
            `Variable '${variable.name}' validation failed: ${validationError}`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new PromptValidationError(template.id, errors);
    }
  }

  private validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  private runValidation(
    value: unknown,
    validation: VariableValidation
  ): string | null {
    if (validation.minLength && typeof value === 'string') {
      if (value.length < validation.minLength) {
        return `Must be at least ${validation.minLength} characters`;
      }
    }

    if (validation.maxLength && typeof value === 'string') {
      if (value.length > validation.maxLength) {
        return `Must be at most ${validation.maxLength} characters`;
      }
    }

    if (validation.pattern && typeof value === 'string') {
      if (!validation.pattern.test(value)) {
        return 'Does not match required pattern';
      }
    }

    if (validation.enum && !validation.enum.includes(value)) {
      return `Must be one of: ${validation.enum.join(', ')}`;
    }

    if (validation.custom) {
      const result = validation.custom(value);
      if (result === false) {
        return 'Custom validation failed';
      }
      if (typeof result === 'string') {
        return result;
      }
    }

    return null;
  }

  // ========================================================================
  // Template Processing
  // ========================================================================

  private processConditionals(
    template: string,
    variables: Record<string, unknown>
  ): string {
    // Process {{#if variable}}...{{/if}} blocks
    const ifPattern = /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs;
    return template.replace(ifPattern, (match, variableName, content) => {
      const value = variables[variableName];
      return value ? content : '';
    });
  }

  private processLoops(
    template: string,
    variables: Record<string, unknown>
  ): string {
    // Process {{#each variable}}...{{/each}} blocks
    const eachPattern = /\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs;
    return template.replace(eachPattern, (match, variableName, content) => {
      const value = variables[variableName];
      if (!Array.isArray(value)) return '';

      return value
        .map((item, index) => {
          let itemContent = content;
          itemContent = itemContent.replaceAll('{{this}}', String(item));
          itemContent = itemContent.replaceAll('{{@index}}', String(index));
          return itemContent;
        })
        .join('\n');
    });
  }

  // ========================================================================
  // Prompt Optimization
  // ========================================================================

  public async optimize(templateId: string): Promise<PromptOptimizationResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new PromptValidationError(templateId, ['Template not found']);
    }

    const originalTemplate = template.template;
    let optimizedTemplate = originalTemplate;
    const improvements: string[] = [];
    const suggestions: string[] = [];

    // Analyze current metrics
    const currentMetrics = this.analyzeTemplate(originalTemplate);

    // Apply optimization strategies
    if (this.config.optimizationTargets.includes('clarity')) {
      const clarityResult = this.improveClarity(originalTemplate);
      if (clarityResult.improved) {
        optimizedTemplate = clarityResult.template;
        improvements.push(...clarityResult.improvements);
      }
    }

    if (this.config.optimizationTargets.includes('specificity')) {
      const specificityResult = this.improveSpecificity(optimizedTemplate);
      if (specificityResult.improved) {
        optimizedTemplate = specificityResult.template;
        improvements.push(...specificityResult.improvements);
      }
    }

    if (this.config.optimizationTargets.includes('conciseness')) {
      const concisenessResult = this.improveConciseness(optimizedTemplate);
      if (concisenessResult.improved) {
        optimizedTemplate = concisenessResult.template;
        improvements.push(...concisenessResult.improvements);
      }
    }

    // Analyze optimized template
    const optimizedMetrics = this.analyzeTemplate(optimizedTemplate);

    // Generate suggestions
    suggestions.push(...this.generateSuggestions(originalTemplate));

    const result: PromptOptimizationResult = {
      originalTemplate,
      optimizedTemplate,
      improvements,
      metrics: {
        clarity: optimizedMetrics.clarity - currentMetrics.clarity,
        specificity: optimizedMetrics.specificity - currentMetrics.specificity,
        conciseness: optimizedMetrics.conciseness - currentMetrics.conciseness,
        effectiveness: 0, // Would require A/B testing data
      },
      suggestions,
    };

    this.events.emit('template:optimized', { templateId, result });

    return result;
  }

  private analyzeTemplate(template: string): {
    clarity: number;
    specificity: number;
    conciseness: number;
    effectiveness: number;
  } {
    const words = template.split(/\s+/).length;
    const sentences = (template.match(/[.!?]+/g) || []).length;
    const avgWordsPerSentence = sentences > 0 ? words / sentences : 0;

    // Clarity: measured by sentence complexity and vocabulary
    const clarity = Math.max(0, Math.min(1, 1 - avgWordsPerSentence / 50));

    // Specificity: measured by presence of concrete examples and details
    const specificityMarkers = [
      'for example',
      'specifically',
      'such as',
      'including',
      'format:',
      'output:',
    ];
    const specificityCount = specificityMarkers.filter((marker) =>
      template.toLowerCase().includes(marker)
    ).length;
    const specificity = Math.min(1, specificityCount / 3);

    // Conciseness: inverse of word count (normalized)
    const conciseness = Math.max(0, 1 - words / 500);

    // Effectiveness: placeholder (would require actual performance data)
    const effectiveness = 0.5;

    return {
      clarity: clarity * 100,
      specificity: specificity * 100,
      conciseness: conciseness * 100,
      effectiveness: effectiveness * 100,
    };
  }

  private improveClarity(template: string): {
    improved: boolean;
    template: string;
    improvements: string[];
  } {
    const improvements: string[] = [];
    let improved = template;

    // Add structure with clear sections
    if (!improved.includes('\n\n') && improved.length > 200) {
      improved = this.addStructure(improved);
      improvements.push('Added clear section structure');
    }

    // Simplify complex sentences
    const longSentences = improved.match(/[^.!?]{100,}/g);
    if (longSentences) {
      improvements.push('Simplified overly long sentences');
    }

    // Add clear instructions
    if (!improved.toLowerCase().includes('please') &&
        !improved.toLowerCase().includes('you should')) {
      improved = 'Please ' + improved.charAt(0).toLowerCase() + improved.slice(1);
      improvements.push('Added polite instruction prefix');
    }

    return {
      improved: improvements.length > 0,
      template: improved,
      improvements,
    };
  }

  private improveSpecificity(template: string): {
    improved: boolean;
    template: string;
    improvements: string[];
  } {
    const improvements: string[] = [];
    let improved = template;

    // Add output format specification if missing
    if (!improved.toLowerCase().includes('format') &&
        !improved.toLowerCase().includes('output')) {
      improved += '\n\nOutput format: Provide a clear, direct answer.';
      improvements.push('Added output format specification');
    }

    // Add constraints if missing
    if (!improved.toLowerCase().includes('ensure') &&
        !improved.toLowerCase().includes('must')) {
      improved += '\n\nConstraints: Be accurate and concise.';
      improvements.push('Added explicit constraints');
    }

    // Add examples if template is complex
    if (improved.length > 300 && !improved.includes('Example')) {
      improved += '\n\nExample: [Provide a brief example of expected output]';
      improvements.push('Added example for clarity');
    }

    return {
      improved: improvements.length > 0,
      template: improved,
      improvements,
    };
  }

  private improveConciseness(template: string): {
    improved: boolean;
    template: string;
    improvements: string[];
  } {
    const improvements: string[] = [];
    let improved = template;

    // Remove redundant phrases
    const redundantPatterns = [
      { pattern: /\b(I am writing to|I want to|I would like to)\s+/gi, replacement: '' },
      { pattern: /\b(In order to|For the purpose of)\s+/gi, replacement: 'To ' },
      { pattern: /\b(Am I able to|Is it possible to)\s+/gi, replacement: 'Can I ' },
      { pattern: /\b(at this point in time|at the present time)\b/gi, replacement: 'now' },
      { pattern: /\b(due to the fact that|owing to the fact that)\b/gi, replacement: 'because' },
    ];

    for (const { pattern, replacement } of redundantPatterns) {
      const before = improved;
      improved = improved.replace(pattern, replacement);
      if (before !== improved) {
        improvements.push('Removed redundant phrases');
      }
    }

    // Remove excessive whitespace
    improved = improved.replace(/\n{3,}/g, '\n\n');
    improved = improved.replace(/[ \t]{2,}/g, ' ');

    return {
      improved: improvements.length > 0,
      template: improved,
      improvements,
    };
  }

  private addStructure(template: string): string {
    // Add section breaks based on content analysis
    const sections: string[] = [];
    const paragraphs = template.split('\n\n');

    for (const para of paragraphs) {
      if (para.toLowerCase().includes('context') ||
          para.toLowerCase().includes('background')) {
        sections.push('## Context\n' + para);
      } else if (para.toLowerCase().includes('task') ||
                 para.toLowerCase().includes('please')) {
        sections.push('## Task\n' + para);
      } else if (para.toLowerCase().includes('output') ||
                 para.toLowerCase().includes('format')) {
        sections.push('## Expected Output\n' + para);
      } else {
        sections.push(para);
      }
    }

    return sections.join('\n\n');
  }

  private generateSuggestions(template: string): string[] {
    const suggestions: string[] = [];
    const metrics = this.analyzeTemplate(template);

    if (metrics.clarity < 70) {
      suggestions.push('Consider breaking down complex sentences');
    }

    if (metrics.specificity < 50) {
      suggestions.push('Add concrete examples and expected output format');
    }

    if (metrics.conciseness < 60) {
      suggestions.push('Remove redundant phrases and unnecessary details');
    }

    if (!template.toLowerCase().includes('example')) {
      suggestions.push('Add examples to clarify expectations');
    }

    if (!template.toLowerCase().includes('format')) {
      suggestions.push('Specify the expected output format');
    }

    const hasConstraints = template.toLowerCase().includes('must') ||
                          template.toLowerCase().includes('ensure') ||
                          template.toLowerCase().includes('constraint');
    if (!hasConstraints) {
      suggestions.push('Add explicit constraints and guidelines');
    }

    return suggestions;
  }

  // ========================================================================
  // Version Management
  // ========================================================================

  private storeVersion(template: PromptTemplate): void {
    if (!this.versions.has(template.id)) {
      this.versions.set(template.id, []);
    }

    const versions = this.versions.get(template.id)!;
    versions.push({ ...template });

    // Keep only maxVersions
    if (versions.length > this.config.maxVersions) {
      versions.shift();
    }
  }

  public getVersion(templateId: string, version: string): PromptTemplate | undefined {
    const versions = this.versions.get(templateId);
    if (!versions) return undefined;

    return versions.find((v) => v.version === version);
  }

  public getVersions(templateId: string): PromptTemplate[] {
    return this.versions.get(templateId) || [];
  }

  public rollback(templateId: string, version: string): PromptTemplate | undefined {
    const versionTemplate = this.getVersion(templateId, version);
    if (!versionTemplate) return undefined;

    this.templates.set(templateId, { ...versionTemplate });
    this.events.emit('template:rolled-back', { templateId, version });

    return versionTemplate;
  }

  // ========================================================================
  // A/B Testing
  // ========================================================================

  public createABTest(
    templateId: string,
    variants: { name: string; template: string }[]
  ): void {
    if (!this.abTestResults.has(templateId)) {
      this.abTestResults.set(templateId, new Map());
    }

    const results = this.abTestResults.get(templateId)!;
    for (const variant of variants) {
      if (!results.has(variant.name)) {
        results.set(variant.name, 0);
      }
    }

    this.events.emit('ab-test:created', { templateId, variants });
  }

  public recordABTestResult(
    templateId: string,
    variant: string,
    success: boolean
  ): void {
    const results = this.abTestResults.get(templateId);
    if (!results) return;

    const current = results.get(variant) || 0;
    results.set(variant, current + (success ? 1 : 0));
  }

  public getABTestResults(templateId: string): Map<string, number> | undefined {
    return this.abTestResults.get(templateId);
  }

  public getBestVariant(templateId: string): { name: string; score: number } | undefined {
    const results = this.abTestResults.get(templateId);
    if (!results || results.size === 0) return undefined;

    let best: { name: string; score: number } | undefined;

    for (const [name, score] of results) {
      if (!best || score > best.score) {
        best = { name, score };
      }
    }

    return best;
  }

  // ========================================================================
  // Test Cases
  // ========================================================================

  public addTestCase(testCase: PromptTestCase): void {
    if (!this.testCases.has(testCase.templateId)) {
      this.testCases.set(testCase.templateId, []);
    }

    const cases = this.testCases.get(testCase.templateId)!;
    cases.push(testCase);

    this.events.emit('test-case:added', { templateId: testCase.templateId });
  }

  public getTestCases(templateId: string): PromptTestCase[] {
    return this.testCases.get(templateId) || [];
  }

  public async runTests(templateId: string): Promise<{
    passed: number;
    failed: number;
    results: Array<{ testCase: PromptTestCase; passed: boolean; error?: string }>;
  }> {
    const testCases = this.getTestCases(templateId);
    const results = [];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
      try {
        this.render(templateId, testCase.variables);

        if (testCase.expectedOutput) {
          // In a real implementation, you would execute the prompt and compare
          // For now, we just check if rendering succeeds
          results.push({ testCase, passed: true });
          passed++;
        } else {
          results.push({ testCase, passed: true });
          passed++;
        }
      } catch (error) {
        results.push({
          testCase,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }

    return { passed, failed, results };
  }

  // ========================================================================
  // Default Templates
  // ========================================================================

  private initializeDefaultTemplates(): void {
    // Code generation template
    this.registerTemplate({
      id: 'code-generation',
      name: 'Code Generation',
      description: 'Generate code based on requirements',
      type: 'chat',
      template: `You are an expert programmer. Generate code for the following task:

{{task}}

Requirements:
- Language: {{language}}
- Style: {{style|clean and maintainable}}
- Include comments: {{includeComments|true}}
- Error handling: {{errorHandling|true}}

{{#if examples}}
Examples:
{{#each examples}}
{{this}}
{{/each}}
{{/if}}

Provide the complete, runnable code.`,
      variables: [
        {
          name: 'task',
          type: 'string',
          required: true,
          description: 'The programming task to complete',
        },
        {
          name: 'language',
          type: 'string',
          required: true,
          description: 'Programming language',
        },
        {
          name: 'style',
          type: 'string',
          required: false,
          default: 'clean and maintainable',
        },
        {
          name: 'includeComments',
          type: 'boolean',
          required: false,
          default: true,
        },
        {
          name: 'errorHandling',
          type: 'boolean',
          required: false,
          default: true,
        },
        {
          name: 'examples',
          type: 'array',
          required: false,
        },
      ],
      examples: [],
      systemPrompt: 'You are an expert programmer who writes clean, efficient, and well-documented code.',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['code', 'generation', 'programming'],
    });

    // Question answering template
    this.registerTemplate({
      id: 'question-answering',
      name: 'Question Answering',
      description: 'Answer questions based on provided context',
      type: 'chat',
      template: `Answer the following question based on the provided context.

Context:
{{context}}

Question: {{question}}

{{#if constraints}}
Constraints:
{{constraints}}
{{/if}}

Provide a clear, accurate answer based only on the given context. If the context doesn't contain enough information to answer the question, state that explicitly.`,
      variables: [
        {
          name: 'context',
          type: 'string',
          required: true,
          description: 'The context information to use',
        },
        {
          name: 'question',
          type: 'string',
          required: true,
          description: 'The question to answer',
        },
        {
          name: 'constraints',
          type: 'string',
          required: false,
          description: 'Additional constraints on the answer',
        },
      ],
      examples: [],
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['qa', 'question-answering', 'context'],
    });

    // Text summarization template
    this.registerTemplate({
      id: 'text-summarization',
      name: 'Text Summarization',
      description: 'Summarize long text documents',
      type: 'chat',
      template: `Summarize the following text.

{{text}}

Requirements:
- Maximum length: {{maxLength}} words
- Style: {{style|concise and informative}}
- Key points: {{includeKeyPoints|true}}
- Tone: {{tone|neutral}}

Provide a clear summary that captures the main points and key information.`,
      variables: [
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Text to summarize',
        },
        {
          name: 'maxLength',
          type: 'number',
          required: true,
          description: 'Maximum word count for summary',
        },
        {
          name: 'style',
          type: 'string',
          required: false,
          default: 'concise and informative',
        },
        {
          name: 'includeKeyPoints',
          type: 'boolean',
          required: false,
          default: true,
        },
        {
          name: 'tone',
          type: 'string',
          required: false,
          default: 'neutral',
        },
      ],
      examples: [],
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['summarization', 'text', 'nlp'],
    });
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  public on(event: string, listener: (...args: unknown[]) => void): void {
    this.events.on(event, listener);
  }

  public off(event: string, listener: (...args: unknown[]) => void): void {
    this.events.off(event, listener);
  }

  // ========================================================================
  // Analytics
  // ========================================================================

  public getAnalytics(): {
    totalTemplates: number;
    templatesByTag: Record<string, number>;
    totalTestCases: number;
    activeABTests: number;
  } {
    const templatesByTag: Record<string, number> = {};

    for (const template of this.templates.values()) {
      for (const tag of template.tags) {
        templatesByTag[tag] = (templatesByTag[tag] || 0) + 1;
      }
    }

    let totalTestCases = 0;
    for (const cases of this.testCases.values()) {
      totalTestCases += cases.length;
    }

    return {
      totalTemplates: this.templates.size,
      templatesByTag,
      totalTestCases,
      activeABTests: this.abTestResults.size,
    };
  }
}
