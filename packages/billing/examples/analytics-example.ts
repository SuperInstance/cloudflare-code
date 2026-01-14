/**
 * Example: Usage Analytics and Forecasting
 *
 * This example demonstrates how to generate usage analytics and forecasts
 */

import { createUsageAnalyzer } from '../src/index.js';
import { PlanType } from '../src/types/index.js';

// Initialize usage analyzer
const analyzer = createUsageAnalyzer();

// Generate usage summary
async function generateUsageSummary() {
  const summary = await analyzer.generateUsageSummary({
    organizationId: 'org_tech_startup',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-01-31'),
    usageData: {
      requests: 25000,
      tokens: 15000000,
      cpuTime: 150000,
      storage: 200000000000, // 200 GB
      bandwidth: 3000000000000, // 3 TB
      apiCalls: 250000,
    },
    planType: PlanType.PRO,
  });

  console.log('Usage Summary for January 2024:');
  console.log('Requests:', summary.metrics.requests.total);
  console.log('Tokens:', summary.metrics.tokens.total);
  console.log('CPU Time:', summary.metrics.cpuTime.total, 'seconds');
  console.log('Storage:', (summary.metrics.storage.total / 1e9).toFixed(2), 'GB');
  console.log('Bandwidth:', (summary.metrics.bandwidth.total / 1e12).toFixed(2), 'TB');
  console.log('\nCost Breakdown:');
  console.log('  Base cost:', summary.costBreakdown.baseCost);
  console.log('  Overage cost:', summary.costBreakdown.overageCost.toFixed(2));
  console.log('  Total cost:', summary.costBreakdown.totalCost.toFixed(2));

  return summary;
}

// Generate usage forecast
async function generateForecast() {
  const forecast = await analyzer.generateForecast({
    organizationId: 'org_tech_startup',
    forecastStart: new Date('2024-02-01'),
    forecastEnd: new Date('2024-02-29'),
    historicalData: {
      requests: [20000, 22000, 25000, 27000],
      tokens: [12000000, 13500000, 15000000, 16500000],
      cpuTime: [120000, 135000, 150000, 165000],
      storage: [180000000000, 190000000000, 200000000000, 210000000000],
      bandwidth: [2500000000000, 2750000000000, 3000000000000, 3250000000000],
    },
    planType: PlanType.PRO,
  });

  console.log('\nForecast for February 2024:');
  console.log('Projected Requests:', forecast.metrics.requests.projected.toFixed(0));
  console.log('  Trend:', forecast.metrics.requests.trend);
  console.log('  Confidence:', (forecast.metrics.requests.confidence * 100).toFixed(1), '%');
  console.log('\nProjected Tokens:', forecast.metrics.tokens.projected.toFixed(0));
  console.log('  Trend:', forecast.metrics.tokens.trend);
  console.log('\nProjected Cost:', forecast.projectedCost.toFixed(2));

  if (forecast.recommendations.length > 0) {
    console.log('\nRecommendations:');
    forecast.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }

  return forecast;
}

// Calculate revenue metrics
async function calculateRevenueMetrics() {
  const metrics = await analyzer.calculateRevenueMetrics({
    subscriptions: [
      {
        planId: 'plan_pro_monthly',
        status: 'active',
        createdAt: new Date('2024-01-01'),
      },
      {
        planId: 'plan_pro_monthly',
        status: 'active',
        createdAt: new Date('2024-01-15'),
      },
      {
        planId: 'plan_team_monthly',
        status: 'active',
        createdAt: new Date('2024-01-01'),
      },
      {
        planId: 'plan_team_monthly',
        status: 'active',
        createdAt: new Date('2024-01-10'),
      },
      {
        planId: 'plan_free',
        status: 'active',
        createdAt: new Date('2024-01-05'),
      },
    ],
    churnedSubscriptions: [
      {
        planId: 'plan_pro_monthly',
        canceledAt: new Date('2024-01-20'),
        lifetimeValue: 348, // $29 * 12
      },
    ],
  });

  console.log('\nRevenue Metrics:');
  console.log('  MRR:', metrics.mrr.toFixed(2));
  console.log('  ARR:', metrics.arr.toFixed(2));
  console.log('  ARPU:', metrics.arpu.toFixed(2));
  console.log('  LTV:', metrics.ltv.toFixed(2));
  console.log('  Churn Rate:', (metrics.churnRate * 100).toFixed(2), '%');
  console.log('  Growth Rate:', (metrics.growthRate * 100).toFixed(2), '%');

  return metrics;
}

// Analyze churn
async function analyzeChurn() {
  const analysis = await analyzer.analyzeChurn({
    totalSubscriptions: 500,
    churnedSubscriptions: [
      {
        planId: 'plan_free',
        canceledAt: new Date('2024-01-15'),
        reason: 'upgraded_to_pro',
      },
      {
        planId: 'plan_free',
        canceledAt: new Date('2024-01-18'),
        reason: 'upgraded_to_pro',
      },
      {
        planId: 'plan_pro_monthly',
        canceledAt: new Date('2024-01-20'),
        reason: 'too_expensive',
      },
      {
        planId: 'plan_pro_monthly',
        canceledAt: new Date('2024-01-22'),
        reason: 'too_expensive',
      },
      {
        planId: 'plan_pro_monthly',
        canceledAt: new Date('2024-01-25'),
        reason: 'too_expensive',
      },
      {
        planId: 'plan_team_monthly',
        canceledAt: new Date('2024-01-28'),
        reason: 'company_closed',
      },
    ],
  });

  console.log('\nChurn Analysis:');
  console.log('  Total Subscriptions:', analysis.totalSubscriptions);
  console.log('  Churned Subscriptions:', analysis.churnedSubscriptions);
  console.log('  Churn Rate:', (analysis.churnRate * 100).toFixed(2), '%');
  console.log('\n  Churn by Plan:');
  console.log('    Free:', analysis.byPlan[PlanType.FREE]);
  console.log('    Pro:', analysis.byPlan[PlanType.PRO]);
  console.log('    Team:', analysis.byPlan[PlanType.TEAM]);
  console.log('\n  Churn Reasons:');
  analysis.reasons.forEach((reason) => {
    console.log(`    ${reason.reason}:`, reason.count, `(${reason.percentage.toFixed(1)}%)`);
  });

  return analysis;
}

// Get usage trends
async function getUsageTrends() {
  const trends = await analyzer.getUsageTrends({
    organizationId: 'org_tech_startup',
    metric: 'requests' as any,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    granularity: 'day',
    historicalData: Array.from({ length: 31 }, (_, i) => ({
      timestamp: new Date(2024, 0, i + 1),
      value: 500 + i * 50 + Math.random() * 100,
    })),
  });

  console.log('\nUsage Trends (last 7 days):');
  trends.slice(-7).forEach((trend) => {
    console.log(
      `  ${trend.timestamp.toISOString().split('T')[0]}:`,
      trend.value.toFixed(0),
      'requests'
    );
  });

  return trends;
}

// Complete analytics workflow
async function main() {
  console.log('=== ClaudeFlare Billing Analytics ===\n');

  // Generate usage summary
  await generateUsageSummary();

  // Generate forecast
  await generateForecast();

  // Calculate revenue metrics
  await calculateRevenueMetrics();

  // Analyze churn
  await analyzeChurn();

  // Get usage trends
  await getUsageTrends();
}

// Uncomment to run
// main().catch(console.error);
