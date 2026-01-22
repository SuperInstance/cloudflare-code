/**
 * Validation utilities for load balancer configuration
 */

import type {
  Region,
  GeoLocation,
  RoutingConfig,
  TrafficShapingPolicy,
  HealthCheckConfig,
  AnycastConfig,
} from '../types/index.js';

/**
 * Validate region ID
 */
export function validateRegion(region: unknown): region is Region {
  const validRegions: Region[] = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'ca-central-1', 'mx-central-1',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
    'eu-north-1', 'eu-south-1',
    'ap-east-1', 'ap-south-1', 'ap-southeast-1', 'ap-southeast-2',
    'ap-southeast-3', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
    'sa-east-1', 'me-south-1', 'af-south-1',
  ];

  return typeof region === 'string' && validRegions.includes(region as Region);
}

/**
 * Validate geographic location
 */
export function validateGeoLocation(location: unknown): boolean {
  if (typeof location !== 'object' || location === null) {
    return false;
  }

  const loc = location as Partial<GeoLocation>;

  return (
    typeof loc.country === 'string' &&
    loc.country.length >= 2 &&
    loc.country.length <= 3 &&
    typeof loc.continent === 'string' &&
    ['AF', 'AS', 'EU', 'NA', 'OC', 'SA'].includes(loc.continent) &&
    typeof loc.latitude === 'number' &&
    loc.latitude >= -90 &&
    loc.latitude <= 90 &&
    typeof loc.longitude === 'number' &&
    loc.longitude >= -180 &&
    loc.longitude <= 180
  );
}

/**
 * Validate routing configuration
 */
