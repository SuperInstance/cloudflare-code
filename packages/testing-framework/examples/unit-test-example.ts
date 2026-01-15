/**
 * Unit Testing Example
 * Demonstrates unit testing with the ClaudeFlare testing framework
 */

import { describe, test, expect, mock, jest } from '@claudeflare/testing-framework/unit';

// Simple calculator to test
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}

// User service to test
class UserService {
  private users: Map<string, any> = new Map();

  createUser(userData: any): any {
    const userId = this.generateId();
    const user = { id: userId, ...userData, createdAt: new Date() };
    this.users.set(userId, user);
    return user;
  }

  getUser(id: string): any {
    return this.users.get(id);
  }

  getAllUsers(): any[] {
    return Array.from(this.users.values());
  }

  updateUser(id: string, updates: any): any {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Describe test suite for Calculator
describe('Calculator', () => {
  let calculator: Calculator;

  beforeEach(() => {
    calculator = new Calculator();
  });

  describe('add', () => {
    test('should correctly add two numbers', () => {
      const result = calculator.add(2, 3);
      expect(result).toBe(5);
    });

    test('should handle negative numbers', () => {
      expect(calculator.add(-1, 5)).toBe(4);
      expect(calculator.add(-3, -2)).toBe(-5);
    });

    test('should handle zero', () => {
      expect(calculator.add(0, 5)).toBe(5);
      expect(calculator.add(10, 0)).toBe(10);
    });

    test('should handle floating point numbers', () => {
      expect(calculator.add(1.5, 2.5)).toBeCloseTo(4);
    });
  });

  describe('subtract', () => {
    test('should correctly subtract numbers', () => {
      expect(calculator.subtract(5, 3)).toBe(2);
      expect(calculator.subtract(3, 5)).toBe(-2);
    });

    test('should handle negative numbers', () => {
      expect(calculator.subtract(-1, -5)).toBe(4);
      expect(calculator.subtract(-5, -3)).toBe(-2);
    });
  });

  describe('multiply', () => {
    test('should correctly multiply numbers', () => {
      expect(calculator.multiply(3, 4)).toBe(12);
      expect(calculator.multiply(-2, 5)).toBe(-10);
    });

    test('should handle zero', () => {
      expect(calculator.multiply(5, 0)).toBe(0);
      expect(calculator.multiply(0, 10)).toBe(0);
    });
  });

  describe('divide', () => {
    test('should correctly divide numbers', () => {
      expect(calculator.divide(10, 2)).toBe(5);
      expect(calculator.divide(15, 3)).toBe(5);
    });

    test('should handle floating point division', () => {
      expect(calculator.divide(7, 2)).toBeCloseTo(3.5);
    });

    test('should throw error when dividing by zero', () => {
      expect(() => calculator.divide(10, 0)).toThrow('Division by zero');
      expect(() => calculator.divide(10, 0)).toThrow(Error);
    });
  });
});

// Describe test suite for UserService
describe('UserService', () => {
  let userService: UserService;
  let mockDate: any;

  beforeEach(() => {
    userService = new UserService();
    mockDate = new Date('2023-01-01T00:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createUser', () => {
    test('should create a new user with ID', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      };

      const user = userService.createUser(userData);

      expect(user).toHaveProperty('id');
      expect(user.name).toBe('John Doe');
      expect(user.email).toBe('john@example.com');
      expect(user.age).toBe(30);
      expect(user.createdAt).toEqual(mockDate);
    });

    test('should generate unique IDs for each user', () => {
      const user1 = userService.createUser({ name: 'User 1' });
      const user2 = userService.createUser({ name: 'User 2' });

      expect(user1.id).not.toBe(user2.id);
    });

    test('should store user in internal map', () => {
      const user = userService.createUser({ name: 'Test User' });
      const retrievedUser = userService.getUser(user.id);

      expect(retrievedUser).toEqual(user);
    });
  });

  describe('getUser', () => {
    test('should retrieve existing user by ID', () => {
      const user = userService.createUser({ name: 'Test User' });
      const retrievedUser = userService.getUser(user.id);

      expect(retrievedUser).toEqual(user);
    });

    test('should return undefined for non-existent user', () => {
      const user = userService.getUser('non-existent-id');
      expect(user).toBeUndefined();
    });
  });

  describe('getAllUsers', () => {
    test('should return empty array when no users exist', () => {
      const users = userService.getAllUsers();
      expect(users).toEqual([]);
    });

    test('should return all users', () => {
      userService.createUser({ name: 'User 1' });
      userService.createUser({ name: 'User 2' });
      userService.createUser({ name: 'User 3' });

      const users = userService.getAllUsers();
      expect(users).toHaveLength(3);
      expect(users.map(u => u.name)).toContain('User 1');
      expect(users.map(u => u.name)).toContain('User 2');
      expect(users.map(u => u.name)).toContain('User 3');
    });
  });

  describe('updateUser', () => {
    test('should update existing user', () => {
      const user = userService.createUser({ name: 'Original Name', email: 'original@example.com' });
      const updates = { name: 'Updated Name', age: 25 };

      const updatedUser = userService.updateUser(user.id, updates);

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.email).toBe('original@example.com'); // unchanged
      expect(updatedUser.age).toBe(25);
    });

    test('should throw error for non-existent user', () => {
      expect(() => userService.updateUser('non-existent-id', { name: 'New Name' }))
        .toThrow('User not found');
    });

    test('should preserve original properties', () => {
      const user = userService.createUser({ name: 'Test User', createdAt: '2023-01-01' });
      const updatedUser = userService.updateUser(user.id, { name: 'Updated User' });

      expect(updatedUser.createdAt).toBe('2023-01-01');
    });
  });

  describe('deleteUser', () => {
    test('should delete existing user and return true', () => {
      const user = userService.createUser({ name: 'User to delete' });
      const result = userService.deleteUser(user.id);

      expect(result).toBe(true);
      expect(userService.getUser(user.id)).toBeUndefined();
    });

    test('should return false for non-existent user', () => {
      const result = userService.deleteUser('non-existent-id');
      expect(result).toBe(false);
    });
  });
});

// Mocking example
describe('Mocking Examples', () => {
  test('should create and use mock function', () => {
    const mockFn = mock.fn(() => 'mocked result');

    expect(mockFn()).toBe('mocked result');
    expect(mockFn.mock.callCount).toBe(1);
  });

  test('should track mock calls with arguments', () => {
    const mockFn = mock.fn((a: number, b: string) => `${a}-${b}`);

    mockFn(42, 'hello');
    mockFn(99, 'world');

    expect(mockFn.mock.callCount).toBe(2);
    expect(mockFn.mock.calls[0]).toEqual([42, 'hello']);
    expect(mockFn.mock.calls[1]).toEqual([99, 'world']);
  });

  test('should implement custom mock behavior', () => {
    const mockFn = mock.fn();
    mockFn.mockImplementation((arg: string) => `processed: ${arg}`);

    expect(mockFn('test')).toBe('processed: test');
    expect(mockFn('data')).toBe('processed: data');
  });

  test('should implement async mock', () => {
    const mockFn = mock.fn();
    mockFn.mockImplementation(() => Promise.resolve('async result'));

    return expect(mockFn()).resolves.toBe('async result');
  });

  test('should mock throw errors', () => {
    const mockFn = mock.fn();
    mockFn.mockImplementation(() => {
      throw new Error('Mocked error');
    });

    expect(mockFn).toThrow('Mocked error');
  });

  test('should spy on object methods', () => {
    const calculator = {
      add: (a: number, b: number) => a + b,
      multiply: (a: number, b: number) => a * b
    };

    const spy = jest.spyOn(calculator, 'add');

    const result = calculator.add(5, 3);

    expect(result).toBe(8);
    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(5, 3);
  });

  test('should spy and mock simultaneously', () => {
    const calculator = {
      add: (a: number, b: number) => a + b
    };

    const spy = jest.spyOn(calculator, 'add');
    spy.mockImplementation((a: number, b: number) => a * b); // Change behavior

    expect(calculator.add(2, 3)).toBe(6); // Now multiplies instead of adds
    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(2, 3);
  });
});

// Performance testing example
describe('Performance Examples', () => {
  test('should benchmark array processing', async () => {
    const largeArray = Array.from({ length: 100000 }, (_, i) => i);

    const results = await benchmark(() => {
      return largeArray.map(x => x * 2).filter(x => x % 4 === 0);
    }, { iterations: 50, warmup: 5 });

    console.log(`Array processing benchmark results:`);
    console.log(`  Average: ${results.average.toFixed(2)}ms`);
    console.log(`  Min: ${results.min.toFixed(2)}ms`);
    console.log(`  Max: ${results.max.toFixed(2)}ms`);
    console.log(`  95th percentile: ${results.p95.toFixed(2)}ms`);
    console.log(`  99th percentile: ${results.p99.toFixed(2)}ms`);

    // Basic sanity check
    expect(results.average).toBeGreaterThan(0);
    expect(results.results.every(r => r > 0)).toBe(true);
  });

  test('should measure test execution time', () => {
    const start = performance.now();

    // Simulate some work
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += i;
    }

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeGreaterThan(0);
    expect(sum).toBeGreaterThan(0);
    console.log(`Test execution took ${duration.toFixed(2)}ms`);
  });
});

