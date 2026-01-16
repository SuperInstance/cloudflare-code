/**
 * Core i18n types for ClaudeFlare internationalization platform
 */

// @ts-nocheck - Missing type definitions

/**
 * Locale identifier (BCP 47 language tag)
 */
export type Locale = string;

/**
 * Locale components
 */
export interface LocaleComponents {
  language: string;
  script?: string;
  region?: string;
  variant?: string;
}

/**
 * Translation value
 */
export type TranslationValue = string | number | boolean | null | undefined;

/**
 * ICU message format types
 */
export interface ICUMessage {
  type: 'text' | 'argument' | 'select' | 'plural' | 'selectOrdinal' | 'date' | 'time' | 'number';
  value?: string;
  offset?: number;
  options?: Record<string, ICUMessageFormat>;
  pluralType?: 'cardinal' | 'ordinal';
  style?: string;
}

export interface ICUMessageFormat {
  type: 'compound';
  parts: ICUMessage[];
}

/**
 * Translation entry
 */
export interface TranslationEntry {
  key: string;
  value: string;
  context?: string;
  plural?: boolean;
  metadata?: TranslationMetadata;
}

/**
 * Translation metadata
 */
export interface TranslationMetadata {
  created?: string;
  updated?: string;
  author?: string;
  reviewed?: boolean;
  quality?: number;
  source?: 'human' | 'machine' | 'tm';
  hash?: string;
}

/**
 * Translation namespace
 */
export interface TranslationNamespace {
  locale: Locale;
  namespace: string;
  translations: Record<string, TranslationEntry>;
  metadata?: NamespaceMetadata;
}

/**
 * Namespace metadata
 */
export interface NamespaceMetadata {
  version: string;
  lastSync?: string;
  totalKeys: number;
  missingKeys?: string[];
}

/**
 * Translation result
 */
export interface TranslationResult {
  translated: string;
  locale: Locale;
  usedFallback: boolean;
  missing?: boolean;
  substitutions?: Record<string, TranslationValue>;
}

/**
 * Locale detection options
 */
export interface LocaleDetectionOptions {
  fallbackLocale?: Locale;
  supportedLocales: Locale[];
  cookieName?: string;
  queryParam?: string;
  headerName?: string;
  storageKey?: string;
}

/**
 * Locale detection result
 */
export interface LocaleDetectionResult {
  locale: Locale;
  quality: number;
  source: 'header' | 'cookie' | 'query' | 'storage' | 'default';
}

/**
 * Translation storage interface
 */
export interface TranslationStorage {
  get(locale: Locale, namespace: string): Promise<TranslationNamespace | null>;
  set(namespace: TranslationNamespace): Promise<void>;
  delete(locale: Locale, namespace: string): Promise<void>;
  list(locale?: Locale): Promise<TranslationNamespace[]>;
  has(locale: Locale, namespace: string): Promise<boolean>;
}

/**
 * KV-based translation storage options
 */
export interface KVStorageOptions {
  binding: KVNamespace;
  prefix?: string;
  ttl?: number;
}

/**
 * Translation memory entry
 */
