/**
 * Geographic routing engine
 * Routes requests to optimal regions based on user location
 */

import type {
  Region,
  GeoLocation,
  RegionInfo,
  DatacenterInfo,
  ProximityInfo,
  RoutingContext,
  RoutingDecision,
  RoutingReason,
  RoutingAlternative,
  Continent,
} from '../types/index.js';
import { RegionUnavailableError, NoHealthyRegionsError } from '../types/index.js';

// Continent to region mapping
const CONTINENT_REGIONS: Record<Continent, Region[]> = {
  'NA': ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1', 'mx-central-1'],
  'SA': ['sa-east-1'],
  'EU': ['eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1', 'eu-south-1'],
  'AS': ['ap-east-1', 'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3',
         'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3'],
  'OC': ['ap-southeast-2'],
  'AF': ['af-south-1', 'me-south-1'],
};

// Region coordinates for distance calculations
export const REGION_COORDINATES: Record<Region, { lat: number; lon: number }> = {
  // North America
  'us-east-1': { lat: 38.13, lon: -78.45 },   // Virginia
  'us-east-2': { lat: 40.41, lon: -82.61 },   // Ohio
  'us-west-1': { lat: 37.77, lon: -122.41 },  // California
  'us-west-2': { lat: 45.52, lon: -122.68 },  // Oregon
  'ca-central-1': { lat: 45.50, lon: -73.57 }, // Montreal
  'mx-central-1': { lat: 19.43, lon: -99.13 }, // Mexico City
  // Europe
  'eu-west-1': { lat: 53.41, lon: -6.27 },    // Dublin
  'eu-west-2': { lat: 51.51, lon: -0.13 },    // London
  'eu-west-3': { lat: 48.86, lon: 2.35 },     // Paris
  'eu-central-1': { lat: 50.11, lon: 8.68 },   // Frankfurt
  'eu-north-1': { lat: 59.65, lon: 18.02 },   // Stockholm
  'eu-south-1': { lat: 41.90, lon: 12.50 },   // Milan
  // Asia Pacific
  'ap-east-1': { lat: 22.28, lon: 114.16 },   // Hong Kong
  'ap-south-1': { lat: 19.08, lon: 72.88 },   // Mumbai
  'ap-southeast-1': { lat: 1.35, lon: 103.82 }, // Singapore
  'ap-southeast-2': { lat: -33.87, lon: 151.21 }, // Sydney
  'ap-southeast-3': { lat: -6.21, lon: 106.85 }, // Jakarta
  'ap-northeast-1': { lat: 35.68, lon: 139.77 }, // Tokyo
  'ap-northeast-2': { lat: 37.57, lon: 126.98 }, // Seoul
  'ap-northeast-3': { lat: 22.33, lon: 114.18 }, // Osaka
  // South America
  'sa-east-1': { lat: -23.55, lon: -46.64 },  // São Paulo
  // Middle East
  'me-south-1': { lat: 25.20, lon: 55.27 },   // Bahrain
  // Africa
  'af-south-1': { lat: -26.20, lon: 28.05 },  // Cape Town
};

export interface GeographicRouterConfig {
  preferContinentLocal: boolean;
  maxDistanceKm: number;
  latencyThreshold: number;
  capacityThreshold: number;
  fallbackToGlobal: boolean;
}

export class GeographicRouter {
  private regions: Map<Region, RegionInfo>;
  private config: GeographicRouterConfig;

  constructor(
    regions: Map<Region, RegionInfo>,
    config: Partial<GeographicRouterConfig> = {}
  ) {
    this.regions = regions;
    this.config = {
      preferContinentLocal: true,
      maxDistanceKm: 15000,
      latencyThreshold: 200,
      capacityThreshold: 0.9,
      fallbackToGlobal: true,
      ...config,
    };
  }

  /**
   * Route request to optimal region based on geographic proximity
   */
  async route(context: RoutingContext): Promise<RoutingDecision> {
    const sourceLocation = context.sourceLocation;
    const availableRegions = this.getAvailableRegions();

    if (availableRegions.length === 0) {
      throw new NoHealthyRegionsError();
    }

    // Calculate proximity scores for all regions
    const proximityScores = await this.calculateProximityScores(
      sourceLocation,
      availableRegions
    );

    // Filter and rank regions based on multiple factors
    const rankedRegions = await this.rankRegions(
      sourceLocation,
      proximityScores,
      availableRegions
    );

    // Select best region
    const selectedRegion = rankedRegions[0];
    if (!selectedRegion) {
      throw new NoHealthyRegionsError();
    }

    // Build routing decision
    return this.buildRoutingDecision(
      context,
      selectedRegion,
      rankedRegions.slice(1, 4) // Include top 3 alternatives
    );
  }

  /**
   * Calculate proximity scores for all regions
   */
  private async calculateProximityScores(
    sourceLocation: GeoLocation,
    regions: RegionInfo[]
  ): Promise<Map<Region, ProximityInfo>> {
    const scores = new Map<Region, ProximityInfo>();

    for (const region of regions) {
      const regionCoords = REGION_COORDINATES[region.id];
      if (!regionCoords) continue;

      const distance = this.calculateDistance(
        sourceLocation.latitude,
        sourceLocation.longitude,
        regionCoords.lat,
        regionCoords.lon
      );

      const estimatedLatency = this.estimateLatency(distance);
      const score = this.calculateProximityScore(distance, estimatedLatency);

      scores.set(region.id, {
        region: region.id,
        distance,
        estimatedLatency,
        score,
      });
    }

    return scores;
  }

