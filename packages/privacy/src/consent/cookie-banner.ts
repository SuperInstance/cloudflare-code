// @ts-nocheck
/**
 * Cookie Consent Banner Implementation
 * GDPR-compliant cookie consent UI component
 * @packageDocumentation
 */

import type {
  CookiePreferences,
  CookieCategory,
  ConsentStatus,
} from './types';

/**
 * Cookie consent configuration
 */
export interface CookieBannerConfig {
  /** Banner position */
  position: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Banner theme */
  theme: 'light' | 'dark';
  /** Whether to show privacy policy link */
  showPrivacyLink: boolean;
  /** Privacy policy URL */
  privacyPolicyUrl: string;
  /** Whether to show accept all button */
  showAcceptAll: boolean;
  /** Whether to show reject all button */
  showRejectAll: boolean;
  /** Custom CSS classes */
  customClasses?: {
    container?: string;
    title?: string;
    description?: string;
    button?: string;
    category?: string;
  };
  /** Custom messages */
  customMessages?: {
    title?: string;
    description?: string;
    acceptAll?: string;
    acceptSelected?: string;
    rejectAll?: string;
    savePreferences?: string;
    privacyPolicy?: string;
  };
}

/**
 * Generate HTML for cookie consent banner
 */
export function generateCookieBannerHTML(config: CookieBannerConfig): string {
  const positionClass = getPositionClass(config.position);
  const themeClass = config.theme === 'dark' ? 'ccp-dark' : 'ccp-light';

  const title = config.customMessages?.title || 'We Value Your Privacy';
  const description = config.customMessages?.description ||
    'We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.';

  return `
<div id="ccp-banner" class="ccp-banner ${positionClass} ${themeClass} ${config.customClasses?.container || ''}">
  <div class="ccp-content">
    <h2 class="ccp-title ${config.customClasses?.title || ''}">${title}</h2>
    <p class="ccp-description ${config.customClasses?.description || ''}">${description}</p>

    <div class="ccp-categories">
      ${generateCategoryHTML('essential', true, true)}
      ${generateCategoryHTML('functional', false, false)}
      ${generateCategoryHTML('performance', false, false)}
      ${generateCategoryHTML('marketing', false, false)}
    </div>

    <div class="ccp-buttons">
      ${config.showRejectAll ? `<button class="ccp-button ccp-reject ${config.customClasses?.button || ''}" id="ccp-reject-all">${config.customMessages?.rejectAll || 'Reject All'}</button>` : ''}
      <button class="ccp-button ccp-save ${config.customClasses?.button || ''}" id="ccp-save-preferences">${config.customMessages?.savePreferences || 'Save Preferences'}</button>
      ${config.showAcceptAll ? `<button class="ccp-button ccp-accept ${config.customClasses?.button || ''}" id="ccp-accept-all">${config.customMessages?.acceptAll || 'Accept All'}</button>` : ''}
    </div>

    ${config.showPrivacyLink ? `<a href="${config.privacyPolicyUrl}" class="ccp-privacy-link" target="_blank">${config.customMessages?.privacyPolicy || 'Privacy Policy'}</a>` : ''}
  </div>

  <style>
    .ccp-banner {
      position: fixed;
      z-index: 9999;
      background: white;
      padding: 20px;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      max-width: 500px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    .ccp-banner.ccp-top { top: 0; }
    .ccp-banner.ccp-bottom { bottom: 0; }
    .ccp-banner.ccp-top-left { top: 20px; left: 20px; }
    .ccp-banner.ccp-top-right { top: 20px; right: 20px; }
    .ccp-banner.ccp-bottom-left { bottom: 20px; left: 20px; }
    .ccp-banner.ccp-bottom-right { bottom: 20px; right: 20px; }
    .ccp-dark { background: #2d2d2d; color: white; }
    .ccp-light { background: white; color: #333; }
    .ccp-title { margin: 0 0 10px 0; font-size: 18px; font-weight: 600; }
    .ccp-description { margin: 0 0 15px 0; font-size: 14px; line-height: 1.5; }
    .ccp-category { margin: 10px 0; display: flex; align-items: center; }
    .ccp-category input { margin-right: 10px; }
    .ccp-category label { font-size: 13px; cursor: pointer; }
    .ccp-buttons { display: flex; gap: 10px; margin-top: 15px; }
    .ccp-button {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    .ccp-accept { background: #4CAF50; color: white; }
    .ccp-reject { background: #f44336; color: white; }
    .ccp-save { background: #2196F3; color: white; }
    .ccp-privacy-link { display: block; margin-top: 10px; font-size: 12px; color: #2196F3; text-decoration: none; }
    .ccp-dark .ccp-privacy-link { color: #64B5F6; }
  </style>

  <script>
    (function() {
      // Check if consent already given
      const savedConsent = localStorage.getItem('cookie_consent');
      if (savedConsent) {
        return; // Don't show banner if consent already given
      }

      // Show banner
      document.getElementById('ccp-banner').style.display = 'block';

      // Handle button clicks
      document.getElementById('ccp-accept-all').addEventListener('click', function() {
        const preferences = {
          essential: true,
          functional: true,
          performance: true,
          marketing: true,
          socialMedia: true,
          updatedAt: Date.now()
        };
        localStorage.setItem('cookie_consent', JSON.stringify(preferences));
        hideBanner();
        sendConsentToServer(preferences);
      });

      document.getElementById('ccp-reject-all').addEventListener('click', function() {
        const preferences = {
          essential: true,
          functional: false,
          performance: false,
          marketing: false,
          socialMedia: false,
          updatedAt: Date.now()
        };
        localStorage.setItem('cookie_consent', JSON.stringify(preferences));
        hideBanner();
        sendConsentToServer(preferences);
      });

      document.getElementById('ccp-save-preferences').addEventListener('click', function() {
        const preferences = {
          essential: true,
          functional: document.getElementById('ccp-functional').checked,
          performance: document.getElementById('ccp-performance').checked,
          marketing: document.getElementById('ccp-marketing').checked,
          socialMedia: document.getElementById('ccp-social-media').checked,
          updatedAt: Date.now()
        };
        localStorage.setItem('cookie_consent', JSON.stringify(preferences));
        hideBanner();
        sendConsentToServer(preferences);
      });

      function hideBanner() {
        document.getElementById('ccp-banner').style.display = 'none';
      }

      function sendConsentToServer(preferences) {
        fetch('/api/consent/cookies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(preferences)
        }).catch(function(error) {
          console.error('Failed to save consent:', error);
        });
      }
    })();
  </script>
</div>
  `.trim();
}

