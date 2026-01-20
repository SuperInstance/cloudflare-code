/**
 * Responsive Design Agent
 *
 * Specialized agent for creating adaptive layouts, responsive patterns,
    and mobile-first designs
*/

import type {
  LayoutPattern,
  Breakpoint,
  ResponsiveComponent,
  DeviceProfile
} from '../types';

export interface ResponsiveConfig {
  breakpoints: Breakpoint[];
  gridSystem: GridSystem;
  typography: TypographySystem;
  spacing: SpacingSystem;
  components: ResponsiveComponent[];
}

export interface GridSystem {
  columns: number;
  gutters: number[];
  maxWidth: number;
  container: {
    padding: string;
    maxWidth: string;
  };
}

export interface TypographySystem {
  scales: Record<string, number[]>;
  fluid: boolean;
  clamp: boolean;
}

export interface SpacingSystem {
  base: number;
  scale: number[];
  responsive: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export interface AdaptiveLayout {
  id: string;
  name: string;
  description: string;
  structure: LayoutStructure;
  breakpoints: Breakpoint[];
  patterns: string[];
  performance: {
    loadTime: number;
    fileSize: number;
    complexity: number;
  };
}

export interface LayoutStructure {
  header: LayoutSection;
  navigation: LayoutSection;
  main: LayoutSection;
  sidebar: LayoutSection;
  footer: LayoutSection;
  modal: LayoutSection;
  tooltip: LayoutSection;
}

export interface LayoutSection {
  element: string;
  props: Record<string, any>;
  responsive: Record<string, any>;
  accessibility: Record<string, any>;
}

export class ResponsiveDesignAgent {
  private responsiveConfig: ResponsiveConfig;
  private adaptiveLayouts: Map<string, AdaptiveLayout>;
  private deviceProfiles: Map<string, DeviceProfile>;
  private performanceMetrics: Map<string, any>;

  constructor() {
    this.initializeResponsiveSystem();
    this.initializeAdaptiveLayouts();
    this.initializeDeviceProfiles();
    this.initializePerformanceMetrics();
  }

  /**
   * Initialize comprehensive responsive system
   */
  private initializeResponsiveSystem(): void {
    this.responsiveConfig = {
      breakpoints: [
        { min: 0, max: 639, name: 'mobile', label: 'Mobile' },
        { min: 640, max: 767, name: 'mobile-landscape', label: 'Mobile Landscape' },
        { min: 768, max: 1023, name: 'tablet', label: 'Tablet' },
        { min: 1024, max: 1279, name: 'laptop', label: 'Laptop' },
        { min: 1280, max: 1535, name: 'desktop', label: 'Desktop' },
        { min: 1536, max: Infinity, name: 'desktop-wide', label: 'Desktop Wide' }
      ],
      gridSystem: {
        columns: 12,
        gutters: [0, 8, 16, 24, 32, 48],
        maxWidth: 1280,
        container: {
          padding: '0 24px',
          maxWidth: '1200px'
        }
      },
      typography: {
        scales: {
          'heading': [24, 32, 48, 64, 96],
          'body': [14, 16, 18, 20, 24],
          'caption': [12, 13, 14, 16, 18]
        },
        fluid: true,
        clamp: true
      },
      spacing: {
        base: 8,
        scale: [0, 4, 8, 16, 24, 32, 48, 64, 96, 128],
        responsive: {
          mobile: 0.85,
          tablet: 0.95,
          desktop: 1.0
        }
      },
      components: []
    };
  }

  /**
   * Initialize adaptive layouts
   */
  private initializeAdaptiveLayouts(): void {
    this.adaptiveLayouts = new Map();
  }

