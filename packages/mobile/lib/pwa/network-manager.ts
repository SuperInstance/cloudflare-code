/**
 * Network Manager
 *
 * Monitors network connectivity and manages online/offline state.
 */

type NetworkStatus = 'online' | 'offline' | 'unknown';
type NetworkQuality = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

class NetworkManager {
  private isOnline: boolean = true;
  private listeners: Set<(status: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  /**
   * Initialize network monitoring
   */
  private init(): void {
    // Set initial state
    this.isOnline = navigator.onLine;

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    this.isOnline = true;
    this.notifyListeners();
    console.log('[Network] Connection restored');

    // Trigger background sync if service worker is available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register('sync-messages');
        registration.sync.register('sync-projects');
      });
    }
  };

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    this.isOnline = false;
    this.notifyListeners();
    console.log('[Network] Connection lost');
  };

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.isOnline));
  }

  /**
   * Check if currently online
   */
  getStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Get network status
   */
  getNetworkStatus(): NetworkStatus {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      return 'offline';
    }
    return 'online';
  }

  /**
   * Get network quality (if available)
   */
  getNetworkQuality(): NetworkQuality {
    if (typeof navigator === 'undefined' || !(navigator as any).connection) {
      return 'unknown';
    }

    const connection = (navigator as any).connection;
    return connection.effectiveType || 'unknown';
  }

  /**
   * Subscribe to network status changes
   */
  subscribe(listener: (status: boolean) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Check if connection is slow
   */
  isSlowConnection(): boolean {
    const quality = this.getNetworkQuality();
    return quality === 'slow-2g' || quality === '2g';
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): {
    online: boolean;
    quality: NetworkQuality;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  } {
    const connection = typeof navigator !== 'undefined' ? (navigator as any).connection : null;

    return {
      online: this.isOnline,
      quality: this.getNetworkQuality(),
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
    };
  }
}

// Singleton instance
export const networkManager = new NetworkManager();

/**
 * Hook to use network status in React components
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(() => networkManager.getStatus());
  const [networkInfo, setNetworkInfo] = React.useState(() => networkManager.getConnectionInfo());

  React.useEffect(() => {
    let mounted = true;

    const unsubscribe = networkManager.subscribe((status) => {
      if (mounted) {
        setIsOnline(status);
        setNetworkInfo(networkManager.getConnectionInfo());
      }
    });

    // Also listen to connection changes if available
    const connection = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
    if (connection) {
      const handleConnectionChange = () => {
        if (mounted) {
          setNetworkInfo(networkManager.getConnectionInfo());
        }
      };

      connection.addEventListener('change', handleConnectionChange);

      return () => {
        mounted = false;
        unsubscribe();
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    ...networkInfo,
    isSlow: networkManager.isSlowConnection(),
  };
}

import React from 'react';
