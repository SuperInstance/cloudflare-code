/**
 * UI Agent - Generates HTML, CSS, components, and layouts
 *
 * Features:
 * - Landing page generation
 * - Responsive layouts
 * - Component templates (React, Vue, vanilla)
 * - Design API integration (Canva Dev, Figma)
 * - File locking for parallel coordination
 * - Progress reporting to coordinator
 */

import type { AgentState, ProjectFile } from '../types';
import type { Bindings } from '../index';

// UI Agent Configuration
interface UIAgentConfig {
  sessionId: string;
  agentId: string;
  provider: 'manus' | 'zai' | 'minimax' | 'claude' | 'grok';
  stateManager: any; // ProjectStateManager
  coordinatorUrl: string;
}

// Generation request types
interface LandingPageRequest {
  title: string;
  tagline: string;
  sections: Array<{
    type: 'hero' | 'features' | 'testimonials' | 'cta' | 'about';
    content: Record<string, unknown>;
  }>;
  theme: 'light' | 'dark' | 'custom';
  colors?: Record<string, string>;
  responsive: boolean;
}

interface ComponentRequest {
  componentName: string;
  componentType: 'react' | 'vue' | 'svelte' | 'web-component';
  template: 'functional' | 'class';
  props: Record<string, { type: string; required: boolean; default?: unknown }>;
  styles: 'css' | 'css-modules' | 'styled-components' | 'tailwind';
}

// Design API integration
interface DesignImportRequest {
  source: 'canva' | 'figma';
  fileId: string;
  accessToken?: string;
}

// Response types
interface GenerationResult {
  success: boolean;
  files: ProjectFile[];
  errors?: string[];
  metadata: {
    generatedAt: number;
    provider: string;
    tokens?: number;
  };
}

export class UIAgent {
  private config: UIAgentConfig;
  private state: AgentState;
  private lockedFiles: Set<string>;
  private generatedFiles: Map<string, ProjectFile>;

  constructor(config: UIAgentConfig) {
    this.config = config;
    this.state = {
      agentId: config.agentId,
      sessionId: config.sessionId,
      agentType: 'ui',
      status: 'idle',
      progress: 0,
      currentTask: undefined,
    };
    this.lockedFiles = new Set();
    this.generatedFiles = new Map();
  }

