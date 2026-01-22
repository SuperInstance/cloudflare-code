'use client';

import React from 'react';
import { TrendingUp, DollarSign, Info } from 'lucide-react';
import { CostForecast as CostForecastType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils/cn';

interface CostForecastProps {
  forecast: CostForecastType | null;
  isLoading: boolean;
}

export function CostForecast({ forecast, isLoading }: CostForecastProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-32 bg-muted animate-pulse rounded" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!forecast) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No forecast data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'default';
    if (confidence >= 60) return 'secondary';
    return 'destructive';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    return 'Low';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Cost Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Predicted Cost */}
        <div className="text-center p-6 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground mb-2">
            Predicted Cost for {forecast.period}
          </div>
          <div className="text-4xl font-bold mb-2">
            {formatCurrency(forecast.predictedCost)}
          </div>
          <Badge variant={getConfidenceColor(forecast.confidence)}>
            {getConfidenceLabel(forecast.confidence)} Confidence
          </Badge>
        </div>

        {/* Confidence Meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Confidence Level</span>
            <span className="text-muted-foreground">{forecast.confidence}%</span>
          </div>
          <Progress value={forecast.confidence} className="h-2" />
        </div>

        {/* Impact Factors */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4" />
            <span>Key Factors</span>
          </div>
          <div className="space-y-2">
            {forecast.factors.map((factor, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <span className="text-sm">{factor.name}</span>
                <Badge
                  variant={factor.impact > 0 ? 'default' : 'secondary'}
                >
                  {factor.impact > 0 ? '+' : ''}
                  {factor.impact.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-500 mb-1">
                Cost Optimization Tip
              </div>
              <p className="text-xs text-blue-600">
                Based on your usage patterns, you can reduce costs by up to 15% by
                optimizing request batching and caching strategies.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