/**
 * Generate HTML for a cookie category
 */
function generateCategoryHTML(
  category: string,
  checked: boolean,
  disabled: boolean
): string {
  const label = getCategoryLabel(category);
  const description = getCategoryDescription(category);

  return `
  <div class="ccp-category">
    <input
      type="checkbox"
      id="ccp-${category}"
      ${checked ? 'checked' : ''}
      ${disabled ? 'disabled' : ''}
    />
    <div>
      <label for="ccp-${category}">${label}</label>
      ${description ? `<div class="ccp-category-desc">${description}</div>` : ''}
    </div>
  </div>
  `;
}

/**
 * Get category label
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    essential: 'Essential Cookies',
    functional: 'Functional Cookies',
    performance: 'Performance Cookies',
    marketing: 'Marketing Cookies',
    'social-media': 'Social Media Cookies',
  };

  return labels[category] || category;
}

/**
 * Get category description
 */
function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    essential: 'Required for the site to function properly.',
    functional: 'Enable enhanced functionality and personalization.',
    performance: 'Help us improve site performance and user experience.',
    marketing: 'Used to deliver relevant advertisements.',
    'social-media': 'Enable social media features and sharing.',
  };

  return descriptions[category] || '';
}

/**
 * Get position CSS class
 */
function getPositionClass(position: string): string {
  const classes: Record<string, string> = {
    top: 'ccp-top',
    bottom: 'ccp-bottom',
    'top-left': 'ccp-top-left',
    'top-right': 'ccp-top-right',
    'bottom-left': 'ccp-bottom-left',
    'bottom-right': 'ccp-bottom-right',
  };

  return classes[position] || 'ccp-bottom';
}

/**
 * Generate JavaScript for cookie consent management
 */