  /**
   * Initialize device profiles
   */
  private initializeDeviceProfiles(): void {
    this.deviceProfiles = new Map([
      ['iphone-se', {
        name: 'iPhone SE',
        screen: { width: 375, height: 667 },
        viewport: { width: 320, height: 568 },
        devicePixelRatio: 2,
        touch: true,
        mobile: true,
        platform: 'ios'
      }],
      ['iphone-pro', {
        name: 'iPhone Pro',
        screen: { width: 390, height: 844 },
        viewport: { width: 390, height: 844 },
        devicePixelRatio: 3,
        touch: true,
        mobile: true,
        platform: 'ios'
      }],
      ['ipad-air', {
        name: 'iPad Air',
        screen: { width: 820, height: 1180 },
        viewport: { width: 820, height: 1180 },
        devicePixelRatio: 2,
        touch: true,
        tablet: true,
        platform: 'ios'
      }],
      ['samsung-s23', {
        name: 'Samsung Galaxy S23',
        screen: { width: 393, height: 851 },
        viewport: { width: 393, height: 851 },
        devicePixelRatio: 2.75,
        touch: true,
        mobile: true,
        platform: 'android'
      }],
      ['surface-pro', {
        name: 'Microsoft Surface Pro',
        screen: { width: 912, height: 1368 },
        viewport: { width: 912, height: 1368 },
        devicePixelRatio: 2,
        touch: true,
        tablet: true,
        platform: 'windows'
      }],
      ['macbook-air', {
        name: 'MacBook Air',
        screen: { width: 1440, height: 900 },
        viewport: { width: 1440, height: 900 },
        devicePixelRatio: 2,
        touch: false,
        laptop: true,
        platform: 'macos'
      }],
      ['dell-xps', {
        name: 'Dell XPS',
        screen: { width: 1920, height: 1080 },
        viewport: { width: 1920, height: 1080 },
        devicePixelRatio: 1,
        touch: false,
        desktop: true,
        platform: 'windows'
      }]
    ]);
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): void {
    this.performanceMetrics = new Map();
  }

  /**
   * Generate responsive CSS
   */
  async generateResponsiveCSS(componentName: string, structure: any): Promise<string> {
    const css: string[] = [];
    const breakpointPrefixes = ['mobile', 'tablet', 'laptop', 'desktop'];

    // Base styles
    css.push(`
/* ${componentName} - Base Styles */
.${componentName} {
  position: relative;
  width: 100%;
  box-sizing: border-box;
}`);

    // Generate responsive variations
    this.responsiveConfig.breakpoints.forEach(breakpoint => {
      const bpName = breakpoint.name;
      const min = breakpoint.min;
      const max = breakpoint.max;

      // Skip if no styles defined for this breakpoint
      if (!structure[bpName]) return;

      const mediaQuery = this.generateMediaQuery(min, max);
      const componentStyles = this.generateComponentStyles(componentName, structure[bpName]);

      css.push(`
/* ${componentName} - ${breakpoint.label} (${min}px - ${max === Infinity ? '∞' : max}px) */
${mediaQuery} {
  ${componentStyles}
}`);
    });

    return css.join('\n');
  }

  /**
   * Generate media query
   */
  private generateMediaQuery(min: number, max: number): string {
    if (max === Infinity) {
      return `@media (min-width: ${min}px)`;
    } else {
      return `@media (min-width: ${min}px) and (max-width: ${max}px)`;
    }
  }

  /**
   * Generate component styles
   */
  private generateComponentStyles(componentName: string, styles: any): string {
    const css: string[] = [];

    Object.entries(styles).forEach(([property, value]) => {
      if (typeof value === 'object') {
        // Handle nested properties (like margin, padding)
        Object.entries(value).forEach(([subProperty, subValue]) => {
          css.push(`${property}-${subProperty}: ${this.formatValue(subValue)};`);
        });
      } else {
        css.push(`${property}: ${this.formatValue(value)};`);
      }
    });

    return css.join('\n');
  }

  /**
   * Format CSS value
   */
  private formatValue(value: any): string {
    if (typeof value === 'number') {
      // Add units for numeric values
      if (value > 0) {
        return value + 'px';
      }
      return value.toString();
    }
    return value.toString();
  }

