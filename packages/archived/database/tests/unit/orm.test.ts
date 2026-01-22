/**
 * Unit Tests for ORM Model
 */

import { Model, hasOne, hasMany, belongsTo, belongsToMany } from '../../src/orm/model';
import { D1Adapter } from '../../src/adapters/d1-adapter';
import { DatabaseType } from '../../src/types';

// Test Model
class User extends Model {
  static definition = {
    tableName: 'users',
    primaryKey: 'id',
    timestamps: true,
    softDelete: true,
    schema: {
      id: { type: 'number', primaryKey: true },
      name: { type: 'string', notNull: true },
      email: { type: 'string', unique: true },
      age: { type: 'number' },
      status: { type: 'string', defaultValue: 'active' },
    },
  };
}

describe('Model', () => {
  let adapter: D1Adapter;

  beforeEach(() => {
    adapter = new D1Adapter({
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'test',
    });

    User.initialize(adapter, User.definition);

    // Mock adapter methods
    adapter.select = jest.fn().mockResolvedValue({
      rows: [
        { id: 1, name: 'John', email: 'john@example.com', age: 30, status: 'active' },
        { id: 2, name: 'Jane', email: 'jane@example.com', age: 25, status: 'active' },
      ],
      rowCount: 2,
    });

    adapter.insert = jest.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
      affectedRows: 1,
      insertId: 3,
    });

    adapter.update = jest.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
      affectedRows: 1,
    });

    adapter.delete = jest.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
      affectedRows: 1,
    });
  });

  describe('Static methods', () => {
    test('should get table name', () => {
      expect(User.getTableName()).toBe('users');
    });

    test('should get primary key', () => {
      expect(User.getPrimaryKey()).toBe('id');
    });

    test('should get adapter', () => {
      expect(User.getAdapter()).toBe(adapter);
    });

    test('should get definition', () => {
      expect(User.getDefinition()).toBe(User.definition);
    });
  });

  describe('Query builder', () => {
    test('should create query builder', () => {
      const query = User.query();

      expect(query).toBeDefined();
    });
  });

  describe('Finders', () => {
    test('should find user by ID', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ id: 1, name: 'John' }],
        rowCount: 1,
      });

      const user = await User.find(1);

      expect(user).not.toBeNull();
      expect(user?.get('name')).toBe('John');
    });

    test('should throw error when findOrFail fails', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await expect(User.findOrFail(999)).rejects.toThrow('Record with ID 999 not found');
    });

    test('should find many users by IDs', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' },
        ],
        rowCount: 2,
      });

      const users = await User.findMany([1, 2]);

      expect(users).toHaveLength(2);
    });

    test('should get first user', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ id: 1, name: 'John' }],
        rowCount: 1,
      });

      const user = await User.first();

      expect(user).not.toBeNull();
      expect(user?.get('name')).toBe('John');
    });

    test('should get all users', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' },
        ],
        rowCount: 2,
      });

      const users = await User.all();

      expect(users).toHaveLength(2);
    });

    test('should count users', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ count: 100 }],
        rowCount: 1,
      });

      const count = await User.count();

      expect(count).toBe(100);
    });

    test('should check if users exist', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
      });

      const exists = await User.exists();

      expect(exists).toBe(true);
    });
  });

  describe('Aggregation', () => {
    test('should get max age', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ max: 65 }],
        rowCount: 1,
      });

      const max = await User.max('age');

      expect(max).toBe(65);
    });

    test('should get min age', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ min: 18 }],
        rowCount: 1,
      });

      const min = await User.min('age');

      expect(min).toBe(18);
    });

    test('should get average age', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ avg: 30 }],
        rowCount: 1,
      });

      const avg = await User.avg('age');

      expect(avg).toBe(30);
    });

    test('should get sum of ages', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ sum: 3000 }],
        rowCount: 1,
      });

      const sum = await User.sum('age');

      expect(sum).toBe(3000);
    });
  });

  describe('CRUD operations', () => {
    test('should create new user', async () => {
      const user = await User.create({
        name: 'John',
        email: 'john@example.com',
        age: 30,
      });

      expect(user.get('name')).toBe('John');
      expect(user['_exists']).toBe(true);
    });

    test('should update user', async () => {
      const updated = await User.update(1, { name: 'Jane' });

      expect(updated).toBe(true);
    });

    test('should delete user', async () => {
      const deleted = await User.delete(1);

      expect(deleted).toBe(true);
    });
  });

  describe('Instance methods', () => {
    test('should save new user', async () => {
      const user = new User();
      user._attributes = { name: 'John', email: 'john@example.com' };

      await user.save();

      expect(user['_exists']).toBe(true);
    });

    test('should save existing user', async () => {
      const user = new User();
      user._attributes = { id: 1, name: 'John', email: 'john@example.com' };
      user._exists = true;
      user._original = { ...user._attributes };

      user.set('name', 'Jane');
      await user.save();

      expect(user._original.name).toBe('Jane');
    });

    test('should delete user', async () => {
      const user = new User();
      user._attributes = { id: 1, name: 'John' };
      user._exists = true;

      const deleted = await user.delete();

      expect(deleted).toBe(true);
      expect(user['_exists']).toBe(false);
    });

    test('should refresh user', async () => {
      adapter.query = jest.fn().mockResolvedValue({
        rows: [{ id: 1, name: 'Jane', email: 'jane@example.com' }],
        rowCount: 1,
      });

      const user = new User();
      user._attributes = { id: 1, name: 'John' };
      user._exists = true;

      await user.refresh();

      expect(user.get('name')).toBe('Jane');
    });
  });

  describe('Attribute access', () => {
    test('should get attribute value', () => {
      const user = new User();
      user._attributes = { name: 'John' };

      expect(user.get('name')).toBe('John');
    });

    test('should set attribute value', () => {
      const user = new User();
      user.set('name', 'Jane');

      expect(user._attributes.name).toBe('Jane');
    });

    test('should check if attribute exists', () => {
      const user = new User();
      user._attributes = { name: 'John' };

      expect(user.has('name')).toBe(true);
      expect(user.has('email')).toBe(false);
    });
  });

  describe('Dirty tracking', () => {
    test('should check if attribute is dirty', () => {
      const user = new User();
      user._attributes = { name: 'John' };
      user._original = { name: 'Jane' };

      expect(user.isDirty('name')).toBe(true);
      expect(user.isDirty('email')).toBe(false);
    });

    test('should check if attribute is clean', () => {
      const user = new User();
      user._attributes = { name: 'John' };
      user._original = { name: 'John' };

      expect(user.isClean('name')).toBe(true);
    });

    test('should get dirty attributes', () => {
      const user = new User();
      user._attributes = { name: 'John', email: 'john@example.com' };
      user._original = { name: 'Jane', email: 'jane@example.com' };

      const dirty = user.getDirty();

      expect(dirty).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    test('should get attribute changes', () => {
      const user = new User();
      user._attributes = { name: 'John', email: 'john@example.com' };
      user._original = { name: 'Jane', email: 'jane@example.com' };

      const changes = user.getChanges();

      expect(changes.name.old).toBe('Jane');
      expect(changes.name.new).toBe('John');
    });
  });

  describe('Serialization', () => {
    test('should convert to JSON', () => {
      const user = new User();
      user._attributes = { id: 1, name: 'John', email: 'john@example.com' };

      const json = user.toJSON();

      expect(json).toEqual({
        id: 1,
        name: 'John',
        email: 'john@example.com',
      });
    });

    test('should convert to string', () => {
      const user = new User();
      user._attributes = { id: 1, name: 'John' };

      const str = user.toString();

      expect(str).toBe('{"id":1,"name":"John"}');
    });
  });

  describe('Validation', () => {
    test('should validate required fields', async () => {
      const user = new User();
      user._attributes = {};

      const result = await user.validate();

      expect(result).not.toBe(true);
    });

    test('should pass validation with valid data', async () => {
      const user = new User();
      user._attributes = {
        name: 'John',
        email: 'john@example.com',
      };

      const result = await user.validate();

      expect(result).toBe(true);
    });
  });

  describe('Relationships', () => {
    test('should define hasOne relationship', () => {
      const relation = hasOne(User, 'user_id');

      expect(typeof relation).toBe('function');
    });

    test('should define hasMany relationship', () => {
      const relation = hasMany(User, 'user_id');

      expect(typeof relation).toBe('function');
    });

    test('should define belongsTo relationship', () => {
      const relation = belongsTo(User, 'user_id');

      expect(typeof relation).toBe('function');
    });

    test('should define belongsToMany relationship', () => {
      const relation = belongsToMany(User, 'user_roles', 'role_id', 'user_id');

      expect(typeof relation).toBe('function');
    });
  });
});

describe('Decorators', () => {
  test('should apply Table decorator', () => {
    @Table('custom_users')
    class CustomUser extends Model {}

    expect((CustomUser as any).definition.tableName).toBe('custom_users');
  });

  test('should apply Field decorator', () => {
    class CustomUser extends Model {}

    Field({ type: 'string', notNull: true })(new CustomUser(), 'name', Object.getOwnPropertyDescriptor(CustomUser.prototype, 'name')!);

    expect((CustomUser as any).definition.schema.name).toBeDefined();
  });

  test('should apply Relation decorator', () => {
    class CustomUser extends Model {}

    Relation({ type: 'hasMany', model: 'Post', foreignKey: 'user_id' })(new CustomUser(), 'posts', Object.getOwnPropertyDescriptor(CustomUser.prototype, 'posts')!);

    expect((CustomUser as any).definition.relations.posts).toBeDefined();
  });
});
