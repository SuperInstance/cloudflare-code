/**
 * Markdown Template
 *
 * Template for generating Markdown documentation
 */

import type { TemplateContext } from '../types';

/**
 * Render Markdown template
 */
export function renderMarkdownTemplate(context: TemplateContext): string {
  const {
    projectName,
    version,
    description,
    repository,
    homepage,
    author,
    license,
    generatedAt,
    apiReference,
    symbols,
    categories,
    diagrams,
    tutorials,
    changelog,
    stats,
    custom,
  } = context;

  const lines: string[] = [];

  // Header
  lines.push(`# ${projectName}`);
  lines.push('');

  // Badges
  lines.push(`[![version](https://img.shields.io/badge/version-${version}-blue.svg)]`);
  lines.push(`[![license](https://img.shields.io/badge/license-${license}-green.svg)]`);
  lines.push('');

  // Description
  if (description) {
    lines.push(description);
    lines.push('');
  }

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('- [Installation](#installation)');
  lines.push('- [Quick Start](#quick-start)');
  lines.push('- [API Reference](#api-reference)');
  if (diagrams.length > 0) {
    lines.push('- [Architecture](#architecture)');
  }
  if (tutorials.length > 0) {
    lines.push('- [Tutorials](#tutorials)');
  }
  if (changelog.length > 0) {
    lines.push('- [Changelog](#changelog)');
  }
  lines.push('');

  // Installation
  lines.push('## Installation');
  lines.push('');
  lines.push('```bash');
  lines.push(`npm install ${projectName}`);
  lines.push('```');
  lines.push('');

  // Quick Start
  lines.push('## Quick Start');
  lines.push('');
  const quickStartSymbols = symbols.filter(s => s.exported && s.kind === 'function').slice(0, 3);
  if (quickStartSymbols.length > 0) {
    lines.push('```typescript');
    lines.push(`import { ${quickStartSymbols.map(s => s.name).join(', ')} } from '${projectName}'`);
    lines.push('');
    lines.push('// Your code here');
    lines.push('```');
    lines.push('');
  }

  // API Reference
  lines.push('## API Reference');
  lines.push('');

  for (const [categoryName, categorySymbols] of Object.entries(categories)) {
    lines.push(`### ${categoryName}`);
    lines.push('');

    for (const symbol of categorySymbols.slice(0, 10)) {
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

      if (symbol.parameters && symbol.parameters.length > 0) {
        lines.push('| Name | Type | Optional | Description |');
        lines.push('|------|------|----------|-------------|');
        for (const param of symbol.parameters) {
          lines.push(`| ${param.name} | \`${param.type}\` | ${param.optional ? 'Yes' : 'No'} | ${param.description || '-'} |`);
        }
        lines.push('');
      }
    }
  }

  // Architecture
  if (diagrams.length > 0) {
    lines.push('## Architecture');
    lines.push('');

    for (const diagram of diagrams) {
      if (diagram.description) {
        lines.push(diagram.description);
        lines.push('');
      }

      lines.push('```mermaid');
      lines.push('graph TD');
      for (const node of diagram.nodes) {
        lines.push(`  ${node.id}[${node.label}]`);
      }
      for (const edge of diagram.edges) {
        lines.push(`  ${edge.from} --> ${edge.to}`);
      }
      lines.push('```');
      lines.push('');
    }
  }

  // Tutorials
  if (tutorials.length > 0) {
    lines.push('## Tutorials');
    lines.push('');

    for (const tutorial of tutorials) {
      lines.push(`### ${tutorial.title}`);
      lines.push('');
      lines.push(`**Difficulty:** ${tutorial.difficulty}`);
      lines.push('');
      lines.push(`**Duration:** ${tutorial.duration} minutes`);
      lines.push('');
      lines.push(tutorial.description);
      lines.push('');

      for (const step of tutorial.steps) {
        lines.push(`#### ${step.title}`);
        lines.push('');
        lines.push(step.description);
        lines.push('');

        if (step.code) {
          lines.push('```typescript');
          lines.push(step.code);
          lines.push('```');
          lines.push('');
        }
      }
    }
  }

  // Changelog
  if (changelog.length > 0) {
    lines.push('## Changelog');
    lines.push('');

    for (const entry of changelog.slice(0, 5)) {
      lines.push(`### ${entry.version}`);
      lines.push('');
      lines.push(`*${entry.date}*`);
      lines.push('');

      for (const change of entry.changes) {
        const icon = {
          added: '✨',
          changed: '🔄',
          deprecated: '⚠️',
          removed: '🗑️',
          fixed: '🐛',
          security: '🔒',
        }[change.type];

        lines.push(`- ${icon} **${change.type}:** ${change.description}`);
      }
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated on ${new Date(generatedAt).toISOString()}*`);
  lines.push('');
  lines.push(`*Total symbols: ${stats.totalSymbols} | Files: ${stats.totalFiles} | Coverage: ${stats.coverage.toFixed(1)}%*`);

  return lines.join('\n');
}
