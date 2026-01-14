/**
 * Unit tests for utility functions
 */

import {
  IPUtils,
  RequestParser,
  MathUtils,
  TimeUtils,
  StringUtils,
  GeoUtils
} from '../../src/utils';

describe('IPUtils', () => {
  describe('isValidIPv4', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(IPUtils.isValidIPv4('192.168.1.1')).toBe(true);
      expect(IPUtils.isValidIPv4('10.0.0.1')).toBe(true);
      expect(IPUtils.isValidIPv4('172.16.0.1')).toBe(true);
      expect(IPUtils.isValidIPv4('8.8.8.8')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(IPUtils.isValidIPv4('256.1.1.1')).toBe(false);
      expect(IPUtils.isValidIPv4('192.168.1')).toBe(false);
      expect(IPUtils.isValidIPv4('192.168.1.1.1')).toBe(false);
      expect(IPUtils.isValidIPv4('invalid')).toBe(false);
    });
  });

  describe('isValidIPv6', () => {
    it('should validate correct IPv6 addresses', () => {
      expect(IPUtils.isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      expect(IPUtils.isValidIPv6('2001:db8:85a3::8a2e:370:7334')).toBe(true);
      expect(IPUtils.isValidIPv6('::1')).toBe(true);
    });

    it('should reject invalid IPv6 addresses', () => {
      expect(IPUtils.isValidIPv6('2001::85a3::7334')).toBe(false);
      expect(IPUtils.isValidIPv6('invalid')).toBe(false);
    });
  });

  describe('ipToNumber', () => {
    it('should convert IPv4 to number', () => {
      expect(IPUtils.ipToNumber('192.168.1.1')).toBe(3232235777);
      expect(IPUtils.ipToNumber('0.0.0.0')).toBe(0);
      expect(IPUtils.ipToNumber('255.255.255.255')).toBe(4294967295);
    });

    it('should throw for invalid IP', () => {
      expect(() => IPUtils.ipToNumber('invalid')).toThrow();
    });
  });

  describe('numberToIP', () => {
    it('should convert number to IPv4', () => {
      expect(IPUtils.numberToIP(3232235777)).toBe('192.168.1.1');
      expect(IPUtils.numberToIP(0)).toBe('0.0.0.0');
      expect(IPUtils.numberToIP(4294967295)).toBe('255.255.255.255');
    });
  });

  describe('isIPInCIDR', () => {
    it('should check if IP is in CIDR range', () => {
      expect(IPUtils.isIPInCIDR('192.168.1.100', '192.168.1.0/24')).toBe(true);
      expect(IPUtils.isIPInCIDR('192.168.2.1', '192.168.1.0/24')).toBe(false);
      expect(IPUtils.isIPInCIDR('10.0.0.1', '10.0.0.0/8')).toBe(true);
    });
  });

  describe('isPrivateIP', () => {
    it('should identify private IP ranges', () => {
      expect(IPUtils.isPrivateIP('192.168.1.1')).toBe(true);
      expect(IPUtils.isPrivateIP('10.0.0.1')).toBe(true);
      expect(IPUtils.isPrivateIP('172.16.0.1')).toBe(true);
      expect(IPUtils.isPrivateIP('127.0.0.1')).toBe(true);
      expect(IPUtils.isPrivateIP('8.8.8.8')).toBe(false);
    });
  });

  describe('extractIP', () => {
    it('should extract IP from various headers', () => {
      const headers1 = { 'cf-connecting-ip': '1.2.3.4' };
      expect(IPUtils.extractIP(headers1)).toBe('1.2.3.4');

      const headers2 = { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' };
      expect(IPUtils.extractIP(headers2)).toBe('5.6.7.8');

      const headers3 = { 'x-real-ip': '13.14.15.16' };
      expect(IPUtils.extractIP(headers3)).toBe('13.14.15.16');
    });

    it('should return fallback when no IP found', () => {
      expect(IPUtils.extractIP({})).toBe('0.0.0.0');
    });
  });

  describe('hashIP', () => {
    it('should hash IP address', () => {
      const hash1 = IPUtils.hashIP('192.168.1.1', 'salt');
      const hash2 = IPUtils.hashIP('192.168.1.1', 'salt');
      const hash3 = IPUtils.hashIP('192.168.1.1', 'different');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(16);
    });
  });
});

