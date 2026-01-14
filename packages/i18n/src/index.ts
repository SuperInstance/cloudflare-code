/**
 * ClaudeFlare i18n - Comprehensive internationalization platform
 * Support for 20+ languages with translation memory, RTL support, and locale-specific formatters
 */

// Core
export * from './core/translator.js';
export * from './core/locale.js';
export * from './core/icu-parser.js';

// Types
export * from './types/index.js';

// Formatters
export * from './formatters/index.js';

// RTL Support
export * from './rtl/index.js';

// Translation Memory
export * from './memory/index.js';

// Storage
export * from './storage/index.js';

// API
export * from './api/index.js';

// Import/Export
export * from './import-export/index.js';

// Utils
export * from './utils/plural-rules.js';
export * from './utils/hash.js';

// Version
export const VERSION = '1.0.0';

/**
 * Create a complete i18n instance
 */
import { Translator, type TranslatorOptions } from './core/translator.js';
import { KVTranslationStorage, type KVStorageOptions } from './storage/kv.js';
import { TranslationMemory, type TranslationMemoryOptions } from './memory/tm.js';

export interface I18nInstance {
  translator: Translator;
  storage: KVTranslationStorage;
  memory?: TranslationMemory;
}

export interface I18nOptions {
  locale: string;
  fallbackLocale?: string;
  storage: KVStorageOptions;
  memory?: TranslationMemoryOptions;
  namespaces?: string[];
  debug?: boolean;
}

export async function createI18n(options: I18nOptions): Promise<I18nInstance> {
  const storage = new KVTranslationStorage(options.storage);
  const memory = options.memory ? new TranslationMemory(options.memory) : undefined;

  const translator = new Translator({
    locale: options.locale,
    fallbackLocale: options.fallbackLocale || 'en',
    storage,
    namespaces: options.namespaces,
    debug: options.debug,
  });

  await translator.loadNamespaces();

  return {
    translator,
    storage,
    memory,
  };
}

/**
 * Shorthand for translation
 */
export async function t(
  key: string,
  values?: Record<string, unknown>,
  namespace?: string
): Promise<string> {
  const { getTranslator } = await import('./core/translator.js');
  const translator = getTranslator();

  if (!translator) {
    throw new Error('Translator not initialized. Call createI18n first.');
  }

  const result = await translator.translate(key, values, namespace);
  return result.translated;
}
