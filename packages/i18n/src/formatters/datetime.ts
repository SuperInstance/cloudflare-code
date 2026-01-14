/**
 * Date and time formatting for different locales
 */

import type { DateTimeFormatOptions, Locale } from '../types/index.js';

/**
 * Format date according to locale
 */
export function formatDate(
  date: Date | string | number,
  locale: Locale,
  options: DateTimeFormatOptions = {}
): string {
  const {
    format = 'medium',
    pattern,
    timeZone,
    calendar,
    numberingSystem,
  } = options;

  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) {
    return String(date);
  }

  try {
    const intlOptions: Intl.DateTimeFormatOptions = getTimeFormatOptions(format);
    if (timeZone) intlOptions.timeZone = timeZone;
    if (calendar) intlOptions.calendar = calendar;
    if (numberingSystem) intlOptions.numberingSystem = numberingSystem;

    if (pattern) {
      // Custom pattern (simple implementation)
      return applyCustomPattern(dateObj, pattern, locale);
    }

    const formatter = new Intl.DateTimeFormat(locale, intlOptions);
    return formatter.format(dateObj);
  } catch (error) {
    return dateObj.toLocaleDateString();
  }
}

/**
 * Format time according to locale
 */
export function formatTime(
  time: Date | string | number,
  locale: Locale,
  options: Omit<DateTimeFormatOptions, 'format'> & {
    format?: 'full' | 'long' | 'medium' | 'short';
  } = {}
): string {
  const { format = 'short', timeZone, calendar, numberingSystem } = options;

  const dateObj = time instanceof Date ? time : new Date(time);
  if (isNaN(dateObj.getTime())) {
    return String(time);
  }

  try {
    const intlOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
    };

    if (format === 'full' || format === 'long') {
      intlOptions.second = 'numeric';
      intlOptions.timeZoneName = 'short';
    } else if (format === 'medium') {
      intlOptions.second = 'numeric';
    }

    if (timeZone) intlOptions.timeZone = timeZone;
    if (calendar) intlOptions.calendar = calendar;
    if (numberingSystem) intlOptions.numberingSystem = numberingSystem;

    const formatter = new Intl.DateTimeFormat(locale, intlOptions);
    return formatter.format(dateObj);
  } catch (error) {
    return dateObj.toLocaleTimeString();
  }
}

/**
 * Format date and time
 */
export function formatDateTime(
  date: Date | string | number,
  locale: Locale,
  options: DateTimeFormatOptions = {}
): string {
  const dateStr = formatDate(date, locale, options);
  const timeStr = formatTime(date, locale, options);

  // Locale-specific separator
  const separator = locale.startsWith('en') ? ' at ' : ' ';

  return `${dateStr}${separator}${timeStr}`;
}

/**
 * Format relative time (2 hours ago, in 3 days)
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: Locale
): string {
  try {
    const formatter = new Intl.RelativeTimeFormat(locale, {
      numeric: 'auto',
    });
    return formatter.format(value, unit);
  } catch (error) {
    // Fallback for older browsers
    return `${value} ${unit}${value !== 1 ? 's' : ''}`;
  }
}

/**
 * Get time ago string (2 hours ago)
 */
export function timeAgo(
  date: Date | string | number,
  locale: Locale
): string {
  const now = Date.now();
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const diff = then - now;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const absValue = Math.abs(seconds);

  if (absValue < 60) {
    return formatRelativeTime(seconds, 'second', locale);
  } else if (absValue < 3600) {
    return formatRelativeTime(minutes, 'minute', locale);
  } else if (absValue < 86400) {
    return formatRelativeTime(hours, 'hour', locale);
  } else if (absValue < 604800) {
    return formatRelativeTime(days, 'day', locale);
  } else if (absValue < 2592000) {
    return formatRelativeTime(weeks, 'week', locale);
  } else if (absValue < 31536000) {
    return formatRelativeTime(months, 'month', locale);
  } else {
    return formatRelativeTime(years, 'year', locale);
  }
}

/**
 * Format date range (Jan 1 - Jan 5, 2024)
 */
