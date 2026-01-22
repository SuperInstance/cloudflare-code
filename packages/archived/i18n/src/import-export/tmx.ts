/**
 * TMX (Translation Memory eXchange) import/export support
 */

import type {
  TMXDocument,
  TMXTranslationUnit,
  TMXSegment,
  TranslationNamespace,
  TranslationEntry,
  Locale,
} from '../types/index.js';

/**
 * TMX Exporter
 */
export class TMXExporter {
  /**
   * Export namespace to TMX format
   */
  static exportToTMX(
    namespaces: TranslationNamespace[],
    sourceLocale: Locale
  ): TMXDocument {
    const tus: TMXTranslationUnit[] = [];

    for (const ns of namespaces) {
      for (const [key, entry] of Object.entries(ns.translations)) {
        const tu: TMXTranslationUnit = {
          tuid: `${ns.namespace}:${key}`,
          segs: [
            {
              lang: sourceLocale,
              text: key,
            },
            {
              lang: ns.locale,
              text: entry.value,
            },
          ],
        };

        if (entry.context) {
          tu.segs.push({
            lang: sourceLocale,
            text: entry.context,
          });
        }

        tus.push(tu);
      }
    }

    return {
      version: '1.4',
      srclang: sourceLocale,
      tus,
    };
  }

  /**
   * Convert TMX document to XML string
   */
  static toXML(tmx: TMXDocument): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<tmx version="' + tmx.version + '">\n';
    xml += '  <header\n';
    xml += '    srclang="' + (tmx.srclang || 'en') + '"\n';
    xml += '    o-tmf="unknown"\n';
    xml += '    adminlang="en"\n';
    xml += '    datatype="plaintext"\n';
    xml += '    segtype="sentence"\n';
    xml += '  />\n';
    xml += '  <body>\n';

    for (const tu of tmx.tus) {
      xml += '    <tu tuid="' + this.escapeXML(tu.tuid) + '">\n';

      for (const seg of tu.segs) {
        xml += '      <tuv lang="' + seg.lang + '">\n';
        xml += '        <seg>' + this.escapeXML(seg.text) + '</seg>\n';
        xml += '      </tuv>\n';
      }

      xml += '    </tu>\n';
    }

    xml += '  </body>\n';
    xml += '</tmx>';

    return xml;
  }

  /**
   * Escape XML special characters
   */
  private static escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

/**
 * TMX Importer
 */
export class TMXImporter {
  /**
   * Import TMX document to translation namespaces
   */
  static importFromTMX(
    tmx: TMXDocument,
    targetLocale: Locale,
    namespace = 'common'
  ): TranslationNamespace {
    const translations: Record<string, TranslationEntry> = {};

    for (const tu of tmx.tus) {
      // Find source and target segments
      const sourceSeg = tu.segs.find((s) => s.lang === tmx.srclang);
      const targetSeg = tu.segs.find((s) => s.lang === targetLocale);

      if (sourceSeg && targetSeg) {
        const key = sourceSeg.text;
        translations[key] = {
          key,
          value: targetSeg.text,
          context: tu.segs.find((s) => s.text.includes('context:'))?.text,
        };
      }
    }

    return {
      locale: targetLocale,
      namespace,
      translations,
      metadata: {
        version: '1.0.0',
        totalKeys: Object.keys(translations).length,
        lastSync: new Date().toISOString(),
      },
    };
  }

  /**
   * Parse TMX XML string to document
   */
  static parseXML(xml: string): TMXDocument {
    const tmx: TMXDocument = {
      version: '1.4',
      srclang: 'en',
      tus: [],
    };

    // Simple XML parser (for production, use a proper XML parser)
    const headerMatch = xml.match(/<header[^>]*srclang="([^"]+)"/);
    if (headerMatch) {
      tmx.srclang = headerMatch[1];
    }

    const tuMatches = xml.matchAll(/<tu tuid="([^"]+)">([\s\S]*?)<\/tu>/g);

    for (const match of tuMatches) {
      const tu: TMXTranslationUnit = {
        tuid: match[1],
        segs: [],
      };

      const tuvMatches = match[2].matchAll(/<tuv lang="([^"]+)">([\s\S]*?)<\/tuv>/g);

      for (const tuvMatch of tuvMatches) {
        const segMatch = tuvMatch[2].match(/<seg>([\s\S]*?)<\/seg>/);
        if (segMatch) {
          tu.segs.push({
            lang: tuvMatch[1],
            text: this.unescapeXML(segMatch[1]),
          });
        }
      }

      tmx.tus.push(tu);
    }

    return tmx;
  }

  /**
   * Unescape XML special characters
   */
  private static unescapeXML(text: string): string {
    return text
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }
}

/**
 * XLIFF Exporter
 */
