'use client'

import React from 'react'

interface Feature {
  icon: string
  title: string
  description: string
  link?: string
}

interface FeatureCardsProps {
  features: Feature[]
  columns?: 2 | 3 | 4
}

export default function FeatureCards({ features, columns = 3 }: FeatureCardsProps) {
  return (
    <div className="feature-cards">
      <div
        className="feature-grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`
        }}
      >
        {features.map((feature, index) => (
          <div key={index} className="feature-card">
            <div className="feature-icon">{feature.icon}</div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-description">{feature.description}</p>
            {feature.link && (
              <a href={feature.link} className="feature-link">
                Learn more →
              </a>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .feature-cards {
          margin: 40px 0;
        }

        .feature-grid {
          display: grid;
          gap: 24px;
        }

        .feature-card {
          padding: 24px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          border-color: #0ea5e9;
          box-shadow: 0 8px 24px rgba(14, 165, 233, 0.15);
          transform: translateY(-4px);
        }

        .feature-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .feature-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #1f2937;
        }

        .feature-description {
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 16px;
        }

        .feature-link {
          color: #0ea5e9;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .feature-link:hover {
          color: #0284c7;
        }

        @media (max-width: 768px) {
          .feature-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
