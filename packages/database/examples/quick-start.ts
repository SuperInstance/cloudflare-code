/**
 * Quick Start Example
 * Demonstrates basic usage of the ClaudeFlare Database package
 */

import { QuickDB, DatabaseFactory } from '../src/database';
import { DatabaseType } from '../src/types';

// ========================================================================
// QuickDB Example
// ========================================================================

async function quickDBExample() {
  // Create a QuickDB instance for D1
  const db = new QuickDB({
    type: DatabaseType.D1,
    binding: 'DB',
    database: 'my_database',
  });

  try {
    // Connect to the database
    await db.connect();

    // Create a table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        age INTEGER,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert a user
    await db.query(
      'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
      ['John Doe', 'john@example.com', 30]
    );

    // Query users
    const users = await db.query('SELECT * FROM users WHERE status = ?', ['active']);
    console.log('Active users:', users.rows);

    // Using query builder
    const query = db.table('users')
      .where('status', 'active')
      .where('age', '>=', 18)
      .orderBy('created_at', 'DESC')
      .limit(10);

    const result = await query.get();
    console.log('Query result:', result);

  } finally {
    await db.disconnect();
  }
}

// ========================================================================
// PostgreSQL Example
// ========================================================================

async function postgresExample() {
  const db = new QuickDB({
    type: DatabaseType.POSTGRESQL,
    host: 'localhost',
    port: 5432,
    database: 'my_database',
    username: 'user',
    password: 'password',
  });

  try {
    await db.connect();

    // Create table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        age INTEGER,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert with RETURNING clause
    const result = await db.query(
      'INSERT INTO users (name, email, age) VALUES ($1, $2, $3) RETURNING *',
      ['John Doe', 'john@example.com', 30]
    );

    console.log('Inserted user:', result.rows[0]);

    // Use transaction
    await db.transaction(async (trx) => {
      await trx.commit('INSERT INTO users (name, email) VALUES ($1, $2)', ['Jane', 'jane@example.com']);
      await trx.commit('INSERT INTO posts (title, user_id) VALUES ($1, $2)', ['Hello World', 1]);
    });

  } finally {
    await db.disconnect();
  }
}

// ========================================================================
// MySQL Example
// ========================================================================

async function mysqlExample() {
  const db = new QuickDB({
    type: DatabaseType.MYSQL,
    host: 'localhost',
    port: 3306,
    database: 'my_database',
    username: 'user',
    password: 'password',
  });

  try {
    await db.connect();

    // Create table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        age INT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert user
    await db.query(
      'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
      ['John Doe', 'john@example.com', 30]
    );

    // Get last insert ID
    const insertId = await db.query('SELECT LAST_INSERT_ID() as id');
    console.log('Inserted ID:', insertId.rows[0].id);

  } finally {
    await db.disconnect();
  }
}

// ========================================================================
// MongoDB Example
// ========================================================================

async function mongoExample() {
  const db = new QuickDB({
    type: DatabaseType.MONGODB,
    url: 'mongodb://localhost:27017',
    database: 'my_database',
  });

  try {
    await db.connect();

    // Insert document
    await db.query('users', [{
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        status: 'active',
      }
    }]);

    // Query documents
    const users = await db.query('users', [{
      $match: { status: 'active' },
      $sort: { createdAt: -1 },
      $limit: 10
    }]);

    console.log('Users:', users.rows);

  } finally {
    await db.disconnect();
  }
}

// ========================================================================
// Redis Example
// ========================================================================

async function redisExample() {
  const db = new QuickDB({
    type: DatabaseType.REDIS,
    host: 'localhost',
    port: 6379,
    database: 0,
  });

  try {
    await db.connect();

    // Set a value
    await db.query('SET', ['user:1:name', 'John Doe']);

    // Get a value
    const name = await db.query('GET', ['user:1:name']);
    console.log('User name:', name.rows[0]);

    // Work with hashes
    await db.query('HSET', ['user:1', 'name', 'John', 'email', 'john@example.com']);
    const user = await db.query('HGETALL', ['user:1']);
    console.log('User:', user.rows[0]);

    // Work with lists
    await db.query('LPUSH', ['user:1:posts', 'Post 1', 'Post 2', 'Post 3']);
    const posts = await db.query('LRANGE', ['user:1:posts', 0, -1]);
    console.log('Posts:', posts.rows);

    // Work with sets
    await db.query('SADD', ['user:1:tags', 'javascript', 'typescript', 'nodejs']);
    const tags = await db.query('SMEMBERS', ['user:1:tags']);
    console.log('Tags:', tags.rows);

  } finally {
    await db.disconnect();
  }
}

// ========================================================================
// Transaction Example
// ========================================================================

async function transactionExample() {
  const db = new QuickDB({
    type: DatabaseType.D1,
    binding: 'DB',
    database: 'my_database',
  });

  try {
    await db.connect();

    // Using transaction helper
    await db.transaction(async (trx) => {
      // All queries in this transaction will be committed together
      await trx.commit('INSERT INTO users (name, email) VALUES (?, ?)', ['John', 'john@example.com']);
      await trx.commit('INSERT INTO user_profiles (user_id, bio) VALUES (?, ?)', [1, 'Software developer']);

      // If any query fails, everything will be rolled back
    });

    console.log('Transaction completed successfully');

  } finally {
    await db.disconnect();
  }
}

