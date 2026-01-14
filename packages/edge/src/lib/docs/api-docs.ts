/**
 * API Documentation Generator
 *
 * Generates API reference documentation from parsed symbols.
 * Organizes symbols by category, creates type signatures, and formats output.
 */

import type {
  DocSymbol,
  APIReference,
  ParsedDocumentation,
  DocFormat,
  SymbolKind,
  DocGeneratorOptions,
} from './types';

/**
 * API Documentation Generator
 */
export class APIDocGenerator {
  private options: DocGeneratorOptions;

  constructor(options: DocGeneratorOptions = {}) {
    this.options = {
      format: ['markdown'],
      includeTOC: true,
      includeIndex: true,
      includeTypes: true,
      includeExamples: true,
      groupByCategory: true,
      sortSymbols: 'kind',
      ...options,
    };
  }

  /**
   * Generate API documentation from parsed documentation
   *
   * @param docs - Parsed documentation
   * @returns API reference
   */
  generateAPIReference(docs: ParsedDocumentation[]): APIReference {
    // Collect all symbols
    const allSymbols = docs.flatMap(d => d.symbols);

    // Filter symbols based on options
    const filteredSymbols = this.filterSymbols(allSymbols);

    // Group by category if enabled
    const categories = this.options.groupByCategory
      ? this.groupSymbolsByCategory(filteredSymbols)
      : [];

    return {
      title: this.options.projectName || 'API Reference',
      description: this.options.description,
      symbols: filteredSymbols,
      categories,
    };
  }

  /**
   * Generate API documentation in specified format
   *
   * @param apiRef - API reference
   * @param format - Output format
   * @returns Formatted documentation
   */
  generateDocumentation(apiRef: APIReference, format: DocFormat): string {
    switch (format) {
      case 'markdown':
        return this.generateMarkdown(apiRef);
      case 'html':
        return this.generateHTML(apiRef);
      case 'json':
        return this.generateJSON(apiRef);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate Markdown documentation
   *
   * @private
   */
  private generateMarkdown(apiRef: APIReference): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${apiRef.title}`);
    lines.push('');

    // Description
    if (apiRef.description) {
      lines.push(apiRef.description);
      lines.push('');
    }

    // Table of Contents
    if (this.options.includeTOC) {
      lines.push('## Table of Contents');
      lines.push('');
      this.generateMarkdownTOC(lines, apiRef);
      lines.push('');
    }

    // Grouped by category or kind
    if (apiRef.categories.length > 0) {
      for (const category of apiRef.categories) {
        this.generateMarkdownCategory(lines, category);
      }
    } else {
      // Group by kind
      const byKind = this.groupSymbolsByKind(apiRef.symbols);
      for (const [kind, symbols] of Object.entries(byKind)) {
        this.generateMarkdownKindSection(lines, kind as SymbolKind, symbols);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate table of contents
   *
   * @private
   */
  private generateMarkdownTOC(lines: string[], apiRef: APIReference): void {
    if (apiRef.categories.length > 0) {
      for (const category of apiRef.categories) {
        lines.push(`- [${category.name}](#${this.slugify(category.name)})`);
        for (const symbol of category.symbols) {
          lines.push(`  - [${symbol.name}](#${this.slugify(symbol.name)})`);
        }
      }
    } else {
      const byKind = this.groupSymbolsByKind(apiRef.symbols);
      for (const [kind] of Object.entries(byKind)) {
        lines.push(`- [${this.capitalize(kind)}](#${this.slugify(kind)})`);
      }
    }
  }

  /**
   * Generate category section
   *
   * @private
   */
  private generateMarkdownCategory(lines: string[], category: { name: string; symbols: DocSymbol[] }): void {
    lines.push(`## ${category.name}`);
    lines.push('');

    for (const symbol of category.symbols) {
      this.generateMarkdownSymbol(lines, symbol);
      lines.push('');
    }
  }

  /**
   * Generate kind section
   *
   * @private
   */
  private generateMarkdownKindSection(lines: string[], kind: SymbolKind, symbols: DocSymbol[]): void {
    lines.push(`## ${this.capitalize(kind)}s`);
    lines.push('');

    for (const symbol of symbols) {
      this.generateMarkdownSymbol(lines, symbol);
      lines.push('');
    }
  }