  /**
   * Generate adaptive layout
   */
  async generateAdaptiveLayout(
    layoutType: string,
    requirements: {
      navigation: boolean;
      sidebar: boolean;
      footer: boolean;
      features: string[];
    }
  ): Promise<AdaptiveLayout> {
    const layout: AdaptiveLayout = {
      id: crypto.randomUUID(),
      name: `${layoutType}-layout`,
      description: `Adaptive ${layoutType} layout with responsive components`,
      structure: this.generateLayoutStructure(layoutType, requirements),
      breakpoints: this.responsiveConfig.breakpoints,
      patterns: this.generateLayoutPatterns(layoutType),
      performance: {
        loadTime: 0,
        fileSize: 0,
        complexity: 0
      }
    };

    this.adaptiveLayouts.set(layout.id, layout);
    return layout;
  }

  /**
   * Generate layout structure
   */
  private generateLayoutStructure(layoutType: string, requirements: any): LayoutStructure {
    const structure: LayoutStructure = {
      header: {
        element: 'header',
        props: {},
        responsive: {},
        accessibility: {}
      },
      navigation: {
        element: 'nav',
        props: {},
        responsive: {},
        accessibility: {}
      },
      main: {
        element: 'main',
        props: {},
        responsive: {},
        accessibility: {}
      },
      sidebar: {
        element: 'aside',
        props: {},
        responsive: {},
        accessibility: {}
      },
      footer: {
        element: 'footer',
        props: {},
        responsive: {},
        accessibility: {}
      },
      modal: {
        element: 'div',
        props: {},
        responsive: {},
        accessibility: {}
      },
      tooltip: {
        element: 'div',
        props: {},
        responsive: {},
        accessibility: {}
      }
    };

    // Customize structure based on layout type and requirements
    switch (layoutType) {
      case 'dashboard':
        structure.sidebar.props = { className: 'sidebar' };
        structure.sidebar.responsive = {
          mobile: { display: 'none' },
          tablet: { display: 'block' }
        };
        break;
      case 'marketing':
        structure.header.props = { className: 'hero-header' };
        structure.main.props = { className: 'hero-content' };
        break;
      case 'application':
        structure.navigation.props = { className: 'app-nav' };
        break;
      case 'educational':
        structure.main.props = { className: 'learning-content' };
        break;
    }

    // Apply requirements
    if (!requirements.navigation) {
      structure.navigation.props.style = { display: 'none' };
    }
    if (!requirements.sidebar) {
      structure.sidebar.props.style = { display: 'none' };
    }
    if (!requirements.footer) {
      structure.footer.props.style = { display: 'none' };
    }

    return structure;
  }

  /**
   * Generate layout patterns
   */
  private generateLayoutPatterns(layoutType: string): string[] {
    const patterns = [];

    // Common responsive patterns
    patterns.push('container-fluid');
    patterns.push('flexbox-layout');
    patterns.push('grid-system');
    patterns.push('stack-on-mobile');

    // Layout-specific patterns
    switch (layoutType) {
      case 'dashboard':
        patterns.push('collapsible-sidebar');
        patterns.push('sticky-header');
        patterns.push('responsive-cards');
        break;
      case 'marketing':
        patterns.push('hero-section');
        patterns.push('feature-grid');
        patterns.push('testimonial-slider');
        break;
      case 'application':
        patterns.push('form-layout');
        patterns.push('table-responsive');
        patterns.push('action-toolbar');
        break;
      case 'educational':
        patterns.push('progress-tracker');
        patterns.push('lesson-navigation');
        patterns.push('assessment-layout');
        break;
    }

    return patterns;
  }

