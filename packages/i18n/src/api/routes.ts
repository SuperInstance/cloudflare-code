/**
 * Translation API routes for ClaudeFlare i18n
 * Provides REST API for translation management
 */

import type { Context } from 'hono';
import type {
  Locale,
  TranslationNamespace,
  TranslationEntry,
  TranslationFormat,
  TranslationImportOptions,
  TranslationExportOptions,
  TranslationStatistics,
} from '../types/index.js';
import { Translator } from '../core/translator.js';
import { detectLocale, negotiateLocale } from '../core/locale.js';
import { KVTranslationStorage } from '../storage/kv.js';
import { TranslationMemory } from '../memory/tm.js';
import { icuParser } from '../core/icu-parser.js';

/**
 * API request context
 */
interface APIContext {
  translator: Translator;
  storage: KVTranslationStorage;
  memory?: TranslationMemory;
  env: {
    TRANSLATIONS: KVNamespace;
    TM?: KVNamespace;
  };
}

/**
 * Translation API handler
 */
export class TranslationAPI {
  private context: APIContext;

  constructor(context: APIContext) {
    this.context = context;
  }

  /**
   * GET /api/i18n/translate
   * Translate a key
   */
  async translate(c: Context): Promise<Response> {
    const { key, namespace = 'common', locale } = await c.req.json();

    if (!key) {
      return c.json({ error: 'Key is required' }, 400);
    }

    try {
      const targetLocale = locale || this.context.translator.getLocale();
      const result = await this.context.translator.translate(key, {}, namespace);

      return c.json({
        key,
        translation: result.translated,
        locale: result.locale,
        namespace,
        usedFallback: result.usedFallback,
      });
    } catch (error) {
      return c.json({ error: 'Translation failed' }, 500);
    }
  }

  /**
   * POST /api/i18n/translate/batch
   * Batch translate multiple keys
   */
  async translateBatch(c: Context): Promise<Response> {
    const { keys, namespace = 'common', locale } = await c.req.json();

    if (!Array.isArray(keys)) {
      return c.json({ error: 'Keys must be an array' }, 400);
    }

    try {
      const targetLocale = locale || this.context.translator.getLocale();
      const results = await this.context.translator.translateBatch(
        keys,
        {},
        namespace
      );

      const response = Array.from(results.entries()).map(([key, result]) => ({
        key,
        translation: result.translated,
        locale: result.locale,
        namespace,
        usedFallback: result.usedFallback,
      }));

      return c.json({ results: response });
    } catch (error) {
      return c.json({ error: 'Batch translation failed' }, 500);
    }
  }

  /**
   * GET /api/i18n/namespace/:locale/:namespace
   * Get translation namespace
   */
  async getNamespace(c: Context): Promise<Response> {
    const { locale, namespace } = c.req.param();

    if (!locale || !namespace) {
      return c.json({ error: 'Locale and namespace are required' }, 400);
    }

    try {
      const data = await this.context.storage.get(locale, namespace);

      if (!data) {
        return c.json({ error: 'Namespace not found' }, 404);
      }

      return c.json(data);
    } catch (error) {
      return c.json({ error: 'Failed to get namespace' }, 500);
    }
  }

  /**
   * PUT /api/i18n/namespace/:locale/:namespace
   * Update translation namespace
   */
  async updateNamespace(c: Context): Promise<Response> {
    const { locale, namespace } = c.req.param();
    const body = await c.req.json();

    if (!locale || !namespace) {
      return c.json({ error: 'Locale and namespace are required' }, 400);
    }

    try {
      const existing = await this.context.storage.get(locale, namespace);
      const data: TranslationNamespace = {
        locale,
        namespace,
        translations: body.translations || {},
        metadata: body.metadata || existing?.metadata,
      };

      await this.context.storage.set(data);

      return c.json({ success: true, data });
    } catch (error) {
      return c.json({ error: 'Failed to update namespace' }, 500);
    }
  }

  /**
   * GET /api/i18n/entry/:locale/:namespace/:key
   * Get single translation entry
   */
  async getEntry(c: Context): Promise<Response> {
    const { locale, namespace, key } = c.req.param();

    if (!locale || !namespace || !key) {
      return c.json({ error: 'Locale, namespace, and key are required' }, 400);
    }

    try {
      const entry = await this.context.storage.getEntry(locale, namespace, key);

      if (!entry) {
        return c.json({ error: 'Entry not found' }, 404);
      }

      return c.json(entry);
    } catch (error) {
      return c.json({ error: 'Failed to get entry' }, 500);
    }
  }

  /**
   * PUT /api/i18n/entry/:locale/:namespace/:key
   * Update single translation entry
   */
  async updateEntry(c: Context): Promise<Response> {
    const { locale, namespace, key } = c.req.param();
    const body = await c.req.json();

    if (!locale || !namespace || !key) {
      return c.json({ error: 'Locale, namespace, and key are required' }, 400);
    }

    try {
      const entry: TranslationEntry = {
        key,
        value: body.value,
        context: body.context,
        plural: body.plural,
        metadata: body.metadata,
      };

      await this.context.storage.setEntry(locale, namespace, key, entry);

      return c.json({ success: true, entry });
    } catch (error) {
      return c.json({ error: 'Failed to update entry' }, 500);
    }
  }

