/**
 * Knowledge Sharing Module
 * Exports all knowledge sharing functionality
 */

export { KnowledgeManager } from './manager';
export { generateKnowledgeGraph, calculateArticleSimilarity, recommendArticles } from './discovery';

// ============================================================================
// Re-exports
// ============================================================================

export type {
  KnowledgeArticle,
  ArticleStatus,
  ArticleVisibility,
  ArticleMetadata,
  DifficultyLevel,
  ArticleAttachment,
  CodeSnippet,
  KnowledgeCategory,
  BestPractice,
  PracticeRule,
  PracticeExample,
} from '../types';
