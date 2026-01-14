import { describe, it, expect } from 'vitest';
import { RiskAssessor } from '../src/risk';
import { ComplianceStandard, RiskLevel } from '../src/types';

describe('RiskAssessor', () => {
  it('should perform risk assessment', async () => {
    const assessor = new RiskAssessor();

    const config = {
      scope: 'organization',
      standards: [ComplianceStandard.SOC2],
      timeframe: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      },
      tolerance: {
        critical: 0,
        high: 2,
        medium: 5,
        low: 10
      }
    };

    const assessment = await assessor.assess(config);

    expect(assessment).toBeDefined();
    expect(assessment.id).toBeDefined();
    expect(assessment.overallRiskLevel).toBeDefined();
    expect(assessment.risks).toBeDefined();
    expect(assessment.mitigationPlan).toBeDefined();
  });

  it('should calculate risk scores correctly', () => {
    const assessor = new RiskAssessor();

    const score = assessor.calculateRiskScore({
      likelihood: 4,
      impact: 5,
      velocity: 1,
      detectability: 1
    });

    expect(score).toBe(20); // 4 * 5 = 20
  });

  it('should determine risk level from score', () => {
    const assessor = new RiskAssessor();

    const criticalLevel = assessor['getRiskLevel'](25);
    const highLevel = assessor['getRiskLevel'](16);
    const mediumLevel = assessor['getRiskLevel'](10);
    const lowLevel = assessor['getRiskLevel'](4);

    expect(criticalLevel).toBe(RiskLevel.CRITICAL);
    expect(highLevel).toBe(RiskLevel.HIGH);
    expect(mediumLevel).toBe(RiskLevel.MEDIUM);
    expect(lowLevel).toBe(RiskLevel.LOW);
  });

  it('should generate mitigation plan', async () => {
    const assessor = new RiskAssessor();

    const config = {
      scope: 'organization',
      standards: [ComplianceStandard.SOC2],
      timeframe: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      },
      tolerance: {
        critical: 0,
        high: 2,
        medium: 5,
        low: 10
      }
    };

    const assessment = await assessor.assess(config);

    expect(assessment.mitigationPlan).toBeDefined();
    expect(assessment.mitigationPlan.strategies).toBeDefined();
    expect(assessment.mitigationPlan.priorities).toBeDefined();
    expect(assessment.mitigationPlan.budget).toBeGreaterThanOrEqual(0);
  });

  it('should track risk history', async () => {
    const assessor = new RiskAssessor();

    const config = {
      scope: 'organization',
      standards: [ComplianceStandard.SOC2],
      timeframe: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      },
      tolerance: {
        critical: 0,
        high: 2,
        medium: 5,
        low: 10
      }
    };

    await assessor.assess(config);
    const history = assessor.getRiskHistory();

    expect(history.length).toBeGreaterThan(0);
  });

  it('should compare assessments', async () => {
    const assessor = new RiskAssessor();

    const config = {
      scope: 'organization',
      standards: [ComplianceStandard.SOC2],
      timeframe: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      },
      tolerance: {
        critical: 0,
        high: 2,
        medium: 5,
        low: 10
      }
    };

    const assessment1 = await assessor.assess(config);
    const assessment2 = await assessor.assess(config);

    const comparison = assessor.compareAssessments(assessment1, assessment2);

    expect(comparison).toBeDefined();
    expect(comparison.improved).toBeDefined();
    expect(comparison.worsened).toBeDefined();
    expect(comparison.new).toBeDefined();
    expect(comparison.resolved).toBeDefined();
  });
});
