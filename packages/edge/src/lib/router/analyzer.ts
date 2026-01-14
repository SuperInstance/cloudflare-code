/**
 * Request Analyzer
 *
 * Analyzes incoming chat requests to determine complexity, intent,
 * and characteristics for intelligent routing decisions.
 */

import type { ChatRequest } from '../../types/index';
import type {
  RequestAnalysis,
  ComplexityLevel,
  IntentType,
  TokenEstimate,
  CodeSnippet,
} from './types';

/**
 * Analyzer configuration
 */
export interface AnalyzerConfig {
  /** Simple complexity threshold (tokens) */
  simpleThreshold?: number;
  /** Complex complexity threshold (tokens) */
  complexThreshold?: number;
  /** Code line count threshold for complexity */
  codeLineThreshold?: number;
}

/**
 * Request Analyzer class
 *
 * Analyzes request characteristics to inform routing decisions:
 * - Complexity detection (simple/moderate/complex)
 * - Intent detection (chat/code/analysis/creative)
 * - Token estimation
 * - Language detection
 * - Code snippet detection
 * - Semantic hashing for caching
 */
export class RequestAnalyzer {
  private config: Required<AnalyzerConfig>;

  // Patterns for intent detection
  private readonly CODE_PATTERNS = [
    /```[\s\S]*?```/g, // Code blocks
    /`[^`]+`/g, // Inline code
    /\b(function|class|const|let|var|if|else|for|while|return|import|export)\b/g,
  ];

  private readonly ANALYSIS_PATTERNS = [
    /\b(analyze|analysis|compare|explain|evaluate|review|assess)\b/i,
    /\b(debug|troubleshoot|fix|error|issue|problem)\b/i,
  ];

  private readonly CREATIVE_PATTERNS = [
    /\b(write|create|generate|compose|draft|story|poem|script)\b/i,
    /\b(imagine|brainstorm|idea|innovative)\b/i,
  ];

  // Language detection patterns
  private readonly LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
    javascript: [/\b(const|let|var|function|=>|async|await)\b/, /\.js$/, /```javascript/],
    python: [/\b(def|class|import|from|print|if __name__)\b/, /\.py$/, /```python/],
    typescript: [/\b(interface|type|enum|namespace)\b/, /\.ts$/, /```typescript/],
    java: [/\b(public|private|protected|class|interface|extends)\b/, /\.java$/, /```java/],
    go: [/\b(func|var|const|type|interface|struct)\b/, /\.go$/, /```go/],
    rust: [/\b(fn|let|mut|struct|enum|impl)\b/, /\.rs$/, /```rust/],
    cpp: [/\b(#include|namespace|template|class|public|private)\b/, /\.cpp$/, /```cpp/],
    sql: [/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b/i, /```sql/],
  };

  constructor(config: AnalyzerConfig = {}) {
    this.config = {
      simpleThreshold: config.simpleThreshold ?? 200,
      complexThreshold: config.complexThreshold ?? 1000,
      codeLineThreshold: config.codeLineThreshold ?? 20,
    };
  }

  /**
   * Analyze a chat request
   *
   * @param request - Chat request to analyze
   * @returns Request analysis
   *
   * Performance: <10ms per request
   */
  async analyze(request: ChatRequest): Promise<RequestAnalysis> {
    const startTime = performance.now();

    // Extract full text from messages
    const text = this.extractText(request);

    // Detect complexity
    const complexity = this.detectComplexity(request, text);

    // Detect intent
    const intent = this.detectIntent(request, text);

    // Estimate tokens
    const estimatedTokens = this.estimateTokenCost(request, text);

    // Detect languages
    const languages = this.detectLanguage(text);

    // Detect code snippets
    const codeSnippets = this.detectCode(text);

    // Generate semantic hash
    const semanticHash = this.generateSemanticHash(request, text);

    const latency = performance.now() - startTime;
    console.debug(`Request analysis completed in ${latency.toFixed(2)}ms`);

    return {
      complexity,
      intent,
      estimatedTokens,
      languages,
      hasCode: codeSnippets.length > 0,
      codeSnippets,
      semanticHash,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect complexity level
   *
   * @private
   */
  private detectComplexity(request: ChatRequest, text: string): ComplexityLevel {
    let score = 0;

    // Token count (heavier weight)
    const tokenCount = this.estimateTextTokens(text);
    if (tokenCount > this.config.complexThreshold) {
      score += 4;
    } else if (tokenCount > this.config.simpleThreshold) {
      score += 2;
    }

    // Message count (conversation history)
    if (request.messages.length > 10) {
      score += 3;
    } else if (request.messages.length > 5) {
      score += 2;
    }

    // Code detection
    const codeSnippets = this.detectCode(text);
    const codeLines = codeSnippets.reduce((sum, snippet) => sum + snippet.lineCount, 0);
    if (codeLines > this.config.codeLineThreshold) {
      score += 2;
    } else if (codeLines > 0) {
      score += 1;
    }

    // System message presence
    const hasSystemMessage = request.messages.some(m => m.role === 'system');
    if (hasSystemMessage) {
      score += 1;
    }

    // Low temperature requests are typically more focused/simple
    if (request.temperature !== undefined && request.temperature < 0.3) {
      score -= 1;
    }

    // Determine complexity
    if (score >= 5) {
      return 'complex';
    } else if (score >= 2) {
      return 'moderate';
    }
    return 'simple';
  }

  /**
   * Detect intent type
   *
   * @private
   */
  private detectIntent(request: ChatRequest, text: string): IntentType {
    const lastMessage = request.messages[request.messages.length - 1];
    const content = lastMessage?.content || text;

    // Check for code intent
    if (this.CODE_PATTERNS.some(pattern => pattern.test(content))) {
      return 'code';
    }

    // Check for analysis intent
    if (this.ANALYSIS_PATTERNS.some(pattern => pattern.test(content))) {
      return 'analysis';
    }

    // Check for creative intent
    if (this.CREATIVE_PATTERNS.some(pattern => pattern.test(content))) {
      return 'creative';
    }

    // Default to chat
    return 'chat';
  }

  /**
   * Estimate token cost
   *
   * @private
   */
  private estimateTokenCost(request: ChatRequest, text: string): TokenEstimate {
    const inputTokens = this.estimateTextTokens(text);

    // Estimate output based on complexity and intent
    let outputMultiplier = 1.0;
    if (request.messages.length > 5) {
      outputMultiplier += 0.5; // Conversations need more context
    }

    const lastMessage = request.messages[request.messages.length - 1];
    const content = lastMessage?.content || '';

    // Code requests typically need shorter outputs
    if (this.CODE_PATTERNS.some(pattern => pattern.test(content))) {
      outputMultiplier -= 0.3;
    }

    // Creative requests need longer outputs
    if (this.CREATIVE_PATTERNS.some(pattern => pattern.test(content))) {
      outputMultiplier += 0.5;
    }

    // Max tokens constraint
    const maxTokens = request.maxTokens || 2048;
    const outputTokens = Math.min(
      Math.round(inputTokens * outputMultiplier * 0.75),
      maxTokens
    );

    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    };
  }

  /**
   * Detect programming languages
   *
   * @private
   */
  private detectLanguage(text: string): string[] {
    const languages = new Set<string>();

    for (const [lang, patterns] of Object.entries(this.LANGUAGE_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(text))) {
        languages.add(lang);
      }
    }

    return Array.from(languages);
  }

  /**
   * Detect code snippets
   *
   * @private
   */
  private detectCode(text: string): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];

    // Detect code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const language = match[1] || 'unknown';
      const code = match[2].trim();
      const lineCount = code.split('\n').length;

      snippets.push({
        language,
        code,
        lineCount,
      });
    }

    // Detect inline code (multiple backticks)
    const inlineCodeRegex = /`([^`\n]+)`/g;
    let inlineMatch;

    while ((inlineMatch = inlineCodeRegex.exec(text)) !== null) {
      const code = inlineMatch[1];
      if (code.length > 3) { // Only significant inline code
        snippets.push({
          language: 'unknown',
          code,
          lineCount: 1,
        });
      }
    }

    return snippets;
  }

  /**
   * Generate semantic hash for caching
   *
   * @private
   */
  private generateSemanticHash(request: ChatRequest, text: string): string {
    // Create normalized string for hashing
    const normalized = text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500); // First 500 chars

    // Include key parameters
    const params = [
      request.temperature || 0.7,
      request.maxTokens || 2048,
    ].join('|');

    // Simple hash function
    const combined = normalized + '|' + params;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Extract text from messages
   *
   * @private
   */
  private extractText(request: ChatRequest): string {
    return request.messages
      .map(m => m.content)
      .join('\n\n');
  }

  /**
   * Estimate tokens from text
   * Rough estimation: ~4 characters per token
   *
   * @private
   */
  private estimateTextTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get analyzer configuration
   */
  getConfig(): Required<AnalyzerConfig> {
    return { ...this.config };
  }

  /**
   * Update analyzer configuration
   */
  updateConfig(config: Partial<AnalyzerConfig>): void {
    Object.assign(this.config, config);
  }
}

/**
 * Create request analyzer instance
 */
export function createRequestAnalyzer(config?: AnalyzerConfig): RequestAnalyzer {
  return new RequestAnalyzer(config);
}
