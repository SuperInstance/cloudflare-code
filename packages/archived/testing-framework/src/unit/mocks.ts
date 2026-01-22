import { MockFunction, MockFunctionState, MockConfig, SpyFunction, SpyFunctionState, MockExpectations } from './types';
import { MockError } from './errors';
import { EventEmitter } from 'events';

/**
 * Mock factory class
 */
export class MockFactory {
  private static instances = new Map<string, any>();
  private static spies = new Map<string, SpyFunctionState>();
  private static mocks = new Map<string, MockFunctionState>();

  /**
   * Create a mock function
   */
  static createMock<T extends Function>(config: MockConfig = {}): MockFunction<T> {
    const mockState: MockFunctionState = {
      calls: [],
      instances: [],
      context: null,
      results: []
    };

    const mock = function(this: any, ...args: any[]): any {
      const call = {
        arguments: args,
        timestamp: Date.now()
      };

      // Track call
      mockState.calls.push(call);

      // Store instance for constructor mocks
      if (config.constructorMock) {
        mockState.instances.push(this);
      }

      // Store context
      mockState.context = this;

      // Execute implementation or default behavior
      let result;
      if (config.implementation) {
        try {
          result = config.implementation.apply(this, args);
          call.result = result;
          mockState.results.push({ type: 'return', value: result });
        } catch (error) {
          call.error = error;
          mockState.results.push({ type: 'throw', value: error });
          throw error;
        }
      } else {
        // Default mock behavior
        result = this instanceof MockFunction ? undefined : this;
        call.result = result;
        mockState.results.push({ type: 'return', value: result });
      }

      return result;
    } as MockFunction<T>;

    // Add mock state
    mock.mock = mockState;

    // Add mock utilities
    this.addMockUtilities(mock);

    // Store mock
    const mockId = this.generateMockId();
    MockFactory.mocks.set(mockId, mockState);

    return mock;
  }

  /**
   * Create a mock class
   */
  static createMockClass<T extends new (...args: any[]) => any>(config: MockConfig = {}): T {
    const mockConstructor = this.createMock<T>(config);

    // Mock prototype methods
    if (config.implementation && typeof config.implementation === 'object') {
      for (const [key, value] of Object.entries(config.implementation)) {
        if (typeof value === 'function') {
          mockConstructor.prototype[key] = this.createMockFunction(value);
        }
      }
    }

    // Create class-like behavior
    const MockClass = class extends MockFunction {
      constructor(...args: any[]) {
        super(...args);
        if (config.constructorMock) {
          this.initialize(...args);
        }
      }

      private initialize(...args: any[]) {
        // Mock constructor initialization
        if (config.implementation && typeof config.implementation === 'object') {
          for (const [key, value] of Object.entries(config.implementation)) {
            if (key !== 'constructor' && typeof value === 'function') {
              this[key] = value;
            }
          }
        }
      }
    };

    // Copy mock state
    MockClass.mock = mockConstructor.mock;

    return MockClass as any;
  }

  /**
   * Create a mock object
   */
  static createMockObject<T extends object>(config: MockConfig = {}): T {
    const mock = {} as T;

    // Add mock implementation
    if (config.implementation && typeof config.implementation === 'object') {
      for (const [key, value] of Object.entries(config.implementation)) {
        if (typeof value === 'function') {
          (mock as any)[key] = this.createMockFunction(value);
        } else {
          (mock as any)[key] = value;
        }
      }
    }

    // Add getter/setter support
    if (config.getter || config.setter) {
      Object.defineProperty(mock, 'mockedProperty', {
        get: config.getter,
        set: config.setter,
        enumerable: true,
        configurable: true
      });
    }

    return mock;
  }

  /**
   * Create a mock for a specific module
   */
  static createMockModule<T extends object>(moduleName: string, mockExports: T): T {
    const mock = {} as T;

    for (const [key, value] of Object.entries(mockExports)) {
      if (typeof value === 'function') {
        (mock as any)[key] = this.createMockFunction(value);
      } else {
        (mock as any)[key] = value;
      }
    }

    // Store module mock
    this.instances.set(moduleName, mock);

    return mock;
  }

