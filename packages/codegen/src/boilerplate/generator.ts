/**
 * Boilerplate Generator
 * Generates project scaffolding and boilerplate code
 */

import { Language } from '../types/index.js';
import { TemplateEngine } from '../templates/engine.js';
import { FileManager } from '../utils/file-manager.js';

/**
 * Project template
 */
export interface ProjectTemplate {
  name: string;
  description: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'cli' | 'library' | 'service';
  language: Language;
  framework?: string;
  files: TemplateFile[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  config?: Record<string, unknown>;
}

/**
 * Template file
 */
export interface TemplateFile {
  path: string;
  content: string;
  executable?: boolean;
  template?: boolean;
}

/**
 * Boilerplate generation options
 */
export interface BoilerplateOptions {
  name: string;
  template: ProjectTemplate | string;
  outputPath: string;
  variables?: Record<string, unknown>;
  features?: string[];
  config?: {
    gitInit?: boolean;
    installDeps?: boolean;
    createReadme?: boolean;
    createLicense?: boolean;
    linter?: boolean;
    formatter?: boolean;
    tests?: boolean;
    ci?: boolean;
  };
}

/**
 * Generated boilerplate result
 */
export interface BoilerplateResult {
  projectName: string;
  filesCreated: string[];
  commands: string[];
  nextSteps: string[];
}

/**
 * Boilerplate Generator class
 */
export class BoilerplateGenerator {
  private templateEngine: TemplateEngine;
  private fileManager: FileManager;

  constructor() {
    this.templateEngine = new TemplateEngine();
    this.fileManager = new FileManager();
  }

  /**
   * Generate project from template
   */
  async generate(options: BoilerplateOptions): Promise<BoilerplateResult> {
    const template = typeof options.template === 'string'
      ? await this.loadTemplate(options.template)
      : options.template;

    const filesCreated: string[] = [];

    // Create output directory
    const projectPath = `${options.outputPath}/${options.name}`;
    await this.fileManager.ensureDir(projectPath);

    // Generate files from template
    for (const file of template.files) {
      let content = file.content;

      // Apply template engine if file is a template
      if (file.template || content.includes('{{')) {
        content = await this.templateEngine.render(content, {
          projectName: options.name,
          ...options.variables
        });
      }

      const filePath = `${projectPath}/${file.path}`;
      await this.fileManager.ensureDir(this.fileManager.dirname(filePath));
      await this.fileManager.writeFile(filePath, content, {
        executable: file.executable
      });

      filesCreated.push(filePath);
    }

    // Generate package.json for Node.js projects
    if ([Language.TypeScript, Language.JavaScript].includes(template.language)) {
      const packageJsonPath = `${projectPath}/package.json`;
      const packageJson = this.generatePackageJson(template, options);
      await this.fileManager.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      filesCreated.push(packageJsonPath);
    }

    // Generate README if requested
    if (options.config?.createReadme) {
      const readmePath = `${projectPath}/README.md`;
      const readme = this.generateReadme(template, options);
      await this.fileManager.writeFile(readmePath, readme);
      filesCreated.push(readmePath);
    }

    // Generate LICENSE if requested
    if (options.config?.createLicense) {
      const licensePath = `${projectPath}/LICENSE`;
      const license = this.generateLicense(template, options);
      await this.fileManager.writeFile(licensePath, license);
      filesCreated.push(licensePath);
    }

    // Initialize git if requested
    if (options.config?.gitInit) {
      await this.initializeGit(projectPath);
      filesCreated.push(`${projectPath}/.git`);
    }

    // Generate setup commands and next steps
    const commands = this.generateSetupCommands(template, options);
    const nextSteps = this.generateNextSteps(template, options);

    return {
      projectName: options.name,
      filesCreated,
      commands,
      nextSteps
    };
  }

  /**
   * Load template by name
   */
  private async loadTemplate(name: string): Promise<ProjectTemplate> {
    const templates = this.getAvailableTemplates();

    if (!(name in templates)) {
      throw new Error(`Template "${name}" not found. Available templates: ${Object.keys(templates).join(', ')}`);
    }

    return templates[name as keyof typeof templates];
  }