  /**
   * Generate symbol documentation
   *
   * @private
   */
  private generateMarkdownSymbol(lines: string[], symbol: DocSymbol): void {
    // Header with anchor
    const kindIcon = this.getKindIcon(symbol.kind);
    lines.push(`### ${kindIcon} ${symbol.name}`);
    lines.push('');

    // Badges
    const badges: string[] = [];
    if (symbol.deprecated) badges.push('Deprecated');
    if (symbol.exported) badges.push('Exported');
    if (symbol.static) badges.push('Static');
    if (symbol.abstract) badges.push('Abstract');
    if (symbol.access !== 'public') badges.push(this.capitalize(symbol.access));

    if (badges.length > 0) {
      lines.push(badges.map(b => `\`${b}\``).join(' · '));
      lines.push('');
    }

    // Description
    if (symbol.summary) {
      lines.push(symbol.summary);
      lines.push('');
    }

    if (symbol.description && symbol.description !== symbol.summary) {
      lines.push(symbol.description);
      lines.push('');
    }

    // Signature
    if (symbol.signature) {
      lines.push('```typescript');
      lines.push(symbol.signature);
      lines.push('```');
      lines.push('');
    }

    // Type parameters
    if (symbol.typeParameters && symbol.typeParameters.length > 0) {
      lines.push('#### Type Parameters');
      lines.push('');
      lines.push('| Name | Constraint | Default |');
      lines.push('|------|------------|---------|');
      for (const tp of symbol.typeParameters) {
        lines.push(`| ${tp.name} | ${tp.constraint || '-'} | ${tp.default || '-'} |`);
      }
      lines.push('');
    }

    // Parameters
    if (symbol.parameters && symbol.parameters.length > 0) {
      lines.push('#### Parameters');
      lines.push('');
      lines.push('| Name | Type | Optional | Default | Description |');
      lines.push('|------|------|----------|---------|-------------|');
      for (const param of symbol.parameters) {
        lines.push(
          `| ${param.name}${param.rest ? '...' : ''} | \`${param.type}\` | ${param.optional ? 'Yes' : 'No'} | ${param.defaultValue ?? '-'} | ${param.description || '-'} |`
        );
      }
      lines.push('');
    }

    // Return type
    if (symbol.returnType) {
      lines.push(`**Returns:** \`${symbol.returnType}\``);
      lines.push('');
    }

    // Examples
    if (symbol.examples && symbol.examples.length > 0 && this.options.includeExamples) {
      lines.push('#### Examples');
      lines.push('');
      for (const example of symbol.examples) {
        lines.push('```typescript');
        lines.push(example.trim());
        lines.push('```');
        lines.push('');
      }
    }

    // Version info
    if (symbol.since || symbol.version) {
      const versionInfo = [];
      if (symbol.since) versionInfo.push(`Since: ${symbol.since}`);
      if (symbol.version) versionInfo.push(`Version: ${symbol.version}`);
      lines.push(`*${versionInfo.join(' · ')}*`);
      lines.push('');
    }

    // Source reference
    lines.push(`*Defined in ${symbol.filePath}:${symbol.startLine}*`);
  }