export class XLIFFExporter {
  /**
   * Export namespace to XLIFF format
   */
  static exportToXLIFF(
    sourceNamespace: TranslationNamespace,
    targetNamespace: TranslationNamespace
  ): string {
    let xliff = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xliff += '<xliff version="1.2">\n';
    xliff += '  <file\n';
    xliff +=
      '    source-language="' + sourceNamespace.locale + '"\n';
    xliff +=
      '    target-language="' + targetNamespace.locale + '"\n';
    xliff += '    datatype="plaintext"\n';
    xliff += '    original="' + sourceNamespace.namespace + '"\n';
    xliff += '  >\n';
    xliff += '    <body>\n';

    for (const [key, sourceEntry] of Object.entries(sourceNamespace.translations)) {
      const targetEntry = targetNamespace.translations[key];
      const state = targetEntry ? 'translated' : 'initial';

      xliff += '      <trans-unit id="' + this.escapeXML(key) + '">\n';
      xliff += '        <source>' + this.escapeXML(sourceEntry.value) + '</source>\n';
      xliff += '        <target>' + (targetEntry ? this.escapeXML(targetEntry.value) : '') + '</target>\n';

      if (sourceEntry.context) {
        xliff += '        <note>' + this.escapeXML(sourceEntry.context) + '</note>\n';
      }

      xliff += '      </trans-unit>\n';
    }

    xliff += '    </body>\n';
    xliff += '  </file>\n';
    xliff += '</xliff>';

    return xliff;
  }

  /**
   * Escape XML special characters
   */
  private static escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

/**
 * CSV Exporter/Importer
 */
export class CSVIO {
  /**
   * Export namespace to CSV format
   */
  static exportToCSV(namespaces: TranslationNamespace[]): string {
    const lines: string[] = [];

    // Header
    const locales = namespaces.map((ns) => ns.locale);
    lines.push(['key', ...locales].join(','));

    // Collect all keys
    const allKeys = new Set<string>();
    for (const ns of namespaces) {
      Object.keys(ns.translations).forEach((key) => allKeys.add(key));
    }

    // Data rows
    for (const key of Array.from(allKeys).sort()) {
      const row = [this.escapeCSV(key)];

      for (const ns of namespaces) {
        const value = ns.translations[key]?.value || '';
        row.push(this.escapeCSV(value));
      }

      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Import CSV to translation namespace
   */
  static importFromCSV(
    csv: string,
    targetLocale: Locale,
    namespace = 'common',
    keyColumn = 0,
    valueColumn = 1
  ): TranslationNamespace {
    const lines = csv.split('\n');
    const translations: Record<string, TranslationEntry> = {};

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = this.parseCSVLine(line);
      if (columns.length > Math.max(keyColumn, valueColumn)) {
        const key = this.unescapeCSV(columns[keyColumn]);
        const value = this.unescapeCSV(columns[valueColumn]);

        if (key && value) {
          translations[key] = {
            key,
            value,
          };
        }
      }
    }

    return {
      locale: targetLocale,
      namespace,
      translations,
      metadata: {
        version: '1.0.0',
        totalKeys: Object.keys(translations).length,
        lastSync: new Date().toISOString(),
      },
    };
  }

  /**
   * Escape CSV value
   */
  private static escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /**
   * Unescape CSV value
   */
  private static unescapeCSV(value: string): string {
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1).replace(/""/g, '"');
    }
    return value;
  }

  /**
   * Parse CSV line
   */
  private static parseCSVLine(line: string): string[] {
    const columns: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        columns.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    columns.push(current);

    return columns;
  }
}

/**
 * JSON Exporter/Importer
 */
export class JSONIO {
  /**
   * Export namespace to JSON format
   */
  static exportToJSON(namespaces: TranslationNamespace[]): string {
    const data: Record<string, Record<string, string>> = {};

    for (const ns of namespaces) {
      const locale = ns.locale;
      if (!data[locale]) {
        data[locale] = {};
      }

      for (const [key, entry] of Object.entries(ns.translations)) {
        data[locale][key] = entry.value;
      }
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import JSON to translation namespace
   */
  static importFromJSON(
    json: string,
    targetLocale: Locale,
    namespace = 'common'
  ): TranslationNamespace {
    const data = JSON.parse(json);
    const translations: Record<string, TranslationEntry> = {};

    const localeData = data[targetLocale] || data;

    for (const [key, value] of Object.entries(localeData)) {
      if (typeof value === 'string') {
        translations[key] = {
          key,
          value,
        };
      }
    }

    return {
      locale: targetLocale,
      namespace,
      translations,
      metadata: {
        version: '1.0.0',
        totalKeys: Object.keys(translations).length,
        lastSync: new Date().toISOString(),
      },
    };
  }
}