  /**
   * Get available templates
   */
  private getAvailableTemplates(): Record<string, ProjectTemplate> {
    return {
      'express-ts': {
        name: 'Express TypeScript',
        description: 'Express.js server with TypeScript',
        type: 'backend',
        language: Language.TypeScript,
        framework: 'express',
        files: this.getExpressTsTemplateFiles(),
        dependencies: {
          express: '^4.18.0',
          cors: '^2.8.5',
          helmet: '^7.1.0',
          dotenv: '^16.3.1',
          'express-async-errors': '^3.1.1'
        },
        devDependencies: {
          typescript: '^5.3.0',
          '@types/express': '^4.17.21',
          '@types/node': '^20.10.0',
          '@types/cors': '^2.8.17',
          'ts-node': '^10.9.2',
          'nodemon': '^3.0.2',
          'jest': '^29.7.0',
          '@types/jest': '^29.5.11',
          'ts-jest': '^29.1.1',
          'eslint': '^8.56.0',
          '@typescript-eslint/eslint-plugin': '^6.19.0',
          '@typescript-eslint/parser': '^6.19.0',
          prettier: '^3.2.0'
        },
        scripts: {
          dev: 'nodemon src/index.ts',
          build: 'tsc',
          start: 'node dist/index.js',
          test: 'jest',
          'test:watch': 'jest --watch',
          lint: 'eslint src --ext .ts',
          'lint:fix': 'eslint src --ext .ts --fix',
          format: 'prettier --write "src/**/*.ts"',
          'typecheck': 'tsc --noEmit'
        }
      },

      'react-ts': {
        name: 'React TypeScript',
        description: 'React application with TypeScript and Vite',
        type: 'frontend',
        language: Language.TypeScript,
        framework: 'react',
        files: this.getReactTsTemplateFiles(),
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          'react-router-dom': '^6.21.0'
        },
        devDependencies: {
          typescript: '^5.3.0',
          '@types/react': '^18.2.47',
          '@types/react-dom': '^18.2.18',
          vite: '^5.0.11',
          '@vitejs/plugin-react': '^4.2.1',
          'jest': '^29.7.0',
          '@testing-library/react': '^14.1.2',
          '@testing-library/jest-dom': '^6.1.5',
          '@testing-library/user-event': '^14.5.1',
          'eslint': '^8.56.0',
          'eslint-plugin-react': '^7.33.2',
          'eslint-plugin-react-hooks': '^4.6.0',
          prettier: '^3.2.0'
        },
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
          test: 'jest',
          'test:watch': 'jest --watch',
          lint: 'eslint src --ext ts,tsx',
          'lint:fix': 'eslint src --ext ts,tsx --fix',
          format: 'prettier --write "src/**/*.{ts,tsx}"',
          typecheck: 'tsc --noEmit'
        }
      },

      'python-fastapi': {
        name: 'Python FastAPI',
        description: 'FastAPI server with Python',
        type: 'backend',
        language: Language.Python,
        framework: 'fastapi',
        files: this.getFastApiTemplateFiles(),
        dependencies: {
          fastapi: '^0.109.0',
          uvicorn: '^0.27.0',
          pydantic: '^2.5.3',
          'python-dotenv': '^1.0.0',
          pydantic_settings: '^2.1.0'
        },
        devDependencies: {
          pytest: '^7.4.3',
          'pytest-asyncio': '^0.23.3',
          pytest_cov: '^4.1.0',
          black: '^24.1.1',
          pylint: '^3.0.3',
          mypy: '^1.8.0'
        },
        scripts: {
          dev: 'uvicorn src.main:app --reload',
          start: 'uvicorn src.main:app --host 0.0.0.0 --port 8000',
          test: 'pytest',
          'test:coverage': 'pytest --cov=src --cov-report=html',
          lint: 'pylint src',
          format: 'black src',
          'type-check': 'mypy src'
        }
      },

