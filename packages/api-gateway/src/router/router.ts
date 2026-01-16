/**
 * Advanced Request Router
 *
 * Provides sophisticated routing capabilities including:
 * - Path-based routing with wildcards and regex
 * - Header-based routing for A/B testing and feature flags
 * - Weight-based traffic splitting for canary deployments
 * - Blue-green deployment support
 * - Custom routing rules engine
 *
 * Performance targets:
 * - <1ms route matching latency
 * - Support for 100K+ routes
 * - 99.99% routing accuracy
 */

import type {
  GatewayRequest,
  GatewayContext,
  Route,
  RouteMatch,
  Upstream,
  UpstreamTarget,
} from '../types';

/**
 * Routing rule evaluation context
 */
interface RoutingContext {
  request: GatewayRequest;
  gatewayContext: GatewayContext;
  timestamp: number;
}

/**
 * Traffic split configuration
 */
interface TrafficSplit {
  id: string;
  name: string;
  type: 'weighted' | 'header' | 'cookie' | 'ip_hash';
  targets: TrafficTarget[];
  fallback?: string;
  stickySession?: boolean;
}

/**
 * Traffic target
 */
interface TrafficTarget {
  targetId: string;
  weight?: number;
  condition?: RoutingCondition;
  metadata?: Record<string, unknown>;
}

/**
 * Routing condition
 */
interface RoutingCondition {
  type: 'header' | 'query' | 'cookie' | 'ip' | 'custom';
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'exists' | 'in';
  value?: string | string[];
  caseSensitive?: boolean;
}

/**
 * Routing statistics
 */
interface RoutingStats {
  totalRequests: number;
  routesMatched: Record<string, number>;
  targetsSelected: Record<string, number>;
  avgMatchTimeNs: number;
  lastMatchTime: number;
}

/**
 * Advanced Router
 */
export class Router {
  private routes: Map<string, Route>;
  private routeTree: RouteNode;
  private trafficSplits: Map<string, TrafficSplit>;
  private stats: RoutingStats;
  private cache: Map<string, RouteMatch>;
  private cacheEnabled: boolean;
  private cacheMaxSize: number;
  private cacheTTL: number;

  constructor(options: RouterOptions = {}) {
    this.routes = new Map();
    this.trafficSplits = new Map();
    this.routeTree = this.createRouteTree();
    this.stats = {
      totalRequests: 0,
      routesMatched: {},
      targetsSelected: {},
      avgMatchTimeNs: 0,
      lastMatchTime: 0,
    };

    this.cacheEnabled = options.cacheEnabled ?? true;
    this.cacheMaxSize = options.cacheMaxSize ?? 10000;
    this.cacheTTL = options.cacheTTL ?? 60000; // 1 minute
    this.cache = new Map();
  }

  /**
   * Add a route to the router
   */
  addRoute(route: Route): void {
    this.routes.set(route.id, route);
    this.insertIntoRouteTree(route);
    this.invalidateCache();
  }

  /**
   * Remove a route from the router
   */
  removeRoute(routeId: string): boolean {
    const deleted = this.routes.delete(routeId);
    if (deleted) {
      this.rebuildRouteTree();
      this.invalidateCache();
    }
    return deleted;
  }

  /**
   * Get a route by ID
   */
  getRoute(routeId: string): Route | undefined {
    return this.routes.get(routeId);
  }

  /**
   * Get all routes
   */
  getAllRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  /**
   * Add a traffic split configuration
   */
  addTrafficSplit(split: TrafficSplit): void {
    this.trafficSplits.set(split.id, split);
  }

  /**
   * Remove a traffic split configuration
   */
  removeTrafficSplit(splitId: string): boolean {
    return this.trafficSplits.delete(splitId);
  }

  /**
   * Match a request to a route
   */
  async match(request: GatewayRequest, _context: GatewayContext): Promise<RouteMatch | null> {
    const startTime = performance.now();
    this.stats.totalRequests++;
    this.stats.lastMatchTime = startTime;

    // Check cache first
    if (this.cacheEnabled) {
      const cacheKey = this.getCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.matchedAt < this.cacheTTL) {
        this.updateStats(cached.route.id, null, startTime);
        return cached;
      }
    }

    // Match against route tree
    const match = this.matchInTree(request);

    if (match) {
      match.matchedAt = Date.now();

      // Cache the result
      if (this.cacheEnabled) {
        this.cacheMatch(request, match);
      }

      this.updateStats(match.route.id, null, startTime);
      return match;
    }

