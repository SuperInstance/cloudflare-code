'use client';

// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { BillingOverview } from '@/components/billing/BillingOverview';
import { CostForecast } from '@/components/billing/CostForecast';
import { InvoiceHistory } from '@/components/billing/InvoiceHistory';
import { BudgetAlerts } from '@/components/billing/BudgetAlerts';
import { Invoice, BillingInfo } from '@/types';

export default function BillingPage() {
  const { billing, forecast, fetchBilling, fetchForecast } = useAnalytics();

  const [invoices] = useState<Invoice[]>([
    {
      id: 'INV-2024-001',
      date: new Date('2024-01-01'),
      amount: 123.45,
      status: 'paid',
      pdfUrl: '/invoices/INV-2024-001.pdf',
    },
    {
      id: 'INV-2024-002',
      date: new Date('2024-02-01'),
      amount: 234.56,
      status: 'paid',
      pdfUrl: '/invoices/INV-2024-002.pdf',
    },
    {
      id: 'INV-2024-003',
      date: new Date('2024-03-01'),
      amount: 345.67,
      status: 'pending',
      pdfUrl: '/invoices/INV-2024-003.pdf',
    },
  ]);

  const [budgetAlerts] = useState([
    {
      id: '1',
      amount: 100,
      currentSpend: 75,
      enabled: true,
    },
    {
      id: '2',
      amount: 200,
      currentSpend: 180,
      enabled: true,
    },
  ]);

  useEffect(() => {
    fetchBilling();
    fetchForecast('month');
  }, []);

  const handleDownloadInvoice = async (invoiceId: string) => {
    // Simulate download
    console.log('Downloading invoice:', invoiceId);
  };

  const handleUpdateBudgetAlert = (id: string, amount: number) => {
    console.log('Updating budget alert:', id, amount);
  };

  const handleCreateBudgetAlert = (amount: number) => {
    console.log('Creating budget alert:', amount);
  };

  const handleDeleteBudgetAlert = (id: string) => {
    console.log('Deleting budget alert:', id);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Billing & Costs</h1>
            <p className="text-sm text-muted-foreground">
              Manage your billing, view invoices, and monitor costs
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        <BillingOverview billing={billing} isLoading={false} />

        <div className="grid gap-6 lg:grid-cols-2">
          <CostForecast forecast={forecast} isLoading={false} />
          <BudgetAlerts
            alerts={budgetAlerts}
            onUpdate={handleUpdateBudgetAlert}
            onCreate={handleCreateBudgetAlert}
            onDelete={handleDeleteBudgetAlert}
          />
        </div>

        <InvoiceHistory invoices={invoices} onDownload={handleDownloadInvoice} />
      </div>
    </div>
  );
}
