/**
 * Offline Page
 *
 * Displayed when the user is offline.
 */

'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function OfflinePage() {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    // Wait a moment and check connection
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (navigator.onLine) {
      window.location.reload();
    }
    setIsRetrying(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <WifiOff className="w-10 h-10 text-gray-600 dark:text-gray-400" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              You're offline
            </h1>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Check your internet connection and try again. Some features may still be available.
            </p>

            {/* Retry Button */}
            <Button
              fullWidth
              onClick={handleRetry}
              disabled={isRetrying}
              isLoading={isRetrying}
            >
              {isRetrying ? 'Checking...' : 'Retry'}
            </Button>

            {/* Available Features */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Still available offline:
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-success-500" />
                  <span>View cached conversations</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-success-500" />
                  <span>Browse project files</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-success-500" />
                  <span>Draft messages (sync when online)</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
