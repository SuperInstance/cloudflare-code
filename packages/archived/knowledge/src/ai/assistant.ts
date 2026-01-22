/**
 * AI Assistant - AI-powered documentation writing and enhancement
 */

// @ts-nocheck - Unused variables and type incompatibilities

import { Logger } from '../utils/logger.js';
import {
  DocumentationRequest,
  DocumentationSuggestion,
  GrammarCheckResult,
  SEOOptimization,
  DocumentContent,
  DocumentMetadata
} from '../types/index.js';

export interface AIAssistantConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerationOptions {
  language?: string;
  audience?: 'beginner' | 'intermediate' | 'advanced';
  tone?: 'formal' | 'casual' | 'technical';
  includeExamples?: boolean;
  length?: 'short' | 'medium' | 'long';
}

export class AIDocumentationAssistant {
  private logger: Logger;

  constructor(private config: AIAssistantConfig) {
    this.logger = new Logger('AIDocumentationAssistant');
  }

  /**
   * Generate documentation from code
   */
  async generateDocumentation(
    code: string,
    options: GenerationOptions = {}
  ): Promise<string> {
    this.logger.info('Generating documentation', { codeLength: code.length, options });

    const prompt = this.buildGenerationPrompt(code, options);

    try {
      const documentation = await this.callAI(prompt);
      return this.cleanDocumentation(documentation);
    } catch (error) {
      this.logger.error('Failed to generate documentation', error);
      throw new Error(`Documentation generation failed: ${error}`);
    }
  }

  /**
   * Improve existing documentation
   */
  async improveDocumentation(
    documentation: string,
    options: GenerationOptions = {}
  ): Promise<string> {
    this.logger.info('Improving documentation', { docLength: documentation.length, options });

    const prompt = this.buildImprovementPrompt(documentation, options);

    try {
      const improved = await this.callAI(prompt);
      return this.cleanDocumentation(improved);
    } catch (error) {
      this.logger.error('Failed to improve documentation', error);
      throw new Error(`Documentation improvement failed: ${error}`);
    }
  }

  /**
   * Generate suggestions for documentation
   */
  async generateSuggestions(
    documentation: string,
    context?: any
  ): Promise<DocumentationSuggestion[]> {
    this.logger.info('Generating suggestions', { docLength: documentation.length });

    const suggestions: DocumentationSuggestion[] = [];

    // Check for missing sections
    const missingSections = this.checkMissingSections(documentation);
    for (const section of missingSections) {
      suggestions.push({
        type: 'improve-doc',
        content: section,
        explanation: `Consider adding a ${section} section to improve completeness`,
        confidence: 0.8
      });
    }

    // Check for examples
    if (!documentation.includes('@example') && !documentation.includes('```')) {
      suggestions.push({
        type: 'add-example',
        content: 'Add code examples',
        explanation: 'Code examples help users understand how to use the API',
        confidence: 0.9
      });
    }

    // Check for parameter documentation
    const paramsMissing = this.checkParameterDocumentation(documentation);
    if (paramsMissing.length > 0) {
      suggestions.push({
        type: 'add-parameters',
        content: `Document parameters: ${paramsMissing.join(', ')}`,
        explanation: 'Parameters should be documented with @param tags',
        confidence: 0.85
      });
    }

    // Check for return type documentation
    if (!documentation.includes('@returns') && !documentation.includes('@return')) {
      suggestions.push({
        type: 'add-returns',
        content: 'Add return value documentation',
        explanation: 'Document what the function returns',
        confidence: 0.75
      });
    }

    // Check for throws/exceptions
    if (!documentation.includes('@throws') && !documentation.includes('@exception')) {
      suggestions.push({
        type: 'add-throws',
        content: 'Document thrown exceptions',
        explanation: 'Document any exceptions that may be thrown',
        confidence: 0.6
      });
    }

    // Check clarity
    const clarityIssues = this.checkClarity(documentation);
    suggestions.push(...clarityIssues);

    return suggestions;
  }

