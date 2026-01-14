/**
 * Anycast routing optimization
 * Optimizes BGP and Anycast routing for global load balancing
 */

import type {
  Region,
  AnycastConfig,
  AnycastPrefix,
  AnycastRoute,
  BGPConfig,
  BGPPeer,
  RoutePolicy,
  RouteMatch,
  BGPCommunity,
} from '../types/index.js';

export interface AnycastRouterConfig {
  enabled: boolean;
  localPrefRanges: Map<Region, number>;
  medRanges: Map<Region, number>;
  communityMap: Map<string, Region>;
}

export interface RouteAdvertisement {
  prefix: string;
  region: Region;
  localPref: number;
  med: number;
  communities: string[];
  asPath: number[];
}

/**
 * Anycast router for BGP optimization
 */
export class AnycastRouter {
  private config: AnycastConfig;
  private bgpConfig: BGPConfig;
  private routerConfig: AnycastRouterConfig;
  private advertisements: Map<string, RouteAdvertisement[]>;
  private routes: Map<string, AnycastRoute>;

  constructor(
    anycastConfig: Partial<AnycastConfig> = {},
    routerConfig: Partial<AnycastRouterConfig> = {}
  ) {
    this.config = {
      enabled: true,
      dnsProvider: 'cloudflare',
      ipRanges: [],
      anycastPrefixes: [],
      ...anycastConfig,
    };

    this.routerConfig = {
      enabled: true,
      localPrefRanges: this.initLocalPrefs(),
      medRanges: this.initMEDRanges(),
      communityMap: this.initCommunityMap(),
      ...routerConfig,
    };

    this.bgpConfig = {
      asNumber: 0,
      neighbors: [],
      routePolicies: [],
      communities: [],
    };

    this.advertisements = new Map();
    this.routes = new Map();
  }

  /**
   * Initialize local preference ranges
   */
  private initLocalPrefs(): Map<Region, number> {
    const prefs = new Map<Region, number>();

    // Higher local pref = more preferred
    prefs.set('us-east-1', 200);
    prefs.set('us-east-2', 190);
    prefs.set('us-west-1', 180);
    prefs.set('us-west-2', 170);
    prefs.set('eu-west-1', 200);
    prefs.set('eu-west-2', 190);
    prefs.set('ap-southeast-1', 200);
    prefs.set('ap-northeast-1', 190);

    return prefs;
  }

  /**
   * Initialize MED ranges
   */
  private initMEDRanges(): Map<Region, number> {
    const meds = new Map<Region, number>();

    // Lower MED = more preferred
    meds.set('us-east-1', 10);
    meds.set('us-east-2', 20);
    meds.set('us-west-1', 30);
    meds.set('us-west-2', 40);
    meds.set('eu-west-1', 10);
    meds.set('eu-west-2', 20);
    meds.set('ap-southeast-1', 10);
    meds.set('ap-northeast-1', 20);

    return meds;
  }

  /**
   * Initialize BGP community map
   */
  private initCommunityMap(): Map<string, Region> {
    const map = new Map<string, Region>();

    // Standard communities
    map.set('64512:1', 'us-east-1');
    map.set('64512:2', 'us-east-2');
    map.set('64512:3', 'us-west-1');
    map.set('64512:4', 'us-west-2');
    map.set('64512:11', 'eu-west-1');
    map.set('64512:12', 'eu-west-2');
    map.set('64512:21', 'ap-southeast-1');
    map.set('64512:22', 'ap-northeast-1');

    return map;
  }

  /**
   * Generate route advertisements for a region
   */
  generateAdvertisements(region: Region): RouteAdvertisement[] {
    if (!this.config.enabled) return [];

    const ads: RouteAdvertisement[] = [];

    for (const prefix of this.config.anycastPrefixes) {
      if (!prefix.regions.includes(region)) continue;

      const localPref = this.routerConfig.localPrefRanges.get(region) || 100;
      const med = this.routerConfig.medRanges.get(region) || 100;

      const communities = this.buildCommunities(region, prefix);

      const ad: RouteAdvertisement = {
        prefix: prefix.prefix,
        region,
        localPref,
        med,
        communities,
        asPath: [this.bgpConfig.asNumber],
      };

      ads.push(ad);
    }

    // Store advertisements
    this.advertisements.set(region, ads);

    return ads;
  }

  /**
   * Build BGP communities for a region
   */
  private buildCommunities(region: Region, prefix: AnycastPrefix): string[] {
    const communities: string[] = [];

    // Add region-specific community
    for (const [community, commRegion] of this.routerConfig.communityMap) {
      if (commRegion === region) {
        communities.push(community);
      }
    }

    // Add prefix weight community
    communities.push(`64512:${Math.floor(prefix.weight * 100)}`);

    // Add standard communities
    communities.push('64512:1000'); // Our prefix
    communities.push('64512:2000'); // Anycast enabled

    return communities;
  }

