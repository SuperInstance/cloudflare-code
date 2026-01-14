/**
 * ICU Message Format Parser for ClaudeFlare i18n
 * Handles parsing and formatting of ICU message syntax
 */

import type {
  ICUMessage,
  ICUMessageFormat,
  TranslationValue,
  PluralCategory,
} from '../types/index.js';

/**
 * Parse ICU message format
 */
export class ICUParser {
  /**
   * Parse an ICU message string into a structured format
   */
  parse(message: string): ICUMessageFormat {
    const parts: ICUMessage[] = [];
    let pos = 0;

    while (pos < message.length) {
      // Check for pattern start
      if (message[pos] === '{') {
        const result = this.parsePattern(message, pos);
        if (result) {
          parts.push(result.pattern);
          pos = result.newPos;
          continue;
        }
      }

      // Regular text
      const nextPattern = message.indexOf('{', pos);
      if (nextPattern === -1) {
        parts.push({
          type: 'text',
          value: message.slice(pos),
        });
        break;
      }

      parts.push({
        type: 'text',
        value: message.slice(pos, nextPattern),
      });
      pos = nextPattern;
    }

    return { type: 'compound', parts };
  }

  /**
   * Parse a pattern starting at {
   */
  private parsePattern(
    message: string,
    pos: number
  ): { pattern: ICUMessage; newPos: number } | null {
    const endPos = message.indexOf('}', pos);
    if (endPos === -1) return null;

    const content = message.slice(pos + 1, endPos).trim();
    const newPos = endPos + 1;

    // Check for complex patterns (select, plural, etc.)
    const commaPos = content.indexOf(',');
    if (commaPos !== -1) {
      const argName = content.slice(0, commaPos).trim();
      const typeAndArgs = content.slice(commaPos + 1).trim();

      const spacePos = typeAndArgs.indexOf(' ');
      const type = spacePos === -1 ? typeAndArgs : typeAndArgs.slice(0, spacePos);
      const args = spacePos === -1 ? '' : typeAndArgs.slice(spacePos + 1).trim();

      return {
        pattern: this.parseComplexPattern(argName, type, args),
        newPos,
      };
    }

    // Simple argument
    return {
      pattern: { type: 'argument', value: content },
      newPos,
    };
  }

  /**
   * Parse complex patterns (select, plural, etc.)
   */
  private parseComplexPattern(
    argName: string,
    type: string,
    args: string
  ): ICUMessage {
    switch (type) {
      case 'select':
        return this.parseSelectPattern(argName, args);
      case 'plural':
        return {
          type: 'plural',
          value: argName,
          pluralType: 'cardinal',
          options: this.parseOptions(args),
        };
      case 'selectordinal':
        return {
          type: 'selectOrdinal',
          value: argName,
          pluralType: 'ordinal',
          options: this.parseOptions(args),
        };
      case 'date':
        return { type: 'date', value: argName, style: args || undefined };
      case 'time':
        return { type: 'time', value: argName, style: args || undefined };
      case 'number':
        return { type: 'number', value: argName, style: args || undefined };
      default:
        return { type: 'argument', value: argName };
    }
  }

  /**
   * Parse select pattern
   */
  private parseSelectPattern(argName: string, args: string): ICUMessage {
    return {
      type: 'select',
      value: argName,
      options: this.parseOptions(args),
    };
  }

  /**
   * Parse options block
   */
  private parseOptions(args: string): Record<string, ICUMessageFormat> {
    const options: Record<string, ICUMessageFormat> = {};
    const regex = /(\w+)\s*\{([^}]*)\}/g;
    let match;

    while ((match = regex.exec(args)) !== null) {
      const [, key, value] = match;
      options[key] = this.parse(value.trim());
    }

