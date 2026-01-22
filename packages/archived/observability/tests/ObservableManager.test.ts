import { ObservableManager, Observable } from '../src/core/Observable';
import { MetricsCollector } from '../src/metrics/MetricsCollector';
import { Tracer } from '../src/tracing/Tracer';
import { Logger } from '../src/logging/Logger';

// Mock Observable for testing
class MockObservable extends Observable {
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async destroy(): Promise<void> {
    this.initialized = false;
  }

  async export(): Promise<any> {
    return { success: true, exported: 1 };
  }
}

describe('ObservableManager', () => {
  let manager: ObservableManager;

  beforeEach(() => {
    manager = new ObservableManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe('register', () => {
    it('should register a new component', () => {
      const component = new MockObservable();
      manager.register('test', component);

      expect(manager.has('test')).toBe(true);
      expect(manager.getComponentCount()).toBe(1);
    });

    it('should throw error when registering duplicate component', () => {
      const component = new MockObservable();
      manager.register('test', component);

      expect(() => manager.register('test', new MockObservable())).toThrow('Component \'test\' is already registered');
    });
  });

  describe('get', () => {
    it('should get a registered component', () => {
      const component = new MockObservable();
      manager.register('test', component);

      const retrieved = manager.get<MockObservable>('test');
      expect(retrieved).toBe(component);
    });

    it('should throw error when getting non-existent component', () => {
      expect(() => manager.get('non-existent')).toThrow('Component \'non-existent\' not found');
    });
  });

  describe('unregister', () => {
    it('should unregister a component', () => {
      const component = new MockObservable();
      manager.register('test', component);

      expect(manager.unregister('test')).toBe(true);
      expect(manager.has('test')).toBe(false);
      expect(manager.getComponentCount()).toBe(0);
    });

    it('should return false when unregistering non-existent component', () => {
      expect(manager.unregister('non-existent')).toBe(false);
    });
  });

  describe('initializeAll', () => {
    it('should initialize all components', async () => {
      const component1 = new MockObservable();
      const component2 = new MockObservable();

      manager.register('comp1', component1);
      manager.register('comp2', component2);

      await manager.initializeAll();

      expect(manager.areAllInitialized()).toBe(true);
      expect(component1.isInitialized()).toBe(true);
      expect(component2.isInitialized()).toBe(true);
    });

    it('should throw error when component initialization fails', async () => {
      const failingComponent = new MockObservable();
      failingComponent.initialize = async () => {
        throw new Error('Initialization failed');
      };

      manager.register('failing', failingComponent);
      manager.register('working', new MockObservable());

      await expect(manager.initializeAll()).rejects.toThrow('Initialization failed');
    });
  });

  describe('exportAll', () => {
    it('should export all components', async () => {
      const component1 = new MockObservable();
      const component2 = new MockObservable();

      component1.export = async () => ({ result: 'export1' });
      component2.export = async () => ({ result: 'export2' });

      manager.register('comp1', component1);
      manager.register('comp2', component2);

      const results = await manager.exportAll();

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('comp1');
      expect(results[0].result).toBe('export1');
      expect(results[1].name).toBe('comp2');
      expect(results[1].result).toBe('export2');
    });

    it('should handle component export failures', async () => {
      const failingComponent = new MockObservable();
      failingComponent.export = async () => {
        throw new Error('Export failed');
      };

      const workingComponent = new MockObservable();
      workingComponent.export = async () => ({ result: 'success' });

      manager.register('failing', failingComponent);
      manager.register('working', workingComponent);

      const results = await manager.exportAll();

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('failing');
      expect(results[0].error).toBeDefined();
      expect(results[1].name).toBe('working');
      expect(results[1].result).toBe('success');
    });
  });

  describe('destroyAll', () => {
    it('should destroy all components', async () => {
      const component1 = new MockObservable();
      const component2 = new MockObservable();

      // Initialize components first
      await component1.initialize();
      await component2.initialize();

      manager.register('comp1', component1);
      manager.register('comp2', component2);

      await manager.destroyAll();

      expect(component1.isInitialized()).toBe(false);
      expect(component2.isInitialized()).toBe(false);
      expect(manager.getComponentCount()).toBe(0);
    });
  });

  describe('updateAllConfig', () => {
    it('should update configuration for all components', () => {
      const component1 = new MockObservable();
      const component2 = new MockObservable();

      jest.spyOn(component1, 'updateConfig');
      jest.spyOn(component2, 'updateConfig');

      manager.register('comp1', component1);
      manager.register('comp2', component2);

      const newConfig = { test: 'value' };
      manager.updateAllConfig(newConfig);

      expect(component1.updateConfig).toHaveBeenCalledWith(newConfig);
      expect(component2.updateConfig).toHaveBeenCalledWith(newConfig);
    });
  });

  describe('getStatus', () => {
    it('should return status of all components', () => {
      const component1 = new MockObservable();
      const component2 = new MockObservable();

      component1.initialize = async () => { component1.initialized = true; };
      component2.initialize = async () => { component2.initialized = true; };

      manager.register('comp1', component1);
      manager.register('comp2', component2);

      // Initialize components
      component1.initialize();
      component2.initialize();

      const status = manager.getStatus();

      expect(status).toEqual({
        comp1: true,
        comp2: true
      });
    });

    it('should handle uninitialized components', () => {
      const component = new MockObservable();
      manager.register('comp', component);

      const status = manager.getStatus();
      expect(status).toEqual({
        comp: false
      });
    });
  });

  describe('findByType', () => {
    it('should find components by type', () => {
      const component1 = new MockObservable();
      const component2 = new MockObservable();
      const component3 = new class extends MockObservable {}();

      manager.register('comp1', component1);
      manager.register('comp2', component2);
      manager.register('comp3', component3);

      // Mock instanceof check
      Object.setPrototypeOf(component2, MockObservable);

      const result = manager.findByType(MockObservable);
      expect(result).toHaveLength(2);
      expect(result).toContain(component1);
      expect(result).toContain(component2);
    });
  });

  describe('clear', () => {
    it('should clear all components', () => {
      const component = new MockObservable();
      manager.register('test', component);

      expect(manager.getComponentCount()).toBe(1);

      manager.clear();

      expect(manager.getComponentCount()).toBe(0);
      expect(manager.has('test')).toBe(false);
    });
  });
});