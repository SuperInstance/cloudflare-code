/**
 * Address formatting for different locales
 */

// @ts-nocheck - Type incompatibilities with AddressFormatOptions

import type { AddressFormatOptions, Locale } from '../types/index.js';

/**
 * Address field definition
 */
export interface Address {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  poBox?: string;
  region?: string;
  district?: string;
}

/**
 * Format address according to locale conventions
 */
export function formatAddress(
  address: Address,
  locale: Locale,
  options: AddressFormatOptions = {
    format: 'international',
    fields: getRequiredFields(locale),
  }
): string {
  const { format = 'international' } = options;

  const formatTemplate = getAddressTemplate(locale, format);
  const components = getAddressComponents(address, locale);

  return formatTemplate
    .split('\n')
    .map((line) => {
      let formattedLine = line;
      for (const [key, value] of Object.entries(components)) {
        formattedLine = formattedLine.replace(`{${key}}`, value || '');
      }
      return formattedLine.trim();
    })
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Get address template for locale
 */
function getAddressTemplate(
  locale: Locale,
  format: 'domestic' | 'international'
): string {
  const language = locale.split('-')[0];

  const templates: Record<string, { domestic: string; international: string }> =
    {
      en: {
        domestic: '{recipient}\n{street}\n{street2}\n{city}, {state} {postalCode}\n{country}',
        international: '{recipient}\n{street}\n{street2}\n{city}, {state} {postalCode}\n{country}',
      },
      ja: {
        domestic: '{postalCode}\n{region}{city}\n{street}\n{street2}\n{recipient}',
        international: '{recipient}\n{street}\n{street2}\n{city}, {region}\n{postalCode}\n{country}',
      },
      zh: {
        domestic: '{country}\n{region}{city}\n{street}\n{recipient}\n{postalCode}',
        international: '{recipient}\n{street}\n{city}, {region}\n{postalCode}\n{country}',
      },
      ko: {
        domestic: '{recipient}\n{city}\n{street}\n{street2}\n{state}, {postalCode}\n{country}',
        international: '{recipient}\n{street}\n{street2}\n{city}, {state} {postalCode}\n{country}',
      },
      fr: {
        domestic: '{recipient}\n{street}\n{street2}\n{postalCode} {city}\n{country}',
        international: '{recipient}\n{street}\n{street2}\n{postalCode} {city}\n{country}',
      },
      de: {
        domestic: '{recipient}\n{street}\n{street2}\n{postalCode} {city}\n{country}',
        international: '{recipient}\n{street}\n{street2}\n{postalCode} {city}\n{country}',
      },
      es: {
        domestic: '{recipient}\n{street}\n{street2}\n{postalCode} {city}\n{state}\n{country}',
        international: '{recipient}\n{street}\n{street2}\n{postalCode} {city}\n{state}\n{country}',
      },
      ar: {
        domestic: '{recipient}\n{street}\n{city}\n{postalCode}\n{country}',
        international: '{recipient}\n{street}\n{city}\n{postalCode}\n{country}',
      },
      ru: {
        domestic: '{recipient}\n{street}\n{street2}\n{city}\n{state}\n{postalCode}\n{country}',
        international: '{recipient}\n{street}\n{street2}\n{city}, {state}\n{postalCode}\n{country}',
      },
    };

  return templates[language]?.[format] || templates.en.international;
}

/**
 * Get address components with proper formatting
 */
function getAddressComponents(
  address: Address,
  locale: Locale
): Record<string, string> {
  const components: Record<string, string> = {
    street: address.street || '',
    street2: address.street2 || '',
    city: address.city || '',
    state: address.state || address.region || '',
    postalCode: formatPostalCode(address.postalCode || '', locale),
    country: formatCountryName(address.country || '', locale),
    poBox: address.poBox || '',
    recipient: '',
    region: address.region || address.state || '',
    district: address.district || '',
  };

  return components;
}

/**
 * Format postal code for locale
 */
function formatPostalCode(postalCode: string, locale: Locale): string {
  const language = locale.split('-')[0];

  // Add spacing or formatting based on locale
  if (language === 'en' && postalCode.length === 6) {
    // Canadian postal code
    return `${postalCode.slice(0, 3)} ${postalCode.slice(3)}`;
  }

  if (language === 'ru' && postalCode.length === 6) {
    // Russian postal code
    return `${postalCode.slice(0, 3)} ${postalCode.slice(3)}`;
  }

  if (language === 'pl' && postalCode.length === 6) {
    // Polish postal code
    return `${postalCode.slice(0, 2)}-${postalCode.slice(2)}`;
  }

  if (language === 'nl' && postalCode.length === 6) {
    // Dutch postal code
    return `${postalCode.slice(0, 4)} ${postalCode.slice(4)}`.toUpperCase();
  }

  return postalCode;
}

/**
 * Format country name
 */
function formatCountryName(country: string, locale: Locale): string {
  if (!country) return '';

  try {
    const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
    return regionNames.of(country) || country;
  } catch {
    return country;
  }
}

/**
 * Get required address fields for locale
 */
export function getRequiredFields(locale: Locale): Array<{
  name: string;
  label: string;
  required: boolean;
  order: number;
}> {
  const language = locale.split('-')[0];

  const fieldConfigs: Record<
    string,
    Array<{ name: string; label: string; required: boolean; order: number }>
  > = {
    en: [
      { name: 'street', label: 'Street Address', required: true, order: 1 },
      { name: 'street2', label: 'Apt/Suite', required: false, order: 2 },
      { name: 'city', label: 'City', required: true, order: 3 },
      { name: 'state', label: 'State', required: true, order: 4 },
      { name: 'postalCode', label: 'ZIP Code', required: true, order: 5 },
      { name: 'country', label: 'Country', required: true, order: 6 },
    ],
    ja: [
      { name: 'postalCode', label: '郵便番号', required: true, order: 1 },
      { name: 'region', label: '都道府県', required: true, order: 2 },
      { name: 'city', label: '市区町村', required: true, order: 3 },
      { name: 'street', label: '番地', required: true, order: 4 },
      { name: 'street2', label: '建物名', required: false, order: 5 },
    ],
    zh: [
      { name: 'region', label: '省/市', required: true, order: 1 },
      { name: 'city', label: '市', required: true, order: 2 },
      { name: 'street', label: '街道', required: true, order: 3 },
      { name: 'postalCode', label: '邮政编码', required: true, order: 4 },
    ],
    ar: [
      { name: 'street', label: 'الشارع', required: true, order: 1 },
      { name: 'city', label: 'المدينة', required: true, order: 2 },
      { name: 'postalCode', label: 'الرمز البريدي', required: true, order: 3 },
      { name: 'country', label: 'البلد', required: true, order: 4 },
    ],
  };

  return fieldConfigs[language] || fieldConfigs.en;
}

/**
 * Validate address for locale
 */
export function validateAddress(
  address: Address,
  locale: Locale
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const requiredFields = getRequiredFields(locale).filter((f) => f.required);

  for (const field of requiredFields) {
    const value = address[field.name as keyof Address];
    if (!value || value.trim().length === 0) {
      errors.push(`${field.label} is required`);
    }
  }

  // Locale-specific validation
  const language = locale.split('-')[0];

  if (language === 'en' || language === 'de') {
    // Validate postal code format
    if (address.postalCode) {
      const postalCode = address.postalCode.trim();
      if (language === 'en') {
        // US ZIP code
        if (!/^\d{5}(-\d{4})?$/.test(postalCode)) {
          errors.push('Invalid ZIP code format');
        }
      } else if (language === 'de') {
        // German postal code
        if (!/^\d{5}$/.test(postalCode)) {
          errors.push('Invalid postal code format');
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get address field labels
 */
export function getAddressFieldLabels(locale: Locale): Record<
  'street' | 'street2' | 'city' | 'state' | 'postalCode' | 'country',
  string
> {
  const labels: Record<string, Record<string, string>> = {
    en: {
      street: 'Street Address',
      street2: 'Apt/Suite',
      city: 'City',
      state: 'State',
      postalCode: 'ZIP Code',
      country: 'Country',
    },
    es: {
      street: 'Calle',
      street2: 'Apartamento',
      city: 'Ciudad',
      state: 'Estado/Provincia',
      postalCode: 'Código Postal',
      country: 'País',
    },
    fr: {
      street: 'Rue',
      street2: 'Appartement',
      city: 'Ville',
      state: 'Région',
      postalCode: 'Code Postal',
      country: 'Pays',
    },
    de: {
      street: 'Straße',
      street2: 'Adresszusatz',
      city: 'Stadt',
      state: 'Bundesland',
      postalCode: 'Postleitzahl',
      country: 'Land',
    },
    ja: {
      street: '番地',
      street2: '建物名',
      city: '市区町村',
      state: '都道府県',
      postalCode: '郵便番号',
      country: '国',
    },
    zh: {
      street: '街道',
      street2: '建筑',
      city: '市',
      state: '省',
      postalCode: '邮政编码',
      country: '国家',
    },
    ar: {
      street: 'الشارع',
      street2: 'الطابق',
      city: 'المدينة',
      state: 'المنطقة',
      postalCode: 'الرمز البريدي',
      country: 'البلد',
    },
  };

  const language = locale.split('-')[0];
  return labels[language] || labels.en;
}

/**
 * Parse address string into components
 */
export function parseAddress(
  addressString: string,
  locale: Locale
): Address {
  const address: Address = {};

  if (!addressString) return address;

  const lines = addressString.split('\n').map((l) => l.trim());

  // Simple parsing - can be enhanced with locale-specific patterns
  if (lines.length >= 1) {
    address.street = lines[0];
  }
  if (lines.length >= 2) {
    address.street2 = lines[1];
  }

  // Try to parse city, state, postal code from last line
  if (lines.length >= 3) {
    const lastLine = lines[lines.length - 1];
    const match = lastLine.match(
      /([^,]+),?\s*([A-Z]{2})?\s*(\d{5}(-\d{4})?)?/
    );
    if (match) {
      address.city = match[1].trim();
      if (match[2]) address.state = match[2];
      if (match[3]) address.postalCode = match[3];
    }
  }

  return address;
}
