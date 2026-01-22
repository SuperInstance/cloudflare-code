'use client';

import React, { useState } from 'react';
import { Bell, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils/cn';

interface BudgetAlert {
  id: string;
  amount: number;
  currentSpend: number;
  enabled: boolean;
}

interface BudgetAlertsProps {
  alerts: BudgetAlert[];
  onUpdate: (id: string, amount: number) => void;
  onCreate: (amount: number) => void;
  onDelete: (id: string) => void;
}

export function BudgetAlerts({ alerts, onUpdate, onCreate, onDelete }: BudgetAlertsProps) {
  const [newAlertAmount, setNewAlertAmount] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleCreateAlert = () => {
    const amount = parseFloat(newAlertAmount);
    if (isNaN(amount) || amount <= 0) return;

    onCreate(amount);
    setNewAlertAmount('');
    setShowAddForm(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Budget Alerts
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Alert
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Alert Form */}
        {showAddForm && (
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Alert Threshold
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={newAlertAmount}
                  onChange={(e) => setNewAlertAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <Button onClick={handleCreateAlert}>Add</Button>
              </div>
            </div>
          </div>
        )}

        {/* Alerts List */}
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No budget alerts configured. Add an alert to get notified when
              your spending reaches a threshold.
            </p>
          ) : (
            alerts.map((alert) => {
              const percentage = (alert.currentSpend / alert.amount) * 100;
              const isOverBudget = alert.currentSpend >= alert.amount;

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    isOverBudget
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isOverBudget && (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium">
                          {formatCurrency(alert.amount)} Alert
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Current: {formatCurrency(alert.currentSpend)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={isOverBudget ? 'destructive' : 'default'}>
                        {isOverBudget ? 'Over Budget' : 'Active'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(alert.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Progress
                    value={Math.min(percentage, 100)}
                    className={`h-2 ${
                      isOverBudget ? '[&>div]:bg-red-500' : ''
                    }`}
                  />

                  <div className="text-xs text-muted-foreground mt-2">
                    {percentage.toFixed(1)}% of threshold
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
