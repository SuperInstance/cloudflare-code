/**
 * Basic usage examples for ClaudeFlare i18n
 */

import { createI18n, t } from '@claudeflare/i18n';

// Initialize i18n system
async function basicExample() {
  const i18n = await createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    storage: {
      binding: {} as KVNamespace, // Your KV binding
      prefix: 'i18n',
    },
    namespaces: ['common', 'errors'],
  });

  // Translate a simple key
  const message = await t('hello');
  console.log(message); // → "Hello"

  // Translate with parameters
  const welcome = await t('welcome', { name: 'Alice' });
  console.log(welcome); // → "Welcome, Alice!"

  // Translate with ICU pluralization
  const items1 = await t('items', { count: 1 });
  console.log(items1); // → "One item"

  const items5 = await t('items', { count: 5 });
  console.log(items5); // → "5 items"

  // Use translator directly
  const { translator } = i18n;
  const result = await translator.translate('goodbye');
  console.log(result.translated); // → "Goodbye"
  console.log(result.locale); // → "en"
  console.log(result.usedFallback); // → false
}

// Locale detection
async function localeDetectionExample(request: Request) {
  const { detectLocale } = await import('@claudeflare/i18n');

  const result = detectLocale(request, {
    fallbackLocale: 'en',
    supportedLocales: ['en', 'es', 'fr', 'de'],
  });

  console.log(`Detected locale: ${result.locale}`);
  console.log(`Quality: ${result.quality}`);
  console.log(`Source: ${result.source}`);
}

// Locale negotiation
async function localeNegotiationExample() {
  const { negotiateLocale } = await import('@claudeflare/i18n');

  const result = negotiateLocale(
    ['en-US', 'es', 'fr'],
    ['en', 'es-MX', 'fr-CA'],
    'en'
  );

  console.log(`Best match: ${result.locale}`);
  console.log(`Matched: ${result.matched}`);
  console.log(`Reason: ${result.reason}`);
}

// Number formatting
async function numberFormattingExample() {
  const { formatNumber, formatCurrency } = await import('@claudeflare/i18n');

  // Format number
  const usNumber = formatNumber(1234.56, 'en-US');
  console.log(usNumber); // → "1,234.56"

  const germanNumber = formatNumber(1234.56, 'de-DE');
  console.log(germanNumber); // → "1.234,56"

  // Format currency
  const usPrice = formatCurrency(99.99, 'en-US', 'USD');
  console.log(usPrice); // → "$99.99"

  const japanesePrice = formatCurrency(1000, 'ja-JP', 'JPY');
  console.log(japanesePrice); // → "￥1,000"

  // Format percentage
  const { formatPercent } = await import('@claudeflare/i18n');
  const percentage = formatPercent(0.75, 'en-US');
  console.log(percentage); // → "75%"
}

// Date/time formatting
async function dateTimeFormattingExample() {
  const { formatDate, formatTime, timeAgo } = await import('@claudeflare/i18n');

  const date = new Date('2024-01-15T14:30:00Z');

  // Format date
  const usDate = formatDate(date, 'en-US', { format: 'long' });
  console.log(usDate); // → "January 15, 2024"

  const japaneseDate = formatDate(date, 'ja-JP', { format: 'long' });
  console.log(japaneseDate); // → "2024年1月15日"

  // Format time
  const usTime = formatTime(date, 'en-US');
  console.log(usTime); // → "2:30 PM"

  // Relative time
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const relative = timeAgo(oneHourAgo, 'en-US');
  console.log(relative); // → "1 hour ago"
}

// Address formatting
async function addressFormattingExample() {
  const { formatAddress } = await import('@claudeflare/i18n');

  const address = {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
  };

  // Format US address
  const usAddress = formatAddress(address, 'en-US');
  console.log(usAddress);
  // → "123 Main St\nNew York, NY 10001\nUS"

  // Format international address
  const internationalAddress = formatAddress(address, 'de-DE');
  console.log(internationalAddress);
}

// Name formatting
async function nameFormattingExample() {
  const { formatName, parseName } = await import('@claudeflare/i18n');

  // Format name in Western order
  const westernName = formatName(
    {
      givenName: 'John',
      familyName: 'Doe',
    },
    'en-US',
    { order: 'western' }
  );
  console.log(westernName); // → "John Doe"

  // Format name in Eastern order
  const easternName = formatName(
    {
      givenName: '太郎',
      familyName: '山田',
    },
    'ja-JP',
    { order: 'eastern' }
  );
  console.log(easternName); // → "山田 太郎"

  // Parse full name
  const parsed = parseName('John Doe', 'en-US');
  console.log(parsed);
  // → { givenName: 'John', familyName: 'Doe' }
}

