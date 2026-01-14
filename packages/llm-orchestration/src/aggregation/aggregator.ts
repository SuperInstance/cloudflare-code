/**
 * Response Aggregator - Synthesize and aggregate responses from multiple LLMs
 */

import { EventEmitter } from 'eventemitter3';
import {
  LLMResponse,
  LLMProvider,
  AggregationMethod,
  AggregationConfig,
  AggregatedResponse,
  QualityScore,
  LLMOrchestrationError,
} from '../types/index.js';

// ============================================================================
// Aggregator Configuration
// ============================================================================

export interface ResponseSource {
  model: string;
  provider: LLMProvider;
  response: string;
  weight: number;
  quality: QualityScore;
  metadata?: Record<string, unknown>;
}

export interface AggregatorOptions {
  defaultMethod: AggregationMethod;
  enableQualityScoring: boolean;
  enableConflictResolution: boolean;
  minAgreementThreshold: number;
  maxResponsesToAggregate: number;
}

// ============================================================================
// Response Aggregator Class
// ============================================================================

export class ResponseAggregator {
  private config: Required<AggregatorOptions>;
  private events: EventEmitter;
  private aggregationHistory: Array<{
    timestamp: number;
    method: AggregationMethod;
    sources: ResponseSource[];
    result: AggregatedResponse;
  }>;

  constructor(options: Partial<AggregatorOptions> = {}) {
    this.config = {
      defaultMethod: options.defaultMethod || 'weighted',
      enableQualityScoring: options.enableQualityScoring ?? true,
      enableConflictResolution: options.enableConflictResolution ?? true,
      minAgreementThreshold: options.minAgreementThreshold ?? 0.6,
      maxResponsesToAggregate: options.maxResponsesToAggregate ?? 5,
    };
    this.events = new EventEmitter();
    this.aggregationHistory = [];
  }

  // ========================================================================
  // Main Aggregation Method
  // ========================================================================

  public async aggregate(
    responses: LLMResponse[],
    config: AggregationConfig
  ): Promise<AggregatedResponse> {
    if (responses.length === 0) {
      throw new LLMOrchestrationError(
        'No responses to aggregate',
        'NO_RESPONSES'
      );
    }

    if (responses.length === 1) {
      return this.singleResponse(responses[0]);
    }

    // Limit number of responses
    const limitedResponses = responses.slice(0, this.config.maxResponsesToAggregate);

    // Extract response texts
    const sources = await this.buildSources(limitedResponses, config);

    // Apply aggregation method
    const result = await this.applyAggregationMethod(sources, config);

    // Record history
    this.aggregationHistory.push({
      timestamp: Date.now(),
      method: config.method,
      sources,
      result,
    });

    // Emit event
    this.events.emit('aggregation:complete', {
      method: config.method,
      sourceCount: sources.length,
      result,
    });

    return result;
  }

  // ========================================================================
  // Source Building
  // ========================================================================

  private async buildSources(
    responses: LLMResponse[],
    config: AggregationConfig
  ): Promise<ResponseSource[]> {
    const sources: ResponseSource[] = [];

    for (const response of responses) {
      const text = this.extractResponseText(response);
      const quality = this.config.enableQualityScoring
        ? await this.scoreQuality(text, response)
        : this.getDefaultQuality();

      sources.push({
        model: response.model,
        provider: this.extractProvider(response.model),
        response: text,
        weight: config.weights?.[response.model] || 1.0,
        quality,
        metadata: {
          id: response.id,
          usage: response.usage,
        },
      });
    }

    // Normalize weights
    const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight > 0) {
      for (const source of sources) {
        source.weight /= totalWeight;
      }
    }