// Async testing example
describe('Async Examples', () => {
  test('should handle async operations', async () => {
    const asyncFunction = (): Promise<string> => {
      return new Promise(resolve => {
        setTimeout(() => resolve('async result'), 100);
      });
    };

    const result = await asyncFunction();
    expect(result).toBe('async result');
  });

  test('should handle promise rejection', async () => {
    const failingFunction = (): Promise<string> => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Failed')), 100);
      });
    };

    await expect(failingFunction()).rejects.toThrow('Failed');
  });

  test('should use async/await with multiple promises', async () => {
    const promises = [
      Promise.resolve(1),
      Promise.resolve(2),
      Promise.resolve(3)
    ];

    const results = await Promise.all(promises);
    expect(results).toEqual([1, 2, 3]);
  });
});

// Custom matcher example
describe('Custom Matcher Examples', () => {
  test('should use custom matchers', () => {
    const user = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      active: true
    };

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name', 'John Doe');
    expect(user).not.toHaveProperty('address');
    expect(user).toHaveProperty('active', true);
  });

  test('should validate array contents', () => {
    const numbers = [1, 2, 3, 4, 5];
    const names = ['Alice', 'Bob', 'Charlie'];

    expect(numbers).toContain(3);
    expect(numbers).not.toContain(6);
    expect(names).toContain('Bob');
    expect(names).toHaveLength(3);
  });

  test('should validate number ranges', () => {
    expect(5).toBeGreaterThan(3);
    expect(5).toBeLessThan(10);
    expect(5).toBeWithinRange(1, 10);
    expect(3.14159).toBeCloseTo(3.14, 2);
  });
});

