/**
 * README Generator
 *
 * Generates comprehensive README.md files from codebase analysis.
 * Includes overview, features, installation, usage, API docs, architecture,
 * examples, and more.
 */

import type {
  ParsedDocumentation,
  DocSymbol,
  Tutorial,
  ArchitectureDiagram,
  DocGeneratorOptions,
} from './types';

/**
 * README Generator
 */
export class ReadmeGenerator {
  private options: DocGeneratorOptions;

  constructor(options: DocGeneratorOptions = {}) {
    this.options = {
      format: ['markdown'],
      includeTOC: true,
      includeTypes: true,
      includeExamples: true,
      includeDiagrams: true,
      ...options,
    };
  }

  /**
   * Generate README from parsed documentation
   *
   * @param docs - Parsed documentation
   * @param diagram - Optional architecture diagram
   * @returns README markdown content
   */
  generateReadme(docs: ParsedDocumentation[], diagram?: ArchitectureDiagram): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${this.options.projectName || 'Project'}`);
    lines.push('');

    // Badges
    this.generateBadges(lines, docs);

    // Description
    if (this.options.description) {
      lines.push(this.options.description);
      lines.push('');
    }

    // Table of Contents
    if (this.options.includeTOC) {
      this.generateTOC(lines);
    }

    // Overview
    this.generateOverview(lines, docs);

    // Features
    this.generateFeatures(lines, docs);

    // Installation
    this.generateInstallation(lines);

    // Quick Start
    this.generateQuickStart(lines, docs);

    // Usage
    this.generateUsage(lines, docs);

    // API Reference
    this.generateAPIReference(lines, docs);

    // Architecture
    if (this.options.includeDiagrams && diagram) {
      this.generateArchitecture(lines, diagram);
    }

    // Examples
    if (this.options.includeExamples) {
      this.generateExamples(lines, docs);
    }

    // Configuration
    this.generateConfiguration(lines, docs);

    // Contributing
    this.generateContributing(lines);

    // License
    if (this.options.license) {
      this.generateLicense(lines);
    }

    return lines.join('\n');
  }

  /**
   * Generate badges
   *
   * @private
   */
  private generateBadges(lines: string[], docs: ParsedDocumentation[]): void {
    const badges: string[] = [];

    // Version badge
    if (this.options.version) {
      badges.push(`![version](https://img.shields.io/badge/version-${this.options.version}-blue.svg)`);
    }

    // License badge
    if (this.options.license) {
      badges.push(`![license](https://img.shields.io/badge/license-${this.options.license}-green.svg)`);
    }

    // Build badge
    if (this.options.repository) {
      badges.push(`![build](https://img.shields.io/github/actions/workflow/status/${this.options.repository}/build.yml)`);
    }

    // Coverage badge
    const stats = this.calculateStats(docs);
    if (stats.coverage > 0) {
      badges.push(`![docs](https://img.shields.io/badge/docs-${stats.coverage.toFixed(0)}%25-brightgreen.svg)`);
    }