  /**
   * Main entry point for UI generation tasks
   */
  async generate(request: LandingPageRequest | ComponentRequest): Promise<GenerationResult> {
    await this.updateState('working', 0, 'Starting generation');

    try {
      if ('sections' in request) {
        return await this.generateLandingPage(request);
      } else {
        return await this.generateComponent(request);
      }
    } catch (error) {
      await this.updateState('error', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      await this.releaseAllLocks();
    }
  }

  /**
   * Generate a complete landing page
   */
  async generateLandingPage(request: LandingPageRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, 'Generating landing page structure');

    const files: ProjectFile[] = [];

    // Generate HTML
    const htmlFile = await this.generateHTML(request);
    files.push(htmlFile);

    // Acquire lock for CSS file
    await this.acquireLock('src/styles/main.css');
    await this.updateState('working', 30, 'Generating styles');

    const cssFile = await this.generateCSS(request);
    files.push(cssFile);

    // Generate responsive media queries
    if (request.responsive) {
      const responsiveFile = await this.generateResponsiveCSS(request);
      files.push(responsiveFile);
    }

    // Generate JavaScript for interactivity
    const jsFile = await this.generateJavaScript(request);
    files.push(jsFile);

    await this.updateState('completed', 100, 'Landing page generation complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Generate a reusable component
   */
  async generateComponent(request: ComponentRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, `Generating ${request.componentName} component`);

    const files: ProjectFile[] = [];
    const componentPath = `src/components/${request.componentName}`;

    // Generate component file
    const componentFile = await this.generateComponentFile(request);
    files.push(componentFile);

    // Generate styles
    const stylePath = `${componentPath}.${this.getStyleExtension(request.styles)}`;
    await this.acquireLock(stylePath);
    const styleFile = await this.generateComponentStyles(request);
    files.push(styleFile);

    // Generate test file
    const testFile = await this.generateComponentTest(request);
    files.push(testFile);

    // Generate story/storybook file
    const storyFile = await this.generateComponentStory(request);
    files.push(storyFile);

    await this.updateState('completed', 100, 'Component generation complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Import design from Canva Dev or Figma
   */
  async importDesign(request: DesignImportRequest): Promise<GenerationResult> {
    await this.updateState('working', 10, `Importing design from ${request.source}`);

    let designData;
    if (request.source === 'canva') {
      designData = await this.fetchCanvaDesign(request.fileId, request.accessToken);
    } else {
      designData = await this.fetchFigmaDesign(request.fileId, request.accessToken);
    }

    await this.updateState('working', 50, 'Converting design to code');

    const files = await this.convertDesignToFiles(designData, request.source);

    await this.updateState('completed', 100, 'Design import complete');

    return {
      success: true,
      files,
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  /**
   * Generate responsive layout
   */
  async generateResponsiveLayout(config: {
    type: 'grid' | 'flex' | 'absolute';
    breakpoints: Record<string, number>;
    columns: number;
    gap: number;
  }): Promise<GenerationResult> {
    await this.updateState('working', 10, 'Generating responsive layout');

    const cssFile: ProjectFile = {
      path: 'src/styles/layout.css',
      content: this.generateLayoutCSS(config),
      language: 'css',
      hash: this.generateHash('src/styles/layout.css'),
    };

    await this.updateState('completed', 100, 'Layout generation complete');

    return {
      success: true,
      files: [cssFile],
      metadata: {
        generatedAt: Date.now(),
        provider: this.config.provider,
      },
    };
  }

  // Private helper methods

  private async generateHTML(request: LandingPageRequest): Promise<ProjectFile> {
    const sections = request.sections.map(section =>
      this.generateSectionHTML(section)
    ).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${request.title}</title>
  <link rel="stylesheet" href="/styles/main.css">
  ${request.responsive ? '<link rel="stylesheet" href="/styles/responsive.css">' : ''}
</head>
<body class="${request.theme}">
  <header>
    <nav class="container">
      <div class="logo">${request.title}</div>
      <ul class="nav-links">
        ${request.sections.map(s => `<li><a href="#${s.type}">${s.type}</a></li>`).join('')}
      </ul>
    </nav>
  </header>

  <main>
    ${sections}
  </main>

  <footer>
    <p>&copy; ${new Date().getFullYear()} ${request.title}. All rights reserved.</p>
  </footer>

  <script src="/js/main.js"></script>
</body>
</html>`;

    return {
      path: 'src/index.html',
      content: html,
      language: 'html',
      hash: this.generateHash('src/index.html'),
    };
  }

  private async generateCSS(request: LandingPageRequest): Promise<ProjectFile> {
    const css = `/* Main Styles */
${this.generateThemeCSS(request.theme)}
${request.colors ? this.generateCustomColorsCSS(request.colors) : ''}

/* Base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: var(--text-color);
  background-color: var(--bg-color);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header styles */
header {
  background-color: var(--primary-color);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 1000;
}

nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
}

.nav-links {
  display: flex;
  list-style: none;
  gap: 2rem;
}

.nav-links a {
  color: white;
  text-decoration: none;
  transition: opacity 0.3s;
}

.nav-links a:hover {
  opacity: 0.8;
}

/* Section styles */
section {
  padding: 4rem 0;
}

section:nth-child(even) {
  background-color: var(--secondary-color);
}

/* Hero section */
.hero {
  text-align: center;
  padding: 6rem 0;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
}

/* CTA Button */
.cta-button {
  display: inline-block;
  padding: 1rem 2rem;
  background-color: var(--accent-color);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: bold;
  transition: transform 0.3s, box-shadow 0.3s;
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Footer */
footer {
  background-color: var(--primary-color);
  color: white;
  text-align: center;
  padding: 2rem 0;
  margin-top: 4rem;
}`;

    return {
      path: 'src/styles/main.css',
      content: css,
      language: 'css',
      hash: this.generateHash('src/styles/main.css'),
    };
  }

  private generateThemeCSS(theme: string): string {
    if (theme === 'custom') return '';

    const themes = {
      dark: `:root {
  --primary-color: #667eea;
  --secondary-color: #1a1a2e;
  --accent-color: #f09199;
  --bg-color: #0f0f23;
  --text-color: #ffffff;
  --text-secondary: #b0b0b0;
}`,
      light: `:root {
  --primary-color: #4F46E5;
  --secondary-color: #f3f4f6;
  --accent-color: #00c0ff;
  --bg-color: #ffffff;
  --text-color: #1a2024;
  --text-secondary: #6b7280;
}`,
    };

    return themes[theme as keyof typeof themes] || themes.light;
  }

  private generateCustomColorsCSS(colors: Record<string, string>): string {
    return Object.entries(colors)
      .map(([key, value]) => `  --${key}: ${value};`)
      .join('\n');
  }

  private async generateResponsiveCSS(request: LandingPageRequest): Promise<ProjectFile> {
    const css = `/* Responsive Styles */

/* Tablet */
@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }

  .nav-links {
    gap: 1rem;
  }
}

/* Mobile */
@media (max-width: 480px) {
  .container {
    padding: 0 15px;
  }

  .hero h1 {
    font-size: 1.5rem;
  }

  .nav-links {
    display: none;
  }

  section {
    padding: 2rem 0;
  }
}`;

    return {
      path: 'src/styles/responsive.css',
      content: css,
      language: 'css',
      hash: this.generateHash('src/styles/responsive.css'),
    };
  }

  private async generateJavaScript(request: LandingPageRequest): Promise<ProjectFile> {
    const js = `// Main JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Smooth scrolling for navigation links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });

  // Add scroll animation for sections
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s, transform 0.6s';
    observer.observe(section);
  });
});`;

    return {
      path: 'src/js/main.js',
      content: js,
      language: 'javascript',
      hash: this.generateHash('src/js/main.js'),
    };
  }

  private generateSectionHTML(section: LandingPageRequest['sections'][0]): string {
    const templates = {
      hero: (content: any) => `<section class="hero">
  <div class="container">
    <h1>${content.headline || 'Welcome'}</h1>
    <p>${content.subheadline || ''}</p>
    <a href="#contact" class="cta-button">${content.ctaText || 'Get Started'}</a>
  </div>
</section>`,

      features: (content: any) => `<section class="features">
  <div class="container">
    <h2>Features</h2>
    <div class="features-grid">
      ${(content.features || []).map((f: any) => `
      <div class="feature-card">
        <h3>${f.title}</h3>
        <p>${f.description}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`,

      testimonials: (content: any) => `<section class="testimonials">
  <div class="container">
    <h2>What People Say</h2>
    <div class="testimonials-grid">
      ${(content.testimonials || []).map((t: any) => `
      <div class="testimonial-card">
        <p>"${t.quote}"</p>
        <cite>- ${t.author}, ${t.company}</cite>
      </div>`).join('')}
    </div>
  </div>
</section>`,

      cta: (content: any) => `<section class="cta">
  <div class="container">
    <h2>${content.headline || 'Ready to Get Started?'}</h2>
    <p>${content.subheadline || ''}</p>
    <a href="${content.buttonLink || '#'}" class="cta-button">${content.buttonText || 'Sign Up Now'}</a>
  </div>
</section>`,

      about: (content: any) => `<section class="about">
  <div class="container">
    <h2>About Us</h2>
    <p>${content.description || ''}</p>
  </div>
</section>`,
    };

    return templates[section.type](section.content);
  }