export function validateRoutingConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['Config must be an object'] };
  }

  const cfg = config as Partial<RoutingConfig>;

  // Validate strategy
  if (cfg.strategy) {
    const validStrategies = [
      'geographic', 'latency', 'capacity', 'weighted',
      'round-robin', 'least-connections', 'consistent-hash', 'adaptive'
    ];

    if (!validStrategies.includes(cfg.strategy)) {
      errors.push(`Invalid strategy: ${cfg.strategy}`);
    }
  }

  // Validate fallback strategy
  if (cfg.fallbackStrategy && cfg.strategy !== cfg.fallbackStrategy) {
    const validStrategies = [
      'geographic', 'latency', 'capacity', 'weighted',
      'round-robin', 'least-connections', 'consistent-hash', 'adaptive'
    ];

    if (!validStrategies.includes(cfg.fallbackStrategy)) {
      errors.push(`Invalid fallback strategy: ${cfg.fallbackStrategy}`);
    }
  }

  // Validate session affinity TTL
  if (cfg.sessionAffinityTTL !== undefined) {
    if (typeof cfg.sessionAffinityTTL !== 'number' || cfg.sessionAffinityTTL < 0) {
      errors.push('Session affinity TTL must be a positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate health check configuration
 */
export function validateHealthCheckConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['Config must be an object'] };
  }

  const cfg = config as Partial<HealthCheckConfig>;

  // Validate interval
  if (cfg.interval !== undefined) {
    if (typeof cfg.interval !== 'number' || cfg.interval < 1000) {
      errors.push('Health check interval must be at least 1000ms');
    }
  }

  // Validate timeout
  if (cfg.timeout !== undefined) {
    if (typeof cfg.timeout !== 'number' || cfg.timeout < 100) {
      errors.push('Health check timeout must be at least 100ms');
    }
  }

  // Validate thresholds
  if (cfg.unhealthyThreshold !== undefined) {
    if (
      typeof cfg.unhealthyThreshold !== 'number' ||
      cfg.unhealthyThreshold < 1 ||
      cfg.unhealthyThreshold > 10
    ) {
      errors.push('Unhealthy threshold must be between 1 and 10');
    }
  }

  if (cfg.healthyThreshold !== undefined) {
    if (
      typeof cfg.healthyThreshold !== 'number' ||
      cfg.healthyThreshold < 1 ||
      cfg.healthyThreshold > 10
    ) {
      errors.push('Healthy threshold must be between 1 and 10');
    }
  }

  // Validate check type
  if (cfg.checkType) {
    const validTypes = ['http', 'https', 'tcp', 'udp', 'icmp', 'composite'];
    if (!validTypes.includes(cfg.checkType)) {
      errors.push(`Invalid check type: ${cfg.checkType}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate traffic shaping policy
 */
export function validateTrafficShapingPolicy(policy: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof policy !== 'object' || policy === null) {
    return { valid: false, errors: ['Policy must be an object'] };
  }

  const pol = policy as Partial<TrafficShapingPolicy>;

  // Validate required fields
  if (!pol.id || typeof pol.id !== 'string') {
    errors.push('Policy must have a valid id');
  }

  if (!pol.name || typeof pol.name !== 'string') {
    errors.push('Policy must have a valid name');
  }

  if (!pol.rules || !Array.isArray(pol.rules)) {
    errors.push('Policy must have rules array');
  }

  // Validate rules
  if (pol.rules) {
    pol.rules.forEach((rule, index) => {
      if (!rule.id || typeof rule.id !== 'string') {
        errors.push(`Rule ${index}: must have valid id`);
      }

      if (!rule.condition || typeof rule.condition !== 'object') {
        errors.push(`Rule ${index}: must have condition`);
      }

      if (!rule.action || typeof rule.action !== 'object') {
        errors.push(`Rule ${index}: must have action`);
      }

      if (rule.priority !== undefined) {
        if (typeof rule.priority !== 'number' || rule.priority < 0 || rule.priority > 1000) {
          errors.push(`Rule ${index}: priority must be between 0 and 1000`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate anycast configuration
 */
export function validateAnycastConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['Config must be an object'] };
  }

  const cfg = config as Partial<AnycastConfig>;

  // Validate DNS provider
  if (cfg.dnsProvider) {
    const validProviders = ['cloudflare', 'aws', 'google', 'custom'];
    if (!validProviders.includes(cfg.dnsProvider)) {
      errors.push(`Invalid DNS provider: ${cfg.dnsProvider}`);
    }
  }

  // Validate IP ranges
  if (cfg.ipRanges) {
    if (!Array.isArray(cfg.ipRanges)) {
      errors.push('IP ranges must be an array');
    } else {
      cfg.ipRanges.forEach((range, index) => {
        if (!isValidCIDR(range)) {
          errors.push(`Invalid CIDR range at index ${index}: ${range}`);
        }
      });
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
export function isValidCIDR(cidr: string): boolean {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

  if (!cidrRegex.test(cidr)) {
    return false;
  }

  const [ip, prefix] = cidr.split('/');
  const prefixLength = parseInt(prefix, 10);

  if (prefixLength < 0 || prefixLength > 32) {
    return false;
  }

  const octets = ip.split('.').map(o => parseInt(o, 10));

  for (const octet of octets) {
    if (octet < 0 || octet > 255) {
      return false;
    }
  }

  return true;
}

/**
 * Validate IP address
 */
export function isValidIP(ip: string): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (!ipRegex.test(ip)) {
    return false;
  }

  const octets = ip.split('.').map(o => parseInt(o, 10));

  for (const octet of octets) {
    if (octet < 0 || octet > 255) {
      return false;
    }
  }

  return true;
}

/**
 * Validate percentage value
 */
export function isPercentage(value: unknown): boolean {
  if (typeof value !== 'number') return false;
  return value >= 0 && value <= 1;
}

/**
 * Validate port number
 */
export function isValidPort(port: unknown): boolean {
  if (typeof port !== 'number') return false;
  return port >= 1 && port <= 65535 && Number.isInteger(port);
}

/**
 * Validate URL
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate weight value
 */
export function isValidWeight(weight: unknown): boolean {
  if (typeof weight !== 'number') return false;
  return weight >= 0 && weight <= 1;
}

/**
 * Validate priority value
 */
export function isValidPriority(priority: unknown): boolean {
  if (typeof priority !== 'number') return false;
  return priority >= 0 && priority <= 1000;
}

/**
 * Validate timestamp
 */
export function isValidTimestamp(timestamp: unknown): boolean {
  if (typeof timestamp !== 'number') return false;

  // Check if it's a reasonable timestamp (between year 2000 and year 2100)
  return timestamp >= 946684800000 && timestamp <= 4102444800000;
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Validate request ID format
 */
export function isValidRequestId(id: string): boolean {
  // Request IDs should be alphanumeric with hyphens
  return /^[a-zA-Z0-9-]+$/.test(id) && id.length > 0 && id.length <= 100;
}

/**
 * Validate country code
 */
export function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

/**
 * Validate continent code
 */
export function isValidContinentCode(code: string): boolean {
  return ['AF', 'AS', 'EU', 'NA', 'OC', 'SA'].includes(code);
}

/**
 * Validate timezone string
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate AS number
 */
export function isValidASN(asn: unknown): boolean {
  if (typeof asn !== 'number') return false;
  return asn >= 1 && asn <= 4294967294 && Number.isInteger(asn);
}

/**
 * Validate BGP community
 */
export function isValidBGPCommunity(community: string): boolean {
  // Format: AA:NN where AA and NN are 16-bit numbers
  const bgpRegex = /^(\d{1,5}):(\d{1,5})$/;

  if (!bgpRegex.test(community)) {
    return false;
  }

  const [aa, nn] = community.split(':').map(Number);

  return aa >= 0 && aa <= 65535 && nn >= 0 && nn <= 65535;
}

/**
 * Deep check if object is empty
 */
export function isEmptyObject(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return true;

  return Object.keys(obj).length === 0;
}

/**
 * Validate array of regions
 */
export function validateRegionArray(regions: unknown[]): {
  valid: boolean;
  errors: string[];
  validRegions: Region[];
} {
  const errors: string[] = [];
  const validRegions: Region[] = [];

  regions.forEach((region, index) => {
    if (validateRegion(region)) {
      validRegions.push(region);
    } else {
      errors.push(`Invalid region at index ${index}: ${region}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    validRegions,
  };
}

/**
 * Validate capacity value
 */
export function isValidCapacity(capacity: unknown): boolean {
  if (typeof capacity !== 'number') return false;
  return capacity > 0 && Number.isInteger(capacity);
}

/**
 * Validate latency value
 */
export function isValidLatency(latency: unknown): boolean {
  if (typeof latency !== 'number') return false;
  return latency >= 0 && latency < 60000; // Max 60 seconds
}

/**
 * Validate health score
 */
export function isValidHealthScore(score: unknown): boolean {
  if (typeof score !== 'number') return false;
  return score >= 0 && score <= 100;
}
