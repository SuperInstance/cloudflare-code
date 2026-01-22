/**
 * RTL (Right-to-Left) language support for ClaudeFlare i18n
 */

import type { Locale, RTLConfig, RTLText } from '../types/index.js';

/**
 * RTL locales
 */
export const RTL_LOCALES: Locale[] = [
  'ar', // Arabic
  'he', // Hebrew
  'fa', // Persian
  'ur', // Urdu
  'yi', // Yiddish
  'ckb', // Central Kurdish
  'sd', // Sindhi
  'dv', // Divehi
];

/**
 * Check if locale is RTL
 */
export function isRTL(locale: Locale): boolean {
  const language = locale.split('-')[0];
  return RTL_LOCALES.includes(language);
}

/**
 * Get text direction
 */
export function getTextDirection(locale: Locale): 'ltr' | 'rtl' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

/**
 * Get RTL configuration for locale
 */
export function getRTLConfig(locale: Locale): RTLConfig {
  return {
    enabled: isRTL(locale),
    locale,
    layoutMirroring: isRTL(locale),
    mixedContent: true,
    alignment: isRTL(locale) ? 'right' : 'left',
  };
}

/**
 * Wrap text with RTL markup
 */
export function wrapRTLText(
  text: string,
  locale: Locale,
  override?: 'ltr' | 'rtl'
): RTLText {
  const direction = override || getTextDirection(locale);

  return {
    text,
    direction,
    locale,
  };
}

/**
 * Add RTL/LTR markers to HTML
 */
export function addDirectionMarkers(
  html: string,
  locale: Locale
): string {
  const direction = getTextDirection(locale);
  return `<div dir="${direction}">${html}</div>`;
}

/**
 * Mirror CSS properties for RTL
 */
export function mirrorCSS(css: string): string {
  const properties: Record<string, string> = {
    'margin-left': 'margin-right',
    'margin-right': 'margin-left',
    'padding-left': 'padding-right',
    'padding-right': 'padding-left',
    'border-left': 'border-right',
    'border-right': 'border-left',
    'border-top-left-radius': 'border-top-right-radius',
    'border-top-right-radius': 'border-top-left-radius',
    'border-bottom-left-radius': 'border-bottom-right-radius',
    'border-bottom-right-radius': 'border-bottom-left-radius',
    'left': 'right',
    'right': 'left',
    'text-align': 'text-align',
  };

  let mirrored = css;

  for (const [ltr, rtl] of Object.entries(properties)) {
    const regex = new RegExp(ltr, 'g');
    mirrored = mirrored.replace(regex, rtl);
  }

  return mirrored;
}

/**
 * Get mirrored flex direction
 */
export function mirrorFlexDirection(direction: string): string {
  const mirrorMap: Record<string, string> = {
    'row': 'row-reverse',
    'row-reverse': 'row',
    'column': 'column', // No change
    'column-reverse': 'column-reverse', // No change
  };

  return mirrorMap[direction] || direction;
}

/**
 * Format mixed LTR/RTL content
 */
export function formatMixedContent(
  text: string,
  defaultLocale: Locale
): string {
  // Detect LTR and RTL parts
  const hasRTL = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);
  const hasLTR = /[\u0000-\u005F\u007E-\u058F]/.test(text);

  if (!hasRTL && !hasLTR) {
    return text;
  }

  const defaultDir = getTextDirection(defaultLocale);

  // Add directional markers
  if (hasRTL && hasLTR) {
    // Mixed content - use isolation
    const parts: string[] = [];
    let currentPart = '';
    let currentDir: 'ltr' | 'rtl' | null = null;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const isRTLChar = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(char);
      const charDir = isRTLChar ? 'rtl' : 'ltr';

      if (currentDir === null) {
        currentDir = charDir;
        currentPart = char;
      } else if (charDir !== currentDir) {
        // Direction change
        parts.push(
          `<span dir="${currentDir}">${currentPart}</span>`
        );
        currentDir = charDir;
        currentPart = char;
      } else {
        currentPart += char;
      }
    }

    if (currentPart) {
      parts.push(`<span dir="${currentDir}">${currentPart}</span>`);
    }

    return parts.join('');
  }

  return text;
}

/**
 * Add bidi control characters
 */
export function addBidiControls(text: string, direction: 'ltr' | 'rtl'): string {
  const LRE = '\u202A'; // Left-to-Right Embedding
  const RLE = '\u202B'; // Right-to-Left Embedding
  const PDF = '\u202C'; // Pop Directional Format

  const control = direction === 'ltr' ? LRE : RLE;

  return `${control}${text}${PDF}`;
}

/**
 * Remove bidi control characters
 */
export function removeBidiControls(text: string): string {
  return text.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');
}

/**
 * Get text alignment for locale
 */
export function getTextAlignment(locale: Locale): 'left' | 'right' | 'start' | 'end' {
  return isRTL(locale) ? 'right' : 'left';
}

/**
 * Mirror layout coordinates
 */
export function mirrorCoordinates(
  x: number,
  width: number,
  containerWidth: number
): number {
  return containerWidth - width - x;
}

/**
 * Mirror icon for RTL
 */
export function mirrorIcon(icon: string, locale: Locale): string {
  if (!isRTL(locale)) return icon;

  // Flip horizontal arrows and directional icons
  const iconMap: Record<string, string> = {
    '→': '←',
    '←': '→',
    '▶': '◀',
    '◀': '▶',
    '⬇': '⬇', // Vertical arrows stay same
    '⬆': '⬆',
    '➡': '⬅',
    '⬅': '➡',
    '⏩': '⏪',
    '⏪': '⏩',
  };

  return iconMap[icon] || icon;
}