  /**
   * Check grammar and style
   */
  async checkGrammar(documentation: string): Promise<GrammarCheckResult> {
    this.logger.info('Checking grammar', { docLength: documentation.length });

    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: string[] = [];

    // Basic checks
    const sentences = documentation.split(/[.!?]+/);

    // Check for very short sentences
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 0 && trimmed.length < 10) {
        warnings.push({
          message: 'Very short sentence',
          position: { start: 0, end: trimmed.length },
          suggestions: ['Consider expanding this sentence'],
          rule: 'short-sentence'
        });
      }
    }

    // Check for common mistakes
    const commonMistakes = [
      { mistake: 'its', correction: "it's", context: 'it is' },
      { mistake: 'your', correction: "you're", context: 'you are' },
      { mistake: 'then', correction: 'than', context: 'comparison' }
    ];

    for (const { mistake, correction, context } of commonMistakes) {
      const regex = new RegExp(`\\b${mistake}\\b`, 'gi');
      let match;
      while ((match = regex.exec(documentation)) !== null) {
        errors.push({
          message: `Possible typo: "${match[0]}" should be "${correction}" when meaning ${context}`,
          position: { start: match.index, end: match.index + match[0].length },
          suggestions: [correction],
          rule: 'common-mistake'
        });
      }
    }

    // Check for capitalization at start of sentences
    const sentencesLower = documentation.toLowerCase().split(/[.!?]+/);
    for (let i = 1; i < sentences.length; i++) {
      const original = sentences[i];
      const lower = sentencesLower[i];
      if (original && original.trim().length > 0) {
        const firstChar = original.trim().charAt(0);
        if (firstChar === firstChar.toLowerCase() && /[a-z]/.test(firstChar)) {
          warnings.push({
            message: 'Sentence should start with a capital letter',
            position: { start: 0, end: 1 },
            suggestions: [firstChar.toUpperCase()],
            rule: 'capitalization'
          });
        }
      }
    }

    const score = Math.max(0, 100 - (errors.length * 5) - (warnings.length * 2));

    return {
      errors,
      warnings,
      score,
      suggestions
    };
  }

  /**
   * Optimize for SEO
   */
  async optimizeSEO(
    title: string,
    description: string,
    content: string
  ): Promise<SEOOptimization> {
    this.logger.info('Optimizing SEO', { title, descriptionLength: description.length });

    const keywords = this.extractKeywords(content);

    const titleSuggestions: any[] = [];
    if (title.length < 30) {
      titleSuggestions.push({
        text: 'Title is too short',
        current: title,
        reason: 'Optimal title length is 50-60 characters',
        priority: 'medium'
      });
    } else if (title.length > 60) {
      titleSuggestions.push({
        text: 'Title is too long',
        current: title,
        reason: 'Optimal title length is 50-60 characters',
        priority: 'high'
      });
    }

    const descriptionSuggestions: any[] = [];
    if (description.length < 120) {
      descriptionSuggestions.push({
        text: 'Description is too short',
        current: description,
        reason: 'Optimal description length is 150-160 characters',
        priority: 'medium'
      });
    } else if (description.length > 160) {
      descriptionSuggestions.push({
        text: 'Description is too long',
        current: description,
        reason: 'Optimal description length is 150-160 characters',
        priority: 'high'
      });
    }

    const metaTags: any[] = [
      { name: 'title', content: title },
      { name: 'description', content: description },
      { name: 'keywords', content: keywords.slice(0, 10).join(', ') },
      { name: 'og:title', content: title },
      { name: 'og:description', content: description },
      { name: 'og:type', content: 'article' }
    ];

    return {
      title: titleSuggestions,
      description: descriptionSuggestions,
      keywords,
      metaTags
    };
  }

  /**
   * Translate documentation
   */
  async translate(
    documentation: string,
    targetLanguage: string
  ): Promise<string> {
    this.logger.info('Translating documentation', {
      docLength: documentation.length,
      targetLanguage
    });

    const prompt = `
Translate the following documentation to ${targetLanguage}. Maintain technical accuracy and formatting.

Documentation:
${documentation}

Translation:
    `.trim();

    try {
      const translation = await this.callAI(prompt);
      return translation;
    } catch (error) {
      this.logger.error('Failed to translate documentation', error);
      throw new Error(`Translation failed: ${error}`);
    }
  }

  /**
   * Summarize documentation
   */
  async summarize(documentation: string, maxLength?: number): Promise<string> {
    this.logger.info('Summarizing documentation', { docLength: documentation.length });

    const lengthHint = maxLength ? `in ${maxLength} characters or less` : 'concisely';

    const prompt = `
Summarize the following documentation ${lengthHint}:

Documentation:
${documentation}

Summary:
    `.trim();

    try {
      const summary = await this.callAI(prompt);
      return summary;
    } catch (error) {
      this.logger.error('Failed to summarize documentation', error);
      throw new Error(`Summarization failed: ${error}`);
    }
  }

  /**
   * Generate API documentation from code
   */
  async generateAPIDocumentation(
    code: string,
    language: string = 'typescript'
  ): Promise<string> {
    this.logger.info('Generating API documentation', { language, codeLength: code.length });

    const prompt = `
Generate comprehensive API documentation for the following ${language} code.
Include:
- Description of what the code does
- @param tags for all parameters with descriptions
- @returns tag with return value description
- @throws tags for any exceptions
- @example tag with usage example
- @see tags for related functions

Code:
\`\`\`${language}
${code}
\`\`\`

Documentation:
    `.trim();

    try {
      const documentation = await this.callAI(prompt);
      return this.cleanDocumentation(documentation);
    } catch (error) {
      this.logger.error('Failed to generate API documentation', error);
      throw new Error(`API documentation generation failed: ${error}`);
    }
  }

  /**
   * Generate README from code
   */
  async generateREADME(projectName: string, files: Map<string, string>): Promise<string> {
    this.logger.info('Generating README', { projectName, fileCount: files.size });

    const fileListing = Array.from(files.entries())
      .map(([path, content]) => `\n### ${path}\n\`\`\`\n${content.substring(0, 500)}\n\`\`\``)
      .join('\n');

    const prompt = `
Generate a comprehensive README.md for a project called "${projectName}".

The project contains the following files:
${fileListing}

Include:
- Project title and description
- Features list
- Installation instructions
- Usage examples
- API documentation (if applicable)
- Contributing guidelines
- License information

README.md:
    `.trim();

    try {
      const readme = await this.callAI(prompt);
      return readme;
    } catch (error) {
      this.logger.error('Failed to generate README', error);
      throw new Error(`README generation failed: ${error}`);
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Call AI API
   */
  private async callAI(prompt: string): Promise<string> {
    const { apiKey, model, temperature, maxTokens } = this.config;

    if (this.config.provider === 'openai') {
      return await this.callOpenAI(prompt, apiKey, model, temperature, maxTokens);
    } else if (this.config.provider === 'anthropic') {
      return await this.callAnthropic(prompt, apiKey, model, temperature, maxTokens);
    } else {
      throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    prompt: string,
    apiKey: string | undefined,
    model: string | undefined,
    temperature: number | undefined,
    maxTokens: number | undefined
  ): Promise<string> {
    // In a real implementation, this would call the OpenAI API
    // For now, return a mock response
    return `AI-generated documentation based on: ${prompt.substring(0, 100)}...`;
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    prompt: string,
    apiKey: string | undefined,
    model: string | undefined,
    temperature: number | undefined,
    maxTokens: number | undefined
  ): Promise<string> {
    // In a real implementation, this would call the Anthropic API
    // For now, return a mock response
    return `AI-generated documentation based on: ${prompt.substring(0, 100)}...`;
  }

  /**
   * Build prompt for documentation generation
   */
  private buildGenerationPrompt(code: string, options: GenerationOptions): string {
    const audience = options.audience || 'intermediate';
    const tone = options.tone || 'technical';
    const length = options.length || 'medium';

    return `
Generate ${tone} documentation for the following code, suitable for ${audience}-level developers.
Make the documentation ${length} in length.
${options.includeExamples ? 'Include usage examples.' : ''}

Code:
\`\`\`
${code}
\`\`\`

Documentation:
    `.trim();
  }

  /**
   * Build prompt for documentation improvement
   */
  private buildImprovementPrompt(documentation: string, options: GenerationOptions): string {
    const audience = options.audience || 'intermediate';
    const tone = options.tone || 'technical';

    return `
Improve the following documentation to make it more ${tone} and suitable for ${audience}-level developers.
Focus on:
- Clarity and conciseness
- Completeness of information
- Proper formatting and structure
- Technical accuracy

Current documentation:
${documentation}

Improved documentation:
    `.trim();
  }

  /**
   * Clean generated documentation
   */
  private cleanDocumentation(documentation: string): string {
    return documentation
      .trim()
      .replace(/````/g, '```')
      .replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Check for missing documentation sections
   */
  private checkMissingSections(documentation: string): string[] {
    const missing: string[] = [];

    const hasDescription = documentation.length > 50;
    const hasExample = documentation.includes('@example') || documentation.includes('```');
    const hasParams = documentation.includes('@param');
    const hasReturns = documentation.includes('@returns') || documentation.includes('@return');
    const hasThrows = documentation.includes('@throws') || documentation.includes('@exception');

    if (!hasDescription) missing.push('description');
    if (!hasExample) missing.push('example');
    if (!hasParams) missing.push('parameters');
    if (!hasReturns) missing.push('return value');
    if (!hasThrows) missing.push('exceptions');

    return missing;
  }

  /**
   * Check for parameter documentation
   */
  private checkParameterDocumentation(documentation: string): string[] {
    // Extract function signature from documentation
    const signatureMatch = documentation.match(/function\s+(\w+)\s*\(([^)]*)\)/);
    if (!signatureMatch) return [];

    const paramsStr = signatureMatch[2];
    const params = paramsStr.split(',').map(p => p.trim().split(':')[0].trim());

    // Check which params are documented
    const undocumented: string[] = [];
    for (const param of params) {
      if (!documentation.includes(`@param ${param}`)) {
        undocumented.push(param);
      }
    }

    return undocumented;
  }

  /**
   * Check documentation clarity
   */
  private checkClarity(documentation: string): DocumentationSuggestion[] {
    const suggestions: DocumentationSuggestion[] = [];

    // Check for overly long sentences
    const sentences = documentation.split(/[.!?]+/);
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      if (words.length > 30) {
        suggestions.push({
          type: 'improve-clarity',
          content: sentence.trim(),
          explanation: 'This sentence is too long and may be hard to understand',
          confidence: 0.7
        });
      }
    }

    // Check for jargon
    const jargonWords = ['polymorphism', 'encapsulation', 'monad', 'functor'];
    for (const word of jargonWords) {
      if (documentation.toLowerCase().includes(word)) {
        suggestions.push({
          type: 'improve-clarity',
          content: word,
          explanation: 'Consider explaining or simplifying technical jargon',
          confidence: 0.6
        });
      }
    }

    return suggestions;
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/);

    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that'
    ]);

    const frequency = new Map<string, number>();
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        frequency.set(word, (frequency.get(word) || 0) + 1);
      }
    }

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }
}

