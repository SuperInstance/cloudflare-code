/**
 * Code Synthesizer - AI-Powered Code Generation
 * Generates code from natural language and specifications
 */

import { LLMManager, Message } from '../llm/index.js';
import {
  Language,
  SynthesisOptions,
  GenerationResult,
  CodeContext,
  Specification,
  CodeFile,
  GenerationMetadata
} from '../types/index.js';
import { CodeValidator } from '../utils/validator.js';
import { CodeFormatter } from '../utils/formatter.js';

/**
 * Code synthesis result
 */
export interface SynthesisResult {
  code: string;
  language: Language;
  explanation?: string;
  dependencies?: string[];
  exports?: string[];
  metadata: GenerationMetadata;
}

/**
 * Refactoring result
 */
export interface RefactoringResult {
  original: string;
  refactored: string;
  changes: RefactoringChange[];
  improvements: string[];
  metadata: GenerationMetadata;
}

/**
 * Refactoring change
 */
export interface RefactoringChange {
  type: 'extract' | 'inline' | 'rename' | 'reorder' | 'optimize' | 'simplify';
  description: string;
  location: { line: number; column: number };
}

/**
 * Code completion result
 */
export interface CompletionResult {
  completion: string;
  confidence: number;
  suggestions: string[];
  metadata: GenerationMetadata;
}

/**
 * Code explanation result
 */
export interface ExplanationResult {
  summary: string;
  detailed: string;
  complexity: string;
  patterns: string[];
  suggestions: string[];
  metadata: GenerationMetadata;
}

/**
 * Code Synthesizer class
 */
export class CodeSynthesizer {
  private llm: LLMManager;
  private validator: CodeValidator;
  private formatter: CodeFormatter;

  constructor(llm: LLMManager) {
    this.llm = llm;
    this.validator = new CodeValidator();
    this.formatter = new CodeFormatter();
  }

