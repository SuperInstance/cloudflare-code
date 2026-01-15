#!/usr/bin/env node

/**
 * Simple test script for the authentication system
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8787';

async function testAuthentication() {
  console.log('🔐 Testing ClaudeFlare Authentication System\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log(`   Status: ${healthData.status}\n`);

    // Test 2: Register a new user
    console.log('2. Testing User Registration...');
    const registerResponse = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        password: 'test123!',
        firstName: 'Test',
        lastName: 'User'
      })
    });
    const registerData = await registerResponse.json();
    console.log(`   Registration: ${registerData.success ? '✅' : '❌'}`);
    if (registerData.success) {
      console.log(`   User ID: ${registerData.user?.id}\n`);
    } else {
      console.log(`   Error: ${registerData.error}\n`);
    }

    // Test 3: Login with credentials
    console.log('3. Testing User Login...');
    const loginResponse = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@claudeflare.com',
        password: 'admin123!'
      })
    });
    const loginData = await loginResponse.json();
    console.log(`   Login: ${loginData.success ? '✅' : '❌'}`);
    if (loginData.success) {
      console.log(`   Token: ${loginData.token?.accessToken?.substring(0, 20)}...\n`);
      const token = loginData.token.accessToken;

      // Test 4: Access protected endpoint without authentication
      console.log('4. Testing Protected Endpoint (No Auth)...');
      const protectedResponse = await fetch(`${BASE_URL}/api/v1/code-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'console.log("Hello World");',
          filePath: 'test.js'
        })
      });
      const protectedData = await protectedResponse.json();
      console.log(`   Status: ${protectedResponse.status}`);
      console.log(`   Result: ${protectedData.success ? '❌ (Should fail)' : '✅ (Correctly failed)'}\n`);

      // Test 5: Access protected endpoint with authentication
      console.log('5. Testing Protected Endpoint (With Auth)...');
      const authProtectedResponse = await fetch(`${BASE_URL}/api/v1/code-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: 'console.log("Hello World");',
          filePath: 'test.js'
        })
      });
      const authProtectedData = await authProtectedResponse.json();
      console.log(`   Status: ${authProtectedResponse.status}`);
      console.log(`   Result: ${authProtectedData.success ? '✅' : '❌'}`);
      if (authProtectedData.success) {
        console.log(`   Review: ${authProtectedData.issues?.length || 0} issues found\n`);
      } else {
        console.log(`   Error: ${authProtectedData.error}\n`);
      }

      // Test 6: Get user profile
      console.log('6. Testing User Profile...');
      const profileResponse = await fetch(`${BASE_URL}/api/v1/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const profileData = await profileResponse.json();
      console.log(`   Profile: ${profileData.success ? '✅' : '❌'}`);
      if (profileData.success) {
        console.log(`   User: ${profileData.user?.email} (${profileData.user?.role})\n`);
      }

      // Test 7: Create API key
      console.log('7. Testing API Key Creation...');
      const apiKeyResponse = await fetch(`${BASE_URL}/api/v1/auth/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Test API Key',
          permissions: ['read', 'write']
        })
      });
      const apiKeyData = await apiKeyResponse.json();
      console.log(`   API Key: ${apiKeyData.success ? '✅' : '❌'}`);
      if (apiKeyData.success) {
        const apiKey = apiKeyData.apiKey;
        console.log(`   Key: ${apiKey}\n`);

        // Test 8: Use API key to access protected endpoint
        console.log('8. Testing API Key Authentication...');
        const apiKeyResponse = await fetch(`${BASE_URL}/api/v1/code-review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          body: JSON.stringify({
            content: 'console.log("Hello API Key");',
            filePath: 'test.js'
          })
        });
        const apiKeyData = await apiKeyResponse.json();
        console.log(`   API Auth: ${apiKeyData.success ? '✅' : '❌'}`);
        if (apiKeyData.success) {
          console.log(`   Review: ${apiKeyData.issues?.length || 0} issues found\n`);
        }
      }

    } else {
      console.log(`   Login Error: ${loginData.error}\n`);
    }

    // Test 9: Logout
    console.log('9. Testing Logout...');
    const logoutResponse = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        accessToken: token
      })
    });
    const logoutData = await logoutResponse.json();
    console.log(`   Logout: ${logoutData.success ? '✅' : '❌'}\n`);

    console.log('🎉 Authentication System Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAuthentication();