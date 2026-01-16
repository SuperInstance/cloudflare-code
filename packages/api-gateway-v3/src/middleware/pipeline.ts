/**
 * Middleware Pipeline - Request/response middleware processing
 */

// @ts-nocheck - Middleware function type variations
import { MiddlewareContext, MiddlewareFunction, MiddlewareConfig } from '../types/index.js';

export type MiddlewareHandler = (context: MiddlewareContext) => Promise<void>;

export interface MiddlewareChain {
  handlers: MiddlewareHandler[];
}

export class MiddlewarePipeline {
  private middleware: Map<string, MiddlewareFunction>;
  private configs: MiddlewareConfig[];
  private chain: MiddlewareHandler[];

  constructor(configs: MiddlewareConfig[]) {
    this.middleware = new Map();
    this.configs = configs.sort((a, b) => a.order - b.order);
    this.chain = [];
  }

  use(name: string, handler: MiddlewareFunction): void {
    this.middleware.set(name, handler);
  }

  async execute(
    context: MiddlewareContext,
    handler: () => Promise<void>
  ): Promise<void> {
    const chain = this.buildChain();

    // Execute middleware
    for (const mw of chain) {
      if (this.isMiddlewareEnabled(mw)) {
        await mw(context, async () => {});
      }
    }

    // Execute final handler
    await handler();
  }

  private buildChain(): MiddlewareFunction[] {
    return this.configs
      .filter((c) => c.enabled)
      .sort((a, b) => a.order - b.order)
      .map((c) => this.middleware.get(c.name))
      .filter((mw): mw is MiddlewareFunction => mw !== undefined);
  }

  private isMiddlewareEnabled(mw: any): boolean {
    return true;
  }
}
