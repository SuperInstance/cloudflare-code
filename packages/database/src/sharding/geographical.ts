/**
 * Geographical Sharding
 *
 * Implements geolocation-aware sharding for low-latency access
 */

import type { Shard, GeolocationConfig, ShardingConfig } from './types';

interface RegionInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  shards: Shard[];
}

export class GeographicalSharding {
  private config: ShardingConfig;
  private regions: Map<string, RegionInfo>;
  private userLocations: Map<string, string>;

  constructor(config: ShardingConfig) {
    this.config = config;
    this.regions = new Map();
    this.userLocations = new Map();
    this.initializeRegions();
  }

  private initializeRegions(): void {
    // Group shards by region
    for (const shard of this.config.shards) {
      let region = this.regions.get(shard.region);
      if (!region) {
        region = {
          id: shard.region,
          name: shard.region,
          latitude: 0,
          longitude: 0,
          shards: [],
        };
        this.regions.set(shard.region, region);
      }
      region.shards.push(shard);
    }

    // Set region coordinates (in real implementation, from config)
    this.setRegionCoordinates();
  }

  private setRegionCoordinates(): void {
    // Example coordinates for major regions
    const coordinates: Record<string, { lat: number; lon: number }> = {
      'us-east': { lat: 37.7749, lon: -122.4194 },
      'us-west': { lat: 34.0522, lon: -118.2437 },
      'eu-west': { lat: 51.5074, lon: -0.1278 },
      'eu-central': { lat: 52.5200, lon: 13.4050 },
      'asia-east': { lat: 35.6762, lon: 139.6503 },
      'asia-southeast': { lat: 1.3521, lon: 103.8198 },
      'australia': { lat: -33.8688, lon: 151.2093 },
      'south-america': { lat: -23.5505, lon: -46.6333 },
    };

    for (const [regionId, coords] of Object.entries(coordinates)) {
      const region = this.regions.get(regionId);
      if (region) {
        region.latitude = coords.lat;
        region.longitude = coords.lon;
      }
    }
  }

  /**
   * Route request to nearest shard
   */
  route(userLocation: { latitude: number; longitude: number }, userId: string): {
    primary: Shard;
    replicas: Shard[];
    latency: number;
  } {
    const nearestRegion = this.findNearestRegion(userLocation);

    if (!nearestRegion) {
      throw new Error('No available regions');
    }

    // Select primary shard from nearest region
    const primary = this.selectShardFromRegion(nearestRegion);

    // Select replicas from nearby regions
    const replicas = this.selectReplicas(nearestRegion, userLocation);

    // Calculate estimated latency
    const latency = this.calculateLatency(userLocation, nearestRegion);

    return { primary, replicas, latency };
  }

  /**
   * Route by user ID with location affinity
   */
  routeByUser(userId: string, geoConfig: GeolocationConfig): Shard | undefined {
    // Check if user has a preferred region
    const userRegion = this.userLocations.get(userId);

    if (userRegion) {
      const region = this.regions.get(userRegion);
      if (region && region.shards.length > 0) {
        // Return least loaded shard in that region
        return this.selectLeastLoadedShard(region.shards);
      }
    }

    // Use user's region from config
    const region = this.regions.get(geoConfig.userRegion);
    if (region && region.shards.length > 0) {
      return this.selectLeastLoadedShard(region.shards);
    }

    // Fallback to nearest shards
    for (const shardId of geoConfig.fallbackShards) {
      const shard = this.config.shards.find((s) => s.id === shardId);
      if (shard && shard.status === 'active') {
        return shard;
      }
    }

    return undefined;
  }

  /**
   * Find nearest region to user location
   */
  private findNearestRegion(location: { latitude: number; longitude: number }): RegionInfo | undefined {
    let nearest: RegionInfo | undefined;
    let minDistance = Infinity;

    for (const region of this.regions.values()) {
      if (region.shards.length === 0) continue;

      const distance = this.haversineDistance(
        location.latitude,
        location.longitude,
        region.latitude,
        region.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = region;
      }
    }

    return nearest;
  }

  /**
   * Calculate distance using Haversine formula
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
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

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Select a shard from a region
   */
  private selectShardFromRegion(region: RegionInfo): Shard {
    // Select least loaded shard in region
    return this.selectLeastLoadedShard(region.shards);
  }

  /**
   * Select least loaded shard from a list
   */
  private selectLeastLoadedShard(shards: Shard[]): Shard {
    let best = shards[0];
    let lowestUtilization = Infinity;

    for (const shard of shards) {
      if (shard.status === 'active' && shard.utilization < lowestUtilization) {
        lowestUtilization = shard.utilization;
        best = shard;
      }
    }

    return best;
  }

  /**
   * Select replicas from nearby regions
   */
  private selectReplicas(
    primaryRegion: RegionInfo,
    userLocation: { latitude: number; longitude: number }
  ): Shard[] {
    const replicas: Shard[] = [];
    const nearbyRegions = this.findNearbyRegions(primaryRegion, userLocation, 2);

    for (const region of nearbyRegions) {
      if (region.id !== primaryRegion.id && region.shards.length > 0) {
        replicas.push(this.selectLeastLoadedShard(region.shards));
      }
    }

    return replicas;
  }

  /**
   * Find nearby regions within a certain distance
   */
  private findNearbyRegions(
    primaryRegion: RegionInfo,
    userLocation: { latitude: number; longitude: number },
    count: number
  ): RegionInfo[] {
    const regionsWithDistance = Array.from(this.regions.values())
      .filter((r) => r.id !== primaryRegion.id && r.shards.length > 0)
      .map((region) => ({
        region,
        distance: this.haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          region.latitude,
          region.longitude
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, count)
      .map((r) => r.region);

    return regionsWithDistance;
  }

  /**
   * Calculate estimated latency to region
   */
  private calculateLatency(
    userLocation: { latitude: number; longitude: number },
    region: RegionInfo
  ): number {
    const distance = this.haversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      region.latitude,
      region.longitude
    );

    // Rough estimate: 1ms per 100km + base latency
    return Math.ceil(distance / 100) + 10;
  }

  /**
   * Set user's preferred region
   */
  setUserLocation(userId: string, regionId: string): void {
    this.userLocations.set(userId, regionId);
  }

  /**
   * Get user's preferred region
   */
  getUserRegion(userId: string): string | undefined {
    return this.userLocations.get(userId);
  }

  /**
   * Add a shard to a region
   */
  addShard(shard: Shard): void {
    let region = this.regions.get(shard.region);
    if (!region) {
      region = {
        id: shard.region,
        name: shard.region,
        latitude: 0,
        longitude: 0,
        shards: [],
      };
      this.regions.set(shard.region, region);
    }

    region.shards.push(shard);
    this.config.shards.push(shard);
  }

  /**
   * Get all regions
   */
  getRegions(): RegionInfo[] {
    return Array.from(this.regions.values());
  }

  /**
   * Get region by ID
   */
  getRegion(regionId: string): RegionInfo | undefined {
    return this.regions.get(regionId);
  }

  /**
   * Get routing information for debugging
   */
  getRoutingInfo(): {
    regions: number;
    totalShards: number;
    users: number;
  } {
    let totalShards = 0;
    for (const region of this.regions.values()) {
      totalShards += region.shards.length;
    }

    return {
      regions: this.regions.size,
      totalShards,
      users: this.userLocations.size,
    };
  }
}
