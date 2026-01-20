#!/usr/bin/env node

/**
 * Test deployed Cocapn Hybrid IDE Worker
 */

import https from 'https';

const BASE_URL = 'https://cocapn-ide-staging.workers.dev';

console.log('🧪 Testing Deployed Cocapn Hybrid IDE Worker');
console.log('=' .repeat(50));

// Test helper function
function testEndpoint(path, expectedStatus = 200) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${path}`;
    console.log(`\n🔍 Testing: ${url}`);

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`  Status: ${res.statusCode} ${res.statusCode === expectedStatus ? '✅' : '❌'}`);
        if (res.statusCode === expectedStatus) {
          if (path === '/health') {
            try {
              const health = JSON.parse(data);
              console.log(`  Status: ${health.status}`);
              console.log(`  Timestamp: ${health.timestamp}`);
            } catch (e) {
              console.log('  ⚠️  Invalid JSON response');
            }
          } else if (path === '/') {
            if (data.includes('Cocapn') || data.includes('Hybrid IDE')) {
              console.log('  ✅ IDE interface loaded');
            } else {
              console.log('  ⚠️  Unexpected response');
            }
          }
        }
        resolve(res.statusCode === expectedStatus);
      });
    }).on('error', (err) => {
      console.log(`  ❌ Error: ${err.message}`);
      resolve(false);
    });
  });
}

// Run tests
async function runTests() {
  console.log('📁 Testing required endpoints...');

  const results = {
    health: await testEndpoint('/health', 200),
    main: await testEndpoint('/', 200),
    providers: await testEndpoint('/api/providers', 200),
    chat: await testEndpoint('/api/chat', 405), // POST endpoint
    files: await testEndpoint('/api/files', 405), // POST endpoint
    deploy: await testEndpoint('/api/deploy', 405) // POST endpoint
  };

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;

  console.log('\n' + '=' .repeat(50));
  console.log('📊 DEPLOYMENT TEST SUMMARY');
  console.log('=' .repeat(50));
  console.log(`📈 Tests Passed: ${passedTests}/${totalTests}`);

  Object.entries(results).forEach(([endpoint, passed]) => {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${endpoint}`);
  });

  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ The Hybrid IDE is deployed and working correctly');
    console.log('🌐 Access at: https://cocapn-ide-staging.workers.dev');
  } else {
    console.log('\n⚠️  Some tests failed');
    console.log('📝 Check the deployment logs with: wrangler tail');
  }

  console.log('\n🎯 Test completed!');
}

// Run tests
runTests().catch(console.error);