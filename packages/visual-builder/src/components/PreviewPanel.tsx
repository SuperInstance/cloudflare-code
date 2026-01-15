/**
 * Preview Panel - Real-time preview of generated application
 */

import React, { useState, useEffect } from 'react';
import { useVisualBuilder } from '../context/VisualBuilderContext';
import { ServiceNode, Connection } from '../types';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Tabs } from '../components/Tab';

interface PreviewPanelProps {
  width: number;
  height: number;
}

interface PreviewFile {
  path: string;
  content: string;
  language: string;
}

interface ServicePreview {
  id: string;
  type: ServiceNode['type'];
  name: string;
  files: PreviewFile[];
  dependencies: string[];
  buildCommand: string;
  startCommand: string;
}

export function PreviewPanel({ width, height }: PreviewPanelProps) {
  const { state } = useVisualBuilder();
  const [activePreviewTab, setActivePreviewTab] = useState('overview');
  const [generatedCode, setGeneratedCode] = useState<Record<string, ServicePreview>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<string>('');

  // Generate code preview for services
  const generateServicePreview = (service: ServiceNode): ServicePreview => {
    switch (service.type) {
      case 'worker':
        return {
          id: service.id,
          type: 'worker',
          name: service.name,
          files: [
            {
              path: `src/services/${service.name.toLowerCase().replace(/\s+/g, '-')}.ts`,
              content: generateWorkerCode(service),
              language: 'typescript'
            },
            {
              path: 'wrangler.toml',
              content: generateWranglerConfig(service),
              language: 'toml'
            }
          ],
          dependencies: ['hono', 'zod'],
          buildCommand: 'npm run build',
          startCommand: 'npm run dev'
        };

      case 'page':
        return {
          id: service.id,
          type: 'page',
          name: service.name,
          files: [
            {
              path: `src/pages/${service.name.toLowerCase().replace(/\s+/g, '-')}.html`,
              content: generateHTMLCode(service),
              language: 'html'
            },
            {
              path: `src/pages/${service.name.toLowerCase().replace(/\s+/g, '-')}.css`,
              content: generateCSSCode(),
              language: 'css'
            }
          ],
          dependencies: [],
          buildCommand: 'npm run build',
          startCommand: 'npm run dev'
        };

      case 'database':
        return {
          id: service.id,
          type: 'database',
          name: service.name,
          files: [
            {
              path: `schema.sql`,
              content: generateDatabaseSchema(),
              language: 'sql'
            }
          ],
          dependencies: [],
          buildCommand: '',
          startCommand: ''
        };

      default:
        return {
          id: service.id,
          type: service.type,
          name: service.name,
          files: [],
          dependencies: [],
          buildCommand: '',
          startCommand: ''
        };
    }
  };

  // Generate worker code
  const generateWorkerCode = (service: ServiceNode): string => {
    const envVars = Object.entries(service.config.environmentVariables)
      .map(([key, value]) => `  ${key}: ${value ? `"${value}"` : '""'}`)
      .join(',\n');

    return `/**
 * ${service.name}
 * ${service.description}
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: '${service.name}' });
});

// Main route
app.get('/', (c) => {
  return c.json({
    message: 'Welcome to ${service.name}',
    timestamp: new Date().toISOString()
  });
});

// Environment variables
const ENV = {
${envVars}
} as const;

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    // Handle scheduled events
    console.log('Worker executed:', event.scheduledTime);
  }
};
`;
  };

  // Generate wrangler config
  const generateWranglerConfig = (service: ServiceNode): string =>
`name = "${service.name}"
main = "dist/index.js"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production" }

[env.staging]
vars = { ENVIRONMENT = "staging" }
`;

  // Generate HTML code
  const generateHTMLCode = (service: ServiceNode): string =>
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${service.name}</title>
  <link rel="stylesheet" href="${service.name.toLowerCase().replace(/\s+/g, '-')}.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>${service.name}</h1>
      <p>${service.description}</p>
    </header>
    <main>
      <section class="content">
        <h2>Welcome</h2>
        <p>Your ${service.type} page is ready!</p>
      </section>
    </main>
    <footer>
      <p>&copy; 2024 ${service.name}. Powered by Cloudflare Pages.</p>
    </footer>
  </div>
</body>
</html>`;

  // Generate CSS code
  const generateCSSCode = (): string =>
`body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  margin: 0;
  padding: 0;
  background-color: #f8fafc;
  color: #1e293b;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

header {
  text-align: center;
  margin-bottom: 3rem;
}

h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.content {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

footer {
  text-align: center;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
}`;

  // Generate database schema
  const generateDatabaseSchema = (): string =>
`-- ClaudeFlare D1 Database Schema
-- Generated for ${state.project.name}

-- Tables
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  author_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  post_id INTEGER,
  author_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_author ON comments(author_id);

-- Cloudflare D1 Specific Configuration
PRAGMA user_version = 1;`;

  // Generate code for all services
  const generateAllCode = async () => {
    setIsGenerating(true);
    try {
      const code: Record<string, ServicePreview> = {};

      for (const service of state.canvas.services) {
        code[service.id] = generateServicePreview(service);
      }

      setGeneratedCode(code);

      // Set first service as current preview
      if (state.canvas.services.length > 0) {
        setCurrentPreview(state.canvas.services[0].id);
      }
    } catch (error) {
      console.error('Failed to generate code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate code when services change
  useEffect(() => {
    generateAllCode();
  }, [state.canvas.services]);

  // Get current preview
  const currentServicePreview = currentPreview ? generatedCode[currentPreview] : null;

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <div className="preview-title">
          <Icon name="Eye" size={24} />
          <h2>Preview</h2>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={generateAllCode}
          disabled={isGenerating || state.canvas.services.length === 0}
        >
          {isGenerating ? 'Generating...' : 'Generate Code'}
        </Button>
      </div>

      <Tabs
        activeTab={activePreviewTab}
        onTabChange={setActivePreviewTab}
        className="preview-tabs"
      >
        <Tab id="overview" label="Overview">
          <div className="overview-content">
            <div className="overview-stats">
              <div className="stat-item">
                <span className="stat-value">{state.canvas.services.length}</span>
                <span className="stat-label">Services</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{state.canvas.connections.length}</span>
                <span className="stat-label">Connections</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {Object.values(generatedCode).reduce((total, preview) => total + preview.files.length, 0)}
                </span>
                <span className="stat-label">Files</span>
              </div>
            </div>

            <div className="preview-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Export all code
                  const allFiles = Object.values(generatedCode).flatMap(preview => preview.files);
                  const zipContent = generateZipContent(allFiles);
                  downloadZip('cloudeflare-project.zip', zipContent);
                }}
                disabled={Object.keys(generatedCode).length === 0}
              >
                <Icon name="Download" size={16} />
                Export All
              </Button>
            </div>

            <div className="service-selector">
              <h3>Select Service to Preview</h3>
              <div className="service-list">
                {state.canvas.services.map((service) => (
                  <button
                    key={service.id}
                    className={`service-item ${currentPreview === service.id ? 'active' : ''}`}
                    onClick={() => setCurrentPreview(service.id)}
                  >
                    <Icon name="Code" size={16} />
                    <span>{service.name}</span>
                    <span className="service-type">{service.type}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Tab>

        <Tab id="code" label="Code">
          {currentServicePreview ? (
            <div className="code-preview">
              <div className="code-header">
                <h3>{currentServicePreview.name} ({currentServicePreview.type})</h3>
                <div className="code-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const content = currentServicePreview.files
                        .map(file => `// ${file.path}\n${file.content}\n`)
                        .join('\n');
                      downloadFile(`${currentServicePreview.name}.txt`, content);
                    }}
                  >
                    <Icon name="Download" size={16} />
                  </Button>
                </div>
              </div>

              <div className="code-files">
                {currentServicePreview.files.map((file) => (
                  <div key={file.path} className="code-file">
                    <div className="file-header">
                      <span className="file-path">{file.path}</span>
                      <span className="file-language">{file.language}</span>
                    </div>
                    <pre className="file-content">
                      <code className={`language-${file.language}`}>
                        {file.content}
                      </code>
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-preview">
              <Icon name="Code" size={48} />
              <p>Select a service to view code</p>
            </div>
          )}
        </Tab>

        <Tab id="config" label="Configuration">
          {state.canvas.services.length > 0 ? (
            <div className="config-preview">
              <div className="config-sections">
                <div className="config-section">
                  <h3>Wrangler.toml (All Services)</h3>
                  <pre className="config-content">
                    {generateWranglerToml()}
                  </pre>
                </div>

                <div className="config-section">
                  <h3>Package.json</h3>
                  <pre className="config-content">
                    {generatePackageJson()}
                  </pre>
                </div>

                <div className="config-section">
                  <h3>README.md</h3>
                  <pre className="config-content">
                    {generateReadme()}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-config">
              <Icon name="Settings" size={48} />
              <p>Add services to generate configuration</p>
            </div>
          )}
        </Tab>
      </Tabs>
    </div>
  );
}

