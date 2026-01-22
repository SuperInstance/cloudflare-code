# ClaudeFlare VS Code Extension

A powerful VS Code extension that brings ClaudeFlare's distributed AI coding platform directly to your editor. Features intelligent code completion, inline chat, multi-agent orchestration, and seamless integration with your development workflow.

## Features

### 🤖 AI-Powered Code Completion
- **Inline Completion**: Real-time code suggestions as you type
- **Context-Aware**: Understands your project structure and coding patterns
- **Multi-Language Support**: TypeScript, JavaScript, Python, Go, Rust, Java, and more

### 💬 Intelligent Chat Interface
- **Sidebar Chat Panel**: Access ClaudeFlare AI without leaving your editor
- **Streaming Responses**: See AI responses in real-time
- **Code Actions**: Apply suggestions directly from chat
- **Conversation History**: Access previous conversations and continue where you left off

### 🔧 Code Refactoring & Optimization
- **Smart Refactoring**: Simplify, optimize, and modernize your code
- **Type Safety**: Add type annotations automatically
- **Extract Function/Variable**: Refactor selected code into reusable components
- **Code Explanations**: Get detailed explanations of complex code

### 🧪 Test Generation
- **Automated Test Creation**: Generate unit tests from your code
- **Multiple Frameworks**: Jest, Mocha, pytest, JUnit, and more
- **Coverage Analysis**: Ensure your tests cover important code paths

### 📚 Documentation Generation
- **Auto-Documentation**: Generate JSDoc, TSDoc, and other documentation formats
- **Code Comments**: Add helpful comments to your code
- **README Generation**: Create comprehensive documentation for your projects

### 🔍 Code Review & Analysis
- **Automated Reviews**: Get AI-powered code reviews
- **PR Integration**: Review pull requests automatically
- **Issue Detection**: Find bugs, security issues, and performance problems
- **Best Practices**: Ensure your code follows industry standards

### 🤖 Multi-Agent Orchestration
- **Parallel Execution**: Run multiple AI agents simultaneously
- **Specialized Agents**:
  - Code Analyst - Analyze code structure and patterns
  - Refactor Agent - Optimize and improve code
  - Test Generator - Create comprehensive tests
  - Debug Assistant - Identify and fix issues
  - Security Scanner - Find vulnerabilities
  - Performance Optimizer - Improve code performance
  - Documentation Writer - Generate documentation
  - Code Reviewer - Ensure code quality

### 🐛 Debugging Assistance
- **Error Analysis**: Understand and fix errors
- **Stack Trace Analysis**: Get help with stack traces
- **Issue Diagnosis**: Identify root causes of problems
- **Fix Suggestions**: Receive actionable fix recommendations

## Installation

### From Marketplace (Coming Soon)
```
code --install-extension claudeflare.claudeflare-vscode
```