  private async generateComponentFile(request: ComponentRequest): Promise<ProjectFile> {
    let content = '';
    const path = `src/components/${request.componentName}.${this.getComponentExtension(request.componentType)}`;

    switch (request.componentType) {
      case 'react':
        content = this.generateReactComponent(request);
        break;
      case 'vue':
        content = this.generateVueComponent(request);
        break;
      case 'svelte':
        content = this.generateSvelteComponent(request);
        break;
      case 'web-component':
        content = this.generateWebComponent(request);
        break;
    }

    return {
      path,
      content,
      language: 'typescript',
      hash: this.generateHash(path),
    };
  }

  private generateReactComponent(request: ComponentRequest): string {
    const props = Object.entries(request.props)
      .map(([name, config]) => `  ${name}${config.required ? '' : '?'}: ${config.type};`)
      .join('\n');

    if (request.template === 'functional') {
      return `import React from 'react';
import styles from './${request.componentName}.module.css';

interface ${request.componentName}Props {
${props}
}

export const ${request.componentName}: React.FC<${request.componentName}Props> = ({
${Object.keys(request.props).join(', ')},
}) => {
  return (
    <div className={styles.container}>
      {/* Component content */}
    </div>
  );
};

export default ${request.componentName};`;
    } else {
      return `import React from 'react';
import styles from './${request.componentName}.module.css';

interface ${request.componentName}Props {
${props}
}

class ${request.componentName} extends React.Component<${request.componentName}Props> {
  render() {
    return (
      <div className={styles.container}>
        {/* Component content */}
      </div>
    );
  }
}

export default ${request.componentName};`;
    }
  }