describe('RequestParser', () => {
  describe('parseUserAgent', () => {
    it('should parse browser user agents', () => {
      const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      const result = RequestParser.parseUserAgent(chromeUA);

      expect(result.browser).toBe('Chrome');
      expect(result.os).toBe('Windows');
      expect(result.isBot).toBe(false);
      expect(result.isMobile).toBe(false);
    });

    it('should detect bot user agents', () => {
      const botUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
      const result = RequestParser.parseUserAgent(botUA);

      expect(result.isBot).toBe(true);
    });

    it('should detect mobile user agents', () => {
      const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15';
      const result = RequestParser.parseUserAgent(mobileUA);

      expect(result.isMobile).toBe(true);
      expect(result.device).toBe('Mobile');
    });
  });

  describe('extractPath', () => {
    it('should extract path from URL', () => {
      expect(RequestParser.extractPath('https://example.com/path/to/resource?param=value'))
        .toBe('/path/to/resource');
      expect(RequestParser.extractPath('/api/users/123'))
        .toBe('/api/users/123');
    });
  });

  describe('parseQuery', () => {
    it('should parse query parameters', () => {
      const params = RequestParser.parseQuery('/api/users?id=123&name=test');
      expect(params).toEqual({ id: '123', name: 'test' });
    });

    it('should handle empty query', () => {
      expect(RequestParser.parseQuery('/api/users')).toEqual({});
    });
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint', () => {
      const request = {
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        headers: {
          'accept-language': 'en-US',
          'accept-encoding': 'gzip'
        }
      };

      const fp1 = RequestParser.generateFingerprint(request);
      const fp2 = RequestParser.generateFingerprint(request);

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(64); // SHA-256 hex
    });
  });

  describe('parseRequestID', () => {
    it('should extract request ID from headers', () => {
      const headers1 = { 'x-request-id': 'req-123' };
      expect(RequestParser.parseRequestID(headers1)).toBe('req-123');

      const headers2 = { 'cf-ray': 'ray-456' };
      expect(RequestParser.parseRequestID(headers2)).toBe('ray-456');
    });

    it('should generate random ID if not found', () => {
      const id = RequestParser.parseRequestID({});
      expect(id).toBeTruthy();
      expect(id).toHaveLength(32); // 16 bytes in hex
    });
  });
});

describe('MathUtils', () => {
  describe('exponentialMovingAverage', () => {
    it('should calculate EMA', () => {
      const values = [1, 2, 3, 4, 5];
      const ema = MathUtils.exponentialMovingAverage(values, 0.5);
      expect(ema).toBeGreaterThan(0);
      expect(ema).toBeLessThan(6);
    });

    it('should handle single value', () => {
      expect(MathUtils.exponentialMovingAverage([5], 0.5)).toBe(5);
    });

    it('should handle empty array', () => {
      expect(MathUtils.exponentialMovingAverage([], 0.5)).toBe(0);
    });
  });

  describe('standardDeviation', () => {
    it('should calculate standard deviation', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = MathUtils.standardDeviation(values);
      expect(stdDev).toBeCloseTo(2, 1);
    });

    it('should handle empty array', () => {
      expect(MathUtils.standardDeviation([])).toBe(0);
    });
  });

  describe('percentile', () => {
    it('should calculate percentiles', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      expect(MathUtils.percentile(values, 50)).toBe(5.5);
      expect(MathUtils.percentile(values, 95)).toBeCloseTo(9.55, 1);
    });
  });

  describe('zScore', () => {
    it('should calculate z-score', () => {
      expect(MathUtils.zScore(5, 3, 2)).toBe(1);
      expect(MathUtils.zScore(1, 3, 2)).toBe(-1);
    });

    it('should handle zero standard deviation', () => {
      expect(MathUtils.zScore(5, 5, 0)).toBe(0);
    });
  });

  describe('isOutlier', () => {
    it('should detect outliers', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(MathUtils.isOutlier(values, 100)).toBe(true);
      expect(MathUtils.isOutlier(values, 5)).toBe(false);
    });
  });

  describe('calculateRate', () => {
    it('should calculate rate per time window', () => {
      expect(MathUtils.calculateRate(100, 1000)).toBe(100); // 100 req/s
      expect(MathUtils.calculateRate(6000, 60000)).toBe(100); // 100 req/s
    });
  });

  describe('movingAverage', () => {
    it('should calculate moving average', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const ma = MathUtils.movingAverage(values, 3);

      expect(ma).toHaveLength(10);
      expect(ma[0]).toBe(1);
      expect(ma[2]).toBeCloseTo(2, 1);
    });
  });
});