  /**
   * Generate code from natural language prompt
   */
  async synthesize(options: SynthesisOptions): Promise<GenerationResult<SynthesisResult>> {
    const startTime = Date.now();

    try {
      // Build system prompt
      const systemPrompt = this.buildSynthesisPrompt(options);

      // Build user prompt
      const userPrompt = this.buildUserPrompt(options);

      // Generate code
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.llm.complete(messages, {
        temperature: options.temperature ?? 0.3,
        maxTokens: options.maxTokens ?? 4096,
        model: options.model
      });

      // Parse response
      const parsed = this.parseSynthesisResponse(response.text, options.language);

      // Validate code
      const validation = this.validator.validate(parsed.code, options.language);
      if (!validation.valid && !options.dryRun) {
        return {
          success: false,
          errors: validation.errors.map(e => ({
            code: 'VALIDATION_ERROR',
            message: e.message,
            severity: 'error'
          })),
          warnings: validation.warnings.map(w => ({
            code: 'VALIDATION_WARNING',
            message: w.message,
            severity: 'warning'
          }))
        };
      }

      // Format code if requested
      let code = parsed.code;
      if (options.format) {
        code = this.formatter.format(code, options.language);
      }

      // Write to file if not dry run
      if (!options.dryRun) {
        await this.writeCode(code, options.outputPath, options.overwrite ?? false);
      }

      const metadata: GenerationMetadata = {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        model: response.model,
        tokensUsed: response.usage.totalTokens,
        filesGenerated: 1,
        linesOfCode: code.split('\n').length,
        languages: [options.language]
      };

      return {
        success: true,
        data: {
          code,
          language: options.language,
          explanation: parsed.explanation,
          dependencies: parsed.dependencies,
          exports: parsed.exports,
          metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            code: 'SYNTHESIS_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error'
          }
        ]
      };
    }
  }

  /**
   * Generate code from specification
   */
  async synthesizeFromSpec(
    specification: Specification,
    language: Language,
    outputPath: string,
    options?: Partial<SynthesisOptions>
  ): Promise<GenerationResult<SynthesisResult[]>> {
    const results: SynthesisResult[] = [];
    const errors: GenerationResult['errors'] = [];
    const warnings: GenerationResult['warnings'] = [];

    // Generate code for each requirement
    for (const requirement of specification.requirements) {
      const synthesisOptions: SynthesisOptions = {
        language,
        outputPath,
        prompt: this.buildRequirementPrompt(requirement, specification),
        specification,
        temperature: 0.3,
        ...options
      };

      const result = await this.synthesize(synthesisOptions);

      if (result.success && result.data) {
        results.push(result.data);
      } else {
        if (result.errors) errors.push(...result.errors);
        if (result.warnings) warnings.push(...result.warnings);
      }
    }

    return {
      success: errors.length === 0,
      data: results.length > 0 ? results : undefined,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Refactor existing code
   */
  async refactor(
    code: string,
    language: Language,
    goals: string[] = ['improve readability', 'optimize performance', 'reduce complexity']
  ): Promise<GenerationResult<RefactoringResult>> {
    const startTime = Date.now();

    try {
      const systemPrompt = `You are an expert code refactoring specialist. Your task is to analyze and refactor code to improve its quality while maintaining its functionality.

Language: ${language}

Refactoring goals:
${goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

Always:
- Preserve the original functionality
- Follow language best practices
- Improve code organization
- Add appropriate comments
- Handle edge cases
- Consider performance implications

Respond in the following format:
\`\`\`${language}
[refactored code here]
\`\`\`

CHANGES:
[description of changes made]

IMPROVEMENTS:
[list of improvements]`;

      const userPrompt = `Refactor the following ${language} code:

\`\`\`${language}
${code}
\`\`\``;

      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.llm.complete(messages, {
        temperature: 0.2,
        maxTokens: 4096
      });

      const parsed = this.parseRefactoringResponse(response.text);

      const metadata: GenerationMetadata = {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        model: response.model,
        tokensUsed: response.usage.totalTokens,
        filesGenerated: 0,
        linesOfCode: parsed.refactored.split('\n').length,
        languages: [language]
      };

      return {
        success: true,
        data: {
          original: code,
          ...parsed,
          metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            code: 'REFACTORING_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error'
          }
        ]
      };
    }
  }

  /**
   * Complete code snippet
   */
  async complete(
    code: string,
    language: Language,
    cursorPosition?: { line: number; column: number }
  ): Promise<GenerationResult<CompletionResult>> {
    const startTime = Date.now();

    try {
      const systemPrompt = `You are an expert code completion specialist. Your task is to complete code snippets in a natural and idiomatic way.

Language: ${language}

Guidelines:
- Complete the code naturally
- Follow existing patterns
- Handle edge cases
- Add necessary imports
- Maintain code style
- Consider type safety

Provide a completion that fits seamlessly with the existing code.`;

      const userPrompt = cursorPosition
        ? `Complete the code at line ${cursorPosition.line}, column ${cursorPosition.column}:

\`\`\`${language}
${code}
\`\`\``
        : `Complete the following ${language} code:

\`\`\`${language}
${code}
\`\`\``;

      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.llm.complete(messages, {
        temperature: 0.4,
        maxTokens: 2048
      });

      const completion = response.text.trim();

      const metadata: GenerationMetadata = {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        model: response.model,
        tokensUsed: response.usage.totalTokens,
        filesGenerated: 0,
        linesOfCode: completion.split('\n').length,
        languages: [language]
      };

      return {
        success: true,
        data: {
          completion,
          confidence: 0.85,
          suggestions: [completion],
          metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            code: 'COMPLETION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error'
          }
        ]
      };
    }
  }

  /**
   * Explain code
   */
  async explain(
    code: string,
    language: Language,
    detailLevel: 'brief' | 'detailed' | 'comprehensive' = 'detailed'
  ): Promise<GenerationResult<ExplanationResult>> {
    const startTime = Date.now();

    try {
      const systemPrompt = `You are an expert code analyst. Your task is to explain code in a clear and concise manner.

Language: ${language}

Detail level: ${detailLevel}

For each explanation, provide:
1. Summary: What the code does
2. Detailed explanation: How it works
3. Complexity: Time/space complexity analysis
4. Patterns: Design patterns used
5. Suggestions: Potential improvements

Be thorough but concise.`;

      const userPrompt = `Explain the following ${language} code:

\`\`\`${language}
${code}
\`\`\``;

      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await this.llm.complete(messages, {
        temperature: 0.3,
        maxTokens: 4096
      });

      const parsed = this.parseExplanationResponse(response.text);

      const metadata: GenerationMetadata = {
        duration: Date.now() - startTime,
        timestamp: new Date(),
        model: response.model,
        tokensUsed: response.usage.totalTokens,
        filesGenerated: 0,
        linesOfCode: code.split('\n').length,
        languages: [language]
      };

      return {
        success: true,
        data: {
          ...parsed,
          metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            code: 'EXPLANATION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error'
          }
        ]
      };
    }
  }

  /**
   * Build synthesis prompt
   */
  private buildSynthesisPrompt(options: SynthesisOptions): string {
    const languageConfig = this.getLanguageConfig(options.language);

    return `You are an expert code generation specialist. Your task is to generate high-quality, production-ready code.

Language: ${options.language}
File Extension: ${languageConfig.fileExtension}

Style Guidelines:
- Follow ${options.language} best practices and idioms
- Write clean, readable, and maintainable code
- Include comprehensive comments and documentation
- Handle errors appropriately
- Consider edge cases
- Optimize for performance and clarity
- Use appropriate data structures and algorithms

Requirements:
- Generate complete, working code
- Include necessary imports and dependencies
- Add type annotations where applicable
- Include error handling
- Add inline comments for complex logic
- Follow consistent naming conventions

${options.includeTests ? 'Also generate unit tests for the code.' : ''}

${options.includeDocs ? 'Include comprehensive documentation.' : ''}

Respond with the code in a markdown code block, followed by a brief explanation of what the code does, any dependencies it requires, and what it exports.`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(options: SynthesisOptions): string {
    let prompt = options.prompt;

    if (options.specification) {
      prompt += `\n\nSpecification:\n${JSON.stringify(options.specification, null, 2)}`;
    }

    if (options.context) {
      if (options.context.files && options.context.files.length > 0) {
        prompt += '\n\nContext Files:';
        for (const file of options.context.files) {
          prompt += `\n\n${file.path}:\n\`\`\`${file.language}\n${file.content}\n\`\`\``;
        }
      }

      if (options.context.dependencies && options.context.dependencies.length > 0) {
        prompt += '\n\nAvailable Dependencies:';
        for (const dep of options.context.dependencies) {
          prompt += `\n- ${dep.name}@${dep.version}`;
        }
      }
    }

    return prompt;
  }

  /**
   * Build requirement prompt
   */
  private buildRequirementPrompt(requirement: any, specification: Specification): string {
    let prompt = `Generate code to implement the following requirement:\n\n`;
    prompt += `ID: ${requirement.id}\n`;
    prompt += `Type: ${requirement.type}\n`;
    prompt += `Priority: ${requirement.priority}\n`;
    prompt += `Description: ${requirement.description}\n`;

    if (requirement.acceptanceCriteria) {
      prompt += `\nAcceptance Criteria:\n`;
      requirement.acceptanceCriteria.forEach((criteria: string, i: number) => {
        prompt += `${i + 1}. ${criteria}\n`;
      });
    }

    if (specification.constraints) {
      prompt += `\nConstraints:\n`;
      specification.constraints.forEach((constraint, i) => {
        prompt += `${i + 1}. ${constraint.type}: ${constraint.description}\n`;
      });
    }

    return prompt;
  }

  /**
   * Parse synthesis response
   */
  private parseSynthesisResponse(response: string, language: Language): {
    code: string;
    explanation?: string;
    dependencies?: string[];
    exports?: string[];
  } {
    // Extract code block
    const codeBlockMatch = response.match(/```(?:${language}|typescript|javascript)?\n([\s\S]*?)```/i);
    const code = codeBlockMatch ? codeBlockMatch[1].trim() : response;

    // Extract explanation
    const explanationMatch = response.match(/(?:EXPLANATION:|Explanation:)\s*([\s\S]*?)(?=\n\n|$)/i);
    const explanation = explanationMatch ? explanationMatch[1].trim() : undefined;

    // Extract dependencies
    const dependenciesMatch = response.match(/(?:DEPENDENCIES:|Dependencies:)\s*([\s\S]*?)(?=\n\n|$)/i);
    const dependencies = dependenciesMatch
      ? dependenciesMatch[1].split('\n').map(d => d.trim()).filter(Boolean)
      : undefined;

    // Extract exports
    const exportsMatch = response.match(/(?:EXPORTS:|Exports:)\s*([\s\S]*?)(?=\n\n|$)/i);
    const exports = exportsMatch
      ? exportsMatch[1].split('\n').map(e => e.trim()).filter(Boolean)
      : undefined;

    return { code, explanation, dependencies, exports };
  }

  /**
   * Parse refactoring response
   */
  private parseRefactoringResponse(response: string): Omit<RefactoringResult, 'original' | 'metadata'> {
    const codeBlockMatch = response.match(/```\w*\n([\s\S]*?)```/);
    const refactored = codeBlockMatch ? codeBlockMatch[1].trim() : '';

    const changesMatch = response.match(/(?:CHANGES:|Changes:)\s*([\s\S]*?)(?=\n\n|IMPROVEMENTS:|$)/i);
    const changesText = changesMatch ? changesMatch[1].trim() : '';

    const improvementsMatch = response.match(/(?:IMPROVEMENTS:|Improvements:)\s*([\s\S]*?)$/i);
    const improvementsText = improvementsMatch ? improvementsMatch[1].trim() : '';

    const changes: RefactoringChange[] = changesText
      .split('\n')
      .filter(Boolean)
      .map((line, i) => ({
        type: 'optimize',
        description: line.replace(/^-\s*/, '').trim(),
        location: { line: i + 1, column: 0 }
      }));

    const improvements = improvementsText
      .split('\n')
      .filter(Boolean)
      .map(line => line.replace(/^-\s*/, '').trim());

    return { refactored, changes, improvements };
  }

  /**
   * Parse explanation response
   */
  private parseExplanationResponse(response: string): Omit<ExplanationResult, 'metadata'> {
    const summaryMatch = response.match(/(?:SUMMARY:|Summary:)\s*([\s\S]*?)(?=\n\n|$)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : response.split('\n\n')[0];

    const detailedMatch = response.match(/(?:DETAILED:|Detailed:|DETAIL:)\s*([\s\S]*?)(?=\n\n|$)/i);
    const detailed = detailedMatch ? detailedMatch[1].trim() : '';

    const complexityMatch = response.match(/(?:COMPLEXITY:|Complexity:)\s*([\s\S]*?)(?=\n\n|$)/i);
    const complexity = complexityMatch ? complexityMatch[1].trim() : 'Not analyzed';

    const patternsMatch = response.match(/(?:PATTERNS:|Patterns:)\s*([\s\S]*?)(?=\n\n|$)/i);
    const patterns = patternsMatch
      ? patternsMatch[1].split('\n').map(p => p.replace(/^-\s*/, '').trim()).filter(Boolean)
      : [];

    const suggestionsMatch = response.match(/(?:SUGGESTIONS:|Suggestions:)\s*([\s\S]*?)$/i);
    const suggestions = suggestionsMatch
      ? suggestionsMatch[1].split('\n').map(s => s.replace(/^-\s*/, '').trim()).filter(Boolean)
      : [];

    return { summary, detailed, complexity, patterns, suggestions };
  }

  /**
   * Get language configuration
   */
  private getLanguageConfig(language: Language): { fileExtension: string } {
    const extensions: Record<Language, string> = {
      [Language.TypeScript]: '.ts',
      [Language.JavaScript]: '.js',
      [Language.Python]: '.py',
      [Language.Go]: '.go',
      [Language.Rust]: '.rs',
      [Language.Java]: '.java',
      [Language.CSharp]: '.cs',
      [Language.Cpp]: '.cpp',
      [Language.PHP]: '.php',
      [Language.Ruby]: '.rb',
      [Language.Swift]: '.swift',
      [Language.Kotlin]: '.kt',
      [Language.Dart]: '.dart',
      [Language.Scala]: '.scala'
    };

    return { fileExtension: extensions[language] };
  }

  /**
   * Write code to file
   */
  private async writeCode(code: string, outputPath: string, overwrite: boolean): Promise<void> {
    const fs = await import('fs-extra');
    const path = await import('path');

    const dir = path.dirname(outputPath);
    await fs.ensureDir(dir);

    const exists = await fs.pathExists(outputPath);
    if (exists && !overwrite) {
      throw new Error(`File ${outputPath} already exists. Use overwrite option to replace it.`);
    }

    await fs.writeFile(outputPath, code, 'utf-8');
  }
}