  /**
   * Rank regions based on multiple factors
   */
  private async rankRegions(
    sourceLocation: GeoLocation,
    proximityScores: Map<Region, ProximityInfo>,
    regions: RegionInfo[]
  ): Promise<RegionInfo[]> {
    const continent = sourceLocation.continent;
    const continentRegions = CONTINENT_REGIONS[continent] || [];

    return regions.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Factor 1: Continent proximity (highest weight)
      if (this.config.preferContinentLocal) {
        const aInContinent = continentRegions.includes(a.id);
        const bInContinent = continentRegions.includes(b.id);

        if (aInContinent && !bInContinent) scoreA += 1000;
        else if (!aInContinent && bInContinent) scoreB += 1000;
      }

      // Factor 2: Distance-based score
      const proximityA = proximityScores.get(a.id);
      const proximityB = proximityScores.get(b.id);
      if (proximityA && proximityB) {
        scoreA += proximityA.score;
        scoreB += proximityB.score;
      }

      // Factor 3: Health score
      scoreA += a.healthScore * 10;
      scoreB += b.healthScore * 10;

      // Factor 4: Capacity availability
      const aCapacityUtil = 1 - (a.availableCapacity / a.capacity);
      const bCapacityUtil = 1 - (b.availableCapacity / b.capacity);
      scoreA -= aCapacityUtil * 500;
      scoreB -= bCapacityUtil * 500;

      // Factor 5: Priority
      scoreA += a.priority;
      scoreB += b.priority;

      return scoreB - scoreA;
    });
  }

  /**
   * Calculate great-circle distance between two points using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Estimate network latency based on distance
   */
  private estimateLatency(distanceKm: number): number {
    // Base latency: 2ms per 100km + 10ms fixed overhead
    return Math.max(10, Math.floor((distanceKm / 100) * 2 + 10));
  }

  /**
   * Calculate proximity score (higher is better)
   */
  private calculateProximityScore(distance: number, latency: number): number {
    let score = 1000;

    // Distance penalty
    if (distance > this.config.maxDistanceKm) {
      score -= 500;
    } else {
      score -= (distance / this.config.maxDistanceKm) * 200;
    }

    // Latency penalty
    if (latency > this.config.latencyThreshold) {
      score -= (latency - this.config.latencyThreshold) * 2;
    }

    return Math.max(0, score);
  }

  /**
   * Build routing decision with reasoning
   */
  private buildRoutingDecision(
    context: RoutingContext,
    selectedRegion: RegionInfo,
    alternatives: RegionInfo[]
  ): RoutingDecision {
    const selectedDatacenter = this.selectBestDatacenter(selectedRegion);

    const reasoning: RoutingReason[] = [
      {
        factor: 'geographic_proximity',
        weight: 0.4,
        score: 0.9,
        description: `Selected ${selectedRegion.id} based on geographic proximity to user in ${context.sourceLocation.country}`,
      },
      {
        factor: 'health_score',
        weight: 0.3,
        score: selectedRegion.healthScore / 100,
        description: `Region health score: ${selectedRegion.healthScore}`,
      },
      {
        factor: 'capacity_availability',
        weight: 0.2,
        score: selectedRegion.availableCapacity / selectedRegion.capacity,
        description: `Available capacity: ${selectedRegion.availableCapacity}/${selectedRegion.capacity}`,
      },
      {
        factor: 'regional_priority',
        weight: 0.1,
        score: selectedRegion.priority / 10,
        description: `Regional priority: ${selectedRegion.priority}`,
      },
    ];

    const alternativeScores = alternatives.map(alt => ({
      region: alt.id,
      score: (alt.healthScore / 100) * 0.3 +
              (alt.availableCapacity / alt.capacity) * 0.2 +
              (alt.priority / 10) * 0.1,
      reason: `Alternative region with health score ${alt.healthScore} and ${alt.availableCapacity} available capacity`,
    }));

    return {
      requestId: context.requestId,
      selectedRegion: selectedRegion.id,
      selectedDatacenter: selectedDatacenter.id,
      selectedEndpoint: selectedDatacenter.endpoints[0] || '',
      reasoning,
      confidence: 0.85,
      timestamp: Date.now(),
      alternatives: alternativeScores,
    };
  }

  /**
   * Select best datacenter within a region
   */
  private selectBestDatacenter(region: RegionInfo): DatacenterInfo {
    return region.datacenters.reduce((best, dc) => {
      if (dc.status === 'unhealthy') return best;
      if (!best || dc.healthScore > best.healthScore) return dc;
      return best;
    }, region.datacenters[0]);
  }

  /**
   * Get available regions (not offline or in maintenance)
   */
  private getAvailableRegions(): RegionInfo[] {
    return Array.from(this.regions.values()).filter(
      region => region.status === 'active' || region.status === 'degraded'
    );
  }

  /**
   * Update region information
   */
  updateRegion(region: Region, info: Partial<RegionInfo>): void {
    const existing = this.regions.get(region);
    if (existing) {
      this.regions.set(region, { ...existing, ...info });
    }
  }

  /**
   * Get regions by continent
   */
  getRegionsByContinent(continent: Continent): RegionInfo[] {
    const regionIds = CONTINENT_REGIONS[continent] || [];
    return regionIds
      .map(id => this.regions.get(id))
      .filter((r): r is RegionInfo => r !== undefined);
  }

  /**
   * Find nearest region to a location
   */
  findNearestRegion(location: GeoLocation): RegionInfo | null {
    const availableRegions = this.getAvailableRegions();
    if (availableRegions.length === 0) return null;

    let nearest = availableRegions[0];
    let minDistance = Infinity;

    for (const region of availableRegions) {
      const coords = REGION_COORDINATES[region.id];
      if (!coords) continue;

      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        coords.lat,
        coords.lon
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = region;
      }
    }

    return nearest;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
