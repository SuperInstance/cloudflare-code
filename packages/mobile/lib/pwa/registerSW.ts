/**
 * Service Worker Registration
 *
 * Handles registering and updating the service worker for PWA functionality.
 */

type SWRegistration = ServiceWorkerRegistration;
type SWMessageHandler = (data: any) => void;

class ServiceWorkerManager {
  private registration: SWRegistration | null = null;
  private messageHandlers: Set<SWMessageHandler> = new Set();
  private updateAvailable: boolean = false;

  /**
   * Register the service worker
   */
  async register(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('[SW] Service workers not supported');
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register(
        '/sw.js',
        {
          updateViaCache: 'none',
        }
      );

      console.log('[SW] Registered successfully');

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              this.updateAvailable = true;
              this.notifyUpdateAvailable();
            }
          });
        }
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.messageHandlers.forEach((handler) => handler(event.data));
      });

      // Request notification permission
      this.requestNotificationPermission();

      return true;
    } catch (error) {
      console.error('[SW] Registration failed', error);
      return false;
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      return this.updateAvailable;
    } catch (error) {
      console.error('[SW] Update check failed', error);
      return false;
    }
  }

  /**
   * Skip waiting and activate new service worker
   */
  async activateUpdate(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      return;
    }

    // Send message to waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload page
    window.location.reload();
  }

  /**
   * Add message handler
   */
  onMessage(handler: SWMessageHandler): () => void {
    this.messageHandlers.add(handler);

    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Send message to service worker
   */
  async sendMessage(type: string, data?: any): Promise<void> {
    if (!this.registration || !this.registration.active) {
      console.warn('[SW] No active service worker');
      return;
    }

    this.registration.active.postMessage({
      type,
      data,
    });
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration) {
      console.warn('[SW] No service worker registration');
      return null;
    }

    try {
      // This would typically use your VAPID public key
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        ),
      });

      console.log('[SW] Push subscription successful');
      return subscription;
    } catch (error) {
      console.error('[SW] Push subscription failed', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        console.log('[SW] Push unsubscribe successful');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[SW] Push unsubscribe failed', error);
      return false;
    }
  }

  /**
   * Get current push subscription
   */
  async getPushSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      return null;
    }

    return this.registration.pushManager.getSubscription();
  }

  /**
   * Notify listeners about available update
   */
  private notifyUpdateAvailable(): void {
    const event = new CustomEvent('sw-update-available');
    window.dispatchEvent(event);
  }

  /**
   * Convert URL base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }
}

// Singleton instance
export const swManager = new ServiceWorkerManager();

/**
 * Hook to use service worker in React components
 */
export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  const [registration, setRegistration] = React.useState<SWRegistration | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function register() {
      const success = await swManager.register();
      if (success && mounted) {
        setRegistration(swManager.registration as SWRegistration);
      }
    }

    register();

    // Listen for update events
    const handleUpdate = () => {
      if (mounted) {
        setUpdateAvailable(true);
      }
    };

    window.addEventListener('sw-update-available', handleUpdate);

    return () => {
      mounted = false;
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, []);

  const activateUpdate = React.useCallback(async () => {
    await swManager.activateUpdate();
    setUpdateAvailable(false);
  }, []);

  return {
    registration,
    updateAvailable,
    activateUpdate,
    checkForUpdates: () => swManager.checkForUpdates(),
  };
}

import React from 'react';