      'go-service': {
        name: 'Go Service',
        description: 'Go microservice with standard library',
        type: 'service',
        language: Language.Go,
        files: this.getGoServiceTemplateFiles(),
        dependencies: {},
        devDependencies: {},
        scripts: {
          dev: 'go run main.go',
          build: 'go build -o bin/server',
          test: 'go test -v ./...',
          'test:coverage': 'go test -coverprofile=coverage.out ./...',
          lint: 'golangci-lint run',
          fmt: 'go fmt ./...'
        }
      }
    };
  }

  /**
   * Get Express TypeScript template files
   */
  private getExpressTsTemplateFiles(): TemplateFile[] {
    return [
      {
        path: 'src/index.ts',
        content: `import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to {{projectName}}' });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(\`Server is running on port \${PORT}\`);
});

export default app;`,
        template: true
      },
      {
        path: 'src/routes/index.ts',
        content: `import { Router } from 'express';

const router = Router();

// Add your routes here

export default router;`
      },
      {
        path: 'src/middleware/errorHandler.ts',
        content: `import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public statusCode: number, public message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
}`
      },
      {
        path: '.env.example',
        content: `PORT=3000
NODE_ENV=development
LOG_LEVEL=info`
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
.env
.DS_Store
*.log
coverage/`
      },
      {
        path: 'tsconfig.json',
        content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`
      }
    ];
  }

  /**
   * Get React TypeScript template files
   */
  private getReactTsTemplateFiles(): TemplateFile[] {
    return [
      {
        path: 'src/main.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);`
      },
      {
        path: 'src/App.tsx',
        content: `import { Routes, Route } from 'react-router-dom';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>Welcome to {{projectName}}</h1>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </div>
  );
}

export default App;`,
        template: true
      },
      {
        path: 'src/App.css',
        content: `.App {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}`
      },
      {
        path: 'src/index.css',
        content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        template: true
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
});`
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
.env
.DS_Store
*.log
coverage/`
      },
      {
        path: 'tsconfig.json',
        content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`
      }
    ];
  }

  /**
   * Get FastAPI template files
   */
  private getFastApiTemplateFiles(): TemplateFile[] {
    return [
      {
        path: 'src/main.py',
        content: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="{{projectName}}",
    description="API generated with ClaudeFlare",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to {{projectName}}"}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)`,
        template: true
      },
      {
        path: 'src/config.py',
        content: `from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "{{projectName}}"
    debug: bool = False
    database_url: str = ""

    class Config:
        env_file = ".env"

settings = Settings()`,
        template: true
      },
      {
        path: '.env.example',
        content: `DEBUG=False
DATABASE_URL=sqlite:///./test.db`
      },
      {
        path: '.gitignore',
        content: `__pycache__/
*.py[cod]
*$py.class
.env
.venv/
venv/
dist/
*.egg-info/`
      },
      {
        path: 'requirements.txt',
        content: `fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.5.3
python-dotenv>=1.0.0
pydantic-settings>=2.1.0`
      },
      {
        path: 'requirements-dev.txt',
        content: `pytest>=7.4.3
pytest-asyncio>=0.23.3
pytest-cov>=4.1.0
black>=24.1.1
pylint>=3.0.3
mypy>=1.8.0`
      }
    ];
  }

  /**
   * Get Go service template files
   */
  private getGoServiceTemplateFiles(): TemplateFile[] {
    return [
      {
        path: 'main.go',
        content: `package main

import (
    "fmt"
    "log"
    "net/http"
    "os"
)

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Welcome to {{projectName}}")
    })

    http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, ` + "`" + `{"status":"ok"}` + "`" + `)
    })

    log.Printf("Server starting on port %s", port)
    if err := http.ListenAndServe(":"+port, nil); err != nil {
        log.Fatal(err)
    }
}`,
        template: true
      },
      {
        path: 'go.mod',
        content: `module github.com/example/{{projectName}}

go 1.21

require ()`,
        template: true
      },
      {
        path: '.env.example',
        content: `PORT=8080`
      },
      {
        path: '.gitignore',
        content: `bin/
*.exe
*.exe~
*.dll
*.so
*.dylib
.env`
      }
    ];
  }

  /**
   * Generate package.json
   */
  private generatePackageJson(template: ProjectTemplate, options: BoilerplateOptions): Record<string, unknown> {
    return {
      name: options.name,
      version: '0.1.0',
      description: template.description,
      main: 'dist/index.js',
      scripts: template.scripts || {},
      dependencies: template.dependencies || {},
      devDependencies: template.devDependencies || {},
      engines: {
        node: '>=18.0.0'
      }
    };
  }

  /**
   * Generate README
   */
  private generateReadme(template: ProjectTemplate, options: BoilerplateOptions): string {
    return `# ${options.name}

${template.description}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
\`\`\`

## Features

${options.features?.map(f => `- ${f}`).join('\n') || '- Feature 1\n- Feature 2'}

## License

MIT
`;
  }

  /**
   * Generate LICENSE
   */
  private generateLicense(_template: ProjectTemplate, _options: BoilerplateOptions): string {
    return `MIT License

Copyright (c) ${new Date().getFullYear()} ${_options.name}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
  }

  /**
   * Initialize git repository
   */
  private async initializeGit(projectPath: string): Promise<void> {
    const { execSync } = await import('child_process');
    try {
      execSync('git init', { cwd: projectPath, stdio: 'ignore' });
      execSync('git add .', { cwd: projectPath, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: projectPath, stdio: 'ignore' });
    } catch (error) {
      console.warn('Failed to initialize git:', error);
    }
  }

  /**
   * Generate setup commands
   */
  private generateSetupCommands(template: ProjectTemplate, options: BoilerplateOptions): string[] {
    const commands: string[] = [];

    commands.push(`cd ${options.name}`);

    if ([Language.TypeScript, Language.JavaScript].includes(template.language)) {
      commands.push('npm install');
      commands.push('npm run dev');
    } else if (template.language === Language.Python) {
      commands.push('python -m venv venv');
      commands.push('source venv/bin/activate  # On Windows: venv\\Scripts\\activate');
      commands.push('pip install -r requirements.txt');
      commands.push('npm run dev');
    } else if (template.language === Language.Go) {
      commands.push('go mod download');
      commands.push('go run main.go');
    }

    return commands;
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(template: ProjectTemplate, options: BoilerplateOptions): string[] {
    return [
      `1. Navigate to your project: cd ${options.name}`,
      `2. Review the generated code`,
      `3. Customize the configuration`,
      `4. Add your business logic`,
      `5. Run tests: ${template.language === Language.Python ? 'pytest' : 'npm test'}`,
      `6. Start building!`
    ];
  }
}