    return options;
  }

  /**
   * Format parsed message with values
   */
  format(
    parsed: ICUMessageFormat,
    values: Record<string, TranslationValue>,
    locale: string,
    pluralRule?: (n: number) => PluralCategory
  ): string {
    return parsed.parts
      .map((part) => this.formatPart(part, values, locale, pluralRule))
      .join('');
  }

  /**
   * Format a single message part
   */
  private formatPart(
    part: ICUMessage,
    values: Record<string, TranslationValue>,
    locale: string,
    pluralRule?: (n: number) => PluralCategory
  ): string {
    switch (part.type) {
      case 'text':
        return part.value || '';

      case 'argument':
        return String(values[part.value || ''] ?? `{${part.value}}`);

      case 'select': {
        const value = String(values[part.value || ''] ?? 'other');
        const options = part.options || {};
        const selected = options[value] || options.other;
        return selected
          ? this.format(selected, values, locale, pluralRule)
          : value;
      }

      case 'plural':
      case 'selectOrdinal': {
        const num = Number(values[part.value || ''] ?? 0);
        const offset = part.offset || 0;
        const adjustedNum = num - offset;
        const options = part.options || {};

        // Try explicit number first (=0, =1, etc.)
        const explicit = `=${num}`;
        if (explicit in options) {
          return this.format(options[explicit], values, locale, pluralRule);
        }

        // Determine plural category
        const category = pluralRule
          ? pluralRule(adjustedNum)
          : this.getDefaultPlural(adjustedNum);

        const selected = options[category] || options.other;
        return selected
          ? this.format(selected, values, locale, pluralRule)
          : String(num);
      }

      case 'date': {
        const value = values[part.value || ''];
        if (!value) return '';
        return this.formatDate(value, part.style);
      }

      case 'time': {
        const value = values[part.value || ''];
        if (!value) return '';
        return this.formatTime(value, part.style);
      }

      case 'number': {
        const value = Number(values[part.value || ''] ?? 0);
        return this.formatNumber(value, part.style, locale);
      }

      default:
        return '';
    }
  }

  /**
   * Format date
   */
  private formatDate(value: TranslationValue, style?: string): string {
    const date = value instanceof Date ? value : new Date(String(value));
    if (isNaN(date.getTime())) return '';

    if (style === 'short') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
    } else if (style === 'medium') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } else if (style === 'long') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else if (style === 'full') {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    return date.toLocaleDateString();
  }

  /**
   * Format time
   */
  private formatTime(value: TranslationValue, style?: string): string {
    const date = value instanceof Date ? value : new Date(String(value));
    if (isNaN(date.getTime())) return '';

    if (style === 'short') {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
      });
    } else if (style === 'medium') {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    } else if (style === 'long') {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'short',
      });
    } else if (style === 'full') {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'long',
      });
    }

    return date.toLocaleTimeString();
  }

  /**
   * Format number
   */
  private formatNumber(value: number, style?: string, locale = 'en-US'): string {
    if (style === 'integer') {
      return value.toLocaleString(locale, {
        maximumFractionDigits: 0,
      });
    } else if (style === 'percent') {
      return value.toLocaleString(locale, {
        style: 'percent',
      });
    } else if (style === 'currency') {
      return value.toLocaleString(locale, {
        style: 'currency',
        currency: 'USD',
      });
    }

    return value.toLocaleString(locale);
  }

  /**
   * Get default plural category (English-like)
   */
  private getDefaultPlural(n: number): PluralCategory {
    if (n === 0) return 'zero';
    if (n === 1) return 'one';
    return 'other';
  }

  /**
   * Escape special ICU characters
   */
  escape(text: string): string {
    return text.replace(/'/g, "''").replace(/{/g, "'{").replace(/}/g, "'}");
  }

  /**
   * Validate ICU message syntax
   */
  validate(message: string): { valid: boolean; error?: string } {
    let openBraces = 0;
    let pos = 0;

    while (pos < message.length) {
      const char = message[pos];

      if (char === "'") {
        // Escaped character
        const nextPos = message.indexOf("'", pos + 1);
        if (nextPos === -1) {
          return { valid: false, error: 'Unclosed quote' };
        }
        pos = nextPos + 1;
        continue;
      }

      if (char === '{') {
        openBraces++;
      } else if (char === '}') {
        openBraces--;
        if (openBraces < 0) {
          return { valid: false, error: 'Unmatched closing brace' };
        }
      }

      pos++;
    }

    if (openBraces !== 0) {
      return { valid: false, error: 'Unmatched opening brace' };
    }

    return { valid: true };
  }
}

/**
 * Global ICU parser instance
 */
export const icuParser = new ICUParser();
