'use client';

import React from 'react';
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { BillingInfo } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils/cn';

interface BillingOverviewProps {
  billing: BillingInfo | null;
  isLoading: boolean;
}

export function BillingOverview({ billing, isLoading }: BillingOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardTitle>
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!billing) {
    return null;
  }

  const usagePercentage = (billing.currentUsage / billing.plan.limits.requests) * 100;
  const daysRemaining = Math.ceil((billing.billingCycle.end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const dailyAverage = billing.currentUsage / (new Date().getDate() || 1);

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(billing.currentBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-recharge enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(billing.currentUsage)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              requests this cycle
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysRemaining}</div>
            <p className="text-xs text-muted-foreground mt-1">
              until {formatDate(billing.billingCycle.end)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(Math.round(dailyAverage))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              requests per day
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {billing.usageBreakdown.map((item) => {
              const percentage = (item.usage / billing.currentUsage) * 100;
              return (
                <div key={item.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.category}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(item.usage)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(item.cost)}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Plan</span>
              <Badge variant="default">{billing.plan.name}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tier</span>
              <span className="text-sm text-muted-foreground">{billing.plan.tier}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Request Limit</span>
                <span className="font-medium">
                  {formatNumber(billing.currentUsage)} / {formatNumber(billing.plan.limits.requests)}
                </span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {usagePercentage.toFixed(1)}% of limit used
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span>Storage</span>
              <span className="font-medium">
                {formatBytes(billing.currentUsage * 1000)} / {formatBytes(billing.plan.limits.storage)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}