export function formatDateRange(
  startDate: Date | string | number,
  endDate: Date | string | number,
  locale: Locale
): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    // Check if dates are in same month/year
    if (start.getFullYear() === end.getFullYear()) {
      if (start.getMonth() === end.getMonth()) {
        // Same month
        const partsStart = formatter.formatToParts(start);
        const partsEnd = formatter.formatToParts(end);

        const startDay = partsStart.find((p) => p.type === 'day')?.value || '';
        const endDay = partsEnd.find((p) => p.type === 'day')?.value || '';
        const month = partsStart.find((p) => p.type === 'month')?.value || '';
        const year = partsStart.find((p) => p.type === 'year')?.value || '';

        return locale.startsWith('ar')
          ? `${month} ${startDay} - ${endDay}, ${year}`
          : `${month} ${startDay} - ${endDay}, ${year}`;
      }
    }

    return `${formatter.format(start)} - ${formatter.format(end)}`;
  } catch (error) {
    return `${startDate} - ${endDate}`;
  }
}

/**
 * Format duration (2h 30m)
 */
export function formatDuration(
  milliseconds: number,
  locale: Locale,
  style: 'short' | 'long' | 'narrow' = 'short'
): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}${style === 'short' ? 'd' : style === 'narrow' ? 'd' : ' day'}`);
  }
  if (hours % 24 > 0) {
    parts.push(`${hours % 24}${style === 'short' ? 'h' : style === 'narrow' ? 'h' : 'hr'}`);
  }
  if (minutes % 60 > 0) {
    parts.push(`${minutes % 60}${style === 'short' ? 'm' : style === 'narrow' ? 'm' : 'min'}`);
  }
  if (seconds % 60 > 0 && parts.length === 0) {
    parts.push(`${seconds % 60}${style === 'short' ? 's' : style === 'narrow' ? 's' : 'sec'}`);
  }

  return parts.join(' ');
}

/**
 * Get timezone name
 */
export function getTimezoneName(timeZone: string, locale: Locale): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: 'long',
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value || timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * Get timezone offset
 */
export function getTimezoneOffset(
  date: Date,
  timeZone: string,
  locale: Locale
): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    return offsetPart?.value || '';
  } catch {
    return '';
  }
}

/**
 * Get date parts
 */
export function getDateParts(
  date: Date | string | number,
  locale: Locale
): {
  era?: string;
  year?: string;
  month?: string;
  day?: string;
  weekday?: string;
} {
  const dateObj = date instanceof Date ? date : new Date(date);

  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      era: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });

    const parts = formatter.formatToParts(dateObj);
    const result: Record<string, string> = {};

    for (const part of parts) {
      if (part.type !== 'literal') {
        result[part.type] = part.value;
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string | number): boolean {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.getTime() < Date.now();
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | string | number): boolean {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.getTime() > Date.now();
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string | number): boolean {
  const dateObj = date instanceof Date ? date : new Date(date);
  const today = new Date();

  return (
    dateObj.getFullYear() === today.getFullYear() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getDate() === today.getDate()
  );
}

/**
 * Check if date is this year
 */
export function isThisYear(date: Date | string | number): boolean {
  const dateObj = date instanceof Date ? date : new Date(date);
  const today = new Date();

  return dateObj.getFullYear() === today.getFullYear();
}

/**
 * Get Intl format options from format string
 */
function getTimeFormatOptions(
  format: 'full' | 'long' | 'medium' | 'short'
): Intl.DateTimeFormatOptions {
  switch (format) {
    case 'full':
      return {
        weekday: 'long',
        era: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };
    case 'long':
      return {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };
    case 'medium':
      return {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      };
    case 'short':
      return {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      };
  }
}

/**
 * Apply custom date pattern
 */
function applyCustomPattern(
  date: Date,
  pattern: string,
  locale: Locale
): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  return pattern
    .replace(/yyyy/g, year.toString())
    .replace(/yy/g, (year % 100).toString().padStart(2, '0'))
    .replace(/MM/g, month.toString().padStart(2, '0'))
    .replace(/M/g, month.toString())
    .replace(/dd/g, day.toString().padStart(2, '0'))
    .replace(/d/g, day.toString())
    .replace(/HH/g, hours.toString().padStart(2, '0'))
    .replace(/H/g, hours.toString())
    .replace(/mm/g, minutes.toString().padStart(2, '0'))
    .replace(/m/g, minutes.toString())
    .replace(/ss/g, seconds.toString().padStart(2, '0'))
    .replace(/s/g, seconds.toString());
}

/**
 * Get calendar system for locale
 */
export function getCalendar(locale: Locale): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale);
    return formatter.resolvedOptions().calendar;
  } catch {
    return 'gregory';
  }
}

/**
 * Get numbering system for locale
 */
export function getNumberingSystem(locale: Locale): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale);
    return formatter.resolvedOptions().numberingSystem;
  } catch {
    return 'latn';
  }
}