  private async generateComponentStyles(request: ComponentRequest): Promise<ProjectFile> {
    const extension = this.getStyleExtension(request.styles);
    const path = `src/components/${request.componentName}.${extension}`;

    let content = '';
    switch (request.styles) {
      case 'css':
        content = `.${request.componentName} {
  /* Component styles */
}`;
        break;
      case 'css-modules':
        content = `.container {
  /* Component styles */
}`;
        break;
      case 'styled-components':
        content = `import styled from 'styled-components';

export const Container = styled.div\`
  /* Component styles */
\`;`;
        break;
      case 'tailwind':
        content = `<div class="flex items-center justify-center">
  <!-- Tailwind classes -->
</div>`;
        break;
    }

    return {
      path,
      content,
      language: 'css',
      hash: this.generateHash(path),
    };
  }

  private async generateComponentTest(request: ComponentRequest): Promise<ProjectFile> {
    const path = `src/components/${request.componentName}.test.ts`;
    const content = `import { render, screen } from '@testing-library/react';
import ${request.componentName} from './${request.componentName}';

describe('${request.componentName}', () => {
  it('renders without crashing', () => {
    render(<${request.componentName} />);
  });

  it('displays correct content', () => {
    render(<${request.componentName} />);
    // Add your test assertions here
  });
});`;

    return {
      path,
      content,
      language: 'typescript',
      hash: this.generateHash(path),
    };
  }

  private async generateComponentStory(request: ComponentRequest): Promise<ProjectFile> {
    const path = `src/components/${request.componentName}.stories.ts`;
    const content = `import type { Meta, StoryObj } from '@storybook/react';
import ${request.componentName} from './${request.componentName}';

const meta: Meta<typeof ${request.componentName}> = {
  title: 'Components/${request.componentName}',
  component: ${request.componentName},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ${request.componentName}>;

export const Primary: Story = {
  args: {},
};`;

    return {
      path,
      content,
      language: 'typescript',
      hash: this.generateHash(path),
    };
  }