// ========================================================================
// Query Builder Example
// ========================================================================

async function queryBuilderExample() {
  const db = new QuickDB({
    type: DatabaseType.D1,
    binding: 'DB',
    database: 'my_database',
  });

  try {
    await db.connect();

    // Simple query
    const activeUsers = await db.table('users')
      .where('status', 'active')
      .get();

    console.log('Active users:', activeUsers);

    // Complex query with joins
    const usersWithPosts = await db.table('users')
      .select('users.*', 'posts.title', 'posts.created_at as post_created')
      .innerJoin('posts', 'users.id', '=', 'posts.user_id')
      .where('users.status', 'active')
      .where('posts.published', true)
      .orderBy('posts.created_at', 'DESC')
      .limit(10)
      .get();

    console.log('Users with posts:', usersWithPosts);

    // Aggregation
    const userCount = await db.table('users').count();
    console.log('Total users:', userCount);

    const avgAge = await db.table('users').avg('age');
    console.log('Average age:', avgAge);

    // Pagination
    const page1 = await db.table('users')
      .where('status', 'active')
      .orderBy('created_at', 'DESC')
      .paginate(1, 20);

    console.log('Page 1:', page1.data);
    console.log('Total pages:', page1.lastPage);

  } finally {
    await db.disconnect();
  }
}

// ========================================================================
// ORM Example
// ========================================================================

import { Model, Field, Table } from '../src/orm/model';

@Table('users')
class User extends Model {
  @Field({ type: 'number', primaryKey: true })
  id!: number;

  @Field({ type: 'string', notNull: true })
  name!: string;

  @Field({ type: 'string', unique: true })
  email!: string;

  @Field({ type: 'number' })
  age?: number;

  @Field({ type: 'string', defaultValue: 'active' })
  status!: string;
}

async function ormExample() {
  // Initialize model with adapter
  const adapter = await DatabaseFactory.connect({
    type: DatabaseType.D1,
    binding: 'DB',
    database: 'my_database',
  } as any);

  User.initialize(adapter, User.definition);

  try {
    // Create user
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    });

    console.log('Created user:', user.toJSON());

    // Find user
    const foundUser = await User.find(1);
    if (foundUser) {
      console.log('Found user:', foundUser.get('name'));
    }

    // Query users
    const activeUsers = await User.query()
      .where('status', 'active')
      .orderBy('created_at', 'DESC')
      .get();

    console.log('Active users:', activeUsers.length);

    // Update user
    await User.update(1, { age: 31 });

    // Delete user
    await User.delete(1);

  } finally {
    await adapter.disconnect();
  }
}

// ========================================================================
// Migration Example
// ========================================================================

import { createTable, dropTable, MigrationManager } from '../src/migrations/migrator';

async function migrationExample() {
  const adapter = await DatabaseFactory.connect({
    type: DatabaseType.D1,
    binding: 'DB',
    database: 'my_database',
  } as any);

  try {
    // Create a table using SchemaBuilder
    await createTable(adapter, 'users', (table) => {
      table.id();
      table.string('name').notNull();
      table.string('email').unique();
      table.integer('age');
      table.string('status').default('active');
      table.timestamps();
    });

    // Create index
    const { SchemaBuilder } = require('../src/migrations/migrator');
    const builder = new SchemaBuilder(adapter, 'users');
    await builder.index(['email'], { unique: true, name: 'idx_users_email' });

    console.log('Migration completed');

  } finally {
    await adapter.disconnect();
  }
}

// ========================================================================
// Connection Pool Example
// ========================================================================

import { ConnectionPoolFactory } from '../src/pool/pool';

async function poolExample() {
  const { D1Adapter } = await import('../src/adapters/d1-adapter');

  // Create a connection pool
  const pool = await ConnectionPoolFactory.createPool(
    'default',
    D1Adapter,
    {
      type: DatabaseType.D1,
      binding: 'DB',
      database: 'my_database',
    },
    {
      max: 20,
      min: 5,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000,
    }
  );

  try {
    // Acquire connection from pool
    const adapter = await pool.acquire();

    try {
      // Use connection
      const result = await adapter.query('SELECT * FROM users');
      console.log('Query result:', result.rows);
    } finally {
      // Release connection back to pool
      pool.release(adapter);
    }

    // Get pool stats
    const stats = pool.getStats();
    console.log('Pool stats:', stats);

  } finally {
    await ConnectionPoolFactory.closePool('default');
  }
}

// ========================================================================
// Run Examples
// ========================================================================

async function main() {
  console.log('Running QuickDB example...');
  await quickDBExample();

  console.log('\nRunning PostgreSQL example...');
  await postgresExample();

  console.log('\nRunning MySQL example...');
  await mysqlExample();

  console.log('\nRunning MongoDB example...');
  await mongoExample();

  console.log('\nRunning Redis example...');
  await redisExample();

  console.log('\nRunning transaction example...');
  await transactionExample();

  console.log('\nRunning query builder example...');
  await queryBuilderExample();

  console.log('\nRunning ORM example...');
  await ormExample();

  console.log('\nRunning migration example...');
  await migrationExample();

  console.log('\nRunning pool example...');
  await poolExample();
}

// Uncomment to run examples
// main().catch(console.error);
