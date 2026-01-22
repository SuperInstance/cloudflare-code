/**
 * Utility functions for the marketplace
 */

import {
  Agent,
  AgentCategory,
  AgentCapability,
  AgentPermission,
  AgentConfig
} from '../types';

// ============================================================================
// ID Generation
// ============================================================================

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

// ============================================================================
// Agent Utilities
// ============================================================================

export function isAgentValid(agent: Agent): boolean {
  return !!(
    agent.config?.name &&
    agent.config?.description &&
    agent.config?.category &&
    agent.code
  );
}

export function getAgentCapabilities(agent: Agent): string[] {
  return agent.config.capabilities.map(cap => cap.toString());
}

export function getAgentPermissions(agent: Agent): string[] {
  return agent.config.permissions.map(perm => perm.toString());
}

export function hasCapability(agent: Agent, capability: AgentCapability): boolean {
  return agent.config.capabilities.includes(capability);
}

export function hasPermission(agent: Agent, permission: AgentPermission): boolean {
  return agent.config.permissions.includes(permission);
}

export function getAgentTools(agent: Agent): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return agent.config.tools.map(tool => ({
    id: tool.id,
    name: tool.name,
    description: tool.description
  }));
}

// ============================================================================
// Category Utilities
// ============================================================================

export function getCategoryLabel(category: AgentCategory): string {
  const labels: Record<AgentCategory, string> = {
    [AgentCategory.CODE_ASSISTANT]: 'Code Assistant',
    [AgentCategory.DATA_ANALYSIS]: 'Data Analysis',
    [AgentCategory.WRITING]: 'Writing',
    [AgentCategory.RESEARCH]: 'Research',
    [AgentCategory.AUTOMATION]: 'Automation',
    [AgentCategory.SECURITY]: 'Security',
    [AgentCategory.TESTING]: 'Testing',
    [AgentCategory.DEVOPS]: 'DevOps',
    [AgentCategory.DESIGN]: 'Design',
    [AgentCategory.PRODUCTIVITY]: 'Productivity',
    [AgentCategory.CUSTOM]: 'Custom'
  };
  return labels[category] || category;
}

export function getCategoryIcon(category: AgentCategory): string {
  const icons: Record<AgentCategory, string> = {
    [AgentCategory.CODE_ASSISTANT]: '💻',
    [AgentCategory.DATA_ANALYSIS]: '📊',
    [AgentCategory.WRITING]: '✍️',
    [AgentCategory.RESEARCH]: '🔍',
    [AgentCategory.AUTOMATION]: '⚙️',
    [AgentCategory.SECURITY]: '🔒',
    [AgentCategory.TESTING]: '🧪',
    [AgentCategory.DEVOPS]: '🚀',
    [AgentCategory.DESIGN]: '🎨',
    [AgentCategory.PRODUCTIVITY]: '⚡',
    [AgentCategory.CUSTOM]: '🔧'
  };
  return icons[category] || '🤖';
}

export function getAllCategories(): AgentCategory[] {
  return Object.values(AgentCategory);
}

// ============================================================================
// Capability Utilities
// ============================================================================

export function getCapabilityLabel(capability: AgentCapability): string {
  const labels: Record<AgentCapability, string> = {
    [AgentCapability.TEXT_GENERATION]: 'Text Generation',
    [AgentCapability.CODE_GENERATION]: 'Code Generation',
    [AgentCapability.DATA_ANALYSIS]: 'Data Analysis',
    [AgentCapability.TOOL_USE]: 'Tool Use',
    [AgentCapability.WEB_SEARCH]: 'Web Search',
    [AgentCapability.FILE_OPERATIONS]: 'File Operations',
    [AgentCapability.API_INTEGRATION]: 'API Integration',
    [AgentCapability.DATABASE_ACCESS]: 'Database Access',
    [AgentCapability.IMAGE_PROCESSING]: 'Image Processing',
    [AgentCapability.MULTIMODAL]: 'Multimodal'
  };
  return labels[capability] || capability;
}

// ============================================================================
// Permission Utilities
// ============================================================================

export function getPermissionLabel(permission: AgentPermission): string {
  const labels: Record<AgentPermission, string> = {
    [AgentPermission.READ]: 'Read',
    [AgentPermission.WRITE]: 'Write',
    [AgentPermission.EXECUTE]: 'Execute',
    [AgentPermission.NETWORK]: 'Network',
    [AgentPermission.FILE_SYSTEM]: 'File System',
    [AgentPermission.ENVIRONMENT]: 'Environment'
  };
  return labels[permission] || permission;
}

