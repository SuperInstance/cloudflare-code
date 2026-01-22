/**
 * Knowledge Discovery
 * Advanced search, recommendations, and knowledge graph
 */

// @ts-nocheck - Knowledge discovery with unused parameters
import type {
  KnowledgeArticle,
  CodeSnippet,
  BestPractice,
} from '../types';

// ============================================================================
// Knowledge Graph
// ============================================================================

export interface KnowledgeGraphNode {
  id: string;
  type: 'article' | 'snippet' | 'practice' | 'category' | 'tag';
  title: string;
  weight: number;
  connections: Set<string>;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  weight: number;
  type: 'related' | 'category' | 'tag' | 'reference';
}

/**
 * Generate a knowledge graph from articles, snippets, and practices
 */
export function generateKnowledgeGraph(
  articles: KnowledgeArticle[],
  snippets: CodeSnippet[],
  practices: BestPractice[]
  ): {
  nodes: Map<string, KnowledgeGraphNode>;
  edges: KnowledgeGraphEdge[];
} {
  const nodes = new Map<string, KnowledgeGraphNode>();
  const edges: KnowledgeGraphEdge[] = [];

  // Create article nodes
  for (const article of articles) {
    nodes.set(article.id, {
      id: article.id,
      type: 'article',
      title: article.title,
      weight: article.views + article.likes,
      connections: new Set(),
    });

    // Connect by category
    for (const [otherId, other] of nodes.entries()) {
      if (other.id !== article.id && other.type === 'article') {
        const otherArticle = articles.find((a) => a.id === otherId);
        if (otherArticle && otherArticle.category === article.category) {
          edges.push({
            source: article.id,
            target: otherId,
            weight: 0.5,
            type: 'category',
          });
          nodes.get(article.id)!.connections.add(otherId);
          nodes.get(otherId)!.connections.add(article.id);
        }
      }
    }

    // Connect by tags
    for (const tag of article.tags) {
      for (const [otherId, other] of nodes.entries()) {
        if (other.id !== article.id && other.type === 'article') {
          const otherArticle = articles.find((a) => a.id === otherId);
          if (otherArticle && otherArticle.tags.includes(tag)) {
            const existingEdge = edges.find(
              (e) =>
                (e.source === article.id && e.target === otherId) ||
                (e.source === otherId && e.target === article.id)
            );

            if (!existingEdge) {
              edges.push({
                source: article.id,
                target: otherId,
                weight: 0.3,
                type: 'tag',
              });
              nodes.get(article.id)!.connections.add(otherId);
              nodes.get(otherId)!.connections.add(article.id);
            }
          }
        }
      }
    }
  }

  // Create snippet nodes
  for (const snippet of snippets) {
    nodes.set(snippet.id, {
      id: snippet.id,
      type: 'snippet',
      title: snippet.title,
      weight: snippet.views + snippet.upvotes,
      connections: new Set(),
    });

    // Connect snippets to articles by language/tag
    for (const [articleId, article] of nodes.entries()) {
      if (article.type === 'article') {
        const articleData = articles.find((a) => a.id === articleId);
        if (articleData) {
          // Check for language match
          if (articleData.metadata.language === snippet.language) {
            edges.push({
              source: snippet.id,
              target: articleId,
              weight: 0.2,
              type: 'reference',
            });
            nodes.get(snippet.id)!.connections.add(articleId);
            nodes.get(articleId)!.connections.add(snippet.id);
          }

          // Check for tag match
          for (const tag of snippet.tags) {
            if (articleData.tags.includes(tag)) {
              edges.push({
                source: snippet.id,
                target: articleId,
                weight: 0.3,
                type: 'tag',
              });
              nodes.get(snippet.id)!.connections.add(articleId);
              nodes.get(articleId)!.connections.add(snippet.id);
            }
          }
        }
      }
    }
  }

  // Create practice nodes
  for (const practice of practices) {
    nodes.set(practice.id, {
      id: practice.id,
      type: 'practice',
      title: practice.title,
      weight: 1,
      connections: new Set(),
    });

    // Connect practices to articles by category
    for (const [articleId, article] of nodes.entries()) {
      if (article.type === 'article') {
        const articleData = articles.find((a) => a.id === articleId);
        if (articleData && articleData.category === practice.category) {
          edges.push({
            source: practice.id,
            target: articleId,
            weight: 0.4,
            type: 'category',
          });
          nodes.get(practice.id)!.connections.add(articleId);
          nodes.get(articleId)!.connections.add(practice.id);
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Calculate similarity between two articles
 */
export function calculateArticleSimilarity(
  article1: KnowledgeArticle,
  article2: KnowledgeArticle
  ): number {
  let similarity = 0;

  // Category similarity (0-0.3)
  if (article1.category === article2.category) {
    similarity += 0.3;
  }

  // Tag similarity (0-0.4)
  const commonTags = article1.tags.filter((t) => article2.tags.includes(t));
  const totalTags = new Set([...article1.tags, ...article2.tags]).size;
  if (totalTags > 0) {
    similarity += (commonTags.length / totalTags) * 0.4;
  }

  // Content similarity using word overlap (0-0.3)
  const words1 = new Set(extractWords(article1.content));
  const words2 = new Set(extractWords(article2.content));
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size > 0) {
    similarity += (intersection.size / union.size) * 0.3;
  }

  return similarity;
}

/**
 * Recommend articles based on user interests
 */
export function recommendArticles(
  userId: string,
  articles: KnowledgeArticle[],
  userViews: Set<string>,
  userLikes: Set<string>,
  options?: {
    limit?: number;
    excludeViewed?: boolean;
    excludeLiked?: boolean;
  }
  ): KnowledgeArticle[] {
  let candidates = articles.filter((a) => a.status === 'published');

  // Exclude viewed articles if requested
  if (options?.excludeViewed) {
    candidates = candidates.filter((a) => !userViews.has(a.id));
  }

  // Exclude liked articles if requested
  if (options?.excludeLiked) {
    candidates = candidates.filter((a) => !userLikes.has(a.id));
  }

  // Calculate recommendation scores
  const scored = candidates.map((article) => {
    let score = 0;

    // Base score from views and likes
    score += (article.views * 0.5) + (article.likes * 2);

    // Boost for recency
    const daysSinceUpdate = (Date.now() - article.updated) / 86400000;
    score += Math.max(0, 30 - daysSinceUpdate) * 0.1;

    // Similarity to liked articles
    for (const likedId of userLikes) {
      const likedArticle = articles.find((a) => a.id === likedId);
      if (likedArticle) {
        score += calculateArticleSimilarity(article, likedArticle) * 10;
      }
    }

    // Similarity to viewed articles
    for (const viewedId of userViews) {
      const viewedArticle = articles.find((a) => a.id === viewedId);
      if (viewedArticle) {
        score += calculateArticleSimilarity(article, viewedArticle) * 5;
      }
    }

    return { article, score };
  });

  // Sort by score and return top results
  scored.sort((a, b) => b.score - a.score);

  const limit = options?.limit || 10;
  return scored.slice(0, limit).map((s) => s.article);
}

/**
 * Extract words from text
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

/**
 * Find knowledge gaps (topics that need more content)
 */
export function findKnowledgeGaps(
  articles: KnowledgeArticle[],
  categories: string[],
  tags: string[]
  ): {
  categoryGaps: Map<string, number>;
  tagGaps: Map<string, number>;
  recommendations: string[];
} {
  const categoryCount = new Map<string, number>();
  const tagCount = new Map<string, number>();

  // Count articles per category
  for (const article of articles) {
    const count = categoryCount.get(article.category) || 0;
    categoryCount.set(article.category, count + 1);

    // Count tags
    for (const tag of article.tags) {
      const tagCountValue = tagCount.get(tag) || 0;
      tagCount.set(tag, tagCountValue + 1);
    }
  }

  // Find categories with no articles
  const categoryGaps = new Map<string, number>();
  for (const category of categories) {
    const count = categoryCount.get(category) || 0;
    if (count === 0) {
      categoryGaps.set(category, 0);
    }
  }

  // Find tags with few articles
  const tagGaps = new Map<string, number>();
  for (const tag of tags) {
    const count = tagCount.get(tag) || 0;
    if (count < 3) {
      tagGaps.set(tag, count);
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  for (const [category, count] of categoryGaps) {
    recommendations.push(`Create content for category: ${category}`);
  }

  for (const [tag, count] of tagGaps) {
    recommendations.push(
      `Add more articles tagged with: ${tag} (current: ${count})`
    );
  }

  return { categoryGaps, tagGaps, recommendations };
}

/**
 * Build knowledge hierarchy
 */
export function buildKnowledgeHierarchy(
  articles: KnowledgeArticle[],
  categories: Map<string, { name: string; parent?: string }>
  ): {
  hierarchy: Map<string, string[]>;
  rootCategories: string[];
} {
  const hierarchy = new Map<string, string[]>();
  const rootCategories: string[] = [];

  // Build category tree
  for (const [categoryId, category] of categories.entries()) {
    if (!category.parent) {
      rootCategories.push(categoryId);
    } else {
      const children = hierarchy.get(category.parent) || [];
      children.push(categoryId);
      hierarchy.set(category.parent, children);
    }
  }

  return { hierarchy, rootCategories };
}

/**
 * Calculate content quality score
 */
export function calculateContentQuality(
  article: KnowledgeArticle
  ): {
  score: number;
  factors: {
    length: number;
    engagement: number;
    recency: number;
    completeness: number;
  };
  recommendations: string[];
} {
  const factors = {
    length: 0,
    engagement: 0,
    recency: 0,
    completeness: 0,
  };

  const recommendations: string[] = [];

  // Length factor (prefer 500-2000 words)
  const wordCount = article.content.split(/\s+/).length;
  if (wordCount < 500) {
    factors.length = 0.3;
    recommendations.push('Article is too short. Consider adding more detail.');
  } else if (wordCount > 2000) {
    factors.length = 0.7;
  } else {
    factors.length = 1;
  }

  // Engagement factor (views and likes)
  const engagementRatio = article.views > 0 ? article.likes / article.views : 0;
  if (engagementRatio > 0.1) {
    factors.engagement = 1;
  } else if (engagementRatio > 0.05) {
    factors.engagement = 0.7;
  } else {
    factors.engagement = 0.3;
    recommendations.push('Low engagement. Consider improving title or content.');
  }

  // Recency factor
  const daysSinceUpdate = (Date.now() - article.updated) / 86400000;
  if (daysSinceUpdate < 30) {
    factors.recency = 1;
  } else if (daysSinceUpdate < 90) {
    factors.recency = 0.7;
  } else if (daysSinceUpdate < 180) {
    factors.recency = 0.4;
    recommendations.push('Content is getting old. Consider updating it.');
  } else {
    factors.recency = 0.2;
    recommendations.push('Content is outdated. Please review and update.');
  }

  // Completeness factor
  const hasExcerpt = article.excerpt.length > 0;
  const hasTags = article.tags.length > 0;
  const hasMetadata = article.metadata.relatedArticles.length >= 0;

  if (hasExcerpt && hasTags && hasMetadata) {
    factors.completeness = 1;
  } else if (hasExcerpt || hasTags) {
    factors.completeness = 0.6;
    if (!hasExcerpt) recommendations.push('Add an excerpt to the article.');
    if (!hasTags) recommendations.push('Add relevant tags to the article.');
  } else {
    factors.completeness = 0.3;
  }

  // Calculate overall score
  const score =
    (factors.length * 0.25 +
      factors.engagement * 0.35 +
      factors.recency * 0.2 +
      factors.completeness * 0.2) *
    100;

  return { score: Math.round(score), factors, recommendations };
}

/**
 * Generate knowledge insights
 */
export function generateKnowledgeInsights(
  articles: KnowledgeArticle[],
  snippets: CodeSnippet[],
  practices: BestPractice[]
  ): {
  totalContent: number;
  averageQuality: number;
  topCategories: string[];
  trendingTopics: string[];
  contentGaps: string[];
} {
  // Calculate average quality
  let totalQuality = 0;
  let qualityCount = 0;

  for (const article of articles) {
    const { score } = calculateContentQuality(article);
    totalQuality += score;
    qualityCount++;
  }

  const averageQuality = qualityCount > 0 ? totalQuality / qualityCount : 0;

  // Find top categories
  const categoryCount = new Map<string, number>();
  for (const article of articles) {
    const count = categoryCount.get(article.category) || 0;
    categoryCount.set(article.category, count + 1);
  }

  const topCategories = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((e) => e[0]);

  // Find trending topics
  const tagCount = new Map<string, number>();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  for (const article of articles) {
    if (article.updated > weekAgo) {
      for (const tag of article.tags) {
        const count = tagCount.get(tag) || 0;
        tagCount.set(tag, count + 1);
      }
    }
  }

  const trendingTopics = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map((e) => e[0]);

  // Find content gaps
  const allTags = new Set<string>();
  for (const article of articles) {
    for (const tag of article.tags) {
      allTags.add(tag);
    }
  }

  const contentGaps: string[] = [];
  for (const tag of allTags) {
    const count = tagCount.get(tag) || 0;
    if (count < 2) {
      contentGaps.push(tag);
    }
  }

  return {
    totalContent: articles.length + snippets.length + practices.length,
    averageQuality: Math.round(averageQuality),
    topCategories,
    trendingTopics,
    contentGaps,
  };
}
