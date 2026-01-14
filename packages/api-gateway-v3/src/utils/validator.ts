/**
 * Config Validator - Configuration validation utility
 */

import { GatewayConfig, GatewayConfigSchema } from '../types/index.js';

export class ConfigValidator {
  static validate(config: unknown): GatewayConfig {
    return GatewayConfigSchema.parse(config);
  }

  static validatePartial(config: unknown): Partial<GatewayConfig> {
    return GatewayConfigSchema.partial().parse(config);
  }
}
