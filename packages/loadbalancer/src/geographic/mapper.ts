/**
 * Geographic mapper for user location detection and region assignment
 */

import type {
  GeoLocation,
  Region,
  Continent,
  RoutingContext,
} from '../types/index.js';
import { REGION_COORDINATES } from './router.js';

export interface GeoMappingConfig {
  enableIPGeolocation: boolean;
  enableASNMapping: boolean;
  enableTimezoneMapping: boolean;
  defaultRegion: Region;
  fallbackRegions: Region[];
}

export interface IPGeolocationInfo {
  ip: string;
  country: string;
  region?: string;
  city?: string;
  continent: Continent;
  latitude: number;
  longitude: number;
  timezone?: string;
  asn?: number;
  organization?: string;
}

/**
 * Geographic mapper for detecting user location and mapping to regions
 */
export class GeographicMapper {
  private config: GeoMappingConfig;
  private geoCache: Map<string, GeoLocation>;
  private asnCache: Map<number, Region>;

  constructor(config: Partial<GeoMappingConfig> = {}) {
    this.config = {
      enableIPGeolocation: true,
      enableASNMapping: true,
      enableTimezoneMapping: true,
      defaultRegion: 'us-east-1',
      fallbackRegions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
      ...config,
    };
    this.geoCache = new Map();
    this.asnCache = new Map();
  }

  /**
   * Extract geographic context from request
   */
  async extractLocation(request: Request): Promise<GeoLocation> {
    const ip = this.extractClientIP(request);

    // Check cache first
    const cached = this.geoCache.get(ip);
    if (cached) {
      return cached;
    }

    // Try IP geolocation
    if (this.config.enableIPGeolocation) {
      const geoInfo = await this.lookupIPGeolocation(ip);
      if (geoInfo) {
        const location: GeoLocation = {
          country: geoInfo.country,
          region: geoInfo.region,
          city: geoInfo.city,
          continent: geoInfo.continent,
          latitude: geoInfo.latitude,
          longitude: geoInfo.longitude,
          timezone: geoInfo.timezone,
        };

        this.geoCache.set(ip, location);
        return location;
      }
    }

    // Fallback to CF-IPCountry header
    const cfCountry = request.headers.get('CF-IPCountry');
    if (cfCountry) {
      const location = this.getCountryLocation(cfCountry);
      if (location) {
        this.geoCache.set(ip, location);
        return location;
      }
    }

    // Fallback to default location
    return this.getDefaultLocation();
  }

  /**
   * Map user to region based on multiple signals
   */
  async mapToRegion(context: RoutingContext): Promise<Region> {
    const location = context.sourceLocation;

    // Primary mapping by continent
    const continentRegion = this.mapByContinent(location);
    if (continentRegion) {
      return continentRegion;
    }

    // Secondary mapping by distance
    const nearestRegion = this.findNearestRegion(location);
    if (nearestRegion) {
      return nearestRegion;
    }

    // Fallback to default
    return this.config.defaultRegion;
  }

  /**
   * Map continent to optimal region
   */
  private mapByContinent(location: GeoLocation): Region | null {
    const continentMappings: Record<Continent, Region> = {
      'NA': 'us-east-1',
      'SA': 'sa-east-1',
      'EU': 'eu-west-1',
      'AS': 'ap-southeast-1',
      'OC': 'ap-southeast-2',
      'AF': 'eu-west-1',
    };

    return continentMappings[location.continent] || null;
  }

  /**
   * Find nearest region by distance
   */
  private findNearestRegion(location: GeoLocation): Region | null {
    let nearest: Region | null = null;
    let minDistance = Infinity;

    for (const [region, coords] of Object.entries(REGION_COORDINATES)) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        coords.lat,
        coords.lon
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = region as Region;
      }
    }

    return nearest;
  }

  /**
   * Lookup IP geolocation
   */
  private async lookupIPGeolocation(ip: string): Promise<IPGeolocationInfo | null> {
    // In a real implementation, this would call a geolocation service
    // For now, return a mock implementation

    // Cloudflare Workers has built-in geolocation via request.cf
    // This is a placeholder that would be replaced with actual CF data

    return null;
  }

  /**
   * Get location for a country code
   */
  private getCountryLocation(countryCode: string): GeoLocation | null {
    // Simplified country to continent mapping
    const continentMap: Record<string, Continent> = {
      // North America
      'US': 'NA', 'CA': 'NA', 'MX': 'NA',
      // South America
      'BR': 'SA', 'AR': 'SA', 'CL': 'SA', 'CO': 'SA',
      // Europe
      'GB': 'EU', 'DE': 'EU', 'FR': 'EU', 'IT': 'EU', 'ES': 'EU',
      'NL': 'EU', 'BE': 'EU', 'AT': 'EU', 'CH': 'EU', 'SE': 'EU',
      'NO': 'EU', 'DK': 'EU', 'PL': 'EU', 'CZ': 'EU', 'GR': 'EU',
      // Asia
      'CN': 'AS', 'JP': 'AS', 'IN': 'AS', 'KR': 'AS', 'SG': 'AS',
      'TH': 'AS', 'MY': 'AS', 'ID': 'AS', 'PH': 'AS', 'VN': 'AS',
      // Oceania
      'AU': 'OC', 'NZ': 'OC',
      // Africa
      'ZA': 'AF', 'NG': 'AF', 'EG': 'AF', 'KE': 'AF',
    };

    const continent = continentMap[countryCode.toUpperCase()];
    if (!continent) return null;

    // Use approximate coordinates for the continent
    const continentCenters: Record<Continent, { lat: number; lon: number }> = {
      'NA': { lat: 40, lon: -100 },
      'SA': { lat: -15, lon: -60 },
      'EU': { lat: 50, lon: 10 },
      'AS': { lat: 35, lon: 105 },
      'OC': { lat: -25, lon: 135 },
      'AF': { lat: 0, lon: 20 },
    };

    const center = continentCenters[continent];

    return {
      country: countryCode,
      continent,
      latitude: center.lat,
      longitude: center.lon,
    };
  }

  /**
   * Get default location
   */
  private getDefaultLocation(): GeoLocation {
    return {
      country: 'US',
      continent: 'NA',
      latitude: 40,
      longitude: -100,
    };
  }

  /**
   * Extract client IP from request
   */
  private extractClientIP(request: Request): string {
    // Check various headers for the real client IP
    const headers = [
      'CF-Connecting-IP',
      'X-Forwarded-For',
      'X-Real-IP',
      'X-Client-IP',
    ];

    for (const header of headers) {
      const value = request.headers.get(header);
      if (value) {
        // X-Forwarded-For may contain multiple IPs
        const ips = value.split(',').map(ip => ip.trim());
        return ips[0];
      }
    }

    return '0.0.0.0';
  }

  /**
   * Calculate distance between two points
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
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Map ASN to region
   */
  mapASNToRegion(asn: number): Region | null {
    // In production, this would query an ASN database
    // For now, return cached value or null
    return this.asnCache.get(asn) || null;
  }

  /**
   * Cache ASN mapping
   */
  cacheASNMapping(asn: number, region: Region): void {
    this.asnCache.set(asn, region);
  }

  /**
   * Clear geolocation cache
   */
  clearCache(): void {
    this.geoCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { geoEntries: number; asnEntries: number } {
    return {
      geoEntries: this.geoCache.size,
      asnEntries: this.asnCache.size,
    };
  }
}