  /**
   * Generate responsive grid classes
   */
  async generateGridClasses(): Promise<Record<string, string>> {
    const classes: Record<string, string> = {};
    const breakpoints = ['mobile', 'tablet', 'laptop', 'desktop'];

    // Container classes
    classes['container'] = 'width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px;';

    // Responsive container variations
    breakpoints.forEach(bp => {
      if (bp !== 'mobile') {
        classes[`container-${bp}`] = `@media (min-width: ${this.getBreakpointMin(bp)}px) { width: 100%; max-width: ${this.getContainerMax(bp)}px; margin: 0 auto; padding: 0 ${this.getContainerPadding(bp)}px; }`;
      }
    });

    // Grid column classes
    for (let i = 1; i <= this.responsiveConfig.gridSystem.columns; i++) {
      classes[`col-${i}`] = `flex: 0 0 ${(i / this.responsiveConfig.gridSystem.columns) * 100}%; max-width: ${(i / this.responsiveConfig.gridSystem.columns) * 100}%;`;
    }

    // Responsive column variations
    breakpoints.forEach(bp => {
      if (bp !== 'mobile') {
        for (let i = 1; i <= this.responsiveConfig.gridSystem.columns; i++) {
          classes[`col-${bp}-${i}`] = `@media (min-width: ${this.getBreakpointMin(bp)}px) { flex: 0 0 ${(i / this.responsiveConfig.gridSystem.columns) * 100}%; max-width: ${(i / this.responsiveConfig.gridSystem.columns) * 100}%; }`;
        }
      }
    });

    // Offset classes
    for (let i = 1; i <= this.responsiveConfig.gridSystem.columns; i++) {
      classes[`offset-${i}`] = `margin-left: ${(i / this.responsiveConfig.gridSystem.columns) * 100}%;`;
    }

    return classes;
  }

  /**
   * Get breakpoint minimum value
   */
  private getBreakpointMin(breakpoint: string): number {
    const bp = this.responsiveConfig.breakpoints.find(b => b.name === breakpoint);
    return bp ? bp.min : 0;
  }

  /**
   * Get container maximum width for breakpoint
   */
  private getContainerMax(breakpoint: string): number {
    switch (breakpoint) {
      case 'tablet': return 768;
      case 'laptop': return 1024;
      case 'desktop': return 1200;
      default: return 1200;
    }
  }

  /**
   * Get container padding for breakpoint
   */
  private getContainerPadding(breakpoint: string): number {
    switch (breakpoint) {
      case 'tablet': return 16;
      case 'laptop': return 24;
      case 'desktop': return 32;
      default: return 24;
    }
  }

  /**
   * Generate typography responsive classes
   */
  async generateTypographyClasses(): Promise<Record<string, string>> {
    const classes: Record<string, string> = {};

    // Font size classes
    const fontSizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
    const breakpoints = ['mobile', 'tablet', 'laptop', 'desktop'];

    fontSizes.forEach(size => {
      classes[size] = `font-size: ${this.getFontSizeValue(size)};`;

      // Responsive variations
      breakpoints.forEach(bp => {
        if (bp !== 'mobile') {
          const responsiveSize = this.getResponsiveFontSize(size, bp);
          classes[`${size}-${bp}`] = `@media (min-width: ${this.getBreakpointMin(bp)}px) { font-size: ${responsiveSize}; }`;
        }
      });
    });

    // Font weight classes
    const fontWeights = ['font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold'];
    fontWeights.forEach(weight => {
      classes[weight] = `font-weight: ${this.getFontWeightValue(weight)};`;
    });

    // Line height classes
    const lineHeights = ['leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed', 'leading-loose'];
    lineHeights.forEach(height => {
      classes[height] = `line-height: ${this.getLineHeightValue(height)};`;
    });

    // Text alignment classes
    const alignments = ['text-left', 'text-center', 'text-right', 'text-justify'];
    alignments.forEach(align => {
      classes[align] = `text-align: ${align.replace('text-', '')};`;
    });

    return classes;
  }

  /**
   * Get font size value
   */
  private getFontSizeValue(size: string): string {
    const sizes: Record<string, string> = {
      'text-xs': '0.75rem',
      'text-sm': '0.875rem',
      'text-base': '1rem',
      'text-lg': '1.125rem',
      'text-xl': '1.25rem',
      'text-2xl': '1.5rem',
      'text-3xl': '1.875rem',
      'text-4xl': '2.25rem'
    };
    return sizes[size] || '1rem';
  }