export function generateCookieConsentJS(): string {
  return `
// Cookie Consent Management
(function() {
  'use strict';

  const CookieConsent = {
    /**
     * Get current cookie preferences
     */
    getPreferences: function() {
      const consent = localStorage.getItem('cookie_consent');
      return consent ? JSON.parse(consent) : null;
    },

    /**
     * Check if category is allowed
     */
    isCategoryAllowed: function(category) {
      const preferences = this.getPreferences();
      return preferences && preferences[category];
    },

    /**
     * Update cookie preferences
     */
    updatePreferences: function(preferences) {
      localStorage.setItem('cookie_consent', JSON.stringify(preferences));
      this.sendToServer(preferences);
    },

    /**
     * Send preferences to server
     */
    sendToServer: function(preferences) {
      fetch('/api/consent/cookies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(preferences)
      }).catch(function(error) {
        console.error('Failed to save cookie preferences:', error);
      });
    },

    /**
     * Show cookie banner
     */
    showBanner: function() {
      const banner = document.getElementById('ccp-banner');
      if (banner) {
        banner.style.display = 'block';
      }
    },

    /**
     * Hide cookie banner
     */
    hideBanner: function() {
      const banner = document.getElementById('ccp-banner');
      if (banner) {
        banner.style.display = 'none';
      }
    },

    /**
     * Check if consent is needed
     */
    needsConsent: function() {
      return !localStorage.getItem('cookie_consent');
    }
  };

  // Export to global scope
  window.CookieConsent = CookieConsent;

  // Auto-initialize if consent needed
  if (CookieConsent.needsConsent()) {
    CookieConsent.showBanner();
  }
})();
  `.trim();
}

/**
 * Validate cookie consent settings
 */
export function validateCookieConsent(preferences: CookiePreferences): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Essential cookies must always be enabled
  if (!preferences.essential) {
    errors.push('Essential cookies must be enabled');
  }

  // Updated timestamp must be present
  if (!preferences.updatedAt) {
    errors.push('Missing updatedAt timestamp');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create cookie consent response
 */
export function createCookieConsentResponse(preferences: CookiePreferences): {
  version: string;
  timestamp: number;
  preferences: CookiePreferences;
  hash: string;
} {
  const data = JSON.stringify(preferences);

  return {
    version: '1.0.0',
    timestamp: Date.now(),
    preferences,
    hash: generateHash(data),
  };
}

/**
 * Generate hash for verification
 */
function generateHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Cookie consent category utilities
 */
export const CookieCategoryUtils = {
  /**
   * Check if category requires opt-in consent
   */
  requiresOptIn: (category: CookieCategory): boolean => {
    const optInCategories = [
      'performance',
      'marketing',
      'targeting',
      'social_media',
    ];

    return optInCategories.includes(category);
  },

  /**
   * Check if category is essential
   */
  isEssential: (category: CookieCategory): boolean => {
    return category === 'strictly_necessary';
  },

  /**
   * Get consent scope for category
   */
  getScope: (category: CookieCategory): 'session' | 'persistent' => {
    const persistentCategories = [
      'functional',
      'performance',
      'targeting',
      'social_media',
    ];

    return persistentCategories.includes(category) ? 'persistent' : 'session';
  },

  /**
   * Get typical cookie names for category
   */
  getCookieNames: (category: CookieCategory): string[] => {
    const cookieMap: Record<string, string[]> = {
      strictly_necessary: ['session_id', 'csrf_token'],
      functional: ['user_preferences', 'language', 'theme'],
      performance: ['analytics_id', 'ga_tracking'],
      targeting: ['ad_personalization', 'remarketing'],
      social_media: ['fb_login', 'twitter_auth'],
    };

    return cookieMap[category] || [];
  },
};

/**
 * GDPR-compliant cookie consent initialization
 */
export function initCookieConsent(config: CookieBannerConfig): void {
  if (typeof window === 'undefined') {
    return; // Skip if not in browser
  }

  // Check if consent already exists
  const existingConsent = localStorage.getItem('cookie_consent');

  if (!existingConsent) {
    // Inject banner HTML
    const bannerHTML = generateCookieBannerHTML(config);
    const bannerContainer = document.createElement('div');
    bannerContainer.innerHTML = bannerHTML;
    document.body.appendChild(bannerContainer);

    // Inject JavaScript
    const scriptElement = document.createElement('script');
    scriptElement.textContent = generateCookieConsentJS();
    document.head.appendChild(scriptElement);
  } else {
    // Validate existing consent
    try {
      const preferences = JSON.parse(existingConsent) as CookiePreferences;
      const validation = validateCookieConsent(preferences);

      if (!validation.valid) {
        console.warn('Invalid cookie consent:', validation.errors);
        localStorage.removeItem('cookie_consent');
        initCookieConsent(config);
      }
    } catch (error) {
      console.error('Failed to parse cookie consent:', error);
      localStorage.removeItem('cookie_consent');
      initCookieConsent(config);
    }
  }
}
