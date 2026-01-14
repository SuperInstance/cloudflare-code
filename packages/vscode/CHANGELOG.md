# Changelog

All notable changes to the ClaudeFlare VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-13

### Added
- Initial release of ClaudeFlare VS Code extension
- AI-powered inline code completion with streaming support
- Sidebar chat interface with conversation history
- Multi-agent orchestration UI for parallel task execution
- Code explanation and generation commands
- Refactoring support (simplify, optimize, modernize, add types)
- Automated test generation for multiple frameworks
- Documentation generation (JSDoc, TSDoc, reStructuredText, godoc)
- Pull request review and code analysis
- Debug assistance with error and stack trace analysis
- Project context awareness and file tracking
- Git integration for change tracking
- Comprehensive configuration management
- Telemetry and usage tracking (opt-in)
- Status bar integration
- Inline code decorations for suggestions

### Features
- **Inline Completion**: Real-time AI-powered code completions
- **Chat Interface**: Streaming chat with AI agents
- **Code Actions**: Quick actions from right-click menu
- **Hover Provider**: Code explanations on hover
- **Diagnostics**: AI-powered code analysis
- **Multi-Agent Orchestration**: Run 8+ specialized AI agents
- **Code Review**: Automated PR reviews with detailed feedback
- **Test Generation**: Create tests for Jest, Mocha, pytest, and more
- **Documentation**: Auto-generate code documentation

### Commands
- `ClaudeFlare: Open Chat` - Open chat sidebar
- `ClaudeFlare: Explain Code` - Explain selected code
- `ClaudeFlare: Generate Code` - Generate from description
- `ClaudeFlare: Refactor` - Refactor selected code
- `ClaudeFlare: Optimize Code` - Optimize for performance
- `ClaudeFlare: Fix Code Issues` - Fix issues in code
- `ClaudeFlare: Add Tests` - Generate unit tests
- `ClaudeFlare: Add Documentation` - Generate documentation
- `ClaudeFlare: Review Pull Request` - Review PR changes
- `ClaudeFlare: Debug Issue` - Debug assistance
- `ClaudeFlare: Multi-Agent Orchestration` - Run multiple agents
- `ClaudeFlare: Configure` - Configure extension
- `ClaudeFlare: Authenticate` - Set API key

### Keyboard Shortcuts
- `Ctrl+Shift+/` - Open Chat
- `Ctrl+Shift+E` - Explain Code
- `Ctrl+Shift+G` - Generate Code
- `Ctrl+Shift+R` - Refactor
- `Ctrl+Shift+I` - Inline Chat
- `Tab` - Accept Suggestion
- `Escape` - Dismiss Suggestion

### Configuration
- `claudeflare.apiEndpoint` - API endpoint
- `claudeflare.apiKey` - API key
- `claudeflare.model` - AI model selection
- `claudeflare.temperature` - Response creativity
- `claudeflare.maxTokens` - Response length
- `claudeflare.enableCompletion` - Enable completions
- `claudeflare.enableInlineChat` - Enable inline chat
- `claudeflare.completionDebounce` - Completion delay
- `claudeflare.contextWindow` - Context size
- `claudeflare.projectContextDepth` - Project analysis depth
- `claudeflare.enableMultiAgent` - Enable multi-agent
- `claudeflare.enableTelemetry` - Enable telemetry
- `claudeflare.theme` - Chat theme
- And many more...

### Language Support
- TypeScript / JavaScript
- Python
- Go
- Rust
- Java
- Kotlin
- C#
- C/C++
- PHP
- Ruby
- Swift
- Dart
- And more...

### Supported Test Frameworks
- JavaScript/TypeScript: Jest, Mocha, Vitest, Jasmine
- Python: pytest, unittest, nose2
- Go: testing
- Rust: cargo test
- Java: JUnit, TestNG

### Documentation Formats
- JavaScript: JSDoc, TSDoc
- Python: reStructuredText, Google Style, NumPy Style
- Go: godoc
- Rust: rustdoc
- Java: Javadoc
- Ruby: YARD
- PHP: PHPDoc

## [Unreleased]

### Planned
- Additional AI model support
- Custom agent creation
- Team collaboration features
- More refactoring patterns
- Additional language support
- Performance improvements
- Enhanced UI themes

---

[0.1.0]: https://github.com/claudeflare/claudeflare/releases/tag/v0.1.0