  /**
   * Get responsive font size value
   */
  private getResponsiveFontSize(baseSize: string, breakpoint: string): string {
    const scaleFactor = this.responsiveConfig.spacing.responsive[breakpoint as keyof typeof this.responsiveConfig.spacing.responsive] || 1;
    const baseValue = parseFloat(this.getFontSizeValue(baseSize));
    return `${(baseValue * scaleFactor).toFixed(3)}rem`;
  }

  /**
   * Get font weight value
   */
  private getFontWeightValue(weight: string): number | string {
    const weights: Record<string, number | string> = {
      'font-light': 300,
      'font-normal': 400,
      'font-medium': 500,
      'font-semibold': 600,
      'font-bold': 700
    };
    return weights[weight] || 400;
  }

  /**
   * Get line height value
   */
  private getLineHeightValue(height: string): number | string {
    const heights: Record<string, number | string> = {
      'leading-tight': 1.25,
      'leading-snug': 1.375,
      'leading-normal': 1.5,
      'leading-relaxed': 1.625,
      'leading-loose': 2
    };
    return heights[height] || 1.5;
  }

  /**
   * Generate spacing responsive classes
   */
  async generateSpacingClasses(): Promise<Record<string, string>> {
    const classes: Record<string, string> = {};
    const spacingPrefixes = ['m', 'p']; // margin, padding
    const sides = ['t', 'r', 'b', 'l', 'x', 'y', '']; // top, right, bottom, left, x-axis, y-axis, all
    const sizes = ['', '1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24', '32', '40', '48', '56', '64', '72', '80', '96', 'auto'];

    spacingPrefixes.forEach(prefix => {
      sides.forEach(side => {
        sizes.forEach(size => {
          const className = `${prefix}${side}${size}`;

          if (!size) {
            // All sides (m-, p-)
            classes[className] = `${prefix === 'm' ? 'margin' : 'padding'}: ${this.getSpacingValue(size)};`;
          } else if (size === '1') {
            // Single unit (m-1, p-1)
            classes[className] = `${prefix === 'm' ? 'margin' : 'padding'}-${this.getSpacingSide(side)}: ${this.getSpacingValue('1')};`;
          } else {
            // Multiple units (m-2, m-3, etc.)
            classes[className] = `${prefix === 'm' ? 'margin' : 'padding'}-${this.getSpacingSide(side)}: ${this.getSpacingValue(size)};`;
          }
        });
      });
    });

    return classes;
  }

  /**
   * Get spacing value
   */
  private getSpacingValue(size: string): string {
    const values: Record<string, string> = {
      '': '0',
      '1': '0.25rem',
      '2': '0.5rem',
      '3': '0.75rem',
      '4': '1rem',
      '5': '1.25rem',
      '6': '1.5rem',
      '8': '2rem',
      '10': '2.5rem',
      '12': '3rem',
      '16': '4rem',
      '20': '5rem',
      '24': '6rem',
      '32': '8rem',
      '40': '10rem',
      '48': '12rem',
      '56': '14rem',
      '64': '16rem',
      '72': '18rem',
      '80': '20rem',
      '96': '24rem',
      'auto': 'auto'
    };
    return values[size] || '0';
  }

  /**
   * Get spacing side
   */
  private getSpacingSide(side: string): string {
    const sides: Record<string, string> = {
      't': 'top',
      'r': 'right',
      'b': 'bottom',
      'l': 'left',
      'x': 'left', // For horizontal, we'll handle this differently
      'y': 'top', // For vertical, we'll handle this differently
      '': ''
    };
    return sides[side] || '';
  }