  private async fetchCanvaDesign(fileId: string, accessToken?: string): Promise<any> {
    // Integration with Canva Dev API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`https://api.canva.com/rest/v1/files/${fileId}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Canva design: ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchFigmaDesign(fileId: string, accessToken?: string): Promise<any> {
    // Integration with Figma API
    if (!accessToken) {
      throw new Error('Figma access token is required');
    }

    const response = await fetch(`https://api.figma.com/v1/files/${fileId}`, {
      headers: {
        'X-Figma-Token': accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Figma design: ${response.statusText}`);
    }

    return response.json();
  }

  private async convertDesignToFiles(designData: any, source: string): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    // Convert design to HTML/CSS based on source
    // This is a simplified implementation
    const htmlFile: ProjectFile = {
      path: 'src/index.html',
      content: this.convertDesignToHTML(designData, source),
      language: 'html',
      hash: this.generateHash('src/index.html'),
    };

    const cssFile: ProjectFile = {
      path: 'src/styles/main.css',
      content: this.convertDesignToCSS(designData, source),
      language: 'css',
      hash: this.generateHash('src/styles/main.css'),
    };

    files.push(htmlFile, cssFile);

    return files;
  }

  private convertDesignToHTML(designData: any, source: string): string {
    // Implementation for converting design to HTML
    return `<!DOCTYPE html>
<html>
<head>
  <title>Imported from ${source}</title>
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
  <!-- Converted design elements -->
</body>
</html>`;
  }

  private convertDesignToCSS(designData: any, source: string): string {
    // Implementation for converting design to CSS
    return `/* Styles imported from ${source} */
body {
  margin: 0;
  padding: 0;
}`;
  }

  private generateLayoutCSS(config: {
    type: 'grid' | 'flex' | 'absolute';
    breakpoints: Record<string, number>;
    columns: number;
    gap: number;
  }): string {
    const mediaQueries = Object.entries(config.breakpoints)
      .map(([name, width]) => `
@media (max-width: ${width}px) {
  .layout {
    grid-template-columns: repeat(${Math.max(1, Math.floor(config.columns * 0.7))}, 1fr);
  }
}`)
      .join('');

    return `.layout {
  display: ${config.type};
  gap: ${config.gap}px;
}

${config.type === 'grid' ? `
.layout {
  grid-template-columns: repeat(${config.columns}, 1fr);
}
` : ''}
${config.type === 'flex' ? `
.layout {
  flex-wrap: wrap;
}
` : ''}

${mediaQueries}`;
  }

  // State management methods

  private async updateState(
    status: AgentState['status'],
    progress: number,
    currentTask?: string
  ): Promise<void> {
    this.state.status = status;
    this.state.progress = progress;
    this.state.currentTask = currentTask;

    await this.config.stateManager.updateAgent(this.config.sessionId, this.state);
    await this.reportProgress();
  }

  private async reportProgress(): Promise<void> {
    // Send progress update to coordinator
    await fetch(`${this.config.coordinatorUrl}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.config.sessionId,
        agentId: this.config.agentId,
        state: this.state,
      }),
    });
  }

  // File locking methods

  private async acquireLock(filePath: string): Promise<boolean> {
    const acquired = await this.config.stateManager.acquireLock(
      this.config.sessionId,
      filePath,
      this.config.agentId
    );

    if (acquired) {
      this.lockedFiles.add(filePath);
    }

    return acquired;
  }

  private async releaseLock(filePath: string): Promise<void> {
    await this.config.stateManager.releaseLock(this.config.sessionId, filePath);
    this.lockedFiles.delete(filePath);
  }

  private async releaseAllLocks(): Promise<void> {
    for (const filePath of this.lockedFiles) {
      await this.releaseLock(filePath);
    }
  }

  // Utility methods

  private getComponentExtension(type: ComponentRequest['componentType']): string {
    const extensions = {
      react: 'tsx',
      vue: 'vue',
      svelte: 'svelte',
      'web-component': 'ts',
    };
    return extensions[type];
  }

  private getStyleExtension(style: ComponentRequest['styles']): string {
    const extensions = {
      css: 'css',
      'css-modules': 'module.css',
      'styled-components': 'ts',
      tailwind: 'css',
    };
    return extensions[style];
  }

  private generateHash(content: string): string {
    // Simple hash implementation for file integrity
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get current agent state
   */
  async getState(): Promise<AgentState> {
    return { ...this.state };
  }

  /**
   * Complete current task
   */
  async markDone(): Promise<void> {
    await this.updateState('idle', 100, undefined);
  }
}