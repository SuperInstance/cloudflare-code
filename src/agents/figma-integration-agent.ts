/**
 * Figma Integration Agent
 *
 * Specialized agent for integrating with Figma design system,
    extracting design tokens, and implementing professional UI
*/

import type {
  FigmaFile,
  FigmaNode,
  DesignToken,
  ComponentDefinition
} from '../types';

export interface FigmaExportConfig {
  includeAssets: boolean;
  includeComponents: boolean;
  includeStyles: boolean;
  includeColors: boolean;
  includeTypography: boolean;
  includeLayout: boolean;
  exportFormat: 'css' | 'scss' | 'js' | 'json' | 'tokens';
  responsiveSuffixes: string[];
}

export interface ComponentImport {
  id: string;
  name: string;
  type: 'component' | 'variant' | 'instance';
  properties: Record<string, any>;
  styles: Record<string, string>;
  responsive: Record<string, any>;
  accessibility: Record<string, any>;
}

export class FigmaIntegrationAgent {
  private figmaAccessToken: string;
  private exportedComponents: Map<string, ComponentImport>;
  private designTokens: Map<string, DesignToken>;
  private figmaFiles: Map<string, FigmaFile>;

  constructor(figmaAccessToken: string) {
    this.figmaAccessToken = figmaAccessToken;
    this.exportedComponents = new Map();
    this.designTokens = new Map();
    this.figmaFiles = new Map();
  }