// ============================================================================
// Version Utilities
// ============================================================================

export function compareVersions(v1: string, v2: string): number {
  const [major1, minor1, patch1] = v1.split('.').map(Number);
  const [major2, minor2, patch2] = v2.split('.').map(Number);

  if (major1 !== major2) return major1 - major2;
  if (minor1 !== minor2) return minor1 - minor2;
  return patch1 - patch2;
}

export function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

export function bumpMajor(version: string): string {
  const [major] = version.split('.').map(Number);
  return `${major + 1}.0.0`;
}

export function bumpMinor(version: string): string {
  const [major, minor] = version.split('.').map(Number);
  return `${major}.${minor + 1}.0`;
}

export function bumpPatch(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

// ============================================================================
// Rating Utilities
// ============================================================================

export function calculateAverageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function getRatingStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5 ? 1 : 0;
  const emptyStars = 5 - fullStars - halfStar;

  return '⭐'.repeat(fullStars) + (halfStar ? '⭒' : '') + '☆'.repeat(emptyStars);
}

// ============================================================================
// Statistics Utilities
// ============================================================================

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

// ============================================================================
// Date Utilities
// ============================================================================

export function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const isFuture = date > now;
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return isFuture ? 'today' : 'today';
  if (diffDays === 1) return isFuture ? 'tomorrow' : 'yesterday';
  if (diffDays < 7) return isFuture ? `in ${diffDays} days` : `${diffDays} days ago`;
  if (diffDays < 30) return isFuture ? `in ${Math.floor(diffDays / 7)} weeks` : `${Math.floor(diffDays / 7)} weeks ago`;

  return date.toLocaleDateString();
}

// ============================================================================
// Search Utilities
// ============================================================================

export function escapeSearchQuery(query: string): string {
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightMatches(text: string, query: string): string {
  const escaped = escapeSearchQuery(query);
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

// ============================================================================
// Validation Utilities
// ============================================================================

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

// ============================================================================
// Code Utilities
// ============================================================================

export function extractImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

export function extractExports(code: string): string[] {
  const exports: string[] = [];
  const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
  let match;

  while ((match = exportRegex.exec(code)) !== null) {
    exports.push(match[1]);
  }

  return exports;
}

export function countLines(code: string): number {
  return code.split('\n').length;
}

export function countFunctions(code: string): number {
  const functionRegex = /(?:function\s+\w+|=>\s*{|\(\)\s*=>)/g;
  const matches = code.match(functionRegex);
  return matches ? matches.length : 0;
}

// ============================================================================
// File Utilities
// ============================================================================

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function isValidFilename(filename: string): boolean {
  return /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename);
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

// ============================================================================
// Color Utilities
// ============================================================================

export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

export function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// ============================================================================
// Pagination Utilities
// ============================================================================

export function calculatePagination(
  total: number,
  page: number,
  limit: number
): {
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage: number | null;
  prevPage: number | null;
} {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    totalPages,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null
  };
}

export function getPaginationRange(currentPage: number, totalPages: number, maxVisible: number = 5): number[] {
  const range: number[] = [];
  const halfVisible = Math.floor(maxVisible / 2);

  let start = Math.max(1, currentPage - halfVisible);
  let end = Math.min(totalPages, currentPage + halfVisible);

  if (currentPage <= halfVisible) {
    end = Math.min(totalPages, maxVisible);
  }

  if (currentPage >= totalPages - halfVisible) {
    start = Math.max(1, totalPages - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    range.push(i);
  }

  return range;
}

// ============================================================================
// Array Utilities
// ============================================================================

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

// ============================================================================
// Object Utilities
// ============================================================================

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      result[key] = deepMerge(
        (target as any)[key],
        (source as any)[key]
      );
    } else {
      (result as any)[key] = (source as any)[key];
    }
  }

  return result;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

// ============================================================================
// String Utilities
// ============================================================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function truncate(text: string, length: number, suffix: string = '...'): string {
  if (text.length <= length) return text;
  return text.slice(0, length - suffix.length) + suffix;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map(word => capitalize(word))
    .join(' ');
}

// ============================================================================
// Async Utilities
// ============================================================================

export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError;
}

export async function parallel<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

// ============================================================================
// Validation Helper
// ============================================================================

export function createValidationError(
  field: string,
  message: string,
  code?: string
): {
  field: string;
  message: string;
  code?: string;
} {
  return { field, message, code };
}

export function formatValidationErrors(errors: Array<{
  field: string;
  message: string;
  code?: string;
}>): string {
  return errors
    .map(err => `${err.field}: ${err.message}`)
    .join(', ');
}