  /**
   * Test responsive layout
   */
  async testResponsiveLayout(layoutId: string, deviceProfile: string): Promise<{
    score: number;
    issues: string[];
    suggestions: string[];
    performance: any;
  }> {
    const layout = this.adaptiveLayouts.get(layoutId);
    const device = this.deviceProfiles.get(deviceProfile);

    if (!layout || !device) {
      throw new Error('Layout or device profile not found');
    }

    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Test layout structure
    this.testLayoutStructure(layout, device, issues, suggestions);

    // Test performance
    const performance = await this.analyzeLayoutPerformance(layout, device);

    // Calculate score based on issues
    score = Math.max(0, 100 - (issues.length * 10));

    return {
      score,
      issues,
      suggestions,
      performance
    };
  }

  /**
   * Test layout structure
   */
  private testLayoutStructure(
    layout: AdaptiveLayout,
    device: DeviceProfile,
    issues: string[],
    suggestions: string[]
  ): void {
    // Test viewport compatibility
    if (device.mobile && !layout.structure.main.responsive.mobile) {
      issues.push('Main content not optimized for mobile viewport');
      suggestions.push('Implement mobile-first approach with responsive main content');
    }

    // Test touch compatibility
    if (device.touch && !layout.structure.header.props.style?.touch) {
      issues.push('Header not optimized for touch interaction');
      suggestions.push('Increase touch target sizes and add touch-friendly navigation');
    }

    // Test performance implications
    if (layout.structure.sidebar.responsive.mobile?.display !== 'none') {
      issues.push('Sidebar visible on mobile may impact performance');
      suggestions.push('Implement lazy loading for mobile sidebar content');
    }
  }

  /**
   * Analyze layout performance
   */
  private async analyzeLayoutPerformance(layout: AdaptiveLayout, device: DeviceProfile): Promise<any> {
    const analysis = {
      loadTime: 0,
      fileSize: 0,
      complexity: 0,
      accessibility: 0,
      optimization: 0
    };

    // Simulate performance analysis
    analysis.loadTime = Math.random() * 2000 + 500; // 500-2500ms
    analysis.fileSize = Math.random() * 100 + 50; // 50-150KB
    analysis.complexity = Math.random() * 10 + 5; // 5-15 complexity score
    analysis.accessibility = Math.random() * 30 + 70; // 70-100 accessibility score
    analysis.optimization = Math.random() * 25 + 75; // 75-100 optimization score

    return analysis;
  }

  /**
   * Get device profile
   */
  getDeviceProfile(deviceName: string): DeviceProfile | null {
    return this.deviceProfiles.get(deviceName) || null;
  }

  /**
   * Get all device profiles
   */
  getAllDeviceProfiles(): DeviceProfile[] {
    return Array.from(this.deviceProfiles.values());
  }

  /**
   * Get responsive configuration
   */
  getResponsiveConfig(): ResponsiveConfig {
    return { ...this.responsiveConfig };
  }

  /**
   * Get adaptive layout
   */
  getAdaptiveLayout(layoutId: string): AdaptiveLayout | null {
    return this.adaptiveLayouts.get(layoutId) || null;
  }

  /**
   * Export responsive styles
   */
  async exportResponsiveStyles(): Promise<{
    css: string;
    classes: Record<string, string>;
    config: ResponsiveConfig;
  }> {
    const gridClasses = await this.generateGridClasses();
    const typographyClasses = await this.generateTypographyClasses();
    const spacingClasses = await this.generateSpacingClasses();

    const allClasses = {
      ...gridClasses,
      ...typographyClasses,
      ...spacingClasses
    };

    const css = await this.generateResponsiveCSS('responsive-container', {
      mobile: { padding: '0 16px' },
      tablet: { padding: '0 20px' },
      desktop: { padding: '0 24px', maxWidth: '1200px' },
      'desktop-wide': { maxWidth: '1400px' }
    });

    return {
      css,
      classes: allClasses,
      config: this.responsiveConfig
    };
  }
}

// Export singleton instance
export const responsiveDesignAgent = new ResponsiveDesignAgent();