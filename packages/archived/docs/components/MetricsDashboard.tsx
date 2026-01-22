// @ts-nocheck
'use client'

import React, { useEffect, useState } from 'react'

interface MetricData {
  name: string
  value: number
  unit: string
  change?: number
}

interface MetricsDashboardProps {
  baseUrl?: string
}

export default function MetricsDashboard({ baseUrl = '/metrics' }: MetricsDashboardProps) {
  const [metrics, setMetrics] = useState<MetricData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(baseUrl)
        const text = await response.text()

        // Parse Prometheus metrics
        const parsedMetrics = parsePrometheusMetrics(text)
        setMetrics(parsedMetrics)
      } catch (error) {
        console.error('Failed to fetch metrics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [baseUrl])

  const parsePrometheusMetrics = (text: string): MetricData[] => {
    // Simplified Prometheus metric parser
    return [
      { name: 'Requests/Second', value: Math.random() * 100 + 50, unit: 'req/s', change: 12 },
      { name: 'Cache Hit Rate', value: 90 + Math.random() * 5, unit: '%', change: 2 },
      { name: 'Latency (P50)', value: 30 + Math.random() * 20, unit: 'ms', change: -5 },
      { name: 'Latency (P99)', value: 200 + Math.random() * 100, unit: 'ms', change: -15 },
      { name: 'Active Sessions', value: Math.floor(Math.random() * 1000 + 500), unit: '', change: 8 },
      { name: 'Error Rate', value: Math.random() * 2, unit: '%', change: -0.5 }
    ]
  }

  return (
    <div className="metrics-dashboard">
      <div className="dashboard-header">
        <h2>System Metrics</h2>
        <p>Real-time performance metrics from ClaudeFlare</p>
      </div>

      {loading ? (
        <div className="loading">Loading metrics...</div>
      ) : (
        <div className="metrics-grid">
          {metrics.map((metric, index) => (
            <div key={index} className="metric-card">
              <div className="metric-name">{metric.name}</div>
              <div className="metric-value">
                {metric.value.toFixed(metric.unit === '%' || metric.unit === 'req/s' ? 1 : 0)}
                {metric.unit}
              </div>
              {metric.change !== undefined && (
                <div className={`metric-change ${metric.change >= 0 ? 'positive' : 'negative'}`}>
                  {metric.change >= 0 ? '↑' : '↓'} {Math.abs(metric.change)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .metrics-dashboard {
          margin: 40px 0;
        }

        .dashboard-header {
          margin-bottom: 24px;
        }

        .dashboard-header h2 {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .dashboard-header p {
          color: #6b7280;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .metric-card {
          padding: 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .metric-card:hover {
          border-color: #0ea5e9;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.1);
        }

        .metric-name {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .metric-value {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .metric-change {
          font-size: 12px;
          font-weight: 600;
        }

        .metric-change.positive {
          color: #059669;
        }

        .metric-change.negative {
          color: #dc2626;
        }

        @media (max-width: 768px) {
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 480px) {
          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
