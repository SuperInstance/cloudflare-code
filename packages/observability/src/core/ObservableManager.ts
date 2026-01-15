import { Observable, ObservableConfig } from './Observable';

/**
 * Manages multiple observability components
 */
export class ObservableManager {
  private components: Map<string, Observable> = new Map();
  private config: ObservableConfig;

  constructor(config: ObservableConfig = {}) {
    this.config = config;
  }

  /**
   * Register a new observability component
   */
  register(name: string, component: Observable): void {
    if (this.components.has(name)) {
      throw new Error(`Component '${name}' is already registered`);
    }

    this.components.set(name, component);
  }

  /**
   * Get a registered component
   */
  get<T extends Observable>(name: string): T {
    const component = this.components.get(name);
    if (!component) {
      throw new Error(`Component '${name}' not found`);
    }
    return component as T;
  }

  /**
   * Remove a component
   */
  unregister(name: string): boolean {
    return this.components.delete(name);
  }

  /**
   * Initialize all components
   */
  async initializeAll(): Promise<void> {
    const initializationPromises = Array.from(this.components.values()).map(async (component) => {
      try {
        await component.initialize();
      } catch (error) {
        console.error(`Failed to initialize component: ${error}`);
        throw error;
      }
    });

    await Promise.all(initializationPromises);
  }

  /**
   * Export data from all components
   */
  async exportAll(): Promise<any[]> {
    const exportPromises = Array.from(this.components.entries()).map(async ([name, component]) => {
      try {
        const result = await component.export();
        return { name, result };
      } catch (error) {
        console.error(`Failed to export from component '${name}': ${error}`);
        return { name, error };
      }
    });

    return Promise.all(exportPromises);
  }

  /**
   * Destroy all components
   */
  async destroyAll(): Promise<void> {
    const destroyPromises = Array.from(this.components.values()).map(async (component) => {
      try {
        await component.destroy();
      } catch (error) {
        console.error(`Failed to destroy component: ${error}`);
      }
    });

    await Promise.all(destroyPromises);
    this.components.clear();
  }

  /**
   * Update configuration for all components
   */
  updateAllConfig(config: Partial<ObservableConfig>): void {
    Array.from(this.components.values()).forEach(component => {
      component.updateConfig(config);
    });
  }

  /**
   * Check if all components are initialized
   */
  areAllInitialized(): boolean {
    return Array.from(this.components.values()).every(component =>
      component.isInitialized()
    );
  }

  /**
   * Get status of all components
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.components.forEach((component, name) => {
      status[name] = component.isInitialized();
    });
    return status;
  }

  /**
   * Get number of registered components
   */
  getComponentCount(): number {
    return this.components.size;
  }

  /**
   * Get names of all registered components
   */
  getComponentNames(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Find components by type
   */
  findByType<T extends Observable>(type: new (config: ObservableConfig) => T): T[] {
    return Array.from(this.components.values()).filter(
      component => component instanceof type
    ) as T[];
  }

  /**
   * Clear all components
   */
  clear(): void {
    this.components.clear();
  }

  /**
   * Check if a component exists
   */
  has(name: string): boolean {
    return this.components.has(name);
  }
}