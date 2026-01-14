# @claudeflare/plugins

A comprehensive plugin system and extensions framework for ClaudeFlare distributed AI coding platform on Cloudflare Workers.

## Features

### Core Plugin System
- **Plugin Architecture**: Base class with lifecycle management
- **Plugin Types**: AI providers, agents, tools, storage, auth, analytics, webhooks
- **State Management**: Load, activate, deactivate, unload lifecycle states
- **Health Monitoring**: Built-in health checks and metrics tracking
- **Configuration**: Dynamic configuration updates with validation

### Security & Isolation
- **WASM Sandbox**: Secure plugin execution with WebAssembly
- **Resource Limits**: Memory, CPU time, and wall time limits
- **Permission System**: Fine-grained permissions for network, file system, and database access
- **Isolated Context**: Each plugin runs in isolated environment

### Hook System
- **10+ Core Hooks**: beforeRequest, afterResponse, beforeAgentExecution, afterAgentExecution, onCodeGeneration, onCodeReview, onCodeAnalysis, and more
- **Extension Hooks**: AI requests, storage operations, tool execution
- **Hook Middleware**: Logging, timing, error handling, retry, rate limiting
- **Priority System**: Control hook execution order
- **Cancellation & Mutation**: Hooks can cancel operations or modify data

### Plugin Loader
- **Hot Reload**: Automatic plugin reloading during development
- **Dependency Resolution**: Automatic dependency checking and resolution
- **Concurrent Loading**: Load multiple plugins in parallel
- **Timeout Handling**: Configurable timeouts for plugin operations

### Plugin Registry
- **Plugin Discovery**: Discover plugins from local and remote sources
- **Marketplace Integration**: Browse and install plugins from marketplace
- **Metadata Management**: Store and query plugin metadata
- **Health Tracking**: Monitor plugin health and status

### Webhook Extensions
- **GitHub Webhooks**: Handle push, pull request, issue, and release events
- **GitLab Webhooks**: Support for GitLab webhooks
- **Bitbucket Webhooks**: Support for Bitbucket webhooks
- **Custom Webhooks**: Create custom webhook handlers
- **Signature Verification**: HMAC signature verification for security
- **Retry Logic**: Automatic retry with exponential backoff

### REST API
- **Plugin Management**: Install, uninstall, enable, disable plugins
- **Lifecycle Control**: Load, unload, activate, deactivate plugins
- **Health & Metrics**: Query plugin health and metrics
- **Discovery API**: Browse marketplace plugins
- **Webhook Management**: Register and manage webhooks

## Installation

```bash
npm install @claudeflare/plugins
```

## Quick Start

```typescript
import { createPluginSystem } from '@claudeflare/plugins';

// Create plugin system
const pluginSystem = createPluginSystem({
  pluginsDir: './plugins',
  enableSandbox: true,
  enableHotReload: true,
});

// Initialize
await pluginSystem.initialize();

// Load a plugin
const result = await pluginSystem.loader.load('my-plugin', {
  autoActivate: true,
  sandboxed: true,
});

if (result.success) {
  console.log('Plugin loaded:', result.plugin);
}
```

## Creating a Plugin

```typescript
import { Plugin } from '@claudeflare/plugins';

const manifest = {
  id: 'my-plugin',
  name: 'My Plugin',
  description: 'My awesome plugin',
  version: '1.0.0',
  minPlatformVersion: '1.0.0',
  type: 'custom',
  author: {
    name: 'Your Name',
    email: 'your.email@example.com',
  },
  license: 'MIT',
  keywords: ['awesome', 'plugin'],
  capabilities: {
    sandboxed: true,
    hotReload: false,
    networkAccess: false,
    fsAccess: false,
    dbAccess: false,
    customPermissions: [],
  },
  main: 'index.js',
};

export class MyPlugin extends Plugin {
  public readonly manifest = manifest;

  protected async onLoad(): Promise<void> {
    this.getLogger().info('Plugin loaded');
  }

  protected async onActivate(): Promise<void> {
    this.getLogger().info('Plugin activated');
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    return { result: 'success', input };
  }
}

export default function createPlugin() {
  return new MyPlugin();
}
```