    return sources;
  }

  private extractResponseText(response: LLMResponse): string {
    if (response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      if (typeof choice.message.content === 'string') {
        return choice.message.content;
      } else if (Array.isArray(choice.message.content)) {
        return choice.message.content
          .filter((part) => part.type === 'text')
          .map((part) => (part as { type: 'text'; text: string }).text)
          .join('\n');
      }
    }
    return '';
  }

  private extractProvider(model: string): LLMProvider {
    if (model.startsWith('gpt')) return 'openai';
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('gemini')) return 'google';
    if (model.startsWith('llama')) return 'meta';
    if (model.startsWith('mistral')) return 'mistral';
    return 'custom';
  }

  private getDefaultQuality(): QualityScore {
    return {
      overall: 0.5,
      relevance: 0.5,
      accuracy: 0.5,
      completeness: 0.5,
      coherence: 0.5,
      details: {},
    };
  }

  // ========================================================================
  // Aggregation Methods
  // ========================================================================

  private async applyAggregationMethod(
    sources: ResponseSource[],
    config: AggregationConfig
  ): Promise<AggregatedResponse> {
    switch (config.method) {
      case 'consensus':
        return this.aggregateConsensus(sources, config);

      case 'voting':
        return this.aggregateVoting(sources, config);

      case 'weighted':
        return this.aggregateWeighted(sources, config);

      case 'ranked':
        return this.aggregateRanked(sources, config);

      case 'ensemble':
        return this.aggregateEnsemble(sources, config);

      default:
        return this.aggregateWeighted(sources, config);
    }
  }

  private async aggregateConsensus(
    sources: ResponseSource[],
    config: AggregationConfig
  ): Promise<AggregatedResponse> {
    // Split responses into sentences/segments
    const segments = sources.map((s) => this.splitIntoSegments(s.response));

    // Find consensus segments
    const consensusSegments: string[] = [];
    const maxLength = Math.max(...segments.map((s) => s.length));

    for (let i = 0; i < maxLength; i++) {
      const segmentOptions = segments
        .map((s, idx) => (s[i] ? { segment: s[i], source: sources[idx] } : null))
        .filter((s) => s !== null) as Array<{ segment: string; source: ResponseSource }>;

      if (segmentOptions.length === 0) continue;

      // Calculate similarity between segments
      const similarities = this.calculateSegmentSimilarities(segmentOptions);

      // Check for consensus
      const maxSimilarity = Math.max(...similarities.map((s) => s.similarity));

      if (maxSimilarity >= (config.threshold ?? 0.7)) {
        // Use the most similar segment
        const best = similarities.find((s) => s.similarity === maxSimilarity);
        if (best) {
          consensusSegments.push(best.segment);
        }
      } else if (config.strategy === 'best') {
        // Use highest quality segment
        const best = segmentOptions.sort(
          (a, b) => b.source.quality.overall - a.source.quality.overall
        )[0];
        consensusSegments.push(best.segment);
      } else if (config.strategy === 'majority') {
        // Use most common segment
        const best = this.findMostCommonSegment(segmentOptions);
        consensusSegments.push(best.segment);
      }
    }

    const consensus = consensusSegments.join(' ');

    // Calculate consensus level
    const consensusScore = this.calculateConsensusScore(sources, consensus);

    return {
      response: consensus,
      confidence: consensusScore,
      sources,
      consensus: consensusScore,
      reasoning: 'Built consensus by finding similar segments across responses',
      metadata: {
        method: 'consensus',
        segmentCount: consensusSegments.length,
      },
    };
  }

  private async aggregateVoting(
    sources: ResponseSource[],
    config: AggregationConfig
  ): Promise<AggregatedResponse> {
    // Token-level voting
    const tokens = sources.map((s) => this.tokenize(s.response));
    const maxLength = Math.max(...tokens.map((t) => t.length));

    const votedTokens: string[] = [];

    for (let i = 0; i < maxLength; i++) {
      const tokenOptions = tokens
        .map((t, idx) => (t[i] ? { token: t[i], source: sources[idx] } : null))
        .filter((t) => t !== null) as Array<{ token: string; source: ResponseSource }>;

      if (tokenOptions.length === 0) break;

      // Count token frequencies
      const counts = new Map<string, number>();
      for (const { token, source } of tokenOptions) {
        const weight = source.weight;
        counts.set(token, (counts.get(token) || 0) + weight);
      }

      // Select most common token
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      votedTokens.push(sorted[0][0]);
    }

    const response = this.detokenize(votedTokens);

    // Calculate agreement level
    const agreement = this.calculateAgreementLevel(tokens, votedTokens);

    return {
      response,
      confidence: agreement,
      sources,
      consensus: agreement,
      reasoning: 'Applied token-level voting across responses',
      metadata: {
        method: 'voting',
        totalTokens: votedTokens.length,
      },
    };
  }

  private async aggregateWeighted(
    sources: ResponseSource[],
    config: AggregationConfig
  ): Promise<AggregatedResponse> {
    // Use weighted quality scores to combine responses
    const totalQuality = sources.reduce(
      (sum, s) => sum + s.quality.overall * s.weight,
      0
    );

    // Build weighted response
    const segments = sources.map((s) => this.splitIntoSegments(s.response));
    const maxLength = Math.max(...segments.map((s) => s.length));

    const weightedSegments: string[] = [];

    for (let i = 0; i < maxLength; i++) {
      const segmentOptions = segments
        .map((s, idx) => (s[i] ? { segment: s[i], source: sources[idx] } : null))
        .filter((s) => s !== null) as Array<{ segment: string; source: ResponseSource }>;

      if (segmentOptions.length === 0) continue;

      // Select segment based on weighted quality
      const best = segmentOptions.sort((a, b) => {
        const scoreA = a.source.quality.overall * a.source.weight;
        const scoreB = b.source.quality.overall * b.source.weight;
        return scoreB - scoreA;
      })[0];

      weightedSegments.push(best.segment);
    }

    const response = weightedSegments.join(' ');

    // Calculate confidence
    const confidence = totalQuality / sources.reduce((sum, s) => sum + s.weight, 0);

    return {
      response,
      confidence,
      sources,
      consensus: confidence,
      reasoning: 'Combined responses using weighted quality scores',
      metadata: {
        method: 'weighted',
        totalQuality,
      },
    };
  }

  private async aggregateRanked(
    sources: ResponseSource[],
    config: AggregationConfig
  ): Promise<AggregatedResponse> {
    // Rank sources by quality
    const ranked = [...sources].sort((a, b) => b.quality.overall - a.quality.overall);

    // Select best response
    const best = ranked[0];

    // Calculate confidence based on quality gap
    const secondBest = ranked[1];
    const confidence = secondBest
      ? best.quality.overall / (best.quality.overall + secondBest.quality.overall)
      : best.quality.overall;

    return {
      response: best.response,
      confidence,
      sources: ranked.map((s) => ({
        ...s,
        weight: s.weight,
      })),
      consensus: confidence,
      reasoning: `Selected highest quality response from ${best.model}`,
      metadata: {
        method: 'ranked',
        ranking: ranked.map((s) => ({ model: s.model, score: s.quality.overall })),
      },
    };
  }

  private async aggregateEnsemble(
    sources: ResponseSource[],
    config: AggregationConfig
  ): Promise<AggregatedResponse> {
    // Combine multiple strategies
    const consensus = await this.aggregateConsensus(sources, config);
    const weighted = await this.aggregateWeighted(sources, config);
    const ranked = await this.aggregateRanked(sources, config);

    // Vote on best approach
    const approaches = [
      { response: consensus, score: consensus.consensus },
      { response: weighted, score: weighted.confidence },
      { response: ranked, score: ranked.confidence },
    ];

    const best = approaches.sort((a, b) => b.score - a.score)[0];

    return {
      response: best.response.response,
      confidence: best.score,
      sources,
      consensus: best.score,
      reasoning: `Selected best aggregation approach from ensemble of methods`,
      metadata: {
        method: 'ensemble',
        approaches: {
          consensus: consensus.consensus,
          weighted: weighted.confidence,
          ranked: ranked.confidence,
        },
      },
    };
  }

  // ========================================================================
  // Quality Scoring
  // ========================================================================

  private async scoreQuality(
    response: string,
    llmResponse: LLMResponse
  ): Promise<QualityScore> {
    const scores: QualityScore = {
      overall: 0,
      relevance: 0,
      accuracy: 0,
      completeness: 0,
      coherence: 0,
      details: {},
    };

    // Coherence: measure text flow and structure
    scores.coherence = this.scoreCoherence(response);

    // Completeness: measure if response seems complete
    scores.completeness = this.scoreCompleteness(response);

    // Relevance: would need context to properly score, using heuristics
    scores.relevance = this.scoreRelevance(response);

    // Accuracy: would need ground truth, using heuristics
    scores.accuracy = this.scoreAccuracy(response);

    // Overall: weighted average
    scores.overall =
      scores.coherence * 0.3 +
      scores.completeness * 0.3 +
      scores.relevance * 0.2 +
      scores.accuracy * 0.2;

    scores.details = {
      length: response.length,
      sentenceCount: response.split(/[.!?]+/).length,
      avgSentenceLength: response.length / Math.max(1, response.split(/[.!?]+/).length),
    };

    return scores;
  }

  private scoreCoherence(response: string): number {
    // Check for coherent structure
    let score = 0.5;

    // Has proper sentence structure
    const sentences = response.split(/[.!?]+/);
    if (sentences.length > 1) score += 0.1;

    // Has transitions
    const transitions = ['however', 'therefore', 'furthermore', 'moreover', 'consequently'];
    const hasTransition = transitions.some((t) => response.toLowerCase().includes(t));
    if (hasTransition) score += 0.1;

    // Paragraphs are well-formed
    const paragraphs = response.split('\n\n');
    if (paragraphs.length > 1 && paragraphs.every((p) => p.trim().length > 0)) {
      score += 0.1;
    }

    // No repetitive phrases
    const words = response.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / Math.max(1, words.length);
    if (uniqueRatio > 0.5) score += 0.2;

    return Math.min(1, score);
  }

  private scoreCompleteness(response: string): number {
    let score = 0.5;

    // Not too short
    if (response.length > 100) score += 0.1;

    // Has ending
    const endings = ['conclusion', 'summary', 'finally', 'in conclusion', 'to summarize'];
    const hasEnding = endings.some((e) => response.toLowerCase().includes(e));
    if (hasEnding || response.trim().endsWith('.')) score += 0.1;

    // Balanced length
    if (response.length > 50 && response.length < 2000) score += 0.2;

    // Has structure
    if (response.includes('\n') || response.split(/[.!?]+/).length > 2) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private scoreRelevance(response: string): number {
    // Heuristic scoring (would need actual query for proper scoring)
    let score = 0.5;

    // Not off-topic (e.g., not apologizing for unrelated things)
    if (!response.toLowerCase().includes("i'm sorry i don't understand")) {
      score += 0.2;
    }

    // Direct answer (not just saying "it depends")
    if (!response.toLowerCase().startsWith('it depends')) {
      score += 0.1;
    }

    // Contains concrete information
    const hasNumbers = /\d+/.test(response);
    const hasExamples = /for example|such as|including/.test(response.toLowerCase());
    if (hasNumbers || hasExamples) score += 0.2;

    return Math.min(1, score);
  }

  private scoreAccuracy(response: string): number {
    // Heuristic scoring (would need fact-checking for proper scoring)
    let score = 0.5;

    // No obvious hallucinations markers
    const hallucinationMarkers = [
      'i cannot verify',
      'i am not sure',
      'it might be',
      'possibly',
    ];
    const hasUncertainty = hallucinationMarkers.some((m) =>
      response.toLowerCase().includes(m)
    );
    if (!hasUncertainty) score += 0.2;

    // Seems confident
    const confidenceMarkers = ['definitely', 'certainly', 'clearly', 'absolutely'];
    const hasConfidence = confidenceMarkers.some((m) =>
      response.toLowerCase().includes(m)
    );
    if (hasConfidence) score += 0.1;

    // Uses specific details
    if (response.includes(',') || response.includes(';')) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  // ========================================================================
  // Conflict Resolution
  // ========================================================================

  private resolveConflicts(sources: ResponseSource[]): ResponseSource[] {
    if (!this.config.enableConflictResolution) return sources;

    // Find conflicting responses
    const conflicts = this.findConflicts(sources);

    // Resolve conflicts
    for (const conflict of conflicts) {
      const resolved = this.resolveConflict(conflict);
      if (resolved) {
        // Update sources with resolved version
        const index = sources.findIndex((s) => s.model === conflict.model);
        if (index !== -1) {
          sources[index] = resolved;
        }
      }
    }

    return sources;
  }

  private findConflicts(sources: ResponseSource[]): ResponseSource[] {
    // Simple conflict detection based on low similarity
    const conflicts: ResponseSource[] = [];

    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const similarity = this.calculateSimilarity(
          sources[i].response,
          sources[j].response
        );

        if (similarity < 0.3) {
          // Low similarity indicates potential conflict
          if (sources[i].quality.overall < sources[j].quality.overall) {
            conflicts.push(sources[i]);
          } else {
            conflicts.push(sources[j]);
          }
        }
      }
    }

    return conflicts;
  }

  private resolveConflict(source: ResponseSource): ResponseSource | null {
    // Prefer higher quality responses
    if (source.quality.overall < 0.5) {
      // Low quality response, mark for potential exclusion
      return {
        ...source,
        weight: source.weight * 0.5, // Reduce weight
      };
    }

    return null; // No resolution needed
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  private singleResponse(response: LLMResponse): AggregatedResponse {
    const text = this.extractResponseText(response);

    return {
      response: text,
      confidence: 0.5, // Default confidence for single response
      sources: [
        {
          model: response.model,
          provider: this.extractProvider(response.model),
          response: text,
          weight: 1.0,
          quality: this.getDefaultQuality(),
        },
      ],
      consensus: 1.0, // No disagreement with single response
      reasoning: 'Single response, no aggregation performed',
      metadata: {
        method: 'single',
      },
    };
  }

  private splitIntoSegments(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private calculateSegmentSimilarities(
    segments: Array<{ segment: string; source: ResponseSource }>
  ): Array<{ segment: string; source: ResponseSource; similarity: number }> {
    return segments.map((item1, idx) => {
      let totalSimilarity = 0;
      let comparisons = 0;

      for (let i = 0; i < segments.length; i++) {
        if (i === idx) continue;
        const item2 = segments[i];
        const similarity = this.calculateSimilarity(item1.segment, item2.segment);
        totalSimilarity += similarity;
        comparisons++;
      }

      return {
        segment: item1.segment,
        source: item1.source,
        similarity: comparisons > 0 ? totalSimilarity / comparisons : 0,
      };
    });
  }

  private findMostCommonSegment(
    segments: Array<{ segment: string; source: ResponseSource }>
  ): { segment: string; source: ResponseSource } {
    const counts = new Map<string, number>();

    for (const { segment } of segments) {
      counts.set(segment, (counts.get(segment) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon = segments[0];

    for (const { segment, source } of segments) {
      const count = counts.get(segment) || 0;
      if (count > maxCount) {
        maxCount = count;
        mostCommon = { segment, source };
      }
    }

    return mostCommon;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateConsensusScore(sources: ResponseSource[], consensus: string): number {
    let totalSimilarity = 0;

    for (const source of sources) {
      totalSimilarity += this.calculateSimilarity(source.response, consensus);
    }

    return sources.length > 0 ? totalSimilarity / sources.length : 0;
  }

  private calculateAgreementLevel(
    tokens: string[][],
    votedTokens: string[]
  ): number {
    let agreements = 0;
    let total = 0;

    for (let i = 0; i < votedTokens.length; i++) {
      const voted = votedTokens[i];
      const options = tokens.map((t) => t[i]).filter((t) => t !== undefined);

      if (options.length === 0) continue;

      const matches = options.filter((t) => t === voted).length;
      agreements += matches / options.length;
      total++;
    }

    return total > 0 ? agreements / total : 0;
  }

  private tokenize(text: string): string[] {
    return text.split(/(\s+|[.,!?;:]+)/).filter((t) => t.trim().length > 0);
  }

  private detokenize(tokens: string[]): string {
    return tokens.join('');
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

  public getAnalytics() {
    return {
      totalAggregations: this.aggregationHistory.length,
      methodUsage: this.getMethodUsage(),
      averageConfidence: this.getAverageConfidence(),
      recentAggregations: this.aggregationHistory.slice(-10),
    };
  }

  private getMethodUsage(): Record<string, number> {
    const usage: Record<string, number> = {};

    for (const record of this.aggregationHistory) {
      usage[record.method] = (usage[record.method] || 0) + 1;
    }

    return usage;
  }

  private getAverageConfidence(): number {
    if (this.aggregationHistory.length === 0) return 0;

    const total = this.aggregationHistory.reduce(
      (sum, record) => sum + record.result.confidence,
      0
    );

    return total / this.aggregationHistory.length;
  }
}