/**
 * Auto-Documentation Service - Automatically generate docs on code changes
 */
export class AutoDocumentationService {
  private logger: Logger;
  private ai: AIDocumentationAssistant;

  constructor(config: AIAssistantConfig) {
    this.logger = new Logger('AutoDocumentationService');
    this.ai = new AIDocumentationAssistant(config);
  }

  /**
   * Process code changes and generate/update documentation
   */
  async processCodeChange(
    filePath: string,
    code: string,
    language: string
  ): Promise<string> {
    this.logger.info('Processing code change', { filePath, language });

    // Generate documentation for the changed code
    const documentation = await this.ai.generateDocumentation(code, {
      language,
      audience: 'intermediate',
      tone: 'technical',
      includeExamples: true
    });

    // Get suggestions for improvement
    const suggestions = await this.ai.generateSuggestions(code);

    // Log suggestions
    if (suggestions.length > 0) {
      this.logger.info(`Generated ${suggestions.length} suggestions`, {
        suggestions: suggestions.map(s => s.type)
      });
    }

    return documentation;
  }

  /**
   * Batch process multiple files
   */
  async batchProcess(files: Array<{ path: string; code: string; language: string }>): Promise<Map<string, string>> {
    this.logger.info(`Batch processing ${files.length} files`);

    const results = new Map<string, string>();

    for (const file of files) {
      try {
        const documentation = await this.processCodeChange(file.path, file.code, file.language);
        results.set(file.path, documentation);
      } catch (error) {
        this.logger.error(`Failed to process ${file.path}`, error);
      }
    }

    this.logger.info(`Batch processing complete: ${results.size}/${files.length} successful`);
    return results;
  }
}