## Using Hooks

```typescript
import { globalHookRegistry } from '@claudeflare/plugins';

// Subscribe to a hook
globalHookRegistry.subscribe('beforeRequest', 'my-plugin', async (context) => {
  console.log('Before request:', context.data);

  // Modify data
  context.modify({ ...context.data, timestamp: Date.now() });

  // Or cancel
  // context.cancel();
});

// Dispatch a hook
import { dispatchHook } from '@claudeflare/plugins';

const result = await dispatchHook(
  'beforeRequest',
  'my-plugin',
  { method: 'GET', url: '/api/test' }
);

console.log('Result:', result);
```

## Webhook Integration

```typescript
import { globalWebhookHandler } from '@claudeflare/plugins';

// Register webhook
globalWebhookHandler.register({
  id: 'my-webhook',
  url: 'https://example.com/webhook',
  secret: 'my-secret',
  events: ['github.push', 'github.pull_request'],
  enabled: true,
  method: 'POST',
  timeout: 10000,
  retry: {
    maxAttempts: 3,
    backoffMs: 1000,
  },
});

// Deliver webhook
await globalWebhookHandler.deliver('my-webhook', {
  type: 'github.push',
  id: 'evt-123',
  timestamp: new Date(),
  source: 'github',
  data: { /* event data */ },
  headers: {},
});
```

## API Routes

The plugin system includes REST API routes for Cloudflare Workers:

- `GET /api/plugins` - List all plugins
- `GET /api/plugins/:id` - Get plugin details
- `POST /api/plugins` - Install plugin
- `PUT /api/plugins/:id` - Update plugin
- `DELETE /api/plugins/:id` - Uninstall plugin
- `POST /api/plugins/:id/load` - Load plugin
- `POST /api/plugins/:id/unload` - Unload plugin
- `POST /api/plugins/:id/reload` - Reload plugin
- `POST /api/plugins/:id/activate` - Activate plugin
- `POST /api/plugins/:id/deactivate` - Deactivate plugin
- `GET /api/plugins/:id/health` - Get plugin health
- `GET /api/plugins/:id/metrics` - Get plugin metrics
- `GET /api/webhooks` - List webhooks
- `POST /api/webhooks` - Register webhook
- `DELETE /api/webhooks/:id` - Unregister webhook

## Plugin Types

### AI Provider Plugin
Extends the platform with new AI models and providers.

```typescript
type: 'ai_provider'
capabilities: {
  networkAccess: true,
  customPermissions: ['network:api.example.com'],
}
requiredSecrets: ['API_KEY']
```

### Agent Plugin
Adds custom agent types.

```typescript
type: 'agent'
capabilities: {
  sandboxed: true,
  networkAccess: true,
}
```

### Tool Plugin
Provides additional tools for agents.

```typescript
type: 'tool'
subscribes: ['onToolExecute', 'onToolResult']
```

### Storage Plugin
Custom storage backends.

```typescript
type: 'storage'
capabilities: {
  dbAccess: true,
  networkAccess: true,
}
```

### Webhook Plugin
Handles external webhooks.

```typescript
type: 'webhook'
capabilities: {
  sandboxed: true,
}
subscribes: ['onCodeGeneration', 'onCodeReview']
```

## Security

### WASM Sandbox
Plugins can be executed in a WASM sandbox with:
- Memory limits
- CPU time limits
- Wall time limits
- Network access control
- File system access control
- Module allow/block lists

### Permission System
Plugins can request specific permissions:
- `networkAccess` - Make HTTP requests
- `fsAccess` - Access file system
- `dbAccess` - Access databases
- `customPermissions` - Custom permissions

### Secret Management
Plugins can securely access secrets:
```typescript
const apiKey = this.getSecrets().API_KEY;
```

## Testing

```bash
npm test
```

## Development

```bash
npm run dev
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## Support

For issues and questions, please open an issue on GitHub.
