'use client';

import React, { useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import { Invoice } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils/cn';

interface InvoiceHistoryProps {
  invoices: Invoice[];
  onDownload: (invoiceId: string) => Promise<void>;
}

export function InvoiceHistory({ invoices, onDownload }: InvoiceHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = async (invoiceId: string) => {
    setDownloading(invoiceId);
    try {
      await onDownload(invoiceId);
    } finally {
      setDownloading(null);
    }
  };

  const getStatusVariant = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Invoice List */}
        <div className="space-y-2">
          {filteredInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No invoices found
            </p>
          ) : (
            filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-background rounded">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Invoice #{invoice.id}</span>
                      <Badge variant={getStatusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(invoice.date)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {formatCurrency(invoice.amount)}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDownload(invoice.id)}
                    disabled={downloading === invoice.id}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
