# @claudeflare/i18n

Comprehensive internationalization (i18n) platform for ClaudeFlare with support for 20+ languages, translation memory, RTL layout support, and locale-specific formatting.

## Features

### Multi-Language Support
- **20+ Languages**: English, Spanish, French, German, Portuguese, Italian, Dutch, Chinese (Simplified/Traditional), Japanese, Korean, Vietnamese, Thai, Indonesian, Arabic, Hebrew, Persian, Turkish, Russian, Polish, Czech, Swedish, Ukrainian
- **ICU Message Format**: Full support for complex pluralization, gender, select statements
- **Pluralization Rules**: CLDR-compliant pluralization for all languages
- **Locale Detection**: Automatic detection from HTTP headers, cookies, query parameters

### Translation Management
- **Translation Memory**: Vector similarity search for fuzzy matching
- **KV Storage**: Cloudflare Workers KV-based translation storage
- **TMX Import/Export**: Industry-standard TMX format support
- **Batch Operations**: Efficient batch translation and import/export

### Locale-Specific Formatting
- **Numbers**: Locale-specific number, currency, and percentage formatting
- **Dates**: Full date/time formatting with relative time support
- **Addresses**: Country-specific address formatting and validation
- **Names**: Culture-aware name ordering and formatting

### RTL Language Support
- **Arabic, Hebrew, Persian**: Full RTL layout support
- **Automatic Mirroring**: CSS and layout mirroring for RTL languages
- **Mixed Content**: Proper handling of LTR/RTL mixed text
- **Bidirectional Text**: Bidi control characters and isolation

## Installation

```bash
npm install @claudeflare/i18n
```

## Quick Start

```typescript
import { createI18n, t } from '@claudeflare/i18n';

// Initialize i18n
const i18n = await createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  storage: {
    binding: env.TRANSLATIONS,
    prefix: 'i18n',
  },
  namespaces: ['common', 'errors'],
});

// Translate a key
const message = await t('welcome', { name: 'World' });
// → "Welcome, World!"
```

## Core Features

### Translation Engine

```typescript
import { Translator } from '@claudeflare/i18n';

const translator = new Translator({
  locale: 'en',
  fallbackLocale: 'en',
  storage: kvStorage,
});

// Simple translation
const result = await translator.translate('hello');
// → { translated: "Hello", locale: "en", usedFallback: false }

// ICU pluralization
const plural = await translator.translate('items', { count: 5 });
// → "5 items"

// Batch translation
const results = await translator.translateBatch(['hello', 'goodbye']);
```

### Locale Detection

```typescript
import { detectLocale, negotiateLocale } from '@claudeflare/i18n';

// Detect from HTTP request
const result = detectLocale(request, {
  fallbackLocale: 'en',
  supportedLocales: ['en', 'es', 'fr'],
});
// → { locale: "es", quality: 1.0, source: "header" }

// Negotiate best match
const match = negotiateLocale(
  ['en-US', 'es', 'fr'],
  ['en', 'es-MX', 'fr'],
  'en'
);
// → { locale: "en", matched: true, fallbackChain: [], reason: "..." }
```

### Number Formatting

```typescript
import { formatNumber, formatCurrency } from '@claudeflare/i18n';

// Decimal numbers
formatNumber(1234.56, 'en-US');
// → "1,234.56"

formatNumber(1234.56, 'de-DE');
// → "1.234,56"

// Currency
formatCurrency(99.99, 'en-US', 'USD');
// → "$99.99"

formatCurrency(99.99, 'ja-JP', 'JPY');
// → "￥100" (Japanese yen doesn't show decimals)
```

### Date/Time Formatting

```typescript
import { formatDate, timeAgo } from '@claudeflare/i18n';

// Format date
formatDate(new Date(), 'en-US', { format: 'long' });
// → "January 15, 2024"

formatDate(new Date(), 'ja-JP', { format: 'long' });
// → "2024年1月15日"

// Relative time
timeAgo(new Date(Date.now() - 3600000), 'en-US');
// → "1 hour ago"
```

### RTL Support

```typescript
import { isRTL, getTextDirection, mirrorCSS } from '@claudeflare/i18n';

// Check if locale is RTL
isRTL('ar'); // → true
isRTL('en'); // → false

// Get text direction
getTextDirection('he'); // → "rtl"

// Mirror CSS for RTL
mirrorCSS('margin-left: 10px;'); // → "margin-right: 10px;"
```

### Translation Memory

```typescript
import { TranslationMemory } from '@claudeflare/i18n';

const tm = new TranslationMemory({
  storage: env.TRANSLATION_MEMORY,
  minSimilarity: 0.8,
});

// Add translation
await tm.add({
  sourceText: 'Hello World',
  targetText: 'Hola Mundo',
  sourceLocale: 'en',
  targetLocale: 'es',
  quality: 1.0,
});

// Find exact match
const match = await tm.findExact('Hello World', 'en', 'es');

// Find fuzzy matches
const fuzzy = await tm.findFuzzy('Hello World', 'en', 'es', 5);
```

### KV Storage