describe('TimeUtils', () => {
  describe('now', () => {
    it('should return current timestamp', () => {
      const ts = TimeUtils.now();
      expect(ts).toBeGreaterThan(0);
      expect(ts).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('nowSec', () => {
    it('should return current timestamp in seconds', () => {
      const sec = TimeUtils.nowSec();
      expect(sec).toBeGreaterThan(0);
      expect(sec).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });
  });

  describe('msToSec', () => {
    it('should convert milliseconds to seconds', () => {
      expect(TimeUtils.msToSec(5000)).toBe(5);
      expect(TimeUtils.msToSec(1500)).toBe(1);
    });
  });

  describe('secToMs', () => {
    it('should convert seconds to milliseconds', () => {
      expect(TimeUtils.secToMs(5)).toBe(5000);
      expect(TimeUtils.secToMs(1)).toBe(1000);
    });
  });

  describe('formatDuration', () => {
    it('should format duration', () => {
      expect(TimeUtils.formatDuration(500)).toBe('500ms');
      expect(TimeUtils.formatDuration(5000)).toBe('5s');
      expect(TimeUtils.formatDuration(125000)).toBe('2m 5s');
      expect(TimeUtils.formatDuration(90000000)).toBe('1d 1h');
    });
  });

  describe('getTimeBucket', () => {
    it('should calculate time bucket', () => {
      const bucket = TimeUtils.getTimeBucket(1234567890, 60000);
      expect(bucket).toBe(1234560000);
    });
  });

  describe('isWithinWindow', () => {
    it('should check if timestamp is within window', () => {
      expect(TimeUtils.isWithinWindow(5000, 0, 10000)).toBe(true);
      expect(TimeUtils.isWithinWindow(15000, 0, 10000)).toBe(false);
    });
  });

  describe('timeUntilNextBucket', () => {
    it('should calculate time until next bucket', () => {
      const time = TimeUtils.timeUntilNextBucket(5000, 10000);
      expect(time).toBe(5000);
    });
  });
});

describe('StringUtils', () => {
  describe('random', () => {
    it('should generate random string', () => {
      const str1 = StringUtils.random(16);
      const str2 = StringUtils.random(16);

      expect(str1).toHaveLength(16);
      expect(str2).toHaveLength(16);
      expect(str1).not.toBe(str2);
    });
  });

  describe('uuid', () => {
    it('should generate valid UUID', () => {
      const uuid = StringUtils.uuid();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = StringUtils.uuid();
      const uuid2 = StringUtils.uuid();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('truncate', () => {
    it('should truncate string', () => {
      expect(StringUtils.truncate('hello world', 8)).toBe('hello...');
      expect(StringUtils.truncate('short', 10)).toBe('short');
    });
  });

  describe('sanitize', () => {
    it('should sanitize sensitive data', () => {
      const input = 'password:secret123 token:abc123';
      const output = StringUtils.sanitize(input);
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('secret123');
    });
  });

  describe('toSafeString', () => {
    it('should convert to safe string', () => {
      expect(StringUtils.toSafeString('Hello World!')).toBe('hello-world');
      expect(StringUtils.toSafeString('Test@String#123')).toBe('test-string-123');
    });
  });
});

describe('GeoUtils', () => {
  describe('getCountryFromHeaders', () => {
    it('should extract country from headers', () => {
      const headers1 = { 'cf-ipcountry': 'US' };
      expect(GeoUtils.getCountryFromHeaders(headers1)).toBe('US');

      const headers2 = { 'x-country-code': 'GB' };
      expect(GeoUtils.getCountryFromHeaders(headers2)).toBe('GB');
    });

    it('should return undefined if not found', () => {
      expect(GeoUtils.getCountryFromHeaders({})).toBeUndefined();
    });
  });

  describe('parseCloudflareGeoHeaders', () => {
    it('should parse Cloudflare geo headers', () => {
      const headers = {
        'cf-ipcountry': 'US',
        'cf-iplatitude': '37.7749',
        'cf-iplongitude': '-122.4194',
        'cf-asn': '15133'
      };

      const geo = GeoUtils.parseCloudflareGeoHeaders(headers);

      expect(geo.country).toBe('US');
      expect(geo.latitude).toBe(37.7749);
      expect(geo.longitude).toBe(-122.4194);
      expect(geo.asn).toBe(15133);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between coordinates', () => {
      const distance = GeoUtils.calculateDistance(37.7749, -122.4194, 40.7128, -74.0060);
      expect(distance).toBeCloseTo(4129, 0); // ~4129 km from SF to NYC
    });
  });

  describe('getContinent', () => {
    it('should get continent from country code', () => {
      expect(GeoUtils.getContinent('US')).toBe('North America');
      expect(GeoUtils.getContinent('GB')).toBe('Europe');
      expect(GeoUtils.getContinent('JP')).toBe('Asia');
      expect(GeoUtils.getContinent('AU')).toBe('Oceania');
    });

    it('should return undefined for unknown country', () => {
      expect(GeoUtils.getContinent('XX')).toBeUndefined();
    });
  });
});