  /**
   * Optimize route advertisements based on current conditions
   */
  optimizeRoutes(
    regionHealth: Map<Region, number>,
    regionCapacity: Map<Region, number>
  ): void {
    for (const region of this.routerConfig.localPrefRanges.keys()) {
      const health = regionHealth.get(region) || 100;
      const capacity = regionCapacity.get(region) || 100;

      // Adjust local preference based on health and capacity
      const basePref = this.routerConfig.localPrefRanges.get(region) || 100;
      const healthPenalty = (100 - health) * 2;
      const capacityPenalty = (100 - capacity) * 1.5;

      const adjustedPref = Math.max(0, basePref - healthPenalty - capacityPenalty);
      this.routerConfig.localPrefRanges.set(region, Math.round(adjustedPref));

      // Adjust MED similarly
      const baseMed = this.routerConfig.medRanges.get(region) || 100;
      const medAdjustment = healthPenalty + capacityPenalty;
      const adjustedMed = Math.min(255, baseMed + medAdjustment);

      this.routerConfig.medRanges.set(region, Math.round(adjustedMed));
    }

    // Regenerate advertisements with new values
    for (const region of this.routerConfig.localPrefRanges.keys()) {
      this.generateAdvertisements(region);
    }
  }

  /**
   * Apply route policy to an advertisement
   */
  applyRoutePolicy(ad: RouteAdvertisement, policy: RoutePolicy): RouteAdvertisement | null {
    const match = policy.match;
    const action = policy.action;

    // Check if advertisement matches policy
    if (!this.matchesRoutePolicy(ad, match)) {
      return ad;
    }

    // Apply action
    switch (action) {
      case 'accept':
        return ad;

      case 'reject':
        return null;

      case 'set-local-pref':
        return {
          ...ad,
          localPref: policy.priority || ad.localPref,
        };

      case 'set-med':
        return {
          ...ad,
          med: policy.med || ad.med,
        };

      case 'prepend-as':
        return {
          ...ad,
          asPath: [this.bgpConfig.asNumber, this.bgpConfig.asNumber, ...ad.asPath],
        };

      default:
        return ad;
    }
  }

  /**
   * Check if advertisement matches route policy
   */
  private matchesRoutePolicy(ad: RouteAdvertisement, match: RouteMatch): boolean {
    if (match.prefix && ad.prefix !== match.prefix) return false;
    if (match.community && !match.community.some(c => ad.communities.includes(c))) return false;
    if (match.nextHop && ad.asPath[ad.asPath.length - 1] !== parseInt(match.nextHop)) return false;

    return true;
  }

  /**
   * Get best route for a prefix
   */
  getBestRoute(prefix: string): AnycastRoute | null {
    // Collect all advertisements for this prefix
    const ads: RouteAdvertisement[] = [];

    for (const [, regionAds] of this.advertisements) {
      for (const ad of regionAds) {
        if (ad.prefix === prefix) {
          ads.push(ad);
        }
      }
    }

    if (ads.length === 0) return null;

    // Select best advertisement based on BGP decision process
    const bestAd = ads.sort((a, b) => {
      // 1. Highest local preference
      if (a.localPref !== b.localPref) {
        return b.localPref - a.localPref;
      }

      // 2. Shortest AS path
      if (a.asPath.length !== b.asPath.length) {
        return a.asPath.length - b.asPath.length;
      }

      // 3. Lowest MED
      if (a.med !== b.med) {
        return a.med - b.med;
      }

      // 4. Prefer local routes
      // (would need more context to implement)

      return 0;
    })[0];

    return {
      prefix,
      nextHop: bestAd.region,
      localPref: bestAd.localPref,
      asPath: bestAd.asPath,
      communities: bestAd.communities,
      med: bestAd.med,
    };
  }

  /**
   * Add anycast prefix
   */
  addAnycastPrefix(prefix: AnycastPrefix): void {
    // Remove existing prefix with same name
    this.config.anycastPrefixes = this.config.anycastPrefixes.filter(
      p => p.prefix !== prefix.prefix
    );

    this.config.anycastPrefixes.push(prefix);

    // Regenerate advertisements
    for (const region of prefix.regions) {
      this.generateAdvertisements(region);
    }
  }

  /**
   * Remove anycast prefix
   */
  removeAnycastPrefix(prefix: string): void {
    this.config.anycastPrefixes = this.config.anycastPrefixes.filter(
      p => p.prefix !== prefix
    );

    // Clear advertisements for this prefix
    for (const [, ads] of this.advertisements) {
      const index = ads.findIndex(ad => ad.prefix === prefix);
      if (index !== -1) {
        ads.splice(index, 1);
      }
    }
  }

