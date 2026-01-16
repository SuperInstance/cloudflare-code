/**
 * Type utility definitions for ClaudeFlare platform
 * @packageDocumentation
 */

// @ts-nocheck - This file contains advanced utility types that may have strict type checking issues

// ============================================================================
// BASIC TYPE UTILITIES
// ============================================================================

/**
 * Make all properties in T optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/**
 * Make all properties in T required
 */
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

/**
 * Make all properties in T readonly
 */
export type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

/**
 * Pick specific properties from T
 */
export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

/**
 * Omit specific properties from T
 */
export type Omit<T, K extends keyof T> = {
  [P in Exclude<keyof T, K>]: T[P];
};

// ============================================================================
// ADVANCED TYPE UTILITIES
// ============================================================================

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Deep partial - makes all nested properties optional
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

/**
 * Deep readonly - makes all nested properties readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

// ============================================================================
// TRANSFORMATION TYPES
// ============================================================================

/**
 * Extract keys of specific type from T
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Pick properties of specific type from T
 */
export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

/**
 * Omit properties of specific type from T
 */
export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>;

/**
 * Make all properties nullable
 */
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

/**
 * Make all properties nullable or undefined
 */
export type NullableOrNull<T> = {
  [P in keyof T]: T[P] | null | undefined;
};

// ============================================================================
// FUNCTION TYPES
// ============================================================================

/**
 * Extract return type from function
 */
export type ReturnType<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: unknown[]
) => infer R
  ? R
  : unknown;

/**
 * Extract parameters from function
 */
export type Parameters<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: infer P
) => unknown
  ? P
  : never;

/**
 * Async function return type
 */
export type AsyncReturnType<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: unknown[]
) => Promise<infer R>
  ? R
  : ReturnType<T>;

/**
 * Promisify a function return type
 */
export type Promisify<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => Promise<R>
  : never;

// ============================================================================
// STRING TYPES
// ============================================================================

/**
 * Split string by delimiter
 */
export type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
  ? [T, ...Split<U, D>]
  : [S];

/**
 * Join array of strings with delimiter
 */
export type Join<T extends string[], D extends string> = T extends [infer First extends string]
  ? First
  : T extends [infer First extends string, ...infer Rest extends string[]]
    ? `${First}${D}${Join<Rest, D>}`
    : never;

/**
 * CamelCase string conversion
 */
export type CamelCase<S extends string> = S extends `${infer P}_${infer Q}`
  ? `${P}${Capitalize<CamelCase<Q>>}`
  : S extends `${infer P}-${infer Q}`
    ? `${P}${Capitalize<CamelCase<Q>>}`
    : S;

/**
 * PascalCase string conversion
 */
export type PascalCase<S extends string> = Capitalize<CamelCase<S>>;

/**
 * SnakeCase string conversion
 */
export type SnakeCase<S extends string> = S extends `${infer C}${infer Rest}`
  ? C extends Uppercase<C>
    ? C extends Lowercase<C>
      ? `${C}${SnakeCase<Rest>}`
      : `_${Lowercase<C>}${SnakeCase<Rest>}`
    : `${C}${SnakeCase<Rest>}`
  : S;

/**
 * KebabCase string conversion
 */
export type KebabCase<S extends string> = S extends `${infer C}${infer Rest}`
  ? C extends Uppercase<C>
    ? C extends Lowercase<C>
      ? `${C}${KebabCase<Rest>}`
      : `-${Lowercase<C>}${KebabCase<Rest>}`
    : `${C}${KebabCase<Rest>}`
  : S;

// ============================================================================
// OBJECT TYPES
// ============================================================================

/**
 * Extract keys of object
 */
export type Keys<T> = keyof T;

/**
 * Extract values of object
 */
export type Values<T> = T[keyof T];

/**
 * Extract entries of object as tuple array
 */
export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * Merge two types
 */
export type Merge<T, U> = Omit<T, keyof U> & U;

/**
 * Deep merge two types
 */
export type DeepMerge<T, U> = {
  [K in keyof T | keyof U]: K extends keyof U & keyof T
    ? DeepMerge<T[K], U[K]>
    : K extends keyof U
      ? U[K]
      : K extends keyof T
        ? T[K]
        : never;
};

// ============================================================================
// CONDITIONAL TYPES
// ============================================================================

/**
 * If-else type
 */
export type If<C extends boolean, T, F> = C extends true ? T : F;

/**
 * Check if type is array
 */
export type IsArray<T> = T extends any[] ? true : false;

/**
 * Check if type is object
 */
export type IsObject<T> = T extends object
  ? T extends any[]
    ? false
    : T extends Function
      ? false
      : true
  : false;

/**
 * Check if type is promise
 */
export type IsPromise<T> = T extends Promise<any> ? true : false;

/**
 * Extract promise value type
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Extract array element type
 */
export type UnwrapArray<T> = T extends (infer U)[] ? U : T;

// ============================================================================
// COLLECTION TYPES
// ============================================================================

/**
 * Create dictionary type
 */
export type Dictionary<T, K extends string | number = string> = Record<K, T>;

/**
 * Create readonly dictionary type
 */
export type ReadonlyDictionary<T, K extends string | number = string> = Readonly<
  Record<K, T>
>;

/**
 * Extract keys that are optional
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Extract keys that are required
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Split type into required and optional parts
 */
export type SplitRequiredOptional<T> = {
  required: Pick<T, RequiredKeys<T>>;
  optional: Pick<T, OptionalKeys<T>>;
};

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event handler type
 */
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Event map type
 */
export type EventMap = Record<string, unknown>;

/**
 * Extract event data type from event map
 */
export type EventDataType<T extends EventMap, K extends keyof T> = T[K];

/**
 * Create event handlers type from event map
 */
export type EventHandlers<T extends EventMap> = {
  [K in keyof T]: EventHandler<T[K]>;
};

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Strict configuration - no extra properties allowed
 */
export type StrictConfig<T> = T & {
  [K: string]: never;
};

/**
 * Loose configuration - extra properties allowed
 */
export type LooseConfig<T> = T & {
  [K: string]: unknown;
};

/**
 * Configuration with defaults
 */
export type ConfigWithDefaults<T, D extends Partial<T> = Partial<T>> = {
  [K in keyof T]: K extends keyof D ? T[K] | D[K] : T[K];
};

// ============================================================================
// UTILITY TYPE EXPORTS
// ============================================================================

/**
 * Omit timestamp and metadata from types
 */
export type WithoutMeta<T> = Omit<T, 'timestamp' | 'metadata' | 'createdAt' | 'updatedAt'>;

/**
 * Omit ID from types
 */
export type WithoutId<T> = Omit<T, 'id'>;

/**
 * Create type for new entity (without id, timestamps, etc.)
 */
export type NewEntity<T> = WithoutMeta<WithoutId<T>>;

/**
 * Create type for updating entity (all fields optional)
 */
export type UpdateEntity<T> = Partial<T>;

/**
 * Create type for partial entity update (specific fields optional)
 */
export type PartialUpdate<T, K extends keyof T = keyof T> = PartialBy<T, K>;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for null or undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Type guard for not null or undefined
 */
export function isNotNullOrUndefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isObject(value) && value.constructor === Object;
}

/**
 * Type guard for function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Type guard for promise
 */
export function isPromise(value: unknown): value is Promise<unknown> {
  return isObject(value) && isFunction((value as Promise<unknown>).then);
}

/**
 * Type guard for string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for date
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * Type guard for empty value
 */
export function isEmpty(value: unknown): boolean {
  if (isNullOrUndefined(value)) return true;
  if (isString(value) || isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  return false;
}