    return null;
  }

  /**
   * Route request to upstream target
   */
  async routeToTarget(
    request: GatewayRequest,
    context: GatewayContext,
    upstream: Upstream
  ): Promise<UpstreamTarget> {
    const routingContext: RoutingContext = {
      request,
      gatewayContext: context,
      timestamp: Date.now(),
    };

    switch (upstream.type) {
      case 'single':
        return upstream.targets[0];

      case 'load_balanced':
        return this.loadBalance(upstream, routingContext);

      case 'weighted':
        return this.weightedRoute(upstream, routingContext);

      default:
        throw new Error(`Unknown upstream type: ${upstream.type}`);
    }
  }

  /**
   * Route request using traffic split
   */
  async routeWithSplit(
    request: GatewayRequest,
    context: GatewayContext,
    splitId: string
  ): Promise<string | null> {
    const split = this.trafficSplits.get(splitId);
    if (!split) {
      return null;
    }

    const routingContext: RoutingContext = {
      request,
      gatewayContext: context,
      timestamp: Date.now(),
    };

    switch (split.type) {
      case 'weighted':
        return this.weightedSplit(split, routingContext);

      case 'header':
        return this.headerBasedSplit(split, routingContext);

      case 'cookie':
        return this.cookieBasedSplit(split, routingContext);

      case 'ip_hash':
        return this.ipHashSplit(split, routingContext);

      default:
        return split.fallback || null;
    }
  }

  /**
   * Get router statistics
   */
  getStats(): RoutingStats {
    return { ...this.stats };
  }

  /**
   * Reset router statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      routesMatched: {},
      targetsSelected: {},
      avgMatchTimeNs: 0,
      lastMatchTime: 0,
    };
  }

  /**
   * Clear the route cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Match request in route tree (private helper)
   */
  private matchInTree(request: GatewayRequest): RouteMatch | null {
    const segments = request.url.pathname.split('/').filter(Boolean);

    let current = this.routeTree;
    const params: Record<string, string> = {};

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const matched = current.children.get(segment);

      if (matched) {
        current = matched;
      } else if (current.wildcard) {
        params[current.wildcardParam || 'wildcard'] = segment;
        current = current.wildcard;
      } else if (current.regexPattern) {
        const match = segment.match(current.regexPattern);
        if (match) {
          if (current.regexParam) {
            params[current.regexParam] = segment;
          }
          current = current.regexChild!;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    if (current.route) {
      // Check method
      if (!current.route.methods.includes(request.method)) {
        return null;
      }

      return {
        route: current.route,
        params,
        path: request.url.pathname,
        matchedAt: Date.now(),
      };
    }

    return null;
  }

  /**
   * Load balance across targets (private helper)
   */
  private loadBalance(upstream: Upstream, context: RoutingContext): UpstreamTarget {
    const strategy = upstream.strategy || 'round_robin';
    const healthyTargets = upstream.targets.filter(
      t => t.healthStatus !== 'unhealthy'
    );

    if (healthyTargets.length === 0) {
      throw new Error('No healthy targets available');
    }

    switch (strategy) {
      case 'round_robin':
        return this.roundRobinSelect(healthyTargets);

      case 'least_connections':
        return this.leastConnectionsSelect(healthyTargets);

      case 'weighted':
        return this.weightedSelect(healthyTargets);

      case 'ip_hash':
        return this.ipHashSelect(healthyTargets, context);

      case 'random':
        return this.randomSelect(healthyTargets);

      case 'least_latency':
        return this.leastLatencySelect(healthyTargets);

      default:
        return healthyTargets[0];
    }
  }

  /**
   * Weighted routing (private helper)
   */
  private weightedRoute(upstream: Upstream, _context: RoutingContext): UpstreamTarget {
    const healthyTargets = upstream.targets.filter(
      t => t.healthStatus !== 'unhealthy'
    );

    if (healthyTargets.length === 0) {
      throw new Error('No healthy targets available');
    }

    return this.weightedSelect(healthyTargets);
  }

  /**
   * Weighted split (private helper)
   */
  private weightedSplit(split: TrafficSplit, context: RoutingContext): string | null {
    const totalWeight = split.targets.reduce(
      (sum, t) => sum + (t.weight || 1),
      0
    );
    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const target of split.targets) {
      currentWeight += target.weight || 1;
      if (random <= currentWeight) {
        // Check condition if present
        if (target.condition && !this.evaluateCondition(target.condition, context)) {
          continue;
        }
        return target.targetId;
      }
    }

    return split.fallback || null;
  }

  /**
   * Header-based split (private helper)
   */
  private headerBasedSplit(split: TrafficSplit, context: RoutingContext): string | null {
    for (const target of split.targets) {
      if (!target.condition) continue;

      if (this.evaluateCondition(target.condition, context)) {
        return target.targetId;
      }
    }

    return split.fallback || null;
  }

  /**
   * Cookie-based split (private helper)
   */
  private cookieBasedSplit(split: TrafficSplit, context: RoutingContext): string | null {
    const cookies = this.parseCookies(context.request.headers.get('Cookie') || '');

    // Check for sticky session cookie
    if (split.stickySession) {
      const stickyCookie = cookies[`cf_sticky_${split.id}`];
      if (stickyCookie) {
        const target = split.targets.find(t => t.targetId === stickyCookie);
        if (target) {
          return target.targetId;
        }
      }
    }

    // Use weighted split to select target
    const targetId = this.weightedSplit(split, context);

    // Set sticky cookie if enabled
    if (split.stickySession && targetId) {
      // Note: Cookie setting would be done in response handler
    }

    return targetId;
  }

  /**
   * IP hash split (private helper)
   */
  private ipHashSplit(split: TrafficSplit, context: RoutingContext): string | null {
    const ip = context.request.ip;
    const hash = this.hashString(ip);
    const index = hash % split.targets.length;
    return split.targets[index].targetId;
  }

  /**
   * Round-robin selection (private helper)
   */
  private roundRobinSelect(targets: UpstreamTarget[]): UpstreamTarget {
    const index = Math.floor(Date.now() / 1000) % targets.length;
    return targets[index];
  }

  /**
   * Least connections selection (private helper)
   */
  private leastConnectionsSelect(targets: UpstreamTarget[]): UpstreamTarget {
    // In a real implementation, track active connections per target
    // For now, return first target
    return targets[0];
  }

  /**
   * Weighted selection (private helper)
   */
  private weightedSelect(targets: UpstreamTarget[]): UpstreamTarget {
    const totalWeight = targets.reduce((sum, t) => sum + (t.weight || 1), 0);
    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const target of targets) {
      currentWeight += target.weight || 1;
      if (random <= currentWeight) {
        return target;
      }
    }

    return targets[0];
  }

  /**
   * IP hash selection (private helper)
   */
  private ipHashSelect(targets: UpstreamTarget[], context: RoutingContext): UpstreamTarget {
    const ip = context.request.ip;
    const hash = this.hashString(ip);
    const index = hash % targets.length;
    return targets[index];
  }

  /**
   * Random selection (private helper)
   */
  private randomSelect(targets: UpstreamTarget[]): UpstreamTarget {
    const index = Math.floor(Math.random() * targets.length);
    return targets[index];
  }

  /**
   * Least latency selection (private helper)
   */
  private leastLatencySelect(targets: UpstreamTarget[]): UpstreamTarget {
    // In a real implementation, track latency per target
    // For now, return first target
    return targets[0];
  }

  /**
   * Evaluate routing condition (private helper)
   */
  private evaluateCondition(condition: RoutingCondition, context: RoutingContext): boolean {
    let value: string | undefined;

    switch (condition.type) {
      case 'header':
        value = context.request.headers.get(condition.field) || undefined;
        break;

      case 'query':
        value = context.request.query.get(condition.field) || undefined;
        break;

      case 'cookie':
        const cookies = this.parseCookies(context.request.headers.get('Cookie') || '');
        value = cookies[condition.field];
        break;

      case 'ip':
        value = context.request.ip;
        break;

      case 'custom':
        // Custom conditions would be evaluated by provided function
        return false;
    }

    if (value === undefined) {
      return condition.operator === 'exists';
    }

    switch (condition.operator) {
      case 'equals':
        const equalsValue = Array.isArray(condition.value)
          ? condition.value[0]
          : condition.value;
        return condition.caseSensitive
          ? value === equalsValue
          : value.toLowerCase() === equalsValue?.toLowerCase();

      case 'contains':
        const containsValue = Array.isArray(condition.value)
          ? condition.value[0]
          : condition.value;
        return condition.caseSensitive
          ? value.includes(containsValue || '')
          : value.toLowerCase().includes(containsValue?.toLowerCase() || '');

      case 'matches':
        const pattern = Array.isArray(condition.value)
          ? condition.value[0]
          : condition.value;
        return new RegExp(pattern || '', condition.caseSensitive ? '' : 'i').test(value);

      case 'exists':
        return true;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);

      default:
        return false;
    }
  }

  /**
   * Parse cookies (private helper)
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    const pairs = cookieHeader.split(';');

    for (const pair of pairs) {
      const [key, value] = pair.trim().split('=');
      if (key && value) {
        cookies[key] = decodeURIComponent(value);
      }
    }

    return cookies;
  }

  /**
   * Hash string (private helper)
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Create route tree (private helper)
   */
  private createRouteTree(): RouteNode {
    return {
      children: new Map(),
      route: null,
      wildcard: null,
      wildcardParam: null,
      regexChild: null,
      regexParam: null,
    };
  }

  /**
   * Insert route into tree (private helper)
   */
  private insertIntoRouteTree(route: Route): void {
    const segments = route.path.split('/').filter(Boolean);
    let current = this.routeTree;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Check for wildcard parameter
      if (segment.startsWith(':')) {
        const paramName = segment.slice(1);
        if (!current.wildcard) {
          current.wildcard = this.createRouteTree();
          current.wildcardParam = paramName;
        }
        current = current.wildcard;
        continue;
      }

      // Check for regex parameter
      if (segment.startsWith('{') && segment.endsWith('}')) {
        const pattern = segment.slice(1, -1);
        const match = pattern.match(/^(\w+):(.+)$/);
        if (match) {
          const [, paramName, regex] = match;
          if (!current.regexChild) {
            current.regexChild = this.createRouteTree();
            current.regexParam = paramName;
            current.regexPattern = new RegExp(regex);
          }
          current = current.regexChild;
          continue;
        }
      }

      // Regular segment
      let child = current.children.get(segment);
      if (!child) {
        child = this.createRouteTree();
        current.children.set(segment, child);
      }
      current = child;
    }

    current.route = route;
  }

  /**
   * Rebuild route tree (private helper)
   */
  private rebuildRouteTree(): void {
    this.routeTree = this.createRouteTree();
    for (const route of this.routes.values()) {
      this.insertIntoRouteTree(route);
    }
  }

  /**
   * Get cache key (private helper)
   */
  private getCacheKey(request: GatewayRequest): string {
    return `${request.method}:${request.url.pathname}`;
  }

  /**
   * Cache match result (private helper)
   */
  private cacheMatch(request: GatewayRequest, match: RouteMatch): void {
    if (this.cache.size >= this.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const cacheKey = this.getCacheKey(request);
    this.cache.set(cacheKey, match);
  }

  /**
   * Invalidate cache (private helper)
   */
  private invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Update statistics (private helper)
   */
  private updateStats(
    routeId: string | null,
    targetId: string | null,
    startTime: number
  ): void {
    if (routeId) {
      this.stats.routesMatched[routeId] = (this.stats.routesMatched[routeId] || 0) + 1;
    }

    if (targetId) {
      this.stats.targetsSelected[targetId] =
        (this.stats.targetsSelected[targetId] || 0) + 1;
    }

    const matchTime = performance.now() - startTime;
    this.stats.avgMatchTimeNs =
      (this.stats.avgMatchTimeNs * (this.stats.totalRequests - 1) + matchTime) /
      this.stats.totalRequests;
  }
}

/**
 * Route tree node
 */
interface RouteNode {
  children: Map<string, RouteNode>;
  route: Route | null;
  wildcard: RouteNode | null;
  wildcardParam: string | null;
  regexChild: RouteNode | null;
  regexParam: string | null;
  regexPattern?: RegExp;
}

/**
 * Router options
 */
export interface RouterOptions {
  cacheEnabled?: boolean;
  cacheMaxSize?: number;
  cacheTTL?: number;
}

/**
 * Create a new router instance
 */
export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
}

/**
 * Create a route definition
 */
export function createRoute(config: Partial<Route>): Route {
  return {
    id: config.id || generateId(),
    name: config.name || 'unnamed-route',
    path: config.path || '/',
    methods: config.methods || ['GET'],
    upstream: config.upstream || {
      type: 'single',
      targets: [{ id: 'default', url: 'http://localhost:8080' }],
    },
    middleware: config.middleware || [],
    auth: config.auth || { required: false, methods: ['none'] },
    rateLimit: config.rateLimit,
    cache: config.cache,
    version: config.version,
    deprecated: config.deprecated,
    sunsetDate: config.sunsetDate,
    metadata: config.metadata || {},
  };
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