  /**
   * Set BGP configuration
   */
  setBGPConfig(config: Partial<BGPConfig>): void {
    this.bgpConfig = { ...this.bgpConfig, ...config };
  }

  /**
   * Add BGP peer
   */
  addBGPPeer(peer: BGPPeer): void {
    // Remove existing peer with same IP
    this.bgpConfig.neighbors = this.bgpConfig.neighbors.filter(
      n => n.ipAddress !== peer.ipAddress
    );

    this.bgpConfig.neighbors.push(peer);
  }

  /**
   * Remove BGP peer
   */
  removeBGPPeer(ipAddress: string): void {
    this.bgpConfig.neighbors = this.bgpConfig.neighbors.filter(
      n => n.ipAddress !== ipAddress
    );
  }

  /**
   * Add route policy
   */
  addRoutePolicy(policy: RoutePolicy): void {
    // Remove existing policy with same name
    this.bgpConfig.routePolicies = this.bgpConfig.routePolicies.filter(
      p => p.name !== policy.name
    );

    this.bgpConfig.routePolicies.push(policy);

    // Sort by priority
    this.bgpConfig.routePolicies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove route policy
   */
  removeRoutePolicy(name: string): void {
    this.bgpConfig.routePolicies = this.bgpConfig.routePolicies.filter(
      p => p.name !== name
    );
  }

  /**
   * Get BGP configuration
   */
  getBGPConfig(): BGPConfig {
    return { ...this.bgpConfig };
  }

  /**
   * Get advertisements for a region
   */
  getAdvertisements(region: Region): RouteAdvertisement[] {
    return this.advertisements.get(region) || [];
  }

  /**
   * Get all advertisements
   */
  getAllAdvertisements(): Map<string, RouteAdvertisement[]> {
    return new Map(this.advertisements);
  }

  /**
   * Get routing statistics
   */
  getStats(): {
    totalPrefixes: number;
    totalAdvertisements: number;
    advertisementsByRegion: Map<Region, number>;
    bgpPeers: number;
    routePolicies: number;
  } {
    const adsByRegion = new Map<Region, number>();

    for (const [region, ads] of this.advertisements) {
      adsByRegion.set(region, ads.length);
    }

    const totalAds = Array.from(this.advertisements.values())
      .reduce((sum, ads) => sum + ads.length, 0);

    return {
      totalPrefixes: this.config.anycastPrefixes.length,
      totalAdvertisements: totalAds,
      advertisementsByRegion: adsByRegion,
      bgpPeers: this.bgpConfig.neighbors.length,
      routePolicies: this.bgpConfig.routePolicies.length,
    };
  }

  /**
   * Validate BGP configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.bgpConfig.asNumber === 0) {
      errors.push('BGP AS number not set');
    }

    if (this.config.anycastPrefixes.length === 0) {
      errors.push('No anycast prefixes configured');
    }

    for (const prefix of this.config.anycastPrefixes) {
      if (!this.isValidCIDR(prefix.prefix)) {
        errors.push(`Invalid CIDR prefix: ${prefix.prefix}`);
      }

      if (prefix.regions.length === 0) {
        errors.push(`No regions configured for prefix: ${prefix.prefix}`);
      }

      if (prefix.weight < 0 || prefix.weight > 1) {
        errors.push(`Invalid weight for prefix ${prefix.prefix}: must be between 0 and 1`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate CIDR notation
   */
  private isValidCIDR(cidr: string): boolean {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    return cidrRegex.test(cidr);
  }

  /**
   * Export BGP configuration for router
   */
  exportBGPConfig(): string {
    const lines: string[] = [];

    lines.push('! BGP Configuration for ClaudeFlare');
    lines.push(`router bgp ${this.bgpConfig.asNumber}`);
    lines.push(' bgp log-neighbor-changes');

    // Configure neighbors
    for (const neighbor of this.bgpConfig.neighbors) {
      lines.push(` neighbor ${neighbor.ipAddress} remote-as ${neighbor.asNumber}`);
      if (neighbor.authenticationKey) {
        lines.push(` neighbor ${neighbor.ipAddress} password ${neighbor.authenticationKey}`);
      }
    }

    // Configure route policies
    for (const policy of this.bgpConfig.routePolicies) {
      lines.push(`! Route policy: ${policy.name}`);
      lines.push(`route-map ${policy.name} permit ${policy.priority}`);

      if (policy.match.prefix) {
        lines.push(` match ip address prefix-list ${policy.match.prefix}`);
      }

      if (policy.action === 'set-local-pref') {
        lines.push(` set local-preference ${policy.priority}`);
      }

      if (policy.action === 'set-med') {
        lines.push(` set metric ${policy.med}`);
      }
    }

    return lines.join('\n');
  }
}