```typescript
import { KVTranslationStorage } from '@claudeflare/i18n';

const storage = new KVTranslationStorage({
  binding: env.TRANSLATIONS,
  prefix: 'i18n',
  ttl: 3600,
});

// Get namespace
const ns = await storage.get('en', 'common');

// Set translation
await storage.setEntry('en', 'common', 'hello', {
  key: 'hello',
  value: 'Hello, World!',
});

// Export translations
const data = await storage.exportLocale('en');
```

### ICU Message Format

```typescript
// Pluralization
const message = '{count, plural, =0 {No items} =1 {One item} other {# items}}';
// count = 0 → "No items"
// count = 1 → "One item"
// count = 5 → "5 items"

// Select
const select = '{gender, select, male {He} female {She} other {They}}';
// gender = "male" → "He"

// Select Ordinal
const ordinal = '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
// n = 1 → "1st"
// n = 2 → "2nd"
// n = 3 → "3rd"
// n = 4 → "4th"

// Date/Time/Number formatting
const date = 'Created on {date, date, long}';
// → "Created on January 15, 2024"

const number = 'Price: {price, number, currency}';
// → "Price: $99.99"
```

### TMX Import/Export

```typescript
import { TMXExporter, TMXImporter } from '@claudeflare/i18n';

// Export to TMX
const tmx = TMXExporter.exportToTMX(namespaces, 'en');
const xml = TMXExporter.toXML(tmx);

// Import from TMX
const document = TMXImporter.parseXML(xml);
const namespace = TMXImporter.importFromTMX(document, 'es', 'common');
```

## API Routes

The package includes pre-built API routes for translation management:

```typescript
import { createAPIRoutes } from '@claudeflare/i18n';

const routes = createAPIRoutes({
  translator,
  storage,
  memory,
  env,
});

// Available routes:
// POST   /api/i18n/translate
// POST   /api/i18n/translate/batch
// GET    /api/i18n/namespace/:locale/:namespace
// PUT    /api/i18n/namespace/:locale/:namespace
// GET    /api/i18n/entry/:locale/:namespace/:key
// PUT    /api/i18n/entry/:locale/:namespace/:key
// DELETE /api/i18n/entry/:locale/:namespace/:key
// GET    /api/i18n/locale
// POST   /api/i18n/negotiate
// GET    /api/i18n/statistics/:locale
// GET    /api/i18n/export/:locale
// POST   /api/i18n/import/:locale
// POST   /api/i18n/validate
// POST   /api/i18n/memory/search
// POST   /api/i18n/memory/add
// POST   /api/i18n/formats/number
// POST   /api/i18n/formats/date
// POST   /api/i18n/cache/clear
// GET    /api/i18n/health
```

## Cloudflare Workers Integration

```typescript
import { createI18n } from '@claudeflare/i18n';

export interface Env {
  TRANSLATIONS: KVNamespace;
  TRANSLATION_MEMORY: KVNamespace;
}

let i18nInstance: Awaited<ReturnType<typeof createI18n>>;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Initialize i18n on first request
    if (!i18nInstance) {
      i18nInstance = await createI18n({
        locale: 'en',
        fallbackLocale: 'en',
        storage: { binding: env.TRANSLATIONS },
        memory: { storage: env.TRANSLATION_MEMORY },
      });
    }

    const { translator } = i18nInstance;

    // Detect locale from request
    const { detectLocale } = await import('@claudeflare/i18n');
    const detected = detectLocale(request, {
      fallbackLocale: 'en',
      supportedLocales: ['en', 'es', 'fr'],
    });

    await translator.setLocale(detected.locale);

    // Translate content
    const message = await translator.translate('welcome', {
      name: 'World',
    });

    return new Response(message);
  },
};
```

## Pluralization Rules

The package includes CLDR-compliant pluralization for all supported languages:

| Language | Categories | Example |
|----------|-----------|---------|
| English | one, other | 1 item, 2 items |
| Arabic | zero, one, two, few, many, other | 0, 1, 2, 3-10, 11-99, 100+ |
| Russian | one, few, many, other | 1, 2-4, 5-20, 21-24 |
| Japanese | other | (no pluralization) |
| Polish | one, few, many, other | 1, 2-4, 5-21, 22-24 |

## RTL Languages

Full support for RTL (Right-to-Left) languages:

- **Arabic** (ar): السعودية, مصر, المغرب
- **Hebrew** (he): ישראל
- **Persian** (fa): ایران
- **Urdu** (ur): پاکستان
- **Yiddish** (yi): ייִדיש

Features include:
- Automatic text direction detection
- CSS property mirroring
- Mixed LTR/RTL content handling
- Bidi control characters

## Performance

- **KV Caching**: In-memory cache with configurable TTL
- **Batch Operations**: Efficient batch translation and memory search
- **Translation Memory**: Vector similarity for fast fuzzy matching
- **Lazy Loading**: Namespaces loaded on demand

## Best Practices

1. **Use ICU Message Format**: Leverage ICU for complex messages
2. **Set Up Fallbacks**: Always configure fallback locales
3. **Enable Translation Memory**: Reuse translations with fuzzy matching
4. **Prefetch Namespaces**: Load commonly used namespaces upfront
5. **Cache Results**: Enable caching for better performance

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## Support

For issues and questions, please use the issue tracker.
