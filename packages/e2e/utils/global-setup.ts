import { FullConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Global test setup
 *
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  // Load environment variables
  const envPath = path.join(process.cwd(), `.env.${process.env.TEST_ENV || 'development'}`);
  dotenv.config({ path: envPath });

  // Validate required environment variables
  const requiredVars = [
    'BASE_URL',
    'API_KEY',
    'TEST_USER_EMAIL',
    'TEST_USER_PASSWORD'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.warn(`⚠️  Warning: Missing environment variables: ${missing.join(', ')}`);
  }

  // Setup test database if needed
  await setupTestDatabase();

  // Seed test data
  await seedTestData();

  console.log('✅ Global setup complete');
}

/**
 * Setup test database
 */
async function setupTestDatabase() {
  // Database setup logic here
  console.log('📊 Setting up test database...');
}

/**
 * Seed test data
 */
async function seedTestData() {
  // Test data seeding logic here
  console.log('🌱 Seeding test data...');
}

export default globalSetup;