/**
 * Check if text contains RTL characters
 */
export function containsRTL(text: string): boolean {
  return /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);
}

/**
 * Check if text contains LTR characters
 */
export function containsLTR(text: string): boolean {
  return /[\u0000-\u005F\u007E-\u058F]/.test(text);
}

/**
 * Detect text direction from content
 */
export function detectTextDirection(text: string): 'ltr' | 'rtl' | 'mixed' {
  const hasRTL = containsRTL(text);
  const hasLTR = containsLTR(text);

  if (hasRTL && hasLTR) return 'mixed';
  if (hasRTL) return 'rtl';
  return 'ltr';
}

/**
 * Format URL for RTL context
 */
export function formatURLForRTL(url: string): string {
  // URLs should always be LTR even in RTL context
  return `<span dir="ltr">${url}</span>`;
}

/**
 * Format phone number for RTL context
 */
export function formatPhoneForRTL(phone: string): string {
  // Phone numbers should always be LTR
  return `<span dir="ltr">${phone}</span>`;
}

/**
 * Get RTL-aware CSS class
 */
export function getRTLCSSClass(
  baseClass: string,
  locale: Locale,
  suffix = ''
): string {
  if (!isRTL(locale)) {
    return baseClass;
  }

  return `${baseClass}${suffix || '-rtl'}`;
}

/**
 * Transform CSS logical properties
 */
export function transformLogicalProperties(css: string): string {
  // Replace logical properties with physical ones for RTL
  const logicalToPhysical: Record<string, string> = {
    'margin-inline-start': isRTLContext() ? 'margin-right' : 'margin-left',
    'margin-inline-end': isRTLContext() ? 'margin-left' : 'margin-right',
    'padding-inline-start': isRTLContext() ? 'padding-right' : 'padding-left',
    'padding-inline-end': isRTLContext() ? 'padding-left' : 'padding-right',
    'border-inline-start': isRTLContext() ? 'border-right' : 'border-left',
    'border-inline-end': isRTLContext() ? 'border-left' : 'border-right',
  };

  let transformed = css;

  for (const [logical, physical] of Object.entries(logicalToPhysical)) {
    const regex = new RegExp(logical, 'g');
    transformed = transformed.replace(regex, physical);
  }

  return transformed;
}

/**
 * Check if current context is RTL (helper function)
 */
function isRTLContext(): boolean {
  // This would typically check a global state or context
  // For now, return false as default
  return false;
}

/**
 * Get mirrored flex/grid alignment
 */
export function mirrorAlignment(align: string): string {
  const mirrorMap: Record<string, string> = {
    'flex-start': 'flex-end',
    'flex-end': 'flex-start',
    'start': 'end',
    'end': 'start',
    'left': 'right',
    'right': 'left',
  };

  return mirrorMap[align] || align;
}

/**
 * Format list for RTL
 */
export function formatListRTL(items: string[], locale: Locale): string {
  if (!isRTL(locale)) {
    return items.join(', ');
  }

  // Reverse list for RTL display
  return items.slice().reverse().join(' ‏ ');
}

/**
 * Get locale-specific numeral system
 */
export function getNumeralSystem(locale: Locale): 'arabic' | 'persian' | 'hindi' | 'western' {
  const numeralSystems: Record<string, 'arabic' | 'persian' | 'hindi' | 'western'> = {
    'ar': 'arabic',
    'fa': 'persian',
    'hi': 'hindi',
  };

  return numeralSystems[locale.split('-')[0]] || 'western';
}

/**
 * Convert numerals to locale-specific script
 */
export function convertNumerals(
  number: string | number,
  locale: Locale
): string {
  const system = getNumeralSystem(locale);

  const numeralMaps: Record<string, Record<string, string>> = {
    arabic: {
      '0': '٠',
      '1': '١',
      '2': '٢',
      '3': '٣',
      '4': '٤',
      '5': '٥',
      '6': '٦',
      '7': '٧',
      '8': '٨',
      '9': '٩',
    },
    persian: {
      '0': '۰',
      '1': '۱',
      '2': '۲',
      '3': '۳',
      '4': '۴',
      '5': '۵',
      '6': '۶',
      '7': '۷',
      '8': '۸',
      '9': '۹',
    },
    hindi: {
      '0': '०',
      '1': '१',
      '2': '२',
      '3': '३',
      '4': '४',
      '5': '५',
      '6': '६',
      '7': '७',
      '8': '८',
      '9': '९',
    },
  };

  const map = numeralMaps[system];
  if (!map) return String(number);

  return String(number).replace(/\d/g, (digit) => map[digit] || digit);
}

/**
 * Create RTL-aware component wrapper
 */
export function createRTLWrapper(
  children: string,
  locale: Locale,
  className?: string
): string {
  const direction = getTextDirection(locale);
  const classes = className ? `${className} ${className}-${direction}` : direction;

  return `<div class="${classes}" dir="${direction}">${children}</div>`;
}

/**
 * Get RTL-specific styling rules
 */
export function getRTLStyles(locale: Locale): Record<string, string> {
  if (!isRTL(locale)) {
    return {};
  }

  return {
    'direction': 'rtl',
    'text-align': 'right',
  };
}

/**
 * Mirror transform origin
 */
export function mirrorTransformOrigin(origin: string): string {
  const mirrorMap: Record<string, string> = {
    'top left': 'top right',
    'top right': 'top left',
    'bottom left': 'bottom right',
    'bottom right': 'bottom left',
    'center left': 'center right',
    'center right': 'center left',
  };

  return mirrorMap[origin] || origin;
}