export interface TranslationMemoryEntry {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  domain?: string;
  context?: string;
  quality: number;
  usage: number;
  lastUsed: string;
  vector?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Translation match result
 */
export interface TranslationMatch {
  entry: TranslationMemoryEntry;
  similarity: number;
  fuzzy: boolean;
}

/**
 * Machine translation options
 */
export interface MachineTranslationOptions {
  provider: 'google' | 'deepl' | 'microsoft' | 'amazon';
  apiKey?: string;
  endpoint?: string;
  format?: 'text' | 'html';
  model?: string;
}

/**
 * Translation job
 */
export interface TranslationJob {
  id: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  namespace: string;
  keys: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  created: string;
  updated: string;
  error?: string;
}

/**
 * Translation quality metrics
 */
export interface TranslationQuality {
  accuracy: number;
  consistency: number;
  fluency: number;
  completeness: number;
  overall: number;
  issues: QualityIssue[];
}

/**
 * Quality issue
 */
export interface QualityIssue {
  type: 'missing' | 'inconsistent' | 'format' | 'length' | 'placeholder';
  severity: 'error' | 'warning' | 'info';
  key: string;
  message: string;
  suggestion?: string;
}

/**
 * Pluralization rules
 */
export interface PluralRule {
  cardinal: (n: number) => PluralCategory;
  ordinal?: (n: number) => PluralCategory;
}

/**
 * Plural categories (CLDR)
 */
export type PluralCategory =
  | 'zero'
  | 'one'
  | 'two'
  | 'few'
  | 'many'
  | 'other';

/**
 * Gender rules
 */
export interface GenderRule {
  categories: string[];
  select: (gender: string) => string;
}

/**
 * Date/time format options
 */
export interface DateTimeFormatOptions {
  locale: Locale;
  format?: 'full' | 'long' | 'medium' | 'short' | 'custom';
  pattern?: string;
  timeZone?: string;
  calendar?: string;
  numberingSystem?: string;
}

/**
 * Number format options
 */
export interface NumberFormatOptions {
  locale: Locale;
  style?: 'decimal' | 'currency' | 'percent' | 'unit';
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumIntegerDigits?: number;
  minimumSignificantDigits?: number;
  maximumSignificantDigits?: number;
}

/**
 * Currency format options
 */
export interface CurrencyFormatOptions extends NumberFormatOptions {
  currency: string;
  display?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
}

/**
 * Address format options
 */
export interface AddressFormatOptions {
  locale: Locale;
  format?: 'domestic' | 'international';
  fields: AddressField[];
}

/**
 * Address field
 */
export interface AddressField {
  name: string;
  label: string;
  required: boolean;
  order: number;
  width?: 'full' | 'half' | 'third' | 'quarter';
}

/**
 * Name format options
 */
export interface NameFormatOptions {
  locale: Locale;
  format?: 'full' | 'formal' | 'informal' | 'monogram';
  order?: 'western' | 'eastern';
}

/**
 * RTL (Right-to-Left) configuration
 */
export interface RTLConfig {
  enabled: boolean;
  locale: Locale;
  layoutMirroring: boolean;
  mixedContent: boolean;
  alignment: 'right' | 'left' | 'auto';
}

/**
 * RTL-aware text
 */
export interface RTLText {
  text: string;
  direction: 'ltr' | 'rtl' | 'auto';
  locale: Locale;
}

/**
 * Translation export format
 */
export type TranslationFormat = 'json' | 'yaml' | 'xliff' | 'tmx' | 'po' | 'csv';

/**
 * Translation export options
 */
export interface TranslationExportOptions {
  format: TranslationFormat;
  locale: Locale;
  namespace?: string;
  includeMetadata?: boolean;
  pretty?: boolean;
}

/**
 * Translation import options
 */
export interface TranslationImportOptions {
  format: TranslationFormat;
  locale: Locale;
  namespace?: string;
  overwrite?: boolean;
  validate?: boolean;
}

/**
 * Translation statistics
 */
export interface TranslationStatistics {
  locale: Locale;
  namespace: string;
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  percentage: number;
  lastUpdate: string;
}

/**
 * Supported locale information
 */
export interface LocaleInfo {
  code: Locale;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  pluralRule: PluralRule;
  territory?: string;
  language?: string;
  script?: string;
  defaultCurrency?: string;
  defaultCalendar?: string;
  defaultTimeZone?: string;
}

/**
 * Translation context
 */
export interface TranslationContext {
  locale: Locale;
  namespace?: string;
  fallbackLocales?: Locale[];
  storage: TranslationStorage;
  memory?: TranslationMemory;
  formatters?: boolean;
}

/**
 * Bundle of translations
 */
export interface TranslationBundle {
  locale: Locale;
  translations: Map<string, TranslationEntry>;
  metadata?: NamespaceMetadata;
}

/**
 * Locale negotiation result
 */
export interface LocaleNegotiationResult {
  locale: Locale;
  matched: boolean;
  fallbackChain: Locale[];
  reason: string;
}

/**
 * TMX document structure
 */
export interface TMXDocument {
  version: string;
  srclang?: Locale;
  tus: TMXTranslationUnit[];
}

/**
 * TMX translation unit
 */
export interface TMXTranslationUnit {
  tuid: string;
  segs: TMXSegment[];
}

/**
 * TMX segment
 */
export interface TMXSegment {
  lang: Locale;
  text: string;
}

/**
 * XLIFF document structure
 */
export interface XLIFFDocument {
  version: string;
  srcLocale: Locale;
  trgLocale: Locale;
  files: XLIFFFile[];
}

/**
 * XLIFF file
 */
export interface XLIFFFile {
  original: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  units: XLIFFUnit[];
}

/**
 * XLIFF translation unit
 */
export interface XLIFFUnit {
  id: string;
  source: string;
  target?: string;
  note?: string;
  state?: 'initial' | 'translated' | 'reviewed' | 'final';
}

/**
 * Translation cache entry
 */
export interface TranslationCacheEntry {
  key: string;
  locale: Locale;
  namespace: string;
  translation: string;
  timestamp: number;
  hash: string;
}