    if (badges.length > 0) {
      lines.push(badges.join(' '));
      lines.push('');
    }
  }

  /**
   * Generate table of contents
   *
   * @private
   */
  private generateTOC(lines: string[]): void {
    lines.push('## Table of Contents');
    lines.push('');
    lines.push('- [Overview](#overview)');
    lines.push('- [Features](#features)');
    lines.push('- [Installation](#installation)');
    lines.push('- [Quick Start](#quick-start)');
    lines.push('- [Usage](#usage)');
    lines.push('- [API Reference](#api-reference)');
    lines.push('- [Architecture](#architecture)');
    lines.push('- [Examples](#examples)');
    lines.push('- [Configuration](#configuration)');
    lines.push('- [Contributing](#contributing)');
    if (this.options.license) {
      lines.push('- [License](#license)');
    }
    lines.push('');
  }

  /**
   * Generate overview section
   *
   * @private
   */
  private generateOverview(lines: string[], docs: ParsedDocumentation[]): void {
    lines.push('## Overview');
    lines.push('');

    const stats = this.calculateStats(docs);

    lines.push(`${this.options.projectName || 'This project'} is a`);
    lines.push(
      `${Object.keys(stats.languages).length} language codebase with `
    );
    lines.push(
      `${stats.totalSymbols} documented symbols across ${stats.totalFiles} files.`
    );
    lines.push('');
  }

  /**
   * Generate features section
   *
   * @private
   */
  private generateFeatures(lines: string[], docs: ParsedDocumentation[]): void {
    lines.push('## Features');
    lines.push('');

    const features = this.extractFeatures(docs);
    if (features.length > 0) {
      for (const feature of features) {
        lines.push(`- ${feature}`);
      }
    } else {
      lines.push('- Add your features here');
    }

    lines.push('');
  }

  /**
   * Generate installation section
   *
   * @private
   */
  private generateInstallation(lines: string[]): void {
    lines.push('## Installation');
    lines.push('');

    lines.push('Install the package:');
    lines.push('');
    lines.push('```bash');
    lines.push(`npm install ${this.options.projectName || '@claudeflare/edge'}`);
    lines.push('```');
    lines.push('');
  }

  /**
   * Generate quick start section
   *
   * @private
   */
  private generateQuickStart(lines: string[], docs: ParsedDocumentation[]): void {
    lines.push('## Quick Start');
    lines.push('');

    // Find main export or entry point
    const mainExports = this.findMainExports(docs);

    if (mainExports.length > 0) {
      lines.push('```typescript');
      lines.push(`import { ${mainExports.slice(0, 3).join(', ')} } from '${this.options.projectName || '@claudeflare/edge'}';`);
      lines.push('');
      lines.push('// Your code here');
      lines.push('```');
      lines.push('');
    }
  }

  /**
   * Generate usage section
   *
   * @private
   */
  private generateUsage(lines: string[], docs: ParsedDocumentation[]): void {
    lines.push('## Usage');
    lines.push('');

    // Find examples from docstrings
    const examples = this.findExamples(docs);

    if (examples.length > 0) {
      for (const example of examples.slice(0, 3)) {
        lines.push('### ' + example.title);
        lines.push('');
        lines.push(example.description);
        lines.push('');
        lines.push('```typescript');
        lines.push(example.code);
        lines.push('```');
        lines.push('');
      }
    } else {
      lines.push('Add usage examples here.');
      lines.push('');
    }
  }

  /**
   * Generate API reference section
   *
   * @private
   */
  private generateAPIReference(lines: string[], docs: ParsedDocumentation[]): void {
    lines.push('## API Reference');
    lines.push('');

    // Group symbols by category
    const categories = this.groupSymbolsByCategory(docs);

    for (const [category, symbols] of Object.entries(categories)) {
      lines.push(`### ${category}`);
      lines.push('');

      for (const symbol of symbols.slice(0, 10)) {
        lines.push(`#### \`${symbol.name}\``);
        lines.push('');

        if (symbol.summary) {
          lines.push(symbol.summary);
          lines.push('');
        }

        if (symbol.signature) {
          lines.push('```typescript');
          lines.push(symbol.signature);
          lines.push('```');
          lines.push('');
        }
      }

      if (symbols.length > 10) {
        lines.push(`*... and ${symbols.length - 10} more*`);
        lines.push('');
      }
    }
  }

  /**
   * Generate architecture section
   *
   * @private
   */
  private generateArchitecture(lines: string[], diagram: ArchitectureDiagram): void {
    lines.push('## Architecture');
    lines.push('');

    if (diagram.description) {
      lines.push(diagram.description);
      lines.push('');
    }

    lines.push('```mermaid');
    lines.push(this.generateMermaidFromDiagram(diagram));
    lines.push('```');
    lines.push('');
  }

  /**
   * Generate examples section
   *
   * @private
   */
  private generateExamples(lines: string[], docs: ParsedDocumentation[]): void {
    lines.push('## Examples');
    lines.push('');

    // Find all examples
    const examples = this.findExamples(docs);

    for (const example of examples) {
      lines.push(`### ${example.title}`);
      lines.push('');
      lines.push(example.description);
      lines.push('');
      lines.push('```typescript');
      lines.push(example.code);
      lines.push('```');
      lines.push('');
    }
  }

  /**
   * Generate configuration section
   *
   * @private
   */
  private generateConfiguration(lines: string[], docs: ParsedDocumentation[]): void {
    lines.push('## Configuration');
    lines.push('');

    // Find configuration types
    const configTypes = this.findConfigurationTypes(docs);

    if (configTypes.length > 0) {
      for (const config of configTypes) {
        lines.push(`### ${config.name}`);
        lines.push('');
        if (config.description) {
          lines.push(config.description);
          lines.push('');
        }
        lines.push('```typescript');
        lines.push(config.code);
        lines.push('```');
        lines.push('');
      }
    } else {
      lines.push('Add configuration options here.');
      lines.push('');
    }
  }

  /**
   * Generate contributing section
   *
   * @private
   */
  private generateContributing(lines: string[]): void {
    lines.push('## Contributing');
    lines.push('');
    lines.push('Contributions are welcome! Please follow these steps:');
    lines.push('');
    lines.push('1. Fork the repository');
    lines.push('2. Create your feature branch (`git checkout -b feature/amazing-feature`)');
    lines.push('3. Commit your changes (`git commit -m \'Add some amazing feature\`)');
    lines.push('4. Push to the branch (`git push origin feature/amazing-feature`)');
    lines.push('5. Open a Pull Request');
    lines.push('');
  }

  /**
   * Generate license section
   *
   * @private
   */
  private generateLicense(lines: string[]): void {
    lines.push('## License');
    lines.push('');
    lines.push(`This project is licensed under the ${this.options.license} License.`);
    lines.push('');
  }

  /**
   * Calculate statistics from documentation
   *
   * @private
   */
  private calculateStats(docs: ParsedDocumentation[]) {
    const stats = {
      totalFiles: docs.length,
      totalSymbols: 0,
      languages: {} as Record<string, number>,
      coverage: 0,
      documented: 0,
    };

    for (const doc of docs) {
      stats.totalSymbols += doc.symbols.length;
      stats.documented += doc.stats.documented;
      stats.languages[doc.language] = (stats.languages[doc.language] || 0) + 1;
    }

    stats.coverage = stats.totalSymbols > 0
      ? (stats.documented / stats.totalSymbols) * 100
      : 0;

    return stats;
  }

  /**
   * Extract features from documentation
   *
   * @private
   */
  private extractFeatures(docs: ParsedDocumentation[]): string[] {
    const features: string[] = [];

    // Look for @feature or similar tags
    for (const doc of docs) {
      for (const symbol of doc.symbols) {
        const featureTag = symbol.tags?.find(t => t.name === 'feature');
        if (featureTag) {
          features.push(featureTag.value);
        }

        // Also look for TODO/FIXME comments as potential features
        if (symbol.description) {
          const todoMatches = symbol.description.match(/@todo\s+(.+)/gi);
          if (todoMatches) {
            features.push(...todoMatches.map(m => m.replace(/@todo\s+/gi, '')));
          }
        }
      }
    }

    return features;
  }

  /**
   * Find main exports
   *
   * @private
   */
  private findMainExports(docs: ParsedDocumentation[]): string[] {
    const exports: string[] = [];

    for (const doc of docs) {
      for (const exp of doc.exports) {
        if (exp.type === 'function' || exp.type === 'class') {
          exports.push(exp.name);
        }
      }
    }

    return exports.slice(0, 10);
  }

  /**
   * Find examples from docstrings
   *
   * @private
   */
  private findExamples(docs: ParsedDocumentation[]): Array<{ title: string; description: string; code: string }> {
    const examples: Array<{ title: string; description: string; code: string }> = [];

    for (const doc of docs) {
      for (const symbol of doc.symbols) {
        if (symbol.examples && symbol.examples.length > 0) {
          for (const example of symbol.examples) {
            examples.push({
              title: symbol.name,
              description: symbol.summary || '',
              code: example,
            });
          }
        }
      }
    }

    return examples;
  }

  /**
   * Find configuration types
   *
   * @private
   */
  private findConfigurationTypes(docs: ParsedDocumentation[]): Array<{ name: string; description?: string; code: string }> {
    const configs: Array<{ name: string; description?: string; code: string }> = [];

    for (const doc of docs) {
      for (const symbol of doc.symbols) {
        if (symbol.name.toLowerCase().includes('config') || symbol.name.toLowerCase().includes('options')) {
          configs.push({
            name: symbol.name,
            description: symbol.description,
            code: symbol.signature || symbol.code || '',
          });
        }
      }
    }

    return configs;
  }

  /**
   * Group symbols by category
   *
   * @private
   */
  private groupSymbolsByCategory(docs: ParsedDocumentation[]): Record<string, DocSymbol[]> {
    const groups: Record<string, DocSymbol[]> = {};

    for (const doc of docs) {
      const category = this.getCategoryFromPath(doc.filePath);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(...doc.symbols);
    }

    return groups;
  }

  /**
   * Get category from file path
   *
   * @private
   */
  private getCategoryFromPath(filePath: string): string {
    const parts = filePath.split('/');
    const srcIndex = parts.indexOf('src');

    if (srcIndex >= 0 && srcIndex < parts.length - 1) {
      return parts[srcIndex + 1].charAt(0).toUpperCase() + parts[srcIndex + 1].slice(1);
    }

    return 'General';
  }

  /**
   * Generate Mermaid from diagram
   *
   * @private
   */
  private generateMermaidFromDiagram(diagram: ArchitectureDiagram): string {
    const lines: string[] = ['graph TD'];

    for (const node of diagram.nodes) {
      lines.push(`  ${node.id}[${node.label}]`);
    }

    for (const edge of diagram.edges) {
      lines.push(`  ${edge.from} --> ${edge.to}`);
    }

    return lines.join('\n');
  }
}

/**
 * Create a README generator instance
 */
export function createReadmeGenerator(options?: DocGeneratorOptions): ReadmeGenerator {
  return new ReadmeGenerator(options);
}

/**
 * Default README generator instance
 */
export const defaultReadmeGenerator = new ReadmeGenerator();
