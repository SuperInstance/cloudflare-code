import { describe, it, expect } from 'vitest';
import { ComplianceScanner } from '../src/scanning';
import { ComplianceStandard, ScanTargetType } from '../src/types';

describe('ComplianceScanner', () => {
  it('should perform scan', async () => {
    const scanner = new ComplianceScanner();

    const config = {
      standards: [ComplianceStandard.SOC2],
      targets: [ScanTargetType.INFRASTRUCTURE],
      scope: ['production']
    };

    const result = await scanner.scan(config);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.findings).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });

  it('should generate summary', async () => {
    const scanner = new ComplianceScanner();

    const config = {
      standards: [ComplianceStandard.SOC2, ComplianceStandard.ISO27001],
      targets: [ScanTargetType.INFRASTRUCTURE, ScanTargetType.CODE]
    };

    const result = await scanner.scan(config);

    expect(result.summary).toBeDefined();
    expect(result.summary.totalScans).toBeGreaterThanOrEqual(0);
    expect(result.summary.complianceScore).toBeGreaterThanOrEqual(0);
    expect(result.summary.complianceScore).toBeLessThanOrEqual(100);
    expect(result.summary.timeElapsed).toBeGreaterThanOrEqual(0);
  });

  it('should track scan history', async () => {
    const scanner = new ComplianceScanner();

    const config = {
      standards: [ComplianceStandard.SOC2],
      targets: [ScanTargetType.INFRASTRUCTURE]
    };

    await scanner.scan(config);
    const history = scanner.getScanHistory([ComplianceStandard.SOC2]);

    expect(history.length).toBeGreaterThan(0);
  });

  it('should compare scans', async () => {
    const scanner = new ComplianceScanner();

    const config = {
      standards: [ComplianceStandard.SOC2],
      targets: [ScanTargetType.INFRASTRUCTURE]
    };

    const scan1 = await scanner.scan(config);
    const scan2 = await scanner.scan(config);

    const comparison = scanner.compareScans(scan1, scan2);

    expect(comparison).toBeDefined();
    expect(comparison.improved).toBeDefined();
    expect(comparison.regressed).toBeDefined();
    expect(comparison.unchanged).toBeDefined();
  });

  it('should report progress', async () => {
    const scanner = new ComplianceScanner();

    const config = {
      standards: [ComplianceStandard.SOC2],
      targets: [ScanTargetType.INFRASTRUCTURE]
    };

    let progressReported = false;
    const onProgress = (progress: any) => {
      progressReported = true;
      expect(progress.percentage).toBeGreaterThanOrEqual(0);
      expect(progress.percentage).toBeLessThanOrEqual(100);
    };

    await scanner.scan(config, undefined, onProgress);

    expect(progressReported).toBe(true);
  });
});
