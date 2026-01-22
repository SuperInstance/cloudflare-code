/**
 * Cost Estimator - Visual cost breakdown and optimization
 */

import React, { useState, useMemo } from 'react';
import { useVisualBuilder, useCosts } from '../context/VisualBuilderContext';
import { ServiceNode, CostBreakdown } from '../types';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Tabs } from '../components/Tab';

interface CostEstimatorProps {
  width: number;
  height: number;
}

interface ServiceCost {
  id: string;
  name: string;
  type: ServiceNode['type'];
  monthly: number;
  yearly: number;
  breakdown: {
    requests: number;
    cpu: number;
    memory: number;
    storage: number;
    bandwidth: number;
  };
}

interface OptimizationSuggestion {
  id: string;
  type: 'resource' | 'scaling' | 'architecture';
  title: string;
  description: string;
  potentialSavings: number;
  impact: 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'medium' | 'hard';
}

export function CostEstimator({ width, height }: CostEstimatorProps) {
  const { state, dispatch } = useVisualBuilder();
  const [activeTab, setActiveTab] = useState('breakdown');
  const [trafficProfile, setTrafficProfile] = useState({
    requestsPerMonth: 100000,
    averageCpuPerRequest: 10, // ms
    dataTransferPerMonth: 10, // GB
    concurrentUsers: 100,
  });

  // Calculate costs for each service
  const serviceCosts = useMemo((): ServiceCost[] => {
    return state.canvas.services.map(service => {
      // Simplified cost calculation based on service type
      const baseCosts = {
        worker: { monthly: 5, yearly: 50 },
        page: { monthly: 1, yearly: 10 },
        'worker-pages': { monthly: 5, yearly: 50 },
        database: { monthly: 5, yearly: 50 },
        storage: { monthly: 0.015, yearly: 0.15 }, // per GB
        queue: { monthly: 1, yearly: 10 },
        cache: { monthly: 0.5, yearly: 5 },
        auth: { monthly: 1, yearly: 10 },
      };

      const base = baseCosts[service.type] || { monthly: 1, yearly: 10 };

      // Scale based on traffic profile
      const scaleMultiplier = trafficProfile.requestsPerMonth / 100000;
      const cpuMultiplier = trafficProfile.averageCpuPerRequest / 10;

      const monthly = base.monthly * scaleMultiplier * cpuMultiplier;
      const yearly = base.yearly * scaleMultiplier * cpuMultiplier;

      return {
        id: service.id,
        name: service.name,
        type: service.type,
        monthly,
        yearly,
        breakdown: {
          requests: monthly * 0.3,
          cpu: monthly * 0.4,
          memory: monthly * 0.2,
          storage: monthly * 0.05,
          bandwidth: monthly * 0.05,
        }
      };
    });
  }, [state.canvas.services, trafficProfile]);

  // Calculate total costs
  const totalCosts = useMemo(() => {
    const monthly = serviceCosts.reduce((sum, cost) => sum + cost.monthly, 0);
    const yearly = serviceCosts.reduce((sum, cost) => sum + cost.yearly, 0);

    const breakdown = serviceCosts.reduce((acc, cost) => ({
      requests: acc.requests + cost.breakdown.requests,
      cpu: acc.cpu + cost.breakdown.cpu,
      memory: acc.memory + cost.breakdown.memory,
      storage: acc.storage + cost.breakdown.storage,
      bandwidth: acc.bandwidth + cost.breakdown.bandwidth,
    }), {
      requests: 0,
      cpu: 0,
      memory: 0,
      storage: 0,
      bandwidth: 0,
    });

    return { monthly, yearly, breakdown };
  }, [serviceCosts]);

  // Generate optimization suggestions
  const optimizationSuggestions = useMemo((): OptimizationSuggestion[] => {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for over-provisioned memory
    serviceCosts.forEach(service => {
      if (service.config?.resources?.memory === '512MB' && service.type === 'worker') {
        suggestions.push({
          id: `mem-${service.id}`,
          type: 'resource',
          title: 'Reduce memory allocation',
          description: `Consider reducing memory allocation for ${service.name} from 512MB to 128MB`,
          potentialSavings: service.monthly * 0.3,
          impact: 'medium',
          difficulty: 'easy'
        });
      }
    });

    // Check for auto-scaling opportunities
    serviceCosts.forEach(service => {
      if (!service.config?.scaling?.autoScaling && service.type === 'worker') {
        suggestions.push({
          id: `scale-${service.id}`,
          type: 'scaling',
          title: 'Enable auto-scaling',
          description: `Enable auto-scaling for ${service.name} to handle traffic efficiently`,
          potentialSavings: service.monthly * 0.2,
          impact: 'high',
          difficulty: 'medium'
        });
      }
    });

    // Check for static optimization
    const pageServices = serviceCosts.filter(s => s.type === 'page');
    if (pageServices.length > 2) {
      suggestions.push({
        id: 'static-optimization',
        type: 'architecture',
        title: 'Implement static CDN',
        description: 'Use Cloudflare Pages with edge caching for better performance',
        potentialSavings: 5,
        impact: 'high',
        difficulty: 'medium'
      });
    }

    return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }, [serviceCosts]);

  // Calculate estimated savings
  const totalSavings = optimizationSuggestions.reduce((sum, suggestion) => sum + suggestion.potentialSavings, 0);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  return (
    <div className="cost-estimator">
      <div className="estimator-header">
        <div className="estimator-title">
          <Icon name="Calculator" size={24} />
          <h2>Cost Estimator</h2>
        </div>
        <div className="estimator-summary">
          <div className="summary-item">
            <span className="label">Monthly:</span>
            <span className="value primary">{formatCurrency(totalCosts.monthly)}</span>
          </div>
          <div className="summary-item">
            <span className="label">Yearly:</span>
            <span className="value">{formatCurrency(totalCosts.yearly)}</span>
          </div>
        </div>
      </div>

      <Tabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="estimator-tabs"
      >
        <Tab id="breakdown" label="Breakdown">
          <div className="breakdown-content">
            <div className="traffic-profile">
              <h3>Traffic Profile</h3>
              <div className="profile-inputs">
                <div className="input-group">
                  <label>Requests per month</label>
                  <input
                    type="number"
                    value={trafficProfile.requestsPerMonth}
                    onChange={(e) => setTrafficProfile(prev => ({
                      ...prev,
                      requestsPerMonth: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="input-group">
                  <label>Avg CPU per request (ms)</label>
                  <input
                    type="number"
                    value={trafficProfile.averageCpuPerRequest}
                    onChange={(e) => setTrafficProfile(prev => ({
                      ...prev,
                      averageCpuPerRequest: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="input-group">
                  <label>Data transfer per month (GB)</label>
                  <input
                    type="number"
                    value={trafficProfile.dataTransferPerMonth}
                    onChange={(e) => setTrafficProfile(prev => ({
                      ...prev,
                      dataTransferPerMonth: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="cost-breakdown">
              <h3>Cost Breakdown</h3>
              <div className="breakdown-chart">
                <div className="chart-bars">
                  {Object.entries(totalCosts.breakdown).map(([key, value]) => (
                    <div key={key} className="chart-bar">
                      <div className="bar-label">{key}</div>
                      <div className="bar-wrapper">
                        <div
                          className="bar-fill"
                          style={{ width: `${(value / totalCosts.monthly) * 100}%` }}
                        />
                        <div className="bar-value">{formatCurrency(value)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="service-costs">
              <h3>Service Costs</h3>
              <div className="cost-list">
                {serviceCosts.map(service => (
                  <div key={service.id} className="cost-item">
                    <div className="service-info">
                      <Icon name={getServiceIcon(service.type)} size={16} />
                      <div>
                        <div className="service-name">{service.name}</div>
                        <div className="service-type">{service.type}</div>
                      </div>
                    </div>
                    <div className="service-costs">
                      <div className="cost-monthly">{formatCurrency(service.monthly)}/mo</div>
                      <div className="cost-yearly">{formatCurrency(service.yearly)}/yr</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Tab>

        <Tab id="optimization" label="Optimization">
          <div className="optimization-content">
            <div className="optimization-summary">
              <div className="savings-card">
                <div className="savings-header">
                  <h3>Potential Savings</h3>
                  <div className="savings-amount">
                    {formatCurrency(totalSavings)}
                    <span className="savings-period">/month</span>
                  </div>
                </div>
                <p>Apply all optimization suggestions to reduce your monthly costs</p>
              </div>
            </div>

            <div className="optimization-list">
              <h3>Optimization Suggestions</h3>
              {optimizationSuggestions.map(suggestion => (
                <div key={suggestion.id} className="optimization-item">
                  <div className="optimization-header">
                    <div className="optimization-title">{suggestion.title}</div>
                    <div className="optimization-badges">
                      <span className={`badge impact ${suggestion.impact}`}>
                        {suggestion.impact} impact
                      </span>
                      <span className={`badge difficulty ${suggestion.difficulty}`}>
                        {suggestion.difficulty}
                      </span>
                    </div>
                  </div>
                  <p className="optimization-description">{suggestion.description}</p>
                  <div className="optimization-footer">
                    <div className="savings">
                      Save {formatCurrency(suggestion.potentialSavings)}/month
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        // Apply optimization
                        console.log('Apply optimization:', suggestion.id);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              ))}

              {optimizationSuggestions.length === 0 && (
                <div className="no-optimizations">
                  <Icon name="CheckCircle" size={48} />
                  <p>Your application is already optimized!</p>
                </div>
              )}
            </div>
          </div>
        </Tab>

        <Tab id="scenarios" label="Scenarios">
          <div className="scenarios-content">
            <div className="scenario-cards">
              <div className="scenario-card">
                <div className="scenario-header">
                  <h4>Development</h4>
                  <span className="scenario-type">Low Traffic</span>
                </div>
                <div className="scenario-stats">
                  <div className="stat">
                    <span>Requests:</span>
                    <span>10K/mo</span>
                  </div>
                  <div className="stat">
                    <span>Users:</span>
                    <span>10</span>
                  </div>
                  <div className="stat">
                    <span>Cost:</span>
                    <span className="cost">{formatCurrency(1)}</span>
                  </div>
                </div>
              </div>

              <div className="scenario-card">
                <div className="scenario-header">
                  <h4>Production</h4>
                  <span className="scenario-type">Medium Traffic</span>
                </div>
                <div className="scenario-stats">
                  <div className="stat">
                    <span>Requests:</span>
                    <span>100K/mo</span>
                  </div>
                  <div className="stat">
                    <span>Users:</span>
                    <span>100</span>
                  </div>
                  <div className="stat">
                    <span>Cost:</span>
                    <span className="cost">{formatCurrency(totalCosts.monthly)}</span>
                  </div>
                </div>
              </div>

              <div className="scenario-card">
                <div className="scenario-header">
                  <h4>Enterprise</h4>
                  <span className="scenario-type">High Traffic</span>
                </div>
                <div className="scenario-stats">
                  <div className="stat">
                    <span>Requests:</span>
                    <span>1M/mo</span>
                  </div>
                  <div className="stat">
                    <span>Users:</span>
                    <span>10K</span>
                  </div>
                  <div className="stat">
                    <span>Cost:</span>
                    <span className="cost">{formatCurrency(totalCosts.monthly * 10)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="scenario-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Save current configuration
                  dispatch({
                    type: 'SET_COST_ESTIMATE',
                    payload: {
                      monthly: totalCosts.monthly,
                      yearly: totalCosts.yearly,
                      currency: 'USD',
                      breakdown: totalCosts.breakdown as any,
                      scenarios: [],
                      optimization: {
                        potentialSavings: totalSavings,
                        recommendations: optimizationSuggestions.map(s => ({
                          area: s.type,
                          description: s.description,
                          impact: s.impact,
                          estimatedSavings: s.potentialSavings
                        }))
                      }
                    }
                  });
                }}
              >
                Save Configuration
              </Button>
            </div>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}

// Helper function to get service icon
function getServiceIcon(type: string): string {
  const icons = {
    worker: 'Code',
    page: 'Globe',
    'worker-pages': 'Layers',
    database: 'Database',
    storage: 'FolderOpen',
    queue: 'List',
    cache: 'Database',
    auth: 'Shield',
  };
  return icons[type] || 'Code';
}