// @ts-nocheck
/**
 * Plugin system error types
 */

/**
 * Base plugin error
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public pluginId?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PluginError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      pluginId: this.pluginId,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Plugin not found error
 */
export class PluginNotFoundError extends PluginError {
  constructor(pluginId: string, details?: Record<string, unknown>) {
    super(
      `Plugin '${pluginId}' not found`,
      'PLUGIN_NOT_FOUND',
      pluginId,
      details
    );
    this.name = 'PluginNotFoundError';
  }
}

/**
 * Plugin load error
 */
export class PluginLoadError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_LOAD_ERROR', pluginId, details);
    this.name = 'PluginLoadError';
  }
}

/**
 * Plugin activation error
 */
export class PluginActivationError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_ACTIVATION_ERROR', pluginId, details);
    this.name = 'PluginActivationError';
  }
}

/**
 * Plugin deactivation error
 */
export class PluginDeactivationError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_DEACTIVATION_ERROR', pluginId, details);
    this.name = 'PluginDeactivationError';
  }
}

/**
 * Plugin validation error
 */
export class PluginValidationError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    public validationErrors: string[],
    details?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_VALIDATION_ERROR', pluginId, {
      ...details,
      validationErrors,
    });
    this.name = 'PluginValidationError';
  }
}

/**
 * Plugin dependency error
 */
export class PluginDependencyError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    public dependencies: string[],
    details?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_DEPENDENCY_ERROR', pluginId, {
      ...details,
      dependencies,
    });
    this.name = 'PluginDependencyError';
  }
}

/**
 * Plugin version error
 */
export class PluginVersionError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    public version: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_VERSION_ERROR', pluginId, {
      ...details,
      version,
    });
    this.name = 'PluginVersionError';
  }
}

/**
 * Plugin sandbox error
 */
export class PluginSandboxError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_SANDBOX_ERROR', pluginId, details);
    this.name = 'PluginSandboxError';
  }
}

/**
 * Plugin permission error
 */
export class PluginPermissionError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    public permission: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_PERMISSION_ERROR', pluginId, {
      ...details,
      permission,
    });
    this.name = 'PluginPermissionError';
  }
}

/**
 * Plugin timeout error
 */
export class PluginTimeoutError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    public timeout: number,
    details?: Record<string, unknown>
  ) {
    super(message, 'PLUGIN_TIMEOUT_ERROR', pluginId, {
      ...details,
      timeout,
    });
    this.name = 'PluginTimeoutError';
  }
}

/**
 * Hook error
 */
export class HookError extends PluginError {
  constructor(
    hookName: string,
    pluginId: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'HOOK_ERROR', pluginId, {
      ...details,
      hookName,
    });
    this.name = 'HookError';
  }
}

/**
 * Hook validation error
 */
export class HookValidationError extends PluginError {
  constructor(
    hookName: string,
    message: string,
    public validationErrors: string[],
    details?: Record<string, unknown>
  ) {
    super(message, 'HOOK_VALIDATION_ERROR', undefined, {
      ...details,
      hookName,
      validationErrors,
    });
    this.name = 'HookValidationError';
  }
}

/**
 * Webhook error
 */
export class WebhookError extends PluginError {
  constructor(
    webhookId: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'WEBHOOK_ERROR', undefined, {
      ...details,
      webhookId,
    });
    this.name = 'WebhookError';
  }
}

/**
 * Webhook verification error
 */
export class WebhookVerificationError extends WebhookError {
  constructor(webhookId: string, details?: Record<string, unknown>) {
    super(
      webhookId,
      'Webhook signature verification failed',
      details
    );
    this.name = 'WebhookVerificationError';
  }
}

/**
 * Hot reload error
 */
export class HotReloadError extends PluginError {
  constructor(
    pluginId: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'HOT_RELOAD_ERROR', pluginId, details);
    this.name = 'HotReloadError';
  }
}

/**
 * Registry error
 */
export class RegistryError extends PluginError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'REGISTRY_ERROR', undefined, details);
    this.name = 'RegistryError';
  }
}

/**
 * Marketplace error
 */
export class MarketplaceError extends PluginError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'MARKETPLACE_ERROR', undefined, details);
    this.name = 'MarketplaceError';
  }
}