### From Source
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run compile`
4. Install in VS Code: `code --install-extension .`

## Configuration

The extension requires a ClaudeFlare API key. Get your key at [https://claudeflare.dev](https://claudeflare.dev).

### Settings

Open VS Code Settings and search for "ClaudeFlare" to configure:

- `claudeflare.apiEndpoint`: ClaudeFlare API endpoint (default: https://api.claudeflare.dev)
- `claudeflare.apiKey`: Your ClaudeFlare API key
- `claudeflare.model`: AI model to use (default: claude-opus-4-5)
- `claudeflare.temperature`: Response creativity (0.0 - 1.0, default: 0.7)
- `claudeflare.maxTokens`: Maximum response length (default: 4096)
- `claudeflare.enableCompletion`: Enable inline code completion (default: true)
- `claudeflare.enableInlineChat`: Enable inline chat (default: true)
- `claudeflare.completionDebounce`: Debounce delay for completions in ms (default: 150)

## Usage

### Keyboard Shortcuts

- `Ctrl+Shift+/` (Mac: `Cmd+Shift+/`): Open Chat
- `Ctrl+Shift+E` (Mac: `Cmd+Shift+E`): Explain selected code
- `Ctrl+Shift+G` (Mac: `Cmd+Shift+G`): Generate code
- `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`): Refactor selected code
- `Ctrl+Shift+I` (Mac: `Cmd+Shift+I`): Inline chat with selection
- `Tab`: Accept inline suggestion
- `Escape`: Dismiss inline suggestion

### Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for "ClaudeFlare":

#### Chat Commands
- `ClaudeFlare: Open Chat` - Open the chat sidebar
- `ClaudeFlare: Chat with ClaudeFlare (Inline)` - Start inline chat with selection
- `ClaudeFlare: Clear Chat History` - Clear all conversation history

#### Code Commands
- `ClaudeFlare: Explain Code` - Get AI explanation of selected code
- `ClaudeFlare: Generate Code` - Generate code from description
- `ClaudeFlare: Fix Code Issues` - Fix issues in selected code
- `ClaudeFlare: Optimize Code` - Optimize selected code for performance

#### Refactoring Commands
- `ClaudeFlare: Refactor` - Refactor selected code
- `ClaudeFlare: Simplify` - Simplify complex code
- `ClaudeFlare: Add Types` - Add type annotations
- `ClaudeFlare: Modernize` - Update to modern syntax

#### Testing & Documentation
- `ClaudeFlare: Generate Tests` - Generate unit tests
- `ClaudeFlare: Generate Documentation` - Add documentation to code

#### Debugging
- `ClaudeFlare: Debug Issue` - Get help debugging an issue
- `ClaudeFlare: Analyze Error` - Analyze errors in your code
- `ClaudeFlare: Analyze Stack Trace` - Analyze stack traces from clipboard

#### Code Review
- `ClaudeFlare: Review Pull Request` - Review current PR
- `ClaudeFlare: Review Changes` - Review uncommitted changes

#### Multi-Agent
- `ClaudeFlare: Multi-Agent Orchestration` - Run multiple agents on a task
- `ClaudeFlare: Analyze Project Context` - Analyze project structure

#### Configuration
- `ClaudeFlare: Configure` - Open configuration options
- `ClaudeFlare: Authenticate` - Set API key

## Architecture

### Project Structure
```
packages/vscode/
├── src/
│   ├── extension.ts           # Main extension entry point
│   ├── types/                 # TypeScript type definitions
│   ├── services/              # Core services
│   │   ├── apiClient.ts       # API communication
│   │   ├── configuration.ts   # Configuration management
│   │   ├── telemetry.ts       # Usage tracking
│   │   ├── projectContext.ts  # Project analysis
│   │   └── gitIntegration.ts  # Git & PR integration
│   ├── providers/             # Language feature providers
│   │   ├── completionProvider.ts
│   │   ├── inlineCompletionProvider.ts
│   │   ├── hoverProvider.ts
│   │   ├── codeActionProvider.ts
│   │   └── diagnosticsProvider.ts
│   ├── views/                 # Webview providers
│   │   ├── chatWebview.ts
│   │   ├── agentsView.ts
│   │   ├── contextView.ts
│   │   └── historyView.ts
│   ├── commands/              # Command handlers
│   │   ├── chatCommands.ts
│   │   ├── codeCommands.ts
│   │   ├── refactorCommands.ts
│   │   ├── testCommands.ts
│   │   ├── configCommands.ts
│   │   ├── debugCommands.ts
│   │   └── agentCommands.ts
│   └── utils/                 # Utility functions
│       ├── logger.ts
│       ├── statusBar.ts
│       └── decorator.ts
├── package.json               # Extension manifest
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Development

### Prerequisites
- Node.js 20+
- npm 10+
- TypeScript 5.3+

### Building
```bash
npm install
npm run compile
```

### Watching for Changes
```bash
npm run watch
```

### Linting
```bash
npm run lint
```

### Testing
```bash
npm test
```

### Running in VS Code
1. Press `F5` to launch a new VS Code window with the extension loaded
2. Make changes to the source code
3. Press `Ctrl+R` (or `Cmd+R` on Mac) to reload the window

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Support

- 📖 [Documentation](https://docs.claudeflare.dev)
- 💬 [Discord](https://discord.gg/claudeflare)
- 🐛 [Bug Reports](https://github.com/claudeflare/claudeflare/issues)
- ✨ [Feature Requests](https://github.com/claudeflare/claudeflare/discussions)

## Changelog

See [CHANGELOG.md](../../CHANGELOG.md) for version history.

## Acknowledgments

Built with ❤️ by the ClaudeFlare team. Powered by Cloudflare Workers and Claude AI.
