/**
 * ClaudeFlare Business Core - Monetization and Business Model
 */

export * from './model';
export * from './pricing-calculator';

// Re-export default business model for convenience
export { defaultBusinessModel } from './model';
export { pricingCalculator } from './pricing-calculator';

// Version info
export const VERSION = '1.0.0';
export const BUSINESS_MODEL_VERSION = '1.0.0';

// Helper utilities
export const BusinessUtils = {
  formatCurrency: (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  },

  formatPercentage: (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  },

  formatBytes: (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },

  formatNumber: (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  },

  generateBusinessReport: (model?: any) => {
    const analytics = new BusinessAnalytics(model || defaultBusinessModel);
    const metrics = analytics.generateMetrics();

    return {
      summary: {
        totalCustomers: metrics.business.totalCustomers,
        monthlyRevenue: metrics.financial.monthlyRecurringRevenue,
        annualRevenue: metrics.financial.annualRecurringRevenue,
        churnRate: metrics.customer.churnRate,
        customerSatisfaction: metrics.customer.customerSatisfaction
      },
      financial: {
        profitability: metrics.financial.profitability,
        burnRate: metrics.financial.burnRate,
        runway: metrics.financial.runway,
        cashFlow: metrics.financial.cashFlow
      },
      customer: {
        retention: metrics.customer.customerRetention,
        expansionRevenue: metrics.customer.expansionRevenue,
        satisfaction: metrics.customer.customerSatisfaction,
        churn: metrics.customer.churnRate
      },
      product: {
        dailyActiveUsers: metrics.product.userEngagement.dailyActiveUsers,
        weeklyActiveUsers: metrics.product.userEngagement.weeklyActiveUsers,
        monthlyActiveUsers: metrics.product.userEngagement.monthlyActiveUsers,
        uptime: metrics.product.performance.uptime,
        responseTime: metrics.product.performance.responseTime
      }
    };
  }
};