  /**
   * Create a spy function
   */
  static createSpy<T extends Function>(fn?: T): SpyFunction<T> {
    const spyState: SpyFunctionState = {
      calls: [],
      callCount: 0,
      called: false,
      calledOnce: false,
      calledTwice: false,
      calledThrice: false
    };

    const spy = function(this: any, ...args: any[]): any {
      const call = {
        arguments: args,
        timestamp: Date.now(),
        this: this
      };

      // Update spy state
      spyState.callCount++;
      spyState.called = true;
      spyState.calledOnce = spyState.callCount === 1;
      spyState.calledTwice = spyState.callCount === 2;
      spyState.calledThrice = spyState.callCount === 3;

      // Store call
      spyState.calls.push(call);

      // Update first/last call
      spyState.firstCall = call;
      spyState.lastCall = call;

      // Execute original function
      let result;
      try {
        if (fn) {
          result = fn.apply(this, args);
        } else {
          result = undefined;
        }
        call.result = result;
      } catch (error) {
        call.error = error;
        throw error;
      }

      return result;
    } as SpyFunction<T>;

    // Add spy state
    spy.spy = spyState;

    // Add spy utilities
    this.addSpyUtilities(spy);

    return spy;
  }

  /**
   * Spy on object property
   */
  static spyOn<T extends object>(obj: T, property: string | symbol): SpyFunction {
    const originalValue = (obj as any)[property];

    if (typeof originalValue !== 'function') {
      throw new MockError(`Cannot spy on non-function property: ${String(property)}`);
    }

    const spy = this.createSpy(originalValue);

    // Replace property with spy
    (obj as any)[property] = spy;

    // Add restore method
    spy.and = {
      restore: () => {
        (obj as any)[property] = originalValue;
      }
    };

    return spy;
  }

  /**
   * Mock a module
   */
  static mock(moduleName: string, mockFactory: () => any): void {
    try {
      const mock = mockFactory();
      this.instances.set(moduleName, mock);
    } catch (error) {
      throw new MockError(`Failed to mock module ${moduleName}: ${error}`);
    }
  }

  /**
   * Reset all mocks
   */
  static resetAll(): void {
    // Reset mock calls
    for (const mockState of this.mocks.values()) {
      mockState.calls = [];
      mockState.instances = [];
      mockState.context = null;
      mockState.results = [];
    }

    // Reset spy calls
    for (const spyState of this.spies.values()) {
      spyState.calls = [];
      spyState.callCount = 0;
      spyState.called = false;
      spyState.calledOnce = false;
      spyState.calledTwice = false;
      spyState.calledThrice = false;
      spyState.firstCall = undefined;
      spyState.lastCall = undefined;
    }

    // Clear instances
    this.instances.clear();
    this.spies.clear();
    this.mocks.clear();
  }

  /**
   * Check if all mocks have been called as expected
   */
  static verifyAll(): void {
    for (const [name, mockState] of this.mocks) {
      if (mockState.calls.length === 0) {
        throw new MockError(`Mock ${name} was not called`);
      }
    }
  }

  /**
   * Get mock instance by name
   */
  static getInstance<T = any>(name: string): T {
    return this.instances.get(name);
  }

