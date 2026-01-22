/**
 * Edge Router
 *
 * Advanced routing for edge functions with smart routing strategies.
 */

import type { IRouteConfig } from '../types/index.js';

export interface IRouteMatch {
  route: IRouteConfig;
  params: Record<string, string>;
}

export class EdgeRouter {
  private routes: Map<string, IRouteConfig>;
  private priorityRoutes: IRouteConfig[];

  constructor() {
    this.routes = new Map();
    this.priorityRoutes = [];
  }

  /**
   * Add route
   */
  public addRoute(route: IRouteConfig): void {
    this.routes.set(route.pattern, route);
    this.rebuildPriorityRoutes();
  }

  /**
   * Remove route
   */
  public removeRoute(pattern: string): boolean {
    const result = this.routes.delete(pattern);
    if (result) {
      this.rebuildPriorityRoutes();
    }
    return result;
  }

  /**
   * Match route
   */
  public matchRoute(url: string): IRouteMatch | null {
    // Try priority routes first
    for (const route of this.priorityRoutes) {
      const match = this.tryMatch(url, route);
      if (match) {
        return match;
      }
    }

    // Try all routes
    for (const route of this.routes.values()) {
      const match = this.tryMatch(url, route);
      if (match) {
        return match;
      }
    }

    return null;
  }

  /**
   * Try to match URL against route
   */
  private tryMatch(url: string, route: IRouteConfig): IRouteMatch | null {
    // Convert pattern to regex
    const pattern = route.pattern
      .replace(/\*/g, '.*')
      .replace(/:([^/]+)/g, '(?<$1>[^/]+)');

    const regex = new RegExp(`^${pattern}$`);
    const match = url.match(regex);

    if (match) {
      return {
        route,
        params: match.groups ?? {}
      };
    }

    return null;
  }

  /**
   * Rebuild priority routes
   */
  private rebuildPriorityRoutes(): void {
    this.priorityRoutes = Array.from(this.routes.values())
      .filter(route => route.rateLimit !== undefined)
      .sort((a, b) => (b.rateLimit ?? 0) - (a.rateLimit ?? 0));
  }

  /**
   * Get all routes
   */
  public getAllRoutes(): IRouteConfig[] {
    return Array.from(this.routes.values());
  }

  /**
   * Clear all routes
   */
  public clearRoutes(): void {
    this.routes.clear();
    this.priorityRoutes = [];
  }

  /**
   * Validate route
   */
  public validateRoute(route: IRouteConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!route.pattern) {
      errors.push('Route pattern is required');
    }

    if (route.rateLimit !== undefined && route.rateLimit < 0) {
      errors.push('Rate limit must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Group routes by prefix
   */
  public groupRoutesByPrefix(): Map<string, IRouteConfig[]> {
    const groups = new Map<string, IRouteConfig[]>();

    for (const route of this.routes.values()) {
      const prefix = route.pattern.split('/')[1] ?? '';
      if (!groups.has(prefix)) {
        groups.set(prefix, []);
      }
      groups.get(prefix)!.push(route);
    }

    return groups;
  }

  /**
   * Find conflicting routes
   */
  public findConflicts(): Array<{ route1: string; route2: string }> {
    const conflicts: Array<{ route1: string; route2: string }> = [];
    const routes = Array.from(this.routes.entries());

    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        const entry1 = routes[i];
        const entry2 = routes[j];
        if (!entry1 || !entry2) continue;
        const [pattern1, _route1] = entry1;
        const [pattern2, _route2] = entry2;

        // Check if patterns could match the same URL
        if (this.patternsOverlap(pattern1, pattern2)) {
          conflicts.push({ route1: pattern1, route2: pattern2 });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two route patterns overlap
   */
  private patternsOverlap(pattern1: string, pattern2: string): boolean {
    // Simplified overlap detection
    // A full implementation would be more sophisticated
    // const _regex1 = new RegExp('^' + pattern1.replace(/\*/g, '.*').replace(/:([^/]+)/g, '[^/]+') + '$'); // Unused variable
    // const _regex2 = new RegExp('^' + pattern2.replace(/\*/g, '.*').replace(/:([^/]+)/g, '[^/]+') + '$'); // Unused variable

    // If patterns are identical or one is a wildcard
    if (pattern1 === pattern2 || pattern1 === '*' || pattern2 === '*') {
      return true;
    }

    return false;
  }

  /**
   * Generate route documentation
   */
  public generateDocs(): string {
    let docs = '# Edge Routes\n\n';

    const groups = this.groupRoutesByPrefix();

    for (const [prefix, routes] of groups.entries()) {
      docs += `## ${prefix || '/'}\n\n`;

      for (const route of routes) {
        docs += `### ${route.pattern}\n\n`;

        if (route.functionName) {
          docs += `- **Function**: ${route.functionName}\n`;
        }

        if (route.cachePolicy) {
          docs += `- **Cache Policy**: ${route.cachePolicy}\n`;
        }

        if (route.rateLimit !== undefined) {
          docs += `- **Rate Limit**: ${route.rateLimit} requests/second\n`;
        }

        if (route.cors) {
          docs += `- **CORS**: Enabled\n`;
        }

        docs += '\n';
      }
    }

    return docs;
  }
}

export default EdgeRouter;