  /**
   * DELETE /api/i18n/entry/:locale/:namespace/:key
   * Delete translation entry
   */
  async deleteEntry(c: Context): Promise<Response> {
    const { locale, namespace, key } = c.req.param();

    if (!locale || !namespace || !key) {
      return c.json({ error: 'Locale, namespace, and key are required' }, 400);
    }

    try {
      await this.context.storage.deleteEntry(locale, namespace, key);

      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: 'Failed to delete entry' }, 500);
    }
  }

  /**
   * GET /api/i18n/locale
   * Detect locale from request
   */
  async detectLocale(c: Context): Promise<Response> {
    const supportedLocales = c.req.query('supported')?.split(',') || ['en'];
    const fallback = c.req.query('fallback') || 'en';

    try {
      const result = detectLocale(c.req.raw, {
        fallbackLocale: fallback,
        supportedLocales,
      });

      return c.json({
        detected: result,
        supported: supportedLocales,
        fallback,
      });
    } catch (error) {
      return c.json({ error: 'Failed to detect locale' }, 500);
    }
  }

  /**
   * GET /api/i18n/negotiate
   * Negotiate best locale
   */
  async negotiateLocale(c: Context): Promise<Response> {
    const { preferred } = await c.req.json();
    const supportedLocales = c.req.query('supported')?.split(',') || ['en'];
    const fallback = c.req.query('fallback') || 'en';

    if (!Array.isArray(preferred)) {
      return c.json({ error: 'Preferred locales must be an array' }, 400);
    }

    try {
      const result = negotiateLocale(preferred, supportedLocales, fallback);

      return c.json({
        result,
        preferred,
        supported: supportedLocales,
        fallback,
      });
    } catch (error) {
      return c.json({ error: 'Failed to negotiate locale' }, 500);
    }
  }

  /**
   * GET /api/i18n/statistics/:locale
   * Get translation statistics for locale
   */
  async getStatistics(c: Context): Promise<Response> {
    const { locale } = c.req.param();
    const namespace = c.req.query('namespace');

    if (!locale) {
      return c.json({ error: 'Locale is required' }, 400);
    }

    try {
      const stats = await this.context.storage.getStatistics(locale);

      return c.json(stats);
    } catch (error) {
      return c.json({ error: 'Failed to get statistics' }, 500);
    }
  }

  /**
   * GET /api/i18n/export/:locale
   * Export translations
   */
  async exportTranslations(c: Context): Promise<Response> {
    const { locale } = c.req.param();
    const format = (c.req.query('format') || 'json') as TranslationFormat;
    const namespace = c.req.query('namespace');

    if (!locale) {
      return c.json({ error: 'Locale is required' }, 400);
    }

    try {
      if (namespace) {
        const ns = await this.context.storage.get(locale, namespace);
        if (!ns) {
          return c.json({ error: 'Namespace not found' }, 404);
        }
        return c.json(ns);
      } else {
        const data = await this.context.storage.exportLocale(locale);
        return c.json(data);
      }
    } catch (error) {
      return c.json({ error: 'Failed to export translations' }, 500);
    }
  }

  /**
   * POST /api/i18n/import/:locale
   * Import translations
   */
  async importTranslations(c: Context): Promise<Response> {
    const { locale } = c.req.param();
    const body = await c.req.json();
    const { overwrite = false } = body;

    if (!locale) {
      return c.json({ error: 'Locale is required' }, 400);
    }

    if (!body.translations) {
      return c.json({ error: 'Translations data is required' }, 400);
    }

    try {
      const count = await this.context.storage.importLocale(locale, body.translations);

      return c.json({
        success: true,
        imported: count,
        locale,
      });
    } catch (error) {
      return c.json({ error: 'Failed to import translations' }, 500);
    }
  }

  /**
   * GET /api/i18n/validate
   * Validate ICU message format
   */
  async validateMessage(c: Context): Promise<Response> {
    const { message } = await c.req.json();

    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }

    try {
      const result = icuParser.validate(message);
      return c.json(result);
    } catch (error) {
      return c.json({ valid: false, error: 'Validation failed' }, 500);
    }
  }

  /**
   * GET /api/i18n/memory/search
   * Search translation memory
   */
  async searchMemory(c: Context): Promise<Response> {
    const { text, sourceLocale, targetLocale, limit = 5 } = await c.req.json();

    if (!text || !sourceLocale || !targetLocale) {
      return c.json({ error: 'Text, sourceLocale, and targetLocale are required' }, 400);
    }

    if (!this.context.memory) {
      return c.json({ error: 'Translation memory not available' }, 501);
    }

    try {
      const matches = await this.context.memory.findFuzzy(
        text,
        sourceLocale,
        targetLocale,
        limit
      );

      return c.json({
        matches: matches.map((m) => ({
          text: m.entry.targetText,
          similarity: m.similarity,
          fuzzy: m.fuzzy,
          quality: m.entry.quality,
        })),
      });
    } catch (error) {
      return c.json({ error: 'Failed to search memory' }, 500);
    }
  }

  /**
   * POST /api/i18n/memory/add
   * Add to translation memory
   */
  async addToMemory(c: Context): Promise<Response> {
    const { sourceText, targetText, sourceLocale, targetLocale, quality = 1.0 } =
      await c.req.json();

    if (!sourceText || !targetText || !sourceLocale || !targetLocale) {
      return c.json(
        { error: 'sourceText, targetText, sourceLocale, and targetLocale are required' },
        400
      );
    }

    if (!this.context.memory) {
      return c.json({ error: 'Translation memory not available' }, 501);
    }

    try {
      const id = await this.context.memory.add({
        sourceText,
        targetText,
        sourceLocale,
        targetLocale,
        quality,
      });

      return c.json({ success: true, id });
    } catch (error) {
      return c.json({ error: 'Failed to add to memory' }, 500);
    }
  }

  /**
   * GET /api/i18n/formats/number
   * Format number
   */
  async formatNumber(c: Context): Promise<Response> {
    const { value, locale, style = 'decimal', currency } = await c.req.json();

    if (value === undefined || !locale) {
      return c.json({ error: 'Value and locale are required' }, 400);
    }

    try {
      const { formatNumber } = await import('../formatters/number.js');
      let formatted: string;

      switch (style) {
        case 'currency':
          if (!currency) {
            return c.json({ error: 'Currency is required for currency style' }, 400);
          }
          formatted = formatNumber(Number(value), locale, { style, currency });
          break;
        default:
          formatted = formatNumber(Number(value), locale, { style });
      }

      return c.json({ value, formatted, locale, style });
    } catch (error) {
      return c.json({ error: 'Failed to format number' }, 500);
    }
  }

  /**
   * GET /api/i18n/formats/date
   * Format date
   */
  async formatDate(c: Context): Promise<Response> {
    const { date, locale, format = 'medium' } = await c.req.json();

    if (!date || !locale) {
      return c.json({ error: 'Date and locale are required' }, 400);
    }

    try {
      const { formatDate: formatDateFn } = await import('../formatters/datetime.js');
      const formatted = formatDateFn(new Date(date), locale, { format });

      return c.json({ date, formatted, locale, format });
    } catch (error) {
      return c.json({ error: 'Failed to format date' }, 500);
    }
  }

  /**
   * POST /api/i18n/cache/clear
   * Clear translation cache
   */
  async clearCache(c: Context): Promise<Response> {
    try {
      this.context.translator.clearCache();
      this.context.storage.clearCache();

      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: 'Failed to clear cache' }, 500);
    }
  }

  /**
   * GET /api/i18n/health
   * Health check
   */
  async health(c: Context): Promise<Response> {
    const stats = {
      translator: {
        locale: this.context.translator.getLocale(),
        cacheSize: this.context.storage.getCacheSize(),
      },
      storage: {
        type: 'kv',
        cacheSize: this.context.storage.getCacheSize(),
      },
      memory: this.context.memory
        ? { available: true }
        : { available: false },
    };

    return c.json({ status: 'healthy', stats });
  }
}