  /**
   * Add mock utilities
   */
  private static addMockUtilities(mock: MockFunction): void {
    // Mock expectation methods
    mock.and = {
      /**
       * Mock return value
       */
      returns: (value: any) => {
        const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
        if (lastCall) {
          lastCall.result = value;
        }
        return mock;
      },

      /**
       * Mock throw error
       */
      throws: (error: any) => {
        const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
        if (lastCall) {
          lastCall.error = error;
        }
        return mock;
      },

      /**
       * Mock implementation
       */
      callsFake: (fn: Function) => {
        mock.mock.implementation = fn;
        return mock;
      },

      /**
       * Mock promise resolution
       */
      resolves: (value: any) => {
        const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
        if (lastCall) {
          lastCall.result = Promise.resolve(value);
        }
        return mock;
      },

      /**
       * Mock promise rejection
       */
      rejects: (error: any) => {
        const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
        if (lastCall) {
          lastCall.result = Promise.reject(error);
        }
        return mock;
      },

      /**
       * Mock constructor instance
       */
      mockImplementation: (constructor: Function) => {
        mock.mock.constructorMock = true;
        mock.mock.implementation = constructor;
        return mock;
      }
    };

    // Mock expectation methods
    mock.mock = {
      ...mock.mock,

      /**
       * Get call count
       */
      get calls(): Array<{ arguments: any[]; result?: any; error?: any; timestamp: number }> {
        return mock.mock.calls;
      },

      /**
       * Get call count
       */
      get callCount(): number {
        return mock.mock.calls.length;
      },

      /**
       * Check if mocked
       */
      get called(): boolean {
        return mock.mock.calls.length > 0;
      },

      /**
       * Check if called once
       */
      get calledOnce(): boolean {
        return mock.mock.calls.length === 1;
      },

      /**
       * Check if called twice
       */
      get calledTwice(): boolean {
        return mock.mock.calls.length === 2;
      },

      /**
       * Check if called thrice
       */
      get calledThrice(): boolean {
        return mock.mock.calls.length === 3;
      },

      /**
       * Check if called with specific arguments
       */
      calledWith: (...args: any[]) => {
        return mock.mock.calls.some(call =>
          call.arguments.length === args.length &&
          call.arguments.every((arg, index) => arg === args[index])
        );
      },

      /**
       * Check if called with specific partial arguments
       */
      calledWithMatch: (...args: any[]) => {
        return mock.mock.calls.some(call =>
          args.every((expectedArg, index) =>
            index < call.arguments.length &&
            this.isMatch(call.arguments[index], expectedArg)
          )
        );
      },

      /**
       * Check if called with any arguments
       */
      calledWithAny: () => {
        return mock.mock.calls.length > 0;
      },

      /**
       * Check if called with no arguments
       */
      calledWithNoArgs: () => {
        return mock.mock.calls.some(call => call.arguments.length === 0);
      }
    };
  }

  /**
   * Add spy utilities
   */
  private static addSpyUtilities(spy: SpyFunction): void {
    // Spy expectation methods
    spy.and = {
      /**
       * Restore original function
       */
      restore: () => {
        // Implementation depends on context
      }
    };

    // Spy state methods
    spy.spy = {
      ...spy.spy,

      /**
       * Get call count
       */
      get callCount(): number {
        return spy.spy.callCount;
      },

      /**
       * Check if called
       */
      get called(): boolean {
        return spy.spy.called;
      },

      /**
       * Check if called once
       */
      get calledOnce(): boolean {
        return spy.spy.calledOnce;
      },

      /**
       * Check if called twice
       */
      get calledTwice(): boolean {
        return spy.spy.calledTwice;
      },

      /**
       * Check if called thrice
       */
      get calledThrice(): boolean {
        return spy.spy.calledThrice;
      },

      /**
       * Get first call
       */
      get firstCall() {
        return spy.spy.firstCall;
      },

      /**
       * Get last call
       */
      get lastCall() {
        return spy.spy.lastCall;
      }
    };
  }

  /**
   * Create mock function from implementation
   */
  private static createMockFunction(impl: Function): MockFunction {
    return this.createMock<Function>({
      implementation: impl
    });
  }

  /**
   * Generate unique mock ID
   */
  private static generateMockId(): string {
    return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if value matches expected
   */
  private static isMatch(value: any, expected: any): boolean {
    if (expected instanceof RegExp) {
      return expected.test(value);
    }
    return value === expected;
  }
}

/**
 * Global mock utilities
 */
export const mock = MockFactory.createMock;
export const spyOn = MockFactory.spyOn;
export const jest = {
  fn: MockFactory.createMock,
  spyOn: MockFactory.spyOn,
  mock: MockFactory.mock,
  resetAll: MockFactory.resetAll,
  verifyAll: MockFactory.verifyAll,
  getInstance: MockFactory.getInstance
};