  /**
   * Generate HTML documentation
   *
   * @private
   */
  private generateHTML(apiRef: APIReference): string {
    const symbolsHTML = apiRef.categories.length > 0
      ? apiRef.categories.map(cat => this.generateHTMLCategory(cat)).join('\n')
      : Object.entries(this.groupSymbolsByKind(apiRef.symbols))
          .map(([kind, symbols]) => this.generateHTMLKindSection(kind as SymbolKind, symbols))
          .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${apiRef.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 1rem; margin-bottom: 2rem; }
    .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .header p { color: #666; font-size: 1.1rem; }
    .toc {
      background: #f5f5f5;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    .toc h2 { margin-bottom: 1rem; font-size: 1.5rem; }
    .toc ul { list-style: none; }
    .toc li a { color: #0066cc; text-decoration: none; }
    .toc li a:hover { text-decoration: underline; }
    .section { margin-bottom: 3rem; }
    .section h2 {
      font-size: 2rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e0e0e0;
    }
    .symbol { margin-bottom: 2rem; padding: 1rem; background: #fafafa; border-radius: 8px; }
    .symbol-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .symbol-kind {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
      text-transform: uppercase;
    }
    .symbol-kind.function { background: #e3f2fd; color: #1976d2; }
    .symbol-kind.class { background: #f3e5f5; color: #7b1fa2; }
    .symbol-kind.interface { background: #e8f5e9; color: #388e3c; }
    .symbol-kind.type { background: #fff3e0; color: #f57c00; }
    .symbol-name { font-size: 1.5rem; font-weight: 600; }
    .symbol-badges { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
    .badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      background: #e0e0e0;
    }
    .badge.deprecated { background: #ffebee; color: #c62828; }
    .signature {
      background: #263238;
      color: #aed581;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      margin: 1rem 0;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
    }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #f5f5f5; font-weight: 600; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
    .description { color: #666; margin-bottom: 1rem; }
    .meta { color: #999; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${apiRef.title}</h1>
    ${apiRef.description ? `<p>${apiRef.description}</p>` : ''}
  </div>

  ${this.options.includeTOC ? this.generateHTMLTOC(apiRef) : ''}

  <div class="content">
    ${symbolsHTML}
  </div>
</body>
</html>`;
  }

  /**
   * Generate HTML table of contents
   *
   * @private
   */
  private generateHTMLTOC(apiRef: APIReference): string {
    const items = apiRef.categories.length > 0
      ? apiRef.categories.map(cat => `
        <li>
          <strong>${cat.name}</strong>
          <ul>
            ${cat.symbols.map(sym => `<li><a href="#${sym.id}">${sym.name}</a></li>`).join('')}
          </ul>
        </li>`).join('')
      : Object.keys(this.groupSymbolsByKind(apiRef.symbols))
          .map(kind => `<li><a href="#${kind}">${this.capitalize(kind)}s</a></li>`)
          .join('');

    return `
  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>${items}</ul>
  </div>`;
  }

  /**
   * Generate HTML category section
   *
   * @private
   */
  private generateHTMLCategory(category: { name: string; symbols: DocSymbol[] }): string {
    return `
    <div class="section">
      <h2 id="${this.slugify(category.name)}">${category.name}</h2>
      ${category.symbols.map(sym => this.generateHTMLSymbol(sym)).join('')}
    </div>`;
  }

  /**
   * Generate HTML kind section
   *
   * @private
   */
  private generateHTMLKindSection(kind: SymbolKind, symbols: DocSymbol[]): string {
    return `
    <div class="section">
      <h2 id="${kind}">${this.capitalize(kind)}s</h2>
      ${symbols.map(sym => this.generateHTMLSymbol(sym)).join('')}
    </div>`;
  }

  /**
   * Generate HTML for a symbol
   *
   * @private
   */
  private generateHTMLSymbol(symbol: DocSymbol): string {
    const badges = [
      symbol.deprecated ? '<span class="badge deprecated">Deprecated</span>' : '',
      symbol.exported ? '<span class="badge">Exported</span>' : '',
      symbol.static ? '<span class="badge">Static</span>' : '',
      symbol.access !== 'public' ? `<span class="badge">${this.capitalize(symbol.access)}</span>` : '',
    ].filter(Boolean).join(' ');

    const typeParams = symbol.typeParameters && symbol.typeParameters.length > 0
      ? `
      <h4>Type Parameters</h4>
      <table>
        <thead><tr><th>Name</th><th>Constraint</th><th>Default</th></tr></thead>
        <tbody>
          ${symbol.typeParameters.map(tp => `
            <tr>
              <td><code>${tp.name}</code></td>
              <td>${tp.constraint ? `<code>${tp.constraint}</code>` : '-'}</td>
              <td>${tp.default ? `<code>${tp.default}</code>` : '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
      : '';

    const parameters = symbol.parameters && symbol.parameters.length > 0
      ? `
      <h4>Parameters</h4>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Optional</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${symbol.parameters.map(param => `
            <tr>
              <td><code>${param.name}${param.rest ? '...' : ''}</code></td>
              <td><code>${param.type}</code></td>
              <td>${param.optional ? 'Yes' : 'No'}</td>
              <td>${param.defaultValue ? `<code>${param.defaultValue}</code>` : '-'}</td>
              <td>${param.description || '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
      : '';

    const examples = symbol.examples && symbol.examples.length > 0 && this.options.includeExamples
      ? `
      <h4>Examples</h4>
      ${symbol.examples.map(ex => `<div class="signature">${this.escapeHTML(ex.trim())}</div>`).join('')}`
      : '';

    return `
      <div class="symbol" id="${symbol.id}">
        <div class="symbol-header">
          <span class="symbol-kind ${symbol.kind}">${symbol.kind}</span>
          <span class="symbol-name">${symbol.name}</span>
        </div>
        ${badges ? `<div class="symbol-badges">${badges}</div>` : ''}
        ${symbol.summary ? `<p class="description">${this.escapeHTML(symbol.summary)}</p>` : ''}
        ${symbol.signature ? `<div class="signature">${this.escapeHTML(symbol.signature)}</div>` : ''}
        ${symbol.returnType ? `<p><strong>Returns:</strong> <code>${symbol.returnType}</code></p>` : ''}
        ${typeParams}
        ${parameters}
        ${examples}
        ${symbol.since || symbol.version ? `<p class="meta">${symbol.since ? `Since: ${symbol.since}` : ''} ${symbol.version ? `Version: ${symbol.version}` : ''}</p>` : ''}
        <p class="meta">Defined in ${symbol.filePath}:${symbol.startLine}</p>
      </div>`;
  }

  /**
   * Generate JSON documentation
   *
   * @private
   */
  private generateJSON(apiRef: APIReference): string {
    return JSON.stringify(apiRef, null, 2);
  }

  /**
   * Filter symbols based on options
   *
   * @private
   */
  private filterSymbols(symbols: DocSymbol[]): DocSymbol[] {
    return symbols.filter(s => s.exported || s.access === 'public');
  }

  /**
   * Group symbols by category
   *
   * @private
   */
  private groupSymbolsByCategory(symbols: DocSymbol[]): Array<{ name: string; symbols: DocSymbol[] }> {
    const groups = new Map<string, DocSymbol[]>();

    for (const symbol of symbols) {
      const category = this.getCategoryForSymbol(symbol);
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(symbol);
    }

    return Array.from(groups.entries()).map(([name, symbols]) => ({ name, symbols }));
  }

  /**
   * Get category for a symbol
   *
   * @private
   */
  private getCategoryForSymbol(symbol: DocSymbol): string {
    // Extract from file path
    const pathParts = symbol.filePath.split('/');
    const srcIndex = pathParts.indexOf('src');
    if (srcIndex >= 0 && srcIndex < pathParts.length - 1) {
      return this.capitalize(pathParts[srcIndex + 1]);
    }

    return symbol.kind === 'class' || symbol.kind === 'interface' ? 'Classes & Interfaces' : 'Functions';
  }

  /**
   * Group symbols by kind
   *
   * @private
   */
  private groupSymbolsByKind(symbols: DocSymbol[]): Record<SymbolKind, DocSymbol[]> {
    const groups: Record<string, DocSymbol[]> = {};

    for (const symbol of symbols) {
      if (!groups[symbol.kind]) {
        groups[symbol.kind] = [];
      }
      groups[symbol.kind].push(symbol);
    }

    return groups as Record<SymbolKind, DocSymbol[]>;
  }

  /**
   * Get icon for symbol kind
   *
   * @private
   */
  private getKindIcon(kind: SymbolKind): string {
    const icons: Record<SymbolKind, string> = {
      function: 'ƒ',
      class: '📦',
      interface: '📋',
      type: '🔷',
      enum: '📝',
      constant: '🔒',
      variable: '📊',
      method: '⚙',
      property: '🔧',
      namespace: '📁',
      module: '📦',
    };
    return icons[kind] || '•';
  }

  /**
   * Slugify a string
   *
   * @private
   */
  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Capitalize a string
   *
   * @private
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Escape HTML
   *
   * @private
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

/**
 * Create an API doc generator instance
 */
export function createAPIDocGenerator(options?: DocGeneratorOptions): APIDocGenerator {
  return new APIDocGenerator(options);
}