// Parameterized test example (using test.each pattern)
describe.each([
  [2, 3, 5],
  [0, 0, 0],
  [-1, 5, 4],
  [1.5, 2.5, 4]
])('Calculator.add with %d + %d', (a, b, expected) => {
  test(`should return ${expected}`, () => {
    const calculator = new Calculator();
    expect(calculator.add(a, b)).toBe(expected);
  });
});

// Conditional test example
describe('Conditional Tests', () => {
  const isFeatureEnabled = process.env.FEATURE_ENABLED === 'true';

  test('should only run if feature is enabled', () => {
    if (!isFeatureEnabled) {
      console.log('Skipping test - feature not enabled');
      return;
    }

    // Test logic for enabled feature
    expect(true).toBe(true);
  });

  test.skip('should be skipped conditionally', () => {
    // This test will be skipped
    expect(false).toBe(true);
  });

  test.only('should run exclusively during development', () => {
    // This test will run alone when using --testNamePattern
    expect('only this test').toBe('only this test');
  });
});

// Cleanup example
describe('Resource Cleanup', () => {
  let resources: any[] = [];

  beforeEach(() => {
    // Initialize resources
    resources = [
      { id: 1, name: 'Resource 1', disposed: false },
      { id: 2, name: 'Resource 2', disposed: false }
    ];
  });

  afterEach(() => {
    // Cleanup resources
    resources.forEach(resource => {
      resource.disposed = true;
      console.log(`Disposed resource: ${resource.name}`);
    });
    resources = [];
  });

  test('should use resources', () => {
    expect(resources).toHaveLength(2);
    expect(resources.every(r => !r.disposed)).toBe(true);
  });

  test('should create new resources', () => {
    const newResource = { id: 3, name: 'Resource 3', disposed: false };
    resources.push(newResource);
    expect(resources).toHaveLength(3);
  });
});

export default { Calculator, UserService };