  /**
   * Connect to Figma and fetch file
   */
  async connectToFigma(fileId: string): Promise<FigmaFile> {
    try {
      const response = await fetch(`https://api.figma.com/v1/files/${fileId}`, {
        headers: {
          'X-Figma-Token': this.figmaAccessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
      }

      const figmaFile: FigmaFile = await response.json();
      this.figmaFiles.set(fileId, figmaFile);

      return figmaFile;
    } catch (error) {
      throw new Error(`Failed to connect to Figma: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract design tokens from Figma
   */
  async extractDesignTokens(fileId: string): Promise<DesignToken[]> {
    const figmaFile = this.figmaFiles.get(fileId);
    if (!figmaFile) {
      throw new Error('Figma file not loaded. Please connect first.');
    }

    const tokens: DesignToken[] = [];

    // Extract color tokens from styles
    const colorStyles = this.extractColorStyles(figmaFile);
    tokens.push(...colorStyles);

    // Extract typography tokens
    const typographyStyles = this.extractTypographyStyles(figmaFile);
    tokens.push(...typographyStyles);

    // Extract spacing tokens
    const spacingStyles = this.extractSpacingStyles(figmaFile);
    tokens.push(...spacingStyles);

    // Extract dimension tokens
    const dimensionStyles = this.extractDimensionStyles(figmaFile);
    tokens.push(...dimensionStyles);

    // Extract border tokens
    const borderStyles = this.extractBorderStyles(figmaFile);
    tokens.push(...borderStyles);

    // Extract shadow tokens
    const shadowStyles = this.extractShadowStyles(figmaFile);
    tokens.push(...shadowStyles);

    // Store extracted tokens
    tokens.forEach(token => this.designTokens.set(token.name, token));

    return tokens;
  }

  /**
   * Extract color styles from Figma
   */
  private extractColorStyles(figmaFile: FigmaFile): DesignToken[] {
    const tokens: DesignToken[] = [];
    const styles = figmaFile.document?.styles || {};

    Object.entries(styles).forEach(([styleId, style]) => {
      if (style.type === 'FILL' && style.fills) {
        const fill = style.fills[0];
        if (fill.type === 'SOLID') {
          const color = fill.color;
          const hex = this.rgbToHex(color.r, color.g, color.b);
          const opacity = fill.opacity || 1;

          tokens.push({
            name: `color-${style.name.toLowerCase().replace(/\s+/g, '-')}`,
            value: hex,
            type: 'color',
            category: 'color',
            description: `Color style: ${style.name}`,
            responsive: {}
          });
        }
      }
    });

    return tokens;
  }

  /**
   * Extract typography styles from Figma
   */
  private extractTypographyStyles(figmaFile: FigmaFile): DesignToken[] {
    const tokens: DesignToken[] = [];
    const styles = figmaFile.document?.styles || {};

    Object.entries(styles).forEach(([styleId, style]) => {
      if (style.type === 'TEXT') {
        const typography = style.style || {};

        tokens.push({
          name: `font-size-${style.name.toLowerCase().replace(/\s+/g, '-')}`,
          value: `${typography.fontSize || 16}px`,
          type: 'typography',
          category: 'typography',
          description: `Font size: ${style.name}`,
          responsive: {}
        });

        if (typography.fontWeight) {
          tokens.push({
            name: `font-weight-${style.name.toLowerCase().replace(/\s+/g, '-')}`,
            value: typography.fontWeight.toString(),
            type: 'typography',
            category: 'typography',
            description: `Font weight: ${style.name}`,
            responsive: {}
          });
        }

        if (typography.letterSpacing) {
          tokens.push({
            name: `letter-spacing-${style.name.toLowerCase().replace(/\s+/g, '-')}`,
            value: `${typography.letterSpacing}px`,
            type: 'typography',
            category: 'typography',
            description: `Letter spacing: ${style.name}`,
            responsive: {}
          });
        }

        if (typography.lineHeight) {
          tokens.push({
            name: `line-height-${style.name.toLowerCase().replace(/\s+/g, '-')}`,
            value: `${typography.lineHeight}px`,
            type: 'typography',
            category: 'typography',
            description: `Line height: ${style.name}`,
            responsive: {}
          });
        }
      }
    });

    return tokens;
  }

  /**
   * Extract spacing styles from Figma
   */
  private extractSpacingStyles(figmaFile: FigmaFile): DesignToken[] {
    const tokens: DesignToken[] = [];
    const styles = figmaFile.document?.styles || {};

    Object.entries(styles).forEach(([styleId, style]) => {
      if (style.name.includes('spacing') || style.name.includes('padding') || style.name.includes('margin')) {
        const numericValue = parseInt(style.name.match(/\d+/)?.[0] || '0');

        tokens.push({
          name: `spacing-${style.name.toLowerCase().replace(/\s+/g, '-')}`,
          value: `${numericValue * 4}px`,
          type: 'spacing',
          category: 'spacing',
          description: `Spacing: ${style.name}`,
          responsive: {}
        });
      }
    });

    return tokens;
  }

  /**
   * Extract dimension styles from Figma
   */
  private extractDimensionStyles(figmaFile: FigmaFile): DesignToken[] {
    const tokens: DesignToken[] = [];
    const styles = figmaFile.document?.styles || {};

    Object.entries(styles).forEach(([styleId, style]) => {
      if (style.name.includes('size') || style.name.includes('width') || style.name.includes('height')) {
        const numericValue = parseInt(style.name.match(/\d+/)?.[0] || '0');

        tokens.push({
          name: `dimension-${style.name.toLowerCase().replace(/\s+/g, '-')}`,
          value: `${numericValue}px`,
          type: 'spacing',
          category: 'spacing',
          description: `Dimension: ${style.name}`,
          responsive: {}
        });
      }
    });

    return tokens;
  }

  /**
   * Extract border styles from Figma
   */
  private extractBorderStyles(figmaFile: FigmaFile): DesignToken[] {
    const tokens: DesignToken[] = [];
    const styles = figmaFile.document?.styles || {};

    Object.entries(styles).forEach(([styleId, style]) => {
      if (style.name.includes('border') || style.name.includes('stroke')) {
        tokens.push({
          name: `border-${style.name.toLowerCase().replace(/\s+/g, '-')}`,
          value: '1px solid #E5E7EB',
          type: 'border',
          category: 'border',
          description: `Border: ${style.name}`,
          responsive: {}
        });
      }
    });

    return tokens;
  }

  /**
   * Extract shadow styles from Figma
   */
  private extractShadowStyles(figmaFile: FigmaFile): DesignToken[] {
    const tokens: DesignToken[] = [];
    const styles = figmaFile.document?.styles || {};

    Object.entries(styles).forEach(([styleId, style]) => {
      if (style.name.includes('shadow') || style.name.includes('drop')) {
        tokens.push({
          name: `shadow-${style.name.toLowerCase().replace(/\s+/g, '-')}`,
          value: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          type: 'shadow',
          category: 'shadow',
          description: `Shadow: ${style.name}`,
          responsive: {}
        });
      }
    });

    return tokens;
  }

  /**
   * Extract components from Figma
   */
  async extractComponents(fileId: string): Promise<ComponentImport[]> {
    const figmaFile = this.figmaFiles.get(fileId);
    if (!figmaFile) {
      throw new Error('Figma file not loaded. Please connect first.');
    }

    const components: ComponentImport[] = [];
    const componentNodes = this.findComponentNodes(figmaFile.document);

    for (const node of componentNodes) {
      const component = this.extractComponent(node, figmaFile);
      components.push(component);
      this.exportedComponents.set(component.id, component);
    }

    return components;
  }

  /**
   * Find component nodes in Figma file
   */
  private findComponentNodes(node: any): any[] {
    const components: any[] = [];

    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      components.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        components.push(...this.findComponentNodes(child));
      }
    }

    return components;
  }

  /**
   * Extract component data
   */
  private extractComponent(node: any, figmaFile: FigmaFile): ComponentImport {
    const component: ComponentImport = {
      id: node.id,
      name: node.name,
      type: node.type,
      properties: {},
      styles: {},
      responsive: {},
      accessibility: {}
    };

    // Extract properties from component
    this.extractComponentProperties(node, component);

    // Extract styles
    this.extractComponentStyles(node, component);

    // Extract responsive properties
    this.extractResponsiveProperties(node, component);

    // Extract accessibility information
    this.extractAccessibilityProperties(node, component);

    return component;
  }

  /**
   * Extract component properties
   */
  private extractComponentProperties(node: any, component: ComponentImport): void {
    if (node.absoluteBoundingBox) {
      component.properties.width = node.absoluteBoundingBox.width;
      component.properties.height = node.absoluteBoundingBox.height;
    }

    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        const color = fill.color;
        component.properties.backgroundColor = this.rgbToHex(color.r, color.g, color.b);
      }
    }

    if (node.strokes && node.strokes.length > 0) {
      const stroke = node.strokes[0];
      if (stroke.type === 'SOLID') {
        const color = stroke.color;
        component.properties.borderColor = this.rgbToHex(color.r, color.g, color.b);
      }
    }

    if (node.cornerRadius) {
      component.properties.borderRadius = node.cornerRadius;
    }

    if (node.layoutAlign) {
      component.properties.align = node.layoutAlign;
    }

    if (node.layoutMode) {
      component.properties.layoutMode = node.layoutMode;
    }
  }

  /**
   * Extract component styles
   */
  private extractComponentStyles(node: any, component: ComponentImport): void {
    if (node.styles) {
      Object.entries(node.styles).forEach(([styleType, styleId]) => {
        const style = this.findStyleById(styleId);
        if (style) {
          component.styles[styleType] = style.name;
        }
      });
    }
  }

  /**
   * Extract responsive properties
   */
  private extractResponsiveProperties(node: any, component: ComponentImport): void {
    // Look for responsive variants in component sets
    if (node.type === 'COMPONENT_SET') {
      const variants = node.children || [];
      if (variants.length > 0) {
        component.responsive = {
          mobile: this.extractVariantProperties(variants[0]),
          tablet: variants.length > 1 ? this.extractVariantProperties(variants[1]) : component.responsive.mobile,
          desktop: variants.length > 2 ? this.extractVariantProperties(variants[2]) : component.responsive.tablet
        };
      }
    }
  }

  /**
   * Extract variant properties
   */
  private extractVariantProperties(variant: any): Record<string, any> {
    const properties: Record<string, any> = {};

    if (variant.absoluteBoundingBox) {
      properties.width = variant.absoluteBoundingBox.width;
      properties.height = variant.absoluteBoundingBox.height;
    }

    if (variant.fills && variant.fills.length > 0) {
      const fill = variant.finds[0];
      if (fill.type === 'SOLID') {
        const color = fill.color;
        properties.backgroundColor = this.rgbToHex(color.r, color.g, color.b);
      }
    }

    return properties;
  }

  /**
   * Extract accessibility properties
   */
  private extractAccessibilityProperties(node: any, component: ComponentImport): void {
    // Check for accessibility labels
    if (node.accessibilityLabel) {
      component.accessibility.label = node.accessibilityLabel;
    }

    // Check for accessibility description
    if (node.accessibilityHint) {
      component.accessibility.hint = node.accessibilityHint;
    }

    // Check for role
    if (node.accessibilityRole) {
      component.accessibility.role = node.accessibilityRole;
    }

    // Check for state
    if (node.accessibilityState) {
      component.accessibility.state = node.accessibilityState;
    }
  }

  /**
   * Find style by ID
   */
  private findStyleById(styleId: string): any {
    // Search through all loaded Figma files for the style
    for (const figmaFile of this.figmaFiles.values()) {
      const styles = figmaFile.document?.styles || {};
      if (styles[styleId]) {
        return styles[styleId];
      }
    }
    return null;
  }

  /**
   * Export design tokens
   */
  async exportDesignTokens(
    fileId: string,
    config: FigmaExportConfig
  ): Promise<string> {
    const tokens = Array.from(this.designTokens.values());
    let exported = '';

    switch (config.exportFormat) {
      case 'css':
        exported = this.generateCSSTokens(tokens);
        break;
      case 'scss':
        exported = this.generateSCSSTokens(tokens);
        break;
      case 'js':
        exported = this.generateJSTokens(tokens);
        break;
      case 'json':
        exported = JSON.stringify(tokens, null, 2);
        break;
      case 'tokens':
        exported = this.generateTokensFile(tokens);
        break;
      default:
        throw new Error(`Unsupported export format: ${config.exportFormat}`);
    }

    return exported;
  }

  /**
   * Generate CSS tokens
   */
  private generateCSSTokens(tokens: DesignToken[]): string {
    let css = ':root {\n';

    tokens.forEach(token => {
      const cssVarName = token.name.replace(/-/g, '-');
      css.push(`  --${cssVarName}: ${token.value};\n`);
    });

    css += '}\n\n';

    // Generate CSS custom properties for responsive tokens
    tokens.forEach(token => {
      if (Object.keys(token.responsive).length > 0) {
        Object.entries(token.responsive).forEach(([device, value]) => {
          css.push(`  --${token.name}-${device}: ${value};\n`);
        });
      }
    });

    return css;
  }

  /**
   * Generate SCSS tokens
   */
  private generateSCSSTokens(tokens: DesignToken[]): string {
    let scss = '$tokens: (\n';

    tokens.forEach(token => {
      const scssVarName = `--${token.name}`;
      scss.push(`  "${scssVarName}": "${token.value}",\n`);
    });

    scss += ');\n\n';

    // Generate SCSS variables
    tokens.forEach(token => {
      const scssVarName = token.name.replace(/-/g, '_');
      scss.push(`$${scssVarName}: var(--${token.name});\n`);
    });

    return scss;
  }

  /**
   * Generate JS tokens
   */
  private generateJSTokens(tokens: DesignToken[]): string {
    let js = 'export const designTokens = {\n';

    tokens.forEach(token => {
      js.push(`  ${token.name}: "${token.value}",\n`);
    });

    js += '};\n\n';

    // Generate responsive token objects
    js += 'export const responsiveTokens = {\n';
    const responsiveGroups: Record<string, DesignToken[]> = {};

    tokens.forEach(token => {
      Object.keys(token.responsive).forEach(device => {
        if (!responsiveGroups[device]) {
          responsiveGroups[device] = [];
        }
        responsiveGroups[device].push(token);
      });
    });

    Object.entries(responsiveGroups).forEach(([device, deviceTokens]) => {
      js.push(`  ${device}: {\n`);
      deviceTokens.forEach(token => {
        const value = token.responsive[device as keyof typeof token.responsive];
        js.push(`    ${token.name}: "${value}",\n`);
      });
      js.push('  },\n');
    });

    js += '};';

    return js;
  }

  /**
   * Generate tokens file
   */
  private generateTokensFile(tokens: DesignToken[]): string {
    const tokensFile = {
      schema: 'https://design.tokens.studio/schema.json',
      name: 'Figma Design Tokens',
      tokens: tokens.reduce((acc: Record<string, any>, token) => {
        acc[token.name] = {
          $type: token.type,
          $value: token.value,
          $description: token.description
        };
        return acc;
      }, {}),
      extensions: {
        'studio.tokens': {
          'files': '*',
          'destination': './tokens.json',
          'format': 'json'
        }
      }
    };

    return JSON.stringify(tokensFile, null, 2);
  }

  /**
   * Export components
   */
  async exportComponents(
    fileId: string,
    config: FigmaExportConfig
  ): Promise<string> {
    const components = Array.from(this.exportedComponents.values());
    let exported = '';

    if (config.includeComponents) {
      switch (config.exportFormat) {
        case 'css':
          exported = this.generateCSSComponents(components);
          break;
        case 'js':
          exported = this.generateJSComponents(components);
          break;
        case 'json':
          exported = JSON.stringify(components, null, 2);
          break;
        default:
          exported = this.generateGenericComponents(components);
      }
    }

    return exported;
  }

  /**
   * Generate CSS components
   */
  private generateCSSComponents(components: ComponentImport[]): string {
    let css = '';

    components.forEach(component => {
      css += `/* ${component.name} */\n`;
      css += `.${component.name.toLowerCase().replace(/\s+/g, '-')} {\n`;

      // Add properties
      Object.entries(component.properties).forEach(([property, value]) => {
        css.push(`  ${property}: ${value};\n`);
      });

      // Add styles
      Object.entries(component.styles).forEach(([styleType, styleName]) => {
        css.push(`  /* ${styleType}: ${styleName} */\n`);
      });

      // Add responsive styles
      Object.entries(component.responsive).forEach(([device, styles]) => {
        css.push(`  @media (max-width: ${this.getDeviceMaxWidth(device)}px) {\n`);
        Object.entries(styles).forEach(([property, value]) => {
          css.push(`    ${property}: ${value};\n`);
        });
        css.push('  }\n');
      });

      // Add accessibility
      Object.entries(component.accessibility).forEach(([accProp, accValue]) => {
        css.push(`  /* ${accProp}: ${accValue} */\n`);
      });

      css.push('}\n\n');
    });

    return css;
  }

  /**
   * Generate JS components
   */
  private generateJSComponents(components: ComponentImport[]): string {
    let js = 'export const components = {\n';

    components.forEach(component => {
      js.push(`  ${component.name.toLowerCase().replace(/\s+/g, '-')}: {\n`);
      js.push(`    name: "${component.name}",\n`);
      js.push(`    type: "${component.type}",\n`);

      // Add properties
      js.push('    properties: {\n');
      Object.entries(component.properties).forEach(([property, value]) => {
        js.push(`      ${property}: ${JSON.stringify(value)},\n`);
      });
      js.push('    },\n');

      // Add styles
      js.push('    styles: {\n');
      Object.entries(component.styles).forEach(([styleType, styleName]) => {
        js.push(`      ${styleType}: "${styleName}",\n`);
      });
      js.push('    },\n');

      // Add responsive
      js.push('    responsive: {\n');
      Object.entries(component.responsive).forEach(([device, styles]) => {
        js.push(`      ${device}: {\n`);
        Object.entries(styles).forEach(([property, value]) => {
          js.push(`        ${property}: ${JSON.stringify(value)},\n`);
        });
        js.push('      },\n');
      });
      js.push('    },\n');

      // Add accessibility
      js.push('    accessibility: {\n');
      Object.entries(component.accessibility).forEach(([accProp, accValue]) => {
        js.push(`      ${accProp}: ${JSON.stringify(accValue)},\n`);
      });
      js.push('    },\n');

      js.push('  },\n');
    });

    js += '};';

    return js;
  }

  /**
   * Generate generic component export
   */
  private generateGenericComponents(components: ComponentImport[]): string {
    return components.map(component => {
      return {
        name: component.name,
        type: component.type,
        properties: component.properties,
        styles: component.styles,
        responsive: component.responsive,
        accessibility: component.accessibility
      };
    }).map(JSON.stringify).join('\n\n');
  }

  /**
   * Get device max width
   */
  private getDeviceMaxWidth(device: string): number {
    const deviceWidths: Record<string, number> = {
      'mobile': 639,
      'tablet': 1023,
      'laptop': 1279,
      'desktop': 1535
    };
    return deviceWidths[device] || 1023;
  }

  /**
   * RGB to HEX conversion
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Create professional UI implementation
   */
  async createProfessionalUI(
    fileId: string,
    config: FigmaExportConfig
  ): Promise<{
    components: string;
    styles: string;
    tokens: string;
    documentation: string;
  }> {
    // Extract tokens
    const tokens = await this.extractDesignTokens(fileId);
    const tokenFiles = await this.exportDesignTokens(fileId, config);

    // Extract components
    const components = await this.extractComponents(fileId);
    const componentFiles = await this.exportComponents(fileId, config);

    // Generate styles
    const styles = this.generateProfessionalStyles(tokens, components);

    // Generate documentation
    const documentation = this.generateDocumentation(tokens, components);

    return {
      components: componentFiles,
      styles,
      tokens: tokenFiles,
      documentation
    };
  }

  /**
   * Generate professional styles
   */
  private generateProfessionalStyles(tokens: DesignToken[], components: ComponentImport[]): string {
    let styles = `/* Professional Design System */
/* Generated from Figma */

/* Reset and base styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  color: var(--color-neutral-900);
  background-color: var(--color-neutral-50);
}

/* Container system */
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
}

/* Grid system */
.grid {
  display: grid;
  gap: var(--spacing-md);
  grid-template-columns: repeat(12, 1fr);
}

.grid-1 { grid-column: span 1; }
.grid-2 { grid-column: span 2; }
.grid-3 { grid-column: span 3; }
.grid-4 { grid-column: span 4; }
.grid-5 { grid-column: span 5; }
.grid-6 { grid-column: span 6; }
.grid-7 { grid-column: span 7; }
.grid-8 { grid-column: span 8; }
.grid-9 { grid-column: span 9; }
.grid-10 { grid-column: span 10; }
.grid-11 { grid-column: span 11; }
.grid-12 { grid-column: span 12; }

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  margin-bottom: var(--spacing-md);
}

h1 { font-size: var(--text-size-4xl); }
h2 { font-size: var(--text-size-3xl); }
h3 { font-size: var(--text-size-2xl); }
h4 { font-size: var(--text-size-xl); }
h5 { font-size: var(--text-size-lg); }
h6 { font-size: var(--text-size-base); }

p {
  margin-bottom: var(--spacing-md);
  color: var(--color-neutral-700);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--border-radius-md);
  font-size: var(--text-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
  text-decoration: none;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-primary-600);
  transform: translateY(-1px);
}

.btn-secondary {
  background-color: white;
  color: var(--color-neutral-700);
  border: 1px solid var(--color-neutral-300);
}

.btn-secondary:hover {
  background-color: var(--color-neutral-50);
}

.btn-danger {
  background-color: var(--color-error);
  color: white;
}

.btn-danger:hover {
  background-color: var(--color-error-600);
}

/* Cards */
.card {
  background: white;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-lg);
  transition: all var(--transition-normal);
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

/* Forms */
.form-group {
  margin-bottom: var(--spacing-md);
}

.form-label {
  display: block;
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-xs);
  color: var(--color-neutral-700);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--border-radius-md);
  font-size: var(--text-size-base);
  transition: all var(--transition-normal);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Navigation */
.nav {
  background: white;
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-md) 0;
}

.nav-list {
  display: flex;
  list-style: none;
  gap: var(--spacing-lg);
}

.nav-link {
  text-decoration: none;
  color: var(--color-neutral-700);
  font-weight: var(--font-weight-medium);
  transition: color var(--transition-normal);
}

.nav-link:hover {
  color: var(--color-primary);
}

/* Responsive utilities */
@media (max-width: 768px) {
  .container {
    padding: 0 var(--spacing-sm);
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .nav-list {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}

/* Accessibility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Generated component styles\n`;

    // Add component-specific styles
    components.forEach(component => {
      styles += this.generateComponentStyles(component);
    });

    return styles;
  }

  /**
   * Generate component styles
   */
  private generateComponentStyles(component: ComponentImport): string {
    return `
/* ${component.name} */
.component-${component.name.toLowerCase().replace(/\s+/g, '-')} {
  ${Object.entries(component.properties).map(([prop, value]) =>
    `${prop}: ${value};`
  ).join('\n  ')}
}

/* Responsive variations */
@media (max-width: 768px) {
  .component-${component.name.toLowerCase().replace(/\s+/g, '-')} {
    ${Object.entries(component.responsive.mobile || {}).map(([prop, value]) =>
      `${prop}: ${value};`
    ).join('\n    ')}
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .component-${component.name.toLowerCase().replace(/\s+/g, '-')} {
    ${Object.entries(component.responsive.tablet || {}).map(([prop, value]) =>
      `${prop}: ${value};`
    ).join('\n    ')}
  }
}

@media (min-width: 1025px) {
  .component-${component.name.toLowerCase().replace(/\s+/g, '-')} {
    ${Object.entries(component.responsive.desktop || {}).map(([prop, value]) =>
      `${prop}: ${value};`
    ).join('\n    ')}
  }
}

/* Accessibility */
.component-${component.name.toLowerCase().replace(/\s+/g, '-')} [role="${component.accessibility.role}"] {
  ${component.accessibility.label ? `aria-label: "${component.accessibility.label}";` : ''}
  ${component.accessibility.hint ? `aria-describedby: "${component.accessibility.hint}";` : ''}
}
`;
  }

  /**
   * Generate documentation
   */
  private generateDocumentation(tokens: DesignToken[], components: ComponentImport[]): string {
    let documentation = `# Design System Documentation

## Overview
This design system was generated from Figma and provides a comprehensive set of tokens and components for building professional user interfaces.

## Design Tokens
`;

    // Document tokens by category
    const tokenCategories: Record<string, DesignToken[]> = {};

    tokens.forEach(token => {
      if (!tokenCategories[token.category]) {
        tokenCategories[token.category] = [];
      }
      tokenCategories[token.category].push(token);
    });

    Object.entries(tokenCategories).forEach(([category, categoryTokens]) => {
      documentation += `\n### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;

      categoryTokens.forEach(token => {
        documentation += `- **${token.name}**: ${token.value} (${token.description})\n`;
      });
    });

    documentation += `\n## Components\n\n`;

    // Document components
    components.forEach(component => {
      documentation += `### ${component.name}\n\n`;
      documentation += `**Type**: ${component.type}\n\n`;
      documentation += `**Properties**:\n`;
      Object.entries(component.properties).forEach(([prop, value]) => {
        documentation += `- ${prop}: ${value}\n`;
      });

      if (Object.keys(component.responsive).length > 0) {
        documentation += `\n**Responsive**:\n`;
        Object.entries(component.responsive).forEach(([device, styles]) => {
          documentation += `- ${device}: ${JSON.stringify(styles, null, 2)}\n`;
        });
      }

      if (Object.keys(component.accessibility).length > 0) {
        documentation += `\n**Accessibility**:\n`;
        Object.entries(component.accessibility).forEach(([accProp, accValue]) => {
          documentation += `- ${accProp}: ${accValue}\n`;
        });
      }

      documentation += '\n---\n\n';
    });

    return documentation;
  }

  /**
   * Get design tokens
   */
  getDesignTokens(): Map<string, DesignToken> {
    return new Map(this.designTokens);
  }

  /**
   * Get exported components
   */
  getExportedComponents(): Map<string, ComponentImport> {
    return new Map(this.exportedComponents);
  }

  /**
   * Get Figma files
   */
  getFigmaFiles(): Map<string, FigmaFile> {
    return new Map(this.figmaFiles);
  }
}

// Export singleton instance
export const figmaIntegrationAgent = new FigmaIntegrationAgent('');