// RTL support
async function rtlExample() {
  const { isRTL, getTextDirection, mirrorCSS } = await import('@claudeflare/i18n');

  // Check if locale is RTL
  console.log(isRTL('ar')); // → true
  console.log(isRTL('en')); // → false

  // Get text direction
  console.log(getTextDirection('he')); // → "rtl"
  console.log(getTextDirection('es')); // → "ltr"

  // Mirror CSS for RTL
  const css = 'margin-left: 10px; padding-right: 5px;';
  const mirrored = mirrorCSS(css);
  console.log(mirrored); // → "margin-right: 10px; padding-left: 5px;"
}

// Translation memory
async function translationMemoryExample() {
  const { TranslationMemory } = await import('@claudeflare/i18n');

  const tm = new TranslationMemory({
    storage: {} as KVNamespace,
    minSimilarity: 0.8,
  });

  // Add translation
  const id = await tm.add({
    sourceText: 'Hello World',
    targetText: 'Hola Mundo',
    sourceLocale: 'en',
    targetLocale: 'es',
    quality: 1.0,
  });

  // Find exact match
  const exact = await tm.findExact('Hello World', 'en', 'es');
  console.log(exact?.targetText); // → "Hola Mundo"

  // Find fuzzy matches
  const fuzzy = await tm.findFuzzy('Hello World', 'en', 'es', 5);
  console.log(fuzzy); // → Array of matches with similarity scores

  // Get statistics
  const stats = await tm.getStats();
  console.log(stats);
  // → { totalEntries: 1, totalUsage: 0, localePairs: Set(1), ... }
}

// KV storage
async function kvStorageExample() {
  const { KVTranslationStorage } = await import('@claudeflare/i18n');

  const storage = new KVTranslationStorage({
    binding: {} as KVNamespace,
    prefix: 'i18n',
    ttl: 3600,
  });

  // Set translation
  await storage.set({
    locale: 'en',
    namespace: 'common',
    translations: {
      hello: {
        key: 'hello',
        value: 'Hello, World!',
      },
    },
    metadata: {
      version: '1.0.0',
      totalKeys: 1,
    },
  });

  // Get namespace
  const ns = await storage.get('en', 'common');
  console.log(ns?.translations.hello.value); // → "Hello, World!"

  // Export locale
  const exported = await storage.exportLocale('en');
  console.log(Object.keys(exported)); // → ['common']

  // Import translations
  const imported = await storage.importLocale('es', {
    common: {
      locale: 'es',
      namespace: 'common',
      translations: {
        hello: {
          key: 'hello',
          value: '¡Hola, Mundo!',
        },
      },
      metadata: {
        version: '1.0.0',
        totalKeys: 1,
      },
    },
  });
  console.log(imported); // → 1
}

// TMX export/import
async function tmxExample() {
  const { TMXExporter, TMXImporter } = await import('@claudeflare/i18n');

  // Export to TMX
  const namespaces = [
    {
      locale: 'es',
      namespace: 'common',
      translations: {
        hello: {
          key: 'hello',
          value: '¡Hola!',
        },
      },
      metadata: {
        version: '1.0.0',
        totalKeys: 1,
      },
    },
  ];

  const tmx = TMXExporter.exportToTMX(namespaces, 'en');
  const xml = TMXExporter.toXML(tmx);
  console.log(xml); // → TMX XML string

  // Import from TMX
  const document = TMXImporter.parseXML(xml);
  const imported = TMXImporter.importFromTMX(document, 'fr', 'common');
  console.log(imported.translations);
}

// ICU message parsing
async function icuExample() {
  const { icuParser } = await import('@claudeflare/i18n');

  // Parse ICU message
  const message = '{count, plural, =0 {No items} =1 {One item} other {# items}}';
  const parsed = icuParser.parse(message);
  console.log(parsed); // → Parsed AST

  // Format with values
  const formatted = icuParser.format(parsed, { count: 5 }, 'en');
  console.log(formatted); // → "5 items"

  // Validate ICU syntax
  const validation = icuParser.validate(message);
  console.log(validation); // → { valid: true }
}

// Cloudflare Workers integration
export default {
  async fetch(request: Request, env: { TRANSLATIONS: KVNamespace }): Promise<Response> {
    // Initialize i18n
    const i18n = await createI18n({
      locale: 'en',
      fallbackLocale: 'en',
      storage: {
        binding: env.TRANSLATIONS,
      },
    });

    // Detect locale
    const { detectLocale } = await import('@claudeflare/i18n');
    const detected = detectLocale(request, {
      fallbackLocale: 'en',
      supportedLocales: ['en', 'es', 'fr'],
    });

    // Set locale
    await i18n.translator.setLocale(detected.locale);

    // Translate
    const message = await t('hello');

    // Format response
    const { formatNumber } = await import('@claudeflare/i18n');
    const number = formatNumber(1234.56, detected.locale);

    return new Response(JSON.stringify({
      locale: detected.locale,
      message,
      number,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Language': detected.locale,
      },
    });
  },
};
