/**
 * ClaudeFlare Marketing Core - Go-to-Market and Content Strategy
 */

export * from './go-to-market';
export * from './content-strategy';

// Re-export default instances
export { GoToMarketStrategy, launchPhases, marketingChannels, developerPersonas, campaignMessaging } from './go-to-market';
export { ContentMarketingManager, contentStrategy, seoStrategy, socialMediaStrategy } from './content-strategy';

// Marketing utilities
export const MarketingUtils = {
  formatBudget: (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  },

  calculateConversionRate: (conversions: number, visitors: number): number => {
    return visitors > 0 ? conversions / visitors : 0;
  },

  calculateCAC: (marketingSpend: number, newCustomers: number): number => {
    return newCustomers > 0 ? marketingSpend / newCustomers : 0;
  },

  calculateLTV: (averageValue: number, averageLifespan: number): number => {
    return averageValue * averageLifespan;
  },

  formatReach: (reach: number): string => {
    if (reach >= 1000000) {
      return `${(reach / 1000000).toFixed(1)}M`;
    } else if (reach >= 1000) {
      return `${(reach / 1000).toFixed(0)}K`;
    }
    return reach.toString();
  },

  generateCampaignReport: (strategy: GoToMarketStrategy) => {
    const launchPlan = strategy.getLaunchPlan();
    const channelStrategy = strategy.getChannelStrategy();
    const timeline = strategy.generateLaunchTimeline();
    const roi = strategy.calculateMarketingROI();
    const metrics = strategy.getMetricsDashboard();

    return {
      executiveSummary: {
        totalBudget: MarketingUtils.formatBudget(launchPlan.totalBudget),
        timeline: launchPlan.timeline,
        keyGoals: launchPlan.phases.flatMap(p => p.objectives),
        expectedROI: `${roi.roi.toFixed(1)}%`,
        breakEven: `${roi.breakEven} months`
      },
      launchPhases: launchPlan.phases.map(phase => ({
        name: phase.name,
        duration: `${phase.duration} months`,
        budget: MarketingUtils.formatBudget(phase.budget),
        objectives: phase.objectives,
        keyMetrics: phase.metrics
      })),
      marketingChannels: channelStrategy.channels.map(channel => ({
        name: channel.name,
        type: channel.type,
        budget: MarketingUtils.formatBudget(channel.cost),
        reach: MarketingUtils.formatReach(channel.reach),
        conversionRate: `${(channel.conversionRate * 100).toFixed(1)}%`
      })),
      contentStrategy: {
        quarterlyPlan: new ContentMarketingManager().getContentPlan(),
        focusAreas: Object.keys(seoStrategy.targetKeywords).join(', '),
        socialPlatforms: Object.keys(socialMediaStrategy.platforms).join(', ')
      },
      kpiMetrics: {
        business: metrics.business.map(kpi => ({
          metric: kpi.name,
          target: `${kpi.target} ${kpi.unit}`,
          description: kpi.description
        })),
        marketing: metrics.marketing.map(kpi => ({
          metric: kpi.name,
          target: `${kpi.target} ${kpi.unit}`,
          description: kpi.description
        })),
        product: metrics.product.map(kpi => ({
          metric: kpi.name,
          target: `${kpi.target} ${kpi.unit}`,
          description: kpi.description
        })),
        financial: metrics.financial.map(kpi => ({
          metric: kpi.name,
          target: `${kpi.target} ${kpi.unit}`,
          description: kpi.description
        }))
      },
      financialProjections: {
        totalInvestment: MarketingUtils.formatBudget(roi.totalInvestment),
        expectedReturns: MarketingUtils.formatBudget(roi.expectedReturns),
        roi: `${roi.roi.toFixed(1)}%`,
        breakEven: `${roi.breakEven} months`
      }
    };
  }
};