/**
 * PWA Install Prompt Handler
 *
 * Manages the beforeinstallprompt event and installation flow.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

class PWAInstallManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  /**
   * Initialize event listeners
   */
  private init(): void {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      console.log('[PWA] Install prompt available');
    });

    // Listen for app install
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      console.log('[PWA] App installed');
    });

    // Check if already installed
    this.isInstalled = this.checkIfInstalled();
  }

  /**
   * Check if PWA is already installed
   */
  private checkIfInstalled(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }

    // Check if running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // Check iOS standalone mode
    const isIOSStandalone = (window.navigator as any).standalone === true;

    return isStandalone || isIOSStandalone;
  }

  /**
   * Check if install prompt is available
   */
  canInstall(): boolean {
    return !this.isInstalled && this.deferredPrompt !== null;
  }

  /**
   * Check if app is installed
   */
  isAppInstalled(): boolean {
    return this.isInstalled;
  }

  /**
   * Show install prompt
   */
  async promptInstall(): Promise<{ outcome: 'accepted' | 'dismissed' }> {
    if (!this.deferredPrompt) {
      throw new Error('Install prompt not available');
    }

    // Show the prompt
    this.deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await this.deferredPrompt.userChoice;

    // Clear the deferred prompt
    this.deferredPrompt = null;

    if (outcome === 'accepted') {
      this.isInstalled = true;
      console.log('[PWA] User accepted install prompt');
    } else {
      console.log('[PWA] User dismissed install prompt');
    }

    return { outcome };
  }

  /**
   * Get install instructions based on device
   */
  getInstallInstructions(): {
    canShow: boolean;
    title: string;
    steps: string[];
  } {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/.test(userAgent);
    const isDesktop = !isIOS && !isAndroid;

    if (isIOS) {
      return {
        canShow: true,
        title: 'Install on iPhone/iPad',
        steps: [
          'Tap the Share button in Safari',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to install the app',
        ],
      };
    }

    if (isAndroid) {
      return {
        canShow: true,
        title: 'Install on Android',
        steps: [
          'Tap the menu button in Chrome',
          'Tap "Add to Home Screen"',
          'Tap "Add" to install the app',
        ],
      };
    }

    if (isDesktop) {
      return {
        canShow: true,
        title: 'Install on Desktop',
        steps: [
          'Look for the install icon in the address bar',
          'Click the icon to install the app',
          'Follow the prompts to complete installation',
        ],
      };
    }

    return {
      canShow: false,
      title: 'Install App',
      steps: [],
    };
  }
}

// Singleton instance
export const pwaInstallManager = new PWAInstallManager();

/**
 * Hook to use PWA install in React components
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = React.useState(false);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [promptShown, setPromptShown] = React.useState(false);

  React.useEffect(() => {
    // Check initial state
    setCanInstall(pwaInstallManager.canInstall());
    setIsInstalled(pwaInstallManager.isAppInstalled());

    // Listen for changes
    const handleBeforeInstallPrompt = () => {
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (!canInstall) {
      return { outcome: 'dismissed' as const };
    }

    setPromptShown(true);
    const result = await pwaInstallManager.promptInstall();
    return result;
  }, [canInstall]);

  const getInstructions = React.useCallback(() => {
    return pwaInstallManager.getInstallInstructions();
  }, []);

  return {
    canInstall,
    isInstalled,
    promptShown,
    promptInstall,
    getInstructions,
  };
}

import React from 'react';