/**
 * Create API routes for Hono
 */
export function createAPIRoutes(context: APIContext) {
  const api = new TranslationAPI(context);

  return {
    '/api/i18n/translate': {
      POST: api.translate.bind(api),
    },
    '/api/i18n/translate/batch': {
      POST: api.translateBatch.bind(api),
    },
    '/api/i18n/namespace/:locale/:namespace': {
      GET: api.getNamespace.bind(api),
      PUT: api.updateNamespace.bind(api),
    },
    '/api/i18n/entry/:locale/:namespace/:key': {
      GET: api.getEntry.bind(api),
      PUT: api.updateEntry.bind(api),
      DELETE: api.deleteEntry.bind(api),
    },
    '/api/i18n/locale': {
      GET: api.detectLocale.bind(api),
    },
    '/api/i18n/negotiate': {
      POST: api.negotiateLocale.bind(api),
    },
    '/api/i18n/statistics/:locale': {
      GET: api.getStatistics.bind(api),
    },
    '/api/i18n/export/:locale': {
      GET: api.exportTranslations.bind(api),
    },
    '/api/i18n/import/:locale': {
      POST: api.importTranslations.bind(api),
    },
    '/api/i18n/validate': {
      POST: api.validateMessage.bind(api),
    },
    '/api/i18n/memory/search': {
      POST: api.searchMemory.bind(api),
    },
    '/api/i18n/memory/add': {
      POST: api.addToMemory.bind(api),
    },
    '/api/i18n/formats/number': {
      POST: api.formatNumber.bind(api),
    },
    '/api/i18n/formats/date': {
      POST: api.formatDate.bind(api),
    },
    '/api/i18n/cache/clear': {
      POST: api.clearCache.bind(api),
    },
    '/api/i18n/health': {
      GET: api.health.bind(api),
    },
  };
}