// Helper functions
function generateZipContent(files: PreviewFile[]): string {
  // In a real implementation, this would generate a ZIP file
  // For now, return a text representation
  return files.map(file => `// ${file.path}\n${file.content}\n\n---\n\n`).join('');
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadZip(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateWranglerToml(): string {
  return `# ClaudeFlare Wrangler Configuration
name = "cloudeflare-app"
compatibility_date = "2024-01-01"

# Services configuration
[env.production]
vars = { ENVIRONMENT = "production" }

[env.staging]
vars = { ENVIRONMENT = "staging" }`;
}

function generatePackageJson(): string {
  return `{
  "name": "cloudeflare-app",
  "version": "1.0.0",
  "description": "Generated by ClaudeFlare Visual Builder",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "build": "tsc",
    "format": "prettier --write \"**/*.{ts,js,json,md}\""
  },
  "dependencies": {
    "hono": "^3.12.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "wrangler": "^3.0.0",
    "prettier": "^3.0.0"
  }
}`;
}

function generateReadme(): string {
  return `# ClaudeFlare Application

Generated by ClaudeFlare Visual Builder

## Project Overview

This is a serverless application built with Cloudflare Workers and Pages.

## Services

${Array.from({ length: 5 }, (_, i) => `
### Service ${i + 1}
- Type: Worker/Database/Storage
- Description: Service description
- Runtime: Cloudflare Workers
`).join('')}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure your environment:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Deploy to Cloudflare:
   \`\`\`bash
   npm run deploy
   \`\`\`

## Development

Run the development server:
\`\`\`bash
npm run dev
\`\`\`

## License

MIT`;
}